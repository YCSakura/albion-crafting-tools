import { Calculator, Coins, DownloadCloud, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { calculateProfit, getSalesTaxRate } from "./domain/calculator";
import { getItemIconUrl } from "./domain/icons";
import { filterItems, getItems, getItemSubtypes, searchItems } from "./domain/items";
import { fetchAsiaPrices } from "./domain/market";
import type { CraftingItem, Ingredient, PriceQuote } from "./domain/types";
import { readPreference, writePreference } from "./storage/preferences";
import "./styles.css";

const ITEMS = getItems();
const STORAGE_KEY = "albion-crafting-calculator";
const CITY_RETURN_RATE_PRESETS = [
  { label: "自定义", returnRatePercent: null },
  { label: "Bridgewatch", returnRatePercent: "24.8" },
  { label: "Martlock", returnRatePercent: "24.8" },
  { label: "Thetford", returnRatePercent: "24.8" },
  { label: "Fort Sterling", returnRatePercent: "24.8" },
  { label: "Lymhurst", returnRatePercent: "24.8" },
  { label: "Caerleon", returnRatePercent: "24.8" },
  { label: "Brecilien", returnRatePercent: "15.2" }
];
const MARKET_CITY_OPTIONS = CITY_RETURN_RATE_PRESETS.filter((option) => option.returnRatePercent !== null).map(
  (option) => option.label
);
const DEFAULT_MARKET_CITY = "Thetford";

interface StoredState {
  selectedItemId: string;
  city: string;
  marketCity: string;
  saleCity: string;
  isPremium: boolean;
  returnRatePercent: string;
  craftingFee: string;
  prices: Record<string, string>;
}

const defaultStoredState: StoredState = {
  selectedItemId: ITEMS[0]?.itemId ?? "",
  city: "自定义",
  marketCity: DEFAULT_MARKET_CITY,
  saleCity: DEFAULT_MARKET_CITY,
  isPremium: true,
  returnRatePercent: "0",
  craftingFee: "0",
  prices: {}
};

function App() {
  const initialState = readPreference<StoredState>(STORAGE_KEY, defaultStoredState);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [subtype, setSubtype] = useState("全部");
  const [tier, setTier] = useState("全部");
  const [enchantment, setEnchantment] = useState("全部");
  const [selectedItemId, setSelectedItemId] = useState(initialState.selectedItemId);
  const [city, setCity] = useState(getKnownCity(initialState.city));
  const [marketCity, setMarketCity] = useState(getKnownMarketCity(initialState.marketCity));
  const [saleCity, setSaleCity] = useState(getKnownMarketCity(initialState.saleCity));
  const [isPremium, setIsPremium] = useState(initialState.isPremium);
  const [returnRatePercent, setReturnRatePercent] = useState(initialState.returnRatePercent);
  const [craftingFee, setCraftingFee] = useState(initialState.craftingFee);
  const [prices, setPrices] = useState<Record<string, string>>(initialState.prices);
  const [quotes, setQuotes] = useState<Record<string, PriceQuote>>({});
  const [marketStatus, setMarketStatus] = useState("尚未拉取市场价");
  const [saleStatus, setSaleStatus] = useState("尚未拉取成品售价");
  const [isFetching, setIsFetching] = useState(false);
  const [isFetchingSalePrice, setIsFetchingSalePrice] = useState(false);

  const selectedItem = useMemo(
    () => ITEMS.find((item) => item.itemId === selectedItemId) ?? ITEMS[0],
    [selectedItemId]
  );

  const categories = useMemo(() => ["全部", ...Array.from(new Set(ITEMS.map((item) => item.category)))], []);
  const subtypes = useMemo(
    () => (category === "全部" ? [] : getItemSubtypes(ITEMS, category)),
    [category]
  );
  const tiers = useMemo(() => ["全部", ...Array.from(new Set(ITEMS.map((item) => item.tier))).sort((a, b) => a - b).map(String)], []);
  const filteredItems = useMemo(() => {
    const searched = searchItems(ITEMS, query);
    return filterItems(searched, {
      category: category === "全部" ? undefined : category,
      subtype: subtype === "全部" ? undefined : subtype,
      tier: tier === "全部" ? undefined : Number(tier),
      enchantment: enchantment === "全部" ? undefined : Number(enchantment)
    });
  }, [category, enchantment, query, subtype, tier]);
  const visibleFilteredItems = filteredItems.slice(0, 120);

  useEffect(() => {
    setSubtype("全部");
  }, [category]);

  useEffect(() => {
    writePreference<StoredState>(STORAGE_KEY, {
      selectedItemId,
      city,
      marketCity,
      saleCity,
      isPremium,
      returnRatePercent,
      craftingFee,
      prices
    });
  }, [city, craftingFee, isPremium, marketCity, prices, returnRatePercent, saleCity, selectedItemId]);

  const result = useMemo(() => {
    if (!selectedItem) return null;
    return calculateProfit({
      outputSellPrice: parseNumber(prices[selectedItem.itemId]),
      craftAmount: selectedItem.craftAmount,
      returnRate: parseNumber(returnRatePercent) / 100,
      craftingFeePerItem: parseNumber(craftingFee),
      isPremium,
      ingredients: selectedItem.ingredients.map((ingredient) => ({
        ...ingredient,
        nameZh: getIngredientDisplayName(ingredient),
        unitPrice: parseNumber(prices[ingredient.itemId])
      }))
    });
  }, [craftingFee, isPremium, prices, returnRatePercent, selectedItem]);
  const materialTotalCost = useMemo(() => {
    if (!selectedItem) return null;
    return selectedItem.ingredients.reduce<number | null>((total, ingredient) => {
      if (total === null) return null;
      const unitPrice = parseNumber(prices[ingredient.itemId]);
      return Number.isFinite(unitPrice) ? total + unitPrice * ingredient.quantity : null;
    }, 0);
  }, [prices, selectedItem]);

  async function handleFetchPrices() {
    if (!selectedItem) return;
    setIsFetching(true);
    setMarketStatus(`正在拉取 ${marketCity} 市场价...`);
    try {
      const itemIds = selectedItem.ingredients.map((ingredient) => ingredient.itemId);
      const nextQuotes = await fetchAsiaPrices(itemIds, { city: marketCity });
      const usableItemIds = itemIds.filter(
        (itemId) => nextQuotes[itemId]?.hasMarketData && nextQuotes[itemId].price !== null
      );
      setQuotes((current) => ({ ...current, ...nextQuotes }));
      setPrices((current) => {
        const merged = { ...current };
        usableItemIds.forEach((itemId) => {
          if (!merged[itemId] && nextQuotes[itemId]?.hasMarketData && nextQuotes[itemId].price !== null) {
            merged[itemId] = String(nextQuotes[itemId].price);
          }
        });
        return merged;
      });
      if (usableItemIds.length === 0) {
        setMarketStatus("本次没有拿到可用市场价；可以手动填写价格");
      } else {
        const missingCount = itemIds.length - usableItemIds.length;
        setMarketStatus(
          missingCount > 0
            ? `市场价已更新 ${usableItemIds.length} 项，${missingCount} 项无可用价格；已手动填写的价格会保留`
            : `市场价已更新 ${usableItemIds.length} 项；已手动填写的价格会保留`
        );
      }
    } catch (error) {
      setMarketStatus(error instanceof Error ? error.message : "本次拉取失败，请稍后重试");
    } finally {
      setIsFetching(false);
    }
  }

  async function handleFetchSalePrice() {
    if (!selectedItem) return;
    setIsFetchingSalePrice(true);
    setSaleStatus(`正在拉取 ${saleCity} 成品售价...`);
    try {
      const itemIds = [selectedItem.itemId];
      const nextQuotes = await fetchAsiaPrices(itemIds, { city: saleCity });
      const quote = nextQuotes[selectedItem.itemId];
      setQuotes((current) => ({ ...current, ...nextQuotes }));
      if (!quote?.hasMarketData || quote.price === null) {
        setSaleStatus("本次没有拿到可用成品售价；可以手动填写价格");
        return;
      }
      setPrices((current) => {
        if (current[selectedItem.itemId]) return current;
        return { ...current, [selectedItem.itemId]: String(quote.price) };
      });
      setSaleStatus("成品售价已更新；已手动填写的价格会保留");
    } catch (error) {
      setSaleStatus(error instanceof Error ? error.message : "本次成品售价拉取失败，请稍后重试");
    } finally {
      setIsFetchingSalePrice(false);
    }
  }

  function updatePrice(itemId: string, value: string) {
    setPrices((current) => ({ ...current, [itemId]: value }));
  }

  function handleCityChange(nextCity: string) {
    setCity(nextCity);
    const preset = CITY_RETURN_RATE_PRESETS.find((option) => option.label === nextCity);
    if (preset && preset.returnRatePercent !== null) {
      setReturnRatePercent(preset.returnRatePercent);
      setMarketCity(getKnownMarketCity(nextCity));
      setSaleCity(getKnownMarketCity(nextCity));
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Asia 本地计算</p>
          <h1>阿尔比恩制造利润计算器</h1>
        </div>
        <div className="topbar-metric">
          <span>销售税率</span>
          <strong>{formatPercent(getSalesTaxRate(isPremium))}</strong>
        </div>
      </header>

      <div className="calculator-grid">
        <section className="panel selection-panel" aria-labelledby="equipment-heading">
          <div className="section-title">
            <Search aria-hidden="true" size={20} />
            <h2 id="equipment-heading">装备选择</h2>
          </div>

          <label className="field">
            <span>搜索装备</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="输入中文名、英文名或物品 ID" />
          </label>

          <div className="filters selection-filters">
            <label className="field">
              <span>装备类型</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>具体类型</span>
              <select value={subtype} onChange={(event) => setSubtype(event.target.value)} disabled={category === "全部"}>
                <option>全部</option>
                {subtypes.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tier</span>
              <select value={tier} onChange={(event) => setTier(event.target.value)}>
                {tiers.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>附魔</span>
              <select value={enchantment} onChange={(event) => setEnchantment(event.target.value)}>
                {["全部", "0", "1", "2", "3", "4"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <p className="result-count">显示 {visibleFilteredItems.length} / {filteredItems.length} 条结果</p>
          <div className="search-results">
            {visibleFilteredItems.map((item) => (
              <button
                className={item.itemId === selectedItem?.itemId ? "result-row selected" : "result-row"}
                key={item.itemId}
                onClick={() => setSelectedItemId(item.itemId)}
                aria-label={`${item.nameZh} ${item.itemId}`}
              >
                <ItemIcon item={item} />
                <span>
                  <strong>{item.nameZh}</strong>
                </span>
                <em>
                  T{item.tier}.{item.enchantment}
                </em>
              </button>
            ))}
          </div>
        </section>

        {selectedItem ? (
          <>
            <section className="panel item-panel" aria-label="已选装备">
              <ItemIcon item={selectedItem} large />
              <div>
                <p className="eyebrow">当前装备</p>
                <h2>{selectedItem.nameZh}</h2>
                <p>
                  Tier T{selectedItem.tier} · 附魔 .{selectedItem.enchantment} · 单次产出 {selectedItem.craftAmount}
                </p>
              </div>
            </section>

            <section className="panel cost-panel" aria-labelledby="cost-heading">
              <div className="cost-header">
                <div className="section-title">
                  <Coins aria-hidden="true" size={20} />
                  <h2 id="cost-heading">成本区</h2>
                </div>
                <div className="cost-total" aria-live="polite">
                  <span>总成本</span>
                  <strong>{materialTotalCost === null ? "成本待填" : formatSilver(materialTotalCost)}</strong>
                </div>
                <div className="cost-market-controls">
                  <label className="field cost-market-field">
                    <span>价格地区</span>
                    <select value={marketCity} onChange={(event) => setMarketCity(event.target.value)}>
                      {MARKET_CITY_OPTIONS.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <button className="primary-action" onClick={handleFetchPrices} disabled={isFetching}>
                    <DownloadCloud aria-hidden="true" size={18} />
                    {isFetching ? "拉取中..." : `拉取 ${marketCity} 市场价`}
                  </button>
                  <p className="status">{marketStatus}</p>
                </div>
              </div>

              <div className="cost-list">
                {selectedItem.ingredients.map((ingredient) => (
                  <IngredientCostRow
                    key={ingredient.itemId}
                    ingredient={ingredient}
                    value={prices[ingredient.itemId] ?? ""}
                    quote={quotes[ingredient.itemId]}
                    onChange={updatePrice}
                  />
                ))}
              </div>
            </section>

            <section className="panel parameters-panel" aria-labelledby="parameters-heading">
              <div className="section-title">
                <Calculator aria-hidden="true" size={20} />
                <h2 id="parameters-heading">制造参数</h2>
              </div>

              <div className="filters parameters-fields">
                <label className="field region-field">
                  <span>制作地区</span>
                  <select value={city} onChange={(event) => handleCityChange(event.target.value)}>
                    {CITY_RETURN_RATE_PRESETS.map((option) => (
                      <option key={option.label}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="filters parameters-fields">
                <label className="field">
                  <span>返还率</span>
                  <input
                    type="number"
                    value={returnRatePercent}
                    onChange={(event) => setReturnRatePercent(event.target.value)}
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </label>
              </div>
            </section>

            <section className="panel results-panel" aria-labelledby="results-heading">
              <div className="section-title">
                <Calculator aria-hidden="true" size={20} />
                <h2 id="results-heading">利润结果</h2>
              </div>
              <div className="result-controls">
                <div className="sale-market-controls">
                  <label className="field sale-market-field">
                    <span>售价地区</span>
                    <select value={saleCity} onChange={(event) => setSaleCity(event.target.value)}>
                      {MARKET_CITY_OPTIONS.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <button className="primary-action" onClick={handleFetchSalePrice} disabled={isFetchingSalePrice}>
                    <DownloadCloud aria-hidden="true" size={18} />
                    {isFetchingSalePrice ? "拉取中..." : `拉取 ${saleCity} 成品售价`}
                  </button>
                  <p className="status">{saleStatus}</p>
                </div>
                <div className="result-form-controls">
                  <PriceField
                    label="成品售价"
                    itemId={selectedItem.itemId}
                    value={prices[selectedItem.itemId] ?? ""}
                    quote={quotes[selectedItem.itemId]}
                    onChange={updatePrice}
                  />
                  <label className="field">
                    <span>制造手续费</span>
                    <input
                      type="number"
                      value={craftingFee}
                      onChange={(event) => setCraftingFee(event.target.value)}
                      min="0"
                      step="1"
                    />
                  </label>
                  <label className="switch-field">
                    <input type="checkbox" checked={isPremium} onChange={(event) => setIsPremium(event.target.checked)} />
                    会员
                  </label>
                </div>
              </div>
              {result?.ok ? (
                <>
                  <div className="metric-grid">
                    <Metric label="材料毛成本" value={formatSilver(result.materialGrossCost)} />
                    <Metric label="返还材料价值" value={formatSilver(result.returnedMaterialValue)} />
                    <Metric label="返还后成本" value={formatSilver(result.postReturnCost)} />
                    <Metric label="销售税率" value={formatPercent(result.salesTaxRate)} />
                    <Metric label="销售税" value={formatSilver(result.salesTax)} />
                    <Metric label="净收入" value={formatSilver(result.netRevenue)} />
                    <Metric label="单件利润" value={formatSilver(result.unitProfit)} tone={result.unitProfit >= 0 ? "good" : "bad"} />
                    <Metric label="利润率" value={result.profitMargin === null ? "不可计算" : formatPercent(result.profitMargin)} />
                    <Metric label="保本售价" value={result.breakEvenSellPrice === null ? "不可计算" : formatSilver(result.breakEvenSellPrice)} />
                  </div>

                  <div className="detail-table" role="table" aria-label="材料明细">
                    <div role="row" className="table-head">
                      <span>材料</span>
                      <span>数量</span>
                      <span>单价</span>
                      <span>成本</span>
                      <span>返还</span>
                    </div>
                    {result.ingredientLines.map((line) => (
                      <div role="row" key={line.itemId}>
                        <span>{line.nameZh}</span>
                        <span>{line.quantity}</span>
                        <span>{formatSilver(line.unitPrice)}</span>
                        <span>{formatSilver(line.grossCost)}</span>
                        <span>{formatSilver(line.returnedValue)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <strong>无法计算</strong>
                  <ul>
                    {(result?.reasons ?? ["请选择装备并填写价格"]).map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function PriceField({
  label,
  itemId,
  value,
  quote,
  onChange
}: {
  label: string;
  itemId: string;
  value: string;
  quote?: PriceQuote;
  onChange: (itemId: string, value: string) => void;
}) {
  const inputId = `price-${itemId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  return (
    <div className="field price-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="number"
        value={value}
        onChange={(event) => onChange(itemId, event.target.value)}
        min="0"
        step="1"
      />
      <small>{quote ? quote.observedAt ?? "无市场数据" : "无市场数据，可手填"}</small>
    </div>
  );
}

function IngredientCostRow({
  ingredient,
  value,
  quote,
  onChange
}: {
  ingredient: Ingredient;
  value: string;
  quote?: PriceQuote;
  onChange: (itemId: string, value: string) => void;
}) {
  const inputId = `price-${ingredient.itemId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const displayName = getIngredientDisplayName(ingredient);
  const unitPrice = parseNumber(value);
  const lineCost = Number.isFinite(unitPrice) ? unitPrice * ingredient.quantity : null;

  return (
    <div className="cost-row">
      <ItemIconById itemId={ingredient.itemId} name={displayName} variant="cost" />
      <div className="cost-row-main">
        <strong>{displayName}</strong>
        <em>数量 {ingredient.quantity}</em>
      </div>
      <label className="field compact-field" htmlFor={inputId}>
        <span>{displayName} 单价</span>
        <input
          id={inputId}
          type="number"
          value={value}
          onChange={(event) => onChange(ingredient.itemId, event.target.value)}
          min="0"
          step="1"
        />
      </label>
      <div className="cost-row-meta">
        <span>{lineCost === null ? "成本待填" : formatSilver(lineCost)}</span>
        <small>{quote ? quote.observedAt ?? "无市场数据" : "无市场数据，可手填"}</small>
      </div>
    </div>
  );
}

function ItemIcon({ item, large = false }: { item: CraftingItem; large?: boolean }) {
  return <ItemIconById itemId={item.itemId} name={item.nameZh} variant={large ? "large" : "default"} />;
}

function ItemIconById({
  itemId,
  name,
  variant = "default"
}: {
  itemId: string;
  name: string;
  variant?: "default" | "cost" | "large";
}) {
  const [failed, setFailed] = useState(false);
  const className = variant === "default" ? "item-icon" : `item-icon ${variant}`;
  const placeholderClassName = variant === "default" ? "icon-placeholder" : `icon-placeholder ${variant}`;

  return failed ? (
    <div className={placeholderClassName} aria-label={`${name} 图标占位`}>
      {name.slice(0, 1)}
    </div>
  ) : (
    <img
      className={className}
      src={getItemIconUrl(itemId)}
      alt={`${name} 图标`}
      onError={() => setFailed(true)}
    />
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className={tone ? `metric ${tone}` : "metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function parseNumber(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return Number.NaN;
  return Number(value);
}

function getKnownCity(value: string): string {
  return CITY_RETURN_RATE_PRESETS.some((option) => option.label === value) ? value : "自定义";
}

function getKnownMarketCity(value: string | undefined): string {
  return value && MARKET_CITY_OPTIONS.includes(value) ? value : DEFAULT_MARKET_CITY;
}

function getIngredientDisplayName(ingredient: Ingredient): string {
  if (!isRawItemCode(ingredient.nameZh)) return ingredient.nameZh;

  const tier = ingredient.itemId.match(/^T(\d+)_/)?.[1];
  const enchantment = ingredient.itemId.match(/(?:_LEVEL|@)(\d)$/)?.[1];
  const tierLabel = tier ? `T${tier}${enchantment ? `.${enchantment}` : ""}` : "";
  const materialName = getMaterialKindName(ingredient.itemId);

  return [tierLabel, materialName].filter(Boolean).join(" ") || "材料";
}

function isRawItemCode(value: string): boolean {
  return /^[A-Z0-9_@]+$/.test(value);
}

function getMaterialKindName(itemId: string): string {
  if (itemId.includes("PLANKS")) return "木板";
  if (itemId.includes("METALBAR")) return "金属锭";
  if (itemId.includes("CLOTH")) return "布料";
  if (itemId.includes("LEATHER")) return "皮革";
  if (itemId.includes("STONEBLOCK")) return "石块";
  if (itemId.includes("ARTEFACT")) return "神器材料";
  if (itemId.includes("WOOD")) return "木材";
  if (itemId.includes("ORE")) return "矿石";
  if (itemId.includes("FIBER")) return "纤维";
  if (itemId.includes("HIDE")) return "兽皮";
  if (itemId.includes("ROCK")) return "石料";
  return "材料";
}

function formatSilver(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0
  }).format(Math.round(value));
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2
  }).format(value * 100)}%`;
}

export default App;

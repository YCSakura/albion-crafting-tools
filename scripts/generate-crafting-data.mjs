import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_BASE = "https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputPath = path.join(projectRoot, "src", "data", "items.json");

const itemGroups = ["equipmentitem", "weapon", "consumableitem"];
const categoryNames = {
  armors: "护甲",
  weapons: "武器",
  armor: "护甲",
  accessories: "配饰",
  bags: "背包",
  capes: "披风",
  consumables: "食物",
  gathering: "采集装备",
  head: "头盔",
  offhands: "副手",
  other: "其他",
  shoes: "鞋子",
  vanity: "外观"
};

const shopSubcategoryNames = {
  bag: "背包",
  cape: "披风",
  food: "食物",
  head: "头盔",
  mainhand: "主手",
  offhand: "副手",
  shoes: "鞋子",
  armor: "胸甲"
};

async function main() {
  const [itemsDump, localizationDump] = await Promise.all([
    fetchJson(`${SOURCE_BASE}/items.json`),
    fetchJson(`${SOURCE_BASE}/localization.json`)
  ]);
  const localizedNames = buildLocalizationMap(localizationDump);
  const allRawItems = Object.values(itemsDump.items).flatMap((value) => asArray(value)).filter((item) => item?.["@uniquename"]);
  const rawItems = itemGroups.flatMap((group) => asArray(itemsDump.items[group]));
  const nameLookup = new Map(allRawItems.map((item) => [item["@uniquename"], getLocalizedName(item["@uniquename"], localizedNames)]));

  const generated = rawItems
    .filter((item) => isCraftableEquipment(item) || isCraftableFood(item))
    .flatMap((item) => expandCraftingItem(item, localizedNames, nameLookup))
    .filter((item) => item.ingredients.length > 0)
    .sort((a, b) => a.category.localeCompare(b.category, "zh-CN") || a.tier - b.tier || a.itemId.localeCompare(b.itemId));

  await fs.writeFile(outputPath, `${JSON.stringify(generated, null, 2)}\n`, "utf8");
  console.log(`Generated ${generated.length} craftable equipment/food recipes at ${path.relative(projectRoot, outputPath)}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

function buildLocalizationMap(localizationDump) {
  const result = new Map();
  for (const unit of asArray(localizationDump.tmx?.body?.tu)) {
    const key = unit["@tuid"];
    if (!key) continue;
    const entries = asArray(unit.tuv);
    const zh = entries.find((entry) => entry["@xml:lang"] === "ZH-CN")?.seg;
    const en = entries.find((entry) => entry["@xml:lang"] === "EN-US")?.seg;
    result.set(key, { zh, en });
  }
  return result;
}

function isCraftableEquipment(item) {
  return ["equipmentitem", "weapon"].includes(itemKind(item)) && hasCraftingRequirements(item);
}

function isCraftableFood(item) {
  return itemKind(item) === "consumableitem" && item["@shopsubcategory1"] === "food" && hasCraftingRequirements(item);
}

function itemKind(item) {
  if (item["@slottype"] === "food" || item["@shopsubcategory1"] === "food") return "consumableitem";
  if (item["@shopcategory"] === "weapons") return "weapon";
  return "equipmentitem";
}

function hasCraftingRequirements(item) {
  return Boolean(item.craftingrequirements?.craftresource || asArray(item.craftingrequirements)[0]?.craftresource);
}

function expandCraftingItem(item, localizedNames, nameLookup) {
  const baseId = item["@uniquename"];
  const baseName = getLocalizedName(baseId, localizedNames);
  const base = makeCraftingItem(item, baseId, 0, baseName, getPrimaryCraftingRequirements(item.craftingrequirements), nameLookup);
  const enchantments = asArray(item.enchantments?.enchantment).map((enchantment) => {
    const level = Number(enchantment["@enchantmentlevel"]);
    const itemId = `${baseId}@${level}`;
    return makeCraftingItem(
      item,
      itemId,
      level,
      addEnchantmentSuffix(baseName, level),
      getPrimaryCraftingRequirements(enchantment.craftingrequirements),
      nameLookup
    );
  });

  return [base, ...enchantments].filter(Boolean);
}

function makeCraftingItem(sourceItem, itemId, enchantment, localizedName, craftingRequirements, nameLookup) {
  if (!craftingRequirements?.craftresource) return null;

  const ingredients = asArray(craftingRequirements.craftresource).map((resource) => {
    const resourceId = resource["@uniquename"];
    const localized = nameLookup.get(resourceId) ?? { zh: resourceId, en: resourceId };
    return {
      itemId: resourceId,
      nameZh: localized.zh || localized.en || resourceId,
      quantity: Number(resource["@count"] ?? 0)
    };
  });

  return {
    itemId,
    nameZh: localizedName.zh || localizedName.en || itemId,
    nameEn: localizedName.en || localizedName.zh || itemId,
    category: getCategory(sourceItem),
    tier: Number(sourceItem["@tier"] ?? 0),
    enchantment,
    craftAmount: Number(craftingRequirements["@amountcrafted"] ?? 1),
    ingredients
  };
}

function getPrimaryCraftingRequirements(craftingRequirements) {
  return asArray(craftingRequirements)[0] ?? null;
}

function getLocalizedName(itemId, localizedNames) {
  const baseId = itemId.split("@")[0];
  return localizedNames.get(`@ITEMS_${baseId}`) ?? { zh: baseId, en: baseId };
}

function addEnchantmentSuffix(localizedName, enchantment) {
  return {
    zh: localizedName.zh ? `${localizedName.zh} .${enchantment}` : undefined,
    en: localizedName.en ? `${localizedName.en} .${enchantment}` : undefined
  };
}

function getCategory(item) {
  if (item["@shopsubcategory1"] === "food") return "食物";
  return shopSubcategoryNames[item["@shopsubcategory1"]] ?? categoryNames[item["@shopcategory"]] ?? item["@shopcategory"] ?? "其他";
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import type { AlbionPriceRow, PriceQuote } from "./types";

const ASIA_API_HOST = "https://east.albion-online-data.com";

type FetchLike = (input: string) => Promise<{
  ok: boolean;
  status?: number;
  json: () => Promise<AlbionPriceRow[]>;
}>;

interface FetchAsiaPricesOptions {
  city?: string;
  fetchImpl?: FetchLike;
}

export function buildAsiaPricesUrl(itemIds: string[], city?: string): string {
  const encodedIds = itemIds.map((itemId) => encodeURIComponent(itemId)).join(",");
  const locationQuery = city ? `?locations=${encodeURIComponent(city)}` : "";
  return `${ASIA_API_HOST}/api/v2/stats/prices/${encodedIds}.json${locationQuery}`;
}

export function adaptPriceRows(rows: AlbionPriceRow[]): Record<string, PriceQuote> {
  return rows.reduce<Record<string, PriceQuote>>((quotes, row) => {
    const price = row.sell_price_min && row.sell_price_min > 0 ? row.sell_price_min : null;
    const current = quotes[row.item_id];
    if (current?.hasMarketData && current.price !== null && (price === null || current.price <= price)) {
      return quotes;
    }

    quotes[row.item_id] = {
      itemId: row.item_id,
      city: row.city ?? "",
      price,
      observedAt: price ? row.sell_price_min_date ?? null : null,
      hasMarketData: price !== null
    };
    return quotes;
  }, {});
}

export async function fetchAsiaPrices(
  itemIds: string[],
  options: FetchAsiaPricesOptions = {}
): Promise<Record<string, PriceQuote>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(buildAsiaPricesUrl(itemIds, options.city));
  if (!response.ok) {
    throw new Error(`市场价格拉取失败${response.status ? `：${response.status}` : ""}`);
  }

  return adaptPriceRows(await response.json());
}

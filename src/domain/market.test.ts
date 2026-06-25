import { describe, expect, it, vi } from "vitest";
import { adaptPriceRows, buildAsiaPricesUrl, fetchAsiaPrices } from "./market";

describe("market adapter", () => {
  it("builds the Asia prices URL with comma-separated item IDs", () => {
    expect(buildAsiaPricesUrl(["T6_2H_AXE_AVALON@3", "T6_PLANKS"])).toBe(
      "https://east.albion-online-data.com/api/v2/stats/prices/T6_2H_AXE_AVALON%403,T6_PLANKS.json"
    );
  });

  it("adds a selected city as the locations query parameter", () => {
    expect(buildAsiaPricesUrl(["T4_PLANKS"], "Fort Sterling")).toBe(
      "https://east.albion-online-data.com/api/v2/stats/prices/T4_PLANKS.json?locations=Fort%20Sterling"
    );
  });

  it("uses sell_price_min as the default usable price and keeps timestamps", () => {
    const prices = adaptPriceRows([
      {
        item_id: "T6_PLANKS",
        city: "Bridgewatch",
        sell_price_min: 125,
        sell_price_min_date: "2026-06-25T10:00:00Z",
        buy_price_max: 99,
        buy_price_max_date: "2026-06-25T09:00:00Z"
      }
    ]);

    expect(prices.T6_PLANKS).toEqual({
      itemId: "T6_PLANKS",
      city: "Bridgewatch",
      price: 125,
      observedAt: "2026-06-25T10:00:00Z",
      hasMarketData: true
    });
  });

  it("marks zero or missing sell_price_min as no market data", () => {
    const prices = adaptPriceRows([
      {
        item_id: "T6_PLANKS",
        city: "Caerleon",
        sell_price_min: 0,
        sell_price_min_date: "",
        buy_price_max: 90,
        buy_price_max_date: "2026-06-25T09:00:00Z"
      },
      {
        item_id: "T6_METALBAR",
        city: "Caerleon",
        sell_price_min: null,
        sell_price_min_date: null,
        buy_price_max: 40,
        buy_price_max_date: "2026-06-25T09:00:00Z"
      }
    ]);

    expect(prices.T6_PLANKS).toMatchObject({ price: null, hasMarketData: false });
    expect(prices.T6_METALBAR).toMatchObject({ price: null, hasMarketData: false });
  });

  it("keeps the lowest usable price when later rows for the same item have no data", () => {
    const prices = adaptPriceRows([
      {
        item_id: "T6_PLANKS",
        city: "Bridgewatch",
        sell_price_min: 125,
        sell_price_min_date: "2026-06-25T10:00:00Z"
      },
      {
        item_id: "T6_PLANKS",
        city: "Martlock",
        sell_price_min: 118,
        sell_price_min_date: "2026-06-25T11:00:00Z"
      },
      {
        item_id: "T6_PLANKS",
        city: "Thetford",
        sell_price_min: 0,
        sell_price_min_date: "0001-01-01T00:00:00"
      }
    ]);

    expect(prices.T6_PLANKS).toEqual({
      itemId: "T6_PLANKS",
      city: "Martlock",
      price: 118,
      observedAt: "2026-06-25T11:00:00Z",
      hasMarketData: true
    });
  });

  it("fetches Asia prices through an injected fetch implementation", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          item_id: "T4_PLANKS",
          city: "Lymhurst",
          sell_price_min: 77,
          sell_price_min_date: "2026-06-25T11:00:00Z"
        }
      ]
    });

    const result = await fetchAsiaPrices(["T4_PLANKS"], { city: "Lymhurst", fetchImpl });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://east.albion-online-data.com/api/v2/stats/prices/T4_PLANKS.json?locations=Lymhurst"
    );
    expect(result.T4_PLANKS.price).toBe(77);
  });
});

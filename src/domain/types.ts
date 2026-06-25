export interface CalculationIngredientInput {
  itemId: string;
  nameZh: string;
  quantity: number;
  unitPrice: number;
}

export interface CalculationInput {
  outputSellPrice: number;
  craftAmount: number;
  returnRate: number;
  craftingFeePerItem: number;
  isPremium: boolean;
  ingredients: CalculationIngredientInput[];
}

export interface IngredientCalculationLine extends CalculationIngredientInput {
  grossCost: number;
  returnedValue: number;
}

export type CalculationResult =
  | {
      ok: true;
      materialGrossCost: number;
      returnedMaterialValue: number;
      postReturnCost: number;
      salesTaxRate: number;
      salesTax: number;
      netRevenue: number;
      unitProfit: number;
      profitMargin: number | null;
      breakEvenSellPrice: number | null;
      ingredientLines: IngredientCalculationLine[];
    }
  | {
      ok: false;
      reasons: string[];
    };

export interface Ingredient {
  itemId: string;
  nameZh: string;
  quantity: number;
}

export interface CraftingItem {
  itemId: string;
  nameZh: string;
  nameEn: string;
  category: string;
  tier: number;
  enchantment: number;
  craftAmount: number;
  ingredients: Ingredient[];
}

export interface ItemFilters {
  category?: string;
  subtype?: string;
  tier?: number;
  enchantment?: number;
}

export interface AlbionPriceRow {
  item_id: string;
  city?: string;
  sell_price_min?: number | null;
  sell_price_min_date?: string | null;
  buy_price_max?: number | null;
  buy_price_max_date?: string | null;
}

export interface PriceQuote {
  itemId: string;
  city: string;
  price: number | null;
  observedAt: string | null;
  hasMarketData: boolean;
}

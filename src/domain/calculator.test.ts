import { describe, expect, it } from "vitest";
import { calculateProfit, getSalesTaxRate } from "./calculator";

describe("getSalesTaxRate", () => {
  it("uses 4 percent sales tax for premium users and 8 percent for non-premium users", () => {
    expect(getSalesTaxRate(true)).toBe(0.04);
    expect(getSalesTaxRate(false)).toBe(0.08);
  });
});

describe("calculateProfit", () => {
  it("calculates one-item crafting profit with material return and crafting fee", () => {
    const result = calculateProfit({
      outputSellPrice: 1_000,
      craftAmount: 1,
      returnRate: 0.248,
      craftingFeePerItem: 25,
      isPremium: true,
      ingredients: [
        { itemId: "T6_PLANKS", nameZh: "血橡木板", quantity: 16, unitPrice: 20 },
        { itemId: "T6_METALBAR", nameZh: "钛钢锭", quantity: 8, unitPrice: 30 }
      ]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.reasons.join(", "));
    }

    expect(result.materialGrossCost).toBeCloseTo(560);
    expect(result.returnedMaterialValue).toBeCloseTo(138.88);
    expect(result.postReturnCost).toBeCloseTo(446.12);
    expect(result.salesTaxRate).toBe(0.04);
    expect(result.salesTax).toBeCloseTo(40);
    expect(result.netRevenue).toBeCloseTo(960);
    expect(result.unitProfit).toBeCloseTo(513.88);
    expect(result.profitMargin).toBeCloseTo(1.151887);
    expect(result.breakEvenSellPrice).toBeCloseTo(464.708333);
    expect(result.ingredientLines[0]).toMatchObject({
      itemId: "T6_PLANKS",
      grossCost: 320,
      returnedValue: 79.36
    });
  });

  it("divides material costs by craft amount", () => {
    const result = calculateProfit({
      outputSellPrice: 600,
      craftAmount: 2,
      returnRate: 0.15,
      craftingFeePerItem: 10,
      isPremium: false,
      ingredients: [{ itemId: "T4_CLOTH", nameZh: "亚麻布", quantity: 20, unitPrice: 12 }]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.reasons.join(", "));
    }

    expect(result.materialGrossCost).toBeCloseTo(120);
    expect(result.returnedMaterialValue).toBeCloseTo(18);
    expect(result.postReturnCost).toBeCloseTo(112);
    expect(result.salesTaxRate).toBe(0.08);
    expect(result.salesTax).toBeCloseTo(48);
    expect(result.netRevenue).toBeCloseTo(552);
    expect(result.unitProfit).toBeCloseTo(440);
    expect(result.breakEvenSellPrice).toBeCloseTo(121.73913);
  });

  it("returns validation reasons for impossible inputs", () => {
    const result = calculateProfit({
      outputSellPrice: -1,
      craftAmount: 0,
      returnRate: 1.2,
      craftingFeePerItem: Number.NaN,
      isPremium: true,
      ingredients: [{ itemId: "T4_METALBAR", nameZh: "钢锭", quantity: 4, unitPrice: -5 }]
    });

    expect(result).toEqual({
      ok: false,
      reasons: [
        "成品售价不能为负数",
        "单次制造产出数量必须大于 0",
        "返还率必须在 0 到 1 之间",
        "制造手续费不能为空",
        "材料价格不能为负数"
      ]
    });
  });

  it("does not calculate margin or break-even price when post-return cost is not positive", () => {
    const result = calculateProfit({
      outputSellPrice: 100,
      craftAmount: 1,
      returnRate: 1,
      craftingFeePerItem: 0,
      isPremium: true,
      ingredients: [{ itemId: "T4_PLANKS", nameZh: "松木板", quantity: 4, unitPrice: 10 }]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.reasons.join(", "));
    }

    expect(result.postReturnCost).toBe(0);
    expect(result.profitMargin).toBeNull();
    expect(result.breakEvenSellPrice).toBeNull();
  });
});

import type { CalculationInput, CalculationResult } from "./types";

export function getSalesTaxRate(isPremium: boolean): number {
  return isPremium ? 0.04 : 0.08;
}

export function calculateProfit(input: CalculationInput): CalculationResult {
  const reasons = validateCalculationInput(input);
  if (reasons.length > 0) {
    return { ok: false, reasons };
  }

  const ingredientLines = input.ingredients.map((ingredient) => {
    const grossCost = ingredient.quantity * ingredient.unitPrice;
    return {
      ...ingredient,
      grossCost,
      returnedValue: grossCost * input.returnRate
    };
  });
  const grossTotal = ingredientLines.reduce((sum, line) => sum + line.grossCost, 0);
  const returnedTotal = ingredientLines.reduce((sum, line) => sum + line.returnedValue, 0);
  const materialGrossCost = grossTotal / input.craftAmount;
  const returnedMaterialValue = returnedTotal / input.craftAmount;
  const postReturnCost = materialGrossCost - returnedMaterialValue + input.craftingFeePerItem;
  const salesTaxRate = getSalesTaxRate(input.isPremium);
  const salesTax = input.outputSellPrice * salesTaxRate;
  const netRevenue = input.outputSellPrice - salesTax;
  const unitProfit = netRevenue - postReturnCost;

  return {
    ok: true,
    materialGrossCost,
    returnedMaterialValue,
    postReturnCost,
    salesTaxRate,
    salesTax,
    netRevenue,
    unitProfit,
    profitMargin: postReturnCost > 0 ? unitProfit / postReturnCost : null,
    breakEvenSellPrice: postReturnCost > 0 && salesTaxRate < 1 ? postReturnCost / (1 - salesTaxRate) : null,
    ingredientLines
  };
}

function validateCalculationInput(input: CalculationInput): string[] {
  const reasons: string[] = [];

  if (!Number.isFinite(input.outputSellPrice)) {
    reasons.push("成品售价不能为空");
  } else if (input.outputSellPrice < 0) {
    reasons.push("成品售价不能为负数");
  }

  if (!Number.isFinite(input.craftAmount) || input.craftAmount <= 0) {
    reasons.push("单次制造产出数量必须大于 0");
  }

  if (!Number.isFinite(input.returnRate) || input.returnRate < 0 || input.returnRate > 1) {
    reasons.push("返还率必须在 0 到 1 之间");
  }

  if (!Number.isFinite(input.craftingFeePerItem)) {
    reasons.push("制造手续费不能为空");
  } else if (input.craftingFeePerItem < 0) {
    reasons.push("制造手续费不能为负数");
  }

  if (input.ingredients.length === 0) {
    reasons.push("缺少配方，暂不可计算");
  }

  if (input.ingredients.some((ingredient) => !Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0)) {
    reasons.push("材料数量必须大于 0");
  }

  if (input.ingredients.some((ingredient) => !Number.isFinite(ingredient.unitPrice))) {
    reasons.push("材料价格不能为空");
  } else if (input.ingredients.some((ingredient) => ingredient.unitPrice < 0)) {
    reasons.push("材料价格不能为负数");
  }

  return reasons;
}

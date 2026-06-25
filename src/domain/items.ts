import type { CraftingItem, ItemFilters } from "./types";
import items from "../data/items.json";

export function getItems(): CraftingItem[] {
  return (items as CraftingItem[]).filter(isOfficialCraftingItem);
}

export function isOfficialCraftingItem(item: CraftingItem): boolean {
  const searchableText = [item.itemId, item.nameZh, item.nameEn].join(" ");
  if (item.itemId.startsWith("UNIQUE_")) return false;
  if (item.tier === 1 && item.category !== "食物") return false;
  if (searchableText.includes("PROTOTYPE")) return false;
  if (searchableText.includes("GAMEMASTER")) return false;
  if (item.nameZh.includes("游戏管理员")) return false;
  if (isRawItemCode(item.nameZh) || isRawItemCode(item.nameEn)) return false;
  return true;
}

export function validateItems(itemsToValidate: CraftingItem[]): string[] {
  const errors: string[] = [];

  itemsToValidate.forEach((item, index) => {
    const prefix = `第 ${index + 1} 条配方`;
    if (!item.itemId) errors.push(`${prefix} 缺少 itemId`);
    if (!item.nameZh) errors.push(`${prefix} 缺少中文名`);
    if (!item.nameEn) errors.push(`${prefix} 缺少英文名`);
    if (!item.category) errors.push(`${prefix} 缺少装备类型`);
    if (!Number.isInteger(item.tier) || item.tier < 1) errors.push(`${prefix} tier 无效`);
    if (!Number.isInteger(item.enchantment) || item.enchantment < 0) errors.push(`${prefix} 附魔等级无效`);
    if (!Number.isFinite(item.craftAmount) || item.craftAmount <= 0) {
      errors.push(`${prefix} 单次制造产出数量无效`);
    }
    if (!Array.isArray(item.ingredients) || item.ingredients.length === 0) {
      errors.push(`${prefix} 缺少配方材料`);
      return;
    }

    item.ingredients.forEach((ingredient, ingredientIndex) => {
      const ingredientPrefix = `${prefix} 的第 ${ingredientIndex + 1} 个材料`;
      if (!ingredient.itemId) errors.push(`${ingredientPrefix} 缺少 itemId`);
      if (!ingredient.nameZh) errors.push(`${ingredientPrefix} 缺少中文名`);
      if (!Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) {
        errors.push(`${ingredientPrefix} 数量无效`);
      }
    });
  });

  return errors;
}

export function searchItems(itemsToSearch: CraftingItem[], query: string): CraftingItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return itemsToSearch;
  }

  return itemsToSearch.filter((item) =>
    [item.itemId, item.nameZh, item.nameEn].some((value) =>
      value.toLocaleLowerCase().includes(normalizedQuery)
    )
  );
}

export function filterItems(itemsToFilter: CraftingItem[], filters: ItemFilters): CraftingItem[] {
  return itemsToFilter.filter((item) => {
    if (filters.category && item.category !== filters.category) return false;
    if (filters.subtype && getItemSubtype(item) !== filters.subtype) return false;
    if (filters.tier && item.tier !== filters.tier) return false;
    if (filters.enchantment !== undefined && item.enchantment !== filters.enchantment) return false;
    return true;
  });
}

export function getItemSubtypes(itemsToGroup: CraftingItem[], category?: string): string[] {
  const subtypes = new Set<string>();
  itemsToGroup.forEach((item) => {
    if (category && item.category !== category) return;
    subtypes.add(getItemSubtype(item));
  });
  return Array.from(subtypes);
}

export function getItemSubtype(item: CraftingItem): string {
  const name = stripTierPrefix(stripEnchantmentSuffix(item.nameZh));
  if (name && !isRawItemCode(name)) return name;

  const englishName = stripEnglishTierPrefix(stripEnchantmentSuffix(item.nameEn));
  return englishName || item.itemId;
}

function stripEnchantmentSuffix(value: string): string {
  return value.trim().replace(/\s*\.\d$/, "");
}

function stripTierPrefix(value: string): string {
  return value.replace(/^[^级]{1,8}级/, "");
}

function stripEnglishTierPrefix(value: string): string {
  return value.replace(/^[^']+'s\s+/, "");
}

function isRawItemCode(value: string): boolean {
  return /^[A-Z0-9_@]+(?:\s\.\d)?$/.test(value);
}

import { describe, expect, it } from "vitest";
import { filterItems, getItemSubtype, getItems, getItemSubtypes, searchItems, validateItems } from "./items";
import { getItemIconUrl } from "./icons";

describe("item data helpers", () => {
  it("loads valid local recipes with required fields", () => {
    const validation = validateItems(getItems());

    expect(validation).toEqual([]);
    expect(getItems().length).toBeGreaterThanOrEqual(1000);
    expect(getItems()[0]).toMatchObject({
      itemId: expect.any(String),
      nameZh: expect.any(String),
      nameEn: expect.any(String),
      category: expect.any(String),
      tier: expect.any(Number),
      enchantment: expect.any(Number),
      craftAmount: expect.any(Number)
    });
  });

  it("includes generated equipment and food recipes from Albion data", () => {
    const items = getItems();

    expect(items.map((item) => item.itemId)).toContain("T6_2H_DUALAXE_KEEPER@2");
    expect(items.map((item) => item.itemId)).toContain("T1_MEAL_SOUP");
    expect(items.find((item) => item.itemId === "T1_MEAL_SOUP")).toMatchObject({
      category: "食物",
      craftAmount: 10,
      ingredients: [{ itemId: "T1_CARROT", quantity: 16 }]
    });
  });

  it("removes unofficial, vanity, event, and game master recipes from selectable data", () => {
    const itemIds = getItems().map((item) => item.itemId);

    expect(itemIds).not.toContain("UNIQUE_WEAPONMASTER_ARMOR_PROTOTYPE");
    expect(itemIds).not.toContain("UNIQUE_INTERNAL_ARMOR_GAMEMASTER");
    expect(itemIds).not.toContain("UNIQUE_ARMOR_FOUNDER_LEGENDARY");
    expect(itemIds).not.toContain("UNIQUE_ARMOR_VANITY_SANTACLAUS");
    expect(itemIds).not.toContain("UNIQUE_BACKPACK_VANITY_SANTACLAUS");
    expect(itemIds.some((itemId) => itemId.startsWith("UNIQUE_"))).toBe(false);
    expect(itemIds).not.toContain("T8_ARMOR_CLOTH_PROTOTYPE");
    expect(searchItems(getItems(), "游戏管理员").length).toBe(0);
    expect(searchItems(getItems(), "圣诞外套").length).toBe(0);
    expect(searchItems(getItems(), "传奇探险者护甲").length).toBe(0);
    expect(searchItems(getItems(), "PROTOTYPE").length).toBe(0);
  });

  it("removes beginner tier-one equipment while keeping tier-one food", () => {
    const itemIds = getItems().map((item) => item.itemId);

    expect(itemIds).not.toContain("T1_ARMOR_LEATHER_SET1");
    expect(itemIds).not.toContain("T1_HEAD_LEATHER_SET1");
    expect(itemIds).not.toContain("T1_SHOES_LEATHER_SET1");
    expect(itemIds).not.toContain("T1_MAIN_SWORD");
    expect(itemIds).not.toContain("T1_OFF_SHIELD");
    expect(itemIds).not.toContain("T1_2H_TOOL_AXE");
    expect(itemIds).toContain("T1_MEAL_SOUP");
    expect(searchItems(getItems(), "初学者雇佣兵外套").length).toBe(0);
    expect(searchItems(getItems(), "胡萝卜汤").map((item) => item.itemId)).toContain("T1_MEAL_SOUP");
  });

  it("searches by Chinese name, English name, and item ID", () => {
    expect(searchItems(getItems(), "熊爪").map((item) => item.itemId)).toContain("T6_2H_DUALAXE_KEEPER@2");
    expect(searchItems(getItems(), "bow").length).toBeGreaterThan(0);
    expect(searchItems(getItems(), "胡萝卜汤").map((item) => item.itemId)).toContain("T1_MEAL_SOUP");
    expect(searchItems(getItems(), "T5_MAIN_FIRESTAFF").map((item) => item.itemId)).toContain("T5_MAIN_FIRESTAFF");
  });

  it("filters by category, tier, and enchantment", () => {
    const result = filterItems(getItems(), {
      category: "武器",
      tier: 6,
      enchantment: 2
    });

    expect(result.map((item) => item.itemId)).toContain("T6_2H_DUALAXE_KEEPER@2");
  });

  it("derives and filters second-level item subtypes", () => {
    const items = getItems();

    expect(getItemSubtypes(items, "背包")).toEqual(expect.arrayContaining(["背包", "洞察背包"]));
    expect(getItemSubtype(items.find((item) => item.itemId === "T4_BAG_INSIGHT@3")!)).toBe("洞察背包");
    expect(getItemSubtype(items.find((item) => item.itemId === "T5_MAIN_FIRESTAFF@1")!)).toBe("火焰法杖");
    expect(getItemSubtype(items.find((item) => item.itemId === "T1_MEAL_SOUP")!)).toBe("胡萝卜汤");

    const insightBags = filterItems(items, { category: "背包", subtype: "洞察背包" });
    expect(insightBags.map((item) => item.itemId)).toContain("T4_BAG_INSIGHT@4");
    expect(insightBags.map((item) => item.itemId)).not.toContain("T4_BAG");

    const fireStaffs = filterItems(items, { category: "武器", subtype: "火焰法杖", tier: 5 });
    expect(fireStaffs.map((item) => item.itemId)).toEqual(
      expect.arrayContaining(["T5_MAIN_FIRESTAFF", "T5_MAIN_FIRESTAFF@1", "T5_MAIN_FIRESTAFF@2", "T5_MAIN_FIRESTAFF@3", "T5_MAIN_FIRESTAFF@4"])
    );
  });

  it("generates official render URLs for icons", () => {
    expect(getItemIconUrl("T6_2H_DUALAXE_KEEPER@2", 2)).toBe(
      "https://render.albiononline.com/v1/item/T6_2H_DUALAXE_KEEPER%402.png?quality=2&size=217"
    );
  });
});

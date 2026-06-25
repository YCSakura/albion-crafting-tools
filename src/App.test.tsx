import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders the calculator directly without a marketing page", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "阿尔比恩制造利润计算器" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "装备选择" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "成本区" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "制造参数" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "利润结果" })).toBeInTheDocument();
  });

  it("searches equipment, renders cost rows, and updates profit from result controls", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("搜索装备"), "火焰");
    await user.click(screen.getByRole("button", { name: "专家级火焰法杖 T5_MAIN_FIRESTAFF" }));

    expect(screen.getByRole("heading", { name: "专家级火焰法杖" })).toBeInTheDocument();
    expect(screen.queryByText("T5_MAIN_FIRESTAFF")).not.toBeInTheDocument();
    expect(screen.getByAltText("杉木板条 图标")).toBeInTheDocument();
    expect(screen.getByText("数量 16")).toBeInTheDocument();
    expect(screen.getByText("数量 8")).toBeInTheDocument();

    const costSection = screen.getByRole("heading", { name: "成本区" }).closest("section");
    expect(costSection).not.toBeNull();
    const costs = within(costSection!);
    expect(costs.getByText("总成本")).toBeInTheDocument();
    expect(costs.getAllByText("成本待填").length).toBeGreaterThan(0);
    expect(costs.getByLabelText("价格地区")).toHaveDisplayValue("Thetford");
    expect(costs.getByRole("button", { name: "拉取 Thetford 市场价" })).toBeInTheDocument();

    const resultsSection = screen.getByRole("heading", { name: "利润结果" }).closest("section");
    expect(resultsSection).not.toBeNull();
    const results = within(resultsSection!);

    expect(results.getByLabelText("售价地区")).toHaveDisplayValue("Thetford");
    expect(results.getByRole("button", { name: "拉取 Thetford 成品售价" })).toBeInTheDocument();
    expect(results.getByLabelText("成品售价")).toBeInTheDocument();
    expect(results.getByLabelText("制造手续费")).toBeInTheDocument();
    expect(results.getByLabelText("会员")).toBeInTheDocument();

    await replaceNumber(user, results.getByLabelText("成品售价"), "1000");
    await replaceNumber(user, screen.getByLabelText("杉木板条 单价"), "20");
    await replaceNumber(user, screen.getByLabelText("钛钢条 单价"), "30");
    await replaceNumber(user, screen.getByLabelText("返还率"), "24.8");
    await replaceNumber(user, results.getByLabelText("制造手续费"), "25");

    expect(costs.getByText("560")).toBeInTheDocument();
    expect(screen.getAllByText("销售税率").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4%").length).toBeGreaterThan(0);
    expect(screen.getByText("514")).toBeInTheDocument();
    expect(screen.queryByText(/\d+\.00(?:%|\b)/)).not.toBeInTheDocument();

    await user.click(results.getByLabelText("会员"));

    expect(screen.getAllByText("8%").length).toBeGreaterThan(0);
    expect(screen.getByText("474")).toBeInTheDocument();
    expect(screen.queryByText(/\d+\.00(?:%|\b)/)).not.toBeInTheDocument();
  });

  it("uses city presets only to fill an editable return rate", async () => {
    const user = userEvent.setup();
    render(<App />);

    const parametersSection = screen.getByRole("heading", { name: "制造参数" }).closest("section");
    expect(parametersSection).not.toBeNull();
    const parameters = within(parametersSection!);

    const citySelect = parameters.getByLabelText("制作地区");
    const returnRateInput = parameters.getByLabelText("返还率");

    expect(citySelect).toHaveDisplayValue("自定义");
    expect(returnRateInput).toHaveValue(0);
    expect(parameters.queryByLabelText("制造站")).not.toBeInTheDocument();
    expect(parameters.queryByLabelText("使用专注")).not.toBeInTheDocument();

    await user.selectOptions(citySelect, "Bridgewatch");

    expect(returnRateInput).toHaveValue(24.8);

    await replaceNumber(user, returnRateInput, "18.5");

    expect(returnRateInput).toHaveValue(18.5);

    await user.selectOptions(citySelect, "Brecilien");

    expect(returnRateInput).toHaveValue(15.2);
  });

  it("adds a category-aware second-level item filter", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("装备类型"), "背包");

    const subtypeSelect = screen.getByLabelText("具体类型");
    expect(subtypeSelect).toHaveDisplayValue("全部");
    expect(within(subtypeSelect).getByRole("option", { name: "背包" })).toBeInTheDocument();
    expect(within(subtypeSelect).getByRole("option", { name: "洞察背包" })).toBeInTheDocument();

    await user.selectOptions(subtypeSelect, "洞察背包");

    expect(screen.getByText("老手级洞察背包")).toBeInTheDocument();
    expect(screen.getByText("老手级洞察背包 .4")).toBeInTheDocument();
    expect(screen.queryByText("老手级背包")).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("装备类型"), "食物");

    expect(screen.getByLabelText("具体类型")).toHaveDisplayValue("全部");
    expect(screen.getByRole("option", { name: "胡萝卜汤" })).toBeInTheDocument();
  });

  it("hides equipment English names and item IDs from visible cards", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.selectOptions(screen.getByLabelText("装备类型"), "背包");
    await user.selectOptions(screen.getByLabelText("具体类型"), "洞察背包");
    await user.click(screen.getByRole("button", { name: "老手级洞察背包 .2 T4_BAG_INSIGHT@2" }));

    const selectionSection = screen.getByRole("heading", { name: "装备选择" }).closest("section");
    const itemSection = screen.getByLabelText("已选装备");
    expect(selectionSection).not.toBeNull();

    expect(within(selectionSection!).queryByText("Adept's Satchel of Insight .3")).not.toBeInTheDocument();
    expect(within(itemSection).queryByText("Adept's Satchel of Insight .2")).not.toBeInTheDocument();
    expect(within(itemSection).queryByText("T4_BAG_INSIGHT@2")).not.toBeInTheDocument();
    expect(within(itemSection).getByRole("heading", { name: "老手级洞察背包 .2" })).toBeInTheDocument();
    expect(within(itemSection).getByText("Tier T4 · 附魔 .2 · 单次产出 1")).toBeInTheDocument();
  });

  it("hides raw material item IDs in cost rows", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("搜索装备"), "熊爪");
    await user.click(screen.getByRole("button", { name: "大师级熊爪神斧 .2 T6_2H_DUALAXE_KEEPER@2" }));

    const costSection = screen.getByRole("heading", { name: "成本区" }).closest("section");
    expect(costSection).not.toBeNull();
    const costs = within(costSection!);

    expect(costs.queryByText("T6_PLANKS_LEVEL2")).not.toBeInTheDocument();
    expect(costs.queryByText("T6_METALBAR_LEVEL2")).not.toBeInTheDocument();
    expect(costs.getByText("稀有血橡木板条")).toBeInTheDocument();
    expect(costs.getByText("稀有符钢条")).toBeInTheDocument();
    expect(costs.getByText("数量 20")).toBeInTheDocument();
  });

  it("uses larger material icons in the cost area", async () => {
    render(<App />);

    const costSection = screen.getByRole("heading", { name: "成本区" }).closest("section");
    expect(costSection).not.toBeNull();
    const costIcon = within(costSection!).getAllByRole("img")[0];

    expect(costIcon).toHaveClass("cost");
  });

  it("keeps material market controls in the cost area and product sale controls in results", () => {
    render(<App />);

    const costSection = screen.getByRole("heading", { name: "成本区" }).closest("section");
    expect(costSection).not.toBeNull();
    const costs = within(costSection!);
    expect(costs.getByLabelText("价格地区")).toBeInTheDocument();
    expect(costs.getByRole("button", { name: "拉取 Thetford 市场价" })).toBeInTheDocument();
    expect(costs.getByText("尚未拉取市场价")).toBeInTheDocument();

    const resultsSection = screen.getByRole("heading", { name: "利润结果" }).closest("section");
    expect(resultsSection).not.toBeNull();
    const resultFormControls = resultsSection!.querySelector(".result-form-controls");

    expect(resultFormControls).not.toBeNull();
    expect(within(resultsSection!).getByLabelText("售价地区")).toBeInTheDocument();
    expect(within(resultsSection!).getByRole("button", { name: "拉取 Thetford 成品售价" })).toBeInTheDocument();
    expect(within(resultFormControls as HTMLElement).getByLabelText("成品售价")).toBeInTheDocument();
    expect(within(resultFormControls as HTMLElement).getByLabelText("制造手续费")).toBeInTheDocument();
    expect(within(resultFormControls as HTMLElement).getByLabelText("会员")).toBeInTheDocument();
  });

  it("fetches Asia market prices and keeps manual overrides editable", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            item_id: "T5_MAIN_FIRESTAFF",
            city: "Martlock",
            sell_price_min: 1000,
            sell_price_min_date: "2026-06-25T10:00:00Z"
          },
          {
            item_id: "T5_PLANKS",
            city: "Martlock",
            sell_price_min: 20,
            sell_price_min_date: "2026-06-25T10:01:00Z"
          },
          {
            item_id: "T5_METALBAR",
            city: "Martlock",
            sell_price_min: 30,
            sell_price_min_date: "2026-06-25T10:02:00Z"
          }
        ]
      })
    );

    render(<App />);

    await user.type(screen.getByLabelText("搜索装备"), "火焰");
    await user.click(screen.getByRole("button", { name: "专家级火焰法杖 T5_MAIN_FIRESTAFF" }));
    const costSection = screen.getByRole("heading", { name: "成本区" }).closest("section");
    expect(costSection).not.toBeNull();
    const costs = within(costSection!);
    await user.selectOptions(costs.getByLabelText("价格地区"), "Martlock");

    const resultsSection = screen.getByRole("heading", { name: "利润结果" }).closest("section");
    expect(resultsSection).not.toBeNull();
    const results = within(resultsSection!);
    await user.click(costs.getByRole("button", { name: "拉取 Martlock 市场价" }));

    expect(fetch).toHaveBeenCalledWith(
      "https://east.albion-online-data.com/api/v2/stats/prices/T5_PLANKS,T5_METALBAR.json?locations=Martlock"
    );
    expect(await screen.findByDisplayValue("20")).toBeInTheDocument();
    expect(screen.getByDisplayValue("30")).toBeInTheDocument();
    expect(results.getByLabelText("成品售价")).toHaveDisplayValue("");
    expect(screen.getByText(/2026-06-25T10:01:00Z/)).toBeInTheDocument();

    await replaceNumber(user, screen.getByLabelText("杉木板条 单价"), "25");

    expect(screen.getByDisplayValue("25")).toBeInTheDocument();
  });

  it("fetches the product sell price from its own selected city", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            item_id: "T5_MAIN_FIRESTAFF",
            city: "Fort Sterling",
            sell_price_min: 20988,
            sell_price_min_date: "2026-06-25T04:40:00Z"
          }
        ]
      })
    );

    render(<App />);

    await user.type(screen.getByLabelText("搜索装备"), "火焰");
    await user.click(screen.getByRole("button", { name: "专家级火焰法杖 T5_MAIN_FIRESTAFF" }));

    const resultsSection = screen.getByRole("heading", { name: "利润结果" }).closest("section");
    expect(resultsSection).not.toBeNull();
    const results = within(resultsSection!);

    await user.selectOptions(results.getByLabelText("售价地区"), "Fort Sterling");
    await user.click(results.getByRole("button", { name: "拉取 Fort Sterling 成品售价" }));

    expect(fetch).toHaveBeenCalledWith(
      "https://east.albion-online-data.com/api/v2/stats/prices/T5_MAIN_FIRESTAFF.json?locations=Fort%20Sterling"
    );
    expect(await screen.findByDisplayValue("20988")).toBeInTheDocument();
    expect(results.getByText("成品售价已更新；已手动填写的价格会保留")).toBeInTheDocument();
  });

  it("does not claim market prices were updated when the API returns no usable prices", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            item_id: "T5_MAIN_FIRESTAFF",
            city: "Bridgewatch",
            sell_price_min: 0,
            sell_price_min_date: "0001-01-01T00:00:00"
          },
          {
            item_id: "T5_PLANKS",
            city: "Bridgewatch",
            sell_price_min: 0,
            sell_price_min_date: "0001-01-01T00:00:00"
          },
          {
            item_id: "T5_METALBAR",
            city: "Bridgewatch",
            sell_price_min: 0,
            sell_price_min_date: "0001-01-01T00:00:00"
          }
        ]
      })
    );

    render(<App />);

    await user.type(screen.getByLabelText("搜索装备"), "火焰");
    await user.click(screen.getByRole("button", { name: "专家级火焰法杖 T5_MAIN_FIRESTAFF" }));
    const costSection = screen.getByRole("heading", { name: "成本区" }).closest("section");
    expect(costSection).not.toBeNull();
    const costs = within(costSection!);

    const resultsSection = screen.getByRole("heading", { name: "利润结果" }).closest("section");
    expect(resultsSection).not.toBeNull();
    const results = within(resultsSection!);
    await user.click(costs.getByRole("button", { name: "拉取 Thetford 市场价" }));

    expect(await screen.findByText("本次没有拿到可用市场价；可以手动填写价格")).toBeInTheDocument();
    expect(screen.queryByText("市场价已更新；已手动填写的价格会保留")).not.toBeInTheDocument();
    expect(results.getByLabelText("成品售价")).toHaveValue(null);
    expect(screen.getByLabelText("杉木板条 单价")).toHaveValue(null);
    expect(screen.getByLabelText("钛钢条 单价")).toHaveValue(null);
  });
});

async function replaceNumber(user: ReturnType<typeof userEvent.setup>, input: HTMLElement, value: string) {
  await user.clear(input);
  await user.type(input, value);
}

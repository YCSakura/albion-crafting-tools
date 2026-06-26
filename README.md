# 阿尔比恩制造利润计算器

一个基于 React + Vite 的 Albion Online 制造利润计算工具，用来快速估算装备、食物等可制造物品在不同城市价格、材料返还率、制造手续费和销售税下的单件利润。

## 功能

- 按装备类型、子类型、Tier、附魔等级筛选制造物品
- 支持按中文名、英文名或物品 ID 搜索
- 自动计算材料毛成本、返还材料价值、返还后成本、销售税、净收入、单件利润、利润率和保本售价
- 支持会员与非会员销售税
- 支持常见城市制造返还率预设，也可以手动输入返还率
- 可从 Albion Online Data Asia 接口拉取材料与成品最低卖价
- 手动填写的价格会保留在浏览器本地存储中

## 技术栈

- React
- TypeScript
- Vite
- Vitest
- lucide-react

## 本地运行

```bash
npm install
npm run dev
```

默认开发服务器会监听 `127.0.0.1`。终端会显示实际访问地址。

## 常用命令

```bash
npm run dev
npm run build
npm test
npm run preview
npm run generate:data
```

命令说明：

- `npm run dev`：启动本地开发服务器
- `npm run build`：执行 TypeScript 检查并构建生产版本
- `npm test`：运行单元测试
- `npm run preview`：预览构建后的产物
- `npm run generate:data`：从 `ao-data/ao-bin-dumps` 重新生成 `src/data/items.json`

## 数据来源

制造配方数据来自 `ao-data/ao-bin-dumps` 的公开数据快照。市场价格通过 Albion Online Data 的 Asia API 获取：

```text
https://east.albion-online-data.com/api/v2/stats/prices/
```

市场接口返回的数据依赖玩家客户端上传，可能存在延迟或缺失。没有拉取到价格时，可以手动填写材料或成品价格。

## 项目结构

```text
src/
  data/         生成后的物品与配方数据
  domain/       利润计算、物品筛选、市场价格适配等核心逻辑
  storage/      浏览器本地偏好存储
  App.tsx       主界面
scripts/
  generate-crafting-data.mjs
```

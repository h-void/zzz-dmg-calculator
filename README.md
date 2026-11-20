# 绝区零 v3.3 战术配队与合轴精算台 (`zzz-dmg-calculator`)

**简体中文** · [English](./README.en.md) · [日本語](./README.ja.md)

基于 **TypeScript + Vite + Web Worker** 构建的纯前端绝区零配队、排轴与驱动盘寻优工作台，支持 **简体中文 / English / 日本語** 实时切换与明暗双主题（纯本地运行，零服务端上传）。

- 🌐 **在线工作台**：<https://h-void.github.io/zzz-dmg-calculator/>

---

## 核心功能

- **全量数据与多乘区精算** — 内置 62 名代理人、103 把音擎、31 套驱动盘、20 只邦布与 24 套公式配队，完整覆盖直伤、异常紊乱、命破贯穿、锋御撕裂及专武 / 影画 / 下一金 ROI 评测。
- **实时乘区稀释与跨环境/首领体检** — 在「03 伤害分析」中实时求导当前阵容的标准外拐边际收益、5 号盘（属伤 / 穿透 / 攻·生·防）三强裁定与减防×穿透临界点，并一键对比 6 大深渊天气与 8 类首领 Boss（重甲 / 逆抗 / 疯狗短失衡 / 秽盾 / 防异常）下的伤害保持率与 5 号盘变阵。
- **八维合轴与交互式排轴器** — 实时模拟脱手帧并行压缩、无敌帧安全合轴、手动双连携与短轴拐覆盖率，支持多轨甘特图逐块微调。
- **UID 展柜同步与后台寻优** — 支持通过 Enka.Network UID 拉取名片展柜角色与 1–6 号驱动盘（增量合并缓存 + `ACE`–`B` 词条评级），并支持导入 `GOOD` / `ZOD` / `AdeptiScanner-ZZZ` 扫描器 JSON 在 Web Worker 后台线程进行实盘配装寻优与 Box 智能搜队。
- **自定义数据工坊** — 所有角色、音擎、套装、邦布与深渊环境词条均可在浏览器本地自由编辑、导入与导出。

## 精算报告与离线表格

- 📊 **全 62 角色 · 6 大天气 · 8 类首领 Boss 稀释精算报告**：[`docs/dilution-analysis-v3.3.md`](./docs/dilution-analysis-v3.3.md)
- 📑 **离线 6 分页 Excel 表格（含热力色阶与可视化柱状图）**：[`docs/reports/zzz-v3.3-dilution-analysis.xlsx`](./docs/reports/zzz-v3.3-dilution-analysis.xlsx)

## 本地开发与构建

```bash
npm install
npm run dev           # 启动本地开发服务器
npm run typecheck     # 运行 TypeScript 类型检查
npm run build         # 构建静态产物至 dist/
npm run calc:dilution # 重新跑全环境 / 首领 Boss / 全 62 角色稀释精算报告
```

## 开源协议

本项目基于 **[GPL-3.0-only](./LICENSE)**（GNU General Public License v3.0 only）开源发布。


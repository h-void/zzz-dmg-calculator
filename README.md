# 绝区零 v3.3 战术配队与合轴精算台 (ZZZ DMG Studio)

**在线体验：** [https://h-void.github.io/zzz-dmg-calculator/](https://h-void.github.io/zzz-dmg-calculator/)

基于 **TypeScript + Vite + Web Worker** 构建的纯前端绝区零配队、排轴与驱动盘寻优工作台，支持 **简体中文 / English / 日本語** 实时切换与明暗双主题。

## 核心功能

- **全量数据与多乘区精算**：内置 62 名代理人、103 把音擎、31 套驱动盘、20 只邦布与 24 套公式配队，完整覆盖直伤、异常紊乱、命破贯穿、锋御撕裂及专武 / 影画 / 下一金 ROI 评测。
- **八维合轴与交互式排轴器**：实时模拟脱手帧并行压缩、无敌帧安全合轴、手动双连携与短轴拐覆盖率，支持多轨甘特图逐块微调。
- **UID 展柜同步与后台寻优**：支持通过 Enka.Network UID 拉取名片展柜角色与 1–6 号驱动盘（增量合并缓存 + `ACE`–`B` 词条评级），并支持导入 `GOOD` / `ZOD` 扫描器 JSON 在 Web Worker 后台线程进行实盘配装寻优与 Box 智能搜队。
- **自定义数据工坊**：所有角色、音擎、套装、邦布与深渊环境词条均可在浏览器本地自由编辑、导入与导出。

## 本地运行

```bash
npm install
npm run dev     # 本地开发预览
npm run build   # 类型检查并构建静态产物至 dist/
```

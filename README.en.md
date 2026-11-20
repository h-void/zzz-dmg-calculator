# ZZZ v3.3 Tactical Team & Swap Timeline Studio (`zzz-dmg-calculator`)

[简体中文](./README.md) · **English** · [日本語](./README.ja.md)

A 100% client-side **Zenless Zone Zero** squad builder, swap-cancel timeline sequencer, and Drive Disc optimizer built with **TypeScript + Vite + Web Worker**, featuring instant **简体中文 / English / 日本語** switching and light/dark themes.

- 🌐 **Live Studio**: <https://h-void.github.io/zzz-dmg-calculator/>

---

## Features

- **Full Roster & 6-Zone Multiplier Engine** — Covers 62 Agents, 103 W-Engines, 31 Drive Disc sets, 20 Bangboos, and 24 meta team presets across Direct CRIT, Anomaly/Disorder, Rupture Sheer, and Armorer archetypes, with live W-Engine, Mindscape, and Next-Gold pull ROI rankings.
- **Live Dilution Audit & Cross-Stage / Boss Stress Matrix** — Computes real-time marginal returns for standard external buffs, Disc `[5]` main-stat showdowns (`ELEM` vs `PEN` vs `ATK%/HP%/DEF%`), exact `DEF Shred × PEN` break-even thresholds, and one-click simulation across 6 Stage Weathers and 8 Boss Archetypes (Heavy Armor, Resistant, High-Aggro Short Stun, Miasma Shield, Anomaly-Resistant).
- **8D Swap-Cancel Physics & Interactive Gantt Sequencer** — Simulates off-field frame overlap, i-frame safe swaps, manual double Chain Attacks, Assist Point economy, and short-buff uptime on an editable multi-track timeline.
- **Enka.Network UID Sync & Web Worker Optimizer** — Syncs all 6 public showcase Agents and Slot 1–6 Drive Discs by UID (incremental local vault merge + `ACE`–`B` roll grading), or imports `GOOD` / `ZOD` / `AdeptiScanner-ZZZ` JSONs for off-thread 6-disc optimization and Box team search.
- **Custom Data Workshop** — Freely inspect, edit, export, and import Agents, W-Engines, Drive Sets, Bangboos, and boss stage presets locally in your browser.

## Dilution Reports & Spreadsheets

- 📊 **Full 62-Agent · 6-Stage · 8-Boss Dilution Report (ZH)**: [`docs/dilution-analysis-v3.3.md`](./docs/dilution-analysis-v3.3.md)
- 📑 **Offline 6-Tab Excel Workbook (with heatmaps & charts)**: [`docs/reports/zzz-v3.3-dilution-analysis.xlsx`](./docs/reports/zzz-v3.3-dilution-analysis.xlsx)

## Local Development

```bash
npm install
npm run dev           # Start local dev server
npm run typecheck     # Run TypeScript type checking
npm run build         # Bundle static site into dist/
npm run calc:dilution # Regenerate full dilution reports & JSON dataset
```

## License

Licensed under **[GPL-3.0-only](./LICENSE)** (GNU General Public License v3.0 only).

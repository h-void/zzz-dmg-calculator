# ZZZ v3.3 Tactical Team & Swap Timeline Studio (`zzz-dmg-calculator`)

[简体中文](./README.md) · **English** · [日本語](./README.ja.md)

A 100% client-side **Zenless Zone Zero** squad builder, swap-cancel timeline sequencer, and Drive Disc optimizer built with **TypeScript + Vite + Web Worker**, featuring instant **简体中文 / English / 日本語** switching and light/dark themes.

- 🌐 **Live Studio**: <https://h-void.github.io/zzz-dmg-calculator/>

---

## Features

- **Full Roster & 6-Zone Multiplier Engine** — Covers 62 Agents, 103 W-Engines, 31 Drive Disc sets, 20 Bangboos, and 24 meta team presets across Direct CRIT, Anomaly/Disorder, Rupture Sheer, and Armorer archetypes, with live W-Engine, Mindscape, and Next-Gold pull ROI rankings.
- **8D Swap-Cancel Physics & Interactive Gantt Sequencer** — Simulates off-field frame overlap, i-frame safe swaps, manual double Chain Attacks, Assist Point economy, and short-buff uptime on an editable multi-track timeline.
- **Enka.Network UID Sync & Web Worker Optimizer** — Syncs all 6 public showcase Agents and Slot 1–6 Drive Discs by UID (incremental local vault merge + `ACE`–`B` roll grading), or imports `GOOD` / `ZOD` / `AdeptiScanner-ZZZ` JSONs for off-thread 6-disc optimization and Box team search.
- **Custom Data Workshop** — Freely inspect, edit, export, and import Agents, W-Engines, Drive Sets, Bangboos, and boss stage presets locally in your browser.

## Local Development

```bash
npm install
npm run dev         # Start local dev server
npm run typecheck   # Run TypeScript type checking
npm run build       # Bundle static site into dist/
```

## License

Licensed under **[GPL-3.0-only](./LICENSE)** (GNU General Public License v3.0 only).

// ============================================================================
// ZZZ v3.3 Gold-Cost Investment Matrix & Pareto Frontier Engine
// ============================================================================
// Evaluates Carry (Slot 0) x Teammates (Slots 1 & 2) limited-gold combinations
// to produce an interactive 2D DPS heatmap matrix and optimal 1->N gold path.
// ============================================================================

import { CHAR_MAP, NON_LIM_S_CHARS, NON_LIM_S_WEPS, SC_WEPS, WEP_LIST, deepClone } from "../data/store";
import { calcLimitedGold, simulateTeamV2 } from "./simulator";
import type { AgentDef, EnvConfig, SlotConfig, WEngineDef } from "../types";

export interface SlotInvestmentPatch {
  idx: number;
  m: number;
  wid: string;
  ref: number;
}

export interface MatrixAxisPreset {
  id: string;
  label: string;
  shortLabel: string;
  subLabel: string;
  patches: SlotInvestmentPatch[];
}

export interface GoldMatrixCell {
  rowIdx: number;
  colIdx: number;
  totalGold: number;
  teamDps: number;
  teamActualDps: number;
  teamDpr: number;
  gainVsBase: number;
  heatRatio: number; // 0..1 normalized across matrix
  isCurrent: boolean;
  isPareto: boolean;
  patches: SlotInvestmentPatch[];
  summaryText: string;
}

export interface GoldPathNode {
  totalGold: number;
  rowLabel: string;
  colLabel: string;
  teamDps: number;
  gainVsBase: number;
  gainVsPrev: number;
  marginalPerGold: number;
  isCurrent: boolean;
  patches: SlotInvestmentPatch[];
}

export interface GoldMatrixResult {
  carryName: string;
  mateNames: string[];
  metricMode: "dps" | "dpr";
  rows: MatrixAxisPreset[];
  cols: MatrixAxisPreset[];
  grid: GoldMatrixCell[][];
  baseDps: number;
  minDps: number;
  maxDps: number;
  currentGold: number;
  currentDps: number;
  goldPath: GoldPathNode[];
  elapsedMs: number;
}

function isLimitedSChar(ch: AgentDef | undefined): boolean {
  return Boolean(ch && ch.r === "S" && !NON_LIM_S_CHARS.has(ch.id));
}

function pickBestF2PWeapon(ch: AgentDef, wepMap: Record<string, WEngineDef>): { wid: string; ref: number } {
  // Prefer character's own A-rank sig if A-rank, else best same-specialty A-rank (or standard S if no A exists)
  if (ch.r === "A" && wepMap[ch.sig] && wepMap[ch.sig].r === "A") {
    return { wid: ch.sig, ref: 5 };
  }
  const sameA = WEP_LIST.filter((w) => w.wt === ch.wt && w.r === "A");
  if (sameA.length > 0) {
    // Prefer common high-value F2P A-rank picks by specialty
    const preferredByWt: Record<string, string[]> = {
      Attack: ["13004", "13015", "13013", "13001"],
      Anomaly: ["13008", "13009", "13128", "13003"],
      Rupture: ["13144", "13019", "13014", "13012"],
      Armorer: ["13022", "13021", "13017"],
      Stun: ["13005", "13006", "13101", "13020"],
      Support: ["13103", "13115", "13113", "13002"],
      Defense: ["13112", "13127", "13010", "13007"]
    };
    const prefs = preferredByWt[ch.wt] || [];
    for (const pid of prefs) {
      if (sameA.some((w) => w.id === pid)) return { wid: pid, ref: 5 };
    }
    return { wid: sameA[0].id, ref: 5 };
  }
  const stdS = WEP_LIST.find((w) => w.wt === ch.wt && NON_LIM_S_WEPS.has(w.id));
  if (stdS) return { wid: stdS.id, ref: 1 };
  const sigW = wepMap[ch.sig];
  return { wid: sigW ? sigW.id : WEP_LIST[0].id, ref: 1 };
}

function pickBestSigWeapon(ch: AgentDef, wepMap: Record<string, WEngineDef>, ref = 1): { wid: string; ref: number } {
  if (wepMap[ch.sig]) {
    const w = wepMap[ch.sig];
    return { wid: w.id, ref: w.r === "S" ? ref : 5 };
  }
  const sameS = WEP_LIST.find((w) => w.wt === ch.wt && w.r === "S");
  if (sameS) return { wid: sameS.id, ref };
  return pickBestF2PWeapon(ch, wepMap);
}

function buildCarryRows(
  slotIdx: number,
  ch: AgentDef,
  wepMap: Record<string, WEngineDef>
): MatrixAxisPreset[] {
  const f2p = pickBestF2PWeapon(ch, wepMap);
  const sig1 = pickBestSigWeapon(ch, wepMap, 1);
  const sig5 = pickBestSigWeapon(ch, wepMap, 5);
  const sigWep = wepMap[sig1.wid];
  const f2pWep = wepMap[f2p.wid];

  if (ch.r === "S") {
    const tiers: Array<{ id: string; m: number; w: { wid: string; ref: number }; label: string; shortLabel: string; sub: string }> = [
      { id: "c_00", m: 0, w: f2p, label: "0+0 替武", shortLabel: "0+0", sub: `M0 · ${f2pWep?.n || "A满精"}` },
      { id: "c_01", m: 0, w: sig1, label: "0+1 专武", shortLabel: "0+1", sub: `M0 · ${sigWep?.n || "专武"} R1` },
      { id: "c_11", m: 1, w: sig1, label: "1+1 专武", shortLabel: "1+1", sub: `M1 · ${sigWep?.n || "专武"} R1` },
      { id: "c_21", m: 2, w: sig1, label: "2+1 核心", shortLabel: "2+1", sub: `M2 · ${sigWep?.n || "专武"} R1` },
      { id: "c_31", m: 3, w: sig1, label: "3+1 进阶", shortLabel: "3+1", sub: `M3 · ${sigWep?.n || "专武"} R1` },
      { id: "c_61", m: 6, w: sig1, label: "6+1 满影", shortLabel: "6+1", sub: `M6 · ${sigWep?.n || "专武"} R1` },
      { id: "c_65", m: 6, w: sig5, label: "6+5 顶配", shortLabel: "6+5", sub: `M6 · ${sigWep?.n || "专武"} R5` }
    ];
    return tiers.map((t) => ({
      id: t.id,
      label: `${ch.n} ${t.label}`,
      shortLabel: t.shortLabel,
      subLabel: t.sub,
      patches: [{ idx: slotIdx, m: t.m, wid: t.w.wid, ref: t.w.ref }]
    }));
  }

  // A-rank Carry
  const sameS = WEP_LIST.find((w) => w.wt === ch.wt && w.r === "S" && !NON_LIM_S_WEPS.has(w.id));
  const out: MatrixAxisPreset[] = [
    {
      id: "ca_60",
      label: `${ch.n} M6+A满精`,
      shortLabel: "M6·A5",
      subLabel: `M6 · ${f2pWep?.n || "A满精"}`,
      patches: [{ idx: slotIdx, m: 6, wid: f2p.wid, ref: f2p.ref }]
    }
  ];
  if (sameS) {
    out.push(
      {
        id: "ca_61",
        label: `${ch.n} M6+S专R1`,
        shortLabel: "M6·S1",
        subLabel: `M6 · ${sameS.n} R1`,
        patches: [{ idx: slotIdx, m: 6, wid: sameS.id, ref: 1 }]
      },
      {
        id: "ca_65",
        label: `${ch.n} M6+S专R5`,
        shortLabel: "M6·S5",
        subLabel: `M6 · ${sameS.n} R5`,
        patches: [{ idx: slotIdx, m: 6, wid: sameS.id, ref: 5 }]
      }
    );
  }
  return out;
}

function buildTeammateCols(
  slots: Array<SlotConfig | null>,
  carrySlotIdx: number,
  charMap: Record<string, AgentDef>,
  wepMap: Record<string, WEngineDef>
): MatrixAxisPreset[] {
  const mates: Array<{ idx: number; ch: AgentDef; isLimS: boolean; isS: boolean }> = [];
  slots.forEach((s, idx) => {
    if (idx === carrySlotIdx || !s?.cid || !charMap[s.cid]) return;
    const ch = charMap[s.cid];
    mates.push({ idx, ch, isLimS: isLimitedSChar(ch), isS: ch.r === "S" });
  });

  if (mates.length === 0) {
    return [
      {
        id: "m_solo",
        label: "单人裸测",
        shortLabel: "单人",
        subLabel: "无队友",
        patches: []
      }
    ];
  }

  const sMates = mates.filter((m) => m.isS);
  const makePatch = (m: { idx: number; ch: AgentDef }, mode: "f2p" | "01" | "11" | "21" | "61" | "65"): SlotInvestmentPatch => {
    if (m.ch.r === "A") {
      const w = pickBestF2PWeapon(m.ch, wepMap);
      return { idx: m.idx, m: 6, wid: w.wid, ref: w.ref };
    }
    if (mode === "f2p") {
      const w = pickBestF2PWeapon(m.ch, wepMap);
      return { idx: m.idx, m: 0, wid: w.wid, ref: w.ref };
    }
    const sigR = mode === "65" ? 5 : 1;
    const w = pickBestSigWeapon(m.ch, wepMap, sigR);
    const mLv = mode === "01" ? 0 : mode === "11" ? 1 : mode === "21" ? 2 : 6;
    return { idx: m.idx, m: mLv, wid: w.wid, ref: w.ref };
  };

  const rawCols: MatrixAxisPreset[] = [];
  if (sMates.length === 0) {
    rawCols.push({
      id: "m_a_all",
      label: "A级队友满影满精",
      shortLabel: "A级满配",
      subLabel: mates.map((x) => `${x.ch.n}M6`).join(" + "),
      patches: mates.map((m) => makePatch(m, "f2p"))
    });
  } else if (sMates.length === 1) {
    const sm = sMates[0];
    const specs: Array<{ id: string; mode: "f2p" | "01" | "11" | "21" | "61" | "65"; short: string; label: string }> = [
      { id: "m1_00", mode: "f2p", short: `${sm.ch.n}0+0`, label: `队友全0+0` },
      { id: "m1_01", mode: "01", short: `${sm.ch.n}0+1`, label: `${sm.ch.n} 0+1` },
      { id: "m1_11", mode: "11", short: `${sm.ch.n}1+1`, label: `${sm.ch.n} 1+1` },
      { id: "m1_21", mode: "21", short: `${sm.ch.n}2+1`, label: `${sm.ch.n} 2+1` },
      { id: "m1_61", mode: "61", short: `${sm.ch.n}6+1`, label: `${sm.ch.n} 6+1` },
      { id: "m1_65", mode: "65", short: `${sm.ch.n}6+5`, label: `${sm.ch.n} 6+5` }
    ];
    for (const sp of specs) {
      rawCols.push({
        id: sp.id,
        label: sp.label,
        shortLabel: sp.short,
        subLabel: mates.map((x) => (x.idx === sm.idx ? sp.short : `${x.ch.n}当前`)).join(" · "),
        patches: [makePatch(sm, sp.mode)]
      });
    }
  } else {
    // 2 S-rank teammates
    const [m1, m2] = sMates;
    const combos: Array<{
      id: string;
      short: string;
      label: string;
      p1: "f2p" | "01" | "11" | "21" | "61" | "65";
      p2: "f2p" | "01" | "11" | "21" | "61" | "65";
    }> = [
      { id: "m2_00_00", short: "双0+0", label: "队友全0+0", p1: "f2p", p2: "f2p" },
      { id: "m2_01_00", short: `${m1.ch.n}0+1`, label: `${m1.ch.n}0+1 / ${m2.ch.n}0+0`, p1: "01", p2: "f2p" },
      { id: "m2_01_01", short: "双0+1", label: "队友双0+1", p1: "01", p2: "01" },
      { id: "m2_11_01", short: "1+1/0+1", label: `${m1.ch.n}1+1 / ${m2.ch.n}0+1`, p1: "11", p2: "01" },
      { id: "m2_11_11", short: "双1+1", label: "队友双1+1", p1: "11", p2: "11" },
      { id: "m2_21_11", short: "2+1/1+1", label: `${m1.ch.n}2+1 / ${m2.ch.n}1+1`, p1: "21", p2: "11" },
      { id: "m2_21_21", short: "双2+1", label: "队友双2+1", p1: "21", p2: "21" },
      { id: "m2_65_65", short: "双6+5", label: "队友顶配6+5", p1: "65", p2: "65" }
    ];
    for (const c of combos) {
      rawCols.push({
        id: c.id,
        label: c.label,
        shortLabel: c.short,
        subLabel: `${m1.ch.n}${c.p1 === "f2p" ? "0+0" : c.p1[0] + "+" + c.p1[1]} · ${m2.ch.n}${c.p2 === "f2p" ? "0+0" : c.p2[0] + "+" + c.p2[1]}`,
        patches: [makePatch(m1, c.p1), makePatch(m2, c.p2)]
      });
    }
  }

  // Deduplicate by exact patch signature
  const seen = new Set<string>();
  return rawCols.filter((c) => {
    const key = c.patches.map((p) => `${p.idx}:${p.m}:${p.wid}:${p.ref}`).join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function patchesMatchSlots(
  patches: SlotInvestmentPatch[],
  slots: Array<SlotConfig | null>,
  wepMap: Record<string, WEngineDef> = SC_WEPS
): boolean {
  for (const p of patches) {
    const s = slots[p.idx];
    if (!s) return false;
    if ((s.m ?? 0) !== p.m) return false;
    const isTargetS = wepMap[p.wid]?.r === "S";
    const isCurS = wepMap[s.wid]?.r === "S";
    if (isTargetS) {
      if (s.wid !== p.wid || (s.ref ?? 1) !== p.ref) return false;
    } else if (isCurS) {
      return false;
    }
  }
  return true;
}

export function computeGoldMatrix(
  slots: Array<SlotConfig | null>,
  env: EnvConfig,
  charMap: Record<string, AgentDef> = CHAR_MAP,
  wepMap: Record<string, WEngineDef> = SC_WEPS
): GoldMatrixResult | null {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const carryIdx = slots.findIndex((s) => s?.cid && charMap[s.cid]);
  if (carryIdx < 0) return null;

  const carrySlot = slots[carryIdx]!;
  const carryCh = charMap[carrySlot.cid];
  const rows = buildCarryRows(carryIdx, carryCh, wepMap);
  const cols = buildTeammateCols(slots, carryIdx, charMap, wepMap);

  const curSim = simulateTeamV2(slots, env, charMap, wepMap, { fastMode: true, skipSoloBaseline: true });
  const currentGold = calcLimitedGold(slots, charMap, wepMap);
  const currentDps = curSim.teamDps || 1;

  const grid: GoldMatrixCell[][] = [];
  let minDps = Infinity;
  let maxDps = 0;

  for (let r = 0; r < rows.length; r++) {
    const rowCells: GoldMatrixCell[] = [];
    for (let c = 0; c < cols.length; c++) {
      const combinedPatches = [...rows[r].patches, ...cols[c].patches];
      const testSlots = slots.map((s) => (s ? deepClone(s) : null));
      for (const p of combinedPatches) {
        if (testSlots[p.idx]) {
          testSlots[p.idx]!.m = p.m;
          testSlots[p.idx]!.wid = p.wid;
          testSlots[p.idx]!.ref = p.ref;
        }
      }
      const res = simulateTeamV2(testSlots, env, charMap, wepMap, { fastMode: true, skipSoloBaseline: true });
      const totalGold = calcLimitedGold(testSlots, charMap, wepMap);
      const dps = res.teamDps || 0;
      if (dps < minDps) minDps = dps;
      if (dps > maxDps) maxDps = dps;

      const summaryParts = combinedPatches
        .sort((a, b) => a.idx - b.idx)
        .map((p) => {
          const ch = charMap[testSlots[p.idx]!.cid];
          const w = wepMap[p.wid];
          const wShort = w?.id === ch.sig && w.r === "S" ? `+${p.ref}` : w?.r === "S" ? `+S${p.ref}` : "+0";
          return `${ch.n} ${p.m}${wShort}`;
        });

      rowCells.push({
        rowIdx: r,
        colIdx: c,
        totalGold,
        teamDps: dps,
        teamActualDps: res.teamActualDps || 0,
        teamDpr: res.teamDpr || 0,
        gainVsBase: 0,
        heatRatio: 0,
        isCurrent: patchesMatchSlots(combinedPatches, slots, wepMap),
        isPareto: false,
        patches: combinedPatches,
        summaryText: summaryParts.join(" · ")
      });
    }
    grid.push(rowCells);
  }

  const baseDps = Math.max(1, grid[0]?.[0]?.teamDps || minDps || 1);
  const span = Math.max(1, maxDps - minDps);
  const allCells: GoldMatrixCell[] = [];

  for (const row of grid) {
    for (const cell of row) {
      cell.gainVsBase = cell.teamDps / baseDps - 1;
      cell.heatRatio = Math.max(0, Math.min(1, (cell.teamDps - minDps) / span));
      allCells.push(cell);
    }
  }

  // Mark Pareto-optimal gold frontier (strictly highest DPS for each strictly increasing gold tier)
  const bestByGold = new Map<number, GoldMatrixCell>();
  for (const cell of allCells) {
    const prev = bestByGold.get(cell.totalGold);
    if (!prev || cell.teamDps > prev.teamDps) {
      bestByGold.set(cell.totalGold, cell);
    }
  }
  const sortedGoldKeys = [...bestByGold.keys()].sort((a, b) => a - b);
  const goldPath: GoldPathNode[] = [];
  let runningBestDps = 0;
  let prevNode: GoldPathNode | null = null;

  for (const g of sortedGoldKeys) {
    const cell = bestByGold.get(g)!;
    if (cell.teamDps <= runningBestDps * 1.001) continue; // Dominated by cheaper config
    runningBestDps = cell.teamDps;
    cell.isPareto = true;

    const gainVsPrev = prevNode ? cell.teamDps / Math.max(1, prevNode.teamDps) - 1 : 0;
    const goldDiff = prevNode ? Math.max(1, cell.totalGold - prevNode.totalGold) : 1;
    const node: GoldPathNode = {
      totalGold: cell.totalGold,
      rowLabel: rows[cell.rowIdx].shortLabel,
      colLabel: cols[cell.colIdx].shortLabel,
      teamDps: cell.teamDps,
      gainVsBase: cell.gainVsBase,
      gainVsPrev,
      marginalPerGold: prevNode ? gainVsPrev / goldDiff : 0,
      isCurrent: cell.isCurrent,
      patches: cell.patches
    };
    goldPath.push(node);
    prevNode = node;
  }

  const mateNames = slots
    .map((s, idx) => (idx !== carryIdx && s?.cid && charMap[s.cid] ? charMap[s.cid].n : null))
    .filter((x): x is string => Boolean(x));

  const elapsedMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;

  return {
    carryName: carryCh.n,
    mateNames,
    metricMode: env.metricMode || "dps",
    rows,
    cols,
    grid,
    baseDps,
    minDps,
    maxDps,
    currentGold,
    currentDps,
    goldPath,
    elapsedMs
  };
}

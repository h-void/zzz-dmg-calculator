import {
  BANGBOO_MAP,
  CHAR_MAP,
  PRESET_TEAMS,
  SC_CHARS,
  SC_WEPS,
  STAGE_BUFFS,
  STORAGE_WORKSPACE_KEY,
  WEP_LIST,
  deepClone
} from "../data/store";
import { analyzeTimeline, generateSmartTimeline, makeDefaultSwapConfig } from "../engine/swapTimeline";
import type { AgentDef, PresetTeamDef, SlotConfig } from "../types";

export function makeDefaultSlot(
  cid: string,
  mOverride: number | null = null,
  widOverride: string | null = null,
  refOverride: number | null = null,
  fourPcOverride: string | null = null
): SlotConfig | null {
  const ch = CHAR_MAP[cid];
  if (!ch) return null;
  const wid = widOverride && SC_WEPS[widOverride] ? widOverride : SC_WEPS[ch.sig] ? ch.sig : WEP_LIST[0].id;
  const w = SC_WEPS[wid] || WEP_LIST[0];
  const m = mOverride !== null && mOverride !== undefined ? mOverride : ch.r === "A" ? 6 : 0;
  const ref = refOverride !== null && refOverride !== undefined ? refOverride : w.r === "S" ? 1 : 5;
  return {
    cid,
    m,
    wid,
    ref,
    fourPc: fourPcOverride || ch.def4pc || "啄木",
    twoPc: ch.def2pc || "折枝",
    buildMode: "auto",
    discAuto: true,
    d4: "CR",
    d5: "ELEM",
    d6: "ATK%",
    subAuto: true,
    rolls: 28,
    subRollCap: 18,
    sub: { CR: 10, CD: 10, "ATK%": 8 },
    activePieceIdx: 0,
    pieces: null,
    panel: null,
    uptime: 1.0,
    fourPcUptime: 1.0,
    wepUptime: 1.0,
    allowCrossWep: false,
    agentLv: 60,
    wepLv: 60,
    skillLv: 12,
    coreLv: 6,
    aaMode: "auto",
    potOverride: "auto",
    weightMode: "auto",
    weight: 1.0,
    mvMult: 1.0,
    stunShareOverride: null,
    customSharesEnabled: false,
    customShares: null,
    customAnomSplitEnabled: false,
    customAnomSplit: null,
    slotExtra: {
      atk_pct: 0,
      atk_flat: 0,
      hp_pct: 0,
      def_pct: 0,
      sheer: 0,
      cr: 0,
      cd: 0,
      dmg: 0,
      def_shred: 0,
      pen: 0,
      res_shred: 0,
      ap: 0,
      anom_dmg: 0,
      lac_dmg: 0,
      final_mult: 0
    }
  };
}

export function makeDefaultElemResMap(): Record<string, number> {
  return {
    Physical: 0,
    Fire: 0,
    Ice: 0,
    Electric: 0,
    Ether: 0,
    Wind: 0,
    Lumiflux: 0
  };
}

export type StudioViewTab = "build" | "enka" | "timeline" | "diag" | "eval" | "env" | "all";

export interface WorkbenchAppState {
  lang: "zh" | "en" | "ja";
  theme: "dark" | "light";
  studioView: StudioViewTab;
  pickerCollapsed: boolean;
  enkaPanelOpen: boolean;
  pickerTab: "presets" | "manual" | "finder" | "guide";
  presetCat: string;
  manualTargetSlot: number;
  manualRoleFilter: string;
  manualElemFilter: string;
  manualSearch: string;
  finderAnchor: string;
  finderReqAA: boolean;
  finderF2PWep: boolean;
  finderUseVault: boolean;
  finderMaxGold: number;
  ownedChars: string[];
  evalSlotIdx: number;
  evalTab: "weapons" | "mindscapes" | "roi" | "discs";
  evalARef: number;
  evalIncludeRef: boolean;
  autoSnapTimeline: boolean;
  selectedBlockId: string | null;
  timelineBlocks: any[];
  snapshots: Array<any | null>;
  slots: Array<SlotConfig | null>;
  env: any;
}

export function makeInitialState(): WorkbenchAppState {
  const defPreset = PRESET_TEAMS[0];
  const slots = [0, 1, 2].map((i) => {
    const sp = defPreset?.slots?.[i];
    return sp ? makeDefaultSlot(sp[0], sp[1], sp[2], sp[3], sp[4]) : null;
  });
  if (slots[1]?.cid === "1311" && slots[2]?.cid === "1031") {
    slots[1].fourPc = "静听";
    slots[2].fourPc = "月光";
  }
  return {
    lang: "zh",
    theme: "light",
    studioView: "build",
    pickerCollapsed: true,
    enkaPanelOpen: false,
    pickerTab: "presets",
    presetCat: "ALL",
    manualTargetSlot: 0,
    manualRoleFilter: "ALL",
    manualElemFilter: "ALL",
    manualSearch: "",
    finderAnchor: "1091",
    finderReqAA: true,
    finderF2PWep: false,
    finderUseVault: true,
    finderMaxGold: 99,
    ownedChars: SC_CHARS.map((c) => c.id),
    evalSlotIdx: 0,
    evalTab: "weapons",
    evalARef: 5,
    evalIncludeRef: false,
    autoSnapTimeline: true,
    selectedBlockId: null,
    timelineBlocks: [],
    snapshots: [null, null, null, null],
    slots,
    env: {
      metricMode: "dps",
      bangbooId: defPreset?.bangboo || "b_snap",
      includeBangbooDmg: true,
      swapMode: "standard",
      swapConfig: makeDefaultSwapConfig("standard"),
      timelineCoupled: false,
      timelineAnalysis: null,
      timelineCids: [],
      stageId: "none",
      stageBuffs: deepClone(STAGE_BUFFS.none),
      enemyDef: 953,
      enemyRes: 0,
      elemResMap: makeDefaultElemResMap(),
      stunMultBase: 1.5,
      stunPhysicsMode: "physics",
      stunShare: null,
      dazeThreshold: 4200,
      stunDurationBase: 12.0,
      anomThresholdScale: 1.0,
      disorderSec: 7.0,
      miasmaFactor: 1.0,
      highAggro: false,
      rollBudget: 28,
      subRollCap: 18,
      potAwakening: true,
      er2pcCountsInit: true
    }
  };
}

export const appStore: {
  state: WorkbenchAppState;
  lastSimResult: any;
} = {
  state: makeInitialState(),
  lastSimResult: null
};

let refreshHandler: (() => void) | null = null;

export function registerRefreshHandler(fn: () => void): void {
  refreshHandler = fn;
}

export function triggerRefreshUI(): void {
  if (refreshHandler) refreshHandler();
}

export function saveWorkspaceToStorage(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_WORKSPACE_KEY, JSON.stringify({ ...appStore.state }));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadWorkspaceFromStorage(): void {
  try {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(STORAGE_WORKSPACE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.slots)) return;
    const base = makeInitialState();
    appStore.state = {
      ...base,
      ...parsed,
      env: {
        ...base.env,
        ...(parsed.env || {}),
        elemResMap: { ...makeDefaultElemResMap(), ...(parsed.env?.elemResMap || {}) },
        swapConfig: {
          ...makeDefaultSwapConfig(parsed.env?.swapMode || "standard"),
          ...(parsed.env?.swapConfig || {})
        }
      }
    };
    appStore.state.slots = [0, 1, 2].map((i) => {
      const s = parsed.slots[i];
      if (!s || !s.cid || !CHAR_MAP[s.cid]) return null;
      const def = makeDefaultSlot(s.cid)!;
      return {
        ...def,
        ...s,
        slotExtra: { ...def.slotExtra, ...(s.slotExtra || {}) }
      };
    });
  } catch {
    // Ignore malformed storage
  }
}

export function fmtNum(v: unknown): string {
  const n = Math.round(Number(v) || 0);
  return n.toLocaleString("en-US");
}

export function fmtWan(v: unknown): string {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`;
  return fmtNum(n);
}

export function fmtPct(v: unknown, digits = 1): string {
  return `${((Number(v) || 0) * 100).toFixed(digits)}%`;
}

export function getActiveMembersForUI(): Array<{
  slotIdx: number;
  ch: AgentDef;
  m: number;
  cfg: SlotConfig;
}> {
  const out: Array<{ slotIdx: number; ch: AgentDef; m: number; cfg: SlotConfig }> = [];
  appStore.state.slots.forEach((sl, slotIdx) => {
    if (!sl || !sl.cid || !CHAR_MAP[sl.cid]) return;
    out.push({ slotIdx, ch: CHAR_MAP[sl.cid], m: sl.m ?? 0, cfg: sl });
  });
  return out;
}

export function ensureTimelineInitialized(forceRegen = false): void {
  const { state } = appStore;
  const active = getActiveMembersForUI();
  const curKey = active.map((x) => x.ch.id).join(",");
  const prevKey = (state.env.timelineCids || []).join(",");
  if (
    forceRegen ||
    !Array.isArray(state.timelineBlocks) ||
    state.timelineBlocks.length === 0 ||
    curKey !== prevKey
  ) {
    state.timelineBlocks = generateSmartTimeline(active, state.env.swapConfig, state.env);
    state.env.timelineCids = active.map((x) => x.ch.id);
    state.selectedBlockId = state.timelineBlocks[0]?.id || null;
  }
  state.env.timelineAnalysis = analyzeTimeline(state.timelineBlocks, active);
}

export function snapTimelineSequential(blocks: any[]): void {
  let cursor = 0.0;
  blocks.forEach((b) => {
    b.startSec = Number(cursor.toFixed(2));
    const sw = Math.max(0.15, Math.min(Number(b.totalDur) || 1.0, Number(b.swapDur) || 1.0));
    b.swapDur = Number(sw.toFixed(2));
    cursor = Number((cursor + b.swapDur).toFixed(2));
  });
}

export function preventDuplicateSupportAuraSets(): void {
  const { state } = appStore;
  const s1 = state.slots[1];
  const s2 = state.slots[2];
  if (
    s1?.cid &&
    s2?.cid &&
    s1.fourPc === s2.fourPc &&
    ["月光", "静听", "山大王", "摇摆"].includes(s1.fourPc)
  ) {
    if (s1.cid === "1311") {
      s1.fourPc = "静听";
      s2.fourPc = "月光";
    } else if (s2.cid === "1311") {
      s2.fourPc = "静听";
      s1.fourPc = "月光";
    }
  }
}

export function assignCharacterToSlot(slotIdx: number, cid: string | null): void {
  const { state } = appStore;
  if (!cid || !CHAR_MAP[cid]) {
    state.slots[slotIdx] = null;
  } else {
    state.slots[slotIdx] = makeDefaultSlot(cid);
  }
  preventDuplicateSupportAuraSets();
  ensureTimelineInitialized(true);
  triggerRefreshUI();
}

export function applyPresetTeam(preset: PresetTeamDef | undefined): void {
  if (!preset) return;
  const { state } = appStore;
  if (preset.fullSlots && Array.isArray(preset.fullSlots)) {
    state.slots = [0, 1, 2].map((i) => (preset.fullSlots?.[i] ? deepClone(preset.fullSlots[i]) : null));
  } else {
    state.slots = [0, 1, 2].map((i) => {
      const sp = preset.slots?.[i];
      if (!sp || !CHAR_MAP[sp[0]]) return null;
      return makeDefaultSlot(sp[0], sp[1], sp[2], sp[3], sp[4]);
    });
    if (
      state.slots[1]?.cid === "1311" &&
      state.slots[2]?.cid &&
      CHAR_MAP[state.slots[2].cid]?.wt === "Support" &&
      !preset.slots[2]?.[4]
    ) {
      state.slots[1].fourPc = "静听";
      state.slots[2].fourPc = "月光";
    }
  }
  if (preset.bangboo && BANGBOO_MAP[preset.bangboo]) {
    state.env.bangbooId = preset.bangboo;
  }
  if (preset.swapConfig) {
    state.env.swapConfig = deepClone(preset.swapConfig);
  }
  ensureTimelineInitialized(true);
  triggerRefreshUI();
}

// ============================================================================
// ZZZ v3.3 Multiplier Dilution, Marginal Returns, Disc [5] & Cross-Env/Boss Engine
// ============================================================================

import { CHAR_MAP, SC_WEPS, STAGE_BUFFS, deepClone } from "../data/store";
import { ALL_ELEMENTS, DISC_MAIN_ZH, calcDefLevelFactor } from "./constants";
import { simulateTeamV2 } from "./simulator";
import { makeDefaultSwapConfig } from "./swapTimeline";
import type { ElementCode, EnvConfig, SlotConfig } from "../types";

export interface BossArchetypeDef {
  id: string;
  shortName: string;
  label: string;
  specText: string;
  buildOverrides: (carryElem: ElementCode | string) => Partial<EnvConfig>;
}

export interface StageShortMeta {
  id: string;
  shortName: string;
  tag: string;
}

export interface MarginalBuffRow {
  key: string;
  label: string;
  unitLabel: string;
  selfGain: number;
  teamGain: number;
  status: "anti" | "high" | "normal" | "heavy" | "zero";
  statusLabel: string;
}

export interface Disc5ShowdownItem {
  main: string;
  label: string;
  selfDmg: number;
  teamDps: number;
  relPct: number; // relative to best (0 for winner, negative for others)
  isBest: boolean;
  isCurrent: boolean;
}

export interface StageEnvPreviewRow {
  stageId: string;
  shortName: string;
  tag: string;
  teamDps: number;
  gainVsNone: number;
  bestD5: string;
  bestD5Zh: string;
  d5Shifted: boolean;
  isCurrent: boolean;
}

export interface BossPreviewRow {
  bossId: string;
  shortName: string;
  specText: string;
  teamDps: number;
  retention: number; // relative to standard 953 DEF / 0% RES boss (1.0 = 100%)
  sShare: number;
  bestD5: string;
  bestD5Zh: string;
  d5Shifted: boolean;
}

export interface TeamDilutionAnalysis {
  slotIdx: number;
  cid: string;
  agentName: string;
  wt: string;
  baseExpand: number;
  defShred: number;
  totalPen: number;
  enemyDef: number;
  currentDmgM: number;
  pen24BreakEvenDmgBonus: number | null; // null = never (e.g. Rupture or 100% shred)
  marginals: MarginalBuffRow[];
  disc5: {
    items: Disc5ShowdownItem[];
    bestMain: string;
    bestLabel: string;
    runnerUpLabel: string;
    leadGap: number;
    currentMain: string;
    useTeamMetric: boolean;
  };
  stages: StageEnvPreviewRow[];
  bosses: BossPreviewRow[];
  headlineDiag: string;
}

export function makeZeroElemResMap(fillVal = 0): Record<string, number> {
  const map: Record<string, number> = {};
  for (const el of ALL_ELEMENTS) {
    map[el.eb] = fillVal;
  }
  return map;
}

export const STAGE_SHORT_META: StageShortMeta[] = [
  { id: "none", shortName: "无天气基准", tag: "纯面板基准" },
  { id: "shiyu_33_p1", shortName: "式舆一期", tag: "+80精通/+30%异伤" },
  { id: "shiyu_33_p2", shortName: "式舆二期", tag: "+30%撕裂/-15%全抗" },
  { id: "shiyu_33_p3", shortName: "式舆三期", tag: "+40%暴伤/无视20%防" },
  { id: "da_veil", shortName: "危局帷幕", tag: "+25%伤/+20%贯穿/+20%易伤" },
  { id: "tower_high", shortName: "鏖战高塔", tag: "无Buff · 红光安全轴" }
];

export const BOSS_ARCHETYPES: BossArchetypeDef[] = [
  {
    id: "b1_std",
    shortName: "B1 标准首领",
    label: "B1 标准首领(953防/0抗)",
    specText: "953防 · 0%抗 · 4200韧 · 12s失衡",
    buildOverrides: () => ({
      enemyDef: 953,
      enemyRes: 0,
      elemResMap: makeZeroElemResMap(0),
      stunMultBase: 1.5,
      dazeThreshold: 4200,
      stunDurationBase: 12.0,
      anomThresholdScale: 1.0,
      disorderSec: 7.0,
      miasmaFactor: 1.0,
      highAggro: false
    })
  },
  {
    id: "b2_weak",
    shortName: "B2 顺弱点首领",
    label: "B2 顺弱点首领(-20%抗)",
    specText: "953防 · 主C属性-20%弱抗",
    buildOverrides: (carryElem) => {
      const m = makeZeroElemResMap(0);
      m[carryElem] = -0.20;
      return {
        enemyDef: 953,
        enemyRes: 0,
        elemResMap: m,
        stunMultBase: 1.5,
        dazeThreshold: 4200,
        stunDurationBase: 12.0,
        anomThresholdScale: 1.0,
        disorderSec: 7.0,
        miasmaFactor: 1.0,
        highAggro: false
      };
    }
  },
  {
    id: "b3_res",
    shortName: "B3 逆属性高压",
    label: "B3 逆属性高压(+20%全抗)",
    specText: "953防 · 全属性+20%高抗",
    buildOverrides: () => ({
      enemyDef: 953,
      enemyRes: 0.20,
      elemResMap: makeZeroElemResMap(0.20),
      stunMultBase: 1.5,
      dazeThreshold: 4200,
      stunDurationBase: 12.0,
      anomThresholdScale: 1.0,
      disorderSec: 7.0,
      miasmaFactor: 1.0,
      highAggro: false
    })
  },
  {
    id: "b4_highdef",
    shortName: "B4 重甲超高防",
    label: "B4 重甲超高防(1588防)",
    specText: "1588超高防御 · 0%抗",
    buildOverrides: () => ({
      enemyDef: 1588,
      enemyRes: 0,
      elemResMap: makeZeroElemResMap(0),
      stunMultBase: 1.5,
      dazeThreshold: 4200,
      stunDurationBase: 12.0,
      anomThresholdScale: 1.0,
      disorderSec: 7.0,
      miasmaFactor: 1.0,
      highAggro: false
    })
  },
  {
    id: "b5_fragile",
    shortName: "B5 脆皮高易伤",
    label: "B5 脆皮高易伤(600防/200%易伤)",
    specText: "600低防 · 200%失衡易伤",
    buildOverrides: () => ({
      enemyDef: 600,
      enemyRes: 0,
      elemResMap: makeZeroElemResMap(0),
      stunMultBase: 2.0,
      dazeThreshold: 4200,
      stunDurationBase: 12.0,
      anomThresholdScale: 1.0,
      disorderSec: 7.0,
      miasmaFactor: 1.0,
      highAggro: false
    })
  },
  {
    id: "b6_aggro",
    shortName: "B6 疯狗短失衡",
    label: "B6 疯狗短失衡(5800韧/8s/红光)",
    specText: "5800高韧 · 8s短失衡 · 红光高压",
    buildOverrides: () => ({
      enemyDef: 953,
      enemyRes: 0,
      elemResMap: makeZeroElemResMap(0),
      stunMultBase: 1.5,
      dazeThreshold: 5800,
      stunDurationBase: 8.0,
      anomThresholdScale: 1.0,
      disorderSec: 7.0,
      miasmaFactor: 1.0,
      highAggro: true
    })
  },
  {
    id: "b7_miasma",
    shortName: "B7 秽盾减伤首领",
    label: "B7 秽盾减伤首领(1150防/0.75秽盾)",
    specText: "1150防 · 0.75秽盾减伤(命破无视)",
    buildOverrides: () => ({
      enemyDef: 1150,
      enemyRes: 0,
      elemResMap: makeZeroElemResMap(0),
      stunMultBase: 1.5,
      dazeThreshold: 4200,
      stunDurationBase: 12.0,
      anomThresholdScale: 1.0,
      disorderSec: 7.0,
      miasmaFactor: 0.75,
      highAggro: false
    })
  },
  {
    id: "b8_anomres",
    shortName: "B8 防异常首领",
    label: "B8 防异常首领(1.4x积蓄条/5s紊乱)",
    specText: "1.4×高积蓄阈值 · 5s剩余紊乱",
    buildOverrides: () => ({
      enemyDef: 953,
      enemyRes: 0,
      elemResMap: makeZeroElemResMap(0),
      stunMultBase: 1.5,
      dazeThreshold: 4200,
      stunDurationBase: 12.0,
      anomThresholdScale: 1.40,
      disorderSec: 5.0,
      miasmaFactor: 1.0,
      highAggro: false
    })
  }
];

export function exactDefMult(enemyDef: number, shred: number, pen: number, penFlat = 0, agentLv = 60): number {
  const k = calcDefLevelFactor(agentLv);
  const s = Math.min(1.0, Math.max(0, shred));
  const p = Math.min(1.0, Math.max(0, pen));
  const effDef = Math.max(0, enemyDef * (1 - s) * (1 - p) - penFlat);
  return k / (k + effDef);
}

export function lockSolvedSlotsForMarginal(slots: Array<SlotConfig | null>, simRes: any): Array<SlotConfig | null> {
  return slots.map((s, idx) => {
    if (!s || !s.cid) return null;
    const sr = simRes?.slotResults?.find((r: any) => r.slotIdx === idx);
    const copy: SlotConfig = deepClone(s);
    if (!copy.slotExtra) copy.slotExtra = {};
    if (sr && (copy.buildMode || "auto") === "auto") {
      copy.discAuto = false;
      copy.d4 = s.discAuto === false && s.d4 ? s.d4 : sr.st?.d4 || "CR";
      copy.d5 = s.discAuto === false && s.d5 ? s.d5 : sr.st?.d5 || "ELEM";
      copy.d6 = s.discAuto === false && s.d6 ? s.d6 : sr.st?.d6 || "ATK%";
      copy.subAuto = false;
      copy.sub = deepClone(s.subAuto === false && s.sub ? s.sub : sr.bestSub || {});
    }
    return copy;
  });
}

function classifyMarginal(key: string, selfGain: number, chWt: string, shred: number, totalPen: number): {
  status: MarginalBuffRow["status"];
  statusLabel: string;
} {
  if (selfGain <= 0.002) {
    return { status: "zero", statusLabel: "0收益机制" };
  }
  if (key === "shred20" && shred >= 0.30 && selfGain >= 0.145) {
    return { status: "anti", statusLabel: "反稀释红利" };
  }
  if (key === "pen24" && totalPen >= 0.24 && selfGain >= 0.165) {
    return { status: "anti", statusLabel: "穿透反稀释" };
  }
  if (key === "res15" && selfGain >= 0.165) {
    return { status: "anti", statusLabel: "逆抗放大" };
  }
  if (key === "dmg30" || key === "cd40") {
    if (selfGain < 0.105) return { status: "heavy", statusLabel: "严重稀释" };
    if (selfGain < 0.135) return { status: "normal", statusLabel: "中度稀释" };
    return { status: "high", statusLabel: "高收益" };
  }
  if (key === "pen24") {
    if (selfGain < 0.105) return { status: "heavy", statusLabel: "减防互稀释" };
    if (selfGain < 0.145) return { status: "normal", statusLabel: "常规收益" };
    return { status: "high", statusLabel: "高收益" };
  }
  if (key === "shred20") {
    if (selfGain < 0.10) return { status: "heavy", statusLabel: "穿透互稀释" };
    if (selfGain < 0.135) return { status: "normal", statusLabel: "常规收益" };
    return { status: "high", statusLabel: "高收益" };
  }
  if (key === "stun30") {
    if (selfGain < 0.065) return { status: "heavy", statusLabel: "窗口压缩" };
    if (selfGain < 0.115) return { status: "normal", statusLabel: "温和收益" };
    return { status: "high", statusLabel: "爆发放大" };
  }
  if (key === "ap80") {
    if (selfGain < 0.10) return { status: "heavy", statusLabel: "精通高饱和" };
    if (selfGain < 0.15) return { status: "normal", statusLabel: "温和稀释" };
    return { status: "high", statusLabel: "高收益" };
  }
  // flat base (+300 ATK / +200 Sheer / +15% DEF)
  if (chWt === "Rupture") {
    return selfGain < 0.065 ? { status: "heavy", statusLabel: "贯穿池稀释" } : { status: "normal", statusLabel: "稳健收益" };
  }
  return selfGain < 0.068 ? { status: "heavy", statusLabel: "攻击池膨胀" } : { status: "normal", statusLabel: "稳健收益" };
}

/**
 * Evaluates full live Dilution, Marginal Returns, Disc [5] Showdown, 6-Stage Weather Matrix,
 * and 8-Boss Stress Test for the active squad & selected slot.
 */
export function analyzeTeamDilution(
  slots: Array<SlotConfig | null>,
  env: EnvConfig,
  simRes: any,
  targetSlotIdx = 0,
  charMap = CHAR_MAP,
  wepMap = SC_WEPS
): TeamDilutionAnalysis | null {
  if (!simRes || !simRes.slotResults || simRes.slotResults.length === 0) return null;
  const srTarget =
    simRes.slotResults.find((r: any) => r.slotIdx === targetSlotIdx) || simRes.slotResults[0];
  if (!srTarget) return null;

  const actualSlotIdx = srTarget.slotIdx;
  const ch = srTarget.ch;
  const bd = srTarget.bd;
  const locked = lockSolvedSlotsForMarginal(slots, simRes);

  const baseFast = simulateTeamV2(locked, env, charMap, wepMap, {
    fastMode: true,
    skipSoloBaseline: true
  });
  const baseSr = baseFast.slotResults.find((r: any) => r.slotIdx === actualSlotIdx) || baseFast.slotResults[0];
  const baseSelf = Math.max(1e-6, baseSr?.rawDmg || 1);
  const baseTeam = Math.max(1e-6, baseFast.teamActualDps || 1);

  const evalDelta = (mutateFn: (sl: SlotConfig, envMut: EnvConfig) => void) => {
    const nextSlots = deepClone(locked);
    const nextEnv = deepClone(env);
    if (!nextEnv.stageBuffs) {
      nextEnv.stageBuffs = deepClone(STAGE_BUFFS[nextEnv.stageId || "none"] || STAGE_BUFFS.none);
    }
    const targetSl = nextSlots[actualSlotIdx];
    if (!targetSl) return { selfGain: 0, teamGain: 0 };
    if (!targetSl.slotExtra) targetSl.slotExtra = {};
    mutateFn(targetSl, nextEnv);
    const nextSim = simulateTeamV2(nextSlots, nextEnv, charMap, wepMap, {
      fastMode: true,
      skipSoloBaseline: true
    });
    const nextSr = nextSim.slotResults.find((r: any) => r.slotIdx === actualSlotIdx);
    return {
      selfGain: nextSr ? Math.max(0, nextSr.rawDmg / baseSelf - 1) : 0,
      teamGain: Math.max(0, nextSim.teamActualDps / baseTeam - 1)
    };
  };

  const baseUnitLabel =
    ch.wt === "Rupture" ? "+200 贯穿力" : ch.wt === "Armorer" ? "+15% 局内防御" : "+300 固定攻击";

  const probes: Array<{
    key: string;
    label: string;
    unitLabel: string;
    fn: (sl: SlotConfig, envMut: EnvConfig) => void;
  }> = [
    { key: "dmg30", label: "增伤区", unitLabel: "+30% 全/属伤", fn: (sl) => { sl.slotExtra.dmg = (sl.slotExtra.dmg || 0) + 30; } },
    { key: "cd40", label: "暴伤区", unitLabel: "+40% 暴击伤害", fn: (sl) => { sl.slotExtra.cd = (sl.slotExtra.cd || 0) + 40; } },
    { key: "pen24", label: "穿透区", unitLabel: "+24% 穿透率", fn: (sl) => { sl.slotExtra.pen = (sl.slotExtra.pen || 0) + 24; } },
    { key: "shred20", label: "减防区", unitLabel: "+20% 无视/减防", fn: (sl) => { sl.slotExtra.def_shred = (sl.slotExtra.def_shred || 0) + 20; } },
    { key: "res15", label: "抗性区", unitLabel: "+15% 减抗", fn: (sl) => { sl.slotExtra.res_shred = (sl.slotExtra.res_shred || 0) + 15; } },
    {
      key: "stun30",
      label: "失衡易伤",
      unitLabel: "+30% 失衡易伤",
      fn: (_sl, envMut) => {
        envMut.stageBuffs.stun_mult = (envMut.stageBuffs.stun_mult || 0) + 0.30;
      }
    },
    {
      key: "flatBase",
      label: ch.wt === "Rupture" ? "贯穿基础" : ch.wt === "Armorer" ? "防御基础" : "攻击基础",
      unitLabel: baseUnitLabel,
      fn: (sl) => {
        if (ch.wt === "Rupture") sl.slotExtra.sheer = (sl.slotExtra.sheer || 0) + 200;
        else if (ch.wt === "Armorer") sl.slotExtra.def_pct = (sl.slotExtra.def_pct || 0) + 15;
        else sl.slotExtra.atk_flat = (sl.slotExtra.atk_flat || 0) + 300;
      }
    }
  ];

  if (ch.wt === "Anomaly" || ch.prof?.anom_split || ch.id === "1031") {
    probes.push({
      key: "ap80",
      label: "异常精通",
      unitLabel: "+80 异常精通",
      fn: (sl) => {
        sl.slotExtra.ap = (sl.slotExtra.ap || 0) + 80;
      }
    });
  }

  const defShred = Number(bd.shred || 0);
  const totalPen = Number(bd.totalPen || 0);
  const enemyDef = Number(env.enemyDef ?? 953);

  const marginals: MarginalBuffRow[] = probes.map((p) => {
    const res = evalDelta(p.fn);
    const { status, statusLabel } = classifyMarginal(p.key, res.selfGain, ch.wt, defShred, totalPen);
    return {
      key: p.key,
      label: p.label,
      unitLabel: p.unitLabel,
      selfGain: res.selfGain,
      teamGain: res.teamGain,
      status,
      statusLabel
    };
  });

  // 2. Disc [5] Showdown (ELEM vs PEN vs ATK%/HP%/DEF%)
  const statMain = ch.wt === "Rupture" ? "HP%" : ch.wt === "Armorer" ? "DEF%" : "ATK%";
  const d5Cands = ch.wt === "Rupture" ? ["ELEM", "HP%"] : ["ELEM", "PEN", statMain];
  const useTeamMetric = ["Support", "Defense", "Stun"].includes(ch.wt);
  const curD5 =
    (slots[actualSlotIdx]?.buildMode || "auto") === "pieces"
      ? slots[actualSlotIdx]?.pieces?.[4]?.main || srTarget.st?.d5 || "ELEM"
      : srTarget.st?.d5 || "ELEM";

  const d5Raw: Array<{ main: string; selfDmg: number; teamDps: number }> = d5Cands.map((cand) => {
    const testSlots = deepClone(locked);
    const tSl = testSlots[actualSlotIdx]!;
    if ((tSl.buildMode || "auto") === "pieces" && Array.isArray(tSl.pieces) && tSl.pieces[4]) {
      tSl.pieces[4].main = cand;
      if (cand === "ELEM") tSl.pieces[4].elemType = ch.eb as ElementCode;
    } else if ((tSl.buildMode || "auto") === "panel") {
      // For direct panel mode, approximate [5] swap via slotExtra differential vs current
      tSl.buildMode = "auto";
      tSl.discAuto = false;
      tSl.d4 = srTarget.st?.d4 || "CR";
      tSl.d5 = cand;
      tSl.d6 = srTarget.st?.d6 || "ATK%";
      tSl.subAuto = false;
      tSl.sub = deepClone(srTarget.bestSub || {});
    } else {
      tSl.discAuto = false;
      tSl.d5 = cand;
      tSl.subAuto = true;
    }
    const r = simulateTeamV2(testSlots, env, charMap, wepMap, {
      fastMode: true,
      skipSoloBaseline: true
    });
    const sr = r.slotResults.find((x: any) => x.slotIdx === actualSlotIdx);
    return {
      main: cand,
      selfDmg: sr ? sr.rawDmg : 0,
      teamDps: r.teamActualDps
    };
  });

  const metricOf = (x: { selfDmg: number; teamDps: number }) => (useTeamMetric ? x.teamDps : x.selfDmg);
  const sortedD5 = [...d5Raw].sort((a, b) => metricOf(b) - metricOf(a));
  const bestD5Val = Math.max(1e-6, metricOf(sortedD5[0]));
  const secondD5Val = sortedD5[1] ? metricOf(sortedD5[1]) : bestD5Val;

  const disc5Items: Disc5ShowdownItem[] = sortedD5.map((x, idx) => ({
    main: x.main,
    label: DISC_MAIN_ZH[x.main] || x.main,
    selfDmg: x.selfDmg,
    teamDps: x.teamDps,
    relPct: idx === 0 ? 0 : metricOf(x) / bestD5Val - 1,
    isBest: idx === 0,
    isCurrent: x.main === curD5
  }));

  // Break-even DMG% bonus for +24% PEN vs +30% ELEM given current shred & enemyDef (excluding [5] PEN itself)
  const penWithoutD5 = Math.max(0, totalPen - (curD5 === "PEN" ? 0.24 : 0));
  let pen24BreakEvenDmgBonus: number | null = null;
  if (ch.wt !== "Rupture" && defShred < 0.999) {
    const m0 = exactDefMult(enemyDef, defShred, penWithoutD5);
    const m24 = exactDefMult(enemyDef, defShred, penWithoutD5 + 0.24);
    const pen24PureGain = m24 / m0 - 1;
    if (pen24PureGain > 0.002) {
      pen24BreakEvenDmgBonus = Math.max(0, 0.30 / pen24PureGain - 1.0);
    }
  }

  // 3. 6-Stage Weather Environment Preview (for current team; auto-rebalances [5] if buildMode === "auto")
  const flexAutoSlots = slots.map((s) => {
    if (!s || !s.cid) return null;
    const copy = deepClone(s);
    if ((copy.buildMode || "auto") === "auto") {
      copy.discAuto = true;
      copy.subAuto = true;
    }
    return copy;
  });

  const noneEnv: EnvConfig = {
    ...deepClone(env),
    stageId: "none",
    stageBuffs: deepClone(STAGE_BUFFS.none),
    highAggro: false
  };
  const noneSim = simulateTeamV2(flexAutoSlots, noneEnv, charMap, wepMap, {
    fastMode: true,
    skipSoloBaseline: true
  });
  const noneDps = Math.max(1e-6, noneSim.teamActualDps);
  const noneMainD5 = noneSim.slotResults[0]?.st?.d5 || "ELEM";

  const stages: StageEnvPreviewRow[] = STAGE_SHORT_META.map((sm) => {
    const sb = deepClone(STAGE_BUFFS[sm.id] || STAGE_BUFFS.none);
    const sEnv: EnvConfig = {
      ...deepClone(env),
      stageId: sm.id,
      stageBuffs: sb,
      highAggro: Boolean(sb.highAggro)
    };
    if (sm.id === "tower_high") {
      sEnv.swapConfig = {
        ...makeDefaultSwapConfig(env.swapMode || "standard"),
        ...(env.swapConfig || {}),
        safetyPolicy: "safe_only",
        parryCount: Math.min(1.0, Number(env.swapConfig?.parryCount ?? 2.5))
      };
    }
    const r =
      sm.id === "none"
        ? noneSim
        : simulateTeamV2(flexAutoSlots, sEnv, charMap, wepMap, {
            fastMode: true,
            skipSoloBaseline: true
          });
    const d5Code = r.slotResults[0]?.st?.d5 || noneMainD5;
    return {
      stageId: sm.id,
      shortName: sm.shortName,
      tag: sm.tag,
      teamDps: r.teamActualDps,
      gainVsNone: r.teamActualDps / noneDps - 1,
      bestD5: d5Code,
      bestD5Zh: DISC_MAIN_ZH[d5Code] || d5Code,
      d5Shifted: sm.id !== "none" && sm.id !== "tower_high" && d5Code !== noneMainD5,
      isCurrent: (env.stageId || "none") === sm.id
    };
  });

  // 4. 8-Boss Archetype Stress Test (baseline = B1 Standard Boss with current stage buff)
  const carry0 = simRes.slotResults[0].ch;
  const b1Env: EnvConfig = {
    ...deepClone(env),
    ...BOSS_ARCHETYPES[0].buildOverrides(carry0.eb)
  };
  const b1Sim = simulateTeamV2(flexAutoSlots, b1Env, charMap, wepMap, {
    fastMode: true,
    skipSoloBaseline: true
  });
  const b1Dps = Math.max(1e-6, b1Sim.teamActualDps);
  const b1D5 = b1Sim.slotResults[0]?.st?.d5 || "ELEM";

  const bosses: BossPreviewRow[] = BOSS_ARCHETYPES.map((b, idx) => {
    const bEnv: EnvConfig = {
      ...deepClone(env),
      ...b.buildOverrides(carry0.eb)
    };
    const r =
      idx === 0
        ? b1Sim
        : simulateTeamV2(flexAutoSlots, bEnv, charMap, wepMap, {
            fastMode: true,
            skipSoloBaseline: true
          });
    const sr0 = r.slotResults[0];
    const d5Code = sr0?.st?.d5 || b1D5;
    return {
      bossId: b.id,
      shortName: b.shortName,
      specText: b.specText,
      teamDps: r.teamActualDps,
      retention: r.teamActualDps / b1Dps,
      sShare: sr0?.bd?.sShare ?? 0.5,
      bestD5: d5Code,
      bestD5Zh: DISC_MAIN_ZH[d5Code] || d5Code,
      d5Shifted: idx > 0 && d5Code !== b1D5
    };
  });

  // 5. White base expansion & headline diagnosis
  const w = srTarget.w;
  const whiteBase =
    ch.wt === "Rupture"
      ? Math.floor(0.1 * ch.hp) + Math.floor(0.3 * (ch.atk + (w?.batk || 0)))
      : ch.wt === "Armorer"
      ? ch.def + (w?.bdef || 0)
      : ch.atk + (w?.batk || 0);
  const baseExpand = (bd.baseVal || whiteBase) / Math.max(1, whiteBase);

  const mDmg = marginals.find((m) => m.key === "dmg30")?.selfGain || 0;
  const mPen = marginals.find((m) => m.key === "pen24")?.selfGain || 0;
  const mShred = marginals.find((m) => m.key === "shred20")?.selfGain || 0;
  const mRes = marginals.find((m) => m.key === "res15")?.selfGain || 0;

  let headlineDiag = "";
  if (ch.wt === "Rupture") {
    headlineDiag = `命破天生无视100%防御与秽盾（重甲/秽盾Boss保持率${(
      (bosses.find((x) => x.bossId === "b7_miasma")?.retention || 1) * 100
    ).toFixed(1)}%），穿透/减防为0收益；优先补减抗(+${(mRes * 100).toFixed(1)}%)与失衡易伤，5号盘选【${disc5Items[0].label}】。`;
  } else if (ch.wt === "Armorer") {
    headlineDiag = `锋御暴击上限200%享二次撕裂平方收益，传统暴伤为0收益；当前【+24%穿透】净增幅高达 +${(
      mPen * 100
    ).toFixed(1)}%，5号盘锁定【${disc5Items[0].label}】。`;
  } else if (bd.anomTelemetry && bd.anomTelemetry.dilutionMult < 0.94) {
    headlineDiag = `检测到同属性积蓄染色稀释（快照纯度 ${(bd.anomTelemetry.snapshotPurity * 100).toFixed(
      0
    )}%，单次折损 -${((1 - bd.anomTelemetry.dilutionMult) * 100).toFixed(
      1
    )}%），建议避开低精通同色队友或改配异色紊乱底色；5号盘优选【${disc5Items[0].label}】。`;
  } else if (defShred >= 0.35) {
    headlineDiag = `队内高减防(${(defShred * 100).toFixed(0)}%)与穿透互稀释（+24%穿透降至 +${(
      mPen * 100
    ).toFixed(1)}%，续叠+20%减防反升至 +${(mShred * 100).toFixed(1)}%）；当前5号盘最优【${
      disc5Items[0].label
    }】。`;
  } else if ((bd.dmgM || 1) >= 2.60) {
    headlineDiag = `增伤区明显拥挤(${(bd.dmgM || 1).toFixed(2)}×，+30%增伤仅剩 +${(
      mDmg * 100
    ).toFixed(1)}%)，穿透(+${(mPen * 100).toFixed(1)}%)与减抗(+${(mRes * 100).toFixed(
      1
    )}%)优先级更高；5号盘选【${disc5Items[0].label}】。`;
  } else {
    headlineDiag = `当前乘区分布较均衡（增伤${(bd.dmgM || 1).toFixed(2)}× / 防御${(
      bd.defM || 0.5
    ).toFixed(3)}×），外拐优先【+24%穿透(+${(mPen * 100).toFixed(1)}%) / +15%减抗(+${(
      mRes * 100
    ).toFixed(1)}%)】，5号盘推荐【${disc5Items[0].label}】。`;
  }

  return {
    slotIdx: actualSlotIdx,
    cid: ch.id,
    agentName: ch.n,
    wt: ch.wt,
    baseExpand,
    defShred,
    totalPen,
    enemyDef,
    currentDmgM: Number(bd.dmgM || 1),
    pen24BreakEvenDmgBonus,
    marginals,
    disc5: {
      items: disc5Items,
      bestMain: disc5Items[0].main,
      bestLabel: disc5Items[0].label,
      runnerUpLabel: disc5Items[1]?.label || disc5Items[0].label,
      leadGap: (bestD5Val - secondD5Val) / bestD5Val,
      currentMain: curD5,
      useTeamMetric
    },
    stages,
    bosses,
    headlineDiag
  };
}

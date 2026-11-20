#!/usr/bin/env node
/**
 * Reproducible ZZZ v3.3 Multiplier Dilution, Environment & Boss Stress-Test Generator
 *
 * Usage:
 *   npm run calc:dilution
 *
 * Requires Node.js >= 22.6 (native TypeScript stripping; Node 24 LTS recommended).
 * Outputs:
 *   - docs/dilution-analysis-v3.3.md
 *   - docs/reports/zzz-v3.3-dilution-data.json
 */

import { register } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const loaderCode = `
  import fs from "node:fs";
  import { fileURLToPath, pathToFileURL } from "node:url";
  import path from "node:path";
  export async function resolve(specifier, context, nextResolve) {
    if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier)) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      for (const cand of [specifier + ".ts", path.join(specifier, "index.ts")]) {
        if (fs.existsSync(path.resolve(parentDir, cand))) {
          return nextResolve(pathToFileURL(path.resolve(parentDir, cand)).href, context);
        }
      }
    }
    return nextResolve(specifier, context);
  }
`;
register("data:text/javascript," + encodeURIComponent(loaderCode));

const store = await import(pathToFileURL(path.join(REPO_ROOT, "src/data/store.ts")).href);
const simMod = await import(pathToFileURL(path.join(REPO_ROOT, "src/engine/simulator.ts")).href);
const anomMod = await import(pathToFileURL(path.join(REPO_ROOT, "src/engine/anomalyEngine.ts")).href);
const dilMod = await import(pathToFileURL(path.join(REPO_ROOT, "src/engine/dilutionEngine.ts")).href);
const swapMod = await import(pathToFileURL(path.join(REPO_ROOT, "src/engine/swapTimeline.ts")).href);
const appMod = await import(pathToFileURL(path.join(REPO_ROOT, "src/ui/appState.ts")).href);
const constMod = await import(pathToFileURL(path.join(REPO_ROOT, "src/engine/constants.ts")).href);

const { CHAR_MAP, SC_CHARS, SC_WEPS, PRESET_TEAMS, STAGE_BUFFS, deepClone } = store;
const { simulateTeamV2, autoOptimizeTeamDiscs, findViableTeams } = simMod;
const { ANOMALY_BAR_SPECS, calcAuthenticDisorderMv } = anomMod;
const { BOSS_ARCHETYPES, exactDefMult, lockSolvedSlotsForMarginal } = dilMod;
const { makeDefaultSlot, makeDefaultElemResMap } = appMod;
const { DISC_MAIN_ZH, ALL_ELEMENTS, ALL_SPECIALTIES } = constMod;

const ELEM_ZH = Object.fromEntries(ALL_ELEMENTS.map((x) => [x.eb, x.zh]));
const WT_ZH = Object.fromEntries(ALL_SPECIALTIES.map((x) => [x.wt, x.zh]));

function round(v, d = 4) {
  const p = Math.pow(10, d);
  return Math.round((Number(v) || 0) * p) / p;
}

function fmtSignedPct(v, dec = 1) {
  const pct = (Number(v) || 0) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(dec)}%`;
}

function fmtPct(v, dec = 1) {
  return `${((Number(v) || 0) * 100).toFixed(dec)}%`;
}

function fmtInt(v) {
  return Math.round(Number(v) || 0).toLocaleString("en-US");
}

function fmtDiscZh(dStr) {
  if (!dStr || !dStr.includes("/")) return dStr || "-";
  return dStr
    .split("/")
    .map((k) => DISC_MAIN_ZH[k] || k)
    .join("/");
}

function makeEnv(overrides = {}) {
  const stageId = overrides.stageId || "none";
  const sb = deepClone(STAGE_BUFFS[stageId] || STAGE_BUFFS.none);
  return {
    metricMode: "dps",
    bangbooId: overrides.bangbooId ?? "b_snap",
    includeBangbooDmg: true,
    swapMode: "standard",
    swapConfig: overrides.swapConfig || swapMod.makeDefaultSwapConfig("standard"),
    timelineCoupled: false,
    timelineAnalysis: null,
    timelineCids: [],
    stageId,
    stageBuffs: sb,
    enemyDef: overrides.enemyDef ?? 953,
    enemyRes: overrides.enemyRes ?? 0,
    elemResMap: overrides.elemResMap ? deepClone(overrides.elemResMap) : makeDefaultElemResMap(),
    stunMultBase: overrides.stunMultBase ?? 1.5,
    stunPhysicsMode: "physics",
    stunShare: overrides.stunShare ?? null,
    dazeThreshold: overrides.dazeThreshold ?? 4200,
    stunDurationBase: overrides.stunDurationBase ?? 12.0,
    anomThresholdScale: overrides.anomThresholdScale ?? 1.0,
    disorderSec: overrides.disorderSec ?? 7.0,
    miasmaFactor: overrides.miasmaFactor ?? 1.0,
    highAggro: overrides.highAggro ?? Boolean(sb.highAggro),
    rollBudget: 28,
    subRollCap: 18,
    potAwakening: true,
    er2pcCountsInit: true
  };
}

function buildPresetSlots(preset) {
  const slots = [0, 1, 2].map((i) => {
    const sp = preset.slots?.[i];
    if (!sp || !CHAR_MAP[sp[0]]) return null;
    return makeDefaultSlot(sp[0], sp[1], sp[2], sp[3], sp[4]);
  });
  if (
    slots[1]?.cid === "1311" &&
    slots[2]?.cid &&
    CHAR_MAP[slots[2].cid]?.wt === "Support" &&
    !preset.slots[2]?.[4]
  ) {
    slots[1].fourPc = "静听";
    slots[2].fourPc = "月光";
  }
  return slots;
}

function evalMarginal(lockedSlots, targetIdx, env, mutateFn, baseSimCached = null) {
  const baseSim =
    baseSimCached ||
    simulateTeamV2(lockedSlots, env, CHAR_MAP, SC_WEPS, { fastMode: true, skipSoloBaseline: true });
  const baseSr = baseSim.slotResults.find((r) => r.slotIdx === targetIdx);
  const nextSlots = deepClone(lockedSlots);
  const nextEnv = deepClone(env);
  mutateFn(nextSlots[targetIdx], nextEnv, nextSlots);
  const nextSim = simulateTeamV2(nextSlots, nextEnv, CHAR_MAP, SC_WEPS, { fastMode: true, skipSoloBaseline: true });
  const nextSr = nextSim.slotResults.find((r) => r.slotIdx === targetIdx);
  const selfGain = baseSr?.rawDmg > 0 ? nextSr.rawDmg / baseSr.rawDmg - 1 : 0;
  const teamGain = baseSim.teamActualDps > 0 ? nextSim.teamActualDps / baseSim.teamActualDps - 1 : 0;
  return { selfGain, teamGain };
}

function getWhiteBaseVal(ch, w) {
  if (ch.wt === "Rupture") {
    return Math.floor(0.1 * ch.hp) + Math.floor(0.3 * (ch.atk + (w?.batk || 0)));
  }
  if (ch.wt === "Armorer") {
    return ch.def + (w?.bdef || 0);
  }
  return ch.atk + (w?.batk || 0);
}

function compareSlot5Mains(optSlots, targetIdx, env) {
  const ch = CHAR_MAP[optSlots[targetIdx].cid];
  const statMain = ch.wt === "Rupture" ? "HP%" : ch.wt === "Armorer" ? "DEF%" : "ATK%";
  const d5Cands = ch.wt === "Rupture" ? ["ELEM", "HP%"] : ["ELEM", "PEN", statMain];
  const curSim = simulateTeamV2(optSlots, env, CHAR_MAP, SC_WEPS, { skipSoloBaseline: true });
  const curSr = curSim.slotResults.find((r) => r.slotIdx === targetIdx);
  const d4 = curSr.st.d4;
  const d6 = curSr.st.d6;

  const scores = {};
  for (const cand5 of d5Cands) {
    const testSlots = deepClone(optSlots);
    testSlots[targetIdx].discAuto = false;
    testSlots[targetIdx].d4 = d4;
    testSlots[targetIdx].d5 = cand5;
    testSlots[targetIdx].d6 = d6;
    testSlots[targetIdx].subAuto = true;
    const r = simulateTeamV2(testSlots, env, CHAR_MAP, SC_WEPS, { fastMode: false, skipSoloBaseline: true });
    const sr = r.slotResults.find((x) => x.slotIdx === targetIdx);
    scores[cand5] = { selfDmg: sr ? sr.rawDmg : 0, teamDps: r.teamActualDps };
  }
  const useTeam = ["Support", "Defense", "Stun"].includes(ch.wt);
  const metric = (k) => (useTeam ? scores[k]?.teamDps || 0 : scores[k]?.selfDmg || 0);
  const sorted = [...d5Cands].sort((a, b) => metric(b) - metric(a));
  const best5 = sorted[0];
  const second5 = sorted[1] || sorted[0];
  const bestVal = Math.max(1, metric(best5));
  const gapSecond = (bestVal - metric(second5)) / bestVal;
  return {
    best5,
    best5Zh: DISC_MAIN_ZH[best5] || best5,
    second5Zh: DISC_MAIN_ZH[second5] || second5,
    gapSecond
  };
}

function diagnoseCharDilution(ch, sr, mGains, d5Info, baseExpand) {
  const bd = sr.bd;
  const wt = ch.wt;
  const issues = [];
  if (wt === "Rupture") {
    if (bd.dmgM >= 2.55) issues.push(`增伤高饱和(${bd.dmgM.toFixed(2)}×)`);
    if (bd.critM >= 3.35) issues.push(`双暴饱和(${bd.critM.toFixed(2)}×)`);
    if (!issues.length) issues.push("乘区均衡(无视防1.00×)");
    return `${issues.join("+")}；天生无视防御/秽盾，5号选【${d5Info.best5Zh}】(胜${d5Info.second5Zh} ${(d5Info.gapSecond * 100).toFixed(1)}%)`;
  }
  if (wt === "Armorer") {
    return `二次撕裂池(${(bd.c_cr * 100).toFixed(0)}%暴/${bd.critM.toFixed(2)}×)；暴击上限200%平方反稀释，5号选【${d5Info.best5Zh}】`;
  }
  if (ch.prof?.anom_split && ch.id !== "1091") {
    if ((bd.c_ap || 0) >= 460) issues.push(`精通饱和(${Math.round(bd.c_ap)})`);
    if (bd.dmgM >= 2.35) issues.push(`增伤饱和(${bd.dmgM.toFixed(2)}×)`);
    if (bd.anomTelemetry?.dilutionMult < 0.94) issues.push(`染色稀释(-${((1 - bd.anomTelemetry.dilutionMult) * 100).toFixed(1)}%)`);
    if (!issues.length) issues.push("攻精均衡");
    return `${issues.join("+")}；双暴近0收益，避低精同色队友，5号选【${d5Info.best5Zh}】`;
  }
  if (bd.c_cr > 1.005) issues.push(`暴率达顶(${(bd.c_cr * 100).toFixed(0)}%)`);
  if (bd.c_cd >= 2.35) issues.push(`暴伤饱和(${(bd.c_cd * 100).toFixed(0)}%)`);
  if (bd.dmgM >= 2.65) issues.push(`增伤严重稀释(${bd.dmgM.toFixed(2)}×)`);
  if (bd.shred >= 0.35) issues.push(`高减防压低穿透(${(bd.shred * 100).toFixed(0)}%)`);
  if (baseExpand >= 2.85 && !issues.length) issues.push(`攻击池膨胀(${baseExpand.toFixed(2)}×)`);
  if (!issues.length) issues.push("温和稀释");

  if (["Support", "Defense", "Stun"].includes(wt)) {
    return `${issues.join("+")}；拐位先保核心阈值与光环，5号团队最优【${d5Info.best5Zh}】`;
  }
  if (bd.shred >= 0.35) {
    return `${issues.join("+")}；续叠+20%减防反升至${fmtSignedPct(mGains.shred20)}，5号选【${d5Info.best5Zh}】`;
  }
  return `${issues.join("+")}；补穿透/减抗优先于增伤，5号选【${d5Info.best5Zh}】(胜${d5Info.second5Zh} ${(d5Info.gapSecond * 100).toFixed(1)}%)`;
}

// ============================================================================
// Execute Full Simulation Pipeline
// ============================================================================
console.log("[1/5] Pre-optimizing 24 Meta Squad Presets & Auditing all 62 Agents...");
const stdEnv = makeEnv();
const presetCache = PRESET_TEAMS.map((p) => {
  const env = makeEnv({ bangbooId: p.bangboo || "b_snap" });
  const optSlots = autoOptimizeTeamDiscs(buildPresetSlots(p), env, CHAR_MAP, SC_WEPS);
  const sim = simulateTeamV2(optSlots, env, CHAR_MAP, SC_WEPS);
  return { preset: p, env, optSlots, sim };
});

const ROLE_SORT = { Attack: 1, Anomaly: 2, Rupture: 3, Armorer: 4, Stun: 5, Defense: 6, Support: 7 };
const charRowsData = [];

for (const ch of SC_CHARS) {
  const cid = ch.id;
  let chosenSlots = null;
  let chosenEnv = stdEnv;
  let teamLabel = "";

  const pSlot0 = presetCache.find((x) => x.optSlots[0]?.cid === cid);
  const pAny = presetCache.find((x) => x.optSlots.some((s) => s?.cid === cid));

  if (pSlot0) {
    chosenSlots = deepClone(pSlot0.optSlots);
    chosenEnv = deepClone(pSlot0.env);
    teamLabel = pSlot0.preset.name.replace(/^【.*?】/, "");
  } else if (pAny && ["Stun", "Support", "Defense"].includes(ch.wt)) {
    chosenSlots = deepClone(pAny.optSlots);
    chosenEnv = deepClone(pAny.env);
    teamLabel = pAny.preset.name.replace(/^【.*?】/, "");
  } else {
    let viable = findViableTeams(cid, null, stdEnv, CHAR_MAP, SC_WEPS, { requireAllAA: true, limit: 3 });
    if (!viable.length) viable = findViableTeams(cid, null, stdEnv, CHAR_MAP, SC_WEPS, { requireAllAA: false, limit: 3 });
    if (viable.length) {
      const rawSlots = viable[0].slots.map((s) => makeDefaultSlot(s.cid, s.m, s.wid, s.ref, s.fourPc));
      chosenEnv = makeEnv({ bangbooId: "b_snap" });
      chosenSlots = autoOptimizeTeamDiscs(rawSlots, chosenEnv, CHAR_MAP, SC_WEPS);
      teamLabel = chosenSlots.map((s) => CHAR_MAP[s.cid].n).join(" + ");
    } else if (pAny) {
      chosenSlots = deepClone(pAny.optSlots);
      chosenEnv = deepClone(pAny.env);
      teamLabel = pAny.preset.name.replace(/^【.*?】/, "");
    }
  }

  const teamSim = simulateTeamV2(chosenSlots, chosenEnv, CHAR_MAP, SC_WEPS);
  const targetIdx = chosenSlots.findIndex((s) => s?.cid === cid);
  const sr = teamSim.slotResults.find((r) => r.slotIdx === targetIdx);
  const locked = lockSolvedSlotsForMarginal(chosenSlots, teamSim);
  const fastBaseSim = simulateTeamV2(locked, chosenEnv, CHAR_MAP, SC_WEPS, { fastMode: true, skipSoloBaseline: true });

  const whiteBase = getWhiteBaseVal(ch, sr.w);
  const baseExpand = sr.bd.baseVal / Math.max(1, whiteBase);

  const mainSubKey = ch.wt === "Rupture" ? "HP%" : ch.wt === "Armorer" ? "DEF%" : "ATK%";
  const subCr = evalMarginal(locked, targetIdx, chosenEnv, (sl) => { sl.sub.CR = (sl.sub.CR || 0) + 1; }, fastBaseSim).selfGain;
  const subCd = evalMarginal(locked, targetIdx, chosenEnv, (sl) => { sl.sub.CD = (sl.sub.CD || 0) + 1; }, fastBaseSim).selfGain;
  const subStat = evalMarginal(locked, targetIdx, chosenEnv, (sl) => { sl.sub[mainSubKey] = (sl.sub[mainSubKey] || 0) + 1; }, fastBaseSim).selfGain;
  const subAp = evalMarginal(locked, targetIdx, chosenEnv, (sl) => { sl.sub.AP = (sl.sub.AP || 0) + 1; }, fastBaseSim).selfGain;

  const gDmg30 = evalMarginal(locked, targetIdx, chosenEnv, (sl) => { sl.slotExtra.dmg = (sl.slotExtra.dmg || 0) + 30; }, fastBaseSim).selfGain;
  const gCd40 = evalMarginal(locked, targetIdx, chosenEnv, (sl) => { sl.slotExtra.cd = (sl.slotExtra.cd || 0) + 40; }, fastBaseSim).selfGain;
  const gPen24 = evalMarginal(locked, targetIdx, chosenEnv, (sl) => { sl.slotExtra.pen = (sl.slotExtra.pen || 0) + 24; }, fastBaseSim).selfGain;
  const gShred20 = evalMarginal(locked, targetIdx, chosenEnv, (sl) => { sl.slotExtra.def_shred = (sl.slotExtra.def_shred || 0) + 20; }, fastBaseSim).selfGain;
  const gRes15 = evalMarginal(locked, targetIdx, chosenEnv, (sl) => { sl.slotExtra.res_shred = (sl.slotExtra.res_shred || 0) + 15; }, fastBaseSim).selfGain;
  const gStun30 = evalMarginal(locked, targetIdx, chosenEnv, (_sl, envMut) => {
    envMut.stageBuffs.stun_mult = (envMut.stageBuffs.stun_mult || 0) + 0.30;
  }, fastBaseSim).selfGain;

  const d5Info = compareSlot5Mains(chosenSlots, targetIdx, chosenEnv);

  let critOrAnomStr = "";
  if (ch.prof?.anom_split && cid !== "1091") {
    critOrAnomStr = `精${Math.round(sr.bd.c_ap || 0)}/掌${Math.round(sr.bd.combat_am || 0)}`;
  } else if (cid === "1091") {
    critOrAnomStr = `${(Math.min(1, sr.bd.c_cr) * 100).toFixed(0)}/${(sr.bd.c_cd * 100).toFixed(0)}%·精${Math.round(sr.bd.c_ap || 0)}`;
  } else if (ch.wt === "Armorer") {
    critOrAnomStr = `暴${(sr.bd.c_cr * 100).toFixed(0)}%/撕+${(sr.bd.c_cd * 100).toFixed(0)}%`;
  } else {
    critOrAnomStr = `${(Math.min(1, sr.bd.c_cr) * 100).toFixed(0)}%/${(sr.bd.c_cd * 100).toFixed(0)}%`;
  }

  const effCritOrApMult =
    ch.prof?.anom_split && cid !== "1091"
      ? (sr.bd.c_ap / 100.0) * (sr.bd.anomCrit || 1.0)
      : sr.bd.critM;

  charRowsData.push({
    cid,
    name: ch.n,
    rankCfg: ch.r === "S" ? "S(0+1)" : "A(6+5)",
    wt: ch.wt,
    wtZh: WT_ZH[ch.wt] || ch.wt,
    elemZh: ELEM_ZH[ch.eb] || ch.eb,
    teamLabel,
    setCombo: `${sr.fourPc}4+${sr.twoPc}2`,
    bestDiscZh: fmtDiscZh(sr.bestDisc),
    combatBase: Math.round(sr.bd.baseVal),
    baseExpand: round(baseExpand, 2),
    critOrAnomStr,
    effCritOrApMult: round(effCritOrApMult, 2),
    dmgM: round(sr.bd.dmgM, 2),
    defM: round(sr.bd.defM, 3),
    resM: round(sr.bd.resM, 2),
    stunMult: round(sr.bd.stunMult, 2),
    teamDps: Math.round(teamSim.teamActualDps),
    selfWeightedDps: Math.round((sr.weightedDmg * 20.0) / teamSim.cycleSec),
    subCr: round(subCr, 4),
    subCd: round(subCd, 4),
    subStat: round(subStat, 4),
    subAp: round(subAp, 4),
    gDmg30: round(gDmg30, 4),
    gCd40: round(gCd40, 4),
    gPen24: round(gPen24, 4),
    gShred20: round(gShred20, 4),
    gRes15: round(gRes15, 4),
    gStun30: round(gStun30, 4),
    d5BestZh: d5Info.best5Zh,
    diag: diagnoseCharDilution(ch, sr, { dmg30: gDmg30, cd40: gCd40, pen24: gPen24, shred20: gShred20 }, d5Info, baseExpand)
  });
}

charRowsData.sort((a, b) => {
  const ra = ROLE_SORT[a.wt] || 9;
  const rb = ROLE_SORT[b.wt] || 9;
  if (ra !== rb) return ra - rb;
  return b.selfWeightedDps - a.selfWeightedDps;
});

console.log("[2/5] Computing 24 Meta Squads across 6 Stage Environments...");
const STAGE_KEYS = ["none", "shiyu_33_p1", "shiyu_33_p2", "shiyu_33_p3", "da_veil", "tower_high"];
const stageMatrixRows = [];

for (const item of presetCache) {
  const { preset, optSlots: baseSlots, sim: baseSim } = item;
  const baseDps = baseSim.teamActualDps;
  const baseD5 = DISC_MAIN_ZH[baseSim.slotResults[0].st.d5] || baseSim.slotResults[0].st.d5;
  const perStage = {};
  const discShifts = [];

  for (const sk of STAGE_KEYS) {
    const sEnv = makeEnv({
      stageId: sk,
      bangbooId: preset.bangboo || "b_snap",
      swapConfig:
        sk === "tower_high"
          ? { ...swapMod.makeDefaultSwapConfig("standard"), safetyPolicy: "safe_only", parryCount: 1.0 }
          : undefined
    });
    const flexSlots = baseSlots.map((s) => (s ? { ...deepClone(s), discAuto: true, subAuto: true } : null));
    const sSim = simulateTeamV2(flexSlots, sEnv, CHAR_MAP, SC_WEPS, { skipSoloBaseline: true });
    const sD5Zh = DISC_MAIN_ZH[sSim.slotResults[0].st.d5] || sSim.slotResults[0].st.d5;
    if (sk !== "none" && sk !== "tower_high" && sD5Zh !== baseD5) {
      const shortStage = sk === "shiyu_33_p1" ? "一期" : sk === "shiyu_33_p2" ? "二期" : sk === "shiyu_33_p3" ? "三期" : "危局";
      discShifts.push(`${shortStage}:${baseD5}→${sD5Zh}`);
    }
    const locked = lockSolvedSlotsForMarginal(flexSlots, sSim);
    const fastSim = simulateTeamV2(locked, sEnv, CHAR_MAP, SC_WEPS, { fastMode: true, skipSoloBaseline: true });
    const remDmg30 = evalMarginal(locked, 0, sEnv, (sl) => { sl.slotExtra.dmg = (sl.slotExtra.dmg || 0) + 30; }, fastSim).selfGain;
    const remCd40 = evalMarginal(locked, 0, sEnv, (sl) => { sl.slotExtra.cd = (sl.slotExtra.cd || 0) + 40; }, fastSim).selfGain;
    const remPen24 = evalMarginal(locked, 0, sEnv, (sl) => { sl.slotExtra.pen = (sl.slotExtra.pen || 0) + 24; }, fastSim).selfGain;

    perStage[sk] = {
      dps: Math.round(sSim.teamActualDps),
      gainVsNone: round(sSim.teamActualDps / baseDps - 1, 4),
      d5Zh: sD5Zh,
      remDmg30: round(remDmg30, 4),
      remCd40: round(remCd40, 4),
      remPen24: round(remPen24, 4)
    };
  }

  stageMatrixRows.push({
    id: preset.id,
    cat: preset.cat,
    name: preset.name,
    baseDps: Math.round(baseDps),
    baseD5,
    perStage,
    shiftNote: discShifts.length ? `变阵[${discShifts.join("；")}]` : `全天气锁【${baseD5}】`
  });
}

console.log("[3/5] Computing 24 Meta Squads across 8 Boss Archetypes...");
const bossMatrixRows = [];
for (const item of presetCache) {
  const { preset, optSlots: baseSlots, sim: baseSim } = item;
  const carryCh = CHAR_MAP[baseSlots[0].cid];
  const baseDps = baseSim.teamActualDps;
  const perBoss = {};

  for (const b of BOSS_ARCHETYPES) {
    const bEnv = makeEnv({ bangbooId: preset.bangboo || "b_snap", ...b.buildOverrides(carryCh.eb) });
    const flexSlots = baseSlots.map((s) => (s ? { ...deepClone(s), discAuto: true, subAuto: true } : null));
    const bSim = simulateTeamV2(flexSlots, bEnv, CHAR_MAP, SC_WEPS, { skipSoloBaseline: true });
    perBoss[b.id] = {
      dps: Math.round(bSim.teamActualDps),
      ratio: round(bSim.teamActualDps / baseDps, 4),
      d5Zh: DISC_MAIN_ZH[bSim.slotResults[0].st.d5] || bSim.slotResults[0].st.d5,
      sShare: round(bSim.slotResults[0].bd.sShare, 3)
    };
  }

  bossMatrixRows.push({
    id: preset.id,
    cat: preset.cat,
    name: preset.name,
    baseDps: Math.round(baseDps),
    perBoss
  });
}

console.log("[4/5] Computing 2D DEF Shred × PEN Cross-Dilution Matrix...");
const SHRED_STEPS = [
  { shred: 0.00, label: "0% 减防 (无减防常规队)" },
  { shred: 0.20, label: "20% 减防 (式舆三期 / 叶瞬光1影)" },
  { shred: 0.25, label: "25% 减防 (扳机专武R1)" },
  { shred: 0.40, label: "40% 减防 (满星妮可核心)" },
  { shred: 0.60, label: "60% 减防 (妮可40% + 式舆三期20%)" },
  { shred: 0.65, label: "65% 减防 (妮可40% + 扳机专武25%)" },
  { shred: 0.82, label: "82% 减防 (妮可40% + 叶瞬光2影42%)" },
  { shred: 1.00, label: "100% 满额无视 (命破天生 / 减防叠满)" }
];
const defCrossRows = [];
for (const enemyDef of [953, 1588, 600]) {
  for (const st of SHRED_STEPS) {
    const m0 = exactDefMult(enemyDef, st.shred, 0);
    const mPen24 = exactDefMult(enemyDef, st.shred, 0.24);
    const mPen30 = exactDefMult(enemyDef, st.shred, 0.30);
    const mPen54 = exactDefMult(enemyDef, st.shred, 0.54);
    const mNextShred20 = exactDefMult(enemyDef, st.shred + 0.20, 0);
    const mNextShred20WithPen24 = exactDefMult(enemyDef, st.shred + 0.20, 0.24);
    const gainPen24 = mPen24 / m0 - 1;
    const breakEven = gainPen24 > 0.001 ? 0.30 / gainPen24 - 1.0 : 99.9;
    defCrossRows.push({
      bossTag: enemyDef === 953 ? "标准首领(953防)" : enemyDef === 1588 ? "重甲首领(1588防)" : "脆皮首领(600防)",
      shredLabel: st.label,
      defM0: round(m0, 4),
      defM24: round(mPen24, 4),
      defM30: round(mPen30, 4),
      defM54: round(mPen54, 4),
      gainPen24: round(gainPen24, 4),
      gainPen24WithRina: round(mPen54 / mPen30 - 1, 4),
      gainShred20: round(mNextShred20 / m0 - 1, 4),
      gainShred20AtPen24: round(mNextShred20WithPen24 / mPen24 - 1, 4),
      breakEvenDmg: breakEven > 20 ? "永不反超" : `增伤>${Math.max(0, Math.round(breakEven * 100))}%`
    });
  }
}

console.log("[5/5] Computing Anomaly Snapshot Dilution & 8 Anomaly Bars Disorder Table...");
const ANOMALY_TEST_PAIRINGS = [
  { group: "物理强击·简", desc: "异色标准紊乱 (0染色基准)", slots: ["1261", "1171", "1151"], bb: "b_redmoccus" },
  { group: "物理强击·简", desc: "柚叶后台甜吓 (机制免稀释)", slots: ["1261", "1511", "1411"], bb: "b_bangvolver" },
  { group: "物理强击·简", desc: "凯撒低精通同条分摊", slots: ["1261", "1271", "1071"], bb: "b_officer" },
  { group: "物理强击·简", desc: "双物理击破+支援共条", slots: ["1261", "1351", "1491"], bb: "b_bangvolver" },
  { group: "电感电·柳", desc: "异色冰电双核 (0染色基准)", slots: ["1221", "1091", "1311"], bb: "b_gulliver" },
  { group: "电感电·柳", desc: "同属性丽娜 (+3s感电 vs 染色)", slots: ["1221", "1171", "1211"], bb: "b_plugboo" },
  { group: "电感电·柳", desc: "纯色三电 (染色+DoT覆写)", slots: ["1221", "1251", "1211"], bb: "b_plugboo" },
  { group: "火灼烧·菲欧妮/柏妮思", desc: "异色三异常 (流明高底色)", slots: ["1641", "1581", "1561"], bb: "b_prism" },
  { group: "火灼烧·菲欧妮/柏妮思", desc: "菲欧妮+莱特+露西 (染色+覆写)", slots: ["1641", "1161", "1151"], bb: "b_rocketboo" },
  { group: "火灼烧·菲欧妮/柏妮思", desc: "柏妮思+莱特+露西 (染色+覆写)", slots: ["1171", "1161", "1151"], bb: "b_rocketboo" },
  { group: "以太侵蚀·爱芮/薇薇安", desc: "爱芮异色三异常 (0染色)", slots: ["1501", "1581", "1561"], bb: "b_prism" },
  { group: "以太侵蚀·爱芮/薇薇安", desc: "爱芮+南宫羽+千夏 (双以太共条)", slots: ["1501", "1511", "1491"], bb: "b_resonaboo" },
  { group: "以太侵蚀·爱芮/薇薇安", desc: "爱芮+耀嘉音+妮可 (三以太染色+覆写)", slots: ["1501", "1311", "1031"], bb: "b_resonaboo" },
  { group: "以太侵蚀·爱芮/薇薇安", desc: "薇薇安+耀嘉音+妮可 (三以太染色+覆写)", slots: ["1331", "1311", "1031"], bb: "b_resonaboo" },
  { group: "冰碎冰·普罗米娅/雅", desc: "普罗米娅异色三异常 (0染色)", slots: ["1541", "1581", "1561"], bb: "b_prism" },
  { group: "冰碎冰·普罗米娅/雅", desc: "普罗米娅+莱卡恩+苍角 (三冰染色)", slots: ["1541", "1141", "1131"], bb: "b_sharkboo" },
  { group: "霜灼·雅(独立烈霜条)", desc: "雅+莱卡恩+苍角 (独立条免疫染色!)", slots: ["1091", "1141", "1131"], bb: "b_sharkboo" }
];

const anomDilutionRows = ANOMALY_TEST_PAIRINGS.map((item) => {
  const rawSlots = item.slots.map((cid) => makeDefaultSlot(cid));
  if (rawSlots[1]?.cid === "1311" && rawSlots[2]?.cid && CHAR_MAP[rawSlots[2].cid]?.wt === "Support") {
    rawSlots[1].fourPc = "静听";
    rawSlots[2].fourPc = "月光";
  }
  const aEnv = makeEnv({ bangbooId: item.bb || "b_snap" });
  const optSlots = autoOptimizeTeamDiscs(rawSlots, aEnv, CHAR_MAP, SC_WEPS);
  const sim = simulateTeamV2(optSlots, aEnv, CHAR_MAP, SC_WEPS);
  const sr0 = sim.slotResults[0];
  const tel = sr0.bd.anomTelemetry || {};
  const contribs = sim.ctx?.anomCtx?.barBuildupWeights?.[tel.bar || "Physical"] || [];
  const otherContribs = contribs
    .filter((c) => c.cid !== sr0.ch.id)
    .map((c) => `${c.name}(${(c.share * 100).toFixed(0)}%)`)
    .join(" + ");

  return {
    group: item.group,
    desc: item.desc,
    teamNames: optSlots.map((s) => CHAR_MAP[s.cid].n).join(" + "),
    barZh: tel.barZh || "烈霜",
    otherContribs: otherContribs || (item.slots.includes("1411") ? "柚叶(甜吓免稀释)" : "无同条队友"),
    purity: round(tel.snapshotPurity ?? 1.0, 4),
    dilutionMult: round(tel.dilutionMult ?? 1.0, 4),
    dilutionLoss: round(1.0 - (tel.dilutionMult ?? 1.0), 4),
    underlayZh: tel.underlayBar ? tel.underlayBarZh : "单色无紊乱",
    disorderMvPct: tel.disorderMvPct || 1150,
    overwriteLoss: round(tel.overwriteLossPct ?? 0, 4),
    teamDps: Math.round(sim.teamActualDps)
  };
});

const anomBarSpecRows = Object.values(ANOMALY_BAR_SPECS).map((sp) => ({
  bar: sp.bar,
  zhName: sp.zhName,
  kindZh: sp.kind === "instant" ? "瞬发直爆" : `持续DoT(${sp.tickIntervalSec}s/跳)`,
  baseGauge: sp.baseGauge,
  baseTotalMvPct: Math.round(sp.baseTotalMv * 100),
  debuffZh: sp.debuffZh,
  mv3: Math.round(calcAuthenticDisorderMv(sp.bar, 3.0, 0) * 100),
  mv5: Math.round(calcAuthenticDisorderMv(sp.bar, 5.0, 0) * 100),
  mv7: Math.round(calcAuthenticDisorderMv(sp.bar, 7.0, 0) * 100),
  mv9: Math.round(calcAuthenticDisorderMv(sp.bar, 9.0, 0) * 100),
  mvExt10: ["Fire", "Electric", "Ether", "Ice"].includes(sp.bar)
    ? Math.round(calcAuthenticDisorderMv(sp.bar, 10.0, 3.0) * 100)
    : Math.round(calcAuthenticDisorderMv(sp.bar, 9.5, 0) * 100)
}));

// ============================================================================
// Write Machine-Readable JSON + Comprehensive Markdown Report
// ============================================================================
const reportsDir = path.join(REPO_ROOT, "docs", "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonOut = path.join(reportsDir, "zzz-v3.3-dilution-data.json");
fs.writeFileSync(
  jsonOut,
  JSON.stringify(
    {
      version: "3.3.0",
      charRowsData,
      stageMatrixRows,
      bossMatrixRows,
      defCrossRows,
      anomDilutionRows,
      anomBarSpecRows
    },
    null,
    2
  )
);

const md = [];
md.push("# 绝区零 v3.3 全环境 · 首领 Boss · 全 62 角色乘区伤害稀释与边际收益精算报告");
md.push("");
md.push("> 📐 **计算口径**：由本仓库实轴物理引擎（`dt=0.05s` 合轴状态机 + `anomalyEngine.ts` 真实 `t_rem` 紊乱与同属性染色模型）通过 `npm run calc:dilution` 自动生成。S 级默认 `0+1`、A 级默认 `6+5`、潜能激发 Lv.6、28 有效副词条自动寻优配平。");
md.push("> 📊 **离线 Excel 完整 6 分页表格（含热力色阶与可视化柱状图）**：[`docs/reports/zzz-v3.3-dilution-analysis.xlsx`](./reports/zzz-v3.3-dilution-analysis.xlsx)");
md.push("> 🌐 **在线实时自定义精算（03 伤害分析 → 实时乘区稀释体检）**：<https://h-void.github.io/zzz-dmg-calculator/>");
md.push("");
md.push("## 目录");
md.push("1. [核心结论与七大乘区反稀释铁律](#一核心结论与七大乘区反稀释铁律)");
md.push("2. [全 62 角色入队乘区饱和度、词条边际收益与 5 号盘最优解](#二全-62-角色入队乘区饱和度词条边际收益与-5-号盘最优解)");
md.push("3. [6 大深渊 / 危局 / 高塔天气环境稀释与 5 号盘变阵矩阵](#三6-大深渊--危局--高塔天气环境稀释与-5-号盘变阵矩阵)");
md.push("4. [8 类首领 Boss 防御 / 抗性 / 失衡 / 秽盾 / 积蓄抗压制表](#四8-类首领-boss-防御--抗性--失衡--秽盾--积蓄抗压制表)");
md.push("5. [减防 × 穿透同区反稀释 vs 跨区互稀释二维精确速查表](#五减防--穿透同区反稀释-vs-跨区互稀释二维精确速查表)");
md.push("6. [异常同属性染色稀释、单色覆写丢跳与 t_rem 紊乱底色专项表](#六异常同属性染色稀释单色覆写丢跳与-t_rem-紊乱底色专项表)");
md.push("");

md.push("## 一、核心结论与七大乘区反稀释铁律");
md.push("");
md.push("| 乘区维度 | 核心机制 / 饱和触发源 | 实测边际收益变化 | 反稀释破局与配装铁律 |");
md.push("| :--- | :--- | :--- | :--- |");
md.push("| **1. 攻击 / 贯穿基础区** | 嘉音/柚叶(+1200攻)、千夏(+1050攻)、卢西娅(+900贯穿) | `+1` 大攻词条从 2.2% 降至 1.2%~1.5% | 5/6号盘【局外攻击%】可吃静听/专武等局内攻%二次放大；**耀妮队 40% 减防压低穿透后，5 号【攻击%】常反超属伤与穿透** |");
md.push("| **2. 双暴区 vs 二次撕裂** | 山大王4(+30%CD)、嘉音(+25%CD)、霜寒(+10%CD) | `+40%` 暴伤由单人 +22% 跌至入队 `+9.3%~11.4%` | 常规暴击超 100% 即 0 收益；**唯独【锋御·克拉蕾】暴击上限 200% 触发二次撕裂平方收益** |");
md.push("| **3. 增伤乘区** | 莱特(+75%)、静听4+月光4(+42%)、琉音/照(+40%) | `+30%` 增伤普遍被稀释至 **`+8.5%~13.5%`** | 全游头号拥挤乘区！无减防队伍入队增伤常达 `2.6×~3.6×`，5 号盘换【穿透 24%】通常净赚 `1.5%~4.8%` |");
md.push("| **4. 防御区（减防 × 穿透）** | 妮可 40% 减防、式舆三期 20% 减防 × 丽娜/5 号穿透盘 | 0 减防下 24% 穿透 `+15.1%`；60% 减防下骤降至 `+8.4%` | **同区单堆递增反稀释，减防 × 穿透混搭必互稀释**；命破天生 100% 无视防御与秽盾（穿透/减防恒 0%） |");
md.push("| **5. 抗性乘区** | 顺弱点首领(-20%抗→1.20×) vs 逆抗首领(+20%抗→0.80×) | `+15%` 减抗：顺弱 `+12.5%` → 逆抗 **`+18.8%`** | 跨属性硬打 `+20%` 逆抗首领时，减抗含金量暴涨 **+50%**，是最稀缺的破防乘区 |");
md.push("| **6. 失衡易伤与实轴覆盖** | 5800 韧性疯狗首领 + 8s 短失衡窗口大幅压缩 `sShare` | 纯失衡拐收益缩水 `25%~35%` | 短失衡环境优先上【以太帷幕（叶瞬光常驻 2.05×）】、【扳机常驻 35% 易伤】或【无击破三异常/双支援轮椅】 |");
md.push("| **7. 异常染色 & 紊乱底色** | 低精通同色队友分摊积蓄条；单色 DoT 高频覆写 | 三同色染色亏损 **`-14%~-23%`**，覆写再丢 **`45%~62%`** | 避开低精通同色工具人（**柚叶甜吓**与**雅独立霜灼条**免疫染色）；优先选流明/感电/侵蚀/灼烧作高倍率紊乱底色 |");
md.push("");

md.push("## 二、全 62 角色入队乘区饱和度、词条边际收益与 5 号盘最优解");
md.push("");
md.push("| 角色 | 配置 | 定位 | 属性 | 代表配队 | 最优配装 (4+2 / 4·5·6) | 局内主属 | 膨胀× | 双暴/精通区× | 增伤× | 防御× | 抗性× | 失衡× | +1暴击 | +1暴伤 | +1主属% | +30%增伤 | +24%穿透 | +20%减防 | 稀释诊断与 5 号盘最优解 |");
md.push("| :--- | :---: | :---: | :---: | :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |");
for (const c of charRowsData) {
  md.push(
    `| **${c.name}** | ${c.rankCfg} | ${c.wtZh} | ${c.elemZh} | ${c.teamLabel} | ${c.setCombo} (${c.bestDiscZh}) | ${fmtInt(c.combatBase)} | ${c.baseExpand.toFixed(2)}× | ${c.effCritOrApMult.toFixed(2)}× | ${c.dmgM.toFixed(2)}× | ${c.defM.toFixed(3)}× | ${c.resM.toFixed(2)}× | ${c.stunMult.toFixed(2)}× | ${fmtSignedPct(c.subCr)} | ${fmtSignedPct(c.subCd)} | ${fmtSignedPct(c.subStat)} | ${fmtSignedPct(c.gDmg30)} | ${fmtSignedPct(c.gPen24)} | ${fmtSignedPct(c.gShred20)} | ${c.diag} |`
  );
}
md.push("");

md.push("## 三、6 大深渊 / 危局 / 高塔天气环境稀释与 5 号盘变阵矩阵");
md.push("");
md.push("| 体系分类 | 预设队伍 | 无Buff基准DPS | 基准5号盘 | 式舆一期(异常) | 式舆二期(锋御/减抗) | 式舆三期(强攻/减防) | 危局帷幕(命破/易伤) | 高塔高压(安全轴) | 三期后+24%穿透余量 | 跨天气 5 号盘变阵 |");
md.push("| :--- | :--- | ---: | :---: | ---: | ---: | ---: | ---: | ---: | ---: | :--- |");
for (const s of stageMatrixRows) {
  md.push(
    `| ${s.cat} | **${s.name}** | ${fmtInt(s.baseDps)} | ${s.baseD5} | ${fmtSignedPct(s.perStage.shiyu_33_p1.gainVsNone)} | ${fmtSignedPct(s.perStage.shiyu_33_p2.gainVsNone)} | ${fmtSignedPct(s.perStage.shiyu_33_p3.gainVsNone)} | ${fmtSignedPct(s.perStage.da_veil.gainVsNone)} | ${fmtSignedPct(s.perStage.tower_high.gainVsNone)} | ${fmtSignedPct(s.perStage.shiyu_33_p3.remPen24)} | ${s.shiftNote} |`
  );
}
md.push("");

md.push("## 四、8 类首领 Boss 防御 / 抗性 / 失衡 / 秽盾 / 积蓄抗压制表");
md.push("");
md.push("> 说明：以 **B1 标准首领（953防 / 0%抗 / 4200韧 / 12s失衡）= 100.0%** 为基准，衡量各强队在不同高压 Boss 机制下的真实输出保持率。");
md.push("");
md.push("| 体系分类 | 预设队伍 | B1标准DPS | B2顺弱(-20%抗) | B3逆抗(+20%抗) | B4重甲(1588防) | B5脆皮(600防/200%易伤) | B6疯狗(5800韧/8s) | B7秽盾(0.75x) | B8防异常(1.4x) | 失衡占比(标准→疯狗) |");
md.push("| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |");
for (const b of bossMatrixRows) {
  md.push(
    `| ${b.cat} | **${b.name}** | ${fmtInt(b.baseDps)} | ${fmtPct(b.perBoss.b2_weak.ratio)} | ${fmtPct(b.perBoss.b3_res.ratio)} | ${fmtPct(b.perBoss.b4_highdef.ratio)} | ${fmtPct(b.perBoss.b5_fragile.ratio)} | ${fmtPct(b.perBoss.b6_aggro.ratio)} | ${fmtPct(b.perBoss.b7_miasma.ratio)} | ${fmtPct(b.perBoss.b8_anomres.ratio)} | ${fmtPct(b.perBoss.b1_std.sShare, 0)} → ${fmtPct(b.perBoss.b6_aggro.sShare, 0)} |`
  );
}
md.push("");

md.push("## 五、减防 × 穿透同区反稀释 vs 跨区互稀释二维精确速查表");
md.push("");
md.push("| 首领防御档位 | 队伍已有减防 / 无视防御 | 0穿乘区 | 24%穿乘区 | 30%穿乘区 | 54%穿乘区 | 0穿换24%穿透净增幅 | 有丽娜30%穿再叠24%穿 | 0穿续叠+20%减防 | 有24%穿续叠+20%减防 | 24%穿反超30%属伤临界点 |");
md.push("| :--- | :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | :---: |");
for (const r of defCrossRows) {
  md.push(
    `| ${r.bossTag} | ${r.shredLabel} | ${r.defM0.toFixed(3)}× | ${r.defM24.toFixed(3)}× | ${r.defM30.toFixed(3)}× | ${r.defM54.toFixed(3)}× | **${fmtSignedPct(r.gainPen24)}** | ${fmtSignedPct(r.gainPen24WithRina)} | ${fmtSignedPct(r.gainShred20)} | ${fmtSignedPct(r.gainShred20AtPen24)} | ${r.breakEvenDmg} |`
  );
}
md.push("");

md.push("## 六、异常同属性染色稀释、单色覆写丢跳与 `t_rem` 紊乱底色专项表");
md.push("");
md.push("### 6.1 17 组异常配队同条染色与单色覆写实测");
md.push("");
md.push("| 组别 | 测试场景 | 三人配队 | 异常条 | 同条分摊队友 | 主C积蓄纯度 | 快照稀释系数 | 染色亏损 | 紊乱底色 | 紊乱倍率 | 单色DoT覆写丢跳 | 全队实测DPS |");
md.push("| :--- | :--- | :--- | :---: | :--- | ---: | ---: | ---: | :---: | ---: | ---: | ---: |");
for (const a of anomDilutionRows) {
  md.push(
    `| ${a.group} | ${a.desc} | **${a.teamNames}** | ${a.barZh} | ${a.otherContribs} | ${fmtPct(a.purity)} | ${a.dilutionMult.toFixed(3)}× | ${fmtPct(a.dilutionLoss)} | ${a.underlayZh} | ${a.disorderMvPct}% | ${fmtPct(a.overwriteLoss)} | ${fmtInt(a.teamDps)} |`
  );
}
md.push("");

md.push("### 6.2 全 8 种异常条基础倍率与不同剩余时间 (`t_rem`) 真实紊乱引爆倍率");
md.push("");
md.push("| 异常条 | 中文名 | 结算形态 | 积蓄阈值 | 打满总倍率 | 附带次级 Debuff | 剩3s引爆 | 剩5s引爆 | 剩7s标准 | 剩9s瞬爆 | +3s延长满额 |");
md.push("| :--- | :---: | :---: | ---: | ---: | :--- | ---: | ---: | ---: | ---: | ---: |");
for (const sp of anomBarSpecRows) {
  md.push(
    `| \`${sp.bar}\` | **${sp.zhName}** | ${sp.kindZh} | ${sp.baseGauge} | ${sp.baseTotalMvPct}% | ${sp.debuffZh} | ${sp.mv3}% | ${sp.mv5}% | ${sp.mv7}% | ${sp.mv9}% | ${sp.mvExt10}% |`
  );
}
md.push("");

const mdOut = path.join(REPO_ROOT, "docs", "dilution-analysis-v3.3.md");
fs.writeFileSync(mdOut, md.join("\n"));

console.log(`Done! Generated:\n  - ${path.relative(REPO_ROOT, mdOut)}\n  - ${path.relative(REPO_ROOT, jsonOut)}`);

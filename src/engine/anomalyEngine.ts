// ============================================================================
// ZZZ v3.3 Authentic Anomaly, Disorder (t_rem), Buildup Dilution & Secondary Debuff Engine
// ============================================================================
// Models all 8 Anomaly Bars in Zenless Zone Zero:
//   - Physical (强击 Assault):   713% Instant + 10s Flinch (畏缩: +7.5% Daze taken)
//   - Fire     (灼烧 Burn):      50% * 20 ticks (0.5s, 10s = 1000%) [+3s w/ Burnice AA]
//   - Ice      (碎冰 Shatter):   500% Instant + 10s Frostbite (霜寒: +10% CRIT DMG taken) [+3s w/ Promia AA]
//   - Frost    (霜灼·破):         1500% Instant + 10s Frostbite (+10% CD) + 10s Icefire (冰焰: +20% Buildup)
//   - Electric (感电 Shock):     125% * 10 ticks (1.0s, 10s = 1250%) [+3s w/ Rina AA]
//   - Ether    (侵蚀 Corruption):62.5% * 20 ticks (0.5s, 10s = 1250%) [+3s w/ Vivian/Aria AA]
//   - Wind     (风化涡流):        57.5% * 20 ticks (0.5s, 10s = 1150%) + Contamination
//   - Lumiflux (流明耀化):        135% * 10 ticks (1.0s, 10s = 1350%) + Refringe
// ============================================================================

export type AnomalyBarCode =
  | "Physical"
  | "Fire"
  | "Ice"
  | "Frost"
  | "Electric"
  | "Ether"
  | "Wind"
  | "Lumiflux";

export interface AnomalyBarSpec {
  bar: AnomalyBarCode;
  zhName: string;
  debuffZh: string;
  kind: "instant" | "dot";
  baseTotalMv: number;      // In 100% ATK units (e.g. 7.13 = 713%, 12.50 = 1250%)
  tickIntervalSec: number;  // 0 for instant; 0.5 or 1.0 for DoT
  tickMv: number;           // Per-tick MV for DoT, or per-second Disorder bonus tick for Instant
  disorderTickSec: number;  // Tick step used by Disorder settlement (1.0s or 0.5s)
  disorderTickMv: number;   // MV added per remaining tick in Disorder (4.50 + floor(t_rem / step) * disorderTickMv)
  baseDurSec: number;       // Base anomaly / secondary debuff duration (10.0s)
  baseGauge: number;        // Base anomaly buildup threshold (Physical=1200, others=1000)
}

/**
 * Reference Disorder MV (1150% ATK = 11.50, corresponding to 7s remaining Burn / standard Disorder baseline)
 * used to preserve calibration with character mvScale while introducing exact per-element physics.
 */
export const REF_DISORDER_MV = 11.50;
export const DISORDER_BASE_MV = 4.50;
export const DISORDER_ICD_SEC = 3.0;

export const ANOMALY_BAR_SPECS: Record<AnomalyBarCode, AnomalyBarSpec> = {
  Physical: {
    bar: "Physical",
    zhName: "强击",
    debuffZh: "畏缩(+7.5%失衡值)",
    kind: "instant",
    baseTotalMv: 7.13,
    tickIntervalSec: 0,
    tickMv: 0,
    disorderTickSec: 1.0,
    disorderTickMv: 0.075, // 450% + floor(t_rem) * 7.5%
    baseDurSec: 10.0,
    baseGauge: 1200
  },
  Fire: {
    bar: "Fire",
    zhName: "灼烧",
    debuffZh: "灼烧持续跳伤",
    kind: "dot",
    baseTotalMv: 10.00,
    tickIntervalSec: 0.5,
    tickMv: 0.50,
    disorderTickSec: 0.5,
    disorderTickMv: 0.50, // 450% + floor(t_rem / 0.5) * 50%
    baseDurSec: 10.0,
    baseGauge: 1000
  },
  Ice: {
    bar: "Ice",
    zhName: "碎冰",
    debuffZh: "霜寒(+10%暴伤)",
    kind: "instant",
    baseTotalMv: 5.00,
    tickIntervalSec: 0,
    tickMv: 0,
    disorderTickSec: 1.0,
    disorderTickMv: 0.075, // 450% + floor(t_rem) * 7.5%
    baseDurSec: 10.0,
    baseGauge: 1000
  },
  Frost: {
    bar: "Frost",
    zhName: "霜灼·破",
    debuffZh: "霜寒(+10%暴伤)·冰焰(+20%积蓄)",
    kind: "instant",
    baseTotalMv: 15.00,
    tickIntervalSec: 0,
    tickMv: 0,
    disorderTickSec: 1.0,
    disorderTickMv: 0.075, // 450% + floor(t_rem) * 7.5%
    baseDurSec: 10.0,
    baseGauge: 1000
  },
  Electric: {
    bar: "Electric",
    zhName: "感电",
    debuffZh: "感电间歇跳伤",
    kind: "dot",
    baseTotalMv: 12.50,
    tickIntervalSec: 1.0,
    tickMv: 1.25,
    disorderTickSec: 1.0,
    disorderTickMv: 1.25, // 450% + floor(t_rem) * 125%
    baseDurSec: 10.0,
    baseGauge: 1000
  },
  Ether: {
    bar: "Ether",
    zhName: "侵蚀",
    debuffZh: "侵蚀受击跳伤",
    kind: "dot",
    baseTotalMv: 12.50,
    tickIntervalSec: 0.5,
    tickMv: 0.625,
    disorderTickSec: 0.5,
    disorderTickMv: 0.625, // 450% + floor(t_rem / 0.5) * 62.5%
    baseDurSec: 10.0,
    baseGauge: 1000
  },
  Wind: {
    bar: "Wind",
    zhName: "风化涡流",
    debuffZh: "污染·风蚀减抗",
    kind: "dot",
    baseTotalMv: 11.50,
    tickIntervalSec: 0.5,
    tickMv: 0.575,
    disorderTickSec: 0.5,
    disorderTickMv: 0.575, // 450% + floor(t_rem / 0.5) * 57.5%
    baseDurSec: 10.0,
    baseGauge: 1000
  },
  Lumiflux: {
    bar: "Lumiflux",
    zhName: "流明耀化",
    debuffZh: "虚芒·折光易伤",
    kind: "dot",
    baseTotalMv: 13.50,
    tickIntervalSec: 1.0,
    tickMv: 1.35,
    disorderTickSec: 1.0,
    disorderTickMv: 1.35, // 450% + floor(t_rem) * 135%
    baseDurSec: 10.0,
    baseGauge: 1000
  }
};

export function resolveAgentAnomalyBar(ch: any): AnomalyBarCode {
  const raw = String(ch?.anomBar || ch?.eb || "Physical");
  if (raw in ANOMALY_BAR_SPECS) return raw as AnomalyBarCode;
  return "Physical";
}

/**
 * Computes element-scoped Anomaly duration extensions (+3s) from active squad Additional Abilities:
 * - Burnice (1171) AA  -> Fire Burn +3.0s
 * - Rina (1211) AA     -> Electric Shock +3.0s
 * - Vivian (1331) / Aria (1501) AA -> Ether Corruption +3.0s
 * - Promia (1541) AA   -> Ice Frostbite +3.0s
 */
export function computeBarDurationExtMap(activeMembers: any[]): Record<AnomalyBarCode, number> {
  const ext: Record<AnomalyBarCode, number> = {
    Physical: 0,
    Fire: 0,
    Ice: 0,
    Frost: 0,
    Electric: 0,
    Ether: 0,
    Wind: 0,
    Lumiflux: 0
  };
  for (const m of activeMembers || []) {
    if (!m?.aa?.active) continue;
    const cid = m.ch?.id;
    if (cid === "1171") ext.Fire = Math.max(ext.Fire, 3.0);
    else if (cid === "1211") ext.Electric = Math.max(ext.Electric, 3.0);
    else if (cid === "1331" || cid === "1501") ext.Ether = Math.max(ext.Ether, 3.0);
    else if (cid === "1541") ext.Ice = Math.max(ext.Ice, 3.0);
  }
  return ext;
}

/**
 * Exact ZZZ Disorder MV (in 100% ATK units) when detonating an active underlay anomaly
 * with `tRemSec` seconds remaining on the enemy.
 */
export function calcAuthenticDisorderMv(
  underlayBar: AnomalyBarCode,
  tRemSec: number,
  durExtSec = 0
): number {
  const spec = ANOMALY_BAR_SPECS[underlayBar] || ANOMALY_BAR_SPECS.Physical;
  const maxDur = spec.baseDurSec + Math.max(0, durExtSec);
  const clampedRem = Math.max(0, Math.min(maxDur, tRemSec));
  const step = Math.max(0.25, spec.disorderTickSec || 1.0);
  const ticksLeft = Math.floor((clampedRem + 1e-6) / step);
  return DISORDER_BASE_MV + ticksLeft * spec.disorderTickMv;
}

/**
 * Computes effective own-bar Anomaly MV & multiplier relative to the character's baseline bar:
 * - Accounts for scoped +3s DoT tick extensions (e.g. Burnice +3s Fire = +6 ticks = 1.30x; Rina +3s Shock = 1.30x).
 * - Accounts for Solo DoT Early-Overwrite tick loss when a DoT anomaly (Fire/Electric/Ether/Wind) is re-triggered
 *   before its 10s duration expires WITHOUT a Disorder partner (`!canDisorder`), whereas Instant anomalies
 *   (Physical Assault 713%, Ice Shatter 500%, Frostburn 1500%) deal 100% of their MV immediately with zero overwrite loss!
 */
export function evalOwnAnomalyRealization(
  bar: AnomalyBarCode,
  durExtSec: number,
  amFactor: number,
  canDisorder: boolean,
  cid?: string
): {
  spec: AnomalyBarSpec;
  fullAnomMv: number;
  realizedAnomMv: number;
  anomRealizationMult: number;
  overwriteLossPct: number;
} {
  const spec = ANOMALY_BAR_SPECS[bar] || ANOMALY_BAR_SPECS.Physical;
  const totalDur = spec.baseDurSec + Math.max(0, durExtSec);
  const fullAnomMv =
    spec.kind === "dot" && spec.tickIntervalSec > 0
      ? Math.round(totalDur / spec.tickIntervalSec) * spec.tickMv
      : spec.baseTotalMv;

  // Instant anomalies (Assault, Shatter, Frostburn) frontload 100% MV at frame 0 -> zero overwrite loss
  if (spec.kind === "instant" || cid === "1581") {
    return {
      spec,
      fullAnomMv,
      realizedAnomMv: fullAnomMv,
      anomRealizationMult: 1.0,
      overwriteLossPct: 0
    };
  }

  // In a Disorder team, remaining DoT ticks are settled into Disorder rather than lost!
  // With +3s scoped duration extension, natural ticks + Disorder capture the extended tick pool.
  if (canDisorder) {
    const extGain = 1.0 + (fullAnomMv / spec.baseTotalMv - 1.0) * 0.55;
    return {
      spec,
      fullAnomMv,
      realizedAnomMv: spec.baseTotalMv * extGain,
      anomRealizationMult: extGain,
      overwriteLossPct: 0
    };
  }

  // Solo / Mono-element DoT without Disorder: re-applying DoT every `procIntervalSec` overwrites unfinished ticks!
  const estProcIntervalSec = Math.max(4.5, 8.2 / Math.max(0.65, amFactor));
  if (estProcIntervalSec >= totalDur) {
    const extMult = fullAnomMv / spec.baseTotalMv;
    return {
      spec,
      fullAnomMv,
      realizedAnomMv: fullAnomMv,
      anomRealizationMult: extMult,
      overwriteLossPct: 0
    };
  }

  const ticksRealized = Math.max(1, Math.floor((estProcIntervalSec + 1e-6) / spec.tickIntervalSec));
  const realizedAnomMv = ticksRealized * spec.tickMv;
  const overwriteLossPct = Math.max(0, 1.0 - realizedAnomMv / fullAnomMv);
  // Relative to character's baseline bar MV
  const anomRealizationMult = Math.max(0.58, realizedAnomMv / spec.baseTotalMv);

  return {
    spec,
    fullAnomMv,
    realizedAnomMv,
    anomRealizationMult,
    overwriteLossPct
  };
}

export interface SlotAnomalyTelemetry {
  bar: AnomalyBarCode;
  barZh: string;
  kind: "instant" | "dot";
  baseAnomMvPct: number;       // e.g. 713, 1250, 1500
  realizedAnomMvPct: number;
  anomRealizationMult: number;
  overwriteLossPct: number;
  underlayBar: AnomalyBarCode | null;
  underlayBarZh: string;
  effRemSec: number;
  disorderMvPct: number;       // e.g. 1325, 1450, 503
  disorderScaleMult: number;   // Normalized against REF_DISORDER_MV (11.50)
  icdClampMult: number;        // <= 1.0 if 3.0s Disorder ICD is exceeded
  snapshotPurity: number;      // 1.0 = zero teammate dilution; < 1.0 = diluted by low-AP same-bar teammate
  dilutionMult: number;        // Effective multiplier on own Anomaly proc due to contributor snapshot blend
  dilutedBy: string | null;
}

export interface TeamAnomalyContext {
  barDurExt: Record<AnomalyBarCode, number>;
  barBuildupWeights: Record<string, Array<{ cid: string; name: string; share: number; power: number }>>;
  frostbiteUptime: number; // +10% CRIT DMG taken (Ice / Frost)
  flinchUptime: number;    // +7.5% Daze taken (Physical)
  icefireUptime: number;   // +20% Anomaly Buildup (Frost - Miyabi)
  estDisordersPerCycle: number;
  icdClamped: boolean;
  icdClampMult: number;
  perChar: Record<string, {
    bar: AnomalyBarCode;
    snapshotPurity: number;
    dilutionMult: number;
    dilutedBy: string | null;
    primaryUnderlayBar: AnomalyBarCode | null;
    underlayDisorderMv: number;
    underlayEffRemSec: number;
    disorderScaleMult: number;
  }>;
  diagnostics: string[];
}

/**
 * Evaluates squad-wide Anomaly buildup pools, same-element contributor snapshot dilution ("染色稀释"),
 * secondary Anomaly debuff uptimes (Frostbite +10% CD, Flinch +7.5% Daze, Icefire +20% Buildup),
 * authentic underlay Disorder `t_rem` MVs, and 3.0s Disorder ICD constraints.
 */
export function computeTeamAnomalyContext(
  activeMembers: any[],
  env: any,
  qaSwap: any,
  freedomBluesElems: Set<string>,
  bangboo: any
): TeamAnomalyContext {
  const barDurExt = computeBarDurationExtMap(activeMembers);
  const diagnostics: string[] = [];

  // 1. Estimate each member's raw Anomaly Buildup output & per-point Anomaly Damage Power (ATK * AP)
  const memberBuildup: Array<{
    m: any;
    cid: string;
    bar: AnomalyBarCode;
    buildupUnits: number;
    nonDiluting: boolean;
    anomPower: number;
  }> = [];

  const barTotals: Record<string, number> = {};
  const barDilutingTotals: Record<string, number> = {};

  for (const m of activeMembers || []) {
    const ch = m.ch;
    const st = m.sheet;
    if (!ch || !st) continue;
    const cid = ch.id;
    const bar = resolveAgentAnomalyBar(ch);

    // Base rotation buildup output by role & kit
    const roleBase =
      ch.wt === "Anomaly"
        ? (cid === "1091" ? 1.35 : 1.25)
        : cid === "1411"
        ? 0.92 // Yuzuha off-field dyed buildup
        : cid === "1511"
        ? 0.95 // Nangong Yu Anomaly-Stunner
        : cid === "1031" || cid === "1131" || cid === "1271"
        ? 0.55
        : ch.wt === "Support" || ch.wt === "Stun" || ch.wt === "Defense"
        ? 0.42
        : 0.48;

    const am = (st.init_am || ch.am || 100) + (st.eff?.c_am_flat || 0);
    const freeB = freedomBluesElems?.has(ch.eb) ? 0.20 : 0;
    const bbB = bangboo?.elemBuildup?.[ch.eb] || 0;
    const aaB = m.aa?.active
      ? cid === "1171"
        ? 0.45
        : cid === "1221"
        ? 0.35
        : cid === "1261" || cid === "1541"
        ? 0.30
        : cid === "1511" || cid === "1561"
        ? 0.15
        : 0
      : 0;
    const buildupMult = (am / 115.0) * (1.0 + (st.eff?.buildup || 0) + aaB + freeB + bbB) * (m.uptime ?? 1.0);
    const buildupUnits = Math.max(0.05, roleBase * buildupMult);

    // Ukinami Yuzuha (1411) off-field Sweet Scare buildup explicitly does NOT dilute teammate Anomaly snapshots!
    const nonDiluting = cid === "1411";

    // Approximate per-unit Anomaly snapshot power: ATK * AP * (1 + elem/anom dmg) * JaneCrit
    const estAtk = (st.init_atk || 2400) * (1.0 + (ch.prof?.self_catk || 0) + (st.f4?.c_atk || 0) + (st.eff?.c_atk || 0));
    const estAp = (st.init_ap || 120) + (ch.prof?.self_ap || 0) + (st.f4?.c_ap || 0) + (st.eff?.c_ap || 0);
    const janeBoost = ch.prof?.jane_crit ? 1.68 : 1.0;
    const anomPower = Math.max(100, estAtk * (estAp / 100.0) * janeBoost);

    memberBuildup.push({ m, cid, bar, buildupUnits, nonDiluting, anomPower });
    barTotals[bar] = (barTotals[bar] || 0) + buildupUnits;
    if (!nonDiluting) {
      barDilutingTotals[bar] = (barDilutingTotals[bar] || 0) + buildupUnits;
    }
  }

  // Also include Bangboo elemental buildup (Bangboo buildup in ZZZ 1.0+ does NOT dilute agent AP snapshot!)
  if (bangboo?.elemBuildup) {
    for (const [eb, val] of Object.entries(bangboo.elemBuildup)) {
      if ((Number(val) || 0) > 0 && eb in ANOMALY_BAR_SPECS) {
        barTotals[eb] = (barTotals[eb] || 0) + Number(val) * 0.85;
      }
    }
  }

  // 2. Secondary Anomaly Debuff Uptimes (Frostbite +10% CD, Flinch +7.5% Daze, Icefire +20% Buildup)
  const anomResScale = Math.max(0.5, Number(env?.anomThresholdScale) || 1.0);
  const iceTotal = (barTotals.Ice || 0) + (barTotals.Frost || 0);
  const frostTotal = barTotals.Frost || 0;
  const physTotal = barTotals.Physical || 0;

  const frostbiteDur = 10.0 + Math.max(barDurExt.Ice, barDurExt.Frost);
  const frostbiteUptime =
    iceTotal > 0.05
      ? Math.min(0.96, Math.max(0.18, (iceTotal / (1.05 * anomResScale)) * (frostbiteDur / 14.5)))
      : 0;
  const flinchUptime =
    physTotal > 0.05
      ? Math.min(0.95, Math.max(0.16, (physTotal / (1.22 * anomResScale)) * (10.0 / 14.5)))
      : 0;
  const icefireUptime =
    frostTotal > 0.05
      ? Math.min(0.96, Math.max(0.35, (frostTotal / (1.00 * anomResScale)) * (10.0 / 13.5)))
      : 0;

  // 3. Disorder Frequency & 3.0s Disorder ICD Check
  const distinctActiveBars = Object.entries(barTotals).filter(([, v]) => v >= 0.35);
  const cycleSec = Math.max(8.0, Number(qaSwap?.cycleSec) || 18.0);
  let estDisordersPerCycle = 0;
  if (distinctActiveBars.length >= 2) {
    const sortedBars = distinctActiveBars.map(([, v]) => v).sort((a, b) => b - a);
    const secondAndRest = sortedBars.slice(1).reduce((s, v) => s + v, 0);
    estDisordersPerCycle = Math.min(sortedBars[0] * 1.45, secondAndRest * 1.35) / anomResScale;
  }

  // Maximum physically possible Disorders in `cycleSec` given the hard 3.0s ICD on same target
  const maxIcdDisorders = Math.max(1.0, cycleSec / (DISORDER_ICD_SEC + 0.25));
  let icdClamped = false;
  let icdClampMult = 1.0;

  // Check real timeline ICD collisions if timeline is coupled, otherwise check continuous rate
  const tlIcdHits = Number(qaSwap?.timelineDisorderIcdHits) || 0;
  if (tlIcdHits > 0) {
    icdClamped = true;
    icdClampMult = Math.max(0.65, 1.0 - tlIcdHits * 0.16);
    diagnostics.push(
      `[紊乱3.0s冷却吞伤] 当前实轴存在 ${tlIcdHits} 次 <3.0s 连续异色异常引爆，触发绝区零【3.0秒紊乱内置CD】导致紊乱结算被吞，建议拉开双异常爆发间隔`
    );
  } else if (estDisordersPerCycle > maxIcdDisorders) {
    icdClamped = true;
    icdClampMult = Math.max(0.72, maxIcdDisorders / estDisordersPerCycle);
    diagnostics.push(
      `[紊乱3.0s冷却上限] 当前高频积蓄预计每轮触发 ${estDisordersPerCycle.toFixed(1)} 次紊乱，超出 ${cycleSec.toFixed(1)}s 实轴的 3.0s 内置CD物理上限(${maxIcdDisorders.toFixed(1)}次)，溢出部分已按真实冷却折算`
    );
  }

  // 4. Per-Bar Contributor Snapshot Dilution ("同属性积蓄染色稀释") & Underlay Disorder Pairing
  const barBuildupWeights: Record<string, Array<{ cid: string; name: string; share: number; power: number }>> = {};
  for (const item of memberBuildup) {
    if (item.nonDiluting) continue;
    const tot = Math.max(1e-6, barDilutingTotals[item.bar] || item.buildupUnits);
    if (!barBuildupWeights[item.bar]) barBuildupWeights[item.bar] = [];
    barBuildupWeights[item.bar].push({
      cid: item.cid,
      name: item.m.ch.n,
      share: item.buildupUnits / tot,
      power: item.anomPower
    });
  }

  const swapDisBonus = Number(qaSwap?.disorderBonusSec) || 0;
  const baseRemSec = Math.max(0, Number(env?.disorderSec ?? 7.0) + swapDisBonus);

  const perChar: TeamAnomalyContext["perChar"] = {};
  for (const item of memberBuildup) {
    const { cid, bar, anomPower, m } = item;
    const contributors = barBuildupWeights[bar] || [];

    // Compute Snapshot Dilution Factor for `cid` on `bar`
    let snapshotPurity = 1.0;
    let dilutionMult = 1.0;
    let dilutedBy: string | null = null;

    if (!item.nonDiluting && contributors.length >= 2) {
      let blendedPower = 0;
      let worstMate: { name: string; share: number; ratio: number } | null = null;
      for (const c of contributors) {
        blendedPower += c.share * c.power;
        if (c.cid === cid) {
          snapshotPurity = c.share;
        } else {
          const ratio = c.power / Math.max(1, anomPower);
          if (ratio < 0.72 && c.share >= 0.14 && (!worstMate || c.share * (1 - ratio) > worstMate.share * (1 - worstMate.ratio))) {
            worstMate = { name: c.name, share: c.share, ratio };
          }
        }
      }
      // Clamp dilutionMult to realistic range [0.74, 1.08] (Only penalize when diluted by lower-AP teammate;
      // if a low-AP support is boosted by a high-AP carry on the same bar, don't double-count carry's share)
      const rawRatio = blendedPower / Math.max(1, anomPower);
      dilutionMult = rawRatio < 1.0 ? Math.max(0.74, rawRatio) : 1.0;

      if (worstMate && dilutionMult < 0.92 && (m.ch.wt === "Anomaly" || m.ch.prof?.anom_split)) {
        dilutedBy = worstMate.name;
        if (m.idx === 0 || m.ch.wt === "Anomaly") {
          diagnostics.push(
            `[同属性染色稀释] ${m.ch.n}(${ANOMALY_BAR_SPECS[bar].zhName}) 与低精通队友【${worstMate.name}】共用异常条，${worstMate.name}分摊约 ${(worstMate.share * 100).toFixed(0)}% 积蓄导致异常快照稀释 -${((1 - dilutionMult) * 100).toFixed(1)}%`
          );
        }
      }
    }

    // Compute Weighted Underlay Disorder MV across all OTHER active bars (`uBar !== bar`)
    let otherWeightSum = 0;
    let weightedUnderlayMv = 0;
    let weightedRemSec = 0;
    let primaryUnderlayBar: AnomalyBarCode | null = null;
    let bestOtherVal = 0;

    for (const [uBarStr, uVal] of Object.entries(barTotals)) {
      const uBar = uBarStr as AnomalyBarCode;
      if (uBar === bar || uVal < 0.15) continue;
      const uExt = barDurExt[uBar] || 0;
      const uRem = Math.min(10.0 + uExt, Math.max(0, baseRemSec + uExt));
      const uMv = calcAuthenticDisorderMv(uBar, uRem, uExt);
      otherWeightSum += uVal;
      weightedUnderlayMv += uVal * uMv;
      weightedRemSec += uVal * uRem;
      if (uVal > bestOtherVal) {
        bestOtherVal = uVal;
        primaryUnderlayBar = uBar;
      }
    }

    // Override with exact timeline average Disorder MV / t_rem if coupled timeline produced Disorder events!
    let underlayDisorderMv = otherWeightSum > 0 ? weightedUnderlayMv / otherWeightSum : calcAuthenticDisorderMv(bar, baseRemSec, barDurExt[bar]);
    let underlayEffRemSec = otherWeightSum > 0 ? weightedRemSec / otherWeightSum : baseRemSec;

    if (qaSwap?.timelineDisorderAvgMv && qaSwap.timelineDisorderCount > 0 && otherWeightSum > 0) {
      underlayDisorderMv = qaSwap.timelineDisorderAvgMv;
      underlayEffRemSec = qaSwap.timelineDisorderAvgRemSec ?? underlayEffRemSec;
    }

    // Polarity Disorder agents (Yanagi 1221, Alice 1401, Nangong Yu 1511) blend self-bar Polarity Disorder with teammate underlay Disorder
    const isPolAgent = cid === "1221" || cid === "1401" || cid === "1511";
    let effectiveDisMv = underlayDisorderMv;
    if (isPolAgent) {
      const ownExt = barDurExt[bar] || 0;
      const ownPolMv = calcAuthenticDisorderMv(bar, Math.min(10 + ownExt, baseRemSec + ownExt), ownExt);
      effectiveDisMv = otherWeightSum > 0 ? 0.50 * ownPolMv + 0.50 * underlayDisorderMv : ownPolMv;
    }

    // Normalize Disorder MV against REF_DISORDER_MV (11.50 = 1150% ATK) with damped physical sensitivity
    // Instant underlays (Ice/Physical 502.5%) have lower single-pop MV (~0.44x raw) but allow zero-loss instant procs & faster Disorder cadence,
    // yielding ~0.72x effective Disorder output vs DoT underlays (1325%~1700% -> 1.15x~1.48x)!
    const rawDisRatio = effectiveDisMv / REF_DISORDER_MV;
    const disorderScaleMult =
      rawDisRatio >= 1.0
        ? Math.min(1.48, 1.0 + (rawDisRatio - 1.0) * 0.78)
        : Math.max(0.68, 0.42 + 0.58 * rawDisRatio);

    perChar[cid] = {
      bar,
      snapshotPurity,
      dilutionMult,
      dilutedBy,
      primaryUnderlayBar,
      underlayDisorderMv: effectiveDisMv,
      underlayEffRemSec,
      disorderScaleMult: disorderScaleMult * icdClampMult
    };
  }

  return {
    barDurExt,
    barBuildupWeights,
    frostbiteUptime,
    flinchUptime,
    icefireUptime,
    estDisordersPerCycle,
    icdClamped,
    icdClampMult,
    perChar,
    diagnostics
  };
}

// --- MODULE: swap_and_timeline.js ---
// ============================================================================
// ZZZ v3.3 Authentic 8-Dimension Swap-Cancel ("合轴") Physics Engine
// & Discrete-Time (dt = 0.05s) Multi-Track Action Timeline State Machine
// ============================================================================

import {
  ANOMALY_BAR_SPECS,
  DISORDER_ICD_SEC,
  type AnomalyBarCode,
  calcAuthenticDisorderMv,
  computeBarDurationExtMap,
  resolveAgentAnomalyBar
} from "./anomalyEngine";

export const SWAP_PRESETS: any = {
  casual: {
    id: "casual",
    name: "站场轮切 (顺序出招)",
    tag: "新手保底",
    commitOverlap: 0.12,
    safetyPolicy: "safe_only",
    protectChanneled: true,
    qaMult: 0.70,
    qaManual: null,
    buffWeave: 0.68,
    chainTech: "triple_std",
    parryCount: 1.0,
    cancelDensity: 0.15,
    anomPrestack: "none",
    decibelSync: "sequential",
    desc: "等当前角色动作完全收刀后再切人，不打闪A振刀与手动取消连携，零操作压力但轴长偏慢、短轴拐易断档"
  },
  safe_tower: {
    id: "safe_tower",
    name: "安全合轴 (高塔无伤)",
    tag: "高压爬塔",
    commitOverlap: 0.66,
    safetyPolicy: "safe_only",
    protectChanneled: true,
    qaMult: 0.96,
    qaManual: null,
    buffWeave: 0.88,
    chainTech: "double_carry",
    parryCount: 2.5,
    cancelDensity: 0.55,
    anomPrestack: "standard",
    decibelSync: "aligned",
    desc: "仅在强化E无敌帧、快支入场、招架支援与终结技保护帧内合轴，杜绝普攻裸露驻场挨双打，兼顾DPS与零战损"
  },
  standard: {
    id: "standard",
    name: "主流合轴 (快支乒乓)",
    tag: "实战标准",
    commitOverlap: 0.74,
    safetyPolicy: "dodge_cancel",
    protectChanneled: true,
    qaMult: 1.00,
    qaManual: null,
    buffWeave: 0.92,
    chainTech: "auto",
    parryCount: 2.5,
    cancelDensity: 0.60,
    anomPrestack: "standard",
    decibelSync: "aligned",
    desc: "熟练利用主C脱手帧切支援续杯，裸露动作垫步闪避继承0.35s无敌帧离场，失衡期打标准双连携"
  },
  advanced_parry: {
    id: "advanced_parry",
    name: "进阶合轴 (双连携+闪A振刀)",
    tag: "深度手法",
    commitOverlap: 0.88,
    safetyPolicy: "dodge_cancel",
    protectChanneled: true,
    qaMult: 1.14,
    qaManual: null,
    buffWeave: 0.97,
    chainTech: "double_carry",
    parryCount: 4.0,
    cancelDensity: 0.82,
    anomPrestack: "prestack_99",
    decibelSync: "aligned",
    desc: "黄光积极输入[闪避->普攻->支援]打出闪A振刀双反大幅提速破韧，失衡手动取消双连携，异常队控99%压条瞬爆紊乱"
  },
  sweaty: {
    id: "sweaty",
    name: "极限竞速 (零帧贪刀压条)",
    tag: "竞速上限",
    commitOverlap: 1.00,
    safetyPolicy: "aggressive",
    protectChanneled: true,
    qaMult: 1.25,
    qaManual: null,
    buffWeave: 1.00,
    chainTech: "triple_carry",
    parryCount: 5.0,
    cancelDensity: 1.00,
    anomPrestack: "prestack_99",
    decibelSync: "double_ult",
    desc: "所有可脱手动作出手瞬间零帧秒切形成同屏双打/三打，锁死短轴减防与多连携，式舆/危局竞速极限上限(高压环境有裸露受击风险)"
  }
};

export const ARCHETYPE_LABELS: any = {
  burst_commit: "长动画脱手爆发",
  off_field: "后台驻场协同",
  quick_swap: "速切短轴拐/破韧",
  onfield_cancel: "站场目押/闪A取消",
  channeled_lock: "持续引导禁早切"
};

export const SAFETY_LABELS: any = {
  safe_iframe: "无敌帧安全脱手",
  assist_protected: "快支/招架保护脱手",
  unsafe_exposed: "无保护裸露脱手(危险合轴)"
};

export function makeDefaultSwapConfig(presetId = "standard") {
  const p = SWAP_PRESETS[presetId] || SWAP_PRESETS.standard;
  return {
    preset: p.id,
    commitOverlap: p.commitOverlap,
    safetyPolicy: p.safetyPolicy,
    protectChanneled: p.protectChanneled,
    qaMult: p.qaMult,
    qaManual: p.qaManual,
    buffWeave: p.buffWeave,
    chainTech: p.chainTech,
    parryCount: p.parryCount,
    cancelDensity: p.cancelDensity,
    anomPrestack: p.anomPrestack,
    decibelSync: p.decibelSync
  };
}

export function getCharSwapProfile(ch: any) {
  if (ch && ch.swapProfile) return ch.swapProfile;
  const wt = ch ? ch.wt : "Attack";
  return {
    archetype: wt === "Support" || wt === "Stun" || wt === "Defense" ? "quick_swap" : "burst_commit",
    commitSec: 1.25,
    safety: "assist_protected",
    channelPenalty: 0.0,
    cancelGain: 0.06,
    qaOut: wt === "Support" || wt === "Defense" ? 1.5 : wt === "Stun" ? 0.6 : 0.2,
    qaCoef: 0.04,
    heavySpeed: 0.80,
    note: "自定义角色通用合轴动作模组"
  };
}

/**
 * Evaluates all 8 ZZZ Swap-Cancel dimensions and computes cycle physics:
 * - Separates Boss Stun Interval (which governs realStunShare) from Continuous Rotation Cycle (`cycleSec`)
 *   for 0-Stunner teams so Anomaly / Wheelchair / Veil squads are not double-penalized by fake stun-wait idle time.
 * - Supports Hugo (1291) M0~M1 Totalize early-stun settlement & 25% Daze refund rapid cycle.
 * - Couples seamlessly with the `dt = 0.05s` Timeline State Machine when `timelineOverride` is provided.
 */
export function evalSwapCancelEngine(
  activeMembers: any[],
  swapCfgInput: any,
  env: any = {},
  bangboo: any = null,
  timelineOverride: any = null
) {
  const n = activeMembers.length;
  const sc = swapCfgInput || makeDefaultSwapConfig(env.swapMode || "standard");

  if (n === 0) {
    return {
      mode: sc.preset || "standard",
      config: sc,
      totalQA: 0, astralStacks: 0, astralDmg: 0, pingPong: false,
      nicoleCov: 1.0, rinaCovM0: 1.0, hormoneCov: 1.0, protoCov: 0, swingCov: 1.0, moonlightCov: 1.0,
      nicoleCovByCid: null, rinaCovByCid: null, hormoneCovByCid: null, frostbiteCovByCid: null,
      chainCountCarry: 0, chainShareMult: [1], ultShareMult: [1],
      parryCount: 0, assistEarned: 0, assistSpent: 0, assistNet: 0,
      seqCycleSec: 20.0, outStunSec: 10.0, inStunSec: 10.0, bossStunIntervalSec: 20.0,
      savedOverlapSec: 0, cycleSec: 20.0,
      cycleSpeedup: 1.0, exposedSec: 0, interruptPenalty: 1.0, channelTruncLoss: [0],
      disorderBonusSec: 0, disorderIcdWarning: false, ultsPerCycle: [1],
      realStunShare: {}, slotActionMult: [1], weightMult: [1], diagnostics: []
    };
  }

  const profiles = activeMembers.map((m) => getCharSwapProfile(m.ch));
  const isDpsRole = (wt: string) => wt === "Attack" || wt === "Anomaly" || wt === "Rupture" || wt === "Armorer";
  const dpsIndices = activeMembers.map((m, i) => (isDpsRole(m.ch.wt) ? i : -1)).filter((i) => i >= 0);
  const mainIdx = dpsIndices.length >= 1 ? dpsIndices[0] : 0;

  if (n === 1) {
    const p0 = profiles[0];
    const cancelBonus = (p0.cancelGain || 0.06) * ((sc.cancelDensity ?? 0.6) - 0.55);
    const soloCycle = Math.max(12.0, 20.0 * (1.0 - 0.06 * (sc.cancelDensity ?? 0.6)));
    return {
      mode: sc.preset || "standard",
      config: sc,
      totalQA: 0, astralStacks: 0, astralDmg: 0, pingPong: false,
      nicoleCov: 1.0, rinaCovM0: 1.0, hormoneCov: 0.75, protoCov: sc.parryCount > 0 ? 0.5 : 0, swingCov: 0.85, moonlightCov: 1.0,
      nicoleCovByCid: null, rinaCovByCid: null, hormoneCovByCid: null, frostbiteCovByCid: null,
      chainCountCarry: 1, chainShareMult: [1.0], ultShareMult: [1.0],
      parryCount: 0, assistEarned: 3, assistSpent: 0, assistNet: 3,
      seqCycleSec: 20.0, outStunSec: soloCycle * 0.65, inStunSec: soloCycle * 0.35, bossStunIntervalSec: 32.0,
      savedOverlapSec: 20.0 - soloCycle, cycleSec: soloCycle,
      cycleSpeedup: 20.0 / soloCycle, exposedSec: 0, interruptPenalty: 1.0, channelTruncLoss: [0],
      disorderBonusSec: 0, disorderIcdWarning: false, ultsPerCycle: [1.0],
      realStunShare: { [activeMembers[0].ch.id]: 0.35 },
      slotActionMult: [Math.max(0.88, 1.0 + cancelBonus)],
      weightMult: [1.0],
      diagnostics: ["单人站场基准：无队友切人合轴与快速支援，仅受角色自身预输入/后摇取消影响"]
    };
  }

  const diagnostics: string[] = [];
  const hasAstra = activeMembers.some((m) => m.ch.id === "1311");
  const hasDialyn = activeMembers.some((m) => m.ch.id === "1481");
  const hasNorm = activeMembers.some((m) => m.ch.id === "1571");
  const hasJuFufu = activeMembers.some((m) => m.ch.id === "1391");
  const hugoMember = activeMembers.find((m) => m.ch.id === "1291");
  const hasStun = activeMembers.some((m) => m.ch.wt === "Stun");
  const hasDefAssist = activeMembers.some((m) => m.ch.defAssist);
  const hasPhysFlinch = activeMembers.some((m) => (m.ch.anomBar || m.ch.eb) === "Physical");
  const hasShielder =
    activeMembers.some((m) => getCharSwapProfile(m.ch).shieldProtectsSwap) || !!(bangboo && bangboo.safeHeal);

  // 1. Quick Assist Ping-Pong & Astral Voice 4pc Stacking
  const perMemberQA = activeMembers.map((m, i) => {
    const cid = m.ch.id;
    let base = profiles[i].qaOut;
    if (base === undefined) base = m.ch.wt === "Support" || m.ch.wt === "Defense" ? 1.4 : m.ch.wt === "Stun" ? 0.5 : 0.2;
    if (cid === "1311" && m.m >= 2) base += 0.6;
    if (cid === "1411" && m.m >= 2) base += 0.4;
    return base;
  });
  const qaGenerators = perMemberQA.filter((v) => v >= 1.25).length;
  const pingPong = qaGenerators >= 2 && (hasAstra || sc.commitOverlap >= 0.45);
  const parryQA = hasDefAssist ? Math.min(2.2, sc.parryCount * 0.42) : 0;
  const rawQASum = 0.55 + perMemberQA.reduce((a, b) => a + b, 0) + (pingPong ? 0.55 : 0) + parryQA * 0.35;
  const totalQA =
    sc.qaManual !== null && sc.qaManual !== undefined && sc.qaManual >= 0
      ? Number(sc.qaManual)
      : Math.max(0, rawQASum * (sc.qaMult ?? 1.0));
  const astralStacks = Math.min(3.0, Math.max(0.4, totalQA * 0.58));
  const astralDmg = (astralStacks / 3.0) * 0.24;

  // 2. Commit Animation Frame Overlap, Safety Policy & Channeled Truncation
  let rawOverlapPool = 0;
  let exposedSec = 0;
  let dodgeOverheadSec = 0;
  const channelTruncLoss = new Array(n).fill(0);

  activeMembers.forEach((m, i) => {
    const p = profiles[i];
    const swapsPerCycle = i === mainIdx ? 2.6 : 2.2;
    let effOverlapRate = sc.commitOverlap;

    if ((p.channelPenalty || 0) > 0) {
      if (sc.protectChanneled !== false) {
        effOverlapRate *= 0.48;
      } else if (sc.commitOverlap > 0.55) {
        const trunc = (sc.commitOverlap - 0.55) * (p.channelPenalty * 1.45);
        channelTruncLoss[i] = Math.min(0.28, trunc);
        diagnostics.push(
          `[断招警告] ${m.ch.n} 属于持续引导型技能，当前强行早切合轴导致约 ${(channelTruncLoss[i] * 100).toFixed(1)}% 尾段倍率丢失（建议开启「保护持续引导技收尾」或延后切人帧）`
        );
      }
    }

    const baseCommit = (p.commitSec || 1.2) * swapsPerCycle;
    if (p.safety === "unsafe_exposed") {
      if (sc.safetyPolicy === "safe_only") {
        effOverlapRate *= 0.35;
      } else if (sc.safetyPolicy === "dodge_cancel") {
        effOverlapRate *= 0.78;
        dodgeOverheadSec += 0.18 * swapsPerCycle * sc.commitOverlap;
        exposedSec += baseCommit * effOverlapRate * 0.12;
      } else {
        exposedSec += baseCommit * effOverlapRate * 0.72;
      }
    } else if (p.safety === "assist_protected") {
      if (sc.safetyPolicy === "aggressive") exposedSec += baseCommit * effOverlapRate * 0.18;
    }

    rawOverlapPool += baseCommit * effOverlapRate;
  });

  // High-aggro interruption risk when doing exposed unsafe swap-cancels
  const highAggro = !!(env.highAggro || env.stageBuffs?.highAggro);
  const aggroIntensity = env.enemyAggro !== undefined ? Number(env.enemyAggro) : highAggro ? 0.85 : 0.12;
  let interruptPenalty = 1.0;
  if (exposedSec > 0.6 && aggroIntensity > 0.05) {
    const shieldMitigation = hasShielder ? 0.55 : 1.0;
    const loss = Math.min(0.18, exposedSec * 0.022 * aggroIntensity * shieldMitigation);
    if (highAggro || aggroIntensity >= 0.4) {
      interruptPenalty = 1.0 - loss;
      diagnostics.push(
        `[危险合轴风险] 当前激进裸露驻场约 ${exposedSec.toFixed(1)}s/轮，在高压高攻击欲环境下预计产生 ${(loss * 100).toFixed(1)}% 后台受击硬直/掉人折损（切换为「安全合轴」或「闪避垫步」可消除）`
      );
    }
  }

  // 3. Short-Window Buff Weaving (Nicole 3.5s, Rina M0 5.5s, Hormone Punk 10s, Proto Punk 10s, Swing Jazz 12s)
  const weave = Math.max(0.4, Math.min(1.0, sc.buffWeave ?? 0.90));
  const nicoleBase = 0.62 + 0.34 * weave + (hasAstra ? 0.05 : 0) + (pingPong ? 0.03 : 0);
  const nicoleCov = Math.min(1.0, Math.max(0.55, nicoleBase));
  const rinaCovM0 = Math.min(1.0, Math.max(0.60, 0.66 + 0.32 * weave + (totalQA >= 3.5 ? 0.04 : 0)));
  const hormoneCov = Math.min(1.0, 0.68 + 0.28 * weave);
  const protoCov =
    hasDefAssist && sc.parryCount >= 1.5
      ? Math.min(1.0, 0.55 + sc.parryCount * 0.14)
      : sc.parryCount > 0
      ? 0.45
      : 0.15;
  const swingCov = Math.min(1.0, 0.72 + 0.24 * weave);
  const moonlightCov = 1.0;

  // 4. Stun Chain Cancel Tech
  let effChainTech = sc.chainTech || "auto";
  const carryId = activeMembers[mainIdx]?.ch?.id;
  const canTripleCarry = hasAstra || hasDialyn || hasNorm || carryId === "1321" || carryId === "1551";
  if (effChainTech === "auto") {
    if (!hasStun && !hasAstra) effChainTech = "double_carry";
    else if (canTripleCarry && sc.commitOverlap >= 0.80) effChainTech = "triple_carry";
    else effChainTech = "double_carry";
  }

  let chainCountCarry = 1.0;
  let chainTimeOverhead = 3.2;
  if (effChainTech === "single_skip") {
    chainCountCarry = 1.0;
    chainTimeOverhead = 1.6;
  } else if (effChainTech === "triple_std") {
    chainCountCarry = 1.0;
    chainTimeOverhead = 3.8;
  } else if (effChainTech === "double_carry") {
    chainCountCarry = 1.85;
    const minHeavy = Math.min(...profiles.filter((_, j) => j !== mainIdx).map((p) => p.heavySpeed || 0.80));
    chainTimeOverhead = 2.5 + minHeavy;
  } else if (effChainTech === "triple_carry") {
    chainCountCarry = canTripleCarry ? 2.55 : 2.05;
    chainTimeOverhead = canTripleCarry ? 3.5 : 3.2;
    if (!canTripleCarry) {
      diagnostics.push(`[连携提示] 当前队伍无耀嘉音/伊芙琳/琉音/诺姆强转连携机制，极限手动取消最高稳定打出主C双连携+补刀`);
    }
  }

  const chainShareMult = activeMembers.map((m, i) => {
    if (i === mainIdx) return 0.72 + 0.28 * chainCountCarry * (profiles[i].chainSpec ? 1.06 : 1.0);
    return effChainTech === "triple_std" ? 1.05 : 0.78;
  });

  // 5. Dodge-Counter + Defensive Assist Simultaneous Parry ("闪A振刀")
  const effParry = hasDefAssist ? Math.max(0, Number(sc.parryCount) || 0) : 0;
  if (!hasDefAssist && (sc.parryCount || 0) >= 2) {
    diagnostics.push(`[招架提示] 当前全队均为【回避支援】角色（无招架支援振刀），黄光将触发时停回避支援而非双反弹刀削韧`);
  }

  // 6. Independent Decibel Economy (1.4+ 3000/4000 cap) & Ultimate Frequency
  const ultsPerCycle = activeMembers.map((m, i) => {
    const p = profiles[i];
    let decibelGen =
      (i === mainIdx ? 2350 : 1950) +
      effParry * 115 +
      (chainCountCarry - 1) * (i === mainIdx ? 220 : 90) +
      (p.decibelBonus || 0) +
      (hasJuFufu ? 300 : 0);
    if (sc.decibelSync === "double_ult") decibelGen *= 1.16;
    else if (sc.decibelSync === "sequential") decibelGen *= 0.90;
    let ults = Math.min(hasJuFufu || m.ch.id === "1551" ? 1.65 : 1.35, Math.max(0.60, decibelGen / 2850));
    if (i === mainIdx && hasDialyn && isDpsRole(m.ch.wt)) ults += 0.42;
    return ults;
  });

  const ultShareMult = activeMembers.map((_, i) => 0.75 + 0.25 * ultsPerCycle[i]);

  // Assist Point Loop
  const totalChains = effChainTech === "single_skip" ? 1 : effChainTech === "triple_carry" ? 3.5 : 2.5;
  const avgUltSum = ultsPerCycle.reduce((a, b) => a + b, 0);
  const assistEarned = Math.min(9.0, totalChains * 1.0 + avgUltSum * 1.35);
  const costPerParry = activeMembers.some((m) => m.ch.wt === "Defense" || m.ch.id === "1161") ? 0.85 : 1.15;
  const assistSpent = effParry * costPerParry;
  const assistNet = assistEarned - assistSpent;
  if (assistNet < -0.6) {
    diagnostics.push(
      `[支援点透支警告] 每轮振刀消耗约 ${assistSpent.toFixed(1)} 点 > 连携/大招回复 ${assistEarned.toFixed(1)} 点，长线第2轮后将出现红光无法招架，建议下调振刀次数或穿插大招回点`
    );
  }

  // 7. Cycle Timing Physics: Decouples Boss Stun Interval from Continuous Kit Rotation when stunCount === 0!
  const stunCount = activeMembers.filter((m) => m.ch.wt === "Stun").length;
  const dazeThreshold = Math.max(1500, Number(env.dazeThreshold) || 4200);
  const flinchBoost = hasPhysFlinch ? 1.055 : 1.0;
  const baseDazeRate =
    (stunCount >= 2 ? 410 : stunCount === 1 ? 320 : 195) * (1 + (bangboo?.dazeBonus || 0)) * flinchBoost;
  const parryDazeGain = effParry * (stunCount >= 1 ? 310 : 240);

  // Hugo (1291) Totalize mechanic: ends stun early for massive Totalize burst and refunds 25% Daze into next bar!
  const hugoEarlyTotalize = !!(hugoMember && stunCount >= 1);
  const hugoRefundFactor = hugoEarlyTotalize ? (hugoMember.m >= 2 ? 0.88 : 0.78) : 1.0;
  const rawOutSec = Math.max(4.4, ((dazeThreshold - parryDazeGain) * hugoRefundFactor) / Math.max(120, baseDazeRate));

  const stunExt =
    activeMembers.reduce((s, _, idx) => s + (profiles[idx].stunExtSec || 0), 0) +
    (activeMembers.some((m) => ["1471", "1511", "1571", "1621"].includes(m.ch.id)) ? 1.5 : 0);
  const rawBossStunDur = Math.max(7.0, (Number(env.stunDurationBase) || 12.0) + stunExt);
  const effectiveBossInStunSec = hugoEarlyTotalize
    ? Math.max(6.2, rawBossStunDur * (hugoMember.m >= 2 ? 0.76 : 0.62))
    : rawBossStunDur;

  let seqCycleSec: number;
  let savedOverlapSec: number;
  let outStunSec: number;
  let inStunSec: number;
  let cycleSec: number;
  let bossStunIntervalSec: number;
  let stunTimeRatio: number;

  if (stunCount >= 1) {
    // Stun-driven team: rotation cycle is synchronized with stunning the Boss
    seqCycleSec = rawOutSec + effectiveBossInStunSec + chainTimeOverhead * 0.45;
    const maxCompress = seqCycleSec * 0.34;
    savedOverlapSec = Math.max(0, Math.min(maxCompress, rawOverlapPool * 0.52 - dodgeOverheadSec));
    outStunSec = Math.max(4.0, rawOutSec - savedOverlapSec * 0.72);
    inStunSec = effectiveBossInStunSec;
    cycleSec = Math.max(11.0, outStunSec + inStunSec - savedOverlapSec * 0.28);
    bossStunIntervalSec = cycleSec;
    stunTimeRatio = Math.min(0.82, inStunSec / cycleSec);
  } else {
    // 0-Stunner Continuous Rotation (Dual/Triple Anomaly, Wheelchair, Ether Veil, Dual-Attack):
    // Boss Stun happens asynchronously every `bossStunIntervalSec` (governing `realStunShare`),
    // while the squad continuously executes & compresses its ~20.6s skill/disorder kit rotation!
    const bossOutSec = Math.max(5.2, rawOutSec - Math.min(rawOutSec * 0.26, rawOverlapPool * 0.34));
    bossStunIntervalSec = bossOutSec + effectiveBossInStunSec;
    stunTimeRatio = Math.min(0.68, Math.max(0.18, effectiveBossInStunSec / bossStunIntervalSec));

    const stunDrivenSeq = rawOutSec + effectiveBossInStunSec + chainTimeOverhead * 0.45;
    seqCycleSec = Math.min(stunDrivenSeq, 20.6 + chainTimeOverhead * 0.22);
    const maxCompress = seqCycleSec * 0.32;
    savedOverlapSec = Math.max(0, Math.min(maxCompress, rawOverlapPool * 0.52 - dodgeOverheadSec));
    cycleSec = Math.max(12.2, seqCycleSec - savedOverlapSec);
    inStunSec = Number((cycleSec * stunTimeRatio).toFixed(2));
    outStunSec = Number(Math.max(4.0, cycleSec - inStunSec).toFixed(2));
  }

  const stdBaselineSec =
    stunCount >= 1
      ? rawOutSec + effectiveBossInStunSec - Math.min(seqCycleSec * 0.34, n * 2.1 * 0.74 * 0.42)
      : 20.6 + chainTimeOverhead * 0.22 - n * 2.1 * 0.74 * 0.42;
  const cycleSpeedup = Math.max(0.75, Math.min(1.45, stdBaselineSec / cycleSec));

  // Real Stun Share derived from Boss Stun time ratio & burst concentration
  const realStunShare: Record<string, number> = {};
  activeMembers.forEach((m, i) => {
    const profShare = m.ch.prof?.stun_share || 0.50;
    const conc =
      (m.ch.id === "1291" ? 1.52 : i === mainIdx ? 1.28 : 1.05) *
      (sc.decibelSync === "sequential" ? 0.92 : 1.04);
    const physShare = Math.min(0.94, Math.max(0.20, stunTimeRatio * conc));
    realStunShare[m.ch.id] = 0.45 * profShare + 0.55 * physShare;
  });

  // 8. Anomaly 99% Pre-Stack & 3.0s Disorder ICD Check
  const anomCount = activeMembers.filter((m) => m.ch.wt === "Anomaly").length;
  let disorderBonusSec = 0;
  let disorderIcdWarning = false;
  if (sc.anomPrestack === "prestack_99") {
    disorderBonusSec = 2.0;
    if (anomCount >= 3 && cycleSec < 14.5) {
      disorderIcdWarning = true;
      diagnostics.push(
        `[紊乱3s冷却提示] 三异常极限合轴轴长已压缩至 ${cycleSec.toFixed(1)}s，请注意绝区零存在【3.0秒紊乱内置CD】，切勿在3秒内连续引爆同目标第2次紊乱以免吞结算`
      );
    }
  } else if (sc.anomPrestack === "none") {
    disorderBonusSec = -1.5;
  }

  // Per-Slot Action Multiplier
  const slotActionMult = activeMembers.map((m, i) => {
    const p = profiles[i];
    const qaIn = Math.min(1.0, Math.max(0, (totalQA - perMemberQA[i] * 0.50) / 3.6));
    const qaBonus = (p.qaCoef || 0.035) * qaIn;
    const cancelBonus = (p.cancelGain || 0.06) * ((sc.cancelDensity ?? 0.60) - 0.50) * 1.15;
    const chainSh = m.ch.prof?.shares?.chain || 0.08;
    const chainGain =
      i === mainIdx && (hasStun || hasAstra) ? (chainCountCarry - 1.55) * 0.22 * chainSh : 0;
    const overlapActionGain = (sc.commitOverlap - 0.60) * 0.085 * ((p.commitSec || 1.25) / 1.5);
    const truncMult = 1.0 - (channelTruncLoss[i] || 0);
    return Math.max(0.78, (1.0 + qaBonus + cancelBonus + chainGain + overlapActionGain) * truncMult * interruptPenalty);
  });

  const weightMult = activeMembers.map((m, i) => {
    if (i === mainIdx) return 1.0;
    const p = profiles[i];
    const fit = Math.min(1.2, (p.commitSec || 1.2) / 1.45);
    return Math.max(0.78, 0.86 + 0.24 * sc.commitOverlap * fit + (pingPong && m.ch.id === "1031" ? 0.04 : 0));
  });

  // Coupled Timeline Direct State-Machine Override!
  if (timelineOverride && timelineOverride.active && timelineOverride.cycleSec > 4) {
    cycleSec = timelineOverride.cycleSec;
    const tlQA = timelineOverride.totalQA ?? totalQA;
    const tlAstralStacks =
      timelineOverride.astralStacksAvg !== undefined && timelineOverride.astralStacksAvg !== null
        ? timelineOverride.astralStacksAvg
        : Math.min(3.0, Math.max(0.4, tlQA * 0.58));
    const tlAstralDmg = (tlAstralStacks / 3.0) * 0.24;

    const coupledActionMult = slotActionMult.map((v, idx) => {
      const cid = activeMembers[idx]?.ch?.id;
      const baseRemovedTrunc = v / Math.max(0.1, 1 - (channelTruncLoss[idx] || 0));
      const mvVol =
        timelineOverride.mvVolumeByCid?.[cid] !== undefined
          ? timelineOverride.mvVolumeByCid[cid]
          : (1 - (timelineOverride.truncLoss?.[idx] || 0)) *
            (timelineOverride.resourceScaleByCid?.[cid] ?? 1.0);
      return Math.max(0.12, baseRemovedTrunc * mvVol);
    });

    const tlDiags = Array.isArray(timelineOverride.tlDiagnostics) ? timelineOverride.tlDiagnostics : [];

    return {
      mode: "timeline_exact",
      config: sc,
      totalQA: tlQA,
      astralStacks: tlAstralStacks,
      astralDmg: tlAstralDmg,
      pingPong,
      nicoleCov: timelineOverride.nicoleCov ?? nicoleCov,
      rinaCovM0: timelineOverride.rinaCov ?? rinaCovM0,
      hormoneCov: timelineOverride.hormoneCov ?? hormoneCov,
      protoCov: timelineOverride.protoCov ?? protoCov,
      swingCov: timelineOverride.swingCov ?? swingCov,
      moonlightCov: timelineOverride.moonlightCov ?? moonlightCov,
      nicoleCovByCid: timelineOverride.nicoleCovByCid || null,
      rinaCovByCid: timelineOverride.rinaCovByCid || null,
      hormoneCovByCid: timelineOverride.hormoneCovByCid || null,
      frostbiteCovByCid: timelineOverride.frostbiteCovByCid || null,
      chainCountCarry: timelineOverride.chainCountCarry ?? chainCountCarry,
      chainShareMult,
      ultShareMult,
      parryCount: timelineOverride.parryCount ?? effParry,
      assistEarned: timelineOverride.assistEarned ?? assistEarned,
      assistSpent: timelineOverride.assistSpent ?? assistSpent,
      assistNet: timelineOverride.assistNet ?? assistNet,
      seqCycleSec: timelineOverride.seqCycleSec || seqCycleSec,
      outStunSec: timelineOverride.outStunSec || outStunSec,
      inStunSec: timelineOverride.inStunSec || inStunSec,
      bossStunIntervalSec: timelineOverride.bossStunIntervalSec || bossStunIntervalSec,
      savedOverlapSec: timelineOverride.savedSec ?? savedOverlapSec,
      cycleSec,
      cycleSpeedup: Math.max(0.65, Math.min(1.60, stdBaselineSec / cycleSec)),
      exposedSec: timelineOverride.exposedSec ?? exposedSec,
      interruptPenalty,
      channelTruncLoss: timelineOverride.truncLoss || channelTruncLoss,
      disorderBonusSec,
      disorderIcdWarning: disorderIcdWarning || (timelineOverride.disorderIcdHits || 0) > 0,
      timelineDisorderCount: timelineOverride.disorderCount || 0,
      timelineDisorderAvgMv: timelineOverride.disorderAvgMv || null,
      timelineDisorderAvgRemSec: timelineOverride.disorderAvgRemSec || null,
      timelineDisorderIcdHits: timelineOverride.disorderIcdHits || 0,
      ultsPerCycle: timelineOverride.ultsPerCycle || ultsPerCycle,
      realStunShare: timelineOverride.stunShareByCid || realStunShare,
      slotActionMult: coupledActionMult,
      weightMult,
      timelineSharesByCid: timelineOverride.sharesByCid || null,
      diagnostics: [
        ...diagnostics,
        ...tlDiags,
        `[实轴状态机耦合] 当前由 0.05s 离散帧状态机(${timelineOverride.blockCount}个动作块，总轴长 ${cycleSec.toFixed(1)}s)实时驱动能量/喧响/失衡条/紊乱剩余秒数与短轴拐积分覆盖`
      ]
    };
  }

  return {
    mode: sc.preset || "custom",
    config: sc,
    totalQA, astralStacks, astralDmg, pingPong,
    nicoleCov, rinaCovM0, hormoneCov, protoCov, swingCov, moonlightCov,
    nicoleCovByCid: null, rinaCovByCid: null, hormoneCovByCid: null, frostbiteCovByCid: null,
    chainCountCarry, chainShareMult, ultShareMult,
    parryCount: effParry, assistEarned, assistSpent, assistNet,
    seqCycleSec, outStunSec, inStunSec, bossStunIntervalSec, savedOverlapSec, cycleSec,
    cycleSpeedup, exposedSec, interruptPenalty, channelTruncLoss,
    disorderBonusSec, disorderIcdWarning, ultsPerCycle,
    realStunShare, slotActionMult, weightMult,
    timelineSharesByCid: null,
    diagnostics
  };
}

// ============================================================================
// Interactive Action Move Templates & Archetype-Aware Smart Timeline Generator
// ============================================================================

export const SPECIFIC_CHAR_MOVES: any = {
  "1091": [
    { key: "miy_c3", label: "三蓄·霜月拔刀斩", cat: "basic", totalDur: 2.65, minSwap: 0.50, mv: 4200, daze: 180, anom: 520, energyCost: 0, energyGen: 10, decibelGen: 320, safety: "safe_iframe" },
    { key: "miy_ex", label: "强化E·落霜二连", cat: "ex", totalDur: 1.45, minSwap: 0.85, mv: 1650, daze: 160, anom: 280, energyCost: 40, energyGen: 0, decibelGen: 340, safety: "safe_iframe" },
    { key: "miy_b5", label: "五段普攻回霜寒", cat: "basic", totalDur: 2.10, minSwap: 1.55, mv: 1200, daze: 130, anom: 240, energyCost: 0, energyGen: 18, decibelGen: 260, safety: "unsafe_exposed" },
    { key: "miy_ult", label: "终结技·残雪拔刀", cat: "ult", totalDur: 2.40, minSwap: 1.90, mv: 4800, daze: 280, anom: 460, energyCost: 0, energyGen: 14, decibelGen: 0, safety: "safe_iframe" }
  ],
  "1221": [
    { key: "yan_ex", label: "强化E·月华流转极性紊乱", cat: "ex", totalDur: 1.55, minSwap: 0.52, mv: 2150, daze: 155, anom: 410, energyCost: 40, energyGen: 0, decibelGen: 350, triggersPolarityDisorder: true, safety: "safe_iframe", buffTag: { id: "yanagi", label: "柳·森罗万象15s", dur: 15.0 } },
    { key: "yan_b", label: "上下弦月电伤连斩", cat: "basic", totalDur: 1.85, minSwap: 0.95, mv: 1680, daze: 135, anom: 330, energyCost: 0, energyGen: 16, decibelGen: 270, safety: "assist_protected" },
    { key: "yan_ult", label: "终结技·雷影天诛极性紊乱", cat: "ult", totalDur: 2.25, minSwap: 1.50, mv: 4150, daze: 240, anom: 480, energyCost: 0, energyGen: 12, decibelGen: 0, triggersPolarityDisorder: true, safety: "safe_iframe" }
  ],
  "1171": [
    { key: "bur_ex", label: "强化E·双枪混合烈焰满挂火", cat: "ex", totalDur: 1.80, minSwap: 0.55, mv: 1920, daze: 150, anom: 460, energyCost: 50, energyGen: 0, decibelGen: 340, safety: "safe_iframe", buffTag: { id: "burnice", label: "柏妮思后台余烬", dur: 14.0 } },
    { key: "bur_ult", label: "终结技·纵火盛宴回能", cat: "ult", totalDur: 2.15, minSwap: 0.85, mv: 3650, daze: 230, anom: 450, energyCost: 0, energyGen: 35, decibelGen: 0, triggersQA: true, safety: "safe_iframe" }
  ],
  "1331": [
    { key: "viv_ex", label: "强化E·紫羽浮空蓄满异放", cat: "ex", totalDur: 1.70, minSwap: 0.45, mv: 1850, daze: 145, anom: 430, energyCost: 50, energyGen: 0, decibelGen: 340, safety: "safe_iframe", buffTag: { id: "vivian", label: "薇薇安飞羽异放", dur: 14.0 } },
    { key: "viv_ult", label: "终结技·暮夜绽放", cat: "ult", totalDur: 2.15, minSwap: 1.30, mv: 3750, daze: 225, anom: 460, energyCost: 0, energyGen: 14, decibelGen: 0, safety: "safe_iframe" }
  ],
  "1501": [
    { key: "ari_ex", label: "强化E·以太共鸣蓄羽异放", cat: "ex", totalDur: 1.70, minSwap: 0.45, mv: 1880, daze: 145, anom: 430, energyCost: 50, energyGen: 0, decibelGen: 340, safety: "safe_iframe", buffTag: { id: "aria", label: "爱芮异放共鸣", dur: 14.0 } },
    { key: "ari_ult", label: "终结技·空洞回响", cat: "ult", totalDur: 2.15, minSwap: 1.30, mv: 3800, daze: 225, anom: 460, energyCost: 0, energyGen: 14, decibelGen: 0, safety: "safe_iframe" }
  ],
  "1411": [
    { key: "yuz_ex", label: "强化E·彩糖花火染色快支", cat: "ex", totalDur: 1.65, minSwap: 0.40, mv: 1120, daze: 140, anom: 280, energyCost: 50, energyGen: 0, decibelGen: 330, safety: "safe_iframe", triggersQA: true, buffTag: { id: "yuzuha", label: "柚叶1200攻+染色", dur: 20.0 } },
    { key: "yuz_ult", label: "终结技·狸之愿全队回能", cat: "ult", totalDur: 2.05, minSwap: 1.15, mv: 2650, daze: 230, anom: 340, energyCost: 0, energyGen: 25, teamEnergyGen: 25, decibelGen: 0, safety: "safe_iframe", triggersQA: true, buffTag: { id: "yuzuha", label: "柚叶1200攻+染色", dur: 20.0 } }
  ],
  "1311": [
    { key: "ast_ex", label: "咏叹华彩·驻场和弦", cat: "ex", totalDur: 2.10, minSwap: 0.35, mv: 580, daze: 95, anom: 140, energyCost: 50, energyGen: 0, decibelGen: 320, safety: "safe_iframe", triggersQA: true, buffTag: { id: "astral", label: "嘉音1200攻+快支", dur: 20.0 } },
    { key: "ast_ult", label: "终结技·协奏强转双连携", cat: "ult", totalDur: 2.20, minSwap: 1.60, mv: 2100, daze: 220, anom: 220, energyCost: 0, energyGen: 15, decibelGen: 0, safety: "safe_iframe", triggersQA: true, buffTag: { id: "astra_chain", label: "强转连携x2", dur: 15.0 } }
  ],
  "1031": [
    { key: "nic_ex", label: "蓄力强E·朝天炮能量场", cat: "ex", totalDur: 1.65, minSwap: 0.45, mv: 920, daze: 140, anom: 260, energyCost: 60, energyGen: 0, decibelGen: 340, safety: "safe_iframe", triggersQA: true, buffTag: { id: "nicole", label: "妮可40%减防", dur: 4.2 } },
    { key: "nic_qa", label: "快支偷球·续3.5s减防", cat: "qa", totalDur: 1.15, minSwap: 0.35, mv: 540, daze: 95, anom: 175, energyCost: 0, energyGen: 10, decibelGen: 180, safety: "assist_protected", buffTag: { id: "nicole", label: "妮可40%减防", dur: 3.6 } },
    { key: "nic_ult", label: "终结技·以太黑洞", cat: "ult", totalDur: 1.95, minSwap: 1.10, mv: 2450, daze: 240, anom: 340, energyCost: 0, energyGen: 15, teamEnergyGen: 10, decibelGen: 0, safety: "safe_iframe", triggersQA: true, buffTag: { id: "nicole", label: "妮可40%减防", dur: 4.8 } }
  ],
  "1211": [
    { key: "rin_ex", label: "强化E·砸玩偶穿透快支", cat: "ex", totalDur: 1.50, minSwap: 0.42, mv: 960, daze: 135, anom: 240, energyCost: 50, energyGen: 0, decibelGen: 320, safety: "safe_iframe", triggersQA: true, buffTag: { id: "rina", label: "丽娜穿透玩偶", dur: 5.5 } },
    { key: "rin_qa", label: "快支召玩偶·续杯穿透", cat: "qa", totalDur: 1.05, minSwap: 0.32, mv: 520, daze: 90, anom: 160, energyCost: 0, energyGen: 10, decibelGen: 170, safety: "assist_protected", buffTag: { id: "rina", label: "丽娜穿透玩偶", dur: 5.5 } },
    { key: "rin_ult", label: "终结技·女王侍从回能", cat: "ult", totalDur: 2.05, minSwap: 1.15, mv: 2550, daze: 230, anom: 310, energyCost: 0, energyGen: 20, teamEnergyGen: 15, decibelGen: 0, safety: "safe_iframe", triggersQA: true, buffTag: { id: "rina", label: "丽娜穿透玩偶", dur: 5.5 } }
  ],
  "1291": [
    { key: "hug_ex", label: "强化E·决算瞬结失衡斩", cat: "ex", totalDur: 1.85, minSwap: 0.95, mv: 3850, daze: 210, anom: 200, energyCost: 45, energyGen: 0, decibelGen: 360, totalizesStun: "ex", safety: "safe_iframe" },
    { key: "hug_ult", label: "终结技·深渊镰影决算", cat: "ult", totalDur: 2.35, minSwap: 1.65, mv: 5100, daze: 270, anom: 250, energyCost: 0, energyGen: 12, decibelGen: 0, totalizesStun: "ult", safety: "safe_iframe" }
  ],
  "1321": [
    { key: "eve_gar", label: "月夜缠绕·绞索连携", cat: "chain", totalDur: 2.15, minSwap: 0.55, mv: 3450, daze: 190, anom: 190, energyCost: 0, energyGen: 10, decibelGen: 360, safety: "safe_iframe" },
    { key: "eve_ex", label: "强化E·束缚聚拢引爆", cat: "ex", totalDur: 1.40, minSwap: 0.70, mv: 1480, daze: 150, anom: 160, energyCost: 40, energyGen: 0, decibelGen: 330, safety: "safe_iframe" },
    { key: "eve_ult", label: "终结技·夜幕解放", cat: "ult", totalDur: 2.30, minSwap: 1.70, mv: 4350, daze: 250, anom: 230, energyCost: 0, energyGen: 12, decibelGen: 0, safety: "safe_iframe" }
  ],
  "1551": [
    { key: "pyr_ex", label: "强化E·完美格挡反击", cat: "ex", totalDur: 1.75, minSwap: 0.55, mv: 2150, daze: 210, anom: 190, energyCost: 45, energyGen: 0, decibelGen: 350, safety: "safe_iframe" },
    { key: "pyr_b", label: "以太剑舞终结连段", cat: "basic", totalDur: 2.05, minSwap: 1.10, mv: 2350, daze: 165, anom: 180, energyCost: 0, energyGen: 15, decibelGen: 290, safety: "assist_protected" },
    { key: "pyr_ult", label: "终结技·凯旋归来", cat: "ult", totalDur: 2.35, minSwap: 1.50, mv: 4650, daze: 280, anom: 250, energyCost: 0, energyGen: 12, decibelGen: 0, safety: "safe_iframe" }
  ],
  "1371": [
    { key: "yix_ex", label: "玄墨太极·凝炁强E", cat: "ex", totalDur: 1.95, minSwap: 0.55, mv: 2950, daze: 190, anom: 210, energyCost: 40, energyGen: 0, decibelGen: 360, safety: "safe_iframe" },
    { key: "yix_ult1", label: "符法终结技·青溟破", cat: "ult", totalDur: 2.25, minSwap: 1.25, mv: 4400, daze: 260, anom: 260, energyCost: 0, energyGen: 15, decibelGen: 0, safety: "safe_iframe" },
    { key: "yix_b", label: "玄墨阵眼蓄力连击", cat: "basic", totalDur: 2.00, minSwap: 1.05, mv: 2450, daze: 150, anom: 180, energyCost: 0, energyGen: 18, decibelGen: 280, safety: "assist_protected" }
  ],
  "1431": [
    { key: "ysg_ex", label: "明心境·青冥剑意归一", cat: "ex", totalDur: 2.05, minSwap: 0.50, mv: 3100, daze: 175, anom: 220, energyCost: 45, energyGen: 0, decibelGen: 360, safety: "safe_iframe" },
    { key: "ysg_b", label: "凛刃执剑四段连斩", cat: "basic", totalDur: 1.95, minSwap: 1.10, mv: 2550, daze: 145, anom: 190, energyCost: 0, energyGen: 16, decibelGen: 280, safety: "assist_protected" },
    { key: "ysg_ult", label: "终结技·天裂裁决", cat: "ult", totalDur: 2.40, minSwap: 1.55, mv: 4900, daze: 270, anom: 280, energyCost: 0, energyGen: 14, decibelGen: 0, safety: "safe_iframe" }
  ],
  "1481": [
    { key: "dia_ex", label: "强化E·重音震击赠免费大", cat: "ex", totalDur: 1.55, minSwap: 0.45, mv: 1750, daze: 540, anom: 190, energyCost: 45, energyGen: 0, decibelGen: 350, grantsFreeUlt: true, triggersQA: true, safety: "safe_iframe", buffTag: { id: "dialyn", label: "琉音40%增伤+免费大", dur: 16.0 } },
    { key: "dia_ult", label: "终结技·轰鸣破阵", cat: "ult", totalDur: 2.15, minSwap: 1.35, mv: 3950, daze: 680, anom: 240, energyCost: 0, energyGen: 14, decibelGen: 0, grantsFreeUlt: true, safety: "safe_iframe" }
  ],
  "1161": [
    { key: "lig_ora", label: "士气爆发·欧拉连拳破韧", cat: "basic", totalDur: 1.95, minSwap: 0.65, mv: 1950, daze: 560, anom: 190, energyCost: 0, energyGen: 14, decibelGen: 310, safety: "assist_protected", buffTag: { id: "lighter", label: "莱特冰火增伤+减抗", dur: 16.0 } },
    { key: "lig_ex", label: "强化E·升龙烈拳", cat: "ex", totalDur: 1.40, minSwap: 0.48, mv: 1650, daze: 490, anom: 180, energyCost: 40, energyGen: 0, decibelGen: 330, safety: "safe_iframe", buffTag: { id: "lighter", label: "莱特冰火增伤+减抗", dur: 16.0 } }
  ],
  "1511": [
    { key: "nan_ex", label: "强化E·以太破韧极性异放", cat: "ex", totalDur: 1.65, minSwap: 0.48, mv: 1920, daze: 500, anom: 380, energyCost: 45, energyGen: 0, decibelGen: 350, triggersPolarityDisorder: true, safety: "safe_iframe", buffTag: { id: "nangong", label: "南宫羽失衡异放", dur: 16.0 } }
  ],
  "1581": [
    { key: "rem_ex", label: "强化E·流明圣咏法阵", cat: "ex", totalDur: 1.85, minSwap: 0.40, mv: 1750, daze: 130, anom: 420, energyCost: 50, energyGen: 0, decibelGen: 340, safety: "safe_iframe", buffTag: { id: "remiel", label: "蕾米耀化法阵", dur: 14.0 } },
    { key: "rem_ult", label: "终结技·虚芒耀化引爆", cat: "ult", totalDur: 2.15, minSwap: 1.35, mv: 3400, daze: 210, anom: 470, energyCost: 0, energyGen: 14, decibelGen: 0, safety: "safe_iframe" }
  ],
  "1561": [
    { key: "vel_ex", label: "强化E·风化涡流牵引", cat: "ex", totalDur: 1.75, minSwap: 0.40, mv: 1550, daze: 140, anom: 410, energyCost: 50, energyGen: 0, decibelGen: 340, safety: "safe_iframe", buffTag: { id: "velina", label: "风化涡流领域", dur: 12.0 } },
    { key: "vel_ult", label: "终结技·暴风异放", cat: "ult", totalDur: 2.10, minSwap: 1.30, mv: 3250, daze: 210, anom: 450, energyCost: 0, energyGen: 14, decibelGen: 0, safety: "safe_iframe" }
  ],
  "1641": [
    { key: "phx_ex", label: "强化E·烬羽异常暴击环", cat: "ex", totalDur: 1.70, minSwap: 0.42, mv: 1620, daze: 135, anom: 410, energyCost: 50, energyGen: 0, decibelGen: 340, safety: "safe_iframe", buffTag: { id: "phione", label: "菲欧妮异常暴击", dur: 14.0 } },
    { key: "phx_ult", label: "终结技·炽翼异放", cat: "ult", totalDur: 2.15, minSwap: 1.35, mv: 3350, daze: 205, anom: 450, energyCost: 0, energyGen: 14, decibelGen: 0, safety: "safe_iframe" }
  ],
  "1281": [
    { key: "pip_spin", label: "强化E·引擎转圈接下砸", cat: "ex", totalDur: 2.75, minSwap: 2.15, mv: 2450, daze: 170, anom: 460, energyCost: 50, energyGen: 0, decibelGen: 350, safety: "unsafe_exposed" }
  ],
  "1061": [
    { key: "cor_saw", label: "强化E·持续电锯切割爆炸", cat: "ex", totalDur: 2.85, minSwap: 2.25, mv: 2750, daze: 185, anom: 190, energyCost: 50, energyGen: 0, decibelGen: 350, safety: "unsafe_exposed" }
  ]
};

export function getMovePoolForChar(ch: any, mLevel = 0) {
  const sp = getCharSwapProfile(ch);
  const rinaDur = mLevel >= 1 ? 11.0 : 5.5;
  const rawSpecific = SPECIFIC_CHAR_MOVES[ch.id] || [];
  const specific = rawSpecific.map((mv: any) => {
    if (ch.id === "1211" && mv.buffTag?.id === "rina") {
      return { ...mv, buffTag: { ...mv.buffTag, dur: rinaDur, label: mLevel >= 1 ? "丽娜1影11s穿透" : "丽娜0影5.5s穿透" } };
    }
    return mv;
  });

  const commit = sp.commitSec || 1.25;
  const isChan = sp.archetype === "channeled_lock";
  const hasVeil = !!ch.prof?.has_ether_veil;

  const generic = [
    {
      key: "gen_ex",
      label: `${ch.n}·强化特殊技`,
      cat: "ex",
      totalDur: isChan ? 2.65 : Math.max(1.30, commit + 0.45),
      minSwap: isChan ? 2.10 : 0.48,
      mv: isChan ? 2350 : 1850,
      daze: ch.wt === "Stun" ? 480 : 165,
      anom: ch.wt === "Anomaly" ? 390 : 165,
      energyCost: ch.wt === "Stun" ? 45 : 50,
      energyGen: 0,
      decibelGen: 340,
      safety: isChan ? "unsafe_exposed" : "safe_iframe",
      triggersQA: ch.wt === "Support" || ch.wt === "Defense" || (sp.qaOut || 0) >= 1.3,
      buffTag:
        ch.id === "1211"
          ? { id: "rina", label: mLevel >= 1 ? "丽娜1影11s穿透" : "丽娜0影5.5s穿透", dur: rinaDur }
          : hasVeil
          ? { id: "ether_veil", label: `${ch.n}·以太帷幕`, dur: 18.0 }
          : ch.wt === "Support" || ch.wt === "Defense"
          ? { id: `sup_${ch.id}`, label: `${ch.n}增益`, dur: 15.0 }
          : null
    },
    {
      key: "gen_basic",
      label: `${ch.n}·主力普攻/蓄力段`,
      cat: "basic",
      totalDur: Math.max(1.55, commit + 0.65),
      minSwap: isChan ? 1.80 : Math.max(0.55, 1.85 - commit * 0.65),
      mv: 2100,
      daze: ch.wt === "Stun" ? 410 : 140,
      anom: ch.wt === "Anomaly" ? 310 : 140,
      energyCost: 0,
      energyGen: 15,
      decibelGen: 270,
      safety: sp.safety || "assist_protected"
    },
    {
      key: "gen_parry",
      label: `${ch.n}·闪A振刀双反`,
      cat: "dash",
      totalDur: 1.35,
      minSwap: 0.42,
      mv: 1380,
      daze: ch.wt === "Stun" ? 540 : 360,
      anom: 165,
      energyCost: 0,
      energyGen: 10,
      decibelGen: 290,
      safety: "assist_protected"
    },
    {
      key: "gen_chain",
      label: `${ch.n}·失衡连携技`,
      cat: "chain",
      totalDur: 1.55,
      minSwap: 0.95,
      mv: 2450,
      daze: 120,
      anom: ch.wt === "Anomaly" ? 280 : 210,
      energyCost: 0,
      energyGen: 10,
      decibelGen: 360,
      safety: "safe_iframe",
      buffTag:
        ch.id === "1031"
          ? { id: "nicole", label: "妮可连携减防", dur: 4.0 }
          : ch.id === "1211"
          ? { id: "rina", label: "丽娜连携玩偶", dur: rinaDur }
          : null
    },
    {
      key: "gen_heavy",
      label: `${ch.n}·手动取消重击点连携`,
      cat: "ex",
      totalDur: Math.max(0.65, sp.heavySpeed || 0.78),
      minSwap: Math.max(0.45, (sp.heavySpeed || 0.78) * 0.75),
      mv: 620,
      daze: 90,
      anom: 120,
      energyCost: 0,
      energyGen: 5,
      decibelGen: 120,
      safety: "safe_iframe",
      buffTag:
        ch.id === "1031"
          ? { id: "nicole", label: "妮可偷球减防", dur: 3.8 }
          : ch.id === "1211"
          ? { id: "rina", label: "丽娜召玩偶穿透", dur: rinaDur }
          : null
    },
    {
      key: "gen_ult",
      label: `${ch.n}·终结技爆发`,
      cat: "ult",
      totalDur: 2.25,
      minSwap: 1.55,
      mv: 4250,
      daze: ch.wt === "Stun" ? 660 : 260,
      anom: ch.wt === "Anomaly" ? 440 : 220,
      energyCost: 0,
      energyGen: 14,
      decibelGen: 0,
      safety: "safe_iframe"
    }
  ];

  const byKey = new Map<string, any>();
  [...specific, ...generic].forEach((m) => {
    if (!byKey.has(m.key)) byKey.set(m.key, m);
  });
  return [...byKey.values()];
}

export function calcSwapSecForMove(move: any, swapCfg: any) {
  const overlap = swapCfg?.commitOverlap ?? 0.74;
  const protectChan = swapCfg?.protectChanneled !== false;
  if (move.safety === "unsafe_exposed" && swapCfg?.safetyPolicy === "safe_only") {
    return Number((move.totalDur * 0.94).toFixed(2));
  }
  const minSafe = protectChan ? move.minSwap : Math.min(move.minSwap, move.totalDur * 0.45);
  const s = move.totalDur - (move.totalDur - minSafe) * overlap;
  return Number(Math.max(0.25, Math.min(move.totalDur, s)).toFixed(2));
}

/**
 * Generates an archetype-aware ZZZ multi-track rotation timeline from the current 1~3 agents + swapCfg:
 * - 0-Stunner Dual/Triple Anomaly Disorder Weave (respecting 3.0s Disorder ICD!)
 * - Hormone Punk 4pc off-field discipline (avoids burning 10s buff in early out-of-stun)
 * - Short-buff refresh steals (Nicole 3.5s / Rina M0 5.5s) right before Main Carry Ultimate
 * - Hugo Totalize rapid Stun finisher
 */
export function generateSmartTimeline(activeMembers: any[], swapCfg: any, env: any = {}) {
  if (!activeMembers || activeMembers.length === 0) return [];
  const sc = swapCfg || makeDefaultSwapConfig("standard");
  const blocks: any[] = [];
  let cursor = 0.0;
  let uid = 1;

  const pushBlock = (mIdx: number, move: any, customPhase = "out") => {
    const m = activeMembers[mIdx];
    const swapDur = calcSwapSecForMove(move, sc);
    const blk = {
      id: `blk_${uid++}`,
      moveKey: move.key,
      slotIdx: m.slotIdx,
      memberIdx: mIdx,
      cid: m.ch.id,
      charName: m.ch.n,
      label: move.label,
      cat: move.cat,
      phase: customPhase,
      startSec: Number(cursor.toFixed(2)),
      totalDur: Number(move.totalDur.toFixed(2)),
      minSwap: Number(move.minSwap.toFixed(2)),
      swapDur,
      mv: move.mv,
      daze: move.daze,
      anom: move.anom,
      energyCost: move.energyCost ?? (move.cat === "ex" ? 50 : 0),
      energyGen: move.energyGen ?? (move.cat === "basic" ? 15 : 8),
      teamEnergyGen: move.teamEnergyGen ?? 0,
      decibelGen: move.decibelGen ?? (move.cat === "ult" ? 0 : 280),
      triggersQA: !!move.triggersQA,
      triggersPolarityDisorder: !!move.triggersPolarityDisorder,
      grantsFreeUlt: !!move.grantsFreeUlt,
      totalizesStun: move.totalizesStun || null,
      safety: move.safety,
      buffTag: move.buffTag ? { ...move.buffTag } : null
    };
    blocks.push(blk);
    cursor = Number((cursor + swapDur).toFixed(2));
    return blk;
  };

  const pools = activeMembers.map((m) => getMovePoolForChar(m.ch, m.m ?? m.cfg?.m ?? 0));
  const pick = (mIdx: number, catPref: string) => {
    const pool = pools[mIdx];
    return pool.find((x: any) => x.cat === catPref) || pool[0];
  };
  const pickKey = (mIdx: number, key: string, fallbackCat: string) => {
    const pool = pools[mIdx];
    return pool.find((x: any) => x.key === key) || pick(mIdx, fallbackCat);
  };

  const n = activeMembers.length;
  if (n === 1) {
    pushBlock(0, pick(0, "ex"), "out");
    pushBlock(0, pick(0, "basic"), "out");
    pushBlock(0, pick(0, "ex"), "stun");
    pushBlock(0, pick(0, "ult"), "stun");
    pushBlock(0, pick(0, "basic"), "stun");
    return blocks;
  }

  const stunIdx = activeMembers.findIndex((m) => m.ch.wt === "Stun");
  const anomCount = activeMembers.filter((m) => m.ch.wt === "Anomaly").length;
  const carryFourPc = activeMembers[0]?.cfg?.fourPc || activeMembers[0]?.ch?.def4pc;
  const holdCarryForHormone = carryFourPc === "激素" && stunIdx >= 0;

  // ARCHETYPE 1: 0-Stunner Dual/Triple Anomaly Disorder Weave (2 clean Disorder waves respecting 3.0s ICD)
  if (stunIdx < 0 && anomCount >= 2) {
    const supIdx = n >= 3 ? 2 : 1;
    const subAnomIdx = 1;
    // Wave 1 (0s~5.5s): Support Aura EX -> Sub-Anomaly EX + Basic (builds Underlay Anomaly #1)
    if (n >= 3) pushBlock(supIdx, pick(supIdx, "ex"), "out");
    pushBlock(subAnomIdx, pick(subAnomIdx, "ex"), "out");
    pushBlock(subAnomIdx, pick(subAnomIdx, "basic"), "out");

    // Main Anomaly enters via QA -> EX + Basic combo (detonates Disorder #1 after >= 3.0s gap!)
    pushBlock(0, pick(0, "ex"), "out");
    if (activeMembers[0].ch.id === "1091") {
      pushBlock(0, pickKey(0, "miy_b5", "basic"), "out");
      pushBlock(0, pickKey(0, "miy_c3", "basic"), "out");
    } else {
      pushBlock(0, pick(0, "basic"), "out");
      pushBlock(0, pick(0, "basic"), "out");
    }

    // Wave 2 (5.5s~11.0s): Support Ult/Refresh + Sub-Anomaly Ult + EX + Basic (builds Underlay Anomaly #2)
    if (n >= 3) {
      pushBlock(supIdx, pick(supIdx, "ult"), "out");
    }
    pushBlock(subAnomIdx, pick(subAnomIdx, "ult"), "out");
    pushBlock(subAnomIdx, pick(subAnomIdx, "ex"), "out");
    pushBlock(subAnomIdx, pick(subAnomIdx, "basic"), "out");

    // Wave 3 (11.0s~17.0s): Main Anomaly Burst Window (Short-buff steal + EX + Ult + Finisher -> Disorder #2!)
    pushBlock(0, pick(0, "ex"), "stun");
    const nicIdx = activeMembers.findIndex((m) => m.ch.id === "1031");
    const rinIdx = activeMembers.findIndex((m) => m.ch.id === "1211");
    if (nicIdx >= 0 && (sc.buffWeave ?? 0.9) >= 0.75) pushBlock(nicIdx, pickKey(nicIdx, "nic_qa", "qa"), "stun");
    else if (rinIdx >= 0 && (activeMembers[rinIdx].m ?? 0) === 0) pushBlock(rinIdx, pickKey(rinIdx, "rin_qa", "qa"), "stun");

    pushBlock(0, pick(0, "ult"), "stun");
    if (activeMembers[0].ch.id === "1091") {
      pushBlock(0, pickKey(0, "miy_c3", "basic"), "stun");
    } else {
      pushBlock(0, pick(0, "basic"), "stun");
    }
    return blocks;
  }

  // ARCHETYPE 2: Stun / Wheelchair / Attack / Rupture / Armorer Rotation
  const nicIdx = activeMembers.findIndex((m) => m.ch.id === "1031");
  const rinIdx = activeMembers.findIndex((m) => m.ch.id === "1211");
  const astraIdx = activeMembers.findIndex((m) => m.ch.id === "1311");

  // Phase 1: Opening Support/Defense Aura (Stunners save EX for Phase 2 Daze burst so Stun pops right into Chain #1!)
  for (let i = n - 1; i >= 1; i--) {
    if (activeMembers[i].ch.wt !== "Stun") {
      pushBlock(i, pick(i, "ex"), "out");
    }
  }
  if (!holdCarryForHormone) {
    if (activeMembers[0].ch.id !== "1291") {
      pushBlock(0, pick(0, "ex"), "out");
    }
    pushBlock(0, pick(0, "basic"), "out");
  } else if (stunIdx >= 0) {
    // Keep Hormone Punk 4pc carry off-field until Stun so 10s +25% ATK covers 100% of Stun burst!
    pushBlock(stunIdx, pick(stunIdx, "basic"), "out");
  }

  // Phase 2: Parry + Stun Daze Buildup (or Wheelchair mid-cycle Ult/Skirmish)
  const parryActor = stunIdx >= 0 ? stunIdx : n >= 2 ? 1 : 0;
  if ((sc.parryCount || 0) >= 1.5 && activeMembers[parryActor].ch.defAssist) {
    pushBlock(parryActor, pickKey(parryActor, "gen_parry", "dash"), "out");
    if ((sc.parryCount || 0) >= 3.0) {
      pushBlock(parryActor, pickKey(parryActor, "gen_parry", "dash"), "out");
    }
  }
  if (stunIdx >= 0) {
    pushBlock(stunIdx, pick(stunIdx, "ex"), "out");
    pushBlock(stunIdx, pick(stunIdx, "basic"), "out");
    const secondStunIdx = activeMembers.findIndex((m, idx) => idx !== stunIdx && m.ch.wt === "Stun");
    if (secondStunIdx >= 0) {
      pushBlock(secondStunIdx, pick(secondStunIdx, "ex"), "out");
      pushBlock(secondStunIdx, pick(secondStunIdx, "basic"), "out");
    }
  } else if (!holdCarryForHormone) {
    pushBlock(0, pick(0, "basic"), "out");
    if (nicIdx >= 0) {
      pushBlock(nicIdx, pickKey(nicIdx, "nic_qa", "qa"), "out");
    } else if (n >= 2 && activeMembers[1].ch.id !== "1311") {
      pushBlock(1, pick(1, "ult"), "out");
    }
  }

  // Phase 3: Stun Chain Sequence (Stunner Boss-Stun 1~3x Chain vs 0-Stunner Astra Chord Chain)
  const chainMove0 =
    pools[0].find((x: any) => x.cat === "chain") ||
    pools[0].find((x: any) => x.key === "gen_chain") ||
    pick(0, "ex");
  // Prefer Nicole / Rina over immobile singing Astra for heavy-attack Chain cancel!
  const suppIdx =
    nicIdx > 0
      ? nicIdx
      : rinIdx > 0
      ? rinIdx
      : activeMembers.findIndex((m, idx) => idx !== 0 && m.ch.id !== "1311" && (m.ch.wt === "Support" || m.ch.wt === "Defense")) !== -1
      ? activeMembers.findIndex((m, idx) => idx !== 0 && m.ch.id !== "1311" && (m.ch.wt === "Support" || m.ch.wt === "Defense"))
      : 1;

  const cTech = sc.chainTech === "auto" ? "double_carry" : sc.chainTech;
  if (stunIdx < 0 && astraIdx >= 0) {
    // 0-Stunner Astra Wheelchair: Astra Ult triggers forced Carry Chain(s) without Boss Stun!
    pushBlock(astraIdx, pick(astraIdx, "ult"), "stun");
    pushBlock(0, { ...chainMove0, label: `${activeMembers[0].ch.n}·嘉音强转连携#1` }, "stun");
    if (cTech === "double_carry" || cTech === "triple_carry") {
      if (nicIdx > 0) pushBlock(nicIdx, pickKey(nicIdx, "nic_qa", "qa"), "stun");
      pushBlock(0, { ...chainMove0, label: `${activeMembers[0].ch.n}·嘉音强转连携#2` }, "stun");
    }
  } else {
    pushBlock(0, { ...chainMove0, label: `${activeMembers[0].ch.n}·连携技#1` }, "stun");
    if (cTech === "triple_std") {
      for (let i = 1; i < n; i++) {
        pushBlock(i, pickKey(i, "gen_chain", "chain"), "stun");
      }
    } else if (cTech === "double_carry" || cTech === "triple_carry") {
      pushBlock(suppIdx, pickKey(suppIdx, "gen_heavy", "ex"), "stun");
      pushBlock(0, { ...chainMove0, label: `${activeMembers[0].ch.n}·双连携#2` }, "stun");
      if (cTech === "triple_carry" && stunIdx >= 0) {
        if (astraIdx >= 0) pushBlock(astraIdx, pick(astraIdx, "ult"), "stun");
        pushBlock(0, { ...chainMove0, label: `${activeMembers[0].ch.n}·强转三连携#3` }, "stun");
      }
    }
  }

  // Phase 4: Stun Burst Window + Short-Buff Refresh Steal + Hugo Totalize Order
  if (activeMembers[0].ch.id === "1291") {
    // Hugo (1291): Refresh short buffs FIRST, cast Ult, then finish Stun with Totalize EX!
    if (nicIdx >= 0) pushBlock(nicIdx, pickKey(nicIdx, "nic_qa", "qa"), "stun");
    pushBlock(0, pickKey(0, "hug_ult", "ult"), "stun");
    pushBlock(0, pickKey(0, "hug_ex", "ex"), "stun");
    return blocks;
  }

  if (stunIdx >= 0 && activeMembers[stunIdx].ch.id === "1481") {
    // Dialyn Ult in Stun grants huge daze/team value + Free Ult token
    pushBlock(stunIdx, pick(stunIdx, "ult"), "stun");
  } else if (n >= 3 && !(stunIdx < 0 && astraIdx >= 0 && suppIdx === astraIdx) && !(cTech === "triple_carry" && stunIdx >= 0 && activeMembers[suppIdx].ch.id === "1311")) {
    pushBlock(suppIdx, pick(suppIdx, "ult"), "stun");
  } else if (astraIdx > 0 && stunIdx >= 0 && cTech !== "triple_carry") {
    pushBlock(astraIdx, pick(astraIdx, "ult"), "stun");
  }
  pushBlock(0, pick(0, "ex"), "stun");
  if (nicIdx >= 0 && !(n >= 3 && suppIdx === nicIdx) && (sc.buffWeave ?? 0.9) >= 0.78) {
    pushBlock(nicIdx, pickKey(nicIdx, "nic_qa", "ex"), "stun");
  } else if (rinIdx >= 0 && (activeMembers[rinIdx].m ?? 0) === 0 && (sc.buffWeave ?? 0.9) >= 0.78) {
    pushBlock(rinIdx, pickKey(rinIdx, "rin_qa", "ex"), "stun");
  } else if (n >= 3 && activeMembers[1].ch.wt === "Anomaly") {
    pushBlock(1, pick(1, "ult"), "stun");
  }
  pushBlock(0, pick(0, "ult"), "stun");
  pushBlock(0, pick(0, "basic"), "stun");
  pushBlock(0, pick(0, "basic"), "stun");

  return blocks;
}

// ============================================================================
// Discrete-Time (dt = 0.05s) Combat Physics State Machine
// ============================================================================
// Tracks simultaneously across t in [0, cycleSec]:
// 1. Per-Agent Energy (0~120): passive ER regen + active move gen - EX expenditure -> deficit detection
// 2. Per-Agent Independent Decibels (0~3000/4000): active gen + 45% mate share + parry/stun/disorder + Dialyn free Ult
// 3. Boss Daze Gauge (0~dazeThreshold) & Real-time Stun Countdown (incl. Hugo Totalize early stun settlement)
// 4. Multi-Element Anomaly Gauges, Contributor Snapshot Purity, Authentic `t_rem` Disorder & 3.0s ICD collisions
// 5. Frame-Accurate Buff Coverage Integration (Nicole, Rina M0/M1, Hormone Punk 10s/20s CD, Astral Voice 1~3 stacks,
//    Proto Punk 10s, Swing Jazz 12s, Moonlight 25s, Frostbite +10% CD)
// ============================================================================

export function analyzeTimeline(blocks: any[], activeMembers: any[], env: any = {}, bangboo: any = null) {
  if (!blocks || blocks.length === 0 || !activeMembers || activeMembers.length === 0) {
    return {
      active: false, blockCount: 0, seqCycleSec: 0, cycleSec: 0, savedSec: 0, overlapPct: 0,
      safeSwaps: 0, exposedSwaps: 0, exposedSec: 0, stunStartSec: 0, stunEndSec: 0,
      outStunSec: 0, inStunSec: 0, nicoleCov: null, rinaCov: null, hormoneCov: null,
      protoCov: null, swingCov: null, moonlightCov: null, astralStacksAvg: null,
      nicoleCovByCid: {}, rinaCovByCid: {}, hormoneCovByCid: {}, frostbiteCovByCid: {},
      totalQA: 0, parryCount: 0, chainCountCarry: 1, truncLoss: [], buffWindows: [],
      sharesByCid: {}, stunShareByCid: {}, slotWeightMult: [],
      agentTelemetry: [], dazeCurve: [], anomEvents: [], disorderEvents: [],
      disorderCount: 0, disorderAvgMv: null, disorderAvgRemSec: null, disorderIcdHits: 0,
      autoStunTriggered: false, dazeFillRatio: 0, resourceScaleByCid: {}, tlDiagnostics: []
    };
  }

  const DT = 0.05;
  const tlDiagnostics: string[] = [];
  const hasJuFufu = activeMembers.some((m) => m.ch.id === "1391");
  const hasDialyn = activeMembers.some((m) => m.ch.id === "1481");
  const isDpsRole = (wt: string) => wt === "Attack" || wt === "Anomaly" || wt === "Rupture" || wt === "Armorer";

  // Lookup default move metadata for blocks created prior to v3.3 state machine enrichment
  const moveLookupByCid = new Map<string, Map<string, any>>();
  const memberByCid = new Map<string, any>();
  activeMembers.forEach((m) => {
    memberByCid.set(m.ch.id, m);
    const pool = getMovePoolForChar(m.ch, m.m ?? m.cfg?.m ?? 0);
    const mp = new Map<string, any>();
    pool.forEach((mv: any) => mp.set(mv.key, mv));
    moveLookupByCid.set(m.ch.id, mp);
  });

  // Pass 1: Normalize blocks, compute truncation & time span
  let seqCycleSec = 0;
  let maxEndSec = 0;
  let safeSwaps = 0;
  let exposedSwaps = 0;
  let exposedSec = 0;
  let totalQA = 0;
  let parryCount = 0;
  let chainCountCarry = 0;
  let tagStunStartSec = Infinity;
  let tagStunEndSec = 0;

  const sortedBlocks = [...blocks].sort((a, b) => (Number(a.startSec) || 0) - (Number(b.startSec) || 0));

  sortedBlocks.forEach((b, idx) => {
    const start = Math.max(0, Number(b.startSec) || 0);
    const total = Math.max(0.2, Number(b.totalDur) || 1.0);
    const swapD = Math.max(0.15, Math.min(total, Number(b.swapDur) || total));
    const minS = Math.max(0.15, Number(b.minSwap) || total * 0.5);
    const end = start + total;

    seqCycleSec += total;
    if (end > maxEndSec) maxEndSec = end;

    if (b.phase === "stun") {
      if (start < tagStunStartSec) tagStunStartSec = start;
      if (end > tagStunEndSec) tagStunEndSec = end;
    }

    const linger = Math.max(0, total - swapD);
    if (linger > 0.08 && idx < sortedBlocks.length - 1) {
      if (b.safety === "unsafe_exposed") {
        exposedSwaps += 1;
        exposedSec += linger;
      } else {
        safeSwaps += 1;
      }
    }

    let effFactor = 1.0;
    if (swapD < minS - 0.05) {
      effFactor = Math.max(0.35, swapD / minS);
    }
    b._truncPct = 1.0 - effFactor;
    b._effFactor = effFactor;
    b._startSec = start;
    b._swapEndSec = start + swapD;
    b._endSec = end;
    b._lingerSec = linger;

    // Infer energy/decibel metadata if missing on saved workspace blocks
    const isHeavyTap = b.moveKey === "gen_heavy" || String(b.label || "").includes("手动取消重击");
    const isParry = b.moveKey === "gen_parry" || b.cat === "parry" || String(b.label || "").includes("振刀");
    const isQA = b.cat === "qa" || String(b.label || "").includes("快支");
    b._energyCost =
      b.energyCost !== undefined
        ? Number(b.energyCost)
        : b.cat === "ex" && !isHeavyTap
        ? 45
        : 0;
    b._energyGen =
      b.energyGen !== undefined
        ? Number(b.energyGen)
        : b.cat === "basic"
        ? 15
        : isParry || isQA || b.cat === "chain"
        ? 10
        : b.cat === "ult"
        ? 14
        : 0;
    b._teamEnergyGen = Number(b.teamEnergyGen) || 0;
    b._decibelGen =
      b.decibelGen !== undefined
        ? Number(b.decibelGen)
        : b.cat === "ult"
        ? 0
        : b.cat === "chain"
        ? 360
        : b.cat === "ex"
        ? isHeavyTap ? 120 : 340
        : isParry
        ? 290
        : b.cat === "basic"
        ? 270
        : 175;
    b._triggersQA = !!(
      b.triggersQA ||
      isQA ||
      String(b.label || "").includes("咏叹华彩") ||
      String(b.label || "").includes("朝天炮") ||
      String(b.label || "").includes("彩糖花火") ||
      String(b.label || "").includes("以太帷幕")
    );
    b._isParry = isParry;
    b._totalizesStun =
      b.totalizesStun ||
      (b.cid === "1291" && String(b.label || "").includes("决算") ? (b.cat === "ult" ? "ult" : "ex") : null);
    b._grantsFreeUlt = !!(b.grantsFreeUlt || (b.cid === "1481" && (b.cat === "ex" || b.cat === "ult")));

    if (isQA) totalQA += 1;
    if (b._triggersQA && !isQA) totalQA += 1.0;
    if (isParry) parryCount += 1;
    if (b.cid === activeMembers[0].ch.id && b.cat === "chain") chainCountCarry += 1;
  });

  const cycleSec = Math.max(4.0, maxEndSec);
  const savedSec = Math.max(0, seqCycleSec - cycleSec);
  const overlapPct = seqCycleSec > 0 ? savedSec / seqCycleSec : 0;

  // Pass 2: Initialize Agent Resource & Buff States
  const barDurExt = computeBarDurationExtMap(activeMembers);
  const dazeThreshold = Math.max(1500, Number(env?.dazeThreshold) || 4200);
  const stunExt =
    activeMembers.reduce((s, m) => s + (getCharSwapProfile(m.ch).stunExtSec || 0), 0) +
    (activeMembers.some((m) => ["1471", "1511", "1571", "1621"].includes(m.ch.id)) ? 1.5 : 0);
  const maxStunDur = Math.max(7.0, (Number(env?.stunDurationBase) || 12.0) + stunExt);
  const anomResScale = Math.max(0.5, Number(env?.anomThresholdScale) || 1.0);

  interface AgentRuntime {
    m: any;
    cid: string;
    name: string;
    fourPc: string;
    bar: AnomalyBarCode;
    erPerSec: number;
    dazeMult: number;
    anomMult: number;
    nonDiluting: boolean;
    decibelCap: number;
    energy: number;
    energyStart: number;
    energyMin: number;
    energyDeficits: number;
    decibel: number;
    decibelStart: number;
    decibelEarned: number;
    decibelPeak: number;
    decibelDeficits: number;
    ultsUsed: number;
    freeUltTokens: number;
    freeUltsUsed: number;
    hormoneUntil: number;
    hormoneReadyAt: number;
    mvTotal: number;
    mvTruncLost: number;
    mvRealStun: number;
    mvTagStun: number;
    mvWeightedScaleSum: number;
    covNicoleMv: number;
    covRinaMv: number;
    covHormoneMv: number;
    covFrostbiteMv: number;
    catMv: Record<string, number>;
  }

  const decibelSync = env?.swapConfig?.decibelSync || "aligned";
  const initDecibelBase = decibelSync === "double_ult" ? 2350 : decibelSync === "sequential" ? 1550 : 1950;

  const agentStates = new Map<string, AgentRuntime>();
  activeMembers.forEach((m, idx) => {
    const ch = m.ch;
    const st = m.sheet;
    const fp = m.fourPc || m.cfg?.fourPc || ch.def4pc || "啄木";
    const twoPc = m.twoPc || m.cfg?.twoPc || ch.def2pc || "";
    const erBonus2pc = fp === "月光" || fp === "摇摆" || twoPc === "月光" || twoPc === "摇摆" ? 0.20 : 0;
    const d6Er = m.cfg?.d6 === "ER" ? 0.60 : 0;
    const erPerSec = st
      ? (st.init_er + (st.eff?.c_er_flat || 0)) * (1 + (st.eff?.c_er_rate || 0))
      : (ch.er || 1.2) * (1 + erBonus2pc + d6Er);

    const impVal = st ? st.init_imp : (ch.imp || 100) * (fp === "震星" ? 1.06 : 1.0);
    const dazeBonus =
      (st?.eff?.daze_pct || 0) +
      (st?.f4?.daze_pct || (fp === "震星" ? 0.20 : 0)) +
      (bangboo?.dazeBonus || 0) +
      (ch.wt === "Stun" ? 0.18 : 0);
    const dazeMult = Math.max(0.5, (impVal / 118.0) * (1 + dazeBonus));

    const amVal = st ? st.init_am + (st.eff?.c_am_flat || 0) : ch.am || 100;
    const buildupBonus = (st?.eff?.buildup || 0) + (fp === "自由" ? 0.20 : 0);
    const anomMult = Math.max(0.45, (amVal / 115.0) * (1 + buildupBonus));

    const initEnergy = Math.min(120, 68 + (erPerSec > 1.8 ? 14 : 0));
    const decibelCap = hasJuFufu || ch.id === "1551" ? 4000 : 3000;
    const startDec = idx === 0 ? initDecibelBase : Math.round(initDecibelBase * 0.98);

    agentStates.set(ch.id, {
      m,
      cid: ch.id,
      name: ch.n,
      fourPc: fp,
      bar: resolveAgentAnomalyBar(ch),
      erPerSec,
      dazeMult,
      anomMult,
      nonDiluting: ch.id === "1411",
      decibelCap,
      energy: initEnergy,
      energyStart: initEnergy,
      energyMin: initEnergy,
      energyDeficits: 0,
      decibel: startDec,
      decibelStart: startDec,
      decibelEarned: 0,
      decibelPeak: startDec,
      decibelDeficits: 0,
      ultsUsed: 0,
      freeUltTokens: hasDialyn && idx === 0 && isDpsRole(ch.wt) ? 0 : 0,
      freeUltsUsed: 0,
      hormoneUntil: -1,
      hormoneReadyAt: 0,
      mvTotal: 0,
      mvTruncLost: 0,
      mvRealStun: 0,
      mvTagStun: 0,
      mvWeightedScaleSum: 0,
      covNicoleMv: 0,
      covRinaMv: 0,
      covHormoneMv: 0,
      covFrostbiteMv: 0,
      catMv: { basic: 0, dash: 0, ex: 0, chain: 0, ult: 0, aftershock: 0 }
    });
  });

  // Buff Windows & Global Squad Buff Timers
  const buffWindows: any[] = [];
  let nicoleUntil = -1;
  let rinaUntil = -1;
  let protoUntil = -1;
  let swingUntil = -1;
  let moonlightUntil = -1;
  let frostbiteUntil = -1;
  let flinchUntil = -1;
  let icefireUntil = -1;
  let astralStacks = 0;
  let astralUntil = -1;

  // Boss Daze & Stun State
  let dazeGauge = 0;
  let peakDaze = 0;
  let inStun = false;
  let stunRemSec = 0;
  let autoStunTriggered = false;
  let autoStunStartSec: number | null = null;
  let autoStunEndSec: number | null = null;
  let totalizeTriggered = false;
  const dazeCurve: Array<{ t: number; dazePct: number; inStun: boolean; stunRemSec: number }> = [];

  // Multi-Element Anomaly State
  const anomGauges: Record<string, number> = {};
  const anomContribs: Record<string, Record<string, number>> = {};
  const activeAnomalies: Record<string, { start: number; until: number; ownerCid: string }> = {};
  let lastDisorderSec = -99;
  const anomEvents: Array<{ t: number; bar: AnomalyBarCode; barZh: string; cid: string; purity: number }> = [];
  const disorderEvents: Array<{
    t: number;
    triggerBar: AnomalyBarCode;
    underlayBar: AnomalyBarCode;
    underlayZh: string;
    tRem: number;
    mvPct: number;
    icdBlocked: boolean;
  }> = [];

  const grantDecibels = (actorCid: string, amount: number) => {
    if (amount <= 0) return;
    agentStates.forEach((st, cid) => {
      const gain = cid === actorCid ? amount : amount * 0.45;
      st.decibel = Math.min(st.decibelCap, st.decibel + gain);
      st.decibelEarned += gain;
      if (st.decibel > st.decibelPeak) st.decibelPeak = st.decibel;
    });
  };

  // Pre-initialize per-block tracking fields
  const startedSet = new Set<number>();
  sortedBlocks.forEach((b) => {
    b._energyOk = true;
    b._decibelOk = true;
    b._resourceScale = 1.0;
    b._realStunTicks = 0;
    b._totalTicks = 0;
    b._energyAtCast = 0;
    b._decibelAtCast = 0;
  });

  let astralStackWeightedSum = 0;
  let protoWeightedSum = 0;
  let swingWeightedSum = 0;
  let moonlightWeightedSum = 0;
  let squadActiveMvSum = 0;

  const totalSteps = Math.max(1, Math.ceil(cycleSec / DT));

  for (let step = 0; step <= totalSteps; step++) {
    const t = Number((step * DT).toFixed(4));

    // 1. Trigger block-start discrete events (Energy/Decibel spend, Hormone swap-in, QA/Set buffs)
    sortedBlocks.forEach((b, idx) => {
      if (startedSet.has(idx) || t + 1e-5 < b._startSec) return;
      startedSet.add(idx);
      const st = agentStates.get(b.cid);
      if (!st) return;

      b._energyAtCast = st.energy;
      b._decibelAtCast = st.decibel;

      // Hormone Punk 4pc: +25% ATK for 10s upon entering field (20s CD)
      if (st.fourPc === "激素" && t >= st.hormoneReadyAt) {
        st.hormoneUntil = t + 10.0;
        st.hormoneReadyAt = t + 20.0;
        buffWindows.push({
          id: `hormone_${st.cid}`,
          label: `${st.name}·激素朋克10s`,
          kind: "set",
          start: t,
          end: t + 10.0
        });
      }

      // Energy expenditure on EX Special
      if (b._energyCost > 0) {
        if (st.energy + 1e-4 >= b._energyCost) {
          st.energy -= b._energyCost;
          b._energyOk = true;
        } else {
          const avail = Math.max(0, st.energy);
          const deficit = b._energyCost - avail;
          st.energy = 0;
          st.energyDeficits += 1;
          b._energyOk = false;
          b._resourceScale *= Math.max(0.48, 0.45 + 0.55 * (avail / b._energyCost));
          if (st.energyDeficits <= 2) {
            tlDiagnostics.push(
              `[能量断档] ${st.name} 在 ${t.toFixed(1)}s 释放「${b.label}」时能量仅 ${avail.toFixed(0)}/${b._energyCost} (缺口 ${deficit.toFixed(0)} 点)，动作已按普攻垫刀折算`
            );
          }
        }
        if (st.energy < st.energyMin) st.energyMin = st.energy;
      }

      // Dialyn grants 1 Free Upgraded Ultimate token to Slot 0 Attack/Rupture carry
      if (b._grantsFreeUlt) {
        const carrySt = agentStates.get(activeMembers[0].ch.id);
        if (carrySt && isDpsRole(carrySt.m.ch.wt) && carrySt.cid !== st.cid) {
          carrySt.freeUltTokens = Math.min(1, carrySt.freeUltTokens + 1);
        }
      }

      // Decibel expenditure on Ultimate (3000 cost, or 0 if Dialyn Free Ult token available)
      if (b.cat === "ult") {
        if (st.freeUltTokens > 0) {
          st.freeUltTokens -= 1;
          st.freeUltsUsed += 1;
          st.ultsUsed += 1;
          b._decibelOk = true;
        } else if (st.decibel + 1e-3 >= 3000) {
          st.decibel -= 3000;
          st.ultsUsed += 1;
          b._decibelOk = true;
        } else {
          const avail = Math.max(0, st.decibel);
          const deficit = 3000 - avail;
          st.decibel = 0;
          st.decibelDeficits += 1;
          st.ultsUsed += avail / 3000;
          b._decibelOk = false;
          b._resourceScale *= Math.max(0.35, avail / 3000);
          if (st.decibelDeficits <= 2) {
            tlDiagnostics.push(
              `[喧响不足] ${st.name} 在 ${t.toFixed(1)}s 释放终结技时喧响值仅 ${Math.round(avail)}/3000 (缺口 ${Math.round(deficit)} 点)`
            );
          }
        }
        // Ju Fufu (1391) refunds +300 Decibels to Attack/Rupture agents after casting Ultimate!
        if (hasJuFufu && isDpsRole(st.m.ch.wt)) {
          st.decibel = Math.min(st.decibelCap, st.decibel + 300);
          st.decibelEarned += 300;
        }
      }

      // Team-wide instant energy restore (e.g. Yuzuha Ult +25, Nicole/Rina Ult)
      if (b._teamEnergyGen > 0) {
        agentStates.forEach((mate) => {
          mate.energy = Math.min(120, mate.energy + b._teamEnergyGen);
        });
      }

      // Quick Assist & Astral Voice 4pc (+1 stack up to 3, 15s)
      if (b._triggersQA || b.cat === "qa") {
        astralStacks = (t <= astralUntil ? Math.min(3, astralStacks + 1) : 1);
        astralUntil = t + 15.0;
      }

      // Proto Punk 4pc: +15% DMG for 10s on Parry / Assist
      if (b._isParry) {
        protoUntil = t + 10.0;
      }

      // Swing Jazz 4pc: +15% DMG for 12s on Chain or Ultimate
      if (st.fourPc === "摇摆" && (b.cat === "chain" || b.cat === "ult")) {
        swingUntil = t + 12.0;
        buffWindows.push({ id: "swing", label: "摇摆爵士4(+15%伤)", kind: "set", start: t, end: t + 12.0 });
      }

      // Moonlight Lullaby 4pc: +18% DMG for 25s when Support casts EX or Ult
      if (st.fourPc === "月光" && st.m.ch.wt === "Support" && (b.cat === "ex" || b.cat === "ult")) {
        moonlightUntil = t + 25.0;
      }

      // Character-specific Buff Windows (Nicole, Rina M0/M1, Astra, Yuzuha, Veil, etc.)
      if (b.buffTag) {
        const hitDelay = Math.min(0.35, (b.swapDur || 0.6) * 0.45);
        const wStart = t + hitDelay;
        const rinaDur = st.m.m >= 1 ? 11.0 : 5.5;
        const wDur = b.buffTag.id === "rina" ? rinaDur : (b.buffTag.dur || 4.0);
        const wEnd = wStart + wDur;
        buffWindows.push({
          id: b.buffTag.id,
          label: b.buffTag.label,
          kind: "char",
          start: wStart,
          end: wEnd
        });
        if (b.buffTag.id === "nicole") nicoleUntil = Math.max(nicoleUntil, wEnd);
        if (b.buffTag.id === "rina") rinaUntil = Math.max(rinaUntil, wEnd);
      }

      // Hugo (1291) Totalize ("决算"): settles remaining Stun immediately on EX (and Ult at M0~M1)
      if (b._totalizesStun && inStun && stunRemSec > 0.3) {
        const hugoM = st.m.m ?? 0;
        const endsStun = b._totalizesStun === "ex" || hugoM < 2;
        if (endsStun) {
          const settledRem = stunRemSec;
          const dazeRefund = Math.min(0.25, settledRem / maxStunDur * 0.30) * dazeThreshold;
          // Count this Totalize finisher block itself as full Stun damage before closing Stun!
          b._forceFullStun = true;
          inStun = false;
          stunRemSec = 0;
          autoStunEndSec = t + Math.min(1.0, b.totalDur * 0.6);
          dazeGauge = dazeRefund;
          totalizeTriggered = true;
          tlDiagnostics.push(
            `[雨果决算结算] 雨果在失衡剩余 ${settledRem.toFixed(1)}s 时触发【决算】，瞬间引爆倍率并返还 ${Math.round((dazeRefund / dazeThreshold) * 100)}% 失衡值进入下一轮破韧`
          );
        }
      }
    });

    // 2. Passive Energy Regeneration over DT
    agentStates.forEach((st) => {
      st.energy = Math.min(120, st.energy + st.erPerSec * DT);
      if (st.energy < st.energyMin) st.energyMin = st.energy;
    });

    // 3. Active Block Continuous Contributions over DT (Energy gen, Decibel gen, Daze, Anomaly, Buff Coverage)
    if (t > astralUntil) astralStacks = 0;
    const nicoleActive = t <= nicoleUntil || buffWindows.some((w) => w.id === "nicole" && t >= w.start && t <= w.end);
    const rinaActive = t <= rinaUntil || buffWindows.some((w) => w.id === "rina" && t >= w.start && t <= w.end);
    const frostbiteActive = t <= frostbiteUntil;
    const flinchActive = t <= flinchUntil;
    const icefireActive = t <= icefireUntil;
    const protoActive = t <= protoUntil;
    const swingActive = t <= swingUntil;
    const moonlightActive = t <= moonlightUntil;

    sortedBlocks.forEach((b) => {
      if (t < b._startSec || t >= b._endSec) return;
      const st = agentStates.get(b.cid);
      if (!st) return;

      const dur = Math.max(DT, b._endSec - b._startSec);
      const fracDt = DT / dur;
      const effScale = b._effFactor * b._resourceScale;

      // Active hit Energy & Decibels (concentrated during on-field swapDur + 35% off-field linger)
      const inOnField = t < b._swapEndSec;
      const genWeight = inOnField
        ? DT / Math.max(DT, (b._swapEndSec - b._startSec) + 0.35 * b._lingerSec)
        : (0.35 * DT) / Math.max(DT, (b._swapEndSec - b._startSec) + 0.35 * b._lingerSec);

      if (b._energyGen > 0) {
        st.energy = Math.min(120, st.energy + b._energyGen * genWeight);
      }
      if (b._decibelGen > 0) {
        grantDecibels(st.cid, b._decibelGen * genWeight * effScale);
      }

      // Boss Daze accumulation (when out of Stun)
      if (!inStun) {
        const flinchMult = flinchActive ? 1.075 : 1.0;
        const rawDaze = Math.max(0, Number(b.daze) || 120) * effScale * st.dazeMult * flinchMult * fracDt * 1.42;
        dazeGauge += rawDaze;
        if (dazeGauge > peakDaze) peakDaze = dazeGauge;
        if (dazeGauge >= dazeThreshold) {
          inStun = true;
          stunRemSec = maxStunDur;
          dazeGauge = 0;
          peakDaze = dazeThreshold;
          if (!autoStunTriggered) {
            autoStunTriggered = true;
            autoStunStartSec = t;
            autoStunEndSec = Math.min(cycleSec + 4.0, t + maxStunDur);
          }
          grantDecibels(st.cid, 200);
        }
      }

      // Anomaly Gauge Buildup & Authentic `t_rem` Disorder Check
      const icefireMult = icefireActive ? 1.20 : 1.0;
      const deltaAnom = Math.max(0, Number(b.anom) || 140) * effScale * st.anomMult * icefireMult * fracDt;
      const bar = st.bar;
      anomGauges[bar] = (anomGauges[bar] || 0) + deltaAnom;
      if (!st.nonDiluting) {
        if (!anomContribs[bar]) anomContribs[bar] = {};
        anomContribs[bar][st.cid] = (anomContribs[bar][st.cid] || 0) + deltaAnom;
      }

      const barSpec = ANOMALY_BAR_SPECS[bar];
      const barThresh = barSpec.baseGauge * anomResScale;
      if (anomGauges[bar] >= barThresh) {
        anomGauges[bar] -= barThresh;
        const contribMap = anomContribs[bar] || {};
        const totContrib = Object.values(contribMap).reduce((a, v) => a + v, 0);
        const purity = totContrib > 0 ? (contribMap[st.cid] || 0) / totContrib : 1.0;
        anomContribs[bar] = {};

        anomEvents.push({ t, bar, barZh: barSpec.zhName, cid: st.cid, purity });
        grantDecibels(st.cid, 120);

        // Secondary debuff windows
        const ext = barDurExt[bar] || 0;
        if (bar === "Ice" || bar === "Frost") {
          frostbiteUntil = Math.max(frostbiteUntil, t + 10.0 + ext);
          buffWindows.push({ id: "frostbite", label: "霜寒(+10%暴伤)", kind: "debuff", start: t, end: t + 10.0 + ext });
        }
        if (bar === "Physical") {
          flinchUntil = Math.max(flinchUntil, t + 10.0);
        }
        if (bar === "Frost") {
          icefireUntil = Math.max(icefireUntil, t + 10.0);
        }

        // Check if ANY OTHER bar currently has an active Anomaly -> Disorder or 3.0s ICD Collision!
        for (const [otherBarStr, activeInfo] of Object.entries(activeAnomalies)) {
          const otherBar = otherBarStr as AnomalyBarCode;
          if (otherBar === bar || activeInfo.until <= t) continue;
          const tRem = activeInfo.until - t;
          const otherExt = barDurExt[otherBar] || 0;
          if (t - lastDisorderSec < DISORDER_ICD_SEC) {
            disorderEvents.push({
              t,
              triggerBar: bar,
              underlayBar: otherBar,
              underlayZh: ANOMALY_BAR_SPECS[otherBar].zhName,
              tRem,
              mvPct: 0,
              icdBlocked: true
            });
          } else {
            const disMv = calcAuthenticDisorderMv(otherBar, tRem, otherExt);
            lastDisorderSec = t;
            delete activeAnomalies[otherBar];
            grantDecibels(st.cid, 220);
            disorderEvents.push({
              t,
              triggerBar: bar,
              underlayBar: otherBar,
              underlayZh: ANOMALY_BAR_SPECS[otherBar].zhName,
              tRem,
              mvPct: Math.round(disMv * 100),
              icdBlocked: false
            });
          }
          break;
        }

        activeAnomalies[bar] = { start: t, until: t + 10.0 + ext, ownerCid: st.cid };
      }

      // Frame-Accurate Damage & Buff Coverage Integration
      const rawMvSlice = Math.max(10, Number(b.mv) || 1000) * b._effFactor * fracDt;
      st.mvTotal += rawMvSlice;
      st.mvWeightedScaleSum += rawMvSlice * b._resourceScale;
      st.mvTruncLost += Math.max(10, Number(b.mv) || 1000) * (1 - b._effFactor) * fracDt;

      const isBlockInRealStun = inStun || !!b._forceFullStun;
      b._totalTicks += 1;
      if (isBlockInRealStun) {
        b._realStunTicks += 1;
        st.mvRealStun += rawMvSlice;
      }
      if (b.phase === "stun") {
        st.mvTagStun += rawMvSlice;
      }

      if (nicoleActive) st.covNicoleMv += rawMvSlice;
      if (rinaActive) st.covRinaMv += rawMvSlice;
      if (t <= st.hormoneUntil) st.covHormoneMv += rawMvSlice;
      if (frostbiteActive) st.covFrostbiteMv += rawMvSlice;

      const catKey = b.cat === "qa" || b.cat === "parry" ? "dash" : st.catMv[b.cat] !== undefined ? b.cat : "basic";
      st.catMv[catKey] += rawMvSlice;

      squadActiveMvSum += rawMvSlice;
      astralStackWeightedSum += rawMvSlice * astralStacks;
      if (protoActive) protoWeightedSum += rawMvSlice;
      if (swingActive) swingWeightedSum += rawMvSlice;
      if (moonlightActive) moonlightWeightedSum += rawMvSlice;
    });

    // 4. Advance Stun Countdown if in Stun
    if (inStun) {
      // Chain Attacks slightly slow real-time stun gauge decay in ZZZ (~0.55x rate during chain cutscenes)
      const chainRunning = sortedBlocks.some((b) => b.cat === "chain" && t >= b._startSec && t < b._swapEndSec);
      stunRemSec -= DT * (chainRunning ? 0.55 : 1.0);
      if (stunRemSec <= 0) {
        inStun = false;
        stunRemSec = 0;
        autoStunEndSec = t;
      }
    }

    // Record Daze/Stun curve every 0.25s (every 5 steps)
    if (step % 5 === 0 || step === totalSteps) {
      dazeCurve.push({
        t: Number(t.toFixed(2)),
        dazePct: inStun ? 1.0 : Math.min(1.0, dazeGauge / dazeThreshold),
        inStun,
        stunRemSec: Number(stunRemSec.toFixed(2))
      });
    }
  }

  // Finalize per-block real stun fraction & check Stun-phase desyncs
  let stunDesyncBlocks = 0;
  sortedBlocks.forEach((b) => {
    b._realStunFrac = b._totalTicks > 0 ? b._realStunTicks / b._totalTicks : b.phase === "stun" ? 1 : 0;
    if (autoStunTriggered && b.phase === "stun" && b._realStunFrac < 0.25) {
      stunDesyncBlocks += 1;
    }
  });

  const hasStunMember = activeMembers.some((m) => m.ch.wt === "Stun");
  if (stunDesyncBlocks > 0 && hasStunMember && autoStunStartSec !== null) {
    tlDiagnostics.push(
      `[失衡对轴偏移] 排轴中有 ${stunDesyncBlocks} 个标记为「失衡期」的爆发块在 Boss 实际打满失衡(${autoStunStartSec.toFixed(1)}s)前就已出手，未吃到失衡易伤倍率`
    );
  }

  // Resolve Effective Stun Window timestamps (prefer physics-driven Stun window when Stun triggers!)
  let stunStartSec = tagStunStartSec;
  let stunEndSec = tagStunEndSec;
  if (autoStunTriggered && autoStunStartSec !== null) {
    stunStartSec = autoStunStartSec;
    stunEndSec = autoStunEndSec ?? Math.min(cycleSec, autoStunStartSec + maxStunDur);
  } else if (!Number.isFinite(stunStartSec)) {
    stunStartSec = cycleSec * 0.52;
    stunEndSec = cycleSec;
  }

  const dazeFillRatio = autoStunTriggered ? 1.0 : Math.max(0.15, Math.min(0.99, peakDaze / dazeThreshold));
  const bossStunIntervalSec = autoStunTriggered
    ? cycleSec
    : Number(Math.max(cycleSec, cycleSec / Math.max(0.38, dazeFillRatio)).toFixed(2));

  // Compute scale-invariant Reference 1-Rotation MV Budget per Cid (set-neutral so 4pc comparisons stay unbiased)
  const refMembersNeutral = activeMembers.map((m) => ({
    ...m,
    cfg: { ...(m.cfg || {}), fourPc: "啄木" }
  }));
  const refStdBlocks = generateSmartTimeline(refMembersNeutral, makeDefaultSwapConfig("standard"), env);
  const refMvByCid: Record<string, number> = {};
  refStdBlocks.forEach((rb: any) => {
    refMvByCid[rb.cid] = (refMvByCid[rb.cid] || 0) + Math.max(10, Number(rb.mv) || 1000);
  });

  // Per-Cid Coverages, Shares, Stun Shares, Resource Scaling & MV-Volume Conservation
  const carryCid = activeMembers[0].ch.id;
  const hasNicole = activeMembers.some((m) => m.ch.id === "1031");
  const hasRina = activeMembers.some((m) => m.ch.id === "1211");

  const nicoleCovByCid: Record<string, number> = {};
  const rinaCovByCid: Record<string, number> = {};
  const hormoneCovByCid: Record<string, number> = {};
  const frostbiteCovByCid: Record<string, number> = {};
  const resourceScaleByCid: Record<string, number> = {};
  const mvVolumeByCid: Record<string, number> = {};
  const sharesByCid: Record<string, any> = {};
  const stunShareByCid: Record<string, number> = {};
  const truncLoss: number[] = [];
  const slotWeightMult: number[] = [];
  const ultsPerCycle: number[] = [];
  const agentTelemetry: any[] = [];

  const mainMv = Math.max(1, agentStates.get(carryCid)?.mvTotal || 1);

  activeMembers.forEach((m, i) => {
    const cid = m.ch.id;
    const st = agentStates.get(cid)!;
    const tot = st.mvTotal;
    const tr = st.mvTruncLost;
    truncLoss.push(tot + tr > 0 ? tr / (tot + tr) : 0);

    const resScale = tot > 0 ? Math.max(0.45, Math.min(1.05, st.mvWeightedScaleSum / tot)) : 1.0;
    resourceScaleByCid[cid] = resScale;

    const refMv = Math.max(1200, refMvByCid[cid] || 2400);
    const mvVol = Math.max(0.12, Math.min(2.60, st.mvWeightedScaleSum / refMv));
    mvVolumeByCid[cid] = mvVol;

    const nCov = hasNicole && tot > 0 ? Math.min(1.0, Math.max(0.20, st.covNicoleMv / tot)) : 1.0;
    const rCov = hasRina && tot > 0 ? Math.min(1.0, Math.max(0.25, st.covRinaMv / tot)) : 1.0;
    const hCov = st.fourPc === "激素" && tot > 0 ? Math.min(1.0, Math.max(0.15, st.covHormoneMv / tot)) : 1.0;
    const fCov = tot > 0 ? Math.min(1.0, st.covFrostbiteMv / tot) : 0;

    nicoleCovByCid[cid] = nCov;
    rinaCovByCid[cid] = rCov;
    hormoneCovByCid[cid] = hCov;
    frostbiteCovByCid[cid] = fCov;

    if (st.fourPc === "激素" && hCov < 0.62 && i === 0) {
      tlDiagnostics.push(
        `[激素朋克断档] ${st.name} 携带【激素朋克4】(进场10s加成/20s冷却)，因前期过早切入站场导致主力爆发覆盖率仅 ${(hCov * 100).toFixed(0)}%`
      );
    }

    if (tot > 0) {
      const asShare = Math.min(0.75, Math.max(0, m.ch.prof?.shares?.aftershock || 0));
      const nonAsScale = 1.0 - asShare;
      sharesByCid[cid] = {
        basic: (st.catMv.basic / tot) * nonAsScale,
        dash: (st.catMv.dash / tot) * nonAsScale,
        ex: (st.catMv.ex / tot) * nonAsScale,
        chain: (st.catMv.chain / tot) * nonAsScale,
        ult: (st.catMv.ult / tot) * nonAsScale,
        aftershock: asShare
      };

      if (autoStunTriggered) {
        stunShareByCid[cid] = Math.min(0.96, Math.max(0.12, st.mvRealStun / tot));
      } else {
        // Multi-cycle steady-state stun overlap when single rotation builds partial Daze (<100%)
        const steadyRatio = Math.min(0.65, maxStunDur / Math.max(16.0, bossStunIntervalSec));
        const tagShare = st.mvTagStun / tot;
        stunShareByCid[cid] = Math.min(0.75, Math.max(0.22, steadyRatio * (0.85 + 0.65 * tagShare)));
      }
    }

    slotWeightMult.push(i === 0 ? 1.0 : Math.min(1.35, Math.max(0.45, tot / mainMv / 0.42)));
    const steadyUlts = Math.max(0.55, Math.min(1.65, st.ultsUsed > 0 ? st.ultsUsed : st.decibelEarned / 2850));
    ultsPerCycle.push(steadyUlts);

    agentTelemetry.push({
      cid,
      name: st.name,
      slotIdx: m.slotIdx,
      fourPc: st.fourPc,
      erPerSec: Number(st.erPerSec.toFixed(2)),
      energyStart: Math.round(st.energyStart),
      energyMin: Math.round(st.energyMin),
      energyEnd: Math.round(st.energy),
      energyDeficits: st.energyDeficits,
      decibelCap: st.decibelCap,
      decibelStart: Math.round(st.decibelStart),
      decibelEarned: Math.round(st.decibelEarned),
      decibelPeak: Math.round(st.decibelPeak),
      decibelEnd: Math.round(st.decibel),
      decibelDeficits: st.decibelDeficits,
      ultsUsed: Number(st.ultsUsed.toFixed(2)),
      freeUltsUsed: st.freeUltsUsed,
      nicoleCov: hasNicole ? nCov : null,
      rinaCov: hasRina ? rCov : null,
      hormoneCov: st.fourPc === "激素" ? hCov : null,
      frostbiteCov: fCov,
      resourceScale: Number(resScale.toFixed(3)),
      mvVolume: Number(mvVol.toFixed(3))
    });
  });

  // Aggregate Disorder telemetry
  const validDisorders = disorderEvents.filter((d) => !d.icdBlocked);
  const disorderIcdHits = disorderEvents.filter((d) => d.icdBlocked).length;
  const disorderCount = validDisorders.length;
  const disorderAvgMv =
    disorderCount > 0
      ? validDisorders.reduce((s, d) => s + d.mvPct / 100.0, 0) / disorderCount
      : null;
  const disorderAvgRemSec =
    disorderCount > 0
      ? validDisorders.reduce((s, d) => s + d.tRem, 0) / disorderCount
      : null;

  // Squad-level set coverages
  const astralStacksAvg =
    squadActiveMvSum > 0 ? Math.min(3.0, Math.max(0, astralStackWeightedSum / squadActiveMvSum)) : 0;
  const protoCov = squadActiveMvSum > 0 ? Math.min(1.0, protoWeightedSum / squadActiveMvSum) : 0;
  const swingCov =
    activeMembers.some((m) => (m.fourPc || m.cfg?.fourPc || m.ch.def4pc) === "摇摆") && squadActiveMvSum > 0
      ? Math.min(1.0, Math.max(0.25, swingWeightedSum / squadActiveMvSum))
      : null;
  const moonlightCov =
    activeMembers.some((m) => (m.fourPc || m.cfg?.fourPc || m.ch.def4pc) === "月光") && squadActiveMvSum > 0
      ? Math.min(1.0, Math.max(0.50, moonlightWeightedSum / squadActiveMvSum))
      : null;

  // Assist Point Economy in Timeline
  const totalChains = sortedBlocks.filter((b) => b.cat === "chain").length;
  const totalUlts = agentTelemetry.reduce((s, a) => s + a.ultsUsed, 0);
  const assistEarned = Math.min(9.0, totalChains * 1.0 + totalUlts * 1.35);
  const costPerParry = activeMembers.some((m) => m.ch.wt === "Defense" || m.ch.id === "1161") ? 0.85 : 1.15;
  const assistSpent = parryCount * costPerParry;
  const assistNet = assistEarned - assistSpent;

  return {
    active: true,
    blockCount: blocks.length,
    seqCycleSec,
    cycleSec,
    savedSec,
    overlapPct,
    safeSwaps,
    exposedSwaps,
    exposedSec,
    stunStartSec,
    stunEndSec,
    outStunSec: Math.max(2.0, stunStartSec),
    inStunSec: Math.max(2.5, stunEndSec - stunStartSec),
    bossStunIntervalSec,
    nicoleCov: hasNicole ? nicoleCovByCid[carryCid] : null,
    rinaCov: hasRina ? rinaCovByCid[carryCid] : null,
    hormoneCov: agentTelemetry[0]?.hormoneCov ?? null,
    protoCov,
    swingCov,
    moonlightCov,
    astralStacksAvg,
    nicoleCovByCid,
    rinaCovByCid,
    hormoneCovByCid,
    frostbiteCovByCid,
    totalQA: Math.max(0.5, totalQA),
    parryCount,
    assistEarned,
    assistSpent,
    assistNet,
    chainCountCarry: Math.max(1, chainCountCarry),
    truncLoss,
    buffWindows,
    sharesByCid,
    stunShareByCid,
    slotWeightMult,
    ultsPerCycle,
    resourceScaleByCid,
    mvVolumeByCid,
    agentTelemetry,
    dazeCurve,
    autoStunTriggered,
    autoStunStartSec,
    autoStunEndSec,
    dazeFillRatio,
    totalizeTriggered,
    stunDesyncBlocks,
    anomEvents,
    disorderEvents,
    disorderCount,
    disorderAvgMv,
    disorderAvgRemSec,
    disorderIcdHits,
    tlDiagnostics
  };
}

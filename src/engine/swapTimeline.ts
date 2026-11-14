// --- MODULE: swap_and_timeline.js ---
// ============================================================================
// ZZZ v3.3 Authentic 8-Dimension Swap-Cancel ("合轴") Physics Engine
// & Interactive Multi-Track Action Timeline Sequencer
// ============================================================================

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

export function getCharSwapProfile(ch) {
  if (ch && ch.swapProfile) return ch.swapProfile;
  const wt = ch ? ch.wt : "Attack";
  return {
    archetype: (wt === "Support" || wt === "Stun" || wt === "Defense") ? "quick_swap" : "burst_commit",
    commitSec: 1.25,
    safety: "assist_protected",
    channelPenalty: 0.0,
    cancelGain: 0.06,
    qaOut: (wt === "Support" || wt === "Defense") ? 1.5 : (wt === "Stun" ? 0.6 : 0.2),
    qaCoef: 0.04,
    heavySpeed: 0.80,
    note: "自定义角色通用合轴动作模组"
  };
}

/**
 * Evaluates all 8 ZZZ Swap-Cancel dimensions and computes cycle physics:
 * - Out-of-stun buildup seconds, In-stun burst seconds, Parallel commit compression, Total Cycle Seconds
 * - Safe vs Dodge-Cancel vs Exposed swap seconds & High-Aggro interruption risk
 * - Quick Assist frequency & Astral Voice 4pc stacks
 * - Short-buff burst coverage (Nicole 3.5s, Rina M0 5.5s, Hormone Punk 10s)
 * - Chain Cancel Tech (1x / 2x / 3x+ Carry Chains) -> dynamic chain share & stun time budget
 * - Dodge-Counter + Defensive Assist ("闪A振刀/双反") -> extra Daze, Proto Punk coverage, Assist Point loop
 * - Recovery / Input-Buffer Cancel ("闪A/目押取消后摇")
 * - Anomaly 99% Pre-Stack & 3.0s Disorder ICD check + 1.4+ Independent Decibel Ultimate frequency
 */
export function evalSwapCancelEngine(activeMembers, swapCfgInput, env: any = {}, bangboo = null, timelineOverride = null) {
  const n = activeMembers.length;
  const sc = swapCfgInput || makeDefaultSwapConfig(env.swapMode || "standard");

  if (n === 0) {
    return {
      mode: sc.preset || "standard",
      config: sc,
      totalQA: 0, astralStacks: 0, astralDmg: 0, pingPong: false,
      nicoleCov: 1.0, rinaCovM0: 1.0, hormoneCov: 1.0, protoCov: 0,
      chainCountCarry: 0, chainShareMult: [1], ultShareMult: [1],
      parryCount: 0, assistEarned: 0, assistSpent: 0, assistNet: 0,
      seqCycleSec: 20.0, outStunSec: 10.0, inStunSec: 10.0, savedOverlapSec: 0, cycleSec: 20.0,
      cycleSpeedup: 1.0, exposedSec: 0, interruptPenalty: 1.0, channelTruncLoss: [0],
      disorderBonusSec: 0, disorderIcdWarning: false, ultsPerCycle: [1],
      realStunShare: {}, slotActionMult: [1], weightMult: [1], diagnostics: []
    };
  }

  const profiles = activeMembers.map(m => getCharSwapProfile(m.ch));
  const isDpsRole = wt => wt === "Attack" || wt === "Anomaly" || wt === "Rupture" || wt === "Armorer";
  const dpsIndices = activeMembers.map((m, i) => isDpsRole(m.ch.wt) ? i : -1).filter(i => i >= 0);
  const mainIdx = dpsIndices.length >= 1 ? dpsIndices[0] : 0;

  if (n === 1) {
    const p0 = profiles[0];
    const cancelBonus = (p0.cancelGain || 0.06) * (sc.cancelDensity - 0.55);
    const soloCycle = Math.max(12.0, 20.0 * (1.0 - 0.06 * sc.cancelDensity));
    return {
      mode: sc.preset || "standard",
      config: sc,
      totalQA: 0, astralStacks: 0, astralDmg: 0, pingPong: false,
      nicoleCov: 1.0, rinaCovM0: 1.0, hormoneCov: 0.75, protoCov: sc.parryCount > 0 ? 0.5 : 0,
      chainCountCarry: 1, chainShareMult: [1.0], ultShareMult: [1.0],
      parryCount: 0, assistEarned: 3, assistSpent: 0, assistNet: 3,
      seqCycleSec: 20.0, outStunSec: soloCycle * 0.62, inStunSec: soloCycle * 0.38, savedOverlapSec: 20.0 - soloCycle, cycleSec: soloCycle,
      cycleSpeedup: 20.0 / soloCycle, exposedSec: 0, interruptPenalty: 1.0, channelTruncLoss: [0],
      disorderBonusSec: 0, disorderIcdWarning: false, ultsPerCycle: [1.0],
      realStunShare: { [activeMembers[0].ch.id]: 0.38 },
      slotActionMult: [Math.max(0.88, 1.0 + cancelBonus)],
      weightMult: [1.0],
      diagnostics: ["单人站场基准：无队友切人合轴与快速支援，仅受角色自身预输入/后摇取消影响"]
    };
  }

  const diagnostics = [];
  const hasAstra = activeMembers.some(m => m.ch.id === "1311");
  const hasDialyn = activeMembers.some(m => m.ch.id === "1481");
  const hasNorm = activeMembers.some(m => m.ch.id === "1571");
  const hasJuFufu = activeMembers.some(m => m.ch.id === "1391");
  const hasStun = activeMembers.some(m => m.ch.wt === "Stun");
  const hasDefAssist = activeMembers.some(m => m.ch.defAssist);
  const hasShielder = activeMembers.some(m => getCharSwapProfile(m.ch).shieldProtectsSwap) || !!(bangboo && bangboo.safeHeal);

  // 1. Quick Assist Ping-Pong & Astral Voice 4pc Stacking
  const perMemberQA = activeMembers.map((m, i) => {
    const cid = m.ch.id;
    let base = profiles[i].qaOut;
    if (base === undefined) base = (m.ch.wt === "Support" || m.ch.wt === "Defense") ? 1.4 : (m.ch.wt === "Stun" ? 0.5 : 0.2);
    if (cid === "1311" && m.m >= 2) base += 0.6;
    if (cid === "1411" && m.m >= 2) base += 0.4;
    return base;
  });
  const qaGenerators = perMemberQA.filter(v => v >= 1.25).length;
  const pingPong = qaGenerators >= 2 && (hasAstra || sc.commitOverlap >= 0.45);
  const parryQA = hasDefAssist ? Math.min(2.2, sc.parryCount * 0.42) : 0;
  const rawQASum = 0.55 + perMemberQA.reduce((a, b) => a + b, 0) + (pingPong ? 0.55 : 0) + parryQA * 0.35;
  const totalQA = (sc.qaManual !== null && sc.qaManual !== undefined && sc.qaManual >= 0)
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

    // Channeled skill truncation check (Piper EX spin, Corin chainsaw, Anton drill, etc.)
    if ((p.channelPenalty || 0) > 0) {
      if (sc.protectChanneled !== false) {
        // Player waits for finisher before swapping -> safe from truncation, less frame compression
        effOverlapRate *= 0.48;
      } else if (sc.commitOverlap > 0.55) {
        const trunc = (sc.commitOverlap - 0.55) * (p.channelPenalty * 1.45);
        channelTruncLoss[i] = Math.min(0.28, trunc);
        diagnostics.push(`[断招警告] ${m.ch.n} 属于持续引导型技能，当前强行早切合轴导致约 ${(channelTruncLoss[i] * 100).toFixed(1)}% 尾段倍率丢失（建议开启「保护持续引导技收尾」或延后切人帧）`);
      }
    }

    // Safety policy handling: Safe-Only vs Dodge-Cancel vs Aggressive Exposed
    const baseCommit = (p.commitSec || 1.2) * swapsPerCycle;
    if (p.safety === "unsafe_exposed") {
      if (sc.safetyPolicy === "safe_only") {
        effOverlapRate *= 0.35; // Only swap on EX/Ult i-frames
      } else if (sc.safetyPolicy === "dodge_cancel") {
        effOverlapRate *= 0.78;
        dodgeOverheadSec += 0.18 * swapsPerCycle * sc.commitOverlap;
        exposedSec += baseCommit * effOverlapRate * 0.12;
      } else {
        // aggressive: full frame overlap, exposed lingering hitbox on field!
        exposedSec += baseCommit * effOverlapRate * 0.72;
      }
    } else if (p.safety === "assist_protected") {
      if (sc.safetyPolicy === "aggressive") exposedSec += baseCommit * effOverlapRate * 0.18;
    }

    rawOverlapPool += baseCommit * effOverlapRate;
  });

  // High-aggro interruption risk when doing exposed unsafe swap-cancels
  const highAggro = !!(env.highAggro || env.stageBuffs?.highAggro);
  const aggroIntensity = env.enemyAggro !== undefined ? Number(env.enemyAggro) : (highAggro ? 0.85 : 0.12);
  let interruptPenalty = 1.0;
  if (exposedSec > 0.6 && aggroIntensity > 0.05) {
    const shieldMitigation = hasShielder ? 0.55 : 1.0;
    const loss = Math.min(0.18, exposedSec * 0.022 * aggroIntensity * shieldMitigation);
    if (highAggro || aggroIntensity >= 0.4) {
      interruptPenalty = 1.0 - loss;
      diagnostics.push(`[危险合轴风险] 当前激进裸露驻场约 ${exposedSec.toFixed(1)}s/轮，在高压高攻击欲环境下预计产生 ${(loss * 100).toFixed(1)}% 后台受击硬直/掉人折损（切换为「安全合轴」或「闪避垫步」可消除）`);
    }
  }

  // 3. Short-Window Buff Weaving (Nicole 3.5s, Rina M0 5.5s, Hormone Punk 10s, Proto Punk 10s)
  const weave = Math.max(0.4, Math.min(1.0, sc.buffWeave ?? 0.90));
  const nicoleBase = 0.62 + 0.34 * weave + (hasAstra ? 0.05 : 0) + (pingPong ? 0.03 : 0);
  const nicoleCov = Math.min(1.0, Math.max(0.55, nicoleBase));
  const rinaCovM0 = Math.min(1.0, Math.max(0.60, 0.66 + 0.32 * weave + (totalQA >= 3.5 ? 0.04 : 0)));
  const hormoneCov = Math.min(1.0, 0.68 + 0.28 * weave);
  const protoCov = hasDefAssist && sc.parryCount >= 1.5 ? Math.min(1.0, 0.55 + sc.parryCount * 0.14) : (sc.parryCount > 0 ? 0.45 : 0.15);

  // 4. Stun Chain Cancel Tech (Single / Standard 3-Chain / Manual Cancel Double Carry / Triple-Quad Carry)
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
    const minHeavy = Math.min(...profiles.filter((_, j) => j !== mainIdx).map(p => p.heavySpeed || 0.80));
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

  // 5. Dodge-Counter + Defensive Assist Simultaneous Parry ("闪A振刀 / 双反") & Assist Point Economy
  const effParry = hasDefAssist ? Math.max(0, Number(sc.parryCount) || 0) : 0;
  if (!hasDefAssist && (sc.parryCount || 0) >= 2) {
    diagnostics.push(`[招架提示] 当前全队均为【回避支援】角色（无招架支援振刀），黄光将触发时停回避支援而非双反弹刀削韧`);
  }

  // 6. Independent Decibel Economy (1.4+ 3000/4000 cap) & Ultimate Frequency
  const ultsPerCycle = activeMembers.map((m, i) => {
    const p = profiles[i];
    let decibelGen = (i === mainIdx ? 2350 : 1950)
      + effParry * 115
      + (chainCountCarry - 1) * (i === mainIdx ? 220 : 90)
      + (p.decibelBonus || 0)
      + (hasJuFufu ? 300 : 0);
    if (sc.decibelSync === "double_ult") decibelGen *= 1.16;
    else if (sc.decibelSync === "sequential") decibelGen *= 0.90;
    let ults = Math.min(hasJuFufu || m.ch.id === "1551" ? 1.65 : 1.35, Math.max(0.60, decibelGen / 2850));
    if (i === mainIdx && hasDialyn && isDpsRole(m.ch.wt)) ults += 0.42; // Dialyn chain-to-free-Ult
    return ults;
  });

  const ultShareMult = activeMembers.map((m, i) => 0.75 + 0.25 * ultsPerCycle[i]);

  // Assist Point Loop: +3 per Ult, +1 per Chain triggered, -1 per Parry (reduced for Defense/Qingyi/Lighter)
  const totalChains = effChainTech === "single_skip" ? 1 : (effChainTech === "triple_carry" ? 3.5 : 2.5);
  const avgUltSum = ultsPerCycle.reduce((a, b) => a + b, 0);
  const assistEarned = Math.min(9.0, totalChains * 1.0 + avgUltSum * 1.35);
  const costPerParry = activeMembers.some(m => m.ch.wt === "Defense" || m.ch.id === "1161") ? 0.85 : 1.15;
  const assistSpent = effParry * costPerParry;
  const assistNet = assistEarned - assistSpent;
  if (assistNet < -0.6) {
    diagnostics.push(`[支援点透支警告] 每轮振刀消耗约 ${assistSpent.toFixed(1)} 点 > 连携/大招回复 ${assistEarned.toFixed(1)} 点，长线第2轮后将出现红光无法招架，建议下调振刀次数或穿插大招回点`);
  }

  // 7. Cycle Timing Physics: Out-of-Stun Buildup + Stun Burst Window - Parallel Commit Compression
  const stunCount = activeMembers.filter(m => m.ch.wt === "Stun").length;
  const dazeThreshold = Math.max(1500, Number(env.dazeThreshold) || 4200);
  const baseDazeRate = (stunCount >= 2 ? 410 : (stunCount === 1 ? 320 : 195)) * (1 + (bangboo?.dazeBonus || 0));
  const parryDazeGain = effParry * (stunCount >= 1 ? 310 : 240);
  const rawOutSec = Math.max(4.8, (dazeThreshold - parryDazeGain) / Math.max(120, baseDazeRate));

  const stunExt = activeMembers.reduce((s, m, idx) => s + (profiles[idx].stunExtSec || 0), 0)
    + (activeMembers.some(m => ["1471", "1511", "1571", "1621"].includes(m.ch.id)) ? 1.5 : 0);
  const inStunSec = Math.max(7.0, (Number(env.stunDurationBase) || 12.0) + stunExt);

  const seqCycleSec = rawOutSec + inStunSec + chainTimeOverhead * 0.45;
  const maxCompress = seqCycleSec * 0.34;
  const savedOverlapSec = Math.max(0, Math.min(maxCompress, rawOverlapPool * 0.52 - dodgeOverheadSec));
  const outStunSec = Math.max(4.2, rawOutSec - savedOverlapSec * 0.72);
  let cycleSec = Math.max(11.5, outStunSec + inStunSec - savedOverlapSec * 0.28);

  // Reference baseline cycle for standard rotation (~20.0s)
  const stdBaselineSec = rawOutSec + inStunSec - Math.min(maxCompress, (n * 2.1 * 0.74) * 0.42);
  const cycleSpeedup = Math.max(0.75, Math.min(1.42, stdBaselineSec / cycleSec));

  // Real Stun Share derived from cycle physics & burst concentration
  const realStunShare = {};
  activeMembers.forEach((m, i) => {
    const profShare = m.ch.prof?.stun_share || 0.50;
    const timeRatio = inStunSec / cycleSec;
    // Burst concentration shifts more MV into stun window when double-chain & decibel alignment are active
    const conc = (i === mainIdx ? 1.28 : 1.05) * (sc.decibelSync === "sequential" ? 0.92 : 1.04);
    const physShare = Math.min(0.92, Math.max(0.20, timeRatio * conc));
    realStunShare[m.ch.id] = 0.45 * profShare + 0.55 * physShare;
  });

  // 8. Anomaly 99% Pre-Stack & 3.0s Disorder ICD Check
  const anomCount = activeMembers.filter(m => m.ch.wt === "Anomaly").length;
  let disorderBonusSec = 0;
  let disorderIcdWarning = false;
  if (sc.anomPrestack === "prestack_99") {
    disorderBonusSec = 2.0;
    if (anomCount >= 3 && cycleSec < 14.5) {
      disorderIcdWarning = true;
      diagnostics.push(`[紊乱3s冷却提示] 三异常极限合轴轴长已压缩至 ${cycleSec.toFixed(1)}s，请注意绝区零存在【3.0秒紊乱内置CD】，切勿在3秒内连续引爆同目标第2次紊乱以免吞结算`);
    }
  } else if (sc.anomPrestack === "none") {
    disorderBonusSec = -1.5;
  }

  // Per-Slot Action Multiplier (DPR gain from QA kit triggers, cancel density, chain cancels, minus truncation/interruption)
  const slotActionMult = activeMembers.map((m, i) => {
    const p = profiles[i];
    const qaIn = Math.min(1.0, Math.max(0, (totalQA - perMemberQA[i] * 0.50) / 3.6));
    const qaBonus = (p.qaCoef || 0.035) * qaIn;

    // Cancel tech bonus (闪A电壶 / 醉花月 / 火刀目押)
    const cancelBonus = (p.cancelGain || 0.06) * ((sc.cancelDensity ?? 0.60) - 0.50) * 1.15;

    // Chain cancel MV gain on main carry
    const chainSh = m.ch.prof?.shares?.chain || 0.08;
    const chainGain = (i === mainIdx && ( hasStun || hasAstra ))
      ? (chainCountCarry - 1.55) * 0.22 * chainSh
      : 0;

    // Simultaneous off-field hit density gain during stun & overlap
    const overlapActionGain = (sc.commitOverlap - 0.60) * 0.085 * (p.commitSec / 1.5);

    const truncMult = 1.0 - (channelTruncLoss[i] || 0);
    return Math.max(0.78, (1.0 + qaBonus + cancelBonus + chainGain + overlapActionGain) * truncMult * interruptPenalty);
  });

  const weightMult = activeMembers.map((m, i) => {
    if (i === mainIdx) return 1.0;
    const p = profiles[i];
    const fit = Math.min(1.2, (p.commitSec || 1.2) / 1.45);
    return Math.max(0.78, 0.86 + 0.24 * sc.commitOverlap * fit + (pingPong && m.ch.id === "1031" ? 0.04 : 0));
  });

  // Timeline Direct Override if coupled!
  if (timelineOverride && timelineOverride.active && timelineOverride.cycleSec > 4) {
    cycleSec = timelineOverride.cycleSec;
    return {
      mode: "timeline_exact",
      config: sc,
      totalQA: timelineOverride.totalQA ?? totalQA,
      astralStacks: Math.min(3.0, Math.max(0.4, (timelineOverride.totalQA ?? totalQA) * 0.58)),
      astralDmg: (Math.min(3.0, Math.max(0.4, (timelineOverride.totalQA ?? totalQA) * 0.58)) / 3.0) * 0.24,
      pingPong,
      nicoleCov: timelineOverride.nicoleCov ?? nicoleCov,
      rinaCovM0: timelineOverride.rinaCov ?? rinaCovM0,
      hormoneCov, protoCov,
      chainCountCarry: timelineOverride.chainCountCarry ?? chainCountCarry,
      chainShareMult, ultShareMult,
      parryCount: timelineOverride.parryCount ?? effParry,
      assistEarned, assistSpent, assistNet,
      seqCycleSec: timelineOverride.seqCycleSec || seqCycleSec,
      outStunSec: timelineOverride.outStunSec || outStunSec,
      inStunSec: timelineOverride.inStunSec || inStunSec,
      savedOverlapSec: timelineOverride.savedSec ?? savedOverlapSec,
      cycleSec,
      cycleSpeedup: Math.max(0.65, Math.min(1.60, stdBaselineSec / cycleSec)),
      exposedSec: timelineOverride.exposedSec ?? exposedSec,
      interruptPenalty,
      channelTruncLoss: timelineOverride.truncLoss || channelTruncLoss,
      disorderBonusSec, disorderIcdWarning, ultsPerCycle,
      realStunShare: timelineOverride.stunShareByCid || realStunShare,
      slotActionMult: slotActionMult.map((v, idx) => v * (1 - (timelineOverride.truncLoss?.[idx] || 0)) / Math.max(0.1, 1 - (channelTruncLoss[idx] || 0))),
      weightMult: timelineOverride.slotWeightMult || weightMult,
      timelineSharesByCid: timelineOverride.sharesByCid || null,
      diagnostics: [...diagnostics, `[实轴锁定结算] 当前直接由排轴工作台(${timelineOverride.blockCount}个动作块，总轴长 ${cycleSec.toFixed(1)}s)驱动倍率占比与覆盖率`]
    };
  }

  return {
    mode: sc.preset || "custom",
    config: sc,
    totalQA, astralStacks, astralDmg, pingPong,
    nicoleCov, rinaCovM0, hormoneCov, protoCov,
    chainCountCarry, chainShareMult, ultShareMult,
    parryCount: effParry, assistEarned, assistSpent, assistNet,
    seqCycleSec, outStunSec, inStunSec, savedOverlapSec, cycleSec,
    cycleSpeedup, exposedSec, interruptPenalty, channelTruncLoss,
    disorderBonusSec, disorderIcdWarning, ultsPerCycle,
    realStunShare, slotActionMult, weightMult,
    timelineSharesByCid: null,
    diagnostics
  };
}

// ============================================================================
// Interactive Action Move Templates & Smart Timeline Generator
// ============================================================================

export const SPECIFIC_CHAR_MOVES: any = {
  "1091": [
    { key: "miy_c3", label: "三蓄·霜月拔刀斩", cat: "basic", totalDur: 2.65, minSwap: 0.50, mv: 4200, daze: 180, anom: 320, safety: "safe_iframe" },
    { key: "miy_ex", label: "强化E·落霜二连", cat: "ex", totalDur: 1.45, minSwap: 0.85, mv: 1650, daze: 160, anom: 240, safety: "safe_iframe" },
    { key: "miy_b5", label: "五段普攻回霜寒", cat: "basic", totalDur: 2.10, minSwap: 1.55, mv: 1200, daze: 130, anom: 210, safety: "unsafe_exposed" },
    { key: "miy_ult", label: "终结技·残雪拔刀", cat: "ult", totalDur: 2.40, minSwap: 1.90, mv: 4800, daze: 280, anom: 360, safety: "safe_iframe" }
  ],
  "1311": [
    { key: "ast_ex", label: "咏叹华彩·驻场和弦", cat: "ex", totalDur: 2.10, minSwap: 0.35, mv: 580, daze: 95, anom: 140, safety: "safe_iframe", triggersQA: true, buffTag: { id: "astral", label: "嘉音1200攻+快支", dur: 20.0 } },
    { key: "ast_ult", label: "终结技·协奏强转双连携", cat: "ult", totalDur: 2.20, minSwap: 1.60, mv: 2100, daze: 220, anom: 220, safety: "safe_iframe", triggersQA: true, buffTag: { id: "astra_chain", label: "强转连携x2", dur: 15.0 } }
  ],
  "1031": [
    { key: "nic_ex", label: "蓄力强E·朝天炮能量场", cat: "ex", totalDur: 1.65, minSwap: 0.45, mv: 920, daze: 140, anom: 230, safety: "safe_iframe", triggersQA: true, buffTag: { id: "nicole", label: "妮可40%减防", dur: 4.2 } },
    { key: "nic_qa", label: "快支偷球·续3.5s减防", cat: "qa", totalDur: 1.15, minSwap: 0.35, mv: 540, daze: 95, anom: 165, safety: "assist_protected", buffTag: { id: "nicole", label: "妮可40%减防", dur: 3.6 } },
    { key: "nic_ult", label: "终结技·以太黑洞", cat: "ult", totalDur: 1.95, minSwap: 1.10, mv: 2450, daze: 240, anom: 310, safety: "safe_iframe", triggersQA: true, buffTag: { id: "nicole", label: "妮可40%减防", dur: 4.8 } }
  ],
  "1321": [
    { key: "eve_gar", label: "月夜缠绕·绞索连携", cat: "chain", totalDur: 2.15, minSwap: 0.55, mv: 3450, daze: 190, anom: 190, safety: "safe_iframe" },
    { key: "eve_ex", label: "强化E·束缚聚拢引爆", cat: "ex", totalDur: 1.40, minSwap: 0.70, mv: 1480, daze: 150, anom: 160, safety: "safe_iframe" },
    { key: "eve_ult", label: "终结技·夜幕解放", cat: "ult", totalDur: 2.30, minSwap: 1.70, mv: 4350, daze: 250, anom: 230, safety: "safe_iframe" }
  ],
  "1551": [
    { key: "pyr_ex", label: "强化E·完美格挡反击", cat: "ex", totalDur: 1.75, minSwap: 0.55, mv: 2150, daze: 210, anom: 190, safety: "safe_iframe" },
    { key: "pyr_b", label: "以太剑舞终结连段", cat: "basic", totalDur: 2.05, minSwap: 1.10, mv: 2350, daze: 165, anom: 180, safety: "assist_protected" },
    { key: "pyr_ult", label: "终结技·凯旋归来", cat: "ult", totalDur: 2.35, minSwap: 1.50, mv: 4650, daze: 280, anom: 250, safety: "safe_iframe" }
  ],
  "1371": [
    { key: "yix_ex", label: "玄墨太极·凝炁强E", cat: "ex", totalDur: 1.95, minSwap: 0.55, mv: 2950, daze: 190, anom: 210, safety: "safe_iframe" },
    { key: "yix_ult1", label: "符法终结技·青溟破", cat: "ult", totalDur: 2.25, minSwap: 1.25, mv: 4400, daze: 260, anom: 260, safety: "safe_iframe" },
    { key: "yix_b", label: "玄墨阵眼蓄力连击", cat: "basic", totalDur: 2.00, minSwap: 1.05, mv: 2450, daze: 150, anom: 180, safety: "assist_protected" }
  ],
  "1431": [
    { key: "ysg_ex", label: "明心境·青冥剑意归一", cat: "ex", totalDur: 2.05, minSwap: 0.50, mv: 3100, daze: 175, anom: 200, safety: "safe_iframe" },
    { key: "ysg_b", label: "凛刃执剑四段连斩", cat: "basic", totalDur: 1.95, minSwap: 1.10, mv: 2550, daze: 145, anom: 175, safety: "assist_protected" },
    { key: "ysg_ult", label: "终结技·天裂裁决", cat: "ult", totalDur: 2.40, minSwap: 1.55, mv: 4900, daze: 270, anom: 260, safety: "safe_iframe" }
  ],
  "1581": [
    { key: "rem_ex", label: "强化E·流明圣咏法阵", cat: "ex", totalDur: 1.85, minSwap: 0.40, mv: 1750, daze: 130, anom: 340, safety: "safe_iframe", buffTag: { id: "remiel", label: "蕾米耀化法阵", dur: 14.0 } },
    { key: "rem_ult", label: "终结技·虚芒耀化引爆", cat: "ult", totalDur: 2.15, minSwap: 1.35, mv: 3400, daze: 210, anom: 420, safety: "safe_iframe" }
  ],
  "1561": [
    { key: "vel_ex", label: "强化E·风化涡流牵引", cat: "ex", totalDur: 1.75, minSwap: 0.40, mv: 1550, daze: 140, anom: 330, safety: "safe_iframe", buffTag: { id: "velina", label: "风化涡流领域", dur: 12.0 } },
    { key: "vel_ult", label: "终结技·暴风异放", cat: "ult", totalDur: 2.10, minSwap: 1.30, mv: 3250, daze: 210, anom: 390, safety: "safe_iframe" }
  ],
  "1641": [
    { key: "phx_ex", label: "强化E·烬羽异常暴击环", cat: "ex", totalDur: 1.70, minSwap: 0.42, mv: 1620, daze: 135, anom: 330, safety: "safe_iframe", buffTag: { id: "phione", label: "菲欧妮异常暴击", dur: 14.0 } },
    { key: "phx_ult", label: "终结技·炽翼异放", cat: "ult", totalDur: 2.15, minSwap: 1.35, mv: 3350, daze: 205, anom: 400, safety: "safe_iframe" }
  ],
  "1281": [
    { key: "pip_spin", label: "强化E·引擎转圈接下砸", cat: "ex", totalDur: 2.75, minSwap: 2.15, mv: 2450, daze: 170, anom: 390, safety: "unsafe_exposed" }
  ],
  "1061": [
    { key: "cor_saw", label: "强化E·持续电锯切割爆炸", cat: "ex", totalDur: 2.85, minSwap: 2.25, mv: 2750, daze: 185, anom: 190, safety: "unsafe_exposed" }
  ]
};

export function getMovePoolForChar(ch) {
  const sp = getCharSwapProfile(ch);
  const specific = SPECIFIC_CHAR_MOVES[ch.id] || [];
  const commit = sp.commitSec || 1.25;
  const isChan = sp.archetype === "channeled_lock";
  const generic = [
    {
      key: "gen_ex",
      label: `${ch.n}·强化特殊技`,
      cat: "ex",
      totalDur: isChan ? 2.65 : Math.max(1.30, commit + 0.45),
      minSwap: isChan ? 2.10 : 0.48,
      mv: isChan ? 2350 : 1850,
      daze: ch.wt === "Stun" ? 460 : 165,
      anom: ch.wt === "Anomaly" ? 320 : 150,
      safety: isChan ? "unsafe_exposed" : "safe_iframe",
      triggersQA: ch.wt === "Support" || ch.wt === "Defense" || (sp.qaOut || 0) >= 1.3,
      buffTag: ch.id === "1211" ? { id: "rina", label: "丽娜穿透玩偶", dur: 5.8 }
        : (ch.wt === "Support" ? { id: `sup_${ch.id}`, label: `${ch.n}增益`, dur: 14.0 } : null)
    },
    {
      key: "gen_basic",
      label: `${ch.n}·主力普攻/蓄力段`,
      cat: "basic",
      totalDur: Math.max(1.55, commit + 0.65),
      minSwap: isChan ? 1.80 : Math.max(0.55, 1.85 - commit * 0.65),
      mv: 2100,
      daze: ch.wt === "Stun" ? 390 : 140,
      anom: ch.wt === "Anomaly" ? 270 : 130,
      safety: sp.safety || "assist_protected"
    },
    {
      key: "gen_parry",
      label: `${ch.n}·闪A振刀双反`,
      cat: "dash",
      totalDur: 1.35,
      minSwap: 0.42,
      mv: 1380,
      daze: ch.wt === "Stun" ? 520 : 350,
      anom: 150,
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
      anom: 210,
      safety: "safe_iframe",
      buffTag: ch.id === "1031" ? { id: "nicole", label: "妮可连携减防", dur: 4.0 } : null
    },
    {
      key: "gen_heavy",
      label: `${ch.n}·手动取消重击点连携`,
      cat: "ex",
      totalDur: Math.max(0.65, sp.heavySpeed || 0.78),
      minSwap: Math.max(0.45, (sp.heavySpeed || 0.78) * 0.75),
      mv: 620,
      daze: 90,
      anom: 110,
      safety: "safe_iframe",
      buffTag: ch.id === "1031" ? { id: "nicole", label: "妮可偷球减防", dur: 3.8 } : null
    },
    {
      key: "gen_ult",
      label: `${ch.n}·终结技爆发`,
      cat: "ult",
      totalDur: 2.25,
      minSwap: 1.55,
      mv: 4250,
      daze: ch.wt === "Stun" ? 640 : 260,
      anom: ch.wt === "Anomaly" ? 380 : 220,
      safety: "safe_iframe"
    }
  ];
  const byKey = new Map();
  [...specific, ...generic].forEach(m => byKey.set(m.key, m));
  return [...byKey.values()];
}

export function calcSwapSecForMove(move, swapCfg) {
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
 * Generates an authentic ZZZ multi-track rotation timeline from the current 1~3 agents + swapCfg.
 */
export function generateSmartTimeline(activeMembers, swapCfg, env = {}) {
  if (!activeMembers || activeMembers.length === 0) return [];
  const sc = swapCfg || makeDefaultSwapConfig("standard");
  const blocks = [];
  let cursor = 0.0;
  let uid = 1;

  const pushBlock = (mIdx, move, customPhase = "out") => {
    const m = activeMembers[mIdx];
    const swapDur = calcSwapSecForMove(move, sc);
    const blk = {
      id: `blk_${uid++}`,
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
      swapDur: swapDur,
      mv: move.mv,
      daze: move.daze,
      anom: move.anom,
      safety: move.safety,
      buffTag: move.buffTag ? { ...move.buffTag } : null
    };
    blocks.push(blk);
    cursor = Number((cursor + swapDur).toFixed(2));
    return blk;
  };

  const pools = activeMembers.map(m => getMovePoolForChar(m.ch));
  const pick = (mIdx, catPref) => {
    const pool = pools[mIdx];
    return pool.find(x => x.cat === catPref) || pool[0];
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

  // Phase 1: Opening Support Aura / Off-field Setup & Swap-Cancels
  for (let i = n - 1; i >= 1; i--) {
    pushBlock(i, pick(i, "ex"), "out");
  }
  pushBlock(0, pick(0, "basic"), "out");

  // Phase 2: Parry / Stun Buildup & Swap-Cancel Overlap
  const stunIdx = activeMembers.findIndex(m => m.ch.wt === "Stun");
  const parryActor = stunIdx >= 0 ? stunIdx : (n >= 2 ? 1 : 0);
  if ((sc.parryCount || 0) >= 1.5 && activeMembers[parryActor].ch.defAssist) {
    const parryMove = pools[parryActor].find(x => x.key === "gen_parry") || pick(parryActor, "dash");
    pushBlock(parryActor, parryMove, "out");
  }
  if (stunIdx >= 0) {
    pushBlock(stunIdx, pick(stunIdx, "ex"), "out");
  }
  pushBlock(0, pick(0, "ex"), "out");

  // Phase 3: Stun Chain Sequence (1x / 2x Double Carry Chain / 3x Carry Chain)
  const chainMove0 = pools[0].find(x => x.cat === "chain") || pools[0].find(x => x.key === "gen_chain") || pick(0, "ex");
  const suppIdx = activeMembers.findIndex((m, idx) => idx !== 0 && (m.ch.wt === "Support" || m.ch.wt === "Defense")) !== -1
    ? activeMembers.findIndex((m, idx) => idx !== 0 && (m.ch.wt === "Support" || m.ch.wt === "Defense"))
    : 1;

  pushBlock(0, { ...chainMove0, label: `${activeMembers[0].ch.n}·连携技#1` }, "stun");

  const cTech = sc.chainTech === "auto" ? "double_carry" : sc.chainTech;
  if (cTech === "triple_std") {
    for (let i = 1; i < n; i++) {
      const cm = pools[i].find(x => x.key === "gen_chain") || pick(i, "chain");
      pushBlock(i, cm, "stun");
    }
  } else if (cTech === "double_carry" || cTech === "triple_carry") {
    const heavyTrig = pools[suppIdx].find(x => x.key === "gen_heavy") || pick(suppIdx, "ex");
    pushBlock(suppIdx, heavyTrig, "stun");
    pushBlock(0, { ...chainMove0, label: `${activeMembers[0].ch.n}·双连携#2` }, "stun");
    if (cTech === "triple_carry") {
      const astraIdx = activeMembers.findIndex(m => m.ch.id === "1311");
      if (astraIdx >= 0) pushBlock(astraIdx, pick(astraIdx, "ult"), "stun");
      pushBlock(0, { ...chainMove0, label: `${activeMembers[0].ch.n}·强转三连携#3` }, "stun");
    }
  }

  // Phase 4: Stun Burst Window + Short-Window Buff Weaving (e.g. Nicole 3.5s steal!)
  pushBlock(0, pick(0, "ex"), "stun");
  const nicIdx = activeMembers.findIndex(m => m.ch.id === "1031");
  if (nicIdx >= 0 && (sc.buffWeave ?? 0.9) >= 0.78) {
    const nicSteal = pools[nicIdx].find(x => x.key === "nic_qa") || pick(nicIdx, "ex");
    pushBlock(nicIdx, nicSteal, "stun");
  } else if (n >= 3 && activeMembers[1].ch.wt === "Anomaly") {
    pushBlock(1, pick(1, "ult"), "stun");
  }
  pushBlock(0, pick(0, "ult"), "stun");
  pushBlock(0, pick(0, "basic"), "stun");

  return blocks;
}

/**
 * Analyzes any custom or generated timeline block list and extracts exact frame metrics & engine coupling data.
 */
export function analyzeTimeline(blocks, activeMembers) {
  if (!blocks || blocks.length === 0 || !activeMembers || activeMembers.length === 0) {
    return {
      active: false, blockCount: 0, seqCycleSec: 0, cycleSec: 0, savedSec: 0, overlapPct: 0,
      safeSwaps: 0, exposedSwaps: 0, exposedSec: 0, stunStartSec: 0, stunEndSec: 0,
      outStunSec: 0, inStunSec: 0, nicoleCov: null, rinaCov: null, totalQA: 0, parryCount: 0,
      chainCountCarry: 1, truncLoss: [], buffWindows: [], sharesByCid: {}, stunShareByCid: {}, slotWeightMult: []
    };
  }

  let seqCycleSec = 0;
  let maxEndSec = 0;
  let safeSwaps = 0;
  let exposedSwaps = 0;
  let exposedSec = 0;
  let totalQA = 0;
  let parryCount = 0;
  let chainCountCarry = 0;
  let stunStartSec = Infinity;
  let stunEndSec = 0;

  const buffWindows = [];
  const slotMvSum = new Map();
  const slotTruncMv = new Map();
  const slotCatMv = new Map();
  const slotStunMv = new Map();

  activeMembers.forEach(m => {
    slotMvSum.set(m.ch.id, 0);
    slotTruncMv.set(m.ch.id, 0);
    slotStunMv.set(m.ch.id, 0);
    slotCatMv.set(m.ch.id, { basic: 0, dash: 0, ex: 0, chain: 0, ult: 0, aftershock: 0 });
  });

  blocks.forEach((b, idx) => {
    const start = Math.max(0, Number(b.startSec) || 0);
    const total = Math.max(0.2, Number(b.totalDur) || 1.0);
    const swapD = Math.max(0.15, Math.min(total, Number(b.swapDur) || total));
    const minS = Math.max(0.15, Number(b.minSwap) || total * 0.5);
    const end = start + total;

    seqCycleSec += total;
    if (end > maxEndSec) maxEndSec = end;

    if (b.phase === "stun") {
      if (start < stunStartSec) stunStartSec = start;
      if (end > stunEndSec) stunEndSec = end;
    }

    const linger = Math.max(0, total - swapD);
    if (linger > 0.08 && idx < blocks.length - 1) {
      if (b.safety === "unsafe_exposed") {
        exposedSwaps += 1;
        exposedSec += linger;
      } else {
        safeSwaps += 1;
      }
    }

    // Check early-swap truncation if swapDur < minSwap on channeled/multi-hit moves
    let effFactor = 1.0;
    if (swapD < minS - 0.05) {
      effFactor = Math.max(0.35, swapD / minS);
    }
    const rawMv = Math.max(10, Number(b.mv) || 1000);
    const actualMv = rawMv * effFactor;
    b._truncPct = 1.0 - effFactor;
    b._endSec = end;
    b._lingerSec = linger;

    if (slotMvSum.has(b.cid)) {
      slotMvSum.set(b.cid, slotMvSum.get(b.cid) + actualMv);
      slotTruncMv.set(b.cid, slotTruncMv.get(b.cid) + (rawMv - actualMv));
      if (b.phase === "stun") slotStunMv.set(b.cid, slotStunMv.get(b.cid) + actualMv);
      const cm = slotCatMv.get(b.cid);
      const catKey = (b.cat === "qa" || b.cat === "parry") ? "dash" : (cm[b.cat] !== undefined ? b.cat : "basic");
      cm[catKey] += actualMv;
    }

    if (b.cat === "qa" || b.label.includes("快支")) totalQA += 1;
    if (b.label.includes("咏叹华彩") || b.label.includes("朝天炮") || b.label.includes("以太帷幕")) totalQA += 1.2;
    if (b.label.includes("振刀") || b.cat === "parry") parryCount += 1;
    if (b.cid === activeMembers[0].ch.id && b.cat === "chain") chainCountCarry += 1;

    if (b.buffTag) {
      buffWindows.push({
        id: b.buffTag.id,
        label: b.buffTag.label,
        start: start + Math.min(0.4, swapD * 0.5),
        end: start + Math.min(0.4, swapD * 0.5) + (b.buffTag.dur || 4.0)
      });
    }
  });

  if (!Number.isFinite(stunStartSec)) {
    stunStartSec = maxEndSec * 0.45;
    stunEndSec = maxEndSec;
  }
  const cycleSec = Math.max(4.0, maxEndSec);
  const savedSec = Math.max(0, seqCycleSec - cycleSec);
  const overlapPct = seqCycleSec > 0 ? savedSec / seqCycleSec : 0;

  // Compute Nicole 3.5s coverage on Slot 0 Carry's MV!
  const carryCid = activeMembers[0].ch.id;
  const nicSpans = buffWindows.filter(w => w.id === "nicole");
  let nicoleCov = null;
  if (activeMembers.some(m => m.ch.id === "1031") && nicSpans.length > 0) {
    let coveredMv = 0, totalCarryMv = 0;
    blocks.filter(b => b.cid === carryCid).forEach(b => {
      const bStart = b.startSec, bEnd = b._endSec;
      const dur = Math.max(0.1, bEnd - bStart);
      let covDur = 0;
      const steps = 10;
      for (let s = 0; s < steps; s++) {
        const t = bStart + (s + 0.5) * (dur / steps);
        if (nicSpans.some(w => t >= w.start && t <= w.end)) covDur += dur / steps;
      }
      const mvEff = (b.mv || 1000) * (1 - (b._truncPct || 0));
      coveredMv += mvEff * (covDur / dur);
      totalCarryMv += mvEff;
    });
    nicoleCov = totalCarryMv > 0 ? Math.min(1.0, Math.max(0.35, coveredMv / totalCarryMv)) : 0.90;
  }

  const sharesByCid = {};
  const stunShareByCid = {};
  const truncLoss = [];
  const mainMv = Math.max(1, slotMvSum.get(carryCid) || 1);
  const slotWeightMult = [];

  activeMembers.forEach((m, i) => {
    const cid = m.ch.id;
    const tot = slotMvSum.get(cid) || 0;
    const tr = slotTruncMv.get(cid) || 0;
    truncLoss.push(tot + tr > 0 ? tr / (tot + tr) : 0);
    if (tot > 0) {
      const cm = slotCatMv.get(cid);
      sharesByCid[cid] = {
        basic: cm.basic / tot,
        dash: cm.dash / tot,
        ex: cm.ex / tot,
        chain: cm.chain / tot,
        ult: cm.ult / tot,
        aftershock: m.ch.prof?.shares?.aftershock || 0
      };
      stunShareByCid[cid] = Math.min(0.95, Math.max(0.15, (slotStunMv.get(cid) || 0) / tot));
    }
    slotWeightMult.push(i === 0 ? 1.0 : Math.min(1.35, Math.max(0.45, (tot / mainMv) / 0.42)));
  });

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
    inStunSec: Math.max(3.0, stunEndSec - stunStartSec),
    nicoleCov,
    rinaCov: null,
    totalQA: Math.max(1.0, totalQA),
    parryCount,
    chainCountCarry: Math.max(1, chainCountCarry),
    truncLoss,
    buffWindows,
    sharesByCid,
    stunShareByCid,
    slotWeightMult
  };
}



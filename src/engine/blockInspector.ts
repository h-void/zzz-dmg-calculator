// ============================================================================
// Per-Move / Per-Block Damage & Real-Time Multiplier Inspector
// ============================================================================
// Computes the instantaneous multiplier structure and expected damage share
// for any individual action block in the interactive Gantt swap timeline.
// ============================================================================

import { calcDefLevelFactor } from "./constants";

export interface BlockBuffStatus {
  id: string;
  label: string;
  effectText: string;
  coverage: number; // 0..1
  active: boolean;
}

export interface TimelineBlockDamageDetail {
  agentName: string;
  slotIdx: number;
  formulaType: string;
  blockDmg: number;
  pctOfAgent: number;
  pctOfTeam: number;
  effMv: number;
  rawMv: number;
  truncFactor: number;
  resourceFactor: number;
  baseLabel: string;
  baseVal: number;
  critM: number;
  dmgM: number;
  defM: number;
  resM: number;
  stunMult: number;
  miasmaMult: number;
  realStunFrac: number;
  catSpecBonus: number;
  buffs: BlockBuffStatus[];
}

const CAT_LABELS_ZH: Record<string, string> = {
  basic: "普攻/蓄力",
  dash: "闪反/振刀",
  ex: "强化特殊技",
  chain: "连携技",
  ult: "终结技",
  qa: "快速支援",
  aftershock: "追击"
};

export function getMoveCatLabelZh(cat: string): string {
  return CAT_LABELS_ZH[cat] || cat;
}

/**
 * Evaluates instantaneous multipliers and expected damage for a single timeline block
 * by adjusting the slot's average multipliers for this block's exact stun window,
 * skill category bonus, short-duration buff overlaps, truncation, and resource scaling.
 */
export function evaluateTimelineBlockDetail(
  blk: any,
  sim: any,
  env: any,
  tl: any
): TimelineBlockDamageDetail | null {
  if (!blk || !sim?.slotResults?.length) return null;
  const sr = sim.slotResults.find((r: any) => r.ch?.id === blk.cid) || sim.slotResults[0];
  if (!sr || !sr.bd) return null;

  const bd = sr.bd;
  const ledger = bd.ledger;
  const ch = sr.ch;
  const wt = ch.wt;
  const activeResults: any[] = sim.slotResults || [];

  const hasNicole = activeResults.some((r) => r.ch?.id === "1031");
  const hasRina = activeResults.some((r) => r.ch?.id === "1211");
  const hasHormone = sr.fourPc === "激素";
  const hasAstral = activeResults.some((r) => r.fourPc === "静听");
  const hasSwing = activeResults.some((r) => r.fourPc === "摇摆");
  const hasMoonlight = activeResults.some((r) => r.fourPc === "月光");
  const hasProto = activeResults.some((r) => r.fourPc === "原始");
  const hasIceOrFrost = activeResults.some((r) => r.ch?.eb === "Ice");

  const realStunFrac = Number(blk._realStunFrac ?? (blk.phase === "stun" ? 1 : 0));
  const covNicole = Number(blk._covNicole ?? 0);
  const covRina = Number(blk._covRina ?? 0);
  const covHormone = Number(blk._covHormone ?? 0);
  const covFrostbite = Number(blk._covFrostbite ?? 0);
  const covProto = Number(blk._covProto ?? 0);
  const covSwing = Number(blk._covSwing ?? 0);
  const covMoonlight = Number(blk._covMoonlight ?? 0);
  const avgAstral = Number(blk._avgAstral ?? 0);

  const truncFactor = Number(blk._effFactor ?? 1.0);
  const resourceFactor = Number(blk._resourceScale ?? 1.0);

  // Instantaneous Stun multiplier for this block
  const inStunVal = Number(bd.inStunVal ?? env?.stunMultBase ?? 1.5);
  const outStunVal = Number(bd.outStunVal ?? 1.0);
  const blockStunMult = realStunFrac * inStunVal + (1 - realStunFrac) * outStunVal;

  // Instantaneous Skill-Category DMG% multiplier adjustment
  const catKey = blk.cat === "qa" || blk.cat === "parry" ? "dash" : blk.cat;
  const catSpecBonus = Number(bd.catSpecBonus?.[catKey] || 0);
  const avgSkillWeighted = Number(ledger?.dmg?.skillCatWeighted || 0);
  const avgBaseDmg = Number(bd.baseDmgBonus || 0);
  const miasmaMult = wt === "Rupture" ? 1.0 : Number(bd.miasmaMult ?? 1.0);
  const indepMult = Number(ledger?.dmg?.indepMult ?? 1.0);

  // Adjust DMG% for instantaneous short-buff overlaps vs cycle average
  let dmgDelta = catSpecBonus - avgSkillWeighted;
  if (hasAstral && tl) {
    const avgStacks = Number(tl.astralStacksAvg ?? sim.qaSwap?.astralStacks ?? 0);
    dmgDelta += (avgAstral - avgStacks) * 0.08;
  }
  if (hasSwing && tl) {
    const avgSwing = Number(tl.swingCov ?? 1.0);
    dmgDelta += (covSwing - avgSwing) * 0.15;
  }
  if (hasMoonlight && tl) {
    const avgMl = Number(tl.moonlightCov ?? 1.0);
    dmgDelta += (covMoonlight - avgMl) * 0.18;
  }
  if (hasProto && tl) {
    const avgProto = Number(tl.protoCov ?? 0.7);
    dmgDelta += (covProto - avgProto) * 0.15;
  }
  const blockDmgM = Math.max(0.4, (1.0 + avgBaseDmg + avgSkillWeighted + dmgDelta) * indepMult * miasmaMult);

  // Adjust Base ATK for Hormone Punk window (if equipped on this agent)
  let blockBaseVal = Number(bd.baseVal || 0);
  if (hasHormone && wt !== "Armorer") {
    const avgHorm = Number(tl?.hormoneCovByCid?.[ch.id] ?? 0.55);
    const hormAtkDelta = (covHormone - avgHorm) * 0.25 * Number(sr.st?.init_atk || 0);
    if (wt === "Rupture") {
      blockBaseVal = Math.max(100, blockBaseVal + 0.3 * hormAtkDelta);
    } else {
      blockBaseVal = Math.max(100, blockBaseVal + hormAtkDelta);
    }
  }

  // Adjust CritM for Frostbite (+10% CD)
  let blockCritM = Number(bd.critM || 1.0);
  if (hasIceOrFrost && wt !== "Armorer" && !ch.prof?.anom_split) {
    const avgFb = Number(tl?.frostbiteCovByCid?.[ch.id] ?? sim.ctx?.anomCtx?.frostbiteUptime ?? 0);
    const cdDelta = (covFrostbite - avgFb) * 0.10;
    const effCr = Math.min(1.0, Math.max(0, Number(bd.c_cr || 0)));
    blockCritM = Math.max(1.0, 1.0 + effCr * Math.max(0, Number(bd.c_cd || 0) + cdDelta));
  }

  // Adjust DEF multiplier for Nicole DEF Shred (40%) & Rina PEN Ratio (~30-38%) instantaneous coverage
  let blockDefM = Number(bd.defM || 1.0);
  if (wt !== "Rupture") {
    const avgShred = Number(bd.shred || 0);
    const avgPen = Number(bd.totalPen || 0);
    let instShred = avgShred;
    let instPen = avgPen;
    if (hasNicole && ch.id !== "1031") {
      const avgNic = Number(tl?.nicoleCovByCid?.[ch.id] ?? sim.qaSwap?.nicoleCov ?? 0.7);
      instShred = Math.max(0, Math.min(1.0, avgShred + (covNicole - avgNic) * 0.40));
    }
    if (hasRina && ch.id !== "1211") {
      const avgRin = Number(tl?.rinaCovByCid?.[ch.id] ?? sim.qaSwap?.rinaCovM0 ?? 0.7);
      const rinaSlot = activeResults.find((r) => r.ch?.id === "1211");
      const rinaPenAmt = rinaSlot ? Math.min(0.385, 0.25 * (rinaSlot.st?.init_pen || 0.7) + 0.12) : 0.30;
      instPen = Math.max(0, Math.min(1.0, avgPen + (covRina - avgRin) * rinaPenAmt));
    }
    const defK = Number(bd.defLvFactor || calcDefLevelFactor(60));
    const enemyDef = Number(env?.enemyDef ?? 953);
    const penFlat = Number(bd.s_pen_flat || 0);
    const effDef = Math.max(0, enemyDef * (1 - instShred) * (1 - instPen) - penFlat);
    blockDefM = defK / (defK + effDef);
  }

  const blockResM = Number(bd.resM || 1.0);

  // Compute relative multiplier ratio of this block vs slot's cycle-average multipliers
  const avgProd =
    Math.max(1, Number(bd.baseVal || 1)) *
    Math.max(0.1, Number(bd.critM || 1)) *
    Math.max(0.1, Number(bd.dmgM || 1)) *
    Math.max(0.1, Number(bd.defM || 1)) *
    Math.max(0.1, Number(bd.stunMult || 1));
  const instProd = blockBaseVal * blockCritM * blockDmgM * blockDefM * blockStunMult;
  const multRatio = avgProd > 0 ? instProd / avgProd : 1.0;

  // Estimate block damage from agent's single-rotation DPR weighted by block MV share & relative multiplier
  const agentCycleDpr = Number(sr.weightedDmg || 0) * 20.0;
  const teamCycleDpr = Math.max(1, Number(sim.teamDpr || 1));
  const mvShare = Number(blk._mvShareOfAgent ?? 0);
  const rawMv = Math.max(10, Number(blk.mv) || 1000);
  const effMv = Number(blk._effMv ?? rawMv * truncFactor * resourceFactor);

  // Normalize across all blocks of this agent? Using mvShare * multRatio gives intuitive, immediate sensitivity
  const blockDmg = Math.max(0, agentCycleDpr * mvShare * multRatio * resourceFactor);
  const pctOfAgent = agentCycleDpr > 0 ? blockDmg / agentCycleDpr : 0;
  const pctOfTeam = blockDmg / teamCycleDpr;

  // Build instantaneous buff status badges
  const buffs: BlockBuffStatus[] = [
    {
      id: "stun",
      label: "失衡易伤",
      effectText: `×${blockStunMult.toFixed(2)}`,
      coverage: realStunFrac,
      active: realStunFrac >= 0.25
    }
  ];

  if (hasNicole && ch.id !== "1031") {
    buffs.push({
      id: "nicole",
      label: "妮可减防",
      effectText: wt === "Rupture" ? "命破无视防御(0收益)" : `-40%防 · ${Math.round(covNicole * 100)}%`,
      coverage: covNicole,
      active: covNicole >= 0.25 && wt !== "Rupture"
    });
  }
  if (hasRina && ch.id !== "1211") {
    buffs.push({
      id: "rina",
      label: "丽娜穿透",
      effectText: wt === "Rupture" ? "命破无视防御(0收益)" : `穿透拐 · ${Math.round(covRina * 100)}%`,
      coverage: covRina,
      active: covRina >= 0.25 && wt !== "Rupture"
    });
  }
  if (hasHormone) {
    buffs.push({
      id: "hormone",
      label: "激素朋克4",
      effectText: `+25%攻 · ${Math.round(covHormone * 100)}%`,
      coverage: covHormone,
      active: covHormone >= 0.25
    });
  }
  if (hasAstral) {
    buffs.push({
      id: "astral",
      label: "静听嘉音4",
      effectText: `${avgAstral.toFixed(1)}层 (+${(avgAstral * 8).toFixed(0)}%伤)`,
      coverage: Math.min(1, avgAstral / 3),
      active: avgAstral >= 0.5
    });
  }
  if (hasMoonlight) {
    buffs.push({
      id: "moonlight",
      label: "月光骑士颂4",
      effectText: `+18%伤 · ${Math.round(covMoonlight * 100)}%`,
      coverage: covMoonlight,
      active: covMoonlight >= 0.25
    });
  }
  if (hasSwing) {
    buffs.push({
      id: "swing",
      label: "摇摆爵士4",
      effectText: `+15%伤 · ${Math.round(covSwing * 100)}%`,
      coverage: covSwing,
      active: covSwing >= 0.25
    });
  }
  if (hasProto) {
    buffs.push({
      id: "proto",
      label: "原始朋克4",
      effectText: `+15%伤 · ${Math.round(covProto * 100)}%`,
      coverage: covProto,
      active: covProto >= 0.25
    });
  }
  if (hasIceOrFrost) {
    buffs.push({
      id: "frostbite",
      label: "霜寒易伤",
      effectText: `+10%暴伤 · ${Math.round(covFrostbite * 100)}%`,
      coverage: covFrostbite,
      active: covFrostbite >= 0.25
    });
  }

  return {
    agentName: ch.n,
    slotIdx: sr.slotIdx,
    formulaType: bd.formulaType || "直伤",
    blockDmg,
    pctOfAgent,
    pctOfTeam,
    effMv,
    rawMv,
    truncFactor,
    resourceFactor,
    baseLabel: bd.baseLabel || "局内攻击",
    baseVal: blockBaseVal,
    critM: blockCritM,
    dmgM: blockDmgM,
    defM: blockDefM,
    resM: blockResM,
    stunMult: blockStunMult,
    miasmaMult,
    realStunFrac,
    catSpecBonus,
    buffs
  };
}

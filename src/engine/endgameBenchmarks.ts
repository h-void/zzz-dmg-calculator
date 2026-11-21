// ============================================================================
// ZZZ v3.3 Endgame Cycle Archives & Practical Clear/Score Benchmarks
// ============================================================================
// Calibrated against zzz-dmg-calculator's true DPS & 180s total output scale,
// providing concrete Deadly Assault (危局强袭战) & Shiyu Defense (式舆防卫战)
// reference lines and 1-click real Boss presets.
// ============================================================================

import { makeZeroElemResMap } from "./dilutionEngine";
import type { ElementCode, EnvConfig } from "../types";

export type EndgameMode = "da" | "shiyu";
export type CycleStatus = "ongoing" | "upcoming" | "archive";

export interface EndgameBossPreset {
  id: string;
  mode: EndgameMode;
  cycleTag: string;
  dateRange: string;
  status: CycleStatus;
  name: string;
  subtitle: string;
  weaknesses: ElementCode[];
  resistances: ElementCode[];
  stageId: string;
  /** Reference full-point HP (Deadly Assault 60k dmg kill HP, or Shiyu single-side clear HP) */
  refHp: number;
  enemyDef: number;
  stunMultBase: number;
  dazeThreshold: number;
  stunDurationBase: number;
  anomThresholdScale: number;
  miasmaFactor: number;
  highAggro: boolean;
  mechanicsNote: string;
}

export interface EndgameEstimate {
  daDmgScore: number;
  daOpsScore: number;
  daTotalScore: number;
  daStars: 0 | 1 | 2 | 3;
  daTierLabel: string;
  daTierClass: "ok" | "info" | "warn";
  daKillPct: number;
  daRefHp: number;
  shiyuClearSec: number;
  shiyuGradeLabel: string;
  shiyuGradeClass: "ok" | "info" | "warn";
  shiyuRefHp: number;
  /** Practical combat uptime factor applied to theoretical DPS (boss invuln / phase swaps) */
  combatUptimeFactor: number;
}

/** Realistic combat uptime ratio converting theoretical sheet DPS to real-fight output */
export const PRACTICAL_COMBAT_UPTIME = 0.90;
export const DEFAULT_DA_KILL_HP = 66_000_000;
export const DEFAULT_SHIYU_SIDE_HP = 11_000_000;

export const ENDGAME_BOSS_PRESETS: EndgameBossPreset[] = [
  {
    id: "da_v33_cur_1",
    mode: "da",
    cycleTag: "v3.3 危局强袭战 · 当期",
    dateRange: "2026/11/11 – 2026/12/09",
    status: "ongoing",
    name: "牲鬼·布林格（秽盾重压）",
    subtitle: "危局 1 路 · 秽盾减伤 + 弱冰电",
    weaknesses: ["Ice", "Electric"],
    resistances: ["Fire"],
    stageId: "da_veil",
    refHp: 68_000_000,
    enemyDef: 1150,
    stunMultBase: 1.5,
    dazeThreshold: 4400,
    stunDurationBase: 12.0,
    anomThresholdScale: 1.0,
    miasmaFactor: 0.78,
    highAggro: false,
    mechanicsNote: "展开秽盾期间非贯穿伤受 0.78 折算；命破贯穿无视防御与秽盾，强攻/异常需在破盾后集中倾泻失衡爆发。"
  },
  {
    id: "da_v33_cur_2",
    mode: "da",
    cycleTag: "v3.3 危局强袭战 · 当期",
    dateRange: "2026/11/11 – 2026/12/09",
    status: "ongoing",
    name: "未知复合侵蚀体（耀化/涡流特化）",
    subtitle: "危局 2 路 · 弱风/流明/以太",
    weaknesses: ["Wind", "Lumiflux", "Ether"],
    resistances: ["Physical"],
    stageId: "shiyu_33_p1",
    refHp: 64_000_000,
    enemyDef: 953,
    stunMultBase: 1.5,
    dazeThreshold: 4200,
    stunDurationBase: 12.0,
    anomThresholdScale: 0.95,
    miasmaFactor: 1.0,
    highAggro: false,
    mechanicsNote: "异常条积蓄友好且频繁触发部位破坏操作分，极度利好耀化/风化涡流/双异常压条紊乱体系。"
  },
  {
    id: "da_v33_cur_3",
    mode: "da",
    cycleTag: "v3.3 危局强袭战 · 当期",
    dateRange: "2026/11/11 – 2026/12/09",
    status: "ongoing",
    name: "死路屠夫·狂化（红光短失衡）",
    subtitle: "危局 3 路 · 高攻击欲 + 弱物理/火",
    weaknesses: ["Physical", "Fire"],
    resistances: ["Ice"],
    stageId: "shiyu_33_p3",
    refHp: 62_000_000,
    enemyDef: 953,
    stunMultBase: 1.5,
    dazeThreshold: 5400,
    stunDurationBase: 9.0,
    anomThresholdScale: 1.0,
    miasmaFactor: 1.0,
    highAggro: true,
    mechanicsNote: "高频黄光/红光连击，支持双反振刀刷操作分与高额削韧；短失衡窗口要求精准合轴与无敌帧保护。"
  },
  {
    id: "shiyu_v33_p3_a",
    mode: "shiyu",
    cycleTag: "v3.3 式舆剧变 7 · 当期",
    dateRange: "2026/11/15 – 2026/12/01",
    status: "ongoing",
    name: "剧变节点 7 · 上半（双风强攻顺风）",
    subtitle: "式舆单路 S 线 ≤ 120s · 弱风/冰",
    weaknesses: ["Wind", "Ice"],
    resistances: ["Electric"],
    stageId: "shiyu_33_p3",
    refHp: 10_800_000,
    enemyDef: 953,
    stunMultBase: 1.5,
    dazeThreshold: 4000,
    stunDurationBase: 12.0,
    anomThresholdScale: 1.0,
    miasmaFactor: 1.0,
    highAggro: false,
    mechanicsNote: "场地自带 +40% 暴伤与 20% 无视防御，双风与直伤强攻队减防穿透收益显著放大。"
  },
  {
    id: "shiyu_v33_p3_b",
    mode: "shiyu",
    cycleTag: "v3.3 式舆剧变 7 · 当期",
    dateRange: "2026/11/15 – 2026/12/01",
    status: "ongoing",
    name: "剧变节点 7 · 下半（重甲提丰·锋御）",
    subtitle: "式舆单路 S 线 ≤ 120s · 1320 重甲",
    weaknesses: ["Electric", "Ether"],
    resistances: ["Ice"],
    stageId: "shiyu_33_p2",
    refHp: 11_800_000,
    enemyDef: 1320,
    stunMultBase: 1.6,
    dazeThreshold: 4600,
    stunDurationBase: 12.0,
    anomThresholdScale: 1.0,
    miasmaFactor: 1.0,
    highAggro: false,
    mechanicsNote: "高防御重甲首领，5 号盘穿透率与减防权重上扬；锋御撕裂与命破队可大幅缓解重甲折损。"
  },
  {
    id: "da_v33_next_1",
    mode: "da",
    cycleTag: "v3.3 危局强袭战 · 下期预告",
    dateRange: "2026/12/09 – 2027/01/06",
    status: "upcoming",
    name: "庞培·过载核心（超重甲防异常）",
    subtitle: "下期压力测试 · 1480 防 + 1.35× 异常条",
    weaknesses: ["Fire", "Physical"],
    resistances: ["Electric"],
    stageId: "shiyu_33_p2",
    refHp: 70_000_000,
    enemyDef: 1480,
    stunMultBase: 1.5,
    dazeThreshold: 4800,
    stunDurationBase: 11.0,
    anomThresholdScale: 1.35,
    miasmaFactor: 1.0,
    highAggro: true,
    mechanicsNote: "同时考验重甲穿透与异常积蓄抗性，建议提前在 03 伤害分析中检查 5 号盘是否需要变阵为穿透。"
  },
  {
    id: "da_v33_arc_1",
    mode: "da",
    cycleTag: "v3.3 危局强袭战 · 往期档案",
    dateRange: "2026/10/14 – 2026/11/11",
    status: "archive",
    name: "提丰·重装破坏者（标准感电）",
    subtitle: "往期标准木桩 · 953 防 + 200% 易伤",
    weaknesses: ["Electric", "Wind"],
    resistances: ["Fire"],
    stageId: "none",
    refHp: 64_000_000,
    enemyDef: 953,
    stunMultBase: 1.75,
    dazeThreshold: 4000,
    stunDurationBase: 12.5,
    anomThresholdScale: 1.0,
    miasmaFactor: 1.0,
    highAggro: false,
    mechanicsNote: "经典弹刀破韧型首领，高失衡易伤窗口适合作为跨版本队伍横向对比的标准参考桩。"
  }
];

export function buildEnvPatchForEndgamePreset(preset: EndgameBossPreset): Partial<EnvConfig> {
  const elemResMap = makeZeroElemResMap(0);
  for (const w of preset.weaknesses) elemResMap[w] = -0.20;
  for (const r of preset.resistances) elemResMap[r] = 0.20;
  return {
    stageId: preset.stageId,
    elemResMap,
    enemyDef: preset.enemyDef,
    stunMultBase: preset.stunMultBase,
    dazeThreshold: preset.dazeThreshold,
    stunDurationBase: preset.stunDurationBase,
    anomThresholdScale: preset.anomThresholdScale,
    miasmaFactor: preset.miasmaFactor,
    highAggro: preset.highAggro,
    activeEndgameId: preset.id
  };
}

export function estimateEndgamePerformance(
  teamActualDps: number,
  da3MinTotal: number,
  env: any
): EndgameEstimate {
  const activePreset = ENDGAME_BOSS_PRESETS.find((p) => p.id === env?.activeEndgameId);
  const daRefHp = activePreset?.mode === "da" ? activePreset.refHp : DEFAULT_DA_KILL_HP;
  const shiyuRefHp = activePreset?.mode === "shiyu" ? activePreset.refHp : DEFAULT_SHIYU_SIDE_HP;
  const daOpsScore = Math.max(0, Math.min(5000, Math.round(Number(env?.daOpsScore ?? 4000))));

  const eff3mDmg = Math.max(0, Number(da3MinTotal) || 0) * PRACTICAL_COMBAT_UPTIME;
  const daKillPct = daRefHp > 0 ? eff3mDmg / daRefHp : 0;
  const daDmgScore = Math.min(60000, Math.round(daKillPct * 60000));
  const daTotalScore = Math.min(65000, daDmgScore + daOpsScore);

  let daStars: 0 | 1 | 2 | 3 = 0;
  let daTierLabel = "练度不足";
  let daTierClass: "ok" | "info" | "warn" = "warn";
  if (daDmgScore >= 60000) {
    daStars = 3;
    daTierLabel = "3★ 击杀满分";
    daTierClass = "ok";
  } else if (daTotalScore >= 40000) {
    daStars = 3;
    daTierLabel = "3★ 高分强杀";
    daTierClass = "ok";
  } else if (daTotalScore >= 20000) {
    daStars = 3;
    daTierLabel = "3★ 稳过满星";
    daTierClass = "ok";
  } else if (daTotalScore >= 14000) {
    daStars = 2;
    daTierLabel = "2★ 接近满星";
    daTierClass = "info";
  } else if (daTotalScore >= 6000) {
    daStars = 1;
    daTierLabel = "1★ 待提练度";
    daTierClass = "warn";
  }

  const effDps = Math.max(1, (Number(teamActualDps) || 0) * PRACTICAL_COMBAT_UPTIME);
  const shiyuClearSec = teamActualDps > 0 ? Math.min(999, shiyuRefHp / effDps) : 999;

  let shiyuGradeLabel = "超时风险";
  let shiyuGradeClass: "ok" | "info" | "warn" = "warn";
  if (shiyuClearSec <= 50) {
    shiyuGradeLabel = "S 极速竞速";
    shiyuGradeClass = "ok";
  } else if (shiyuClearSec <= 95) {
    shiyuGradeLabel = "S 级舒适";
    shiyuGradeClass = "ok";
  } else if (shiyuClearSec <= 150) {
    shiyuGradeLabel = "S 级及格";
    shiyuGradeClass = "info";
  }

  return {
    daDmgScore,
    daOpsScore,
    daTotalScore,
    daStars,
    daTierLabel,
    daTierClass,
    daKillPct,
    daRefHp,
    shiyuClearSec,
    shiyuGradeLabel,
    shiyuGradeClass,
    shiyuRefHp,
    combatUptimeFactor: PRACTICAL_COMBAT_UPTIME
  };
}

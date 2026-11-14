import type { DiscSubKey, ElementCode, SpecialtyCode } from "../types";

export const ALL_ELEMENTS: Array<{ eb: ElementCode; zh: string }> = [
  { eb: "Physical", zh: "物理" },
  { eb: "Fire", zh: "火" },
  { eb: "Ice", zh: "冰" },
  { eb: "Electric", zh: "电" },
  { eb: "Ether", zh: "以太" },
  { eb: "Wind", zh: "风" },
  { eb: "Lumiflux", zh: "流明" }
];

export const ALL_SPECIALTIES: Array<{ wt: SpecialtyCode; zh: string }> = [
  { wt: "Attack", zh: "强攻" },
  { wt: "Anomaly", zh: "异常" },
  { wt: "Rupture", zh: "命破" },
  { wt: "Armorer", zh: "锋御" },
  { wt: "Stun", zh: "击破" },
  { wt: "Support", zh: "支援" },
  { wt: "Defense", zh: "防护" }
];

export const CORE_LABELS = ["未点(0)", "核心A", "核心B", "核心C", "核心D", "核心E", "核心F(满)"];
export const CORE_STAT_SCALE = [0.0, 0.33, 0.50, 0.67, 0.83, 0.92, 1.00];
export const CORE_BUFF_SCALE = [0.52, 0.60, 0.68, 0.76, 0.84, 0.92, 1.00];

export const DISC_SUB_META: Array<{ key: DiscSubKey; zh: string; perRoll: number; isPct: boolean }> = [
  { key: "CR", zh: "暴击率", perRoll: 0.024, isPct: true },
  { key: "CD", zh: "暴击伤害", perRoll: 0.048, isPct: true },
  { key: "ATK%", zh: "大攻击%", perRoll: 0.030, isPct: true },
  { key: "ATK_FLAT", zh: "小攻击", perRoll: 19.0, isPct: false },
  { key: "HP%", zh: "大生命%", perRoll: 0.030, isPct: true },
  { key: "HP_FLAT", zh: "小生命", perRoll: 112.0, isPct: false },
  { key: "DEF%", zh: "大防御%", perRoll: 0.048, isPct: true },
  { key: "DEF_FLAT", zh: "小防御", perRoll: 15.0, isPct: false },
  { key: "AP", zh: "异常精通", perRoll: 9.0, isPct: false },
  { key: "PEN", zh: "穿透值", perRoll: 9.0, isPct: false }
];

export const DISC_SLOT4_MAINS = ["CR", "CD", "AP", "ATK%", "HP%", "DEF%"];
export const DISC_SLOT5_MAINS = ["ELEM", "PEN", "ATK%", "HP%", "DEF%"];
export const DISC_SLOT6_MAINS = ["ATK%", "HP%", "DEF%", "AM", "IMP", "ER"];

export const DISC_MAIN_ZH: Record<string, string> = {
  HP_FLAT: "固定生命",
  ATK_FLAT: "固定攻击",
  DEF_FLAT: "固定防御",
  CR: "暴击",
  CD: "暴伤",
  AP: "精通",
  "ATK%": "攻击%",
  "HP%": "生命%",
  "DEF%": "防御%",
  ELEM: "属伤%",
  PEN: "穿透%",
  AM: "掌控%",
  IMP: "冲击%",
  ER: "回能%"
};

export const DISC_MAIN_LONG_ZH: Record<string, string> = {
  HP_FLAT: "固定生命+2200",
  ATK_FLAT: "固定攻击+316",
  DEF_FLAT: "固定防御+184",
  CR: "暴击率",
  CD: "暴击伤害",
  AP: "异常精通",
  "ATK%": "攻击力%",
  "HP%": "生命值%",
  "DEF%": "防御力%",
  ELEM: "属性伤害%",
  PEN: "穿透率",
  AM: "异常掌控",
  IMP: "冲击力%",
  ER: "能量回复%"
};

export const SUBPART_LABELS: Record<string, string> = {
  direct: "直伤双暴",
  anom: "属性异常",
  disorder: "紊乱结算",
  corruption: "侵蚀/紊乱",
  abloom: "异放协同",
  vortex: "风化涡流",
  luminize: "流明耀化",
  sheer: "命破贯穿",
  sharp: "锋御撕裂"
};

export const SN_ZH: Record<string, string> = {
  ATK: "攻击%",
  HP: "生命%",
  DEF: "防御%",
  "CRIT Rate": "暴击",
  "CRIT DMG": "暴伤",
  "PEN Ratio": "穿透",
  Impact: "冲击",
  "Anomaly Mastery": "掌控%",
  "Anomaly Proficiency": "精通",
  "Energy Regen": "回能%"
};

export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)"
];

export function calcDefLevelFactor(agentLv = 60): number {
  const lv = Math.max(1, Math.min(60, Math.round(Number(agentLv) || 60)));
  if (lv === 60) return 794.0;
  const anchors: Array<[number, number]> = [
    [1, 50],
    [10, 94],
    [20, 172],
    [30, 281],
    [40, 421],
    [50, 592],
    [55, 687],
    [60, 794]
  ];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [l0, v0] = anchors[i];
    const [l1, v1] = anchors[i + 1];
    if (lv >= l0 && lv <= l1) return v0 + (v1 - v0) * ((lv - l0) / (l1 - l0));
  }
  return 794.0;
}

export function calcAnomLevelMult(agentLv = 60): number {
  const lv = Math.max(1, Math.min(60, Number(agentLv) || 60));
  if (lv >= 60) return 1.0;
  return 0.18 + 0.82 * Math.pow(lv / 60.0, 1.65);
}

export function calcBaseStatLvMult(agentLv = 60): number {
  const lv = Math.max(1, Math.min(60, Number(agentLv) || 60));
  if (lv >= 60) return 1.0;
  return 0.22 + 0.78 * (lv / 60.0);
}

export function fmtDiscZh(code: string | undefined | null, longForm = false): string {
  if (!code) return "-";
  if (code === "6盘实体精调" || code === "局外面板直填") return code;
  const parts = code.split("/");
  if (parts.length !== 3) return code;
  const nums = ["[4]", "[5]", "[6]"];
  const map = longForm ? DISC_MAIN_LONG_ZH : DISC_MAIN_ZH;
  return parts.map((p, i) => `${nums[i]}${map[p] || p}`).join(longForm ? " · " : "·");
}

export function escHtml(str: unknown): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

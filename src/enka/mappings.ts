import { DISC_SETS } from "../data/store";
import { DISC_MAIN_ZH } from "../engine/constants";
import type {
  AgentDef,
  DiscGradeTier,
  DiscMainCode,
  DiscPiece,
  DiscSubKey,
  ElementCode,
  ScoredPieceSummary
} from "../types";

/**
 * Official Enka.Network ZZZ SuitId -> Calculator Set ID (30/30 complete v3.3 coverage)
 */
export const ENKA_SUIT_TO_SET_ID: Record<number, string> = {
  31000: "啄木",     // 啄木鸟电音 Woodpecker Electro
  31100: "河豚",     // 河豚电音 Puffer Electro
  31200: "震星",     // 震星迪斯科 Shockstar Disco
  31300: "自由",     // 自由蓝调 Freedom Blues
  31400: "激素",     // 激素朋克 Hormone Punk
  31500: "灵魂",     // 灵魂摇滚 Soul Rock
  31600: "摇摆",     // 摇摆爵士 Swing Jazz
  31800: "混沌爵士", // 混沌爵士 Chaos Jazz
  31900: "原始",     // 原始朋克 Proto Punk
  32200: "炎狱",     // 炎狱重金属 Inferno Metal
  32300: "混沌重",   // 混沌重金属 Chaos Metal
  32400: "雷暴",     // 雷暴重金属 Thunder Metal
  32500: "极地",     // 极地重金属 Polar Metal
  32600: "獠牙",     // 獠牙重金属 Fanged Metal
  32700: "折枝",     // 折枝剑歌 Branch & Blade Song
  32800: "静听",     // 静听嘉音 Astral Voice
  32900: "如影",     // 如影相随 Shadow Harmony
  33000: "法厄同",   // 法厄同之歌 Phaethon's Melody
  33100: "云岿",     // 云岿如我 Yunkui Tales
  33200: "山大王",   // 山大王 King of the Summit
  33300: "拂晓",     // 拂晓生花 Dawn's Bloom
  33400: "月光",     // 月光骑士颂 Moonlight Lullaby
  33500: "沧浪",     // 沧浪行歌 White Water Ballad
  33600: "流光",     // 流光咏叹 Shining Aria
  33700: "雪兔",     // 雪兔梦游仙境 Bunny in Wonderland
  33800: "囚徒",     // 囚徒手记 Notes From the Chained
  33900: "呼啸",     // 呼啸沙龙 Wuthering Salon
  34000: "拂晓行纪", // 拂晓行纪 The Sky Ablaze
  34100: "谶羽",     // 谶羽之誓 Feathered Fate
  34200: "荆棘"      // 荆棘玫瑰 Thorned Rose
};

/**
 * Alias lookup for third-party OCR scanners (GOOD / ZOD / AdeptiScanner-ZZZ / ZZZ-Scanner)
 */
const SCANNER_SET_ALIASES: Record<string, string> = {
  woodpeckerelectro: "啄木",
  pufferelectro: "河豚",
  shockstardisco: "震星",
  freedomblues: "自由",
  hormonepunk: "激素",
  soulrock: "灵魂",
  swingjazz: "摇摆",
  chaosjazz: "混沌爵士",
  protopunk: "原始",
  infernometal: "炎狱",
  chaosmetal: "混沌重",
  thundermetal: "雷暴",
  polarmetal: "极地",
  fangedmetal: "獠牙",
  branchandbladesong: "折枝",
  branchbladesong: "折枝",
  astralvoice: "静听",
  shadowharmony: "如影",
  shadow: "如影",
  phaethonsmelody: "法厄同",
  savior: "法厄同",
  yunkuitales: "云岿",
  kingofthesummit: "山大王",
  dawnsbloom: "拂晓",
  moonlightlullaby: "月光",
  whitewaterballad: "沧浪",
  shiningaria: "流光",
  bunnyinwonderland: "雪兔",
  notesfromthechained: "囚徒",
  wutheringsalon: "呼啸",
  theskyablaze: "拂晓行纪",
  featheredfate: "谶羽",
  thornedrose: "荆棘"
};

export function resolveDiscSetKey(rawSet: string | number | undefined): string {
  if (rawSet === undefined || rawSet === null) return "啄木";
  if (typeof rawSet === "number" || /^\d+$/.test(String(rawSet))) {
    const num = Number(rawSet);
    const suitId = num >= 30000 && num % 100 !== 0 ? Math.floor(num / 100) * 100 : num;
    if (ENKA_SUIT_TO_SET_ID[suitId]) return ENKA_SUIT_TO_SET_ID[suitId];
  }
  const str = String(rawSet).trim();
  if (DISC_SETS[str]) return str;
  for (const ds of Object.values(DISC_SETS)) {
    if (ds.name === str || str.includes(ds.name) || ds.name.includes(str)) {
      if (ds.id !== "无") return ds.id;
    }
  }
  const norm = str.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, "");
  if (SCANNER_SET_ALIASES[norm]) return SCANNER_SET_ALIASES[norm];
  return "啄木";
}

export interface MainPropMapping {
  main: DiscMainCode;
  sRankLv0Base: number;
  elemType?: ElementCode;
}

export const ENKA_PROP_TO_MAIN: Record<number, MainPropMapping> = {
  11103: { main: "HP_FLAT", sRankLv0Base: 550 },
  12103: { main: "ATK_FLAT", sRankLv0Base: 79 },
  13103: { main: "DEF_FLAT", sRankLv0Base: 46 },
  12102: { main: "ATK%", sRankLv0Base: 750 },
  11102: { main: "HP%", sRankLv0Base: 750 },
  13102: { main: "DEF%", sRankLv0Base: 1200 },
  20103: { main: "CR", sRankLv0Base: 600 },
  20101: { main: "CR", sRankLv0Base: 600 },
  21103: { main: "CD", sRankLv0Base: 1200 },
  21101: { main: "CD", sRankLv0Base: 1200 },
  31203: { main: "AP", sRankLv0Base: 23 },
  31201: { main: "AP", sRankLv0Base: 23 },
  23103: { main: "PEN", sRankLv0Base: 600 },
  23101: { main: "PEN", sRankLv0Base: 600 },
  31503: { main: "ELEM", sRankLv0Base: 750, elemType: "Physical" },
  31501: { main: "ELEM", sRankLv0Base: 750, elemType: "Physical" },
  31603: { main: "ELEM", sRankLv0Base: 750, elemType: "Fire" },
  31601: { main: "ELEM", sRankLv0Base: 750, elemType: "Fire" },
  31703: { main: "ELEM", sRankLv0Base: 750, elemType: "Ice" },
  31701: { main: "ELEM", sRankLv0Base: 750, elemType: "Ice" },
  31803: { main: "ELEM", sRankLv0Base: 750, elemType: "Electric" },
  31801: { main: "ELEM", sRankLv0Base: 750, elemType: "Electric" },
  31903: { main: "ELEM", sRankLv0Base: 750, elemType: "Ether" },
  31901: { main: "ELEM", sRankLv0Base: 750, elemType: "Ether" },
  32303: { main: "ELEM", sRankLv0Base: 750, elemType: "Wind" },
  32301: { main: "ELEM", sRankLv0Base: 750, elemType: "Wind" },
  31402: { main: "AM", sRankLv0Base: 750 },
  31401: { main: "AM", sRankLv0Base: 750 },
  12202: { main: "IMP", sRankLv0Base: 450 },
  12201: { main: "IMP", sRankLv0Base: 450 },
  30502: { main: "ER", sRankLv0Base: 1500 },
  30501: { main: "ER", sRankLv0Base: 1500 }
};

export const ENKA_PROP_TO_SUB: Record<number, { key: DiscSubKey; sRankStep: number }> = {
  20103: { key: "CR", sRankStep: 240 },
  21103: { key: "CD", sRankStep: 480 },
  12102: { key: "ATK%", sRankStep: 300 },
  12103: { key: "ATK_FLAT", sRankStep: 19 },
  11102: { key: "HP%", sRankStep: 300 },
  11103: { key: "HP_FLAT", sRankStep: 112 },
  13102: { key: "DEF%", sRankStep: 480 },
  13103: { key: "DEF_FLAT", sRankStep: 15 },
  31203: { key: "AP", sRankStep: 9 },
  23203: { key: "PEN", sRankStep: 9 }
};

/**
 * Returns stat weights (0..1) tailored to each Agent's damage scaling & specialty,
 * mirroring WeChat mini-program ("绝区零工坊") effective roll evaluation.
 */
export function getEffectiveSubWeightsForAgent(ch: AgentDef | undefined): Record<DiscSubKey, number> {
  const base: Record<DiscSubKey, number> = {
    CR: 0,
    CD: 0,
    "ATK%": 0,
    ATK_FLAT: 0,
    "HP%": 0,
    HP_FLAT: 0,
    "DEF%": 0,
    DEF_FLAT: 0,
    AP: 0,
    PEN: 0
  };
  if (!ch) {
    return { ...base, CR: 1, CD: 1, "ATK%": 1, PEN: 0.4, ATK_FLAT: 0.35 };
  }

  // Miyabi (1091) or Crit-Anomaly hybrids
  if (ch.id === "1091" || ch.prof?.cr_to_buildup) {
    return { ...base, CR: 1, CD: 1, "ATK%": 1, AP: 0.85, PEN: 0.45, ATK_FLAT: 0.35 };
  }

  switch (ch.wt) {
    case "Attack":
      return { ...base, CR: 1, CD: 1, "ATK%": 1, PEN: 0.45, ATK_FLAT: 0.35 };
    case "Anomaly":
      return { ...base, AP: 1, "ATK%": 1, PEN: 0.45, ATK_FLAT: 0.4 };
    case "Rupture":
      return { ...base, CR: 1, CD: 1, "HP%": 1, "ATK%": 0.45, HP_FLAT: 0.35 };
    case "Armorer":
      return { ...base, CR: 1, CD: 1, "DEF%": 1, "ATK%": 0.5, DEF_FLAT: 0.35 };
    case "Stun":
      return { ...base, CR: 1, CD: 1, "ATK%": 0.85, PEN: 0.4, ATK_FLAT: 0.3 };
    case "Support":
    case "Defense": {
      if ((ch.cp_hp || 0) > 0) {
        return { ...base, "HP%": 1, CR: 0.75, CD: 0.75, HP_FLAT: 0.4, "ATK%": 0.5 };
      }
      if (ch.wt === "Defense" && ch.def > 700) {
        return { ...base, "DEF%": 1, "ATK%": 0.8, CR: 0.75, CD: 0.75, DEF_FLAT: 0.4 };
      }
      return { ...base, "ATK%": 1, AP: 0.65, CR: 0.75, CD: 0.75, ATK_FLAT: 0.4 };
    }
    default:
      return { ...base, CR: 1, CD: 1, "ATK%": 1, PEN: 0.4, ATK_FLAT: 0.35 };
  }
}

export function gradeSinglePiece(effRolls: number): DiscGradeTier {
  if (effRolls >= 7.0) return "ACE";
  if (effRolls >= 5.8) return "SSS";
  if (effRolls >= 4.8) return "SS";
  if (effRolls >= 3.8) return "S";
  if (effRolls >= 2.5) return "A";
  return "B";
}

export function gradeSixPiecesTotal(totalEffRolls: number): DiscGradeTier {
  if (totalEffRolls >= 35.0) return "ACE";
  if (totalEffRolls >= 30.0) return "SSS";
  if (totalEffRolls >= 25.0) return "SS";
  if (totalEffRolls >= 20.0) return "S";
  if (totalEffRolls >= 14.0) return "A";
  return "B";
}

export function scoreSixPiecesForAgent(
  pieces: DiscPiece[],
  ch: AgentDef | undefined
): {
  pieceSummaries: ScoredPieceSummary[];
  effectiveRollsTotal: number;
  rawRollsTotal: number;
  overallGrade: DiscGradeTier;
} {
  const weights = getEffectiveSubWeightsForAgent(ch);
  let effectiveRollsTotal = 0;
  let rawRollsTotal = 0;

  const pieceSummaries: ScoredPieceSummary[] = pieces.map((p, idx) => {
    let eff = 0;
    let raw = 0;
    for (const [k, v] of Object.entries(p?.subs || {})) {
      const rolls = Number(v) || 0;
      raw += rolls;
      eff += rolls * (weights[k as DiscSubKey] || 0);
    }
    // Main stat bonus credit on slots 4/5/6 if matching key stat (matching 工坊 scoring style)
    if (idx >= 3 && p?.main) {
      const mKey = p.main;
      if (
        (mKey === "CR" && weights.CR >= 0.8) ||
        (mKey === "CD" && weights.CD >= 0.8) ||
        (mKey === "AP" && weights.AP >= 0.8) ||
        (mKey === "ELEM" && (!p.elemType || !ch || p.elemType === ch.eb || (p.elemType === "Ether" && ch.eb === "Lumiflux"))) ||
        (mKey === "PEN" && (weights.PEN >= 0.4 || ch?.wt === "Attack")) ||
        (mKey === "IMP" && ch?.wt === "Stun") ||
        (mKey === "ER" && (ch?.wt === "Support" || ch?.wt === "Stun")) ||
        (mKey === "AM" && ch?.wt === "Anomaly") ||
        (mKey === "ATK%" && weights["ATK%"] >= 0.8) ||
        (mKey === "HP%" && weights["HP%"] >= 0.8) ||
        (mKey === "DEF%" && weights["DEF%"] >= 0.8)
      ) {
        eff += 1.0 * (p.mainScale ?? 1.0);
      }
    }
    const effRounded = Number(eff.toFixed(1));
    const rawRounded = Number(raw.toFixed(1));
    effectiveRollsTotal += eff;
    rawRollsTotal += raw;

    const setObj = DISC_SETS[p?.set || "无"];
    return {
      slot: idx + 1,
      set: p?.set || "无",
      setName: setObj?.name || p?.set || "未知",
      main: p?.main || "-",
      mainZh: DISC_MAIN_ZH[p?.main || ""] || p?.main || "-",
      level: p?.level ?? 15,
      rarity: p?.rarity ?? 4,
      effectiveRolls: effRounded,
      totalRolls: rawRounded,
      grade: gradeSinglePiece(eff)
    };
  });

  const effTotalRounded = Number(effectiveRollsTotal.toFixed(1));
  return {
    pieceSummaries,
    effectiveRollsTotal: effTotalRounded,
    rawRollsTotal: Number(rawRollsTotal.toFixed(1)),
    overallGrade: gradeSixPiecesTotal(effTotalRounded)
  };
}

import { CHAR_MAP, SC_WEPS, WEP_LIST, deepClone } from "../data/store";
import {
  ENKA_PROP_TO_MAIN,
  ENKA_PROP_TO_SUB,
  resolveDiscSetKey,
  scoreSixPiecesForAgent
} from "./mappings";
import type {
  DiscPiece,
  DiscSubKey,
  RawEnkaAvatar,
  RawEnkaEquipment,
  RawEnkaUidResponse,
  SlotConfig,
  SyncedAgentRecord
} from "../types";

function emptySubs(): Record<DiscSubKey, number> {
  return {
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
}

export function parseEnkaEquipmentItem(item: RawEnkaEquipment, equippedByCid?: string): DiscPiece {
  const slot = Math.max(1, Math.min(6, Number(item.Slot) || 1));
  const eq = item.Equipment || ({} as RawEnkaEquipment["Equipment"]);
  const eqId = Number(eq.Id) || 31041;
  const set = resolveDiscSetKey(eqId);
  const rarity = eqId >= 30000 ? Math.max(2, Math.min(4, Math.floor(eqId / 10) % 10)) : 4;
  const level = Math.max(0, Math.min(15, Number(eq.Level ?? 15)));

  const mainArr = eq.MainPropertyList || eq.MainStatList || [];
  const mainRaw = mainArr[0];
  const defaultMain = slot === 1 ? "HP_FLAT" : slot === 2 ? "ATK_FLAT" : slot === 3 ? "DEF_FLAT" : "ATK%";

  let main = defaultMain;
  let elemType = undefined;
  let mainScale = 1.0;

  if (mainRaw && ENKA_PROP_TO_MAIN[mainRaw.PropertyId]) {
    const mapped = ENKA_PROP_TO_MAIN[mainRaw.PropertyId];
    main = mapped.main;
    elemType = mapped.elemType;
    const rarityScale = rarity === 4 ? 0.2 : rarity === 3 ? 0.25 : 0.3;
    const baseRatio = mainRaw.PropertyValue > 0 ? mainRaw.PropertyValue / mapped.sRankLv0Base : (rarity === 4 ? 1 : rarity === 3 ? 2 / 3 : 1 / 3);
    mainScale = Number(((baseRatio * (1 + level * rarityScale)) / 4.0).toFixed(4));
  }

  const subs = emptySubs();
  for (const sp of eq.RandomPropertyList || []) {
    const subMeta = ENKA_PROP_TO_SUB[sp.PropertyId];
    if (!subMeta) continue;
    const lv = Math.max(1, Number(sp.PropertyLevel) || 1);
    const stepRatio =
      sp.PropertyValue > 0 ? sp.PropertyValue / subMeta.sRankStep : rarity === 4 ? 1 : rarity === 3 ? 2 / 3 : 1 / 3;
    subs[subMeta.key] = Number((subs[subMeta.key] + lv * stepRatio).toFixed(2));
  }

  return {
    uid: eq.Uid ? `enka_${eq.Uid}` : undefined,
    slot,
    set,
    main,
    elemType,
    level,
    rarity,
    mainScale,
    subs,
    equippedBy: equippedByCid
  };
}

function detectSetsFromPieces(pieces: DiscPiece[]): { fourPc: string; twoPc: string } {
  const counts: Record<string, number> = {};
  for (const p of pieces) {
    if (p?.set && p.set !== "无") {
      counts[p.set] = (counts[p.set] || 0) + 1;
    }
  }
  let fourPc = "无";
  const twoPcs: string[] = [];
  for (const [sid, c] of Object.entries(counts)) {
    if (c >= 4) fourPc = sid;
    if (c >= 2) twoPcs.push(sid);
  }
  const twoPc = twoPcs.find((s) => s !== fourPc) || twoPcs[0] || "无";
  return { fourPc, twoPc };
}

export function parseEnkaAvatar(av: RawEnkaAvatar, uidStr: string): {
  record: SyncedAgentRecord | null;
  discs: DiscPiece[];
} {
  const cid = String(av.Id || "");
  const ch = CHAR_MAP[cid];
  if (!ch) return { record: null, discs: [] };

  const agentLv = Math.max(1, Math.min(60, Number(av.Level) || 60));
  const m = Math.max(0, Math.min(6, Number(av.TalentLevel) || 0));
  const coreLv = Math.max(0, Math.min(6, Number(av.CoreSkillEnhancement ?? 6)));

  // Compute representative base skill level (1..12) from Basic/Special/Dash/Ult/Assist
  const combatSkillLevels = (av.SkillLevelList || [])
    .filter((s) => s.Index !== 5 && s.Level >= 1 && s.Level <= 12)
    .map((s) => s.Level);
  const skillLv =
    combatSkillLevels.length > 0
      ? Math.round(combatSkillLevels.reduce((a, b) => a + b, 0) / combatSkillLevels.length)
      : 12;

  const rawWepId = av.Weapon?.Id ? String(av.Weapon.Id) : "";
  const wid = rawWepId && SC_WEPS[rawWepId] ? rawWepId : SC_WEPS[ch.sig] ? ch.sig : WEP_LIST[0].id;
  const wepLv = Math.max(1, Math.min(60, Number(av.Weapon?.Level) || 60));
  const ref = Math.max(1, Math.min(5, Number(av.Weapon?.UpgradeLevel) || (SC_WEPS[wid]?.r === "S" ? 1 : 5)));

  const pieces: DiscPiece[] = [1, 2, 3, 4, 5, 6].map((slotNum) => ({
    slot: slotNum,
    set: "无",
    main: slotNum === 1 ? "HP_FLAT" : slotNum === 2 ? "ATK_FLAT" : slotNum === 3 ? "DEF_FLAT" : "ATK%",
    level: 0,
    rarity: 4,
    mainScale: 0,
    subs: emptySubs(),
    equippedBy: cid
  }));

  const extractedDiscs: DiscPiece[] = [];
  for (const eqItem of av.EquippedList || []) {
    const parsedPiece = parseEnkaEquipmentItem(eqItem, cid);
    const sIdx = (parsedPiece.slot || 1) - 1;
    if (sIdx >= 0 && sIdx < 6) {
      pieces[sIdx] = parsedPiece;
      extractedDiscs.push(deepClone(parsedPiece));
    }
  }

  const { fourPc, twoPc } = detectSetsFromPieces(pieces);
  const score = scoreSixPiecesForAgent(pieces, ch);

  return {
    record: {
      uid: uidStr,
      cid,
      agentLv,
      m,
      coreLv,
      skillLv,
      wid,
      wepLv,
      ref,
      fourPc,
      twoPc,
      pieces,
      pieceSummaries: score.pieceSummaries,
      effectiveRollsTotal: score.effectiveRollsTotal,
      rawRollsTotal: score.rawRollsTotal,
      overallGrade: score.overallGrade,
      updatedAt: new Date().toISOString()
    },
    discs: extractedDiscs
  };
}

export function parseEnkaShowcasePayload(
  raw: RawEnkaUidResponse,
  fallbackUid = ""
): {
  uid: string;
  ttl: number;
  region: string;
  nickname: string;
  interKnotLv: number;
  signature: string;
  records: SyncedAgentRecord[];
  discs: DiscPiece[];
} {
  const prof = raw?.PlayerInfo?.SocialDetail?.ProfileDetail;
  const uid = String(raw?.uid || prof?.Uid || fallbackUid || "").trim();
  const ttl = Math.max(15, Number(raw?.ttl) || 60);
  const region = String(raw?.region || "");
  const nickname = String(prof?.Nickname || `绳匠 ${uid}`);
  const interKnotLv = Number(prof?.Level) || 60;
  const signature = String(raw?.PlayerInfo?.SocialDetail?.Desc || "");

  const avatarList = raw?.PlayerInfo?.ShowcaseDetail?.AvatarList || [];
  const records: SyncedAgentRecord[] = [];
  const discs: DiscPiece[] = [];

  for (const av of avatarList) {
    const { record, discs: dList } = parseEnkaAvatar(av, uid);
    if (record) records.push(record);
    discs.push(...dList);
  }

  return { uid, ttl, region, nickname, interKnotLv, signature, records, discs };
}

/**
 * Converts a SyncedAgentRecord into a full Workbench SlotConfig ("pieces" 6-disc mode)
 */
export function syncedRecordToSlotConfig(
  rec: SyncedAgentRecord,
  makeDefaultSlotFn: (cid: string, m?: number | null, wid?: string | null, ref?: number | null, fourPc?: string | null) => SlotConfig | null
): SlotConfig | null {
  const base = makeDefaultSlotFn(rec.cid, rec.m, rec.wid, rec.ref, rec.fourPc === "无" ? undefined : rec.fourPc);
  if (!base) return null;
  const ch = CHAR_MAP[rec.cid];
  const w = SC_WEPS[rec.wid];

  base.m = rec.m;
  base.wid = rec.wid;
  base.ref = rec.ref;
  base.agentLv = rec.agentLv;
  base.wepLv = rec.wepLv;
  base.coreLv = rec.coreLv;
  base.skillLv = rec.skillLv;
  base.fourPc = rec.fourPc;
  base.twoPc = rec.twoPc;
  base.buildMode = "pieces";
  base.discAuto = false;
  base.subAuto = false;
  base.pieces = deepClone(rec.pieces);
  base.d4 = rec.pieces[3]?.main || "CR";
  base.d5 = rec.pieces[4]?.main || "ELEM";
  base.d6 = rec.pieces[5]?.main || "ATK%";
  base.allowCrossWep = Boolean(ch && w && ch.wt !== w.wt);
  base.enkaSourceUid = rec.uid;
  return base;
}

/* ============================================================================
   External OCR Scanner JSON Interop (GOOD / ZOD / AdeptiScanner-ZZZ / ZZZ-Scanner)
   ============================================================================ */

const STAT_KEY_ALIASES: Record<string, { main?: string; sub?: DiscSubKey; perRoll?: number; elem?: any }> = {
  hp: { main: "HP_FLAT", sub: "HP_FLAT", perRoll: 112 },
  hp_: { main: "HP%", sub: "HP%", perRoll: 3.0 },
  hppct: { main: "HP%", sub: "HP%", perRoll: 3.0 },
  "生命值": { main: "HP_FLAT", sub: "HP_FLAT", perRoll: 112 },
  "生命值%": { main: "HP%", sub: "HP%", perRoll: 3.0 },
  atk: { main: "ATK_FLAT", sub: "ATK_FLAT", perRoll: 19 },
  atk_: { main: "ATK%", sub: "ATK%", perRoll: 3.0 },
  atkpct: { main: "ATK%", sub: "ATK%", perRoll: 3.0 },
  "攻击力": { main: "ATK_FLAT", sub: "ATK_FLAT", perRoll: 19 },
  "攻击力%": { main: "ATK%", sub: "ATK%", perRoll: 3.0 },
  def: { main: "DEF_FLAT", sub: "DEF_FLAT", perRoll: 15 },
  def_: { main: "DEF%", sub: "DEF%", perRoll: 4.8 },
  defpct: { main: "DEF%", sub: "DEF%", perRoll: 4.8 },
  "防御力": { main: "DEF_FLAT", sub: "DEF_FLAT", perRoll: 15 },
  "防御力%": { main: "DEF%", sub: "DEF%", perRoll: 4.8 },
  crit: { main: "CR", sub: "CR", perRoll: 2.4 },
  crit_: { main: "CR", sub: "CR", perRoll: 2.4 },
  critrate: { main: "CR", sub: "CR", perRoll: 2.4 },
  critrate_: { main: "CR", sub: "CR", perRoll: 2.4 },
  cr: { main: "CR", sub: "CR", perRoll: 2.4 },
  "暴击率": { main: "CR", sub: "CR", perRoll: 2.4 },
  critdmg: { main: "CD", sub: "CD", perRoll: 4.8 },
  critdmg_: { main: "CD", sub: "CD", perRoll: 4.8 },
  cd: { main: "CD", sub: "CD", perRoll: 4.8 },
  "暴击伤害": { main: "CD", sub: "CD", perRoll: 4.8 },
  anomprof: { main: "AP", sub: "AP", perRoll: 9 },
  anomalyproficiency: { main: "AP", sub: "AP", perRoll: 9 },
  ap: { main: "AP", sub: "AP", perRoll: 9 },
  "异常精通": { main: "AP", sub: "AP", perRoll: 9 },
  pen: { sub: "PEN", perRoll: 9 },
  penflat: { sub: "PEN", perRoll: 9 },
  "穿透值": { sub: "PEN", perRoll: 9 },
  pen_: { main: "PEN" },
  penratio: { main: "PEN" },
  penratio_: { main: "PEN" },
  "穿透率": { main: "PEN" },
  anommas: { main: "AM" },
  anommas_: { main: "AM" },
  anomalymastery: { main: "AM" },
  am: { main: "AM" },
  "异常掌控": { main: "AM" },
  impact: { main: "IMP" },
  impact_: { main: "IMP" },
  imp: { main: "IMP" },
  "冲击力": { main: "IMP" },
  enerregen: { main: "ER" },
  enerregen_: { main: "ER" },
  energyregen: { main: "ER" },
  er: { main: "ER" },
  "能量自动回复": { main: "ER" },
  physical_dmg_: { main: "ELEM", elem: "Physical" },
  physicaldmg: { main: "ELEM", elem: "Physical" },
  "物理伤害加成": { main: "ELEM", elem: "Physical" },
  fire_dmg_: { main: "ELEM", elem: "Fire" },
  firedmg: { main: "ELEM", elem: "Fire" },
  "火属性伤害加成": { main: "ELEM", elem: "Fire" },
  ice_dmg_: { main: "ELEM", elem: "Ice" },
  icedmg: { main: "ELEM", elem: "Ice" },
  "冰属性伤害加成": { main: "ELEM", elem: "Ice" },
  electric_dmg_: { main: "ELEM", elem: "Electric" },
  electricdmg: { main: "ELEM", elem: "Electric" },
  "电属性伤害加成": { main: "ELEM", elem: "Electric" },
  ether_dmg_: { main: "ELEM", elem: "Ether" },
  etherdmg: { main: "ELEM", elem: "Ether" },
  "以太伤害加成": { main: "ELEM", elem: "Ether" },
  wind_dmg_: { main: "ELEM", elem: "Wind" },
  winddmg: { main: "ELEM", elem: "Wind" },
  "风属性伤害加成": { main: "ELEM", elem: "Wind" }
};

function normStatAlias(raw: string): string {
  const s = String(raw || "").trim();
  if (/[\u4e00-\u9fa5]/.test(s)) return s;
  return s.toLowerCase().replace(/\s+/g, "").replace(/%/g, "_");
}

export function parseExternalScannerDiscs(parsedJson: any): DiscPiece[] {
  // Also accept direct Enka JSON if user uploads an Enka snapshot file!
  if (parsedJson?.PlayerInfo?.ShowcaseDetail?.AvatarList) {
    return parseEnkaShowcasePayload(parsedJson).discs;
  }

  const rawArray: any[] =
    (Array.isArray(parsedJson) && parsedJson) ||
    parsedJson?.discs ||
    parsedJson?.driveDiscs ||
    parsedJson?.drive_discs ||
    parsedJson?.items ||
    parsedJson?.artifacts ||
    parsedJson?.data ||
    parsedJson?.export ||
    [];

  if (!Array.isArray(rawArray)) return [];

  const out: DiscPiece[] = [];
  rawArray.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") return;
    // Already in our internal DiscPiece format?
    if (raw.set && raw.main && raw.subs && typeof raw.subs === "object" && !Array.isArray(raw.subs)) {
      out.push({
        uid: raw.uid || `scan_${i}`,
        slot: Number(raw.slot) || ((i % 6) + 1),
        set: resolveDiscSetKey(raw.set),
        main: raw.main,
        elemType: raw.elemType,
        level: raw.level ?? 15,
        rarity: raw.rarity ?? 4,
        mainScale: raw.mainScale ?? 1.0,
        subs: { ...emptySubs(), ...raw.subs }
      });
      return;
    }

    const slotRaw = raw.slotKey ?? raw.slot ?? raw.partition ?? raw.position ?? 1;
    const slotNum = Math.max(1, Math.min(6, Number(String(slotRaw).replace(/\D/g, "")) || 1));
    const set = resolveDiscSetKey(raw.setKey ?? raw.set ?? raw.suitName ?? raw.suitId);
    const level = Math.max(0, Math.min(15, Number(raw.level ?? 15)));
    const rarity = raw.rarity === "S" || raw.rarity === 5 || raw.rarity === 4 || !raw.rarity ? 4 : raw.rarity === "A" || raw.rarity === 3 ? 3 : 2;
    const rarityScale = rarity === 4 ? 0.2 : rarity === 3 ? 0.25 : 0.3;
    const mainScale = Number((((rarity === 4 ? 1 : rarity === 3 ? 2 / 3 : 1 / 3) * (1 + level * rarityScale)) / 4.0).toFixed(4));

    const mainAlias = STAT_KEY_ALIASES[normStatAlias(raw.mainStatKey ?? raw.mainStat ?? raw.main ?? "")];
    const defaultMain = slotNum === 1 ? "HP_FLAT" : slotNum === 2 ? "ATK_FLAT" : slotNum === 3 ? "DEF_FLAT" : "ATK%";
    const main = mainAlias?.main || defaultMain;
    const elemType = mainAlias?.elem;

    const subs = emptySubs();
    const rawSubsList = raw.substats ?? raw.subStats ?? raw.subs ?? [];
    if (Array.isArray(rawSubsList)) {
      for (const sb of rawSubsList) {
        const al = STAT_KEY_ALIASES[normStatAlias(sb.key ?? sb.stat ?? sb.name ?? "")];
        if (!al?.sub) continue;
        let rolls = Number(sb.rolls ?? sb.upgrades ?? sb.count ?? 0);
        if (!rolls && sb.value !== undefined && al.perRoll) {
          const vNum = parseFloat(String(sb.value));
          const normalizedVal = vNum > 0 && vNum < 1 && ["CR", "CD", "ATK%", "HP%", "DEF%"].includes(al.sub) ? vNum * 100 : vNum;
          rolls = normalizedVal / al.perRoll;
        } else if (rolls && sb.upgrades !== undefined && sb.initialValue !== undefined) {
          rolls = 1 + Number(sb.upgrades);
        }
        subs[al.sub] = Number((subs[al.sub] + Math.max(0, rolls)).toFixed(2));
      }
    }

    out.push({
      uid: raw.id ?? raw.uid ?? `scan_${Date.now().toString(36)}_${i}`,
      slot: slotNum,
      set,
      main,
      elemType,
      level,
      rarity,
      mainScale,
      subs
    });
  });

  return out;
}

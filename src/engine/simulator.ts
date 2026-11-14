import {
  BANGBOO_MAP,
  CHAR_MAP,
  DISC_SETS,
  NON_LIM_S_CHARS,
  NON_LIM_S_WEPS,
  SC_CHARS,
  SC_WEPS,
  STAGE_BUFFS,
  WEP_LIST,
  customDB,
  deepClone
} from "../data/store";
import {
  CORE_BUFF_SCALE,
  CORE_STAT_SCALE,
  SN_ZH,
  calcAnomLevelMult,
  calcBaseStatLvMult,
  calcDefLevelFactor
} from "./constants";
import { evalSwapCancelEngine, makeDefaultSwapConfig } from "./swapTimeline";

// ============================================================================
// Weapon Effects (Built-in + Full Custom Override/Additive Support)
// ============================================================================

export function getWeaponEffects(ch, w, refLevel = 1, ctx: any = {}, slotCfg = null) {
  const allowCross = !!(slotCfg && slotCfg.allowCrossWep);
  const cross = (w.wt !== ch.wt) && !allowCross;
  const rClamped = Math.max(1, Math.min(5, Number(refLevel) || 1));
  const wepLvMult = slotCfg?.wepLv ? calcBaseStatLvMult(slotCfg.wepLv) : 1.0;
  const passiveUptime = slotCfg?.wepUptime !== undefined ? Math.max(0, Math.min(1.0, Number(slotCfg.wepUptime))) : 1.0;
  const scale = (w.r === "S" ? (1.0 + (rClamped - 1) * 0.15) : (0.625 + (rClamped - 1) * (0.375 / 4)));

  const eff = {
    base_atk: (w.batk || 0) * wepLvMult,
    base_def: (w.bdef || 0) * wepLvMult,
    init_atk: 0, init_hp: 0, init_def: 0, init_cr: 0, init_cd: 0, init_pen: 0,
    init_imp_pct: 0, init_imp_flat: 0, init_am_pct: 0, init_am_flat: 0, init_ap: 0, init_er_pct: 0,
    c_atk: 0, c_cr: 0, c_cd: 0, c_def: 0, c_sheer: 0, c_ap: 0, c_am_flat: 0,
    c_imp_pct: 0, c_imp_flat: 0, c_er_flat: 0, c_er_rate: 0,
    dmg_all: 0, dmg_basic: 0, dmg_dash: 0, dmg_ex: 0, dmg_ult: 0,
    dmg_anom: 0, dmg_disorder: 0, dmg_abloom: 0, dmg_vortex: 0, dmg_sharp_mult: 0,
    def_ign: 0, def_ign_bu: 0, res_ign: 0, res_ign_cu: 0, daze_pct: 0, buildup: 0,
    t_atk_pct: 0, t_hp_pct: 0, t_dmg: 0, t_cr: 0, t_cd: 0, t_def_shred: 0,
    t_ap: 0, t_daze: 0, t_anom_dmg: 0, t_ice_fire_cd: 0, t_decibel: false,
    cross, scale
  };

  const sn = w.sn, sv = (w.sv || 0) * wepLvMult;
  if (sn === "ATK") eff.init_atk += sv;
  else if (sn === "HP") eff.init_hp += sv;
  else if (sn === "DEF") eff.init_def += sv;
  else if (sn === "CRIT Rate") eff.init_cr += sv;
  else if (sn === "CRIT DMG") eff.init_cd += sv;
  else if (sn === "PEN Ratio") eff.init_pen += sv;
  else if (sn === "Impact") eff.init_imp_pct += sv;
  else if (sn === "Anomaly Mastery") eff.init_am_pct += sv;
  else if (sn === "Anomaly Proficiency") eff.init_ap += sv;
  else if (sn === "Energy Regen") eff.init_er_pct += sv;

  if (cross) return eff;

  const sInit = v => v * scale;
  const s = v => v * scale * passiveUptime;

  // Custom weapon passive override or new custom weapon
  if (w.customMods && w.customMods.enabled) {
    const cm = w.customMods;
    const initKeys = ["init_atk", "init_hp", "init_def", "init_cr", "init_cd", "init_pen", "init_imp_pct", "init_imp_flat", "init_am_pct", "init_am_flat", "init_ap", "init_er_pct"];
    for (const [k, val] of Object.entries(cm)) {
      if (k === "enabled" || k === "replaceBuiltin" || typeof val !== "number") continue;
      if (eff[k] !== undefined) {
        eff[k] += initKeys.includes(k) ? sInit(val) : s(val);
      }
    }
    if (cm.replaceBuiltin) return eff;
  }

  const prof = ch.prof || {}, cid = ch.id, wid = w.id, elem = ch.eb;
  const hasAs = !!prof.has_aftershock, hasEv = !!(prof.has_ether_veil || ctx.teamHasVeil), losesHp = !!prof.loses_hp;
  const sh = prof.shares || {};

  if (wid === "14102") { if (elem === "Physical") eff.dmg_all += s(0.20); eff.dmg_all += s(prof.back_hit ? 0.25 : 0.125); }
  else if (wid === "14104") { const shb = (sh.basic || 0) + (sh.dash || 0); eff.c_atk += s(shb >= 0.45 ? 0.245 : 0.175); }
  else if (wid === "14119") { if (elem === "Ice") { eff.dmg_all += s(0.25); eff.c_cr += s((sh.dash || 0) > 0.05 ? 0.20 : 0.10); } }
  else if (wid === "14120") { eff.init_cr += sInit(0.10); eff.c_cr += s(0.10); if (elem === "Electric") eff.dmg_dash += s(0.40); }
  else if (wid === "14124") { eff.init_cr += sInit(0.15); if (elem === "Ether") { eff.dmg_basic += s(0.35); eff.dmg_dash += s(0.35); } }
  else if (wid === "14129") { eff.init_cd += sInit(0.45); if (elem === "Ice") eff.def_ign += s(0.25 * (cid === "1291" ? 0.90 : 0.65)); }
  else if (wid === "14130") { eff.init_cr += sInit(0.20); if (elem === "Fire" && hasAs) eff.def_ign += s(0.30); }
  else if (wid === "14132") { eff.init_cd += sInit(0.50); if (elem === "Fire") eff.res_ign_cu += s(0.25); }
  else if (wid === "14138") { eff.init_cd += sInit(0.30); eff.c_cd += s(0.30); if (elem === "Electric") eff.dmg_all += s(0.20); }
  else if (wid === "14143") { if (elem === "Physical") eff.res_ign += s(0.20); if (hasEv) { eff.dmg_all += s(0.25); eff.c_cd += s(0.25); } }
  else if (wid === "14146") { eff.init_cr += sInit(0.15); if (elem === "Electric") { eff.dmg_all += s(0.25); eff.def_ign_bu += s(0.20); } }
  else if (wid === "14152") { eff.init_cr += sInit(0.25); if (elem === "Electric") eff.def_ign += s(0.28 * (cid === "1521" ? 0.95 : 0.70)); }
  else if (wid === "14155") { eff.init_cr += sInit(0.20); if (cid === "1551") eff.res_ign += s(0.16); }
  else if (wid === "14159") { if (elem === "Ice") { eff.c_cd += s(0.64); eff.res_ign += s(0.20); } else { eff.c_cd += s(0.32); } }
  else if (wid === "14163") { eff.init_cr += sInit(0.20); eff.c_atk += s(0.10); if (elem === "Wind") eff.res_ign += s(0.15); }
  else if (wid === "13001") { eff.dmg_ult += s(0.72); }
  else if (wid === "13004") { eff.c_atk += s(0.192 * (prof.dodge_qa ? 1.0 : 0.85)); }
  else if (wid === "13013") { eff.c_atk += s(0.096); eff.dmg_ex += s(0.24); }
  else if (wid === "13015") { eff.c_atk += s(0.096 + 0.048); }
  else if (wid === "13106") { eff.c_er_flat += s(0.72); if (elem === "Physical") eff.dmg_all += s(0.45 * (cid === "1061" ? 0.65 : 0.20)); }
  else if (wid === "13108") { if (elem === "Physical") eff.dmg_all += s(0.575 * (prof.ranged_6m ? 0.90 : 0.15)); }
  else if (wid === "13111") { if (elem === "Electric") { eff.dmg_basic += s(0.80 * 0.67); eff.dmg_dash += s(0.80 * 0.67); } }
  else if (wid === "14001") { eff.c_atk += s(0.12); }
  else if (wid === "14109") { eff.init_cd += sInit(0.50); if (elem === "Ice") eff.dmg_all += s(0.40); }
  else if (wid === "14117") { eff.c_er_flat += s(0.60); eff.dmg_all += s(cid === "1171" || cid === "1581" ? 0.35 : (cid === "1331" ? 0.35 * 0.65 : 0.175)); eff.c_ap += s(50); }
  else if (wid === "14118") { eff.c_atk += s(0.12); eff.c_ap += s(75 * (["1221","1181","1541","1561"].includes(cid) ? 0.85 : 0.65)); }
  else if (wid === "14122") { if (elem === "Electric") eff.buildup += s(0.30); eff.c_ap += s(75); eff.dmg_disorder += s(0.25); }
  else if (wid === "14126") { if (elem === "Physical") eff.dmg_all += s(0.36 * 0.90); eff.buildup += s(0.40 * 0.90); }
  else if (wid === "14133") { eff.buildup += s(0.40); if (elem === "Ether") eff.c_ap += s(120 * 0.85); }
  else if (wid === "14140") { eff.init_am_flat += sInit(60); if (elem === "Physical") eff.dmg_all += s(0.40); }
  else if (wid === "14150") { eff.init_ap += sInit(90); if (elem === "Ether") { const up = cid === "1501" ? 0.95 : 0.30; eff.dmg_all += s(0.20 * up); eff.dmg_anom += s(0.10 * up); eff.dmg_disorder += s(0.10 * up); } }
  else if (wid === "14154") { if (elem === "Ice") { eff.dmg_all += s(0.40); if (prof.triggers_abloom) eff.dmg_abloom += s(0.35); } }
  else if (wid === "14156") { eff.init_ap += sInit(70); if (elem === "Wind") { eff.dmg_vortex += s(0.14); eff.t_ap += s(60); eff.c_ap += s(60); } }
  else if (wid === "14158") { eff.init_ap += sInit(96); if (prof.triggers_refringe || cid === "1581") { eff.dmg_anom += s(0.20); eff.t_dmg += s(0.30); eff.dmg_all += s(0.30); } }
  else if (wid === "14164") { eff.init_ap += sInit(90); if (elem === "Fire" && (prof.phoenix_crit || cid === "1641" || ctx.teamHasPhoenix || ctx.teamHasJane)) eff.dmg_all += s(0.40); }
  else if (wid === "13003") { eff.c_atk += s(0.04 * (["1221","1281","1561"].includes(cid) ? 7.0 : 5.0)); }
  else if (wid === "13008") { eff.c_ap += s(144); }
  else if (wid === "13009") { eff.c_atk += s(0.16); eff.dmg_all += s(0.25); }
  else if (wid === "13018") { eff.dmg_all += s(0.184); }
  else if (wid === "13128") { const up = ["1281","1171","1181","1561"].includes(cid) ? 0.85 : 0.55; eff.c_atk += s(0.128 * up); eff.c_ap += s(64 * up); eff.buildup += s(0.40 * up); }
  else if (wid === "14105") { if (elem === "Ice" && losesHp) eff.dmg_all += s(0.18); if (losesHp) eff.c_cr += s(0.20 * (cid === "1051" ? 0.85 : 0.40)); }
  else if (wid === "14137") { eff.init_cr += sInit(0.20); if (elem === "Ether") { eff.dmg_all += s(0.16); eff.dmg_ex += s(0.20); eff.dmg_ult += s(0.20); } }
  else if (wid === "14147") { eff.init_cr += sInit(0.20); if (elem === "Fire") eff.dmg_all += s(0.18); }
  else if (wid === "14153") { eff.init_cr += sInit(0.20); if (elem === "Physical") eff.dmg_all += s(0.20); }
  else if (wid === "13144") { if (elem === "Fire") eff.dmg_all += s(0.24); if (losesHp) eff.c_cr += s(0.24); }
  else if (wid === "13019") { eff.dmg_all += s(0.192); eff.c_cr += s(0.104); }
  else if (wid === "13014") { eff.c_sheer += s(320); }
  else if (wid === "13012") { eff.c_cd += s(0.256 * 0.85); eff.dmg_ex += s(0.16); }
  else if (wid === "14161") { eff.init_cr += sInit(0.25); if (elem === "Electric") { eff.dmg_all += s(0.15); eff.dmg_sharp_mult += s(0.10); } }
  else if (wid === "13017") { eff.init_def += sInit(0.12); eff.c_def += s(0.12); }
  else if (wid === "13021") { eff.dmg_all += s(0.40); }
  else if (wid === "13022") { eff.c_cr += s(0.128); eff.dmg_all += s(0.12); }
  else if (wid === "12016") { eff.dmg_basic += s(0.30); }
  else if (wid === "14110") { eff.c_er_flat += s(0.60); eff.c_imp_pct += s(0.20); }
  else if (wid === "14114") { eff.dmg_basic += s(0.30); eff.daze_pct += s(0.30 * (sh.basic || 0.3)); }
  else if (wid === "14116") { eff.c_imp_pct += s(0.25); eff.t_ice_fire_cd += s(0.30); if (elem === "Ice" || elem === "Fire") eff.c_cd += s(0.30); }
  else if (wid === "14125") { eff.c_imp_pct += s(0.21); eff.t_dmg += s(0.20); eff.dmg_all += s(0.20); }
  else if (wid === "14136") { if (elem === "Electric" && hasAs) { eff.t_def_shred += s(0.25); eff.def_ign += s(0.25); eff.c_imp_pct += s(0.20); } }
  else if (wid === "14139") { eff.daze_pct += s(0.28 * ((sh.ex || 0.3) + (sh.chain || 0.1) + (sh.ult || 0.15))); if (elem === "Fire") { eff.t_dmg += s(0.20); eff.dmg_all += s(0.20); } }
  else if (wid === "14148") { eff.c_er_flat += s(1.50); if (elem === "Physical") { eff.daze_pct += s(0.27); eff.t_cd += s(0.30); eff.c_cd += s(0.30); } }
  else if (wid === "14151") { eff.init_ap += sInit(90); if (elem === "Ether") { eff.t_dmg += s(0.30); eff.dmg_all += s(0.30); eff.c_ap += s(60); } }
  else if (wid === "14157") { eff.init_imp_flat += sInit(30); eff.c_er_flat += s(0.40); if (elem === "Fire") { const up157 = cid === "1571" ? 1.0 : 0.65; eff.res_ign += s(0.15 * up157); eff.t_dmg += s(0.25 * up157); eff.dmg_all += s(0.25 * up157); } }
  else if (wid === "14162") { eff.init_cr += sInit(0.24); if (elem === "Wind") { eff.res_ign += s(0.15); eff.daze_pct += s(0.16); eff.t_dmg += s(0.20); eff.dmg_all += s(0.20); } }
  else if (wid === "13005") { eff.c_imp_pct += s(0.192); }
  else if (wid === "13006") { eff.daze_pct += s(0.24); }
  else if (wid === "13020") { eff.daze_pct += s(0.115); eff.dmg_all += s(0.115); }
  else if (wid === "13101") { if (elem === "Electric") eff.dmg_all += s(0.24); eff.c_er_rate += s(0.1375); }
  else if (wid === "13135") { if (hasAs) { if (elem === "Physical") eff.dmg_all += s(0.24); eff.daze_pct += s(0.16); } }
  else if (wid === "14003") { eff.daze_pct += s(0.384 * (sh.ex || 0.30)); }
  else if (wid === "14121") { eff.c_er_flat += s(0.60); eff.t_dmg += s(0.185); eff.dmg_all += s(0.185); }
  else if (wid === "14131") { eff.c_er_flat += s(0.55); eff.t_dmg += s(0.20); eff.dmg_all += s(0.20); }
  else if (wid === "14141") { if (elem === "Physical") eff.c_am_flat += s(30); if (hasAs) eff.t_ap += s(60); }
  else if (wid === "14145") { eff.c_er_flat += s(0.40); if (prof.has_ether_veil) { eff.t_dmg += s(0.25); eff.t_hp_pct += s(0.15); eff.dmg_all += s(0.25); } }
  else if (wid === "14149") { eff.c_er_flat += s(0.60); if (elem === "Physical") { eff.t_dmg += s(0.25); eff.t_atk_pct += s(0.10); eff.dmg_all += s(0.25); eff.c_atk += s(0.10); } }
  else if (wid === "13002") { eff.t_decibel = true; }
  else if (wid === "13103") { if (elem === "Ether") { const up = cid === "1031" ? 0.75 : (cid === "1311" ? 0.70 : 0.50); eff.t_dmg += s(0.24 * up); eff.dmg_all += s(0.24 * up); eff.c_er_flat += s(0.80 * up); } }
  else if (wid === "13113") { const bdSt = cid === "1131" ? 3.8 : 2.0; if (elem === "Ice") eff.dmg_all += s(0.24); eff.t_atk_pct += s(0.032 * bdSt); eff.c_atk += s(0.032 * bdSt); }
  else if (wid === "13115") { const st = ["1151","1411"].includes(cid) ? 3.8 : 2.3; eff.t_atk_pct += s(0.04 * st); eff.c_atk += s(0.04 * st); }
  else if (wid === "14002") { eff.t_cr += s(0.08); eff.c_cr += s(0.08); }
  else if (wid === "14107") { eff.t_dmg += s(0.18); eff.t_daze += s(0.12); eff.dmg_all += s(0.18); eff.daze_pct += s(0.12); }
  else if (wid === "14134") { eff.c_er_flat += s(0.46); eff.t_atk_pct += s(0.10); eff.t_hp_pct += s(0.10); eff.c_atk += s(0.10); if (prof.has_ether_veil) { eff.t_cd += s(0.30); eff.c_cd += s(0.30); } }
  else if (wid === "13007") { eff.init_hp += sInit(0.125); eff.c_imp_pct += s(0.096); }
  else if (wid === "13010") { eff.init_hp += sInit(0.128); eff.c_atk += s(0.16); }
  else if (wid === "13011") { eff.c_er_rate += s(0.08); }
  else if (wid === "13016") { eff.daze_pct += s(0.05); }
  else if (wid === "13112") { eff.dmg_all += s(0.15); }
  else if (wid === "13127") { eff.c_er_flat += s(0.64); }
  else if (wid === "13142") { eff.dmg_ex += s(0.40); eff.dmg_ult += s(0.40); }
  else if (wid === "12001") { eff.dmg_basic += s(0.12); eff.dmg_dash += s(0.12); }
  else if (wid === "12002") { eff.dmg_ult += s(0.15); eff.dmg_all += s(0.15 * (sh.chain || 0.10)); }
  else if (wid === "12003") { eff.c_er_flat += s(0.25); eff.dmg_ex += s(0.10); }
  else if (wid === "12004") { eff.c_imp_pct += s(0.08); eff.t_daze += s(0.06); }
  else if (wid === "12005") { eff.t_ap += s(10); eff.c_ap += s(10); eff.c_am_flat += s(10); }
  else if (wid === "12006") { eff.t_atk_pct += s(0.08); eff.c_atk += s(0.08); }
  else if (wid === "12007") { eff.daze_pct += s(0.10 * (sh.ex || 0.35)); }
  else if (wid === "12008") { eff.daze_pct += s(0.08); }
  else if (wid === "12009") { eff.c_imp_pct += s(0.08); }
  else if (wid === "12010") { eff.c_am_flat += s(25); }
  else if (wid === "12011") { eff.c_ap += s(25); }
  else if (wid === "12012") { eff.c_er_flat += s(0.30); eff.buildup += s(0.08); }
  else if (wid === "12013") { eff.c_def += s(0.20); }
  else if (wid === "12014") { eff.daze_pct += s(0.04); }
  else if (wid === "12015") { eff.c_atk += s(0.072); }

  return eff;
}

/**
 * Helper to inspect a weapon's effective R1 passive mods on its signature owner (or matching role dummy)
 * so the W-Engine Workshop can pre-populate exact editable values!
 */
export function inspectWeaponPassiveMods(w) {
  if (w.customMods && w.customMods.enabled && w.customMods.replaceBuiltin) {
    return deepClone(w.customMods);
  }
  const owner = SC_CHARS.find(c => c.sig === w.id) || SC_CHARS.find(c => c.wt === w.wt) || SC_CHARS[0];
  const bareWep = { ...w, sv: 0, customMods: null };
  const eff = getWeaponEffects(owner, bareWep, w.r === "S" ? 1 : 5, { teamHasVeil: true, teamHasPhoenix: true });
  const keys = [
    "init_cr", "init_cd", "init_ap", "init_atk", "init_hp", "init_def", "init_am_flat", "init_imp_flat",
    "c_atk", "c_cr", "c_cd", "c_def", "c_sheer", "c_ap", "c_er_flat", "c_imp_pct",
    "dmg_all", "dmg_basic", "dmg_dash", "dmg_ex", "dmg_ult", "dmg_anom", "dmg_disorder", "dmg_abloom",
    "def_ign", "res_ign", "daze_pct", "buildup",
    "t_atk_pct", "t_hp_pct", "t_dmg", "t_cr", "t_cd", "t_def_shred", "t_ap", "t_daze"
  ];
  const out = { enabled: false, replaceBuiltin: true };
  keys.forEach(k => { out[k] = Number((eff[k] || 0).toFixed(4)); });
  return out;
}

// ============================================================================
// Mindscape & Skill Level Scaling
// ============================================================================

export function getMindscapeMods(ch, m, slotCfg = null) {
  const mods = {
    init_cr: 0, init_cd: 0, init_atk_pct: 0, init_hp_pct: 0, init_pen: 0,
    c_atk: 0, c_atk_flat: 0, c_cr: 0, c_cd: 0, c_ap: 0, c_pen: 0, c_er_rate: 0, c_er_flat: 0, c_imp_pct: 0,
    dmg_all: 0, dmg_basic: 0, dmg_dash: 0, dmg_ex: 0, dmg_chain: 0, dmg_ult: 0,
    dmg_anom: 0, dmg_disorder: 0, dmg_abloom: 0, dmg_vortex: 0,
    anom_crit_cr_add: 0, anom_crit_cd_add: 0, def_ign: 0, res_ign: 0, buildup: 0, daze_pct: 0,
    skill_lv_mult: 1, daze_lv_mult: 1, proc_mult: 1,
    yanagi_pol_mult: 1, rem_lum_mult: 1, phx_ab_mult: 1, stun_mult_override: null,
    tb_atk_flat: 0, tb_atk_pct: 0, tb_dmg: 0, tb_cd: 0, tb_cr: 0,
    tb_def_shred: 0, tb_pen: 0, tb_res_shred: 0, tb_stun_mult: 0,
    tb_anom_dmg: 0, tb_buildup: 0, tb_sheer: 0,
    tb_pen_mult: 1, tb_anom_aa_mult: 1, tb_lighter_elation_mult: 1, tb_extra_mult: 1,
    tb_astra_dmg_add: 0, tb_astra_cd_add: 0, tb_lucia_sheer_cap_add: 0, tb_lucia_sheer_rate_add: 0,
    tb_pulchra_all: 0, tb_pan_m6: 0
  };
  const mc = Math.max(0, Math.min(6, Math.round(Number(m) || 0)));
  if (mc >= 1 && ch.m_stages && ch.m_stages[mc - 1]) {
    Object.assign(mods, ch.m_stages[mc - 1]);
  }
  const cid = ch.id;
  if (cid === "1061" && mc >= 4) { mods.c_er_flat += 0.35; mods.proc_mult *= 1.04; }
  else if (cid === "1081" && mc >= 1) { mods.c_er_flat += 0.30; mods.proc_mult *= 1.035; }
  else if (cid === "1111" && mc >= 1) { mods.c_er_flat += 0.40; mods.proc_mult *= 1.05; }
  else if (cid === "1181" && mc >= 4) { mods.c_er_rate += 0.12; mods.buildup += 0.08; mods.proc_mult *= 1.035; }
  else if (cid === "1281" && mc >= 4) { mods.c_er_flat += 0.55; mods.proc_mult *= 1.06; }
  else if (cid === "1161" && mc >= 4) { mods.c_er_rate += 0.10; mods.tb_extra_mult *= 1.03; }
  else if (cid === "1251" && mc >= 4) { mods.c_er_flat += 0.30; mods.proc_mult *= 1.03; }
  else if (cid === "1011") {
    if (mc >= 1) { mods.c_er_rate += 0.12; mods.daze_pct += 0.04; mods.proc_mult *= 1.025; }
    if (mc >= 4) { mods.c_er_flat += 0.25; mods.tb_extra_mult *= 1.025; }
  }
  else if (cid === "1351" && mc >= 4) { mods.c_er_flat += 0.35; mods.proc_mult *= 1.04; }
  else if (cid === "1031" && mc >= 2) { mods.c_er_flat += 0.45; }
  else if (cid === "1131") {
    if (mc >= 1) mods.tb_extra_mult *= 1.03;
    if (mc >= 2) { mods.proc_mult *= 1.04; mods.tb_extra_mult *= 1.02; }
  }
  else if (cid === "1151") {
    if (mc >= 1) { mods.c_er_flat += 0.40; mods.proc_mult *= 1.04; }
    if (mc >= 2) { mods.tb_extra_mult *= 1.025; mods.proc_mult *= 1.03; }
  }
  else if (cid === "1211" && mc >= 4) { mods.c_er_flat += 0.45; mods.tb_extra_mult *= 1.02; mods.proc_mult *= 1.03; }
  else if (cid === "1071" && mc >= 4) { mods.daze_pct += 0.08; mods.proc_mult *= 1.05; }
  else if (cid === "1271" && mc >= 2) { mods.buildup += 0.20; mods.tb_buildup += 0.15; mods.proc_mult *= 1.04; }
  else if (cid === "1421" && mc >= 2) { mods.c_er_flat += 0.35; mods.tb_extra_mult *= 1.035; }

  // Apply custom base skill level scaling (Lv.1~12 base; M3/M5 adds +2/+4 on top automatically)
  if (slotCfg && slotCfg.skillLv !== undefined && Number(slotCfg.skillLv) !== 12) {
    const baseLv = Math.max(1, Math.min(12, Number(slotCfg.skillLv) || 12));
    const perLv = ch.r === "A" ? 0.0375 : 0.0455;
    const dazePerLv = ch.r === "A" ? 0.025 : 0.0305;
    mods.skill_lv_mult *= Math.max(0.45, 1.0 + (baseLv - 12) * perLv);
    mods.daze_lv_mult *= Math.max(0.60, 1.0 + (baseLv - 12) * dazePerLv);
  }
  return mods;
}

// ============================================================================
// Drive Disc 2pc / 4pc Bonuses (Built-in + Custom Set Support)
// ============================================================================

export function getTwoPcBonus(setId, ch) {
  const b = { init_cr: 0, init_cd: 0, init_atk: 0, init_hp: 0, init_def: 0, init_pen: 0, init_imp: 0, init_ap: 0, init_am: 0, init_er: 0, daze_pct: 0, dmg_elem: 0, dmg_basic: 0, dmg_dash: 0 };
  if (!setId) return b;
  const ds = DISC_SETS[setId];
  if (ds && ds.customMods && ds.customMods.enabled) {
    const c2 = ds.customMods.d2 || {};
    for (const k of Object.keys(b)) {
      if (typeof c2[k] === "number") b[k] += c2[k];
    }
    if (ds.customMods.replaceBuiltin) return b;
  }
  const eb = ch.eb;
  if (setId === "啄木") b.init_cr += 0.08;
  else if (setId === "折枝") b.init_cd += 0.16;
  else if (setId === "激素" || setId === "静听") b.init_atk += 0.10;
  else if (setId === "云岿" || setId === "雪兔") b.init_hp += 0.10;
  else if (setId === "荆棘" || setId === "灵魂") b.init_def += 0.16;
  else if (setId === "河豚") b.init_pen += 0.08;
  else if (setId === "震星") b.init_imp += 0.06;
  else if (setId === "山大王") b.daze_pct += 0.06;
  else if (setId === "自由" || setId === "混沌爵士" || setId === "谶羽") b.init_ap += 30;
  else if (setId === "法厄同") b.init_am += 0.08;
  else if (setId === "摇摆" || setId === "月光") b.init_er += 0.20;
  else if (setId === "拂晓") b.dmg_basic += 0.15;
  else if (setId === "如影") b.dmg_dash += 0.15;
  else if ((setId === "沧浪" || setId === "獠牙") && eb === "Physical") b.dmg_elem += 0.10;
  else if (setId === "炎狱" && eb === "Fire") b.dmg_elem += 0.10;
  else if ((setId === "极地" || setId === "囚徒") && eb === "Ice") b.dmg_elem += 0.10;
  else if (setId === "雷暴" && eb === "Electric") b.dmg_elem += 0.10;
  else if (setId === "呼啸" && eb === "Wind") b.dmg_elem += 0.10;
  else if ((setId === "混沌重" || setId === "流光" || setId === "拂晓行纪") && eb === "Ether") b.dmg_elem += 0.10;
  return b;
}

export function getFourPcSelfBonus(fourPc, ch, initStats, ctx, slotCfg = null) {
  const f = { c_atk: 0, c_cr: 0, c_cd: 0, c_ap: 0, dmg_all: 0, dmg_elem: 0, dmg_basic: 0, dmg_dash: 0, dmg_ex: 0, dmg_ult: 0, dmg_anom: 0, dmg_disorder: 0, dmg_sheer: 0, daze_pct: 0 };
  if (!fourPc || fourPc === "无") return f;

  let fUptime = slotCfg?.fourPcUptime !== undefined ? Math.max(0, Math.min(1.0, Number(slotCfg.fourPcUptime))) : 1.0;
  // Swap-cancel hormone Cov scaling when user keeps default 1.0 uptime on Hormone Punk
  if (fourPc === "激素" && (slotCfg?.fourPcUptime === undefined || slotCfg?.fourPcUptime === 1.0) && ctx.qaSwap) {
    fUptime *= (0.82 + 0.18 * (ctx.qaSwap.hormoneCov || 0.90));
  }

  const ds = DISC_SETS[fourPc];
  if (ds && ds.customMods && ds.customMods.enabled) {
    const c4 = ds.customMods.d4Self || {};
    for (const k of Object.keys(f)) {
      if (typeof c4[k] === "number") f[k] += c4[k] * fUptime;
    }
    if (ds.customMods.replaceBuiltin) return f;
  }

  const eb = ch.eb, wt = ch.wt, prof = ch.prof || {};
  const te = ctx.teamElems || new Set([eb]);
  const u = v => v * fUptime;

  if (fourPc === "啄木") f.c_atk += u(0.18);
  else if (fourPc === "河豚") { f.dmg_ult += u(0.20); f.c_atk += u(0.12); }
  else if (fourPc === "震星") f.daze_pct += u(0.20);
  else if (fourPc === "激素") f.c_atk += u(ch.id === "1291" ? 0.25 : 0.18);
  else if (fourPc === "混沌爵士") { if (eb === "Fire" || eb === "Electric") f.dmg_elem += 0.15; f.dmg_ex += u(0.20); }
  else if (fourPc === "炎狱") { if (te.has("Fire")) f.c_cr += u(0.28); }
  else if (fourPc === "混沌重") { f.c_cd += 0.20 + (te.has("Ether") ? u(0.28) : 0); }
  else if (fourPc === "雷暴") { if (te.has("Electric")) f.c_atk += u(0.28); }
  else if (fourPc === "极地") { const add = 0.20 + (te.has("Ice") ? u(0.20) : 0); f.dmg_basic += add; f.dmg_dash += add; }
  else if (fourPc === "獠牙") { if (te.has("Physical")) f.dmg_all += u(0.35); }
  else if (fourPc === "折枝") { if (initStats.init_am >= 115) f.c_cd += 0.30; if (te.has("Ice")) f.c_cr += u(0.12); }
  else if (fourPc === "如影") { if (prof.has_aftershock || ((prof.shares || {}).dash || 0) >= 0.10) { f.c_atk += u(0.12); f.c_cr += u(0.12); } }
  else if (fourPc === "法厄同") { f.c_ap += u(45); if (eb === "Ether" && ctx.activeCount >= 2) f.dmg_elem += u(0.25); }
  else if (fourPc === "云岿") { f.c_cr += u(0.12); if (wt === "Rupture") f.dmg_sheer += u(0.10); }
  else if (fourPc === "拂晓") { f.dmg_basic += 0.20 + (wt === "Attack" ? u(0.20) : 0); }
  else if (fourPc === "沧浪") { if (ctx.teamHasVeil || prof.has_ether_veil) { f.c_cr += u(0.10 + (wt === "Attack" ? 0.10 : 0)); if (wt === "Attack") f.c_atk += u(0.10); } }
  else if (fourPc === "流光") { f.c_ap += u(36); f.dmg_all += u(ctx.stunCount > 0 ? 0.22 : 0.15); }
  else if (fourPc === "囚徒") { if (prof.triggers_abloom) f.c_ap += u(48); if (eb === "Ice") { f.dmg_anom += u(0.16); f.dmg_disorder += u(0.16); } }
  else if (fourPc === "呼啸") { f.c_ap += u(50); if (eb === "Wind") f.dmg_all += u(0.18); }
  else if (fourPc === "拂晓行纪") { if (eb === "Ether") f.c_cd += 0.30; f.c_atk += u(0.10); }
  else if (fourPc === "谶羽") { f.c_ap += u(50); if (eb === "Lumiflux") f.dmg_anom += u(0.15); }
  else if (fourPc === "荆棘") { f.dmg_all += 0.15; if (initStats.init_def >= 1800) f.c_cr += 0.16; else if (initStats.init_def >= 1000) f.c_cr += 0.08; }
  return f;
}

export function checkAdditionalAbility(idx, activeMembers, slotCfg) {
  if (slotCfg.aaMode === "on") return { active: true, reason: "手动强制开启" };
  if (slotCfg.aaMode === "off") return { active: false, reason: "手动强制关闭" };
  const me = activeMembers[idx];
  const aa = me.ch.aa || { roles: [], sameElem: true, sameCamp: true, condText: "同属性/同阵营" };
  const mates = activeMembers.filter((_, j) => j !== idx);
  if (mates.length === 0) return { active: false, reason: `单人无队友（需：${aa.condText}）` };
  for (const m of mates) {
    if ((aa.roles || []).includes(m.ch.wt)) return { active: true, reason: `由 ${m.ch.n}(${m.ch.p}) 触发` };
    if (aa.needDefAssist && m.ch.defAssist) return { active: true, reason: `由 ${m.ch.n}(招架支援) 触发` };
    if (aa.sameElem && m.ch.eb === me.ch.eb) return { active: true, reason: `由 ${m.ch.n}(同属性) 触发` };
    if (aa.sameCamp && m.ch.campId === me.ch.campId) return { active: true, reason: `由 ${m.ch.n}(${me.ch.camp}) 触发` };
  }
  return { active: false, reason: `未满足（需：${aa.condText}）` };
}

// ============================================================================
// 3-Mode Member Sheet Evaluator: "auto" | "pieces" (Disc 1~6) | "panel" (Direct Stat Override)
// ============================================================================

export function sumTwoPcBonuses(twoPcIds, ch) {
  const total = { init_cr: 0, init_cd: 0, init_atk: 0, init_hp: 0, init_def: 0, init_pen: 0, init_imp: 0, init_ap: 0, init_am: 0, init_er: 0, daze_pct: 0, dmg_elem: 0, dmg_basic: 0, dmg_dash: 0 };
  for (const sid of twoPcIds) {
    const b = getTwoPcBonus(sid, ch);
    for (const k of Object.keys(total)) total[k] += b[k];
  }
  return total;
}

export function applyEnterCombatStatConversions(ch, initStats, coreScale = 1.0) {
  if (ch.id === "1611") initStats.init_cr += initStats.init_cd * 0.35 * coreScale;
  if (ch.id === "1121") initStats.init_atk += 0.80 * coreScale * initStats.init_def;
  if (ch.id === "1341") initStats.init_cr += (initStats.init_hp / 1000.0) * 0.014 * coreScale;
  if (ch.id === "1621" && initStats.init_er > 1.2) {
    initStats.init_atk += Math.min(960, (initStats.init_er - 1.2) * 500) * coreScale;
    initStats.init_imp += Math.min(76.8, (initStats.init_er - 1.2) * 40) * coreScale;
  }
  if (ch.id === "1511" && initStats.init_am > 110) initStats.init_imp += (initStats.init_am - 110) * coreScale;
  if (ch.id === "1481" && initStats.init_cr > 0.50) initStats.init_imp += Math.min(100, (initStats.init_cr - 0.50) * 200) * coreScale;
}

export function evalMemberSheet(ch, m, w, refLevel, fourPc, twoPc, d4, d5, d6, sub, mods, ctx, slotCfg = null) {
  const eff = getWeaponEffects(ch, w, refLevel, ctx, slotCfg);
  eff.init_cr += mods.init_cr; eff.init_cd += mods.init_cd;
  eff.init_atk += mods.init_atk_pct; eff.init_hp += mods.init_hp_pct; eff.init_pen += mods.init_pen;
  eff.c_atk += mods.c_atk; eff.c_cr += mods.c_cr; eff.c_cd += mods.c_cd; eff.c_ap += mods.c_ap;
  eff.c_er_rate += mods.c_er_rate; eff.c_er_flat += mods.c_er_flat + (ctx.bangboo?.erFlat || 0); eff.c_imp_pct += mods.c_imp_pct;
  eff.dmg_all += mods.dmg_all; eff.dmg_basic += mods.dmg_basic; eff.dmg_dash += mods.dmg_dash;
  eff.dmg_ex += mods.dmg_ex; eff.dmg_ult += mods.dmg_ult;
  eff.dmg_anom += mods.dmg_anom; eff.dmg_disorder += mods.dmg_disorder; eff.dmg_abloom += mods.dmg_abloom; eff.dmg_vortex += mods.dmg_vortex;
  eff.def_ign += mods.def_ign; eff.res_ign += mods.res_ign; eff.buildup += mods.buildup; eff.daze_pct += mods.daze_pct;

  const coreIdx = slotCfg?.coreLv !== undefined ? Math.max(0, Math.min(6, Math.round(Number(slotCfg.coreLv)))) : 6;
  const coreStatScale = CORE_STAT_SCALE[coreIdx];
  const coreBuffScale = CORE_BUFF_SCALE[coreIdx];
  const lvStatScale = calcBaseStatLvMult(slotCfg?.agentLv ?? 60);

  const buildMode = slotCfg?.buildMode || "auto";

  // MODE 3: Direct Out-of-Combat Panel Stat Override ("panel")
  if (buildMode === "panel" && slotCfg?.panel) {
    const pn = slotCfg.panel;
    const d2a = getTwoPcBonus(fourPc === "无" ? "啄木" : fourPc, ch);
    const d2b = getTwoPcBonus(twoPc, ch);
    const initStats = {
      init_hp: Math.max(100, Number(pn.hp) || 10000),
      init_atk: Math.max(100, Number(pn.atk) || 2500),
      init_def: Math.max(50, Number(pn.def) || 800),
      init_cr: (Number(pn.cr) || 50) / 100.0,
      init_cd: (Number(pn.cd) || 120) / 100.0,
      init_pen: (Number(pn.penRatio) || 0) / 100.0 + (ch.prof?.self_pen || 0) + (mods.c_pen || 0),
      s_pen_flat: Number(pn.penFlat) || 0,
      init_ap: Number(pn.ap) || 120,
      init_am: Number(pn.am) || ch.am,
      init_imp: Number(pn.imp) || ch.imp,
      init_er: Number(pn.er) || ch.er
    };
    if (!pn.includesEnterCombat) {
      applyEnterCombatStatConversions(ch, initStats, coreBuffScale);
    }
    const m_elem = (Number(pn.elemBonus) || 0) / 100.0;
    const f4 = getFourPcSelfBonus(fourPc, ch, initStats, ctx, slotCfg);
    return {
      eff, mods, d2a, d2b, f4, ...initStats, m_elem,
      d4: "直填", d5: "面板", d6: "锁定",
      sub: {}, fourPc, twoPc, buildMode: "panel", coreBuffScale
    };
  }

  // MODE 2: Exact 6-Piece Individual Drive Disc Builder ("pieces")
  let effFourPc = fourPc;
  let effTwoPc = twoPc;
  let d2a, d2b, d2extra: any = {};
  let m_atk_pct = 0, m_hp_pct = 0, m_def_pct = 0, m_cr = 0, m_cd = 0, m_ap = 0, m_elem = 0, m_pen = 0, m_am_pct = 0, m_imp_pct = 0, m_er_pct = 0;
  let flat_hp = 2200.0, flat_atk = 316.0, flat_def = 184.0;
  let effSub = sub || {};

  if (buildMode === "pieces" && Array.isArray(slotCfg?.pieces) && slotCfg.pieces.length === 6) {
    const pcs = slotCfg.pieces;
    const setCounts: Record<string, number> = {};
    const aggSub = { CR: 0, CD: 0, "ATK%": 0, ATK_FLAT: 0, "HP%": 0, HP_FLAT: 0, "DEF%": 0, DEF_FLAT: 0, AP: 0, PEN: 0 };
    flat_hp = 0; flat_atk = 0; flat_def = 0;

    pcs.forEach((p, idx) => {
      if (!p) return;
      if (p.set && p.set !== "无") setCounts[p.set] = (setCounts[p.set] || 0) + 1;
      const ms = typeof p.mainScale === "number" && p.mainScale > 0 ? p.mainScale : 1.0;
      const mn = p.main || (idx === 0 ? "HP_FLAT" : idx === 1 ? "ATK_FLAT" : idx === 2 ? "DEF_FLAT" : "ATK%");
      const elemMatches = !p.elemType || p.elemType === ch.eb || (p.elemType === "Ether" && ch.eb === "Lumiflux");
      if (idx === 0 || mn === "HP_FLAT") flat_hp += 2200.0 * ms;
      else if (idx === 1 || mn === "ATK_FLAT") flat_atk += 316.0 * ms;
      else if (idx === 2 || mn === "DEF_FLAT") flat_def += 184.0 * ms;
      else if (mn === "ATK%") m_atk_pct += 0.30 * ms;
      else if (mn === "HP%") m_hp_pct += 0.30 * ms;
      else if (mn === "DEF%") m_def_pct += 0.48 * ms;
      else if (mn === "CR") m_cr += 0.24 * ms;
      else if (mn === "CD") m_cd += 0.48 * ms;
      else if (mn === "AP") m_ap += 92.0 * ms;
      else if (mn === "ELEM") { if (elemMatches) m_elem += 0.30 * ms; }
      else if (mn === "PEN") m_pen += 0.24 * ms;
      else if (mn === "AM") m_am_pct += 0.30 * ms;
      else if (mn === "IMP") m_imp_pct += 0.18 * ms;
      else if (mn === "ER") m_er_pct += 0.60 * ms;

      if (p.subs) {
        for (const k of Object.keys(aggSub)) aggSub[k] += Number(p.subs[k]) || 0;
      }
    });

    const active2pcs = [];
    effFourPc = "无";
    for (const [sid, cnt] of Object.entries(setCounts)) {
      if (cnt >= 2) active2pcs.push(sid);
      if (cnt >= 4) effFourPc = sid;
    }
    effTwoPc = active2pcs.find(s => s !== effFourPc) || active2pcs[0] || "无";
    d2a = sumTwoPcBonuses(active2pcs.slice(0, 1), ch);
    d2b = sumTwoPcBonuses(active2pcs.slice(1), ch);
    effSub = aggSub;
    d4 = pcs[3]?.main || "CR";
    d5 = pcs[4]?.main || "ELEM";
    d6 = pcs[5]?.main || "ATK%";
  } else {
    // MODE 1: Standard / Graduation Auto or Locked Main + Roll Totals
    d2a = getTwoPcBonus(fourPc === "无" ? "啄木" : fourPc, ch);
    d2b = getTwoPcBonus(twoPc, ch);
    d2extra = fourPc === "无" ? { init_atk: 0.10 } : {};
    m_atk_pct = (d4 === "ATK%" ? 0.30 : 0) + (d5 === "ATK%" ? 0.30 : 0) + (d6 === "ATK%" ? 0.30 : 0);
    m_hp_pct  = (d4 === "HP%" ? 0.30 : 0) + (d5 === "HP%" ? 0.30 : 0) + (d6 === "HP%" ? 0.30 : 0);
    m_def_pct = (d4 === "DEF%" ? 0.48 : 0) + (d5 === "DEF%" ? 0.48 : 0) + (d6 === "DEF%" ? 0.48 : 0);
    m_cr = d4 === "CR" ? 0.24 : 0;
    m_cd = d4 === "CD" ? 0.48 : 0;
    m_ap = d4 === "AP" ? 92.0 : 0;
    m_elem = d5 === "ELEM" ? 0.30 : 0;
    m_pen = d5 === "PEN" ? 0.24 : 0;
    m_am_pct = d6 === "AM" ? 0.30 : 0;
    m_imp_pct = d6 === "IMP" ? 0.18 : 0;
    m_er_pct = d6 === "ER" ? 0.60 : 0;
  }

  const s_atk_pct = (effSub["ATK%"] || 0) * 0.03;
  const s_atk_flat = (effSub.ATK_FLAT || 0) * 19.0;
  const s_hp_pct  = (effSub["HP%"] || 0) * 0.03;
  const s_hp_flat = (effSub.HP_FLAT || 0) * 112.0;
  const s_def_pct = (effSub["DEF%"] || 0) * 0.048;
  const s_def_flat = (effSub.DEF_FLAT || 0) * 15.0;
  const s_cr = (effSub.CR || 0) * 0.024;
  const s_cd = (effSub.CD || 0) * 0.048;
  const s_ap = (effSub.AP || 0) * 9.0;
  const s_pen_flat = (effSub.PEN || 0) * 9.0;

  const b_atk = ch.atk * lvStatScale + eff.base_atk;
  const b_hp = ch.hp * lvStatScale;
  const b_def = ch.def * lvStatScale + eff.base_def;
  const potOn = slotCfg?.potOverride === "on" ? true : (slotCfg?.potOverride === "off" ? false : (ctx.potAwakening !== false));
  const rinaPotPen = (ch.id === "1211" && potOn) ? 0.016 : 0;

  const init_atk = b_atk * (1 + (ch.cp_atk || 0) * coreStatScale + eff.init_atk + d2a.init_atk + d2b.init_atk + (d2extra.init_atk || 0) + m_atk_pct + s_atk_pct) + flat_atk + s_atk_flat;
  const init_hp = b_hp * (1 + (ch.cp_hp || 0) * coreStatScale + eff.init_hp + d2a.init_hp + d2b.init_hp + m_hp_pct + s_hp_pct) + flat_hp + s_hp_flat;
  const init_def = b_def * (1 + eff.init_def + d2a.init_def + d2b.init_def + m_def_pct + s_def_pct) + flat_def + s_def_flat;
  const init_cr = ch.cr + eff.init_cr + d2a.init_cr + d2b.init_cr + m_cr + s_cr;
  const init_cd = ch.cd + eff.init_cd + d2a.init_cd + d2b.init_cd + m_cd + s_cd;
  const init_pen = ch.pen + eff.init_pen + d2a.init_pen + d2b.init_pen + m_pen + (ch.prof?.self_pen || 0) + rinaPotPen + (mods.c_pen || 0);
  const init_ap = ch.ap + eff.init_ap + d2a.init_ap + d2b.init_ap + m_ap + s_ap;
  const init_am = ch.am * (1 + eff.init_am_pct + d2a.init_am + d2b.init_am + m_am_pct) + eff.init_am_flat;
  const er2pc = ctx.er2pcCountsInit === false ? 0 : (d2a.init_er + d2b.init_er);
  const init_er = ch.er * (1 + eff.init_er_pct + er2pc + m_er_pct);
  const init_imp = ch.imp * (1 + eff.init_imp_pct + d2a.init_imp + d2b.init_imp + m_imp_pct) + eff.init_imp_flat;

  const initStats = { init_atk, init_hp, init_def, init_cr, init_cd, init_pen, init_ap, init_am, init_er, init_imp, s_pen_flat };
  applyEnterCombatStatConversions(ch, initStats, coreBuffScale);

  const f4 = getFourPcSelfBonus(effFourPc, ch, initStats, ctx, slotCfg);
  return {
    eff, mods, d2a, d2b, f4, ...initStats, m_elem,
    d4, d5, d6, sub: effSub, fourPc: effFourPc, twoPc: effTwoPc,
    buildMode, coreBuffScale
  };
}

// ============================================================================
// Pairwise Team Buff Engine (Built-in + Full Custom Character Team Buffs)
// ============================================================================

export function computePairBuff(src, dst, ctx, notes) {
  const isSelf = src.idx === dst.idx;
  const up = src.uptime;
  const cid = src.ch.id, m = src.m, st = src.sheet, eff = st.eff, mods = st.mods;
  const coreScale = st.coreBuffScale ?? 1.0;
  const aa = src.aa.active;
  const potOn = src.cfg?.potOverride === "on" ? true : (src.cfg?.potOverride === "off" ? false : (ctx.potAwakening !== false));
  const tb = dst.ch.eb, twt = dst.ch.wt, tHasAs = !!(dst.ch.prof && dst.ch.prof.has_aftershock);

  const b = emptyTeamBuffs();

  // Custom Character Team Buffs (supports both edited built-in & brand-new custom characters!)
  if (src.ch.customTeamBuff && src.ch.customTeamBuff.enabled) {
    const ctb = src.ch.customTeamBuff;
    const applySelfOk = !isSelf || ctb.appliesToSelf !== false;
    const roleOk = !ctb.targetRole || ctb.targetRole === "ALL" || ctb.targetRole === twt;
    const elemOk = !ctb.targetElem || ctb.targetElem === "ALL" || ctb.targetElem === tb;
    if (applySelfOk && roleOk && elemOk) {
      b.atk_flat += (ctb.atk_flat || 0) * up * coreScale;
      b.atk_pct += (ctb.atk_pct || 0) * up * coreScale;
      b.hp_pct += (ctb.hp_pct || 0) * up * coreScale;
      b.def_flat += (ctb.def_flat || 0) * up * coreScale;
      b.sheer += (ctb.sheer || 0) * up * coreScale;
      b.dmg += (ctb.dmg || 0) * up * coreScale;
      b.cr += (ctb.cr || 0) * up * coreScale;
      b.cd += (ctb.cd || 0) * up * coreScale;
      b.def_shred += (ctb.def_shred || 0) * up * coreScale;
      b.pen += (ctb.pen || 0) * up * coreScale;
      b.res_shred += (ctb.res_shred || 0) * up * coreScale;
      b.stun_mult += (ctb.stun_mult || 0) * up * coreScale;
      b.stun_mult_alltime += (ctb.stun_mult_alltime || 0) * up * coreScale;
      b.ap += (ctb.ap || 0) * up * coreScale;
      b.anom_dmg += (ctb.anom_dmg || 0) * up * coreScale;
      b.disorder_dmg += (ctb.disorder_dmg || 0) * up * coreScale;
      b.buildup += (ctb.buildup || 0) * up * coreScale;
      b.lac_dmg += (ctb.lac_dmg || 0) * up * coreScale;
      // Optional dynamic stat conversion rule (e.g. init_atk * 0.35 -> atk_flat cap 1200)
      if (ctb.convFrom && ctb.convTo && ctb.convRate) {
        const srcVal = st[ctb.convFrom] || 0;
        const thresh = Number(ctb.convThreshold) || 0;
        if (srcVal > thresh) {
          let convAmt = (srcVal - thresh) * Number(ctb.convRate);
          if (ctb.convCap > 0) convAmt = Math.min(Number(ctb.convCap), convAmt);
          if (b[ctb.convTo] !== undefined) b[ctb.convTo] += convAmt * up * coreScale;
        }
      }
    }
    if (ctb.replaceBuiltin) {
      if (!isSelf) {
        b.atk_pct += eff.t_atk_pct * up; b.hp_pct += eff.t_hp_pct * up; b.dmg += eff.t_dmg * up;
        b.cr += eff.t_cr * up; b.cd += eff.t_cd * up; b.def_shred += eff.t_def_shred * up;
        b.ap += eff.t_ap * up; b.anom_dmg += eff.t_anom_dmg * up;
      }
      return b;
    }
  }

  if (cid === "1581") {
    if (aa) {
      const rate = ctx.anomCount >= 3 ? 0.40 : (ctx.anomCount === 2 ? 0.12 : 0.06);
      b.atk_flat += Math.min(1600, st.init_atk * rate) * up * coreScale;
      b.buildup += 0.15 * up * coreScale;
    }
    if (!isSelf && tb !== "Lumiflux") {
      const estAp = st.init_ap + eff.c_ap + st.f4.c_ap + 30;
      b.refringe_mult += (estAp * 0.0002 + (ctx.anomCount >= 3 ? 0.10 : 0)) * up * coreScale;
    }
  }
  if (cid === "1641") {
    const pcr = Math.min(1.0, 0.30 + Math.max(0, st.init_am - 155) * 0.007) * coreScale;
    const pcd = 0.25 + (aa ? 0.15 : 0) + (mods.anom_crit_cd_add || 0);
    b.phoenix_crit = { cr: pcr * up, cd: pcd };
  }
  if (cid === "1541" && aa) b.def_ign_abloom += 0.40 * up;
  if (cid === "1301" && aa) b.def_ign_aftershock += 0.25 * up;

  if (isSelf) {
    b.hp_pct += (eff.t_hp_pct || 0) * up;
    if (src.w.id === "14141") b.ap += (eff.t_ap || 0) * up;
    if (cid === "1031") {
      b.def_shred += 0.40 * up * coreScale; if (aa && tb === "Ether") b.dmg += 0.25 * up;
    } else if (cid === "1131") {
      b.atk_flat += Math.min(1000, st.init_atk * 0.40) * up * coreScale; if (aa && tb === "Ice") b.dmg += 0.20 * up;
    } else if (cid === "1151") {
      b.atk_flat += Math.min(600, st.init_atk * 0.258 + 104) * up * coreScale;
      if (aa) b.extra_mult *= 1.12;
      if (m >= 6) b.dmg += 0.05 * up;
    } else if (cid === "1211") {
      const basePen = Math.min(0.30, st.init_pen * 0.25 + 0.12) * coreScale;
      b.pen += Math.min(0.39, basePen * mods.tb_pen_mult) * up;
      if (potOn) { b.atk_flat += Math.min(576, st.init_pen * 800) * up; b.def_flat += Math.min(468, st.init_pen * 650) * up; }
      if (aa && tb === "Electric") b.dmg += 0.10 * up;
    } else if (cid === "1311") {
      b.atk_flat += (Math.min(1200, st.init_atk * 0.35) * coreScale + (mods.tb_atk_flat || 0)) * up;
      b.dmg += (mods.tb_astra_dmg_add || 0) * up; b.cd += (mods.tb_astra_cd_add || 0) * up;
    } else if (cid === "1411") {
      b.atk_flat += Math.min(1200, st.init_atk * 0.40) * up * coreScale;
      if (aa) {
        const am_over = Math.max(0, Math.min(100, (st.init_am + eff.c_am_flat) - 100));
        b.anom_dmg += am_over * 0.002 * mods.tb_anom_aa_mult * up;
        b.buildup += am_over * 0.002 * up;
      }
    } else if (cid === "1451") {
      b.hp_pct += 0.05 * up;
    } else if (cid === "1491") {
      b.atk_flat += (Math.min(1050, st.init_atk * 0.30) + 50) * up * coreScale; if (aa) b.stun_mult += 0.30 * up;
    } else if (cid === "1071") {
      if (aa) b.dmg += 0.25 * up;
    } else if (cid === "1271") {
      if (aa) b.buildup += 0.20 * up;
    } else if (cid === "1341") {
      b.hp_pct += 0.05 * up;
    } else if (cid === "1101") {
      if (aa) b.dmg_chain += 0.70 * up;
      if (potOn) b.cd += 0.35 * up;
    } else if (cid === "1141") {
      b.res_shred += 0.25 * up; if (aa) b.stun_mult += 0.35 * up;
    } else if (cid === "1161") {
      b.res_shred += 0.15 * up; b.stun_mult += (mods.tb_stun_mult || 0) * up;
      if (aa) {
        const c_imp = (st.init_imp + eff.c_imp_flat) * (1 + 0.20 + eff.c_imp_pct);
        b.dmg += Math.min(0.75, 0.25 + Math.max(0, c_imp - 170) / 10 * 0.05) * mods.tb_lighter_elation_mult * up;
      }
    } else if (cid === "1251") {
      b.stun_mult += (0.80 * coreScale + (mods.tb_stun_mult || 0)) * up;
    } else if (cid === "1351") {
      if (aa) { if (mods.tb_pulchra_all) b.dmg += 0.30 * up; else b.dmg_aftershock += 0.30 * up; }
    } else if (cid === "1361") {
      b.stun_mult_alltime += (0.35 * coreScale + (mods.tb_stun_mult || 0)) * up;
    } else if (cid === "1391") {
      b.cd += (0.20 + (st.init_atk >= 2800 ? Math.min(0.30, Math.floor((st.init_atk - 2800) / 100) * 0.05) : 0)) * up * coreScale;
      b.dmg += 0.11 * up; b.stun_mult += (mods.tb_stun_mult || 0) * up;
    } else if (cid === "1481") {
      b.stun_mult += (0.30 * coreScale + (mods.tb_stun_mult || 0)) * up;
    } else if (cid === "1511") {
      b.atk_flat += 50 * up; b.buildup += (0.135 + (aa ? 0.15 : 0)) * up;
      if (aa) b.stun_mult += (0.30 + (mods.tb_stun_mult || 0)) * up;
    } else if (cid === "1571") {
      if (aa) b.stun_mult += (0.30 + (mods.tb_stun_mult || 0)) * up;
    } else if (cid === "1621") {
      b.cd += Math.min(0.40, st.init_cr * 0.40) * up * coreScale;
      if (aa) { b.stun_mult += (0.30 + (mods.tb_stun_mult || 0)) * up; b.dmg += 0.08 * up; }
    }
    return b;
  }

  b.atk_pct += eff.t_atk_pct * up; b.hp_pct += eff.t_hp_pct * up; b.dmg += eff.t_dmg * up;
  b.cr += eff.t_cr * up; b.cd += eff.t_cd * up; b.def_shred += eff.t_def_shred * up;
  b.ap += eff.t_ap * up; b.anom_dmg += eff.t_anom_dmg * up;
  if (eff.t_ice_fire_cd > 0) {
    if (tb === "Ice" || tb === "Fire") b.cd += eff.t_ice_fire_cd * up;
    else if (dst.idx === 0) notes.push(`[注意] ${src.ch.n} 携带【${src.w.n}】的 +${(eff.t_ice_fire_cd * 100).toFixed(0)}% 冰/火暴伤对 ${dst.ch.n}(${dst.ch.e}) 不生效`);
  }

  if (cid === "1031") {
    const nCov = ctx.qaSwap ? ctx.qaSwap.nicoleCov : 1.0;
    b.def_shred += 0.40 * coreScale * up * nCov; if (aa && tb === "Ether") b.dmg += 0.25 * up * nCov;
  } else if (cid === "1131") {
    b.atk_flat += Math.min(1000, st.init_atk * 0.40) * coreScale * up; if (aa && tb === "Ice") b.dmg += 0.20 * up;
  } else if (cid === "1151") {
    b.atk_flat += Math.min(600, st.init_atk * 0.258 + 104) * coreScale * up;
  } else if (cid === "1211") {
    const rCov = (m === 0 && ctx.qaSwap) ? ctx.qaSwap.rinaCovM0 : 1.0;
    const basePen = Math.min(0.30, st.init_pen * 0.25 + 0.12) * coreScale;
    b.pen += Math.min(0.39, basePen * mods.tb_pen_mult) * up * rCov;
    if (potOn) { b.atk_flat += Math.min(576, st.init_pen * 800) * up * rCov; b.def_flat += Math.min(468, st.init_pen * 650) * up * rCov; }
    if (aa && tb === "Electric") b.dmg += 0.10 * up * rCov;
  } else if (cid === "1311") {
    b.atk_flat += (Math.min(1200, st.init_atk * 0.35) * coreScale + mods.tb_atk_flat) * up;
    b.dmg += (0.20 * coreScale + mods.tb_astra_dmg_add) * up; b.cd += (0.25 * coreScale + mods.tb_astra_cd_add) * up;
    if (aa && dst.idx !== src.idx) {
      const chainBonus = dst.ch.id === "1321" ? 0.08 : (["1551","1241"].includes(dst.ch.id) ? 0.05 : 0.025);
      b.extra_mult *= (1 + chainBonus * up);
    }
  } else if (cid === "1411") {
    b.atk_flat += Math.min(1200, st.init_atk * 0.40) * coreScale * up; b.dmg += 0.15 * coreScale * up;
    if (aa) {
      const am_over = Math.max(0, Math.min(100, (st.init_am + eff.c_am_flat) - 100));
      b.anom_dmg += am_over * 0.002 * mods.tb_anom_aa_mult * up;
      b.disorder_dmg += am_over * 0.002 * mods.tb_anom_aa_mult * up;
      b.buildup += am_over * 0.002 * up;
    }
  } else if (cid === "1451") {
    const cap = (900 + mods.tb_lucia_sheer_cap_add) * coreScale, rate = (7.4 + mods.tb_lucia_sheer_rate_add) * coreScale;
    if (twt === "Rupture") b.sheer += Math.min(cap, 12 + Math.floor(st.init_hp / 200) * rate) * up;
    else if (dst.idx === 0) notes.push(`[说明] 卢西娅 +${Math.round(cap)} 贯穿力仅对【命破】角色生效`);
    b.dmg += 0.20 * coreScale * up; b.hp_pct += 0.05 * up; if (aa) b.cd += 0.30 * up;
  } else if (cid === "1491") {
    b.atk_flat += (Math.min(1050, st.init_atk * 0.30) + 50) * coreScale * up; if (aa) b.stun_mult += 0.30 * up;
  } else if (cid === "1071") {
    b.atk_flat += 1000 * coreScale * up; if (aa) b.dmg += 0.25 * up;
  } else if (cid === "1121") {
    if (aa) b.cr += 0.16 * up;
  } else if (cid === "1271") {
    b.ap += 100 * coreScale * up; if (aa) b.buildup += 0.20 * up;
  } else if (cid === "1341") {
    b.hp_pct += 0.05 * up; b.atk_flat += 1000 * coreScale * up;
    if (aa) b.dmg += (0.10 + Math.min(0.30, Math.max(0, st.init_hp - 15000) / 400 * 0.01)) * up;
  } else if (cid === "1421") {
    const panRate = (mods.tb_pan_m6 ? 0.24 : 0.18) * coreScale, panCap = (mods.tb_pan_m6 ? 720 : 540) * coreScale;
    if (twt === "Rupture") b.sheer += Math.min(panCap, st.init_atk * panRate) * up;
    else if (dst.idx === 0) notes.push(`[说明] 潘引壶 +${Math.round(panCap)} 贯穿力仅对【命破】角色生效`);
    if (aa) b.dmg += 0.20 * up;
  } else if (cid === "1101") {
    if (aa) b.dmg_chain += 0.70 * up;
    if (potOn) { if (twt === "Armorer") b.lac_dmg += 0.12 * up; else b.cd += 0.35 * up; }
  } else if (cid === "1141") {
    if (tb === "Ice") b.res_shred += 0.25 * up; if (aa) b.stun_mult += 0.35 * up;
  } else if (cid === "1161") {
    if (tb === "Ice" || tb === "Fire") {
      b.res_shred += 0.15 * up;
      if (aa) {
        const c_imp = (st.init_imp + eff.c_imp_flat) * (1 + 0.20 + eff.c_imp_pct);
        b.dmg += Math.min(0.75, 0.25 + Math.max(0, c_imp - 170) / 10 * 0.05) * mods.tb_lighter_elation_mult * up;
      }
    } else if (dst.idx === 0) notes.push(`[注意] 莱特减抗与高额增伤仅对【冰/火】队友生效，${dst.ch.n} 未吃到`);
  } else if (cid === "1251") {
    b.stun_mult += 0.80 * coreScale * up;
  } else if (cid === "1351") {
    if (aa) {
      if (mods.tb_pulchra_all) b.dmg += 0.30 * up;
      else if (tHasAs) b.dmg_aftershock += 0.30 * up;
      else if (dst.idx === 0) notes.push(`[说明] 波可娜 M0~M5 仅拐【追加攻击】+30%伤（升至 M6 可扩展为全伤害类型+30%）`);
    }
  } else if (cid === "1361") {
    b.stun_mult_alltime += 0.35 * coreScale * up;
  } else if (cid === "1381") {
    if (aa && tHasAs) b.dmg_aftershock += (potOn ? 0.50 : 0.25) * up;
  } else if (cid === "1391") {
    b.cd += (0.20 + (st.init_atk >= 2800 ? Math.min(0.30, Math.floor((st.init_atk - 2800) / 100) * 0.05) : 0)) * coreScale * up;
    b.dmg += 0.11 * up;
    if (aa && (twt === "Attack" || twt === "Rupture")) {
      const ultSh = dst.ch.prof?.shares?.ult || 0.20;
      b.extra_mult *= (1 + (0.035 + 0.14 * ultSh) * up);
    }
  } else if (cid === "1481") {
    b.stun_mult += 0.30 * coreScale * up;
    if (aa) {
      b.dmg += 0.40 * up;
      if (twt === "Attack" || twt === "Rupture") {
        const ultSh = dst.ch.prof?.shares?.ult || 0.20;
        b.extra_mult *= (1 + (0.06 + 0.24 * ultSh) * up);
      }
    }
  } else if (cid === "1511") {
    b.dmg += 0.25 * coreScale * up; b.atk_flat += 50 * up; b.buildup += 0.135 * up;
    if (aa) { b.stun_mult += 0.30 * up; b.buildup += 0.15 * up; }
  } else if (cid === "1571") {
    if (aa) {
      b.dmg += 0.20 * up; b.stun_mult += 0.30 * up;
      const cb = dst.ch.id === "1321" ? 0.08 : (["1551","1241"].includes(dst.ch.id) ? 0.06 : 0.03);
      b.extra_mult *= (1 + (cb + (m >= 4 ? 0.025 : 0)) * up);
    }
  } else if (cid === "1621") {
    if (twt === "Armorer") b.lac_dmg += Math.min(0.20, st.init_cr * 0.20) * coreScale * up;
    else b.cd += Math.min(0.40, st.init_cr * 0.40) * coreScale * up;
    if (aa) { b.stun_mult += 0.30 * up; if (tb === "Wind" || ctx.teamHasContam) b.dmg += 0.08 * up; }
  } else if (cid === "1301") {
    b.atk_flat += (st.init_er >= 1.6 ? Math.min(700, 280 + ((st.init_er - 1.6) / 0.1) * 20) : 280) * coreScale * up;
  } else if (cid === "1461") {
    if (twt === "Attack") { b.atk_flat += 1000 * coreScale * up; b.cd += 0.30 * up; b.dmg += 0.25 * up; if (m >= 2) b.def_shred += 0.20 * up; }
    else if (dst.idx === 0) notes.push(`[注意] 「席德」强攻包夹拐仅对【强攻】队友生效`);
  } else if (cid === "1521") {
    if (aa) b.cd += 0.40 * up;
    b.def_shred += (0.06 + (st.init_er > 1.4 ? Math.min(0.19, (st.init_er - 1.4) / 0.12 * 0.01) : 0)) * coreScale * up;
  } else if (cid === "1561") {
    if (ctx.velinaVortexOk) b.buildup += (0.14 + (aa ? 0.07 : 0)) * up;
  } else if (cid === "1281") {
    if (aa) b.dmg += 0.18 * up;
  } else if (cid === "1331") {
    if (aa) { b.anom_dmg += 0.12 * up; b.disorder_dmg += 0.12 * up; }
  } else if (cid === "1611") {
    if (aa && twt === "Armorer") b.lac_dmg += 0.25 * up;
  }

  if (!(cid === "1451" && twt !== "Rupture")) {
    let mDmg = mods.tb_dmg || 0;
    if (cid === "1211" && m >= 6 && tb !== "Electric") mDmg -= 0.15;
    b.dmg += mDmg * up;
  }
  if (cid === "1161" && m >= 1 && tb !== "Ice" && tb !== "Fire") {
  } else if (cid === "1131" && m >= 4 && tb !== "Ice") {
  } else if (cid === "1521" && m >= 1 && tb !== "Electric") {
    b.def_shred += (mods.tb_def_shred || 0) * up;
  } else {
    b.res_shred += (mods.tb_res_shred || 0) * up;
    b.def_shred += (mods.tb_def_shred || 0) * up;
  }
  if (cid !== "1461" && cid !== "1311") b.atk_flat += (mods.tb_atk_flat || 0) * up;
  b.atk_pct += (mods.tb_atk_pct || 0) * up; b.cd += (mods.tb_cd || 0) * up;
  b.cr += (mods.tb_cr || 0) * up * (cid === "1031" && ctx.qaSwap ? ctx.qaSwap.nicoleCov : 1.0);
  b.pen += (mods.tb_pen || 0) * up;
  if (cid === "1361") b.stun_mult_alltime += (mods.tb_stun_mult || 0) * up;
  else b.stun_mult += (mods.tb_stun_mult || 0) * up;
  b.anom_dmg += (mods.tb_anom_dmg || 0) * up; b.buildup += (mods.tb_buildup || 0) * up;
  if (twt === "Rupture") b.sheer += (mods.tb_sheer || 0) * up;
  if (cid === "1461") {
    if (twt === "Attack") b.extra_mult *= (1 + ((mods.tb_extra_mult || 1) - 1) * up);
  } else {
    b.extra_mult *= (1 + ((mods.tb_extra_mult || 1) - 1) * up);
  }
  if (eff.t_decibel) b.extra_mult *= (1 + 0.035 * eff.scale * up);
  return b;
}

// ============================================================================
// Slot Damage Evaluator (4 Major Damage Systems + Swap-Cancel Share & Per-Element Res)
// ============================================================================

export function getEffectiveSlotShares(ch, slotCfg, ctx, memberIdx = 0) {
  const baseSh = { basic: 0.35, dash: 0.10, ex: 0.25, chain: 0.10, ult: 0.20, aftershock: 0, ...(ch.prof?.shares || {}) };
  let sh = { ...baseSh };

  // Timeline direct override
  if (ctx.qaSwap?.timelineSharesByCid && ctx.qaSwap.timelineSharesByCid[ch.id]) {
    sh = { ...sh, ...ctx.qaSwap.timelineSharesByCid[ch.id] };
  }
  // User manual per-slot custom shares override (highest priority!)
  if (slotCfg?.customSharesEnabled && slotCfg?.customShares) {
    const cs = slotCfg.customShares;
    const sumMain = Math.max(0.01, (Number(cs.basic) || 0) + (Number(cs.dash) || 0) + (Number(cs.ex) || 0) + (Number(cs.chain) || 0) + (Number(cs.ult) || 0));
    sh.basic = (Number(cs.basic) || 0) / sumMain;
    sh.dash = (Number(cs.dash) || 0) / sumMain;
    sh.ex = (Number(cs.ex) || 0) / sumMain;
    sh.chain = (Number(cs.chain) || 0) / sumMain;
    sh.ult = (Number(cs.ult) || 0) / sumMain;
    if (cs.aftershock !== undefined) sh.aftershock = Math.max(0, Math.min(1.0, Number(cs.aftershock) / 100.0));
    return sh;
  }

  // Apply Swap-Cancel Chain Tech & Decibel Ult dynamic redistribution
  if (ctx.qaSwap && !ctx.qaSwap.timelineSharesByCid) {
    const cMult = ctx.qaSwap.chainShareMult?.[memberIdx] ?? 1.0;
    const uMult = ctx.qaSwap.ultShareMult?.[memberIdx] ?? 1.0;
    if (Math.abs(cMult - 1.0) > 0.02 || Math.abs(uMult - 1.0) > 0.02) {
      const bVal = sh.basic || 0, dVal = sh.dash || 0, eVal = sh.ex || 0;
      const cVal = (sh.chain || 0) * cMult;
      const uVal = (sh.ult || 0) * uMult;
      const tot = Math.max(0.01, bVal + dVal + eVal + cVal + uVal);
      sh.basic = bVal / tot; sh.dash = dVal / tot; sh.ex = eVal / tot; sh.chain = cVal / tot; sh.ult = uVal / tot;
    }
  }
  return sh;
}

export function getEffectiveAnomSplit(ch, slotCfg) {
  if (!ch.prof?.anom_split) return null;
  if (slotCfg?.customAnomSplitEnabled && slotCfg?.customAnomSplit) {
    const cas = slotCfg.customAnomSplit;
    const s = Math.max(0.01, (Number(cas.direct) || 0) + (Number(cas.anom) || 0) + (Number(cas.disorder) || 0) + (Number(cas.abloom) || 0));
    return {
      direct: (Number(cas.direct) || 0) / s,
      anom: (Number(cas.anom) || 0) / s,
      disorder: (Number(cas.disorder) || 0) / s,
      abloom: (Number(cas.abloom) || 0) / s
    };
  }
  return ch.prof.anom_split;
}

export function evalSlotDamage(ch, m, w, refLevel, fourPc, twoPc, d4, d5, d6, sub, aaActive, tbInput, env, ctx, slotCfg = null, memberIdx = 0) {
  const mods = getMindscapeMods(ch, m, slotCfg);
  const st = evalMemberSheet(ch, m, w, refLevel, fourPc, twoPc, d4, d5, d6, sub, mods, ctx, slotCfg);
  const { eff, d2a, d2b, f4, init_atk, init_hp, init_def, init_cr, init_cd, init_pen, init_ap, init_am, init_er, init_imp, s_pen_flat, m_elem, coreBuffScale } = st;
  const prof = ch.prof || {}, cid = ch.id, wt = ch.wt;
  const sh = getEffectiveSlotShares(ch, slotCfg, ctx, memberIdx);
  const potOn = slotCfg?.potOverride === "on" ? true : (slotCfg?.potOverride === "off" ? false : (ctx.potAwakening !== false));
  const stage = env.stageBuffs || STAGE_BUFFS.none;

  // Merge per-slot custom extra combat buffs if configured
  const tb = { ...tbInput };
  if (slotCfg?.slotExtra) {
    const se = slotCfg.slotExtra;
    tb.atk_pct += (Number(se.atk_pct) || 0) / 100.0;
    tb.atk_flat += Number(se.atk_flat) || 0;
    tb.hp_pct += (Number(se.hp_pct) || 0) / 100.0;
    tb.def_pct += (Number(se.def_pct) || 0) / 100.0;
    tb.sheer += Number(se.sheer) || 0;
    tb.cr += (Number(se.cr) || 0) / 100.0;
    tb.cd += (Number(se.cd) || 0) / 100.0;
    tb.dmg += (Number(se.dmg) || 0) / 100.0;
    tb.def_shred += (Number(se.def_shred) || 0) / 100.0;
    tb.pen += (Number(se.pen) || 0) / 100.0;
    tb.res_shred += (Number(se.res_shred) || 0) / 100.0;
    tb.ap += Number(se.ap) || 0;
    tb.anom_dmg += (Number(se.anom_dmg) || 0) / 100.0;
    tb.lac_dmg += (Number(se.lac_dmg) || 0) / 100.0;
    if (se.final_mult && Number(se.final_mult) !== 0) {
      tb.extra_mult *= Math.max(0.1, 1.0 + Number(se.final_mult) / 100.0);
    }
  }

  const sShare = (slotCfg?.stunShareOverride !== null && slotCfg?.stunShareOverride !== undefined && slotCfg?.stunShareOverride !== "")
    ? Math.max(0, Math.min(1, Number(slotCfg.stunShareOverride)))
    : (env.stunShare !== null && env.stunShare !== undefined ? env.stunShare : (ctx.effStunShare[ch.id] ?? (prof.stun_share || 0.50)));

  let aa_cr = 0, aa_cd = 0, aa_catk = 0, aa_catk_flat = 0, aa_dmg = 0, aa_ex = 0, aa_ult = 0, aa_anom = 0, aa_lac = 0, aa_res_ign = 0, aa_buildup = 0, aa_proc = 1.0;

  // Custom Character Additional Ability support
  if (ch.customAA && ch.customAA.enabled) {
    if (aaActive) {
      const caa = ch.customAA;
      aa_cr += caa.cr || 0; aa_cd += caa.cd || 0; aa_catk += caa.catk || 0; aa_catk_flat += caa.catk_flat || 0;
      aa_dmg += caa.dmg || 0; aa_ex += caa.ex || 0; aa_ult += caa.ult || 0; aa_anom += caa.anom || 0;
      aa_lac += caa.lac || 0; aa_res_ign += caa.res_ign || 0; aa_buildup += caa.buildup || 0;
      if (caa.proc_mult) aa_proc *= caa.proc_mult;
    }
  }

  if (!ch.customAA?.replaceBuiltin) {
    if (cid === "1021") { if (potOn) aa_cd += 0.60; if (aaActive) aa_dmg += 0.35; }
    else if (cid === "1041") { if (aaActive) { aa_dmg += 0.10 + sShare * 0.225; if (potOn) aa_cd += 0.48; } }
    else if (cid === "1061") { if (aaActive) aa_dmg += sShare * 0.35; }
    else if (cid === "1081") { if (aaActive) aa_ult += 0.85; }
    else if (cid === "1111") { if (aaActive) aa_proc *= 1.10; }
    else if (cid === "1191") { if (aaActive) { aa_dmg += 0.30; if (potOn) { aa_cd += 0.48; aa_res_ign += 0.10; } } }
    else if (cid === "1201") { if (aaActive) aa_dmg += 0.40; if (potOn) { aa_catk += 0.12; aa_res_ign += 0.12; } }
    else if (cid === "1241") { if (aaActive) aa_cr += 0.30; }
    else if (cid === "1291") { aa_catk_flat += (ctx.stunCount >= 2 ? 900 : (ctx.stunCount === 1 ? 300 : 0)) * coreBuffScale; if (aaActive) aa_dmg += 0.35; }
    else if (cid === "1321") { if (aaActive) aa_dmg += 0.24; }
    else if (cid === "1381") { if (aaActive) { aa_cr += 0.10; aa_dmg += (potOn ? 0.35 : 0.18); } }
    else if (cid === "1431") { if (aaActive && ctx.mateHasVeil[cid]) aa_proc *= 1.10; }
    else if (cid === "1461") { if (ctx.attackCount >= 2) { aa_catk_flat += 1000 * coreBuffScale; aa_cd += 0.30; aa_dmg += 0.25; } if (aaActive) { aa_dmg += 0.22; aa_res_ign += 0.18; } }
    else if (cid === "1521") { if (aaActive) aa_cd += 0.50; }
    else if (cid === "1551") { if (aaActive) aa_cd += 0.40; }
    else if (cid === "1591") { if (aaActive) { aa_catk_flat += 840; if (ctx.teamHasContam) aa_dmg += 0.15; } }
    else if (cid === "1631") { if (ctx.windCount >= 2) aa_dmg += 0.30 * coreBuffScale; if (aaActive) aa_catk_flat += Math.min(1.0, init_cr) * 100.0 * 8.5; }
    else if (cid === "1091") { if (aaActive) { aa_dmg += 0.33; aa_res_ign += (ctx.canDisorder ? 0.22 : 0.08); } }
    else if (cid === "1171") { if (aaActive) aa_buildup += 0.45; }
    else if (cid === "1181") { if (potOn) aa_dmg += 0.30; if (aaActive) aa_anom += 0.36; }
    else if (cid === "1221") { if (aaActive) aa_buildup += 0.35; }
    else if (cid === "1261") { if (aaActive) aa_buildup += 0.30; }
    else if (cid === "1281") { if (aaActive) aa_dmg += 0.18; }
    else if (cid === "1331") { if (aaActive) aa_anom += 0.12; }
    else if (cid === "1501") { if (aaActive && ctx.teamHasVeil) aa_proc *= 1.08; }
    else if (cid === "1541") { if (aaActive) aa_buildup += 0.30; }
    else if (cid === "1561") { if (aaActive) { aa_anom += 0.10; aa_buildup += 0.15; aa_proc *= 1.06; } }
    else if (cid === "1051") { if (aaActive) { aa_cd += 0.30; aa_proc *= 1.08; } }
    else if (cid === "1371") { if (aaActive) { aa_cd += 0.40; aa_ex += sShare * 0.30; } }
    else if (cid === "1441") { if (aaActive) aa_proc *= 1.06; }
    else if (cid === "1471") { if (aaActive) aa_dmg += 0.15; }
    else if (cid === "1531") { if (aaActive) aa_dmg += 0.40; }
    else if (cid === "1611") { if (aaActive) { aa_lac += 0.25; if (ctx.teamHasContam) aa_proc *= 1.05; } }
    else if (cid === "1251") { if (aaActive && init_imp > 120) aa_catk_flat += Math.min(600, (init_imp - 120) * 6.0); }
    else if (cid === "1481") { if (aaActive) { aa_dmg += 0.40; aa_proc *= (ctx.hasAtkOrRup ? 1.18 : 1.0); } }
    else if (cid === "1571") { if (aaActive) { aa_catk_flat += 870; aa_dmg += 0.20; } }
    else if (cid === "1621") { if (aaActive) aa_dmg += 0.80; }
    else if (cid === "1121") { if (aaActive) aa_cr += 0.16; }
    else if (cid === "1341") { if (aaActive) aa_dmg += 0.10 + Math.min(0.30, Math.max(0, init_hp - 15000) / 400 * 0.01); }
    else if (cid === "1421") { if (aaActive) aa_dmg += 0.20; }
  }

  const c_atk_pct = (prof.self_catk || 0) * coreBuffScale + aa_catk + f4.c_atk + eff.c_atk + tb.atk_pct + (stage.atk_pct || 0);
  let c_atk_flat = (prof.self_catk_flat || 0) * coreBuffScale + aa_catk_flat + (mods.c_atk_flat || 0) + tb.atk_flat;
  if (cid === "1301") c_atk_flat += (init_er >= 1.6 ? Math.min(700, 280 + ((init_er - 1.6) / 0.1) * 20) : 280) * coreBuffScale;

  const combat_atk = init_atk * (1 + c_atk_pct) + c_atk_flat;
  const combat_hp = init_hp * (1 + tb.hp_pct);
  const combat_def = init_def * (1 + eff.c_def + tb.def_pct + (stage.def_pct || 0)) + (wt === "Armorer" ? 250.0 * coreBuffScale : 0.0) + tb.def_flat;

  const c_cr = init_cr + (prof.self_cr || 0) * coreBuffScale + aa_cr + f4.c_cr + eff.c_cr + tb.cr + (stage.cr || 0);
  let c_cd = init_cd + (prof.self_cd || 0) * coreBuffScale + aa_cd + f4.c_cd + eff.c_cd + tb.cd + (stage.cd || 0);
  if (cid === "1571" && init_cr > 0.50) c_cd += Math.min(0.85, (init_cr - 0.50) * 1.7) * coreBuffScale;
  if (cid === "1321" && aaActive && c_cr >= 0.80) aa_proc *= 1.12;

  let c_ap = init_ap + (prof.self_ap || 0) * coreBuffScale + f4.c_ap + eff.c_ap + tb.ap + (stage.ap || 0);
  if (cid === "1401" && aaActive && init_am > 140) c_ap += (init_am - 140) * 1.6;
  if (cid === "1541" && init_am > 150) c_ap += (init_am - 150) * 1.5 * coreBuffScale;

  const c_am_extra = (cid === "1561" && init_er > 1.2) ? Math.min(84, (init_er - 1.2) * 50) * coreBuffScale : 0;
  const disorder_extra = ((w.id === "14122" && c_ap < 375) ? 0 : eff.dmg_disorder) + f4.dmg_disorder + tb.disorder_dmg;
  let combat_am = init_am + eff.c_am_flat + c_am_extra;
  let burn_pot_dmg = 0, vel_pot_dmg = 0;
  if (cid === "1171" && potOn && init_er >= 1.8) { combat_am += Math.min(25, ((init_er - 1.8) / 0.1) * 2.5); burn_pot_dmg = Math.min(0.20, ((init_er - 1.8) / 0.1) * 0.02); }
  if (cid === "1561" && init_er > 1.2) vel_pot_dmg = Math.min(0.35, (init_er - 1.2) * 0.21) * coreBuffScale;
  const eff_er = (init_er + eff.c_er_flat) * (1 + eff.c_er_rate);

  const asDmgAdd = prof.has_aftershock ? tb.dmg_aftershock : 0;
  const chainDmgAdd = (sh.chain || 0) * tb.dmg_chain;
  const base_dmg_bonus = d2a.dmg_elem + d2b.dmg_elem + f4.dmg_elem + f4.dmg_all + m_elem +
    (prof.self_dmg || 0) * coreBuffScale + (prof.self_elem || 0) * coreBuffScale + aa_dmg + eff.dmg_all + burn_pot_dmg + vel_pot_dmg +
    tb.dmg + asDmgAdd + chainDmgAdd + (stage.dmg || 0);

  let cissia_def_ign = 0;
  if (cid === "1521") cissia_def_ign = (0.06 + (init_er > 1.4 ? Math.min(0.19, (init_er - 1.4) / 0.12 * 0.01) : 0)) * coreBuffScale;
  const asDefIgn = prof.has_aftershock ? tb.def_ign_aftershock : 0;
  const totalPen = Math.min(1.0, init_pen + tb.pen);
  const baseShred = tb.def_shred + (stage.def_shred || 0) + (prof.self_def_ign || 0) * coreBuffScale + cissia_def_ign + asDefIgn + eff.def_ign;

  const defLvFactor = calcDefLevelFactor(slotCfg?.agentLv ?? 60);
  const anomLvMult = calcAnomLevelMult(slotCfg?.agentLv ?? 60);
  const miasmaMult = env.miasmaFactor !== undefined ? Math.max(0.2, Math.min(1.0, Number(env.miasmaFactor))) : 1.0;

  const calcDefMult = (extraShred = 0) => {
    const shred = Math.min(1.0, baseShred + extraShred);
    const effDef = Math.max(0, (env.enemyDef ?? 953) * (1 - shred) * (1 - totalPen) - s_pen_flat);
    return defLvFactor / (defLvFactor + effDef);
  };

  // Independent per-element enemy resistance!
  const enemyElemRes = (env.elemResMap && env.elemResMap[ch.eb] !== undefined)
    ? Number(env.elemResMap[ch.eb])
    : (env.enemyRes ?? 0);
  const totalResIgn = (prof.self_res_ign || 0) * coreBuffScale + aa_res_ign + eff.res_ign + tb.res_shred + (stage.res_shred || 0);
  const calcResMult = (extraResIgn = 0) => Math.max(0.2, 1.0 - enemyElemRes + totalResIgn + extraResIgn);

  let stunMult;
  if (prof.veil_vuln) {
    const baseV = mods.stun_mult_override || 2.05;
    stunMult = baseV + tb.stun_mult_alltime + sShare * (tb.stun_mult + (stage.stun_mult || 0));
  } else {
    const inStunVal = (env.stunMultBase ?? 1.50) + (prof.self_stun_mult_add || 0) + tb.stun_mult + tb.stun_mult_alltime + (stage.stun_mult || 0);
    const outStunVal = 1.0 + tb.stun_mult_alltime;
    stunMult = sShare * inStunVal + (1 - sShare) * outStunVal;
  }

  let rawDmg = 0;
  let breakdown: any = {};
  const subParts: Record<string, number> = {};
  const anomSplit = getEffectiveAnomSplit(ch, slotCfg);

  if (wt === "Rupture") {
    const sheer = Math.floor(0.1 * combat_hp) + Math.floor(0.3 * combat_atk) + (prof.self_sheer_flat || 0) * coreBuffScale + eff.c_sheer + tb.sheer;
    const critM = 1.0 + Math.min(1.0, Math.max(0, c_cr)) * c_cd;
    const resM = calcResMult(0);
    const dmgM = (1.0 + base_dmg_bonus + (sh.basic || 0) * (eff.dmg_basic + d2a.dmg_basic + d2b.dmg_basic + f4.dmg_basic) + (sh.ex || 0) * (eff.dmg_ex + f4.dmg_ex + aa_ex) + (sh.ult || 0) * (eff.dmg_ult + f4.dmg_ult + aa_ult)) * (1.0 + f4.dmg_sheer + (stage.sheer_dmg || 0));
    rawDmg = sheer * critM * dmgM * resM * stunMult * mods.skill_lv_mult * mods.proc_mult * aa_proc;
    subParts.sheer = rawDmg;
    breakdown = { formulaType: "命破·贯穿直伤", baseLabel: "贯穿力", baseVal: sheer, combat_atk, combat_hp, critM, dmgM, defM: 1.0, resM, stunMult, sShare, c_cr, c_cd, totalPen, shred: 1.0, enemyElemRes, subParts };
  } else if (wt === "Armorer") {
    const lacDmg = ch.scd + (prof.self_lac_dmg || 0) * coreBuffScale + aa_lac + tb.lac_dmg + (stage.lac_dmg || 0);
    const cr1 = Math.min(1.0, Math.max(0, c_cr)), cr2 = Math.max(0, Math.min(1.0, c_cr - 1.0));
    const critM = (1 - cr1) + cr1 * (1 - cr2) * (1 + lacDmg) + cr1 * cr2 * Math.pow(1 + lacDmg, 2);
    const defM = calcDefMult(0), resM = calcResMult(0);
    const dmgM = (1 + base_dmg_bonus + (sh.basic || 0) * (eff.dmg_basic + d2a.dmg_basic + d2b.dmg_basic + f4.dmg_basic)) * (1 + eff.dmg_sharp_mult) * miasmaMult;
    rawDmg = combat_def * critM * dmgM * defM * resM * stunMult * mods.skill_lv_mult * mods.proc_mult * aa_proc;
    subParts.sharp = rawDmg;
    breakdown = { formulaType: "锋御·锐利二次撕裂", baseLabel: "局内防御", baseVal: combat_def, combat_def, critM, dmgM, defM, resM, stunMult, sShare, c_cr, c_cd: lacDmg, cr2, totalPen, shred: Math.min(1, baseShred), enemyElemRes, subParts };
  } else if (anomSplit) {
    const sp = anomSplit;
    const critM = 1.0 + Math.min(1.0, Math.max(0, c_cr)) * c_cd;
    const defM = calcDefMult(0), resM = calcResMult(0);
    const directDmgM = (1.0 + base_dmg_bonus + (sh.basic || 0) * (eff.dmg_basic + d2a.dmg_basic + d2b.dmg_basic + f4.dmg_basic) + (sh.dash || 0) * (eff.dmg_dash + d2a.dmg_dash + d2b.dmg_dash + f4.dmg_dash) + (sh.ex || 0) * (eff.dmg_ex + f4.dmg_ex + aa_ex) + (sh.ult || 0) * (eff.dmg_ult + f4.dmg_ult + aa_ult)) * miasmaMult;
    const directVal = combat_atk * critM * directDmgM * defM * resM * stunMult;
    const freeBuildup = ctx.freedomBluesElems.has(ch.eb) ? 0.20 : 0;
    const bbBuildup = ctx.bangboo?.elemBuildup?.[ch.eb] || 0;
    const buildupBonus = eff.buildup + aa_buildup + tb.buildup + freeBuildup + bbBuildup + (prof.cr_to_buildup ? Math.min(0.80, Math.min(1.0, Math.max(0, c_cr))) : 0);
    const anomResScale = Math.max(0.5, Number(env.anomThresholdScale) || 1.0);
    const amFactor = Math.pow(combat_am / (130.0 * anomResScale), 0.55) * Math.pow(1 + Math.max(0, buildupBonus), 0.45);
    const anomDmgM = (1.0 + base_dmg_bonus + f4.dmg_anom + (prof.self_anom || 0) + aa_anom + tb.anom_dmg + eff.dmg_anom + (stage.anom_dmg || 0)) * miasmaMult;

    let ownAnomCrit = 1.0;
    if (prof.jane_crit) {
      const jcr = Math.min(1.0, 0.40 + c_ap * 0.0016);
      const jcd = (potOn ? 0.80 : 0.50) + (mods.anom_crit_cd_add || 0);
      ownAnomCrit = 1.0 + jcr * jcd;
    } else if (cid === "1501" && (mods.anom_crit_cr_add || 0) > 0) {
      const acr = Math.min(1.0, 0.25 + Math.max(0, init_am - 100) * 0.005);
      ownAnomCrit = 1.0 + acr * 0.25;
    }
    const phxCritM = tb.phoenix_crit ? (1.0 + tb.phoenix_crit.cr * tb.phoenix_crit.cd) : 1.0;
    const anomCrit = Math.max(ownAnomCrit, phxCritM);
    const refringeM = 1.0 + (tb.refringe_mult || 0);

    const swapDisBonus = ctx.qaSwap?.disorderBonusSec || 0;
    const effDisSec = Math.min(13, Math.max(0, (env.disorderSec ?? 7) + ctx.anomDurBonus + swapDisBonus));
    const disDurM = 0.72 + 0.04 * effDisSec;
    const canSelfPolDis = (cid === "1221" || cid === "1401" || cid === "1511" || ctx.hasNangongPol);
    const disAvailM = (ctx.canDisorder || canSelfPolDis) ? 1.0 : 0.15;

    let anomMechM = 1.0;
    if (cid === "1561") anomMechM = ctx.velinaVortexOk ? (1.0 + eff.dmg_vortex) : 0.42;
    else if (cid === "1581") {
      const lumApScale = 1.0 + Math.max(0, c_ap - 300) * 0.0006 + (ctx.anomCount >= 3 ? 0.10 : 0);
      anomMechM = (ctx.activeCount >= 2 ? lumApScale : 0.55) * (mods.rem_lum_mult || 1);
    }

    const anomVal = combat_atk * (c_ap / 100) * anomLvMult * anomDmgM * defM * resM * stunMult * anomCrit * refringeM * amFactor * 0.45 * anomMechM;
    const disDmgM = anomDmgM + disorder_extra * miasmaMult;
    const disVal = combat_atk * (c_ap / 100) * anomLvMult * disDmgM * defM * resM * stunMult * anomCrit * refringeM * amFactor * 0.45 * disDurM * disAvailM * (mods.yanagi_pol_mult || 1) * (ctx.hasNangongPol ? 1.14 : 1.0);
    const abDefM = calcDefMult(tb.def_ign_abloom || 0);
    const abMult = 1 + eff.dmg_abloom + (cid === "1541" ? Math.max(0, init_am - 150) * 0.0035 : 0);
    const abScale = cid === "1501" ? (init_am / 150) : 1.0;
    const abFac = Math.pow(1 + Math.max(0, buildupBonus), 0.25);
    const abModMult = cid === "1641" ? (mods.phx_ab_mult || 1) : 1.0;
    const abAvailM = (cid === "1561" && !ctx.velinaVortexOk) ? 0.65 : 1.0;
    const abVal = combat_atk * (c_ap / 100) * anomLvMult * anomDmgM * abDefM * resM * stunMult * anomCrit * refringeM * abMult * abScale * abFac * 0.45 * abModMult * abAvailM;

    const pDirect = (sp.direct || 0) * directVal * mods.skill_lv_mult * mods.proc_mult * aa_proc;
    const pAnom   = (sp.anom || 0) * anomVal * mods.proc_mult * aa_proc;
    const pDis    = (sp.disorder || 0) * disVal * mods.proc_mult * aa_proc;
    const pAb     = (sp.abloom || 0) * abVal * mods.proc_mult * aa_proc;
    rawDmg = pDirect + pAnom + pDis + pAb;
    subParts.direct = pDirect;
    if (pAnom > 0) subParts[cid === "1581" ? "luminize" : (cid === "1561" ? "vortex" : "anom")] = pAnom;
    if (pDis > 0) subParts.disorder = pDis;
    if (pAb > 0) subParts.abloom = pAb;
    breakdown = {
      formulaType: cid === "1581" ? "异常·流明耀化" : (cid === "1561" ? "异常·风化涡流异放" : "异常·紊乱/异放混合"),
      baseLabel: "局内攻击", baseVal: combat_atk, combat_atk, c_ap, combat_am, init_er, eff_er,
      critM, anomCrit, refringeM, dmgM: anomDmgM, defM, abDefM, resM, stunMult, sShare,
      c_cr, c_cd, totalPen, shred: Math.min(1, baseShred), enemyElemRes, effDisSec, subParts
    };
  } else {
    let critM = 1.0 + Math.min(1.0, Math.max(0, c_cr)) * c_cd;
    if (cid === "1481" && aaActive) critM = (1 - (sh.ex || 0)) * critM + (sh.ex || 0) * (1 + Math.min(1, Math.max(0, c_cr)) * (c_cd + 0.50));
    const defM = calcDefMult(((sh.basic || 0) + (sh.ult || 0)) * eff.def_ign_bu);
    const resM = calcResMult(((sh.chain || 0) + (sh.ult || 0)) * eff.res_ign_cu);
    const dmgM = (1.0 + base_dmg_bonus + (sh.basic || 0) * (eff.dmg_basic + d2a.dmg_basic + d2b.dmg_basic + f4.dmg_basic) + (sh.dash || 0) * (eff.dmg_dash + d2a.dmg_dash + d2b.dmg_dash + f4.dmg_dash) + (sh.ex || 0) * (eff.dmg_ex + f4.dmg_ex + aa_ex) + (sh.ult || 0) * (eff.dmg_ult + f4.dmg_ult + aa_ult)) * miasmaMult;
    rawDmg = combat_atk * critM * dmgM * defM * resM * stunMult * mods.skill_lv_mult * mods.proc_mult * aa_proc;
    if (cid === "1301" || cid === "1521") rawDmg *= Math.pow(Math.min(4.0, Math.max(1.8, eff_er)) / 2.6, 0.14);
    if (cid === "1031") rawDmg *= Math.pow(Math.min(4.8, Math.max(1.4, eff_er)) / 2.80, 0.28);
    if (w.id === "14001") rawDmg *= 1.02;
    if (w.id === "13112") rawDmg += combat_def * 0.35 * eff.scale;
    if (mods.dmg_chain > 0) rawDmg *= (1 + (sh.chain || 0) * mods.dmg_chain / 2.2);
    subParts.direct = rawDmg;

    if (cid === "1031") {
      const freeBuildup = ctx.freedomBluesElems.has(ch.eb) ? 0.20 : 0;
      const bbBuildup = ctx.bangboo?.elemBuildup?.[ch.eb] || 0;
      const buildupBonus = eff.buildup + tb.buildup + freeBuildup + bbBuildup;
      const erCastFactor = Math.pow(Math.min(4.8, Math.max(1.4, eff_er)) / 2.80, 0.22);
      const amFactor = Math.pow(combat_am / 95.0, 0.55) * Math.pow(1 + Math.max(0, buildupBonus), 0.45) * erCastFactor;
      const anomDmgM = (1.0 + base_dmg_bonus + f4.dmg_anom + tb.anom_dmg + eff.dmg_anom + (stage.anom_dmg || 0)) * miasmaMult;
      const phxCritM = tb.phoenix_crit ? (1.0 + tb.phoenix_crit.cr * tb.phoenix_crit.cd) : 1.0;
      const hasAnomMate = ctx.anomCount >= 1 || ctx.freedomBluesElems.size >= 1;
      const disRate = !ctx.canDisorder ? 0 : (hasAnomMate ? 0.28 : 0.04);
      const disBonus = disRate * (anomDmgM + disorder_extra) / Math.max(1, anomDmgM);
      const corrDmg = combat_atk * (c_ap / 100) * anomLvMult * anomDmgM * defM * resM * stunMult * phxCritM * amFactor * (0.14 + disBonus);
      rawDmg += corrDmg;
      subParts.corruption = corrDmg;
    }
    breakdown = {
      formulaType: cid === "1031" ? ((ctx.canDisorder && (ctx.anomCount >= 1 || ctx.freedomBluesElems.size >= 1)) ? "直伤+侵蚀紊乱双修" : "直伤+以太侵蚀") : "直伤·双暴乘区",
      baseLabel: "局内攻击", baseVal: combat_atk, combat_atk, c_ap, combat_am, init_er, eff_er,
      critM, dmgM, defM, resM, stunMult, sShare, c_cr, c_cd, totalPen, shred: Math.min(1, baseShred), enemyElemRes, subParts
    };
  }

  const mvMult = (ch.mvScale || 1.0) * (ctx.slotMvMult?.[cid] ?? 1.0) * tb.extra_mult;
  rawDmg *= mvMult;
  for (const k of Object.keys(subParts)) subParts[k] *= mvMult;
  breakdown.mvScale = mvMult;
  breakdown.shares = sh;
  return { rawDmg, breakdown, st };
}

// ============================================================================
// Disc Candidate Search, Substat Allocations & Auto Rotation Weights
// ============================================================================

export function getDiscCandidates(ch) {
  const wt = ch.wt, cid = ch.id;
  if (wt === "Armorer") return [["CR","DEF%"], ["ELEM","PEN","DEF%"], ["DEF%"]];
  if (wt === "Rupture") return [["CR","CD","HP%"], ["ELEM","HP%"], ["HP%"]];
  if (cid === "1091") return [["CR","CD","AP"], ["ELEM","PEN","ATK%"], ["ATK%","AM"]];
  if (ch.prof?.anom_split && wt !== "Support" && wt !== "Defense" && wt !== "Stun") {
    return [cid === "1581" ? ["AP","ATK%"] : ["AP"], ["ELEM","PEN","ATK%"], cid === "1561" ? ["ER","AM","ATK%"] : (cid === "1581" ? ["AM","ATK%","ER"] : ["AM","ATK%"])];
  }
  if (wt === "Support" || wt === "Defense") {
    if (cid === "1451" || cid === "1341") return [["HP%","CR"], ["HP%","ELEM"], ["HP%","ER"]];
    if (cid === "1411") return [["ATK%","AP"], ["ATK%","ELEM"], ["AM","ER","ATK%"]];
    if (cid === "1211") return [["CR","ATK%"], ["PEN"], ["ER"]];
    if (cid === "1031") return [["CR","CD","AP","ATK%"], ["ELEM","PEN","ATK%"], ["ER","AM"]];
    if (cid === "1131" || cid === "1151") return [["CR","CD","ATK%"], ["ELEM","ATK%"], ["ER","ATK%"]];
    if (["1311","1491","1421"].includes(cid)) return [["ATK%","CR"], ["ATK%","ELEM"], ["ER","ATK%"]];
    return [["CR","ATK%"], ["ELEM","ATK%"], ["ER"]];
  }
  if (wt === "Stun") {
    if (cid === "1511") return [["AP","CR"], ["ELEM","ATK%"], ["AM","IMP"]];
    if (cid === "1621") return [["CR"], ["ELEM","PEN"], ["ER","IMP"]];
    if (cid === "1391") return [["CR","ATK%"], ["ATK%","ELEM"], ["IMP","ATK%"]];
    return [["CR","CD"], ["ELEM","PEN","ATK%"], ["IMP","ER"]];
  }
  return [["CR","CD","ATK%"], ["ELEM","PEN","ATK%"], (cid === "1301" || cid === "1521") ? ["ER","ATK%"] : ["ATK%"]];
}

export function getSubAllocs(ch, rollBudget = 28, maxSingleCap = 18) {
  const b = Math.max(0, Math.min(45, Math.round(rollBudget)));
  const cap = Math.max(4, Math.min(36, Math.round(maxSingleCap || 18)));
  const half = Math.min(cap, Math.max(4, Math.ceil(b * 0.52)));
  const highCap = Math.min(Math.max(cap, 18), Math.max(half, Math.ceil(b * 0.65)));
  const out = [];
  if (ch.wt === "Armorer") {
    for (let cr = 0; cr <= half; cr += 3) for (let cd = 0; cd <= half; cd += 3) {
      const d = b - cr - cd; if (d >= 0 && d <= half + 4) out.push({ CR: cr, CD: cd, "DEF%": d });
    }
    out.sort((a, x) => Math.abs(a.CR - a.CD) - Math.abs(x.CR - x.CD));
  } else if (ch.wt === "Rupture") {
    for (let cr = 0; cr <= half; cr += 3) for (let cd = 0; cd <= half; cd += 3) {
      const h = b - cr - cd; if (h >= 0 && h <= half + 4) out.push({ CR: cr, CD: cd, "HP%": h });
    }
    out.sort((a, x) => Math.abs(a.CR - a.CD) - Math.abs(x.CR - x.CD));
  } else if (ch.id === "1451" || ch.id === "1341") {
    for (const hp of [Math.min(cap, highCap), Math.min(half, b), Math.max(0, Math.min(half, b) - 4)]) {
      const rem = Math.max(0, b - hp);
      out.push({ "HP%": hp, CR: Math.min(cap, Math.ceil(rem / 2)), CD: Math.floor(rem / 2) });
    }
  } else if (ch.wt === "Support" && ["1311","1491","1131","1411","1421"].includes(ch.id)) {
    for (const atk of [Math.min(cap, highCap), Math.min(half, b), Math.max(0, Math.min(half, b) - 4)]) {
      const rem = Math.max(0, b - atk);
      out.push({ "ATK%": atk, CR: Math.min(cap, Math.ceil(rem / 2)), CD: Math.floor(rem / 2) });
    }
  } else if (ch.prof?.anom_split && ch.id !== "1091" && ch.wt !== "Stun") {
    for (const ap of [Math.min(half, b), Math.max(0, Math.min(half, b) - 3), Math.max(0, Math.min(half, b) - 6)]) {
      const atk = Math.min(half, b - ap), rem = Math.max(0, b - ap - atk);
      out.push({ AP: ap, "ATK%": atk, CR: Math.floor(rem / 2), CD: rem - Math.floor(rem / 2) });
    }
  } else {
    for (let cr = 0; cr <= half; cr += 3) for (let cd = 0; cd <= half; cd += 3) {
      const atk = b - cr - cd; if (atk >= 0 && atk <= half + 4) out.push({ CR: cr, CD: cd, "ATK%": atk });
    }
    out.sort((a, x) => Math.abs(a.CR - a.CD) - Math.abs(x.CR - x.CD));
    if (ch.wt === "Stun") {
      for (const cr of [Math.min(cap, b), Math.min(14, b), Math.min(11, b)]) {
        const rem = Math.max(0, b - cr);
        if (ch.id === "1511") out.unshift({ CR: cr, AP: Math.min(cap, Math.min(14, rem)), "ATK%": Math.max(0, rem - 14) });
        else out.push({ CR: cr, CD: Math.floor(rem * 0.5), "ATK%": rem - Math.floor(rem * 0.5) });
      }
      if (ch.id === "1511") {
        const ap = Math.min(half, b), atk = Math.min(half, b - ap);
        out.push({ AP: ap, "ATK%": atk, CR: Math.max(0, b - ap - atk), CD: 0 });
      }
    }
    if (ch.id === "1031") {
      for (const ap of [Math.min(half, b), Math.max(0, Math.min(half, b) - 4)]) {
        const atk = Math.min(half, b - ap), rem = Math.max(0, b - ap - atk);
        out.push({ AP: ap, "ATK%": atk, CR: Math.ceil(rem / 2), CD: Math.floor(rem / 2) });
      }
    }
  }
  if (out.length === 0) out.push({ CR: Math.floor(b / 3), CD: Math.floor(b / 3), "ATK%": b - 2 * Math.floor(b / 3) });
  return out;
}

export function getAutoRotationWeights(activeMembers) {
  const n = activeMembers.length;
  if (n === 0) return [];
  if (n === 1) return [1.0];
  const isDpsRole = wt => wt === "Attack" || wt === "Anomaly" || wt === "Rupture" || wt === "Armorer";
  const dpsIndices = activeMembers.map((m, i) => isDpsRole(m.ch.wt) ? i : -1).filter(i => i >= 0);
  const anomIndices = activeMembers.map((m, i) => m.ch.wt === "Anomaly" ? i : -1).filter(i => i >= 0);
  const supWeight = m => m.ch.id === "1031" ? 0.50 : (["1131","1151","1411","1451","1491","1341","1071","1271"].includes(m.ch.id) ? 0.40 : 0.32);
  const stunWeight = m => ["1361","1391","1481","1511","1571","1621"].includes(m.ch.id) ? 0.50 : 0.40;
  const w = new Array(n).fill(0.32);
  if (anomIndices.length === 3) return [0.82, 0.70, 0.62];
  if (anomIndices.length === 2) {
    activeMembers.forEach((m, i) => {
      if (m.ch.wt === "Anomaly") w[i] = (i === anomIndices[0]) ? 0.90 : 0.64;
      else if (m.ch.wt === "Stun") w[i] = m.ch.id === "1511" ? 0.52 : 0.40;
      else w[i] = supWeight(m);
    });
    return w;
  }
  if (dpsIndices.length >= 2) {
    activeMembers.forEach((m, i) => {
      if (isDpsRole(m.ch.wt)) w[i] = (i === dpsIndices[0]) ? 0.88 : ((m.ch.id === "1301" || m.ch.id === "1461") ? 0.68 : 0.58);
      else if (m.ch.wt === "Stun") w[i] = stunWeight(m);
      else w[i] = supWeight(m);
    });
    return w;
  }
  const mainIdx = dpsIndices.length === 1 ? dpsIndices[0] : 0;
  activeMembers.forEach((m, i) => {
    if (i === mainIdx) w[i] = 1.00;
    else if (m.ch.wt === "Stun") w[i] = stunWeight(m);
    else w[i] = supWeight(m);
  });
  return w;
}

export function emptyTeamBuffs() {
  return {
    atk_flat: 0, atk_pct: 0, hp_pct: 0, def_flat: 0, def_pct: 0, sheer: 0,
    dmg: 0, dmg_chain: 0, dmg_aftershock: 0, cr: 0, cd: 0,
    def_shred: 0, def_ign_abloom: 0, def_ign_aftershock: 0, pen: 0, res_shred: 0,
    stun_mult: 0, stun_mult_alltime: 0,
    ap: 0, anom_dmg: 0, disorder_dmg: 0, buildup: 0, lac_dmg: 0,
    refringe_mult: 0, extra_mult: 1.0, phoenix_crit: null
  };
}

export function mergeBuffs(target, add) {
  target.atk_flat += add.atk_flat; target.atk_pct += add.atk_pct;
  target.hp_pct += add.hp_pct; target.def_flat += add.def_flat; target.def_pct += add.def_pct;
  target.sheer += add.sheer; target.dmg += add.dmg;
  target.dmg_chain += add.dmg_chain; target.dmg_aftershock += add.dmg_aftershock;
  target.cr += add.cr; target.cd += add.cd;
  target.def_shred += add.def_shred;
  target.def_ign_abloom = Math.max(target.def_ign_abloom, add.def_ign_abloom);
  target.def_ign_aftershock = Math.max(target.def_ign_aftershock, add.def_ign_aftershock);
  target.pen += add.pen; target.res_shred += add.res_shred;
  target.stun_mult += add.stun_mult; target.stun_mult_alltime += add.stun_mult_alltime;
  target.ap += add.ap; target.anom_dmg += add.anom_dmg; target.disorder_dmg += add.disorder_dmg;
  target.buildup += add.buildup; target.lac_dmg += add.lac_dmg;
  target.refringe_mult += add.refringe_mult;
  target.extra_mult *= add.extra_mult;
  if (add.phoenix_crit) {
    if (!target.phoenix_crit || (add.phoenix_crit.cr * add.phoenix_crit.cd > target.phoenix_crit.cr * target.phoenix_crit.cd)) {
      target.phoenix_crit = add.phoenix_crit;
    }
  }
}

export function calcStunnerDazePower(m, st, ctx) {
  const cid = m.ch.id, eff = st.eff, potOn = ctx.potAwakening !== false;
  const impBuff = eff.c_imp_pct + (cid === "1161" && m.aa.active ? 0.20 : 0) + (cid === "1141" && potOn ? 0.15 : 0);
  const effImp = (st.init_imp + eff.c_imp_flat) * (1 + impBuff);
  let dazeAdd = st.d2a.daze_pct + st.d2b.daze_pct + st.f4.daze_pct + eff.daze_pct + (ctx.teamDazeBuff || 0);
  if (cid === "1361" && m.aa.active) {
    const crNow = st.init_cr + (m.ch.prof?.self_cr || 0) + eff.c_cr;
    if (crNow > 0.40) dazeAdd += Math.min(0.75, (crNow - 0.40) * 1.5) * 0.65;
  } else if (cid === "1251" && m.aa.active) {
    dazeAdd += 0.20 * 0.55;
  } else if (cid === "1011" && m.aa.active) {
    dazeAdd += 0.08;
  }
  return (effImp / 165.0) * ((1 + dazeAdd) / 1.18) * (st.mods.daze_lv_mult || 1);
}

export function calcMemberTeamBuffUtil(m, st, activeMembers, ctx) {
  if (activeMembers.length <= 1) return 0;
  const cid = m.ch.id, wt = m.ch.wt, aa = m.aa.active, mods = st.mods, eff = st.eff;
  const potOn = ctx.potAwakening !== false;
  let u = 0;
  if (st.fourPc === "山大王" && wt === "Stun") {
    const crNow = st.init_cr + (m.ch.prof?.self_cr || 0) + eff.c_cr;
    if (crNow >= 0.50) u += 0.068 * m.uptime;
    else u += Math.max(0, crNow / 0.50) * 0.020 * m.uptime;
  }
  const hasRupMate = activeMembers.some((x, j) => j !== m.idx && x.ch.wt === "Rupture");
  const hasArmMate = activeMembers.some((x, j) => j !== m.idx && x.ch.wt === "Armorer");
  const hasIceFireMate = activeMembers.some((x, j) => j !== m.idx && (x.ch.eb === "Ice" || x.ch.eb === "Fire"));

  if (m.ch.customTeamBuff?.enabled && m.ch.customTeamBuff.convFrom && m.ch.customTeamBuff.convRate) {
    const ctb = m.ch.customTeamBuff;
    const v = Math.max(0, (st[ctb.convFrom] || 0) - (ctb.convThreshold || 0)) * ctb.convRate;
    const capped = ctb.convCap > 0 ? Math.min(ctb.convCap, v) : v;
    u += (capped / (ctb.convCap > 10 ? ctb.convCap : 1)) * 0.55;
  }

  if (cid === "1311") {
    u += (Math.min(1200, st.init_atk * 0.35) / 3600) * 0.90;
    const effEr = (st.init_er + eff.c_er_flat) * (1 + eff.c_er_rate);
    u += Math.min(0.055, Math.max(0, effEr - 1.5) * 0.045);
  } else if (cid === "1491") {
    u += (Math.min(1050, st.init_atk * 0.30) / 3600) * 0.90;
    const effEr = (st.init_er + eff.c_er_flat) * (1 + eff.c_er_rate);
    u += Math.min(0.052, Math.max(0, effEr - 1.5) * 0.042);
  } else if (cid === "1131") {
    u += (Math.min(1000, st.init_atk * 0.40) / 3600) * 0.85;
    const effEr = (st.init_er + eff.c_er_flat) * (1 + eff.c_er_rate);
    u += Math.min(0.040, Math.max(0, effEr - 1.4) * 0.032);
  } else if (cid === "1151") {
    u += (Math.min(600, st.init_atk * 0.258 + 104) / 3600) * 0.80;
    const effEr = (st.init_er + eff.c_er_flat) * (1 + eff.c_er_rate);
    u += Math.min(0.040, Math.max(0, effEr - 1.4) * 0.032);
  } else if (cid === "1411") {
    u += (Math.min(1200, st.init_atk * 0.40) / 3600) * 0.95;
    if (aa) {
      const amOver = Math.max(0, Math.min(100, (st.init_am + eff.c_am_flat) - 100));
      u += (amOver * 0.002 * mods.tb_anom_aa_mult) * 0.60;
    }
  } else if (cid === "1451") {
    const cap = 900 + mods.tb_lucia_sheer_cap_add, rate = 7.4 + mods.tb_lucia_sheer_rate_add;
    if (hasRupMate) {
      u += (Math.min(cap, 12 + Math.floor(st.init_hp / 200) * rate) / 2600) * 1.15;
      if (st.init_hp >= 24000) u += 0.008;
    }
    const effEr = (st.init_er + eff.c_er_flat) * (1 + eff.c_er_rate);
    u += Math.min(0.006, Math.max(0, effEr - 1.5) * 0.006);
  } else if (cid === "1341") {
    if (aa) u += Math.min(0.30, Math.max(0, st.init_hp - 15000) / 400 * 0.01) * 0.55;
  } else if (cid === "1421" && hasRupMate) {
    const panRate = mods.tb_pan_m6 ? 0.24 : 0.18, panCap = mods.tb_pan_m6 ? 720 : 540;
    u += (Math.min(panCap, st.init_atk * panRate) / 2600) * 0.95;
  } else if (cid === "1211") {
    const basePen = Math.min(0.30, st.init_pen * 0.25 + 0.12);
    u += Math.min(0.39, basePen * mods.tb_pen_mult) * 0.60;
    if (potOn) u += (Math.min(576, st.init_pen * 800) / 3600) * 0.5 + (hasArmMate ? (Math.min(468, st.init_pen * 650) / 3200) * 0.6 : 0);
    const effEr = (st.init_er + eff.c_er_flat) * (1 + eff.c_er_rate);
    u += Math.min(0.035, Math.max(0, effEr - 1.4) * 0.028);
  } else if (cid === "1391") {
    const extraCd = st.init_atk >= 2800 ? Math.min(0.30, Math.floor((st.init_atk - 2800) / 100) * 0.05) : 0;
    u += extraCd * 0.48;
  } else if (cid === "1161" && aa && hasIceFireMate) {
    const cImp = (st.init_imp + eff.c_imp_flat) * (1 + 0.20 + eff.c_imp_pct);
    u += Math.min(0.75, 0.25 + Math.max(0, cImp - 170) / 10 * 0.05) * mods.tb_lighter_elation_mult * 0.52;
  } else if (cid === "1621") {
    u += (hasArmMate ? Math.min(0.20, st.init_cr * 0.20) * 0.60 : Math.min(0.40, st.init_cr * 0.40) * 0.48);
    const effEr = (st.init_er + eff.c_er_flat) * (1 + eff.c_er_rate);
    u += Math.min(0.035, Math.max(0, effEr - 1.5) * 0.028);
  } else if (cid === "1581" && aa && activeMembers.length >= 2) {
    const rate = ctx.anomCount >= 3 ? 0.40 : (ctx.anomCount === 2 ? 0.12 : 0.06);
    u += (Math.min(1600, st.init_atk * rate) / 3600) * 0.60;
  } else if (cid === "1641" && activeMembers.length >= 2) {
    const pcr = Math.min(1.0, 0.30 + Math.max(0, st.init_am - 155) * 0.007);
    const pcd = 0.25 + (aa ? 0.15 : 0) + (mods.anom_crit_cd_add || 0);
    const otherAnom = activeMembers.filter((x, j) => j !== m.idx && x.ch.wt === "Anomaly").length;
    if (otherAnom >= 1) u += pcr * pcd * (0.28 * otherAnom) * m.uptime;
  }
  if (wt === "Stun") {
    const dp = calcStunnerDazePower(m, st, ctx);
    u += (dp - 1.0) * 0.055;
  }
  return u;
}

// ============================================================================
// Main Team Simulator V3 (Full Swap-Cancel + Bangboo + 3-Mode Gear + DPR/DPS)
// ============================================================================

export function simulateTeamV2(slots, env, charMap = CHAR_MAP, wepMap = SC_WEPS, opts: any = {}) {
  const fastMode = !!opts.fastMode;
  const defaultRolls = env.rollBudget ?? 28;
  const notes = [];
  const activeMembers = [];
  const seenCids = new Set();

  slots.forEach((sl, slotIdx) => {
    if (!sl || !sl.cid || !charMap[sl.cid]) return;
    const ch = charMap[sl.cid];
    const w = wepMap[sl.wid] || wepMap[ch.sig] || Object.values(wepMap)[0];
    if (seenCids.has(ch.id)) notes.push(`[编队警告] 队伍存在重复角色【${ch.n}】，实战无法同名编队`);
    seenCids.add(ch.id);
    activeMembers.push({
      slotIdx, idx: activeMembers.length, cfg: sl, ch, w,
      m: sl.m ?? (ch.r === "A" ? 6 : 0),
      ref: sl.ref ?? (w.r === "S" ? 1 : 5),
      fourPc: (!sl.fourPc || sl.fourPc === "默认") ? ch.def4pc : sl.fourPc,
      twoPc: (!sl.twoPc || sl.twoPc === "默认") ? ch.def2pc : sl.twoPc,
      uptime: sl.uptime !== undefined ? Math.max(0.2, Math.min(1.0, Number(sl.uptime))) : 1.0,
      rolls: sl.rolls !== undefined ? Number(sl.rolls) : defaultRolls,
      subCap: sl.subRollCap !== undefined ? Number(sl.subRollCap) : (env.subRollCap || 18)
    });
  });

  if (activeMembers.length === 0) return {
    teamDps: 0, teamDpr: 0, teamActualDps: 0, cycleSec: 20, carryDmg: 0,
    carryVsSolo: 0, teamVsSolo: 0, soloBest: 0, bangbooDmg: 0,
    aaLitCount: 0, activeCount: 0, slotResults: [], discTop: [], qaSwap: null,
    notes: ["[提示] 当前队伍已清空：请在上方【选队编队台】点击角色或使用槽位下拉框依次上阵 1 / 2 / 3 号位"]
  };

  const bangboo = (!opts.ignoreBangboo && env.bangbooId && BANGBOO_MAP[env.bangbooId])
    ? BANGBOO_MAP[env.bangbooId]
    : BANGBOO_MAP.none;

  const teamElems = new Set(activeMembers.map(m => m.ch.eb));
  const anomBars = new Set(activeMembers.map(m => m.ch.anomBar || m.ch.eb));
  const anomCount = activeMembers.filter(m => m.ch.wt === "Anomaly").length;
  const stunCount = activeMembers.filter(m => m.ch.wt === "Stun").length;
  const attackCount = activeMembers.filter(m => m.ch.wt === "Attack").length;
  const windCount = activeMembers.filter(m => m.ch.eb === "Wind").length;
  const nonWindCount = activeMembers.filter(m => m.ch.eb !== "Wind").length;
  const hasAtkOrRup = activeMembers.some(m => m.ch.wt === "Attack" || m.ch.wt === "Rupture");
  const teamHasVeil = activeMembers.some(m => m.ch.prof?.has_ether_veil);
  const teamHasPhoenix = activeMembers.some(m => m.ch.id === "1641");
  const teamHasJane = activeMembers.some(m => m.ch.id === "1261");
  const velinaVortexOk = nonWindCount >= 1 && activeMembers.length >= 2;
  const teamHasContam = windCount >= 1 && nonWindCount >= 1;
  const canDisorder = anomBars.size >= 2;

  const mateHasVeil = {};
  activeMembers.forEach((m, i) => {
    mateHasVeil[m.ch.id] = activeMembers.some((o, j) => j !== i && o.ch.prof?.has_ether_veil);
    m.aa = checkAdditionalAbility(i, activeMembers, m.cfg);
  });

  if (activeMembers.some(m => m.ch.id === "1561") && !velinaVortexOk) {
    notes.push(`[机制冲突] 维琳娜处于纯风/单人环境，无非风属性队友触发【污染】与【风化涡流】，输出与降抗大幅亏损`);
  }
  if (activeMembers.some(m => m.ch.id === "1581") && activeMembers.length < 2) {
    notes.push(`[注意] 蕾米埃尔单人无法通过队友触发【耀化】积攒虚芒，实战需搭配其他异常队友`);
  }

  let anomDurBonus = 0, hasNangongPol = false;
  activeMembers.forEach(m => {
    if (!m.aa.active) return;
    if (["1171","1211","1501","1541"].includes(m.ch.id)) anomDurBonus += 3;
    if (m.ch.id === "1511") hasNangongPol = true;
  });

  // Evaluate 8-Dimension Swap-Cancel Engine (+ optional Timeline Coupling when team matches)
  const swapCfg = env.swapConfig || makeDefaultSwapConfig(env.swapMode || "standard");
  const tlMatch = !fastMode && env.timelineCoupled && env.timelineAnalysis && env.timelineAnalysis.active
    && (!env.timelineCids || env.timelineCids.length === 0 || env.timelineCids.join(",") === activeMembers.map(m => m.ch.id).join(","));
  const qaSwap = evalSwapCancelEngine(activeMembers, swapCfg, env, bangboo, tlMatch ? env.timelineAnalysis : null);
  qaSwap.diagnostics.forEach(d => notes.push(d));

  const effStunShare = {};
  const hasStunExt = activeMembers.some(m => ["1161","1471"].includes(m.ch.id) || (m.aa.active && ["1511","1571","1621"].includes(m.ch.id)));
  activeMembers.forEach(m => {
    let baseS = m.ch.prof?.stun_share || 0.50;
    if (env.stunPhysicsMode === "physics" && qaSwap.realStunShare[m.ch.id] !== undefined) {
      baseS = qaSwap.realStunShare[m.ch.id];
    } else {
      if (stunCount === 0) baseS *= (m.ch.prof?.veil_vuln ? 1.0 : 0.76);
      else if (stunCount === 1) baseS = Math.min(0.85, baseS * 1.04 + (hasStunExt ? 0.06 : 0));
      else if (stunCount >= 2) baseS = Math.min(0.92, baseS * 1.12 + (hasStunExt ? 0.06 : 0));
    }
    effStunShare[m.ch.id] = baseS;
  });

  const freedomBluesElems = new Set();
  activeMembers.forEach(m => {
    const fp = m.cfg?.buildMode === "pieces"
      ? (m.cfg.pieces?.filter(p => p?.set === "自由").length >= 4 ? "自由" : m.fourPc)
      : m.fourPc;
    if (fp === "自由") freedomBluesElems.add(m.ch.eb);
  });

  const ctx = {
    qaSwap,
    bangboo,
    activeCount: activeMembers.length,
    teamElems, anomCount, stunCount, attackCount, windCount, nonWindCount,
    hasAtkOrRup, teamHasVeil, mateHasVeil, teamHasPhoenix, teamHasJane,
    velinaVortexOk, teamHasContam, canDisorder, anomDurBonus, hasNangongPol,
    effStunShare, freedomBluesElems, teamDazeBuff: bangboo?.dazeBonus || 0,
    slotMvMult: Object.fromEntries(activeMembers.map(m => [m.ch.id, m.cfg.mvMult ?? 1.0])),
    potAwakening: env.potAwakening !== false,
    er2pcCountsInit: env.er2pcCountsInit !== false
  };

  activeMembers.forEach(m => {
    const weff = getWeaponEffects(m.ch, m.w, m.ref, ctx, m.cfg);
    ctx.teamDazeBuff += (weff.t_daze || 0) * m.uptime;
  });

  // Pass 1: Optimize/Evaluate each member's out-of-combat sheet for team-buff conversions
  activeMembers.forEach(m => {
    const mods = getMindscapeMods(m.ch, m.m, m.cfg);
    const bm = m.cfg.buildMode || "auto";
    if (bm === "pieces" || bm === "panel") {
      m.sheet = evalMemberSheet(m.ch, m.m, m.w, m.ref, m.fourPc, m.twoPc, m.cfg.d4, m.cfg.d5, m.cfg.d6, m.cfg.sub, mods, ctx, m.cfg);
      m.fourPc = m.sheet.fourPc;
      m.twoPc = m.sheet.twoPc;
      m.baseBuffUtil = calcMemberTeamBuffUtil(m, m.sheet, activeMembers, ctx);
      return;
    }
    const isLockedDisc = m.cfg.discAuto === false && m.cfg.d4 && m.cfg.d5 && m.cfg.d6;
    const dOpts = isLockedDisc ? [[m.cfg.d4], [m.cfg.d5], [m.cfg.d6]] : getDiscCandidates(m.ch);
    const allocs = (m.cfg.subAuto === false && m.cfg.sub) ? [m.cfg.sub]
      : (fastMode ? getSubAllocs(m.ch, m.rolls, m.subCap).slice(0, 4) : getSubAllocs(m.ch, m.rolls, m.subCap));
    let bestSt = null, bestScore = -1e18;
    for (const d4 of dOpts[0]) {
      for (const d5 of dOpts[1]) {
        for (const d6 of dOpts[2]) {
          for (const sub of allocs) {
            const st = evalMemberSheet(m.ch, m.m, m.w, m.ref, m.fourPc, m.twoPc, d4, d5, d6, sub, mods, ctx, m.cfg);
            const util = calcMemberTeamBuffUtil(m, st, activeMembers, ctx);
            const bdMatch = `${d4}/${d5}/${d6}` === m.ch.base_disc ? 0.0005 : 0;
            const sc = util + bdMatch;
            if (sc > bestScore) { bestScore = sc; bestSt = st; }
          }
        }
      }
    }
    m.sheet = bestSt;
    m.baseBuffUtil = calcMemberTeamBuffUtil(m, bestSt, activeMembers, ctx);
  });

  // Stunner Daze Power -> Stun Window Share shift + Cycle Speedup refinement!
  const stunMembers = activeMembers.filter(m => m.ch.wt === "Stun");
  let dazeShift = 0;
  if (stunMembers.length > 0) {
    const avgDp = stunMembers.reduce((s, m) => s + calcStunnerDazePower(m, m.sheet, ctx), 0) / stunMembers.length;
    dazeShift = (avgDp - 1.0) * 0.10 + Math.min(0.08, qaSwap.parryCount * 0.012);
    // Daze power also refines out-of-stun duration (unless user locked exact timeline length)!
    if (qaSwap.mode !== "timeline_exact") {
      const newOutSec = Math.max(4.0, qaSwap.outStunSec / Math.max(0.65, avgDp));
      const deltaOut = qaSwap.outStunSec - newOutSec;
      qaSwap.outStunSec = newOutSec;
      qaSwap.cycleSec = Math.max(10.5, qaSwap.cycleSec - deltaOut * 0.65);
      qaSwap.cycleSpeedup = Math.max(0.65, Math.min(1.65, 20.0 / qaSwap.cycleSec));
    }
  } else {
    let nonStunDaze = ctx.teamDazeBuff;
    activeMembers.forEach(m => {
      nonStunDaze += (m.sheet.eff.daze_pct || 0) * 0.35 + (m.sheet.f4.daze_pct || 0) * 0.35;
    });
    dazeShift = nonStunDaze * 0.18 + Math.min(0.06, qaSwap.parryCount * 0.01);
  }

  activeMembers.forEach(m => {
    const cap = stunCount >= 2 ? 0.93 : (stunCount === 1 ? 0.88 : 0.75);
    effStunShare[m.ch.id] = Math.max(0.18, Math.min(cap, effStunShare[m.ch.id] + dazeShift));
  });

  // Squad Aura 4pc Sets (including custom 4pc team aura sets!)
  const squadSetBuff = { dmg: 0, cd: 0, atk_pct: 0, ap: 0, res_shred: 0 };
  const seenSquadSets = new Set();
  activeMembers.forEach(m => {
    const fp = m.fourPc;
    const ds = DISC_SETS[fp];
    if (!ds) return;
    const isTeamSet = ["月光","山大王","静听","雪兔","原始","摇摆"].includes(fp) || !!(ds.customMods?.enabled && ds.customMods?.d4Team);
    if (!isTeamSet) return;

    const reqRole = ds.roleReq;
    if (reqRole && m.ch.wt !== reqRole) {
      notes.push(`[套装失效] ${m.ch.n}(${m.ch.p}) 携带【${ds.name}4】，但该4件套仅限特定职业生效`);
      return;
    }
    if (seenSquadSets.has(fp)) {
      notes.push(`[套装撞车] 队伍存在重复【${ds.name}4】（同名光环不叠加），建议点击顶部「一键优盘防撞车」自动分流`);
      return;
    }
    seenSquadSets.add(fp);
    const u = m.uptime * (m.cfg?.fourPcUptime !== undefined ? Number(m.cfg.fourPcUptime) : 1.0);

    if (ds.customMods?.enabled && ds.customMods?.d4Team) {
      const ct = ds.customMods.d4Team;
      squadSetBuff.dmg += (ct.dmg || 0) * u;
      squadSetBuff.cd += (ct.cd || 0) * u;
      squadSetBuff.atk_pct += (ct.atk_pct || 0) * u;
      squadSetBuff.ap += (ct.ap || 0) * u;
      squadSetBuff.res_shred += (ct.res_shred || 0) * u;
      if (ds.customMods.replaceBuiltin) return;
    }

    if (fp === "月光") squadSetBuff.dmg += 0.18 * u;
    else if (fp === "山大王") {
      const crNow = m.sheet.init_cr + (m.ch.prof?.self_cr || 0) + m.sheet.eff.c_cr;
      const kotsCd = crNow >= 0.50 ? 0.30 : 0.15;
      if (crNow < 0.50) notes.push(`[阈值未满] ${m.ch.n} 携带【山大王4】当前暴击 ${(crNow * 100).toFixed(1)}% < 50%，仅触发 +15% 暴伤（堆满50%暴击可得+30%）`);
      squadSetBuff.cd += kotsCd * u;
    }
    else if (fp === "静听") {
      squadSetBuff.dmg += qaSwap.astralDmg * u;
      if (activeMembers.length >= 2 && qaSwap.astralStacks < 2.2) {
        notes.push(`[叠层偏低] 当前手法每轮快速支援约 ${qaSwap.totalQA.toFixed(1)} 次，【静听嘉音4】平均仅叠 ${qaSwap.astralStacks.toFixed(1)}/3层 (+${(qaSwap.astralDmg * 100).toFixed(1)}%)，单支援建议改带【月光骑士颂4(+18%)】`);
      }
    }
    else if (fp === "雪兔") squadSetBuff.dmg += 0.18 * u;
    else if (fp === "原始") squadSetBuff.dmg += (activeMembers.some(x => x.ch.defAssist) ? 0.15 : 0.08) * Math.min(1.0, 0.45 + 0.55 * qaSwap.protoCov) * u;
    else if (fp === "摇摆") squadSetBuff.dmg += 0.15 * u;
  });

  const autoWeights = getAutoRotationWeights(activeMembers);
  const slotResults = [];
  const estTeamRef = activeMembers.length >= 2 ? 62000 : 0;

  // Pass 2: Evaluate Final Damage for each slot
  activeMembers.forEach((m, i) => {
    const tb = emptyTeamBuffs();
    tb.dmg += squadSetBuff.dmg + (bangboo?.teamDmg || 0);
    tb.cd += squadSetBuff.cd;
    tb.atk_pct += squadSetBuff.atk_pct;
    tb.atk_flat += bangboo?.teamAtkFlat || 0;
    tb.ap += squadSetBuff.ap + (bangboo?.teamAp || 0);
    tb.res_shred += squadSetBuff.res_shred;
    if (m.ch.wt === "Rupture") tb.sheer += bangboo?.teamSheer || 0;

    activeMembers.forEach(src => mergeBuffs(tb, computePairBuff(src, m, ctx, notes)));
    tb.extra_mult *= qaSwap.slotActionMult[i];

    const rotWeight = (m.cfg.weightMode === "manual" && m.cfg.weight !== undefined)
      ? Math.max(0, Math.min(2.5, Number(m.cfg.weight)))
      : (autoWeights[i] * qaSwap.weightMult[i]);

    const bm = m.cfg.buildMode || "auto";
    let best = null;
    const discTop = [];

    if (bm === "pieces" || bm === "panel") {
      best = evalSlotDamage(m.ch, m.m, m.w, m.ref, m.fourPc, m.twoPc, m.cfg.d4, m.cfg.d5, m.cfg.d6, m.cfg.sub, m.aa.active, tb, env, ctx, m.cfg, i);
      discTop.push({
        disc: bm === "pieces" ? "6盘实体精调" : "局外面板直填",
        rawDmg: best.rawDmg, combScore: best.rawDmg * rotWeight, sub: best.st.sub, bd: best.breakdown
      });
    } else {
      const isLockedDisc = m.cfg.discAuto === false && m.cfg.d4 && m.cfg.d5 && m.cfg.d6;
      const [d4Opts, d5Opts, d6Opts] = isLockedDisc ? [[m.cfg.d4], [m.cfg.d5], [m.cfg.d6]] : getDiscCandidates(m.ch);
      const allocs = (m.cfg.subAuto === false && m.cfg.sub) ? [m.cfg.sub]
        : (fastMode ? getSubAllocs(m.ch, m.rolls, m.subCap).slice(0, 4) : getSubAllocs(m.ch, m.rolls, m.subCap));
      let bestCombined = -1e18;
      for (const d4 of d4Opts) {
        for (const d5 of d5Opts) {
          for (const d6 of d6Opts) {
            let bestForDisc = null, bestForDiscComb = -1e18;
            for (const sub of allocs) {
              const r = evalSlotDamage(m.ch, m.m, m.w, m.ref, m.fourPc, m.twoPc, d4, d5, d6, sub, m.aa.active, tb, env, ctx, m.cfg, i);
              const utilDelta = (calcMemberTeamBuffUtil(m, r.st, activeMembers, ctx) - m.baseBuffUtil) * estTeamRef;
              const comb = r.rawDmg * rotWeight + utilDelta;
              if (comb > bestForDiscComb) { bestForDiscComb = comb; bestForDisc = r; }
              if (comb > bestCombined) { bestCombined = comb; best = r; }
            }
            if (!fastMode) discTop.push({ disc: `${d4}/${d5}/${d6}`, rawDmg: bestForDisc.rawDmg, combScore: bestForDiscComb, sub: bestForDisc.st.sub, bd: bestForDisc.breakdown });
          }
        }
      }
      if (!fastMode) discTop.sort((a, b) => b.combScore - a.combScore);
    }

    if (!fastMode && rotWeight >= 0.55) {
      const bd = best.breakdown;
      const crCap = m.ch.wt === "Armorer" ? 2.0 : 1.0;
      if (bd.c_cr > crCap + 0.03 && !m.ch.prof?.anom_split) {
        notes.push(`[暴击溢出] ${m.ch.n} 局内暴击率 ${(bd.c_cr * 100).toFixed(1)}% 超出 ${(crCap * 100).toFixed(0)}% 上限，溢出 ${((bd.c_cr - crCap) * 100).toFixed(1)}%`);
      }
      if (m.ch.wt === "Rupture" && (tb.def_shred > 0.05 || tb.pen > 0.05)) {
        notes.push(`[机制防坑] ${m.ch.n}(命破) 贯穿伤天生100%无视防御，队友提供的减防/穿透无法提升其伤害`);
      } else if (m.ch.wt !== "Rupture" && bd.shred >= 0.999) {
        notes.push(`[乘区满额] ${m.ch.n} 减防/无视防御已叠满 100% 上限`);
      }
      if (m.w.wt !== m.ch.wt && !m.cfg?.allowCrossWep) {
        notes.push(`[跨职业音擎] ${m.ch.n}(${m.ch.p}) 携带【${m.w.n}(${m.w.p})】，音擎被动不生效（可在槽位专家区强制解锁测试）`);
      }
    }

    const bestDiscStr = bm === "panel" ? "局外面板直填" : `${best.st.d4}/${best.st.d5}/${best.st.d6}`;
    slotResults.push({
      slotIdx: m.slotIdx, ch: m.ch, w: m.w, m: m.m, ref: m.ref,
      fourPc: best.st.fourPc, twoPc: best.st.twoPc, buildMode: bm,
      uptime: m.uptime, aa: m.aa,
      rotWeight, autoWeight: autoWeights[i] * qaSwap.weightMult[i],
      rawDmg: best.rawDmg, weightedDmg: best.rawDmg * rotWeight,
      bestDisc: bestDiscStr,
      bestSub: best.st.sub, bd: best.breakdown, st: best.st, tb,
      discTop: discTop.slice(0, 6)
    });
  });

  // Bangboo direct chain/active damage contribution (scaled accurately relative to squad output)
  const bangbooDmg = (env.includeBangbooDmg !== false && bangboo && bangboo.chainMv > 0)
    ? bangboo.chainMv * 3.1 * (794.0 / (794.0 + env.enemyDef))
    : 0;

  const baseWeightedSum = slotResults.reduce((acc, r) => acc + r.weightedDmg, 0) + bangbooDmg;
  // Standard 20s cycle DPR vs Cycle-Compressed Real DPS!
  const cycleSec = Math.max(8.0, qaSwap.cycleSec || 20.0);
  const teamDpr = baseWeightedSum * 20.0;              // Single full rotation damage (~140w-240w)
  const teamActualDps = teamDpr / cycleSec;            // Real Damage Per Second = DPR / T_cycle!

  // Primary ranking metric selectable by user ("dps" includes cycle compression; "dpr" compares single-cycle total)
  const metricMode = env.metricMode || "dps";
  const teamDps = metricMode === "dpr" ? baseWeightedSum : teamActualDps;

  slotResults.forEach(r => { r.dpsShare = baseWeightedSum > 0 ? (r.weightedDmg / baseWeightedSum) : 0; });

  let soloBest = slotResults[0].rawDmg;
  if (!fastMode && !opts.skipSoloBaseline) {
    const c0 = slotResults[0].ch;
    const sigId = wepMap[c0.sig] ? c0.sig : Object.keys(wepMap)[0];
    const soloRes = simulateTeamV2(
      [{ cid: c0.id, m: c0.r === "A" ? 6 : 0, wid: sigId, ref: wepMap[sigId]?.r === "S" ? 1 : 5, discAuto: true, aaMode: "auto" }, null, null],
      { ...env, bangbooId: "none" }, charMap, wepMap, { skipSoloBaseline: true, ignoreBangboo: true }
    );
    soloBest = Math.max(1, soloRes.teamDps);
  }

  const aaLitCount = slotResults.filter(r => r.aa.active).length;
  return {
    teamDps,
    teamDpr,
    teamActualDps,
    baseWeightedSum,
    cycleSec,
    da3MinTotal: teamActualDps * 180.0,
    bangboo,
    bangbooDmg,
    carryDmg: slotResults[0].rawDmg,
    carryVsSolo: (slotResults[0].rawDmg * (metricMode === "dpr" ? 1 : (20.0 / cycleSec))) / Math.max(1, soloBest),
    teamVsSolo: teamDps / Math.max(1, soloBest),
    soloBest, aaLitCount, activeCount: slotResults.length,
    slotResults, bestDisc: slotResults[0].bestDisc, bestSub: slotResults[0].bestSub,
    bd: slotResults[0].bd, teamBuffs: slotResults[0].tb, discTop: slotResults[0].discTop,
    qaSwap, ctx, notes: [...new Set(notes)]
  };
}

// ============================================================================
// Comparison Rankings, Mindscape Ladder, Next-Gold ROI & Box Team Finder
// ============================================================================

export function rankDiscSetsForSlot(slots, targetSlotIdx, env, charMap = CHAR_MAP, wepMap = SC_WEPS) {
  const sl = slots[targetSlotIdx];
  if (!sl || !sl.cid || !charMap[sl.cid]) return [];
  const ch = charMap[sl.cid];
  const customSetIds = Object.keys(customDB.discSets || {});
  const candSets = ch.wt === "Support" ? ["月光","静听","摇摆","自由","原始"]
    : ch.wt === "Stun" ? ["山大王","震星","摇摆","静听","啄木","自由"]
    : ch.wt === "Defense" ? ["雪兔","原始","静听","摇摆","灵魂"]
    : ch.wt === "Armorer" ? ["荆棘","啄木","雷暴","无"]
    : ch.wt === "Rupture" ? ["云岿","折枝","啄木","极地","炎狱","无"]
    : ch.prof?.anom_split ? ["谶羽","呼啸","囚徒","流光","法厄同","混沌爵士","折枝","獠牙","雷暴","自由"]
    : ["沧浪","啄木","激素","折枝","如影","拂晓","拂晓行纪","河豚","獠牙","炎狱","极地","雷暴","混沌重","无"];
  const curFp = (!sl.fourPc || sl.fourPc === "默认") ? ch.def4pc : sl.fourPc;
  const uniqueSets = [...new Set([ch.def4pc, curFp, ...candSets, ...customSetIds])].filter(s => DISC_SETS[s]);
  const results = [];
  for (const fp of uniqueSets) {
    const nextSlots = slots.map((s, idx) => idx === targetSlotIdx ? { ...s, buildMode: s.buildMode === "pieces" ? "auto" : s.buildMode, fourPc: fp } : s);
    const r = simulateTeamV2(nextSlots, env, charMap, wepMap, { skipSoloBaseline: true });
    const sr = r.slotResults.find(x => x.slotIdx === targetSlotIdx);
    results.push({ fourPc: fp, name: DISC_SETS[fp].name, d4Desc: DISC_SETS[fp].d4, teamDps: r.teamDps, teamDpr: r.teamDpr, selfDmg: sr ? sr.rawDmg : 0 });
  }
  results.sort((a, b) => b.teamDps - a.teamDps);
  return results;
}

export function autoOptimizeTeamDiscs(slots, env, charMap = CHAR_MAP, wepMap = SC_WEPS) {
  const next = slots.map(s => s ? { ...s, buildMode: s.buildMode === "panel" ? "panel" : "auto", discAuto: true } : s);
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 3; i++) {
      if (!next[i] || !next[i].cid || !charMap[next[i].cid]) continue;
      const ranked = rankDiscSetsForSlot(next, i, env, charMap, wepMap);
      if (ranked.length) next[i].fourPc = ranked[0].fourPc;
    }
  }
  return next;
}

export function rankWeaponsForSlot(slots, targetSlotIdx, env, charMap = CHAR_MAP, wepMap = SC_WEPS, aRankRef = 5) {
  const sl = slots[targetSlotIdx];
  if (!sl || !sl.cid || !charMap[sl.cid]) return [];
  const ch = charMap[sl.cid];
  const sameWt = Object.values(wepMap).filter(w => w.wt === ch.wt && w.r !== "B");
  const customWepIds = Object.keys(customDB.weps || {}).filter(id => wepMap[id]?.wt === ch.wt);
  const candIds = [...new Set([ch.sig, sl.wid, ...customWepIds, ...(ch.cands || []), ...sameWt.map(w => w.id)])].filter(id => wepMap[id]);

  const sigW = wepMap[ch.sig] || wepMap[candIds[0]];
  const sigRef = sigW?.r === "S" ? 1 : 5;
  const sigSlots = slots.map((s, idx) => idx === targetSlotIdx ? { ...s, wid: sigW.id, ref: sigRef } : s);
  const sigSim = simulateTeamV2(sigSlots, env, charMap, wepMap, { skipSoloBaseline: true });
  const sigSr = sigSim.slotResults.find(x => x.slotIdx === targetSlotIdx);
  const baseTeam = Math.max(1, sigSim.teamDps);
  const baseSelf = Math.max(1, sigSr ? sigSr.rawDmg : 1);

  const list = [];
  for (const wid of candIds.slice(0, 18)) {
    const w = wepMap[wid];
    const testRef = (wid === sl.wid && sl.ref) ? sl.ref : (w.r === "S" ? 1 : aRankRef);
    const tSlots = slots.map((s, idx) => idx === targetSlotIdx ? { ...s, wid, ref: testRef } : s);
    const r = simulateTeamV2(tSlots, env, charMap, wepMap, { skipSoloBaseline: true });
    const sr = r.slotResults.find(x => x.slotIdx === targetSlotIdx);
    const isFree = w.r !== "S" || NON_LIM_S_WEPS.has(wid);
    const subTxt = `${SN_ZH[w.sn] || w.sn}${w.sv < 2 ? '+' + Math.round(w.sv * 100) + '%' : '+' + Math.round(w.sv)}`;
    const baseTxt = w.bdef > 0 ? `基防${w.bdef}` : `基攻${w.batk}`;
    list.push({
      wid, w, ref: testRef,
      isSig: wid === ch.sig,
      isCur: wid === sl.wid && testRef === sl.ref,
      isFree,
      isPelFree: wid === "14155",
      isStdS: w.r === "S" && NON_LIM_S_WEPS.has(wid) && wid !== "14155",
      statTxt: `${baseTxt} · ${subTxt}`,
      teamDps: r.teamDps,
      selfDmg: sr ? sr.rawDmg : 0,
      teamPct: r.teamDps / baseTeam,
      selfPct: (sr ? sr.rawDmg : 0) / baseSelf
    });
  }
  list.sort((a, b) => b.teamDps - a.teamDps);
  return list;
}

export function computeMindscapeLadder(slots, targetSlotIdx, env, charMap = CHAR_MAP, wepMap = SC_WEPS) {
  const sl = slots[targetSlotIdx];
  if (!sl || !sl.cid || !charMap[sl.cid]) return [];
  const ch = charMap[sl.cid];
  const out = [];
  let baseTeam = 1, baseSelf = 1, prevTeam = 1;
  for (let m = 0; m <= 6; m++) {
    const tSlots = slots.map((s, idx) => idx === targetSlotIdx ? { ...s, m } : s);
    const r = simulateTeamV2(tSlots, env, charMap, wepMap, { skipSoloBaseline: true });
    const sr = r.slotResults.find(x => x.slotIdx === targetSlotIdx);
    const selfVal = sr ? sr.rawDmg : 0;
    if (m === 0) {
      baseTeam = Math.max(1, r.teamDps);
      baseSelf = Math.max(1, selfVal);
      prevTeam = baseTeam;
    }
    const stepGain = m === 0 ? 0 : (r.teamDps / prevTeam) - 1;
    const rawDesc = ch.m_stages?.[m - 1]?.desc || "技能倍率与面板提升";
    const survTag = (m > 0 && Math.abs(stepGain) < 0.0005 && ch.id !== "1551") ? " · [生存/范围功能项，直伤0%]" : "";
    out.push({
      m,
      isCur: (sl.m ?? 0) === m,
      isFree: ch.r === "A" || (ch.id === "1551" && m > 0 && m <= 2),
      isKeySpike: m > 0 && stepGain >= 0.115,
      teamDps: r.teamDps,
      selfDmg: selfVal,
      teamGain: (r.teamDps / baseTeam) - 1,
      selfGain: (selfVal / baseSelf) - 1,
      stepGain,
      desc: m === 0 ? `M0 基础完全体 · 抽取建议：${ch.m_rec || "自由规划"}` : (rawDesc + survTag)
    });
    prevTeam = Math.max(1, r.teamDps);
  }
  return out;
}

export function computeNextGoldROI(slots, env, charMap = CHAR_MAP, wepMap = SC_WEPS, includeRefinement = false) {
  const cur = simulateTeamV2(slots, env, charMap, wepMap);
  const cands = [];
  for (let i = 0; i < 3; i++) {
    const sl = slots[i];
    if (!sl || !sl.cid || !charMap[sl.cid]) continue;
    const ch = charMap[sl.cid];
    const sigW = wepMap[ch.sig];
    if (sl.wid !== ch.sig && sigW && sigW.r === "S") {
      const nextSlots = slots.map((s, idx) => idx === i ? { ...s, wid: ch.sig, ref: 1 } : s);
      const r = simulateTeamV2(nextSlots, env, charMap, wepMap, { skipSoloBaseline: true });
      const isZero = NON_LIM_S_WEPS.has(ch.sig);
      cands.push({
        slot: i + 1, who: ch.n, isZeroGold: isZero,
        badge: ch.id === "1551" ? "[主线0金]" : (isZero ? "[常驻0金]" : "[1限定金]"),
        action: `换上专武 R1【${sigW.n}】`,
        desc: "补齐专属音擎面板与团队/自身特效",
        gain: (r.teamDps / Math.max(1, cur.teamDps)) - 1,
        apply: { idx: i, patch: { wid: ch.sig, ref: 1 } }
      });
    } else if (includeRefinement && sl.wid && wepMap[sl.wid]?.r === "S" && (sl.ref || 1) < 5) {
      const nextRef = (sl.ref || 1) + 1;
      const nextSlots = slots.map((s, idx) => idx === i ? { ...s, ref: nextRef } : s);
      const r = simulateTeamV2(nextSlots, env, charMap, wepMap, { skipSoloBaseline: true });
      const isZero = NON_LIM_S_WEPS.has(sl.wid);
      cands.push({
        slot: i + 1, who: ch.n, isZeroGold: isZero,
        badge: isZero ? "[常驻精炼]" : "[1限定金]",
        action: `音擎精炼 R${sl.ref || 1} -> R${nextRef}`,
        desc: `提升【${wepMap[sl.wid].n}】特效倍率`,
        gain: (r.teamDps / Math.max(1, cur.teamDps)) - 1,
        apply: { idx: i, patch: { ref: nextRef } }
      });
    }
    const curM = sl.m ?? (ch.r === "A" ? 6 : 0);
    if (curM < 6) {
      const nextM = curM + 1;
      const nextSlots = slots.map((s, idx) => idx === i ? { ...s, m: nextM } : s);
      const r = simulateTeamV2(nextSlots, env, charMap, wepMap, { skipSoloBaseline: true });
      const isPelFree = ch.id === "1551" && nextM <= 2;
      const isStd = NON_LIM_S_CHARS.has(ch.id) && ch.id !== "1551";
      const isZero = ch.r === "A" || isPelFree || isStd;
      cands.push({
        slot: i + 1, who: ch.n, isARank: ch.r === "A", isZeroGold: isZero,
        badge: isPelFree ? "[主线0金]" : (ch.r === "A" ? "[A级补星]" : (isStd ? "[常驻歪星]" : "[1限定金]")),
        action: `影画 M${curM} -> M${nextM}`,
        desc: ch.m_stages?.[nextM - 1]?.desc || "",
        gain: (r.teamDps / Math.max(1, cur.teamDps)) - 1,
        apply: { idx: i, patch: { m: nextM } }
      });
    }
  }
  cands.sort((a, b) => (a.isARank === b.isARank ? b.gain - a.gain : (a.isARank ? 1 : -1)));
  return { cur, cands };
}

export function calcLimitedGold(slots, charMap = CHAR_MAP, wepMap = SC_WEPS) {
  let g = 0;
  for (const sl of slots) {
    if (!sl || !sl.cid || !charMap[sl.cid]) continue;
    const ch = charMap[sl.cid];
    if (ch.r === "S" && !NON_LIM_S_CHARS.has(ch.id)) g += 1 + (Number(sl.m) || 0);
    const w = sl.wid ? wepMap[sl.wid] : null;
    if (w && w.r === "S" && !NON_LIM_S_WEPS.has(w.id)) g += Math.max(1, Number(sl.ref) || 1);
  }
  return g;
}

export function findViableTeams(anchorCid, ownedSet, env, charMap = CHAR_MAP, wepMap = SC_WEPS, options: any = {}) {
  const requireAllAA = !!options.requireAllAA;
  const useF2PWeps = !!options.useF2PWeps;
  const maxSGold = options.maxSGold ?? 99;
  const limit = options.limit || 12;
  const F2P_WEP_BY_WT = { Attack: "13015", Anomaly: "13009", Rupture: "13019", Armorer: "13021", Stun: "13006", Support: "13115", Defense: "13010" };
  const syncedMap = options.syncedSlotsByCid || null;
  const makeSlot = cid => {
    if (syncedMap && syncedMap[cid]) {
      return { discAuto: false, aaMode: "auto", ...deepClone(syncedMap[cid]), cid };
    }
    const ch = charMap[cid], sigW = wepMap[ch.sig] || Object.values(wepMap)[0];
    let wid = sigW.id, ref = sigW.r === "S" ? 1 : 5;
    if (useF2PWeps && sigW.r === "S" && cid !== "1551") { wid = F2P_WEP_BY_WT[ch.wt] || wid; ref = 5; }
    return { cid, m: ch.r === "A" ? 6 : 0, wid, ref, discAuto: true, aaMode: "auto" };
  };
  const pool = Object.values(charMap).filter(c => !ownedSet || ownedSet.has(c.id));
  if (pool.length < 3) return [];
  const anchors = anchorCid && charMap[anchorCid] ? [charMap[anchorCid]]
    : pool.filter(c => ["Attack","Anomaly","Rupture","Armorer"].includes(c.wt)).slice(0, 12);
  const candidates = [];
  const seenKeys = new Set();
  for (const anc of anchors) {
    const partners = pool.filter(c => c.id !== anc.id);
    const scoredPartners = partners.map(p => {
      let sc = (p.r === "S" ? 12 : 7);
      if ((anc.aa?.roles || []).includes(p.wt)) sc += 20;
      if (anc.aa?.sameElem && p.eb === anc.eb) sc += 15;
      if (anc.aa?.sameCamp && p.campId === anc.campId) sc += 15;
      if ((p.aa?.roles || []).includes(anc.wt)) sc += 15;
      if (p.aa?.sameElem && p.eb === anc.eb) sc += 10;
      if (p.aa?.sameCamp && p.campId === anc.campId) sc += 10;
      if (p.id === "1311" || p.id === "1031") sc += 14;
      if (anc.wt === "Rupture" && (p.id === "1451" || p.id === "1421")) sc += 30;
      if (anc.wt === "Armorer" && (p.id === "1211" || p.id === "1621" || p.id === "1101")) sc += 30;
      if (anc.wt === "Anomaly" && (p.wt === "Anomaly" || p.id === "1411" || p.id === "1511")) sc += 22;
      if (anc.id === "1431" && p.prof?.has_ether_veil) sc += 25;
      if (anc.id === "1631" && p.eb === "Wind") sc += 25;
      return { p, sc };
    }).sort((a, b) => b.sc - a.sc).slice(0, anchorCid ? 18 : 8);
    const pList = scoredPartners.map(x => x.p);
    for (let i = 0; i < pList.length; i++) {
      for (let j = i + 1; j < pList.length; j++) {
        const trio = [anc, pList[i], pList[j]];
        const roleOrder = { Attack: 1, Rupture: 1, Armorer: 1, Anomaly: 2, Stun: 3, Defense: 4, Support: 5 };
        const ordered = [...trio].sort((a, b) => {
          if (anchorCid && a.id === anchorCid && roleOrder[a.wt] <= 2) return -1;
          if (anchorCid && b.id === anchorCid && roleOrder[b.wt] <= 2) return 1;
          return (roleOrder[a.wt] || 9) - (roleOrder[b.wt] || 9);
        });
        const key = ordered.map(x => x.id).sort().join("-");
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        if (!ordered.some(x => ["Attack","Anomaly","Rupture","Armorer"].includes(x.wt))) continue;
        const testSlots = ordered.map(x => makeSlot(x.id));
        if (testSlots[1]?.cid === "1311" && testSlots[2]?.cid && charMap[testSlots[2].cid]?.wt === "Support") {
          testSlots[1].fourPc = "静听";
          testSlots[2].fourPc = "月光";
        }
        const limGold = calcLimitedGold(testSlots, charMap, wepMap);
        if (limGold > maxSGold) continue;
        const res = simulateTeamV2(testSlots, env, charMap, wepMap, { fastMode: true });
        if (requireAllAA && res.aaLitCount < 3) continue;
        if (ordered.some(x => x.id === "1561") && !res.ctx.velinaVortexOk) continue;
        candidates.push({
          ids: ordered.map(x => x.id),
          names: ordered.map(x => x.n).join(" + "),
          camps: [...new Set(ordered.map(x => x.camp))].join("/"),
          slots: testSlots,
          teamDps: res.teamDps,
          cycleSec: res.cycleSec,
          aaLitCount: res.aaLitCount,
          limGold,
          shares: res.slotResults.map(s => ({ n: s.ch.n, pct: s.dpsShare, aa: s.aa.active }))
        });
      }
    }
  }
  candidates.sort((a, b) => b.teamDps - a.teamDps);
  return candidates.slice(0, limit);
}

/**
 * Generates 6 concrete Drive Disc pieces from a character's optimal/current auto allocation
 */
export function buildDefaultSixPieces(ch, fourPcId, twoPcId, d4, d5, d6, totalSubRolls = {}) {
  const s4 = (!fourPcId || fourPcId === "默认") ? ch.def4pc : fourPcId;
  const s2 = (!twoPcId || twoPcId === "默认") ? ch.def2pc : twoPcId;
  const sets = s4 === "无"
    ? ["啄木", "啄木", s2, s2, "激素", "激素"]
    : [s4, s4, s4, s4, s2, s2];
  const mains = ["HP_FLAT", "ATK_FLAT", "DEF_FLAT", d4 || "CR", d5 || "ELEM", d6 || "ATK%"];
  const pcs = mains.map((mn, idx) => ({
    set: sets[idx],
    main: mn,
    subs: { CR: 0, CD: 0, "ATK%": 0, ATK_FLAT: 0, "HP%": 0, HP_FLAT: 0, "DEF%": 0, DEF_FLAT: 0, AP: 0, PEN: 0 }
  }));
  let cursor = 0;
  for (const [k, v] of Object.entries(totalSubRolls || {})) {
    let rem = Math.max(0, Math.round(Number(v) || 0));
    while (rem > 0) {
      pcs[cursor % 6].subs[k] = (pcs[cursor % 6].subs[k] || 0) + 1;
      cursor++;
      rem--;
    }
  }
  return pcs;
}



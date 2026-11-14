import {
  DEFAULT_BANGBOOS,
  DEFAULT_CHARS,
  DEFAULT_DISC_SETS,
  DEFAULT_STAGE_BUFFS,
  DEFAULT_WEPS
} from "../data/defaults";
import {
  BANGBOOS,
  BANGBOO_MAP,
  CHAR_MAP,
  DISC_SETS,
  SC_CHARS,
  SC_WEPS,
  STAGE_BUFFS,
  WEP_LIST,
  customDB,
  deepClone,
  rebuildDataMaps,
  saveCustomDBToStorage
} from "../data/store";
import { ALL_ELEMENTS, ALL_SPECIALTIES, SN_ZH, escHtml } from "../engine/constants";
import { inspectWeaponPassiveMods } from "../engine/simulator";
import { ARCHETYPE_LABELS, SAFETY_LABELS, getCharSwapProfile } from "../engine/swapTimeline";
import { appStore, assignCharacterToSlot, triggerRefreshUI } from "./appState";

// --- MODULE: custom_workshop.js ---
// ============================================================================
// ZZZ v3.3 Full Custom Data Workshop ("全量自定义数据工坊")
// Edit all 62 Agents, 103 W-Engines, 31 Drive Sets, 20 Bangboos, Stage Buffs & Presets
// + Create / Clone / Reset / Export Custom Packs (Zero-Emoji Verified)
// ============================================================================

const WORKSHOP_STATE = {
  open: false,
  tab: "chars",        // "chars" | "weps" | "discSets" | "bangboos" | "presets"
  search: "",
  roleFilter: "ALL",
  selectedCharId: "1551",
  selectedWepId: "14155",
  selectedSetId: "沧浪",
  selectedBangbooId: "b_snap",
  selectedStageId: "shiyu_33_p1",
  statusMsg: ""
};


function isBuiltInChar(id) {
  return DEFAULT_CHARS.some(c => c.id === id);
}
function isBuiltInWep(id) {
  return !!DEFAULT_WEPS[id];
}
function isBuiltInSet(id) {
  return !!DEFAULT_DISC_SETS[id];
}
function isBuiltInBangboo(id) {
  return DEFAULT_BANGBOOS.some(b => b.id === id);
}
function isBuiltInStage(id) {
  return !!DEFAULT_STAGE_BUFFS[id];
}

export function openCustomWorkshop(tab = "chars", targetId = null) {
  WORKSHOP_STATE.open = true;
  if (tab) WORKSHOP_STATE.tab = tab;
  if (targetId) {
    if (tab === "chars" && CHAR_MAP[targetId]) WORKSHOP_STATE.selectedCharId = targetId;
    else if (tab === "weps" && SC_WEPS[targetId]) WORKSHOP_STATE.selectedWepId = targetId;
    else if (tab === "discSets" && DISC_SETS[targetId]) WORKSHOP_STATE.selectedSetId = targetId;
    else if (tab === "bangboos" && BANGBOO_MAP[targetId]) WORKSHOP_STATE.selectedBangbooId = targetId;
    else if (tab === "presets" && STAGE_BUFFS[targetId]) WORKSHOP_STATE.selectedStageId = targetId;
  }
  WORKSHOP_STATE.statusMsg = "";
  renderCustomWorkshopModal();
}

export function closeCustomWorkshop() {
  WORKSHOP_STATE.open = false;
  const modal = document.getElementById("workshopModal");
  if (modal) modal.hidden = true;
}

function flashWorkshopMsg(msg) {
  WORKSHOP_STATE.statusMsg = msg;
  const el = document.getElementById("wsStatusBanner");
  if (el) {
    el.textContent = msg;
    el.hidden = !msg;
  }
}

function applyCustomDBChanges(msg) {
  saveCustomDBToStorage();
  rebuildDataMaps();
  triggerRefreshUI();
  flashWorkshopMsg(msg);
  renderCustomWorkshopModal();
}

function createBlankCharTemplate(baseChar = null) {
  const uid = "c_usr_" + Date.now().toString(36).slice(-5);
  if (baseChar) {
    const cloned = deepClone(baseChar);
    cloned.id = uid;
    cloned.n = baseChar.n + "·改";
    cloned.isCustomNew = true;
    return cloned;
  }
  return {
    id: uid,
    n: "新自定义代理人",
    r: "S",
    isFreeS: false,
    isCustomNew: true,
    wt: "Attack",
    p: "强攻",
    e: "以太",
    eb: "Ether",
    anomBar: "Ether",
    campId: "99",
    camp: "自定义阵营",
    sig: "14155",
    pot: 0,
    defAssist: true,
    def4pc: "啄木",
    def2pc: "折枝",
    hp: 7800,
    atk: 920,
    def: 610,
    cp_hp: 0,
    cp_atk: 0,
    cr: 0.194,
    cd: 0.50,
    scd: 0,
    pen: 0,
    imp: 95,
    am: 94,
    ap: 95,
    er: 1.2,
    mvScale: 1.05,
    m_rec: "自定义测试模板",
    base_disc: "CR/ELEM/ATK%",
    cands: ["14155", "14132", "13015"],
    prof: {
      self_dmg: 0.35,
      self_cr: 0.0,
      self_cd: 0.30,
      self_catk: 0.0,
      self_catk_flat: 0,
      self_sheer_flat: 0,
      self_lac_dmg: 0,
      self_def_ign: 0,
      self_res_ign: 0,
      self_pen: 0,
      self_ap: 0,
      self_anom: 0,
      stun_share: 0.60,
      shares: { basic: 0.30, dash: 0.08, ex: 0.27, chain: 0.12, ult: 0.23, aftershock: 0 },
      has_aftershock: false,
      has_ether_veil: false,
      veil_vuln: false,
      triggers_abloom: false,
      triggers_refringe: false,
      loses_hp: false,
      jane_crit: false
    },
    aa: {
      roles: ["Support", "Stun"],
      sameElem: true,
      sameCamp: true,
      needDefAssist: false,
      condText: "支援 / 击破 / 同属性 / 同阵营",
      effText: "全伤害+30%，暴伤+35%"
    },
    customAA: {
      enabled: true,
      replaceBuiltin: true,
      dmg: 0.30,
      cr: 0,
      cd: 0.35,
      catk: 0,
      catk_flat: 0,
      ex: 0,
      ult: 0,
      anom: 0,
      res_ign: 0,
      buildup: 0,
      proc_mult: 1.0
    },
    customTeamBuff: {
      enabled: false,
      replaceBuiltin: false,
      appliesToSelf: true,
      targetRole: "ALL",
      targetElem: "ALL",
      atk_flat: 0, atk_pct: 0, hp_pct: 0, def_flat: 0, sheer: 0,
      dmg: 0, cr: 0, cd: 0, def_shred: 0, pen: 0, res_shred: 0,
      stun_mult: 0, stun_mult_alltime: 0, ap: 0, anom_dmg: 0, disorder_dmg: 0, buildup: 0, lac_dmg: 0,
      convFrom: "", convThreshold: 0, convRate: 0, convCap: 0, convTo: "atk_flat"
    },
    swapProfile: {
      archetype: "burst_commit",
      commitSec: 1.45,
      safety: "safe_iframe",
      channelPenalty: 0.0,
      cancelGain: 0.07,
      qaOut: 0.25,
      qaCoef: 0.05,
      heavySpeed: 0.78,
      note: "自定义代理人合轴帧数据"
    },
    m_stages: [
      { def_ign: 0.15, desc: "M1：无视15%防御力" },
      { def_ign: 0.15, dmg_all: 0.20, proc_mult: 1.06, desc: "M2：增伤+20%，动作倍率x1.06" },
      { def_ign: 0.15, dmg_all: 0.20, proc_mult: 1.06, skill_lv_mult: 1.091, daze_lv_mult: 1.061, desc: "M3：全技能等级+2" },
      { def_ign: 0.15, dmg_all: 0.20, c_cd: 0.30, proc_mult: 1.06, skill_lv_mult: 1.091, daze_lv_mult: 1.061, desc: "M4：局内暴伤+30%" },
      { def_ign: 0.15, dmg_all: 0.20, c_cd: 0.30, proc_mult: 1.06, skill_lv_mult: 1.1821, daze_lv_mult: 1.122, desc: "M5：全技能等级再+2" },
      { def_ign: 0.15, dmg_all: 0.20, c_cd: 0.30, res_ign: 0.20, proc_mult: 1.24, skill_lv_mult: 1.1821, daze_lv_mult: 1.122, desc: "M6：无视20%属性抗性，附加高倍率协同决算" }
    ]
  };
}

function createBlankWepTemplate(baseWep = null) {
  const uid = "w_usr_" + Date.now().toString(36).slice(-5);
  if (baseWep) {
    const cloned = deepClone(baseWep);
    cloned.id = uid;
    cloned.n = baseWep.n + "·改";
    cloned.customMods = inspectWeaponPassiveMods(baseWep);
    cloned.customMods.enabled = true;
    cloned.customMods.replaceBuiltin = true;
    return cloned;
  }
  return {
    id: uid,
    n: "新自定义音擎",
    r: "S",
    isFreeS: false,
    wt: "Attack",
    p: "强攻",
    batk: 713,
    bdef: 0,
    sn: "CRIT Rate",
    sv: 0.24,
    descR1: "自定义R1音擎特效描述",
    descR5: "自定义R5音擎特效描述",
    customMods: {
      enabled: true,
      replaceBuiltin: true,
      init_cr: 0, init_cd: 0.20, init_ap: 0, init_atk: 0, init_hp: 0, init_def: 0,
      c_atk: 0.12, c_cr: 0, c_cd: 0.25, c_def: 0, c_sheer: 0, c_ap: 0, c_er_flat: 0, c_imp_pct: 0,
      dmg_all: 0.25, dmg_basic: 0, dmg_dash: 0, dmg_ex: 0, dmg_ult: 0, dmg_anom: 0, dmg_disorder: 0, dmg_abloom: 0,
      def_ign: 0.15, res_ign: 0, daze_pct: 0, buildup: 0,
      t_atk_pct: 0, t_hp_pct: 0, t_dmg: 0, t_cr: 0, t_cd: 0, t_def_shred: 0, t_ap: 0, t_daze: 0
    }
  };
}

export function renderCustomWorkshopModal() {
  const modal = document.getElementById("workshopModal");
  if (!modal) return;
  modal.hidden = !WORKSHOP_STATE.open;
  if (!WORKSHOP_STATE.open) return;

  const modCharCount = Object.keys(customDB.chars || {}).length;
  const modWepCount = Object.keys(customDB.weps || {}).length;
  const modSetCount = Object.keys(customDB.discSets || {}).length;
  const modBbCount = Object.keys(customDB.bangboos || {}).length;
  const modPresetCount = (customDB.presetTeams || []).length + Object.keys(customDB.stageBuffs || {}).length;

  const tabs = [
    { id: "chars", label: `代理人角色库 (${SC_CHARS.length}${modCharCount ? ` · 已改${modCharCount}` : ""})` },
    { id: "weps", label: `音擎武器库 (${WEP_LIST.length}${modWepCount ? ` · 已改${modWepCount}` : ""})` },
    { id: "discSets", label: `驱动盘套装 (${Object.keys(DISC_SETS).length}${modSetCount ? ` · 已改${modSetCount}` : ""})` },
    { id: "bangboos", label: `4号位邦布 (${BANGBOOS.length}${modBbCount ? ` · 已改${modBbCount}` : ""})` },
    { id: "presets", label: `预设配队与深渊天气 (${modPresetCount ? `自建${modPresetCount}` : "管理"})` }
  ];

  let bodyHtml = "";
  if (WORKSHOP_STATE.tab === "chars") bodyHtml = renderCharWorkshopBody();
  else if (WORKSHOP_STATE.tab === "weps") bodyHtml = renderWepWorkshopBody();
  else if (WORKSHOP_STATE.tab === "discSets") bodyHtml = renderDiscSetWorkshopBody();
  else if (WORKSHOP_STATE.tab === "bangboos") bodyHtml = renderBangbooWorkshopBody();
  else bodyHtml = renderPresetStageWorkshopBody();

  modal.innerHTML = `
    <div class="ws-backdrop" data-ws-close="1"></div>
    <div class="ws-dialog" role="dialog" aria-modal="true" aria-labelledby="wsDialogTitle">
      <div class="ws-header">
        <div>
          <h2 id="wsDialogTitle" class="ws-title">全量自定义数据工坊 (Custom Data Studio)</h2>
          <p class="ws-sub">所有内置角色/音擎/驱动盘/邦布/天气的底层公式参数均可直接检视、覆写或克隆新建，修改自动持久化至本地浏览器并支持一键导出JSON数据包。</p>
        </div>
        <div class="row" style="gap:6px;">
          <button class="btn" id="wsExportPackBtn" title="仅导出自定义修改包">导出自定义包</button>
          <button class="btn" id="wsImportPackBtn" title="导入自定义JSON包">导入自定义包</button>
          <button class="btn btn-danger" id="wsResetAllCustomBtn" title="清空所有自定义修改恢复出厂">清空全部自定义</button>
          <button class="btn btn-primary" data-ws-close="1">完成并返回计算器</button>
        </div>
      </div>

      <div class="ws-tabs">
        ${tabs.map(t => `<button class="tab-btn ${WORKSHOP_STATE.tab === t.id ? "active" : ""}" data-ws-tab="${t.id}">${escHtml(t.label)}</button>`).join("")}
      </div>

      <div id="wsStatusBanner" class="ws-status" ${WORKSHOP_STATE.statusMsg ? "" : "hidden"}>${escHtml(WORKSHOP_STATE.statusMsg)}</div>

      <div class="ws-content">
        ${bodyHtml}
      </div>
    </div>
  `;

  bindWorkshopEvents(modal);
}

// ============================================================================
// 1. Character Workshop Tab
// ============================================================================
function renderCharWorkshopBody() {
  if (!CHAR_MAP[WORKSHOP_STATE.selectedCharId] && SC_CHARS.length > 0) {
    WORKSHOP_STATE.selectedCharId = SC_CHARS[0].id;
  }
  const ch = deepClone(CHAR_MAP[WORKSHOP_STATE.selectedCharId] || createBlankCharTemplate());
  const sp = getCharSwapProfile(ch);
  const prof = ch.prof || {};
  const sh = { basic: 0.30, dash: 0.10, ex: 0.25, chain: 0.12, ult: 0.23, aftershock: 0, ...(prof.shares || {}) };
  const asplit = prof.anom_split || { direct: 0.20, anom: 0.45, disorder: 0.35, abloom: 0 };
  const hasAnomSplit = !!prof.anom_split;
  const aa = ch.aa || { roles: [], sameElem: true, sameCamp: true, needDefAssist: false, condText: "", effText: "" };
  const caa = ch.customAA || { enabled: false, replaceBuiltin: false, dmg: 0, cr: 0, cd: 0, catk: 0, catk_flat: 0, ex: 0, ult: 0, anom: 0, res_ign: 0, buildup: 0, proc_mult: 1.0 };
  const ctb = ch.customTeamBuff || { enabled: false, replaceBuiltin: false, appliesToSelf: true, targetRole: "ALL", targetElem: "ALL", atk_flat: 0, atk_pct: 0, hp_pct: 0, def_flat: 0, sheer: 0, dmg: 0, cr: 0, cd: 0, def_shred: 0, pen: 0, res_shred: 0, stun_mult: 0, stun_mult_alltime: 0, ap: 0, anom_dmg: 0, disorder_dmg: 0, buildup: 0, lac_dmg: 0, convFrom: "", convThreshold: 0, convRate: 0, convCap: 0, convTo: "atk_flat" };

  const q = WORKSHOP_STATE.search.trim().toLowerCase();
  const filtered = SC_CHARS.filter(c => {
    if (WORKSHOP_STATE.roleFilter !== "ALL" && c.wt !== WORKSHOP_STATE.roleFilter) return false;
    if (q && !c.n.toLowerCase().includes(q) && !c.e.includes(q) && !c.p.includes(q) && !(c.camp || "").toLowerCase().includes(q)) return false;
    return true;
  });

  const isMod = !!customDB.chars[ch.id];
  const builtIn = isBuiltInChar(ch.id);

  const setOpts = Object.values(DISC_SETS).map(s => `<option value="${escHtml(s.id)}" ${ch.def4pc === s.id ? "selected" : ""}>${escHtml(s.name)}</option>`).join("");
  const set2Opts = Object.values(DISC_SETS).filter(s => s.id !== "无").map(s => `<option value="${escHtml(s.id)}" ${ch.def2pc === s.id ? "selected" : ""}>${escHtml(s.name)}</option>`).join("");
  const wepOpts = WEP_LIST.map(w => `<option value="${escHtml(w.id)}" ${ch.sig === w.id ? "selected" : ""}>[${w.r}·${w.p}] ${escHtml(w.n)}</option>`).join("");

  const mStages = Array.from({ length: 6 }, (_, idx) => ({
    desc: "", c_atk: 0, c_cr: 0, c_cd: 0, dmg_all: 0, def_ign: 0, res_ign: 0,
    proc_mult: 1, skill_lv_mult: idx >= 4 ? 1.1821 : (idx >= 2 ? 1.091 : 1),
    tb_dmg: 0, tb_def_shred: 0, tb_res_shred: 0, tb_cd: 0, tb_atk_flat: 0,
    ...(ch.m_stages?.[idx] || {})
  }));

  return `
    <div class="ws-split">
      <div class="ws-sidebar">
        <div class="row" style="gap:6px;margin-bottom:8px;">
          <input type="text" id="wsSearchInput" value="${escHtml(WORKSHOP_STATE.search)}" placeholder="搜索角色/属性/阵营..." style="flex:1;">
          <button class="btn btn-primary" id="wsNewCharBtn">+ 新建</button>
        </div>
        <div class="pill-bar" style="margin-bottom:8px;">
          <button class="pill ${WORKSHOP_STATE.roleFilter === "ALL" ? "active" : ""}" data-ws-rf="ALL">全部</button>
          ${ALL_SPECIALTIES.map(spItem => `<button class="pill ${WORKSHOP_STATE.roleFilter === spItem.wt ? "active" : ""}" data-ws-rf="${spItem.wt}">${spItem.zh}</button>`).join("")}
        </div>
        <div class="ws-item-list">
          ${filtered.map(c => {
            const modBadge = customDB.chars[c.id] ? (isBuiltInChar(c.id) ? `<span class="badge b-warn">已改</span>` : `<span class="badge b-info">自建</span>`) : "";
            return `
              <button class="ws-list-item ${c.id === ch.id ? "active" : ""}" data-ws-pick-char="${escHtml(c.id)}">
                <span class="elem-dot elem-${c.eb}"></span>
                <span class="ws-item-name">[${c.r}] ${escHtml(c.n)}</span>
                <span class="muted" style="font-size:11px;margin-left:auto;">${c.e}·${c.p}</span>
                ${modBadge}
              </button>
            `;
          }).join("")}
        </div>
      </div>

      <div class="ws-editor" id="wsCharForm">
        <div class="ws-editor-head">
          <div>
            <div class="row" style="gap:8px;">
              <strong style="font-size:16px;">${escHtml(ch.n)}</strong>
              <span class="badge">ID: ${escHtml(ch.id)}</span>
              ${isMod ? `<span class="badge b-warn">${builtIn ? "已覆写官方参数" : "自定义新建角色"}</span>` : `<span class="badge b-ok">官方默认数据</span>`}
            </div>
            <div class="muted" style="font-size:12px;margin-top:2px;">修改任意白值、自拐、队伍转模、合轴脱手帧或影画后点击右侧「保存角色修改」立即全局生效。</div>
          </div>
          <div class="row" style="gap:6px;">
            <button class="btn" id="wsPutSlot0Btn" title="直接放到1号位测试">上阵1号位</button>
            <button class="btn" id="wsCloneCharBtn">克隆为新角色</button>
            ${builtIn && isMod ? `<button class="btn btn-danger" id="wsRevertCharBtn">恢复官方默认</button>` : ""}
            ${!builtIn ? `<button class="btn btn-danger" id="wsDeleteCharBtn">删除此角色</button>` : ""}
            <button class="btn btn-primary" id="wsSaveCharBtn">保存角色修改</button>
          </div>
        </div>

        <div class="ws-section">
          <div class="ws-sec-title">一、基础档案与Lv.60面板白值</div>
          <div class="ws-grid-4">
            <label class="ws-field"><span>角色名称</span><input id="wc_n" type="text" value="${escHtml(ch.n)}"></label>
            <label class="ws-field"><span>品级稀有度</span>
              <select id="wc_r"><option value="S" ${ch.r === "S" ? "selected" : ""}>S级代理人</option><option value="A" ${ch.r === "A" ? "selected" : ""}>A级代理人</option></select>
            </label>
            <label class="ws-field"><span>战斗职业</span>
              <select id="wc_wt">${ALL_SPECIALTIES.map(x => `<option value="${x.wt}" ${ch.wt === x.wt ? "selected" : ""}>${x.zh} (${x.wt})</option>`).join("")}</select>
            </label>
            <label class="ws-field"><span>伤害属性</span>
              <select id="wc_eb">${ALL_ELEMENTS.map(x => `<option value="${x.eb}" ${ch.eb === x.eb ? "selected" : ""}>${x.zh} (${x.eb})</option>`).join("")}</select>
            </label>
            <label class="ws-field"><span>独立异常积蓄条</span>
              <select id="wc_anomBar">
                ${ALL_ELEMENTS.map(x => `<option value="${x.eb}" ${(ch.anomBar || ch.eb) === x.eb ? "selected" : ""}>${x.zh}积蓄槽</option>`).join("")}
                <option value="Frost" ${ch.anomBar === "Frost" ? "selected" : ""}>烈霜独立槽 (星见雅类)</option>
                <option value="AuricInk" ${ch.anomBar === "AuricInk" ? "selected" : ""}>玄墨独立槽 (仪玄类)</option>
                <option value="HonedEdge" ${ch.anomBar === "HonedEdge" ? "selected" : ""}>凛刃独立槽 (叶瞬光类)</option>
              </select>
            </label>
            <label class="ws-field"><span>所属阵营名称</span><input id="wc_camp" type="text" value="${escHtml(ch.camp || "未知阵营")}"></label>
            <label class="ws-field"><span>阵营匹配ID(同ID互亮)</span><input id="wc_campId" type="text" value="${escHtml(ch.campId || "99")}"></label>
            <label class="ws-field"><span>黄光支援形态</span>
              <select id="wc_defAssist">
                <option value="1" ${ch.defAssist ? "selected" : ""}>招架支援 (振刀弹反高削韧)</option>
                <option value="0" ${!ch.defAssist ? "selected" : ""}>回避支援 (极限视域时停)</option>
              </select>
            </label>
            <label class="ws-field"><span>绑定专属音擎</span><select id="wc_sig">${wepOpts}</select></label>
            <label class="ws-field"><span>默认推荐4件套</span><select id="wc_def4pc">${setOpts}</select></label>
            <label class="ws-field"><span>默认推荐2件套</span><select id="wc_def2pc">${set2Opts}</select></label>
            <label class="ws-field"><span>0金/常驻S标记</span>
              <select id="wc_isFreeS">
                <option value="0" ${!ch.isFreeS ? "selected" : ""}>限定UP卡池角色(计限定金)</option>
                <option value="1" ${ch.isFreeS ? "selected" : ""}>常驻S/主线赠送(0限定金)</option>
              </select>
            </label>
          </div>
          <div class="ws-grid-6" style="margin-top:8px;">
            <label class="ws-field"><span>基础生命 HP</span><input id="wc_hp" type="number" step="1" value="${ch.hp}"></label>
            <label class="ws-field"><span>基础攻击 ATK</span><input id="wc_atk" type="number" step="1" value="${ch.atk}"></label>
            <label class="ws-field"><span>基础防御 DEF</span><input id="wc_def" type="number" step="1" value="${ch.def}"></label>
            <label class="ws-field"><span>核心技攻击%</span><input id="wc_cp_atk" type="number" step="0.5" value="${Number(((ch.cp_atk || 0) * 100).toFixed(2))}"></label>
            <label class="ws-field"><span>核心技生命%</span><input id="wc_cp_hp" type="number" step="0.5" value="${Number(((ch.cp_hp || 0) * 100).toFixed(2))}"></label>
            <label class="ws-field"><span>基础暴击率%</span><input id="wc_cr" type="number" step="0.1" value="${Number(((ch.cr || 0.05) * 100).toFixed(2))}"></label>
            <label class="ws-field"><span>基础暴伤%</span><input id="wc_cd" type="number" step="0.1" value="${Number(((ch.cd || 0.50) * 100).toFixed(2))}"></label>
            <label class="ws-field"><span>基础撕裂伤%(锋御)</span><input id="wc_scd" type="number" step="0.1" value="${Number(((ch.scd || 0) * 100).toFixed(2))}"></label>
            <label class="ws-field"><span>基础穿透率%</span><input id="wc_pen" type="number" step="0.1" value="${Number(((ch.pen || 0) * 100).toFixed(2))}"></label>
            <label class="ws-field"><span>基础冲击力</span><input id="wc_imp" type="number" step="1" value="${ch.imp}"></label>
            <label class="ws-field"><span>基础异常掌控</span><input id="wc_am" type="number" step="1" value="${ch.am}"></label>
            <label class="ws-field"><span>基础异常精通</span><input id="wc_ap" type="number" step="1" value="${ch.ap}"></label>
            <label class="ws-field"><span>基础能量回复</span><input id="wc_er" type="number" step="0.05" value="${ch.er}"></label>
            <label class="ws-field"><span>总动作倍率系数(mvScale)</span><input id="wc_mvScale" type="number" step="0.02" value="${ch.mvScale ?? 1.0}"></label>
            <label class="ws-field" style="grid-column: span 4;"><span>抽取建议备注</span><input id="wc_m_rec" type="text" value="${escHtml(ch.m_rec || "")}"></label>
          </div>
        </div>

        <div class="ws-section">
          <div class="ws-sec-title">二、角色自身机制乘区、动作占比与异常构成 (prof)</div>
          <div class="ws-grid-6">
            <label class="ws-field"><span>自带增伤%</span><input id="wc_self_dmg" type="number" step="1" value="${Number(((prof.self_dmg || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>自带局内暴击%</span><input id="wc_self_cr" type="number" step="1" value="${Number(((prof.self_cr || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>自带局内暴伤%</span><input id="wc_self_cd" type="number" step="1" value="${Number(((prof.self_cd || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>自带局内攻击%</span><input id="wc_self_catk" type="number" step="1" value="${Number(((prof.self_catk || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>自带固定攻击</span><input id="wc_self_catk_flat" type="number" step="10" value="${prof.self_catk_flat || 0}"></label>
            <label class="ws-field"><span>自带固定贯穿(命破)</span><input id="wc_self_sheer_flat" type="number" step="10" value="${prof.self_sheer_flat || 0}"></label>
            <label class="ws-field"><span>自带撕裂伤%(锋御)</span><input id="wc_self_lac_dmg" type="number" step="1" value="${Number(((prof.self_lac_dmg || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>自带无视防御%</span><input id="wc_self_def_ign" type="number" step="1" value="${Number(((prof.self_def_ign || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>自带无视抗性%</span><input id="wc_self_res_ign" type="number" step="1" value="${Number(((prof.self_res_ign || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>自带穿透率%</span><input id="wc_self_pen" type="number" step="1" value="${Number(((prof.self_pen || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>自带局内精通</span><input id="wc_self_ap" type="number" step="5" value="${prof.self_ap || 0}"></label>
            <label class="ws-field"><span>默认失衡期占比%</span><input id="wc_stun_share" type="number" step="1" value="${Number(((prof.stun_share ?? 0.5) * 100).toFixed(0))}"></label>
          </div>

          <div class="ws-grid-6" style="margin-top:8px;">
            <label class="ws-field"><span>普攻占比%</span><input id="wc_sh_basic" type="number" step="1" value="${Math.round((sh.basic || 0) * 100)}"></label>
            <label class="ws-field"><span>闪反/冲刺占比%</span><input id="wc_sh_dash" type="number" step="1" value="${Math.round((sh.dash || 0) * 100)}"></label>
            <label class="ws-field"><span>强化E占比%</span><input id="wc_sh_ex" type="number" step="1" value="${Math.round((sh.ex || 0) * 100)}"></label>
            <label class="ws-field"><span>连携技占比%</span><input id="wc_sh_chain" type="number" step="1" value="${Math.round((sh.chain || 0) * 100)}"></label>
            <label class="ws-field"><span>终结技占比%</span><input id="wc_sh_ult" type="number" step="1" value="${Math.round((sh.ult || 0) * 100)}"></label>
            <label class="ws-field"><span>其中追击判定占比%</span><input id="wc_sh_as" type="number" step="1" value="${Math.round((sh.aftershock || 0) * 100)}"></label>
          </div>

          <div class="row" style="margin-top:8px;gap:12px;">
            <label class="chk-pill"><input type="checkbox" id="wc_f_as" ${prof.has_aftershock ? "checked" : ""}> 含追加攻击标签</label>
            <label class="chk-pill"><input type="checkbox" id="wc_f_veil" ${prof.has_ether_veil ? "checked" : ""}> 展开以太帷幕</label>
            <label class="chk-pill"><input type="checkbox" id="wc_f_vvuln" ${prof.veil_vuln ? "checked" : ""}> 帷幕常驻易伤(叶瞬光类)</label>
            <label class="chk-pill"><input type="checkbox" id="wc_f_abloom" ${prof.triggers_abloom ? "checked" : ""}> 触发异放机制</label>
            <label class="chk-pill"><input type="checkbox" id="wc_f_ref" ${prof.triggers_refringe ? "checked" : ""}> 触发流明耀化</label>
            <label class="chk-pill"><input type="checkbox" id="wc_f_hp" ${prof.loses_hp ? "checked" : ""}> 烧血扣血机制</label>
            <label class="chk-pill"><input type="checkbox" id="wc_f_jcrit" ${prof.jane_crit ? "checked" : ""}> 强击独立暴击(简类)</label>
          </div>

          <div class="subbox" style="margin-top:8px;">
            <label class="chk-pill" style="margin-bottom:6px;"><input type="checkbox" id="wc_has_anom_split" ${hasAnomSplit ? "checked" : ""}> 启用异常/紊乱/异放混合伤害公式 (勾选后按以下四分比结算)</label>
            <div class="ws-grid-4">
              <label class="ws-field"><span>直伤双暴权重%</span><input id="wc_as_direct" type="number" step="1" value="${Math.round((asplit.direct || 0) * 100)}"></label>
              <label class="ws-field"><span>属性异常结算权重%</span><input id="wc_as_anom" type="number" step="1" value="${Math.round((asplit.anom || 0) * 100)}"></label>
              <label class="ws-field"><span>紊乱爆发结算权重%</span><input id="wc_as_dis" type="number" step="1" value="${Math.round((asplit.disorder || 0) * 100)}"></label>
              <label class="ws-field"><span>异放协同结算权重%</span><input id="wc_as_ab" type="number" step="1" value="${Math.round((asplit.abloom || 0) * 100)}"></label>
            </div>
          </div>
        </div>

        <div class="ws-section">
          <div class="ws-sec-title">三、合轴动作物理模组 (Swap-Cancel Frame Profile)</div>
          <div class="ws-grid-4">
            <label class="ws-field"><span>合轴动作定位</span>
              <select id="wc_sp_arch">
                ${Object.entries(ARCHETYPE_LABELS).map(([k, v]) => `<option value="${k}" ${sp.archetype === k ? "selected" : ""}>${v}</option>`).join("")}
              </select>
            </label>
            <label class="ws-field"><span>单次脱手驻场时长(秒)</span><input id="wc_sp_commit" type="number" step="0.05" value="${sp.commitSec ?? 1.25}"></label>
            <label class="ws-field"><span>脱手帧安全属性</span>
              <select id="wc_sp_safety">
                ${Object.entries(SAFETY_LABELS).map(([k, v]) => `<option value="${k}" ${sp.safety === k ? "selected" : ""}>${v}</option>`).join("")}
              </select>
            </label>
            <label class="ws-field"><span>持续引导强切丢伤率(0~0.6)</span><input id="wc_sp_chan" type="number" step="0.02" value="${sp.channelPenalty ?? 0}"></label>
            <label class="ws-field"><span>预输入/闪A取消后摇收益%</span><input id="wc_sp_cancel" type="number" step="0.5" value="${Number(((sp.cancelGain ?? 0.06) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>每轮产出快速支援次数</span><input id="wc_sp_qaout" type="number" step="0.1" value="${sp.qaOut ?? 0.3}"></label>
            <label class="ws-field"><span>吃快支入场收益系数%</span><input id="wc_sp_qacoef" type="number" step="0.5" value="${Number(((sp.qaCoef ?? 0.04) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>手动取消重击点连携耗时(秒)</span><input id="wc_sp_heavy" type="number" step="0.05" value="${sp.heavySpeed ?? 0.78}"></label>
            <label class="ws-field" style="grid-column: span 4;"><span>合轴细节备注说明</span><input id="wc_sp_note" type="text" value="${escHtml(sp.note || "")}"></label>
          </div>
        </div>

        <div class="ws-section">
          <div class="ws-sec-title">四、额外能力触发条件与自定义增益 (AA & Custom AA)</div>
          <div class="row" style="gap:10px;margin-bottom:8px;">
            <span style="font-size:12px;font-weight:600;">组队点亮条件：</span>
            <label class="chk-pill"><input type="checkbox" id="wc_aa_elem" ${aa.sameElem ? "checked" : ""}> 同属性队友</label>
            <label class="chk-pill"><input type="checkbox" id="wc_aa_camp" ${aa.sameCamp ? "checked" : ""}> 同阵营队友</label>
            <label class="chk-pill"><input type="checkbox" id="wc_aa_defa" ${aa.needDefAssist ? "checked" : ""}> 任意招架支援队友</label>
            ${ALL_SPECIALTIES.map(x => `<label class="chk-pill"><input type="checkbox" class="wc_aa_role" value="${x.wt}" ${(aa.roles || []).includes(x.wt) ? "checked" : ""}> ${x.zh}队友</label>`).join("")}
          </div>
          <div class="ws-grid-2" style="margin-bottom:8px;">
            <label class="ws-field"><span>条件展示文本</span><input id="wc_aa_cond" type="text" value="${escHtml(aa.condText || "")}"></label>
            <label class="ws-field"><span>效果说明文本</span><input id="wc_aa_eff" type="text" value="${escHtml(aa.effText || "")}"></label>
          </div>
          <div class="subbox">
            <div class="row" style="gap:14px;margin-bottom:6px;">
              <label class="chk-pill"><input type="checkbox" id="wc_caa_on" ${caa.enabled ? "checked" : ""}> 启用自定义额外能力数值</label>
              <label class="chk-pill"><input type="checkbox" id="wc_caa_rep" ${caa.replaceBuiltin ? "checked" : ""}> 覆盖内置角色额外能力逻辑(不勾选则为叠加补正)</label>
            </div>
            <div class="ws-grid-6">
              <label class="ws-field"><span>点亮增伤%</span><input id="wc_caa_dmg" type="number" step="1" value="${Number(((caa.dmg || 0) * 100).toFixed(1))}"></label>
              <label class="ws-field"><span>点亮暴击%</span><input id="wc_caa_cr" type="number" step="1" value="${Number(((caa.cr || 0) * 100).toFixed(1))}"></label>
              <label class="ws-field"><span>点亮暴伤%</span><input id="wc_caa_cd" type="number" step="1" value="${Number(((caa.cd || 0) * 100).toFixed(1))}"></label>
              <label class="ws-field"><span>固定攻击+</span><input id="wc_caa_atkf" type="number" step="20" value="${caa.catk_flat || 0}"></label>
              <label class="ws-field"><span>无视抗性%</span><input id="wc_caa_res" type="number" step="1" value="${Number(((caa.res_ign || 0) * 100).toFixed(1))}"></label>
              <label class="ws-field"><span>独立倍率乘区</span><input id="wc_caa_proc" type="number" step="0.02" value="${caa.proc_mult ?? 1.0}"></label>
            </div>
          </div>
        </div>

        <div class="ws-section">
          <div class="ws-sec-title">五、全队拐力光环与动态面板转模器 (Custom Team Buffs)</div>
          <div class="row" style="gap:14px;margin-bottom:8px;">
            <label class="chk-pill"><input type="checkbox" id="wc_ctb_on" ${ctb.enabled ? "checked" : ""}> 启用自定义团队拐力</label>
            <label class="chk-pill"><input type="checkbox" id="wc_ctb_rep" ${ctb.replaceBuiltin ? "checked" : ""}> 完全替换内置拐力公式</label>
            <label class="chk-pill"><input type="checkbox" id="wc_ctb_self" ${ctb.appliesToSelf !== false ? "checked" : ""}> 光环同样作用于自身</label>
            <label class="ws-field" style="flex-direction:row;align-items:center;gap:4px;"><span>限定受拐职业:</span>
              <select id="wc_ctb_role"><option value="ALL">不限职业(全队)</option>${ALL_SPECIALTIES.map(x => `<option value="${x.wt}" ${ctb.targetRole === x.wt ? "selected" : ""}>仅${x.zh}</option>`).join("")}</select>
            </label>
            <label class="ws-field" style="flex-direction:row;align-items:center;gap:4px;"><span>限定受拐属性:</span>
              <select id="wc_ctb_elem"><option value="ALL">不限属性(全队)</option>${ALL_ELEMENTS.map(x => `<option value="${x.eb}" ${ctb.targetElem === x.eb ? "selected" : ""}>仅${x.zh}</option>`).join("")}</select>
            </label>
          </div>
          <div class="ws-grid-6">
            <label class="ws-field"><span>全队固定攻击</span><input id="wc_ctb_atkf" type="number" step="50" value="${ctb.atk_flat || 0}"></label>
            <label class="ws-field"><span>全队攻击%</span><input id="wc_ctb_atkp" type="number" step="1" value="${Number(((ctb.atk_pct || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队贯穿力</span><input id="wc_ctb_sheer" type="number" step="20" value="${ctb.sheer || 0}"></label>
            <label class="ws-field"><span>全队增伤%</span><input id="wc_ctb_dmg" type="number" step="1" value="${Number(((ctb.dmg || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队暴击%</span><input id="wc_ctb_cr" type="number" step="1" value="${Number(((ctb.cr || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队暴伤%</span><input id="wc_ctb_cd" type="number" step="1" value="${Number(((ctb.cd || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>减防/无视防%</span><input id="wc_ctb_shred" type="number" step="1" value="${Number(((ctb.def_shred || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队穿透率%</span><input id="wc_ctb_pen" type="number" step="1" value="${Number(((ctb.pen || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队减抗%</span><input id="wc_ctb_res" type="number" step="1" value="${Number(((ctb.res_shred || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>失衡期易伤%</span><input id="wc_ctb_stun" type="number" step="1" value="${Number(((ctb.stun_mult || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全程易伤%(扳机类)</span><input id="wc_ctb_stuna" type="number" step="1" value="${Number(((ctb.stun_mult_alltime || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队精通+</span><input id="wc_ctb_ap" type="number" step="10" value="${ctb.ap || 0}"></label>
          </div>
          <div class="subbox" style="margin-top:8px;">
            <div style="font-size:11px;font-weight:700;margin-bottom:6px;">动态局外属性转模规则（例：局外攻击 * 0.35 -> 固定攻击，上限1200）</div>
            <div class="ws-grid-5">
              <label class="ws-field"><span>来源局外属性</span>
                <select id="wc_ctb_cfrom">
                  <option value="">不启用动态转模</option>
                  <option value="init_atk" ${ctb.convFrom === "init_atk" ? "selected" : ""}>局外初始攻击 (init_atk)</option>
                  <option value="init_hp" ${ctb.convFrom === "init_hp" ? "selected" : ""}>局外初始生命 (init_hp)</option>
                  <option value="init_def" ${ctb.convFrom === "init_def" ? "selected" : ""}>局外初始防御 (init_def)</option>
                  <option value="init_cr" ${ctb.convFrom === "init_cr" ? "selected" : ""}>局外暴击率小数 (init_cr)</option>
                  <option value="init_am" ${ctb.convFrom === "init_am" ? "selected" : ""}>局外异常掌控 (init_am)</option>
                  <option value="init_er" ${ctb.convFrom === "init_er" ? "selected" : ""}>局外能量回复 (init_er)</option>
                  <option value="init_imp" ${ctb.convFrom === "init_imp" ? "selected" : ""}>局外冲击力 (init_imp)</option>
                  <option value="init_pen" ${ctb.convFrom === "init_pen" ? "selected" : ""}>局外穿透率小数 (init_pen)</option>
                </select>
              </label>
              <label class="ws-field"><span>起算阈值(超出部分参与)</span><input id="wc_ctb_cth" type="number" step="any" value="${ctb.convThreshold || 0}"></label>
              <label class="ws-field"><span>转化倍率系数(Rate)</span><input id="wc_ctb_crate" type="number" step="any" value="${ctb.convRate || 0}"></label>
              <label class="ws-field"><span>转化封顶上限(0=无上限)</span><input id="wc_ctb_ccap" type="number" step="any" value="${ctb.convCap || 0}"></label>
              <label class="ws-field"><span>注入目标乘区</span>
                <select id="wc_ctb_cto">
                  <option value="atk_flat" ${ctb.convTo === "atk_flat" ? "selected" : ""}>固定攻击 (atk_flat)</option>
                  <option value="sheer" ${ctb.convTo === "sheer" ? "selected" : ""}>贯穿力 (sheer)</option>
                  <option value="dmg" ${ctb.convTo === "dmg" ? "selected" : ""}>增伤小数 (dmg)</option>
                  <option value="cd" ${ctb.convTo === "cd" ? "selected" : ""}>暴伤小数 (cd)</option>
                  <option value="cr" ${ctb.convTo === "cr" ? "selected" : ""}>暴击小数 (cr)</option>
                  <option value="def_shred" ${ctb.convTo === "def_shred" ? "selected" : ""}>减防小数 (def_shred)</option>
                  <option value="anom_dmg" ${ctb.convTo === "anom_dmg" ? "selected" : ""}>异常增伤小数 (anom_dmg)</option>
                  <option value="lac_dmg" ${ctb.convTo === "lac_dmg" ? "selected" : ""}>撕裂伤小数 (lac_dmg)</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div class="ws-section">
          <div class="ws-sec-title">六、影画 M1 ~ M6 累计增益表 (m_stages 每一阶代表处于该影画时的累计总加成)</div>
          <div class="table-wrap">
            <table class="ws-mtable">
              <thead>
                <tr>
                  <th>阶数</th><th>影画描述</th><th>自暴击%</th><th>自暴伤%</th><th>自增伤%</th><th>无视防%</th><th>无视抗%</th><th>动作乘算</th><th>技能Lv乘算</th><th>队增伤%</th><th>队减防%</th><th>队减抗%</th>
                </tr>
              </thead>
              <tbody>
                ${mStages.map((ms, idx) => `
                  <tr>
                    <td><strong>M${idx + 1}</strong></td>
                    <td><input type="text" id="wm_${idx}_desc" value="${escHtml(ms.desc || "")}" style="min-width:180px;"></td>
                    <td><input type="number" step="1" id="wm_${idx}_cr" value="${Number(((ms.c_cr || 0) * 100).toFixed(1))}" style="width:58px;"></td>
                    <td><input type="number" step="1" id="wm_${idx}_cd" value="${Number(((ms.c_cd || 0) * 100).toFixed(1))}" style="width:58px;"></td>
                    <td><input type="number" step="1" id="wm_${idx}_dmg" value="${Number(((ms.dmg_all || 0) * 100).toFixed(1))}" style="width:58px;"></td>
                    <td><input type="number" step="1" id="wm_${idx}_def" value="${Number(((ms.def_ign || 0) * 100).toFixed(1))}" style="width:58px;"></td>
                    <td><input type="number" step="1" id="wm_${idx}_res" value="${Number(((ms.res_ign || 0) * 100).toFixed(1))}" style="width:58px;"></td>
                    <td><input type="number" step="0.02" id="wm_${idx}_proc" value="${Number((ms.proc_mult ?? 1).toFixed(3))}" style="width:64px;"></td>
                    <td><input type="number" step="0.01" id="wm_${idx}_sklv" value="${Number((ms.skill_lv_mult ?? 1).toFixed(4))}" style="width:68px;"></td>
                    <td><input type="number" step="1" id="wm_${idx}_tdmg" value="${Number(((ms.tb_dmg || 0) * 100).toFixed(1))}" style="width:58px;"></td>
                    <td><input type="number" step="1" id="wm_${idx}_tdef" value="${Number(((ms.tb_def_shred || 0) * 100).toFixed(1))}" style="width:58px;"></td>
                    <td><input type="number" step="1" id="wm_${idx}_tres" value="${Number(((ms.tb_res_shred || 0) * 100).toFixed(1))}" style="width:58px;"></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 2. W-Engine Workshop Tab
// ============================================================================
function renderWepWorkshopBody() {
  if (!SC_WEPS[WORKSHOP_STATE.selectedWepId] && WEP_LIST.length > 0) {
    WORKSHOP_STATE.selectedWepId = WEP_LIST[0].id;
  }
  const w = deepClone(SC_WEPS[WORKSHOP_STATE.selectedWepId] || createBlankWepTemplate());
  const cm = inspectWeaponPassiveMods(w);
  if (w.customMods) Object.assign(cm, w.customMods);

  const q = WORKSHOP_STATE.search.trim().toLowerCase();
  const filtered = WEP_LIST.filter(item => {
    if (WORKSHOP_STATE.roleFilter !== "ALL" && item.wt !== WORKSHOP_STATE.roleFilter) return false;
    if (q && !item.n.toLowerCase().includes(q) && !item.p.includes(q)) return false;
    return true;
  });

  const isMod = !!customDB.weps[w.id];
  const builtIn = isBuiltInWep(w.id);
  const subNames = ["CRIT Rate", "CRIT DMG", "ATK", "HP", "DEF", "PEN Ratio", "Impact", "Anomaly Mastery", "Anomaly Proficiency", "Energy Regen"];

  return `
    <div class="ws-split">
      <div class="ws-sidebar">
        <div class="row" style="gap:6px;margin-bottom:8px;">
          <input type="text" id="wsSearchInput" value="${escHtml(WORKSHOP_STATE.search)}" placeholder="搜索音擎名称/职业..." style="flex:1;">
          <button class="btn btn-primary" id="wsNewWepBtn">+ 新建</button>
        </div>
        <div class="pill-bar" style="margin-bottom:8px;">
          <button class="pill ${WORKSHOP_STATE.roleFilter === "ALL" ? "active" : ""}" data-ws-rf="ALL">全部</button>
          ${ALL_SPECIALTIES.map(spItem => `<button class="pill ${WORKSHOP_STATE.roleFilter === spItem.wt ? "active" : ""}" data-ws-rf="${spItem.wt}">${spItem.zh}</button>`).join("")}
        </div>
        <div class="ws-item-list">
          ${filtered.map(item => {
            const modBadge = customDB.weps[item.id] ? (isBuiltInWep(item.id) ? `<span class="badge b-warn">已改</span>` : `<span class="badge b-info">自建</span>`) : "";
            return `
              <button class="ws-list-item ${item.id === w.id ? "active" : ""}" data-ws-pick-wep="${escHtml(item.id)}">
                <span class="ws-item-name">[${item.r}] ${escHtml(item.n)}</span>
                <span class="muted" style="font-size:11px;margin-left:auto;">${item.p}</span>
                ${modBadge}
              </button>
            `;
          }).join("")}
        </div>
      </div>

      <div class="ws-editor">
        <div class="ws-editor-head">
          <div>
            <div class="row" style="gap:8px;">
              <strong style="font-size:16px;">${escHtml(w.n)}</strong>
              <span class="badge">ID: ${escHtml(w.id)}</span>
              ${isMod ? `<span class="badge b-warn">${builtIn ? "已覆写参数" : "自定义新建音擎"}</span>` : `<span class="badge b-ok">官方默认参数</span>`}
            </div>
            <div class="muted" style="font-size:12px;margin-top:2px;">下方特效数值已预填该音擎在S级R1(或A级R5)满触发下的等效乘区，开启自定义覆写即可任意精调或自创音擎。</div>
          </div>
          <div class="row" style="gap:6px;">
            <button class="btn" id="wsCloneWepBtn">克隆为新音擎</button>
            ${builtIn && isMod ? `<button class="btn btn-danger" id="wsRevertWepBtn">恢复官方默认</button>` : ""}
            <button class="btn btn-primary" id="wsSaveWepBtn">保存音擎修改</button>
          </div>
        </div>

        <div class="ws-section">
          <div class="ws-sec-title">一、音擎基础面板与高级属性 (Lv.60)</div>
          <div class="ws-grid-4">
            <label class="ws-field"><span>音擎名称</span><input id="ww_n" type="text" value="${escHtml(w.n)}"></label>
            <label class="ws-field"><span>品级稀有度</span>
              <select id="ww_r">
                <option value="S" ${w.r === "S" ? "selected" : ""}>S级音擎 (R1->R5按1.0~1.6倍成长)</option>
                <option value="A" ${w.r === "A" ? "selected" : ""}>A级音擎 (R1->R5按0.625~1.0倍成长)</option>
                <option value="B" ${w.r === "B" ? "selected" : ""}>B级音擎</option>
              </select>
            </label>
            <label class="ws-field"><span>生效职业限制</span>
              <select id="ww_wt">${ALL_SPECIALTIES.map(x => `<option value="${x.wt}" ${w.wt === x.wt ? "selected" : ""}>${x.zh} (${x.wt})</option>`).join("")}</select>
            </label>
            <label class="ws-field"><span>常驻/0金获取标记</span>
              <select id="ww_free">
                <option value="0" ${!w.isFreeS ? "selected" : ""}>限定音擎池抽取(计限定金)</option>
                <option value="1" ${w.isFreeS ? "selected" : ""}>常驻S/商店兑换/赠送(0限定金)</option>
              </select>
            </label>
            <label class="ws-field"><span>Lv.60 基础攻击力</span><input id="ww_batk" type="number" step="1" value="${w.batk || 0}"></label>
            <label class="ws-field"><span>Lv.60 基础防御力(锋御专)</span><input id="ww_bdef" type="number" step="1" value="${w.bdef || 0}"></label>
            <label class="ws-field"><span>高级副词条类型</span>
              <select id="ww_sn">${subNames.map(sn => `<option value="${sn}" ${w.sn === sn ? "selected" : ""}>${SN_ZH[sn] || sn} (${sn})</option>`).join("")}</select>
            </label>
            <label class="ws-field"><span>副词条满级值(百分比填小数如0.24，精通填90)</span><input id="ww_sv" type="number" step="any" value="${w.sv || 0}"></label>
            <label class="ws-field" style="grid-column:span 2;"><span>R1 特效原文/备注</span><input id="ww_dr1" type="text" value="${escHtml(w.descR1 || "")}"></label>
            <label class="ws-field" style="grid-column:span 2;"><span>R5 特效原文/备注</span><input id="ww_dr5" type="text" value="${escHtml(w.descR5 || "")}"></label>
          </div>
        </div>

        <div class="ws-section">
          <div class="ws-sec-title">二、音擎被动乘区自定义 (S级填R1基准，A级填R5基准，引擎自动随精炼阶数线性缩放)</div>
          <div class="row" style="gap:14px;margin-bottom:8px;">
            <label class="chk-pill"><input type="checkbox" id="ww_cm_on" ${cm.enabled ? "checked" : ""}> 启用以下自定义被动乘区</label>
            <label class="chk-pill"><input type="checkbox" id="ww_cm_rep" ${cm.replaceBuiltin !== false ? "checked" : ""}> 完全替换内置音擎特效代码</label>
          </div>
          <div class="ws-grid-6">
            <label class="ws-field"><span>被动局外暴击%</span><input id="ww_init_cr" type="number" step="1" value="${Number(((cm.init_cr || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>被动局外暴伤%</span><input id="ww_init_cd" type="number" step="1" value="${Number(((cm.init_cd || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>被动局外精通</span><input id="ww_init_ap" type="number" step="5" value="${cm.init_ap || 0}"></label>
            <label class="ws-field"><span>局内攻击%</span><input id="ww_c_atk" type="number" step="1" value="${Number(((cm.c_atk || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>局内暴击%</span><input id="ww_c_cr" type="number" step="1" value="${Number(((cm.c_cr || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>局内暴伤%</span><input id="ww_c_cd" type="number" step="1" value="${Number(((cm.c_cd || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>局内防御%</span><input id="ww_c_def" type="number" step="1" value="${Number(((cm.c_def || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>局内贯穿力+</span><input id="ww_c_sheer" type="number" step="10" value="${cm.c_sheer || 0}"></label>
            <label class="ws-field"><span>局内精通+</span><input id="ww_c_ap" type="number" step="5" value="${cm.c_ap || 0}"></label>
            <label class="ws-field"><span>局内回能+(点/s)</span><input id="ww_c_er" type="number" step="0.05" value="${cm.c_er_flat || 0}"></label>
            <label class="ws-field"><span>局内冲击力%</span><input id="ww_c_imp" type="number" step="1" value="${Number(((cm.c_imp_pct || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全类型增伤%</span><input id="ww_dmg_all" type="number" step="1" value="${Number(((cm.dmg_all || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>普攻增伤%</span><input id="ww_dmg_basic" type="number" step="1" value="${Number(((cm.dmg_basic || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>强化E增伤%</span><input id="ww_dmg_ex" type="number" step="1" value="${Number(((cm.dmg_ex || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>终结技增伤%</span><input id="ww_dmg_ult" type="number" step="1" value="${Number(((cm.dmg_ult || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>异常增伤%</span><input id="ww_dmg_anom" type="number" step="1" value="${Number(((cm.dmg_anom || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>紊乱增伤%</span><input id="ww_dmg_dis" type="number" step="1" value="${Number(((cm.dmg_disorder || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>异放增伤%</span><input id="ww_dmg_ab" type="number" step="1" value="${Number(((cm.dmg_abloom || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>无视防御%</span><input id="ww_def_ign" type="number" step="1" value="${Number(((cm.def_ign || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>无视抗性%</span><input id="ww_res_ign" type="number" step="1" value="${Number(((cm.res_ign || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>招式失衡值%</span><input id="ww_daze" type="number" step="1" value="${Number(((cm.daze_pct || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>异常积蓄效率%</span><input id="ww_buildup" type="number" step="1" value="${Number(((cm.buildup || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队攻击光环%</span><input id="ww_t_atk" type="number" step="1" value="${Number(((cm.t_atk_pct || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队增伤光环%</span><input id="ww_t_dmg" type="number" step="1" value="${Number(((cm.t_dmg || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队暴击光环%</span><input id="ww_t_cr" type="number" step="1" value="${Number(((cm.t_cr || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队暴伤光环%</span><input id="ww_t_cd" type="number" step="1" value="${Number(((cm.t_cd || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队减防光环%</span><input id="ww_t_shred" type="number" step="1" value="${Number(((cm.t_def_shred || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队精通光环+</span><input id="ww_t_ap" type="number" step="5" value="${cm.t_ap || 0}"></label>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 3. Drive Set Workshop Tab
// ============================================================================
function renderDiscSetWorkshopBody() {
  const allSets = Object.values(DISC_SETS);
  if (!DISC_SETS[WORKSHOP_STATE.selectedSetId] && allSets.length > 0) {
    WORKSHOP_STATE.selectedSetId = allSets[0].id;
  }
  const ds = deepClone(DISC_SETS[WORKSHOP_STATE.selectedSetId] || { id: "s_usr_1", name: "新自定义套装", cat: "输出", d2: "", d4: "" });
  const cm = ds.customMods || { enabled: false, replaceBuiltin: false, d2: {}, d4Self: {}, d4Team: {} };
  const d2 = cm.d2 || {}, d4s = cm.d4Self || {}, d4t = cm.d4Team || {};
  const isMod = !!customDB.discSets[ds.id];
  const builtIn = isBuiltInSet(ds.id);

  return `
    <div class="ws-split">
      <div class="ws-sidebar">
        <div class="row" style="gap:6px;margin-bottom:8px;">
          <button class="btn btn-primary" id="wsNewSetBtn" style="width:100%;">+ 新建自定义驱动盘套装</button>
        </div>
        <div class="ws-item-list">
          ${allSets.map(s => `
            <button class="ws-list-item ${s.id === ds.id ? "active" : ""}" data-ws-pick-set="${escHtml(s.id)}">
              <span class="ws-item-name">${escHtml(s.name)}</span>
              <span class="muted" style="font-size:11px;margin-left:auto;">${escHtml(s.cat || "通用")}</span>
              ${customDB.discSets[s.id] ? `<span class="badge b-warn">已改</span>` : ""}
            </button>
          `).join("")}
        </div>
      </div>

      <div class="ws-editor">
        <div class="ws-editor-head">
          <div>
            <strong style="font-size:16px;">${escHtml(ds.name)} (键: ${escHtml(ds.id)})</strong>
            <div class="muted" style="font-size:12px;">支持自定义 2件套属性、4件套自身增幅以及 4件套全队光环(含同名防撞车检测)。</div>
          </div>
          <div class="row" style="gap:6px;">
            ${builtIn && isMod ? `<button class="btn btn-danger" id="wsRevertSetBtn">恢复官方默认</button>` : ""}
            <button class="btn btn-primary" id="wsSaveSetBtn">保存套装修改</button>
          </div>
        </div>

        <div class="ws-section">
          <div class="ws-sec-title">一、套装档案与说明</div>
          <div class="ws-grid-4">
            <label class="ws-field"><span>套装全称</span><input id="ws_ds_name" type="text" value="${escHtml(ds.name)}"></label>
            <label class="ws-field"><span>分类标签</span><input id="ws_ds_cat" type="text" value="${escHtml(ds.cat || "输出")}"></label>
            <label class="ws-field"><span>4件套职业限制</span>
              <select id="ws_ds_role"><option value="">无职业限制</option>${ALL_SPECIALTIES.map(x => `<option value="${x.wt}" ${ds.roleReq === x.wt ? "selected" : ""}>仅限${x.zh}生效</option>`).join("")}</select>
            </label>
            <label class="ws-field"><span>套装短键ID</span><input type="text" value="${escHtml(ds.id)}" disabled></label>
            <label class="ws-field" style="grid-column:span 2;"><span>2件套文本说明</span><input id="ws_ds_d2txt" type="text" value="${escHtml(ds.d2 || "")}"></label>
            <label class="ws-field" style="grid-column:span 2;"><span>4件套文本说明</span><input id="ws_ds_d4txt" type="text" value="${escHtml(ds.d4 || "")}"></label>
          </div>
        </div>

        <div class="ws-section">
          <div class="ws-sec-title">二、套装数值乘区自定义</div>
          <div class="row" style="gap:14px;margin-bottom:8px;">
            <label class="chk-pill"><input type="checkbox" id="ws_ds_on" ${cm.enabled ? "checked" : ""}> 启用自定义套装数值</label>
            <label class="chk-pill"><input type="checkbox" id="ws_ds_rep" ${cm.replaceBuiltin !== false ? "checked" : ""}> 覆盖内置套装逻辑</label>
          </div>
          <div style="font-size:12px;font-weight:700;margin-bottom:4px;">2件套局外加成：</div>
          <div class="ws-grid-6">
            <label class="ws-field"><span>暴击率%</span><input id="ws_d2_cr" type="number" step="1" value="${Number(((d2.init_cr || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>暴伤%</span><input id="ws_d2_cd" type="number" step="1" value="${Number(((d2.init_cd || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>大攻击%</span><input id="ws_d2_atk" type="number" step="1" value="${Number(((d2.init_atk || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>大生命%</span><input id="ws_d2_hp" type="number" step="1" value="${Number(((d2.init_hp || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>大防御%</span><input id="ws_d2_def" type="number" step="1" value="${Number(((d2.init_def || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>属性增伤%</span><input id="ws_d2_elem" type="number" step="1" value="${Number(((d2.dmg_elem || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>穿透率%</span><input id="ws_d2_pen" type="number" step="1" value="${Number(((d2.init_pen || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>异常精通+</span><input id="ws_d2_ap" type="number" step="5" value="${d2.init_ap || 0}"></label>
            <label class="ws-field"><span>异常掌控%</span><input id="ws_d2_am" type="number" step="1" value="${Number(((d2.init_am || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>回能%</span><input id="ws_d2_er" type="number" step="1" value="${Number(((d2.init_er || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>冲击力%</span><input id="ws_d2_imp" type="number" step="1" value="${Number(((d2.init_imp || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>失衡值%</span><input id="ws_d2_daze" type="number" step="1" value="${Number(((d2.daze_pct || 0) * 100).toFixed(1))}"></label>
          </div>
          <div style="font-size:12px;font-weight:700;margin:10px 0 4px;">4件套装备者自身局内加成：</div>
          <div class="ws-grid-6">
            <label class="ws-field"><span>局内攻击%</span><input id="ws_d4s_atk" type="number" step="1" value="${Number(((d4s.c_atk || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>局内暴击%</span><input id="ws_d4s_cr" type="number" step="1" value="${Number(((d4s.c_cr || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>局内暴伤%</span><input id="ws_d4s_cd" type="number" step="1" value="${Number(((d4s.c_cd || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>局内精通+</span><input id="ws_d4s_ap" type="number" step="5" value="${d4s.c_ap || 0}"></label>
            <label class="ws-field"><span>全伤害%</span><input id="ws_d4s_dmg" type="number" step="1" value="${Number(((d4s.dmg_all || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>贯穿独立增伤%</span><input id="ws_d4s_sheer" type="number" step="1" value="${Number(((d4s.dmg_sheer || 0) * 100).toFixed(1))}"></label>
          </div>
          <div style="font-size:12px;font-weight:700;margin:10px 0 4px;">4件套全队光环加成 (同名唯一不叠加)：</div>
          <div class="ws-grid-5">
            <label class="ws-field"><span>全队增伤%</span><input id="ws_d4t_dmg" type="number" step="1" value="${Number(((d4t.dmg || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队暴伤%</span><input id="ws_d4t_cd" type="number" step="1" value="${Number(((d4t.cd || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队攻击%</span><input id="ws_d4t_atk" type="number" step="1" value="${Number(((d4t.atk_pct || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队精通+</span><input id="ws_d4t_ap" type="number" step="5" value="${d4t.ap || 0}"></label>
            <label class="ws-field"><span>全队减抗%</span><input id="ws_d4t_res" type="number" step="1" value="${Number(((d4t.res_shred || 0) * 100).toFixed(1))}"></label>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 4. Bangboo Workshop Tab
// ============================================================================
function renderBangbooWorkshopBody() {
  if (!BANGBOO_MAP[WORKSHOP_STATE.selectedBangbooId] && BANGBOOS.length > 0) {
    WORKSHOP_STATE.selectedBangbooId = BANGBOOS[0].id;
  }
  const bb = deepClone(BANGBOO_MAP[WORKSHOP_STATE.selectedBangbooId] || BANGBOOS[0]);
  const isMod = !!customDB.bangboos[bb.id];
  const builtIn = isBuiltInBangboo(bb.id);
  const eb = bb.elemBuildup || {};

  return `
    <div class="ws-split">
      <div class="ws-sidebar">
        <div class="row" style="gap:6px;margin-bottom:8px;">
          <button class="btn btn-primary" id="wsNewBbBtn" style="width:100%;">+ 新建自定义邦布</button>
        </div>
        <div class="ws-item-list">
          ${BANGBOOS.map(b => `
            <button class="ws-list-item ${b.id === bb.id ? "active" : ""}" data-ws-pick-bb="${escHtml(b.id)}">
              <span class="ws-item-name">[${b.r}] ${escHtml(b.n)}</span>
              <span class="muted" style="font-size:11px;margin-left:auto;">${escHtml(b.camp || "")}</span>
              ${customDB.bangboos[b.id] ? `<span class="badge b-warn">已改</span>` : ""}
            </button>
          `).join("")}
        </div>
      </div>

      <div class="ws-editor">
        <div class="ws-editor-head">
          <div>
            <strong style="font-size:16px;">${escHtml(bb.n)} (ID: ${escHtml(bb.id)})</strong>
            <div class="muted" style="font-size:12px;">邦布4号位参与破韧提速(压缩失衡外时间)、属性异常积蓄贡献、全队增益与连携直伤。</div>
          </div>
          <div class="row" style="gap:6px;">
            ${builtIn && isMod ? `<button class="btn btn-danger" id="wsRevertBbBtn">恢复官方默认</button>` : ""}
            <button class="btn btn-primary" id="wsSaveBbBtn">保存邦布修改</button>
          </div>
        </div>

        <div class="ws-section">
          <div class="ws-sec-title">邦布数值与协同参数</div>
          <div class="ws-grid-4">
            <label class="ws-field"><span>邦布名称</span><input id="wb_n" type="text" value="${escHtml(bb.n)}"></label>
            <label class="ws-field"><span>品级</span><select id="wb_r"><option value="S" ${bb.r === "S" ? "selected" : ""}>S级</option><option value="A" ${bb.r === "A" ? "selected" : ""}>A级</option><option value="-" ${bb.r === "-" ? "selected" : ""}>无</option></select></label>
            <label class="ws-field"><span>主属性</span><select id="wb_elem">${ALL_ELEMENTS.map(x => `<option value="${x.eb}" ${bb.elem === x.eb ? "selected" : ""}>${x.zh}</option>`).join("")}</select></label>
            <label class="ws-field"><span>适体系/阵营备注</span><input id="wb_camp" type="text" value="${escHtml(bb.camp || "")}"></label>
            <label class="ws-field"><span>全队破韧提速%</span><input id="wb_daze" type="number" step="0.5" value="${Number(((bb.dazeBonus || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队增伤覆盖%</span><input id="wb_dmg" type="number" step="0.5" value="${Number(((bb.teamDmg || 0) * 100).toFixed(1))}"></label>
            <label class="ws-field"><span>全队固定攻击+</span><input id="wb_atk" type="number" step="10" value="${bb.teamAtkFlat || 0}"></label>
            <label class="ws-field"><span>全队异常精通+</span><input id="wb_ap" type="number" step="5" value="${bb.teamAp || 0}"></label>
            <label class="ws-field"><span>命破贯穿力协同+</span><input id="wb_sheer" type="number" step="5" value="${bb.teamSheer || 0}"></label>
            <label class="ws-field"><span>等效回能输送(点/s)</span><input id="wb_er" type="number" step="0.02" value="${bb.erFlat || 0}"></label>
            <label class="ws-field"><span>主动+连携直伤倍率</span><input id="wb_mv" type="number" step="20" value="${bb.chainMv || 0}"></label>
            <label class="ws-field"><span>高压回血/容错保护</span><select id="wb_heal"><option value="0" ${!bb.safeHeal ? "selected" : ""}>否</option><option value="1" ${bb.safeHeal ? "selected" : ""}>是(降低危险合轴折损)</option></select></label>
            <label class="ws-field" style="grid-column:span 4;"><span>机制说明</span><input id="wb_desc" type="text" value="${escHtml(bb.desc || "")}"></label>
          </div>
          <div style="font-size:12px;font-weight:700;margin:10px 0 4px;">各属性后台异常积蓄贡献%：</div>
          <div class="ws-grid-7">
            ${ALL_ELEMENTS.map(x => `
              <label class="ws-field"><span>${x.zh}积蓄%</span><input id="wb_bu_${x.eb}" type="number" step="1" value="${Number(((eb[x.eb] || 0) * 100).toFixed(0))}"></label>
            `).join("")}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// 5. Custom Presets & Stage Buffs Workshop Tab
// ============================================================================
function renderPresetStageWorkshopBody() {
  const sb = deepClone(STAGE_BUFFS[WORKSHOP_STATE.selectedStageId] || STAGE_BUFFS.none);
  const userPresets = customDB.presetTeams || [];

  return `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div class="ws-section">
        <div class="ws-sec-title">一、将当前主工作台编队保存为「我的自定义公式队」</div>
        <div class="ws-grid-4">
          <label class="ws-field"><span>分类分组名称</span><input id="wp_cat" type="text" value="我的自定义配队"></label>
          <label class="ws-field"><span>右上角短标签</span><input id="wp_tag" type="text" value="自建实轴配置"></label>
          <label class="ws-field" style="grid-column:span 2;"><span>配队标题名称 (留空自动按三人名字生成)</span><input id="wp_name" type="text" placeholder="如：【雅柳嘉】双异常合轴队"></label>
          <label class="ws-field" style="grid-column:span 3;"><span>配队手法与拐力说明</span><input id="wp_desc" type="text" placeholder="记录这支队伍的排轴要点、套装分工或金数配置..."></label>
          <div style="display:flex;align-items:flex-end;">
            <button class="btn btn-primary" id="wsSaveCurrentTeamPresetBtn" style="width:100%;">保存当前三人+邦布为预设队</button>
          </div>
        </div>

        ${userPresets.length > 0 ? `
          <div style="margin-top:10px;">
            <div style="font-size:12px;font-weight:700;margin-bottom:6px;">已保存的自定义公式队 (${userPresets.length})：</div>
            <div class="ws-grid-2">
              ${userPresets.map((p, idx) => `
                <div class="subbox row" style="justify-content:space-between;">
                  <div>
                    <div style="font-size:12px;font-weight:700;">${escHtml(p.name)} <span class="badge b-info">${escHtml(p.tag)}</span></div>
                    <div class="muted" style="font-size:11px;">${escHtml(p.desc || "")}</div>
                  </div>
                  <button class="btn btn-danger" data-ws-del-preset="${idx}">删除</button>
                </div>
              `).join("")}
            </div>
          </div>
        ` : `<div class="muted" style="font-size:12px;margin-top:8px;">当前暂无自建预设配队。点击上方按钮即可把外面的当前队伍永久加入「一键热门公式配队」首栏。</div>`}
      </div>

      <div class="ws-section">
        <div class="ws-sec-title">二、式舆防卫战 / 危局强袭战 深渊天气词条编辑器</div>
        <div class="row" style="gap:8px;margin-bottom:10px;">
          <select id="wsStagePickSelect" style="flex:1;max-width:460px;">
            ${Object.values(STAGE_BUFFS).map(s => `<option value="${escHtml(s.id)}" ${s.id === sb.id ? "selected" : ""}>${escHtml(s.name)}</option>`).join("")}
          </select>
          <button class="btn" id="wsNewStageBtn">+ 新建深渊天气</button>
          ${isBuiltInStage(sb.id) && customDB.stageBuffs[sb.id] ? `<button class="btn btn-danger" id="wsRevertStageBtn">恢复默认天气</button>` : ""}
          <button class="btn btn-primary" id="wsSaveStageBtn">保存此天气词条</button>
        </div>
        <div class="ws-grid-6">
          <label class="ws-field" style="grid-column:span 4;"><span>天气显示名称</span><input id="wst_name" type="text" value="${escHtml(sb.name)}"></label>
          <label class="ws-field" style="grid-column:span 2;"><span>高攻击欲高压环境标记</span>
            <select id="wst_aggro"><option value="0" ${!sb.highAggro ? "selected" : ""}>常规深渊Boss攻击频率</option><option value="1" ${sb.highAggro ? "selected" : ""}>高塔/红光疯狗模式(检验危险合轴)</option></select>
          </label>
          <label class="ws-field"><span>全伤害加成%</span><input id="wst_dmg" type="number" step="5" value="${Number(((sb.dmg || 0) * 100).toFixed(1))}"></label>
          <label class="ws-field"><span>局内攻击%</span><input id="wst_atk" type="number" step="5" value="${Number(((sb.atk_pct || 0) * 100).toFixed(1))}"></label>
          <label class="ws-field"><span>局内防御%</span><input id="wst_def" type="number" step="5" value="${Number(((sb.def_pct || 0) * 100).toFixed(1))}"></label>
          <label class="ws-field"><span>暴击率%</span><input id="wst_cr" type="number" step="5" value="${Number(((sb.cr || 0) * 100).toFixed(1))}"></label>
          <label class="ws-field"><span>暴击伤害%</span><input id="wst_cd" type="number" step="5" value="${Number(((sb.cd || 0) * 100).toFixed(1))}"></label>
          <label class="ws-field"><span>减防/无视防%</span><input id="wst_shred" type="number" step="5" value="${Number(((sb.def_shred || 0) * 100).toFixed(1))}"></label>
          <label class="ws-field"><span>全属性减抗%</span><input id="wst_res" type="number" step="5" value="${Number(((sb.res_shred || 0) * 100).toFixed(1))}"></label>
          <label class="ws-field"><span>异常/紊乱增伤%</span><input id="wst_anom" type="number" step="5" value="${Number(((sb.anom_dmg || 0) * 100).toFixed(1))}"></label>
          <label class="ws-field"><span>异常精通+</span><input id="wst_ap" type="number" step="10" value="${sb.ap || 0}"></label>
          <label class="ws-field"><span>命破贯穿独立增伤%</span><input id="wst_sheer" type="number" step="5" value="${Number(((sb.sheer_dmg || 0) * 100).toFixed(1))}"></label>
          <label class="ws-field"><span>锋御撕裂加成%</span><input id="wst_lac" type="number" step="5" value="${Number(((sb.lac_dmg || 0) * 100).toFixed(1))}"></label>
          <label class="ws-field"><span>失衡易伤倍率+</span><input id="wst_stun" type="number" step="5" value="${Number(((sb.stun_mult || 0) * 100).toFixed(1))}"></label>
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// Form Collectors & Event Bindings
// ============================================================================
function readCharForm(origChar) {
  const g = (id: string): any => document.getElementById(id);
  const num = (id, def = 0) => {
    const v = parseFloat(g(id)?.value);
    return Number.isFinite(v) ? v : def;
  };
  const wt = g("wc_wt").value;
  const eb = g("wc_eb").value;
  const spObj = ALL_SPECIALTIES.find(x => x.wt === wt) || ALL_SPECIALTIES[0];
  const elObj = ALL_ELEMENTS.find(x => x.eb === eb) || ALL_ELEMENTS[0];

  const next = deepClone(origChar);
  next.n = g("wc_n").value.trim() || origChar.n;
  next.r = g("wc_r").value;
  next.wt = wt;
  next.p = spObj.zh;
  next.eb = eb;
  next.e = elObj.zh;
  next.anomBar = g("wc_anomBar").value;
  next.camp = g("wc_camp").value.trim() || "未知阵营";
  next.campId = g("wc_campId").value.trim() || "99";
  next.defAssist = g("wc_defAssist").value === "1";
  next.sig = g("wc_sig").value;
  next.def4pc = g("wc_def4pc").value;
  next.def2pc = g("wc_def2pc").value;
  next.isFreeS = g("wc_isFreeS").value === "1";

  next.hp = Math.max(100, num("wc_hp", 7500));
  next.atk = Math.max(50, num("wc_atk", 850));
  next.def = Math.max(50, num("wc_def", 600));
  next.cp_atk = num("wc_cp_atk", 0) / 100.0;
  next.cp_hp = num("wc_cp_hp", 0) / 100.0;
  next.cr = num("wc_cr", 5) / 100.0;
  next.cd = num("wc_cd", 50) / 100.0;
  next.scd = num("wc_scd", 0) / 100.0;
  next.pen = num("wc_pen", 0) / 100.0;
  next.imp = Math.max(10, num("wc_imp", 90));
  next.am = Math.max(10, num("wc_am", 90));
  next.ap = Math.max(10, num("wc_ap", 90));
  next.er = Math.max(0.1, num("wc_er", 1.2));
  next.mvScale = Math.max(0.1, num("wc_mvScale", 1.0));
  next.m_rec = g("wc_m_rec").value;

  const prof = { ...(next.prof || {}) };
  prof.self_dmg = num("wc_self_dmg", 0) / 100.0;
  prof.self_cr = num("wc_self_cr", 0) / 100.0;
  prof.self_cd = num("wc_self_cd", 0) / 100.0;
  prof.self_catk = num("wc_self_catk", 0) / 100.0;
  prof.self_catk_flat = num("wc_self_catk_flat", 0);
  prof.self_sheer_flat = num("wc_self_sheer_flat", 0);
  prof.self_lac_dmg = num("wc_self_lac_dmg", 0) / 100.0;
  prof.self_def_ign = num("wc_self_def_ign", 0) / 100.0;
  prof.self_res_ign = num("wc_self_res_ign", 0) / 100.0;
  prof.self_pen = num("wc_self_pen", 0) / 100.0;
  prof.self_ap = num("wc_self_ap", 0);
  prof.stun_share = Math.max(0, Math.min(1, num("wc_stun_share", 50) / 100.0));

  const sb = Math.max(0, num("wc_sh_basic", 30));
  const sd = Math.max(0, num("wc_sh_dash", 10));
  const se = Math.max(0, num("wc_sh_ex", 25));
  const sc = Math.max(0, num("wc_sh_chain", 12));
  const su = Math.max(0, num("wc_sh_ult", 23));
  const stot = Math.max(1, sb + sd + se + sc + su);
  prof.shares = {
    basic: Number((sb / stot).toFixed(3)),
    dash: Number((sd / stot).toFixed(3)),
    ex: Number((se / stot).toFixed(3)),
    chain: Number((sc / stot).toFixed(3)),
    ult: Number((su / stot).toFixed(3)),
    aftershock: Math.max(0, Math.min(1, num("wc_sh_as", 0) / 100.0))
  };

  prof.has_aftershock = !!g("wc_f_as").checked;
  prof.has_ether_veil = !!g("wc_f_veil").checked;
  prof.veil_vuln = !!g("wc_f_vvuln").checked;
  prof.triggers_abloom = !!g("wc_f_abloom").checked;
  prof.triggers_refringe = !!g("wc_f_ref").checked;
  prof.loses_hp = !!g("wc_f_hp").checked;
  prof.jane_crit = !!g("wc_f_jcrit").checked;

  if (g("wc_has_anom_split").checked) {
    const ad = Math.max(0, num("wc_as_direct", 20));
    const aa2 = Math.max(0, num("wc_as_anom", 45));
    const adi = Math.max(0, num("wc_as_dis", 35));
    const aab = Math.max(0, num("wc_as_ab", 0));
    const atot = Math.max(1, ad + aa2 + adi + aab);
    prof.anom_split = {
      direct: Number((ad / atot).toFixed(3)),
      anom: Number((aa2 / atot).toFixed(3)),
      disorder: Number((adi / atot).toFixed(3)),
      abloom: Number((aab / atot).toFixed(3))
    };
  } else {
    delete prof.anom_split;
  }
  next.prof = prof;

  next.swapProfile = {
    ...(next.swapProfile || {}),
    archetype: g("wc_sp_arch").value,
    commitSec: Math.max(0.2, num("wc_sp_commit", 1.25)),
    safety: g("wc_sp_safety").value,
    channelPenalty: Math.max(0, Math.min(0.65, num("wc_sp_chan", 0))),
    cancelGain: num("wc_sp_cancel", 6) / 100.0,
    qaOut: Math.max(0, num("wc_sp_qaout", 0.3)),
    qaCoef: num("wc_sp_qacoef", 4) / 100.0,
    heavySpeed: Math.max(0.35, num("wc_sp_heavy", 0.78)),
    note: g("wc_sp_note").value
  };

  const roles = [...document.querySelectorAll<HTMLInputElement>(".wc_aa_role:checked")].map(el => el.value);
  next.aa = {
    roles,
    sameElem: !!g("wc_aa_elem").checked,
    sameCamp: !!g("wc_aa_camp").checked,
    needDefAssist: !!g("wc_aa_defa").checked,
    condText: g("wc_aa_cond").value || "满足编队条件",
    effText: g("wc_aa_eff").value || ""
  };

  next.customAA = {
    enabled: !!g("wc_caa_on").checked,
    replaceBuiltin: !!g("wc_caa_rep").checked,
    dmg: num("wc_caa_dmg", 0) / 100.0,
    cr: num("wc_caa_cr", 0) / 100.0,
    cd: num("wc_caa_cd", 0) / 100.0,
    catk_flat: num("wc_caa_atkf", 0),
    res_ign: num("wc_caa_res", 0) / 100.0,
    proc_mult: Math.max(0.2, num("wc_caa_proc", 1.0))
  };

  next.customTeamBuff = {
    enabled: !!g("wc_ctb_on").checked,
    replaceBuiltin: !!g("wc_ctb_rep").checked,
    appliesToSelf: !!g("wc_ctb_self").checked,
    targetRole: g("wc_ctb_role").value,
    targetElem: g("wc_ctb_elem").value,
    atk_flat: num("wc_ctb_atkf", 0),
    atk_pct: num("wc_ctb_atkp", 0) / 100.0,
    sheer: num("wc_ctb_sheer", 0),
    dmg: num("wc_ctb_dmg", 0) / 100.0,
    cr: num("wc_ctb_cr", 0) / 100.0,
    cd: num("wc_ctb_cd", 0) / 100.0,
    def_shred: num("wc_ctb_shred", 0) / 100.0,
    pen: num("wc_ctb_pen", 0) / 100.0,
    res_shred: num("wc_ctb_res", 0) / 100.0,
    stun_mult: num("wc_ctb_stun", 0) / 100.0,
    stun_mult_alltime: num("wc_ctb_stuna", 0) / 100.0,
    ap: num("wc_ctb_ap", 0),
    convFrom: g("wc_ctb_cfrom").value,
    convThreshold: num("wc_ctb_cth", 0),
    convRate: num("wc_ctb_crate", 0),
    convCap: num("wc_ctb_ccap", 0),
    convTo: g("wc_ctb_cto").value
  };

  next.m_stages = Array.from({ length: 6 }, (_, idx) => {
    const baseMs = { ...(origChar.m_stages?.[idx] || {}) };
    baseMs.desc = g(`wm_${idx}_desc`).value;
    baseMs.c_cr = num(`wm_${idx}_cr`, 0) / 100.0;
    baseMs.c_cd = num(`wm_${idx}_cd`, 0) / 100.0;
    baseMs.dmg_all = num(`wm_${idx}_dmg`, 0) / 100.0;
    baseMs.def_ign = num(`wm_${idx}_def`, 0) / 100.0;
    baseMs.res_ign = num(`wm_${idx}_res`, 0) / 100.0;
    baseMs.proc_mult = Math.max(0.2, num(`wm_${idx}_proc`, 1.0));
    baseMs.skill_lv_mult = Math.max(0.4, num(`wm_${idx}_sklv`, 1.0));
    baseMs.tb_dmg = num(`wm_${idx}_tdmg`, 0) / 100.0;
    baseMs.tb_def_shred = num(`wm_${idx}_tdef`, 0) / 100.0;
    baseMs.tb_res_shred = num(`wm_${idx}_tres`, 0) / 100.0;
    return baseMs;
  });

  return next;
}

function bindWorkshopEvents(modal: HTMLElement) {
  modal.querySelectorAll<HTMLElement>("[data-ws-close]").forEach(el => {
    el.addEventListener("click", closeCustomWorkshop);
  });
  modal.querySelectorAll<HTMLElement>("[data-ws-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      WORKSHOP_STATE.tab = btn.dataset.wsTab;
      WORKSHOP_STATE.statusMsg = "";
      renderCustomWorkshopModal();
    });
  });

  const searchIn = document.getElementById("wsSearchInput");
  if (searchIn) {
    searchIn.addEventListener("input", (e: any) => {
      WORKSHOP_STATE.search = e.target.value;
      renderCustomWorkshopModal();
      const ni = document.getElementById("wsSearchInput") as HTMLInputElement | null;
      if (ni) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); }
    });
  }
  modal.querySelectorAll<HTMLElement>("[data-ws-rf]").forEach(btn => {
    btn.addEventListener("click", () => {
      WORKSHOP_STATE.roleFilter = btn.dataset.wsRf;
      renderCustomWorkshopModal();
    });
  });

  // Export / Import / Reset Custom Pack
  document.getElementById("wsExportPackBtn")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ type: "zzz_v33_custom_pack", exportedAt: new Date().toISOString(), customDB }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "zzz_v33_custom_data_pack.json";
    a.click();
    URL.revokeObjectURL(a.href);
    flashWorkshopMsg("已导出自定义数据包 JSON 文件。");
  });

  document.getElementById("wsImportPackBtn")?.addEventListener("click", () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json,application/json";
    inp.onchange = (ev: any) => {
      const f = ev.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const dbSrc = parsed.customDB || parsed;
          if (dbSrc.chars) Object.assign(customDB.chars, dbSrc.chars);
          if (dbSrc.weps) Object.assign(customDB.weps, dbSrc.weps);
          if (dbSrc.discSets) Object.assign(customDB.discSets, dbSrc.discSets);
          if (dbSrc.bangboos) Object.assign(customDB.bangboos, dbSrc.bangboos);
          if (dbSrc.stageBuffs) Object.assign(customDB.stageBuffs, dbSrc.stageBuffs);
          if (Array.isArray(dbSrc.presetTeams)) customDB.presetTeams = [...dbSrc.presetTeams, ...customDB.presetTeams];
          applyCustomDBChanges("自定义数据包导入成功，已合并并刷新全局计算引擎。");
        } catch (err: any) {
          flashWorkshopMsg("JSON 解析失败：" + err.message);
        }
      };
      reader.readAsText(f);
    };
    inp.click();
  });

  document.getElementById("wsResetAllCustomBtn")?.addEventListener("click", () => {
    customDB.chars = {};
    customDB.deletedChars = [];
    customDB.weps = {};
    customDB.discSets = {};
    customDB.bangboos = {};
    customDB.stageBuffs = {};
    customDB.presetTeams = [];
    applyCustomDBChanges("已清空全部自定义覆写，恢复官方 v3.3 默认数据库。");
  });

  // Character Tab Actions
  modal.querySelectorAll<HTMLElement>("[data-ws-pick-char]").forEach(btn => {
    btn.addEventListener("click", () => {
      WORKSHOP_STATE.selectedCharId = btn.dataset.wsPickChar;
      WORKSHOP_STATE.statusMsg = "";
      renderCustomWorkshopModal();
    });
  });

  document.getElementById("wsNewCharBtn")?.addEventListener("click", () => {
    const nc = createBlankCharTemplate(null);
    customDB.chars[nc.id] = nc;
    WORKSHOP_STATE.selectedCharId = nc.id;
    applyCustomDBChanges(`已新建空白代理人【${nc.n}】，可自由调整所有参数。`);
  });

  document.getElementById("wsCloneCharBtn")?.addEventListener("click", () => {
    const cur = CHAR_MAP[WORKSHOP_STATE.selectedCharId];
    if (!cur) return;
    const cloned = createBlankCharTemplate(readCharForm(cur));
    customDB.chars[cloned.id] = cloned;
    WORKSHOP_STATE.selectedCharId = cloned.id;
    applyCustomDBChanges(`已克隆生成新角色【${cloned.n}】。`);
  });

  document.getElementById("wsSaveCharBtn")?.addEventListener("click", () => {
    const cur = CHAR_MAP[WORKSHOP_STATE.selectedCharId];
    if (!cur) return;
    const updated = readCharForm(cur);
    customDB.chars[updated.id] = updated;
    applyCustomDBChanges(`角色【${updated.n}】自定义参数已保存并实时重算！`);
  });

  document.getElementById("wsRevertCharBtn")?.addEventListener("click", () => {
    delete customDB.chars[WORKSHOP_STATE.selectedCharId];
    applyCustomDBChanges("已将该角色恢复为官方默认参数。");
  });

  document.getElementById("wsDeleteCharBtn")?.addEventListener("click", () => {
    const id = WORKSHOP_STATE.selectedCharId;
    delete customDB.chars[id];
    WORKSHOP_STATE.selectedCharId = DEFAULT_CHARS[0].id;
    applyCustomDBChanges("已删除该自定义角色。");
  });

  document.getElementById("wsPutSlot0Btn")?.addEventListener("click", () => {
    const cur = CHAR_MAP[WORKSHOP_STATE.selectedCharId];
    if (!cur) return;
    const updated = readCharForm(cur);
    customDB.chars[updated.id] = updated;
    saveCustomDBToStorage();
    rebuildDataMaps();
    assignCharacterToSlot(0, updated.id);
    closeCustomWorkshop();
  });

  // Weapon Tab Actions
  modal.querySelectorAll<HTMLElement>("[data-ws-pick-wep]").forEach(btn => {
    btn.addEventListener("click", () => {
      WORKSHOP_STATE.selectedWepId = btn.dataset.wsPickWep;
      WORKSHOP_STATE.statusMsg = "";
      renderCustomWorkshopModal();
    });
  });

  const collectWepForm = origW => {
    const g = (id: string): any => document.getElementById(id);
    const num = (id, def = 0) => { const v = parseFloat(g(id)?.value); return Number.isFinite(v) ? v : def; };
    const wt = g("ww_wt").value;
    const spObj = ALL_SPECIALTIES.find(x => x.wt === wt) || ALL_SPECIALTIES[0];
    const next = deepClone(origW);
    next.n = g("ww_n").value.trim() || origW.n;
    next.r = g("ww_r").value;
    next.wt = wt;
    next.p = spObj.zh;
    next.isFreeS = g("ww_free").value === "1";
    next.batk = Math.max(0, num("ww_batk", 600));
    next.bdef = Math.max(0, num("ww_bdef", 0));
    next.sn = g("ww_sn").value;
    next.sv = num("ww_sv", 0);
    next.descR1 = g("ww_dr1").value;
    next.descR5 = g("ww_dr5").value;
    next.customMods = {
      enabled: !!g("ww_cm_on").checked,
      replaceBuiltin: !!g("ww_cm_rep").checked,
      init_cr: num("ww_init_cr") / 100, init_cd: num("ww_init_cd") / 100, init_ap: num("ww_init_ap"),
      c_atk: num("ww_c_atk") / 100, c_cr: num("ww_c_cr") / 100, c_cd: num("ww_c_cd") / 100,
      c_def: num("ww_c_def") / 100, c_sheer: num("ww_c_sheer"), c_ap: num("ww_c_ap"),
      c_er_flat: num("ww_c_er"), c_imp_pct: num("ww_c_imp") / 100,
      dmg_all: num("ww_dmg_all") / 100, dmg_basic: num("ww_dmg_basic") / 100,
      dmg_ex: num("ww_dmg_ex") / 100, dmg_ult: num("ww_dmg_ult") / 100,
      dmg_anom: num("ww_dmg_anom") / 100, dmg_disorder: num("ww_dmg_dis") / 100, dmg_abloom: num("ww_dmg_ab") / 100,
      def_ign: num("ww_def_ign") / 100, res_ign: num("ww_res_ign") / 100,
      daze_pct: num("ww_daze") / 100, buildup: num("ww_buildup") / 100,
      t_atk_pct: num("ww_t_atk") / 100, t_dmg: num("ww_t_dmg") / 100,
      t_cr: num("ww_t_cr") / 100, t_cd: num("ww_t_cd") / 100,
      t_def_shred: num("ww_t_shred") / 100, t_ap: num("ww_t_ap")
    };
    return next;
  };

  document.getElementById("wsNewWepBtn")?.addEventListener("click", () => {
    const nw = createBlankWepTemplate(null);
    customDB.weps[nw.id] = nw;
    WORKSHOP_STATE.selectedWepId = nw.id;
    applyCustomDBChanges(`已新建自定义音擎【${nw.n}】。`);
  });

  document.getElementById("wsCloneWepBtn")?.addEventListener("click", () => {
    const cur = SC_WEPS[WORKSHOP_STATE.selectedWepId];
    if (!cur) return;
    const nw = createBlankWepTemplate(collectWepForm(cur));
    customDB.weps[nw.id] = nw;
    WORKSHOP_STATE.selectedWepId = nw.id;
    applyCustomDBChanges(`已克隆生成新音擎【${nw.n}】。`);
  });

  document.getElementById("wsSaveWepBtn")?.addEventListener("click", () => {
    const cur = SC_WEPS[WORKSHOP_STATE.selectedWepId];
    if (!cur) return;
    const updated = collectWepForm(cur);
    customDB.weps[updated.id] = updated;
    applyCustomDBChanges(`音擎【${updated.n}】修改已保存并全局生效。`);
  });

  document.getElementById("wsRevertWepBtn")?.addEventListener("click", () => {
    delete customDB.weps[WORKSHOP_STATE.selectedWepId];
    applyCustomDBChanges("已将该音擎恢复官方默认参数。");
  });

  // Drive Set Tab Actions
  modal.querySelectorAll<HTMLElement>("[data-ws-pick-set]").forEach(btn => {
    btn.addEventListener("click", () => {
      WORKSHOP_STATE.selectedSetId = btn.dataset.wsPickSet;
      WORKSHOP_STATE.statusMsg = "";
      renderCustomWorkshopModal();
    });
  });

  document.getElementById("wsNewSetBtn")?.addEventListener("click", () => {
    const sid = "自套" + (Object.keys(customDB.discSets).length + 1);
    customDB.discSets[sid] = {
      id: sid, name: "新自定义套装·" + sid, cat: "自定义", d2: "暴击+8%", d4: "全伤+25%",
      customMods: { enabled: true, replaceBuiltin: true, d2: { init_cr: 0.08 }, d4Self: { dmg_all: 0.25 }, d4Team: {} }
    };
    WORKSHOP_STATE.selectedSetId = sid;
    applyCustomDBChanges(`已创建新驱动盘套装【${sid}】。`);
  });

  document.getElementById("wsSaveSetBtn")?.addEventListener("click", () => {
    const cur = DISC_SETS[WORKSHOP_STATE.selectedSetId];
    if (!cur) return;
    const g = (id: string): any => document.getElementById(id);
    const num = id => { const v = parseFloat(g(id)?.value); return Number.isFinite(v) ? v : 0; };
    const next = deepClone(cur);
    next.name = g("ws_ds_name").value.trim() || cur.name;
    next.cat = g("ws_ds_cat").value.trim() || "通用";
    next.roleReq = g("ws_ds_role").value || undefined;
    next.d2 = g("ws_ds_d2txt").value;
    next.d4 = g("ws_ds_d4txt").value;
    next.customMods = {
      enabled: !!g("ws_ds_on").checked,
      replaceBuiltin: !!g("ws_ds_rep").checked,
      d2: {
        init_cr: num("ws_d2_cr") / 100, init_cd: num("ws_d2_cd") / 100, init_atk: num("ws_d2_atk") / 100,
        init_hp: num("ws_d2_hp") / 100, init_def: num("ws_d2_def") / 100, dmg_elem: num("ws_d2_elem") / 100,
        init_pen: num("ws_d2_pen") / 100, init_ap: num("ws_d2_ap"), init_am: num("ws_d2_am") / 100,
        init_er: num("ws_d2_er") / 100, init_imp: num("ws_d2_imp") / 100, daze_pct: num("ws_d2_daze") / 100
      },
      d4Self: {
        c_atk: num("ws_d4s_atk") / 100, c_cr: num("ws_d4s_cr") / 100, c_cd: num("ws_d4s_cd") / 100,
        c_ap: num("ws_d4s_ap"), dmg_all: num("ws_d4s_dmg") / 100, dmg_sheer: num("ws_d4s_sheer") / 100
      },
      d4Team: {
        dmg: num("ws_d4t_dmg") / 100, cd: num("ws_d4t_cd") / 100, atk_pct: num("ws_d4t_atk") / 100,
        ap: num("ws_d4t_ap"), res_shred: num("ws_d4t_res") / 100
      }
    };
    customDB.discSets[next.id] = next;
    applyCustomDBChanges(`驱动盘套装【${next.name}】修改已保存。`);
  });

  document.getElementById("wsRevertSetBtn")?.addEventListener("click", () => {
    delete customDB.discSets[WORKSHOP_STATE.selectedSetId];
    applyCustomDBChanges("已恢复套装官方默认属性。");
  });

  // Bangboo Tab Actions
  modal.querySelectorAll<HTMLElement>("[data-ws-pick-bb]").forEach(btn => {
    btn.addEventListener("click", () => {
      WORKSHOP_STATE.selectedBangbooId = btn.dataset.wsPickBb;
      WORKSHOP_STATE.statusMsg = "";
      renderCustomWorkshopModal();
    });
  });

  document.getElementById("wsNewBbBtn")?.addEventListener("click", () => {
    const bid = "b_usr_" + Date.now().toString(36).slice(-4);
    customDB.bangboos[bid] = {
      id: bid, n: "自定义协同布", r: "S", elem: "Ether", camp: "自定义",
      dazeBonus: 0.04, teamDmg: 0.05, teamAtkFlat: 0, teamAp: 0, teamSheer: 0, erFlat: 0,
      elemBuildup: { Ether: 0.15 }, chainMv: 500, safeHeal: false, desc: "自定义4号位邦布"
    };
    WORKSHOP_STATE.selectedBangbooId = bid;
    applyCustomDBChanges("已新建自定义邦布。");
  });

  document.getElementById("wsSaveBbBtn")?.addEventListener("click", () => {
    const cur = BANGBOO_MAP[WORKSHOP_STATE.selectedBangbooId];
    if (!cur) return;
    const g = (id: string): any => document.getElementById(id);
    const num = id => { const v = parseFloat(g(id)?.value); return Number.isFinite(v) ? v : 0; };
    const eb = {};
    ALL_ELEMENTS.forEach(x => {
      const v = num(`wb_bu_${x.eb}`) / 100.0;
      if (v > 0) eb[x.eb] = v;
    });
    const next = {
      ...deepClone(cur),
      n: g("wb_n").value.trim() || cur.n,
      r: g("wb_r").value,
      elem: g("wb_elem").value,
      camp: g("wb_camp").value,
      dazeBonus: num("wb_daze") / 100.0,
      teamDmg: num("wb_dmg") / 100.0,
      teamAtkFlat: num("wb_atk"),
      teamAp: num("wb_ap"),
      teamSheer: num("wb_sheer"),
      erFlat: num("wb_er"),
      chainMv: num("wb_mv"),
      safeHeal: g("wb_heal").value === "1",
      desc: g("wb_desc").value,
      elemBuildup: eb
    };
    customDB.bangboos[next.id] = next;
    applyCustomDBChanges(`邦布【${next.n}】配置已保存。`);
  });

  document.getElementById("wsRevertBbBtn")?.addEventListener("click", () => {
    delete customDB.bangboos[WORKSHOP_STATE.selectedBangbooId];
    applyCustomDBChanges("已恢复邦布默认配置。");
  });

  // Preset & Stage Tab Actions
  document.getElementById("wsSaveCurrentTeamPresetBtn")?.addEventListener("click", () => {
    const state = appStore.state; if (!state.slots) return;
    const valid = state.slots.filter(s => s && s.cid && CHAR_MAP[s.cid]);
    if (valid.length === 0) {
      flashWorkshopMsg("当前外层队伍为空，请先选择至少1名角色。");
      return;
    }
    const autoTitle = "【" + valid.map(s => CHAR_MAP[s.cid].n.replace(/[「」]/g, "")[0]).join("") + "】" + valid.map(s => CHAR_MAP[s.cid].n).join(" + ");
    const cat = (document.getElementById("wp_cat") as HTMLInputElement).value.trim() || "我的自定义配队";
    const tag = (document.getElementById("wp_tag") as HTMLInputElement).value.trim() || "自建预设";
    const name = (document.getElementById("wp_name") as HTMLInputElement).value.trim() || autoTitle;
    const desc = (document.getElementById("wp_desc") as HTMLInputElement).value.trim() || "用户自定义保存配队";
    const presetObj = {
      id: "p_usr_" + Date.now().toString(36),
      cat, tag, name, desc,
      bangboo: state.env?.bangbooId || "b_snap",
      fullSlots: deepClone(state.slots),
      swapConfig: deepClone(state.env?.swapConfig || null),
      slots: state.slots.filter(s => s && s.cid).map((s): [string, number, string, number, string?] => [s!.cid, s!.m ?? 0, s!.wid, s!.ref ?? 1, s!.fourPc])
    };
    customDB.presetTeams.unshift(presetObj);
    state.presetCat = cat;
    applyCustomDBChanges(`已将【${name}】保存至预设公式配队库！`);
  });

  modal.querySelectorAll<HTMLElement>("[data-ws-del-preset]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.wsDelPreset);
      customDB.presetTeams.splice(idx, 1);
      applyCustomDBChanges("已删除该自定义预设队。");
    });
  });

  document.getElementById("wsStagePickSelect")?.addEventListener("change", (e: any) => {
    WORKSHOP_STATE.selectedStageId = e.target.value;
    renderCustomWorkshopModal();
  });

  document.getElementById("wsNewStageBtn")?.addEventListener("click", () => {
    const sid = "st_usr_" + Date.now().toString(36).slice(-4);
    customDB.stageBuffs[sid] = {
      id: sid, name: "自定义式舆/危局天气（全伤+25%，暴伤+30%）",
      dmg: 0.25, atk_pct: 0, def_pct: 0, cr: 0, cd: 0.30, def_shred: 0, res_shred: 0, anom_dmg: 0, ap: 0, sheer_dmg: 0, lac_dmg: 0, stun_mult: 0, highAggro: false
    };
    WORKSHOP_STATE.selectedStageId = sid;
    applyCustomDBChanges("已创建新深渊天气词条。");
  });

  document.getElementById("wsSaveStageBtn")?.addEventListener("click", () => {
    const g = (id: string): any => document.getElementById(id);
    const num = id => { const v = parseFloat(g(id)?.value); return Number.isFinite(v) ? v : 0; };
    const sid = WORKSHOP_STATE.selectedStageId;
    customDB.stageBuffs[sid] = {
      id: sid,
      name: g("wst_name").value.trim() || "自定义天气",
      highAggro: g("wst_aggro").value === "1",
      dmg: num("wst_dmg") / 100, atk_pct: num("wst_atk") / 100, def_pct: num("wst_def") / 100,
      cr: num("wst_cr") / 100, cd: num("wst_cd") / 100, def_shred: num("wst_shred") / 100,
      res_shred: num("wst_res") / 100, anom_dmg: num("wst_anom") / 100, ap: num("wst_ap"),
      sheer_dmg: num("wst_sheer") / 100, lac_dmg: num("wst_lac") / 100, stun_mult: num("wst_stun") / 100
    };
    applyCustomDBChanges("深渊天气词条已保存。");
  });

  document.getElementById("wsRevertStageBtn")?.addEventListener("click", () => {
    delete customDB.stageBuffs[WORKSHOP_STATE.selectedStageId];
    applyCustomDBChanges("已恢复官方默认深渊天气。");
  });
}


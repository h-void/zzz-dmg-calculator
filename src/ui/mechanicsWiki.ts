// ============================================================================
// Section 07: Mechanics Wiki, 62-Agent Frame/Anomaly Table, Energy Calculator & Gear Codex
// ============================================================================

import { CHAR_MAP, DISC_SETS, SC_CHARS, SC_WEPS, WEP_LIST } from "../data/store";
import { renderAgentAvatar, renderDiscVinyl, renderWeaponThumb } from "../data/enkaAssets";
import { ANOMALY_BAR_SPECS, DISORDER_ICD_SEC, resolveAgentAnomalyBar } from "../engine/anomalyEngine";
import {
  ALL_ELEMENTS,
  ALL_SPECIALTIES,
  SN_ZH,
  calcAnomLevelMult,
  calcBaseStatLvMult,
  calcDefLevelFactor,
  escHtml
} from "../engine/constants";
import { getWeaponEffects } from "../engine/simulator";
import { ARCHETYPE_LABELS, SAFETY_LABELS, getCharSwapProfile } from "../engine/swapTimeline";
import { localizeDOM } from "../i18n";
import { appStore, assignCharacterToSlot, triggerRefreshUI } from "./appState";

type WikiTab = "formulas" | "agents" | "energy" | "gear";

interface EnergyCalcState {
  cid: string;
  baseEr: number;
  wepErPct: number;
  wepErFlat: number;
  wepErRate: number;
  has2pcEr: boolean;
  hasD6Er: boolean;
  cycleSec: number;
  exCount: number;
  exCost: number;
  activeEnergyGen: number;
  teamEnergyRestore: number;
  decibelCap: number;
  decibelPerCycle: number;
}

const wikiState: {
  tab: WikiTab;
  agentElem: string;
  agentRole: string;
  agentSearch: string;
  gearKind: "weps" | "discs";
  gearRole: string;
  gearRank: string;
  gearSearch: string;
  lvTableOpen: boolean;
  energy: EnergyCalcState;
} = {
  tab: "formulas",
  agentElem: "ALL",
  agentRole: "ALL",
  agentSearch: "",
  gearKind: "weps",
  gearRole: "ALL",
  gearRank: "ALL",
  gearSearch: "",
  lvTableOpen: false,
  energy: {
    cid: "1311",
    baseEr: 1.56,
    wepErPct: 0,
    wepErFlat: 0.6,
    wepErRate: 0,
    has2pcEr: true,
    hasD6Er: true,
    cycleSec: 20,
    exCount: 2,
    exCost: 60,
    activeEnergyGen: 18,
    teamEnergyRestore: 0,
    decibelCap: 3000,
    decibelPerCycle: 1650
  }
};

function syncEnergyFromSlot(slotIdx: number): void {
  const sl = appStore.state.slots[slotIdx];
  const sim = appStore.lastSimResult;
  const sr = sim?.slotResults?.find((r: any) => r.slotIdx === slotIdx);
  const ch = sl?.cid ? CHAR_MAP[sl.cid] : null;
  if (!ch) return;

  const w = sl?.wid ? SC_WEPS[sl.wid] : SC_WEPS[ch.sig];
  const ref = sl?.ref ?? (w?.r === "S" ? 1 : 5);
  const weff = w ? getWeaponEffects(ch, w, ref, {}, sl) : null;
  const fp = sr?.fourPc || sl?.fourPc || ch.def4pc;
  const tp = sr?.twoPc || sl?.twoPc || ch.def2pc;
  const d6 = sl?.discAuto === false ? sl.d6 : sr?.st?.d6 || "ATK%";

  wikiState.energy.cid = ch.id;
  wikiState.energy.baseEr = Number((ch.er || 1.2).toFixed(2));
  wikiState.energy.wepErPct = Math.round(((weff?.init_er_pct || 0) * 100));
  wikiState.energy.wepErFlat = Number((weff?.c_er_flat || 0).toFixed(2));
  wikiState.energy.wepErRate = Math.round(((weff?.c_er_rate || 0) * 100));
  wikiState.energy.has2pcEr = fp === "月光" || fp === "摇摆" || tp === "月光" || tp === "摇摆";
  wikiState.energy.hasD6Er = d6 === "ER";
  wikiState.energy.cycleSec = Number((sim?.cycleSec || 20).toFixed(1));
  wikiState.energy.decibelCap =
    appStore.state.slots.some((s) => s?.cid === "1391") || ch.id === "1551" ? 4000 : 3000;
}

function renderFormulasTab(): string {
  const barSpecs = Object.values(ANOMALY_BAR_SPECS);
  const lvList = [1, 10, 20, 30, 40, 45, 50, 55, 60];

  return `
    <div class="wiki-formula-grid">
      <div class="card wiki-formula-card">
        <div class="wiki-f-head">
          <span class="badge b-info">体系 01</span>
          <strong>强攻直伤乘区公式 (Attack / Direct)</strong>
        </div>
        <div class="wiki-eq mono">
          期望伤害 = 局内攻击 × 技能倍率 × (1 + 暴击率 × 暴伤) × (1 + ∑增伤) × 防御区 × 抗性区 × 失衡易伤区
        </div>
        <ul class="clean-list wiki-notes">
          <li><strong>防御区</strong>：<code>K(Lv) / [K(Lv) + 怪物防御 × (1 − 减防/无视防) × (1 − 穿透率) − 固定穿透]</code>，60级 <code>K(60) = 794</code>，Lv.70 首领标准防御 <code>953</code>。</li>
          <li><strong>避坑注解</strong>：减防与穿透率为<strong>乘算稀释</strong>（如妮可 40% 减防下，24% 穿透率收益会被压缩）；仅在无减防或重甲 Boss(1300~1588防) + 高增伤(>130%) 时，穿透 5 号盘才反超属伤盘。</li>
        </ul>
      </div>

      <div class="card wiki-formula-card">
        <div class="wiki-f-head">
          <span class="badge b-ok">体系 02</span>
          <strong>命破贯穿乘区公式 (Rupture / Sheer)</strong>
        </div>
        <div class="wiki-eq mono">
          贯穿力 = ⌊0.1 × 局内生命⌋ + ⌊0.3 × 局内攻击⌋ + 贯穿拐<br>
          期望伤害 = 贯穿力 × 技能倍率 × 双暴区 × 增伤区 × (1 + 贯穿独立增伤) × 抗性区 × 失衡易伤区
        </div>
        <ul class="clean-list wiki-notes">
          <li><strong>核心特性</strong>：贯穿伤害<strong>天生 100% 无视敌人防御力与秽盾减伤</strong>（防御区恒为 <code>×1.000</code>）。</li>
          <li><strong>避坑注解</strong>：妮可 40% 减防、扳机专武减防、丽娜穿透率及 5 号穿透盘对命破均为 <strong>0% 收益</strong>；5 号盘仅在「属伤%」与「生命%」间择优。</li>
        </ul>
      </div>

      <div class="card wiki-formula-card">
        <div class="wiki-f-head">
          <span class="badge b-warn">体系 03</span>
          <strong>异常 / 紊乱 / 异放 / 耀化公式 (Anomaly)</strong>
        </div>
        <div class="wiki-eq mono">
          异常伤害 = 局内攻击 × 异常倍率 × (异常精通 / 100) × 等级系数 × 增伤区 × 防御区 × 抗性区 × 失衡区 × 异常双暴<br>
          紊乱倍率 = 450% + ⌊剩余秒数 / 结算步长⌋ × 单跳倍率 （内置冷却 ICD = ${DISORDER_ICD_SEC.toFixed(1)}s）
        </div>
        <ul class="clean-list wiki-notes">
          <li><strong>快照纯度（染色稀释）</strong>：异常伤害按各角色对该异常条的<strong>积蓄占比加权结算</strong>；若低精通辅助/击破混入同色积蓄，会稀释主C快照（柚叶的「甘味染渍」不参与稀释）。</li>
          <li><strong>99% 压条避坑</strong>：在先手异常刚挂上（剩余秒数最大）时用另一种异常瞬爆紊乱收益最高；两次紊乱间隔若短于 <code>3.0s</code> 会撞内置 CD 丢失整段紊乱。</li>
        </ul>
      </div>

      <div class="card wiki-formula-card">
        <div class="wiki-f-head">
          <span class="badge">体系 04</span>
          <strong>锋御二次撕裂公式 (Armorer / Lacerate)</strong>
        </div>
        <div class="wiki-eq mono">
          设 cr₁ = min(1, 暴击率)，cr₂ = clamp(暴击率 − 1, 0, 1)<br>
          撕裂期望乘区 = (1 − cr₁) + cr₁(1 − cr₂)(1 + 撕裂伤) + cr₁·cr₂·(1 + 撕裂伤)²
        </div>
        <ul class="clean-list wiki-notes">
          <li><strong>核心特性</strong>：以<strong>局内防御力</strong>为基础区，不吃传统暴伤，而是把超出 100% 的暴击率（上限 200%）转化为<strong>二次撕裂乘方结算</strong>。</li>
          <li><strong>避坑注解</strong>：常规暴伤拐对锋御主C收益极低，应优先堆暴击率逼近 200% 上限、撕裂增伤、防御拐、减防与减抗。</li>
        </ul>
      </div>
    </div>

    <div class="card" style="margin-top:14px;">
      <div class="sec-mini-title">八大属性异常条规格与紊乱结算表（实时读取引擎常量）</div>
      <div class="dil-table-wrap">
        <table class="dil-table">
          <thead>
            <tr>
              <th>异常条</th>
              <th>类型</th>
              <th>基础总倍率</th>
              <th>持续/跳伤</th>
              <th>紊乱额外倍率公式</th>
              <th>基础积蓄条</th>
              <th>附加次级减益</th>
            </tr>
          </thead>
          <tbody>
            ${barSpecs
              .map(
                (sp) => `
              <tr>
                <td><strong>${escHtml(sp.zhName)}</strong> <span class="muted mono">(${escHtml(sp.bar)})</span></td>
                <td><span class="badge ${sp.kind === "instant" ? "b-info" : "b-ok"}">${sp.kind === "instant" ? "瞬爆型" : "持续DoT"}</span></td>
                <td class="mono"><strong>${Math.round(sp.baseTotalMv * 100)}%</strong></td>
                <td class="mono">${sp.kind === "instant" ? "即时结算" : `${(sp.tickMv * 100).toFixed(1)}% / ${sp.tickIntervalSec}s (${sp.baseDurSec}s)`}</td>
                <td class="mono">450% + ⌊t/${sp.disorderTickSec}s⌋ × ${(sp.disorderTickMv * 100).toFixed(1)}%</td>
                <td class="mono">${sp.baseGauge}</td>
                <td>${escHtml(sp.debuffZh)}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </div>

    <details class="card wiki-appendix" style="margin-top:14px;" ${wikiState.lvTableOpen ? "open" : ""} id="wikiLvDetails">
      <summary class="wiki-appendix-sum">
        <span>附录：代理人等级系数表（Lv.1 ~ Lv.60 · 防御基数 K / 异常等级系数 / 白值缩放）</span>
        <span class="muted mono">点击展开 / 收起</span>
      </summary>
      <div class="dil-table-wrap" style="margin-top:10px;">
        <table class="dil-table">
          <thead>
            <tr>
              <th>等级</th>
              <th>防御基数 K(Lv)</th>
              <th>对 953 防基础防御区</th>
              <th>对 1588 重甲防御区</th>
              <th>异常等级倍率</th>
              <th>基础属性缩放</th>
            </tr>
          </thead>
          <tbody>
            ${lvList
              .map((lv) => {
                const k = calcDefLevelFactor(lv);
                const defStd = k / (k + 953);
                const defHeavy = k / (k + 1588);
                return `
                <tr class="${lv === 60 ? "dil-row-active" : ""}">
                  <td class="mono"><strong>Lv.${lv}</strong></td>
                  <td class="mono">${k.toFixed(1)}</td>
                  <td class="mono">×${defStd.toFixed(3)} (${(defStd * 100).toFixed(1)}%)</td>
                  <td class="mono">×${defHeavy.toFixed(3)} (${(defHeavy * 100).toFixed(1)}%)</td>
                  <td class="mono">×${calcAnomLevelMult(lv).toFixed(3)}</td>
                  <td class="mono">×${calcBaseStatLvMult(lv).toFixed(3)}</td>
                </tr>
              `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </details>
  `;
}

function renderAgentsTab(): string {
  const q = wikiState.agentSearch.trim().toLowerCase();
  const list = SC_CHARS.filter((c) => {
    if (wikiState.agentElem !== "ALL" && c.eb !== wikiState.agentElem) return false;
    if (wikiState.agentRole !== "ALL" && c.wt !== wikiState.agentRole) return false;
    if (q) {
      const hay = `${c.n} ${c.id} ${c.e} ${c.p} ${c.camp || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return `
    <div class="card">
      <div class="wiki-filter-bar">
        <input type="text" id="wikiAgentSearch" placeholder="搜索代理人名称 / 阵营 / ID..." value="${escHtml(wikiState.agentSearch)}" style="width:220px;">
        <div class="pill-bar">
          <button type="button" class="pill ${wikiState.agentElem === "ALL" ? "active" : ""}" data-wa-elem="ALL">全属性</button>
          ${ALL_ELEMENTS.map(
            (el) => `<button type="button" class="pill ${wikiState.agentElem === el.eb ? "active" : ""}" data-wa-elem="${el.eb}"><i class="elem-dot elem-${el.eb}"></i>${el.zh}</button>`
          ).join("")}
        </div>
        <div class="pill-bar">
          <button type="button" class="pill ${wikiState.agentRole === "ALL" ? "active" : ""}" data-wa-role="ALL">全职业</button>
          ${ALL_SPECIALTIES.map(
            (sp) => `<button type="button" class="pill ${wikiState.agentRole === sp.wt ? "active" : ""}" data-wa-role="${sp.wt}">${sp.zh}</button>`
          ).join("")}
        </div>
        <span class="badge b-info mono">匹配 ${list.length} / ${SC_CHARS.length}</span>
      </div>

      <div class="dil-table-wrap" style="margin-top:10px;">
        <table class="dil-table wiki-agent-table">
          <thead>
            <tr>
              <th>代理人</th>
              <th>Lv.60 基础白值 (攻/生/防)</th>
              <th>回能 / 掌控 / 冲击</th>
              <th>合轴形态与脱手帧</th>
              <th>安全等级 / 支援</th>
              <th>异常条</th>
              <th style="text-align:right;">快捷测试</th>
            </tr>
          </thead>
          <tbody>
            ${list
              .map((c) => {
                const sp = getCharSwapProfile(c);
                const bar = resolveAgentAnomalyBar(c);
                const barSpec = ANOMALY_BAR_SPECS[bar];
                const safetyCls =
                  sp.safety === "unsafe_exposed" ? "b-warn" : sp.safety === "safe_invuln" ? "b-ok" : "b-info";
                return `
                  <tr>
                    <td>
                      <div class="row" style="gap:8px;flex-wrap:nowrap;">
                        ${renderAgentAvatar(c.id, c.n, c.eb, "av-sm")}
                        <div>
                          <div class="row" style="gap:4px;">
                            <strong>${escHtml(c.n)}</strong>
                            <span class="badge">${escHtml(c.r)}</span>
                            <span class="muted" style="font-size:11px;">${escHtml(c.e)}·${escHtml(c.p)}</span>
                          </div>
                          <div class="muted" style="font-size:11px;">${escHtml(c.camp || "-")}</div>
                        </div>
                      </div>
                    </td>
                    <td class="mono" style="font-size:11.5px;">
                      <div>攻 <strong>${Math.round(c.atk)}</strong> · 血 ${Math.round(c.hp)}</div>
                      <div class="muted">防 ${Math.round(c.def)} · 暴 ${(c.cr * 100).toFixed(1)}%</div>
                    </td>
                    <td class="mono" style="font-size:11.5px;">
                      <div>回能 <strong>${(c.er || 1.2).toFixed(2)}</strong>/s</div>
                      <div class="muted">掌控 ${Math.round(c.am || 0)} · 冲击 ${Math.round(c.imp || 0)}</div>
                    </td>
                    <td style="font-size:11.5px;">
                      <div><strong>${escHtml(ARCHETYPE_LABELS[sp.archetype] || sp.archetype)}</strong> · <span class="mono">脱手 ${sp.commitSec}s</span></div>
                      <div class="muted">快支 ${sp.qaOut}/轮${sp.stunExtSec ? ` · 延失衡 +${sp.stunExtSec}s` : ""}</div>
                    </td>
                    <td style="font-size:11.5px;">
                      <span class="badge ${safetyCls}">${escHtml(SAFETY_LABELS[sp.safety] || sp.safety)}</span>
                      <div class="muted" style="margin-top:2px;">${c.defAssist ? "招架振刀" : "回避时停"}</div>
                    </td>
                    <td style="font-size:11.5px;">
                      <span class="mpill">${escHtml(barSpec.zhName)} (${Math.round(barSpec.baseTotalMv * 100)}%)</span>
                    </td>
                    <td style="text-align:right;">
                      <button type="button" class="btn btn-xs btn-tonal" data-wiki-deploy="${escHtml(c.id)}">载入1号位</button>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderEnergyCalcTab(): string {
  const e = wikiState.energy;
  const ch = CHAR_MAP[e.cid] || SC_CHARS[0];
  const pctBonus = (e.wepErPct / 100) + (e.has2pcEr ? 0.20 : 0) + (e.hasD6Er ? 0.60 : 0);
  const initEr = e.baseEr * (1 + pctBonus);
  const effErPerSec = (initEr + e.wepErFlat) * (1 + e.wepErRate / 100);

  const passiveEnergy = effErPerSec * e.cycleSec;
  const totalEnergyIn = passiveEnergy + e.activeEnergyGen + e.teamEnergyRestore;
  const totalEnergyNeed = e.exCount * e.exCost;
  const energyNet = totalEnergyIn - totalEnergyNeed;
  const energyOk = energyNet >= -0.05;

  // Solve minimum required passive ER% bonus (on top of baseEr + wepErFlat + active/team energy)
  const neededPassiveTotal = Math.max(0, totalEnergyNeed - e.activeEnergyGen - e.teamEnergyRestore);
  const neededEffEr = e.cycleSec > 0 ? neededPassiveTotal / e.cycleSec : 0;
  const neededInitEr = Math.max(0, neededEffEr / Math.max(0.1, 1 + e.wepErRate / 100) - e.wepErFlat);
  const minErPctBonus = Math.max(0, neededInitEr / Math.max(0.1, e.baseEr) - 1);
  const minErPctDisp = Math.round(minErPctBonus * 100);
  const curErPctDisp = Math.round(pctBonus * 100);

  let verdict = "";
  let verdictCls = "b-ok";
  if (minErPctBonus <= 0.001) {
    verdict = "无需任何回能盘/回能2件套即可无缝循环，6号盘可放心带攻击%/掌控%/冲击%";
  } else if (minErPctBonus <= 0.201) {
    verdict = "仅需 2件套(摇摆/月光 +20%回能) 或低词条音擎即可达标，可省下6号盘";
    verdictCls = "b-info";
  } else if (minErPctBonus <= 0.601) {
    verdict = "需要携带「6号回能盘 (+60%)」或音擎回能主词条才不断档";
    verdictCls = energyOk ? "b-ok" : "b-warn";
  } else if (minErPctBonus <= 0.801) {
    verdict = "高压循环：需同时携带「6号回能盘 (+60%) + 摇摆/月光2件套 (+20%)」";
    verdictCls = energyOk ? "b-ok" : "b-warn";
  } else {
    verdict = "仅靠驱动盘回能无法单人自循环，需配合队友回能/回能音擎，或减少每轮强化E次数";
    verdictCls = "b-warn";
  }

  const cyclesPerUlt = e.decibelPerCycle > 0 ? e.decibelCap / e.decibelPerCycle : 99;
  const activeSlots = appStore.state.slots
    .map((s, idx) => (s?.cid && CHAR_MAP[s.cid] ? { idx, name: CHAR_MAP[s.cid].n } : null))
    .filter((x): x is { idx: number; name: string } => Boolean(x));

  return `
    <div class="ws-grid-2">
      <div class="card">
        <div class="row" style="justify-content:space-between;margin-bottom:10px;">
          <div class="sec-mini-title" style="margin:0;">回能 &amp; 喧响循环参数配置</div>
          <div class="row" style="gap:4px;">
            ${activeSlots
              .map(
                (s) =>
                  `<button type="button" class="btn btn-xs btn-tonal" data-er-sync-slot="${s.idx}">同步${s.idx + 1}号·${escHtml(s.name)}</button>`
              )
              .join("")}
          </div>
        </div>

        <div class="ws-grid-3">
          <label class="ws-field"><span>目标代理人</span>
            <select id="er_cid">
              ${SC_CHARS.map(
                (c) => `<option value="${escHtml(c.id)}" ${c.id === ch.id ? "selected" : ""}>[${c.p}] ${escHtml(c.n)} (${(c.er || 1.2).toFixed(2)}/s)</option>`
              ).join("")}
            </select>
          </label>
          <label class="ws-field"><span>基础自动回能 (/s)</span><input type="number" step="0.02" min="0.5" max="3.5" id="er_base" value="${e.baseEr}"></label>
          <label class="ws-field"><span>循环轴长 (秒)</span><input type="number" step="0.5" min="8" max="45" id="er_cycle" value="${e.cycleSec}"></label>

          <label class="ws-field"><span>音擎/外部回能%</span><input type="number" step="5" min="0" max="120" id="er_wep_pct" value="${e.wepErPct}"></label>
          <label class="ws-field"><span>局内固定回能 (+/s)</span><input type="number" step="0.05" min="0" max="3.0" id="er_wep_flat" value="${e.wepErFlat}"></label>
          <label class="ws-field"><span>局内产球效率 (+%)</span><input type="number" step="2" min="0" max="100" id="er_wep_rate" value="${e.wepErRate}"></label>

          <label class="ws-field"><span>每轮强化E释放次数</span><input type="number" step="0.5" min="0" max="6" id="er_ex_cnt" value="${e.exCount}"></label>
          <label class="ws-field"><span>单次强化E耗能</span><input type="number" step="5" min="20" max="100" id="er_ex_cost" value="${e.exCost}"></label>
          <label class="ws-field"><span>普攻/振刀主动回能</span><input type="number" step="2" min="0" max="120" id="er_active" value="${e.activeEnergyGen}"></label>

          <label class="ws-field"><span>队友固定回能 (如柚叶大招)</span><input type="number" step="5" min="0" max="80" id="er_team" value="${e.teamEnergyRestore}"></label>
          <label class="ws-field"><span>喧响上限 (橘福福/叶瞬光4000)</span>
            <select id="er_dec_cap">
              <option value="3000" ${e.decibelCap === 3000 ? "selected" : ""}>3000 标准上限</option>
              <option value="4000" ${e.decibelCap === 4000 ? "selected" : ""}>4000 扩容上限</option>
            </select>
          </label>
          <label class="ws-field"><span>单轮动作获取喧响</span><input type="number" step="50" min="300" max="5000" id="er_dec_gen" value="${e.decibelPerCycle}"></label>
        </div>

        <div class="row" style="gap:10px;margin-top:10px;">
          <label class="chk-pill"><input type="checkbox" id="er_2pc" ${e.has2pcEr ? "checked" : ""}> 佩戴摇摆/月光 2 件套 (+20% 回能)</label>
          <label class="chk-pill"><input type="checkbox" id="er_d6" ${e.hasD6Er ? "checked" : ""}> 佩戴 6 号回能主词条盘 (+60% 回能)</label>
        </div>
      </div>

      <div class="card wiki-er-result">
        <div class="row" style="justify-content:space-between;margin-bottom:10px;">
          <div class="sec-mini-title" style="margin:0;">循环达标诊断 · ${escHtml(ch.n)}</div>
          <span class="badge ${energyOk ? "b-ok" : "b-warn"}">${energyOk ? "✓ 回能达标" : "⚠ 回能未达标"}</span>
        </div>

        <div class="wiki-er-kpis">
          <div class="wiki-er-kpi">
            <span class="muted">有效每秒回能</span>
            <strong class="mono">${effErPerSec.toFixed(2)} / s</strong>
            <small class="muted">局外面板 ${initEr.toFixed(2)}/s (+${curErPctDisp}%)</small>
          </div>
          <div class="wiki-er-kpi">
            <span class="muted">单轮能量收支</span>
            <strong class="mono ${energyOk ? "txt-ok" : "txt-warn"}">${totalEnergyIn.toFixed(1)} / ${totalEnergyNeed.toFixed(0)}</strong>
            <small class="mono ${energyOk ? "txt-ok" : "txt-warn"}">${energyNet >= 0 ? `结余 +${energyNet.toFixed(1)}` : `缺口 ${energyNet.toFixed(1)} 点`}</small>
          </div>
          <div class="wiki-er-kpi">
            <span class="muted">最低回能%阈值</span>
            <strong class="mono">+${minErPctDisp}%</strong>
            <small class="muted">当前已配 +${curErPctDisp}%</small>
          </div>
          <div class="wiki-er-kpi">
            <span class="muted">大招终结技频率</span>
            <strong class="mono">${cyclesPerUlt <= 1.05 ? "每轮 1 大" : `约 ${cyclesPerUlt.toFixed(2)} 轮 1 大`}</strong>
            <small class="muted">3分钟约开 ${(180 / Math.max(8, e.cycleSec) / Math.max(0.5, cyclesPerUlt)).toFixed(1)} 次大招</small>
          </div>
        </div>

        <div class="dil-breakeven-box" style="margin-top:12px;">
          <span class="badge ${verdictCls}" style="margin-right:6px;">配装建议</span>
          <span>${escHtml(verdict)}</span>
        </div>

        <div class="muted" style="font-size:11.5px;margin-top:10px;line-height:1.6;">
          <div>• 自动回能贡献：<strong>${passiveEnergy.toFixed(1)}</strong> 点 (${effErPerSec.toFixed(2)}/s × ${e.cycleSec}s)</div>
          <div>• 主动受击/普攻 + 队友回能：<strong>${(e.activeEnergyGen + e.teamEnergyRestore).toFixed(0)}</strong> 点</div>
          <div>• 提示：若在「02 合轴与排轴」开启实轴驱动，主计算器会自动按 0.05s 步长实时校验能量断档与喧响缺口。</div>
        </div>
      </div>
    </div>
  `;
}

function renderGearCodexTab(): string {
  const q = wikiState.gearSearch.trim().toLowerCase();
  const isWep = wikiState.gearKind === "weps";

  let tableHtml = "";
  if (isWep) {
    const list = WEP_LIST.filter((w) => {
      if (wikiState.gearRole !== "ALL" && w.wt !== wikiState.gearRole) return false;
      if (wikiState.gearRank !== "ALL" && w.r !== wikiState.gearRank) return false;
      if (q) {
        const hay = `${w.n} ${w.id} ${w.p} ${w.sn} ${w.descR1 || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    tableHtml = `
      <div class="dil-table-wrap" style="margin-top:10px;">
        <table class="dil-table">
          <thead>
            <tr>
              <th>音擎</th>
              <th>职业 / 稀有度</th>
              <th>Lv.60 白值与副属性</th>
              <th>特效摘要</th>
            </tr>
          </thead>
          <tbody>
            ${list
              .map((w) => {
                const subTxt =
                  w.sn === "Anomaly Proficiency"
                    ? `异常精通 +${Math.round(w.sv || 0)}`
                    : `${SN_ZH[w.sn] || w.sn} +${((w.sv || 0) * 100).toFixed(1)}%`;
                const owner = SC_CHARS.find((c) => c.sig === w.id);
                return `
                  <tr>
                    <td>
                      <div class="row" style="gap:8px;flex-wrap:nowrap;">
                        ${renderWeaponThumb(w.id, w.n, w.r, "wep-sm")}
                        <div>
                          <strong>${escHtml(w.n)}</strong>
                          ${owner ? `<span class="badge b-info">${escHtml(owner.n)}专</span>` : ""}
                        </div>
                      </div>
                    </td>
                    <td><span class="badge">${escHtml(w.r)}级 · ${escHtml(w.p)}</span></td>
                    <td class="mono" style="font-size:11.5px;">基础攻 ${w.batk}${w.bdef ? ` / 防 ${w.bdef}` : ""} · <strong>${escHtml(subTxt)}</strong></td>
                    <td class="muted" style="font-size:11.5px;max-width:440px;">${escHtml(w.descR1 || "内置精算模型已完整建模")}</td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  } else {
    const sets = Object.values(DISC_SETS).filter((s) => {
      if (s.id === "无") return false;
      if (q) {
        const hay = `${s.name} ${s.id} ${s.d2 || ""} ${s.d4 || ""} ${s.cat || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    tableHtml = `
      <div class="dil-table-wrap" style="margin-top:10px;">
        <table class="dil-table">
          <thead>
            <tr>
              <th>驱动盘套装</th>
              <th>定位标签</th>
              <th>2 件套效果</th>
              <th>4 件套效果</th>
            </tr>
          </thead>
          <tbody>
            ${sets
              .map(
                (s) => `
              <tr>
                <td>
                  <div class="row" style="gap:8px;flex-wrap:nowrap;">
                    ${renderDiscVinyl(s.id, s.name, "disc-sm")}
                    <strong>${escHtml(s.name)}</strong>
                  </div>
                </td>
                <td>
                  <span class="badge">${escHtml(s.cat || "通用")}</span>
                  ${s.roleReq ? `<span class="badge b-warn">限${escHtml(s.roleReq)}</span>` : ""}
                </td>
                <td style="font-size:12px;">${escHtml(s.d2 || "-")}</td>
                <td style="font-size:12px;max-width:460px;">${escHtml(s.d4 || "-")}</td>
              </tr>
            `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  return `
    <div class="card">
      <div class="wiki-filter-bar">
        <div class="ws-tabs" style="margin:0;">
          <button type="button" class="tab-btn ${isWep ? "active" : ""}" data-wg-kind="weps">全音擎图鉴 (${WEP_LIST.length})</button>
          <button type="button" class="tab-btn ${!isWep ? "active" : ""}" data-wg-kind="discs">全驱动盘套装 (${Object.keys(DISC_SETS).length - 1})</button>
        </div>
        <input type="text" id="wikiGearSearch" placeholder="搜索名称 / 效果关键字..." value="${escHtml(wikiState.gearSearch)}" style="width:210px;">
        ${
          isWep
            ? `
          <div class="pill-bar">
            ${["ALL", "S", "A", "B"]
              .map(
                (rk) =>
                  `<button type="button" class="pill ${wikiState.gearRank === rk ? "active" : ""}" data-wg-rank="${rk}">${rk === "ALL" ? "全稀有度" : `${rk}级`}</button>`
              )
              .join("")}
          </div>
          <div class="pill-bar">
            <button type="button" class="pill ${wikiState.gearRole === "ALL" ? "active" : ""}" data-wg-role="ALL">全职业</button>
            ${ALL_SPECIALTIES.map(
              (sp) => `<button type="button" class="pill ${wikiState.gearRole === sp.wt ? "active" : ""}" data-wg-role="${sp.wt}">${sp.zh}</button>`
            ).join("")}
          </div>
        `
            : ""
        }
      </div>
      ${tableHtml}
    </div>
  `;
}

export function renderMechanicsWikiSection(): void {
  const wrap = document.getElementById("sec07WikiBody");
  if (!wrap) return;
  const view = appStore.state.studioView || "build";
  if (view !== "wiki" && view !== "all") return;

  const tabs: Array<{ id: WikiTab; label: string }> = [
    { id: "formulas", label: "伤害公式与异常系数" },
    { id: "agents", label: `全 ${SC_CHARS.length} 代理人帧数与底层表` },
    { id: "energy", label: "回能与喧响阈值计算器" },
    { id: "gear", label: "音擎 & 驱动盘图鉴速查" }
  ];

  let bodyHtml = "";
  if (wikiState.tab === "formulas") bodyHtml = renderFormulasTab();
  else if (wikiState.tab === "agents") bodyHtml = renderAgentsTab();
  else if (wikiState.tab === "energy") bodyHtml = renderEnergyCalcTab();
  else bodyHtml = renderGearCodexTab();

  wrap.innerHTML = `
    <div class="ws-tabs" style="margin-bottom:12px;">
      ${tabs
        .map(
          (t) =>
            `<button type="button" class="tab-btn ${wikiState.tab === t.id ? "active" : ""}" data-wiki-tab="${t.id}">${escHtml(t.label)}</button>`
        )
        .join("")}
    </div>
    ${bodyHtml}
  `;

  bindWikiEvents(wrap);
  localizeDOM(wrap, appStore.state.lang || "zh");
}

function bindWikiEvents(wrap: HTMLElement): void {
  wrap.querySelectorAll<HTMLButtonElement>("[data-wiki-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      wikiState.tab = (btn.dataset.wikiTab as WikiTab) || "formulas";
      renderMechanicsWikiSection();
    });
  });

  const lvDet = document.getElementById("wikiLvDetails") as HTMLDetailsElement | null;
  lvDet?.addEventListener("toggle", () => {
    wikiState.lvTableOpen = !!lvDet.open;
  });

  // Agents filter bindings
  const aSearch = document.getElementById("wikiAgentSearch") as HTMLInputElement | null;
  aSearch?.addEventListener("input", () => {
    wikiState.agentSearch = aSearch.value;
    renderMechanicsWikiSection();
    const nextInp = document.getElementById("wikiAgentSearch") as HTMLInputElement | null;
    if (nextInp) {
      nextInp.focus();
      nextInp.setSelectionRange(nextInp.value.length, nextInp.value.length);
    }
  });
  wrap.querySelectorAll<HTMLButtonElement>("[data-wa-elem]").forEach((b) => {
    b.addEventListener("click", () => {
      wikiState.agentElem = b.dataset.waElem || "ALL";
      renderMechanicsWikiSection();
    });
  });
  wrap.querySelectorAll<HTMLButtonElement>("[data-wa-role]").forEach((b) => {
    b.addEventListener("click", () => {
      wikiState.agentRole = b.dataset.waRole || "ALL";
      renderMechanicsWikiSection();
    });
  });
  wrap.querySelectorAll<HTMLButtonElement>("[data-wiki-deploy]").forEach((b) => {
    b.addEventListener("click", () => {
      const cid = b.dataset.wikiDeploy;
      if (!cid) return;
      appStore.state.studioView = "build";
      assignCharacterToSlot(0, cid);
    });
  });

  // Energy calculator bindings
  wrap.querySelectorAll<HTMLButtonElement>("[data-er-sync-slot]").forEach((b) => {
    b.addEventListener("click", () => {
      syncEnergyFromSlot(Number(b.dataset.erSyncSlot));
      renderMechanicsWikiSection();
    });
  });
  const bindErNum = (id: string, key: keyof EnergyCalcState) => {
    document.getElementById(id)?.addEventListener("change", (ev: any) => {
      (wikiState.energy as any)[key] = parseFloat(ev.target.value) || 0;
      renderMechanicsWikiSection();
    });
  };
  document.getElementById("er_cid")?.addEventListener("change", (ev: any) => {
    const cid = ev.target.value;
    const ch = CHAR_MAP[cid];
    if (ch) {
      wikiState.energy.cid = cid;
      wikiState.energy.baseEr = Number((ch.er || 1.2).toFixed(2));
      const w = SC_WEPS[ch.sig];
      const weff = w ? getWeaponEffects(ch, w, w.r === "S" ? 1 : 5, {}, null) : null;
      wikiState.energy.wepErPct = Math.round((weff?.init_er_pct || 0) * 100);
      wikiState.energy.wepErFlat = Number((weff?.c_er_flat || 0).toFixed(2));
      wikiState.energy.wepErRate = Math.round((weff?.c_er_rate || 0) * 100);
      renderMechanicsWikiSection();
    }
  });
  bindErNum("er_base", "baseEr");
  bindErNum("er_cycle", "cycleSec");
  bindErNum("er_wep_pct", "wepErPct");
  bindErNum("er_wep_flat", "wepErFlat");
  bindErNum("er_wep_rate", "wepErRate");
  bindErNum("er_ex_cnt", "exCount");
  bindErNum("er_ex_cost", "exCost");
  bindErNum("er_active", "activeEnergyGen");
  bindErNum("er_team", "teamEnergyRestore");
  bindErNum("er_dec_cap", "decibelCap");
  bindErNum("er_dec_gen", "decibelPerCycle");
  document.getElementById("er_2pc")?.addEventListener("change", (ev: any) => {
    wikiState.energy.has2pcEr = !!ev.target.checked;
    renderMechanicsWikiSection();
  });
  document.getElementById("er_d6")?.addEventListener("change", (ev: any) => {
    wikiState.energy.hasD6Er = !!ev.target.checked;
    renderMechanicsWikiSection();
  });

  // Gear codex bindings
  wrap.querySelectorAll<HTMLButtonElement>("[data-wg-kind]").forEach((b) => {
    b.addEventListener("click", () => {
      wikiState.gearKind = b.dataset.wgKind === "discs" ? "discs" : "weps";
      renderMechanicsWikiSection();
    });
  });
  wrap.querySelectorAll<HTMLButtonElement>("[data-wg-rank]").forEach((b) => {
    b.addEventListener("click", () => {
      wikiState.gearRank = b.dataset.wgRank || "ALL";
      renderMechanicsWikiSection();
    });
  });
  wrap.querySelectorAll<HTMLButtonElement>("[data-wg-role]").forEach((b) => {
    b.addEventListener("click", () => {
      wikiState.gearRole = b.dataset.wgRole || "ALL";
      renderMechanicsWikiSection();
    });
  });
  const gSearch = document.getElementById("wikiGearSearch") as HTMLInputElement | null;
  gSearch?.addEventListener("input", () => {
    wikiState.gearSearch = gSearch.value;
    renderMechanicsWikiSection();
    const nextInp = document.getElementById("wikiGearSearch") as HTMLInputElement | null;
    if (nextInp) {
      nextInp.focus();
      nextInp.setSelectionRange(nextInp.value.length, nextInp.value.length);
    }
  });

  // Suppress unused import warning while allowing future cross-view actions
  void triggerRefreshUI;
}

import {
  BANGBOOS,
  BANGBOO_MAP,
  CHAR_MAP,
  DISC_SETS,
  PRESET_TEAMS,
  SC_CHARS,
  SC_WEPS,
  STAGE_BUFFS,
  UNIVERSAL_SHELLS,
  WEP_LIST,
  customDB,
  deepClone,
  rebuildDataMaps,
  saveCustomDBToStorage
} from "../data/store";
import {
  ALL_ELEMENTS,
  ALL_SPECIALTIES,
  CHART_COLORS,
  CORE_LABELS,
  DISC_MAIN_LONG_ZH,
  DISC_MAIN_ZH,
  DISC_SLOT4_MAINS,
  DISC_SLOT5_MAINS,
  DISC_SLOT6_MAINS,
  DISC_SUB_META,
  SN_ZH,
  escHtml,
  fmtDiscZh
} from "../engine/constants";
import {
  ELEM_ACCENT_HEX,
  getAgentAccentHex,
  getAgentSplashUrl,
  getAgentFullArtUrl,
  getElemAccentHex,
  renderAgentAvatar,
  renderDiscVinyl,
  renderWeaponThumb
} from "../data/enkaAssets";
import {
  autoOptimizeTeamDiscs,
  buildDefaultSixPieces,
  calcLimitedGold,
  computeMindscapeLadder,
  computeNextGoldROI,
  findViableTeams,
  rankDiscSetsForSlot,
  rankWeaponsForSlot,
  simulateTeamV2
} from "../engine/simulator";
import {
  ARCHETYPE_LABELS,
  SAFETY_LABELS,
  SWAP_PRESETS,
  analyzeTimeline,
  calcSwapSecForMove,
  evalSwapCancelEngine,
   getCharSwapProfile,
  getMovePoolForChar,
  makeDefaultSwapConfig
} from "../engine/swapTimeline";
import { enkaVault, saveEnkaVaultToStorage } from "../enka/client";
import {
  getEffectiveSubWeightsForAgent,
  gradeSixPiecesTotal,
  scoreSixPiecesForAgent
} from "../enka/mappings";
import { syncedRecordToSlotConfig } from "../enka/parser";
import { type LangCode, localizeDOM, translateText } from "../i18n";
import { runWorkerFindViableTeams, updatePerfBadge } from "../worker/workerClient";
import {
  type StudioViewTab,
  applyPresetTeam,
  appStore,
  assignCharacterToSlot,
  ensureTimelineInitialized,
  fmtNum,
  fmtWan,
  getActiveMembersForUI,
  loadWorkspaceFromStorage,
  makeDefaultElemResMap,
  makeDefaultSlot,
  makeInitialState,
  registerRefreshHandler,
  saveWorkspaceToStorage,
  snapTimelineSequential
} from "./appState";
import { openCustomWorkshop } from "./customWorkshop";
import { getVaultSyncedSlotsMap, optimizeSlotFromVaultPool, renderEnkaPanel } from "./enkaPanel";

function applyThemeToDOM() {
  const html = document.documentElement;
  if (appStore.state.theme === "light") {
    html.classList.add("light");
    html.classList.remove("dark");
  } else {
    html.classList.add("dark");
    html.classList.remove("light");
  }
  const btn = document.getElementById("themeToggleBtn");
  if (btn) btn.textContent = appStore.state.theme === "light" ? "切换暗色主题" : "切换亮色主题";
}

function applyLangBarState() {
  const cur = appStore.state.lang || "zh";
  document.querySelectorAll<HTMLButtonElement>("#langSwitchBar .lang-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lang === cur);
  });
}

let finderSeq = 0;
let finderLoading = false;
let finderElapsedMs = 0;
let finderCacheKey = "";
let finderCachedTeams: any[] = [];
let physicsDrawerOpen = false;
const EVAL_WEP_TOP_N = 8;
let evalWepShowAll = false;

export function refreshAllUI() {
  applyThemeToDOM();
  applyLangBarState();
  if (STAGE_BUFFS[appStore.state.env.stageId]) {
    appStore.state.env.stageBuffs = deepClone(STAGE_BUFFS[appStore.state.env.stageId]);
  }
  ensureTimelineInitialized(false);
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  appStore.lastSimResult = simulateTeamV2(appStore.state.slots, appStore.state.env, CHAR_MAP, SC_WEPS);
  const dt = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0;
  updatePerfBadge(`TS精算: ${dt.toFixed(1)} ms`);
  saveWorkspaceToStorage();

  applyStudioVisibility();
  renderTopBarState();
  renderLiveTelemetryBar(appStore.lastSimResult);
  renderSnapshotBar(appStore.lastSimResult);
  renderStudioNavBar(appStore.lastSimResult);
  renderEnkaPanel();
  renderSection03SlotCards(appStore.lastSimResult);
  renderQuickPresetRibbon();
  renderSection01Picker();
  renderSection02KPIsAndDiag(appStore.lastSimResult);
  renderSection04SwapAndTimeline(appStore.lastSimResult);
  renderSection05EvalCenter(appStore.lastSimResult);
  renderSection06Environment();
  localizeDOM(document.body, appStore.state.lang || "zh");
}

function applyStudioVisibility() {
  const view: StudioViewTab = appStore.state.studioView || "build";
  const showMap: Record<string, boolean> = {
    sec03: view === "build" || view === "enka" || view === "all",
    sec01: view === "build" || view === "all",
    sec04: view === "timeline" || view === "all",
    sec02: view === "diag" || view === "all",
    sec05: view === "eval" || view === "all",
    sec06: view === "env" || view === "all"
  };
  Object.entries(showMap).forEach(([id, visible]) => {
    const el = document.getElementById(id);
    if (el) el.hidden = !visible;
  });

  const sec01Body = document.getElementById("sec01Body");
  if (sec01Body) {
    sec01Body.hidden = !!appStore.state.pickerCollapsed;
  }
  const collapseBtn = document.getElementById("togglePickerCollapseBtn");
  if (collapseBtn) {
    collapseBtn.textContent = appStore.state.pickerCollapsed
      ? `展开全部配队与选人 (${PRESET_TEAMS.length}队 / ${SC_CHARS.length}人) ▼`
      : "收起选人台 ▲";
    collapseBtn.className = appStore.state.pickerCollapsed ? "btn btn-tonal" : "btn";
  }
}

function renderTopBarState() {
  const modTotal =
    Object.keys(customDB.chars).length +
    Object.keys(customDB.weps).length +
    Object.keys(customDB.discSets).length +
    Object.keys(customDB.bangboos).length;
  const wsBtn = document.getElementById("openWorkshopTopBtn");
  if (wsBtn) {
    wsBtn.textContent = modTotal > 0 ? `自定义工坊 (已改${modTotal}项)` : "自定义工坊";
  }
}

function renderLiveTelemetryBar(sim: any) {
  const el = document.getElementById("liveTelemetryBar");
  if (!el) return;
  const isDps = appStore.state.env.metricMode !== "dpr";
  const aaAllOk = sim.activeCount > 0 && sim.aaLitCount === sim.activeCount;
  const limGold = calcLimitedGold(appStore.state.slots, CHAR_MAP, SC_WEPS);
  const qa = sim.qaSwap;
  const bbShare = sim.baseWeightedSum > 0 ? sim.bangbooDmg / sim.baseWeightedSum : 0;

  const heroVal = isDps ? fmtNum(sim.teamActualDps) : fmtWan(sim.teamDpr);
  const heroUnit = isDps ? "/ 秒" : "/ 轮";
  const heroCaption = isDps ? "合轴后每秒伤害 (DPS)" : "一轮爆发总伤害 (DPR)";

  const shareRows = (sim.slotResults || []).map((r: any, i: number) => ({
    color: CHART_COLORS[i],
    pct: r.dpsShare * 100,
    name: r.ch.n,
    avatar: renderAgentAvatar(r.ch.id, r.ch.n, r.ch.eb, "av-xs")
  }));

  const maxPct = Math.max(1, ...shareRows.map((r: any) => r.pct), bbShare * 100);

  el.innerHTML = `
    <div class="tele-top-row">
      <span class="tele-title">队伍总输出</span>
      <div class="metric-switch" role="group" aria-label="主口径切换">
        <button type="button" class="metric-switch-btn ${isDps ? "active" : ""}" data-set-metric="dps">每秒 DPS</button>
        <button type="button" class="metric-switch-btn ${!isDps ? "active" : ""}" data-set-metric="dpr">单轮 DPR</button>
      </div>
    </div>

    <div class="tele-hero-metric">
      <span class="tele-hero-caption">${heroCaption}</span>
      <div class="tele-hero-number">
        <span class="tele-hero-val">${heroVal}</span>
        <span class="tele-hero-unit">${heroUnit}</span>
      </div>
    </div>

    <div class="tele-badges">
      <span class="badge b-info mono">${limGold} 限定金</span>
      ${
        sim.activeCount > 0
          ? `<span class="badge ${aaAllOk ? "b-ok" : "b-warn"}">${aaAllOk ? `额外能力 ${sim.aaLitCount}/${sim.activeCount} 激活` : `额外能力 ${sim.aaLitCount}/${sim.activeCount} 未满`}</span>`
          : ""
      }
    </div>

    <dl class="tele-sub-metrics">
      <div class="tele-stat-cell">
        <dt class="tele-stat-label">${isDps ? "单轮总伤 DPR" : "真实每秒 DPS"}</dt>
        <dd class="tele-stat-val">${isDps ? fmtWan(sim.teamDpr) : fmtNum(sim.teamActualDps)}</dd>
        <dd class="tele-stat-note">较单人放大 ${(sim.teamVsSolo || 1).toFixed(2)}×</dd>
      </div>
      <div class="tele-stat-cell">
        <dt class="tele-stat-label">一轮循环耗时</dt>
        <dd class="tele-stat-val">${(sim.cycleSec || 0).toFixed(2)}s</dd>
        <dd class="tele-stat-note">合轴省 ${(qa?.savedOverlapSec || 0).toFixed(1)}s</dd>
      </div>
      <div class="tele-stat-cell">
        <dt class="tele-stat-label">危局3分钟预估</dt>
        <dd class="tele-stat-val">${fmtWan(sim.da3MinTotal)}</dd>
        <dd class="tele-stat-note">约 ${Math.max(1, (180 / Math.max(6, sim.cycleSec || 18))).toFixed(1)} 轮循环</dd>
      </div>
    </dl>

    <div class="tele-share-footer">
      <div class="tele-share-head">
        <span>输出占比</span>
        <span class="mono">${SWAP_PRESETS[appStore.state.env.swapConfig?.preset]?.name || "自定义合轴"}</span>
      </div>
      <div class="tele-share-rows">
        ${
          shareRows.length > 0
            ? shareRows
                .map(
                  (r: any) => `
              <div class="tele-share-row" style="--lg-c:${r.color};" title="${escHtml(r.name)}: ${r.pct.toFixed(1)}%">
                ${r.avatar}
                <span class="tele-share-track"><span class="tele-share-fill" style="width:${((r.pct / maxPct) * 100).toFixed(1)}%"></span><span class="tele-legend-name">${escHtml(r.name)}</span></span>
                <span class="tele-legend-pct mono">${r.pct.toFixed(1)}%</span>
              </div>`
                )
                .join("")
            : `<span class="muted">暂无上阵代理人</span>`
        }
        ${
          bbShare > 0.002
            ? `<div class="tele-share-row bb" style="--lg-c:var(--chart-5);" title="邦布: ${(bbShare * 100).toFixed(1)}%">
                <span class="tele-bb-tag">BB</span>
                <span class="tele-share-track"><span class="tele-share-fill" style="width:${((bbShare * 100 / maxPct) * 100).toFixed(1)}%"></span><span class="tele-legend-name">邦布</span></span>
                <span class="tele-legend-pct mono">${(bbShare * 100).toFixed(1)}%</span>
              </div>`
            : ""
        }
      </div>
    </div>
  `;

  el.querySelectorAll<HTMLButtonElement>("[data-set-metric]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.dataset.setMetric === "dpr" ? "dpr" : "dps";
      if (appStore.state.env.metricMode !== next) {
        appStore.state.env.metricMode = next;
        refreshAllUI();
      }
    });
  });
}

function renderStudioNavBar(sim: any) {
  const nav = document.getElementById("studioNavBar");
  if (!nav) return;
  const cur = appStore.state.studioView || "build";
  const vaultCount = Object.keys(enkaVault.agents || {}).length;
  const aaWarn = sim.activeCount > 0 && sim.aaLitCount < sim.activeCount ? 1 : 0;

  const tabs: Array<{ id: StudioViewTab; step: number; label: string; ico: string; count?: string; warn?: boolean }> = [
    { id: "build", step: 1, label: "配队配装", ico: "ico-squad", count: `${sim.activeCount || 0}/3` },
    { id: "timeline", step: 2, label: "合轴排轴", ico: "ico-timeline", count: `${(sim.cycleSec || 0).toFixed(1)}s` },
    { id: "diag", step: 3, label: "伤害分析", ico: "ico-chart", count: aaWarn ? "!" : undefined, warn: Boolean(aaWarn) },
    { id: "eval", step: 4, label: "养成收益", ico: "ico-growth" },
    { id: "env", step: 5, label: "敌人环境", ico: "ico-target" }
  ];

  nav.innerHTML = `
    ${tabs
      .map(
        (t) => `
      <button type="button" class="studio-tab has-icon ${t.ico} ${cur === t.id ? "active" : ""}" data-studio-tab="${t.id}" title="${t.label}">
        <span class="tab-step" data-no-i18n>${String(t.step).padStart(2, "0")}</span>
        <span class="tab-label">${t.label}</span>
        ${t.count ? `<span class="tab-count ${t.warn ? "warn" : ""}">${t.count}</span>` : ""}
      </button>
    `
      )
      .join("")}
    <span class="studio-nav-spacer" aria-hidden="true"></span>
    <button type="button" class="studio-tab util has-icon ico-sync ${cur === "enka" ? "active" : ""}" data-studio-tab="enka" title="UID 展柜同步">
      <span class="tab-label">UID 展柜</span>
      <span class="tab-count">${vaultCount > 0 ? `${vaultCount}` : "Sync"}</span>
    </button>
    <button type="button" class="studio-tab util has-icon ico-expand ${cur === "all" ? "active" : ""}" data-studio-tab="all" title="全部展开">
      <span class="tab-label">全部展开</span>
    </button>
  `;

  nav.querySelectorAll<HTMLButtonElement>("[data-studio-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = (btn.dataset.studioTab as StudioViewTab) || "build";
      appStore.state.studioView = next;
      if (next === "enka") {
        appStore.state.enkaPanelOpen = true;
      }
      refreshAllUI();
    });
  });
}

// ============================================================================
// Active Lineup Deck & 4-Track Tape Snapshot Memory Bank (A / B / C / D)
// ============================================================================
function renderSnapshotBar(sim: any) {
  const el = document.getElementById("snapshotBar");
  if (!el) return;
  const active = getActiveMembersForUI();
  const bb = BANGBOO_MAP[appStore.state.env.bangbooId];
  const labels = ["A", "B", "C", "D"];
  const curVal = sim.teamDps || 0;

  el.innerHTML = `
    <div class="memory-head">
      <span class="tele-eyebrow"><span class="tele-title">当前编队</span></span>
      <button type="button" class="btn btn-xs btn-ghost" id="hudOpenRosterBtn">切换编队 / 搜队 ▾</button>
    </div>

    <div class="telemetry-squad">
      ${
        active.length > 0
          ? active
              .map((m) => {
                const w = SC_WEPS[m.cfg.wid];
                const ref = m.cfg.ref ?? 1;
                const elemHex = getElemAccentHex(m.ch.eb, m.ch.id);
                const bustUrl = getAgentSplashUrl(m.ch.id);
                const fullUrl = getAgentFullArtUrl(m.ch.id);
                const artUrl = bustUrl || fullUrl;
                return `
                  <span class="squad-pill ${artUrl ? "has-art" : ""}" style="--slot-elem:${elemHex};" data-hud-jump="build" title="点击定位配装台 · ${escHtml(m.ch.n)}">
                    ${
                      artUrl
                        ? `<span class="squad-pill-bg" data-no-i18n="1"><img class="squad-pill-art" src="${escHtml(artUrl)}" alt="" loading="eager" decoding="async" referrerpolicy="no-referrer" ${bustUrl && fullUrl && bustUrl !== fullUrl ? `data-alt-src="${escHtml(fullUrl)}"` : ""} onerror="if(this.dataset.altSrc){this.src=this.dataset.altSrc;this.removeAttribute('data-alt-src');this.classList.add('is-full');}else{this.parentElement.style.display='none';this.closest('.squad-pill').classList.remove('has-art');}"></span>`
                        : ""
                    }
                    <span class="squad-pos-tag" data-no-i18n>0${m.slotIdx + 1}</span>
                    <span class="squad-pill-copy">
                      <span class="squad-pill-name">${escHtml(m.ch.n)}</span>
                      <span class="squad-meta mono" data-no-i18n>${m.ch.r} · M${m.m}${w ? ` · R${ref}` : ""}</span>
                    </span>
                    ${w ? `<span class="squad-wep-chip">${renderWeaponThumb(w.id, w.n, w.r, "wep-xs")}</span>` : ""}
                  </span>
                `;
              })
              .join("")
          : `<span class="muted">当前未上阵角色</span>`
      }
      ${
        bb && bb.id !== "none"
          ? `<span class="squad-pill squad-pill-bb"><span class="squad-meta">邦布</span><span>${escHtml(bb.n)}</span></span>`
          : ""
      }
    </div>

    <div class="snap-bank-header">
      <span class="snap-bank-title">方案对比</span>
      <span class="snap-bank-hint">存档当前配置，修改后即可看到伤害涨跌</span>
    </div>
    <div class="snap-grid">
      ${labels
        .map((lb, idx) => {
          const sn = appStore.state.snapshots[idx];
          if (!sn) {
            return `
              <button type="button" class="snap-card empty" data-snap-save="${idx}" title="点击存入当前配装">
                <span class="snap-slot-key" data-no-i18n>${lb}</span>
                <span class="snap-empty-txt">+ 存档</span>
              </button>
            `;
          }
          const refVal =
            appStore.state.env.metricMode === "dpr"
              ? sn.baseWeightedSum || sn.teamDps
              : sn.teamActualDps || sn.teamDps;
          const diff = refVal > 0 ? curVal / refVal - 1 : 0;
          const diffStr =
            diff >= 0
              ? `当前 +${(diff * 100).toFixed(1)}%`
              : `当前 ${(diff * 100).toFixed(1)}%`;
          const diffCls = diff >= 0.002 ? "pos" : diff <= -0.002 ? "neg" : "";
          const snapAvs = (sn.slots || [])
            .filter((s: any) => s?.cid && CHAR_MAP[s.cid])
            .map((s: any) => {
              const sc = CHAR_MAP[s.cid];
              return renderAgentAvatar(sc.id, sc.n, sc.eb, "av-2xs");
            })
            .join("");
          return `
            <div class="snap-card filled">
              <div class="snap-main" data-snap-load="${idx}" title="点击回档此快照">
                <div class="snap-title-row">
                  <span class="snap-slot-key">${lb}</span>
                  ${snapAvs ? `<span class="qp-avatar-stack">${snapAvs}</span>` : ""}
                  <span class="snap-title-txt">${escHtml(sn.title)}</span>
                </div>
                <div class="snap-sub-row mono">
                  <span>${fmtNum(sn.teamActualDps)}/s · ${fmtWan(sn.teamDpr)}</span>
                  <span class="snap-diff ${diffCls}">${diffStr}</span>
                </div>
              </div>
              <button type="button" class="snap-del" data-snap-clear="${idx}" title="清除快照">×</button>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  el.querySelector("#hudOpenRosterBtn")?.addEventListener("click", () => {
    appStore.state.studioView = "build";
    appStore.state.pickerCollapsed = false;
    refreshAllUI();
    document.getElementById("sec01")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  el.querySelectorAll<HTMLElement>("[data-hud-jump]").forEach((pill) => {
    pill.addEventListener("click", () => {
      appStore.state.studioView = "build";
      refreshAllUI();
      document.getElementById("sec03")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  el.querySelectorAll<any>("[data-snap-save]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.snapSave);
      const names =
        appStore.state.slots
          .filter((s) => s?.cid && CHAR_MAP[s.cid])
          .map((s) => CHAR_MAP[s!.cid].n)
          .join("+") || "空编队";
      const spName = SWAP_PRESETS[appStore.state.env.swapConfig?.preset]?.tag || "自定轴";
      appStore.state.snapshots[idx] = {
        title: `${names} [${spName}]`,
        teamDps: sim.teamDps,
        teamActualDps: sim.teamActualDps,
        teamDpr: sim.teamDpr,
        baseWeightedSum: sim.baseWeightedSum,
        cycleSec: sim.cycleSec,
        slots: deepClone(appStore.state.slots),
        env: deepClone(appStore.state.env),
        timelineBlocks: deepClone(appStore.state.timelineBlocks)
      };
      saveWorkspaceToStorage();
      renderSnapshotBar(sim);
      localizeDOM(el, appStore.state.lang || "zh");
    });
  });

  el.querySelectorAll<any>("[data-snap-load]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sn = appStore.state.snapshots[Number(btn.dataset.snapLoad)];
      if (!sn) return;
      appStore.state.slots = deepClone(sn.slots);
      appStore.state.env = deepClone(sn.env);
      appStore.state.timelineBlocks = deepClone(sn.timelineBlocks || []);
      refreshAllUI();
    });
  });

  el.querySelectorAll<any>("[data-snap-clear]").forEach((btn) => {
    btn.addEventListener("click", (e: Event) => {
      e.stopPropagation();
      appStore.state.snapshots[Number(btn.dataset.snapClear)] = null;
      saveWorkspaceToStorage();
      renderSnapshotBar(sim);
      localizeDOM(el, appStore.state.lang || "zh");
    });
  });
}

// ============================================================================
// Quick Formula Ribbon (1-Click Meta Squad Switcher Above the Fold)
// ============================================================================
function renderQuickPresetRibbon() {
  const ribbon = document.getElementById("quickPresetRibbon");
  if (!ribbon) return;

  if (!appStore.state.pickerCollapsed) {
    ribbon.innerHTML = "";
    ribbon.hidden = true;
    return;
  }
  ribbon.hidden = false;

  const curIds = appStore.state.slots.map((s) => s?.cid || "").join("-");
  const featured = PRESET_TEAMS.slice(0, 8);

  ribbon.innerHTML = `
    <div class="quick-preset-bar">
      <span class="quick-preset-label">热门速切编队</span>
      ${featured
        .map((p) => {
          const pIds = (p.slots || []).map((s) => s[0]).join("-");
          const isCur = pIds === curIds;
          const shortTitle = p.name.match(/【(.+?)】/)?.[1] || p.name.slice(0, 8);
          const stackHtml = (p.slots || [])
            .slice(0, 3)
            .map((s) => {
              const c = CHAR_MAP[s[0]];
              return c ? renderAgentAvatar(c.id, c.n, c.eb, "av-xs") : "";
            })
            .join("");
          return `
            <button type="button" class="qp-chip ${isCur ? "active" : ""}" data-quick-preset="${escHtml(p.id)}" title="${escHtml(p.name)}">
              <span class="qp-avatar-stack">${stackHtml}</span>
              <span>${escHtml(shortTitle)}</span>
            </button>
          `;
        })
        .join("")}
      <button type="button" class="btn btn-xs btn-ghost" id="ribbonOpenManualBtn" style="margin-left:auto;">自由选人 / Box智能搜队 ▸</button>
    </div>
  `;

  ribbon.querySelectorAll<HTMLButtonElement>("[data-quick-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = PRESET_TEAMS.find((x) => x.id === btn.dataset.quickPreset);
      if (p) applyPresetTeam(p);
    });
  });

  ribbon.querySelector("#ribbonOpenManualBtn")?.addEventListener("click", () => {
    appStore.state.pickerCollapsed = false;
    appStore.state.pickerTab = "manual";
    refreshAllUI();
  });
}

// ============================================================================
// Section 01: Team Builder, Universal Shells, Box Finder & Mechanics Guide
// ============================================================================
function renderSection01Picker() {
  const wrap = document.getElementById("sec01Body");
  if (!wrap) return;

  const tabs = [
    { id: "presets", label: `热门与自定义公式配队 (${PRESET_TEAMS.length})` },
    { id: "manual", label: `自由选人 + 万能双拐底盘 (${SC_CHARS.length}名角色)` },
    { id: "finder", label: "我的Box智能搜队器" },
    { id: "guide", label: "四大体系与八维合轴百科" }
  ];

  let inner = "";
  if (appStore.state.pickerTab === "presets") {
    const cats = ["ALL", ...new Set(PRESET_TEAMS.map(p => p.cat))];
    const list = appStore.state.presetCat === "ALL" ? PRESET_TEAMS : PRESET_TEAMS.filter(p => p.cat === appStore.state.presetCat);
    const curIds = appStore.state.slots.map(s => s?.cid || "").join("-");

    inner = `
      <div class="row" style="justify-content:space-between;margin-bottom:10px;gap:8px;">
        <div class="pill-bar">
          ${cats.map(c => `<button type="button" class="pill ${appStore.state.presetCat === c ? "active" : ""}" data-pcat="${escHtml(c)}">${c === "ALL" ? "全部流派" : escHtml(c)}</button>`).join("")}
        </div>
        <button type="button" class="btn btn-primary" id="quickSavePresetBtn">+ 将当前编队存为自定义公式队</button>
      </div>
      <div class="preset-grid">
        ${list.map(p => {
          const pIds = (p.slots || []).map(s => s[0]).join("-");
          const activeCls = pIds === curIds ? "active" : "";
          const bbName = BANGBOO_MAP[p.bangboo]?.n || "咔嚓仔";
          const trioHtml = (p.slots || [])
            .map((s) => {
              const c = CHAR_MAP[s[0]];
              return c
                ? `<span class="preset-member-chip">${renderAgentAvatar(c.id, c.n, c.eb, "av-2xs")}<span>${escHtml(c.n)}</span></span>`
                : "";
            })
            .join("");
          return `
            <div class="preset-card ${activeCls}" data-apply-preset="${escHtml(p.id)}">
              <div class="row" style="justify-content:space-between;">
                <span class="preset-cat">${escHtml(p.cat)}</span>
                <span class="badge b-info">${escHtml(p.tag)}</span>
              </div>
              <div class="preset-title">${escHtml(p.name)}</div>
              <div class="preset-trio">${trioHtml}</div>
              <div class="preset-desc">${escHtml(p.desc)}</div>
              <div class="preset-foot">
                <span>邦布: ${escHtml(bbName)}</span>
                <span class="link-txt">点击上阵 ↗</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } else if (appStore.state.pickerTab === "manual") {
    const q = appStore.state.manualSearch.trim().toLowerCase();
    const chars = SC_CHARS.filter(c => {
      if (appStore.state.manualRoleFilter !== "ALL" && c.wt !== appStore.state.manualRoleFilter) return false;
      if (appStore.state.manualElemFilter !== "ALL" && c.eb !== appStore.state.manualElemFilter) return false;
      if (q && !c.n.toLowerCase().includes(q) && !(c.camp || "").toLowerCase().includes(q) && !c.p.includes(q) && !c.e.includes(q)) return false;
      return true;
    });
    const activeCids = new Set(appStore.state.slots.map(s => s?.cid).filter(Boolean));

    inner = `
      <div class="subbox" style="margin-bottom:10px;">
        <div class="row" style="justify-content:space-between;gap:8px;">
          <div class="row" style="gap:6px;">
            <span style="font-size:12px;font-weight:700;">点击下方角色卡上阵至：</span>
            ${[0, 1, 2].map(idx => {
              const curName = appStore.state.slots[idx]?.cid && CHAR_MAP[appStore.state.slots[idx].cid] ? CHAR_MAP[appStore.state.slots[idx].cid].n : "空位";
              return `<button class="pill ${appStore.state.manualTargetSlot === idx ? "active" : ""}" data-target-slot="${idx}">${idx + 1}号位 (${escHtml(curName)})</button>`;
            }).join("")}
          </div>
          <div class="row" style="gap:6px;">
            <button class="btn btn-primary" id="autoFillMatesBtn">按1号位智能配齐2+3号队友</button>
            <button class="btn" id="clearMatesBtn">仅留1号单人</button>
            <button class="btn" id="clearAllSlotsBtn">清空全队</button>
            <button class="btn" id="manualNewCharBtn">+ 新建自定义角色</button>
          </div>
        </div>
        <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border);">
          <div class="muted" style="font-size:11px;margin-bottom:5px;">一键套用 2+3 号位「万能双拐底盘」（保留当前1号位主C，若1号位为空自动填入代表主C）：</div>
          <div class="pill-bar">
            ${UNIVERSAL_SHELLS.map(sh => `<button class="pill" data-apply-shell="${escHtml(sh.id)}" title="${escHtml(sh.hint)}">${escHtml(sh.label)}</button>`).join("")}
          </div>
        </div>
      </div>

      <div class="row" style="gap:8px;margin-bottom:8px;">
        <input type="text" id="manualSearchInput" value="${escHtml(appStore.state.manualSearch)}" placeholder="搜索代理人姓名 / 阵营 / 职业..." style="max-width:240px;">
        <div class="pill-bar">
          <button class="pill ${appStore.state.manualRoleFilter === "ALL" ? "active" : ""}" data-mrf="ALL">全职业</button>
          ${ALL_SPECIALTIES.map(x => `<button class="pill ${appStore.state.manualRoleFilter === x.wt ? "active" : ""}" data-mrf="${x.wt}">${x.zh}</button>`).join("")}
        </div>
        <div class="pill-bar">
          <button class="pill ${appStore.state.manualElemFilter === "ALL" ? "active" : ""}" data-mef="ALL">全属性</button>
          ${ALL_ELEMENTS.map(x => `<button class="pill ${appStore.state.manualElemFilter === x.eb ? "active" : ""}" data-mef="${x.eb}">${x.zh}</button>`).join("")}
        </div>
      </div>

      <div class="roster-grid">
        ${chars.map(c => {
          const inTeamIdx = appStore.state.slots.findIndex(s => s?.cid === c.id);
          const isMod = !!customDB.chars[c.id];
          return `
            <button class="roster-chip ${activeCids.has(c.id) ? "in-team" : ""}" data-pick-roster="${escHtml(c.id)}">
              ${renderAgentAvatar(c.id, c.n, c.eb, "av-sm")}
              <span class="roster-name"><span class="roster-rank rank-${c.r}" data-no-i18n>${c.r}</span> ${escHtml(c.n)}</span>
              <span class="roster-meta">${c.e}·${c.p}</span>
              ${inTeamIdx >= 0 ? `<span class="badge b-ok">${inTeamIdx + 1}号</span>` : (isMod ? `<span class="badge b-warn">改</span>` : "")}
            </button>
          `;
        }).join("")}
      </div>
    `;
  } else if (appStore.state.pickerTab === "finder") {
    const ownedSet = new Set(appStore.state.ownedChars || []);
    const vaultAgentCount = Object.keys(enkaVault.agents).length;
    const syncedMap = appStore.state.finderUseVault && vaultAgentCount > 0 ? getVaultSyncedSlotsMap() : undefined;

    const nextKey = JSON.stringify({
      anchor: appStore.state.finderAnchor,
      owned: [...ownedSet].sort(),
      reqAA: appStore.state.finderReqAA,
      f2p: appStore.state.finderF2PWep,
      useVault: Boolean(syncedMap),
      vaultCount: vaultAgentCount,
      gold: appStore.state.finderMaxGold,
      metric: appStore.state.env.metricMode,
      stage: appStore.state.env.stageId,
      res: appStore.state.env.elemResMap
    });

    if (nextKey !== finderCacheKey && !finderLoading) {
      finderCacheKey = nextKey;
      finderLoading = true;
      const mySeq = ++finderSeq;
      const anchorArg = appStore.state.finderAnchor === "ANY" ? "" : appStore.state.finderAnchor;
      const opts = {
        requireAllAA: appStore.state.finderReqAA,
        useF2PWeps: appStore.state.finderF2PWep,
        maxSGold: appStore.state.finderMaxGold,
        limit: 10,
        syncedSlotsByCid: syncedMap
      };
      runWorkerFindViableTeams(anchorArg, [...ownedSet], appStore.state.env, opts)
        .then(({ result, elapsedMs }) => {
          if (mySeq !== finderSeq) return;
          finderCachedTeams = result;
          finderElapsedMs = elapsedMs;
          finderLoading = false;
          if (appStore.state.pickerTab === "finder") renderSection01Picker();
        })
        .catch(() => {
          if (mySeq !== finderSeq) return;
          const t0 = performance.now();
          finderCachedTeams = findViableTeams(
            anchorArg || null,
            ownedSet,
            appStore.state.env,
            CHAR_MAP,
            SC_WEPS,
            opts
          );
          finderElapsedMs = Number((performance.now() - t0).toFixed(1));
          finderLoading = false;
          if (appStore.state.pickerTab === "finder") renderSection01Picker();
        });
    }

    const found = finderCachedTeams;

    inner = `
      <div class="subbox" style="margin-bottom:10px;">
        <div class="row" style="gap:10px;justify-content:space-between;">
          <div class="row" style="gap:8px;">
            <label style="font-size:12px;font-weight:700;">指定核心角色:
              <select id="finderAnchorSel" style="width:180px;margin-left:4px;">
                <option value="ANY" ${appStore.state.finderAnchor === "ANY" ? "selected" : ""}>不限主C (全局搜最强队)</option>
                ${SC_CHARS.map(c => `<option value="${escHtml(c.id)}" ${appStore.state.finderAnchor === c.id ? "selected" : ""}>[${c.r}·${c.p}] ${escHtml(c.n)}</option>`).join("")}
              </select>
            </label>
            <label style="font-size:12px;">限定金预算上限:
              <select id="finderGoldSel" style="width:120px;margin-left:4px;">
                ${[[2, "平民 <=2金"], [4, "主流 <=4金"], [6, "毕业 <=6金"], [99, "不限金数"]].map(([v, t]) => `<option value="${v}" ${appStore.state.finderMaxGold === v ? "selected" : ""}>${t}</option>`).join("")}
              </select>
            </label>
            <label class="chk-pill"><input type="checkbox" id="finderReqAAChk" ${appStore.state.finderReqAA ? "checked" : ""}> 必须3人全亮额外能力</label>
            <label class="chk-pill"><input type="checkbox" id="finderF2PWepChk" ${appStore.state.finderF2PWep ? "checked" : ""}> 全员改用A级满精平替音擎</label>
            <label class="chk-pill" title="开启后，若练度柜中有该角色，将直接按你真实的影画、音擎与 6 张驱动盘词条计算编队伤害">
              <input type="checkbox" id="finderUseVaultChk" ${appStore.state.finderUseVault ? "checked" : ""}>
              套用练度柜真实面板 (${vaultAgentCount}人)
            </label>
          </div>
          <div class="row" style="gap:6px;">
            <span class="badge b-info mono">${finderLoading ? "Worker 后台搜队中..." : `Worker 耗时 ${finderElapsedMs} ms`}</span>
            ${vaultAgentCount >= 3 ? `<button class="btn" id="boxVaultOnlyBtn">仅选练度柜角色</button>` : ""}
            <button class="btn" id="boxAllBtn">Box全选</button>
            <button class="btn" id="boxF2PBtn">仅A级+常驻S+佩佩</button>
          </div>
        </div>
        <details style="margin-top:8px;">
          <summary style="cursor:pointer;font-size:12px;color:var(--muted-foreground);">展开勾选我拥有的代理人 Box (已选 ${ownedSet.size} / ${SC_CHARS.length})</summary>
          <div class="roster-grid" style="margin-top:8px;">
            ${SC_CHARS.map(c => `
              <button class="roster-chip ${ownedSet.has(c.id) ? "in-team" : ""}" data-toggle-owned="${escHtml(c.id)}">
                ${renderAgentAvatar(c.id, c.n, c.eb, "av-sm")}
                <span class="roster-name">${ownedSet.has(c.id) ? "✓" : "○"} ${escHtml(c.n)}${enkaVault.agents[c.id] ? " · 实盘" : ""}</span>
              </button>
            `).join("")}
          </div>
        </details>
      </div>

      <div class="preset-grid">
        ${found.length > 0 ? found.map((item, idx) => {
          const trioAvs = (item.slots || [])
            .map((s: any) => {
              const fc = CHAR_MAP[s.cid];
              return fc ? `<span class="preset-member-chip">${renderAgentAvatar(fc.id, fc.n, fc.eb, "av-2xs")}<span>${escHtml(fc.n)}</span></span>` : "";
            })
            .join("");
          return `
          <div class="preset-card" data-load-found="${idx}">
            <div class="row" style="justify-content:space-between;">
              <span class="badge b-ok">TOP ${idx + 1} · 额外能力 ${item.aaLitCount}/3</span>
              <span class="badge">${item.limGold}限定金</span>
            </div>
            <div class="preset-title">${escHtml(item.names)}</div>
            <div class="preset-trio">${trioAvs}</div>
            <div class="mono" style="font-size:12px;font-weight:700;color:var(--primary);">预估主指标: ${fmtNum(item.teamDps)} (轴长 ${item.cycleSec.toFixed(1)}s)</div>
            <div class="muted" style="font-size:11px;margin-top:4px;">分摊: ${item.shares.map(s => `${s.n} ${Math.round(s.pct * 100)}%`).join(" / ")}</div>
          </div>
        `;
        }).join("") : `<div class="muted" style="padding:12px;">${finderLoading ? "Web Worker 正在后台高速推演全部可行三人配队与合轴化学反应..." : "当前 Box 与筛选条件下未找到满足要求的三人编队，请放宽金数限制或勾选更多角色。"}</div>`}
      </div>
    `;
    (wrap as any)._foundCache = found;
  } else {
    inner = `
      <div class="ws-grid-2">
        <div class="subbox">
          <div style="font-weight:800;font-size:13px;margin-bottom:6px;">绝区零 v3.3 四大输出乘区体系精要</div>
          <ul class="clean-list">
            <li><strong>1. 强攻直伤体系 (Attack)</strong>：吃满 局内攻击 × 双暴 × 增伤 × 防御区(减防/穿透) × 抗性区 × 失衡易伤。依赖合轴压缩非失衡破韧时间，失衡期通过手动取消重击打出主C双连携甚至强转三连携。</li>
            <li><strong>2. 命破贯穿体系 (Rupture)</strong>：核心基础区为【贯穿力 = 0.1×生命 + 0.3×攻击 + 贯穿拐】，<strong>天生 100% 无视敌人防御力</strong>（防御系数恒为1.0，妮可减防与丽娜穿透率对其完全0收益），吃双暴、生命/贯穿拐、抗性区与云岿如我独立贯穿乘区。</li>
            <li><strong>3. 异常/紊乱/异放/耀化/涡流体系 (Anomaly)</strong>：常规异常不吃双暴（简、菲欧妮、爱芮高影除外），核心吃局内攻击、异常精通、异常掌控与等级系数。利用 <strong>99%压条合轴瞬爆紊乱</strong>（450%基础 + 剩余秒数×7.5%），严格规避 <strong>3.0秒紊乱内置冷却CD</strong>。</li>
            <li><strong>4. 锋御撕裂体系 (Armorer)</strong>：以局内防御力为基数，不吃传统暴伤，而是将超出 100% 的暴击率（最高 200% 暴击上限）转化为<strong>二次撕裂乘方结算</strong> <code>(1 + 撕裂倍率)&sup2;</code>，搭配洛克茜/丽娜/本获得质变。</li>
          </ul>
        </div>
        <div class="subbox">
          <div style="font-weight:800;font-size:13px;margin-bottom:6px;">绝区零八维实战「合轴」底层物理机制全解</div>
          <ul class="clean-list">
            <li><strong>维度1 [脱手帧重叠]</strong>：绝区零切人后，前一名角色会把当前已出手的动画完整播完才退场。在长脱手招式（如星见雅三蓄拔刀2.65s、仪玄凝炁、伊芙琳绞索）出手瞬间切人，两人同屏并行输出，可将23s顺序轴压缩至16.5s~18.5s，真实每秒DPS暴涨18%~28%。</li>
            <li><strong>维度2 [安全合轴 vs 危险裸露合轴]</strong>：强化E与大招脱手自带无敌帧；而普攻尾段裸露切人后原角色留在场上仍会挨打受硬直（鏖战高塔/红光疯狗Boss易后台暴毙），实战常用<strong>垫步闪避取消接切人</strong>继承约0.35s无敌帧安全离场。</li>
            <li><strong>维度3 [持续引导防断招]</strong>：派派转圈、可琳电锯、安东电钻等引导技若在终结一击前切人会直接中断后续判定导致丢伤，需等收尾下砸出手帧再合轴。</li>
            <li><strong>维度4~7 [快支乒乓 / 短轴偷球 / 手动双连携 / 闪A振刀]</strong>：黄光一瞬间按「闪避->普攻->切人」可同时触发<strong>极限闪避反击 + 招架支援振刀(双反)</strong>，一份黄光打双份倍率与高额削韧；失衡期选主C连携#1 -> 切辅助手动重击取消第2次连携 -> 再点主C连携#2；主C大招前0.2s切妮可快支偷球锁死3.5s的40%减防。</li>
          </ul>
        </div>
      </div>
    `;
  }

  wrap.innerHTML = `
    <div class="ws-tabs" style="margin-bottom:10px;">
      ${tabs.map(t => `<button class="tab-btn ${appStore.state.pickerTab === t.id ? "active" : ""}" data-ptab="${t.id}">${escHtml(t.label)}</button>`).join("")}
    </div>
    ${inner}
  `;

  wrap.querySelectorAll<any>("[data-ptab]").forEach(btn => {
    btn.addEventListener("click", () => {
      appStore.state.pickerTab = btn.dataset.ptab;
      renderSection01Picker();
    });
  });

  wrap.querySelectorAll<any>("[data-pcat]").forEach(btn => {
    btn.addEventListener("click", () => {
      appStore.state.presetCat = btn.dataset.pcat;
      renderSection01Picker();
    });
  });

  document.getElementById("quickSavePresetBtn")?.addEventListener("click", () => {
    openCustomWorkshop("presets");
  });

  wrap.querySelectorAll<any>("[data-apply-preset]").forEach(card => {
    card.addEventListener("click", () => {
      const p = PRESET_TEAMS.find(x => x.id === card.dataset.applyPreset);
      if (p) applyPresetTeam(p);
    });
  });

  wrap.querySelectorAll<any>("[data-target-slot]").forEach(btn => {
    btn.addEventListener("click", () => {
      appStore.state.manualTargetSlot = Number(btn.dataset.targetSlot);
      renderSection01Picker();
    });
  });

  document.getElementById("autoFillMatesBtn")?.addEventListener("click", () => {
    const c0 = appStore.state.slots[0]?.cid;
    if (!c0 || !CHAR_MAP[c0]) return;
    const best = findViableTeams(c0, null, appStore.state.env, CHAR_MAP, SC_WEPS, { requireAllAA: false, limit: 1 });
    if (best.length > 0) {
      appStore.state.slots = best[0].slots.map(s => makeDefaultSlot(s.cid, s.m, s.wid, s.ref, s.fourPc));
      ensureTimelineInitialized(true);
      refreshAllUI();
    }
  });

  document.getElementById("clearMatesBtn")?.addEventListener("click", () => {
    appStore.state.slots[1] = null;
    appStore.state.slots[2] = null;
    ensureTimelineInitialized(true);
    refreshAllUI();
  });

  document.getElementById("clearAllSlotsBtn")?.addEventListener("click", () => {
    appStore.state.slots = [null, null, null];
    ensureTimelineInitialized(true);
    refreshAllUI();
  });

  document.getElementById("manualNewCharBtn")?.addEventListener("click", () => {
    openCustomWorkshop("chars");
  });

  wrap.querySelectorAll<any>("[data-apply-shell]").forEach(btn => {
    btn.addEventListener("click", () => {
      const sh = UNIVERSAL_SHELLS.find(x => x.id === btn.dataset.applyShell);
      if (!sh) return;
      if (!appStore.state.slots[0]?.cid || !CHAR_MAP[appStore.state.slots[0].cid]) {
        appStore.state.slots[0] = makeDefaultSlot(sh.defCarry);
      }
      appStore.state.slots[1] = makeDefaultSlot(sh.pair[0][0], sh.pair[0][1], sh.pair[0][2], sh.pair[0][3], sh.pair[0][4]);
      appStore.state.slots[2] = makeDefaultSlot(sh.pair[1][0], sh.pair[1][1], sh.pair[1][2], sh.pair[1][3], sh.pair[1][4]);
      ensureTimelineInitialized(true);
      refreshAllUI();
    });
  });

  const mSearch = document.getElementById("manualSearchInput");
  if (mSearch) {
    mSearch.addEventListener("input", (e: any) => {
      appStore.state.manualSearch = e.target.value;
      renderSection01Picker();
      const ni = document.getElementById("manualSearchInput") as HTMLInputElement | null;
      if (ni) { ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); }
    });
  }

  wrap.querySelectorAll<any>("[data-mrf]").forEach(b => b.addEventListener("click", () => { appStore.state.manualRoleFilter = b.dataset.mrf; renderSection01Picker(); }));
  wrap.querySelectorAll<any>("[data-mef]").forEach(b => b.addEventListener("click", () => { appStore.state.manualElemFilter = b.dataset.mef; renderSection01Picker(); }));

  wrap.querySelectorAll<any>("[data-pick-roster]").forEach(btn => {
    btn.addEventListener("click", () => {
      const cid = btn.dataset.pickRoster;
      const tSlot = appStore.state.manualTargetSlot;
      assignCharacterToSlot(tSlot, cid);
      if (tSlot < 2 && !appStore.state.slots[tSlot + 1]) appStore.state.manualTargetSlot = tSlot + 1;
      renderSection01Picker();
    });
  });

  const rerunFinder = () => {
    finderLoading = false;
    renderSection01Picker();
  };

  document.getElementById("finderAnchorSel")?.addEventListener("change", (e: any) => { appStore.state.finderAnchor = e.target.value; rerunFinder(); });
  document.getElementById("finderGoldSel")?.addEventListener("change", (e: any) => { appStore.state.finderMaxGold = Number(e.target.value); rerunFinder(); });
  document.getElementById("finderReqAAChk")?.addEventListener("change", (e: any) => { appStore.state.finderReqAA = e.target.checked; rerunFinder(); });
  document.getElementById("finderF2PWepChk")?.addEventListener("change", (e: any) => { appStore.state.finderF2PWep = e.target.checked; rerunFinder(); });
  document.getElementById("finderUseVaultChk")?.addEventListener("change", (e: any) => { appStore.state.finderUseVault = e.target.checked; rerunFinder(); });

  document.getElementById("boxVaultOnlyBtn")?.addEventListener("click", () => {
    const cids = Object.keys(enkaVault.agents);
    if (cids.length > 0) {
      appStore.state.ownedChars = cids;
      rerunFinder();
    }
  });
  document.getElementById("boxAllBtn")?.addEventListener("click", () => {
    appStore.state.ownedChars = SC_CHARS.map(c => c.id);
    rerunFinder();
  });
  document.getElementById("boxF2PBtn")?.addEventListener("click", () => {
    appStore.state.ownedChars = SC_CHARS.filter(c => c.r === "A" || c.isFreeS).map(c => c.id);
    rerunFinder();
  });
  wrap.querySelectorAll<any>("[data-toggle-owned]").forEach(btn => {
    btn.addEventListener("click", () => {
      const cid = btn.dataset.toggleOwned;
      const set = new Set(appStore.state.ownedChars);
      if (set.has(cid)) set.delete(cid); else set.add(cid);
      appStore.state.ownedChars = [...set];
      rerunFinder();
    });
  });
  wrap.querySelectorAll<any>("[data-load-found]").forEach(card => {
    card.addEventListener("click", () => {
      const item = (wrap as any)._foundCache?.[Number(card.dataset.loadFound)];
      if (!item) return;
      appStore.state.slots = item.slots.map((s: any) => {
        const vaultRec = appStore.state.finderUseVault ? enkaVault.agents[s.cid] : null;
        if (vaultRec) {
          const syncedSlot = syncedRecordToSlotConfig(vaultRec, makeDefaultSlot);
          if (syncedSlot) return syncedSlot;
        }
        return makeDefaultSlot(s.cid, s.m, s.wid, s.ref, s.fourPc);
      });
      ensureTimelineInitialized(true);
      refreshAllUI();
    });
  });
}

// ============================================================================
// Section 02: Core KPIs, Diagnostics & Threshold / Multiplier Inspector
// ============================================================================
function renderSection02KPIsAndDiag(sim) {
  const kpiWrap = document.getElementById("sec02KPIs");
  const diagWrap = document.getElementById("sec02Diag");
  if (!kpiWrap || !diagWrap) return;

  if (sim.activeCount === 0) {
    kpiWrap.innerHTML = `<div class="card" style="grid-column:1 / -1;text-align:center;padding:22px;">当前编队为空，请先在「1 配队配装」中选择一支队伍或上阵代理人。</div>`;
    diagWrap.innerHTML = "";
    return;
  }

  const sr0 = sim.slotResults[0];
  const bd0 = sr0.bd;

  kpiWrap.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-head">
        <span>额外能力点亮与支援形态</span>
        <span class="badge ${sim.aaLitCount === sim.activeCount ? "b-ok" : "b-warn"}">${sim.aaLitCount} / ${sim.activeCount} 已点亮</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:4px;font-size:12px;">
        ${sim.slotResults.map(r => `
          <div class="row" style="justify-content:space-between;">
            <span><strong>${escHtml(r.ch.n)}</strong> (${r.ch.defAssist ? "招架振刀" : "回避时停"})</span>
            <span class="${r.aa.active ? "txt-ok" : "txt-warn"}">${r.aa.active ? "[已点亮]" : "[未点亮]"} ${escHtml(r.aa.reason)}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-head">
        <span>1号位【${escHtml(sr0.ch.n)}】核心结算</span>
        <span class="badge">${escHtml(bd0.formulaType)}</span>
      </div>
      <div class="kpi-num mono" style="font-size:21px;">${fmtNum(sr0.rawDmg)} <small>(吃拐 ${sim.carryVsSolo.toFixed(2)}x)</small></div>
      <div class="kpi-sub">最优主词条: <strong>${escHtml(fmtDiscZh(sr0.bestDisc))}</strong></div>
      <div class="kpi-sub mono">失衡期覆盖: <strong>${(bd0.sShare * 100).toFixed(0)}%</strong> · 目标抗性: <strong>${(bd0.enemyElemRes * 100).toFixed(0)}%</strong></div>
    </div>
  `;

  // Threshold checks for active members
  const threshItems = [];
  sim.slotResults.forEach(r => {
    const cid = r.ch.id, st = r.st;
    if (cid === "1311") threshItems.push({ who: r.ch.n, name: "局外攻击转1200攻上限(需3429)", cur: Math.round(st.init_atk), target: 3429, ok: st.init_atk >= 3429 });
    if (cid === "1491") threshItems.push({ who: r.ch.n, name: "局外攻击转1050攻上限(需3500)", cur: Math.round(st.init_atk), target: 3500, ok: st.init_atk >= 3500 });
    if (cid === "1131") threshItems.push({ who: r.ch.n, name: "局外攻击转1000攻上限(需2500)", cur: Math.round(st.init_atk), target: 2500, ok: st.init_atk >= 2500 });
    if (cid === "1411") {
      threshItems.push({ who: r.ch.n, name: "局外攻击转1200攻上限(需3000)", cur: Math.round(st.init_atk), target: 3000, ok: st.init_atk >= 3000 });
      threshItems.push({ who: r.ch.n, name: "掌控转满20%异常伤(需200掌控)", cur: Math.round(st.init_am + st.eff.c_am_flat), target: 200, ok: (st.init_am + st.eff.c_am_flat) >= 200 });
    }
    if (cid === "1451") threshItems.push({ who: r.ch.n, name: "局外生命转满900贯穿力(需24000)", cur: Math.round(st.init_hp), target: 24000, ok: st.init_hp >= 24000 });
    if (cid === "1341") threshItems.push({ who: r.ch.n, name: "局外生命转满40%增伤(需27000)", cur: Math.round(st.init_hp), target: 27000, ok: st.init_hp >= 27000 });
    if (cid === "1391") threshItems.push({ who: r.ch.n, name: "局外攻击转满50%暴伤(需3400)", cur: Math.round(st.init_atk), target: 3400, ok: st.init_atk >= 3400 });
    if (cid === "1161") {
      const cImp = Math.round((st.init_imp + st.eff.c_imp_flat) * (1 + 0.20 + st.eff.c_imp_pct));
      threshItems.push({ who: r.ch.n, name: "局内冲击转满75%冰火伤(需270冲击)", cur: cImp, target: 270, ok: cImp >= 270 });
    }
    if (r.fourPc === "山大王" && r.ch.wt === "Stun") {
      const crPct = Number(((st.init_cr + (r.ch.prof?.self_cr || 0) + st.eff.c_cr) * 100).toFixed(1));
      threshItems.push({ who: r.ch.n, name: "山大王4件套+30%暴伤阈值(需50%暴击)", cur: crPct + "%", target: "50%", ok: crPct >= 50 });
    }
  });

  diagWrap.innerHTML = `
    ${sim.notes.length === 0 ? `
      <div class="diag-pass">
        <span class="diag-pass-ico" data-no-i18n>✓</span>
        <span>[健康通过] 当前三人套装无同名光环撞车、无跨职业音擎失效、无暴击溢出、无合轴断招与支援点透支。</span>
      </div>
    ` : ""}
    <div class="${sim.notes.length > 0 ? "ws-grid-2" : ""}">
      ${sim.notes.length > 0 ? `
      <div class="card">
        <div class="sec-mini-title">智能配装防呆与合轴风险诊断 (${sim.notes.length} 条)</div>
          <ul class="diag-list">
            ${sim.notes.map(n => {
              const cls = n.includes("警告") || n.includes("冲突") || n.includes("风险") || n.includes("失效") || n.includes("撞车") ? "d-warn" : "d-info";
              return `<li class="${cls}">${escHtml(n)}</li>`;
            }).join("")}
          </ul>
      </div>
      ` : ""}

      <div class="card">
        <div class="sec-mini-title">1号位【${escHtml(sr0.ch.n)}】六维乘区雷达透视 &amp; 队友转模达标表</div>
        <div class="diag-radar-layout">
          <div class="diag-radar-svg-wrap">
            ${renderMultiplierRadarSvg(bd0, sr0.ch)}
          </div>
          <div style="flex:1;min-width:0;">
            <div class="mult-pills">
              <span class="mpill">基础${escHtml(bd0.baseLabel)}: <strong>${fmtNum(bd0.baseVal)}</strong></span>
              <span class="mpill">双暴/撕裂区: <strong>×${(bd0.critM || 1).toFixed(3)}</strong> (${(bd0.c_cr * 100).toFixed(1)}%/${(bd0.c_cd * 100).toFixed(1)}%)</span>
              <span class="mpill">增伤区: <strong>×${(bd0.dmgM || 1).toFixed(3)}</strong></span>
              <span class="mpill">防御区: <strong>×${(bd0.defM || 1).toFixed(3)}</strong> (无视${(bd0.shred * 100).toFixed(0)}%/穿${(bd0.totalPen * 100).toFixed(0)}%)</span>
              <span class="mpill">抗性区: <strong>×${(bd0.resM || 1).toFixed(3)}</strong></span>
              <span class="mpill">失衡易伤区: <strong>×${(bd0.stunMult || 1).toFixed(3)}</strong></span>
            </div>
            ${threshItems.length > 0 ? `
              <div style="margin-top:8px;display:flex;flex-direction:column;gap:4px;font-size:12px;">
                ${threshItems.map(t => `
                  <div class="row" style="justify-content:space-between;">
                    <span><strong>${escHtml(t.who)}</strong> · ${escHtml(t.name)}</span>
                    <span class="mono ${t.ok ? "txt-ok" : "txt-warn"}">${t.cur} / ${t.target} ${t.ok ? "[满额]" : "[未满]"}</span>
                  </div>
                `).join("")}
              </div>
            ` : `<div class="muted" style="font-size:12px;margin-top:8px;">当前队伍无动态面板阈值转模限制。</div>`}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMultiplierRadarSvg(bd0: any, ch0: any): string {
  const lang = appStore.state.lang || "zh";
  const tr = (txt: string) => translateText(txt, lang);
  const clamp01 = (v: number) => Math.max(0.2, Math.min(1.0, v));

  const baseNorm =
    ch0?.wt === "Rupture"
      ? (bd0?.baseVal || 2000) / 3100
      : ch0?.wt === "Armorer"
      ? (bd0?.baseVal || 2400) / 3500
      : (bd0?.baseVal || 2800) / 4100;
  const critOrApNorm =
    ch0?.wt === "Anomaly" && ch0?.id !== "1091"
      ? (bd0?.c_ap || 320) / 470
      : ((bd0?.critM || 1) - 0.8) / 2.35;
  const dmgNorm = ((bd0?.dmgM || 1) - 0.85) / 1.55;
  const defNorm = (bd0?.defM || 0.5) / 1.0;
  const resNorm = ((bd0?.resM || 1) - 0.65) / 0.7;
  const stunNorm = ((bd0?.stunMult || 1) - 0.85) / 1.05;

  const axes = [
    { label: tr("基础区"), ratio: clamp01(baseNorm) },
    { label: ch0?.wt === "Anomaly" && ch0?.id !== "1091" ? tr("精通区") : tr("双暴区"), ratio: clamp01(critOrApNorm) },
    { label: tr("增伤区"), ratio: clamp01(dmgNorm) },
    { label: tr("防御穿透"), ratio: clamp01(defNorm) },
    { label: tr("抗性削减"), ratio: clamp01(resNorm) },
    { label: tr("失衡易伤"), ratio: clamp01(stunNorm) }
  ];

  const cx = 108;
  const cy = 94;
  const maxR = 62;
  const ptAt = (idx: number, rScale: number) => {
    const ang = -Math.PI / 2 + (idx * Math.PI * 2) / 6;
    return [cx + Math.cos(ang) * maxR * rScale, cy + Math.sin(ang) * maxR * rScale];
  };

  const ringsSvg = [0.34, 0.67, 1.0]
    .map((rs) => {
      const pts = [0, 1, 2, 3, 4, 5]
        .map((i) => ptAt(i, rs).map((n) => n.toFixed(1)).join(","))
        .join(" ");
      return `<polygon points="${pts}" fill="none" stroke="var(--border)" stroke-opacity="${rs === 1 ? "0.7" : "0.35"}" stroke-width="1" />`;
    })
    .join("");

  const spokesSvg = [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const [x, y] = ptAt(i, 1);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-opacity="0.35" stroke-width="1" />`;
    })
    .join("");

  const dataPts = axes.map((a, i) => ptAt(i, a.ratio));
  const polyPts = dataPts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const dotsSvg = dataPts
    .map(
      ([x, y]) =>
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="var(--primary)" stroke="var(--card)" stroke-width="1.2" />`
    )
    .join("");

  const labelsSvg = axes
    .map((a, i) => {
      const [x, y] = ptAt(i, 1.25);
      const anchor = i === 0 || i === 3 ? "middle" : i < 3 ? "start" : "end";
      return `<text x="${x.toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="${anchor}" fill="var(--muted-foreground)" font-size="10.5" font-weight="600">${escHtml(a.label)}</text>`;
    })
    .join("");

  return `
    <svg data-no-i18n="1" viewBox="0 0 216 188" width="196" height="170" aria-label="Multiplier Radar">
      ${ringsSvg}
      ${spokesSvg}
      <polygon points="${polyPts}" fill="var(--primary)" fill-opacity="0.18" stroke="var(--primary)" stroke-width="1.7" />
      ${dotsSvg}
      ${labelsSvg}
    </svg>
  `;
}

// ============================================================================
// Section 03: 3-Slot Showcase Gear Cards + 4th-Slot Bangboo Bar
// ============================================================================
const SUB_SHORT_ZH: Record<string, string> = {
  CR: "暴击",
  CD: "暴伤",
  "ATK%": "大攻%",
  "HP%": "生命%",
  "DEF%": "防御%",
  AP: "精通",
  PEN: "穿透"
};

function computeSlotBuildRating(sl: any, sr: any, ch: any) {
  const bm = sl.buildMode || "auto";
  if (bm === "pieces" && Array.isArray(sl.pieces) && sl.pieces.length === 6) {
    const scored = scoreSixPiecesForAgent(sl.pieces, ch);
    return {
      grade: scored.overallGrade,
      effRolls: scored.effectiveRollsTotal,
      pieceSummaries: scored.pieceSummaries
    };
  }
  const weights = getEffectiveSubWeightsForAgent(ch);
  const curSub =
    bm === "auto"
      ? sl.subAuto === false && sl.sub
        ? sl.sub
        : sr?.bestSub || {}
      : sr?.bestSub || {};
  let eff = 0;
  if (bm === "panel") {
    eff = (sl.rolls ?? 28) + 3.0;
  } else {
    for (const [k, v] of Object.entries(curSub)) {
      eff += (Number(v) || 0) * (weights[k as keyof typeof weights] || 0);
    }
    eff += 3.0; // Optimal [4][5][6] main stats credit (consistent with scoreSixPiecesForAgent)
  }
  const rounded = Number(eff.toFixed(1));
  return {
    grade: gradeSixPiecesTotal(rounded),
    effRolls: rounded,
    pieceSummaries: null
  };
}

function computeSlotSubstatGains(slotIdx: number, sim: any) {
  const sl = appStore.state.slots[slotIdx];
  const sr = sim.slotResults?.find((r: any) => r.slotIdx === slotIdx);
  if (!sl?.cid || !sr) return [];
  const ch = CHAR_MAP[sl.cid];
  if (!ch) return [];

  let cands = ["CR", "CD", "ATK%", "PEN"];
  if (ch.wt === "Rupture") cands = ["CR", "CD", "HP%", "ATK%"];
  else if (ch.wt === "Armorer") cands = ["CR", "CD", "DEF%", "ATK%"];
  else if (ch.id === "1091") cands = ["CR", "CD", "ATK%", "AP"];
  else if (ch.wt === "Anomaly") cands = ["AP", "ATK%", "PEN", "CR"];
  else if (ch.id === "1451" || ch.id === "1341") cands = ["HP%", "CR", "CD", "ATK%"];

  const lockedSlots = appStore.state.slots.map((s, idx) => {
    if (!s?.cid) return null;
    const r = sim.slotResults?.find((x: any) => x.slotIdx === idx);
    if (!r) return deepClone(s);
    const copy = deepClone(s);
    if ((copy.buildMode || "auto") === "auto") {
      const manualMain = s.discAuto === false;
      copy.discAuto = false;
      copy.d4 = manualMain && s.d4 ? s.d4 : r.st?.d4 || "CR";
      copy.d5 = manualMain && s.d5 ? s.d5 : r.st?.d5 || "ELEM";
      copy.d6 = manualMain && s.d6 ? s.d6 : r.st?.d6 || "ATK%";
      copy.subAuto = false;
      copy.sub = { ...(s.subAuto === false && s.sub ? s.sub : r.bestSub || {}) };
    }
    return copy;
  });

  const baseSim = simulateTeamV2(lockedSlots, appStore.state.env, CHAR_MAP, SC_WEPS, {
    fastMode: true,
    skipSoloBaseline: true
  });
  const baseTeam = baseSim.teamDps || 1;
  const baseSr = baseSim.slotResults?.find((x: any) => x.slotIdx === slotIdx);
  const baseSelf = baseSr?.rawDmg || 1;
  const w = SC_WEPS[sl.wid];

  const rows = cands.map((sk) => {
    const nextSlots = lockedSlots.map((x) => (x ? deepClone(x) : null));
    const target = nextSlots[slotIdx]!;
    const bm = target.buildMode || "auto";
    if (bm === "pieces" && Array.isArray(target.pieces) && target.pieces[0]) {
      target.pieces[0].subs = {
        ...(target.pieces[0].subs || {}),
        [sk]: (Number(target.pieces[0].subs?.[sk]) || 0) + 1
      };
    } else if (bm === "panel" && target.panel) {
      if (sk === "CR") target.panel.cr = (target.panel.cr || 0) + 2.4;
      else if (sk === "CD") target.panel.cd = (target.panel.cd || 0) + 4.8;
      else if (sk === "PEN") target.panel.penFlat = (target.panel.penFlat || 0) + 9;
      else if (sk === "AP") target.panel.ap = (target.panel.ap || 0) + 9;
      else if (sk === "ATK%") target.panel.atk = (target.panel.atk || 0) + (ch.atk + (w?.batk || 0)) * 0.03;
      else if (sk === "HP%") target.panel.hp = (target.panel.hp || 0) + ch.hp * 0.03;
      else if (sk === "DEF%") target.panel.def = (target.panel.def || 0) + (ch.def + (w?.bdef || 0)) * 0.048;
    } else {
      target.sub = { ...(target.sub || {}), [sk]: (Number(target.sub?.[sk]) || 0) + 1 };
    }

    const tSim = simulateTeamV2(nextSlots, appStore.state.env, CHAR_MAP, SC_WEPS, {
      fastMode: true,
      skipSoloBaseline: true
    });
    const tSr = tSim.slotResults?.find((x: any) => x.slotIdx === slotIdx);
    const teamGain = Math.max(0, ((tSim.teamDps || 0) / baseTeam - 1) * 100);
    const selfGain = Math.max(0, ((tSr?.rawDmg || 0) / baseSelf - 1) * 100);
    return { key: sk, label: SUB_SHORT_ZH[sk] || sk, teamGain, selfGain };
  });

  const maxTeam = Math.max(...rows.map((r) => r.teamGain), 0);
  const useSelf = maxTeam < 0.12;
  const maxRef = Math.max(0.01, ...rows.map((r) => (useSelf ? r.selfGain : r.teamGain)));

  return rows
    .map((r) => {
      const pct = useSelf ? r.selfGain : r.teamGain;
      return {
        ...r,
        pct,
        useSelf,
        barPct: Math.min(100, (pct / maxRef) * 100)
      };
    })
    .sort((a, b) => b.pct - a.pct);
}

function renderSection03SlotCards(sim: any) {
  const bbBar = document.getElementById("sec03BangbooBar");
  const grid = document.getElementById("sec03SlotGrid");
  if (!bbBar || !grid) return;

  const curBb = BANGBOO_MAP[appStore.state.env.bangbooId] || BANGBOOS[0];
  bbBar.innerHTML = `
    <span class="badge b-info">4号位邦布</span>
    <select id="bangbooSelect" style="width:210px;" title="${escHtml(curBb.desc)}">
      ${BANGBOOS.map(b => `<option value="${escHtml(b.id)}" ${b.id === curBb.id ? "selected" : ""}>[${b.r}] ${escHtml(b.n)} (${escHtml(b.camp)})</option>`).join("")}
    </select>
    <label class="chk-pill"><input type="checkbox" id="includeBbDmgChk" ${appStore.state.env.includeBangbooDmg !== false ? "checked" : ""}> 计入直伤 (+${fmtNum(sim.bangbooDmg)})</label>
    <button type="button" class="btn btn-xs btn-ghost" id="editBangbooBtn">精改邦布</button>
  `;

  document.getElementById("bangbooSelect")?.addEventListener("change", (e: any) => {
    appStore.state.env.bangbooId = e.target.value;
    refreshAllUI();
  });
  document.getElementById("includeBbDmgChk")?.addEventListener("change", (e: any) => {
    appStore.state.env.includeBangbooDmg = e.target.checked;
    refreshAllUI();
  });
  document.getElementById("editBangbooBtn")?.addEventListener("click", () => {
    openCustomWorkshop("bangboos", appStore.state.env.bangbooId);
  });

  grid.innerHTML = [0, 1, 2].map(slotIdx => renderSingleSlotCard(slotIdx, sim)).join("");
  bindSlotCardEvents(grid, sim);
}

function renderSingleSlotCard(slotIdx: number, sim: any) {
  const sl = appStore.state.slots[slotIdx];
  const roleHint = slotIdx === 0 ? "01 // 主力核心输出" : `0${slotIdx + 1} // 副C · 击破 · 支援拐`;

  if (!sl || !sl.cid || !CHAR_MAP[sl.cid]) {
    return `
      <div class="slot-card empty-slot">
        <div class="slot-watermark" data-no-i18n>0${slotIdx + 1}</div>
        <div class="slot-dossier-head">
          <span class="badge">${roleHint}</span>
          <span class="muted">当前空置</span>
        </div>
        <div class="empty-slot-cta">
          <label class="empty-slot-picker">
            <span class="empty-plus" data-no-i18n>+</span>
            <span>点击选择上阵代理人</span>
            <select class="overlay-native-select" data-slot-char="${slotIdx}">
              <option value="">-- 点击选择角色上阵 --</option>
              ${SC_CHARS.map(c => `<option value="${escHtml(c.id)}">[${c.r}·${c.e}${c.p}] ${escHtml(c.n)}</option>`).join("")}
            </select>
          </label>
        </div>
      </div>
    `;
  }

  const ch = CHAR_MAP[sl.cid];
  const sr = sim.slotResults.find((r: any) => r.slotIdx === slotIdx);
  const st = sr?.st;
  const bd = sr?.bd;
  const bm = sl.buildMode || "auto";
  const elemHex = ELEM_ACCENT_HEX[ch.eb] || getAgentAccentHex(ch.id, "#ffe01b");
  const splashUrl = getAgentSplashUrl(ch.id);
  const fullArtUrl = getAgentFullArtUrl(ch.id) || splashUrl;

  const sameWeps = WEP_LIST.filter(w => w.wt === ch.wt);
  const otherWeps = WEP_LIST.filter(w => w.wt !== ch.wt);
  const curWep = SC_WEPS[sl.wid] || sameWeps[0] || WEP_LIST[0];

  const setList = Object.values(DISC_SETS);
  const set2List = setList.filter(s => s.id !== "无");
  const curFourId = sr?.fourPc || sl.fourPc || "无";
  const curTwoId = sr?.twoPc || sl.twoPc || "啄木";
  const curFourObj = DISC_SETS[curFourId];
  const curTwoObj = DISC_SETS[curTwoId];

  // Ensure pieces exist if in pieces mode before scoring
  if (bm === "pieces" && (!Array.isArray(sl.pieces) || sl.pieces.length !== 6)) {
    sl.pieces = buildDefaultSixPieces(ch, sl.fourPc, sl.twoPc, st?.d4 || "CR", st?.d5 || "ELEM", st?.d6 || "ATK%", sr?.bestSub || { CR: 10, CD: 10, "ATK%": 8 });
  }

  const rating = computeSlotBuildRating(sl, sr, ch);
  const subGains = computeSlotSubstatGains(slotIdx, sim);

  // Compute the 6 active disc main labels & suit icons for the visual vinyl platter strip
  const bestParts = typeof sr?.bestDisc === "string" ? sr.bestDisc.split("/") : [];
  const d4Main = bm === "pieces" && sl.pieces?.[3] ? sl.pieces[3].main : (sl.discAuto === false && sl.d4 ? sl.d4 : (st?.d4 || bestParts[0] || "CR"));
  const d5Main = bm === "pieces" && sl.pieces?.[4] ? sl.pieces[4].main : (sl.discAuto === false && sl.d5 ? sl.d5 : (st?.d5 || bestParts[1] || "ELEM"));
  const d6Main = bm === "pieces" && sl.pieces?.[5] ? sl.pieces[5].main : (sl.discAuto === false && sl.d6 ? sl.d6 : (st?.d6 || bestParts[2] || "ATK%"));
  const platterMains = ["HP_FLAT", "ATK_FLAT", "DEF_FLAT", d4Main, d5Main, d6Main];
  const platterShortLabels = ["生命", "攻击", "防御", DISC_MAIN_ZH[d4Main] || d4Main, DISC_MAIN_ZH[d5Main] || d5Main, DISC_MAIN_ZH[d6Main] || d6Main];

  let buildModePanelHtml = "";
  if (bm === "auto") {
    const curSub = sl.subAuto === false && sl.sub ? sl.sub : (sr?.bestSub || { CR: 10, CD: 10, "ATK%": 8 });
    buildModePanelHtml = `
      <div class="bm-box">
        <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:4px 8px;">
          <label class="chk-pill"><input type="checkbox" data-slot-discauto="${slotIdx}" ${sl.discAuto !== false ? "checked" : ""}> 自动寻优[4][5][6]主词条</label>
          <span class="mono muted" style="font-size:10.5px;">最优解: <strong style="color:var(--foreground);">${escHtml(fmtDiscZh(sr?.bestDisc))}</strong></span>
        </div>
        ${sl.discAuto === false ? `
          <div class="ws-grid-3">
            <label class="ws-field"><span>[4]号盘主词条</span><select data-slot-d4="${slotIdx}">${DISC_SLOT4_MAINS.map(m => `<option value="${m}" ${(sl.d4 || st?.d4) === m ? "selected" : ""}>${DISC_MAIN_ZH[m]}</option>`).join("")}</select></label>
            <label class="ws-field"><span>[5]号盘主词条</span><select data-slot-d5="${slotIdx}">${DISC_SLOT5_MAINS.map(m => `<option value="${m}" ${(sl.d5 || st?.d5) === m ? "selected" : ""}>${DISC_MAIN_ZH[m]}</option>`).join("")}</select></label>
            <label class="ws-field"><span>[6]号盘主词条</span><select data-slot-d6="${slotIdx}">${DISC_SLOT6_MAINS.map(m => `<option value="${m}" ${(sl.d6 || st?.d6) === m ? "selected" : ""}>${DISC_MAIN_ZH[m]}</option>`).join("")}</select></label>
          </div>
        ` : ""}
        <div class="row" style="justify-content:space-between;gap:8px;">
          <label style="font-size:11px;flex:1;">有效副词条预算: <strong class="mono" style="color:var(--foreground);">${sl.rolls ?? 28}</strong> 词条
            <input type="range" min="10" max="42" step="1" value="${sl.rolls ?? 28}" data-slot-rolls="${slotIdx}">
          </label>
          <label class="chk-pill"><input type="checkbox" data-slot-subauto="${slotIdx}" ${sl.subAuto !== false ? "checked" : ""}> 自动配平</label>
        </div>
        ${sl.subAuto === false ? `
          <div class="ws-grid-5">
            ${["CR", "CD", "ATK%", "HP%", "DEF%", "AP", "PEN", "ATK_FLAT"].map(sk => {
              const meta = DISC_SUB_META.find(x => x.key === sk);
              return `<label class="ws-field"><span>${meta?.zh || sk}</span><input type="number" min="0" max="30" step="1" value="${curSub[sk] || 0}" data-slot-subk="${slotIdx}:${sk}"></label>`;
            }).join("")}
          </div>
        ` : `<div class="muted mono" style="font-size:11px;">分配: ${Object.entries(sr?.bestSub || {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => `${k}×${v}`).join(" · ") || "无"}</div>`}
      </div>
    `;
  } else if (bm === "pieces") {
    const pIdx = sl.activePieceIdx ?? 0;
    const curP = sl.pieces[pIdx];
    const mainPool = pIdx === 0 ? ["HP_FLAT"] : pIdx === 1 ? ["ATK_FLAT"] : pIdx === 2 ? ["DEF_FLAT"] : pIdx === 3 ? DISC_SLOT4_MAINS : pIdx === 4 ? DISC_SLOT5_MAINS : DISC_SLOT6_MAINS;
    const pieceRollSum = Object.values(curP.subs || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);

    buildModePanelHtml = `
      <div class="bm-box">
        <div class="row" style="justify-content:space-between;gap:6px;">
          <span class="muted" style="font-size:11px;">正在精调 <strong>[${pIdx + 1}]号盘</strong> · 合计 <strong>${Number(pieceRollSum.toFixed(1))}</strong> 词条 · 激活 <strong>${escHtml(sr?.fourPc || "无")}4+${escHtml(sr?.twoPc || "无")}2</strong></span>
          <div class="row" style="gap:4px;">
            <button type="button" class="btn btn-xs btn-primary" data-slot-pool-opt="${slotIdx}" title="从本地驱动盘池通过 Web Worker 后台计算最优6盘搭配">盘池寻优(${enkaVault.discPool.length})</button>
            <button type="button" class="btn btn-xs" data-piece-autofill="${slotIdx}" title="按当前最优套装重置6张盘">重置6盘</button>
          </div>
        </div>
        <div class="ws-grid-2">
          <label class="ws-field"><span>[${pIdx + 1}]号盘所属套装</span>
            <select data-piece-set="${slotIdx}">${set2List.map(s => `<option value="${escHtml(s.id)}" ${curP.set === s.id ? "selected" : ""}>${escHtml(s.name)}</option>`).join("")}</select>
          </label>
          <label class="ws-field"><span>[${pIdx + 1}]号盘主词条</span>
            <select data-piece-main="${slotIdx}" ${pIdx < 3 ? "disabled" : ""}>${mainPool.map(m => `<option value="${m}" ${curP.main === m ? "selected" : ""}>${DISC_MAIN_LONG_ZH[m] || m}</option>`).join("")}</select>
          </label>
        </div>
        <div class="ws-grid-5">
          ${DISC_SUB_META.map(meta => `
            <label class="ws-field">
              <span>${meta.zh}</span>
              <input type="number" min="0" max="6" step="0.5" value="${curP.subs?.[meta.key] || 0}" data-piece-sub="${slotIdx}:${meta.key}">
            </label>
          `).join("")}
        </div>
      </div>
    `;
  } else {
    if (!sl.panel) {
      sl.panel = {
        hp: Math.round(st?.init_hp || 11000),
        atk: Math.round(st?.init_atk || 2800),
        def: Math.round(st?.init_def || 800),
        cr: Number(((st?.init_cr || 0.65) * 100).toFixed(1)),
        cd: Number(((st?.init_cd || 1.40) * 100).toFixed(1)),
        elemBonus: Number(((st?.m_elem || 0.30) * 100).toFixed(1)),
        penRatio: Number(((st?.init_pen || 0) * 100).toFixed(1)),
        penFlat: Math.round(st?.s_pen_flat || 0),
        ap: Math.round(st?.init_ap || 120),
        am: Math.round(st?.init_am || ch.am),
        imp: Math.round(st?.init_imp || ch.imp),
        er: Number((st?.init_er || ch.er).toFixed(2)),
        includesEnterCombat: true
      };
    }
    const pn = sl.panel;
    buildModePanelHtml = `
      <div class="bm-box">
        <div class="row" style="justify-content:space-between;">
          <span class="muted" style="font-size:11px;">直填角色详情页局外面板（含音擎副词条与2件套）：</span>
          <button type="button" class="btn btn-xs" data-panel-sync="${slotIdx}">同步自动初值</button>
        </div>
        <div class="ws-grid-4">
          <label class="ws-field"><span>局外生命</span><input type="number" step="50" value="${pn.hp}" data-panel-f="${slotIdx}:hp"></label>
          <label class="ws-field"><span>局外攻击</span><input type="number" step="20" value="${pn.atk}" data-panel-f="${slotIdx}:atk"></label>
          <label class="ws-field"><span>局外防御</span><input type="number" step="10" value="${pn.def}" data-panel-f="${slotIdx}:def"></label>
          <label class="ws-field"><span>暴击率%</span><input type="number" step="0.5" value="${pn.cr}" data-panel-f="${slotIdx}:cr"></label>
          <label class="ws-field"><span>暴伤%</span><input type="number" step="1" value="${pn.cd}" data-panel-f="${slotIdx}:cd"></label>
          <label class="ws-field"><span>属伤加成%</span><input type="number" step="1" value="${pn.elemBonus}" data-panel-f="${slotIdx}:elemBonus"></label>
          <label class="ws-field"><span>穿透率%</span><input type="number" step="1" value="${pn.penRatio}" data-panel-f="${slotIdx}:penRatio"></label>
          <label class="ws-field"><span>固定穿透</span><input type="number" step="9" value="${pn.penFlat}" data-panel-f="${slotIdx}:penFlat"></label>
          <label class="ws-field"><span>异常精通</span><input type="number" step="5" value="${pn.ap}" data-panel-f="${slotIdx}:ap"></label>
          <label class="ws-field"><span>异常掌控</span><input type="number" step="1" value="${pn.am}" data-panel-f="${slotIdx}:am"></label>
          <label class="ws-field"><span>冲击力</span><input type="number" step="1" value="${pn.imp}" data-panel-f="${slotIdx}:imp"></label>
          <label class="ws-field"><span>能量回复</span><input type="number" step="0.05" value="${pn.er}" data-panel-f="${slotIdx}:er"></label>
        </div>
      </div>
    `;
  }

  const effSh = bd?.shares || ch.prof?.shares || { basic: 0.3, dash: 0.1, ex: 0.25, chain: 0.12, ult: 0.23, aftershock: 0 };
  const cSh = sl.customShares || {
    basic: Math.round((effSh.basic || 0) * 100),
    dash: Math.round((effSh.dash || 0) * 100),
    ex: Math.round((effSh.ex || 0) * 100),
    chain: Math.round((effSh.chain || 0) * 100),
    ult: Math.round((effSh.ult || 0) * 100),
    aftershock: Math.round((effSh.aftershock || 0) * 100)
  };
  const se = sl.slotExtra || {};
  const hasVaultRec = Boolean(enkaVault.agents[ch.id]);

  // Smart 4-cell live combat telemetry per specialty
  const stat1Label = ch.wt === "Rupture" ? "局内贯穿" : ch.wt === "Armorer" ? "局内防御" : "局内攻击";
  const stat1Val =
    ch.wt === "Rupture" || ch.wt === "Armorer"
      ? fmtNum(bd?.baseVal || st?.init_atk)
      : fmtNum(bd?.combat_atk || st?.init_atk);
  const stat2Label = ch.wt === "Anomaly" ? "精通 / 掌控" : "局内双暴";
  const stat2Val =
    ch.wt === "Anomaly"
      ? `${Math.round(bd?.c_ap || st?.init_ap || 0)} / ${Math.round((st?.init_am || 0) + (st?.eff?.c_am_flat || 0))}`
      : `${((bd?.c_cr || 0) * 100).toFixed(0)}/${((bd?.c_cd || 0) * 100).toFixed(0)}%`;

  const wepSubShort = curWep
    ? curWep.sn === "Anomaly Proficiency"
      ? `精通+${Math.round(curWep.sv || 0)}`
      : `${SN_ZH[curWep.sn] || curWep.sn}+${((curWep.sv || 0) * 100).toFixed(0)}%`
    : "";

  return `
    <div class="slot-card" style="--slot-elem:${elemHex};">
      <div class="slot-hero-banner ${fullArtUrl ? "has-art" : ""}">
        ${
          fullArtUrl
            ? `<div class="slot-portrait-wrap" data-no-i18n="1"><img class="slot-portrait-img" src="${escHtml(fullArtUrl)}" alt="${escHtml(ch.n)}" loading="eager" decoding="async" referrerpolicy="no-referrer" ${splashUrl && splashUrl !== fullArtUrl ? `data-alt-src="${escHtml(splashUrl)}"` : ""} onerror="if(this.dataset.altSrc){this.src=this.dataset.altSrc;this.removeAttribute('data-alt-src');this.classList.add('is-bust');}else{this.parentElement.style.display='none';this.closest('.slot-hero-banner').classList.remove('has-art');}"></div>`
            : ""
        }
        <div class="slot-banner-top">
          <div class="slot-meta-pills">
            <span class="slot-pos-tag" data-no-i18n>0${slotIdx + 1}</span>
            <span class="slot-rank-pill rank-${ch.r}" data-no-i18n>${ch.r}</span>
            <span class="slot-role-meta"><span class="elem-dot elem-${ch.eb}"></span>${escHtml(ch.e)} · ${escHtml(ch.p)}</span>
            <span class="aa-dot-tag ${sr?.aa?.active ? "on" : "off"}">${sr?.aa?.active ? "● 额外能力激活" : "○ 额外能力未满"}</span>
          </div>
          <button type="button" class="slot-close-btn" data-slot-remove="${slotIdx}" title="卸下此槽位">×</button>
        </div>

        <div class="slot-banner-mid">
          <label class="slot-agent-switch" title="点击直接更换本槽位代理人">
            <span class="slot-agent-title">${escHtml(ch.n)}</span>
            ${sl.enkaSourceUid && bm === "pieces" ? `<span class="badge b-info">UID实盘</span>` : ""}
            <span class="slot-switch-caret">更换 ▾</span>
            <select class="overlay-native-select" data-slot-char="${slotIdx}" aria-label="更换角色">
              ${SC_CHARS.map(c => `<option value="${escHtml(c.id)}" ${c.id === ch.id ? "selected" : ""}>[${c.r}·${c.e}${c.p}] ${escHtml(c.n)}</option>`).join("")}
            </select>
          </label>
          <button type="button" class="slot-inline-btn" data-ws-edit-char="${escHtml(ch.id)}" title="在工坊修改此角色底层公式">工坊</button>
          ${hasVaultRec ? `<button type="button" class="slot-inline-btn primary" data-slot-load-vault="${slotIdx}" title="套用练度柜已同步的真实影画/音擎/6张驱动盘">展柜实盘</button>` : ""}
          ${enkaVault.discPool.length > 0 && bm !== "pieces" ? `<button type="button" class="slot-inline-btn" data-slot-pool-opt="${slotIdx}" title="从本地驱动盘池用 Web Worker 后台配出最强6盘">盘库寻优</button>` : ""}
        </div>

        <div class="slot-banner-bot">
          <div class="mindscape-strip" role="group" aria-label="影画阶数 M0-M6">
            <button type="button" class="m-zero-tag ${sl.m === 0 ? "active" : ""}" data-slot-mpip="${slotIdx}:0" title="切换至影画 M0 (本体)" data-no-i18n>M0</button>
            <div class="m-pips">
              ${[1, 2, 3, 4, 5, 6]
                .map(
                  (lv) =>
                    `<button type="button" class="m-pip ${sl.m >= lv ? "lit" : ""} ${sl.m === lv ? "cur" : ""}" data-slot-mpip="${slotIdx}:${lv}" title="影画 M${lv} (再次点击归零)" data-no-i18n>${lv}</button>`
                )
                .join("")}
            </div>
          </div>

          <div class="build-grade-stamp grade-${rating.grade}" title="驱动盘有效词条综合评级 (${rating.effRolls.toFixed(1)} 有效词条)">
            <span class="bgs-tier" data-no-i18n>${rating.grade}</span>
            <span class="bgs-rolls mono">${rating.effRolls.toFixed(1)}词</span>
          </div>
        </div>
      </div>

      <div class="slot-stat-strip">
        <div class="slot-stat-cell">
          <span class="slot-stat-k">${stat1Label}</span>
          <span class="slot-stat-v">${stat1Val}</span>
        </div>
        <div class="slot-stat-cell">
          <span class="slot-stat-k">${stat2Label}</span>
          <span class="slot-stat-v">${stat2Val}</span>
        </div>
        <div class="slot-stat-cell">
          <span class="slot-stat-k">期望贡献</span>
          <span class="slot-stat-v">${fmtNum(sr?.weightedDmg)}</span>
        </div>
        <div class="slot-stat-cell">
          <span class="slot-stat-k">全队占比</span>
          <span class="slot-stat-v accent">${((sr?.dpsShare || 0) * 100).toFixed(1)}%</span>
        </div>
      </div>

      <div class="slot-equip-deck">
        <div class="equip-wep-socket">
          ${renderWeaponThumb(curWep?.id, curWep?.n || "音擎", curWep?.r || "S", "wep-lg")}
          <div class="equip-wep-main">
            <div class="equip-wep-head">
              <label class="socket-picker" title="点击更换装备音擎">
                <span class="socket-wep-title">[${curWep?.r || "S"}${curWep?.id === ch.sig ? "·专" : ""}] ${escHtml(curWep?.n || sl.wid)}</span>
                <span class="socket-caret" data-no-i18n>▾</span>
                <select class="overlay-native-select" data-slot-wep="${slotIdx}" aria-label="装备音擎">
                  <optgroup label="本职业适配 (${ch.p})">
                    ${sameWeps.map(w => `<option value="${escHtml(w.id)}" ${w.id === sl.wid ? "selected" : ""}>[${w.r}${w.id === ch.sig ? "·专" : ""}] ${escHtml(w.n)}</option>`).join("")}
                  </optgroup>
                  <optgroup label="跨职业音擎 (默认仅白值生效)">
                    ${otherWeps.map(w => `<option value="${escHtml(w.id)}" ${w.id === sl.wid ? "selected" : ""}>[${w.r}·${w.p}] ${escHtml(w.n)}</option>`).join("")}
                  </optgroup>
                </select>
              </label>
              <button type="button" class="socket-mini-btn" data-ws-edit-wep="${escHtml(sl.wid)}" title="在工坊精改音擎词条">精改</button>
            </div>
            <div class="equip-wep-sub">
              <div class="overclock-stars" role="group" aria-label="音擎精炼星级">
                ${[1, 2, 3, 4, 5]
                  .map(
                    (r) =>
                      `<button type="button" class="oc-star ${(sl.ref || 1) >= r ? "lit" : ""}" data-slot-refpip="${slotIdx}:${r}" title="音擎精炼 R${r} 星" data-no-i18n>★</button>`
                  )
                  .join("")}
                <span class="oc-label mono" data-no-i18n>R${sl.ref || 1}</span>
              </div>
              <span class="wep-stat-chip mono">基础${curWep?.batk || 0}${wepSubShort ? ` · ${escHtml(wepSubShort)}` : ""}</span>
            </div>
          </div>
        </div>

        <div class="equip-suits-grid">
          <label class="equip-suit-cell ${bm === "pieces" ? "locked" : ""}" title="${bm === "pieces" ? "逐盘精调模式下由 1-6 号盘自动统计激活套装" : "点击更换 4 件套驱动盘"}">
            ${renderDiscVinyl(curFourId, curFourObj?.name || curFourId, "disc-md")}
            <div class="suit-cell-copy">
              <span class="suit-count-tag" data-no-i18n>4PC</span>
              <span class="suit-cell-name">${escHtml(curFourObj?.name || curFourId)} ${bm === "pieces" ? "" : "▾"}</span>
            </div>
            <select class="overlay-native-select" data-slot-fourpc="${slotIdx}" ${bm === "pieces" ? "disabled" : ""} aria-label="4件套驱动盘">
              ${setList.map(s => `<option value="${escHtml(s.id)}" ${curFourId === s.id ? "selected" : ""}>${escHtml(s.name)}</option>`).join("")}
            </select>
          </label>

          <label class="equip-suit-cell ${bm === "pieces" ? "locked" : ""}" title="${bm === "pieces" ? "逐盘精调模式下由 1-6 号盘自动统计激活套装" : "点击更换 2 件套驱动盘"}">
            ${renderDiscVinyl(curTwoId, curTwoObj?.name || curTwoId, "disc-md")}
            <div class="suit-cell-copy">
              <span class="suit-count-tag two" data-no-i18n>2PC</span>
              <span class="suit-cell-name">${escHtml(curTwoObj?.name || curTwoId)} ${bm === "pieces" ? "" : "▾"}</span>
            </div>
            <select class="overlay-native-select" data-slot-twopc="${slotIdx}" ${bm === "pieces" ? "disabled" : ""} aria-label="2件套驱动盘">
              ${set2List.map(s => `<option value="${escHtml(s.id)}" ${curTwoId === s.id ? "selected" : ""}>${escHtml(s.name)}</option>`).join("")}
            </select>
          </label>
        </div>
      </div>

      <div class="slot-divider-sec">
        <div class="disc-platter-strip" role="group" aria-label="1-6号驱动盘主词条速览">
          ${[0, 1, 2, 3, 4, 5]
            .map((i) => {
              const isAct = bm === "pieces" && (sl.activePieceIdx ?? 0) === i;
              const slotSetId =
                bm === "pieces" && sl.pieces?.[i]
                  ? sl.pieces[i].set
                  : i < 4
                  ? curFourId !== "无"
                    ? curFourId
                    : curTwoId
                  : curTwoId;
              const slotSetName = DISC_SETS[slotSetId]?.name || slotSetId;
              const ps = rating.pieceSummaries?.[i];
              return `
                <button type="button" class="disc-platter ${isAct ? "active" : ""}" data-piece-tab="${slotIdx}:${i}" title="点击切至 [${i + 1}]号驱动盘精调 (${escHtml(slotSetName)} · ${DISC_MAIN_LONG_ZH[platterMains[i]] || platterMains[i]})">
                  <div class="disc-platter-top">
                    <span class="disc-platter-idx" data-no-i18n>0${i + 1}</span>
                    ${ps ? `<span class="disc-platter-grade grade-${ps.grade}" data-no-i18n>${ps.grade}</span>` : ""}
                  </div>
                  ${renderDiscVinyl(slotSetId, slotSetName, "disc-xs")}
                  <span class="disc-platter-main">${escHtml(platterShortLabels[i])}</span>
                </button>
              `;
            })
            .join("")}
        </div>

        ${
          subGains.length > 0
            ? `
          <div class="sub-gain-strip" title="基于当前队伍与Buff环境，新增 +1 条S级副词条带来的边际提升比例">
            <div class="sub-gain-head">
              <span>+1 词条边际收益优先级</span>
              <span class="mono muted">${subGains[0]?.useSelf ? "个人伤害口径" : "全队实轴口径"}</span>
            </div>
            <div class="sub-gain-grid">
              ${subGains
                .map(
                  (g, gi) => `
                <div class="sub-gain-item ${gi === 0 ? "top" : ""}">
                  <div class="sub-gain-row">
                    <span class="sub-gain-lbl">${escHtml(g.label)}</span>
                    <span class="sub-gain-val mono">+${g.pct.toFixed(2)}%</span>
                  </div>
                  <div class="sub-gain-track"><div class="sub-gain-fill" style="width:${g.barPct.toFixed(1)}%;"></div></div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        `
            : ""
        }

        <div class="bm-tabs">
          <button type="button" class="bm-tab ${bm === "auto" ? "active" : ""}" data-slot-bm="${slotIdx}:auto">自动毕业寻优</button>
          <button type="button" class="bm-tab ${bm === "pieces" ? "active" : ""}" data-slot-bm="${slotIdx}:pieces">1-6号逐盘精调</button>
          <button type="button" class="bm-tab ${bm === "panel" ? "active" : ""}" data-slot-bm="${slotIdx}:panel">局外面板直填</button>
        </div>

        ${buildModePanelHtml}
      </div>

      <details class="slot-adv">
        <summary>展开高阶调参 (等级/核心技/动作占比/覆盖率/额外Buff注入)</summary>
        <div class="slot-adv-body">
          <div class="ws-grid-4">
            <label class="ws-field"><span>角色等级(1~60)</span><input type="number" min="1" max="60" value="${sl.agentLv ?? 60}" data-slot-adv="${slotIdx}:agentLv"></label>
            <label class="ws-field"><span>技能基础Lv(1~12)</span><input type="number" min="1" max="12" value="${sl.skillLv ?? 12}" data-slot-adv="${slotIdx}:skillLv"></label>
            <label class="ws-field"><span>核心技(0~F)</span>
              <select data-slot-adv="${slotIdx}:coreLv">${CORE_LABELS.map((lb, ci) => `<option value="${ci}" ${(sl.coreLv ?? 6) === ci ? "selected" : ""}>${lb}</option>`).join("")}</select>
            </label>
            <label class="ws-field"><span>音擎等级(1~60)</span><input type="number" min="1" max="60" value="${sl.wepLv ?? 60}" data-slot-adv="${slotIdx}:wepLv"></label>
            <label class="ws-field"><span>拐力覆盖率%</span><input type="number" min="20" max="100" step="5" value="${Math.round((sl.uptime ?? 1) * 100)}" data-slot-pct="${slotIdx}:uptime"></label>
            <label class="ws-field"><span>4件套覆盖率%</span><input type="number" min="0" max="100" step="5" value="${Math.round((sl.fourPcUptime ?? 1) * 100)}" data-slot-pct="${slotIdx}:fourPcUptime"></label>
            <label class="ws-field"><span>音擎特效覆盖%</span><input type="number" min="0" max="100" step="5" value="${Math.round((sl.wepUptime ?? 1) * 100)}" data-slot-pct="${slotIdx}:wepUptime"></label>
            <label class="ws-field"><span>额外能力状态</span>
              <select data-slot-str="${slotIdx}:aaMode">
                <option value="auto" ${sl.aaMode === "auto" ? "selected" : ""}>自动组队判定</option>
                <option value="on" ${sl.aaMode === "on" ? "selected" : ""}>强制点亮</option>
                <option value="off" ${sl.aaMode === "off" ? "selected" : ""}>强制关闭</option>
              </select>
            </label>
            <label class="ws-field"><span>轮换动作权重</span>
              <input type="number" step="0.05" min="0" max="2.5" value="${Number((sl.weightMode === "manual" ? sl.weight : (sr?.rotWeight || 1)).toFixed(2))}" data-slot-weight="${slotIdx}">
            </label>
            <label class="ws-field"><span>个人总倍率乘算</span><input type="number" step="0.05" min="0.2" max="3.0" value="${sl.mvMult ?? 1.0}" data-slot-adv="${slotIdx}:mvMult"></label>
            <label class="ws-field"><span>单属性词条上限</span><input type="number" min="4" max="36" value="${sl.subRollCap ?? 18}" data-slot-adv="${slotIdx}:subRollCap"></label>
            <label class="ws-field"><span>跨职业解锁音擎</span>
              <select data-slot-bool="${slotIdx}:allowCrossWep"><option value="0" ${!sl.allowCrossWep ? "selected" : ""}>遵循职业限制</option><option value="1" ${sl.allowCrossWep ? "selected" : ""}>强开特效测试</option></select>
            </label>
          </div>

          <div style="margin-top:8px;padding-top:6px;border-top:1px dashed var(--border);">
            <label class="chk-pill" style="margin-bottom:4px;"><input type="checkbox" data-slot-csh-on="${slotIdx}" ${sl.customSharesEnabled ? "checked" : ""}> 手动覆写本槽位招式倍率占比% (普攻/闪反/强化E/连携/终结技)</label>
            ${sl.customSharesEnabled ? `
              <div class="ws-grid-6">
                <label class="ws-field"><span>普攻%</span><input type="number" value="${cSh.basic}" data-slot-csh="${slotIdx}:basic"></label>
                <label class="ws-field"><span>闪反%</span><input type="number" value="${cSh.dash}" data-slot-csh="${slotIdx}:dash"></label>
                <label class="ws-field"><span>强化E%</span><input type="number" value="${cSh.ex}" data-slot-csh="${slotIdx}:ex"></label>
                <label class="ws-field"><span>连携%</span><input type="number" value="${cSh.chain}" data-slot-csh="${slotIdx}:chain"></label>
                <label class="ws-field"><span>大招%</span><input type="number" value="${cSh.ult}" data-slot-csh="${slotIdx}:ult"></label>
                <label class="ws-field"><span>追击%</span><input type="number" value="${cSh.aftershock}" data-slot-csh="${slotIdx}:aftershock"></label>
              </div>
            ` : ""}
          </div>

          <div style="margin-top:8px;padding-top:6px;border-top:1px dashed var(--border);">
            <div style="font-size:11px;font-weight:700;margin-bottom:4px;">本槽位额外局内属性补正注入 (测试鸣徽/未实装拐/临时Buff，填0不生效)：</div>
            <div class="ws-grid-5">
              <label class="ws-field"><span>攻击%</span><input type="number" step="5" value="${se.atk_pct || 0}" data-slot-extra="${slotIdx}:atk_pct"></label>
              <label class="ws-field"><span>固定攻击</span><input type="number" step="50" value="${se.atk_flat || 0}" data-slot-extra="${slotIdx}:atk_flat"></label>
              <label class="ws-field"><span>暴击%</span><input type="number" step="5" value="${se.cr || 0}" data-slot-extra="${slotIdx}:cr"></label>
              <label class="ws-field"><span>暴伤%</span><input type="number" step="10" value="${se.cd || 0}" data-slot-extra="${slotIdx}:cd"></label>
              <label class="ws-field"><span>增伤%</span><input type="number" step="10" value="${se.dmg || 0}" data-slot-extra="${slotIdx}:dmg"></label>
              <label class="ws-field"><span>减防%</span><input type="number" step="5" value="${se.def_shred || 0}" data-slot-extra="${slotIdx}:def_shred"></label>
              <label class="ws-field"><span>穿透%</span><input type="number" step="5" value="${se.pen || 0}" data-slot-extra="${slotIdx}:pen"></label>
              <label class="ws-field"><span>减抗%</span><input type="number" step="5" value="${se.res_shred || 0}" data-slot-extra="${slotIdx}:res_shred"></label>
              <label class="ws-field"><span>精通+</span><input type="number" step="20" value="${se.ap || 0}" data-slot-extra="${slotIdx}:ap"></label>
              <label class="ws-field"><span>终乘%</span><input type="number" step="5" value="${se.final_mult || 0}" data-slot-extra="${slotIdx}:final_mult"></label>
            </div>
          </div>
        </div>
      </details>
    </div>
  `;
}

function bindSlotCardEvents(grid: HTMLElement, sim: any) {
  grid.querySelectorAll<any>("[data-slot-pool-opt]").forEach(btn => {
    btn.addEventListener("click", () => {
      void optimizeSlotFromVaultPool(Number(btn.dataset.slotPoolOpt));
    });
  });
  grid.querySelectorAll<any>("[data-slot-load-vault]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.slotLoadVault);
      const curCid = appStore.state.slots[idx]?.cid;
      const rec = curCid ? enkaVault.agents[curCid] : null;
      if (!rec) return;
      const slotCfg = syncedRecordToSlotConfig(rec, makeDefaultSlot);
      if (slotCfg) {
        appStore.state.slots[idx] = slotCfg;
        ensureTimelineInitialized(true);
        refreshAllUI();
      }
    });
  });
  grid.querySelectorAll<any>("[data-slot-char]").forEach(sel => {
    sel.addEventListener("change", (e: any) => assignCharacterToSlot(Number(sel.dataset.slotChar), e.target.value));
  });
  grid.querySelectorAll<any>("[data-slot-remove]").forEach(btn => {
    btn.addEventListener("click", () => assignCharacterToSlot(Number(btn.dataset.slotRemove), null));
  });
  grid.querySelectorAll<any>("[data-ws-edit-char]").forEach(btn => {
    btn.addEventListener("click", () => openCustomWorkshop("chars", btn.dataset.wsEditChar));
  });
  grid.querySelectorAll<any>("[data-ws-edit-wep]").forEach(btn => {
    btn.addEventListener("click", () => openCustomWorkshop("weps", btn.dataset.wsEditWep));
  });
  grid.querySelectorAll<HTMLButtonElement>("[data-slot-mpip]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [idxStr, lvStr] = (btn.dataset.slotMpip || "0:0").split(":");
      const idx = Number(idxStr);
      const lv = Number(lvStr);
      const target = appStore.state.slots[idx];
      if (!target) return;
      target.m = lv > 0 && target.m === lv ? 0 : lv;
      refreshAllUI();
    });
  });
  grid.querySelectorAll<HTMLButtonElement>("[data-slot-refpip]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [idxStr, refStr] = (btn.dataset.slotRefpip || "0:1").split(":");
      const target = appStore.state.slots[Number(idxStr)];
      if (!target) return;
      target.ref = Number(refStr);
      refreshAllUI();
    });
  });
  grid.querySelectorAll<any>("[data-slot-m]").forEach(sel => {
    sel.addEventListener("change", (e: any) => { appStore.state.slots[Number(sel.dataset.slotM)]!.m = Number(e.target.value); refreshAllUI(); });
  });
  grid.querySelectorAll<any>("[data-slot-wep]").forEach(sel => {
    sel.addEventListener("change", (e: any) => {
      const idx = Number(sel.dataset.slotWep);
      const wid = e.target.value;
      appStore.state.slots[idx]!.wid = wid;
      appStore.state.slots[idx]!.ref = SC_WEPS[wid]?.r === "S" ? 1 : 5;
      refreshAllUI();
    });
  });
  grid.querySelectorAll<any>("[data-slot-ref]").forEach(sel => {
    sel.addEventListener("change", (e: any) => { appStore.state.slots[Number(sel.dataset.slotRef)]!.ref = Number(e.target.value); refreshAllUI(); });
  });
  grid.querySelectorAll<HTMLSelectElement>("[data-slot-fourpc]").forEach(sel => {
    sel.addEventListener("change", (e: any) => { appStore.state.slots[Number(sel.dataset.slotFourpc)]!.fourPc = e.target.value; refreshAllUI(); });
  });
  grid.querySelectorAll<HTMLSelectElement>("[data-slot-twopc]").forEach(sel => {
    sel.addEventListener("change", (e: any) => { appStore.state.slots[Number(sel.dataset.slotTwopc)]!.twoPc = e.target.value; refreshAllUI(); });
  });
  grid.querySelectorAll<any>("[data-slot-bm]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [idxStr, mode] = btn.dataset.slotBm.split(":");
      const idx = Number(idxStr);
      const sl = appStore.state.slots[idx]!;
      const sr = sim.slotResults.find((r: any) => r.slotIdx === idx);
      if (mode === "pieces" && (!sl.pieces || sl.pieces.length !== 6)) {
        sl.pieces = buildDefaultSixPieces(CHAR_MAP[sl.cid], sl.fourPc, sl.twoPc, sr?.st?.d4 || "CR", sr?.st?.d5 || "ELEM", sr?.st?.d6 || "ATK%", sr?.bestSub || { CR: 10, CD: 10, "ATK%": 8 });
      }
      if (mode === "panel" && !sl.panel && sr?.st) {
        sl.panel = {
          hp: Math.round(sr.st.init_hp), atk: Math.round(sr.st.init_atk), def: Math.round(sr.st.init_def),
          cr: Number((sr.st.init_cr * 100).toFixed(1)), cd: Number((sr.st.init_cd * 100).toFixed(1)),
          elemBonus: Number(((sr.st.m_elem || 0) * 100).toFixed(1)), penRatio: Number((sr.st.init_pen * 100).toFixed(1)),
          penFlat: Math.round(sr.st.s_pen_flat || 0), ap: Math.round(sr.st.init_ap), am: Math.round(sr.st.init_am),
          imp: Math.round(sr.st.init_imp), er: Number(sr.st.init_er.toFixed(2)), includesEnterCombat: true
        };
      }
      sl.buildMode = mode;
      refreshAllUI();
    });
  });

  // Auto mode controls
  grid.querySelectorAll<any>("[data-slot-discauto]").forEach(chk => {
    chk.addEventListener("change", (e: any) => {
      const idx = Number(chk.dataset.slotDiscauto);
      const sr = sim.slotResults.find(r => r.slotIdx === idx);
      appStore.state.slots[idx].discAuto = e.target.checked;
      if (!e.target.checked && sr?.st) {
        appStore.state.slots[idx].d4 = sr.st.d4; appStore.state.slots[idx].d5 = sr.st.d5; appStore.state.slots[idx].d6 = sr.st.d6;
      }
      refreshAllUI();
    });
  });
  ["d4", "d5", "d6"].forEach(dk => {
    grid.querySelectorAll<any>(`[data-slot-${dk}]`).forEach(sel => {
      sel.addEventListener("change", (e: any) => { appStore.state.slots[Number(sel.dataset[`slot${dk.toUpperCase()}`])][dk] = e.target.value; refreshAllUI(); });
    });
  });
  grid.querySelectorAll<any>("[data-slot-rolls]").forEach(rng => {
    rng.addEventListener("change", (e: any) => { appStore.state.slots[Number(rng.dataset.slotRolls)].rolls = Number(e.target.value); refreshAllUI(); });
  });
  grid.querySelectorAll<any>("[data-slot-subauto]").forEach(chk => {
    chk.addEventListener("change", (e: any) => {
      const idx = Number(chk.dataset.slotSubauto);
      const sr = sim.slotResults.find(r => r.slotIdx === idx);
      appStore.state.slots[idx].subAuto = e.target.checked;
      if (!e.target.checked && sr?.bestSub) appStore.state.slots[idx].sub = { ...sr.bestSub };
      refreshAllUI();
    });
  });
  grid.querySelectorAll<any>("[data-slot-subk]").forEach(inp => {
    inp.addEventListener("change", (e: any) => {
      const [idxStr, sk] = inp.dataset.slotSubk.split(":");
      const sl = appStore.state.slots[Number(idxStr)];
      sl.sub = { ...(sl.sub || {}), [sk]: Math.max(0, Number(e.target.value) || 0) };
      refreshAllUI();
    });
  });

  // 6-Piece Builder & Platter controls
  grid.querySelectorAll<any>("[data-piece-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [idxStr, pStr] = btn.dataset.pieceTab.split(":");
      const idx = Number(idxStr);
      const sl = appStore.state.slots[idx];
      if (!sl) return;
      const sr = sim.slotResults.find((r: any) => r.slotIdx === idx);
      if (!Array.isArray(sl.pieces) || sl.pieces.length !== 6) {
        sl.pieces = buildDefaultSixPieces(
          CHAR_MAP[sl.cid],
          sl.fourPc,
          sl.twoPc,
          sr?.st?.d4 || "CR",
          sr?.st?.d5 || "ELEM",
          sr?.st?.d6 || "ATK%",
          sr?.bestSub || { CR: 10, CD: 10, "ATK%": 8 }
        );
      }
      sl.buildMode = "pieces";
      sl.activePieceIdx = Number(pStr);
      refreshAllUI();
    });
  });
  grid.querySelectorAll<any>("[data-piece-autofill]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.pieceAutofill);
      const sl = appStore.state.slots[idx];
      const ch = CHAR_MAP[sl.cid];
      sl.pieces = buildDefaultSixPieces(ch, sl.fourPc, sl.twoPc, sl.d4 || "CR", sl.d5 || "ELEM", sl.d6 || "ATK%", { CR: 10, CD: 10, "ATK%": 8 });
      refreshAllUI();
    });
  });
  grid.querySelectorAll<any>("[data-piece-set]").forEach(sel => {
    sel.addEventListener("change", (e: any) => {
      const sl = appStore.state.slots[Number(sel.dataset.pieceSet)];
      sl.pieces[sl.activePieceIdx || 0].set = e.target.value;
      refreshAllUI();
    });
  });
  grid.querySelectorAll<any>("[data-piece-main]").forEach(sel => {
    sel.addEventListener("change", (e: any) => {
      const sl = appStore.state.slots[Number(sel.dataset.pieceMain)];
      sl.pieces[sl.activePieceIdx || 0].main = e.target.value;
      refreshAllUI();
    });
  });
  grid.querySelectorAll<any>("[data-piece-sub]").forEach(inp => {
    inp.addEventListener("change", (e: any) => {
      const [idxStr, sk] = inp.dataset.pieceSub.split(":");
      const sl = appStore.state.slots[Number(idxStr)];
      const p = sl.pieces[sl.activePieceIdx || 0];
      p.subs[sk] = Math.max(0, Math.min(6, Number(e.target.value) || 0));
      refreshAllUI();
    });
  });

  // Direct Panel controls
  grid.querySelectorAll<any>("[data-panel-sync]").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.panelSync);
      const sl = appStore.state.slots[idx];
      const tempSlots = appStore.state.slots.map((s, j) => j === idx ? { ...s, buildMode: "auto" } : s);
      const tempSim = simulateTeamV2(tempSlots, appStore.state.env, CHAR_MAP, SC_WEPS, { skipSoloBaseline: true });
      const sr = tempSim.slotResults.find(r => r.slotIdx === idx);
      if (sr?.st) {
        sl.panel = {
          hp: Math.round(sr.st.init_hp), atk: Math.round(sr.st.init_atk), def: Math.round(sr.st.init_def),
          cr: Number((sr.st.init_cr * 100).toFixed(1)), cd: Number((sr.st.init_cd * 100).toFixed(1)),
          elemBonus: Number(((sr.st.m_elem || 0) * 100).toFixed(1)), penRatio: Number((sr.st.init_pen * 100).toFixed(1)),
          penFlat: Math.round(sr.st.s_pen_flat || 0), ap: Math.round(sr.st.init_ap), am: Math.round(sr.st.init_am),
          imp: Math.round(sr.st.init_imp), er: Number(sr.st.init_er.toFixed(2)), includesEnterCombat: true
        };
        refreshAllUI();
      }
    });
  });
  grid.querySelectorAll<any>("[data-panel-f]").forEach(inp => {
    inp.addEventListener("change", (e: any) => {
      const [idxStr, fk] = inp.dataset.panelF.split(":");
      const sl = appStore.state.slots[Number(idxStr)];
      sl.panel[fk] = parseFloat(e.target.value) || 0;
      refreshAllUI();
    });
  });

  // Expert drawer controls
  grid.querySelectorAll<any>("[data-slot-adv]").forEach(el => {
    el.addEventListener("change", (e: any) => {
      const [idxStr, fk] = el.dataset.slotAdv.split(":");
      appStore.state.slots[Number(idxStr)][fk] = parseFloat(e.target.value);
      refreshAllUI();
    });
  });
  grid.querySelectorAll<any>("[data-slot-pct]").forEach(el => {
    el.addEventListener("change", (e: any) => {
      const [idxStr, fk] = el.dataset.slotPct.split(":");
      appStore.state.slots[Number(idxStr)][fk] = Math.max(0, Math.min(1, (parseFloat(e.target.value) || 0) / 100.0));
      refreshAllUI();
    });
  });
  grid.querySelectorAll<any>("[data-slot-str]").forEach(el => {
    el.addEventListener("change", (e: any) => {
      const [idxStr, fk] = el.dataset.slotStr.split(":");
      appStore.state.slots[Number(idxStr)][fk] = e.target.value;
      refreshAllUI();
    });
  });
  grid.querySelectorAll<any>("[data-slot-bool]").forEach(el => {
    el.addEventListener("change", (e: any) => {
      const [idxStr, fk] = el.dataset.slotBool.split(":");
      appStore.state.slots[Number(idxStr)][fk] = e.target.value === "1";
      refreshAllUI();
    });
  });
  grid.querySelectorAll<any>("[data-slot-weight]").forEach(el => {
    el.addEventListener("change", (e: any) => {
      const sl = appStore.state.slots[Number(el.dataset.slotWeight)];
      sl.weightMode = "manual";
      sl.weight = Math.max(0, parseFloat(e.target.value) || 0);
      refreshAllUI();
    });
  });
  grid.querySelectorAll<any>("[data-slot-csh-on]").forEach(chk => {
    chk.addEventListener("change", (e: any) => {
      const idx = Number(chk.dataset.slotCshOn);
      const sl = appStore.state.slots[idx];
      sl.customSharesEnabled = e.target.checked;
      if (e.target.checked && !sl.customShares) {
        const sh = CHAR_MAP[sl.cid]?.prof?.shares || { basic: 0.3, dash: 0.1, ex: 0.25, chain: 0.12, ult: 0.23, aftershock: 0 };
        sl.customShares = {
          basic: Math.round((sh.basic || 0) * 100), dash: Math.round((sh.dash || 0) * 100),
          ex: Math.round((sh.ex || 0) * 100), chain: Math.round((sh.chain || 0) * 100),
          ult: Math.round((sh.ult || 0) * 100), aftershock: Math.round((sh.aftershock || 0) * 100)
        };
      }
      refreshAllUI();
    });
  });
  grid.querySelectorAll<any>("[data-slot-csh]").forEach(inp => {
    inp.addEventListener("change", (e: any) => {
      const [idxStr, k] = inp.dataset.slotCsh.split(":");
      const sl = appStore.state.slots[Number(idxStr)];
      sl.customShares[k] = Math.max(0, parseFloat(e.target.value) || 0);
      refreshAllUI();
    });
  });
  grid.querySelectorAll<any>("[data-slot-extra]").forEach(inp => {
    inp.addEventListener("change", (e: any) => {
      const [idxStr, k] = inp.dataset.slotExtra.split(":");
      const sl = appStore.state.slots[Number(idxStr)];
      sl.slotExtra[k] = parseFloat(e.target.value) || 0;
      refreshAllUI();
    });
  });
}

// ============================================================================
// Section 04: 8-Dimension Swap-Cancel Engine & Interactive SVG Timeline Sequencer
// ============================================================================
function estimateSvgTextPx(str: string, fontSize = 11): number {
  let px = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0x2e80) {
      px += fontSize * 1.04;
    } else if (code >= 65 && code <= 90) {
      px += fontSize * 0.66;
    } else {
      px += fontSize * 0.57;
    }
  }
  return px;
}

function fitSvgLabel(str: string, availPx: number, fontSize = 11): string {
  const pad = 10;
  const maxInner = availPx - pad;
  if (maxInner < 18 || !str) return "";
  if (estimateSvgTextPx(str, fontSize) <= maxInner) return str;

  const ellipsisPx = fontSize * 0.85;
  const budget = maxInner - ellipsisPx;
  if (budget < 10) return "";

  let acc = 0;
  let out = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const w = ch.charCodeAt(0) >= 0x2e80 ? fontSize * 1.04 : fontSize * 0.6;
    if (acc + w > budget) break;
    acc += w;
    out += ch;
  }
  return out ? `${out}…` : "";
}

function renderSection04SwapAndTimeline(sim: any) {
  const wrap = document.getElementById("sec04Body");
  if (!wrap) return;

  const sc = appStore.state.env.swapConfig || makeDefaultSwapConfig("standard");
  const qa = sim.qaSwap || evalSwapCancelEngine([], sc, appStore.state.env);
  const active = getActiveMembersForUI();
  const tl = appStore.state.env.timelineAnalysis || analyzeTimeline(appStore.state.timelineBlocks, active);

  const presetComparisons = (Object.values(SWAP_PRESETS) as any[]).map((p: any) => {
    const testEnv = { ...appStore.state.env, swapConfig: makeDefaultSwapConfig(p.id), timelineCoupled: false };
    const r = simulateTeamV2(appStore.state.slots, testEnv, CHAR_MAP, SC_WEPS, { fastMode: true, skipSoloBaseline: true });
    return { p, dps: r.teamActualDps, dpr: r.teamDpr, sec: r.cycleSec, exposed: r.qaSwap?.exposedSec || 0 };
  });

  const selectedBlk =
    appStore.state.timelineBlocks.find((b) => b.id === appStore.state.selectedBlockId) ||
    appStore.state.timelineBlocks[0] ||
    null;

  wrap.innerHTML = `
    <div class="swap-preset-grid">
      ${presetComparisons
        .map(
          ({ p, dps, dpr, sec, exposed }) => `
        <div class="swap-pcard ${!appStore.state.env.timelineCoupled && sc.preset === p.id ? "active" : ""}" data-swap-preset="${p.id}">
          <div class="row" style="justify-content:space-between;">
            <strong>${escHtml(p.name)}</strong>
            <span class="badge ${p.id === "sweaty" ? "b-warn" : "b-info"}">${escHtml(p.tag)}</span>
          </div>
          <div class="mono" style="font-size:13px;font-weight:800;margin:5px 0;color:var(--primary);">真实DPS: ${fmtNum(dps)} · 轴长 ${sec.toFixed(1)}s</div>
          <div class="muted" style="font-size:12px;">单轮DPR ${fmtWan(dpr)}${exposed > 0.5 ? ` · 裸露 ${exposed.toFixed(1)}s` : " · 无敌帧保护"}</div>
          <div class="muted" style="font-size:12px;margin-top:4px;line-height:1.45;">${escHtml(p.desc)}</div>
        </div>
      `
        )
        .join("")}
    </div>

    <details class="physics-drawer" id="physicsDrawerEl" ${physicsDrawerOpen ? "open" : ""}>
      <summary>
        <span>八维合轴底层物理参数精调矩阵</span>
        <span class="mono muted" style="font-size:12px;font-weight:600;">
          破韧期 <strong style="color:var(--foreground);">${qa.outStunSec.toFixed(1)}s</strong> + 失衡期 <strong style="color:var(--foreground);">${qa.inStunSec.toFixed(1)}s</strong> · 并行省帧 <strong style="color:var(--accent);">-${qa.savedOverlapSec.toFixed(1)}s</strong> = 实轴 <strong style="color:var(--primary);">${qa.cycleSec.toFixed(1)}s</strong>
        </span>
      </summary>
      <div class="physics-drawer-body">
        <div class="ws-grid-4">
          <label class="ws-field">
            <span>1. 脱手帧并行复用率: <strong class="mono">${Math.round(sc.commitOverlap * 100)}%</strong></span>
            <input type="range" min="0" max="100" step="2" value="${Math.round(sc.commitOverlap * 100)}" id="sc_overlap">
          </label>

          <label class="ws-field">
            <span>2. 合轴安全与闪避垫步策略</span>
            <select id="sc_safety">
              <option value="safe_only" ${sc.safetyPolicy === "safe_only" ? "selected" : ""}>仅无敌帧/快支保护帧安全合轴 (零战损)</option>
              <option value="dodge_cancel" ${sc.safetyPolicy === "dodge_cancel" ? "selected" : ""}>裸露招式垫步闪避取消离场 (0.18s损耗)</option>
              <option value="aggressive" ${sc.safetyPolicy === "aggressive" ? "selected" : ""}>激进零帧硬切同屏双打 (裸露 ${qa.exposedSec.toFixed(1)}s)</option>
            </select>
          </label>

          <label class="ws-field">
            <span>3. 持续引导技防断招保护</span>
            <select id="sc_prot_chan">
              <option value="1" ${sc.protectChanneled !== false ? "selected" : ""}>等待终结击出手再切 (派派/可琳/安东不丢伤)</option>
              <option value="0" ${sc.protectChanneled === false ? "selected" : ""}>强行提前硬切压轴 (引导角色截断丢尾段倍率)</option>
            </select>
          </label>

          <label class="ws-field">
            <span>4. 短轴拐爆发窗穿插续杯率: <strong class="mono">${Math.round((sc.buffWeave ?? 0.9) * 100)}%</strong></span>
            <input type="range" min="40" max="100" step="2" value="${Math.round((sc.buffWeave ?? 0.9) * 100)}" id="sc_weave">
            <small class="muted">妮可3.5s覆盖 ${(qa.nicoleCov * 100).toFixed(0)}% · 丽娜0影 ${(qa.rinaCovM0 * 100).toFixed(0)}%</small>
          </label>

          <label class="ws-field">
            <span>5. 失衡连携取消手法 (主C约 ${qa.chainCountCarry.toFixed(1)} 连)</span>
            <select id="sc_chain">
              <option value="auto" ${sc.chainTech === "auto" ? "selected" : ""}>按阵容智能择优</option>
              <option value="single_skip" ${sc.chainTech === "single_skip" ? "selected" : ""}>1连携极速取消 (省时打直伤)</option>
              <option value="triple_std" ${sc.chainTech === "triple_std" ? "selected" : ""}>常规顺序打满3连携 (新手默认)</option>
              <option value="double_carry" ${sc.chainTech === "double_carry" ? "selected" : ""}>手动取消重击 · 主C双连携 (主流进阶)</option>
              <option value="triple_carry" ${sc.chainTech === "triple_carry" ? "selected" : ""}>耀嘉音/琉音/诺姆 · 强转主C三~四连携</option>
            </select>
          </label>

          <label class="ws-field">
            <span>6. 黄光闪A振刀(双反)次数/轮: <strong class="mono">${sc.parryCount}</strong> 次</span>
            <input type="range" min="0" max="6" step="0.5" value="${sc.parryCount}" id="sc_parry">
            <small class="${qa.assistNet < -0.5 ? "txt-warn" : "muted"}">支援点: 回复+${qa.assistEarned.toFixed(1)} / 消耗-${qa.assistSpent.toFixed(1)} (${qa.assistNet >= 0 ? "循环充沛" : "透支警告"})</small>
          </label>

          <label class="ws-field">
            <span>7. 预输入/闪A取消后摇密度: <strong class="mono">${Math.round((sc.cancelDensity ?? 0.6) * 100)}%</strong></span>
            <input type="range" min="0" max="100" step="5" value="${Math.round((sc.cancelDensity ?? 0.6) * 100)}" id="sc_cancel">
            <small class="muted">快支 ${qa.totalQA.toFixed(1)}次/轮 · 静听嘉音 ${qa.astralStacks.toFixed(1)}层(+${(qa.astralDmg * 100).toFixed(1)}%)</small>
          </label>

          <label class="ws-field">
            <span>8. 双异常99%压条与喧响对轴</span>
            <div class="row" style="gap:6px;">
              <select id="sc_prestack" style="flex:1;">
                <option value="none" ${sc.anomPrestack === "none" ? "selected" : ""}>随缘挂异常</option>
                <option value="standard" ${sc.anomPrestack === "standard" ? "selected" : ""}>常规交替紊乱</option>
                <option value="prestack_99" ${sc.anomPrestack === "prestack_99" ? "selected" : ""}>99%压条瞬爆紊乱(+2s结算)</option>
              </select>
              <select id="sc_decibel" style="flex:1;">
                <option value="sequential" ${sc.decibelSync === "sequential" ? "selected" : ""}>大招随缘开</option>
                <option value="aligned" ${sc.decibelSync === "aligned" ? "selected" : ""}>对轴失衡大招</option>
                <option value="double_ult" ${sc.decibelSync === "double_ult" ? "selected" : ""}>喧响极限双大</option>
              </select>
            </div>
          </label>
        </div>

        ${
          active.length > 0
            ? `
          <div class="ws-grid-3" style="margin-top:12px;">
            ${active
              .map((m) => {
                const sp = getCharSwapProfile(m.ch);
                return `
                  <div class="char-swap-tag">
                    <div class="row" style="justify-content:space-between;">
                      <strong>${escHtml(m.ch.n)} · ${escHtml(ARCHETYPE_LABELS[sp.archetype] || sp.archetype)}</strong>
                      <button class="btn btn-xs" data-ws-edit-char-swap="${escHtml(m.ch.id)}">改帧数</button>
                    </div>
                    <div class="mono muted" style="font-size:12px;margin-top:2px;">可脱手 ${sp.commitSec}s · ${escHtml(SAFETY_LABELS[sp.safety] || sp.safety)} · 快支 ${sp.qaOut}/轮</div>
                    <div class="muted" style="font-size:12px;margin-top:2px;">${escHtml(sp.note || "")}</div>
                  </div>
                `;
              })
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    </details>

    <div class="gantt-panel" style="margin-top:12px;">
      <div class="gantt-toolbar">
        <div>
          <div style="font-weight:700;font-size:14px;">可视化多轨合轴排轴工作台 (Interactive Gantt Action Sequencer)</div>
          <div class="gantt-legend" style="margin-top:4px;">
            <span class="gantt-legend-item"><i class="gantt-swatch solid"></i><span>实心 = 前台操作帧</span></span>
            <span class="gantt-legend-item"><i class="gantt-swatch hatch"></i><span>斜纹 = 切人后后台脱手并行帧</span></span>
            <span class="gantt-legend-item"><i class="gantt-swatch danger"></i><span>红框 = 裸露合轴或早切截断</span></span>
            <span class="gantt-legend-item"><span class="muted">点击任一动作块可在下方精调帧数</span></span>
          </div>
        </div>
        <div class="row" style="gap:6px;">
          <label class="chk-pill">
            <input type="checkbox" id="tlAutoSnapChk" ${appStore.state.autoSnapTimeline ? "checked" : ""}> 调切人点自动顺延后续动作
          </label>
          <button class="btn ${appStore.state.env.timelineCoupled ? "btn-primary" : ""}" id="tlCoupleToggleBtn">
            ${appStore.state.env.timelineCoupled ? "[已开启] 实轴直接驱动主计算器" : "[点击开启] 用此实轴驱动主计算器"}
          </button>
          <button class="btn" id="tlRegenSmartBtn">按当前手法重排标准轴</button>
          <button class="btn" id="tlAddBlockBtn">+ 追加招式块</button>
        </div>
      </div>

      <div class="tl-metrics mono">
        <span class="tl-stat-chip">总动作块 <strong>${tl.blockCount}</strong></span>
        <span class="tl-stat-chip">顺序总耗时 <strong>${tl.seqCycleSec.toFixed(2)}s</strong></span>
        <span class="tl-stat-chip">合轴压缩后实轴 <strong>${tl.cycleSec.toFixed(2)}s</strong></span>
        <span class="tl-stat-chip">并行省帧 <strong style="color:var(--accent);">-${tl.savedSec.toFixed(2)}s (${(tl.overlapPct * 100).toFixed(1)}%)</strong></span>
        <span class="tl-stat-chip">安全合轴 <strong>${tl.safeSwaps}次</strong></span>
        <span class="tl-stat-chip ${tl.exposedSwaps > 0 ? "txt-warn" : ""}">裸露合轴 <strong>${tl.exposedSwaps}次 (${tl.exposedSec.toFixed(1)}s)</strong></span>
        ${tl.nicoleCov !== null ? `<span class="tl-stat-chip">妮可减防覆盖1号位 <strong>${(tl.nicoleCov * 100).toFixed(1)}%</strong></span>` : ""}
      </div>

      <div class="tl-svg-container" id="timelineSvgWrap">
        ${renderTimelineSVG(appStore.state.timelineBlocks, active, tl, selectedBlk?.id)}
      </div>

      ${selectedBlk ? renderSelectedBlockInspector(selectedBlk, active) : ""}
    </div>
  `;

  bindSection04Events(wrap, active);
}

function renderTimelineSVG(blocks: any[], activeMembers: any[], tl: any, selectedId?: string) {
  if (!blocks || blocks.length === 0 || activeMembers.length === 0) {
    return `<div class="muted" style="padding:22px;text-align:center;">暂无排轴动作块，请先上阵角色或点击「按当前手法重排标准轴」。</div>`;
  }

  const lang = appStore.state.lang || "zh";
  const tr = (s: string) => translateText(s, lang);

  const maxT = Math.max(12, Math.ceil((tl.cycleSec || 18) + 1.0));
  const leftPad = 152;
  const rightPad = 24;
  const targetWidth = 1320;
  const pxPerSec = Math.max(58, (targetWidth - leftPad - rightPad) / maxT);
  const width = Math.round(leftPad + maxT * pxPerSec + rightPad);

  const phaseY = 6;
  const phaseH = 20;
  const rulerY = 28;
  const topPad = 50;
  const trackH = 46;

  // Greedily pack buff windows into non-overlapping lanes
  const buffLanes: number[] = [];
  const placedBuffs = (tl.buffWindows || []).map((bw: any, idx: number) => {
    let lane = 0;
    while (lane < buffLanes.length && buffLanes[lane] > bw.start + 0.02) {
      lane++;
    }
    buffLanes[lane] = bw.end;
    return { ...bw, lane, idx };
  });

  const buffSectionPad = placedBuffs.length > 0 ? 10 : 0;
  const buffLaneH = 20;
  const buffTotalH = placedBuffs.length > 0 ? buffSectionPad + Math.max(1, buffLanes.length) * buffLaneH + 6 : 0;
  const height = topPad + activeMembers.length * trackH + buffTotalH + 10;

  const xOf = (sec: number) => leftPad + sec * pxPerSec;

  const stunStart = Math.max(0, Math.min(maxT, tl.stunStartSec ?? maxT * 0.5));
  const stunEnd = Math.max(stunStart, Math.min(maxT, tl.stunEndSec ?? maxT));
  const stunX = xOf(stunStart);
  const stunW = Math.max(0, xOf(stunEnd) - stunX);
  const preStunW = Math.max(0, stunX - leftPad);

  // ZZZ in-game track palette (Electric blue, Ether pink, Fire orange) on an ink-black lane
  const trackColors = ["#1f7ae0", "#e0306d", "#e06a00"];

  let defsSvg = `
    <pattern id="tlHatch0" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="#1f7ae0" fill-opacity="0.18" />
      <line x1="0" y1="0" x2="0" y2="8" stroke="#6bb4ff" stroke-opacity="0.55" stroke-width="2" />
    </pattern>
    <pattern id="tlHatch1" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="#e0306d" fill-opacity="0.18" />
      <line x1="0" y1="0" x2="0" y2="8" stroke="#ff7aa6" stroke-opacity="0.55" stroke-width="2" />
    </pattern>
    <pattern id="tlHatch2" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="#e06a00" fill-opacity="0.18" />
      <line x1="0" y1="0" x2="0" y2="8" stroke="#ffa64d" stroke-opacity="0.55" stroke-width="2" />
    </pattern>
    <pattern id="tlHatchDanger" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="#ff3e3e" fill-opacity="0.2" />
      <line x1="0" y1="0" x2="0" y2="8" stroke="#ff7b7b" stroke-opacity="0.7" stroke-width="2.2" />
    </pattern>
  `;

  // Phase header ribbon (strictly above ruler & tracks — never collides with bars)
  const phaseLabelTitle = lang === "en" ? "PHASE" : lang === "ja" ? "フェーズ" : "战斗阶段";
  const outStunTitle = tr("失衡外破韧期");
  const inStunTitle = tr("失衡爆发窗口");

  const phaseSvg = `
    <text x="12" y="${phaseY + 14}" fill="var(--muted-foreground)" font-size="11" font-weight="700">${escHtml(phaseLabelTitle)}</text>
    ${
      preStunW > 24
        ? `
      <rect x="${leftPad}" y="${phaseY}" width="${Math.max(0, preStunW - 2)}" height="${phaseH}" rx="4" fill="var(--secondary)" opacity="0.85" />
      <text x="${leftPad + 8}" y="${phaseY + 14}" fill="var(--muted-foreground)" font-size="11" font-weight="600">${escHtml(fitSvgLabel(`${outStunTitle} (0.0s – ${stunStart.toFixed(1)}s)`, preStunW - 6, 11))}</text>
    `
        : ""
    }
    ${
      stunW > 24
        ? `
      <rect x="${stunX}" y="${phaseY}" width="${stunW}" height="${phaseH}" rx="4" fill="#ffe01b" fill-opacity="0.14" stroke="#ffe01b" stroke-opacity="0.5" stroke-width="1" />
      <text x="${stunX + 8}" y="${phaseY + 14}" fill="var(--primary)" font-size="11" font-weight="700">${escHtml(fitSvgLabel(`${inStunTitle} (${stunStart.toFixed(1)}s – ${stunEnd.toFixed(1)}s)`, stunW - 6, 11))}</text>
    `
        : ""
    }
    ${
      stunW > 0
        ? `<rect x="${stunX}" y="${topPad - 2}" width="${stunW}" height="${activeMembers.length * trackH + 2}" fill="#ffe01b" fill-opacity="0.05" pointer-events="none" />`
        : ""
    }
  `;

  // Time Ruler & vertical gridlines
  const timeHeader = lang === "en" ? "TIME (s)" : lang === "ja" ? "時間 (秒)" : "时间轴 (秒)";
  let ticksSvg = `<text x="12" y="${rulerY + 14}" fill="var(--muted-foreground)" font-size="10.5" font-family="JetBrains Mono, monospace">${escHtml(timeHeader)}</text>`;
  for (let s = 0; s <= maxT; s++) {
    const x = xOf(s);
    const isMajor = s % 5 === 0;
    ticksSvg += `
      <line x1="${x}" y1="${rulerY + 18}" x2="${x}" y2="${height - 8}" stroke="var(--border)" stroke-opacity="${isMajor ? "0.85" : "0.45"}" stroke-dasharray="${isMajor ? "none" : "2,4"}" stroke-width="${isMajor ? "1.1" : "0.75"}" />
      <text x="${x}" y="${rulerY + 13}" text-anchor="middle" fill="${isMajor ? "var(--foreground)" : "var(--muted-foreground)"}" font-size="10.5" font-weight="${isMajor ? "700" : "500"}" font-family="JetBrains Mono, monospace">${s}s</text>
    `;
  }

  // Agent Tracks
  let tracksSvg = "";
  activeMembers.forEach((m, mIdx) => {
    const y = topPad + mIdx * trackH;
    const h = trackH - 4;
    const col = trackColors[mIdx % 3];
    const headerTitle = tr(`${m.slotIdx + 1}号 · ${m.ch.n}`);
    const roleSub = tr(`${m.ch.e} · ${m.ch.p} · M${m.m}`);

    tracksSvg += `
      <rect x="0" y="${y}" width="${width}" height="${h}" rx="6" fill="var(--card)" opacity="0.72" />
      <rect x="0" y="${y}" width="${leftPad - 8}" height="${h}" rx="6" fill="var(--card-elev)" stroke="var(--card-border)" stroke-width="1" />
      <rect x="0" y="${y + 5}" width="3" height="${h - 10}" rx="1.5" fill="${col}" />
      <text x="11" y="${y + 18}" fill="var(--foreground)" font-size="12" font-weight="700">${escHtml(fitSvgLabel(headerTitle, leftPad - 16, 12))}</text>
      <text x="11" y="${y + 33}" fill="var(--muted-foreground)" font-size="10.5" font-family="JetBrains Mono, monospace">${escHtml(fitSvgLabel(roleSub, leftPad - 16, 10.5))}</text>
    `;
  });

  // Precompute next solid block X on the SAME track so labels never collide
  const indexedBlocks = blocks.map((b, idx) => {
    const mIdx = activeMembers.findIndex((m) => m.ch.id === b.cid);
    const rowIdx = mIdx >= 0 ? mIdx : 0;
    return { b, idx, rowIdx, xStart: xOf(b.startSec) };
  });

  const nextSameRowX = new Map<number, number>();
  for (let r = 0; r < activeMembers.length; r++) {
    const rowItems = indexedBlocks
      .filter((it) => it.rowIdx === r)
      .sort((a, b) => a.xStart - b.xStart || a.idx - b.idx);
    for (let i = 0; i < rowItems.length; i++) {
      const nextX = i + 1 < rowItems.length ? rowItems[i + 1].xStart : width - rightPad;
      nextSameRowX.set(rowItems[i].idx, nextX);
    }
  }

  let tailsLayerSvg = "";
  let solidsLayerSvg = "";

  indexedBlocks.forEach(({ b, idx, rowIdx, xStart }) => {
    const y = topPad + rowIdx * trackH + 6;
    const h = trackH - 16; // 30px
    const wOn = Math.max(8, b.swapDur * pxPerSec);
    const linger = Math.max(0, b.totalDur - b.swapDur);
    const wLinger = Math.max(0, linger * pxPerSec);
    const isSel = b.id === selectedId;
    const baseCol = trackColors[rowIdx % 3];
    const isDanger = (b.safety === "unsafe_exposed" && linger > 0.1) || b._truncPct > 0.03;
    const tailStroke = isDanger ? "#ff3e3e" : baseCol;
    const hatchId = isDanger ? "tlHatchDanger" : `tlHatch${rowIdx % 3}`;

    const rawShort = String(b.label || "").replace(/^.+·/, "");
    const cleanText = tr(rawShort);
    const fullTip = tr(
      `${b.label} | ${b.startSec}s -> +${b.swapDur}s / ${b.totalDur}s | 脱手并行 ${linger.toFixed(2)}s${
        b._truncPct > 0.03 ? ` | 早切截断 -${(b._truncPct * 100).toFixed(0)}%` : ""
      }`
    );

    // 1. Off-field parallel tail rendered in bottom layer so later solid blocks sit cleanly on top
    if (wLinger > 2) {
      tailsLayerSvg += `
        <g data-tl-pick="${escHtml(b.id)}" style="cursor:pointer;">
          <rect
            x="${(xStart + wOn).toFixed(1)}"
            y="${y + 3}"
            width="${wLinger.toFixed(1)}"
            height="${h - 6}"
            rx="4"
            fill="url(#${hatchId})"
            stroke="${tailStroke}"
            stroke-opacity="0.68"
            stroke-dasharray="${isDanger ? "3,2" : "4,3"}"
            stroke-width="1.1"
          />
          <title>${escHtml(fullTip)}</title>
        </g>
      `;
    }

    // 2. Compute safe non-overlapping label budget
    const nextX = nextSameRowX.get(idx) ?? width - rightPad;
    const gapToNext = Math.max(0, nextX - xStart - 4);
    const extendIntoTail = wOn < 58 && wLinger > 14 && gapToNext > wOn + 12;
    const availLabelPx = extendIntoTail
      ? Math.min(wOn + wLinger - 4, gapToNext)
      : Math.min(wOn, gapToNext);
    const fitted = fitSvgLabel(cleanText, availLabelPx, 11);

    const clipId = `tlBlkClip_${idx}`;
    defsSvg += `<clipPath id="${clipId}"><rect x="${xStart.toFixed(1)}" y="${y}" width="${Math.max(0, availLabelPx).toFixed(1)}" height="${h}" rx="5" /></clipPath>`;

    const textBackdropW =
      extendIntoTail && fitted
        ? Math.min(availLabelPx - 2, estimateSvgTextPx(fitted, 11) + 12)
        : 0;

    solidsLayerSvg += `
      <g class="tl-blk-g" data-tl-pick="${escHtml(b.id)}" style="cursor:pointer;">
        <rect
          x="${xStart.toFixed(1)}"
          y="${y}"
          width="${wOn.toFixed(1)}"
          height="${h}"
          rx="5"
          fill="${baseCol}"
          stroke="${isSel ? "#ffe01b" : "rgba(255,255,255,0.18)"}"
          stroke-width="${isSel ? "1.8" : "0.8"}"
        />
        ${
          fitted
            ? `
          <g clip-path="url(#${clipId})" pointer-events="none">
            ${
              textBackdropW > wOn
                ? `<rect x="${(xStart + 2).toFixed(1)}" y="${y + 5}" width="${textBackdropW.toFixed(1)}" height="${h - 10}" rx="4" fill="#0b0b0b" fill-opacity="0.88" />`
                : ""
            }
            <text x="${(xStart + 6).toFixed(1)}" y="${y + 19}" fill="#f4f6f9" font-size="11" font-weight="600">${escHtml(fitted)}</text>
          </g>
        `
            : ""
        }
        <title>${escHtml(fullTip)}</title>
      </g>
    `;
  });

  // Buff Coverage Lanes
  let buffSvg = "";
  if (placedBuffs.length > 0) {
    const baseBy = topPad + activeMembers.length * trackH + buffSectionPad;
    const buffHeader = tr("短轴拐覆盖窗");
    buffSvg += `<text x="11" y="${baseBy + 13}" fill="var(--muted-foreground)" font-size="11" font-weight="700">${escHtml(fitSvgLabel(buffHeader, leftPad - 16, 11))}</text>`;

    placedBuffs.forEach((bw: any) => {
      const bx = xOf(bw.start);
      const bwPx = Math.max(12, (Math.min(maxT, bw.end) - bw.start) * pxPerSec);
      const ly = baseBy + bw.lane * buffLaneH;
      const bClip = `tlBuffClip_${bw.idx}`;
      const bLabel = tr(String(bw.label || ""));
      const bFit = fitSvgLabel(bLabel, bwPx, 10);
      defsSvg += `<clipPath id="${bClip}"><rect x="${bx.toFixed(1)}" y="${ly}" width="${bwPx.toFixed(1)}" height="16" rx="4" /></clipPath>`;

      buffSvg += `
        <g>
          <rect x="${bx.toFixed(1)}" y="${ly}" width="${bwPx.toFixed(1)}" height="16" rx="4" fill="#5c8c00" fill-opacity="0.92" />
          ${
            bFit
              ? `<text x="${(bx + 5).toFixed(1)}" y="${ly + 11.5}" fill="#f4f6f9" font-size="10" font-weight="600" clip-path="url(#${bClip})" pointer-events="none">${escHtml(bFit)}</text>`
              : ""
          }
          <title>${escHtml(`${bLabel} (${bw.start.toFixed(1)}s – ${bw.end.toFixed(1)}s)`)}</title>
        </g>
      `;
    });
  }

  return `
    <svg data-no-i18n="1" viewBox="0 0 ${width} ${height}" width="100%" style="display:block;width:100%;height:auto;min-width:920px;">
      <defs>${defsSvg}</defs>
      ${phaseSvg}
      ${ticksSvg}
      ${tracksSvg}
      <g class="tl-tails-layer">${tailsLayerSvg}</g>
      <g class="tl-solids-layer">${solidsLayerSvg}</g>
      ${buffSvg}
    </svg>
  `;
}

function renderSelectedBlockInspector(blk: any, activeMembers: any[]) {
  const m = activeMembers.find((x) => x.ch.id === blk.cid) || activeMembers[0];
  const movePool = m ? getMovePoolForChar(m.ch) : [];
  const cats = [
    ["basic", "普攻/蓄力"],
    ["dash", "闪反/振刀"],
    ["ex", "强化特殊技"],
    ["chain", "连携技"],
    ["ult", "终结技"],
    ["qa", "快速支援"]
  ];

  return `
    <div class="tl-inspector">
      <div class="row" style="justify-content:space-between;margin-bottom:8px;">
        <div class="row" style="gap:8px;">
          <strong>选中动作块精调：${escHtml(blk.label)}</strong>
          ${
            blk._truncPct > 0.03
              ? `<span class="badge b-warn">当前切人点早于收尾帧(${blk.minSwap}s)，截断丢伤 ${(blk._truncPct * 100).toFixed(0)}%</span>`
              : `<span class="badge b-ok">完整保留脱手判定 (后台并行 ${(blk.totalDur - blk.swapDur).toFixed(2)}s)</span>`
          }
        </div>
        <div class="row" style="gap:6px;">
          <button class="btn btn-xs" id="tlMoveLeftBtn">前移顺序</button>
          <button class="btn btn-xs" id="tlMoveRightBtn">后移顺序</button>
          <button class="btn btn-xs" id="tlDupBlockBtn">复制此块</button>
          <button class="btn btn-xs btn-danger" id="tlDelBlockBtn">删除此块</button>
        </div>
      </div>

      <div class="ws-grid-6">
        <label class="ws-field"><span>执行角色</span>
          <select id="tl_blk_cid">
            ${activeMembers.map((am) => `<option value="${escHtml(am.ch.id)}" ${am.ch.id === blk.cid ? "selected" : ""}>${am.slotIdx + 1}号 · ${escHtml(am.ch.n)}</option>`).join("")}
          </select>
        </label>
        <label class="ws-field"><span>套用招式预设模板</span>
          <select id="tl_blk_tpl">
            <option value="">-- 保持当前招式自定义 --</option>
            ${movePool.map((mv: any) => `<option value="${escHtml(mv.key)}">${escHtml(mv.label)} (${mv.totalDur}s)</option>`).join("")}
          </select>
        </label>
        <label class="ws-field"><span>招式显示名称</span><input type="text" id="tl_blk_label" value="${escHtml(blk.label)}"></label>
        <label class="ws-field"><span>伤害归属分类</span>
          <select id="tl_blk_cat">${cats.map(([k, v]) => `<option value="${k}" ${blk.cat === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        </label>
        <label class="ws-field"><span>所处失衡阶段</span>
          <select id="tl_blk_phase">
            <option value="out" ${blk.phase !== "stun" ? "selected" : ""}>失衡外破韧期</option>
            <option value="stun" ${blk.phase === "stun" ? "selected" : ""}>失衡爆发期内</option>
          </select>
        </label>
        <label class="ws-field"><span>脱手安全等级</span>
          <select id="tl_blk_safety">
            ${Object.entries(SAFETY_LABELS).map(([k, v]) => `<option value="${k}" ${blk.safety === k ? "selected" : ""}>${v as string}</option>`).join("")}
          </select>
        </label>
        <label class="ws-field"><span>起始时间 start(秒)</span><input type="number" step="0.1" min="0" id="tl_blk_start" value="${blk.startSec}"></label>
        <label class="ws-field"><span>招式总动画长(秒)</span><input type="number" step="0.05" min="0.2" id="tl_blk_tot" value="${blk.totalDur}"></label>
        <label class="ws-field"><span>最早无损切人帧(秒)</span><input type="number" step="0.05" min="0.15" id="tl_blk_min" value="${blk.minSwap}"></label>
        <label class="ws-field" style="grid-column:span 2;">
          <span>实际切人合轴点 swapDur: <strong class="mono">${blk.swapDur}s</strong> (越小越早切人合轴)</span>
          <input type="range" min="0.20" max="${blk.totalDur}" step="0.05" value="${blk.swapDur}" id="tl_blk_swap">
        </label>
        <label class="ws-field"><span>动作倍率权重 MV</span><input type="number" step="50" min="50" id="tl_blk_mv" value="${blk.mv}"></label>
      </div>
    </div>
  `;
}

function bindSection04Events(wrap: HTMLElement, active: any[]) {
  const drawerEl = document.getElementById("physicsDrawerEl") as HTMLDetailsElement | null;
  drawerEl?.addEventListener("toggle", () => {
    physicsDrawerOpen = !!drawerEl.open;
  });

  wrap.querySelectorAll<any>("[data-swap-preset]").forEach((card) => {
    card.addEventListener("click", () => {
      const pid = card.dataset.swapPreset;
      appStore.state.env.swapMode = pid;
      appStore.state.env.swapConfig = makeDefaultSwapConfig(pid);
      appStore.state.env.timelineCoupled = false;
      ensureTimelineInitialized(true);
      refreshAllUI();
    });
  });

  const updateSC = mutator => {
    appStore.state.env.swapConfig.preset = "custom";
    mutator(appStore.state.env.swapConfig);
    if (!appStore.state.env.timelineCoupled) ensureTimelineInitialized(true);
    refreshAllUI();
  };

  document.getElementById("sc_overlap")?.addEventListener("change", (e: any) => updateSC(sc => { sc.commitOverlap = Number(e.target.value) / 100.0; }));
  document.getElementById("sc_safety")?.addEventListener("change", (e: any) => updateSC(sc => { sc.safetyPolicy = e.target.value; }));
  document.getElementById("sc_prot_chan")?.addEventListener("change", (e: any) => updateSC(sc => { sc.protectChanneled = e.target.value === "1"; }));
  document.getElementById("sc_weave")?.addEventListener("change", (e: any) => updateSC(sc => { sc.buffWeave = Number(e.target.value) / 100.0; }));
  document.getElementById("sc_chain")?.addEventListener("change", (e: any) => updateSC(sc => { sc.chainTech = e.target.value; }));
  document.getElementById("sc_parry")?.addEventListener("change", (e: any) => updateSC(sc => { sc.parryCount = Number(e.target.value); }));
  document.getElementById("sc_cancel")?.addEventListener("change", (e: any) => updateSC(sc => { sc.cancelDensity = Number(e.target.value) / 100.0; }));
  document.getElementById("sc_prestack")?.addEventListener("change", (e: any) => updateSC(sc => { sc.anomPrestack = e.target.value; }));
  document.getElementById("sc_decibel")?.addEventListener("change", (e: any) => updateSC(sc => { sc.decibelSync = e.target.value; }));

  wrap.querySelectorAll<any>("[data-ws-edit-char-swap]").forEach(btn => {
    btn.addEventListener("click", () => openCustomWorkshop("chars", btn.dataset.wsEditCharSwap));
  });

  document.getElementById("tlAutoSnapChk")?.addEventListener("change", (e: any) => {
    appStore.state.autoSnapTimeline = e.target.checked;
    if (appStore.state.autoSnapTimeline) snapTimelineSequential(appStore.state.timelineBlocks);
    refreshAllUI();
  });

  document.getElementById("tlCoupleToggleBtn")?.addEventListener("click", () => {
    appStore.state.env.timelineCoupled = !appStore.state.env.timelineCoupled;
    refreshAllUI();
  });

  document.getElementById("tlRegenSmartBtn")?.addEventListener("click", () => {
    ensureTimelineInitialized(true);
    refreshAllUI();
  });

  document.getElementById("tlAddBlockBtn")?.addEventListener("click", () => {
    if (active.length === 0) return;
    const m0 = active[0];
    const mv = getMovePoolForChar(m0.ch)[0];
    const last = appStore.state.timelineBlocks[appStore.state.timelineBlocks.length - 1];
    const start = last ? Number((last.startSec + last.swapDur).toFixed(2)) : 0;
    const nb = {
      id: "blk_" + Date.now().toString(36).slice(-5),
      slotIdx: m0.slotIdx,
      memberIdx: 0,
      cid: m0.ch.id,
      charName: m0.ch.n,
      label: mv.label,
      cat: mv.cat,
      phase: "stun",
      startSec: start,
      totalDur: mv.totalDur,
      minSwap: mv.minSwap,
      swapDur: calcSwapSecForMove(mv, appStore.state.env.swapConfig),
      mv: mv.mv,
      daze: mv.daze,
      anom: mv.anom,
      safety: mv.safety,
      buffTag: mv.buffTag ? { ...mv.buffTag } : null
    };
    appStore.state.timelineBlocks.push(nb);
    appStore.state.selectedBlockId = nb.id;
    refreshAllUI();
  });

  wrap.querySelectorAll<any>("[data-tl-pick]").forEach(gEl => {
    gEl.addEventListener("click", () => {
      appStore.state.selectedBlockId = gEl.dataset.tlPick;
      refreshAllUI();
    });
  });

  const blkIdx = appStore.state.timelineBlocks.findIndex(b => b.id === appStore.state.selectedBlockId);
  const blk = blkIdx >= 0 ? appStore.state.timelineBlocks[blkIdx] : appStore.state.timelineBlocks[0];
  if (!blk) return;

  const commitBlkEdit = () => {
    if (appStore.state.autoSnapTimeline) snapTimelineSequential(appStore.state.timelineBlocks);
    refreshAllUI();
  };

  document.getElementById("tlMoveLeftBtn")?.addEventListener("click", () => {
    const idx = appStore.state.timelineBlocks.indexOf(blk);
    if (idx > 0) {
      [appStore.state.timelineBlocks[idx - 1], appStore.state.timelineBlocks[idx]] = [appStore.state.timelineBlocks[idx], appStore.state.timelineBlocks[idx - 1]];
      snapTimelineSequential(appStore.state.timelineBlocks);
      refreshAllUI();
    }
  });
  document.getElementById("tlMoveRightBtn")?.addEventListener("click", () => {
    const idx = appStore.state.timelineBlocks.indexOf(blk);
    if (idx >= 0 && idx < appStore.state.timelineBlocks.length - 1) {
      [appStore.state.timelineBlocks[idx + 1], appStore.state.timelineBlocks[idx]] = [appStore.state.timelineBlocks[idx], appStore.state.timelineBlocks[idx + 1]];
      snapTimelineSequential(appStore.state.timelineBlocks);
      refreshAllUI();
    }
  });
  document.getElementById("tlDupBlockBtn")?.addEventListener("click", () => {
    const idx = appStore.state.timelineBlocks.indexOf(blk);
    const copy = { ...deepClone(blk), id: "blk_" + Date.now().toString(36).slice(-5) };
    appStore.state.timelineBlocks.splice(idx + 1, 0, copy);
    appStore.state.selectedBlockId = copy.id;
    if (appStore.state.autoSnapTimeline) snapTimelineSequential(appStore.state.timelineBlocks);
    refreshAllUI();
  });
  document.getElementById("tlDelBlockBtn")?.addEventListener("click", () => {
    if (appStore.state.timelineBlocks.length <= 1) return;
    appStore.state.timelineBlocks = appStore.state.timelineBlocks.filter(x => x.id !== blk.id);
    appStore.state.selectedBlockId = appStore.state.timelineBlocks[0]?.id || null;
    if (appStore.state.autoSnapTimeline) snapTimelineSequential(appStore.state.timelineBlocks);
    refreshAllUI();
  });

  document.getElementById("tl_blk_cid")?.addEventListener("change", (e: any) => {
    const nc = CHAR_MAP[e.target.value];
    if (!nc) return;
    blk.cid = nc.id;
    blk.charName = nc.n;
    const mv = getMovePoolForChar(nc)[0];
    blk.label = mv.label; blk.cat = mv.cat; blk.totalDur = mv.totalDur; blk.minSwap = mv.minSwap;
    blk.swapDur = calcSwapSecForMove(mv, appStore.state.env.swapConfig); blk.mv = mv.mv; blk.safety = mv.safety;
    blk.buffTag = mv.buffTag ? { ...mv.buffTag } : null;
    commitBlkEdit();
  });
  document.getElementById("tl_blk_tpl")?.addEventListener("change", (e: any) => {
    const nc = CHAR_MAP[blk.cid];
    const mv = nc ? getMovePoolForChar(nc).find(x => x.key === e.target.value) : null;
    if (!mv) return;
    blk.label = mv.label; blk.cat = mv.cat; blk.totalDur = mv.totalDur; blk.minSwap = mv.minSwap;
    blk.swapDur = calcSwapSecForMove(mv, appStore.state.env.swapConfig); blk.mv = mv.mv; blk.safety = mv.safety;
    blk.buffTag = mv.buffTag ? { ...mv.buffTag } : null;
    commitBlkEdit();
  });
  document.getElementById("tl_blk_label")?.addEventListener("change", (e: any) => { blk.label = e.target.value; refreshAllUI(); });
  document.getElementById("tl_blk_cat")?.addEventListener("change", (e: any) => { blk.cat = e.target.value; refreshAllUI(); });
  document.getElementById("tl_blk_phase")?.addEventListener("change", (e: any) => { blk.phase = e.target.value; refreshAllUI(); });
  document.getElementById("tl_blk_safety")?.addEventListener("change", (e: any) => { blk.safety = e.target.value; refreshAllUI(); });
  document.getElementById("tl_blk_start")?.addEventListener("change", (e: any) => {
    appStore.state.autoSnapTimeline = false;
    blk.startSec = Math.max(0, parseFloat(e.target.value) || 0);
    refreshAllUI();
  });
  document.getElementById("tl_blk_tot")?.addEventListener("change", (e: any) => {
    blk.totalDur = Math.max(0.2, parseFloat(e.target.value) || 1.0);
    if (blk.swapDur > blk.totalDur) blk.swapDur = blk.totalDur;
    commitBlkEdit();
  });
  document.getElementById("tl_blk_min")?.addEventListener("change", (e: any) => { blk.minSwap = Math.max(0.15, parseFloat(e.target.value) || 0.5); refreshAllUI(); });
  document.getElementById("tl_blk_swap")?.addEventListener("change", (e: any) => { blk.swapDur = Math.max(0.15, parseFloat(e.target.value) || 0.5); commitBlkEdit(); });
  document.getElementById("tl_blk_mv")?.addEventListener("change", (e: any) => { blk.mv = Math.max(20, parseFloat(e.target.value) || 1000); refreshAllUI(); });
}

// ============================================================================
// Section 05: 4-in-1 Evaluation Center (Weapons, Mindscapes, +1 Gold ROI, Discs)
// ============================================================================
function renderSection05EvalCenter(sim) {
  const wrap = document.getElementById("sec05Body");
  if (!wrap) return;
  if (sim.activeCount === 0) {
    wrap.innerHTML = `<div class="muted">请先上阵角色后查看音擎/影画/金数ROI/套装排行。</div>`;
    return;
  }

  if (!appStore.state.slots[appStore.state.evalSlotIdx]?.cid) {
    appStore.state.evalSlotIdx = sim.slotResults[0].slotIdx;
  }
  const tSlot = appStore.state.evalSlotIdx;
  const ch = CHAR_MAP[appStore.state.slots[tSlot].cid];

  const evalTabs = [
    { id: "weapons", label: "音擎伤害与全队拐力天梯" },
    { id: "mindscapes", label: "影画 M0~M6 逐级提升曲线" },
    { id: "roi", label: "下一金抽取性价比 ROI 排行" },
    { id: "discs", label: "驱动盘4件套横评排行" }
  ];

  let tableHtml = "";
  if (appStore.state.evalTab === "weapons") {
    const list = rankWeaponsForSlot(appStore.state.slots, tSlot, appStore.state.env, CHAR_MAP, SC_WEPS, appStore.state.evalARef);
    const maxVal = Math.max(1, list[0]?.teamDps || 1);
    tableHtml = `
      <div class="row" style="justify-content:space-between;margin-bottom:8px;">
        <span class="muted" style="font-size:12px;">以【${escHtml(ch.n)}】专属音擎 R1 为 100% 基准，同时评估个人伤害与全队总指标贡献：</span>
        <div class="row" style="gap:8px;">
          <label style="font-size:12px;">A级音擎默认精炼:
            <select id="evalARefSel" style="width:90px;"><option value="5" ${appStore.state.evalARef === 5 ? "selected" : ""}>满精 R5</option><option value="1" ${appStore.state.evalARef === 1 ? "selected" : ""}>精1 R1</option></select>
          </label>
          <button class="btn btn-xs" id="evalNewWepBtn">+ 工坊新建自定义音擎</button>
        </div>
      </div>
      <div class="rank-list">
        ${list.map((it, idx) => (evalWepShowAll || idx < EVAL_WEP_TOP_N || it.isCur) ? `
          <div class="rank-row has-thumb ${it.isCur ? "cur" : ""}">
            <div class="rank-idx">#${idx + 1}</div>
            ${renderWeaponThumb(it.wid, it.w.n, it.w.r, "wep-md")}
            <div class="rank-info">
              <div class="row" style="gap:6px;">
                <strong>[${it.w.r}·R${it.ref}] ${escHtml(it.w.n)}</strong>
                ${it.isSig ? `<span class="badge b-info">专属音擎</span>` : ""}
                ${it.isFree ? `<span class="badge b-ok">平民0限定金</span>` : ""}
                ${it.isCur ? `<span class="badge b-warn">当前装备</span>` : ""}
                <span class="muted" style="font-size:11px;">${escHtml(it.statTxt)}</span>
              </div>
              <div class="rank-bar-bg"><div class="rank-bar-fill" style="width:${Math.min(100, (it.teamDps / maxVal) * 100).toFixed(1)}%;"></div></div>
            </div>
            <div class="rank-nums mono">
              <div>全队: <strong>${fmtNum(it.teamDps)}</strong> (${(it.teamPct * 100).toFixed(1)}%)</div>
              <div class="muted" style="font-size:11px;">个人: ${fmtNum(it.selfDmg)} (${(it.selfPct * 100).toFixed(1)}%)</div>
            </div>
            <div><button type="button" class="btn btn-xs" data-equip-wep="${escHtml(it.wid)}:${it.ref}">换装</button></div>
          </div>
        ` : "").join("")}
      </div>
      ${list.length > EVAL_WEP_TOP_N ? `
        <button type="button" class="btn btn-ghost rank-more-btn" id="evalWepMoreBtn">
          ${evalWepShowAll ? "收起，仅看前 8 名 ▲" : `展开全部 ${list.length} 把音擎 ▼`}
        </button>
      ` : ""}
    `;
  } else if (appStore.state.evalTab === "mindscapes") {
    const ladder = computeMindscapeLadder(appStore.state.slots, tSlot, appStore.state.env, CHAR_MAP, SC_WEPS);
    const maxVal = Math.max(1, ladder[ladder.length - 1]?.teamDps || 1);
    tableHtml = `
      <div class="rank-list">
        ${ladder.map(row => `
          <div class="rank-row ${row.isCur ? "cur" : ""}">
            <div class="rank-idx"><strong data-no-i18n>M${row.m}</strong></div>
            <div class="rank-info">
              <div class="row" style="gap:6px;">
                <span>${escHtml(row.desc)}</span>
                ${row.isKeySpike ? `<span class="badge b-info">核心质变星魂</span>` : ""}
                ${row.isCur ? `<span class="badge b-warn">当前所处</span>` : ""}
              </div>
              <div class="rank-bar-bg"><div class="rank-bar-fill" style="width:${Math.min(100, (row.teamDps / maxVal) * 100).toFixed(1)}%;"></div></div>
            </div>
            <div class="rank-nums mono">
              <div>全队较M0: <strong>+${(row.teamGain * 100).toFixed(1)}%</strong> (本级 +${(row.stepGain * 100).toFixed(1)}%)</div>
              <div class="muted" style="font-size:11px;">个人较M0: +${(row.selfGain * 100).toFixed(1)}% · ${fmtNum(row.teamDps)}</div>
            </div>
            <div><button type="button" class="btn btn-xs" data-apply-m="${row.m}">切至M${row.m}</button></div>
          </div>
        `).join("")}
      </div>
    `;
  } else if (appStore.state.evalTab === "roi") {
    const roi = computeNextGoldROI(appStore.state.slots, appStore.state.env, CHAR_MAP, SC_WEPS, appStore.state.evalIncludeRef);
    tableHtml = `
      <div class="row" style="justify-content:space-between;margin-bottom:8px;">
        <span class="muted" style="font-size:12px;">基于当前队伍配置，测算下一步补哪把专武或哪颗影画对全队实轴输出提升最大：</span>
        <label class="chk-pill"><input type="checkbox" id="evalIncRefChk" ${appStore.state.evalIncludeRef ? "checked" : ""}> 纳入S级音擎继续叠精炼(R1->R5)对比</label>
      </div>
      <div class="rank-list">
        ${roi.cands.map((c, idx) => {
          const roiCid = appStore.state.slots[c.apply?.idx]?.cid;
          const roiCh = roiCid ? CHAR_MAP[roiCid] : null;
          const patchWid = c.apply?.patch?.wid;
          const patchW = patchWid ? SC_WEPS[patchWid] : null;
          const thumbHtml = patchW
            ? renderWeaponThumb(patchWid, patchW.n, patchW.r, "wep-md")
            : roiCh
            ? renderAgentAvatar(roiCh.id, roiCh.n, roiCh.eb, "av-md")
            : "";
          return `
          <div class="rank-row ${thumbHtml ? "has-thumb" : ""}" data-roi-idx="${idx}">
            <div class="rank-idx">#${idx + 1}</div>
            ${thumbHtml}
            <div class="rank-info">
              <div class="row" style="gap:6px;">
                <span class="badge ${c.isZeroGold ? "b-ok" : "b-info"}">${escHtml(c.badge)}</span>
                <strong>${c.slot}号位【${escHtml(c.who)}】${escHtml(c.action)}</strong>
              </div>
              <div class="muted" style="font-size:11px;margin-top:2px;">${escHtml(c.desc)}</div>
            </div>
            <div class="rank-nums mono">
              <strong style="color:var(--primary);font-size:14px;">全队 +${(c.gain * 100).toFixed(2)}%</strong>
            </div>
            <div><button type="button" class="btn btn-xs btn-primary" data-apply-roi="${idx}">一键应用</button></div>
          </div>
        `;
        }).join("")}
      </div>
    `;
    (wrap as any)._roiCands = roi.cands;
  } else {
    const dList = rankDiscSetsForSlot(appStore.state.slots, tSlot, appStore.state.env, CHAR_MAP, SC_WEPS);
    const maxVal = Math.max(1, dList[0]?.teamDps || 1);
    tableHtml = `
      <div class="rank-list">
        ${dList.map((d, idx) => `
          <div class="rank-row has-thumb ${appStore.state.slots[tSlot].fourPc === d.fourPc ? "cur" : ""}">
            <div class="rank-idx">#${idx + 1}</div>
            ${renderDiscVinyl(d.fourPc, d.name, "disc-md")}
            <div class="rank-info">
              <div class="row" style="gap:6px;">
                <strong>【${escHtml(d.name)}】4件套</strong>
                ${appStore.state.slots[tSlot].fourPc === d.fourPc ? `<span class="badge b-warn">当前穿戴</span>` : ""}
              </div>
              <div class="muted" style="font-size:11px;">${escHtml(d.d4Desc || "")}</div>
              <div class="rank-bar-bg"><div class="rank-bar-fill" style="width:${Math.min(100, (d.teamDps / maxVal) * 100).toFixed(1)}%;"></div></div>
            </div>
            <div class="rank-nums mono">
              <div>全队: <strong>${fmtNum(d.teamDps)}</strong> (${((d.teamDps / maxVal) * 100).toFixed(1)}%)</div>
              <div class="muted" style="font-size:11px;">个人: ${fmtNum(d.selfDmg)}</div>
            </div>
            <div><button type="button" class="btn btn-xs" data-equip-fourpc="${escHtml(d.fourPc)}">换此套装</button></div>
          </div>
        `).join("")}
      </div>
    `;
  }

  wrap.innerHTML = `
    <div class="row" style="justify-content:space-between;margin-bottom:10px;gap:8px;">
      <div class="pill-bar">
        <span style="font-size:12px;font-weight:700;margin-right:4px;">评测目标槽位:</span>
        ${sim.slotResults.map(r => `<button type="button" class="pill pill-with-av ${tSlot === r.slotIdx ? "active" : ""}" data-eval-slot="${r.slotIdx}">${renderAgentAvatar(r.ch.id, r.ch.n, r.ch.eb, "av-2xs")}<span>${r.slotIdx + 1}号位 · ${escHtml(r.ch.n)}</span></button>`).join("")}
      </div>
      <div class="ws-tabs" style="margin:0;">
        ${evalTabs.map(t => `<button type="button" class="tab-btn ${appStore.state.evalTab === t.id ? "active" : ""}" data-eval-tab="${t.id}">${escHtml(t.label)}</button>`).join("")}
      </div>
    </div>
    ${tableHtml}
  `;

  wrap.querySelectorAll<any>("[data-eval-slot]").forEach(b => b.addEventListener("click", () => { appStore.state.evalSlotIdx = Number(b.dataset.evalSlot); renderSection05EvalCenter(sim); }));
  wrap.querySelectorAll<any>("[data-eval-tab]").forEach(b => b.addEventListener("click", () => { appStore.state.evalTab = b.dataset.evalTab; renderSection05EvalCenter(sim); }));
  document.getElementById("evalARefSel")?.addEventListener("change", (e: any) => { appStore.state.evalARef = Number(e.target.value); renderSection05EvalCenter(sim); });
  document.getElementById("evalNewWepBtn")?.addEventListener("click", () => openCustomWorkshop("weps"));
  document.getElementById("evalIncRefChk")?.addEventListener("change", (e: any) => { appStore.state.evalIncludeRef = e.target.checked; renderSection05EvalCenter(sim); });
  wrap.querySelector("#evalWepMoreBtn")?.addEventListener("click", () => {
    evalWepShowAll = !evalWepShowAll;
    renderSection05EvalCenter(sim);
    localizeDOM(wrap, appStore.state.lang || "zh");
  });

  wrap.querySelectorAll<any>("[data-equip-wep]").forEach(btn => {
    btn.addEventListener("click", () => {
      const [wid, rStr] = btn.dataset.equipWep.split(":");
      appStore.state.slots[tSlot].wid = wid;
      appStore.state.slots[tSlot].ref = Number(rStr);
      refreshAllUI();
    });
  });
  wrap.querySelectorAll<any>("[data-apply-m]").forEach(btn => {
    btn.addEventListener("click", () => { appStore.state.slots[tSlot].m = Number(btn.dataset.applyM); refreshAllUI(); });
  });
  wrap.querySelectorAll<any>("[data-apply-roi]").forEach(btn => {
    btn.addEventListener("click", () => {
      const cand = (wrap as any)._roiCands?.[Number(btn.dataset.applyRoi)];
      if (!cand) return;
      Object.assign(appStore.state.slots[cand.apply.idx], cand.apply.patch);
      refreshAllUI();
    });
  });
  wrap.querySelectorAll<any>("[data-equip-fourpc]").forEach(btn => {
    btn.addEventListener("click", () => {
      appStore.state.slots[tSlot].fourPc = btn.dataset.equipFourpc;
      if (appStore.state.slots[tSlot].buildMode === "pieces") appStore.state.slots[tSlot].buildMode = "auto";
      refreshAllUI();
    });
  });
}

// ============================================================================
// Section 06: Stage Buffs & 7-Element Independent Enemy Environment
// ============================================================================
function renderSection06Environment() {
  const wrap = document.getElementById("sec06Body");
  if (!wrap) return;
  const env = appStore.state.env;
  const resMap = env.elemResMap || makeDefaultElemResMap();

  wrap.innerHTML = `
    <div class="row" style="justify-content:space-between;gap:10px;margin-bottom:10px;">
      <div class="row" style="gap:8px;flex:1;">
        <span style="font-size:12px;font-weight:700;">式舆/危局场地Buff:</span>
        <select id="envStageSelect" style="flex:1;max-width:520px;">
          ${Object.values(STAGE_BUFFS).map(s => `<option value="${escHtml(s.id)}" ${env.stageId === s.id ? "selected" : ""}>${escHtml(s.name)}</option>`).join("")}
        </select>
        <button class="btn" id="envCustomStageBtn">工坊编辑/新建天气词条</button>
      </div>
      <div class="row" style="gap:6px;">
        <button class="btn btn-xs" id="envWeakCarryBtn">设1号位弱点(-20%抗)</button>
        <button class="btn btn-xs" id="envNeutralAllBtn">全属性0%无抗</button>
        <button class="btn btn-xs" id="envResistCarryBtn">设1号位逆抗(+20%抗)</button>
      </div>
    </div>

    <div class="subbox" style="margin-bottom:10px;">
      <div style="font-size:12px;font-weight:700;margin-bottom:6px;">首领七属性独立抗性矩阵 (双属性紊乱队或跨属性副C按各自属性独立结算抗性区)：</div>
      <div class="ws-grid-7">
        ${ALL_ELEMENTS.map(el => {
          const pct = Math.round((resMap[el.eb] ?? 0) * 100);
          return `
            <label class="ws-field">
              <span><i class="elem-dot elem-${el.eb}"></i> ${el.zh}抗性%</span>
              <input type="number" step="10" min="-60" max="80" value="${pct}" data-elem-res="${el.eb}">
            </label>
          `;
        }).join("")}
      </div>
    </div>

    <div class="ws-grid-6">
      <label class="ws-field"><span>怪物基础防御(Lv.70=953)</span><input type="number" step="10" min="50" max="4000" value="${env.enemyDef}" id="env_def"></label>
      <label class="ws-field"><span>基础失衡易伤倍率%</span><input type="number" step="10" min="100" max="300" value="${Math.round(env.stunMultBase * 100)}" id="env_stun_mult"></label>
      <label class="ws-field"><span>首领失衡条上限(破韧难度)</span><input type="number" step="200" min="1500" max="10000" value="${env.dazeThreshold}" id="env_daze_th"></label>
      <label class="ws-field"><span>首领基础失衡持续秒数</span><input type="number" step="0.5" min="5" max="25" value="${env.stunDurationBase}" id="env_stun_dur"></label>
      <label class="ws-field"><span>异常积蓄抗性倍率(1.0标准)</span><input type="number" step="0.1" min="0.5" max="2.5" value="${env.anomThresholdScale}" id="env_anom_th"></label>
      <label class="ws-field"><span>紊乱引爆基准剩余秒数(0~10)</span><input type="number" step="0.5" min="0" max="10" value="${env.disorderSec}" id="env_dis_sec"></label>
      <label class="ws-field"><span>秽盾减伤折算系数(100%=无盾)</span><input type="number" step="5" min="20" max="100" value="${Math.round((env.miasmaFactor ?? 1) * 100)}" id="env_miasma"></label>
      <label class="ws-field"><span>全局默认毕业词条数</span><input type="number" step="1" min="10" max="42" value="${env.rollBudget}" id="env_rolls"></label>
      <label class="ws-field"><span>失衡占比推演模式</span>
        <select id="env_stun_mode">
          <option value="physics" ${env.stunPhysicsMode === "physics" ? "selected" : ""}>按合轴与破韧物理推演</option>
          <option value="profile" ${env.stunPhysicsMode !== "physics" ? "selected" : ""}>按角色固定经验占比</option>
        </select>
      </label>
      <label class="ws-field"><span>首领高攻击欲(检验危险合轴)</span>
        <select id="env_aggro">
          <option value="0" ${!env.highAggro ? "selected" : ""}>常规深渊环境</option>
          <option value="1" ${env.highAggro ? "selected" : ""}>高压疯狗红光环境</option>
        </select>
      </label>
      <label class="ws-field"><span>老角色潜能觉醒(Lv.6)</span>
        <select id="env_pot">
          <option value="1" ${env.potAwakening !== false ? "selected" : ""}>默认开启潜能强化</option>
          <option value="0" ${env.potAwakening === false ? "selected" : ""}>关闭潜能强化</option>
        </select>
      </label>
      <label class="ws-field"><span>月光/摇摆2件套计入初始回能</span>
        <select id="env_er2pc">
          <option value="1" ${env.er2pcCountsInit !== false ? "selected" : ""}>计入局外初始回能转模</option>
          <option value="0" ${env.er2pcCountsInit === false ? "selected" : ""}>不计入局外转模</option>
        </select>
      </label>
    </div>
  `;

  document.getElementById("envStageSelect")?.addEventListener("change", (e: any) => {
    appStore.state.env.stageId = e.target.value;
    appStore.state.env.stageBuffs = deepClone(STAGE_BUFFS[e.target.value] || STAGE_BUFFS.none);
    refreshAllUI();
  });
  document.getElementById("envCustomStageBtn")?.addEventListener("click", () => openCustomWorkshop("presets", appStore.state.env.stageId));

  document.getElementById("envWeakCarryBtn")?.addEventListener("click", () => {
    const eb = CHAR_MAP[appStore.state.slots[0]?.cid]?.eb;
    if (eb) appStore.state.env.elemResMap[eb] = -0.20;
    refreshAllUI();
  });
  document.getElementById("envNeutralAllBtn")?.addEventListener("click", () => {
    appStore.state.env.elemResMap = makeDefaultElemResMap();
    refreshAllUI();
  });
  document.getElementById("envResistCarryBtn")?.addEventListener("click", () => {
    const eb = CHAR_MAP[appStore.state.slots[0]?.cid]?.eb;
    if (eb) appStore.state.env.elemResMap[eb] = 0.20;
    refreshAllUI();
  });

  wrap.querySelectorAll<any>("[data-elem-res]").forEach(inp => {
    inp.addEventListener("change", (e: any) => {
      appStore.state.env.elemResMap[inp.dataset.elemRes] = (parseFloat(e.target.value) || 0) / 100.0;
      refreshAllUI();
    });
  });

  document.getElementById("env_def")?.addEventListener("change", (e: any) => { appStore.state.env.enemyDef = Math.max(50, parseFloat(e.target.value) || 953); refreshAllUI(); });
  document.getElementById("env_stun_mult")?.addEventListener("change", (e: any) => { appStore.state.env.stunMultBase = Math.max(1, (parseFloat(e.target.value) || 150) / 100.0); refreshAllUI(); });
  document.getElementById("env_daze_th")?.addEventListener("change", (e: any) => { appStore.state.env.dazeThreshold = Math.max(1000, parseFloat(e.target.value) || 4200); refreshAllUI(); });
  document.getElementById("env_stun_dur")?.addEventListener("change", (e: any) => { appStore.state.env.stunDurationBase = Math.max(4, parseFloat(e.target.value) || 12); refreshAllUI(); });
  document.getElementById("env_anom_th")?.addEventListener("change", (e: any) => { appStore.state.env.anomThresholdScale = Math.max(0.4, parseFloat(e.target.value) || 1.0); refreshAllUI(); });
  document.getElementById("env_dis_sec")?.addEventListener("change", (e: any) => { appStore.state.env.disorderSec = Math.max(0, Math.min(10, parseFloat(e.target.value) || 7)); refreshAllUI(); });
  document.getElementById("env_miasma")?.addEventListener("change", (e: any) => { appStore.state.env.miasmaFactor = Math.max(0.2, Math.min(1.0, (parseFloat(e.target.value) || 100) / 100.0)); refreshAllUI(); });
  document.getElementById("env_rolls")?.addEventListener("change", (e: any) => {
    const r = Math.max(10, Math.min(42, Math.round(parseFloat(e.target.value) || 28)));
    appStore.state.env.rollBudget = r;
    appStore.state.slots.forEach(s => { if (s) s.rolls = r; });
    refreshAllUI();
  });
  document.getElementById("env_stun_mode")?.addEventListener("change", (e: any) => { appStore.state.env.stunPhysicsMode = e.target.value; refreshAllUI(); });
  document.getElementById("env_aggro")?.addEventListener("change", (e: any) => { appStore.state.env.highAggro = e.target.value === "1"; refreshAllUI(); });
  document.getElementById("env_pot")?.addEventListener("change", (e: any) => { appStore.state.env.potAwakening = e.target.value === "1"; refreshAllUI(); });
  document.getElementById("env_er2pc")?.addEventListener("change", (e: any) => { appStore.state.env.er2pcCountsInit = e.target.value === "1"; refreshAllUI(); });
}

// ============================================================================
// Global Topbar Bindings & Bootstrapping
// ============================================================================
export function initApp() {
  registerRefreshHandler(refreshAllUI);
  loadWorkspaceFromStorage();

  // Deep link: #/timeline, #/diag, #/eval, #/env, #/enka, #/all opens that workspace view
  const applyHashView = () => {
    const hashView = (typeof location !== "undefined" ? location.hash : "").replace(/^#\/?/, "");
    if (["build", "enka", "timeline", "diag", "eval", "env", "all"].includes(hashView)) {
      appStore.state.studioView = hashView as StudioViewTab;
      if (hashView === "enka") appStore.state.enkaPanelOpen = true;
      return true;
    }
    return false;
  };
  applyHashView();
  window.addEventListener("hashchange", () => {
    if (applyHashView()) refreshAllUI();
  });

  document.querySelectorAll<HTMLButtonElement>("#langSwitchBar .lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = (btn.dataset.lang as LangCode) || "zh";
      appStore.state.lang = next;
      refreshAllUI();
    });
  });

  document.getElementById("toggleEnkaPanelBtn")?.addEventListener("click", () => {
    if (appStore.state.studioView === "enka") {
      appStore.state.studioView = "build";
      appStore.state.enkaPanelOpen = false;
    } else if (appStore.state.studioView === "all") {
      appStore.state.enkaPanelOpen = !appStore.state.enkaPanelOpen;
    } else {
      appStore.state.studioView = "enka";
      appStore.state.enkaPanelOpen = true;
    }
    refreshAllUI();
  });

  document.getElementById("togglePickerCollapseBtn")?.addEventListener("click", () => {
    appStore.state.pickerCollapsed = !appStore.state.pickerCollapsed;
    refreshAllUI();
  });

  const quickDropdown = document.getElementById("quickToolsDropdown") as HTMLDetailsElement | null;
  if (quickDropdown) {
    quickDropdown.querySelectorAll<HTMLButtonElement>(".dropdown-item").forEach((item) => {
      item.addEventListener("click", () => {
        quickDropdown.open = false;
      });
    });
    document.addEventListener("click", (e) => {
      if (quickDropdown.open && !quickDropdown.contains(e.target as Node)) {
        quickDropdown.open = false;
      }
    });
  }

  document.getElementById("metricModeBtn")?.addEventListener("click", () => {
    appStore.state.env.metricMode = appStore.state.env.metricMode === "dpr" ? "dps" : "dpr";
    refreshAllUI();
  });

  document.getElementById("openWorkshopTopBtn")?.addEventListener("click", () => {
    openCustomWorkshop("chars", appStore.state.slots[0]?.cid || "1551");
  });

  document.getElementById("autoDiscBtn")?.addEventListener("click", () => {
    appStore.state.slots = autoOptimizeTeamDiscs(appStore.state.slots, appStore.state.env, CHAR_MAP, SC_WEPS);
    refreshAllUI();
  });

  document.getElementById("setM0R1Btn")?.addEventListener("click", () => {
    appStore.state.slots.forEach((s) => {
      if (!s || !s.cid || !CHAR_MAP[s.cid]) return;
      const ch = CHAR_MAP[s.cid];
      s.m = ch.r === "A" ? 6 : 0;
      s.wid = SC_WEPS[ch.sig] ? ch.sig : s.wid;
      s.ref = SC_WEPS[s.wid]?.r === "S" ? 1 : 5;
      s.weightMode = "auto";
    });
    refreshAllUI();
  });

  document.getElementById("soloCarryBtn")?.addEventListener("click", () => {
    appStore.state.slots[1] = null;
    appStore.state.slots[2] = null;
    ensureTimelineInitialized(true);
    refreshAllUI();
  });

  document.getElementById("zeroSubDpsBtn")?.addEventListener("click", () => {
    appStore.state.slots.forEach((s, idx) => {
      if (!s) return;
      s.weightMode = "manual";
      s.weight = idx === 0 ? 1.0 : 0.0;
    });
    refreshAllUI();
  });

  document.getElementById("setM6R5Btn")?.addEventListener("click", () => {
    appStore.state.slots.forEach((s) => {
      if (!s || !s.cid || !CHAR_MAP[s.cid]) return;
      const ch = CHAR_MAP[s.cid];
      s.m = 6;
      s.wid = SC_WEPS[ch.sig] ? ch.sig : s.wid;
      s.ref = 5;
      s.weightMode = "auto";
    });
    refreshAllUI();
  });

  document.getElementById("exportWorkspaceBtn")?.addEventListener("click", () => {
    const payload = {
      type: "zzz_v33_full_workspace_and_custom_db",
      exportedAt: new Date().toISOString(),
      workspace: appStore.state,
      customDB,
      enkaVault
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "绝区零v3.3配队与合轴全量配置.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("importWorkspaceBtn")?.addEventListener("click", () => {
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
          if (parsed.customDB) {
            Object.assign(customDB, parsed.customDB);
            saveCustomDBToStorage();
            rebuildDataMaps();
          }
          if (parsed.enkaVault && typeof parsed.enkaVault === "object") {
            Object.assign(enkaVault, parsed.enkaVault);
            saveEnkaVaultToStorage();
          }
          if (parsed.workspace && Array.isArray(parsed.workspace.slots)) {
            appStore.state = { ...makeInitialState(), ...parsed.workspace };
          }
          refreshAllUI();
        } catch (_) {}
      };
      reader.readAsText(f);
    };
    inp.click();
  });

  document.getElementById("resetAllBtn")?.addEventListener("click", () => {
    const curTheme = appStore.state.theme;
    const curLang = appStore.state.lang;
    appStore.state = makeInitialState();
    appStore.state.theme = curTheme;
    appStore.state.lang = curLang;
    ensureTimelineInitialized(true);
    refreshAllUI();
  });

  document.getElementById("themeToggleBtn")?.addEventListener("click", () => {
    appStore.state.theme = appStore.state.theme === "light" ? "dark" : "light";
    refreshAllUI();
  });

  if (typeof window !== "undefined") {
    if ((window as any).__AGY_ARTIFACT__ && document.documentElement) {
      appStore.state.theme = document.documentElement.classList.contains("light") ? "light" : "dark";
    }
    window.addEventListener("themechange", () => {
      if (document.documentElement) {
        appStore.state.theme = document.documentElement.classList.contains("light") ? "light" : "dark";
        refreshAllUI();
      }
    });
  }

  refreshAllUI();
}



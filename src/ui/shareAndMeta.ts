// ============================================================================
// URL Configuration Share Code (#s=...) + Changelog / Roadmap / Feedback Modal
// ============================================================================

import { BANGBOO_MAP, CHAR_MAP, SC_WEPS, STAGE_BUFFS, deepClone } from "../data/store";
import { escHtml } from "../engine/constants";
import { makeDefaultSwapConfig } from "../engine/swapTimeline";
import { localizeDOM } from "../i18n";
import {
  type StudioViewTab,
  appStore,
  ensureTimelineInitialized,
  makeDefaultElemResMap,
  makeDefaultSlot,
  triggerRefreshUI
} from "./appState";

const REPO_ISSUES_URL = "https://github.com/h-void/zzz-dmg-calculator/issues/new";

export const STUDIO_VERSION = "v3.3.2";
export const STUDIO_UPDATED_AT = "2026/11/20";

export const MODULE_UPDATES: Array<{ module: string; date: string; summary: string }> = [
  { module: "04 养成收益 · 金数矩阵", date: "2026/11/20", summary: "新增主C×队友二维金数矩阵 DPS 热力图、金数效率前沿与 1→N 金最优加金路径，点击格子一键套用" },
  { module: "01 词条寻优 & 03 乘区账本", date: "2026/11/20", summary: "升级 1 词条精度边际爬山+局部交换最优分配（极限最优/快速均衡/自定义三态）；开放全 3 槽位乘区来源账本" },
  { module: "02 合轴排轴 · 单招明细", date: "2026/11/20", summary: "点击甘特图任意动作块实时展示该招式伤害占比、瞬时六维乘区与短轴拐覆盖窗口状态" },
  { module: "06 机制百科 & 回能计算器", date: "2026/11/20", summary: "新增四大伤害公式与异常系数表、全 62 代理人底层帧数表、独立回能/喧响阈值计算器与全装备图鉴" },
  { module: "05 敌人环境 · 实战参考线", date: "2026/11/20", summary: "新增 v3.3 危局强袭战/式舆剧变7首领档期预设，右侧输出轨实时折算危局预估分与式舆单路通关秒数" },
  { module: "分享码 & 站点透明度", date: "2026/11/20", summary: "支持纯前端 URL 配置分享链接 (#s=...)、站内更新公告、公开开发计划与强制清缓存刷新" }
];

export const ROADMAP_ITEMS: Array<{ status: "done" | "doing" | "planned"; title: string; detail: string }> = [
  { status: "done", title: "1 词条精度最优副词条求解器 + 三态切换", detail: "取代固定步长网格，避免暴击溢出并自动贴合辅助转模阈值" },
  { status: "done", title: "二维金数矩阵 DPS 热力图 + 一键套用", detail: "覆盖 0+0 ~ 6+5 全段位，直观评估抽卡投入产出比" },
  { status: "done", title: "单招式乘区拆解 & 机制/回能百科", detail: "让每一笔伤害与循环能耗均可核对、可追溯" },
  { status: "doing", title: "移动端紧凑工作台与触屏排轴手势优化", detail: "优化小屏下的甘特图滑动与卡片折叠密度" },
  { status: "planned", title: "社区低金作业分享码合集（无后端纯静态）", detail: "基于 URL 分享码一键还原危局低金满星配装与排轴手法" },
  { status: "planned", title: "自定义多期深渊血量/分数校准导入", detail: "支持版本更新后直接导入当期危局/式舆首领血量配置文件" }
];

/* ---------------- Compact UTF-8 Base64URL Share Encoder ---------------- */

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64.length + 3) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeWorkspaceToShareCode(): string {
  const st = appStore.state;
  const compactSlots = st.slots.map((s) => {
    if (!s || !s.cid) return null;
    const item: Record<string, any> = {
      c: s.cid,
      m: s.m,
      w: s.wid,
      r: s.ref,
      f: s.fourPc,
      t: s.twoPc
    };
    if (s.buildMode && s.buildMode !== "auto") item.bm = s.buildMode;
    if (s.discAuto === false) {
      item.da = 0;
      item.d = [s.d4, s.d5, s.d6];
    }
    if (s.subAllocMode && s.subAllocMode !== "optimal") item.sm = s.subAllocMode;
    if (s.subAllocMode === "custom" || s.subAuto === false) item.sb = s.sub;
    if (s.rolls !== 28) item.rl = s.rolls;
    if (s.weightMode === "manual") item.wt = s.weight;
    if (s.agentLv !== 60) item.lv = s.agentLv;
    if (s.coreLv !== 6) item.cl = s.coreLv;
    if (s.buildMode === "panel" && s.panel) item.pn = s.panel;
    return item;
  });

  const nonZeroRes: Record<string, number> = {};
  for (const [k, v] of Object.entries(st.env.elemResMap || {})) {
    const n = Number(v) || 0;
    if (Math.abs(n) > 1e-4) nonZeroRes[k] = Number(n.toFixed(3));
  }

  const payload: Record<string, any> = {
    v: 1,
    s: compactSlots,
    e: {
      mm: st.env.metricMode || "dps",
      bb: st.env.bangbooId || "none",
      st: st.env.stageId || "none",
      sw: st.env.swapConfig?.preset || st.env.swapMode || "standard",
      df: st.env.enemyDef ?? 953,
      sm: st.env.stunMultBase ?? 1.5,
      dz: st.env.dazeThreshold ?? 4200,
      sd: st.env.stunDurationBase ?? 12,
      mi: st.env.miasmaFactor ?? 1,
      ag: st.env.highAggro ? 1 : 0,
      eg: st.env.activeEndgameId || "",
      op: st.env.daOpsScore ?? 4000,
      rs: Object.keys(nonZeroRes).length > 0 ? nonZeroRes : undefined
    }
  };
  if (st.studioView && st.studioView !== "build") payload.vw = st.studioView;

  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

export function decodeAndApplyShareCode(code: string): boolean {
  try {
    if (!code || code.length < 8) return false;
    const bytes = base64UrlToBytes(code);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.s)) return false;

    const nextSlots = [0, 1, 2].map((i) => {
      const it = parsed.s[i];
      if (!it || !it.c || !CHAR_MAP[it.c]) return null;
      const wid = it.w && SC_WEPS[it.w] ? it.w : null;
      const sl = makeDefaultSlot(it.c, Number(it.m) || 0, wid, Number(it.r) || 1, it.f || null);
      if (!sl) return null;
      if (it.t) sl.twoPc = it.t;
      if (it.bm === "pieces" || it.bm === "panel") sl.buildMode = it.bm;
      if (it.da === 0 && Array.isArray(it.d) && it.d.length === 3) {
        sl.discAuto = false;
        sl.d4 = it.d[0];
        sl.d5 = it.d[1];
        sl.d6 = it.d[2];
      }
      if (it.sm === "fast" || it.sm === "custom" || it.sm === "optimal") {
        sl.subAllocMode = it.sm;
        sl.subAuto = it.sm !== "custom";
      }
      if (it.sb && typeof it.sb === "object") {
        sl.sub = it.sb;
        sl.subAllocMode = "custom";
        sl.subAuto = false;
      }
      if (it.rl !== undefined) sl.rolls = Number(it.rl) || 28;
      if (it.wt !== undefined) {
        sl.weightMode = "manual";
        sl.weight = Number(it.wt);
      }
      if (it.lv !== undefined) sl.agentLv = Number(it.lv) || 60;
      if (it.cl !== undefined) sl.coreLv = Number(it.cl);
      if (it.pn && typeof it.pn === "object") sl.panel = it.pn;
      return sl;
    });

    appStore.state.slots = nextSlots;

    const e = parsed.e || {};
    appStore.state.env.metricMode = e.mm === "dpr" ? "dpr" : "dps";
    if (e.bb && BANGBOO_MAP[e.bb]) appStore.state.env.bangbooId = e.bb;
    if (e.st && STAGE_BUFFS[e.st]) {
      appStore.state.env.stageId = e.st;
      appStore.state.env.stageBuffs = deepClone(STAGE_BUFFS[e.st]);
    }
    if (e.sw) {
      appStore.state.env.swapMode = e.sw;
      appStore.state.env.swapConfig = makeDefaultSwapConfig(e.sw);
    }
    if (e.df !== undefined) appStore.state.env.enemyDef = Number(e.df) || 953;
    if (e.sm !== undefined) appStore.state.env.stunMultBase = Number(e.sm) || 1.5;
    if (e.dz !== undefined) appStore.state.env.dazeThreshold = Number(e.dz) || 4200;
    if (e.sd !== undefined) appStore.state.env.stunDurationBase = Number(e.sd) || 12;
    if (e.mi !== undefined) appStore.state.env.miasmaFactor = Number(e.mi) || 1;
    appStore.state.env.highAggro = Boolean(e.ag);
    if (e.eg !== undefined) appStore.state.env.activeEndgameId = e.eg;
    if (e.op !== undefined) appStore.state.env.daOpsScore = Number(e.op) ?? 4000;
    appStore.state.env.elemResMap = { ...makeDefaultElemResMap(), ...(e.rs || {}) };

    if (
      parsed.vw &&
      ["build", "enka", "timeline", "diag", "eval", "env", "wiki", "all"].includes(parsed.vw)
    ) {
      appStore.state.studioView = parsed.vw as StudioViewTab;
    }

    ensureTimelineInitialized(true);
    return true;
  } catch {
    return false;
  }
}

export function buildShareUrl(): string {
  const code = encodeWorkspaceToShareCode();
  if (typeof location === "undefined") return `#s=${code}`;
  const base = `${location.origin}${location.pathname}${location.search}`;
  return `${base}#s=${code}`;
}

export function showStudioToast(message: string, durationMs = 2600): void {
  if (typeof document === "undefined") return;
  let toast = document.getElementById("studioToastEl");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "studioToastEl";
    toast.className = "studio-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  const prevTimer = (toast as any)._hideTimer;
  if (prevTimer) clearTimeout(prevTimer);
  (toast as any)._hideTimer = setTimeout(() => {
    toast?.classList.remove("show");
  }, durationMs);
}

export async function copyCurrentShareUrl(): Promise<void> {
  const url = buildShareUrl();
  try {
    if (typeof history !== "undefined" && history.replaceState) {
      history.replaceState(null, "", `#s=${url.split("#s=")[1]}`);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
      showStudioToast("✓ 已复制配置分享链接到剪贴板，发送给群友打开即可直接还原配队！");
      return;
    }
  } catch {
    // Fallback below
  }
  if (typeof window !== "undefined") {
    window.prompt("复制下方配置分享链接：", url);
  }
}

/* ---------------- Changelog / Roadmap / Disclaimer / Feedback Modal ---------------- */

let activeMetaTab: "changelog" | "roadmap" | "disclaimer" = "changelog";

export function closeMetaModal(): void {
  const modal = document.getElementById("metaModal");
  if (modal) modal.hidden = true;
}

export function openMetaModal(tab: "changelog" | "roadmap" | "disclaimer" = "changelog"): void {
  activeMetaTab = tab;
  const modal = document.getElementById("metaModal");
  if (!modal) return;
  modal.hidden = false;
  renderMetaModal();
}

function renderMetaModal(): void {
  const modal = document.getElementById("metaModal");
  if (!modal) return;

  const statusLabels: Record<string, { text: string; cls: string }> = {
    done: { text: "已上线", cls: "b-ok" },
    doing: { text: "开发中", cls: "b-info" },
    planned: { text: "规划中", cls: "" }
  };

  let bodyHtml = "";
  if (activeMetaTab === "changelog") {
    bodyHtml = `
      <div class="meta-version-strip">
        <div>
          <span class="badge b-info mono">${STUDIO_VERSION}</span>
          <strong style="margin-left:6px;">各模块最近更新记录</strong>
        </div>
        <span class="muted mono">最后更新：${STUDIO_UPDATED_AT}</span>
      </div>
      <div class="meta-list">
        ${MODULE_UPDATES.map(
          (u) => `
          <div class="meta-row">
            <div class="row" style="justify-content:space-between;margin-bottom:4px;">
              <strong>${escHtml(u.module)}</strong>
              <span class="muted mono" style="font-size:11px;">${escHtml(u.date)}</span>
            </div>
            <div class="muted" style="font-size:12px;line-height:1.5;">${escHtml(u.summary)}</div>
          </div>
        `
        ).join("")}
      </div>
    `;
  } else if (activeMetaTab === "roadmap") {
    bodyHtml = `
      <div class="muted" style="font-size:12px;margin-bottom:10px;">
        公开开发计划：欢迎通过 GitHub Issues 提交角色公式勘误、配队建议或新功能需求。
      </div>
      <div class="meta-list">
        ${ROADMAP_ITEMS.map((item) => {
          const st = statusLabels[item.status] || statusLabels.planned;
          return `
            <div class="meta-row">
              <div class="row" style="justify-content:space-between;margin-bottom:4px;">
                <strong>${escHtml(item.title)}</strong>
                <span class="badge ${st.cls}">${st.text}</span>
              </div>
              <div class="muted" style="font-size:12px;line-height:1.5;">${escHtml(item.detail)}</div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  } else {
    bodyHtml = `
      <div class="meta-list">
        <div class="meta-row">
          <strong>计算口径与免责声明</strong>
          <p class="muted" style="font-size:12px;line-height:1.65;margin:6px 0 0;">
            本工作台为绝区零数值模型与八维合轴物理推演模拟器，所有计算均在浏览器本地完成（零服务端上传）。由于实战中存在首领转场无敌帧、索敌偏移、随机受击与手法波动，<strong>计算结果仅用于配队对比、词条配平与抽卡 ROI 决策参考，一切表现请以游戏内实战为准</strong>。
          </p>
        </div>
        <div class="meta-row">
          <strong>危局强袭战 / 式舆防卫战参考线说明</strong>
          <p class="muted" style="font-size:12px;line-height:1.65;margin:6px 0 0;">
            右侧输出轨与「05 敌人与环境」中的危局预估分与式舆预估秒数，默认对理论全轴 DPS 乘以 <code>0.90</code> 实战有效输出率（扣除首领转场/无敌帧），并按参考首领血量与操作分（默认 4,000 分，可手动微调 0~5,000）换算，帮助将抽象 DPS 锚定到实际满星门槛。
          </p>
        </div>
        <div class="meta-row">
          <strong>纯前端缓存与强制刷新</strong>
          <p class="muted" style="font-size:12px;line-height:1.65;margin:6px 0 0;">
            若浏览器或 CDN 缓存了旧版本静态资源导致数据未及时更新，可点击下方「强制刷新页面」按钮绕过缓存拉取最新构建（不会清空你的本地练度柜与自定义工坊数据）。
          </p>
        </div>
      </div>
    `;
  }

  modal.innerHTML = `
    <div class="ws-dialog meta-dialog">
      <div class="ws-head">
        <div>
          <strong style="font-size:15px;">绝区零精算台 ${STUDIO_VERSION} · 更新日志 · 开发计划 · 口径反馈</strong>
          <div style="font-size:11px;opacity:0.78;margin-top:2px;">纯前端零服务端 · GPL-3.0 开源 · 数据更新 ${STUDIO_UPDATED_AT}</div>
        </div>
        <button type="button" class="btn btn-sm" id="closeMetaModalBtn">关闭 ×</button>
      </div>
      <div class="meta-body">
        <div class="ws-tabs" style="margin-bottom:12px;">
          <button type="button" class="tab-btn ${activeMetaTab === "changelog" ? "active" : ""}" data-meta-tab="changelog">更新日志</button>
          <button type="button" class="tab-btn ${activeMetaTab === "roadmap" ? "active" : ""}" data-meta-tab="roadmap">开发计划</button>
          <button type="button" class="tab-btn ${activeMetaTab === "disclaimer" ? "active" : ""}" data-meta-tab="disclaimer">口径说明 &amp; 缓存</button>
        </div>
        ${bodyHtml}
      </div>
      <div class="meta-foot">
        <div class="row" style="gap:8px;">
          <a class="btn btn-sm btn-primary" href="${REPO_ISSUES_URL}" target="_blank" rel="noopener noreferrer">提交 Bug / 数值勘误 (GitHub)</a>
          <button type="button" class="btn btn-sm" id="metaShareCopyBtn">复制当前配置分享链接</button>
        </div>
        <button type="button" class="btn btn-sm btn-tonal" id="metaForceReloadBtn" title="携带时间戳参数强制刷新，绕过静态资源缓存">强制刷新缓存 ↻</button>
      </div>
    </div>
  `;

  modal.onclick = (e) => {
    if (e.target === modal) closeMetaModal();
  };
  document.getElementById("closeMetaModalBtn")?.addEventListener("click", closeMetaModal);
  modal.querySelectorAll<HTMLButtonElement>("[data-meta-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeMetaTab = (btn.dataset.metaTab as any) || "changelog";
      renderMetaModal();
    });
  });
  document.getElementById("metaShareCopyBtn")?.addEventListener("click", () => {
    void copyCurrentShareUrl();
  });
  document.getElementById("metaForceReloadBtn")?.addEventListener("click", () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("_t", String(Date.now()));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  });

  localizeDOM(modal, appStore.state.lang || "zh");
  void triggerRefreshUI;
}

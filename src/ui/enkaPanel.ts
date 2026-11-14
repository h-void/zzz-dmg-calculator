import { CHAR_MAP, DISC_SETS, SC_WEPS, deepClone } from "../data/store";
import { CORE_LABELS, escHtml } from "../engine/constants";
import {
  clearEnkaVault,
  enkaVault,
  fetchEnkaShowcaseByUid,
  getSortedVaultAgents,
  ingestEnkaPayloadIntoVault,
  loadDemoShowcaseIntoVault,
  mergeDiscsIntoPool,
  saveEnkaVaultToStorage
} from "../enka/client";
import { DEMO_ENKA_UID } from "../enka/demoShowcase";
import { scoreSixPiecesForAgent } from "../enka/mappings";
import { parseExternalScannerDiscs, syncedRecordToSlotConfig } from "../enka/parser";
import type { SlotConfig } from "../types";
import { runWorkerOptimizeSlotFromPool } from "../worker/workerClient";
import {
  appStore,
  ensureTimelineInitialized,
  fmtNum,
  makeDefaultSlot,
  preventDuplicateSupportAuraSets,
  triggerRefreshUI
} from "./appState";

interface EnkaUIState {
  uidInput: string;
  syncLoading: boolean;
  optLoadingSlot: number | null;
  excludeTeammateDiscs: boolean;
  showJsonImport: boolean;
  statusMsg: string;
  statusTone: "info" | "ok" | "warn";
  lastOptSummary: string;
}

const ENKA_UI_STATE: EnkaUIState = {
  uidInput: enkaVault.lastUid || DEMO_ENKA_UID,
  syncLoading: false,
  optLoadingSlot: null,
  excludeTeammateDiscs: true,
  showJsonImport: false,
  statusMsg: "",
  statusTone: "info",
  lastOptSummary: ""
};

function setEnkaStatus(msg: string, tone: "info" | "ok" | "warn" = "info"): void {
  ENKA_UI_STATE.statusMsg = msg;
  ENKA_UI_STATE.statusTone = tone;
}

export function getVaultSyncedSlotsMap(): Record<string, Partial<SlotConfig>> {
  const map: Record<string, Partial<SlotConfig>> = {};
  for (const rec of Object.values(enkaVault.agents)) {
    const cfg = syncedRecordToSlotConfig(rec, makeDefaultSlot);
    if (cfg) {
      map[rec.cid] = cfg;
    }
  }
  return map;
}

export async function optimizeSlotFromVaultPool(slotIdx: number): Promise<void> {
  const sl = appStore.state.slots[slotIdx];
  if (!sl || !sl.cid || !CHAR_MAP[sl.cid]) {
    setEnkaStatus(`请先在 ${slotIdx + 1} 号位上阵一名代理人，再执行驱动盘库寻优。`, "warn");
    renderEnkaPanel();
    return;
  }

  if (enkaVault.discPool.length === 0) {
    setEnkaStatus("当前本地驱动盘库为空！请先输入 UID 同步展柜、载入真实展柜示例，或导入扫描器驱动盘 JSON。", "warn");
    appStore.state.enkaPanelOpen = true;
    renderEnkaPanel();
    document.getElementById("sec00Enka")?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  const ch = CHAR_MAP[sl.cid];
  ENKA_UI_STATE.optLoadingSlot = slotIdx;
  renderEnkaPanel();

  try {
    const { result, elapsedMs } = await runWorkerOptimizeSlotFromPool(
      appStore.state.slots,
      slotIdx,
      enkaVault.discPool,
      ENKA_UI_STATE.excludeTeammateDiscs,
      appStore.state.env
    );

    const target = appStore.state.slots[slotIdx];
    if (target && result.bestPieces?.length === 6) {
      target.buildMode = "pieces";
      target.discAuto = false;
      target.subAuto = false;
      target.pieces = deepClone(result.bestPieces);
      target.fourPc = result.fourPc || "无";
      target.twoPc = result.twoPc || "无";
      target.d4 = result.bestPieces[3]?.main || target.d4;
      target.d5 = result.bestPieces[4]?.main || target.d5;
      target.d6 = result.bestPieces[5]?.main || target.d6;
    }

    const gainSign = result.dpsGainPct >= 0 ? "+" : "";
    const scored = scoreSixPiecesForAgent(result.bestPieces, ch);
    ENKA_UI_STATE.lastOptSummary =
      `[Worker ${elapsedMs} ms · 遍历 ${result.evaluatedCount.toLocaleString()} 组] ` +
      `已为 ${slotIdx + 1}号位【${ch.n}】从 ${result.poolSizeUsed} 张可用驱动盘中配出最优解：` +
      `【${result.fourPc}4 + ${result.twoPc}2】(${scored.overallGrade} · 有效 ${scored.effectiveRollsTotal} 词条)，` +
      `全队主指标 ${fmtNum(result.beforeTeamDps)} -> ${fmtNum(result.afterTeamDps)} (${gainSign}${result.dpsGainPct.toFixed(2)}%)`;
    setEnkaStatus(`已完成 ${slotIdx + 1} 号位【${ch.n}】后台多线程配装寻优！`, "ok");
  } catch (err: any) {
    setEnkaStatus(`Worker 寻优失败：${err?.message || "未知错误"}`, "warn");
  } finally {
    ENKA_UI_STATE.optLoadingSlot = null;
    triggerRefreshUI();
  }
}

export function renderEnkaPanel(): void {
  const sec = document.getElementById("sec00Enka");
  const body = document.getElementById("sec00EnkaBody");
  const topBtn = document.getElementById("toggleEnkaPanelBtn");

  const vaultAgents = getSortedVaultAgents();
  const poolCount = enkaVault.discPool.length;

  if (topBtn) {
    topBtn.textContent =
      vaultAgents.length > 0
        ? `UID练度柜 (${vaultAgents.length}人/${poolCount}盘)`
        : "UID展柜同步";
    topBtn.className = appStore.state.enkaPanelOpen ? "btn btn-primary" : "btn";
  }

  if (!sec || !body) return;
  sec.hidden = !appStore.state.enkaPanelOpen;
  if (!appStore.state.enkaPanelOpen) return;

  const activeCidToSlot = new Map<string, number>();
  appStore.state.slots.forEach((s, i) => {
    if (s?.cid) activeCidToSlot.set(s.cid, i);
  });

  const slotCounts = [1, 2, 3, 4, 5, 6].map(
    (sNum) => enkaVault.discPool.filter((d) => (d.slot || 1) === sNum).length
  );

  const toneBadgeCls =
    ENKA_UI_STATE.statusTone === "ok"
      ? "b-ok"
      : ENKA_UI_STATE.statusTone === "warn"
      ? "b-warn"
      : "b-info";

  body.innerHTML = `
    <div class="enka-toolbar">
      <label class="ws-field enka-uid-field">
        <span>绝区零 UID (国服/B服/国际服通用)</span>
        <input
          type="text"
          id="enkaUidInput"
          inputmode="numeric"
          maxlength="12"
          value="${escHtml(ENKA_UI_STATE.uidInput)}"
          placeholder="如 100123456 或 1500422486"
        >
      </label>
      <div class="row" style="gap:6px;flex-wrap:wrap;">
        <button class="btn btn-primary" id="enkaSyncUidBtn" ${ENKA_UI_STATE.syncLoading ? "disabled" : ""}>
          ${ENKA_UI_STATE.syncLoading ? "正在拉取展柜..." : "一键同步 UID 展柜"}
        </button>
        <button class="btn" id="enkaLoadDemoBtn" title="无需联网，立即载入真实 UID 1500422486 的 6 名满级角色与 36 张驱动盘体验完整工坊与寻优流程">
          载入真实展柜示例 (6角色/36盘)
        </button>
        <button class="btn ${ENKA_UI_STATE.showJsonImport ? "btn-primary" : ""}" id="enkaToggleJsonBtn">
          粘贴 Enka / 导入扫描器 JSON
        </button>
      </div>
      ${
        vaultAgents.length > 0
          ? `
        <div class="row" style="gap:6px;margin-left:auto;flex-wrap:wrap;">
          <button class="btn" id="enkaApplyTop3Btn" title="将练度柜词条最高的前3名角色直接填入 1/2/3 号位">前3名整队上阵</button>
          <button class="btn" id="enkaSyncOwnedBtn" title="将练度柜已同步角色设为「我的Box」已拥有角色">设为我的Box</button>
          <button class="btn btn-danger" id="enkaClearVaultBtn">清空练度柜</button>
        </div>
      `
          : ""
      }
    </div>

    ${
      ENKA_UI_STATE.showJsonImport
        ? `
      <div class="enka-json-box" style="margin-bottom:10px;">
        <div class="row" style="justify-content:space-between;margin-bottom:6px;gap:8px;flex-wrap:wrap;">
          <span style="font-size:12px;font-weight:700;">
            支持直接粘贴/上传 <code>Enka.Network UID JSON</code>，或第三方背包扫描器 (<code>GOOD / ZOD / AdeptiScanner-ZZZ</code>) 驱动盘库 JSON：
          </span>
          <div class="row" style="gap:6px;">
            <button class="btn btn-xs" id="enkaOpenRawUrlBtn">浏览器新标签打开此 UID 官方 JSON</button>
            <button class="btn btn-xs" id="enkaPickJsonFileBtn">选择本地 .json 文件导入</button>
            <button class="btn btn-xs btn-primary" id="enkaConfirmPasteBtn">解析下方粘贴的 JSON</button>
          </div>
        </div>
        <textarea id="enkaJsonTextarea" placeholder='在此粘贴 https://enka.network/api/zzz/uid/你的UID 返回的 JSON，或扫描器导出的驱动盘数组 JSON...'></textarea>
      </div>
    `
        : ""
    }

    <div class="enka-status-bar">
      <div>
        ${
          enkaVault.lastUid
            ? `<strong>绳匠：${escHtml(enkaVault.nickname || enkaVault.lastUid)}</strong> · 绳网 Lv.${enkaVault.interKnotLv} · UID <span class="mono">${escHtml(enkaVault.lastUid)}</span>${enkaVault.region ? ` (${escHtml(enkaVault.region)})` : ""}${enkaVault.signature ? ` · <span class="muted">「${escHtml(enkaVault.signature)}」</span>` : ""}`
            : `<span class="muted">工作原理（同微信小程序「绝区零工坊」）：读取游戏内「个人名片 -> 代理人展柜」公开的 6 名角色与全套 1-6 号驱动盘词条。换一批角色上展柜再次点同步，会自动<strong>增量合并</strong>到本地练度柜与驱动盘池！</span>`
        }
      </div>
      <div class="row" style="gap:8px;">
        <span class="badge">练度柜角色: <strong>${vaultAgents.length}</strong></span>
        <span class="badge">驱动盘池: <strong>${poolCount}</strong> 张</span>
        ${ENKA_UI_STATE.statusMsg ? `<span class="badge ${toneBadgeCls}">${escHtml(ENKA_UI_STATE.statusMsg)}</span>` : ""}
      </div>
    </div>

    ${
      poolCount > 0
        ? `
      <div class="pool-opt-banner" style="margin-bottom:10px;">
        <div>
          <strong>驱动盘库 Web Worker 后台配装寻优</strong>
          <span class="muted mono" style="margin-left:6px;">
            盘池按槽位分布: ${slotCounts.map((n, idx) => `[${idx + 1}]×${n}`).join(" · ")}
          </span>
        </div>
        <div class="row" style="gap:6px;flex-wrap:wrap;">
          <label class="chk-pill">
            <input type="checkbox" id="enkaExcludeEquippedChk" ${ENKA_UI_STATE.excludeTeammateDiscs ? "checked" : ""}>
            排除当前队友已穿同张盘(防抢盘)
          </label>
          ${[0, 1, 2]
            .map((idx) => {
              const s = appStore.state.slots[idx];
              const ch = s?.cid ? CHAR_MAP[s.cid] : null;
              const busy = ENKA_UI_STATE.optLoadingSlot === idx;
              return `
                <button
                  class="btn btn-xs ${idx === 0 ? "btn-primary" : ""}"
                  data-enka-opt-slot="${idx}"
                  ${!ch || ENKA_UI_STATE.optLoadingSlot !== null ? "disabled" : ""}
                >
                  ${busy ? "Worker 寻优中..." : `寻优 ${idx + 1}号位${ch ? `·${escHtml(ch.n)}` : "(空)"}`}
                </button>
              `;
            })
            .join("")}
        </div>
        ${
          ENKA_UI_STATE.lastOptSummary
            ? `<div class="mono" style="width:100%;font-size:11px;color:var(--foreground);padding-top:4px;border-top:1px dashed rgba(14,165,233,0.28);">${escHtml(ENKA_UI_STATE.lastOptSummary)}</div>`
            : ""
        }
      </div>
    `
        : ""
    }

    ${
      vaultAgents.length > 0
        ? `
      <div class="enka-vault-grid">
        ${vaultAgents
          .map((rec) => {
            const ch = CHAR_MAP[rec.cid];
            if (!ch) return "";
            const w = SC_WEPS[rec.wid];
            const inSlot = activeCidToSlot.get(rec.cid);
            const setLabel =
              rec.fourPc !== "无"
                ? `${rec.fourPc}4${rec.twoPc !== "无" ? ` + ${rec.twoPc}2` : ""}`
                : rec.twoPc !== "无"
                ? `${rec.twoPc}2 散搭`
                : "散件";
            return `
              <div class="enka-agent-card ${inSlot !== undefined ? "in-active-team" : ""}">
                <div class="enka-agent-head">
                  <div class="row" style="gap:6px;">
                    <span class="elem-dot elem-${ch.eb}"></span>
                    <strong style="font-size:14px;">[${ch.r}] ${escHtml(ch.n)}</strong>
                    <span class="badge">M${rec.m}</span>
                    ${inSlot !== undefined ? `<span class="badge b-ok">当前${inSlot + 1}号位</span>` : ""}
                  </div>
                  <div class="row" style="gap:5px;">
                    <span class="mono muted" style="font-size:11px;">有效 <strong>${rec.effectiveRollsTotal.toFixed(1)}</strong> 词</span>
                    <span class="grade-badge grade-${rec.overallGrade}">${rec.overallGrade}</span>
                  </div>
                </div>

                <div class="enka-agent-meta mono">
                  <span>Lv.${rec.agentLv} · ${CORE_LABELS[rec.coreLv] || "核心F"} · 技Lv.${rec.skillLv}</span>
                  <span>|</span>
                  <span>${w ? `[${w.r}·R${rec.ref}] ${escHtml(w.n)}` : "默认音擎"}</span>
                  <span>|</span>
                  <strong style="color:var(--foreground);">${escHtml(setLabel)}</strong>
                </div>

                <div class="enka-disc-strip">
                  ${rec.pieceSummaries
                    .map(
                      (ps) => `
                    <div class="enka-disc-mini" title="[${ps.slot}]号盘 · ${escHtml(ps.setName)} Lv.${ps.level} · 主词条:${escHtml(ps.mainZh)} · 有效${ps.effectiveRolls}词条 (总${ps.totalRolls}词条)">
                      <span class="muted">[${ps.slot}]${escHtml(ps.set === "无" ? "空" : ps.set.slice(0, 2))}</span>
                      <strong>${escHtml(ps.mainZh)}</strong>
                      <span class="grade-${ps.grade}" style="padding:0 3px;border-radius:3px;font-weight:700;">${ps.effectiveRolls}词·${ps.grade}</span>
                    </div>
                  `
                    )
                    .join("")}
                </div>

                <div class="enka-slot-btns">
                  <span class="muted" style="font-size:11px;">一键带盘上阵:</span>
                  ${[0, 1, 2]
                    .map(
                      (sIdx) => `
                    <button class="btn btn-xs ${sIdx === 0 ? "btn-primary" : ""}" data-vault-equip="${escHtml(rec.cid)}:${sIdx}">
                      填入${sIdx + 1}号位
                    </button>
                  `
                    )
                    .join("")}
                  <button class="btn btn-xs" style="margin-left:auto;" data-vault-remove="${escHtml(rec.cid)}" title="从本地练度柜移除此角色">×</button>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `
        : ""
    }
  `;

  bindEnkaPanelEvents(body);
}

function applyVaultRecordToSlot(cid: string, slotIdx: number): void {
  const rec = enkaVault.agents[cid];
  if (!rec) return;
  const slotCfg = syncedRecordToSlotConfig(rec, makeDefaultSlot);
  if (!slotCfg) return;

  // If the same character is already in another slot, clear the duplicate slot
  appStore.state.slots.forEach((s, idx) => {
    if (idx !== slotIdx && s?.cid === cid) {
      appStore.state.slots[idx] = null;
    }
  });

  appStore.state.slots[slotIdx] = slotCfg;
  ensureTimelineInitialized(true);
  const chName = CHAR_MAP[cid]?.n || cid;
  setEnkaStatus(`已将【${chName}】真实展柜面板与 1-6 号驱动盘载入 ${slotIdx + 1} 号位！`, "ok");
  triggerRefreshUI();
}

function handleImportedJsonString(rawText: string): void {
  const trimmed = rawText.trim();
  if (!trimmed) {
    setEnkaStatus("请先粘贴 JSON 内容后再点击解析。", "warn");
    renderEnkaPanel();
    return;
  }
  const parsed = JSON.parse(trimmed);
  if (parsed?.PlayerInfo?.ShowcaseDetail?.AvatarList) {
    const res = ingestEnkaPayloadIntoVault(parsed, ENKA_UI_STATE.uidInput);
    ENKA_UI_STATE.uidInput = res.uid || ENKA_UI_STATE.uidInput;
    ENKA_UI_STATE.showJsonImport = false;
    setEnkaStatus(
      `成功解析 Enka 展柜 JSON：同步 ${res.syncedCount} 名代理人（累计 ${res.totalVaultAgents} 名），新增 ${res.newDiscsAdded} 张驱动盘！`,
      "ok"
    );
    triggerRefreshUI();
    return;
  }

  const discs = parseExternalScannerDiscs(parsed);
  if (discs.length > 0) {
    const added = mergeDiscsIntoPool(discs);
    ENKA_UI_STATE.showJsonImport = false;
    setEnkaStatus(
      `成功导入扫描器驱动盘 JSON：识别 ${discs.length} 张驱动盘（去重后新增 ${added} 张，盘池共 ${enkaVault.discPool.length} 张）！`,
      "ok"
    );
    triggerRefreshUI();
    return;
  }

  throw new Error("未识别到有效的 Enka 展柜角色数据或驱动盘列表，请检查 JSON 格式。");
}

function bindEnkaPanelEvents(root: HTMLElement): void {
  const uidInp = document.getElementById("enkaUidInput") as HTMLInputElement | null;
  uidInp?.addEventListener("input", () => {
    ENKA_UI_STATE.uidInput = uidInp.value.trim();
  });
  uidInp?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      document.getElementById("enkaSyncUidBtn")?.click();
    }
  });

  document.getElementById("enkaSyncUidBtn")?.addEventListener("click", async () => {
    const uid = (uidInp?.value || ENKA_UI_STATE.uidInput).trim();
    ENKA_UI_STATE.uidInput = uid;
    ENKA_UI_STATE.syncLoading = true;
    setEnkaStatus(`正在连接 Enka.Network 同步 UID ${uid}...`, "info");
    renderEnkaPanel();
    try {
      const { via, summary } = await fetchEnkaShowcaseByUid(uid);
      setEnkaStatus(
        `通过「${via}」同步成功：更新 ${summary.syncedCount} 名展柜角色（本地共 ${summary.totalVaultAgents} 名），新增 ${summary.newDiscsAdded} 张驱动盘！`,
        "ok"
      );
    } catch (err: any) {
      setEnkaStatus(err?.message || "UID 展柜拉取失败", "warn");
    } finally {
      ENKA_UI_STATE.syncLoading = false;
      triggerRefreshUI();
    }
  });

  document.getElementById("enkaLoadDemoBtn")?.addEventListener("click", () => {
    const summary = loadDemoShowcaseIntoVault();
    ENKA_UI_STATE.uidInput = summary.uid;
    setEnkaStatus(
      `已载入真实展柜示例 (UID ${summary.uid})：6 名 Lv.60 代理人与 ${enkaVault.discPool.length} 张真实驱动盘已就绪，点击任一角色「填入1~3号位」或「寻优」立即体验！`,
      "ok"
    );
    triggerRefreshUI();
  });

  document.getElementById("enkaToggleJsonBtn")?.addEventListener("click", () => {
    ENKA_UI_STATE.showJsonImport = !ENKA_UI_STATE.showJsonImport;
    renderEnkaPanel();
  });

  document.getElementById("enkaOpenRawUrlBtn")?.addEventListener("click", () => {
    const uid = ENKA_UI_STATE.uidInput.trim() || DEMO_ENKA_UID;
    window.open(`https://enka.network/api/zzz/uid/${encodeURIComponent(uid)}`, "_blank", "noopener");
  });

  document.getElementById("enkaConfirmPasteBtn")?.addEventListener("click", () => {
    const ta = document.getElementById("enkaJsonTextarea") as HTMLTextAreaElement | null;
    try {
      handleImportedJsonString(ta?.value || "");
    } catch (err: any) {
      setEnkaStatus(`JSON 解析失败：${err?.message || "格式有误"}`, "warn");
      renderEnkaPanel();
    }
  });

  document.getElementById("enkaPickJsonFileBtn")?.addEventListener("click", () => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".json,application/json";
    inp.onchange = () => {
      const f = inp.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          handleImportedJsonString(String(reader.result || ""));
        } catch (err: any) {
          setEnkaStatus(`文件解析失败：${err?.message || "格式有误"}`, "warn");
          renderEnkaPanel();
        }
      };
      reader.readAsText(f);
    };
    inp.click();
  });

  document.getElementById("enkaApplyTop3Btn")?.addEventListener("click", () => {
    const top3 = getSortedVaultAgents().slice(0, 3);
    if (!top3.length) return;
    appStore.state.slots = [0, 1, 2].map((i) =>
      top3[i] ? syncedRecordToSlotConfig(top3[i], makeDefaultSlot) : null
    );
    preventDuplicateSupportAuraSets();
    ensureTimelineInitialized(true);
    setEnkaStatus(
      `已将练度柜前 ${top3.length} 名代理人（${top3.map((r) => CHAR_MAP[r.cid]?.n || r.cid).join(" + ")}）整队带盘上阵！`,
      "ok"
    );
    triggerRefreshUI();
  });

  document.getElementById("enkaSyncOwnedBtn")?.addEventListener("click", () => {
    const cids = Object.keys(enkaVault.agents);
    if (!cids.length) return;
    appStore.state.ownedChars = cids;
    appStore.state.pickerTab = "finder";
    appStore.state.finderUseVault = true;
    setEnkaStatus(`已将练度柜 ${cids.length} 名角色同步至「01 我的Box智能搜队器」并启用真实面板搜队！`, "ok");
    triggerRefreshUI();
    document.getElementById("sec01")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("enkaClearVaultBtn")?.addEventListener("click", () => {
    clearEnkaVault();
    ENKA_UI_STATE.lastOptSummary = "";
    setEnkaStatus("已清空本地代理人练度柜与驱动盘池。", "info");
    triggerRefreshUI();
  });

  const exChk = document.getElementById("enkaExcludeEquippedChk") as HTMLInputElement | null;
  exChk?.addEventListener("change", () => {
    ENKA_UI_STATE.excludeTeammateDiscs = exChk.checked;
  });

  root.querySelectorAll<HTMLButtonElement>("[data-enka-opt-slot]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.enkaOptSlot);
      void optimizeSlotFromVaultPool(idx);
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-vault-equip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [cid, sStr] = (btn.dataset.vaultEquip || "").split(":");
      applyVaultRecordToSlot(cid, Number(sStr));
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-vault-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cid = btn.dataset.vaultRemove || "";
      if (cid && enkaVault.agents[cid]) {
        const name = CHAR_MAP[cid]?.n || cid;
        delete enkaVault.agents[cid];
        saveEnkaVaultToStorage();
        setEnkaStatus(`已从练度柜移除【${name}】（驱动盘池仍保留其历史驱动盘）。`, "info");
        triggerRefreshUI();
      }
    });
  });

  // Reference DISC_SETS so custom set names stay live
  void DISC_SETS;
}

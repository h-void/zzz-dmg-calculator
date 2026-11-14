import { STORAGE_ENKA_VAULT_KEY, deepClone } from "../data/store";
import { DEMO_ENKA_PAYLOAD, DEMO_ENKA_UID } from "./demoShowcase";
import { parseEnkaShowcasePayload } from "./parser";
import type { DiscPiece, EnkaVaultState, RawEnkaUidResponse, SyncedAgentRecord } from "../types";

export const enkaVault: EnkaVaultState = {
  lastUid: "",
  nickname: "",
  interKnotLv: 60,
  signature: "",
  region: "",
  ttlUntilMs: 0,
  agents: {},
  discPool: []
};

function discFingerprint(d: DiscPiece): string {
  if (d.uid) return String(d.uid);
  const subSig = Object.entries(d.subs || {})
    .filter(([, v]) => Number(v) > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${Number(v).toFixed(2)}`)
    .join(",");
  return `${d.slot || 0}|${d.set}|${d.main}|${d.level ?? 15}|${subSig}`;
}

export function mergeDiscsIntoPool(newDiscs: DiscPiece[]): number {
  const map = new Map<string, DiscPiece>();
  for (const existing of enkaVault.discPool) {
    map.set(discFingerprint(existing), existing);
  }
  const before = map.size;
  for (const d of newDiscs) {
    if (!d || (d.level === 0 && d.mainScale === 0)) continue;
    map.set(discFingerprint(d), deepClone(d));
  }
  enkaVault.discPool = [...map.values()];
  saveEnkaVaultToStorage();
  return Math.max(0, enkaVault.discPool.length - before);
}

export function ingestEnkaPayloadIntoVault(
  raw: RawEnkaUidResponse,
  fallbackUid = ""
): {
  uid: string;
  nickname: string;
  syncedCount: number;
  totalVaultAgents: number;
  newDiscsAdded: number;
  ttl: number;
} {
  const parsed = parseEnkaShowcasePayload(raw, fallbackUid);
  if (!parsed.records.length) {
    throw new Error("该账号当前未开启个人名片「代理人展柜」，或展柜内暂无角色。请在游戏内设置展柜后退出到标题界面刷新再试。");
  }

  enkaVault.lastUid = parsed.uid;
  enkaVault.nickname = parsed.nickname;
  enkaVault.interKnotLv = parsed.interKnotLv;
  enkaVault.signature = parsed.signature;
  enkaVault.region = parsed.region;
  enkaVault.ttlUntilMs = Date.now() + parsed.ttl * 1000;

  for (const rec of parsed.records) {
    enkaVault.agents[rec.cid] = rec;
  }
  const newDiscsAdded = mergeDiscsIntoPool(parsed.discs);
  saveEnkaVaultToStorage();

  return {
    uid: parsed.uid,
    nickname: parsed.nickname,
    syncedCount: parsed.records.length,
    totalVaultAgents: Object.keys(enkaVault.agents).length,
    newDiscsAdded,
    ttl: parsed.ttl
  };
}

export function loadDemoShowcaseIntoVault(): ReturnType<typeof ingestEnkaPayloadIntoVault> {
  return ingestEnkaPayloadIntoVault(deepClone(DEMO_ENKA_PAYLOAD), DEMO_ENKA_UID);
}

export function clearEnkaVault(): void {
  enkaVault.agents = {};
  enkaVault.discPool = [];
  enkaVault.nickname = "";
  enkaVault.signature = "";
  enkaVault.ttlUntilMs = 0;
  saveEnkaVaultToStorage();
}

export function loadEnkaVaultFromStorage(): void {
  try {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(STORAGE_ENKA_VAULT_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      enkaVault.lastUid = parsed.lastUid || "";
      enkaVault.nickname = parsed.nickname || "";
      enkaVault.interKnotLv = parsed.interKnotLv || 60;
      enkaVault.signature = parsed.signature || "";
      enkaVault.region = parsed.region || "";
      enkaVault.ttlUntilMs = parsed.ttlUntilMs || 0;
      enkaVault.agents = parsed.agents || {};
      enkaVault.discPool = Array.isArray(parsed.discPool) ? parsed.discPool : [];
    }
  } catch {
    // Ignore storage errors
  }
}

export function saveEnkaVaultToStorage(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_ENKA_VAULT_KEY, JSON.stringify(enkaVault));
  } catch {
    // Ignore quota errors
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 7500): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: ctrl.signal
    });
    const text = await resp.text();
    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`非 JSON 响应 (HTTP ${resp.status})`);
    }
    if (!resp.ok) {
      const msg = data?.message || `HTTP ${resp.status}`;
      const err = new Error(msg) as Error & { status?: number };
      err.status = resp.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Multi-endpoint resilient fetcher for GitHub Pages + Local Dev:
 * 1. Local Vite `/api/enka` dev proxy (when running on local dev server)
 * 2. Direct Enka endpoint (in case CORS headers are enabled)
 * 3. Public HTTPS CORS relays (zero-config fallback for GitHub Pages)
 */
export async function fetchEnkaShowcaseByUid(uidRaw: string): Promise<{
  via: string;
  summary: ReturnType<typeof ingestEnkaPayloadIntoVault>;
}> {
  const uid = String(uidRaw || "").trim();
  if (!/^\d{8,12}$/.test(uid)) {
    throw new Error("请输入有效的 8～10 位绝区零 UID（纯数字，如国服 10xxxxxxx 或国际服 15xxxxxxxx）。");
  }

  const targetEnkaUrl = `https://enka.network/api/zzz/uid/${uid}`;
  const candidates: Array<{ label: string; url: string }> = [];

  if (
    typeof window !== "undefined" &&
    ((import.meta as any).env?.DEV || location.hostname === "localhost" || location.hostname === "127.0.0.1")
  ) {
    candidates.push({ label: "本地开发直连代理", url: `/api/enka/zzz/uid/${uid}` });
  }

  candidates.push(
    { label: "Enka 官方直连", url: targetEnkaUrl },
    { label: "公共跨域中继 #1", url: `https://corsproxy.io/?url=${encodeURIComponent(targetEnkaUrl)}` },
    { label: "公共跨域中继 #2", url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetEnkaUrl)}` },
    { label: "公共跨域中继 #3", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(targetEnkaUrl)}` }
  );

  let lastErr: any = null;
  for (const cand of candidates) {
    try {
      const json = await fetchJsonWithTimeout(cand.url, 7500);
      if (json && json.PlayerInfo) {
        const summary = ingestEnkaPayloadIntoVault(json, uid);
        return { via: cand.label, summary };
      }
      if (json?.code === "not_found") {
        throw Object.assign(new Error(`未找到 UID ${uid} 对应的绳匠账号，请核对 UID 是否正确。`), { fatal: true });
      }
    } catch (err: any) {
      lastErr = err;
      if (err?.fatal || err?.status === 404 || err?.status === 429) {
        throw err;
      }
    }
  }

  throw new Error(
    `网络跨域请求受限 (${lastErr?.message || "连接超时"})。可直接点击「粘贴 Enka / 导入扫描器 JSON」手动导入！`
  );
}

export function getSortedVaultAgents(): SyncedAgentRecord[] {
  return Object.values(enkaVault.agents).sort((a, b) => b.effectiveRollsTotal - a.effectiveRollsTotal);
}

loadEnkaVaultFromStorage();

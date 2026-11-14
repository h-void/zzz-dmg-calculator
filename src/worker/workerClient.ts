import { BANGBOO_MAP, CHAR_MAP, DISC_SETS, SC_WEPS, STAGE_BUFFS } from "../data/store";
import type { DiscPiece, EnvConfig, SlotConfig, WorkerRequest, WorkerResponse } from "../types";

let workerInstance: Worker | null = null;
let seqId = 1;
const pending = new Map<
  number,
  { resolve: (val: { result: any; elapsedMs: number }) => void; reject: (err: Error) => void }
>();

function getWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  if (!workerInstance) {
    workerInstance = new Worker(new URL("./calc.worker.ts", import.meta.url), { type: "module" });
    workerInstance.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      const msg = ev.data;
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      updatePerfBadge(`Worker 后台: ${msg.elapsedMs} ms`);
      if (msg.ok) {
        entry.resolve({ result: msg.result, elapsedMs: msg.elapsedMs });
      } else {
        entry.reject(new Error((msg as { error: string }).error));
      }
    };
    workerInstance.onerror = (err) => {
      for (const [, entry] of pending) {
        entry.reject(new Error(err.message || "Worker 执行错误"));
      }
      pending.clear();
    };
  }
  return workerInstance;
}

export function updatePerfBadge(text: string): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById("workerPerfBadge");
  if (el) el.textContent = text;
}

export function runWorkerFindViableTeams(
  anchorCid: string,
  ownedIds: string[] | null,
  env: EnvConfig,
  options: {
    requireAllAA?: boolean;
    useF2PWeps?: boolean;
    maxSGold?: number;
    limit?: number;
    syncedSlotsByCid?: Record<string, Partial<SlotConfig>>;
  }
): Promise<{ result: any[]; elapsedMs: number }> {
  const w = getWorker();
  if (!w) {
    return Promise.reject(new Error("当前环境不支持 Web Worker"));
  }
  const id = seqId++;
  const req: WorkerRequest = {
    id,
    type: "FIND_VIABLE_TEAMS",
    payload: {
      anchorCid,
      ownedIds,
      env,
      chars: CHAR_MAP,
      weps: SC_WEPS,
      discSets: DISC_SETS,
      bangboos: BANGBOO_MAP,
      stageBuffs: STAGE_BUFFS,
      options
    }
  };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage(req);
  });
}

export function runWorkerOptimizeSlotFromPool(
  slots: Array<SlotConfig | null>,
  targetSlotIdx: number,
  discPool: DiscPiece[],
  excludeEquippedByOthers: boolean,
  env: EnvConfig
): Promise<{
  result: {
    bestPieces: DiscPiece[];
    fourPc: string;
    twoPc: string;
    evaluatedCount: number;
    poolSizeUsed: number;
    beforeTeamDps: number;
    afterTeamDps: number;
    dpsGainPct: number;
  };
  elapsedMs: number;
}> {
  const w = getWorker();
  if (!w) {
    return Promise.reject(new Error("当前环境不支持 Web Worker"));
  }
  const id = seqId++;
  const req: WorkerRequest = {
    id,
    type: "OPTIMIZE_SLOT_FROM_POOL",
    payload: {
      slots,
      targetSlotIdx,
      discPool,
      excludeEquippedByOthers,
      env,
      chars: CHAR_MAP,
      weps: SC_WEPS,
      discSets: DISC_SETS,
      bangboos: BANGBOO_MAP,
      stageBuffs: STAGE_BUFFS
    }
  };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage(req);
  });
}

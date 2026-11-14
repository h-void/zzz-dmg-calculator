import { CHAR_MAP, SC_WEPS, deepClone, hydrateWorkerRegistries } from "../data/store";
import { findViableTeams, simulateTeamV2 } from "../engine/simulator";
import { getEffectiveSubWeightsForAgent } from "../enka/mappings";
import type { DiscPiece, DiscSubKey, SlotConfig, WorkerRequest, WorkerResponse } from "../types";

function scorePieceForChar(p: DiscPiece, weights: Record<DiscSubKey, number>, chEb: string): number {
  let sc = 0;
  for (const [k, v] of Object.entries(p.subs || {})) {
    sc += (Number(v) || 0) * (weights[k as DiscSubKey] || 0);
  }
  const ms = p.mainScale ?? 1.0;
  sc += (ms - 1.0) * 6.0;
  if (p.main === "ELEM" && p.elemType && p.elemType !== chEb && !(p.elemType === "Ether" && chEb === "Lumiflux")) {
    sc -= 12.0; // Heavy penalty for wrong element main stat on Slot 5
  }
  return sc;
}

function optimizeSlotFromDiscPool(payload: Extract<WorkerRequest, { type: "OPTIMIZE_SLOT_FROM_POOL" }>["payload"]) {
  const { slots, targetSlotIdx, discPool, excludeEquippedByOthers, env } = payload;
  const targetSlot = slots[targetSlotIdx];
  if (!targetSlot || !targetSlot.cid || !CHAR_MAP[targetSlot.cid]) {
    throw new Error("目标槽位未选择有效代理人");
  }
  const ch = CHAR_MAP[targetSlot.cid];
  const weights = getEffectiveSubWeightsForAgent(ch);

  // Collect UIDs currently worn by the OTHER two team slots so they don't collide
  const forbiddenUids = new Set<string>();
  if (excludeEquippedByOthers) {
    slots.forEach((sl, idx) => {
      if (idx === targetSlotIdx || !sl || sl.buildMode !== "pieces" || !Array.isArray(sl.pieces)) return;
      for (const pc of sl.pieces) {
        if (pc?.uid) forbiddenUids.add(String(pc.uid));
      }
    });
  }

  // Partition available discs by slot 1..6
  const bySlot: DiscPiece[][] = [[], [], [], [], [], []];
  for (const d of discPool) {
    if (!d) continue;
    if (d.uid && forbiddenUids.has(String(d.uid))) continue;
    const sIdx = Math.max(0, Math.min(5, (Number(d.slot) || 1) - 1));
    bySlot[sIdx].push(d);
  }

  // Fallback to current piece in that slot if pool lacks any piece for a slot
  for (let i = 0; i < 6; i++) {
    if (bySlot[i].length === 0) {
      const fallback = targetSlot.pieces?.[i] || {
        slot: i + 1,
        set: ch.def4pc || "啄木",
        main: i === 0 ? "HP_FLAT" : i === 1 ? "ATK_FLAT" : i === 2 ? "DEF_FLAT" : i === 3 ? "CR" : i === 4 ? "ELEM" : "ATK%",
        level: 15,
        rarity: 4,
        mainScale: 1.0,
        subs: { CR: 0, CD: 0, "ATK%": 0, ATK_FLAT: 0, "HP%": 0, HP_FLAT: 0, "DEF%": 0, DEF_FLAT: 0, AP: 0, PEN: 0 }
      };
      bySlot[i].push(fallback);
    }
  }

  // Prune strictly dominated pieces within identical (slot, set, main, elemMatch) bucket -> keep #1 best per bucket!
  const prunedBySlot: DiscPiece[][] = bySlot.map((list, sIdx) => {
    const bestPerBucket = new Map<string, { piece: DiscPiece; score: number }>();
    for (const p of list) {
      const elemTag = p.main === "ELEM" ? (p.elemType === ch.eb || (p.elemType === "Ether" && ch.eb === "Lumiflux") || !p.elemType ? "MATCH" : "MISMATCH") : "";
      const key = `${p.set}|${p.main}|${elemTag}`;
      const sc = scorePieceForChar(p, weights, ch.eb);
      const prev = bestPerBucket.get(key);
      if (!prev || sc > prev.score) {
        bestPerBucket.set(key, { piece: p, score: sc });
      }
    }
    const sorted = [...bestPerBucket.values()].sort((a, b) => b.score - a.score).map((x) => x.piece);
    // Keep top candidates per slot (tighter on 1-3 where main stat is fixed, wider on 4-6 where main stats vary)
    return sorted.slice(0, sIdx < 3 ? 6 : 8);
  });

  const baselineSim = simulateTeamV2(slots, env, CHAR_MAP, SC_WEPS, { skipSoloBaseline: true });
  let bestPieces: DiscPiece[] | null = null;
  let bestDps = -1;
  let evaluatedCount = 0;
  const MAX_EVALS = 4500;

  const workSlots: Array<SlotConfig | null> = deepClone(slots);
  const candidateSlotCfg = workSlots[targetSlotIdx]!;
  candidateSlotCfg.buildMode = "pieces";
  candidateSlotCfg.discAuto = false;
  candidateSlotCfg.subAuto = false;

  const [s0, s1, s2, s3, s4, s5] = prunedBySlot;

  outer: for (const p0 of s0) {
    for (const p1 of s1) {
      for (const p2 of s2) {
        for (const p3 of s3) {
          for (const p4 of s4) {
            for (const p5 of s5) {
              candidateSlotCfg.pieces = [p0, p1, p2, p3, p4, p5];
              const sim = simulateTeamV2(workSlots, env, CHAR_MAP, SC_WEPS, { fastMode: true, skipSoloBaseline: true });
              evaluatedCount++;
              const metricVal = env.metricMode === "dpr" ? sim.teamDpr : sim.teamDps;
              const bestMetric = bestDps;
              if (metricVal > bestMetric) {
                bestDps = metricVal;
                bestPieces = [p0, p1, p2, p3, p4, p5];
              }
              if (evaluatedCount >= MAX_EVALS) break outer;
            }
          }
        }
      }
    }
  }

  if (!bestPieces) {
    throw new Error("未能在驱动盘池中找到有效组合");
  }

  const finalSlots: Array<SlotConfig | null> = deepClone(slots);
  const fSlot = finalSlots[targetSlotIdx]!;
  fSlot.buildMode = "pieces";
  fSlot.discAuto = false;
  fSlot.subAuto = false;
  fSlot.pieces = deepClone(bestPieces);

  // Update fourPc / twoPc summary labels
  const setCounts: Record<string, number> = {};
  for (const p of bestPieces) {
    if (p.set && p.set !== "无") setCounts[p.set] = (setCounts[p.set] || 0) + 1;
  }
  let fourPc = "无";
  const twoPcs: string[] = [];
  for (const [sid, cnt] of Object.entries(setCounts)) {
    if (cnt >= 4) fourPc = sid;
    if (cnt >= 2) twoPcs.push(sid);
  }
  fSlot.fourPc = fourPc;
  fSlot.twoPc = twoPcs.find((s) => s !== fourPc) || twoPcs[0] || "无";
  fSlot.d4 = bestPieces[3]?.main || "CR";
  fSlot.d5 = bestPieces[4]?.main || "ELEM";
  fSlot.d6 = bestPieces[5]?.main || "ATK%";

  const optimizedSim = simulateTeamV2(finalSlots, env, CHAR_MAP, SC_WEPS, { skipSoloBaseline: true });

  return {
    bestPieces,
    fourPc: fSlot.fourPc,
    twoPc: fSlot.twoPc,
    evaluatedCount,
    poolSizeUsed: discPool.length - forbiddenUids.size,
    beforeTeamDps: baselineSim.teamDps,
    afterTeamDps: optimizedSim.teamDps,
    dpsGainPct: baselineSim.teamDps > 0 ? optimizedSim.teamDps / baselineSim.teamDps - 1 : 0
  };
}

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  const t0 = performance.now();
  try {
    hydrateWorkerRegistries(req.payload);

    if (req.type === "FIND_VIABLE_TEAMS") {
      const { anchorCid, ownedIds, env, options } = req.payload;
      const ownedSet = ownedIds ? new Set(ownedIds) : null;
      const teams = findViableTeams(anchorCid, ownedSet, env, CHAR_MAP, SC_WEPS, options);
      const resp: WorkerResponse = {
        id: req.id,
        ok: true,
        elapsedMs: Number((performance.now() - t0).toFixed(1)),
        result: teams
      };
      self.postMessage(resp);
      return;
    }

    if (req.type === "OPTIMIZE_SLOT_FROM_POOL") {
      const optRes = optimizeSlotFromDiscPool(req.payload);
      const resp: WorkerResponse = {
        id: req.id,
        ok: true,
        elapsedMs: Number((performance.now() - t0).toFixed(1)),
        result: optRes
      };
      self.postMessage(resp);
      return;
    }
  } catch (err: any) {
    const resp: WorkerResponse = {
      id: req.id,
      ok: false,
      elapsedMs: Number((performance.now() - t0).toFixed(1)),
      error: err?.message || String(err)
    };
    self.postMessage(resp);
  }
};

import {
  DEFAULT_BANGBOOS,
  DEFAULT_CHARS,
  DEFAULT_DISC_SETS,
  DEFAULT_PRESET_TEAMS,
  DEFAULT_STAGE_BUFFS,
  DEFAULT_UNIVERSAL_SHELLS,
  DEFAULT_WEPS
} from "./defaults";
import type {
  AgentDef,
  BangbooDef,
  DiscSetDef,
  PresetTeamDef,
  StageBuffDef,
  UniversalShellDef,
  WEngineDef
} from "../types";

export const STORAGE_CUSTOM_DB_KEY = "zzz_v33_custom_db_v2";
export const STORAGE_WORKSPACE_KEY = "zzz_v33_workspace_state_v2";
export const STORAGE_ENKA_VAULT_KEY = "zzz_v33_enka_vault_v1";

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export let SC_CHARS: AgentDef[] = deepClone(DEFAULT_CHARS);
export let SC_WEPS: Record<string, WEngineDef> = deepClone(DEFAULT_WEPS);
export let DISC_SETS: Record<string, DiscSetDef> = deepClone(DEFAULT_DISC_SETS);
export let BANGBOOS: BangbooDef[] = deepClone(DEFAULT_BANGBOOS);
export let STAGE_BUFFS: Record<string, StageBuffDef> = deepClone(DEFAULT_STAGE_BUFFS);
export let PRESET_TEAMS: PresetTeamDef[] = deepClone(DEFAULT_PRESET_TEAMS);
export let UNIVERSAL_SHELLS: UniversalShellDef[] = deepClone(DEFAULT_UNIVERSAL_SHELLS);

export let CHAR_MAP: Record<string, AgentDef> = {};
export let WEP_LIST: WEngineDef[] = [];
export let BANGBOO_MAP: Record<string, BangbooDef> = {};
export let NON_LIM_S_CHARS: Set<string> = new Set();
export let NON_LIM_S_WEPS: Set<string> = new Set();

export interface CustomDatabase {
  chars: Record<string, AgentDef>;
  deletedChars: string[];
  weps: Record<string, WEngineDef>;
  discSets: Record<string, DiscSetDef>;
  bangboos: Record<string, BangbooDef>;
  stageBuffs: Record<string, StageBuffDef>;
  presetTeams: PresetTeamDef[];
}

export const customDB: CustomDatabase = {
  chars: {},
  deletedChars: [],
  weps: {},
  discSets: {},
  bangboos: {},
  stageBuffs: {},
  presetTeams: []
};

export function rebuildDataMaps(): void {
  const baseChars = deepClone(DEFAULT_CHARS).filter((c) => !customDB.deletedChars.includes(c.id));
  const charById = new Map<string, AgentDef>(baseChars.map((c) => [c.id, c]));
  Object.values(customDB.chars || {}).forEach((c) => {
    if (c && c.id) charById.set(c.id, deepClone(c));
  });
  SC_CHARS = [...charById.values()];
  CHAR_MAP = Object.fromEntries(SC_CHARS.map((c) => [c.id, c]));

  SC_WEPS = deepClone(DEFAULT_WEPS);
  Object.values(customDB.weps || {}).forEach((w) => {
    if (w && w.id) SC_WEPS[w.id] = deepClone(w);
  });
  WEP_LIST = Object.values(SC_WEPS);

  DISC_SETS = deepClone(DEFAULT_DISC_SETS);
  Object.values(customDB.discSets || {}).forEach((ds) => {
    if (ds && ds.id) DISC_SETS[ds.id] = deepClone(ds);
  });

  const bbMap = new Map<string, BangbooDef>(deepClone(DEFAULT_BANGBOOS).map((b) => [b.id, b]));
  Object.values(customDB.bangboos || {}).forEach((b) => {
    if (b && b.id) bbMap.set(b.id, deepClone(b));
  });
  BANGBOOS = [...bbMap.values()];
  BANGBOO_MAP = Object.fromEntries(BANGBOOS.map((b) => [b.id, b]));

  STAGE_BUFFS = deepClone(DEFAULT_STAGE_BUFFS);
  Object.values(customDB.stageBuffs || {}).forEach((sb) => {
    if (sb && sb.id) STAGE_BUFFS[sb.id] = deepClone(sb);
  });

  PRESET_TEAMS = [
    ...(customDB.presetTeams || []).map((p) => deepClone(p)),
    ...deepClone(DEFAULT_PRESET_TEAMS)
  ];

  NON_LIM_S_CHARS = new Set(SC_CHARS.filter((c) => c.isFreeS).map((c) => c.id));
  NON_LIM_S_WEPS = new Set(WEP_LIST.filter((w) => w.isFreeS).map((w) => w.id));
}

/**
 * Used inside Web Worker to synchronize live custom registries passed from main thread
 */
export function hydrateWorkerRegistries(payload: {
  chars: Record<string, AgentDef>;
  weps: Record<string, WEngineDef>;
  discSets: Record<string, DiscSetDef>;
  bangboos: Record<string, BangbooDef>;
  stageBuffs: Record<string, StageBuffDef>;
}): void {
  CHAR_MAP = payload.chars;
  SC_CHARS = Object.values(CHAR_MAP);
  SC_WEPS = payload.weps;
  WEP_LIST = Object.values(SC_WEPS);
  DISC_SETS = payload.discSets;
  BANGBOO_MAP = payload.bangboos;
  BANGBOOS = Object.values(BANGBOO_MAP);
  STAGE_BUFFS = payload.stageBuffs;
  NON_LIM_S_CHARS = new Set(SC_CHARS.filter((c) => c.isFreeS).map((c) => c.id));
  NON_LIM_S_WEPS = new Set(WEP_LIST.filter((w) => w.isFreeS).map((w) => w.id));
}

export function loadCustomDBFromStorage(): void {
  try {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(STORAGE_CUSTOM_DB_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      customDB.chars = parsed.chars || {};
      customDB.deletedChars = parsed.deletedChars || [];
      customDB.weps = parsed.weps || {};
      customDB.discSets = parsed.discSets || {};
      customDB.bangboos = parsed.bangboos || {};
      customDB.stageBuffs = parsed.stageBuffs || {};
      customDB.presetTeams = Array.isArray(parsed.presetTeams) ? parsed.presetTeams : [];
    }
  } catch {
    // Ignore malformed storage
  }
}

export function saveCustomDBToStorage(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_CUSTOM_DB_KEY, JSON.stringify(customDB));
  } catch {
    // Ignore quota errors
  }
}

loadCustomDBFromStorage();
rebuildDataMaps();

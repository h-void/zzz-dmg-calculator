export type ElementCode = "Physical" | "Fire" | "Ice" | "Electric" | "Ether" | "Wind" | "Lumiflux";
export type SpecialtyCode = "Attack" | "Anomaly" | "Rupture" | "Armorer" | "Stun" | "Support" | "Defense";
export type DiscMainCode =
  | "HP_FLAT"
  | "ATK_FLAT"
  | "DEF_FLAT"
  | "CR"
  | "CD"
  | "AP"
  | "ATK%"
  | "HP%"
  | "DEF%"
  | "ELEM"
  | "PEN"
  | "AM"
  | "IMP"
  | "ER";

export type DiscSubKey =
  | "CR"
  | "CD"
  | "ATK%"
  | "ATK_FLAT"
  | "HP%"
  | "HP_FLAT"
  | "DEF%"
  | "DEF_FLAT"
  | "AP"
  | "PEN";

export interface DiscPiece {
  uid?: string | number;
  slot?: number; // 1..6
  set: string;   // e.g. "啄木", "沧浪"
  main: DiscMainCode | string;
  elemType?: ElementCode;
  level?: number;    // 0..15 (defaults to 15)
  rarity?: number;   // 4=S, 3=A, 2=B (defaults to 4)
  mainScale?: number; // Exact ratio relative to S-rank Lv.15 main stat (defaults to 1.0)
  subs: Record<string, number>; // S-rank equivalent substat roll counts
  rawSubs?: Array<{ key: DiscSubKey; rolls: number; displayVal: string }>;
  equippedBy?: string; // Agent ID if known
}

export interface AgentDef {
  id: string;
  n: string;
  r: "S" | "A";
  wt: SpecialtyCode | string;
  p: string;
  e: string;
  eb: ElementCode | string;
  sig: string;
  pot?: number;
  hp: number;
  atk: number;
  def: number;
  cp_hp?: number;
  cp_atk?: number;
  cr: number;
  cd: number;
  scd?: number;
  pen: number;
  imp: number;
  am: number;
  ap: number;
  er: number;
  prof?: Record<string, any>;
  m_rec?: string;
  m_stages?: Array<Record<string, any>>;
  base_disc?: string;
  cands?: string[];
  anomBar?: string;
  campId?: string;
  camp: string;
  defAssist?: boolean;
  def4pc: string;
  def2pc: string;
  aa?: {
    roles?: string[];
    sameElem?: boolean;
    sameCamp?: boolean;
    needDefAssist?: boolean;
    condText?: string;
    effText?: string;
  };
  mvScale?: number;
  isFreeS?: boolean;
  swapProfile?: Record<string, any>;
  customBuffs?: Record<string, any>;
  [key: string]: any;
}

export interface WEngineDef {
  id: string;
  n: string;
  r: "S" | "A" | "B";
  wt: SpecialtyCode | string;
  p: string;
  batk: number;
  bdef?: number;
  sn: string;
  sv: number;
  isFreeS?: boolean;
  descR1?: string;
  descR5?: string;
  customMods?: Record<string, any>;
  [key: string]: any;
}

export interface DiscSetDef {
  id: string;
  name: string;
  cat: string;
  d2: string;
  d4: string;
  roleReq?: string;
  maxStacks?: number;
  customEffects?: Record<string, any>;
  [key: string]: any;
}

export interface BangbooDef {
  id: string;
  n: string;
  r: "S" | "A" | "-";
  elem: string;
  camp: string;
  dazeBonus: number;
  teamDmg: number;
  teamAtkFlat: number;
  teamAp: number;
  teamSheer: number;
  erFlat: number;
  elemBuildup: Record<string, number>;
  chainMv: number;
  desc: string;
  [key: string]: any;
}

export interface StageBuffDef {
  id: string;
  name: string;
  desc?: string;
  [key: string]: any;
}

export interface PresetTeamDef {
  id: string;
  cat: string;
  tag: string;
  name: string;
  desc: string;
  bangboo?: string;
  slots: Array<[string, number, string, number, string?]>;
  fullSlots?: Array<SlotConfig | null>;
  swapConfig?: SwapConfig | null;
  [key: string]: any;
}

export interface UniversalShellDef {
  id: string;
  name?: string;
  label?: string;
  tag?: string;
  hint?: string;
  desc?: string;
  defCarry: string;
  pair: Array<[string, number, string, number, string?]>;
  [key: string]: any;
}

export interface SlotConfig {
  cid: string;
  m: number;
  wid: string;
  ref: number;
  fourPc: string;
  twoPc: string;
  buildMode: "auto" | "pieces" | "panel";
  discAuto: boolean;
  d4: string;
  d5: string;
  d6: string;
  subAuto: boolean;
  rolls: number;
  subRollCap: number;
  sub: Record<string, number>;
  activePieceIdx: number;
  pieces: DiscPiece[] | null;
  panel: Record<string, any> | null;
  uptime: number;
  fourPcUptime: number;
  wepUptime: number;
  allowCrossWep: boolean;
  agentLv: number;
  wepLv: number;
  skillLv: number;
  coreLv: number;
  aaMode: string;
  potOverride: string;
  weightMode: string;
  weight: number;
  mvMult: number;
  stunShareOverride: number | null;
  customSharesEnabled: boolean;
  customShares: Record<string, number> | null;
  customAnomSplitEnabled: boolean;
  customAnomSplit: Record<string, number> | null;
  slotExtra: Record<string, number>;
  enkaSourceUid?: string;
}

export interface SwapConfig {
  presetId?: string;
  preset?: string;
  swapCancelRate?: number;
  dodgeSafetyRate?: number;
  parryDoubleRate?: number;
  manualChainCancel?: boolean;
  disorderPreload99?: boolean;
  assistBudgetMax?: number;
  reactionTaxMs?: number;
  useCustomTimeline?: boolean;
  [key: string]: any;
}

export interface TimelineBlock {
  uid?: string;
  id?: string;
  slotIdx: number;
  cid: string;
  moveId?: string;
  startSec: number;
  [key: string]: any;
}

export interface EnvConfig {
  metricMode: "dps" | "dpr";
  stageBuffId?: string;
  stageId?: string;
  bangbooId: string;
  elemResMap: Record<string, number>;
  enemyDef: number;
  stunMultBase: number;
  dazeThreshold: number;
  stunDurationBase: number;
  anomThresholdScale: number;
  disorderSec: number;
  miasmaFactor: number;
  rollBudget: number;
  stunPhysicsMode: string;
  highAggro: boolean;
  potAwakening: boolean;
  er2pcCountsInit: boolean;
  swapConfig: SwapConfig;
  timelineBlocks?: TimelineBlock[];
  [key: string]: any;
}

/* ---------------- Enka.Network ZZZ Showcase Types ---------------- */

export interface RawEnkaProperty {
  PropertyId: number;
  PropertyLevel?: number;
  PropertyValue: number;
  [key: string]: any;
}

export interface RawEnkaEquipment {
  Slot: number; // 1..6
  Equipment: {
    Id: number;
    Uid?: number | string;
    Level: number;
    BreakLevel?: number;
    Exp?: number;
    IsLocked?: boolean;
    MainPropertyList?: RawEnkaProperty[];
    MainStatList?: RawEnkaProperty[];
    RandomPropertyList?: RawEnkaProperty[];
    [key: string]: any;
  };
  [key: string]: any;
}

export interface RawEnkaAvatar {
  Id: number;
  Level: number;
  PromotionLevel?: number;
  TalentLevel?: number; // 0..6 Mindscape
  CoreSkillEnhancement?: number; // 0..6 Core A-F
  SkillLevelList?: Array<{ Index: number; Level: number }>;
  Weapon?: {
    Id: number;
    Uid?: number | string;
    Level: number;
    Exp?: number;
    BreakLevel?: number;
    UpgradeLevel?: number; // 1..5 Refinement
    [key: string]: any;
  };
  EquippedList?: RawEnkaEquipment[];
  [key: string]: any;
}

export interface RawEnkaUidResponse {
  uid?: string | number;
  ttl?: number;
  region?: string;
  PlayerInfo?: {
    SocialDetail?: {
      Desc?: string;
      ProfileDetail?: {
        Uid?: number | string;
        Nickname?: string;
        Level?: number;
        [key: string]: any;
      };
      [key: string]: any;
    };
    ShowcaseDetail?: {
      AvatarList?: RawEnkaAvatar[];
      [key: string]: any;
    };
    [key: string]: any;
  };
  [key: string]: any;
}

export type DiscGradeTier = "ACE" | "SSS" | "SS" | "S" | "A" | "B";

export interface ScoredPieceSummary {
  slot: number;
  set: string;
  setName: string;
  main: string;
  mainZh: string;
  level: number;
  rarity: number;
  effectiveRolls: number;
  totalRolls: number;
  grade: DiscGradeTier;
}

export interface SyncedAgentRecord {
  uid: string;
  cid: string;
  agentLv: number;
  m: number;
  coreLv: number;
  skillLv: number;
  wid: string;
  wepLv: number;
  ref: number;
  fourPc: string;
  twoPc: string;
  pieces: DiscPiece[];
  pieceSummaries: ScoredPieceSummary[];
  effectiveRollsTotal: number;
  rawRollsTotal: number;
  overallGrade: DiscGradeTier;
  updatedAt: string;
}

export interface EnkaVaultState {
  lastUid: string;
  nickname: string;
  interKnotLv: number;
  signature: string;
  region: string;
  ttlUntilMs: number;
  agents: Record<string, SyncedAgentRecord>; // key: `${uid}:${cid}` or `cid`
  discPool: DiscPiece[]; // Deduplicated discs from Enka showcase & third-party JSON scanners
}

/* ---------------- Web Worker RPC Types ---------------- */

export type WorkerRequest =
  | {
      id: number;
      type: "FIND_VIABLE_TEAMS";
      payload: {
        anchorCid: string;
        ownedIds: string[] | null;
        env: EnvConfig;
        chars: Record<string, AgentDef>;
        weps: Record<string, WEngineDef>;
        discSets: Record<string, DiscSetDef>;
        bangboos: Record<string, BangbooDef>;
        stageBuffs: Record<string, StageBuffDef>;
        options: {
          requireAllAA?: boolean;
          useF2PWeps?: boolean;
          maxSGold?: number;
          limit?: number;
          syncedSlotsByCid?: Record<string, Partial<SlotConfig>>;
        };
      };
    }
  | {
      id: number;
      type: "OPTIMIZE_SLOT_FROM_POOL";
      payload: {
        slots: Array<SlotConfig | null>;
        targetSlotIdx: number;
        discPool: DiscPiece[];
        excludeEquippedByOthers: boolean;
        env: EnvConfig;
        chars: Record<string, AgentDef>;
        weps: Record<string, WEngineDef>;
        discSets: Record<string, DiscSetDef>;
        bangboos: Record<string, BangbooDef>;
        stageBuffs: Record<string, StageBuffDef>;
      };
    };

export type WorkerResponse =
  | {
      id: number;
      ok: true;
      elapsedMs: number;
      result: any;
    }
  | {
      id: number;
      ok: false;
      elapsedMs: number;
      error: string;
    };

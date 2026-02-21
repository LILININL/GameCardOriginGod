export type Faction = "HEAVEN" | "DEMON" | "NEUTRAL";

export type Race =
  | "HUMAN"
  | "ANGEL"
  | "BEASTKIN"
  | "MACHINE"
  | "DRAGONKIN"
  | "DEMON"
  | "UNDEAD"
  | "ABYSSAL"
  | "NONE";

export type ClassTag =
  | "WARRIOR"
  | "ARCHER"
  | "MAGE"
  | "PRIEST"
  | "ASSASSIN"
  | "TANK"
  | "SUPPORT";

export type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
export type Kind = "KING" | "COMMANDER" | "DECK_CARD";

export type DeckCardType =
  | "UNIT"
  | "SPELL_GENERIC"
  | "SPELL_CLASS"
  | "SKILL_RACE"
  | "SKILL_SIDE";

export type RangeType = "MELEE" | "RANGED";
export type Deployment = "FRONT_ONLY" | "BACK_ONLY" | "ANY";

export type Keyword =
  | "TAUNT"
  | "RUSH"
  | "LIFESTEAL"
  | "WARD"
  | "SNIPER"
  | "SILENCED"
  | "SHIELD";

export interface LocalizedText {
  th: string;
  en: string;
}

export interface Cost {
  mana: number;
  sideStacks: number;
}

export interface Requirements {
  requiresClassOnBoard?: ClassTag[];
  requiresRaceOnBoard?: Race[];
  requiresFaction?: Faction;
  requiresKingRace?: Race;
  minCombo?: number;
  minSideStacks?: number;
}

export type ConditionType =
  | "ALLY_CLASS_COUNT_AT_LEAST"
  | "ALLY_RACE_COUNT_AT_LEAST"
  | "COMBO_AT_LEAST"
  | "ENEMY_FRONT_EMPTY"
  | "TARGET_IS_DAMAGED"
  | "SIDE_STACK_AT_LEAST"
  | "KILL_COUNT_THIS_TURN_AT_LEAST"
  | "KING_RACE_IS";

export interface Condition {
  type: ConditionType;
  value?: number;
  classTag?: ClassTag;
  race?: Race;
}

export type TargetOwner = "SELF" | "ALLY" | "ENEMY" | "BOTH" | "NONE";
export type TargetZone =
  | "NONE"
  | "KING"
  | "COMMANDER"
  | "BOARD_FRONT"
  | "BOARD_BACK"
  | "BOARD_ANY"
  | "UNIT_ANY"
  | "HAND"
  | "DECK"
  | "DISCARD";

export type TargetSelector =
  | "NONE"
  | "CHOSEN"
  | "RANDOM"
  | "ALL"
  | "LOWEST_HP"
  | "HIGHEST_ATK"
  | "SAME_COLUMN"
  | "LEFTMOST"
  | "RIGHTMOST"
  | "THIS";

export interface CardTarget {
  owner: TargetOwner;
  zone: TargetZone;
  selector: TargetSelector;
  count?: number;
  allowKing?: boolean;
}

export type AbilityTrigger =
  | "ON_PLAY"
  | "ON_CAST"
  | "ON_SUMMON"
  | "ON_ATTACK"
  | "ON_HIT"
  | "ON_KILL"
  | "ON_DEATH"
  | "TURN_START"
  | "TURN_END"
  | "STATIC"
  | "ON_ULTIMATE"
  | "ON_ACTIVATE_AURA";

export type AbilityOp =
  | "DEAL_DAMAGE"
  | "HEAL"
  | "BUFF_ATK"
  | "BUFF_HP"
  | "DRAW_CARD"
  | "SUMMON_TOKEN"
  | "GRANT_KEYWORD"
  | "REMOVE_KEYWORD"
  | "GAIN_SIDE_STACK"
  | "GAIN_COMBO"
  | "REDUCE_NEXT_TYPE_COST"
  | "SILENCE"
  | "DESTROY"
  | "RESTORE_MANA";

export type AbilityDuration = "INSTANT" | "END_OF_TURN" | "PERMANENT" | "N_TURNS";

export interface Ability {
  id: string;
  trigger: AbilityTrigger;
  op: AbilityOp;
  target: CardTarget;
  amount?: number;
  drawCount?: number;
  keyword?: Keyword;
  duration?: AbilityDuration;
  turns?: number;
  condition?: Condition;
  cardRef?: string;
  appliesToCardTypes?: DeckCardType[];
  notes?: string;
}

export interface Ultimate {
  name: LocalizedText;
  usesPerGame: 1;
  unlockTurnMin: number;
  effects: Ability[];
}

export interface Aura {
  burst: Ability[];
  pulse: Ability[];
  pulseCooldownTurns: number;
}

export interface BaseCard {
  id: string;
  set: string;
  version: number;
  kind: Kind;
  name: LocalizedText;
  description: LocalizedText;
  faction: Faction;
  race: Race;
  classTags: ClassTag[];
  rarity: Rarity;
  collectible?: boolean;
  token?: boolean;
  releaseOrder?: number;
  artKey?: string;
  tags: string[];
}

export interface KingCard extends BaseCard {
  kind: "KING";
  hp: number;
  ultimate: Ultimate;
  allowedFactionsInDeck: Faction[];
  forbiddenCardTypes?: DeckCardType[];
}

export interface CommanderCard extends BaseCard {
  kind: "COMMANDER";
  cost: Cost;
  attack: number;
  hp: number;
  rangeType: RangeType;
  deployment: Deployment;
  aura: Aura;
}

export interface DeckCard extends BaseCard {
  kind: "DECK_CARD";
  cardType: DeckCardType;
  cost: Cost;
  requirements?: Requirements;
  attack?: number;
  hp?: number;
  rangeType?: RangeType;
  deployment?: Deployment;
  abilities?: Ability[];
  maxCopies: number;
}

export type Card = KingCard | CommanderCard | DeckCard;

export type PlayerId = "P1" | "P2";
export type SlotId = "F1" | "F2" | "F3" | "B1" | "B2" | "B3";
export type FrontSlotId = "F1" | "F2" | "F3";
export type BackSlotId = "B1" | "B2" | "B3";

export type Phase = "MAIN" | "BATTLE" | "END";
export type MatchStatus = "LOBBY" | "IN_PROGRESS" | "ENDED";
export type AuraMode = "BURST" | "PULSE";
export type PlayerControl = "HUMAN" | "AI";
export type AiDifficulty = "EASY" | "NORMAL" | "HARD";

export interface UnitInstance {
  instanceId: string;
  owner: PlayerId;
  sourceCardId: string;
  cardType: "UNIT" | "COMMANDER";
  attack: number;
  hp: number;
  maxHp: number;
  rangeType: RangeType;
  deployment: Deployment;
  classTags: ClassTag[];
  race: Race;
  faction: Faction;
  keywords: Keyword[];
  silenced: boolean;
  canAttack: boolean;
  attacksUsed: number;
  justSummoned: boolean;
}

export interface HandCard {
  handId: string;
  card: DeckCard;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  king: KingCard;
  kingHp: number;
  kingMaxHp: number;
  ultimateUsed: boolean;
  commander: CommanderCard;
  commanderAuraMode: AuraMode;
  commanderBurstUsed: boolean;
  commanderPulseCooldown: number;
  commanderInstanceId: string | null;
  mana: {
    current: number;
    max: number;
  };
  sideStacks: number;
  combo: number;
  comboLastCardType: DeckCardType | null;
  nextNonUnitDiscount: number;
  killCountThisTurn: number;
  deck: DeckCard[];
  hand: HandCard[];
  graveyard: DeckCard[];
  fatigue: number;
  board: Record<SlotId, UnitInstance | null>;
}

export interface MatchLogEntry {
  id: string;
  turn: number;
  message: string;
}

export interface GameState {
  status: MatchStatus;
  turn: number;
  phase: Phase;
  activePlayerId: PlayerId;
  winner: PlayerId | null;
  players: Record<PlayerId, PlayerState>;
  log: MatchLogEntry[];
  seed: number;
  idSeq: number;
}

export interface ActionTarget {
  owner: "SELF" | "ENEMY";
  kind: "UNIT" | "KING";
  instanceId?: string;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

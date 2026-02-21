import {
  DEFAULT_LOADOUTS,
  buildDeckFromCardIds,
  buildMockDeckForKing,
  cardsById,
  getCommanderById,
  getKingById,
} from "@/lib/cards";
import {
  type Ability,
  type ActionResult,
  type ActionTarget,
  type AuraMode,
  type Card,
  type CommanderCard,
  type Condition,
  type DeckCard,
  type DeckCardType,
  type GameState,
  type HandCard,
  type Keyword,
  type KingCard,
  type MatchLogEntry,
  type PlayerId,
  type PlayerState,
  type SlotId,
  type UnitInstance,
} from "@/lib/game/types";

export const BOARD_FRONT: SlotId[] = ["F1", "F2", "F3"];
export const BOARD_BACK: SlotId[] = ["B1", "B2", "B3"];
export const BOARD_ALL: SlotId[] = [...BOARD_FRONT, ...BOARD_BACK];

const HAND_LIMIT = 8;
const RNG_MOD = 2147483647;
export const HYDRATION_SAFE_SEED = 20260220;

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

function normalizeSeed(seed: number): number {
  const normalized = Math.floor(seed) % RNG_MOD;
  return normalized <= 0 ? 1 : normalized;
}

export function createRuntimeSeed(): number {
  return normalizeSeed(Date.now());
}

function nextRandom(state: GameState): number {
  state.seed = (state.seed * 48271) % RNG_MOD;
  return (state.seed & RNG_MOD) / RNG_MOD;
}

function nextStateId(state: GameState, prefix: string): string {
  const id = `${prefix}_${state.idSeq.toString(36).padStart(6, "0")}`;
  state.idSeq += 1;
  return id;
}

function randomInt(state: GameState, maxExclusive: number): number {
  if (maxExclusive <= 1) {
    return 0;
  }
  return Math.floor(nextRandom(state) * maxExclusive);
}

function shuffle<T>(state: GameState, array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(state, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getOpponentId(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

function makeLogEntry(state: GameState, message: string): MatchLogEntry {
  return {
    id: nextStateId(state, "LOG"),
    turn: state.turn,
    message,
  };
}

function addLog(state: GameState, message: string): void {
  state.log.unshift(makeLogEntry(state, message));
  state.log = state.log.slice(0, 60);
}

function toHandCard(state: GameState, card: DeckCard): HandCard {
  return {
    handId: nextStateId(state, "H"),
    card,
  };
}

function createUnitFromCard(
  state: GameState,
  owner: PlayerId,
  sourceCardId: string,
  attack: number,
  hp: number,
  rangeType: UnitInstance["rangeType"],
  deployment: UnitInstance["deployment"],
  classTags: UnitInstance["classTags"],
  race: UnitInstance["race"],
  faction: UnitInstance["faction"],
  cardType: UnitInstance["cardType"],
): UnitInstance {
  return {
    instanceId: nextStateId(state, "U"),
    owner,
    sourceCardId,
    cardType,
    attack,
    hp,
    maxHp: hp,
    rangeType,
    deployment,
    classTags,
    race,
    faction,
    keywords: [],
    silenced: false,
    canAttack: false,
    attacksUsed: 0,
    justSummoned: true,
  };
}

function findUnitSlot(player: PlayerState, instanceId: string): SlotId | null {
  for (const slot of BOARD_ALL) {
    if (player.board[slot]?.instanceId === instanceId) {
      return slot;
    }
  }
  return null;
}

function getCardByIdOrThrow<T extends Card>(id: string): T {
  const card = cardsById.get(id);
  if (!card) {
    throw new Error(`ไม่พบการ์ด: ${id}`);
  }
  return card as T;
}

function canDeployAt(slot: SlotId, deployment: UnitInstance["deployment"]): boolean {
  if (deployment === "ANY") {
    return true;
  }
  if (deployment === "FRONT_ONLY") {
    return BOARD_FRONT.includes(slot);
  }
  return BOARD_BACK.includes(slot);
}

function availableSlots(player: PlayerState, deployment: UnitInstance["deployment"]): SlotId[] {
  return BOARD_ALL.filter((slot) => canDeployAt(slot, deployment) && player.board[slot] === null);
}

function playerCanUseFaction(player: PlayerState, faction: string): boolean {
  if (faction === "NEUTRAL") {
    return true;
  }
  if (player.king.race === "HUMAN") {
    return true;
  }
  return player.king.allowedFactionsInDeck.includes(faction as PlayerState["king"]["faction"]);
}

function countClassOnBoard(player: PlayerState, classTag: string): number {
  return BOARD_ALL.reduce((count, slot) => {
    const unit = player.board[slot];
    if (!unit) {
      return count;
    }
    if (unit.classTags.includes(classTag as never)) {
      return count + 1;
    }
    return count;
  }, 0);
}

function countRaceOnBoard(player: PlayerState, race: string): number {
  return BOARD_ALL.reduce((count, slot) => {
    const unit = player.board[slot];
    if (!unit) {
      return count;
    }
    return unit.race === race ? count + 1 : count;
  }, 0);
}

function checkRequirements(state: GameState, playerId: PlayerId, card: DeckCard): string | null {
  const player = state.players[playerId];
  const req = card.requirements;
  if (!req) {
    return null;
  }

  if (req.requiresFaction && !playerCanUseFaction(player, req.requiresFaction)) {
    return `ต้องใช้การ์ดฝั่ง ${req.requiresFaction}`;
  }
  if (req.requiresKingRace && player.king.race !== req.requiresKingRace) {
    return `ต้องใช้ราชาเผ่า ${req.requiresKingRace}`;
  }
  if (typeof req.minCombo === "number" && player.combo < req.minCombo) {
    return `ต้องมีคอมโบอย่างน้อย ${req.minCombo}`;
  }
  if (typeof req.minSideStacks === "number" && player.sideStacks < req.minSideStacks) {
    return `ต้องมีแต้มฝั่งอย่างน้อย ${req.minSideStacks}`;
  }

  if (req.requiresClassOnBoard?.length) {
    const hasAny = req.requiresClassOnBoard.some((classTag) => countClassOnBoard(player, classTag) > 0);
    if (!hasAny) {
      return `ต้องมียูนิตอาชีพนี้บนกระดาน: ${req.requiresClassOnBoard.join(", ")}`;
    }
  }

  if (req.requiresRaceOnBoard?.length) {
    const hasAny = req.requiresRaceOnBoard.some((race) => countRaceOnBoard(player, race) > 0);
    if (!hasAny) {
      return `ต้องมียูนิตเผ่านี้บนกระดาน: ${req.requiresRaceOnBoard.join(", ")}`;
    }
  }

  return null;
}

function checkCondition(
  state: GameState,
  actorId: PlayerId,
  target: ResolvedTarget | null,
  condition?: Condition,
): boolean {
  if (!condition) {
    return true;
  }

  const actor = state.players[actorId];
  const enemy = state.players[getOpponentId(actorId)];

  switch (condition.type) {
    case "ALLY_CLASS_COUNT_AT_LEAST": {
      if (!condition.classTag) {
        return false;
      }
      return countClassOnBoard(actor, condition.classTag) >= (condition.value ?? 1);
    }
    case "ALLY_RACE_COUNT_AT_LEAST": {
      if (!condition.race) {
        return false;
      }
      return countRaceOnBoard(actor, condition.race) >= (condition.value ?? 1);
    }
    case "COMBO_AT_LEAST":
      return actor.combo >= (condition.value ?? 0);
    case "ENEMY_FRONT_EMPTY":
      return BOARD_FRONT.every((slot) => enemy.board[slot] === null);
    case "TARGET_IS_DAMAGED": {
      if (!target || target.kind !== "UNIT") {
        return false;
      }
      return target.unit.hp < target.unit.maxHp;
    }
    case "SIDE_STACK_AT_LEAST":
      return actor.sideStacks >= (condition.value ?? 0);
    case "KILL_COUNT_THIS_TURN_AT_LEAST":
      return actor.killCountThisTurn >= (condition.value ?? 0);
    case "KING_RACE_IS":
      return actor.king.race === condition.race;
    default:
      return false;
  }
}

function drawCards(state: GameState, playerId: PlayerId, count: number, reason: string): void {
  const player = state.players[playerId];
  for (let i = 0; i < count; i += 1) {
    if (player.deck.length === 0) {
      player.fatigue += 1;
      dealDamageToKing(state, playerId, player.fatigue, `หมดสำรับ (${reason})`);
      continue;
    }
    const card = player.deck.shift();
    if (!card) {
      continue;
    }
    player.hand.push(toHandCard(state, card));
  }
}

function healKing(state: GameState, playerId: PlayerId, amount: number): void {
  if (amount <= 0) {
    return;
  }
  const player = state.players[playerId];
  player.kingHp = Math.min(player.kingMaxHp, player.kingHp + amount);
}

function dealDamageToKing(state: GameState, playerId: PlayerId, amount: number, source: string): number {
  if (amount <= 0) {
    return 0;
  }
  const player = state.players[playerId];
  if (player.kingHp <= 0) {
    return 0;
  }

  player.kingHp -= amount;
  addLog(state, `ราชา ${player.name} ได้รับความเสียหาย ${amount} (${source})`);

  if (player.kingHp <= 0) {
    player.kingHp = 0;
    state.status = "ENDED";
    state.winner = getOpponentId(playerId);
    addLog(state, `${state.players[state.winner].name} ชนะการแข่งขัน`);
  }

  return amount;
}

function killUnit(state: GameState, ownerId: PlayerId, slot: SlotId, killerId?: PlayerId): void {
  const owner = state.players[ownerId];
  const unit = owner.board[slot];
  if (!unit) {
    return;
  }

  owner.board[slot] = null;
  if (unit.cardType === "COMMANDER") {
    owner.commanderInstanceId = null;
  }

  const sourceCard = getCardByIdOrThrow<DeckCard | CommanderCard>(unit.sourceCardId);
  if (sourceCard.kind === "DECK_CARD") {
    owner.graveyard.push(sourceCard);
  }

  addLog(state, `${sourceCard.name.th} ของ ${owner.name} ถูกทำลาย`);

  if (killerId) {
    const killer = state.players[killerId];
    killer.sideStacks = Math.min(10, killer.sideStacks + 1);
    killer.killCountThisTurn += 1;
  }
}

interface ResolvedTargetUnit {
  kind: "UNIT";
  playerId: PlayerId;
  slot: SlotId;
  unit: UnitInstance;
}

interface ResolvedTargetKing {
  kind: "KING";
  playerId: PlayerId;
}

type ResolvedTarget = ResolvedTargetUnit | ResolvedTargetKing;

function resolvePlayersForTargetOwner(actorId: PlayerId, owner: Ability["target"]["owner"]): PlayerId[] {
  const enemyId = getOpponentId(actorId);
  switch (owner) {
    case "SELF":
    case "ALLY":
      return [actorId];
    case "ENEMY":
      return [enemyId];
    case "BOTH":
      return [actorId, enemyId];
    case "NONE":
      return [];
    default:
      return [];
  }
}

function resolveTargetCandidates(
  state: GameState,
  actorId: PlayerId,
  ability: Ability,
  sourceUnit: ResolvedTargetUnit | null,
): ResolvedTarget[] {
  const playerIds = resolvePlayersForTargetOwner(actorId, ability.target.owner);
  const candidates: ResolvedTarget[] = [];

  for (const playerId of playerIds) {
    const player = state.players[playerId];

    switch (ability.target.zone) {
      case "KING":
        candidates.push({ kind: "KING", playerId });
        break;
      case "COMMANDER": {
        if (!player.commanderInstanceId) {
          break;
        }
        const slot = findUnitSlot(player, player.commanderInstanceId);
        if (slot && player.board[slot]) {
          candidates.push({
            kind: "UNIT",
            playerId,
            slot,
            unit: player.board[slot],
          });
        }
        break;
      }
      case "BOARD_FRONT":
        for (const slot of BOARD_FRONT) {
          const unit = player.board[slot];
          if (unit) {
            candidates.push({ kind: "UNIT", playerId, slot, unit });
          }
        }
        break;
      case "BOARD_BACK":
        for (const slot of BOARD_BACK) {
          const unit = player.board[slot];
          if (unit) {
            candidates.push({ kind: "UNIT", playerId, slot, unit });
          }
        }
        break;
      case "BOARD_ANY":
      case "UNIT_ANY":
        for (const slot of BOARD_ALL) {
          const unit = player.board[slot];
          if (unit) {
            candidates.push({ kind: "UNIT", playerId, slot, unit });
          }
        }
        break;
      case "NONE":
      case "HAND":
      case "DECK":
      case "DISCARD":
      default:
        break;
    }
  }

  if (ability.target.selector === "THIS" && sourceUnit) {
    return [sourceUnit];
  }

  return candidates;
}

function pickTargets(
  state: GameState,
  actorId: PlayerId,
  ability: Ability,
  sourceUnit: ResolvedTargetUnit | null,
  chosenTarget: ActionTarget | null,
): ResolvedTarget[] {
  const candidates = resolveTargetCandidates(state, actorId, ability, sourceUnit);
  if (candidates.length === 0 && ability.target.zone !== "KING") {
    return [];
  }

  switch (ability.target.selector) {
    case "NONE":
      if (ability.target.zone === "KING") {
        const ids = resolvePlayersForTargetOwner(actorId, ability.target.owner);
        return ids.map((id) => ({ kind: "KING", playerId: id }));
      }
      return candidates.slice(0, 1);
    case "ALL":
      return candidates;
    case "RANDOM": {
      const count = Math.max(1, ability.target.count ?? 1);
      const pool = [...candidates];
      const picks: ResolvedTarget[] = [];
      while (pool.length > 0 && picks.length < count) {
        const idx = randomInt(state, pool.length);
        picks.push(pool[idx]);
        pool.splice(idx, 1);
      }
      return picks;
    }
    case "CHOSEN": {
      if (chosenTarget) {
        if (chosenTarget.kind === "KING") {
          const playerId = chosenTarget.owner === "SELF" ? actorId : getOpponentId(actorId);
          const canTargetKing =
            ability.target.zone === "KING" ||
            (ability.target.zone === "BOARD_ANY" && ability.target.allowKing === true);
          if (canTargetKing) {
            return [{ kind: "KING", playerId }];
          }
        }

        if (chosenTarget.kind === "UNIT" && chosenTarget.instanceId) {
          const match = candidates.find(
            (candidate) => candidate.kind === "UNIT" && candidate.unit.instanceId === chosenTarget.instanceId,
          );
          if (match) {
            return [match];
          }
        }
      }
      return candidates.slice(0, 1);
    }
    case "LOWEST_HP": {
      const units = candidates.filter((target): target is ResolvedTargetUnit => target.kind === "UNIT");
      if (!units.length) {
        return [];
      }
      units.sort((a, b) => a.unit.hp - b.unit.hp);
      return [units[0]];
    }
    case "HIGHEST_ATK": {
      const units = candidates.filter((target): target is ResolvedTargetUnit => target.kind === "UNIT");
      if (!units.length) {
        return [];
      }
      units.sort((a, b) => b.unit.attack - a.unit.attack);
      return [units[0]];
    }
    case "LEFTMOST": {
      const units = candidates.filter((target): target is ResolvedTargetUnit => target.kind === "UNIT");
      if (!units.length) {
        return [];
      }
      units.sort((a, b) => BOARD_ALL.indexOf(a.slot) - BOARD_ALL.indexOf(b.slot));
      return [units[0]];
    }
    case "RIGHTMOST": {
      const units = candidates.filter((target): target is ResolvedTargetUnit => target.kind === "UNIT");
      if (!units.length) {
        return [];
      }
      units.sort((a, b) => BOARD_ALL.indexOf(b.slot) - BOARD_ALL.indexOf(a.slot));
      return [units[0]];
    }
    case "SAME_COLUMN": {
      if (!sourceUnit) {
        return candidates.slice(0, 1);
      }
      const sourceColumn = sourceUnit.slot[1];
      const same = candidates.filter(
        (target) => target.kind === "UNIT" && target.slot[1] === sourceColumn,
      );
      return same.length ? same.slice(0, 1) : candidates.slice(0, 1);
    }
    case "THIS":
      return sourceUnit ? [sourceUnit] : [];
    default:
      return candidates.slice(0, 1);
  }
}

function dealDamageToUnit(
  state: GameState,
  target: ResolvedTargetUnit,
  amount: number,
  source: string,
  killerId?: PlayerId,
): number {
  if (amount <= 0) {
    return 0;
  }

  const current = state.players[target.playerId].board[target.slot];
  if (!current) {
    return 0;
  }

  if (current.keywords.includes("WARD")) {
    current.keywords = current.keywords.filter((keyword) => keyword !== "WARD");
    addLog(state, `Ward ของ ${state.players[target.playerId].name} ป้องกันความเสียหายได้`);
    return 0;
  }

  current.hp -= amount;
  addLog(
    state,
    `${getCardByIdOrThrow<Card>(current.sourceCardId).name.th} ของ ${state.players[target.playerId].name} ได้รับความเสียหาย ${amount} (${source})`,
  );

  if (current.hp <= 0) {
    killUnit(state, target.playerId, target.slot, killerId);
  }

  return amount;
}

function healUnit(target: ResolvedTargetUnit, amount: number): number {
  if (amount <= 0) {
    return 0;
  }
  const missing = target.unit.maxHp - target.unit.hp;
  const value = Math.min(missing, amount);
  target.unit.hp += value;
  return value;
}

function grantKeywordToUnit(target: ResolvedTargetUnit, keyword: Keyword): void {
  if (!target.unit.keywords.includes(keyword)) {
    target.unit.keywords.push(keyword);
  }
}

function removeKeywordFromUnit(target: ResolvedTargetUnit, keyword: Keyword): void {
  target.unit.keywords = target.unit.keywords.filter((item) => item !== keyword);
}

function resolveAbility(
  state: GameState,
  actorId: PlayerId,
  ability: Ability,
  sourceUnit: ResolvedTargetUnit | null,
  chosenTarget: ActionTarget | null,
): void {
  const targets = pickTargets(state, actorId, ability, sourceUnit, chosenTarget);

  for (const target of targets) {
    if (!checkCondition(state, actorId, target, ability.condition)) {
      continue;
    }

    const amount = ability.amount ?? 0;
    const actor = state.players[actorId];

    switch (ability.op) {
      case "DEAL_DAMAGE": {
        if (target.kind === "KING") {
          dealDamageToKing(state, target.playerId, amount, ability.op);
        } else {
          const dealt = dealDamageToUnit(state, target, amount, ability.op, actorId);
          if (sourceUnit?.unit.keywords.includes("LIFESTEAL") && dealt > 0) {
            healKing(state, actorId, dealt);
          }
        }
        break;
      }
      case "HEAL": {
        if (target.kind === "KING") {
          healKing(state, target.playerId, amount);
        } else {
          healUnit(target, amount);
        }
        break;
      }
      case "BUFF_ATK": {
        if (target.kind === "UNIT") {
          target.unit.attack += amount;
        }
        break;
      }
      case "BUFF_HP": {
        if (target.kind === "UNIT") {
          target.unit.maxHp += amount;
          target.unit.hp += amount;
        }
        break;
      }
      case "DRAW_CARD":
        drawCards(state, actorId, ability.drawCount ?? 1, ability.op);
        break;
      case "GRANT_KEYWORD":
        if (ability.keyword && target.kind === "UNIT") {
          grantKeywordToUnit(target, ability.keyword);
        }
        break;
      case "REMOVE_KEYWORD":
        if (ability.keyword && target.kind === "UNIT") {
          removeKeywordFromUnit(target, ability.keyword);
        }
        break;
      case "GAIN_SIDE_STACK":
        actor.sideStacks = Math.min(10, actor.sideStacks + amount);
        break;
      case "GAIN_COMBO":
        actor.combo = Math.min(3, actor.combo + amount);
        break;
      case "REDUCE_NEXT_TYPE_COST":
        actor.nextNonUnitDiscount = Math.max(actor.nextNonUnitDiscount, Math.max(amount, 0));
        break;
      case "SILENCE":
        if (target.kind === "UNIT") {
          target.unit.silenced = true;
          target.unit.keywords = [];
        }
        break;
      case "DESTROY":
        if (target.kind === "UNIT") {
          killUnit(state, target.playerId, target.slot, actorId);
        }
        break;
      case "RESTORE_MANA":
        actor.mana.current = Math.min(actor.mana.max, actor.mana.current + amount);
        break;
      case "SUMMON_TOKEN":
      default:
        break;
    }
  }
}

function runCardAbilities(
  state: GameState,
  actorId: PlayerId,
  card: DeckCard,
  trigger: Ability["trigger"][],
  sourceUnit: ResolvedTargetUnit | null,
  chosenTarget: ActionTarget | null,
): void {
  if (!card.abilities?.length) {
    return;
  }

  for (const ability of card.abilities) {
    if (!trigger.includes(ability.trigger)) {
      continue;
    }
    resolveAbility(state, actorId, ability, sourceUnit, chosenTarget);
  }
}

function processCombo(state: GameState, playerId: PlayerId, cardType: DeckCardType): void {
  const player = state.players[playerId];
  if (player.king.race !== "HUMAN") {
    return;
  }

  if (!player.comboLastCardType) {
    player.combo = 1;
  } else if (player.comboLastCardType !== cardType) {
    player.combo = Math.min(3, player.combo + 1);
  } else {
    player.combo = 1;
  }

  player.comboLastCardType = cardType;

  if (player.combo === 2) {
    player.nextNonUnitDiscount = Math.max(player.nextNonUnitDiscount, 1);
    addLog(state, `${player.name} reached Combo 2 (next non-unit costs -1 mana).`);
  }

  if (player.combo === 3) {
    drawCards(state, playerId, 1, "Human combo bonus");
    player.combo = 0;
    player.comboLastCardType = null;
    addLog(state, `${player.name} reached Combo 3 and drew a card.`);
  }
}

function refreshForTurnStart(state: GameState, playerId: PlayerId): void {
  const player = state.players[playerId];

  for (const slot of BOARD_ALL) {
    const unit = player.board[slot];
    if (!unit) {
      continue;
    }
    unit.canAttack = true;
    unit.attacksUsed = 0;
    unit.justSummoned = false;
  }

  player.commanderPulseCooldown = Math.max(0, player.commanderPulseCooldown - 1);
  player.killCountThisTurn = 0;
  player.combo = 0;
  player.comboLastCardType = null;
  player.nextNonUnitDiscount = 0;

  player.mana.max = Math.min(10, player.mana.max + 1);
  player.mana.current = player.mana.max;

  drawCards(state, playerId, 1, "จั่วต้นเทิร์น");
}

function discardDownToLimit(state: GameState, playerId: PlayerId): void {
  const player = state.players[playerId];
  while (player.hand.length > HAND_LIMIT) {
    const idx = randomInt(state, player.hand.length);
    const [discarded] = player.hand.splice(idx, 1);
    player.graveyard.push(discarded.card);
    addLog(state, `${player.name} discarded ${discarded.card.name.en} (hand limit).`);
  }
}

function computeCardCost(player: PlayerState, card: DeckCard): { mana: number; sideStacks: number } {
  let mana = card.cost.mana;
  if (card.cardType !== "UNIT" && player.nextNonUnitDiscount > 0) {
    mana = Math.max(0, mana - player.nextNonUnitDiscount);
  }
  return {
    mana,
    sideStacks: card.cost.sideStacks,
  };
}

function consumeCardDiscount(player: PlayerState, card: DeckCard): void {
  if (card.cardType !== "UNIT" && player.nextNonUnitDiscount > 0) {
    player.nextNonUnitDiscount = 0;
  }
}

function isFrontlineAlive(player: PlayerState): boolean {
  return BOARD_FRONT.some((slot) => player.board[slot]);
}

function isSameColumn(slotA: SlotId, slotB: SlotId): boolean {
  return slotA[1] === slotB[1];
}

function createPlayerState(
  state: GameState,
  playerId: PlayerId,
  config: {
    name: string;
    king: KingCard;
    commander: CommanderCard;
    auraMode: AuraMode;
    deck: DeckCard[];
  },
): PlayerState {
  const deck = shuffle(state, config.deck);

  return {
    id: playerId,
    name: config.name,
    king: config.king,
    kingHp: config.king.hp,
    kingMaxHp: config.king.hp,
    ultimateUsed: false,
    commander: config.commander,
    commanderAuraMode: config.auraMode,
    commanderBurstUsed: false,
    commanderPulseCooldown: 0,
    commanderInstanceId: null,
    mana: {
      current: 0,
      max: 0,
    },
    sideStacks: 0,
    combo: 0,
    comboLastCardType: null,
    nextNonUnitDiscount: 0,
    killCountThisTurn: 0,
    deck,
    hand: [],
    graveyard: [],
    fatigue: 0,
    board: {
      F1: null,
      F2: null,
      F3: null,
      B1: null,
      B2: null,
      B3: null,
    },
  };
}

export interface MatchSetup {
  P1: {
    name: string;
    kingId: string;
    commanderId: string;
    auraMode: AuraMode;
    deckCardIds?: string[];
  };
  P2: {
    name: string;
    kingId: string;
    commanderId: string;
    auraMode: AuraMode;
    deckCardIds?: string[];
  };
}

export function createInitialState(
  setup?: Partial<MatchSetup>,
  options?: {
    seed?: number;
  },
): GameState {
  const seed = normalizeSeed(options?.seed ?? HYDRATION_SAFE_SEED);
  const state: GameState = {
    status: "IN_PROGRESS",
    turn: 1,
    phase: "MAIN",
    activePlayerId: "P1",
    winner: null,
    players: {} as GameState["players"],
    log: [],
    seed,
    idSeq: 1,
  };

  const p1Config = setup?.P1 ?? DEFAULT_LOADOUTS.P1;
  const p2Config = setup?.P2 ?? DEFAULT_LOADOUTS.P2;

  const p1King = getKingById(p1Config.kingId);
  const p2King = getKingById(p2Config.kingId);
  const p1Commander = getCommanderById(p1Config.commanderId);
  const p2Commander = getCommanderById(p2Config.commanderId);

  const p1DeckBuild = p1Config.deckCardIds?.length
    ? buildDeckFromCardIds(p1King, p1Config.deckCardIds, 24)
    : { deck: buildMockDeckForKing(p1King, 24), errors: [] };
  const p2DeckBuild = p2Config.deckCardIds?.length
    ? buildDeckFromCardIds(p2King, p2Config.deckCardIds, 24)
    : { deck: buildMockDeckForKing(p2King, 24), errors: [] };

  const p1Deck = p1DeckBuild.errors.length ? buildMockDeckForKing(p1King, 24) : p1DeckBuild.deck;
  const p2Deck = p2DeckBuild.errors.length ? buildMockDeckForKing(p2King, 24) : p2DeckBuild.deck;

  state.players.P1 = createPlayerState(state, "P1", {
    name: p1Config.name,
    king: p1King,
    commander: p1Commander,
    auraMode: p1Config.auraMode,
    deck: p1Deck,
  });
  state.players.P2 = createPlayerState(state, "P2", {
    name: p2Config.name,
    king: p2King,
    commander: p2Commander,
    auraMode: p2Config.auraMode,
    deck: p2Deck,
  });

  drawCards(state, "P1", 4, "เริ่มเกม");
  drawCards(state, "P2", 4, "เริ่มเกม");
  refreshForTurnStart(state, "P1");

  if (p1DeckBuild.errors.length) {
    addLog(
      state,
      `เด็ค ${p1Config.name} ไม่ถูกต้อง (${p1DeckBuild.errors[0]}) ระบบใช้เด็คอัตโนมัติแทน`,
    );
  }
  if (p2DeckBuild.errors.length) {
    addLog(
      state,
      `เด็ค ${p2Config.name} ไม่ถูกต้อง (${p2DeckBuild.errors[0]}) ระบบใช้เด็คอัตโนมัติแทน`,
    );
  }

  addLog(state, `เริ่มแมตช์: ${state.players.P1.name} พบ ${state.players.P2.name}`);
  return state;
}

function finalize(state: GameState): GameState {
  if (state.players.P1.kingHp <= 0 && state.players.P2.kingHp <= 0) {
    state.status = "ENDED";
    state.winner = null;
  }
  return state;
}

export function playCardAction(
  input: GameState,
  handId: string,
  slot: SlotId | null,
  chosenTarget: ActionTarget | null,
): { state: GameState; result: ActionResult } {
  const state = cloneState(input);
  if (state.status !== "IN_PROGRESS") {
    return { state, result: { ok: false, error: "เกมนี้จบแล้ว" } };
  }

  const actorId = state.activePlayerId;
  const actor = state.players[actorId];
  const handIndex = actor.hand.findIndex((item) => item.handId === handId);
  if (handIndex < 0) {
    return { state, result: { ok: false, error: "ไม่พบการ์ดใบนี้ในมือ" } };
  }

  const handCard = actor.hand[handIndex];
  const card = handCard.card;

  const requirementError = checkRequirements(state, actorId, card);
  if (requirementError) {
    return { state, result: { ok: false, error: requirementError } };
  }

  const cost = computeCardCost(actor, card);
  if (actor.mana.current < cost.mana) {
    return {
      state,
      result: { ok: false, error: `มานาไม่พอ (ต้องใช้ ${cost.mana}, มี ${actor.mana.current})` },
    };
  }
  if (actor.sideStacks < cost.sideStacks) {
    return {
      state,
      result: {
        ok: false,
        error: `แต้มฝั่งไม่พอ (ต้องใช้ ${cost.sideStacks}, มี ${actor.sideStacks})`,
      },
    };
  }

  actor.mana.current -= cost.mana;
  actor.sideStacks -= cost.sideStacks;
  consumeCardDiscount(actor, card);
  actor.hand.splice(handIndex, 1);

  if (card.cardType === "UNIT") {
    const deployment = card.deployment ?? "FRONT_ONLY";
    const validSlots = availableSlots(actor, deployment);
    const destination = slot ?? validSlots[0] ?? null;
    if (!destination) {
      actor.hand.push(handCard);
      actor.mana.current += cost.mana;
      actor.sideStacks += cost.sideStacks;
      return { state, result: { ok: false, error: "ไม่มีช่องที่ลงยูนิตใบนี้ได้" } };
    }
    if (!validSlots.includes(destination)) {
      actor.hand.push(handCard);
      actor.mana.current += cost.mana;
      actor.sideStacks += cost.sideStacks;
      return { state, result: { ok: false, error: "ช่องที่เลือกไม่ถูกต้องสำหรับยูนิตใบนี้" } };
    }

    const unit = createUnitFromCard(
      state,
      actorId,
      card.id,
      card.attack ?? 0,
      card.hp ?? 1,
      card.rangeType ?? "MELEE",
      deployment,
      card.classTags,
      card.race,
      card.faction,
      "UNIT",
    );
    actor.board[destination] = unit;

    const sourceRef: ResolvedTargetUnit = {
      kind: "UNIT",
      playerId: actorId,
      slot: destination,
      unit,
    };

    runCardAbilities(state, actorId, card, ["ON_PLAY", "ON_SUMMON"], sourceRef, chosenTarget);

    if (unit.keywords.includes("RUSH")) {
      unit.canAttack = true;
      unit.justSummoned = false;
    }

    addLog(state, `${actor.name} ลง ${card.name.th} ที่ช่อง ${destination}`);
  } else {
    runCardAbilities(state, actorId, card, ["ON_CAST"], null, chosenTarget);
    actor.graveyard.push(card);
    addLog(state, `${actor.name} ใช้การ์ด ${card.name.th}`);
  }

  processCombo(state, actorId, card.cardType);
  return { state: finalize(state), result: { ok: true } };
}

export function deployCommanderAction(
  input: GameState,
  slot: SlotId,
): { state: GameState; result: ActionResult } {
  const state = cloneState(input);
  if (state.status !== "IN_PROGRESS") {
    return { state, result: { ok: false, error: "เกมนี้จบแล้ว" } };
  }

  const actorId = state.activePlayerId;
  const actor = state.players[actorId];

  if (actor.commanderInstanceId) {
    return { state, result: { ok: false, error: "แม่ทัพถูกลงสนามแล้ว" } };
  }

  if (!canDeployAt(slot, actor.commander.deployment)) {
    return { state, result: { ok: false, error: "ช่องนี้ลงแม่ทัพไม่ได้" } };
  }

  if (actor.board[slot]) {
    return { state, result: { ok: false, error: "ช่องนี้มียูนิตอยู่แล้ว" } };
  }

  if (actor.mana.current < actor.commander.cost.mana) {
    return {
      state,
      result: {
        ok: false,
        error: `มานาไม่พอสำหรับลงแม่ทัพ (ต้องใช้ ${actor.commander.cost.mana})`,
      },
    };
  }

  actor.mana.current -= actor.commander.cost.mana;

  const unit = createUnitFromCard(
    state,
    actorId,
    actor.commander.id,
    actor.commander.attack,
    actor.commander.hp,
    actor.commander.rangeType,
    actor.commander.deployment,
    actor.commander.classTags,
    actor.commander.race,
    actor.commander.faction,
    "COMMANDER",
  );

  actor.board[slot] = unit;
  actor.commanderInstanceId = unit.instanceId;

  addLog(state, `${actor.name} ลงแม่ทัพ ${actor.commander.name.th} ที่ช่อง ${slot}`);
  return { state: finalize(state), result: { ok: true } };
}

export function commanderAuraAction(
  input: GameState,
  chosenTarget: ActionTarget | null,
): { state: GameState; result: ActionResult } {
  const state = cloneState(input);
  if (state.status !== "IN_PROGRESS") {
    return { state, result: { ok: false, error: "เกมนี้จบแล้ว" } };
  }

  const actorId = state.activePlayerId;
  const actor = state.players[actorId];

  if (!actor.commanderInstanceId) {
    return { state, result: { ok: false, error: "ต้องลงแม่ทัพก่อนใช้ออร่า" } };
  }

  const slot = findUnitSlot(actor, actor.commanderInstanceId);
  if (!slot || !actor.board[slot]) {
    return { state, result: { ok: false, error: "ไม่พบแม่ทัพบนกระดาน" } };
  }

  const commanderRef: ResolvedTargetUnit = {
    kind: "UNIT",
    playerId: actorId,
    slot,
    unit: actor.board[slot],
  };

  if (actor.commanderAuraMode === "BURST") {
    if (actor.commanderBurstUsed) {
      return { state, result: { ok: false, error: "โหมด BURST ใช้ไปแล้ว" } };
    }
    for (const ability of actor.commander.aura.burst) {
      resolveAbility(state, actorId, ability, commanderRef, chosenTarget);
    }
    actor.commanderBurstUsed = true;
    addLog(state, `${actor.name} ใช้ออร่า BURST`);
  } else {
    if (actor.commanderPulseCooldown > 0) {
      return {
        state,
        result: {
          ok: false,
          error: `PULSE อยู่ในคูลดาวน์อีก ${actor.commanderPulseCooldown} เทิร์น`,
        },
      };
    }
    for (const ability of actor.commander.aura.pulse) {
      resolveAbility(state, actorId, ability, commanderRef, chosenTarget);
    }
    actor.commanderPulseCooldown = actor.commander.aura.pulseCooldownTurns;
    addLog(state, `${actor.name} ใช้ออร่า PULSE`);
  }

  return { state: finalize(state), result: { ok: true } };
}

export function ultimateAction(input: GameState): { state: GameState; result: ActionResult } {
  const state = cloneState(input);
  if (state.status !== "IN_PROGRESS") {
    return { state, result: { ok: false, error: "เกมนี้จบแล้ว" } };
  }

  const actorId = state.activePlayerId;
  const actor = state.players[actorId];

  if (actor.ultimateUsed) {
    return { state, result: { ok: false, error: "อัลติเมตถูกใช้ไปแล้ว" } };
  }

  if (state.turn < actor.king.ultimate.unlockTurnMin) {
    return {
      state,
      result: {
        ok: false,
        error: `อัลติเมตใช้ได้ตั้งแต่เทิร์น ${actor.king.ultimate.unlockTurnMin}`,
      },
    };
  }

  for (const effect of actor.king.ultimate.effects) {
    resolveAbility(state, actorId, effect, null, null);
  }

  actor.ultimateUsed = true;
  addLog(state, `${actor.name} ใช้อัลติเมต: ${actor.king.ultimate.name.th}`);
  return { state: finalize(state), result: { ok: true } };
}

export function attackAction(
  input: GameState,
  attackerInstanceId: string,
  target: ActionTarget,
): { state: GameState; result: ActionResult } {
  const state = cloneState(input);
  if (state.status !== "IN_PROGRESS") {
    return { state, result: { ok: false, error: "เกมนี้จบแล้ว" } };
  }

  const actorId = state.activePlayerId;
  const defenderId = getOpponentId(actorId);
  const actor = state.players[actorId];
  const defender = state.players[defenderId];

  const attackerSlot = findUnitSlot(actor, attackerInstanceId);
  if (!attackerSlot) {
    return { state, result: { ok: false, error: "ไม่พบยูนิตที่เลือกโจมตี" } };
  }

  const attacker = actor.board[attackerSlot];
  if (!attacker) {
    return { state, result: { ok: false, error: "ไม่พบยูนิตที่เลือกโจมตี" } };
  }

  if (!attacker.canAttack) {
    return { state, result: { ok: false, error: "ยูนิตนี้ยังโจมตีไม่ได้ในตอนนี้" } };
  }

  const enemyFrontExists = isFrontlineAlive(defender);

  if (attacker.rangeType === "MELEE") {
    if (enemyFrontExists) {
      if (target.kind !== "UNIT" || !target.instanceId) {
        return {
          state,
          result: { ok: false, error: "ยูนิตประชิดต้องตีเป้าแถวหน้าคอลัมน์เดียวกัน" },
        };
      }

      const targetSlot = findUnitSlot(defender, target.instanceId);
      if (!targetSlot || !BOARD_FRONT.includes(targetSlot) || !isSameColumn(attackerSlot, targetSlot)) {
        return {
          state,
          result: { ok: false, error: "ยูนิตประชิดต้องตีเป้าแถวหน้าคอลัมน์เดียวกัน" },
        };
      }
    }
  }

  if (attacker.rangeType === "RANGED" && enemyFrontExists && !attacker.keywords.includes("SNIPER")) {
    if (target.kind === "KING") {
      return {
        state,
        result: { ok: false, error: "ยูนิตระยะไกลต้องโจมตีแถวหน้าศัตรูก่อน" },
      };
    }

    if (!target.instanceId) {
      return { state, result: { ok: false, error: "เป้าหมายไม่ถูกต้อง" } };
    }

    const targetSlot = findUnitSlot(defender, target.instanceId);
    if (!targetSlot || !BOARD_FRONT.includes(targetSlot)) {
      return {
        state,
        result: { ok: false, error: "ยูนิตระยะไกลต้องโจมตีแถวหน้าศัตรูก่อน" },
      };
    }
  }

  attacker.canAttack = false;
  attacker.attacksUsed += 1;

  if (target.kind === "KING") {
    const damage = dealDamageToKing(state, defenderId, attacker.attack, "โจมตี");
    if (attacker.keywords.includes("LIFESTEAL") && damage > 0) {
      healKing(state, actorId, damage);
    }
    addLog(state, `${actor.name} โจมตีราชาฝั่งตรงข้ามด้วย ${getCardByIdOrThrow<Card>(attacker.sourceCardId).name.th}`);
    return { state: finalize(state), result: { ok: true } };
  }

  if (!target.instanceId) {
    return { state, result: { ok: false, error: "เป้าหมายยูนิตไม่ถูกต้อง" } };
  }

  const defenderSlot = findUnitSlot(defender, target.instanceId);
  if (!defenderSlot) {
    return { state, result: { ok: false, error: "ไม่พบยูนิตเป้าหมาย" } };
  }
  const defenderUnit = defender.board[defenderSlot];
  if (!defenderUnit) {
    return { state, result: { ok: false, error: "ไม่พบยูนิตเป้าหมาย" } };
  }

  const defenderRef: ResolvedTargetUnit = {
    kind: "UNIT",
    playerId: defenderId,
    slot: defenderSlot,
    unit: defenderUnit,
  };
  const attackerRef: ResolvedTargetUnit = {
    kind: "UNIT",
    playerId: actorId,
    slot: attackerSlot,
    unit: attacker,
  };

  const dealtByAttacker = dealDamageToUnit(state, defenderRef, attacker.attack, "โจมตี", actorId);
  const dealtByDefender = dealDamageToUnit(state, attackerRef, defenderUnit.attack, "สวนกลับ", defenderId);

  if (attacker.keywords.includes("LIFESTEAL") && dealtByAttacker > 0) {
    healKing(state, actorId, dealtByAttacker);
  }
  if (defenderUnit.keywords.includes("LIFESTEAL") && dealtByDefender > 0) {
    healKing(state, defenderId, dealtByDefender);
  }

  addLog(
    state,
    `${actor.name} โจมตี ${getCardByIdOrThrow<Card>(defenderUnit.sourceCardId).name.th} ของ ${defender.name} ด้วย ${getCardByIdOrThrow<Card>(attacker.sourceCardId).name.th}`,
  );

  return { state: finalize(state), result: { ok: true } };
}

export function endTurnAction(input: GameState): { state: GameState; result: ActionResult } {
  const state = cloneState(input);
  if (state.status !== "IN_PROGRESS") {
    return { state, result: { ok: false, error: "เกมนี้จบแล้ว" } };
  }

  const actorId = state.activePlayerId;
  discardDownToLimit(state, actorId);

  const nextId = getOpponentId(actorId);
  state.activePlayerId = nextId;
  state.turn += 1;
  state.phase = "MAIN";

  refreshForTurnStart(state, nextId);

  addLog(state, `เทิร์น ${state.turn}: ถึงตา ${state.players[nextId].name}`);
  return { state: finalize(state), result: { ok: true } };
}

export function concedeAction(input: GameState): { state: GameState; result: ActionResult } {
  const state = cloneState(input);
  if (state.status !== "IN_PROGRESS") {
    return { state, result: { ok: false, error: "เกมนี้จบแล้ว" } };
  }

  const loser = state.activePlayerId;
  const winner = getOpponentId(loser);
  state.status = "ENDED";
  state.winner = winner;
  addLog(state, `${state.players[loser].name} ยอมแพ้`);
  return { state, result: { ok: true } };
}

export function getValidSummonSlots(state: GameState, handId: string): SlotId[] {
  const actor = state.players[state.activePlayerId];
  const handCard = actor.hand.find((item) => item.handId === handId);
  if (!handCard || handCard.card.cardType !== "UNIT") {
    return [];
  }
  return availableSlots(actor, handCard.card.deployment ?? "FRONT_ONLY");
}

export function getCommanderDeploySlots(state: GameState): SlotId[] {
  const actor = state.players[state.activePlayerId];
  if (actor.commanderInstanceId) {
    return [];
  }
  return availableSlots(actor, actor.commander.deployment);
}

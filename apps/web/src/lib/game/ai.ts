import {
  attackAction,
  BOARD_ALL,
  BOARD_BACK,
  BOARD_FRONT,
  commanderAuraAction,
  deployCommanderAction,
  getCommanderDeploySlots,
  getValidSummonSlots,
  playCardAction,
  ultimateAction,
} from "@/lib/game/engine";
import {
  type Ability,
  type ActionTarget,
  type AiDifficulty,
  type DeckCard,
  type GameState,
  type PlayerId,
  type SlotId,
} from "@/lib/game/types";

type PlannedAiAction =
  | { kind: "PLAY_CARD"; handId: string; slot: SlotId | null; target: ActionTarget | null }
  | { kind: "DEPLOY_COMMANDER"; slot: SlotId }
  | { kind: "TRIGGER_AURA"; target: ActionTarget | null }
  | { kind: "TRIGGER_ULTIMATE" }
  | { kind: "ATTACK"; attackerInstanceId: string; target: ActionTarget };

interface CandidateAction {
  action: PlannedAiAction;
  nextState: GameState;
}

function getOpponentId(playerId: PlayerId): PlayerId {
  return playerId === "P1" ? "P2" : "P1";
}

function evaluateState(state: GameState, actorId: PlayerId): number {
  if (state.status === "ENDED") {
    if (state.winner === actorId) {
      return 100000;
    }
    if (state.winner && state.winner !== actorId) {
      return -100000;
    }
    return 0;
  }

  const enemyId = getOpponentId(actorId);
  const actor = state.players[actorId];
  const enemy = state.players[enemyId];

  let actorAtk = 0;
  let actorHp = 0;
  let actorCount = 0;
  let actorReady = 0;

  let enemyAtk = 0;
  let enemyHp = 0;
  let enemyCount = 0;
  let enemyReady = 0;

  for (const slot of BOARD_ALL) {
    const a = actor.board[slot];
    if (a) {
      actorAtk += a.attack;
      actorHp += a.hp;
      actorCount += 1;
      if (a.canAttack) {
        actorReady += 1;
      }
    }
    const b = enemy.board[slot];
    if (b) {
      enemyAtk += b.attack;
      enemyHp += b.hp;
      enemyCount += 1;
      if (b.canAttack) {
        enemyReady += 1;
      }
    }
  }

  return (
    (actor.kingHp - enemy.kingHp) * 22 +
    (actorAtk - enemyAtk) * 3.8 +
    (actorHp - enemyHp) * 1.4 +
    (actorCount - enemyCount) * 5 +
    (actorReady - enemyReady) * 1.5 +
    (actor.hand.length - enemy.hand.length) * 2 +
    (actor.sideStacks - enemy.sideStacks) * 2.5 +
    (actor.mana.current - enemy.mana.current) * 0.6
  );
}

function ownersToPlayerIds(owner: Ability["target"]["owner"], actorId: PlayerId): PlayerId[] {
  if (owner === "SELF" || owner === "ALLY") {
    return [actorId];
  }
  if (owner === "ENEMY") {
    return [getOpponentId(actorId)];
  }
  if (owner === "BOTH") {
    return [actorId, getOpponentId(actorId)];
  }
  return [];
}

function chosenAbilityTargets(state: GameState, actorId: PlayerId, ability: Ability): ActionTarget[] {
  const targets: ActionTarget[] = [];
  const players = ownersToPlayerIds(ability.target.owner, actorId);

  for (const playerId of players) {
    const player = state.players[playerId];
    const targetOwner: ActionTarget["owner"] = playerId === actorId ? "SELF" : "ENEMY";

    if (ability.target.zone === "KING") {
      targets.push({ owner: targetOwner, kind: "KING" });
      continue;
    }

    if (ability.target.zone === "COMMANDER") {
      if (player.commanderInstanceId) {
        targets.push({
          owner: targetOwner,
          kind: "UNIT",
          instanceId: player.commanderInstanceId,
        });
      }
      continue;
    }

    let slots: SlotId[] = [];
    if (ability.target.zone === "BOARD_FRONT") {
      slots = BOARD_FRONT;
    } else if (ability.target.zone === "BOARD_BACK") {
      slots = BOARD_BACK;
    } else if (ability.target.zone === "BOARD_ANY" || ability.target.zone === "UNIT_ANY") {
      slots = BOARD_ALL;
    }

    for (const slot of slots) {
      const unit = player.board[slot];
      if (!unit) {
        continue;
      }
      targets.push({
        owner: targetOwner,
        kind: "UNIT",
        instanceId: unit.instanceId,
      });
    }

    if (ability.target.zone === "BOARD_ANY" && ability.target.allowKing) {
      targets.push({ owner: targetOwner, kind: "KING" });
    }
  }

  const dedupe = new Map<string, ActionTarget>();
  for (const target of targets) {
    const key = `${target.owner}-${target.kind}-${target.instanceId ?? "KING"}`;
    dedupe.set(key, target);
  }
  return [...dedupe.values()];
}

function chosenAbilityFromCard(card: DeckCard): Ability | null {
  return (
    card.abilities?.find((ability) => {
      return (
        ["ON_CAST", "ON_PLAY", "ON_SUMMON"].includes(ability.trigger) &&
        ability.target.selector === "CHOSEN"
      );
    }) ?? null
  );
}

function generatePlayCardCandidates(state: GameState, actorId: PlayerId): CandidateAction[] {
  const actor = state.players[actorId];
  const result: CandidateAction[] = [];

  for (const handCard of actor.hand) {
    const card = handCard.card;
    const chosenAbility = chosenAbilityFromCard(card);
    const targetOptions = chosenAbility ? chosenAbilityTargets(state, actorId, chosenAbility) : [null];

    if (chosenAbility && !targetOptions.length) {
      continue;
    }

    if (card.cardType === "UNIT") {
      const slots = getValidSummonSlots(state, handCard.handId);
      for (const slot of slots) {
        for (const target of targetOptions) {
          const next = playCardAction(state, handCard.handId, slot, target);
          if (!next.result.ok) {
            continue;
          }
          result.push({
            action: {
              kind: "PLAY_CARD",
              handId: handCard.handId,
              slot,
              target,
            },
            nextState: next.state,
          });
        }
      }
      continue;
    }

    for (const target of targetOptions) {
      const next = playCardAction(state, handCard.handId, null, target);
      if (!next.result.ok) {
        continue;
      }
      result.push({
        action: {
          kind: "PLAY_CARD",
          handId: handCard.handId,
          slot: null,
          target,
        },
        nextState: next.state,
      });
    }
  }

  return result;
}

function generateCommanderCandidates(state: GameState, actorId: PlayerId): CandidateAction[] {
  const deploy: CandidateAction[] = [];
  const aura: CandidateAction[] = [];

  for (const slot of getCommanderDeploySlots(state)) {
    const next = deployCommanderAction(state, slot);
    if (!next.result.ok) {
      continue;
    }
    deploy.push({
      action: { kind: "DEPLOY_COMMANDER", slot },
      nextState: next.state,
    });
  }

  const actor = state.players[actorId];
  const auraList = actor.commanderAuraMode === "BURST" ? actor.commander.aura.burst : actor.commander.aura.pulse;
  const chosenAura = auraList.find((ability) => ability.target.selector === "CHOSEN") ?? null;
  const targetOptions = chosenAura ? chosenAbilityTargets(state, actorId, chosenAura) : [null];

  if (!chosenAura || targetOptions.length) {
    for (const target of targetOptions) {
      const next = commanderAuraAction(state, target);
      if (!next.result.ok) {
        continue;
      }
      aura.push({
        action: { kind: "TRIGGER_AURA", target },
        nextState: next.state,
      });
    }
  }

  return [...deploy, ...aura];
}

function generateUltimateCandidates(state: GameState): CandidateAction[] {
  const next = ultimateAction(state);
  if (!next.result.ok) {
    return [];
  }
  return [
    {
      action: { kind: "TRIGGER_ULTIMATE" },
      nextState: next.state,
    },
  ];
}

function generateAttackCandidates(state: GameState, actorId: PlayerId): CandidateAction[] {
  const enemyId = getOpponentId(actorId);
  const actor = state.players[actorId];
  const enemy = state.players[enemyId];
  const candidates: CandidateAction[] = [];

  const possibleTargets: ActionTarget[] = [{ owner: "ENEMY", kind: "KING" }];
  for (const slot of BOARD_ALL) {
    const unit = enemy.board[slot];
    if (!unit) {
      continue;
    }
    possibleTargets.push({
      owner: "ENEMY",
      kind: "UNIT",
      instanceId: unit.instanceId,
    });
  }

  for (const slot of BOARD_ALL) {
    const unit = actor.board[slot];
    if (!unit || !unit.canAttack) {
      continue;
    }
    for (const target of possibleTargets) {
      const next = attackAction(state, unit.instanceId, target);
      if (!next.result.ok) {
        continue;
      }
      candidates.push({
        action: {
          kind: "ATTACK",
          attackerInstanceId: unit.instanceId,
          target,
        },
        nextState: next.state,
      });
    }
  }

  return candidates;
}

function generateAllCandidates(state: GameState): CandidateAction[] {
  const actorId = state.activePlayerId;
  return [
    ...generatePlayCardCandidates(state, actorId),
    ...generateCommanderCandidates(state, actorId),
    ...generateUltimateCandidates(state),
    ...generateAttackCandidates(state, actorId),
  ];
}

function chooseEasyAction(candidates: CandidateAction[]): CandidateAction | null {
  if (!candidates.length) {
    return null;
  }
  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex] ?? null;
}

function chooseGreedyAction(
  candidates: CandidateAction[],
  actorId: PlayerId,
  difficulty: Exclude<AiDifficulty, "EASY">,
): CandidateAction | null {
  if (!candidates.length) {
    return null;
  }

  let best: CandidateAction | null = null;
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const immediate = evaluateState(candidate.nextState, actorId);
    let score = immediate;

    if (difficulty === "HARD") {
      const followUps = generateAllCandidates(candidate.nextState).slice(0, 12);
      let bestFollow = immediate;
      for (const next of followUps) {
        const nextScore = evaluateState(next.nextState, actorId);
        if (nextScore > bestFollow) {
          bestFollow = nextScore;
        }
      }
      score = immediate * 0.8 + bestFollow * 0.2;
    }

    if (!best || score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

export function pickAiAction(state: GameState, difficulty: AiDifficulty): PlannedAiAction | null {
  if (state.status !== "IN_PROGRESS") {
    return null;
  }

  const candidates = generateAllCandidates(state);
  if (!candidates.length) {
    return null;
  }

  if (difficulty === "EASY") {
    return chooseEasyAction(candidates)?.action ?? null;
  }
  if (difficulty === "NORMAL") {
    return chooseGreedyAction(candidates, state.activePlayerId, "NORMAL")?.action ?? null;
  }
  return chooseGreedyAction(candidates, state.activePlayerId, "HARD")?.action ?? null;
}


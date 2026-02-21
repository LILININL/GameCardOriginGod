"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CardDetailModal } from "@/components/CardDetailModal";
import { cardsById, commanders, kings } from "@/lib/cards";
import { recommendBestDeckForKingId } from "@/lib/game/deck-recommend";
import { chosenTargetCardRule, explainDeckRequirements } from "@/lib/game/card-explain";
import { pickAiAction } from "@/lib/game/ai";
import {
  BOARD_ALL,
  BOARD_BACK,
  BOARD_FRONT,
  attackAction as simulateAttackAction,
  playCardAction as simulatePlayCardAction,
} from "@/lib/game/engine";
import { useGameStore } from "@/lib/game/store";
import {
  type ActionTarget,
  type AiDifficulty,
  type AuraMode,
  type DeckCard,
  type Phase,
  type PlayerControl,
  type PlayerId,
  type SlotId,
  type UnitInstance,
} from "@/lib/game/types";

type UiMode = "IDLE" | "SUMMON" | "CAST_TARGET" | "CAST_READY" | "ATTACK" | "DEPLOY_COMMANDER";
type ZoneVariant = "FOCUS" | "SECONDARY";

interface BoardSlotTileProps {
  ownerId: PlayerId;
  ownerName: string;
  slot: SlotId;
  unit: UnitInstance | null;
  compact: boolean;
  isActiveOwner: boolean;
  highlightSummon: boolean;
  highlightCommander: boolean;
  highlightAttackTarget: boolean;
  isAttacker: boolean;
  isTarget: boolean;
  registerRef?: (element: HTMLButtonElement | null) => void;
  onClick: () => void;
}

interface TurnPassOverlayProps {
  open: boolean;
  activePlayerName: string;
  activePlayerId: PlayerId;
  turn: number;
  onClose: () => void;
}

interface CardTargetCandidate {
  key: string;
  label: string;
  target: ActionTarget;
}

interface GuideLineSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: "UNIT" | "KING";
}

interface ActionTooltipButtonProps {
  label: string;
  tooltip: string;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}

function auraModeText(mode: AuraMode): string {
  return mode === "BURST" ? "ระเบิดครั้งเดียว" : "คูลดาวน์ 2 เทิร์น";
}

function controlText(control: PlayerControl): string {
  return control === "AI" ? "AI" : "ผู้เล่น";
}

function aiDifficultyText(level: AiDifficulty): string {
  if (level === "EASY") {
    return "ง่าย";
  }
  if (level === "NORMAL") {
    return "ปานกลาง";
  }
  return "ยาก";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function playerIdText(playerId: PlayerId): string {
  return playerId === "P1" ? "ผู้เล่น 1" : "ผู้เล่น 2";
}

function phaseText(phase: Phase): string {
  if (phase === "MAIN") {
    return "ช่วงลงการ์ด";
  }
  if (phase === "BATTLE") {
    return "ช่วงโจมตี";
  }
  return "ช่วงจบเทิร์น";
}

function targetOwnerText(owner: "SELF" | "ENEMY"): string {
  return owner === "SELF" ? "ฝั่งตัวเอง" : "ฝั่งตรงข้าม";
}

function targetKindText(kind: "UNIT" | "KING"): string {
  return kind === "UNIT" ? "ยูนิต" : "ราชา";
}

function cardTypeText(card: DeckCard): string {
  if (card.cardType === "UNIT") {
    return "ยูนิต";
  }
  if (card.cardType === "SPELL_GENERIC") {
    return "เวททั่วไป";
  }
  if (card.cardType === "SPELL_CLASS") {
    return "เวทอาชีพ";
  }
  if (card.cardType === "SKILL_RACE") {
    return "สกิลเผ่า";
  }
  return "สกิลฝั่ง";
}

function cardNeedsChosenTarget(card: DeckCard): boolean {
  return (
    card.abilities?.some((ability) => {
      return (
        ["ON_CAST", "ON_PLAY", "ON_SUMMON"].includes(ability.trigger) &&
        ability.target.selector === "CHOSEN"
      );
    }) ?? false
  );
}

function abilityOwnersToPlayerIds(
  owner: "SELF" | "ALLY" | "ENEMY" | "BOTH" | "NONE",
  activeId: PlayerId,
): PlayerId[] {
  if (owner === "SELF" || owner === "ALLY") {
    return [activeId];
  }
  if (owner === "ENEMY") {
    return [activeId === "P1" ? "P2" : "P1"];
  }
  if (owner === "BOTH") {
    return ["P1", "P2"];
  }
  return [];
}

function unitDisplayName(unit: UnitInstance): string {
  const source = cardsById.get(unit.sourceCardId);
  if (!source) {
    return unit.sourceCardId;
  }
  return source.name.th;
}

function ActionTooltipButton({
  label,
  tooltip,
  disabled,
  className,
  onClick,
}: ActionTooltipButtonProps): React.JSX.Element {
  return (
    <div className="group/action relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={className}
      >
        {label}
      </button>
      <div className="pointer-events-none absolute right-0 top-full z-30 mt-1 w-72 translate-y-1 rounded-lg border border-[var(--line)] bg-white px-2 py-1.5 text-[11px] text-[var(--muted)] opacity-0 shadow-md transition duration-150 group-focus-within/action:translate-y-0 group-focus-within/action:opacity-100 group-hover/action:translate-y-0 group-hover/action:opacity-100">
        {tooltip}
      </div>
    </div>
  );
}

function BoardSlotTile({
  ownerId,
  ownerName,
  slot,
  unit,
  compact,
  isActiveOwner,
  highlightSummon,
  highlightCommander,
  highlightAttackTarget,
  isAttacker,
  isTarget,
  registerRef,
  onClick,
}: BoardSlotTileProps): React.JSX.Element {
  return (
    <button
      type="button"
      ref={registerRef}
      onClick={onClick}
      className={`rounded-2xl border text-left transition ${compact ? "min-h-[86px] p-2" : "min-h-[112px] p-3"} ${
        unit
          ? "border-[var(--line)] bg-[var(--card)] hover:border-[var(--accent)]"
          : "border-[var(--line)] bg-[var(--chip)]"
      } ${highlightSummon ? "border-[var(--accent)] bg-[#e7f6ee]" : ""} ${
        highlightCommander ? "border-[#4e6ad6] bg-[#eef1ff]" : ""
      } ${highlightAttackTarget ? "border-[#d4983a] bg-[#fff8ea] animate-[targetCandidatePulse_1.2s_ease-in-out_infinite]" : ""} ${
        isAttacker ? "ring-2 ring-[var(--accent)] animate-[attackerPulse_1s_ease-in-out_infinite]" : ""
      } ${isTarget ? "ring-2 ring-[#d4983a] animate-[targetPulse_0.9s_ease-in-out_infinite]" : ""}`}
    >
      <div className={`flex items-center justify-between text-[var(--muted)] ${compact ? "text-[10px]" : "text-[11px]"}`}>
        <span>{ownerName}</span>
        <span>{ownerId} • {slot}</span>
      </div>

      {unit ? (
        <div className="mt-2 space-y-1">
          <p className={`overflow-hidden font-semibold leading-tight ${compact ? "max-h-8 text-xs" : "max-h-10 text-sm"}`}>
            {unitDisplayName(unit)}
          </p>
          <div className={`flex flex-wrap gap-1 text-[var(--muted)] ${compact ? "text-[10px]" : "text-[11px]"}`}>
            <span className="rounded-full bg-[var(--chip)] px-2 py-0.5">โจมตี {unit.attack}</span>
            <span className="rounded-full bg-[var(--chip)] px-2 py-0.5">พลังชีวิต {unit.hp}</span>
            {unit.canAttack && isActiveOwner ? (
              <span className="rounded-full bg-[#d9f4e6] px-2 py-0.5">พร้อมโจมตี</span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-1 text-xs text-[var(--muted)]">
          <p>ช่องว่าง</p>
          {highlightSummon ? <p className="font-semibold text-[var(--accent)]">ลงยูนิตได้</p> : null}
          {highlightCommander ? <p className="font-semibold text-[#4e6ad6]">ลงแม่ทัพได้</p> : null}
        </div>
      )}
    </button>
  );
}

function TurnPassOverlay({
  open,
  activePlayerName,
  activePlayerId,
  turn,
  onClose,
}: TurnPassOverlayProps): React.JSX.Element | null {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xl">
        <p className="text-xs font-semibold text-[var(--muted)]">สลับผู้เล่น</p>
        <h3 className="mt-1 text-2xl font-semibold">ถึงตา {activePlayerName}</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {playerIdText(activePlayerId)} • เทิร์นที่ {turn}
        </p>
        <p className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--chip)] p-2 text-sm text-[var(--muted)]">
          ส่งหน้าจอให้ผู้เล่นคนถัดไป แล้วกดเริ่มเทิร์น
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
        >
          เริ่มเทิร์นของ {activePlayerName}
        </button>
      </div>
    </div>
  );
}

function modeHint(mode: UiMode, cardName: string | null): string {
  if (mode === "DEPLOY_COMMANDER") {
    return "โหมดลงแม่ทัพ: กดช่องสีน้ำเงินในกระดานฝั่งที่กำลังเล่น";
  }
  if (mode === "ATTACK") {
    return "โหมดโจมตี: เลือกเป้าหมายฝั่งตรงข้าม (ยูนิตหรือราชา)";
  }
  if (mode === "SUMMON") {
    return `โหมดลงยูนิต: เลือกช่องสีเขียวเพื่อวาง ${cardName ?? "ยูนิต"}`;
  }
  if (mode === "CAST_TARGET") {
    return `โหมดร่ายเวท: เลือกเป้าหมายก่อนใช้ ${cardName ?? "การ์ด"}`;
  }
  if (mode === "CAST_READY") {
    return `พร้อมใช้ ${cardName ?? "การ์ด"}: กดปุ่ม "ใช้การ์ดที่เลือก"`;
  }
  return "เริ่มจากเลือกการ์ดในมือ หรือเลือกยูนิตที่พร้อมโจมตี";
}

function modeSteps(mode: UiMode, cardName: string | null, isAiTurn: boolean): string[] {
  if (isAiTurn) {
    return ["รอ AI ตัดสินใจอัตโนมัติ", "สังเกตบันทึกการต่อสู้เพื่อเรียนรู้จังหวะเล่น"];
  }

  if (mode === "DEPLOY_COMMANDER") {
    return ["1) คลิกช่องสีน้ำเงินบนกระดานหลัก", "2) ตรวจมานาก่อนกดจบเทิร์น"];
  }
  if (mode === "SUMMON") {
    return [`1) เลือกช่องสีเขียวเพื่อวาง ${cardName ?? "ยูนิต"}`, "2) วางแผนเป้าหมายโจมตีต่อทันที"];
  }
  if (mode === "CAST_TARGET") {
    return [`1) เลือกเป้าหมายของ ${cardName ?? "การ์ด"}`, "2) กดปุ่มใช้การ์ดที่เลือก"];
  }
  if (mode === "CAST_READY") {
    return [`1) กดใช้ ${cardName ?? "การ์ด"} ได้เลย`, "2) ไปต่อช่วงโจมตีหรือจบเทิร์น"];
  }
  if (mode === "ATTACK") {
    return ["1) เลือกเป้าหมายฝั่งตรงข้ามบนกระดานรอง", "2) โจมตีครบแล้วกดจบเทิร์น"];
  }
  return ["1) เริ่มจากเลือกการ์ดในมือ หรือยูนิตที่พร้อมโจมตี", "2) ทำแอ็กชันเสร็จแล้วกดจบเทิร์น"];
}

function findUnitByInstanceId(units: (UnitInstance | null)[], instanceId: string): UnitInstance | null {
  for (const unit of units) {
    if (unit?.instanceId === instanceId) {
      return unit;
    }
  }
  return null;
}

export function GameRoom(): React.JSX.Element {
  const state = useGameStore((store) => store.state);
  const config = useGameStore((store) => store.config);
  const lastError = useGameStore((store) => store.lastError);
  const note = useGameStore((store) => store.note);
  const updateConfig = useGameStore((store) => store.updateConfig);
  const startMatchWithConfig = useGameStore((store) => store.startMatchWithConfig);
  const resetMatch = useGameStore((store) => store.resetMatch);
  const playCard = useGameStore((store) => store.playCard);
  const deployCommander = useGameStore((store) => store.deployCommander);
  const triggerCommanderAura = useGameStore((store) => store.triggerCommanderAura);
  const triggerUltimate = useGameStore((store) => store.triggerUltimate);
  const attack = useGameStore((store) => store.attack);
  const endTurn = useGameStore((store) => store.endTurn);
  const concede = useGameStore((store) => store.concede);
  const validSummonSlots = useGameStore((store) => store.validSummonSlots);
  const commanderSlots = useGameStore((store) => store.commanderSlots);
  const validateDeckForPlayer = useGameStore((store) => store.validateDeckForPlayer);

  const [selectedHandId, setSelectedHandId] = useState<string | null>(null);
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<ActionTarget | null>(null);
  const [commanderDeployMode, setCommanderDeployMode] = useState(false);
  const [turnPassOpen, setTurnPassOpen] = useState(false);
  const [handPopupId, setHandPopupId] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [showGuideLines, setShowGuideLines] = useState(true);
  const [guideLines, setGuideLines] = useState<GuideLineSegment[]>([]);
  const [menuActiveKey, setMenuActiveKey] = useState<string | null>(null);
  const [menuFeedback, setMenuFeedback] = useState<string | null>(null);
  const aiTurnKeyRef = useRef<string>("");
  const boardOverlayRef = useRef<HTMLDivElement | null>(null);
  const slotButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const kingButtonRefs = useRef<Record<PlayerId, HTMLButtonElement | null>>({
    P1: null,
    P2: null,
  });
  const menuFeedbackTimerRef = useRef<number | null>(null);

  const activeId = state.activePlayerId;
  const waitingId: PlayerId = activeId === "P1" ? "P2" : "P1";
  const active = state.players[activeId];
  const waiting = state.players[waitingId];
  const isEnded = state.status === "ENDED";
  const activeControl = config[activeId].control;
  const activeDifficulty = config[activeId].aiDifficulty;
  const isAiTurn = activeControl === "AI";
  const inputLocked = isEnded || isAiTurn || aiThinking;

  const selectedHandCard = useMemo(() => {
    if (!selectedHandId) {
      return null;
    }
    return active.hand.find((item) => item.handId === selectedHandId) ?? null;
  }, [active.hand, selectedHandId]);

  const popupHandCard = useMemo(() => {
    if (!handPopupId) {
      return null;
    }
    return active.hand.find((item) => item.handId === handPopupId) ?? null;
  }, [active.hand, handPopupId]);

  const summonSlots = useMemo(() => {
    if (!selectedHandId) {
      return [];
    }
    return validSummonSlots(selectedHandId);
  }, [selectedHandId, validSummonSlots]);

  const commanderDeploySlots = commanderSlots();
  const selectedCardNeedsTarget = selectedHandCard ? cardNeedsChosenTarget(selectedHandCard.card) : false;
  const canCastSelected =
    !!selectedHandCard &&
    selectedHandCard.card.cardType !== "UNIT" &&
    (!selectedCardNeedsTarget || !!selectedTarget);
  const popupCardNeedsTarget = popupHandCard ? cardNeedsChosenTarget(popupHandCard.card) : false;
  const popupTargetHint = popupHandCard ? chosenTargetCardRule(popupHandCard.card).targetHint : null;

  const buildChosenTargetCandidates = useCallback((card: DeckCard): CardTargetCandidate[] => {
    const chosenAbility = card.abilities?.find((ability) => {
      return (
        ["ON_CAST", "ON_PLAY", "ON_SUMMON"].includes(ability.trigger) &&
        ability.target.selector === "CHOSEN"
      );
    });
    if (!chosenAbility) {
      return [];
    }

    const candidates: CardTargetCandidate[] = [];
    const playerIds = abilityOwnersToPlayerIds(chosenAbility.target.owner, activeId);

    for (const playerId of playerIds) {
      const player = state.players[playerId];
      const targetOwner: ActionTarget["owner"] = playerId === activeId ? "SELF" : "ENEMY";

      if (chosenAbility.target.zone === "KING") {
        candidates.push({
          key: `${playerId}-KING`,
          label: `ราชา ${player.name}`,
          target: { owner: targetOwner, kind: "KING" },
        });
        continue;
      }

      if (chosenAbility.target.zone === "COMMANDER") {
        if (!player.commanderInstanceId) {
          continue;
        }
        const commanderSlot = [...BOARD_FRONT, ...BOARD_BACK].find((slot) => {
          return player.board[slot]?.instanceId === player.commanderInstanceId;
        });
        if (!commanderSlot || !player.board[commanderSlot]) {
          continue;
        }
        candidates.push({
          key: `${playerId}-${player.commanderInstanceId}`,
          label: `${player.name} • แม่ทัพ (${commanderSlot})`,
          target: {
            owner: targetOwner,
            kind: "UNIT",
            instanceId: player.commanderInstanceId,
          },
        });
        continue;
      }

      let slots: SlotId[] = [];
      if (chosenAbility.target.zone === "BOARD_FRONT") {
        slots = BOARD_FRONT;
      } else if (chosenAbility.target.zone === "BOARD_BACK") {
        slots = BOARD_BACK;
      } else if (["BOARD_ANY", "UNIT_ANY"].includes(chosenAbility.target.zone)) {
        slots = [...BOARD_FRONT, ...BOARD_BACK];
      }

      for (const slot of slots) {
        const unit = player.board[slot];
        if (!unit) {
          continue;
        }
        candidates.push({
          key: `${playerId}-${unit.instanceId}`,
          label: `${player.name} • ${unitDisplayName(unit)} (${slot})`,
          target: {
            owner: targetOwner,
            kind: "UNIT",
            instanceId: unit.instanceId,
          },
        });
      }

      if (chosenAbility.target.zone === "BOARD_ANY" && chosenAbility.target.allowKing) {
        candidates.push({
          key: `${playerId}-KING-BOARD_ANY`,
          label: `ราชา ${player.name}`,
          target: { owner: targetOwner, kind: "KING" },
        });
      }
    }

    return candidates;
  }, [activeId, state.players]);

  const chosenTargetCandidatesByHandId = useMemo(() => {
    const map = new Map<string, CardTargetCandidate[]>();
    for (const item of active.hand) {
      if (cardNeedsChosenTarget(item.card)) {
        map.set(item.handId, buildChosenTargetCandidates(item.card));
      } else {
        map.set(item.handId, []);
      }
    }
    return map;
  }, [active.hand, buildChosenTargetCandidates]);

  const popupTargetCandidates = useMemo<CardTargetCandidate[]>(() => {
    if (!popupHandCard || !popupCardNeedsTarget) {
      return [];
    }
    return chosenTargetCandidatesByHandId.get(popupHandCard.handId) ?? [];
  }, [chosenTargetCandidatesByHandId, popupCardNeedsTarget, popupHandCard]);

  const playableByHandId = useMemo(() => {
    const result = new Map<string, boolean>();
    for (const item of active.hand) {
      const needsTarget = cardNeedsChosenTarget(item.card);
      if (item.card.cardType === "UNIT") {
        const slots = validSummonSlots(item.handId);
        if (!slots.length) {
          result.set(item.handId, false);
          continue;
        }
        if (!needsTarget) {
          result.set(item.handId, simulatePlayCardAction(state, item.handId, slots[0], null).result.ok);
          continue;
        }
        const targets = chosenTargetCandidatesByHandId.get(item.handId) ?? [];
        result.set(
          item.handId,
          targets.some((candidate) => {
            return simulatePlayCardAction(state, item.handId, slots[0], candidate.target).result.ok;
          }),
        );
        continue;
      }

      if (!needsTarget) {
        result.set(item.handId, simulatePlayCardAction(state, item.handId, null, null).result.ok);
        continue;
      }
      const targets = chosenTargetCandidatesByHandId.get(item.handId) ?? [];
      result.set(
        item.handId,
        targets.some((candidate) => {
          return simulatePlayCardAction(state, item.handId, null, candidate.target).result.ok;
        }),
      );
    }
    return result;
  }, [active.hand, chosenTargetCandidatesByHandId, state, validSummonSlots]);

  const readyAttackers = useMemo(() => {
    return BOARD_ALL.flatMap((slot) => {
      const unit = active.board[slot];
      if (!unit || !unit.canAttack) {
        return [];
      }
      return [{ slot, unit }];
    });
  }, [active.board]);

  const uiMode: UiMode = useMemo(() => {
    if (commanderDeployMode) {
      return "DEPLOY_COMMANDER";
    }
    if (selectedAttackerId) {
      return "ATTACK";
    }
    if (!selectedHandCard) {
      return "IDLE";
    }
    if (selectedHandCard.card.cardType === "UNIT") {
      return "SUMMON";
    }
    if (selectedCardNeedsTarget) {
      return "CAST_TARGET";
    }
    return "CAST_READY";
  }, [commanderDeployMode, selectedAttackerId, selectedCardNeedsTarget, selectedHandCard]);

  const currentModeSteps = useMemo(
    () => modeSteps(uiMode, selectedHandCard?.card.name.th ?? null, isAiTurn),
    [isAiTurn, selectedHandCard, uiMode],
  );

  const registerSlotRef = useCallback((ownerId: PlayerId, slot: SlotId, element: HTMLButtonElement | null) => {
    slotButtonRefs.current[`${ownerId}:${slot}`] = element;
  }, []);

  const registerKingRef = useCallback((ownerId: PlayerId, element: HTMLButtonElement | null) => {
    kingButtonRefs.current[ownerId] = element;
  }, []);

  const selectedAttackerUnit = useMemo(() => {
    if (!selectedAttackerId) {
      return null;
    }
    return findUnitByInstanceId(readyAttackers.map((item) => item.unit), selectedAttackerId);
  }, [readyAttackers, selectedAttackerId]);

  const selectedAttackerSlot = useMemo(() => {
    if (!selectedAttackerId) {
      return null;
    }
    const found = readyAttackers.find((item) => item.unit.instanceId === selectedAttackerId);
    return found?.slot ?? null;
  }, [readyAttackers, selectedAttackerId]);

  const attackTargetState = useMemo(() => {
    const unitIds = new Set<string>();
    if (!selectedAttackerId) {
      return { unitIds, canHitKing: false };
    }

    const enemy = state.players[waitingId];
    for (const slot of BOARD_ALL) {
      const enemyUnit = enemy.board[slot];
      if (!enemyUnit) {
        continue;
      }
      const simulated = simulateAttackAction(state, selectedAttackerId, {
        owner: "ENEMY",
        kind: "UNIT",
        instanceId: enemyUnit.instanceId,
      });
      if (simulated.result.ok) {
        unitIds.add(enemyUnit.instanceId);
      }
    }

    const canHitKing = simulateAttackAction(state, selectedAttackerId, {
      owner: "ENEMY",
      kind: "KING",
    }).result.ok;

    return { unitIds, canHitKing };
  }, [selectedAttackerId, state, waitingId]);

  const readyPlayableCount = useMemo(() => {
    let total = 0;
    for (const playable of playableByHandId.values()) {
      if (playable) {
        total += 1;
      }
    }
    return total;
  }, [playableByHandId]);

  const canUseUltimateAction =
    !inputLocked && !active.ultimateUsed && state.turn >= active.king.ultimate.unlockTurnMin;
  const ultimateConditionText = active.ultimateUsed
    ? "ใช้แล้วในเกมนี้"
    : state.turn < active.king.ultimate.unlockTurnMin
      ? `ใช้ได้ตั้งแต่เทิร์น ${active.king.ultimate.unlockTurnMin}`
      : "พร้อมใช้ 1 ครั้ง";

  const canUseAuraAction =
    !inputLocked &&
    !!active.commanderInstanceId &&
    (active.commanderAuraMode === "BURST"
      ? !active.commanderBurstUsed
      : active.commanderPulseCooldown <= 0);
  const auraConditionText = !active.commanderInstanceId
    ? "ต้องลงแม่ทัพก่อน"
    : active.commanderAuraMode === "BURST"
      ? active.commanderBurstUsed
        ? "โหมด BURST ใช้ไปแล้ว"
        : "พร้อมใช้ 1 ครั้ง (BURST)"
      : active.commanderPulseCooldown > 0
        ? `คูลดาวน์เหลือ ${active.commanderPulseCooldown} เทิร์น`
        : "พร้อมใช้ (PULSE)";

  const canEnterCommanderDeployMode =
    !inputLocked &&
    !active.commanderInstanceId &&
    commanderDeploySlots.length > 0 &&
    active.mana.current >= active.commander.cost.mana;
  const commanderConditionText = active.commanderInstanceId
    ? "แม่ทัพลงสนามแล้ว"
    : active.mana.current < active.commander.cost.mana
      ? `ต้องมีมานาอย่างน้อย ${active.commander.cost.mana}`
      : commanderDeploySlots.length === 0
        ? "ไม่มีช่องลงแม่ทัพในตอนนี้"
        : "พร้อมลงแม่ทัพ";

  const ultimateTooltip = canUseUltimateAction
    ? `กดแล้วจะใช้อัลติเมต "${active.king.ultimate.name.th}" ทันทีในเทิร์นนี้`
    : `ยังใช้ไม่ได้ตอนนี้: ${ultimateConditionText}`;

  const auraTooltip = canUseAuraAction
    ? `กดเพื่อใช้ออร่าแม่ทัพโหมด ${active.commanderAuraMode} ได้เลย`
    : `ยังใช้ไม่ได้ตอนนี้: ${auraConditionText}`;

  const commanderTooltip = commanderDeployMode
    ? `กำลังอยู่ในโหมดลงแม่ทัพ เลือกช่องสีน้ำเงินบนกระดานหลัก`
    : canEnterCommanderDeployMode
      ? `กดเพื่อเข้าโหมดลงแม่ทัพ จากนั้นเลือกช่องสีน้ำเงินที่ว่าง`
      : `ยังลงแม่ทัพไม่ได้: ${commanderConditionText}`;

  const endTurnTooltip =
    readyAttackers.length || readyPlayableCount
      ? `ตัวอย่างตอนนี้: ยังมียูนิตพร้อมโจมตี ${readyAttackers.length} ตัว และการ์ดที่เล่นได้ ${readyPlayableCount} ใบ`
      : `กดแล้วจะส่งเทิร์นไปที่ ${waiting.name} และเริ่มทรัพยากรเทิร์นใหม่ของอีกฝั่ง`;

  const concedeTooltip = "กดแล้วยอมแพ้ทันที และเกมจะจบทันที";

  const attackKingTooltip = !selectedAttackerUnit
    ? "ต้องเลือกยูนิตฝั่งเรา 1 ตัวก่อน"
    : attackTargetState.canHitKing
      ? `ตอนนี้ ${unitDisplayName(selectedAttackerUnit)} โจมตีราชาฝั่งตรงข้ามได้`
      : "ยังโจมตีราชาไม่ได้ เพราะยังติดกฎตำแหน่ง/แนวหน้า";

  useEffect(() => {
    if (!showGuideLines || !selectedAttackerId || !selectedAttackerSlot) {
      return;
    }

    const recalcGuideLines = (): void => {
      const container = boardOverlayRef.current;
      if (!container) {
        setGuideLines([]);
        return;
      }
      const source = slotButtonRefs.current[`${activeId}:${selectedAttackerSlot}`];
      if (!source) {
        setGuideLines([]);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const centerOf = (element: HTMLElement): { x: number; y: number } => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2,
        };
      };

      const start = centerOf(source);
      const next: GuideLineSegment[] = [];

      for (const slot of BOARD_ALL) {
        const enemyUnit = state.players[waitingId].board[slot];
        if (!enemyUnit || !attackTargetState.unitIds.has(enemyUnit.instanceId)) {
          continue;
        }
        const targetElement = slotButtonRefs.current[`${waitingId}:${slot}`];
        if (!targetElement) {
          continue;
        }
        const end = centerOf(targetElement);
        next.push({
          id: `UNIT-${enemyUnit.instanceId}`,
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y,
          kind: "UNIT",
        });
      }

      if (attackTargetState.canHitKing) {
        const kingElement = kingButtonRefs.current[waitingId];
        if (kingElement) {
          const end = centerOf(kingElement);
          next.push({
            id: `KING-${waitingId}`,
            x1: start.x,
            y1: start.y,
            x2: end.x,
            y2: end.y,
            kind: "KING",
          });
        }
      }

      setGuideLines(next);
    };

    const rafId = window.requestAnimationFrame(recalcGuideLines);
    window.addEventListener("resize", recalcGuideLines);
    window.addEventListener("scroll", recalcGuideLines, true);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", recalcGuideLines);
      window.removeEventListener("scroll", recalcGuideLines, true);
    };
  }, [
    activeId,
    attackTargetState,
    selectedAttackerId,
    selectedAttackerSlot,
    showGuideLines,
    state.players,
    waitingId,
  ]);

  const clearSelections = (): void => {
    setSelectedHandId(null);
    setSelectedAttackerId(null);
    setSelectedTarget(null);
    setCommanderDeployMode(false);
    setHandPopupId(null);
  };

  const runMenuAction = (actionKey: string, feedbackText: string, action: () => void): void => {
    action();
    setMenuActiveKey(actionKey);
    setMenuFeedback(feedbackText);
    if (menuFeedbackTimerRef.current) {
      window.clearTimeout(menuFeedbackTimerRef.current);
    }
    menuFeedbackTimerRef.current = window.setTimeout(() => {
      setMenuActiveKey(null);
      setMenuFeedback(null);
      menuFeedbackTimerRef.current = null;
    }, 1200);
  };

  const runAndClearOnSuccess = (ok: boolean): void => {
    if (ok) {
      clearSelections();
    }
  };

  const startConfiguredMatch = (): void => {
    startMatchWithConfig();
    clearSelections();
    setAiThinking(false);
    setTurnPassOpen(false);
    aiTurnKeyRef.current = "";
  };

  const resetCurrentMatch = (): void => {
    resetMatch();
    clearSelections();
    setAiThinking(false);
    setTurnPassOpen(false);
    aiTurnKeyRef.current = "";
  };

  const startVsAiMatch = (difficulty: AiDifficulty): void => {
    const nextConfig = {
      ...config,
      P1: {
        ...config.P1,
        control: "HUMAN" as const,
      },
      P2: {
        ...config.P2,
        control: "AI" as const,
        aiDifficulty: difficulty,
        name: config.P2.name.trim() || "AI Bot",
      },
    };
    startMatchWithConfig(nextConfig);
    clearSelections();
    setAiThinking(false);
    setTurnPassOpen(false);
    aiTurnKeyRef.current = "";
  };

  const selectHandCard = (handId: string): void => {
    if (isAiTurn) {
      return;
    }
    if (selectedHandId === handId) {
      setSelectedHandId(null);
      setSelectedTarget(null);
      return;
    }
    setSelectedHandId(handId);
    setSelectedAttackerId(null);
    setCommanderDeployMode(false);
    setSelectedTarget(null);
  };

  const openHandPopup = (handId: string): void => {
    if (isAiTurn) {
      return;
    }
    setHandPopupId(handId);
    setSelectedAttackerId(null);
    setCommanderDeployMode(false);
    setSelectedHandId(handId);
    setSelectedTarget(null);
  };

  const prepareCardFromPopup = (): void => {
    if (!popupHandCard) {
      return;
    }
    setSelectedHandId(popupHandCard.handId);
    setSelectedAttackerId(null);
    setCommanderDeployMode(false);
    setHandPopupId(null);
  };

  const onSlotClick = (ownerId: PlayerId, slot: SlotId): void => {
    if (isAiTurn) {
      return;
    }
    if (ownerId !== activeId) {
      return;
    }

    if (commanderDeployMode && commanderDeploySlots.includes(slot)) {
      const result = deployCommander(slot);
      runAndClearOnSuccess(result.ok);
      return;
    }

    if (selectedHandCard?.card.cardType === "UNIT" && summonSlots.includes(slot)) {
      const result = playCard(selectedHandCard.handId, slot, selectedTarget);
      runAndClearOnSuccess(result.ok);
    }
  };

  const onUnitClick = (ownerId: PlayerId, unit: UnitInstance): void => {
    if (isAiTurn) {
      return;
    }
    if (selectedAttackerId && ownerId !== activeId) {
      const result = attack(selectedAttackerId, {
        owner: "ENEMY",
        kind: "UNIT",
        instanceId: unit.instanceId,
      });
      runAndClearOnSuccess(result.ok);
      return;
    }

    if (selectedHandCard && selectedCardNeedsTarget) {
      setSelectedTarget({
        owner: ownerId === activeId ? "SELF" : "ENEMY",
        kind: "UNIT",
        instanceId: unit.instanceId,
      });
      return;
    }

    if (ownerId === activeId && unit.canAttack) {
      setSelectedAttackerId(unit.instanceId);
      setSelectedHandId(null);
      setCommanderDeployMode(false);
      setSelectedTarget(null);
    }
  };

  const onKingClick = (ownerId: PlayerId): void => {
    if (isAiTurn) {
      return;
    }
    if (selectedAttackerId && ownerId !== activeId) {
      const result = attack(selectedAttackerId, {
        owner: "ENEMY",
        kind: "KING",
      });
      runAndClearOnSuccess(result.ok);
      return;
    }

    if (selectedHandCard && selectedCardNeedsTarget) {
      setSelectedTarget({
        owner: ownerId === activeId ? "SELF" : "ENEMY",
        kind: "KING",
      });
    }
  };

  const castSelectedCard = (): void => {
    if (isAiTurn) {
      return;
    }
    if (!selectedHandCard || selectedHandCard.card.cardType === "UNIT") {
      return;
    }
    if (selectedCardNeedsTarget && !selectedTarget) {
      return;
    }

    const result = playCard(selectedHandCard.handId, null, selectedTarget);
    runAndClearOnSuccess(result.ok);
  };

  const castPopupCard = (): void => {
    if (isAiTurn) {
      return;
    }
    if (!popupHandCard || popupHandCard.card.cardType === "UNIT") {
      return;
    }
    if (popupCardNeedsTarget && !selectedTarget) {
      return;
    }
    const result = playCard(popupHandCard.handId, null, selectedTarget);
    runAndClearOnSuccess(result.ok);
  };

  const selectAttackerFromPanel = (instanceId: string): void => {
    if (inputLocked) {
      return;
    }
    if (selectedAttackerId === instanceId) {
      setSelectedAttackerId(null);
      return;
    }
    setSelectedAttackerId(instanceId);
    setSelectedHandId(null);
    setCommanderDeployMode(false);
    setSelectedTarget(null);
  };

  const attackKingWithSelected = (): void => {
    if (inputLocked || !selectedAttackerId) {
      return;
    }
    const result = attack(selectedAttackerId, {
      owner: "ENEMY",
      kind: "KING",
    });
    runAndClearOnSuccess(result.ok);
  };

  const onEndTurnClick = (): void => {
    if (isAiTurn) {
      return;
    }
    const result = endTurn();
    if (!result.ok) {
      return;
    }
    clearSelections();
    const latestState = useGameStore.getState().state;
    if (latestState.status !== "ENDED" && config[latestState.activePlayerId].control === "HUMAN") {
      setTurnPassOpen(true);
    } else {
      setTurnPassOpen(false);
    }
  };

  useEffect(() => {
    if (state.status !== "IN_PROGRESS" || !isAiTurn || turnPassOpen) {
      return;
    }

    const effectKey = `${state.turn}-${state.activePlayerId}-${state.idSeq}`;
    if (aiTurnKeyRef.current === effectKey) {
      return;
    }
    aiTurnKeyRef.current = effectKey;

    let cancelled = false;

    const runAiTurn = async (): Promise<void> => {
      setAiThinking(true);
      await sleep(420);
      if (cancelled) {
        return;
      }

      const store = useGameStore.getState();
      const liveState = store.state;
      if (
        liveState.status !== "IN_PROGRESS" ||
        store.config[liveState.activePlayerId].control !== "AI"
      ) {
        setAiThinking(false);
        return;
      }

      const difficulty = store.config[liveState.activePlayerId].aiDifficulty;
      const action = pickAiAction(liveState, difficulty);
      if (!action) {
        store.endTurn();
        clearSelections();
        setTurnPassOpen(false);
        setAiThinking(false);
        return;
      }

      let ok = false;
      if (action.kind === "PLAY_CARD") {
        ok = store.playCard(action.handId, action.slot, action.target).ok;
      } else if (action.kind === "DEPLOY_COMMANDER") {
        ok = store.deployCommander(action.slot).ok;
      } else if (action.kind === "TRIGGER_AURA") {
        ok = store.triggerCommanderAura(action.target).ok;
      } else if (action.kind === "TRIGGER_ULTIMATE") {
        ok = store.triggerUltimate().ok;
      } else if (action.kind === "ATTACK") {
        ok = store.attack(action.attackerInstanceId, action.target).ok;
      }

      if (!ok) {
        store.endTurn();
      }

      clearSelections();
      setTurnPassOpen(false);
      setAiThinking(false);
    };

    runAiTurn();

    return () => {
      cancelled = true;
      if (aiTurnKeyRef.current === effectKey) {
        aiTurnKeyRef.current = "";
      }
    };
  }, [isAiTurn, state.activePlayerId, state.idSeq, state.status, state.turn, turnPassOpen]);

  useEffect(() => {
    if (isAiTurn || !aiThinking) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setAiThinking(false);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [aiThinking, isAiTurn]);

  useEffect(() => {
    return () => {
      if (menuFeedbackTimerRef.current) {
        window.clearTimeout(menuFeedbackTimerRef.current);
      }
    };
  }, []);

  const renderRow = (ownerId: PlayerId, slots: SlotId[], compact: boolean): React.JSX.Element => {
    const player = state.players[ownerId];
    return (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {slots.map((slot) => {
          const unit = player.board[slot];
          const isTarget =
            selectedTarget?.kind === "UNIT" &&
            !!unit &&
            selectedTarget.instanceId === unit.instanceId;
          const highlightSummon = ownerId === activeId && !unit && summonSlots.includes(slot);
          const highlightCommander =
            ownerId === activeId &&
            !unit &&
            commanderDeployMode &&
            commanderDeploySlots.includes(slot);
          const highlightAttackTarget =
            ownerId !== activeId &&
            !!unit &&
            !!selectedAttackerId &&
            attackTargetState.unitIds.has(unit.instanceId);

          return (
            <BoardSlotTile
              key={`${ownerId}-${slot}`}
              ownerId={ownerId}
              ownerName={player.name}
              slot={slot}
              unit={unit}
              compact={compact}
              isActiveOwner={ownerId === activeId}
              highlightSummon={highlightSummon}
              highlightCommander={highlightCommander}
              highlightAttackTarget={highlightAttackTarget}
              isAttacker={unit?.instanceId === selectedAttackerId}
              isTarget={isTarget}
              registerRef={(element) => registerSlotRef(ownerId, slot, element)}
              onClick={() => {
                if (unit) {
                  onUnitClick(ownerId, unit);
                } else {
                  onSlotClick(ownerId, slot);
                }
              }}
            />
          );
        })}
      </div>
    );
  };

  const renderPlayerZone = (playerId: PlayerId, variant: ZoneVariant): React.JSX.Element => {
    const player = state.players[playerId];
    const isActivePlayer = playerId === activeId;
    const isFocus = variant === "FOCUS";
    const kingTargetOwner = isActivePlayer ? "SELF" : "ENEMY";
    const kingSelected = selectedTarget?.kind === "KING" && selectedTarget.owner === kingTargetOwner;
    const kingAttackable = !isActivePlayer && !!selectedAttackerId && attackTargetState.canHitKing;

    return (
      <article
        className={`space-y-3 rounded-2xl border ${
          isFocus ? "p-4 shadow-sm" : "p-3"
        } ${
          isActivePlayer
            ? "border-[var(--accent)] bg-[#f5fbf7]"
            : "border-[var(--line)] bg-[var(--card)]"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className={`${isFocus ? "text-lg" : "text-base"} font-semibold`}>{player.name}</h3>
            <p className="text-xs text-[var(--muted)]">{playerIdText(playerId)} • {playerId}</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isActivePlayer ? "bg-[#dff1e7] text-[#205f3d]" : "bg-[var(--chip)] text-[var(--muted)]"
            }`}
          >
            {isActivePlayer ? "กำลังเล่นเทิร์นนี้" : "รอเทิร์น"}
          </span>
        </div>

        {isFocus ? (
          <div className="rounded-xl border border-[#9dcfb2] bg-[#e9f8ee] px-3 py-2 text-xs font-semibold text-[#205f3d]">
            กระดานหลักของเทิร์นนี้: กดลงการ์ดและโจมตีจากฝั่งนี้ก่อน
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--chip)] px-3 py-2 text-xs text-[var(--muted)]">
            กระดานรองฝั่งตรงข้าม: ใช้เลือกเป้าหมายโจมตีหรือสกิล
          </div>
        )}

        <button
          type="button"
          ref={(element) => registerKingRef(playerId, element)}
          onClick={() => onKingClick(playerId)}
          className={`w-full rounded-lg border px-2 py-1 text-left ${isFocus ? "text-sm" : "text-xs"} ${
            kingSelected ? "border-[#d4983a] bg-[#fff4df]" : "border-[var(--line)] bg-white"
          } ${kingAttackable ? "animate-[targetCandidatePulse_1.2s_ease-in-out_infinite] border-[#d4983a] bg-[#fff8ea]" : ""}`}
          title={kingAttackable ? "เลือกโจมตีราชาได้ทันทีจากยูนิตที่เลือกอยู่" : undefined}
        >
          ราชา HP {player.kingHp} / {player.kingMaxHp} (กดเพื่อเลือกเป้า)
          {kingAttackable ? (
            <span className="ml-2 inline-block rounded-full bg-[#f3d8a4] px-2 py-0.5 text-[10px] font-semibold text-[#6b490d]">
              โจมตีได้
            </span>
          ) : null}
        </button>
        
        <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted)] sm:grid-cols-4">
          <span>มานา {player.mana.current}/{player.mana.max}</span>
          <span>แต้มฝั่ง {player.sideStacks}</span>
          <span>คอมโบ {player.combo}</span>
          <span>การ์ดในมือ {player.hand.length}</span>
        </div>

        <div className={isFocus ? "space-y-2" : "space-y-1.5"}>
          <h4 className={`${isFocus ? "text-sm" : "text-xs"} font-semibold`}>แนวหน้า</h4>
          {renderRow(playerId, BOARD_FRONT, !isFocus)}
          <h4 className={`${isFocus ? "text-sm" : "text-xs"} font-semibold`}>แนวหลัง</h4>
          {renderRow(playerId, BOARD_BACK, !isFocus)}
        </div>
      </article>
    );
  };

  return (
    <>
      <CardDetailModal
        card={popupHandCard?.card ?? null}
        open={!!popupHandCard}
        onClose={() => setHandPopupId(null)}
        footer={
          popupHandCard ? (
            <div className="space-y-2">
              {popupCardNeedsTarget ? (
                <div className="rounded-lg border border-[var(--line)] bg-[var(--chip)] p-2 text-xs text-[var(--muted)]">
                  <p className="font-semibold text-black">เป้าหมายของการ์ด</p>
                  <p className="mt-1">{popupTargetHint}</p>
                </div>
              ) : null}

              {popupCardNeedsTarget ? (
                <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-[var(--line)] bg-[var(--chip)] p-2">
                  {popupTargetCandidates.map((candidate) => {
                    const selected =
                      selectedTarget?.kind === candidate.target.kind &&
                      selectedTarget.owner === candidate.target.owner &&
                      selectedTarget.instanceId === candidate.target.instanceId;

                    return (
                      <button
                        key={candidate.key}
                        type="button"
                        onClick={() => setSelectedTarget(candidate.target)}
                        disabled={inputLocked}
                        className={`w-full rounded-md border px-2 py-1 text-left text-xs ${
                          selected
                            ? "border-[#d4983a] bg-[#fff4df]"
                            : "border-[var(--line)] bg-white"
                        }`}
                      >
                        {candidate.label}
                      </button>
                    );
                  })}
                  {!popupTargetCandidates.length ? (
                    <p className="text-xs text-[var(--muted)]">ยังไม่มีเป้าหมายที่เข้าข่ายในตอนนี้</p>
                  ) : null}
                </div>
              ) : null}

              {popupHandCard.card.cardType === "UNIT" ? (
                <button
                  type="button"
                  onClick={prepareCardFromPopup}
                  disabled={inputLocked || (popupCardNeedsTarget && !selectedTarget)}
                  className="w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  เลือกช่องเพื่อวางยูนิต
                </button>
              ) : (
                <button
                  type="button"
                  onClick={castPopupCard}
                  disabled={inputLocked || (popupCardNeedsTarget && !selectedTarget)}
                  className="w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  ใช้การ์ดใบนี้
                </button>
              )}
            </div>
          ) : null
        }
      />

      <TurnPassOverlay
        open={turnPassOpen && !isEnded}
        activePlayerName={active.name}
        activePlayerId={activeId}
        turn={state.turn}
        onClose={() => setTurnPassOpen(false)}
      />

      <section className="space-y-5">
        <header className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">ห้องเล่นเกม Alpha (โหมดทดสอบ)</h2>
              <p className="text-sm text-[var(--muted)]">
                เทิร์นที่ <strong>{state.turn}</strong> • เฟส <strong>{phaseText(state.phase)}</strong>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  runMenuAction("START_CONFIG", "เริ่มเกมด้วยชุดที่ตั้งไว้แล้ว", startConfiguredMatch)
                }
                className={`rounded-xl border px-3 py-2 text-sm transition hover:border-[var(--accent)] hover:bg-[#edf7f0] active:scale-[0.99] ${
                  menuActiveKey === "START_CONFIG"
                    ? "border-[var(--accent)] bg-[#e0f2e7]"
                    : "border-[var(--line)] bg-[var(--card)]"
                }`}
              >
                เริ่มเกมด้วยชุดที่ตั้งไว้
              </button>
              <button
                type="button"
                onClick={() => runMenuAction("RESET", "รีเซ็ตแมตช์เรียบร้อย", resetCurrentMatch)}
                className={`rounded-xl border px-3 py-2 text-sm transition hover:border-[var(--accent)] hover:bg-[#edf7f0] active:scale-[0.99] ${
                  menuActiveKey === "RESET"
                    ? "border-[var(--accent)] bg-[#e0f2e7]"
                    : "border-[var(--line)] bg-[var(--card)]"
                }`}
              >
                รีเซ็ตแมตช์
              </button>
              <button
                type="button"
                onClick={() =>
                  runMenuAction("VS_AI_EASY", "เริ่มโหมดเล่นกับ AI (ง่าย) แล้ว", () =>
                    startVsAiMatch("EASY"),
                  )
                }
                className={`rounded-xl border px-3 py-2 text-sm transition hover:border-[var(--accent)] hover:bg-[#edf7f0] active:scale-[0.99] ${
                  menuActiveKey === "VS_AI_EASY"
                    ? "border-[var(--accent)] bg-[#e0f2e7]"
                    : "border-[var(--line)] bg-[var(--card)]"
                }`}
              >
                เล่นกับ AI (ง่าย)
              </button>
              <button
                type="button"
                onClick={() =>
                  runMenuAction("VS_AI_NORMAL", "เริ่มโหมดเล่นกับ AI (ปานกลาง) แล้ว", () =>
                    startVsAiMatch("NORMAL"),
                  )
                }
                className={`rounded-xl border px-3 py-2 text-sm transition hover:border-[var(--accent)] hover:bg-[#edf7f0] active:scale-[0.99] ${
                  menuActiveKey === "VS_AI_NORMAL"
                    ? "border-[var(--accent)] bg-[#e0f2e7]"
                    : "border-[var(--line)] bg-[var(--card)]"
                }`}
              >
                เล่นกับ AI (ปานกลาง)
              </button>
              <button
                type="button"
                onClick={() =>
                  runMenuAction("VS_AI_HARD", "เริ่มโหมดเล่นกับ AI (ยาก) แล้ว", () =>
                    startVsAiMatch("HARD"),
                  )
                }
                className={`rounded-xl border px-3 py-2 text-sm transition hover:border-[var(--accent)] hover:bg-[#edf7f0] active:scale-[0.99] ${
                  menuActiveKey === "VS_AI_HARD"
                    ? "border-[var(--accent)] bg-[#e0f2e7]"
                    : "border-[var(--line)] bg-[var(--card)]"
                }`}
              >
                เล่นกับ AI (ยาก)
              </button>
            </div>
          </div>

          {menuFeedback ? (
            <p className="mt-2 rounded-lg border border-[#9dcfb2] bg-[#ecf8f0] px-3 py-1 text-xs text-[#1f7a4b]">
              {menuFeedback}
            </p>
          ) : null}

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <article className="rounded-2xl border border-[#9dcfb2] bg-[#ecf8f0] p-4">
              <p className="text-xs font-semibold text-[#2a6d46]">ตอนนี้เป็นเทิร์นของ</p>
              <p className="mt-1 text-2xl font-semibold text-[#184a31]">
                {active.name} ({playerIdText(activeId)})
              </p>
              <p className="mt-1 text-sm text-[#2a6d46]">
                ผู้เล่นถัดไป: {waiting.name} ({playerIdText(waitingId)})
              </p>
              <p className="mt-1 text-xs text-[#2a6d46]">
                โหมดควบคุม: {controlText(activeControl)}
                {activeControl === "AI" ? ` (${aiDifficultyText(activeDifficulty)})` : ""}
              </p>
              {aiThinking ? (
                <p className="mt-1 inline-block rounded-full bg-[#1f8a5a] px-2 py-0.5 text-xs font-semibold text-white">
                  AI กำลังคิด...
                </p>
              ) : null}
            </article>

            <article className="rounded-2xl border border-[var(--line)] bg-white p-4 text-sm">
              <p className="font-semibold">ขั้นตอนถัดไป</p>
              <p className="mt-1 text-[var(--muted)]">
                {isAiTurn
                  ? `AI (${aiDifficultyText(activeDifficulty)}) กำลังตัดสินใจและจะลงมือให้เองอัตโนมัติ`
                  : modeHint(uiMode, selectedHandCard?.card.name.th ?? null)}
              </p>
            </article>
          </div>

          <p className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--chip)] p-2 text-xs text-[var(--muted)]">
            {note}
          </p>
        </header>

        <details className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <summary className="cursor-pointer text-sm font-semibold">ตั้งค่าแมตช์ (กดเพื่อเปิด/ปิด)</summary>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {(["P1", "P2"] as PlayerId[]).map((playerId) => {
              const playerConfig = config[playerId];
              const deckStatus = validateDeckForPlayer(playerId);
              return (
                <div key={playerId} className="space-y-2 rounded-xl border border-[var(--line)] bg-[var(--card)] p-3">
                  <h3 className="text-sm font-semibold">ตั้งค่า {playerIdText(playerId)}</h3>
                  <input
                    value={playerConfig.name}
                    onChange={(event) => updateConfig(playerId, { name: event.target.value })}
                    className="w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-sm"
                    placeholder={`ชื่อ ${playerIdText(playerId)}`}
                  />
                  <select
                    value={playerConfig.kingId}
                    onChange={(event) =>
                      updateConfig(playerId, {
                        kingId: event.target.value,
                        deckCardIds: recommendBestDeckForKingId(event.target.value),
                      })
                    }
                    className="w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-sm"
                  >
                    {kings.map((king) => (
                      <option key={king.id} value={king.id}>
                        {king.name.th}
                      </option>
                    ))}
                  </select>
                  <select
                    value={playerConfig.commanderId}
                    onChange={(event) => updateConfig(playerId, { commanderId: event.target.value })}
                    className="w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-sm"
                  >
                    {commanders.map((commander) => (
                      <option key={commander.id} value={commander.id}>
                        {commander.name.th}
                      </option>
                    ))}
                  </select>
                  <select
                    value={playerConfig.auraMode}
                    onChange={(event) => updateConfig(playerId, { auraMode: event.target.value as AuraMode })}
                    className="w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-sm"
                  >
                    <option value="BURST">โหมด BURST ({auraModeText("BURST")})</option>
                    <option value="PULSE">โหมด PULSE ({auraModeText("PULSE")})</option>
                  </select>
                  <select
                    value={playerConfig.control}
                    onChange={(event) =>
                      updateConfig(playerId, { control: event.target.value as PlayerControl })
                    }
                    className="w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-sm"
                  >
                    <option value="HUMAN">ผู้เล่นจริง (Human)</option>
                    <option value="AI">บอท AI</option>
                  </select>
                  <select
                    value={playerConfig.aiDifficulty}
                    onChange={(event) =>
                      updateConfig(playerId, { aiDifficulty: event.target.value as AiDifficulty })
                    }
                    disabled={playerConfig.control !== "AI"}
                    className="w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-sm disabled:cursor-not-allowed disabled:bg-[#f5f5f5]"
                  >
                    <option value="EASY">AI ง่าย</option>
                    <option value="NORMAL">AI ปานกลาง</option>
                    <option value="HARD">AI ยาก</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig(playerId, {
                        deckCardIds: recommendBestDeckForKingId(playerConfig.kingId),
                      })
                    }
                    className="w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-sm"
                  >
                    จัดเด็คแนะนำอัตโนมัติ
                  </button>
                  <div
                    className={`rounded-lg border p-2 text-xs ${
                      deckStatus.ok ? "border-[#a9d2b6] bg-[#f1faf4]" : "border-[#dcb9ad] bg-[#fff5f2]"
                    }`}
                  >
                    เด็ค {deckStatus.cardCount}/24 • {deckStatus.ok ? "พร้อมเล่น" : "ยังไม่ผ่านกติกา"}
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    โหมด: {controlText(playerConfig.control)}
                    {playerConfig.control === "AI" ? ` (${aiDifficultyText(playerConfig.aiDifficulty)})` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </details>

        <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
          <div className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-[#9dcfb2] bg-[#ecf8f0] p-3 text-sm">
              <div>
                <p className="font-semibold text-[#184a31]">
                  โฟกัสเทิร์นนี้: {active.name} ({playerIdText(activeId)})
                </p>
                <p className="mt-1 text-xs text-[#2a6d46]">กระดานของคนที่ถึงเทิร์นถูกยกเป็นบล็อกหลักด้านบนเสมอ</p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideLines((value) => !value)}
                className={`rounded-lg border px-2 py-1 text-xs transition hover:border-[var(--accent)] ${
                  showGuideLines
                    ? "border-[var(--accent)] bg-[#e0f2e7]"
                    : "border-[var(--line)] bg-white"
                }`}
              >
                เส้นไกด์โจมตี: {showGuideLines ? "เปิด" : "ปิด"}
              </button>
            </div>

            <div className="space-y-2 rounded-xl border border-[var(--line)] bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">
                  การ์ดในมือของ {active.name} ({playerIdText(activeId)})
                </h4>
                <span className="text-xs text-[var(--muted)]">เลื่อนซ้าย-ขวาเพื่อดูทั้งหมด</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {active.hand.map((item) => {
                  const selected = selectedHandId === item.handId;
                  const needsTarget = cardNeedsChosenTarget(item.card);
                  const requirements = explainDeckRequirements(item.card);
                  const playable = playableByHandId.get(item.handId) ?? false;

                  return (
                    <article
                      key={item.handId}
                      className={`w-[220px] shrink-0 rounded-xl border p-2 text-xs ${
                        selected
                          ? "border-[var(--accent)] bg-[#edf7f0]"
                          : playable
                            ? "border-[#7bc89a] bg-[#effaf3]"
                            : "border-[var(--line)] bg-[var(--card)]"
                      }`}
                    >
                      <p className="truncate font-semibold">{item.card.name.th}</p>
                      <p className="truncate text-[var(--muted)]">{item.card.name.en}</p>
                      <p className="mt-1 text-[var(--muted)]">
                        {cardTypeText(item.card)} | มานา {item.card.cost.mana} | แต้มฝั่ง {item.card.cost.sideStacks}
                      </p>
                      <p className={`mt-1 text-[11px] ${playable ? "text-[#1f7a4b]" : "text-[var(--muted)]"}`}>
                        {playable ? "พร้อมใช้ตอนนี้" : "ยังใช้ไม่ได้ตอนนี้"}
                      </p>
                      {requirements.length ? (
                        <p className="mt-1 line-clamp-1 text-[11px] text-[#916300]">เงื่อนไข: {requirements[0]}</p>
                      ) : (
                        <p className="mt-1 line-clamp-1 text-[11px] text-[var(--muted)]">
                          {needsTarget ? chosenTargetCardRule(item.card).targetHint : "ไม่ต้องเลือกเป้าหมาย"}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => openHandPopup(item.handId)}
                          disabled={inputLocked}
                          className="rounded-lg border border-[var(--line)] bg-white px-2 py-1"
                        >
                          เปิด
                        </button>
                        <button
                          type="button"
                          onClick={() => selectHandCard(item.handId)}
                          disabled={inputLocked}
                          className="rounded-lg border border-[var(--line)] bg-white px-2 py-1"
                        >
                          {selected ? "ยกเลิก" : "เลือกใช้"}
                        </button>
                        {item.card.cardType !== "UNIT" && !needsTarget ? (
                          <button
                            type="button"
                            onClick={() => {
                              const result = playCard(item.handId, null, null);
                              runAndClearOnSuccess(result.ok);
                            }}
                            disabled={inputLocked || !playable}
                            className="rounded-lg border border-[var(--line)] bg-white px-2 py-1 disabled:opacity-45"
                          >
                            ใช้ทันที
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
                {!active.hand.length ? (
                  <div className="rounded-lg border border-dashed border-[var(--line)] px-3 py-2 text-xs text-[var(--muted)]">
                    ไม่มีการ์ดในมือ
                  </div>
                ) : null}
              </div>
            </div>
            <div ref={boardOverlayRef} className="relative space-y-4">
              {showGuideLines && !!selectedAttackerId && guideLines.length ? (
                <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
                  <defs>
                    <marker
                      id="attack-guide-arrow"
                      markerWidth="10"
                      markerHeight="10"
                      refX="7"
                      refY="3"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path d="M0,0 L0,6 L7,3 z" fill="#c27e18" />
                    </marker>
                  </defs>
                  {guideLines.map((line) => (
                    <line
                      key={line.id}
                      x1={line.x1}
                      y1={line.y1}
                      x2={line.x2}
                      y2={line.y2}
                      stroke={line.kind === "KING" ? "#b25f00" : "#d4983a"}
                      strokeWidth={line.kind === "KING" ? 2.8 : 2.2}
                      strokeDasharray={line.kind === "KING" ? "0" : "5 4"}
                      markerEnd="url(#attack-guide-arrow)"
                    />
                  ))}
                </svg>
              ) : null}
              {renderPlayerZone(activeId, "FOCUS")}
              <div className="rounded-xl border border-[var(--line)] bg-white p-2 text-center text-xs text-[var(--muted)]">
                กระดานฝั่งตรงข้าม (บล็อกรอง)
              </div>
              {renderPlayerZone(waitingId, "SECONDARY")}
            </div>
          </div>

          <aside className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-3 text-sm">
              <p className="font-semibold">กำลังควบคุมเทิร์น</p>
              <p className="mt-1 text-base">
                {active.name} ({playerIdText(activeId)})
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {controlText(activeControl)}
                {activeControl === "AI" ? ` • ระดับ ${aiDifficultyText(activeDifficulty)}` : ""}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-white p-3 text-xs">
              <p className="font-semibold">ต้องกดอะไรต่อ</p>
              <p className="mt-1 text-[var(--muted)]">
                {isAiTurn ? "ระบบจะเล่นให้เองอัตโนมัติ" : modeHint(uiMode, selectedHandCard?.card.name.th ?? null)}
              </p>
              <div className="mt-2 space-y-1 text-[var(--muted)]">
                {currentModeSteps.map((step) => (
                  <p key={step}>{step}</p>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-2">
                <ActionTooltipButton
                  label="ใช้อัลติเมต"
                  tooltip={ultimateTooltip}
                  onClick={() => {
                    const result = triggerUltimate();
                    runAndClearOnSuccess(result.ok);
                  }}
                  disabled={!canUseUltimateAction}
                  className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
                />
                <p className="mt-1 text-[11px] text-[var(--muted)]">เงื่อนไข: {ultimateConditionText}</p>
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-2">
                <ActionTooltipButton
                  label="ใช้ออร่าแม่ทัพ"
                  tooltip={auraTooltip}
                  onClick={() => {
                    const result = triggerCommanderAura(selectedTarget);
                    runAndClearOnSuccess(result.ok);
                  }}
                  disabled={!canUseAuraAction}
                  className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
                />
                <p className="mt-1 text-[11px] text-[var(--muted)]">เงื่อนไข: {auraConditionText}</p>
              </div>

              <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-2">
                <ActionTooltipButton
                  label={commanderDeployMode ? "ยกเลิกลงแม่ทัพ" : "ลงแม่ทัพ"}
                  tooltip={commanderTooltip}
                  onClick={() => {
                    setCommanderDeployMode((value) => !value);
                    setSelectedHandId(null);
                    setSelectedAttackerId(null);
                    setSelectedTarget(null);
                  }}
                  disabled={!commanderDeployMode && !canEnterCommanderDeployMode}
                  className={`w-full rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45 ${
                    commanderDeployMode
                      ? "border-[#4e6ad6] bg-[#eef1ff]"
                      : "border-[var(--line)] bg-white"
                  }`}
                />
                <p className="mt-1 text-[11px] text-[var(--muted)]">เงื่อนไข: {commanderConditionText}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-3 text-xs">
              <p className="font-semibold">สั่งโจมตี</p>
              <p className="mt-1 text-[var(--muted)]">1) เลือกยูนิตที่พร้อมโจมตี 2) เลือกเป้าหมายบนกระดานรอง หรือกดโจมตีราชา</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {readyAttackers.map(({ slot, unit }) => (
                  <ActionTooltipButton
                    key={unit.instanceId}
                    label={`${unitDisplayName(unit)} (${slot})`}
                    tooltip={`เลือกยูนิตนี้เพื่อเข้าโหมดโจมตี แล้วไปคลิกเป้าหมายบนกระดานฝั่งตรงข้าม`}
                    onClick={() => selectAttackerFromPanel(unit.instanceId)}
                    disabled={inputLocked}
                    className={`rounded-lg border px-2 py-1 ${
                      selectedAttackerId === unit.instanceId
                        ? "border-[var(--accent)] bg-[#edf7f0] animate-[attackerPulse_1s_ease-in-out_infinite]"
                        : "border-[var(--line)] bg-white"
                    } disabled:opacity-45`}
                  />
                ))}
                {!readyAttackers.length ? (
                  <p className="text-[var(--muted)]">ยังไม่มียูนิตที่พร้อมโจมตี</p>
                ) : null}
              </div>
              <div className="mt-2 flex gap-2">
                <ActionTooltipButton
                  label="โจมตีราชาศัตรู"
                  tooltip={attackKingTooltip}
                  onClick={attackKingWithSelected}
                  disabled={inputLocked || !selectedAttackerId}
                  className="rounded-lg border border-[var(--line)] bg-white px-2 py-1 disabled:opacity-45"
                />
                <ActionTooltipButton
                  label="ยกเลิกโหมดโจมตี"
                  tooltip="ล้างการเลือกยูนิตโจมตี แล้วกลับไปโหมดปกติ"
                  onClick={() => setSelectedAttackerId(null)}
                  disabled={inputLocked || !selectedAttackerId}
                  className="rounded-lg border border-[var(--line)] bg-white px-2 py-1 disabled:opacity-45"
                />
              </div>
              {selectedAttackerUnit ? (
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  กำลังโจมตีด้วย: {unitDisplayName(selectedAttackerUnit)}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <ActionTooltipButton
                label="จบเทิร์น"
                tooltip={endTurnTooltip}
                onClick={onEndTurnClick}
                disabled={inputLocked}
                className="rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
              />
              <ActionTooltipButton
                label="ยอมแพ้"
                tooltip={concedeTooltip}
                onClick={() => {
                  const result = concede();
                  runAndClearOnSuccess(result.ok);
                }}
                disabled={isEnded}
                className="rounded-xl border border-[#d8b2a7] bg-[#fff4f1] px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-45"
              />
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-3 text-xs">
              <p className="font-semibold">สถานะการเลือก</p>
              <div className="mt-2 space-y-1 text-[var(--muted)]">
                <p>การ์ดที่เลือก: {selectedHandCard?.card.name.th ?? "ยังไม่ได้เลือก"}</p>
                <p>ยูนิตที่เลือกโจมตี: {selectedAttackerId ?? "ยังไม่ได้เลือก"}</p>
                <p>
                  เป้าหมายที่เลือก:{" "}
                  {selectedTarget
                    ? `${targetOwnerText(selectedTarget.owner)} ${targetKindText(selectedTarget.kind)}`
                    : "ยังไม่ได้เลือก"}
                </p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={castSelectedCard}
                  disabled={!canCastSelected || inputLocked}
                  className="rounded-lg border border-[var(--line)] bg-white px-2 py-1 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  ใช้การ์ดที่เลือก
                </button>
                <button
                  type="button"
                  onClick={clearSelections}
                  className="rounded-lg border border-[var(--line)] bg-white px-2 py-1"
                >
                  ล้างการเลือก
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-3 text-xs text-[var(--muted)]">
              <p className="font-semibold text-black">คำอธิบายสีบนกระดาน</p>
              <p className="mt-1">เขียว: ช่องลงยูนิต • น้ำเงิน: ช่องลงแม่ทัพ • วงเขียว: ยูนิตที่เลือกโจมตี</p>
              <p className="mt-1">วงทอง: เป้าหมายที่เลือก</p>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">บันทึกการต่อสู้</h4>
              <ul className="max-h-60 space-y-1 overflow-auto rounded-xl border border-[var(--line)] bg-[var(--card)] p-2 text-xs text-[var(--muted)]">
                {state.log.map((entry) => (
                  <li key={entry.id}>
                    T{entry.turn}: {entry.message}
                  </li>
                ))}
                {!state.log.length ? <li>ยังไม่มีเหตุการณ์</li> : null}
              </ul>
            </div>

            {lastError ? (
              <div className="rounded-xl border border-[#d8b2a7] bg-[#fff4f1] p-2 text-xs text-[#7a3d2e]">
                {lastError}
              </div>
            ) : null}

            {isEnded ? (
              <div className="rounded-xl border border-[var(--line)] bg-white p-2 text-sm font-semibold">
                {state.winner ? `ผู้ชนะ: ${state.players[state.winner].name}` : "ผลเสมอ"}
              </div>
            ) : null}
          </aside>
        </section>
      </section>
    </>
  );
}

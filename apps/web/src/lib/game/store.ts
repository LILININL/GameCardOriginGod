"use client";

import { create } from "zustand";

import { buildDeckFromCardIds, getKingById } from "@/lib/cards";
import { recommendBestDeckForKingId } from "@/lib/game/deck-recommend";
import {
  attackAction,
  commanderAuraAction,
  concedeAction,
  createRuntimeSeed,
  createInitialState,
  deployCommanderAction,
  endTurnAction,
  getCommanderDeploySlots,
  HYDRATION_SAFE_SEED,
  getValidSummonSlots,
  playCardAction,
  ultimateAction,
  type MatchSetup,
} from "@/lib/game/engine";
import {
  type ActionTarget,
  type ActionResult,
  type AiDifficulty,
  type AuraMode,
  type GameState,
  type PlayerControl,
  type SlotId,
} from "@/lib/game/types";

export interface MatchConfigPlayer {
  name: string;
  kingId: string;
  commanderId: string;
  auraMode: AuraMode;
  control: PlayerControl;
  aiDifficulty: AiDifficulty;
  deckCardIds: string[];
}

export interface MatchConfig {
  P1: MatchConfigPlayer;
  P2: MatchConfigPlayer;
}

export interface DeckValidationResult {
  ok: boolean;
  errors: string[];
  cardCount: number;
}

interface GameStore {
  state: GameState;
  config: MatchConfig;
  lastError: string | null;
  note: string;
  setConfig: (nextConfig: MatchConfig) => void;
  resetMatch: () => void;
  updateConfig: (playerId: "P1" | "P2", patch: Partial<MatchConfigPlayer>) => void;
  setDeckForPlayer: (playerId: "P1" | "P2", deckCardIds: string[]) => void;
  resetDeckForPlayer: (playerId: "P1" | "P2") => void;
  validateDeckForPlayer: (playerId: "P1" | "P2") => DeckValidationResult;
  startMatchWithConfig: (nextConfig?: MatchConfig) => void;
  playCard: (handId: string, slot: SlotId | null, target: ActionTarget | null) => ActionResult;
  deployCommander: (slot: SlotId) => ActionResult;
  triggerCommanderAura: (target: ActionTarget | null) => ActionResult;
  triggerUltimate: () => ActionResult;
  attack: (attackerInstanceId: string, target: ActionTarget) => ActionResult;
  endTurn: () => ActionResult;
  concede: () => ActionResult;
  validSummonSlots: (handId: string) => SlotId[];
  commanderSlots: () => SlotId[];
}

const initialState = createInitialState(undefined, { seed: HYDRATION_SAFE_SEED });

const initialConfig: MatchConfig = {
  P1: {
    name: "ผู้เล่น 1",
    kingId: "K_HUMAN_AUREN",
    commanderId: "C_HEAVEN_VALORIA",
    auraMode: "PULSE",
    control: "HUMAN",
    aiDifficulty: "NORMAL",
    deckCardIds: recommendBestDeckForKingId("K_HUMAN_AUREN"),
  },
  P2: {
    name: "ผู้เล่น 2",
    kingId: "K_HUMAN_AUREN",
    commanderId: "C_DEMON_GOREL",
    auraMode: "BURST",
    control: "HUMAN",
    aiDifficulty: "NORMAL",
    deckCardIds: recommendBestDeckForKingId("K_HUMAN_AUREN"),
  },
};

function toSetup(config: MatchConfig): MatchSetup {
  return {
    P1: {
      name: config.P1.name,
      kingId: config.P1.kingId,
      commanderId: config.P1.commanderId,
      auraMode: config.P1.auraMode,
      deckCardIds: [...config.P1.deckCardIds],
    },
    P2: {
      name: config.P2.name,
      kingId: config.P2.kingId,
      commanderId: config.P2.commanderId,
      auraMode: config.P2.auraMode,
      deckCardIds: [...config.P2.deckCardIds],
    },
  };
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: initialState,
  config: initialConfig,
  lastError: null,
  note:
    "โหมดทดสอบ: เริ่มเกมด้วยเด็คที่จัดไว้ในแท็บจัดเด็ค (ถ้าเด็คไม่ถูกต้อง ระบบจะใช้เด็คอัตโนมัติแทน)",
  setConfig: (nextConfig) => {
    set({ config: nextConfig });
  },
  resetMatch: () => {
    const { config } = get();
    set({
      state: createInitialState(toSetup(config), { seed: createRuntimeSeed() }),
      lastError: null,
    });
  },
  updateConfig: (playerId, patch) => {
    set((store) => ({
      config: {
        ...store.config,
        [playerId]: {
          ...store.config[playerId],
          ...patch,
        },
      },
    }));
  },
  setDeckForPlayer: (playerId, deckCardIds) => {
    set((store) => ({
      config: {
        ...store.config,
        [playerId]: {
          ...store.config[playerId],
          deckCardIds,
        },
      },
    }));
  },
  resetDeckForPlayer: (playerId) => {
    set((store) => {
      const kingId = store.config[playerId].kingId;
      return {
        config: {
          ...store.config,
          [playerId]: {
            ...store.config[playerId],
            deckCardIds: recommendBestDeckForKingId(kingId),
          },
        },
      };
    });
  },
  validateDeckForPlayer: (playerId) => {
    const { config } = get();
    const king = getKingById(config[playerId].kingId);
    const result = buildDeckFromCardIds(king, config[playerId].deckCardIds);
    return {
      ok: result.errors.length === 0,
      errors: result.errors,
      cardCount: config[playerId].deckCardIds.length,
    };
  },
  startMatchWithConfig: (nextConfig) => {
    const { config } = get();
    const finalConfig = nextConfig ?? config;
    set({
      config: finalConfig,
      state: createInitialState(toSetup(finalConfig), { seed: createRuntimeSeed() }),
      lastError: null,
    });
  },
  playCard: (handId, slot, target) => {
    const { state } = get();
    const next = playCardAction(state, handId, slot, target);
    set({ state: next.state, lastError: next.result.error ?? null });
    return next.result;
  },
  deployCommander: (slot) => {
    const { state } = get();
    const next = deployCommanderAction(state, slot);
    set({ state: next.state, lastError: next.result.error ?? null });
    return next.result;
  },
  triggerCommanderAura: (target) => {
    const { state } = get();
    const next = commanderAuraAction(state, target);
    set({ state: next.state, lastError: next.result.error ?? null });
    return next.result;
  },
  triggerUltimate: () => {
    const { state } = get();
    const next = ultimateAction(state);
    set({ state: next.state, lastError: next.result.error ?? null });
    return next.result;
  },
  attack: (attackerInstanceId, target) => {
    const { state } = get();
    const next = attackAction(state, attackerInstanceId, target);
    set({ state: next.state, lastError: next.result.error ?? null });
    return next.result;
  },
  endTurn: () => {
    const { state } = get();
    const next = endTurnAction(state);
    set({ state: next.state, lastError: next.result.error ?? null });
    return next.result;
  },
  concede: () => {
    const { state } = get();
    const next = concedeAction(state);
    set({ state: next.state, lastError: next.result.error ?? null });
    return next.result;
  },
  validSummonSlots: (handId) => {
    const { state } = get();
    return getValidSummonSlots(state, handId);
  },
  commanderSlots: () => {
    const { state } = get();
    return getCommanderDeploySlots(state);
  },
}));

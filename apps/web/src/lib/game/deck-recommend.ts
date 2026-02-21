import { DEFAULT_DECK_SIZE, getAllowedDeckCardsByKing, getKingById } from "@/lib/cards";
import { type DeckCard, type DeckCardType, type KingCard } from "@/lib/game/types";

export type DeckPresetId =
  | "COMBO_FLOW"
  | "AGGRO_PRESSURE"
  | "CONTROL_LOCK"
  | "SIDE_STACK_BURST"
  | "BALANCED_META";

export interface DeckPreset {
  id: DeckPresetId;
  name: string;
  description: string;
}

interface PresetProfile {
  desired: Record<DeckCardType, number>;
}

const PRESET_PROFILES: Record<DeckPresetId, PresetProfile> = {
  COMBO_FLOW: {
    desired: {
      UNIT: 10,
      SPELL_GENERIC: 5,
      SPELL_CLASS: 4,
      SKILL_RACE: 2,
      SKILL_SIDE: 3,
    },
  },
  AGGRO_PRESSURE: {
    desired: {
      UNIT: 14,
      SPELL_GENERIC: 5,
      SPELL_CLASS: 2,
      SKILL_RACE: 1,
      SKILL_SIDE: 2,
    },
  },
  CONTROL_LOCK: {
    desired: {
      UNIT: 12,
      SPELL_GENERIC: 4,
      SPELL_CLASS: 3,
      SKILL_RACE: 2,
      SKILL_SIDE: 3,
    },
  },
  SIDE_STACK_BURST: {
    desired: {
      UNIT: 11,
      SPELL_GENERIC: 3,
      SPELL_CLASS: 3,
      SKILL_RACE: 2,
      SKILL_SIDE: 5,
    },
  },
  BALANCED_META: {
    desired: {
      UNIT: 12,
      SPELL_GENERIC: 4,
      SPELL_CLASS: 3,
      SKILL_RACE: 2,
      SKILL_SIDE: 3,
    },
  },
};

export const DECK_PRESETS: DeckPreset[] = [
  {
    id: "COMBO_FLOW",
    name: "Combo Flow",
    description: "เน้นร้อยการ์ดหลายประเภทต่อเนื่อง ใช้คอมโบและจั่วเพิ่ม",
  },
  {
    id: "AGGRO_PRESSURE",
    name: "Aggro Pressure",
    description: "เด็คเกมไว เน้นยูนิตลงเร็วและบุกปิดเกม",
  },
  {
    id: "CONTROL_LOCK",
    name: "Control Lock",
    description: "คุมบอร์ดด้วยฮีล/เคลียร์/บัฟเลือด ยื้อเพื่อชนะระยะยาว",
  },
  {
    id: "SIDE_STACK_BURST",
    name: "Side Stack Burst",
    description: "สะสมแต้มฝั่งแล้วระเบิดพลังด้วยสกิลฝั่งแรงๆ",
  },
  {
    id: "BALANCED_META",
    name: "Balanced Meta",
    description: "สมดุลทุกสถานการณ์ เล่นง่ายทั้งต้นเกมและท้ายเกม",
  },
];

const ALL_TYPES: DeckCardType[] = ["UNIT", "SPELL_GENERIC", "SPELL_CLASS", "SKILL_RACE", "SKILL_SIDE"];

function hasAnyOp(card: DeckCard, op: string): boolean {
  return card.abilities?.some((ability) => ability.op === op) ?? false;
}

function hasKeyword(card: DeckCard, keyword: string): boolean {
  return card.abilities?.some((ability) => ability.keyword === keyword) ?? false;
}

function unitPower(card: DeckCard): number {
  if (card.cardType !== "UNIT") {
    return 0;
  }
  const cost = Math.max(card.cost.mana, 1);
  return ((card.attack ?? 0) * 1.25 + (card.hp ?? 0)) / cost;
}

function scoreCardByPreset(card: DeckCard, presetId: DeckPresetId, king: KingCard): number {
  let score = 0;

  const mana = card.cost.mana;
  if (card.cardType === "UNIT") {
    score += unitPower(card) * 2;
    if (mana <= 2) {
      score += 2;
    }
    if (mana >= 5) {
      score += 0.5;
    }
  } else {
    score += 3.2 - mana * 0.35;
  }

  if (hasAnyOp(card, "DRAW_CARD")) {
    score += 2.2;
  }
  if (hasAnyOp(card, "REDUCE_NEXT_TYPE_COST") || hasAnyOp(card, "RESTORE_MANA")) {
    score += 2;
  }
  if (hasAnyOp(card, "DEAL_DAMAGE")) {
    score += 1.8;
  }
  if (hasAnyOp(card, "DESTROY") || hasAnyOp(card, "SILENCE")) {
    score += 1.7;
  }
  if (hasAnyOp(card, "HEAL") || hasAnyOp(card, "BUFF_HP")) {
    score += 1.3;
  }
  if (hasAnyOp(card, "GAIN_SIDE_STACK")) {
    score += 1.4;
  }
  if (hasKeyword(card, "RUSH") || hasKeyword(card, "SNIPER")) {
    score += 1.6;
  }
  if (hasKeyword(card, "TAUNT")) {
    score += 1.4;
  }

  if (presetId === "COMBO_FLOW") {
    if (card.cardType !== "UNIT") {
      score += 1.5;
    }
    if (hasAnyOp(card, "DRAW_CARD")) {
      score += 1.5;
    }
    if (hasAnyOp(card, "REDUCE_NEXT_TYPE_COST") || hasAnyOp(card, "RESTORE_MANA")) {
      score += 2;
    }
    if (mana <= 2) {
      score += 1.2;
    }
    if (king.race === "HUMAN") {
      score += 1;
    }
  }

  if (presetId === "AGGRO_PRESSURE") {
    if (card.cardType === "UNIT") {
      score += (card.attack ?? 0) * 0.8;
    }
    if (mana <= 3) {
      score += 1.5;
    }
    if (hasKeyword(card, "RUSH") || hasKeyword(card, "SNIPER")) {
      score += 2;
    }
    if (hasAnyOp(card, "DEAL_DAMAGE")) {
      score += 1.2;
    }
  }

  if (presetId === "CONTROL_LOCK") {
    if (card.cardType === "UNIT") {
      score += (card.hp ?? 0) * 0.5;
    }
    if (hasKeyword(card, "TAUNT")) {
      score += 2;
    }
    if (hasAnyOp(card, "HEAL") || hasAnyOp(card, "BUFF_HP")) {
      score += 2;
    }
    if (hasAnyOp(card, "DESTROY") || hasAnyOp(card, "SILENCE")) {
      score += 1.5;
    }
  }

  if (presetId === "SIDE_STACK_BURST") {
    if (card.cardType === "SKILL_SIDE") {
      score += 4;
    }
    if (hasAnyOp(card, "GAIN_SIDE_STACK")) {
      score += 3;
    }
    if (card.cost.sideStacks > 0) {
      score += 1.4;
    }
  }

  if (presetId === "BALANCED_META") {
    if (card.cardType === "UNIT") {
      score += 0.6;
    }
    if (hasAnyOp(card, "DRAW_CARD") || hasAnyOp(card, "HEAL") || hasAnyOp(card, "DEAL_DAMAGE")) {
      score += 0.7;
    }
  }

  return score;
}

function normalizeDesiredCounts(
  desired: Record<DeckCardType, number>,
  allowed: DeckCard[],
  deckSize: number,
): Record<DeckCardType, number> {
  const availableTypeSet = new Set(allowed.map((card) => card.cardType));
  const result = {} as Record<DeckCardType, number>;

  let total = 0;
  for (const type of ALL_TYPES) {
    result[type] = availableTypeSet.has(type) ? desired[type] : 0;
    total += result[type];
  }

  const fallbackOrder: DeckCardType[] = ["UNIT", "SPELL_GENERIC", "SPELL_CLASS", "SKILL_SIDE", "SKILL_RACE"];
  while (total < deckSize) {
    let changed = false;
    for (const type of fallbackOrder) {
      if (!availableTypeSet.has(type)) {
        continue;
      }
      result[type] += 1;
      total += 1;
      changed = true;
      if (total >= deckSize) {
        break;
      }
    }
    if (!changed) {
      break;
    }
  }

  while (total > deckSize) {
    let changed = false;
    for (const type of [...fallbackOrder].reverse()) {
      if (result[type] <= 0) {
        continue;
      }
      result[type] -= 1;
      total -= 1;
      changed = true;
      if (total <= deckSize) {
        break;
      }
    }
    if (!changed) {
      break;
    }
  }

  return result;
}

function takeDeckByScores(
  allowed: DeckCard[],
  presetId: DeckPresetId,
  king: KingCard,
  deckSize: number,
): string[] {
  const desired = normalizeDesiredCounts(PRESET_PROFILES[presetId].desired, allowed, deckSize);
  const sortedByType = new Map<DeckCardType, DeckCard[]>();
  for (const type of ALL_TYPES) {
    sortedByType.set(
      type,
      allowed
        .filter((card) => card.cardType === type)
        .sort((a, b) => scoreCardByPreset(b, presetId, king) - scoreCardByPreset(a, presetId, king)),
    );
  }

  const picked: string[] = [];
  const counts = new Map<string, number>();
  const addCard = (card: DeckCard): boolean => {
    if (picked.length >= deckSize) {
      return false;
    }
    const current = counts.get(card.id) ?? 0;
    if (current >= card.maxCopies) {
      return false;
    }
    picked.push(card.id);
    counts.set(card.id, current + 1);
    return true;
  };

  for (const type of ALL_TYPES) {
    const list = sortedByType.get(type) ?? [];
    let need = desired[type];
    if (!list.length || need <= 0) {
      continue;
    }
    for (let loop = 0; loop < 3 && need > 0; loop += 1) {
      for (const card of list) {
        if (need <= 0) {
          break;
        }
        if (addCard(card)) {
          need -= 1;
        }
      }
    }
  }

  const allSorted = [...allowed].sort(
    (a, b) => scoreCardByPreset(b, presetId, king) - scoreCardByPreset(a, presetId, king),
  );
  while (picked.length < deckSize) {
    let changed = false;
    for (const card of allSorted) {
      if (addCard(card)) {
        changed = true;
      }
      if (picked.length >= deckSize) {
        break;
      }
    }
    if (!changed) {
      break;
    }
  }

  return picked.slice(0, deckSize);
}

export function recommendBestPresetForKing(king: KingCard): DeckPresetId {
  if (king.race === "HUMAN") {
    return "COMBO_FLOW";
  }
  if (king.faction === "DEMON") {
    return "SIDE_STACK_BURST";
  }
  if (king.faction === "HEAVEN") {
    return "CONTROL_LOCK";
  }
  return "BALANCED_META";
}

export function recommendDeckForKingId(
  kingId: string,
  presetId: DeckPresetId,
  deckSize = DEFAULT_DECK_SIZE,
): string[] {
  const king = getKingById(kingId);
  const allowed = getAllowedDeckCardsByKing(king);
  return takeDeckByScores(allowed, presetId, king, deckSize);
}

export function recommendBestDeckForKingId(kingId: string, deckSize = DEFAULT_DECK_SIZE): string[] {
  const king = getKingById(kingId);
  const presetId = recommendBestPresetForKing(king);
  return recommendDeckForKingId(kingId, presetId, deckSize);
}

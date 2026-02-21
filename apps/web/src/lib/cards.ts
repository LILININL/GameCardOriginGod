import raw from "@/data/card-set";
import {
  type AuraMode,
  type Card,
  type CommanderCard,
  type DeckCard,
  type DeckCardType,
  type Faction,
  type KingCard,
  type PlayerId,
} from "@/lib/game/types";

interface CardSetFile {
  set: string;
  schemaRef: string;
  generatedOn: string;
  cards: Card[];
}

export const DEFAULT_DECK_SIZE = 24;

export const cardSet = raw as CardSetFile;
export const allCards = cardSet.cards;

export const kings = allCards.filter((card): card is KingCard => card.kind === "KING");
export const commanders = allCards.filter(
  (card): card is CommanderCard => card.kind === "COMMANDER",
);
export const deckCards = allCards.filter((card): card is DeckCard => card.kind === "DECK_CARD");

export const cardsById = new Map(allCards.map((card) => [card.id, card]));

export const DEFAULT_LOADOUTS: Record<
  PlayerId,
  {
    kingId: string;
    commanderId: string;
    auraMode: AuraMode;
    name: string;
    deckCardIds?: string[];
  }
> = {
  P1: {
    kingId: "K_HUMAN_AUREN",
    commanderId: "C_HEAVEN_VALORIA",
    auraMode: "PULSE",
    name: "ผู้เล่น 1",
  },
  P2: {
    kingId: "K_HUMAN_AUREN",
    commanderId: "C_DEMON_GOREL",
    auraMode: "BURST",
    name: "ผู้เล่น 2",
  },
};

export function getAllowedDeckCardsByKing(king: KingCard): DeckCard[] {
  const forbidden = new Set<DeckCardType>(king.forbiddenCardTypes ?? []);
  return deckCards.filter((card) => {
    if (forbidden.has(card.cardType)) {
      return false;
    }
    if (king.allowedFactionsInDeck.includes(card.faction)) {
      return true;
    }
    return card.faction === "NEUTRAL";
  });
}

export function buildMockDeckForKing(king: KingCard, deckSize = DEFAULT_DECK_SIZE): DeckCard[] {
  const allowedCards = getAllowedDeckCardsByKing(king);
  if (allowedCards.length === 0) {
    return [];
  }

  // Mock mode: repeat allowed cards to hit deck size so gameplay can start immediately.
  const deck: DeckCard[] = [];
  let pointer = 0;
  while (deck.length < deckSize) {
    deck.push(allowedCards[pointer % allowedCards.length]);
    pointer += 1;
  }
  return deck;
}

export interface DeckBuildResult {
  deck: DeckCard[];
  errors: string[];
  counts: Record<string, number>;
}

export function buildDeckFromCardIds(
  king: KingCard,
  cardIds: string[],
  deckSize = DEFAULT_DECK_SIZE,
): DeckBuildResult {
  const errors = new Set<string>();
  const counts = new Map<string, number>();
  const allowedIds = new Set(getAllowedDeckCardsByKing(king).map((card) => card.id));
  const deck: DeckCard[] = [];

  if (cardIds.length !== deckSize) {
    errors.add(`เด็คต้องมี ${deckSize} ใบ (ตอนนี้ ${cardIds.length})`);
  }

  for (const cardId of cardIds) {
    const card = cardsById.get(cardId);
    if (!card || card.kind !== "DECK_CARD") {
      errors.add(`ไม่พบการ์ดเด็ค: ${cardId}`);
      continue;
    }

    if (!allowedIds.has(cardId)) {
      errors.add(`การ์ด ${card.name.th} ใช้กับราชานี้ไม่ได้`);
      continue;
    }

    const nextCount = (counts.get(cardId) ?? 0) + 1;
    counts.set(cardId, nextCount);
    if (nextCount > card.maxCopies) {
      errors.add(`การ์ด ${card.name.th} ใส่เกินจำนวนสูงสุด (${card.maxCopies})`);
      continue;
    }

    deck.push(card);
  }

  return {
    deck: errors.size ? [] : deck,
    errors: [...errors],
    counts: Object.fromEntries(counts),
  };
}

export function defaultDeckIdsForKingId(kingId: string, deckSize = DEFAULT_DECK_SIZE): string[] {
  const king = getKingById(kingId);
  return buildMockDeckForKing(king, deckSize).map((card) => card.id);
}

export function getKingById(id: string): KingCard {
  const card = cardsById.get(id);
  if (!card || card.kind !== "KING") {
    throw new Error(`ไม่พบรหัสราชาที่ถูกต้อง: ${id}`);
  }
  return card;
}

export function getCommanderById(id: string): CommanderCard {
  const card = cardsById.get(id);
  if (!card || card.kind !== "COMMANDER") {
    throw new Error(`ไม่พบรหัสแม่ทัพที่ถูกต้อง: ${id}`);
  }
  return card;
}

export function cardArtUrl(card: Card): string {
  if (card.kind === "KING") {
    if (card.race === "HUMAN") {
      return "/card-art/king-human.svg";
    }
    return card.faction === "HEAVEN" ? "/card-art/king-heaven.svg" : "/card-art/king-demon.svg";
  }
  if (card.kind === "COMMANDER") {
    return card.faction === "HEAVEN"
      ? "/card-art/commander-heaven.svg"
      : "/card-art/commander-demon.svg";
  }
  if (card.cardType === "SPELL_CLASS") {
    return "/card-art/spell-class.svg";
  }
  if (card.cardType === "SKILL_RACE") {
    return "/card-art/skill-race.svg";
  }
  if (card.cardType === "SKILL_SIDE") {
    return "/card-art/skill-side.svg";
  }
  if (card.faction === "HEAVEN") {
    return "/card-art/faction-heaven.svg";
  }
  if (card.faction === "DEMON") {
    return "/card-art/faction-demon.svg";
  }
  return "/card-art/faction-neutral.svg";
}

export function factionLabel(faction: Faction): string {
  if (faction === "HEAVEN") {
    return "สวรรค์";
  }
  if (faction === "DEMON") {
    return "ปีศาจ";
  }
  return "กลาง";
}

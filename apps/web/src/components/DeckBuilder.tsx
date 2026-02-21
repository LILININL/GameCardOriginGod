"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { CardDetailModal } from "@/components/CardDetailModal";
import {
  cardArtUrl,
  commanders,
  getAllowedDeckCardsByKing,
  getKingById,
  kings,
} from "@/lib/cards";
import {
  DECK_PRESETS,
  recommendBestDeckForKingId,
  recommendBestPresetForKing,
  recommendDeckForKingId,
  type DeckPresetId,
} from "@/lib/game/deck-recommend";
import {
  cardCostText,
  classTagText,
  deckCardTypeText,
  explainDeckRequirements,
  factionText,
  raceText,
} from "@/lib/game/card-explain";
import { useGameStore, type MatchConfig } from "@/lib/game/store";
import { type AuraMode, type DeckCard, type PlayerId } from "@/lib/game/types";

const STORAGE_KEY = "alumilive.deckbuilder.config.v1";
const DECK_SIZE = 24;

function playerText(playerId: PlayerId): string {
  return playerId === "P1" ? "ผู้เล่น 1" : "ผู้เล่น 2";
}

function auraModeText(mode: AuraMode): string {
  return mode === "BURST" ? "Burst (ครั้งเดียว)" : "Pulse (ทุก 2 เทิร์น)";
}

export function DeckBuilder(): React.JSX.Element {
  const config = useGameStore((store) => store.config);
  const setConfig = useGameStore((store) => store.setConfig);
  const updateConfig = useGameStore((store) => store.updateConfig);
  const setDeckForPlayer = useGameStore((store) => store.setDeckForPlayer);
  const resetDeckForPlayer = useGameStore((store) => store.resetDeckForPlayer);
  const validateDeckForPlayer = useGameStore((store) => store.validateDeckForPlayer);

  const [activePlayerId, setActivePlayerId] = useState<PlayerId>("P1");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | DeckCard["cardType"]>("ALL");
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<DeckPresetId>("BALANCED_META");
  const [hydrated, setHydrated] = useState(false);

  const playerConfig = config[activePlayerId];
  const king = useMemo(() => getKingById(playerConfig.kingId), [playerConfig.kingId]);
  const allowedCards = useMemo(() => getAllowedDeckCardsByKing(king), [king]);
  const deckValidation = validateDeckForPlayer(activePlayerId);
  const bestPresetForKing = useMemo(() => recommendBestPresetForKing(king), [king]);

  const countById = useMemo(() => {
    const map = new Map<string, number>();
    for (const cardId of playerConfig.deckCardIds) {
      map.set(cardId, (map.get(cardId) ?? 0) + 1);
    }
    return map;
  }, [playerConfig.deckCardIds]);

  const deckList = useMemo(() => {
    const map = new Map<string, DeckCard>();
    for (const card of allowedCards) {
      map.set(card.id, card);
    }
    return [...countById.entries()]
      .map(([cardId, count]) => ({ card: map.get(cardId), count }))
      .filter((item): item is { card: DeckCard; count: number } => !!item.card)
      .sort((a, b) => a.card.cost.mana - b.card.cost.mana || a.card.name.th.localeCompare(b.card.name.th));
  }, [allowedCards, countById]);

  const filteredCards = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return allowedCards.filter((card) => {
      if (typeFilter !== "ALL" && card.cardType !== typeFilter) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return (
        card.id.toLowerCase().includes(normalized) ||
        card.name.th.toLowerCase().includes(normalized) ||
        card.name.en.toLowerCase().includes(normalized) ||
        card.description.th.toLowerCase().includes(normalized)
      );
    });
  }, [allowedCards, search, typeFilter]);

  const previewCard = useMemo(() => {
    if (!previewCardId) {
      return null;
    }
    return allowedCards.find((card) => card.id === previewCardId) ?? null;
  }, [allowedCards, previewCardId]);

  useEffect(() => {
    if (hydrated) {
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<MatchConfig>;
      if (parsed?.P1?.kingId && parsed?.P2?.kingId) {
        setConfig({
          P1: {
            ...config.P1,
            ...parsed.P1,
            deckCardIds:
              parsed.P1.deckCardIds && parsed.P1.deckCardIds.length
                ? parsed.P1.deckCardIds
                : recommendBestDeckForKingId(parsed.P1.kingId),
          },
          P2: {
            ...config.P2,
            ...parsed.P2,
            deckCardIds:
              parsed.P2.deckCardIds && parsed.P2.deckCardIds.length
                ? parsed.P2.deckCardIds
                : recommendBestDeckForKingId(parsed.P2.kingId),
          },
        });
      }
    } catch {
      // Ignore malformed local data and continue with defaults.
    } finally {
      setHydrated(true);
    }
  }, [config.P1, config.P2, hydrated, setConfig]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config, hydrated]);

  const addCard = (cardId: string): void => {
    const card = allowedCards.find((item) => item.id === cardId);
    if (!card) {
      return;
    }
    const current = countById.get(cardId) ?? 0;
    if (current >= card.maxCopies) {
      return;
    }
    if (playerConfig.deckCardIds.length >= DECK_SIZE) {
      return;
    }
    setDeckForPlayer(activePlayerId, [...playerConfig.deckCardIds, cardId]);
  };

  const removeCard = (cardId: string): void => {
    const next = [...playerConfig.deckCardIds];
    const index = next.findIndex((item) => item === cardId);
    if (index < 0) {
      return;
    }
    next.splice(index, 1);
    setDeckForPlayer(activePlayerId, next);
  };

  const applyPresetDeck = (presetId: DeckPresetId): void => {
    const nextDeck = recommendDeckForKingId(playerConfig.kingId, presetId, DECK_SIZE);
    setDeckForPlayer(activePlayerId, nextDeck);
    setSelectedPresetId(presetId);
  };

  const applyBestDeck = (): void => {
    setDeckForPlayer(activePlayerId, recommendBestDeckForKingId(playerConfig.kingId, DECK_SIZE));
    setSelectedPresetId(bestPresetForKing);
  };

  return (
    <>
      <CardDetailModal
        card={previewCard}
        open={!!previewCard}
        onClose={() => setPreviewCardId(null)}
      />

      <section className="space-y-4">
        <header className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
          <h2 className="text-2xl font-semibold tracking-tight">ตัวจัดเด็ค (Deck Builder)</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            จัดเด็คได้ฝั่งละ 24 ใบ, การ์ดซ้ำได้ไม่เกิน 2 ใบ และจะใช้เด็คนี้ทันทีเมื่อกดเริ่มเกม
          </p>
        </header>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <div className="flex flex-wrap gap-2">
            {(["P1", "P2"] as PlayerId[]).map((playerId) => (
              <button
                key={playerId}
                type="button"
                onClick={() => setActivePlayerId(playerId)}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  activePlayerId === playerId
                    ? "border-[var(--accent)] bg-[#e8f3eb]"
                    : "border-[var(--line)] bg-white"
                }`}
              >
                แก้เด็ค {playerText(playerId)}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_1.4fr_1.2fr]">
            <article className="space-y-3 rounded-xl border border-[var(--line)] bg-white p-3">
              <h3 className="text-sm font-semibold">ตั้งค่าโหลดเอาต์</h3>
              <input
                value={playerConfig.name}
                onChange={(event) => updateConfig(activePlayerId, { name: event.target.value })}
                className="w-full rounded-lg border border-[var(--line)] px-2 py-1 text-sm"
                placeholder={`ชื่อ ${playerText(activePlayerId)}`}
              />
              <select
                value={playerConfig.kingId}
                onChange={(event) => {
                  const kingId = event.target.value;
                  updateConfig(activePlayerId, {
                    kingId,
                    deckCardIds: recommendBestDeckForKingId(kingId),
                  });
                }}
                className="w-full rounded-lg border border-[var(--line)] px-2 py-1 text-sm"
              >
                {kings.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name.th}
                  </option>
                ))}
              </select>
              <select
                value={playerConfig.commanderId}
                onChange={(event) => updateConfig(activePlayerId, { commanderId: event.target.value })}
                className="w-full rounded-lg border border-[var(--line)] px-2 py-1 text-sm"
              >
                {commanders.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name.th}
                  </option>
                ))}
              </select>
              <select
                value={playerConfig.auraMode}
                onChange={(event) => updateConfig(activePlayerId, { auraMode: event.target.value as AuraMode })}
                className="w-full rounded-lg border border-[var(--line)] px-2 py-1 text-sm"
              >
                <option value="BURST">{auraModeText("BURST")}</option>
                <option value="PULSE">{auraModeText("PULSE")}</option>
              </select>

              <div className="rounded-lg border border-[var(--line)] bg-[var(--chip)] p-2 text-xs text-[var(--muted)]">
                ฝั่ง: {factionText(king.faction)} | เผ่าราชา: {raceText(king.race)}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={applyBestDeck}
                  className="flex-1 rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-xs"
                >
                  จัดเด็คอัตโนมัติ
                </button>
                <button
                  type="button"
                  onClick={() => resetDeckForPlayer(activePlayerId)}
                  className="flex-1 rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-xs"
                >
                  คืนค่าเด็คแนะนำ
                </button>
                <button
                  type="button"
                  onClick={() => setDeckForPlayer(activePlayerId, [])}
                  className="flex-1 rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-xs"
                >
                  ล้างเด็ค
                </button>
              </div>

              <div className="rounded-lg border border-[var(--line)] bg-[var(--chip)] p-2 text-xs">
                <p className="font-semibold">เด็คแนะนำตามคอมโบ</p>
                <p className="mt-1 text-[var(--muted)]">
                  แนะนำตอนนี้: {
                    DECK_PRESETS.find((preset) => preset.id === bestPresetForKing)?.name ?? bestPresetForKing
                  }
                </p>
                <div className="mt-2 space-y-1">
                  {DECK_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPresetDeck(preset.id)}
                      className={`w-full rounded-md border px-2 py-1 text-left text-xs ${
                        selectedPresetId === preset.id
                          ? "border-[var(--accent)] bg-[#e8f3eb]"
                          : "border-[var(--line)] bg-white"
                      }`}
                    >
                      <p className="font-semibold">{preset.name}</p>
                      <p className="text-[var(--muted)]">{preset.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            </article>

            <article className="space-y-3 rounded-xl border border-[var(--line)] bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">การ์ดที่เลือกได้</h3>
                <span className="text-xs text-[var(--muted)]">รวม {filteredCards.length} ใบ</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="sm:col-span-2 rounded-lg border border-[var(--line)] px-2 py-1 text-sm"
                  placeholder="ค้นหาชื่อ/รหัสการ์ด"
                />
                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value as "ALL" | DeckCard["cardType"])}
                  className="rounded-lg border border-[var(--line)] px-2 py-1 text-sm"
                >
                  <option value="ALL">ทุกชนิด</option>
                  <option value="UNIT">ยูนิต</option>
                  <option value="SPELL_GENERIC">เวททั่วไป</option>
                  <option value="SPELL_CLASS">เวทอาชีพ</option>
                  <option value="SKILL_RACE">สกิลเผ่า</option>
                  <option value="SKILL_SIDE">สกิลฝั่ง</option>
                </select>
              </div>

              <div className="max-h-[640px] space-y-2 overflow-auto pr-1">
                {filteredCards.map((card) => {
                  const count = countById.get(card.id) ?? 0;
                  const canAdd = count < card.maxCopies && playerConfig.deckCardIds.length < DECK_SIZE;
                  const requirements = explainDeckRequirements(card);

                  return (
                    <article key={card.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2">
                      <div className="flex gap-2">
                        <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-[var(--line)]">
                          <Image src={cardArtUrl(card)} alt={card.name.th} fill className="object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{card.name.th}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {deckCardTypeText(card)} | {cardCostText(card)} | ซ้ำได้สูงสุด {card.maxCopies}
                          </p>
                          <p className="line-clamp-2 text-xs text-[var(--muted)]">{card.description.th}</p>
                          {requirements.length ? (
                            <p className="line-clamp-1 text-[11px] text-[#916300]">เงื่อนไข: {requirements[0]}</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => removeCard(card.id)}
                          disabled={count === 0}
                          className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs disabled:opacity-45"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          onClick={() => addCard(card.id)}
                          disabled={!canAdd}
                          className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs disabled:opacity-45"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewCardId(card.id)}
                          className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs"
                        >
                          ดูเอฟเฟกต์
                        </button>
                        <span className="ml-auto rounded-md bg-[var(--chip)] px-2 py-1 text-xs text-[var(--muted)]">
                          ใส่แล้ว {count}
                        </span>
                        <span className="rounded-md bg-[var(--chip)] px-2 py-1 text-xs text-[var(--muted)]">
                          {card.classTags.map(classTagText).join(", ") || "ไม่มีสายอาชีพ"}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </article>

            <article className="space-y-3 rounded-xl border border-[var(--line)] bg-white p-3">
              <h3 className="text-sm font-semibold">เด็คที่จัดไว้ ({playerText(activePlayerId)})</h3>

              <div
                className={`rounded-lg border p-2 text-xs ${
                  deckValidation.ok ? "border-[#a9d2b6] bg-[#f1faf4]" : "border-[#dcb9ad] bg-[#fff5f2]"
                }`}
              >
                <p className="font-semibold">
                  จำนวนการ์ด {deckValidation.cardCount} / {DECK_SIZE}
                </p>
                <p className="mt-1 text-[var(--muted)]">
                  สถานะ: {deckValidation.ok ? "พร้อมใช้เริ่มเกม" : "เด็คยังไม่ผ่านกติกา"}
                </p>
                {deckValidation.errors.length ? (
                  <ul className="mt-1 space-y-1 text-[#7a3d2e]">
                    {deckValidation.errors.slice(0, 4).map((error) => (
                      <li key={error}>- {error}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="max-h-[640px] space-y-2 overflow-auto pr-1">
                {deckList.map((item) => (
                  <article
                    key={item.card.id}
                    className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{item.card.name.th}</p>
                        <p className="text-[var(--muted)]">
                          {deckCardTypeText(item.card)} | {cardCostText(item.card)}
                        </p>
                      </div>
                      <span className="rounded-md bg-[var(--chip)] px-2 py-1 text-[var(--muted)]">
                        x{item.count}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => addCard(item.card.id)}
                        disabled={item.count >= item.card.maxCopies || playerConfig.deckCardIds.length >= DECK_SIZE}
                        className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs disabled:opacity-45"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCard(item.card.id)}
                        className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewCardId(item.card.id)}
                        className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs"
                      >
                        ดูรายละเอียด
                      </button>
                    </div>
                  </article>
                ))}
                {!deckList.length ? (
                  <div className="rounded-lg border border-dashed border-[var(--line)] p-3 text-xs text-[var(--muted)]">
                    ยังไม่มีการ์ดในเด็ค
                  </div>
                ) : null}
              </div>
            </article>
          </div>
        </section>
      </section>
    </>
  );
}

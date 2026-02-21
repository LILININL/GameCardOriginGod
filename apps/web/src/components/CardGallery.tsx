"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { CardDetailModal } from "@/components/CardDetailModal";
import { allCards, cardArtUrl, factionLabel } from "@/lib/cards";
import { type Card } from "@/lib/game/types";

function cardTypeLabel(card: Card): string {
  if (card.kind === "KING") {
    return "ราชา";
  }
  if (card.kind === "COMMANDER") {
    return "แม่ทัพ";
  }
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

function cardCostLabel(card: Card): string {
  if (card.kind === "KING") {
    return "อัลติเมต 1 ครั้ง";
  }
  if (card.kind === "COMMANDER") {
    return `มานา ${card.cost.mana}`;
  }
  return `มานา ${card.cost.mana} / ฝั่ง ${card.cost.sideStacks}`;
}

export function CardGallery(): React.JSX.Element {
  const [keyword, setKeyword] = useState("");
  const [kindFilter, setKindFilter] = useState<"ALL" | Card["kind"]>("ALL");
  const [factionFilter, setFactionFilter] = useState<"ALL" | Card["faction"]>("ALL");
  const [previewCardId, setPreviewCardId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return allCards.filter((card) => {
      if (kindFilter !== "ALL" && card.kind !== kindFilter) {
        return false;
      }
      if (factionFilter !== "ALL" && card.faction !== factionFilter) {
        return false;
      }
      if (!normalized) {
        return true;
      }

      return (
        card.name.en.toLowerCase().includes(normalized) ||
        card.name.th.toLowerCase().includes(normalized) ||
        card.description.en.toLowerCase().includes(normalized) ||
        card.id.toLowerCase().includes(normalized)
      );
    });
  }, [factionFilter, keyword, kindFilter]);

  const previewCard = useMemo(() => {
    if (!previewCardId) {
      return null;
    }
    return allCards.find((card) => card.id === previewCardId) ?? null;
  }, [previewCardId]);

  return (
    <>
      <CardDetailModal
        card={previewCard}
        open={!!previewCard}
        onClose={() => setPreviewCardId(null)}
      />

      <section className="space-y-6">
        <header className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 shadow-sm backdrop-blur">
        <h2 className="text-2xl font-semibold tracking-tight">ห้องแสดงการ์ด (Alpha Expanded)</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          ใช้ชุดการ์ด mock ที่ขยายต่อเนื่องจากสเปก Alpha เพื่อเทสต์เกมเพลย์และบาลานซ์ได้ละเอียดขึ้น
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm outline-none ring-0 placeholder:text-[var(--muted)] focus:border-[var(--accent)]"
            placeholder="ค้นหาไอดี / ชื่อการ์ด / คำอธิบาย..."
          />
          <select
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value as "ALL" | Card["kind"])}
            className="rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm"
          >
            <option value="ALL">ทุกประเภท</option>
            <option value="KING">ราชา</option>
            <option value="COMMANDER">แม่ทัพ</option>
            <option value="DECK_CARD">การ์ดเด็ค</option>
          </select>
          <select
            value={factionFilter}
            onChange={(event) => setFactionFilter(event.target.value as "ALL" | Card["faction"])}
            className="rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm"
          >
            <option value="ALL">ทุกฝั่ง</option>
            <option value="HEAVEN">สวรรค์</option>
            <option value="DEMON">ปีศาจ</option>
            <option value="NEUTRAL">กลาง</option>
          </select>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-sm">
            ผลลัพธ์ {filtered.length} / {allCards.length}
          </div>
        </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filtered.map((card) => (
            <article
              key={card.id}
              className="group overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <div className="relative h-36 w-full overflow-hidden border-b border-[var(--line)]">
                <Image
                  src={cardArtUrl(card)}
                  alt={card.name.th}
                  fill
                  sizes="(max-width: 1280px) 50vw, 25vw"
                  className="object-cover"
                  priority={card.kind === "KING"}
                />
                <div className="absolute inset-x-2 top-2 flex items-center justify-between text-xs">
                  <span className="rounded-full bg-black/60 px-2 py-1 font-medium text-white">
                    {cardTypeLabel(card)}
                  </span>
                  <span className="rounded-full bg-black/60 px-2 py-1 font-medium text-white">
                    {factionLabel(card.faction)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 p-4">
                <h3 className="truncate text-base font-semibold leading-tight">{card.name.th}</h3>
                <p className="h-8 overflow-hidden text-xs text-[var(--muted)]">{card.description.th}</p>
                <p className="truncate text-[11px] text-[var(--muted)]">{card.name.en}</p>
                <div className="flex flex-wrap gap-1 text-xs text-[var(--muted)]">
                  <span className="rounded-full bg-[var(--chip)] px-2 py-1">{card.id}</span>
                  <span className="rounded-full bg-[var(--chip)] px-2 py-1">{cardCostLabel(card)}</span>
                  {card.kind === "DECK_CARD" && (
                    <span className="rounded-full bg-[var(--chip)] px-2 py-1">
                      โจมตี {card.attack ?? "-"} / พลังชีวิต {card.hp ?? "-"}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewCardId(card.id)}
                  className="w-full rounded-lg border border-[var(--line)] bg-white px-2 py-1 text-xs hover:border-[var(--accent)]"
                >
                  ดูรายละเอียดการ์ด
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

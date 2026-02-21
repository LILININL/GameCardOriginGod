"use client";

import { type ReactNode } from "react";

import {
  cardCostText,
  cardKindText,
  classTagText,
  explainCardAbilities,
  explainDeckRequirements,
  factionText,
  raceText,
} from "@/lib/game/card-explain";
import { type Card } from "@/lib/game/types";

interface CardDetailModalProps {
  card: Card | null;
  open: boolean;
  onClose: () => void;
  footer?: ReactNode;
}

export function CardDetailModal({
  card,
  open,
  onClose,
  footer,
}: CardDetailModalProps): React.JSX.Element | null {
  if (!open || !card) {
    return null;
  }

  const abilities = explainCardAbilities(card);
  const requirements = card.kind === "DECK_CARD" ? explainDeckRequirements(card) : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-4">
      <article className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-[var(--line)] bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--muted)]">{card.id}</p>
            <h3 className="mt-1 text-2xl font-semibold">{card.name.th}</h3>
            <p className="text-sm text-[var(--muted)]">{card.name.en}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--line)] bg-[var(--chip)] px-2 py-1 text-sm"
          >
            ปิด
          </button>
        </div>

        <p className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--chip)] p-3 text-sm">
          {card.description.th}
        </p>

        <div className="mt-3 flex flex-wrap gap-1 text-xs text-[var(--muted)]">
          <span className="rounded-full bg-[var(--chip)] px-2 py-1">{cardKindText(card)}</span>
          <span className="rounded-full bg-[var(--chip)] px-2 py-1">{factionText(card.faction)}</span>
          <span className="rounded-full bg-[var(--chip)] px-2 py-1">{raceText(card.race)}</span>
          <span className="rounded-full bg-[var(--chip)] px-2 py-1">{cardCostText(card)}</span>
          {card.classTags.map((classTag) => (
            <span key={classTag} className="rounded-full bg-[var(--chip)] px-2 py-1">
              {classTagText(classTag)}
            </span>
          ))}
        </div>

        {card.kind === "DECK_CARD" && (
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[#f8fbf8] p-3 text-xs">
            <p className="font-semibold">ค่าสเตตัสและชนิดการใช้</p>
            <p className="mt-1 text-[var(--muted)]">
              โจมตี {card.attack ?? "-"} • พลังชีวิต {card.hp ?? "-"} • ระยะ {card.rangeType ?? "-"} • ลงได้{" "}
              {card.deployment ?? "-"}
            </p>
            <p className="mt-1 text-[var(--muted)]">จำนวนสูงสุดต่อเด็ค: {card.maxCopies}</p>
          </div>
        )}

        <div className="mt-3 space-y-2">
          <p className="text-sm font-semibold">เงื่อนไขการใช้</p>
          {requirements.length ? (
            <ul className="space-y-1 text-xs text-[var(--muted)]">
              {requirements.map((line) => (
                <li key={line}>- {line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--muted)]">ไม่มีเงื่อนไขพิเศษ</p>
          )}
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-sm font-semibold">เอฟเฟกต์การ์ด</p>
          {abilities.length ? (
            <ul className="space-y-1 text-xs text-[var(--muted)]">
              {abilities.map((line) => (
                <li key={line}>- {line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-[var(--muted)]">การ์ดใบนี้ไม่มีเอฟเฟกต์เพิ่มเติม</p>
          )}
        </div>

        {footer ? <div className="mt-4 border-t border-[var(--line)] pt-3">{footer}</div> : null}
      </article>
    </div>
  );
}


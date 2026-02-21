"use client";

import { useState } from "react";

import { CardGallery } from "@/components/CardGallery";
import { DeckBuilder } from "@/components/DeckBuilder";
import { GameRoom } from "@/components/GameRoom";

type Tab = "PLAY" | "CARDS" | "DECK";

export default function HomePage(): React.JSX.Element {
  const [tab, setTab] = useState<Tab>("PLAY");

  return (
    <div className="mx-auto min-h-screen w-full max-w-370 px-4 py-8 md:px-8">
      <header className="mb-6 rounded-3xl border border-(--line) bg-(--panel) p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-(--muted)">Alumilive โหมดทดสอบ Alpha</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
          โชว์การ์ด + ห้องเล่นตัวอย่าง
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-(--muted)">
          โหมดนี้ใช้ข้อมูลการ์ด Alpha แบบขยาย และจำลองกติกาหลัก เช่น เทิร์น, มานา, กระดานหน้า/หลัง,
          ออร่าแม่ทัพ, อัลติเมตราชา, คอมโบ และ Stack ฝั่ง เพื่อทดสอบเกมเพลย์ได้ทันที
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setTab("PLAY")}
            className={`rounded-xl border px-3 py-2 text-sm ${
              tab === "PLAY"
                ? "border-(--accent) bg-[#e8f3eb]"
                : "border-(--line) bg-(--card)"
            }`}
          >
            ห้องเล่นเกม
          </button>
          <button
            type="button"
            onClick={() => setTab("DECK")}
            className={`rounded-xl border px-3 py-2 text-sm ${
              tab === "DECK"
                ? "border-[var(--accent)] bg-[#e8f3eb]"
                : "border-[var(--line)] bg-[var(--card)]"
            }`}
          >
            จัดเด็ค
          </button>
          <button
            type="button"
            onClick={() => setTab("CARDS")}
            className={`rounded-xl border px-3 py-2 text-sm ${
              tab === "CARDS"
                ? "border-[var(--accent)] bg-[#e8f3eb]"
                : "border-[var(--line)] bg-[var(--card)]"
            }`}
          >
            ห้องแสดงการ์ด
          </button>
        </div>
      </header>

      {tab === "PLAY" ? <GameRoom /> : null}
      {tab === "DECK" ? <DeckBuilder /> : null}
      {tab === "CARDS" ? <CardGallery /> : null}
    </div>
  );
}

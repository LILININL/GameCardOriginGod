import { NextResponse } from "next/server";

import cards from "@/data/card-set";

export const runtime = "edge";

export function GET(): NextResponse {
  return NextResponse.json({
    schemaVersion: "1",
    contentVersion: `${cards.set}.mock-local`,
    generatedOn: cards.generatedOn,
    cardCount: cards.cards.length,
  });
}

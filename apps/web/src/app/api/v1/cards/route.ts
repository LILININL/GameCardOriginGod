import { NextRequest, NextResponse } from "next/server";

import cards from "@/data/card-set";

export function GET(request: NextRequest): NextResponse {
  const set = request.nextUrl.searchParams.get("set");
  if (set && set !== cards.set) {
    return NextResponse.json({ set, cards: [] });
  }

  return NextResponse.json({
    set: cards.set,
    cards: cards.cards,
  });
}

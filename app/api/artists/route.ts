import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { searchSpotifyArtists } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request, 60, 60_000, "artists");
  if (!rate.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (query.length < 2 || query.length > 100) return NextResponse.json({ artists: [] });
  try {
    const artists = await searchSpotifyArtists(query, request.signal);
    return NextResponse.json({ artists }, { headers: { "Cache-Control": "private, max-age=300" } });
  } catch {
    return NextResponse.json({ error: "Artist suggestions are unavailable." }, { status: 502 });
  }
}

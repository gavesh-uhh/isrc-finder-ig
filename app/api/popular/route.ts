import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import { getSpotifyPopularTracks } from "@/lib/spotify";
import type { ApiErrorResponse, TrackSuggestion } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request, 30, 60_000, "popular");
  if (!rate.allowed) {
    return NextResponse.json<ApiErrorResponse>(
      { error: "Too many popular-track requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    const result = await getSpotifyPopularTracks(6, request.signal);
    return NextResponse.json<{ tracks: TrackSuggestion[]; configured: boolean }>(
      result,
      // Short TTL on purpose: the payload is a random sample of the playlist,
      // so a long browser cache would keep serving the same six tracks.
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch {
    return NextResponse.json<ApiErrorResponse>(
      { error: "Popular tracks are temporarily unavailable." },
      { status: 502 },
    );
  }
}

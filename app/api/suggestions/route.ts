import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import { getSpotifySuggestions, isSpotifyConfigured } from "@/lib/spotify";
import { cleanQueryPart } from "@/lib/query";
import type { ApiErrorResponse, SuggestionResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request, 60, 60_000, "suggestions");
  if (!rate.allowed) {
    return NextResponse.json<ApiErrorResponse>(
      { error: "Too many suggestion requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const term = cleanQueryPart(request.nextUrl.searchParams.get("track") ?? "");

  if (term.length < 2) {
    return NextResponse.json<SuggestionResponse>({
      suggestions: [],
      configured: isSpotifyConfigured(),
    });
  }

  if (term.length > 100) {
    return NextResponse.json<ApiErrorResponse>(
      { error: "Suggestion text must be 100 characters or fewer." },
      { status: 400 },
    );
  }

  if (!isSpotifyConfigured()) {
    return NextResponse.json<SuggestionResponse>({
      suggestions: [],
      configured: false,
    });
  }

  try {
    const suggestions = await getSpotifySuggestions(term, request.signal);
    return NextResponse.json<SuggestionResponse>(
      { suggestions, configured: true },
      { headers: { "Cache-Control": "private, max-age=30" } },
    );
  } catch {
    return NextResponse.json<ApiErrorResponse>(
      { error: "Spotify suggestions are temporarily unavailable." },
      { status: 502 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

import { cleanQueryPart } from "@/lib/query";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSpotifyGenres, isSpotifyConfigured, searchSpotifyByGenre } from "@/lib/spotify";
import type {
  ApiErrorResponse,
  GenreListResponse,
  GenreTracksResponse,
} from "@/lib/types";

export const runtime = "nodejs";

const MAX_GENRE_LENGTH = 100;
const GENRE_TRACK_LIMIT = 10;

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request, 30, 60_000, "genres");
  if (!rate.allowed) {
    return NextResponse.json<ApiErrorResponse>(
      { error: "Too many genre requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const genre = cleanQueryPart(request.nextUrl.searchParams.get("genre") ?? "");

  if (!genre) {
    try {
      const result = await getSpotifyGenres(request.signal);
      return NextResponse.json<GenreListResponse>(result, {
        headers: { "Cache-Control": "private, max-age=300" },
      });
    } catch {
      return NextResponse.json<ApiErrorResponse>(
        { error: "Genres are temporarily unavailable." },
        { status: 502 },
      );
    }
  }

  if (genre.length > MAX_GENRE_LENGTH) {
    return NextResponse.json<ApiErrorResponse>(
      { error: `Genre must be ${MAX_GENRE_LENGTH} characters or fewer.` },
      { status: 400 },
    );
  }

  if (!isSpotifyConfigured()) {
    return NextResponse.json<ApiErrorResponse>(
      { error: "Genre browsing requires Spotify credentials." },
      { status: 503 },
    );
  }

  const result = await searchSpotifyByGenre(genre, GENRE_TRACK_LIMIT, request.signal);
  if (result.status === "error") {
    return NextResponse.json<ApiErrorResponse>(
      { error: "Genre tracks are temporarily unavailable." },
      { status: 502 },
    );
  }

  return NextResponse.json<GenreTracksResponse>(
    { recordings: result.recordings, genre, configured: true },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}

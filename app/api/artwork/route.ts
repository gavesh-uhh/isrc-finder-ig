import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import { getSpotifyArtwork, isSpotifyConfigured } from "@/lib/spotify";
import { cleanQueryPart } from "@/lib/query";
import type { ApiErrorResponse, ArtworkResponse } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request, 60, 60_000, "artwork");
  if (!rate.allowed) {
    return NextResponse.json<ApiErrorResponse>(
      { error: "Too many artwork requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  const track = cleanQueryPart(request.nextUrl.searchParams.get("track") ?? "");
  const artist = cleanQueryPart(request.nextUrl.searchParams.get("artist") ?? "");

  if (!track || !artist) {
    return NextResponse.json<ApiErrorResponse>(
      { error: "Both track and artist are required." },
      { status: 400 },
    );
  }

  if (track.length > 150 || artist.length > 150) {
    return NextResponse.json<ApiErrorResponse>(
      { error: "Artwork lookup fields are too long." },
      { status: 400 },
    );
  }

  if (!isSpotifyConfigured()) {
    return NextResponse.json<ArtworkResponse>({
      artworkUrl: null,
      configured: false,
    });
  }

  try {
    const artworkUrl = await getSpotifyArtwork(track, artist, request.signal);
    return NextResponse.json<ArtworkResponse>(
      { artworkUrl, configured: true },
      { headers: { "Cache-Control": "private, max-age=86400" } },
    );
  } catch {
    return NextResponse.json<ApiErrorResponse>(
      { error: "Spotify artwork is temporarily unavailable." },
      { status: 502 },
    );
  }
}

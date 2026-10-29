import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import { getSpotifyArtistArtwork } from "@/lib/spotify";

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request, 60, 60_000, "artist-artwork");
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many artwork requests." }, {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSeconds) },
    });
  }

  const artistId = request.nextUrl.searchParams.get("artistId") ?? "";
  if (!/^[a-zA-Z0-9]{22}$/.test(artistId)) {
    return NextResponse.json({ error: "A valid Spotify artist ID is required." }, { status: 400 });
  }

  try {
    const artworkUrl = await getSpotifyArtistArtwork(artistId);
    return NextResponse.json({ artworkUrl }, {
      headers: { "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Artist artwork is temporarily unavailable." }, { status: 502 });
  }
}

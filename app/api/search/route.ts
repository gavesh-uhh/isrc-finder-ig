import { NextRequest, NextResponse } from "next/server";

import { searchMusicBrainz } from "@/lib/musicbrainz";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildFreeTextCandidates,
  buildMusicBrainzQuery,
  filterCandidateRecordings,
  filterStructuredRecordings,
  mergeRecordings,
  mergeUniqueRecordings,
  prioritizeRecordings,
  type SearchParts,
} from "@/lib/search";
import { isSpotifyConfigured, searchSpotify } from "@/lib/spotify";
import type { ApiErrorResponse, ProviderStatus, SearchResponse } from "@/lib/types";
import { cleanQueryPart } from "@/lib/query";

export const runtime = "nodejs";

const MAX_PART_LENGTH = 200;
const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 25;
const MUSICBRAINZ_FETCH_LIMIT = 50;
const ROUTE_DEADLINE_MS = 6_500;
const ENRICHMENT_GRACE_MS = 4_000;
const QUICK_ENRICHMENT_GRACE_MS = 600;

type ProviderResult = {
  status: ProviderStatus;
  recordings: Awaited<ReturnType<typeof searchMusicBrainz>>["recordings"];
};
type FirstProvider =
  | { provider: "musicbrainz"; result: ProviderResult }
  | { provider: "spotify"; result: ProviderResult }
  | { provider: "deadline" };

function errorResponse(error: string, status: number, headers?: HeadersInit) {
  return NextResponse.json<ApiErrorResponse>({ error }, { status, headers });
}

function settleProvider(
  provider: "musicbrainz" | "spotify",
  promise: Promise<ProviderResult>,
): Promise<FirstProvider> {
  return promise.then((result) => {
    if (result.status === "skipped") {
      return new Promise<FirstProvider>(() => undefined);
    }
    return { provider, result };
  });
}

function wait(milliseconds: number): Promise<null> {
  return new Promise((resolve) => setTimeout(() => resolve(null), milliseconds));
}

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request, 20, 60_000, "search");
  if (!rate.allowed) {
    return errorResponse("Too many searches. Try again shortly.", 429, {
      "Retry-After": String(rate.retryAfterSeconds),
    });
  }

  const params = request.nextUrl.searchParams;
  const parts: SearchParts = {
    query: cleanQueryPart(params.get("query") ?? ""),
    artist: cleanQueryPart(params.get("artist") ?? ""),
    track: cleanQueryPart(params.get("track") ?? ""),
  };

  if (!parts.query && !parts.artist && !parts.track) {
    return errorResponse("Enter a track, artist, or ISRC to search.", 400);
  }

  if (Object.values(parts).some((part) => part.length > MAX_PART_LENGTH)) {
    return errorResponse(`Search fields must be ${MAX_PART_LENGTH} characters or fewer.`, 400);
  }

  const parsedLimit = Number.parseInt(params.get("limit") ?? "", 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, parsedLimit))
    : DEFAULT_LIMIT;
  const musicBrainzQuery = buildMusicBrainzQuery(parts);
  const musicBrainzFetchLimit = Math.min(100, Math.max(limit, MUSICBRAINZ_FETCH_LIMIT));
  const upstreamController = new AbortController();
  const abortOnClientDisconnect = () => upstreamController.abort();
  request.signal.addEventListener("abort", abortOnClientDisconnect, { once: true });
  const deadlineTimer = setTimeout(() => upstreamController.abort(), ROUTE_DEADLINE_MS);

  const musicBrainzPromise = searchMusicBrainz(
    musicBrainzQuery,
    musicBrainzFetchLimit,
    upstreamController.signal,
  );
  const spotifyPromise = searchSpotify(
    parts.query,
    parts.artist,
    parts.track,
    limit,
    upstreamController.signal,
  );

  let musicBrainzResult: ProviderResult = { status: "error", recordings: [] };
  let spotifyResult: ProviderResult = { status: "error", recordings: [] };
  let first: FirstProvider;

  try {
    first = await Promise.race([
      settleProvider("musicbrainz", musicBrainzPromise),
      settleProvider("spotify", spotifyPromise),
      wait(ROUTE_DEADLINE_MS).then(() => ({ provider: "deadline" }) as const),
    ]);

    if (first.provider === "deadline") {
      upstreamController.abort();
      const settled = await Promise.allSettled([musicBrainzPromise, spotifyPromise]);
      if (settled[0].status === "fulfilled") {
        musicBrainzResult = settled[0].value;
      }
      if (settled[1].status === "fulfilled") {
        spotifyResult = settled[1].value;
      }
    } else {
      if (first.provider === "musicbrainz") {
        musicBrainzResult = first.result;
      } else {
        spotifyResult = first.result;
      }

      const secondProvider = first.provider === "musicbrainz" ? "spotify" : "musicbrainz";
      const secondPromise = secondProvider === "musicbrainz" ? musicBrainzPromise : spotifyPromise;
      const firstHasIsrc = first.result.recordings.some((recording) => recording.isrcs.length > 0);
      const secondGrace = firstHasIsrc ? QUICK_ENRICHMENT_GRACE_MS : ENRICHMENT_GRACE_MS;
      const second = await Promise.race([
        secondPromise.then((result) => ({ result })),
        wait(secondGrace),
      ]);
      if (second) {
        if (secondProvider === "musicbrainz") {
          musicBrainzResult = second.result;
        } else {
          spotifyResult = second.result;
        }
      } else {
        upstreamController.abort();
        if (secondProvider === "musicbrainz") {
          musicBrainzResult = { status: "skipped", recordings: [] };
        } else {
          spotifyResult = { status: "skipped", recordings: [] };
        }
      }
    }

    if ((parts.artist || parts.track) && musicBrainzResult.status === "ok") {
      const filteredRecordings = filterStructuredRecordings(
        musicBrainzResult.recordings,
        parts.track,
        parts.artist,
      );
      if (filteredRecordings.length > 0) {
        musicBrainzResult = {
          ...musicBrainzResult,
          recordings: filteredRecordings,
        };
      }
    }

    let fallbackUsed = false;
    if (!upstreamController.signal.aborted && !parts.artist && !parts.track) {
      const candidates = buildFreeTextCandidates(parts.query);
      const initialMatchesCandidate = candidates.some(
        (candidate) => filterCandidateRecordings(musicBrainzResult.recordings, candidate).length > 0,
      );
      if (!initialMatchesCandidate) {
        for (const candidate of candidates) {
          if (upstreamController.signal.aborted) {
            break;
          }
          const fallback = await searchMusicBrainz(
            candidate.query,
            musicBrainzFetchLimit,
            upstreamController.signal,
          );
          if (fallback.status !== "ok") {
            continue;
          }
          const matches = filterCandidateRecordings(fallback.recordings, candidate).sort(
            (left, right) => Number(right.isrcs.length > 0) - Number(left.isrcs.length > 0),
          );
          if (matches.length > 0) {
            musicBrainzResult = {
              status: "ok",
              recordings: mergeUniqueRecordings(matches, musicBrainzResult.recordings, limit),
            };
            fallbackUsed = true;
            break;
          }
        }
      }
    }

    const providers = {
      musicbrainz: musicBrainzResult.status,
      spotify: spotifyResult.status,
    } as const;

    if (providers.musicbrainz === "error" && providers.spotify !== "ok") {
      return errorResponse(
        "Music lookup is temporarily unavailable. Wait a moment and try again.",
        503,
      );
    }

    const recordings = prioritizeRecordings(
      mergeRecordings(
        musicBrainzResult.recordings,
        spotifyResult.recordings,
        Math.max(limit, musicBrainzFetchLimit),
      ),
    ).slice(0, limit);

    if (providers.musicbrainz === "error" && recordings.length === 0) {
      return errorResponse(
        "No reliable matches were found because the primary music provider is unavailable.",
        503,
      );
    }

    let notice: string | undefined;
    if (providers.musicbrainz === "error" && recordings.length > 0) {
      notice = "MusicBrainz is temporarily unavailable; showing Spotify matches only.";
    } else if (
      providers.spotify === "error" &&
      isSpotifyConfigured() &&
      recordings.length > 0
    ) {
      notice = "Spotify enrichment is unavailable; showing MusicBrainz matches.";
    }

    const response: SearchResponse = {
      recordings,
      providers,
      spotifyConfigured: isSpotifyConfigured(),
      fallbackUsed,
      query: musicBrainzQuery,
      notice,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  } finally {
    clearTimeout(deadlineTimer);
    request.signal.removeEventListener("abort", abortOnClientDisconnect);
    upstreamController.abort();
  }
}

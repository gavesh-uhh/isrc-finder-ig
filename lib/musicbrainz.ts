import { cacheKey, cached } from "./cache";
import {
  getRequestSignal,
  readJson,
  UpstreamError,
  waitForSignal,
} from "./http";
import { mergeUniqueRecordings } from "./search";
import { normalizeIsrcList } from "./query";
import type { ProviderStatus, RecordingResult, ReleaseSummary } from "./types";

const MUSICBRAINZ_ENDPOINT = "https://musicbrainz.org/ws/2/recording/";
const CACHE_TTL = 10 * 60 * 1_000;
const REQUEST_GAP_MS = 1_050;
const PROVIDER_TIMEOUT_MS = 6_000;
const MAX_RELEASES = 8;
const MAX_DETAIL_CANDIDATES = 2;
const MAX_QUEUED_REQUESTS = 20;

interface MusicBrainzArtistCredit {
  name?: string;
  artist?: { name?: string };
}

interface MusicBrainzRelease {
  title?: string;
  date?: string;
  country?: string;
}

interface MusicBrainzRecording {
  id?: string;
  title?: string;
  score?: number;
  length?: number;
  disambiguation?: string;
  "first-release-date"?: string;
  isrcs?: string[];
  "artist-credit"?: MusicBrainzArtistCredit[];
  releases?: MusicBrainzRelease[];
}

interface MusicBrainzSearchResponse {
  recordings?: MusicBrainzRecording[];
}

let lastRequestAt = 0;
let queuedRequests = 0;
let requestQueue: Promise<void> = Promise.resolve();

function scheduleMusicBrainzRequest<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (queuedRequests >= MAX_QUEUED_REQUESTS) {
    return Promise.reject(new Error("MusicBrainz request queue is full"));
  }

  queuedRequests += 1;
  const run = requestQueue
    .then(async () => {
      const wait = Math.max(0, REQUEST_GAP_MS - (Date.now() - lastRequestAt));
      if (wait > 0) {
        await waitForSignal(wait, signal);
      }
      if (signal.aborted) {
        throw signal.reason instanceof Error ? signal.reason : new Error("Request aborted");
      }
      lastRequestAt = Date.now();
      return task();
    })
    .finally(() => {
      queuedRequests -= 1;
    });

  requestQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function getUserAgent(): string {
  return process.env.MUSICBRAINZ_USER_AGENT?.trim() || "ISRC-Finder/1.0 (local development)";
}

function normalizeRelease(release: MusicBrainzRelease): ReleaseSummary | null {
  if (!release.title && !release.date && !release.country) {
    return null;
  }

  return {
    title: release.title?.trim() || "Unknown release",
    date: release.date?.trim() || undefined,
    country: release.country?.trim() || undefined,
  };
}

function normalizeRecording(recording: MusicBrainzRecording, index: number): RecordingResult | null {
  const title = recording.title?.trim();
  if (!title) {
    return null;
  }

  const artists = (recording["artist-credit"] ?? [])
    .map((credit) => credit.name?.trim() || credit.artist?.name?.trim() || "")
    .filter(Boolean);
  const normalizedReleases = (recording.releases ?? [])
    .map(normalizeRelease)
    .filter((release): release is ReleaseSummary => Boolean(release));
  const releases = normalizedReleases.slice(0, MAX_RELEASES);

  return {
    id: recording.id?.trim() || `musicbrainz-${index}-${title}`,
    title,
    artists: artists.length > 0 ? artists : ["Unknown artist"],
    isrcs: normalizeIsrcList(recording.isrcs),
    releases,
    releaseCount: normalizedReleases.length,
    firstReleaseDate: recording["first-release-date"]?.trim() || undefined,
    disambiguation: recording.disambiguation?.trim() || undefined,
    lengthMs: typeof recording.length === "number" ? recording.length : undefined,
    score: typeof recording.score === "number" ? Math.round(recording.score) : undefined,
    artworkUrl: undefined,
    source: "musicbrainz",
    sourceUrl: recording.id
      ? `https://musicbrainz.org/recording/${encodeURIComponent(recording.id)}`
      : undefined,
  };
}

async function requestMusicBrainz(
  query: string,
  limit: number,
  signal: AbortSignal,
): Promise<RecordingResult[]> {
  const url = new URL(MUSICBRAINZ_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("inc", "isrcs+artist-credits+releases");
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": getUserAgent(),
    },
    signal,
    cache: "no-store",
  });

  if (response.status === 503) {
    throw new UpstreamError(
      "MusicBrainz",
      "MusicBrainz is temporarily rate-limiting requests. Try again in a moment.",
      503,
    );
  }

  const data = await readJson<MusicBrainzSearchResponse>(response, "MusicBrainz");
  return (data.recordings ?? [])
    .map(normalizeRecording)
    .filter((recording): recording is RecordingResult => Boolean(recording));
}

const DETAIL_CACHE_TTL = 24 * 60 * 60 * 1_000;
const VERSION_PATTERN = /\b(live|remix|mix|cover|tribute|medley|instrumental|dj|edit|version|acoustic)\b/i;

async function requestMusicBrainzRecording(
  id: string,
  signal: AbortSignal,
): Promise<RecordingResult | null> {
  const url = new URL(`${MUSICBRAINZ_ENDPOINT}${encodeURIComponent(id)}`);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("inc", "isrcs+artist-credits+releases");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": getUserAgent(),
    },
    signal,
    cache: "no-store",
  });
  const data = await readJson<MusicBrainzRecording>(response, "MusicBrainz");
  return normalizeRecording(data, 0);
}

async function getMusicBrainzRecording(
  id: string,
  signal: AbortSignal,
): Promise<RecordingResult | null> {
  if (!id || id.startsWith("musicbrainz-")) {
    return null;
  }

  return cached(
    cacheKey("musicbrainz:recording", [id]),
    DETAIL_CACHE_TTL,
    () => scheduleMusicBrainzRequest(() => requestMusicBrainzRecording(id, signal), signal),
    { dedupe: false },
  );
}

function detailCandidateScore(recording: RecordingResult): { version: number; date: number; score: number } {
  const version = VERSION_PATTERN.test(recording.disambiguation ?? "") ? 1 : 0;
  const timestamp = recording.firstReleaseDate ? Date.parse(recording.firstReleaseDate) : Number.NaN;
  return {
    version,
    date: Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER,
    score: recording.score ?? 0,
  };
}

async function enrichWithCanonicalRecordings(
  recordings: RecordingResult[],
  signal: AbortSignal,
): Promise<RecordingResult[]> {
  if (recordings.length === 0 || recordings.every((recording) => recording.isrcs.length > 0)) {
    return recordings;
  }

  const candidates = recordings
    .map((recording, index) => ({ recording, index, rank: detailCandidateScore(recording) }))
    .sort((left, right) => {
      if (left.rank.version !== right.rank.version) {
        return left.rank.version - right.rank.version;
      }
      if (left.rank.date !== right.rank.date) {
        return left.rank.date - right.rank.date;
      }
      if (left.rank.score !== right.rank.score) {
        return right.rank.score - left.rank.score;
      }
      return left.index - right.index;
    })
    .slice(0, MAX_DETAIL_CANDIDATES)
    .map(({ recording }) => recording);

  const details: RecordingResult[] = [];
  for (const candidate of candidates) {
    if (signal.aborted) {
      break;
    }
    try {
      const detail = await getMusicBrainzRecording(candidate.id, signal);
      if (detail) {
        details.push(detail);
        if (detail.isrcs.length > 0) {
          break;
        }
      }
    } catch {
      // A missing/incorrect alternate recording should not fail the search.
    }
  }

  return details.length > 0
    ? mergeUniqueRecordings(details, recordings, recordings.length)
    : recordings;
}

export async function searchMusicBrainz(
  query: string,
  limit: number,
  parentSignal?: AbortSignal,
): Promise<{ status: ProviderStatus; recordings: RecordingResult[] }> {
  const signal = getRequestSignal(PROVIDER_TIMEOUT_MS, parentSignal);

  try {
    const recordings = await cached(
      cacheKey("musicbrainz", [query.toLowerCase(), limit]),
      CACHE_TTL,
      async () => {
        const recordings = await scheduleMusicBrainzRequest(
          () => requestMusicBrainz(query, limit, signal),
          signal,
        );
        return enrichWithCanonicalRecordings(recordings, signal);
      },
      { dedupe: !parentSignal },
    );
    return { status: "ok", recordings };
  } catch {
    return { status: "error", recordings: [] };
  }
}

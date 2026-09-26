import { cacheKey, cached } from "./cache";
import { getRequestSignal, readJson, UpstreamError } from "./http";
import {
  cleanQueryPart,
  normalizeIsrc,
  normalizeIsrcList,
  quoteSpotifyField,
  safeImageUrl,
} from "./query";
import type {
  ProviderStatus,
  RecordingResult,
  ReleaseSummary,
  TrackSuggestion,
} from "./types";

const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const SEARCH_ENDPOINT = "https://api.spotify.com/v1/search";
const PLAYLISTS_ENDPOINT = "https://api.spotify.com/v1/playlists";
const POPULAR_PLAYLIST_ID = "37i9dQZEVXbMDoHDwVN2tF";
const CACHE_TTL = 10 * 60 * 1_000;
const POPULAR_CACHE_TTL = 15 * 60 * 1_000;
const POPULAR_POOL_SIZE = 50;
const SPOTIFY_TIMEOUT_MS = 6_000;

interface SpotifyImage {
  url?: string;
  width?: number | null;
  height?: number | null;
}

interface SpotifyArtist {
  name?: string;
}

interface SpotifyAlbum {
  name?: string;
  release_date?: string;
  images?: SpotifyImage[];
}

interface SpotifyTrack {
  id?: string;
  name?: string;
  artists?: SpotifyArtist[];
  album?: SpotifyAlbum;
  external_ids?: { isrc?: string };
  external_urls?: { spotify?: string };
}

interface SpotifySearchResponse {
  tracks?: { items?: SpotifyTrack[] };
}

interface SpotifyPlaylistItemsResponse {
  items?: Array<{ track?: SpotifyTrack | null } | null>;
}

interface SpotifyBatchTracksResponse {
  tracks?: Array<SpotifyTrack | null>;
}

interface SpotifyEmbedTrack {
  uri?: string;
  title?: string;
  subtitle?: string;
}

interface SpotifyEmbedData {
  props?: {
    pageProps?: {
      state?: {
        data?: {
          entity?: {
            trackList?: SpotifyEmbedTrack[];
          };
        };
      };
    };
  };
}

interface SpotifyTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface SpotifyToken {
  value: string;
  expiresAt: number;
}

let tokenCache: SpotifyToken | null = null;
let tokenRequest: Promise<SpotifyToken> | null = null;

export function isSpotifyConfigured(): boolean {
  return Boolean(process.env.SPOTIFY_CLIENT_ID?.trim() && process.env.SPOTIFY_CLIENT_SECRET?.trim());
}

async function requestSpotifyToken(signal: AbortSignal): Promise<SpotifyToken> {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new UpstreamError("Spotify", "Spotify credentials are not configured", 503);
  }

  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache;
  }

  if (tokenRequest) {
    return tokenRequest;
  }

  tokenRequest = fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal,
    cache: "no-store",
  })
    .then(async (response) => {
      const data = await readJson<SpotifyTokenResponse>(response, "Spotify");
      if (!data.access_token) {
        throw new UpstreamError("Spotify", "Spotify did not return an access token", 502);
      }

      tokenCache = {
        value: data.access_token,
        expiresAt:
          Date.now() + Math.max(60, (data.expires_in ?? 3600) - 60) * 1_000,
      };
      return tokenCache;
    })
    .finally(() => {
      tokenRequest = null;
    });

  return tokenRequest;
}

function buildSpotifyQuery(query: string, artist: string, track: string): string {
  const directIsrc = normalizeIsrc(query) ?? normalizeIsrc(track) ?? normalizeIsrc(artist);
  if (directIsrc) {
    return `isrc:${directIsrc}`;
  }

  if (track || artist) {
    return [
      track ? `track:"${quoteSpotifyField(track)}"` : "",
      artist ? `artist:"${quoteSpotifyField(artist)}"` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return cleanQueryPart(query).slice(0, 200);
}

function pickSpotifyArtwork(images: SpotifyImage[] | undefined): string | undefined {
  const usable = (images ?? [])
    .filter((image) => Boolean(image.url))
    .sort((left, right) => (left.width ?? 0) - (right.width ?? 0));
  const image = usable.find((item) => (item.width ?? 0) >= 300) ?? usable.at(-1);
  return safeImageUrl(image?.url);
}

function normalizeTrack(track: SpotifyTrack, index: number): RecordingResult | null {
  const title = track.name?.trim();
  if (!title) {
    return null;
  }

  const artists = (track.artists ?? []).map((artist) => artist.name?.trim() || "").filter(Boolean);
  const album = track.album;
  const releases: ReleaseSummary[] = album?.name
    ? [
        {
          title: album.name,
          date: album.release_date || undefined,
        },
      ]
    : [];

  return {
    id: track.id?.trim() || `spotify-${index}-${title}`,
    title,
    artists: artists.length > 0 ? artists : ["Unknown artist"],
    isrcs: normalizeIsrcList([track.external_ids?.isrc]),
    releases,
    releaseCount: releases.length,
    artworkUrl: pickSpotifyArtwork(album?.images),
    source: "spotify",
    sourceUrl: track.external_urls?.spotify,
  };
}

async function requestSpotifySearch(
  query: string,
  artist: string,
  track: string,
  limit: number,
  signal: AbortSignal,
): Promise<RecordingResult[]> {
  const token = await requestSpotifyToken(signal);
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("q", buildSpotifyQuery(query, artist, track));
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", String(Math.min(limit, 10)));

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token.value}`,
    },
    signal,
    cache: "no-store",
  });

  if (response.status === 401) {
    tokenCache = null;
  }

  const data = await readJson<SpotifySearchResponse>(response, "Spotify");
  return (data.tracks?.items ?? [])
    .map(normalizeTrack)
    .filter((recording): recording is RecordingResult => Boolean(recording));
}

function toPopularSuggestions(tracks: SpotifyTrack[], limit: number): TrackSuggestion[] {
  const seen = new Set<string>();
  const suggestions: TrackSuggestion[] = [];

  for (const track of tracks) {
    const normalized = normalizeTrack(track, 0);
    if (!normalized || !normalized.artists[0]) {
      continue;
    }
    const key = track.id || `${normalized.title}::${normalized.artists[0]}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    suggestions.push({
      name: normalized.title,
      artist: normalized.artists[0],
      artworkUrl: normalized.artworkUrl,
    });
    if (suggestions.length >= limit) {
      break;
    }
  }

  return suggestions;
}

async function requestPlaylistTracks(
  playlistId: string,
  market: string,
  limit: number,
  token: string,
  signal: AbortSignal,
): Promise<SpotifyTrack[] | null> {
  const url = new URL(`${PLAYLISTS_ENDPOINT}/${encodeURIComponent(playlistId)}/tracks`);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("market", market);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    signal,
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (response.status === 401) {
    tokenCache = null;
  }

  const data = await readJson<SpotifyPlaylistItemsResponse>(response, "Spotify");
  return (data.items ?? [])
    .map((item) => item?.track)
    .filter((track): track is SpotifyTrack => Boolean(track));
}

async function requestEmbedPlaylistTracks(
  playlistId: string,
  signal: AbortSignal,
): Promise<SpotifyTrack[]> {
  const response = await fetch(
    `https://open.spotify.com/embed/playlist/${encodeURIComponent(playlistId)}`,
    {
      headers: { Accept: "text/html" },
      signal,
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new UpstreamError("Spotify", `Spotify embed returned HTTP ${response.status}`, 502);
  }

  const html = await response.text();
  const match = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) {
    throw new UpstreamError("Spotify", "Spotify embed data was not found", 502);
  }

  let data: SpotifyEmbedData;
  try {
    data = JSON.parse(match[1]) as SpotifyEmbedData;
  } catch {
    throw new UpstreamError("Spotify", "Spotify embed data was invalid", 502);
  }

  return (data.props?.pageProps?.state?.data?.entity?.trackList ?? [])
    .map((track): SpotifyTrack | null => {
      const id = track.uri?.split(":").pop();
      if (!id || !track.title) {
        return null;
      }
      return {
        id,
        name: track.title,
        artists: track.subtitle ? [{ name: track.subtitle }] : [],
      } satisfies SpotifyTrack;
    })
    .filter((track): track is SpotifyTrack => Boolean(track));
}

async function requestTracksById(
  tracks: SpotifyTrack[],
  market: string,
  token: string,
  signal: AbortSignal,
): Promise<SpotifyTrack[]> {
  const ids = tracks.map((track) => track.id).filter((id): id is string => Boolean(id));
  if (ids.length === 0) {
    return [];
  }

  const url = new URL("https://api.spotify.com/v1/tracks");
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("market", market);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    signal,
    cache: "no-store",
  });
  if (response.status === 401) {
    tokenCache = null;
  }

  const data = await readJson<SpotifyBatchTracksResponse>(response, "Spotify");
  return (data.tracks ?? []).filter((track): track is SpotifyTrack => Boolean(track));
}

/**
 * Fisher-Yates shuffle that returns the first `count` items. The caller
 * deliberately samples from a cached pool so every request surfaces a
 * different mix of the playlist instead of the same leading tracks.
 */
function sampleRandom<T>(items: readonly T[], count: number): T[] {
  const pool = items.slice();
  const take = Math.min(pool.length, Math.max(0, count));

  for (let index = 0; index < take; index += 1) {
    const swapWith = index + Math.floor(Math.random() * (pool.length - index));
    const current = pool[index];
    pool[index] = pool[swapWith];
    pool[swapWith] = current;
  }

  return pool.slice(0, take);
}

export async function getSpotifyPopularTracks(
  limit = 6,
  parentSignal?: AbortSignal,
): Promise<{ configured: boolean; tracks: TrackSuggestion[] }> {
  if (!isSpotifyConfigured()) {
    return { configured: false, tracks: [] };
  }

  const market = process.env.SPOTIFY_MARKET?.trim() || "US";
  const signal = getRequestSignal(SPOTIFY_TIMEOUT_MS, parentSignal);
  const boundedLimit = Math.min(20, Math.max(1, limit));
  const poolSize = Math.max(boundedLimit, POPULAR_POOL_SIZE);

  const pool = await cached(
    cacheKey("spotify:popular-pool", [POPULAR_PLAYLIST_ID, market, poolSize]),
    POPULAR_CACHE_TTL,
    async () => {
      const token = await requestSpotifyToken(signal);
      let playlistTracks: SpotifyTrack[] | null = null;
      try {
        playlistTracks = await requestPlaylistTracks(
          POPULAR_PLAYLIST_ID,
          market,
          poolSize,
          token.value,
          signal,
        );
      } catch (error) {
        if (!(error instanceof UpstreamError) || error.status !== 404) {
          throw error;
        }
      }

      if (playlistTracks && playlistTracks.length > 0) {
        return toPopularSuggestions(playlistTracks, poolSize);
      }

      const embedTracks = await requestEmbedPlaylistTracks(POPULAR_PLAYLIST_ID, signal);
      const hydratedTracks = await requestTracksById(embedTracks, market, token.value, signal);
      return toPopularSuggestions(
        hydratedTracks.length > 0 ? hydratedTracks : embedTracks,
        poolSize,
      );
    },
    { dedupe: !parentSignal },
  );

  return { configured: true, tracks: sampleRandom(pool, boundedLimit) };
}

export async function getSpotifyArtwork(
  track: string,
  artist: string,
  parentSignal?: AbortSignal,
): Promise<string | null> {
  if (!isSpotifyConfigured()) {
    return null;
  }

  const signal = getRequestSignal(SPOTIFY_TIMEOUT_MS, parentSignal);
  try {
    return await cached(
      cacheKey("spotify:artwork", [track.toLowerCase(), artist.toLowerCase()]),
      CACHE_TTL,
      async () => {
        const results = await requestSpotifySearch("", artist, track, 1, signal);
        return results[0]?.artworkUrl ?? null;
      },
      { dedupe: !parentSignal },
    );
  } catch {
    return null;
  }
}

export async function getSpotifySuggestions(
  term: string,
  parentSignal?: AbortSignal,
): Promise<TrackSuggestion[]> {
  const result = await searchSpotify(term, "", "", 8, parentSignal);
  if (result.status === "error") {
    throw new Error("Spotify suggestions are temporarily unavailable");
  }

  const seen = new Set<string>();
  return result.recordings
    .filter((recording) => {
      const artist = recording.artists[0];
      if (!artist) {
        return false;
      }
      const key = cacheKey("spotify:suggestion", [recording.title, artist]);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((recording) => ({
      name: recording.title,
      artist: recording.artists[0],
      artworkUrl: recording.artworkUrl,
    }));
}

export async function searchSpotify(
  query: string,
  artist: string,
  track: string,
  limit: number,
  parentSignal?: AbortSignal,
): Promise<{ status: ProviderStatus; recordings: RecordingResult[] }> {
  if (!isSpotifyConfigured()) {
    return { status: "skipped", recordings: [] };
  }

  const signal = getRequestSignal(SPOTIFY_TIMEOUT_MS, parentSignal);
  try {
    const recordings = await cached(
      cacheKey("spotify", [query.toLowerCase(), artist.toLowerCase(), track.toLowerCase(), limit]),
      CACHE_TTL,
      () => requestSpotifySearch(query, artist, track, limit, signal),
      { dedupe: !parentSignal },
    );
    return { status: "ok", recordings };
  } catch {
    return { status: "error", recordings: [] };
  }
}

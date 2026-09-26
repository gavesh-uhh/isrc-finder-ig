export type ProviderName = "musicbrainz" | "spotify";
export type ProviderStatus = "ok" | "error" | "skipped";

export interface ReleaseSummary {
  title: string;
  date?: string;
  country?: string;
}

export interface RecordingResult {
  id: string;
  title: string;
  artists: string[];
  isrcs: string[];
  releases: ReleaseSummary[];
  releaseCount?: number;
  firstReleaseDate?: string;
  disambiguation?: string;
  lengthMs?: number;
  score?: number;
  artworkUrl?: string;
  source: ProviderName | "both";
  sourceUrl?: string;
}

export interface TrackSuggestion {
  name: string;
  artist: string;
  listeners?: number;
  artworkUrl?: string;
}

export interface SavedTrack extends TrackSuggestion {
  id: string;
  isrcs: string[];
}

export interface SearchResponse {
  recordings: RecordingResult[];
  providers: Record<ProviderName, ProviderStatus>;
  spotifyConfigured: boolean;
  fallbackUsed?: boolean;
  query: string;
  notice?: string;
}

export interface SuggestionResponse {
  suggestions: TrackSuggestion[];
  configured: boolean;
}

export interface ArtworkResponse {
  artworkUrl: string | null;
  configured: boolean;
}

export interface ApiErrorResponse {
  error: string;
}

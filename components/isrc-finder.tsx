"use client";

/* eslint-disable @next/next/no-img-element */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import type {
  ApiErrorResponse,
  ArtworkResponse,
  RecordingResult,
  SearchResponse,
  SavedTrack,
  SuggestionResponse,
  TrackSuggestion,
} from "@/lib/types";

interface SearchParts {
  query: string;
  artist: string;
  track: string;
}

interface PopularResponse {
  tracks: TrackSuggestion[];
  configured: boolean;
}

type Theme = "dark" | "light";

const MAX_RESULTS = 15;
const MAX_ARTWORK_RESULTS = 8;
const MAX_ARTWORK_CACHE_ENTRIES = 100;
const SAVED_TRACKS_STORAGE_KEY = "isrc-finder-saved-tracks";
const SAVED_TRACK_PREVIEW_COUNT = 5;
const MAX_SAVED_TRACKS = 100;

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === "dark") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function CopyIcon({ copied = false }: { copied?: boolean }) {
  if (copied) {
    return (
      <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  }

  return (
    <svg className="copy-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CoffeeIcon() {
  return (
    <svg className="pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" />
      <path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17" />
      <path d="M8 2.5v2.5M12 2.5v2.5" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg className="pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.6" y="2.6" width="18.8" height="18.8" rx="5.2" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="clear-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function StarIcon({ saved = false }: { saved?: boolean }) {
  return (
    <svg
      className="save-icon"
      viewBox="0 0 24 24"
      fill={saved ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.86 14.23 9.79l6.33.29-4.95 3.95L17.29 20.14 12 16.66l-5.29 3.48 1.68-6.11L3.44 10.08l6.33-.29Z" />
    </svg>
  );
}

function PlaceholderArt() {
  return (
    <div className="suggest-art placeholder">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    </div>
  );
}

function formatDate(date: string | undefined): string {
  if (!date) {
    return "";
  }
  return date.length >= 4 ? date.slice(0, 4) : date;
}

function artworkKey(name: string, artist: string): string {
  return JSON.stringify([name.trim().toLowerCase(), artist.trim().toLowerCase()]);
}

function savedTrackKey(name: string, artist: string): string {
  return artworkKey(name, artist);
}

function parseSavedTracks(raw: string | null): SavedTrack[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .slice(0, MAX_SAVED_TRACKS)
      .map((item): SavedTrack | null => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const record = item as Record<string, unknown>;
        if (
          typeof record.id !== "string" ||
          typeof record.name !== "string" ||
          typeof record.artist !== "string"
        ) {
          return null;
        }

        return {
          id: record.id,
          name: record.name,
          artist: record.artist,
          artworkUrl: typeof record.artworkUrl === "string" ? record.artworkUrl : undefined,
          isrcs: Array.isArray(record.isrcs)
            ? record.isrcs.filter((isrc): isrc is string => typeof isrc === "string")
            : [],
        };
      })
      .filter((track): track is SavedTrack => Boolean(track));
  } catch {
    return [];
  }
}

function TrackListItem({
  track,
  index,
  saved,
  onSelect,
  onToggleSave,
}: {
  track: TrackSuggestion;
  index: number;
  saved: boolean;
  onSelect: () => void;
  onToggleSave: () => void;
}) {
  return (
    <div className="popular-item" style={{ animationDelay: `${index * 45}ms` }}>
      <button
        className="popular-item-main"
        type="button"
        aria-label={`Search ${track.name} by ${track.artist}`}
        onClick={onSelect}
      >
        <span className="popular-cover">
          {track.artworkUrl ? (
            <img src={track.artworkUrl} alt="" loading="lazy" />
          ) : (
            <span className="popular-cover-placeholder" aria-hidden="true" />
          )}
        </span>
        <span className="popular-copy">
          <span className="popular-title">{track.name}</span>
          <span className="popular-artist">{track.artist}</span>
        </span>
      </button>
      <button
        className={`save-toggle popular-save${saved ? " saved" : ""}`}
        type="button"
        aria-label={saved ? `Remove ${track.name} from saved tracks` : `Save ${track.name}`}
        aria-pressed={saved}
        title={saved ? "Remove from saved" : "Save track"}
        onClick={onToggleSave}
      >
        <StarIcon saved={saved} />
      </button>
    </div>
  );
}

function ResultCard({
  recording,
  index,
  artworkUrl,
  copiedIsrc,
  onCopy,
  saved,
  onToggleSave,
}: {
  recording: RecordingResult;
  index: number;
  artworkUrl?: string;
  copiedIsrc: string | null;
  onCopy: (value: string) => void;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const artist = recording.artists.join(", ") || "Unknown artist";
  const firstRelease = recording.releases[0];
  const releaseParts: string[] = [];

  if (firstRelease) {
    if (firstRelease.title && firstRelease.title !== recording.title) {
      releaseParts.push(firstRelease.title);
    }
    const date = formatDate(firstRelease.date);
    if (date) {
      releaseParts.push(date);
    }
    if (firstRelease.country) {
      releaseParts.push(firstRelease.country);
    }
  }

  let releaseInfo = releaseParts.join(" · ");
  const totalReleases = recording.releaseCount ?? recording.releases.length;
  if (totalReleases > 1) {
    const extra = totalReleases - 1;
    const releaseCount = `+${extra} more release${extra === 1 ? "" : "s"}`;
    releaseInfo = releaseInfo ? `${releaseInfo} · ${releaseCount}` : releaseCount;
  }

  const matchLabel = typeof recording.score === "number" ? `match ${recording.score}%` : "";
  const artId = `card-art-${index}`;

  return (
    <article className="card">
      <div className="card-top">
        <div className="card-left">
          {artworkUrl ? (
            <img className="card-art" src={artworkUrl} alt="" loading="lazy" />
          ) : (
            <div className="card-art" id={artId} />
          )}
          <div>
            <div className="card-title">{recording.title}</div>
            <div className="card-sub">{artist}</div>
            {releaseInfo ? (
              <div className="card-meta">
                {releaseInfo}
                {matchLabel ? ` · ${matchLabel}` : ""}
              </div>
            ) : matchLabel ? (
              <div className="card-meta">{matchLabel}</div>
            ) : null}
          </div>
        </div>
        <button
          className={`save-toggle card-save${saved ? " saved" : ""}`}
          type="button"
          aria-label={saved ? `Remove ${recording.title} from saved tracks` : `Save ${recording.title}`}
          aria-pressed={saved}
          title={saved ? "Remove from saved" : "Save track"}
          onClick={onToggleSave}
        >
          <StarIcon saved={saved} />
        </button>
      </div>
      {recording.isrcs.length > 0 ? (
        <div className="isrc-row" aria-label={`ISRCs for ${recording.title}`}>
          {recording.isrcs.map((isrc) => {
            const copied = copiedIsrc === isrc;
            return (
              <button
                className={`isrc-chip${copied ? " copied" : ""}`}
                data-isrc={isrc}
                key={isrc}
                type="button"
                title={copied ? `Copied ${isrc}` : "Copy ISRC"}
                aria-label={copied ? `Copied ISRC ${isrc}` : `Copy ISRC ${isrc}`}
                onClick={() => onCopy(isrc)}
              >
                <CopyIcon copied={copied} />
                {copied ? isrc : "Copy ISRC"}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="no-isrc">No ISRC registered for this recording</div>
      )}
    </article>
  );
}

export default function IsrcFinder() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mainQuery, setMainQuery] = useState("");
  const [artist, setArtist] = useState("");
  const [track, setTrack] = useState("");
  const [suggestions, setSuggestions] = useState<TrackSuggestion[]>([]);
  const [popularTracks, setPopularTracks] = useState<TrackSuggestion[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [popularConfigured, setPopularConfigured] = useState(false);
  const [savedTracks, setSavedTracks] = useState<SavedTrack[]>([]);
  const [savedExpanded, setSavedExpanded] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [hiddenExpanded, setHiddenExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<RecordingResult[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [spotifyConfigured, setSpotifyConfigured] = useState(false);
  const [copiedIsrc, setCopiedIsrc] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [artworkUrls, setArtworkUrls] = useState<Record<string, string>>({});

  const mainFieldRef = useRef<HTMLDivElement>(null);
  const mainQueryRef = useRef<HTMLInputElement>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const popularAbortRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef(0);
  const suggestionAbortRef = useRef<AbortController | null>(null);
  const suggestionRequestIdRef = useRef(0);
  const suggestionTimerRef = useRef<number | null>(null);
  const artworkAbortRef = useRef(new AbortController());
  const artworkCacheRef = useRef(new Map<string, string>());
  const artworkRequestsRef = useRef(new Map<string, Promise<string | null>>());
  const mountedRef = useRef(true);
  const toastTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const savedTracksRef = useRef<SavedTrack[]>([]);
  const skipNextSuggestionRef = useRef(false);

  useEffect(() => {
    let nextTheme: Theme;
    try {
      const saved = window.localStorage.getItem("isrc-finder-theme");
      if (saved === "dark" || saved === "light") {
        nextTheme = saved;
      } else {
        nextTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
    } catch {
      nextTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }

    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  useEffect(() => {
    try {
      const stored = parseSavedTracks(window.localStorage.getItem(SAVED_TRACKS_STORAGE_KEY));
      savedTracksRef.current = stored;
      setSavedTracks(stored);
    } catch {
      // Saved tracks are optional when storage is unavailable.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    try {
      window.localStorage.setItem("isrc-finder-theme", nextTheme);
    } catch {
      // Storage can be disabled in private browsing; the in-memory theme still works.
    }
  }, [theme]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast("");
    }, 1_400);
  }, []);

  const toggleSavedTrack = useCallback(
    (track: SavedTrack) => {
      const current = savedTracksRef.current;
      const existing = current.some((item) => item.id === track.id);
      const next = existing
        ? current.filter((item) => item.id !== track.id)
        : [track, ...current].slice(0, MAX_SAVED_TRACKS);

      savedTracksRef.current = next;
      setSavedTracks(next);
      try {
        window.localStorage.setItem(SAVED_TRACKS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // The in-memory list still works when storage is unavailable.
      }
      showToast(existing ? `Removed ${track.name}` : `Saved ${track.name}`);
    },
    [showToast],
  );

  const toggleRecordingSaved = useCallback(
    (recording: RecordingResult) => {
      const artist = recording.artists[0] || "Unknown artist";
      toggleSavedTrack({
        id: savedTrackKey(recording.title, artist),
        name: recording.title,
        artist,
        artworkUrl: recording.artworkUrl,
        isrcs: recording.isrcs,
      });
    },
    [toggleSavedTrack],
  );

  useEffect(() => {
    if (savedTracks.length <= SAVED_TRACK_PREVIEW_COUNT) {
      setSavedExpanded(false);
    }
  }, [savedTracks.length]);

  const toggleSuggestionSaved = useCallback(
    (track: TrackSuggestion) => {
      toggleSavedTrack({
        id: savedTrackKey(track.name, track.artist),
        name: track.name,
        artist: track.artist,
        artworkUrl: track.artworkUrl,
        isrcs: [],
      });
    },
    [toggleSavedTrack],
  );

  useEffect(() => {
    mountedRef.current = true;
    const artworkAbortController = artworkAbortRef.current;
    return () => {
      mountedRef.current = false;
      searchRequestIdRef.current += 1;
      suggestionRequestIdRef.current += 1;
      searchAbortRef.current?.abort();
      popularAbortRef.current?.abort();
      suggestionAbortRef.current?.abort();
      artworkAbortController.abort();
      if (suggestionTimerRef.current !== null) {
        window.clearTimeout(suggestionTimerRef.current);
      }
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    popularAbortRef.current = controller;

    void fetch("/api/popular", {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Popular tracks unavailable");
        }
        return (await response.json()) as PopularResponse;
      })
      .then((data) => {
        if (!mountedRef.current || controller.signal.aborted) {
          return;
        }
        setPopularConfigured(data.configured);
        setPopularTracks(data.tracks);
      })
      .catch(() => {
        if (mountedRef.current && !controller.signal.aborted) {
          setPopularConfigured(false);
          setPopularTracks([]);
        }
      })
      .finally(() => {
        if (mountedRef.current && !controller.signal.aborted) {
          setPopularLoading(false);
        }
      });

    return () => {
      controller.abort();
      if (popularAbortRef.current === controller) {
        popularAbortRef.current = null;
      }
    };
  }, []);

  const fetchArtwork = useCallback(async (name: string, artistName: string): Promise<string | null> => {
    const key = artworkKey(name, artistName);
    const cachedUrl = artworkCacheRef.current.get(key);
    if (cachedUrl) {
      return cachedUrl;
    }

    const existingRequest = artworkRequestsRef.current.get(key);
    if (existingRequest) {
      return existingRequest;
    }

    const request = fetch(
      `/api/artwork?track=${encodeURIComponent(name)}&artist=${encodeURIComponent(artistName)}`,
      {
        headers: { Accept: "application/json" },
        signal: artworkAbortRef.current.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Artwork lookup failed");
        }
        return (await response.json()) as ArtworkResponse;
      })
      .then((data) => {
        if (!data.artworkUrl) {
          return null;
        }

        artworkCacheRef.current.set(key, data.artworkUrl);
        while (artworkCacheRef.current.size > MAX_ARTWORK_CACHE_ENTRIES) {
          const oldestKey = artworkCacheRef.current.keys().next().value;
          if (!oldestKey) {
            break;
          }
          artworkCacheRef.current.delete(oldestKey);
        }
        if (mountedRef.current) {
          setArtworkUrls((current) => (current[key] ? current : { ...current, [key]: data.artworkUrl! }));
        }
        return data.artworkUrl;
      })
      .catch(() => null)
      .finally(() => {
        artworkRequestsRef.current.delete(key);
      });

    artworkRequestsRef.current.set(key, request);
    return request;
  }, []);

  useEffect(() => {
    if (!spotifyConfigured || results.length === 0) {
      return;
    }

    for (const result of results.slice(0, MAX_ARTWORK_RESULTS)) {
      if (!result.artworkUrl && result.artists[0]) {
        void fetchArtwork(result.title, result.artists[0]).then((url) => {
          if (!url || !mountedRef.current) {
            return;
          }
          setResults((current) =>
            current.map((item) =>
              item.id === result.id && !item.artworkUrl ? { ...item, artworkUrl: url } : item,
            ),
          );
        });
      }
    }
  }, [fetchArtwork, spotifyConfigured, results]);

  useEffect(() => {
    const term = mainQuery.trim();

    if (skipNextSuggestionRef.current) {
      skipNextSuggestionRef.current = false;
      return;
    }

    const requestId = suggestionRequestIdRef.current + 1;
    suggestionRequestIdRef.current = requestId;
    if (suggestionTimerRef.current !== null) {
      window.clearTimeout(suggestionTimerRef.current);
      suggestionTimerRef.current = null;
    }
    suggestionAbortRef.current?.abort();
    suggestionAbortRef.current = null;

    if (term.length < 2) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setSuggestionsLoading(false);
      setSuggestionMessage("");
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    suggestionAbortRef.current = controller;
    const timer = window.setTimeout(async () => {
      if (requestId !== suggestionRequestIdRef.current) {
        return;
      }
      setSuggestionsLoading(true);
      try {
        const response = await fetch(
          `/api/suggestions?track=${encodeURIComponent(term)}`,
          {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          },
        );
        const data = (await response.json()) as SuggestionResponse | ApiErrorResponse;
        if (
          controller.signal.aborted ||
          requestId !== suggestionRequestIdRef.current
        ) {
          return;
        }
        if (!response.ok || "error" in data) {
          setSuggestions([]);
          setSuggestionsOpen(true);
          setSuggestionMessage("Live suggestions unavailable — press Search to look up directly");
          setActiveIndex(-1);
          return;
        }

        setSpotifyConfigured(data.configured);
        setSuggestions(data.suggestions);
        setSuggestionMessage("");
        setSuggestionsOpen(data.configured);
        setHiddenExpanded(false);
        setActiveIndex(-1);
      } catch {
        if (
          !controller.signal.aborted &&
          requestId === suggestionRequestIdRef.current
        ) {
          setSuggestions([]);
          setSuggestionsOpen(true);
          setSuggestionMessage("Live suggestions unavailable — press Search to look up directly");
          setActiveIndex(-1);
        }
      } finally {
        if (
          !controller.signal.aborted &&
          requestId === suggestionRequestIdRef.current
        ) {
          setSuggestionsLoading(false);
        }
      }
    }, 280);
    suggestionTimerRef.current = timer;

    return () => {
      if (suggestionTimerRef.current === timer) {
        window.clearTimeout(timer);
        suggestionTimerRef.current = null;
      }
      controller.abort();
    };
  }, [mainQuery]);

  useEffect(() => {
    if (!suggestionsOpen || suggestions.length === 0) {
      return;
    }

    const visibleSuggestions = hiddenExpanded ? suggestions : suggestions.slice(0, 1);
    for (const suggestion of visibleSuggestions) {
      if (!suggestion.artworkUrl) {
        void fetchArtwork(suggestion.name, suggestion.artist);
      }
    }
  }, [fetchArtwork, hiddenExpanded, suggestions, suggestionsOpen]);

  useEffect(() => {
    if (activeIndex < 0) {
      return;
    }
    document.getElementById(`suggestion-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    if (!hiddenExpanded && activeIndex > 0) {
      setActiveIndex(0);
    }
  }, [activeIndex, hiddenExpanded]);

  const closeSuggestions = useCallback(() => {
    suggestionRequestIdRef.current += 1;
    suggestionAbortRef.current?.abort();
    suggestionAbortRef.current = null;
    if (suggestionTimerRef.current !== null) {
      window.clearTimeout(suggestionTimerRef.current);
      suggestionTimerRef.current = null;
    }
    setSuggestionsOpen(false);
    setSuggestionsLoading(false);
    setActiveIndex(-1);
  }, []);

  const handleClearAll = useCallback(() => {
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    searchRequestIdRef.current += 1;
    closeSuggestions();

    setMainQuery("");
    setArtist("");
    setTrack("");
    setResults([]);
    setHasSearched(false);
    setIsSearching(false);
    setError("");
    setNotice("");
    setCopiedIsrc(null);
    setHiddenExpanded(false);

    mainQueryRef.current?.focus();
  }, [closeSuggestions]);

  const performSearch = useCallback(
    async (parts: SearchParts, presetArtwork?: string) => {
      searchAbortRef.current?.abort();
      const requestId = searchRequestIdRef.current + 1;
      searchRequestIdRef.current = requestId;
      const controller = new AbortController();
      searchAbortRef.current = controller;
      setIsSearching(true);
      setHasSearched(true);
      setError("");
      setNotice("");
      setCopiedIsrc(null);

      const params = new URLSearchParams();
      if (parts.query) {
        params.set("query", parts.query);
      }
      if (parts.artist) {
        params.set("artist", parts.artist);
      }
      if (parts.track) {
        params.set("track", parts.track);
      }
      params.set("limit", String(MAX_RESULTS));

      try {
        const response = await fetch(`/api/search?${params.toString()}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const data = (await response.json()) as SearchResponse | ApiErrorResponse;
        if (controller.signal.aborted || requestId !== searchRequestIdRef.current) {
          return;
        }

        if (!response.ok || "error" in data) {
          throw new Error("error" in data ? data.error : "Search failed");
        }

        const nextResults = data.recordings.map((recording, index) =>
          index === 0 && presetArtwork && !recording.artworkUrl
            ? { ...recording, artworkUrl: presetArtwork }
            : recording,
        );
        setResults(nextResults);
        setNotice(data.notice ?? "");
        setSpotifyConfigured(data.spotifyConfigured);
      } catch (searchError) {
        if (controller.signal.aborted || requestId !== searchRequestIdRef.current) {
          return;
        }
        setResults([]);
        setError(
          searchError instanceof Error
            ? searchError.message
            : "Search failed. Wait a moment and try again.",
        );
      } finally {
        if (!controller.signal.aborted && requestId === searchRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    },
    [],
  );

  const searchPopularTrack = useCallback(
    (popularTrack: TrackSuggestion) => {
      const nextQuery = `${popularTrack.name} ${popularTrack.artist}`;
      if (nextQuery !== mainQuery) {
        skipNextSuggestionRef.current = true;
        setMainQuery(nextQuery);
      }
      setArtist(popularTrack.artist);
      setTrack(popularTrack.name);
      closeSuggestions();
      void performSearch({
        query: "",
        artist: popularTrack.artist,
        track: popularTrack.name,
      });
    },
    [closeSuggestions, mainQuery, performSearch],
  );

  const isTrackSaved = useCallback(
    (name: string, artist: string) =>
      savedTracks.some((item) => item.id === savedTrackKey(name, artist)),
    [savedTracks],
  );

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      closeSuggestions();
      const parts: SearchParts = {
        query: mainQuery.trim(),
        artist: artist.trim(),
        track: track.trim(),
      };

      if (!parts.query && !parts.artist && !parts.track) {
        setError("Enter a search term above.");
        return;
      }

      void performSearch(parts);
    },
    [artist, closeSuggestions, mainQuery, performSearch, track],
  );

  const copyIsrc = useCallback(
    async (value: string) => {
      const clipboardValue = `isrc:${value}`;
      let copied = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(clipboardValue);
          copied = true;
        } else {
          const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
          const textarea = document.createElement("textarea");
          textarea.value = clipboardValue;
          textarea.style.position = "fixed";
          textarea.style.opacity = "0";
          document.body.appendChild(textarea);
          try {
            textarea.select();
            copied = document.execCommand("copy");
          } finally {
            textarea.remove();
            previouslyFocused?.focus();
          }
        }
      } catch {
        copied = false;
      }

      if (!copied) {
        showToast("Copy failed");
        return;
      }

      setCopiedIsrc(value);
      showToast(`Copied ${value}`);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedIsrc(null);
      }, 1_200);
    },
    [showToast],
  );

  const selectSuggestion = useCallback(
    (index: number) => {
      const suggestion = suggestions[index];
      if (!suggestion) {
        return;
      }

      const nextQuery = `${suggestion.name} ${suggestion.artist}`;
      if (nextQuery !== mainQuery) {
        skipNextSuggestionRef.current = true;
        setMainQuery(nextQuery);
      }
      setArtist(suggestion.artist);
      setTrack(suggestion.name);
      closeSuggestions();
      const key = artworkKey(suggestion.name, suggestion.artist);
      void performSearch(
        {
          query: "",
          artist: suggestion.artist,
          track: suggestion.name,
        },
        artworkUrls[key] ?? suggestion.artworkUrl,
      );
    },
    [artworkUrls, closeSuggestions, mainQuery, performSearch, suggestions],
  );

  const handleMainKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!suggestionsOpen || suggestions.length === 0) {
        if (event.key === "Escape") {
          closeSuggestions();
        }
        return;
      }

      const lastVisibleIndex = hiddenExpanded ? suggestions.length - 1 : 0;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => Math.min(current + 1, lastVisibleIndex));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
      } else if (
        event.key === "Enter" &&
        activeIndex >= 0 &&
        activeIndex <= lastVisibleIndex
      ) {
        event.preventDefault();
        selectSuggestion(activeIndex);
      } else if (event.key === "Escape") {
        closeSuggestions();
      }
    },
    [activeIndex, closeSuggestions, hiddenExpanded, selectSuggestion, suggestions, suggestionsOpen],
  );

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (mainFieldRef.current && !mainFieldRef.current.contains(event.target as Node)) {
        closeSuggestions();
      }
    };

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => document.removeEventListener("mousedown", onDocumentMouseDown);
  }, [closeSuggestions]);

  const renderSuggestion = (suggestion: TrackSuggestion, index: number) => {
    const key = artworkKey(suggestion.name, suggestion.artist);
    const artworkUrl = artworkUrls[key] ?? suggestion.artworkUrl;
    const isActive = activeIndex === index;

    return (
      <button
        className={`suggest-item${index === 0 ? " top-match" : ""}${isActive ? " active" : ""}`}
        data-index={index}
        id={`suggestion-${index}`}
        key={`${key}-${index}`}
        type="button"
        role="option"
        aria-selected={isActive}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => selectSuggestion(index)}
      >
        <span className="suggest-left">
          {artworkUrl ? (
            <img className="suggest-art" src={artworkUrl} alt="" loading="lazy" />
          ) : (
            <PlaceholderArt />
          )}
          <span className="suggest-text">
            <span className="suggest-title">{suggestion.name}</span>
            <span className="suggest-artist">{suggestion.artist}</span>
          </span>
        </span>
        <span className="suggest-hint">Enter</span>
      </button>
    );
  };

  const renderOutput = () => {
    if (isSearching) {
      return (
        <div className="status" role="status">
          <span className="spinner" />&nbsp;&nbsp;Searching recordings…
        </div>
      );
    }

    if (error) {
      return (
        <div className="status error" role="alert">
          {error}
          <br />
          <span className="status-hint">Wait a moment and try again.</span>
        </div>
      );
    }

    if (results.length === 0) {
      if (notice) {
        return <div className="status">{notice}</div>;
      }
      return hasSearched ? <div className="status">No recordings found. Try different terms.</div> : null;
    }

    return (
      <>
        <div className="results">
          {results.map((result, index) => (
            <ResultCard
              key={`${result.id}-${index}`}
              recording={result}
              index={index}
              artworkUrl={result.artworkUrl}
              copiedIsrc={copiedIsrc}
              onCopy={(value) => void copyIsrc(value)}
              saved={isTrackSaved(result.title, result.artists[0] || "Unknown artist")}
              onToggleSave={() => toggleRecordingSaved(result)}
            />
          ))}
        </div>
        {notice ? <div className="status status-notice">{notice}</div> : null}
      </>
    );
  };

  const showPopularTracks =
    !isSearching &&
    !mainQuery.trim() &&
    !artist.trim() &&
    !track.trim() &&
    results.length === 0 &&
    (popularLoading || (popularConfigured && popularTracks.length > 0));

  const canClear =
    results.length > 0 || hasSearched || Boolean(mainQuery || artist || track || error);
  const hasTrailingControl = canClear || suggestionsLoading;

  return (
    <>
      <div className="wrap">
        <header>
          <div className="brand">
            <InstagramIcon />
            <span className="sr-only">Instagram </span>ISRC Finder
          </div>
          <button
            className="theme-toggle"
            type="button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            onClick={toggleTheme}
          >
            <ThemeIcon theme={theme} />
          </button>
        </header>

        <div className="links">
          <a
            className="pill-link"
            href="https://buymeacoffee.com/gaveshsaparamadu"
            target="_blank"
            rel="noopener noreferrer"
          >
            <CoffeeIcon />
            <span>Buy me a coffee</span>
          </a>
          <a
            className="pill-link"
            href="https://www.gavesh.lol"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GlobeIcon />
            <span>gavesh.lol</span>
          </a>
        </div>

        <form id="searchForm" autoComplete="off" onSubmit={handleSubmit}>
          <div className="field main-field" ref={mainFieldRef} data-trailing={hasTrailingControl ? "true" : undefined}>
            <input
              type="text"
              id="mainQuery"
              placeholder="Start typing a track or artist…"
              aria-label="Track or artist search"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="search"
              enterKeyHint="search"
              ref={mainQueryRef}
              value={mainQuery}
              role="combobox"
              aria-haspopup="listbox"
              aria-autocomplete="list"
              aria-controls="suggest-primary-options suggest-hidden-options"
              aria-expanded={suggestionsOpen}
              aria-activedescendant={activeIndex >= 0 ? `suggestion-${activeIndex}` : undefined}
              onChange={(event) => setMainQuery(event.target.value)}
              onKeyDown={handleMainKeyDown}
            />
            <div className="field-trailing">
              {suggestionsLoading ? <span className="spinner suggest-spinner" aria-hidden="true" /> : null}
              {canClear ? (
                <button
                  className="clear-btn"
                  type="button"
                  aria-label="Clear search and results"
                  title="Clear search and results"
                  onClick={handleClearAll}
                >
                  <CloseIcon />
                </button>
              ) : null}
            </div>
            <div
              className={`suggest-panel${suggestionsOpen ? " open" : ""}`}
              id="suggestPanel"
              aria-hidden={!suggestionsOpen}
            >
              {suggestions.length === 0 ? (
                <div className="suggest-status" role="status">
                  {suggestionsLoading
                    ? "Searching suggestions…"
                    : suggestionMessage || "No matches — press Search to look up directly"}
                </div>
              ) : (
                <>
                  <div
                    className="suggest-primary-options"
                    id="suggest-primary-options"
                    role="listbox"
                    aria-label="Top track suggestion"
                  >
                    {renderSuggestion(suggestions[0], 0)}
                  </div>
                  {suggestions.length > 1 ? (
                    <>
                      <button
                        className={`suggest-toggle${hiddenExpanded ? " expanded" : ""}`}
                        type="button"
                        onClick={() => setHiddenExpanded((current) => !current)}
                      >
                        <span>{hiddenExpanded ? `Hide (${suggestions.length - 1})` : `View hidden (${suggestions.length - 1})`}</span>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </button>
                      <div
                        className={`suggest-hidden-group${hiddenExpanded ? " open" : ""}`}
                        id="suggest-hidden-options"
                        role="listbox"
                        aria-label="More track suggestions"
                      >
                        {suggestions.slice(1).map((suggestion, index) => renderSuggestion(suggestion, index + 1))}
                      </div>
                    </>
                  ) : null}
                </>
              )}
            </div>
          </div>
          <button type="submit" id="submitBtn" disabled={isSearching}>
            Search
          </button>
        </form>

        {showPopularTracks ? (
          <section className="popular" aria-labelledby="popular-heading">
            <div className="popular-heading" id="popular-heading">
              <span>Popular on Spotify</span>
              <span>{popularLoading ? "Loading…" : "Tap to search"}</span>
            </div>
            {popularLoading && popularTracks.length === 0 ? (
              <div className="popular-list" aria-label="Loading popular tracks">
                {Array.from({ length: 4 }, (_, index) => (
                  <div className="popular-item popular-skeleton" key={index} aria-hidden="true" />
                ))}
              </div>
            ) : (
              <div className="popular-list">
                {popularTracks.map((popularTrack, index) => (
                  <TrackListItem
                    key={savedTrackKey(popularTrack.name, popularTrack.artist)}
                    track={popularTrack}
                    index={index}
                    saved={isTrackSaved(popularTrack.name, popularTrack.artist)}
                    onSelect={() => searchPopularTrack(popularTrack)}
                    onToggleSave={() => toggleSuggestionSaved(popularTrack)}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {savedTracks.length > 0 ? (
          <section className="saved" aria-labelledby="saved-heading">
            <div className="popular-heading" id="saved-heading">
              <span>Saved tracks</span>
              <span>{savedExpanded ? "Showing all" : `${savedTracks.length} saved`}</span>
            </div>
            <div className="popular-list saved-list">
              {(savedExpanded ? savedTracks : savedTracks.slice(0, SAVED_TRACK_PREVIEW_COUNT)).map(
                (savedTrack, index) => (
                  <TrackListItem
                    key={savedTrack.id}
                    track={savedTrack}
                    index={index}
                    saved
                    onSelect={() => searchPopularTrack(savedTrack)}
                    onToggleSave={() => toggleSavedTrack(savedTrack)}
                  />
                ),
              )}
            </div>
            {savedTracks.length > SAVED_TRACK_PREVIEW_COUNT ? (
              <button
                className={`view-more${savedExpanded ? " expanded" : ""}`}
                type="button"
                aria-expanded={savedExpanded}
                onClick={() => setSavedExpanded((current) => !current)}
              >
                <span>{savedExpanded ? "View Less" : "View More"}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            ) : null}
          </section>
        ) : null}

        <div className="quick-fields">
          <div className="field">
            <input
              type="text"
              id="artistField"
              placeholder="Artist (optional)"
              aria-label="Artist"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="search"
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
            />
          </div>
          <div className="field">
            <input
              type="text"
              id="trackField"
              placeholder="Track (optional)"
              aria-label="Track"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="search"
              value={track}
              onChange={(event) => setTrack(event.target.value)}
            />
          </div>
        </div>

        <div id="output">{renderOutput()}</div>
      </div>
      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}

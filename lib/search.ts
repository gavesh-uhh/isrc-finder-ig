import { escapeLuceneField, normalizeIsrc, uniqueStrings } from "./query";
import type { RecordingResult } from "./types";

export interface SearchParts {
  query: string;
  artist: string;
  track: string;
}

export interface FreeTextCandidate {
  query: string;
  track: string;
  artist: string;
}

function normalizeMatchText(value: string): string {
  return value
    .normalize("NFKD")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function exactMatchKey(title: string, artists: string[]): string {
  const normalizedArtists = artists
    .map(normalizeMatchText)
    .filter(Boolean)
    .sort()
    .join("|");
  return `${normalizeMatchText(title)}|${normalizedArtists}`;
}

function fieldQuery(track: string, artist: string): string {
  return [
    track ? `recording:${escapeLuceneField(track)}` : "",
    artist ? `artist:${escapeLuceneField(artist)}` : "",
  ]
    .filter(Boolean)
    .join(" AND ");
}

export function buildMusicBrainzQuery({ query, artist, track }: SearchParts): string {
  const directIsrc = normalizeIsrc(query) ?? normalizeIsrc(track) ?? normalizeIsrc(artist);
  if (directIsrc) {
    return `isrc:${directIsrc}`;
  }

  if (artist || track) {
    return fieldQuery(track, artist);
  }

  return query;
}

export function hasExplicitMusicBrainzField(value: string): boolean {
  return /(?:^|\s)(?:artist|recording|isrc):/i.test(value);
}

export function buildFreeTextCandidates(query: string): FreeTextCandidate[] {
  const words = query.split(/\s+/).filter(Boolean);
  if (words.length < 4 || hasExplicitMusicBrainzField(query)) {
    return [];
  }

  const candidates: FreeTextCandidate[] = [];
  const addCandidate = (track: string, artist: string) => {
    if (!track || !artist) {
      return;
    }
    const candidate = { track, artist, query: fieldQuery(track, artist) };
    if (!candidates.some((item) => item.query === candidate.query)) {
      candidates.push(candidate);
    }
  };

  // The common conversational form is “track artist”. Also try the inverse
  // “artist track” form, which is common when a title starts with an artist name.
  addCandidate(words.slice(0, -2).join(" "), words.slice(-2).join(" "));
  addCandidate(words.slice(2).join(" "), words.slice(0, 2).join(" "));

  return candidates;
}

function containsAllWords(value: string, expected: string): boolean {
  const valueWords = new Set(normalizeMatchText(value).split(" ").filter(Boolean));
  const expectedWords = normalizeMatchText(expected).split(" ").filter(Boolean);
  return expectedWords.length > 0 && expectedWords.every((word) => valueWords.has(word));
}

export function filterStructuredRecordings(
  recordings: RecordingResult[],
  track: string,
  artist: string,
): RecordingResult[] {
  return recordings.filter((recording) => {
    const titleMatches = !track || containsAllWords(recording.title, track);
    const artistMatches = !artist || containsAllWords(recording.artists.join(" "), artist);
    return titleMatches && artistMatches && (recording.score === undefined || recording.score >= 50);
  });
}

export function filterCandidateRecordings(
  recordings: RecordingResult[],
  candidate: FreeTextCandidate,
): RecordingResult[] {
  return recordings.filter((recording) => {
    const artistText = recording.artists.join(" ");
    return (
      containsAllWords(recording.title, candidate.track) &&
      containsAllWords(artistText, candidate.artist) &&
      (recording.score === undefined || recording.score >= 50)
    );
  });
}

function mergeRecording(primary: RecordingResult, secondary: RecordingResult): RecordingResult {
  const primaryReleaseCount = primary.releaseCount ?? primary.releases.length;
  const secondaryReleaseCount = secondary.releaseCount ?? secondary.releases.length;
  const mergedReleases =
    primary.releases.length > 0
      ? [...primary.releases, ...secondary.releases].filter(
          (release, index, all) =>
            all.findIndex(
              (candidate) =>
                candidate.title === release.title &&
                candidate.date === release.date &&
                candidate.country === release.country,
            ) === index,
        )
      : secondary.releases;

  return {
    ...primary,
    isrcs: uniqueStrings([...primary.isrcs, ...secondary.isrcs]),
    releases: mergedReleases.slice(0, 8),
    releaseCount: Math.max(primaryReleaseCount, secondaryReleaseCount),
    firstReleaseDate: primary.firstReleaseDate ?? secondary.firstReleaseDate,
    disambiguation: primary.disambiguation ?? secondary.disambiguation,
    lengthMs: primary.lengthMs ?? secondary.lengthMs,
    score: primary.score ?? secondary.score,
    artworkUrl: primary.artworkUrl ?? secondary.artworkUrl,
    source: primary.source === secondary.source ? primary.source : "both",
  };
}

export function mergeUniqueRecordings(
  first: RecordingResult[],
  second: RecordingResult[],
  limit: number,
): RecordingResult[] {
  const byId = new Map<string, RecordingResult>();
  for (const recording of [...first, ...second]) {
    const existing = byId.get(recording.id);
    byId.set(recording.id, existing ? mergeRecording(existing, recording) : recording);
  }
  return [...byId.values()].slice(0, limit);
}

function hasDisjointIsrcs(primary: RecordingResult, secondary: RecordingResult): boolean {
  return (
    primary.isrcs.length > 0 &&
    secondary.isrcs.length > 0 &&
    !primary.isrcs.some((isrc) => secondary.isrcs.includes(isrc))
  );
}

export function prioritizeRecordings(recordings: RecordingResult[]): RecordingResult[] {
  const versionPattern = /\b(live|remix|mix|cover|tribute|medley|instrumental|dj|edit|version|acoustic)\b/i;
  return [...recordings].sort((left, right) => {
    const leftHasIsrc = left.isrcs.length > 0;
    const rightHasIsrc = right.isrcs.length > 0;
    if (leftHasIsrc !== rightHasIsrc) {
      return leftHasIsrc ? -1 : 1;
    }

    const leftVersion = versionPattern.test(left.disambiguation ?? "") ? 1 : 0;
    const rightVersion = versionPattern.test(right.disambiguation ?? "") ? 1 : 0;
    if (leftVersion !== rightVersion) {
      return leftVersion - rightVersion;
    }

    const leftDate = left.firstReleaseDate ? Date.parse(left.firstReleaseDate) : Number.MAX_SAFE_INTEGER;
    const rightDate = right.firstReleaseDate ? Date.parse(right.firstReleaseDate) : Number.MAX_SAFE_INTEGER;
    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    return (right.score ?? 0) - (left.score ?? 0);
  });
}

export function mergeRecordings(
  musicBrainzRecordings: RecordingResult[],
  spotifyRecordings: RecordingResult[],
  limit: number,
): RecordingResult[] {
  const spotifyByIsrc = new Map<string, RecordingResult[]>();
  const spotifyByKey = new Map<string, RecordingResult[]>();

  for (const recording of spotifyRecordings) {
    for (const isrc of recording.isrcs) {
      const list = spotifyByIsrc.get(isrc) ?? [];
      list.push(recording);
      spotifyByIsrc.set(isrc, list);
    }
    const key = exactMatchKey(recording.title, recording.artists);
    const list = spotifyByKey.get(key) ?? [];
    list.push(recording);
    spotifyByKey.set(key, list);
  }

  const usedSpotifyIds = new Set<string>();
  const merged = musicBrainzRecordings.map((recording) => {
    let match: RecordingResult | undefined;
    for (const isrc of recording.isrcs) {
      const candidates = spotifyByIsrc.get(isrc) ?? [];
      if (candidates.length === 1) {
        match = candidates[0];
        break;
      }
    }

    if (!match) {
      const candidates = spotifyByKey.get(exactMatchKey(recording.title, recording.artists)) ?? [];
      if (
        candidates.length === 1 &&
        !hasDisjointIsrcs(recording, candidates[0]) &&
        (recording.score === undefined || recording.score >= 70)
      ) {
        match = candidates[0];
      }
    }

    if (!match) {
      return recording;
    }

    usedSpotifyIds.add(match.id);
    return mergeRecording(recording, match);
  });

  for (const recording of spotifyRecordings) {
    if (!usedSpotifyIds.has(recording.id)) {
      merged.push(recording);
    }
  }

  return merged.slice(0, limit);
}

const ISRC_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;

export function cleanQueryPart(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeIsrc(value: string): string | null {
  const normalized = value.replace(/[\s-]/g, "").toUpperCase();
  return ISRC_PATTERN.test(normalized) ? normalized : null;
}

export function isIsrcQuery(value: string): boolean {
  return normalizeIsrc(value) !== null;
}

export function escapeLucene(value: string): string {
  return value.replace(/([+\-&|!(){}\[\]^"~*?:\\/])/g, "\\$1");
}

export function escapeLuceneField(value: string): string {
  return escapeLucene(value).replace(/\b(AND|OR|NOT)\b/gi, "\\$1");
}

export function quoteSpotifyField(value: string): string {
  return value.replace(/["\\]/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeTrackKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(feat\.?[^)]*\)/g, "")
    .replace(/\[feat\.?[^\]]*\]/g, "")
    .replace(/feat\.?.*/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

export function safeImageUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function normalizeIsrcList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return uniqueStrings(
    values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.replace(/[\s-]/g, "").toUpperCase())
      .filter((value) => ISRC_PATTERN.test(value)),
  );
}

export function releaseYear(date: string | undefined): string {
  if (!date) {
    return "";
  }
  return date.length >= 4 ? date.slice(0, 4) : date;
}

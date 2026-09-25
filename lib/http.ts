const MAX_JSON_BYTES = 2_000_000;

export class UpstreamError extends Error {
  readonly status: number;
  readonly provider: string;

  constructor(provider: string, message: string, status = 502) {
    super(message);
    this.name = "UpstreamError";
    this.provider = provider;
    this.status = status;
  }
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error";
}

export async function readJson<T>(response: Response, provider: string): Promise<T> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    throw new UpstreamError(provider, `${provider} response is too large`, 502);
  }

  const text = await response.text();
  if (text.length > MAX_JSON_BYTES) {
    throw new UpstreamError(provider, `${provider} response is too large`, 502);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = JSON.parse(text) as { error?: string; message?: string };
      detail = body.error ?? body.message ?? "";
    } catch {
      detail = text.slice(0, 180);
    }

    const status = response.status === 429 ? 429 : response.status >= 500 ? 502 : response.status;
    const suffix = detail ? `: ${detail}` : "";
    throw new UpstreamError(provider, `${provider} returned HTTP ${response.status}${suffix}`, status);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new UpstreamError(provider, `${provider} returned invalid JSON`, 502);
  }
}

export function getRequestSignal(timeoutMs = 6_000, parentSignal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return parentSignal ? AbortSignal.any([parentSignal, timeoutSignal]) : timeoutSignal;
}

export function waitForSignal(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason instanceof Error ? signal.reason : new Error("Request aborted"));
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason instanceof Error ? signal.reason : new Error("Request aborted"));
    };

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

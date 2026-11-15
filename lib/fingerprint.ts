export type ClientInfo = {
  id: string;
  summary: string;
  agent: string;
};

function hash(value: string): string {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return (result >>> 0).toString(16).padStart(8, "0");
}

// Coarse, non-invasive device traits; no canvas or font probing.
export function getClientInfo(): ClientInfo {
  const screenInfo = `${window.screen.width}x${window.screen.height}@${window.devicePixelRatio}x`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const input = navigator.maxTouchPoints > 0 ? "touch" : "pointer";
  return {
    id: hash(
      [
        navigator.userAgent,
        navigator.platform,
        screenInfo,
        navigator.languages?.join(","),
        timezone,
        input,
        navigator.hardwareConcurrency ?? "",
      ].join("|"),
    ),
    summary: [navigator.platform || "unknown", screenInfo, navigator.language, timezone, input]
      .filter(Boolean)
      .join(" · "),
    agent: navigator.userAgent,
  };
}

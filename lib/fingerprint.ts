export type ClientInfo = {
  id: string;
  device: string;
  browser: string;
  screen: string;
  locale: string;
  input: string;
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

export function describeDevice(agent: string, platform = ""): string {
  const ios = agent.match(/(?:iPhone|iPad|iPod).*OS (\d+)[_.](\d+)/);
  if (/iPhone/.test(agent)) return ios ? `iPhone · iOS ${ios[1]}.${ios[2]}` : "iPhone";
  if (/iPad/.test(agent)) return ios ? `iPad · iPadOS ${ios[1]}.${ios[2]}` : "iPad";
  if (/iPod/.test(agent)) return "iPod touch";

  if (/Android/.test(agent)) {
    const version = agent.match(/Android (\d+)/)?.[1];
    const model = agent
      .match(/Android [\d.]+; ([^;)]+)/)?.[1]
      .replace(/\s*Build.*$/, "")
      .trim();
    return ["Android", version && `Android ${version}`, model && model !== "K" ? model : ""]
      .filter(Boolean)
      .join(" · ");
  }

  const windows = agent.match(/Windows NT ([\d.]+)/)?.[1];
  if (windows === "10.0") return "Windows 10/11";
  if (windows === "6.3") return "Windows 8.1";
  if (windows) return `Windows ${windows}`;

  const mac = agent.match(/Mac OS X (\d+)[_.](\d+)/);
  if (mac) return `macOS ${mac[1]}.${mac[2]}`;
  if (/CrOS/.test(agent)) return "Chromebook";
  if (/Linux/.test(agent)) return "Linux";
  return platform || "Unknown device";
}

export function describeBrowser(agent: string): string {
  const matches: [RegExp, string][] = [
    [/Edg(?:A|iOS)?\/(\d+)/, "Edge"],
    [/OPR\/(\d+)/, "Opera"],
    [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
    [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
    [/(?:Chrome|CriOS)\/(\d+)/, "Chrome"],
    [/Version\/(\d+).*Safari/, "Safari"],
  ];
  for (const [pattern, name] of matches) {
    const version = agent.match(pattern)?.[1];
    if (version) return `${name} ${version}`;
  }
  return "Unknown browser";
}

// Coarse, non-invasive device traits; no canvas or font probing.
export function getClientInfo(): ClientInfo {
  const agent = navigator.userAgent;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return {
    id: hash(
      [
        agent,
        navigator.platform,
        `${window.screen.width}x${window.screen.height}`,
        navigator.languages?.join(","),
        timezone,
        navigator.hardwareConcurrency ?? "",
      ].join("|"),
    ),
    device: describeDevice(agent, navigator.platform),
    browser: describeBrowser(agent),
    screen: `${window.screen.width} × ${window.screen.height} @${window.devicePixelRatio}x`,
    locale: [navigator.language, timezone].filter(Boolean).join(" · "),
    input: navigator.maxTouchPoints > 0 ? "Touch" : "Pointer",
    agent,
  };
}

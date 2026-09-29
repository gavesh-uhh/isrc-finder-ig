"use client";

import { useCallback, useEffect, useState } from "react";

// Chrome exposes this, but the DOM lib types do not include it.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(value: BeforeInstallPromptEvent | null) => void>();

function publish() {
  for (const listener of listeners) {
    listener(deferredPrompt);
  }
}

// Subscribed at module scope because the event fires once, so an effect can miss it.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    publish();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    publish();
  });
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      return;
    }

    const sync = (value: BeforeInstallPromptEvent | null) => {
      setCanInstall(value !== null && !isStandalone());
    };

    // The event may have fired before this component mounted.
    sync(deferredPrompt);
    listeners.add(sync);

    return () => {
      listeners.delete(sync);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    const event = deferredPrompt;
    if (!event) {
      return;
    }

    // Single use, and Chrome will not fire the event again afterwards.
    deferredPrompt = null;
    publish();

    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      // The sheet was dismissed, or the prompt was not user-initiated.
    }
  }, []);

  return { canInstall, promptInstall };
}

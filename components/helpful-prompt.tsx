"use client";

import { useEffect, useRef, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";

import { getClientInfo } from "@/lib/fingerprint";

const PROMPT_KEY = "isrc-finder-helpful-prompt";
const SHOW_DELAY_MS = 1500;
const AUTO_HIDE_MS = 20_000;
const FLASH_MS = 1800;

type Status = "hidden" | "ask" | "sending" | "thanks" | "error";

export default function HelpfulPrompt({ active }: { active: boolean }) {
  const [status, setStatus] = useState<Status>("hidden");
  const flashTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    try {
      if (window.sessionStorage.getItem(PROMPT_KEY)) return;
    } catch {
      // Session storage is optional.
    }
    const timer = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(PROMPT_KEY, "1");
      } catch {
        // Session storage is optional.
      }
      setStatus("ask");
    }, SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (status !== "ask") return;
    const timer = window.setTimeout(() => setStatus("hidden"), AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(
    () => () => {
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    },
    [],
  );

  async function submit(helpful: boolean) {
    setStatus("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Quick feedback: ${helpful ? "Helpful" : "Not really"}`,
          client: getClientInfo(),
        }),
      });
      setStatus(response.ok ? "thanks" : "error");
    } catch {
      setStatus("error");
    }
    flashTimerRef.current = window.setTimeout(() => setStatus("hidden"), FLASH_MS);
  }

  if (status === "hidden") return null;

  const asking = status === "ask" || status === "sending";
  return (
    <div className="helpful-prompt" role="status" aria-live="polite">
      <p>
        {status === "thanks"
          ? "Thanks — noted."
          : status === "error"
            ? "Couldn’t send. No worries."
            : "Found this tool helpful?"}
      </p>
      {asking ? (
        <div className="helpful-prompt-actions">
          <button className="helpful-yes" type="button" disabled={status === "sending"} onClick={() => submit(true)}>
            <ThumbsUp aria-hidden="true" />
            Helpful
          </button>
          <button className="helpful-no" type="button" disabled={status === "sending"} onClick={() => submit(false)}>
            <ThumbsDown aria-hidden="true" />
            Not really
          </button>
        </div>
      ) : null}
    </div>
  );
}

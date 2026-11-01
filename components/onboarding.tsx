"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "isrc-finder-onboarding-dismissed";

export default function Onboarding() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "true") return;
    } catch {
      // Storage may be unavailable; the overlay can still be dismissed.
    }
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Keep dismissal working even when storage is blocked.
    }
    dialogRef.current?.close();
    document.getElementById("mainQuery")?.focus();
  }

  return (
    <dialog
      ref={dialogRef}
      className="onboarding"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-description"
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
    >
      <h2 id="onboarding-title">Hello There! 👋</h2>
      <p id="onboarding-description">
        ISRC Finder is built to be as minimal as possible. Find the recording you
        need and copy its unique ISRC code in a few taps.
      </p>
      <ul className="onboarding-features">
        <li>Search a song or artist. Use More to search by artist or browse genres.</li>
        <li>Tap Copy ISRC on a matching result to copy its recording code.</li>
        <li>Star favorites to save them in this browser, or tap Listen on Spotify to open the music.</li>
      </ul>
      <a
        className="pill-link onboarding-guide"
        href="https://www.reddit.com/r/srilanka/s/oOo1OJu047"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg className="pill-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M24 12.14a2.61 2.61 0 0 0-4.42-1.88 12.84 12.84 0 0 0-6.99-2.23l1.19-5.58 3.88.83a1.87 1.87 0 1 0 .19-.91l-4.34-.92a.47.47 0 0 0-.56.36l-1.33 6.22a13.07 13.07 0 0 0-7.08 2.23 2.61 2.61 0 1 0-2.88 4.26 5.2 5.2 0 0 0-.06.79c0 4.01 4.67 7.27 10.43 7.27s10.43-3.26 10.43-7.27a5.2 5.2 0 0 0-.06-.79A2.61 2.61 0 0 0 24 12.14ZM6 14a1.87 1.87 0 1 1 3.74 0A1.87 1.87 0 0 1 6 14Zm10.38 4.96c-1.27 1.27-3.7 1.37-4.38 1.37s-3.11-.1-4.38-1.37a.47.47 0 0 1 .66-.66c.8.8 2.51 1.09 3.72 1.09s2.92-.29 3.72-1.09a.47.47 0 0 1 .66.66ZM16.13 15.87a1.87 1.87 0 1 1 0-3.74 1.87 1.87 0 0 1 0 3.74Z" />
        </svg>
        Guide
      </a>
      <button type="button" onClick={dismiss}>Get started</button>
    </dialog>
  );
}

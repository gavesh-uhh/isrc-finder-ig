"use client";

import { useRef, useState, type FormEvent } from "react";

const RATINGS = [
  { label: "Frustrating" },
  { label: "Needs work" },
  { label: "Okay" },
  { label: "Good" },
  { label: "Excellent" },
];

export default function FeedbackButton() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [rating, setRating] = useState<number>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending || !message.trim()) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, rating }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not send feedback.");
      setSent(true);
      setMessage("");
      setRating(undefined);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send feedback. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button className="pill-link feedback-trigger" type="button" onClick={() => {
        setSent(false);
        setError("");
        dialogRef.current?.showModal();
      }}>
        <svg className="pill-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
        </svg>
        Send Feedback
      </button>
      <dialog ref={dialogRef} className="onboarding feedback-dialog" aria-labelledby="feedback-title" onCancel={(event) => {
        if (sending) event.preventDefault();
      }}>
        <h2 id="feedback-title">{sent ? "Feedback sent" : "Send feedback"}</h2>
        {sent ? (
          <p role="status">Thanks for helping improve ISRC Finder.</p>
        ) : (
          <form className="feedback-form" onSubmit={submit}>
            <fieldset className="feedback-rating" disabled={sending}>
              <legend>Your experience <span>(optional)</span></legend>
              <div className="feedback-rating-options">
                {RATINGS.map((option, index) => (
                  <label className="feedback-rating-option" key={option.label}>
                    <input className="sr-only" type="radio" name="feedback-rating" value={index + 1} checked={rating === index + 1} onChange={() => setRating(index + 1)} aria-label={`${index + 1} out of 5: ${option.label}`} />
                    <span aria-hidden="true">{index + 1}</span>
                  </label>
                ))}
              </div>
              <div className="feedback-rating-caption" aria-live="polite">
                {rating ? RATINGS[rating - 1].label : "1 — Frustrating · 5 — Excellent"}
              </div>
            </fieldset>
            <label htmlFor="feedback-message">What should we fix or improve?</label>
            <p className="feedback-hint" id="feedback-hint">For a problem, include what you tried, what happened, and what you expected. A song name or device/browser helps too.</p>
            <textarea id="feedback-message" aria-describedby="feedback-hint" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} rows={4} required disabled={sending} placeholder="Describe the issue or share an idea…" />
            <span className="feedback-count">{message.length} / 1000</span>
            {error ? <p className="feedback-error" role="alert">{error}</p> : null}
            <button type="submit" disabled={sending || !message.trim()}>{sending ? "Sending…" : "Send feedback"}</button>
          </form>
        )}
        <button className="feedback-close" type="button" disabled={sending} onClick={() => dialogRef.current?.close()}>{sent ? "Done" : "Cancel"}</button>
      </dialog>
    </>
  );
}

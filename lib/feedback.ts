export async function sendDiscordFeedback(message: string, webhookUrl: string, rating?: number): Promise<void> {
  if (!message.trim() || message.length > 1000) {
    throw new Error("Feedback must contain 1–1000 characters.");
  }
  if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new Error("Rating must be a whole number between 1 and 5.");
  }
  const url = new URL(webhookUrl);
  if (
    url.origin !== "https://discord.com" ||
    !/^\/api\/webhooks\/\d+\/[\w-]+$/.test(url.pathname) ||
    url.username || url.password
  ) {
    throw new Error("Invalid Discord webhook configuration.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `**ISRC Finder feedback**\n${rating === undefined ? "" : `Rating: ${rating}/5\n`}${message.trim()}`,
      allowed_mentions: { parse: [] },
    }),
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Discord could not accept feedback.");
}

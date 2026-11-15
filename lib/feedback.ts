export type FeedbackClient = {
  id?: string;
  summary?: string;
  agent?: string;
};

function oneLine(value: string | undefined, max: number): string | undefined {
  const text = value?.replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
  return text || undefined;
}

export async function sendDiscordFeedback(
  message: string,
  webhookUrl: string,
  rating?: number,
  client?: FeedbackClient,
): Promise<void> {
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

  const device = client
    ? [oneLine(client.id, 40), oneLine(client.summary, 160)].filter(Boolean).join(" — ")
    : "";
  const agent = oneLine(client?.agent, 400);
  const content = [
    "**ISRC Finder feedback**",
    rating === undefined ? undefined : `Rating: ${rating}/5`,
    device ? `Device: ${device}` : undefined,
    agent ? `UA: ${agent}` : undefined,
    message.trim(),
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content,
      allowed_mentions: { parse: [] },
    }),
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Discord could not accept feedback.");
}

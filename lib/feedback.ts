export type FeedbackClient = {
  id?: string;
  device?: string;
  browser?: string;
  screen?: string;
  locale?: string;
  input?: string;
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

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
  if (rating !== undefined) fields.push({ name: "Rating", value: `${rating}/5`, inline: true });
  if (client?.device) fields.push({ name: "Device", value: oneLine(client.device, 100) || "", inline: true });
  if (client?.browser) fields.push({ name: "Browser", value: oneLine(client.browser, 60) || "", inline: true });
  if (client?.screen) fields.push({ name: "Screen", value: oneLine(client.screen, 60) || "", inline: true });
  if (client?.locale) fields.push({ name: "Locale", value: oneLine(client.locale, 80) || "", inline: true });
  if (client?.input) fields.push({ name: "Input", value: client.input, inline: true });
  if (client?.id) fields.push({ name: "Device ID", value: oneLine(client.id, 40) || "", inline: true });

  const embed = {
    title: "ISRC Finder feedback",
    description: oneLine(message.trim(), 3900) || "No message.",
    color: 0x46a758,
    timestamp: new Date().toISOString(),
    fields,
    footer: { text: "ISRC Finder · anonymous feedback" },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: "",
      embeds: [embed],
      allowed_mentions: { parse: [] },
    }),
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Discord could not accept feedback.");
}

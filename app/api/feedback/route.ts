import { NextRequest, NextResponse } from "next/server";

import { sendDiscordFeedback } from "@/lib/feedback";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Request not allowed." }, { status: 403 });
  }
  const rate = checkRateLimit(request, 3, 60_000, "feedback");
  if (!rate.allowed) {
    return NextResponse.json({ error: "Please wait a minute before sending more feedback." }, {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfterSeconds) },
    });
  }

  const webhookUrl = process.env.DISCORD?.trim();
  if (!webhookUrl) {
    return NextResponse.json({ error: "Feedback is not available right now." }, { status: 503 });
  }

  let body;
  try {
    const reader = request.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: "A feedback message is required." }, { status: 400 });
    }
    const decoder = new TextDecoder();
    let text = "";
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        return NextResponse.json({ error: "Feedback request is too large." }, { status: 413 });
      }
      text += decoder.decode(value, { stream: true });
    }
    body = JSON.parse(text + decoder.decode());
  } catch {
    return NextResponse.json({ error: "Invalid feedback request." }, { status: 400 });
  }
  if (typeof body?.message !== "string" || !body.message.trim() || body.message.length > 1000) {
    return NextResponse.json({ error: "Enter a message between 1 and 1000 characters." }, { status: 400 });
  }
  if (body.rating !== undefined && (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5)) {
    return NextResponse.json({ error: "Choose a rating between 1 and 5." }, { status: 400 });
  }

  try {
    await sendDiscordFeedback(body.message, webhookUrl, body.rating);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not send feedback. Please try again later." }, { status: 502 });
  }
}

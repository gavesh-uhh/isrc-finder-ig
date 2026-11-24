import assert from "node:assert/strict";
import { test } from "node:test";

import { sendDiscordFeedback } from "./feedback";

const webhook = "https://discord.com/api/webhooks/123/test-token";

test("sends feedback without allowing Discord mentions", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", async (_url: URL, init: RequestInit) => {
    assert.deepEqual(JSON.parse(init.body as string), {
      content: "**ISRC Finder feedback**\n@everyone hello",
      allowed_mentions: { parse: [] },
    });
    assert.equal(init.method, "POST");
    assert.equal(init.redirect, "error");
    return new Response(null, { status: 204 });
  });
  await sendDiscordFeedback(" @everyone hello ", webhook);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("rejects empty, oversized and invalid-destination submissions before sending", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", async () => new Response());
  await assert.rejects(sendDiscordFeedback(" ", webhook));
  await assert.rejects(sendDiscordFeedback("a".repeat(1001), webhook));
  await assert.rejects(sendDiscordFeedback("hello", "https://example.com/api/webhooks/123/token"));
  await assert.rejects(sendDiscordFeedback("hello", "https://discord.com/not-a-webhook"));
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("reports Discord errors rather than claiming successful delivery", async (context) => {
  context.mock.method(globalThis, "fetch", async () => new Response(null, { status: 429 }));
  await assert.rejects(sendDiscordFeedback("hello", webhook));
});

test("includes the selected rating and rejects invalid ratings", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", async (_url: URL, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    assert.equal(body.content, "");
    assert.equal(body.embeds[0].fields.find((field: { name: string }) => field.name === "Rating")!.value, "5/5");
    return new Response(null, { status: 204 });
  });
  await sendDiscordFeedback("Great app", webhook, 5);
  for (const rating of [0, 6, 2.5, NaN]) {
    await assert.rejects(sendDiscordFeedback("Great app", webhook, rating));
  }
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("adds device details to a Discord embed", async (context) => {
  context.mock.method(globalThis, "fetch", async (_url: URL, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    assert.equal(body.content, "");
    const embed = body.embeds[0];
    assert.equal(embed.title, "ISRC Finder feedback");
    assert.equal(embed.description, "Nice second line");
    assert.equal(embed.fields.length, 6);
    const field = (name: string) => embed.fields.find((field: { name: string }) => field.name === name);
    assert.equal(field("Rating")!.value, "4/5");
    assert.equal(field("Device")!.value, "iPhone · iOS 18.1");
    assert.equal(field("Browser")!.value, "Safari 18");
    assert.equal(field("Screen")!.value, "390 × 844 @3x");
    assert.equal(field("Locale")!.value, "en-US · Europe/London");
    assert.equal(field("Input")!.value, "Touch");
    assert.equal(field("Device ID")!.value, "a1b2c3d4");
    return new Response(null, { status: 204 });
  });
  await sendDiscordFeedback("Nice\nsecond line", webhook, 4, {
    id: "a1b2c3d4",
    device: "iPhone · iOS 18.1",
    browser: "Safari 18",
    screen: "390 × 844 @3x",
    locale: "en-US · Europe/London",
    input: "Touch",
    agent: "Mozilla/5.0\nX",
  });
});

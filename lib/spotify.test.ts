import assert from "node:assert/strict";
import { test } from "node:test";

import { getSpotifyArtistArtwork, searchSpotifyByGenre } from "./spotify";

test("artist artwork validates IDs, deduplicates requests and handles missing or unsafe images", async (context) => {
  const originalId = process.env.SPOTIFY_CLIENT_ID;
  const originalSecret = process.env.SPOTIFY_CLIENT_SECRET;
  process.env.SPOTIFY_CLIENT_ID = "test";
  process.env.SPOTIFY_CLIENT_SECRET = "test";
  context.after(() => {
    if (originalId === undefined) delete process.env.SPOTIFY_CLIENT_ID;
    else process.env.SPOTIFY_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.SPOTIFY_CLIENT_SECRET;
    else process.env.SPOTIFY_CLIENT_SECRET = originalSecret;
  });

  let artistRequests = 0;
  context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("/api/token")) {
      return Response.json({ access_token: "test", expires_in: 3600 });
    }
    artistRequests += 1;
    if (url.endsWith("B".repeat(22))) return Response.json({ images: [] });
    if (url.endsWith("C".repeat(22))) {
      return Response.json({ images: [{ url: "javascript:alert(1)", width: 640 }] });
    }
    if (url.endsWith("D".repeat(22))) return new Response("Unavailable", { status: 503 });
    return Response.json({ images: [{ url: "https://example.com/artist.jpg", width: 640 }] });
  });

  assert.equal(await getSpotifyArtistArtwork("../invalid"), null);
  assert.equal(artistRequests, 0);
  assert.deepEqual(await Promise.all([
    getSpotifyArtistArtwork("A".repeat(22)),
    getSpotifyArtistArtwork("A".repeat(22)),
  ]), ["https://example.com/artist.jpg", "https://example.com/artist.jpg"]);
  assert.equal(artistRequests, 1);
  assert.equal(await getSpotifyArtistArtwork("B".repeat(22)), null);
  assert.equal(await getSpotifyArtistArtwork("C".repeat(22)), null);
  await assert.rejects(getSpotifyArtistArtwork("D".repeat(22)));
});

test("genre browsing uses a quoted Spotify genre filter and keeps ISRCs", async (context) => {
  const originalId = process.env.SPOTIFY_CLIENT_ID;
  const originalSecret = process.env.SPOTIFY_CLIENT_SECRET;
  process.env.SPOTIFY_CLIENT_ID = "test";
  process.env.SPOTIFY_CLIENT_SECRET = "test";
  context.after(() => {
    if (originalId === undefined) delete process.env.SPOTIFY_CLIENT_ID;
    else process.env.SPOTIFY_CLIENT_ID = originalId;
    if (originalSecret === undefined) delete process.env.SPOTIFY_CLIENT_SECRET;
    else process.env.SPOTIFY_CLIENT_SECRET = originalSecret;
  });

  let searchQuery = "";
  context.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/api/token")) {
      return Response.json({ access_token: "test", expires_in: 3600 });
    }
    searchQuery = url.searchParams.get("q") ?? "";
    return Response.json({
      tracks: {
        items: [
          {
            id: "track-1",
            name: "Song",
            artists: [{ id: "artist-1", name: "Artist" }],
            album: {
              name: "Album",
              images: [{ url: "https://example.com/cover.jpg", width: 640 }],
            },
            external_ids: { isrc: "USAT21203281" },
            external_urls: { spotify: "https://open.spotify.com/track/track-1" },
          },
        ],
      },
    });
  });

  const result = await searchSpotifyByGenre("hip hop", 5);
  assert.equal(result.status, "ok");
  assert.equal(searchQuery, 'genre:"hip hop"');
  assert.equal(result.recordings.length, 1);
  assert.equal(result.recordings[0].isrcs[0], "USAT21203281");
  assert.equal(result.recordings[0].artworkUrl, "https://example.com/cover.jpg");
});

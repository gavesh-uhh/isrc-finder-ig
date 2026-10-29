import assert from "node:assert/strict";
import { test } from "node:test";

import { mergeRecordings } from "./search";
import type { RecordingResult } from "./types";

function recording(id: string, isrcs: string[]): RecordingResult {
  return { id, title: "Same song", artists: ["Artist"], isrcs, releases: [], source: "musicbrainz" };
}

test("merges duplicate ISRCs within and across providers while retaining enrichment", () => {
  const first = recording("mb-1", ["USAT21203281"]);
  const duplicate = recording("mb-2", first.isrcs);
  const spotify: RecordingResult = {
    ...recording("sp-1", first.isrcs),
    source: "spotify",
    artworkUrl: "https://example.com/cover.jpg",
    spotifyUrl: "https://open.spotify.com/track/example",
    releases: [{ title: "Album" }],
  };
  const results = mergeRecordings([first, duplicate], [spotify, { ...spotify, id: "sp-2" }], 15);
  assert.equal(results.length, 1);
  assert.equal(results[0].source, "both");
  assert.equal(results[0].artworkUrl, spotify.artworkUrl);
  assert.equal(results[0].spotifyUrl, spotify.spotifyUrl);
  assert.deepEqual(results[0].releases, spotify.releases);
  assert.deepEqual(first.releases, []);
});

test("combines overlapping ISRC groups before applying the result limit", () => {
  const results = mergeRecordings([
    recording("a", ["USAT21203281"]),
    recording("b", ["USAT21203282"]),
    recording("bridge", ["USAT21203281", "USAT21203282"]),
    recording("c", ["USAT21203283"]),
  ], [], 2);
  assert.equal(results.length, 2);
  assert.deepEqual(new Set(results[0].isrcs), new Set(["USAT21203281", "USAT21203282"]));
  assert.equal(results[1].id, "c");
});

test("keeps distinct codes and unidentified recordings separate", () => {
  const tracks = [
    recording("a", ["USAT21203281"]),
    recording("b", ["USAT21203282"]),
    recording("c", []),
    recording("d", []),
  ];
  assert.deepEqual(mergeRecordings(tracks, [], 15), tracks);
  assert.equal(mergeRecordings([], tracks, 15).length, 4);
  assert.equal(mergeRecordings([tracks[0], tracks[0]], [], 15).length, 1);
});

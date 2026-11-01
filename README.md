# ISRC Finder

Find and copy song ISRC codes using MusicBrainz and Spotify. Search recordings, browse genres, save tracks locally, and open them on Spotify.

## Get started

Requires Node.js 20.9+ and npm 10+.

1. Copy `.env.example` to `.env.local` and set `MUSICBRAINZ_USER_AGENT`. Spotify features optionally require `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`.
2. Run:

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000).

Set `DISCORD` to your Discord webhook URL in `.env.local` and your hosting environment to enable feedback.

## API

The endpoints below use `GET` and return JSON.

| Endpoint | Parameters | Returns |
| --- | --- | --- |
| `/api/search` | At least one of `query`, `artist`, `track`; optional `limit` (1–25) | Recordings and ISRCs |
| `/api/genres` | None returns Spotify genre categories; `genre` returns top Spotify tracks for that genre | Genre list or recordings with ISRCs |
| `/api/suggestions` | `track` | Spotify track suggestions |
| `/api/artwork` | `track`, `artist` | Album image URL |
| `/api/artist-artwork` | `artistId` | Spotify artist image URL |
| `/api/popular` | None | Popular Spotify tracks |

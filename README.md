# ISRC Finder

A compact Next.js/React app for finding recording ISRCs quickly. The interface keeps the original Vercel-inspired monochrome visual language, Sora typography, dense result cards, one-click copy, and keyboard-friendly suggestions.

## What it includes

- **MusicBrainz recording search** with `isrcs`, artist credits, releases, and match scores. When a search result represents a compilation/remix without ISRCs, the app hydrates likely original recordings with a direct MusicBrainz recording lookup.
- **Artist + Track fields** for precise searches, plus free-text and direct ISRC lookup.
- **Spotify track suggestions** with debounced autocomplete, keyboard navigation, and Spotify album covers.
- **Spotify enrichment** when server-side client credentials are configured. Spotify results are conservatively merged with MusicBrainz results by shared ISRC or an unambiguous title/artist match.
- **Same-origin API routes** so browser CORS restrictions and API secrets do not affect the client.
- **Server-side response caching**, bounded MusicBrainz queueing, request cancellation, upstream deadlines, and graceful provider fallbacks.
- **Per-route rate limiting** for interactive public use. For a multi-region deployment, add an edge/WAF limiter in front of the app as well.
- **Accessible controls**: combobox/listbox semantics, visible focus states, keyboard navigation, reduced-motion support, and copy status announcements.
- **Theme persistence** using the system preference on first visit and a compact light/dark toggle afterward.
- Baseline security headers and no `X-Powered-By` response header.

`ISRC Finder.html` is retained only as a visual reference from the original brief. The production app is the Next.js implementation and does not use its legacy browser-side provider code.

## Requirements

- Node.js 20.9 or newer
- npm 10 or newer

## Run locally

The repository includes an npm lockfile and a dependency override for the patched PostCSS release.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

On PowerShell, use `Copy-Item .env.example .env.local` instead of `cp`.

Open [http://localhost:3000](http://localhost:3000).

The app is usable with MusicBrainz alone. Spotify is optional, but it is required for autocomplete and album covers:

- Add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` for Spotify autocomplete, album covers, and catalog enrichment. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and use the Client Credentials flow.
- The Spotify client secret is used only by the server route and is never included in the client bundle.
- Set `MUSICBRAINZ_USER_AGENT` to a descriptive application name plus a contact URL or email before deploying publicly.

## Environment variables

See [`.env.example`](./.env.example) for the complete list. Do not commit `.env.local` or any provider credentials. The archive intentionally excludes local environment files.

## API routes

- `GET /api/search?query=...&artist=...&track=...` — searches MusicBrainz and, when configured, Spotify with a bounded response deadline.
- `GET /api/suggestions?track=...` — returns ranked Spotify track suggestions.
- `GET /api/artwork?track=...&artist=...` — returns Spotify album artwork.

All route handlers validate input, cap query length, apply per-route rate limits, use an upstream timeout, propagate client cancellation, and avoid returning provider credentials or raw upstream errors.

## Production

```bash
npm run lint
npm run typecheck
npm run build
npm run start
```

The MusicBrainz API is community-run and expects respectful request rates. The app serializes MusicBrainz requests, caps its queue, and caches identical searches, but it is still intended for interactive lookups rather than bulk scraping.

`next/font/google` downloads the Sora font data during the build. If your CI environment is fully offline, provide a local Sora font asset or allow the Google Fonts fetch during the build.

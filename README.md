# ISRC Finder

A Next.js application for finding recording ISRCs. It searches MusicBrainz and can use Spotify for suggestions, album artwork, catalog matching, and a small list of current popular tracks.

## What it does

- Search by free text, artist, track, or ISRC.
- Return matching recordings with ISRCs, artists, releases, and match information.
- Copy an ISRC to the clipboard.
- Optionally provide Spotify autocomplete, album artwork, and additional catalog matches.
- Install as a PWA on supported devices.

MusicBrainz works without Spotify credentials. Spotify features require Spotify Client Credentials.

## API routes

All routes are same-origin JSON endpoints.

### Search

```http
GET /api/search?query=love&artist=The%20Beatles&track=Because
```

All query parameters are optional, but at least one search value is required.

### Suggestions

```http
GET /api/suggestions?track=because
```

Returns Spotify track suggestions for autocomplete.

### Artwork

```http
GET /api/artwork?track=Because&artist=The%20Beatles
```

Returns a Spotify album image URL when available.

### Popular tracks

```http
GET /api/popular
```

Returns the current tracks used for the popular-track shortcuts.

## Environment variables

Copy `.env.example` to `.env.local` and configure:

```env
MUSICBRAINZ_USER_AGENT=YourApp/1.0 (https://example.com/contact)
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_MARKET=US
```

`SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` are optional. `SPOTIFY_MARKET` controls the Spotify catalog market.

## Run locally

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

The app can be deployed to any Node.js host that supports Next.js.

```bash
npm ci
npm run build
npm run start
```

Set the environment variables in the hosting provider. Do not commit `.env` or `.env.local`. Use HTTPS in production so the PWA and clipboard APIs work reliably.

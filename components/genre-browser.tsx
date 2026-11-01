/* eslint-disable @next/next/no-img-element */

import type { GenreOption } from "@/lib/types";

const SKELETON_TILES = 9;

export default function GenreBrowser({
  genres,
  loading,
  message,
  onSelect,
}: {
  genres: GenreOption[];
  loading: boolean;
  message: string;
  onSelect: (genre: string) => void;
}) {
  return (
    <section className="genre-browser" id="genre-browser" aria-labelledby="genre-browser-heading">
      <div className="genre-browser-head">
        <h2 id="genre-browser-heading">Browse genres</h2>
        <img
          className="genre-browser-icon-thing"
          alt="Spotify Logo"
          src="https://thumb.wikimedia.org/wikipedia/commons/thumb/8/84/Spotify_icon.svg/1280px-Spotify_icon.svg.png"
        />
      </div>
      {message ? (
        <div className="genre-browser-status" role="status">
          {message}
        </div>
      ) : null}
      {loading && genres.length === 0 ? (
        <ul className="genre-grid" aria-hidden="true">
          {Array.from({ length: SKELETON_TILES }, (_, index) => (
            <li className="genre-tile genre-tile--skeleton" key={index} />
          ))}
        </ul>
      ) : genres.length > 0 ? (
        <ul className="genre-grid" aria-label="Music genres">
          {genres.map((genre, index) => (
            <li key={genre.name}>
              <button
                className="genre-tile"
                type="button"
                style={{ animationDelay: `${index * 20}ms` }}
                aria-label={`Browse ${genre.name} tracks`}
                onClick={() => onSelect(genre.name)}
              >
                {genre.artworkUrl ? <img src={genre.artworkUrl} alt="" loading="lazy" /> : null}
                <span className="genre-tile-name">{genre.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

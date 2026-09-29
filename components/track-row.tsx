/* eslint-disable @next/next/no-img-element */

import { StarIcon } from "@/components/icons";
import type { TrackSuggestion } from "@/lib/types";

export default function TrackRow({
  track,
  index,
  saved,
  onSelect,
  onToggleSave,
  selectAriaLabel,
  selectTitle,
  saveDisabled,
}: {
  track: TrackSuggestion;
  index: number;
  saved: boolean;
  onSelect: () => void;
  onToggleSave: () => void;
  selectAriaLabel?: string;
  selectTitle?: string;
  saveDisabled?: boolean;
}) {
  return (
    <li className="track-row" style={{ animationDelay: `${index * 45}ms` }}>
      <button
        className="track-row__select"
        type="button"
        aria-label={selectAriaLabel ?? `Search ${track.name} by ${track.artist}`}
        title={selectTitle}
        onClick={onSelect}
      >
        <span className="track-row__cover">
          {track.artworkUrl ? (
            <img src={track.artworkUrl} alt="" loading="lazy" />
          ) : (
            <span className="track-row__cover-fallback" aria-hidden="true" />
          )}
        </span>
        <span className="track-row__text">
          <span className="track-row__title">{track.name}</span>
          <span className="track-row__artist">{track.artist}</span>
        </span>
      </button>
      <button
        className="track-row__save save-toggle"
        type="button"
        aria-label={saved ? `Remove ${track.name} from saved tracks` : `Save ${track.name}`}
        aria-pressed={saved}
        title={saved ? "Remove from saved" : "Save track"}
        onClick={onToggleSave}
        disabled={saveDisabled}
        aria-busy={saveDisabled || undefined}
      >
        <StarIcon saved={saved} />
      </button>
    </li>
  );
}

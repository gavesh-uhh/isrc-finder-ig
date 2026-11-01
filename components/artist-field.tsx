"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { UserRound } from "lucide-react";

type Artist = { id: string; name: string; artworkUrl?: string };

export default function ArtistField({ value, onChange, onSelect }: { value: string; onChange: (value: string) => void; onSelect: (value: string) => void }) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const selected = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const query = value.trim();
    if (query.length < 2 || query === selected.current) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/artists?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : { artists: [] })
        .then((data: { artists: Artist[] }) => { if (!controller.signal.aborted) { setArtists(data.artists); setActive(-1); setLoading(false); } })
        .catch(() => { if (!controller.signal.aborted) { setArtists([]); setLoading(false); } });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [value]);

  const choose = (artist: Artist) => { selected.current = artist.name; onChange(artist.name); setOpen(false); setActive(-1); setLoading(false); inputRef.current?.blur(); onSelect(artist.name); };
  const visible = open && value.trim().length >= 2 && value.trim() !== selected.current && (loading || artists.length > 0);
  return (
    <div className="field artist-field" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <input ref={inputRef} id="artistField" type="text" placeholder="Artist" aria-label="Artist" autoComplete="off" value={value}
        role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls="artist-options" aria-activedescendant={visible && active >= 0 ? `artist-option-${active}` : undefined}
        onFocus={() => setOpen(true)} onChange={(event) => { selected.current = ""; setArtists([]); setLoading(event.target.value.trim().length >= 2); setOpen(true); onChange(event.target.value); }}
        onKeyDown={(event) => { if (event.key === "ArrowDown" && visible) { event.preventDefault(); setActive((current) => Math.min(current + 1, artists.length - 1)); } else if (event.key === "ArrowUp" && visible) { event.preventDefault(); setActive((current) => Math.max(current - 1, 0)); } else if (event.key === "Enter" && visible && active >= 0) { event.preventDefault(); choose(artists[active]); } else if (event.key === "Escape") setOpen(false); }} />
      {visible ? <div className="artist-options" id="artist-options" role="listbox" aria-label="Artist suggestions">
        {loading ? <div className="artist-loading" role="status" aria-label="Loading artists">{Array.from({ length: 3 }, (_, index) => <div className="artist-skeleton" key={index}><span /><span /></div>)}</div> : null}
        {artists.map((artist, index) => <button key={artist.id} id={`artist-option-${index}`} type="button" role="option" aria-selected={index === active} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(artist)}>
          {artist.artworkUrl ? <img src={artist.artworkUrl} alt="" /> : <span className="artist-placeholder"><UserRound size={16} /></span>}<span>{artist.name}</span>
        </button>)}
      </div> : null}
    </div>
  );
}

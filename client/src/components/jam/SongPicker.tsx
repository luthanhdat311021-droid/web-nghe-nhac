import React, { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { songService } from '../../services/song.service.js';
import { Song } from '../../types/index.js';

interface SongPickerProps {
  placeholder?: string;
  /** Buttons shown at the end of each row (play, queue, suggest…). */
  renderActions?: (song: Song) => React.ReactNode;
  /** Optional single-selection mode: tapping a row toggles it. */
  selectedId?: string | null;
  onSelect?: (song: Song | null) => void;
}

/** Search the catalog, or browse the most played songs when the box is empty. */
export const SongPicker: React.FC<SongPickerProps> = ({ placeholder = 'Tìm bài hát hoặc nghệ sĩ…', renderActions, selectedId, onSelect }) => {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const q = query.trim();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const page = await songService.getAllSongs(q ? { search: q, limit: 20 } : { limit: 20, sort: 'popular' });
        if (active) setSongs(page.items);
      } catch {
        if (active) setSongs([]);
      }
      if (active) setLoading(false);
    }, q ? 300 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl bg-black/20 border border-white/10 py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-emerald-300/60"
        />
        {loading && <Loader2 className="w-4 h-4 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />}
      </div>
      {!query.trim() && <p className="text-[11px] uppercase tracking-wider font-bold text-text-muted">Nghe nhiều nhất</p>}
      <div className="max-h-72 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5 bg-black/10">
        {!loading && songs.length === 0 && <p className="p-4 text-center text-xs text-text-muted">Không tìm thấy bài nào.</p>}
        {songs.map((song) => {
          const isSelected = selectedId === song.id;
          const body = (
            <>
              <img src={song.coverUrl} alt="" className="w-9 h-9 rounded-md object-cover flex-shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white truncate">{song.title}</span>
                <span className="block text-xs text-text-muted truncate">{song.artist?.name}</span>
              </span>
            </>
          );
          return (
            <div key={song.id} className={`flex min-w-0 items-center gap-2 pr-2 transition-colors ${isSelected ? 'bg-amber-300/15' : 'hover:bg-white/5'}`}>
              {onSelect ? (
                <button onClick={() => onSelect(isSelected ? null : song)} className="flex min-w-0 flex-1 items-center gap-3 p-2.5 text-left">
                  {body}
                </button>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-3 p-2.5">{body}</div>
              )}
              {renderActions?.(song)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

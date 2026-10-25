import React, { useEffect, useState } from 'react';
import { Check, Dices, Loader2, Play, Search } from 'lucide-react';
import { songService } from '../../services/song.service.js';
import { Song } from '../../types/index.js';
import { Button } from '../common/Button.js';

interface QuizSongPickerProps {
  round: number;
  busy: boolean;
  onStart: (songId?: string) => void;
}

/** Host-only: pick the next mystery song by searching or from the most played list, or let the server draw one. */
export const QuizSongPicker: React.FC<QuizSongPickerProps> = ({ round, busy, onStart }) => {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Song | null>(null);

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
    <div className="space-y-2.5">
      <p className="text-xs text-text-secondary">Chọn bài cho vòng {round}: chỉ bạn thấy danh sách này.</p>
      <div className="relative">
        <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm bài hát hoặc nghệ sĩ…"
          className="w-full rounded-xl bg-black/20 border border-white/10 py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-amber-300/60"
        />
        {loading && <Loader2 className="w-4 h-4 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />}
      </div>
      {!query.trim() && <p className="text-[11px] uppercase tracking-wider font-bold text-text-muted">Nghe nhiều nhất</p>}
      <div className="max-h-64 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5 bg-black/10">
        {!loading && songs.length === 0 && <p className="p-4 text-center text-xs text-text-muted">Không tìm thấy bài nào.</p>}
        {songs.map((song) => {
          const isSelected = selected?.id === song.id;
          return (
            <button
              key={song.id}
              onClick={() => setSelected(isSelected ? null : song)}
              className={`w-full min-w-0 flex items-center gap-3 p-2.5 text-left transition-colors ${
                isSelected ? 'bg-amber-300/15' : 'hover:bg-white/5'
              }`}
            >
              <img src={song.coverUrl} alt="" className="w-9 h-9 rounded-md object-cover flex-shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white truncate">{song.title}</span>
                <span className="block text-xs text-text-muted truncate">{song.artist?.name}</span>
              </span>
              {isSelected && <Check className="w-4 h-4 text-amber-300 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={busy || !selected}
          onClick={() => selected && onStart(selected.id)}
          leftIcon={<Play className="w-4 h-4" />}
        >
          {selected ? `Bắt đầu vòng ${round}` : 'Chọn một bài để bắt đầu'}
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onStart()} leftIcon={<Dices className="w-4 h-4" />}>
          Ngẫu nhiên
        </Button>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Check, Dices, Play } from 'lucide-react';
import { Song } from '../../types/index.js';
import { Button } from '../common/Button.js';
import { SongPicker } from './SongPicker.js';

interface QuizSongPickerProps {
  round: number;
  busy: boolean;
  onStart: (songId?: string) => void;
}

/** Host-only: pick the next mystery song by searching or from the most played list, or let the server draw one. */
export const QuizSongPicker: React.FC<QuizSongPickerProps> = ({ round, busy, onStart }) => {
  const [selected, setSelected] = useState<Song | null>(null);

  return (
    <div className="space-y-2.5">
      <p className="text-xs text-text-secondary">Chọn bài cho vòng {round}: chỉ bạn thấy danh sách này.</p>
      <SongPicker
        selectedId={selected?.id}
        onSelect={setSelected}
        renderActions={(song) => selected?.id === song.id && <Check className="w-4 h-4 text-amber-300 flex-shrink-0" />}
      />
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

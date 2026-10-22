import React from 'react';
import { Link } from 'react-router-dom';
import { Crown, SlidersHorizontal, Info } from 'lucide-react';
import { Modal } from '../common/Modal.js';
import { EQ_BANDS, EQ_PRESETS, MAX_CROSSFADE, canProcessSource, isProUser, useAudioFxStore } from '../../store/audioFxStore.js';
import { getMediaUrl } from '../../utils/media.js';
import { useAuthStore } from '../../store/authStore.js';
import { useCurrentSong, usePlayerStore } from '../../store/playerStore.js';
import { isYouTubeSource } from '../../utils/youtube.js';

const bandLabel = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : `${hz}`);

export const AudioFxPanel: React.FC = () => {
  const s = useAudioFxStore();
  // Re-render when the profile (and its Pro expiry) changes.
  useAuthStore((a) => a.user?.proExpiresAt);
  const currentSong = useCurrentSong();
  const closeFullScreen = usePlayerStore((p) => p.closeFullScreenPlayer);
  const isPro = isProUser();
  const youtubeNow = isYouTubeSource(currentSong);
  const externalNow = !!currentSong && !youtubeNow && !!currentSong.audioUrl && !canProcessSource(getMediaUrl(currentSong.audioUrl));

  return (
    <Modal isOpen={s.isPanelOpen} onClose={s.closePanel} title="Âm thanh Pro">
      {!isPro ? (
        <div className="space-y-4 text-center py-4">
          <Crown className="w-10 h-10 text-amber-300 mx-auto" />
          <p className="text-sm text-text-secondary">
            Bộ chỉnh âm 10 dải và chuyển bài mượt (crossfade) là quyền lợi của Music Pro.
          </p>
          <Link
            to="/music-pro"
            onClick={() => { s.closePanel(); closeFullScreen(); }}
            className="inline-block rounded-xl bg-amber-300 text-black px-5 py-2.5 text-sm font-bold"
          >
            Nâng cấp Music Pro
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <label className="flex items-center justify-between gap-3 cursor-pointer">
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              <SlidersHorizontal className="w-4 h-4 text-amber-300" /> Bật hiệu ứng âm thanh
            </span>
            <input
              type="checkbox"
              checked={s.enabled}
              onChange={(e) => s.setEnabled(e.target.checked)}
              className="w-10 h-5 accent-amber-300 cursor-pointer"
            />
          </label>

          <fieldset disabled={!s.enabled} className="space-y-5 disabled:opacity-40 transition-opacity">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(EQ_PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  onClick={() => s.setPreset(key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    s.preset === key ? 'bg-amber-300 text-black border-amber-300' : 'border-white/10 text-text-secondary hover:text-white hover:border-white/30'
                  }`}
                >
                  {p.label}
                </button>
              ))}
              {s.preset === 'custom' && (
                <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 text-white">Tùy chỉnh</span>
              )}
            </div>

            <div className="flex items-end justify-between gap-1 h-44 px-1">
              {EQ_BANDS.map((hz, i) => (
                <div key={hz} className="flex flex-col items-center gap-1.5 flex-1 h-full">
                  <span className="text-[10px] font-mono text-text-muted h-3">{s.gains[i] > 0 ? '+' : ''}{s.gains[i]}</span>
                  <input
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    value={s.gains[i]}
                    onChange={(e) => s.setBandGain(i, parseInt(e.target.value, 10))}
                    aria-label={`${bandLabel(hz)}Hz`}
                    className="flex-1 w-full accent-amber-300 cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
                  />
                  <span className="text-[10px] font-mono text-text-muted">{bandLabel(hz)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-white">Chuyển bài mượt</span>
                <span className="font-mono text-xs text-text-muted">{s.crossfade === 0 ? 'Tắt' : `${s.crossfade} giây`}</span>
              </div>
              <input
                type="range"
                min={0}
                max={MAX_CROSSFADE}
                step={1}
                value={s.crossfade}
                onChange={(e) => s.setCrossfade(parseInt(e.target.value, 10))}
                aria-label="Thời gian chuyển bài mượt"
                className="w-full accent-amber-300 cursor-pointer"
              />
              <p className="text-xs text-text-muted">Bài kế tiếp bắt đầu sớm và hòa dần vào cuối bài đang phát.</p>
            </div>
          </fieldset>

          {(youtubeNow || externalNow || s.crossfadeBlocked) && (
            <p className="flex gap-2 text-xs text-amber-200/90 bg-amber-300/10 rounded-lg p-2.5">
              <Info className="w-4 h-4 flex-shrink-0" />
              {youtubeNow
                ? 'Bài đang phát từ YouTube nên không áp dụng được bộ chỉnh âm và chuyển bài mượt.'
                : externalNow
                ? 'Bài này phát từ nguồn ngoài không cho phép xử lý âm thanh, nên bộ chỉnh âm không áp dụng; chuyển bài mượt vẫn hoạt động.'
                : 'Chuyển bài mượt tạm tắt khi bạn đang theo phòng nghe chung.'}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
};

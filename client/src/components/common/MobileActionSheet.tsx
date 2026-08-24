import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  ListPlus,
  Heart,
  Share2,
  User,
  Disc,
  X,
  Check,
  ListMusic,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Song } from '../../types/index.js';
import { usePlayerStore } from '../../store/playerStore.js';
import { useAuthStore } from '../../store/authStore.js';
import { favoriteService } from '../../services/favorite.service.js';
import { AddToPlaylistModal } from './AddToPlaylistModal.js';

interface MobileActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
  queueContext?: Song[];
}

export const MobileActionSheet: React.FC<MobileActionSheetProps> = ({
  isOpen,
  onClose,
  song,
  queueContext,
}) => {
  const navigate = useNavigate();
  const { playSong, addToQueue, setLikedStatus } = usePlayerStore();
  const { isAuthenticated } = useAuthStore();
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!song) return null;

  const handlePlayNow = () => {
    playSong(song, queueContext);
    onClose();
  };

  const handlePlayNext = () => {
    addToQueue(song);
    onClose();
  };

  const handleToggleFavorite = async () => {
    if (!isAuthenticated) {
      navigate('/login');
      onClose();
      return;
    }

    try {
      const nextLiked = !song.isLiked;
      setLikedStatus(song.id, nextLiked);
      await favoriteService.toggleFavorite(song.id);
    } catch (e) {
      console.error(e);
    }
    onClose();
  };

  const handleShare = async () => {
    const shareData = {
      title: `${song.title} - ${song.artist?.name || 'MusicWave'}`,
      text: `Nghe "${song.title}" của ${song.artist?.name || 'Nghệ sĩ'} trên MusicWave`,
      url: window.location.origin + `/song/${song.id}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        onClose();
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareData.url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1500);
    } catch {
      onClose();
    }
  };

  const handleGoToArtist = () => {
    if (song.artist) {
      navigate(`/artist/${song.artist.id}`);
      onClose();
    }
  };

  const handleGoToAlbum = () => {
    if (song.album) {
      navigate(`/album/${song.album.id}`);
      onClose();
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="relative w-full max-w-md bg-[#13151f] border-t border-white/10 rounded-t-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl z-10 space-y-3.5 max-h-[85vh] overflow-y-auto"
            >
              {/* Pull handle indicator */}
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto" />

              {/* Song Header Preview */}
              <div className="flex items-center gap-3 pb-3 border-b border-white/[0.08]">
                <img
                  src={song.coverUrl}
                  alt={song.title}
                  className="w-11 h-11 rounded-lg object-cover border border-white/10 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-white truncate">{song.title}</h3>
                  <p className="text-xs text-text-muted truncate mt-0.5">
                    {song.artist?.name || 'Various Artists'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Action List */}
              <div className="space-y-1">
                <button
                  onClick={handlePlayNow}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-semibold text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors text-left touch-target"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-white">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                  <span>Phát bài hát</span>
                </button>

                <button
                  onClick={handlePlayNext}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-semibold text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors text-left touch-target"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-white">
                    <ListMusic className="w-4 h-4" />
                  </div>
                  <span>Phát tiếp theo</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    setShowAddToPlaylist(true);
                  }}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-semibold text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors text-left touch-target"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-white">
                    <ListPlus className="w-4 h-4" />
                  </div>
                  <span>Thêm vào playlist</span>
                </button>

                <button
                  onClick={handleToggleFavorite}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-semibold text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors text-left touch-target"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-rose-400">
                    <Heart className={`w-4 h-4 ${song.isLiked ? 'fill-current' : ''}`} />
                  </div>
                  <span>{song.isLiked ? 'Xóa khỏi bài hát yêu thích' : 'Thêm vào yêu thích'}</span>
                </button>

                <button
                  onClick={handleShare}
                  className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-semibold text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors text-left touch-target"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-white">
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
                  </div>
                  <span>{copied ? 'Đã sao chép liên kết!' : 'Chia sẻ bài hát'}</span>
                </button>

                {song.artist && (
                  <button
                    onClick={handleGoToArtist}
                    className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-semibold text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors text-left touch-target"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-white">
                      <User className="w-4 h-4" />
                    </div>
                    <span>Xem nghệ sĩ ({song.artist.name})</span>
                  </button>
                )}

                {song.album && (
                  <button
                    onClick={handleGoToAlbum}
                    className="w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-xs font-semibold text-white hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors text-left touch-target"
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-white">
                      <Disc className="w-4 h-4" />
                    </div>
                    <span>Xem album ({song.album.title})</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AddToPlaylistModal
        isOpen={showAddToPlaylist}
        onClose={() => setShowAddToPlaylist(false)}
        song={song}
      />
    </>
  );
};

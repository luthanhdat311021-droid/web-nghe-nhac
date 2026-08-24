import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, ListMusic } from 'lucide-react';
import { usePlayerStore, useCurrentSong } from '../../store/playerStore.js';
import { SongRow } from '../cards/SongRow.js';

export const QueueDrawer: React.FC = () => {
  const isQueueOpen = usePlayerStore((s) => s.isQueueOpen);
  const queue = usePlayerStore((s) => s.queue);
  const currentSong = useCurrentSong();
  const toggleQueue = usePlayerStore((s) => s.toggleQueue);
  const clearQueue = usePlayerStore((s) => s.clearQueue);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);

  if (!isQueueOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={toggleQueue}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Drawer Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-md h-full bg-background-surface border-l border-white/10 p-5 shadow-2xl flex flex-col z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-white" />
              <h3 className="font-bold text-base md:text-lg text-white">Danh sách phát</h3>
              <span className="text-xs text-text-muted">({queue.length})</span>
            </div>

            <div className="flex items-center gap-1">
              {queue.length > 0 && (
                <button
                  onClick={clearQueue}
                  aria-label="Xóa danh sách chờ"
                  className="p-2 rounded-lg text-text-muted hover:text-red-400 hover:bg-white/5 transition-colors"
                  title="Xóa danh sách chờ"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={toggleQueue}
                aria-label="Đóng danh sách phát"
                className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Current Song */}
          {currentSong && (
            <div className="py-4 border-b border-white/5 flex-shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">
                Now Playing
              </span>
              <SongRow song={currentSong} showAlbum={false} />
            </div>
          )}

          {/* Up Next List */}
          <div className="flex-1 overflow-y-auto py-3 space-y-1 pr-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2 block">
              Up Next
            </span>

            {queue.length === 0 ? (
              <p className="text-center text-xs text-text-muted py-10">
                Queue is empty. Add songs to play continuously!
              </p>
            ) : (
              queue.map((song, idx) => (
                <div key={`${song.id}-${idx}`} className="group relative">
                  <SongRow
                    song={song}
                    index={idx}
                    showAlbum={false}
                    onRemove={() => removeFromQueue(idx)}
                  />
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

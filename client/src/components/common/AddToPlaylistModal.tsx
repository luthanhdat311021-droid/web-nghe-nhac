import React, { useEffect, useState } from 'react';
import { Plus, Check, ListMusic } from 'lucide-react';
import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { Input } from './Input.js';
import { Playlist, Song } from '../../types/index.js';
import { playlistService } from '../../services/playlist.service.js';
import { useAuthStore } from '../../store/authStore.js';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  song,
}) => {
  const { isAuthenticated } = useAuthStore();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      loadPlaylists();
    }
  }, [isOpen, isAuthenticated]);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const list = await playlistService.getUserPlaylists();
      setPlaylists(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!song) return;
    try {
      await playlistService.addSong(playlistId, song.id);
      setAddedIds((prev) => ({ ...prev, [playlistId]: true }));
      setTimeout(() => {
        setAddedIds((prev) => ({ ...prev, [playlistId]: false }));
      }, 2000);
    } catch (e) {
      console.error('Failed to add song to playlist', e);
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !song) return;
    try {
      setCreating(true);
      const newPlaylist = await playlistService.createPlaylist({
        title: newTitle.trim(),
        coverUrl: song.coverUrl,
      });
      await playlistService.addSong(newPlaylist.id, song.id);
      setPlaylists([newPlaylist, ...playlists]);
      setAddedIds((prev) => ({ ...prev, [newPlaylist.id]: true }));
      setNewTitle('');
      setShowCreate(false);
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  if (!song) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thêm vào playlist" maxWidth="md">
      <div className="space-y-3.5">
        {/* Song preview */}
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
          <img
            src={song.coverUrl}
            alt={song.title}
            className="w-10 h-10 rounded-md object-cover"
          />
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-white truncate text-xs sm:text-sm">{song.title}</h4>
            <p className="text-xs text-text-muted truncate mt-0.5">{song.artist?.name}</p>
          </div>
        </div>

        {/* Create new playlist toggle */}
        {!showCreate ? (
          <Button
            onClick={() => setShowCreate(true)}
            variant="secondary"
            size="sm"
            className="w-full justify-center"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Tạo playlist mới
          </Button>
        ) : (
          <form onSubmit={handleCreateAndAdd} className="space-y-2.5 p-3 rounded-lg bg-white/[0.03] border border-white/10">
            <Input
              placeholder="Tên danh sách phát..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCreate(false)}
              >
                Hủy
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={creating}>
                Tạo và thêm
              </Button>
            </div>
          </form>
        )}

        {/* Playlists list */}
        <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
          {loading ? (
            <p className="text-center py-6 text-xs text-text-muted">Đang tải danh sách...</p>
          ) : playlists.length === 0 ? (
            <p className="text-center py-6 text-xs text-text-muted">Chưa có playlist nào. Hãy tạo mới!</p>
          ) : (
            playlists.map((pl) => {
              const isJustAdded = addedIds[pl.id];
              return (
                <div
                  key={pl.id}
                  onClick={() => handleAddToPlaylist(pl.id)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0 text-text-muted">
                      <ListMusic className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <h5 className="text-xs font-medium text-white truncate">
                        {pl.title}
                      </h5>
                      <span className="text-[11px] text-text-muted">
                        {pl._count?.songs ?? 0} bài
                      </span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={isJustAdded ? 'outline' : 'ghost'}
                    className={isJustAdded ? 'text-green-400 border-green-500/40' : ''}
                  >
                    {isJustAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
};

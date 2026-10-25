import React, { useState } from 'react';
import { Heart, History, ListMusic, Plus, Music2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore.js';
import { playlistService } from '../services/playlist.service.js';
import { favoriteService } from '../services/favorite.service.js';
import { historyService } from '../services/history.service.js';
import { Playlist, Song } from '../types/index.js';
import { SongRow } from '../components/cards/SongRow.js';
import { Modal } from '../components/common/Modal.js';
import { Button } from '../components/common/Button.js';
import { Input } from '../components/common/Input.js';
import { QUERY_KEYS, queryClient } from '../services/queryClient.js';
import { PlaylistCreateError } from '../components/common/PlaylistCreateError.js';
import { isProUser } from '../store/audioFxStore.js';
import { FREE_PLAYLIST_LIMIT } from '../services/playlist.service.js';

type TabType = 'all' | 'playlists' | 'favorites' | 'history';

export const Library: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  // Create Playlist Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<unknown>(null);
  useAuthStore((s) => s.user?.proExpiresAt);
  const limitedPlaylists = useAuthStore((s) => s.user?.role) !== 'ADMIN' && !isProUser();

  const { data: playlists = [] } = useQuery<Playlist[]>({
    queryKey: QUERY_KEYS.userPlaylists,
    queryFn: playlistService.getUserPlaylists,
    placeholderData: (prev) => prev,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  const { data: favoriteSongs = [] } = useQuery<Song[]>({
    queryKey: QUERY_KEYS.favorites,
    queryFn: favoriteService.getFavorites,
    placeholderData: (prev) => prev,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  const { data: historyData = [] } = useQuery({
    queryKey: QUERY_KEYS.history(15),
    queryFn: () => historyService.getHistory(15),
    placeholderData: (prev) => prev,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  const historySongs = historyData.map((h) => h.song);

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      setIsCreating(true);
      setCreateError(null);
      const newPl = await playlistService.createPlaylist({ title: newTitle.trim() });
      queryClient.setQueryData<Playlist[]>(QUERY_KEYS.userPlaylists, (old = []) => [newPl, ...old]);
      setNewTitle('');
      setShowCreateModal(false);
    } catch (e) {
      setCreateError(e);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center space-y-4">
        <div className="w-14 h-14 rounded-xl bg-white/[0.04] border border-white/10 mx-auto flex items-center justify-center text-text-muted">
          <Music2 className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white">Đăng nhập để xem Thư viện</h2>
        <p className="text-xs text-text-muted">
          Lưu bài hát yêu thích, tạo danh sách phát cá nhân và theo dõi lịch sử nghe nhạc của bạn.
        </p>
        <Link to="/login" className="inline-block pt-2">
          <Button variant="primary" size="md">
            Đăng nhập ngay
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-1">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Thư viện của bạn
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Danh sách phát, bài hát đã thích và lịch sử nghe
          </p>
        </div>

        <Button
          onClick={() => { setCreateError(null); setShowCreateModal(true); }}
          variant="secondary"
          size="sm"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
        >
          Tạo playlist
        </Button>
      </div>

      <Link
        to="/jam"
        className="flex items-center gap-3 rounded-2xl border border-emerald-300/20 bg-gradient-to-r from-emerald-400/15 to-cyan-500/5 p-4 active:scale-[0.99] transition-transform"
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-400 text-black flex items-center justify-center flex-shrink-0">
          <Users className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">Nghe chung</p>
          <p className="text-xs text-text-muted truncate">Tạo phòng, nghe cùng bạn bè theo thời gian thực</p>
        </div>
      </Link>

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
        {[
          { id: 'all', label: 'Tất cả' },
          { id: 'playlists', label: `Playlists (${playlists.length})` },
          { id: 'favorites', label: `Đã thích (${favoriteSongs.length})` },
          { id: 'history', label: 'Lịch sử nghe' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap active:scale-95 ${
              activeTab === tab.id
                ? 'bg-white text-black font-semibold'
                : 'bg-white/[0.04] text-text-secondary hover:text-white border border-white/[0.08]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Quick Nav Cards Grid (All Tab) */}
      {(activeTab === 'all' || activeTab === 'playlists') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-text-muted" />
              <span>Danh sách phát</span>
            </h2>
            {limitedPlaylists && (
              <Link to="/music-pro" className="text-xs text-amber-200 hover:text-amber-100 transition-colors">
                Free: {playlists.length}/{FREE_PLAYLIST_LIMIT} playlist · Pro không giới hạn
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Liked Songs Special Card */}
            <Link
              to="/favorites"
              className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:border-white/20 transition-all group active:scale-[0.98] flex flex-col justify-between min-h-[120px]"
            >
              <Heart className="w-6 h-6 text-rose-500 fill-current" />
              <div>
                <h3 className="font-bold text-sm text-white">Bài hát đã thích</h3>
                <p className="text-xs text-text-muted mt-0.5">{favoriteSongs.length} bài hát</p>
              </div>
            </Link>

            {/* User Playlists */}
            {playlists.map((pl) => (
              <Link
                key={pl.id}
                to={`/playlist/${pl.id}`}
                className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:border-white/15 transition-all group active:scale-[0.98] flex flex-col justify-between min-h-[120px]"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-text-secondary group-hover:text-white transition-colors">
                  <ListMusic className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white truncate">{pl.title}</h3>
                  <p className="text-xs text-text-muted mt-0.5">{pl._count?.songs ?? 0} bài hát</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Liked Songs Section */}
      {(activeTab === 'all' || activeTab === 'favorites') && favoriteSongs.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500 fill-current" />
              <span>Bài hát đã thích</span>
            </h2>
            <Link to="/favorites" className="text-xs text-text-muted hover:text-white transition-colors">
              Xem tất cả
            </Link>
          </div>

          <div className="space-y-0.5">
            {favoriteSongs.slice(0, 5).map((song, i) => (
              <SongRow key={song.id} song={song} index={i} queueContext={favoriteSongs} />
            ))}
          </div>
        </section>
      )}

      {/* Listening History Section */}
      {(activeTab === 'all' || activeTab === 'history') && historySongs.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-text-muted" />
              <span>Đã nghe gần đây</span>
            </h2>
            <Link to="/history" className="text-xs text-text-muted hover:text-white transition-colors">
              Xem tất cả
            </Link>
          </div>

          <div className="space-y-0.5">
            {historySongs.slice(0, 5).map((song, i) => (
              <SongRow key={song.id} song={song} index={i} queueContext={historySongs} />
            ))}
          </div>
        </section>
      )}

      {/* Create Playlist Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Tạo danh sách phát mới"
      >
        <form onSubmit={handleCreatePlaylist} className="space-y-4">
          <Input
            label="Tên danh sách phát"
            placeholder="e.g. Nhạc Chill, Top Hits..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
            required
          />
          <PlaylistCreateError error={createError} onUpgrade={() => setShowCreateModal(false)} />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowCreateModal(false)}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isCreating}>
              Tạo playlist
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

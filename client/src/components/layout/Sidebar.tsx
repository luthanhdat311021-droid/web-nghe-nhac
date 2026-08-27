import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import {
  Home,
  Compass,
  Search,
  Heart,
  History,
  Users,
  Disc,
  ListMusic,
  Plus,
  Shield,
  Radio,
  Music2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore.js';
import { playlistService } from '../../services/playlist.service.js';
import { Playlist } from '../../types/index.js';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Input } from '../common/Input.js';
import { QUERY_KEYS, queryClient } from '../../services/queryClient.js';
import { prefetchRoute } from '../../services/prefetch.js';

export const Sidebar: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [playlistTitle, setPlaylistTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { data: playlists = [] } = useQuery<Playlist[]>({
    queryKey: QUERY_KEYS.userPlaylists,
    queryFn: playlistService.getUserPlaylists,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 3,
  });

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistTitle.trim()) return;
    try {
      setIsCreating(true);
      const newPl = await playlistService.createPlaylist({ title: playlistTitle.trim() });
      queryClient.setQueryData<Playlist[]>(QUERY_KEYS.userPlaylists, (old = []) => [newPl, ...old]);
      setPlaylistTitle('');
      setShowCreateModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-colors duration-150 active:scale-[0.98] ${
      isActive
        ? 'bg-white/10 text-white font-bold'
        : 'text-text-secondary hover:text-white hover:bg-white/[0.04]'
    }`;

  return (
    <>
      <aside className="w-60 h-screen bg-[#0b0c12] border-r border-white/[0.07] flex flex-col flex-shrink-0 select-none pb-24 md:pb-28">
        {/* Brand Logo */}
        <div className="p-5 pb-3">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow ring-1 ring-white/15 group-hover:scale-105 transition-transform flex-shrink-0">
              <img src="/logo.png" alt="MusicWave" className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white">
                MusicWave
              </span>
            </div>
          </Link>
        </div>

        {/* Main Navigation links */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
          <div className="space-y-0.5">
            <NavLink to="/" end className={navItemClass}>
              <Home className="w-4 h-4" />
              <span>Trang chủ</span>
            </NavLink>
            <NavLink to="/search" className={navItemClass}>
              <Search className="w-4 h-4" />
              <span>Tìm kiếm</span>
            </NavLink>
            <NavLink
              to="/explore"
              className={navItemClass}
              onMouseEnter={() => prefetchRoute('explore', isAuthenticated)}
              onTouchStart={() => prefetchRoute('explore', isAuthenticated)}
            >
              <Compass className="w-4 h-4" />
              <span>Khám phá</span>
            </NavLink>
          </div>

          {/* Library Section */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-3 mb-1.5">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Thư viện
              </span>
              <NavLink
                to="/library"
                className="text-[10px] text-text-muted hover:text-white"
                onMouseEnter={() => prefetchRoute('library', isAuthenticated)}
                onTouchStart={() => prefetchRoute('library', isAuthenticated)}
              >
                Xem tất cả
              </NavLink>
            </div>
            <NavLink
              to="/favorites"
              className={navItemClass}
              onMouseEnter={() => prefetchRoute('favorites', isAuthenticated)}
              onTouchStart={() => prefetchRoute('favorites', isAuthenticated)}
            >
              <Heart className="w-4 h-4 text-rose-500" />
              <span>Bài hát đã thích</span>
            </NavLink>
            <NavLink
              to="/history"
              className={navItemClass}
              onMouseEnter={() => prefetchRoute('history', isAuthenticated)}
              onTouchStart={() => prefetchRoute('history', isAuthenticated)}
            >
              <History className="w-4 h-4" />
              <span>Đã nghe gần đây</span>
            </NavLink>
            <NavLink
              to="/artists"
              className={navItemClass}
              onMouseEnter={() => prefetchRoute('artists', isAuthenticated)}
              onTouchStart={() => prefetchRoute('artists', isAuthenticated)}
            >
              <Users className="w-4 h-4" />
              <span>Nghệ sĩ</span>
            </NavLink>
            <NavLink
              to="/albums"
              className={navItemClass}
              onMouseEnter={() => prefetchRoute('albums', isAuthenticated)}
              onTouchStart={() => prefetchRoute('albums', isAuthenticated)}
            >
              <Disc className="w-4 h-4" />
              <span>Album</span>
            </NavLink>
            {isAuthenticated && (
              <NavLink to="/contributions" className={navItemClass}>
                <Music2 className="w-4 h-4 text-text-secondary" />
                <span>Đóng góp của tôi</span>
              </NavLink>
            )}
          </div>

          {/* Playlists Section */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-3 mb-1.5">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Playlists
              </span>
              {isAuthenticated && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  aria-label="Tạo danh sách phát"
                  className="p-1 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {playlists.length === 0 ? (
              <p className="px-3 text-xs text-text-muted italic py-1">
                {isAuthenticated ? 'Chưa có playlist nào' : 'Đăng nhập để tạo playlist'}
              </p>
            ) : (
              <div className="space-y-0.5 max-h-40 overflow-y-auto pr-1">
                {playlists.map((pl) => (
                  <NavLink
                    key={pl.id}
                    to={`/playlist/${pl.id}`}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs truncate transition-colors ${
                        isActive
                          ? 'text-white font-bold bg-white/10'
                          : 'text-text-secondary hover:text-white hover:bg-white/[0.03]'
                      }`
                    }
                  >
                    <ListMusic className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
                    <span className="truncate">{pl.title}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>

          {/* Admin Dashboard Entry */}
          {user?.role === 'ADMIN' && (
            <div className="space-y-1 pt-2 border-t border-white/5">
              <span className="px-3 text-[11px] font-bold text-amber-400/90 uppercase tracking-wider block mb-1">
                Quản trị
              </span>
              <NavLink
                to="/admin"
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-amber-300 hover:bg-amber-400/10 transition-colors"
              >
                <Shield className="w-4 h-4" />
                Admin Dashboard
              </NavLink>
            </div>
          )}
        </div>
      </aside>

      {/* Create Playlist Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Tạo danh sách phát mới"
      >
        <form onSubmit={handleCreatePlaylist} className="space-y-4">
          <Input
            label="Tên danh sách phát"
            placeholder="e.g. Late Night Vibes"
            value={playlistTitle}
            onChange={(e) => setPlaylistTitle(e.target.value)}
            autoFocus
            required
          />
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
              Tạo Playlist
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
};

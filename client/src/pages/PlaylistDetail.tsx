import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Play, Shuffle, ListMusic, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Playlist } from '../types/index.js';
import { playlistService } from '../services/playlist.service.js';
import { usePlayerStore } from '../store/playerStore.js';
import { useFavoriteStore } from '../store/favoriteStore.js';
import { SongRow } from '../components/cards/SongRow.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Modal } from '../components/common/Modal.js';
import { Input } from '../components/common/Input.js';
import { Button } from '../components/common/Button.js';
import { HeaderHeroSkeleton, SongListSkeleton } from '../components/common/Skeleton.js';
import { QUERY_KEYS, queryClient } from '../services/queryClient.js';

export const PlaylistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { playSong } = usePlayerStore();

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPublic, setEditPublic] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { data: playlist, isLoading: loading } = useQuery<Playlist | null>({
    queryKey: QUERY_KEYS.playlistDetail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      const data = await playlistService.getPlaylistById(id);
      if (data?.songs) {
        useFavoriteStore.getState().syncLikedStatus(data.songs);
      }
      return data;
    },
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (playlist) {
      setEditTitle(playlist.title || '');
      setEditDesc(playlist.description || '');
      setEditPublic(playlist.isPublic !== false);
    }
  }, [playlist?.id]);

  const handlePlayAll = () => {
    if (playlist?.songs && playlist.songs.length > 0) {
      playSong(playlist.songs[0], playlist.songs);
    }
  };

  const handleShuffle = () => {
    if (playlist?.songs && playlist.songs.length > 0) {
      const randomIndex = Math.floor(Math.random() * playlist.songs.length);
      playSong(playlist.songs[randomIndex], playlist.songs);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editTitle.trim()) return;
    try {
      setIsSaving(true);
      const updated = await playlistService.updatePlaylist(id, {
        title: editTitle.trim(),
        description: editDesc.trim(),
        isPublic: editPublic,
      });
      queryClient.setQueryData(QUERY_KEYS.playlistDetail(id), (old: any) =>
        old ? { ...old, ...updated } : old
      );
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userPlaylists });
      setShowEditModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!id || !window.confirm('Bạn có chắc chắn muốn xóa danh sách phát này?')) return;
    try {
      await playlistService.deletePlaylist(id);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.userPlaylists });
      navigate('/library');
    } catch (e) {
      console.error(e);
    }
  };

  if (loading && !playlist) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <HeaderHeroSkeleton />
        <SongListSkeleton count={6} />
      </div>
    );
  }

  if (!playlist) {
    return <div className="text-center py-20 text-text-muted">Không tìm thấy Playlist.</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Mobile Back */}
      <button
        onClick={() => navigate(-1)}
        className="md:hidden flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> Quay lại
      </button>

      {/* Playlist Header */}
      <div className="flex flex-col md:flex-row items-center md:items-end gap-5 sm:gap-6 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
        <div className="relative w-36 h-36 xs:w-44 xs:h-44 md:w-48 md:h-48 rounded-xl overflow-hidden shadow border border-white/10 flex-shrink-0 bg-white/5 flex items-center justify-center">
          {playlist.coverUrl ? (
            <img
              src={playlist.coverUrl}
              alt={playlist.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <ListMusic className="w-14 h-14 text-text-muted" />
          )}
        </div>

        <div className="flex-1 space-y-2 text-center md:text-left min-w-0 w-full">
          <span className="text-[11px] font-bold tracking-wider text-text-muted uppercase">
            Danh sách phát
          </span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight break-words">
            {playlist.title}
          </h1>

          {playlist.description && (
            <p className="text-xs text-text-secondary line-clamp-2 max-w-xl">
              {playlist.description}
            </p>
          )}

          <p className="text-xs text-text-muted">
            {playlist.user?.username ? `Tạo bởi ${playlist.user.username} • ` : ''}
            {playlist.songs?.length || 0} bài hát
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-center md:justify-start gap-2.5 pt-2 flex-wrap">
            <button
              onClick={handlePlayAll}
              disabled={!playlist.songs || playlist.songs.length === 0}
              className="px-5 py-2 rounded-full bg-white text-black font-bold text-xs flex items-center gap-1.5 shadow hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Phát tất cả</span>
            </button>

            <button
              onClick={handleShuffle}
              disabled={!playlist.songs || playlist.songs.length === 0}
              className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 transition-colors active:scale-95 flex items-center gap-1.5"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Trộn bài</span>
            </button>

            <button
              onClick={() => setShowEditModal(true)}
              aria-label="Sửa playlist"
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-text-muted hover:text-white border border-white/10 transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>

            <button
              onClick={handleDeletePlaylist}
              aria-label="Xóa playlist"
              className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 text-text-muted hover:text-red-400 border border-white/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Song list */}
      <section className="space-y-1">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider px-1 pb-1">
          Danh sách bài hát ({playlist.songs?.length || 0})
        </h2>
        {playlist.songs && playlist.songs.length > 0 ? (
          <div className="space-y-0.5">
            {playlist.songs.map((song, idx) => (
              <SongRow
                key={song.id}
                song={song}
                index={idx}
                queueContext={playlist.songs}
                showAlbum={true}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Danh sách phát còn trống"
            description="Hãy thêm các bài hát yêu thích vào danh sách phát này để thưởng thức."
          />
        )}
      </section>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Chỉnh sửa danh sách phát"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <Input
            label="Tên danh sách phát"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            required
          />
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Mô tả
            </label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={3}
              placeholder="Thêm mô tả tùy chọn cho playlist này..."
              className="w-full rounded-xl bg-background-surface border border-white/10 px-4 py-2.5 text-xs text-text-primary outline-none focus:border-primary-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowEditModal(false)}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

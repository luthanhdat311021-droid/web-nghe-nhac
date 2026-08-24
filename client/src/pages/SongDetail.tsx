import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  Heart,
  Clock,
  Calendar,
  Disc,
  User,
  Mic2,
  ArrowLeft,
  ListPlus,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Song, Playlist } from '../types/index.js';
import { songService } from '../services/song.service.js';
import { playlistService } from '../services/playlist.service.js';
import { usePlayerStore, useCurrentSong, useIsPlaying } from '../store/playerStore.js';
import { useAuthStore } from '../store/authStore.js';
import { useFavoriteStore } from '../store/favoriteStore.js';
import { formatDuration, formatDate } from '../utils/format.js';
import { Button } from '../components/common/Button.js';
import { SongRow } from '../components/cards/SongRow.js';
import { Modal } from '../components/common/Modal.js';
import { HeaderHeroSkeleton, SongListSkeleton } from '../components/common/Skeleton.js';
import { QUERY_KEYS } from '../services/queryClient.js';

type SongDetailData = Song & {
  moreFromArtist?: Song[];
  recommended?: Song[];
};

export const SongDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentSong = useCurrentSong();
  const isPlaying = useIsPlaying();
  const playSong = usePlayerStore((s) => s.playSong);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const toggleLyrics = usePlayerStore((s) => s.toggleLyrics);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const isLiked = useFavoriteStore((s) => s.isLiked(id || '', false));
  const toggleFavoriteOptimistic = useFavoriteStore((s) => s.toggleFavoriteOptimistic);

  // Add to Playlist modal
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [addingToPlaylist, setAddingToPlaylist] = useState(false);

  const { data: song, isLoading } = useQuery<SongDetailData | null>({
    queryKey: QUERY_KEYS.songDetail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      const data = await songService.getSongById(id);
      if (data) {
        useFavoriteStore.getState().syncLikedStatus([
          data,
          ...(data.moreFromArtist || []),
          ...(data.recommended || []),
        ]);
      }
      return data;
    },
    placeholderData: (prev) => prev,
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  });


  const { data: userPlaylists = [] } = useQuery<Playlist[]>({
    queryKey: QUERY_KEYS.userPlaylists,
    queryFn: playlistService.getUserPlaylists,
    enabled: showAddToPlaylist && isAuthenticated,
    staleTime: 1000 * 60 * 2,
  });

  const isCurrent = currentSong?.id === song?.id;
  const isCurrentPlaying = isCurrent && isPlaying;

  const handlePlayClick = () => {
    if (!song) return;
    if (isCurrent) {
      togglePlay();
    } else {
      playSong(song, [song, ...(song.moreFromArtist || []), ...(song.recommended || [])]);
    }
  };

  const handleLikeClick = () => {
    if (!song || !isAuthenticated) return;
    toggleFavoriteOptimistic(song.id, isLiked);
  };

  const handleOpenAddToPlaylist = () => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setShowAddToPlaylist(true);
  };

  const handleAddSongToPlaylist = async (playlistId: string) => {
    if (!song) return;
    try {
      setAddingToPlaylist(true);
      await playlistService.addSong(playlistId, song.id);
      setShowAddToPlaylist(false);
    } catch (e) {
      console.error(e);
    } finally {
      setAddingToPlaylist(false);
    }
  };

  if (isLoading && !song) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <HeaderHeroSkeleton />
        <div className="space-y-2">
          <div className="h-5 bg-white/10 rounded w-44 animate-pulse" />
          <SongListSkeleton count={4} />
        </div>
      </div>
    );
  }

  if (!song) {
    return <div className="text-center py-20 text-text-muted">Không tìm thấy bài hát.</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Mobile Back */}
      <button
        onClick={() => navigate(-1)}
        className="md:hidden flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-white active:scale-95 transition-transform"
      >
        <ArrowLeft className="w-4 h-4" /> Quay lại
      </button>

      {/* Song Header */}
      <div className="flex flex-col md:flex-row items-center md:items-end gap-5 sm:gap-6 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
        {/* Cover Artwork */}
        <div className="relative w-36 h-36 xs:w-44 xs:h-44 md:w-48 md:h-48 rounded-xl overflow-hidden shadow border border-white/10 flex-shrink-0 bg-white/5">
          <img
            src={song.coverUrl}
            alt={song.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="flex-1 space-y-2 text-center md:text-left min-w-0 w-full">
          <span className="text-[11px] font-bold tracking-wider text-text-muted uppercase">
            Bài hát
          </span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight break-words">
            {song.title}
          </h1>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-text-secondary">
            {song.artist && (
              <Link
                to={`/artist/${song.artist.id}`}
                className="font-bold text-white hover:underline flex items-center gap-1"
              >
                <User className="w-3.5 h-3.5" />
                {song.artist.name}
              </Link>
            )}

            {song.album && (
              <Link
                to={`/album/${song.album.id}`}
                className="hover:text-white transition-colors flex items-center gap-1 text-text-muted"
              >
                <Disc className="w-3.5 h-3.5" />
                {song.album.title}
              </Link>
            )}

            <span className="flex items-center gap-1 text-text-muted">
              <Clock className="w-3.5 h-3.5" />
              {formatDuration(song.duration)}
            </span>

            <span className="flex items-center gap-1 text-text-muted">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(song.releaseDate)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center md:justify-start gap-2 pt-2 flex-wrap">
            <Button
              onClick={handlePlayClick}
              variant="primary"
              size="md"
              leftIcon={
                isCurrentPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )
              }
            >
              {isCurrentPlaying ? 'Tạm dừng' : 'Phát'}
            </Button>

            <Button
              onClick={handleLikeClick}
              variant="secondary"
              size="md"
              leftIcon={<Heart className={`w-4 h-4 ${isLiked ? 'text-rose-500 fill-current' : ''}`} />}
            >
              {isLiked ? 'Đã thích' : 'Thích'}
            </Button>

            <Button
              onClick={handleOpenAddToPlaylist}
              variant="secondary"
              size="md"
              leftIcon={<ListPlus className="w-4 h-4" />}
            >
              Thêm vào playlist
            </Button>

            <Button
              onClick={toggleLyrics}
              variant="ghost"
              size="md"
              leftIcon={<Mic2 className="w-4 h-4 text-text-muted" />}
            >
              Lời bài hát
            </Button>
          </div>
        </div>
      </div>

      {/* More From Artist */}
      {song.moreFromArtist && song.moreFromArtist.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider px-1">
            Bài hát khác của {song.artist?.name}
          </h2>
          <div className="space-y-0.5">
            {song.moreFromArtist.map((s, idx) => (
              <SongRow key={s.id} song={s} index={idx} queueContext={song.moreFromArtist} />
            ))}
          </div>
        </section>
      )}

      {/* Recommended */}
      {song.recommended && song.recommended.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider px-1">
            Có thể bạn sẽ thích
          </h2>
          <div className="space-y-0.5">
            {song.recommended.map((s, idx) => (
              <SongRow key={s.id} song={s} index={idx} queueContext={song.recommended} />
            ))}
          </div>
        </section>
      )}

      {/* Add To Playlist Modal */}
      <Modal
        isOpen={showAddToPlaylist}
        onClose={() => setShowAddToPlaylist(false)}
        title="Thêm vào danh sách phát"
      >
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {userPlaylists.length === 0 ? (
            <p className="text-xs text-text-muted italic py-4 text-center">
              Bạn chưa có danh sách phát nào. Hãy tạo playlist mới trước!
            </p>
          ) : (
            userPlaylists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => handleAddSongToPlaylist(pl.id)}
                disabled={addingToPlaylist}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-xs font-semibold text-white transition-colors text-left"
              >
                <span>{pl.title}</span>
                <span className="text-[11px] text-text-muted">{pl._count?.songs ?? 0} bài</span>
              </button>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};

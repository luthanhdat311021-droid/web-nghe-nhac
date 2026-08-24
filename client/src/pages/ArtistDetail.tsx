import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { BadgeCheck, Play, UserPlus, Check, Disc, Music2, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Artist } from '../types/index.js';
import { artistService } from '../services/artist.service.js';
import { usePlayerStore } from '../store/playerStore.js';
import { useAuthStore } from '../store/authStore.js';
import { useFavoriteStore } from '../store/favoriteStore.js';
import { formatNumber } from '../utils/format.js';
import { SongRow } from '../components/cards/SongRow.js';
import { AlbumCard } from '../components/cards/AlbumCard.js';
import { HeaderHeroSkeleton, SongListSkeleton } from '../components/common/Skeleton.js';
import { QUERY_KEYS, queryClient } from '../services/queryClient.js';

export const ArtistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playSong = usePlayerStore((s) => s.playSong);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const { data: artist, isLoading } = useQuery<Artist | null>({
    queryKey: QUERY_KEYS.artistDetail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      const data = await artistService.getArtistById(id);
      if (data?.songs) {
        useFavoriteStore.getState().syncLikedStatus(data.songs);
      }
      return data;
    },
    placeholderData: (prev) => prev,
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  });

  const [isFollowed, setIsFollowed] = useState(false);

  useEffect(() => {
    if (artist) {
      setIsFollowed(artist.isFollowed || false);
    }
  }, [artist?.id, artist?.isFollowed]);

  const handleFollowClick = async () => {
    if (!artist || !isAuthenticated) return;
    const prev = isFollowed;
    const next = !prev;
    setIsFollowed(next);

    try {
      const res = await artistService.toggleFollow(artist.id);
      if (res.isFollowed !== next) {
        setIsFollowed(res.isFollowed);
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.followedArtists });
    } catch (e) {
      console.warn('[MusicWave] Follow toggle failed:', e);
      setIsFollowed(prev);
    }
  };

  const handlePlayPopular = () => {
    if (artist?.songs && artist.songs.length > 0) {
      playSong(artist.songs[0], artist.songs);
    }
  };

  if (isLoading && !artist) {
    return (
      <div className="space-y-7 max-w-7xl mx-auto pb-12">
        <HeaderHeroSkeleton />
        <div className="space-y-3">
          <div className="h-5 bg-white/10 rounded w-40 animate-pulse" />
          <SongListSkeleton count={6} />
        </div>
      </div>
    );
  }

  if (!artist) {
    return <div className="text-center py-20 text-text-muted">Không tìm thấy nghệ sĩ.</div>;
  }

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-12">
      {/* Mobile Back */}
      <button
        onClick={() => navigate(-1)}
        className="md:hidden flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-white active:scale-95 transition-transform"
      >
        <ArrowLeft className="w-4 h-4" /> Quay lại
      </button>

      {/* Header Profile */}
      <div className="flex flex-col md:flex-row items-center md:items-end gap-5 sm:gap-6 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
        {/* Avatar */}
        <div className="relative w-28 h-28 xs:w-36 xs:h-36 md:w-40 md:h-40 rounded-full overflow-hidden shadow border-2 border-white/10 flex-shrink-0">
          <img
            src={artist.avatarUrl}
            alt={artist.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Info */}
        <div className="flex-1 text-center md:text-left min-w-0 space-y-2">
          <div className="flex items-center justify-center md:justify-start gap-1.5">
            <span className="text-[11px] font-bold tracking-wider text-text-muted uppercase">
              Nghệ sĩ
            </span>
            {artist.verified && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-400">
                <BadgeCheck className="w-3.5 h-3.5 fill-current" />
                Đã xác minh
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight truncate">
            {artist.name}
          </h1>

          <p className="text-xs sm:text-sm text-text-muted">
            {formatNumber(artist.monthlyListeners)} người nghe hàng tháng {artist.country ? `• ${artist.country}` : ''}
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-center md:justify-start gap-2.5 pt-2">
            <button
              onClick={handlePlayPopular}
              disabled={!artist.songs || artist.songs.length === 0}
              className="px-5 py-2 rounded-full bg-white text-black font-bold text-xs flex items-center gap-1.5 shadow hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Phát tất cả</span>
            </button>

            <button
              onClick={handleFollowClick}
              disabled={!isAuthenticated}
              className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all active:scale-95 flex items-center gap-1.5 ${
                isFollowed
                  ? 'bg-white/10 text-white border-white/15 hover:bg-white/15'
                  : 'bg-white/5 text-text-secondary hover:text-white border-white/10 hover:bg-white/10'
              }`}
            >
              {isFollowed ? (
                <>
                  <Check className="w-3.5 h-3.5 text-primary-400" />
                  <span>Đang theo dõi</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Theo dõi</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Popular Tracks Section */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Music2 className="w-4 h-4 text-primary-400" />
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
            Bài hát phổ biến
          </h2>
        </div>

        {artist.songs && artist.songs.length > 0 ? (
          <div className="space-y-0.5">
            {artist.songs.map((song, idx) => (
              <SongRow
                key={song.id}
                song={song}
                index={idx}
                queueContext={artist.songs}
                showAlbum={true}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted italic py-4">Chưa có bài hát nào của nghệ sĩ này.</p>
        )}
      </section>

      {/* Albums Section */}
      {artist.albums && artist.albums.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <Disc className="w-4 h-4 text-accent-emerald" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Danh sách Album
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {artist.albums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        </section>
      )}

      {/* Biography */}
      {artist.biography && (
        <section className="space-y-2 pt-2">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Tiểu sử</h2>
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed max-w-3xl p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            {artist.biography}
          </p>
        </section>
      )}
    </div>
  );
};

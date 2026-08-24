import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Play, Shuffle, Calendar, Disc, User, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Album } from '../types/index.js';
import { albumService } from '../services/album.service.js';
import { usePlayerStore } from '../store/playerStore.js';
import { useFavoriteStore } from '../store/favoriteStore.js';
import { formatDate } from '../utils/format.js';
import { SongRow } from '../components/cards/SongRow.js';
import { HeaderHeroSkeleton, SongListSkeleton } from '../components/common/Skeleton.js';
import { QUERY_KEYS } from '../services/queryClient.js';

export const AlbumDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playSong = usePlayerStore((s) => s.playSong);

  const { data: album, isLoading } = useQuery<Album | null>({
    queryKey: QUERY_KEYS.albumDetail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      const data = await albumService.getAlbumById(id);
      if (data?.songs) {
        useFavoriteStore.getState().syncLikedStatus(data.songs);
      }
      return data;
    },
    placeholderData: (prev) => prev,
    enabled: Boolean(id),
    staleTime: 1000 * 60 * 5,
  });

  const handlePlayAll = () => {
    if (album?.songs && album.songs.length > 0) {
      playSong(album.songs[0], album.songs);
    }
  };

  const handleShuffle = () => {
    if (album?.songs && album.songs.length > 0) {
      const randomIndex = Math.floor(Math.random() * album.songs.length);
      playSong(album.songs[randomIndex], album.songs);
    }
  };

  if (isLoading && !album) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        <HeaderHeroSkeleton />
        <div className="space-y-2">
          <div className="h-5 bg-white/10 rounded w-44 animate-pulse" />
          <SongListSkeleton count={6} />
        </div>
      </div>
    );
  }

  if (!album) {
    return <div className="text-center py-20 text-text-muted">Không tìm thấy Album.</div>;
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

      {/* Album Header */}
      <div className="flex flex-col md:flex-row items-center md:items-end gap-5 sm:gap-6 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
        <div className="relative w-36 h-36 xs:w-44 xs:h-44 md:w-48 md:h-48 rounded-xl overflow-hidden shadow border border-white/10 flex-shrink-0 bg-white/5">
          <img
            src={album.coverUrl}
            alt={album.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 space-y-2 text-center md:text-left min-w-0 w-full">
          <span className="text-[11px] font-bold tracking-wider text-text-muted uppercase">
            Album
          </span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight break-words">
            {album.title}
          </h1>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-text-secondary">
            {album.artist && (
              <Link
                to={`/artist/${album.artist.id}`}
                className="font-bold text-white hover:underline flex items-center gap-1"
              >
                <User className="w-3.5 h-3.5" />
                {album.artist.name}
              </Link>
            )}

            <span className="flex items-center gap-1 text-text-muted">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(album.releaseDate)}
            </span>

            <span className="flex items-center gap-1 text-text-muted">
              <Disc className="w-3.5 h-3.5" />
              {album.songs?.length || 0} bài hát
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center md:justify-start gap-2.5 pt-2">
            <button
              onClick={handlePlayAll}
              disabled={!album.songs || album.songs.length === 0}
              className="px-5 py-2 rounded-full bg-white text-black font-bold text-xs flex items-center gap-1.5 shadow hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>Phát tất cả</span>
            </button>

            <button
              onClick={handleShuffle}
              disabled={!album.songs || album.songs.length === 0}
              className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-white text-xs font-semibold border border-white/10 transition-colors active:scale-95 flex items-center gap-1.5"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>Trộn bài</span>
            </button>
          </div>
        </div>
      </div>

      {/* Song List */}
      <section className="space-y-1">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider px-1 pb-1">
          Danh sách bài hát ({album.songs?.length || 0})
        </h2>
        {album.songs && album.songs.length > 0 ? (
          <div className="space-y-0.5">
            {album.songs.map((song, idx) => (
              <SongRow
                key={song.id}
                song={song}
                index={idx}
                queueContext={album.songs}
                showAlbum={false}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted italic py-6">Album này chưa có bài hát nào.</p>
        )}
      </section>
    </div>
  );
};

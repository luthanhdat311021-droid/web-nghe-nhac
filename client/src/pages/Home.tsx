import React from 'react';
import { Play, Pause, TrendingUp, Music2, Disc, Users, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Song, Artist, Album } from '../types/index.js';
import { songService } from '../services/song.service.js';
import { artistService } from '../services/artist.service.js';
import { albumService } from '../services/album.service.js';
import { usePlayerStore, useCurrentSong, useIsPlaying } from '../store/playerStore.js';
import { useAuthStore } from '../store/authStore.js';
import { useFavoriteStore } from '../store/favoriteStore.js';
import { QUERY_KEYS } from '../services/queryClient.js';
import { SongRow } from '../components/cards/SongRow.js';
import { ArtistCard } from '../components/cards/ArtistCard.js';
import { AlbumCard } from '../components/cards/AlbumCard.js';
import { SongRowSkeleton, ArtistCardSkeleton, AlbumCardSkeleton } from '../components/common/Skeleton.js';

import {
  INITIAL_TRENDING_SONGS,
  INITIAL_RECOMMENDED_SONGS,
  INITIAL_TOP_CHARTS,
  INITIAL_ARTISTS,
  INITIAL_ALBUMS,
} from '../data/initialCatalog';

export const Home: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const currentSong = useCurrentSong();
  const isPlaying = useIsPlaying();
  const playSong = usePlayerStore((s) => s.playSong);
  const togglePlay = usePlayerStore((s) => s.togglePlay);

  // TanStack Query caching hooks with initialData for instant 0ms first render
  const { data: trendingSongs = [], isLoading: isTrendingLoading } = useQuery<Song[]>({
    queryKey: QUERY_KEYS.trendingSongs,
    queryFn: async () => {
      const data = await songService.getTrendingSongs();
      useFavoriteStore.getState().syncLikedStatus(data);
      return data;
    },
    initialData: INITIAL_TRENDING_SONGS,
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: recommendedSongs = [], isLoading: isRecommendedLoading } = useQuery<Song[]>({
    queryKey: QUERY_KEYS.recommendedSongs,
    queryFn: async () => {
      const data = await songService.getRecommendedSongs();
      useFavoriteStore.getState().syncLikedStatus(data);
      return data;
    },
    initialData: INITIAL_RECOMMENDED_SONGS,
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5,
  });

  const { data: topCharts = [], isLoading: isChartsLoading } = useQuery<Song[]>({
    queryKey: QUERY_KEYS.topCharts,
    queryFn: async () => {
      const data = await songService.getTopCharts();
      useFavoriteStore.getState().syncLikedStatus(data);
      return data;
    },
    initialData: INITIAL_TOP_CHARTS,
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5,
  });

  const { data: popularArtists = [], isLoading: isArtistsLoading } = useQuery<Artist[]>({
    queryKey: QUERY_KEYS.popularArtists,
    queryFn: async () => {
      const res = await artistService.getAllArtists({ limit: 6 });
      return res.items;
    },
    initialData: INITIAL_ARTISTS.slice(0, 6),
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  const { data: popularAlbums = [], isLoading: isAlbumsLoading } = useQuery<Album[]>({
    queryKey: QUERY_KEYS.popularAlbums,
    queryFn: async () => {
      const res = await albumService.getAllAlbums({ limit: 6 });
      return res.items;
    },
    initialData: INITIAL_ALBUMS.slice(0, 6),
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  // Time-based greeting (Good morning / afternoon / evening)
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  };

  const quickAccessItems = trendingSongs.slice(0, 6);

  const handleQuickPlay = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentSong?.id === song.id) {
      togglePlay();
    } else {
      playSong(song, trendingSongs);
    }
  };

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-12">
      {/* 1. Header & Dynamic Greeting */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight">
            {getGreeting()}{user ? `, ${user.username}` : ''}
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Khám phá những bản nhạc thịnh hành và được tuyển chọn cho bạn
          </p>
        </div>
      </div>

      {/* 2. Quick Access Cards */}
      {isTrendingLoading && quickAccessItems.length === 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white/[0.03] animate-pulse border border-white/[0.04]" />
          ))}
        </div>
      ) : quickAccessItems.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
          {quickAccessItems.map((song) => {
            const isThisPlaying = currentSong?.id === song.id && isPlaying;
            return (
              <div
                key={song.id}
                onClick={() => playSong(song, trendingSongs)}
                className={`group relative flex items-center gap-3 p-1.5 sm:p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition-all cursor-pointer border select-none active:scale-[0.98] ${
                  currentSong?.id === song.id
                    ? 'border-primary-500/40 bg-white/[0.07]'
                    : 'border-white/[0.05]'
                }`}
              >
                {/* Artwork */}
                <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 shadow">
                  <img
                    src={song.coverUrl}
                    alt={song.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1 pr-1">
                  <h4
                    className={`text-xs sm:text-sm font-bold truncate ${
                      currentSong?.id === song.id ? 'text-primary-400' : 'text-white'
                    }`}
                  >
                    {song.title}
                  </h4>
                  <p className="text-[11px] text-text-muted truncate mt-0.5">
                    {song.artist?.name || 'Various Artists'}
                  </p>
                </div>

                {/* Quick Play Button on Hover / Active */}
                <button
                  onClick={(e) => handleQuickPlay(song, e)}
                  aria-label={isThisPlaying ? 'Tạm dừng' : 'Phát bài hát'}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white hover:bg-neutral-200 text-black flex items-center justify-center shadow-lg transition-all flex-shrink-0 mr-1.5 active:scale-95 ${
                    currentSong?.id === song.id
                      ? 'opacity-100 scale-100'
                      : 'opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100'
                  }`}
                >
                  {isThisPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* 3. New Releases / Dành riêng cho bạn */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music2 className="w-4 h-4 text-text-secondary" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Bài hát mới & Đề xuất
            </h2>
          </div>
          <Link
            to="/explore"
            className="text-xs font-semibold text-text-muted hover:text-white transition-colors flex items-center gap-1"
          >
            <span>Tất cả</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isRecommendedLoading && recommendedSongs.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <SongRowSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5">
            {recommendedSongs.slice(0, 8).map((song, idx) => (
              <SongRow
                key={song.id}
                song={song}
                index={idx}
                queueContext={recommendedSongs}
                showAlbum={false}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Popular Artists */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-text-secondary" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Nghệ sĩ thịnh hành
            </h2>
          </div>
          <Link
            to="/artists"
            className="text-xs font-semibold text-text-muted hover:text-white transition-colors flex items-center gap-1"
          >
            <span>Xem thêm</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isArtistsLoading && popularArtists.length === 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <ArtistCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
            {popularArtists.map((artist) => (
              <ArtistCard key={artist.id} artist={artist} />
            ))}
          </div>
        )}
      </section>

      {/* 5. Top Charts */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-text-secondary" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Bảng xếp hạng hàng đầu
            </h2>
          </div>
        </div>

        {isChartsLoading && topCharts.length === 0 ? (
          <div className="space-y-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <SongRowSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {topCharts.slice(0, 5).map((song, index) => (
              <SongRow
                key={song.id}
                song={song}
                index={index}
                queueContext={topCharts}
                showAlbum={true}
              />
            ))}
          </div>
        )}
      </section>

      {/* 6. Featured Albums */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Disc className="w-4 h-4 text-text-secondary" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Album nổi bật
            </h2>
          </div>
          <Link
            to="/albums"
            className="text-xs font-semibold text-text-muted hover:text-white transition-colors flex items-center gap-1"
          >
            <span>Xem tất cả</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {isAlbumsLoading && popularAlbums.length === 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <AlbumCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {popularAlbums.map((album) => (
              <AlbumCard key={album.id} album={album} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

import React from 'react';
import { Heart, Play, Shuffle, Music2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Song } from '../types/index.js';
import { favoriteService } from '../services/favorite.service.js';
import { useAuthStore } from '../store/authStore.js';
import { usePlayerStore } from '../store/playerStore.js';
import { useFavoriteStore } from '../store/favoriteStore.js';
import { SongRow } from '../components/cards/SongRow.js';
import { Button } from '../components/common/Button.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { SongListSkeleton } from '../components/common/Skeleton.js';
import { QUERY_KEYS, queryClient } from '../services/queryClient.js';

export const Favorites: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const playSong = usePlayerStore((s) => s.playSong);

  const { data: favorites = [], isLoading } = useQuery<Song[]>({
    queryKey: QUERY_KEYS.favorites,
    queryFn: async () => {
      const data = await favoriteService.getFavorites();
      useFavoriteStore.getState().syncLikedStatus(data);
      return data;
    },
    placeholderData: (prev) => prev,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  const handlePlayAll = () => {
    if (favorites.length > 0) {
      playSong(favorites[0], favorites);
    }
  };

  const handleShuffle = () => {
    if (favorites.length > 0) {
      const randomIndex = Math.floor(Math.random() * favorites.length);
      playSong(favorites[randomIndex], favorites);
    }
  };

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon={<Heart className="w-6 h-6 text-rose-500 fill-current" />}
        title="Đăng nhập để xem bài hát đã thích"
        description="Lưu giữ các bài hát yêu thích để nghe lại bất kỳ lúc nào."
        actionText="Đăng nhập"
        onAction={() => navigate('/login')}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center md:items-end gap-5 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center flex-shrink-0">
          <Heart className="w-10 h-10 text-rose-500 fill-current" />
        </div>

        <div className="flex-1 space-y-2 text-center md:text-left min-w-0 w-full">
          <span className="text-[11px] font-bold tracking-wider text-text-muted uppercase">
            Bộ sưu tập
          </span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
            Bài hát đã thích
          </h1>
          <p className="text-xs text-text-muted">
            {favorites.length} bài hát đã lưu
          </p>

          {favorites.length > 0 && (
            <div className="flex items-center justify-center md:justify-start gap-2 pt-2 flex-wrap">
              <Button
                onClick={handlePlayAll}
                variant="primary"
                size="md"
                leftIcon={<Play className="w-4 h-4 fill-current ml-0.5" />}
              >
                Phát tất cả
              </Button>
              <Button
                onClick={handleShuffle}
                variant="secondary"
                size="md"
                leftIcon={<Shuffle className="w-4 h-4" />}
              >
                Trộn bài
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Song List */}
      <div className="space-y-1">
        {isLoading && favorites.length === 0 ? (
          <SongListSkeleton count={6} />
        ) : favorites.length > 0 ? (
          <div className="space-y-0.5">
            {favorites.map((song, idx) => (
              <SongRow
                key={song.id}
                song={song}
                index={idx}
                queueContext={favorites}
                onRemove={() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.favorites })}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Music2 className="w-8 h-8 text-text-muted" />}
            title="Chưa có bài hát yêu thích nào"
            description="Nhấn vào biểu tượng trái tim ở bất kỳ bài hát nào để lưu vào đây."
            actionText="Khám phá ngay"
            onAction={() => navigate('/')}
          />
        )}
      </div>
    </div>
  );
};

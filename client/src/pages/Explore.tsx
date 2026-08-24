import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Genre, Song } from '../types/index.js';
import { adminService } from '../services/admin.service.js';
import { songService } from '../services/song.service.js';
import { useAuthStore } from '../store/authStore.js';
import { useFavoriteStore } from '../store/favoriteStore.js';
import { SongRow } from '../components/cards/SongRow.js';
import { Button } from '../components/common/Button.js';
import { AddSongModal } from '../components/song/AddSongModal.js';
import { AuthRequiredModal } from '../components/common/AuthRequiredModal.js';
import { SongListSkeleton } from '../components/common/Skeleton.js';
import { QUERY_KEYS, queryClient } from '../services/queryClient.js';

import { INITIAL_GENRES, INITIAL_TRENDING_SONGS } from '../data/initialCatalog';

export const Explore: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Modals
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Fetch Genres with initialData and long cache
  const { data: genres = [] } = useQuery<Genre[]>({
    queryKey: QUERY_KEYS.genres,
    queryFn: adminService.getAllGenres,
    initialData: INITIAL_GENRES,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  // Fetch songs with TanStack Query
  const { data: songsData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.allSongs({ page, limit: 16, genre: selectedGenre }),
    queryFn: async () => {
      const res = await songService.getAllSongs({
        page,
        limit: 16,
        genre: selectedGenre || undefined,
      });
      if (res?.items) {
        useFavoriteStore.getState().syncLikedStatus(res.items);
      }
      return res;
    },
    initialData:
      !selectedGenre && page === 1
        ? {
            items: INITIAL_TRENDING_SONGS,
            pagination: { page: 1, limit: 16, total: INITIAL_TRENDING_SONGS.length, totalPages: 1 },
          }
        : undefined,
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5,
  });

  const songs = songsData?.items || [];
  const totalPages = songsData?.pagination?.totalPages || 1;

  const handleAddSongClick = () => {
    if (isAuthenticated) {
      setIsAddSongOpen(true);
    } else {
      setIsAuthModalOpen(true);
    }
  };

  const handleSongCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['songs'] });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Khám phá âm nhạc
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            Duyệt theo thể loại và các bài hát mới nhất
          </p>
        </div>

        <Button
          onClick={handleAddSongClick}
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          className="self-start sm:self-auto flex-shrink-0"
        >
          + Thêm bài hát
        </Button>
      </div>

      {/* Genre Filter Chips */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 -mx-3.5 px-3.5 sm:mx-0 sm:px-0 sm:flex-wrap">
          <button
            onClick={() => {
              setSelectedGenre(null);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap active:scale-95 ${
              selectedGenre === null
                ? 'bg-white text-black font-semibold'
                : 'bg-white/[0.04] text-text-secondary hover:text-white border border-white/[0.08]'
            }`}
          >
            Tất cả
          </button>
          {genres.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                setSelectedGenre(g.slug);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap active:scale-95 ${
                selectedGenre === g.slug
                  ? 'bg-white text-black font-semibold'
                  : 'bg-white/[0.04] text-text-secondary hover:text-white border border-white/[0.08]'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* Songs High Density List */}
      <div className="space-y-2">
        {isLoading && songs.length === 0 ? (
          <SongListSkeleton count={8} />
        ) : songs.length === 0 ? (
          <div className="text-center py-16 text-text-muted text-xs">
            Không tìm thấy bài hát nào thuộc thể loại này.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-0.5">
            {songs.map((song: Song, idx: number) => (
              <SongRow
                key={song.id}
                song={song}
                index={(page - 1) * 16 + idx}
                queueContext={songs}
                showAlbum={false}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-6">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Prev
            </Button>
            <span className="text-xs font-mono text-text-muted px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Add Song Modal */}
      <AddSongModal
        isOpen={isAddSongOpen}
        onClose={() => setIsAddSongOpen(false)}
        onSuccess={handleSongCreated}
      />

      {/* Auth Prompt Modal */}
      <AuthRequiredModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Bạn cần đăng nhập để thêm bài hát."
        description="Đăng nhập hoặc đăng ký tài khoản để đóng góp các bài hát mới cho cộng đồng MusicWave."
      />
    </div>
  );
};

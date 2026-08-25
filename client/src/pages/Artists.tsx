import React, { useState } from 'react';
import { Search as SearchIcon, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Artist } from '../types/index.js';
import { artistService } from '../services/artist.service.js';
import { useAuthStore } from '../store/authStore.js';
import { ArtistCard } from '../components/cards/ArtistCard.js';
import { Button } from '../components/common/Button.js';
import { AddArtistModal } from '../components/artist/AddArtistModal.js';
import { AuthRequiredModal } from '../components/common/AuthRequiredModal.js';
import { ArtistCardSkeleton } from '../components/common/Skeleton.js';
import { QUERY_KEYS, queryClient } from '../services/queryClient.js';

import { INITIAL_ARTISTS } from '../data/initialCatalog';

export const Artists: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'latest' | 'az'>('popular');
  const [page, setPage] = useState(1);

  // Modals
  const [isAddArtistOpen, setIsAddArtistOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const { data: artistsData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.allArtists({ search: search.trim() || undefined, sort: sortBy, page, limit: 18 }),
    queryFn: () =>
      artistService.getAllArtists({
        search: search.trim() || undefined,
        sort: sortBy,
        page,
        limit: 18,
      }),
    placeholderData: (prev) => prev,
  });

  const artists = artistsData?.items || [];
  const totalPages = artistsData?.pagination?.totalPages || 1;

  const handleAddArtistClick = () => {
    if (isAuthenticated) {
      setIsAddArtistOpen(true);
    } else {
      setIsAuthModalOpen(true);
    }
  };

  const handleArtistCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['artists'] });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Nghệ sĩ
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Khám phá các ca sĩ và nhà sản xuất âm nhạc
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as any);
              setPage(1);
            }}
            className="h-10 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white outline-none focus:border-white/20 transition-colors cursor-pointer"
          >
            <option value="popular" className="bg-[#181a20] text-white">Thịnh hành nhất</option>
            <option value="latest" className="bg-[#181a20] text-white">Mới nhất (Vừa thêm)</option>
            <option value="az" className="bg-[#181a20] text-white">Theo tên (A-Z)</option>
          </select>

          <div className="relative flex-1 md:w-60">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Tìm nghệ sĩ..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-text-muted outline-none focus:border-white/20 transition-colors"
            />
          </div>

          <Button
            onClick={handleAddArtistClick}
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            className="flex-shrink-0"
          >
            + Thêm nghệ sĩ
          </Button>
        </div>
      </div>

      {/* Grid */}
      {isLoading && artists.length === 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <ArtistCardSkeleton key={i} />
          ))}
        </div>
      ) : artists.length > 0 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {artists.map((artist: Artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      ) : (
        <p className="text-center py-20 text-text-muted text-xs">Không tìm thấy nghệ sĩ nào.</p>
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

      {/* Add Artist Modal */}
      <AddArtistModal
        isOpen={isAddArtistOpen}
        onClose={() => setIsAddArtistOpen(false)}
        onSuccess={handleArtistCreated}
      />

      {/* Auth Prompt Modal */}
      <AuthRequiredModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Bạn cần đăng nhập để thêm nghệ sĩ."
        description="Đăng nhập hoặc đăng ký tài khoản để đóng góp nghệ sĩ mới cho cộng đồng MusicWave."
      />
    </div>
  );
};

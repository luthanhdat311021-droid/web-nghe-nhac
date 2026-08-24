import React, { useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Album } from '../types/index.js';
import { albumService } from '../services/album.service.js';
import { AlbumCard } from '../components/cards/AlbumCard.js';
import { Button } from '../components/common/Button.js';
import { AlbumCardSkeleton } from '../components/common/Skeleton.js';
import { QUERY_KEYS } from '../services/queryClient.js';

import { INITIAL_ALBUMS } from '../data/initialCatalog';

export const Albums: React.FC = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: albumsData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.allAlbums({ search: search.trim() || undefined, page, limit: 18 }),
    queryFn: () =>
      albumService.getAllAlbums({
        search: search.trim() || undefined,
        page,
        limit: 18,
      }),
    initialData:
      !search.trim() && page === 1
        ? {
            items: INITIAL_ALBUMS,
            pagination: { page: 1, limit: 18, total: INITIAL_ALBUMS.length, totalPages: 1 },
          }
        : undefined,
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 5,
  });

  const albums = albumsData?.items || [];
  const totalPages = albumsData?.pagination?.totalPages || 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-white/5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Album tuyển chọn
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Duyệt các album đầy đủ và tuyển tập nhạc mới
          </p>
        </div>

        <div className="relative w-full md:w-64">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Tìm album..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-text-muted outline-none focus:border-white/20"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading && albums.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <AlbumCardSkeleton key={i} />
          ))}
        </div>
      ) : albums.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {albums.map((album: Album) => (
            <AlbumCard key={album.id} album={album} />
          ))}
        </div>
      ) : (
        <p className="text-center py-20 text-text-muted text-xs">Không tìm thấy album nào.</p>
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
  );
};

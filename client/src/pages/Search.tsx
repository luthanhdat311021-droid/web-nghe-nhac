import React, { useState, useEffect } from 'react';
import {
  Search as SearchIcon,
  Music2,
  Users,
  Disc,
  ListMusic,
  Loader2,
  X,
  ArrowLeft,
  SlidersHorizontal,
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { searchService, SearchResults } from '../services/search.service.js';
import { SongRow } from '../components/cards/SongRow.js';
import { ArtistCard } from '../components/cards/ArtistCard.js';
import { AlbumCard } from '../components/cards/AlbumCard.js';
import { PlaylistCard } from '../components/cards/PlaylistCard.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { SongRowSkeleton, ArtistCardSkeleton, AlbumCardSkeleton } from '../components/common/Skeleton.js';
import { useFavoriteStore } from '../store/favoriteStore.js';
import { searchHistoryUtil } from '../utils/searchHistory.js';
import { QUERY_KEYS } from '../services/queryClient.js';

type TabType = 'all' | 'songs' | 'artists' | 'albums' | 'playlists';
type SortOption = 'relevance' | 'popular' | 'newest';

export const Search: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const [query, setQuery] = useState(queryParam);
  const [debouncedQuery, setDebouncedQuery] = useState(queryParam);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [sortBy, setSortBy] = useState<SortOption>('relevance');

  useEffect(() => {
    setQuery(queryParam);
    setDebouncedQuery(queryParam);
  }, [queryParam]);

  // Debounce search input (200ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
      if (query.trim()) {
        searchHistoryUtil.addSearch(query.trim());
      }
    }, 200);

    return () => clearTimeout(handler);
  }, [query]);

  // React Query smart search with cache and stale-while-revalidate
  const { data: results, isFetching: loading } = useQuery<SearchResults | null>({
    queryKey: QUERY_KEYS.search(debouncedQuery, activeTab),
    queryFn: async ({ signal }) => {
      const res = await searchService.search(
        debouncedQuery,
        activeTab === 'all' ? undefined : (activeTab as any),
        undefined,
        signal
      );
      if (res?.songs) {
        useFavoriteStore.getState().syncLikedStatus(res.songs);
      }
      return res;
    },
    enabled: Boolean(debouncedQuery),
    placeholderData: (prev) => prev,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  // Default explore state when query is empty
  const { data: emptyDefault } = useQuery<SearchResults | null>({
    queryKey: ['search', 'default_explore'],
    queryFn: async () => {
      return searchService.search('');
    },
    enabled: !debouncedQuery,
    staleTime: 1000 * 60 * 10,
  });

  const displayResults = debouncedQuery ? results : emptyDefault;

  // Client-side sorting for songs
  const sortedSongs = React.useMemo(() => {
    if (!displayResults?.songs) return [];
    const songs = [...displayResults.songs];
    if (sortBy === 'popular') {
      return songs.sort((a, b) => (b.playsCount || 0) - (a.playsCount || 0));
    }
    if (sortBy === 'newest') {
      return songs.sort(
        (a, b) => new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime()
      );
    }
    return songs;
  }, [displayResults?.songs, sortBy]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    if (value.trim()) {
      setSearchParams({ q: value });
    } else {
      setSearchParams({});
    }
  };

  const handleClear = () => {
    setQuery('');
    setDebouncedQuery('');
    setSearchParams({});
  };

  const hasResults =
    displayResults &&
    (displayResults.songs.length > 0 ||
      displayResults.artists.length > 0 ||
      displayResults.albums.length > 0 ||
      displayResults.playlists.length > 0);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12">
      {/* Search Input Bar */}
      <div className="flex items-center gap-2 max-w-3xl">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="md:hidden p-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-white flex-shrink-0 touch-target flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="relative flex-1">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Tìm kiếm bài hát, ca sĩ, album, tâm trạng..."
            value={query}
            onChange={handleInputChange}
            autoFocus
            className="w-full h-11 sm:h-12 pl-11 pr-11 rounded-xl bg-white/[0.05] border border-white/[0.08] focus:border-white/20 focus:bg-white/[0.08] text-sm text-white placeholder-text-muted transition-all outline-none"
          />
          {loading ? (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted animate-spin" />
          ) : query ? (
            <button
              onClick={handleClear}
              aria-label="Clear search"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-text-muted hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Context Badge when semantic understanding is active */}
      {debouncedQuery && displayResults?.explanation && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/5 text-text-secondary">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">{displayResults.explanation}</p>
              <p className="text-[11px] text-text-muted">
                Đề xuất phù hợp từ danh mục âm nhạc MusicWave
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Filter & Sort Controls */}
      {debouncedQuery && (
        <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-2.5 overflow-x-auto no-scrollbar -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          <div className="flex items-center gap-2 flex-shrink-0">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'songs', label: 'Bài hát' },
              { id: 'artists', label: 'Nghệ sĩ' },
              { id: 'albums', label: 'Album' },
              { id: 'playlists', label: 'Danh sách phát' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap active:scale-95 touch-target ${
                  activeTab === tab.id
                    ? 'bg-white text-black font-bold shadow'
                    : 'text-text-secondary hover:text-white bg-white/5 border border-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0 text-xs text-text-muted">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-transparent text-xs text-text-secondary hover:text-white outline-none cursor-pointer"
            >
              <option value="relevance" className="bg-[#11131a] text-white">
                Độ liên quan
              </option>
              <option value="popular" className="bg-[#11131a] text-white">
                Phổ biến nhất
              </option>
              <option value="newest" className="bg-[#11131a] text-white">
                Mới nhất
              </option>
            </select>
          </div>
        </div>
      )}

      {/* Initial Explore / Genres Browse when query is empty */}
      {!debouncedQuery && displayResults?.genres && (
        <div className="space-y-6 pt-1">
          <div>
            <h2 className="text-base font-bold text-white mb-3">Khám phá thể loại</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
              {displayResults.genres.map((g) => (
                <div
                  key={g.id}
                  onClick={() => {
                    setQuery(g.name);
                    setDebouncedQuery(g.name);
                    setSearchParams({ q: g.name });
                  }}
                  className="p-3.5 sm:p-4 rounded-xl cursor-pointer transition-all active:scale-[0.98] hover:bg-white/[0.08] border border-white/[0.06] relative overflow-hidden bg-white/[0.03]"
                >
                  <div
                    className="w-1 h-full absolute left-0 top-0 opacity-70"
                    style={{ backgroundColor: g.color || '#8b5cf6' }}
                  />
                  <h3 className="font-bold text-sm text-white">{g.name}</h3>
                  <p className="text-[11px] text-text-muted mt-0.5">Thể loại</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {debouncedQuery && !loading && !hasResults && (
        <EmptyState
          title={`MusicWave chưa có nội dung phù hợp cho "${debouncedQuery}"`}
          description="Thử tìm kiếm tên bài hát, nghệ sĩ hoặc các từ khóa như 'nhạc chill', 'lo-fi', 'synthwave'..."
        />
      )}

      {/* Results List */}
      {debouncedQuery && displayResults && (
        <div className="space-y-6">
          {/* Top Songs */}
          {(activeTab === 'all' || activeTab === 'songs') && sortedSongs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Music2 className="w-4 h-4 text-primary-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    {displayResults.isRecommendation ? 'Bài hát đề xuất' : 'Bài hát'}
                  </h3>
                </div>
                <span className="text-[11px] text-text-muted font-medium">
                  {sortedSongs.length} bài hát
                </span>
              </div>
              <div className="space-y-0.5">
                {sortedSongs.map((song, idx) => (
                  <SongRow
                    key={song.id}
                    song={song}
                    index={idx}
                    queueContext={sortedSongs}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Artists */}
          {(activeTab === 'all' || activeTab === 'artists') && displayResults.artists.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-accent-cyan" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Nghệ sĩ</h3>
              </div>
              <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                {displayResults.artists.map((artist) => (
                  <ArtistCard key={artist.id} artist={artist} />
                ))}
              </div>
            </div>
          )}

          {/* Albums */}
          {(activeTab === 'all' || activeTab === 'albums') && displayResults.albums.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <Disc className="w-4 h-4 text-accent-emerald" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Album</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {displayResults.albums.map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))}
              </div>
            </div>
          )}

          {/* Playlists */}
          {(activeTab === 'all' || activeTab === 'playlists') && displayResults.playlists.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-accent-amber" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Danh sách phát</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {displayResults.playlists.map((playlist) => (
                  <PlaylistCard key={playlist.id} playlist={playlist} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

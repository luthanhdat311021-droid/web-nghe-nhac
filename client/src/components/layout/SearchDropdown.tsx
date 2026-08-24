import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Trash2,
  TrendingUp,
  Play,
  Pause,
  BadgeCheck,
  Disc,
  ListMusic,
  ArrowRight,
  Search,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { SearchResults, TrendingResponse, searchService } from '../../services/search.service.js';
import { searchHistoryUtil } from '../../utils/searchHistory.js';
import { usePlayerStore, useCurrentSong, useIsPlaying } from '../../store/playerStore.js';
import { formatDuration, formatNumber } from '../../utils/format.js';
import { Song } from '../../types/index.js';
import { QUERY_KEYS } from '../../services/queryClient.js';

interface SearchDropdownProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  onSelectQuery: (q: string) => void;
  selectedIndex: number;
}

export const SearchDropdown: React.FC<SearchDropdownProps> = ({
  query,
  isOpen,
  onClose,
  onSelectQuery,
}) => {
  const navigate = useNavigate();
  const currentSong = useCurrentSong();
  const isPlaying = useIsPlaying();
  const playSong = usePlayerStore((s) => s.playSong);
  const resume = usePlayerStore((s) => s.resume);

  const [history, setHistory] = useState<string[]>([]);
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Load history when opened
  useEffect(() => {
    if (isOpen) {
      setHistory(searchHistoryUtil.getHistory());
    }
  }, [isOpen]);

  // Debounce typing (150ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 150);
    return () => clearTimeout(handler);
  }, [query]);

  // Fetch trending queries with React Query cache (5 mins)
  const { data: trending } = useQuery<TrendingResponse>({
    queryKey: QUERY_KEYS.searchTrending,
    queryFn: searchService.getTrending,
    enabled: isOpen && !debouncedQuery,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch fast suggestions with React Query cache
  const { data: results, isFetching: loading } = useQuery<SearchResults | null>({
    queryKey: QUERY_KEYS.searchSuggestions(debouncedQuery),
    queryFn: ({ signal }) => searchService.getSuggestions(debouncedQuery, 8),
    enabled: isOpen && Boolean(debouncedQuery),
    staleTime: 1000 * 60 * 2,
    placeholderData: (prev) => prev,
  });

  if (!isOpen) return null;

  const handleRemoveHistory = (e: React.MouseEvent, item: string) => {
    e.stopPropagation();
    const updated = searchHistoryUtil.removeSearch(item);
    setHistory(updated);
  };

  const handleClearAllHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    searchHistoryUtil.clearAll();
    setHistory([]);
  };

  const handleSongClick = (song: Song) => {
    searchHistoryUtil.addSearch(song.title);
    if (currentSong?.id === song.id) {
      if (!isPlaying) resume();
    } else {
      playSong(song, results?.songs || [song]);
    }
    onClose();
  };

  const handleArtistClick = (artistId: string, artistName: string) => {
    searchHistoryUtil.addSearch(artistName);
    onClose();
    navigate(`/artist/${artistId}`);
  };

  const handleAlbumClick = (albumId: string, albumTitle: string) => {
    searchHistoryUtil.addSearch(albumTitle);
    onClose();
    navigate(`/album/${albumId}`);
  };

  const handlePlaylistClick = (playlistId: string, playlistTitle: string) => {
    searchHistoryUtil.addSearch(playlistTitle);
    onClose();
    navigate(`/playlist/${playlistId}`);
  };

  const handleViewAll = () => {
    if (query.trim()) {
      searchHistoryUtil.addSearch(query.trim());
      onClose();
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const hasSuggestions =
    results &&
    (results.songs.length > 0 ||
      results.artists.length > 0 ||
      results.albums.length > 0 ||
      results.playlists.length > 0);

  return (
    <div
      className="absolute left-0 right-0 top-full mt-2 rounded-2xl bg-[#11131a]/95 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/80 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150"
      onMouseDown={(e) => e.preventDefault()} // Prevents input blur on click
    >
      <div className="max-h-[75vh] overflow-y-auto no-scrollbar p-3 space-y-4">
        {/* ========================================== */}
        {/* EMPTY STATE: RECENT SEARCHES & TRENDING    */}
        {/* ========================================== */}
        {!query.trim() && (
          <div className="space-y-4">
            {/* Recent Searches */}
            {history.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-2 text-xs font-semibold text-text-muted">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                    <Clock className="w-3.5 h-3.5" />
                    Tìm kiếm gần đây
                  </span>
                  <button
                    onClick={handleClearAllHistory}
                    className="text-[11px] text-text-muted hover:text-red-400 transition-colors"
                  >
                    Xóa tất cả
                  </button>
                </div>
                <div className="space-y-0.5">
                  {history.map((item) => (
                    <div
                      key={item}
                      onClick={() => onSelectQuery(item)}
                      className="group flex items-center justify-between px-3 py-2 rounded-xl hover:bg-white/[0.06] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2.5 text-xs text-text-secondary group-hover:text-white truncate">
                        <Clock className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                        <span className="truncate">{item}</span>
                      </div>
                      <button
                        onClick={(e) => handleRemoveHistory(e, item)}
                        className="p-1 rounded-lg text-text-muted hover:text-white hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                        aria-label="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trending & Popular Queries */}
            {trending && trending.trendingQueries.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-white/5">
                <div className="flex items-center gap-1.5 px-2 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  <TrendingUp className="w-3.5 h-3.5 text-primary-400" />
                  Tìm kiếm phổ biến
                </div>
                <div className="flex flex-wrap gap-2 px-1">
                  {trending.trendingQueries.map((tq) => (
                    <button
                      key={tq}
                      onClick={() => onSelectQuery(tq)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/[0.04] hover:bg-white/[0.1] text-text-secondary hover:text-white border border-white/[0.06] hover:border-white/[0.15] transition-colors active:scale-95"
                    >
                      {tq}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================== */}
        {/* TYPING STATE: LIVE SEARCH SUGGESTIONS      */}
        {/* ========================================== */}
        {query.trim() && (
          <div className="space-y-4">
            {/* Semantic Context Explanation */}
            {results?.explanation && (
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-text-secondary">
                <Search className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <span className="truncate font-medium text-white">{results.explanation}</span>
              </div>
            )}

            {/* Loading Indicator */}
            {loading && !results && (
              <div className="py-6 text-center text-xs text-text-muted">
                Đang tìm kiếm thông minh...
              </div>
            )}

            {/* No Results */}
            {!loading && !hasSuggestions && (
              <div className="py-6 text-center space-y-1">
                <p className="text-xs font-medium text-text-secondary">
                  Không tìm thấy kết quả phù hợp cho "{query}"
                </p>
                <p className="text-[11px] text-text-muted">
                  Thử tìm kiếm tên bài hát, nghệ sĩ hoặc thể loại khác
                </p>
              </div>
            )}

            {/* ARTISTS SECTION */}
            {results && results.artists.length > 0 && (
              <div className="space-y-1.5">
                <div className="px-2 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Nghệ sĩ
                </div>
                <div className="space-y-1">
                  {results.artists.map((artist) => (
                    <div
                      key={artist.id}
                      onClick={() => handleArtistClick(artist.id, artist.name)}
                      className="group flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.06] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={artist.avatarUrl}
                          alt={artist.name}
                          className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1">
                            <h4 className="text-xs font-bold text-white truncate group-hover:underline">
                              {artist.name}
                            </h4>
                            {artist.verified && (
                              <BadgeCheck className="w-3.5 h-3.5 text-primary-400 fill-primary-400/20 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-[11px] text-text-muted truncate">
                            {formatNumber(artist.monthlyListeners)} người nghe hàng tháng
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] text-text-muted group-hover:text-white px-2 py-0.5 rounded bg-white/5 border border-white/5">
                        Nghệ sĩ
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SONGS SECTION */}
            {results && results.songs.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-2 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  <span>{results.isRecommendation ? 'Đề xuất cho bạn' : 'Bài hát'}</span>
                </div>
                <div className="space-y-0.5">
                  {results.songs.map((song) => {
                    const isCurrent = currentSong?.id === song.id;
                    const isCurrentPlaying = isCurrent && isPlaying;

                    return (
                      <div
                        key={song.id}
                        onClick={() => handleSongClick(song)}
                        className={`group flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                          isCurrent
                            ? 'bg-white/[0.08] border border-white/10'
                            : 'hover:bg-white/[0.06] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 shadow-sm">
                            <img
                              src={song.coverUrl}
                              alt={song.title}
                              className="w-full h-full object-cover"
                            />
                            <div
                              className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
                                isCurrentPlaying
                                  ? 'opacity-100'
                                  : 'opacity-0 group-hover:opacity-100'
                              }`}
                            >
                              {isCurrentPlaying ? (
                                <Pause className="w-4 h-4 text-white fill-current" />
                              ) : (
                                <Play className="w-4 h-4 text-white fill-current ml-0.5" />
                              )}
                            </div>
                          </div>

                          <div className="min-w-0">
                            <h4
                              className={`text-xs font-semibold truncate leading-tight ${
                                isCurrent ? 'text-white font-bold' : 'text-white'
                              }`}
                            >
                              {song.title}
                            </h4>
                            <p className="text-[11px] text-text-muted truncate mt-0.5">
                              {song.artist?.name || 'Ca sĩ'}
                            </p>
                          </div>
                        </div>

                        <span className="text-[11px] font-mono text-text-muted flex-shrink-0 ml-2">
                          {formatDuration(song.duration)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ALBUMS SECTION */}
            {results && results.albums.length > 0 && (
              <div className="space-y-1.5">
                <div className="px-2 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Album
                </div>
                <div className="space-y-1">
                  {results.albums.map((album) => (
                    <div
                      key={album.id}
                      onClick={() => handleAlbumClick(album.id, album.title)}
                      className="group flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.06] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 border border-white/10">
                          <img
                            src={album.coverUrl}
                            alt={album.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-white truncate group-hover:underline">
                            {album.title}
                          </h4>
                          <p className="text-[11px] text-text-muted truncate">
                            {album.artist?.name || 'Album'}
                          </p>
                        </div>
                      </div>
                      <Disc className="w-4 h-4 text-text-muted group-hover:text-white flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PLAYLISTS SECTION */}
            {results && results.playlists.length > 0 && (
              <div className="space-y-1.5">
                <div className="px-2 text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  Danh sách phát
                </div>
                <div className="space-y-1">
                  {results.playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      onClick={() => handlePlaylistClick(playlist.id, playlist.title)}
                      className="group flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.06] cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 border border-white/10">
                          <img
                            src={
                              playlist.coverUrl ||
                              'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'
                            }
                            alt={playlist.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-white truncate group-hover:underline">
                            {playlist.title}
                          </h4>
                          <p className="text-[11px] text-text-muted truncate">Playlist</p>
                        </div>
                      </div>
                      <ListMusic className="w-4 h-4 text-text-muted group-hover:text-white flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FOOTER: VIEW ALL RESULTS */}
      {query.trim() && (
        <div
          onClick={handleViewAll}
          className="p-3 bg-white/[0.03] hover:bg-white/[0.08] border-t border-white/5 cursor-pointer flex items-center justify-between transition-colors text-xs font-semibold text-white"
        >
          <span className="flex items-center gap-1.5">
            Xem tất cả kết quả cho <span className="text-primary-300 font-bold">"{query}"</span>
          </span>
          <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-white" />
        </div>
      )}
    </div>
  );
};

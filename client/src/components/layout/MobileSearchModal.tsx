import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search as SearchIcon,
  ArrowLeft,
  X,
  Clock,
  Trash2,
  TrendingUp,
  Pause,
  BadgeCheck,
  Disc,
  ListMusic,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { SearchResults, TrendingResponse, searchService } from '../../services/search.service.js';
import { searchHistoryUtil } from '../../utils/searchHistory.js';
import { usePlayerStore, useCurrentSong, useIsPlaying } from '../../store/playerStore.js';
import { formatDuration, formatNumber } from '../../utils/format.js';
import { Song } from '../../types/index.js';
import { QUERY_KEYS } from '../../services/queryClient.js';

interface MobileSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileSearchModal: React.FC<MobileSearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const currentSong = useCurrentSong();
  const isPlaying = useIsPlaying();
  const playSong = usePlayerStore((s) => s.playSong);
  const resume = usePlayerStore((s) => s.resume);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setHistory(searchHistoryUtil.getHistory());
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setQuery('');
      setDebouncedQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 150);
    return () => clearTimeout(handler);
  }, [query]);

  // Fetch trending queries with React Query cache
  const { data: trending } = useQuery<TrendingResponse>({
    queryKey: QUERY_KEYS.searchTrending,
    queryFn: searchService.getTrending,
    enabled: isOpen && !debouncedQuery,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch suggestions with React Query cache
  const { data: results, isFetching: loading } = useQuery<SearchResults | null>({
    queryKey: QUERY_KEYS.searchSuggestions(debouncedQuery),
    queryFn: ({ signal }) => searchService.getSuggestions(debouncedQuery, 8),
    enabled: isOpen && Boolean(debouncedQuery),
    staleTime: 1000 * 60 * 2,
    placeholderData: (prev) => prev,
  });

  if (!isOpen) return null;

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      searchHistoryUtil.addSearch(query.trim());
      onClose();
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
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

  const handleSelectQuery = (q: string) => {
    setQuery(q);
    searchHistoryUtil.addSearch(q);
    onClose();
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleRemoveHistory = (e: React.MouseEvent, item: string) => {
    e.stopPropagation();
    const updated = searchHistoryUtil.removeSearch(item);
    setHistory(updated);
  };

  const handleClearAllHistory = () => {
    searchHistoryUtil.clearAll();
    setHistory([]);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#090a0f] flex flex-col md:hidden animate-in fade-in duration-150">
      {/* Top Search Bar Header */}
      <div className="p-3.5 border-b border-white/10 flex items-center gap-2 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
        <button
          onClick={onClose}
          className="p-2 -ml-1 text-white hover:bg-white/10 rounded-full active:scale-95 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <form onSubmit={handleFormSubmit} className="relative flex-1">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Tìm bài hát, nghệ sĩ, tâm trạng..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-9 rounded-full bg-white/[0.08] border border-white/15 focus:border-white/30 text-sm text-white placeholder-text-muted outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </form>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24">
        {/* ========================================== */}
        {/* EMPTY STATE: RECENT SEARCHES & TRENDING    */}
        {/* ========================================== */}
        {!query.trim() && (
          <div className="space-y-5">
            {/* Recent Searches */}
            {history.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-text-muted">
                  <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                    <Clock className="w-3.5 h-3.5" />
                    Tìm kiếm gần đây
                  </span>
                  <button
                    onClick={handleClearAllHistory}
                    className="text-[11px] text-text-muted hover:text-red-400"
                  >
                    Xóa tất cả
                  </button>
                </div>

                <div className="space-y-1">
                  {history.map((item) => (
                    <div
                      key={item}
                      onClick={() => handleSelectQuery(item)}
                      className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/[0.03] active:bg-white/[0.08] transition-colors"
                    >
                      <div className="flex items-center gap-3 text-xs text-white truncate">
                        <Clock className="w-4 h-4 text-text-muted flex-shrink-0" />
                        <span className="truncate">{item}</span>
                      </div>
                      <button
                        onClick={(e) => handleRemoveHistory(e, item)}
                        className="p-1.5 text-text-muted hover:text-white"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trending Queries */}
            {trending && trending.trendingQueries.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  <TrendingUp className="w-3.5 h-3.5 text-primary-400" />
                  Tìm kiếm phổ biến
                </div>
                <div className="flex flex-wrap gap-2">
                  {trending.trendingQueries.map((tq) => (
                    <button
                      key={tq}
                      onClick={() => handleSelectQuery(tq)}
                      className="px-3.5 py-2 rounded-full text-xs font-medium bg-white/[0.06] text-white border border-white/10 active:scale-95"
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
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-text-secondary">
                <SearchIcon className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <span className="font-medium text-white">{results.explanation}</span>
              </div>
            )}

            {loading && !results && (
              <div className="py-8 text-center text-xs text-text-muted">
                Đang tìm kiếm thông minh...
              </div>
            )}

            {/* ARTISTS */}
            {results && results.artists.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                  Nghệ sĩ
                </div>
                <div className="space-y-1.5">
                  {results.artists.map((artist) => (
                    <div
                      key={artist.id}
                      onClick={() => handleArtistClick(artist.id, artist.name)}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] active:bg-white/[0.08]"
                    >
                      <img
                        src={artist.avatarUrl}
                        alt={artist.name}
                        className="w-11 h-11 rounded-full object-cover border border-white/10 flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <h4 className="text-xs font-bold text-white truncate">{artist.name}</h4>
                          {artist.verified && (
                            <BadgeCheck className="w-3.5 h-3.5 text-primary-400 fill-primary-400/20 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-text-muted truncate">
                          {formatNumber(artist.monthlyListeners)} người nghe
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SONGS */}
            {results && results.songs.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                  {results.isRecommendation ? 'Đề xuất cho bạn' : 'Bài hát'}
                </div>
                <div className="space-y-1">
                  {results.songs.map((song) => {
                    const isCurrent = currentSong?.id === song.id;
                    const isCurrentPlaying = isCurrent && isPlaying;

                    return (
                      <div
                        key={song.id}
                        onClick={() => handleSongClick(song)}
                        className={`flex items-center justify-between p-2 rounded-xl active:bg-white/[0.08] ${
                          isCurrent
                            ? 'bg-white/[0.08] border border-white/10'
                            : 'bg-white/[0.02]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 shadow">
                            <img
                              src={song.coverUrl}
                              alt={song.title}
                              className="w-full h-full object-cover"
                            />
                            {isCurrentPlaying && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Pause className="w-4 h-4 text-white fill-current" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4
                              className={`text-xs font-semibold truncate leading-tight ${
                                isCurrent ? 'text-primary-300 font-bold' : 'text-white'
                              }`}
                            >
                              {song.title}
                            </h4>
                            <p className="text-[11px] text-text-muted truncate mt-0.5">
                              {song.artist?.name || 'Ca sĩ'}
                            </p>
                          </div>
                        </div>

                        <span className="text-[11px] font-mono text-text-muted ml-2">
                          {formatDuration(song.duration)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ALBUMS */}
            {results && results.albums.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                  Album
                </div>
                <div className="space-y-1.5">
                  {results.albums.map((album) => (
                    <div
                      key={album.id}
                      onClick={() => handleAlbumClick(album.id, album.title)}
                      className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] active:bg-white/[0.08]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={album.coverUrl}
                          alt={album.title}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-white truncate">{album.title}</h4>
                          <p className="text-[11px] text-text-muted truncate">{album.artist?.name}</p>
                        </div>
                      </div>
                      <Disc className="w-4 h-4 text-text-muted flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PLAYLISTS */}
            {results && results.playlists.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                  Danh sách phát
                </div>
                <div className="space-y-1.5">
                  {results.playlists.map((playlist) => (
                    <div
                      key={playlist.id}
                      onClick={() => handlePlaylistClick(playlist.id, playlist.title)}
                      className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] active:bg-white/[0.08]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={
                            playlist.coverUrl ||
                            'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'
                          }
                          alt={playlist.title}
                          className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-white truncate">{playlist.title}</h4>
                          <p className="text-[11px] text-text-muted truncate">Playlist</p>
                        </div>
                      </div>
                      <ListMusic className="w-4 h-4 text-text-muted flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full Results Footer Button */}
      {query.trim() && (
        <div className="p-3.5 border-t border-white/10 bg-[#0c0e14]">
          <button
            onClick={handleFormSubmit}
            className="w-full py-2.5 rounded-xl bg-white text-black font-bold text-xs flex items-center justify-center gap-2 active:scale-98 transition-transform"
          >
            Xem tất cả kết quả cho "{query}"
          </button>
        </div>
      )}
    </div>
  );
};

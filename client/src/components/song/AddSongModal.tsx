import React, { useEffect, useState, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  Music2,
  Youtube,
  Link2,
  FileAudio,
  UserPlus,
  AlertCircle,
  Check,
  ExternalLink,
  Play,
  Search,
  X,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Song, Artist, Album, Genre } from '../../types/index.js';
import { songService } from '../../services/song.service.js';
import { artistService } from '../../services/artist.service.js';
import { albumService } from '../../services/album.service.js';
import { adminService } from '../../services/admin.service.js';
import { usePlayerStore } from '../../store/playerStore.js';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Input } from '../common/Input.js';
import { AddArtistModal } from '../artist/AddArtistModal.js';

interface AddSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (song: Song) => void;
  song?: Song | null;
  defaultArtistId?: string;
}

type AudioSourceOption = 'youtube' | 'url' | 'upload';
type CoverOption = 'url' | 'upload';

export const AddSongModal: React.FC<AddSongModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  song,
  defaultArtistId,
}) => {
  const navigate = useNavigate();
  const { playSong } = usePlayerStore();

  // Basic Song Info
  const [title, setTitle] = useState('');
  const [artistId, setArtistId] = useState('');
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [albumId, setAlbumId] = useState('');
  const [genreId, setGenreId] = useState('');
  const [duration, setDuration] = useState('180');

  // Audio Source
  const [sourceType, setSourceType] = useState<AudioSourceOption>('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Cover Image
  const [coverType, setCoverType] = useState<CoverOption>('url');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState('');

  // Lyrics
  const [lyrics, setLyrics] = useState('');
  const [syncedLyrics, setSyncedLyrics] = useState('');

  // Options & Auto-fetch state
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [isFetchingYt, setIsFetchingYt] = useState(false);
  const [ytFeedback, setYtFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [duplicateSong, setDuplicateSong] = useState<Song | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Artist search selector state
  const [artistSearchTerm, setArtistSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Artist[]>([]);
  const [isSearchingArtists, setIsSearchingArtists] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isArtistDropdownOpen, setIsArtistDropdownOpen] = useState(false);
  const [isCreatingArtistOpen, setIsCreatingArtistOpen] = useState(false);

  const searchAbortControllerRef = useRef<AbortController | null>(null);
  const searchDebounceTimerRef = useRef<any>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDropdownOptions();
      setErrorMessage('');
      setDuplicateSong(null);
      setYtFeedback('');
      setShowUnsavedWarning(false);
      setSearchResults([]);
      setIsSearchingArtists(false);
      setHasSearched(false);
      setIsArtistDropdownOpen(false);

      if (song) {
        setTitle(song.title);
        setArtistId(song.artistId);
        if (song.artist) {
          setSelectedArtist(song.artist as Artist);
          setArtistSearchTerm(song.artist.name);
        }
        setAlbumId(song.albumId || '');
        setGenreId(song.genreId || '');
        setDuration(song.duration?.toString() || '180');

        if (song.sourceType === 'youtube' || song.youtubeUrl || song.audioUrl.includes('youtu')) {
          setSourceType('youtube');
          setYoutubeUrl(song.youtubeUrl || song.audioUrl);
        } else if (song.audioUrl.startsWith('/uploads/')) {
          setSourceType('upload');
          setAudioUrl(song.audioUrl);
        } else {
          setSourceType('url');
          setAudioUrl(song.audioUrl);
        }

        setCoverUrl(song.coverUrl || '');
        setCoverPreview(song.coverUrl || '');
        setLyrics(song.lyrics?.plainLyrics || '');
        setSyncedLyrics(song.lyrics?.syncedLyrics || '');
      } else {
        resetForm();
        if (defaultArtistId) {
          setArtistId(defaultArtistId);
        }
      }
    } else {
      // Cleanup timers & abort controllers on close
      if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current);
      if (searchAbortControllerRef.current) searchAbortControllerRef.current.abort();
    }
  }, [isOpen, song, defaultArtistId]);

  // Click outside listener for artist dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsArtistDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const loadDropdownOptions = async () => {
    try {
      const [artRes, albRes, genRes] = await Promise.all([
        artistService.getAllArtists({ limit: 100 }),
        albumService.getAllAlbums({ limit: 100 }).catch(() => ({ items: [] })),
        adminService.getAllGenres().catch(() => []),
      ]);
      setArtists(artRes.items);
      setAlbums(albRes.items);
      setGenres(genRes);

      if (defaultArtistId) {
        const found = artRes.items.find((a) => a.id === defaultArtistId);
        if (found) {
          handleSelectArtist(found);
        }
      }
    } catch (e) {
      console.error('Failed to load dropdown options:', e);
    }
  };

  const resetForm = () => {
    setTitle('');
    setArtistId('');
    setSelectedArtist(null);
    setArtistSearchTerm('');
    setSearchResults([]);
    setIsSearchingArtists(false);
    setHasSearched(false);
    setAlbumId('');
    setGenreId('');
    setDuration('180');
    setSourceType('youtube');
    setYoutubeUrl('');
    setAudioUrl('');
    setAudioFile(null);
    setCoverType('url');
    setCoverUrl('');
    setCoverFile(null);
    setCoverPreview('');
    setLyrics('');
    setSyncedLyrics('');
  };

  // Dynamic Debounced Artist Search
  const handleArtistSearchChange = (term: string) => {
    setArtistSearchTerm(term);
    setIsArtistDropdownOpen(true);

    if (selectedArtist && selectedArtist.name !== term) {
      setSelectedArtist(null);
      setArtistId('');
    }

    const cleanTerm = term.trim();
    if (!cleanTerm) {
      if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current);
      if (searchAbortControllerRef.current) searchAbortControllerRef.current.abort();
      setSearchResults([]);
      setIsSearchingArtists(false);
      setHasSearched(false);
      return;
    }

    setIsSearchingArtists(true);
    if (searchDebounceTimerRef.current) clearTimeout(searchDebounceTimerRef.current);

    searchDebounceTimerRef.current = setTimeout(async () => {
      if (searchAbortControllerRef.current) {
        searchAbortControllerRef.current.abort();
      }
      const controller = new AbortController();
      searchAbortControllerRef.current = controller;

      try {
        console.log(`[ArtistSearch] Searching for: "${cleanTerm}"`);
        const res = await artistService.getAllArtists(
          { search: cleanTerm, limit: 12 },
          controller.signal
        );
        console.log(`[ArtistSearch] Found ${res.items.length} results for: "${cleanTerm}"`);
        setSearchResults(res.items);
        setHasSearched(true);
      } catch (err: any) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error('[ArtistSearch] Search error:', err);
          // Fallback to local matching
          const local = artists.filter((a) =>
            a.name.toLowerCase().includes(cleanTerm.toLowerCase())
          );
          setSearchResults(local);
          setHasSearched(true);
        }
      } finally {
        setIsSearchingArtists(false);
      }
    }, 280);
  };

  const handleSelectArtist = (artist: Artist) => {
    console.log(`[ArtistSelect] Selected artist: "${artist.name}" (ID: ${artist.id})`);
    setSelectedArtist(artist);
    setArtistId(artist.id);
    setArtistSearchTerm(artist.name);
    setIsArtistDropdownOpen(false);
    setSearchResults([]);
    setHasSearched(false);
    setIsSearchingArtists(false);

    // Keep initial artists up to date
    setArtists((prev) => [artist, ...prev.filter((a) => a.id !== artist.id)]);
  };

  const handleClearSelectedArtist = () => {
    setSelectedArtist(null);
    setArtistId('');
    setArtistSearchTerm('');
    setSearchResults([]);
    setHasSearched(false);
    setIsSearchingArtists(false);
    setIsArtistDropdownOpen(true);
  };

  // Called when user creates a brand new artist inside Add Song modal
  const handleNewArtistCreated = (newArtist: Artist) => {
    handleSelectArtist(newArtist);
    setIsCreatingArtistOpen(false);
  };

  const handleFetchYoutubeInfo = async (customUrl?: string) => {
    const targetUrl = (customUrl || youtubeUrl).trim();
    if (!targetUrl) return;

    try {
      setIsFetchingYt(true);
      setYtFeedback('');
      const info = await songService.getYoutubeInfo(targetUrl);

      if (info) {
        if (!title.trim() || title.startsWith('YouTube Track')) {
          setTitle(info.title);
        }
        if (!coverUrl.trim() && info.thumbnailUrl) {
          setCoverUrl(info.thumbnailUrl);
          setCoverPreview(info.thumbnailUrl);
        }
        if (info.duration && info.duration > 0) {
          setDuration(info.duration.toString());
        }

        // Try auto matching artist if not selected
        if (!artistId && info.artistName) {
          const trimmedYt = info.artistName.trim();
          try {
            const matchLocal = artists.find(
              (a) => a.name.toLowerCase() === trimmedYt.toLowerCase()
            );
            if (matchLocal) {
              handleSelectArtist(matchLocal);
            } else {
              const res = await artistService.getAllArtists({ search: trimmedYt, limit: 5 });
              const exact = res.items.find(
                (a) => a.name.toLowerCase() === trimmedYt.toLowerCase()
              );
              if (exact) {
                handleSelectArtist(exact);
              } else if (res.items.length > 0) {
                handleSelectArtist(res.items[0]);
              } else {
                setArtistSearchTerm(trimmedYt);
              }
            }
          } catch {
            setArtistSearchTerm(trimmedYt);
          }
        }

        setYtFeedback(`Tự động nhận diện: "${info.title}" (${info.formattedDuration || '3:00'})`);
      }
    } catch {
      setYtFeedback('Không thể tự động tải thông tin YouTube, bạn có thể nhập thủ công bên dưới.');
    } finally {
      setIsFetchingYt(false);
    }
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        setErrorMessage('File âm thanh không được vượt quá 50MB.');
        return;
      }
      setAudioFile(file);
      setErrorMessage('');

      // Auto detect title from filename if not set
      if (!title.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        setTitle(cleanName);
      }

      // Auto detect duration
      const tempAudio = document.createElement('audio');
      tempAudio.src = URL.createObjectURL(file);
      tempAudio.onloadedmetadata = () => {
        if (tempAudio.duration && tempAudio.duration > 0) {
          setDuration(Math.round(tempAudio.duration).toString());
        }
      };
    }
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage('File ảnh bìa không được vượt quá 10MB.');
        return;
      }
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
      setErrorMessage('');
    }
  };

  const isFormDirty = () => {
    if (song) return true;
    return !!(title.trim() || artistId || youtubeUrl.trim() || audioUrl.trim() || audioFile || lyrics.trim());
  };

  const handleSafeClose = () => {
    if (isFormDirty()) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage('Vui lòng nhập tên bài hát.');
      return;
    }
    if (!artistId) {
      setErrorMessage('Vui lòng chọn hoặc tạo nghệ sĩ thể hiện.');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('title', trimmedTitle);
      formData.append('artistId', artistId);
      if (albumId) formData.append('albumId', albumId);
      if (genreId) formData.append('genreId', genreId);
      formData.append('duration', duration || '180');
      formData.append('sourceType', sourceType);

      if (sourceType === 'youtube') {
        if (!youtubeUrl.trim()) {
          setErrorMessage('Vui lòng nhập đường dẫn YouTube.');
          setLoading(false);
          return;
        }
        formData.append('youtubeUrl', youtubeUrl.trim());
        formData.append('audioUrl', youtubeUrl.trim());
      } else if (sourceType === 'upload') {
        if (!audioFile && !song?.audioUrl) {
          setErrorMessage('Vui lòng chọn file âm thanh MP3 để tải lên.');
          setLoading(false);
          return;
        }
        if (audioFile) {
          formData.append('audioFile', audioFile);
        }
      } else {
        if (!audioUrl.trim()) {
          setErrorMessage('Vui lòng nhập Audio URL.');
          setLoading(false);
          return;
        }
        formData.append('audioUrl', audioUrl.trim());
      }

      if (coverType === 'upload' && coverFile) {
        formData.append('coverFile', coverFile);
      } else if (coverUrl.trim()) {
        formData.append('coverUrl', coverUrl.trim());
      } else if (selectedArtist?.avatarUrl) {
        formData.append('coverUrl', selectedArtist.avatarUrl);
      }

      if (lyrics.trim()) formData.append('lyrics', lyrics.trim());
      if (syncedLyrics.trim()) formData.append('syncedLyrics', syncedLyrics.trim());

      let savedSong: Song;
      if (song) {
        savedSong = await songService.updateSong(song.id, formData);
      } else {
        savedSong = await songService.createSong(formData);
      }

      onSuccess(savedSong);
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi lưu bài hát.';
      setErrorMessage(msg);
      if (err.response?.status === 409 && err.response?.data?.data?.existingSong) {
        setDuplicateSong(err.response.data.data.existingSong);
      }
    } finally {
      setLoading(false);
    }
  };

  const isQueryActive = artistSearchTerm.trim().length > 0;
  const displayedArtists = isQueryActive
    ? hasSearched
      ? searchResults
      : artists.filter((a) => a.name.toLowerCase().includes(artistSearchTerm.trim().toLowerCase()))
    : artists;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleSafeClose}
        title={song ? 'Chỉnh sửa bài hát' : 'Thêm bài hát mới'}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 no-scrollbar">
          {/* Error / Duplicate Alert */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p>{errorMessage}</p>
                {duplicateSong && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(`/song/${duplicateSong.id}`);
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-white underline hover:text-primary-300 transition-colors"
                  >
                    Xem bài hát đã có <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Song Title */}
          <Input
            label="Tên bài hát *"
            placeholder="e.g. Cơn Mưa Băng Giá, Nắng Ấm Xa Dần, Blinding Lights..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />

          {/* Artist Selector with Search & On-the-fly Creation */}
          {selectedArtist && artistId ? (
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Nghệ sĩ thể hiện *
              </label>
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={selectedArtist.avatarUrl}
                    alt={selectedArtist.name}
                    className="w-10 h-10 rounded-full object-cover border border-white/15 flex-shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100';
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-white truncate">
                        {selectedArtist.name}
                      </span>
                      {selectedArtist.verified && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          Verified
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                      <Check className="w-3.5 h-3.5 flex-shrink-0" /> Nghệ sĩ đã chọn (
                      {selectedArtist.country || 'Nghệ sĩ'})
                    </span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleClearSelectedArtist}
                  className="flex-shrink-0"
                >
                  Thay đổi
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1 relative" ref={dropdownRef}>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Nghệ sĩ thể hiện *
              </label>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Nhập tên nghệ sĩ (ví dụ: Dangrangto, Sơn Tùng, Vũ...)"
                  value={artistSearchTerm}
                  onFocus={() => setIsArtistDropdownOpen(true)}
                  onChange={(e) => handleArtistSearchChange(e.target.value)}
                  className="w-full rounded-xl bg-background-surface border border-white/10 pl-9 pr-10 py-2.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-white/25 transition-colors"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />

                {artistSearchTerm ? (
                  <button
                    type="button"
                    onClick={() => handleArtistSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsArtistDropdownOpen(!isArtistDropdownOpen)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-white"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Dropdown Menu */}
              {isArtistDropdownOpen && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-xl bg-background-elevated border border-white/15 shadow-2xl p-2 space-y-1 max-h-60 overflow-y-auto">
                  <div className="flex items-center justify-between pb-1 px-1 border-b border-white/5">
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                      {isQueryActive
                        ? `Kết quả tìm kiếm (${displayedArtists.length})`
                        : 'Nghệ sĩ phổ biến'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingArtistOpen(true);
                        setIsArtistDropdownOpen(false);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-white hover:text-primary-300 transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> + Tạo nghệ sĩ mới
                    </button>
                  </div>

                  {isSearchingArtists ? (
                    <div className="p-4 text-center space-y-2">
                      <Loader2 className="w-5 h-5 text-text-muted animate-spin mx-auto" />
                      <p className="text-xs text-text-muted">
                        Đang tìm nghệ sĩ "{artistSearchTerm.trim()}"...
                      </p>
                    </div>
                  ) : isQueryActive && displayedArtists.length === 0 ? (
                    <div className="p-3 text-center space-y-2">
                      <p className="text-xs text-text-muted">
                        Không tìm thấy nghệ sĩ "{artistSearchTerm.trim()}"
                      </p>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                        onClick={() => {
                          setIsCreatingArtistOpen(true);
                          setIsArtistDropdownOpen(false);
                        }}
                      >
                        Tạo nghệ sĩ "{artistSearchTerm.trim() || 'Mới'}"
                      </Button>
                    </div>
                  ) : displayedArtists.length === 0 ? (
                    <div className="p-3 text-center text-xs text-text-muted">
                      Chưa có nghệ sĩ nào. Hãy tạo nghệ sĩ đầu tiên!
                    </div>
                  ) : (
                    displayedArtists.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => handleSelectArtist(a)}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-xs transition-colors text-left ${
                          artistId === a.id
                            ? 'bg-white/15 text-white font-bold'
                            : 'hover:bg-white/[0.06] text-text-secondary hover:text-white'
                        }`}
                      >
                        <img
                          src={a.avatarUrl}
                          alt={a.name}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-white/10"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100';
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold block truncate text-white">
                              {a.name}
                            </span>
                            {a.verified && (
                              <span className="text-[9px] font-bold text-blue-400">✓</span>
                            )}
                          </div>
                          <span className="text-[10px] text-text-muted">
                            {a.country || 'Nghệ sĩ'}
                            {a.monthlyListeners
                              ? ` • ${a.monthlyListeners.toLocaleString()} người nghe`
                              : ''}
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-text-muted hover:text-white flex-shrink-0">
                          Chọn →
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Album & Genre Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Album (Tùy chọn)
              </label>
              <select
                value={albumId}
                onChange={(e) => setAlbumId(e.target.value)}
                className="w-full rounded-xl bg-background-surface border border-white/10 px-3 py-2.5 text-xs text-text-primary outline-none focus:border-white/25 transition-colors"
              >
                <option value="">Không thuộc album nào (Single / EP)</option>
                {albums.map((alb) => (
                  <option key={alb.id} value={alb.id}>
                    {alb.title} {alb.artist?.name ? `(${alb.artist.name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Thể loại (Genre)
              </label>
              <select
                value={genreId}
                onChange={(e) => setGenreId(e.target.value)}
                className="w-full rounded-xl bg-background-surface border border-white/10 px-3 py-2.5 text-xs text-text-primary outline-none focus:border-white/25 transition-colors"
              >
                <option value="">Chọn thể loại phù hợp</option>
                {genres.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Audio Source Tabs */}
          <div className="space-y-2 pt-1 border-t border-white/5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Nguồn phát nhạc (Audio Source) *
            </label>

            <div className="flex items-center gap-2 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] flex-wrap">
              <button
                type="button"
                onClick={() => setSourceType('youtube')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  sourceType === 'youtube'
                    ? 'bg-white text-black'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <Youtube className="w-3.5 h-3.5 text-red-500" />
                <span>YouTube URL</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceType('url')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  sourceType === 'url'
                    ? 'bg-white text-black'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Direct Audio URL</span>
              </button>

              <button
                type="button"
                onClick={() => setSourceType('upload')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  sourceType === 'upload'
                    ? 'bg-white text-black'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <FileAudio className="w-3.5 h-3.5" />
                <span>Tải lên file MP3</span>
              </button>
            </div>

            {/* YouTube Input Mode */}
            {sourceType === 'youtube' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="https://www.youtube.com/watch?v=... hoặc https://youtu.be/..."
                      value={youtubeUrl}
                      onChange={(e) => {
                        setYoutubeUrl(e.target.value);
                        setYtFeedback('');
                      }}
                      onBlur={() => handleFetchYoutubeInfo()}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    isLoading={isFetchingYt}
                    onClick={() => handleFetchYoutubeInfo()}
                    leftIcon={<Search className="w-4 h-4" />}
                  >
                    Tự điền
                  </Button>
                </div>
                {ytFeedback && (
                  <p className="text-[11px] text-emerald-400 font-medium px-1 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{ytFeedback}</span>
                  </p>
                )}
              </div>
            )}

            {/* Direct URL Input Mode */}
            {sourceType === 'url' && (
              <Input
                placeholder="https://example.com/audio.mp3"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
              />
            )}

            {/* File Upload Input Mode */}
            {sourceType === 'upload' && (
              <div className="border border-dashed border-white/20 hover:border-white/40 rounded-xl p-4 text-center cursor-pointer transition-colors relative bg-white/[0.02]">
                <input
                  type="file"
                  accept="audio/mp3,audio/wav,audio/ogg,audio/m4a,audio/*"
                  onChange={handleAudioFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <FileAudio className="w-6 h-6 text-text-muted mx-auto mb-1.5" />
                <p className="text-xs text-white font-medium">
                  {audioFile ? audioFile.name : 'Chọn file âm thanh từ máy tính (MP3, WAV, OGG, M4A)'}
                </p>
                <p className="text-[11px] text-text-muted mt-0.5">Tối đa 50MB</p>
              </div>
            )}
          </div>

          {/* Cover Image & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-white/5">
            {/* Cover Image */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Ảnh bìa bài hát (Cover Artwork)
              </label>

              <div className="flex items-center gap-2 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] w-fit">
                <button
                  type="button"
                  onClick={() => setCoverType('url')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    coverType === 'url' ? 'bg-white text-black' : 'text-text-muted hover:text-white'
                  }`}
                >
                  URL
                </button>
                <button
                  type="button"
                  onClick={() => setCoverType('upload')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    coverType === 'upload' ? 'bg-white text-black' : 'text-text-muted hover:text-white'
                  }`}
                >
                  Tải ảnh
                </button>
              </div>

              {coverType === 'url' ? (
                <Input
                  placeholder="https://images.unsplash.com/..."
                  value={coverUrl}
                  onChange={(e) => {
                    setCoverUrl(e.target.value);
                    setCoverPreview(e.target.value);
                  }}
                />
              ) : (
                <div className="border border-dashed border-white/20 hover:border-white/40 rounded-xl p-3 text-center cursor-pointer transition-colors relative bg-white/[0.02]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <p className="text-xs text-white font-medium">
                    {coverFile ? coverFile.name : 'Chọn ảnh bìa'}
                  </p>
                </div>
              )}

              {coverPreview && (
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/[0.06] w-fit">
                  <img
                    src={coverPreview}
                    alt="Cover preview"
                    className="w-10 h-10 rounded-lg object-cover border border-white/10"
                    onError={() => setCoverPreview('')}
                  />
                  <span className="text-[11px] text-text-muted">Xem trước ảnh bìa</span>
                </div>
              )}
            </div>

            {/* Duration (Seconds) */}
            <div className="space-y-2">
              <Input
                type="number"
                label="Thời lượng (Giây)"
                placeholder="180"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
              <span className="text-[11px] text-text-muted block">
                Tương đương: {Math.floor(parseInt(duration || '0', 10) / 60)}:
                {(parseInt(duration || '0', 10) % 60).toString().padStart(2, '0')} phút
              </span>
            </div>
          </div>

          {/* Plain Lyrics */}
          <div className="space-y-1 pt-1 border-t border-white/5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Lời bài hát (Lyrics - Tùy chọn)
            </label>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              rows={4}
              placeholder="Dán toàn bộ lời bài hát tại đây..."
              className="w-full rounded-xl bg-background-surface border border-white/10 px-3 py-2 text-xs text-text-primary placeholder-text-muted outline-none focus:border-white/25 transition-colors font-sans"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
            <Button type="button" variant="ghost" size="sm" onClick={handleSafeClose}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={loading}
            >
              {song ? 'Lưu thay đổi' : 'Thêm bài hát'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Artist Sub-Modal (On the fly) */}
      <AddArtistModal
        isOpen={isCreatingArtistOpen}
        onClose={() => setIsCreatingArtistOpen(false)}
        initialName={artistSearchTerm}
        onSuccess={handleNewArtistCreated}
      />

      {/* Unsaved Changes Confirmation Modal */}
      <Modal
        isOpen={showUnsavedWarning}
        onClose={() => setShowUnsavedWarning(false)}
        title="Thay đổi chưa được lưu"
        maxWidth="sm"
      >
        <div className="space-y-3 py-1">
          <p className="text-xs text-text-secondary">
            Bạn có các thông tin đã nhập chưa được lưu lại. Bạn có chắc muốn đóng và bỏ các thay đổi này?
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowUnsavedWarning(false)}
            >
              Tiếp tục chỉnh sửa
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                setShowUnsavedWarning(false);
                onClose();
              }}
            >
              Bỏ thay đổi
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

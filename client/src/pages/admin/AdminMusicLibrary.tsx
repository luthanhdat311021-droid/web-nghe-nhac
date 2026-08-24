import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Music2,
  Upload,
  Search,
  Filter,
  Play,
  Pause,
  Edit2,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileAudio,
  History,
  FolderPlus,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Layers,
  X,
  Sparkles,
  Check,
  Disc3,
  User,
  SlidersHorizontal,
} from 'lucide-react';
import { Song, Genre, Artist, ImportBatch, DuplicateCheckResult } from '../../types/index.js';
import { songService } from '../../services/song.service.js';
import { adminService } from '../../services/admin.service.js';
import { artistService } from '../../services/artist.service.js';
import { usePlayerStore, useIsSongPlaying, useIsSongCurrent } from '../../store/playerStore.js';
import { parseMp3Metadata, ParsedAudioMetadata } from '../../utils/id3Parser.js';
import { formatDuration, formatNumber } from '../../utils/format.js';
import { Button } from '../../components/common/Button.js';
import { SongModal } from '../../components/admin/SongModal.js';
import { ReplaceAudioModal } from '../../components/admin/ReplaceAudioModal.js';
import { ReplaceCoverModal } from '../../components/admin/ReplaceCoverModal.js';

type TabType = 'library' | 'upload' | 'history';

interface BatchUploadItemState {
  item: ParsedAudioMetadata;
  status: 'PENDING' | 'UPLOADING' | 'SUCCESS' | 'SKIPPED' | 'FAILED';
  progress: number;
  errorMessage?: string;
  songId?: string;
}

export const AdminMusicLibrary: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('library');

  // ==================== TAB 1: MUSIC LIBRARY TABLE STATE ====================
  const [songs, setSongs] = useState<Song[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('');
  const [selectedArtist, setSelectedArtist] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'popular' | 'oldest'>('latest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSongs, setTotalSongs] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isSongModalOpen, setIsSongModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [replaceAudioSong, setReplaceAudioSong] = useState<Song | null>(null);
  const [replaceCoverSong, setReplaceCoverSong] = useState<Song | null>(null);
  const [deleteConfirmSong, setDeleteConfirmSong] = useState<Song | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Player Store
  const { playSong, pause, resume, currentSong, isPlaying } = usePlayerStore();

  // ==================== TAB 2: BULK UPLOAD STATE ====================
  const [parsedQueue, setParsedQueue] = useState<ParsedAudioMetadata[]>([]);
  const [isParsingFiles, setIsParsingFiles] = useState(false);
  const [parsingProgress, setParsingProgress] = useState({ current: 0, total: 0 });
  const [batchItemsState, setBatchItemsState] = useState<BatchUploadItemState[]>([]);
  const [isBatchUploading, setIsBatchUploading] = useState(false);
  const [batchCompleted, setBatchCompleted] = useState(false);
  const [batchSummary, setBatchSummary] = useState({ success: 0, failed: 0, skipped: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // ==================== TAB 3: IMPORT HISTORY STATE ====================
  const [historyBatches, setHistoryBatches] = useState<ImportBatch[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState<ImportBatch | null>(null);

  // =========================================================================
  // INITIAL DATA FETCHING
  // =========================================================================
  useEffect(() => {
    fetchGenresAndArtists();
  }, []);

  useEffect(() => {
    if (activeTab === 'library') {
      fetchSongs();
    } else if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, search, selectedGenre, selectedArtist, sortBy, page]);

  const fetchGenresAndArtists = async () => {
    try {
      const [genresData, artistsData] = await Promise.all([
        adminService.getAllGenres().catch(() => []),
        artistService.getAllArtists({ limit: 100 }).catch(() => ({ items: [] })),
      ]);
      setGenres(genresData || []);
      setArtists(artistsData.items || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSongs = async () => {
    try {
      setLoading(true);
      const res = await songService.getAllSongs({
        search: search.trim() || undefined,
        genre: selectedGenre || undefined,
        sort: sortBy,
        page,
        limit: 15,
      });

      let filteredItems = res.items;
      if (selectedArtist) {
        filteredItems = filteredItems.filter((s) => s.artistId === selectedArtist);
      }

      setSongs(filteredItems);
      setTotalPages(res.pagination.totalPages);
      setTotalSongs(res.pagination.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await adminService.getImportHistory(historyPage, 10);
      setHistoryBatches(res.items || []);
      setHistoryTotalPages(res.pagination?.totalPages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // =========================================================================
  // SONG ACTIONS
  // =========================================================================
  const handlePlayToggle = (song: Song) => {
    if (currentSong?.id === song.id) {
      if (isPlaying) pause();
      else resume();
    } else {
      playSong(song, songs);
    }
  };

  const handleDeleteSong = async () => {
    if (!deleteConfirmSong) return;
    try {
      setIsDeleting(true);
      await adminService.deleteSong(deleteConfirmSong.id);
      setDeleteConfirmSong(null);
      fetchSongs();
    } catch (e) {
      console.error(e);
    } finally {
      setIsDeleting(false);
    }
  };

  // =========================================================================
  // MP3 FILES SELECTION & ID3 METADATA PARSING
  // =========================================================================
  const handleFilesSelected = async (files: FileList | File[]) => {
    const validMp3Files = Array.from(files).filter(
      (f) => f.name.toLowerCase().endsWith('.mp3') || f.type === 'audio/mpeg'
    );

    if (validMp3Files.length === 0) {
      alert('Vui lòng chọn ít nhất một file âm thanh .mp3 hợp lệ.');
      return;
    }

    setIsParsingFiles(true);
    setParsingProgress({ current: 0, total: validMp3Files.length });
    setBatchCompleted(false);

    const parsedResults: ParsedAudioMetadata[] = [];

    // Parse in chunks of 5 to maintain high UI responsiveness
    const chunkSize = 5;
    for (let i = 0; i < validMp3Files.length; i += chunkSize) {
      const chunk = validMp3Files.slice(i, i + chunkSize);
      const chunkPromises = chunk.map(async (file) => {
        try {
          return await parseMp3Metadata(file);
        } catch (err) {
          console.warn('Error parsing file:', file.name, err);
          return {
            file,
            id: `err_${Date.now()}_${Math.random()}`,
            title: file.name.replace(/\.[^/.]+$/, ''),
            artist: 'Unknown Artist',
            album: 'Single',
            trackNumber: 1,
            releaseYear: new Date().getFullYear(),
            genre: 'V-Pop',
            duration: 180,
            coverFile: null,
            coverPreviewUrl: null,
            duplicateStatus: 'NEW' as const,
            duplicateAction: 'skip' as const,
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      parsedResults.push(...chunkResults);
      setParsingProgress({ current: Math.min(i + chunkSize, validMp3Files.length), total: validMp3Files.length });
    }

    // Pre-check duplicate songs on backend
    try {
      const checkPayload = parsedResults.map((item) => ({
        title: item.title,
        artist: item.artist,
        album: item.album,
      }));

      const duplicateResults: DuplicateCheckResult[] = await adminService.checkSongDuplicates(checkPayload);

      parsedResults.forEach((item, idx) => {
        const dupInfo = duplicateResults[idx];
        if (dupInfo && dupInfo.isDuplicate) {
          item.duplicateStatus = 'DUPLICATE';
          item.duplicateAction = 'skip';
          item.existingSongId = dupInfo.existingSongId;
        } else {
          item.duplicateStatus = 'NEW';
          item.duplicateAction = 'skip';
        }
      });
    } catch (e) {
      console.warn('Failed to pre-check duplicates:', e);
      parsedResults.forEach((item) => {
        item.duplicateStatus = 'NEW';
      });
    }

    setParsedQueue((prev) => [...prev, ...parsedResults]);
    setIsParsingFiles(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  // Preview Table Inline Edits
  const handleUpdateParsedItem = (id: string, field: keyof ParsedAudioMetadata, value: any) => {
    setParsedQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveParsedItem = (id: string) => {
    setParsedQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSetAllDuplicateActions = (action: 'skip' | 'replace' | 'keep') => {
    setParsedQueue((prev) =>
      prev.map((item) => (item.duplicateStatus === 'DUPLICATE' ? { ...item, duplicateAction: action } : item))
    );
  };

  // =========================================================================
  // BATCH IMPORT EXECUTION (CONCURRENT QUEUE)
  // =========================================================================
  const startBatchImport = async () => {
    if (parsedQueue.length === 0) return;

    setIsBatchUploading(true);
    setBatchCompleted(false);

    const initialStates: BatchUploadItemState[] = parsedQueue.map((item) => ({
      item,
      status: 'PENDING',
      progress: 0,
    }));

    setBatchItemsState(initialStates);

    let successCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const importLogs: Array<{
      filename: string;
      songTitle?: string | null;
      artistName?: string | null;
      status: string;
      errorMessage?: string | null;
      songId?: string | null;
    }> = [];

    // Worker pool concurrency = 3
    const concurrency = 3;
    let currentIndex = 0;

    const runWorker = async () => {
      while (currentIndex < parsedQueue.length) {
        const idx = currentIndex++;
        const queueItem = parsedQueue[idx];

        setBatchItemsState((prev) => {
          const next = [...prev];
          if (next[idx]) {
            next[idx].status = 'UPLOADING';
            next[idx].progress = 20;
          }
          return next;
        });

        try {
          const formData = new FormData();
          formData.append('audioFile', queueItem.file);
          if (queueItem.coverFile) {
            formData.append('coverFile', queueItem.coverFile);
          }
          formData.append('title', queueItem.title.trim());
          formData.append('artistName', queueItem.artist.trim());
          if (queueItem.album) {
            formData.append('albumTitle', queueItem.album.trim());
          }
          if (queueItem.genre) {
            formData.append('genreName', queueItem.genre.trim());
          }
          formData.append('duration', queueItem.duration.toString());
          if (queueItem.releaseYear) {
            formData.append('releaseYear', queueItem.releaseYear.toString());
          }
          formData.append('trackNumber', queueItem.trackNumber.toString());
          formData.append('duplicateAction', queueItem.duplicateAction || 'skip');
          if (queueItem.existingSongId) {
            formData.append('existingSongId', queueItem.existingSongId);
          }

          const res = await adminService.importSingleSong(formData);

          if (res.data?.status === 'SKIPPED') {
            skippedCount++;
            setBatchItemsState((prev) => {
              const next = [...prev];
              if (next[idx]) {
                next[idx].status = 'SKIPPED';
                next[idx].progress = 100;
                next[idx].errorMessage = 'Đã bỏ qua (bài trùng)';
              }
              return next;
            });
            importLogs.push({
              filename: queueItem.file.name,
              songTitle: queueItem.title,
              artistName: queueItem.artist,
              status: 'SKIPPED',
              errorMessage: 'Duplicate skipped',
              songId: res.data?.song?.id,
            });
          } else {
            successCount++;
            setBatchItemsState((prev) => {
              const next = [...prev];
              if (next[idx]) {
                next[idx].status = 'SUCCESS';
                next[idx].progress = 100;
                next[idx].songId = res.data?.song?.id;
              }
              return next;
            });
            importLogs.push({
              filename: queueItem.file.name,
              songTitle: queueItem.title,
              artistName: queueItem.artist,
              status: 'SUCCESS',
              songId: res.data?.song?.id,
            });
          }
        } catch (err: any) {
          failedCount++;
          const errMsg = err.response?.data?.message || err.message || 'Lỗi không xác định';
          setBatchItemsState((prev) => {
            const next = [...prev];
            if (next[idx]) {
              next[idx].status = 'FAILED';
              next[idx].progress = 100;
              next[idx].errorMessage = errMsg;
            }
            return next;
          });
          importLogs.push({
            filename: queueItem.file.name,
            songTitle: queueItem.title,
            artistName: queueItem.artist,
            status: 'FAILED',
            errorMessage: errMsg,
          });
        }
      }
    };

    // Execute workers
    const workers = Array.from({ length: Math.min(concurrency, parsedQueue.length) }, () => runWorker());
    await Promise.all(workers);

    // Save batch summary to DB
    try {
      await adminService.recordImportBatch({
        totalFiles: parsedQueue.length,
        successCount: successCount + skippedCount,
        failedCount,
        logs: importLogs,
      });
    } catch (e) {
      console.warn('Failed to record batch import log:', e);
    }

    setBatchSummary({
      success: successCount,
      skipped: skippedCount,
      failed: failedCount,
      total: parsedQueue.length,
    });
    setIsBatchUploading(false);
    setBatchCompleted(true);
  };

  const handleRetryFailedItem = async (index: number) => {
    const target = batchItemsState[index];
    if (!target) return;

    setBatchItemsState((prev) => {
      const next = [...prev];
      next[index].status = 'UPLOADING';
      next[index].errorMessage = undefined;
      return next;
    });

    try {
      const queueItem = target.item;
      const formData = new FormData();
      formData.append('audioFile', queueItem.file);
      if (queueItem.coverFile) {
        formData.append('coverFile', queueItem.coverFile);
      }
      formData.append('title', queueItem.title.trim());
      formData.append('artistName', queueItem.artist.trim());
      if (queueItem.album) formData.append('albumTitle', queueItem.album.trim());
      if (queueItem.genre) formData.append('genreName', queueItem.genre.trim());
      formData.append('duration', queueItem.duration.toString());
      formData.append('duplicateAction', queueItem.duplicateAction || 'skip');

      const res = await adminService.importSingleSong(formData);

      setBatchItemsState((prev) => {
        const next = [...prev];
        next[index].status = res.data?.status === 'SKIPPED' ? 'SKIPPED' : 'SUCCESS';
        next[index].progress = 100;
        next[index].songId = res.data?.song?.id;
        return next;
      });
    } catch (err: any) {
      setBatchItemsState((prev) => {
        const next = [...prev];
        next[index].status = 'FAILED';
        next[index].errorMessage = err.response?.data?.message || 'Thử lại thất bại.';
        return next;
      });
    }
  };

  // Progress metrics
  const uploadMetrics = useMemo(() => {
    if (batchItemsState.length === 0) return { percent: 0, done: 0, total: 0 };
    const done = batchItemsState.filter((i) => i.status === 'SUCCESS' || i.status === 'SKIPPED' || i.status === 'FAILED').length;
    const total = batchItemsState.length;
    const percent = Math.round((done / total) * 100);
    return { percent, done, total };
  }, [batchItemsState]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & NAVIGATION TABS                                            */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center">
              <Music2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Music Library
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-text-secondary border border-white/10">
                  {totalSongs} songs
                </span>
              </h1>
              <p className="text-xs text-text-muted">
                Quản lý kho nhạc, tải lên MP3 hàng loạt và trích xuất ID3 metadata
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('library')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'library'
                ? 'bg-amber-400 text-black shadow'
                : 'text-text-secondary hover:text-white hover:bg-white/5'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Kho nhạc
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'upload'
                ? 'bg-amber-400 text-black shadow'
                : 'text-text-secondary hover:text-white hover:bg-white/5'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Tải nhạc MP3
            {parsedQueue.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-black/30 text-[10px] flex items-center justify-center">
                {parsedQueue.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-amber-400 text-black shadow'
                : 'text-text-secondary hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Lịch sử Import
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TAB 1: MUSIC LIBRARY DATA TABLE & FILTERS                               */}
      {/* ========================================================================= */}
      {activeTab === 'library' && (
        <div className="space-y-4 animate-fade-in">
          {/* Filter & Search Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Tìm bài hát, nghệ sĩ, album..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full h-9 pl-9 pr-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white placeholder-text-muted outline-none focus:border-amber-400/40 transition-colors"
              />
            </div>

            {/* Genre Filter */}
            <select
              value={selectedGenre}
              onChange={(e) => {
                setSelectedGenre(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-xl bg-[#12141a] border border-white/10 text-xs text-text-secondary outline-none focus:border-amber-400/40 cursor-pointer"
            >
              <option value="">Tất cả thể loại</option>
              {genres.map((g) => (
                <option key={g.id} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>

            {/* Artist Filter */}
            <select
              value={selectedArtist}
              onChange={(e) => {
                setSelectedArtist(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-xl bg-[#12141a] border border-white/10 text-xs text-text-secondary outline-none focus:border-amber-400/40 cursor-pointer"
            >
              <option value="">Tất cả nghệ sĩ</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            {/* Sort Order */}
            <select
              value={sortBy}
              onChange={(e: any) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="h-9 px-3 rounded-xl bg-[#12141a] border border-white/10 text-xs text-text-secondary outline-none focus:border-amber-400/40 cursor-pointer"
            >
              <option value="latest">Mới nhất (Recently Added)</option>
              <option value="popular">Nhiều lượt nghe nhất</option>
              <option value="oldest">Cũ nhất</option>
            </select>
          </div>

          {/* Quick Actions Row */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">
              Hiển thị {songs.length} / {totalSongs} bài hát
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSelectedGenre('');
                  setSelectedArtist('');
                  setSortBy('latest');
                  setPage(1);
                }}
                leftIcon={<RefreshCw className="w-3 h-3" />}
              >
                Làm mới
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setActiveTab('upload')}
                leftIcon={<Upload className="w-3.5 h-3.5" />}
              >
                Tải nhạc MP3
              </Button>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-text-muted uppercase text-[10px] tracking-wider border-b border-white/5 font-semibold">
                  <tr>
                    <th className="p-3.5 w-12 text-center">#</th>
                    <th className="p-3.5">Bài hát</th>
                    <th className="p-3.5">Nghệ sĩ</th>
                    <th className="p-3.5">Album</th>
                    <th className="p-3.5">Thể loại</th>
                    <th className="p-3.5">Thời lượng</th>
                    <th className="p-3.5">Lượt nghe</th>
                    <th className="p-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-text-muted">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto text-amber-400 mb-2" />
                        Đang tải danh sách bài hát...
                      </td>
                    </tr>
                  ) : songs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-text-muted">
                        Không tìm thấy bài hát nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    songs.map((song, index) => {
                      const isCurrent = currentSong?.id === song.id;
                      const isThisPlaying = isCurrent && isPlaying;

                      return (
                        <tr
                          key={song.id}
                          className={`hover:bg-white/[0.02] transition-colors group ${
                            isCurrent ? 'bg-amber-400/5' : ''
                          }`}
                        >
                          {/* Play Button / Index */}
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handlePlayToggle(song)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                                isThisPlaying
                                  ? 'bg-amber-400 text-black shadow'
                                  : 'text-text-muted hover:text-white hover:bg-white/10'
                              }`}
                            >
                              {isThisPlaying ? (
                                <Pause className="w-3.5 h-3.5 fill-current" />
                              ) : (
                                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                              )}
                            </button>
                          </td>

                          {/* Song Title & Artwork */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <img
                                src={song.coverUrl}
                                alt={song.title}
                                className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-white/10 shadow"
                              />
                              <div className="min-w-0 max-w-xs">
                                <span
                                  className={`font-semibold block truncate ${
                                    isCurrent ? 'text-amber-400 font-bold' : 'text-white'
                                  }`}
                                >
                                  {song.title}
                                </span>
                                <span className="text-[11px] text-text-muted font-mono block truncate">
                                  ID: {song.id.slice(0, 8)}...
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Artist */}
                          <td className="p-3.5">
                            <Link
                              to={`/artist/${song.artistId}`}
                              className="text-text-secondary hover:text-white hover:underline flex items-center gap-1.5 truncate max-w-[140px]"
                            >
                              <span>{song.artist?.name || 'Various'}</span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </Link>
                          </td>

                          {/* Album */}
                          <td className="p-3.5">
                            {song.albumId ? (
                              <Link
                                to={`/album/${song.albumId}`}
                                className="text-text-muted hover:text-white hover:underline truncate max-w-[130px] block"
                              >
                                {song.album?.title || 'Single'}
                              </Link>
                            ) : (
                              <span className="text-text-muted">Single</span>
                            )}
                          </td>

                          {/* Genre */}
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] text-text-secondary">
                              {song.genre?.name || 'V-Pop'}
                            </span>
                          </td>

                          {/* Duration */}
                          <td className="p-3.5 font-mono text-text-muted">
                            {formatDuration(song.duration)}
                          </td>

                          {/* Plays Count */}
                          <td className="p-3.5 font-mono text-white">
                            {formatNumber(song.playsCount)}
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Replace MP3 */}
                              <button
                                onClick={() => setReplaceAudioSong(song)}
                                title="Thay thế file MP3"
                                className="p-1.5 rounded-lg text-text-muted hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                              >
                                <FileAudio className="w-3.5 h-3.5" />
                              </button>

                              {/* Replace Cover */}
                              <button
                                onClick={() => setReplaceCoverSong(song)}
                                title="Thay thế ảnh bìa"
                                className="p-1.5 rounded-lg text-text-muted hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit Song */}
                              <button
                                onClick={() => {
                                  setEditingSong(song);
                                  setIsSongModalOpen(true);
                                }}
                                title="Chỉnh sửa thông tin bài hát"
                                className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-white/10 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Song */}
                              <button
                                onClick={() => setDeleteConfirmSong(song)}
                                title="Xóa bài hát"
                                className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-2.5">
            {loading ? (
              <div className="text-center py-8 text-xs text-text-muted">Đang tải danh sách bài hát...</div>
            ) : songs.length === 0 ? (
              <div className="text-center py-8 text-xs text-text-muted">Không tìm thấy bài hát nào.</div>
            ) : (
              songs.map((song) => (
                <div
                  key={song.id}
                  className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={song.coverUrl}
                      alt={song.title}
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-white/10"
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-white text-sm truncate">{song.title}</h4>
                      <p className="text-xs text-text-muted truncate mt-0.5">{song.artist?.name || 'Various'}</p>
                      <div className="flex items-center gap-2 text-[11px] text-text-muted font-mono mt-1">
                        <span>{formatDuration(song.duration)}</span>
                        <span>•</span>
                        <span>{formatNumber(song.playsCount)} lượt nghe</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handlePlayToggle(song)}
                      className="w-9 h-9 rounded-full bg-amber-400 text-black flex items-center justify-center flex-shrink-0 shadow"
                    >
                      {currentSong?.id === song.id && isPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-white/5 text-xs">
                    <button
                      onClick={() => setReplaceAudioSong(song)}
                      className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-text-secondary flex items-center justify-center gap-1"
                    >
                      <FileAudio className="w-3 h-3 text-amber-400" />
                      Đổi MP3
                    </button>
                    <button
                      onClick={() => setReplaceCoverSong(song)}
                      className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-text-secondary flex items-center justify-center gap-1"
                    >
                      <ImageIcon className="w-3 h-3 text-blue-400" />
                      Đổi Bìa
                    </button>
                    <button
                      onClick={() => {
                        setEditingSong(song);
                        setIsSongModalOpen(true);
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-medium text-text-secondary flex items-center justify-center gap-1"
                    >
                      <Edit2 className="w-3 h-3 text-white" />
                      Sửa
                    </button>
                    <button
                      onClick={() => setDeleteConfirmSong(song)}
                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <span className="text-xs text-text-muted">
                Trang {page} / {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
                >
                  Trước
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB 2: BULK MP3 UPLOAD & PREVIEW/EDIT WORKFLOW                          */}
      {/* ========================================================================= */}
      {activeTab === 'upload' && (
        <div className="space-y-6 animate-fade-in">
          {/* Dropzone Container */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDropFiles}
            className="border-2 border-dashed border-white/15 hover:border-amber-400/40 rounded-2xl p-8 sm:p-10 text-center bg-white/[0.01] hover:bg-white/[0.03] transition-all"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".mp3,audio/mpeg"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesSelected(e.target.files);
              }}
            />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              // @ts-ignore
              webkitdirectory=""
              directory=""
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesSelected(e.target.files);
              }}
            />

            <div className="max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-400/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-400/20 shadow-lg">
                <Upload className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Kéo thả file MP3 hoặc thư mục nhạc vào đây
                </h3>
                <p className="text-xs text-text-muted mt-1">
                  Hỗ trợ tải 1 lúc 10, 50, 100, 500+ bài hát (.mp3). Hệ thống tự động trích xuất ID3 tags,
                  ảnh bìa và nhận diện tên file thông minh.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  leftIcon={<Music2 className="w-4 h-4" />}
                >
                  Chọn nhiều file MP3
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => folderInputRef.current?.click()}
                  leftIcon={<FolderPlus className="w-4 h-4" />}
                >
                  Chọn cả thư mục
                </Button>
              </div>
            </div>
          </div>

          {/* Parsing Spinner */}
          {isParsingFiles && (
            <div className="p-4 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-between text-xs text-amber-300">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>
                  Đang đọc metadata ID3 & trích xuất ảnh bìa ({parsingProgress.current} / {parsingProgress.total} files)...
                </span>
              </div>
              <span className="font-mono font-bold">
                {Math.round((parsingProgress.current / (parsingProgress.total || 1)) * 100)}%
              </span>
            </div>
          )}

          {/* Batch Execution Progress Bar */}
          {isBatchUploading && (
            <div className="p-5 rounded-2xl bg-[#12141a] border border-amber-400/30 space-y-3 shadow-2xl">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold text-white">
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Đang tải lên và lưu vào cơ sở dữ liệu...</span>
                </div>
                <span className="font-mono text-amber-400 font-bold">
                  {uploadMetrics.done} / {uploadMetrics.total} songs ({uploadMetrics.percent}%)
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-300 rounded-full"
                  style={{ width: `${uploadMetrics.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Batch Completed Banner */}
          {batchCompleted && (
            <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h4 className="text-sm font-bold text-white">Đợt import đã hoàn tất!</h4>
                    <p className="text-xs text-text-muted mt-0.5">
                      Thành công: <span className="text-emerald-400 font-bold">{batchSummary.success}</span> • 
                      Bỏ qua trùng: <span className="text-amber-400 font-bold">{batchSummary.skipped}</span> • 
                      Thất bại: <span className="text-red-400 font-bold">{batchSummary.failed}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setParsedQueue([]);
                      setBatchItemsState([]);
                      setBatchCompleted(false);
                    }}
                  >
                    Tải tiếp đợt mới
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setActiveTab('library');
                      fetchSongs();
                    }}
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Xem kho nhạc
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* PREVIEW & EDIT TABLE (BEFORE IMPORT) */}
          {parsedQueue.length > 0 && !isBatchUploading && !batchCompleted && (
            <div className="space-y-4">
              {/* Batch Actions Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.08]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">
                    {parsedQueue.length} bài hát sẵn sàng import
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Duplicate Bulk Actions */}
                  {parsedQueue.some((i) => i.duplicateStatus === 'DUPLICATE') && (
                    <div className="flex items-center gap-1.5 text-xs text-text-muted border-r border-white/10 pr-3 mr-1">
                      <span>Bài trùng:</span>
                      <button
                        onClick={() => handleSetAllDuplicateActions('skip')}
                        className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] text-text-secondary"
                      >
                        Bỏ qua tất cả
                      </button>
                      <button
                        onClick={() => handleSetAllDuplicateActions('replace')}
                        className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] text-amber-400"
                      >
                        Ghi đè tất cả
                      </button>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setParsedQueue([])}
                  >
                    Hủy tất cả
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={startBatchImport}
                    leftIcon={<Upload className="w-3.5 h-3.5" />}
                  >
                    Import {parsedQueue.length} Bài Hát
                  </Button>
                </div>
              </div>

              {/* Editable Preview Table */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white/[0.03] text-text-muted uppercase text-[10px] tracking-wider border-b border-white/5 font-semibold">
                      <tr>
                        <th className="p-3.5 w-16">Cover</th>
                        <th className="p-3.5 min-w-[200px]">Tên bài hát</th>
                        <th className="p-3.5 min-w-[180px]">Nghệ sĩ</th>
                        <th className="p-3.5 min-w-[150px]">Album</th>
                        <th className="p-3.5 w-28">Thể loại</th>
                        <th className="p-3.5 w-20">Track</th>
                        <th className="p-3.5 w-24">Thời lượng</th>
                        <th className="p-3.5 w-36">Trạng thái</th>
                        <th className="p-3.5 w-12 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {parsedQueue.map((item) => (
                        <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                          {/* Cover Artwork */}
                          <td className="p-3.5">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                              {item.coverPreviewUrl ? (
                                <img
                                  src={item.coverPreviewUrl}
                                  alt="Cover"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-text-muted" />
                              )}
                            </div>
                          </td>

                          {/* Song Title (Editable) */}
                          <td className="p-3.5">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) => handleUpdateParsedItem(item.id, 'title', e.target.value)}
                              className="w-full h-8 px-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-white font-medium outline-none focus:border-amber-400/50"
                            />
                            <span className="text-[10px] text-text-muted truncate block mt-0.5 max-w-[200px]">
                              {item.file.name}
                            </span>
                          </td>

                          {/* Artist Name (Editable) */}
                          <td className="p-3.5">
                            <input
                              type="text"
                              value={item.artist}
                              onChange={(e) => handleUpdateParsedItem(item.id, 'artist', e.target.value)}
                              className="w-full h-8 px-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-text-secondary outline-none focus:border-amber-400/50"
                            />
                          </td>

                          {/* Album (Editable) */}
                          <td className="p-3.5">
                            <input
                              type="text"
                              value={item.album}
                              onChange={(e) => handleUpdateParsedItem(item.id, 'album', e.target.value)}
                              className="w-full h-8 px-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-text-secondary outline-none focus:border-amber-400/50"
                            />
                          </td>

                          {/* Genre (Editable) */}
                          <td className="p-3.5">
                            <input
                              type="text"
                              value={item.genre}
                              onChange={(e) => handleUpdateParsedItem(item.id, 'genre', e.target.value)}
                              className="w-full h-8 px-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-text-secondary outline-none focus:border-amber-400/50"
                            />
                          </td>

                          {/* Track Number */}
                          <td className="p-3.5">
                            <input
                              type="number"
                              min="1"
                              value={item.trackNumber}
                              onChange={(e) => handleUpdateParsedItem(item.id, 'trackNumber', parseInt(e.target.value, 10) || 1)}
                              className="w-full h-8 px-2 rounded-lg bg-white/[0.04] border border-white/10 text-xs text-center text-text-secondary outline-none focus:border-amber-400/50"
                            />
                          </td>

                          {/* Duration */}
                          <td className="p-3.5 font-mono text-text-muted">
                            {formatDuration(item.duration)}
                          </td>

                          {/* Duplicate Detection & Action Selector */}
                          <td className="p-3.5">
                            {item.duplicateStatus === 'DUPLICATE' ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400/10 text-amber-400 border border-amber-400/20">
                                  <AlertTriangle className="w-3 h-3" />
                                  Trùng lặp
                                </span>
                                <select
                                  value={item.duplicateAction}
                                  onChange={(e: any) => handleUpdateParsedItem(item.id, 'duplicateAction', e.target.value)}
                                  className="w-full h-6 px-1.5 rounded bg-[#12141a] border border-white/10 text-[10px] text-text-secondary outline-none"
                                >
                                  <option value="skip">Bỏ qua (Skip)</option>
                                  <option value="replace">Ghi đè (Replace)</option>
                                  <option value="keep">Giữ cả hai (Keep Both)</option>
                                </select>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Check className="w-3 h-3" />
                                Mới
                              </span>
                            )}
                          </td>

                          {/* Remove button */}
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handleRemoveParsedItem(item.id)}
                              className="p-1 rounded-lg text-text-muted hover:text-red-400 hover:bg-white/5 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* REAL-TIME BATCH EXECUTION STATUS LIST */}
          {batchItemsState.length > 0 && (isBatchUploading || batchCompleted) && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Trạng thái chi tiết từng file ({batchItemsState.length} files)
              </h4>

              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] divide-y divide-white/[0.03] max-h-96 overflow-y-auto">
                {batchItemsState.map((state, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      {state.status === 'UPLOADING' && (
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-400 flex-shrink-0" />
                      )}
                      {state.status === 'SUCCESS' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      )}
                      {state.status === 'SKIPPED' && (
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      )}
                      {state.status === 'FAILED' && (
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      )}
                      {state.status === 'PENDING' && (
                        <div className="w-4 h-4 rounded-full border border-white/20 flex-shrink-0" />
                      )}

                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate max-w-sm">
                          {state.item.title}
                          <span className="text-text-muted font-normal ml-2">
                            • {state.item.artist}
                          </span>
                        </p>
                        <p className="text-[11px] text-text-muted truncate font-mono">
                          {state.item.file.name}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      {state.status === 'FAILED' && (
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 text-[11px]">{state.errorMessage}</span>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleRetryFailedItem(idx)}
                          >
                            Thử lại
                          </Button>
                        </div>
                      )}
                      {state.status === 'SKIPPED' && (
                        <span className="text-amber-400 text-[11px]">Đã bỏ qua (Trùng lặp)</span>
                      )}
                      {state.status === 'SUCCESS' && (
                        <span className="text-emerald-400 text-[11px]">Tải lên thành công</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB 3: IMPORT HISTORY                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Lịch sử các đợt tải nhạc</h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={fetchHistory}
              leftIcon={<RefreshCw className="w-3 h-3" />}
            >
              Làm mới
            </Button>
          </div>

          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-text-muted uppercase text-[10px] tracking-wider border-b border-white/5 font-semibold">
                  <tr>
                    <th className="p-3.5">Thời gian</th>
                    <th className="p-3.5">Tổng số file</th>
                    <th className="p-3.5">Thành công</th>
                    <th className="p-3.5">Thất bại</th>
                    <th className="p-3.5 text-right">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {historyLoading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-text-muted">
                        Đang tải lịch sử import...
                      </td>
                    </tr>
                  ) : historyBatches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-text-muted">
                        Chưa có lịch sử import nào.
                      </td>
                    </tr>
                  ) : (
                    historyBatches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 font-mono text-white">
                          {new Date(batch.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-white">
                          {batch.totalFiles} files
                        </td>
                        <td className="p-3.5 text-emerald-400 font-mono font-semibold">
                          {batch.successCount} thành công
                        </td>
                        <td className="p-3.5 text-red-400 font-mono font-semibold">
                          {batch.failedCount} lỗi
                        </td>
                        <td className="p-3.5 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedBatchDetails(batch)}
                          >
                            Xem chi tiết
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODALS                                                                 */}
      {/* ========================================================================= */}

      {/* Edit Song Modal */}
      <SongModal
        isOpen={isSongModalOpen}
        onClose={() => {
          setIsSongModalOpen(false);
          setEditingSong(null);
        }}
        onSuccess={() => {
          fetchSongs();
          setIsSongModalOpen(false);
          setEditingSong(null);
        }}
        song={editingSong}
      />

      {/* Replace MP3 Audio Modal */}
      <ReplaceAudioModal
        isOpen={!!replaceAudioSong}
        song={replaceAudioSong}
        onClose={() => setReplaceAudioSong(null)}
        onSuccess={() => {
          fetchSongs();
          setReplaceAudioSong(null);
        }}
      />

      {/* Replace Cover Modal */}
      <ReplaceCoverModal
        isOpen={!!replaceCoverSong}
        song={replaceCoverSong}
        onClose={() => setReplaceCoverSong(null)}
        onSuccess={() => {
          fetchSongs();
          setReplaceCoverSong(null);
        }}
      />

      {/* Delete Song Confirmation Modal */}
      {deleteConfirmSong && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-[#12141a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Xác nhận xóa bài hát?</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Hành động này không thể hoàn tác.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 text-xs">
              <p className="font-bold text-white">
                {deleteConfirmSong.title}
                <span className="text-text-muted font-normal ml-2">
                  • {deleteConfirmSong.artist?.name || 'Various'}
                </span>
              </p>
              <ul className="text-text-secondary list-disc list-inside space-y-1 text-[11px]">
                <li>Xóa bản ghi bài hát trong Database</li>
                <li>Xóa file MP3 đã lưu trữ trên Supabase Storage</li>
                <li>Dọn dẹp ảnh bìa liên quan (nếu không dùng chung)</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirmSong(null)}
                disabled={isDeleting}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDeleteSong}
                disabled={isDeleting}
              >
                {isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Details Modal */}
      {selectedBatchDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl bg-[#12141a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-400" />
                  Chi tiết đợt Import
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  {new Date(selectedBatchDetails.createdAt).toLocaleString('vi-VN')} •{' '}
                  {selectedBatchDetails.totalFiles} files
                </p>
              </div>
              <button
                onClick={() => setSelectedBatchDetails(null)}
                className="p-1.5 text-text-muted hover:text-white rounded-lg hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of files */}
            <div className="max-h-96 overflow-y-auto space-y-2 pr-1 divide-y divide-white/5">
              {selectedBatchDetails.logs && selectedBatchDetails.logs.length > 0 ? (
                selectedBatchDetails.logs.map((log) => (
                  <div key={log.id} className="pt-2 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {log.status === 'SUCCESS' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : log.status === 'SKIPPED' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{log.songTitle || log.filename}</p>
                        <p className="text-[11px] text-text-muted font-mono truncate">{log.filename}</p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      {log.status === 'SUCCESS' && (
                        <span className="text-emerald-400 text-[11px]">Thành công</span>
                      )}
                      {log.status === 'SKIPPED' && (
                        <span className="text-amber-400 text-[11px]">Đã bỏ qua</span>
                      )}
                      {log.status === 'FAILED' && (
                        <span className="text-red-400 text-[11px]">{log.errorMessage || 'Lỗi upload'}</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-6 text-xs text-text-muted">Không có log chi tiết.</p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-white/5">
              <Button variant="secondary" size="sm" onClick={() => setSelectedBatchDetails(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

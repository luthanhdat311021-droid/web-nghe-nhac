import React, { useEffect, useState } from 'react';
import {
  Link2,
  Youtube,
  Upload,
  Image,
  FileAudio,
  Check,
  Music2,
  AlertCircle,
  Plus,
  UserPlus,
} from 'lucide-react';
import { Song, Artist, Album, Genre } from '../../types/index.js';
import { adminService } from '../../services/admin.service.js';
import { artistService } from '../../services/artist.service.js';
import { albumService } from '../../services/album.service.js';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Input } from '../common/Input.js';

interface SongModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  song?: Song | null;
}

type AudioSourceOption = 'url' | 'youtube' | 'upload';
type CoverOption = 'url' | 'upload';

// Helper to extract YouTube ID
const getYoutubeId = (url: string): string | null => {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/i
  );
  return match ? match[1] : null;
};

// Duration Helpers
const parseDurationToSeconds = (val: string | number): number => {
  const str = String(val).trim();
  if (str.includes(':')) {
    const parts = str.split(':');
    const m = parseInt(parts[0] || '0', 10);
    const s = parseInt(parts[1] || '0', 10);
    return Math.max(1, m * 60 + s);
  }
  const parsed = parseInt(str, 10);
  return isNaN(parsed) || parsed <= 0 ? 180 : parsed;
};

const formatSecondsToMMSS = (sec: number): string => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const probeClientYoutubeDuration = (ytId: string): Promise<number> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.YT || !window.YT.Player) {
      resolve(0);
      return;
    }

    const containerId = `yt-probe-${Date.now()}`;
    const div = document.createElement('div');
    div.id = containerId;
    div.style.position = 'fixed';
    div.style.left = '-9999px';
    div.style.bottom = '-9999px';
    div.style.width = '200px';
    div.style.height = '200px';
    div.style.opacity = '0';
    div.style.pointerEvents = 'none';
    document.body.appendChild(div);

    let isDone = false;
    let player: any = null;

    const cleanup = (result: number) => {
      if (isDone) return;
      isDone = true;
      clearTimeout(timer);
      try {
        if (player && player.destroy) player.destroy();
      } catch {}
      div.remove();
      resolve(result);
    };

    const timer = setTimeout(() => {
      cleanup(0);
    }, 4000);

    try {
      player = new window.YT.Player(containerId, {
        height: '200',
        width: '200',
        videoId: ytId,
        playerVars: {
          autoplay: 0,
          controls: 0,
        },
        events: {
          onReady: (event: any) => {
            const d = event.target.getDuration();
            if (d && d > 0) {
              cleanup(Math.round(d));
            }
          },
          onStateChange: (event: any) => {
            const d = event.target.getDuration();
            if (d && d > 0) {
              cleanup(Math.round(d));
            }
          },
          onError: () => {
            cleanup(0);
          },
        },
      });
    } catch {
      cleanup(0);
    }
  });
};

export const SongModal: React.FC<SongModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  song,
}) => {
  const [title, setTitle] = useState('');
  const [artistId, setArtistId] = useState('');
  const [albumId, setAlbumId] = useState('');
  const [genreId, setGenreId] = useState('');
  const [duration, setDuration] = useState('180');

  // Audio source state
  const [sourceType, setSourceType] = useState<AudioSourceOption>('url');
  const [audioUrl, setAudioUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [audioFile, setAudioFile] = useState<File | null>(null);

  // Cover image state
  const [coverType, setCoverType] = useState<CoverOption>('url');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');

  // Badges & Lyrics
  const [isTrending, setIsTrending] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);
  const [lyrics, setLyrics] = useState('');
  const [syncedLyrics, setSyncedLyrics] = useState('');

  // Quick Add Artist state
  const [showQuickAddArtist, setShowQuickAddArtist] = useState(false);
  const [newArtistName, setNewArtistName] = useState('');
  const [isCreatingArtist, setIsCreatingArtist] = useState(false);
  const [suggestedArtistName, setSuggestedArtistName] = useState('');

  // Dropdown items
  const [artists, setArtists] = useState<Artist[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [metaFeedback, setMetaFeedback] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadOptions();
      if (song) {
        setTitle(song.title);
        setArtistId(song.artistId);
        setAlbumId(song.albumId || '');
        setGenreId(song.genreId || '');
        setDuration(song.duration.toString());

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

        setCoverUrl(song.coverUrl);
        setCoverPreview(song.coverUrl);
        setIsTrending(song.isTrending);
        setIsFeatured(song.isFeatured);
        setLyrics(song.lyrics?.plainLyrics || '');
        setSyncedLyrics(song.lyrics?.syncedLyrics || '');
      } else {
        resetForm();
      }
    }
  }, [isOpen, song]);

  const loadOptions = async () => {
    try {
      const [artRes, albRes, genRes] = await Promise.all([
        artistService.getAllArtists({ limit: 100 }),
        albumService.getAllAlbums({ limit: 100 }),
        adminService.getAllGenres(),
      ]);
      setArtists(artRes.items);
      setAlbums(albRes.items);
      setGenres(genRes);
    } catch (e) {
      console.error(e);
    }
  };

  const resetForm = () => {
    setTitle('');
    setArtistId('');
    setAlbumId('');
    setGenreId('');
    setDuration('180');
    setSourceType('url');
    setAudioUrl('');
    setYoutubeUrl('');
    setAudioFile(null);
    setCoverType('url');
    setCoverUrl('');
    setCoverFile(null);
    setCoverPreview('');
    setIsTrending(false);
    setIsFeatured(false);
    setLyrics('');
    setSyncedLyrics('');
    setMetaFeedback('');
    setShowQuickAddArtist(false);
    setNewArtistName('');
    setSuggestedArtistName('');
  };

  // Quick Create Artist Handler
  const handleCreateArtist = async (customName?: string) => {
    const targetName = (customName || newArtistName).trim();
    if (!targetName) return;

    try {
      setIsCreatingArtist(true);
      const formData = new FormData();
      formData.append('name', targetName);
      formData.append('verified', 'true');
      formData.append(
        'avatarUrl',
        `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(targetName)}`
      );

      const createdArtist = await adminService.createArtist(formData);

      // Reload artists list
      const artRes = await artistService.getAllArtists({ limit: 100 });
      setArtists(artRes.items);

      if (createdArtist?.id) {
        setArtistId(createdArtist.id);
      } else {
        const found = artRes.items.find(
          (a) => a.name.toLowerCase() === targetName.toLowerCase()
        );
        if (found) setArtistId(found.id);
      }

      setNewArtistName('');
      setShowQuickAddArtist(false);
      setSuggestedArtistName('');
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.data?.existingArtist) {
        const existing = err.response.data.data.existingArtist;
        const artRes = await artistService.getAllArtists({ limit: 100 });
        setArtists(artRes.items);
        setArtistId(existing.id);
        setNewArtistName('');
        setShowQuickAddArtist(false);
        setSuggestedArtistName('');
        return;
      }
      alert(err.response?.data?.message || 'Failed to create artist');
    } finally {
      setIsCreatingArtist(false);
    }
  };

  // Auto-detect Title, Artist, Duration & Cover when YouTube URL is entered
  const handleYoutubeUrlChange = async (url: string) => {
    setYoutubeUrl(url);
    const ytId = getYoutubeId(url);
    if (!ytId) return;

    // Set immediate thumbnail
    const ytThumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    setCoverUrl(ytThumb);
    setCoverPreview(ytThumb);

    // Fetch official video metadata to auto-fill title & duration
    try {
      setIsFetchingMeta(true);
      const [meta, clientDuration] = await Promise.all([
        adminService.getYoutubeInfo(url).catch(() => null),
        probeClientYoutubeDuration(ytId).catch(() => 0),
      ]);

      let finalDur = 0;
      if (clientDuration && clientDuration > 0) {
        finalDur = clientDuration;
      } else if (meta?.duration && meta.duration > 0 && meta.duration !== 180) {
        finalDur = meta.duration;
      } else if (meta?.duration) {
        finalDur = meta.duration;
      }

      if (meta) {
        if (meta.title) {
          setTitle(meta.title);
        }

        // Check if artist matches any existing artist
        if (meta.artistName) {
          const lowerArtist = meta.artistName.toLowerCase();
          const matched = artists.find(
            (a) =>
              lowerArtist.includes(a.name.toLowerCase()) ||
              a.name.toLowerCase().includes(lowerArtist)
          );
          if (matched) {
            setArtistId(matched.id);
            setSuggestedArtistName('');
          } else {
            setSuggestedArtistName(meta.artistName);
          }
        }
      }

      if (finalDur > 0) {
        setDuration(String(finalDur));
        const durLabel = formatSecondsToMMSS(finalDur);
        setMetaFeedback(`Tự động nhận diện: "${meta?.title || 'YouTube Track'}" (${durLabel})`);
      } else if (meta?.title) {
        setMetaFeedback(`Tự động nhận diện: "${meta.title}"`);
      }
    } catch (e) {
      console.warn('Could not auto-fetch YouTube metadata:', e);
    } finally {
      setIsFetchingMeta(false);
    }
  };

  // Auto-detect Title & exact Duration when MP3 is uploaded
  const handleAudioFileChange = (file: File | null) => {
    setAudioFile(file);
    if (file) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!title) {
        setTitle(cleanName);
      }

      try {
        const tempAudio = new Audio(URL.createObjectURL(file));
        tempAudio.onloadedmetadata = () => {
          if (tempAudio.duration && !isNaN(tempAudio.duration)) {
            const sec = Math.round(tempAudio.duration);
            setDuration(String(sec));
            setMetaFeedback(`Tự động nhận diện file: "${cleanName}" (${formatSecondsToMMSS(sec)})`);
          }
        };
      } catch {
        setMetaFeedback(`Nhận diện từ file: "${cleanName}"`);
      }
    }
  };

  const handleCoverFileChange = (file: File | null) => {
    setCoverFile(file);
    if (file) {
      const preview = URL.createObjectURL(file);
      setCoverPreview(preview);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artistId) {
      alert('Song Title and Artist are required');
      return;
    }

    try {
      setLoading(true);
      const finalDuration = parseDurationToSeconds(duration);
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('artistId', artistId);
      if (albumId) formData.append('albumId', albumId);
      if (genreId) formData.append('genreId', genreId);
      formData.append('duration', String(finalDuration));
      formData.append('sourceType', sourceType);

      if (sourceType === 'youtube') {
        const ytId = getYoutubeId(youtubeUrl.trim());
        formData.append('youtubeUrl', youtubeUrl.trim());
        if (ytId) formData.append('youtubeId', ytId);
        formData.append('audioUrl', youtubeUrl.trim());
      } else if (sourceType === 'upload') {
        if (audioFile) {
          formData.append('audioFile', audioFile);
        } else if (audioUrl) {
          formData.append('audioUrl', audioUrl);
        }
      } else {
        formData.append('audioUrl', audioUrl.trim());
      }

      if (coverType === 'upload' && coverFile) {
        formData.append('coverFile', coverFile);
      } else if (coverUrl.trim()) {
        formData.append('coverUrl', coverUrl.trim());
      }

      formData.append('isTrending', String(isTrending));
      formData.append('isFeatured', String(isFeatured));
      if (lyrics) formData.append('lyrics', lyrics);
      if (syncedLyrics) formData.append('syncedLyrics', syncedLyrics);

      if (song) {
        await adminService.updateSong(song.id, formData);
      } else {
        await adminService.createSong(formData);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save song');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={song ? 'Edit song' : 'Add song'}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto no-scrollbar pr-1 pb-2">
        {/* Song Title with Auto-detect Feedback */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Tên bài hát *
            </label>
            {isFetchingMeta && (
              <span className="text-[10px] sm:text-[11px] font-medium text-white flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Đang nhận diện từ YouTube...
              </span>
            )}
          </div>
          <Input
            placeholder="e.g. Nàng Thơ, Chúng Ta Của Hiện Tại..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            leftIcon={<Music2 className="w-4 h-4 text-text-muted" />}
          />
          {metaFeedback && (
            <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              <Check className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{metaFeedback}</span>
            </p>
          )}
        </div>

        {/* Artist & Album */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Nghệ sĩ *
              </label>
              <button
                type="button"
                onClick={() => setShowQuickAddArtist(!showQuickAddArtist)}
                className="text-[11px] font-semibold text-text-secondary hover:text-white flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {showQuickAddArtist ? 'Đóng' : '+ Thêm nghệ sĩ mới'}
              </button>
            </div>

            {/* Quick Add Artist Input Inline */}
            {showQuickAddArtist && (
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-2">
                <span className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-text-muted" />
                  Tạo nhanh nghệ sĩ
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Nhập tên ca sĩ..."
                    value={newArtistName}
                    onChange={(e) => setNewArtistName(e.target.value)}
                    className="flex-1 rounded-lg bg-background-surface border border-white/10 px-3 py-1.5 text-xs text-text-primary outline-none focus:border-white/20"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateArtist();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => handleCreateArtist()}
                    disabled={isCreatingArtist || !newArtistName.trim()}
                  >
                    {isCreatingArtist ? 'Đang tạo...' : 'Tạo'}
                  </Button>
                </div>
              </div>
            )}

            {/* Select Artist Dropdown */}
            <select
              value={artistId}
              onChange={(e) => {
                setArtistId(e.target.value);
                if (e.target.value) setSuggestedArtistName('');
              }}
              required
              className="w-full rounded-xl bg-background-surface border border-white/10 px-3 py-2 text-xs sm:text-sm text-text-primary outline-none focus:border-white/20 transition-colors"
            >
              <option value="">Chọn nghệ sĩ...</option>
              {artists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>

            {/* Smart Suggested Artist button if extracted from YouTube */}
            {suggestedArtistName && (
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/10 text-xs">
                <span className="text-[11px] text-text-secondary truncate">
                  Gợi ý từ YouTube: <strong className="text-white">{suggestedArtistName}</strong>
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCreateArtist(suggestedArtistName)}
                  disabled={isCreatingArtist}
                >
                  + Thêm vào DS
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Album
            </label>
            <select
              value={albumId}
              onChange={(e) => setAlbumId(e.target.value)}
              className="w-full rounded-xl bg-background-surface border border-white/10 px-3 py-2 text-xs sm:text-sm text-text-primary outline-none focus:border-white/20 transition-colors"
            >
              <option value="">Không thuộc album (Single)</option>
              {albums.map((al) => (
                <option key={al.id} value={al.id}>
                  {al.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Genre & Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Thể loại
            </label>
            <select
              value={genreId}
              onChange={(e) => setGenreId(e.target.value)}
              className="w-full rounded-xl bg-background-surface border border-white/10 px-3 py-2 text-xs sm:text-sm text-text-primary outline-none focus:border-white/20 transition-colors"
            >
              <option value="">Chọn thể loại...</option>
              {genres.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Thời lượng (Giây / Số phút tự điền) *
            </label>
            <Input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              required
            />
            <p className="text-[11px] text-text-muted mt-0.5">
              Hiển thị: {formatSecondsToMMSS(parseDurationToSeconds(duration))} ({parseDurationToSeconds(duration)}s)
            </p>
          </div>
        </div>

        {/* Audio Source Options */}
        <div className="space-y-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
            <FileAudio className="w-4 h-4 text-text-muted" />
            Nguồn nhạc
          </span>

          {/* Segmented Buttons for Source Type */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setSourceType('url')}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-medium transition-colors border ${
                sourceType === 'url'
                  ? 'bg-white text-black border-transparent font-semibold'
                  : 'bg-white/[0.03] text-text-secondary hover:text-white border-white/5'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span className="truncate">Direct URL</span>
            </button>

            <button
              type="button"
              onClick={() => setSourceType('youtube')}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-medium transition-colors border ${
                sourceType === 'youtube'
                  ? 'bg-white text-black border-transparent font-semibold'
                  : 'bg-white/[0.03] text-text-secondary hover:text-white border-white/5'
              }`}
            >
              <Youtube className="w-3.5 h-3.5" />
              <span className="truncate">YouTube</span>
            </button>

            <button
              type="button"
              onClick={() => setSourceType('upload')}
              className={`flex items-center justify-center gap-1.5 p-2 rounded-lg text-xs font-medium transition-colors border ${
                sourceType === 'upload'
                  ? 'bg-white text-black border-transparent font-semibold'
                  : 'bg-white/[0.03] text-text-secondary hover:text-white border-white/5'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="truncate">Upload MP3</span>
            </button>
          </div>

          {sourceType === 'url' && (
            <div className="space-y-1 pt-1">
              <Input
                label="Direct Audio URL"
                placeholder="https://example.com/audio.mp3"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                leftIcon={<Link2 className="w-4 h-4" />}
                required
              />
            </div>
          )}

          {sourceType === 'youtube' && (
            <div className="space-y-2 pt-1">
              <Input
                label="YouTube Video / Song URL"
                placeholder="https://www.youtube.com/watch?v=..."
                value={youtubeUrl}
                onChange={(e) => handleYoutubeUrlChange(e.target.value)}
                leftIcon={<Youtube className="w-4 h-4 text-red-400" />}
                required
              />
              {youtubeUrl && getYoutubeId(youtubeUrl) && (
                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.03] border border-white/10">
                  <img
                    src={`https://img.youtube.com/vi/${getYoutubeId(youtubeUrl)}/hqdefault.jpg`}
                    alt="YouTube Preview"
                    className="w-14 h-10 rounded object-cover flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white flex items-center gap-1 truncate">
                      <Check className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                      ID: {getYoutubeId(youtubeUrl)}
                    </p>
                    <p className="text-[10px] text-text-muted truncate">
                      Tự động phát qua YouTube Audio Bridge.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {sourceType === 'upload' && (
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Upload file âm thanh MP3
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-lg border border-dashed border-white/15 bg-white/[0.01]">
                <Upload className="w-5 h-5 text-text-muted flex-shrink-0" />
                <div className="flex-1 w-full">
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => handleAudioFileChange(e.target.files?.[0] || null)}
                    className="w-full text-xs text-text-secondary file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:bg-white file:text-black file:font-semibold cursor-pointer"
                  />
                  {audioFile && (
                    <p className="text-xs text-green-400 font-semibold mt-1 truncate">
                      Đã chọn: {audioFile.name} ({(audioFile.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cover Image */}
        <div className="space-y-2.5 p-3 rounded-xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
              <Image className="w-4 h-4 text-text-muted" />
              Ảnh bìa (Cover Image)
            </span>

            {/* Cover Option Toggle */}
            <div className="inline-flex rounded-lg bg-white/5 p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => setCoverType('url')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  coverType === 'url' ? 'bg-white text-black font-semibold' : 'text-text-muted hover:text-white'
                }`}
              >
                URL
              </button>
              <button
                type="button"
                onClick={() => setCoverType('upload')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  coverType === 'upload' ? 'bg-white text-black font-semibold' : 'text-text-muted hover:text-white'
                }`}
              >
                Upload
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-2 min-w-0">
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
                <div className="p-2 rounded-lg border border-dashed border-white/15 bg-white/[0.01]">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleCoverFileChange(e.target.files?.[0] || null)}
                    className="w-full text-xs text-text-secondary file:mr-3 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:bg-white file:text-black file:font-semibold cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Cover Thumbnail Preview */}
            <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
              {coverPreview ? (
                <img
                  src={coverPreview}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={() => setCoverPreview('')}
                />
              ) : (
                <Image className="w-4 h-4 text-text-muted opacity-40" />
              )}
            </div>
          </div>
        </div>

        {/* Trending & Featured */}
        <div className="flex items-center gap-4 pt-1 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isTrending}
              onChange={(e) => setIsTrending(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 text-white focus:ring-0"
            />
            <span className="text-xs text-white">Thịnh hành (Trending)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="w-4 h-4 rounded border-white/20 text-white focus:ring-0"
            />
            <span className="text-xs text-white">Đề xuất trang chủ</span>
          </label>
        </div>

        {/* Lyrics */}
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Lời bài hát (Văn bản thuần)
            </label>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              rows={2}
              placeholder="Dán lời bài hát tại đây..."
              className="w-full rounded-lg bg-background-surface border border-white/10 px-3 py-2 text-xs text-text-primary outline-none focus:border-white/20 transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Lời bài hát khớp thời gian (JSON / LRC)
            </label>
            <textarea
              value={syncedLyrics}
              onChange={(e) => setSyncedLyrics(e.target.value)}
              rows={2}
              placeholder='[{"time": 0, "text": "Intro..."}]'
              className="w-full rounded-lg bg-background-surface border border-white/10 px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-white/20 transition-colors"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={loading}>
            Save song
          </Button>
        </div>
      </form>
    </Modal>
  );
};

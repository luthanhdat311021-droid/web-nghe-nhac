export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string | null;
  bio?: string | null;
  role: 'USER' | 'ADMIN';
  isBlocked?: boolean;
  createdAt: string;
  _count?: {
    favorites: number;
    playlists: number;
    following: number;
    recentlyPlayed?: number;
  };
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
  color: string;
  coverUrl?: string | null;
  _count?: {
    songs: number;
    albums: number;
  };
}

export interface Artist {
  id: string;
  name: string;
  avatarUrl: string;
  bannerUrl?: string | null;
  biography?: string | null;
  verified: boolean;
  country?: string | null;
  monthlyListeners: number;
  createdBy?: string | null;
  createdAt: string;
  isFollowed?: boolean;
  songs?: Song[];
  albums?: Album[];
  relatedArtists?: Artist[];
  _count?: {
    songs: number;
    albums: number;
    followers: number;
  };
}

export interface Album {
  id: string;
  title: string;
  coverUrl: string;
  releaseDate: string;
  description?: string | null;
  artistId: string;
  genreId?: string | null;
  createdAt: string;
  artist?: Artist;
  genre?: Genre;
  songs?: Song[];
  totalDuration?: number;
  _count?: {
    songs: number;
  };
}

export interface Lyrics {
  id: string;
  songId: string;
  plainLyrics: string;
  syncedLyrics?: string | null;
  isSynced: boolean;
}

export interface SyncedLyricLine {
  time: number;
  text: string;
}

export interface Song {
  id: string;
  title: string;
  artistId: string;
  albumId?: string | null;
  genreId?: string | null;
  duration: number; // seconds
  audioUrl: string;
  coverUrl: string;
  sourceType?: 'url' | 'youtube' | 'upload';
  youtubeUrl?: string | null;
  youtubeId?: string | null;
  playsCount: number;
  releaseDate: string;
  isTrending: boolean;
  isFeatured: boolean;
  createdBy?: string | null;
  createdAt: string;
  artist?: {
    id: string;
    name: string;
    avatarUrl?: string;
    verified?: boolean;
    biography?: string;
  };
  album?: {
    id: string;
    title: string;
    coverUrl?: string;
  };
  genre?: {
    id: string;
    name: string;
    slug?: string;
    color?: string;
  };
  lyrics?: Lyrics;
  isLiked?: boolean;
  position?: number;
  playlistSongId?: string;
}

export interface Playlist {
  id: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  isPublic: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  isOwner?: boolean;
  totalSongs?: number;
  songs?: Song[];
  _count?: {
    songs: number;
  };
}

export interface HistoryItem {
  historyId: string;
  playedAt: string;
  durationPlayed: number;
  song: Song;
}

export interface DashboardStats {
  kpi: {
    totalUsers: number;
    totalSongs: number;
    totalArtists: number;
    totalAlbums: number;
    totalPlaylists: number;
    totalPlays: number;
  };
  chartData: Array<{
    name: string;
    plays: number;
    newUsers: number;
  }>;
  topSongs: Song[];
  recentUsers: User[];
  genresDistribution: Array<{
    name: string;
    songsCount: number;
    color: string;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: any;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DuplicateCheckResult {
  title: string;
  artist: string;
  isDuplicate: boolean;
  existingSongId?: string;
  existingArtistId?: string;
  existingSong?: {
    id: string;
    title: string;
    audioUrl: string;
    coverUrl: string;
    duration: number;
    album?: { id: string; title: string };
  };
}

export interface ImportItemLog {
  id: string;
  batchId: string;
  filename: string;
  songTitle?: string | null;
  artistName?: string | null;
  status: string; // 'SUCCESS' | 'FAILED' | 'SKIPPED'
  errorMessage?: string | null;
  songId?: string | null;
  createdAt: string;
}

export interface ImportBatch {
  id: string;
  totalFiles: number;
  successCount: number;
  failedCount: number;
  createdBy?: string | null;
  createdAt: string;
  logs?: ImportItemLog[];
}

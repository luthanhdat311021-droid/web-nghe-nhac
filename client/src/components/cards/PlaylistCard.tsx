import React, { memo } from 'react';
import { ListMusic, Play } from 'lucide-react';
import { Playlist } from '../../types/index.js';
import { Link } from 'react-router-dom';
import { queryClient, QUERY_KEYS } from '../../services/queryClient.js';
import { playlistService } from '../../services/playlist.service.js';

interface PlaylistCardProps {
  playlist: Playlist;
  className?: string;
}

const PlaylistCardComponent: React.FC<PlaylistCardProps> = ({ playlist, className = '' }) => {
  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.playlistDetail(playlist.id),
      queryFn: () => playlistService.getPlaylistById(playlist.id),
      staleTime: 1000 * 60 * 3,
    });
  };

  return (
    <Link
      to={`/playlist/${playlist.id}`}
      onMouseEnter={handleMouseEnter}
      className={`group relative rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/[0.12] p-2.5 sm:p-3 transition-colors duration-150 active:scale-[0.98] block select-none ${className}`}
    >
      <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2 bg-white/5 flex items-center justify-center shadow-sm">
        {playlist.coverUrl ? (
          <img
            src={playlist.coverUrl}
            alt={playlist.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <ListMusic className="w-10 h-10 text-text-muted opacity-60" />
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hidden sm:flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <h4 className="font-semibold text-xs sm:text-sm text-white truncate group-hover:underline leading-tight">
          {playlist.title}
        </h4>
        <p className="text-[11px] sm:text-xs text-text-muted truncate mt-0.5">
          {playlist.user?.username ? `Bởi ${playlist.user.username} • ` : ''}{playlist._count?.songs ?? playlist.totalSongs ?? 0} bài hát
        </p>
      </div>
    </Link>
  );
};

export const PlaylistCard = memo(PlaylistCardComponent);

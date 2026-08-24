import React, { memo } from 'react';
import { Play } from 'lucide-react';
import { Album } from '../../types/index.js';
import { Link } from 'react-router-dom';
import { formatDate } from '../../utils/format.js';
import { queryClient, QUERY_KEYS } from '../../services/queryClient.js';
import { albumService } from '../../services/album.service.js';

interface AlbumCardProps {
  album: Album;
  className?: string;
}

const AlbumCardComponent: React.FC<AlbumCardProps> = ({ album, className = '' }) => {
  const handleMouseEnter = () => {
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.albumDetail(album.id),
      queryFn: () => albumService.getAlbumById(album.id),
      staleTime: 1000 * 60 * 5,
    });
  };

  return (
    <Link
      to={`/album/${album.id}`}
      onMouseEnter={handleMouseEnter}
      className={`group relative rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/[0.12] p-2.5 sm:p-3 transition-colors duration-150 active:scale-[0.98] block select-none ${className}`}
    >
      <div className="relative aspect-square w-full rounded-lg overflow-hidden mb-2 bg-white/5 shadow-sm">
        <img
          src={album.coverUrl}
          alt={album.title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        {/* Desktop Play Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 hidden sm:flex items-center justify-center">
          <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <h4 className="font-semibold text-xs sm:text-sm text-white truncate group-hover:underline leading-tight">
          {album.title}
        </h4>
        <p className="text-[11px] text-text-muted truncate mt-0.5">
          {album.artist?.name} {album.releaseDate ? `• ${formatDate(album.releaseDate).slice(-4)}` : ''}
        </p>
      </div>
    </Link>
  );
};

export const AlbumCard = memo(AlbumCardComponent);

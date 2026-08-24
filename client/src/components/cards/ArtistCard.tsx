import React, { useState, memo } from 'react';
import { BadgeCheck, UserPlus, Check } from 'lucide-react';
import { Artist } from '../../types/index.js';
import { Link } from 'react-router-dom';
import { formatNumber } from '../../utils/format.js';
import { useAuthStore } from '../../store/authStore.js';
import { artistService } from '../../services/artist.service.js';
import { queryClient, QUERY_KEYS } from '../../services/queryClient.js';

interface ArtistCardProps {
  artist: Artist;
  className?: string;
}

const ArtistCardComponent: React.FC<ArtistCardProps> = ({ artist, className = '' }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [isFollowed, setIsFollowed] = useState(artist.isFollowed || false);

  React.useEffect(() => {
    setIsFollowed(artist.isFollowed || false);
  }, [artist.id, artist.isFollowed]);

  const handleMouseEnter = () => {
    // Intelligent background prefetching when user hovers
    queryClient.prefetchQuery({
      queryKey: QUERY_KEYS.artistDetail(artist.id),
      queryFn: () => artistService.getArtistById(artist.id),
      staleTime: 1000 * 60 * 5,
    });
  };

  const handleFollowClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isAuthenticated) return;

    // 1. INSTANT OPTIMISTIC FEEDBACK (< 1ms)
    const prev = isFollowed;
    const next = !prev;
    setIsFollowed(next);

    try {
      // 2. BACKGROUND API CALL
      const res = await artistService.toggleFollow(artist.id);
      if (res.isFollowed !== next) {
        setIsFollowed(res.isFollowed);
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.followedArtists });
    } catch (err) {
      // Rollback on error
      console.warn('[MusicWave] Follow failed, rollback:', err);
      setIsFollowed(prev);
    }
  };

  return (
    <Link
      to={`/artist/${artist.id}`}
      onMouseEnter={handleMouseEnter}
      className={`group flex flex-col items-center text-center p-2.5 sm:p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.05] hover:border-white/[0.12] transition-colors duration-150 active:scale-[0.98] select-none ${className}`}
    >
      {/* Circular Avatar */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full overflow-hidden mb-2 sm:mb-2.5 shadow border border-white/10 flex-shrink-0">
        <img
          src={artist.avatarUrl}
          alt={artist.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="w-full min-w-0">
        <div className="flex items-center justify-center gap-1">
          <h4 className="font-bold text-xs sm:text-sm text-white truncate group-hover:underline">
            {artist.name}
          </h4>
          {artist.verified && (
            <BadgeCheck className="w-3.5 h-3.5 text-white fill-white/20 flex-shrink-0" />
          )}
        </div>
        <p className="text-[11px] text-text-muted mt-0.5 truncate">
          {formatNumber(artist.monthlyListeners)} người nghe
        </p>
      </div>

      {/* Optimistic Follow Button */}
      <button
        onClick={handleFollowClick}
        aria-label={isFollowed ? 'Đang theo dõi' : 'Theo dõi'}
        className={`mt-2 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 active:scale-95 flex items-center gap-1 ${
          isFollowed
            ? 'bg-white/10 text-white border border-white/15 hover:bg-white/15'
            : 'bg-white/[0.04] text-text-secondary hover:text-white hover:bg-white/[0.08] border border-white/[0.08]'
        }`}
      >
        {isFollowed ? (
          <>
            <Check className="w-3 h-3 text-primary-400" />
            <span>Đang theo dõi</span>
          </>
        ) : (
          <>
            <UserPlus className="w-3 h-3" />
            <span>Theo dõi</span>
          </>
        )}
      </button>
    </Link>
  );
};

export const ArtistCard = memo(ArtistCardComponent);

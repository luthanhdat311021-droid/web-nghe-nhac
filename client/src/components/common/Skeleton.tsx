import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-white/[0.06] rounded-lg ${className}`} />
);

export const SongRowSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/[0.02]">
    <div className="w-5 h-4 bg-white/5 rounded flex-shrink-0 animate-pulse hidden sm:block" />
    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-white/10 flex-shrink-0 animate-pulse" />
    <div className="flex-1 space-y-1.5 min-w-0">
      <div className="h-3.5 bg-white/10 rounded w-2/5 animate-pulse" />
      <div className="h-2.5 bg-white/5 rounded w-1/4 animate-pulse" />
    </div>
    <div className="h-3 bg-white/5 rounded w-10 animate-pulse hidden xs:block" />
  </div>
);

export const SongListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="space-y-1">
    {Array.from({ length: count }).map((_, i) => (
      <SongRowSkeleton key={i} />
    ))}
  </div>
);

export const SongCardSkeleton: React.FC = () => (
  <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 space-y-2.5">
    <div className="aspect-square w-full rounded-lg bg-white/10 animate-pulse" />
    <div className="space-y-1.5">
      <div className="h-3.5 bg-white/10 rounded w-3/4 animate-pulse" />
      <div className="h-2.5 bg-white/5 rounded w-1/2 animate-pulse" />
    </div>
  </div>
);

export const ArtistCardSkeleton: React.FC = () => (
  <div className="flex flex-col items-center text-center p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-3">
    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/10 animate-pulse" />
    <div className="space-y-1.5 w-full flex flex-col items-center">
      <div className="h-3.5 bg-white/10 rounded w-3/4 animate-pulse" />
      <div className="h-2.5 bg-white/5 rounded w-1/2 animate-pulse" />
    </div>
  </div>
);

export const AlbumCardSkeleton: React.FC = () => (
  <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-3 space-y-2.5">
    <div className="aspect-square w-full rounded-lg bg-white/10 animate-pulse" />
    <div className="space-y-1.5">
      <div className="h-3.5 bg-white/10 rounded w-3/4 animate-pulse" />
      <div className="h-2.5 bg-white/5 rounded w-1/2 animate-pulse" />
    </div>
  </div>
);

export const HeaderHeroSkeleton: React.FC = () => (
  <div className="flex flex-col md:flex-row items-center md:items-end gap-5 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse">
    <div className="w-36 h-36 xs:w-44 xs:h-44 md:w-48 md:h-48 rounded-xl bg-white/10 flex-shrink-0" />
    <div className="flex-1 space-y-3 w-full text-center md:text-left">
      <div className="h-3 bg-white/10 rounded w-16 mx-auto md:mx-0" />
      <div className="h-8 bg-white/15 rounded w-3/5 mx-auto md:mx-0" />
      <div className="h-3.5 bg-white/5 rounded w-2/5 mx-auto md:mx-0" />
      <div className="flex gap-2.5 justify-center md:justify-start pt-2">
        <div className="h-9 w-24 rounded-full bg-white/20" />
        <div className="h-9 w-24 rounded-full bg-white/10" />
      </div>
    </div>
  </div>
);

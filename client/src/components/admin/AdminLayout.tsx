import React, { useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Music2,
  Users,
  Disc,
  UserCheck,
  ArrowLeft,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import { BottomPlayer } from '../player/BottomPlayer.js';
import { usePlayerStore } from '../../store/playerStore.js';

export const AdminLayout: React.FC = () => {
  const { user } = useAuthStore();
  const { currentSong } = usePlayerStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Guard: if not logged in or not admin, redirect
  React.useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      navigate('/');
    }
  }, [user, navigate]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-4 py-3 md:py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${
      isActive
        ? 'bg-amber-400/15 text-amber-300 font-bold border border-amber-400/20'
        : 'text-text-secondary hover:text-white hover:bg-white/5'
    }`;

  const mobileTabClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center gap-1 flex-1 py-2 text-[10px] font-semibold transition-all active:scale-95 touch-target ${
      isActive ? 'text-amber-400 font-bold' : 'text-text-muted hover:text-text-secondary'
    }`;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background text-text-primary overflow-hidden w-full max-w-full">
      {/* ========================================================================= */}
      {/* 1. DESKTOP ADMIN SIDEBAR (md+)                                            */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex w-64 bg-background-surface border-r border-white/5 flex-col flex-shrink-0 select-none pb-28">
        {/* Brand */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-black flex items-center justify-center shadow">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-base text-white">
                Admin<span className="text-amber-400">Portal</span>
              </span>
              <span className="block text-[10px] text-text-muted font-bold tracking-widest uppercase">
                MusicWave Management
              </span>
            </div>
          </div>
        </div>

        {/* Admin Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5 no-scrollbar">
          <NavLink to="/admin" end className={navClass}>
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </NavLink>
          <NavLink to="/admin/library" className={navClass}>
            <Music2 className="w-4 h-4" />
            Music Library
          </NavLink>
          <NavLink to="/admin/artists" className={navClass}>
            <Users className="w-4 h-4" />
            Artists Management
          </NavLink>
          <NavLink to="/admin/albums" className={navClass}>
            <Disc className="w-4 h-4" />
            Albums Management
          </NavLink>
          <NavLink to="/admin/users" className={navClass}>
            <UserCheck className="w-4 h-4" />
            Users & Roles
          </NavLink>
        </div>

        {/* Back to Client App */}
        <div className="p-4 border-t border-white/5">
          <Link
            to="/"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white border border-white/10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to MusicWave App
          </Link>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MOBILE ADMIN HEADER (sm/xs)                                            */}
      {/* ========================================================================= */}
      <header className="md:hidden sticky top-0 z-30 bg-background-surface/95 backdrop-blur-xl border-b border-white/10 pt-[env(safe-area-inset-top)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-400 text-black flex items-center justify-center shadow">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <span className="font-extrabold text-sm text-white">
            Admin<span className="text-amber-400">Portal</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-text-secondary hover:text-white flex items-center gap-1 border border-white/10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Client App
          </Link>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 3. MAIN ADMIN CONTENT CONTAINER                                           */}
      {/* ========================================================================= */}
      <main
        className={`flex-1 overflow-y-auto px-4 sm:px-6 md:px-10 py-5 sm:py-8 transition-all no-scrollbar w-full min-w-0 ${
          currentSong
            ? 'pb-[calc(56px+68px+env(safe-area-inset-bottom)+1rem)] md:pb-36'
            : 'pb-[calc(56px+env(safe-area-inset-bottom)+1rem)] md:pb-24'
        }`}
      >
        <Outlet />
      </main>

      {/* Persistent Bottom Player */}
      <BottomPlayer />

      {/* Mobile Admin Bottom Navigation Bar */}
      <nav className="md:hidden fixed left-0 right-0 bottom-0 z-40 bg-background-surface/95 backdrop-blur-2xl border-t border-white/10 flex items-center justify-around px-1 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] shadow-2xl select-none">
        <NavLink to="/admin" end className={mobileTabClass}>
          <LayoutDashboard className="w-4 h-4" />
          <span>Stats</span>
        </NavLink>
        <NavLink to="/admin/library" className={mobileTabClass}>
          <Music2 className="w-4 h-4" />
          <span>Library</span>
        </NavLink>
        <NavLink to="/admin/artists" className={mobileTabClass}>
          <Users className="w-4 h-4" />
          <span>Artists</span>
        </NavLink>
        <NavLink to="/admin/albums" className={mobileTabClass}>
          <Disc className="w-4 h-4" />
          <span>Albums</span>
        </NavLink>
        <NavLink to="/admin/users" className={mobileTabClass}>
          <UserCheck className="w-4 h-4" />
          <span>Users</span>
        </NavLink>
      </nav>
    </div>
  );
};

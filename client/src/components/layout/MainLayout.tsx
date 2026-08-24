import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { Topbar } from './Topbar.js';
import { BottomPlayer } from '../player/BottomPlayer.js';
import { MobileNav } from './MobileNav.js';
import { usePlayerStore } from '../../store/playerStore.js';

export const MainLayout: React.FC = () => {
  const hasCurrentSong = usePlayerStore((state) => Boolean(state.currentSong));

  return (
    <div className="flex h-screen bg-background text-text-primary overflow-hidden w-full max-w-full">
      {/* Desktop & Tablet Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden w-full">
        <Topbar />
        
        <main
          className={`flex-1 overflow-y-auto px-3.5 sm:px-6 md:px-8 py-4 sm:py-6 transition-all no-scrollbar ${
            hasCurrentSong
              ? 'pb-[calc(56px+68px+env(safe-area-inset-bottom)+1rem)] md:pb-28'
              : 'pb-[calc(56px+env(safe-area-inset-bottom)+1rem)] md:pb-8'
          }`}
        >
          <Outlet />
        </main>
      </div>

      {/* Persistent Audio Bottom Player (Mini Player on Mobile, Glass Bar on Desktop) */}
      <BottomPlayer />

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  );
};

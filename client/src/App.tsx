import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { usePlayerStore } from './store/playerStore.js';

// Core Layouts (Loaded synchronously for instant shell rendering)
import { MainLayout } from './components/layout/MainLayout.js';
import { AdminLayout } from './components/admin/AdminLayout.js';
import { YouTubeAudioBridge } from './components/player/YouTubeAudioBridge.js';
import { LogoutConfirmModal } from './components/common/LogoutConfirmModal.js';

// Core User Pages (Synchronously bundled for 0ms instant tab transitions)
import { Home } from './pages/Home.js';
import { Explore } from './pages/Explore.js';
import { Search } from './pages/Search.js';
import { SongDetail } from './pages/SongDetail.js';
import { ArtistDetail } from './pages/ArtistDetail.js';
import { Artists } from './pages/Artists.js';
import { AlbumDetail } from './pages/AlbumDetail.js';
import { Albums } from './pages/Albums.js';
import { PlaylistDetail } from './pages/PlaylistDetail.js';
import { Favorites } from './pages/Favorites.js';
import { History } from './pages/History.js';
import { Library } from './pages/Library.js';
import { Profile } from './pages/Profile.js';
import { Contributions } from './pages/Contributions.js';
import { Login } from './pages/auth/Login.js';
import { Register } from './pages/auth/Register.js';
import { ForgotPassword } from './pages/auth/ForgotPassword.js';

// Admin Pages (Isolated Heavy Bundle)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.js').then((m) => ({ default: m.AdminDashboard })));
const AdminMusicLibrary = lazy(() => import('./pages/admin/AdminMusicLibrary.js').then((m) => ({ default: m.AdminMusicLibrary })));
const AdminArtists = lazy(() => import('./pages/admin/AdminArtists.js').then((m) => ({ default: m.AdminArtists })));
const AdminAlbums = lazy(() => import('./pages/admin/AdminAlbums.js').then((m) => ({ default: m.AdminAlbums })));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers.js').then((m) => ({ default: m.AdminUsers })));

// Admin Route Loading Skeleton
const AdminLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh] w-full">
    <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
  </div>
);

import { prefetchAllCoreData } from './services/prefetch.js';

export const App: React.FC = () => {
  const { fetchMe, token } = useAuthStore();
  const { initAudio } = usePlayerStore();

  useEffect(() => {
    initAudio();
    prefetchAllCoreData(Boolean(token));
    if (token) {
      fetchMe();
    }
  }, [token]);

  return (
    <BrowserRouter>
      <YouTubeAudioBridge />
      <LogoutConfirmModal />
      <Routes>
        {/* Main Client Shell - Instant 0ms switching */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Home />} />
          <Route path="explore" element={<Explore />} />
          <Route path="search" element={<Search />} />
          <Route path="song/:id" element={<SongDetail />} />
          <Route path="artist/:id" element={<ArtistDetail />} />
          <Route path="artists" element={<Artists />} />
          <Route path="album/:id" element={<AlbumDetail />} />
          <Route path="albums" element={<Albums />} />
          <Route path="playlist/:id" element={<PlaylistDetail />} />
          <Route path="library" element={<Library />} />
          <Route path="favorites" element={<Favorites />} />
          <Route path="history" element={<History />} />
          <Route path="profile" element={<Profile />} />
          <Route path="contributions" element={<Contributions />} />
          <Route path="add-song" element={<Contributions />} />
          <Route path="add-artist" element={<Contributions />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
        </Route>

        {/* Admin Suite (Lazy Loaded) */}
        <Route
          path="/admin"
          element={
            <Suspense fallback={<AdminLoader />}>
              <AdminLayout />
            </Suspense>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="library" element={<AdminMusicLibrary />} />
          <Route path="songs" element={<AdminMusicLibrary />} />
          <Route path="artists" element={<AdminArtists />} />
          <Route path="albums" element={<AdminAlbums />} />
          <Route path="users" element={<AdminUsers />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;


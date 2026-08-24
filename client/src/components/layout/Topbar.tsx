import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, User, LogOut, Shield, Music2, Radio, X, Command } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';
import { Button } from '../common/Button.js';
import { SearchDropdown } from './SearchDropdown.js';
import { MobileSearchModal } from './MobileSearchModal.js';
import { searchHistoryUtil } from '../../utils/searchHistory.js';

export const Topbar: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, openLogoutModal } = useAuthStore();
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Global keyboard shortcut Ctrl + K / Cmd + K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setIsDropdownOpen(true);
      } else if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      searchHistoryUtil.addSearch(searchTerm.trim());
      setIsDropdownOpen(false);
      navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate('/search');
    }
  };

  const handleSelectQuery = (q: string) => {
    setSearchTerm(q);
    searchHistoryUtil.addSearch(q);
    setIsDropdownOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#090a0f]/90 backdrop-blur-md border-b border-white/[0.06] pt-[env(safe-area-inset-top)] px-4 md:px-8 transition-all">
        <div className="h-13 sm:h-14 md:h-16 flex items-center justify-between gap-3">
          {/* Mobile Brand (Visible only on mobile) */}
          <Link to="/" className="flex md:hidden items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white text-black flex items-center justify-center shadow">
              <Radio className="w-3.5 h-3.5" />
            </div>
            <span className="font-extrabold text-sm text-white tracking-tight">
              MusicWave
            </span>
          </Link>

          {/* Desktop Search Bar with Realtime AI Smart Dropdown */}
          <div ref={searchContainerRef} className="hidden md:block relative flex-1 max-w-lg">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted transition-colors" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Tìm bài hát, ca sĩ, album, tâm trạng..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (!isDropdownOpen) setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full h-10 pl-10 pr-20 rounded-full bg-white/[0.05] border border-white/[0.08] hover:border-white/[0.15] focus:border-white/25 focus:bg-white/[0.08] text-xs text-white placeholder-text-muted transition-all outline-none"
              />

              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      searchInputRef.current?.focus();
                    }}
                    className="p-1 rounded-full text-text-muted hover:text-white transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="hidden lg:flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono text-text-muted bg-white/[0.04] border border-white/5 select-none">
                    <Command className="w-2.5 h-2.5" /> K
                  </span>
                )}
              </div>
            </form>

            {/* Smart Search Dropdown */}
            <SearchDropdown
              query={searchTerm}
              isOpen={isDropdownOpen}
              onClose={() => setIsDropdownOpen(false)}
              onSelectQuery={handleSelectQuery}
              selectedIndex={-1}
            />
          </div>

          {/* Mobile Search Button Trigger */}
          <button
            onClick={() => setIsMobileSearchOpen(true)}
            className="md:hidden p-2 rounded-full text-text-secondary hover:text-white hover:bg-white/5 active:scale-95 transition-colors touch-target flex items-center justify-center"
            aria-label="Search"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Right User & Notification Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label="Notifications"
                className="p-2 rounded-full text-text-secondary hover:text-white hover:bg-white/5 transition-colors relative active:scale-95 touch-target flex items-center justify-center"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary-400" />
              </button>

              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 top-12 z-30 w-72 sm:w-80 rounded-2xl bg-background-elevated border border-white/10 p-4 shadow-2xl backdrop-blur-2xl">
                    <div className="flex items-center justify-between pb-3 border-b border-white/5">
                      <h4 className="font-bold text-sm text-white">Thông báo</h4>
                      <span className="text-[11px] text-text-muted">Đã đọc hết</span>
                    </div>
                    <div className="py-2 space-y-2">
                      <div className="flex gap-3 p-2 rounded-xl bg-white/[0.03]">
                        <div className="p-2 rounded-lg bg-white/10 text-white flex-shrink-0">
                          <Bell className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white">Chào mừng đến với MusicWave!</p>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            Tìm kiếm bài hát theo tâm trạng, thể loại hoặc nghệ sĩ yêu thích.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* User Account / Login */}
            {isAuthenticated && user ? (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  aria-label="Tài khoản cá nhân"
                  className="flex items-center gap-2 p-0.5 pr-2 rounded-full hover:bg-white/5 border border-white/10 transition-all active:scale-95"
                >
                  <img
                    src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}
                    alt={user.username}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover"
                  />
                  <span className="text-xs font-semibold text-white hidden md:block max-w-[100px] truncate">
                    {user.username}
                  </span>
                </button>

                {showProfileMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setShowProfileMenu(false)}
                    />
                    <div className="absolute right-0 top-12 z-30 w-52 rounded-2xl bg-background-elevated border border-white/10 p-2 shadow-2xl animate-in fade-in zoom-in-95">
                      <div className="px-3 py-2 border-b border-white/5 mb-1">
                        <p className="text-xs font-bold text-white truncate">{user.username}</p>
                        <p className="text-[11px] text-text-muted truncate">{user.email}</p>
                      </div>

                      <Link
                        to="/profile"
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-text-secondary hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                      >
                        <User className="w-4 h-4" />
                        Trang cá nhân
                      </Link>

                      <Link
                        to="/contributions"
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-text-secondary hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                      >
                        <Music2 className="w-4 h-4" />
                        Đóng góp của tôi
                      </Link>

                      {user.role === 'ADMIN' && (
                        <Link
                          to="/admin"
                          onClick={() => setShowProfileMenu(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-400/10 rounded-xl transition-colors"
                        >
                          <Shield className="w-4 h-4" />
                          Admin Dashboard
                        </Link>
                      )}

                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          openLogoutModal();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-xl transition-colors mt-1"
                      >
                        <LogOut className="w-4 h-4" />
                        Đăng xuất
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Đăng nhập
                  </Button>
                </Link>
                <Link to="/register" className="hidden xs:block">
                  <Button variant="primary" size="sm">
                    Đăng ký
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Search Dedicated Modal */}
      <MobileSearchModal
        isOpen={isMobileSearchOpen}
        onClose={() => setIsMobileSearchOpen(false)}
      />
    </>
  );
};

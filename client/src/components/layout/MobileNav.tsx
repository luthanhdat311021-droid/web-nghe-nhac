import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, Library, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';

import { prefetchRoute } from '../../services/prefetch.js';

export const MobileNav: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center gap-1 flex-1 py-1 text-[11px] transition-colors active:scale-95 touch-target ${
      isActive
        ? 'text-white font-bold'
        : 'text-text-muted hover:text-text-secondary'
    }`;

  return (
    <nav className="md:hidden fixed left-0 right-0 bottom-0 z-40 bg-[#0c0e14]/98 border-t border-white/[0.07] flex items-center justify-around px-2 pt-1.5 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] select-none">
      <NavLink to="/" end className={navClass}>
        <Home className="w-5 h-5" />
        <span>Trang chủ</span>
      </NavLink>

      <NavLink to="/search" className={navClass}>
        <Search className="w-5 h-5" />
        <span>Tìm kiếm</span>
      </NavLink>

      <NavLink
        to="/library"
        className={navClass}
        onTouchStart={() => prefetchRoute('library', isAuthenticated)}
      >
        <Library className="w-5 h-5" />
        <span>Thư viện</span>
      </NavLink>

      <NavLink to={isAuthenticated ? '/profile' : '/login'} className={navClass}>
        <User className="w-5 h-5" />
        <span>{isAuthenticated ? 'Cá nhân' : 'Đăng nhập'}</span>
      </NavLink>
    </nav>
  );
};

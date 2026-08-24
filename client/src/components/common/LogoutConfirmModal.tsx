import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import { Modal } from './Modal.js';
import { Button } from './Button.js';

export const LogoutConfirmModal: React.FC = () => {
  const navigate = useNavigate();
  const { isLogoutModalOpen, closeLogoutModal, logout, user } = useAuthStore();

  const handleConfirmLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Modal
      isOpen={isLogoutModalOpen}
      onClose={closeLogoutModal}
      title="Đăng xuất tài khoản"
      maxWidth="sm"
    >
      <div className="space-y-4 pt-1">
        <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-white/[0.03] border border-white/5">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 flex items-center justify-center flex-shrink-0">
            <LogOut className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-semibold text-white">
              Đăng xuất khỏi {user?.username ? `@${user.username}` : 'tài khoản'}?
            </p>
            <p className="text-xs text-text-muted leading-relaxed">
              Bạn có chắc chắn muốn đăng xuất khỏi MusicWave? Dữ liệu bài hát và playlist đã lưu của bạn vẫn được giữ an toàn.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/5">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={closeLogoutModal}
            className="flex-1 sm:flex-none justify-center"
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="danger"
            size="md"
            onClick={handleConfirmLogout}
            leftIcon={<LogOut className="w-4 h-4" />}
            className="flex-1 sm:flex-none justify-center"
          >
            Đăng xuất
          </Button>
        </div>
      </div>
    </Modal>
  );
};

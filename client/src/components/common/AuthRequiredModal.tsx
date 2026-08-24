import React from 'react';
import { LogIn, UserPlus, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal.js';
import { Button } from './Button.js';

interface AuthRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export const AuthRequiredModal: React.FC<AuthRequiredModalProps> = ({
  isOpen,
  onClose,
  title = 'Bạn cần đăng nhập để đóng góp nội dung.',
  description = 'Đăng nhập hoặc đăng ký tài khoản miễn phí để đóng góp nghệ sĩ, bài hát mới và quản lý nội dung của bạn trên MusicWave.',
}) => {
  const navigate = useNavigate();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Yêu cầu đăng nhập" maxWidth="sm">
      <div className="text-center space-y-4 py-2">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 mx-auto flex items-center justify-center text-white">
          <Lock className="w-6 h-6 text-text-secondary" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
          <p className="text-xs text-text-muted leading-relaxed px-2">{description}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
          <Button
            variant="ghost"
            size="md"
            className="w-full sm:w-auto"
            onClick={onClose}
          >
            Để sau
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="w-full sm:w-auto"
            leftIcon={<UserPlus className="w-4 h-4" />}
            onClick={() => {
              onClose();
              navigate('/register');
            }}
          >
            Đăng ký
          </Button>

          <Button
            variant="primary"
            size="md"
            className="w-full sm:w-auto"
            leftIcon={<LogIn className="w-4 h-4" />}
            onClick={() => {
              onClose();
              navigate('/login');
            }}
          >
            Đăng nhập
          </Button>
        </div>
      </div>
    </Modal>
  );
};

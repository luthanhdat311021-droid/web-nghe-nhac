import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Radio, Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/authStore.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login({ identifier: identifier.trim(), password });
      navigate('/');
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Email hoặc mật khẩu không chính xác.'
      );
    }
  };

  const fillAdminCredentials = () => {
    setIdentifier('admin@musicwave.com');
    setPassword('Admin@123456');
  };

  const fillUserCredentials = () => {
    setIdentifier('alex@musicwave.com');
    setPassword('User@123456');
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Card */}
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-lg ring-2 ring-primary-500/20 group-hover:scale-105 transition-transform flex-shrink-0">
              <img src="/logo.png" alt="MusicWave" className="w-full h-full object-cover" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white tracking-tight pt-1">
            Đăng nhập MusicWave
          </h1>
          <p className="text-xs text-text-muted">
            Truy cập danh sách phát, bài hát đã lưu và kho nhạc cá nhân.
          </p>
        </div>

        {/* Form Container */}
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07] space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <Input
              label="Email hoặc tên đăng nhập"
              placeholder="name@example.com"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              leftIcon={<Mail className="w-4 h-4 text-text-muted" />}
              required
            />

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Mật khẩu
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-text-muted hover:text-white transition-colors"
                >
                  Quên mật khẩu?
                </Link>
              </div>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="w-4 h-4 text-text-muted" />}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full justify-center mt-2"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Đăng nhập
            </Button>
          </form>

          {/* Quick Demo Login Helpers */}
          <div className="pt-3 border-t border-white/5 space-y-2">
            <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block text-center">
              Tài khoản dùng thử
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={fillAdminCredentials}
                leftIcon={<ShieldCheck className="w-3.5 h-3.5" />}
              >
                Admin Demo
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={fillUserCredentials}
              >
                User Demo
              </Button>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-text-muted">
          Chưa có tài khoản?{' '}
          <Link
            to="/register"
            className="text-white font-semibold hover:underline transition-colors"
          >
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
};

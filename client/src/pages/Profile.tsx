import React, { useState } from 'react';
import { useAuthStore } from '../store/authStore.js';
import { authService } from '../services/auth.service.js';
import { User as UserIcon, Lock, Mail, Shield, Save, Check, LogOut, Music2 } from 'lucide-react';
import { Button } from '../components/common/Button.js';
import { Input } from '../components/common/Input.js';
import { useNavigate } from 'react-router-dom';

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser, openLogoutModal } = useAuthStore();
  const [username, setUsername] = useState(user?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingProfile(true);
      const updated = await authService.updateProfile({
        username: username.trim(),
        avatarUrl: avatarUrl.trim() || undefined,
        bio: bio.trim(),
      });
      updateUser(updated);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể cập nhật hồ sơ.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    if (newPassword !== confirmPassword) {
      setPasswordError('Mật khẩu mới không khớp.');
      return;
    }
    try {
      setChangingPassword(true);
      await authService.changePassword({ currentPassword, newPassword });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || 'Không thể đổi mật khẩu.');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 overflow-x-hidden">
      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-center gap-5 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden shadow border-2 border-white/10 flex-shrink-0">
          <img
            src={user.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'}
            alt={user.username}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 text-center md:text-left space-y-1.5 min-w-0 w-full">
          <div className="flex items-center justify-center md:justify-start gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{user.username}</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-white/10 text-white border border-white/10">
              {user.role}
            </span>
          </div>

          <p className="text-xs text-text-muted flex items-center justify-center md:justify-start gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            {user.email}
          </p>

          {user.bio && <p className="text-xs text-text-secondary pt-1 line-clamp-2">{user.bio}</p>}

          <div className="flex items-center justify-center md:justify-start gap-2 pt-2 flex-wrap">
            <Button
              onClick={() => navigate('/contributions')}
              variant="primary"
              size="sm"
              leftIcon={<Music2 className="w-3.5 h-3.5" />}
            >
              Đóng góp của tôi
            </Button>

            <Button
              onClick={openLogoutModal}
              variant="danger"
              size="sm"
              leftIcon={<LogOut className="w-4 h-4" />}
            >
              Đăng xuất
            </Button>
          </div>
        </div>
      </div>

      {/* Contributions Quick Access Card */}
      <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 text-center sm:text-left">
          <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-white flex-shrink-0">
            <Music2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">Trung tâm Đóng góp của bạn</h3>
            <p className="text-xs text-text-muted mt-0.5">
              Thêm bài hát mới, tạo nghệ sĩ và quản lý các nội dung bạn đã đóng góp cho MusicWave.
            </p>
          </div>
        </div>

        <Button
          onClick={() => navigate('/contributions')}
          variant="secondary"
          size="sm"
          className="whitespace-nowrap w-full sm:w-auto justify-center"
        >
          Quản lý đóng góp →
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Edit Profile Form */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-text-muted" />
              Chỉnh sửa thông tin
            </h3>
            {profileSuccess && (
              <span className="text-xs text-green-400 flex items-center gap-1 font-semibold">
                <Check className="w-3.5 h-3.5" /> Đã lưu
              </span>
            )}
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-3">
            <Input
              label="Tên hiển thị"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <Input
              label="Avatar URL"
              placeholder="https://..."
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
            />
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Tiểu sử
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full rounded-lg bg-background-surface border border-white/10 px-3 py-2 text-xs text-text-primary placeholder-text-muted outline-none focus:border-white/20"
                placeholder="Giới thiệu đôi nét về bạn..."
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full justify-center mt-1"
              isLoading={savingProfile}
              leftIcon={<Save className="w-4 h-4" />}
            >
              Save changes
            </Button>
          </form>
        </div>

        {/* Change Password Form */}
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Lock className="w-4 h-4 text-text-muted" />
              Đổi mật khẩu
            </h3>
            {passwordSuccess && (
              <span className="text-xs text-green-400 flex items-center gap-1 font-semibold">
                <Check className="w-3.5 h-3.5" /> Đã đổi
              </span>
            )}
          </div>

          {passwordError && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {passwordError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3">
            <Input
              type="password"
              label="Mật khẩu hiện tại"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              label="Mật khẩu mới"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              type="password"
              label="Xác nhận mật khẩu mới"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="secondary"
              size="md"
              className="w-full justify-center mt-1"
              isLoading={changingPassword}
              leftIcon={<Shield className="w-4 h-4" />}
            >
              Update password
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

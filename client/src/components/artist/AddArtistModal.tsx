import React, { useEffect, useState, useRef } from 'react';
import {
  Upload,
  Image as ImageIcon,
  User,
  AlertCircle,
  Check,
  ExternalLink,
  X,
  Globe,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Artist } from '../../types/index.js';
import { artistService } from '../../services/artist.service.js';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Input } from '../common/Input.js';

interface AddArtistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (artist: Artist) => void;
  artist?: Artist | null;
  initialName?: string;
}

export const AddArtistModal: React.FC<AddArtistModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  artist,
  initialName = '',
}) => {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [avatarType, setAvatarType] = useState<'url' | 'upload'>('url');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [biography, setBiography] = useState('');
  const [monthlyListeners, setMonthlyListeners] = useState('15000');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [duplicateArtist, setDuplicateArtist] = useState<Artist | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<Artist[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const searchTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage('');
      setDuplicateArtist(null);
      setShowUnsavedWarning(false);

      if (artist) {
        setName(artist.name);
        setCountry(artist.country || '');
        setAvatarUrl(artist.avatarUrl || '');
        setAvatarPreview(artist.avatarUrl || '');
        setAvatarType('url');
        setAvatarFile(null);
        setBannerUrl(artist.bannerUrl || '');
        setBiography(artist.biography || '');
        setMonthlyListeners(artist.monthlyListeners?.toString() || '15000');
      } else {
        setName(initialName);
        setCountry('');
        setAvatarUrl('');
        setAvatarPreview('');
        setAvatarType('url');
        setAvatarFile(null);
        setBannerUrl('');
        setBiography('');
        setMonthlyListeners('15000');
      }
    }
  }, [isOpen, artist, initialName]);

  // Live duplicate suggestion check
  useEffect(() => {
    if (!isOpen || artist) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = name.trim();
    if (trimmed.length >= 2) {
      setIsSearchingSuggestions(true);
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await artistService.getAllArtists({ search: trimmed, limit: 3 });
          setSuggestions(res.items);
          const exactMatch = res.items.find(
            (a) => a.name.toLowerCase() === trimmed.toLowerCase()
          );
          if (exactMatch) {
            setDuplicateArtist(exactMatch);
          } else {
            setDuplicateArtist(null);
          }
        } catch {
          // ignore
        } finally {
          setIsSearchingSuggestions(false);
        }
      }, 350);
    } else {
      setSuggestions([]);
      setDuplicateArtist(null);
      setIsSearchingSuggestions(false);
    }

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [name, isOpen, artist]);

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setErrorMessage('File ảnh đại diện không được vượt quá 10MB.');
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setErrorMessage('');
    }
  };

  const isFormDirty = () => {
    if (artist) return true;
    return !!(name.trim() || country.trim() || avatarUrl.trim() || avatarFile || biography.trim());
  };

  const handleSafeClose = () => {
    if (isFormDirty()) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Vui lòng nhập tên nghệ sĩ.');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('name', trimmedName);
      if (country.trim()) formData.append('country', country.trim());
      if (biography.trim()) formData.append('biography', biography.trim());
      if (bannerUrl.trim()) formData.append('bannerUrl', bannerUrl.trim());
      formData.append('monthlyListeners', monthlyListeners);

      if (avatarType === 'upload' && avatarFile) {
        formData.append('avatarFile', avatarFile);
      } else if (avatarUrl.trim()) {
        formData.append('avatarUrl', avatarUrl.trim());
      }

      let savedArtist: Artist;
      if (artist) {
        savedArtist = await artistService.updateArtist(artist.id, formData);
      } else {
        savedArtist = await artistService.createArtist(formData);
      }

      onSuccess(savedArtist);
      onClose();
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.data?.existingArtist) {
        const existing = err.response.data.data.existingArtist;
        // Auto-select existing artist when duplicate is encountered on create
        onSuccess(existing);
        onClose();
        return;
      }
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi lưu nghệ sĩ.';
      setErrorMessage(msg);
      if (err.response?.status === 409 && err.response?.data?.data?.existingArtist) {
        setDuplicateArtist(err.response.data.data.existingArtist);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleSafeClose}
        title={artist ? 'Chỉnh sửa nghệ sĩ' : 'Thêm nghệ sĩ mới'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 no-scrollbar">
          {/* Error / Duplicate Alert */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-xs text-red-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p>{errorMessage}</p>
                {duplicateArtist && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate(`/artist/${duplicateArtist.id}`);
                    }}
                    className="inline-flex items-center gap-1 font-semibold text-white underline hover:text-primary-300 transition-colors"
                  >
                    Xem nghệ sĩ "{duplicateArtist.name}" <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Artist Name */}
          <div className="space-y-1">
            <Input
              label="Tên nghệ sĩ *"
              placeholder="e.g. Vũ., Sơn Tùng M-TP, Taylor Swift..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />

            {/* Suggestions dropdown if matching */}
            {suggestions.length > 0 && !artist && (
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-1.5 mt-1">
                <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block">
                  Nghệ sĩ đã có trên hệ thống:
                </span>
                <div className="space-y-1">
                  {suggestions.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <img
                          src={s.avatarUrl}
                          alt={s.name}
                          className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                        />
                        <span className="font-semibold text-white truncate">{s.name}</span>
                        {s.country && <span className="text-[10px] text-text-muted">({s.country})</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onSuccess(s);
                          onClose();
                        }}
                        className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white/10 text-white hover:bg-white/20 transition-colors whitespace-nowrap"
                      >
                        Chọn nghệ sĩ này
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Country & Listeners */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Quốc gia"
              placeholder="e.g. Việt Nam, US-UK, Hàn Quốc..."
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
            <Input
              type="number"
              label="Người nghe hàng tháng (ước tính)"
              placeholder="15000"
              value={monthlyListeners}
              onChange={(e) => setMonthlyListeners(e.target.value)}
            />
          </div>

          {/* Avatar Source Tabs */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Ảnh đại diện (Avatar)
            </label>

            <div className="flex items-center gap-2 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] w-fit">
              <button
                type="button"
                onClick={() => setAvatarType('url')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  avatarType === 'url' ? 'bg-white text-black' : 'text-text-muted hover:text-white'
                }`}
              >
                Image URL
              </button>
              <button
                type="button"
                onClick={() => setAvatarType('upload')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  avatarType === 'upload' ? 'bg-white text-black' : 'text-text-muted hover:text-white'
                }`}
              >
                Tải ảnh lên
              </button>
            </div>

            {avatarType === 'url' ? (
              <Input
                placeholder="https://images.unsplash.com/..."
                value={avatarUrl}
                onChange={(e) => {
                  setAvatarUrl(e.target.value);
                  setAvatarPreview(e.target.value);
                }}
              />
            ) : (
              <div className="border border-dashed border-white/20 hover:border-white/40 rounded-xl p-4 text-center cursor-pointer transition-colors relative bg-white/[0.02]">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <Upload className="w-5 h-5 text-text-muted mx-auto mb-1.5" />
                <p className="text-xs text-white font-medium">
                  {avatarFile ? avatarFile.name : 'Chọn file ảnh từ thiết bị (JPG, PNG, WebP)'}
                </p>
                <p className="text-[11px] text-text-muted mt-0.5">Tối đa 10MB</p>
              </div>
            )}

            {/* Avatar Preview */}
            {avatarPreview && (
              <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.02] border border-white/[0.06] w-fit">
                <img
                  src={avatarPreview}
                  alt="Preview"
                  className="w-12 h-12 rounded-full object-cover border border-white/10"
                  onError={() => setAvatarPreview('')}
                />
                <div>
                  <span className="text-xs font-semibold text-white block">Xem trước ảnh đại diện</span>
                  <span className="text-[10px] text-green-400 flex items-center gap-1 font-medium">
                    <Check className="w-3 h-3" /> Hợp lệ
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Banner URL */}
          <Input
            label="Ảnh bìa trang cá nhân (Banner URL - Tùy chọn)"
            placeholder="https://images.unsplash.com/..."
            value={bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
          />

          {/* Biography */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Tiểu sử / Mô tả
            </label>
            <textarea
              value={biography}
              onChange={(e) => setBiography(e.target.value)}
              rows={3}
              placeholder="Giới thiệu về nghệ sĩ, phong cách âm nhạc, các cột mốc nổi bật..."
              className="w-full rounded-xl bg-background-surface border border-white/10 px-3 py-2 text-xs text-text-primary placeholder-text-muted outline-none focus:border-white/25 transition-colors"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
            <Button type="button" variant="ghost" size="sm" onClick={handleSafeClose}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={loading}
            >
              {artist ? 'Lưu thay đổi' : 'Thêm nghệ sĩ'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Unsaved Changes Confirmation Modal */}
      <Modal
        isOpen={showUnsavedWarning}
        onClose={() => setShowUnsavedWarning(false)}
        title="Thay đổi chưa được lưu"
        maxWidth="sm"
      >
        <div className="space-y-3 py-1">
          <p className="text-xs text-text-secondary">
            Bạn có các thông tin đã nhập chưa được lưu lại. Bạn có chắc muốn đóng và bỏ các thay đổi này?
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowUnsavedWarning(false)}
            >
              Tiếp tục chỉnh sửa
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => {
                setShowUnsavedWarning(false);
                onClose();
              }}
            >
              Bỏ thay đổi
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

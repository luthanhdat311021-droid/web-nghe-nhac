import React, { useEffect, useState } from 'react';
import { Artist } from '../../types/index.js';
import { adminService } from '../../services/admin.service.js';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Input } from '../common/Input.js';

interface ArtistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  artist?: Artist | null;
}

export const ArtistModal: React.FC<ArtistModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  artist,
}) => {
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [biography, setBiography] = useState('');
  const [verified, setVerified] = useState(true);
  const [monthlyListeners, setMonthlyListeners] = useState('50000');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (artist) {
        setName(artist.name);
        setCountry(artist.country || '');
        setAvatarUrl(artist.avatarUrl);
        setBannerUrl(artist.bannerUrl || '');
        setBiography(artist.biography || '');
        setVerified(artist.verified);
        setMonthlyListeners(artist.monthlyListeners.toString());
      } else {
        setName('');
        setCountry('');
        setAvatarUrl('');
        setBannerUrl('');
        setBiography('');
        setVerified(true);
        setMonthlyListeners('50000');
      }
    }
  }, [isOpen, artist]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('name', name.trim());
      if (country) formData.append('country', country.trim());
      if (avatarUrl) formData.append('avatarUrl', avatarUrl.trim());
      if (bannerUrl) formData.append('bannerUrl', bannerUrl.trim());
      if (biography) formData.append('biography', biography.trim());
      formData.append('verified', String(verified));
      formData.append('monthlyListeners', monthlyListeners);

      if (artist) {
        await adminService.updateArtist(artist.id, formData);
      } else {
        await adminService.createArtist(formData);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save artist');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={artist ? 'Edit artist' : 'Add artist'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <Input
          label="Tên nghệ sĩ *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quốc gia"
            placeholder="e.g. Việt Nam"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
          />
          <Input
            type="number"
            label="Người nghe hàng tháng"
            value={monthlyListeners}
            onChange={(e) => setMonthlyListeners(e.target.value)}
          />
        </div>
        <Input
          label="Avatar URL"
          placeholder="https://images.unsplash.com/..."
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
        />
        <Input
          label="Banner URL"
          placeholder="https://images.unsplash.com/..."
          value={bannerUrl}
          onChange={(e) => setBannerUrl(e.target.value)}
        />
        <div className="space-y-1">
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Tiểu sử
          </label>
          <textarea
            value={biography}
            onChange={(e) => setBiography(e.target.value)}
            rows={3}
            className="w-full rounded-lg bg-background-surface border border-white/10 px-3 py-2 text-xs text-text-primary outline-none focus:border-white/20"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 text-white focus:ring-0"
          />
          <span className="text-xs text-white">Đã xác minh (Verified)</span>
        </label>
        <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={loading}>
            Save artist
          </Button>
        </div>
      </form>
    </Modal>
  );
};

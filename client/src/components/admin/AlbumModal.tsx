import React, { useEffect, useState } from 'react';
import { Album, Artist, Genre } from '../../types/index.js';
import { adminService } from '../../services/admin.service.js';
import { artistService } from '../../services/artist.service.js';
import { Modal } from '../common/Modal.js';
import { Button } from '../common/Button.js';
import { Input } from '../common/Input.js';

interface AlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  album?: Album | null;
}

export const AlbumModal: React.FC<AlbumModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  album,
}) => {
  const [title, setTitle] = useState('');
  const [artistId, setArtistId] = useState('');
  const [genreId, setGenreId] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [description, setDescription] = useState('');
  const [artists, setArtists] = useState<Artist[]>([]);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadOptions();
      if (album) {
        setTitle(album.title);
        setArtistId(album.artistId);
        setGenreId(album.genreId || '');
        setCoverUrl(album.coverUrl);
        setDescription(album.description || '');
      } else {
        setTitle('');
        setArtistId('');
        setGenreId('');
        setCoverUrl('');
        setDescription('');
      }
    }
  }, [isOpen, album]);

  const loadOptions = async () => {
    try {
      const [artRes, genRes] = await Promise.all([
        artistService.getAllArtists({ limit: 100 }),
        adminService.getAllGenres(),
      ]);
      setArtists(artRes.items);
      setGenres(genRes);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !artistId) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('artistId', artistId);
      if (genreId) formData.append('genreId', genreId);
      if (coverUrl) formData.append('coverUrl', coverUrl.trim());
      if (description) formData.append('description', description.trim());

      if (album) {
        await adminService.updateAlbum(album.id, formData);
      } else {
        await adminService.createAlbum(formData);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save album');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={album ? 'Edit album' : 'Add album'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        <Input
          label="Tên album *"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Nghệ sĩ *
          </label>
          <select
            value={artistId}
            onChange={(e) => setArtistId(e.target.value)}
            required
            className="w-full rounded-lg bg-background-surface border border-white/10 px-3 py-2 text-xs text-text-primary outline-none focus:border-white/20"
          >
            <option value="">Chọn nghệ sĩ...</option>
            {artists.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Thể loại
          </label>
          <select
            value={genreId}
            onChange={(e) => setGenreId(e.target.value)}
            className="w-full rounded-lg bg-background-surface border border-white/10 px-3 py-2 text-xs text-text-primary outline-none focus:border-white/20"
          >
            <option value="">Chọn thể loại...</option>
            {genres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Ảnh bìa URL"
          placeholder="https://images.unsplash.com/..."
          value={coverUrl}
          onChange={(e) => setCoverUrl(e.target.value)}
        />

        <div className="space-y-1">
          <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Mô tả
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg bg-background-surface border border-white/10 px-3 py-2 text-xs text-text-primary outline-none focus:border-white/20"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={loading}>
            Save album
          </Button>
        </div>
      </form>
    </Modal>
  );
};

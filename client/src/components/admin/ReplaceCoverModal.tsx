import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Loader2, AlertCircle } from 'lucide-react';
import { Song } from '../../types/index.js';
import { adminService } from '../../services/admin.service.js';
import { Button } from '../common/Button.js';

interface ReplaceCoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | null;
  onSuccess: () => void;
}

export const ReplaceCoverModal: React.FC<ReplaceCoverModalProps> = ({
  isOpen,
  onClose,
  song,
  onSuccess,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !song) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.type.startsWith('image/')) {
      setError('Chỉ chấp nhận file ảnh (JPG, PNG, WebP).');
      return;
    }

    setError(null);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;

    if (!dropped.type.startsWith('image/')) {
      setError('Chỉ chấp nhận file ảnh (JPG, PNG, WebP).');
      return;
    }

    setError(null);
    setFile(dropped);
    setPreviewUrl(URL.createObjectURL(dropped));
  };

  const handleSubmit = async () => {
    if (!file) {
      setError('Vui lòng chọn file ảnh mới.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const formData = new FormData();
      formData.append('coverFile', file);

      await adminService.replaceSongCover(song.id, formData);
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể thay thế ảnh bìa. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setFile(null);
    setPreviewUrl(null);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#12141a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-amber-400" />
              Thay thế ảnh bìa
            </h3>
            <p className="text-xs text-text-muted mt-0.5 truncate max-w-xs">
              {song.title} • {song.artist?.name || 'Various'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-text-muted hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dropzone & Preview */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
            previewUrl
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : 'border-white/10 hover:border-white/20 bg-white/[0.02] hover:bg-white/[0.04]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
          {previewUrl ? (
            <div className="space-y-2">
              <img
                src={previewUrl}
                alt="New Cover Preview"
                className="w-28 h-28 mx-auto rounded-xl object-cover shadow-lg border border-white/10"
              />
              <p className="text-xs font-semibold text-white truncate max-w-xs mx-auto">
                {file?.name}
              </p>
              <p className="text-[10px] text-text-secondary">Bấm để chọn ảnh khác</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-7 h-7 text-text-muted mx-auto" />
              <div>
                <p className="text-xs font-medium text-white">Kéo thả ảnh bìa mới vào đây</p>
                <p className="text-[11px] text-text-muted mt-0.5">JPG, PNG, WebP (Khuyên dùng tỷ lệ 1:1)</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/5">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={loading}>
            Hủy
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            disabled={!file || loading}
            leftIcon={loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
          >
            {loading ? 'Đang cập nhật...' : 'Xác nhận thay thế'}
          </Button>
        </div>
      </div>
    </div>
  );
};

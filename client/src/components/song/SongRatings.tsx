import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Crown } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { songService, SongRatingSummary } from '../../services/song.service.js';
import { useAuthStore } from '../../store/authStore.js';
import { Button } from '../common/Button.js';
import { formatDate } from '../../utils/format.js';

const Stars: React.FC<{ value: number; size?: string; onPick?: (v: number) => void }> = ({ value, size = 'w-4 h-4', onPick }) => {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = <Star className={`${size} ${n <= Math.round(shown) ? 'text-amber-300 fill-current' : 'text-white/20'}`} />;
        return onPick ? (
          <button key={n} type="button" aria-label={`${n} sao`} onMouseEnter={() => setHover(n)} onClick={() => onPick(n)}
            className="p-0.5 active:scale-90 transition-transform">{icon}</button>
        ) : <span key={n}>{icon}</span>;
      })}
    </div>
  );
};

export const SongRatings: React.FC<{ songId: string }> = ({ songId }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const queryKey = ['songs', 'ratings', songId, isAuthenticated];
  const { data } = useQuery<SongRatingSummary>({ queryKey, queryFn: () => songService.getRatings(songId) });

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRating(data?.myRating?.rating || 0);
    setComment(data?.myRating?.comment || '');
  }, [data?.myRating?.id, data?.myRating?.updatedAt]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['songs', 'ratings', songId] });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return setError('Vui lòng chọn số sao.');
    setSaving(true);
    setError(null);
    try {
      await songService.rateSong(songId, rating, comment.trim() || undefined);
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể lưu đánh giá.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setError(null);
    try {
      await songService.deleteRating(songId);
      await refresh();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể xóa đánh giá.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-3 pt-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Đánh giá</h2>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Stars value={data?.average || 0} />
          <span className="font-bold text-white">{data?.count ? data.average.toFixed(1) : '–'}</span>
          <span>({data?.count || 0} lượt)</span>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
        {data?.canRate ? (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-text-secondary">{data.myRating ? 'Đánh giá của bạn' : 'Chấm điểm bài hát'}</span>
              <Stars value={rating} size="w-6 h-6" onPick={setRating} />
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Viết nhận xét (không bắt buộc)"
              className="w-full rounded-xl bg-black/20 border border-white/10 p-3 text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-primary/60 resize-none"
            />
            {error && <p className="text-xs text-rose-400">{error}</p>}
            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" size="sm" disabled={saving}>
                {saving ? 'Đang lưu…' : data.myRating ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
              </Button>
              {data.myRating && (
                <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={handleDelete}>Xóa</Button>
              )}
            </div>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-text-secondary">
            <p className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-300" />
              {isAuthenticated ? 'Chỉ tài khoản Music Pro mới được đánh giá bài hát.' : 'Đăng nhập bằng tài khoản Music Pro để đánh giá bài hát.'}
            </p>
            <Link to={isAuthenticated ? '/music-pro' : '/login'} className="text-xs font-bold text-amber-300 hover:underline whitespace-nowrap">
              {isAuthenticated ? 'Nâng cấp Music Pro' : 'Đăng nhập'}
            </Link>
          </div>
        )}
      </div>

      {data && data.items.length > 0 && (
        <div className="space-y-2">
          {data.items.map((r) => (
            <div key={r.id} className="flex gap-3 p-3 rounded-xl bg-white/[0.02]">
              <img src={r.user?.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(r.user?.username || r.userId)}`}
                alt="" className="w-8 h-8 rounded-full bg-white/5 flex-shrink-0" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-white break-all">{r.user?.username}</span>
                  <Stars value={r.rating} size="w-3 h-3" />
                  <span className="text-[11px] text-text-muted">{formatDate(r.updatedAt)}</span>
                </div>
                {r.comment && <p className="text-sm text-text-secondary whitespace-pre-line break-words">{r.comment}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

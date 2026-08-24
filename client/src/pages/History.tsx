import React, { useState } from 'react';
import { History as HistoryIcon, Trash2, Clock, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { HistoryItem } from '../types/index.js';
import { historyService } from '../services/history.service.js';
import { useAuthStore } from '../store/authStore.js';
import { usePlayerStore } from '../store/playerStore.js';
import { useFavoriteStore } from '../store/favoriteStore.js';
import { SongRow } from '../components/cards/SongRow.js';
import { Button } from '../components/common/Button.js';
import { EmptyState } from '../components/common/EmptyState.js';
import { Modal } from '../components/common/Modal.js';
import { SongListSkeleton } from '../components/common/Skeleton.js';
import { formatRelativeTime } from '../utils/format.js';
import { QUERY_KEYS, queryClient } from '../services/queryClient.js';

export const History: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const playSong = usePlayerStore((s) => s.playSong);

  const [showClearModal, setShowClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const { data: history = [], isLoading } = useQuery<HistoryItem[]>({
    queryKey: QUERY_KEYS.history(50),
    queryFn: async () => {
      const data = await historyService.getHistory(50);
      if (data) {
        useFavoriteStore.getState().syncLikedStatus(data.map((h) => h.song));
      }
      return data;
    },
    placeholderData: (prev) => prev,
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  const handleClear = async () => {
    try {
      setIsClearing(true);
      await historyService.clearHistory();
      queryClient.setQueryData(QUERY_KEYS.history(50), []);
      setShowClearModal(false);
    } catch (e) {
      console.error(e);
      alert('Không thể xóa lịch sử nghe nhạc. Vui lòng thử lại.');
    } finally {
      setIsClearing(false);
    }
  };

  const songsList = history.map((h) => h.song);

  const handlePlayAll = () => {
    if (songsList.length > 0) {
      playSong(songsList[0], songsList);
    }
  };

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon={<HistoryIcon className="w-8 h-8 text-text-muted" />}
        title="Đăng nhập để xem lịch sử nghe nhạc"
        description="Theo dõi các bài hát bạn đã nghe và tiếp tục thưởng thức dễ dàng."
        actionText="Đăng nhập"
        onAction={() => navigate('/login')}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-white/5 gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Đã nghe gần đây
          </h1>
          <p className="text-xs text-text-muted mt-0.5">
            Lịch sử các bài hát bạn đã nghe ({history.length} bài)
          </p>
        </div>

        {history.length > 0 && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePlayAll}
              variant="primary"
              size="sm"
              leftIcon={<Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
            >
              Phát tất cả
            </Button>
            <Button
              onClick={() => setShowClearModal(true)}
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            >
              Xóa lịch sử
            </Button>
          </div>
        )}
      </div>

      {/* List */}
      <div className="space-y-1">
        {isLoading && history.length === 0 ? (
          <SongListSkeleton count={6} />
        ) : history.length > 0 ? (
          <div className="space-y-0.5">
            {history.map((item, idx) => (
              <SongRow
                key={`${item.historyId}-${idx}`}
                song={item.song}
                index={idx}
                queueContext={songsList}
                extraRight={
                  <span className="flex items-center gap-1 text-[11px] text-text-muted">
                    <Clock className="w-3 h-3" />
                    <span>{formatRelativeTime(item.playedAt)}</span>
                  </span>
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<HistoryIcon className="w-8 h-8 text-text-muted" />}
            title="Chưa có lịch sử nghe nhạc"
            description="Phát bài hát bất kỳ để tự động ghi lại lịch sử tại đây."
            actionText="Nghe nhạc ngay"
            onAction={() => navigate('/')}
          />
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        title="Xác nhận xóa lịch sử"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary">
            Bạn có chắc chắn muốn xóa toàn bộ lịch sử các bài hát đã nghe không? Hành động này không thể hoàn tác.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowClearModal(false)}
              disabled={isClearing}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={handleClear}
              isLoading={isClearing}
            >
              Xóa toàn bộ
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

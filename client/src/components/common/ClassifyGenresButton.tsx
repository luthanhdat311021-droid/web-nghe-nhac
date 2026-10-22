import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import api from '../../services/api.js';
import { useAuthStore } from '../../store/authStore.js';
import { ApiResponse } from '../../types/index.js';

interface BatchResult { processed: number; classified: number; skipped: number; nextCursor: string | null }

export function ClassifyGenresButton() {
  const isAdmin = useAuthStore(s => s.user?.role === 'ADMIN');
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const mutation = useMutation({
    mutationFn: async () => {
      let afterId: string | undefined;
      let classified = 0;
      let skipped = 0;
      setMessage('Đang phân loại các bài chưa có thể loại…');
      try {
        do {
          const { data } = await api.post<ApiResponse<BatchResult>>('/admin/genres/classify', { afterId }, { timeout: 35000 });
          classified += data.data.classified;
          skipped += data.data.skipped;
          afterId = data.data.nextCursor || undefined;
          setMessage(`Đã phân loại ${classified} bài; ${skipped} bài chưa đủ thông tin. ${afterId ? 'Đang tiếp tục…' : ''}`);
        } while (afterId);
        if (!classified && !skipped) setMessage('Không có bài hát nào chưa được phân loại.');
      } catch (error: any) {
        setMessage(`Đã phân loại ${classified} bài. ${error.response?.data?.message || 'Kết nối bị gián đoạn. Vui lòng thử lại.'}`);
      } finally {
        await Promise.all(['search', 'songs', 'genres'].map(key => queryClient.invalidateQueries({ queryKey: [key] })));
      }
    },
  });
  if (!isAdmin) return null;
  return (
    <div className="mb-3 space-y-2">
      <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}
        className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-400/20 disabled:opacity-50 disabled:cursor-wait">
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {mutation.isPending ? 'Đang phân loại…' : 'Phân loại bằng AI'}
      </button>
      <p className="text-xs text-text-muted">AI gợi ý thể loại từ tên bài, nghệ sĩ và album cho các bài chưa có thể loại.</p>
      {message && <p role="status" className="text-xs text-text-secondary">{message}</p>}
    </div>
  );
}

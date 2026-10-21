import React from 'react';
import { Link } from 'react-router-dom';
import { usePlayerStore } from '../../store/playerStore.js';

export const PlaybackAd: React.FC = () => {
  const seconds = usePlayerStore(s => s.adSeconds);
  const cancel = usePlayerStore(s => s.cancelPendingPlayback);
  const error = usePlayerStore(s => s.playbackError);
  if (!seconds) return error ? <div role="alert" className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[90%] max-w-lg rounded-xl bg-zinc-900 border border-white/20 p-4 shadow-xl">
    <p>{error}</p><div className="flex gap-4 mt-3 text-sm"><Link to="/music-pro" onClick={() => usePlayerStore.getState().clearError()}>Xem Music Pro</Link><Link to="/login" onClick={() => usePlayerStore.getState().clearError()}>Đăng nhập</Link><button onClick={() => usePlayerStore.getState().clearError()}>Đóng</button></div>
  </div> : null;
  return <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="Quảng cáo Music Pro">
    <div className="w-full max-w-md rounded-3xl border border-amber-300/30 bg-zinc-900 p-8 text-center space-y-5">
      <p className="text-xs uppercase tracking-widest text-amber-300">Quảng cáo • MusicWave</p>
      <h2 className="text-3xl font-bold">Thêm nhạc. Không gián đoạn.</h2>
      <p>Music Pro chỉ 50.000đ / 30 ngày. Nghe không giới hạn, không quảng cáo của MusicWave.</p>
      <p role="status" className="text-amber-200">Nhạc sẽ phát sau {seconds} giây</p>
      <Link to="/music-pro" onClick={cancel} className="block rounded-xl bg-amber-300 text-black p-3 font-bold">Khám phá Music Pro</Link>
      <button onClick={cancel} className="text-sm text-text-muted">Hủy phát</button>
    </div>
  </div>;
};

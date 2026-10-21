import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Check, Music2, QrCode } from 'lucide-react';
import api from '../services/api.js';
import { useAuthStore } from '../store/authStore.js';

type Status = { isPro: boolean; proExpiresAt: string | null; used: number; limit: number; paymentEnabled: boolean };
type Order = { id: string; code: string; amount: number; status: string; expiresAt: string; qrUrl: string; bank: string; accountNumber: string };
export const MusicPro: React.FC = () => {
  const token = useAuthStore(s => s.token);
  const [status, setStatus] = useState<Status | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const refresh = async () => { const res = await api.get('/music-pro/status'); setStatus(res.data.data); };
  useEffect(() => {
    setStatus(null); setOrder(null); setError('');
    if (token) refresh().catch(() => setError('Không tải được thông tin gói. Vui lòng tải lại trang.'));
  }, [token]);
  useEffect(() => {
    if (!order || order.status !== 'PENDING') return;
    let active = true;
    const timer = setInterval(async () => {
      setNow(Date.now());
      try {
        const res = await api.get(`/music-pro/orders/${order.id}`);
        if (!active) return;
        setOrder(res.data.data); setError('');
        if (res.data.data.status === 'PAID') await refresh();
      } catch { if (active) setError('Chưa kiểm tra được thanh toán. Hệ thống sẽ thử lại, bạn không cần chuyển tiền lần nữa.'); }
    }, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [order?.id, order?.status]);
  const createOrder = async () => {
    setBusy(true); setError('');
    try { const res = await api.post('/music-pro/orders'); setOrder(res.data.data); setNow(Date.now()); }
    catch (err: any) { setError(err.response?.data?.message || 'Không tạo được mã QR. Vui lòng thử lại.'); }
    finally { setBusy(false); }
  };
  const expired = order && (order.status === 'EXPIRED' || new Date(order.expiresAt).getTime() <= now);
  return <div className="max-w-4xl mx-auto space-y-6 pb-16">
    <div className="rounded-3xl border border-amber-300/20 bg-gradient-to-br from-amber-400/15 to-purple-500/10 p-6 sm:p-10">
      <Crown className="text-amber-300 w-10 h-10 mb-4" />
      <h1 className="text-3xl sm:text-4xl font-bold text-white">Âm nhạc không giới hạn.</h1>
      <p className="text-text-secondary mt-3">Music Pro — trọn vẹn từng bài hát, không quảng cáo của MusicWave.</p>
      {status?.isPro && <p className="text-emerald-300 mt-4" role="status">Pro đang hoạt động đến {new Date(status.proExpiresAt!).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} (giờ Việt Nam).</p>}
    </div>
    <div className="grid sm:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
        <Music2 /><h2 className="text-xl font-bold">Free</h2><p className="text-3xl font-bold">0đ</p>
        <p>3 lượt nghe mỗi ngày</p><p>Có quảng cáo trước mỗi lượt phát</p>
        <p className="text-sm text-text-muted">Hạn mức đặt lại lúc 00:00 giờ Việt Nam. Phát lại hoặc chuyển bài tính một lượt; tạm dừng rồi nghe tiếp không tính thêm.</p>
        {status && !status.isPro && <p className="text-amber-200">Hôm nay: {status.used}/{status.limit} lượt</p>}
      </div>
      <div className="rounded-2xl border border-amber-300/40 bg-amber-400/[0.06] p-6 space-y-4">
        <Crown className="text-amber-300" /><h2 className="text-xl font-bold">Music Pro</h2>
        <p><strong className="text-3xl">50.000đ</strong><span className="text-text-muted"> / 30 ngày</span></p>
        <p className="flex gap-2"><Check className="text-emerald-300" /> Nghe nhạc không giới hạn</p>
        <p className="flex gap-2"><Check className="text-emerald-300" /> Không quảng cáo của MusicWave</p>
        <p className="text-sm text-text-muted">Thanh toán một lần bằng QR chuyển khoản. Gia hạn cộng thêm 30 ngày vào thời hạn còn lại, không tự động trừ tiền.</p>
        {!token ? <Link to="/login" className="block rounded-xl bg-amber-300 text-black p-3 text-center font-bold">Đăng nhập để nâng cấp</Link> :
          <button disabled={busy || !status?.paymentEnabled || (!!order && order.status === 'PENDING' && !expired)} onClick={createOrder}
            className="w-full rounded-xl bg-amber-300 text-black p-3 font-bold disabled:opacity-50">{busy ? 'Đang tạo QR…' : status?.isPro ? 'Gia hạn 30 ngày' : 'Nâng cấp Music Pro'}</button>}
        {status && !status.paymentEnabled && <p className="text-sm text-amber-200">Thanh toán đang được thiết lập.</p>}
      </div>
    </div>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {order && <section className="rounded-2xl border border-white/10 p-6 space-y-4" aria-live="polite">
      <h2 className="font-bold text-xl flex items-center gap-2"><QrCode /> Thanh toán Music Pro</h2>
      {order.status === 'PAID' ? <p className="text-emerald-300">Thanh toán thành công! Music Pro đã được kích hoạt.</p> : expired ?
        <p>Mã QR đã hết hạn. Hãy tạo đơn mới nếu chưa chuyển tiền. Nếu đã chuyển, vui lòng liên hệ quản trị viên kèm mã {order.code} để đối soát.</p> : <div className="flex flex-col sm:flex-row gap-6">
        <img src={order.qrUrl} alt="Mã QR chuyển khoản Music Pro 50.000 đồng" className="w-60 h-60 bg-white rounded-xl object-contain" />
        <div className="space-y-3 min-w-0"><p>Ngân hàng: <strong>{order.bank}</strong></p><p>Số tài khoản: <strong>{order.accountNumber}</strong></p>
          <p>Số tiền: <strong>{order.amount.toLocaleString('vi-VN')}đ</strong></p><p className="break-all">Nội dung: <strong>{order.code}</strong></p>
          <p className="text-sm text-text-muted">Giữ nguyên số tiền và nội dung chuyển khoản. Pro tự kích hoạt sau khi ngân hàng xác nhận qua SePay.</p>
          <p className="text-sm">QR hết hạn lúc {new Date(order.expiresAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} (giờ Việt Nam).</p>
        </div></div>}
    </section>}
    <p className="text-xs text-text-muted">Quảng cáo do YouTube hoặc nhà cung cấp nguồn nhạc chèn có thể vẫn xuất hiện với nguồn nhạc bên ngoài.</p>
  </div>;
};

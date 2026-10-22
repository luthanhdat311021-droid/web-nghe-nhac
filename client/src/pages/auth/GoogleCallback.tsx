import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { completeGoogleLogin, confirmGoogleAccount, GoogleSession } from '../../services/googleAuth.service.js';
import { useAuthStore } from '../../store/authStore.js';
import { Button } from '../../components/common/Button.js';
import { Input } from '../../components/common/Input.js';

export function GoogleCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [ticket, setTicket] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(true);
  function finish(session: GoogleSession) {
    useAuthStore.getState().acceptSession(session);
    navigate('/', { replace: true });
  }
  useEffect(() => {
    let active = true;
    completeGoogleLogin().then(result => {
      if (!active) return;
      if ('requiresLink' in result) { setTicket(result.linkTicket); setBusy(false); }
      else finish(result);
    }).catch(err => { if (active) { setError(err.response?.data?.message || err.message); setBusy(false); } });
    return () => { active = false; };
  }, []);
  return <div className="max-w-sm mx-auto my-12 p-6 rounded-2xl border border-white/10 space-y-4">
    <h1 className="text-xl font-bold">{ticket ? 'Liên kết tài khoản Google' : 'Đăng nhập bằng Google'}</h1>
    {busy && <p role="status">Đang xác minh tài khoản…</p>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    {ticket && <form className="space-y-4" onSubmit={async e => {
      e.preventDefault(); setBusy(true); setError('');
      try { finish(await confirmGoogleAccount(ticket, password)); }
      catch (err: any) { setError(err.response?.data?.message || 'Không thể liên kết tài khoản.'); }
      finally { setBusy(false); }
    }}>
      <p className="text-sm text-text-secondary">Email này đã có tài khoản MusicWave. Nhập mật khẩu MusicWave hiện tại để liên kết và giữ nguyên dữ liệu của bạn.</p>
      <Input type="password" label="Mật khẩu MusicWave" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
      <Button type="submit" isLoading={busy}>Liên kết và đăng nhập</Button>
      <Link className="block text-sm underline" to="/forgot-password">Quên mật khẩu?</Link>
    </form>}
    {!busy && <Link className="block text-sm underline" to="/login">Quay lại đăng nhập</Link>}
  </div>;
}

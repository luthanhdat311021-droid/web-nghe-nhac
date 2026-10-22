import { useState } from 'react';
import { beginGoogleLogin } from '../../services/googleAuth.service.js';

export function GoogleLoginButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <div className="space-y-2">
    <button type="button" disabled={busy} onClick={async () => {
      setBusy(true); setError('');
      try { await beginGoogleLogin(); }
      catch (err: any) { setError(err.response?.data?.message || 'Không thể kết nối Google. Vui lòng thử lại.'); setBusy(false); }
    }} className="w-full rounded-xl bg-white text-gray-800 border border-gray-200 py-3 px-4 flex items-center justify-center gap-3 text-sm font-semibold hover:bg-gray-100 disabled:opacity-60">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.17 7.09-10.35 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.77-4.59l-7.98-6.19A23.86 23.86 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      {busy ? 'Đang chuyển đến Google…' : 'Tiếp tục với Google'}
    </button>
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
  </div>;
}

const fs = require('node:fs');
const env = require('dotenv').parse(fs.readFileSync('.env.production.deploy'));
const base = 'https://musicwave-app.vercel.app';
async function check(path, status, options = {}) {
  const res = await fetch(base + path, { ...options, signal: AbortSignal.timeout(45000) });
  if (res.status !== status) throw new Error(`${path}: expected ${status}, got ${res.status}`);
  console.log(`${path}: HTTP ${res.status}`);
  return res;
}
(async () => {
  await check('/music-pro', 200);
  await check('/api/health', 200);
  await check('/api/music-pro/status', 401);
  const songs = await (await check('/api/songs?limit=1', 200)).json();
  const item = songs.data.items[0];
  if (item && (item.audioUrl || item.youtubeId || item.youtubeUrl)) throw new Error('Public catalog leaked playback source');
  console.log('Public catalog sources hidden.');
  await check('/api/music-pro/sepay/webhook', 401, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  // An outgoing notification must be acknowledged but cannot activate Pro or create a payment.
  const result = await (await check('/api/music-pro/sepay/webhook', 200, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Apikey ${env.SEPAY_WEBHOOK_KEY}` },
    body: JSON.stringify({ id: 1, gateway: 'MBBank', accountNumber: '0819883208', transferType: 'out', transferAmount: 0,
      content: 'DEPLOYMENT_HEALTH_CHECK', transactionDate: '2026-10-21 00:00:00' }),
  })).json();
  if (!result.success) throw new Error('Webhook authentication check failed');
  console.log('Webhook secret verified using an ignored outgoing event; no payment granted.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });

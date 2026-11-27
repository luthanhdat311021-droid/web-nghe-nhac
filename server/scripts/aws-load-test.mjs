// Kiểm thử tải chỉ-đọc vào API MusicWave đang chạy trên AWS Elastic Beanstalk.
// Chạy: node server/scripts/aws-load-test.mjs [API_URL]
// Mặc định tăng dần 5 -> 20 -> 50 người dùng ảo, mỗi mức 60 giây, chỉ gọi các API GET công khai.

const API = (process.argv[2] || process.env.API_URL ||
  'http://musicwave-env.eba-jen3axxp.ap-southeast-1.elasticbeanstalk.com/api').replace(/\/+$/, '');
const STAGES = (process.env.STAGES || '5,20,50').split(',').map(Number);
const STAGE_SECONDS = Number(process.env.STAGE_SECONDS || 60);
const PATHS = ['/health', '/songs?limit=20', '/artists?limit=20', '/albums?limit=20', '/songs/trending'];

const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;

async function hit(path) {
  const start = performance.now();
  try {
    const res = await fetch(API + path, { signal: AbortSignal.timeout(10000) });
    await res.arrayBuffer();
    return { ms: performance.now() - start, status: res.status };
  } catch (err) {
    return { ms: performance.now() - start, status: 0, error: err.name };
  }
}

async function runStage(vus) {
  const results = [];
  const endAt = Date.now() + STAGE_SECONDS * 1000;
  const worker = async (id) => {
    let i = id;
    while (Date.now() < endAt) results.push(await hit(PATHS[i++ % PATHS.length]));
  };
  const t0 = Date.now();
  await Promise.all(Array.from({ length: vus }, (_, i) => worker(i)));
  const secs = (Date.now() - t0) / 1000;
  const ok = results.filter(r => r.status >= 200 && r.status < 400);
  const lat = ok.map(r => r.ms).sort((a, b) => a - b);
  return {
    'VU': vus,
    'Requests': results.length,
    'RPS': +(results.length / secs).toFixed(1),
    'OK %': +((ok.length / Math.max(1, results.length)) * 100).toFixed(1),
    '4xx': results.filter(r => r.status >= 400 && r.status < 500).length,
    '5xx': results.filter(r => r.status >= 500).length,
    'Loi mang': results.filter(r => r.status === 0).length,
    'p50 ms': Math.round(pct(lat, 0.5)),
    'p95 ms': Math.round(pct(lat, 0.95)),
    'p99 ms': Math.round(pct(lat, 0.99)),
    'Max ms': Math.round(lat.at(-1) || 0),
  };
}

console.log(`API: ${API}`);
console.log(`Bat dau: ${new Date().toISOString()} | Muc tai: ${STAGES.join(' -> ')} VU, moi muc ${STAGE_SECONDS}s`);
const table = [];
for (const vus of STAGES) {
  const row = await runStage(vus);
  table.push(row);
  console.log(JSON.stringify(row));
}
console.log(`Ket thuc: ${new Date().toISOString()}`);
console.table(table);

// Lambda "musicwave-uptime-check" — giám sát uptime miễn phí (thay cho CloudWatch Synthetics).
// EventBridge Scheduler gọi hàm này mỗi 5 phút. Hàm kiểm tra website và API rồi ghi metric
// MusicWave/Uptime: Up (1 = tất cả đều trả về 2xx, 0 = có lỗi) và LatencyMs cho từng điểm kiểm tra.
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cw = new CloudWatchClient({});
const { WEBSITE_URL, API_URL } = process.env;

const CHECKS = [
  { name: 'Website', url: () => WEBSITE_URL + '/' },
  { name: 'ApiHealth', url: () => API_URL + '/health' },
  { name: 'ApiSongs', url: () => API_URL + '/songs?limit=1' },
];

const probe = async ({ name, url }) => {
  const started = Date.now();
  try {
    const res = await fetch(url(), { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'musicwave-uptime-check' } });
    await res.arrayBuffer();
    return { name, ok: res.ok, status: res.status, ms: Date.now() - started };
  } catch (err) {
    return { name, ok: false, status: 0, ms: Date.now() - started, error: err.name };
  }
};

export const handler = async () => {
  const results = await Promise.all(CHECKS.map(probe));
  const allUp = results.every((r) => r.ok);
  const timestamp = new Date();

  await cw.send(new PutMetricDataCommand({
    Namespace: 'MusicWave/Uptime',
    MetricData: [
      { MetricName: 'Up', Value: allUp ? 1 : 0, Unit: 'Count', Timestamp: timestamp },
      ...results.map((r) => ({
        MetricName: 'LatencyMs', Dimensions: [{ Name: 'Check', Value: r.name }],
        Value: r.ms, Unit: 'Milliseconds', Timestamp: timestamp,
      })),
    ],
  }));

  console.log(JSON.stringify({ allUp, results }));
  return { allUp, results };
};

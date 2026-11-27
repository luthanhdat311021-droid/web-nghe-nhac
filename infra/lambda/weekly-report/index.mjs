// Lambda "musicwave-weekly-report" — tác vụ định kỳ không cần máy chủ.
// Amazon EventBridge Scheduler gọi hàm này 8:00 sáng thứ Hai (giờ Việt Nam).
// Hàm kiểm tra sức khoẻ API, lấy Top 10 bài hát, lưu báo cáo JSON vào S3 và gửi email qua SNS.
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const sns = new SNSClient({});
const s3 = new S3Client({});
const { API_URL, TOPIC_ARN, REPORT_BUCKET, WEBSITE_URL } = process.env;

const getJson = async (path) => {
  const started = Date.now();
  const res = await fetch(API_URL + path, { signal: AbortSignal.timeout(10000) });
  return { status: res.status, ms: Date.now() - started, body: res.ok ? await res.json() : null };
};

export const handler = async () => {
  const now = new Date();
  const health = await getJson('/health').catch((e) => ({ status: 0, ms: null, error: e.name }));
  const charts = await getJson('/songs/top-charts?limit=10').catch((e) => ({ status: 0, error: e.name }));
  const songs = Array.isArray(charts.body?.data) ? charts.body.data.slice(0, 10) : [];

  const report = {
    generatedAt: now.toISOString(),
    api: { healthStatus: health.status, healthLatencyMs: health.ms },
    topSongs: songs.map((s, i) => ({ rank: i + 1, title: s.title, artist: s.artist?.name ?? null, plays: s.playsCount })),
  };

  const day = now.toISOString().slice(0, 10);
  const reportKey = `reports/weekly/${day}.json`;
  await s3.send(new PutObjectCommand({
    Bucket: REPORT_BUCKET, Key: reportKey, Body: JSON.stringify(report, null, 2), ContentType: 'application/json',
  }));

  const lines = [
    `Bao cao tuan MusicWave - ${day}`,
    '',
    `Trang thai API: ${health.status === 200 ? 'HOAT DONG' : 'LOI (' + health.status + ')'}${health.ms != null ? `, do tre ${health.ms} ms` : ''}`,
    '',
    'Top 10 bai hat:',
    ...(report.topSongs.length
      ? report.topSongs.map((s) => `${String(s.rank).padStart(2)}. ${s.title}${s.artist ? ' - ' + s.artist : ''} (${s.plays ?? 0} luot nghe)`)
      : ['(khong lay duoc du lieu)']),
    '',
    `Website: ${WEBSITE_URL}`,
    `Bao cao day du: s3://${REPORT_BUCKET}/${reportKey}`,
    '',
    'Gui tu dong boi AWS Lambda + Amazon EventBridge Scheduler.',
  ];

  await sns.send(new PublishCommand({
    TopicArn: TOPIC_ARN,
    Subject: `[MusicWave] Bao cao tuan ${day}`,
    Message: lines.join('\n'),
  }));
  console.log('Da gui bao cao', JSON.stringify({ reportKey, health: health.status, songs: songs.length }));
  return report;
};

// Lambda "musicwave-process-audio" — kiến trúc hướng sự kiện (event-driven).
// Khi một file nhạc mới được ghi vào s3://<media-bucket>/audio/..., S3 gửi sự kiện "Object Created"
// qua Amazon EventBridge và hàm này tự chạy:
//   1. Đọc thông tin kỹ thuật của file (thời lượng, bitrate, sample rate, định dạng, tag ID3...).
//   2. Tách ảnh bìa nhúng trong file (nếu có).
//   3. Ghi kết quả vào processed/audio/<tên file>.json và processed/covers/<tên file>.<jpg|png>.
// Không cần máy chủ: chỉ tính tiền theo số lần chạy (Free Tier 1 triệu lần/tháng).
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { parseStream } from 'music-metadata';

const s3 = new S3Client({});
const OUTPUT_PREFIX = 'processed/';

const baseName = (key) => key.split('/').pop().replace(/\.[^.]+$/, '');

export const handler = async (event) => {
  const bucket = event?.detail?.bucket?.name;
  const key = decodeURIComponent((event?.detail?.object?.key || '').replace(/\+/g, ' '));
  if (!bucket || !key || key.startsWith(OUTPUT_PREFIX)) {
    console.log('Bo qua su kien', JSON.stringify({ bucket, key }));
    return { skipped: true };
  }

  const started = Date.now();
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const meta = await parseStream(obj.Body, { mimeType: obj.ContentType, size: obj.ContentLength }, { duration: true });

  const name = baseName(key);
  let coverKey = null;
  const picture = meta.common.picture?.[0];
  if (picture?.data?.length) {
    const ext = picture.format?.includes('png') ? 'png' : 'jpg';
    coverKey = `${OUTPUT_PREFIX}covers/${name}.${ext}`;
    await s3.send(new PutObjectCommand({
      Bucket: bucket, Key: coverKey, Body: picture.data, ContentType: picture.format || 'image/jpeg',
    }));
  }

  const result = {
    sourceKey: key,
    sizeBytes: obj.ContentLength,
    contentType: obj.ContentType,
    durationSec: meta.format.duration ? Math.round(meta.format.duration * 10) / 10 : null,
    bitrateKbps: meta.format.bitrate ? Math.round(meta.format.bitrate / 1000) : null,
    sampleRateHz: meta.format.sampleRate ?? null,
    channels: meta.format.numberOfChannels ?? null,
    codec: meta.format.codec ?? meta.format.container ?? null,
    lossless: meta.format.lossless ?? null,
    tags: {
      title: meta.common.title ?? null,
      artist: meta.common.artist ?? null,
      album: meta.common.album ?? null,
      year: meta.common.year ?? null,
      genre: meta.common.genre ?? [],
    },
    embeddedCoverKey: coverKey,
    processedAt: new Date().toISOString(),
    processingMs: Date.now() - started,
  };

  const outKey = `${OUTPUT_PREFIX}audio/${name}.json`;
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: outKey, Body: JSON.stringify(result, null, 2), ContentType: 'application/json',
  }));
  console.log('Da xu ly', JSON.stringify({ key, outKey, durationSec: result.durationSec, ms: result.processingMs }));
  return result;
};

# Căn lời bài hát tiếng Việt tự động

Pipeline nghiên cứu chạy trên Google Colab: **Demucs** (tách giọng) → **ASR** (Whisper, WhisperX, PhoWhisper, wav2vec2) → **căn chỉnh** → **đánh giá** → gửi kết quả về web MusicWave.

## Thành phần

| File | Vai trò |
|---|---|
| `MusicWave_CanLoi.ipynb` | Notebook Colab chạy toàn bộ, theo 8 bước |
| `musicwave_align/text.py` | Chuẩn hóa lời tiếng Việt (số thành chữ, bỏ ghi chú, bỏ dấu câu) |
| `musicwave_align/asr.py` | 4 mô hình nhận dạng, cùng một giao diện |
| `musicwave_align/align.py` | Ghép quy hoạch động (cách A) và căn chỉnh cưỡng bức CTC (cách B) |
| `musicwave_align/metrics.py` | Độ lệch dòng/từ, % lệch ≤ 0,3/0,5/1 giây, WER/CER |
| `musicwave_align/pipeline.py` | Chạy hàng loạt, lưu từng bài lên Drive, tổng hợp bảng kết quả |
| `musicwave_align/web.py` | Lấy bài từ API, tải nhạc, Demucs, gửi kết quả lên web |
| `tools/annotator.html` | Công cụ ghi mốc chuẩn bằng phím Space (mở trực tiếp trong trình duyệt) |
| `tests/test_align.py` | Kiểm tra thuật toán không cần GPU: `python research/alignment/tests/test_align.py` |

## Các cấu hình được so sánh

| Cấu hình | Cách lấy mốc |
|---|---|
| `web_hien_tai` | Lời đồng bộ web đang lưu (Whisper qua Groq / LRCLIB / Gemini) — mốc so sánh |
| `whisper_{mix,vocals}` | Whisper large-v3, mốc từng từ + ghép quy hoạch động |
| `whisperx_{mix,vocals}` | WhisperX (mốc từ được căn lại bằng wav2vec2) + ghép |
| `phowhisper_{mix,vocals}` | PhoWhisper-large, mốc theo đoạn chia đều cho từ + ghép |
| `wav2vec2_{mix,vocals}` | wav2vec2 tiếng Việt giải mã tham lam + ghép |
| `ctc_{mix,vocals}` | Căn chỉnh cưỡng bức CTC trên wav2vec2 (lời đã biết) |

`mix` là bản gốc, `vocals` là giọng đã tách bằng Demucs `htdemucs_ft`.

## Định dạng kết quả lưu trên web

API mới `PUT /api/admin/songs/:id/aligned-lyrics` (chỉ admin) ghi vào `Lyrics.syncedLyrics` dạng JSON:

```json
[{ "time": 12.3, "text": "Mưa rơi, nhớ em", "words": [{ "time": 12.3, "text": "Mưa" }, { "time": 12.6, "text": "rơi," }] }]
```

Client và server vốn đã đọc được JSON `{time, text}[]`, nên không phải đổi cấu trúc CSDL. Trường `words` dùng cho karaoke chạy từng từ. Chức năng dịch mốc theo phản hồi người nghe vẫn giữ nguyên mốc từng từ.

## Hạn chế đã biết

- Căn chỉnh cưỡng bức giả định lời khớp đúng với bài hát; điệp khúc hát lặp mà lời không ghi lặp sẽ bị căn sai.
- PhoWhisper không có mốc từng từ, nên độ chính xác theo từ của nó thấp hơn vì cách lấy mốc, không hẳn vì mô hình.
- Các mô hình ASR huấn luyện trên giọng nói, không phải giọng hát.

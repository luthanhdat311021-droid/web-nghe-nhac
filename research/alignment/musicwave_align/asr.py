"""Các mô hình nhận dạng giọng hát. Mỗi hàm nhận đường dẫn wav, trả về danh sách từ
[{"text", "start", "end"}] và văn bản đầy đủ (để tính WER/CER).

Tải mô hình tốn thời gian, nên mỗi lớp giữ mô hình trong bộ nhớ; gọi .close() trước khi chuyển
sang mô hình khác để giải phóng GPU (T4 chỉ có 16 GB).
"""
from __future__ import annotations

import gc
import re

import numpy as np

SR = 16000
# Tăng khi đổi cách nhận dạng: kết quả cũ trên Drive có phiên bản khác sẽ tự chạy lại.
ASR_VERSION = 2

# Câu "ảo giác" Whisper học từ phụ đề YouTube, hay bịa ra khi chỉ có nhạc nền.
_HALLUCINATION = re.compile(
    r"subscribe|đăng ký kênh|đăng kí kênh|ghiền mì gõ|bỏ lỡ những video|like và share|cảm ơn các bạn đã (xem|theo dõi)"
    r"|hẹn gặp lại các bạn|vietsub|phụ đề|subtitles? by|amara\.org",
    re.I,
)


def drop_hallucinations(segments: list[dict]) -> list[dict]:
    """Bỏ đoạn chứa câu ảo giác và đoạn lặp y hệt đoạn ngay trước (vòng lặp giải mã)."""
    out, prev = [], None
    for s in segments:
        text = s["text"].strip()
        if not text or _HALLUCINATION.search(text) or text == prev:
            continue
        out.append(s)
        prev = text
    return out


def load_audio(path: str) -> np.ndarray:
    import librosa

    wav, _ = librosa.load(path, sr=SR, mono=True)
    return wav.astype(np.float32)


def _free():
    import torch

    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


class Whisper:
    """openai-whisper large-v3, mốc từng từ có sẵn."""
    name = "whisper"

    def __init__(self, size: str = "large-v3", device: str = "cuda"):
        import whisper

        self.model = whisper.load_model(size, device=device)

    def transcribe(self, path: str):
        # Không nối ngữ cảnh đoạn trước (tránh một câu ảo giác lan ra cả bài), giải mã lại ở nhiệt độ
        # cao hơn khi bị lặp, và bỏ các đoạn "nghe" ra chữ giữa khoảng im lặng/nhạc nền dài.
        r = self.model.transcribe(path, language="vi", word_timestamps=True, fp16=True,
                                  condition_on_previous_text=False,
                                  temperature=(0.0, 0.2, 0.4, 0.6, 0.8, 1.0),
                                  compression_ratio_threshold=2.4, no_speech_threshold=0.6,
                                  hallucination_silence_threshold=2.0)
        segments = [{"text": s["text"], "words": s.get("words", [])} for s in r["segments"]]
        segments = drop_hallucinations(segments)
        words = [{"text": w["word"].strip(), "start": w["start"], "end": w["end"]}
                 for s in segments for w in s["words"]]
        return words, " ".join(s["text"].strip() for s in segments)

    def close(self):
        del self.model
        _free()


class WhisperX:
    """WhisperX: Whisper (faster-whisper) + căn chỉnh lại mốc từ bằng wav2vec2 tiếng Việt."""
    name = "whisperx"

    def __init__(self, size: str = "large-v3", device: str = "cuda"):
        import whisperx

        self.wx, self.device = whisperx, device
        self.model = whisperx.load_model(size, device, compute_type="float16", language="vi")
        self.align_model, self.meta = whisperx.load_align_model(language_code="vi", device=device)

    def transcribe(self, path: str):
        audio = self.wx.load_audio(path)
        r = self.model.transcribe(audio, batch_size=8, language="vi")
        segs = drop_hallucinations(r["segments"])
        r = self.wx.align(segs, self.align_model, self.meta, audio, self.device, return_char_alignments=False)
        words = [{"text": w["word"].strip(), "start": w["start"], "end": w.get("end", w["start"])}
                 for s in r["segments"] for w in s.get("words", []) if "start" in w]
        return words, " ".join(s["text"].strip() for s in r["segments"])

    def close(self):
        del self.model, self.align_model
        _free()


class PhoWhisper:
    """PhoWhisper (VinAI), Whisper huấn luyện thêm trên 844 giờ tiếng Việt.

    Mô hình không có sẵn alignment heads nên chỉ lấy được mốc theo đoạn; từ trong mỗi đoạn được
    chia đều theo thời lượng. Đây là hạn chế cần nêu khi so sánh.
    """
    name = "phowhisper"

    def __init__(self, size: str = "large", device: str = "cuda"):
        import torch
        from transformers import pipeline

        self.pipe = pipeline("automatic-speech-recognition", model=f"vinai/PhoWhisper-{size}",
                             device=0 if device == "cuda" else -1, torch_dtype=torch.float16,
                             chunk_length_s=30)

    def transcribe(self, path: str):
        r = self.pipe(load_audio(path), return_timestamps=True,
                      generate_kwargs={"language": "vi", "task": "transcribe"})
        chunks = drop_hallucinations(r.get("chunks", []))
        words = []
        for c in chunks:
            start, end = c["timestamp"]
            toks = c["text"].split()
            if start is None or not toks:
                continue
            end = end if end is not None else start + 0.4 * len(toks)
            step = (end - start) / len(toks)
            words += [{"text": t, "start": start + k * step, "end": start + (k + 1) * step} for k, t in enumerate(toks)]
        return words, " ".join(c["text"].strip() for c in chunks)

    def close(self):
        del self.pipe
        _free()


class Wav2Vec2:
    """wav2vec2 tiếng Việt (CTC). Dùng cho cả hai việc: giải mã tham lam (như một mô hình ASR) và
    cung cấp xác suất ký tự cho căn chỉnh cưỡng bức."""
    name = "wav2vec2"

    def __init__(self, model_id: str = "nguyenvulebinh/wav2vec2-base-vietnamese-250h", device: str = "cuda"):
        from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

        self.device = device
        self.processor = Wav2Vec2Processor.from_pretrained(model_id)
        self.model = Wav2Vec2ForCTC.from_pretrained(model_id).to(device).eval()
        vocab = self.processor.tokenizer.get_vocab()
        self.vocab = {k: v for k, v in vocab.items() if len(k) == 1}
        self.id_to_char = {v: k for k, v in self.vocab.items()}
        self.blank = self.processor.tokenizer.pad_token_id
        self.delim = vocab.get("|")

    def emissions(self, wav: np.ndarray):
        from .align import ctc_emissions

        emis = ctc_emissions(wav, self.model, self.processor, self.device)
        return emis, len(wav) / SR / len(emis)

    def transcribe(self, path: str):
        from .align import ctc_greedy_words

        emis, spf = self.emissions(load_audio(path))
        words = ctc_greedy_words(emis, self.id_to_char, self.blank, self.delim, spf)
        return words, " ".join(w["text"] for w in words)

    def close(self):
        del self.model
        _free()


MODELS = {cls.name: cls for cls in (Whisper, WhisperX, PhoWhisper, Wav2Vec2)}

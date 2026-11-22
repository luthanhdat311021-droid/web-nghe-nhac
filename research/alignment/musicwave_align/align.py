"""Hai cách lấy mốc thời gian cho lời đã biết:

A. dp_align: ghép lời với các từ mà một mô hình ASR nghe được (quy hoạch động, cùng thuật toán
   web đang dùng trong server/src/services/lyricsWhisper.ts, viết lại để mọi mô hình dùng chung).
B. ctc_force_align: căn chỉnh cưỡng bức CTC trên xác suất ký tự của wav2vec2 (Viterbi), không cần
   mô hình nghe đúng chữ.

Cả hai trả về cùng định dạng mà web lưu trong Lyrics.syncedLyrics:
    [{"time": 12.3, "text": "dòng gốc", "words": [{"time": 12.3, "text": "từ"}, ...]}, ...]
"""
from __future__ import annotations

import numpy as np

from .text import line_words, normalize

SYLLABLE_SECONDS = 0.28  # thời lượng ước chừng của một âm tiết khi hát


# ---------------------------------------------------------------- tiện ích chung

def _display_words(line: str) -> list[tuple[str, int]]:
    """(từ hiển thị, số token chuẩn hóa của nó). Dấu câu đứng riêng được gộp vào từ trước."""
    out: list[list] = []
    for tok in line.split():
        n = len(normalize(tok).split())
        if n == 0 and out:
            out[-1][0] += " " + tok
        else:
            out.append([tok, n])
    return [(t, n) for t, n in out]


def _fill_gaps(times: list[float | None], line_of: list[int]) -> list[float] | None:
    """Điền mốc cho token chưa có. Ưu tiên mốc trong cùng dòng: từ sau một từ đã có mốc thì tiến
    SYLLABLE_SECONDS mỗi âm tiết; từ đầu dòng thì lùi từ từ có mốc đầu tiên của dòng. Dòng không
    nghe được từ nào thì chia đều khoảng giữa hai mốc bao quanh."""
    n = len(times)
    known = [i for i in range(n) if times[i] is not None]
    if not known:
        return None
    out = list(times)
    for i in range(n):
        if out[i] is not None:
            continue
        same = [k for k in known if line_of[k] == line_of[i]]
        before = [k for k in same if k < i]
        after = [k for k in same if k > i]
        if before:
            out[i] = times[before[-1]] + (i - before[-1]) * SYLLABLE_SECONDS
        elif after:
            out[i] = times[after[0]] - (after[0] - i) * SYLLABLE_SECONDS
        else:
            p = max((k for k in known if k < i), default=None)
            q = min((k for k in known if k > i), default=None)
            if p is not None and q is not None:
                out[i] = times[p] + (times[q] - times[p]) * (i - p) / (q - p)
            elif q is not None:
                out[i] = times[q] - (q - i) * SYLLABLE_SECONDS
            else:
                out[i] = times[p] + (i - p) * SYLLABLE_SECONDS
    prev = 0.0
    for i in range(n):  # tăng dần, không âm
        out[i] = max(out[i], prev, 0.0)
        prev = out[i] + 0.01
    return out


def build_lines(lines: list[str], token_times: list[float]) -> list[dict]:
    """Gắn mốc token (theo thứ tự line_words) về từng dòng và từng từ hiển thị."""
    result, k = [], 0
    for line in lines:
        words = []
        for disp, n in _display_words(line):
            t = token_times[k] if n else (words[-1]["time"] if words else token_times[min(k, len(token_times) - 1)])
            words.append({"time": round(float(t), 2), "text": disp})
            k += n
        if words:
            result.append({"time": words[0]["time"], "text": line, "words": words})
    return result


# ---------------------------------------------------------------- A. quy hoạch động

def _similarity(a: str, b: str) -> int:
    """2 = trùng, 1 = lệch đúng một chữ cái (vd "giot"/"rot"), 0 = khác."""
    if a == b:
        return 2
    if min(len(a), len(b)) < 3 or abs(len(a) - len(b)) > 1:
        return 0
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]:
        i += 1
    ja, jb = len(a) - 1, len(b) - 1
    while ja >= i and jb >= i and a[ja] == b[jb]:
        ja -= 1
        jb -= 1
    return 1 if max(ja, jb) - i < 1 else 0


def dp_align(lines: list[str], heard: list[dict], min_matched: float = 0.3) -> list[dict] | None:
    """heard: [{"text", "start", "end"}] từ ASR. None nếu nghe được quá ít lời để tin."""
    ref_lines = line_words(lines)
    ref = [w for _, w in ref_lines]
    hyp = [(tok, w["start"]) for w in heard for tok in normalize(w["text"]).split()]
    n, m = len(ref), len(hyp)
    if not n or not m:
        return None
    SKIP_REF, SKIP_HEARD = -1.0, -0.4
    score = np.zeros((n + 1, m + 1), dtype=np.float32)
    move = np.zeros((n + 1, m + 1), dtype=np.uint8)  # 1 ghép, 2 bỏ từ lời, 3 bỏ từ nghe
    score[1:, 0] = np.arange(1, n + 1) * SKIP_REF
    move[1:, 0] = 2
    score[0, 1:] = np.arange(1, m + 1) * SKIP_HEARD
    move[0, 1:] = 3
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            best, how = score[i - 1, j] + SKIP_REF, 2
            s = score[i, j - 1] + SKIP_HEARD
            if s > best:
                best, how = s, 3
            sim = _similarity(ref[i - 1], hyp[j - 1][0])
            if sim:
                s = score[i - 1, j - 1] + sim
                if s >= best:
                    best, how = s, 1
            score[i, j], move[i, j] = best, how
    times: list[float | None] = [None] * n
    i, j = n, m
    while i > 0 or j > 0:
        how = move[i, j]
        if how == 1:
            times[i - 1] = hyp[j - 1][1]
            i, j = i - 1, j - 1
        elif how == 2:
            i -= 1
        else:
            j -= 1
    if sum(t is not None for t in times) < max(2, min_matched * n):
        return None
    return build_lines(lines, _fill_gaps(times, [li for li, _ in ref_lines]))


# ---------------------------------------------------------------- B. căn chỉnh cưỡng bức CTC

def ctc_emissions(wav: np.ndarray, model, processor, device: str, chunk_s: float = 20, ctx_s: float = 2) -> np.ndarray:
    """Log-xác suất ký tự (T x V) cho cả bài. Cắt đoạn 20 s có 2 s ngữ cảnh mỗi bên để không tràn bộ nhớ."""
    import torch

    sr = 16000
    stride = 320  # wav2vec2: 20 ms mỗi khung
    chunk, ctx = int(chunk_s * sr), int(ctx_s * sr)
    parts = []
    for start in range(0, len(wav), chunk):
        a, b = max(0, start - ctx), min(len(wav), start + chunk + ctx)
        inputs = processor(wav[a:b], sampling_rate=sr, return_tensors="pt").input_values.to(device)
        with torch.inference_mode():
            logp = torch.log_softmax(model(inputs).logits[0].float(), dim=-1).cpu().numpy()
        left = round((start - a) / stride)
        keep = round(min(chunk, len(wav) - start) / stride)
        parts.append(logp[left:left + keep])
    return np.concatenate(parts)


def _viterbi(emis: np.ndarray, targets: list[int], blank: int) -> np.ndarray | None:
    """Đường căn chỉnh CTC tốt nhất. Trả về trạng thái (0..2L) tại mỗi khung, hoặc None nếu không khả thi."""
    T, L = len(emis), len(targets)
    S = 2 * L + 1
    ext = np.full(S, blank, dtype=np.int64)
    ext[1::2] = targets
    can_skip = np.zeros(S, dtype=bool)  # cho phép nhảy s-2 -> s khi hai ký tự liền kề khác nhau
    can_skip[3::2] = ext[3::2] != ext[1:-2:2]
    if T < L:
        return None
    NEG = -1e30
    alpha = np.full(S, NEG, dtype=np.float64)
    alpha[0] = emis[0, blank]
    alpha[1] = emis[0, ext[1]]
    bp = np.zeros((T, S), dtype=np.int8)
    for t in range(1, T):
        stay = alpha
        step = np.concatenate(([NEG], alpha[:-1]))
        skip = np.where(can_skip, np.concatenate(([NEG, NEG], alpha[:-2])), NEG)
        stacked = np.stack([stay, step, skip])
        choice = stacked.argmax(0)
        alpha = stacked[choice, np.arange(S)] + emis[t, ext]
        bp[t] = choice
    s = S - 1 if alpha[S - 1] >= alpha[S - 2] else S - 2
    if alpha[s] <= NEG / 2:
        return None
    path = np.empty(T, dtype=np.int64)
    for t in range(T - 1, -1, -1):
        path[t] = s
        s -= int(bp[t, s])  # int(): với NumPy 2, trừ một số int8 sẽ ép s về int8 (tràn khi s > 127)
    return path


def ctc_force_align(lines: list[str], emis: np.ndarray, vocab: dict[str, int], blank: int,
                    seconds_per_frame: float) -> list[dict] | None:
    """Mốc từng từ bằng căn chỉnh cưỡng bức. Từ không có ký tự nào trong bảng chữ được nội suy."""
    ref_lines = line_words(lines)
    tokens = [w for _, w in ref_lines]
    targets, owner = [], []
    for wi, word in enumerate(tokens):
        for ch in word:
            if ch in vocab:
                targets.append(vocab[ch])
                owner.append(wi)
    if not targets:
        return None
    path = _viterbi(emis, targets, blank)
    if path is None:
        return None
    times: list[float | None] = [None] * len(tokens)
    for t, s in enumerate(path):
        if s % 2 == 1:
            wi = owner[(s - 1) // 2]
            if times[wi] is None:
                times[wi] = t * seconds_per_frame
    return build_lines(lines, _fill_gaps(times, [li for li, _ in ref_lines]))


def ctc_greedy_words(emis: np.ndarray, id_to_char: dict[int, str], blank: int, delim: int | None,
                     seconds_per_frame: float) -> list[dict]:
    """Giải mã tham lam wav2vec2 thành từ có mốc thời gian (dùng khi so sánh wav2vec2 như một mô hình ASR)."""
    ids = emis.argmax(-1)
    words, cur, start, prev = [], "", None, None
    for t, i in enumerate(ids):
        if i != prev and i != blank:
            if i == delim:
                if cur:
                    words.append({"text": cur, "start": start, "end": t * seconds_per_frame})
                cur, start = "", None
            else:
                if not cur:
                    start = t * seconds_per_frame
                cur += id_to_char.get(int(i), "")
        prev = i
    if cur:
        words.append({"text": cur, "start": start, "end": len(ids) * seconds_per_frame})
    return words

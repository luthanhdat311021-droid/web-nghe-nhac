"""Kiểm tra nhanh không cần GPU: python -m pytest research/alignment/tests  (hoặc chạy trực tiếp file này)."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from musicwave_align.align import ctc_force_align, ctc_greedy_words, dp_align  # noqa: E402
from musicwave_align.metrics import line_errors, word_errors  # noqa: E402
from musicwave_align.text import lyric_lines, normalize  # noqa: E402

LINES = ["Mưa rơi, nhớ em!", "Ngày 25 tháng 12"]


def test_normalize():
    assert normalize("Mưa rơi, nhớ em!") == "mưa rơi nhớ em"
    assert normalize("25") == "hai mươi lăm"
    assert normalize("21 101") == "hai mươi mốt một trăm linh một"
    assert lyric_lines("[Điệp khúc]\n[00:12.30] Mưa rơi\n\n(x2)\nNhớ em") == ["Mưa rơi", "Nhớ em"]
    assert lyric_lines(" 作词 : X\nBài Hát: Y\nCa Sĩ: Z\npre-chorus\nMưa rơi\n 비가 와요 \nNhớ em") == ["Mưa rơi", "Nhớ em"]


def test_dp_align_handles_misheard_and_extra_words():
    heard = [{"text": t, "start": s, "end": s + 0.3} for t, s in [
        ("ừ", 0.5), ("mưa", 1.0), ("rời", 1.3), ("nhớ", 1.6), ("anh", 1.9),
        ("ngày", 5.0), ("hai", 5.3), ("mươi", 5.6), ("lăm", 5.9), ("tháng", 6.2), ("mười", 6.5), ("hai", 6.8)]]
    lines = dp_align(LINES, heard)
    assert [l["time"] for l in lines] == [1.0, 5.0]
    # "rời" lệch một chữ với "rơi" nên vẫn ghép; "em" nghe thành "anh" (không ghép) → tiến từ mốc "nhớ"
    assert lines[0]["words"][1] == {"time": 1.3, "text": "rơi,"}
    assert lines[0]["words"][3] == {"time": round(1.6 + 0.28, 2), "text": "em!"}
    # số "25" là một từ hiển thị, lấy mốc của "hai"
    assert lines[1]["words"][1] == {"time": 5.3, "text": "25"}
    assert dp_align(LINES, [{"text": "khác", "start": 0, "end": 1}]) is None


def test_ctc_force_align_on_synthetic_emissions():
    chars = sorted(set(normalize(" ".join(LINES)).replace(" ", "")))
    vocab = {c: i + 1 for i, c in enumerate(chars)}  # 0 = blank
    spf = 0.02
    T = 600
    emis = np.full((T, len(vocab) + 1), -10.0)
    emis[:, 0] = -0.01
    # mỗi ký tự kéo dài 3 khung, từ bắt đầu ở các mốc đã biết
    starts = {"mưa": 1.0, "rơi": 1.4, "nhớ": 1.8, "em": 2.2, "ngày": 5.0, "hai": 5.5, "mươi": 5.8,
              "lăm": 6.2, "tháng": 6.6, "mười": 7.2, "hai#2": 7.7}
    for key, t in starts.items():
        word = key.split("#")[0]
        f = round(t / spf)
        for k, ch in enumerate(word):
            emis[f + 3 * k:f + 3 * k + 3, vocab[ch]] = -0.01
            emis[f + 3 * k:f + 3 * k + 3, 0] = -10
    lines = ctc_force_align(LINES, emis, vocab, 0, spf)
    assert [l["time"] for l in lines] == [1.0, 5.0]
    assert [w["time"] for w in lines[0]["words"]] == [1.0, 1.4, 1.8, 2.2]
    assert [w["time"] for w in lines[1]["words"]] == [5.0, 5.5, 6.6, 7.2]


def test_greedy_and_metrics():
    emis = np.full((10, 4), -10.0)
    ids = [0, 1, 1, 0, 2, 3, 0, 1, 0, 0]  # 3 = '|'
    emis[np.arange(10), ids] = 0
    words = ctc_greedy_words(emis, {1: "a", 2: "b"}, 0, 3, 0.02)
    assert [w["text"] for w in words] == ["ab", "a"]
    gt = [{"time": 1.0, "text": "Mưa rơi, nhớ em!", "words": [{"time": 1.0, "text": "Mưa"}, {"time": 1.5, "text": "rơi,"},
                                                               {"time": 1.8, "text": "nhớ"}, {"time": 2.2, "text": "em!"}]},
          {"time": 5.0, "text": "Ngày 25 tháng 12"}]
    pred = [{"time": 1.2, "text": "mưa rơi nhớ em", "words": [{"time": 1.2}, {"time": 1.4}, {"time": 1.8}, {"time": 2.2}]},
            {"time": 9.0, "text": "dòng thừa"}, {"time": 4.5, "text": "Ngày 25 tháng 12"}]
    assert np.allclose(line_errors(pred, gt), [0.2, 0.5])
    assert np.allclose(word_errors(pred, gt), [0.2, 0.1, 0, 0])


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("OK", name)

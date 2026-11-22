"""Bộ lọc ảo giác của ASR (không cần GPU): python research/alignment/tests/test_asr_filter.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from musicwave_align.asr import drop_hallucinations  # noqa: E402


def test_drop_hallucinations():
    segs = [{"text": " Hãy subscribe cho kênh Ghiền Mì Gõ để không bỏ lỡ những video hấp dẫn"},
            {"text": " Ngày mà em đi"},
            {"text": " Ngày mà em đi"},  # lặp y hệt đoạn trước
            {"text": " "},
            {"text": "Vietsub by abc"},
            {"text": " Con thuyền kia lặng nhìn"}]
    assert [s["text"].strip() for s in drop_hallucinations(segs)] == ["Ngày mà em đi", "Con thuyền kia lặng nhìn"]


if __name__ == "__main__":
    test_drop_hallucinations()
    print("OK test_drop_hallucinations")

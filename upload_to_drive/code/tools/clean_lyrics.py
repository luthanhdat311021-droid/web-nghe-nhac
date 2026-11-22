"""Làm sạch file lời trong data/lyrics: bỏ dòng dịch tiếng Hàn/Trung/Nhật, dòng ghi công
(作词, Bài hát:, Ca sĩ:, Lyrics by...), khoảng trắng thừa và dòng trống liên tiếp.
Chạy: python research/alignment/tools/clean_lyrics.py
"""
import re
from pathlib import Path

LYRICS = Path(__file__).resolve().parents[1] / "data" / "lyrics"
CJK = re.compile(r"[぀-ヿ㐀-鿿가-힯ᄀ-ᇿ]")
CREDIT = re.compile(r"^\s*(bài hát|ca sĩ|sáng tác|nhạc sĩ|tác giả|lyrics?( by)?|composer|music by|beat|prod\.?|mix|master)\s*[:：]", re.I)


def clean(text: str) -> str:
    out = []
    for line in text.splitlines():
        line = re.sub(r"\s+", " ", line).strip()
        if CJK.search(line) or CREDIT.match(line):
            continue
        if not line and (not out or not out[-1]):
            continue
        out.append(line)
    return "\n".join(out).strip() + "\n"


if __name__ == "__main__":
    for f in sorted(LYRICS.glob("*.txt")):
        before = f.read_text(encoding="utf-8")
        after = clean(before)
        n0 = sum(1 for l in before.splitlines() if l.strip())
        n1 = sum(1 for l in after.splitlines() if l.strip())
        if after != before:
            f.write_text(after, encoding="utf-8")
        print(f"{n0:4d} → {n1:4d} dòng  {f.stem}")

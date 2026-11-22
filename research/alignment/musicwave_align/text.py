"""Chuẩn hóa lời bài hát tiếng Việt trước khi căn chỉnh hoặc tính WER."""
import re
import unicodedata

_DIGITS = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"]
# Ghi chú thường gặp trong lời bài hát: [Điệp khúc], (x2), Verse 1:, pre-chorus, ...
_NOTE = re.compile(r"\[[^\]]*\]|\([^)]*\)|^\s*(pre-?chorus|post-?chorus|verse|chorus|hook|bridge|điệp khúc|đk|rap|outro|intro)\b.*$", re.I | re.M)
# Dòng dịch tiếng Hàn/Trung/Nhật xen giữa lời (LRCLIB hay có) và dòng ghi công
_CJK = re.compile(r"[぀-ヿ㐀-鿿가-힯ᄀ-ᇿ]")
_CREDIT = re.compile(r"^\s*(bài hát|ca sĩ|sáng tác|nhạc sĩ|tác giả|lyrics?( by)?|composer|music by)\s*[:：]", re.I)


def _number_to_words(n: int) -> str:
    """Đọc số 0–999 (đủ cho lời bài hát); số lớn hơn đọc từng chữ số."""
    if n < 10:
        return _DIGITS[n]
    if n < 100:
        tens, unit = divmod(n, 10)
        head = "mười" if tens == 1 else _DIGITS[tens] + " mươi"
        if unit == 0:
            return head
        tail = {1: "mốt" if tens > 1 else "một", 5: "lăm"}.get(unit, _DIGITS[unit])
        return f"{head} {tail}"
    if n < 1000:
        hundreds, rest = divmod(n, 100)
        head = _DIGITS[hundreds] + " trăm"
        if rest == 0:
            return head
        return f"{head} {'linh ' + _DIGITS[rest] if rest < 10 else _number_to_words(rest)}"
    return " ".join(_DIGITS[int(d)] for d in str(n))


def normalize(text: str) -> str:
    """Viết thường, NFC, số thành chữ, bỏ dấu câu. Giữ dấu tiếng Việt."""
    text = unicodedata.normalize("NFC", text).lower()
    text = re.sub(r"\d+", lambda m: f" {_number_to_words(int(m.group()))} ", text)
    text = re.sub(r"[^\w\s]|_", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def strip_accents(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text.replace("đ", "d").replace("Đ", "D")


def lyric_lines(raw: str) -> list[str]:
    """Tách lời thành các dòng có chữ, bỏ ghi chú và dòng trống. Giữ nguyên chữ gốc để hiển thị."""
    raw = re.sub(r"^\[\d{2}:\d{2}(?:\.\d+)?\]\s*", "", raw, flags=re.M)  # bỏ mốc LRC nếu có
    out = []
    for line in _NOTE.sub("", raw).splitlines():
        line = line.strip()
        if _CJK.search(line) or _CREDIT.match(line):
            continue
        if normalize(line):
            out.append(line)
    return out


def line_words(lines: list[str]) -> list[tuple[int, str]]:
    """(chỉ số dòng, từ đã chuẩn hóa) cho mọi từ trong lời."""
    return [(i, w) for i, line in enumerate(lines) for w in normalize(line).split()]

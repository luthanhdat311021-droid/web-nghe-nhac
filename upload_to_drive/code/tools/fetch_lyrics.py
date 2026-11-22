"""Tìm lời cho các file nhạc trong data/audio trên LRCLIB (nguồn web MusicWave đang dùng).

Ghi data/lyrics/<tên file>.txt và data/manifest.json. Bài không tìm được lời thì nhóm tự dán lời vào .txt.
Chạy: python research/alignment/tools/fetch_lyrics.py
"""
import json
import time
import unicodedata
from pathlib import Path

from urllib.parse import urlencode
from urllib.request import Request, urlopen

DATA = Path(__file__).resolve().parents[1] / "data"
# tên file → (tên bài, ca sĩ); ca sĩ trống thì chỉ tìm theo tên bài
SONGS = {
    "Ai Khóc Nỗi Đau Này": ("Ai Khóc Nỗi Đau Này", "Bảo Anh"),
    "AMV Nỗi Đau Từ Một Người Đến Sau": ("Nỗi Đau Từ Một Người Đến Sau", ""),
    "Anh Chẳng Sao Mà": ("Anh Chẳng Sao Mà", "Khang Việt"),
    "Bán Duyên": ("Bán Duyên", "Đình Dũng"),
    "Cause I Love You": ("Cause I Love You", "Noo Phước Thịnh"),
    "Chạm Khẽ Tim Anh": ("Chạm Khẽ Tim Anh Một Chút Thôi", "Noo Phước Thịnh"),
    "Hoa Nở Không Màu": ("Hoa Nở Không Màu", "Hoài Lâm"),
    "Họ Yêu Ai Mất Rồi": ("Họ Yêu Ai Mất Rồi", "Doãn Hiếu"),
    "JayKii CHIỀU HÔM ẤY": ("Chiều Hôm Ấy", "JayKii"),
    "MUỐN NÓI VỚI EM": ("Muốn Nói Với Em", ""),
    "MỘT BƯỚC YÊU VẠN DẶM ĐAU": ("Một Bước Yêu Vạn Dặm Đau", "Mr. Siro"),
    "Ngô Kiến Huy Giả Vờ Yêu": ("Giả Vờ Yêu", "Ngô Kiến Huy"),
    "Ngắm Hoa Lệ Rơi": ("Ngắm Hoa Lệ Rơi", "Châu Khải Phong"),
    "Nỗi Đau Xót Xa": ("Nỗi Đau Xót Xa", "Minh Vương M4U"),
    "Sai Người Sai Thời Điểm": ("Sai Người Sai Thời Điểm", "Thanh Hưng"),
    "Thay Tôi Yêu Cô Ấy": ("Thay Tôi Yêu Cô Ấy", "Thanh Hưng"),
    "Thất Tình": ("Thất Tình", "Trịnh Đình Quang"),
    "TỪNG YÊU": ("Từng Yêu", "Phan Duy Anh"),
    "Âm Thầm Bên Em": ("Âm Thầm Bên Em", "Sơn Tùng M-TP"),
    "ĐAU ĐỂ TRƯỞNG THÀNH": ("Đau Để Trưởng Thành", "OnlyC"),
}


def nfc(s):
    return unicodedata.normalize("NFC", s)


def search(title, artist):
    params = {"track_name": title, **({"artist_name": artist} if artist else {})}
    req = Request("https://lrclib.net/api/search?" + urlencode(params), headers={"User-Agent": "musicwave-research/1.0"})
    with urlopen(req, timeout=30) as r:
        hits = [h for h in json.load(r) if h.get("plainLyrics")]
    if not hits and artist:
        return search(title, "")
    # ưu tiên tên bài trùng khớp, rồi bản có lời dài nhất
    key = nfc(title).lower()
    hits.sort(key=lambda h: (nfc(h["trackName"]).lower() != key, -len(h["plainLyrics"])))
    return hits[0] if hits else None


def main():
    (DATA / "lyrics").mkdir(exist_ok=True)
    manifest = []
    for mp3 in sorted((DATA / "audio").glob("*.mp3")):
        stem = nfc(mp3.stem)
        title, artist = next((v for k, v in SONGS.items() if stem.startswith(nfc(k))), (stem, ""))
        out = DATA / "lyrics" / f"{mp3.stem}.txt"
        entry = {"id": mp3.stem, "audio": f"audio/{mp3.name}", "lyrics": f"lyrics/{out.name}", "title": title, "artist": artist}
        if out.exists():
            entry["source"] = "có sẵn"
        else:
            hit = search(title, artist)
            time.sleep(0.5)
            if hit:
                out.write_text(hit["plainLyrics"], encoding="utf-8")
                entry.update(source="lrclib", matched=f"{hit['trackName']} – {hit['artistName']}", lrclib_duration=hit.get("duration"))
            else:
                entry["source"] = "KHÔNG TÌM THẤY: tự dán lời vào file .txt"
        manifest.append(entry)
        print(f"{entry['source'][:22]:22s} {title} – {artist}  {entry.get('matched', '')}")
    (DATA / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()

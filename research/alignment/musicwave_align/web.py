"""Lấy bài hát từ API MusicWave, tải âm thanh, và gửi lời đã căn chỉnh về web."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path
from urllib.parse import urlparse

import requests

DEFAULT_API = "https://musicwave-app.vercel.app/api"


class MusicWave:
    def __init__(self, api: str = DEFAULT_API, token: str | None = None):
        self.api = api.rstrip("/")
        self.origin = "{0.scheme}://{0.netloc}".format(urlparse(self.api))
        self.session = requests.Session()
        if token:
            self.session.headers["Authorization"] = f"Bearer {token}"

    def _get(self, path: str, **params):
        r = self.session.get(f"{self.api}{path}", params=params, timeout=60)
        r.raise_for_status()
        return r.json()["data"]

    def list_songs(self, max_songs: int = 500) -> list[dict]:
        songs, page = [], 1
        while len(songs) < max_songs:
            data = self._get("/songs", page=page, limit=100)
            songs += data["items"]
            if page >= data["pagination"]["totalPages"]:
                break
            page += 1
        return songs[:max_songs]

    def song(self, song_id: str) -> dict:
        data = self._get(f"/songs/{song_id}")
        return data.get("song", data)

    def download_audio(self, song: dict, out_dir: str | Path) -> Path:
        """Tải âm thanh về out_dir/<id>.<ext>. Link YouTube tải bằng yt-dlp (chỉ dùng cho nghiên cứu)."""
        out_dir = Path(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        existing = list(out_dir.glob(f"{song['id']}.*"))
        if existing:
            return existing[0]
        url = song.get("audioUrl") or song.get("youtubeUrl") or ""
        if url.startswith("/"):
            url = self.origin + url
        if "youtu" in url:
            subprocess.run(["yt-dlp", "-q", "-x", "--audio-format", "mp3", "-o",
                            str(out_dir / f"{song['id']}.%(ext)s"), url], check=True)
            return out_dir / f"{song['id']}.mp3"
        r = self.session.get(url, timeout=120)
        r.raise_for_status()
        ext = Path(urlparse(url).path).suffix or ".mp3"
        path = out_dir / f"{song['id']}{ext}"
        path.write_bytes(r.content)
        return path

    def upload_aligned(self, song_id: str, lines: list[dict]) -> dict:
        """Ghi lời đã căn chỉnh vào bảng Lyrics (cần token tài khoản admin)."""
        r = self.session.put(f"{self.api}/admin/songs/{song_id}/aligned-lyrics", json={"lines": lines}, timeout=60)
        if not r.ok:
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
        return r.json()


def plain_lyrics(song: dict) -> str:
    lyr = song.get("lyrics") or {}
    if lyr.get("plainLyrics"):
        return lyr["plainLyrics"]
    synced = lyr.get("syncedLyrics") or ""
    try:  # JSON [{time, text}]
        return "\n".join(l["text"] for l in json.loads(synced))
    except (ValueError, TypeError, KeyError):
        return synced  # LRC: lyric_lines() tự bỏ mốc


def separate_vocals(audio: str | Path, out_dir: str | Path, model: str = "htdemucs_ft") -> Path:
    """Tách giọng bằng Demucs. Kết quả: out_dir/<model>/<tên file>/vocals.wav (có sẵn thì bỏ qua)."""
    audio = Path(audio)
    target = Path(out_dir) / model / audio.stem / "vocals.wav"
    if not target.exists():
        subprocess.run(["python", "-m", "demucs", "--two-stems=vocals", "-n", model,
                        "-o", str(out_dir), str(audio)], check=True)
    return target

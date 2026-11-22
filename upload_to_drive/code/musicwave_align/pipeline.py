"""Các bước chạy hàng loạt, có lưu tạm từng bài lên Drive để Colab bị ngắt thì chạy tiếp được."""
from __future__ import annotations

import json
import time
from pathlib import Path

from .align import ctc_force_align, dp_align
from .asr import ASR_VERSION, load_audio
from .metrics import line_errors, summarize, wer_cer, word_errors
from .text import lyric_lines
from .web import plain_lyrics


def _read(path: Path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def _write(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")


def song_lines(song: dict) -> list[str]:
    return lyric_lines(plain_lyrics(song))


def run_asr(model, songs: list[dict], inputs: dict[str, dict[str, Path]], work: Path):
    """Chạy một mô hình ASR trên mọi bài với mọi loại đầu vào ("mix", "vocals"), rồi ghép với lời.

    inputs: {"mix": {song_id: path}, "vocals": {song_id: path}}
    """
    for kind, paths in inputs.items():
        config = f"{model.name}_{kind}"
        for song in songs:
            sid = song["id"]
            raw_path = work / "asr" / config / f"{sid}.json"
            out_path = work / "align" / config / f"{sid}.json"
            if sid not in paths or (_read(out_path) or {}).get("version") == ASR_VERSION:
                continue
            raw = _read(raw_path)
            if raw is None or raw.get("version") != ASR_VERSION:  # kết quả của code cũ: chạy lại
                t0 = time.time()
                words, text = model.transcribe(str(paths[sid]))
                raw = {"words": words, "text": text, "seconds": time.time() - t0, "version": ASR_VERSION}
                _write(raw_path, raw)
            lines = dp_align(song_lines(song), raw["words"])
            _write(out_path, {"lines": lines, "seconds": raw["seconds"], "version": ASR_VERSION})
            heard = len(raw["words"])
            print(f"{config:22s} {song['title'][:40]:40s} {'OK' if lines else 'không căn được':15s} ({heard} từ nghe được)")


def run_ctc(w2v, songs: list[dict], inputs: dict[str, dict[str, Path]], work: Path):
    """Căn chỉnh cưỡng bức CTC bằng wav2vec2 (lời đã biết)."""
    for kind, paths in inputs.items():
        config = f"ctc_{kind}"
        for song in songs:
            sid = song["id"]
            out_path = work / "align" / config / f"{sid}.json"
            if out_path.exists() or sid not in paths:
                continue
            t0 = time.time()
            emis, spf = w2v.emissions(load_audio(str(paths[sid])))
            lines = ctc_force_align(song_lines(song), emis, w2v.vocab, w2v.blank, spf)
            _write(out_path, {"lines": lines, "seconds": time.time() - t0})
            print(f"{config:22s} {song['title'][:40]:40s} {'OK' if lines else 'không căn được'}")


def save_web_baseline(songs: list[dict], work: Path):
    """Lời đồng bộ web đang lưu (Whisper qua Groq / LRCLIB / Gemini) làm mốc so sánh."""
    from .text import normalize

    for song in songs:
        raw = (song.get("lyrics") or {}).get("syncedLyrics")
        if not raw:
            continue
        try:
            lines = json.loads(raw)
        except ValueError:
            import re
            lines = []
            for m in re.finditer(r"\[(\d{2}):(\d{2}(?:\.\d+)?)\](.*)", raw):
                if normalize(m.group(3)):
                    lines.append({"time": int(m.group(1)) * 60 + float(m.group(2)), "text": m.group(3).strip()})
        _write(work / "align" / "web_hien_tai" / f"{song['id']}.json", {"lines": lines, "seconds": None})


def evaluate(songs: list[dict], ground_truth: dict[str, dict], work: Path):
    """Bảng số liệu cho mọi cấu hình đã chạy. Trả về (bảng theo cấu hình, bảng theo từng bài)."""
    import pandas as pd

    rows = []
    by_id = {s["id"]: s for s in songs}
    for config_dir in sorted((work / "align").glob("*")):
        config = config_dir.name
        for sid, gt in ground_truth.items():
            res = _read(config_dir / f"{sid}.json")
            if sid not in by_id:
                continue
            row = {"config": config, "song_id": sid, "title": by_id[sid]["title"],
                   "genre": (by_id[sid].get("genre") or {}).get("name"), "ok": bool(res and res["lines"])}
            if row["ok"]:
                le, we = line_errors(res["lines"], gt["lines"]), word_errors(res["lines"], gt["lines"])
                row.update({f"line_{k}": v for k, v in summarize(le).items()})
                row.update({f"word_{k}": v for k, v in summarize(we).items()})
                row["seconds"] = res.get("seconds")
                row["_line_err"], row["_word_err"] = le, we
            asr = _read(work / "asr" / config / f"{sid}.json")
            if asr:
                row.update(wer_cer("\n".join(l["text"] for l in gt["lines"]), asr["text"]))
            rows.append(row)
    per_song = pd.DataFrame(rows)
    if per_song.empty:
        return per_song, per_song

    import numpy as np

    def agg(g):
        le = np.concatenate([e for e in g.get("_line_err", []) if isinstance(e, np.ndarray)] or [np.array([])])
        we = np.concatenate([e for e in g.get("_word_err", []) if isinstance(e, np.ndarray)] or [np.array([])])
        out = {"bài căn được": f"{int(g['ok'].sum())}/{len(g)}"}
        out.update({f"dòng {k}": v for k, v in summarize(le).items() if k != "n"})
        out.update({f"từ {k}": v for k, v in summarize(we).items() if k != "n"})
        for k in ("wer", "cer", "seconds"):
            if k in g and g[k].notna().any():
                out[k] = g[k].mean()
        return pd.Series(out)

    table = per_song.groupby("config").apply(agg)
    if "dòng mean_s" in table:
        table = table.sort_values("dòng mean_s")
    return table, per_song.drop(columns=[c for c in per_song if c.startswith("_")])

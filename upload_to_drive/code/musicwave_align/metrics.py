"""Số liệu đánh giá: độ lệch mốc dòng/từ so với mốc chuẩn ghi tay, và WER/CER của ASR."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from .text import normalize

THRESHOLDS = (0.3, 0.5, 1.0)


def load_ground_truth(folder: str | Path) -> dict[str, dict]:
    """Mỗi file JSON do annotator.html xuất ra: {"songId", "title", "lines": [{"time", "text", "words"?}]}."""
    out = {}
    for f in sorted(Path(folder).glob("*.json")):
        gt = json.loads(f.read_text(encoding="utf-8"))
        out[gt["songId"]] = gt
    return out


def match_lines(pred_lines: list[dict], gt_lines: list[dict]) -> list[tuple[dict, dict]]:
    """Ghép dòng dự đoán với dòng chuẩn theo nội dung chữ (difflib), nên lời của web hiện tại
    (có thể khác vài dòng) vẫn so được. Dòng chuẩn chưa ghi mốc bị bỏ qua."""
    from difflib import SequenceMatcher

    a = [normalize(l["text"]) for l in pred_lines]
    b = [normalize(l["text"]) for l in gt_lines]
    pairs = []
    for block in SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(block.size):
            p, g = pred_lines[block.a + k], gt_lines[block.b + k]
            if g.get("time") is not None:
                pairs.append((p, g))
    return pairs


def line_errors(pred_lines: list[dict], gt_lines: list[dict]) -> np.ndarray:
    return np.array([abs(p["time"] - g["time"]) for p, g in match_lines(pred_lines, gt_lines)])


def word_errors(pred_lines: list[dict], gt_lines: list[dict]) -> np.ndarray:
    errs = []
    for p, g in match_lines(pred_lines, gt_lines):
        pw, gw = p.get("words", []), g.get("words", [])
        if pw and len(pw) == len(gw):
            errs += [abs(x["time"] - y["time"]) for x, y in zip(pw, gw) if y.get("time") is not None]
    return np.array(errs)


def summarize(errors: np.ndarray) -> dict:
    if errors.size == 0:
        return {}
    out = {"mean_s": float(errors.mean()), "median_s": float(np.median(errors)), "n": int(errors.size)}
    for t in THRESHOLDS:
        out[f"within_{t}s_%"] = float((errors <= t).mean() * 100)
    return out


def wer_cer(reference: str, hypothesis: str) -> dict:
    import jiwer

    ref, hyp = normalize(reference), normalize(hypothesis)
    if not ref:
        return {}
    return {"wer": jiwer.wer(ref, hyp or " "), "cer": jiwer.cer(ref, hyp or " ")}

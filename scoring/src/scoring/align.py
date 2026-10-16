"""CTC forced alignment, GOP-style per-phone scores, and sequence alignment (research R6).

Pure NumPy so it runs on a small CPU box and is unit-testable without models.
"""

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

FloatArray = NDArray[np.float32]


@dataclass(frozen=True)
class AlignedPhone:
    token: int
    start: int  # first frame (inclusive)
    end: int  # last frame (exclusive)


def log_softmax(logits: FloatArray) -> FloatArray:
    m = logits.max(axis=-1, keepdims=True)
    z = logits - m
    return (z - np.log(np.exp(z).sum(axis=-1, keepdims=True))).astype(np.float32)


def ctc_forced_align(log_probs: FloatArray, targets: list[int], blank: int) -> list[AlignedPhone]:
    """Viterbi alignment of `targets` to frame log-probs (T × V) under the CTC topology."""
    t_len = log_probs.shape[0]
    if not targets:
        return []
    ext = [blank]
    for tok in targets:
        ext += [tok, blank]
    s_len = len(ext)
    if t_len < len(targets):
        raise ValueError("audio too short for target sequence")

    neg = np.float32(-1e30)
    dp = np.full((t_len, s_len), neg, dtype=np.float32)
    bp = np.zeros((t_len, s_len), dtype=np.int8)  # 0 stay, 1 from s-1, 2 from s-2
    dp[0, 0] = log_probs[0, ext[0]]
    dp[0, 1] = log_probs[0, ext[1]]
    for t in range(1, t_len):
        for s in range(s_len):
            best, arg = dp[t - 1, s], 0
            if s >= 1 and dp[t - 1, s - 1] > best:
                best, arg = dp[t - 1, s - 1], 1
            if s >= 2 and ext[s] != blank and ext[s] != ext[s - 2] and dp[t - 1, s - 2] > best:
                best, arg = dp[t - 1, s - 2], 2
            dp[t, s] = best + log_probs[t, ext[s]]
            bp[t, s] = arg

    s = s_len - 1 if dp[-1, s_len - 1] >= dp[-1, s_len - 2] else s_len - 2
    path = np.zeros(t_len, dtype=np.int64)
    for t in range(t_len - 1, -1, -1):
        path[t] = s
        s -= int(bp[t, s])

    phones: list[AlignedPhone] = []
    for idx in range(1, s_len, 2):  # odd states are target tokens
        frames = np.nonzero(path == idx)[0]
        if frames.size == 0:
            # Token skipped by the path (should not happen with valid CTC); give it one frame.
            prev_end = phones[-1].end if phones else 0
            phones.append(AlignedPhone(ext[idx], prev_end, min(prev_end + 1, t_len)))
        else:
            phones.append(AlignedPhone(ext[idx], int(frames[0]), int(frames[-1]) + 1))
    return phones


def gop_scores(log_probs: FloatArray, aligned: list[AlignedPhone], blank: int) -> list[float]:
    """Goodness of pronunciation per aligned phone, mapped to 0–100.

    Per frame, GOP_t = log p(target) − max over non-blank log p(q) (≤ 0; 0 means the target was
    the most likely sound). The phone score is the mean of exp(GOP_t) over its frames, ×100.
    Averaging in the probability domain keeps one boundary frame leaked from a neighbouring
    mispronounced phone from collapsing an otherwise clean sound.
    """
    lp = log_probs.copy()
    lp[:, blank] = -np.inf
    out: list[float] = []
    for ph in aligned:
        seg = lp[ph.start : ph.end]
        if seg.shape[0] == 0:
            out.append(0.0)
            continue
        per_frame = np.exp(seg[:, ph.token] - seg.max(axis=1))
        out.append(round(100.0 * float(per_frame.mean()), 2))
    return out


def greedy_decode(log_probs: FloatArray, blank: int) -> list[int]:
    best = log_probs.argmax(axis=1)
    out: list[int] = []
    prev = -1
    for tok in best.tolist():
        if tok != prev and tok != blank:
            out.append(int(tok))
        prev = tok
    return out


def edit_ops(expected: list[str], actual: list[str]) -> list[tuple[str, str | None, str | None]]:
    """Levenshtein alignment → ops: ('ok'|'sub'|'del'|'ins', expected, actual)."""
    n, m = len(expected), len(actual)
    d = np.zeros((n + 1, m + 1), dtype=np.int32)
    d[:, 0] = np.arange(n + 1)
    d[0, :] = np.arange(m + 1)
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if expected[i - 1] == actual[j - 1] else 1
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + cost)
    ops: list[tuple[str, str | None, str | None]] = []
    i, j = n, m
    while i > 0 or j > 0:
        if i > 0 and j > 0 and d[i, j] == d[i - 1, j - 1] + (expected[i - 1] != actual[j - 1]):
            ops.append(
                (
                    "ok" if expected[i - 1] == actual[j - 1] else "sub",
                    expected[i - 1],
                    actual[j - 1],
                )
            )
            i, j = i - 1, j - 1
        elif i > 0 and d[i, j] == d[i - 1, j] + 1:
            ops.append(("del", expected[i - 1], None))
            i -= 1
        else:
            ops.append(("ins", None, actual[j - 1]))
            j -= 1
    return ops[::-1]


def sequence_accuracy(expected: list[str], actual: list[str]) -> float:
    """1 − normalized edit distance, clipped to [0, 1]."""
    if not expected:
        return 0.0
    errors = sum(1 for op, _, _ in edit_ops(expected, actual) if op != "ok")
    return max(0.0, 1.0 - errors / len(expected))

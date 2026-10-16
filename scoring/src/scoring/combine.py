"""Combines word accuracy, fluency, and per-sound scores into one 0–100 score (research R7)."""

import re
from collections import defaultdict
from dataclasses import dataclass, field

from .align import sequence_accuracy

# Comfortable speaking-rate targets (words per minute) by CEFR level. Below the floor = halting.
_WPM_FLOOR = {"A1": 55, "A2": 65, "B1": 80, "B2": 95, "C1": 110, "C2": 120}
_LONG_PAUSE_S = 0.8
_WORD_RE = re.compile(r"[a-z']+")
WRONG_CONTENT_THRESHOLD = 0.3


def words(text: str) -> list[str]:
    t = text.lower().replace("’", "'")
    return _WORD_RE.findall(t)


def word_accuracy(expected_text: str, transcript: str) -> float:
    return sequence_accuracy(words(expected_text), words(transcript))


def fluency(
    word_starts: list[float], word_ends: list[float], speech_seconds: float, level: str
) -> float:
    """0–1: speaking rate vs a level floor, penalized by long internal pauses."""
    n = len(word_starts)
    if n == 0 or speech_seconds <= 0:
        return 0.0
    wpm = n / speech_seconds * 60.0
    rate = min(1.0, wpm / _WPM_FLOOR.get(level, 80))
    pauses = sum(
        1
        for prev_end, start in zip(word_ends[:-1], word_starts[1:], strict=False)
        if start - prev_end > _LONG_PAUSE_S
    )
    pause_penalty = min(0.5, 0.15 * pauses)
    return max(0.0, rate - pause_penalty)


@dataclass
class SoundStat:
    total: float = 0.0
    count: int = 0

    @property
    def mean(self) -> float:
        return self.total / self.count if self.count else 0.0


@dataclass
class Combined:
    score: int
    phoneme_accuracy: int
    word_accuracy: int
    fluency: int
    sounds: list[dict[str, object]] = field(default_factory=list)
    weakest_sounds: list[str] = field(default_factory=list)


def aggregate_sounds(per_phone: list[tuple[str | None, float]]) -> dict[str, SoundStat]:
    stats: dict[str, SoundStat] = defaultdict(SoundStat)
    for app_symbol, score in per_phone:
        if app_symbol is None:
            continue
        stats[app_symbol].total += score
        stats[app_symbol].count += 1
    return dict(stats)


def weakest(stats: dict[str, SoundStat], k: int = 3) -> list[str]:
    """2–3 lowest-scoring sounds; prefer sounds heard ≥ 2 times, else allow single occurrences."""
    ranked = sorted(stats.items(), key=lambda kv: kv[1].mean)
    repeated = [s for s, st in ranked if st.count >= 2]
    chosen = repeated[:k]
    if len(chosen) < 2:
        chosen += [s for s, _ in ranked if s not in chosen][: k - len(chosen)]
    return chosen[:k]


def combine(
    *,
    phone_scores: list[tuple[str | None, float]],
    word_acc: float,
    fluency_value: float,
    weights: tuple[float, float, float],
) -> Combined:
    w_ph, w_word, w_flu = weights
    stats = aggregate_sounds(phone_scores)
    scored = [s for sym, s in phone_scores if sym is not None]
    phoneme = sum(scored) / len(scored) if scored else 0.0
    total = (w_ph * phoneme + w_word * 100 * word_acc + w_flu * 100 * fluency_value) / (
        w_ph + w_word + w_flu
    )
    return Combined(
        score=int(round(max(0.0, min(100.0, total)))),
        phoneme_accuracy=int(round(phoneme)),
        word_accuracy=int(round(100 * word_acc)),
        fluency=int(round(100 * fluency_value)),
        sounds=[
            {"ipa": sym, "score": int(round(st.mean)), "count": st.count}
            for sym, st in sorted(stats.items(), key=lambda kv: kv[1].mean)
        ],
        weakest_sounds=weakest(stats) if len(stats) >= 2 else list(stats)[:1],
    )

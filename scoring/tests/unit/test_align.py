import numpy as np
import pytest

from scoring.align import (
    ctc_forced_align,
    edit_ops,
    gop_scores,
    greedy_decode,
    log_softmax,
    sequence_accuracy,
)

BLANK = 0


def frames(seq: list[int], vocab: int = 5, confidence: float = 8.0) -> np.ndarray:
    """Logits where each frame strongly prefers the given token."""
    logits = np.zeros((len(seq), vocab), dtype=np.float32)
    for t, tok in enumerate(seq):
        logits[t, tok] = confidence
    return log_softmax(logits)


def test_forced_alignment_finds_token_spans() -> None:
    lp = frames([0, 1, 1, 0, 2, 2, 2, 0, 3])
    aligned = ctc_forced_align(lp, [1, 2, 3], BLANK)
    assert [(a.token, a.start, a.end) for a in aligned] == [(1, 1, 3), (2, 4, 7), (3, 8, 9)]


def test_forced_alignment_handles_repeated_tokens_with_blank_between() -> None:
    lp = frames([1, 0, 1])
    aligned = ctc_forced_align(lp, [1, 1], BLANK)
    assert [(a.start, a.end) for a in aligned] == [(0, 1), (2, 3)]


def test_forced_alignment_rejects_too_short_audio() -> None:
    with pytest.raises(ValueError):
        ctc_forced_align(frames([1]), [1, 2, 3], BLANK)


def test_gop_is_high_for_clear_phones_and_low_for_substituted_ones() -> None:
    # Expected [1, 2, 3] but the speaker produced token 4 where 2 should be.
    lp = frames([1, 1, 4, 4, 3, 3])
    aligned = ctc_forced_align(lp, [1, 2, 3], BLANK)
    scores = gop_scores(lp, aligned, BLANK)
    assert scores[0] > 95
    assert scores[2] > 60  # may absorb one boundary frame from the substituted neighbour
    assert scores[1] < 5
    assert scores[2] - scores[1] > 50


def test_greedy_decode_collapses_repeats_and_blanks() -> None:
    assert greedy_decode(frames([0, 1, 1, 0, 1, 2, 2, 0]), BLANK) == [1, 1, 2]


def test_edit_ops_and_accuracy() -> None:
    ops = edit_ops(["ð", "æ", "t"], ["d", "æ"])
    assert ops == [("sub", "ð", "d"), ("ok", "æ", "æ"), ("del", "t", None)]
    assert sequence_accuracy(["a", "b", "c", "d"], ["a", "b", "c", "d"]) == 1.0
    assert sequence_accuracy(["a", "b"], ["x", "y", "z"]) == 0.0

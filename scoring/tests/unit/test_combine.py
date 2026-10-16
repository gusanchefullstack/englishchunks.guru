import pytest

from scoring.combine import aggregate_sounds, combine, fluency, weakest, word_accuracy


def test_word_accuracy_ignores_case_and_punctuation() -> None:
    assert word_accuracy("That makes sense.", "that makes sense") == 1.0
    assert word_accuracy("That makes sense.", "that make sense") == pytest.approx(2 / 3)


def test_fluency_rewards_rate_and_penalizes_long_pauses() -> None:
    fast = fluency([0.0, 0.3, 0.6], [0.25, 0.55, 0.9], 1.0, "B1")
    slow = fluency([0.0, 1.5, 3.0], [0.3, 1.8, 3.3], 3.3, "B1")
    assert fast == 1.0
    assert slow < 0.5
    assert fluency([], [], 0.0, "B1") == 0.0


def test_weakest_prefers_repeated_sounds_and_returns_two_to_three() -> None:
    stats = aggregate_sounds(
        [("ð", 30), ("ð", 40), ("s", 50), ("s", 60), ("æ", 10), ("t", 90), ("t", 95)]
    )
    assert weakest(stats) == ["ð", "s", "t"]  # æ heard once, so repeated sounds come first


def test_weakest_falls_back_to_single_occurrences() -> None:
    stats = aggregate_sounds([("ð", 30), ("s", 50)])
    assert weakest(stats) == ["ð", "s"]


def test_combine_weights_components() -> None:
    out = combine(
        phone_scores=[("ð", 50.0), ("æ", 90.0), ("t", 100.0), (None, 0.0)],
        word_acc=1.0,
        fluency_value=0.5,
        weights=(0.5, 0.3, 0.2),
    )
    assert out.phoneme_accuracy == 80
    assert out.word_accuracy == 100 and out.fluency == 50
    assert out.score == round(0.5 * 80 + 0.3 * 100 + 0.2 * 50)
    assert out.weakest_sounds[0] == "ð"
    assert 0 <= out.score <= 100

import pytest

from scoring.combine import aggregate_sounds, combine, fluency, weakest, word_accuracy


def test_word_accuracy_ignores_case_and_punctuation() -> None:
    assert word_accuracy("That makes sense.", "that makes sense") == 1.0
    assert word_accuracy("That makes sense.", "that make sense") == 1.0  # light stemming
    assert word_accuracy("That makes sense.", "this is sense") == pytest.approx(1 / 3)


def test_word_accuracy_does_not_punish_restarts() -> None:
    assert word_accuracy("That makes sense.", "that makes that makes sense") == 1.0
    assert word_accuracy("That makes sense.", "not make sense not make sense") == pytest.approx(
        2 / 3
    )
    assert word_accuracy("That makes sense.", "completely different words") == 0.0


def test_fluency_rewards_rate_and_penalizes_long_pauses() -> None:
    fast = fluency([0.0, 0.3, 0.6], [0.25, 0.55, 0.9], 1.0, "B1")
    slow = fluency([0.0, 1.5, 3.0], [0.3, 1.8, 3.3], 3.3, "B1")
    assert fast == 1.0
    assert slow < 0.5
    assert fluency([], [], 0.0, "B1") == 0.0


def test_weakest_prefers_repeated_weak_sounds() -> None:
    stats = aggregate_sounds(
        [("ð", 30), ("ð", 40), ("s", 50), ("s", 60), ("æ", 10), ("t", 90), ("t", 95)]
    )
    assert weakest(stats) == ["ð", "s", "æ"]  # repeated weak sounds first, then singles; t is fine


def test_weakest_never_flags_well_pronounced_sounds() -> None:
    # Real case: "That makes sense" heard as "Not make sense" — /s/ was perfect 3 times.
    stats = aggregate_sounds([("ð", 2), ("æ", 15), ("t", 100), ("s", 100), ("s", 100), ("s", 100)])
    assert weakest(stats) == ["ð", "æ"]


def test_weakest_is_empty_when_everything_is_good() -> None:
    assert weakest(aggregate_sounds([("ð", 95), ("s", 99)])) == []


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

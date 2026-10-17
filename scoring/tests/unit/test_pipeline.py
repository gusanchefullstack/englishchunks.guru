"""Running ASR and the phoneme model in parallel must not change any result."""

from scoring.engines import Engines
from scoring.pipeline import Unusable, score_recording
from scoring.settings import Settings
from tests.conftest import FakeAsr, FakePhonemes, FakeVad, wav_bytes


def _engines() -> tuple[Engines, FakeAsr]:
    asr = FakeAsr()
    engines = Engines(
        vad=FakeVad(),
        asr=asr,
        phonemes=FakePhonemes(),
        versions={"vad": "f", "asr": "f", "phonemes": "f"},
    )
    return engines, asr


def _settings(parallel: bool) -> Settings:
    return Settings(scoring_shared_secret="x" * 32, parallel_models=parallel)


def test_parallel_and_sequential_give_identical_results() -> None:
    audio = wav_bytes(2.0)
    engines, _ = _engines()
    kw = {"expected_text": "That makes sense.", "level": "B1", "engines": engines}
    seq_t: dict[str, float] = {}
    par_t: dict[str, float] = {}
    seq = score_recording(audio, settings=_settings(False), timings=seq_t, **kw)  # type: ignore[arg-type]
    par = score_recording(audio, settings=_settings(True), timings=par_t, **kw)  # type: ignore[arg-type]
    assert par == seq
    assert {"asr_ms", "phonemes_ms", "models_ms"} <= par_t.keys()


def test_parallel_mode_still_rejects_wrong_content() -> None:
    engines, asr = _engines()
    asr.text = "completely different words here"
    out = score_recording(
        wav_bytes(2.0),
        expected_text="That makes sense.",
        level="B1",
        engines=engines,
        settings=_settings(True),
    )
    assert out == Unusable("wrong_content")

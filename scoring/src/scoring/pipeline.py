"""One recording → score (research R4–R7). Audio lives only in local variables here."""

import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Literal

import numpy as np
from numpy.typing import NDArray

from .align import ctc_forced_align, gop_scores
from .audio import SAMPLE_RATE, AudioTooLargeError, DecodeFailedError, decode_audio
from .combine import WRONG_CONTENT_THRESHOLD, combine, fluency, word_accuracy
from .engines import Engines, Samples
from .hint_map import load_hint_map
from .settings import Settings

MIN_SPEECH_SECONDS = 0.3
UnusableReason = Literal["no_speech", "too_short", "too_noisy", "wrong_content", "decode_failed"]


@dataclass(frozen=True)
class Unusable:
    reason: UnusableReason


class TooLargeError(Exception):
    pass


# One background thread: the phoneme model runs there while ASR runs in the request thread.
_PHONEMES = ThreadPoolExecutor(max_workers=1, thread_name_prefix="phonemes")


class _Clock:
    """Stage durations for the log line (numbers only, never audio or text)."""

    def __init__(self, out: dict[str, float] | None) -> None:
        self.out = out if out is not None else {}
        self.t = time.perf_counter()

    def lap(self, name: str) -> None:
        now = time.perf_counter()
        self.out[f"{name}_ms"] = round((now - self.t) * 1000)
        self.t = now


def score_recording(
    data: bytes,
    *,
    expected_text: str,
    level: str,
    engines: Engines,
    settings: Settings,
    timings: dict[str, float] | None = None,
) -> dict[str, object] | Unusable:
    clock = _Clock(timings)
    try:
        samples = decode_audio(
            data, max_seconds=settings.max_audio_seconds, max_bytes=settings.max_audio_bytes
        )
    except AudioTooLargeError:
        raise TooLargeError from None
    except DecodeFailedError:
        return Unusable("decode_failed")
    clock.lap("decode")
    clock.out["audio_s"] = round(samples.size / SAMPLE_RATE, 2)

    speech, speech_seconds = engines.vad.trim(samples)
    del samples
    clock.lap("vad")
    clock.out["speech_s"] = round(speech.size / SAMPLE_RATE, 2)
    if speech_seconds == 0:
        return Unusable("no_speech")
    if speech_seconds < MIN_SPEECH_SECONDS:
        return Unusable("too_short")

    if settings.parallel_models:

        def timed_log_probs(s: Samples) -> tuple[NDArray[np.float32], float]:
            t = time.perf_counter()
            return engines.phonemes.log_probs(s), time.perf_counter() - t

        pending = _PHONEMES.submit(timed_log_probs, speech)
        t = time.perf_counter()
        transcript = engines.asr.transcribe(speech)
        clock.out["asr_ms"] = round((time.perf_counter() - t) * 1000)
        log_probs, phon_s = pending.result()  # also on wrong content: never leave work running
        clock.out["phonemes_ms"] = round(phon_s * 1000)
        clock.lap("models")
    else:
        transcript = engines.asr.transcribe(speech)
        clock.lap("asr")
        log_probs = engines.phonemes.log_probs(speech)
        clock.lap("phonemes")
        clock.out["models_ms"] = clock.out["asr_ms"] + clock.out["phonemes_ms"]
    del speech
    w_acc = word_accuracy(expected_text, transcript.text)
    if w_acc < WRONG_CONTENT_THRESHOLD:
        return Unusable("wrong_content")

    expected = engines.phonemes.expected(expected_text)
    try:
        aligned = ctc_forced_align(log_probs, [t for t, _ in expected], engines.phonemes.blank)
    except ValueError:
        return Unusable("too_short")
    per_phone = gop_scores(log_probs, aligned, engines.phonemes.blank)
    clock.lap("align")
    hints = load_hint_map()
    phone_scores = [(hints.to_app(sym), s) for (_, sym), s in zip(expected, per_phone, strict=True)]

    flu = fluency(transcript.word_starts, transcript.word_ends, speech_seconds, level)
    c = combine(
        phone_scores=phone_scores,
        word_acc=w_acc,
        fluency_value=flu,
        weights=(settings.weight_phoneme, settings.weight_word, settings.weight_fluency),
    )
    return {
        "score": c.score,
        "components": {
            "phoneme_accuracy": c.phoneme_accuracy,
            "word_accuracy": c.word_accuracy,
            "fluency": c.fluency,
        },
        "sounds": c.sounds,
        "weakest_sounds": c.weakest_sounds,
        "transcript": transcript.text,
        "model_versions": engines.versions,
    }

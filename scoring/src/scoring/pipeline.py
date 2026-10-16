"""One recording → score (research R4–R7). Audio lives only in local variables here."""

from dataclasses import dataclass
from typing import Literal

from .align import ctc_forced_align, gop_scores
from .audio import AudioTooLargeError, DecodeFailedError, decode_audio
from .combine import WRONG_CONTENT_THRESHOLD, combine, fluency, word_accuracy
from .engines import Engines
from .hint_map import load_hint_map
from .settings import Settings

MIN_SPEECH_SECONDS = 0.3
UnusableReason = Literal["no_speech", "too_short", "too_noisy", "wrong_content", "decode_failed"]


@dataclass(frozen=True)
class Unusable:
    reason: UnusableReason


class TooLargeError(Exception):
    pass


def score_recording(
    data: bytes, *, expected_text: str, level: str, engines: Engines, settings: Settings
) -> dict[str, object] | Unusable:
    try:
        samples = decode_audio(
            data, max_seconds=settings.max_audio_seconds, max_bytes=settings.max_audio_bytes
        )
    except AudioTooLargeError:
        raise TooLargeError from None
    except DecodeFailedError:
        return Unusable("decode_failed")

    speech, speech_seconds = engines.vad.trim(samples)
    del samples
    if speech_seconds == 0:
        return Unusable("no_speech")
    if speech_seconds < MIN_SPEECH_SECONDS:
        return Unusable("too_short")

    transcript = engines.asr.transcribe(speech)
    w_acc = word_accuracy(expected_text, transcript.text)
    if w_acc < WRONG_CONTENT_THRESHOLD:
        return Unusable("wrong_content")

    expected = engines.phonemes.expected(expected_text)
    log_probs = engines.phonemes.log_probs(speech)
    del speech
    try:
        aligned = ctc_forced_align(log_probs, [t for t, _ in expected], engines.phonemes.blank)
    except ValueError:
        return Unusable("too_short")
    per_phone = gop_scores(log_probs, aligned, engines.phonemes.blank)
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

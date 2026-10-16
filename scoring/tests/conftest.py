import hmac
import io
import math
import struct
import time
import wave
from collections.abc import Iterator
from hashlib import sha256

import numpy as np
import pytest
from fastapi.testclient import TestClient

from scoring.app import app, get_engines
from scoring.engines import Engines, Transcript
from scoring.settings import Settings, get_settings

SECRET = "s" * 32
SR = 16_000


def wav_bytes(seconds: float = 1.5, freq: float = 220.0) -> bytes:
    """In-memory synthetic WAV (no files)."""
    n = int(SR * seconds)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(
            b"".join(
                struct.pack("<h", int(8000 * math.sin(2 * math.pi * freq * i / SR)))
                for i in range(n)
            )
        )
    return buf.getvalue()


class FakeVad:
    def __init__(self) -> None:
        self.speech_seconds: float | None = None

    def trim(self, samples: np.ndarray) -> tuple[np.ndarray, float]:
        return samples, samples.size / SR if self.speech_seconds is None else self.speech_seconds


class FakeAsr:
    def __init__(self) -> None:
        self.text: str | None = None
        self.last_expected = ""

    def transcribe(self, samples: np.ndarray) -> Transcript:
        text = self.text if self.text is not None else "that makes sense"
        n = len(text.split())
        return Transcript(
            text=text,
            word_starts=[i * 0.4 for i in range(n)],
            word_ends=[i * 0.4 + 0.35 for i in range(n)],
        )


class FakePhonemes:
    """Vocab: 0 = blank, others = symbols; produces confident frames for the expected tokens."""

    blank = 0
    vocab = {"<pad>": 0, "ð": 1, "æ": 2, "t": 3, "m": 4, "eɪ": 5, "k": 6, "s": 7, "ɛ": 8, "n": 9}

    def __init__(self) -> None:
        self.wrong: set[str] = set()

    def expected(self, text: str) -> list[tuple[int, str]]:
        seq = ["ð", "æ", "t", "m", "eɪ", "k", "s", "s", "ɛ", "n", "s"]
        return [(self.vocab[s], s) for s in seq]

    def log_probs(self, samples: np.ndarray) -> np.ndarray:
        exp = self.expected("")
        frames = []
        for tok, sym in exp:
            target = 1 if (sym in self.wrong and tok != 1) else (2 if sym in self.wrong else tok)
            for _ in range(3):
                row = np.full(len(self.vocab), -8.0, dtype=np.float32)
                row[target] = 0.0
                frames.append(row)
            blank = np.full(len(self.vocab), -8.0, dtype=np.float32)
            blank[0] = 0.0
            frames.append(blank)
        return np.array(frames)

    def phonemize(self, texts: list[str]) -> list[str]:
        return ["ðæt mˈeɪks sˈɛns" for _ in texts]


@pytest.fixture
def fakes() -> Iterator[tuple[FakeVad, FakeAsr, FakePhonemes]]:
    vad, asr, ph = FakeVad(), FakeAsr(), FakePhonemes()
    engines = Engines(
        vad=vad, asr=asr, phonemes=ph, versions={"vad": "fake", "asr": "fake", "phonemes": "fake"}
    )
    app.dependency_overrides[get_engines] = lambda: engines
    app.dependency_overrides[get_settings] = lambda: Settings(scoring_shared_secret=SECRET)
    yield vad, asr, ph
    app.dependency_overrides.clear()


@pytest.fixture
def client(fakes: object) -> TestClient:
    return TestClient(app)


def signed_headers(
    request_id: str = "req-1", ts: int | None = None, secret: str = SECRET
) -> dict[str, str]:
    t = ts if ts is not None else int(time.time())
    sig = hmac.new(secret.encode(), f"{t}.{request_id}".encode(), sha256).hexdigest()
    return {"X-Timestamp": str(t), "X-Request-Id": request_id, "X-Signature": f"sha256={sig}"}


def score_form(audio: bytes | None = None, text: str = "That makes sense.", level: str = "B1"):  # type: ignore[no-untyped-def]
    return {
        "files": {"audio": ("recording", audio if audio is not None else wav_bytes(), "audio/wav")},
        "data": {"expected_text": text, "level": level, "mime_type": "audio/wav"},
    }

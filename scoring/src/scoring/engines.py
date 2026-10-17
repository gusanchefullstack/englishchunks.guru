"""Model engines behind small protocols so the pipeline can be tested with fakes.

Real implementations load int8 ONNX models from MODELS_DIR (research R3–R6). Paths:
  silero_vad.onnx
  parakeet/{encoder,decoder,joiner}.int8.onnx + tokens.txt
  wav2vec2/model.int8.onnx + vocab.json
"""

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Protocol

import numpy as np
from numpy.typing import NDArray

from .audio import SAMPLE_RATE

Samples = NDArray[np.float32]


@dataclass(frozen=True)
class Transcript:
    text: str
    word_starts: list[float]
    word_ends: list[float]


class Vad(Protocol):
    def trim(self, samples: Samples) -> tuple[Samples, float]:
        """Returns (trimmed samples, seconds of detected speech)."""
        ...


class Asr(Protocol):
    def transcribe(self, samples: Samples) -> Transcript: ...


class PhonemeModel(Protocol):
    blank: int

    def expected(self, text: str) -> list[tuple[int, str]]:
        """Expected (token id, espeak symbol) sequence for American-English text."""
        ...

    def log_probs(self, samples: Samples) -> NDArray[np.float32]:
        """Frame-level log posteriors (T × V)."""
        ...

    def phonemize(self, texts: list[str]) -> list[str]:
        """Display IPA (with stress marks) for each text."""
        ...


@dataclass(frozen=True)
class Engines:
    vad: Vad
    asr: Asr
    phonemes: PhonemeModel
    versions: dict[str, str]


# ---------- Silero VAD ----------


class SileroVad:
    WINDOW = 512  # samples at 16 kHz
    THRESHOLD = 0.5
    PAD = int(0.15 * SAMPLE_RATE)

    def __init__(self, path: Path) -> None:
        import onnxruntime as ort

        opts = ort.SessionOptions()
        opts.intra_op_num_threads = 1
        self.session = ort.InferenceSession(str(path), opts, providers=["CPUExecutionProvider"])

    def trim(self, samples: Samples) -> tuple[Samples, float]:
        state = np.zeros((2, 1, 128), dtype=np.float32)
        sr = np.array(SAMPLE_RATE, dtype=np.int64)
        speech: list[int] = []
        context = np.zeros(64, dtype=np.float32)
        for i in range(0, samples.size - self.WINDOW + 1, self.WINDOW):
            chunk = samples[i : i + self.WINDOW]
            x = np.concatenate([context, chunk])[None, :].astype(np.float32)
            prob, state = self.session.run(None, {"input": x, "state": state, "sr": sr})
            context = chunk[-64:]
            if float(prob[0][0]) > self.THRESHOLD:
                speech.append(i)
        if not speech:
            return samples[:0], 0.0
        start = max(0, speech[0] - self.PAD)
        end = min(samples.size, speech[-1] + self.WINDOW + self.PAD)
        return samples[start:end], len(speech) * self.WINDOW / SAMPLE_RATE


# ---------- Parakeet TDT via sherpa-onnx ----------


class ParakeetAsr:
    def __init__(self, folder: Path, threads: int = 2) -> None:
        import sherpa_onnx

        self.recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=str(folder / "encoder.int8.onnx"),
            decoder=str(folder / "decoder.int8.onnx"),
            joiner=str(folder / "joiner.int8.onnx"),
            tokens=str(folder / "tokens.txt"),
            model_type="nemo_transducer",
            num_threads=threads,
        )

    def transcribe(self, samples: Samples) -> Transcript:
        stream = self.recognizer.create_stream()
        stream.accept_waveform(SAMPLE_RATE, samples)
        self.recognizer.decode_stream(stream)
        r = stream.result
        durations = list(getattr(r, "durations", []) or [])
        starts: list[float] = []
        ends: list[float] = []
        for i, (tok, ts) in enumerate(zip(r.tokens, r.timestamps, strict=False)):
            if not any(ch.isalnum() for ch in tok):
                continue  # punctuation tokens carry no speech
            end = float(ts) + (float(durations[i]) if i < len(durations) else 0.08)
            # A leading space (or SentencePiece "▁") marks the start of a new word.
            if tok[:1] in {" ", "▁"} or not starts:
                starts.append(float(ts))
                ends.append(end)
            else:
                ends[-1] = end
        return Transcript(text=r.text.strip(), word_starts=starts, word_ends=ends)


# ---------- wav2vec2 espeak phonemes ----------


class Wav2Vec2Phonemes:
    def __init__(self, folder: Path, threads: int = 2) -> None:
        import onnxruntime as ort
        from phonemizer.backend import EspeakBackend
        from phonemizer.separator import Separator

        opts = ort.SessionOptions()
        opts.intra_op_num_threads = threads
        self.session = ort.InferenceSession(
            str(folder / "model.int8.onnx"), opts, providers=["CPUExecutionProvider"]
        )
        vocab: dict[str, int] = json.loads((folder / "vocab.json").read_text(encoding="utf-8"))
        self.vocab = vocab
        self.blank = vocab.get("<pad>", 0)
        self._sep = Separator(phone=" ", word=" | ", syllable="")
        self._display_sep = Separator(phone="", word=" ", syllable="")
        self._backend = EspeakBackend("en-us", with_stress=False, preserve_punctuation=False)
        self._display = EspeakBackend("en-us", with_stress=True, preserve_punctuation=False)

    def _token(self, sym: str) -> int | None:
        if sym in self.vocab:
            return self.vocab[sym]
        if sym.endswith("ː") and sym[:-1] in self.vocab:
            return self.vocab[sym[:-1]]
        return None

    def expected(self, text: str) -> list[tuple[int, str]]:
        raw = self._backend.phonemize([text], separator=self._sep, strip=True)[0]
        phones = [p for p in raw.split() if p != "|"]
        out: list[tuple[int, str]] = []
        for p in phones:
            tok = self._token(p)
            if tok is not None:
                out.append((tok, p))
            else:  # split unknown multi-char symbols into known parts
                out.extend((t, ch) for ch in p if (t := self._token(ch)) is not None)
        return out

    def log_probs(self, samples: Samples) -> NDArray[np.float32]:
        from .align import log_softmax

        x = samples.astype(np.float32)
        x = (x - x.mean()) / (x.std() + 1e-7)
        (logits,) = self.session.run(None, {"input_values": x[None, :]})
        return log_softmax(logits[0])

    def phonemize(self, texts: list[str]) -> list[str]:
        out = self._display.phonemize(texts, separator=self._display_sep, strip=True)
        return [s.strip() for s in out]


@lru_cache
def load_engines(models_dir: str, *, asr_threads: int = 2, phoneme_threads: int = 2) -> Engines:
    root = Path(models_dir)
    return Engines(
        vad=SileroVad(root / "silero_vad.onnx"),
        asr=ParakeetAsr(root / "parakeet", threads=asr_threads),
        phonemes=Wav2Vec2Phonemes(root / "wav2vec2", threads=phoneme_threads),
        versions={
            "vad": "silero-vad-v5",
            "asr": "parakeet-tdt-0.6b-v2-int8",
            "phonemes": "wav2vec2-lv-60-espeak-cv-ft-int8",
        },
    )

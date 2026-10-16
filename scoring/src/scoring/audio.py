"""In-memory audio decoding (research R8). Never writes to disk.

PyAV decodes from a seekable BytesIO, which also handles non-fragmented MP4/AAC from iOS Safari
(ffmpeg cannot read those from a pipe).
"""

import io

import av
import numpy as np
from numpy.typing import NDArray

SAMPLE_RATE = 16_000
SUPPORTED_MIME = {"audio/webm", "audio/mp4", "audio/wav", "audio/ogg"}


class AudioTooLargeError(Exception):
    pass


class DecodeFailedError(Exception):
    pass


def decode_audio(data: bytes, *, max_seconds: float, max_bytes: int) -> NDArray[np.float32]:
    """Bytes → 16 kHz mono float32 in [-1, 1]."""
    if len(data) > max_bytes:
        raise AudioTooLargeError("audio exceeds byte limit")
    buf = io.BytesIO(data)
    chunks: list[NDArray[np.float32]] = []
    try:
        with av.open(buf, mode="r") as container:
            stream = next((s for s in container.streams if s.type == "audio"), None)
            if stream is None:
                raise DecodeFailedError("no audio stream")
            resampler = av.AudioResampler(format="flt", layout="mono", rate=SAMPLE_RATE)
            total = 0
            for frame in container.decode(stream):
                if not isinstance(frame, av.AudioFrame):
                    continue
                for out in resampler.resample(frame):
                    arr = out.to_ndarray().reshape(-1).astype(np.float32, copy=False)
                    chunks.append(arr)
                    total += arr.size
                    if total > max_seconds * SAMPLE_RATE:
                        raise AudioTooLargeError("audio exceeds duration limit")
            for out in resampler.resample(None):
                chunks.append(out.to_ndarray().reshape(-1).astype(np.float32, copy=False))
    except (AudioTooLargeError, DecodeFailedError):
        raise
    except Exception as err:  # noqa: BLE001 — any container/codec error is a decode failure
        raise DecodeFailedError(type(err).__name__) from None
    finally:
        buf.close()
    if not chunks:
        raise DecodeFailedError("empty audio")
    samples = np.concatenate(chunks)
    if samples.size > max_seconds * SAMPLE_RATE:
        raise AudioTooLargeError("audio exceeds duration limit")
    return samples

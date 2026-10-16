"""FastAPI scoring service.

Contract: specs/001-chunk-learning-app/contracts/scoring-service.openapi.yaml

Privacy (constitution IV, FR-019/FR-020):
- Bodies larger than the accepted size are rejected from the Content-Length header *before*
  parsing, and Starlette's spool threshold is raised above that size, so uploads are held in
  memory and never spill to a temporary file.
- Audio bytes are released in `finally` on success and failure; request bodies are never logged.
"""

import hmac
import threading
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from hashlib import sha256
from typing import Annotated

import structlog
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.formparsers import MultiPartParser

from .engines import Engines, load_engines
from .pipeline import TooLargeError, Unusable, score_recording
from .settings import Settings, get_settings

FORM_OVERHEAD = 16 * 1024
# Keep every accepted upload in memory (default spool threshold is 1 MB → disk).
MultiPartParser.spool_max_size = 4 * 1024 * 1024

log = structlog.get_logger()
_ready = threading.Event()


def _preload() -> None:
    try:
        load_engines(str(get_settings().models_dir))
        _ready.set()
        log.info("models.ready")
    except Exception as err:  # noqa: BLE001 — stay up and report "loading" via /healthz
        log.error("models.failed", error=type(err).__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Load models in the background so the port opens immediately and /healthz never blocks.
    threading.Thread(target=_preload, name="model-preload", daemon=True).start()
    yield


app = FastAPI(title="EnglishChunks Scoring Service", version="1.0.0", lifespan=lifespan)


def get_engines() -> Engines:
    if not _ready.is_set():
        raise HTTPException(status_code=503, detail="models loading")
    return load_engines(str(get_settings().models_dir))


def verify_signature(request: Request, settings: Settings) -> str | None:
    """Returns the request id if the HMAC signature is valid and fresh, else None."""
    ts = request.headers.get("x-timestamp", "")
    rid = request.headers.get("x-request-id", "")
    sig = request.headers.get("x-signature", "")
    if not ts.isdigit() or not rid or not sig.startswith("sha256="):
        return None
    if abs(time.time() - int(ts)) > settings.signature_skew_seconds:
        return None
    expected = hmac.new(
        settings.scoring_shared_secret.encode(), f"{ts}.{rid}".encode(), sha256
    ).hexdigest()
    return rid if hmac.compare_digest(expected, sig.removeprefix("sha256=")) else None


def _error(status: int, message: str) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


@app.get("/healthz")
def healthz() -> dict[str, object]:
    ready = _ready.is_set()
    return {
        "status": "ok" if ready else "loading",
        "models": dict.fromkeys(("vad", "asr", "phonemes"), ready),
    }


@app.post("/v1/score", response_model=None)
async def score(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    engines: Annotated[Engines, Depends(get_engines)],
) -> JSONResponse:
    rid = verify_signature(request, settings)
    if rid is None:
        return _error(401, "invalid signature")
    length = request.headers.get("content-length")
    if length is None or not length.isdigit():
        return _error(411, "content-length required")
    if int(length) > settings.max_audio_bytes + FORM_OVERHEAD:
        return _error(413, "audio too large")

    data: bytes | None = None
    started = time.perf_counter()
    try:
        form = await request.form(max_files=1, max_fields=8, max_part_size=settings.max_audio_bytes)
        upload = form.get("audio")
        expected_text = str(form.get("expected_text") or "").strip()
        level = str(form.get("level") or "")
        if (
            upload is None
            or isinstance(upload, str)
            or not expected_text
            or len(expected_text) > 300
        ):
            return _error(422, "invalid form")
        if level not in {"A1", "A2", "B1", "B2", "C1", "C2"}:
            return _error(422, "invalid level")
        data = await upload.read()
        await upload.close()
        await form.close()
        result = score_recording(
            data, expected_text=expected_text, level=level, engines=engines, settings=settings
        )
        if isinstance(result, Unusable):
            log.info("score.unusable", request_id=rid, reason=result.reason)
            return JSONResponse({"reason": result.reason}, status_code=422)
        log.info("score.ok", request_id=rid, ms=round((time.perf_counter() - started) * 1000))
        return JSONResponse(result)
    except TooLargeError:
        return _error(413, "audio too long")
    finally:
        data = None  # release audio bytes (FR-019)


class PhonemizeRequest(BaseModel):
    texts: list[Annotated[str, Field(min_length=1, max_length=300)]] = Field(max_length=100)


@app.post("/v1/phonemize", response_model=None)
def phonemize(
    request: Request,
    body: PhonemizeRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    engines: Annotated[Engines, Depends(get_engines)],
) -> JSONResponse | dict[str, list[str]]:
    if verify_signature(request, settings) is None:
        return _error(401, "invalid signature")
    return {"ipa": engines.phonemes.phonemize(body.texts)}

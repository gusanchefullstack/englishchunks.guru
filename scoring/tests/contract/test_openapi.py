"""Responses must match specs/001-chunk-learning-app/contracts/scoring-service.openapi.yaml."""

import threading
from pathlib import Path
from typing import Any

import jsonschema
import pytest
import structlog.testing
import yaml
from fastapi.testclient import TestClient

import scoring.app as app_module
from tests.conftest import FakeAsr, FakeVad, score_form, signed_headers

SPEC_PATH = (
    Path(__file__).resolve().parents[3]
    / "specs/001-chunk-learning-app/contracts/scoring-service.openapi.yaml"
)
SPEC: dict[str, Any] = yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))


def validate(instance: object, ref: str) -> None:
    schema = {"$ref": ref, "components": SPEC["components"]}
    jsonschema.validate(instance, schema)


def response_schema(path: str, method: str, status: str) -> dict[str, Any]:
    return SPEC["paths"][path][method]["responses"][status]["content"]["application/json"]["schema"]  # type: ignore[no-any-return]


def test_healthz_loading_is_503(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    # Startup probes must not route traffic until the models are in memory.
    monkeypatch.setattr(app_module, "_ready", threading.Event())
    res = client.get("/healthz")
    assert res.status_code == 503
    assert res.json()["status"] == "loading"
    validate(res.json(), "#/components/schemas/Health")
    assert "503" in SPEC["paths"]["/healthz"]["get"]["responses"]


def test_healthz_ready_is_200(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    ready = threading.Event()
    ready.set()
    monkeypatch.setattr(app_module, "_ready", ready)
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "models": {"vad": True, "asr": True, "phonemes": True}}
    validate(res.json(), "#/components/schemas/Health")


def test_warm_requires_signature(client: TestClient) -> None:
    # Unsigned callers can't wake (and bill) a scaled-to-zero instance.
    assert client.get("/v1/warm").status_code == 401


def test_warm_signed_ready_is_200(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    ready = threading.Event()
    ready.set()
    monkeypatch.setattr(app_module, "_ready", ready)
    res = client.get("/v1/warm", headers=signed_headers())
    assert res.status_code == 200
    validate(res.json(), "#/components/schemas/Health")


def test_warm_signed_loading_is_503(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(app_module, "_ready", threading.Event())
    res = client.get("/v1/warm", headers=signed_headers())
    assert res.status_code == 503
    assert res.json()["status"] == "loading"
    assert {"200", "401", "503"} <= set(SPEC["paths"]["/v1/warm"]["get"]["responses"])


def test_score_200_matches_score_result(client: TestClient) -> None:
    res = client.post("/v1/score", headers=signed_headers(), **score_form())
    assert res.status_code == 200, res.text
    validate(res.json(), "#/components/schemas/ScoreResult")
    body = res.json()
    assert 0 <= body["score"] <= 100
    assert 0 <= len(body["weakest_sounds"]) <= 3


def test_score_logs_stage_timings_without_content(client: TestClient) -> None:
    with structlog.testing.capture_logs() as logs:
        res = client.post("/v1/score", headers=signed_headers(), **score_form())
    assert res.status_code == 200, res.text
    ok = next(e for e in logs if e["event"] == "score.ok")
    stages = {"decode_ms", "vad_ms", "asr_ms", "phonemes_ms", "align_ms", "audio_s", "speech_s"}
    assert stages <= ok.keys()
    # durations and lengths only: never the transcript or the expected text
    assert "That makes sense" not in repr(ok)


def test_score_422_matches_unusable(
    client: TestClient, fakes: tuple[FakeVad, FakeAsr, object]
) -> None:
    vad, _, _ = fakes
    vad.speech_seconds = 0.0
    res = client.post("/v1/score", headers=signed_headers(), **score_form())
    assert res.status_code == 422
    validate(res.json(), "#/components/schemas/Unusable")
    assert res.json()["reason"] == "no_speech"


def test_wrong_content_is_unusable(
    client: TestClient, fakes: tuple[FakeVad, FakeAsr, object]
) -> None:
    _, asr, _ = fakes
    asr.text = "completely different words here"
    res = client.post("/v1/score", headers=signed_headers(), **score_form())
    assert res.status_code == 422 and res.json()["reason"] == "wrong_content"


def test_decode_failure_is_unusable(client: TestClient) -> None:
    res = client.post(
        "/v1/score", headers=signed_headers(), **score_form(audio=b"not audio at all")
    )
    assert res.status_code == 422 and res.json()["reason"] == "decode_failed"


def test_rejects_bad_or_stale_signatures(client: TestClient) -> None:
    assert (
        client.post(
            "/v1/score", headers=signed_headers(secret="w" * 32), **score_form()
        ).status_code
        == 401
    )
    assert client.post("/v1/score", headers=signed_headers(ts=1), **score_form()).status_code == 401
    assert client.post("/v1/score", **score_form()).status_code == 401


def test_rejects_oversized_audio_before_parsing(client: TestClient) -> None:
    big = b"\0" * (1_048_576 + 50_000)
    res = client.post("/v1/score", headers=signed_headers(), **score_form(audio=big))
    assert res.status_code == 413


def test_rejects_too_long_audio(client: TestClient) -> None:
    from tests.conftest import wav_bytes

    res = client.post(
        "/v1/score", headers=signed_headers(), **score_form(audio=wav_bytes(seconds=16, freq=100))
    )
    assert res.status_code == 413


def test_phonemize_matches_contract(client: TestClient) -> None:
    res = client.post(
        "/v1/phonemize", headers=signed_headers(), json={"texts": ["That makes sense."]}
    )
    assert res.status_code == 200
    jsonschema.validate(res.json(), response_schema("/v1/phonemize", "post", "200"))
    assert client.post("/v1/phonemize", json={"texts": ["x"]}).status_code == 401

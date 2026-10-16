"""Responses must match specs/001-chunk-learning-app/contracts/scoring-service.openapi.yaml."""

from pathlib import Path
from typing import Any

import jsonschema
import yaml
from fastapi.testclient import TestClient

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


def test_healthz_matches_contract(client: TestClient) -> None:
    res = client.get("/healthz")
    assert res.status_code == 200
    jsonschema.validate(res.json(), response_schema("/healthz", "get", "200"))


def test_score_200_matches_score_result(client: TestClient) -> None:
    res = client.post("/v1/score", headers=signed_headers(), **score_form())
    assert res.status_code == 200, res.text
    validate(res.json(), "#/components/schemas/ScoreResult")
    body = res.json()
    assert 0 <= body["score"] <= 100
    assert 0 <= len(body["weakest_sounds"]) <= 3


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

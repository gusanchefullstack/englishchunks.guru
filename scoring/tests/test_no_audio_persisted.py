"""FR-019 / SC-008: no learner audio may be written anywhere, on success or on failure."""

import logging
import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from tests.conftest import FakeAsr, FakeVad, score_form, signed_headers, wav_bytes


def snapshot(dirs: list[Path]) -> set[str]:
    out: set[str] = set()
    for d in dirs:
        for root, _, files in os.walk(d):
            out.update(os.path.join(root, f) for f in files)
    return out


WATCHED = [Path(tempfile.gettempdir()), Path.cwd()]


@pytest.mark.parametrize("scenario", ["success", "unusable", "decode_failure", "engine_crash"])
def test_no_files_and_no_audio_in_logs(
    client: TestClient,
    fakes: tuple[FakeVad, FakeAsr, object],
    caplog: pytest.LogCaptureFixture,
    capfd: pytest.CaptureFixture[str],
    scenario: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    vad, asr, _ = fakes
    audio = wav_bytes(seconds=2.0, freq=330)
    if scenario == "unusable":
        vad.speech_seconds = 0.0
    if scenario == "decode_failure":
        audio = b"RIFF" + os.urandom(4000)
    if scenario == "engine_crash":
        monkeypatch.setattr(
            asr, "transcribe", lambda _s: (_ for _ in ()).throw(RuntimeError("boom"))
        )

    before = snapshot(WATCHED)
    caplog.set_level(logging.DEBUG)
    client_no_raise = TestClient(client.app, raise_server_exceptions=False)
    res = client_no_raise.post("/v1/score", headers=signed_headers(), **score_form(audio=audio))
    after = snapshot(WATCHED)

    assert res.status_code in {200, 422, 500}
    assert after - before == set(), f"new files written: {after - before}"

    out, err = capfd.readouterr()
    logs = caplog.text + out + err
    sample = audio[200:232]
    assert sample.hex() not in logs
    assert repr(sample) not in logs
    assert "That makes sense" not in logs  # request bodies are never logged

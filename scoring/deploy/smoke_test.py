"""Signed end-to-end smoke test. Run it INSIDE the container so the secret never leaves the host:

    docker exec -i ec-scoring /app/.venv/bin/python - < scoring/deploy/smoke_test.py

Synthesizes clips with espeak-ng, signs each request like the web app does, POSTs them to
/v1/score and prints latency (SC-003: p95 <= 5 s). Synthetic voices score lower than people.
"""

import hashlib
import hmac
import json
import os
import statistics
import time
import urllib.error
import urllib.request
import uuid

from scoring.bench import SENTENCES, synth

URL = "http://127.0.0.1:8001/v1/score"
SECRET = os.environ["SCORING_SHARED_SECRET"].encode()


def post(audio: bytes, text: str) -> tuple[int, object, float]:
    ts, rid = str(int(time.time())), str(uuid.uuid4())
    sig = "sha256=" + hmac.new(SECRET, f"{ts}.{rid}".encode(), hashlib.sha256).hexdigest()
    boundary = "----ec" + uuid.uuid4().hex
    fields = (("mime_type", "audio/wav"), ("expected_text", text), ("level", "B1"))
    parts = [
        f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
        for k, v in fields
    ]
    parts.append(
        f'--{boundary}\r\nContent-Disposition: form-data; name="audio"; filename="a.wav"\r\n'
        "Content-Type: audio/wav\r\n\r\n".encode()
        + audio
        + b"\r\n"
    )
    body = b"".join(parts) + f"--{boundary}--\r\n".encode()
    req = urllib.request.Request(
        URL,
        data=body,
        method="POST",
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "X-Timestamp": ts,
            "X-Request-Id": rid,
            "X-Signature": sig,
        },
    )
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=30) as r:  # noqa: S310 — fixed http://127.0.0.1 URL
            return r.status, json.loads(r.read()), time.perf_counter() - t0
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:200], time.perf_counter() - t0


def main(n: int = 20) -> None:
    times: list[float] = []
    failures = 0
    for i in range(n):
        text = SENTENCES[i % len(SENTENCES)]
        status, out, dt = post(synth(text, 130 + (i % 5) * 15), text)
        times.append(dt)
        if status != 200:
            failures += 1
            print(i, status, out)
        elif i < 3 and isinstance(out, dict):
            print(i, out["score"], out["weakest_sounds"], repr(out["transcript"]), f"{dt:.2f}s")
    times.sort()
    p95 = times[max(0, int(0.95 * len(times)) - 1)]
    print(f"n={n} failures={failures} p50={statistics.median(times):.2f}s p95={p95:.2f}s")
    print("SC-003 PASS" if p95 <= 5.0 and failures == 0 else "SC-003 FAIL")


if __name__ == "__main__":
    main()

"""Latency benchmark for SC-003 (p95 ≤ 5 s per recording).

  uv run python -m scoring.bench                 # 50 synthetic espeak-ng clips
  uv run python -m scoring.bench --clips DIR     # real clips (webm/mp4/wav) + .txt transcripts

Clips in DIR are read from disk by the benchmark only; the service itself never writes audio.
"""

import argparse
import statistics
import subprocess
import time
from pathlib import Path

from .engines import load_engines
from .pipeline import Unusable, score_recording
from .settings import get_settings

SENTENCES = [
    "That makes sense.",
    "By the way, I loved your photos.",
    "We need to make a decision before Monday.",
    "I'm looking forward to it.",
    "At the end of the day, the client decides.",
    "Let's take a break and get some water.",
    "Please bear in mind that prices may change.",
    "I tend to reply to emails in the morning.",
    "You'll get used to the new system quickly.",
    "Thank you so much for your quick reply.",
]


def synth(text: str, speed: int) -> bytes:
    return subprocess.run(  # noqa: S603 — fixed binary, text from constant list
        ["espeak-ng", "-v", "en-us", "-s", str(speed), "--stdout", text],  # noqa: S607
        check=True,
        capture_output=True,
    ).stdout


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--clips", type=Path, default=None)
    parser.add_argument("--n", type=int, default=50)
    args = parser.parse_args()
    settings = get_settings()
    engines = load_engines(str(settings.models_dir))

    jobs: list[tuple[str, bytes, str]] = []
    if args.clips:
        for f in sorted(args.clips.iterdir()):
            text_file = f.with_suffix(".txt")
            if f.suffix in {".webm", ".mp4", ".m4a", ".wav", ".ogg"} and text_file.exists():
                jobs.append((f.name, f.read_bytes(), text_file.read_text().strip()))
    else:
        for i in range(args.n):
            text = SENTENCES[i % len(SENTENCES)]
            jobs.append((f"synthetic-{i}", synth(text, 130 + (i % 5) * 15), text))

    score_recording(
        jobs[0][1], expected_text=jobs[0][2], level="B1", engines=engines, settings=settings
    )  # warm-up
    times: list[float] = []
    unusable = 0
    for name, data, text in jobs:
        t0 = time.perf_counter()
        out = score_recording(
            data, expected_text=text, level="B1", engines=engines, settings=settings
        )
        times.append(time.perf_counter() - t0)
        if isinstance(out, Unusable):
            unusable += 1
            print(f"{name}: unusable ({out.reason})")
        else:
            print(f"{name}: {out['score']}  ({times[-1]:.2f}s)")
    times.sort()
    p95 = times[min(len(times) - 1, int(0.95 * len(times)))]
    p50 = statistics.median(times)
    print(f"\nclips={len(times)} unusable={unusable} p50={p50:.2f}s p95={p95:.2f}s")
    print("SC-003 PASS" if p95 <= 5.0 else "SC-003 FAIL (p95 > 5 s)")


if __name__ == "__main__":
    main()

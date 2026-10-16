"""SC-005: on paired good vs. poor recordings, our score ranks the better one higher ≥ 85%.

Pairs = two utterances whose human `total` scores (0–10) differ by ≥ 3. speechocean762's test
split rarely repeats a sentence, so pairs span different sentences (stricter: sentence difficulty
adds noise). The sample is stratified so poor pronunciations are well represented.
Sources: speechocean762 (public) and, before each scoring release, the consented volunteer set
(tests/calibration/data/volunteers/, gitignored). Never in-app learner recordings.
Run: uv run pytest -m calibration
"""

import itertools
import json
import random
from pathlib import Path

import pytest

from scoring.engines import load_engines
from scoring.pipeline import Unusable, score_recording
from scoring.settings import get_settings

DATA = Path(__file__).parent / "data"
MIN_GAP = 3
SAMPLE_PER_SIDE = 300
TARGET = 0.85

pytestmark = pytest.mark.calibration


def load_index() -> list[dict[str, object]]:
    path = DATA / "index.json"
    if not path.exists():
        pytest.skip("calibration data missing — run tests/calibration/fetch_speechocean.py")
    return json.loads(path.read_text())  # type: ignore[no-any-return]


def test_pair_ranking_accuracy() -> None:
    settings = get_settings()
    if not (settings.models_dir / "wav2vec2" / "model.int8.onnx").exists():
        pytest.skip("models missing — run scoring.models.download --wav2vec2")
    engines = load_engines(str(settings.models_dir))
    full = load_index()
    rng = random.Random(762)  # noqa: S311 — reproducible sampling, not crypto
    low = [x for x in full if float(x["total"]) <= 6]  # type: ignore[arg-type]
    high = [x for x in full if float(x["total"]) >= 8]  # type: ignore[arg-type]
    index = low[:SAMPLE_PER_SIDE] + rng.sample(high, min(SAMPLE_PER_SIDE, len(high)))

    ours: dict[str, float] = {}
    for item in index:
        data = (DATA / str(item["file"])).read_bytes()
        out = score_recording(
            data, expected_text=str(item["text"]), level="B1", engines=engines, settings=settings
        )
        ours[str(item["file"])] = 0.0 if isinstance(out, Unusable) else float(out["score"])  # type: ignore[arg-type]

    correct = total = 0
    for a, b in itertools.combinations(index, 2):
        gap = float(a["total"]) - float(b["total"])  # type: ignore[arg-type]
        if abs(gap) < MIN_GAP:
            continue
        total += 1
        better, worse = (a, b) if gap > 0 else (b, a)
        correct += ours[str(better["file"])] > ours[str(worse["file"])]
    if total < 20:
        pytest.skip(f"only {total} pairs; fetch more data (--n)")
    accuracy = correct / total
    print(f"pair accuracy: {accuracy:.3f} over {total} pairs")
    assert accuracy >= TARGET

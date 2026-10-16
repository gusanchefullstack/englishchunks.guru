"""Download a subset of speechocean762 (CC-BY-4.0, L2 English with human pronunciation scores).

  uv run python -m tests.calibration.fetch_speechocean --n 400

Stores audio + human scores under tests/calibration/data/ (gitignored). This is public research
data used only for calibration — never in-app learner recordings (constitution IV).
"""

import argparse
import io
import json
import urllib.request
from pathlib import Path

DATA = Path(__file__).parent / "data"
PARQUET = "https://huggingface.co/datasets/mispeech/speechocean762/resolve/main/data/test-00000-of-00001.parquet"


def main() -> None:
    import pyarrow.parquet as pq

    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=400)
    args = parser.parse_args()
    DATA.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(PARQUET) as r:  # noqa: S310 — fixed https URL
        table = pq.read_table(io.BytesIO(r.read()))
    rows = table.slice(0, args.n).to_pylist()
    index = []
    for i, row in enumerate(rows):
        audio = row["audio"]["bytes"]
        name = f"so762-{i:04d}.wav"
        (DATA / name).write_bytes(audio)
        index.append(
            {"file": name, "text": row["text"], "total": row["total"], "accuracy": row["accuracy"]}
        )
    (DATA / "index.json").write_text(json.dumps(index, indent=1))
    print(f"saved {len(index)} utterances to {DATA}")


if __name__ == "__main__":
    main()

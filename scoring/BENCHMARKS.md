# Scoring benchmarks

## 2026-10-16 — first spike (developer laptop)

Models: Silero VAD v5 · Parakeet TDT 0.6B v2 (sherpa-onnx int8, 633 MB) ·
wav2vec2-lv-60-espeak-cv-ft (ONNX dynamic int8, 318 MB). Weights 0.5 phoneme / 0.3 word / 0.2 fluency.

| Check | Setup | Result | Target |
|-------|-------|--------|--------|
| Latency (SC-003) | 50 synthetic espeak-ng clips, Apple Silicon laptop, 1 process | p50 0.41 s · p95 0.51 s · 0 unusable | p95 ≤ 5 s ✅ |
| Calibration (SC-005) | speechocean762 test split, 600 utterances (300 with human total ≤ 6, 300 with ≥ 8), all cross-sentence pairs with a human gap ≥ 3 | **88.5 %** correct over 66,189 pairs | ≥ 85 % ✅ |

### Still to run before learners use scoring

1. **Latency on the 4 GB / 2 vCPU Droplet** (`uv run python -m scoring.bench`). Expect roughly
   3–6× the laptop time; if p95 > 5 s, resize to 8 GB / 4 vCPU (plan checkpoint).
2. **Real-device clips**: record ~10 clips each on iOS Safari (MP4/AAC) and Android Chrome
   (WebM/Opus) with a `.txt` transcript beside each file, then
   `uv run python -m scoring.bench --clips <dir>` to confirm decoding and latency.
3. **Consented volunteer set** (`tests/calibration/data/volunteers/`) before each scoring
   release — never in-app learner recordings.

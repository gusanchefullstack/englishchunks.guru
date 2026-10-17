# Scoring benchmarks

## 2026-10-16 — first spike (developer laptop)

Models: Silero VAD v5 · Parakeet TDT 0.6B v2 (sherpa-onnx int8, 633 MB) ·
wav2vec2-lv-60-espeak-cv-ft (ONNX dynamic int8, 318 MB). Weights 0.5 phoneme / 0.3 word / 0.2 fluency.

| Check | Setup | Result | Target |
|-------|-------|--------|--------|
| Latency (SC-003) | 50 synthetic espeak-ng clips, Apple Silicon laptop, 1 process | p50 0.41 s · p95 0.51 s · 0 unusable | p95 ≤ 5 s ✅ |
| Calibration (SC-005) | speechocean762 test split, 600 utterances (300 with human total ≤ 6, 300 with ≥ 8), all cross-sentence pairs with a human gap ≥ 3 | **89.1 %** correct over 66,189 pairs (after LCS-recall word accuracy; 88.5 % before) | ≥ 85 % ✅ |
| Real browser format | Chromium MediaRecorder Opus/WebM (2.4 s) → web `scoringClient` → HMAC HTTP → service | decoded and scored in 0.57 s (local), ~1 s in the read-only Docker container | ✅ |

### Fixes found by the real-format smoke test

- Word accuracy now uses in-order recall (LCS) with light stemming, so restarts/repeats
  ("that makes… that makes sense") aren't treated as wrong content — they lower fluency instead.
- Weakest sounds only include sounds scoring < 85; a well-pronounced repeated sound was being
  flagged first.
- Container: Docker `--tmpfs` defaults to `noexec`, which blocks phonemizer's espeak-ng copy;
  the unit now mounts `/tmp` with `exec` (still read-only root, size-limited, no audio written).
- Models preload in a background thread at startup; `/healthz` reports `loading` → `ok`.

### Still to run before learners use scoring

1. ~~**Latency on the 4 GB / 2 vCPU Droplet**~~ — done, see 2026-10-17 below (no resize needed).
2. **Real-device clips**: record ~10 clips each on iOS Safari (MP4/AAC) and Android Chrome
   (WebM/Opus) with a `.txt` transcript beside each file, then
   `uv run python -m scoring.bench --clips <dir>` to confirm decoding and latency.
3. **Consented volunteer set** (`tests/calibration/data/volunteers/`) before each scoring
   release — never in-app learner recordings.

## 2026-10-17 — production Droplet (SFO3, s-2vcpu-4gb-amd, $28/mo)

`scoring/deploy/smoke_test.py` runs inside the container: espeak-ng clips (~2.3 s of speech each),
signed like the web app, through the live HTTP service. Server times come from the per-stage
`score.ok` log fields (`decode_ms`, `vad_ms`, `asr_ms`, `phonemes_ms`, `models_ms`, `ms`).

| Configuration (20 clips each) | server p50 | server p95 |
|-------------------------------|-----------:|-----------:|
| ASR then phonemes, 2 + 2 threads (first deploy) | 1486 ms | 1893 ms |
| Parallel, 2 + 2 threads (oversubscribed) | 1602 ms | 1966 ms |
| Parallel, 1 + 1 threads | 1732 ms | 2272 ms |
| **Parallel, ASR 1 + phonemes 2 threads (default)** | **1333 ms** | **1680 ms** |

- The phoneme model (wav2vec2) dominates: ~0.45 s per second of speech; ASR ~0.2 s/s.
- First real laptop recordings (WebM/Opus, example sentences) took 3.5–6.6 s server-side on the
  first deploy. After the parallel change and with the tip streamed separately in the web app,
  the next 40 scored recordings showed server p50 1.1 s, max 2.5 s (audio p50 2.8 s, max 4.6 s).
- Container memory 1.4 GB of 3.8 GB; no recording is ever written (`/tmp` holds only
  phonemizer's libespeak-ng copies).
- Cost rule: latency is improved with code (parallelism, streaming), never by upsizing.

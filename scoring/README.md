# scoring

Self-hosted pronunciation scoring for EnglishChunks.guru: Silero VAD → Parakeet TDT (ASR) →
wav2vec2 espeak phonemes (CTC/GOP) → a 0–100 score with per-sound results. Contract:
`specs/001-chunk-learning-app/contracts/scoring-service.openapi.yaml`.

Audio is processed in memory only and released as soon as it is scored (constitution IV).

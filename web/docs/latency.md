# Latency checks (T149)

Run `pnpm latency:check --base <staging-url> --cookie <session-cookie>` against a deployed
environment. Each run appends a table below.

## 2026-10-17T20:31:13.192Z — https://englishchunks.guru

| Measure | Samples | p95 | Target | |
|---|---|---|---|---|
| TTS first play (SC-004) | 20 | 1022 ms | 2000 ms | ✅ |
| TTS cached replay (SC-004) | 20 | 213 ms | 500 ms | ✅ |
| Writing feedback | 10 | 146089 ms | 6000 ms | ❌ |

## 2026-10-17T20:35:02.262Z — https://englishchunks.guru

| Measure | Samples | p95 | Target | |
|---|---|---|---|---|
| TTS first play (SC-004) | 20 | 453 ms | 2000 ms | ✅ |
| TTS cached replay (SC-004) | 20 | 195 ms | 500 ms | ✅ |
| Writing feedback | 10 | 16954 ms | 6000 ms | ❌ |

## 2026-10-17T20:38:10.505Z — https://englishchunks.guru

| Measure | Samples | p95 | Target | |
|---|---|---|---|---|
| TTS first play (SC-004) | 20 | 242 ms | 2000 ms | ✅ |
| TTS cached replay (SC-004) | 20 | 221 ms | 500 ms | ✅ |
| Writing feedback | 10 | 15762 ms | 6000 ms | ❌ |

### Notes on the 2026-10-17 production runs

- **SC-004 (audio)** passes in every run: first play p95 0.24–1.0 s, cached replay ≤ 0.22 s.
- **Writing feedback** is not a spec success criterion (the 6 s line is this script's own target),
  but run 1 exposed a real problem: no timeout on LLM calls and SDK retries stacked on ours, so a
  slow Gemma provider (calls of 2–8 s, one of 37 s) gave a 146 s p95. Runs 2–3 add a per-attempt
  timeout and a retry on the other open-weight model (gpt-oss-20b): Gemma 5 s, then fallback 12 s.
  p95 fell to ~16–17 s; both runs coincided with slow gateway providers (gpt-oss took 8 s for a
  two-word reply). Learners now get a clear "try again" instead of waiting minutes.
- **SC-003 (pronunciation scores)** is measured server-side with signed requests on the Droplet
  (p95 1.68 s) and from real laptop recordings (server p50 1.1 s, max 2.5 s) — see
  `scoring/BENCHMARKS.md`. Phone recordings remain open under T048.
- Runs used a temporary verified test account (`delivered+…@resend.dev`), deleted afterwards.

# Quickstart & Validation Guide

**Plan**: [plan.md](./plan.md) | **Contracts**: [contracts/](./contracts/) | **Data model**: [data-model.md](./data-model.md)

How to run the app locally and prove each user story works. Implementation details live in
`tasks.md`; this guide only lists runnable checks and expected outcomes.

## Prerequisites

- Node.js 22 LTS, pnpm 10
- Python 3.12, `uv`, `ffmpeg`, `espeak-ng` (for the scoring service)
- Chromium for Playwright (`pnpm exec playwright install chromium`)
- No real API keys are needed for tests. For manual end-to-end runs against real services,
  copy `web/.env.example` → `web/.env.local` and `scoring/.env.example` → `scoring/.env`, then
  fill values locally. **Never commit these files** (constitution Principle IV).

## Setup

```bash
pnpm install                         # web workspace
docker run -d --name ec-pg-dev -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=englishchunks \
  -p 54329:5432 postgres:17-alpine   # local Postgres (localhost URLs use the `pg` driver)
export DATABASE_URL=postgres://postgres:dev@localhost:54329/englishchunks
pnpm --filter web db:migrate         # Drizzle migrations (Neon branch or local Postgres)
pnpm --filter web db:seed            # voices, sound hints, small dev chunk set, admin user
cd scoring && uv sync && uv run python -m scoring.models.download   # fetch ONNX int8 models
```

## Run

```bash
cd scoring && uv run uvicorn scoring.app:app --port 8001     # scoring service
pnpm --filter web dev                                          # web on http://localhost:3000
```

`GET http://localhost:8001/healthz` → `{"status":"ok", models:{vad:true, asr:true, phonemes:true}}`.

## Automated checks (must all pass before merge — constitution Principle III)

```bash
pnpm lint && pnpm typecheck
pnpm --filter web test               # Vitest unit + integration (PGlite + MSW, offline)
pnpm --filter web test:e2e           # Playwright on :3100 in E2E mode (fake mic, fake LLM/TTS/
                                     # storage/email/scoring; real app + DB) + axe scans
cd scoring && uv run pytest          # scoring unit + contract tests
pnpm secret-scan                     # gitleaks over the repo
```

## Validation scenarios

| # | Story | Steps | Expected outcome |
|---|-------|-------|------------------|
| V1 | US1 | Sign in as seeded `b1.learner`, open `/today`, complete all 6 steps (e2e `daily-session.spec.ts` uses fake mic audio) | Chunk at B1 with 3 labeled examples; play works and replays from cache; each recording returns a score + 2–3 weakest-sound hints; try 2 shows improvement; 3 sentences graded + corrected; read-aloud scored; daily score saved; streak = 1 |
| V2 | US1 / FR-019 | Run `scoring` test `test_no_audio_persisted` and web test `attempts.deletion.test.ts` | No audio bytes in tmp dirs, logs, DB, or storage after success **and** after forced scoring failure (SC-008) |
| V3 | US1 | Kill the scoring service mid-session, record | `503` → retry prompt; session state kept; practice not counted |
| V4 | US2 | Sign up with email (age box checked), open the captured verification email (MSW/Resend mock), choose level, upload a 4 MB JPEG, change voice/theme, reset password | Unverified account blocked from practice until verified; avatar becomes 512×512 WebP with no EXIF; preferences persist; reset link single-use |
| V5 | US2 / FR-007 | Submit sign-up without age confirmation | Rejected with clear message |
| V6 | US2 / FR-008 | Profile → delete account → confirm (after playing a corrected sentence) | Signed out; user rows, avatar, and `tts/u/<userId>/` audio gone; not in rankings |
| V7 | US3 | Seed 14 days with a gap; open `/progress` | Chart matches seed; current streak counts from the gap; band ranking default, toggle to overall; opted-out user hidden |
| V8 | US3 / FR-033 | Call `/api/cron/hourly` at learner's reminder hour, twice | Exactly one reminder email (none if practiced today); unsubscribe link disables reminders without sign-in |
| V9 | US4 | Search "look forward to", filter B1 + verb pattern, launch practice after daily session (Basic) | Result found; launch blocked with `limit_reached` message and reset time |
| V10 | US5 | Submit "spill the beans" (exists), then a novel chunk; approve as admin | Existing chunk suggested; novel chunk pending → accepted; learner notified in-app + email; +20 points |
| V11 | US6 | As learner, request `/admin/users`; as admin, filter by plan, suspend a user | Learner gets 403; suspended user cannot sign in; audit log entry |
| V12 | US7 / FR-055 | Set account cap to current count; visit `/sign-up` | Waitlist form shown; admin invite email lets the visitor register past the cap |
| V13 | US8 | With billing inactive, look for payment UI; call `/api/billing/checkout` | No payment UI; endpoint returns `billing_inactive`; limit = 1 |
| V14 | US8 | In Stripe **test mode**: activate billing; existing user stays free Basic (early tester); new user signs up and is `trialing` immediately with no card; advance time 7 days → practice blocked; subscribe Standard via Checkout with test card; replay the webhook | Limits: early tester 1, trial 1, expired 0, Standard 3; webhook replay is a no-op (idempotent); card data never stored |
| V15 | SC-005 | `cd scoring && uv run pytest -m calibration` against the reference feature set | ≥85% of good/poor pairs ranked correctly |
| V16 | SC-003 | `uv run python -m scoring.bench` on the Droplet with 50 sample clips | p95 scoring latency ≤ 5 s |
| V17 | SC-011 | Playwright axe suite + keyboard-only run of V1 | Zero critical WCAG 2.2 AA violations; whole session doable by keyboard |
| V18 | SC-004 | `pnpm --filter web exec tsx scripts/latency-check.ts --base <staging-url>` | p95 TTS first play ≤ 2 s, cached replay ≤ 0.5 s; writing feedback ≤ 6 s |

## Go-live checklist (before real charges)

1. V13–V14 pass in Stripe test mode with the demo account (subscribe, renew via test clock, cancel).
2. Vercel project upgraded from Hobby to Pro (Hobby is non-commercial).
3. Live Stripe keys and webhook secret set only in Vercel env settings.
4. Admin flips `billing_active` in `/admin/settings` (audit-logged).

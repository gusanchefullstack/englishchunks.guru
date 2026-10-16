# Implementation Plan: EnglishChunks.guru — Chunk Learning App (MVP)

**Branch**: `001-chunk-learning-app` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-chunk-learning-app/spec.md`

## Summary

A web app that teaches English chunks to ESOL learners (CEFR A1–C2) through a daily
learn → speak (×2) → write → read-aloud session. The core loop runs on open models: Gemma 4
26B A4B (via Vercel AI Gateway) writes warm, level-appropriate tips and grades learner
sentences, while a self-hosted Python scoring service (Silero VAD + Parakeet TDT + wav2vec2
espeak phonemes, ONNX int8, CPU) produces 0–100 pronunciation scores and per-sound results that
map to a fixed, in-app IPA hint table. A Next.js 16 app on Vercel provides the UI and
TypeScript backend (Server Actions + Route Handlers) over Neon Postgres via Drizzle. ElevenLabs
Flash generates TTS lazily and caches it in DigitalOcean Spaces. Better Auth handles
email/password (Resend verification) and Google sign-in. Stripe Billing stays fully off until an
admin activates it; until then everyone is on free Basic, capped at 200 accounts with a waitlist.
Learner recordings are processed in memory only and are gone as soon as they are scored.

## Technical Context

**Language/Version**: TypeScript 5.x (strict) on Node.js 22 LTS for the web app; Python 3.12
for the scoring service only (constitution Principle VII exception).

**Primary Dependencies**: Next.js 16 (App Router, React 19), Tailwind CSS v4 + shadcn/ui
(Radix), next-themes, Recharts, AI SDK + Vercel AI Gateway, Better Auth, Drizzle ORM +
drizzle-kit, Zod, Stripe Node SDK, Resend + React Email, ElevenLabs SDK, `@aws-sdk/client-s3`
(Spaces), sharp, date-fns-tz, pino. Scoring: FastAPI, Uvicorn, ONNX Runtime, sherpa-onnx,
Silero VAD, espeak-ng (phonemizer), NumPy, PyAV (in-memory decode), structlog.

**Storage**: Neon Postgres (free tier) with `pg_trgm`; DigitalOcean Spaces for cached TTS and
avatars. No audio recordings are stored anywhere.

**Testing**: Vitest + PGlite + MSW (web unit/integration), Playwright + fake media stream +
`@axe-core/playwright` (e2e/accessibility), pytest + schemathesis (scoring unit/contract),
opt-in calibration and latency suites; gitleaks secret scan.

**Target Platform**: Modern evergreen browsers on mobile, tablet, desktop (MediaRecorder
required for speaking steps); Vercel (Hobby during testing, Pro before billing); DigitalOcean
Droplet Ubuntu 24.04 (start 4 GB / 2 vCPU).

**Project Type**: Web application (Next.js full-stack app) + one internal Python HTTP service.

**Performance Goals**: Scoring ≤ 5 s p95 per recording (SC-003); TTS first play ≤ 2 s and
cached replay ≤ 0.5 s p95 (SC-004); writing feedback ≤ 6 s p95; pages interactive ≤ 2.5 s LCP
on mid-range mobile.

**Constraints**: Recordings in memory only, deleted on scoring success or failure (FR-019);
audio never sent to third parties (FR-020); no card data handled (FR-062); no secrets in repo;
offline test suites; WCAG 2.2 AA; free tiers while billing is inactive; English-only UI and
feedback.

**Scale/Scope**: ≤ 200 learners during free testing (account cap), designed for low thousands
later; ~1,000 chunks; ~25 screens (learner + admin); 8 user stories.

All Technical Context unknowns are resolved in [research.md](./research.md) (R1–R20).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Gate | Pre-research | Post-design |
|---|-----------|------|--------------|-------------|
| I | Open-Source AI at the Core | Feedback/grading on open-weight LLM; speech scoring on self-hosted open models; closed services only peripheral; models behind swappable interfaces | ✅ Gemma 4 (R1), gpt-oss auditor (R2), Silero/Parakeet/wav2vec2 self-hosted (R3–R6) | ✅ `LlmProvider`, `TtsProvider`, `ScoringClient` interfaces; model ids in config; TTS failure degrades to text+IPA, core loop still scores |
| II | Deterministic Pedagogy | Hints from curated table; scores from pipeline; IPA deterministic; chunks audited; dedupe + admin approval; American English | ✅ | ✅ `sound_hint` table + JSON source (data-model); IPA via `/v1/phonemize`; LLM output contracts forbid scores/IPA with post-check (llm-outputs.md) |
| III | Test-First Quality Gates | Unit/integration/e2e per change; mocks for externals; offline suite; scoring validated before exposure | ✅ R19 | ✅ quickstart V1–V17; calibration (V15) gates scoring release |
| IV | Security, Privacy & Payment Safety | No secrets in repo; email verification; hashed passwords; Stripe hosted + verified idempotent webhooks; billing off until admin; server-side admin authz; recordings deleted immediately and never sent to third parties; avatar validation | ✅ | ✅ HMAC service auth; in-memory audio path (R8) + deletion tests (V2); `stripe_event` idempotency; `app_setting.billing_active`; sharp metadata strip; age gate; self-delete |
| V | Cost-Conscious by Default | Lazy cached TTS; cheapest tiers; int8 models; free tiers; plan limits server-side | ✅ | ✅ `audio_clip` cache; Flash v2.5; 4 GB Droplet; Hobby + Droplet timer instead of Pro cron (R14); account cap; limit check in transaction |
| VI | Learner-First, Inclusive Design | Responsive; WCAG 2.2 AA; light/dark; Figma + palette; friendly level-adapted copy | ✅ | ✅ Radix/shadcn, axe in e2e (V17), `next-themes`, palette tokens, FR-016a prompts |
| VII | Type Safety & Simplicity | Strict TS; Python only for scoring; typed schemas at boundaries; no unjustified services | ✅ | ✅ Zod contracts, OpenAPI for scoring; no separate Node API server; see Complexity Tracking |

**Result**: PASS (pre-research and post-design). No unjustified violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-chunk-learning-app/
├── plan.md              # This file
├── research.md          # Phase 0 decisions (R1–R20)
├── data-model.md        # Phase 1 entities, rules, state transitions
├── quickstart.md        # Phase 1 run + validation guide (V1–V17)
├── contracts/
│   ├── scoring-service.openapi.yaml   # web ↔ scoring service
│   ├── web-api.md                     # pages, server actions, route handlers, webhooks, cron
│   └── llm-outputs.md                 # structured LLM output schemas + rules
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
pnpm-workspace.yaml
package.json                      # root scripts: lint, typecheck, secret-scan
.gitleaks.toml

web/                              # Next.js 16 app (Vercel) — UI + TypeScript backend
├── src/
│   ├── app/
│   │   ├── (marketing)/page.tsx          # landing (US7)
│   │   ├── (auth)/sign-up|sign-in|verify-email|reset-password|waitlist/
│   │   ├── (learner)/today|practice/[sessionId]|progress|library|submit-chunk|my-submissions|profile|billing/
│   │   ├── admin/users|chunks|submissions|waitlist|settings/
│   │   └── api/
│   │       ├── auth/[...all]/route.ts
│   │       ├── sessions/[id]/attempts/route.ts
│   │       ├── tts/route.ts
│   │       ├── profile/avatar/route.ts
│   │       ├── billing/checkout|portal/route.ts
│   │       ├── webhooks/stripe/route.ts
│   │       ├── cron/hourly|daily/route.ts
│   │       └── unsubscribe/route.ts
│   ├── components/               # ui/ (shadcn), session/, progress/, admin/
│   ├── content/sound-hints.json  # curated IPA hint table (source of truth)
│   ├── db/schema.ts, migrations/, seed/
│   ├── lib/
│   │   ├── contracts/            # Zod schemas (actions, llm, scoring)
│   │   ├── auth.ts               # Better Auth config
│   │   ├── providers/llm.ts, tts.ts, scoring-client.ts, storage.ts, email.ts, billing.ts
│   │   └── domain/               # session engine, limits, scoring-to-feedback, streaks,
│   │                             # points, ranking, dedupe, sign-up gate, time zones
│   └── server/actions/           # server actions per area
├── tests/
│   ├── unit/
│   ├── integration/              # PGlite + MSW
│   ├── contract/                 # scoring OpenAPI ↔ Zod
│   └── e2e/                      # Playwright + axe, fake mic fixtures
└── scripts/
    ├── seed-library.ts           # Gemma draft → gpt-oss audit → phonemize → import
    └── calibrate-report.ts

scoring/                          # Python 3.12 FastAPI (DigitalOcean Droplet)
├── pyproject.toml
├── src/scoring/
│   ├── app.py                    # /healthz, /v1/score, /v1/phonemize, HMAC auth
│   ├── audio.py                  # PyAV decode from BytesIO (webm/mp4/wav), in-memory only
│   ├── vad.py, asr.py, phonemes.py, align.py, combine.py
│   ├── hint_map.py               # espeak → app IPA symbols (reads shared JSON)
│   ├── bench.py
│   └── models/download.py
├── tests/                        # unit, contract (schemathesis), deletion, calibration (opt-in)
└── deploy/
    ├── Dockerfile
    ├── scoring.service           # systemd
    └── cron-hourly.timer         # calls web /api/cron/hourly (R14)
```

**Structure Decision**: Two deployables only — `web/` (Next.js full-stack, serving as both
frontend and Node.js backend) and `scoring/` (Python speech service required by the ML
ecosystem). A pnpm workspace at the root holds shared scripts. The IPA hint table lives in
`web/src/content/sound-hints.json` and is copied into the scoring image at build time so both
sides use the same symbols.

## Complexity Tracking

| Decision | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|-------------------------------------|
| Second deployable in Python (`scoring/`) | Speech models (ONNX/sherpa-onnx, espeak-ng, ffmpeg) need a long-running CPU host and Python tooling; permitted by Principle VII | Running models in Vercel Functions exceeds size/memory limits; hosted speech APIs violate Principles I and IV |
| Droplet systemd timer triggers web cron hourly | Reminders at each learner's local hour need hourly scheduling (FR-033) | Vercel Hobby cron is daily only; Vercel Pro adds $20/month during free testing (Principle V); a new cron vendor adds a dependency |
| Separate auditor model (`gpt-oss-20b`) | Constitution II requires independent audit of preloaded chunks | Self-audit by Gemma shares the same blind spots |

## Post-Design Notes

- First implementation milestone should be a **scoring spike** (Parakeet + wav2vec2 int8 on the
  4 GB Droplet) to confirm SC-003 latency and SC-005 calibration before building UI around it
  ("Test the scoring quality first" — product owner's cost note #5). Include clips recorded on
  real iOS Safari (MP4/AAC) and Android Chrome (WebM/Opus).
- **Plan-level assumption (not in spec)**: the app-managed 7-day trial for post-activation
  sign-ups grants the Basic limit (1 practice/day). Revisit if the trial should showcase
  Standard or Premium.
- Auditor model id `openai/gpt-oss-20b` is confirmed available on Vercel AI Gateway
  (supports structured outputs).
- `/speckit-tasks` should order work by user-story priority: foundation (auth, DB, providers,
  scoring spike) → US1 → US2 → US3 → US4 → US5 → US6 → US7 → US8.

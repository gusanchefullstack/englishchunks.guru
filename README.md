# EnglishChunks.guru

A web app that teaches English **chunks** — the ready-made phrases native speakers use, like *“that makes sense”* or *“get used to”* — to learners from A1 to C2, with one daily session: hear it, say it twice, write it, read it aloud, and get pronunciation scores and friendly tips from **open-source AI running on infrastructure we control**.

![CI](https://img.shields.io/github/actions/workflow/status/gusanchefullstack/englishchunks.guru/ci.yml?branch=main&label=CI)
![Scoring calibration](https://img.shields.io/badge/calibration-89.1%25%20pair%20accuracy-1dd6a4)
![Next.js](https://img.shields.io/badge/Next.js-16-08090a)
![Python](https://img.shields.io/badge/Python-3.12-3776AB)
![WCAG](https://img.shields.io/badge/WCAG-2.2%20AA-8789c0)
![License](https://img.shields.io/badge/license-MIT-blue)

## Table of Contents

- [Why EnglishChunks.guru?](#why-englishchunksguru)
- [Screenshots](#screenshots)
- [How it works](#how-it-works)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [Tests](#tests)
- [Deployment](#deployment)
- [What I learned](#what-i-learned)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Credits](#credits)
- [Author](#author)

## Why EnglishChunks.guru?

Most apps teach single words, but fluent speakers think in chunks: *“by the way”*, *“make a decision”*, *“I tend to…”*. Learners need to **say** those chunks out loud and know exactly which sounds to fix — and pronunciation feedback usually means sending your voice to a closed cloud API.

This project does the speech scoring with **self-hosted open models** (Silero VAD, NVIDIA Parakeet, wav2vec2 phonemes) and writes tips with an **open-weight LLM** (Gemma 4). Learner recordings are scored **in memory and deleted immediately** — they never touch a disk or a third party. Pronunciation hints come from a fixed, curated table of ~40 English sounds; the AI only adds warmth around them, so the teaching is always correct and consistent.

## Screenshots

| Landing | Daily session (Learn step) |
|---|---|
| ![Landing page](./assets/landing.png) | ![Learn step of the daily session](./assets/session-learn.png) |

## How it works

```text
Browser (Next.js 16, React 19) ── Server Actions / Route Handlers (TypeScript) ── Neon Postgres (Drizzle)
   │  MediaRecorder (WebM/Opus or MP4/AAC)        │
   │  audio in memory ───────────────────────────▶ │ ── HMAC-signed HTTPS ──▶ Scoring service (FastAPI, Python 3.12)
   │                                               │                           Silero VAD → Parakeet TDT 0.6B v2 (int8)
   │                                               │                           → wav2vec2 espeak phonemes (int8, CTC + GOP)
   │                                               │                           → 0–100 score + per-sound results
   │                                               │ ◀── weakest sounds ──── curated IPA hint table (deterministic)
   │                                               │ ── Gemma 4 26B A4B (Vercel AI Gateway) → warm tip, writing grades
   │  ▶ play  ◀── 302 ── /api/tts?ref=… ────────── │ ── ElevenLabs Flash (lazy, cached in DigitalOcean Spaces)
   │                                               │ ── Resend (verification, reminders) · Stripe Billing (off until admin activates)
```

A session is **Learn → Speak (try 1, try 2) → Write → Read aloud → Daily score**, with streaks, points, a level-band ranking, a searchable chunk library, learner chunk suggestions with admin review, and an admin console.

## Installation

**Prerequisites**

| Tool | Version |
|---|---|
| Node.js | ≥ 22 |
| pnpm | 10 |
| Python | 3.12 (installed by `uv`) |
| uv | ≥ 0.12 |
| espeak-ng | ≥ 1.51 |
| Docker | any recent (local Postgres) |

```bash
git clone https://github.com/gusanchefullstack/englishchunks.guru.git
cd englishchunks.guru
pnpm install

# Local Postgres (localhost URLs use the standard `pg` driver)
docker run -d --name ec-pg-dev -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=englishchunks \
  -p 54329:5432 postgres:17-alpine

cp web/.env.example web/.env.local          # fill in values (never commit them)
export DATABASE_URL=postgres://postgres:dev@localhost:54329/englishchunks
pnpm --filter web db:migrate
pnpm --filter web db:seed                    # voices, sound hints, 30 starter chunks

# Scoring service + models (~950 MB of ONNX int8 models)
cd scoring
cp .env.example .env
uv sync
uv run python -m scoring.models.download                      # Silero VAD + Parakeet
uv run --extra export python -m scoring.models.download --wav2vec2   # export + quantize wav2vec2
```

## Quick Start

```bash
# Terminal 1 — scoring service on :8001 (models preload in the background)
cd scoring && uv run uvicorn scoring.app:app --port 8001
curl localhost:8001/healthz   # {"status":"ok","models":{"vad":true,"asr":true,"phonemes":true}}

# Terminal 2 — web app on :3001
pnpm --filter web dev
```

Open http://localhost:3001, create an account (confirm you're 16+), click the link in the verification email, choose your level, and start today's chunk.

## Configuration

`web/.env.local` (see [`web/.env.example`](./web/.env.example)):

| Variable | Description | Required | Default |
|---|---|---|---|
| `DATABASE_URL` | Postgres URL (Neon in production, local Postgres in dev) | Yes | — |
| `BETTER_AUTH_SECRET` | Session signing secret (≥ 32 chars) | Yes | — |
| `BETTER_AUTH_URL` | Public base URL of the app | Yes | — |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in | No | disabled |
| `AI_GATEWAY_API_KEY` | Vercel AI Gateway key | Yes | — |
| `AI_FEEDBACK_MODEL` | Tips + writing grades | No | `google/gemma-4-26b-a4b-it` |
| `AI_AUDIT_MODEL` | Independent chunk auditor | No | `openai/gpt-oss-20b` |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_MODEL` | Text-to-speech | Yes / No | — / `eleven_flash_v2_5` |
| `SPACES_ENDPOINT`, `SPACES_REGION`, `SPACES_BUCKET`, `SPACES_KEY`, `SPACES_SECRET`, `SPACES_CDN_URL` | DigitalOcean Spaces (TTS cache, avatars). **Also needed at build time** for the CSP | Yes | — |
| `RESEND_API_KEY` / `EMAIL_FROM` | Transactional email | Yes | — |
| `SCORING_URL` / `SCORING_SHARED_SECRET` | Scoring service URL and HMAC secret (≥ 32 chars) | Yes | — |
| `CRON_SECRET` | Bearer secret for `/api/cron/*` | Yes | — |
| `UNSUBSCRIBE_SECRET` | Signs one-click unsubscribe links | Yes | — |
| `STRIPE_SECRET_KEY` | Stripe **restricted** key (`rk_…`) | When billing is on | — |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | When billing is on | — |
| `STRIPE_PRICE_BASIC` / `_STANDARD` / `_PREMIUM` | One Price per plan Product | When billing is on | — |
| `NEXT_PUBLIC_LANDING_VIDEO_URL` / `_CAPTIONS` | Landing video + WebVTT captions | No | walkthrough fallback |

`scoring/.env`: `SCORING_SHARED_SECRET` (same as the web app), `MODELS_DIR` (default `./models`), `MAX_AUDIO_SECONDS` (15), `MAX_AUDIO_BYTES` (1 MiB), `SOUND_HINTS_PATH` (set in Docker).

## API Reference

Full contracts live in [`specs/001-chunk-learning-app/contracts/`](./specs/001-chunk-learning-app/contracts/). Highlights:

### `POST /api/sessions/{id}/attempts` (web)

Multipart: `audio`, `step` (`speak_1` · `speak_2` · `read_aloud`), `item`, `mimeType`.

```json
{
  "kind": "scored",
  "score": 82,
  "components": { "sounds": 83, "words": 100, "flow": 95 },
  "weakestSounds": [{ "ipa": "ð", "hint": "Put your tongue tip lightly between your teeth, then use your voice. Not \"d\" or \"z\".", "exampleWords": ["that", "the", "other"] }],
  "tip": "Lovely rhythm! Let your tongue touch your teeth on “that”.",
  "improvement": 12
}
```

`422 {"kind":"unusable","reason":"no_speech"}` asks the learner to try again (not counted).

### `POST /v1/score` (scoring service, HMAC-signed)

Headers: `X-Timestamp`, `X-Request-Id`, `X-Signature: sha256=HMAC(secret, "<ts>.<id>")`. Multipart: `audio`, `mime_type`, `expected_text`, `level`.

```json
{ "score": 81, "components": { "phoneme_accuracy": 81, "word_accuracy": 67, "fluency": 100 },
  "sounds": [{ "ipa": "ð", "score": 2, "count": 1 }], "weakest_sounds": ["ð", "æ"],
  "transcript": "That makes sense.", "model_versions": { "asr": "parakeet-tdt-0.6b-v2-int8" } }
```

Other routes: `GET /api/tts?ref=chunk:<id>|example:<id>|sentence:<id>` (302 to audio), `POST /api/profile/avatar`, `POST /api/billing/checkout`, `POST /api/billing/portal`, `POST /api/webhooks/stripe`, `POST /api/cron/hourly`, `GET|POST /api/cron/daily`, `POST /api/unsubscribe` (RFC 8058).

## Project Structure

```text
englishchunks.guru/
├── web/                         # Next.js 16 app (UI + TypeScript backend) — Vercel
│   ├── src/app/                 # routes: (marketing), (auth), (learner), onboarding, admin, api
│   ├── src/components/          # session steps, progress, library, admin, shadcn/ui
│   ├── src/lib/domain/          # session engine, scoring→feedback, limits, ranking, billing…
│   ├── src/lib/providers/       # LLM, TTS, storage, email, scoring client, Stripe (swappable)
│   ├── src/content/             # curated IPA sound-hint table (single source of truth)
│   ├── src/db/                  # Drizzle schema, migrations, seeds
│   ├── scripts/                 # library seeding pipeline, latency check
│   └── tests/                   # unit, integration (PGlite + MSW), contract, e2e (Playwright + axe)
├── scoring/                     # Python 3.12 FastAPI speech scoring — DigitalOcean Droplet
│   ├── src/scoring/             # audio decode, engines, CTC alignment/GOP, combination, app
│   ├── tests/                   # unit, contract, no-audio-persisted, calibration (opt-in)
│   └── deploy/                  # Dockerfile, systemd units, hourly cron timer, Caddy
├── specs/001-chunk-learning-app/  # spec, plan, research, data model, contracts, tasks (Spec Kit)
└── .specify/memory/constitution.md  # project principles (open-source AI, privacy, tests…)
```

## Tests

| Suite | Tool | Command |
|---|---|---|
| Web unit + integration (real SQL in PGlite, external services mocked with MSW — unmocked network fails the test) | Vitest | `pnpm test` |
| End-to-end (fake mic, real app + Postgres, deterministic AI fakes, axe WCAG 2.2 AA scans, keyboard-only run) | Playwright | `pnpm --filter web test:e2e` |
| Scoring unit + OpenAPI contract + "no audio persisted" | pytest | `cd scoring && uv run pytest` |
| Scoring calibration on speechocean762 (SC-005, ≥ 85 %) | pytest | `uv run pytest -m calibration` |
| Scoring latency (SC-003, p95 ≤ 5 s) | — | `uv run python -m scoring.bench` |
| Lint · types · secrets | ESLint · tsc · ruff · mypy · gitleaks | `pnpm lint && pnpm typecheck && pnpm secret-scan` |

Current results: 177 web tests, 14 e2e tests, 27 scoring tests; calibration 89.1 % over 66,189 pairs; scoring p95 0.51 s (laptop).

## Deployment

- **Web** → Vercel (Hobby while testing; Pro before charging money). Set every variable above in the project, including Spaces ones (used by the CSP at build). `vercel.json` schedules the daily cron.
- **Scoring** → DigitalOcean Droplet (start 4 GB / 2 vCPU): `docker build -f scoring/deploy/Dockerfile -t ec-scoring .`, mount models read-only, run with `scoring/deploy/scoring.service` (read-only root, tmpfs `/tmp` with `exec` for espeak), Caddy for TLS, and `cron-hourly.timer` to call `/api/cron/hourly` (reminders, invite expiry). See [`scoring/deploy/RUNBOOK.md`](./scoring/deploy/RUNBOOK.md).
- **Billing** stays off until an admin types `ACTIVATE` in Admin → Settings, after the go-live checklist (Stripe test-mode demo, Vercel Pro, restricted live keys, Stripe Tax decision).

## What I learned

- **Spec-driven development** with [Spec Kit](https://github.com/github/spec-kit): constitution → spec → clarify → plan → tasks → analyze → implement kept a 150-task build coherent, and `/speckit-analyze` caught real gaps (Google account-linking takeover, overdue-payment limits) before any code existed.
- **Next.js 16 Cache Components**: request data (`cookies()`, `headers()`, `searchParams`, DB reads) must live inside `<Suspense>`; read headers *before* touching anything that needs env during prerender; `await connection()` marks DB reads as request-time; a streamed page can't change its status code later, so real 404s for the admin area come from [`proxy.ts`](https://nextjs.org/docs/app/getting-started/proxy).
- **Pronunciation scoring from first principles**: CTC forced alignment and goodness-of-pronunciation (GOP) per phone. Averaging GOP in log space let one leaked boundary frame wreck a clean sound — averaging probabilities fixed it. Word accuracy as in-order recall (LCS) stops “that makes… that makes sense” from being marked wrong. ([GOP paper](https://arxiv.org/pdf/2506.12067))
- **Privacy by construction**: Starlette spools multipart uploads > 1 MB to disk, so the service rejects oversized bodies *before* parsing; Docker's `--tmpfs` is `noexec` by default, which breaks phonemizer's espeak-ng copy.
- **Better Auth**: email sign-up hides creation failures behind a synthetic success (anti-enumeration), so the account-cap gate must run in a request `before` hook; implicit Google account linking had to be disabled.
- **Testing seams that unit tests miss**: MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame` (the old option silently let tests hit the real network); a real Chrome MediaRecorder recording and the Docker image each exposed bugs that every fake had hidden.
- **Accessibility**: disabling a button while it's busy drops keyboard focus to `<body>` — use `aria-disabled`/`aria-busy` instead; brand colors needed an AA-safe palette and validated chart colors.
- **Stripe Billing**: one Product per plan, hosted Checkout + Customer Portal, signature-verified idempotent webhooks resolved by Customer ID, and since the 2025 “basil” API the billing period lives on subscription items.

## Roadmap

- [x] Daily session with self-hosted pronunciation scoring and open-weight LLM feedback
- [x] Sign-up, verification, onboarding, profile, account deletion
- [x] Progress, streaks, points, level-band ranking, reminder emails
- [x] Chunk library, suggestions with duplicate detection, admin review
- [x] Admin console, account cap + waitlist, landing page
- [x] Plans with Stripe Billing (off until activated)
- [ ] Run the library seeding pipeline to ~1,000 audited chunks
- [ ] Deploy (Vercel + Droplet + Neon) and run the staging latency/performance checks
- [ ] Real-device recordings (iOS Safari, Android Chrome) in the scoring benchmark
- [ ] Premium “Guru conversation”
- [ ] Interface in the learner's mother tongue

## Contributing

1. Fork and create a branch: `feat/<short-name>` or `fix/<short-name>`.
2. Read [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) — open-source AI at the core, deterministic pedagogy, tests first, privacy.
3. Write tests first; keep `pnpm lint && pnpm typecheck && pnpm test`, the e2e suite and `uv run pytest` green.
4. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`…) and open a PR describing the user-visible change.

## License

Distributed under the MIT License. See [LICENSE](./LICENSE) for details. The AI models keep their own licenses: Silero VAD (MIT), Parakeet TDT 0.6B v2 (CC-BY-4.0), wav2vec2-lv-60-espeak-cv-ft (Apache-2.0), speechocean762 (CC-BY-4.0, calibration only).

## Credits

[Gemma](https://ai.google.dev/gemma) · [NVIDIA Parakeet](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v2) via [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) · [wav2vec2 espeak](https://huggingface.co/facebook/wav2vec2-lv-60-espeak-cv-ft) · [Silero VAD](https://github.com/snakers4/silero-vad) · [espeak-ng](https://github.com/espeak-ng/espeak-ng) · [speechocean762](https://huggingface.co/datasets/mispeech/speechocean762) · [Next.js](https://nextjs.org) · [Better Auth](https://www.better-auth.com) · [Drizzle](https://orm.drizzle.team) · [shadcn/ui](https://ui.shadcn.com) · [Vercel AI SDK](https://ai-sdk.dev) · [ElevenLabs](https://elevenlabs.io) · [Resend](https://resend.com) · [Stripe](https://stripe.com) · [Spec Kit](https://github.com/github/spec-kit). Palette from [coolors](https://coolors.co/5dfdcb-7cc6fe-f4faff-8789c0-08090a).

## Author

**Gustavo Sanchez** — [gustavosanchez.dev](https://www.gustavosanchez.dev)

[<img src="https://cdn.simpleicons.org/github" width="16" alt=""> GitHub](https://github.com/gusanchefullstack) ·
[<img src="https://cdn.simpleicons.org/linkedin" width="16" alt=""> LinkedIn](https://www.linkedin.com/in/gustavosanchezgalarza/) ·
[<img src="https://cdn.simpleicons.org/x" width="16" alt=""> X](https://x.com/gusanchedev) ·
[<img src="https://cdn.simpleicons.org/bluesky" width="16" alt=""> Bluesky](https://bsky.app/profile/gusanchedev.bsky.social) ·
[<img src="https://cdn.simpleicons.org/devdotto" width="16" alt=""> DEV](https://dev.to/gusanchedev) ·
[<img src="https://cdn.simpleicons.org/frontendmentor" width="16" alt=""> Frontend Mentor](https://www.frontendmentor.io/profile/gusanchefullstack)

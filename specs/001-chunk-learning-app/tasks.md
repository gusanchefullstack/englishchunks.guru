---

description: "Task list for EnglishChunks.guru — Chunk Learning App (MVP)"
---

# Tasks: EnglishChunks.guru — Chunk Learning App (MVP)

**Input**: Design documents from `/specs/001-chunk-learning-app/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: REQUIRED. Constitution Principle III (NON-NEGOTIABLE) mandates unit, integration, and
e2e tests for every change, offline with mocked external services. Within each story, test tasks
come first and MUST fail before implementation.

**Organization**: Tasks are grouped by user story (US1–US8, priority order from spec.md) so each
story can be implemented, tested, and demoed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task belongs to (US1…US8); none for Setup, Foundational, Polish
- Paths follow plan.md: `web/` (Next.js app) and `scoring/` (Python service) at repo root

## Global conventions (apply to every task)

- TypeScript strict; validate all inputs with Zod schemas in `web/src/lib/contracts/`.
- Never persist, log, or forward learner audio anywhere except in-memory to `scoring/` (FR-019,
  FR-020). Never log request bodies, emails, tokens, or learner sentences.
- Never commit secrets; add every new env var name to `web/.env.example` or
  `scoring/.env.example` with a placeholder value only.
- LLM output never sets pronunciation scores, IPA, or sound hints (contracts/llm-outputs.md).
- All UI must be keyboard-accessible, use shadcn/Radix primitives, palette tokens, and support
  light/dark (WCAG 2.2 AA).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Repository, tooling, and both project skeletons

- [ ] T001 Create pnpm workspace at repo root: `package.json` (scripts `lint`, `typecheck`, `test`, `secret-scan`), `pnpm-workspace.yaml` listing `web`, `.gitignore` (node_modules, .next, .env*, !.env.example, __pycache__, .venv, models/), `.nvmrc` (22)
- [ ] T002 Scaffold Next.js 16 App Router app in `web/` with TypeScript strict (`web/tsconfig.json` `"strict": true, "noUncheckedIndexedAccess": true`), `src/` dir, `@/*` alias
- [ ] T003 [P] Configure ESLint (next + typescript-eslint strict) and Prettier in `web/eslint.config.mjs` and `web/.prettierrc`
- [ ] T004 [P] Install and init Tailwind CSS v4 + shadcn/ui in `web/`; define palette tokens in `web/src/app/globals.css` (`--mint #5DFDCB`, `--sky #7CC6FE`, `--snow #F4FAFF`, `--lavender #8789C0`, `--ink #08090A`) with light/dark semantic tokens meeting WCAG AA contrast
- [ ] T005 [P] Add `next-themes` ThemeProvider (light/dark/system) in `web/src/components/theme-provider.tsx` and wire into `web/src/app/layout.tsx`
- [ ] T006 [P] Scaffold Python 3.12 project in `scoring/` with `uv`: `scoring/pyproject.toml` (fastapi, uvicorn, onnxruntime, sherpa-onnx, av (PyAV), numpy, phonemizer, structlog, pydantic-settings; dev: pytest, schemathesis, ruff, mypy), package `scoring/src/scoring/__init__.py`
- [ ] T007 [P] Configure Vitest with PGlite + MSW in `web/vitest.config.ts`, `web/tests/setup.ts` (MSW server with `onUnhandledRequest: "error"` so no real network is reachable)
- [ ] T008 [P] Configure Playwright in `web/playwright.config.ts` (Chromium args `--use-fake-ui-for-media-stream`, `--use-fake-device-for-media-stream`, `--use-file-for-fake-audio-capture=tests/e2e/fixtures/audio/chunk.wav`), plus `@axe-core/playwright` helper `web/tests/e2e/helpers/axe.ts` failing on critical/serious violations
- [ ] T009 [P] Add gitleaks config `.gitleaks.toml` and root script `secret-scan`; add GitHub Actions CI `.github/workflows/ci.yml` running lint, typecheck, web tests, scoring pytest, secret scan
- [ ] T010 [P] Create `web/.env.example` (DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AI_GATEWAY_API_KEY, AI_FEEDBACK_MODEL=google/gemma-4-26b-a4b-it, AI_AUDIT_MODEL=openai/gpt-oss-20b, ELEVENLABS_API_KEY, ELEVENLABS_MODEL=eleven_flash_v2_5, SPACES_ENDPOINT, SPACES_REGION, SPACES_BUCKET, SPACES_KEY, SPACES_SECRET, SPACES_CDN_URL, RESEND_API_KEY, EMAIL_FROM, SCORING_URL, SCORING_SHARED_SECRET, CRON_SECRET, UNSUBSCRIBE_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_BASIC, STRIPE_PRICE_STANDARD, STRIPE_PRICE_PREMIUM) and `scoring/.env.example` (SCORING_SHARED_SECRET, MODELS_DIR, MAX_AUDIO_SECONDS=15, MAX_AUDIO_BYTES=1048576)
- [ ] T011 Typed env loader with Zod that fails fast on missing vars in `web/src/lib/env.ts`; pydantic-settings equivalent in `scoring/src/scoring/settings.py`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database, auth core, providers, shared domain, and the scoring-service spike. No user
story work begins until this phase is complete.

### 2a. Database & shared schema

- [ ] T012 Configure Drizzle (`web/drizzle.config.ts`), Neon serverless client for prod and PGlite client for tests in `web/src/db/client.ts`; migration includes `CREATE EXTENSION IF NOT EXISTS pg_trgm`
- [ ] T013 Define all enums from data-model.md in `web/src/db/schema/enums.ts` (`cefr_level` A1–C2, `chunk_type` collocation|idiom|polyword|vague_language|sentence_frame|verb_pattern|discourse_marker, `register` casual|academic|professional, `example_register` casual|professional, `user_role`, `user_status` pending_verification|active|suspended, `theme` light|dark|system, `plan_tier` basic|standard|premium, `subscription_status` none|free_basic|trialing|active|past_due|canceled|expired, `session_origin`, `session_step` learn|speak_1|speak_2|write|read_aloud|done, `session_status`, `attempt_item`, `chunk_source`, `audit_status` pending|passed|failed|admin_approved, `chunk_status`, `submission_status` pending|accepted|rejected|merged, `points_reason`, `notification_type`, `notification_channel`, `waitlist_status` waiting|invited|registered|expired)
- [ ] T014 [P] Define Better Auth tables extended per data-model in `web/src/db/schema/auth.ts`: `user` with `username` "3–24 chars, `[a-z0-9_]`, case-insensitive unique", `display_name` "1–40 chars", `role` default learner, `status`, `age_confirmed_at` required, `level` nullable, `mother_tongue` "ISO 639-1 code, nullable", `time_zone` IANA, `image_key`, `voice_id`, `theme` default system, `ranking_visible` default true, `reminders_enabled` default true, `reminder_hour` "0–23 local, default 19", `early_tester` default false, `total_points` "≥ 0", `current_streak` "≥ 0", `longest_streak` "≥ current_streak" (CHECK constraints), `last_practice_date`, `last_active_at`; plus `session`, `account`, `verification`
- [ ] T015 [P] Define `voice` table ("at least 4 active"), `app_setting` singleton (`id` = 1, `billing_active` default false, `billing_changed_by`, `billing_changed_at`, `account_cap` default 200, `score_weights` default `{speaking: 40, writing: 30, read_aloud: 30}`), `usage_counter` (PK day+metric), `admin_audit_log` in `web/src/db/schema/settings.ts`
- [ ] T016 [P] Define `chunk` (`text` "1–80 chars", `normalized_text` unique among active + trigram GIN index, `registers` "≥ 1", `meaning` "1–300 chars", `usage_note` "1–400 chars", `ipa`, `source`, `submitted_by` ON DELETE SET NULL, `audit_status`, `audit_notes` jsonb, `status` default active; `tsvector` index on text‖meaning), `chunk_example` (`position` "1–3, unique per chunk", `text` "1–200 chars", `register` example_register, `ipa`), and `sound_hint` (`ipa_symbol` PK, `espeak_symbols` text[], `hint` "≤ 160 chars", `example_words` "2–4 words", `version`) in `web/src/db/schema/chunks.ts`
- [ ] T017 [P] Define `subscription` table (`user_id` PK cascade, `tier` default basic, `status`, stripe ids nullable, `trial_ends_at`, `current_period_end`, `cancel_at_period_end`, `pm_brand`, `pm_last4`, `pm_exp_month`, `pm_exp_year`) in `web/src/db/schema/billing.ts`
- [ ] T018 Generate initial migration and `db:migrate` / `db:seed` scripts in `web/package.json`; PGlite test helper that applies migrations per test file in `web/tests/helpers/db.ts`
- [ ] T019 Create curated IPA hint table (~40 American-English sounds; each `hint` ≤ 160 chars, 2–4 `example_words`, `espeak_symbols` mapping, `version: 1`) in `web/src/content/sound-hints.json` and seed loader in `web/src/db/seed/sound-hints.ts`
- [ ] T020 [P] Seed script for ≥4 active American-English voices (mixed genders) and `app_setting` row in `web/src/db/seed/base.ts`; dev seed of 30 hand-checked chunks (5 per level, 3 examples each) in `web/src/db/seed/dev-chunks.json`

### 2b. Auth core & authorization

- [ ] T021 Configure Better Auth in `web/src/lib/auth.ts` (Drizzle adapter, email+password with `requireEmailVerification`, username plugin, admin plugin, Google provider, account linking for same-email Google, built-in rate limiting) and route `web/src/app/api/auth/[...all]/route.ts`
- [ ] T022 [P] Server helpers `requireLearner()` (verified, active, has level) and `requireAdmin()` in `web/src/lib/authz.ts`, returning typed errors `unauthenticated|forbidden`
- [ ] T023 [P] Unit tests for authz helpers in `web/tests/unit/authz.test.ts`

### 2c. Providers & shared domain

- [ ] T024 [P] Error/result types and error codes (`unauthenticated`, `forbidden`, `validation`, `limit_reached`, `not_found`, `conflict`, `unavailable`, `billing_inactive`) in `web/src/lib/errors.ts`
- [ ] T025 [P] Structured logger (pino) with request-id and redaction of body/email/token fields in `web/src/lib/logger.ts`
- [ ] T026 [P] `LlmProvider` interface + AI Gateway implementation using AI SDK `generateObject`, model ids from env, one retry on schema failure, usage recorded to `usage_counter` in `web/src/lib/providers/llm.ts`
- [ ] T027 [P] Zod schemas `PronunciationTip`, `WritingFeedback`, `ChunkDraft`, `ChunkAudit` exactly as in contracts/llm-outputs.md in `web/src/lib/contracts/llm.ts`
- [ ] T028 [P] `StorageProvider` (S3 client for Spaces: put, delete, deletePrefix, signedGetUrl, publicUrl) in `web/src/lib/providers/storage.ts`
- [ ] T029 [P] `EmailProvider` (Resend) + base React Email layout in `web/src/lib/providers/email.ts` and `web/src/emails/layout.tsx`
- [ ] T030 [P] `ScoringClient` with HMAC signing (`X-Signature`, `X-Timestamp`, `X-Request-Id`) and Zod schemas mirroring contracts/scoring-service.openapi.yaml (`ScoreResult`, `Unusable`) in `web/src/lib/providers/scoring-client.ts` and `web/src/lib/contracts/scoring.ts`
- [ ] T031 [P] MSW handlers for AI Gateway, ElevenLabs, Resend, Stripe, Spaces, scoring service in `web/tests/mocks/handlers.ts`
- [ ] T032 [P] Time-zone utilities `practiceDateFor(user, instant)` and `localHour(user, instant)` using date-fns-tz in `web/src/lib/domain/time.ts` with unit tests in `web/tests/unit/time.test.ts`
- [ ] T033 Daily-limit domain: `getDailyLimit(user, subscription, settings)` (basic 1, standard 3, premium 5; app-managed `trialing` → 1; `expired`/`none` after activation → 0; billing inactive → 1) and `reservePractice(tx, userId, practiceDate)` using `SELECT … FOR UPDATE` on user row in `web/src/lib/domain/limits.ts`; unit tests in `web/tests/unit/limits.test.ts`
- [ ] T034 App shell: responsive layout with header nav, theme toggle, skip-link, toast region in `web/src/app/(learner)/layout.tsx` and `web/src/components/app-shell.tsx`

### 2d. Scoring service spike (validates SC-003 / SC-005 before UI is built)

- [ ] T035 [P] Contract test for `/healthz`, `/v1/score`, `/v1/phonemize` using schemathesis against `specs/001-chunk-learning-app/contracts/scoring-service.openapi.yaml` in `scoring/tests/contract/test_openapi.py`
- [ ] T036 [P] Deletion test `test_no_audio_persisted`: score success and forced failure, assert no new files in tmp dirs/cwd, no audio bytes in captured logs, buffers released in `scoring/tests/test_no_audio_persisted.py`
- [ ] T037 [P] Unit tests for alignment and score combination with synthetic phoneme sequences in `scoring/tests/unit/test_align.py` and `scoring/tests/unit/test_combine.py`
- [ ] T038 Model download script fetching Silero VAD ONNX, sherpa-onnx Parakeet TDT 0.6B v2 int8, and wav2vec2-lv-60-espeak-cv-ft (export to ONNX + int8 dynamic quantization) into `MODELS_DIR` in `scoring/src/scoring/models/download.py`
- [ ] T039 In-memory audio decode with PyAV from `BytesIO` (webm/opus, mp4/aac, wav, ogg) → 16 kHz mono float32; reject > `MAX_AUDIO_SECONDS` (15 s) or > `MAX_AUDIO_BYTES` (1 MB); never write to disk in `scoring/src/scoring/audio.py`
- [ ] T040 [P] Silero VAD trimming; return `no_speech`/`too_short` when < 0.3 s speech in `scoring/src/scoring/vad.py`
- [ ] T041 [P] Parakeet ASR via sherpa-onnx returning words + timestamps in `scoring/src/scoring/asr.py`
- [ ] T042 [P] wav2vec2 ONNX CTC phoneme logits + espeak-ng `en-us` expected phonemes in `scoring/src/scoring/phonemes.py`
- [ ] T043 NumPy CTC forced alignment, GOP-style per-phone posterior, and edit-distance substitution/deletion flags in `scoring/src/scoring/align.py`
- [ ] T044 espeak → app IPA symbol mapping read from copied `sound-hints.json` in `scoring/src/scoring/hint_map.py`
- [ ] T045 Score combination (0.5 phoneme + 0.3 word + 0.2 fluency, weights from settings), `weakest_sounds` (2–3 lowest, min 2 occurrences or 1 if fewer), `wrong_content` detection (word accuracy < 30) in `scoring/src/scoring/combine.py`
- [ ] T046 FastAPI app with HMAC verification (±60 s skew), `/healthz`, `/v1/score` (multipart incl. `mime_type`), `/v1/phonemize` (≤100 texts), buffers released in `finally`, structlog without bodies in `scoring/src/scoring/app.py`
- [ ] T047 Latency benchmark over 50 sample clips reporting p50/p95 in `scoring/src/scoring/bench.py`; record results (incl. real iOS Safari MP4 and Android Chrome WebM clips) in `scoring/BENCHMARKS.md`
- [ ] T048 Calibration suite (pytest marker `calibration`) over reference feature set built outside the app (owner/volunteer consented clips + speechocean762), asserting ≥85% correct good/poor pair ranking in `scoring/tests/calibration/test_pairs.py`
- [ ] T049 Deployment assets: `scoring/deploy/Dockerfile` (python:3.12-slim, espeak-ng, models baked or volume), `scoring/deploy/scoring.service` (systemd, tmpfs `/tmp`), HTTPS via Caddy config `scoring/deploy/Caddyfile`

**Checkpoint**: DB, auth core, providers, and a validated scoring service exist. If SC-003
(p95 ≤ 5 s) fails on 4 GB, resize Droplet to 8 GB before continuing.

---

## Phase 3: User Story 1 - Complete the daily chunk session (Priority: P1) 🎯 MVP

**Goal**: A signed-in learner completes learn → speak ×2 → write → read aloud → daily score.

**Independent Test**: With seeded `b1.learner` and the dev chunk set, complete all six steps;
each step yields its output, the daily score is saved, streak = 1, no audio persists (V1, V2, V3).

### Tests for User Story 1 ⚠️ (write first, must fail)

- [ ] T050 [P] [US1] Integration test: session engine forward-only steps, resume same day, one `daily` session per user per `practice_date`, limit enforcement in `web/tests/integration/session-engine.test.ts`
- [ ] T051 [P] [US1] Integration test: `POST /api/sessions/{id}/attempts` success, `422` unusable (not counted), `503` retry keeps state, audio never written to DB/storage/logs (spy on storage + logger) in `web/tests/integration/attempts.deletion.test.ts`
- [ ] T052 [P] [US1] Integration test: writing feedback via mocked LLM, offensive text stored as `[removed]`, corrected identical when already correct in `web/tests/integration/writing.test.ts`
- [ ] T053 [P] [US1] Integration test: TTS by `ref` only — shared clip generated once then reused, private sentence clip under `tts/u/<userId>/`, raw `text` param rejected in `web/tests/integration/tts.test.ts`
- [ ] T054 [P] [US1] Unit tests: daily score weights, partial sessions, streak update incl. gap and midnight crossing in `web/tests/unit/daily-score.test.ts`
- [ ] T055 [P] [US1] Unit tests: tip post-check rejects messages containing IPA symbols or numbers not in input in `web/tests/unit/tip-guard.test.ts`
- [ ] T056 [P] [US1] Contract test: `ScoringClient` Zod schemas match the OpenAPI document in `web/tests/contract/scoring.contract.test.ts`
- [ ] T057 [P] [US1] E2E test: full daily session with fake mic and mocked services, plus axe scan of each step in `web/tests/e2e/daily-session.spec.ts`

### Implementation for User Story 1

- [ ] T058 [P] [US1] Define `practice_session` (one `daily` per user per `practice_date`; `counts_toward_limit`; step scores and `daily_score` "0–100"; `partial`), `attempt` (unique (`session_id`,`step`,`item`); `score`, `word_accuracy`, `phoneme_accuracy`, `fluency` "0–100"; `sound_results` jsonb; `weakest_sounds` "2–3 IPA symbols"; `tip`; `hint_table_version`; **no audio column**), and `writing_result` (`position` "1–3"; `original` "1–300 chars; offensive text replaced by `[removed]` before storage"; `usage_grade`/`grammar_grade` "0–100"; `explanation` "≤ 1 sentence") in `web/src/db/schema/sessions.ts` + migration
- [ ] T059 [P] [US1] Define `audio_clip` (`cache_key` PK; `owner_id` FK cascade, NULL for shared; `storage_key` `tts/shared/…` or `tts/u/<userId>/…`; `status` generating|ready|failed; `byte_size`) in `web/src/db/schema/audio.ts` + migration
- [ ] T060 [US1] Daily chunk selection: chunk at learner level with `audit_status` passed|admin_approved and `status` active, preferring never-practiced, else least-recently practiced in `web/src/lib/domain/chunk-picker.ts`
- [ ] T061 [US1] Session engine: `startDailySession`, `getSession`, `advanceStep` (forward-only, idempotent), `skipSpeaking` (partial), `completeSession` using `reservePractice` in `web/src/lib/domain/session-engine.ts`
- [ ] T062 [US1] Server actions wrapping the session engine with `requireLearner()` in `web/src/server/actions/session.ts`
- [ ] T063 [P] [US1] `TtsProvider` (ElevenLabs Flash v2.5) + TTS service resolving `ref` (`chunk:<id>`, `example:<id>`, `sentence:<writingResultId>` own only), row-lock de-dup, shared vs private storage in `web/src/lib/providers/tts.ts` and `web/src/lib/domain/tts-service.ts`
- [ ] T064 [US1] Route `GET /api/tts?ref=…` → 302 to CDN (shared) or signed URL (private) in `web/src/app/api/tts/route.ts`
- [ ] T065 [US1] Feedback composer: map `weakest_sounds` to fixed `sound_hint` rows, call `PronunciationTip` with level + hints, apply post-check guard in `web/src/lib/domain/feedback.ts`
- [ ] T066 [US1] Route `POST /api/sessions/[id]/attempts`: owner check, size/duration guard, stream audio in memory to `ScoringClient`, persist `attempt` (no audio), compose tip, return `AttemptResult` with `improvement` vs try 1 in `web/src/app/api/sessions/[id]/attempts/route.ts`
- [ ] T067 [US1] Writing grading: `submitWriting` action (3 sentences, 1–300 chars each) calling `WritingFeedback`, handling `flags` in `web/src/lib/domain/writing.ts` and `web/src/server/actions/writing.ts`
- [ ] T068 [US1] Daily score + streak computation (weights from `app_setting.score_weights`, partial handling, `practice_date` from session start) in `web/src/lib/domain/daily-score.ts`
- [ ] T069 [P] [US1] Recorder hook choosing MIME via `isTypeSupported` (`audio/webm;codecs=opus`, then `audio/mp4`), max 15 s, reporting actual `mimeType`, microphone-denied state in `web/src/components/session/use-recorder.ts`
- [ ] T070 [P] [US1] Accessible audio play button (replay from cache, error → show text + IPA + retry) in `web/src/components/session/play-button.tsx`
- [ ] T071 [P] [US1] Step components: `LearnStep`, `SpeakStep` (try 1/2 with improvement), `WriteStep`, `ReadAloudStep`, `SummaryStep` in `web/src/components/session/`
- [ ] T072 [US1] Session stepper page and `/today` entry (resume, limit reached message) in `web/src/app/(learner)/today/page.tsx` and `web/src/app/(learner)/practice/[sessionId]/page.tsx`

**Checkpoint**: MVP — a seeded learner can complete a full daily session end to end.

---

## Phase 4: User Story 2 - Sign up, verify, and set up a learner profile (Priority: P2)

**Goal**: Visitors self-register (email or Google), verify, choose level, manage profile,
reset password, and delete their account.

**Independent Test**: V4, V5, V6 in quickstart.md.

### Tests for User Story 2 ⚠️

- [ ] T073 [P] [US2] Integration test: sign-up requires `ageConfirmed`, unverified accounts cannot practice, Google same-email linking, single-use 1 h reset tokens in `web/tests/integration/auth-flow.test.ts`
- [ ] T074 [P] [US2] Integration test: avatar upload — magic-byte MIME check, >5 MB rejected, output 512×512 WebP with no EXIF in `web/tests/integration/avatar.test.ts`
- [ ] T075 [P] [US2] Integration test: `deleteAccount` removes user rows, avatar, `tts/u/<userId>/` objects, cancels Stripe sub (mock), keeps accepted chunks with `submitted_by` NULL in `web/tests/integration/delete-account.test.ts`
- [ ] T076 [P] [US2] E2E test: sign up → verify (captured email) → level → profile edits → sign out → reset password → sign in, with axe scans in `web/tests/e2e/onboarding.spec.ts`

### Implementation for User Story 2

- [ ] T077 [P] [US2] Verification and password-reset email templates in `web/src/emails/verify-email.tsx` and `web/src/emails/reset-password.tsx`, wired into Better Auth hooks in `web/src/lib/auth.ts`
- [ ] T078 [US2] Sign-up hook enforcing `ageConfirmed === true` (sets `age_confirmed_at`) and default `time_zone` from client in `web/src/lib/auth-hooks.ts`
- [ ] T079 [P] [US2] Auth pages: sign-up (email, username, password, "I am 16 or older" checkbox, Google button), sign-in, verify-email, reset-password in `web/src/app/(auth)/`
- [ ] T080 [US2] Level onboarding page + `setLevel` action (CEFR or beginner→A2, intermediate→B1, advanced→C1; applies from next daily chunk) in `web/src/app/(learner)/onboarding/level/page.tsx` and `web/src/server/actions/profile.ts`; redirect learners without level from `requireLearner()`
- [ ] T081 [US2] `updateProfile` action (`displayName` 1–40, `motherTongue` ISO 639-1, `timeZone` IANA, `voiceId` active voice, `theme`, `rankingVisible`, `remindersEnabled`, `reminderHour` 0–23) in `web/src/server/actions/profile.ts`
- [ ] T082 [US2] Avatar route with sharp (auto-orient, strip metadata, center-crop 512×512, WebP; jpeg/png/webp/heic ≤ 5 MB) in `web/src/app/api/profile/avatar/route.ts`
- [ ] T083 [US2] `deleteAccount` action (confirm "DELETE"; cancel Stripe sub if any; delete avatar and `tts/u/<userId>/` prefix; hard delete cascade; sign out) in `web/src/lib/domain/account-deletion.ts` and `web/src/server/actions/profile.ts`
- [ ] T084 [US2] Profile page: picture, display name, mother tongue, level, time zone, voice picker with preview, theme, ranking visibility, reminders toggle/time, danger zone delete in `web/src/app/(learner)/profile/page.tsx`

**Checkpoint**: New users can onboard themselves and reach the US1 session.

---

## Phase 5: User Story 3 - Track progress, streak, and ranking (Priority: P3)

**Goal**: Progress page with chart, streaks, points, improvement trend, band/overall ranking,
and daily reminder emails.

**Independent Test**: V7 and V8 in quickstart.md.

### Tests for User Story 3 ⚠️

- [ ] T085 [P] [US3] Unit tests: points amounts (session `round(daily_score / 10)`; milestones 3/7/30/100 days → 5/15/50/150; accepted submission 20) and idempotency on (user_id, reason, ref_id) in `web/tests/unit/points.test.ts`
- [ ] T086 [P] [US3] Integration test: ranking by band (A1–A2, B1–B2, C1–C2) and overall, weekly (ISO week UTC) and all-time, excludes `ranking_visible = false` and non-active users but shows own position in `web/tests/integration/ranking.test.ts`
- [ ] T087 [P] [US3] Integration test: hourly cron sends ≤1 reminder/user/day only at local `reminder_hour` and only if no practice today; unsubscribe GET and RFC 8058 POST disable reminders without sign-in in `web/tests/integration/reminders.test.ts`
- [ ] T088 [P] [US3] E2E test: seeded 14-day history renders chart, streaks, band ranking toggle; axe scan in `web/tests/e2e/progress.spec.ts`

### Implementation for User Story 3

- [ ] T089 [P] [US3] Define `points_ledger` (unique (user_id, reason, ref_id)) and `notification` (`channel`, `read_at`, `sent_on` with unique (user_id, type='reminder', sent_on)) in `web/src/db/schema/engagement.ts` + migration
- [ ] T090 [US3] Points service (award + update `total_points`) and hook into `completeSession` for session and streak-milestone awards in `web/src/lib/domain/points.ts`
- [ ] T091 [US3] Ranking queries (band derived from current level, weekly/all-time, own position) in `web/src/lib/domain/ranking.ts`
- [ ] T092 [P] [US3] Progress data loader (7/30/90-day scores, current/longest streak, total points, try-1→try-2 trend) in `web/src/lib/domain/progress.ts`
- [ ] T093 [P] [US3] Progress UI with Recharts (accessible table fallback, `aria` descriptions), streak and points cards, ranking list with band/overall and week/all-time toggles in `web/src/app/(learner)/progress/page.tsx` and `web/src/components/progress/`
- [ ] T094 [P] [US3] Reminder email template with streak and signed unsubscribe link + `List-Unsubscribe` / `List-Unsubscribe-Post` headers in `web/src/emails/reminder.tsx`
- [ ] T095 [US3] Cron route `POST /api/cron/hourly` (Bearer `CRON_SECRET`; due reminders; also expires waitlist invites once US7 exists) in `web/src/app/api/cron/hourly/route.ts`
- [ ] T096 [US3] Unsubscribe route (GET confirm page + POST one-click, HMAC token) in `web/src/app/api/unsubscribe/route.ts`
- [ ] T097 [P] [US3] Droplet timer calling the hourly cron: `scoring/deploy/cron-hourly.service` and `scoring/deploy/cron-hourly.timer`

**Checkpoint**: Learners see progress and ranking; reminders arrive at most once per day.

---

## Phase 6: User Story 4 - Explore the chunk library and practice a chosen chunk (Priority: P4)

**Goal**: Search/filter the library and launch a practice within the daily limit.

**Independent Test**: V9 in quickstart.md.

### Tests for User Story 4 ⚠️

- [ ] T098 [P] [US4] Integration test: `searchChunks` text (tsvector + trigram) and filters by level/type/register, pagination of 20, only practicable chunks in `web/tests/integration/library-search.test.ts`
- [ ] T099 [P] [US4] Integration test: `startLibrarySession` shares the daily limit with daily sessions; `limit_reached` includes reset time in `web/tests/integration/library-practice.test.ts`
- [ ] T100 [P] [US4] E2E test: search "look forward to", filter B1 + verb pattern, launch blocked after daily session on Basic; axe scan in `web/tests/e2e/library.spec.ts`

### Implementation for User Story 4

- [ ] T101 [US4] Library search service in `web/src/lib/domain/library.ts` and `searchChunks` action in `web/src/server/actions/library.ts`
- [ ] T102 [US4] `startLibrarySession` in `web/src/lib/domain/session-engine.ts` (origin `library`, `reservePractice`) and action in `web/src/server/actions/session.ts`
- [ ] T103 [P] [US4] Library list page with search box and filter controls (URL state) in `web/src/app/(learner)/library/page.tsx`
- [ ] T104 [P] [US4] Chunk detail page (meaning, usage, IPA, examples with play, "Practice this" with remaining count / limit message) in `web/src/app/(learner)/library/[chunkId]/page.tsx`

**Checkpoint**: Learners can choose what to practice within their plan limit.

---

## Phase 7: User Story 5 - Suggest a new chunk and get it reviewed (Priority: P5)

**Goal**: Submit chunks with duplicate detection; admin accept/reject with notification + points.

**Independent Test**: V10 in quickstart.md.

### Tests for User Story 5 ⚠️

- [ ] T105 [P] [US5] Unit tests for normalization (case, punctuation, contractions, slot markers, simple verb lemmas) and similarity threshold 0.6 on a near-duplicate fixture set (≥90% suggested, SC-010) in `web/tests/unit/dedupe.test.ts`
- [ ] T106 [P] [US5] Integration test: exact match suggests existing; novel → pending; duplicate pending merged (first submitter credited); accept publishes chunk (IPA via phonemize mock), notifies in-app + email, +20 points; reject notifies with reason in `web/tests/integration/submissions.test.ts`
- [ ] T107 [P] [US5] E2E test: submit existing and novel chunks, admin approves, learner sees notification; axe scan in `web/tests/e2e/submissions.spec.ts`

### Implementation for User Story 5

- [ ] T108 [P] [US5] Define `chunk_submission` (`matched_chunk_ids` uuid[], `status` pending|accepted|rejected|merged, `reviewer_id`, `decision_reason`, `decided_at`, `resulting_chunk_id`, `submitted_by` ON DELETE SET NULL) in `web/src/db/schema/submissions.ts` + migration
- [ ] T109 [US5] Normalization + duplicate detection (exact on normalized, pg_trgm ≥ 0.6, top 3) in `web/src/lib/domain/dedupe.ts`
- [ ] T110 [US5] Actions `checkChunkDuplicate`, `submitChunk` in `web/src/server/actions/submissions.ts`
- [ ] T111 [US5] `adminDecideSubmission` (accept with edits → create chunk + examples, phonemize via `ScoringClient`, notify, award points; reject with optional reason) in `web/src/lib/domain/submission-review.ts` and `web/src/server/actions/admin-submissions.ts`
- [ ] T112 [P] [US5] Decision email templates in `web/src/emails/submission-accepted.tsx` and `web/src/emails/submission-rejected.tsx`; in-app notification bell in `web/src/components/notifications-bell.tsx`
- [ ] T113 [P] [US5] Pages: submit form with live duplicate suggestions in `web/src/app/(learner)/submit-chunk/page.tsx`; "My submissions" in `web/src/app/(learner)/my-submissions/page.tsx`
- [ ] T114 [US5] Admin submissions queue page in `web/src/app/admin/submissions/page.tsx` using `requireAdmin()` directly (does not depend on the US6 admin layout)

**Checkpoint**: The library grows through moderated learner submissions.

---

## Phase 8: User Story 6 - Administer users, chunks, and plans (Priority: P6)

**Goal**: Admin area for user CRUD/suspension, plan visibility, chunk management, audit log.

**Independent Test**: V11 in quickstart.md.

### Tests for User Story 6 ⚠️

- [ ] T115 [P] [US6] Integration test: every admin action rejects non-admins (`forbidden`); list filters by plan/status/level; suspended user cannot sign in; audit log rows written in `web/tests/integration/admin-users.test.ts`
- [ ] T116 [P] [US6] Integration test: user detail shows payment method summary only (type, brand, last4, expiry) in `web/tests/integration/admin-user-detail.test.ts`
- [ ] T117 [P] [US6] E2E test: learner gets 403 on `/admin/*`; admin filters, edits level, suspends; axe scan in `web/tests/e2e/admin.spec.ts`

### Implementation for User Story 6

- [ ] T118 [US6] Admin audit logging helper in `web/src/lib/domain/audit.ts`
- [ ] T119 [US6] Admin user actions (`adminListUsers`, `adminGetUser`, `adminCreateUser`, `adminUpdateUser`, `adminSuspendUser`, `adminDeleteUser` reusing account-deletion) in `web/src/server/actions/admin-users.ts`
- [ ] T120 [US6] Admin chunk actions (`adminUpsertChunk` recomputing IPA via phonemize; exactly 3 examples each containing the chunk; `adminRetireChunk`) in `web/src/server/actions/admin-chunks.ts`
- [ ] T121 [P] [US6] Admin layout with `requireAdmin()` guard and nav in `web/src/app/admin/layout.tsx`; dashboard with daily `usage_counter` metrics in `web/src/app/admin/page.tsx`
- [ ] T122 [P] [US6] Users list (username, email, level, plan, subscription status, sign-up date, last activity; search + filters) and user detail pages in `web/src/app/admin/users/page.tsx` and `web/src/app/admin/users/[id]/page.tsx`
- [ ] T123 [P] [US6] Chunks management page incl. audit-failed review queue in `web/src/app/admin/chunks/page.tsx`

**Checkpoint**: The service can be operated by an admin.

---

## Phase 9: User Story 7 - Discover the app on the landing page (Priority: P7)

**Goal**: Public landing page and the sign-up cap with waitlist.

**Independent Test**: V12 in quickstart.md plus landing-page checks on mobile/tablet/desktop.

### Tests for User Story 7 ⚠️

- [ ] T124 [P] [US7] Integration test: sign-up gate allows iff billing active OR active users < `account_cap` OR valid unexpired invite; otherwise waitlist; invite tokens single-use, expire after 7 days; deleting an account frees a place in `web/tests/integration/signup-gate.test.ts`
- [ ] T125 [P] [US7] E2E test: landing renders explainer, video, plans ("coming soon" for Standard/Premium while billing inactive), CTA → sign-up; at cap shows waitlist; axe scans at 375/768/1280 widths in `web/tests/e2e/landing.spec.ts`

### Implementation for User Story 7

- [ ] T126 [P] [US7] Define `waitlist_entry` (`email` unique lowercased, `status` waiting|invited|registered|expired, `invite_token_hash`, `invited_by`, `invited_at`, `invite_expires_at`) in `web/src/db/schema/waitlist.ts` + migration
- [ ] T127 [US7] Sign-up gate domain + Better Auth before-hook enforcement in `web/src/lib/domain/signup-gate.ts` and `web/src/lib/auth-hooks.ts`
- [ ] T128 [US7] Waitlist page (email only) and join action in `web/src/app/(auth)/waitlist/page.tsx` and `web/src/server/actions/waitlist.ts`
- [ ] T129 [US7] Admin waitlist page + `adminInviteFromWaitlist` and `adminSetAccountCap` actions + invite email template in `web/src/app/admin/waitlist/page.tsx`, `web/src/server/actions/admin-settings.ts`, `web/src/emails/waitlist-invite.tsx`; extend hourly cron to expire invites in `web/src/app/api/cron/hourly/route.ts`
- [ ] T130 [P] [US7] Landing page sections (hero, what are chunks with examples per type, accessible video with captions, plan comparison, CTA reflecting billing state) per Figma in `web/src/app/(marketing)/page.tsx` and `web/src/components/marketing/`

**Checkpoint**: Public visitors can discover and join, with cost-bounded sign-ups.

---

## Phase 10: User Story 8 - Plans, limits, and billing activation (Priority: P8)

**Goal**: Billing stays off by default; admin activation marks early testers; app-managed 7-day
trial for later sign-ups; Stripe hosted Checkout/Portal; verified idempotent webhooks.

**Independent Test**: V13 and V14 in quickstart.md (Stripe test mode).

### Tests for User Story 8 ⚠️

- [ ] T131 [P] [US8] Integration test: billing inactive → no Stripe calls, checkout returns `billing_inactive`, limit 1 in `web/tests/integration/billing-inactive.test.ts`
- [ ] T132 [P] [US8] Integration test: `adminSetBilling(active)` marks all existing users `early_tester` + `free_basic`; post-activation sign-up starts app-managed `trialing` (Basic limit, `trial_ends_at` = sign-up + 7 days); daily cron expires trial → limit 0 in `web/tests/integration/billing-activation.test.ts`
- [ ] T133 [P] [US8] Integration test: webhook signature verification, idempotency via `stripe_event`, transitions active/past_due/canceled (early tester → free_basic, others → expired), payment-method summary stored as display fields only in `web/tests/integration/stripe-webhooks.test.ts`

### Implementation for User Story 8

- [ ] T134 [P] [US8] Define `stripe_event` (PK = Stripe event id, `type`, `processed_at`) in `web/src/db/schema/billing.ts` + migration
- [ ] T135 [US8] Billing provider (Stripe client; Checkout in subscription mode **without** `trial_period_days`; Customer Portal; price ids from env) in `web/src/lib/providers/billing.ts`
- [ ] T136 [US8] Subscription state machine per data-model.md transitions in `web/src/lib/domain/subscription.ts`
- [ ] T137 [US8] `adminSetBilling` (confirm "ACTIVATE"/"DEACTIVATE", audit-logged, marks early testers) in `web/src/server/actions/admin-settings.ts`; post-activation sign-up hook creating app-managed trial in `web/src/lib/auth-hooks.ts`
- [ ] T138 [US8] Routes `POST /api/billing/checkout` and `POST /api/billing/portal` (409 `billing_inactive` when off) in `web/src/app/api/billing/checkout/route.ts` and `web/src/app/api/billing/portal/route.ts`
- [ ] T139 [US8] Webhook route (raw body, `Stripe-Signature`, idempotent processing of `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_failed`) in `web/src/app/api/webhooks/stripe/route.ts`
- [ ] T140 [US8] Daily cron `POST /api/cron/daily` (expire app-managed trials, abandon stale sessions, usage rollup) in `web/src/app/api/cron/daily/route.ts` and `web/vercel.json` cron entry
- [ ] T141 [P] [US8] Billing page (plan status, trial countdown, subscribe/manage buttons only when active; Premium conversation "coming soon") in `web/src/app/(learner)/billing/page.tsx`; admin settings page (billing switch, account cap) in `web/src/app/admin/settings/page.tsx`
- [ ] T142 [P] [US8] Billing notice email templates (trial ending, payment failed) in `web/src/emails/billing-notice.tsx`

**Checkpoint**: Billing can be activated safely after the go-live checklist.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Content, quality, and launch readiness across stories

- [ ] T143 Library seeding pipeline: Gemma `ChunkDraft` from curated seed list → `gpt-oss-20b` `ChunkAudit` → phonemize → import passed chunks, failed to admin queue; target ~1,000 across A1–C2, all 7 types, 3 registers in `web/scripts/seed-library.ts` with seed list `web/scripts/seed-list.csv`
- [ ] T144 [P] Keyboard-only and screen-reader pass of the full daily session; fix issues found (SC-011) across `web/src/components/session/`
- [ ] T145 [P] Performance pass: LCP ≤ 2.5 s on mid-range mobile for `/`, `/today`, `/progress` (image sizing, font loading, server components) across `web/src/app/`
- [ ] T146 [P] Security hardening: CSP and security headers in `web/next.config.ts`, rate limits on attempts/writing/submission actions in `web/src/lib/rate-limit.ts`
- [ ] T147 [P] Root `README.md` (setup, env vars, architecture, open-source rationale) — use the create-readme conventions
- [ ] T148 Deploy: Vercel project (Hobby) for `web/`, Droplet provisioning runbook `scoring/deploy/RUNBOOK.md`, Neon production branch; run quickstart V1–V17 against staging
- [ ] T149 Go-live checklist execution (Stripe test-mode demo account subscribe/renew/cancel, Vercel Pro upgrade, live keys in env only) documented in `specs/001-chunk-learning-app/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup; **blocks all user stories**. 2d (scoring spike)
  can run in parallel with 2a–2c (different project).
- **User stories (Phases 3–10)**: all depend on Foundational
- **Polish (Phase 11)**: after the desired stories

### User Story Dependencies

- **US1 (P1)**: Foundational only (uses seeded users/chunks). MVP.
- **US2 (P2)**: Foundational only. Integrates with US1 by leading new users into `/today`.
- **US3 (P3)**: Foundational; awards points from US1's `completeSession` (hook is a no-op until
  US3 lands). Testable with seeded history.
- **US4 (P4)**: Foundational + US1 session engine (reuses `session-engine.ts`).
- **US5 (P5)**: Foundational; uses `requireAdmin()` directly so it does not need US6's admin layout.
  Points via US3's points service (if US3 not yet done, award is deferred).
- **US6 (P6)**: Foundational; reuses US2's account-deletion for `adminDeleteUser`.
- **US7 (P7)**: Foundational + US2 auth hooks file.
- **US8 (P8)**: Foundational + US2 auth hooks + US6 admin settings page shell.

### Within Each User Story

- Tests first (must fail) → schema/models → domain services → actions/routes → UI → e2e green

### Parallel Opportunities

- Phase 1: T003–T010 are [P].
- Phase 2: schema files (auth, settings, chunks, billing) in parallel; all providers in parallel;
  the entire 2d scoring track runs in parallel with web foundational work.
- Each story: all test tasks [P]; schema + provider + UI component tasks marked [P].
- After Foundational: US1, US2, US3, US6, US7 can be built by different developers in parallel.

---

## Parallel Example: User Story 1

```bash
# Tests first (all [P]):
Task: "Integration test session engine in web/tests/integration/session-engine.test.ts"
Task: "Integration test attempts + deletion in web/tests/integration/attempts.deletion.test.ts"
Task: "Integration test writing in web/tests/integration/writing.test.ts"
Task: "Integration test TTS by ref in web/tests/integration/tts.test.ts"
Task: "E2E daily session in web/tests/e2e/daily-session.spec.ts"

# Then schema + independent components:
Task: "Define practice_session/attempt/writing_result in web/src/db/schema/sessions.ts"
Task: "Define audio_clip in web/src/db/schema/audio.ts"
Task: "Recorder hook in web/src/components/session/use-recorder.ts"
Task: "Play button in web/src/components/session/play-button.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational (including the scoring spike gate: SC-003 latency and
   SC-005 calibration must pass — "test the scoring quality first").
2. Phase 3 US1 with seeded test accounts.
3. **STOP and VALIDATE** with V1–V3; demo to friends with pre-created accounts.

### Incremental Delivery

1. + US2 → open self-registration to invited testers.
2. + US3 → progress, ranking, reminders (retention).
3. + US4, US5 → library and community growth.
4. + US6, US7 → operations and public landing with account cap (ready for DEV challenge post).
5. + US8 → billing, only after the go-live checklist.

---

## Notes

- [P] = different files, no dependency on incomplete tasks; [USn] = traceability to spec.md.
- Commit after each task or logical group; run `pnpm lint && pnpm typecheck && pnpm test` before
  each commit (constitution quality gates).
- Record open-source build decisions as you go (constitution workflow) for the DEV write-up.

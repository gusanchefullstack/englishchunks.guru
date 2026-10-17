# Phase 0 Research: EnglishChunks.guru — Chunk Learning App (MVP)

**Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Each entry records the decision, why it was chosen, and what else was considered. All
"NEEDS CLARIFICATION" items from the Technical Context are resolved here.

---

## R1. Feedback & writing-grading LLM

- **Decision**: Gemma 4 26B A4B instruct, model id `google/gemma-4-26b-a4b-it`, called through
  Vercel AI Gateway with the AI SDK (`generateObject` + Zod schemas). Model id lives in config
  (`AI_FEEDBACK_MODEL`) so it can be swapped for `google/gemma-4-31b-it` or a self-hosted Gemma.
- **Rationale**: Open-weight (Principle I); cheapest Gemma 4 variant on the gateway; MoE with
  ~4B active params gives low latency; structured output keeps grades machine-checkable. The
  gateway gives one key, usage tracking, and provider fallback.
- **Alternatives**: Gemma 4 31B (better quality, higher cost — kept as config fallback);
  self-hosting Gemma on the Droplet (CPU too slow for interactive feedback); closed models
  (violate Principle I).
- **Production note (2026-10-17)**: the gateway routes Gemma to a provider without JSON-schema
  response formats, so the schema is also stated in the system prompt (`withSchema` in
  `providers/llm.ts`); the AI SDK still validates. The tip is streamed after the score (NDJSON
  attempts route) so the 2–3 s LLM call doesn't delay results.

## R2. Chunk-library generation and audit models

- **Decision**: Library seed generated offline by a script: Gemma 4 26B A4B drafts chunk records
  (meaning, usage, examples, level, type, register) from a curated seed list of chunk strings;
  an independent open-weight auditor (`openai/gpt-oss-20b` via AI Gateway, configurable as
  `AI_AUDIT_MODEL`) checks each record for accuracy, CEFR level fit, and natural examples.
  Records failing audit go to an admin review queue instead of being imported. IPA is produced
  deterministically by espeak-ng (R6), never by an LLM.
- **Rationale**: Spec FR-040 and constitution Principle II require an independent audit; a
  different model family reduces correlated errors; both are open-weight and low cost.
- **Alternatives**: Manual curation only (too slow for ~1,000); same model self-audit (correlated
  errors); public idiom datasets (licensing unclear, inconsistent levels — used only as
  inspiration for the seed list).

## R3. Speech-scoring runtime and hosting

- **Decision**: Python 3.12 FastAPI service on a DigitalOcean CPU Droplet (start at 4 GB / 2 vCPU,
  scale to 8 GB / 4 vCPU only if SC-003 latency fails). All models run on ONNX Runtime with
  int8 quantization; no PyTorch at runtime.
- **Rationale**: Constitution Principle I (self-hosted speech) and V (smallest viable box). ONNX
  int8 cuts memory roughly 4× and avoids the ~2 GB torch dependency.
- **Alternatives**: GPU Droplet (cost); serverless GPU (cold starts, sends audio to third
  parties); running on Vercel Functions (model size and memory limits).
- **Production note (2026-10-17)**: `s-2vcpu-4gb` isn't offered in SFO3, so the Droplet is
  `s-2vcpu-4gb-amd` ($28/mo). ASR and the phoneme model run in parallel (both release the GIL;
  `PARALLEL_MODELS`, `ASR_THREADS=1`, `PHONEME_THREADS=2`), −10% server time; no 8 GB resize
  needed (scoring/BENCHMARKS.md).

## R4. Voice activity detection

- **Decision**: Silero VAD (ONNX) trims leading/trailing silence and rejects recordings with
  less than 0.3 s of speech ("try again", not an attempt — spec edge case).
- **Rationale**: Tiny (~2 MB), fast on CPU, MIT-licensed, widely used.
- **Alternatives**: WebRTC VAD (less accurate in noise); energy threshold (fragile).

## R5. Speech recognition (word accuracy + fluency)

- **Decision**: NVIDIA Parakeet TDT 0.6B v2 (English, CC-BY-4.0), int8 ONNX export run through
  sherpa-onnx, which returns token/word timestamps. Word accuracy = alignment of recognized vs.
  expected words (normalized edit distance); fluency = speech rate and pause statistics from
  timestamps versus level-appropriate targets.
- **Rationale**: Strong English accuracy with timestamps and CPU-friendly int8 builds exist
  (`csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8`). English-only v2 is enough since the
  app is American-English-only.
- **Alternatives**: Whisper small/medium (slower on CPU, hallucinates on short clips);
  Parakeet v3 multilingual (bigger, unnecessary). **Risk**: int8 CPU latency unverified — the
  first task is a latency spike against SC-003 (≤5 s for 95% of clips).

## R6. Phoneme-level scoring and IPA

- **Decision**: `facebook/wav2vec2-lv-60-espeak-cv-ft` exported to ONNX (int8) as a CTC phoneme
  recognizer. Expected phonemes come from espeak-ng (`en-us`) for the exact target text.
  Per-sound score = GOP-style posterior from CTC logits over a forced alignment (CTC Viterbi
  implemented in NumPy), plus substitution/deletion flags from an edit-distance alignment of
  recognized vs. expected phonemes. espeak's phoneme set is mapped to the app's ~40-sound IPA
  hint table (versioned data file shared with the web app).
- **Rationale**: This model outputs espeak-style IPA labels directly, the common open choice for
  mispronunciation detection; it has no language model, so it doesn't "fix" learner errors.
  Using espeak-ng for both expected phonemes and stored IPA keeps everything deterministic
  (Principle II).
- **Alternatives**: Kaldi GOP (heavy toolchain); Montreal Forced Aligner (slow, extra deps);
  closed pronunciation APIs (Principle I; audio leaves our infra).

## R7. Score combination and calibration

- **Decision**: Recording score (0–100) = 0.5 × phoneme accuracy + 0.3 × word accuracy + 0.2 ×
  fluency; weights in config. The 2–3 lowest-scoring sounds (by mean per-sound score, minimum 2
  occurrences or 1 if fewer exist) are returned. Calibration: a labeled reference set of ≥100
  paired recordings (good vs. poor) tunes weights to meet SC-005 (≥85% correct pair ranking).
  The set is built **outside the app** — from the project owner and volunteers who explicitly
  consent to a separate calibration collection, plus public CC-licensed L2-English corpora
  (e.g., speechocean762) — and never from in-app learner recordings.
- **Rationale**: Phoneme accuracy matters most for chunk pronunciation; weights are tunable
  without code changes. Sourcing calibration audio outside the app keeps the constitution's
  rule that learner recordings are deleted immediately after scoring absolute.
- **Alternatives**: Learned regressor (needs much more labeled data).

## R8. Audio transport and immediate deletion

- **Decision**: Browser records with MediaRecorder, choosing the first supported type via
  `isTypeSupported` (`audio/webm;codecs=opus`, then `audio/mp4` — iOS Safari may produce
  MP4/AAC) and reporting the recorder's actual `mimeType`; ≤15 s per item, typically <150 KB.
  It uploads to a Next.js route handler, which streams the bytes in memory to the scoring
  service over HTTPS with an HMAC-signed request. The scoring service decodes from a seekable
  in-memory buffer with PyAV (`BytesIO`; required for non-fragmented MP4, which ffmpeg cannot
  read from a pipe), never touching disk, and drops buffers in a `finally` block. The first
  scoring spike includes clips recorded on real iOS Safari and Android Chrome. No audio is ever written to disk, object storage, logs, or the database.
  Request logging excludes bodies.
- **Rationale**: Short clips fit well under Vercel's request-body limit; a single trusted path
  means scores can't be forged by the client; no persistence satisfies FR-019/FR-020.
- **Alternatives**: Direct browser → scoring service upload with signed tokens (fewer hops but
  requires signed results and CORS; revisit if latency demands); storing audio temporarily in
  Spaces (violates immediate deletion).

## R9. Text-to-speech

- **Decision**: ElevenLabs Flash v2.5 (`eleven_flash_v2_5`), 4–6 curated American-English voices.
  Audio is generated only on first play and requested **by reference, never by raw text**
  (`?ref=chunk:<id>`, `example:<id>`, `sentence:<writingResultId>`), so learner text never
  appears in URLs or request logs. Library chunk/example audio is shared: stored under
  `tts/shared/<sha256(text+voice+model)>` and served via CDN with long cache headers. Audio of a
  learner's corrected sentences is private to them: stored under `tts/u/<userId>/…`, served
  through short-lived signed URLs, and deleted in the account-deletion cascade (FR-008).
  Concurrent first plays are de-duplicated with a DB row lock on the audio-clip record.
- **Rationale**: Constitution Principle V (lazy, cached, cheapest tier). TTS is a peripheral
  concern under Principle I; text falls back to IPA display if TTS fails.
- **Alternatives**: Open-source TTS (Kokoro/Piper) on the Droplet — viable future swap behind
  the `TtsProvider` interface, but American voice quality and CPU contention with scoring made
  ElevenLabs the pragmatic default.

## R10. Web framework, UI, and charts

- **Decision**: Next.js 16 (App Router, React 19, Server Components + Server Actions + Route
  Handlers), TypeScript strict, Tailwind CSS v4 with shadcn/ui (Radix primitives for
  accessibility), `next-themes` for light/dark/system, Recharts for progress charts, palette
  tokens from the constitution.
- **Rationale**: Matches constitution stack; Radix gives keyboard/ARIA behavior needed for
  WCAG 2.2 AA; shadcn components are copied into the repo (no runtime lock-in).
- **Alternatives**: Separate Node API server (extra deployable — rejected per Principle VII;
  Next.js route handlers are the Node.js backend).

## R11. Authentication

- **Decision**: Better Auth with the Drizzle adapter: email + password (email verification and
  password reset via Resend), Google OAuth (no automatic same-email linking: an existing password account must be proven by
  signing in with its password before Google is linked — spec edge case), admin
  plugin (roles, ban/suspend), built-in rate limiting on auth endpoints. Sessions in Postgres
  with HTTP-only secure cookies. Username plugin for unique usernames.
- **Rationale**: TypeScript-first, self-hosted (user data stays in our DB), first-class Drizzle +
  Next.js support; community reports on DEV favor it over Auth.js for this exact stack.
- **Alternatives**: Auth.js (weaker email/password + verification story); Clerk/Auth0 (hosted,
  costs, user data off-platform); Neon Auth (ties auth to DB vendor).

## R12. Database and ORM

- **Decision**: Neon Postgres (free tier) with Drizzle ORM and drizzle-kit migrations; `pg_trgm`
  extension for fuzzy chunk duplicate detection and library search; `@neondatabase/serverless`
  driver in production, PGlite (in-process Postgres with `pg_trgm`) for unit/integration tests.
- **Rationale**: Typed schema (Principle VII), SQL-first, fast tests without network or keys
  (Principle III).
- **Alternatives**: Prisma (heavier engine, slower cold starts); vector embeddings for duplicates
  (overkill; trigram + normalization meets SC-010 for short phrases).

## R13. Duplicate-chunk detection

- **Decision**: Normalize (lowercase, strip punctuation, expand contractions, replace slot
  markers like "[do something]"/"someone" with a token, lemmatize simple verb forms with a small
  rules table). Exact match on normalized text → duplicate; trigram similarity ≥ 0.6 → "similar"
  suggestions (top 3). Threshold tuned on a test set of known near-duplicates to meet SC-010.
- **Rationale**: Deterministic, explainable, cheap.
- **Alternatives**: Embedding similarity (extra model + cost; can be added later).

## R14. Scheduled work (reminders, trial expiry, billing reconciliation)

- **Decision**: A systemd timer on the scoring Droplet calls `POST /api/cron/hourly` on the web
  app every hour with a bearer secret. The handler sends reminder emails to learners whose local
  reminder hour matches and who have no practice today, and expires waitlist invitations.
  Vercel Cron (once daily on Hobby) runs `POST /api/cron/daily` for housekeeping.
- **Rationale**: Vercel Hobby limits cron jobs to daily; per-user local reminder times need
  hourly granularity. The Droplet already exists, so no new service is added.
- **Alternatives**: Vercel Pro cron (costs $20/month during free testing — rejected per
  Principle V; switch when billing goes live and the plan is upgraded anyway); external cron
  SaaS (extra vendor).

## R15. Email

- **Decision**: Resend with React Email templates for verification, password reset, reminders,
  chunk decisions, waitlist invitations, billing notices. Reminder emails include an
  RFC 8058 one-click `List-Unsubscribe` header and a signed unsubscribe link.
- **Rationale**: Constitution stack; one-click unsubscribe meets mailbox-provider rules and
  FR-033.

## R16. Billing

- **Decision**: The 7-day trial is **app-managed**: learners who register after activation get
  `trialing` status with `trial_ends_at = sign-up + 7 days` and the Basic limit, with no Stripe
  interaction and no card required. Subscribing (during or after the trial) uses Stripe Billing
  hosted Checkout in subscription mode **without** `trial_period_days`, plus the hosted Customer
  Portal for plan changes and cancellation.
  Webhooks (`checkout.session.completed`, `customer.subscription.created|updated|deleted`,
  `invoice.payment_failed`) are signature-verified and idempotent (event id stored). Admin
  views read payment-method summaries (brand, last4, expiry) from Stripe; nothing card-related
  is stored except those display fields. A DB setting `billing_active` gates every billing path;
  while false, no Stripe calls are made. Standard/Premium prices exist in Stripe test mode only
  until activation.
- **Rationale**: Principle IV (no card data, verified webhooks); spec FR-061–FR-063.
- **Alternatives**: Stripe Elements embedded forms (more PCI surface); Lemon Squeezy (merchant
  of record, but constitution names Stripe).
- **Note**: Vercel Hobby is for non-commercial use; the deployment must move to Vercel Pro before
  `billing_active` is switched on. This is part of the go-live checklist.

## R17. Object storage and profile pictures

- **Decision**: DigitalOcean Spaces (S3-compatible, `@aws-sdk/client-s3`) with two prefixes:
  `tts/` (public-read via CDN) and `avatars/` (public-read, random UUID keys). Uploads go to a
  route handler that validates MIME by magic bytes, rejects >5 MB, and uses `sharp` to
  auto-orient, strip metadata (EXIF/GPS), center-crop to 512×512, and encode WebP.
- **Rationale**: One storage vendor; metadata stripping protects privacy.

## R18. Time zones and "practice day"

- **Decision**: Store the learner's IANA time zone (defaulted from the browser at sign-up). A
  practice's `practice_date` is the local date at session start (spec edge case). Streaks and
  daily limits use `practice_date`. Library uses `date-fns-tz`.

## R19. Testing strategy

- **Decision**:
  - Web unit + integration: Vitest with PGlite (real SQL, migrations applied), MSW for
    AI Gateway / ElevenLabs / Resend / Stripe / scoring-service HTTP mocks, Stripe webhook
    fixtures signed with a test secret.
  - Contract tests: scoring-service OpenAPI validated against both the FastAPI app (schemathesis)
    and the web client's Zod schemas.
  - E2E: Playwright on Chromium with `--use-fake-device-for-media-stream` and
    `--use-file-for-fake-audio-capture` (pre-recorded synthetic TTS clips, not human voices),
    mocked external services, `@axe-core/playwright` on every page (SC-011).
  - Scoring service: pytest with synthetic audio fixtures; a separate, opt-in calibration suite
    runs against the reference feature set (SC-005).
  - Deletion audit test: asserts no audio in tmp dirs, logs, storage, or DB after scoring
    success and failure (SC-008).
- **Rationale**: Principle III — suites run offline without real keys.

## R20. Observability and availability

- **Decision**: Best-effort availability during testing (no SLA). Structured JSON logs (pino in
  web, `structlog` in scoring) with request ids propagated web → scoring; never log audio,
  sentences' personal content beyond ids, emails, or tokens. Vercel runtime logs + a
  `/healthz` endpoint on the scoring service monitored by a free uptime check. LLM/TTS usage
  per day is recorded in a `usage_counters` table and shown on the admin dashboard.
- **Rationale**: Covers the clarify-session deferrals with minimal cost.

---

## Community Wisdom (DEV)

- "Full Stack Authentication in 2026 with Better Auth, Drizzle, Neon, Shadcn UI, and Next.js" —
  @iampandit — https://dev.to/iampandit/full-stack-authentication-in-2026-with-better-auth-drizzle-neon-shadcn-ui-and-nextjs-32nb
  (the exact auth stack chosen in R11/R12).
- "NextAuth.js to Better Auth: Why I Switched Auth Libraries" — @pipipi-dev —
  https://dev.to/pipipi-dev/nextauthjs-to-better-auth-why-i-switched-auth-libraries-31h3
- "Carific.ai: Building a Production-Ready Auth System with Next.js 16, Better Auth, and
  TanStack Form" — @abdullahjan —
  https://dev.to/abdullahjan/building-a-production-ready-auth-system-with-nextjs-16-better-auth-and-tanstack-form-10mi

## Sources

- Vercel changelog, "Gemma 4 on AI Gateway": https://vercel.com/changelog/gemma-4-on-ai-gateway
- sherpa-onnx Parakeet TDT 0.6B v2 int8: https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8
- OpenPronounce (wav2vec2 espeak + espeak-ng alignment): https://github.com/Halleck45/OpenPronounce
- "Evaluating Logit-Based GOP Scores for Mispronunciation Detection": https://arxiv.org/pdf/2506.12067
- "Enhancing GOP in CTC-Based Mispronunciation Detection with Phonological Knowledge": https://arxiv.org/pdf/2506.02080
- Vercel AI Gateway, gpt-oss-20b: https://vercel.com/ai-gateway/models/gpt-oss-20b
- iPhone Safari MediaRecorder formats (feature-detect, WebM/MP4): https://www.buildwithmatija.com/blog/md/iphone-safari-mediarecorder-audio-recording-transcription
- WebKit MediaRecorder MIME handling: https://bugs.webkit.org/show_bug.cgi?id=290002

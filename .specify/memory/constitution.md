# EnglishChunks.guru Constitution

## Core Principles

### I. Open-Source AI at the Core (NON-NEGOTIABLE)

The learning loop of EnglishChunks.guru MUST be powered by open-weight models and open-source
tooling. Specifically:

- Daily chunk selection, example generation, writing grades, and learner tips MUST run on an
  open-weight LLM (Gemma family, currently Gemma 4 26B A4B via Vercel AI Gateway).
- Speech scoring MUST run on self-hosted open models (Silero VAD, Parakeet ASR, wav2vec2
  phoneme recognition) on infrastructure the project controls.
- Closed/proprietary services (ElevenLabs TTS, Resend email, Stripe billing) are permitted only
  for peripheral concerns and MUST NOT be required for the core "learn → speak → write → score"
  loop to produce a result.
- Every model integration MUST sit behind a provider-agnostic interface so a model can be
  swapped (or run locally) through configuration, without changing feature code.

Rationale: the project exists to demonstrate that open innovation can deliver a real learning
product — learners' voice data stays on infrastructure we control, and models can be tuned,
swapped, or self-hosted at near-zero marginal cost.

### II. Deterministic Pedagogy, Generated Warmth

Facts that teach MUST be deterministic and curated; LLMs supply tone, not truth.

- The IPA-to-friendly-hint mapping (~40 English sounds) MUST live in the application as a
  versioned data table. LLMs MUST NOT generate or alter pronunciation hints; they only wrap the
  table's hint in a warm, personal message.
- Pronunciation scores (0–100) MUST be computed by the speech pipeline (VAD → ASR word accuracy
  and fluency → phoneme comparison → combined score). LLMs MUST NOT invent or adjust numeric
  scores.
- Every chunk in the library MUST carry a CEFR level (A1–C2), a chunk type (collocation, idiom,
  polyword, vague language, sentence frame, verb pattern, discourse marker), a register
  (casual, academic, professional), a meaning, usage guidance, and three examples.
- The preloaded library targets ~1,000 chunks spanning A1–C2; this size is a goal, not a hard
  requirement. Every preloaded chunk MUST be audited by an independent low-cost model and pass
  schema validation before import. User-submitted chunks MUST be de-duplicated
  against the library (exact and near matches) and approved by an admin before publication.
- All learner-facing pronunciation audio and models MUST target American English.

Rationale: learners trust what the app tells them about sounds and scores; consistency and
correctness cannot depend on non-deterministic generation.

### III. Test-First Quality Gates (NON-NEGOTIABLE)

- Every change MUST be accompanied by automated tests: unit tests for logic, integration tests
  for service boundaries (Next.js ↔ scoring service, AI Gateway, ElevenLabs, Stripe, Resend,
  database), and end-to-end tests for user-facing flows (sign-up, daily session, progress,
  admin CRUD).
- External services MUST be mockable in tests; the test suite MUST run without real API keys
  or network access to paid providers.
- The full test suite MUST pass before any merge or deployment.
- Speech-scoring quality MUST be validated against a labeled reference set of recordings before
  the scoring service is exposed to learners, and re-validated whenever a speech model,
  quantization, or score formula changes.

Rationale: the product combines many external services and ML components; only automated
verification keeps changes safe.

### IV. Security, Privacy & Payment Safety

- Secrets (API keys, tokens, database URLs, webhook secrets) MUST NOT be committed to any
  repository. They MUST be supplied via platform environment variables; an `.env.example`
  with placeholder names only is permitted.
- Registration and password resets MUST require email verification (Resend). Passwords MUST
  be stored only as salted, slow hashes; Google OAuth is the only other permitted sign-in.
- Card data MUST never touch our servers: payments use Stripe Billing hosted surfaces
  (Checkout / Customer Portal). Stripe webhooks MUST verify signatures and be idempotent.
- Real charges MUST remain disabled until an admin explicitly activates the paid period; until
  then only free sign-up with the Basic plan is available, and the demo account and Stripe
  flow MUST be validated in test mode before go-live.
- Admin routes and APIs MUST enforce role-based authorization server-side.
- Learner voice recordings MUST be used only for scoring and MUST NOT be sent to third-party
  services. Raw audio MUST be deleted (from memory, temp files, and any storage) as soon as its
  score is computed, including when scoring fails; only derived results (scores, transcripts
  of words, per-sound results) may be persisted.
- Uploaded profile pictures MUST be validated (type, size), normalized, and stored in object
  storage — never served from user-provided URLs.

Rationale: the app handles personal data, voice biometrics-adjacent audio, and payments.

### V. Cost-Conscious by Default

- Text-to-speech MUST be generated lazily (only when a learner presses play) and cached per
  sentence and voice in object storage (DigitalOcean Spaces); cached audio MUST be reused.
- The cheapest adequate model tier MUST be the default (e.g., ElevenLabs Flash, the lowest-cost
  Gemma variant); a more expensive tier requires a documented justification in the plan.
- Speech models SHOULD be quantized (ONNX int8) to fit the smallest viable Droplet.
- Free/hobby tiers (Vercel Hobby, Neon free) MUST be used while the app is in friends-and-family
  testing with no payments.
- Per-plan daily practice limits (Basic 1, Standard 3, Premium 5 + 1 conversation) MUST be
  enforced server-side to bound per-user AI spend.

Rationale: the service is free during testing; runaway inference or TTS spend would end it.

### VI. Learner-First, Inclusive Design

- UI MUST be responsive and fully usable on mobile, tablet, and desktop.
- UI MUST meet WCAG 2.2 AA (contrast, keyboard navigation, focus states, captions/labels for
  audio controls) and support light and dark mode.
- Visual design MUST follow the Figma source of truth and the project palette
  (#5DFDCB, #7CC6FE, #F4FAFF, #8789C0, #08090A); missing screens are designed consistently
  with them.
- Copy and feedback MUST be friendly, encouraging, and plain enough for learners of all ages,
  backgrounds, and levels, adapting to the learner's CEFR level.

Rationale: the audience is English learners worldwide; confusion or exclusion defeats the
product's purpose.

### VII. Type Safety & Simplicity

- TypeScript (strict mode) MUST be used for all frontend and Node.js backend code. Python is
  permitted only for the speech scoring service, where the ML ecosystem requires it.
- Contracts between services (scoring API, AI prompts/structured outputs, webhooks) MUST be
  defined with typed, validated schemas (e.g., Zod / Pydantic).
- Start simple (YAGNI): no new service, framework, or abstraction layer without a documented
  need in the plan's Complexity Tracking.

Rationale: a small team and a hackathon timeline reward predictable, typed, minimal systems.

## Technology & Platform Constraints

- **Web app**: Next.js (App Router) + TypeScript, deployed on Vercel.
- **LLM**: Gemma 4 26B A4B via Vercel AI Gateway; a separate low-cost model for chunk auditing.
- **Speech scoring**: FastAPI service on a DigitalOcean CPU Droplet running Silero VAD,
  Parakeet, and wav2vec2 (quantized ONNX where possible).
- **TTS**: ElevenLabs (Flash model, American voices, user-selectable voice).
- **Database**: PostgreSQL on Neon (users, profiles, chunks, attempts, scores, streaks,
  subscriptions).
- **Object storage**: DigitalOcean Spaces for cached TTS audio and profile pictures.
- **Email**: Resend (verification, password reset, chunk-approval notifications).
- **Billing**: Stripe Billing (test mode until admin activation).
- Changes to this stack require a constitution amendment if they affect Principle I, or a
  justified entry in the feature plan otherwise.

## Development Workflow & Quality Gates

- Work follows the Spec Kit flow: specify → clarify → plan → tasks → implement. Each plan MUST
  include a Constitution Check that evaluates all seven principles and records any justified
  exception in Complexity Tracking.
- Every change MUST pass: type-check, lint, unit/integration/e2e tests, and a secret scan
  before merge or deploy.
- Features touching scoring, payments, authentication, or admin authorization MUST be reviewed
  against Principles II–IV explicitly.
- Build decisions that demonstrate the open-source approach (model choices, trade-offs vs.
  closed alternatives, where open models worked better) SHOULD be recorded as they happen, to
  support the project write-up; saving agent sessions (e.g., via DevRelay) is encouraged.

## Governance

- This constitution supersedes all other practices and guidance in the repository. Where a
  spec, plan, or task conflicts with it, the constitution wins until amended.
- Amendments are made via `/speckit-constitution`, MUST include a Sync Impact Report, a
  version bump, and an updated Last Amended date, and MUST note any migration needed for
  in-flight specs and plans.
- Versioning follows semantic versioning: MAJOR for removing or redefining a principle, MINOR
  for adding a principle or materially expanding guidance, PATCH for clarifications and wording.
- Compliance is reviewed at every plan's Constitution Check, at `/speckit-analyze`, and during
  code review; unjustified violations block merge.

**Version**: 1.1.0 | **Ratified**: 2026-10-16 | **Last Amended**: 2026-10-16

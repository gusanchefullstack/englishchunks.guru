# Web App Interface Contract

**Spec**: [../spec.md](../spec.md) | **Data model**: [../data-model.md](../data-model.md)

The web app exposes UI pages, Server Actions (called from React forms/components), and Route
Handlers (HTTP endpoints for binary data, webhooks, and cron). All inputs are validated with Zod
schemas in `web/src/lib/contracts/`; those schemas are the source of truth and are imported by
both handlers and tests.

Common rules:
- Auth: Better Auth session cookie. "learner" = any verified, active user; "admin" = role admin.
  Authorization is checked server-side on every action (FR-050).
- Errors: `{ error: { code: string, message: string } }` with codes `unauthenticated`,
  `forbidden`, `validation`, `limit_reached`, `not_found`, `conflict`, `unavailable`,
  `billing_inactive`.
- Every mutating action records usage/audit where relevant; no audio is ever persisted.

## Pages (App Router)

| Route | Access | Purpose | Stories |
|-------|--------|---------|---------|
| `/` | public | Landing: chunks explainer, video, plans, CTA | US7 |
| `/sign-up`, `/sign-in`, `/verify-email`, `/reset-password`, `/waitlist` | public | Auth, waitlist | US2, US7 |
| `/onboarding/level` | learner (no level) | Level selection | US2 |
| `/today` | learner | Daily session (stepper) | US1 |
| `/practice/[sessionId]` | owner | Session in progress (daily or library) | US1, US4 |
| `/progress` | learner | Chart, streaks, points, ranking | US3 |
| `/library`, `/library/[chunkId]` | learner | Search, filter, launch practice | US4 |
| `/submit-chunk`, `/my-submissions` | learner | Submissions | US5 |
| `/profile` | learner | Profile, picture, voice, theme, reminders, ranking visibility, delete account | US2 |
| `/billing` | learner | Plan status; Checkout/Portal links (only when billing active) | US8 |
| `/admin`, `/admin/users`, `/admin/users/[id]`, `/admin/chunks`, `/admin/submissions`, `/admin/waitlist`, `/admin/settings` | admin | Admin area | US6, US8 |

## Server Actions

### Profile & account (US2)

| Action | Input | Output / Effect |
|--------|-------|-----------------|
| `setLevel` | `{ level: CEFR | "beginner"|"intermediate"|"advanced" }` | maps band → A2/B1/C1; applies from next daily chunk |
| `updateProfile` | `{ displayName?, motherTongue?, timeZone?, voiceId?, theme?, rankingVisible?, remindersEnabled?, reminderHour? }` | updated profile |
| `deleteAccount` | `{ confirm: "DELETE" }` | cancels Stripe sub, deletes avatar, private sentence audio, and data, signs out (FR-008) |

### Daily session (US1, US4)

| Action | Input | Output / Effect |
|--------|-------|-----------------|
| `startDailySession` | — | existing today's daily session or new one; `limit_reached` if none left |
| `startLibrarySession` | `{ chunkId }` | new session; `limit_reached` if plan limit used (FR-042) |
| `getSession` | `{ sessionId }` | chunk, examples, IPA, step, prior results |
| `advanceStep` | `{ sessionId, from: step }` | next step (forward-only, idempotent) |
| `skipSpeaking` | `{ sessionId, reason: "no_microphone" }` | marks partial (edge case) |
| `submitWriting` | `{ sessionId, sentences: [string, string, string] }` (1–300 chars each) | 3 × `WritingFeedback` (see llm-outputs.md) |
| `completeSession` | `{ sessionId }` | daily score, streak, points awarded |

### Library & submissions (US4, US5)

| Action | Input | Output |
|--------|-------|--------|
| `searchChunks` | `{ q?, level?, type?, register?, cursor? }` | page of chunks (20) |
| `checkChunkDuplicate` | `{ text }` | `{ exact?: Chunk, similar: Chunk[] (≤3) }` |
| `submitChunk` | `{ text, meaning?, example?, acknowledgeSimilar: boolean }` | submission (pending or merged) |

### Admin (US6, US8)

| Action | Input | Output / Effect |
|--------|-------|-----------------|
| `adminListUsers` | `{ q?, plan?, status?, level?, cursor? }` | rows per FR-051 |
| `adminGetUser` | `{ userId }` | detail incl. subscription and payment-method summary (FR-052) |
| `adminCreateUser` / `adminUpdateUser` | user fields | user |
| `adminSuspendUser` / `adminDeleteUser` | `{ userId }` | audit-logged |
| `adminUpsertChunk` / `adminRetireChunk` | chunk fields | chunk (IPA recomputed via `/v1/phonemize`) |
| `adminDecideSubmission` | `{ submissionId, decision: "accept"|"reject", edits?, reason? }` | notify + points on accept (FR-044) |
| `adminSetBilling` | `{ active: boolean, confirm: "ACTIVATE"|"DEACTIVATE" }` | on activation marks existing users `early_tester` (FR-063) |
| `adminSetAccountCap` | `{ cap: int ≥ 0 }` | FR-055 |
| `adminInviteFromWaitlist` | `{ entryIds: uuid[] }` | emails invites (7-day tokens) |

## Route Handlers

| Method & path | Access | Request | Response |
|---------------|--------|---------|----------|
| `POST /api/sessions/{id}/attempts` | owner | `multipart/form-data`: `audio` (≤1 MB, ≤15 s), `step`, `item`, `mimeType`. Optional `Accept: application/x-ndjson` (see below). | `200 AttemptResult` `{ kind: "scored", score, components, weakestSounds:[{ipa, hint, exampleWords}], tip, improvement }` · `422 { kind: "unusable", reason }` (retry, not counted) · `503` (retry). Audio is streamed in memory to the scoring service and discarded. |
| `GET /api/tts?ref=…` | learner | `ref` = `chunk:<id>`, `example:<id>`, or `sentence:<writingResultId>` (own sentences only); voice from profile. Raw text is never accepted in the URL. | `302` to CDN URL (shared) or short-lived signed URL (private sentence audio); generates on first request (FR-012) |
| `POST /api/profile/avatar` | learner | `multipart/form-data`: `image` (jpeg/png/webp/heic, ≤5 MB) | `{ imageUrl }` (512×512 WebP, metadata stripped) |
| `POST /api/billing/checkout` | learner | `{ tier }` | `{ url }` Stripe Checkout; `409 billing_inactive` if off |
| `POST /api/billing/portal` | learner with customer | — | `{ url }` Stripe Customer Portal |
| `POST /api/webhooks/stripe` | Stripe | raw body + `Stripe-Signature` | `200` after idempotent processing; `400` on bad signature |
| `POST /api/cron/hourly` | Droplet timer | `Authorization: Bearer CRON_SECRET` | sends due reminders (≤1/user/day), expires invites |
| `GET` or `POST /api/cron/daily` | Vercel Cron | `Authorization: Bearer CRON_SECRET` | housekeeping (abandon stale sessions, usage rollup) |
| `GET /api/unsubscribe?token=…` and `POST` (RFC 8058 one-click) | public | signed token | turns reminders off without sign-in |

### Streamed attempt result (`Accept: application/x-ndjson`)

So learners don't wait for the LLM (SC-003), the session UI asks for a stream. The response is
`200` with `Content-Type: application/x-ndjson`, one JSON object per line:

1. The scored result as soon as scoring finishes: `{ kind: "scored", …, tip: null }`. The
   attempt is already stored (with a plain fallback tip) and the curated hints are final.
2. Mina's tip once the LLM answers: `{ kind: "tip", tip }`; the stored attempt is updated.

If the stream ends without line 2 (LLM unavailable), the client keeps a plain message. Errors and
unusable recordings never start a stream: they answer as plain JSON with their usual status
codes. Without that `Accept` header the route returns the single `AttemptResult` above.
| `/api/auth/*` | public | Better Auth | sign-up (requires `ageConfirmed: true`, cap/invite check), sign-in, Google OAuth, verify, reset |

## Sign-up gate (FR-007, FR-055)

```text
allow sign-up iff ageConfirmed == true
  AND ( app_setting.billing_active
        OR count(active users) < app_setting.account_cap
        OR valid unexpired waitlist invite token )
else → offer waitlist (email only)
```

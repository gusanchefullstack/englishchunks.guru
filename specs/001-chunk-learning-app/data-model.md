# Phase 1 Data Model: EnglishChunks.guru — Chunk Learning App (MVP)

**Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Postgres (Neon), defined with Drizzle. All ids are UUID v7 unless noted. All timestamps are
`timestamptz` (UTC). `created_at` / `updated_at` exist on every table and are omitted below.
Tables owned by Better Auth (`user`, `session`, `account`, `verification`) are extended, not
replaced.

**No table stores audio.** Learner recordings exist only in memory during scoring (FR-019).

---

## Enums

| Enum | Values |
|------|--------|
| `cefr_level` | `A1`, `A2`, `B1`, `B2`, `C1`, `C2` |
| `level_band` | `beginner` (A1–A2), `intermediate` (B1–B2), `advanced` (C1–C2) — derived, not stored |
| `chunk_type` | `collocation`, `idiom`, `polyword`, `vague_language`, `sentence_frame`, `verb_pattern`, `discourse_marker` |
| `register` | `casual`, `academic`, `professional` |
| `example_register` | `casual`, `professional` |
| `user_role` | `learner`, `admin` |
| `user_status` | `pending_verification`, `active`, `suspended` |
| `theme` | `light`, `dark`, `system` |
| `plan_tier` | `basic`, `standard`, `premium` |
| `subscription_status` | `none`, `free_basic`, `trialing`, `active`, `past_due`, `canceled`, `expired` |
| `session_origin` | `daily`, `library` |
| `session_step` | `learn`, `speak_1`, `speak_2`, `write`, `read_aloud`, `done` |
| `session_status` | `in_progress`, `completed`, `abandoned` |
| `attempt_item` | `chunk`, `example_1`, `example_2`, `example_3`, `sentence_1`, `sentence_2`, `sentence_3` |
| `chunk_source` | `curated`, `submitted` |
| `audit_status` | `pending`, `passed`, `failed`, `admin_approved` |
| `chunk_status` | `active`, `retired` |
| `submission_status` | `pending`, `accepted`, `rejected`, `merged` |
| `points_reason` | `session`, `streak_milestone`, `submission_accepted`, `admin_adjustment` |
| `notification_type` | `submission_accepted`, `submission_rejected`, `reminder`, `billing`, `system` |
| `notification_channel` | `in_app`, `email` |
| `waitlist_status` | `waiting`, `invited`, `registered`, `expired` |

---

## user (Better Auth core, extended)

| Field | Type | Rules |
|-------|------|-------|
| id | text (Better Auth id) | PK |
| email | text | unique, required, lowercased |
| email_verified | boolean | must be true before practice for password accounts (FR-002) |
| username | text | unique, 3–24 chars, `[a-z0-9_]`, case-insensitive unique |
| display_name | text | 1–40 chars, shown in rankings |
| role | `user_role` | default `learner` |
| status | derived | not stored: `pending_verification` = `email_verified` false; `suspended` = admin-plugin `banned`; else `active` (avoids two sources of truth) |
| age_confirmed_at | timestamptz | required (FR-007: self-declared 16+) |
| level | `cefr_level` | nullable until onboarding; required to start a session (FR-003) |
| mother_tongue | text | ISO 639-1 code, nullable |
| time_zone | text | IANA tz, default from browser (R18) |
| image_key | text | Spaces key under `avatars/`, nullable |
| voice_id | text | FK → `voice.id`, default voice |
| theme | `theme` | default `system` |
| ranking_visible | boolean | default true (FR-032) |
| reminders_enabled | boolean | default true (FR-033) |
| reminder_hour | smallint | 0–23 local, default 19 |
| early_tester | boolean | set true for all users when billing is activated (FR-063) |
| total_points | integer | denormalized sum of `points_ledger`, ≥ 0 |
| current_streak | integer | ≥ 0 |
| longest_streak | integer | ≥ current_streak |
| last_practice_date | date | local date of last completed practice |
| last_active_at | timestamptz | admin list (FR-051) |

Deletion (FR-008): hard delete cascades to sessions, attempts, writing results, ledger,
notifications, subscription record; avatar object deleted from Spaces; Stripe subscription
cancelled first; private TTS objects under `tts/u/<userId>/` deleted from Spaces; accepted
submissions keep the chunk with `submitted_by` set to NULL.

## session / account / verification (Better Auth)

Used as provided. `account` holds Google links and password hashes (scrypt by Better Auth).
`verification` holds email-verification and password-reset tokens (single-use, 1 h expiry).

## voice

| Field | Type | Rules |
|-------|------|-------|
| id | text | PK (slug, e.g. `us-female-warm`) |
| provider_voice_id | text | TTS provider id |
| label | text | shown to learners |
| gender | text | for mixed selection (FR-006) |
| active | boolean | at least 4 active |

## chunk

| Field | Type | Rules |
|-------|------|-------|
| id | uuid | PK |
| text | text | 1–80 chars, display form (e.g. "look forward to [doing]") |
| normalized_text | text | unique among `active` chunks (R13); trigram GIN index |
| type | `chunk_type` | required |
| level | `cefr_level` | required, indexed |
| registers | `register`[] | ≥ 1 |
| meaning | text | 1–300 chars |
| usage_note | text | "when to use it", 1–400 chars |
| ipa | text | from espeak-ng (R6), never LLM-generated |
| source | `chunk_source` | |
| submitted_by | text | FK → user.id, nullable, `ON DELETE SET NULL` |
| audit_status | `audit_status` | only `passed`/`admin_approved` chunks are practicable |
| audit_notes | jsonb | auditor findings |
| status | `chunk_status` | default `active` |

Search index: `tsvector` on `text || meaning` plus trigram on `normalized_text` (FR-041).

## chunk_example

| Field | Type | Rules |
|-------|------|-------|
| id | uuid | PK |
| chunk_id | uuid | FK → chunk, cascade |
| position | smallint | 1–3, unique per chunk (exactly 3 per chunk) |
| text | text | 1–200 chars, must contain the chunk (validated by normalized match) |
| register | `example_register` | |
| ipa | text | espeak-ng |

## sound_hint (curated, versioned — Principle II)

| Field | Type | Rules |
|-------|------|-------|
| ipa_symbol | text | PK (e.g. `θ`, `æ`, `ɹ`) |
| espeak_symbols | text[] | mapping from recognizer labels |
| hint | text | plain-language tip, ≤ 160 chars |
| example_words | text[] | 2–4 words |
| version | integer | table version, bumped on any edit |

Seeded from `web/src/content/sound-hints.json` (the source of truth, reviewed via PR); ~40 rows.

## audio_clip (TTS cache)

| Field | Type | Rules |
|-------|------|-------|
| cache_key | text | PK, `sha256(normalizedText + voice.provider_voice_id + model)` (+ owner id when private) |
| owner_id | text | FK → user, cascade; NULL for shared chunk/example audio, set for a learner's corrected-sentence audio |
| text | text | |
| voice_id | text | FK → voice |
| storage_key | text | `tts/shared/…` (public CDN) or `tts/u/<userId>/…` (private, signed URLs) |
| status | text | `generating` / `ready` / `failed` |
| byte_size | integer | |

Row-level lock on insert de-duplicates concurrent first plays (R9).

## practice_session

| Field | Type | Rules |
|-------|------|-------|
| id | uuid | PK |
| user_id | text | FK → user, cascade |
| chunk_id | uuid | FK → chunk |
| origin | `session_origin` | |
| practice_date | date | learner-local date at start (R18) |
| step | `session_step` | advances only forward: learn → speak_1 → speak_2 → write → read_aloud → done |
| status | `session_status` | |
| counts_toward_limit | boolean | false if abandoned due to service error (spec assumption) |
| speak_1_score / speak_2_score / write_score / read_aloud_score | smallint | 0–100, nullable |
| daily_score | smallint | 0–100, set at `done`; weights from `app_setting.score_weights` (FR-018) |
| partial | boolean | true if any step was skipped (mic edge case) |
| started_at / completed_at | timestamptz | |

Constraints: one `daily`-origin session per user per `practice_date`; count of sessions with
`counts_toward_limit = true` per user per `practice_date` ≤ plan limit (enforced in a
transaction with `SELECT … FOR UPDATE` on the user row, FR-060). A chunk is not repeated for a
user while unpracticed chunks at their level exist (FR-010; edge case recycles least recent).

## attempt

| Field | Type | Rules |
|-------|------|-------|
| id | uuid | PK |
| session_id | uuid | FK → practice_session, cascade |
| step | `session_step` | `speak_1`, `speak_2`, or `read_aloud` |
| item | `attempt_item` | |
| expected_text | text | the target text scored |
| score | smallint | 0–100 |
| word_accuracy / phoneme_accuracy / fluency | smallint | 0–100 components |
| sound_results | jsonb | `[{ipa, score, count}]` per sound |
| weakest_sounds | text[] | 2–3 IPA symbols |
| tip | text | generated message wrapping fixed hints (FR-014) |
| hint_table_version | integer | `sound_hint.version` used |

Unique: (`session_id`, `step`, `item`) — retakes of "try again" overwrite only when the previous
one produced no score. **No audio column.**

## writing_result

| Field | Type | Rules |
|-------|------|-------|
| id | uuid | PK |
| session_id | uuid | FK, cascade |
| position | smallint | 1–3 |
| original | text | 1–300 chars; offensive text replaced by `[removed]` before storage |
| corrected | text | |
| usage_grade / grammar_grade | smallint | 0–100 |
| uses_chunk | boolean | |
| explanation | text | ≤ 1 sentence, English at learner level (FR-016a) |

## chunk_submission

| Field | Type | Rules |
|-------|------|-------|
| id | uuid | PK |
| submitted_by | text | FK → user, `ON DELETE SET NULL` |
| text / normalized_text | text | |
| proposed_meaning / proposed_example | text | optional |
| matched_chunk_ids | uuid[] | duplicates shown to learner (FR-043) |
| status | `submission_status` | `pending → accepted | rejected`; `merged` when a duplicate pending item exists (first submitter keeps credit) |
| reviewer_id | text | FK → user |
| decision_reason | text | optional on reject |
| decided_at | timestamptz | |
| resulting_chunk_id | uuid | set on accept |

## points_ledger

| Field | Type | Rules |
|-------|------|-------|
| id | uuid | PK |
| user_id | text | FK, cascade |
| reason | `points_reason` | |
| amount | integer | session: `round(daily_score / 10)`; streak milestones at 3/7/30/100 days: 5/15/50/150; accepted submission: 20 |
| ref_id | uuid | session/submission id; unique (user_id, reason, ref_id) to make awards idempotent |
| earned_at | timestamptz | weekly ranking uses ISO week in UTC |

Rankings (FR-032) are computed by query: `SUM(amount)` grouped by user, filtered by band via the
user's current `level`, excluding `ranking_visible = false` and `status != active`.

## notification

| Field | Type | Rules |
|-------|------|-------|
| id | uuid | PK |
| user_id | text | FK, cascade |
| type | `notification_type` | |
| channel | `notification_channel` | |
| message | text | |
| read_at | timestamptz | nullable (in-app only) |
| sent_on | date | for reminders: unique (user_id, type='reminder', sent_on) to guarantee ≤1/day |

## subscription

| Field | Type | Rules |
|-------|------|-------|
| user_id | text | PK, FK cascade |
| tier | `plan_tier` | default `basic` |
| status | `subscription_status` | `free_basic` while billing inactive or for early testers |
| stripe_customer_id / stripe_subscription_id | text | nullable |
| trial_ends_at / current_period_end | timestamptz | |
| cancel_at_period_end | boolean | |
| pm_brand / pm_last4 / pm_exp_month / pm_exp_year | text/smallint | display-only (FR-052) |

State transitions:

```text
billing inactive:             free_basic
billing activated (existing): free_basic + user.early_tester = true
new user after activation:    trialing (app-managed, tier = basic,
                              trial_ends_at = sign-up + 7 days; no Stripe call)
trialing → active             learner completes Checkout (no Stripe trial; first charge now)
trialing → expired            trial_ends_at passed without subscription → practice blocked
active → past_due (payment failed) → active | canceled
active → canceled (period end) → early_tester ? free_basic : expired
expired → active              learner subscribes via Checkout
```

Daily limit by tier: basic 1, standard 3, premium 5. App-managed `trialing` uses the Basic
limit (1/day) — spec assumption, see plan. `past_due` keeps the tier's limit while Stripe
retries payment; `expired` → 0.

## stripe_event

| Field | Type | Rules |
|-------|------|-------|
| id | text | PK = Stripe event id (idempotency) |
| type | text | |
| processed_at | timestamptz | |

## app_setting (singleton)

| Field | Type | Rules |
|-------|------|-------|
| id | smallint | PK = 1 |
| billing_active | boolean | default false (FR-054, FR-061) |
| billing_changed_by / billing_changed_at | text / timestamptz | audit |
| account_cap | integer | default 200 (FR-055) |
| score_weights | jsonb | `{speaking: 40, writing: 30, read_aloud: 30}` |

## waitlist_entry

| Field | Type | Rules |
|-------|------|-------|
| id | uuid | PK |
| email | text | unique, lowercased |
| status | `waitlist_status` | `waiting → invited → registered`; `invited → expired` after 7 days |
| invite_token_hash | text | sha256 of single-use token |
| invited_by / invited_at / invite_expires_at | text / timestamptz | |

Sign-up is allowed when `billing_active` OR active-account count < `account_cap` OR a valid
invite token is presented.

## usage_counter

| Field | Type | Rules |
|-------|------|-------|
| day | date | PK part |
| metric | text | PK part: `llm_tokens_in`, `llm_tokens_out`, `tts_chars`, `scoring_requests` |
| value | bigint | |

## admin_audit_log

| Field | Type | Rules |
|-------|------|-------|
| id | uuid | PK |
| actor_id | text | FK → user `ON DELETE SET NULL` |
| action | text | e.g. `user.suspend`, `billing.activate`, `chunk.accept` |
| target_id | text | |
| details | jsonb | no personal content |

---

## Relationships (summary)

```text
user 1─* practice_session 1─* attempt
                         1─* writing_result
user 1─1 subscription
user 1─* points_ledger, notification, chunk_submission(submitted_by)
chunk 1─3 chunk_example
chunk 1─* practice_session
chunk_submission *─0..1 chunk (resulting_chunk_id)
voice 1─* audio_clip
```

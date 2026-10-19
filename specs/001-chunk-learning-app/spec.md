# Feature Specification: EnglishChunks.guru — Chunk Learning App (MVP)

**Feature Branch**: `001-chunk-learning-app`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "@my-drafts/specs.md" — a web app that teaches English chunks
(collocations, idioms, polywords, vague language, sentence frames, verb patterns, discourse
markers) to ESOL learners at CEFR levels A1–C2 through a daily learn → speak → write → read-aloud
session with pronunciation scoring, writing feedback, progress tracking, a curated chunk library,
user chunk submissions, an admin area, and plan-based limits with billing that stays disabled
until an admin activates it.

## Clarifications

### Session 2026-10-16

- Q: Can learners delete their own account themselves, and what happens to their data when they do? → A: Learners can self-delete from their profile after confirmation; personal data is erased immediately and they are removed from rankings.
- Q: Should the app send learners reminders to practise when they haven't done today's session? → A: Yes — one optional daily email reminder at a learner-chosen time, sent only if they haven't practised that day; on by default, with one-click unsubscribe.
- Q: Should the ranking compare all learners together, or only learners at the same English level? → A: Ranked within level band (Beginner A1–A2, Intermediate B1–B2, Advanced C1–C2) by default, with a toggle to view the overall ranking.
- Q: What language should tips, grammar explanations and corrections be written in? → A: Always English, using simplified wording matched to the learner's CEFR level (no translation into the mother tongue).
- Q: While the app is free during testing, can anyone sign up, or only people you invite? → A: Open sign-up up to an admin-adjustable account cap (default 200); beyond it, visitors join a waitlist that admins can admit from.

### Session 2026-10-17

- Q: Feedback lists "the 2–3 lowest-scoring sounds" — should a well-pronounced sound be
  flagged when everything was good? → A: No. Only sounds scoring below 85 qualify, at most 3;
  a clean recording may get no sound hints (FR-014).
- Q: Do admins follow the daily practice limits? → A: No. Admins (who test the app) get 99
  practices a day; learners keep their plan limits (FR-060).
- Q: Are a privacy policy and terms of use required? → A: Yes. Public pages, linked from the
  landing footer and sign-up, kept in sync with how data is actually handled (FR-073).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete the daily chunk session (Priority: P1)

A signed-in learner opens the app and receives today's chunk for their level. They study it
(meaning, when to use it, three examples, each playable as American-English audio), record
themselves saying the chunk and each example, get a pronunciation score with warm, specific tips,
try again and see how much they improved, write three sentences of their own and get each one
graded and corrected, listen to the corrected sentences and read them aloud for a final score,
and finish with a daily score that updates their streak.

**Why this priority**: This is the product. Every other feature supports, measures, or monetizes
this loop. A learner who can complete one daily session gets real value even with no other
feature present.

**Independent Test**: With one pre-created learner account at level B1 and a seeded chunk
library, complete a full session end to end and verify that each of the six steps produces its
output and a daily score is stored.

**Acceptance Scenarios**:

1. **Given** a learner at level B1 who has not practiced today, **When** they open their daily
   session, **Then** they see one chunk matching B1 with its type, meaning, "when to use it"
   guidance, and three examples labeled casual or professional, each with a play control.
2. **Given** the Learn step, **When** the learner presses play on the chunk or any example,
   **Then** they hear it spoken in their selected American-English voice; pressing play again
   replays the same audio without delay.
3. **Given** the Speak (try 1) step, **When** the learner records the chunk and each of the three
   examples, **Then** each recording gets a 0–100 score and the learner sees tips that name their
   2–3 weakest sounds with a consistent, plain-language hint for each sound.
4. **Given** try 1 is complete, **When** the learner records all four items again (try 2),
   **Then** they see the try-2 score for each item and the change versus try 1.
5. **Given** the Write step, **When** the learner submits three original sentences using the
   chunk, **Then** each sentence receives a grade for correct chunk usage and grammar plus a
   corrected version (identical to the original if already correct) with a short explanation.
6. **Given** corrected sentences, **When** the learner plays each one and records themselves
   reading it, **Then** each reading receives a 0–100 score.
7. **Given** all steps are complete, **When** the session ends, **Then** a daily score is shown
   and saved, the streak is updated, and the learner's recordings no longer exist anywhere in
   the system.
8. **Given** a learner leaves mid-session, **When** they return the same day, **Then** they
   resume at the step where they stopped, with prior step results preserved.

---

### User Story 2 - Sign up, verify, and set up a learner profile (Priority: P2)

A new visitor creates an account with email, username, and password (or with Google), verifies
their email, picks their English level (CEFR A1–C2, or Beginner/Intermediate/Advanced which maps
to a CEFR band), and fills in a profile with display name, mother tongue, and an optional
profile picture. They can later change their level, picture, preferred voice, and light/dark
theme, and reset a forgotten password.

**Why this priority**: Required for anyone outside the test team to use the P1 session and for
scores, streaks, and limits to be tied to a person.

**Independent Test**: Register a new account, verify via the emailed link, complete level
onboarding, upload a picture, change voice and theme, sign out, reset the password, and sign in
with the new password.

**Acceptance Scenarios**:

1. **Given** a visitor on the sign-up form, **When** they submit a valid email, unique username,
   and password, **Then** an account is created in an unverified state and a verification email
   is sent; the account cannot start a session until verified.
2. **Given** a visitor who chooses Google sign-in, **When** Google confirms their identity and
   they confirm they are 16 or older, **Then** an account is created (or signed in) without a
   separate verification email.
3. **Given** a verified learner with no level, **When** they first sign in, **Then** they must
   choose a level before reaching the daily session.
4. **Given** a learner uploads a profile picture in a common image format, **When** it is saved,
   **Then** it is cropped/resized to a standard square size and displayed across the app;
   non-image or oversized files are rejected with a clear message.
5. **Given** a learner who forgot their password, **When** they request a reset, **Then** they
   receive a single-use, time-limited reset link by email.
6. **Given** a learner changes their voice or theme, **When** they return later on any device,
   **Then** the preference persists.
7. **Given** a learner chooses to delete their account and confirms, **When** the deletion
   completes, **Then** they are signed out, their personal data (profile, picture, sentences,
   scores, points) is erased immediately, they no longer appear in rankings, and any active
   subscription is cancelled; chunks they submitted that were accepted remain in the library
   without attribution.

---

### User Story 3 - Track progress, streak, and ranking (Priority: P3)

A learner opens their Progress page and sees a chart of daily scores over time, their current
and best streak, improvement between tries, and their position in a ranking among learners.

**Why this priority**: Visible progress and friendly competition drive daily return, which is
what makes chunk learning work.

**Independent Test**: Seed a learner with 14 days of scores (including a gap) and verify the
chart, streak values, and ranking position match the seeded data.

**Acceptance Scenarios**:

1. **Given** a learner with past sessions, **When** they open Progress, **Then** they see daily
   scores for at least the last 30 days as a chart, plus current and longest streak.
2. **Given** a learner who missed yesterday, **When** they complete today's session, **Then**
   their current streak resets to 1 and their longest streak is unchanged.
3. **Given** multiple active learners, **When** a learner views the ranking, **Then** by default
   they see their own position and the top learners by points within their level band
   (Beginner A1–A2, Intermediate B1–B2, Advanced C1–C2), shown by display name and picture only;
   a toggle switches to the overall ranking of all learners.
4. **Given** a learner who opted out of the public ranking, **When** others view it, **Then**
   that learner does not appear, but they still see their own position privately.
5. **Given** a learner with reminders on (the default) who has not completed a practice today,
   **When** their chosen reminder time arrives (default 19:00 in their time zone), **Then** they
   receive one reminder email showing their current streak; no email is sent if they already
   practised that day or have turned reminders off.
6. **Given** a reminder email, **When** the learner uses its unsubscribe link, **Then** reminders
   are turned off immediately without signing in.

---

### User Story 4 - Explore the chunk library and practice a chosen chunk (Priority: P4)

A learner searches the library by text, level, chunk type, or register (casual, academic,
professional), opens a chunk, and — if they still have practices left today under their plan —
launches a full session for that chunk.

**Why this priority**: Gives learners agency beyond the daily pick and makes higher plans
meaningful, but the app is useful without it.

**Independent Test**: Search for "look forward to", filter by B1 + verb pattern, open the result,
and launch a practice; then exhaust the daily limit and confirm launching is blocked.

**Acceptance Scenarios**:

1. **Given** the library, **When** the learner searches by words in a chunk or its meaning,
   **Then** matching chunks are listed with level, type, and register.
2. **Given** a learner with practices remaining today, **When** they launch practice on a chunk,
   **Then** a full session (User Story 1 steps) starts for that chunk and counts toward the limit.
3. **Given** a learner who has used all practices for today, **When** they try to launch,
   **Then** launching is blocked with a message showing when practices reset and which plan
   allows more.

---

### User Story 5 - Suggest a new chunk and get it reviewed (Priority: P5)

A learner proposes a chunk that is not in the library. The app checks it against existing
chunks; if an identical or very similar chunk exists, it suggests that one instead. Otherwise
the suggestion goes to an admin, who accepts or rejects it. On acceptance, the chunk joins the
library and the learner is notified and earns points.

**Why this priority**: Grows the library and engagement, but depends on the library and admin
area already existing.

**Independent Test**: Submit "spill the beans" (already present) and confirm the existing chunk
is suggested; submit a novel chunk, approve it as admin, and confirm the learner gets a
notification and points.

**Acceptance Scenarios**:

1. **Given** a learner submits a chunk equal or close to an existing one, **When** the check runs,
   **Then** the existing chunk(s) are shown and the learner can open them or still submit.
2. **Given** a new chunk is submitted, **When** the check finds no match, **Then** it enters an
   admin review queue with status "pending" and the learner sees it as pending.
3. **Given** an admin accepts a pending chunk (optionally editing its details), **When** the
   decision is saved, **Then** the chunk becomes searchable and practicable, the learner receives
   an in-app notification and an email, and points are added to their total.
4. **Given** an admin rejects a pending chunk, **When** the decision is saved, **Then** the
   learner is notified with the optional reason and no points are awarded.

---

### User Story 6 - Administer users, chunks, and plans (Priority: P6)

An admin uses a separate admin area to list, search, view, create, edit, suspend, and delete
users; see each user's plan, subscription status, and payment method summary; moderate chunk
submissions; manage the chunk library; and switch paid billing on when ready.

**Why this priority**: Needed to operate the service and to go live with payments, but not
needed for learners to get value during free testing.

**Independent Test**: As an admin, list users filtered by plan, open one user's detail page,
edit their level, suspend them, and confirm the suspended user cannot sign in.

**Acceptance Scenarios**:

1. **Given** an admin, **When** they open the user list, **Then** each row shows username, email,
   level, plan, subscription status, sign-up date, and last activity, with search and filters.
2. **Given** an admin opens a user's detail, **When** the user has a payment method on file,
   **Then** only its type, brand, last four digits, and expiry are shown — never full details.
3. **Given** a non-admin, **When** they try to reach any admin page or admin action, **Then**
   access is denied.
4. **Given** an admin deletes a user, **When** they confirm, **Then** the user's personal data is
   removed and they disappear from rankings.

---

### User Story 7 - Discover the app on the landing page (Priority: P7)

A visitor lands on the public home page, learns why chunks matter, watches a short video, sees
the plans, and signs up.

**Why this priority**: Drives acquisition, but early testing happens by direct invitation.

**Independent Test**: Load the landing page on mobile, tablet, and desktop; play the video;
follow the call to action to the sign-up form.

**Acceptance Scenarios**:

1. **Given** a visitor, **When** they open the landing page, **Then** they see an explanation of
   chunks with examples, a playable video, plan comparison, and a prominent sign-up call to
   action.
2. **Given** paid billing is not yet active, **When** a visitor views plans, **Then** the call to
   action offers free sign-up and Standard/Premium are shown as "coming soon"; once billing is
   active, the call to action offers the 7-day free trial.
3. **Given** a visitor signing up, **When** they have not confirmed they are 16 or older,
   **Then** the account cannot be created.
4. **Given** billing is inactive and the number of accounts has reached the admin-set cap
   (default 200), **When** a visitor tries to sign up, **Then** they are offered the waitlist
   instead, entering only their email; they receive an email invitation when an admin admits them.

---

### User Story 8 - Plans, limits, and billing activation (Priority: P8)

The app enforces per-plan daily practice limits (Basic 1, Standard 3, Premium 5 plus one daily
conversation). Until an admin activates paid billing, everyone uses Basic at no cost and no
payment is collected. After activation, learners can subscribe monthly (Basic $7, Standard $9,
Premium $11), start with a 7-day free trial, and manage or cancel their subscription.

**Why this priority**: Monetization matters only after the core experience is validated with
friends; until then it must simply stay off.

**Independent Test**: With billing inactive, confirm no payment UI is reachable and a learner is
limited to one practice. In test mode with billing active, subscribe to Standard and confirm the
limit becomes three.

**Acceptance Scenarios**:

1. **Given** billing is inactive, **When** any learner uses the app, **Then** they are on Basic,
   are never asked for payment details, and no charges can occur.
2. **Given** billing is active, **When** a learner subscribes to a plan, **Then** payment is
   collected through the payment provider's secure hosted page and their daily limit changes as
   soon as payment is confirmed.
3. **Given** a subscriber cancels, **When** the current period ends, **Then** an early tester
   returns to free Basic, while any other learner keeps their history but cannot practice until
   they subscribe again.
4. **Given** go-live preparation, **When** an admin runs the demo account through subscribe,
   renew, and cancel in test mode, **Then** all three succeed before real charges are enabled.
5. **Given** billing is activated, **When** a learner who registered before activation signs in,
   **Then** they remain on Basic at no cost and are labeled an early tester; a learner who
   registers after activation starts a 7-day free trial and is asked to subscribe when it ends.

### Edge Cases

- Microphone permission denied or unavailable: the learner sees how to enable it and can skip
  speaking steps; the daily score is computed from completed steps and marked partial.
- Silent, very short, very noisy, or wrong-content recordings: no score is produced; the learner
  is asked to try again (not counted as an attempt) — recording is still deleted.
- Scoring or feedback service temporarily unavailable: the learner can retry; the session state
  is preserved; the daily limit is not consumed by a failed practice.
- Audio playback fails: the text remains visible with IPA transcription and a retry control.
- Written sentences that don't use the chunk, are in another language, are empty, or contain
  offensive content: graded accordingly with a kind explanation; offensive text is not stored.
- Learner changes level mid-day: the change applies from the next daily chunk. Their ranking band
  changes immediately; points already earned move with them.
- No unused chunk left at the learner's level: the app recycles the least-recently-practiced chunk.
- Learner crosses midnight during a session: the session counts for the day it started.
- Learner changes time zone: day boundaries follow the time zone saved in their profile.
- Duplicate user submissions of the same new chunk by different learners: merged into one
  pending item; on acceptance, the first submitter receives the points.
- Google account email already used by a password account: the accounts are linked after the
  learner proves ownership of the password account.
- Payment fails or card expires after billing is active: learner is notified and keeps access
  until the provider's retry period ends, then falls back to the limited state.

## Requirements *(mandatory)*

### Functional Requirements

**Accounts & profile**

- **FR-001**: System MUST allow sign-up with email, unique username, and password, or with a
  Google account.
- **FR-002**: System MUST verify email ownership before a password-based account can practice,
  and MUST support password reset via single-use, time-limited emailed links.
- **FR-003**: System MUST require each learner to select a level (A1–C2, or Beginner →A2,
  Intermediate →B1/B2, Advanced →C1) before their first session, and allow changing it later.
- **FR-004**: Profile MUST include display name, mother tongue, level, time zone, preferred voice,
  theme (light/dark/system), ranking visibility, reminder on/off and time, and an optional
  picture.
- **FR-005**: System MUST validate profile pictures (image type, max 5 MB), normalize them to a
  square standard size, and store them in managed storage.
- **FR-006**: Learners MUST be able to choose among at least 4 American-English voices (mixed
  genders); the choice applies to all playback.
- **FR-007**: Learners MUST be at least 16 years old. Sign-up MUST require the learner to
  confirm they are 16 or older; no parental-consent flow is provided.
- **FR-008**: Learners MUST be able to delete their own account from their profile after an
  explicit confirmation; deletion MUST immediately erase their personal data, remove them from
  rankings, and cancel any active subscription. Accepted submitted chunks remain, unattributed.

**Daily session**

- **FR-010**: System MUST assign each learner one daily chunk matching their level, preferring
  chunks they have not practiced before.
- **FR-011**: Learn step MUST show the chunk, its type, meaning, "when to use it" guidance, IPA
  transcription, and three examples labeled casual or professional, each with a play control.
- **FR-012**: Audio for any text MUST be generated only on first play request and then reused for
  every later request of the same text and voice.
- **FR-013**: Speak steps MUST let the learner record the chunk and each example (try 1, then
  try 2) and return a 0–100 score per recording combining word accuracy, fluency, and per-sound
  accuracy.
- **FR-014**: Feedback MUST identify up to 3 of the lowest-scoring sounds that score below 85 (none
  when every sound is good) and present, for each, the fixed hint from the app's curated sound-hint table (~40 English sounds), wrapped in a short,
  encouraging, personalized message. Generated text MUST NOT change scores or hints.
- **FR-015**: After try 2, System MUST show per-item and overall improvement versus try 1.
- **FR-016**: Write step MUST accept three learner sentences and return, for each, a usage grade,
  a grammar grade, a corrected version, and a one-sentence explanation.
- **FR-016a**: All feedback (pronunciation tips, grades, corrections, explanations) MUST be in
  English, with vocabulary and sentence length matched to the learner's CEFR level (e.g., short,
  high-frequency words for A1–A2). Feedback MUST NOT be translated into the mother tongue.
- **FR-017**: Read-aloud step MUST let the learner play each corrected sentence and record
  themselves reading it, returning a 0–100 score per recording.
- **FR-018**: System MUST compute a daily score (0–100) as a weighted combination of try-2
  speaking, writing, and read-aloud results, save it, and update current and longest streak.
- **FR-019**: System MUST delete every learner recording immediately after it is scored,
  including when scoring fails; only scores and per-sound results are kept.
- **FR-020**: Learner recordings MUST NOT be sent to any third-party service.
- **FR-021**: Session progress MUST persist so a learner can resume the same day.

**Progress & ranking**

- **FR-030**: Progress page MUST show a daily-score chart (selectable 7/30/90 days), current and
  longest streak, total points, and try-1→try-2 improvement trend.
- **FR-031**: System MUST award points for completed sessions (proportional to daily score),
  streak milestones, and accepted chunk submissions.
- **FR-032**: System MUST show a ranking by points over the current week and all time, within
  the learner's level band by default (Beginner A1–A2, Intermediate B1–B2, Advanced C1–C2) with a
  toggle to the overall ranking; entries display only display name and picture; learners MAY opt
  out of public listing. A learner appears in the band of their current level.
- **FR-033**: System MUST send at most one reminder email per learner per day, at the learner's
  chosen local time (default 19:00), only if they have not completed a practice that day.
  Reminders MUST be on by default, changeable in the profile, and include a one-click
  unsubscribe link.

**Library & submissions**

- **FR-040**: Library MUST launch with a curated set targeting ~1,000 chunks across A1–C2, all
  seven chunk types, and casual, academic, and professional registers; every chunk MUST be
  independently audited for accuracy and level before inclusion.
- **FR-041**: Learners MUST be able to search the library by text and filter by level, type,
  and register.
- **FR-042**: Learners MUST be able to launch a practice for any library chunk if they have
  practices remaining today; daily and library practices share one daily limit.
- **FR-043**: Learners MUST be able to submit new chunks; System MUST detect exact and near
  duplicates and suggest existing matches before submission is finalized.
- **FR-044**: New submissions MUST go to an admin review queue; acceptance publishes the chunk,
  notifies the learner in-app and by email, and awards points; rejection notifies with an
  optional reason.

**Admin**

- **FR-050**: Admin area MUST be accessible only to admin users, enforced on every action.
- **FR-051**: Admins MUST be able to list, search, filter, view, create, edit, suspend, and delete
  users, and see each user's plan, subscription status, and renewal date.
- **FR-052**: User detail MUST show payment method summary only (type, brand, last four, expiry).
- **FR-053**: Admins MUST be able to create, edit, retire, and review chunks and moderate
  submissions.
- **FR-054**: Admins MUST be able to switch paid billing between inactive and active; the switch
  and its author MUST be recorded.
- **FR-055**: While billing is inactive, System MUST cap total learner accounts (every non-admin
  account, verified or not; admins excluded) at an
  admin-adjustable limit (default 200). When the cap is reached, sign-up MUST be replaced by a
  waitlist (email only); admins MUST be able to view the waitlist and admit people, who then
  receive an email invitation valid for 7 days that bypasses the cap. Deleted accounts free a
  place.

**Plans & billing**

- **FR-060**: System MUST enforce daily practice limits per plan: Basic 1, Standard 3, Premium 5.
  Admins are exempt (99 per day) so they can test the app.
- **FR-061**: While billing is inactive, all learners MUST be on Basic at no cost, no payment
  details may be requested, and Standard/Premium MUST be shown as "coming soon".
- **FR-062**: When billing is active, learners MUST be able to subscribe monthly (Basic $7,
  Standard $9, Premium $11) via the payment provider's hosted pages, change plan, and cancel;
  card details MUST never be handled or stored by the app.
- **FR-063**: When billing is activated, every learner who registered before activation MUST
  be marked as an early tester and keep Basic free permanently (they may still upgrade to a paid
  plan). Learners who register after activation MUST get a 7-day free trial, after which they
  must subscribe to keep practicing; if they don't, their history is kept but practice is
  blocked until they subscribe.
- **FR-064**: Premium's daily guru conversation is out of scope for this feature and MUST be
  listed as "coming soon".

**Landing & general**

- **FR-070**: Public landing page MUST explain chunks with examples, include a video, compare
  plans, and lead to sign-up.
- **FR-071**: All pages MUST work on mobile, tablet, and desktop and meet WCAG 2.2 AA.
- **FR-072**: The visual design MUST follow the project's Figma designs and color palette.
- **FR-073**: The site MUST publish a privacy policy and terms of use as public pages, linked
  from the landing footer and the sign-up form, that accurately describe what data is
  collected, which processors receive it, retention, and how to delete an account.
- **FR-074**: The system MUST record why a practice stalls — microphone blocked or unsupported,
  unusable recording (with its reason), failed upload, scoring outage, or a page that failed to
  load — as allow-listed codes with the learner, session, step and time, never audio or free
  text, and delete these records after 30 days. A page that fails to load MUST show a friendly
  retry instead of the framework's default error.

### Key Entities

- **Learner (User)**: account identity, role (learner/admin), status, level, profile fields,
  preferences, points, streaks, ranking visibility.
- **Chunk**: text, type, level, register(s), meaning, usage guidance, IPA, three examples,
  source (curated/submitted), audit status, active/retired.
- **Example / Sentence**: text, register, belongs to a chunk or to a learner's written work.
- **Audio clip**: cached spoken rendition of a text in a voice; reused across learners.
- **Practice session**: learner, chunk, date, origin (daily/library), current step, status,
  daily score.
- **Attempt**: one scored recording (step, item, try number, score, per-sound results); no audio.
- **Writing result**: original sentence, corrected version, usage and grammar grades,
  explanation.
- **Sound hint**: IPA symbol, friendly hint, example words; curated, versioned.
- **Chunk submission**: submitter, proposed text/details, matched existing chunks, status,
  reviewer, reason, decision date.
- **Plan & subscription**: plan tier, limits, price, status, period dates, trial dates, payment
  method summary, early-tester flag (registered before billing activation).
- **Points ledger entry**: learner, reason, amount, date.
- **Notification**: recipient, type, channel (in-app/email), message, read state; includes
  daily practice reminders.
- **Billing setting**: active/inactive, account cap, changed by, changed at.
- **Waitlist entry**: email, joined date, status (waiting/invited/registered/expired),
  invited by, invitation expiry.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time learner completes sign-up, verification, and level selection in
  under 3 minutes.
- **SC-002**: A learner completes a full daily session in 10–15 minutes on average.
- **SC-003**: Pronunciation scores are returned within 5 seconds of finishing a recording for
  95% of recordings.
- **SC-004**: Audio plays within 2 seconds of pressing play for first plays and within 0.5
  seconds for repeat plays, 95% of the time.
- **SC-005**: On a labeled test set of good vs. poor pronunciations, the scoring ranks the better
  recording higher in at least 85% of pairs before launch to learners.
- **SC-006**: At least 70% of learners score higher on try 2 than on try 1 in a session.
- **SC-007**: At least 40% of test learners who complete one session return on 3 of the next 7
  days.
- **SC-008**: 100% of recordings are absent from all storage once scoring completes or fails
  (verified by audit).
- **SC-009**: Zero payment details are requested or stored while billing is inactive, and no
  card data is ever stored by the app.
- **SC-010**: Duplicate-chunk detection suggests an existing chunk for at least 90% of
  submissions that match one.
- **SC-011**: All core flows are usable with keyboard only and pass an automated accessibility
  audit at WCAG 2.2 AA with zero critical issues.

## Assumptions

- Age confirmation is self-declared (no identity or age verification).
- Initial users are a friends-and-family test group plus public visitors, bounded by the
  account cap (default 200) while billing is inactive.
- "Practice" means one full session on one chunk; retries within a session don't consume extra
  practices, and a session that fails due to a service error does not count.
- The daily chunk is chosen per learner from their level (not identical for all learners), but
  audio for shared texts is reused across learners.
- Day boundaries use the learner's profile time zone (defaulting to their browser's).
- Daily-score weights default to 40% speaking (try 2), 30% writing, 30% read-aloud, adjustable
  later by admins.
- Ranking points are not reset; the weekly ranking uses points earned in the current week.
- Examples are labeled casual or professional; "academic" is a library register, not an
  example label.
- The Premium conversation feature, Standard/Premium checkout before activation, and native
  mobile apps are out of scope for this feature.
- The interface and all feedback are English-only for v1; mother tongue is stored for future
  personalization but not used to translate content.
- Technology choices (open-weight models for scoring and feedback, hosting, storage, email,
  payments) are governed by the project constitution and decided in the plan.
- The landing-page video is supplied by the product owner.

# Design Inventory (from Figma)

Source: Figma file `EnglishChunksHome` — https://www.figma.com/design/0V1cRgRyGaqx9rOnlCiL39/EnglishChunksHome
(page `englishchunks.guru`, 17 desktop frames at 1470px wide). Extracted 2026-10-16 via the Figma
desktop tools. **Every UI task implements the matching screen below (FR-072).** Screens with no
frame are designed with the same tokens and components.

## Screen → route map

| Figma node     | Screen                                                                                           | Route                                             | Story |
| -------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ----- |
| 1:4            | Auth — create account (split: brand panel + form, Google button, "7 days free")                  | `/sign-up`                                        | US2   |
| 2:1244         | Auth — log in ("Welcome back.")                                                                  | `/sign-in`                                        | US2   |
| 2:98           | Onboarding step 1 — choose level (A1–C2 cards with plain descriptions)                           | `/onboarding/level`                               | US2   |
| 2:214          | Onboarding step 2 — mother tongue, learning goal, daily reminder time                            | `/onboarding/about`                               | US2   |
| 2:380          | Today · Learn (chunk card, IPA, meaning, when-to-use, Mina's tip, 3 example cards, CTA bar)      | `/practice/[id]` step learn                       | US1   |
| 2:675          | Today · Speak try 1 — record                                                                     | step speak_1                                      | US1   |
| 2:918          | Today · Speak try 1 — result (score %, tip, Clarity/Rhythm, Try again / Continue)                | step speak_1                                      | US1   |
| 2:1330         | Today · Write — three sentences + "A little inspiration" frame                                   | step write                                        | US1   |
| 2:1531         | Today · Write — feedback ("3/3", your sentence vs polished version)                              | step write                                        | US1   |
| 2:1781         | Today · Read aloud — 0/3 (hear sentence, record yourself)                                        | step read_aloud                                   | US1   |
| 2:2022         | Today · Read aloud — 3/3 complete                                                                | step read_aloud                                   | US1   |
| 2:2270         | Session complete — daily score, pronunciation/writing/streak tiles                               | step done                                         | US1   |
| 2:2468, 7:3784 | Progress — streak, average, chunks learned, ranking "around your position" (weekly XP)           | `/progress`                                       | US3   |
| 2:2925         | Profile & preferences (learning profile, reminder, voice, appearance, example style, admin link) | `/profile`                                        | US2   |
| 2:3200         | Guru conversation (Premium)                                                                      | `/conversation` — **"coming soon" only** (FR-064) | US8   |
| 2:3397         | Chunk library (search, level/type filters, category chips, result cards, "Suggest a chunk")      | `/library`                                        | US4   |
| 1:3            | Code embed of the full prototype (reference only)                                                | —                                                 | —     |

**Not in Figma (design with the same system):** landing page `/`, verify-email, reset-password,
waitlist, library chunk detail, submit-chunk, my-submissions, billing, all `/admin/*` pages,
mobile/tablet breakpoints (Figma is desktop-only: collapse the 242px sidebar into a top bar +
bottom tab bar below 1024px).

## Spec deviations noted in Figma (spec wins)

- Figma shows "Clarity" and "Rhythm" sub-scores; the app shows the spec's components
  (pronunciation sounds, word accuracy, fluency) labelled in plain words: **Sounds**, **Words**,
  **Flow**.
- Figma's coach persona "Mina" gives tips: keep the name for the tip voice, but hints come from
  the fixed sound-hint table (Principle II).
- Figma library header says "5,000+ / 5,247 chunks"; render the real count.
- Figma onboarding step 2 adds "What will you use English for?" (learning goal) and profile
  "Example style"; these are not in the spec — **out of scope for v1** (omit the fields).
- Ranking uses "XP"; the app calls these **points** consistently.

## Typography

- Family: **Nunito** (Regular 400, SemiBold 600, Bold 700, Black 900) via `next/font/google`.
  Logo wordmark uses Inter Bold (kept inside the logo only).
- Scale (px / line-height): display 54/81 (chunk), h1 34/51 (tracking −1px), h2 29/43.5,
  quote 19/28.5, meaning 18/28, body 16/24, small 13/20, caption 12/18, micro 11/16.5.
- Eyebrow labels: Bold 12px, uppercase, tracking 1.7px, colour `--eyebrow`.
- Tags: Bold 9–10px uppercase, tracking 1px, radius 6px, padding 6×9.

## Layout & shape

- App shell: 242px left sidebar (white, right border), content max-width 1120px, top padding 42px.
- Cards: white, 1px border `#dfe8ea`, radius 20px (primary) / 16px (secondary), padding 22–42px.
- Buttons: primary mint fill, ink text, radius 12px, min-height 48px, Bold 16px, trailing icon.
- Audio button: 39px mint circle with speaker icon + optional "Listen" label.
- Stepper: 31px circles; active mint, inactive `#edf2f2`; labels Bold 10px.
- Nav item: 48px tall, radius 10px; active bg `#dcfff3`, text `#0b765a`, SemiBold 16px.
- Coach tip card: bg `#171d1f`, radius 18px, mint "M" avatar, label mint 9px uppercase.
- Streak card: bg `#e7fff7`, border `#aeead8`, lavender 3px inset left accent, title `#126f58`.
- Icons: Lucide (matches Figma's outline icons).

## Colour tokens (added to `src/app/globals.css`)

| Token                                                  | Light                             | Use                             |
| ------------------------------------------------------ | --------------------------------- | ------------------------------- |
| `--border`                                             | `#dfe8ea`                         | card/divider borders            |
| `--muted-foreground`                                   | `#667179`                         | secondary text (4.75:1 on snow) |
| `--eyebrow`                                            | `#40736a`                         | eyebrow labels                  |
| `--nav-active` / `--nav-active-foreground`             | `#dcfff3` / `#0b765a`             | active nav                      |
| `--tag-type` / `--tag-type-foreground`                 | `#efeffa` / `#5c619b`             | chunk-type tag                  |
| `--tag-level` / `--tag-level-foreground`               | `#e9f8f3` / `#547269`             | level tag                       |
| `--coach` / `--coach-foreground`                       | `#171d1f` / `#d6dddd`             | coach tip card                  |
| `--streak` / `--streak-border` / `--streak-foreground` | `#e7fff7` / `#aeead8` / `#126f58` | streak card                     |
| `--surface-subtle`                                     | `#f3f9fc`                         | "when to use it" box            |

**Accessibility corrections (WCAG 2.2 AA, constitution VI):** Figma `#899397` (inactive stepper
labels, 2.99:1) → `#667179`; `#788388` (IPA line, 3.89:1) → `#5f6a70`; `#686ba1` on `#eff1fb`
(example register tag, 4.43:1) → `#5c619b`. All other Figma text pairs measured ≥ 4.75:1.

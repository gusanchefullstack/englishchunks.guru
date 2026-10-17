# Performance (T148)

Measured 2026-10-16 with Chrome DevTools performance traces against a local production build
(`next build && next start`), cold cache, emulating a mid-range phone: 412×915 @2.6x, 4× CPU
slowdown, Fast 4G. Target: LCP ≤ 2.5 s (plan, Technical Context).

| Page | LCP | CLS | Notes |
|------|-----|-----|-------|
| `/` (landing) | 659 ms | 0.00 | static shell; billing-dependent CTA/plans stream in |
| `/progress` (signed in) | 572 ms | 0.00 | shell prerendered, data streamed in `<Suspense>` |
| `/today` (signed in) | 668 ms | 0.00 | redirects to today's session; session view streamed |

Why it's fast: Cache Components partial prerendering (static shells, request data in Suspense),
`next/font` (self-hosted Nunito, no layout shift), no client-side data fetching on load, and
charts limited to the progress page.

Caveats: local server has ~0 ms network latency, so TTFB in production (Vercel + Neon) will add
latency on top of these numbers — there is ~1.8 s of headroom. Remaining minor insights:
one render-blocking CSS request (~50–140 ms) and ~14 kB of framework polyfills. Re-check on the
deployed staging URL as part of T152.

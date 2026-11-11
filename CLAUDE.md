# Compass: a personal planner and advisor, for one person

Built 2026-11-10. Open a session in this folder for work on Compass itself. The root `nexora/CLAUDE.md` is the central brain.

## What it is
A single-user task manager that is also an assistant. It breaks work into **zones** (Growth, Nexora, Extension Club, Study,
Money & Goals), lays tasks out on a **timeline** (overdue, today, this week, next week, this month, later), tracks **money** against
the $1,000-a-month goal, keeps an **ideas** list (each with why it could earn and the cheapest test), a daily **routine**, and an
**assistant** (Claude) that reads `BRAIN.md` plus a live snapshot of the data before every answer.

## Run it
`npm install` once, then `npm run dev` (http://127.0.0.1:3400). Port 3000 belongs to another project. `npm test` runs the logic tests
(dates, store, editing, ideas, focus score, login tokens, the Anthropic call against a fake) on an in-memory Postgres.
Add the Anthropic API key on the Settings page (stored encrypted) or set `ANTHROPIC_API_KEY`.

## Data and hosting (changed 2026-11-10: now phone-ready)
- One async `Db` interface (`lib/pg.ts`), two engines: **hosted** = real Postgres through `DATABASE_URL` (Neon recommended); **local/tests** =
  PGlite (Postgres inside Node, folder `.data/pg`). SQL uses `?` placeholders. Postgres gotchas already hit: `double precision` not `real`,
  subselects need an alias, no `count(*)` (bigint).
- Vercel has no persistent disk, so the **brain lives in the database** (`settings.brain`, seeded from `BRAIN.md` the first time) and the
  encryption key must be `COMPASS_KEY` (32 bytes base64; the app refuses to start on Vercel without it).
- **Login:** one password, `COMPASS_PASSWORD`, HMAC-signed 30-day cookie (`lib/auth.ts`), guarded by `src/proxy.ts` (pages redirect to
  `/login`, APIs get 401). On Vercel with no password it returns 503 and serves nothing: it fails closed. Wrong-password limit: 8 per 15 min per IP
  (in memory, per instance). Changing the password signs every device out.
- `COMPASS_TZ` (default Asia/Kolkata) decides what "today" and the greeting are, because servers run UTC.
- Installable as a phone app (manifest + generated icons). Tapping a task opens the editor (every field, quick-move, delete).
- "Get new ideas" (Ideas page) asks Claude for 5 unproven ideas with the cheapest test each; nothing is saved until you press Keep.
- Deploy: `vercel --prod` from this folder with `DATABASE_URL`, `COMPASS_PASSWORD`, `COMPASS_KEY` set (and `regions` near the database).

## Business numbers (Pulse, Overview)
- `lib/pulse.ts` reads two sources, read-only: **Dodo** (`DODO_API_KEY` read-only key, `DODO_ENV` live/test; payments list plus one detail call per payment for the settled amount, cached per payment) and the **Nexora backend** (`NEXORA_PULSE_URL`, `NEXORA_PULSE_TOKEN`, must equal `PULSE_TOKEN` on the backend; route in `ig_exporter/backend/src/app/api/pulse`). Either can be missing or down; the other still shows and the assistant is told not to invent the missing figures.
- Revenue = **settled amount net of tax** (`settlement_amount - settlement_tax`), never the customer-currency totals. "New customer" = first payment inside 28 days of history. Cached 10 min per server instance (1 min after a failure); the browser also keeps the last copy so the page shows at once.
- `/overview` is built by the pure `lib/overview.ts` (tested). `app/loading.tsx` is the instant skeleton.

## Design system (Pixel Quest, 2026-11-11)
- Tokens live in `src/app/globals.css` (themes `cream` = default Day and `night`; every colour is a CSS variable, including the navy sidebar, gold accent and sunset sky). Titles, labels and big numbers use **Jersey 10** (`.font-pixel`, `.h-page`, `.h-card`, `.label`; one weight, no synthetic bold); body text stays Inter. Pixelify Sans was tried first and rejected: its f/fi/C glyphs read badly.
- Reusable pieces: `components/ds.tsx` (PixelAvatar, StatusBadge, PriorityDot, StreakBadge, ProgressRing, StatCard, Panel, WeekBars, MiniCalendar, PixelScene) and `components/ds-client.tsx` (ToastProvider/useToast, Modal, FocusTimer, CaptureBar). Pages compose these; do not hand-roll cards.
- Logo files are in `public/` (`logo-full.png`, `logo-emblem.png`, icons); the originals and the design reference are in `reference/` (git-ignored). The proxy matcher lets `logo-*` and `icon*` through without a session so the login page can show them.
- Routine was removed on purpose (2026-11-11) even though the design reference still shows it. Do not re-add without being asked.
- **Database connections:** on Vercel use Supabase's *transaction* pooler (port 6543) and at most 2 connections per instance. The session pooler (5432) ran out of slots (`EMAXCONNSESSION`) as soon as pages fetched in parallel.

## Rules that matter
- **The assistant never changes data.** Suggested tasks arrive as a fenced ```tasks block that is parsed and shown as buttons; nothing is
  added until the person presses one. Unknown zones in a suggestion are dropped.
- **Seeds are the person's real situation as of 2026-11-10** (from the central CLAUDE.md), not measured data: the $300 is their own
  figure, the ideas are unproven. Replace them; seeding runs once (`settings.seeded`).
- **Dates are built by hand, never with `Intl`/`toLocale*`** (hydration error 418). Weeks run Monday to Sunday; due dates are `YYYY-MM-DD` strings.
- **"This month" is the real last day of the month**, so late in the month it shows under next week, which is where it is due.
- **Focus score** (`focusScore` in `store.ts`): money x3, plus how soon, plus priority, plus 1 if started. Pure and tested.
- Hidden hover controls must be `pointer-events-none` until shown, or they swallow taps on phones.
- Models are listed in `lib/ai.ts` (`MODELS`); default `claude-sonnet-5-5`. A wrong model id comes back as a plain message.

## Layout
`src/lib`: `dates` (pure), `db` (migrations and seed), `store` (all reads and writes), `ai` (snapshot, prompt, proposals, the call),
`brain` (in the database), `secrets` (AES-GCM for the key), `api` (route wrapper), `runtime` (the one db per process), `pg` (Postgres/PGlite), `auth` (login cookie).
`src/app`: pages (Today, Plan, Zones, Money, Ideas, Routine, Assistant, Brain, Settings) and `api/*`. `src/components`: client pieces.

## Not built (say so, do not assume)
Drag and drop between columns (use the Move menu), recurring tasks, a calendar view, reminders or
notifications, importing the real revenue from `/admin` or Dodo (type the numbers in), and streaming answers.

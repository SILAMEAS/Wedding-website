# Sila & Kimsour — Wedding Invitation Platform

Bilingual (Khmer / English) wedding invitation and guest-management platform for
**មាស សិលា និង មឿក គឹមសួ**.

- Design documents: [`docs/phase-1/ARCHITECTURE.md`](docs/phase-1/ARCHITECTURE.md) (approved)
- Status: **Phase 5 (RSVP, wishes, gifts) complete.** Phase 6 (admin dashboard, gift verification, check-in, exports) is next.

## Requirements

- Node.js **20.19+** (Node 22 LTS recommended for future upgrades: Vitest 5 and jsdom 30+ need it)
- Docker Desktop (local PostgreSQL 17 for development and integration tests)

## Getting started

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env        # then fill in the secrets (see comments in the file)
npm run db:up               # start PostgreSQL in Docker (host port 5433)
npm run db:migrate          # apply migrations to the dev database
npm run db:seed             # WeddingSettings row + the shared admin account (see below)
npm run dev                 # http://localhost:3000 → /kh ; admin at http://localhost:3000/admin
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js development / production build / production server |
| `npm run typecheck` | Generate route types and run `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (flat config) |
| `npm test` | Unit tests (Vitest, no database) |
| `npm run test:integration` | Database integration tests against `TEST_DATABASE_URL` |
| `npm run test:all` | Both |
| `npm run test:e2e` | Playwright end-to-end tests. Starts its own dev server on :3100 against the TEST database, with its own build dir (`.next-e2e`) and upload dir (`.uploads-e2e`), so it can run while your normal `npm run dev` is up |
| `npm run db:up` / `db:down` | Start / stop local PostgreSQL |
| `npm run db:migrate` | Create/apply migrations in development (`prisma migrate dev`) |
| `npm run db:deploy` | Apply migrations in production (`prisma migrate deploy`) |
| `npm run db:seed` | Seed (idempotent; never overwrites edited values) |
| `npm run db:studio` | Prisma Studio |

## Admin account

There is no public registration. The single shared account is created once by the seed:

1. Set `ADMIN_SEED_USERNAME` and `ADMIN_SEED_PASSWORD` (12+ characters) in `.env`.
2. Run `npm run db:seed`. It does nothing if an admin already exists.
3. Sign in at `/admin/login`, then change the password under **Admin → Security**.
4. Remove `ADMIN_SEED_PASSWORD` from production environments after seeding.

Security properties: Argon2id hashing; random 256-bit session ids stored only as SHA-256 hashes;
`HttpOnly` + `SameSite=Strict` cookie (`__Host-` prefix and `Secure` in production); 12-hour idle and
7-day absolute expiry; changing the password signs out every other device; lockout after 10 failed
attempts (15 min) plus per-IP rate limiting; every admin page, Server Action and route handler checks
the session server-side.

⚠️ **Shared account limitation:** the activity log records actions as "Shared couple account" and
cannot tell which partner performed them. The schema already supports separate accounts (`AdminRole`).

## Guest experience (Phase 4)

| Route | What guests see |
|---|---|
| `/{kh|en}/invitation/{token}` | Envelope addressed to the guest → opens into hero (names in both languages, date, live countdown or post-wedding message), our story & milestones, schedule (Google Calendar / .ics), gallery, venues (map, directions, parking), contacts |
| `/{kh|en}/gallery`, `/gallery/{album}` | Albums with swipeable fullscreen lightbox. "Invited guests" albums appear only after a valid invitation was opened on that device |
| `/{kh|en}/location` | Venues & directions |
| `/{kh|en}/rsvp/{token}` | Reply: attend / decline (/ maybe if enabled), choose which family members come, extra guests within capacity, dietary & access needs |
| `/{kh|en}/gift/{token}` | KHQR + bank details (copy / save QR) and an "I sent a gift" notification with optional private screenshot |
| `/{kh|en}/wishes` | Approved public wishes; guests who opened their invitation can write one |

Content is edited under **Admin → Wedding details / Schedule / Venues / Gallery**. Sections with no content are hidden automatically,
and nothing about the wedding is invented. **Uploading an image does not save it**: press *Save* on the form; uploads never saved
are deleted after 24 h by `/api/cron/cleanup`.

Privacy notes: page titles/link previews never include the guest's name; invitation pages send no referrer; map iframes use
`referrerPolicy="no-referrer"` so the private link is never sent to Google; opening the invitation sets a signed cookie containing
ids only (re-checked against the database, so replacing/revoking the link removes access). "Invited guests" albums hide the album
listing and photos page from non-guests; the image files themselves are unlisted CDN URLs (like most photo sharing) rather than
access-controlled downloads.

Scheduled job: call `GET /api/cron/cleanup` with `Authorization: Bearer $CRON_SECRET` daily (e.g. Vercel Cron).

## Replies, wishes & gifts (Phase 5)

- **RSVP**: server-side capacity and membership checks, invitation row locked during writes (tested with concurrent submissions),
  append-only history with name snapshots, deadline (site-wide or per invitation), optional "Maybe", admin override with reason (service; UI in Phase 6).
- **Wishes**: always PENDING until approved in **Admin → Wishes**; private wishes are never public; honeypot + rate limits + duplicate detection.
- **Gifts**: configure KHQR/bank details in **Admin → Gift details**. Guest notifications are always `PENDING_VERIFICATION` — a KHQR
  code proves nothing. **Admin → Gifts received** shows every gift with separate USD/KHR totals (confirmed vs waiting), lets you
  confirm the amount actually received, mark not received / cancel, correct or reopen (reason required, immutable history),
  record cash received at the wedding, and view the guest's private screenshot. Proof screenshots are stored privately (Cloudinary
  `authenticated` delivery; never served by the public media route) and bound to the invitation by a signed receipt.
- Settings: **Admin → Wedding details → Replies, wishes & gifts** (deadline, Maybe, guestbook on/off, proof uploads, gift message)
  and section visibility toggles.

## Improvements after Phase 5

- **Venue Wi-Fi safe rate limiting**: valid invitation links allow 600 lookups / 5 min per IP (a whole wedding party on one network
  is fine); only *invalid* token guesses are tightly limited (30 / 10 min) to block link guessing.
- **Reply corrections**: invitation page shows the reply, its full version history, and lets the couple enter/correct a reply
  (e.g. by phone) with a reason — even after the deadline.
- **Dashboard**: attending / declined / awaiting reply, confirmed gift totals per currency, gifts to check, wishes to approve.
- **Uploads**: photos are resized in the browser (max 2560 px, JPEG) before upload — large phone photos and iPhone HEIC (where the
  browser can decode it) now work. KHQR images are never recompressed. A clear "press Save" hint appears after choosing a file.
- **Background music** (optional, **Wedding details**): MP3/M4A up to 15 MB, starts when the guest taps "Open invitation", floating
  pause/play button. Local media route supports byte ranges (required by Safari for audio).
- Envelope letter now slides out of the envelope; reloading a new-invitation page no longer re-reveals the link; printing shows all
  sections; the generic home page links to gallery, wishes and venues.

## Project structure

```text
prisma/                 schema.prisma, migrations/ (incl. hand-written *_db_constraints), seed.ts
messages/               en.json, kh.json — UI strings
src/app/[locale]/       public site (always locale-prefixed: /kh/..., /en/...)
src/app/api/            route handlers (health; more in later phases)
src/components/         ui/ (shadcn), wedding/ (public), admin/ (Phase 3+)
src/i18n/               next-intl routing, request config, navigation, locale helpers
src/lib/                env, prisma, logger, money, dates, validation, security
src/server/             services/ (use cases) → repositories/ (Prisma queries)
src/proxy.ts            CSP nonce + locale routing (Next.js 16 "proxy" = former middleware)
tests/                  unit/, integration/, support/
docs/phase-1/           approved architecture, ERD, original schema proposal
```

## Key technical decisions

### Pinned versions (all exact, each released ≥ 2 weeks before setup)

| Package | Version | Package | Version |
|---|---|---|---|
| next | 16.4.6 | prisma / @prisma/client / @prisma/adapter-pg | 7.10.1 |
| react / react-dom | 19.3.1 | pg | 8.23.1 |
| typescript | 5.9.3 | zod | 4.6.7 |
| tailwindcss / @tailwindcss/turbopack | 4.3.3 | next-intl | 4.14.9 |
| shadcn (CLI) / radix-ui / cn | 4.23.0 / 1.8.1 / 0.4.0 | motion (Framer Motion) | 14.11.1 |
| react-hook-form / @hookform/resolvers | 7.91.0 / 7.0.5 | lucide-react | 1.70.0 |
| sonner | 2.0.8 | @node-rs/argon2 | 2.2.2 |
| vitest | 4.1.12 | jsdom | 29.1.1 |
| eslint / eslint-config-next | 9.39.5 / 16.4.6 | tsx | 4.23.15 |

Version notes:
- **TypeScript 5.9**, not 7: the Next.js 16.4 template still targets TS 5.
- **Prisma 7.10.1**: the npm `latest` tag pointed at an 8.0 release candidate, so the newest stable 7.x was chosen.
- **Vitest 4 / jsdom 29**: Vitest 5 and jsdom 30+ require Node 22.
- `effect` (used only by the Prisma CLI's config loader) is overridden to 3.22.1 to clear a high-severity advisory. `npm audit --omit=dev` reports 0 vulnerabilities. The 4 remaining moderate advisories are in ESLint's dev-only dependencies.
- Added in Phase 3: `qrcode` 1.5.4, `@playwright/test` 1.65.0 (dev).
- Added in Phase 4: `cloudinary` 2.11.0, `file-type` 21.3.4 (22.x needs Node 22), `image-size` 2.1.0, `yet-another-react-lightbox` 3.33.0.
- Planned for later phases: `@yudiel/react-qr-scanner`, `exceljs`, `@tanstack/react-table`, `recharts`.
- `logging.serverFunctions` is disabled in `next.config.ts`: Next.js 16 otherwise prints Server Action arguments (including passwords) to the dev terminal.

### Rendering model
Next.js 16's **Cache Components is intentionally disabled.** Nearly every page renders per-request private data (invitation tokens, admin sessions), and a per-request CSP nonce requires dynamic rendering anyway. Public layouts export `dynamic = "force-dynamic"`, and responses carry `Cache-Control: no-store`. This removes any chance of a private response being cached.

### Prisma 7
- Generator `prisma-client` → `src/generated/prisma` (git-ignored, regenerated on `npm install`).
- Connection URLs live in `prisma.config.ts`. The runtime uses the `pg` driver adapter.
- Partial unique indexes (one live invitation per guest/group, one ACTIVE token per invitation) are declared in `schema.prisma` through the `partialIndexes` preview feature.
- CHECK constraints and triggers (owner XOR, RSVP capacity and membership, append-only history tables, no gift deletion, money rules) live in the hand-written migration `prisma/migrations/*_db_constraints`. Prisma does not diff CHECKs or triggers, so later migrations leave them alone (verified: a follow-up `migrate dev` produced an empty migration).
- The app's Prisma client is created lazily, so `next build` needs neither a database nor secrets.

### Localization
- Locale codes in URLs are `kh` and `en`, as specified. `kh` is not a valid BCP-47 tag (`Intl` silently falls back to English for it), so formatting uses `km-KH` and `<html lang="km">`. See `src/i18n/locales.ts`.
- The default locale is Khmer. It is configurable with `NEXT_PUBLIC_DEFAULT_LOCALE`.
- Wedding content is stored as `{ en, kh }` JSON and validated with Zod (`src/lib/validation/localized.ts`). If one language is blank, the page falls back to the other. For example, until English names are entered, `/en` shows the Khmer names.
- Fonts (self-hosted by `next/font`): Inter + Noto Sans Khmer (body), Cormorant Garamond + Noto Serif Khmer (headings), Moul (couple names).
- ⚠️ The Khmer UI copy in `messages/kh.json` should be reviewed by a native speaker before launch.

### Security foundation (Phase 2)
- Environment validated with Zod at server start (`src/instrumentation.ts`). Production requires https `APP_URL` and Cloudinary.
- CSP with a per-request nonce and `strict-dynamic` (`src/lib/security/csp.ts`). Also `X-Frame-Options: DENY`, `Referrer-Policy: same-origin` (invitation URLs contain secret tokens), `Permissions-Policy` (camera allowed for self only, for check-in), and HSTS in production.
- Every page is `noindex, nofollow`, and `robots.txt` disallows everything.
- Structured JSON logger with recursive redaction of tokens, passwords, cookies, phone numbers and emails.
- Money uses Decimal only. USD and KHR are never summed together, and KHR must be whole riel (`src/lib/money.ts`, plus a DB CHECK).

### Integration tests
`npm run test:integration` runs `prisma migrate deploy` against `TEST_DATABASE_URL` (non-destructive). Each test then empties the tables with `TRUNCATE`. The setup refuses to run if the database name does not contain `test`.

## Known limitations / setup values still required

- **No wedding facts are configured yet**: date, events, venues, story, bank/KHQR details and contacts. They will be editable in the admin dashboard (Phases 4–6). Until then the landing page shows "date will be announced soon".
- English transliterations of the couple's names are intentionally blank until the couple enters them.
- Cloudinary is not configured. Development uses `MEDIA_STORAGE=local`, and production refuses to start without Cloudinary.
- Shared admin account (Phase 3): audit logs will identify the shared account, **not** which partner acted.

## Roadmap

| Phase | Status |
|---|---|
| 1 Architecture & database design | ✅ approved |
| 2 Foundation | ✅ complete |
| 3 Auth & core data (admin login, guests/groups, invitations, tokens, audit) | ✅ complete |
| 4 Public experience (envelope, hero, story, events, gallery, locations) | ✅ complete |
| 5 Guest interactions (RSVP, wishes, gifts) | ✅ complete |
| 6 Admin dashboard (analytics, moderation, gifts, QR, check-in, exports) | next |
| 7 Testing & hardening | |
| 8 Deployment (backup/restore, monitoring, smoke tests) | |

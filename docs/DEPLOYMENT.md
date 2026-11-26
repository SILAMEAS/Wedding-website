# Deployment

Target setup: **Vercel** (app, Singapore region `sin1`) + **managed PostgreSQL 17** in Singapore
(Neon, Supabase or AWS RDS `ap-southeast-1`) + **Cloudinary** (photos, music, gift screenshots).
Everything else (sessions, rate limits, audit log) lives in PostgreSQL, so there is no Redis or
queue to run.

> Keep the app and the database in the same region. Every page makes several database queries;
> crossing oceans adds hundreds of milliseconds per page.

---

## 1. One-time setup

### 1.1 Database

1. Create a PostgreSQL 17 database (e.g. `wedding_prod`).
2. Create two roles: one that may change the schema (migrations) and one the app uses (data only).

   ```sql
   -- run as the database owner
   CREATE ROLE wedding_migrator LOGIN PASSWORD '<long random>';
   CREATE ROLE wedding_app      LOGIN PASSWORD '<long random>';
   GRANT ALL ON SCHEMA public TO wedding_migrator;
   GRANT USAGE ON SCHEMA public TO wedding_app;
   -- Tables created by the migrator are automatically usable (DML only) by the app:
   ALTER DEFAULT PRIVILEGES FOR ROLE wedding_migrator IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO wedding_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE wedding_migrator IN SCHEMA public
     GRANT USAGE, SELECT ON SEQUENCES TO wedding_app;
   ```

   The append-only rules (audit log, gift history, reply history, no gift deletion) are database
   triggers, so they hold even for the app role.

3. Connection strings:
   - `DATABASE_URL`: the **pooled** URL for `wedding_app` (Neon: the `-pooler` host; Supabase:
     port 6543), with `sslmode=require`.
   - `DIRECT_URL`: the **direct** (non-pooled) URL for `wedding_migrator`. Used only by
     `prisma migrate`.

4. **Providers with their own certificate authority (Aiven, AWS RDS…).** If the app logs
   `self-signed certificate in certificate chain`, the database's certificate is signed by the
   provider's private CA. Download the CA certificate (Aiven: service page → *CA certificate*;
   RDS: the regional bundle) and set it as `DATABASE_CA_CERT` (the PEM text; on one line, write
   newlines as `\n`). The app then verifies the server against that CA. Verification is never
   switched off. Keep `sslmode=require` in the URLs. For `prisma migrate`, if it reports the same
   error, add Prisma's server-CA parameter to `DIRECT_URL`: `&sslcert=/absolute/path/ca.pem`.
5. **Tests never use these databases.** `TEST_DATABASE_URL` must point at a throwaway database
   whose name contains `test` (the local Docker `wedding_test`). The test runners refuse any other
   database because they empty it.

### 1.2 Cloudinary

1. Create a Cloudinary account (free tier is enough for a wedding).
2. Note the cloud name, API key and API secret.
3. Use a folder per environment: `CLOUDINARY_FOLDER=sila-kimsour-prod`.
4. Gift screenshots are uploaded as **authenticated** assets and are only shown to the admin
   through signed, short-lived URLs. Do not change that folder's access mode.

### 1.3 Secrets

Generate each secret separately and store it only in Vercel and your password manager:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"   # AUTH_SECRET, TOKEN_HASH_PEPPER, CRON_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"      # TOKEN_ENCRYPTION_KEY
```

> **Never change `TOKEN_HASH_PEPPER` or `TOKEN_ENCRYPTION_KEY` after invitations are sent.**
> Changing the pepper breaks every invitation link already sent. Changing the encryption key means
> admins can no longer re-display existing links (each one would have to be regenerated).

### 1.4 Vercel project

1. Import the repository in Vercel (framework preset: Next.js, Node 20.19+ or 22).
2. Environment variables (**Production** scope):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | pooled `wedding_app` URL |
   | `DIRECT_URL` | direct `wedding_migrator` URL (only needed where migrations run) |
   | `APP_URL` | `https://your-domain` (must be https) |
   | `AUTH_SECRET`, `TOKEN_HASH_PEPPER`, `CRON_SECRET` | 32+ random bytes each |
   | `TOKEN_ENCRYPTION_KEY` | 32 random bytes, base64 |
   | `MEDIA_STORAGE` | `cloudinary` (required in production) |
   | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | from Cloudinary |
   | `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | same cloud name |
   | `CLOUDINARY_FOLDER` | `sila-kimsour-prod` |
   | `NEXT_PUBLIC_DEFAULT_LOCALE` | `kh` |
   | `LOG_LEVEL` | `info` |

   The app validates all of these at startup (`src/lib/env.ts`) and refuses to start if any is
   missing or weak.

3. **Preview deployments must not use the production database.** Either give the Preview scope its
   own database and Cloudinary folder, or disable preview deployments.
4. `vercel.json` already sets the region (`sin1`) and a daily cleanup cron
   (`/api/cron/cleanup` at 20:00 UTC = 03:00 Phnom Penh). Vercel sends
   `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set.
5. Add your domain in Vercel → Domains. HTTPS is automatic; HSTS is sent in production.

### 1.5 First deployment

```bash
# From your machine, with production URLs in the environment (NOT in a committed file):
DATABASE_URL="<direct migrator URL>" DIRECT_URL="<direct migrator URL>" npx prisma migrate deploy

# Create the settings row and the shared admin account (once):
DATABASE_URL="<direct migrator URL>" ADMIN_SEED_USERNAME="couple" ADMIN_SEED_PASSWORD="<strong passphrase>" npm run db:seed
```

Then deploy on Vercel, and run the smoke test:

```bash
npm run smoke -- https://your-domain
```

Sign in at `https://your-domain/admin/login`, open **Security**, and confirm the session is listed.

---

## 2. Every later release

1. Locally: `npm run typecheck && npm run lint && npm run test:all && npm run test:e2e`.
2. If `prisma/migrations` changed: take a backup (section 4), then run
   `npx prisma migrate deploy` against `DIRECT_URL` **before** promoting the new app version.
   Migrations are written to be backward compatible with the previous app version (add first,
   remove later), so the old version keeps working while the migration runs.
3. Deploy (push to the production branch, or `vercel --prod`).
4. `npm run smoke -- https://your-domain`.

### Rollback

- **App:** Vercel → Deployments → previous deployment → *Promote to Production* (instant).
- **Database:** Prisma has no automatic down-migrations. Because migrations are additive, the
  previous app version normally runs on the newer schema, so an app rollback is enough. If a
  migration itself damaged data, restore the backup taken in step 2 (section 4.2).

---

## 3. Monitoring

| What | How |
| --- | --- |
| Uptime | Any uptime monitor (UptimeRobot, Better Stack…) on `GET /api/health` every 5 min. It returns `200 {"status":"ok","db":"ok"}`, or `503` when the database is unreachable. |
| Errors | Vercel → Logs. The app logs structured JSON (`level`, `event`, …) with secrets, tokens, passwords and cookies redacted. Filter on `"level":"error"`. |
| Cron | Vercel → Cron Jobs shows each run; the log line `cron.cleanup` lists what was removed. |
| Admin activity | **Activity log** page in the admin (sign-ins, link reveals, gift decisions, downloads, check-ins). |
| Database size | Your database provider's dashboard. A wedding uses well under 100 MB. |

---

## 4. Backup and restore

### 4.1 Backup

Managed providers keep automatic backups (Neon: point-in-time restore; Supabase: daily). In
addition, take your own copy **before every migration** and **the day after the wedding**:

```bash
pg_dump "<direct URL>" --format=custom --no-owner --file="wedding-$(date +%Y%m%d-%H%M).dump"
```

Store dumps encrypted (they contain guests' names, phone numbers and gift amounts).

Media: photos and music are in Cloudinary under `CLOUDINARY_FOLDER`. Keep the originals you
uploaded. For a full copy, use Cloudinary → Media Library → select folder → Download, or the
Admin API `resources` endpoint.

### 4.2 Restore

```bash
# Into an EMPTY database (new or freshly created):
pg_restore --no-owner --dbname="<direct URL of empty database>" wedding-YYYYMMDD-HHMM.dump
```

Then point `DATABASE_URL`/`DIRECT_URL` at it, redeploy, and run the smoke test. Invitation links
keep working only if `TOKEN_HASH_PEPPER` is unchanged.

Practise a restore once before the wedding (into a scratch database) so you know it works.

### 4.3 Local development database

```bash
docker exec wedding-postgres pg_dump -U wedding --format=custom wedding_dev > wedding_dev.dump
docker exec -i wedding-postgres pg_restore -U wedding --clean --no-owner -d wedding_dev < wedding_dev.dump
```

---

## 5. Production checklist

- [ ] `APP_URL` is the final https domain (invitation links and QR codes are built from it).
- [ ] All secrets are unique, 32+ bytes, and saved in a password manager.
- [ ] `MEDIA_STORAGE=cloudinary`; a test photo upload works and appears on the public site.
- [ ] Preview deployments do not use the production database.
- [ ] `npm run smoke -- https://your-domain` passes.
- [ ] Uptime monitor on `/api/health`.
- [ ] Backup taken and a test restore done.
- [ ] Admin password is a long passphrase; the seed variables are removed from every environment.
- [ ] Wedding facts (names, dates, venues, gift details) entered in the admin and checked by both
      of you on a phone.

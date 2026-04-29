# TDA FileShare

Private media manager built with Next.js 16 App Router, Supabase email/password
auth, Prisma/Postgres, and Go High Level Media Storage.

`/` redirects to `/dashboard` if a user is logged in, otherwise to `/login`.
Authenticated users land on the dashboard and stay signed in until they log out.

## Architecture

- **Auth gate** — `src/proxy.ts` runs on every request, refreshes the Supabase
  session cookies, and redirects unauthenticated users away from
  `/dashboard`.
- **Server-side auth API** — `/api/auth/signup`, `/api/auth/signin`,
  `/api/auth/signout`, `/api/auth/sync` create/refresh both the Supabase user
  *and* the local Postgres `AppUser` record in one round trip so the database
  is always consistent with Supabase.
- **Two-stage media loading** — `/api/media/files` returns the local Postgres
  cache instantly for fast first paint; `/api/media/sync` runs in the
  background to reconcile with Go High Level.
- **Owner-only sharing** — every share request checks `ownerId == requester.id`
  in the database; the UI hides share controls for items shared with you.

## Environment

Copy `.env.example` to `.env` and fill the values. Next.js and Prisma both read
this file during local development.

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres?sslmode=require
DIRECT_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres?sslmode=require

TOKEN_ENCRYPTION_KEY=replace-with-32-byte-base64-key

GHL_CLIENT_ID=your-ghl-client-id
GHL_CLIENT_SECRET=your-ghl-client-secret
GHL_AUTH_URL=https://marketplace.leadconnectorhq.com/oauth/chooselocation
GHL_TOKEN_URL=https://services.leadconnectorhq.com/oauth/token
GHL_API_BASE_URL=https://services.leadconnectorhq.com
GHL_API_VERSION=2021-07-28
GHL_USER_TYPE=Location
GHL_ADMIN_EMAILS=admin@example.com
GHL_SCOPES=medias.readonly medias.write locations.readonly oauth.readonly oauth.write
GHL_DEFAULT_LOCATION_ID=

SUPABASE_ACCESS_TOKEN=
SUPABASE_PROJECT_REF=
SUPABASE_AUTH_SITE_URL=http://localhost:3000
SUPABASE_SMTP_ADMIN_EMAIL=auth@mail.cpmaustralia.com
SUPABASE_SMTP_HOST=smtp.mailgun.org
SUPABASE_SMTP_PORT=587
SUPABASE_SMTP_USER=auth@mail.cpmaustralia.com
SUPABASE_SMTP_PASS=your-mailgun-smtp-password
SUPABASE_SMTP_SENDER_NAME=TDA FileShare
SUPABASE_AUTH_EMAIL_RATE_LIMIT_PER_HOUR=100
```

Generate the encryption key with:

```bash
openssl rand -base64 32
```

## Auth Redirect URLs

In your Supabase project (Authentication → URL Configuration):

- **Site URL**: `http://localhost:3000` for local, your live domain for prod.
- **Redirect URLs**: add both `http://localhost:3000/auth/confirm` and
  `http://localhost:3000/auth/callback` (use the live domain for prod).

In Go High Level (Marketplace OAuth):

- Redirect URL: `http://localhost:3000/api/oauth/callback`

## Supabase Auth SMTP

Supabase sends signup confirmation, password reset, invite, and email-change
messages from its own Auth service, so SMTP has to be configured at the
Supabase project level. The included script does that via the Supabase
Management API.

1. Set every `SUPABASE_SMTP_*` value in `.env`. The password for Mailgun is the
   SMTP password listed under the Mailgun domain *Sending → Domain settings*,
   not the API key. If signup emails never arrive, it is almost always because
   this password is wrong or the domain is unverified in Mailgun.
2. Create a Supabase Management API access token at
   <https://supabase.com/dashboard/account/tokens> and put it in
   `SUPABASE_ACCESS_TOKEN`.
3. Preview the configuration:

   ```bash
   npm run supabase:smtp:configure -- --dry-run
   ```

4. Apply the configuration:

   ```bash
   npm run supabase:smtp:configure
   ```

The script enables custom SMTP, keeps email confirmation required
(`mailer_autoconfirm = false`), and points the Supabase Auth site URL at
`SUPABASE_AUTH_SITE_URL`. Re-run it whenever the SMTP credentials change.

If you want to skip the email confirmation step entirely for development,
go to Supabase Dashboard → Authentication → Providers → Email and disable
**Confirm email**. The signup endpoint will still create the local
`AppUser` record immediately and return a session.

## GHL Backend Setup

GHL is connected once by an administrator and is not shown as a user-facing
connection step. Add your admin login email to `GHL_ADMIN_EMAILS`, sign in with
that email, then open:

```text
http://localhost:3000/api/ghl/oauth/start
```

That starts the GHL authorization flow and stores one encrypted, app-wide token
record. Normal users keep using `/dashboard`; their file actions use the shared
backend connection.

The access token refreshes automatically on server-side API calls when it gets
close to expiry. For production set `NEXT_PUBLIC_APP_URL` to the live URL and
add this redirect URL in the GHL Marketplace app:

```text
https://your-domain.com/api/oauth/callback
```

## Database

Run the Prisma migration against your Supabase Postgres database:

```bash
npm run prisma:migrate
```

Then start the app:

```bash
npm run dev
```

Open <http://localhost:3000>. It will redirect to `/login`.

## Media Features

- Email/password sign-in and sign-up that creates the local `AppUser` record on
  the same request, so the database is consistent before email confirmation
- Persistent Supabase sessions refreshed in the proxy
- Fast initial render from the local cache, with background reconciliation
  against Go High Level
- Optimistic UI: uploads, renames, moves, and deletes update the list
  immediately
- Drag-and-drop file upload, multi-file upload progress
- Skeleton loading states, click-outside menu close, keyboard `Esc` close
- Owner-only rename, move, delete, and **share** controls. Recipients of a
  shared file or folder can view and download but **cannot re-share**
- Email-based file/folder sharing with auto-link when the recipient signs up
- Grid and list views, search, type filter, sort, breadcrumb navigation, and
  preview dialog
- Admin-only GHL OAuth authorization-code flow with encrypted token storage

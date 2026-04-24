# TDA FileShare

Private media manager built with Next.js App Router, Supabase email/password auth,
Prisma/Postgres, and Go High Level Media Storage.

`/` redirects to `/login`. Authenticated users land on `/dashboard` and stay
signed in until they click **Log out**.

## Environment

Copy `.env.example` to `.env` and fill these values. Next.js and Prisma will
both read this file during local development:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres?sslmode=require

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
SUPABASE_SMTP_PASS=your-smtp-password
SUPABASE_SMTP_SENDER_NAME=TDA FileShare
SUPABASE_AUTH_EMAIL_RATE_LIMIT_PER_HOUR=100
```

Generate the encryption key with:

```bash
openssl rand -base64 32
```

## Auth Redirect URLs

If email confirmation is enabled in Supabase, add this while developing locally:

```text
Supabase email confirmation redirect URL:
http://localhost:3000/auth/confirm

GHL Marketplace OAuth redirect URL:
http://localhost:3000/api/oauth/callback
```

For production, replace `http://localhost:3000` with your deployed app URL.

## Supabase Auth SMTP

Supabase sends account confirmation, password reset, invite, and email-change
messages from the Supabase Auth service, so the custom SMTP server has to be
configured on the Supabase project rather than in the login form.

Set the `SUPABASE_SMTP_*` values in `.env` from the Go High Level SMTP
credentials, then create a Supabase Management API access token at
`https://supabase.com/dashboard/account/tokens` and set it as
`SUPABASE_ACCESS_TOKEN`. `SUPABASE_PROJECT_REF` is optional when
`NEXT_PUBLIC_SUPABASE_URL` points at the project.

Preview the configuration without sending it:

```bash
npm run supabase:smtp:configure -- --dry-run
```

Apply the configuration:

```bash
npm run supabase:smtp:configure
```

The script enables custom SMTP, keeps email confirmation required, sets the
Supabase Auth site URL from `SUPABASE_AUTH_SITE_URL` or `NEXT_PUBLIC_APP_URL`,
uses the configured Go High Level SMTP credentials, and optionally updates
`rate_limit_email_sent` from `SUPABASE_AUTH_EMAIL_RATE_LIMIT_PER_HOUR`.

## GHL Backend Setup

GHL is connected once by an administrator and is not shown as a user-facing
connection step. Add your admin login email to `GHL_ADMIN_EMAILS`, sign in to
the app with that email, then open:

```text
http://localhost:3000/api/ghl/oauth/start
```

That starts the GHL authorization flow and stores one encrypted app-wide token
record. Normal users keep using `/dashboard`; their file and folder actions use
the shared backend media connection.

The access token will be refreshed on server-side API calls when it is close to
expiry, as long as GHL continues to accept the stored refresh token. Moving to a
live domain should not require users to re-authorize. For production, set
`NEXT_PUBLIC_APP_URL` to the live app URL and add this redirect URL in GHL:

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

Open [http://localhost:3000](http://localhost:3000). It will redirect to
`/login`.

## Media Features

- Supabase email/password sign-in and account creation
- Persistent Supabase browser sessions with server-side refresh through Next proxy
- Admin-only GHL OAuth authorization-code flow with client credentials sent in the token body
- Encrypted app-wide GHL access and refresh token storage
- Postgres tracking for every file and folder created through the app, including
  the owner user and parent folder
- Email-based file and folder sharing with a **Shared with me** dashboard view
- Owner-only rename, move, delete, and share controls
- Media listing, upload, create folder, rename, move, single delete, bulk move,
  bulk trash/delete, preview, copy link, grid/list views, search, filters,
  sorting, and folder breadcrumbs

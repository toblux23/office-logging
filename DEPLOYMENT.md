# Deployment & Bootstrap

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Vercel](https://vercel.com) account (or other Node.js host)

---

## 1. Supabase project setup

Create a Supabase project, then go to **SQL Editor** and run the entire contents
of [`supabase-setup.sql`](./supabase-setup.sql). This creates:

- `logs` table — attendance entries
- `users` table — registered staff/intern profiles
- `admin_activity_logs` table — audit trail for admin actions
- `admin_config` table — stores admin email addresses
- `log-images` storage bucket
- Row Level Security policies

---

## 2. Environment variables

Copy the example file:

```bash
cp .env.local.example .env.local
```

### Required (public — safe in client)

Get these from **Supabase Dashboard → Settings → API**:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |

### Required (secret — never commit or expose client-side)

| Variable | Description |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` key (Settings → API) |
| `ADMIN_EMAIL` | Initial admin email address |
| `ADMIN_PASSWORD` | Initial admin password |

> **Why `service_role`?**  
> It bypasses RLS and can create users in Supabase Auth. It's only used by the
> one-time setup script and the `POST /api/admin/create` API route — both run
> server-side, never in the browser.

---

## 3. Bootstrap the first admin

Run the setup script **once** after deploying:

```bash
node scripts/setup-admin.mjs
```

This will:

1. Create the admin user in **Supabase Auth** (email + password, pre-confirmed)
2. Insert the admin email into the **`admin_config`** table

The script reads `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`ADMIN_EMAIL`, and `ADMIN_PASSWORD` from your environment.

> **Already ran it?** Re-running is safe — it skips if the user or config row
> already exists.

---

## 4. Deploy to Vercel

### 4a. Connect repository

Push to GitHub/GitLab/Bitbucket, then import the repo in Vercel.

### 4b. Add environment variables

In **Vercel Dashboard → Project → Settings → Environment Variables**, add all
four variables from step 2:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ADMIN_EMAIL
ADMIN_PASSWORD
```

### 4c. Deploy

Vercel auto-deploys on push. After the first deploy completes:

```bash
# Pull the Vercel env vars locally and run the setup script
vercel pull
node scripts/setup-admin.mjs
```

Or run the script in any environment that has the env vars set (CI pipeline,
SSH session, etc.).

### 4d. (Optional) Clean up

Once the admin account is created, `ADMIN_PASSWORD` and
`SUPABASE_SERVICE_ROLE_KEY` are no longer needed in local `.env.local` — you
can remove them. Keep them in Vercel in case you need to re-run the script.

---

## 5. Sign in

Navigate to `/login` and sign in with the admin email + password you configured.

---

## 6. Adding more admins

The initial admin can add more admins from the **Admin Management** tab inside
the dashboard at `/logs`. This calls `POST /api/admin/create` which uses the
`service_role` key server-side to:

1. Create the user in Supabase Auth
2. Add their email to `admin_config`

No additional setup scripts needed.

---

## Local development with mock mode

If `NEXT_PUBLIC_SUPABASE_URL` contains `placeholder` or `your-project`, the app
runs in **mock mode** using `localStorage`. No Supabase connection needed:

- Default admin: `admin@startuplab.com` / `admin123`
- Mock seed data: Alice Vance (staff), Bob Smith (staff), Charlie Brown (intern)

```bash
npm run dev
```

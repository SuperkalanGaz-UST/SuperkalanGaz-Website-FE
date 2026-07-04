# Superkalan Gaz CRM — Web

`superkalan-crm-web`, a Next.js 14 (App Router) app for the Superkalan Gaz CRM. It serves
three personas — Franchise Admin, Branch Owner, and Branch Manager — behind a single login.
Authentication and user records are backed by **Supabase Auth**.

## Prerequisites

- **Node.js 18.18+** (or 20+) and npm
- A **Supabase project** — one already exists for this app (project ref `oauxrwyjwfygnfnwgxfg`)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in the values:

```bash
cp .env.example .env.local
```

`.env.local` (gitignored) needs three values:

| Variable | Purpose | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (browser-safe) | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable/anon key (browser-safe) | Supabase Dashboard → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only secret** for creating/editing/deleting users | Supabase Dashboard → Project Settings → API → `service_role` |

The URL and anon key are pre-filled in `.env.example`. **You must add the `service_role` key
yourself** — it is never committed.

> **Security:** `SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security. It is used only in
> server-side route handlers (`src/app/api/users/**`) and must never be exposed to the browser
> or prefixed with `NEXT_PUBLIC_`.

Login works without the service-role key; only **user management** (create/edit/delete) requires it.

### 3. Run the app

```bash
npm run dev
```

Open http://localhost:3000.

## Logging in

Users live in Supabase Auth. Log in by **username** (mapped internally to
`<username>@superkalan.com`). The four seed accounts:

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Franchise Administrator |
| `owner` | `owner123` | Branch Owner (Quezon City) |
| `owner.multi` | `owner123` | Branch Owner (all branches) |
| `manager` | `manager123` | Branch Manager (Quezon City) |

After login, a floating persona switcher lets you preview the other dashboards.

> These demo credentials are also listed on the login screen. Remove that panel (and rotate
> the passwords) before going to production.

## How auth & users work

- **`auth.users`** (Supabase) is the source of truth for identity and passwords.
- **`public.profiles`** holds the CRM claims — `role`, `branches`, `username`, `display_name`,
  `phone`, `status`, `email`. A database trigger auto-creates a profile row whenever an auth
  user is created, so creating the auth user is all that's needed.
- **Creating new users:** the Branch Owner's *User Management* screen posts to `/api/users`,
  which calls the Supabase Auth Admin API. New users are stored in Supabase Auth, not in app
  memory.

Relevant files:

```
src/app/lib/auth.ts              # signIn() — signInWithPassword + profile load
src/app/lib/supabase/client.ts   # browser client (anon key)
src/app/lib/supabase/admin.ts    # server-only admin client (service_role)
src/app/api/users/route.ts       # GET (list) / POST (create)
src/app/api/users/[id]/route.ts  # PATCH (update) / DELETE
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Troubleshooting

- **"Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" when managing users** —
  the `service_role` key isn't set in `.env.local`. Add it and restart `npm run dev`.
- **"Invalid username or password"** — the account doesn't exist in Supabase Auth, or the
  password is wrong. Check the users in the Supabase Dashboard → Authentication.
- **Env changes not taking effect** — restart the dev server; Next.js only reads `.env.local`
  at startup.

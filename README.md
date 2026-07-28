# Superkalan Gaz CRM — Web

`superkalan-crm-web`, a Next.js 14 (App Router) app for the Superkalan Gaz CRM. It serves
three personas — Franchise Admin, Branch Owner, and Branch Manager — behind a single login.
Authentication and user records are backed by **Supabase Auth**.

## Prerequisites

- **Node.js 18.18+** (or 20+) and npm
- A **Supabase project** — one already exists for this app (project ref `oauxrwyjwfygnfnwgxfg`)
- The **`superkalan-crm-api` NestJS backend** running locally or available at a configured URL

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
| `NEXT_PUBLIC_API_URL` | Base URL of the NestJS backend | Local default: `http://localhost:3001` |

> **Security:** The web app must never receive a Supabase service-role key. Auth
> administration and all CRM business logic run in `superkalan-crm-api`; the browser sends
> its Supabase access token to that backend.

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
- CRM claims—`role`, `branches`, `username`, `display_name`, `phone`, and `status`—live in
  each Auth user's service-role-managed **`app_metadata`**. There is no `public.profiles`
  mirror or signup trigger.
- **Creating new users:** the Branch Owner's *User Management* screen posts to `/api/users`,
  on the NestJS backend, which calls the Supabase Auth Admin API and writes the claims.

Relevant files:

```
src/app/lib/auth.ts                              # sign-in and app_metadata projection
src/app/lib/supabase/client.ts                   # browser Auth client (anon key)
src/app/lib/api.ts                               # authenticated NestJS API client
src/app/branch-owner/components/UserManagement.tsx
../superkalan-crm-api/src/users/users.controller.ts
../superkalan-crm-api/src/users/users.service.ts
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |

## Troubleshooting

- **User management requests fail** — confirm `NEXT_PUBLIC_API_URL` points to the running
  NestJS API and that the browser session has a valid Supabase access token.
- **"Invalid username or password"** — the account doesn't exist in Supabase Auth, or the
  password is wrong. Check the users in the Supabase Dashboard → Authentication.
- **Env changes not taking effect** — restart the dev server; Next.js only reads `.env.local`
  at startup.

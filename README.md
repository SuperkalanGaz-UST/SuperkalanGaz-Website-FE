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

## Map stack and data flow

The internal staff maps use three distinct layers:

1. **MapLibre GL JS 5.x** renders interactive maps in the browser using WebGL.
2. **OpenFreeMap** hosts the `liberty` map style and vector tiles used by MapLibre.
3. **OpenStreetMap** is the underlying geographic-data source used by OpenFreeMap.

The browser therefore requests the style and vector tiles from
`tiles.openfreemap.org`; it does not request raster tiles from
`tile.openstreetmap.org`. The NestJS backend does not render maps or proxy public map
tiles—it only supplies CRM-owned data such as rider coordinates and branch geofences.

Current boundaries and conventions:

- MapLibre/GeoJSON expects `[longitude, latitude]`, while existing CRM domain data stores
  polygon points as `[latitude, longitude]`. Convert only at the renderer boundary through
  `src/app/lib/mapConfig.ts`; do not change the persisted contract silently.
- The shared OpenFreeMap style is configured in `src/app/lib/mapConfig.ts` and currently
  uses `https://tiles.openfreemap.org/styles/liberty`.
- Keep the map attribution control visible. OpenFreeMap automatically provides the required
  OpenMapTiles/OpenStreetMap attribution through its source metadata.
- Geocoding is not implemented. Known branch addresses come from the API snapshot, and the
  province selector uses approximate local centroids only to frame the map.
- Fleet positions are still mock data until the deferred SinoTrack ST-901 → Traccar → API
  integration is implemented. This does not change the chosen rendering/tile stack.
- The customer mobile app continues to show delivery milestones only and must not display
  live coordinates or an internal fleet map.

Relevant map files:

```
src/app/lib/mapConfig.ts
src/app/components/DrawableMap.tsx
src/app/branch-manager/screens/fleet/FleetMap.tsx
src/app/branch-owner/components/BranchOwnerFleetMap.tsx
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

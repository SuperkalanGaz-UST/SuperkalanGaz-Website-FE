# DESIGN.md — Superkalan Gaz CRM Web

> UI/UX format for the internal staff dashboard (`superkalan-crm-web`). The **Branch
> Owner persona is the reference implementation** — new screens and persona refactors
> (FA / BM) should follow this format. Behavior and permissions come from Jira + AGENTS.md
> (§7 RBAC); this file governs how screens *look and are assembled*.

Reference implementation: `src/app/branch-owner/`.

---

## 1. Design Principles

- **Analytical, minimalist dashboard.** White cards on a light gray canvas, recessive
  axes, no chart grid clutter. Data is the ink; chrome stays quiet.
- **One visual format for all personas.** What differs per persona is *data and
  navigation entries* (RBAC), never the styling.
- **Real session data only.** Names, roles, and branches render from `AccountContext`
  and `BranchContext` — never hardcoded personas (panel-defense point).
- **Responsive by default.** Flexbox/grid utilities only; grids collapse
  (`grid-cols-1` → `sm:` → `lg:`/`xl:`); no absolute positioning unless necessary.
- **Chart colors are computed, not eyeballed.** Every categorical palette used here
  passed a CVD-separation/contrast validator before shipping. Don't introduce new
  chart colors ad hoc — reuse the tokens in §2.

---

## 2. Color Tokens

| Token | Hex | Use |
| --- | --- | --- |
| Brand blue | `#007BC1` | Primary actions, chart line/bar default, focus rings, avatar chip |
| Brand blue (light step) | `#41A3E0` | Alternating bar shade (paired with brand blue) |
| Sidebar blue (dark) | `#00568A` | Sidebar background |
| Sidebar highlight | `#1D8DCB` | Active nav item (full-width highlight) |
| Brand red | `#CC1903` | Alert values, destructive accents |
| Trend green | `text-green-600` | Positive KPI movement |
| Trend red | `text-red-600` | Negative KPI movement |
| Categorical trio | `#EA580C` / `#16A34A` / `#9333EA` | Multi-category lists (e.g. tank sizes) — fixed order, never cycled |
| Canvas | `bg-gray-50` | App background behind cards |
| Card surface | `bg-white` + `shadow-sm` + `border-gray-100` | All cards |

Rules:
- **Identity is never color-alone** — every colored mark carries a visible text label.
- Text always wears text tokens (`text-gray-900/700/500`), never the series color.
- One y-axis per chart. Two measures of different scale → two charts.

---

## 3. App Shell

```
┌────────────┬──────────────────────────────────────────────┐
│  Sidebar   │  Header (title | branch pill · search · user)│
│  240px     ├──────────────────────────────────────────────┤
│  #00568A   │  Content  p-8, bg-gray-50, overflow-y-auto   │
│            │    KPI row → chart rows → tables             │
└────────────┴──────────────────────────────────────────────┘
```

Screen components render `<Header title="…" />` at the top, then their content inside
`<div className="p-8">`. Screen switching is client-side state in the persona's
`*App.tsx` (e.g. `BranchOwnerApp.tsx`), not routes.

---

## 4. Header (`components/Header.tsx`)

- White bar, `border-b border-gray-200`, `px-8 py-4`.
- **Left:** page title only (`text-2xl font-semibold`). **No subtitles** — the old
  descriptive sub-title line is removed everywhere.
- **Right, in order:**
  1. **Branch pill** — subtle chip (`bg-blue-50 text-[#00568A] rounded-full text-xs`)
     showing the persona's scope context. For multi-branch owners it doubles as the
     branch switcher dropdown. Scope comes from the login (AGENTS.md §5), never from
     user-editable input.
  2. **Search input** — `w-56`, gray fill, magnifying-glass icon inside-left, hidden
     below `md:`. (Visual scaffold; API wiring is a separate story.)
  3. **User profile** — initials avatar circle (brand blue) + display name and role
     label from `AccountContext`/`ROLE_LABELS`. Text hidden below `sm:`.

The header carries **no logout button** — logout lives in the sidebar (§5). The
shared implementation is `src/app/components/AppHeader.tsx`; each persona wraps it
with its own badge (FA: static "Main Office" pill; BO: branch selector; BM: their
branch, with the title driven per-screen from the app shell).

---

## 5. Sidebar (`src/app/components/AppSidebar.tsx`)

One shared implementation for all three personas; each persona's `Sidebar` /
`BMSidebar` is a thin wrapper that only supplies its nav entries.

- Fixed `w-[240px]`, full height, solid **`#00568A`**, white logo card at top.
- **No profile widget.** The user profile lives in the header, not the sidebar.
- **Logout button pinned at the bottom** (all personas): full-width, solid brand red
  (`bg-[#CC1903] hover:bg-[#b01602]`), `LogOut` icon + "Log out", above a
  `border-t border-white/20`. Wired to `useLogout()` from `AccountContext`, which
  ends the real Supabase session and returns to the login screen.
- Nav supports two entry kinds:
  - **Leaf link** — icon + label, `px-6 py-2.5`.
  - **Collapsible group** — icon + label + chevron (`ChevronDown`, rotates 180° when
    open). Children are indented (`pl-[3.25rem]`), no icons.
- **Active state:** full-width lighter-blue highlight (`bg-[#1D8DCB]`, white text) —
  not a rounded pill. Hover: `bg-white/10`. A collapsed group holding the active
  screen shows a muted highlight (`bg-[#1D8DCB]/40`).
- The group containing the active screen **auto-expands**, including when navigation
  happens outside the sidebar (window `navigate` events, drill-in screens).
- Branch Owner nav structure (ids map to existing screens — RBAC surface unchanged):

| Entry | Type | Children (screen id) |
| --- | --- | --- |
| Dashboard | leaf | `dashboard` |
| Analytics | group | Order Analytics (`order-analytics`), Sales (`sales-overview`), Operational Expenses (`operational-expenses`) |
| Customer | group | Ratings & Reviews (`csat`), Loyalty Program (`loyalty`) |
| Operations | group | Inventory (`supply-chain`), Pricing (`branch-pricing`), Fleet (`fleet-overview`) |
| User Management | leaf | `user-management` |
| Reports | leaf | `reports` |
| Settings | leaf | `settings` |

Other personas substitute their own entries per AGENTS.md §7 (the UI must not
render actions a role can't perform): FA and BM currently use flat leaf lists
(no groups), which the same component supports.

---

## 6. KPI Cards (`components/KPICard.tsx`)

White card, `rounded-xl shadow-sm border-gray-100 p-5`. Anatomy, top to bottom:

1. **Icon chip** (top-right, absolute): `w-9 h-9` circle tinted at ~15% alpha of the
   card's `accentColor`; icon inside at `w-4 h-4` in the accent color.
2. **Title:** `text-sm font-medium text-gray-500`.
3. **Value:** `text-3xl font-semibold text-gray-900` (`#CC1903` when `alert`).
4. **Trend indicator** (optional): arrow (`ArrowUpRight` / `ArrowDownRight`) + text,
   `text-xs font-medium`. `direction` (arrow) and `positive` (green/red) are separate
   props — a downward move can be good news (e.g. expenses).

KPI row: `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6`.

Dashboard reference row: Orders Today · Delivery Completion Rate · Average CSAT
Score · Loyalty Claims This Month, each with an icon chip and a trend line.

---

## 7. Charts (Recharts)

All charts live inside a standard card with an `h3` title (`font-semibold`) and
`ResponsiveContainer` at `height={220}`. Shared conventions:

- **No `CartesianGrid`.** Axes are recessive: `axisLine={false} tickLine={false}`,
  `stroke #9ca3af`, 11px ticks.
- **Tooltips always on** (peso values formatted `₱n,nnn`).
- **Lines/areas:** `type="monotone"`, `strokeWidth={2}`, **`dot={false}`** — smooth,
  markerless; `activeDot={{ r: 4 }}` for hover only.
- **Bars:** rounded top corners (`radius={[4,4,0,0]}`); alternating fills use the
  two blue steps via `<Cell>`.
- **Area fills:** vertical gradient of brand blue, 25% → 2% opacity.
- Fixed axis windows are allowed when comparability matters (e.g. Order Volume Trend
  pins `domain={[75, 300]}`, `ticks={[75, 150, 225, 300]}`).

Dashboard reference layout (two 2-column rows, `grid-cols-1 lg:grid-cols-2 gap-6`):

| Card | Form |
| --- | --- |
| Earnings for Today | Bar chart, 8 AM–6 PM, alternating blues |
| Earnings for this Month | Smooth area chart, Week 1–5, no dots |
| Top Selling Tank | **Not a chart** — progress-bar list: label left, "N Orders" right, colored bar (`h-2.5 rounded-full` on `bg-gray-100` track) scaled to the max row |
| Order Volume Trend | Smooth line, fixed 75–300 y-scale, no dots |

---

## 8. Data Conventions

- KPI values and trends come from a branch-keyed hook (`hooks/useBranchData.ts`)
  scoped by `BranchContext` — switching branches must update every card.
- All current figures are **demo mocks pending API wiring**; comment them as such
  (AGENTS.md §13 — never present invented numbers as client-confirmed).
- The web app talks to the API only; no direct DB access (AGENTS.md §12).

### 8a. Map surfaces

- Use **MapLibre GL JS 5.x** for every interactive staff map. **OpenFreeMap** supplies the
  `liberty` style and vector tiles, which are derived from **OpenStreetMap** geographic data.
- Keep the visual hierarchy consistent across the branch-registration geofence map and the
  Branch Owner/Branch Manager fleet maps: quiet base map, brand-blue geofence, and
  status-colored rider markers with text-bearing popups.
- Keep provider attribution visible inside the map. Do not cover it with cards, controls,
  or modal actions.
- CRM geometry remains `[latitude, longitude]`; convert to MapLibre/GeoJSON's
  `[longitude, latitude]` order only through `src/app/lib/mapConfig.ts`.
- MapLibre/OpenFreeMap are presentation infrastructure, not location-data business logic.
  Rider coordinates come from the API once the SinoTrack ST-901 → Traccar ingestion is
  available; the current fleet coordinates must remain clearly identified as mocks.
- Do not add geocoding implicitly. Address-to-coordinate lookup is not implemented and is a
  separate product/architecture decision.
- These maps are internal staff surfaces. The customer mobile app exposes delivery
  milestones only and never live coordinates.

---

## 9. File Map (Branch Owner reference)

| File | Role |
| --- | --- |
| `src/app/components/AppSidebar.tsx` | Shared sidebar shell + logout footer (§5) |
| `src/app/components/AppHeader.tsx` | Shared page header (§4) |
| `src/app/branch-owner/BranchOwnerApp.tsx` | Shell: sidebar + active-screen switch |
| `src/app/branch-owner/components/Sidebar.tsx` | BO nav entries → AppSidebar (§5) |
| `src/app/branch-owner/components/Header.tsx` | BO branch badge → AppHeader (§4) |
| `src/app/branch-owner/components/KPICard.tsx` | Stat tile (§6) |
| `src/app/branch-owner/components/Dashboard.tsx` | Reference dashboard (§6–§7) |
| `src/app/branch-owner/hooks/useBranchData.ts` | Branch-scoped mock data (§8) |
| `src/app/lib/mapConfig.ts` | OpenFreeMap style URL + coordinate-order conversion (§8a) |
| `src/app/branch-owner/components/BranchOwnerFleetMap.tsx` | MapLibre fleet map (§8a) |
| `src/app/contexts/AccountContext.tsx` | Real logged-in account (`useAccount`) + session logout (`useLogout`) |
| `src/app/branch-owner/contexts/BranchContext.tsx` | Selected/available branches |

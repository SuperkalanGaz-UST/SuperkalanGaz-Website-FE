Good — now I can give you exact, screen-by-screen edit instructions based on what's actually in your mockups. Let me go through each one.

---

## Critical Problem to Flag First

**Image 3 & 4 — Franchise Management (Settings) is wrong for this role.**

The Franchise Admin should NOT have editable fields for:
- Reward Threshold (`30`)
- Low-Stock Alerts per cylinder type
- Standard Delivery SLA (minutes)
- SLA Breach Notification Method

Those are **Branch Owner / Branch Manager** configurations — they're branch-level operational settings. The Franchise Admin sets **system-wide policy**, not per-branch thresholds. If your panel sees an admin-level user editing a single branch's stock alert numbers, they will call it out as a role boundary violation.

Fix options covered in the Settings section below.

---

## Image 1 & 2 — Branch Performance Page

### Page header
- **Title:** `Order Analytics` → `Branch Performance`
- **Subtitle:** `Track order trends and delivery performance.` → `Franchise-wide order performance across all branches.`

### KPI cards (3 cards at top)
| Current label | Current value | Change label to | Change value to |
|---|---|---|---|
| `TOTAL ORDERS` | `284` | `TOTAL ORDERS — ALL BRANCHES` | `1,847` |
| `COMPLETED DELIVERIES` | `274` | `COMPLETED DELIVERIES — ALL BRANCHES` | `1,739` |
| `CANCELLED / FAILED` | `10` | `CANCELLED / FAILED — ALL BRANCHES` | `108` |

### Daily Order Volume chart
- **Title:** `Daily Order Volume` → `Daily Order Volume — All Branches`
- **Bars:** Currently single-color blue representing one branch. Add a **Branch filter dropdown** above the chart (top-right corner of the chart card): `All Branches ▼` with options: All Branches / Quezon City / Calamba / Sta. Rosa
- Keep the bar chart as-is visually — the dropdown implies it can be filtered per branch, which is the correct Franchise Admin interaction pattern. You don't need to redesign the chart itself.

### Orders by Status donut chart
- **Title:** `Orders by Status` → `Orders by Status — All Branches`
- **Legend values:** Update percentages to reflect aggregate:
  - `Delivered: 96%` → `Delivered: 94%`
  - `Cancelled: 2%` → `Cancelled: 3%`
  - `Failed: 2%` → `Failed: 3%`
- Adjust the donut slice sizes to roughly match the new percentages

### Delivery Completion Rate table (Image 2)
This table is the most important element on this page. It currently shows one branch's monthly data. The Franchise Admin version needs a **Branch column added**.

**Add a new first column:** `Branch`

Updated table structure:

| Branch | Month | Total Orders | Completed | Completion Rate % | SLA Breaches |
|---|---|---|---|---|---|
| Quezon City | January 2026 | 268 | 260 | 97% | 🟢 8 |
| Calamba | January 2026 | 241 | 229 | 95% | 🔴 14 |
| Sta. Rosa | January 2026 | 255 | 248 | 97.3% | 🟢 6 |
| Quezon City | February 2026 | 272 | 265 | 97.4% | 🟢 7 |

Add a **branch filter dropdown** at the top-right of the table: `All Branches ▼` — same as the chart above.

**SLA Breaches column:** Keep the colored badge logic — green for low breach count, red for high. Calamba's `14` should be red to show it's underperforming. This gives the Franchise Admin an at-a-glance view of which branch needs attention — exactly what this role is for.

---

## Image 3 & 4 — Franchise Management (Settings) Page

### Page header
- **Title:** `Settings` → `Franchise Management`
- **Subtitle:** `Configure branch operations.` → `Manage branch accounts and system-wide service policies.`

### What to REMOVE entirely
Delete these three sections — they are branch-level config, not franchise-level:
- ~~Loyalty Program~~ (Reward Threshold input + dual auth toggle)
- ~~Low-Stock Alerts~~ (11kg, 22kg, 50kg cylinder inputs)
- ~~Standard Delivery SLA (minutes)~~ input field

### What to KEEP and UPDATE

**SLA section — keep but reframe:**
- Section title: `SLA` → `System-Wide SLA Policy`
- Field label: `Standard Delivery SLA (minutes)` → `Default SLA Threshold — All Branches (minutes)`
- Helper text: `Target delivery time for all orders in this branch` → `This sets the default SLA applied to all new branches. Individual branches cannot override this.`
- Value stays `60`
- `SLA Breach Notification Method` — keep as-is, label is already appropriate at this level

### What to ADD — three new sections

**Section 1: Branch Account Management**
```
Branch Account Management
─────────────────────────────────────────
[+ Approve New Branch]        [View All Branches]

Branch Name        Status          Date Registered
Quezon City        ● Active        Jan 12, 2025
Calamba            ● Active        Feb 3, 2025
Sta. Rosa          ● Active        Mar 18, 2025
Pending Approval   ○ Pending       May 1, 2026    [Approve] [Reject]
```

This is the primary reason the Franchise Admin exists in your system. If this section isn't here, your panel will ask what this role actually does that the Branch Owner can't.

**Section 2: System-Wide Loyalty Policy**
```
System-Wide Loyalty Policy
─────────────────────────────────────────
Reward Threshold (applies to all branches)
[ 30 ]
Number of purchases before a free tank reward is flagged.
Branch Owners cannot change this value.

Require dual authorization for all redemptions  [toggle ON]
```

This is the correct level for this setting — the Franchise Admin sets the policy, Branch Owners operate within it. Replace the editable branch-level loyalty section from before with this framing.

**Section 3: System-Wide Low-Stock Policy**
```
System-Wide Low-Stock Alert Defaults
─────────────────────────────────────────
These are default thresholds applied when a new branch is onboarded.
Existing branches manage their own thresholds within these limits.

Minimum allowed threshold — 11kg Cylinders:  [ 10 ]
Minimum allowed threshold — 22kg Cylinders:  [ 5  ]
Minimum allowed threshold — 50kg Cylinders:  [ 3  ]
```

This reframes it correctly — Franchise Admin sets the **floor**, Branch Owners set their own numbers above that floor.

---

## Summary of All Changes

| Screen | Key changes |
|---|---|
| Branch Performance — header | Title + subtitle updated to franchise scope |
| Branch Performance — KPI cards | Values aggregated, labels say "All Branches" |
| Branch Performance — charts | Titles updated, branch filter dropdown added |
| Branch Performance — table | Branch column added, multi-branch rows, SLA breach badges color-coded |
| Franchise Management — header | Title + subtitle updated |
| Franchise Management — removed | Branch-level loyalty inputs, per-branch stock thresholds, per-branch SLA input |
| Franchise Management — kept | SLA section, reframed as system-wide policy |
| Franchise Management — added | Branch Account Management table, System-Wide Loyalty Policy, System-Wide Low-Stock Policy floors |
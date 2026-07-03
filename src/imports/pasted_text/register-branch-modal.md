Here's the full Figma Make prompt you can paste directly:

---

**FIGMA MAKE PROMPT — Register New Branch Modal (4-Step Wizard)**

---

Create a modal dialog component for a web dashboard called **Superkalan Gaz CRM**. The modal is triggered by a "Register New Branch" button on the Franchise Registry page. It is used exclusively by the **System Admin** (Franchise Admin) role.

---

**GLOBAL STYLE**

- Font: Inter
- Primary color: `#185FA5` (blue)
- Success color: `#1D9E75` (green)
- Background primary: `#FFFFFF`
- Background secondary: `#F7F7F6`
- Border color: `#E4E4E0` (0.5px)
- Text primary: `#1A1A18`
- Text secondary: `#6B6B67`
- Border radius: 12px for modal, 8px for inputs and cards, 16px for modal container
- All shadows: none. Borders only.
- Modal width: 620px. Height: auto.
- Overlay background: `rgba(0,0,0,0.45)`

---

**MODAL HEADER** (top of modal, padding 20px 24px)

- Title text: "Register new branch account" — 17px, weight 500, text primary
- Subtitle: "System Admin · Franchise Registry" — 13px, text secondary
- Top-right close button: 28px circle, border 0.5px, "✕" icon, 14px, text secondary

---

**STEP PROGRESS BAR** (below header, padding 20px 24px 0, horizontal row)

Four steps connected by lines:

- Step 1: "Branch details" — completed state (filled green circle `#1D9E75`, white checkmark ✓ inside, label in green `#0F6E56`)
- Step 2: "Assign owner" — active state (filled blue circle `#185FA5`, white number "2" inside, label in blue `#185FA5`)
- Step 3: "Geofence setup" — idle (outlined circle, border `#E4E4E0`, number "3" in text secondary, label in text secondary)
- Step 4: "Review & confirm" — idle (same as step 3)

Connector lines between steps: 1px, `#E4E4E0`. Line between step 1 and 2 is green `#1D9E75` (already passed).

---

**DIVIDER** — 0.5px horizontal rule, `#E4E4E0`, margin 16px 24px

---

**STEP 2 — ASSIGN OWNER** (body padding 20px 24px)

Section label: "OWNER TYPE" — 11px, uppercase, letter-spacing 0.06em, text secondary

Toggle pill group (fits content width):
- Two options side by side: "Existing owner" | "New owner"
- Active state (Existing owner selected): background `#E6F1FB`, text `#185FA5`, weight 500
- Inactive state: background white, text secondary
- Border: 0.5px `#E4E4E0` around the group, 0.5px divider between options
- Border radius: 8px

**Sub-panel A — Existing Owner (default visible)**

Section label: "SEARCH REGISTERED OWNERS"

Search input (full width): placeholder "Search by name or email…", height 34px, border 0.5px, radius 8px, background white

Two owner list cards below (stacked, gap 8px):

Card 1 (selected state):
- 36px avatar circle, background `#E6F1FB`, initials "MA" in `#185FA5`, 12px weight 500
- Name: "Maria Alvarez" — 13px weight 500, text primary
- Meta: "maria.alvarez@superkalan.ph · 2 active branches" — 11px, text secondary
- Right side badge: "Selected" — 10px, background `#EAF3DE`, text `#3B6D11`, padding 3px 8px, radius 8px

Card 2 (unselected, 55% opacity):
- 36px avatar circle, background `#EAF3DE`, initials "RD" in `#3B6D11`
- Name: "Ramon Dela Cruz", meta: "ramon.dc@superkalan.ph · 1 active branch"
- No badge

Info alert box (below cards, margin-top 4px):
- Background `#E6F1FB`, border 0.5px `#B5D4F4`, radius 8px, padding 10px 12px
- Left icon: ℹ 14px in `#185FA5`
- Text (13px, `#185FA5`): "This owner will gain Branch Owner access to the new branch. Their existing branch access is not affected."

**Sub-panel B — New Owner (hidden by default, shown when "New owner" toggled)**

Two rows of fields:
- Row 1: "First name" input | "Last name" input (2-column grid, gap 12px)
- Row 2: "Email address" input | "Mobile number" input

All inputs: height 34px, border 0.5px `#E4E4E0`, radius 8px, background `#F7F7F6`, font 13px
Field labels: 12px, text secondary, margin-bottom 4px

Info alert box:
- Same blue style as above
- Text: "A temporary password will be emailed to the owner. They must change it on first login."

---

**STEP 3 — GEOFENCE SETUP**

Info alert box (blue):
- Text: "The geofence defines the delivery coverage area. Riders are alerted if they leave this boundary. You can draw a polygon or enter coordinates manually."

Section label: "BRANCH COVERAGE AREA"

Three-option nav tab row (pill buttons, gap 6px):
- "Draw on map" (active: background `#185FA5`, text white)
- "Enter coordinates" (inactive: background white, border `#E4E4E0`, text secondary)
- "Radius from center" (inactive same)
- All: height 28px, padding 0 14px, radius 8px, font 12px

**Sub-panel: Draw on map (default)**

Map placeholder box: height 180px, border 0.5px `#E4E4E0`, radius 8px, background `#F7F7F6`
- Background: light grid pattern (subtle lines, opacity 18%)
- Center pin icon 📍 16px
- Label: "Calamba, Laguna" — 12px text secondary
- Sub-label: "Click to place points · Double-click to close polygon" — 11px text secondary
- A dashed blue polygon shape drawn over the grid (5 points, stroke `#185FA5`, stroke-width 1.5, stroke-dasharray 5 3)
- Small filled circle `#185FA5` at polygon centroid

Three action buttons below map (row, gap 8px):
- "⬡ Draw polygon" — primary style: background `#185FA5`, text white, height 30px, padding 0 12px, radius 8px, font 12px
- "↺ Undo last point" — ghost style: background white, border `#E4E4E0`
- "✕ Clear" — ghost style same

Info chips row (gap 10px):
- "Area · ~12.4 km²" chip
- "Points · 5" chip
- "Polygon closed" chip — background `#EAF3DE`, border `#C0DD97`, text `#3B6D11`
- All chips: font 11px, padding 4px 10px, radius 8px, border 0.5px

**Sub-panel: Enter coordinates (hidden)**

Section label: "POLYGON VERTICES (LAT / LNG PAIRS)"

Two rows shown as example:
- Each row: Latitude input | Longitude input | Delete button (✕, 34px height, 60px wide, border `#F7C1C1`, text `#A32D2D`)
- 3-column grid: 1fr 1fr 80px, gap 8px

"+ Add vertex" ghost button below (same style as map ghost buttons)

**Sub-panel: Radius from center (hidden)**

Two inputs side by side: "Center latitude" | "Center longitude"

Radius range slider (full width):
- Label: "Radius (km)"
- HTML range input, min 1 max 30, default value 5
- Value display below slider: "5km" — 13px weight 500 text primary

**Curfew field** (below all geo sub-panels):

Label: "Time curfew — riders must return by"
Two time inputs side by side: value "06:00" and "21:00", with "to" label in between (13px text secondary)
Input width: 110px each

---

**STEP 4 — REVIEW & CONFIRM**

Section label: "REVIEW BEFORE CREATING"

Summary table card (full width, border 0.5px `#E4E4E0`, radius 8px, overflow hidden):

6 rows, each row: left cell (140px, background `#F7F7F6`, text secondary, 13px) | right cell (1fr, background white, text primary, 13px). Rows separated by 0.5px `#E4E4E0` borders.

Row data:
- Branch name | Calamba Branch
- Address | National Hwy, Calamba, Laguna
- Branch owner | Maria Alvarez (existing)
- Geofence | Polygon · 5 vertices · ~12.4 km²
- Curfew window | 06:00 – 21:00
- Initial status | (green dot 8px `#1D9E75` inline) Active

Green success alert box below table:
- Background `#EAF3DE`, border 0.5px `#C0DD97`, text `#3B6D11`
- Left icon: ✓ 14px
- Text: "All required fields are complete. Confirming will create the branch and send an access notification to the assigned owner."

---

**STEP 1 — BRANCH DETAILS** (reference, this step is already "done")

Two-column rows:
- "Branch name" input (value: Calamba Branch) | "Contact number" input
- Full-width: "Full address" input
- "City / Municipality" input | "Province" input
- "Low-stock alert threshold (cylinders)" — single input, width 120px, value 20

---

**MODAL FOOTER** (padding 14px 24px, border-top 0.5px `#E4E4E0`, flex row space-between)

Left side: step hint text — "Step 2 of 4 — Assign owner" — 12px, text secondary

Right side: two buttons
- "Back" — ghost style (background white, border `#E4E4E0`, text primary, height 34px, padding 0 16px, radius 8px, 13px)
- "Continue →" — primary style (background `#185FA5`, text white, same dimensions)

---

**COMPONENT VARIANTS TO CREATE IN FIGMA**

Create 4 variants of the modal body, one per step:
- Variant 1: `Step=Branch Details`
- Variant 2: `Step=Assign Owner` with nested variants `OwnerType=Existing` and `OwnerType=New`
- Variant 3: `Step=Geofence` with nested variants `GeoMode=Draw`, `GeoMode=Coordinates`, `GeoMode=Radius`
- Variant 4: `Step=Review`

Step progress bar should update across variants (step circles change state accordingly).
# UI / UX Review and Redesign Brief

Written 2026-11-01 for the agent (or developer) doing the UI/UX overhaul. Read this first, then `CLAUDE.md` for how
the app works. The work is broken into phases in `TODO.md` → **Feature 4: UI / UX overhaul**; tick items there as
they're done.

File:line references were correct when this was written. Verify them before editing, since files move.

---

## 1. Goals (from the owner)

1. **Look as good as nationally recognized golf course sites.** Examples: Pinehurst, Kiawah Island, Bandon Dunes,
   TPC Sawgrass, Streamsong. That means big photography, a confident brand, and a Book button you can always see.
2. **Fast, intuitive UX.** Fewer taps, no dead ends, clear loading, empty, error and success states.
3. **Material Design 3**: 8dp grid, color roles, a type scale, a shape scale, elevation, state layers,
   48dp touch targets, MD3 motion, WCAG AA contrast.
4. **Mobile-first and responsive** from 320px phones to the register PC and desktop.
5. **The new Deer Run logo** (`apps/web/public/images/deerrunlogo.svg`) wherever a logo appears. Retire
   `components/ui/DeerLogo.vue`.
6. **Remove emoji-style icons** and use a real icon library instead.

## 2. Decisions already made (don't reopen them)

| Topic | Decision |
|-------|----------|
| Framework | Keep Vue 3 + Tailwind 3. **Do not** add Vuetify, Quasar or `@material/web`. Implement MD3 through design tokens and a small in-house component set in `src/components/ui/`. `@headlessui/vue` is allowed for accessible dialog/menu/listbox/tabs/switch primitives. |
| Icons | **Material Symbols Rounded** via `unplugin-icons` + `@iconify-json/material-symbols`. These are tree-shaken inline SVG components: no icon font download, and they work offline on the register PC. Import as `import IconGolf from '~icons/material-symbols/golf-course-rounded'`. Decorative icons get `aria-hidden="true"`; icon-only buttons need an `aria-label`. Use a custom SVG in the same style for a golf cart and a bunker, which Material Symbols doesn't have. |
| Color | Generate MD3 color roles (primary, secondary, tertiary, error, surface, surface-container levels, outline, on-* colors) from the brand seed **pine `#1E3D2F`** with Material Theme Builder. Keep **gold** (now `amber #C4873A`), clay and lake as brand/extended colors. Expose the roles as CSS custom properties (`--md-sys-color-*`) mapped into `tailwind.config.js`. **Rename the brand `amber` token to `gold`**: it collides with Tailwind's `amber-*` scale. Secondary text uses solid colors that pass AA, never `rgba(…,.4)` alpha text. |
| Typography | MD3 type scale as Tailwind `fontSize` tokens (display-l/m/s, headline-l/m/s, title-l/m/s, body-l/m/s, label-l/m/s). **Playfair Display** for display and headline, **Lato** for everything else. Drop Libre Baskerville and Lato 300, which are loaded but unused. Self-host with `@fontsource` (woff2, `font-display: swap`) and preload Playfair 700 and Lato 400. Body text is at least 16px on mobile. Uppercase and letter-spacing only for small labels and overlines, not every button. |
| Shape | MD3 shape scale: buttons and chips fully rounded; text fields 4dp (outlined); cards 12dp; dialogs and bottom sheets 28dp. One scale everywhere. Today buttons are square, cards are `rounded-lg` and modals are `rounded-2xl`. |
| Elevation and states | MD3 elevation levels 0–5 as shadow tokens plus surface tint. State layers on every interactive element: hover 8%, focus 10%, pressed 10%, dragged 16%. A visible `:focus-visible` ring everywhere. `:disabled` uses 38% content and 12% container opacity. |
| Motion | MD3 easing (emphasized, standard) and duration tokens. Every animation respects `prefers-reduced-motion`. |
| Theme | Light theme only for now. Add a **high-contrast mode** for staff pages used outdoors (On Course, Tee Sheet). Building on tokens leaves dark mode possible later. |
| Print artifacts | Don't redesign the 80mm receipts and slips (`components/pos/*Receipt*`, `*Slip*`) or the letter-size statement and Z report beyond adding the logo. They're print documents. |

## 3. The logo

`public/images/deerrunlogo.svg` is a **raster emblem inside an SVG wrapper**: 534 KB, with two base64 PNGs, a mask
and filters, a 797×553 artwork and a 1.44:1 aspect ratio. It shows a stag in front of a sunburst, a treeline, and
"DEER RUN" on a green banner over a tan "GOLF COURSE" ribbon. It's full color with a dark outline, so it reads on
both parchment and pine.

Problems:
- It downloads 534 KB on every page.
- It goes soft at small sizes.
- "GOLF COURSE" is unreadable under about 48px tall.
- The nav hides it below 640px (`AppNav.vue:13`), so phones show **no logo**.

What to do:
1. **Ask the course or its designer for the original vector file (AI/EPS/SVG).** That's the real fix. Until it
   arrives:
2. Export optimized rasters from the embedded PNG: `logo-emblem` at 1x/2x/3x in **WebP + PNG fallback**, sized for a
   48px-tall nav (so 144px tall at 3x). Target under 30 KB each.
3. Make a **compact mark** (stag + sun, no text, square) for the favicon, the apple-touch-icon, manifest icons
   (192/512), collapsed nav rails and tiny placements.
4. Add a `BrandLogo.vue` component with `variant="emblem|mark"` and a `size` prop, and use it in **every** place:

   | Place | Now |
   |-------|-----|
   | `AppNav` | The image is hidden on mobile, and `h-16` is the same height as the bar, so it has no breathing room. Target: 40–48px tall. |
   | `AppFooter` | Old `DeerLogo` |
   | `PageHero` (Home) | Commented out at `:20`. A large emblem on the home hero is the brand moment. |
   | `AdminLayout:9` | Old `DeerLogo` |
   | `StaffLayout:9` | Old `DeerLogo` |
   | `LoginView` | None |
   | `ConfirmationView` | None |
   | `StatementDocument:6` | Text only; add the logo to the printed statement |
   | Statement PDF, HTML emails | Optional; the PDF builder has no image support today |
5. Generate `favicon.svg` (mark), `favicon.ico`, `apple-touch-icon.png` and `site.webmanifest`.
   `index.html:5` points to `/favicon.svg`, **which doesn't exist (404)**.
6. Delete `DeerLogo.vue` once nothing imports it.

## 4. The current state in numbers

| Metric | Count |
|--------|-------|
| Emoji / unicode-symbol icons | ~126 in 45 files (see §8) |
| Inline `style="…"` attributes | 247 (~93 hard-coded hex colors, ~128 `rgba()`, ~160 inline `font-family`) |
| Raw Tailwind `gray-*` classes (admin alone) | 523; plus 129 raw red/green/yellow |
| Hand-rolled modal overlays (`fixed inset-0`) | 33 files, ~46 modals. **None** has `role="dialog"`, `aria-modal`, a focus trap, Esc or scroll lock |
| Copies of the same scoped CSS (`.modal-overlay`, `.btn-outline-sm`, `.input-field`, `.badge`, `.th`) | 14–17 files each |
| Distinct font sizes in use | ~22 |
| Labels tied to inputs (`for`/`id`) on public forms | 0 |
| `aria-*` attributes on the public site | 1 |
| Native `confirm()` | 3 (HouseAccountDetail:335, HouseAccountPanel:252, staff TimeOff:155) |
| Largest views | `RegisterView.vue` 1,199 lines, `TeeSheetView.vue` 628 |
| Photo weights | `course-5.jpg` 2.0 MB, `course-2.jpg` 1.5 MB; no `srcset`, WebP/AVIF, dimensions or lazy loading |

## 5. Cross-cutting findings

### 5.1 A CSS cascade bug breaks every primary button (fix first)
`.btn-amber`, `.btn-primary`, `.btn-outline`, `.field` and `.card` in `src/assets/main.css` are declared **outside any
`@layer`** after `@tailwind utilities`, so they beat utilities. Every `class="btn-amber px-4 py-2 text-sm"` renders at
12×28px padding, 13px uppercase, with a hover lift. That includes the register's **Charge** and **Complete Sale**
buttons. There's no `:disabled` style either, so disabled buttons look clickable (TeeTimes:67, Settings:215,
Products:27, …). Move these into `@layer components` (short term) and replace them with `AppButton` (Phase 1).

### 5.2 No shared component layer
Every page hand-builds its own modals, buttons, inputs, tables, badges, stat cards, segmented controls, loading text
and error text. This is the root cause of most inconsistencies. Phase 1 builds the component set in §7, and later
phases migrate pages to it.

### 5.3 Contrast
Most secondary text fails WCAG AA:

| Text | Ratio |
|------|-------|
| `rgba(61,43,26,.4–.55)` on parch | 2.2–3.2 |
| Section labels (gold .8 on parch) | 2.1 |
| Footer copyright | 1.8 |
| `text-gray-300/400` on white (140 uses in admin) | 1.5–2.5 |
| `text-amber` (gold) as text on white | 2.9 |
| Gold selected tee chip (parch on gold) | 2.6 |

Use solid `on-surface-variant` tokens. Gold is a fill/accent, never small text on white.

### 5.4 Touch targets
Typical sizes today are far under 48dp:

| Element | Size |
|---------|------|
| Nav items | ~36px |
| Hamburgers | 26–36px |
| Header buttons | ~34px |
| Row actions (text links) | ~16px |
| Quantity ± | 28px |
| Pagination | ~26px |
| Calendar days | 36px |
| On Course map chips | ~18px |
| Hole picker | ~28px wide on a phone |
| Category chips | ~32px |
| Quick-cash buttons | ~32px |

### 5.5 Feedback states
- **Loading** is plain "Loading…" text: 17+ places. Use skeletons or an MD3 progress indicator.
- **Errors** are a bare `text-red-500 text-sm` line: 23+ places. Errors often render *below* the action buttons
  (TenderModal:117, TeeTimes:71). A failed row action replaces the whole table, because the page uses one `error` ref
  plus `v-else-if` (Employees:32, Products:39, Registers:12).
- **Success** is silent on most admin saves. Settings and ManagerPin show an inline "✓ Saved"; there's one ad-hoc toast
  in admin TimeOff:119. Use **one global snackbar**, with Undo for reversible actions.

### 5.6 Destructive actions with no confirmation
- Delete register (Registers:57)
- Delete category (CategoryManagerModal:41)
- Delete shift (Schedule:176)
- Deactivate employee and Reset PIN (Employees:80, 83)
- Deactivate product (Products:82)
- Promote a user to ADMIN (Users:84)
- Booking status → REFUNDED/CANCELLED (Bookings:84). This only changes the status and moves no money; the label
  must say so.
- Customer cancels a booking (AccountView:161)

Dialogs that hold typed input close on a backdrop tap and lose it: TenderModal, RefundModal, CashMovement,
ProductFormModal, the Tournaments and Employees forms. In MD3, dialogs with entered data close only through their
buttons.

### 5.7 Forms
- Labels aren't tied to inputs, and there's no `autocomplete`.
- The membership inquiry isn't a `<form>`, so Enter does nothing and native validation never runs.
- Validation is server-only, with one error line per form.
- Price is entered **in cents** in Settings (8–13).
- Money inputs are bare `type="number"`. Use `MoneyField` with a `$` prefix, `inputmode="decimal"` and select-on-focus.

### 5.8 Displaying data
- Raw enum values are shown to users (`CONFIRMED`, `GUEST`, Dashboard:112, Bookings:53, Users:44, AccountView:58).
- Times appear in 24-hour format and dates as `YYYY-MM-DD` (Dashboard:109, Bookings:48, TeeTimes:78).
- Revenue uses `toFixed(0)` with no thousands separator.
- Status colors are defined three separate times (Dashboard:186, Bookings:177, timeOffDisplay.js:5).

Add a `StatusChip` with one status → tone/icon/label map, and use the formatters in `src/lib/timeclock.js` and
`money.js` everywhere.

### 5.9 Responsive tables
| Group | Tables | Behavior |
|-------|--------|----------|
| Scroll inside `overflow-x-auto` | 6 admin tables | Usable but awkward |
| No wrapper at all | HouseAccounts:44, Registers:15, HouseAccountDetail:74, CategoryManagerModal:12, SalesReport, MembershipsView:27 comparison | **The whole page scrolls sideways** |

Fix: `DataTable` switches to stacked list items below `md`, with the primary column as the headline and row actions in
a `more_vert` menu.

### 5.10 SEO, meta, performance
- **Meta:** one static `<title>`/description. No per-route titles, Open Graph/Twitter tags, canonical,
  `theme-color`, manifest, `robots.txt` or `sitemap.xml`. No JSON-LD (`GolfCourse` + `LocalBusiness` with address,
  geo, phone, hours and a `ReserveAction` → `/book`; `Event` on Tournaments).
- **Routing:** no 404 route; unknown URLs render a blank page. `scrollBehavior` ignores `savedPosition` and `#hash`.
- **Rendering:** this is a client-rendered SPA, so crawlers and social cards only see `index.html`. Prerender the
  public routes (`vite-ssg` or a build-time prerender) and use `@unhead/vue` for per-route meta.
- **Fonts and images:** Google Fonts blocks rendering. The heroes are CSS backgrounds, so they're never prioritized
  for Largest Contentful Paint (LCP). Use `<picture>` + `fetchpriority="high"` and `vite-imagetools` (AVIF/WebP at
  640/1280/1920).
- **Image files:** `/images/course-1.jpg` (TournamentsView:7) **doesn't exist**. `course-2-edited.jpg` and
  `course-5-copy.jpg` are near-duplicates.
- **Targets:** LCP under 2.5s on 4G, CLS under 0.1, Lighthouse at least 90 on Performance, Accessibility, Best
  Practices and SEO for every public route.

### 5.11 Bugs found along the way (not purely visual)
| # | Bug | Where |
|---|-----|-------|
| B1 | Booking wizard is `w-2/3` wide at every size (~245px on a phone) | `BookingWizard.vue:2`, `BookView.vue:16` (`px-2`) |
| B2 | Each visit to the payment step creates **another** PENDING booking + PaymentIntent (Back then Next creates a second hold of 30 min) | `StepPayment.vue:100-103` (`onMounted`) |
| B3 | Online price hard-coded at $45 (`PRICE_PER_PLAYER`), but the rate card shows weekend $50 / twilight $30, and every "Book This Rate" goes to the same flow | `stores/booking.js:13`, `RatesView.vue:47` ❓ the course must decide which prices are sold online |
| B4 | Tournament **Register** links to the tee time booking flow | `EventCard.vue:38` |
| B5 | Admin Tee Times "today" uses UTC, so after 7 pm Central it's tomorrow | `admin/TeeTimesView.vue:124` (use `localDate()`) |
| B6 | Customer cancel window counts 24 h from UTC midnight of the slot date, not the tee time | `AccountView.vue:148` |
| B7 | Booking "Member / Sign In" goes to `/login` without `?redirect=/book`, so the user loses the flow | `StepDetails.vue` |
| B8 | "Signed in as member" is shown to GUEST users | `StepDetails.vue:44` |
| B9 | Confirmation says "confirmation sent" while still PENDING. Stripe `redirect_status=failed/processing` isn't handled. Users see "Booking not found" while the webhook is pending | `ConfirmationView.vue` |
| B10 | `createBooking` drops the API error ("slot just filled" becomes "Booking failed") | `stores/booking.js` / `StepPayment.vue` |
| B11 | `PageHero` `classes` prop is required but missing on 6 pages (console warning, content top-aligned); fixed `height` + `overflow:hidden` clips wrapped text on phones | `PageHero.vue:7, :55` |
| B12 | `price-featured`, `price-card`, `event-row`, `event-past` classes are used but never defined, so "Best Value" gets no emphasis and past events aren't dimmed | `MembershipTierCard.vue:2`, `EventCard.vue:2` |
| B13 | Duplicate `id="inquiry-form"` | `MembershipsView.vue:50` and `MembershipInquiryForm.vue:2` |
| B14 | Footer "Privacy Policy / Accessibility / City of Moulton" are dead `<span>`s | `AppFooter.vue:52` |
| B15 | Hours conflict between footer and Contact; twilight/9-hole/tee-time policy copy conflicts on Rates ❓ | `AppFooter`, `ContactView:142`, `data/rates.js` |
| B16 | Scorecard OUT/IN/TOTAL par hard-coded to 72; hole names look like placeholders ❓ | `ScorecardTable.vue:56`, `data/holes.js` |
| B17 | No sign-out in the admin or staff shells; no way to switch cashier on a shared register PC | `AdminLayout`, `StaffLayout` |
| B18 | 8 admin views and TimeClock/MyTimesheet still use raw `fetch` with copied headers instead of `apiFetch` | see §10 |

## 6. Findings by area

### 6.1 Public site

**Nav and footer**
- On phones there is no logo and no Book button: the bar is an empty strip with a hamburger.
- The hamburger is ~40×26px, with no `aria-expanded`. The menu doesn't close on Esc or on route change, and the page
  behind still scrolls.
- Seven links plus three buttons are crowded at 1024px.
- **Target:** logo at every size. On mobile, logo + compact "Book" + menu, plus a **sticky bottom "Book a tee time"
  bar**. A `<header>` element, a skip link, and a full-screen MD3 navigation drawer on mobile.
- The footer gets the new logo, real links, social and newsletter signup, a directions link, and icons.

**Home**
- The hero shows only the word "*Deer Run*"; its 650px fixed height is too tall on phones.
- Six emoji feature cards; three of them go to Contact.
- The gallery is a fixed `5fr 3fr 3fr` grid that is ~100px wide on phones and loads 2 MB images eagerly.
- `quickInfo` (`HomeView:175`) is dead code.
- **Target:**
  1. A full-bleed cinematic hero (photo now, muted loop video later) with the emblem and an **instant tee-time
     search** (date, players, time of day → `/book` with the selection pre-filled).
  2. Three photo-led cards: The Course, Tee Times & Rates, Events.
  3. A "Plan your visit" strip: address, hours, phone, directions, weather.
  4. The next three events from `/api/events`.
  5. Testimonials / rating.
  6. A membership teaser.
  7. A responsive gallery with lightbox (1 column / snap carousel on mobile).

**Course / Scorecard**
- The 650px hero pushes the data below the fold.
- The table has no sticky first column, `<caption>` or `scope`, and the active tee `<th>` color is wrong.
- The emoji hazard icons rely on `title`, which doesn't exist on touch.
- `TeeSetSelector` has no radiogroup semantics.
- `CourseDiagram.vue` and `TreelineDivider.vue` are unused.
- **Target:** a standard scorecard view (all tees, men's/ladies' handicap, printable PDF), plus **hole-by-hole pages**
  `/course/hole/:n` with photo, yardage per tee, hole diagram, pro tip, flyover/drone stills, and previous/next swipe.

**Rates**
- Pricing conflicts with booking (B3).
- The fee notes are hidden on mobile (`hidden md:table-cell`), which drops terms.
- Double elevation on the featured card.
- Policy copy conflicts (B15).

**Memberships**
- The comparison table is crushed at 360px; use per-tier stacked lists on mobile.
- ✓/— have no screen-reader text.
- The inquiry needs to become a real `<form>`, with a 1-column name grid on mobile and `autocomplete`.
- "Best Value" has no visual emphasis (B12).
- The tier buttons have no states.
- Copy conflict: the hero promises "member events", but the table says Family members don't get club events.

**Tournaments**
- The hero image is missing (§5.10).
- Register goes to tee time booking (B4). This needs an event detail page plus a registration or inquiry form.
- Events aren't sorted, and past ones aren't dimmed.
- Filter chips need `aria-pressed` and 48px height.
- Loading should be skeleton cards; the empty state needs an action.
- Add event images, Add to calendar, share, and `Event` JSON-LD.

**Contact**
- Labels and `autocomplete` are missing.
- `v-html` with inline-styled links; emoji tiles; ✅ success state.
- The hero phone number isn't tappable.
- Add a **Get directions** deep link (Google and Apple Maps).
- `VITE_GOOGLE_MAPS_API_KEY` is never used.

**Booking wizard** (the money path; make it excellent)
- B1/B2/B3/B7/B8/B10 above.
- The steps aren't in the URL, so browser Back leaves the wizard.
- Focus doesn't move to the new step, and there's no `aria-current="step"`.
- **Step 1 (date):** 36px day cells; unlabeled ‹/› that page forever outside the booking window; no grid semantics or
  arrow keys; no per-day availability; an extra click to continue. On mobile, a horizontal strip of the next 7–14
  days is faster.
- **Step 2 (time):** ~58 slots in a flat grid. Group them Morning / Midday / Twilight; **ask players first**, then
  show only times that fit. The player picker currently sits below the grid, off-screen. Add an empty state with
  next-day chips, a sticky bottom summary + Continue, skeleton loading, and a labeled back button.
- **Step 3 (details):** segmented button for guest/member; phone field; validation; `autocomplete`; drop the
  "Cart fee included $0" line.
- **Step 4 (payment):** show the server's amount; add a terms and cancellation-policy line; handle the busy state.
  Derive the Stripe `appearance` from the tokens.
- **Confirmation:** booking reference, Add to calendar (.ics), directions, manage booking, arrival tips, weather for
  the tee date, and a Processing state that polls (B9).

**Login**
- Missing: forgot password, create account, show/hide password, `autocomplete`.
- The heading "Member Sign In" is wrong: guests and staff use this page too.
- Raw Supabase errors are shown.
- Use a compact header instead of the 250px hero.

**Account**
- Raw status enums; cancel with no confirmation (B6).
- Past bookings at `opacity-60`, which fails contrast.
- No error state.
- `HouseAccountPanel` and `StripeElementModal` use a different visual language (gray/white `rounded-2xl`); unify it.
- The six action buttons should be one primary action plus an overflow menu.

**Statement**
- Add **Download PDF** (the server already builds it in `_statementPdf.js`) and Print with icons.
- Use a 48dp back button.

### 6.2 Admin panel (`/admin`)

**Shell**
- The drawer below 1024px is roughly right, but tablets get no navigation rail.
- Nav items are ~36px. The active state is a solid gold block that reads like a button.
- 14 items in a flat list. Group them:
  - Overview: Dashboard
  - Golf: Tee Times, Bookings, Tournaments
  - Staff: Employees, Timesheets, Schedule, Time Off
  - Pro Shop: Products, Sales, Registers, House Accounts
  - Admin: Users, Settings
- Needs a sign-out, and `document.title` set per page.
- The top bar needs a page-action slot, breadcrumbs from route meta (detail pages use a hand-made "← All house
  accounts"), and an account menu.
- Page actions appear in a different place on every page; standardize with `PageHeader`.

**Views**
- **Tables:** see §5.9.
- **Filters:**
  - Bookings and Users wait for a Search click.
  - Employees and Products reload on change.
  - Sales reloads on every change except receipt #.
  - TeeTimes waits for "Load Slots".
  - Pick one rule: reload on change, debounce text. Use filter chips and a date-range field. The Sales filter bar
    has 9 controls; on mobile they belong in a bottom sheet.
- **Row actions:** tiny text links, four per row on Employees. Use a `more_vert` menu.
- **Clickable rows** that keyboards can't reach: Sales:125, HouseAccounts:68, Timesheets:59.
- **Settings:** one 400-line form at `max-w-xl`. Make it sectioned cards or tabs (Booking / Payroll / Point of Sale /
  Tipping / On Course / House Accounts), with a sticky save bar, an unsaved-changes guard, money in dollars, grids
  that stack, and a hole-time grid that doesn't overflow at 360px.
- **Schedule:**
  - The week grid's sticky name column is good.
  - The month view is unreadable on phones; use an agenda list.
  - Empty cells can't be reached by keyboard.
  - Bury nothing: put the color legend on screen.
- **Dashboard:** this is the third copy of the stat card. Add a date-context header, trends/sparklines and quick
  actions.
- **TeeTimes:** B5. Add bulk generate and close actions for slots, which is the page's main job.
- **TimeOff:** Deny/Revoke render gray, not red (a scoped class beats the utility).
- **HouseAccountDetail:** the statement renders below the fold without scrolling to it, and there's no busy label on
  saves.

### 6.3 Staff portal and POS (`/staff`)

**Shell**
- Phones and tablets both get only a hamburger drawer.
- **Target:**
  - **Phones:** an MD3 **bottom navigation bar**, 3–5 destinations by role:
    - Staff: Clock · Schedule · Time off · More
    - Register users: Clock · Tee sheet · Register · More
    - Course staff: Clock · On course · Tee sheet · More
  - **Tablets:** a **navigation rail**.
  - **Desktop:** a drawer.
- A clock-status chip in the top bar ("On the clock 3h 12m").
- Sign-out, plus **Lock / switch cashier** on the register.

**Register** (`RegisterView.vue` + `components/pos/*`). A touchscreen PC with a USB scanner, so speed is everything.
- **Register mode:** a full-bleed route (`meta.registerMode`) without the sidebar and padding, defaulting to the rail.
- **Cart:** Total at `text-3xl` (now `text-xl`). The Charge button is fixed by §5.1.
- **Scanner:**
  - On a missed scan, select the text (`RegisterView:669`) so the next scan replaces it, and play an error tone.
  - Add a document-level scanner buffer (keys under ~30ms apart ending in Enter) so scans work whenever no input or
    dialog has focus.
  - A scan while "Sale complete" is open starts a new sale with that item.
  - Scroll to and highlight the line that was added, with a beep.
  - Consider `inputmode="none"` on the scan field, so Windows tablet mode doesn't pop the touch keyboard.
- **Touch:**
  - qty ± up to 48px.
  - Line Discount/Remove become icon buttons.
  - The cart header links (Recent sales, No sale, Account payment, End of day, Change register) and the drawer links
    become an icon toolbar plus overflow menu.
  - Category chips: one scrolling row, 48px.
  - Tender method buttons 48px; **quick-cash buttons 64px**.
  - Print/Email receipt: a segmented control instead of 16px checkboxes.
- **Flows:**
  - **Cash:** Enter on an empty cash field means Exact. That takes the flow from 4 taps to 3.
  - **Split:** ask for the cash amount and compute the card remainder (the half-and-half default is rarely right).
  - **Decline:** add "Pay with cash instead".
  - **Check-in:** offer "No add-ons, done" and "Back to tee sheet" after the sale.
  - **Refund:** reason chips (Wrong size, Defective, Rang wrong, Changed mind).
  - **Manager approval:** large name buttons plus a **numeric keypad** (shared with the house account PIN and drawer
    counts) instead of a `<select>` and the OS keyboard.
- **States:**
  - A reader online/offline chip in the cart header; disable Card when the reader is offline (the status already
    exists on the admin side).
  - When the drawer is closed, the tender dialog defaults to Card or warns first.
  - Errors go above the buttons.
- **Modals:**
  - Tender, Refund and CashMovement must not close on a backdrop tap.
  - Stacking is ad hoc (`z-[60]` vs `z-50`).
  - Only some modals hide when printing. Check that nothing but the slip prints during refund/approval flows.
  - The four "result" dialogs are near-copies (RegisterView:189, 217, 289, 406); use one `ResultDialog`.

**Tee Sheet**
- Each booking is a wrapping pile of up to 8 badges plus 4 buttons. Use one card per booking:
  - name and players, large
  - one status chip with an icon:
    - `check_circle` checked in
    - `credit_card` paid online
    - `payments` paid at the register
    - `hourglass_top` payment pending
  - one primary action
  - everything else in an overflow menu
- "Undo" sits right next to "Carts".
- Gray-300/400 text fails in sunlight.
- "+ Book" belongs inline in empty slots (the whole row as a 48px target).
- Date navigation: chevron icon buttons around a tappable date title.
- The 6-line help paragraph goes behind an `info` icon.
- 🛺 is an auto-rickshaw, not a golf cart.

**On Course** (outdoors, one hand, gloves, sunlight)
- **Map chips** are ~18px; pace is shown by **color only**; fresh vs estimated is a dashed border.
  - Make the whole hole tile the target, opening a sheet that lists its groups.
  - Add an arrow or "+6/−4" text to each chip.
  - Show estimates with a different fill.
- **Group rows:** fixed widths inside `flex-wrap`, and up to 5 buttons at ~28px. Use group cards with one big
  **Update position** action, Finished as secondary, and the rest in an overflow menu.
- **Update flow:** a bottom sheet (group → hole → stage) within thumb reach.
  - Hole picker: 5–6 columns at 56px or more (now 9 columns at ~28px).
  - Stage control: full-width at 56px.
- High-contrast mode, 16px minimum text, and a compact sticky course-pace bar.
- `RoundSetupFields`: toggles ~36px and a small native checkbox; make them 48px and an MD3 switch.

**Time clock, timesheet, schedule, time off**
- **TimeClock** is the best mobile page. Put the action first (the big clock pushes it below the fold) and make the
  button full width on phones.
- **MyTimesheet:** a day list below `sm` instead of the 5-column table.
- **MySchedule:** the toolbar takes 3–4 rows on a phone. Use a top app bar (period title, chevrons, overflow menu with
  Print) plus a chip row (Week / 2 weeks / Month · Mine / Team). On phones the month grid becomes an agenda list.
- **TimeOff:** an extended FAB "Request time off" opening a full-screen dialog, with the request list as the main
  content. Replace `confirm()`.
- **ManagerPin:** a snackbar instead of "✓ Saved", and the numeric keypad.

## 7. Component set to build (`src/components/ui/`)

Build these in Phase 1 with MD3 states, a11y and tokens, then migrate pages to them. "Replaces" counts are
approximate.

| Component | Notes | Replaces |
|-----------|-------|----------|
| `AppIcon` / icon convention | unplugin-icons; size tokens 20/24 | all emoji (§8) |
| `BrandLogo` | `variant="emblem\|mark"`, `size` | `DeerLogo`, raw `<img>` |
| `AppButton` | filled / tonal / outlined / text / danger; sizes md 40, lg 48, xl 64 (POS); `loading`; leading/trailing icon; `to` renders RouterLink | `.btn-amber`, `.btn-primary`, `.btn-pine`, `.btn-outline*`, `.btn-outline-pine`, text-link actions (~100 sites) |
| `IconButton` | 48dp target, state layer, required `aria-label`, optional tooltip | ✕, ‹ ›, qty ±, hamburgers, row actions |
| `AppDialog` | Teleport, `role="dialog"`, `aria-modal`, labeled title, focus trap, initial focus, Esc (unless `persistent`), scroll lock, z-stack, `print:hidden`, sizes; **full-screen on phones** for long forms; no backdrop-close when `persistent` | ~46 modals |
| `ConfirmDialog` + `useConfirm()` | Promise-based, destructive variant | 8 hand-built confirms, 3 `confirm()`, the missing confirmations in §5.6 |
| `BottomSheet` | Mobile alternative to dialogs and menus (filters, On Course update) | — |
| `AppSnackbar` + `useSnackbar()` | One per layout, `aria-live="polite"`, optional action (Undo), queue | inline "✓ Saved", admin TimeOff toast, TeeSheet notice, silent saves |
| `TextField`, `SelectField`, `TextArea` | MD3 outlined, 56dp, label tied to input, helper/error text, `aria-invalid`, prefix/suffix, `autocomplete` passthrough | `.field`, `.input-field`, `.label-sm` (100+ fields) |
| `MoneyField` | `$` prefix, `inputmode="decimal"`, select-on-focus, emits cents | ~10 money inputs, Settings price-in-cents |
| `Checkbox`, `Switch`, `RadioGroup` | 48dp targets | native checkboxes |
| `SegmentedButton` | `role="radiogroup"` | ~12 hand-built toggles (Tender methods, Refund to, TeeSheet source, RoundSetup, OnCourse stage, schedule views, discount $/%, Tournaments filter, StepDetails) |
| `ChipGroup` / `FilterChip` | Filter and choice chips, `aria-pressed` | category tabs, event filters, refund reasons |
| `Tabs` | MD3 primary/secondary tabs | Sales, HouseAccountDetail, StockModal, Settings sections |
| `DataTable` | Sticky header, sortable, keyboard-reachable clickable rows, **cards below md**, empty/loading slots, row-action menu slot | 17 tables |
| `RowActionsMenu` | `more_vert` menu (Headless UI Menu) | inline Edit/Deactivate/Reset/Delete |
| `Pagination` | 48dp | Bookings, Users, Sales |
| `PageHeader` | Title, breadcrumbs, primary action, overflow | per-page action placement |
| `TopAppBar`, `NavDrawer`, `NavRail`, `BottomNavBar` | Shells | the three layouts |
| `Card`, `StatCard` | Elevation tokens | 65 `bg-white rounded-xl border` cards, 4 copies of the stat card |
| `StatusChip` | One status → tone + icon + label map for bookings, sales, time off, statements, pace | 30+ badges, 3 duplicate status maps |
| `EmptyState` | Icon, message, action | ~15 "No … found" |
| `Skeleton`, `ProgressIndicator`, `ErrorBanner` (with Retry) | | 17 "Loading…", 23 red error lines |
| `DateStepper` | prev / tappable title (opens date picker) / next / today | TeeSheet, MyTimesheet, MySchedule, Timesheets, Schedule, Sales |
| `DateRangeField` | Presets (Today, Yesterday, This week, This pay period, This month) | Sales, Bookings, Timesheets, House account statements |
| `NumericKeypad` | PINs, cash tendered, drawer counts | ApprovalModal, TenderModal PIN, drawer open/close |
| `ResultDialog` | Big amount, notes, Print, Done | 4 register result dialogs |
| `CustomerSearch` | Debounced user search | CustomerPickerModal, AccountPaymentModal |

Add a hidden dev route `/dev/ui` that shows every component in every state (a lightweight in-app gallery, no
Storybook), so the design can be reviewed in one place.

## 8. Icon replacement map (Material Symbols Rounded)

**Public site**

| Where | Now | Icon |
|-------|-----|------|
| HomeView:111 | ⛳ | `golf_course` |
| HomeView:119 | 🏌️ | `sports_golf` / `event_available` |
| HomeView:127 | 🏆 | `emoji_events` |
| HomeView:135, ContactView:135 | 📍 | `location_on` |
| HomeView:143 | ⏰ | `schedule` |
| HomeView:151, ContactView:136 | 📞 | `call` |
| ContactView:137 | ✉️ | `mail` |
| ContactView:19, MembershipInquiryForm:51, ConfirmationView:11 | ✅ 🏌️ ⛳ | `check_circle` / `task_alt` |
| MembershipsView:39-40 | ✓ / — | `check` / `remove`, plus sr-only text |
| ScorecardView:33-36, ScorecardTable:37-40 | 🌊 ⛱ ⛰ ⭐ | `water`, custom bunker SVG, `landscape`, `star` |
| RatesView:85 | — bullets | `check_small` / `info` |
| Arrows: Home:8,27, Scorecard:44, Login:42, StepDate:75, StepTime:64, StepDetails:73 | → | `arrow_forward` |
| Back: StepTime:4, StepDetails:4, StepPayment:4, StatementView:6 | ← | `arrow_back` |
| StepDate:23,33 | ‹ › | `chevron_left` / `chevron_right` |
| AppNav hamburger | spans | `menu` / `close` |
| Inline SVGs: RatesView:41, MembershipTierCard:21, BookingWizard:20 | check | `check` |
| MembershipTierCard:6 | star | `workspace_premium` |
| EventCard:23, :27 | clock, people | `schedule`, `group`; add `payments` for the fee |
| StepPayment:29, :47 | spinner | progress indicator; `lock` on Pay |
| Footer contact | — | `location_on`, `call`, `schedule`; social via Simple Icons |

**Admin nav (AdminLayout:93-106)**

| Item | Now | Icon |
|------|-----|------|
| Dashboard | ▦ | `dashboard` |
| Tee Times | 🕐 | `schedule` |
| Bookings | 📋 | `book_online` |
| Tournaments | 🏆 | `emoji_events` |
| Settings | ⚙ | `settings` |
| Users | 👤 | `group` |
| Employees | 🪪 | `badge` |
| Timesheets | ⏱ | `punch_clock` |
| Schedule | 📅 | `calendar_month` |
| Time Off | 🏖 | `beach_access` |
| Products | 🏷 | `inventory_2` |
| Sales | 💵 | `monitoring` |
| House Accounts | 📒 | `account_balance_wallet` |
| Registers | 🧾 | `point_of_sale` |
| Back to site | ← | `arrow_back` |

**Admin elsewhere**

| Now | Icon |
|-----|------|
| `+` (~12 places) | `add` (`add_link` for Pair a reader) |
| ← → period navigation | `chevron_left` / `chevron_right` |
| ▾ ▸ | `expand_more` / `chevron_right` |
| ✕ | `close` / `delete` |
| 🖨 (Schedule:52, Sales:211, HouseAccountDetail:145) | `print` |
| ✉ (Schedule:60) | `mail` |
| ⚠ (Schedule:75,171, ScheduleGrid:62, TimeOff:51) | `warning` |
| ✓ Saved (Settings:218) | snackbar with `check_circle` |

Add icons to text-only buttons:

| Button | Icon |
|--------|------|
| Search | `search` |
| Export CSV | `download` |
| Copy previous | `content_copy` |
| Edit | `edit` |
| Delete | `delete` |
| Reset PIN | `lock_reset` |
| Deactivate | `toggle_off` |
| Stock | `inventory` |
| Refresh / Recalculate | `refresh` |
| Categories | `category` |
| Approve / Deny | `check` / `close` |

**Staff nav (StaffLayout:91-100)**

| Item | Now | Icon |
|------|-----|------|
| Time Clock | ⏱ | `timer` |
| My Timesheet | 🗓 | `fact_check` |
| My Schedule | 📅 | `calendar_month` |
| Time Off | 🏖 | `beach_access` |
| Tee Sheet | ⛳ | `golf_course` |
| Register | 🧾 | `point_of_sale` |
| On Course | 🏌 | `sports_golf` |
| Manager PIN | 🔑 | `password` |
| Admin panel | → | `admin_panel_settings` |
| Back to site | ← | `arrow_back` |

**Staff elsewhere**

| Where | Now | Icon |
|-------|-----|------|
| TeeSheet:79 | ✓ Checked in | `check_circle` |
| TeeSheet:81 | 🛺 | custom golf-cart SVG (or `electric_car`) |
| TeeSheet:38 | ✕ | `close` |
| TeeSheet:140 | "+ Book" | `add` |
| MySchedule:44 | 🖨 | `print` |
| Register:124 | "+ Attach customer" | `person_add` |
| Register:40 | "+ Custom Item" | `edit_note` |
| Register:139,141; RefundModal:21,23 | qty − + | `remove` / `add` |
| Register | "Remove" text | `delete` |
| RecentSales:46 | ← Back | `arrow_back` |
| ScheduleGrid:62 | ⚠ | `warning` |

**Leave these alone:** `−`, `×` and `“ ”` used as typography in money and quantity text, and anything in the printed
receipts and slips.

## 9. Visual direction

- **Mood:** classic Southern parkland. Deep pine, warm parchment, gold sunlight from the logo's sunrise, and natural
  textures, presented with modern restraint. Big photography carries the premium feel; the UI stays quiet around it.
- **Public site:**
  - Generous whitespace (sections of 64–96dp on desktop, 48dp on mobile).
  - Playfair display headlines with italic accents (already a brand habit, e.g. `*Deer Run*`).
  - Gold only for the primary CTA and small accents.
  - Pine surfaces for hero and footer, parchment surfaces for content.
  - Photo-led cards with 12dp radius and subtle elevation.
- **Admin and staff:** the same tokens in a denser MD3 "productivity" style.
  - Surface and surface-container backgrounds, not raw white and gray.
  - Compact type, data tables, top app bar + rail/drawer.
  - The pine nav stays as the brand anchor.
- **Photography:** the five current photos aren't enough. ❓ Get a professional shoot (drone, golden hour, signature
  holes 1–18, clubhouse, grill, people playing). Until then, use the existing photos optimized, and cut the
  near-duplicates.

## 10. Working rules for the implementing agent

- Follow `CLAUDE.md` conventions: `<script setup>`, no TypeScript, `@/` alias, `apiFetch` for authenticated calls.
  Shared `src/lib/*.js` files must stay free of `@/` imports and browser APIs.
- **One phase per branch/PR** (`claude/ui-phase-N-…`). Keep the app working at every commit. Migrate a page fully to
  the new components rather than leaving it half-converted.
- **Don't change API contracts or business logic** while restyling, except to fix the bugs listed in §5.11, which each
  go in their own commit. Items marked ❓ need the course's answer first.
- Replace raw `fetch` with `apiFetch` when touching these views: admin Bookings, Dashboard, Employees, Settings,
  TeeTimes, Timesheets, Tournaments, Users; staff TimeClock and MyTimesheet.
- After each phase:
  - `npm run lint` passes with 0 errors.
  - `npm run build` passes.
  - Check every changed page at **360, 412, 768, 1024, 1280 and 1920px**, and the register at 1366×768 touch.
  - Keyboard-only pass (Tab order, visible focus, Esc closes dialogs).
  - Lighthouse on public routes (targets in §5.10).
  - Run `axe` (browser extension or `@axe-core/cli`) with 0 serious or critical issues.
- Update `CLAUDE.md` (Design System section, Shared libraries, component conventions) and `TODO.md` as phases finish.
- Run `npm run dev:pages` and sign in with the demo accounts from `prisma/seed-demo.sql` to see every portal with
  realistic data.

VECTOR Dispatch Tool — Patch Notes

A running, plain-language log of what changed each session, so we don't have to rely on memory to track progress. Newest entry on top. Keep entries short: what changed, why, commit hash.

---

## 2026-07-24 (later session, part 7)

- **Military job ticket: Asobo-owned airport green lightened** — `.msfs-default-airport-icao`
  was unreadable against the dark military ticket background (`--bg-ticket-military`). Added a
  scoped override `.contract-ticket.is-military .msfs-default-airport-icao { color: #6fae74; }`
  (styles.css) so only military tickets get the lighter shade; civilian tickets keep the
  original `#1f5c22`. Chosen to stay visibly distinct from user-owned airports' green
  (`--color-link-readme`, `#318F34`).
- **MLW/MZFW sourced and added for 4 of the remaining 11 aircraft** — T210 (mlw 1724, matched
  existing mtow exactly), BF109 (mlw 3400, matched existing mtow/oew exactly), PA38 (mlw 757,
  official Ops Manual states combined take-off/landing weight), A6M5 (mlw/mzfw 2743, source cited
  ~2796 but user chose to keep fleet-db's existing mtow value instead) (fleet-db.js). FW08 (Fw
  190 A-8) explicitly has no published MLW per its source — period flight manuals never defined
  one — so left unchanged, closed as "no data exists."
- Remaining MLW/MZFW gap: 6 aircraft (BE36, DG1E, LS18, PITA, S12G, DA42) — user said to ignore
  and remove from the to-do list; no longer tracked as open.

## 2026-07-24 (later session, part 6)

- **Logbook row font-weight eased to normal** — `--font-weight-logbook-row` (styles.css) taken
  down from 600 (matched to job-ticket meta value weight, part 5) to `normal` after user
  feedback that 600 still read as too heavy. Iterated 600 → 500 → normal, confirmed by user at
  each step; normal is final.
- **MLW/MZFW sourced and added for 9 aircraft** — C160 (mzfw only, mlw already present), A321,
  BE20 (mzfw only), B58T, B36T, LEG2, LEG2_T, A33E, DC2F (fleet-db.js). All values sourced from
  screenshots the user added to `Vector-Dev-Tools/references/` (manufacturer manuals and
  SimBrief airframe configs where available, AI-search summaries as secondary corroboration);
  cross-checked against each aircraft's existing mtow/oew before applying. H65M's mlw (4172)
  was checked against a conflicting AI-search source (4300) but left unchanged per user
  instruction. C20F, C208, H47D, B105, AS65, H65M confirmed to have no separate published MZFW
  (helicopters and this Caravan variant only publish a single MTOW=MLW limit) — closed as "no
  data exists", not left as open gaps. Commits 1b3f28f, 3efca73 (the latter fixing a BE20 mzfw
  value that was named in the first commit message but not actually applied until the follow-up).
- Remaining MLW/MZFW gap: 11 aircraft in the "probably no published data" group (BE36, DG1E,
  LS18, PITA, S12G, A6M5, T210, DA42, BF109, FW08, PA38) not yet chased.

## 2026-07-24 (later session, part 5)

- **Divider restored below IFR/VFR row** — re-added `<hr class="preflight-rules-divider">` in its
  original CSS form (`border-top: 1px solid var(--board-border); margin: 14px 0 12px;`), now
  positioned after `.preflight-rules-row` instead of before Block Time (index.html, styles.css).
  Removed the `margin-bottom: 18px` added to `.preflight-rules-row` in part 4, since the divider's
  own margins now provide that spacing (avoids doubling up).
- **Removed "Glider missions are unaffected by this slider." note** and its now-empty
  `.slider-footer-row` wrapper (index.html) — no longer true.
- **Block Time label→slider gap fixed to 8px** — matches the ALTITUDE→IFR/VFR gap. Added
  `.board-sidebar-form #timeSliderHeading { margin-bottom: -1px; }`; the -1px (not 0) was needed
  because the slider element has an unaccounted ~7px offset above its own margin that doesn't
  come from any label spacing — tested empirically via `getBoundingClientRect()`, not derived from
  the CSS cascade.
- **IFR button now shows red when active; VFR unchanged; both green on hover** — added
  `#ifrRulesBtn.is-active` (red gradient) and `#ifrRulesBtn.is-active:hover` (green, same as
  before) in styles.css. ID selector needed to win over the shared `.rules-toggle-btn.is-active`
  green rule without touching VFR.
- **Job-ticket meta value text now matches key label's font-weight (600), not its colour** —
  corrected a same-session mistake: an earlier change had made the key labels themselves bold
  (700), including DEP:/ARR: which the user explicitly excluded (they share the same wrapper
  class as the other keys, so a wrapper-based CSS selector couldn't distinguish them). Reverted
  that, and instead wrapped the value text (aircraft name, CRZ ALT, PAX/CARGO, ILS/OTHER/NAVIGRAPH
  results) in a new `.contract-ticket-meta-value` span at `font-weight: 600` — matching the key's
  weight, keeping the value's own (different) colour. dispatch-engine.js
  `formatBoardTicketMetaHtml`, styles.css.
- Confirmed via read-only checks (no code change needed): F28 mission assignments already
  identical across all 4 marks (Round 3 fix holds, both files agree). "Prefer lower cruise
  altitude" and "Only use Navigraph airports" default to unchecked in the HTML/JS — any observed
  default-on state is leftover `localStorage` from prior testing, not a code bug.

## 2026-07-24 (later session, part 4)

- **ALTITUDE section moved above BLOCK TIME, dotted divider removed** — index.html: ALTITUDE
  title + IFR/VFR row now sit directly under AIRCRAFT TYPE; Block Time slider section(s) moved
  below it. Removed `<hr class="preflight-rules-divider">` entirely (and its now-unused CSS
  rule). Replaced the old `.preflight-rules-divider + .dispatch-form-field` selector (which
  depended on the divider's position) with a stable `.altitude-title-field` class on the ALTITUDE
  wrapper div, keeping the exact-8px title-to-row spacing from the prior fix. Added
  `margin-bottom: 18px` to `.preflight-rules-row` so it has proper spacing before Block Time now
  that it's no longer the last element before the Generate button. Tested: no console errors,
  layout renders as expected.

## 2026-07-24 (later session, part 3)

- **Route-header ICAO shrink fixed** — `.contract-ticket-route--long-icao` (39px→31px) was
  triggering whenever EITHER side was 5 characters; tested it only actually risks overflow when
  BOTH sides are 5 characters (single-5-char-side fits fine at full size). Changed the trigger
  from `||` to `&&` (dispatch-engine.js `fillBoardRouteCells`). Unrelated to the earlier
  logbook-column test — that was a different UI element (104px table cell vs this 39px ticket
  header), never tested until now.
- **Small DEP:/ARR: ICAO now colour-matches the big header ICAO** — refactored the owned/Asobo
  colour logic into one shared `getIcaoHighlightClass()` helper (dispatch-engine.js), used by
  both the big route-header ICAO and `formatBoardTicketSceneryLine()`'s small ICAO. Owned (green)
  still wins over Asobo-default when both apply.
- **Asobo-default highlight changed from blue to dark green** — `.msfs-default-airport-icao`
  colour changed to `#1f5c22` (was `#4a9ed6`), per updated preference.
- **Military ticket footer strip now matches the top military accent colours** — added
  `.contract-ticket.is-military.is-selected .contract-ticket-export::before` overriding the
  civilian silver gradient with `var(--military-ticket-accent-bottom/top)`, mirroring the
  existing `.contract-ticket-photo-wrap::before` military override. The drop-shadow `::after`
  also gets a darker 0.2 opacity (vs civilian's 0.12) on military tickets. Verified via computed
  style (not just screenshot, since an unrelated ticket-FX preset made visual comparison
  misleading in this test).
- **Options box height, drop shadow, civilian highlight direction** — all confirmed working from
  the prior session's changes; no further action.
- **F28 split into 4 separate aircraft** — Just Flight's F28 Professional bundles all 4 marks;
  fleet-db.js previously had one "F28" entry (confirmed via matching mtow/oew/range to be the Mk
  4000). Added F28_1000, F28_2000, F28_3000 as new fleet entries (all `simbriefIcao:"F28"` since
  the real ICAO type code doesn't distinguish marks), sourced from the Just Flight F28
  Professional Operations Manual, cross-checked against SimBrief airframe profiles for all 4
  marks (near-exact agreement). Added matching mission-assignment coverage (copied F28's imgId
  list) to BOTH mission-assignments-data.js AND mission-assignments.json — the JSON file is
  loaded in preference to the embedded script data (`initMissionAssignments()` tries
  `mission-assignments.json` first) and was the actual cause of a fatal "VECTOR cannot start"
  error until both were updated. Ran `node dev/scripts/validate-assignments.mjs` (115/115) and a
  live browser smoke test after — passing.
- **MLW/MZFW: 15 more aircraft resolved via real SimBrief airframe profiles** — found a large
  folder of saved SimBrief profile screenshots at
  `Vector-Dev-Tools/references/` covering most of the previously-ambiguous aircraft. Cross-checked
  each against this database's stored MTOW (exact match = correct source) before applying:
  A346, A388, B722, B72F, CRJ7, E190, E195, FA50, LJ35, MD11, MD1F, MD82 (mzfw), MD88 (mzfw) all
  added/completed. **F70 and F100 corrected** — the manual figures pasted earlier didn't match
  this database's stored MTOW (a different/higher weight variant); the SimBrief profile's MTOW
  matched exactly, so MLW/MZFW were replaced with the SimBrief-sourced figures instead
  (F70: mlw 36741/mzfw 32659; F100: mlw 39916/mzfw 36741). E190/E195 resolved cleanly this way
  too — the FSS Documentation Hub page pasted earlier didn't match either aircraft's stored MTOW
  at all (38,790 kg vs our 50,299/50,790 kg), so those figures were discarded in favour of the
  matching SimBrief dual-class profile. Full post-change sanity check run: no MLW>MTOW or
  MZFW>MLW inconsistencies across all 21+15 entries added this session.
- **Not resolved, still open**: JAGR (Jaguar) and TOR (Tornado) confirmed to have no publicly
  published MLW/MZFW (military types, operationally rather than structurally limited) — correctly
  left blank, not pending further work.

## 2026-07-24 (later session, part 2)

- **Altitude spacing fix, corrected** — the earlier fix in this session (10px wrapper margin) was
  wrong: the ALTITUDE label's own margin-bottom (8px) doesn't collapse into its wrapping
  `.dispatch-form-field` div (that div isn't a plain block-margin-collapse context here), so the
  10px I added stacked on top of the label's 8px for an 18px total gap instead of matching the
  8px reference gap used by DEPARTURE AIRPORT/ATC CALLSIGN/AIRCRAFT TYPE. Changed
  `.preflight-rules-divider + .dispatch-form-field` margin-bottom to 0 (styles.css) — tested,
  gap is now exactly 8px on both, matching pixel-for-pixel.
- **Asobo/MSFS-default airport highlight** — airports that ship with MSFS by default (tags
  `Hand-Crafted`, `Asobo Detailed Airports`, `MSFS 2024 Detailed Small Airports`, `Asobo
  Gliderport`) now render their ICAO in blue (`#4a9ed6`, reusing the Generate Flight button's
  existing blue rather than introducing a new hue) on job tickets, via a new
  `airportIsAsoboDefaultIncluded()` helper and `.msfs-default-airport-icao` class
  (dispatch-engine.js, styles.css). This is purely visual — it does NOT add these airports to
  the Owned Airports pool or the "prefer owned" routing weight, which stays exactly as before.
  Owned-green still wins if an airport is both owned and Asobo-default.
- **Options box bottom alignment** — `.board-sidebar-app-version` padding-bottom 20px → 26px so
  the Options card's bottom edge lines up with the bottom of the 3-ticket stack again (this had
  drifted by ~6px after the altitude-spacing fix shortened the card). Tested: now within 0.3px.
- **Ticket footer drop shadow** — added a faint (12% black, fading to transparent) 22px shadow
  above the existing 44px silver strip on the post-Accept ticket footer
  (`.contract-ticket.is-selected .contract-ticket-export::after`, styles.css) — half the strip's
  height, per spec. Shown to user for review before considering final.
- **MLW/MZFW added for 21 aircraft** — CRJ7, AT46, AT76, M600, C160, C20F, C208, BE20, FA50,
  A319, LJ35, B38M, A359, MD82, MD88, H47D, B737, B77W, B105, AS65, H65M (fleet-db.js). Sourced
  from user-provided manufacturer/product-manual figures (cross-checked against an earlier
  background web search where they overlapped — e.g. B38M and B77W matched independently, high
  confidence). B737 specifically uses the PMDG raw-config figures (58,605/55,196 kg) rather than
  the "Typical 737-700" manual table (58,059/54,657 kg) because the config figures match this
  aircraft's exact stored MTOW (155,000 lb); the manual table is a different, lower-MTOW variant.
  Helicopters (H47D, B105, AS65, H65M) got mlw = mtow, matching the real-world fact that
  helicopters have no separate landing weight limit. Left blank/unresolved, pending
  clarification: A346, A321 (variant/MTOW mismatch), B72F, B722, E190, E195 (user-provided
  figures directly conflicted with each other), A388 (range only, no single figure), F100, F70
  (combined ambiguous source sentence), F28 (clean data exists but ties equally to two different
  marks sharing this aircraft's MTOW — need to know which mark the addon models), MD1F, MD11
  (internally contradictory figures in the sourced text). JAGR and TOR confirmed to have no
  publicly published MLW/MZFW (military types, operationally rather than structurally limited)
  — left blank, not pending.
- **Navigraph-only + Military-airbases interaction investigated, not changed** — checked whether
  the two toggles should be mutually exclusive. Found 63 of the app's 69 military-tagged
  airports (91%) are already present in the Navigraph ICAO dataset (data/navigraph-airport-icaos.js),
  contradicting the assumption that Navigraph has no military coverage. Recommended NOT making
  them mutually exclusive, since combining both already works correctly as an intersection filter
  in the vast majority of cases — no code change made.

## 2026-07-24 (later session)

- **Scenery ticket labels renamed for clarity** — `formatSceneryTicketLines()` (dispatch-engine.js)
  now displays "MSFS hand-crafted airport" instead of "Hand-Crafted", and "MSFS default detailed
  airport" instead of "MSFS Small Detailed". Display-only; db.js tag values (`Hand-Crafted`,
  `Asobo Detailed Airports`, etc.) untouched. Tested (Playwright, real ticket render): both new
  strings fit on one line with room to spare.
- **Logbook Remove column left-aligned** — `#logbookTable .lb-action` was `text-align: center`
  (styles.css), which is why it looked misaligned versus the other left-aligned columns; not a
  width problem (route/aircraft/mission columns were re-tested with worst-case 5-char ICAOs and
  the longest real aircraft/mission strings — all already fit, no width changes needed there).
- **Military toggle fold** — removed the separate "CIVILIAN AIRCRAFT CAN FLY MILITARY JOBS"
  sidebar checkbox (index.html) and its `contractorToggle`/`syncContractorMilitaryOptions()`
  wiring (dispatch-engine.js). "USE MILITARY AIRBASES" alone now drives `isContractorMode`, so a
  civilian aircraft becomes eligible for military jobs whenever military airbases are enabled —
  no separate opt-in. Updated the Add New Airport note-text to match. Left `RECON` (Strategic
  Recon. Missions) and `CIVIL_OK` (Can also fly civilian contracts) checkboxes in the Add New
  Aircraft form alone — checked missions-db.js/fleet-db.js and both are load-bearing (6 real
  recon-type mission scenarios; 6 built-in military transports use CIVIL_OK to also fly civilian
  freight) and not made redundant by the toggle fold.
- **Add New Aircraft: Fighter Jet auto-ticks Military Aircraft** — `updateCustomAircraftForm()`
  already auto-ticked Fighter and Military-role when Aircraft Type = "Fighter Jet" (MIL_JET); now
  also auto-ticks the "Military Aircraft" checkbox itself, closing the one gap.
- **Sidebar spacing** — ALTITUDE title-to-row gap reduced from 18px to 10px (new scoped rule
  `.preflight-rules-divider + .dispatch-form-field`, styles.css) to match the ATC
  CALLSIGN/AIRCRAFT TYPE title-to-field spacing; Generate Flight button moves up as a normal
  document-flow side effect. Tested: Options box bottom now sits ~4px from the job ticket stack
  bottom (was a larger gap before). The "equalize routing checkbox spacing" ask became moot once
  the civilian-toggle checkbox was removed — only one checkbox (Military Airbases) remains under
  the Navigraph option, at the existing 14px gap, nothing left to make consistent.
- **DESIGN.md added** — snapshot of the current visual language (colour, typography, spacing
  rhythm, borders/radius, component patterns) plus guidance for keeping new work consistent with
  it, mirroring ARCHITECTURE.md's role for how things work. CLAUDE.md now points to it before any
  CSS/layout change.

## 2026-07-24

- **Job ticket redesign completed (VALUE placement, scenery block reorder, overflow fix, sidebar tweaks)** —
  finishes the redesign logged further below. Fixed the fixed-840px-ticket overflow bug
  (Accept Contract button clipped, worst case ~+10.67px over) via several changes:
  1. Removed the "SCENERY LINKS" label entirely (index.html, all 3 ticket templates) — won
     back ~22px.
  2. Moved the DEP:/ARR: scenery block from directly under VALUE to below the
     ACFT/CRZ ALT/PAX/CARGO/DESTINATION HAS ILS/OTHER/NAVIGRAPH block, so ACFT is now the
     first row after VALUE. Dotted `.contract-ticket-meta-divider` between DEP and ARR was
     removed then re-added after testing showed there was still headroom for it (kept, it
     reads better).
  3. Unified every dotted-line-adjacent gap in the ticket to a flat 8px
     (`.contract-ticket-rule + .contract-ticket-meta` and `.contract-ticket-meta-divider`
     margins, styles.css ~3220/~3259) — was inconsistently 8px/12px/14px depending on
     location.
  4. `.contract-ticket-actions` had a duplicate `padding-top: 12px` stacking on top of
     `.contract-ticket-footer`'s own 12px (styles.css ~3271/~3279) — removed the duplicate.
     The `is-selected` state already zeroed both, which is what exposed this as dead
     redundancy rather than intentional spacing.
  5. `.contract-ticket-scenery-icao` font-size 13px → 12px; `.contract-ticket-body >
     .contract-ticket-label:first-child` margin-top 20px → 10px (moves ROUTE/VALUE up
     toward the CONTRACT heading); `.contract-ticket-mission` line-height 1.1 → 1.02
     (and its matching min/max-height calc) to trim the fixed 3-line title box slightly.
  - Tested worst case via Playwright: EICK on both DEP and ARR (a real airport with both
    Hand-Crafted and third-party tags — 50 such airports exist in the DB, so this isn't
    contrived) combined with a mission title long enough to hit the 3-line wrap cap.
    Accept Contract button now sits ~15-16px inside the ticket bottom, no overflow.
  - Sidebar Options panel: moved "Only use Navigraph airports" to below the Routing
    Options dropdown; removed the divider that sat directly below "Continue from last
    airport?" (kept the one now sitting directly above Routing Options); added an
    "ALTITUDE:" title above the IFR/VFR buttons, styled like the other field titles
    (index.html ~123-189).

- **Job ticket redesign (Scenery Links section, height, panel title alignment)** —
  Fixed three things reported as messy:
  1. CONTRACTS BOARD/LOGBOOK/SETTINGS titles were not aligned with each other or
     with the Pre-Flight container's top edge. Root cause found via Playwright pixel
     measurement (PNG crop + ImageMagick trim, since JS Range/getBoundingClientRect
     do not report true glyph-ink position for large uppercase text): each heading's
     visible ink rendered ~5-12px below its own CSS box top, and Logbook/Settings had
     never been converted to the Contracts Board heading treatment. Fixed with
     `transform: translateY(-5px)` on all three headings (styles.css ~2328,
     ~3481) — verified via pixel trim that ink-top now lands exactly on box-top
     (108px) for all three. Also reduced the heading-to-content margin-bottom from
     28px to 12px (styles.css ~2324, ~3484) to compensate for font-metric
     whitespace inside the line box, so the ink-bottom-to-next-content gap is a true
     28px, matching `--board-sidebar-rhythm` used elsewhere (Pre-Flight-to-Options
     gap, gap between the 3 side-by-side tickets - both already 28px, unchanged).
  2. Added a "SCENERY LINKS" label above the DEP:/ARR: lines and a dotted
     `.contract-ticket-meta-divider` beneath them (index.html, all 3 ticket
     templates) so the section reads as its own block instead of running into
     CONTRACT VALUE.
  3. Ticket card height (`.contract-ticket`, styles.css ~2591) increased from a
     fixed 783px to 876px, measured live via Playwright to match the bottom of the
     opened Options accordion. This also fixes the clipping bug logged
     2026-07-24 below (confirmed via `scrollHeight` vs `clientHeight`: content
     needed 860px, was clipped by 77px at 783px height; at 876px content now fits
     with ~16px to spare, no clipping, footer/Accept button fully visible).
     Scenery-link capping (first store + "+N more") was discussed but deliberately
     deferred — user wants to see real-world behaviour at the new height first
     before deciding if it's still needed.

- **Added 6 named high-terrain boxes to `globalRanges`** (dispatch-engine.js
  ~line 5179): Caucasus, Ethiopian Highlands, Mexican Sierra Madre /
  Trans-Mexican Volcanic Belt, New Zealand Southern Alps, Scandinavian
  Mountains, Papua New Guinea Highlands. Same cheap-approximation approach as
  the existing 6 boxes (broad lat/lon box + fixed-wing/heli safeFloor), no DEM
  data. Verified region matching against real airports in the live DB for all
  6 (Caucasus/NZ/Scandinavia/Mexico/PNG had matches; Ethiopian Highlands
  currently has 0 airports in VECTOR's DB, so that box is inert until/unless
  airports are added there — harmless). Verified one live dispatch
  end-to-end (Caucasus, UGIZ departure, Piper Comanche 250, prefer-lower-
  cruise): 5 consecutive dispatches all landed at 12,000ft, never below the
  10,500ft safeFloor. Commit 2f37cd7.
- **Wired the dead `formatScenery()` function into the job ticket board** —
  it was fully unused (confirmed no callers), written for a `#dispatchRelease`
  panel that's been `display: none !important` since the board-ticket UI
  replaced it. Real data backing it still exists (`apt.tag`/`apt.allOptions`
  built in `rebuildActiveDatabase()`, comment there literally says "kept for
  Job Ticket scenery links only"). Added DEP:/ARR: lines to the job ticket
  (dispatch-engine.js: `formatSceneryTicketDetail`, `formatBoardTicketSceneryLine`,
  wired via `fillBoardRouteCells`; index.html: new `dep-scenery`/`arr-scenery`
  spans on all 3 ticket templates). Commit 2f37cd7.
  - **Known issue, not yet fixed:** airports with several third-party store
    options render 3+ "OR"-joined links, wrapping to multiple lines and
    pushing ticket content past the fixed 783px card height (`overflow:
    hidden` silently clips the accept button/footer — looked like a visual
    glitch in testing). Follow-up layout task agreed with user, tracked as a
    to-do: add a "Scenery Links" label, cap store links shown (first + "+N
    more"), and increase ticket height using a consistent spacing value also
    applied to nav-tab-title alignment. Not started yet.
- **IFR/VFR/HELI cruise altitude could round below its own safety floor** — reported case:
  Piper Comanche 250, EDGI (elev 1375ft) -> EDSP (elev 1315ft), IFR + Prefer Lower Cruise,
  dispatched at 4000ft. The safety floor for that route (`terrainSafetyFloor`, field
  elevation + 3000ft) was 4375ft, so 4000ft was below it. Root cause: altitude selection
  sampled a continuous value in range then flooring it to the nearest thousand, only
  bumping up on a hemispheric-parity mismatch — if the floored value already matched the
  required parity (odd/even by direction), it shipped as-is even when below the floor,
  since 4375ft isn't itself a round thousand. Fixed (dispatch-engine.js, altitude-selection
  block ~line 5216) by computing the valid parity-correct thousand range first (floor
  rounded up, ceiling rounded down) and sampling only from that integer set, so an
  under-floor result is now structurally impossible. VFR and HELI dispatch share this exact
  code path, so the fix applies to all three. Verified: 200k simulated draws at the reported
  floor produced zero under-floor results (min 6000ft, correctly 2000ft above the old bad
  4000ft since 4000 < 4375); a floor that's already a valid round/parity-matching thousand
  (5000ft) is still exactly reachable, confirming no over-restriction. Live-tested in
  Playwright (Comanche 250 + IFR + Prefer Lower Cruise, several routes, sane altitudes, no
  errors). Commit 67fdc5b.
  - Considered and declined: importing NOAA's public-domain GLOBE 1km DEM (via LittleNavMap's
    same data source) for true terrain-following altitude checks. License is fine (public
    domain, no-warranty disclaimers only), but the dataset is 1.83GB — impractical for this
    repo/GitHub — and disproportionate to how VECTOR is actually used (straight A-to-B,
    SimBrief handles routing, no route-around-terrain planning in VECTOR itself). Kept the
    existing simplified floor (airport elevation + fixed buffer, plus named mountain-range
    boxes); note for later: if a specific region keeps producing altitudes that feel wrong,
    add more named high-terrain boxes rather than the full DEM.
- **Removed the "Zoom" job-ticket photo animation filter** — user preference, only
  Static/CRT remain. Removed from index.html (markup), styles.css (grid now 2 columns, all
  `ticket-photo-fx-zoom` rules gone including a reduced-motion override), dispatch-engine.js
  (`TICKET_PHOTO_FX_MODES`, fallback defaults, per-card class cleanup list). Also corrected
  the Job Ticket Photo Filter settings-panel preview to be an exact 1:1 match of the real
  ticket: box aspect-ratio 308/171 (was an approximate 298/178), and CRT preview brief text
  font-size corrected from 13px to 16px after discovering via live measurement in Playwright
  that CRT-mode ticket brief text actually renders at 16px (a generic
  `.contract-ticket.ticket-photo-fx-crt .contract-ticket-photo-brief` rule overrides the
  base 13px rule). Hint text updated to user's wording. Commit b4e7b49.
- **Mission photos resized to eliminate downscale moire** — all 230 `images-missions/*.jpg`
  resized from ~1024px-wide originals to 616x342 (2x the 308x171 ticket photo box) using
  ImageMagick `mogrify -filter Lanczos -resize 616x342 -quality 88`, run by the user outside
  Claude Code. Root cause of the moire: the browser was live-downscaling full-res source
  images by a large, non-integer ratio combined with the crop tool's 100-115% zoom, which
  a dedicated resize with proper resampling avoids. Also: ticket photo box height changed
  210px -> 171px (styles.css) to match the images' native ~1.8:1 aspect ratio, crop settings
  reset to defaults for the user's re-crop pass, and the crop tool's preview box resized to
  match exactly and had a fake header-stripe overlay removed. Commit b4e7b49.

---

## 2026-07-22

- **Owned-airport green ICAO highlight restored on job tickets** — codes in the Owned
  Airports list stopped showing green on tickets. Root cause: `formatRoutingAirportLabel`,
  the function that applied the `.owned-airport-icao` CSS class, was removed as "dead code"
  in a prior audit (AUDIT.md §1D) because it had zero call sites — but it was still a live
  feature, just orphaned when ticket rendering moved to `fillBoardRouteCells()` without
  being updated to match. Fixed by adding the owned-airport check directly into
  `fillBoardRouteCells()` (dispatch-engine.js). Also reviewed the "Enable Preferred Routing"
  logic (`buildContractorRoutePool`, used on both the contractor and normal dispatch paths)
  and confirmed it was never affected — owned airports are still weighted into route
  selection correctly. User-tested and confirmed working. AUDIT.md §1D corrected in place.
- **Cruise-altitude randomization window widened off the ceiling** — the simplified
  terrain/altitude dispatch logic (still live: feeds SimBrief's `fl=` param and the
  generated `.pln` file's altitude, even though altitude was removed from the ticket
  display long ago) was picking cruise altitude from only the top 4000ft below the
  aircraft's effective ceiling, regardless of the true minimum required altitude. This
  explains consistently near-max-altitude dispatches. Fixed the non-distance-limited case
  in the altitude calc (dispatch-engine.js, `dynamicMinAlt`) to use the full min-to-max
  range. Not yet tested in-app. Follow-up planned: the altitude cap still only accounts for
  climb distance, not descent distance, which can dispatch altitudes unreachable within a
  short flight's remaining distance before landing (user-reported: can't reach cruise
  before ATC calls for descent on ~60-70 min flights). Full climb+descent-aware rework
  planned for next session.
- **Short-haul dispatched block time now scales tolerance with the slider target** — the
  actual dispatched block time was drifting well past the target (e.g. a 60 min target
  often landing at 75). Root cause: the fallback/relaxed tolerance tiers used flat minutes
  (±15 / ±20) regardless of target, so short targets (40-60 min) got the same leeway as
  long ones (120 min), which is proportionally much worse at the low end.
  `FIXED_DEPARTURE_BLOCK_TOLERANCE_MINS` (15) and `FIXED_DEPARTURE_BLOCK_RELAXED_MINS` (20)
  were removed and replaced with `getShortHaulFallbackToleranceMins(targetMins)` (20% of
  target, floor 10 / cap 15) and `getShortHaulRelaxedToleranceMins(targetMins)` (30% of
  target, floor 10 / cap 20). Tier 1 tolerance (`SHORT_HAUL_SIMBRIEF_PICK_TOLERANCE_MINS`)
  also raised from 8 to 10, and the proximity-weighting formula in `pickShortHaulRoute` now
  references that constant instead of a separate hardcoded 8. Verified: no leftover
  references to the removed constants, dispatch-fleet-smoke.mjs (112/112 pass),
  dispatch-physics-verify.mjs --quick (pass), and manual dispatch probes at sliders
  40/60/90/120 on C172 (GA), BE20 (TURBO), B738 (JET), C700 (BIZ JET) — 16 combinations,
  5 runs each, all landed within the new tier bounds.

---

## 2026-07-21

- **Mission title per-word cap corrected from 9 to 12 characters** — GUIDE.md's
  title rule said the cap should be verified against live CSS, but it never had
  been. Measured in-browser against the real `.contract-ticket-mission` rule
  (Roboto 800, 33px, 276px box): a 10-letter word like "Turnaround" renders at
  219px, well inside the line. 9 was too conservative and had forced awkward
  word substitutions. Updated GUIDE.md and mission-review-tool.html's cap
  check to 12. Re-reviewed the 10 entries in
  Vector-Dev-Tools/mission-rewrites-staging.json against the new cap: none
  had violated the old limit, but 4 titles were rewritten for better wording
  now that the false constraint is gone — imgId 33 "Morning Meetings Run" →
  "Half-Awake Meeting Rush", imgId 24 "Tight Turn Sector" → "Tight
  Turnaround", imgId 171 "Roadside Trauma Run" → "Roadside Extraction",
  imgId 67 "Private Gala Run" → "Private Gala Charter" (briefs adjusted to
  match where needed). See AUDIT.md §6.
- **MTOW enforcement extended to BIZ JET and TURBO aircraft** — the MTOW (max takeoff
  weight) physics check previously only ran for JET-class aircraft; BIZ JET and TURBO
  had no final takeoff-weight verification. Fuel-budget formula was branched so this
  doesn't just widen the JET gate blindly: JET aircraft keep the SimBrief-style tank/wind
  fuel model, while BIZ JET/TURBO use the simpler fuelPerNm-based calc (matching how their
  payload was already allocated elsewhere) — this avoids feeding non-JET aircraft an
  airliner fuel model they don't match. Tank-capacity checks stay JET-only for now, since
  most BIZ JET/TURBO aircraft don't have maxFuelKg sourced yet. Verified with
  dispatch-fleet-smoke.mjs (112/112 pass), dispatch-physics-verify.mjs --quick (pass), and
  manual dispatch tests on C700 (BIZ JET), A400 and BE20 (TURBO) — BE20 produced an edge
  case with only 13kg of MTOW margin, correctly passed rather than silently allowed over.
  (commit a59077c, local only, not yet pushed)
- **Contracts Board sidebar layout fixed** — the Pre-Flight card, logo, rule line, and Options container weren't aligning correctly in the sidebar. Fixed. (commit 1149258e)
- **Time slider now looks the same in every browser** — the Block Time slider handle showed up grey with no grip marks and a black rollover in Chrome/Edge, but looked correct in Firefox. Chrome/Edge were falling back to the browser's native slider styling instead of using the custom look. Also fixed while in there: the red X on warning dialogs was stuck at a small size regardless of CSS changes (a global button style was overriding it with `!important`), and stray tick marks Chrome/Edge were drawing on the slider are now removed. (commit 0da0112)
- **MLW/MZFW data added for 60 of 112 aircraft** — max landing weight and max zero-fuel weight values added to fleet-db.js so the dispatch weight caps (added last session) actually have data to work with for those tails. 52 aircraft still need values sourced. (commit 8adf204)

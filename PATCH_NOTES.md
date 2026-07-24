VECTOR Dispatch Tool — Patch Notes

A running, plain-language log of what changed each session, so we don't have to rely on memory to track progress. Newest entry on top. Keep entries short: what changed, why, commit hash.

---

## 2026-07-24

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

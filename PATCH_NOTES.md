VECTOR Dispatch Tool — Patch Notes

A running, plain-language log of what changed each session, so we don't have to rely on memory to track progress. Newest entry on top. Keep entries short: what changed, why, commit hash.

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

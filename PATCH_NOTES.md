VECTOR Dispatch Tool — Patch Notes

A running, plain-language log of what changed each session, so we don't have to rely on memory to track progress. Newest entry on top. Keep entries short: what changed, why, commit hash.

---

## 2026-07-21

- **Contracts Board sidebar layout fixed** — the Pre-Flight card, logo, rule line, and Options container weren't aligning correctly in the sidebar. Fixed. (commit 1149258e)
- **Time slider now looks the same in every browser** — the Block Time slider handle showed up grey with no grip marks and a black rollover in Chrome/Edge, but looked correct in Firefox. Chrome/Edge were falling back to the browser's native slider styling instead of using the custom look. Also fixed while in there: the red X on warning dialogs was stuck at a small size regardless of CSS changes (a global button style was overriding it with `!important`), and stray tick marks Chrome/Edge were drawing on the slider are now removed. (commit 0da0112)
- **MLW/MZFW data added for 60 of 112 aircraft** — max landing weight and max zero-fuel weight values added to fleet-db.js so the dispatch weight caps (added last session) actually have data to work with for those tails. 52 aircraft still need values sourced. (commit 8adf204)

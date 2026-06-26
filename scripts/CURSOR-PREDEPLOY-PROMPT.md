# Cursor pre-deploy verification prompt

Copy everything below the line into a **new Cursor chat** when you want a full health check before release.

**Do not apply cleanup or refactors automatically.** List suggestions at the end and wait for my approval.

---

## Task

Run the Vector Flight Dispatch pre-deploy verification workflow. The app works well today — **do not break working behaviour**. Fix only clear bugs (data errors, logic mismatches, missing files). For style refactors or structural cleanup, **describe them first and ask before changing anything**.

## Step 1 — Run automated audits

From the project root, run:

```bash
python scripts/vfd-verify.py --predeploy
```

If anything was recently edited, also run with `--force`. To write internal verification tags into source files after a clean pass:

```bash
python scripts/vfd-verify.py --predeploy --stamp
```

Individual checks (menu equivalents):

| Goal | Command |
|------|---------|
| Airport DB 1–9 | `python scripts/vfd-verify.py --airport N` |
| All airports | `python scripts/vfd-verify.py --predeploy` (or menu **A**) |
| Fleet | `python scripts/vfd-verify.py --fleet` |
| Missions + dispatch | `python scripts/vfd-verify.py --missions` |
| Status only | `python scripts/vfd-verify.py --status` |

**Airport menu map:** 1 Hand-crafted, 2 Contrail, 3 Flightsim.to, 4 iniBuilds, 5 ORBX, 6 Other, 7 UK2000, 8 Gliders, 9 Small detailed.

Already-verified databases are **skipped** when the file checksum matches `scripts/verification-manifest.json`. Use `--force` to re-audit.

## Step 2 — What each layer must validate

### A. Airport databases (`airports-db-*.js`)

For each of the 9 files, confirm every entry has:

- Valid ICAO (3–4 chars), non-empty name
- `lat` / `lon` finite, not `0,0`, within Earth bounds
- `rwy` in `GA | TURBO | BIZ JET | JET | HELI | GLIDER`
- `length` > 0 unless `rwy` is `HELI`
- **Same ICAO from different sources/developers is allowed** (e.g. Contrail vs ORBX) — each row is scenery metadata; routing does not prefer one shop over another
- **Exact 1:1 duplicate lines are errors** — identical copy-pasted object literals; remove extras with `--dedupe-exact` (keeps first occurrence)

**ICAO safeguard (mandatory — verification and any data fixes):**

- **Never normalize or replace `icao`** during audits, scripts, or AI-assisted edits
- **MSFS custom / sim codes** in `airports-db-hand-crafted.js`, `airports-db-small-detailed.js`, and `airports-db-gliders.js` **must stay exactly as stored** (e.g. `03G`, `02FA`, `0PA0`)
- Do **not** substitute real-world ICAOs from FAA, OurAirports, or `(IRL: XXXX)` name suffixes
- Do **not** re-introduce build-time ICAO alias mapping — the removed import pipeline must not be restored for this purpose
- `--dedupe-exact` only removes identical object literals; it does not rewrite ICAO fields

On **first clean pass**, record verification in `scripts/verification-manifest.json`. With `--stamp`, add file header `/* vfd-verified: … */` and per-airport `vfVerified: true` (internal only; dispatch ignores unknown fields).

### B. Fleet (`fleet-db.js`)

Run `python scripts/audit-fleet-missions.py` — **zero `[ERROR]` lines**.

Tag rules (see `.cursor/rules/fleet-mission-eligibility.mdc`):

- `PAX` when `maxPax > 0`; `FREIGHTER` when `maxCargo > 0`
- Military airlifters: `MILITARY_TRANSPORT` or `MILITARY_HELI` as appropriate
- `CIVIL_OK` only when aircraft may fly civilian missions
- Dual-role military (`PAX` + `FREIGHTER` + military transport): troops assigned on T23/T29/T30

On clean pass, manifest + optional `"_vfVerified": "<timestamp>"` per aircraft entry.

### C. Missions, dispatch, HTML, images

Run and reconcile:

- `python scripts/audit-predeploy.py` — version sync, mission images on disk, long-haul scenario pools, imgId duplicates, dispatch-engine logbook hooks
- `python scripts/audit-longhaul-math.py` — block time / range math vs `dispatch-engine.js`
- `python scripts/audit-fleet-missions.py` — mission template ↔ fleet eligibility

Confirm:

- Every referenced `imgId` has `images-missions/mission{N}.jpg`
- No unexpected cross-pool `imgId` duplicates (known intentional pairs in `audit-predeploy.py` are OK)
- `missionMatrix` pools exist in `scenarioDB`
- `LONG_HAUL_SCENARIOS_BY_MISSION` imgIds are in the correct pools
- `loader.js` script list matches deployed DB files; `index.html` loads `loader.js`
- Dispatch functions used in audits still exist: `passesMissionAircraftRole`, `isMilitaryMissionRestricted`, `missionRequiresPassengers`, `getMergedSeedAirports`

On clean pass, manifest + optional `vfVerified: true` on each `missionMatrix` entry.

### D. Math / routing sanity (read-only spot checks)

Without changing formulas unless broken, verify these mirror `dispatch-engine.js`:

- Haversine / distance used for routing
- Long-haul: `effectiveMins = max(60, slider - 30)`, block minutes = `dist/speed*60 + 30`
- `passesMissionAircraftRole`: freight needs `FREIGHTER` + `maxCargo`; passenger missions need `PAX` + `maxPax`
- Runway class gate: `getAllowedClassesForRunway(ap.rwy)` includes aircraft class
- Military base filter: `ap.isMilitary` vs `spec.isMilitary` / contractor mode

## Step 3 — Fix policy

| Finding | Action |
|---------|--------|
| Data error (bad ICAO, missing image, tag mismatch) | Fix directly |
| Version drift (`loader.js` ≠ `version.json`) | Bump **both** together |
| Logic bug with failing audit | Minimal fix in `dispatch-engine.js` / `missions-db.js` / `fleet-db.js` |
| Style refactor, rename, dedupe | **Suggest only — do not apply** |
| Performance micro-optimisation | **Suggest only** |

After fixes, re-run `python scripts/vfd-verify.py --predeploy --force` until zero errors.

## Step 4 — Version and deploy list

When all checks pass:

1. Bump patch version in **both** `version.json` and `loader.js` `APP_VERSION` (or run menu **V** / `bump_version` in `vfd_verify_lib.py`).
2. Print an upload checklist:

**Always upload if changed:**

- `loader.js`, `version.json`, `index.html`, `dispatch-engine.js`
- `fleet-db.js`, `missions-db.js`
- All `airports-db-*.js` files you modified
- `images-missions/` — only changed `.jpg` files
- `favicon/site.webmanifest` if touched

**Do not upload:** `scripts/`, `.cursor/`, `verification-manifest.json` (local audit state only, unless you want to keep stamps in repo).

## Step 5 — Final response format

Reply with:

1. **Audit summary** — pass/fail per layer (airports 1–9, fleet, missions/dispatch)
2. **Fixes applied** — file + one-line what changed (if any)
3. **Remaining warnings** — informational only
4. **Deploy checklist** — exact files to upload
5. **Suggested improvements (not applied)** — bullet list of optional cleanups; end with: *"Would you like me to apply any of these?"*

---

## One-time first run (recommended order)

1. Menu **1** through **9** — verify each airport DB once (`--stamp` optional)
2. Menu **F** — fleet once
3. Menu **M** — missions/dispatch once
4. Menu **P** — full pre-deploy before each release (skips unchanged verified files)

Windows: double-click `verify-vfd.bat` for the interactive menu.

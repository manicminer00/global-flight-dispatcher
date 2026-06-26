# Vector Flight Dispatch — scripts

## What to run (day to day)

| Goal | What to use |
|------|-------------|
| **Interactive menu** (airports 1–9, fleet, missions, pre-deploy) | Double-click **`verify-vfd.bat`** in the project root, or run `python scripts/vfd-verify.py` |
| **Full check before upload** | `python scripts/vfd-verify.py --predeploy` |
| **Cursor AI pre-deploy review** | Copy `scripts/CURSOR-PREDEPLOY-PROMPT.md` into a new chat |
| **See what is already verified** | `python scripts/vfd-verify.py --status` |

The **menu** lives in **`vfd-verify.py`** (launched via `verify-vfd.bat`). You do not need to run the other Python files directly unless you are debugging one specific audit.

### Menu options (in `vfd-verify.py`)

```
1–9   Verify one airport database (Hand-crafted, Contrail, Flightsim.to, …)
A     Verify all airport databases
F     Verify fleet (specs + mission eligibility; per-aircraft tracking)
M     Verify missions, dispatch engine, images, long-haul math
P     Full pre-deploy (A + F + M)
S     Show verification status (what is skipped on next run)
V     Bump patch version (loader.js + version.json)
Q     Quit
```

Verified state is tracked **per ICAO** (airports) and **per aircraft type** (fleet) in `verification-manifest.json`.
New or edited entries are audited on the next run; unchanged verified entries are skipped.
Use `--force` to re-audit everything.

Useful flags: `--stamp` (write internal vfVerified tags into .js), `--dedupe-exact` (remove exact copy-paste duplicate airport lines).

**Fleet POH / developer data:** add rows to `scripts/fleet-reference.json` (see `STAR` example). Aircraft without a reference row still get structural checks.

### ICAO safeguard (verification only)

The checker **never** normalizes or replaces `icao` values. In particular, MSFS custom / sim identifiers in these files must stay exactly as stored:

- `airports-db-hand-crafted.js`
- `airports-db-small-detailed.js`
- `airports-db-gliders.js`

Do not substitute real-world ICAOs from FAA, OurAirports, or name suffixes such as `(IRL: XXXX)`. The only automatic line removal is **exact 1:1 duplicate object literals** (`--dedupe-exact`), which does not change ICAO text.

When editing airport data or fixing audit findings, **never** “correct” a sim code to a real-world code. Cursor agents must follow the same rule — see `CURSOR-PREDEPLOY-PROMPT.md`.

---

## Files in this folder

| File | Role |
|------|------|
| `vfd-verify.py` | **Main entry — interactive menu + CLI** |
| `vfd_verify_lib.py` | Shared validation logic (used by vfd-verify) |
| `verification-manifest.json` | Local record of verified DBs (not uploaded to the site) |
| `CURSOR-PREDEPLOY-PROMPT.md` | Prompt for Cursor before a release |
| `audit-fleet-missions.py` | Fleet ↔ mission eligibility (called automatically by vfd-verify) |
| `audit-predeploy.py` | Images, imgIds, version sync, long-haul pools (called automatically) |
| `audit-longhaul-math.py` | Long-haul range/block math spot-check (called automatically) |
| `fleet-reference.json` | Optional POH / developer specs for fleet verification |
| `FLEET-MISSION-REFERENCE.md` | Auto-generated fleet/mission matrix (do not hand-edit) |
| `generate-airport-master.py` | **Experimental** — builds `database-db/` master + scenery split (not used by app yet) |

---

## Removed (June 2026)

One-off **airport database build** scripts (`build-batch*.py`, `build-germany-*.py`, OurAirports CSVs, batch JSON intermediates) and duplicate audits (`audit-mission-images.py`, `audit-class-missions.py`, `_audit-md1f.py`) were removed. Airport data now lives only in the root `airports-db-*.js` files; edit those directly or re-import from backup if you need to add airports in bulk.

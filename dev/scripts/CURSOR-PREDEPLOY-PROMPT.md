# VECTOR Flight Dispatch — Codebase Context Prompt

Use this prompt to bring a new AI session up to speed on the project before asking it to investigate bugs, suggest improvements, or make changes.

---

## Paste at the start of a new session

> You are working on **VECTOR Flight Dispatch** — a browser-based, single-page JavaScript flight-dispatch tool for Microsoft Flight Simulator (MSFS). The project lives in `D:\Project VECTOR\VECTOR DEVELOPMENT`. This folder is the only one you may access without explicit permission.
>
> **Core files:**
> | File | Purpose |
> |---|---|
> | `index.html` | Single-page app shell; all UI lives here |
> | `loader.js` | Bootstraps the app; loads all JS databases and the dispatch engine; holds `APP_VERSION` |
> | `dispatch-engine.js` | All dispatch logic, route selection, payload calculation, airport/aircraft validation, mission assignment |
> | `fleet-db.js` | Aircraft specs: `coreFleetSpecs` keyed by aircraft type code (e.g. `"B461"`) |
> | `missions-db.js` | Mission templates (`missionMatrix`) and scenario pools (`scenarioDB`) |
> | `airports-asobo-db.js` | Asobo/MSFS built-in airports (`seedAsoboAirportDatabase`). ICAOs may be 3–5 chars — Asobo uses custom MSFS identifiers |
> | `airports-thirdparty-db.js` | Purchased third-party add-on airports (`seedThirdPartyAirportDatabase`) |
> | `version.json` | Single `"version"` string; must match `APP_VERSION` in `loader.js` |
>
> **Verification / audit scripts (in `scripts/`):**
> | Script | Purpose |
> |---|---|
> | `vfd-verify.py` | Main verification CLI — run `python scripts/vfd-verify.py --predeploy` before every release |
> | `vfd_verify_lib.py` | Shared library for all verification logic |
> | `audit-predeploy.py` | Cross-checks missions, images, fleet tags, duplicate ICAOs |
> | `audit-fleet-missions.py` | Checks every aircraft against the mission filter rules |
> | `audit-longhaul-math.py` | Validates long-haul block-time math per aircraft |
> | **`DISPATCH-SCENARIO-AUDIT-PROMPT.md`** | **Behavioural bug audit — paste prompt for scenario matrix before claiming dispatch fixes** |
>
> ---
>
> ## Architecture
>
> 1. **Airport databases** were consolidated from 9 old split files into 2: `airports-asobo-db.js` (Asobo/MSFS built-ins, including gliders, hand-crafted, and small-detailed airports) and `airports-thirdparty-db.js` (Contrail, ORBX, iniBuilds, UK2000, Flightsim.to, etc.). An airport ICAO may appear in both files if multiple vendors sell that airport — this is intentional.
>
> 2. **Fleet specs** (`fleet-db.js`) define every aircraft as an object with:
>    - `name`, `class` (GA/TURBO/BIZ JET/JET/HELI/GLIDER/WARBIRD), `tags` array, `isMilitary`
>    - `minD`/`maxD` (range in nm), `minAlt`/`maxAlt`, `minRunwayLength` (ft), `rules` (IFR/VFR/Scenic)
>    - `mtow`/`oew` (kg), `maxPax`, `maxCargo` (kg), `fuelPerNm`
>    - Optional: `simbriefIcao` (real-world ICAO sent to SimBrief when the MSFS/fleet code differs), `isTactical`
>    - **Gliders** always have `fuelPerNm: 0` — this is correct; do not flag as an error.
>
> 3. **Missions** (`missions-db.js`) have two layers:
>    - `missionMatrix`: 38 types (types 8 and 9 do not exist — gap is intentional). Each type has filter rules (`allowedClasses`, `allowedAircraft`, `requiredTags`, `requiredDep`, `maxMTOW`, etc.) and a `pool` name.
>    - `scenarioDB`: pools of scenario cards, each with an `imgId`, `payload` text, and `instruction` text. Types 1–12 each map to exactly one card in the `uniqueMissions` pool. Types 13–38 draw randomly from larger pools (commercial, heavyFreight, etc.).
>    - The same `imgId` may appear in multiple pools — this is by design (a card image is reused across related mission contexts).
>
> 4. **Dispatch flow** (`dispatch-engine.js`):
>    - User picks aircraft + optional departure ICAO + slider (40–120 min short-haul, or long-haul mode).
>    - `getEffectiveBlockMinutes`: slider minus a 30-min pad and 10-min planning trim = routing target minutes.
>    - `getBlockSpeedForSpec`: assigns a cruise speed (knots) by class (JET=440, TURBO=270, HELI=80, GLIDER=70, etc.).
>    - `getRouteDistanceLimits`: converts block time to target nm. Builds primary band (±12%) and relaxed band (±28%) around target.
>    - `buildDispatchRoutingPools`: filters the active airport database down to airports the aircraft can use (runway class, runway length, military access).
>    - `buildJetRoutePairs`: tries primary band first; falls back to relaxed band if no airports qualify (`usedRelaxedRouting = true`).
>    - `pickShortHaulRoute`: randomly picks from the best-fit routes (minimising SimBrief proxy-block overshoot).
>    - If `usedRelaxedRouting` or the selected route distance is outside the primary window, **`ROUTE_FALLBACK_ALERT`** fires: *"No routes could be found using the existing airport database information. Your dispatcher has found the closest possible flight routing for you instead."* — this is a soft warning, NOT a hard failure; a flight is always generated.
>    - Mission is then assigned based on the aircraft's class, tags, and origin airport.
>
> 5. **Restricted airports** — EGLC (London City), EGNS (Isle of Man), SBRJ (Rio Santos-Dumont), LOWI (Innsbruck):
>    - These airports have noise/runway/terrain restrictions. Only specific jet types may operate there.
>    - `RESTRICTED_JET_BASE_TYPES` in `dispatch-engine.js` lists allowed type codes per airport. Aircraft variants (e.g. `B462_QT`) match via their `simbriefIcao` field (e.g. `"B462"`), so they are covered even if not listed explicitly.
>    - The override in `applyRunwayFieldExceptions` sets `allowed = true` and `lengthOk = true` for approved types, bypassing the standard runway-length check. This is intentional — EGLC's 4,948 ft runway is shorter than several approved aircraft's published `minRunwayLength`, but they are certified for the steep approach.
>
> 6. **Long-haul mode**: a toggle extends the slider range to 360–960 min. Only types listed in `LONG_HAUL_MISSION_TYPES` are available. Types in `LONG_HAUL_EXCLUSIVE_MISSION_TYPES` (6, 34–37) are only available in long-haul mode. Some scenario pools restrict their long-haul scenarios to specific `imgId` values via `LONG_HAUL_SCENARIOS_BY_MISSION`.
>
> 7. **Custom ICAO / SimBrief mapping**: Asobo airports may have MSFS-only 5-character ICAO codes (e.g. `EDOPM`, `RJBET`). The dispatch tool displays these on the job ticket but sends the aircraft's `simbriefIcao` to SimBrief for correct flight-plan generation. Never normalise or replace icao values in the airport databases.
>
> 8. **Glider dispatch**: gliders use `buildGliderRoutePairs` — they route to fields within 5–50 nm marked as glider-compatible. They ignore the normal slider block time. `fuelPerNm = 0` is correct and must be exempt from the `> 0` validation.
>
> 9. **Routing scope**: a UI toggle allows "Worldwide", "Americas", or "Rest of World" routing. When a departure ICAO is set, the departure airport is always included regardless of scope, but destinations are filtered to the selected region.
>
> 10. **Prefer Owned toggle**: when on, routes where both airports are in the user's "Owned Airports" list are weighted ~15× heavier; one owned airport is weighted ~5×. This is cosmetic — it does not add or remove airports from the eligible pool.
>
> ---
>
> ## Key safeguards (do not remove without discussion)
>
> - `routeWithinAircraftRange`: all routes must be within `spec.minD`–`spec.maxD` regardless of slider.
> - `pairPassesFixedDepartureBlockWindow`: when a fixed departure is set, routes whose SimBrief proxy-block time exceeds `slider + 8 min` are excluded from the primary band.
> - `pickShortHaulRoute` iterates three tolerances (8, 15, 20 min) before falling back to closest-match — this ensures a flight is always generated even for edge-case aircraft+airport combinations.
> - `getRestrictedRouteOperationalMtowCap`: EGLC/EGNS cap MTOW at 68,000/75,500 kg for approved jets on the route.
> - Gliders, helis, and vintage propliners each have their own routing branch (`buildGliderRoutePairs`, `buildHelicopterRoutePairs`, `VINTAGE_PROPLINER_TYPES`) — these are carefully tuned and should not be merged into the generic JET/TURBO path.
> - `filterWithRecentGuard`: prevents the same mission type from repeating on consecutive dispatches.
>
> ---
>
> ## Git & verification workflow
>
> - **Git is local only** (no remote). Snapshot before any significant change:
>   ```
>   git add .
>   git commit -m "Brief description"
>   ```
> - Run the full pre-deploy check before marking a release:
>   ```
>   python scripts/vfd-verify.py --predeploy
>   ```
> - The verify tool will flag: ICAO format errors, duplicate airport lines, fleet spec issues, loader/version mismatches, legacy variable names, and mission duplicate type IDs.

---
*Generated by the VECTOR verification assistant — update after major structural changes.*

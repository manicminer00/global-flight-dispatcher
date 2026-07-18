# VECTOR — Dispatch Scenario Audit Prompt

**Purpose:** Find *behavioural* bugs — wrong routes, impossible SimBrief plans, UI lying about tier/state, missions on wrong aircraft — not syntax errors or database field typos.

**This is not the same as `vfd-verify.py`.** Data verification asks “is the ICAO field valid?” Scenario audit asks “would a real dispatcher file this flight, and does the UI match what the engine did?”

---

## Why “it’s fixed” keeps being wrong

A pattern from recent sessions:

1. A user-reported bug is fixed at the **code line** that seemed responsible.
2. No **scenario matrix** is run before declaring success.
3. The user flies the route in SimBrief (or clicks another aircraft/tier) and finds a **different manifestation** of the same class of bug.
4. Repeat.

**Code review finds code errors. Scenario audit finds dispatch errors.**

Example the user found (not the AI): **A320 Transatlantic → EGLL–KJFK** dispatched with 87 passengers. VECTOR’s internal physics said TOW &lt; MTOW with a full tank. SimBrief filed ~3,050 nm and reported **fuel deficit / exceeds aircraft range**. The bug class is: *MTOW-feasible ≠ SimBrief-feasible on tank-limited narrowbody sectors.*

`vfd-verify.py --predeploy` would still pass. `validateJetDispatchPhysics()` passed until the envelope was tightened. **B738 EGLL→KJFK was pinned in tests; A320 EGLL→KJFK was not** — so automation missed the sibling airframe.

---

## Bugs the USER uncovered (regression catalogue)

Use these as **must-not-regress** scenarios. Each row is a *class* of failure — fix one instance without adding the class to tests and it will return on another aircraft/tier.

| # | What the user saw | Bug class | Aircraft / context |
|---|-------------------|-----------|-------------------|
| 1 | EGLC noise-abatement aircraft rejected or fallback alert | Restricted-airport allowlist incomplete vs mission matrix (`B462_QT`, `B463_QT`, `B461_MIL`, `B462_MIL`) | BAe 146 variants @ EGLC |
| 2 | “No routes could be found…” alert **after** missions were shown | Success path triggers failure UX (`ROUTE_FALLBACK_ALERT` on relaxed routing / float rounding) | A319 @ 60 min short-haul |
| 3 | Noise Abatement ~every 2nd flight instead of ~1/10 | Easter-egg / unique-mission weighting wrong | Mission type 1 |
| 4 | Long-haul UI **Ultra** but route behaved **Transatlantic** | UI tier decoupled from routing target (`longHaulTierMins` vs clamped block minutes) | Narrowbody long-haul |
| 5 | B738 Transatlantic only ~3 destinations (CYQB, CYHZ, OEDF) | Stacked filters: tier min nm + block floor + heavy-only curated whitelist | B738 @ EGLL |
| 6 | B738 could reach JFK when it should not | `maxD` / catalog range too optimistic vs tank + payload | B738 NG |
| 7 | A320 dispatched EGLL→KJFK; SimBrief range warning | Tank-full planning passes MTOW; filed route + payload exceeds tank (narrowbody) | A320 Fenix |
| 8 | Slider/header text wrong (blurbs, alignment, size) | UI state not matching product intent | Long-haul slider |
| 9 | VIP executive charter on GA | Mission pool not gated by aircraft class | GA vs BIZ JET |
| 10 | Military airlifters on wrong civilian missions | Mission matrix tags vs fleet tags mismatch | C-130, C-160, A400 |
| 11 | Wrong imgID / duplicate missions / broken renumbering | Data drift between `missions-db.js`, images, assignment JSON | Mission system |
| 12 | User feared US-only long-haul routing | Curated boosts / tier blurbs imply US bias; need non-US hub coverage | Long-haul tiers |

**When you fix any row, you MUST add a pinned probe (or matrix row) so the next session cannot claim “done” without running it.**

---

## Existing automation (use it — do not reinvent)

| Command | What it actually tests | What it does NOT test |
|---------|------------------------|------------------------|
| `python scripts/vfd-verify.py --predeploy` | Airport/fleet field shapes, duplicates, loader version, legacy var names | Dispatch outcomes |
| `node scripts/dispatch-physics-verify.mjs` | Pinned jet routes + random jet probes + `validateJetDispatchPhysics` | Every airframe; UI; mission assignment rules |
| `node scripts/dispatch-physics-verify.mjs --quick` | Shorter random sample (~80) | Edge cases with low random hit rate |
| `node scripts/dispatch-regression-probe.mjs` | Mission/imgId rules for specific aircraft | Routing physics |
| `node scripts/dispatch-fleet-smoke.mjs` | Broad fleet dispatch smoke | Deep long-haul tier matrix |
| `node scripts/master-verify.mjs` | Bundles the above | SimBrief live API |

**Pinned regressions live in:** `scripts/lib/jet-payload-invariants.mjs`  
**Physics helpers:** `scripts/lib/dispatch-physics.mjs`  
**Engine entry point for headless dispatch:** `probeDispatchFlight()` in `dispatch-engine.js` (loaded via `scripts/lib/load-vector-db.mjs`).

---

## Paste this prompt at the start of a Cursor session

```
You are auditing VECTOR Flight Dispatch for BEHAVIOURAL bugs — wrong routes, impossible SimBrief payloads, UI/state mismatches, and mission assignment errors.

Project root: D:\Project VECTOR\VECTOR DEVELOPMENT
Read first: scripts/DISPATCH-SCENARIO-AUDIT-PROMPT.md (regression catalogue + commands).

## Rules (non-negotiable)

1. Do NOT say "fixed" or "done" until you have RUN the verification commands below and pasted a results table.
2. Do NOT treat green linter output or a plausible code change as proof.
3. Think like a dispatcher + SimBrief user, not like a linter:
   - Would I file this OFP without a fuel-deficit warning?
   - Does the long-haul tier label match the distance band and routing tier used?
   - Would I expect this destination set for this aircraft class?
4. Every bug fix MUST add or update a pinned case in scripts/lib/jet-payload-invariants.mjs (or dispatch-regression-probe.mjs for mission bugs) so the bug cannot return silently.
5. If automation passes but a user-reported scenario fails, the automation is incomplete — extend it, do not dismiss the report.

## Phase 1 — Run baseline (paste full output summary)

node scripts/dispatch-physics-verify.mjs --quick
node scripts/dispatch-regression-probe.mjs
node scripts/dispatch-fleet-smoke.mjs
python scripts/vfd-verify.py --predeploy   # data only; note pass/fail separately from dispatch

## Phase 2 — Scenario matrix (headless via probeDispatchFlight)

For each cell, run pinned dep/dest OR 20 random probes (mutateHistory: false) and record failures.

### Long-haul tiers (targetMins = 480 / 720 / 960)
Aircraft columns (minimum):
- Narrowbody: A320, B738, B38M
- Widebody: A359, A388, B77W
Departures (pin each): EGLL, KJFK, RJTT, YSSY, OMDB

For each (aircraft × tier × dep), assert:
- [ ] If dispatch ok: validateJetDispatchPhysics returns [] 
- [ ] GC distance within getLongHaulTierDistanceLimits for that tier
- [ ] UI tier label would match routingTargetMins / distanceTierMins (grep code path — no silent downgrade)
- [ ] Narrowbody Transatlantic: destination NOT US East trunk if gc > 2,800 nm (KJFK, KEWR, KBOS, KPHL, KIAD) unless widebody

### Must-fail pinned routes (expect probeDispatchFlight ok:false OR physics violations if ok:true)
- A320 EGLL→KJFK Transatlantic 480  (user-found: SimBrief range)
- B738 EGLL→KJFK Transatlantic 480
- B738 TXKF→LEAL Pacific 720

### Must-pass pinned routes
- B38M EGLL→KJFK Transatlantic 480
- B738 EGLL→CYYR Transatlantic 480
- A359 EGLL→WSSS Pacific 720

### Short-haul UX
- A319 @ 60 min: dispatch ok must NOT imply ROUTE_FALLBACK_ALERT (grep for alert usage on success path)
- EGLC + approved BAe variants: depOverride EGLC must succeed at 60–90 min without false fallback

### Mission assignment (if mission-assignments.json loaded)
- PA24 → only type/imgId 4 rally
- STAR (BIZ JET) → never imgId 137/142 light pax
- Military airlifters → only approved civilian mission imgIds per fleet rules

## Phase 3 — Random long-haul destination diversity

For B738 and A320, depOverride EGLL, longHaul 480, run 50 random probes:
- Count unique destination ICAOs
- FAIL if < 8 unique destinations (user bug: only 3)
- FAIL if > 60% destinations are US East (KJFK, KEWR, KBOS, KPHL, KIAD, KDCA, KBWI, KATL, KMIA)

## Phase 4 — SimBrief-gap heuristics (narrowbody)

For every successful narrowbody jet probe with planFuel >= 0.88 * maxFuelKg:
- Recompute: fuelNm = getJetFuelPlanningDistanceNm(gc, spec)
- FAIL if fuelNm > getJetNarrowbodyMaxSafeFuelPlanningNm(spec)  (if helper exists)
- FAIL if pax > getJetMaxFeasiblePax(gc, spec, origin, dest) when scheduled-commercial min pax > feasible max

## Required output format

### Results table
| Scenario | Expected | Actual | Pass? |
|----------|----------|--------|-------|

### Failures (if any)
For each failure: user-visible symptom, root cause file/function, proposed fix, new pinned test id.

### Automation gaps
List scenarios NOT covered by current scripts that still need pinning.

Do not commit or bump version unless the user asks.
```

---

## After every user-reported bug

1. Add a row to the catalogue above (this file).
2. Add a pinned probe in `jet-payload-invariants.mjs` or `dispatch-regression-probe.mjs`.
3. Run `node scripts/dispatch-physics-verify.mjs --quick` and paste the result.
4. Only then tell the user it is fixed.

---

## Minimum command before any “long-haul routing” claim

```bash
node scripts/dispatch-physics-verify.mjs --quick
node scripts/dispatch-regression-probe.mjs
```

If the user’s exact scenario (e.g. A320 EGLL KJFK Transatlantic) is not in the pinned list, **add it first**, then run.

---

*This document is the contract between the user and the AI: scenario proof, not confidence.*

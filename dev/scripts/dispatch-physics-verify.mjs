#!/usr/bin/env node
/**
 * Dispatcher-grade jet dispatch physics verification.
 *
 * Thinks like a flight dispatcher: fuel, distance, payload, pax, cargo, MTOW, OEW,
 * tank capacity, and runway-limited TOW must all agree before SimBrief filing.
 * No weather — still-air / catalog fuel only.
 *
 * Run:
 *   node dev/scripts/dispatch-physics-verify.mjs           (~2 min, default)
 *   node dev/scripts/dispatch-physics-verify.mjs --quick   (~45 s)
 *   node dev/scripts/dispatch-physics-verify.mjs --full    (~5 min, for master-verify)
 *
 * Exit 0 = pass. Exit 1 = physics or pairing bug found.
 */
import { createVectorSandboxWithAirports } from "./lib/load-vector-db.mjs";
import {
    assertDispatchPhysics,
    runInfeasibleRouteGateChecks,
    runFeasibleRouteGateChecks,
} from "./lib/dispatch-physics.mjs";
import {
    PINNED_JET_REGRESSIONS,
    runPinnedJetRegressions,
} from "./lib/jet-payload-invariants.mjs";

const args = process.argv.slice(2);
const quick = args.includes("--quick");
const full = args.includes("--full");
const seed = parseInt(args[args.indexOf("--seed") + 1], 10) || Date.now();
const attempts = full ? 400 : quick ? 80 : 200;

function mulberry32(a) {
    return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rand = mulberry32(seed);

const root = process.cwd();
const sbx = createVectorSandboxWithAirports(root);
const { probeDispatchFlight, coreFleetSpecs } = sbx;

if (typeof sbx.validateJetDispatchPhysics !== "function") {
    console.error("FAIL  dispatch-engine.js must export validateJetDispatchPhysics on globalThis");
    process.exit(1);
}

const jetliners = Object.entries(coreFleetSpecs)
    .filter(([, spec]) => spec.class === "JET" && (spec.maxPax || 0) >= 80)
    .map(([type]) => type);

console.log("=== VECTOR dispatch physics verify ===");
console.log(`Mode: ${full ? "full" : quick ? "quick" : "default"}  seed=${seed}  random=${attempts}  jetliners=${jetliners.length}\n`);

const failures = [];
const physicsViolations = [];

function runProbe(type, overrides = {}) {
    sbx.resetDispatchProbeHistory?.();
    return probeDispatchFlight({
        aircraftType: type,
        targetMins: 50 + Math.floor(rand() * 70),
        callsign: "PHY",
        routingScope: "worldwide",
        mutateHistory: false,
        ...overrides,
    });
}

console.log("--- Route pairing gates (pinned) ---");
failures.push(...runInfeasibleRouteGateChecks(sbx, PINNED_JET_REGRESSIONS));
failures.push(...runFeasibleRouteGateChecks(sbx, PINNED_JET_REGRESSIONS));

console.log("\n--- Pinned dispatch regressions ---");
const pinnedFails = runPinnedJetRegressions(sbx, probeDispatchFlight);
for (const reg of PINNED_JET_REGRESSIONS) {
    if (reg.expectFail || !reg.destOverride) continue;
    sbx.resetDispatchProbeHistory?.();
    const result = probeDispatchFlight({
        aircraftType: reg.aircraftType,
        depOverride: reg.depOverride,
        destOverride: reg.destOverride,
        targetMins: reg.targetMins || 720,
        callsign: "PIN",
        routingScope: "worldwide",
        mutateHistory: false,
    });
    if (result.ok) {
        const err = assertDispatchPhysics(sbx, result);
        if (err) physicsViolations.push({ context: reg.label, err });
    }
}
failures.push(...pinnedFails);

console.log(`\n--- Random jet probes (${attempts}) ---`);
let randomOk = 0;
for (let i = 0; i < attempts; i++) {
    const type = jetliners[Math.floor(rand() * jetliners.length)];
    const result = runProbe(type);
    if (!result.ok) continue;
    randomOk++;
    const err = assertDispatchPhysics(sbx, result);
    if (err) {
        physicsViolations.push({
            context: `random ${type} #${i}`,
            err,
        });
    }
}

const A359_TRIES = quick ? 20 : full ? 50 : 35;
let a359Ok = 0;
for (let i = 0; i < A359_TRIES; i++) {
    const result = runProbe("A359", { targetMins: 600 });
    if (!result.ok) continue;
    a359Ok++;
    const err = assertDispatchPhysics(sbx, result);
    if (err) physicsViolations.push({ context: `A359 ultra #${i}`, err });
}

console.log(`Random OK: ${randomOk}/${attempts}`);
console.log(`A359 ultra-sector OK: ${a359Ok}/${A359_TRIES}`);
console.log(`Physics violations: ${physicsViolations.length}`);

if (physicsViolations.length) {
    console.error(`\nFAIL  ${physicsViolations.length} dispatch plan(s) violate dispatcher physics`);
    physicsViolations.slice(0, 15).forEach((v) => console.error(`  [${v.context}] ${v.err}`));
    process.exit(1);
}

if (failures.length) {
    console.error(`\nFAIL  ${failures.length} pairing / pinned regression issue(s)`);
    failures.forEach((f) => console.error(`  ${f}`));
    process.exit(1);
}

const minA359Rate = quick ? 0.85 : 0.9;
if (a359Ok / A359_TRIES < minA359Rate) {
    console.error(`\nFAIL  A359 ultra-sector success rate ${a359Ok}/${A359_TRIES} below ${(minA359Rate * 100).toFixed(0)}%`);
    process.exit(1);
}

console.log("\nPASS  dispatch physics verify — fuel, distance, payload, and MTOW are consistent");

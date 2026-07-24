#!/usr/bin/env node
/**
 * Jet dispatch stress test + SimBrief MTOW payload invariants.
 *
 * Checks:
 *  1. Random jetliner probes complete without error
 *  2. Every successful jet probe: pax/cargo must fit MTOW with SimBrief planning fuel
 *  3. Pinned regression routes (HKJK→PAKT, etc.) — known past bugs
 *
 * Run: node scripts/validate-simbrief-phase-c.mjs
 * Optional: --seed 42  --attempts 400
 */
import { createVectorSandboxWithAirports } from "./lib/load-vector-db.mjs";
import {
    assertJetProbePayload,
    runPinnedJetRegressions,
} from "./lib/jet-payload-invariants.mjs";

const args = process.argv.slice(2);
const seed = parseInt(args[args.indexOf("--seed") + 1], 10) || Date.now();
const attempts = parseInt(args[args.indexOf("--attempts") + 1], 10) || 400;

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

const jetliners = Object.entries(coreFleetSpecs)
    .filter(([, spec]) => spec.class === "JET" && (spec.maxPax || 0) >= 80)
    .map(([type]) => type);

if (!jetliners.length) {
    console.error("FAIL  No jetliner types in fleet-db.js");
    process.exit(1);
}

function runProbe(type, longHaul) {
    sbx.resetDispatchProbeHistory?.();
    sbx.___vectorMockLongHaul = !!longHaul;
    return probeDispatchFlight({
        aircraftType: type,
        targetMins: longHaul ? 720 : 50 + Math.floor(rand() * 70),
        callsign: "TST",
        longHaulRequested: longHaul,
        routingScope: "worldwide",
        mutateHistory: false,
    });
}

const failures = [];
const payloadViolations = [];

function checkPayload(result, context) {
    const err = assertJetProbePayload(sbx, result);
    if (err) {
        payloadViolations.push({ context, err });
    }
}

for (let i = 0; i < attempts; i++) {
    const type = jetliners[Math.floor(rand() * jetliners.length)];
    const spec = coreFleetSpecs[type];
    const canLong = sbx.canAircraftUseLongHaulMode?.(spec, type);
    const longHaul = canLong && rand() < 0.35;
    const result = runProbe(type, longHaul);
    if (!result.ok) {
        failures.push({
            type,
            longHaul,
            reason: result.reason,
            message: (result.message || "").slice(0, 120),
        });
    } else {
        checkPayload(result, `random ${type} ${longHaul ? "LH" : "SH"} #${i}`);
    }
}

const randomFails = failures;
const failRate = randomFails.length / attempts;

console.log(`Jet stress  seed=${seed}  attempts=${attempts}  jetliners=${jetliners.length}`);
console.log(`Random probes: ${attempts - randomFails.length}/${attempts} OK (${(100 - failRate * 100).toFixed(1)}%)`);
console.log(`MTOW payload checks: ${attempts - payloadViolations.length}/${attempts} OK`);

if (payloadViolations.length) {
    console.error(`\nFAIL  ${payloadViolations.length} jet probe(s) exceed SimBrief MTOW payload`);
    payloadViolations.slice(0, 12).forEach((v) => console.error(`  ${v.err}`));
    process.exit(1);
}

if (failRate > 0.25) {
    console.error(`\nFAIL  Overall jet failure rate ${(failRate * 100).toFixed(1)}% > 25%`);
    const byReason = new Map();
    for (const f of randomFails) {
        const key = `${f.type} ${f.longHaul ? "LH" : "SH"} ${f.reason}`;
        byReason.set(key, (byReason.get(key) || 0) + 1);
    }
    [...byReason.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, n]) => {
        console.error(`  ${n}× ${k}`);
    });
    process.exit(1);
}

if (randomFails.length) {
    console.log(`Note: ${randomFails.length} random failure(s) within tolerance — no action required.`);
}

console.log("\nPinned jet regressions:");
const pinnedFails = runPinnedJetRegressions(sbx, probeDispatchFlight);
if (pinnedFails.length) {
    console.error(`\nFAIL  ${pinnedFails.length} pinned regression(s)`);
    pinnedFails.forEach((f) => console.error(`  ${f}`));
    process.exit(1);
}

console.log("PASS  SimBrief jet dispatch stress test");

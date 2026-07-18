#!/usr/bin/env node
/**
 * Fleet dispatch smoke test — reports aircraft with zero missions and probe failures.
 */
import { createVectorSandboxWithAirports } from "./lib/load-vector-db.mjs";
import { assertJetProbePayload } from "./lib/jet-payload-invariants.mjs";

const root = process.cwd();
const sbx = createVectorSandboxWithAirports(root);

const fleetTypes = Object.keys(sbx.coreFleetSpecs).sort();
const zeroMissions = [];
const noTemplate = [];
const probeFailures = [];
const probeSuccess = [];

for (const type of fleetTypes) {
    const spec = sbx.coreFleetSpecs[type];
    const assigned = sbx.usesMissionAssignments()
        ? (sbx.missionAssignmentData.assignments[type] || [])
        : null;

    if (assigned && assigned.length === 0) {
        zeroMissions.push(type);
    }

    const missions = sbx.buildFilteredMissionList(spec, type, spec.class, null, false, false, null);
    if (missions.length === 0) {
        noTemplate.push(type);
        continue;
    }

    sbx.resetDispatchProbeHistory();
    let ok = false;
    for (let i = 0; i < 12; i++) {
        const result = sbx.probeDispatchFlight({
            aircraftType: type,
            targetMins: 90,
            callsign: "SMK",
            isContractorMode: false,
            militaryBasesToggle: false,
            preferOwned: false,
            longHaulRequested: false,
            routingScope: "worldwide",
            mutateHistory: false
        });
        if (result.ok) {
            ok = true;
            if (sbx.usesMissionAssignments()) {
                const allowed = sbx.isScenarioAllowedForAircraft(type, result.scenarioImgId);
                if (allowed === false) {
                    probeFailures.push(type + " picked imgId " + result.scenarioImgId + " (not in assignments)");
                    ok = false;
                }
            }
            const payloadErr = assertJetProbePayload(sbx, result);
            if (payloadErr) {
                probeFailures.push(type + ": " + payloadErr);
                ok = false;
            }
            if (ok) {
                probeSuccess.push(type);
                break;
            }
        }
    }
    if (!ok && !noTemplate.includes(type)) {
        probeFailures.push(type + ": no successful probe in 12 attempts");
    }
}

console.log("=== VECTOR dispatch fleet smoke test ===");
console.log("Fleet size:", fleetTypes.length);
console.log("Assignments:", sbx.usesMissionAssignments() ? "embedded data loaded" : "MISSING");
console.log("Probe success:", probeSuccess.length);
console.log("No mission templates:", noTemplate.length);
if (noTemplate.length) console.log("  ", noTemplate.join(", "));
console.log("Zero assigned missions:", zeroMissions.length);
if (zeroMissions.length) console.log("  ", zeroMissions.join(", "));
console.log("Probe failures:", probeFailures.length);
if (probeFailures.length) {
    probeFailures.forEach((f) => console.log("  ✗", f));
    process.exit(1);
}
console.log("\nSmoke test: PASS");

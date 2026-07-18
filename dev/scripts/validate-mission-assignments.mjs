#!/usr/bin/env node
/**
 * Validate mission-assignments.json integrity and run dispatch smoke checks.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createVectorSandboxWithAirports, buildScenarioIndex } from "./lib/load-vector-db.mjs";
import { computeLegacyEligibleImgIds } from "./lib/legacy-eligibility.mjs";

const root = process.cwd();
const jsonPath = join(root, "mission-assignments.json");

if (!existsSync(jsonPath)) {
    console.error("FAIL: mission-assignments.json not found. Run scripts/export-mission-assignments.mjs first.");
    process.exit(1);
}

const data = JSON.parse(readFileSync(jsonPath, "utf8"));
const sbx = createVectorSandboxWithAirports(root);
const { imgIdToPool } = buildScenarioIndex(sbx.scenarioDB, sbx.missionMatrix);

const scenarioStats = buildScenarioCatalogStats(sbx.scenarioDB);
const uniqueScenarioImgIds = scenarioStats.uniqueImgIds;
const fleetTypes = Object.keys(sbx.coreFleetSpecs);
const errors = [];
const warnings = [];

function buildScenarioCatalogStats(scenarioDB) {
    const rowsByImgId = {};
    let totalRows = 0;
    for (const [pool, scenarios] of Object.entries(scenarioDB)) {
        if (!Array.isArray(scenarios)) continue;
        for (const s of scenarios) {
            if (s.imgId == null) continue;
            totalRows++;
            if (!rowsByImgId[s.imgId]) rowsByImgId[s.imgId] = [];
            rowsByImgId[s.imgId].push(pool);
        }
    }
    const uniqueImgIds = Object.keys(rowsByImgId).map((id) => parseInt(id, 10)).sort((a, b) => a - b);
    const duplicateRows = uniqueImgIds
        .filter((id) => rowsByImgId[id].length > 1)
        .map((id) => ({
            imgId: id,
            rowCount: rowsByImgId[id].length,
            pools: [...new Set(rowsByImgId[id])]
        }));
    return { totalRows, uniqueImgIds, rowsByImgId, duplicateRows };
}

if (data.schema !== "mission-assignments-v1") {
    errors.push("Unknown schema: " + data.schema);
}

if (!data.assignments || typeof data.assignments !== "object") {
    errors.push("Missing assignments object");
    process.exit(1);
}

const referencedImgIds = new Set();
const assignmentTypes = Object.keys(data.assignments);

for (const type of assignmentTypes) {
    if (!sbx.coreFleetSpecs[type]) {
        errors.push("Orphan aircraft type in assignments: " + type);
    }
    const ids = data.assignments[type];
    if (!Array.isArray(ids)) {
        errors.push("Assignments for " + type + " must be an array");
        continue;
    }
    const seen = new Set();
    for (const id of ids) {
        if (!imgIdToPool[id]) {
            errors.push("Unknown imgId " + id + " on aircraft " + type);
        }
        if (seen.has(id)) {
            errors.push("Duplicate imgId " + id + " on aircraft " + type);
        }
        seen.add(id);
        referencedImgIds.add(id);
    }
    if (ids.length === 0) {
        warnings.push("Aircraft " + type + " has zero assigned missions");
    }
}

for (const type of fleetTypes) {
    if (!data.assignments[type]) {
        warnings.push("Fleet aircraft missing from assignments: " + type);
    }
}

for (const id of uniqueScenarioImgIds) {
    if (!referencedImgIds.has(id)) {
        warnings.push("imgId " + id + " (" + imgIdToPool[id] + ") not assigned to any aircraft");
    }
}

for (const dup of scenarioStats.duplicateRows) {
    warnings.push(
        "imgId " + dup.imgId + " appears " + dup.rowCount + " times in scenarioDB"
        + " (pools: " + dup.pools.join(", ") + ") — counts once in unique imgId total"
    );
}

sbx.setMissionAssignmentData(data);

const smokeFailures = [];
let smokeOk = 0;

for (const type of fleetTypes) {
    const spec = sbx.coreFleetSpecs[type];
    const assigned = data.assignments[type] || [];
    const missions = sbx.buildFilteredMissionList(spec, type, spec.class, null, false, false, null);
    if (assigned.length > 0 && missions.length === 0) {
        smokeFailures.push(type + ": has assignments but buildFilteredMissionList returned 0 templates");
        continue;
    }
    if (assigned.length === 0) continue;

    let probeOk = false;
    for (let i = 0; i < 8; i++) {
        sbx.resetDispatchProbeHistory();
        const result = sbx.probeDispatchFlight({
            aircraftType: type,
            targetMins: 60,
            callsign: "TST",
            isContractorMode: false,
            militaryBasesToggle: false,
            preferOwned: false,
            longHaulRequested: false,
            routingScope: "worldwide",
            mutateHistory: false
        });
        if (result.ok) {
            const allowed = sbx.isScenarioAllowedForAircraft(type, result.scenarioImgId);
            if (allowed === false) {
                smokeFailures.push(type + ": probe picked unassigned imgId " + result.scenarioImgId);
            } else {
                probeOk = true;
                break;
            }
        }
    }
    if (!probeOk && assigned.length > 0) {
        warnings.push("Could not probe dispatch for " + type + " in 8 attempts (may need airports loaded)");
    } else if (probeOk) {
        smokeOk++;
    }
}

console.log("=== mission-assignments.json validation ===");
console.log("Aircraft in file:", assignmentTypes.length);
console.log("Fleet size:", fleetTypes.length);
console.log("Scenario rows in missions-db:", scenarioStats.totalRows);
console.log("Unique imgIds in scenarioDB:", uniqueScenarioImgIds.length);
console.log(
    "Referenced in assignments:",
    referencedImgIds.size,
    "/",
    uniqueScenarioImgIds.length,
    referencedImgIds.size === uniqueScenarioImgIds.length ? "(all covered)" : "(gaps remain)"
);
if (scenarioStats.totalRows !== uniqueScenarioImgIds.length) {
    console.log(
        "Note:",
        scenarioStats.totalRows - uniqueScenarioImgIds.length,
        "duplicate scenario row(s) — see warnings below"
    );
}

if (errors.length) {
    console.log("\nERRORS (" + errors.length + "):");
    errors.forEach((e) => console.log("  ✗", e));
} else {
    console.log("\nStructural checks: PASS");
}

if (warnings.length) {
    console.log("\nWarnings (" + warnings.length + "):");
    warnings.slice(0, 20).forEach((w) => console.log("  !", w));
    if (warnings.length > 20) console.log("  ... and", warnings.length - 20, "more");
}

if (smokeFailures.length) {
    console.log("\nDispatch smoke FAILURES:");
    smokeFailures.forEach((f) => console.log("  ✗", f));
}

const zeroMission = fleetTypes.filter((t) => !(data.assignments[t] || []).length);
console.log("\nAircraft with zero missions:", zeroMission.length);
if (zeroMission.length) {
    console.log("  ", zeroMission.join(", "));
}

console.log("\nDispatch probe successes:", smokeOk, "/", fleetTypes.filter((t) => (data.assignments[t] || []).length).length);

if (errors.length || smokeFailures.length) {
    process.exit(1);
}

console.log("\nOverall: PASS");

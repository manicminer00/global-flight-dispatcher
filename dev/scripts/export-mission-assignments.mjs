#!/usr/bin/env node
/**
 * Export baseline mission-assignments.json from current tag/class eligibility rules.
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { createVectorSandbox, buildScenarioIndex } from "./lib/load-vector-db.mjs";
import { computeAllLegacyAssignments } from "./lib/legacy-eligibility.mjs";

const root = process.cwd();
const sbx = createVectorSandbox(root);
const assignments = computeAllLegacyAssignments(sbx);
const { allImgIds } = buildScenarioIndex(sbx.scenarioDB, sbx.missionMatrix);

const zeroMission = Object.entries(assignments).filter(([, ids]) => ids.length === 0);

const output = {
    schema: "mission-assignments-v1",
    version: 1,
    generatedAt: new Date().toISOString(),
    source: "export-mission-assignments.mjs (legacy tag/class rules)",
    meta: {
        aircraftCount: Object.keys(assignments).length,
        scenarioCount: allImgIds.length,
        poolCount: Object.keys(sbx.scenarioDB).length,
        zeroMissionAircraft: zeroMission.map(([t]) => t)
    },
    assignments
};

const outPath = join(root, "mission-assignments.json");
writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n", "utf8");

const jsPath = join(root, "mission-assignments-data.js");
const jsBody = "// Auto-generated — keep in sync with mission-assignments.json\n"
    + "var MISSION_ASSIGNMENTS_EMBED = " + JSON.stringify(output) + ";\n"
    + "if (typeof setMissionAssignmentData === \"function\") { setMissionAssignmentData(MISSION_ASSIGNMENTS_EMBED); }\n";
writeFileSync(jsPath, jsBody, "utf8");

console.log("Wrote", outPath);
console.log("Wrote", jsPath);
console.log("Aircraft:", output.meta.aircraftCount);
console.log("Scenarios:", output.meta.scenarioCount);
console.log("Aircraft with zero missions:", zeroMission.length);
if (zeroMission.length) {
    console.log("  ", zeroMission.map(([t]) => t).join(", "));
}

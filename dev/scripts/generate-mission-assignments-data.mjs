#!/usr/bin/env node
/**
 * Build mission-assignments-data.js from mission-assignments.json (for file:// dispatch).
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const root = process.cwd();
const jsonPath = join(root, "mission-assignments.json");

if (!existsSync(jsonPath)) {
    console.error("FAIL: mission-assignments.json not found.");
    process.exit(1);
}

const data = JSON.parse(readFileSync(jsonPath, "utf8"));
const jsPath = join(root, "mission-assignments-data.js");
const jsBody = "// Auto-generated from mission-assignments.json — do not edit by hand\n"
    + "var MISSION_ASSIGNMENTS_EMBED = " + JSON.stringify(data) + ";\n"
    + "if (typeof setMissionAssignmentData === \"function\") { setMissionAssignmentData(MISSION_ASSIGNMENTS_EMBED); }\n";
writeFileSync(jsPath, jsBody, "utf8");
console.log("Wrote", jsPath);

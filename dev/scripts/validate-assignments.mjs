/**
 * Predeploy check: every core fleet type must have non-empty mission assignments.
 * Usage: node scripts/validate-assignments.mjs
 */
import fs from "fs";
import vm from "vm";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function load(file) {
    vm.runInThisContext(fs.readFileSync(path.join(root, file), "utf8"), { filename: file });
}

load("fleet-db.js");
load("mission-assignment-core.js");
load("mission-assignments-data.js");

const errors = validateMissionAssignmentCoverage(coreFleetSpecs);
if (errors.length) {
    console.error("Mission assignment validation FAILED:");
    errors.forEach((e) => console.error("  - " + e));
    process.exit(1);
}

const count = Object.keys(getMissionAssignmentData().assignments).length;
console.log("Mission assignment validation OK (" + Object.keys(coreFleetSpecs).length + " fleet types, " + count + " assignment entries).");

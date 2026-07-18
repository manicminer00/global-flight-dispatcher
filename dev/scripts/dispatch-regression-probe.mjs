#!/usr/bin/env node
/**
 * Targeted dispatch regression probes for known past bugs.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createVectorSandboxWithAirports, buildScenarioIndex } from "./lib/load-vector-db.mjs";
import { runPinnedJetRegressions } from "./lib/jet-payload-invariants.mjs";

const root = process.cwd();
const jsonPath = join(root, "mission-assignments.json");
const PROBES_PER_AIRCRAFT = 80;

const REGRESSION_AIRCRAFT = {
    PA24: {
        forbiddenImgIds: [],
        typedRules: [{ missionType: 4, imgIds: [4] }],
        notes: "Classic Cross-Country Rally: type 4 only with imgId 4"
    },
    U16: {
        forbiddenImgIds: [4],
        typedMissionTypes: [8, 9, 10, 11, 12, 13],
        notes: "U16 unique missions 8-13 with matching imgIds; never imgId 4 on type 10"
    },
    ALO3: {
        allowedImgIdRanges: [[124, 133], [167, 183], [191, 196]],
        notes: "surveyServices + helicopterOps only"
    },
    B105: {
        allowedImgIdRanges: [[124, 133], [167, 183], [191, 196]],
        notes: "surveyServices + helicopterOps only"
    },
    H500: {
        allowedImgIdRanges: [[124, 133], [167, 183], [191, 196]],
        notes: "surveyServices + helicopterOps only"
    },
    LAMA: {
        allowedImgIdRanges: [[124, 133], [167, 183], [191, 196]],
        notes: "surveyServices + helicopterOps only"
    },
    STAR: {
        forbiddenImgIds: [137, 142],
        notes: "BIZ JET: no lightPax 137/142 unless assigned"
    },
    H145: {
        forbiddenImgIds: [56],
        notes: "HELI: no executive 56 unless assigned"
    },
    DC6A: {
        forbiddenImgIds: [153, 157],
        notes: "no vintageOps 153/157 unless assigned"
    },
    DC6B: {
        forbiddenImgIds: [153, 157],
        notes: "no vintageOps 153/157 unless assigned"
    }
};

function imgIdInRanges(id, ranges) {
    return ranges.some(([lo, hi]) => id >= lo && id <= hi);
}

const sbx = createVectorSandboxWithAirports(root);
if (!existsSync(jsonPath)) {
    console.error("FAIL: mission-assignments.json not found");
    process.exit(1);
}
const data = JSON.parse(readFileSync(jsonPath, "utf8"));
sbx.setMissionAssignmentData(data);

if (!sbx.usesMissionAssignments()) {
    console.error("FAIL: usesMissionAssignments() is false after loading assignments");
    process.exit(1);
}

const { imgIdToPool, imgIdToMissionType } = buildScenarioIndex(sbx.scenarioDB, sbx.missionMatrix);
const failures = [];
const warnings = [];
const typeCounts = { 4: 0, 5: 0, total: 0 };

function scenarioMissionType(scenarioImgId, chosenMissionType) {
    return imgIdToMissionType[scenarioImgId] ?? chosenMissionType;
}

function getScenarioFromPool(imgId) {
    const pool = imgIdToPool[imgId];
    if (!pool || !sbx.scenarioDB[pool]) return null;
    return sbx.scenarioDB[pool].find((s) => s.imgId === imgId) || null;
}

for (const [aircraftType, rules] of Object.entries(REGRESSION_AIRCRAFT)) {
    if (!sbx.coreFleetSpecs[aircraftType]) {
        failures.push(`${aircraftType}: not in fleet`);
        continue;
    }
    const assigned = new Set(data.assignments[aircraftType] || []);
    if (assigned.size === 0) {
        failures.push(`${aircraftType}: zero assignments in JSON`);
        continue;
    }

    let successes = 0;
    for (let i = 0; i < PROBES_PER_AIRCRAFT; i++) {
        sbx.resetDispatchProbeHistory();
        const result = sbx.probeDispatchFlight({
            aircraftType,
            targetMins: 75,
            callsign: "REG",
            isContractorMode: false,
            militaryBasesToggle: false,
            preferOwned: false,
            longHaulRequested: false,
            routingScope: "worldwide",
            mutateHistory: false
        });
        if (!result.ok) continue;
        successes++;

        const imgId = result.scenarioImgId ?? result.imageId;
        const missionType = result.chosenMission.type;
        const missionName = result.chosenMission.name;

        if (!assigned.has(imgId)) {
            failures.push(
                `${aircraftType} probe ${i}: imgId ${imgId} not in assignments (mission type ${missionType} ${missionName})`
            );
        }

        if (rules.forbiddenImgIds && rules.forbiddenImgIds.includes(imgId)) {
            failures.push(
                `${aircraftType} probe ${i}: forbidden imgId ${imgId} (mission type ${missionType} ${missionName})`
            );
        }

        if (rules.allowedImgIdRanges && !imgIdInRanges(imgId, rules.allowedImgIdRanges)) {
            failures.push(
                `${aircraftType} probe ${i}: imgId ${imgId} outside allowed ranges (mission type ${missionType})`
            );
        }

        const pool = imgIdToPool[imgId];
        const scenario = getScenarioFromPool(imgId);
        if (scenario && scenario.missionType != null && scenario.missionType !== missionType) {
            failures.push(
                `${aircraftType} probe ${i}: scenario.missionType ${scenario.missionType} !== chosenMission.type ${missionType} (imgId ${imgId})`
            );
        }

        if (rules.typedMissionTypes && rules.typedMissionTypes.includes(missionType) && imgId !== missionType) {
            failures.push(
                `${aircraftType} probe ${i}: typed unique mission ${missionType} picked imgId ${imgId} (expected ${missionType})`
            );
        }

        if (rules.typedRules) {
            for (const rule of rules.typedRules) {
                if (missionType === rule.missionType && !rule.imgIds.includes(imgId)) {
                    failures.push(
                        `${aircraftType} probe ${i}: mission type ${missionType} with wrong imgId ${imgId} (expected ${rule.imgIds.join("/")})`
                    );
                }
            }
        }

        if (missionType <= 13 && imgId !== missionType) {
            failures.push(
                `${aircraftType} probe ${i}: unique mission type ${missionType} with imgId ${imgId} (expected ${missionType})`
            );
        }

        if (scenario && scenario.payload && result.rPayload !== scenario.payload) {
            failures.push(
                `${aircraftType} probe ${i}: rPayload mismatch for imgId ${imgId} (ticket vs scenario)`
            );
        }

        if (aircraftType === "PA24" || aircraftType === "STAR") {
            typeCounts.total++;
            if (missionType === 4) typeCounts[4]++;
            if (missionType === 5) typeCounts[5]++;
        }
    }

    if (successes === 0) {
        warnings.push(`${aircraftType}: no successful probes in ${PROBES_PER_AIRCRAFT} attempts`);
    }
}

console.log("=== dispatch regression probe ===");
console.log("usesMissionAssignments:", sbx.usesMissionAssignments());
console.log("Probes per aircraft:", PROBES_PER_AIRCRAFT);

if (warnings.length) {
    console.log("\nWarnings:");
    warnings.forEach((w) => console.log("  !", w));
}

if (failures.length) {
    console.log("\nFAILURES (" + failures.length + "):");
    failures.slice(0, 40).forEach((f) => console.log("  ✗", f));
    if (failures.length > 40) console.log("  ... and", failures.length - 40, "more");
    process.exit(1);
}

const pa24Type4Rate = typeCounts.total ? ((typeCounts[4] / typeCounts.total) * 100).toFixed(1) : "n/a";
const pa24Type5Rate = typeCounts.total ? ((typeCounts[5] / typeCounts.total) * 100).toFixed(1) : "n/a";
console.log("\nType 4/5 frequency (PA24+STAR probes):", `type4=${pa24Type4Rate}%`, `type5=${pa24Type5Rate}%`, `(n=${typeCounts.total})`);

console.log("\n--- Jet SimBrief MTOW payload regressions ---");
const jetPayloadFails = runPinnedJetRegressions(sbx, sbx.probeDispatchFlight);
if (jetPayloadFails.length) {
    console.log("\nFAILURES (" + jetPayloadFails.length + " jet payload):");
    jetPayloadFails.forEach((f) => console.log("  ✗", f));
    process.exit(1);
}

console.log("\nRegression probe: PASS");
process.exit(0);

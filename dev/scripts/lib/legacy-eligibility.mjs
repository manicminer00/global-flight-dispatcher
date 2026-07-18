/**
 * Computes per-aircraft imgId eligibility using the current tag/class rules
 * in dispatch-engine.js (pre-assignments baseline).
 */
export function computeLegacyEligibleImgIds(sbx, type) {
    const spec = sbx.coreFleetSpecs[type];
    if (!spec) return [];

    const searchClass = spec.class;
    const originForLocks = { icao: "", isMilitary: false };
    const imgIds = new Set();

    for (const mission of sbx.missionMatrix) {
        if (!mission.pool || !sbx.scenarioDB[mission.pool]) continue;

        const scenarios = sbx.scenarioDB[mission.pool];
        const excludedImgIds = sbx.getExcludedScenarioImgIdsForPool(scenarios, type, spec);

        for (const longHaul of [false, true]) {
            if (!sbx.missionAllowedForHaulMode(mission, longHaul)) continue;
            if (!sbx.passesHardMissionLocks(mission, type, searchClass, spec, originForLocks, false)) continue;
            if (!sbx.passesAircraftCivilMissionAllowlist(mission, type, spec)) continue;
            if (mission.excludedTags && spec.tags && mission.excludedTags.some((t) => spec.tags.includes(t))) continue;
            if (mission.requiredTags && (!spec.tags || !mission.requiredTags.every((t) => spec.tags.includes(t)))) continue;
            if (mission.civilianOnly && spec.isMilitary) continue;
            if (mission.militaryOnly && !spec.isMilitary) continue;
            if (!mission.militaryOnly && sbx.isMilitaryMissionRestricted(spec)) continue;
            if (sbx.isMilitaryHelicopterMission(mission) && spec.class !== "HELI") continue;
            if (mission.tacticalOnly && !sbx.isTacticalAirframeForMission(spec, type, mission.type)) continue;

            let activePool = sbx.filterScenarioPool(scenarios, type, spec, excludedImgIds);
            activePool = sbx.filterScenariosForLimitedCivilAircraft(activePool, type, spec, mission);
            activePool = sbx.filterScenariosForHaulMode(activePool, mission.type, longHaul, spec);

            const typedPool = activePool.filter((s) => !s.missionType || s.missionType === mission.type);
            if (typedPool.length > 0) activePool = typedPool;

            if (mission.type === 31) {
                const staffOnly = activePool.filter((s) => s.staffShuttle && !s.heliOps);
                if (staffOnly.length > 0) activePool = staffOnly;
            } else if (mission.type === 30) {
                const heliOnly = activePool.filter((s) => s.heliOps);
                if (heliOnly.length > 0) activePool = heliOnly;
            }

            if (spec.class !== "HELI") {
                activePool = activePool.filter((s) => !s.heliOps);
            }

            for (const s of activePool) {
                if (sbx.scenarioPassesHardLocks(s, type, spec, excludedImgIds)) {
                    imgIds.add(s.imgId);
                }
            }
        }
    }

    return [...imgIds].sort((a, b) => a - b);
}

export function computeAllLegacyAssignments(sbx) {
    const assignments = {};
    for (const type of Object.keys(sbx.coreFleetSpecs)) {
        assignments[type] = computeLegacyEligibleImgIds(sbx, type);
    }
    return assignments;
}

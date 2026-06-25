let lastMissions = [];
let lastScenarioImgIds = [];
let activeAirportDatabase = [];
let activeFleetSpecs = {};

function readSeedAirportArray(globalName) {
    try {
        if (typeof globalThis !== "undefined" && Array.isArray(globalThis[globalName])) {
            return globalThis[globalName];
        }
    } catch (e) { /* globalThis lookup */ }
    if (globalName === "seedAsoboAirportDatabase"
        && typeof seedAsoboAirportDatabase !== "undefined"
        && Array.isArray(seedAsoboAirportDatabase)) {
        return seedAsoboAirportDatabase;
    }
    if (globalName === "seedThirdPartyAirportDatabase"
        && typeof seedThirdPartyAirportDatabase !== "undefined"
        && Array.isArray(seedThirdPartyAirportDatabase)) {
        return seedThirdPartyAirportDatabase;
    }
    return [];
}
function getAsoboAirportDatabase() {
    return readSeedAirportArray("seedAsoboAirportDatabase");
}
function getThirdPartyAirportDatabase() {
    return readSeedAirportArray("seedThirdPartyAirportDatabase");
}
function getMergedSeedAirports() {
    return getAsoboAirportDatabase().concat(getThirdPartyAirportDatabase());
}

let cachedGliderDatabaseIcaos = null;
function getGliderDatabaseIcaos() {
    if (cachedGliderDatabaseIcaos) return cachedGliderDatabaseIcaos;
    const gliderDB = getAsoboAirportDatabase().filter(
        a => a.tag === "Asobo Gliderport" || a.rwy === "GLIDER"
    );
    cachedGliderDatabaseIcaos = new Set(
        gliderDB.map(a => (a.icao || "").trim().toUpperCase()).filter(Boolean)
    );
    return cachedGliderDatabaseIcaos;
}
function isGliderDispatchAirport(ap) {
    if (!ap || !ap.icao) return false;
    return getGliderDatabaseIcaos().has(ap.icao.trim().toUpperCase());
}
function meetsGliderRunwayLength(ap, spec) {
    if (!spec.minRunwayLength || spec.minRunwayLength <= 0) return true;
    return ap.length ? ap.length >= spec.minRunwayLength : true;
}
function getGliderUnsuitabilityReason(ap, spec) {
    if (!ap || !ap.icao) return "invalid";
    if (ap.rwy === "HELI") return "heli";
    if (!meetsGliderRunwayLength(ap, spec)) return "runway_length";
    return null;
}
function isGliderSuitableAirport(ap, spec) {
    return getGliderUnsuitabilityReason(ap, spec) === null;
}
function formatGliderUnsuitabilityMessage(icao, reason) {
    const code = (icao || "").trim().toUpperCase();
    if (reason === "heli") {
        return `${code} is not suitable for glider operations (helipad only).`;
    }
    if (reason === "runway_length") {
        return `The runway at ${code} does not meet glider requirements for this aircraft.`;
    }
    return `${code} is not suitable for glider operations.`;
}
function gliderRoutePreferenceScore(pair) {
    let score = 0;
    if (isGliderDispatchAirport(pair.src)) score += 2;
    if (isGliderDispatchAirport(pair.dst)) score += 2;
    if (pair.src.rwy === "GLIDER") score += 4;
    if (pair.dst.rwy === "GLIDER") score += 4;
    return score;
}

const GLIDER_MIN_ROUTE_NM = 5;
const GLIDER_MAX_ROUTE_NM = 50;
const GLIDER_LOCAL_ROUTE_NM = 35;

function buildGliderRoutePairs(validAirports, depOverride, spec) {
    const sources = depOverride
        ? validAirports.filter(ap => ap.icao === depOverride)
        : validAirports;
    const crossCountryPairs = [];
    for (const src of sources) {
        for (const dst of validAirports) {
            if (src.icao === dst.icao) continue;
            if (!isGliderSuitableAirport(dst, spec)) continue;
            const dist = calculateDistance(src.lat, src.lon, dst.lat, dst.lon);
            if (!dist || isNaN(dist)) continue;
            if (dist >= GLIDER_MIN_ROUTE_NM && dist <= GLIDER_MAX_ROUTE_NM) {
                crossCountryPairs.push({ src, dst, dist });
            }
        }
    }
    if (crossCountryPairs.length > 0) return crossCountryPairs;
    const localPairs = [];
    for (const src of sources) {
        localPairs.push({ src, dst: src, dist: GLIDER_LOCAL_ROUTE_NM });
    }
    return localPairs;
}

function getAllowedClassesForRunway(rwy) {
    switch (rwy) {
        case "GA": return ["GA", "WARBIRD", "TURBO", "HELI"];
        case "TURBO": return ["GA", "WARBIRD", "TURBO", "HELI"];
        case "BIZ JET": return ["GA", "WARBIRD", "TURBO", "BIZ JET", "HELI"];
        case "JET": return ["GA", "WARBIRD", "TURBO", "BIZ JET", "JET", "HELI"];
        case "HELI": return ["HELI"];
        case "GLIDER": return ["GLIDER"];
        default: return [];
    }
}

function getAirportRoutingRegion(ap) {
    if (!ap || ap.lat == null || ap.lon == null || isNaN(ap.lat) || isNaN(ap.lon)) return "row";
    if (-170 <= ap.lon && ap.lon <= -30 && -60 <= ap.lat && ap.lat <= 85) return "americas";
    return "row";
}
function getRoutingScope() {
    const el = document.getElementById("routingScopeSelect");
    const value = el ? el.value : "worldwide";
    return value === "americas" || value === "row" ? value : "worldwide";
}
function getRoutingOverrideIcaos(depOverride) {
    const set = new Set();
    const code = (depOverride || "").trim().toUpperCase();
    if (code) set.add(code);
    return set;
}
function airportAllowedForRouting(ap, scope, overrideIcaos) {
    if (scope === "worldwide") return true;
    const icao = (ap.icao || "").trim().toUpperCase();
    if (overrideIcaos.has(icao)) return true;
    const region = getAirportRoutingRegion(ap);
    return scope === "americas" ? region === "americas" : region === "row";
}
function saveRoutingScope() {
    try {
        localStorage.setItem("dispatcher_routing_scope", getRoutingScope());
    } catch (e) { /* private browsing / storage full */ }
}
function loadRoutingScope() {
    const valid = { worldwide: true, americas: true, row: true };
    let saved;
    try {
        saved = localStorage.getItem("dispatcher_routing_scope");
    } catch (e) {
        saved = null;
    }
    const scope = valid[saved] ? saved : "worldwide";
    const select = document.getElementById("routingScopeSelect");
    if (select) select.value = scope;
}
const LONG_HAUL_BLOCK_TIME_PAD_MINS = 30;
const LONG_HAUL_MIN_BLOCK_MINS = 360;
const LONG_HAUL_MAX_BLOCK_MINS = 960;
// Short-haul slider = target block time; routing uses cruise (slider minus pad) so SimBrief block stays near the slider.
const SHORT_HAUL_BLOCK_TIME_PAD_MINS = LONG_HAUL_BLOCK_TIME_PAD_MINS;
const SHORT_HAUL_ROUTE_PLANNING_TRIM_MINS = 10;
const SCHEDULED_COMMERCIAL_LOAD_MIN = 0.70;
const SCHEDULED_COMMERCIAL_LOAD_MAX = 0.80;
const FAST_BIZ_JET_TYPES = new Set(["C750", "C680", "C700"]);
const VINTAGE_PROPLINER_TYPES = new Set(["DC6A", "DC6B"]);
const BLOCK_SPEED_KTS = {
    JET: 440,
    HEAVY_JET: 485,
    BIZ_JET: 420,
    BIZ_JET_FAST: 470,
    TURBO: 270,
    HEAVY_TURBO: 330,
    MIL_TURBO: 300,
    VINTAGE_PROPLINER: 275,
    WARBIRD: 200,
    HELI: 80,
    GLIDER: 70,
    GA_HIGH: 160,
    GA: 90
};
function isScheduledCommercialMission(mission) {
    const tags = mission.requiredTags || [];
    return tags.includes("PAX") && (tags.includes("JETLINER") || tags.includes("REGIONAL"));
}
function getVipPassengerTarget(spec, blockMinutes, chosenMission) {
    const seats = spec.maxPax;
    if (!seats) return 0;
    const isBizJet = spec.class === "BIZ JET";
    const isLightExecutive = isBizJet
        || (spec.class === "TURBO" && seats <= 12)
        || (spec.class === "GA" && seats <= 8 && spec.tags && spec.tags.includes("VIP"));
    if (isLightExecutive) {
        let loadFactor;
        if (blockMinutes < 75) loadFactor = 0.22;
        else if (blockMinutes < 150) loadFactor = 0.40;
        else if (blockMinutes < 240) loadFactor = 0.55;
        else if (blockMinutes < 360) loadFactor = 0.65;
        else loadFactor = 0.45;
        if (chosenMission && isLongHaulMissionType(chosenMission.type)) {
            loadFactor = Math.max(loadFactor, 0.40);
        }
        return Math.max(1, Math.min(seats, Math.floor(seats * loadFactor)));
    }
    if (spec.class === "HELI") {
        return Math.max(1, Math.min(seats, Math.floor(seats * 0.35)));
    }
    return Math.max(1, Math.floor(seats * 0.15));
}
function getPassengerLoadLimits(chosenMission, spec, maxSafePax, blockMinutes) {
    if (!missionRequiresPassengers(chosenMission, spec) || maxSafePax <= 0) {
        return { minPax: 0, effectiveMax: 0 };
    }
    const requiredTags = chosenMission.requiredTags || [];
    const isScheduledCommercial = isScheduledCommercialMission(chosenMission);
    const isVipMission = requiredTags.includes("VIP");

    let minPax = 1;
    let maxPaxTarget = spec.maxPax;

    if (isScheduledCommercial) {
        minPax = Math.floor(spec.maxPax * SCHEDULED_COMMERCIAL_LOAD_MIN);
        maxPaxTarget = Math.floor(spec.maxPax * SCHEDULED_COMMERCIAL_LOAD_MAX);
    } else if (isVipMission) {
        maxPaxTarget = getVipPassengerTarget(spec, blockMinutes, chosenMission);
        if (spec.class === "BIZ JET" && maxPaxTarget >= 3) {
            minPax = 2;
        }
    } else if (spec.class === "JET" && requiredTags.includes("PAX")) {
        minPax = Math.floor(spec.maxPax * 0.5);
    } else if (requiredTags.includes("PAX")) {
        minPax = 1;
    } else if (spec.class === "JET") {
        minPax = Math.floor(spec.maxPax * 0.5);
    }

    const effectiveMax = Math.min(maxPaxTarget, maxSafePax, spec.maxPax);
    if (effectiveMax < minPax) minPax = effectiveMax;
    return { minPax, effectiveMax };
}
function isFreightMission(mission) {
    if (!mission) return false;
    const requiredTags = mission.requiredTags || [];
    if (requiredTags.includes("FREIGHTER")) return true;
    if (requiredTags.includes("PAX")) return false;
    if (mission.minCargo) return true;
    const name = (mission.name || "").toLowerCase();
    return /\bfreight\b/.test(name) || /\bcargo\b/.test(name);
}
function isPassengerMission(mission) {
    if (!mission || isFreightMission(mission)) return false;
    const requiredTags = mission.requiredTags || [];
    if (requiredTags.includes("PAX")) return true;
    if (requiredTags.includes("FREIGHTER")) return false;
    const name = (mission.name || "").toLowerCase();
    if (/\bairliner\b/.test(name) || /\bpassenger\b/.test(name) || /\bcommuter\b/.test(name)) return true;
    if (mission.allowedAircraft && mission.allowedAircraft.length > 0) {
        return mission.allowedAircraft.every(code => {
            const acSpec = (typeof activeFleetSpecs !== "undefined" && activeFleetSpecs[code])
                || (typeof coreFleetSpecs !== "undefined" && coreFleetSpecs[code]);
            return acSpec && acSpec.tags && acSpec.tags.includes("PAX") && (acSpec.maxPax || 0) > 0;
        });
    }
    return false;
}
function isMilitaryTroopPassengerMission(mission) {
    if (!mission || !mission.militaryOnly) return false;
    const missionType = mission.type;
    return missionType === 23 || missionType === 29 || missionType === 30;
}
function missionRequiresPassengers(chosenMission, spec) {
    if (isFreightMission(chosenMission)) return false;
    if ((spec.maxPax || 0) <= 0) return false;
    if (isPassengerMission(chosenMission)) return true;
    const requiredTags = chosenMission.requiredTags || [];
    if (requiredTags.includes("PAX")) return true;
    const tags = spec.tags || [];
    if (!tags.includes("PAX")) return false;
    if (!tags.includes("FREIGHTER")) return true;
    // Dual-role military airlifters (C-130J, C-160, CH-47D, etc.): troop/passenger loads on logistics/heli missions.
    if (tags.includes("MILITARY_TRANSPORT") || tags.includes("MILITARY_HELI")) {
        return isMilitaryTroopPassengerMission(chosenMission);
    }
    return false;
}
function formatPassengerManifest(count) {
    return count === 1 ? "1 Passenger" : `${count} Passengers`;
}
function normalizeIcao(icao) {
    return (icao || "").trim().toUpperCase();
}
function longHaulBlockMinutesToDistanceNm(blockMins, spec, aircraftType) {
    const speed = getBlockSpeedForSpec(spec, aircraftType);
    return (speed * Math.max(0, blockMins - LONG_HAUL_BLOCK_TIME_PAD_MINS)) / 60;
}
function estimateLongHaulBlockMinutes(distNm, spec, aircraftType) {
    const speed = getBlockSpeedForSpec(spec, aircraftType);
    if (!speed || !distNm) return 0;
    return Math.round((distNm / speed) * 60) + LONG_HAUL_BLOCK_TIME_PAD_MINS;
}
function estimateLongHaulBlockMinutesForRoute(dist, spec, aircraftType) {
    return estimateLongHaulBlockMinutes(Math.round(dist), spec, aircraftType);
}
function getMaxAchievableBlockMinutes(spec, aircraftType) {
    const maxD = spec.maxD;
    if (!maxD || maxD <= 0) return Infinity;
    return estimateLongHaulBlockMinutes(maxD, spec, aircraftType);
}
function getLongHaulMaxBlockForAircraft(spec, aircraftType) {
    return Math.min(LONG_HAUL_MAX_BLOCK_MINS, getMaxAchievableBlockMinutes(spec, aircraftType));
}
function getLongHaulMinBlockForAircraft(spec, aircraftType) {
    const minD = spec.minD || 0;
    if (minD > 0) {
        return Math.max(LONG_HAUL_MIN_BLOCK_MINS, estimateLongHaulBlockMinutes(minD, spec, aircraftType));
    }
    return LONG_HAUL_MIN_BLOCK_MINS;
}
function passesLongHaulDurationBand(dist, spec, aircraftType) {
    if (!dist || isNaN(dist)) return false;
    if (!routeWithinAircraftRange(dist, spec)) return false;
    const est = estimateLongHaulBlockMinutesForRoute(dist, spec, aircraftType);
    return est >= getLongHaulMinBlockForAircraft(spec, aircraftType)
        && est <= getLongHaulMaxBlockForAircraft(spec, aircraftType);
}
function getLongHaulBlockDistanceLimits(spec, aircraftType) {
    const minBlock = getLongHaulMinBlockForAircraft(spec, aircraftType);
    const maxBlock = getLongHaulMaxBlockForAircraft(spec, aircraftType);
    let minDist = longHaulBlockMinutesToDistanceNm(minBlock, spec, aircraftType);
    let maxDist = longHaulBlockMinutesToDistanceNm(maxBlock, spec, aircraftType);
    const aircraftMin = spec.minD || 0;
    const aircraftMax = spec.maxD || Infinity;
    minDist = Math.max(aircraftMin, minDist);
    maxDist = Math.min(aircraftMax, maxDist);
    if (minDist > maxDist) {
        maxDist = Math.max(minDist, Math.min(aircraftMax, minDist));
    }
    return {
        minTarget: minDist,
        maxTarget: maxDist,
        targetDist: (minDist + maxDist) / 2
    };
}
function getEffectiveBlockMinutes(targetMins, spec, longHaul, aircraftType) {
    if (isSliderIgnoredAircraft(spec)) return 20;
    if (longHaul) {
        const midBlock = (getLongHaulMinBlockForAircraft(spec, aircraftType)
            + getLongHaulMaxBlockForAircraft(spec, aircraftType)) / 2;
        return Math.max(60, midBlock - LONG_HAUL_BLOCK_TIME_PAD_MINS);
    }
    return Math.max(10, targetMins - SHORT_HAUL_BLOCK_TIME_PAD_MINS - SHORT_HAUL_ROUTE_PLANNING_TRIM_MINS);
}
function isGliderAircraft(spec) {
    if (!spec) return false;
    const cls = String(spec.class || "").trim().toUpperCase();
    if (cls === "GLIDER") return true;
    const tags = spec.tags || [];
    return tags.includes("GLIDER") && cls !== "HELI" && cls !== "JET" && cls !== "BIZ JET";
}
function isSliderIgnoredAircraft(spec) {
    if (!spec) return false;
    const cls = String(spec.class || "").trim().toUpperCase();
    return cls === "HELI" || isGliderAircraft(spec);
}
function getBlockSpeedForSpec(spec, aircraftType) {
    if (aircraftType && VINTAGE_PROPLINER_TYPES.has(aircraftType)) {
        return BLOCK_SPEED_KTS.VINTAGE_PROPLINER;
    }
    if (spec.class === "JET") {
        if (isLongHaulModeEnabled() && spec.tags && spec.tags.includes("HEAVY")) {
            return BLOCK_SPEED_KTS.HEAVY_JET;
        }
        return BLOCK_SPEED_KTS.JET;
    }
    if (spec.class === "BIZ JET") {
        if (isLongHaulModeEnabled() && aircraftType && FAST_BIZ_JET_TYPES.has(aircraftType)) {
            return BLOCK_SPEED_KTS.BIZ_JET_FAST;
        }
        return BLOCK_SPEED_KTS.BIZ_JET;
    }
    if (spec.class === "TURBO") {
        if (spec.tags && spec.tags.includes("MILITARY_TRANSPORT")) return BLOCK_SPEED_KTS.MIL_TURBO;
        if (spec.tags && spec.tags.includes("HEAVY")) return BLOCK_SPEED_KTS.HEAVY_TURBO;
        return BLOCK_SPEED_KTS.TURBO;
    }
    if (spec.class === "WARBIRD") return BLOCK_SPEED_KTS.WARBIRD;
    if (spec.class === "HELI") return BLOCK_SPEED_KTS.HELI;
    if (spec.class === "GLIDER") return BLOCK_SPEED_KTS.GLIDER;
    if (spec.class === "GA" && spec.maxAlt >= 15000) return BLOCK_SPEED_KTS.GA_HIGH;
    return BLOCK_SPEED_KTS.GA;
}
const SHORT_HAUL_SLIDER = { min: 40, max: 120, step: 10, defaultValue: 60, listId: "steplist" };
// Short-haul slider = target SimBrief block. Routing cruise subtracts SHORT_HAUL_BLOCK_TIME_PAD_MINS;
// pick/filter adds SIMBRIEF_OVERHEAD to proxy block so filed routes land near the slider.
const SHORT_HAUL_PRIMARY_DISTANCE_BAND = 0.12;
const SHORT_HAUL_RELAXED_DISTANCE_BAND = 0.28;
const SHORT_HAUL_SIMBRIEF_OVERHEAD_MINS = 12;
const SHORT_HAUL_SIMBRIEF_PICK_TOLERANCE_MINS = 8;
const FIXED_DEPARTURE_BLOCK_TOLERANCE_MINS = 15;
const FIXED_DEPARTURE_BLOCK_RELAXED_MINS = 20;
function estimateShortHaulBlockMinutesForRoute(dist, spec, aircraftType) {
    return estimateLongHaulBlockMinutesForRoute(dist, spec, aircraftType);
}
function getShortHaulSimbriefProxyBlockMinutes(dist, spec, aircraftType) {
    return estimateShortHaulBlockMinutesForRoute(dist, spec, aircraftType) + SHORT_HAUL_SIMBRIEF_OVERHEAD_MINS;
}
function passesShortHaulSimbriefTarget(dist, targetMins, spec, aircraftType, toleranceMins) {
    return getShortHaulSimbriefProxyBlockMinutes(dist, spec, aircraftType) <= targetMins + toleranceMins;
}
function getRouteDistanceLimits(targetMins, spec, aircraftType, longHaul, depOverride) {
    const blockSpeed = getBlockSpeedForSpec(spec, aircraftType);
    const effectiveMins = getEffectiveBlockMinutes(targetMins, spec, longHaul, aircraftType);
    let targetDist = (blockSpeed * effectiveMins) / 60;
    const aircraftMax = spec.maxD || targetDist;
    const aircraftMin = spec.minD || 0;
    targetDist = Math.min(targetDist, aircraftMax);
    if (aircraftMin > 0 && targetDist < aircraftMin) {
        targetDist = aircraftMin;
    }
    if (spec.class === "HELI") {
        return { minTarget: 5, maxTarget: 35, relaxedMin: 5, relaxedMax: 35, targetDist };
    }
    if (isGliderAircraft(spec)) {
        const gliderTarget = Math.max(GLIDER_MIN_ROUTE_NM, Math.min(GLIDER_MAX_ROUTE_NM, targetDist));
        return {
            minTarget: GLIDER_MIN_ROUTE_NM,
            maxTarget: GLIDER_MAX_ROUTE_NM,
            relaxedMin: GLIDER_MIN_ROUTE_NM,
            relaxedMax: GLIDER_MAX_ROUTE_NM,
            targetDist: gliderTarget
        };
    }
    if (longHaul) {
        const blockLimits = getLongHaulBlockDistanceLimits(spec, aircraftType);
        return {
            minTarget: blockLimits.minTarget,
            maxTarget: blockLimits.maxTarget,
            relaxedMin: blockLimits.minTarget,
            relaxedMax: blockLimits.maxTarget,
            targetDist: blockLimits.targetDist
        };
    }
    let minTarget = Math.max(aircraftMin, targetDist * (1 - SHORT_HAUL_PRIMARY_DISTANCE_BAND));
    let maxTarget = Math.min(aircraftMax, targetDist * (1 + SHORT_HAUL_PRIMARY_DISTANCE_BAND));
    if (minTarget > maxTarget) maxTarget = Math.max(maxTarget, aircraftMin);
    let relaxedMin = Math.max(aircraftMin, targetDist * (1 - SHORT_HAUL_RELAXED_DISTANCE_BAND));
    let relaxedMax = Math.min(aircraftMax, targetDist * (1 + SHORT_HAUL_RELAXED_DISTANCE_BAND));
    if (relaxedMin > relaxedMax) relaxedMax = Math.max(relaxedMax, aircraftMin);
    return {
        minTarget,
        maxTarget,
        relaxedMin,
        relaxedMax,
        targetDist
    };
}
const ROUTE_FALLBACK_ALERT = "No routes could be found using the existing airport database information. Your dispatcher has found the closest possible flight routing for you instead.";
function formatBlockTimeHoursMinutes(totalMins) {
    const mins = Math.max(0, Math.round(totalMins));
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs <= 0) return `${rem} minutes`;
    if (rem === 0) return hrs === 1 ? "1 hour" : `${hrs} hours`;
    return `${hrs} hour${hrs === 1 ? "" : "s"} ${rem} minutes`;
}
function buildNoLongHaulMissionsMessage(spec, type, isContractorMode) {
    const tags = spec.tags || [];

    if (spec.class === "GLIDER" || spec.class === "HELI") {
        return "Long-haul dispatch is not available for this aircraft type. Turn off Long Haul or choose a fixed-wing jet or turboprop.";
    }

    if (spec.class === "BIZ JET") {
        if (!tags.includes("PAX") || !tags.includes("VIP")) {
            return "Your dispatcher could not assign a long-haul mission. This business jet needs a passenger and VIP configuration. If you added it manually, review the settings under Custom Aircraft.";
        }
        return "Your dispatcher could not assign a long-haul executive mission for this routing. Try choosing a different departure or turning off long-haul for a shorter sector.";
    }

    if (tags.includes("FREIGHTER") && spec.isMilitary) {
        return "Your dispatcher could not assign a long-haul military cargo mission for this airframe and routing. Try a different departure or turn off Long Haul for a shorter sector.";
    }

    if (tags.includes("FREIGHTER")) {
        return "Your dispatcher could not assign a long-haul freight mission for this airframe and routing. Try choosing a different departure or turning off Long Haul for a shorter sector.";
    }

    if (tags.includes("JETLINER") && tags.includes("PAX")) {
        return "Your dispatcher could not assign a long-haul airline mission for this routing. Try choosing a different departure region.";
    }

    if (spec.isMilitary && !isContractorMode && !tags.includes("CIVIL_OK")) {
        return "Your dispatcher could not assign a long-haul mission for this military aircraft. Enable Contractor Mode for civilian-style missions, or turn off Long Haul for a shorter sector.";
    }

    if (spec.isTactical) {
        return "Your dispatcher could not assign a long-haul mission for this tactical aircraft. Long haul is intended for transports and airliners — try turning off Long Haul mode.";
    }

    return "Your dispatcher could not find a long-haul mission for this aircraft and current settings. Try turning off Long Haul, choosing a different departure, or selecting an airframe with greater range.";
}
function getDefaultAircraftRange(acClass) {
    switch (acClass) {
        case "GLIDER": return { minD: 20, maxD: 500 };
        case "HELI": return { minD: 5, maxD: 200 };
        case "GA": return { minD: 20, maxD: 800 };
        case "TURBO": return { minD: 50, maxD: 1800 };
        case "BIZ JET": return { minD: 100, maxD: 3500 };
        case "JET": return { minD: 150, maxD: 7500 };
        case "WARBIRD": return { minD: 60, maxD: 1200 };
        default: return { minD: 20, maxD: 800 };
    }
}
function getDefaultMinDistanceNm(rawClass) {
    if (rawClass === "MIL_JET") return 150;
    return getDefaultAircraftRange(rawClass).minD;
}
function estimateBlockMinutesFromDistance(distNm, spec, aircraftType) {
    const speed = getBlockSpeedForSpec(spec, aircraftType);
    if (!speed || !distNm) return 0;
    return Math.round((distNm / speed) * 60);
}
function hasMilitaryAirportAccess(spec, isContractorMode, forceMilitaryBases) {
    return !!(spec.isMilitary || isContractorMode || forceMilitaryBases);
}
function syncContractorMilitaryOptions() {
    const militaryEl = document.getElementById("militaryBaseToggle");
    if (!militaryEl) return;
    militaryEl.disabled = false;
}
function getEffectiveMilitaryBaseRouting(isContractorMode, forceMilitaryBases) {
    return !!forceMilitaryBases;
}
function usesContractorMissionFirstRouting(isContractorMode, spec) {
    return !!(isContractorMode && spec && !spec.isMilitary);
}
function getRoutingMilitaryOnlyMode(isContractorMode, spec, forceMilitaryBases) {
    if (usesContractorMissionFirstRouting(isContractorMode, spec)) return false;
    return getEffectiveMilitaryBaseRouting(isContractorMode, forceMilitaryBases);
}
function passesDispatchAirportFilters(ap, spec, type, overrideIcao, forceMilitaryBases, isContractorMode) {
    const apIcao = normalizeIcao(ap.icao);
    if (spec.class === "GLIDER" && !isGliderSuitableAirport(ap, spec)) {
        return false;
    }
    const hasMilitaryAccess = hasMilitaryAirportAccess(spec, isContractorMode, forceMilitaryBases);
    if (ap.isMilitary && !hasMilitaryAccess && apIcao !== overrideIcao) return false;
    if (forceMilitaryBases && !ap.isMilitary && apIcao !== overrideIcao) return false;
    let isAllowedType = spec.class === "GLIDER" ? isGliderSuitableAirport(ap, spec) : getAllowedClassesForRunway(ap.rwy).includes(spec.class);
    const minRunway = Number(spec.minRunwayLength) || 0;
    let finalMeetsLength = ap.length ? (minRunway <= 0 || ap.length >= minRunway) : true;
    const exceptions = applyRunwayFieldExceptions(ap, type, spec, isAllowedType, finalMeetsLength);
    isAllowedType = exceptions.isAllowedType;
    finalMeetsLength = exceptions.meetsLength;
    return isAllowedType && finalMeetsLength;
}
function buildDispatchRoutingPools(depOverride, routingScope, spec, type, forceMilitaryBases, isContractorMode) {
    const overrideIcao = normalizeIcao(depOverride);
    const eligible = activeAirportDatabase.filter(ap =>
        passesDispatchAirportFilters(ap, spec, type, overrideIcao, forceMilitaryBases, isContractorMode)
    );
    if (routingScope === "worldwide") {
        return { departureAirports: eligible, destinationAirports: eligible };
    }
    const overrideIcaos = getRoutingOverrideIcaos(depOverride);
    const regionalDestinations = eligible.filter(ap =>
        airportAllowedForRouting(ap, routingScope, overrideIcaos)
    );
    if (!overrideIcao) {
        return { departureAirports: regionalDestinations, destinationAirports: regionalDestinations };
    }
    const depAp = eligible.find(ap => normalizeIcao(ap.icao) === overrideIcao);
    return {
        departureAirports: depAp ? [depAp] : [],
        destinationAirports: regionalDestinations
    };
}
function pairPassesFixedDepartureBlockWindow(dist, routingTargetMins, spec, aircraftType, toleranceMins) {
    return passesShortHaulSimbriefTarget(dist, routingTargetMins, spec, aircraftType, toleranceMins);
}
function buildJetRoutePairs(sources, destinations, depOverride, spec, minTarget, maxTarget, relaxedMin, relaxedMax, longHaul, routingTargetMins, aircraftType) {
    const depCode = normalizeIcao(depOverride);
    const fixedDepShortHaul = !!(depCode && !longHaul && !isSliderIgnoredAircraft(spec));
    const candidatePairs = [];
    let usedRelaxedRouting = false;
    if (!longHaul && spec.class === "HELI") {
        return buildHelicopterRoutePairs(
            sources, destinations, depOverride, spec,
            minTarget, maxTarget, relaxedMin, relaxedMax
        );
    }
    if (longHaul) {
        const collectLongHaulPairs = (distMin, distMax) => {
            const pairs = [];
            for (const src of sources) {
                if (depCode && normalizeIcao(src.icao) !== depCode) continue;
                for (const dst of destinations) {
                    if (normalizeIcao(src.icao) === normalizeIcao(dst.icao) && spec.class !== "HELI") continue;
                    const dist = calculateDistance(src.lat, src.lon, dst.lat, dst.lon);
                    if (!dist || isNaN(dist)) continue;
                    if (dist < distMin || dist > distMax) continue;
                    if (!passesLongHaulDurationBand(dist, spec, aircraftType)) continue;
                    pairs.push({ src, dst, dist });
                }
            }
            return pairs;
        };
        candidatePairs.push(...collectLongHaulPairs(minTarget, maxTarget));
        if (!candidatePairs.length) {
            usedRelaxedRouting = true;
            const widen = 0.05;
            candidatePairs.push(...collectLongHaulPairs(
                minTarget * (1 - widen),
                maxTarget * (1 + widen)
            ));
        }
        return { candidatePairs, usedRelaxedRouting };
    }
    let primaryPairs = [];
    for (const src of sources) {
        if (depCode && normalizeIcao(src.icao) !== depCode) continue;
        for (const dst of destinations) {
            if (normalizeIcao(src.icao) === normalizeIcao(dst.icao) && spec.class === "HELI") {
                primaryPairs.push({ src, dst: src, dist: 25 });
                continue;
            }
            if (normalizeIcao(src.icao) === normalizeIcao(dst.icao)) continue;
            const dist = calculateDistance(src.lat, src.lon, dst.lat, dst.lon);
            if (!dist || isNaN(dist)) continue;
            if (!routeWithinAircraftRange(dist, spec)) continue;
            if (dist >= minTarget && dist <= maxTarget) {
                if (fixedDepShortHaul && !pairPassesFixedDepartureBlockWindow(dist, routingTargetMins, spec, aircraftType, SHORT_HAUL_SIMBRIEF_PICK_TOLERANCE_MINS)) {
                    continue;
                }
                primaryPairs.push({ src, dst, dist });
            }
        }
    }
    if (primaryPairs.length === 0) {
        usedRelaxedRouting = true;
        for (const src of sources) {
            if (depCode && normalizeIcao(src.icao) !== depCode) continue;
            for (const dst of destinations) {
                if (normalizeIcao(src.icao) === normalizeIcao(dst.icao) && spec.class === "HELI") continue;
                if (normalizeIcao(src.icao) === normalizeIcao(dst.icao)) continue;
                const dist = calculateDistance(src.lat, src.lon, dst.lat, dst.lon);
                if (!dist || isNaN(dist)) continue;
                if (!routeWithinAircraftRange(dist, spec)) continue;
                if (dist >= relaxedMin && dist <= relaxedMax) {
                    if (fixedDepShortHaul && !pairPassesFixedDepartureBlockWindow(dist, routingTargetMins, spec, aircraftType, FIXED_DEPARTURE_BLOCK_RELAXED_MINS)) {
                        continue;
                    }
                    candidatePairs.push({ src, dst, dist });
                }
            }
        }
    } else {
        candidatePairs.push(...primaryPairs);
    }
    return { candidatePairs, usedRelaxedRouting };
}
function routeWithinAircraftRange(dist, spec) {
    const minD = spec.minD || 0;
    const maxD = spec.maxD || Infinity;
    return dist >= minD && dist <= maxD;
}
const HELI_ROUTE_PAIR_CAP = 8000;
const HELI_GRID_CELL_DEG = 0.45;
function nmToLatDeltaDeg(nm) {
    return nm / 60;
}
function nmToLonDeltaDeg(nm, lat) {
    const cosLat = Math.cos((lat * Math.PI) / 180);
    return nm / (60 * Math.max(0.25, Math.abs(cosLat)));
}
function buildAirportSpatialGrid(airports, cellDeg) {
    const grid = new Map();
    for (const ap of airports) {
        if (ap.lat == null || ap.lon == null || isNaN(ap.lat) || isNaN(ap.lon)) continue;
        const key = `${Math.floor(ap.lat / cellDeg)},${Math.floor(ap.lon / cellDeg)}`;
        let bucket = grid.get(key);
        if (!bucket) {
            bucket = [];
            grid.set(key, bucket);
        }
        bucket.push(ap);
    }
    return grid;
}
function forEachAirportNearGrid(grid, ap, cellDeg, latDeltaDeg, lonDeltaDeg, callback) {
    const latCell = Math.floor(ap.lat / cellDeg);
    const lonCell = Math.floor(ap.lon / cellDeg);
    const cellRadius = Math.max(1, Math.ceil(Math.max(latDeltaDeg, lonDeltaDeg) / cellDeg));
    for (let dLat = -cellRadius; dLat <= cellRadius; dLat++) {
        for (let dLon = -cellRadius; dLon <= cellRadius; dLon++) {
            const bucket = grid.get(`${latCell + dLat},${lonCell + dLon}`);
            if (!bucket) continue;
            for (const candidate of bucket) callback(candidate);
        }
    }
}
function capRoutePairPool(pairs, cap) {
    if (pairs.length <= cap) return pairs;
    const picked = [];
    const used = new Set();
    while (picked.length < cap && used.size < pairs.length) {
        const idx = Math.floor(Math.random() * pairs.length);
        if (used.has(idx)) continue;
        used.add(idx);
        picked.push(pairs[idx]);
    }
    return picked;
}
function buildHelicopterRoutePairs(sources, destinations, depOverride, spec, minTarget, maxTarget, relaxedMin, relaxedMax) {
    const depCode = normalizeIcao(depOverride);
    const searchMax = Math.max(maxTarget, relaxedMax);
    const latDelta = nmToLatDeltaDeg(searchMax + 5);
    const destGrid = buildAirportSpatialGrid(destinations, HELI_GRID_CELL_DEG);

    function collectPairs(minDist, maxDist) {
        const found = [];
        for (const src of sources) {
            if (depCode && normalizeIcao(src.icao) !== depCode) continue;
            found.push({ src, dst: src, dist: 25 });
            const lonDelta = nmToLonDeltaDeg(searchMax + 5, src.lat);
            forEachAirportNearGrid(destGrid, src, HELI_GRID_CELL_DEG, latDelta, lonDelta, (dst) => {
                if (normalizeIcao(src.icao) === normalizeIcao(dst.icao)) return;
                if (Math.abs(dst.lat - src.lat) > latDelta) return;
                if (Math.abs(dst.lon - src.lon) > lonDelta) return;
                const dist = calculateDistance(src.lat, src.lon, dst.lat, dst.lon);
                if (!dist || isNaN(dist)) return;
                if (dist >= minDist && dist <= maxDist && routeWithinAircraftRange(dist, spec)) {
                    found.push({ src, dst, dist });
                }
            });
        }
        return found;
    }

    let candidatePairs = collectPairs(minTarget, maxTarget);
    let usedRelaxedRouting = false;
    if (candidatePairs.length === 0) {
        usedRelaxedRouting = true;
        candidatePairs = collectPairs(relaxedMin, relaxedMax);
    }
    return {
        candidatePairs: capRoutePairPool(candidatePairs, HELI_ROUTE_PAIR_CAP),
        usedRelaxedRouting
    };
}
function pickShortHaulRoute(pool, targetMins, spec, aircraftType) {
    const rank = (pair) => {
        const est = estimateShortHaulBlockMinutesForRoute(pair.dist, spec, aircraftType);
        const proxy = est + SHORT_HAUL_SIMBRIEF_OVERHEAD_MINS;
        return {
            pair,
            est,
            proxy,
            proxyOvershoot: Math.max(0, proxy - targetMins),
            estOvershoot: Math.max(0, est - targetMins),
            proxyDelta: Math.abs(proxy - targetMins),
            estDelta: Math.abs(est - targetMins)
        };
    };
    for (const tol of [
        SHORT_HAUL_SIMBRIEF_PICK_TOLERANCE_MINS,
        FIXED_DEPARTURE_BLOCK_TOLERANCE_MINS,
        FIXED_DEPARTURE_BLOCK_RELAXED_MINS
    ]) {
        const ranked = pool
            .map(rank)
            .filter(entry => entry.proxy <= targetMins + tol)
            .sort((a, b) => {
                if (a.proxyOvershoot !== b.proxyOvershoot) return a.proxyOvershoot - b.proxyOvershoot;
                if (a.proxyDelta !== b.proxyDelta) return a.proxyDelta - b.proxyDelta;
                if (a.estOvershoot !== b.estOvershoot) return a.estOvershoot - b.estOvershoot;
                return a.estDelta - b.estDelta;
            });
        if (!ranked.length) continue;
        const bestOvershoot = ranked[0].proxyOvershoot;
        const close = ranked.filter(entry => entry.proxyOvershoot <= bestOvershoot + 1);
        return close[Math.floor(Math.random() * close.length)].pair;
    }
    const ranked = pool.map(rank).sort((a, b) => a.proxyDelta - b.proxyDelta);
    return ranked[0].pair;
}
function pickLongHaulRoute(pool, spec, aircraftType) {
    const valid = pool.filter(p => passesLongHaulDurationBand(p.dist, spec, aircraftType));
    if (!valid.length) return null;
    return valid[Math.floor(Math.random() * valid.length)];
}
function pickRouteByTimeFit(pool, targetMins, targetDistNm, spec, aircraftType, longHaul) {
    if (!pool.length) return null;
    if (!longHaul) {
        return pickShortHaulRoute(pool, targetMins, spec, aircraftType);
    }
    return pickLongHaulRoute(pool, spec, aircraftType);
}
function isLongHaulMissionType(missionType) {
    if (typeof LONG_HAUL_MISSION_TYPES === "undefined" || !Array.isArray(LONG_HAUL_MISSION_TYPES)) return false;
    return LONG_HAUL_MISSION_TYPES.includes(missionType);
}
function isLongHaulExclusiveMissionType(missionType) {
    if (typeof LONG_HAUL_EXCLUSIVE_MISSION_TYPES === "undefined" || !Array.isArray(LONG_HAUL_EXCLUSIVE_MISSION_TYPES)) return false;
    return LONG_HAUL_EXCLUSIVE_MISSION_TYPES.includes(missionType);
}
function getLongHaulScenarioIdsForMission(missionType) {
    if (typeof LONG_HAUL_SCENARIOS_BY_MISSION === "undefined") return null;
    const ids = LONG_HAUL_SCENARIOS_BY_MISSION[missionType];
    return ids && ids.length ? ids : null;
}
function filterScenariosForHaulMode(pool, missionType, longHaul) {
    const restrictedIds = getLongHaulScenarioIdsForMission(missionType);
    if (!restrictedIds || !pool.length) return pool;
    const allowed = new Set(restrictedIds);
    if (longHaul) {
        const longHaulPool = pool.filter(s => allowed.has(s.imgId));
        return longHaulPool.length > 0 ? longHaulPool : pool;
    }
    const shortHaulPool = pool.filter(s => !allowed.has(s.imgId));
    const minShortHaulScenarios = 3;
    if (shortHaulPool.length < minShortHaulScenarios && pool.length > shortHaulPool.length) {
        return pool;
    }
    return shortHaulPool.length > 0 ? shortHaulPool : pool;
}
function missionAllowedForHaulMode(m, longHaul) {
    if (longHaul) return isLongHaulMissionType(m.type);
    return !isLongHaulExclusiveMissionType(m.type);
}
function clampFlightTimeMinutes(value, cfg) {
    const num = parseInt(value, 10);
    if (isNaN(num)) return cfg.defaultValue;
    const stepped = Math.round((num - cfg.min) / cfg.step) * cfg.step + cfg.min;
    return Math.max(cfg.min, Math.min(cfg.max, stepped));
}
function getSavedFlightTimeMinutes() {
    const cfg = SHORT_HAUL_SLIDER;
    try {
        const saved = localStorage.getItem("dispatcher_flight_time_short");
        if (saved !== null) return clampFlightTimeMinutes(saved, cfg);
    } catch (e) { /* private browsing / storage full */ }
    return cfg.defaultValue;
}
function saveFlightTimeMinutes(mins) {
    try {
        localStorage.setItem("dispatcher_flight_time_short", String(mins));
    } catch (e) { /* private browsing / storage full */ }
}
function getSelectedAircraftType() {
    const selectedName = document.getElementById("aircraftInput").value.trim();
    return Object.keys(activeFleetSpecs).find(key => activeFleetSpecs[key].name === selectedName) || null;
}
function canAircraftUseLongHaulMode(spec, type) {
    if (!spec || isSliderIgnoredAircraft(spec)) return false;
    const maxBlock = getLongHaulMaxBlockForAircraft(spec, type);
    if (maxBlock < LONG_HAUL_MIN_BLOCK_MINS) return false;
    return getLongHaulMinBlockForAircraft(spec, type) <= maxBlock;
}
function syncLongHaulToggleForAircraft() {
    const toggle = document.getElementById("longHaulToggle");
    if (!toggle) return;
    const type = getSelectedAircraftType();
    const spec = type ? activeFleetSpecs[type] : null;
    if (!spec || !type) {
        toggle.disabled = false;
        return;
    }
    const canLongHaul = canAircraftUseLongHaulMode(spec, type);
    toggle.disabled = !canLongHaul;
    if (!canLongHaul && toggle.checked) {
        toggle.checked = false;
        try {
            localStorage.setItem("dispatcher_long_haul", "0");
        } catch (e) { /* private browsing / storage full */ }
        applyFlightTimeSliderMode(false, true);
    }
}
function isLongHaulModeEnabled() {
    const el = document.getElementById("longHaulToggle");
    return !!(el && el.checked);
}
function updateFlightTimeDisplay() {
    if (isLongHaulModeEnabled()) return;
    const slider = document.getElementById("timeSlider");
    const timeVal = document.getElementById("timeVal");
    const timeUnit = document.getElementById("timeUnit");
    if (!slider || !timeVal) return;
    const mins = parseInt(slider.value, 10);
    timeVal.innerText = String(mins);
    if (timeUnit) timeUnit.innerText = "minutes";
    saveFlightTimeMinutes(mins);
}
function applyFlightTimeSliderMode(longHaul, useSavedValue) {
    const slider = document.getElementById("timeSlider");
    const heading = document.getElementById("timeSliderHeading");
    const longHaulNote = document.getElementById("longHaulNote");
    if (!slider) return;
    if (longHaul) {
        slider.style.display = "none";
        slider.disabled = true;
        if (heading) heading.style.display = "none";
        if (longHaulNote) longHaulNote.style.display = "block";
        return;
    }
    slider.style.display = "";
    slider.disabled = false;
    if (heading) {
        heading.style.display = "";
        heading.innerHTML = 'Target Block Time: <span id="timeVal">60</span> <span id="timeUnit">minutes</span>';
    }
    if (longHaulNote) longHaulNote.style.display = "none";
    const cfg = SHORT_HAUL_SLIDER;
    slider.min = cfg.min;
    slider.max = cfg.max;
    slider.step = cfg.step;
    slider.value = useSavedValue ? getSavedFlightTimeMinutes() : cfg.defaultValue;
    slider.setAttribute("list", cfg.listId);
    updateFlightTimeDisplay();
}
function toggleLongHaulMode() {
    const toggle = document.getElementById("longHaulToggle");
    if (toggle && toggle.checked) {
        const type = getSelectedAircraftType();
        const spec = type ? activeFleetSpecs[type] : null;
        if (spec && type && !canAircraftUseLongHaulMode(spec, type)) {
            toggle.checked = false;
            alert(`Long haul flights are not available for this aircraft. Maximum block time is approximately ${formatBlockTimeHoursMinutes(getMaxAchievableBlockMinutes(spec, type))}.`);
            return;
        }
    }
    const enabled = isLongHaulModeEnabled();
    applyFlightTimeSliderMode(enabled, !enabled);
    try {
        localStorage.setItem("dispatcher_long_haul", enabled ? "1" : "0");
    } catch (e) { /* private browsing / storage full */ }
}
function loadLongHaulPreference() {
    let enabled = false;
    try {
        enabled = localStorage.getItem("dispatcher_long_haul") === "1";
    } catch (e) {
        enabled = false;
    }
    const toggle = document.getElementById("longHaulToggle");
    if (toggle) toggle.checked = enabled;
    syncLongHaulToggleForAircraft();
    applyFlightTimeSliderMode(!!(toggle && toggle.checked), true);
}
let routingScopeListenersBound = false;
function initRoutingScope() {
    loadRoutingScope();
    if (routingScopeListenersBound) return;
    const select = document.getElementById("routingScopeSelect");
    if (select) select.addEventListener("change", saveRoutingScope);
    routingScopeListenersBound = true;
}

function saveCallsign() {
    const cs = document.getElementById("callsignInput").value.trim().toUpperCase();
    if (cs.length < 3) {
        alert("Please specify a valid callsign prefix.");
        return;
    }
    localStorage.setItem("dispatcher_saved_callsign", cs);
    alert(`Callsign ${cs} saved to local memory configuration.`);
}
function saveOwnedAirports() {
    const input = document.getElementById("ownedAirportsInput").value;
    const toggle = document.getElementById("preferOwnedToggle").checked;
    localStorage.setItem("dispatcher_owned_airports", input);
    localStorage.setItem("dispatcher_prefer_owned", toggle ? "true" : "false");
    // Refresh the stats immediately
    updateDatabaseStats();
    alert("Owned airports configuration saved to local memory!");
}
function getOwnedAirportList() {
    const inputEl = document.getElementById("ownedAirportsInput");
    const raw = inputEl ? inputEl.value : (localStorage.getItem("dispatcher_owned_airports") || "");
    return raw.split(",").map(s => s.trim().toUpperCase()).filter(s => s.length > 0);
}
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
function formatRoutingAirportLabel(icao, name, ownedSet) {
    const displayName = stripIrlNameSuffix(name);
    const safeIcao = escapeHtml(icao);
    const safeName = escapeHtml(displayName);
    if (ownedSet.has(String(icao).toUpperCase())) {
        return `<span class="owned-airport-icao">${safeIcao}</span> (${safeName})`;
    }
    return `${safeIcao} (${safeName})`;
}
function stripIrlNameSuffix(name) {
    if (!name) return name;
    return String(name).replace(/\s*\(IRL:\s*[^)]+\)/gi, "").trim();
}
function loadSettings() {
    const savedCallsign = localStorage.getItem("dispatcher_saved_callsign");
    if (savedCallsign) {
        document.getElementById("callsignInput").value = savedCallsign;
    }
    const storedTheme = localStorage.getItem("dispatcher_theme");
    if (storedTheme) setMode(storedTheme);
    // --- New Load Logic ---
    const ownedList = localStorage.getItem("dispatcher_owned_airports");
    if (ownedList) {
        document.getElementById("ownedAirportsInput").value = ownedList;
    }
    const preferOwned = localStorage.getItem("dispatcher_prefer_owned") === "true";
    document.getElementById("preferOwnedToggle").checked = preferOwned;
    loadRoutingScope();
    initRoutingScope();
    loadLongHaulPreference();
    syncContractorMilitaryOptions();
}
function toggleSettingsPanel() {
    const p = document.getElementById("settingsPanel");
    p.style.display = (p.style.display === "block") ? "none" : "block";
    document.getElementById("logbookPanel").style.display = "none";
}
function toggleLogbookPanel() {
    const lb = document.getElementById("logbookPanel");
    lb.style.display = (lb.style.display === "block") ? "none" : "block";
    document.getElementById("settingsPanel").style.display = "none";
    if (lb.style.display === "block") updateLogbookUI();
}
function toggleDropdown(id) {
    const el = document.getElementById(id);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
function toggleManageCustomDb() {
    const panel = document.getElementById("manageCustomDbPanel");
    if (!panel) return;
    const backupSection = panel.closest(".settings-section");
    if (backupSection && !backupSection.open) backupSection.open = true;
    const show = panel.style.display !== "block";
    panel.style.display = show ? "block" : "none";
    if (show) {
        bindManageCustomDbActions();
        updateManageCustomDbUI();
    }
}
function escapeAttr(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}
let manageCustomDbActionsBound = false;
function bindManageCustomDbActions() {
    if (manageCustomDbActionsBound) return;
    const apBody = document.getElementById("manageCustomAirportsBody");
    const acBody = document.getElementById("manageCustomAircraftBody");
    if (!apBody || !acBody) return;
    apBody.addEventListener("click", onManageCustomDbTableClick);
    acBody.addEventListener("click", onManageCustomDbTableClick);
    manageCustomDbActionsBound = true;
}
function onManageCustomDbTableClick(e) {
    const removeBtn = e.target.closest(".manage-custom-db-remove");
    if (!removeBtn) return;
    e.preventDefault();
    e.stopPropagation();
    const airportIcao = removeBtn.getAttribute("data-airport-icao");
    const aircraftIcao = removeBtn.getAttribute("data-aircraft-icao");
    if (airportIcao) removeCustomAirport(airportIcao);
    else if (aircraftIcao) removeCustomAircraft(aircraftIcao);
}
const AIRCRAFT_MISSION_CATEGORY_LABELS = {
    LIGHT_GA: "GA",
    REGIONAL: "Regional",
    BIZ_JET: "Business Jet",
    JETLINER: "Commercial narrow-body",
    HEAVY: "Heavy Cargo / Airlifter",
    ROTORCRAFT: "Helicopter",
    FAST_JET: "Fighter Jet",
    VINTAGE: "Vintage",
    WARBIRD: "Warbird"
};
function formatCustomAirportRunwayLength(airport) {
    if (airport.rwy === "HELI") return "Helipad";
    const length = parseInt(airport.length, 10);
    if (!Number.isFinite(length) || length <= 0) return "—";
    return `${length.toLocaleString()} ft`;
}
function formatCustomAirportScenerySource(airport) {
    return airport.source || airport.linkText || "—";
}
function formatAircraftMissionCategory(aircraft) {
    const tags = Array.isArray(aircraft.tags) ? aircraft.tags : [];
    if (tags.includes("JETLINER") && tags.includes("HEAVY")) {
        return "Commercial wide-body";
    }
    const roleOrder = ["WARBIRD", "FAST_JET", "ROTORCRAFT", "HEAVY", "JETLINER", "BIZ_JET", "REGIONAL", "LIGHT_GA", "VINTAGE"];
    for (const role of roleOrder) {
        if (tags.includes(role)) {
            return AIRCRAFT_MISSION_CATEGORY_LABELS[role] || role;
        }
    }
    return "—";
}
function updateManageCustomDbUI() {
    const apBody = document.getElementById("manageCustomAirportsBody");
    const acBody = document.getElementById("manageCustomAircraftBody");
    if (!apBody || !acBody) return;
    const customAirports = JSON.parse(localStorage.getItem("dispatcher_custom_user_airports") || "[]");
    const customFleet = JSON.parse(localStorage.getItem("dispatcher_custom_fleet") || "{}");
    apBody.innerHTML = customAirports.length > 0
        ? customAirports.map(a => {
            const icao = escapeHtml(a.icao);
            const name = escapeHtml(a.name);
            const runway = escapeHtml(formatCustomAirportRunwayLength(a));
            const source = escapeHtml(formatCustomAirportScenerySource(a));
            const icaoAttr = escapeAttr(a.icao);
            return `<tr>
                <td class="cdb-icao"><strong>${icao}</strong></td>
                <td class="cdb-name" title="${name}">${name}</td>
                <td class="cdb-rwy">${runway}</td>
                <td class="cdb-source" title="${source}">${source}</td>
                <td class="cdb-action"><button type="button" class="lb-remove manage-custom-db-remove" data-airport-icao="${icaoAttr}" title="Remove ${icao}" aria-label="Remove ${icao}">&times;</button></td>
            </tr>`;
        }).join("")
        : `<tr><td colspan="5" class="cdb-empty">No custom airports saved.</td></tr>`;
    const fleetKeys = Object.keys(customFleet).sort((a, b) => a.localeCompare(b));
    acBody.innerHTML = fleetKeys.length > 0
        ? fleetKeys.map(icao => {
            const aircraft = customFleet[icao];
            const safeIcao = escapeHtml(icao);
            const name = escapeHtml(aircraft.name || icao);
            const mission = escapeHtml(formatAircraftMissionCategory(aircraft));
            const icaoAttr = escapeAttr(icao);
            return `<tr>
                <td class="cdb-icao"><strong>${safeIcao}</strong></td>
                <td class="cdb-name" title="${name}">${name}</td>
                <td class="cdb-mission" title="${mission}">${mission}</td>
                <td class="cdb-action"><button type="button" class="lb-remove manage-custom-db-remove" data-aircraft-icao="${icaoAttr}" title="Remove ${safeIcao}" aria-label="Remove ${safeIcao}">&times;</button></td>
            </tr>`;
        }).join("")
        : `<tr><td colspan="4" class="cdb-empty">No custom aircraft saved.</td></tr>`;
}
function removeCustomAirport(icao) {
    let customAirports = JSON.parse(localStorage.getItem("dispatcher_custom_user_airports") || "[]");
    const airport = customAirports.find(a => String(a.icao).toUpperCase() === String(icao).toUpperCase());
    if (!airport) return;
    if (!confirm(`Remove custom airport ${airport.icao} - ${airport.name}?\n\nThis cannot be undone.`)) return;
    customAirports = customAirports.filter(a => String(a.icao).toUpperCase() !== String(icao).toUpperCase());
    localStorage.setItem("dispatcher_custom_user_airports", JSON.stringify(customAirports));
    rebuildActiveDatabase();
    rebuildAirportDropdown();
    updateDatabaseStats();
    updateManageCustomDbUI();
}
function removeCustomAircraft(icao) {
    const customFleet = JSON.parse(localStorage.getItem("dispatcher_custom_fleet") || "{}");
    const fleetKey = Object.keys(customFleet).find(k => k.toUpperCase() === String(icao).toUpperCase());
    if (!fleetKey) return;
    const aircraft = customFleet[fleetKey];
    if (!confirm(`Remove custom aircraft ${fleetKey} - ${aircraft.name}?\n\nThis cannot be undone.`)) return;
    delete customFleet[fleetKey];
    localStorage.setItem("dispatcher_custom_fleet", JSON.stringify(customFleet));
    rebuildFleetDropdown();
    updateDatabaseStats();
    updateManageCustomDbUI();
}
const THEME_BANNERS = {
    dark: "images/banner-dark.png",
    light: "images/banner-light.png",
    greyscale: "images/banner-grey.png"
};
function getCurrentThemeMode() {
    if (document.documentElement.classList.contains("light-mode")) return "light";
    if (document.documentElement.classList.contains("greyscale-mode")) return "greyscale";
    return "dark";
}
function missionImageUrl(fileName) {
    const path = `images-missions/${fileName}`;
    return typeof window.dispatcherAssetUrl === "function"
        ? window.dispatcherAssetUrl(path)
        : path;
}
function updateThemeBanner() {
    const img = document.getElementById("dynamicWorkflowBanner");
    if (!img) return;
    const mode = getCurrentThemeMode();
    const path = THEME_BANNERS[mode] || THEME_BANNERS.dark;
    const url = typeof window.dispatcherAssetUrl === "function"
        ? window.dispatcherAssetUrl(path)
        : path;
    if (img.getAttribute("src") !== url) img.src = url;
}
function setMode(mode) {
    document.body.classList.remove('light-mode', 'greyscale-mode');
    document.documentElement.classList.remove('light-mode', 'greyscale-mode');
    if (mode === 'light') {
        document.body.classList.add('light-mode');
        document.documentElement.classList.add('light-mode');
    } else if (mode === 'greyscale') {
        document.body.classList.add('greyscale-mode');
        document.documentElement.classList.add('greyscale-mode');
    }
    localStorage.setItem("dispatcher_theme", mode === 'light' ? 'light' : mode === 'greyscale' ? 'greyscale' : 'dark');
    updateThemeBanner();
}
function getMissionCatalogCounts() {
    const imgIds = new Set();
    const poolMissionCounts = {};
    if (typeof scenarioDB !== 'undefined' && scenarioDB) {
        Object.entries(scenarioDB).forEach(([poolKey, scenarios]) => {
            if (!Array.isArray(scenarios)) return;
            poolMissionCounts[poolKey] = scenarios.length;
            scenarios.forEach(s => {
                if (s.imgId != null) imgIds.add(s.imgId);
            });
        });
    }
    const catalogLines = [];
    if (typeof missionMatrix !== 'undefined' && Array.isArray(missionMatrix)) {
        missionMatrix
            .filter(m => m.pool === 'uniqueMissions')
            .sort((a, b) => a.type - b.type)
            .forEach(m => catalogLines.push(m.name));

        const pooledKeys = Object.keys(poolMissionCounts)
            .filter(poolKey => poolKey !== 'uniqueMissions')
            .sort((a, b) => {
                const typeA = missionMatrix.find(m => m.pool === a);
                const typeB = missionMatrix.find(m => m.pool === b);
                return (typeA ? typeA.type : 999) - (typeB ? typeB.type : 999) || a.localeCompare(b);
            });

        pooledKeys.forEach(poolKey => {
            const templates = missionMatrix
                .filter(m => m.pool === poolKey)
                .sort((a, b) => a.type - b.type);
            const count = poolMissionCounts[poolKey] || 0;
            const title = templates.length > 0 ? templates[0].name : poolKey;
            catalogLines.push(`${title} (${count})`);
        });
    }
    return {
        uniqueMissionCount: imgIds.size,
        catalogLines
    };
}
function formatMissionCatalogListItem(line) {
    return `<li style="margin-bottom: 2px;">${line}</li>`;
}
function updateDatabaseStats() {
    const customFleet = JSON.parse(localStorage.getItem("dispatcher_custom_fleet")) || {};
    const totalActiveFleet = { ...coreFleetSpecs, ...customFleet };
    let coreAcHtml = "";
    const sortedFleet = Object.values(totalActiveFleet).sort((a, b) => a.name.localeCompare(b.name));
    sortedFleet.forEach(aircraft => {
        coreAcHtml += `<li style="margin-bottom: 2px;">${aircraft.name}</li>`;
    });
    document.getElementById('coreAircraftCount').innerText = Object.keys(coreFleetSpecs).length;
    document.getElementById('coreAircraftList').innerHTML = `<ul>${coreAcHtml}</ul>`;
    const liveAirportsDB = getMergedSeedAirports();
    const coreHandcrafted = liveAirportsDB.filter(a => a.tag === 'Hand-Crafted' || a.tag === 'Both');
    const coreThirdParty = liveAirportsDB.filter(a => a.tag === 'Third Party' || a.tag === 'Both');
    const gliderSource = getAsoboAirportDatabase().filter(
        a => a.tag === "Asobo Gliderport" || a.rwy === "GLIDER"
    );
    const coreSmallDetailed = liveAirportsDB.filter(a => a.tag === 'Asobo Detailed Airports' || a.tag === 'MSFS 2024 Detailed Small Airports');
    document.getElementById('coreHandcraftedCount').innerText = coreHandcrafted.length;
    document.getElementById('coreHandcraftedList').innerHTML = coreHandcrafted.length > 0
        ? `<ul>${coreHandcrafted.map(a => `<li>${a.icao} - ${a.name}</li>`).join('')}</ul>`
        : `<ul><li>Loading permanent database array records...</li></ul>`;
	document.getElementById('coreThirdPartyCount').innerText = coreThirdParty.length;
    document.getElementById('coreThirdPartyList').innerHTML = coreThirdParty.length > 0
        ? `<ul>${coreThirdParty.map(a => `<li>${a.icao} - ${a.name}</li>`).join('')}</ul>`
        : `<ul><li>Loading permanent database array records...</li></ul>`;
    const gliderCountEl = document.getElementById('coreGliderportsCount');
    if (gliderCountEl) {
        gliderCountEl.innerText = gliderSource.length;
        document.getElementById('coreGliderportsList').innerHTML = gliderSource.length > 0
            ? `<ul>${gliderSource.map(a => `<li>${a.icao} - ${a.name}</li>`).join('')}</ul>`
            : `<ul><li>Loading permanent database array records...</li></ul>`;
    }
    const smallDetailedEl = document.getElementById('coreSmallDetailedCount');
    if (smallDetailedEl) {
        smallDetailedEl.innerText = coreSmallDetailed.length;
        document.getElementById('coreSmallDetailedList').innerHTML = coreSmallDetailed.length > 0
            ? `<ul>${coreSmallDetailed.map(a => `<li>${a.icao} - ${a.name}</li>`).join('')}</ul>`
            : `<ul><li>Loading permanent database array records...</li></ul>`;
    }
    const legacySmallAirportsEl = document.getElementById('coreSmallAirportsCount');
    if (legacySmallAirportsEl) {
        legacySmallAirportsEl.innerText = coreSmallDetailed.length;
        document.getElementById('coreSmallAirportsList').innerHTML = coreSmallDetailed.length > 0
            ? `<ul>${coreSmallDetailed.map(a => `<li>${a.icao} - ${a.name}</li>`).join('')}</ul>`
            : `<ul><li>Loading permanent database array records...</li></ul>`;
    }
	const coreMilitary = liveAirportsDB.filter(a => a.isMilitary === true);
		document.getElementById('coreMilitaryCount').innerText = coreMilitary.length;
		document.getElementById('coreMilitaryList').innerHTML = coreMilitary.length > 0
			? `<ul>${coreMilitary.map(a => `<li>${a.icao} - ${a.name}</li>`).join('')}</ul>`
			: `<ul><li>Loading permanent database array records...</li></ul>`;
		if (typeof missionMatrix !== 'undefined') {
			const counts = getMissionCatalogCounts();
			document.getElementById('coreMissionsCount').innerText = counts.uniqueMissionCount;
			document.getElementById('coreMissionsList').innerHTML = counts.catalogLines.length > 0
				? `<ul>${counts.catalogLines.map(formatMissionCatalogListItem).join('')}</ul>`
				: `<ul><li>Loading permanent database array records...</li></ul>`;
		}
    const customAirports = JSON.parse(localStorage.getItem("dispatcher_custom_user_airports")) || [];
    document.getElementById('customAirportsCount').innerText = customAirports.length;
    document.getElementById('customAirportsList').innerHTML = customAirports.length > 0 
        ? `<ul>${customAirports.map(a => `<li>${a.icao} - ${a.name}</li>`).join('')}</ul>` 
        : `<ul><li>No custom airports saved.</li></ul>`;
    const customAcKeys = Object.keys(customFleet);
    document.getElementById('customAircraftCount').innerText = customAcKeys.length;
    document.getElementById('savedAircraftList').innerHTML = customAcKeys.length > 0
        ? `<ul>${Object.values(customFleet).map(a => `<li>${a.name}</li>`).join('')}</ul>`
        : `<ul><li>No custom aircraft saved.</li></ul>`;
    // --- Update Owned Airports Count ---
    const ownedRaw = localStorage.getItem("dispatcher_owned_airports") || "";
    const ownedList = ownedRaw.split(',').map(s => s.trim()).filter(s => s.length > 0);
	const ownedCountEl = document.getElementById('ownedAirportsCount');
    if (ownedCountEl) {
        ownedCountEl.innerText = ownedList.length;
    }
    const logbookData = JSON.parse(localStorage.getItem("dispatcher_logbook")) || [];
    const logbookCountEl = document.getElementById('backupLogbookCount');
    if (logbookCountEl) {
        logbookCountEl.innerText = logbookData.length;
    }
    updateManageCustomDbUI();
}
function resolveCustomAirportSource(source) {
    if (source === "MSFS hand-crafted airport") {
        return { tag: "Hand-Crafted", linkText: undefined };
    }
    if (source === "Asobo Gliderport") {
        return { tag: "Asobo Gliderport", linkText: source };
    }
    if (source === "Asobo Detailed Airports") {
        return { tag: "Asobo Detailed Airports", linkText: source };
    }
    return { tag: "Third Party", linkText: source };
}
function saveCustomAirport() {
    const icao = document.getElementById("newIcao").value.trim().toUpperCase();
    const name = document.getElementById("newName").value.trim();
    const rwy = document.getElementById("newRwyType").value;
    const source = document.getElementById("newSource").value;
    const elev = parseInt(document.getElementById("newElev").value, 10) || 0;
    const length = parseInt(document.getElementById("newApLength").value, 10) || 0;
    const isMilitary = document.getElementById("newApMilitary").checked;
    const lat = parseFloat(document.getElementById("newLat").value);
    const lon = parseFloat(document.getElementById("newLon").value);
    if (icao.length !== 4 || name === "") {
        alert("Please enter a valid 4-character ICAO code and airport name.");
        return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) {
        alert("Please enter valid latitude and longitude coordinates. Routes cannot be generated without them.");
        return;
    }
    if (length <= 0 && rwy !== "HELI") {
        alert("Please enter the longest usable runway length in feet (or choose Helipad if there is no runway).");
        return;
    }
    let customAirports = JSON.parse(localStorage.getItem("dispatcher_custom_user_airports")) || [];
    customAirports = customAirports.filter(ap => ap.icao !== icao);
    const { tag: determinedTag, linkText: determinedLinkText } = resolveCustomAirportSource(source);
    customAirports.push({
        icao: icao,
        name: name,
        rwy: rwy,
        length: length,
        elev: elev,
        lat: lat,
        lon: lon,
        source: source,
        tag: determinedTag,
        linkText: determinedLinkText,
        isMilitary: isMilitary
    });
    localStorage.setItem("dispatcher_custom_user_airports", JSON.stringify(customAirports));
    alert(`${icao} added successfully to your local airport database.`);
    clearCustomAirportForm();
    rebuildActiveDatabase();
    updateDatabaseStats();
}
function clearCustomAirportForm() {
    ["newIcao", "newName", "newElev", "newApLength", "newLat", "newLon"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    const mil = document.getElementById("newApMilitary");
    if (mil) mil.checked = false;
}
function buildCustomAircraftTags(rawClass, engineTag, categoryRaw, configTag, options) {
    const tags = new Set();
    tags.add(engineTag);
    categoryRaw.split(" ").filter(Boolean).forEach(tag => tags.add(tag));
    if (configTag === "FREIGHTER") {
        tags.add("FREIGHTER");
    } else if (configTag === "TACTICAL") {
        // Role tags come from MIL_JET class (FAST_JET + FIGHTER) and isTactical flag.
    } else {
        tags.add(configTag);
        if (configTag === "VIP" || configTag === "MEDEVAC" || configTag === "PAX") {
            tags.add("PAX");
        }
    }
    if (rawClass === "HELI") tags.add("ROTORCRAFT");
    if (rawClass === "WARBIRD") tags.add("WARBIRD");
    if (rawClass === "GLIDER") tags.add("GLIDER");
    if (rawClass === "GA") tags.add("PISTON");
    if (rawClass === "TURBO") tags.add("TURBOPROP");
    if (rawClass === "MIL_JET") {
        tags.add("FAST_JET");
        tags.add("FIGHTER");
    }
    if (options.civilOk) tags.add("CIVIL_OK");
    if (options.isMilitary && (configTag === "FREIGHTER" || categoryRaw === "HEAVY")) {
        tags.add("MILITARY_TRANSPORT");
    }
    if (options.stol) tags.add("STOL");
    if (options.amphibian) tags.add("AMPHIBIAN");
    if (options.lightHeli) tags.add("LIGHT_HELI");
    if (options.militaryHeli) tags.add("MILITARY_HELI");
    if (options.fighter) tags.add("FIGHTER");
    if (options.singleSeat) tags.add("SINGLE_SEAT");
    if (options.recon) tags.add("RECON");
    if (rawClass === "GLIDER") {
        if (options.selfLaunch) tags.add("SELF_LAUNCH");
        if (options.selfSustain) tags.add("SELF_SUSTAIN");
        if (options.sailplane) tags.add("SAILPLANE");
        if (options.electric) tags.add("ELECTRIC");
        if (options.twinSeat) tags.add("TWIN_SEAT");
    }
    return [...tags];
}
function updateCustomAircraftForm() {
    const classEl = document.getElementById("newAcClass");
    const roleEl = document.getElementById("newAcRole");
    const militaryEl = document.getElementById("newAcMilitary");
    if (!classEl || !roleEl) return;
    const rawClass = classEl.value;
    const isMilitary = (militaryEl && militaryEl.checked) || rawClass === "MIL_JET";
    const toggleWrap = (id, show, useFlex = true) => {
        const el = document.getElementById(id);
        if (el) el.style.display = show ? (useFlex ? "flex" : "block") : "none";
    };
    toggleWrap("acTagCivilOkWrap", isMilitary && rawClass !== "WARBIRD");
    toggleWrap("acTagFighterWrap", rawClass === "WARBIRD");
    toggleWrap("acTagLightHeliWrap", rawClass === "HELI");
    toggleWrap("acTagMilHeliWrap", isMilitary && rawClass === "HELI");
    toggleWrap("acAirlifterHint", isMilitary && rawClass === "TURBO", false);
    toggleWrap("acTagGliderWrap", rawClass === "GLIDER", false);
    const lengthEl = document.getElementById("newAcLength");
    if (lengthEl && rawClass === "HELI" && lengthEl.value === "") lengthEl.value = "0";
    if (lengthEl && rawClass === "GLIDER" && lengthEl.value === "") lengthEl.value = "1300";
    applyCustomAircraftRangeDefaults();
    Array.from(roleEl.options).forEach(option => {
        option.hidden = false;
        option.disabled = false;
    });
    const exclusiveClassRoles = {
        WARBIRD: "WARBIRD",
        MIL_JET: "FAST_JET",
        HELI: "ROTORCRAFT",
        GLIDER: "GLIDER"
    };
    if (exclusiveClassRoles[rawClass]) {
        roleEl.value = exclusiveClassRoles[rawClass];
    }
    const fighterEl = document.getElementById("newAcFighter");
    if (fighterEl) fighterEl.checked = rawClass === "MIL_JET" ? true : (rawClass === "WARBIRD" ? fighterEl.checked : false);
    const configEl = document.getElementById("newAcConfig");
    if (configEl) {
        Array.from(configEl.options).forEach(option => {
            option.hidden = false;
            option.disabled = false;
        });
        if (rawClass === "MIL_JET") {
            configEl.value = "TACTICAL";
        } else if (rawClass === "GLIDER") {
            configEl.value = "PAX";
        }
    }
}
function applyCustomAircraftRangeDefaults() {
    const classEl = document.getElementById("newAcClass");
    const maxEl = document.getElementById("newAcMaxD");
    if (!classEl || !maxEl) return;
    const rawClass = classEl.value;
    const acClass = rawClass === "MIL_JET" ? "JET" : rawClass;
    const defs = rawClass === "MIL_JET"
        ? { minD: 150, maxD: 320 }
        : getDefaultAircraftRange(acClass);
    maxEl.placeholder = `e.g. ${defs.maxD}`;
    if (!maxEl.dataset.touched) maxEl.value = defs.maxD;
}
function clearCustomAircraftForm() {
    ["newAcName", "newAcIcao", "newAcLength", "newAcMaxPax", "newAcMaxCargo", "newAcMtow", "newAcOew", "newAcFuel", "newAcMaxD"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = "";
            delete el.dataset.touched;
        }
    });
    const classEl = document.getElementById("newAcClass");
    if (classEl) classEl.value = "JET";
    const roleEl = document.getElementById("newAcRole");
    if (roleEl) roleEl.value = "JETLINER";
    const configEl = document.getElementById("newAcConfig");
    if (configEl) configEl.value = "PAX";
    const engineEl = document.getElementById("newAcEngineCount");
    if (engineEl) engineEl.value = "TWIN_ENGINE";
    ["newAcMilitary", "newAcCivilOk", "newAcFighter", "newAcStol", "newAcAmphibian", "newAcLightHeli", "newAcMilHeli", "newAcSingleSeat", "newAcRecon", "newAcSelfLaunch", "newAcSelfSustain", "newAcSailplane", "newAcElectric", "newAcTwinSeat"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });
    updateCustomAircraftForm();
}
function saveCustomAircraft() {
    const name = document.getElementById("newAcName").value.trim();
    const icao = document.getElementById("newAcIcao").value.trim().toUpperCase();
    const minLength = document.getElementById("newAcLength").value;
    const rawClass = document.getElementById("newAcClass").value;
    const acClass = rawClass === "MIL_JET" ? "JET" : rawClass;
    const militaryCheckbox = document.getElementById("newAcMilitary");
    const isMilitary = (militaryCheckbox && militaryCheckbox.checked) || rawClass === "MIL_JET" || rawClass === "WARBIRD";
    const maxPax = parseInt(document.getElementById("newAcMaxPax").value, 10) || 0;
    const maxCargo = parseInt(document.getElementById("newAcMaxCargo").value, 10) || 0;
    const mtow = parseInt(document.getElementById("newAcMtow").value, 10) || 0;
    const oew = parseInt(document.getElementById("newAcOew").value, 10) || 0;
    const fuelPerNm = parseFloat(document.getElementById("newAcFuel").value);
    const minD = getDefaultMinDistanceNm(rawClass);
    const maxD = parseInt(document.getElementById("newAcMaxD").value, 10);
    if (!name || icao.length < 2 || icao.length > 4) {
        alert("Please enter an aircraft name and a valid 2-4 character ICAO type code.");
        return;
    }
    if (minLength === "" || !Number.isFinite(parseInt(minLength, 10))) {
        alert("Please enter the minimum takeoff distance in feet (use 0 for helicopters).");
        return;
    }
    if (mtow <= 0 || oew <= 0) {
        alert("Please enter MTOW and OEW - these are used for payload and range calculations.");
        return;
    }
    if (!Number.isFinite(fuelPerNm) || fuelPerNm < 0 || (acClass !== "GLIDER" && fuelPerNm <= 0)) {
        alert("Please enter fuel burn (kg/nm). Use 0 for unpowered gliders.");
        return;
    }
    if (!Number.isFinite(maxD) || maxD <= 0 || maxD < minD) {
        alert("Please enter a valid maximum range (nm) from the aircraft manual.");
        return;
    }
    if (oew >= mtow) {
        alert("OEW must be lower than MTOW.");
        return;
    }
    const engineTag = document.getElementById("newAcEngineCount") ? document.getElementById("newAcEngineCount").value : "TWIN_ENGINE";
    const categoryRaw = document.getElementById("newAcRole") ? document.getElementById("newAcRole").value : "JETLINER";
    const configTag = document.getElementById("newAcConfig") ? document.getElementById("newAcConfig").value : "PAX";
    if (rawClass === "WARBIRD" && categoryRaw !== "WARBIRD") {
        alert("Warbird class must use the Warbird mission category.");
        return;
    }
    if (rawClass === "MIL_JET" && categoryRaw !== "FAST_JET") {
        alert("Military Jet class must use the Fast jet / fighter mission category.");
        return;
    }
    if (rawClass === "HELI" && categoryRaw !== "ROTORCRAFT") {
        alert("Helicopter class must use the Helicopter mission category.");
        return;
    }
    if (rawClass === "GLIDER" && categoryRaw !== "GLIDER") {
        alert("Glider class must use the Glider mission category.");
        return;
    }
    if (rawClass === "MIL_JET" && configTag !== "TACTICAL") {
        alert("Military Jet class must use the Tactical primary mission use.");
        return;
    }
    const selectedTags = buildCustomAircraftTags(rawClass, engineTag, categoryRaw, configTag, {
        isMilitary: isMilitary,
        civilOk: document.getElementById("newAcCivilOk") && document.getElementById("newAcCivilOk").checked,
        stol: document.getElementById("newAcStol") && document.getElementById("newAcStol").checked,
        amphibian: document.getElementById("newAcAmphibian") && document.getElementById("newAcAmphibian").checked,
        lightHeli: document.getElementById("newAcLightHeli") && document.getElementById("newAcLightHeli").checked,
        militaryHeli: document.getElementById("newAcMilHeli") && document.getElementById("newAcMilHeli").checked,
        fighter: document.getElementById("newAcFighter") && document.getElementById("newAcFighter").checked,
        singleSeat: document.getElementById("newAcSingleSeat") && document.getElementById("newAcSingleSeat").checked,
        recon: document.getElementById("newAcRecon") && document.getElementById("newAcRecon").checked,
        selfLaunch: document.getElementById("newAcSelfLaunch") && document.getElementById("newAcSelfLaunch").checked,
        selfSustain: document.getElementById("newAcSelfSustain") && document.getElementById("newAcSelfSustain").checked,
        sailplane: document.getElementById("newAcSailplane") && document.getElementById("newAcSailplane").checked,
        electric: document.getElementById("newAcElectric") && document.getElementById("newAcElectric").checked,
        twinSeat: document.getElementById("newAcTwinSeat") && document.getElementById("newAcTwinSeat").checked
    });
    const altDefaults = acClass === "GLIDER"
        ? { minAlt: 4000, maxAlt: 30000, rules: "VFR/Scenic" }
        : acClass === "HELI"
            ? { minAlt: 500, maxAlt: 4000, rules: "VFR/Scenic" }
            : acClass === "JET"
                ? { minAlt: 24000, maxAlt: 41000, rules: "IFR" }
                : (acClass === "GA" || acClass === "WARBIRD")
                    ? { minAlt: 4000, maxAlt: 20000, rules: "VFR/Scenic" }
                    : { minAlt: 15000, maxAlt: 35000, rules: "IFR" };
    let customFleet = JSON.parse(localStorage.getItem("dispatcher_custom_fleet")) || {};
    customFleet[icao] = {
        name: name,
        maxPax: maxPax,
        maxCargo: maxCargo,
        minD: minD,
        maxD: maxD,
        minAlt: altDefaults.minAlt,
        maxAlt: altDefaults.maxAlt,
        rules: altDefaults.rules,
        minRunwayLength: parseInt(minLength, 10),
        class: acClass,
        mtow: mtow,
        oew: oew,
        fuelPerNm: fuelPerNm,
        isMilitary: isMilitary,
        isTactical: rawClass === "MIL_JET" || (rawClass === "WARBIRD" && document.getElementById("newAcFighter") && document.getElementById("newAcFighter").checked),
        tags: selectedTags
    };
    localStorage.setItem("dispatcher_custom_fleet", JSON.stringify(customFleet));
    alert(`${icao} saved to your local fleet.`);
    clearCustomAircraftForm();
    rebuildFleetDropdown();
    updateDatabaseStats();
}
function rebuildActiveDatabase() {
    const liveSeedDB = getMergedSeedAirports();
    const legacyData = localStorage.getItem("dispatcher_custom_airports");
    if (legacyData) {
        try {
            const parsedLegacy = JSON.parse(legacyData);
            if (Array.isArray(parsedLegacy)) {
                const seedIcaos = liveSeedDB.map(a => a.icao);
                const pureCustom = parsedLegacy.filter(a => !seedIcaos.includes(a.icao));
                localStorage.setItem("dispatcher_custom_user_airports", JSON.stringify(pureCustom));
            }
        } catch (e) { /* ignore corrupt legacy custom-airport data */ }
        localStorage.removeItem("dispatcher_custom_airports");
    }
    let customAirports = [];
    try {
        customAirports = JSON.parse(localStorage.getItem("dispatcher_custom_user_airports") || "[]");
        if (!Array.isArray(customAirports)) customAirports = [];
    } catch (e) {
        customAirports = [];
    }
    const allEntries = [...liveSeedDB, ...customAirports];
    const grouped = {};
    allEntries.forEach(entry => {
        if (!grouped[entry.icao]) {
            grouped[entry.icao] = [];
        }
        const isDuplicateLink = grouped[entry.icao].some(existing => 
            existing.linkText && entry.linkText && 
            existing.linkText.toLowerCase() === entry.linkText.toLowerCase()
        );
        if (isDuplicateLink) {
		const existingEntry = grouped[entry.icao].find(existing => 
			existing.linkText && existing.linkText.toLowerCase() === entry.linkText.toLowerCase()
		);
            if (entry.tag === "Both" || existingEntry.tag === "Both") {
                existingEntry.tag = "Both";
            }
        } else {
            grouped[entry.icao].push(entry);
        }
    });
    activeAirportDatabase = Object.keys(grouped).map(icao => {
        const variants = grouped[icao];
        if (variants.length === 1) return variants[0];
        // Same ICAO may list multiple scenery developers — routing uses the first merged
        // entry (loader order); all variants are kept for Job Ticket scenery links only.
        const finalAirport = { ...variants[0] };
        finalAirport.allOptions = variants;
        return finalAirport;
    });
}
function getSelectedAircraftSpec() {
    const type = getSelectedAircraftType();
    return type ? activeFleetSpecs[type] : null;
}
function updateFlightTimeSliderState() {
    const slider = document.getElementById("timeSlider");
    const section = document.querySelector(".slider-section");
    if (!slider) return;
    const spec = getSelectedAircraftSpec();
    const sliderIgnored = spec && isSliderIgnoredAircraft(spec);
    slider.disabled = false;
    syncLongHaulToggleForAircraft();
    if (section) section.classList.toggle("slider-section--rotor-glider", !!sliderIgnored);
    const gliderNotice = document.getElementById("gliderAircraftNotice");
    if (gliderNotice) gliderNotice.style.display = spec && spec.class === "GLIDER" ? "block" : "none";
}
function rebuildFleetDropdown() {
    const customFleet = JSON.parse(localStorage.getItem("dispatcher_custom_fleet")) || {};
    activeFleetSpecs = { ...coreFleetSpecs, ...customFleet };
    const inputEl = document.getElementById("aircraftInput");
    const listEl = document.getElementById("customAircraftList");
    const sortedFleetEntries = Object.entries(activeFleetSpecs).sort((a, b) => a[1].name.localeCompare(b[1].name));
    function renderList(filterText = "") {
        listEl.innerHTML = "";
        const filtered = sortedFleetEntries.filter(entry => 
            entry[1].name.toLowerCase().includes(filterText.toLowerCase())
        );
        if (filtered.length === 0) {
            listEl.style.display = "none";
            return;
        }
        filtered.forEach(([code, spec]) => {
            const item = document.createElement("div");
            item.textContent = spec.name;
            item.onclick = function() {
                inputEl.value = spec.name;
                listEl.style.display = "none";
                updateFlightTimeSliderState();
            };
            listEl.appendChild(item);
        });
        listEl.style.display = "block";
    }
    inputEl.onfocus = () => renderList(inputEl.value);
    inputEl.oninput = (e) => renderList(e.target.value);
    inputEl.onblur = () => updateFlightTimeSliderState();
    if (window._fleetDropdownClickHandler) {
        document.removeEventListener('click', window._fleetDropdownClickHandler);
    }
    window._fleetDropdownClickHandler = function(e) {
        if (e.target !== inputEl && !listEl.contains(e.target)) {
            listEl.style.display = "none";
        }
    };
    document.addEventListener('click', window._fleetDropdownClickHandler);
    syncLongHaulToggleForAircraft();
}
function rebuildAirportDropdown() {
    const inputEl = document.getElementById("depOverrideInput");
    const listEl = document.getElementById("customAirportList");
function renderList(filterText = "") {
        listEl.innerHTML = "";
        // Require at least 2 characters to start searching to prevent lag
        if (filterText.length < 2) {
            listEl.style.display = "none";
            return;
        }
        // Helper to strip special characters and umlauts for searching
        const normalizeStr = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const lowerFilter = normalizeStr(filterText);
        const filtered = activeAirportDatabase.filter(ap => 
            (ap.icao && ap.icao.toLowerCase().includes(lowerFilter)) || 
            (ap.name && normalizeStr(ap.name).includes(lowerFilter))
        ).slice(0, 50); // Limit to 50 results
        if (filtered.length === 0) {
            listEl.style.display = "none";
            return;
        }
        filtered.forEach(ap => {
            const item = document.createElement("div");
            item.textContent = `${ap.icao} - ${ap.name}`;
            item.onclick = function() {
                // When clicked, ONLY put the ICAO code into the box
                inputEl.value = ap.icao; 
                listEl.style.display = "none";
            };
            listEl.appendChild(item);
        });
        listEl.style.display = "block";
    }
    inputEl.onfocus = () => renderList(inputEl.value);
    inputEl.oninput = (e) => renderList(e.target.value);
    if (window._airportDropdownClickHandler) {
        document.removeEventListener('click', window._airportDropdownClickHandler);
    }
    window._airportDropdownClickHandler = function(e) {
        if (e.target !== inputEl && !listEl.contains(e.target)) {
            listEl.style.display = "none";
        }
    };
    document.addEventListener('click', window._airportDropdownClickHandler);
}
function generateRandomCallsign() {
    // Array of popular real-world airline ICAO prefixes
    const prefixes = ["AAL", "BAW", "DAL", "UAL", "RYR", "EZY", "SWA", "AFR", "DLH", "KLM", "QFA", "VIR", "MRD", "JAL", "ANZ", "SIA", "UAE"];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    // Generate a random flight number between 1 and 9999
    const randomNumber = Math.floor(Math.random() * 9999) + 1;
    document.getElementById("callsignInput").value = `${randomPrefix}${randomNumber}`;
}
function exportDatabaseBackup() {
    const backupObject = {
        airports: JSON.parse(localStorage.getItem("dispatcher_custom_user_airports") || "[]"),
        fleet: JSON.parse(localStorage.getItem("dispatcher_custom_fleet") || "{}"),
        logbook: JSON.parse(localStorage.getItem("dispatcher_logbook") || "[]")
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObject, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", "dispatcher_backup.json");
    a.click();
}
function importDatabaseBackup(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const d = JSON.parse(e.target.result);
            if (d.airports) localStorage.setItem("dispatcher_custom_user_airports", JSON.stringify(d.airports));
            if (d.fleet) localStorage.setItem("dispatcher_custom_fleet", JSON.stringify(d.fleet));
            if (d.logbook) localStorage.setItem("dispatcher_logbook", JSON.stringify(d.logbook));
            syncLastArrivalFromLogbook();
            refreshLastArrivalDepField();
            rebuildActiveDatabase();
            rebuildFleetDropdown();
            updateDatabaseStats();
            if (typeof updateLogbookUI === 'function') updateLogbookUI();
            alert("Backup imported successfully!");
        } catch (err) {
            alert("Import failed: invalid backup file.");
        }
    };
    reader.readAsText(file);
}
function resetCustomDatabase() {
    if (confirm("Are you sure you want to completely wipe all custom airports and aircraft from your local database? This cannot be undone.")) {
        localStorage.removeItem("dispatcher_custom_user_airports");
        localStorage.removeItem("dispatcher_custom_airports");
        localStorage.removeItem("dispatcher_custom_fleet");
        rebuildActiveDatabase();
        rebuildFleetDropdown();
        updateDatabaseStats();
        updateManageCustomDbUI();
        alert("Custom databases have been successfully reset. Your Owned Airports list and Logbook were kept intact.");
    }
}
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3440.065; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * R;
}
const RESTRICTED_JET_BASE_TYPES = {
    EGLC: ["A319", "E190", "E195", "RJ70", "RJ85", "RJ1H", "RJ1F", "B461", "B462", "B463", "F70"],
    EGNS: ["A319", "E190", "E195", "RJ70", "RJ85", "RJ1H", "RJ1F", "B461", "B462", "B463"],
    SBRJ: ["A319", "E190", "E195"]
};
const RESTRICTED_AIRPORT_TURBO_MAX_MTOW = 25000;
const RESTRICTED_AIRPORT_OPERATIONAL_MTOW = {
    EGLC: 68000,
    EGNS: 75500,
    SBRJ: 75500
};
const LOWI_NARROWBODY_JETLINERS = ["B736", "B737", "B738", "B738_BDSF", "B738_BCF", "A319", "A320", "A321"];
const LOWI_UNRESTRICTED_CLASSES = ["GA", "TURBO", "HELI", "WARBIRD", "BIZ JET"];
const LOWI_LARGE_PROPLINER_MTOW = 40000;
const MIN_ASSIGNED_PAYLOAD_KG = 25;

function finalizeAssignedPayloadKg(kg, hardLimit) {
    if (hardLimit <= 0) return 0;
    if (hardLimit < MIN_ASSIGNED_PAYLOAD_KG) return Math.min(hardLimit, kg);
    return Math.min(hardLimit, Math.max(MIN_ASSIGNED_PAYLOAD_KG, kg));
}
function passesLowiAirport(type, spec) {
    if (LOWI_UNRESTRICTED_CLASSES.includes(spec.class)) {
        if (spec.mtow > LOWI_LARGE_PROPLINER_MTOW) return false;
        return true;
    }
    if (spec.class === "JET") {
        if (spec.tags && spec.tags.includes("JETLINER")) {
            return LOWI_NARROWBODY_JETLINERS.includes(type);
        }
        if (spec.tags && (spec.tags.includes("HEAVY") || spec.tags.includes("BOMBER"))) return false;
        if (spec.mtow > 50000) return false;
        return true;
    }
    return true;
}
function isLowiNarrowbodyJetliner(type, spec) {
    return spec.class === "JET" && spec.tags && spec.tags.includes("JETLINER") && LOWI_NARROWBODY_JETLINERS.includes(type);
}
function matchesApprovedAircraftType(type, spec, approvedBases) {
    const simbrief = (spec.simbriefIcao || type || "").toUpperCase();
    const fleetKey = (type || "").toUpperCase();
    for (const base of approvedBases) {
        const baseKey = base.toUpperCase();
        if (fleetKey === baseKey || simbrief === baseKey) return true;
        const baseSpec = activeFleetSpecs[base];
        if (baseSpec) {
            const baseSimbrief = (baseSpec.simbriefIcao || base).toUpperCase();
            if (fleetKey === baseSimbrief || simbrief === baseSimbrief) return true;
        }
    }
    return false;
}
function getRestrictedAirportRules(icao) {
    return RESTRICTED_JET_BASE_TYPES[(icao || "").trim().toUpperCase()] || null;
}
function passesRestrictedAirportTurboprop(spec) {
    if (spec.mtow > RESTRICTED_AIRPORT_TURBO_MAX_MTOW) return false;
    if (spec.tags && spec.tags.includes("HEAVY")) return false;
    if (spec.tags && spec.tags.includes("MILITARY_TRANSPORT") && spec.mtow > RESTRICTED_AIRPORT_TURBO_MAX_MTOW) return false;
    return true;
}
function getRestrictedRouteOperationalMtowCap(origin, destination, type, spec) {
    const airports = [origin, destination];
    let cap = null;
    for (const ap of airports) {
        const jetBases = getRestrictedAirportRules(ap.icao);
        if (!jetBases) continue;
        if (spec.class !== "JET" || !matchesApprovedAircraftType(type, spec, jetBases)) continue;
        const airportCap = RESTRICTED_AIRPORT_OPERATIONAL_MTOW[ap.icao];
        if (typeof airportCap === "number") {
            cap = cap === null ? airportCap : Math.min(cap, airportCap);
        }
    }
    return cap;
}
function applyRunwayFieldExceptions(ap, type, spec, isAllowedType, meetsLength) {
    let allowed = isAllowedType;
    let lengthOk = meetsLength;
    const jetBases = getRestrictedAirportRules(ap.icao);
    if (jetBases) {
        if (spec.class === "JET") {
            if (matchesApprovedAircraftType(type, spec, jetBases)) {
                allowed = true;
                lengthOk = true;
            } else {
                allowed = false;
            }
        } else if (spec.class === "TURBO") {
            if (!passesRestrictedAirportTurboprop(spec)) {
                allowed = false;
            }
        } else if ((spec.class === "GA" || spec.class === "WARBIRD") && spec.mtow > RESTRICTED_AIRPORT_TURBO_MAX_MTOW) {
            allowed = false;
        }
    }
    if (ap.icao === "LOWI") {
        if (!passesLowiAirport(type, spec)) {
            allowed = false;
        } else if (isLowiNarrowbodyJetliner(type, spec)) {
            allowed = true;
            lengthOk = true;
        }
    }
    return { isAllowedType: allowed, meetsLength: lengthOk };
}
function checkAirportForAircraft(ap, spec, type, depOverride, forceMilitaryBases, isContractorMode) {
    const overrideIcao = (depOverride || "").trim().toUpperCase();
    const apIcao = (ap.icao || "").trim().toUpperCase();
    if (spec.class === "GLIDER" && !isGliderSuitableAirport(ap, spec)) {
        return getGliderUnsuitabilityReason(ap, spec) || "runway_length";
    }
    const hasMilitaryAccess = hasMilitaryAirportAccess(spec, isContractorMode, forceMilitaryBases);
    if (ap.isMilitary && !hasMilitaryAccess && apIcao !== overrideIcao) return "military_access";
    if (forceMilitaryBases && !ap.isMilitary && apIcao !== overrideIcao) return "military_only_mode";
    let isAllowedType = spec.class === "GLIDER" ? isGliderSuitableAirport(ap, spec) : getAllowedClassesForRunway(ap.rwy).includes(spec.class);
    let meetsLength = ap.length ? (ap.length >= spec.minRunwayLength) : true;
    const exceptions = applyRunwayFieldExceptions(ap, type, spec, isAllowedType, meetsLength);
    isAllowedType = exceptions.isAllowedType;
    meetsLength = exceptions.meetsLength;
    if (ap.icao === "LOWI" && !passesLowiAirport(type, spec)) {
        return "lowi_restrictions";
    }
    if (getRestrictedAirportRules(ap.icao)) {
        if (spec.class === "JET" && !matchesApprovedAircraftType(type, spec, getRestrictedAirportRules(ap.icao))) {
            return "restricted_airport";
        }
        if (spec.class === "TURBO" && !passesRestrictedAirportTurboprop(spec)) {
            return "restricted_airport";
        }
        if ((spec.class === "GA" || spec.class === "WARBIRD") && spec.mtow > RESTRICTED_AIRPORT_TURBO_MAX_MTOW) {
            return "restricted_airport";
        }
    }
    if (!isAllowedType) return "runway_class";
    if (!meetsLength) return "runway_length";
    return null;
}
function buildRouteFailureMessage(depOverride, type, spec, validAirports, departureAvailable, forceMilitaryBases, isContractorMode) {
    if (depOverride) {
        const depAp = activeAirportDatabase.find(ap => ap.icao && ap.icao.trim().toUpperCase() === depOverride);
        if (depAp) {
            const blockReason = checkAirportForAircraft(depAp, spec, type, depOverride, forceMilitaryBases, isContractorMode);
            if (blockReason === "runway_length") {
                if (spec.class === "GLIDER") {
                    return formatGliderUnsuitabilityMessage(depOverride, "runway_length");
                }
                return "The runway is too short for your currently selected aircraft. Choose another aircraft if you would like to depart from this airport.";
            }
            if (blockReason === "heli") {
                return formatGliderUnsuitabilityMessage(depOverride, "heli");
            }
            if (blockReason === "runway_class") {
                return `The runway category at ${depOverride} does not support your selected aircraft. Choose another aircraft or departure airport.`;
            }
            if (blockReason === "lowi_restrictions") {
                return `LOWI (Innsbruck) cannot be used with this aircraft due to fuel, payload, and terrain restrictions. Choose an approved airframe or a different departure airport.`;
            }
            if (blockReason === "restricted_airport") {
                return `${depOverride} has steep-approach / noise / runway restrictions. Only approved regional jets (and suitable smaller aircraft) may operate there. Choose a different aircraft or airport.`;
            }
            if (blockReason === "military_access") {
                return `${depOverride} is a military airbase. Enable contractor mode, select a military aircraft, or choose a different departure airport.`;
            }
            if (blockReason === "military_only_mode") {
                return `Military airbases only is enabled, but ${depOverride} is not a military airbase. Clear that option or choose a military departure airport.`;
            }
        }
        const depIsValid = departureAvailable;
        if (depIsValid) {
            const scope = getRoutingScope();
            if (scope !== "worldwide") {
                const longHaulHint = isLongHaulModeEnabled()
                    ? ""
                    : " enabling long-haul flights,";
                return `No destinations were found within range from ${depOverride} for your aircraft, flight time, and routing region. Try${longHaulHint} increasing flight time, choosing Worldwide routing, or leave departure blank for a random route.`;
            }
            return `No destinations were found within range from ${depOverride} for your aircraft and flight time. Try increasing flight time, or leave departure blank for a random route.`;
        }
    }
    if (validAirports.length === 0) {
        if (depOverride) {
            const depAp = activeAirportDatabase.find(ap => ap.icao && ap.icao.trim().toUpperCase() === depOverride);
            if (depAp && depAp.icao === "LOWI" && !passesLowiAirport(type, spec)) {
                return `LOWI (Innsbruck) cannot be used with this aircraft due to fuel, payload, and terrain restrictions. Choose an approved airframe or a different departure airport.`;
            }
        }
        if (spec.class === "GLIDER") {
            if (getGliderDatabaseIcaos().size === 0) {
                return "Glider airport database failed to load. Hard-refresh the page (Ctrl+F5) to reload airports-asobo-db.js.";
            }
            if (forceMilitaryBases) {
                return "No glider strips are available while Military airbases only is enabled. Clear that option to use glider fields.";
            }
            return "No airports meet this aircraft's runway length requirement with the current settings.";
        }
        if (getMergedSeedAirports().length === 0) {
            return "Airport databases failed to load (0 airports in memory). Hard-refresh the page (Ctrl+F5). If you moved or renamed files, open index.html from the VECTOR NEW FORMAT folder.";
        }
        return "No airports in the database match your aircraft's runway and airfield requirements with the current settings.";
    }
    return "No valid routes were found for your aircraft and current settings. Try adjusting flight time, military options, or choosing a different airframe.";
}
function passesMissionAircraftRole(m, spec) {
    if (isFreightMission(m)) {
        const tags = spec.tags || [];
        if (!tags.includes("FREIGHTER")) return false;
        if ((spec.maxCargo || 0) <= 0) return false;
    }
    if (isPassengerMission(m)) {
        const tags = spec.tags || [];
        if ((spec.maxPax || 0) <= 0) return false;
        if (!tags.includes("PAX")) return false;
    }
    const requiredTags = m.requiredTags || [];
    if (requiredTags.includes("PAX") && !requiredTags.includes("FREIGHTER") && (spec.maxPax || 0) <= 0) {
        return false;
    }
    return true;
}
function passesTemplateMtowCap(m, searchClass, spec) {
    if (!m.maxMTOW) return true;
    if (m.maxMTOWAppliesTo && !m.maxMTOWAppliesTo.includes(searchClass)) return true;
    return spec.mtow <= m.maxMTOW;
}
function passesTemplateMinPaxSeats(m, searchClass, spec) {
    if (!m.minPaxSeats) return true;
    if (m.minPaxSeatsAppliesTo && !m.minPaxSeatsAppliesTo.includes(searchClass)) return true;
    return (spec.maxPax || 0) >= m.minPaxSeats;
}
function isMilitaryHelicopterMission(m) {
    if (!m) return false;
    if (m.type === 29 || m.type === 30) return true;
    if (m.pool === "helicopterOps-MIL") return true;
    const classes = m.allowedClasses;
    return !!(classes && classes.length === 1 && classes[0] === "HELI" && m.militaryOnly);
}
function passesMissionTemplateAircraft(m, type, searchClass, isContractorMode) {
    if (isMilitaryHelicopterMission(m) && searchClass !== "HELI") return false;
    if (isContractorMode && m.militaryOnly && !m.tacticalOnly && !isMilitaryHelicopterMission(m)) return true;
    const classes = m.allowedClasses;
    const aircraft = m.allowedAircraft;
    const hasClassRule = classes && classes.length > 0;
    const hasAircraftRule = aircraft && aircraft.length > 0;
    if (!hasClassRule && !hasAircraftRule) return true;
    // allowedClasses = eligible class list; allowedAircraft = type-only missions (OR, not AND).
    // e.g. type 4 (PA24 only) or type 25 (DC6B only) with no class rule.
    if (hasClassRule && hasAircraftRule) {
        return classes.includes(searchClass) || aircraft.includes(type);
    }
    if (hasAircraftRule) return aircraft.includes(type);
    return classes.includes(searchClass);
}
function passesHardMissionLocks(m, type, searchClass, spec, origin, isContractorMode) {
    if (!passesMissionTemplateAircraft(m, type, searchClass, isContractorMode)) return false;
    if (searchClass === "BIZ JET" && type !== "LJ35") {
        if (isFreightMission(m)) return false;
        const requiredTags = m.requiredTags || [];
        if (requiredTags.includes("MEDEVAC")) return false;
    }
    if (m.minCargo && spec.maxCargo < m.minCargo) return false;
    if (!passesTemplateMtowCap(m, searchClass, spec)) return false;
    if (!passesTemplateMinPaxSeats(m, searchClass, spec)) return false;
    if (m.excludedAircraft && m.excludedAircraft.includes(type)) return false;
    if (!passesMissionAircraftRole(m, spec)) return false;
    if (m.requiredDep) {
        if (Array.isArray(m.requiredDep)) {
            if (!m.requiredDep.includes(origin.icao)) return false;
        } else if (origin.icao !== m.requiredDep) {
            return false;
        }
    }
    return true;
}
function isMilitaryMissionRestricted(spec) {
    if (!spec.isMilitary) return false;
    if (spec.class === "WARBIRD") return false;
    const tags = spec.tags || [];
    if (tags.includes("CIVIL_OK")) return false;
    if (spec.class === "HELI") return tags.includes("MILITARY_HELI");
    return true;
}
function passesMissionContextFilter(m, spec, origin, isContractorMode) {
    const isTacticalAirframe = !!spec.isTactical;
    if (isMilitaryHelicopterMission(m) && spec.class !== "HELI") return false;
    if (m.tacticalOnly && !isTacticalAirframe) return false;
    if (m.civilianOnly && spec.isMilitary) return false;
    if (m.militaryOnly && !spec.isMilitary && !isContractorMode) return false;
    if (!m.militaryOnly && isMilitaryMissionRestricted(spec)) return false;
    const isFreight = isFreightMission(m);
    if (origin && origin.isMilitary && !m.militaryOnly && !isFreight) return false;
    if (isContractorMode && !spec.isMilitary && origin) {
        if (m.militaryOnly && !origin.isMilitary) return false;
    }
    return true;
}
function scenarioHasExcludedTags(s, spec) {
    if (s.excludedTags && spec.tags && s.excludedTags.some(tag => spec.tags.includes(tag))) return true;
    if (s.excludedGaTags && spec.class === "GA" && spec.tags && s.excludedGaTags.some(tag => spec.tags.includes(tag))) return true;
    return false;
}
function scenarioAllowsAircraft(s, type, spec) {
    if (s.allowedAircraft && s.allowedAircraft.includes(type)) return true;
    if (s.allowedClasses && spec.class && s.allowedClasses.includes(spec.class)) return true;
    if (!s.allowedAircraft && !s.allowedClasses) return true;
    return false;
}
function getExcludedScenarioImgIdsForPool(pool, aircraftType, spec) {
    const excluded = new Set();
    if (!Array.isArray(pool)) return excluded;
    pool.forEach(s => {
        if (!scenarioAllowsAircraft(s, aircraftType, spec)) {
            excluded.add(s.imgId);
        }
        if (s.excludedAircraft && s.excludedAircraft.includes(aircraftType)) {
            excluded.add(s.imgId);
        }
        if (scenarioHasExcludedTags(s, spec)) {
            excluded.add(s.imgId);
        }
    });
    return excluded;
}
function scenarioPassesHardLocks(s, type, spec, excludedImgIds) {
    if (excludedImgIds.has(s.imgId)) return false;
    if (s.minCargo && spec.maxCargo < s.minCargo) return false;
    if (s.excludedAircraft && s.excludedAircraft.includes(type)) return false;
    if (s.requiredTags && (!spec.tags || !s.requiredTags.every(tag => spec.tags.includes(tag)))) return false;
    if (scenarioHasExcludedTags(s, spec)) return false;
    if (!scenarioAllowsAircraft(s, type, spec)) return false;
    return true;
}
function filterScenarioPool(pool, type, spec, excludedImgIds) {
    const eligible = pool.filter(s => scenarioPassesHardLocks(s, type, spec, excludedImgIds));
    if (eligible.length > 0) return eligible;
    return pool.filter(s => {
        if (excludedImgIds.has(s.imgId) || s.minCargo || s.requiredTags || s.allowedAircraft || s.allowedClasses) return false;
        if (s.excludedAircraft && s.excludedAircraft.includes(type)) return false;
        if (scenarioHasExcludedTags(s, spec)) return false;
        return true;
    });
}
function pickWeightedRandom(items, defaultWeight = 10, getWeight) {
    if (!items.length) return null;
    const resolveWeight = getWeight || ((item) => item.weight || defaultWeight);
    const totalWeight = items.reduce((sum, item) => sum + resolveWeight(item), 0);
    let randomNum = Math.random() * totalWeight;
    for (let item of items) {
        const w = resolveWeight(item);
        if (randomNum < w) return item;
        randomNum -= w;
    }
    return items[0];
}
function filterWithRecentGuard(items, recentIds, getId, maxRecent = 2) {
    if (!items.length) return items;
    const recent = recentIds.slice(-maxRecent);
    let guarded = items.filter(item => !recent.includes(getId(item)));
    if (guarded.length === 0 && recent.length > 0) {
        const lastId = recent[recent.length - 1];
        guarded = items.filter(item => getId(item) !== lastId);
    }
    return guarded.length > 0 ? guarded : items;
}
function applyCivilOkWeighting(missions, spec, searchClass) {
    const defaultWeight = 10;
    const baseWeight = (m) => (searchClass === "GA" ? defaultWeight : (m.weight || defaultWeight));
    if (!spec.isMilitary || !spec.tags || !spec.tags.includes("CIVIL_OK")) {
        return missions.map(m => ({ mission: m, weight: baseWeight(m) }));
    }
    const mil = missions.filter(m => m.militaryOnly);
    const civ = missions.filter(m => !m.militaryOnly);
    if (mil.length === 0 || civ.length === 0) {
        return missions.map(m => ({ mission: m, weight: baseWeight(m) }));
    }
    const sumMil = mil.reduce((s, m) => s + baseWeight(m), 0);
    const sumCiv = civ.reduce((s, m) => s + baseWeight(m), 0);
    const targetMil = 0.65;
    const milMult = (targetMil * sumCiv) / ((1 - targetMil) * sumMil);
    return missions.map(m => ({
        mission: m,
        weight: m.militaryOnly ? baseWeight(m) * milMult : baseWeight(m)
    }));
}
function applyContractorMissionWeighting(weightedMissions, isContractorMode) {
    if (!isContractorMode) return weightedMissions;
    return weightedMissions.map(entry => ({
        mission: entry.mission,
        weight: entry.mission.militaryOnly ? entry.weight * 4 : entry.weight * 0.35
    }));
}
function filterRoutesForContractorMission(candidatePairs, mission, spec) {
    if (!mission) return candidatePairs;
    let matched;
    if (mission.militaryOnly) {
        matched = candidatePairs.filter(pair => pair.src.isMilitary);
        if (matched.length) {
            const bothMilitary = matched.filter(pair => pair.dst.isMilitary);
            if (bothMilitary.length) matched = bothMilitary;
        }
    } else {
        matched = candidatePairs.filter(pair => !pair.src.isMilitary && !pair.dst.isMilitary);
    }
    if (!matched.length) return matched;
    if (mission.isLocal) {
        matched = matched.filter(pair => normalizeIcao(pair.src.icao) === normalizeIcao(pair.dst.icao));
    } else if (spec.class === "HELI") {
        matched = matched.filter(pair => normalizeIcao(pair.src.icao) !== normalizeIcao(pair.dst.icao));
    } else {
        matched = matched.filter(pair => normalizeIcao(pair.src.icao) !== normalizeIcao(pair.dst.icao));
    }
    return matched;
}
function buildFilteredMissionList(spec, type, searchClass, origin, isContractorMode, longHaul, isLocalFlight) {
    const originForLocks = origin || { icao: "", isMilitary: false };
    let filteredMissions = missionMatrix.filter(m => {
        if (!missionAllowedForHaulMode(m, longHaul)) return false;
        if (!passesHardMissionLocks(m, type, searchClass, spec, originForLocks, isContractorMode)) return false;
        if (m.requiredDep && !origin) return false;
        if (m.excludedTags && spec.tags && m.excludedTags.some(tag => spec.tags.includes(tag))) return false;
        if (m.requiredTags && (!spec.tags || !m.requiredTags.every(tag => spec.tags.includes(tag)))) return false;
        if (origin && !passesMissionContextFilter(m, spec, origin, isContractorMode)) return false;
        if (!origin && isContractorMode && !spec.isMilitary) {
            if (m.civilianOnly && spec.isMilitary) return false;
            if (m.militaryOnly && !isContractorMode) return false;
            if (!m.militaryOnly && isMilitaryMissionRestricted(spec)) return false;
            if (isMilitaryHelicopterMission(m) && spec.class !== "HELI") return false;
            if (m.tacticalOnly && !spec.isTactical) return false;
        } else if (!origin) {
            if (m.civilianOnly && spec.isMilitary) return false;
            if (m.militaryOnly && !spec.isMilitary && !isContractorMode) return false;
            if (!m.militaryOnly && isMilitaryMissionRestricted(spec)) return false;
            if (isMilitaryHelicopterMission(m) && spec.class !== "HELI") return false;
            if (m.tacticalOnly && !spec.isTactical) return false;
        }
        return true;
    });
    if (filteredMissions.length < 5 && origin) {
        const strictOverrides = filteredMissions.filter(m => m.requiredDep);
        const failsafeTemplates = missionMatrix.filter(m => {
            if (!missionAllowedForHaulMode(m, longHaul)) return false;
            if (!m.pool) return false;
            if (!passesHardMissionLocks(m, type, searchClass, spec, originForLocks, isContractorMode)) return false;
            if (m.requiredTags && (!spec.tags || !m.requiredTags.every(tag => spec.tags.includes(tag)))) return false;
            if (!passesMissionContextFilter(m, spec, origin, isContractorMode)) return false;
            if (m.excludedTags && spec.tags && m.excludedTags.some(tag => spec.tags.includes(tag))) return false;
            return true;
        });
        const seenTypes = new Set();
        filteredMissions = [];
        for (const mission of [...strictOverrides, ...failsafeTemplates]) {
            if (!seenTypes.has(mission.type)) {
                seenTypes.add(mission.type);
                filteredMissions.push(mission);
            }
        }
    }
    if (spec.class === "HELI" && isLocalFlight) {
        const localMissions = filteredMissions.filter(m => m.isLocal);
        if (localMissions.length > 0) filteredMissions = localMissions;
    } else if (spec.class === "HELI" && isLocalFlight === false) {
        filteredMissions = filteredMissions.filter(m => !m.isLocal);
    }
    if (filteredMissions.length === 0 && origin) {
        filteredMissions = missionMatrix.filter(m => {
            if (!missionAllowedForHaulMode(m, longHaul)) return false;
            if (!passesHardMissionLocks(m, type, searchClass, spec, originForLocks, isContractorMode)) return false;
            if (m.excludedTags && spec.tags && m.excludedTags.some(tag => spec.tags.includes(tag))) return false;
            if (m.requiredTags && (!spec.tags || !m.requiredTags.every(tag => spec.tags.includes(tag)))) return false;
            if (!passesMissionContextFilter(m, spec, origin, isContractorMode)) return false;
            return true;
        });
    }
    if (filteredMissions.length === 0 && origin) {
        filteredMissions = missionMatrix.filter(m => {
            if (!missionAllowedForHaulMode(m, longHaul)) return false;
            if (!passesHardMissionLocks(m, type, searchClass, spec, originForLocks, isContractorMode)) return false;
            if (m.excludedTags && spec.tags && m.excludedTags.some(tag => spec.tags.includes(tag))) return false;
            if (m.requiredTags && (!spec.tags || !m.requiredTags.every(tag => spec.tags.includes(tag)))) return false;
            if (m.civilianOnly && spec.isMilitary) return false;
            if (m.militaryOnly && !spec.isMilitary && !isContractorMode) return false;
            if (isMilitaryHelicopterMission(m) && spec.class !== "HELI") return false;
            return true;
        });
    }
    if (typeof isLocalFlight === "boolean") {
        filteredMissions = filteredMissions.filter(m => !m.isLocal || isLocalFlight);
        if (spec.class === "HELI" && isLocalFlight) {
            const localMissions = filteredMissions.filter(m => m.isLocal);
            if (localMissions.length > 0) filteredMissions = localMissions;
        }
    }
    return filteredMissions;
}
function pickWeightedMissionEntry(weightedMissions) {
    if (!weightedMissions.length) return null;
    let totalWeight = weightedMissions.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) return weightedMissions[0];
    let randomNum = Math.random() * totalWeight;
    for (let entry of weightedMissions) {
        if (randomNum < entry.weight) return entry;
        randomNum -= entry.weight;
    }
    return weightedMissions[0];
}
function buildContractorRoutePool(candidatePairs, preferOwned) {
    let weightedRoutePool = [];
    if (preferOwned) {
        const ownedList = getOwnedAirportList();
        if (ownedList.length > 0) {
            candidatePairs.forEach(pair => {
                let score = 0;
                if (ownedList.includes(pair.src.icao)) score += 1;
                if (ownedList.includes(pair.dst.icao)) score += 1;
                weightedRoutePool.push(pair);
                if (score === 1) {
                    for (let i = 0; i < 4; i++) weightedRoutePool.push(pair);
                } else if (score === 2) {
                    for (let i = 0; i < 14; i++) weightedRoutePool.push(pair);
                }
            });
        }
    }
    if (weightedRoutePool.length === 0) weightedRoutePool = [...candidatePairs];
    return weightedRoutePool;
}
function dispatchContractorMissionFirst(candidatePairs, spec, type, searchClass, isContractorMode, longHaul, routingTargetMins, targetDistNm, longHaulMode, preferOwned) {
    let missionPool = buildFilteredMissionList(spec, type, searchClass, null, isContractorMode, longHaul, null);
    if (!missionPool.length) return null;
    const triedTypes = new Set();
    for (let attempt = 0; attempt < 12; attempt++) {
        const remaining = missionPool.filter(m => !triedTypes.has(m.type));
        if (!remaining.length) break;
        const selectionPoolWithGuard = filterWithRecentGuard(remaining, lastMissions, m => m.type, 1);
        const weightedMissions = applyContractorMissionWeighting(
            applyCivilOkWeighting(selectionPoolWithGuard, spec, searchClass),
            isContractorMode
        );
        const pickedEntry = pickWeightedMissionEntry(weightedMissions);
        if (!pickedEntry) break;
        const mission = pickedEntry.mission;
        triedTypes.add(mission.type);
        const missionRoutes = filterRoutesForContractorMission(candidatePairs, mission, spec);
        if (!missionRoutes.length) continue;
        const weightedRoutePool = buildContractorRoutePool(missionRoutes, preferOwned);
        const selectedRoute = pickRouteByTimeFit(weightedRoutePool, routingTargetMins, targetDistNm, spec, type, longHaulMode);
        if (!selectedRoute) continue;
        return { mission, route: selectedRoute };
    }
    return null;
}
function isSpiritualGuruScenario(scenario) {
    return !!(scenario && scenario.payload && scenario.payload.includes("spiritual guru"));
}
function getScenarioPickWeight(scenario, aircraftType, searchClass) {
    if (searchClass === "GA") {
        return isSpiritualGuruScenario(scenario) ? 2 : 10;
    }
    let weight = scenario.weight || 10;
    if (scenario.preferredAircraft && scenario.preferredAircraft.includes(aircraftType)) {
        const celebrityVip = searchClass === "BIZ JET"
            && (scenario.requiredTags || []).includes("VIP");
        const mult = celebrityVip && typeof CELEBRITY_VIP_SCENARIO_WEIGHT_MULT !== "undefined"
            ? CELEBRITY_VIP_SCENARIO_WEIGHT_MULT
            : 3;
        weight *= mult;
    }
    return weight;
}
function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}
function formatScenery(apt) {
    function makeLink(item) {
        const text = item.linkText ? item.linkText : 'Store';
        return item.url ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer" class="scenery-link">${text}</a>` : text;
    }
    const holdsHandcrafted = apt.allOptions 
        ? apt.allOptions.some(v => v.tag === 'Hand-Crafted' || v.tag === 'Both')
        : (apt.tag === 'Hand-Crafted' || apt.tag === 'Both');
    let thirdPartyLinks = [];
    if (apt.allOptions) {
        apt.allOptions.forEach(v => {
            if (v.tag === 'Third Party' || v.tag === 'Both') {
                thirdPartyLinks.push(makeLink(v));
            }
        });
    } else if (apt.tag === 'Third Party' || apt.tag === 'Both') {
        thirdPartyLinks.push(makeLink(apt));
    }
    if (holdsHandcrafted && thirdPartyLinks.length > 0) {
        return `${apt.icao} - Hand-Crafted / ${thirdPartyLinks.join(' OR ')}`;
    } else if (thirdPartyLinks.length > 0) {
        return `${apt.icao} - ${thirdPartyLinks.join(' OR ')}`;
    } else if (apt.tag === 'Asobo Detailed Airports' || apt.tag === 'MSFS 2024 Detailed Small Airports') {
        return `${apt.icao} - MSFS Small Detailed`;
    } else if (apt.tag === 'Asobo Gliderport') {
        return `${apt.icao} - MSFS Gliderport`;
    } else {
        return `${apt.icao} - Hand-Crafted`;
    }
}
// START OF DISPATCH FLIGHT FUNCTION
function dispatchFlight() {
    const callsignRaw = document.getElementById("callsignInput").value.trim().toUpperCase();
    const depOverride = document.getElementById("depOverrideInput").value.trim().toUpperCase();
    rebuildActiveDatabase();
    if (getMergedSeedAirports().length === 0) {
        alert("Airport databases failed to load (0 airports in memory). Hard-refresh the page (Ctrl+F5).");
        return;
    }
    if (depOverride) {
        const searchIcao = depOverride.trim().toUpperCase();
        const depAp = activeAirportDatabase.find(ap => ap.icao && ap.icao.trim().toUpperCase() === searchIcao);
        if (!depAp) {
            alert(`Error: The airport ${searchIcao} was not found. Please check the ICAO code.`);
            return;
        }
    }
    if (!callsignRaw) {
        alert("Please supply a Callsign to proceed.");
        return;
    }
    const selectedName = document.getElementById("aircraftInput").value.trim();
    const type = Object.keys(activeFleetSpecs).find(key => activeFleetSpecs[key].name === selectedName);
    const targetMins = parseInt(document.getElementById("timeSlider").value, 10);
    if (!type) {
        alert("Please select a valid aircraft from the searchable list.");
        return;
    }
    
    let spec = JSON.parse(JSON.stringify(activeFleetSpecs[type]));
    const isContractorMode = document.getElementById("contractorToggle").checked;
    const militaryBasesToggle = document.getElementById("militaryBaseToggle").checked;
    const contractorMissionFirst = usesContractorMissionFirstRouting(isContractorMode, spec);
    const routingMilitaryOnly = getRoutingMilitaryOnlyMode(isContractorMode, spec, militaryBasesToggle);
    const routingScope = getRoutingScope();
    const longHaulRequested = isLongHaulModeEnabled();
    if (longHaulRequested && !canAircraftUseLongHaulMode(spec, type)) {
        alert(`Long haul flights are not available for this aircraft. Maximum block time is approximately ${formatBlockTimeHoursMinutes(getMaxAchievableBlockMinutes(spec, type))}.`);
        return;
    }
    const longHaul = longHaulRequested && canAircraftUseLongHaulMode(spec, type);
    const routingTargetMins = longHaul ? 0 : targetMins;

    if (depOverride && spec.class === "GLIDER") {
        const depAp = activeAirportDatabase.find(ap => ap.icao && ap.icao.trim().toUpperCase() === depOverride);
        if (depAp) {
            const reason = getGliderUnsuitabilityReason(depAp, spec);
            if (reason) {
                alert(formatGliderUnsuitabilityMessage(depOverride, reason));
                return;
            }
        }
    }
    
    const { departureAirports, destinationAirports } = buildDispatchRoutingPools(
        depOverride, routingScope, spec, type, routingMilitaryOnly, isContractorMode
    );
    const validAirports = depOverride
        ? departureAirports.concat(
            destinationAirports.filter(dst => !departureAirports.some(src => normalizeIcao(src.icao) === normalizeIcao(dst.icao)))
        )
        : destinationAirports;
    const departureAvailable = departureAirports.length > 0;

    const { minTarget, maxTarget, relaxedMin, relaxedMax, targetDist } = getRouteDistanceLimits(
        routingTargetMins, spec, type, longHaul, depOverride
    );
    const targetDistNm = targetDist;
    
    let candidatePairs = [];
    let usedRelaxedRouting = false;
    const routedAsGlider = isGliderAircraft(spec);
    if (routedAsGlider) {
        candidatePairs = buildGliderRoutePairs(validAirports, depOverride, spec);
    } else {
        const routeSources = depOverride ? departureAirports : destinationAirports;
        const routeResult = buildJetRoutePairs(
            routeSources, destinationAirports, depOverride, spec,
            minTarget, maxTarget, relaxedMin, relaxedMax, longHaul,
            routingTargetMins, type
        );
        candidatePairs = routeResult.candidatePairs;
        usedRelaxedRouting = routeResult.usedRelaxedRouting;
    }
    if (longHaul && candidatePairs.length) {
        candidatePairs = candidatePairs.filter(p => passesLongHaulDurationBand(p.dist, spec, type));
    }
    if (candidatePairs.length === 0) {
        alert(buildRouteFailureMessage(depOverride, type, spec, validAirports, departureAvailable, routingMilitaryOnly, isContractorMode));
        return;
    }
    
    if (routingMilitaryOnly) {
        candidatePairs.forEach(pair => {
            let score = 0;
            if (pair.src.isMilitary) score += 1;
            if (pair.dst.isMilitary) score += 1;
            pair.milScore = score;
        });
        const maxMilScore = Math.max(...candidatePairs.map(p => p.milScore || 0));
        if (maxMilScore > 0) {
            candidatePairs = candidatePairs.filter(p => p.milScore === maxMilScore);
        }
    }

    if (routedAsGlider && candidatePairs.length > 0) {
        candidatePairs.forEach(pair => { pair.gliderScore = gliderRoutePreferenceScore(pair); });
        const maxGliderScore = Math.max(...candidatePairs.map(p => p.gliderScore || 0));
        if (maxGliderScore > 0) {
            const preferredGlider = candidatePairs.filter(p => p.gliderScore === maxGliderScore);
            if (preferredGlider.length > 0) candidatePairs = preferredGlider;
        }
    }
    
    const preferOwned = document.getElementById("preferOwnedToggle").checked;
    const searchClass = spec.class || "GA";
    let selectedRoute;
    let preChosenMission = null;

    if (contractorMissionFirst) {
        const contractorPick = dispatchContractorMissionFirst(
            candidatePairs, spec, type, searchClass, isContractorMode, longHaul,
            routingTargetMins, targetDistNm, longHaul, preferOwned
        );
        if (!contractorPick) {
            alert("No valid contractor routing found. Military missions require military airbases; civilian missions require civilian airports. Try adjusting flight time, routing region, or departure airport.");
            return;
        }
        preChosenMission = contractorPick.mission;
        selectedRoute = contractorPick.route;
    } else {
        const weightedRoutePool = buildContractorRoutePool(candidatePairs, preferOwned);
        selectedRoute = pickRouteByTimeFit(weightedRoutePool, routingTargetMins, targetDistNm, spec, type, longHaul);
    }

    const origin = selectedRoute.src;
    const destination = selectedRoute.dst;
    const distanceNm = Math.round(selectedRoute.dist);
    if (longHaul && !passesLongHaulDurationBand(distanceNm, spec, type)) {
        alert(buildNoLongHaulMissionsMessage(spec, type, isContractorMode));
        return;
    }
    const routeOutsidePrimaryWindow = distanceNm < minTarget || distanceNm > maxTarget;
    if (!routedAsGlider && !isSliderIgnoredAircraft(spec)) {
        if (!longHaul && (usedRelaxedRouting || routeOutsidePrimaryWindow)) {
            alert(ROUTE_FALLBACK_ALERT);
        }
    }
    const bearing = calculateBearing(origin.lat, origin.lon, destination.lat, destination.lon);
    const isEasterly = (bearing >= 0 && bearing < 180);
    const isLocalFlight = (origin.icao === destination.icao);

    // --- PHASE 1: FILTER MISSIONS ---
    let filteredMissions = preChosenMission
        ? [preChosenMission]
        : buildFilteredMissionList(spec, type, searchClass, origin, isContractorMode, longHaul, isLocalFlight);

    if (filteredMissions.length === 0) {
        if (longHaul) {
            alert(buildNoLongHaulMissionsMessage(spec, type, isContractorMode));
        } else {
            alert("No valid missions found for this routing.");
        }
        return;
    }

    let chosenMission = preChosenMission;
    if (!chosenMission) {
        let selectionPoolWithGuard = filterWithRecentGuard(filteredMissions, lastMissions, m => m.type, 1);
        const weightedMissions = applyContractorMissionWeighting(
            applyCivilOkWeighting(selectionPoolWithGuard, spec, searchClass),
            isContractorMode
        );
        const pickedEntry = pickWeightedMissionEntry(weightedMissions);
        chosenMission = pickedEntry ? pickedEntry.mission : filteredMissions[0];
    }
    lastMissions.push(chosenMission.type);
    if (lastMissions.length > 1) lastMissions.shift(); 

    // --- PHASE 3: APPLY MISSION OVERRIDES ---
    if (chosenMission.minAlt) spec.minAlt = Math.max(spec.minAlt, chosenMission.minAlt);

    // --- PHASE 4: CLEAN HEMISPHERIC ALTITUDE ---
    let depElev = origin.elev || 0;
    let arrElev = destination.elev || 0;
    let terrainSafetyFloor = Math.max(depElev, arrElev) + 3000;
    let midLat = (origin.lat + destination.lat) / 2;
    let midLon = (origin.lon + destination.lon) / 2;
    const globalRanges = [
        { name: "Alps", latMin: 45.0, latMax: 48.0, lonMin: 5.0, lonMax: 15.0, safeFloor: 11500 },
        { name: "Pyrenees", latMin: 42.0, latMax: 43.3, lonMin: -2.0, lonMax: 3.3, safeFloor: 9500 },
        { name: "North American Rockies", latMin: 35.0, latMax: 60.0, lonMin: -125.0, lonMax: -105.0, safeFloor: 14500 },
        { name: "South American Andes", latMin: -55.0, latMax: 10.0, lonMin: -76.0, lonMax: -65.0, safeFloor: 15500 },
        { name: "Himalayas / Tibetan Plateau", latMin: 26.0, latMax: 38.0, lonMin: 70.0, lonMax: 105.0, safeFloor: 21500 },
        { name: "Japanese Alps / Central Ranges", latMin: 34.5, latMax: 37.5, lonMin: 136.0, lonMax: 139.5, safeFloor: 10500 }
    ];
    for (let range of globalRanges) {
        let dMatch = (origin.lat >= range.latMin && origin.lat <= range.latMax && origin.lon >= range.lonMin && origin.lon <= range.lonMax);
        let aMatch = (destination.lat >= range.latMin && destination.lat <= range.latMax && destination.lon >= range.lonMin && destination.lon <= range.lonMax);
        let mMatch = (midLat >= range.latMin && midLat <= range.latMax && midLon >= range.lonMin && midLon <= range.lonMax);
        if (dMatch || aMatch || mMatch) {
            if (spec.class !== "HELI") terrainSafetyFloor = Math.max(terrainSafetyFloor, range.safeFloor);
            break; 
        }
    }
    
    let climbProfile = 150; 
    if (spec.class === "GA" || spec.class === "HELI" || spec.class === "WARBIRD") climbProfile = 100;
    if (spec.class === "BIZ JET") climbProfile = 250;
    
    const finalMinAlt = Math.max(spec.minAlt, terrainSafetyFloor);
    const distanceAltCap = Math.max(distanceNm * climbProfile, finalMinAlt);
    const effectiveMaxAlt = Math.max(Math.min(spec.maxAlt, distanceAltCap), terrainSafetyFloor);
    const safeMaxAlt = effectiveMaxAlt;
    const dynamicMinAlt = effectiveMaxAlt < finalMinAlt 
        ? Math.max(terrainSafetyFloor, safeMaxAlt - 4000)
        : Math.max(finalMinAlt, safeMaxAlt - 4000);
        
    let baseThousands = Math.floor((Math.random() * (safeMaxAlt - dynamicMinAlt + 1) + dynamicMinAlt) / 1000);
    
    // Strict Hemispheric Rules - Always whole thousands, no VFR offsets.
    if (isEasterly && baseThousands % 2 === 0) baseThousands += 1;
    if (!isEasterly && baseThousands % 2 !== 0) baseThousands += 1;
    let altFeet = baseThousands * 1000;

    // --- PHASE 5: CALCULATE PAYLOAD ---
    const operationalMtowCap = getRestrictedRouteOperationalMtowCap(origin, destination, type, spec);
    let safeMtow = spec.mtow || (spec.class === "JET" ? 75000 : 3500);
    let mtowReducedForAirport = false;
    if (operationalMtowCap !== null && safeMtow > operationalMtowCap) {
        safeMtow = operationalMtowCap;
        mtowReducedForAirport = true;
    }
    const safeOew = spec.oew || (spec.class === "JET" ? 42000 : 2000);
    const safeFuelPerNm = spec.fuelPerNm || (spec.class === "JET" ? 6 : 0.5);
    let effectiveRunway = Math.min(origin.length || 99999, destination.length || 99999);
    let runwayWeightPenalty = 0;
    const maxVariablePayload = safeMtow - safeOew;
    if (effectiveRunway < spec.minRunwayLength && spec.minRunwayLength > 0) {
        const runwayRatio = Math.max(0, effectiveRunway / spec.minRunwayLength);
        const shortFieldPenalty = maxVariablePayload * (0.55 + (1 - runwayRatio) * 0.35);
        runwayWeightPenalty = shortFieldPenalty;
    }
    let fuelDistanceNm = distanceNm;
    if (origin.icao === "LOWI" && isLowiNarrowbodyJetliner(type, spec)) {
        fuelDistanceNm = Math.min(distanceNm, 900);
    }
    const blockMinutes = longHaul
        ? estimateLongHaulBlockMinutes(distanceNm, spec, type)
        : Math.max(10, targetMins);
    let minReservedPaxWeight = 0;
    if (missionRequiresPassengers(chosenMission, spec) && spec.maxPax > 0) {
        const { minPax } = getPassengerLoadLimits(chosenMission, spec, spec.maxPax, blockMinutes);
        minReservedPaxWeight = Math.max(1, minPax) * 104;
    }
    const rawBlockFuel = fuelDistanceNm * safeFuelPerNm;
    const availableForFuel = Math.max(0, safeMtow - safeOew - runwayWeightPenalty - minReservedPaxWeight);
    const estimatedBlockFuel = Math.min(rawBlockFuel, availableForFuel);

    const maxStructuralPayload = Math.max(0, safeMtow - safeOew - estimatedBlockFuel - runwayWeightPenalty);
    let pax = 0;
    if (missionRequiresPassengers(chosenMission, spec) && spec.maxPax > 0) {
        let maxSafePax = Math.max(0, Math.min(spec.maxPax, Math.floor(maxStructuralPayload / 104)));
        if (maxSafePax > 0) {
            const { minPax, effectiveMax } = getPassengerLoadLimits(chosenMission, spec, maxSafePax, blockMinutes);
            if (effectiveMax > 0) {
                pax = Math.floor(Math.random() * (effectiveMax - minPax + 1)) + minPax;
            }
        }
        if (pax === 0) {
            pax = 1;
        }
    }
    const paxWeight = pax * 104;
    const paxRatio = spec.maxPax > 0 ? (pax / spec.maxPax) : 0;
    const proportionalCargoLimit = spec.maxCargo * (1 - paxRatio);
    const remainingPayload = Math.max(0, maxStructuralPayload - paxWeight);
    const hardCargoLimit = Math.floor(Math.min(proportionalCargoLimit, remainingPayload));
    let cargoKg = 0;
    const bizJetPassengerOnly = spec.class === "BIZ JET" && type !== "LJ35" && !isFreightMission(chosenMission);
    if (!bizJetPassengerOnly && hardCargoLimit > 0) {
        if (hardCargoLimit >= MIN_ASSIGNED_PAYLOAD_KG) {
            const cargoSpan = hardCargoLimit - MIN_ASSIGNED_PAYLOAD_KG + 1;
            cargoKg = Math.floor(Math.random() * cargoSpan) + MIN_ASSIGNED_PAYLOAD_KG;
        } else {
            cargoKg = hardCargoLimit;
        }
    }
    const payout = "$ " + (Math.floor(Math.random() * 6200) + 1950).toLocaleString('en-GB');

    // --- PHASE 6: SCENARIO SELECTION ---
    let rPayload = "standard manifest";
    let rInstruction = "Execute standard procedures.";
    let imageId = chosenMission.type;
    let scenarioImgId = null;

    if (chosenMission.pool && typeof scenarioDB !== 'undefined' && scenarioDB[chosenMission.pool]) {
        const missionPool = scenarioDB[chosenMission.pool];
        const excludedImgIds = getExcludedScenarioImgIdsForPool(missionPool, type, spec);
        let activePool = filterScenarioPool(missionPool, type, spec, excludedImgIds);
        activePool = filterScenariosForHaulMode(activePool, chosenMission.type, longHaul);
        const typedPool = activePool.filter(s => s.missionType === chosenMission.type);
        if (typedPool.length > 0) activePool = typedPool;
        if (chosenMission.type === 30) {
            const staffOnly = activePool.filter(s => s.staffShuttle && !s.heliOps);
            if (staffOnly.length > 0) activePool = staffOnly;
        } else if (chosenMission.type === 29) {
            const heliOnly = activePool.filter(s => s.heliOps);
            if (heliOnly.length > 0) activePool = heliOnly;
        }
        if (spec.class !== "HELI") {
            activePool = activePool.filter(s => !s.heliOps);
        }
        if (chosenMission.pool === "gliderOps") {
            if (isLocalFlight) {
                const localOnly = activePool.filter(s => s.isLocal);
                if (localOnly.length > 0) activePool = localOnly;
            } else {
                const transitOnly = activePool.filter(s => !s.isLocal);
                if (transitOnly.length > 0) activePool = transitOnly;
            }
        }
        let scenarioPool = filterWithRecentGuard(activePool, lastScenarioImgIds, s => s.imgId, 1);
        let scenario = pickWeightedRandom(scenarioPool, 10, function (s) {
            return getScenarioPickWeight(s, type, searchClass);
        });
        if (scenario) {
            rPayload = scenario.payload;
            rInstruction = scenario.instruction;
            scenarioImgId = scenario.imgId;
            imageId = scenario.imgId;
        } else {
            rPayload = chosenMission.name;
            rInstruction = chosenMission.detail || "Execute standard procedures.";
            imageId = chosenMission.type;
        }
    }

    lastScenarioImgIds.push(scenarioImgId || imageId);
    if (lastScenarioImgIds.length > 1) lastScenarioImgIds.shift();

    if (scenarioImgId === 130) cargoKg = Math.floor(hardCargoLimit * 0.70);
    cargoKg = finalizeAssignedPayloadKg(cargoKg, hardCargoLimit);

    if (mtowReducedForAirport) {
        alert("MTOW has been reduced for this flight due to airport restrictions. You will need to check fuel before departing.");
    }

    // --- PHASE 6b: TEXT REPLACEMENTS (after scenario is known) ---
    const depDisplayName = stripIrlNameSuffix(origin.name);
    const destDisplayName = stripIrlNameSuffix(destination.name);
    let randomName = names[Math.floor(Math.random() * names.length)];
    let randomAthlete = athletes[Math.floor(Math.random() * athletes.length)];
    let randomTeam = teams[Math.floor(Math.random() * teams.length)];
    let randomMusician = musician[Math.floor(Math.random() * musician.length)];
    let randomMedCargo = typeof medCargo !== 'undefined' ? medCargo[Math.floor(Math.random() * medCargo.length)] : "medical supplies";
    let randomIndustry = typeof industry !== 'undefined' ? industry[Math.floor(Math.random() * industry.length)] : "corporate";
    let randomVip = typeof vipType !== 'undefined' ? vipType[Math.floor(Math.random() * vipType.length)] : "VIP";
    let randomSciFi = typeof sciFi !== 'undefined' ? sciFi[Math.floor(Math.random() * sciFi.length)] : "surface anomaly";
    let randomCargo = typeof cargoType !== 'undefined' ? cargoType[Math.floor(Math.random() * cargoType.length)] : "specialized cargo";

    let rawDesc = chosenMission.desc ? chosenMission.desc : (chosenMission.pool ? rPayload : chosenMission.name);
    let rawDetail = chosenMission.detail ? chosenMission.detail : rInstruction;

    let processedDetail = rawDetail
        .replace("{name}", randomName)
        .replace("{athlete}", randomAthlete)
        .replace("{team}", randomTeam)
        .replace("{musician}", randomMusician)
        .replace("{med_cargo}", randomMedCargo)
        .replace("{industry}", randomIndustry)
        .replace("{vip_type}", randomVip)
        .replace("{sci_fi}", randomSciFi)
        .replace("{cargo_type}", randomCargo)
        .replace("{dep_field}", depDisplayName)
        .replace("{dest_field}", destDisplayName);

    let processedPayload = rawDesc
        .replace("{name}", randomName)
        .replace("{athlete}", randomAthlete)
        .replace("{team}", randomTeam)
        .replace("{musician}", randomMusician)
        .replace("{med_cargo}", randomMedCargo)
        .replace("{industry}", randomIndustry)
        .replace("{vip_type}", randomVip)
        .replace("{sci_fi}", randomSciFi)
        .replace("{cargo_type}", randomCargo)
        .replace("{dep_field}", depDisplayName)
        .replace("{dest_field}", destDisplayName);

    // --- PHASE 7: JOB TICKET GENERATION ---
    let jobTicket = "";
    const ticketRow = (html) => `<div class="ticket-row">${html}</div>`;
    const ticketRoutingLine = chosenMission.militaryOnly
        ? ticketRow(`<strong>ROUTING:</strong> <strong>${origin.icao}</strong> ➔ <strong>${destination.icao}</strong>`)
        : ticketRow(`<strong>Routing:</strong> <strong>${origin.icao}</strong> ➔ <strong>${destination.icao}</strong>`);
    const additionalPayloadKg = pax > 0 ? cargoKg : 0;
    const cargoPayloadLine = additionalPayloadKg > 0
        ? (chosenMission.militaryOnly
            ? `<strong>ADDITIONAL PAYLOAD:</strong> ${additionalPayloadKg} KG`
            : `<strong>Additional Payload:</strong> ${additionalPayloadKg} kg`)
        : "";
    const optionalCargoPayloadRow = cargoPayloadLine ? ticketRow(cargoPayloadLine) : "";
    
    if (chosenMission.militaryOnly) {
        let manifestText = missionRequiresPassengers(chosenMission, spec) ? `${pax} PERS` : `${cargoKg} KG MATERIEL`;
        let routingText = isLocalFlight 
            ? `Execute local operations originating from ${origin.icao} and return to base.`
            : `Execute routing from ${origin.icao} to ${destination.icao} strictly as filed.`;
        const taskingLabel = (scenarioImgId && processedPayload && processedPayload !== chosenMission.name)
            ? processedPayload
            : chosenMission.name;
        jobTicket = `
            <div class="ticket-lined-rows">
            ${ticketRow(`<strong>TASKING:</strong> ${taskingLabel.toUpperCase()}`)}
            ${ticketRoutingLine}
            ${ticketRow(`<strong>CLASSIFICATION:</strong> TACTICAL SORTIE (ATO# ${Math.floor(Math.random() * 9000) + 1000})`)}
            ${ticketRow(`<strong>MANIFEST:</strong> ${manifestText}`)}
            ${optionalCargoPayloadRow}
            </div>
            <div class="ticket-mission-text"><strong>SPECIAL INSTRUCTIONS:</strong> You are tasked with ${processedPayload}. ${processedDetail} Maintain sterile comms outside of ATC requirements. ${routingText} Check threat and weather scopes prior to engine start. Dismissed.</div>`;
    } else {
        let manifestText = missionRequiresPassengers(chosenMission, spec) ? formatPassengerManifest(pax) : `${cargoKg} kg Cargo`;
        let payloadNote = `You are tasked with ${processedPayload}. `;
        const lowiDepartureNote = (origin.icao === "LOWI" && isLowiNarrowbodyJetliner(type, spec))
            ? " Innsbruck departure: payload and fuel are restricted for the 6,562 ft runway - plan for a short or medium-haul European sector."
            : "";

        const useVfrTicket = spec.class === "GLIDER" || spec.class === "HELI"
            || (chosenMission.rules && chosenMission.rules.includes("VFR"))
            || (altFeet < 10000 && !chosenMission.rules);

        if (useVfrTicket) {
            if (isLocalFlight) {
                jobTicket = `
                    <div class="ticket-lined-rows">
                    ${ticketRow(`<strong>Assignment:</strong> <strong>${chosenMission.name}</strong>`)}
                    ${ticketRoutingLine}
                    ${ticketRow(`<strong>Manifest:</strong> ${manifestText}`)}
                    ${optionalCargoPayloadRow}
                    ${ticketRow(`<strong>Contract Value:</strong> ${payout}`)}
                    </div>
                    <div class="ticket-mission-text"><strong>Dispatcher Notes:</strong> Good day, Captain. This is a local operations flight operating out of ${depDisplayName}. ${payloadNote}${processedDetail}${lowiDepartureNote}<br><br>Conditions should be in your favor but always check the ATIS report before leaving. Keep your eyes outside the cockpit, maintain appropriate altitude over populated areas, and return to base when the block time is up.</div>`;
            } else {
                jobTicket = `
                    <div class="ticket-lined-rows">
                    ${ticketRow(`<strong>Assignment:</strong> <strong>${chosenMission.name}</strong>`)}
                    ${ticketRoutingLine}
                    ${ticketRow(`<strong>Manifest:</strong> ${manifestText}`)}
                    ${optionalCargoPayloadRow}
                    ${ticketRow(`<strong>Contract Value:</strong> ${payout}`)}
                    </div>
                    <div class="ticket-mission-text"><strong>Dispatcher Notes:</strong> Good day, Captain. You are cleared for transit from ${depDisplayName} toward ${destDisplayName}. ${payloadNote}${processedDetail}${lowiDepartureNote}<br><br>Conditions should be in your favor but always check the ATIS report before leaving. Maintain appropriate cruising altitudes and keep clear of weather decks.</div>`;
            }
        } else {
            jobTicket = `
                <div class="ticket-lined-rows">
                ${ticketRow(`<strong>Assignment:</strong> <strong>${chosenMission.name}</strong>`)}
                ${ticketRoutingLine}
                ${ticketRow(`<strong>Manifest:</strong> ${manifestText}`)}
                ${optionalCargoPayloadRow}
                ${ticketRow(`<strong>Contract Value:</strong> ${payout}`)}
                </div>
                <div class="ticket-mission-text"><strong>Dispatcher Notes:</strong> Welcome to the flight deck, Captain. You are cleared for transit from ${depDisplayName} toward ${destDisplayName}. ${payloadNote}${processedDetail}${lowiDepartureNote} Maintain your assigned cruise altitude and keep clear of weather decks. Safe flight.</div>`;
        }
    }

    // --- PHASE 8: OUTPUT FORMATTING ---
    document.getElementById("outCallsign").innerText = callsignRaw;
    document.getElementById("outAirframe").innerText = spec.name;
    // outRules is safely ignored
    const ownedSet = new Set(getOwnedAirportList());
    document.getElementById("outOrig").innerHTML = formatRoutingAirportLabel(origin.icao, origin.name, ownedSet);
    document.getElementById("outDest").innerHTML = formatRoutingAirportLabel(destination.icao, destination.name, ownedSet);
    
    // Clean, standard Altitude Formatting
    let displayAlt = "";
    if (altFeet >= 10000) {
        displayAlt = "FL" + (altFeet / 100).toString();
    } else {
        displayAlt = altFeet.toLocaleString('en-US') + " ft";
    }
    document.getElementById("outAlt").innerText = displayAlt;
    
    document.getElementById("outScenery").innerHTML = `<strong>DEP:</strong> ${formatScenery(origin)}<br><strong>ARR:</strong> ${formatScenery(destination)}`;
    
    const missionImgEl = document.getElementById("outMissionImage");
    const templateFallbackFile = (chosenMission.type >= 13 && chosenMission.type <= 32)
        ? `mission${chosenMission.type}.jpg`
        : "";
    const templateFallback = templateFallbackFile ? missionImageUrl(templateFallbackFile) : "";
    missionImgEl.onerror = function () {
        if (templateFallbackFile && !missionImgEl.src.includes(templateFallbackFile)) {
            missionImgEl.onerror = null;
            missionImgEl.src = templateFallback;
        } else {
            missionImgEl.style.display = "none";
        }
    };
    missionImgEl.src = missionImageUrl(`mission${imageId}.jpg`);
    missionImgEl.style.display = "block";
    
    document.getElementById("outTicket").innerHTML = jobTicket;
    const ticketWrapEl = document.getElementById("outTicketWrap");
    if (chosenMission.militaryOnly) {
        ticketWrapEl.classList.add("ticket-note-military");
        ticketWrapEl.classList.remove("ticket-note");
    } else {
        ticketWrapEl.classList.add("ticket-note");
        ticketWrapEl.classList.remove("ticket-note-military");
    }
    
    const cargoParam = (cargoKg / 1000).toFixed(3);
    const isGlider = spec.class === "GLIDER";
    const dispatchType = spec.simbriefIcao || type;
    
    let flightCounter = parseInt(localStorage.getItem("dispatcher_flt_num")) || 1;
    let paddedFltNum = String(flightCounter).padStart(3, '0');
    let nextFlightCounter = flightCounter >= 999 ? 1 : flightCounter + 1;
    localStorage.setItem("dispatcher_flt_num", nextFlightCounter.toString());
    
    const airlineMatch = callsignRaw.match(/^[A-Z]+/);
    const dynamicAirline = airlineMatch ? airlineMatch[0].substring(0, 3) : "VEC"; 

    // Simbrief wants FL e.g. "080" for 8000ft, or "320" for FL320. 
    const simbriefAlt = (altFeet / 100).toString().padStart(3, '0');
    
    const simbriefUrl = `https://www.simbrief.com/system/dispatch.php?share=1&type=${dispatchType}&orig=${origin.icao}&dest=${destination.icao}&airline=${dynamicAirline}&fltnum=${paddedFltNum}&callsign=${callsignRaw}&fl=${simbriefAlt}&pax=${pax}&cargo=${cargoParam}&units=KGS`;
    const linkEl = document.getElementById("outLink");
    linkEl.href = simbriefUrl;
    
    const isWarbird = spec.class === "WARBIRD" || spec.name.toLowerCase().includes("flying iron") || spec.name.toLowerCase().includes("warbird");
    const isSimbriefSupported = ["GA", "TURBO", "BIZ JET", "JET"].includes(spec.class) && !isWarbird;
    const heliMessageEl = document.getElementById("heliMessage");
    
    if (!isSimbriefSupported) {
        heliMessageEl.style.display = "block";
        heliMessageEl.textContent = (isGlider || spec.class === "HELI")
            ? "SimBrief dispatch is not available for this aircraft type. Click below to download an MSFS .pln file that you can use to follow your progress via the map on the EFB."
            : "SimBrief dispatch is not available for this aircraft type.";
        document.getElementById("outLink").style.display = "none";
    } else {
        heliMessageEl.style.display = "none";
        document.getElementById("outLink").style.display = "inline-flex";
    }
    
    const depElevStr = origin.elev || 0;
    const arrElevStr = destination.elev || 0;
    const depLLA = getMSFSLLA(origin.lat, origin.lon, depElevStr);
    const destLLA = getMSFSLLA(destination.lat, destination.lon, arrElevStr);
    
    // Secretly enforce IFR for MSFS ATC logic if high-altitude
    const isIfr = (chosenMission.type === 5 || altFeet >= 10000); 
    const localWptLLA = isLocalFlight ? getMSFSLLA(origin.lat + 0.2, origin.lon, altFeet) : "";
    
    const xmlString = generatePlnXml({
        originIcao: origin.icao,
        destIcao: destination.icao,
        originName: depDisplayName.replace(/&/g, '&amp;'), 
        destName: destDisplayName.replace(/&/g, '&amp;'),
        depLLA: depLLA,
        destLLA: destLLA,
        localWptLLA: localWptLLA,
        isIfr: isIfr,
        altValue: altFeet.toString() // MSFS requires raw feet 
    });
    
    const blob = new Blob([xmlString], { type: "text/xml" });
    const url = URL.createObjectURL(blob);
    const downloadBtn = document.getElementById("downloadPlnBtn");
    downloadBtn.href = url;
    downloadBtn.download = `${origin.icao}_to_${destination.icao}.pln`;
    downloadBtn.style.display = "inline-flex";
    
    currentPendingFlight = {
        orig: origin.icao,
        dest: destination.icao,
        aircraft: spec.name,
        mission: chosenMission.name,
        durationMins: (spec.class === "HELI" || spec.class === "GLIDER") ? 20
            : (longHaul ? estimateLongHaulBlockMinutes(distanceNm, spec, type) : targetMins)
    };
    persistLastDispatch(currentPendingFlight);
    
    document.getElementById("logFlightBtn").style.display = "inline-flex";
    document.getElementById("dispatchRelease").style.display = "block";
}
// END OF DISPATCH FLIGHT FUNCTION

function convertToDMS(deg, isLat) {
    const dir = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
    const absDeg = Math.abs(deg);
    const d = Math.floor(absDeg);
    const mFloat = (absDeg - d) * 60;
    const m = Math.floor(mFloat);
    const s = ((mFloat - m) * 60).toFixed(2);
    return `${dir}${d}Â° ${m.toString().padStart(2, '0')}' ${s.padStart(5, '0')}"`;
}
function formatAltitude(feet) {
    const sign = feet >= 0 ? '+' : '-';
    return `${sign}${Math.abs(feet).toFixed(2).padStart(9, '0')}`;
}
function getMSFSLLA(lat, lon, altFeet) {
    return `${convertToDMS(lat, true)},${convertToDMS(lon, false)},${formatAltitude(altFeet)}`;
}
function generatePlnXml(data) {
    let routeNodes = `
        <ATCWaypoint id="${data.originIcao}">
            <ATCWaypointType>Airport</ATCWaypointType>
            <WorldPosition>${data.depLLA}</WorldPosition>
            <ICAO>
                <ICAOIdent>${data.originIcao}</ICAOIdent>
            </ICAO>
        </ATCWaypoint>`;
    if (data.originIcao === data.destIcao) {
        routeNodes += `
        <ATCWaypoint id="TOUR">
            <ATCWaypointType>User</ATCWaypointType>
            <WorldPosition>${data.localWptLLA}</WorldPosition>
        </ATCWaypoint>`;
    }
    routeNodes += `
        <ATCWaypoint id="${data.destIcao}">
            <ATCWaypointType>Airport</ATCWaypointType>
            <WorldPosition>${data.destLLA}</WorldPosition>
            <ICAO>
                <ICAOIdent>${data.destIcao}</ICAOIdent>
            </ICAO>
        </ATCWaypoint>`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<SimBase.Document Type="AceXML" version="1,0">
    <Descr>AceXML Document</Descr>
    <FlightPlan.FlightPlan>
        <Title>${data.originIcao} to ${data.destIcao}</Title>
        <FPType>${data.isIfr ? 'IFR' : 'VFR'}</FPType>
        <RouteType>Direct</RouteType>
        <CruisingAlt>${data.altValue}</CruisingAlt>
        <DepartureID>${data.originIcao}</DepartureID>
        <DepartureLLA>${data.depLLA}</DepartureLLA>
        <DestinationID>${data.destIcao}</DestinationID>
        <DestinationLLA>${data.destLLA}</DestinationLLA>
        <Descr>${data.originIcao} to ${data.destIcao}</Descr>
        <DepartureName>${data.originName}</DepartureName>
        <DestinationName>${data.destName}</DestinationName>
        <AppVersion>
            <AppVersionMajor>10</AppVersionMajor>
            <AppVersionBuild>61472</AppVersionBuild>
        </AppVersion>${routeNodes}
    </FlightPlan.FlightPlan>
</SimBase.Document>`;
}
let currentPendingFlight = null;
const LAST_DISPATCH_KEY = "dispatcher_last_dispatch";

function persistLastDispatch(flight) {
    if (!flight) return;
    localStorage.setItem(LAST_DISPATCH_KEY, JSON.stringify({
        orig: flight.orig,
        dest: flight.dest,
        aircraft: flight.aircraft,
        mission: flight.mission,
        durationMins: flight.durationMins,
        logged: false
    }));
    updateAddLastFlightLink();
}

function getLastDispatch() {
    try {
        const raw = localStorage.getItem(LAST_DISPATCH_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function markLastDispatchLogged() {
    const last = getLastDispatch();
    if (!last) return;
    last.logged = true;
    localStorage.setItem(LAST_DISPATCH_KEY, JSON.stringify(last));
    updateAddLastFlightLink();
}

function restoreLastPendingFlight() {
    const last = getLastDispatch();
    if (!last || last.logged) return;
    currentPendingFlight = {
        orig: last.orig,
        dest: last.dest,
        aircraft: last.aircraft,
        mission: last.mission,
        durationMins: last.durationMins
    };
    const logBtn = document.getElementById("logFlightBtn");
    if (logBtn) logBtn.style.display = "inline-flex";
}

function updateAddLastFlightLink() {
    const link = document.getElementById("addLastFlightLink");
    if (!link) return;
    const last = getLastDispatch();
    if (!last) {
        link.style.color = "#666";
        link.style.pointerEvents = "none";
        link.style.textDecoration = "none";
        link.title = "Generate a dispatch first.";
        link.textContent = "Add last flight to logbook";
        return;
    }
    if (last.logged) {
        link.style.color = "#666";
        link.style.pointerEvents = "none";
        link.style.textDecoration = "none";
        link.title = "This dispatch is already in your logbook.";
        link.textContent = "Add last flight to logbook";
        return;
    }
    link.style.color = "";
    link.style.pointerEvents = "";
    link.style.textDecoration = "underline";
    const hrs = (last.durationMins / 60).toFixed(1);
    link.title = `${last.orig} -> ${last.dest} | ${last.aircraft} | ${last.mission} | ${hrs} hrs`;
    link.textContent = `Add last flight to logbook (${last.orig} -> ${last.dest})`;
}

const LOGBOOK_BACKUP_INTERVAL = 20;
const LOGBOOK_BACKUP_PROMPT_KEY = "dispatcher_logbook_backup_prompt_at";

function maybePromptLogbookBackup() {
    const logbook = JSON.parse(localStorage.getItem("dispatcher_logbook") || "[]");
    const count = logbook.length;
    if (count < LOGBOOK_BACKUP_INTERVAL || count % LOGBOOK_BACKUP_INTERVAL !== 0) return;
    const lastPromptAt = parseInt(localStorage.getItem(LOGBOOK_BACKUP_PROMPT_KEY) || "0", 10);
    if (lastPromptAt >= count) return;
    localStorage.setItem(LOGBOOK_BACKUP_PROMPT_KEY, String(count));
    if (confirm("You have " + count + " flights in your logbook. Do you want to backup your logbook?\n\nThis saves a file to your computer so you do not lose your flight history if browser data is cleared.")) {
        exportDatabaseBackup();
    }
}

function getLogbookEntries() {
    try {
        return JSON.parse(localStorage.getItem("dispatcher_logbook") || "[]");
    } catch (e) {
        return [];
    }
}

function getLastLogbookArrival() {
    const logbook = getLogbookEntries();
    const dest = logbook[0] && logbook[0].dest;
    return dest ? String(dest).trim().toUpperCase() : null;
}

function syncLastArrivalFromLogbook() {
    const arrival = getLastLogbookArrival();
    if (arrival) {
        localStorage.setItem("dispatcher_last_arrival", arrival);
    } else {
        localStorage.removeItem("dispatcher_last_arrival");
    }
    return arrival;
}

function refreshLastArrivalDepField() {
    const toggle = document.getElementById("useLastArrivalToggle");
    const depInput = document.getElementById("depOverrideInput");
    if (!toggle || !depInput || !toggle.checked) return;
    const arrival = getLastLogbookArrival();
    if (arrival) {
        depInput.value = arrival;
    } else {
        toggle.checked = false;
        depInput.value = "";
    }
}

function appendFlightToLogbook(flight) {
    let logbook = getLogbookEntries();
    const dateStr = new Date().toLocaleDateString();
    logbook.unshift({
        date: dateStr,
        orig: flight.orig,
        dest: flight.dest,
        aircraft: flight.aircraft,
        mission: flight.mission,
        duration: flight.durationMins
    });
    localStorage.setItem("dispatcher_logbook", JSON.stringify(logbook));
    syncLastArrivalFromLogbook();
    return logbook;
}

function addLastFlightToLogbook() {
    const last = getLastDispatch();
    if (!last) {
        alert("No recent dispatch found. Generate a flight first.");
        return;
    }
    if (last.logged) {
        alert("That dispatch is already saved in your logbook.");
        return;
    }
    const flight = {
        orig: last.orig,
        dest: last.dest,
        aircraft: last.aircraft,
        mission: last.mission,
        durationMins: last.durationMins
    };
    appendFlightToLogbook(flight);
    markLastDispatchLogged();
    currentPendingFlight = null;
    const logBtn = document.getElementById("logFlightBtn");
    if (logBtn) logBtn.style.display = "none";
    alert("Flight saved to logbook.");
    currentLogbookPage = 1;
    updateLogbookUI();
    runMaintenanceCheckAfterLog();
}

function runMaintenanceCheckAfterLog() {
    const logbook = JSON.parse(localStorage.getItem("dispatcher_logbook")) || [];
    if (logbook.length === 0) return;
    let currentAircraft = logbook[0].aircraft;
    let consecutiveFlights = 0;
    for (let i = 0; i < logbook.length; i++) {
        if (logbook[i].aircraft === currentAircraft) {
            consecutiveFlights++;
            if (logbook[i].maintenanceDone) break;
        } else {
            break;
        }
    }
    if (consecutiveFlights >= 3) {
        let isChecked = confirm("Maintenance Reminder: You have flown the " + currentAircraft + " for " + consecutiveFlights + " consecutive flights.\n\nHave you checked your airframe, tyres, and oil?\n\nClick 'OK' to log maintenance, or 'Cancel' to be reminded next time.");
        if (isChecked) {
            logbook[0].maintenanceDone = true;
            localStorage.setItem("dispatcher_logbook", JSON.stringify(logbook));
        }
    }
    updateDatabaseStats();
    maybePromptLogbookBackup();
}
function toggleLastArrival() {
    const toggle = document.getElementById("useLastArrivalToggle");
    const depInput = document.getElementById("depOverrideInput");
    if (toggle.checked) {
        const lastArr = getLastLogbookArrival();
        if (lastArr) {
            depInput.value = lastArr;
        } else {
            alert("No previous arrival logged yet! Save a completed flight to your logbook first.");
            toggle.checked = false;
        }
    } else {
        depInput.value = "";
    }
}
function logCurrentFlight() {
    if (!currentPendingFlight) return;
    appendFlightToLogbook(currentPendingFlight);
    markLastDispatchLogged();
    document.getElementById("logFlightBtn").style.display = "none";
    alert("Flight saved to logbook.");
    currentPendingFlight = null;
    currentLogbookPage = 1;
    updateLogbookUI();
    runMaintenanceCheckAfterLog();
}
let currentLogbookPage = 1;
const logbookRowsPerPage = 5;
function formatLogbookAircraftLabel(fullName) {
    if (!fullName) return "";
    let label = fullName.includes(" - ") ? fullName.split(" - ").slice(1).join(" - ") : fullName;
    label = label.replace(/\s*\((Freighter|Passenger|Cargo|Turbo|Piston|Pressurized)\)\s*$/i, "").trim();
    return label;
}
function updateClearLogbookLinkState(entryCount) {
    const link = document.getElementById("clearLogbookLink");
    if (!link) return;
    const disabled = entryCount === 0;
    link.classList.toggle("is-disabled", disabled);
    link.setAttribute("aria-disabled", disabled ? "true" : "false");
}
function updateLogbookUI() {
    const logbook = JSON.parse(localStorage.getItem("dispatcher_logbook")) || [];
    updateClearLogbookLinkState(logbook.length);
    document.getElementById("lbTotalFlights").innerText = logbook.length;
    let totalMins = logbook.reduce((sum, flight) => sum + (flight.duration || 0), 0);
    document.getElementById("lbTotalHours").innerText = (totalMins / 60).toFixed(1);
    const tbody = document.getElementById("logbookTableBody");
    const pagControls = document.getElementById("paginationControls");
    if (logbook.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #888; border: none;">No flights logged yet.</td></tr>`;
        pagControls.style.display = "none";
        return;
    }
    const totalPages = Math.ceil(logbook.length / logbookRowsPerPage);
    if (currentLogbookPage > totalPages) currentLogbookPage = totalPages;
    if (currentLogbookPage < 1) currentLogbookPage = 1;
    const startIdx = (currentLogbookPage - 1) * logbookRowsPerPage;
    const endIdx = startIdx + logbookRowsPerPage;
    const pageData = logbook.slice(startIdx, endIdx);
tbody.innerHTML = pageData.map((f, i) => {
        const globalIdx = startIdx + i;
        const aircraftLabel = formatLogbookAircraftLabel(f.aircraft);
        const missionLabel = f.mission || "";
        return `
        <tr>
            <td class="lb-date">${f.date}</td>
            <td class="lb-route">${f.orig} &rarr; ${f.dest}</td>
            <td class="lb-aircraft" title="${f.aircraft.replace(/"/g, "&quot;")}">${aircraftLabel}</td>
            <td class="lb-mission" title="${missionLabel.replace(/"/g, "&quot;")}"><span style="opacity: 0.8;">${missionLabel}</span></td>
            <td class="lb-time">${(f.duration / 60).toFixed(1)}</td>
            <td class="lb-action">
                <a href="#" class="lb-remove" onclick="event.preventDefault(); removeLogbookEntry(${globalIdx});" title="Remove this entry">&times;</a>
            </td>
        </tr>`;
    }).join('');
    if (totalPages > 1) {
        pagControls.style.display = "block";
        document.getElementById("pageIndicator").innerText = `Page ${currentLogbookPage} of ${totalPages}`;
    } else {
        pagControls.style.display = "none";
    }
    updateAddLastFlightLink();
}
function changePage(direction) {
    currentLogbookPage += direction;
    updateLogbookUI();
}
function removeLogbookEntry(index) {
    const logbook = JSON.parse(localStorage.getItem("dispatcher_logbook")) || [];
    if (index < 0 || index >= logbook.length) return;
    const entry = logbook[index];
    const aircraftLabel = entry.aircraft.split(" - ")[1] || entry.aircraft;
    const msg = "Remove this logbook entry?\n\n"
        + entry.date + "  " + entry.orig + " -> " + entry.dest + "\n"
        + aircraftLabel + "\n"
        + entry.mission + "\n\n"
        + "This cannot be undone.";
    if (!confirm(msg)) return;
    logbook.splice(index, 1);
    localStorage.setItem("dispatcher_logbook", JSON.stringify(logbook));
    syncLastArrivalFromLogbook();
    refreshLastArrivalDepField();
    updateLogbookUI();
    updateDatabaseStats();
}
function clearLogbook() {
    const logbook = JSON.parse(localStorage.getItem("dispatcher_logbook")) || [];
    if (!logbook.length) return;
    if (confirm("Are you sure you want to delete your entire flight history? This cannot be undone.")) {
        localStorage.removeItem("dispatcher_logbook");
        localStorage.removeItem("dispatcher_last_arrival");
        localStorage.removeItem(LOGBOOK_BACKUP_PROMPT_KEY);
        document.getElementById("useLastArrivalToggle").checked = false;
        document.getElementById("depOverrideInput").value = "";
        currentLogbookPage = 1;
        updateLogbookUI();
        updateDatabaseStats();
    }
}
window.onload = function() {
    loadSettings();
    updateThemeBanner();
    updateCustomAircraftForm();
    rebuildActiveDatabase();
    rebuildFleetDropdown();
    rebuildAirportDropdown(); // Initializes the new airport search
    updateDatabaseStats();
    updateLogbookUI();
    updateManageCustomDbUI();
    bindManageCustomDbActions();
    updateAppVersionLabel();
    checkForAppUpdate();
    restoreLastPendingFlight();
    updateAddLastFlightLink();
    syncLastArrivalFromLogbook();
    refreshLastArrivalDepField();
    updateFlightTimeSliderState();
};
function updateAppVersionLabel() {
    const el = document.getElementById("appVersionLabel");
    if (!el) return;
    const version = window.DISPATCHER_APP_VERSION || localStorage.getItem("dispatcher_app_version");
    el.textContent = version ? "App version " + version : "";
}
function checkForAppUpdate() {
    if (window.location.protocol === "file:") return;

    const versionUrl = new URL("version.json", window.location.href);
    versionUrl.searchParams.set("_", String(Date.now()));

    fetch(versionUrl.toString(), { cache: "no-store" })
        .then(function (response) {
            if (!response.ok) return null;
            return response.json();
        })
        .then(function (data) {
            if (!data || !data.version) return;

            const serverVersion = data.version;
            const embeddedVersion = window.DISPATCHER_APP_VERSION || "";
            const storedVersion = localStorage.getItem("dispatcher_app_version") || "";
            const currentVersion = window.dispatcherPickNewerVersion
                ? window.dispatcherPickNewerVersion(embeddedVersion, storedVersion)
                : embeddedVersion || storedVersion;
            const latestVersion = window.dispatcherPickNewerVersion
                ? window.dispatcherPickNewerVersion(currentVersion, serverVersion)
                : serverVersion;

            if (window.dispatcherCompareVersions && window.dispatcherCompareVersions(latestVersion, currentVersion) > 0) {
                const reloadKey = "dispatcher_boot_reload_" + latestVersion;
                const reloadAttempts = parseInt(sessionStorage.getItem(reloadKey) || "0", 10);
                if (reloadAttempts < 2) {
                    sessionStorage.setItem(reloadKey, String(reloadAttempts + 1));
                    localStorage.setItem("dispatcher_app_version", latestVersion);
                    const url = new URL(window.location.href);
                    url.searchParams.set("v", latestVersion);
                    url.searchParams.set("_", String(Date.now()));
                    window.location.replace(url.toString());
                    return;
                }
            }

            window.DISPATCHER_APP_VERSION = latestVersion;
            localStorage.setItem("dispatcher_app_version", latestVersion);
            updateAppVersionLabel();
        })
        .catch(function () {});
}
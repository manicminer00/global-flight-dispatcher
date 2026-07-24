let lastMissions = [];
let lastScenarioImgIds = [];
const vectorDialogState = { resolver: null, previousFocus: null };

function getVectorDialogElements() {
    return {
        backdrop: document.getElementById("vectorDialogBackdrop"),
        panel: document.getElementById("vectorDialogPanel"),
        badge: document.getElementById("vectorDialogBadge"),
        body: document.getElementById("vectorDialogBody"),
        actions: document.getElementById("vectorDialogActions"),
        closeBtn: document.getElementById("vectorDialogCloseBtn")
    };
}

function closeVectorDialog(result) {
    const els = getVectorDialogElements();
    if (!els.backdrop || vectorDialogState.resolver == null) return;
    els.backdrop.hidden = true;
    els.backdrop.setAttribute("aria-hidden", "true");
    document.body.classList.remove("vector-dialog-open");
    const resolve = vectorDialogState.resolver;
    vectorDialogState.resolver = null;
    if (vectorDialogState.previousFocus && typeof vectorDialogState.previousFocus.focus === "function") {
        try { vectorDialogState.previousFocus.focus(); } catch (e) { /* ignore */ }
    }
    vectorDialogState.previousFocus = null;
    resolve(result);
}

function bindVectorDialogChrome() {
    const els = getVectorDialogElements();
    if (!els.backdrop || els.backdrop.dataset.bound === "1") return;
    els.backdrop.dataset.bound = "1";
    if (els.closeBtn) {
        els.closeBtn.addEventListener("click", () => closeVectorDialog(null));
    }
    els.backdrop.addEventListener("click", (e) => {
        if (e.target === els.backdrop) closeVectorDialog(null);
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && vectorDialogState.resolver != null) {
            e.preventDefault();
            closeVectorDialog(null);
        }
    });
}

function openVectorDialog(options) {
    bindVectorDialogChrome();
    const opts = options || {};
    const els = getVectorDialogElements();
    if (!els.backdrop || !els.panel || !els.body || !els.actions) {
        return Promise.resolve(opts.kind === "confirm" ? false : undefined);
    }
    if (vectorDialogState.resolver != null) {
        closeVectorDialog(null);
    }
    const kind = opts.kind || "info";
    const isConfirm = kind === "confirm";
    const isNotam = kind === "notam";
    els.panel.classList.toggle("is-notam", isNotam);
    if (els.badge) {
        els.badge.hidden = !isNotam;
        els.badge.textContent = isNotam ? "NOTAM" : "";
    }
    els.body.textContent = String(opts.message || "");
    els.actions.innerHTML = "";
    const makeBtn = (label, primary, result) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "vector-dialog-btn" + (primary ? " vector-dialog-btn--primary" : " vector-dialog-btn--ghost");
        btn.textContent = label;
        btn.addEventListener("click", () => closeVectorDialog(result));
        return btn;
    };
    if (isConfirm) {
        const cancelBtn = makeBtn(opts.cancelLabel || "Cancel", false, false);
        const confirmBtn = makeBtn(opts.confirmLabel || "Confirm", true, true);
        if (opts.confirmFirst) {
            els.actions.appendChild(confirmBtn);
            els.actions.appendChild(cancelBtn);
        } else {
            els.actions.appendChild(cancelBtn);
            els.actions.appendChild(confirmBtn);
        }
    } else {
        els.actions.appendChild(makeBtn(opts.confirmLabel || (isNotam ? "Accept" : "Close"), true, true));
    }
    vectorDialogState.previousFocus = document.activeElement;
    els.backdrop.hidden = false;
    els.backdrop.setAttribute("aria-hidden", "false");
    document.body.classList.add("vector-dialog-open");
    const focusTarget = els.actions.querySelector(".vector-dialog-btn--primary") || els.actions.querySelector(".vector-dialog-btn");
    if (focusTarget) focusTarget.focus();
    return new Promise((resolve) => {
        vectorDialogState.resolver = resolve;
    });
}

function vectorAlert(message, options) {
    return openVectorDialog({
        kind: (options && options.kind) || "info",
        message: message,
        confirmLabel: (options && options.confirmLabel) || "Close"
    });
}

function vectorConfirm(message, options) {
    return openVectorDialog({
        kind: "confirm",
        message: message,
        confirmLabel: (options && options.confirmLabel) || "Confirm",
        cancelLabel: (options && options.cancelLabel) || "Cancel",
        confirmFirst: options && options.confirmFirst
    });
}

const DEFAULT_HAT_WEIGHT = 10;
const MEDEVAC_TARGET_SHARE = 0.2;
let activeAirportDatabase = [];
let activeAirportDatabaseNeedsRebuild = true;
let cachedActiveAirportIcaoSet = null;
function markAirportDatabaseDirty() {
    activeAirportDatabaseNeedsRebuild = true;
    cachedActiveAirportIcaoSet = null;
}
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
function getStrictIlsAirportIcaoSet() {
    if (typeof ILS_STRICT_AIRPORT_ICAOS !== "undefined" && ILS_STRICT_AIRPORT_ICAOS) {
        return ILS_STRICT_AIRPORT_ICAOS;
    }
    return null;
}
function airportHasStrictIls(ap) {
    if (!ap || !ap.icao) return false;
    if (ap.hasIls === true) return true;
    const set = getStrictIlsAirportIcaoSet();
    return !!(set && set.has(normalizeIcao(ap.icao)));
}
function applyStrictIlsFlagsToAirport(ap) {
    if (!ap || !ap.icao) return ap;
    if (ap.hasIls === true) return ap;
    const set = getStrictIlsAirportIcaoSet();
    if (set && set.has(normalizeIcao(ap.icao))) {
        ap.hasIls = true;
    }
    return ap;
}
function specPrefersIlsDestinations(spec) {
    const tags = (spec && spec.tags) || [];
    return tags.includes("ILS_PREFERRED");
}
function formatDestinationIlsTicketLabel(ap) {
    return airportHasStrictIls(ap) ? "YES" : "NO";
}
function getNavigraphAirportIcaoSet() {
    if (typeof NAVIGRAPH_AIRPORT_ICAOS !== "undefined" && NAVIGRAPH_AIRPORT_ICAOS) {
        return NAVIGRAPH_AIRPORT_ICAOS;
    }
    return null;
}
function airportIsInNavigraph(ap) {
    if (!ap || !ap.icao) return false;
    const set = getNavigraphAirportIcaoSet();
    return !!(set && set.has(normalizeIcao(ap.icao)));
}
function getDestApproachTypesByIcaoMap() {
    if (typeof DEST_APPROACH_TYPES_BY_ICAO !== "undefined" && DEST_APPROACH_TYPES_BY_ICAO) {
        return DEST_APPROACH_TYPES_BY_ICAO;
    }
    return null;
}
function getDestinationApproachTypes(ap) {
    if (!ap || !ap.icao) return [];
    const map = getDestApproachTypesByIcaoMap();
    if (!map) return [];
    const types = map[normalizeIcao(ap.icao)];
    return Array.isArray(types) ? types : [];
}
function formatDestinationApproachTicketLabel(ap) {
    const types = getDestinationApproachTypes(ap);
    return types.length ? types.join(", ") : "—";
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

const GLIDER_MIN_ROUTE_NM = 35;
const GLIDER_MAX_ROUTE_NM = 70;
const GLIDER_LOCAL_ROUTE_NM = 35;

function buildGliderRoutePairs(validAirports, depOverride, spec) {
    const gliderFields = validAirports.filter(ap => isGliderSuitableAirport(ap, spec));
    const sources = depOverride
        ? gliderFields.filter(ap => ap.icao === depOverride)
        : gliderFields;
    const searchMax = GLIDER_MAX_ROUTE_NM;
    const latDelta = nmToLatDeltaDeg(searchMax + 5);
    const fieldGrid = buildAirportSpatialGrid(gliderFields, HELI_GRID_CELL_DEG);
    const crossCountryPairs = [];
    for (const src of sources) {
        const lonDelta = nmToLonDeltaDeg(searchMax + 5, src.lat);
        forEachAirportNearGrid(fieldGrid, src, HELI_GRID_CELL_DEG, latDelta, lonDelta, (dst) => {
            if (src.icao === dst.icao) return;
            if (!isGliderSuitableAirport(dst, spec)) return;
            const dist = calculateDistance(src.lat, src.lon, dst.lat, dst.lon);
            if (!dist || isNaN(dist)) return;
            if (dist >= GLIDER_MIN_ROUTE_NM && dist <= GLIDER_MAX_ROUTE_NM) {
                crossCountryPairs.push({ src, dst, dist });
            }
        });
    }
    if (crossCountryPairs.length > 0) {
        return capRoutePairPool(crossCountryPairs, HELI_ROUTE_PAIR_CAP);
    }
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
const ROUTING_SCOPE_LABELS = {
    worldwide: "Worldwide",
    americas: "Americas Only",
    row: "Europe & Rest of World",
};
function getRoutingScopeLabel(scope) {
    return ROUTING_SCOPE_LABELS[scope] || ROUTING_SCOPE_LABELS.worldwide;
}
function getDepartureRoutingScopeMismatchMessage(depOverride, scope) {
    if (!depOverride || scope === "worldwide") return null;
    const code = normalizeIcao(depOverride);
    if (!code) return null;
    const depAp = activeAirportDatabase.find(ap => normalizeIcao(ap.icao) === code);
    if (!depAp) return null;
    const airportRegion = getAirportRoutingRegion(depAp);
    if (airportRegion === scope) return null;
    const currentLabel = getRoutingScopeLabel(scope);
    const suggestedLabel = getRoutingScopeLabel(airportRegion);
    return `Routing Options: ${currentLabel} is selected; change this to ${suggestedLabel} or Worldwide for ${code}.`;
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
const SHORT_HAUL_BLOCK_TIME_PAD_MINS = 30;
const SHORT_HAUL_ROUTE_PLANNING_TRIM_MINS = 10;
// Scheduled commercial assignment band (70–80%): economic target for normal sectors, not a legal minimum.
// Ultra-long or weight-limited routes may assign below this when MTOW/fuel caps payload (ghost-flight economics).
const SCHEDULED_COMMERCIAL_LOAD_MIN = 0.70;
const SCHEDULED_COMMERCIAL_LOAD_MAX = 0.80;
const DEFAULT_SIMBRIEF_PAX_WEIGHT_KG = 79;
const DEFAULT_SIMBRIEF_BAGGAGE_PER_PAX_KG = 25;
const VINTAGE_PROPLINER_TYPES = new Set(["DC6A", "DC6B"]);
const VINTAGE_AIRFRAME_TYPES = new Set(["U16", "PA24", "FA50"]);
const STARSHIP_CRT_TYPES = new Set(["STAR"]);
const REGIONAL_JET_CRT_TYPES = new Set([
    "CRJ7", "E190", "E195", "F70", "F100", "F28",
    "B461", "B462", "B463", "RJ70", "RJ85", "RJ1H",
    "B462_QT", "B463_QT", "RJ1F"
]);
const TICKET_PHOTO_VINTAGE_TYPEWRITER_CPS = 28;
const TICKET_PHOTO_LED_TYPEWRITER_CPS = 44;
const HEAVY_JET_MTOW_MIN = 136000;
const FREIGHT_MISSION_TYPES = new Set([17, 18, 29, 33, 39]);
const PASSENGER_MISSION_TYPES = new Set([14, 15, 16, 19, 20, 21, 22, 25, 26, 27, 28, 30, 31, 34]);
function specHasPaxCapacity(spec) {
    return !!spec && (spec.maxPax || 0) > 0;
}
function specHasCargoCapacity(spec) {
    return !!spec && (spec.maxCargo || 0) > 0;
}
function getPaxWeightKg(spec) {
    const v = Number(spec && spec.paxWeightKg);
    return v > 0 ? v : DEFAULT_SIMBRIEF_PAX_WEIGHT_KG;
}
function getBaggagePerPaxKg(spec) {
    const v = Number(spec && spec.baggagePerPaxKg);
    return v > 0 ? v : DEFAULT_SIMBRIEF_BAGGAGE_PER_PAX_KG;
}
/** SimBrief passenger payload: body weight + per-pax baggage (airframe defaults, not URL cargo). */
function getPaxAllInWeightKg(spec) {
    return getPaxWeightKg(spec) + getBaggagePerPaxKg(spec);
}
function getSimBriefPassengerPayloadKg(spec, paxCount) {
    return Math.max(0, paxCount) * getPaxAllInWeightKg(spec);
}
function specIsHeavyJet(spec) {
    if (!spec || spec.class !== "JET") return false;
    if (spec.tags && spec.tags.includes("HEAVY")) return true;
    return (spec.mtow || 0) >= HEAVY_JET_MTOW_MIN;
}
/** Large military turboprops (A400-class) — require airliner/military strips, not local GA. */
function specIsHeavyAirlifter(spec) {
    return !!(spec && spec.tags && spec.tags.includes("HEAVY_AIRLIFTER"));
}
function passesHeavyAirlifterAirport(ap, spec) {
    if (!specIsHeavyAirlifter(spec) || !ap) return true;
    const minLen = Number(spec.minRunwayLength) || 0;
    const len = Number(ap.length) || 0;
    if (minLen > 0 && len > 0 && len < minLen) return false;
    const rwy = ap.rwy || "";
    if (rwy === "JET" || rwy === "BIZ JET") return true;
    if (ap.isMilitary && (rwy === "TURBO" || rwy === "JET")) return true;
    return false;
}
function requireMissionAssignmentsLoaded() {
    if (typeof usesMissionAssignments !== "function" || !usesMissionAssignments()) {
        throw new Error("VECTOR: mission assignments are required but not loaded.");
    }
}
function getMissionAssignmentsUnavailableMessage(type) {
    return "No missions are assigned to " + type + " in the mission editor. Assign briefings for this aircraft, export, regenerate mission-assignments-data.js, and hard-refresh (Ctrl+F5).";
}
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
    return !!(mission && [14, 15].includes(mission.type));
}
function getVipPassengerTarget(spec, blockMinutes, chosenMission) {
    const seats = spec.maxPax;
    if (!seats) return 0;
    const isBizJet = spec.class === "BIZ JET";
    const isLightExecutive = isBizJet
        || (spec.class === "TURBO" && seats <= 12)
        || (spec.class === "GA" && seats <= 8);
    if (isLightExecutive) {
        let loadFactor;
        if (blockMinutes < 75) loadFactor = 0.22;
        else if (blockMinutes < 150) loadFactor = 0.40;
        else if (blockMinutes < 240) loadFactor = 0.55;
        else if (blockMinutes < 360) loadFactor = 0.65;
        else loadFactor = 0.45;
        return Math.max(1, Math.min(seats, Math.floor(seats * loadFactor)));
    }
    if (spec.class === "HELI") {
        return Math.max(1, Math.min(seats, Math.floor(seats * 0.35)));
    }
    return Math.max(1, Math.floor(seats * 0.15));
}
function getPassengerLoadLimits(chosenMission, spec, maxSafePax, blockMinutes, scenario) {
    if (!missionRequiresPassengers(chosenMission, spec, scenario) || maxSafePax <= 0) {
        return { minPax: 0, effectiveMax: 0 };
    }
    const isScheduledCommercial = isScheduledCommercialMission(chosenMission);
    const isVipMission = chosenMission && (chosenMission.type === 16
        || chosenMission.pool === "executive");

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
    } else if (spec.class === "JET" && isPassengerMission(chosenMission)) {
        minPax = Math.floor(spec.maxPax * 0.5);
    } else if (isPassengerMission(chosenMission)) {
        minPax = 1;
    } else if (spec.class === "JET") {
        minPax = Math.floor(spec.maxPax * 0.5);
    }

    const effectiveMax = Math.min(maxPaxTarget, maxSafePax, spec.maxPax);
    if (effectiveMax < minPax) {
        // Below commercial target (fuel/MTOW cap) — partial loads OK, not forced to maxSafePax every time.
        minPax = Math.max(1, Math.floor(effectiveMax * SCHEDULED_COMMERCIAL_LOAD_MIN));
        if (minPax > effectiveMax) minPax = effectiveMax;
    }
    return { minPax, effectiveMax };
}
function isFreightMission(mission) {
    if (!mission) return false;
    if (FREIGHT_MISSION_TYPES.has(mission.type)) return true;
    if (mission.minCargo) return true;
    const pool = mission.pool || "";
    if (/freight/i.test(pool)) return true;
    const name = (mission.name || "").toLowerCase();
    return /\bfreight\b/.test(name) || /\bcargo\b/.test(name);
}
function isPassengerMission(mission) {
    if (!mission || isFreightMission(mission)) return false;
    if (PASSENGER_MISSION_TYPES.has(mission.type)) return true;
    const name = (mission.name || "").toLowerCase();
    if (/\bairliner\b/.test(name) || /\bpassenger\b/.test(name) || /\bcommuter\b/.test(name)) return true;
    if (mission.allowedAircraft && mission.allowedAircraft.length > 0) {
        return mission.allowedAircraft.every(code => {
            const acSpec = (typeof activeFleetSpecs !== "undefined" && activeFleetSpecs[code])
                || (typeof coreFleetSpecs !== "undefined" && coreFleetSpecs[code]);
            return acSpec && (acSpec.maxPax || 0) > 0;
        });
    }
    return false;
}
function isMilitaryTroopPassengerMission(mission) {
    if (!mission || !mission.militaryOnly) return false;
    const missionType = mission.type;
    return missionType === 24 || missionType === 30 || missionType === 31;
}
function scenarioRequiresPassengers(scenario) {
    if (!scenario) return false;
    if (scenario.requiresPax === false) return false;
    if (scenario.requiresPax === true || scenario.staffShuttle === true) return true;
    const payload = String(scenario.payload || "");
    if (/\{(name|athlete|musician|team|vip_type)\}/.test(payload)) return true;
    const text = `${payload} ${scenario.instruction || ""}`.toLowerCase();
    return /\b(passenger|passengers|personnel|staff|troop|troops|dignitar\w*|tourist\w*|travell?er\w*|student\w*|athlete\w*|executive\w*|witness\w*|musician\w*|holidaymaker\w*|patient\w*|surgeon\w*|commander\w*|\bvip\b|\bceo\b|families|family|people|delegat\w*|group of)\b/.test(text);
}
function missionRequiresPassengers(chosenMission, spec, scenario) {
    if (isFreightMission(chosenMission)) return false;
    if ((spec.maxPax || 0) <= 0) return false;
    // Scenario text/flags win for mixed pools (e.g. military logistics cargo vs personnel).
    if (scenarioRequiresPassengers(scenario)) return true;
    if (scenario && (chosenMission.type === 24 || chosenMission.pool === "militaryTransit-MIL")
        && scenario.requiresPax !== true && !scenario.staffShuttle) {
        // Cargo/ops briefing on a mixed logistics pool — do not force seats from mission type alone.
        return false;
    }
    if (isPassengerMission(chosenMission)) return true;
    const tags = spec.tags || [];
    if (!specHasPaxCapacity(spec)) return false;
    if (!specHasCargoCapacity(spec)) return true;
    // Dual-role military airlifters (C-130J, C-160, CH-47D, etc.): troop/passenger loads on logistics/heli missions.
    if (tags.includes("MILITARY_TRANSPORT") || tags.includes("MILITARY_HELI")) {
        return isMilitaryTroopPassengerMission(chosenMission);
    }
    return false;
}
function normalizeIcao(icao) {
    return (icao || "").trim().toUpperCase();
}
function estimateBaseBlockMinutes(distNm, spec, aircraftType) {
    const speed = getBlockSpeedForSpec(spec, aircraftType);
    if (!speed || !distNm) return 0;
    return Math.round((distNm / speed) * 60) + SHORT_HAUL_BLOCK_TIME_PAD_MINS;
}
function estimateBaseBlockMinutesForRoute(dist, spec, aircraftType) {
    return estimateBaseBlockMinutes(Math.round(dist), spec, aircraftType);
}
function getEffectiveBlockMinutes(targetMins, spec, aircraftType) {
    if (isGliderAircraft(spec)) return 45;
    if (isSliderIgnoredAircraft(spec)) return 20;
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
        return BLOCK_SPEED_KTS.JET;
    }
    if (spec.class === "BIZ JET") {
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
// Helicopter block time is fixed, not slider-driven (real heli hops run well under the
// short-haul slider's 40-min floor) — the UI hides the slider and shows this instead.
const HELI_FIXED_BLOCK_MINS = 30;
// Short-haul slider = target SimBrief block. Routing cruise subtracts SHORT_HAUL_BLOCK_TIME_PAD_MINS;
// pick/filter adds SIMBRIEF_OVERHEAD to proxy block so filed routes land near the slider.
const SHORT_HAUL_PRIMARY_DISTANCE_BAND = 0.12;
const SHORT_HAUL_RELAXED_DISTANCE_BAND = 0.28;
const SHORT_HAUL_SIMBRIEF_OVERHEAD_MINS = 12;
const SHORT_HAUL_SIMBRIEF_PICK_TOLERANCE_MINS = 10;
// Tiers 2/3 scale with the slider target instead of being flat minutes, so the
// proportional deviation stays similar at 40 min and at 120 min. Floor keeps
// them from ever being tighter than tier 1; cap keeps them from exceeding the
// old flat values at the high end of the slider (80-120 min was already fine).
const SHORT_HAUL_FALLBACK_TOLERANCE_PCT = 0.20;
const SHORT_HAUL_FALLBACK_TOLERANCE_FLOOR_MINS = 10;
const SHORT_HAUL_FALLBACK_TOLERANCE_CAP_MINS = 15;
const SHORT_HAUL_RELAXED_TOLERANCE_PCT = 0.30;
const SHORT_HAUL_RELAXED_TOLERANCE_FLOOR_MINS = 10;
const SHORT_HAUL_RELAXED_TOLERANCE_CAP_MINS = 20;
function getShortHaulFallbackToleranceMins(targetMins) {
    const raw = Math.round(Number(targetMins) * SHORT_HAUL_FALLBACK_TOLERANCE_PCT);
    return Math.min(SHORT_HAUL_FALLBACK_TOLERANCE_CAP_MINS, Math.max(SHORT_HAUL_FALLBACK_TOLERANCE_FLOOR_MINS, raw));
}
function getShortHaulRelaxedToleranceMins(targetMins) {
    const raw = Math.round(Number(targetMins) * SHORT_HAUL_RELAXED_TOLERANCE_PCT);
    return Math.min(SHORT_HAUL_RELAXED_TOLERANCE_CAP_MINS, Math.max(SHORT_HAUL_RELAXED_TOLERANCE_FLOOR_MINS, raw));
}
function estimateShortHaulBlockMinutesForRoute(dist, spec, aircraftType) {
    return estimateBaseBlockMinutesForRoute(dist, spec, aircraftType);
}
function getShortHaulSimbriefProxyBlockMinutes(dist, spec, aircraftType) {
    return estimateShortHaulBlockMinutesForRoute(dist, spec, aircraftType) + SHORT_HAUL_SIMBRIEF_OVERHEAD_MINS;
}
function passesShortHaulSimbriefTarget(dist, targetMins, spec, aircraftType, toleranceMins) {
    const proxy = getShortHaulSimbriefProxyBlockMinutes(dist, spec, aircraftType);
    const tol = Math.max(0, Number(toleranceMins) || 0);
    return proxy >= targetMins - tol && proxy <= targetMins + tol;
}
function getRouteDistanceLimits(targetMins, spec, aircraftType) {
    const blockSpeed = getBlockSpeedForSpec(spec, aircraftType);
    const effectiveMins = getEffectiveBlockMinutes(targetMins, spec, aircraftType);
    let targetDist = (blockSpeed * effectiveMins) / 60;
    const aircraftMax = getJetAllowedMaxGcNm(spec);
    const aircraftMin = spec.minD || 0;
    targetDist = Math.min(targetDist, aircraftMax === Infinity ? targetDist : aircraftMax);
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
function passesAircraftGatedAirport(ap, type) {
    if (!ap || !Array.isArray(ap.allowedAircraft) || ap.allowedAircraft.length === 0) return true;
    const aircraftType = (type || "").trim().toUpperCase();
    return ap.allowedAircraft.some(code => (code || "").trim().toUpperCase() === aircraftType);
}
function passesDispatchAirportFilters(ap, spec, type, overrideIcao, forceMilitaryBases, isContractorMode) {
    const apIcao = normalizeIcao(ap.icao);
    if (!passesAircraftGatedAirport(ap, type)) return false;
    if (spec.class === "JET" && JET_SIMBRIEF_EXCLUDED_ICAOS.has(apIcao) && apIcao !== overrideIcao) {
        return false;
    }
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
    if (!passesHeavyAirlifterAirport(ap, spec)) return false;
    return isAllowedType && finalMeetsLength;
}
function buildDispatchRoutingPools(depOverride, routingScope, spec, type, forceMilitaryBases, isContractorMode, navigraphOnly) {
    const overrideIcao = normalizeIcao(depOverride);
    const eligible = activeAirportDatabase.filter(ap =>
        passesDispatchAirportFilters(ap, spec, type, overrideIcao, forceMilitaryBases, isContractorMode)
    );
    let departureAirports = eligible;
    let destinationAirports = eligible;
    if (navigraphOnly) {
        destinationAirports = destinationAirports.filter((ap) => airportIsInNavigraph(ap));
    }
    if (routingScope === "worldwide") {
        return { departureAirports, destinationAirports };
    }
    const overrideIcaos = getRoutingOverrideIcaos(depOverride);
    const regionalDestinations = destinationAirports.filter(ap =>
        airportAllowedForRouting(ap, routingScope, overrideIcaos)
    );
    if (!overrideIcao) {
        return {
            departureAirports: departureAirports.filter(ap =>
                airportAllowedForRouting(ap, routingScope, overrideIcaos)
            ),
            destinationAirports: regionalDestinations
        };
    }
    const depAp = departureAirports.find(ap => normalizeIcao(ap.icao) === overrideIcao);
    return {
        departureAirports: depAp ? [depAp] : [],
        destinationAirports: regionalDestinations
    };
}
function pairPassesFixedDepartureBlockWindow(dist, routingTargetMins, spec, aircraftType, toleranceMins) {
    return passesShortHaulSimbriefTarget(dist, routingTargetMins, spec, aircraftType, toleranceMins);
}
function buildJetRoutePairs(sources, destinations, depOverride, destOverride, spec, minTarget, maxTarget, relaxedMin, relaxedMax, routingTargetMins, aircraftType) {
    const depCode = normalizeIcao(depOverride);
    const destCode = normalizeIcao(destOverride);
    if (depCode && destCode) {
        const src = sources.find(ap => normalizeIcao(ap.icao) === depCode);
        const dst = destinations.find(ap => normalizeIcao(ap.icao) === destCode);
        if (src && dst && normalizeIcao(src.icao) !== normalizeIcao(dst.icao)) {
            const dist = calculateDistance(src.lat, src.lon, dst.lat, dst.lon);
            if (dist && !isNaN(dist) && routeWithinAircraftRange(dist, spec)
                && isJetSimBriefRouteFeasible(dist, spec, src, dst)) {
                return { candidatePairs: [{ src, dst, dist }], usedRelaxedRouting: false };
            }
        }
        return { candidatePairs: [], usedRelaxedRouting: false };
    }
    const fixedDepShortHaul = !!(depCode && !isSliderIgnoredAircraft(spec));
    const candidatePairs = [];
    let usedRelaxedRouting = false;
    if (spec.class === "HELI") {
        return buildHelicopterRoutePairs(
            sources, destinations, depOverride, spec,
            minTarget, maxTarget, relaxedMin, relaxedMax
        );
    }
    let primaryPairs = [];
    const searchMax = Math.max(maxTarget, relaxedMax, minTarget);
    const latDelta = nmToLatDeltaDeg(searchMax + 10);
    const destGrid = buildAirportSpatialGrid(destinations, HELI_GRID_CELL_DEG);
    const jetFeasCtx = spec.class === "JET" ? buildJetRouteFeasibilityContext(spec) : null;
    const collectPairs = (distMin, distMax, toleranceMins) => {
        const found = [];
        for (const src of sources) {
            if (depCode && normalizeIcao(src.icao) !== depCode) continue;
            const lonDelta = nmToLonDeltaDeg(searchMax + 10, src.lat);
            forEachAirportNearGrid(destGrid, src, HELI_GRID_CELL_DEG, latDelta, lonDelta, (dst) => {
                if (destCode && normalizeIcao(dst.icao) !== destCode) return;
                if (normalizeIcao(src.icao) === normalizeIcao(dst.icao)) return;
                const dist = calculateDistance(src.lat, src.lon, dst.lat, dst.lon);
                if (!dist || isNaN(dist)) return;
                if (dist < distMin || dist > distMax) return;
                if (!routeWithinAircraftRange(dist, spec, fixedDepShortHaul ? { ignoreCatalogMinD: true } : undefined)) return;
                if (fixedDepShortHaul && !pairPassesFixedDepartureBlockWindow(dist, routingTargetMins, spec, aircraftType, toleranceMins)) {
                    return;
                }
                if (jetFeasCtx) {
                    if (!isJetRouteDistanceFeasible(dist, jetFeasCtx)) return;
                    if (!isJetSimBriefDepartureFeasible(dist, spec, src, jetFeasCtx)) return;
                }
                found.push({ src, dst, dist });
            });
        }
        return found;
    };
    if (fixedDepShortHaul) {
        // Pinned departure: block-time window defines feasible sectors, not catalog minD or cruise-distance band.
        candidatePairs.push(...collectPairs(0, relaxedMax, getShortHaulRelaxedToleranceMins(routingTargetMins)));
    } else {
        primaryPairs = collectPairs(minTarget, maxTarget, SHORT_HAUL_SIMBRIEF_PICK_TOLERANCE_MINS);
        if (primaryPairs.length === 0) {
            usedRelaxedRouting = true;
            candidatePairs.push(...collectPairs(relaxedMin, relaxedMax, getShortHaulRelaxedToleranceMins(routingTargetMins)));
        } else {
            candidatePairs.push(...primaryPairs);
        }
    }
    return { candidatePairs: capRoutePairPool(candidatePairs, JET_ROUTE_PAIR_CAP), usedRelaxedRouting };
}
function routeWithinAircraftRange(dist, spec, options) {
    const opts = options || {};
    const minD = opts.ignoreCatalogMinD ? 0 : (spec.minD || 0);
    const maxD = spec.class === "JET" ? getJetAllowedMaxGcNm(spec) : (spec.maxD || Infinity);
    return dist >= minD && dist <= maxD;
}
const HELI_ROUTE_PAIR_CAP = 8000;
const JET_ROUTE_PAIR_CAP = 12000;
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
        getShortHaulFallbackToleranceMins(targetMins),
        getShortHaulRelaxedToleranceMins(targetMins)
    ]) {
        const ranked = pool
            .map(rank)
            .filter((entry) => entry.proxy >= targetMins - tol && entry.proxy <= targetMins + tol)
            .sort((a, b) => {
                if (a.proxyDelta !== b.proxyDelta) return a.proxyDelta - b.proxyDelta;
                if (a.proxyOvershoot !== b.proxyOvershoot) return a.proxyOvershoot - b.proxyOvershoot;
                if (a.estDelta !== b.estDelta) return a.estDelta - b.estDelta;
                return a.estOvershoot - b.estOvershoot;
            });
        if (!ranked.length) continue;
        const weights = ranked.map((entry) => {
            const proximity = Math.max(1, SHORT_HAUL_SIMBRIEF_PICK_TOLERANCE_MINS - entry.proxyDelta);
            return proximity + getShortHaulPairRouteBoost(entry.pair, spec);
        });
        const total = weights.reduce((sum, w) => sum + w, 0);
        let roll = Math.random() * total;
        for (let i = 0; i < ranked.length; i++) {
            roll -= weights[i];
            if (roll <= 0) return ranked[i].pair;
        }
        return ranked[ranked.length - 1].pair;
    }
    // Nothing satisfied any tolerance band (e.g. HELI's fixed 30min target vs. the flat
    // fixed-wing SHORT_HAUL_BLOCK_TIME_PAD_MINS pad, which always overshoots it) — still
    // pick randomly, weighted toward the closest time fit, instead of deterministically
    // returning the single best match every time (that collapsed every dispatch onto the
    // same route whenever the candidate pool was small enough to skip HELI_ROUTE_PAIR_CAP's
    // random subsampling).
    const ranked = pool.map(rank).sort((a, b) => a.proxyDelta - b.proxyDelta);
    const weights = ranked.map((entry) => 1 / (1 + entry.proxyDelta));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < ranked.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return ranked[i].pair;
    }
    return ranked[ranked.length - 1].pair;
}
function pickRouteByTimeFit(pool, targetMins, targetDistNm, spec, aircraftType) {
    if (!pool.length) return null;
    return pickShortHaulRoute(pool, targetMins, spec, aircraftType);
}
function getActiveAirportIcaoSet() {
    if (!activeAirportDatabaseNeedsRebuild && cachedActiveAirportIcaoSet) {
        return cachedActiveAirportIcaoSet;
    }
    const set = new Set();
    const db = typeof activeAirportDatabase !== "undefined" ? activeAirportDatabase : [];
    db.forEach((ap) => {
        if (ap && ap.icao) set.add(normalizeIcao(ap.icao));
    });
    cachedActiveAirportIcaoSet = set;
    return set;
}
function isIcaoInActiveAirportDatabase(icao) {
    if (!icao) return false;
    return getActiveAirportIcaoSet().has(normalizeIcao(icao));
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
    const inputValue = document.getElementById("aircraftInput").value.trim();
    return resolveAircraftTypeFromInput(inputValue);
}
function aircraftMatchesFilter(type, spec, filterText) {
    if (!filterText) return true;
    const lower = filterText.trim().toLowerCase();
    if (!lower) return true;
    if (spec.name && spec.name.toLowerCase().includes(lower)) return true;
    if (type && type.toLowerCase().includes(lower)) return true;
    if (spec.simbriefIcao && spec.simbriefIcao.toLowerCase().includes(lower)) return true;
    return false;
}
function resolveAircraftTypeFromInput(inputValue) {
    const raw = (inputValue || "").trim();
    if (!raw || typeof activeFleetSpecs === "undefined") return null;
    const upper = raw.toUpperCase();
    if (activeFleetSpecs[raw]) return raw;
    const exactKey = Object.keys(activeFleetSpecs).find(key => key.toUpperCase() === upper);
    if (exactKey) return exactKey;
    const exactName = Object.keys(activeFleetSpecs).find(key => activeFleetSpecs[key].name === raw);
    if (exactName) return exactName;
    const simbriefMatches = Object.keys(activeFleetSpecs).filter(key => {
        const spec = activeFleetSpecs[key];
        return (spec.simbriefIcao || key).toUpperCase() === upper;
    });
    if (simbriefMatches.length === 1) return simbriefMatches[0];
    return null;
}
function updateFlightTimeDisplay() {
    const slider = document.getElementById("timeSlider");
    const timeVal = document.getElementById("timeVal");
    const timeUnit = document.getElementById("timeUnit");
    if (!slider || !timeVal) return;
    const mins = parseInt(slider.value, 10);
    timeVal.innerText = String(mins);
    const min = parseInt(slider.min, 10) || 40;
    const max = parseInt(slider.max, 10) || 120;
    const pct = max > min ? ((mins - min) / (max - min)) * 100 : 0;
    slider.style.setProperty("--slider-fill-pct", pct + "%");
    if (timeUnit) {
        timeUnit.innerText = "mins";
        timeUnit.className = "";
        timeUnit.style.display = "";
    }
    saveFlightTimeMinutes(mins);
}
function initFlightTimeSlider(useSavedValue) {
    const slider = document.getElementById("timeSlider");
    const heading = document.getElementById("timeSliderHeading");
    if (!slider) return;
    slider.style.display = "";
    slider.disabled = false;
    if (heading) {
        heading.style.display = "";
        heading.innerHTML = 'Block Time: <span id="timeVal">60</span> <span id="timeUnit">mins</span>';
    }
    const cfg = SHORT_HAUL_SLIDER;
    slider.min = cfg.min;
    slider.max = cfg.max;
    slider.step = cfg.step;
    slider.value = useSavedValue ? getSavedFlightTimeMinutes() : cfg.defaultValue;
    slider.setAttribute("list", cfg.listId);
    updateFlightTimeDisplay();
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
        vectorAlert("Please specify a valid callsign prefix.");
        return;
    }
    localStorage.setItem("dispatcher_saved_callsign", cs);
    refreshBoardFlightLabels();
    vectorAlert(`Callsign ${cs} saved to local memory configuration.`);
}
function saveOwnedAirports() {
    const input = document.getElementById("ownedAirportsInput").value;
    const toggle = document.getElementById("preferOwnedToggle").checked;
    localStorage.setItem("dispatcher_owned_airports", input);
    localStorage.setItem("dispatcher_prefer_owned", toggle ? "true" : "false");
    // Refresh the stats immediately
    updateDatabaseStats();
    vectorAlert("Owned airports configuration saved to local memory!");
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
function stripIrlNameSuffix(name) {
    if (!name) return name;
    return String(name).replace(/\s*\(IRL:\s*[^)]+\)/gi, "").trim();
}
function loadSettings() {
    const savedCallsign = localStorage.getItem("dispatcher_saved_callsign");
    if (savedCallsign) {
        document.getElementById("callsignInput").value = savedCallsign;
    }
    setMode("dark");
    // --- New Load Logic ---
    const ownedList = localStorage.getItem("dispatcher_owned_airports");
    if (ownedList) {
        document.getElementById("ownedAirportsInput").value = ownedList;
    }
    const preferOwned = localStorage.getItem("dispatcher_prefer_owned") === "true";
    document.getElementById("preferOwnedToggle").checked = preferOwned;
    loadRoutingScope();
    initRoutingScope();
    initFlightTimeSlider(true);
    syncContractorMilitaryOptions();
}

const BOARD_TICKET_KICKERS = [
    "EXECUTIVE SHUTTLE",
    "VIP CHARTER",
    "NETWORK EFFICIENCY"
];

let boardContractResults = [];
let boardSelectedIndex = -1;
let boardTicketsDealt = false;

function pickScenarioPlaceholderValues(origin, destination) {
    const pick = (arr) => (Array.isArray(arr) && arr.length)
        ? arr[Math.floor(Math.random() * arr.length)]
        : "";
    const depField = (origin && (origin.icao || origin.name)) || "the departure field";
    const destField = (destination && (destination.icao || destination.name)) || "the destination field";
    return {
        athlete: pick(typeof athletes !== "undefined" ? athletes : []),
        name: pick(typeof names !== "undefined" ? names : []),
        team: pick(typeof teams !== "undefined" ? teams : []),
        musician: pick(typeof musician !== "undefined" ? musician : []),
        industry: pick(typeof industry !== "undefined" ? industry : []),
        cargo_type: pick(typeof cargoType !== "undefined" ? cargoType : []),
        med_cargo: pick(typeof medCargo !== "undefined" ? medCargo : []),
        vip_type: pick(typeof vipType !== "undefined" ? vipType : []),
        sci_fi: pick(typeof sciFi !== "undefined" ? sciFi : []),
        dep_field: depField,
        dest_field: destField
    };
}

function resolveScenarioText(text, picks) {
    return String(text || "").replace(/\{(\w+)\}/g, (match, key) => {
        if (picks && picks[key] != null && picks[key] !== "") return picks[key];
        return match;
    });
}

function getScenarioSourceText(result) {
    const scenario = result && result.scenario;
    if (scenario) {
        return `${scenario.payload || ""} ${scenario.instruction || ""}`;
    }
    return `${result.rPayload || ""} ${result.rInstruction || ""}`;
}

function isMedevacJobTitle(result) {
    return /\bmedevac\b/i.test(getScenarioSourceText(result));
}

function isDiplomaticJobTitle(result) {
    const raw = getScenarioSourceText(result);
    const text = raw.toLowerCase();
    if (/\bdiplomat|\bdiplomatic\b|\bstate rep|\bpolitician/.test(text)) return true;
    const picks = result.scenarioPicks || {};
    if (/\{vip_type\}/.test(raw) && /diplomat/.test(String(picks.vip_type || "").toLowerCase())) return true;
    const resolved = `${result.rPayload || ""} ${result.rInstruction || ""}`.toLowerCase();
    return /\bglobal diplomat\b/.test(resolved);
}

function isCelebrityJobTitle(result) {
    const scenario = result && result.scenario;
    const raw = scenario
        ? `${scenario.payload || ""} ${scenario.instruction || ""}`
        : `${result.rPayload || ""} ${result.rInstruction || ""}`;
    if (/\{(name|athlete|musician)\}/.test(raw)) return true;
    const text = raw.toLowerCase();
    return /celebrity|music icon|high-profile music/.test(text);
}

function getScenarioJobTitle(result) {
    if (!result) return "";
    return (result.scenario && result.scenario.title) || "";
}

function resolveContractJobTitle(result, ticketIndex) {
    if (!result) {
        return ticketIndex != null ? (BOARD_TICKET_KICKERS[ticketIndex] || "CONTRACT") : "CONTRACT";
    }
    const scenarioTitle = getScenarioJobTitle(result);
    if (scenarioTitle) return scenarioTitle;
    if (isMedevacJobTitle(result)) return "Medevac Charter";
    if (isDiplomaticJobTitle(result)) return "Diplomatic Charter";
    if (isCelebrityJobTitle(result)) return "VIP Charter";
    const mission = result.chosenMission;
    const name = mission && mission.name ? mission.name : "";
    if (/^executive vip charter$/i.test(name)) return "Executive Charter";
    if (name) return name;
    return ticketIndex != null ? (BOARD_TICKET_KICKERS[ticketIndex] || "CONTRACT") : "CONTRACT";
}

function getContractResultSignature(result) {
    if (!result) return "";
    const mission = result.chosenMission || {};
    return [
        mission.type,
        result.origin && result.origin.icao,
        result.destination && result.destination.icao,
        result.scenarioImgId,
        result.rPayload,
        result.rInstruction
    ].join("|");
}

function getBoardScenarioKey(result) {
    if (!result) return "";
    const id = result.scenarioImgId != null ? result.scenarioImgId : result.imageId;
    return id != null ? String(id) : "";
}

function isDuplicateBoardScenario(results, candidate) {
    const key = getBoardScenarioKey(candidate);
    if (!key) return false;
    return results.some((r) => getBoardScenarioKey(r) === key);
}

function finalizeBoardContractResults(results) {
    if (!results.length) return results;
    const unique = [];
    results.forEach((entry) => {
        const sig = getContractResultSignature(entry);
        if (unique.some((u) => getContractResultSignature(u) === sig)) return;
        if (isDuplicateBoardScenario(unique, entry)) return;
        unique.push(entry);
    });
    const out = unique.slice(0, 3);
    if (unique.length === 1) {
        while (out.length < 3) {
            out.push(Object.assign({}, unique[0], {
                _duplicateUnavailable: true,
                _exportBundle: unique[0]._exportBundle
            }));
        }
    }
    return out;
}
let boardPlnObjectUrls = [];

function boardTabGo(tab) {
    const contractsPanel = document.getElementById("contractsBoardPanel");
    const logbookPanel = document.getElementById("logbookPanel");
    const settingsPanel = document.getElementById("settingsPanel");
    const contractsTabBtn = document.getElementById("boardTabContracts");
    const logbookTabBtn = document.getElementById("boardTabLogbook");
    const settingsTabBtn = document.getElementById("boardTabSettings");

    const showContracts = tab === "contracts";
    const showLogbook = tab === "logbook";
    const showSettings = tab === "settings";

    if (contractsPanel) contractsPanel.classList.toggle("is-active", showContracts);
    if (logbookPanel) logbookPanel.classList.toggle("is-active", showLogbook);
    if (settingsPanel) settingsPanel.classList.toggle("is-active", showSettings);

    if (contractsTabBtn) {
        contractsTabBtn.classList.toggle("is-active", showContracts);
        contractsTabBtn.setAttribute("aria-selected", showContracts ? "true" : "false");
    }
    if (logbookTabBtn) {
        logbookTabBtn.classList.toggle("is-active", showLogbook);
        logbookTabBtn.setAttribute("aria-selected", showLogbook ? "true" : "false");
    }
    if (settingsTabBtn) {
        settingsTabBtn.classList.toggle("is-active", showSettings);
        settingsTabBtn.setAttribute("aria-selected", showSettings ? "true" : "false");
    }

    if (showLogbook) updateLogbookUI();
}

function computePrestigePoints(distanceNm, spec, fromContractsBoard) {
    const dist = Math.max(0, Number(distanceNm) || 0);
    let mult = 1.0;
    const cls = spec && spec.class;
    if (cls === "JET") mult = 1.5;
    else if (cls === "TURBO" || cls === "BIZ JET") mult = 1.2;
    const contractBonus = fromContractsBoard ? 0.10 : 0;
    return Math.max(1, Math.round(dist * mult * (1 + contractBonus)));
}

// Ticket-only overrides for names that still run to 2 lines on the job ticket after the
// prefix/suffix strip below. Keyed on the post-strip label so fleet-db.js names stay full
// everywhere else (Aircraft Type list, etc.) — only the ticket rendering gets the shorter text.
const BOARD_AIRCRAFT_DISPLAY_NAME_OVERRIDES = {
    "Cessna Citation Longitude Model 700": "Citation Longitude 700",
    "BAe Systems Avro RJ100 QT Freighter": "Avro RJ100 QT Freighter"
};
/** Strip developer prefix and redundant type suffixes from fleet display names for ticket UI. */
function formatBoardAircraftDisplayName(name) {
    const raw = String(name || "").trim();
    const sep = raw.indexOf(" - ");
    let label = sep > 0 ? (raw.slice(sep + 3).trim() || raw) : raw;
    label = label.replace(/\s*\((Freighter|Passenger|Cargo|Turbo|Piston|Pressurized)\)\s*$/i, "").trim();
    if (BOARD_AIRCRAFT_DISPLAY_NAME_OVERRIDES[label]) return BOARD_AIRCRAFT_DISPLAY_NAME_OVERRIDES[label];
    return label;
}

function fillBoardRouteCells(card, origin, destination) {
    const ownedList = getOwnedAirportList();
    const setIcao = (role, airport) => {
        const el = card.querySelector(`[data-role="${role}"]`);
        if (!el) return;
        const icao = airport && airport.icao ? String(airport.icao).toUpperCase() : "";
        if (!icao) {
            el.textContent = "—";
            return;
        }
        if (ownedList.includes(icao)) {
            el.innerHTML = `<span class="owned-airport-icao">${escapeHtml(icao)}</span>`;
        } else {
            el.textContent = icao;
        }
    };
    setIcao("dep-icao", origin);
    setIcao("arr-icao", destination);
    const routeEl = card.querySelector('[data-role="route"]');
    if (routeEl) {
        const depIcao = origin && origin.icao ? String(origin.icao).trim() : "";
        const arrIcao = destination && destination.icao ? String(destination.icao).trim() : "";
        const isLong = depIcao.length > 4 || arrIcao.length > 4;
        routeEl.classList.toggle("contract-ticket-route--long-icao", isLong);
    }
}

function formatBoardTicketMetaHtml(result) {
    // Job-ticket meta is intentionally compact: aircraft, pax/cargo, then destination aids.
    const aircraftLine = `<span class="contract-ticket-meta-key">ACFT:</span> ${escapeHtml(formatBoardAircraftDisplayName(result.spec.name))}`;
    const altFeet = Number(result.altFeet) || 0;
    const crzAltText = altFeet < 1000
        ? `${String(Math.round(altFeet))}ft`
        : altFeet < 10000
            ? `${String(Math.round(altFeet)).padStart(4, "0")}ft`
            : `FL${String(Math.round(altFeet / 100)).padStart(3, "0")}`;
    const crzAltLine = `<span class="contract-ticket-meta-key">CRZ ALT:</span> ${escapeHtml(crzAltText)}`;
    const pax = Number(result.pax) || 0;
    const weightKg = Number(result.cargoKg) || 0;
    const payloadLine = `<span class="contract-ticket-meta-key">PAX</span> ${escapeHtml(String(pax))} <span class="contract-ticket-meta-key">/</span> <span class="contract-ticket-meta-key">CARGO</span> ${escapeHtml(`${weightKg.toLocaleString("en-GB")} KG`)}`;
    const destDivider = `<span class="contract-ticket-meta-divider" aria-hidden="true"></span>`;
    const destIlsLine = `<span class="contract-ticket-meta-key">DESTINATION HAS ILS:</span> ${escapeHtml(formatDestinationIlsTicketLabel(result.destination))}`;
    const destApprLine = `<span class="contract-ticket-meta-key">OTHER:</span> ${escapeHtml(formatDestinationApproachTicketLabel(result.destination))}`;
    const navigraphLine = `<span class="contract-ticket-meta-key">NAVIGRAPH:</span> ${airportIsInNavigraph(result.destination) ? "YES" : "NO"}`;
    const wrapMetaLine = (line) => `<span class="contract-ticket-meta-line">${line}</span>`;
    return [
        wrapMetaLine(aircraftLine),
        wrapMetaLine(crzAltLine),
        wrapMetaLine(payloadLine),
        destDivider,
        wrapMetaLine(destIlsLine),
        wrapMetaLine(destApprLine),
        wrapMetaLine(navigraphLine)
    ].join("");
}

function revokeBoardPlnUrls() {
    boardPlnObjectUrls.forEach((url) => {
        try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
    });
    boardPlnObjectUrls = [];
}

function buildDispatchExportBundle(result) {
    const {
        spec, type, chosenMission, origin, destination, distanceNm, targetMins,
        callsignRaw, isLocalFlight, altFeet, pax, cargoKg, imageId
    } = result;
    const depDisplayName = stripIrlNameSuffix(origin.name);
    const destDisplayName = stripIrlNameSuffix(destination.name);
    const cargoParam = (cargoKg / 1000).toFixed(3);
    const manualZfw = getSimBriefZfwTonnes(spec, pax, cargoKg);
    const isGlider = spec.class === "GLIDER";
    const dispatchType = (spec.simbriefIcao || type || "").toUpperCase();

    let flightCounter = parseInt(localStorage.getItem("dispatcher_flt_num"), 10) || 1;
    const paddedFltNum = String(flightCounter).padStart(3, "0");
    const nextFlightCounter = flightCounter >= 999 ? 1 : flightCounter + 1;
    localStorage.setItem("dispatcher_flt_num", String(nextFlightCounter));

    const airlineMatch = callsignRaw.match(/^[A-Z]+/);
    const dynamicAirline = airlineMatch ? airlineMatch[0].substring(0, 3) : "VEC";
    const simbriefAlt = (altFeet / 100).toString().padStart(3, "0");
    const simbriefUrl = `https://www.simbrief.com/system/dispatch.php?share=1&type=${dispatchType}&orig=${origin.icao}&dest=${destination.icao}&airline=${dynamicAirline}&fltnum=${paddedFltNum}&callsign=${callsignRaw}&fl=${simbriefAlt}&pax=${pax}&cargo=${cargoParam}&manualzfw=${manualZfw}&units=KGS`;

    const navDep = airportIsInNavigraph(origin);
    const navDest = airportIsInNavigraph(destination);
    const simbriefClassOk = spec.class !== "GLIDER" && spec.class !== "HELI" && spec.class !== "WARBIRD";
    const isSimbriefSupported = simbriefClassOk && navDep && navDest;
    let heliMessage = "";

    const depElevStr = origin.elev || 0;
    const arrElevStr = destination.elev || 0;
    const depLLA = getMSFSLLA(origin.lat, origin.lon, depElevStr);
    const destLLA = getMSFSLLA(destination.lat, destination.lon, arrElevStr);
    const isIfr = (chosenMission.type === 5 || altFeet >= 10000);
    const localWptLLA = isLocalFlight ? getMSFSLLA(origin.lat + 0.2, origin.lon, altFeet) : "";
    const xmlString = generatePlnXml({
        originIcao: origin.icao,
        destIcao: destination.icao,
        originName: depDisplayName.replace(/&/g, "&amp;"),
        destName: destDisplayName.replace(/&/g, "&amp;"),
        depLLA,
        destLLA,
        localWptLLA,
        isIfr,
        altValue: altFeet.toString()
    });
    const blob = new Blob([xmlString], { type: "text/xml" });
    const plnUrl = URL.createObjectURL(blob);
    boardPlnObjectUrls.push(plnUrl);

    const durationMins = (spec.class === "HELI" || spec.class === "GLIDER")
        ? 20
        : targetMins;

    const prestigePoints = computePrestigePoints(distanceNm, spec, true);

    return {
        simbriefUrl,
        isSimbriefSupported,
        heliMessage,
        plnUrl,
        plnFilename: `${origin.icao}_to_${destination.icao}.pln`,
        prestigePoints,
        pendingFlight: {
            orig: origin.icao,
            dest: destination.icao,
            aircraft: spec.name,
            mission: resolveContractJobTitle(result),
            durationMins,
            payout: result.payout,
            prestigePoints
        },
        imageUrl: imageId != null ? missionImageUrl(`mission${imageId}.jpg`) : ""
    };
}

function getSelectedFlightRulesMode() {
    const vfrBtn = document.getElementById("vfrRulesBtn");
    return vfrBtn && vfrBtn.classList.contains("is-active") ? "VFR" : "IFR";
}

function setFlightRulesMode(mode) {
    const resolved = mode === "VFR" ? "VFR" : "IFR";
    const vfrBtn = document.getElementById("vfrRulesBtn");
    const ifrBtn = document.getElementById("ifrRulesBtn");
    if (vfrBtn) {
        vfrBtn.classList.toggle("is-active", resolved === "VFR");
        vfrBtn.setAttribute("aria-pressed", resolved === "VFR" ? "true" : "false");
    }
    if (ifrBtn) {
        ifrBtn.classList.toggle("is-active", resolved === "IFR");
        ifrBtn.setAttribute("aria-pressed", resolved === "IFR" ? "true" : "false");
    }
    try { localStorage.setItem("dispatcher_flight_rules_mode", resolved); } catch (e) {}
    applyFlightRulesModeToBoard(resolved);
}

// Highest legal VFR cruising altitude (eastbound, odd thousand + 500), just below the
// 18,000ft Class A floor. If an aircraft's own minimum cruise altitude is already above
// this, VFR is never actually achievable for it, so the button is hidden rather than
// left selectable with no real effect.
const VFR_MAX_LEGAL_ALT = 17500;
function updateFlightRulesButtonAvailability(spec) {
    const vfrBtn = document.getElementById("vfrRulesBtn");
    if (!vfrBtn) return;
    const vfrPossible = !spec || (Number(spec.minAlt) || 0) <= VFR_MAX_LEGAL_ALT;
    vfrBtn.style.display = vfrPossible ? "" : "none";
    if (!vfrPossible && vfrBtn.classList.contains("is-active")) {
        setFlightRulesMode("IFR");
    }
}

// Re-rounds the already-dispatched cruise altitude for every ticket currently on the
// board when VFR/IFR is toggled post-generation, instead of requiring a full regenerate.
// altFeetBase (whole thousand, hemispheric-correct) never changes — only whether the
// VFR +500ft is added on top of it — so the route/payload/mission stay exactly as dispatched.
// VFR is only legal below 18,000ft MSL (Class A floor in the US) — 17,500ft eastbound /
// 16,500ft westbound are the highest legal VFR cruising altitudes, so toggling VFR on an
// already-dispatched high-altitude ticket (e.g. a jet at FL350) must re-cap down to that,
// not just add 500 to whatever altitude was already picked under IFR.
function applyFlightRulesModeToBoard(mode) {
    const resolved = mode === "VFR" ? "VFR" : "IFR";
    if (typeof boardContractResults === "undefined" || !Array.isArray(boardContractResults) || !boardContractResults.length) return;
    let changed = false;
    boardContractResults.forEach((result) => {
        if (!result || typeof result.altFeetBase !== "number") return;
        let newAltFeet = result.altFeetBase;
        if (resolved === "VFR") {
            const vfrCeilingThousands = result.isEasterly ? 17 : 16;
            newAltFeet = Math.min(result.altFeetBase, vfrCeilingThousands * 1000) + 500;
        }
        if (result.altFeet !== newAltFeet) {
            result.altFeet = newAltFeet;
            result._exportBundle = buildDispatchExportBundle(result);
            changed = true;
        }
    });
    if (changed && typeof renderContractsBoard === "function") {
        renderContractsBoard(boardContractResults, { inactive: false });
    }
}

function getDispatchUiProbeConfig() {
    const aircraftType = resolveAircraftTypeFromInput(document.getElementById("aircraftInput").value.trim());
    const spec = aircraftType && typeof activeFleetSpecs !== "undefined" ? activeFleetSpecs[aircraftType] : null;
    const targetMins = (spec && spec.class === "HELI")
        ? HELI_FIXED_BLOCK_MINS
        : parseInt(document.getElementById("timeSlider").value, 10);
    return {
        aircraftType: aircraftType,
        targetMins: targetMins,
        callsign: document.getElementById("callsignInput").value,
        depOverride: document.getElementById("depOverrideInput").value,
        isContractorMode: document.getElementById("contractorToggle").checked,
        militaryBasesToggle: document.getElementById("militaryBaseToggle").checked,
        preferOwned: document.getElementById("preferOwnedToggle").checked,
        navigraphOnly: document.getElementById("navigraphOnlyToggle").checked,
        routingScope: getRoutingScope(),
        flightRulesMode: getSelectedFlightRulesMode(),
        preferLowerCruise: !!(document.getElementById("preferLowerCruiseToggle") && document.getElementById("preferLowerCruiseToggle").checked),
        mutateHistory: true
    };
}

function getLogbookFlightCount() {
    return getLogbookEntries().length;
}

function getBoardFlightNumber(ticketIndex) {
    const raw = getLogbookFlightCount() + ticketIndex + 1;
    // Cycle 1–999, then reset to 001.
    return ((raw - 1) % 999) + 1;
}

function getBoardCallsignPrefix() {
    const input = document.getElementById("callsignInput");
    const raw = ((input && input.value) || localStorage.getItem("dispatcher_saved_callsign") || "VEC")
        .trim()
        .toUpperCase();
    const prefix = raw.replace(/[^A-Z0-9]/g, "").substring(0, 3);
    return prefix || "VEC";
}

function formatBoardFlightSeq(ticketIndex) {
    return String(getBoardFlightNumber(ticketIndex)).padStart(3, "0");
}

function formatBoardFlightLabel(ticketIndex) {
    return `FLIGHT# ${getBoardCallsignPrefix()}${formatBoardFlightSeq(ticketIndex)}`;
}

/** Stable faux job-desk reference, ending with the three-digit mission image ID. */
function formatBoardJobRef(result, ticketIndex) {
    const prefix = getBoardCallsignPrefix();
    const num = String(getBoardFlightNumber(ticketIndex) % 100).padStart(2, "0");
    const imageId = getContractScenarioImgId(result);
    const missionRef = imageId != null ? String(imageId).padStart(3, "0").slice(-3) : "---";
    return `#REF-${prefix}-${num}/${missionRef}`;
}

function refreshBoardFlightLabels() {
    const cards = document.querySelectorAll("#contractsTicketGrid .contract-ticket");
    cards.forEach((card, i) => {
        const labelEl = card.querySelector('[data-role="photo-label"]');
        if (labelEl) labelEl.textContent = formatBoardFlightLabel(i);
        const result = boardContractResults[i];
        const refEl = card.querySelector('[data-role="ref"]');
        if (refEl && result && result.origin && result.destination) {
            refEl.textContent = formatBoardJobRef(result, i);
        }
    });
}

const TICKET_PHOTO_FX_STORAGE_KEY = "vector_ticket_photo_fx_v1";
const TICKET_FX_USER_SETTINGS_KEY = "vector_ticket_fx_user_settings_v1";
const TICKET_PHOTO_FX_MODES = ["static", "crt"];
const TICKET_FX_PROFILE_MODES = ["crt-standard", "crt-military", "crt-vintage", "crt-business", "crt-commercial", "crt-regional", "crt-starship", "crt-helicopter"];
const TICKET_PHOTO_TYPEWRITER_CPS = 40;
const CRT_BRIEF_VISIBLE_LINES = 9;
const CRT_BRIEF_MAX_LINES = CRT_BRIEF_VISIBLE_LINES * 2;
const CRT_BRIEF_CHARS_PER_LINE = 28;
const TICKET_PHOTO_MATRIX_CHARS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789ZYXWVUTSRQPONMLK";
const HUSH_MONEY_SCENARIO_BONUS = 25000;
const HUSH_MONEY_SCENARIO_IMG_IDS = new Set([183, 204]);
const TICKET_PHOTO_MATRIX_INTRO_MS = 4500;
const PHOTO_FILTER_PREVIEW_MISSION_FILE = "mission5.jpg";
const PHOTO_FILTER_PREVIEW_CRT_FILE = "images/photo-filter-crt.png";
const PHOTO_FILTER_PREVIEW_BRIEF = "Priority cargo lift — maintain assigned corridor, report position at waypoint BRAVO, and confirm cargo secure before final approach.";
const photoFilterPreviewCrtState = { timer: null, briefEl: null };
const ticketPhotoCrtState = { timer: null, columnTimers: [], resolveTimer: null, slot: null, matrixFinishing: false };
let ticketFxProfilesCache = { groupDefaults: {}, aircraftOverrides: {}, matrixMissionRules: {} };

function isTicketFxProfileMode(value) {
    return TICKET_FX_PROFILE_MODES.includes(value);
}

function getTicketFxProfiles() {
    const clean = { groupDefaults: {}, aircraftOverrides: {}, matrixMissionRules: {} };
    ["groupDefaults", "aircraftOverrides"].forEach((key) => {
        Object.entries(ticketFxProfilesCache[key] || {}).forEach(([id, fx]) => {
            if (isTicketFxProfileMode(fx)) clean[key][String(id).toUpperCase()] = fx;
        });
    });
    Object.entries(ticketFxProfilesCache.matrixMissionRules || {}).forEach(([imgId, rule]) => {
        if (/^\d+$/.test(imgId) && rule && rule.enabled === true) {
            clean.matrixMissionRules[imgId] = { enabled: true, variant: rule.variant === "monolith" ? "monolith" : "alien" };
        }
    });
    return clean;
}

function readTicketFxUserSettings() {
    try { return JSON.parse(localStorage.getItem(TICKET_FX_USER_SETTINGS_KEY) || "{}") || {}; }
    catch (e) { return {}; }
}

function reloadTicketFxProfiles() {
    const defaults = (window.VECTOR_DEFAULT_SETTINGS && window.VECTOR_DEFAULT_SETTINGS.ticketFx) || {};
    const personal = readTicketFxUserSettings();
    ticketFxProfilesCache = {
        groupDefaults: Object.assign({}, defaults.groupDefaults || {}, personal.groupDefaults || {}),
        aircraftOverrides: Object.assign({}, defaults.aircraftOverrides || {}, personal.aircraftOverrides || {}),
        matrixMissionRules: Object.assign({}, defaults.matrixMissionRules || {}, personal.matrixMissionRules || {})
    };
    applyTicketFxToRenderedCards();
    return getTicketFxProfiles();
}

function saveTicketFxUserSettings(settings) {
    localStorage.setItem(TICKET_FX_USER_SETTINGS_KEY, JSON.stringify(settings || {}));
    reloadTicketFxProfiles();
}

function isMatrixMissionEnabled(scenarioImgId) {
    if (scenarioImgId == null) return false;
    const rule = getTicketFxProfiles().matrixMissionRules[String(scenarioImgId)];
    return !!(rule && rule.enabled);
}

function getMatrixMissionConfig(scenarioImgId) {
    const rule = getTicketFxProfiles().matrixMissionRules[String(scenarioImgId)];
    return rule && rule.enabled ? { variant: rule.variant === "monolith" ? "monolith" : "alien" } : null;
}

function getGlobalTicketFxFallback() {
    try {
        const stored = localStorage.getItem(TICKET_PHOTO_FX_STORAGE_KEY);
        const defaultMode = (window.VECTOR_DEFAULT_SETTINGS || {}).ticketPhotoFilterFx;
        return TICKET_PHOTO_FX_MODES.includes(stored) ? stored : (TICKET_PHOTO_FX_MODES.includes(defaultMode) ? defaultMode : "static");
    } catch (e) {
        const defaultMode = (window.VECTOR_DEFAULT_SETTINGS || {}).ticketPhotoFilterFx;
        return TICKET_PHOTO_FX_MODES.includes(defaultMode) ? defaultMode : "static";
    }
}

function resolveTicketFxForResult(result) {
    const spec = (result && result.spec) || {};
    let type = String((result && (result.aircraftType || result.type)) || "").toUpperCase();
    const matchingFleetType = typeof activeFleetSpecs !== "undefined"
        ? Object.keys(activeFleetSpecs).find((key) => {
            const fleetSpec = activeFleetSpecs[key];
            return fleetSpec === spec || (fleetSpec && spec && fleetSpec.name === spec.name);
        }) || ""
        : "";
    if (!type) type = matchingFleetType;
    if (!type && typeof getSelectedAircraftType === "function") type = String(getSelectedAircraftType() || "").toUpperCase();
    const profiles = getTicketFxProfiles();
    const scenarioImgId = getContractScenarioImgId(result);
    if (isMatrixMissionEnabled(scenarioImgId)) return "matrix";
    const explicit = profiles.aircraftOverrides[type]
        || profiles.aircraftOverrides[String(matchingFleetType).toUpperCase()]
        || (isTicketFxProfileMode(spec.ticketFx) ? spec.ticketFx : "");
    if (explicit) return explicit;
    const groupFx = profiles.groupDefaults[String(spec.class || "").toUpperCase()];
    return groupFx || "legacy";
}

function applyTicketFxToCard(card, result) {
    if (!card) return;
    const globalPhotoMode = getGlobalTicketFxFallback();
    const fx = resolveTicketFxForResult(result);
    ["static", "crt", "legacy", "matrix", ...TICKET_FX_PROFILE_MODES].forEach((mode) => card.classList.remove("ticket-photo-fx-" + mode));
    card.classList.remove("is-force-military-crt");
    ["is-vintage-crt", "is-led-crt", "is-starship-crt", "is-regional-mcdu-crt", "is-mcdu-crt", "is-helicopter-crt"].forEach((name) => card.classList.remove(name));
    if (globalPhotoMode !== "crt") {
        card.classList.remove("is-crt-pinned");
        resetTicketPhotoCrtDisplay(card);
        card.dataset.ticketFx = globalPhotoMode;
        return;
    }
    if (fx === "legacy") {
        card.classList.add("ticket-photo-fx-crt");
    } else {
        card.classList.add("ticket-photo-fx-" + fx, "ticket-photo-fx-crt");
        card.classList.toggle("is-vintage-crt", fx === "crt-vintage");
        card.classList.toggle("is-led-crt", fx === "crt-business");
        card.classList.toggle("is-mcdu-crt", fx === "crt-commercial");
        card.classList.toggle("is-regional-mcdu-crt", fx === "crt-regional");
        card.classList.toggle("is-starship-crt", fx === "crt-starship");
        card.classList.toggle("is-helicopter-crt", fx === "crt-helicopter");
        card.classList.toggle("is-force-military-crt", fx === "crt-military");
    }
    card.dataset.ticketFx = fx;
}

function applyTicketFxToRenderedCards() {
    document.querySelectorAll("#contractsTicketGrid .contract-ticket").forEach((card, index) => {
        const result = boardContractResults && boardContractResults[index];
        if (result) applyTicketFxToCard(card, result);
    });
}

function formatDispatchPayout(amount) {
    const n = Math.floor(amount);
    const formatted = n > 9999 ? n.toLocaleString("en-GB") : String(n);
    return "$ " + formatted;
}
function applyScenarioPayoutBonus(baseAmount, scenarioImgId) {
    if (scenarioImgId != null && HUSH_MONEY_SCENARIO_IMG_IDS.has(scenarioImgId)) {
        return baseAmount + HUSH_MONEY_SCENARIO_BONUS;
    }
    return baseAmount;
}
function randomMatrixChar() {
    return TICKET_PHOTO_MATRIX_CHARS.charAt(Math.floor(Math.random() * TICKET_PHOTO_MATRIX_CHARS.length));
}

function refreshMatrixColumnTrail(col) {
    const spans = col.querySelectorAll("span");
    const count = spans.length;
    spans.forEach((span, index) => {
        const depthFromHead = count - 1 - index;
        span.style.opacity = String(Math.max(0.12, 1 - depthFromHead * 0.11));
    });
}

function pushMatrixColumnChar(col, maxLen) {
    const span = document.createElement("span");
    span.textContent = randomMatrixChar();
    col.insertBefore(span, col.firstChild);
    while (col.children.length > maxLen) col.removeChild(col.lastChild);
    refreshMatrixColumnTrail(col);
}

function clearTicketPhotoMatrixTimers() {
    ticketPhotoCrtState.columnTimers.forEach((timerId) => {
        clearInterval(timerId);
        clearTimeout(timerId);
    });
    ticketPhotoCrtState.columnTimers = [];
}

function getContractScenarioImgId(result) {
    if (!result) return null;
    if (result.scenarioImgId != null) return result.scenarioImgId;
    if (result.scenario && result.scenario.imgId != null) return result.scenario.imgId;
    return null;
}

function trimCrtBriefBody(body, bodyLineBudget) {
    const budgetLines = Math.max(1, bodyLineBudget);
    const maxChars = budgetLines * CRT_BRIEF_CHARS_PER_LINE;
    if (body.length <= maxChars) return body;
    let trimmed = body.slice(0, maxChars - 1).trim();
    const lastSpace = trimmed.lastIndexOf(" ");
    if (lastSpace > trimmed.length * 0.55) trimmed = trimmed.slice(0, lastSpace);
    return `${trimmed}…`;
}

function isVintageAirframeSpec(spec, aircraftType) {
    if (!spec) return false;
    const type = (aircraftType || "").toUpperCase();
    if (VINTAGE_PROPLINER_TYPES.has(type) || VINTAGE_AIRFRAME_TYPES.has(type)) return true;
    if (spec.class === "WARBIRD") return true;
    const tags = spec.tags || [];
    return tags.includes("VINTAGE");
}

function isStarshipCrtSpec(spec, aircraftType) {
    const type = (aircraftType || "").toUpperCase();
    return STARSHIP_CRT_TYPES.has(type);
}

function isMilitaryJetSpec(spec) {
    if (!spec || spec.class !== "JET") return false;
    if (spec.isMilitary) return true;
    const tags = spec.tags || [];
    return tags.includes("FIGHTER") || tags.includes("FAST_JET") || tags.includes("BOMBER");
}

function isRegionalJetMcduSpec(spec, aircraftType) {
    if (!spec || spec.class !== "JET" || isMilitaryJetSpec(spec)) return false;
    const type = (aircraftType || "").toUpperCase();
    if (REGIONAL_JET_CRT_TYPES.has(type)) return true;
    const tags = spec.tags || [];
    return tags.includes("REGIONAL");
}

function isAirlinerMcduSpec(spec, aircraftType) {
    if (!spec || spec.class !== "JET" || isMilitaryJetSpec(spec)) return false;
    return !isRegionalJetMcduSpec(spec, aircraftType);
}

function isLedAvionicsAirframeSpec(spec, aircraftType) {
    if (!spec || isVintageAirframeSpec(spec, aircraftType)) return false;
    if (isStarshipCrtSpec(spec, aircraftType)) return false;
    return spec.class === "BIZ JET";
}

function shouldUseVintageCrtForResult(result) {
    if (!result || !result.spec) return false;
    if (result.chosenMission && result.chosenMission.militaryOnly) return false;
    const type = result.aircraftType || result.type;
    return isVintageAirframeSpec(result.spec, type);
}

function shouldUseLedAvionicsCrtForResult(result) {
    if (!result || !result.spec) return false;
    if (result.chosenMission && result.chosenMission.militaryOnly) return false;
    const type = result.aircraftType || result.type;
    return isLedAvionicsAirframeSpec(result.spec, type);
}

function shouldUseStarshipCrtForResult(result) {
    if (!result || !result.spec) return false;
    if (result.chosenMission && result.chosenMission.militaryOnly) return false;
    const type = result.aircraftType || result.type;
    return isStarshipCrtSpec(result.spec, type);
}

function shouldUseRegionalMcduCrtForResult(result) {
    if (!result || !result.spec) return false;
    if (result.chosenMission && result.chosenMission.militaryOnly) return false;
    const type = result.aircraftType || result.type;
    return isRegionalJetMcduSpec(result.spec, type);
}

function shouldUseAirlinerMcduCrtForResult(result) {
    if (!result || !result.spec) return false;
    if (result.chosenMission && result.chosenMission.militaryOnly) return false;
    const type = result.aircraftType || result.type;
    return isAirlinerMcduSpec(result.spec, type);
}

function refreshBoardCrtSkinFromSelection() {
    const type = getSelectedAircraftType();
    const spec = type ? activeFleetSpecs[type] : null;
    const vintageAirframe = isVintageAirframeSpec(spec, type);
    const ledAirframe = isLedAvionicsAirframeSpec(spec, type);
    const starshipAirframe = isStarshipCrtSpec(spec, type);
    const regionalMcdu = isRegionalJetMcduSpec(spec, type);
    const airlinerMcdu = isAirlinerMcduSpec(spec, type);
    document.querySelectorAll("#contractsTicketGrid .contract-ticket").forEach((card, i) => {
        const result = boardContractResults[i];
        const isMilitary = !!(result && result.chosenMission && result.chosenMission.militaryOnly);
        card.classList.toggle("is-vintage-crt", vintageAirframe && !isMilitary);
        card.classList.toggle("is-led-crt", ledAirframe && !isMilitary);
        card.classList.toggle("is-starship-crt", starshipAirframe && !isMilitary);
        card.classList.toggle("is-regional-mcdu-crt", regionalMcdu && !isMilitary);
        card.classList.toggle("is-mcdu-crt", airlinerMcdu && !isMilitary);
    });
    applyTicketFxToRenderedCards();
}

function getTicketCrtTypewriterCps(briefEl) {
    const card = briefEl && briefEl.closest(".contract-ticket");
    if (!card || card.classList.contains("is-military")) {
        return TICKET_PHOTO_TYPEWRITER_CPS;
    }
    if (card.classList.contains("is-vintage-crt")) {
        return TICKET_PHOTO_VINTAGE_TYPEWRITER_CPS;
    }
    if (card.classList.contains("is-led-crt")) {
        return TICKET_PHOTO_LED_TYPEWRITER_CPS;
    }
    return TICKET_PHOTO_TYPEWRITER_CPS;
}

function resolveContractTicketBrief(result, ticketIndex) {
    const scenario = result && result.scenario;
    let body = "";
    if (result && result.rInstruction) {
        body = String(result.rInstruction);
    } else if (scenario) {
        if (scenario.instruction) body = String(scenario.instruction);
        else if (scenario.payload) body = String(scenario.payload);
    }
    if (!body) return "";
    return trimCrtBriefBody(body, CRT_BRIEF_MAX_LINES);
}

function syncCrtBriefScroll(briefEl) {
    if (!briefEl) return;
    if (briefEl.scrollHeight > briefEl.clientHeight + 1) {
        briefEl.scrollTop = briefEl.scrollHeight;
    }
}

function resetCrtBriefScroll(briefEl) {
    if (!briefEl) return;
    briefEl.scrollTop = 0;
}

function clearContractTicketPhotoMatrix(card) {
    const matrixEl = card && card.querySelector('[data-role="photo-matrix"]');
    if (!matrixEl) return;
    matrixEl.innerHTML = "";
    matrixEl.classList.remove("is-active", "is-alien", "is-monolith");
}

function resetTicketPhotoCrtDisplay(card) {
    const briefEl = card && card.querySelector('[data-role="photo-brief"]');
    if (briefEl) {
        briefEl.textContent = "";
        resetCrtBriefScroll(briefEl);
        briefEl.classList.remove("is-visible", "is-complete", "is-matrix-mode", "is-typing", "is-scrollable");
    }
    clearContractTicketPhotoMatrix(card);
}

function clearContractTicketPhotoBrief(card) {
    const briefEl = card && card.querySelector('[data-role="photo-brief"]');
    if (!briefEl) return;
    briefEl.setAttribute("data-brief", "");
    briefEl.removeAttribute("data-crt-matrix");
    resetTicketPhotoCrtDisplay(card);
}

function cancelTicketPhotoTypewriter() {
    if (ticketPhotoCrtState.timer) {
        clearInterval(ticketPhotoCrtState.timer);
        ticketPhotoCrtState.timer = null;
    }
    clearTicketPhotoMatrixTimers();
    if (ticketPhotoCrtState.resolveTimer) {
        clearTimeout(ticketPhotoCrtState.resolveTimer);
        ticketPhotoCrtState.resolveTimer = null;
    }
    const prev = ticketPhotoCrtState.slot;
    if (prev) {
        const card = prev.querySelector(".contract-ticket");
        if (card && !card.classList.contains("is-crt-pinned")) {
            resetTicketPhotoCrtDisplay(card);
        }
    }
    if (!document.querySelector(".contract-ticket.is-crt-pinned")) {
        ticketPhotoCrtState.slot = null;
    }
    ticketPhotoCrtState.matrixFinishing = false;
}

function releaseTicketPhotoCrtPin(card) {
    if (!card) return;
    card.classList.remove("is-crt-pinned");
    resetTicketPhotoCrtDisplay(card);
    if (ticketPhotoCrtState.slot && ticketPhotoCrtState.slot.contains(card)) {
        ticketPhotoCrtState.slot = null;
    }
}

function pinTicketPhotoCrt(card) {
    if (!card) return;
    card.classList.add("is-crt-pinned");
    ticketPhotoCrtState.slot = card.closest(".contract-ticket-slot");
}

function markCrtBriefScrollable(briefEl) {
    if (!briefEl) return;
    const scrollable = briefEl.scrollHeight > briefEl.clientHeight + 1;
    briefEl.classList.toggle("is-scrollable", scrollable);
}

function runTicketPhotoTypewriter(briefEl, full) {
    briefEl.textContent = "";
    resetCrtBriefScroll(briefEl);
    briefEl.classList.remove("is-complete", "is-scrollable");
    briefEl.classList.add("is-visible", "is-typing");

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        briefEl.textContent = full;
        briefEl.classList.remove("is-typing");
        briefEl.classList.add("is-complete");
        markCrtBriefScrollable(briefEl);
        return;
    }

    let i = 0;
    const delayMs = Math.round(1000 / getTicketCrtTypewriterCps(briefEl));
    ticketPhotoCrtState.timer = setInterval(() => {
        if (i >= full.length) {
            clearInterval(ticketPhotoCrtState.timer);
            ticketPhotoCrtState.timer = null;
            briefEl.classList.remove("is-typing");
            briefEl.classList.add("is-complete");
            markCrtBriefScrollable(briefEl);
            return;
        }
        briefEl.textContent += full.charAt(i);
        i += 1;
        syncCrtBriefScroll(briefEl);
    }, delayMs);
}

function finishMatrixRainIntro(matrixEl, briefEl, fullBrief) {
    if (ticketPhotoCrtState.matrixFinishing) return;
    ticketPhotoCrtState.matrixFinishing = true;
    clearTicketPhotoMatrixTimers();
    if (ticketPhotoCrtState.resolveTimer) {
        clearTimeout(ticketPhotoCrtState.resolveTimer);
        ticketPhotoCrtState.resolveTimer = null;
    }
    matrixEl.classList.add("is-fading");
    ticketPhotoCrtState.resolveTimer = setTimeout(() => {
        matrixEl.classList.remove("is-active", "is-fading", "is-alien", "is-monolith");
        matrixEl.innerHTML = "";
        ticketPhotoCrtState.resolveTimer = null;
        ticketPhotoCrtState.matrixFinishing = false;
        runTicketPhotoTypewriter(briefEl, fullBrief);
    }, 360);
}

function startTicketPhotoMatrixEffect(slot, card, briefEl, matrixConfig, fullBrief) {
    const matrixEl = card.querySelector('[data-role="photo-matrix"]');
    if (!matrixEl) {
        runTicketPhotoTypewriter(briefEl, fullBrief);
        return;
    }

    matrixEl.innerHTML = "";
    matrixEl.classList.remove("is-alien", "is-monolith", "is-fading");
    matrixEl.classList.add("is-active", matrixConfig.variant === "monolith" ? "is-monolith" : "is-alien");
    briefEl.classList.remove("is-matrix-mode", "is-visible", "is-complete");
    briefEl.textContent = "";
    ticketPhotoCrtState.matrixFinishing = false;

    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
        runTicketPhotoTypewriter(briefEl, fullBrief);
        return;
    }

    const colWidth = 12;
    const lineHeight = 12.6;
    let matrixHeight = matrixEl.clientHeight;
    if (!matrixHeight) {
        const photoWrap = card.querySelector(".contract-ticket-photo-wrap");
        const photo = card.querySelector('[data-role="photo"]');
        if (photoWrap && photoWrap.clientHeight) matrixHeight = photoWrap.clientHeight - 42;
        else if (photo && photo.clientHeight) matrixHeight = Math.max(0, photo.clientHeight - 42);
    }
    matrixHeight = matrixHeight || 220;
    const rowsInView = Math.max(8, Math.ceil(matrixHeight / lineHeight));
    const trailLen = rowsInView;
    const dropsPerColumn = rowsInView + trailLen;
    const cols = Math.max(18, Math.ceil(matrixEl.clientWidth / colWidth));
    clearTicketPhotoMatrixTimers();

    let columnsFinished = 0;
    const onColumnComplete = () => {
        columnsFinished += 1;
        if (columnsFinished >= cols) finishMatrixRainIntro(matrixEl, briefEl, fullBrief);
    };

    for (let c = 0; c < cols; c += 1) {
        const col = document.createElement("div");
        col.className = "contract-ticket-matrix-col";
        col.style.left = `${c * colWidth}px`;
        matrixEl.appendChild(col);

        const speed = 42 + (c % 5) * 9 + Math.floor(Math.random() * 22);
        const delay = Math.floor(Math.random() * 220);
        let drops = 0;

        const runColumn = () => {
            const timer = setInterval(() => {
                if (drops >= dropsPerColumn) {
                    clearInterval(timer);
                    onColumnComplete();
                    return;
                }
                pushMatrixColumnChar(col, trailLen);
                drops += 1;
            }, speed);
            ticketPhotoCrtState.columnTimers.push(timer);
        };

        if (delay) {
            const bootTimer = setTimeout(runColumn, delay);
            ticketPhotoCrtState.columnTimers.push(bootTimer);
        } else {
            runColumn();
        }
    }

    ticketPhotoCrtState.resolveTimer = setTimeout(() => {
        finishMatrixRainIntro(matrixEl, briefEl, fullBrief);
    }, TICKET_PHOTO_MATRIX_INTRO_MS);
}

function startTicketPhotoTypewriter(slot) {
    const card = slot.querySelector(".contract-ticket:not(.is-dimmed):not(.is-selected)");
    if (!card || !card.classList.contains("ticket-photo-fx-crt")) return;
    showTicketPhotoCrtForCard(card, slot, false);
}

function showTicketPhotoCrtForCard(card, slotOverride, pinAfter) {
    if (!card || !card.classList.contains("ticket-photo-fx-crt")) return;
    const slot = slotOverride || card.closest(".contract-ticket-slot");
    if (!slot) return;
    const briefEl = card.querySelector('[data-role="photo-brief"]');
    if (!briefEl) return;

    cancelTicketPhotoTypewriter();
    ticketPhotoCrtState.slot = slot;

    const full = briefEl.getAttribute("data-brief") || "";
    if (!full) return;

    const matrixKey = briefEl.getAttribute("data-crt-matrix");
    const matrixConfig = card.dataset.ticketFx === "matrix"
        ? (matrixKey ? getMatrixMissionConfig(matrixKey) : { variant: "alien" })
        : null;
    if (matrixConfig) {
        startTicketPhotoMatrixEffect(slot, card, briefEl, matrixConfig, full);
    } else {
        briefEl.classList.remove("is-matrix-mode");
        clearContractTicketPhotoMatrix(card);
        runTicketPhotoTypewriter(briefEl, full);
    }
    if (pinAfter) pinTicketPhotoCrt(card);
}

function activateTicketPhotoCrtForCard(card, slotOverride) {
    showTicketPhotoCrtForCard(card, slotOverride, true);
}

function applyTicketPhotoFxMode(mode, persist = true) {
    const grid = document.getElementById("contractsTicketGrid");
    if (!grid || TICKET_PHOTO_FX_MODES.indexOf(mode) === -1) return;
    TICKET_PHOTO_FX_MODES.forEach((m) => grid.classList.remove("ticket-photo-fx-" + m));
    if (persist) {
        try { localStorage.setItem(TICKET_PHOTO_FX_STORAGE_KEY, mode); }
        catch (e) { /* ignore */ }
    }
    const toggle = document.getElementById("contractsPhotoFxToggle");
    if (toggle) {
        toggle.querySelectorAll("[data-fx]").forEach((btn) => {
            const active = btn.getAttribute("data-fx") === mode;
            btn.classList.toggle("is-active", active);
            btn.classList.toggle("photo-filter-btn--active", active);
            btn.setAttribute("aria-pressed", active ? "true" : "false");
        });
    }
    applyTicketFxToRenderedCards();
    cancelTicketPhotoTypewriter();
}

function bindTicketPhotoFxInteractions() {
    const grid = document.getElementById("contractsTicketGrid");
    if (!grid || grid.dataset.photoFxBound === "1") return;
    grid.dataset.photoFxBound = "1";

    grid.addEventListener("mouseover", (e) => {
        const slot = e.target.closest(".contract-ticket-slot");
        if (!slot) return;
        const from = e.relatedTarget;
        if (from && slot.contains(from)) return;
        startTicketPhotoTypewriter(slot);
    });
    grid.addEventListener("mouseout", (e) => {
        const slot = e.target.closest(".contract-ticket-slot");
        if (!slot) return;
        const to = e.relatedTarget;
        if (to && slot.contains(to)) return;
        const card = slot.querySelector(".contract-ticket");
        if (card && card.classList.contains("is-crt-pinned")) return;
        if (ticketPhotoCrtState.slot === slot) cancelTicketPhotoTypewriter();
    });
    grid.addEventListener("wheel", (e) => {
        const slot = e.target.closest(".contract-ticket-slot");
        if (!slot) return;
        const card = slot.querySelector(".contract-ticket:not(.is-dimmed)");
        if (!card || !card.classList.contains("ticket-photo-fx-crt")) return;
        const briefEl = card.querySelector('[data-role="photo-brief"]');
        if (!briefEl || !briefEl.classList.contains("is-visible")) return;
        if (!briefEl.classList.contains("is-scrollable")) return;
        e.preventDefault();
        const maxScroll = briefEl.scrollHeight - briefEl.clientHeight;
        briefEl.scrollTop = Math.max(0, Math.min(maxScroll, briefEl.scrollTop + e.deltaY));
    }, { passive: false });
    if (!document.documentElement.dataset.crtVisibilityBound) {
        document.documentElement.dataset.crtVisibilityBound = "1";
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) cancelTicketPhotoTypewriter();
        });
        window.addEventListener("blur", () => cancelTicketPhotoTypewriter());
    }
}

function initPhotoFilterPreviews() {
    const missionUrl = missionImageUrl(PHOTO_FILTER_PREVIEW_MISSION_FILE);
    document.querySelectorAll(".photo-filter-option").forEach((option) => {
        const el = option.querySelector('[data-role="photo-filter-preview"]');
        if (!el) return;
        el.style.backgroundImage = `url("${missionUrl}")`;
        if (option.classList.contains("photo-filter-option--crt")) {
            initPhotoFilterCrtPreview(option);
        }
    });
}

function stopPhotoFilterPreviewTypewriter() {
    if (photoFilterPreviewCrtState.timer) {
        clearInterval(photoFilterPreviewCrtState.timer);
        photoFilterPreviewCrtState.timer = null;
    }
}

function runPhotoFilterPreviewTypewriter(briefEl, full) {
    stopPhotoFilterPreviewTypewriter();
    photoFilterPreviewCrtState.briefEl = briefEl;
    briefEl.textContent = "";
    briefEl.classList.remove("is-complete");
    briefEl.classList.add("is-visible", "is-typing");

    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        briefEl.textContent = full;
        briefEl.classList.remove("is-typing");
        briefEl.classList.add("is-complete");
        return;
    }

    let i = 0;
    const delayMs = Math.round(1000 / TICKET_PHOTO_TYPEWRITER_CPS);
    photoFilterPreviewCrtState.timer = setInterval(() => {
        if (i >= full.length) {
            clearInterval(photoFilterPreviewCrtState.timer);
            photoFilterPreviewCrtState.timer = null;
            briefEl.classList.remove("is-typing");
            briefEl.classList.add("is-complete");
            setTimeout(() => runPhotoFilterPreviewTypewriter(briefEl, full), 1800);
            return;
        }
        briefEl.textContent += full.charAt(i);
        i += 1;
    }, delayMs);
}

function initPhotoFilterCrtPreview(option) {
    const wrap = option.querySelector(".photo-filter-preview-wrap");
    if (!wrap || wrap.querySelector('[data-role="photo-filter-brief"]')) return;

    const overlay = document.createElement("div");
    overlay.className = "photo-filter-preview-overlay";
    overlay.setAttribute("aria-hidden", "true");

    const brief = document.createElement("p");
    brief.className = "photo-filter-preview-brief";
    brief.setAttribute("data-role", "photo-filter-brief");
    brief.setAttribute("aria-hidden", "true");

    wrap.appendChild(overlay);
    wrap.appendChild(brief);
    runPhotoFilterPreviewTypewriter(brief, PHOTO_FILTER_PREVIEW_BRIEF);
}

function initTicketPhotoFxToggle() {
    const grid = document.getElementById("contractsTicketGrid");
    if (!grid) return;

    initPhotoFilterPreviews();

    let initial = getGlobalTicketFxFallback();
    try {
        const stored = localStorage.getItem(TICKET_PHOTO_FX_STORAGE_KEY);
        if (TICKET_PHOTO_FX_MODES.indexOf(stored) !== -1) initial = stored;
    } catch (e) { /* ignore */ }
    applyTicketPhotoFxMode(initial, false);

    const toggle = document.getElementById("contractsPhotoFxToggle");
    if (toggle) {
        toggle.querySelectorAll(".photo-filter-option").forEach((option) => {
            const btn = option.querySelector(".photo-filter-btn");
            const wrap = option.querySelector(".photo-filter-preview-wrap");
            if (wrap && btn) {
                wrap.addEventListener("click", () => btn.click());
            }
        });
        toggle.querySelectorAll("[data-fx]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const mode = btn.getAttribute("data-fx");
                if (TICKET_PHOTO_FX_MODES.indexOf(mode) !== -1) applyTicketPhotoFxMode(mode);
            });
        });
    }
    bindTicketPhotoFxInteractions();
    reloadTicketFxProfiles();
}

function getTicketPhotoCrop(imageKey) {
    const cropMap = window.MISSION_IMAGE_CROPS || {};
    const crop = cropMap[imageKey] || {};
    return {
        x: Number.isFinite(crop.x) ? crop.x : 50,
        y: Number.isFinite(crop.y) ? crop.y : 50,
        zoom: Number.isFinite(crop.zoom) ? Math.max(100, Math.min(115, crop.zoom)) : 100
    };
}

function applyTicketPhotoCrop(photo, imageKey) {
    if (!photo || !imageKey) return;
    const crop = getTicketPhotoCrop(imageKey);
    photo.style.backgroundPosition = `${crop.x}% ${crop.y}%`;
    photo.style.backgroundSize = crop.zoom === 100 ? "cover" : `auto ${crop.zoom}%`;
}

function fillContractTicketCard(card, result, index, bundle) {
    const setText = (role, text) => {
        const el = card.querySelector(`[data-role="${role}"]`);
        if (el) el.textContent = text;
    };
    const isMilitary = !!(result.chosenMission && result.chosenMission.militaryOnly);
    card.classList.toggle("is-military", isMilitary);
    card.classList.toggle("is-vintage-crt", shouldUseVintageCrtForResult(result));
    card.classList.toggle("is-led-crt", shouldUseLedAvionicsCrtForResult(result));
    card.classList.toggle("is-starship-crt", shouldUseStarshipCrtForResult(result));
    card.classList.toggle("is-regional-mcdu-crt", shouldUseRegionalMcduCrtForResult(result));
    card.classList.toggle("is-mcdu-crt", shouldUseAirlinerMcduCrtForResult(result));
    applyTicketFxToCard(card, result);
    const slot = card.closest(".contract-ticket-slot");
    if (slot) slot.classList.toggle("is-military", isMilitary);
    const missionName = resolveContractJobTitle(result, index);
    setText("mission", missionName);
    fillBoardRouteCells(card, result.origin, result.destination);
    setText("photo-label", formatBoardFlightLabel(index));
    const metaEl = card.querySelector('[data-role="meta"]');
    if (metaEl) metaEl.innerHTML = formatBoardTicketMetaHtml(result);
    setText("ref", formatBoardJobRef(result, index));
    setText("value", result.payout);

    const photo = card.querySelector('[data-role="photo"]');
    if (photo) {
        const scenarioImgId = getContractScenarioImgId(result);
        const imageKey = scenarioImgId != null ? `mission${scenarioImgId}.jpg` : "";
        photo.dataset.imageKey = imageKey;
        if (bundle.imageUrl) {
            photo.style.backgroundImage = `url("${bundle.imageUrl}")`;
            applyTicketPhotoCrop(photo, imageKey);
        } else {
            photo.style.backgroundImage = "";
        }
    }

    const briefEl = card.querySelector('[data-role="photo-brief"]');
    if (briefEl) {
        const scenarioImgId = getContractScenarioImgId(result);
        briefEl.setAttribute("data-brief", resolveContractTicketBrief(result, index));
        if (isMatrixMissionEnabled(scenarioImgId)) {
            briefEl.setAttribute("data-crt-matrix", String(scenarioImgId));
        } else {
            briefEl.removeAttribute("data-crt-matrix");
        }
        briefEl.textContent = "";
        briefEl.classList.remove("is-visible", "is-complete", "is-matrix-mode", "is-typing");
        clearContractTicketPhotoMatrix(card);
    }

    const acceptBtn = card.querySelector('[data-role="accept"]');
    if (acceptBtn) {
        acceptBtn.disabled = false;
        acceptBtn.textContent = "Accept Contract";
    }

    const simbrief = card.querySelector('[data-role="simbrief"]');
    const pln = card.querySelector('[data-role="pln"]');
    const logBtn = card.querySelector('[data-role="log"]');
    const heli = card.querySelector('[data-role="heli"]');
    if (logBtn) logBtn.classList.remove("is-logbook-prompt");
    if (simbrief) {
        simbrief.href = bundle.simbriefUrl;
        simbrief.style.display = bundle.isSimbriefSupported ? "inline-flex" : "none";
        simbrief.onclick = () => promptSaveFlightToLogbook(card);
    }
    if (pln) {
        pln.href = bundle.plnUrl;
        pln.download = bundle.plnFilename;
        pln.style.display = "inline-flex";
        pln.onclick = () => promptSaveFlightToLogbook(card);
    }
    if (heli) {
        const exportNote = bundle.heliMessage || "";
        if (exportNote) {
            heli.style.display = "block";
            heli.textContent = exportNote;
        } else {
            heli.style.display = "none";
            heli.textContent = "";
        }
    }
}

function promptSaveFlightToLogbook(card) {
    clearContractLogbookPrompts();
    if (card) releaseTicketPhotoCrtPin(card);
    const logBtn = card && card.querySelector('[data-role="log"]');
    if (logBtn) logBtn.classList.add("is-logbook-prompt");
}

function clearContractLogbookPrompts() {
    document.querySelectorAll('#contractsTicketGrid [data-role="log"].is-logbook-prompt').forEach((btn) => {
        btn.classList.remove("is-logbook-prompt");
    });
}

const BOARD_SESSION_KEY = "dispatcher_board_session_v1";

function persistBoardSession(results, inactive) {
    try {
        const slim = (results || []).slice(0, 3).map((r) => ({
            ok: true,
            type: r.type,
            aircraftType: r.aircraftType || r.type,
            spec: r.spec,
            chosenMission: r.chosenMission,
            origin: r.origin,
            destination: r.destination,
            distanceNm: r.distanceNm,
            targetMins: r.targetMins,
            pax: r.pax,
            cargoKg: r.cargoKg,
            payout: r.payout,
            rPayload: r.rPayload,
            rInstruction: r.rInstruction,
            scenarioImgId: r.scenarioImgId,
            imageId: r.imageId,
            blockMinutes: r.blockMinutes,
            _duplicateUnavailable: !!r._duplicateUnavailable,
            _exportBundle: r._exportBundle ? {
                prestigePoints: r._exportBundle.prestigePoints,
                imageUrl: r._exportBundle.imageUrl,
                simbriefUrl: r._exportBundle.simbriefUrl,
                isSimbriefSupported: r._exportBundle.isSimbriefSupported,
                heliMessage: r._exportBundle.heliMessage,
                plnUrl: r._exportBundle.plnUrl,
                plnFilename: r._exportBundle.plnFilename,
                pendingFlight: r._exportBundle.pendingFlight
            } : null
        }));
        localStorage.setItem(BOARD_SESSION_KEY, JSON.stringify({
            inactive: !!inactive,
            results: slim,
            savedAt: Date.now()
        }));
    } catch (e) { /* private browsing / quota */ }
}

function loadBoardSession() {
    try {
        const raw = localStorage.getItem(BOARD_SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.results) || !parsed.results.length) return null;
        return parsed;
    } catch (e) {
        return null;
    }
}

function renderContractsBoard(results, options) {
    const cards = document.querySelectorAll("#contractsTicketGrid .contract-ticket");
    const slots = document.querySelectorAll("#contractsTicketGrid .contract-ticket-slot");
    const note = document.getElementById("contractsBoardNote");
    const grid = document.getElementById("contractsTicketGrid");
    const animateDeal = !!(options && options.animateDeal);
    const inactive = !!(options && options.inactive);
    boardSelectedIndex = -1;
    document.querySelectorAll("#contractsTicketGrid .contract-ticket.is-crt-pinned").forEach((card) => {
        releaseTicketPhotoCrtPin(card);
    });
    cancelTicketPhotoTypewriter();

    slots.forEach((slot, i) => {
        slot.classList.toggle("is-unavailable-duplicate", !!(results[i] && results[i]._duplicateUnavailable));
        if (!results[i]) slot.style.display = "none";
        else slot.style.display = "";
    });

    cards.forEach((card, i) => {
        card.classList.remove("is-selected", "is-dimmed");
        const labelEl = card.querySelector('[data-role="photo-label"]');
        if (labelEl) labelEl.textContent = formatBoardFlightLabel(i);
        const result = results[i];
        if (!result) {
            card.classList.remove("is-military");
            const slot = card.closest(".contract-ticket-slot");
            if (slot) slot.classList.remove("is-military");
            clearContractTicketPhotoBrief(card);
            const acceptBtn = card.querySelector('[data-role="accept"]');
            if (acceptBtn) acceptBtn.disabled = true;
            return;
        }
        const bundle = result._exportBundle || {};
        fillContractTicketCard(card, result, i, bundle);
        const acceptBtn = card.querySelector('[data-role="accept"]');
        if (acceptBtn) {
            acceptBtn.disabled = inactive || !!result._duplicateUnavailable;
        }
    });
    if (note) note.textContent = "";

    if (grid) {
        grid.classList.toggle("is-inactive", inactive);
        if (animateDeal) {
            grid.classList.remove("is-dealing");
            void grid.offsetWidth;
            grid.classList.add("is-dealing");
            setTimeout(() => grid.classList.remove("is-dealing"), 700);
        }
    }
    const panel = document.getElementById("contractsBoardPanel");
    if (panel) panel.classList.toggle("is-awaiting-generate", inactive);
}

function clearContractTicketSelection() {
    boardSelectedIndex = -1;
    clearContractLogbookPrompts();
    document.querySelectorAll("#contractsTicketGrid .contract-ticket.is-crt-pinned").forEach((card) => {
        releaseTicketPhotoCrtPin(card);
    });
    cancelTicketPhotoTypewriter();
    const cards = document.querySelectorAll("#contractsTicketGrid .contract-ticket");
    cards.forEach((card) => {
        card.classList.remove("is-selected", "is-dimmed");
        const acceptBtn = card.querySelector('[data-role="accept"]');
        if (acceptBtn) {
            const hasJob = !!boardContractResults[Number(card.getAttribute("data-ticket-index"))];
            acceptBtn.disabled = !hasJob;
            acceptBtn.textContent = "Accept Contract";
        }
    });
    const note = document.getElementById("contractsBoardNote");
    if (note) note.textContent = "";
}

function onContractTicketClick(event, index) {
    if (event.target.closest(".contract-ticket-export, .contract-ticket-reselect")) return;
    const card = event.currentTarget;
    if (card.classList.contains("is-selected") || card.classList.contains("is-dimmed")) return;
    const grid = document.getElementById("contractsTicketGrid");
    if (grid && grid.classList.contains("is-inactive")) return;
    const slot = card.closest(".contract-ticket-slot");
    if (slot && slot.classList.contains("is-unavailable-duplicate")) return;
    acceptContractTicket(index);
}

function acceptContractTicket(index) {
    const result = boardContractResults[index];
    const grid = document.getElementById("contractsTicketGrid");
    if (grid && grid.classList.contains("is-inactive")) {
        vectorAlert("Generate a flight to activate contracts.");
        return;
    }
    if (!result || !result._exportBundle || result._duplicateUnavailable) {
        vectorAlert("Generate three contracts first.");
        return;
    }
    boardSelectedIndex = index;
    clearContractLogbookPrompts();
    const cards = document.querySelectorAll("#contractsTicketGrid .contract-ticket");
    let selectedCard = null;
    cards.forEach((card, i) => {
        const selected = i === index;
        if (!selected && card.classList.contains("is-crt-pinned")) {
            releaseTicketPhotoCrtPin(card);
        }
        card.classList.toggle("is-selected", selected);
        card.classList.toggle("is-dimmed", !selected);
        if (selected) selectedCard = card;
        const acceptBtn = card.querySelector('[data-role="accept"]');
        if (acceptBtn) {
            acceptBtn.textContent = "Accept Contract";
            acceptBtn.disabled = true;
        }
    });

    if (selectedCard && selectedCard.classList.contains("ticket-photo-fx-crt")) {
        activateTicketPhotoCrtForCard(selectedCard);
    } else {
        cancelTicketPhotoTypewriter();
    }

    const bundle = result._exportBundle;
    currentPendingFlight = { ...bundle.pendingFlight };
    persistLastDispatch(currentPendingFlight);

    // Keep hidden classic targets in sync for restore / add-last-flight helpers
    const linkEl = document.getElementById("outLink");
    if (linkEl) {
        linkEl.href = bundle.simbriefUrl;
        linkEl.style.display = bundle.isSimbriefSupported ? "inline-flex" : "none";
    }
    const downloadBtn = document.getElementById("downloadPlnBtn");
    if (downloadBtn) {
        downloadBtn.href = bundle.plnUrl;
        downloadBtn.download = bundle.plnFilename;
        downloadBtn.style.display = "inline-flex";
    }
    const logBtn = document.getElementById("logFlightBtn");
    if (logBtn) logBtn.style.display = "inline-flex";
    const heliMsgEl = document.getElementById("heliMessage");
    if (heliMsgEl) {
        const exportNote = bundle.heliMessage || "";
        if (exportNote) {
            heliMsgEl.textContent = exportNote;
            heliMsgEl.style.display = "block";
        } else {
            heliMsgEl.textContent = "";
            heliMsgEl.style.display = "none";
        }
    }
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
    if (!aircraft) return "—";
    if (aircraft.class === "WARBIRD") return "Warbird";
    if (aircraft.class === "HELI") return "Helicopter";
    if (aircraft.class === "GLIDER") return "Gliding";
    if (aircraft.class === "BIZ JET") return "Business Jet";
    if (aircraft.class === "GA") return "GA";
    if (aircraft.isTactical) return "Fighter Jet";
    if (aircraft.isMilitary && aircraft.class === "JET") return "Military Jet";
    if (aircraft.class === "JET" && specIsHeavyJet(aircraft)) return "Commercial wide-body";
    if (aircraft.class === "JET") return "Commercial narrow-body";
    if (aircraft.class === "TURBO" && aircraft.isMilitary) return "Military Turboprop";
    if (aircraft.class === "TURBO") return "Turboprop";
    return aircraft.class || "—";
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
async function removeCustomAirport(icao) {
    let customAirports = JSON.parse(localStorage.getItem("dispatcher_custom_user_airports") || "[]");
    const airport = customAirports.find(a => String(a.icao).toUpperCase() === String(icao).toUpperCase());
    if (!airport) return;
    if (!(await vectorConfirm(`Remove custom airport ${airport.icao} - ${airport.name}?\n\nThis cannot be undone.`))) return;
    customAirports = customAirports.filter(a => String(a.icao).toUpperCase() !== String(icao).toUpperCase());
    localStorage.setItem("dispatcher_custom_user_airports", JSON.stringify(customAirports));
    markAirportDatabaseDirty();
    rebuildActiveDatabase();
    rebuildAirportDropdown();
    updateDatabaseStats();
    updateManageCustomDbUI();
}
async function removeCustomAircraft(icao) {
    const customFleet = JSON.parse(localStorage.getItem("dispatcher_custom_fleet") || "{}");
    const fleetKey = Object.keys(customFleet).find(k => k.toUpperCase() === String(icao).toUpperCase());
    if (!fleetKey) return;
    const aircraft = customFleet[fleetKey];
    if (!(await vectorConfirm(`Remove custom aircraft ${fleetKey} - ${aircraft.name}?\n\nThis cannot be undone.`))) return;
    delete customFleet[fleetKey];
    localStorage.setItem("dispatcher_custom_fleet", JSON.stringify(customFleet));
    const customAssignments = JSON.parse(localStorage.getItem("dispatcher_custom_assignments") || "{}");
    const assignmentKey = Object.keys(customAssignments).find(k => k.toUpperCase() === fleetKey.toUpperCase());
    if (assignmentKey) {
        delete customAssignments[assignmentKey];
        localStorage.setItem("dispatcher_custom_assignments", JSON.stringify(customAssignments));
    }
    rebuildFleetDropdown();
    updateDatabaseStats();
    updateManageCustomDbUI();
}
function missionImageUrl(fileName) {
    const path = `images-missions/${fileName}`;
    return typeof window.dispatcherAssetUrl === "function"
        ? window.dispatcherAssetUrl(path)
        : path;
}
function setMode(mode) {
    // v3 board layout is dark-only
    document.body.classList.remove('light-mode', 'greyscale-mode');
    document.documentElement.classList.remove('light-mode', 'greyscale-mode');
    localStorage.setItem("dispatcher_theme", "dark");
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
function sortAirportsAlphabetically(airports) {
    return airports.slice().sort((a, b) => {
        const byIcao = (a.icao || "").localeCompare(b.icao || "");
        return byIcao !== 0 ? byIcao : (a.name || "").localeCompare(b.name || "");
    });
}
function formatAirportListItems(airports) {
    return sortAirportsAlphabetically(airports).map((a) => `<li>${a.icao} - ${a.name}</li>`).join("");
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
        ? `<ul>${formatAirportListItems(coreHandcrafted)}</ul>`
        : `<ul><li>Loading permanent database array records...</li></ul>`;
	document.getElementById('coreThirdPartyCount').innerText = coreThirdParty.length;
    document.getElementById('coreThirdPartyList').innerHTML = coreThirdParty.length > 0
        ? `<ul>${formatAirportListItems(coreThirdParty)}</ul>`
        : `<ul><li>Loading permanent database array records...</li></ul>`;
    const gliderCountEl = document.getElementById('coreGliderportsCount');
    if (gliderCountEl) {
        gliderCountEl.innerText = gliderSource.length;
        document.getElementById('coreGliderportsList').innerHTML = gliderSource.length > 0
            ? `<ul>${formatAirportListItems(gliderSource)}</ul>`
            : `<ul><li>Loading permanent database array records...</li></ul>`;
    }
    const smallDetailedEl = document.getElementById('coreSmallDetailedCount');
    if (smallDetailedEl) {
        smallDetailedEl.innerText = coreSmallDetailed.length;
        document.getElementById('coreSmallDetailedList').innerHTML = coreSmallDetailed.length > 0
            ? `<ul>${formatAirportListItems(coreSmallDetailed)}</ul>`
            : `<ul><li>Loading permanent database array records...</li></ul>`;
    }
	const coreMilitary = liveAirportsDB.filter(a => a.isMilitary === true);
		document.getElementById('coreMilitaryCount').innerText = coreMilitary.length;
		document.getElementById('coreMilitaryList').innerHTML = coreMilitary.length > 0
			? `<ul>${formatAirportListItems(coreMilitary)}</ul>`
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
    const hasIls = document.getElementById("newApHasIls") && document.getElementById("newApHasIls").checked;
    const lat = parseFloat(document.getElementById("newLat").value);
    const lon = parseFloat(document.getElementById("newLon").value);
    if (icao.length !== 4 || name === "") {
        vectorAlert("Please enter a valid 4-character ICAO code and airport name.");
        return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) {
        vectorAlert("Please enter valid latitude and longitude coordinates. Routes cannot be generated without them.");
        return;
    }
    if (length <= 0 && rwy !== "HELI") {
        vectorAlert("Please enter the longest usable runway length in feet (or choose Helipad if there is no runway).");
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
        isMilitary: isMilitary,
        hasIls: hasIls
    });
    localStorage.setItem("dispatcher_custom_user_airports", JSON.stringify(customAirports));
    vectorAlert(`${icao} added successfully to your local airport database.`);
    clearCustomAirportForm();
    markAirportDatabaseDirty();
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
    const ils = document.getElementById("newApHasIls");
    if (ils) ils.checked = false;
}
function readCustomMissionRolesFromForm(rawClass, isMilitary) {
    const passenger = document.getElementById("newAcRolePassenger");
    const cargo = document.getElementById("newAcRoleCargo");
    const executive = document.getElementById("newAcRoleExecutive");
    const military = document.getElementById("newAcRoleMilitary");
    const medevac = document.getElementById("newAcRoleMedevac");
    const cargoTierEl = document.getElementById("newAcCargoTier");
    const roles = {
        passenger: !!(passenger && passenger.checked),
        cargo: !!(cargo && cargo.checked),
        executive: !!(executive && executive.checked),
        military: !!(military && military.checked) || isMilitary || rawClass === "MIL_JET" || rawClass === "WARBIRD",
        medevac: !!(medevac && medevac.checked),
        cargoTier: cargoTierEl ? cargoTierEl.value : "light"
    };
    if (rawClass === "GLIDER") {
        roles.passenger = true;
        roles.cargo = false;
        roles.executive = false;
        roles.military = false;
    }
    if (rawClass === "MIL_JET") {
        roles.military = true;
        roles.passenger = false;
        roles.cargo = false;
        roles.executive = false;
    }
    if (rawClass === "BIZ JET" && !roles.executive && roles.passenger) {
        roles.executive = true;
    }
    return roles;
}
function buildCustomAircraftTagsFromRoles(rawClass, missionRoles, options) {
    const tags = new Set();
    if (rawClass === "HELI") tags.add("ROTORCRAFT");
    if (rawClass === "WARBIRD") tags.add("WARBIRD");
    if (rawClass === "GLIDER") tags.add("GLIDER");
    if (rawClass === "GA") tags.add("PISTON");
    if (rawClass === "TURBO") tags.add("TURBOPROP");
    if (rawClass === "MIL_JET") {
        tags.add("FAST_JET");
        tags.add("FIGHTER");
    }
    if (missionRoles.military || options.isMilitary) {
        if (missionRoles.cargo && missionRoles.cargoTier === "military") tags.add("MILITARY_TRANSPORT");
    }
    if (rawClass === "TURBO" && missionRoles.cargo && missionRoles.cargoTier === "military"
        && (options.mtow || 0) >= 100000) {
        tags.add("HEAVY_AIRLIFTER");
    }
    if (rawClass === "JET" && (options.mtow || 0) >= HEAVY_JET_MTOW_MIN) tags.add("HEAVY");
    if (options.civilOk) tags.add("CIVIL_OK");
    if (options.stol) tags.add("STOL");
    if (options.lightHeli) tags.add("LIGHT_HELI");
    if (options.militaryHeli) tags.add("MILITARY_HELI");
    if (options.fighter || rawClass === "MIL_JET") tags.add("FIGHTER");
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
function saveCustomMissionAssignmentsForSpec(icao, spec, missionRoles) {
    if (typeof buildCustomAssignmentImgIds !== "function" || typeof saveCustomMissionAssignment !== "function") return 0;
    if (typeof scenarioDB === "undefined" || typeof missionMatrix === "undefined") return 0;
    const imgIds = buildCustomAssignmentImgIds(spec, missionRoles, scenarioDB, missionMatrix);
    if (!imgIds.length) return 0;
    saveCustomMissionAssignment(icao, imgIds);
    return imgIds.length;
}
function migrateCustomMissionAssignmentsOnLoad() {
    if (typeof migrateCustomMissionAssignments !== "function") return;
    if (typeof scenarioDB === "undefined" || typeof missionMatrix === "undefined") return;
    const result = migrateCustomMissionAssignments(coreFleetSpecs, scenarioDB, missionMatrix);
    if (result.migrated > 0) {
        console.info("VECTOR: migrated mission assignments for " + result.migrated + " custom aircraft (existing airframes unchanged).");
    }
}
function updateCustomAircraftForm() {
    const classEl = document.getElementById("newAcClass");
    const militaryEl = document.getElementById("newAcMilitary");
    if (!classEl) return;
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
    toggleWrap("acTagGliderWrap", rawClass === "GLIDER");
    const cargoRole = document.getElementById("newAcRoleCargo");
    toggleWrap("acCargoTierWrap", !!(cargoRole && cargoRole.checked), false);
    const lengthEl = document.getElementById("newAcLength");
    if (lengthEl) {
        if (rawClass === "HELI") lengthEl.placeholder = "e.g. 0";
        else if (rawClass === "GLIDER") lengthEl.placeholder = "e.g. 1300";
        else lengthEl.placeholder = "e.g. 1000";
    }
    applyCustomAircraftRangeDefaults();
    const fighterEl = document.getElementById("newAcFighter");
    if (fighterEl) fighterEl.checked = rawClass === "MIL_JET" ? true : (rawClass === "WARBIRD" ? fighterEl.checked : false);
    const milRole = document.getElementById("newAcRoleMilitary");
    if (milRole && (rawClass === "MIL_JET" || rawClass === "WARBIRD")) milRole.checked = true;
    if (rawClass === "BIZ JET") {
        const execRole = document.getElementById("newAcRoleExecutive");
        if (execRole) execRole.checked = true;
    }
    if (rawClass === "GLIDER") {
        ["newAcRoleCargo", "newAcRoleExecutive", "newAcRoleMilitary", "newAcRoleMedevac"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.checked = false;
        });
        const paxRole = document.getElementById("newAcRolePassenger");
        if (paxRole) paxRole.checked = true;
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
    // Placeholder only — never inject a real value (that renders as white filled text).
    maxEl.placeholder = `e.g. ${defs.maxD}`;
}
function clearCustomAircraftForm() {
    ["newAcName", "newAcIcao", "newAcLength", "newAcMaxPax", "newAcMaxCargo", "newAcMtow", "newAcOew", "newAcMlw", "newAcMzfw", "newAcFuel", "newAcMaxD"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = "";
            delete el.dataset.touched;
        }
    });
    const classEl = document.getElementById("newAcClass");
    if (classEl) classEl.value = "JET";
    const ticketFxEl = document.getElementById("newAcTicketFx");
    if (ticketFxEl) ticketFxEl.value = "";
    document.querySelectorAll("[data-ticket-fx-option]").forEach((option) => { option.checked = false; });
    const paxRole = document.getElementById("newAcRolePassenger");
    if (paxRole) paxRole.checked = true;
    ["newAcRoleCargo", "newAcRoleExecutive", "newAcRoleMilitary", "newAcRoleMedevac"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });
    const cargoTier = document.getElementById("newAcCargoTier");
    if (cargoTier) cargoTier.value = "light";
    ["newAcMilitary", "newAcCivilOk", "newAcFighter", "newAcStol", "newAcLightHeli", "newAcMilHeli", "newAcRecon", "newAcSelfLaunch", "newAcSelfSustain", "newAcSailplane", "newAcElectric", "newAcTwinSeat"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.checked = false;
    });
    updateCustomAircraftForm();
    updateCustomAircraftFxPreview();
}
function selectCustomAircraftTicketFx(selectedOption) {
    const ticketFxEl = document.getElementById("newAcTicketFx");
    if (!ticketFxEl || !selectedOption) return;
    document.querySelectorAll("[data-ticket-fx-option]").forEach((option) => {
        if (option !== selectedOption) option.checked = false;
    });
    ticketFxEl.value = selectedOption.checked && isTicketFxProfileMode(selectedOption.value) ? selectedOption.value : "";
    updateCustomAircraftFxPreview();
}
function updateCustomAircraftFxPreview() {
    const select = document.getElementById("newAcTicketFx");
    const preview = document.getElementById("newAcTicketFxPreview");
    if (!preview) return;
    const selectedFx = select && isTicketFxProfileMode(select.value) ? select.value : "";
    const fx = selectedFx || "static";
    const samples = {
        "crt-standard": { copy: "ROUTE CLEAR\nALT 28000 FT", label: "STANDARD CRT" },
        "crt-military": { copy: "MISSION ACTIVE\nSECTOR BRAVO", label: "MILITARY GREEN" },
        "crt-vintage": { copy: "FLIGHT BRIEF\nHOLDING SHORT", label: "VINTAGE / SEPIA" },
        "crt-business": { copy: "FMS READY\nROUTE CONFIRMED", label: "BUSINESS JET LED" },
        "crt-commercial": { copy: "INIT A\nCI 24 / FL350", label: "COMMERCIAL MCDU" },
        "crt-regional": { copy: "FPLN ACTIVE\nVNAV READY", label: "REGIONAL BLUE" },
        "crt-starship": { copy: "NAV DATA\nCORRIDOR SET", label: "STARSHIP COLLINS" },
        "crt-helicopter": { copy: "HDG 270\nTORQUE 82%", label: "HELICOPTER AVIONICS ’90S" }
    };
    const sample = samples[selectedFx] || { copy: "SELECT A PROFILE", label: "INHERIT CATEGORY DEFAULT" };
    preview.className = `ticket-fx-custom-preview ticket-fx-preview-${fx}`;
    preview.replaceChildren();
    const copy = document.createElement("span");
    copy.className = "ticket-fx-custom-preview-copy";
    copy.textContent = sample.copy;
    const label = document.createElement("span");
    label.className = "ticket-fx-custom-preview-label";
    label.textContent = sample.label;
    preview.append(copy, label);
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
    const mlw = parseInt(document.getElementById("newAcMlw").value, 10) || 0;
    const mzfw = parseInt(document.getElementById("newAcMzfw").value, 10) || 0;
    const fuelPerNm = parseFloat(document.getElementById("newAcFuel").value);
    const minD = getDefaultMinDistanceNm(rawClass);
    const maxD = parseInt(document.getElementById("newAcMaxD").value, 10);
    const ticketFxEl = document.getElementById("newAcTicketFx");
    const ticketFx = ticketFxEl && isTicketFxProfileMode(ticketFxEl.value) ? ticketFxEl.value : "";
    if (!name || icao.length < 2 || icao.length > 4) {
        vectorAlert("Please enter an aircraft name and a valid 2-4 character ICAO type code.");
        return;
    }
    if (minLength === "" || !Number.isFinite(parseInt(minLength, 10))) {
        vectorAlert("Please enter the minimum takeoff distance in feet (use 0 for helicopters).");
        return;
    }
    if (mtow <= 0 || oew <= 0) {
        vectorAlert("Please enter MTOW and OEW - these are used for payload and range calculations.");
        return;
    }
    if (!Number.isFinite(fuelPerNm) || fuelPerNm < 0 || (acClass !== "GLIDER" && fuelPerNm <= 0)) {
        vectorAlert("Please enter fuel burn (kg/nm). Use 0 for unpowered gliders.");
        return;
    }
    if (!Number.isFinite(maxD) || maxD <= 0 || maxD < minD) {
        vectorAlert("Please enter a valid maximum range (nm) from the aircraft manual.");
        return;
    }
    if (oew >= mtow) {
        vectorAlert("OEW must be lower than MTOW.");
        return;
    }
    if (mlw > 0 && mlw > mtow) {
        vectorAlert("MLW cannot be higher than MTOW.");
        return;
    }
    if (mzfw > 0 && mzfw > mtow) {
        vectorAlert("MZFW cannot be higher than MTOW.");
        return;
    }
    const missionRoles = readCustomMissionRolesFromForm(rawClass, isMilitary);
    if (rawClass !== "GLIDER" && rawClass !== "MIL_JET") {
        if (!missionRoles.passenger && !missionRoles.cargo && !missionRoles.executive && !missionRoles.military && !missionRoles.medevac) {
            vectorAlert("Please tick at least one mission role (Passenger, Cargo, Executive, Military, or Medevac).");
            return;
        }
    }
    if (missionRoles.cargo && missionRoles.cargoTier === "military" && !isMilitary) {
        vectorAlert("Military cargo requires the Military Aircraft option to be ticked.");
        return;
    }
    const tagOptions = {
        isMilitary: isMilitary,
        civilOk: document.getElementById("newAcCivilOk") && document.getElementById("newAcCivilOk").checked,
        stol: document.getElementById("newAcStol") && document.getElementById("newAcStol").checked,
        lightHeli: document.getElementById("newAcLightHeli") && document.getElementById("newAcLightHeli").checked,
        militaryHeli: document.getElementById("newAcMilHeli") && document.getElementById("newAcMilHeli").checked,
        fighter: document.getElementById("newAcFighter") && document.getElementById("newAcFighter").checked,
        recon: document.getElementById("newAcRecon") && document.getElementById("newAcRecon").checked,
        selfLaunch: document.getElementById("newAcSelfLaunch") && document.getElementById("newAcSelfLaunch").checked,
        selfSustain: document.getElementById("newAcSelfSustain") && document.getElementById("newAcSelfSustain").checked,
        sailplane: document.getElementById("newAcSailplane") && document.getElementById("newAcSailplane").checked,
        electric: document.getElementById("newAcElectric") && document.getElementById("newAcElectric").checked,
        twinSeat: document.getElementById("newAcTwinSeat") && document.getElementById("newAcTwinSeat").checked,
        mtow: mtow,
        regionalJet: acClass === "JET" && mtow < 50000
    };
    const selectedTags = buildCustomAircraftTagsFromRoles(rawClass, missionRoles, tagOptions);
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
    const existingEntry = customFleet[icao] || {};
    customFleet[icao] = Object.assign({}, existingEntry, {
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
        mlw: mlw,
        mzfw: mzfw,
        fuelPerNm: fuelPerNm,
        isMilitary: isMilitary,
        isTactical: rawClass === "MIL_JET" || (rawClass === "WARBIRD" && document.getElementById("newAcFighter") && document.getElementById("newAcFighter").checked),
        tags: selectedTags,
        missionRoles: missionRoles
    });
    localStorage.setItem("dispatcher_custom_fleet", JSON.stringify(customFleet));
    const ticketFxUserSettings = readTicketFxUserSettings();
    ticketFxUserSettings.aircraftOverrides = ticketFxUserSettings.aircraftOverrides || {};
    if (ticketFx) ticketFxUserSettings.aircraftOverrides[icao] = ticketFx;
    else delete ticketFxUserSettings.aircraftOverrides[icao];
    saveTicketFxUserSettings(ticketFxUserSettings);
    const assignmentCount = saveCustomMissionAssignmentsForSpec(icao, customFleet[icao], missionRoles);
    if (!assignmentCount) {
        vectorAlert(`${icao} saved, but no missions could be generated for the selected roles. Adjust roles or airframe class.`);
    } else {
        vectorAlert(`${icao} saved to your local fleet (${assignmentCount} mission briefings).`);
    }
    clearCustomAircraftForm();
    rebuildFleetDropdown();
    updateDatabaseStats();
}
function rebuildActiveDatabase() {
    if (!activeAirportDatabaseNeedsRebuild && activeAirportDatabase.length > 0) return;
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
        let finalAirport;
        if (variants.length === 1) {
            finalAirport = { ...variants[0] };
        } else {
            // Same ICAO may list multiple scenery developers — routing uses the first merged
            // entry (loader order); all variants are kept for Job Ticket scenery links only.
            finalAirport = { ...variants[0] };
            finalAirport.allOptions = variants;
        }
        return applyStrictIlsFlagsToAirport(finalAirport);
    });
    activeAirportDatabaseNeedsRebuild = false;
    const icaoSet = new Set();
    activeAirportDatabase.forEach((ap) => {
        if (ap && ap.icao) icaoSet.add(normalizeIcao(ap.icao));
    });
    cachedActiveAirportIcaoSet = icaoSet;
}
function getSelectedAircraftSpec() {
    const type = getSelectedAircraftType();
    return type ? activeFleetSpecs[type] : null;
}
function updateFlightTimeSliderState() {
    const slider = document.getElementById("timeSlider");
    const section = document.querySelector(".slider-section");
    const heliBlockTime = document.getElementById("heliFixedBlockTime");
    if (!slider) return;
    const spec = getSelectedAircraftSpec();
    const isHeli = !!(spec && spec.class === "HELI");
    const sliderIgnored = spec && isSliderIgnoredAircraft(spec);
    slider.disabled = false;
    if (section) {
        section.style.display = isHeli ? "none" : "";
        section.classList.toggle("slider-section--rotor-glider", !!sliderIgnored);
    }
    if (heliBlockTime) heliBlockTime.style.display = isHeli ? "" : "none";
    refreshBoardCrtSkinFromSelection();
    updateFlightRulesButtonAvailability(spec);
}
function rebuildFleetDropdown() {
    migrateCustomMissionAssignmentsOnLoad();
    const customFleet = JSON.parse(localStorage.getItem("dispatcher_custom_fleet")) || {};
    activeFleetSpecs = { ...coreFleetSpecs, ...customFleet };
    const inputEl = document.getElementById("aircraftInput");
    const listEl = document.getElementById("customAircraftList");
    const sortedFleetEntries = Object.entries(activeFleetSpecs).sort((a, b) => a[1].name.localeCompare(b[1].name));
    function renderList(filterText = "") {
        listEl.innerHTML = "";
        const filtered = sortedFleetEntries.filter(entry =>
            aircraftMatchesFilter(entry[0], entry[1], filterText)
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
    refreshBoardFlightLabels();
}
function exportDatabaseBackup() {
    const backupObject = {
        airports: JSON.parse(localStorage.getItem("dispatcher_custom_user_airports") || "[]"),
        fleet: JSON.parse(localStorage.getItem("dispatcher_custom_fleet") || "{}"),
        custom_assignments: JSON.parse(localStorage.getItem("dispatcher_custom_assignments") || "{}"),
        ticket_fx_user_settings: readTicketFxUserSettings(),
        logbook: JSON.parse(localStorage.getItem("dispatcher_logbook") || "[]"),
        owned_airports: localStorage.getItem("dispatcher_owned_airports") || "",
        prefer_owned: localStorage.getItem("dispatcher_prefer_owned") === "true"
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupObject, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", "dispatcher_backup.json");
    a.click();
    resetLogbookBackupNudgeState();
}
async function importDatabaseBackup(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;
    if (!(await vectorConfirm("Importing this file will replace your current Logbook, Custom Airports, Custom Aircraft, and Owned Airports list with what's saved in it. Anything added since this backup was made will be lost. Continue?"))) {
        inputElement.value = "";
        return;
    }
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const d = JSON.parse(e.target.result);
            if (d.airports) localStorage.setItem("dispatcher_custom_user_airports", JSON.stringify(d.airports));
            if (d.fleet) localStorage.setItem("dispatcher_custom_fleet", JSON.stringify(d.fleet));
            if (d.custom_assignments) localStorage.setItem("dispatcher_custom_assignments", JSON.stringify(d.custom_assignments));
            if (d.ticket_fx_user_settings) saveTicketFxUserSettings(d.ticket_fx_user_settings);
            if (d.logbook) localStorage.setItem("dispatcher_logbook", JSON.stringify(d.logbook));
            if (typeof d.owned_airports === "string") {
                localStorage.setItem("dispatcher_owned_airports", d.owned_airports);
                const ownedInput = document.getElementById("ownedAirportsInput");
                if (ownedInput) ownedInput.value = d.owned_airports;
            }
            if (typeof d.prefer_owned === "boolean") {
                localStorage.setItem("dispatcher_prefer_owned", d.prefer_owned ? "true" : "false");
                const preferToggle = document.getElementById("preferOwnedToggle");
                if (preferToggle) preferToggle.checked = d.prefer_owned;
            }
            syncLastArrivalFromLogbook();
            refreshLastArrivalDepField();
            markAirportDatabaseDirty();
            rebuildActiveDatabase();
            rebuildFleetDropdown();
            updateDatabaseStats();
            if (typeof updateLogbookUI === 'function') updateLogbookUI();
            vectorAlert("Backup imported successfully!");
        } catch (err) {
            vectorAlert("Import failed: invalid backup file.");
        }
    };
    reader.readAsText(file);
}
async function resetCustomDatabase() {
    if (await vectorConfirm("Would you like to export a backup of your custom data before wiping it?")) {
        exportDatabaseBackup();
    }
    if (await vectorConfirm("Are you sure you want to completely wipe all custom airports, custom aircraft, Job Ticket FX settings, and your Owned Airports list from your local database? This cannot be undone.")) {
        localStorage.removeItem("dispatcher_custom_user_airports");
        localStorage.removeItem("dispatcher_custom_fleet");
        localStorage.removeItem("dispatcher_custom_assignments");
        localStorage.removeItem(TICKET_FX_USER_SETTINGS_KEY);
        localStorage.removeItem("dispatcher_owned_airports");
        localStorage.removeItem("dispatcher_prefer_owned");
        const ownedInput = document.getElementById("ownedAirportsInput");
        if (ownedInput) ownedInput.value = "";
        const preferToggle = document.getElementById("preferOwnedToggle");
        if (preferToggle) preferToggle.checked = false;
        reloadTicketFxProfiles();
        rebuildActiveDatabase();
        rebuildFleetDropdown();
        updateDatabaseStats();
        updateManageCustomDbUI();
        vectorAlert("Custom databases have been successfully reset. Your Logbook was kept intact.");
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
    EGLC: ["A319", "E190", "E195", "RJ70", "RJ85", "RJ1H", "RJ1F", "B461", "B462", "B462_QT", "B463", "B463_QT", "F70"],
    EGNS: ["A319", "E190", "E195", "RJ70", "RJ85", "RJ1H", "RJ1F", "B461", "B462", "B462_QT", "B463", "B463_QT"],
    SBRJ: ["A319", "E190", "E195"]
};
const RESTRICTED_AIRPORT_TURBO_MAX_MTOW = 25000;
const RESTRICTED_AIRPORT_OPERATIONAL_MTOW = {
    EGLC: 68000,
    EGNS: 75500,
    SBRJ: 75500
};
// Weight-limited runway ops: JET-class airliners at JET-rated fields shorter than MTOW takeoff distance.
const JET_WEIGHT_LIMITED_RUNWAY_EXPONENT = 1.0;
/** Heavy jets need roughly this runway length for structural MTOW (SimBrief PMRTW ≈ MFPTW). */
const JET_HEAVY_FULL_PERFORMANCE_RUNWAY_FT = 10500;
/** Exponent >1 = conservative vs linear (calibrated to A350-class PMRTW at ~8600 ft). */
const JET_HEAVY_RUNWAY_MTOW_EXPONENT = 1.10;
const JET_BLOCK_TAXI_FUEL_KG = 300;
const JET_RESERVE_HOLD_MINUTES = 30;
const JET_RESERVE_HOLD_NM_PER_MIN = 3.5;
/** Trip fuel at or above this fraction of max tank → plan at max tank for MTOW payload math. */
const JET_SIMBRIEF_TANK_FILL_THRESHOLD = 0.88;
/** Narrowbody tank-range: catalog trip fuel must stay below this fraction of max tank. */
const JET_NARROWBODY_TANK_RANGE_MARGIN = 0.96;
/** Filed route is often longer than GC on Atlantic/Pacific tracks. */
const JET_NARROWBODY_FUEL_DISTANCE_FACTOR = 1.06;
const WEIGHT_LIMITED_MIN_LOAD_FACTOR = 0.20;
const WEIGHT_LIMITED_LOAD_FACTOR_STEP = 0.01;
// Phase-C SimBrief calibration: GC may exceed catalog maxD (winds, filed route vs still-air range).
const JET_ALLOWED_MAXD_FACTOR = 1.025;
const JET_HEAVY_ALLOWED_MAXD_FACTOR = 1.08;
/** ICAOs invalid for JET SimBrief dispatch (MSFS/airport DB out of sync with Navdata). */
const JET_SIMBRIEF_EXCLUDED_ICAOS = new Set(["LLMG"]);

function isJetWeightLimitedRunwayAirport(ap, spec) {
    if (!ap || !spec || spec.class !== "JET") return false;
    if (ap.rwy !== "JET") return false;
    const minRw = Number(spec.minRunwayLength) || 0;
    if (minRw <= 0 || !ap.length) return false;
    return ap.length < minRw;
}
function getCuratedPairRouteBoost(fromIcao, toIcao, table, tierMins) {
    if (!table || !table.length) return 0;
    const from = normalizeIcao(fromIcao);
    const to = normalizeIcao(toIcao);
    if (!isIcaoInActiveAirportDatabase(from) || !isIcaoInActiveAirportDatabase(to)) return 0;
    const stepped = tierMins != null ? tierMins : null;
    let boost = 0;
    for (const entry of table) {
        if (stepped != null && entry.tier != null && entry.tier !== stepped) continue;
        if (normalizeIcao(entry.from) === from && normalizeIcao(entry.to) === to) {
            boost = Math.max(boost, entry.weight || 0);
        }
    }
    return boost;
}
function getShortHaulPairRouteBoost(pair, spec) {
    let boost = 0;
    if (pair && typeof SHORT_HAUL_CURATED_PAIR_BOOST !== "undefined") {
        boost = getCuratedPairRouteBoost(
            pair.src && pair.src.icao,
            pair.dst && pair.dst.icao,
            SHORT_HAUL_CURATED_PAIR_BOOST,
            null
        );
    }
    if (specPrefersIlsDestinations(spec) && pair && pair.dst && airportHasStrictIls(pair.dst)) {
        boost += 6;
    }
    return boost;
}
function isRouteWeightLimitedByRunway(origin, destination, spec) {
    if (!spec || spec.class !== "JET" || !origin) return false;
    return isJetWeightLimitedRunwayAirport(origin, spec)
        || isJetDepartureRunwayPerformanceLimited(origin, spec);
}
function getRunwayOperationalMtowKg(runwayLengthFt, spec) {
    const minRw = Number(spec.minRunwayLength) || 0;
    const mtow = Number(spec.mtow) || 0;
    const oew = Number(spec.oew) || 0;
    if (minRw <= 0 || !runwayLengthFt || runwayLengthFt <= 0) return mtow;
    if (runwayLengthFt >= minRw) return mtow;
    const ratio = runwayLengthFt / minRw;
    const variableMass = Math.max(0, mtow - oew);
    return oew + variableMass * Math.pow(ratio, JET_WEIGHT_LIMITED_RUNWAY_EXPONENT);
}
function getDepartureRunwayOperationalMtow(origin, spec) {
    const origLen = origin && origin.length ? origin.length : 99999;
    const structural = Number(spec.mtow) || 0;
    const oew = Number(spec.oew) || 0;
    const minRw = Number(spec.minRunwayLength) || 0;
    if (minRw > 0 && origLen < minRw) {
        return getRunwayOperationalMtowKg(origLen, spec);
    }
    if (specIsHeavyJet(spec) && origLen < JET_HEAVY_FULL_PERFORMANCE_RUNWAY_FT) {
        const ratio = Math.max(0, origLen / JET_HEAVY_FULL_PERFORMANCE_RUNWAY_FT);
        const variableMass = Math.max(0, structural - oew);
        return oew + variableMass * Math.pow(ratio, JET_HEAVY_RUNWAY_MTOW_EXPONENT);
    }
    return structural;
}
function isJetDepartureRunwayPerformanceLimited(origin, spec) {
    if (!origin || !spec || spec.class !== "JET") return false;
    const structural = Number(spec.mtow) || 0;
    if (structural <= 0) return false;
    return getDepartureRunwayOperationalMtow(origin, spec) < structural * 0.995;
}
function getWeightLimitedRunwayIcaos(origin, destination, spec) {
    const icaos = [];
    if (origin && origin.icao && (
        isJetWeightLimitedRunwayAirport(origin, spec)
        || isJetDepartureRunwayPerformanceLimited(origin, spec)
    )) {
        icaos.push(origin.icao.trim().toUpperCase());
    }
    return icaos;
}
function getJetMaxFuelKg(spec) {
    const fromSpec = Number(spec && spec.maxFuelKg);
    if (fromSpec > 0) return fromSpec;
    const mtow = Number(spec && spec.mtow) || 0;
    const oew = Number(spec && spec.oew) || 0;
    return Math.max(0, mtow - oew) * 0.9;
}
function getJetAllowedMaxGcNm(spec) {
    if (!spec || spec.class !== "JET") return Number(spec && spec.maxD) || Infinity;
    const maxD = Number(spec.maxD) || 0;
    if (maxD <= 0) return Infinity;
    const isHeavy = !!(spec.tags && spec.tags.includes("HEAVY")) || (Number(spec.mtow) || 0) >= HEAVY_JET_MTOW_MIN;
    const factor = isHeavy ? JET_HEAVY_ALLOWED_MAXD_FACTOR : JET_ALLOWED_MAXD_FACTOR;
    return maxD * factor;
}
function getJetCatalogTripFuelPerNm(spec) {
    const maxTank = getJetMaxFuelKg(spec);
    const maxD = Number(spec && spec.maxD) || 0;
    if (maxTank <= 0 || maxD <= 0) return 0;
    return Math.max(0, maxTank - JET_BLOCK_TAXI_FUEL_KG) / maxD;
}
function getJetFuelPlanningDistanceNm(gcDistNm, spec) {
    const nm = Math.max(0, Number(gcDistNm) || 0);
    if (specIsHeavyJet(spec)) return nm;
    if (nm < 2500) return nm;
    return Math.round(nm * JET_NARROWBODY_FUEL_DISTANCE_FACTOR);
}
function getJetNarrowbodyMaxSafeFuelPlanningNm(spec) {
    const maxTank = getJetMaxFuelKg(spec);
    if (maxTank <= 0) return 0;
    const fuelPerNm = Number(spec.fuelPerNm) || 6;
    const reserveFuel = fuelPerNm * JET_RESERVE_HOLD_MINUTES * JET_RESERVE_HOLD_NM_PER_MIN;
    const maxTripFuel = maxTank * JET_NARROWBODY_TANK_RANGE_MARGIN - JET_BLOCK_TAXI_FUEL_KG - reserveFuel;
    if (maxTripFuel <= 0) return 0;
    return maxTripFuel / fuelPerNm;
}
function getJetNarrowbodyMaxSafeGcNm(spec) {
    const fuelNm = getJetNarrowbodyMaxSafeFuelPlanningNm(spec);
    if (fuelNm <= 0) return 0;
    if (fuelNm < 2500) return fuelNm;
    return fuelNm / JET_NARROWBODY_FUEL_DISTANCE_FACTOR;
}
function narrowbodyFuelPlanningExceedsTankSafeEnvelope(gcDistNm, spec) {
    if (!spec || spec.class !== "JET" || specIsHeavyJet(spec)) return false;
    const safeGc = getJetNarrowbodyMaxSafeGcNm(spec);
    if (safeGc <= 0) return true;
    return gcDistNm > safeGc + 1e-6;
}
function getJetMaxDispatchRangeNm(spec) {
    const allowedGc = getJetAllowedMaxGcNm(spec);
    if (specIsHeavyJet(spec)) return allowedGc;
    const maxTank = getJetMaxFuelKg(spec);
    const catalogFpn = getJetCatalogTripFuelPerNm(spec);
    if (maxTank <= 0 || catalogFpn <= 0) return allowedGc;
    const maxTripNm = (maxTank * JET_NARROWBODY_TANK_RANGE_MARGIN) / catalogFpn;
    const maxD = Number(spec.maxD) || 0;
    const safeGc = getJetNarrowbodyMaxSafeGcNm(spec);
    return Math.min(allowedGc, maxD > 0 ? maxD : allowedGc, maxTripNm, safeGc > 0 ? safeGc : allowedGc);
}
function estimateJetBlockFuelBudgetKg(tripDistanceNm, spec) {
    const tripNm = Math.max(0, Number(tripDistanceNm) || 0);
    const fuelPerNm = Number(spec.fuelPerNm) || 6;
    const tripFuel = tripNm * fuelPerNm;
    const reserveFuel = fuelPerNm * JET_RESERVE_HOLD_MINUTES * JET_RESERVE_HOLD_NM_PER_MIN;
    return tripFuel + JET_BLOCK_TAXI_FUEL_KG + reserveFuel;
}
function getJetBlockFuelBudgetKg(tripDistanceNm, spec) {
    const budget = estimateJetBlockFuelBudgetKg(tripDistanceNm, spec);
    const maxTank = getJetMaxFuelKg(spec);
    if (maxTank <= 0) return budget;
    return Math.min(budget, maxTank);
}
/** Still-air trip fuel exceeds tank (or narrowbody range envelope) — SimBrief "exceeds aircraft range". */
function jetTripFuelExceedsTankCapacity(tripDistanceNm, spec) {
    const maxTank = getJetMaxFuelKg(spec);
    if (maxTank <= 0) return false;
    const gc = Math.max(0, Number(tripDistanceNm) || 0);
    if (specIsHeavyJet(spec)) {
        return estimateJetBlockFuelBudgetKg(gc, spec) > maxTank;
    }
    const catalogFpn = getJetCatalogTripFuelPerNm(spec);
    if (catalogFpn <= 0) {
        return estimateJetBlockFuelBudgetKg(gc, spec) > maxTank;
    }
    return gc * catalogFpn > maxTank * JET_NARROWBODY_TANK_RANGE_MARGIN;
}
function isJetSimBriefRouteFeasible(gcDistNm, spec, origin, destination) {
    if (!spec || spec.class !== "JET" || !gcDistNm || isNaN(gcDistNm)) return true;
    const ctx = buildJetRouteFeasibilityContext(spec);
    if (!isJetRouteDistanceFeasible(gcDistNm, ctx)) return false;
    return isJetSimBriefDepartureFeasible(gcDistNm, spec, origin, ctx);
}
function buildJetRouteFeasibilityContext(spec) {
    if (!spec || spec.class !== "JET") return null;
    const isHeavy = specIsHeavyJet(spec);
    const maxTank = getJetMaxFuelKg(spec);
    const catalogFpn = getJetCatalogTripFuelPerNm(spec);
    return {
        allowedGc: getJetAllowedMaxGcNm(spec),
        maxLhNm: isHeavy ? Infinity : getJetMaxDispatchRangeNm(spec),
        narrowbodySafeGc: isHeavy ? Infinity : getJetNarrowbodyMaxSafeGcNm(spec),
        isHeavy,
        maxTank,
        catalogFpn,
        oew: Number(spec.oew) || 0,
        minPayload: getPaxAllInWeightKg(spec),
        fuelPerNm: Number(spec.fuelPerNm) || 6
    };
}
function isJetRouteDistanceFeasible(gcDistNm, ctx) {
    if (!ctx || !gcDistNm || isNaN(gcDistNm)) return true;
    if (gcDistNm > ctx.allowedGc) return false;
    if (!ctx.isHeavy && gcDistNm > ctx.maxLhNm) return false;
    if (ctx.isHeavy) {
        if (ctx.maxTank > 0 && estimateJetBlockFuelBudgetKg(gcDistNm, { fuelPerNm: ctx.fuelPerNm }) > ctx.maxTank) {
            return false;
        }
    } else if (ctx.catalogFpn > 0) {
        if (gcDistNm * ctx.catalogFpn > ctx.maxTank * JET_NARROWBODY_TANK_RANGE_MARGIN) return false;
    } else if (ctx.maxTank > 0 && estimateJetBlockFuelBudgetKg(gcDistNm, { fuelPerNm: ctx.fuelPerNm }) > ctx.maxTank) {
        return false;
    }
    if (!ctx.isHeavy && ctx.narrowbodySafeGc > 0 && gcDistNm > ctx.narrowbodySafeGc + 1e-6) return false;
    return true;
}
function isJetSimBriefDepartureFeasible(gcDistNm, spec, origin, ctx) {
    if (!ctx) return true;
    const operationalTow = origin
        ? getDepartureRunwayOperationalMtow(origin, spec)
        : (Number(spec.mtow) || 0);
    const fuelNm = getJetFuelPlanningDistanceNm(gcDistNm, spec);
    const blockFuel = getJetSimBriefPlanningBlockFuelKg(fuelNm, spec);
    return operationalTow - ctx.oew >= blockFuel + ctx.minPayload;
}
function allocateWeightLimitedJetPayload(spec, type, chosenMission, blockMinutes, operationalTow, tripDistanceNm, scenario) {
    const safeOew = Number(spec.oew) || 42000;
    const blockFuel = getJetSimBriefPlanningBlockFuelKg(tripDistanceNm, spec);
    const maxPayloadAtTow = operationalTow - safeOew - blockFuel;
    if (maxPayloadAtTow <= 0) {
        return { ok: false };
    }
    const paxAllInKg = getPaxAllInWeightKg(spec);
    const maxPaxByWeight = Math.floor(maxPayloadAtTow / paxAllInKg);
    if (maxPaxByWeight < 1 && missionRequiresPassengers(chosenMission, spec, scenario) && (spec.maxPax || 0) > 0) {
        return { ok: false };
    }
    const bizJetPassengerOnly = spec.class === "BIZ JET" && type !== "LJ35" && !isFreightMission(chosenMission);
    let loadFactor = 1.0;
    while (loadFactor + 1e-9 >= WEIGHT_LIMITED_MIN_LOAD_FACTOR) {
        const scaledMaxPax = Math.floor((spec.maxPax || 0) * loadFactor);
        const scaledMaxCargo = Math.floor((spec.maxCargo || 0) * loadFactor);
        if (missionRequiresPassengers(chosenMission, spec, scenario) && (spec.maxPax || 0) > 0) {
            const paxCap = Math.min(scaledMaxPax, maxPaxByWeight);
            const { minPax, effectiveMax } = getPassengerLoadLimits(
                chosenMission, spec, paxCap, blockMinutes, scenario
            );
            if (effectiveMax <= 0) {
                loadFactor -= WEIGHT_LIMITED_LOAD_FACTOR_STEP;
                continue;
            }
            const pax = Math.floor(Math.random() * (effectiveMax - minPax + 1)) + minPax;
            const paxWeight = getSimBriefPassengerPayloadKg(spec, pax);
            if (paxWeight > maxPayloadAtTow) {
                loadFactor -= WEIGHT_LIMITED_LOAD_FACTOR_STEP;
                continue;
            }
            const remainingPayload = maxPayloadAtTow - paxWeight;
            const paxRatio = spec.maxPax > 0 ? (pax / spec.maxPax) : 0;
            const proportionalCargoLimit = (spec.maxCargo || 0) * (1 - paxRatio);
            const hardCargoLimit = Math.floor(Math.min(proportionalCargoLimit, remainingPayload, scaledMaxCargo));
            let cargoKg = 0;
            if (!bizJetPassengerOnly && hardCargoLimit > 0) {
                const cargoFloorKg = getCargoAssignmentFloorKg(scenario, hardCargoLimit);
                if (hardCargoLimit >= cargoFloorKg) {
                    cargoKg = Math.floor(Math.random() * (hardCargoLimit - cargoFloorKg + 1)) + cargoFloorKg;
                } else {
                    cargoKg = hardCargoLimit;
                }
            }
            if (paxWeight + cargoKg > maxPayloadAtTow) {
                cargoKg = Math.max(0, Math.floor(maxPayloadAtTow - paxWeight));
            }
            return { ok: true, pax: pax, cargoKg: cargoKg, hardCargoLimit: hardCargoLimit, loadFactor: loadFactor };
        }
        if ((spec.maxCargo || 0) > 0 && !missionRequiresPassengers(chosenMission, spec, scenario)) {
            const hardCargoLimit = Math.floor(Math.min(scaledMaxCargo, maxPayloadAtTow));
            if (hardCargoLimit <= 0) {
                loadFactor -= WEIGHT_LIMITED_LOAD_FACTOR_STEP;
                continue;
            }
            let cargoKg = 0;
            const cargoFloorKg = getCargoAssignmentFloorKg(scenario, hardCargoLimit);
            if (hardCargoLimit >= cargoFloorKg) {
                cargoKg = Math.floor(Math.random() * (hardCargoLimit - cargoFloorKg + 1)) + cargoFloorKg;
            } else {
                cargoKg = hardCargoLimit;
            }
            return { ok: true, pax: 0, cargoKg: cargoKg, hardCargoLimit: hardCargoLimit, loadFactor: loadFactor };
        }
        if ((spec.maxPax || 0) <= 0 && (spec.maxCargo || 0) <= 0) {
            return { ok: true, pax: 0, cargoKg: 0, hardCargoLimit: 0, loadFactor: loadFactor };
        }
        loadFactor -= WEIGHT_LIMITED_LOAD_FACTOR_STEP;
    }
    return { ok: false };
}
function getSimBriefZfwTonnes(spec, pax, cargoKg) {
    const oew = Number(spec.oew) || 0;
    const zfwKg = oew + getSimBriefPassengerPayloadKg(spec, pax) + Math.max(0, cargoKg);
    return (zfwKg / 1000).toFixed(3);
}
function getJetMaxPaxAtMtow(mtow, oew, blockFuelKg, cargoKg, spec) {
    const cargo = Math.max(0, cargoKg);
    const room = mtow - oew - blockFuelKg - cargo;
    if (room <= 0) return 0;
    let pax = Math.floor(room / getPaxAllInWeightKg(spec));
    while (pax > 0 && oew + getSimBriefPassengerPayloadKg(spec, pax) + cargo + blockFuelKg > mtow) {
        pax--;
    }
    return pax;
}
/** SimBrief often files max tank and exceeds still-air block fuel on long sectors (winds, profile). */
function getJetSimBriefPlanningBlockFuelKg(tripDistanceNm, spec) {
    const budget = getJetBlockFuelBudgetKg(tripDistanceNm, spec);
    const nm = Number(tripDistanceNm) || 0;
    const maxTank = getJetMaxFuelKg(spec);
    let plan = budget;
    if (nm >= 3500) plan = budget * 1.04;
    if (maxTank > 0) {
        const nearTankLimit = budget >= maxTank * JET_SIMBRIEF_TANK_FILL_THRESHOLD;
        if (nearTankLimit) {
            plan = Math.max(plan, maxTank);
        }
        plan = Math.min(maxTank, plan);
    }
    return plan;
}
function isJetFuelCriticalSector(fuelDistanceNm) {
    const nm = Number(fuelDistanceNm) || 0;
    return nm >= 3500;
}
const MTOW_ENFORCED_CLASSES = ["JET", "BIZ JET", "TURBO"];
function getMtowPlanningBlockFuelKg(fuelDistanceNm, spec) {
    return spec.class === "JET"
        ? getJetSimBriefPlanningBlockFuelKg(fuelDistanceNm, spec)
        : Math.max(0, Number(fuelDistanceNm) || 0) * (Number(spec.fuelPerNm) || 0.5);
}
function capJetPaxForMtow(pax, cargoKg, safeMtow, safeOew, fuelDistanceNm, spec) {
    if (!spec || !MTOW_ENFORCED_CLASSES.includes(spec.class) || !(spec.maxPax > 0)) return pax;
    const planFuel = getMtowPlanningBlockFuelKg(fuelDistanceNm, spec);
    const maxPax = getJetMaxPaxAtMtow(safeMtow, safeOew, planFuel, cargoKg, spec);
    if (maxPax <= 0) return 0;
    return Math.min(pax, maxPax);
}
function enforceJetTowPayloadCap(spec, pax, cargoKg, fuelDistanceNm, operationalMtow, chosenMission, blockMinutes, scenario) {
    if (!spec || !MTOW_ENFORCED_CLASSES.includes(spec.class)) return { pax: pax, cargoKg: cargoKg };
    const oew = Number(spec.oew) || 0;
    const mtow = operationalMtow || Number(spec.mtow) || 0;
    const blockFuel = getMtowPlanningBlockFuelKg(fuelDistanceNm, spec);
    let outPax = pax;
    let outCargo = cargoKg;
    const maxPaxAtMtow = getJetMaxPaxAtMtow(mtow, oew, blockFuel, outCargo, spec);
    if (missionRequiresPassengers(chosenMission, spec, scenario) && (spec.maxPax || 0) > 0 && maxPaxAtMtow < outPax) {
        outPax = Math.max(0, maxPaxAtMtow);
    }
    function totalWeight() {
        return oew + getSimBriefPassengerPayloadKg(spec, outPax) + outCargo + blockFuel;
    }
    while (totalWeight() > mtow && outCargo > 0) {
        outCargo = Math.max(0, outCargo - 200);
    }
    const trimMinPax = missionRequiresPassengers(chosenMission, spec, scenario) && (spec.maxPax || 0) > 0 ? 1 : 0;
    while (totalWeight() > mtow && outPax > trimMinPax) {
        outPax--;
    }
    if (totalWeight() > mtow) return null;
    return { pax: outPax, cargoKg: outCargo };
}
function enforceMzfwCap(spec, pax, cargoKg, chosenMission, scenario) {
    if (!spec || !(spec.mzfw > 0)) return { pax: pax, cargoKg: cargoKg };
    const oew = Number(spec.oew) || 0;
    const mzfw = Number(spec.mzfw);
    let outPax = pax;
    let outCargo = cargoKg;
    function zfw() {
        return oew + getSimBriefPassengerPayloadKg(spec, outPax) + outCargo;
    }
    while (zfw() > mzfw && outCargo > 0) {
        outCargo = Math.max(0, outCargo - 200);
    }
    const trimMinPax = missionRequiresPassengers(chosenMission, spec, scenario) && (spec.maxPax || 0) > 0 ? 1 : 0;
    while (zfw() > mzfw && outPax > trimMinPax) {
        outPax--;
    }
    if (zfw() > mzfw) return null;
    return { pax: outPax, cargoKg: outCargo };
}
function enforceMlwCap(spec, pax, cargoKg, fuelDistanceNm, chosenMission, scenario) {
    if (!spec || !(spec.mlw > 0)) return { pax: pax, cargoKg: cargoKg };
    const oew = Number(spec.oew) || 0;
    const mlw = Number(spec.mlw);
    const blockFuel = spec.class === "JET"
        ? getJetSimBriefPlanningBlockFuelKg(fuelDistanceNm, spec)
        : Math.max(0, Number(fuelDistanceNm) || 0) * (Number(spec.fuelPerNm) || 0.5);
    let outPax = pax;
    let outCargo = cargoKg;
    function totalWeight() {
        return oew + getSimBriefPassengerPayloadKg(spec, outPax) + outCargo + blockFuel;
    }
    while (totalWeight() > mlw && outCargo > 0) {
        outCargo = Math.max(0, outCargo - 200);
    }
    const trimMinPax = missionRequiresPassengers(chosenMission, spec, scenario) && (spec.maxPax || 0) > 0 ? 1 : 0;
    while (totalWeight() > mlw && outPax > trimMinPax) {
        outPax--;
    }
    if (totalWeight() > mlw) return null;
    return { pax: outPax, cargoKg: outCargo };
}
/**
 * Dispatcher physics audit — every check SimBrief cares about (no weather).
 * Returns violation strings; empty array means the plan is internally consistent.
 */
function validateJetDispatchPhysics(type, spec, origin, destination, gcDistNm, fuelDistNm, pax, cargoKg, operationalMtow) {
    if (!spec || !MTOW_ENFORCED_CLASSES.includes(spec.class)) return [];
    const violations = [];
    const gc = Number(gcDistNm) || 0;
    const fuelNm = Number(fuelDistNm) || getJetFuelPlanningDistanceNm(gc, spec);
    const oew = Number(spec.oew) || 0;
    const mtow = operationalMtow || (origin ? getDepartureRunwayOperationalMtow(origin, spec) : Number(spec.mtow) || 0);
    const maxTank = getJetMaxFuelKg(spec);
    const planFuel = getMtowPlanningBlockFuelKg(fuelNm, spec);
    const paxN = Math.max(0, Number(pax) || 0);
    const cargoN = Math.max(0, Number(cargoKg) || 0);
    const zfw = oew + getSimBriefPassengerPayloadKg(spec, paxN) + cargoN;
    const tow = zfw + planFuel;

    if (gc > getJetAllowedMaxGcNm(spec)) {
        violations.push(`distance ${gc} nm exceeds GC envelope (${Math.round(getJetAllowedMaxGcNm(spec))} nm)`);
    }
    if (!isJetSimBriefRouteFeasible(gc, spec, origin, destination)) {
        violations.push("route fails range/tank/runway feasibility gate");
    }
    if (spec.class === "JET") {
        if (jetTripFuelExceedsTankCapacity(gc, spec)) {
            violations.push(`trip fuel exceeds tank capacity (max ${maxTank} kg)`);
        }
        if (maxTank > 0 && planFuel > maxTank + 1) {
            violations.push(`planning fuel ${Math.round(planFuel)} kg exceeds tank ${maxTank} kg`);
        }
    }
    if (specIsHeavyJet(spec) && maxTank > 0) {
        const stillAir = estimateJetBlockFuelBudgetKg(fuelNm, spec);
        if (stillAir > maxTank + 1) {
            violations.push(`still-air fuel need ${Math.round(stillAir)} kg exceeds tank ${maxTank} kg`);
        }
    }
    if (narrowbodyFuelPlanningExceedsTankSafeEnvelope(gc, spec)) {
        violations.push(`distance ${gc} nm exceeds narrowbody tank-safe envelope (${Math.round(getJetNarrowbodyMaxSafeGcNm(spec))} nm)`);
    }
    if (tow > mtow + 1) {
        violations.push(
            `TOW ${Math.round(tow)} kg > MTOW ${Math.round(mtow)} kg`
            + ` (${paxN} pax, ${cargoN} kg cargo, ${Math.round(planFuel)} kg fuel)`
        );
    }
    const maxPax = getJetMaxPaxAtMtow(mtow, oew, planFuel, cargoN, spec);
    if (paxN > maxPax) {
        violations.push(`${paxN} pax exceeds MTOW cap ${maxPax} at ${Math.round(planFuel)} kg fuel`);
    }
    if ((spec.maxPax || 0) > 0 && paxN > spec.maxPax) {
        violations.push(`${paxN} pax exceeds seat capacity ${spec.maxPax}`);
    }
    if ((spec.maxCargo || 0) > 0 && cargoN > spec.maxCargo) {
        violations.push(`${cargoN} kg cargo exceeds maxCargo ${spec.maxCargo} kg`);
    }
    if ((spec.mzfw || 0) > 0 && zfw > spec.mzfw + 1) {
        violations.push(`ZFW ${Math.round(zfw)} kg > MZFW ${Math.round(spec.mzfw)} kg`);
    }
    if ((spec.mlw || 0) > 0 && tow > spec.mlw + 1) {
        violations.push(`landing weight ${Math.round(tow)} kg > MLW ${Math.round(spec.mlw)} kg`);
    }
    return violations;
}
const LOWI_NARROWBODY_JETLINERS = ["B736", "B737", "B738", "B738_BDSF", "B738_BCF", "A319", "A320", "A321"];
const LOWI_UNRESTRICTED_CLASSES = ["GA", "TURBO", "HELI", "WARBIRD", "BIZ JET"];
const LOWI_LARGE_PROPLINER_MTOW = 40000;
const MIN_ASSIGNED_PAYLOAD_KG = 25;

function getCargoAssignmentFloorKg(scenario, hardLimit) {
    const loadFactor = Number(scenario && scenario.minCargoLoadFactor);
    if (!(hardLimit > 0) || !(loadFactor > 0)) return MIN_ASSIGNED_PAYLOAD_KG;
    return Math.min(hardLimit, Math.max(MIN_ASSIGNED_PAYLOAD_KG, Math.ceil(hardLimit * Math.min(1, loadFactor))));
}

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
        if (LOWI_NARROWBODY_JETLINERS.includes(type)) return true;
        if (spec.tags && spec.tags.includes("BOMBER")) return false;
        if (specIsHeavyJet(spec)) return false;
        if (spec.mtow > 50000) return false;
        return true;
    }
    return true;
}
function isLowiNarrowbodyJetliner(type, spec) {
    return spec.class === "JET" && LOWI_NARROWBODY_JETLINERS.includes(type);
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
    if (!lengthOk && isJetWeightLimitedRunwayAirport(ap, spec)) {
        lengthOk = true;
    }
    return { isAllowedType: allowed, meetsLength: lengthOk };
}
function checkAirportForAircraft(ap, spec, type, depOverride, forceMilitaryBases, isContractorMode) {
    const overrideIcao = (depOverride || "").trim().toUpperCase();
    const apIcao = (ap.icao || "").trim().toUpperCase();
    if (spec.class === "GLIDER" && !isGliderSuitableAirport(ap, spec)) {
        return getGliderUnsuitabilityReason(ap, spec) || "runway_length";
    }
    if (!passesAircraftGatedAirport(ap, type)) return "scenery_aircraft";
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
    if (!passesHeavyAirlifterAirport(ap, spec)) return "heavy_airlifter";
    return null;
}
function formatPinnedAirportUnsuitableNotam(icao, spec, type, depOverride, forceMilitaryBases, isContractorMode) {
    const code = (icao || "").trim().toUpperCase();
    if (!code) return null;
    const ap = activeAirportDatabase.find(a => a.icao && a.icao.trim().toUpperCase() === code);
    if (!ap) return null;
    const blockReason = checkAirportForAircraft(ap, spec, type, depOverride || code, forceMilitaryBases, isContractorMode);
    if (!blockReason) return null;
    if (blockReason === "runway_length") {
        const rwyFt = ap.length ? Math.round(ap.length).toLocaleString("en-GB") : "";
        const needFt = spec.minRunwayLength ? Math.round(spec.minRunwayLength).toLocaleString("en-GB") : "";
        const rwyNote = rwyFt && needFt
            ? ` (${rwyFt} ft runway; this aircraft needs ${needFt} ft)`
            : "";
        return formatDispatchNotam(
            "The runway at " + code + rwyNote + " is too short for your currently selected aircraft."
        );
    }
    if (blockReason === "runway_class") {
        return formatDispatchNotam("The runway category at " + code + " does not support your currently selected aircraft.");
    }
    if (blockReason === "military_access") {
        return formatDispatchNotam(code + " is a military airbase. Enable contractor mode, select a military aircraft, tick Use Military airbases, or choose a different airport.");
    }
    if (blockReason === "military_only_mode") {
        return formatDispatchNotam("Military airbases only is enabled, but " + code + " is not a military airbase.");
    }
    if (blockReason === "scenery_aircraft") {
        return formatDispatchNotam(code + " is only available with the Miltech Simulations MH-60. Select that aircraft to dispatch here.");
    }
    return formatDispatchNotam("This airport is unsuitable for your currently selected aircraft.");
}
function buildRouteFailureMessage(depOverride, type, spec, validAirports, departureAvailable, forceMilitaryBases, isContractorMode, navigraphOnly) {
    if (navigraphOnly) {
        if (depOverride) {
            return "Navigraph destinations only is enabled, but no Navigraph arrivals were found within range from your departure. Clear that option, increase flight time, choose Worldwide routing, or pick a different departure.";
        }
        return "Navigraph destinations only is enabled, but no suitable Navigraph arrivals match your aircraft and settings. Clear that option or adjust flight time and routing.";
    }
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
            if (blockReason === "scenery_aircraft") {
                return `${depOverride} is only available with the Miltech Simulations MH-60. Select that aircraft to dispatch here.`;
            }
        }
        const scope = getRoutingScope();
        const routingMismatch = getDepartureRoutingScopeMismatchMessage(depOverride, scope);
        if (routingMismatch) return routingMismatch;
        const depIsValid = departureAvailable;
        if (depIsValid) {
            if (scope !== "worldwide") {
                return `No destinations were found within range from ${depOverride} for your aircraft, flight time, and routing region. Try increasing flight time, choosing Worldwide routing, or leave departure blank for a random route.`;
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
    if (m.type === 30 || m.type === 31) return true;
    if (m.pool === "helicopterOps-MIL") return true;
    const classes = m.allowedClasses;
    return !!(classes && classes.length === 1 && classes[0] === "HELI" && m.militaryOnly);
}
function isMilitaryMissionRestricted(spec) {
    if (!spec.isMilitary) return false;
    if (spec.class === "WARBIRD") return false;
    const tags = spec.tags || [];
    if (tags.includes("CIVIL_OK")) return false;
    if (spec.class === "HELI") return tags.includes("MILITARY_HELI");
    return true;
}
function isMilAirlifterCivilRestricted(type) {
    if (typeof MIL_AIRLIFTER_CIVIL_TYPES !== "undefined") {
        return MIL_AIRLIFTER_CIVIL_TYPES.includes(type);
    }
    return type === "A400";
}
function getMilAirlifterCivilScenarioAllowlist(type) {
    if (typeof getMilAirlifterCivilScenarioImgIds === "function") {
        return getMilAirlifterCivilScenarioImgIds(type);
    }
    if (type === "A400" && typeof A400_CIVIL_FREIGHT_SCENARIO_IMGIDS !== "undefined") {
        return A400_CIVIL_FREIGHT_SCENARIO_IMGIDS;
    }
    return null;
}
function passesAircraftCivilMissionAllowlist(m, type, spec) {
    if (!spec.isMilitary || m.militaryOnly) return true;
    if (!isMilAirlifterCivilRestricted(type)) return true;
    return m.type === 18;
}
function filterScenariosForLimitedCivilAircraft(pool, type, spec, mission) {
    if (typeof usesMissionAssignments === "function" && usesMissionAssignments()) return pool;
    if (!spec.isMilitary || mission.militaryOnly) return pool;
    const allowlist = getMilAirlifterCivilScenarioAllowlist(type);
    if (!allowlist) return pool;
    return pool.filter(s => allowlist.includes(s.imgId));
}
function isWarbirdHeritageMission(m) {
    return !!(m && (m.type === 25 || m.pool === "vintageOps"));
}
function isTacticalAirframeForMission(spec, aircraftType, missionType) {
    return !!spec.isTactical
        || (aircraftType === "H47D" && missionType === 23)
        || (aircraftType === "VULC" && missionType === 23);
}
function passesMissionContextFilter(m, spec, origin, isContractorMode, aircraftType) {
    const isTacticalAirframe = isTacticalAirframeForMission(spec, aircraftType, m.type);
    if (isMilitaryHelicopterMission(m) && spec.class !== "HELI") return false;
    if (m.tacticalOnly && !isTacticalAirframe) return false;
    if (m.civilianOnly && spec.isMilitary) return false;
    if (m.militaryOnly && !spec.isMilitary && !isContractorMode) return false;
    if (!m.militaryOnly && isMilitaryMissionRestricted(spec)) return false;
    const isFreight = isFreightMission(m);
    if (origin && origin.isMilitary && !m.militaryOnly && !isFreight) {
        if (!(spec.class === "WARBIRD" && isWarbirdHeritageMission(m))) return false;
    }
    return true;
}
function passesScenarioPhysicalHardLocks(s, type, spec) {
    if (s.minCargo && spec.maxCargo < s.minCargo) return false;
    if (s.excludedAircraft && s.excludedAircraft.includes(type)) return false;
    return true;
}
function getExcludedScenarioImgIdsForPool(pool, aircraftType, spec) {
    const excluded = new Set();
    if (!Array.isArray(pool)) return excluded;
    const assigned = getAssignedImgIdSetForAircraft(aircraftType) || new Set();
    pool.forEach(s => {
        if (!assigned.has(s.imgId)) {
            excluded.add(s.imgId);
        } else if (!passesScenarioPhysicalHardLocks(s, aircraftType, spec)) {
            excluded.add(s.imgId);
        }
    });
    return excluded;
}
function scenarioPassesHardLocks(s, type, spec, excludedImgIds) {
    if (excludedImgIds.has(s.imgId)) return false;
    if (isScenarioAllowedForAircraft(type, s.imgId) !== true) return false;
    return passesScenarioPhysicalHardLocks(s, type, spec);
}
function filterScenariosByMissionType(activePool, mission) {
    if (!activePool || !activePool.length) return activePool || [];
    const hasTypedScenarios = activePool.some(s => s.missionType != null);
    if (hasTypedScenarios) {
        return activePool.filter(s => s.missionType === mission.type);
    }
    return activePool.filter(s => !s.missionType || s.missionType === mission.type);
}
function passesAssignmentOnlyMissionLocks(m, type, searchClass, spec, origin) {
    if (isMilitaryHelicopterMission(m) && searchClass !== "HELI") return false;
    if (m.type === 23 && spec.class === "HELI" && type !== "H47D") return false;
    if (m.minCargo && spec.maxCargo < m.minCargo) return false;
    if (!passesTemplateMtowCap(m, searchClass, spec)) return false;
    if (!passesTemplateMinPaxSeats(m, searchClass, spec)) return false;
    if (m.excludedAircraft && m.excludedAircraft.includes(type)) return false;
    if (m.requiredDep) {
        if (Array.isArray(m.requiredDep)) {
            if (!m.requiredDep.includes(origin.icao)) return false;
        } else if (origin.icao !== m.requiredDep) {
            return false;
        }
    }
    return true;
}
function passesHardMissionLocksForAssignments(m, type, searchClass, spec, origin, isContractorMode) {
    return passesAssignmentOnlyMissionLocks(m, type, searchClass, spec, origin || { icao: "", isMilitary: false });
}
function applyAssignmentScenarioFilters(activePool, mission, type, spec, isLocalFlight) {
    let pool = filterScenariosByMissionType(activePool, mission);
    if (mission.type === 31) {
        const staffOnly = pool.filter(s => s.staffShuttle && !s.heliOps);
        if (staffOnly.length > 0) pool = staffOnly;
    } else if (mission.type === 30) {
        const heliOnly = pool.filter(s => s.heliOps);
        if (heliOnly.length > 0) pool = heliOnly;
    }
    if (spec.class !== "HELI") {
        pool = pool.filter(s => !s.heliOps);
    }
    if (mission.pool === "gliderOps" && typeof isLocalFlight === "boolean") {
        if (isLocalFlight) {
            const localOnly = pool.filter(s => s.isLocal);
            if (localOnly.length > 0) pool = localOnly;
        } else {
            const transitOnly = pool.filter(s => !s.isLocal);
            if (transitOnly.length > 0) pool = transitOnly;
        }
    }
    return pool;
}
function missionHasAssignedPlayableScenario(mission, type, spec, isLocalFlight) {
    if (!mission.pool || typeof scenarioDB === "undefined" || !scenarioDB[mission.pool]) return false;
    const assigned = getAssignedImgIdSetForAircraft(type);
    if (!assigned || assigned.size === 0) return false;
    const missionPool = scenarioDB[mission.pool];
    let activePool = missionPool.filter(s => assigned.has(s.imgId) && passesScenarioPhysicalHardLocks(s, type, spec));
    activePool = filterScenariosForLimitedCivilAircraft(activePool, type, spec, mission);
    activePool = applyAssignmentScenarioFilters(activePool, mission, type, spec, isLocalFlight);
    return activePool.length > 0;
}
function buildFilteredMissionListFromAssignments(spec, type, searchClass, origin, isContractorMode, isLocalFlight) {
    const originForLocks = origin || { icao: "", isMilitary: false };
    const assigned = getAssignedImgIdSetForAircraft(type);
    if (!assigned || assigned.size === 0) return [];
    let filteredMissions = missionMatrix.filter(m => {
        if (!passesHardMissionLocksForAssignments(m, type, searchClass, spec, originForLocks, isContractorMode)) return false;
        if (m.requiredDep && !origin) return false;
        if (!usesMissionAssignments() && !passesAircraftCivilMissionAllowlist(m, type, spec)) return false;
        if (origin && !passesMissionContextFilter(m, spec, origin, isContractorMode, type)) return false;
        if (!origin) {
            if (m.civilianOnly && spec.isMilitary) return false;
            if (m.militaryOnly && !spec.isMilitary && !isContractorMode) return false;
            if (!m.militaryOnly && isMilitaryMissionRestricted(spec)) return false;
            if (isMilitaryHelicopterMission(m) && spec.class !== "HELI") return false;
            if (m.tacticalOnly && !isTacticalAirframeForMission(spec, type, m.type)) return false;
        }
        return missionHasAssignedPlayableScenario(m, type, spec, isLocalFlight);
    });
    if (typeof isLocalFlight === "boolean") {
        filteredMissions = filteredMissions.filter(m => !m.isLocal || isLocalFlight);
        if (spec.class === "HELI" && isLocalFlight) {
            const localMissions = filteredMissions.filter(m => m.isLocal);
            if (localMissions.length > 0) filteredMissions = localMissions;
        }
    }
    return filteredMissions;
}
function applyAssignedOnlyScenarioFilter(activePool, aircraftType) {
    if (typeof filterPoolToAssignedOnly === "function") {
        return filterPoolToAssignedOnly(aircraftType, activePool);
    }
    if (typeof usesMissionAssignments === "function" && usesMissionAssignments()) {
        return activePool.filter(s => isScenarioAllowedForAircraft(aircraftType, s.imgId) === true);
    }
    return activePool;
}
function buildActiveScenarioPoolForMission(mission, type, spec, isLocalFlight) {
    if (!mission.pool || typeof scenarioDB === "undefined" || !scenarioDB[mission.pool]) {
        return [];
    }
    const missionPool = scenarioDB[mission.pool];
    const excludedImgIds = getExcludedScenarioImgIdsForPool(missionPool, type, spec);
    let activePool = filterScenarioPool(missionPool, type, spec, excludedImgIds);
    activePool = filterScenariosForLimitedCivilAircraft(activePool, type, spec, mission);
    activePool = filterScenariosByMissionType(activePool, mission);
    if (mission.type === 31) {
        const staffOnly = activePool.filter(s => s.staffShuttle && !s.heliOps);
        if (staffOnly.length > 0) activePool = staffOnly;
    } else if (mission.type === 30) {
        const heliOnly = activePool.filter(s => s.heliOps);
        if (heliOnly.length > 0) activePool = heliOnly;
    }
    if (spec.class !== "HELI") {
        activePool = activePool.filter(s => !s.heliOps);
    }
    if (mission.pool === "gliderOps" && typeof isLocalFlight === "boolean") {
        if (isLocalFlight) {
            const localOnly = activePool.filter(s => s.isLocal);
            if (localOnly.length > 0) activePool = localOnly;
        } else {
            const transitOnly = activePool.filter(s => !s.isLocal);
            if (transitOnly.length > 0) activePool = transitOnly;
        }
    }
    return applyAssignedOnlyScenarioFilter(activePool, type);
}
function filterScenarioPool(pool, type, spec, excludedImgIds) {
    return pool.filter(s => scenarioPassesHardLocks(s, type, spec, excludedImgIds));
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
function isMedevacMission(m) {
    return !!(m && (m.type === 19 || m.pool === "medical"));
}
function applyMedevacHatWeighting(hat) {
    const medevac = hat.filter(e => isMedevacMission(e.mission));
    if (!medevac.length) return hat;
    const nonMedevacSum = hat
        .filter(e => !isMedevacMission(e.mission))
        .reduce((sum, e) => sum + e.weight, 0);
    if (nonMedevacSum <= 0) return hat;
    const medevacSum = medevac.reduce((sum, e) => sum + e.weight, 0);
    if (medevacSum <= 0) return hat;
    const targetMedevacSum = nonMedevacSum * (MEDEVAC_TARGET_SHARE / (1 - MEDEVAC_TARGET_SHARE));
    const scale = targetMedevacSum / medevacSum;
    return hat.map(e => (
        isMedevacMission(e.mission) ? { mission: e.mission, scenario: e.scenario, weight: e.weight * scale } : e
    ));
}
function isU16ExclusiveUniqueMission(mission) {
    return !!(mission && mission.pool === "uniqueMissions" && Array.isArray(mission.allowedAircraft)
        && mission.allowedAircraft.length === 1 && mission.allowedAircraft[0] === "U16");
}
function getAircraftExclusiveMissionWeight(mission, aircraftType) {
    if (!mission || !aircraftType) return null;
    if (isU16ExclusiveUniqueMission(mission) && aircraftType === "U16") {
        return mission.weight || 10;
    }
    if (mission.type === 26 && aircraftType === "DC6B" && mission.pool === "vintageAirliner") {
        return mission.weight || 40;
    }
    if (mission.type === 33 && aircraftType === "DC6A" && mission.pool === "vintageProplinerFreight") {
        return mission.weight || 40;
    }
    return null;
}
function getScenarioHatWeight(scenario, mission, searchClass, aircraftType) {
    if (scenario.weight != null) return scenario.weight;
    const exclusiveWeight = getAircraftExclusiveMissionWeight(mission, aircraftType);
    if (exclusiveWeight != null) return exclusiveWeight;
    if (searchClass === "GA" && isSpiritualGuruScenario(scenario)) return 2;
    if (mission.type <= 13) return getMissionTemplateWeight(mission, searchClass, aircraftType);
    if (typeof usesMissionAssignments === "function" && usesMissionAssignments()
        && (scenario.imgId === 4 || scenario.imgId === 5)) {
        return DEFAULT_HAT_WEIGHT * 0.25;
    }
    return DEFAULT_HAT_WEIGHT;
}
function buildMissionScenarioHat(missions, type, spec, searchClass, isLocalFlight) {
    const hat = [];
    for (const mission of missions) {
        const activePool = buildActiveScenarioPoolForMission(mission, type, spec, isLocalFlight);
        if (!activePool.length) continue;
        if (mission.type <= 13) {
            const scenario = activePool.find(s => s.imgId === mission.type);
            if (scenario) {
                hat.push({
                    mission,
                    scenario,
                    weight: getScenarioHatWeight(scenario, mission, searchClass, type)
                });
            }
            continue;
        }
        for (const scenario of activePool) {
            hat.push({
                mission,
                scenario,
                weight: getScenarioHatWeight(scenario, mission, searchClass, type)
            });
        }
    }
    return hat;
}
function pickFromMissionScenarioHat(hat) {
    if (!hat.length) return null;
    const weightedHat = applyMedevacHatWeighting(hat);
    return pickWeightedRandom(weightedHat, DEFAULT_HAT_WEIGHT, entry => entry.weight);
}
function isSpiritualGuruScenario(scenario) {
    return !!(scenario && scenario.payload && scenario.payload.includes("spiritual guru"));
}
function buildWeightedMissionSelectionPool(missions, spec, searchClass, type, isContractorMode) {
    return applyReconMissionWeighting(
        applyContractorMissionWeighting(
            applyCivilOkWeighting(missions, spec, searchClass, type),
            isContractorMode
        ),
        type,
        spec
    );
}
function getMissionTemplateWeight(m, searchClass, aircraftType) {
    const defaultWeight = 10;
    const exclusiveWeight = getAircraftExclusiveMissionWeight(m, aircraftType);
    if (exclusiveWeight != null) return exclusiveWeight;
    const base = searchClass === "GA" ? defaultWeight : (m.weight || defaultWeight);
    if (m.type === 7) return base * 0.1;
    if (typeof usesMissionAssignments === "function" && usesMissionAssignments() && m.pool === "uniqueMissions") {
        if (m.type === 4 || m.type === 5) return base * 0.08;
        return base * 0.35;
    }
    return base;
}
function applyCivilOkWeighting(missions, spec, searchClass, aircraftType) {
    const defaultWeight = 10;
    const baseWeight = (m) => getMissionTemplateWeight(m, searchClass, aircraftType);
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
function applyReconMissionWeighting(weightedMissions, aircraftType, spec) {
    const tags = (spec && spec.tags) || [];
    if (aircraftType !== "VULC" && !tags.includes("RECON")) return weightedMissions;
    return weightedMissions.map(entry => ({
        mission: entry.mission,
        weight: entry.mission.type === 32 ? entry.weight * 4 : entry.weight
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
        if (spec && spec.isMilitary) {
            matched = candidatePairs.filter(pair => pair.src.isMilitary);
            if (matched.length) {
                const bothMilitary = matched.filter(pair => pair.dst.isMilitary);
                if (bothMilitary.length) matched = bothMilitary;
            }
        } else {
            matched = candidatePairs.filter(pair => pair.dst.isMilitary);
            const bothMilitary = matched.filter(pair => pair.src.isMilitary && pair.dst.isMilitary);
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
function buildFilteredMissionList(spec, type, searchClass, origin, isContractorMode, isLocalFlight) {
    requireMissionAssignmentsLoaded();
    const assigned = getAssignedImgIdSetForAircraft(type);
    if (!assigned || assigned.size === 0) {
        return [];
    }
    return buildFilteredMissionListFromAssignments(spec, type, searchClass, origin, isContractorMode, isLocalFlight);
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
function dispatchContractorMissionFirst(candidatePairs, spec, type, searchClass, isContractorMode, routingTargetMins, targetDistNm, preferOwned) {
    let missionPool = buildFilteredMissionList(spec, type, searchClass, null, isContractorMode, null);
    if (!missionPool.length) return null;
    const triedTypes = new Set();
    for (let attempt = 0; attempt < 12; attempt++) {
        const remaining = missionPool.filter(m => !triedTypes.has(m.type));
        if (!remaining.length) break;
        const selectionPoolWithGuard = remaining;
        const weightedMissions = buildWeightedMissionSelectionPool(
            selectionPoolWithGuard, spec, searchClass, type, isContractorMode
        );
        const pickedEntry = pickWeightedMissionEntry(weightedMissions);
        if (!pickedEntry) break;
        const mission = pickedEntry.mission;
        triedTypes.add(mission.type);
        const missionRoutes = filterRoutesForContractorMission(candidatePairs, mission, spec);
        if (!missionRoutes.length) continue;
        const weightedRoutePool = buildContractorRoutePool(missionRoutes, preferOwned);
        const selectedRoute = pickRouteByTimeFit(weightedRoutePool, routingTargetMins, targetDistNm, spec, type);
        if (!selectedRoute) continue;
        return { mission, route: selectedRoute };
    }
    return null;
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
// Real climb performance decays roughly linearly toward zero as altitude approaches
// an aircraft's service ceiling (POH charts / MSFS testing confirm this pattern across
// GA, turboprop, and jet types alike) — a flat average fpm can't represent that, so the
// last few thousand feet below ceiling take disproportionately longer than a flat rate
// would suggest, which is why aircraft rarely dispatch near their absolute ceiling.
// Descent is flown to hold a constant 3° path (pilot/ATC managed, not thrust-limited),
// so it stays a flat rate with no decay.
// climbMins(A) = climb time from actual field elevation (depElev) to A, not from sea level —
// an airport at 5,000-8,000ft field elevation needs that much less climbing to reach any given A.
// descentMins(A) = time to descend from A down to the arrival field elevation (arrElev), not to
// sea level. Solve climbMins(A) + descentMins(A) <= availableMins for max A via bisection.
function solveMaxAltitudeForTimeBudget(availableMins, climbRateSeaLevel, descentRateFpm, serviceCeiling, depElev, arrElev) {
    if (availableMins <= 0 || climbRateSeaLevel <= 0 || descentRateFpm <= 0 || serviceCeiling <= 0) return 0;
    const depAlt = Math.max(0, Math.min(depElev || 0, serviceCeiling * 0.9999));
    const arrAlt = Math.max(0, Math.min(arrElev || 0, serviceCeiling * 0.9999));
    const climbTimeFromSeaLevelTo = (alt) => {
        const ratio = Math.min(Math.max(alt, 0) / serviceCeiling, 0.9999);
        return (serviceCeiling / climbRateSeaLevel) * -Math.log(1 - ratio);
    };
    const depClimbBaseline = climbTimeFromSeaLevelTo(depAlt);
    const timeForAlt = (alt) => {
        const climbMins = Math.max(0, climbTimeFromSeaLevelTo(alt) - depClimbBaseline);
        const descentMins = Math.max(0, alt - arrAlt) / descentRateFpm;
        return climbMins + descentMins;
    };
    let lo = depAlt;
    let hi = serviceCeiling * 0.9999;
    if (timeForAlt(hi) <= availableMins) return hi;
    for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        if (timeForAlt(mid) <= availableMins) lo = mid; else hi = mid;
    }
    return lo;
}
function probeDispatchFlight(config) {
    const fail = (reason, message, extra) => Object.assign({ ok: false, reason, message: message || "" }, extra || {});
    const cfg = config || {};
    const callsignRaw = (cfg.callsign || "TEST").trim().toUpperCase();
    const depOverride = (cfg.depOverride || "").trim().toUpperCase();
    const destOverride = (cfg.destOverride || "").trim().toUpperCase();
    const targetMins = parseInt(cfg.targetMins, 10) || 60;
    const isContractorMode = !!cfg.isContractorMode;
    const militaryBasesToggle = !!cfg.militaryBasesToggle;
    const preferOwned = !!cfg.preferOwned;
    const navigraphOnly = !!cfg.navigraphOnly;
    const routingScope = cfg.routingScope === "americas" || cfg.routingScope === "row" ? cfg.routingScope : "worldwide";
    const mutateHistory = cfg.mutateHistory !== false;
    const flightRulesMode = cfg.flightRulesMode === "VFR" ? "VFR" : "IFR";
    const preferLowerCruise = !!cfg.preferLowerCruise;
    const warnings = [];

    rebuildActiveDatabase();
    if (getMergedSeedAirports().length === 0) {
        return fail("no_airports_db", "Airport databases failed to load (0 airports in memory). Hard-refresh the page (Ctrl+F5).");
    }
    if (depOverride) {
        const searchIcao = depOverride.trim().toUpperCase();
        const depAp = activeAirportDatabase.find(ap => ap.icao && ap.icao.trim().toUpperCase() === searchIcao);
        if (!depAp) {
            return fail("invalid_dep", `Error: The airport ${searchIcao} was not found. Please check the ICAO code.`);
        }
    }
    if (destOverride) {
        const searchIcao = destOverride.trim().toUpperCase();
        const destAp = activeAirportDatabase.find(ap => ap.icao && ap.icao.trim().toUpperCase() === searchIcao);
        if (!destAp) {
            return fail("invalid_dest", `Error: The airport ${searchIcao} was not found. Please check the ICAO code.`);
        }
    }
    if (!callsignRaw) {
        return fail("no_callsign", "Please supply a Callsign to proceed.");
    }
    const type = cfg.aircraftType;
    if (!type || !activeFleetSpecs[type]) {
        return fail("invalid_aircraft", "Please select a valid aircraft from the searchable list.");
    }

    let spec = JSON.parse(JSON.stringify(activeFleetSpecs[type]));
    const contractorMissionFirst = usesContractorMissionFirstRouting(isContractorMode, spec);
    const routingMilitaryOnly = getRoutingMilitaryOnlyMode(isContractorMode, spec, militaryBasesToggle);
    const routingTargetMins = targetMins;

    if (depOverride) {
        const depUnsuitable = formatPinnedAirportUnsuitableNotam(
            depOverride, spec, type, depOverride, routingMilitaryOnly, isContractorMode
        );
        if (depUnsuitable) {
            return fail("airport_unsuitable", depUnsuitable);
        }
    }
    if (destOverride) {
        const destUnsuitable = formatPinnedAirportUnsuitableNotam(
            destOverride, spec, type, depOverride, routingMilitaryOnly, isContractorMode
        );
        if (destUnsuitable) {
            return fail("airport_unsuitable", destUnsuitable);
        }
        if (navigraphOnly) {
            const destAp = activeAirportDatabase.find(ap => ap.icao && ap.icao.trim().toUpperCase() === destOverride);
            if (destAp && !airportIsInNavigraph(destAp)) {
                return fail(
                    "airport_unsuitable",
                    formatDispatchNotam(`${destOverride} is not in the Navigraph database. Clear Navigraph destinations only or choose another arrival.`)
                );
            }
        }
    }
    
    const { departureAirports, destinationAirports } = buildDispatchRoutingPools(
        depOverride, routingScope, spec, type, routingMilitaryOnly, isContractorMode, navigraphOnly
    );
    const validAirports = depOverride
        ? departureAirports.concat(
            destinationAirports.filter(dst => !departureAirports.some(src => normalizeIcao(src.icao) === normalizeIcao(dst.icao)))
        )
        : destinationAirports;
    const departureAvailable = departureAirports.length > 0;

    const { minTarget, maxTarget, relaxedMin, relaxedMax, targetDist } = getRouteDistanceLimits(
        routingTargetMins, spec, type
    );
    const targetDistNm = targetDist;
    
    let candidatePairs = [];
    const routedAsGlider = isGliderAircraft(spec);
    if (routedAsGlider) {
        candidatePairs = buildGliderRoutePairs(validAirports, depOverride, spec);
    } else {
        const routeSources = depOverride ? departureAirports : destinationAirports;
        const routeResult = buildJetRoutePairs(
            routeSources, destinationAirports, depOverride, destOverride, spec,
            minTarget, maxTarget, relaxedMin, relaxedMax,
            routingTargetMins, type
        );
        candidatePairs = routeResult.candidatePairs;
    }
    if (spec.class === "JET" && !depOverride && candidatePairs.length) {
        const fullRunwayPairs = candidatePairs.filter((p) => {
            if (isJetWeightLimitedRunwayAirport(p.src, spec)) return false;
            if (specIsHeavyJet(spec) && isJetDepartureRunwayPerformanceLimited(p.src, spec)) return false;
            return true;
        });
        if (fullRunwayPairs.length) candidatePairs = fullRunwayPairs;
    }
    if (candidatePairs.length === 0) {
        return fail("no_routes",
            buildRouteFailureMessage(depOverride, type, spec, validAirports, departureAvailable, routingMilitaryOnly, isContractorMode, navigraphOnly),
            { candidatePairCount: 0, filteredMissionCount: 0 });
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
    
    const searchClass = spec.class || "GA";
    let selectedRoute;
    let preChosenMission = null;

    if (contractorMissionFirst) {
        const contractorPick = dispatchContractorMissionFirst(
            candidatePairs, spec, type, searchClass, isContractorMode,
            routingTargetMins, targetDistNm, preferOwned
        );
        if (!contractorPick) {
            return fail("contractor_routing",
                "No valid contractor routing found. Military missions require military airbases; civilian missions require civilian airports. Try adjusting flight time, routing region, or departure airport.",
                { candidatePairCount: candidatePairs.length });
        }
        preChosenMission = contractorPick.mission;
        selectedRoute = contractorPick.route;
    } else if (depOverride && destOverride && candidatePairs.length === 1) {
        selectedRoute = candidatePairs[0];
    } else {
        const weightedRoutePool = buildContractorRoutePool(candidatePairs, preferOwned);
        selectedRoute = pickRouteByTimeFit(weightedRoutePool, routingTargetMins, targetDistNm, spec, type);
    }
    if (!selectedRoute) {
        return fail("no_routes",
            buildRouteFailureMessage(depOverride, type, spec, validAirports, departureAvailable, routingMilitaryOnly, isContractorMode, navigraphOnly),
            { candidatePairCount: candidatePairs.length, filteredMissionCount: 0 });
    }

    const origin = selectedRoute.src;
    const destination = selectedRoute.dst;
    const distanceNm = Math.round(selectedRoute.dist);
    const bearing = calculateBearing(origin.lat, origin.lon, destination.lat, destination.lon);
    const isEasterly = (bearing >= 0 && bearing < 180);
    const isLocalFlight = (origin.icao === destination.icao);

    // --- PHASE 1: FILTER MISSIONS ---
    let filteredMissions = preChosenMission
        ? [preChosenMission]
        : buildFilteredMissionList(spec, type, searchClass, origin, isContractorMode, isLocalFlight);

    if (filteredMissions.length === 0) {
        const assigned = typeof getAssignedImgIdSetForAircraft === "function"
            ? getAssignedImgIdSetForAircraft(type) : null;
        const message = (!assigned || assigned.size === 0)
            ? getMissionAssignmentsUnavailableMessage(type)
            : "No valid missions found for this routing.";
        return fail("no_missions", message, {
            candidatePairCount: candidatePairs.length,
            origin: origin.icao,
            destination: destination.icao,
            distanceNm
        });
    }

    let chosenMission = preChosenMission;
    let hatPick = null;
    if (!chosenMission) {
        const hat = buildMissionScenarioHat(
            filteredMissions, type, spec, searchClass, isLocalFlight
        );
        if (!hat.length) {
            return fail("no_scenario",
                "No mission briefing images are available for this aircraft with the current settings.",
                { candidatePairCount: candidatePairs.length, filteredMissionCount: filteredMissions.length });
        }
        hatPick = pickFromMissionScenarioHat(hat);
        if (!hatPick) {
            return fail("no_scenario",
                "No mission briefing could be selected for this aircraft.",
                { candidatePairCount: candidatePairs.length, filteredMissionCount: filteredMissions.length });
        }
        chosenMission = hatPick.mission;
    } else {
        // Mission already chosen (e.g. contractor) — still pick briefing before payload so passenger jobs get seats.
        const hat = buildMissionScenarioHat(
            [chosenMission], type, spec, searchClass, isLocalFlight
        );
        if (!hat.length) {
            return fail("no_scenario",
                "No mission briefing images are available for this aircraft on the selected mission type. Try another airframe or mission settings.",
                { candidatePairCount: candidatePairs.length, filteredMissionCount: filteredMissions.length });
        }
        hatPick = pickFromMissionScenarioHat(hat);
        if (!hatPick) {
            return fail("no_scenario",
                "No mission briefing could be selected for this aircraft.",
                { candidatePairCount: candidatePairs.length, filteredMissionCount: filteredMissions.length });
        }
    }

    // --- PHASE 3: APPLY MISSION OVERRIDES ---
    if (chosenMission.minAlt) spec.minAlt = Math.max(spec.minAlt, chosenMission.minAlt);

    // --- PHASE 4: CLEAN HEMISPHERIC ALTITUDE ---
    let depElev = origin.elev || 0;
    let arrElev = destination.elev || 0;
    let terrainSafetyFloor = Math.max(depElev, arrElev) + 3000;
    let midLat = (origin.lat + destination.lat) / 2;
    let midLon = (origin.lon + destination.lon) / 2;
    // heliSafeFloor: real-world helicopter mountain-crossing transit tops out around
    // 8,000-12,000ft MSL regardless of range (engine/rotor performance in thin air), unlike
    // fixed-wing safeFloor which scales with the actual terrain height.
    const globalRanges = [
        { name: "Alps", latMin: 45.0, latMax: 48.0, lonMin: 5.0, lonMax: 15.0, safeFloor: 11500, heliSafeFloor: 10000 },
        { name: "Pyrenees", latMin: 42.0, latMax: 43.3, lonMin: -2.0, lonMax: 3.3, safeFloor: 9500, heliSafeFloor: 8500 },
        { name: "North American Rockies", latMin: 35.0, latMax: 60.0, lonMin: -125.0, lonMax: -105.0, safeFloor: 14500, heliSafeFloor: 12000 },
        { name: "South American Andes", latMin: -55.0, latMax: 10.0, lonMin: -76.0, lonMax: -65.0, safeFloor: 15500, heliSafeFloor: 12000 },
        { name: "Himalayas / Tibetan Plateau", latMin: 26.0, latMax: 38.0, lonMin: 70.0, lonMax: 105.0, safeFloor: 21500, heliSafeFloor: 12000 },
        { name: "Japanese Alps / Central Ranges", latMin: 34.5, latMax: 37.5, lonMin: 136.0, lonMax: 139.5, safeFloor: 10500, heliSafeFloor: 9000 }
    ];
    let heliMountainTransitFloor = 0;
    for (let range of globalRanges) {
        let dMatch = (origin.lat >= range.latMin && origin.lat <= range.latMax && origin.lon >= range.lonMin && origin.lon <= range.lonMax);
        let aMatch = (destination.lat >= range.latMin && destination.lat <= range.latMax && destination.lon >= range.lonMin && destination.lon <= range.lonMax);
        let mMatch = (midLat >= range.latMin && midLat <= range.latMax && midLon >= range.lonMin && midLon <= range.lonMax);
        if (dMatch || aMatch || mMatch) {
            if (spec.class !== "HELI") terrainSafetyFloor = Math.max(terrainSafetyFloor, range.safeFloor);
            else heliMountainTransitFloor = range.heliSafeFloor;
            break;
        }
    }

    // Real-world sea-level rate of climb per class (POH/manufacturer figures). Decay
    // toward each aircraft's actual service ceiling (spec.maxAlt) is handled by
    // solveMaxAltitudeForTimeBudget below, not baked into these numbers.
    let climbRateFpm = 1500; // GA / HELI
    let descentRateFpm = 500;
    if (spec.class === "WARBIRD") {
        climbRateFpm = 2100; descentRateFpm = 1000;
    }
    if (spec.class === "TURBO") {
        climbRateFpm = 1900; descentRateFpm = 1000;
        if (spec.tags && spec.tags.includes("MILITARY_TRANSPORT")) climbRateFpm = 2100;
    }
    if (type && VINTAGE_PROPLINER_TYPES.has(type)) {
        climbRateFpm = 1000; descentRateFpm = 1000;
    }
    if (spec.class === "BIZ JET") {
        climbRateFpm = 3800; descentRateFpm = 2000;
    }
    if (spec.class === "JET") {
        climbRateFpm = 2750; descentRateFpm = 1500;
    }
    const timeAltCap = solveMaxAltitudeForTimeBudget(targetMins, climbRateFpm, descentRateFpm, spec.maxAlt, depElev, arrElev);

    // Every aircraft's cruise altitude — HELI included — is always a whole thousand (IFR)
    // or whole thousand + 500ft (VFR), matching hemispheric direction. That convention is
    // never broken; HELI only gets tighter min/max bounds (realistic AGL band instead of
    // the generic fixed-wing +3000ft floor), fed through the exact same rounding pipeline.
    const isHeli = spec.class === "HELI";
    let heliBandMinAlt = 0, heliBandMaxAlt = 0;
    if (isHeli) {
        // Standard cruise is 1,000-5,000ft AGL; hover/tactical work (LZ insertions, hoists,
        // line/photo work — flagged per-mission via hatPick.scenario.lowLevelOps) is flown
        // much lower, 100-500ft AGL. Mountain-crossing terrain gets an occasional
        // 8,000-12,000ft MSL transit exception instead. The aircraft's own maxAlt (real
        // service ceiling) is always the hard cap.
        const heliGroundRef = Math.max(depElev, arrElev);
        const isLowLevelHeliMission = !!(hatPick && hatPick.scenario && hatPick.scenario.lowLevelOps);
        const heliBandMin = isLowLevelHeliMission ? 100 : 1000;
        const heliBandMax = isLowLevelHeliMission ? 500 : 5000;
        heliBandMaxAlt = Math.min(spec.maxAlt, Math.max(heliGroundRef + heliBandMax, heliMountainTransitFloor));
        heliBandMinAlt = Math.min(heliGroundRef + heliBandMin, heliBandMaxAlt);
    }

    const finalMinAlt = isHeli ? heliBandMinAlt : Math.max(spec.minAlt, terrainSafetyFloor);
    const distanceAltCap = Math.max(timeAltCap, finalMinAlt);
    const effectiveMaxAlt = isHeli ? heliBandMaxAlt : Math.max(Math.min(spec.maxAlt, distanceAltCap), terrainSafetyFloor);
    // VFR is only legal below Class A airspace (18,000ft MSL in the US) — the highest legal
    // VFR cruising altitudes are 17,500ft eastbound and 16,500ft westbound (odd/even thousand
    // + 500), never the aircraft's own ceiling. Capping the pre-rounding thousand at 17/16
    // guarantees the post-parity value (+500) can never land on or above 18,000ft.
    let safeMaxAlt = effectiveMaxAlt;
    if (flightRulesMode === "VFR") {
        const vfrCeilingThousands = isEasterly ? 17 : 16;
        safeMaxAlt = Math.min(safeMaxAlt, vfrCeilingThousands * 1000);
    }
    const dynamicMinAlt = Math.min(
        safeMaxAlt,
        effectiveMaxAlt < finalMinAlt
            ? Math.max(isHeli ? heliBandMinAlt : terrainSafetyFloor, safeMaxAlt - 4000)
            : finalMinAlt
    );

    // "Prefer lower cruise altitude" hard-restricts sampling to the bottom third of the
    // valid range (not just a probabilistic nudge) — with only 3 tickets shown at once, a
    // soft bias could still occasionally hand back a high pick and look like it did nothing.
    const cruiseSampleMaxAlt = preferLowerCruise
        ? dynamicMinAlt + (safeMaxAlt - dynamicMinAlt) / 3
        : safeMaxAlt;

    // Hemispheric Rules: IFR uses whole thousands, odd/even by direction. VFR adds the
    // standard +500ft on top of the same odd/even convention (FAA 91.159 / SERA). Round the
    // floor UP to the nearest thousand of the correct parity (never down) so the safety
    // floor (terrain/HAT-derived, rarely itself a round thousand) can never be undershot —
    // picking a random continuous value and then flooring it, as before, could land below
    // dynamicMinAlt whenever that floor wasn't already a round thousand.
    let minThousands = Math.max(1, Math.ceil(dynamicMinAlt / 1000));
    if (isEasterly && minThousands % 2 === 0) minThousands += 1;
    if (!isEasterly && minThousands % 2 !== 0) minThousands += 1;
    let maxThousands = Math.floor(cruiseSampleMaxAlt / 1000);
    if (isEasterly && maxThousands % 2 === 0) maxThousands -= 1;
    if (!isEasterly && maxThousands % 2 !== 0) maxThousands -= 1;
    if (maxThousands < minThousands) maxThousands = minThousands;
    const thousandSteps = (maxThousands - minThousands) / 2;
    const baseThousands = minThousands + 2 * Math.floor(Math.random() * (thousandSteps + 1));
    const altFeetBase = baseThousands * 1000;
    let altFeet = altFeetBase;
    if (flightRulesMode === "VFR") altFeet += 500;

    // --- PHASE 5: CALCULATE PAYLOAD ---
    const chosenScenario = hatPick && hatPick.scenario ? hatPick.scenario : null;
    const operationalMtowCap = getRestrictedRouteOperationalMtowCap(origin, destination, type, spec);
    let safeMtow = spec.mtow || (spec.class === "JET" ? 75000 : 3500);
    let mtowReducedForRestrictedAirport = false;
    if (operationalMtowCap !== null && safeMtow > operationalMtowCap) {
        safeMtow = operationalMtowCap;
        mtowReducedForRestrictedAirport = true;
    }
    if (spec.class === "JET" && origin) {
        safeMtow = Math.min(safeMtow, getDepartureRunwayOperationalMtow(origin, spec));
    }
    const safeOew = spec.oew || (spec.class === "JET" ? 42000 : 2000);
    const safeFuelPerNm = spec.fuelPerNm || (spec.class === "JET" ? 6 : 0.5);
    const weightLimitedRunway = spec.class === "JET" && isRouteWeightLimitedByRunway(origin, destination, spec);
    const weightLimitedRunwayIcaos = weightLimitedRunway ? getWeightLimitedRunwayIcaos(origin, destination, spec) : [];
    let fuelDistanceNm = distanceNm;
    if (spec.class === "JET") {
        fuelDistanceNm = getJetFuelPlanningDistanceNm(distanceNm, spec);
    }
    const jetPlanFuelKg = spec.class === "JET" ? getJetSimBriefPlanningBlockFuelKg(fuelDistanceNm, spec) : 0;
    const jetMaxTankKg = spec.class === "JET" ? getJetMaxFuelKg(spec) : 0;
    const jetTankCritical = jetMaxTankKg > 0 && jetPlanFuelKg >= jetMaxTankKg * JET_SIMBRIEF_TANK_FILL_THRESHOLD;
    if (origin.icao === "LOWI" && isLowiNarrowbodyJetliner(type, spec)) {
        fuelDistanceNm = Math.min(distanceNm, 900);
    }
    const blockMinutes = Math.max(10, targetMins);
    let pax = 0;
    let cargoKg = 0;
    let hardCargoLimit = 0;
    if (weightLimitedRunway || jetTankCritical) {
        const weightLimitedAlloc = allocateWeightLimitedJetPayload(
            spec, type, chosenMission, blockMinutes, safeMtow, fuelDistanceNm, chosenScenario
        );
        if (!weightLimitedAlloc.ok) {
            return fail("runway_performance",
                "Runway length and sector distance do not allow a feasible takeoff weight for this aircraft. Try a shorter sector, a different airport, or another airframe.",
                { candidatePairCount: candidatePairs.length, filteredMissionCount: filteredMissions.length });
        }
        pax = weightLimitedAlloc.pax;
        cargoKg = weightLimitedAlloc.cargoKg;
        hardCargoLimit = weightLimitedAlloc.hardCargoLimit;
    } else {
        let effectiveRunway = origin.length || 99999;
        let runwayWeightPenalty = 0;
        const maxVariablePayload = safeMtow - safeOew;
        if (effectiveRunway < spec.minRunwayLength && spec.minRunwayLength > 0) {
            const runwayRatio = Math.max(0, effectiveRunway / spec.minRunwayLength);
            const shortFieldPenalty = maxVariablePayload * (0.55 + (1 - runwayRatio) * 0.35);
            runwayWeightPenalty = shortFieldPenalty;
        }
        let minReservedPaxWeight = 0;
        if (missionRequiresPassengers(chosenMission, spec, chosenScenario) && spec.maxPax > 0) {
            let reservePax = 1;
            if (!isJetFuelCriticalSector(fuelDistanceNm)) {
                const { minPax } = getPassengerLoadLimits(chosenMission, spec, spec.maxPax, blockMinutes, chosenScenario);
                reservePax = Math.max(1, minPax);
            }
            minReservedPaxWeight = getSimBriefPassengerPayloadKg(spec, reservePax);
        }
        const rawBlockFuel = spec.class === "JET"
            ? getJetSimBriefPlanningBlockFuelKg(fuelDistanceNm, spec)
            : fuelDistanceNm * safeFuelPerNm;
        const availableForFuel = Math.max(0, safeMtow - safeOew - runwayWeightPenalty - minReservedPaxWeight);
        const estimatedBlockFuel = Math.min(rawBlockFuel, availableForFuel);

        const maxStructuralPayload = Math.max(0, safeMtow - safeOew - estimatedBlockFuel - runwayWeightPenalty);
        const paxAllInKg = getPaxAllInWeightKg(spec);
        if (missionRequiresPassengers(chosenMission, spec, chosenScenario) && spec.maxPax > 0) {
            let maxSafePax = Math.max(0, Math.min(spec.maxPax, Math.floor(maxStructuralPayload / paxAllInKg)));
            if (spec.class === "JET") {
                const mtowPaxCap = getJetMaxPaxAtMtow(
                    safeMtow, safeOew, getJetSimBriefPlanningBlockFuelKg(fuelDistanceNm, spec), 0, spec
                );
                maxSafePax = Math.min(maxSafePax, mtowPaxCap);
            }
            if (maxSafePax > 0) {
                const { minPax, effectiveMax } = getPassengerLoadLimits(chosenMission, spec, maxSafePax, blockMinutes, chosenScenario);
                if (effectiveMax > 0) {
                    pax = Math.floor(Math.random() * (effectiveMax - minPax + 1)) + minPax;
                }
            }
            if (pax === 0) {
                return fail("runway_performance",
                    "Runway length and sector distance do not allow a feasible takeoff weight for this aircraft. Try a shorter sector, a different airport, or another airframe.",
                    { candidatePairCount: candidatePairs.length, filteredMissionCount: filteredMissions.length });
            }
        }
        const paxWeight = getSimBriefPassengerPayloadKg(spec, pax);
        const paxRatio = spec.maxPax > 0 ? (pax / spec.maxPax) : 0;
        const proportionalCargoLimit = spec.maxCargo * (1 - paxRatio);
        const remainingPayload = Math.max(0, maxStructuralPayload - paxWeight);
        hardCargoLimit = Math.floor(Math.min(proportionalCargoLimit, remainingPayload));
        const bizJetPassengerOnly = spec.class === "BIZ JET" && type !== "LJ35" && !isFreightMission(chosenMission);
        if (!bizJetPassengerOnly && hardCargoLimit > 0) {
            const cargoFloorKg = getCargoAssignmentFloorKg(chosenScenario, hardCargoLimit);
            if (hardCargoLimit >= cargoFloorKg) {
                const cargoSpan = hardCargoLimit - cargoFloorKg + 1;
                cargoKg = Math.floor(Math.random() * cargoSpan) + cargoFloorKg;
            } else {
                cargoKg = hardCargoLimit;
            }
        }
    }
    if (missionRequiresPassengers(chosenMission, spec, chosenScenario) && (spec.maxPax || 0) > 0) {
        if (MTOW_ENFORCED_CLASSES.includes(spec.class)) {
            pax = capJetPaxForMtow(pax, cargoKg, safeMtow, safeOew, fuelDistanceNm, spec);
        }
        if (pax === 0) {
            return fail("runway_performance",
                "Runway length and sector distance do not allow a feasible takeoff weight for this aircraft. Try a shorter sector, a different airport, or another airframe.",
                { candidatePairCount: candidatePairs.length, filteredMissionCount: filteredMissions.length });
        }
    }
    const mtowReducedForAirport = mtowReducedForRestrictedAirport;
    let payoutAmount = Math.floor(Math.random() * 6200) + 1950;

    // --- PHASE 6: SCENARIO SELECTION ---
    let rPayload = "standard manifest";
    let rInstruction = "Execute standard procedures.";
    let scenarioImgId = null;
    let scenarioPicks = null;
    let scenario = chosenScenario;
    let imageId = chosenMission.type <= 13 ? chosenMission.type : null;

    if (chosenMission.pool && typeof scenarioDB !== 'undefined' && scenarioDB[chosenMission.pool]) {
        if (!scenario) {
            const hat = buildMissionScenarioHat(
                [chosenMission], type, spec, searchClass, isLocalFlight
            );
            if (!hat.length) {
                return fail("no_scenario",
                    "No mission briefing images are available for this aircraft on the selected mission type. Try another airframe or mission settings.",
                    { candidatePairCount: candidatePairs.length, filteredMissionCount: filteredMissions.length });
            }
            hatPick = pickFromMissionScenarioHat(hat);
            scenario = hatPick ? hatPick.scenario : null;
        }
        if (!scenario) {
            return fail("no_scenario",
                "No mission briefing could be selected for this aircraft.",
                { candidatePairCount: candidatePairs.length, filteredMissionCount: filteredMissions.length });
        }
        if (chosenMission.type <= 13 && scenario.imgId !== chosenMission.type) {
            return fail("no_scenario",
                "No briefing image matches this exclusive mission type for the selected aircraft.",
                { candidatePairCount: candidatePairs.length, filteredMissionCount: filteredMissions.length });
        }
        if (typeof usesMissionAssignments === "function" && usesMissionAssignments()
            && isScenarioAllowedForAircraft(type, scenario.imgId) !== true) {
            return fail("no_scenario",
                "Selected scenario is not in mission-assignments.json for this aircraft. Regenerate mission-assignments-data.js and hard-refresh (Ctrl+F5).",
                { candidatePairCount: candidatePairs.length, filteredMissionCount: filteredMissions.length });
        }
        rPayload = scenario.payload;
        rInstruction = scenario.instruction;
        scenarioImgId = scenario.imgId;
        imageId = scenario.imgId;
        scenarioPicks = pickScenarioPlaceholderValues(origin, destination);
        rPayload = resolveScenarioText(rPayload, scenarioPicks);
        rInstruction = resolveScenarioText(rInstruction, scenarioPicks);
    } else if (chosenMission.type > 13) {
        return fail("no_scenario",
            "No mission briefing is configured for this mission template.",
            { candidatePairCount: candidatePairs.length, filteredMissionCount: filteredMissions.length });
    }

    if (!imageId) {
        imageId = chosenMission.type;
    }

    payoutAmount = applyScenarioPayoutBonus(
        payoutAmount,
        scenarioImgId != null ? scenarioImgId : imageId
    );
    const payout = formatDispatchPayout(payoutAmount);

    cargoKg = finalizeAssignedPayloadKg(cargoKg, hardCargoLimit);

    if (MTOW_ENFORCED_CLASSES.includes(spec.class)) {
        const towCapped = enforceJetTowPayloadCap(
            spec, pax, cargoKg, fuelDistanceNm, safeMtow, chosenMission, blockMinutes, chosenScenario
        );
        if (!towCapped) {
            return fail("runway_performance",
                "Runway length and sector distance do not allow a feasible takeoff weight for this aircraft. Try a shorter sector, a different airport, or another airframe.",
                { candidatePairCount: candidatePairs.length, filteredMissionCount: filteredMissions.length });
        }
        pax = towCapped.pax;
        cargoKg = towCapped.cargoKg;
    }

    if (spec.mzfw > 0) {
        const zfwCapped = enforceMzfwCap(spec, pax, cargoKg, chosenMission, chosenScenario);
        if (!zfwCapped) {
            return fail("runway_performance",
                "Payload exceeds this aircraft's maximum zero fuel weight. Try a lighter load or another airframe.",
                { candidatePairCount: candidatePairs.length, filteredMissionCount: filteredMissions.length });
        }
        pax = zfwCapped.pax;
        cargoKg = zfwCapped.cargoKg;
    }

    if (spec.mlw > 0) {
        const mlwCapped = enforceMlwCap(spec, pax, cargoKg, fuelDistanceNm, chosenMission, chosenScenario);
        if (!mlwCapped) {
            return fail("runway_performance",
                "Payload and fuel combination exceeds this aircraft's maximum landing weight. Try a lighter load or another airframe.",
                { candidatePairCount: candidatePairs.length, filteredMissionCount: filteredMissions.length });
        }
        pax = mlwCapped.pax;
        cargoKg = mlwCapped.cargoKg;
    }

    if (mtowReducedForRestrictedAirport) {
        pushDispatchNotam(warnings,
            "MTOW has been reduced for this airport due to operational restrictions. Verify fuel load and takeoff performance in SimBrief before departure."
        );
    }
    // Runway-length payload caps are applied silently — no NOTAM (avoids confusing routine heavy-jet ops).

    if (MTOW_ENFORCED_CLASSES.includes(spec.class)) {
        const physicsViolations = validateJetDispatchPhysics(
            type, spec, origin, destination, distanceNm, fuelDistanceNm, pax, cargoKg, safeMtow
        );
        if (physicsViolations.length) {
            return fail("physics_validation",
                "Dispatch plan failed weight and fuel checks: " + physicsViolations.join("; ") + ".",
                {
                    violations: physicsViolations,
                    origin: origin.icao,
                    destination: destination.icao,
                    distanceNm,
                    pax,
                    cargoKg,
                    candidatePairCount: candidatePairs.length
                });
        }
    }

    return {
        ok: true,
        warnings,
        type,
        aircraftType: type,
        spec,
        chosenMission,
        origin,
        destination,
        selectedRoute,
        distanceNm,
        targetMins,
        callsignRaw,
        isLocalFlight,
        isEasterly,
        altFeet,
        altFeetBase,
        pax,
        cargoKg,
        payout,
        rPayload,
        rInstruction,
        scenarioPicks,
        scenarioImgId,
        scenario,
        imageId,
        mtowReducedForAirport,
        blockMinutes,
        hardCargoLimit,
        candidatePairCount: candidatePairs.length,
        filteredMissionCount: filteredMissions.length,
        routingMilitaryOnly,
        isContractorMode
    };
}
function resetDispatchProbeHistory() {
    lastMissions = [];
    lastScenarioImgIds = [];
}
if (typeof globalThis !== "undefined") {
    globalThis.probeDispatchFlight = probeDispatchFlight;
    globalThis.resetDispatchProbeHistory = resetDispatchProbeHistory;
    globalThis.validateJetDispatchPhysics = validateJetDispatchPhysics;
}

function formatDispatchNotam(text) {
    const body = String(text || "").trim();
    return body ? "NOTAM: " + body : "NOTAM:";
}
function pushDispatchNotam(warnings, text) {
    warnings.push(formatDispatchNotam(text));
}
function showDispatchNotams(warnings) {
    if (!warnings || !warnings.length) return Promise.resolve();
    const body = warnings.map((w) => String(w).replace(/^NOTAM:\s*/i, "")).join("\n\n");
    return openVectorDialog({ kind: "notam", message: body, confirmLabel: "Accept" });
}

// START OF DISPATCH FLIGHT FUNCTION
function dispatchFlight() {
    boardTabGo("contracts");
    const cfg = getDispatchUiProbeConfig();
    if (!cfg.aircraftType) {
        vectorAlert("Please select an aircraft type before generating contracts.");
        return;
    }
    revokeBoardPlnUrls();
    boardContractResults = [];
    boardSelectedIndex = -1;
    const results = [];
    const allWarnings = [];
    let lastError = "";
    const animateDeal = !boardTicketsDealt;
    // Up to 24 probe attempts to collect up to 3 contracts with distinct briefings
    for (let attempt = 0; attempt < 24 && results.length < 3; attempt++) {
        const result = probeDispatchFlight(cfg);
        if (!result.ok) {
            lastError = result.message || "Dispatch failed.";
            continue;
        }
        const sig = getContractResultSignature(result);
        if (results.some((r) => getContractResultSignature(r) === sig)) continue;
        if (isDuplicateBoardScenario(results, result)) continue;
        if (result.warnings && result.warnings.length) {
            result.warnings.forEach((w) => {
                if (allWarnings.indexOf(w) === -1) allWarnings.push(w);
            });
        }
        results.push(result);
    }
    if (results.length === 0) {
        vectorAlert(lastError || "Could not generate contracts with the current settings. Try adjusting aircraft, flight time, or departure.");
        return;
    }
    const boardResults = finalizeBoardContractResults(results);
    boardResults.forEach((r) => {
        if (r && !r._duplicateUnavailable && !r._exportBundle) {
            r._exportBundle = buildDispatchExportBundle(r);
        }
    });
    if (allWarnings.length) showDispatchNotams(allWarnings.slice(0, 3));
    boardContractResults = boardResults;
    boardTicketsDealt = true;
    renderContractsBoard(boardResults, { animateDeal, inactive: false });
    persistBoardSession(boardResults, false);
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
        payout: flight.payout,
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
        durationMins: last.durationMins,
        payout: last.payout
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

const LOGBOOK_BACKUP_BATCH = 4;
const LOGBOOK_FLIGHTS_SINCE_EXPORT_KEY = "dispatcher_logbook_flights_since_export";
const LOGBOOK_BACKUP_DISMISSED_AT_KEY = "dispatcher_logbook_backup_dismissed_at";

function getLogbookFlightsSinceExport() {
    return parseInt(localStorage.getItem(LOGBOOK_FLIGHTS_SINCE_EXPORT_KEY) || "0", 10);
}

function getLogbookBackupDismissedAt() {
    return parseInt(localStorage.getItem(LOGBOOK_BACKUP_DISMISSED_AT_KEY) || "0", 10);
}

function resetLogbookBackupNudgeState() {
    localStorage.removeItem(LOGBOOK_FLIGHTS_SINCE_EXPORT_KEY);
    localStorage.removeItem(LOGBOOK_BACKUP_DISMISSED_AT_KEY);
}

function dismissLogbookBackupReminder() {
    localStorage.setItem(LOGBOOK_BACKUP_DISMISSED_AT_KEY, String(getLogbookFlightsSinceExport()));
}

async function maybeShowLogbookBackupBanner() {
    const sinceExport = getLogbookFlightsSinceExport();
    const dismissedAt = getLogbookBackupDismissedAt();
    if (sinceExport - dismissedAt < LOGBOOK_BACKUP_BATCH) return;
    const shouldExport = await vectorConfirm("Do you want to back up your logbook now?", {
        confirmLabel: "Export Now",
        cancelLabel: "Dismiss",
        confirmFirst: true
    });
    if (shouldExport) {
        exportDatabaseBackup();
    } else {
        dismissLogbookBackupReminder();
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

function parsePayoutValue(payout) {
    if (payout == null || payout === "") return 0;
    const digits = String(payout).replace(/[^\d]/g, "");
    return parseInt(digits, 10) || 0;
}

function formatLogbookSavingsTotal(total) {
    return "$" + total.toLocaleString("en-GB");
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
        duration: flight.durationMins,
        payoutValue: parsePayoutValue(flight.payout)
    });
    localStorage.setItem("dispatcher_logbook", JSON.stringify(logbook));
    localStorage.setItem(LOGBOOK_FLIGHTS_SINCE_EXPORT_KEY, String(getLogbookFlightsSinceExport() + 1));
    syncLastArrivalFromLogbook();
    return logbook;
}

function addLastFlightToLogbook() {
    const last = getLastDispatch();
    if (!last) {
        vectorAlert("No recent dispatch found. Generate a flight first.");
        return;
    }
    if (last.logged) {
        vectorAlert("That dispatch is already saved in your logbook.");
        return;
    }
    const flight = {
        orig: last.orig,
        dest: last.dest,
        aircraft: last.aircraft,
        mission: last.mission,
        durationMins: last.durationMins,
        payout: last.payout
    };
    appendFlightToLogbook(flight);
    markLastDispatchLogged();
    currentPendingFlight = null;
    const logBtn = document.getElementById("logFlightBtn");
    if (logBtn) logBtn.style.display = "none";
    vectorAlert("Flight saved to logbook.");
    currentLogbookPage = 1;
    updateLogbookUI();
    runMaintenanceCheckAfterLog();
}

async function runMaintenanceCheckAfterLog() {
    updateDatabaseStats();
    maybeShowLogbookBackupBanner();
}
function toggleLastArrival() {
    const toggle = document.getElementById("useLastArrivalToggle");
    const depInput = document.getElementById("depOverrideInput");
    if (toggle.checked) {
        const lastArr = getLastLogbookArrival();
        if (lastArr) {
            depInput.value = lastArr;
        } else {
            vectorAlert("No previous arrival logged yet! Save a completed flight to your logbook first.");
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
    clearContractLogbookPrompts();
    const logFlightBtn = document.getElementById("logFlightBtn");
    if (logFlightBtn) logFlightBtn.style.display = "none";
    vectorAlert("Flight saved to logbook.");
    currentPendingFlight = null;
    currentLogbookPage = 1;
    updateLogbookUI();
    runMaintenanceCheckAfterLog();
}
let currentLogbookPage = 1;
const logbookRowsPerPage = 10;
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
    const totalSavings = logbook.reduce((sum, flight) => sum + (flight.payoutValue || 0), 0);
    const savingsEl = document.getElementById("lbTotalSavings");
    if (savingsEl) savingsEl.innerText = formatLogbookSavingsTotal(totalSavings);
    maybeShowLogbookBackupBanner();
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
async function removeLogbookEntry(index) {
    const logbook = JSON.parse(localStorage.getItem("dispatcher_logbook")) || [];
    if (index < 0 || index >= logbook.length) return;
    const entry = logbook[index];
    const aircraftLabel = entry.aircraft.split(" - ")[1] || entry.aircraft;
    const msg = "Remove this logbook entry?\n\n"
        + entry.date + "  " + entry.orig + " -> " + entry.dest + "\n"
        + aircraftLabel + "\n"
        + entry.mission + "\n\n"
        + "This cannot be undone.";
    if (!(await vectorConfirm(msg))) return;
    logbook.splice(index, 1);
    localStorage.setItem("dispatcher_logbook", JSON.stringify(logbook));
    syncLastArrivalFromLogbook();
    refreshLastArrivalDepField();
    updateLogbookUI();
    updateDatabaseStats();
}
async function clearLogbook() {
    const logbook = JSON.parse(localStorage.getItem("dispatcher_logbook")) || [];
    if (!logbook.length) return;
    const backupFirst = await vectorConfirm("This will permanently delete your entire flight history. Would you like to back it up first, or clear it without backing up?", {
        confirmLabel: "Back Up & Clear",
        cancelLabel: "Clear Without Backup",
        confirmFirst: true
    });
    if (backupFirst === null) return; // dismissed (X, Escape, backdrop) - abort, no second prompt
    if (backupFirst) {
        exportDatabaseBackup();
    } else if (!(await vectorConfirm("Are you sure you want to permanently delete your entire flight history without a backup? This cannot be undone.", {
        confirmLabel: "Delete Without Backup",
        cancelLabel: "Cancel"
    }))) {
        return;
    }
    localStorage.removeItem("dispatcher_logbook");
    localStorage.removeItem("dispatcher_last_arrival");
    resetLogbookBackupNudgeState();
    document.getElementById("useLastArrivalToggle").checked = false;
    document.getElementById("depOverrideInput").value = "";
    currentLogbookPage = 1;
    updateLogbookUI();
    updateDatabaseStats();
}
function initBoardPreviewTickets() {
    const session = loadBoardSession();
    if (session && session.results && session.results.length) {
        // Always start faded/inactive; Generate Flight clears them.
        boardContractResults = session.results;
        boardTicketsDealt = false;
        renderContractsBoard(session.results, { inactive: true });
        return;
    }

    // No saved session: generate up to 3 random preview contracts (inactive).
    const cfg = getDispatchUiProbeConfig();
    if (!cfg.aircraftType) {
        // Fall back to first fleet aircraft so the board is never empty on load.
        const fleetKeys = Object.keys(activeFleetSpecs || {});
        if (fleetKeys.length) cfg.aircraftType = fleetKeys[0];
        else return;
    }
    cfg.mutateHistory = false;
    const results = [];
    for (let attempt = 0; attempt < 24 && results.length < 3; attempt++) {
        const result = probeDispatchFlight(cfg);
        if (!result.ok) continue;
        const sig = getContractResultSignature(result);
        if (results.some((r) => getContractResultSignature(r) === sig)) continue;
        if (isDuplicateBoardScenario(results, result)) continue;
        result._exportBundle = buildDispatchExportBundle(result);
        results.push(result);
    }
    if (!results.length) return;
    const boardResults = finalizeBoardContractResults(results);
    boardContractResults = boardResults;
    boardTicketsDealt = false;
    renderContractsBoard(boardResults, { inactive: true });
    persistBoardSession(boardResults, true);
}

window.onload = function() {
    loadSettings();
    updateCustomAircraftForm();
    rebuildActiveDatabase();
    rebuildFleetDropdown();
    rebuildAirportDropdown(); // Initializes the new airport search
    updateDatabaseStats();
    updateLogbookUI();
    boardTabGo("contracts");
    initTicketPhotoFxToggle();
    updateManageCustomDbUI();
    bindManageCustomDbActions();
    updateAppVersionLabel();
    checkForAppUpdate();
    restoreLastPendingFlight();
    updateAddLastFlightLink();
    syncLastArrivalFromLogbook();
    refreshLastArrivalDepField();
    updateFlightTimeSliderState();
    initBoardPreviewTickets();
    const callsignInput = document.getElementById("callsignInput");
    if (callsignInput) {
        callsignInput.addEventListener("input", refreshBoardFlightLabels);
    }
    refreshBoardFlightLabels();
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

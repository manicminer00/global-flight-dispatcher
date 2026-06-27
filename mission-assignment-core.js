/**
 * Mission assignment core — shared by dispatch-engine and mission-editor.
 * Eligibility is driven by mission-assignments.json when loaded.
 */
var missionAssignmentData = null;

var MISSION_ASSIGNMENT_SCHEMA = "mission-assignments-v1";

var MISSION_POOL_ORDER = [
    "uniqueMissions",
    "commercial",
    "commercial-regional",
    "longHaulOps",
    "executive",
    "longHaulExecutive",
    "lightPax",
    "lightFreight",
    "regionalFreight",
    "heavyFreight",
    "longHaulFreight",
    "vintageOps",
    "vintageAirliner",
    "vintageProplinerFreight",
    "medical",
    "surveyServices",
    "highAltServices",
    "helicopterOps-CIV",
    "gliderOps",
    "heavyFreight-MIL",
    "longHaulFreight-MIL",
    "militaryTransit-MIL",
    "helicopterOps-MIL",
    "tacticalJet-MIL",
    "reconnaissance-MIL"
];

var MISSION_POOL_LABELS = {
    uniqueMissions: "Unique / one-off missions",
    commercial: "Scheduled commercial (mainline)",
    "commercial-regional": "Regional commuter (pax)",
    longHaulOps: "Intercontinental scheduled (pax)",
    executive: "Executive VIP charter",
    longHaulExecutive: "Intercontinental executive",
    lightPax: "Light passenger / air taxi",
    lightFreight: "Light freight",
    regionalFreight: "Regional freight",
    heavyFreight: "Heavy cargo (civil)",
    longHaulFreight: "Intercontinental heavy freight",
    vintageOps: "Vintage & heritage",
    vintageAirliner: "Classic airliner charter",
    vintageProplinerFreight: "Vintage propliner freight",
    medical: "Medevac / lifeguard",
    surveyServices: "Aerial survey",
    highAltServices: "High-altitude research",
    "helicopterOps-CIV": "Civil helicopter ops",
    gliderOps: "Gliding",
    "heavyFreight-MIL": "Military cargo",
    "longHaulFreight-MIL": "Intercontinental military cargo",
    "militaryTransit-MIL": "Military logistics transit",
    "helicopterOps-MIL": "Military helicopter ops",
    "tacticalJet-MIL": "Tactical sortie",
    "reconnaissance-MIL": "Strategic reconnaissance"
};

/**
 * Bulk-apply presets derived from current fleet tag/class patterns.
 * pools: scenario pool keys to enable for matching aircraft.
 * aircraft: optional explicit type list (used when match is too narrow).
 */
var AIRCRAFT_MISSION_PRESETS = [
    {
        id: "commercial-jets",
        label: "Commercial passenger jets",
        description: "Mainline jetliners (A320, B737, B777, etc.)",
        pools: ["commercial", "longHaulOps"],
        match: function (type, spec) {
            return spec.class === "JET"
                && hasTag(spec, "JETLINER")
                && hasTag(spec, "PAX")
                && !hasTag(spec, "REGIONAL")
                && !hasTag(spec, "FREIGHTER");
        }
    },
    {
        id: "regional-jets",
        label: "Regional jets",
        description: "E-Jets, CRJ, Avro RJ, BAe 146 pax, Fokker, etc.",
        pools: ["commercial-regional"],
        match: function (type, spec) {
            return spec.class === "JET"
                && hasTag(spec, "REGIONAL")
                && hasTag(spec, "PAX")
                && !hasTag(spec, "FREIGHTER");
        }
    },
    {
        id: "regional-turboprops",
        label: "Regional turboprops (pax)",
        description: "ATR, Caravan pax, King Air, PC-12 pax, etc.",
        pools: ["commercial-regional", "lightPax"],
        match: function (type, spec) {
            return spec.class === "TURBO"
                && hasTag(spec, "REGIONAL")
                && hasTag(spec, "PAX")
                && !hasTag(spec, "FREIGHTER");
        }
    },
    {
        id: "biz-jets",
        label: "Business jets",
        description: "Citations, Phenom, Learjet, HondaJet, etc.",
        pools: ["executive", "longHaulExecutive", "lightPax"],
        match: function (type, spec) {
            return spec.class === "BIZ JET" && hasTag(spec, "PAX");
        }
    },
    {
        id: "light-freight",
        label: "Light freight (GA / turbo / biz)",
        description: "Caravan freighter, Kodiak freighter, PC-12F, light cargo twins",
        pools: ["lightFreight"],
        match: function (type, spec) {
            return hasTag(spec, "FREIGHTER")
                && (spec.class === "GA" || spec.class === "TURBO" || spec.class === "BIZ JET")
                && !hasTag(spec, "REGIONAL")
                && (spec.mtow || 0) <= 6000;
        }
    },
    {
        id: "regional-freight",
        label: "Regional freight",
        description: "RJ freighters, BAe QT, regional turboprop freighters",
        pools: ["regionalFreight", "lightFreight"],
        match: function (type, spec) {
            return hasTag(spec, "FREIGHTER") && hasTag(spec, "REGIONAL");
        }
    },
    {
        id: "heavy-freight",
        label: "Heavy freighters (civil)",
        description: "B737BCF, MD-11F, B727F, DC-6A, etc.",
        pools: ["heavyFreight", "longHaulFreight", "vintageProplinerFreight"],
        match: function (type, spec) {
            return hasTag(spec, "FREIGHTER")
                && !spec.isMilitary
                && (spec.class === "JET" || type === "DC6A")
                && (spec.maxCargo || 0) >= 2000;
        }
    },
    {
        id: "warbird-heritage",
        label: "Warbird / heritage",
        description: "Fighters, vintage warbirds, commemorative ops",
        pools: ["vintageOps", "tacticalJet-MIL", "reconnaissance-MIL"],
        match: function (type, spec) {
            return spec.class === "WARBIRD" || (hasTag(spec, "VINTAGE") && hasTag(spec, "FIGHTER"));
        }
    },
    {
        id: "vintage-airliners",
        label: "Vintage propliners & classic airliners",
        description: "DC-6B, B727, MD-80, Fokker, etc.",
        pools: ["vintageOps", "vintageAirliner"],
        match: function (type, spec) {
            return hasTag(spec, "VINTAGE") && hasTag(spec, "PAX") && !hasTag(spec, "FIGHTER");
        }
    },
    {
        id: "military-transport",
        label: "Military transport",
        description: "A400, C-130, C-160, CH-47, etc.",
        pools: ["heavyFreight-MIL", "longHaulFreight-MIL", "militaryTransit-MIL", "helicopterOps-MIL"],
        match: function (type, spec) {
            return spec.isMilitary && (hasTag(spec, "MILITARY_TRANSPORT") || type === "H47D");
        }
    },
    {
        id: "military-tactical",
        label: "Military tactical jets",
        description: "F-14, Tornado, Hawk, Jaguar, tactical helis",
        pools: ["tacticalJet-MIL"],
        match: function (type, spec) {
            return spec.isMilitary && (spec.isTactical || hasTag(spec, "FIGHTER") || hasTag(spec, "FAST_JET"));
        }
    },
    {
        id: "military-recon",
        label: "Military reconnaissance",
        description: "Vulcan, strategic recce airframes",
        pools: ["reconnaissance-MIL", "tacticalJet-MIL"],
        match: function (type, spec) {
            return spec.isMilitary && hasTag(spec, "RECON");
        }
    },
    {
        id: "civil-helicopters",
        label: "Civil helicopters",
        description: "H145, Dauphin, R22, Bo 105, etc.",
        pools: ["helicopterOps-CIV", "medical", "lightPax", "executive", "surveyServices"],
        match: function (type, spec) {
            return spec.class === "HELI" && !spec.isMilitary;
        }
    },
    {
        id: "ga-light-pax",
        label: "GA light passenger",
        description: "C172, PA-28, Bonanza, twins, etc.",
        pools: ["lightPax", "surveyServices"],
        match: function (type, spec) {
            return spec.class === "GA" && hasTag(spec, "PAX") && !hasTag(spec, "FREIGHTER");
        }
    },
    {
        id: "medevac",
        label: "Medevac / air ambulance",
        description: "Helicopters and twins with MEDEVAC tag",
        pools: ["medical"],
        match: function (type, spec) {
            return hasTag(spec, "MEDEVAC");
        }
    },
    {
        id: "gliders",
        label: "Gliders",
        description: "All glider-class airframes",
        pools: ["gliderOps"],
        match: function (type, spec) {
            return spec.class === "GLIDER";
        }
    },
    {
        id: "amphibian-unique",
        label: "Albatross / unique amphibian",
        description: "U16 unique mission set",
        pools: ["uniqueMissions"],
        aircraft: ["U16"],
        match: function (type) {
            return type === "U16";
        }
    }
];

function hasTag(spec, tag) {
    return !!(spec.tags && spec.tags.includes(tag));
}

function loadMissionAssignmentsSync(jsonUrl) {
    var url = jsonUrl || "mission-assignments.json";
    try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, false);
        xhr.setRequestHeader("Cache-Control", "no-cache");
        xhr.send(null);
        if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300)) {
            if (xhr.responseText && xhr.responseText.trim().charAt(0) === "{") {
                missionAssignmentData = JSON.parse(xhr.responseText);
                return true;
            }
        }
    } catch (e) {
        /* file protocol or missing file */
    }
    return false;
}

function loadMissionAssignmentsFromScript() {
    if (typeof MISSION_ASSIGNMENTS_EMBED !== "undefined" && MISSION_ASSIGNMENTS_EMBED) {
        setMissionAssignmentData(MISSION_ASSIGNMENTS_EMBED);
        return true;
    }
    return false;
}

function initMissionAssignments() {
    if (loadMissionAssignmentsSync("mission-assignments.json")) return true;
    if (loadMissionAssignmentsFromScript()) return true;
    return false;
}

function setMissionAssignmentData(data) {
    missionAssignmentData = data;
}

function getMissionAssignmentData() {
    return missionAssignmentData;
}

var CUSTOM_FLEET_STORAGE_KEY = "dispatcher_custom_fleet";
var CUSTOM_ASSIGNMENTS_STORAGE_KEY = "dispatcher_custom_assignments";

function hasAnyCustomMissionAssignments() {
    if (typeof localStorage === "undefined") return false;
    try {
        var data = JSON.parse(localStorage.getItem(CUSTOM_ASSIGNMENTS_STORAGE_KEY) || "{}");
        return Object.keys(data).some(function (type) {
            return Array.isArray(data[type]) && data[type].length > 0;
        });
    } catch (e) {
        return false;
    }
}

function getCustomMissionAssignments() {
    if (typeof localStorage === "undefined") return {};
    try {
        var data = JSON.parse(localStorage.getItem(CUSTOM_ASSIGNMENTS_STORAGE_KEY) || "{}");
        return data && typeof data === "object" ? data : {};
    } catch (e) {
        return {};
    }
}

function saveCustomMissionAssignment(aircraftType, imgIds) {
    if (typeof localStorage === "undefined") return;
    var all = getCustomMissionAssignments();
    all[aircraftType] = (imgIds || []).slice().sort(function (a, b) { return a - b; });
    localStorage.setItem(CUSTOM_ASSIGNMENTS_STORAGE_KEY, JSON.stringify(all));
}

function isCustomFleetAircraft(aircraftType, coreFleetSpecs) {
    if (typeof localStorage === "undefined") return false;
    try {
        var fleet = JSON.parse(localStorage.getItem(CUSTOM_FLEET_STORAGE_KEY) || "{}");
        return Object.prototype.hasOwnProperty.call(fleet, aircraftType)
            && (!coreFleetSpecs || !Object.prototype.hasOwnProperty.call(coreFleetSpecs, aircraftType));
    } catch (e) {
        return false;
    }
}

function usesMissionAssignments() {
    if (missionAssignmentData && missionAssignmentData.assignments) return true;
    return hasAnyCustomMissionAssignments();
}

function getAssignedImgIdsForAircraft(aircraftType) {
    var customAll = getCustomMissionAssignments();
    if (customAll[aircraftType] && customAll[aircraftType].length) {
        return customAll[aircraftType];
    }
    if (!missionAssignmentData || !missionAssignmentData.assignments) {
        return hasAnyCustomMissionAssignments() ? [] : null;
    }
    var list = missionAssignmentData.assignments[aircraftType];
    if (!Array.isArray(list)) return [];
    return list;
}

function getAssignedImgIdSetForAircraft(aircraftType) {
    var list = getAssignedImgIdsForAircraft(aircraftType);
    if (!list) return null;
    return new Set(list);
}

function isScenarioAllowedForAircraft(aircraftType, imgId, missionType) {
    if (!usesMissionAssignments()) return null;
    var set = getAssignedImgIdSetForAircraft(aircraftType);
    if (!set) return false;
    return set.has(imgId);
}

function filterPoolToAssignedOnly(aircraftType, pool) {
    if (!usesMissionAssignments() || !Array.isArray(pool)) return pool;
    return pool.filter(function (s) {
        return isScenarioAllowedForAircraft(aircraftType, s.imgId) === true;
    });
}

function formatMissionTemplateRange(types) {
    if (!types || !types.length) return "";
    var sorted = types.slice().sort(function (a, b) { return a - b; });
    if (sorted.length === 1) return String(sorted[0]);
    var consecutive = true;
    for (var i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i - 1] + 1) {
            consecutive = false;
            break;
        }
    }
    if (consecutive) return sorted[0] + "\u2013" + sorted[sorted.length - 1];
    return sorted.join(", ");
}

function buildPoolMetadata(scenarioDB, missionMatrix) {
    var pools = {};
    MISSION_POOL_ORDER.forEach(function (poolKey) {
        if (!scenarioDB[poolKey]) return;
        var scenarios = scenarioDB[poolKey];
        var templatesForPool = missionMatrix.filter(function (m) { return m.pool === poolKey; });
        var missionTypes = templatesForPool.map(function (m) { return m.type; }).sort(function (a, b) { return a - b; });
        var missionType = missionTypes.length === 1
            ? missionTypes[0]
            : ((scenarios[0] && scenarios[0].missionType) || missionTypes[0] || null);
        var missionName = "";
        var missionNames = templatesForPool.map(function (m) { return m.name; });
        if (missionTypes.length === 1) {
            missionName = missionNames[0] || "";
        } else if (missionType) {
            var mt = missionMatrix.find(function (m) { return m.type === missionType; });
            missionName = mt ? mt.name : "";
        }
        pools[poolKey] = {
            label: MISSION_POOL_LABELS[poolKey] || poolKey,
            missionType: missionType,
            missionTypes: missionTypes,
            missionName: missionName,
            missionNames: missionNames,
            templateLabel: formatMissionTemplateRange(missionTypes),
            imgIds: scenarios.map(function (s) { return s.imgId; }),
            scenarios: scenarios
        };
    });
    return pools;
}

function getPresetMatchingAircraft(preset, fleetSpecs) {
    var types = [];
    Object.keys(fleetSpecs).forEach(function (type) {
        var spec = fleetSpecs[type];
        if (preset.aircraft && preset.aircraft.includes(type)) {
            types.push(type);
            return;
        }
        if (preset.match && preset.match(type, spec)) {
            types.push(type);
        }
    });
    return types.sort();
}

function applyPoolsToImgIds(poolKeys, poolMetadata, existingImgIds) {
    var set = new Set(existingImgIds || []);
    poolKeys.forEach(function (poolKey) {
        var meta = poolMetadata[poolKey];
        if (!meta) return;
        meta.imgIds.forEach(function (id) { set.add(id); });
    });
    return [...set].sort(function (a, b) { return a - b; });
}

function removePoolsFromImgIds(poolKeys, poolMetadata, existingImgIds) {
    var remove = new Set();
    poolKeys.forEach(function (poolKey) {
        var meta = poolMetadata[poolKey];
        if (!meta) return;
        meta.imgIds.forEach(function (id) { remove.add(id); });
    });
    return (existingImgIds || []).filter(function (id) { return !remove.has(id); });
}

function diffAssignments(baseline, current) {
    var allTypes = new Set(Object.keys(baseline || {}).concat(Object.keys(current || {})));
    var summary = {
        aircraftChanged: 0,
        aircraftAdded: 0,
        aircraftRemoved: 0,
        totalImgIdAdds: 0,
        totalImgIdRemoves: 0,
        byAircraft: {}
    };

    allTypes.forEach(function (type) {
        var base = new Set((baseline && baseline[type]) || []);
        var cur = new Set((current && current[type]) || []);
        var added = [];
        var removed = [];
        cur.forEach(function (id) { if (!base.has(id)) added.push(id); });
        base.forEach(function (id) { if (!cur.has(id)) removed.push(id); });
        if (added.length || removed.length) {
            summary.aircraftChanged++;
            summary.totalImgIdAdds += added.length;
            summary.totalImgIdRemoves += removed.length;
            summary.byAircraft[type] = { added: added.sort(function (a, b) { return a - b; }), removed: removed.sort(function (a, b) { return a - b; }) };
        }
    });

    return summary;
}

function specHasTag(spec, tag) {
    return !!(spec && spec.tags && spec.tags.indexOf(tag) >= 0);
}

function inferCargoTierFromSpec(spec) {
    if (!spec) return "light";
    if (spec.isMilitary && (specHasTag(spec, "MILITARY_TRANSPORT") || specHasTag(spec, "HEAVY") || (spec.maxCargo || 0) >= 10000)) {
        return "military";
    }
    if (specHasTag(spec, "HEAVY") || (spec.mtow || 0) >= 75000 || (spec.maxCargo || 0) >= 20000) {
        return "heavy";
    }
    if (specHasTag(spec, "REGIONAL") || (spec.mtow || 0) >= 6000 || (spec.maxCargo || 0) >= 1500) {
        return "regional";
    }
    return "light";
}

function inferMissionRolesFromLegacySpec(spec) {
    var roles = {
        passenger: false,
        cargo: false,
        cargoTier: inferCargoTierFromSpec(spec),
        executive: false,
        military: !!spec.isMilitary,
        medevac: specHasTag(spec, "MEDEVAC")
    };
    if (spec.class === "GLIDER") {
        roles.passenger = true;
        return roles;
    }
    if (specHasTag(spec, "FREIGHTER") || ((spec.maxCargo || 0) > 0 && (spec.maxPax || 0) === 0)) {
        roles.cargo = true;
        roles.cargoTier = inferCargoTierFromSpec(spec);
    }
    if (specHasTag(spec, "PAX") || (spec.maxPax || 0) > 0) {
        roles.passenger = true;
    }
    if (specHasTag(spec, "VIP") || spec.class === "BIZ JET") {
        roles.executive = true;
    }
    if (spec.isTactical || specHasTag(spec, "FIGHTER") || specHasTag(spec, "FAST_JET") || specHasTag(spec, "TACTICAL")) {
        roles.military = true;
    }
    if (spec.class === "WARBIRD" || spec.class === "HELI") {
        roles.military = !!spec.isMilitary;
    }
    if (!roles.passenger && !roles.cargo && !roles.executive && !roles.military && !roles.medevac) {
        if ((spec.maxPax || 0) > 0) roles.passenger = true;
        else if ((spec.maxCargo || 0) > 0) {
            roles.cargo = true;
            roles.cargoTier = inferCargoTierFromSpec(spec);
        } else {
            roles.passenger = true;
        }
    }
    return roles;
}

function uniquePoolKeys(poolKeys) {
    var seen = new Set();
    var out = [];
    poolKeys.forEach(function (key) {
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(key);
    });
    return out;
}

function resolvePoolKeysForCustomRoles(spec, roles) {
    if (!spec || !roles) return [];
    var pools = [];
    var cls = spec.class;

    if (cls === "GLIDER") {
        return ["gliderOps"];
    }

    if (roles.passenger) {
        if (cls === "JET") {
            if (specHasTag(spec, "REGIONAL") || (spec.mtow || 0) < 50000) {
                pools.push("commercial-regional");
            } else {
                pools.push("commercial", "longHaulOps");
            }
        } else if (cls === "TURBO") {
            pools.push("commercial-regional", "lightPax");
        } else if (cls === "GA") {
            pools.push("lightPax");
        } else if (cls === "HELI") {
            pools.push("lightPax", "helicopterOps-CIV");
        } else if (cls === "BIZ JET") {
            pools.push("lightPax");
        }
    }

    if (roles.executive || cls === "BIZ JET") {
        pools.push("executive", "longHaulExecutive");
    }

    if (roles.cargo) {
        var tier = roles.cargoTier || inferCargoTierFromSpec(spec);
        if (tier === "military" || (spec.isMilitary && tier !== "light")) {
            pools.push("heavyFreight-MIL", "longHaulFreight-MIL", "militaryTransit-MIL");
        } else if (tier === "heavy") {
            pools.push("heavyFreight", "longHaulFreight", "vintageProplinerFreight");
        } else if (tier === "regional") {
            pools.push("regionalFreight", "lightFreight");
        } else {
            pools.push("lightFreight");
        }
    }

    if (roles.military || spec.isTactical) {
        if (cls === "HELI" || specHasTag(spec, "ROTORCRAFT")) {
            pools.push("helicopterOps-MIL");
        } else if (cls === "WARBIRD" || specHasTag(spec, "FIGHTER") || spec.isTactical) {
            pools.push("tacticalJet-MIL", "vintageOps");
            if (specHasTag(spec, "RECON")) pools.push("reconnaissance-MIL");
        } else if (spec.isMilitary) {
            pools.push("militaryTransit-MIL", "heavyFreight-MIL");
        }
    } else if (specHasTag(spec, "RECON")) {
        pools.push("reconnaissance-MIL");
    }

    if (roles.medevac) {
        pools.push("medical");
    }

    if (cls === "HELI" && !spec.isMilitary) {
        pools.push("helicopterOps-CIV", "surveyServices");
    }

    if (specHasTag(spec, "VINTAGE") && specHasTag(spec, "PAX") && !specHasTag(spec, "FIGHTER")) {
        pools.push("vintageOps", "vintageAirliner");
    }

    return uniquePoolKeys(pools).filter(function (key) {
        return MISSION_POOL_ORDER.indexOf(key) >= 0;
    });
}

function buildCustomAssignmentImgIds(spec, roles, scenarioDB, missionMatrix) {
    if (!scenarioDB || !missionMatrix) return [];
    var poolKeys = resolvePoolKeysForCustomRoles(spec, roles);
    if (!poolKeys.length) return [];
    var poolMetadata = buildPoolMetadata(scenarioDB, missionMatrix);
    return applyPoolsToImgIds(poolKeys, poolMetadata, []);
}

function validateMissionAssignmentCoverage(fleetSpecs) {
    var errors = [];
    if (!missionAssignmentData || !missionAssignmentData.assignments) {
        errors.push("Mission assignment embed is not loaded.");
        return errors;
    }
    var fleet = fleetSpecs || {};
    var assignments = missionAssignmentData.assignments;
    Object.keys(fleet).forEach(function (type) {
        var list = assignments[type];
        if (!Array.isArray(list) || list.length === 0) {
            errors.push("No mission assignments for core fleet type: " + type);
        }
    });
    return errors;
}

function assertMissionAssignmentsReady(fleetSpecs) {
    if (!usesMissionAssignments()) {
        throw new Error("VECTOR: mission assignments are required but not loaded. Regenerate mission-assignments-data.js from the mission editor.");
    }
    var errors = validateMissionAssignmentCoverage(fleetSpecs);
    if (errors.length) {
        throw new Error("VECTOR mission assignment coverage failed:\n" + errors.join("\n"));
    }
    return true;
}

function migrateCustomMissionAssignments(coreFleetSpecs, scenarioDB, missionMatrix) {
    if (typeof localStorage === "undefined" || !scenarioDB || !missionMatrix) {
        return { migrated: 0, skipped: 0 };
    }
    var customFleet;
    try {
        customFleet = JSON.parse(localStorage.getItem(CUSTOM_FLEET_STORAGE_KEY) || "{}");
    } catch (e) {
        return { migrated: 0, skipped: 0 };
    }
    var assignments = getCustomMissionAssignments();
    var migrated = 0;
    var skipped = 0;
    Object.keys(customFleet).forEach(function (type) {
        if (coreFleetSpecs && Object.prototype.hasOwnProperty.call(coreFleetSpecs, type)) {
            skipped++;
            return;
        }
        if (assignments[type] && assignments[type].length) {
            skipped++;
            return;
        }
        var spec = customFleet[type];
        var roles = spec.missionRoles || inferMissionRolesFromLegacySpec(spec);
        var imgIds = buildCustomAssignmentImgIds(spec, roles, scenarioDB, missionMatrix);
        if (!imgIds.length) {
            skipped++;
            return;
        }
        saveCustomMissionAssignment(type, imgIds);
        migrated++;
    });
    return { migrated: migrated, skipped: skipped };
}

if (typeof globalThis !== "undefined") {
    globalThis.MISSION_ASSIGNMENT_SCHEMA = MISSION_ASSIGNMENT_SCHEMA;
    globalThis.MISSION_POOL_ORDER = MISSION_POOL_ORDER;
    globalThis.MISSION_POOL_LABELS = MISSION_POOL_LABELS;
    globalThis.AIRCRAFT_MISSION_PRESETS = AIRCRAFT_MISSION_PRESETS;
    globalThis.loadMissionAssignmentsSync = loadMissionAssignmentsSync;
    globalThis.loadMissionAssignmentsFromScript = loadMissionAssignmentsFromScript;
    globalThis.initMissionAssignments = initMissionAssignments;
    globalThis.setMissionAssignmentData = setMissionAssignmentData;
    globalThis.getMissionAssignmentData = getMissionAssignmentData;
    globalThis.usesMissionAssignments = usesMissionAssignments;
    globalThis.getAssignedImgIdsForAircraft = getAssignedImgIdsForAircraft;
    globalThis.getAssignedImgIdSetForAircraft = getAssignedImgIdSetForAircraft;
    globalThis.isScenarioAllowedForAircraft = isScenarioAllowedForAircraft;
    globalThis.filterPoolToAssignedOnly = filterPoolToAssignedOnly;
    globalThis.buildPoolMetadata = buildPoolMetadata;
    globalThis.getPresetMatchingAircraft = getPresetMatchingAircraft;
    globalThis.applyPoolsToImgIds = applyPoolsToImgIds;
    globalThis.removePoolsFromImgIds = removePoolsFromImgIds;
    globalThis.diffAssignments = diffAssignments;
    globalThis.CUSTOM_ASSIGNMENTS_STORAGE_KEY = CUSTOM_ASSIGNMENTS_STORAGE_KEY;
    globalThis.getCustomMissionAssignments = getCustomMissionAssignments;
    globalThis.saveCustomMissionAssignment = saveCustomMissionAssignment;
    globalThis.isCustomFleetAircraft = isCustomFleetAircraft;
    globalThis.inferCargoTierFromSpec = inferCargoTierFromSpec;
    globalThis.inferMissionRolesFromLegacySpec = inferMissionRolesFromLegacySpec;
    globalThis.resolvePoolKeysForCustomRoles = resolvePoolKeysForCustomRoles;
    globalThis.buildCustomAssignmentImgIds = buildCustomAssignmentImgIds;
    globalThis.migrateCustomMissionAssignments = migrateCustomMissionAssignments;
    globalThis.validateMissionAssignmentCoverage = validateMissionAssignmentCoverage;
    globalThis.assertMissionAssignmentsReady = assertMissionAssignmentsReady;
}

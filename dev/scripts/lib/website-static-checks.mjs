/**
 * Static + runtime-load checks for all website deploy assets.
 * Does NOT validate airport field data or fleet performance specs (done on DB entry).
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createVectorSandboxWithAirports } from "./load-vector-db.mjs";

export const DEPLOY_FILES = [
    "loader.js",
    "version.json",
    "index.html",
    "dispatch-engine.js",
    "mission-assignment-core.js",
    "mission-assignments-data.js",
    "mission-assignments.json",
    "fleet-db.js",
    "missions-db.js",
    "airports-asobo-db.js",
    "airports-thirdparty-db.js",
    "short-haul-routes-db.js",
    "long-haul-routes-db.js",
    "data/ils-strict-icaos.js",
    "data/navigraph-airport-icaos.js",
    "data/dest-approach-types.js",
    "favicon/site.webmanifest"
];

export const LOADER_SCRIPTS = [
    "airports-asobo-db.js",
    "airports-thirdparty-db.js",
    "data/ils-strict-icaos.js",
    "data/navigraph-airport-icaos.js",
    "data/dest-approach-types.js",
    "mission-assignment-core.js",
    "mission-assignments-data.js",
    "short-haul-routes-db.js",
    "dispatch-engine.js",
    "fleet-db.js",
    "missions-db.js"
];

const LEGACY_AIRPORT_VARS = [
    "seedHandCraftedAirportDatabase",
    "seedContrailDatabase",
    "seedFlightsimToDatabase",
    "seediniBuildsDatabase",
    "seedORBXDatabase",
    "seedOtherAirportDatabase",
    "seedUK2000Database",
    "seedGliderAirportDatabase",
    "seedSmallDetailedDatabase"
];

const HTML_HANDLERS = [
    "dispatchFlight",
    "saveCustomAircraft",
    "saveCustomAirport",
    "importDatabaseBackup"
];

function readJsonFile(path) {
    let text = readFileSync(path, "utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return JSON.parse(text);
}

export function checkDeployFilesPresent(root) {
    const start = Date.now();
    const label = "deploy-files-present";
    const missing = DEPLOY_FILES.filter((f) => !existsSync(join(root, f)));
    if (missing.length) {
        return {
            label,
            ok: false,
            ms: Date.now() - start,
            detail: `missing: ${missing.join(", ")}`
        };
    }
    return { label, ok: true, ms: Date.now() - start, out: `OK (${DEPLOY_FILES.length} files)` };
}

export function checkAssignmentEmbedSync(root) {
    const start = Date.now();
    const label = "assignment-embed-sync";
    const jsonPath = join(root, "mission-assignments.json");
    const embedPath = join(root, "mission-assignments-data.js");
    const data = readJsonFile(jsonPath);
    const embedText = readFileSync(embedPath, "utf8");
    const m = embedText.match(/MISSION_ASSIGNMENTS_EMBED\s*=\s*(\{[\s\S]*\});/);
    if (!m) {
        return { label, ok: false, ms: Date.now() - start, detail: "MISSION_ASSIGNMENTS_EMBED missing" };
    }
    const embed = JSON.parse(m[1]);
    const jsonAssign = data.assignments || {};
    const embedAssign = embed.assignments || {};
    const mismatches = [];
    for (const type of new Set([...Object.keys(jsonAssign), ...Object.keys(embedAssign)])) {
        const a = [...(jsonAssign[type] || [])].sort((x, y) => x - y).join(",");
        const b = [...(embedAssign[type] || [])].sort((x, y) => x - y).join(",");
        if (a !== b) mismatches.push(type);
    }
    if (mismatches.length) {
        return {
            label,
            ok: false,
            ms: Date.now() - start,
            detail: `sync mismatch: ${mismatches.slice(0, 6).join(", ")}${mismatches.length > 6 ? "..." : ""}`
        };
    }
    return { label, ok: true, ms: Date.now() - start, out: `OK (${Object.keys(jsonAssign).length} aircraft)` };
}

export function checkLoaderAndWiring(root) {
    const start = Date.now();
    const label = "loader-wiring";
    const issues = [];
    const loader = readFileSync(join(root, "loader.js"), "utf8");
    const loaderV = loader.match(/APP_VERSION\s*=\s*"([^"]+)"/)?.[1];
    const fileV = readJsonFile(join(root, "version.json")).version;
    if (loaderV !== fileV) {
        issues.push(`version mismatch loader.js=${loaderV} version.json=${fileV}`);
    }
    for (const script of LOADER_SCRIPTS) {
        if (!loader.includes(`"${script}"`)) {
            issues.push(`loader.js missing script: ${script}`);
        }
    }
    if (!loader.includes("initMissionAssignments")) {
        issues.push("loader.js does not call initMissionAssignments()");
    }
    if (!loader.includes("assertMissionAssignmentsReady")) {
        issues.push("loader.js does not call assertMissionAssignmentsReady()");
    }
    const engine = readFileSync(join(root, "dispatch-engine.js"), "utf8");
    for (const v of ["seedAsoboAirportDatabase", "seedThirdPartyAirportDatabase"]) {
        if (!engine.includes(v)) {
            issues.push(`dispatch-engine.js missing ${v}`);
        }
    }
    for (const legacy of LEGACY_AIRPORT_VARS) {
        if (engine.includes(legacy)) {
            issues.push(`dispatch-engine.js still uses legacy var ${legacy}`);
        }
        if (loader.includes(legacy)) {
            issues.push(`loader.js still references legacy var ${legacy}`);
        }
    }
    if (!engine.includes("getLastLogbookArrival")) {
        issues.push("dispatch-engine.js missing getLastLogbookArrival");
    }
    if (issues.length) {
        return { label, ok: false, ms: Date.now() - start, detail: issues[0], out: issues.join("; ") };
    }
    return { label, ok: true, ms: Date.now() - start, out: `OK v${loaderV}` };
}

export function checkHtmlShell(root) {
    const start = Date.now();
    const label = "html-shell";
    const issues = [];
    const html = readFileSync(join(root, "index.html"), "utf8");
    if (!html.includes("loader.js")) {
        issues.push("index.html does not reference loader.js");
    }
    for (const handler of HTML_HANDLERS) {
        if (!html.includes(handler)) {
            issues.push(`index.html missing handler reference: ${handler}`);
        }
    }
    if (issues.length) {
        return { label, ok: false, ms: Date.now() - start, detail: issues[0] };
    }
    return { label, ok: true, ms: Date.now() - start, out: `OK (${HTML_HANDLERS.length} handlers)` };
}

export function checkMissionsDbIntegrity(root) {
    const start = Date.now();
    const label = "missions-db-integrity";
    const text = readFileSync(join(root, "missions-db.js"), "utf8");
    const seen = new Map();
    for (const m of text.matchAll(/\{\s*type:\s*(\d+),/g)) {
        const t = Number(m[1]);
        seen.set(t, (seen.get(t) || 0) + 1);
    }
    const dups = [...seen.entries()].filter(([, c]) => c > 1).map(([t]) => t);
    if (dups.length) {
        return {
            label,
            ok: false,
            ms: Date.now() - start,
            detail: `duplicate missionMatrix type IDs: ${dups.join(", ")}`
        };
    }
    if (!text.includes("const missionMatrix") || !text.includes("const scenarioDB")) {
        return { label, ok: false, ms: Date.now() - start, detail: "missions-db.js missing missionMatrix or scenarioDB" };
    }
    return { label, ok: true, ms: Date.now() - start, out: `OK (${seen.size} mission types)` };
}

export function checkJsRuntimeBundle(root) {
    const start = Date.now();
    const label = "js-runtime-bundle";
    try {
        const sbx = createVectorSandboxWithAirports(root);
        if (typeof sbx.usesMissionAssignments !== "function" || !sbx.usesMissionAssignments()) {
            return { label, ok: false, ms: Date.now() - start, detail: "usesMissionAssignments() is false after load" };
        }
        if (typeof sbx.assertMissionAssignmentsReady === "function") {
            sbx.assertMissionAssignmentsReady(sbx.coreFleetSpecs);
        }
        if (typeof sbx.rebuildActiveDatabase === "function") {
            sbx.rebuildActiveDatabase();
        }
        const airports = typeof sbx.getMergedSeedAirports === "function" ? sbx.getMergedSeedAirports() : [];
        if (!airports.length) {
            return { label, ok: false, ms: Date.now() - start, detail: "airport databases loaded 0 airports" };
        }
        if (typeof sbx.probeDispatchFlight !== "function") {
            return { label, ok: false, ms: Date.now() - start, detail: "probeDispatchFlight not exported" };
        }
        const fleetN = Object.keys(sbx.coreFleetSpecs || {}).length;
        return {
            label,
            ok: true,
            ms: Date.now() - start,
            out: `OK (${fleetN} aircraft, ${airports.length} airports, assignments active)`
        };
    } catch (err) {
        return { label, ok: false, ms: Date.now() - start, detail: String(err.message || err) };
    }
}

export function runWebsiteStaticChecks(root) {
    return [
        checkDeployFilesPresent(root),
        checkAssignmentEmbedSync(root),
        checkLoaderAndWiring(root),
        checkHtmlShell(root),
        checkMissionsDbIntegrity(root),
        checkJsRuntimeBundle(root)
    ];
}

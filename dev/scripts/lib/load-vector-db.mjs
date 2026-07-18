import { readFileSync } from "fs";
import vm from "vm";
import { join } from "path";

/**
 * Load fleet-db, missions-db, and dispatch-engine into a shared VM sandbox.
 * Strips window.onload from dispatch-engine so it can run in Node.
 */
export function createVectorSandbox(rootDir = process.cwd()) {
    function loadScript(sandbox, fileName) {
        let code = readFileSync(join(rootDir, fileName), "utf8");
        if (fileName === "dispatch-engine.js") {
            code = code.replace(/^window\.onload\s*=\s*function\s*\(\)\s*\{[\s\S]*$/m, "");
        }
        vm.runInNewContext(code, sandbox, { filename: fileName });
    }

    const sandbox = {
        globalThis: null,
        console,
        window: {},
        ___vectorMockLongHaul: false,
        document: {
            getElementById: (id) => {
                if (id === "longHaulToggle") {
                    return { checked: !!sandbox.___vectorMockLongHaul };
                }
                return null;
            },
        },
        localStorage: { getItem: () => null, setItem: () => {} },
        alert: () => {},
        Math,
        Date,
        Array,
        Object,
        Set,
        Map,
        JSON,
        parseInt,
        parseFloat,
        isNaN,
        undefined,
        String,
        Number,
        Boolean,
        Error,
        RegExp
    };
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;

    loadScript(sandbox, "fleet-db.js");
    loadScript(sandbox, "missions-db.js");
    loadScript(sandbox, "mission-assignment-core.js");
    loadScript(sandbox, "mission-assignments-data.js");
    loadScript(sandbox, "long-haul-routes-db.js");
    loadScript(sandbox, "short-haul-routes-db.js");
    loadScript(sandbox, "dispatch-engine.js");
    vm.runInNewContext("if (typeof initMissionAssignments === 'function') initMissionAssignments();", sandbox);
    vm.runInNewContext("activeFleetSpecs = coreFleetSpecs;", sandbox);
    sandbox.activeFleetSpecs = sandbox.coreFleetSpecs;

    return sandbox;
}

/** Same as createVectorSandbox but includes airport databases for dispatch probe tests. */
export function createVectorSandboxWithAirports(rootDir = process.cwd()) {
    const sandbox = createVectorSandbox(rootDir);
    function loadScript(sandbox, fileName) {
        const code = readFileSync(join(rootDir, fileName), "utf8");
        vm.runInNewContext(code, sandbox, { filename: fileName });
    }
    loadScript(sandbox, "airports-asobo-db.js");
    loadScript(sandbox, "airports-thirdparty-db.js");
    for (const navFile of [
        "data/ils-strict-icaos.js",
        "data/navigraph-airport-icaos.js",
        "data/dest-approach-types.js"
    ]) {
        loadScript(sandbox, navFile);
    }
    vm.runInNewContext("if (typeof rebuildActiveDatabase === 'function') rebuildActiveDatabase();", sandbox);
    sandbox.activeAirportDatabase = vm.runInNewContext("activeAirportDatabase", sandbox);
    return sandbox;
}

export function buildScenarioIndex(scenarioDB, missionMatrix) {
    const imgIdToPool = {};
    const imgIdToMissionType = {};
    const allImgIds = [];

    for (const [pool, scenarios] of Object.entries(scenarioDB)) {
        const defaultType = missionMatrix.find((m) => m.pool === pool)?.type;
        for (const s of scenarios) {
            imgIdToPool[s.imgId] = pool;
            imgIdToMissionType[s.imgId] = s.missionType ?? defaultType ?? null;
            allImgIds.push(s.imgId);
        }
    }

    allImgIds.sort((a, b) => a - b);
    return { imgIdToPool, imgIdToMissionType, allImgIds };
}

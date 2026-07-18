/**
 * Load Vector Flight Dispatch JS (airports, engine, fleet, missions) into a Node vm context.
 * Exposes probeDispatchFlight() for headless smoke tests — same path as the Generate button.
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const LOAD_ORDER = [
    "airports-asobo-db.js",
    "airports-thirdparty-db.js",
    "missions-db.js",
    "mission-assignment-core.js",
    "mission-assignments-data.js",
    "fleet-db.js",
    "dispatch-engine.js",
];

function createStorage() {
    const data = new Map();
    return {
        getItem(key) {
            return data.has(key) ? data.get(key) : null;
        },
        setItem(key, value) {
            data.set(key, String(value));
        },
        removeItem(key) {
            data.delete(key);
        },
    };
}

function createDomStub() {
    const defaults = {
        timeSlider: { value: "60", disabled: false },
        callsignInput: { value: "TST001" },
        depOverrideInput: { value: "" },
        contractorToggle: { checked: false },
        militaryBaseToggle: { checked: false },
        preferOwnedToggle: { checked: false },
        longHaulToggle: { checked: false },
        routingScopeSelect: { value: "worldwide" },
        useLastArrivalToggle: { checked: false },
        ownedAirportsInput: { value: "" },
        aircraftInput: { value: "" },
        customAircraftList: { innerHTML: "", style: { display: "none" } },
    };
    const stubEl = (id) => {
        const base = defaults[id] || {};
        const el = {
            value: base.value ?? "",
            checked: !!base.checked,
            disabled: !!base.disabled,
            innerHTML: base.innerHTML ?? "",
            textContent: "",
            style: base.style || {},
            classList: { add() {}, remove() {}, toggle() {} },
            addEventListener() {},
            contains() { return false; },
            appendChild() {},
            onclick: null,
            onfocus: null,
            oninput: null,
            onblur: null,
        };
        return el;
    };
    return {
        getElementById: stubEl,
        querySelector: () => null,
        createElement() {
            return stubEl("_dynamic");
        },
        addEventListener() {},
        removeEventListener() {},
        head: { appendChild() {} },
        write() {},
    };
}

/**
 * @param {{ fresh?: boolean }} [options]
 * @returns {import("vm").Context & {
 *   probeDispatchFlight: Function,
 *   resetDispatchProbeHistory: Function,
 *   coreFleetSpecs: Record<string, object>,
 *   canAircraftUseLongHaulMode: Function,
 *   activeFleetSpecs: Record<string, object>,
 * }}
 */
export function loadDispatchContext(options = {}) {
    const storage = createStorage();
    const sandbox = {
        globalThis: null,
        window: null,
        document: createDomStub(),
        console,
        Math,
        JSON,
        Object,
        Array,
        Set,
        Map,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        Date,
        String,
        Number,
        Boolean,
        RegExp,
        Error,
        TypeError,
        RangeError,
        URL: typeof URL !== "undefined" ? URL : undefined,
        localStorage: storage,
        sessionStorage: createStorage(),
        alert() {},
        confirm() { return false; },
        fetch() { return Promise.resolve({ ok: false }); },
        location: { protocol: "file:", href: "file:///index.html" },
        DISPATCHER_APP_VERSION: "smoke-test",
        dispatcherCompareVersions: () => 0,
        dispatcherPickNewerVersion: (a) => a,
    };
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;

    const ctx = vm.createContext(sandbox);

    for (const file of LOAD_ORDER) {
        const filePath = path.join(ROOT, file);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Missing required file: ${file}`);
        }
        const code = fs.readFileSync(filePath, "utf8");
        vm.runInContext(code, ctx, { filename: file });
    }

    if (typeof sandbox.probeDispatchFlight !== "function") {
        throw new Error("probeDispatchFlight was not exported from dispatch-engine.js");
    }
    if (typeof sandbox.rebuildFleetDropdown !== "function") {
        throw new Error("rebuildFleetDropdown was not found in dispatch-engine.js");
    }

    sandbox.rebuildFleetDropdown();
    sandbox.activeAirportDatabaseNeedsRebuild = true;
    sandbox.rebuildActiveDatabase();

    if (options.fresh && typeof sandbox.resetDispatchProbeHistory === "function") {
        sandbox.resetDispatchProbeHistory();
    }

    return sandbox;
}

export function listMissionImageIds(root = ROOT) {
    const dir = path.join(root, "images-missions");
    return new Set(
        fs.readdirSync(dir)
            .filter((f) => /^mission\d+\.jpg$/i.test(f))
            .map((f) => parseInt(f.match(/\d+/)[0], 10))
    );
}

export function collectScenarioImgIds(scenarioDB) {
    const ids = new Set();
    for (const pool of Object.values(scenarioDB || {})) {
        if (!Array.isArray(pool)) continue;
        for (const row of pool) {
            if (row && row.imgId != null) ids.add(row.imgId);
        }
    }
    return ids;
}

export { ROOT };

import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const ENGINE_FILES = [
    "airports-asobo-db.js",
    "airports-thirdparty-db.js",
    "dispatch-engine.js",
    "fleet-db.js",
    "missions-db.js"
];

function makeStorage() {
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
        clear() {
            data.clear();
        }
    };
}

function makeElement(defaults = {}) {
    return {
        value: defaults.value ?? "",
        checked: defaults.checked ?? false,
        disabled: false,
        innerText: "",
        textContent: "",
        href: "",
        download: "",
        style: { display: "" },
        classList: {
            toggle() {},
            add() {},
            remove() {}
        },
        addEventListener() {},
        removeEventListener() {},
        appendChild() {},
        contains() {
            return false;
        },
        onclick: null,
        onfocus: null,
        oninput: null,
        onblur: null,
        onchange: null
    };
}

export function loadDispatchEngine(options = {}) {
    const elements = Object.create(null);
    const alerts = [];
    const confirms = [];
    const localStorage = makeStorage();
    const sessionStorage = makeStorage();

    const document = {
        getElementById(id) {
            if (!elements[id]) {
                elements[id] = makeElement();
            }
            return elements[id];
        },
        querySelector() {
            return null;
        },
        addEventListener() {},
        removeEventListener() {},
        createElement() {
            return makeElement();
        },
        write() {},
        head: { appendChild() {} }
    };

    const sandbox = {
        console,
        Math,
        Date,
        JSON,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        Array,
        Object,
        Set,
        Map,
        Error,
        TypeError,
        String,
        Number,
        RegExp,
        Intl,
        URL,
        Blob: class Blob {
            constructor(parts, opts) {
                this.parts = parts;
                this.type = opts && opts.type;
            }
        },
        alert(msg) {
            alerts.push(String(msg));
        },
        confirm(msg) {
            confirms.push(String(msg));
            return true;
        },
        document,
        localStorage,
        sessionStorage,
        location: {
            protocol: "file:",
            href: "file:///vector/index.html",
            replace() {}
        },
        fetch() {
            return Promise.resolve({ ok: false });
        },
        setTimeout,
        clearTimeout
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;

    vm.createContext(sandbox);
    for (const file of ENGINE_FILES) {
        const fullPath = path.join(ROOT, file);
        const code = fs.readFileSync(fullPath, "utf8");
        vm.runInContext(code, sandbox, { filename: fullPath });
    }

    sandbox.activeFleetSpecs = { ...sandbox.coreFleetSpecs };
    vm.runInContext(
        "activeFleetSpecs = Object.assign({}, coreFleetSpecs); rebuildActiveDatabase(); lastMissions = []; lastScenarioImgIds = [];",
        sandbox
    );

    const maxAirports = options.maxAirports || 0;
    if (maxAirports > 0) {
        vm.runInContext(
            `if (activeAirportDatabase.length > ${maxAirports}) {
                const stride = Math.max(1, Math.floor(activeAirportDatabase.length / ${maxAirports}));
                activeAirportDatabase = activeAirportDatabase.filter((_, i) => i % stride === 0).slice(0, ${maxAirports});
            }`,
            sandbox
        );
    }

    if (options.seed != null) {
        let seed = Number(options.seed) >>> 0;
        sandbox.Math.random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return seed / 0x100000000;
        };
    }

    return {
        engine: sandbox,
        elements,
        alerts,
        confirms,
        root: ROOT
    };
}

export function listFleetTypes(engine) {
    return Object.keys(engine.coreFleetSpecs || {}).sort();
}

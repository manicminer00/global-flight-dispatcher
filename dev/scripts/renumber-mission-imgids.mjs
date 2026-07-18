/**
 * Audit and renumber mission imgIds in missions-db.js (consecutive 1..N by first
 * appearance top-to-bottom in scenarioDB). Renames matching missionXXX.jpg files.
 *
 * Usage:
 *   node scripts/renumber-mission-imgids.mjs --audit
 *   node scripts/renumber-mission-imgids.mjs --apply
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const MISSIONS_DB = path.join(ROOT, "missions-db.js");
const IMAGES_DIR = path.join(ROOT, "images-missions");

function loadMissionsDb() {
    const code = fs.readFileSync(MISSIONS_DB, "utf8");
    const sandbox = { globalThis: {} };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return {
        code,
        scenarioDB: sandbox.scenarioDB,
        missionMatrix: sandbox.missionMatrix,
        MIL_AIRLIFTER_CIVIL_BASE_SCENARIO_IMGIDS: sandbox.MIL_AIRLIFTER_CIVIL_BASE_SCENARIO_IMGIDS,
        MIL_AIRLIFTER_CIVIL_EXTRA_SCENARIO_BY_TYPE: sandbox.MIL_AIRLIFTER_CIVIL_EXTRA_SCENARIO_BY_TYPE,
        LONG_HAUL_SCENARIOS_BY_MISSION: sandbox.LONG_HAUL_SCENARIOS_BY_MISSION,
    };
}

/** scenarioDB pool order as declared in missions-db.js */
const POOL_ORDER = [
    "uniqueMissions",
    "commercial",
    "commercial-regional",
    "executive",
    "medical",
    "lightFreight",
    "regionalFreight",
    "heavyFreight",
    "surveyServices",
    "lightPax",
    "highAltServices",
    "vintageOps",
    "vintageProplinerFreight",
    "vintageAirliner",
    "helicopterOps-CIV",
    "heavyFreight-MIL",
    "helicopterOps-MIL",
    "militaryTransit-MIL",
    "tacticalJet-MIL",
    "reconnaissance-MIL",
    "gliderOps",
    "longHaulOps",
    "longHaulFreight",
    "longHaulExecutive",
    "longHaulFreight-MIL",
];

function walkScenarios(scenarioDB) {
    const entries = [];
    for (const pool of POOL_ORDER) {
        const arr = scenarioDB[pool];
        if (!arr) continue;
        arr.forEach((s, idx) => {
            entries.push({ pool, idx, imgId: s.imgId, payload: s.payload, instruction: s.instruction, missionType: s.missionType });
        });
    }
    return entries;
}

function buildMapping(entries) {
    const oldToNew = new Map();
    let next = 1;
    for (const e of entries) {
        if (!oldToNew.has(e.imgId)) {
            oldToNew.set(e.imgId, next++);
        }
    }
    return oldToNew;
}

function remapId(oldId, map) {
    return map.get(oldId) ?? oldId;
}

function remapArray(arr, map) {
    return arr.map((id) => remapId(id, map));
}

function remapObjectValues(obj, map) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        out[k] = remapArray(v, map);
    }
    return out;
}

function listMissionImages() {
    const files = new Set();
    function scan(dir) {
        if (!fs.existsSync(dir)) return;
        for (const name of fs.readdirSync(dir)) {
            const full = path.join(dir, name);
            if (fs.statSync(full).isDirectory()) scan(full);
            else {
                const m = name.match(/^mission(\d+)\.jpg$/i);
                if (m) files.add(parseInt(m[1], 10));
            }
        }
    }
    scan(IMAGES_DIR);
    return files;
}

function audit() {
    const { scenarioDB, missionMatrix } = loadMissionsDb();
    const entries = walkScenarios(scenarioDB);
    const oldToNew = buildMapping(entries);

    // Shared imgIds
    const byImgId = new Map();
    for (const e of entries) {
        if (!byImgId.has(e.imgId)) byImgId.set(e.imgId, []);
        byImgId.get(e.imgId).push(`${e.pool}[${e.idx}]`);
    }
    const sharedImgIds = [...byImgId.entries()].filter(([, locs]) => locs.length > 1);

    // Exact duplicates (payload + instruction)
    const byText = new Map();
    for (const e of entries) {
        const key = `${e.payload}\0${e.instruction}`;
        if (!byText.has(key)) byText.set(key, []);
        byText.get(key).push({ pool: e.pool, idx: e.idx, imgId: e.imgId });
    }
    const exactDuplicates = [...byText.entries()].filter(([, locs]) => locs.length > 1);

    // Referenced imgIds
    const referenced = new Set(oldToNew.keys());
    const images = listMissionImages();
    const orphanImages = [...images].filter((id) => !referenced.has(id)).sort((a, b) => a - b);
    const missingImages = [...referenced].filter((id) => !images.has(id)).sort((a, b) => a - b);

    // missionMatrix types
    const types = missionMatrix.map((m) => m.type);
    const typeWeights = missionMatrix
        .filter((m) => m.type >= 14 && m.type <= 39)
        .map((m) => ({ type: m.type, name: m.name, weight: m.weight ?? "(none)" }));

    return {
        totalScenarioRows: entries.length,
        uniqueImgIds: oldToNew.size,
        oldToNew: Object.fromEntries(oldToNew),
        sharedImgIds,
        exactDuplicates: exactDuplicates.map(([key, locs]) => ({
            payload: key.split("\0")[0],
            instruction: key.split("\0")[1],
            locations: locs,
        })),
        orphanImages,
        missingImages,
        types: { min: Math.min(...types), max: Math.max(...types), count: types.length },
        typeWeights,
        entries,
    };
}

function applyRenumber() {
    const report = audit();
    const { code } = loadMissionsDb();
    const map = new Map(Object.entries(report.oldToNew).map(([k, v]) => [parseInt(k, 10), v]));

    let updated = code;

    // Two-phase imgId replace avoids chaining (e.g. 213→11 then 11→14).
    const pairs = [...map.entries()].filter(([o, n]) => o !== n);
    for (const [oldId] of pairs) {
        const re = new RegExp(`(imgId:\\s*)${oldId}(?=[,\\s}])`, "g");
        updated = updated.replace(re, `$1__R${oldId}__`);
    }
    for (const [oldId, newId] of pairs) {
        updated = updated.replace(new RegExp(`imgId:\\s*__R${oldId}__`, "g"), `imgId: ${newId}`);
    }

    // MIL_AIRLIFTER arrays
    updated = updated.replace(
        /const MIL_AIRLIFTER_CIVIL_BASE_SCENARIO_IMGIDS = \[([^\]]+)\]/,
        (_, inner) => {
            const ids = inner.split(",").map((s) => parseInt(s.trim(), 10));
            return `const MIL_AIRLIFTER_CIVIL_BASE_SCENARIO_IMGIDS = [${remapArray(ids, map).join(", ")}]`;
        }
    );
    updated = updated.replace(
        /const MIL_AIRLIFTER_CIVIL_EXTRA_SCENARIO_BY_TYPE = \{([^}]+)\}/,
        (_, inner) => {
            const remapped = inner.replace(/(\w+):\s*\[([^\]]+)\]/g, (_, type, arr) => {
                const ids = arr.split(",").map((s) => parseInt(s.trim(), 10));
                return `${type}: [${remapArray(ids, map).join(", ")}]`;
            });
            return `const MIL_AIRLIFTER_CIVIL_EXTRA_SCENARIO_BY_TYPE = {${remapped}}`;
        }
    );

    // LONG_HAUL_SCENARIOS_BY_MISSION
    updated = updated.replace(
        /const LONG_HAUL_SCENARIOS_BY_MISSION = \{([\s\S]*?)\};/,
        (match, inner) => {
            const remappedInner = inner.replace(/(\d+):\s*\[([^\]]+)\]/g, (_, missionType, arr) => {
                const ids = arr.split(",").map((s) => parseInt(s.trim(), 10));
                return `${missionType}: [${remapArray(ids, map).join(", ")}]`;
            });
            return `const LONG_HAUL_SCENARIOS_BY_MISSION = {${remappedInner}};`;
        }
    );

    fs.writeFileSync(MISSIONS_DB, updated, "utf8");

    // Rename images — two-phase via temp names
    const images = listMissionImages();
    const renames = [];
    for (const [oldId, newId] of map) {
        if (oldId === newId) continue;
        const src = path.join(IMAGES_DIR, `mission${oldId}.jpg`);
        if (!fs.existsSync(src)) continue;
        renames.push({ oldId, newId, src });
    }

    const tmpPrefix = "__renumb_";
    const phase1 = [];
    for (const r of renames) {
        const tmp = path.join(IMAGES_DIR, `${tmpPrefix}${r.newId}.jpg`);
        fs.renameSync(r.src, tmp);
        phase1.push({ tmp, newId: r.newId, oldId: r.oldId });
    }
    for (const p of phase1) {
        const dest = path.join(IMAGES_DIR, `mission${p.newId}.jpg`);
        if (fs.existsSync(dest) && !dest.includes(tmpPrefix)) {
            // collision: existing file at destination that wasn't renamed away
            const backup = path.join(IMAGES_DIR, `${tmpPrefix}collision_${p.newId}.jpg`);
            fs.renameSync(dest, backup);
        }
        fs.renameSync(p.tmp, dest);
    }

    // dispatch-engine hardcoded 130
    const dispatchPath = path.join(ROOT, "dispatch-engine.js");
    let dispatch = fs.readFileSync(dispatchPath, "utf8");
    const old130New = map.get(130);
    if (old130New && old130New !== 130) {
        dispatch = dispatch.replace(/scenarioImgId === 130/g, `scenarioImgId === ${old130New}`);
        fs.writeFileSync(dispatchPath, dispatch, "utf8");
    }

    return { report, renames: renames.length, new130: old130New };
}

const mode = process.argv[2] || "--audit";
if (mode === "--audit") {
    const r = audit();
    console.log(JSON.stringify(r, null, 2));
} else if (mode === "--apply") {
    const result = applyRenumber();
    console.log(JSON.stringify({ applied: true, renames: result.renames, newImgIdForOld130: result.new130 }, null, 2));
} else {
    console.error("Use --audit or --apply");
    process.exit(1);
}

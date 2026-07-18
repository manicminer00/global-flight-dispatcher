/**
 * Apply SimBrief Edit Airframe data to fleet-db.js (primary profile per type).
 * Run: node scripts/apply-simbrief-fleet.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fleetFile = path.join(root, "fleet-db.js");

/** @type {Record<string, Partial<{mtow,oew,maxPax,maxCargo,minRunwayLength,maxAlt,maxD,fuelPerNm}>>} */
const updates = {
    A319: { mtow: 75500, oew: 41910, maxPax: 150, maxCargo: 6786, minRunwayLength: 7000, maxAlt: 39000, fuelPerNm: 5.1 },
    A320: { mtow: 73500, oew: 44029, maxPax: 180, maxCargo: 9440, minRunwayLength: 7000, maxAlt: 39800, fuelPerNm: 5.8 },
    A321: { mtow: 93500, oew: 49202, maxPax: 230, maxCargo: 11548, minRunwayLength: 7000, maxAlt: 39000, fuelPerNm: 5.8 },
    A346: { mtow: 368000, oew: 185500, maxPax: 440, maxCargo: 56811, minRunwayLength: 7000, maxAlt: 41500, fuelPerNm: 20.3 },
    A359: { mtow: 268000, oew: 141778, maxPax: 324, maxCargo: 42500, minRunwayLength: 7000, maxAlt: 43100, fuelPerNm: 13.6 },
    A388: { mtow: 510000, oew: 300007, maxPax: 484, minRunwayLength: 7000, maxAlt: 43000, fuelPerNm: 25 },
    B38M: { mtow: 82190, oew: 45069, maxPax: 189, maxCargo: 8328, minRunwayLength: 7000, maxAlt: 41000, fuelPerNm: 5.8 },
    B461: { mtow: 38102, oew: 24108, maxPax: 80, maxCargo: 2261, minRunwayLength: 7000, maxAlt: 31000, fuelPerNm: 6.4 },
    B461_MIL: { mtow: 38102, oew: 24108, maxPax: 15, maxCargo: 2268, minRunwayLength: 7000, maxAlt: 31000, fuelPerNm: 6.4 },
    B462: { mtow: 42184, oew: 24959, maxPax: 112, maxCargo: 2261, minRunwayLength: 7000, maxAlt: 31000, fuelPerNm: 6.7 },
    B462_QT: { mtow: 42184, oew: 24907, maxPax: 0, maxCargo: 10199, minRunwayLength: 7000, maxAlt: 31000, fuelPerNm: 6.7 },
    B462_MIL: { mtow: 42184, oew: 24959, maxPax: 0, maxCargo: 10199, minRunwayLength: 7000, maxAlt: 31000, fuelPerNm: 6.7 },
    B463: { mtow: 45133, oew: 26003, maxPax: 128, maxCargo: 2324, minRunwayLength: 7000, maxAlt: 31000, fuelPerNm: 6.9 },
    B463_QT: { mtow: 45132, oew: 25951, maxPax: 0, maxCargo: 10829, minRunwayLength: 7000, maxAlt: 31000, fuelPerNm: 6.9 },
    B722: { mtow: 78100, oew: 44330, maxPax: 189, maxCargo: 8626, minRunwayLength: 7000, maxAlt: 42000, fuelPerNm: 9.5 },
    B72F: { mtow: 88360, oew: 42298, maxPax: 0, maxCargo: 26300, minRunwayLength: 7000, maxAlt: 42000, fuelPerNm: 10.2 },
    B736: { mtow: 65771, oew: 37232, maxPax: 114, maxCargo: 5055, minRunwayLength: 4500, maxAlt: 41000, fuelPerNm: 6.5 },
    B737: { mtow: 70307, oew: 38487, maxPax: 124, maxCargo: 5180, minRunwayLength: 4500, maxAlt: 41000, fuelPerNm: 6.1 },
    B738: { mtow: 79333, oew: 42244, maxPax: 189, maxCargo: 8004, minRunwayLength: 7000, maxAlt: 41000, fuelPerNm: 6.7 },
    B738_BCF: { mtow: 79243, oew: 39641, maxPax: 0, maxCargo: 18131, minRunwayLength: 7000, maxAlt: 41000, fuelPerNm: 7.1 },
    B738_BDSF: { mtow: 79243, oew: 39641, maxPax: 0, maxCargo: 18131, minRunwayLength: 7000, maxAlt: 41000, fuelPerNm: 7.1 },
    B77W: { mtow: 352241, oew: 168591, maxPax: 370, maxCargo: 38254, minRunwayLength: 7000, maxAlt: 43000, fuelPerNm: 19.7 },
    C680: { mtow: 13954, oew: 8478, maxPax: 10, maxD: 3200, minRunwayLength: 3530, maxAlt: 47000, fuelPerNm: 1.6 },
    C700: { mtow: 17917, oew: 10609, maxPax: 10, minRunwayLength: 4900, maxAlt: 45000, fuelPerNm: 1.9 },
    C750: { mtow: 16375, oew: 10198, maxPax: 9, maxCargo: 352, maxD: 3100, minRunwayLength: 5140, maxAlt: 51000, fuelPerNm: 1.9 },
    CRJ7: { mtow: 34019, oew: 20750, maxPax: 70, maxCargo: 2437, minRunwayLength: 7000, maxAlt: 41000, fuelPerNm: 5.2 },
    E190: { mtow: 50299, oew: 27303, maxPax: 114, minRunwayLength: 6004, maxAlt: 41000, fuelPerNm: 5.4 },
    E195: { mtow: 50790, oew: 28663, maxPax: 124, minRunwayLength: 6535, maxAlt: 41000, fuelPerNm: 5.6 },
    F100: { mtow: 44452, oew: 24680, maxPax: 100, minRunwayLength: 7000, maxAlt: 35000, maxD: 1323, fuelPerNm: 8.1 },
    F28: { mtow: 33112, oew: 17611, maxPax: 85, maxCargo: 1928, minRunwayLength: 5490, maxAlt: 30000, maxD: 1240, fuelPerNm: 8.4 },
    F70: { mtow: 37984, oew: 22976, maxPax: 70, maxCargo: 2268, minRunwayLength: 5774, maxAlt: 35000, maxD: 1841, fuelPerNm: 5.9 },
    FA50: { mtow: 18497, oew: 10115, maxPax: 9, minRunwayLength: 4950, maxAlt: 45000, fuelPerNm: 2.3 },
    HDJT: { mtow: 4853, oew: 3318, maxPax: 6, minRunwayLength: 3934, maxAlt: 43000, fuelPerNm: 0.9 },
    LJ35: { mtow: 8301, oew: 4677, maxPax: 8, minRunwayLength: 4972, maxAlt: 45000, fuelPerNm: 1.4 },
    MD11: { mtow: 283721, oew: 128809, maxPax: 282, maxCargo: 98500, minRunwayLength: 7000, maxAlt: 43000, fuelPerNm: 16.9 },
    MD1F: { mtow: 283721, oew: 112748, maxPax: 0, maxCargo: 91670, minRunwayLength: 7000, maxAlt: 43000, fuelPerNm: 16.2 },
    MD82: { mtow: 67795, oew: 36830, maxPax: 162, maxCargo: 8518, minRunwayLength: 7000, maxAlt: 37000, fuelPerNm: 8.7 },
    MD88: { mtow: 72575, oew: 37556, maxPax: 162, maxCargo: 8518, minRunwayLength: 7000, maxAlt: 37000, fuelPerNm: 8.7 },
    P180: { mtow: 5239, oew: 3556, maxPax: 8, maxCargo: 200, minRunwayLength: 3260, maxAlt: 41000, fuelPerNm: 0.7 },
    RJ1H: { mtow: 46038, oew: 26003, maxPax: 112, maxCargo: 2261, minRunwayLength: 7000, maxAlt: 35000, fuelPerNm: 6.5 },
    RJ1F: { mtow: 44225, oew: 25948, maxPax: 0, maxCargo: 10826, minRunwayLength: 7000, maxAlt: 35000, fuelPerNm: 6.5 },
    RJ70: { mtow: 43091, oew: 24187, maxPax: 95, maxCargo: 2261, minRunwayLength: 7000, maxAlt: 35000, fuelPerNm: 6.7 },
    RJ85: { mtow: 43998, oew: 24959, maxPax: 112, maxCargo: 2261, minRunwayLength: 7000, maxAlt: 35000, fuelPerNm: 6.7 },
    SF50: { mtow: 2722, oew: 1692, maxPax: 5, minRunwayLength: 3192, maxAlt: 31000, fuelPerNm: 0.8 },
    STAR: { mtow: 6759, oew: 4574, maxPax: 6, maxD: 1575, minRunwayLength: 3955, maxAlt: 41000, fuelPerNm: 1.1 },
    E55P: { mtow: 8415, oew: 5150, maxD: 2077, minRunwayLength: 3138, fuelPerNm: 1.2 },
    BE20: { oew: 3869, minRunwayLength: 5700, fuelPerNm: 1 },
};

function loadFleet() {
    const code = fs.readFileSync(fleetFile, "utf8");
    const sandbox = {};
    vm.runInNewContext(code, sandbox, { filename: "fleet-db.js" });
    return { code, fleet: sandbox.coreFleetSpecs };
}

function patchSpec(spec, patch) {
    for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined && v !== null) spec[k] = v;
    }
}

const { code, fleet } = loadFleet();
const applied = [];
const missing = [];

for (const [type, patch] of Object.entries(updates)) {
    if (!fleet[type]) {
        missing.push(type);
        continue;
    }
    patchSpec(fleet[type], patch);
    applied.push(type);
}

const STRING_FIELDS = new Set(["name", "rules", "class", "simbriefIcao"]);

function fmtField(key, v) {
    if (key === "tags") {
        const tags = v || [];
        return `"tags":[${tags.map((t) => `"${t}"`).join(",")}]`;
    }
    if (typeof v === "boolean") return `"${key}":${v}`;
    if (typeof v === "number") return `"${key}":${v}`;
    if (typeof v === "string") return `"${key}":"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    return null;
}

function serializeSpec(type, spec) {
    const parts = [`"name":"${String(spec.name).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`];
    const order = [
        "simbriefIcao", "isMilitary", "isTactical", "maxPax", "maxCargo", "minD", "maxD",
        "minAlt", "maxAlt", "rules", "minRunwayLength", "class", "mtow", "oew", "fuelPerNm", "tags",
    ];
    for (const key of order) {
        if (key === "name") continue;
        if (spec[key] === undefined) continue;
        const formatted = fmtField(key, spec[key]);
        if (formatted) parts.push(formatted);
    }
    return `"${type}": {${parts.join(",")}}`;
}

const lines = ['const coreFleetSpecs = {'];
const entries = Object.entries(fleet).sort((a, b) =>
    String(a[1].name).localeCompare(String(b[1].name), "en", { sensitivity: "base" })
);
entries.forEach(([type, spec], i) => {
    lines.push(serializeSpec(type, spec) + (i < entries.length - 1 ? "," : ""));
});
lines.push("};");
lines.push('if (typeof globalThis !== "undefined") {');
lines.push("    globalThis.coreFleetSpecs = coreFleetSpecs;");
lines.push("}");

fs.writeFileSync(fleetFile, lines.join("\n") + "\n", "utf8");

console.log(`Applied SimBrief updates to ${applied.length} types.`);
if (missing.length) console.log("Missing fleet keys:", missing.join(", "));

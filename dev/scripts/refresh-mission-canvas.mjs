/**
 * Refresh mission-list.canvas.tsx ALL_MISSIONS from missions-db.js
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CANVAS = "C:\\Users\\toby2\\.cursor\\projects\\d-Project-VECTOR-VECTOR-DEVELOPMENT\\canvases\\mission-list.canvas.tsx";

const code = fs.readFileSync(path.join(ROOT, "missions-db.js"), "utf8");
const sandbox = { globalThis: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const POOL_ORDER = [
    "uniqueMissions", "commercial", "commercial-regional", "executive", "medical",
    "lightFreight", "regionalFreight", "heavyFreight", "surveyServices", "lightPax",
    "highAltServices", "vintageOps", "vintageProplinerFreight", "vintageAirliner",
    "helicopterOps-CIV", "heavyFreight-MIL", "helicopterOps-MIL", "militaryTransit-MIL",
    "tacticalJet-MIL", "reconnaissance-MIL", "gliderOps", "longHaulOps", "longHaulFreight",
    "longHaulExecutive", "longHaulFreight-MIL",
];

const POOL_LABELS = {
    uniqueMissions: "Unique",
    commercial: "Commercial",
    "commercial-regional": "Regional PAX",
    executive: "Executive",
    medical: "Medical",
    lightFreight: "Light Freight",
    regionalFreight: "Regional Freight",
    heavyFreight: "Heavy Freight",
    surveyServices: "Survey",
    lightPax: "Light PAX",
    highAltServices: "High Alt",
    vintageOps: "Vintage",
    vintageProplinerFreight: "Vintage Freight",
    vintageAirliner: "Vintage Airliner",
    "helicopterOps-CIV": "Heli CIV",
    "heavyFreight-MIL": "MIL Freight",
    "helicopterOps-MIL": "Heli MIL",
    "militaryTransit-MIL": "MIL Transit",
    "tacticalJet-MIL": "Tactical Jet",
    "reconnaissance-MIL": "Recon MIL",
    gliderOps: "Glider",
    longHaulOps: "LH Commercial",
    longHaulFreight: "LH Freight",
    longHaulExecutive: "LH Executive",
    "longHaulFreight-MIL": "LH MIL",
};

const typeByPool = {};
for (const m of sandbox.missionMatrix) {
    if (!typeByPool[m.pool] || m.type < typeByPool[m.pool]) typeByPool[m.pool] = m.type;
}

const missions = [];
for (const pool of POOL_ORDER) {
    const arr = sandbox.scenarioDB[pool];
    if (!arr) continue;
    for (const s of arr) {
        missions.push({
            pool,
            poolLabel: POOL_LABELS[pool] || pool,
            typeFirst: typeByPool[pool] ?? 0,
            imgId: s.imgId,
            payload: s.payload,
        });
    }
}

const missionLines = missions.map((m) => {
    const payload = m.payload.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `  { pool:"${m.pool}", poolLabel:"${m.poolLabel}", typeFirst:${m.typeFirst}, imgId:${m.imgId}, payload:"${payload}" },`;
});

const canvas = fs.readFileSync(CANVAS, "utf8");
const start = canvas.indexOf("const ALL_MISSIONS: Mission[] = [");
const end = canvas.indexOf("];", start) + 2;
if (start < 0 || end < 2) throw new Error("Could not find ALL_MISSIONS block");

const uniqueCount = new Set(missions.map((m) => m.imgId)).size;
const updated = canvas.slice(0, start)
    + `const ALL_MISSIONS: Mission[] = [\n`
    + missionLines.join("\n")
    + "\n];"
    + canvas.slice(end)
        .replace(
            /types 1–10 unique \+ scenario pools/,
            `types 1–13 unique + scenario pools (imgIds 1–${uniqueCount})`
        )
        .replace(
            /<Stat value=\{10\}\s+label="Unique missions \(1–10\)" \/>/,
            `<Stat value={13}                      label="Unique missions (1–13)" />`
        );

fs.writeFileSync(CANVAS, updated, "utf8");
console.log(`Updated canvas: ${missions.length} entries, ${uniqueCount} unique imgIds`);

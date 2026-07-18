import { readFileSync } from "fs";

const text = readFileSync("airports-asobo-db.js", "utf8");
const lines = text.split("\n");

const GLIDER_NAME = /\b(Glider|Gliding|Soaring|Segelflug)\b/i;
const UL_NAME = /\b(Ultralight| UL\b)\b/i;
const US_LOCAL = /^[0-9]/;
const GA_DEMOTE_NAME = /\b(Municipal|County|Memorial|Airfield|Airstrip|Farm|Grass|Private|Ultralight| UL\b)\b/i;

const detailed = [];
const gliderSection = new Set();

let inGlider = false;
for (const line of lines) {
    if (line.includes("// --- Gliderports ---")) inGlider = true;
    if (line.includes("// --- Hand-crafted ---")) inGlider = false;
    if (!line.includes('tag: "Asobo Detailed Airports"')) continue;
    const m = line.match(/icao: "([^"]+)".*name: "([^"]+)".*rwy: "([^"]+)".*length: (\d+)/);
    if (!m) continue;
    detailed.push({ icao: m[1], name: m[2], rwy: m[3], length: Number(m[4]), line });
}

for (const line of lines) {
    if (!line.includes('tag: "Asobo Gliderport"') && !line.match(/rwy: "GLIDER"/)) continue;
    const icao = line.match(/icao: "([^"]+)"/);
    if (icao) gliderSection.add(icao[1]);
}

const suspects = {
    gliderNameWrongRwy: [],
    turboTooSmall: [],
    bizJetDetailed: [],
    inGliderSectionToo: [],
};

for (const ap of detailed) {
    if (GLIDER_NAME.test(ap.name) && ap.rwy !== "GLIDER") {
        suspects.gliderNameWrongRwy.push(ap);
    }
    if (UL_NAME.test(ap.name) && ap.rwy === "JET") {
        suspects.gliderNameWrongRwy.push(ap);
    }
    if (ap.rwy === "TURBO" && ap.length < 4500) {
        suspects.turboTooSmall.push(ap);
    }
    if (ap.rwy === "BIZ JET") {
        suspects.bizJetDetailed.push(ap);
    }
    if (gliderSection.has(ap.icao)) {
        suspects.inGliderSectionToo.push(ap);
    }
}

console.log("Detailed airports:", detailed.length);
console.log("\n=== Glider/UL name but rwy != GLIDER ===");
suspects.gliderNameWrongRwy.forEach((a) => console.log(`  ${a.icao} ${a.name} rwy=${a.rwy} ${a.length}ft`));

console.log("\n=== TURBO tagged, length < 4500 ft (likely GA grass) ===");
suspects.turboTooSmall.forEach((a) => console.log(`  ${a.icao} ${a.name} ${a.length}ft`));

console.log("\n=== BIZ JET in detailed (review) ===");
suspects.bizJetDetailed.forEach((a) => console.log(`  ${a.icao} ${a.name} ${a.length}ft`));

console.log("\n=== Duplicated in glider section ===");
suspects.inGliderSectionToo.forEach((a) => console.log(`  ${a.icao} ${a.name}`));

const errors = [];
for (const ap of detailed) {
    if (GLIDER_NAME.test(ap.name) && ap.rwy !== "GLIDER") {
        errors.push(`${ap.icao}: glider name but rwy=${ap.rwy}`);
    }
    if (ap.rwy === "BIZ JET" && ap.length < 5500 && !/\b(International|Regional)\b/i.test(ap.name)) {
        errors.push(`${ap.icao}: BIZ JET on small detailed strip (${ap.length}ft)`);
    }
    if (ap.rwy === "TURBO" && ap.length < 4500 && US_LOCAL.test(ap.icao) && GA_DEMOTE_NAME.test(ap.name)) {
        errors.push(`${ap.icao}: US municipal TURBO (${ap.length}ft)`);
    }
}
if (errors.length) {
    console.log("\n=== VERIFY FAILURES ===");
    errors.forEach((e) => console.log(" ", e));
    process.exit(1);
}
console.log("\nAudit OK — no high-confidence tagging errors in detailed list.");

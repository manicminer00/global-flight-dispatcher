/**
 * Cross-check airports-thirdparty-db.js runway lengths vs OurAirports (max length_ft per ICAO).
 * Usage:
 *   node scripts/audit-thirdparty-runways.mjs           # report only
 *   node scripts/audit-thirdparty-runways.mjs --fix     # apply safe increases (VECTOR < ref, diff >= 150ft)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { createWriteStream } from "fs";
import https from "https";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DB_PATH = path.join(ROOT, "airports-thirdparty-db.js");
const CACHE_DIR = path.join(ROOT, "dev", "scripts", ".cache");
const RUNWAYS_CSV = path.join(CACHE_DIR, "ourairports-runways.csv");
const AIRPORTS_CSV = path.join(CACHE_DIR, "ourairports-airports.csv");
const MIN_FIX_DELTA = 150;

const OURLS = {
    runways: "https://davidmegginson.github.io/ourairports-data/runways.csv",
    airports: "https://davidmegginson.github.io/ourairports-data/airports.csv",
};

function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = createWriteStream(dest);
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            res.pipe(file);
            file.on("finish", () => file.close(() => resolve()));
        }).on("error", reject);
    });
}

async function ensureOurAirportsData() {
    mkdirSync(CACHE_DIR, { recursive: true });
    if (!existsSync(RUNWAYS_CSV)) {
        process.stderr.write("Downloading OurAirports runways.csv...\n");
        await download(OURLS.runways, RUNWAYS_CSV);
    }
    if (!existsSync(AIRPORTS_CSV)) {
        process.stderr.write("Downloading OurAirports airports.csv...\n");
        await download(OURLS.airports, AIRPORTS_CSV);
    }
}

function parseCsvLine(line) {
    const out = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            inQ = !inQ;
            continue;
        }
        if (c === "," && !inQ) {
            out.push(cur);
            cur = "";
            continue;
        }
        cur += c;
    }
    out.push(cur);
    return out;
}

function loadOurAirportsMaxRunwayFt() {
    const airportText = readFileSync(AIRPORTS_CSV, "utf8").trim().split("\n");
    const airportHeader = parseCsvLine(airportText[0]);
    const identIdx = airportHeader.indexOf("ident");
    const icaoIdx = airportHeader.indexOf("icao_code");
    const gpsIdx = airportHeader.indexOf("gps_code");
    const identToIcao = new Map();
    for (let i = 1; i < airportText.length; i++) {
        const cols = parseCsvLine(airportText[i]);
        const ident = (cols[identIdx] || "").trim().toUpperCase();
        const icao = (cols[icaoIdx] || "").trim().toUpperCase();
        const gps = (cols[gpsIdx] || "").trim().toUpperCase();
        if (ident) identToIcao.set(ident, icao || gps || ident);
    }

    const runwayText = readFileSync(RUNWAYS_CSV, "utf8").trim().split("\n");
    const rwyHeader = parseCsvLine(runwayText[0]);
    const apIdentIdx = rwyHeader.indexOf("airport_ident");
    const lenIdx = rwyHeader.indexOf("length_ft");
    const maxByIcao = new Map();

    for (let i = 1; i < runwayText.length; i++) {
        const cols = parseCsvLine(runwayText[i]);
        const ident = (cols[apIdentIdx] || "").trim().toUpperCase();
        const len = Number(cols[lenIdx]);
        if (!ident || !Number.isFinite(len) || len <= 0) continue;
        const icao = identToIcao.get(ident) || ident;
        const prev = maxByIcao.get(icao) || 0;
        if (len > prev) maxByIcao.set(icao, Math.round(len));
    }
    return maxByIcao;
}

function parseThirdPartyDb() {
    const text = readFileSync(DB_PATH, "utf8");
    const entries = [];
    const re = /^\{ icao: "([^"]+)", name: "([^"]+)", rwy: "([^"]+)", length: (\d+),/gm;
    let m;
    while ((m = re.exec(text))) {
        entries.push({ icao: m[1].toUpperCase(), name: m[2], rwy: m[3], length: Number(m[4]) });
    }
    const byIcao = new Map();
    for (const e of entries) {
        if (!byIcao.has(e.icao)) byIcao.set(e.icao, e);
    }
    return { text, entries, byIcao };
}

function main() {
    const doFix = process.argv.includes("--fix");
    ensureOurAirportsData().then(() => {
        const ref = loadOurAirportsMaxRunwayFt();
        const { text, byIcao } = parseThirdPartyDb();

        const mismatches = [];
        const noRef = [];
        for (const [icao, e] of byIcao) {
            const refLen = ref.get(icao);
            if (!refLen) {
                noRef.push(icao);
                continue;
            }
            const delta = refLen - e.length;
            if (Math.abs(delta) >= MIN_FIX_DELTA) {
                mismatches.push({ icao, name: e.name, vector: e.length, ref: refLen, delta });
            }
        }

        mismatches.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

        const fixable = mismatches.filter((m) => {
            if (m.delta < MIN_FIX_DELTA) return false;
            const e = byIcao.get(m.icao);
            if (e && e.rwy === "HELI") return false;
            if (m.delta > 2500) return false;
            return true;
        });
        console.log(`Unique third-party ICAOs: ${byIcao.size}`);
        console.log(`OurAirports reference: ${byIcao.size - noRef.length} matched, ${noRef.length} no ref (US LID / MSFS codes)`);
        console.log(`Length mismatches (>= ${MIN_FIX_DELTA} ft): ${mismatches.length}`);
        console.log(`Safe auto-fix (VECTOR shorter than ref): ${fixable.length}\n`);

        for (const m of mismatches) {
            const tag = m.delta > 0 ? "SHORT" : "LONG";
            console.log(`${m.icao} ${m.name}: VECTOR ${m.vector} vs ref ${m.ref} (${tag} ${Math.abs(m.delta)}ft)`);
        }

        if (!doFix) {
            if (fixable.length) console.log(`\nRe-run with --fix to apply ${fixable.length} increases.`);
            return;
        }

        let out = text;
        let fixCount = 0;
        for (const m of fixable) {
            const re = new RegExp(
                `(\\{ icao: "${m.icao}", name: "[^"]+", rwy: "[^"]+", length: )${m.vector}(,)`,
                "g"
            );
            const before = out;
            out = out.replace(re, `$1${m.ref}$2`);
            if (out !== before) fixCount++;
        }
        writeFileSync(DB_PATH, out, "utf8");
        console.log(`\nApplied ${fixCount} ICAO length updates to airports-thirdparty-db.js`);
    }).catch((err) => {
        console.error(err);
        process.exit(1);
    });
}

main();

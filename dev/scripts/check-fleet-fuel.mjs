/**
 * Tier 1 fleet fuelPerNm plausibility checks (fleet-db.js).
 * Run: node scripts/check-fleet-fuel.mjs
 * Exit code 1 if any ERROR; warnings print but do not fail.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const fleetFile = path.join(root, "fleet-db.js");

const STRUCTURAL_FUEL_FRACTION = 0.8;
const MAXD_VS_IMPLIED_HIGH = 1.15;
const MAXD_VS_IMPLIED_LOW = 0.6;
/** Below this fraction of variable weight, maxD×fuel is plausible with payload + tanks. */
const JET_FUEL_AT_MAXD_HIGH_PCT = 85;

const CLASS_FUEL_BANDS = {
    GA: { min: 0.05, max: 6.5 },
    TURBO: { min: 0.3, max: 14 },
    "BIZ JET": { min: 0.5, max: 4 },
    JET: { min: 1.5, max: 30 },
    WARBIRD: { min: 0.4, max: 5 },
    HELI: { min: 0.2, max: 10 },
    GLIDER: { min: 0, max: 0.2 },
};

function loadFleet() {
    const code = fs.readFileSync(fleetFile, "utf8");
    const sandbox = {};
    vm.runInNewContext(code, sandbox, { filename: "fleet-db.js" });
    return sandbox.coreFleetSpecs || {};
}

function impliedRangeNm(spec) {
    const mtow = Number(spec.mtow) || 0;
    const oew = Number(spec.oew) || 0;
    const fuelPerNm = Number(spec.fuelPerNm) || 0;
    if (fuelPerNm <= 0) return null;
    return (mtow - oew) / fuelPerNm;
}

function auditFleet(fleet) {
    const errors = [];
    const warnings = [];

    function err(type, msg) {
        errors.push({ type, msg });
    }
    function warn(type, msg) {
        warnings.push({ type, msg });
    }

    const bySimbrief = new Map();
    const byWeightSignature = new Map();

    for (const [type, spec] of Object.entries(fleet)) {
        const label = `${type} (${spec.name || "?"})`;
        const acClass = spec.class || "UNKNOWN";
        const fuel = spec.fuelPerNm;
        const maxD = Number(spec.maxD) || 0;
        const mtow = Number(spec.mtow) || 0;
        const oew = Number(spec.oew) || 0;
        const variableWeight = mtow - oew;

        if (fuel === undefined || fuel === null || Number.isNaN(Number(fuel))) {
            err("missing_fuel", `${label}: fuelPerNm is missing`);
            continue;
        }

        if (acClass !== "GLIDER" && Number(fuel) <= 0) {
            err("invalid_fuel", `${label}: fuelPerNm must be > 0 (class ${acClass})`);
        }

        if (acClass === "GLIDER" && Number(fuel) < 0) {
            err("invalid_fuel", `${label}: fuelPerNm cannot be negative`);
        }

        if (acClass !== "GLIDER" && maxD > 0 && variableWeight > 0 && Number(fuel) > 0) {
            const fuelAtMaxD = maxD * Number(fuel);
            if (fuelAtMaxD > variableWeight) {
                err(
                    "structural_range",
                    `${label}: maxD×fuelPerNm (${maxD}×${fuel}=${fuelAtMaxD.toFixed(0)} kg) exceeds mtow−oew (${variableWeight.toFixed(0)} kg) — cannot reach maxD even with zero payload`
                );
            } else if (fuelAtMaxD > variableWeight * STRUCTURAL_FUEL_FRACTION) {
                warn(
                    "structural_range_tight",
                    `${label}: maxD×fuelPerNm uses ${((fuelAtMaxD / variableWeight) * 100).toFixed(0)}% of variable weight for fuel alone (${fuelAtMaxD.toFixed(0)}/${variableWeight.toFixed(0)} kg)`
                );
            }

            const implied = impliedRangeNm(spec);
            if (implied !== null && maxD > implied * MAXD_VS_IMPLIED_HIGH) {
                warn(
                    "maxd_vs_implied_high",
                    `${label}: maxD ${maxD} nm exceeds implied range ${implied.toFixed(0)} nm by >${((MAXD_VS_IMPLIED_HIGH - 1) * 100).toFixed(0)}% (mtow−oew)/fuelPerNm — maxD or fuelPerNm may be inconsistent`
                );
            }
            const fuelAtMaxDPct = (fuelAtMaxD / variableWeight) * 100;
            const lowImpliedApplies = ["GA", "TURBO", "WARBIRD", "HELI"].includes(acClass);
            if (lowImpliedApplies && implied !== null && maxD < implied * MAXD_VS_IMPLIED_LOW) {
                warn(
                    "maxd_vs_implied_low",
                    `${label}: maxD ${maxD} nm is far below implied range ${implied.toFixed(0)} nm — fuelPerNm may be high or maxD conservative`
                );
            }
            if ((acClass === "JET" || acClass === "BIZ JET") && fuelAtMaxDPct > JET_FUEL_AT_MAXD_HIGH_PCT) {
                warn(
                    "jet_fuel_at_maxd_high",
                    `${label}: at maxD, trip fuel alone is ${fuelAtMaxDPct.toFixed(0)}% of mtow−oew — likely tight vs tank capacity and payload (Tier 2 SimBrief check recommended)`
                );
            }
        }

        const band = CLASS_FUEL_BANDS[acClass];
        if (band && acClass !== "GLIDER" && Number(fuel) > 0) {
            if (Number(fuel) < band.min || Number(fuel) > band.max) {
                warn(
                    "class_band",
                    `${label}: fuelPerNm ${fuel} outside typical ${acClass} band (${band.min}–${band.max} kg/nm)`
                );
            }
        } else if (!band && acClass !== "GLIDER") {
            warn("unknown_class", `${label}: unknown class "${acClass}" — no fuel band check`);
        }

        const sim = spec.simbriefIcao || type;
        if (!bySimbrief.has(sim)) bySimbrief.set(sim, []);
        bySimbrief.get(sim).push({ type, fuel: Number(fuel), label });

        const sig = `${acClass}|${mtow}|${oew}`;
        if (!byWeightSignature.has(sig)) byWeightSignature.set(sig, []);
        byWeightSignature.get(sig).push({ type, fuel: Number(fuel), label });
    }

    for (const [sim, entries] of bySimbrief) {
        const fuels = [...new Set(entries.map((e) => e.fuel))];
        if (entries.length > 1 && fuels.length > 1) {
            const detail = entries.map((e) => `${e.type}=${e.fuel}`).join(", ");
            warn(
                "simbrief_sibling",
                `simbriefIcao ${sim}: fuelPerNm differs across variants — ${detail}`
            );
        }
    }

    for (const [, entries] of byWeightSignature) {
        const fuels = [...new Set(entries.map((e) => e.fuel))];
        if (entries.length > 1 && fuels.length > 1) {
            const detail = entries.map((e) => `${e.type}=${e.fuel}`).join(", ");
            warn(
                "weight_sibling",
                `Same class/mtow/oew, different fuelPerNm — ${detail}`
            );
        }
    }

    return { errors, warnings };
}

function printReport(fleet, { errors, warnings }, verbose) {
    if (errors.length) {
        console.log(`Fleet fuel check FAILED — ${errors.length} error(s):`);
        errors.forEach((e) => console.log(`  • [${e.type}] ${e.msg}`));
        return;
    }
    if (verbose) {
        const jets = Object.entries(fleet).filter(([, s]) => s.class === "JET" || s.class === "BIZ JET");
        console.log("=".repeat(60));
        console.log("Fleet fuelPerNm — Tier 1 plausibility checks");
        console.log("=".repeat(60));
        console.log(`Aircraft audited: ${Object.keys(fleet).length}`);
        console.log(`JET + BIZ JET:     ${jets.length}`);
        console.log("ERRORS: none");
        if (warnings.length) {
            console.log(`WARNINGS (${warnings.length}):`);
            warnings.forEach((w) => console.log(`  • [${w.type}] ${w.msg}`));
        }
        return;
    }
    console.log(`Fleet fuel check: PASS (${Object.keys(fleet).length} aircraft, ${warnings.length} advisory warnings — use --verbose to list)`);
}

function writeTier2Template(fleet, outPath) {
    const rows = [["type", "name", "class", "simbriefIcao", "fuelPerNm_current", "maxD_nm", "route_nm", "trip_fuel_kg", "block_fuel_kg", "notes"]];
    Object.entries(fleet)
        .filter(([, s]) => s.class === "JET" || s.class === "BIZ JET")
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([type, spec]) => {
            rows.push([
                type,
                spec.name || "",
                spec.class || "",
                spec.simbriefIcao || type,
                String(spec.fuelPerNm ?? ""),
                String(spec.maxD ?? ""),
                "",
                "",
                "",
                "",
            ]);
        });
    writeCsv(outPath, rows);
}

function writeTier2Families(fleet, outPath) {
    const jets = Object.entries(fleet).filter(([, s]) => s.class === "JET" || s.class === "BIZ JET");
    const byFamily = new Map();
    for (const [type, spec] of jets) {
        const family = spec.simbriefIcao || type;
        const prev = byFamily.get(family);
        if (!prev || (Number(spec.maxD) || 0) > (Number(prev.spec.maxD) || 0)) {
            byFamily.set(family, { type, spec });
        }
    }
    const rows = [
        [
            "simbrief_family",
            "vector_type_example",
            "name",
            "class",
            "fuelPerNm_current",
            "maxD_nm",
            "short_route_nm",
            "short_trip_kg",
            "short_block_kg",
            "long_route_nm",
            "long_trip_kg",
            "long_block_kg",
            "notes",
        ],
    ];
    [...byFamily.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([family, { type, spec }]) => {
            rows.push([
                family,
                type,
                spec.name || "",
                spec.class || "",
                String(spec.fuelPerNm ?? ""),
                String(spec.maxD ?? ""),
                "",
                "",
                "",
                "",
                "",
                "",
                "",
            ]);
        });
    writeCsv(outPath, rows);
}

function writeCsv(outPath, rows) {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    fs.writeFileSync(outPath, csv + "\n", "utf8");
}

const fleet = loadFleet();
const result = auditFleet(fleet);
const verbose = process.argv.includes("--verbose");
printReport(fleet, result, verbose);

if (!verbose) {
    if (result.errors.length > 0) process.exit(1);
    process.exit(0);
}

const tier2Path = path.join(root, "dev", "scripts", "fleet-fuel-tier2-template.csv");
const tier2FamiliesPath = path.join(root, "dev", "scripts", "fleet-fuel-tier2-families.csv");
writeTier2Template(fleet, tier2Path);
writeTier2Families(fleet, tier2FamiliesPath);
console.log(`Tier 2 template (all types):  ${tier2Path}`);
console.log(`Tier 2 families (deduped):    ${tier2FamiliesPath}`);
console.log("Use families CSV first — one SimBrief profile per row. Fill trip/block from OFPs.");
console.log("");

if (result.errors.length > 0) {
    process.exit(1);
}

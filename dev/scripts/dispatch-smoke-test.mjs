#!/usr/bin/env node
/**
 * Automated dispatch engine smoke test + static audit.
 *
 * Usage:
 *   node scripts/dispatch-smoke-test.mjs              # quick (default)
 *   node scripts/dispatch-smoke-test.mjs --matrix       # contractor / mil / long-haul presets too
 *   node scripts/dispatch-smoke-test.mjs --static-only  # fleet/mission rules only (fast)
 *   node scripts/dispatch-smoke-test.mjs --aircraft A400
 *   node scripts/dispatch-smoke-test.mjs --seed 42
 */

import { loadDispatchEngine, listFleetTypes } from "./load-engine.mjs";

const SLIDER_VALUES = [40, 60, 80, 100, 120];
const ROUTING_SCOPES = ["worldwide", "americas", "row"];

function parseArgs(argv) {
    const opts = {
        mode: "quick",
        aircraft: null,
        seed: null,
        staticOnly: false,
        fullAirports: false,
        verbose: false
    };
    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === "--full") opts.mode = "full";
        else if (arg === "--matrix") opts.mode = "matrix";
        else if (arg === "--quick") opts.mode = "quick";
        else if (arg === "--static-only") opts.staticOnly = true;
        else if (arg === "--verbose" || arg === "-v") opts.verbose = true;
        else if (arg === "--aircraft" && argv[i + 1]) opts.aircraft = argv[++i].toUpperCase();
        else if (arg === "--seed" && argv[i + 1]) opts.seed = Number(argv[++i]);
        else if (arg === "--full-airports") opts.fullAirports = true;
    }
    return opts;
}

function buildOptionMatrix(mode) {
    if (mode === "quick") {
        return [
            { label: "baseline", targetMins: 60, longHaul: false, contractor: false, militaryBases: false, preferOwned: false, routingScope: "worldwide" }
        ];
    }
    if (mode === "matrix") {
        return [
            { label: "baseline", targetMins: 60, longHaul: false, contractor: false, militaryBases: false, preferOwned: false, routingScope: "worldwide" },
            { label: "contractor", targetMins: 60, longHaul: false, contractor: true, militaryBases: false, preferOwned: false, routingScope: "worldwide" },
            { label: "mil-bases", targetMins: 60, longHaul: false, contractor: false, militaryBases: true, preferOwned: false, routingScope: "worldwide" },
            { label: "long-haul", targetMins: 60, longHaul: true, contractor: false, militaryBases: false, preferOwned: false, routingScope: "worldwide" }
        ];
    }
    const matrix = [];
    for (const targetMins of SLIDER_VALUES) {
        for (const routingScope of ROUTING_SCOPES) {
            for (const contractor of [false, true]) {
                for (const militaryBases of [false, true]) {
                    for (const longHaul of [false, true]) {
                        matrix.push({
                            label: `t${targetMins}-${routingScope}-c${contractor ? 1 : 0}-m${militaryBases ? 1 : 0}-lh${longHaul ? 1 : 0}`,
                            targetMins,
                            longHaul,
                            contractor,
                            militaryBases,
                            preferOwned: false,
                            routingScope
                        });
                    }
                }
            }
        }
    }
    return matrix;
}

function runStaticAudit(engine) {
    const issues = [];
    const {
        coreFleetSpecs,
        missionMatrix,
        scenarioDB,
        passesHardMissionLocks,
        isMilitaryMissionRestricted,
        passesAircraftCivilMissionAllowlist,
        MIL_AIRLIFTER_CIVIL_TYPES,
        getMilAirlifterCivilScenarioImgIds
    } = engine;

    const types = Object.keys(coreFleetSpecs).sort();
    const imgIdsInPools = new Set();
    Object.values(scenarioDB || {}).forEach(pool => {
        if (!Array.isArray(pool)) return;
        pool.forEach(s => {
            if (s && s.imgId != null) imgIdsInPools.add(s.imgId);
        });
    });

    for (const type of types) {
        const spec = coreFleetSpecs[type];
        const searchClass = spec.class || "GA";
        const origin = { icao: "", isMilitary: false };

        const eligibleTemplates = missionMatrix.filter(m => {
            if (!passesHardMissionLocks(m, type, searchClass, spec, origin, false)) return false;
            if (!passesAircraftCivilMissionAllowlist(m, type, spec)) return false;
            if (m.excludedTags && spec.tags && m.excludedTags.some(tag => spec.tags.includes(tag))) return false;
            if (m.requiredTags && (!spec.tags || !m.requiredTags.every(tag => spec.tags.includes(tag)))) return false;
            if (m.civilianOnly && spec.isMilitary) return false;
            if (m.militaryOnly && !spec.isMilitary) return false;
            if (!m.militaryOnly && engine.isMilitaryMissionRestricted(spec)) return false;
            if (engine.isMilitaryHelicopterMission(m) && spec.class !== "HELI") return false;
            if (m.tacticalOnly && !spec.isTactical) return false;
            return true;
        });

        if (eligibleTemplates.length === 0) {
            issues.push({
                severity: "error",
                code: "no_mission_templates",
                aircraft: type,
                message: `${type} matches no mission templates in the database (fleet/mission matrix mismatch).`
            });
        }

        if (spec.isMilitary && engine.isMilitaryMissionRestricted(spec)) {
            const civ = eligibleTemplates.filter(m => !m.militaryOnly);
            if (civ.length > 0) {
                issues.push({
                    severity: "error",
                    code: "restricted_mil_has_civilian_templates",
                    aircraft: type,
                    message: `${type} is military-restricted but can access civilian templates: ${civ.map(m => m.name).join(", ")}`
                });
            }
        }

        if (Array.isArray(MIL_AIRLIFTER_CIVIL_TYPES) && MIL_AIRLIFTER_CIVIL_TYPES.includes(type)
            && typeof getMilAirlifterCivilScenarioImgIds === "function") {
            const civTemplates = eligibleTemplates.filter(m => !m.militaryOnly);
            const badCiv = civTemplates.filter(m => m.type !== 18);
            if (badCiv.length) {
                issues.push({
                    severity: "error",
                    code: "mil_airlifter_civilian_template_violation",
                    aircraft: type,
                    message: `${type} may only use Heavy Cargo Transport (type 18) for civilian work; also matched: ${badCiv.map(m => m.name).join(", ")}`
                });
            }
            const heavyPool = scenarioDB.heavyFreight || [];
            const allowed = new Set(getMilAirlifterCivilScenarioImgIds(type));
            heavyPool.forEach(s => {
                if (s.excludedAircraft && s.excludedAircraft.includes(type)) return;
                if (!allowed.has(s.imgId)) {
                    issues.push({
                        severity: "error",
                        code: "mil_airlifter_scenario_not_excluded",
                        aircraft: type,
                        message: `heavyFreight imgId ${s.imgId} ("${s.payload}") is not in ${type} allowlist and not excludedAircraft.`
                    });
                }
            });
        }
    }

    missionMatrix.forEach(m => {
        if (!m.pool) return;
        if (!scenarioDB[m.pool] && m.pool !== "uniqueMissions") {
            issues.push({
                severity: "error",
                code: "missing_scenario_pool",
                message: `Mission type ${m.type} (${m.name}) references missing pool "${m.pool}".`
            });
        }
    });

    return issues;
}

function checkProbeInvariants(engine, result, config) {
    const flaws = [];
    const { MIL_AIRLIFTER_CIVIL_TYPES, getMilAirlifterCivilScenarioImgIds } = engine;

    if (result.ok) {
        if (result.chosenMission && !result.chosenMission.militaryOnly
            && Array.isArray(MIL_AIRLIFTER_CIVIL_TYPES)
            && MIL_AIRLIFTER_CIVIL_TYPES.includes(config.aircraftType)) {
            if (result.chosenMission.type !== 18) {
                flaws.push({
                    severity: "error",
                    code: "mil_airlifter_wrong_civilian_mission",
                    aircraft: config.aircraftType,
                    message: `${config.aircraftType} dispatched civilian mission type ${result.chosenMission.type} (${result.chosenMission.name}).`
                });
            }
            const allowlist = typeof getMilAirlifterCivilScenarioImgIds === "function"
                ? getMilAirlifterCivilScenarioImgIds(config.aircraftType)
                : null;
            if (result.scenarioImgId && allowlist && !allowlist.includes(result.scenarioImgId)) {
                flaws.push({
                    severity: "error",
                    code: "mil_airlifter_wrong_civilian_scenario",
                    aircraft: config.aircraftType,
                    message: `${config.aircraftType} civilian scenario imgId ${result.scenarioImgId} is outside the allowlist.`
                });
            }
        }
        if ((result.candidatePairCount || 0) > 0 && (result.filteredMissionCount || 0) === 0) {
            flaws.push({
                severity: "error",
                code: "routes_without_missions",
                aircraft: config.aircraftType,
                message: `${config.aircraftType}: routes found but mission list was empty before fail (internal inconsistency).`
            });
        }
    } else if (result.reason === "no_missions" && (result.candidatePairCount || 0) > 0) {
        flaws.push({
            severity: "error",
            code: "routes_but_no_missions",
            aircraft: config.aircraftType,
            message: `${config.aircraftType}: ${result.candidatePairCount} route(s) ${result.origin || "?"}->${result.destination || "?"} but no valid missions (${config.label}).`
        });
    }

    return flaws;
}

function runDispatchMatrix(engine, types, matrix, verbose) {
    const results = {
        total: 0,
        success: 0,
        failures: new Map(),
        logicFlaws: [],
        samples: []
    };

    for (const aircraftType of types) {
        const spec = engine.coreFleetSpecs[aircraftType];
        if (verbose) process.stdout.write(`  ${aircraftType}...\n`);
        for (const opt of matrix) {
            if (opt.longHaul && !engine.canAircraftUseLongHaulMode(spec, aircraftType)) {
                continue;
            }
            results.total++;
            const probeConfig = {
                aircraftType,
                targetMins: opt.targetMins,
                callsign: "TEST",
                depOverride: "",
                isContractorMode: opt.contractor,
                militaryBasesToggle: opt.militaryBases,
                preferOwned: opt.preferOwned,
                longHaulRequested: opt.longHaul,
                routingScope: opt.routingScope,
                mutateHistory: false
            };
            probeConfig.label = opt.label;

            const result = engine.probeDispatchFlight(probeConfig);
            if (result.ok) {
                results.success++;
                results.logicFlaws.push(...checkProbeInvariants(engine, result, probeConfig));
            } else {
                const key = result.reason || "unknown";
                if (!results.failures.has(key)) results.failures.set(key, []);
                results.failures.get(key).push({
                    aircraft: aircraftType,
                    label: opt.label,
                    message: result.message
                });
                results.logicFlaws.push(...checkProbeInvariants(engine, result, probeConfig));
            }
        }
    }

    return results;
}

function printReport(staticIssues, dispatchResults, opts) {
    const logicErrors = (dispatchResults && dispatchResults.logicFlaws || []).filter(f => f.severity === "error");
    const staticErrors = staticIssues.filter(i => i.severity === "error");
    const hasErrors = staticErrors.length > 0 || logicErrors.length > 0;

    console.log("\n=== VECTOR dispatch smoke test ===\n");

    console.log(`Static audit: ${staticErrors.length} error(s), ${staticIssues.length - staticErrors.length} other issue(s)`);
    staticIssues.forEach(issue => {
        console.log(`  [${issue.severity}] ${issue.code}: ${issue.message}`);
    });

    if (dispatchResults) {
        console.log(`\nDispatch probes: ${dispatchResults.success}/${dispatchResults.total} succeeded`);
        for (const [reason, items] of dispatchResults.failures.entries()) {
            console.log(`  ${reason}: ${items.length} case(s)`);
            if (opts.verbose || items.length <= 8) {
                items.forEach(item => {
                    console.log(`    - ${item.aircraft} (${item.label})`);
                });
            } else {
                items.slice(0, 5).forEach(item => console.log(`    - ${item.aircraft} (${item.label})`));
                console.log(`    ... and ${items.length - 5} more`);
            }
        }

        if (logicErrors.length) {
            console.log(`\nLogic flaws (${logicErrors.length}):`);
            logicErrors.forEach(flaw => console.log(`  [${flaw.code}] ${flaw.message}`));
        }
    }

    console.log(hasErrors ? "\nFAILED\n" : "\nPASSED\n");
    return hasErrors ? 1 : 0;
}

function main() {
    const opts = parseArgs(process.argv);
    if (opts.help) {
        console.log(`Usage: node scripts/dispatch-smoke-test.mjs [options]

Options:
  --quick          Default: every aircraft, 60 min slider, baseline options (~2 min)
  --matrix         Per aircraft: contractor, military bases, and long haul presets
  --full           All slider values × routing scopes × contractor × military × long haul
  --static-only    Skip dispatch probes (fleet/mission rules only, ~1s)
  --aircraft CODE  Test one aircraft type only
  --full-airports  Use entire airport DB in probes (slow; ~8 min for quick mode)
  --seed N         Deterministic Math.random seed for reproducible probes
  --verbose, -v    List every failing probe combination
`);
        process.exit(0);
    }

    const { engine } = loadDispatchEngine({
        seed: opts.seed,
        maxAirports: opts.fullAirports ? 0 : 50
    });
    const staticIssues = runStaticAudit(engine);

    let dispatchResults = null;
    if (!opts.staticOnly) {
        const types = opts.aircraft
            ? [opts.aircraft].filter(t => engine.coreFleetSpecs[t])
            : listFleetTypes(engine);
        if (opts.aircraft && !types.length) {
            console.error(`Unknown aircraft type: ${opts.aircraft}`);
            process.exit(1);
        }
        const matrix = buildOptionMatrix(opts.mode);
        console.log(`Running ${types.length} aircraft × ${matrix.length} option sets (${opts.mode} mode)...`);
        const started = Date.now();
        dispatchResults = runDispatchMatrix(engine, types, matrix, opts.verbose);
        console.log(`Completed in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    }

    process.exit(printReport(staticIssues, dispatchResults, opts));
}

main();

import vm from "vm";

/**
 * Dispatcher physics model — mirrors validateJetDispatchPhysics() in dispatch-engine.js.
 *
 * Invariants checked on every successful jet dispatch (no weather):
 *  1. GC distance within aircraft envelope (maxD / heavy-jet cap)
 *  2. Narrowbody ultra-long: GC within tank-limited dispatch distance
 *  3. Trip fuel (catalog or still-air) fits tank capacity
 *  4. SimBrief planning block fuel <= tank capacity
 *  5. TOW = OEW + pax payload + cargo + block fuel <= operational MTOW (runway-adjusted)
 *  6. Pax <= MTOW-limited max at planning fuel
 *  7. Pax <= seat cap; cargo <= maxCargo
 *  8. Route passes isJetSimBriefRouteFeasible (pairing gate)
 */

export function getPhysicsHelpers(sbx) {
    if (!sbx.__physicsHelpers) {
        sbx.__physicsHelpers = vm.runInNewContext(
            `({
                validateJetDispatchPhysics,
                isJetSimBriefRouteFeasible,
                jetTripFuelExceedsTankCapacity,
                getJetMaxLongHaulDispatchNm,
                getJetAllowedMaxGcNm,
                getJetFuelPlanningDistanceNm,
                calculateDistance
            })`,
            sbx
        );
    }
    return sbx.__physicsHelpers;
}

function findAirport(sbx, icao) {
    const code = (icao || "").trim().toUpperCase();
    return sbx.activeAirportDatabase?.find(
        (a) => a.icao && a.icao.trim().toUpperCase() === code
    );
}

export function gcDistanceNm(sbx, depIcao, destIcao) {
    const h = getPhysicsHelpers(sbx);
    const origin = findAirport(sbx, depIcao);
    const dest = findAirport(sbx, destIcao);
    if (!origin || !dest) return null;
    const dist = h.calculateDistance(origin.lat, origin.lon, dest.lat, dest.lon);
    return dist && !isNaN(dist) ? Math.round(dist) : null;
}

export function routePairingAnalysis(sbx, type, depIcao, destIcao) {
    const spec = sbx.coreFleetSpecs[type];
    const origin = findAirport(sbx, depIcao);
    const dest = findAirport(sbx, destIcao);
    if (!spec || !origin || !dest) {
        return { ok: false, error: `missing spec or airport for ${type} ${depIcao}→${destIcao}` };
    }
    const h = getPhysicsHelpers(sbx);
    const gc = Math.round(h.calculateDistance(origin.lat, origin.lon, dest.lat, dest.lon));
    const tankExceeded = h.jetTripFuelExceedsTankCapacity(gc, spec);
    const feasible = h.isJetSimBriefRouteFeasible(gc, spec, origin, dest);
    return { ok: true, gc, tankExceeded, feasible, origin, dest, spec };
}

/**
 * Full dispatcher audit via engine source of truth. Returns error string or null.
 */
export function assertDispatchPhysics(sbx, result) {
    if (!result?.ok) return null;
    const type = result.aircraftType || result.type;
    const spec = result.spec || sbx.coreFleetSpecs[type];
    if (!spec || spec.class !== "JET") return null;

    const h = getPhysicsHelpers(sbx);
    const violations = h.validateJetDispatchPhysics(
        type,
        spec,
        result.origin,
        result.destination,
        result.distanceNm,
        null,
        result.pax,
        result.cargoKg,
        null
    );
    if (violations.length) {
        const origin = result.origin?.icao || "?";
        const dest = result.destination?.icao || "?";
        return `${type} ${origin}→${dest} ${result.distanceNm} nm: ${violations.join("; ")}`;
    }
    return null;
}

export function runInfeasibleRouteGateChecks(sbx, pinnedCases) {
    const failures = [];
    for (const reg of pinnedCases) {
        if (!reg.expectFail || !reg.destOverride) continue;
        const analysis = routePairingAnalysis(sbx, reg.aircraftType, reg.depOverride, reg.destOverride);
        if (!analysis.ok) {
            failures.push(`${reg.label}: ${analysis.error}`);
            continue;
        }
        if (analysis.feasible) {
            failures.push(
                `${reg.label}: isJetSimBriefRouteFeasible returned true at ${analysis.gc} nm` +
                ` (tankExceeded=${analysis.tankExceeded}) — pairing gate would allow impossible route`
            );
        } else {
            console.log(`OK  pairing gate rejects ${reg.aircraftType} ${reg.depOverride}→${reg.destOverride} (${analysis.gc} nm)`);
        }
    }
    return failures;
}

export function runFeasibleRouteGateChecks(sbx, pinnedCases) {
    const failures = [];
    for (const reg of pinnedCases) {
        if (reg.expectFail || !reg.destOverride) continue;
        const analysis = routePairingAnalysis(sbx, reg.aircraftType, reg.depOverride, reg.destOverride);
        if (!analysis.ok) {
            failures.push(`${reg.label}: ${analysis.error}`);
            continue;
        }
        if (!analysis.feasible) {
            failures.push(
                `${reg.label}: isJetSimBriefRouteFeasible returned false at ${analysis.gc} nm — known-good route blocked`
            );
            continue;
        }
        console.log(`OK  pairing gate accepts ${reg.aircraftType} ${reg.depOverride}→${reg.destOverride} (${analysis.gc} nm)`);
    }
    return failures;
}

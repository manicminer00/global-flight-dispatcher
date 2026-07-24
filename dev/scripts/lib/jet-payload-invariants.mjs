import vm from "vm";

/**
 * SimBrief MTOW payload invariants for jet dispatch probes.
 * Every successful jet probe must satisfy these — "dispatch ok" alone is not enough.
 */

export const PINNED_JET_REGRESSIONS = [
    {
        label: "A359 KCAE→ZJHK infeasible (PMRTW runway vs ultra-long fuel)",
        aircraftType: "A359",
        depOverride: "KCAE",
        destOverride: "ZJHK",
        targetMins: 720,
        expectFail: true,
    },
    {
        label: "B738 TXKF→LEAL infeasible (trip fuel exceeds tank)",
        aircraftType: "B738",
        depOverride: "TXKF",
        destOverride: "LEAL",
        targetMins: 720,
        expectFail: true,
    },
    {
        label: "B738 SOCA→LPPT infeasible (tank-range edge)",
        aircraftType: "B738",
        depOverride: "SOCA",
        destOverride: "LPPT",
        targetMins: 720,
        expectFail: true,
    },
    {
        label: "B738 KCAK→ENSB infeasible (tank-range edge)",
        aircraftType: "B738",
        depOverride: "KCAK",
        destOverride: "ENSB",
        targetMins: 720,
        expectFail: true,
    },
    {
        label: "B738 EGLL→KJFK infeasible (beyond 737-800 NG range)",
        aircraftType: "B738",
        depOverride: "EGLL",
        destOverride: "KJFK",
        targetMins: 480,
        expectFail: true,
    },
    {
        label: "A320 EGLL→KJFK infeasible (SimBrief tank-range)",
        aircraftType: "A320",
        depOverride: "EGLL",
        destOverride: "KJFK",
        targetMins: 480,
        expectFail: true,
    },
    {
        label: "B738 LEBL→CYYR feasible narrowbody transatlantic",
        aircraftType: "B738",
        depOverride: "LEBL",
        destOverride: "CYYR",
        targetMins: 480,
    },
    {
        label: "B38M EGLL→KJFK feasible transatlantic",
        aircraftType: "B38M",
        depOverride: "EGLL",
        destOverride: "KJFK",
        targetMins: 480,
    },
    {
        label: "B738 EGLL→CYYR feasible narrowbody transatlantic",
        aircraftType: "B738",
        depOverride: "EGLL",
        destOverride: "CYYR",
        targetMins: 480,
    },
];

function jetHelpers(sbx) {
    if (!sbx.__jetPayloadHelpers) {
        sbx.__jetPayloadHelpers = vm.runInNewContext(
            `({
                getJetSimBriefPlanningBlockFuelKg,
                getJetMaxPaxAtMtow,
                getSimBriefPassengerPayloadKg,
                getDepartureRunwayOperationalMtow,
                isRouteWeightLimitedByRunway
            })`,
            sbx
        );
    }
    return sbx.__jetPayloadHelpers;
}

export function operationalMtowForProbe(sbx, type, originIcao) {
    const spec = sbx.coreFleetSpecs[type];
    if (!spec) return 0;
    const h = jetHelpers(sbx);
    const origin = sbx.activeAirportDatabase?.find(
        (a) => a.icao && a.icao.trim().toUpperCase() === originIcao.trim().toUpperCase()
    );
    if (origin) {
        return h.getDepartureRunwayOperationalMtow(origin, spec);
    }
    return Number(spec.mtow) || 0;
}

export function maxJetPaxForRoute(sbx, type, distanceNm, cargoKg, originIcao) {
    const spec = sbx.coreFleetSpecs[type];
    if (!spec || spec.class !== "JET" || !(spec.maxPax > 0)) return 0;
    const h = jetHelpers(sbx);
    const mtow = operationalMtowForProbe(sbx, type, originIcao);
    const planFuel = h.getJetSimBriefPlanningBlockFuelKg(Number(distanceNm) || 0, spec);
    return h.getJetMaxPaxAtMtow(mtow, spec.oew, planFuel, Math.max(0, cargoKg || 0), spec);
}

/**
 * Returns an error string if a successful jet probe violates dispatcher physics.
 */
export function assertJetProbePayload(sbx, result) {
    if (!result?.ok) return null;
    const type = result.aircraftType || result.type;
    const spec = result.spec || sbx.coreFleetSpecs[type];
    if (!spec || spec.class !== "JET") return null;
    if (typeof sbx.validateJetDispatchPhysics !== "function") return null;

    const violations = sbx.validateJetDispatchPhysics(
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
    if (!violations.length) return null;
    const origin = result.origin?.icao || "?";
    const dest = result.destination?.icao || "?";
    return `${type} ${origin}→${dest} ${result.distanceNm} nm: ${violations.join("; ")}`;
}

export function runPinnedJetRegressions(sbx, probeDispatchFlight) {
    const failures = [];
    for (const reg of PINNED_JET_REGRESSIONS) {
        if (reg.destOverride) {
            sbx.resetDispatchProbeHistory?.();
            const result = probeDispatchFlight({
                aircraftType: reg.aircraftType,
                depOverride: reg.depOverride,
                destOverride: reg.destOverride,
                targetMins: reg.targetMins || 720,
                callsign: "REG",
                routingScope: "worldwide",
                mutateHistory: false,
            });
            if (reg.expectFail) {
                if (result.ok) {
                    failures.push(`${reg.label}: expected dispatch failure but got ${result.pax} pax @ ${result.distanceNm} nm`);
                } else {
                    console.log(`OK  ${reg.label}: correctly rejected (${result.reason})`);
                }
                continue;
            }
            if (!result.ok) {
                failures.push(`${reg.label}: dispatch failed — ${result.reason} ${result.message || ""}`);
                continue;
            }
            if (reg.maxPax && (result.pax || 0) > reg.maxPax) {
                failures.push(`${reg.label}: ${result.pax} pax exceeds tank/MTOW cap ${reg.maxPax} at ${result.distanceNm} nm`);
                continue;
            }
            const payloadErr = assertJetProbePayload(sbx, result);
            if (payloadErr) failures.push(`${reg.label}: ${payloadErr}`);
            else console.log(`OK  ${reg.label}: ${result.pax} pax @ ${result.distanceNm} nm`);
            continue;
        }

        const attempts = reg.attempts || 8;
        let checked = 0;
        for (let i = 0; i < attempts; i++) {
            sbx.resetDispatchProbeHistory?.();
            const result = probeDispatchFlight({
                aircraftType: reg.aircraftType,
                depOverride: reg.depOverride,
                targetMins: reg.targetMins || 720,
                callsign: "REG",
                routingScope: "worldwide",
                mutateHistory: false,
            });
            if (!result.ok) continue;
            if (reg.minDistanceNm && (result.distanceNm || 0) < reg.minDistanceNm) continue;
            checked++;
            const payloadErr = assertJetProbePayload(sbx, result);
            if (payloadErr) {
                failures.push(`${reg.label}: ${payloadErr}`);
                break;
            }
        }
        if (!checked) {
            failures.push(`${reg.label}: no qualifying probe in ${attempts} attempts`);
        } else if (!failures.some((f) => f.startsWith(reg.label))) {
            console.log(`OK  ${reg.label}: ${checked} probe(s) MTOW-feasible`);
        }
    }
    return failures;
}

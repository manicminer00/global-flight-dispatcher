import { createVectorSandboxWithAirports } from "./lib/load-vector-db.mjs";
import vm from "vm";

const sbx = createVectorSandboxWithAirports(process.cwd());
const r = vm.runInNewContext(`(() => {
    const a = activeAirportDatabase.find((x) => x.icao === "TXKF");
    const b = activeAirportDatabase.find((x) => x.icao === "LEAL");
    const d = Math.round(calculateDistance(a.lat, a.lon, b.lat, b.lon));
    const s = coreFleetSpecs.B738;
    const raw = estimateJetBlockFuelBudgetKg(d, s);
    const plan = getJetSimBriefPlanningBlockFuelKg(d, s);
    const cap = getJetMaxPaxAtMtow(s.mtow, s.oew, plan, 431, s);
    const feasible = isJetSimBriefRouteFeasible(d, s, a, b);
    return { d, raw, plan, maxTank: s.maxFuelKg, cap, feasible };
})()`, sbx);
console.log(r);

sbx.___vectorMockLongHaul = true;
const p = sbx.probeDispatchFlight({
    aircraftType: "B738",
    depOverride: "TXKF",
    destOverride: "LEAL",
    longHaulRequested: true,
    targetMins: 720,
    callsign: "T",
    mutateHistory: false,
});
console.log("probe", p.ok ? `${p.pax} pax ${p.distanceNm}nm` : `${p.reason} ${p.message || ""}`);

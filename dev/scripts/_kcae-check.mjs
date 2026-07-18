import { createVectorSandboxWithAirports } from "./lib/load-vector-db.mjs";
import vm from "vm";

const sbx = createVectorSandboxWithAirports(process.cwd());
const info = vm.runInNewContext(`(() => {
    const kcae = activeAirportDatabase.find(a => a.icao === "KCAE");
    const zjhk = activeAirportDatabase.find(a => a.icao === "ZJHK");
    const dist = Math.round(calculateDistance(kcae.lat, kcae.lon, zjhk.lat, zjhk.lon));
    const spec = coreFleetSpecs.A359;
    const plan = getJetSimBriefPlanningBlockFuelKg(dist, spec);
    const pmrtw = 243300;
    const room = pmrtw - spec.oew - plan;
    return { dist, kcaeLen: kcae.length, plan, pmrtw, room, maxPaxAtPmrtw: Math.floor(room / 104) };
})()`, sbx);
console.log(info);

sbx.___vectorMockLongHaul = true;
const r = sbx.probeDispatchFlight({
    aircraftType: "A359",
    depOverride: "KCAE",
    destOverride: "ZJHK",
    longHaulRequested: true,
    targetMins: 720,
    callsign: "T",
    mutateHistory: false,
});
console.log("probe", r.ok ? `${r.pax} pax ${r.distanceNm}nm` : `${r.reason} ${r.message || ""}`);

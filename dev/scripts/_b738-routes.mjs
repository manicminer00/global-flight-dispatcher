import { createVectorSandboxWithAirports } from "./lib/load-vector-db.mjs";
import vm from "vm";

const sbx = createVectorSandboxWithAirports(process.cwd());
const spec = sbx.coreFleetSpecs.B738;
const maxLh = vm.runInNewContext("getJetMaxLongHaulDispatchNm(coreFleetSpecs.B738)", sbx);
console.log("B738 max long-haul dispatch nm:", Math.round(maxLh));

const pairs = [
    ["SOCA", "LPPT"],
    ["KPHL", "EGMC"],
    ["KCAK", "ENSB"],
    ["YAYE", "ROAH"],
    ["TXKF", "LEAL"],
    ["EGLL", "KJFK"],
];

for (const [dep, dest] of pairs) {
    sbx.___vectorMockLongHaul = true;
    sbx.resetDispatchProbeHistory();
    const p = sbx.probeDispatchFlight({
        aircraftType: "B738",
        depOverride: dep,
        destOverride: dest,
        longHaulRequested: true,
        targetMins: 720,
        callsign: "T",
        mutateHistory: false,
    });
    console.log(
        `${dep}→${dest}:`,
        p.ok ? `${p.pax} pax ${p.distanceNm}nm` : `REJECTED (${p.reason})`
    );
}

console.log("canLongHaul B738:", sbx.canAircraftUseLongHaulMode(spec, "B738"));

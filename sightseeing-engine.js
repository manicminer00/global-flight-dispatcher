/**
 * sightseeing-engine.js
 *
 * NOT loaded by loader.js. NOT part of the shipped Vector app. Standalone generation
 * logic for the Sightseeing feature exploration, kept separate until reviewed.
 *
 * The content here is also inlined directly into scenic-lab.html so the test lab is a
 * single self-contained file. If you edit this, keep this file and the inlined copy
 * in scenic-lab.html in sync by hand for now.
 *
 * Deliberately self-contained: does not read any dispatch-engine.js globals
 * (activeAirportDatabase, calculateDistance, etc.) directly. When this eventually gets
 * wired in, dispatch-engine.js would call generateSightseeingFlight() and pass in the
 * airport list it already has in memory, keeping this generation path isolated from
 * the 5,800-line main engine.
 *
 * Depends on: scenic-routes-db.js (scenicRouteDB) being loaded first.
 */

(function () {

    const EARTH_RADIUS_NM = 3440.065;

    /** Haversine distance in nautical miles. Local copy, deliberately not shared with
     * dispatch-engine.js's calculateDistance() — same formula, kept independent so this
     * file has no load-order dependency on dispatch-engine.js. */
    function distanceNm(lat1, lon1, lat2, lon2) {
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * EARTH_RADIUS_NM;
    }

    function sumSpineDistanceNm(points) {
        let total = 0;
        for (let i = 1; i < points.length; i++) {
            total += distanceNm(points[i - 1].lat, points[i - 1].lon, points[i].lat, points[i].lon);
        }
        return total;
    }

    /**
     * Filters the curated scenic route database to routes enabled for the given mode.
     * mode is "HELI" or "GA" — matches fleet-db.js's spec.class values.
     */
    function filterScenicRoutes(routeDB, mode) {
        return (routeDB || []).filter((route) => {
            const modeCfg = route.modes && route.modes[mode];
            return !!(modeCfg && modeCfg.enabled && Number.isFinite(modeCfg.altitudeFt));
        });
    }

    /**
     * Finds airports from the supplied airport array within a gate's search radius.
     * airports: array of { icao, lat, lon, length, ... } (same shape as
     * activeAirportDatabase in dispatch-engine.js).
     * options.minRunwayLength: optional hard filter (e.g. for GA mode).
     */
    function findAirportsNearGate(airports, gate, options) {
        const opts = options || {};
        const minRunwayLength = Number(opts.minRunwayLength) || 0;
        if (!gate || !Array.isArray(airports)) return [];
        return airports
            .filter((ap) => ap && Number.isFinite(ap.lat) && Number.isFinite(ap.lon))
            .map((ap) => Object.assign({}, ap, { _gateDistNm: distanceNm(ap.lat, ap.lon, gate.lat, gate.lon) }))
            .filter((ap) => ap._gateDistNm <= gate.radiusNm)
            .filter((ap) => minRunwayLength <= 0 || (ap.length || 0) >= minRunwayLength)
            .sort((a, b) => a._gateDistNm - b._gateDistNm);
    }

    /**
     * Soft-penalty weighted random pick. candidates: array of { item, weight }.
     * Never hard-excludes — with a small route catalog, hard exclusion can make
     * generation fail outright (per both brainstorm reviews).
     */
    function weightedRandomPick(weightedItems) {
        const total = weightedItems.reduce((sum, w) => sum + Math.max(0, w.weight), 0);
        if (total <= 0) return weightedItems.length ? weightedItems[0].item : null;
        let roll = Math.random() * total;
        for (const w of weightedItems) {
            roll -= Math.max(0, w.weight);
            if (roll <= 0) return w.item;
        }
        return weightedItems[weightedItems.length - 1].item;
    }

    const SIGHTSEEING_HISTORY_KEY = "vector_sightseeing_history_v1";
    const HISTORY_MAX_ROUTES = 8;
    const HISTORY_MAX_AIRPORTS = 10;

    function loadSightseeingHistory() {
        try {
            const raw = (typeof localStorage !== "undefined") ? localStorage.getItem(SIGHTSEEING_HISTORY_KEY) : null;
            const parsed = raw ? JSON.parse(raw) : null;
            return {
                recentRouteIds: Array.isArray(parsed && parsed.recentRouteIds) ? parsed.recentRouteIds : [],
                recentAirportIcaos: Array.isArray(parsed && parsed.recentAirportIcaos) ? parsed.recentAirportIcaos : []
            };
        } catch (e) {
            return { recentRouteIds: [], recentAirportIcaos: [] };
        }
    }

    function recordSightseeingFlight(history, routeId, originIcao, destIcao) {
        const next = {
            recentRouteIds: [routeId].concat(history.recentRouteIds || []).slice(0, HISTORY_MAX_ROUTES),
            recentAirportIcaos: [originIcao, destIcao].concat(history.recentAirportIcaos || []).slice(0, HISTORY_MAX_AIRPORTS)
        };
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(SIGHTSEEING_HISTORY_KEY, JSON.stringify(next));
            }
        } catch (e) {
            /* localStorage unavailable — history just won't persist across sessions */
        }
        return next;
    }

    /**
     * Scores a candidate airport pair for a scenic route. Lower gate distance is
     * better; recently-used airports are soft-penalized, not excluded.
     */
    function scoreAirportPair(originAp, destAp, history) {
        let score = 100;
        score -= (originAp._gateDistNm || 0) * 0.6;
        score -= (destAp._gateDistNm || 0) * 0.6;
        const recent = history.recentAirportIcaos || [];
        if (recent.includes(originAp.icao)) score -= 20;
        if (recent.includes(destAp.icao)) score -= 20;
        if (originAp.icao === destAp.icao) score -= 1000;
        return score;
    }

    /**
     * Main entry point. Not yet called from dispatch-engine.js.
     *
     * @param {object} params
     *   mode: "HELI" | "GA"
     *   airports: array of airport records (pass in activeAirportDatabase)
     *   minRunwayLength: optional, e.g. spec.minRunwayLength for the selected aircraft
     *   routeDB: optional override, defaults to global scenicRouteDB
     *   history: optional override, defaults to loadSightseeingHistory()
     * @returns { ok: true, ...ticketFields } or { ok: false, reason, message }
     */
    function generateSightseeingFlight(params) {
        const p = params || {};
        const mode = p.mode === "HELI" ? "HELI" : "GA";
        const airports = Array.isArray(p.airports) ? p.airports : [];
        const minRunwayLength = Number(p.minRunwayLength) || 0;
        const routeDB = p.routeDB || (typeof scenicRouteDB !== "undefined" ? scenicRouteDB : []);
        const history = p.history || loadSightseeingHistory();

        const eligible = filterScenicRoutes(routeDB, mode);
        if (eligible.length === 0) {
            return { ok: false, reason: "no_routes_for_mode", message: "No scenic routes are configured for " + mode + " yet." };
        }

        // Soft-penalty weighting: recently flown routes get a much lower (not zero) weight.
        const weighted = eligible.map((route) => {
            const recentIndex = (history.recentRouteIds || []).indexOf(route.id);
            let weight = 10;
            if (recentIndex === 0) weight = 0.5;
            else if (recentIndex > 0) weight = 3;
            return { item: route, weight };
        });

        // Try routes in weighted-random order until one has valid airports at both gates.
        const attemptOrder = [];
        const pool = weighted.slice();
        while (pool.length) {
            const pick = weightedRandomPick(pool);
            attemptOrder.push(pick);
            const idx = pool.findIndex((w) => w.item === pick);
            if (idx >= 0) pool.splice(idx, 1);
        }

        for (const route of attemptOrder) {
            const startCandidates = findAirportsNearGate(airports, route.gates.start, { minRunwayLength });
            const endCandidates = findAirportsNearGate(airports, route.gates.end, { minRunwayLength });
            if (!startCandidates.length || !endCandidates.length) continue;

            let bestPair = null;
            let bestScore = -Infinity;
            const startShortlist = startCandidates.slice(0, 5);
            const endShortlist = endCandidates.slice(0, 5);
            for (const s of startShortlist) {
                for (const e of endShortlist) {
                    if (s.icao === e.icao) continue;
                    const score = scoreAirportPair(s, e, history);
                    if (score > bestScore) {
                        bestScore = score;
                        bestPair = { origin: s, destination: e };
                    }
                }
            }
            if (!bestPair) continue;

            const modeCfg = route.modes[mode];
            const waypoints = [
                { type: "AIRPORT", icao: bestPair.origin.icao, lat: bestPair.origin.lat, lon: bestPair.origin.lon, label: bestPair.origin.name || bestPair.origin.icao }
            ].concat(
                route.spine.map((pt) => Object.assign({ type: "SCENIC" }, pt))
            ).concat([
                { type: "AIRPORT", icao: bestPair.destination.icao, lat: bestPair.destination.lat, lon: bestPair.destination.lon, label: bestPair.destination.name || bestPair.destination.icao }
            ]);

            const fullPath = waypoints.map((wp) => ({ lat: wp.lat, lon: wp.lon }));
            const totalDistanceNm = Math.round(sumSpineDistanceNm(fullPath));

            return {
                ok: true,
                routeId: route.id,
                routeName: route.name,
                region: route.region,
                mode,
                origin: bestPair.origin,
                destination: bestPair.destination,
                waypoints,
                highlightLabels: route.spine.map((pt) => pt.label),
                altitudeFt: modeCfg.altitudeFt,
                distanceNm: totalDistanceNm,
                briefing: route.briefing,
                restrictions: route.restrictions || null,
                verified: !!route.verified,
                updatedHistory: recordSightseeingFlight(history, route.id, bestPair.origin.icao, bestPair.destination.icao)
            };
        }

        return {
            ok: false,
            reason: "no_airports_near_gates",
            message: "No suitable airports were found near any eligible scenic route's endpoints for " + mode + ". Try widening a route's gate radius in scenic-routes-db.js, or check whether the airport database filters (military-only, Navigraph-only, etc.) are excluding everything nearby."
        };
    }

    /**
     * .pln export — MSFS 2024 SDK "Flight Plan XML (PLN File) Properties" schema,
     * confirmed against https://docs.flightsimulator.com/msfs2024/html/5_Content_Configuration/Mission_XML_Files/Flight_Plan_XML_Properties.htm
     * (fetched 2026-07-24). Produces a real waypoint-by-waypoint route — origin airport,
     * each scenic spine point as a "User" waypoint, destination airport — not just a
     * straight-line A-to-B, so the user can actually follow the scenic route on the
     * in-sim map/EFB rather than just spawning at two airports.
     */

    function escapeXml(str) {
        return String(str == null ? "" : str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&apos;");
    }

    function dmsFromDecimal(absValue) {
        let deg = Math.floor(absValue);
        let minFull = (absValue - deg) * 60;
        let min = Math.floor(minFull);
        let sec = (minFull - min) * 60;
        // Rollover guard for floating-point edge cases (e.g. sec rounding to 60.00).
        if (sec >= 59.995) { sec = 0; min += 1; }
        if (min >= 60) { min -= 60; deg += 1; }
        return { deg, min, sec };
    }

    function formatLat(lat) {
        const dir = lat >= 0 ? "N" : "S";
        const { deg, min, sec } = dmsFromDecimal(Math.abs(lat));
        return dir + deg + "° " + String(min).padStart(2, "0") + "' " + sec.toFixed(2).padStart(5, "0") + "\"";
    }

    function formatLon(lon) {
        const dir = lon >= 0 ? "E" : "W";
        const { deg, min, sec } = dmsFromDecimal(Math.abs(lon));
        return dir + deg + "° " + String(min).padStart(2, "0") + "' " + sec.toFixed(2).padStart(5, "0") + "\"";
    }

    function formatAltitude(altFt) {
        const sign = altFt < 0 ? "-" : "+";
        const abs = Math.round(Math.abs(altFt || 0));
        return sign + String(abs).padStart(6, "0") + ".00";
    }

    /** Matches the SDK's documented WorldPosition / DepartureLLA / DestinationLLA format:
     * `N52° 22' 42.75", E13° 31' 14.27",+000000.00` */
    function formatLLA(lat, lon, altFt) {
        return formatLat(lat) + "," + formatLon(lon) + "," + formatAltitude(altFt);
    }

    /**
     * Builds a full waypoint-by-waypoint .pln XML string from a generateSightseeingFlight()
     * result: origin airport -> each scenic spine point (as a "User" waypoint carrying the
     * route's cruise altitude) -> destination airport.
     * @param {object} result — a successful ({ok:true, ...}) result from generateSightseeingFlight.
     * @returns {string|null} XML string, or null if result is not a successful generation.
     */
    function buildScenicPlnXml(result) {
        if (!result || !result.ok) return null;
        const origin = result.origin;
        const destination = result.destination;
        const cruiseAlt = result.altitudeFt;
        const title = origin.icao + " to " + destination.icao + " (" + result.routeName + ")";
        const descr = origin.icao + ", " + destination.icao;

        const waypointXml = result.waypoints.map((wp, idx) => {
            const isAirport = wp.type === "AIRPORT";
            const id = isAirport ? wp.icao : ("SCENIC" + (idx + 1));
            const typeTag = isAirport ? "Airport" : "User";
            // Airports: altitude left at 0 in the LLA (matches the SDK's own PADU example —
            // the sim resolves actual field elevation itself). Scenic points: carry the
            // route's authored cruise altitude so it's visible on the EFB/map for that point.
            const posAlt = isAirport ? 0 : cruiseAlt;
            const icaoBlock = isAirport
                ? "\n                <ICAO>\n                    <ICAORegion>" + escapeXml((wp.icao || "").charAt(0)) + "</ICAORegion>\n                    <ICAOIdent>" + escapeXml(wp.icao) + "</ICAOIdent>\n                </ICAO>"
                : "";
            return '            <ATCWaypoint id="' + escapeXml(id) + '">\n' +
                "                <ATCWaypointType>" + typeTag + "</ATCWaypointType>\n" +
                "                <WorldPosition>" + formatLLA(wp.lat, wp.lon, posAlt) + "</WorldPosition>" + icaoBlock + "\n" +
                "                <Descr>" + escapeXml(wp.label || id) + "</Descr>\n" +
                "            </ATCWaypoint>";
        }).join("\n");

        return '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<SimBase.Document Type="AceXML" version="1,0">\n' +
            "    <Descr>AceXML Document</Descr>\n" +
            "    <FlightPlan.FlightPlan>\n" +
            "        <Title>" + escapeXml(title) + "</Title>\n" +
            "        <FPType>VFR</FPType>\n" +
            "        <RouteType>Direct</RouteType>\n" +
            "        <CruisingAlt>" + cruiseAlt + "</CruisingAlt>\n" +
            "        <DepartureID>" + escapeXml(origin.icao) + "</DepartureID>\n" +
            "        <DepartureLLA>" + formatLLA(origin.lat, origin.lon, 0) + "</DepartureLLA>\n" +
            "        <DestinationID>" + escapeXml(destination.icao) + "</DestinationID>\n" +
            "        <DestinationLLA>" + formatLLA(destination.lat, destination.lon, 0) + "</DestinationLLA>\n" +
            "        <Descr>" + escapeXml(descr) + "</Descr>\n" +
            "        <DepartureName>" + escapeXml(origin.name || origin.icao) + "</DepartureName>\n" +
            "        <DestinationName>" + escapeXml(destination.name || destination.icao) + "</DestinationName>\n" +
            "        <AppVersion>\n" +
            "            <AppVersionMajor>11</AppVersionMajor>\n" +
            "        </AppVersion>\n" +
            waypointXml + "\n" +
            "    </FlightPlan.FlightPlan>\n" +
            "</SimBase.Document>\n";
    }

    /**
     * SkyVector deep link — confirmed 2026-07-24 that skyvector.com/?fpl=... pre-fills
     * the flight plan box, and that it accepts custom lat/lon fixes (not just ICAO
     * airports/navaids) using the documented DDMMSSH DDDMMSSH format used for filing
     * real flight plans. Source: SkyVector's own "Manually Entering Waypoints" guidance
     * (community-documented, not an official SkyVector API — if the format ever stops
     * working, this is the first thing to re-check).
     */

    function pad(n, width) {
        return String(Math.max(0, Math.floor(n))).padStart(width, "0");
    }

    /** Converts one decimal lat/lon pair into SkyVector's fpl waypoint token, e.g.
     * 40.851, -73.952 -> "405103N0735707W". */
    function skyVectorLatLonToken(lat, lon) {
        const latDir = lat >= 0 ? "N" : "S";
        const lonDir = lon >= 0 ? "E" : "W";
        const la = Math.abs(lat), lo = Math.abs(lon);

        let laDeg = Math.floor(la);
        let laMinFull = (la - laDeg) * 60;
        let laMin = Math.floor(laMinFull);
        let laSec = Math.round((laMinFull - laMin) * 60);
        if (laSec >= 60) { laSec -= 60; laMin += 1; }
        if (laMin >= 60) { laMin -= 60; laDeg += 1; }

        let loDeg = Math.floor(lo);
        let loMinFull = (lo - loDeg) * 60;
        let loMin = Math.floor(loMinFull);
        let loSec = Math.round((loMinFull - loMin) * 60);
        if (loSec >= 60) { loSec -= 60; loMin += 1; }
        if (loMin >= 60) { loMin -= 60; loDeg += 1; }

        return pad(laDeg, 2) + pad(laMin, 2) + pad(laSec, 2) + latDir
            + pad(loDeg, 3) + pad(loMin, 2) + pad(loSec, 2) + lonDir;
    }

    /**
     * Builds a SkyVector URL that pre-fills the flight plan box with the full route:
     * origin ICAO -> each scenic spine point as a lat/lon fix -> destination ICAO.
     * @param {object} result — a successful generateSightseeingFlight() result.
     * @returns {{url: string, fplString: string}|null}
     */
    function buildSkyVectorLink(result) {
        if (!result || !result.ok) return null;
        const tokens = result.waypoints.map((wp) =>
            wp.type === "AIRPORT" ? wp.icao : skyVectorLatLonToken(wp.lat, wp.lon)
        );
        const fplString = tokens.join(" ");
        const url = "https://skyvector.com/?fpl=" + encodeURIComponent(fplString) + "&chart=301";
        return { url, fplString };
    }

    const api = {
        distanceNm,
        sumSpineDistanceNm,
        filterScenicRoutes,
        findAirportsNearGate,
        loadSightseeingHistory,
        recordSightseeingFlight,
        generateSightseeingFlight,
        buildScenicPlnXml,
        buildSkyVectorLink
    };

    if (typeof globalThis !== "undefined") {
        Object.keys(api).forEach((key) => { globalThis[key] = api[key]; });
    }

})();

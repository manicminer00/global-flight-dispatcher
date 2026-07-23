/**
 * scenic-routes-db.js
 *
 * NOT loaded by loader.js. NOT part of the shipped Vector app. This is a standalone
 * data file for the Sightseeing feature exploration — kept separate until the feature
 * is reviewed and Toby decides to wire it in.
 *
 * The content here is also inlined directly into scenic-lab.html so the test lab is a
 * single self-contained file. If you edit routes, keep this file and the inlined copy
 * in scenic-lab.html in sync by hand for now.
 *
 * Schema (MVP — do not add fields until a real problem demands them):
 *   id            unique slug
 *   name          display name
 *   region        free text region label
 *   countries     [ISO-ish country labels, free text]
 *   spine         ordered array of { lat, lon, label } — the scenic route itself.
 *                 The generated flight must pass through these points in order.
 *   gates         { start: {lat, lon, radiusNm, sampleIcaos}, end: {...} }
 *                 Search areas used to find real airports near each end of the spine.
 *                 sampleIcaos are just sanity-check references, not a hard allow-list.
 *   modes         { HELI: { enabled, altitudeFt }, GA: { enabled, altitudeFt } }
 *                 Fixed MSL cruise altitude per aircraft class. This OVERRIDES the
 *                 normal time-budget altitude model in dispatch-engine.js — sightseeing
 *                 altitude is authored for terrain clearance/viewing, not efficiency.
 *   briefing      one-sentence pilot-facing highlight text
 *   restrictions  free text, informational only. NOT enforced by the engine.
 *   verified      false until someone has actually flown it in MSFS and confirmed the
 *                 spine/altitude/airports work. Source data below is unflown — see notes.
 *   notes         provenance / caveats
 *
 * PROVENANCE: all 10 routes below were researched by Gemini (2026-07-23) from public
 * map/aviation-chart knowledge, not verified in MSFS. Gemini's own disclosure:
 * coordinates are derived from real-world map data, not flight-tested; live TFR status
 * and third-party airstrip-mod presence near the gate radii are unconfirmed. Treat
 * `verified: false` routes as drafts until flown and checked.
 */

const scenicRouteDB = [
    {
        id: "victoria-falls-gorge",
        name: "Victoria Falls Gorge",
        region: "Livingstone",
        countries: ["Zambia", "Zimbabwe"],
        spine: [
            { lat: -17.794, lon: 25.263, label: "Zambezi River Approach" },
            { lat: -17.922, lon: 25.856, label: "Victoria Falls" },
            { lat: -17.965, lon: 25.925, label: "Batoka Gorge Exit" }
        ],
        gates: {
            start: { lat: -17.794, lon: 25.263, radiusNm: 35, sampleIcaos: ["FBTE"] },
            end: { lat: -17.965, lon: 25.925, radiusNm: 25, sampleIcaos: ["FVFA", "FLLI"] }
        },
        modes: {
            HELI: { enabled: true, altitudeFt: 4000 },
            GA: { enabled: false, altitudeFt: null }
        },
        briefing: "Follow the Zambezi river directly over the falls and descend into the deep, winding Batoka gorge.",
        restrictions: "Real-world: strictly controlled airspace directly over the falls; real operators stay above 3500 ft MSL unless flying a cleared tour route. Not enforced by the engine.",
        verified: false,
        notes: "Sourced via Gemini research, 2026-07-23. Not flown in MSFS."
    },
    {
        id: "hudson-river-exclusion",
        name: "Hudson River Exclusion",
        region: "New York",
        countries: ["USA"],
        spine: [
            { lat: 40.606, lon: -74.044, label: "Verrazzano Bridge" },
            { lat: 40.689, lon: -74.044, label: "Statue of Liberty" },
            { lat: 40.765, lon: -74.001, label: "Intrepid Museum" },
            { lat: 40.851, lon: -73.952, label: "George Washington Bridge" }
        ],
        gates: {
            start: { lat: 40.600, lon: -74.050, radiusNm: 25, sampleIcaos: ["KJFK", "KEWR"] },
            end: { lat: 40.860, lon: -73.950, radiusNm: 25, sampleIcaos: ["KTEB"] }
        },
        modes: {
            HELI: { enabled: true, altitudeFt: 1200 },
            GA: { enabled: false, altitudeFt: null }
        },
        briefing: "Fly the iconic Hudson River exclusion zone past the Manhattan skyline.",
        restrictions: "Real-world (verified against FAA Hudson/East River Exclusion SFRA chart, 2026-07-24): transient (through-flight) operation must stay at 1,000 ft up to but not including 1,300 ft MSL; local operations (circling, photo work) can go from the surface up to but not including 1,000 ft MSL. Max 140kt, keep right side of river, self-announce at reporting points on CTAF 123.05. Altitude corrected from an earlier draft value of 1500 ft, which was outside the legal transient band. Not enforced by the engine.",
        verified: false,
        notes: "Sourced via Gemini research, 2026-07-23. Altitude corrected 2026-07-24 against the official FAA SFRA chart Toby provided. Not flown in MSFS."
    },
    {
        id: "napali-coastline",
        name: "Na Pali Coastline",
        region: "Kauai, Hawaii",
        countries: ["USA"],
        spine: [
            { lat: 22.091, lon: -159.761, label: "Polihale Beach" },
            { lat: 22.164, lon: -159.646, label: "Kalalau Valley" },
            { lat: 22.218, lon: -159.585, label: "Ke'e Beach" }
        ],
        gates: {
            start: { lat: 22.050, lon: -159.780, radiusNm: 25, sampleIcaos: ["PHBK"] },
            end: { lat: 22.220, lon: -159.550, radiusNm: 25, sampleIcaos: ["PHLI"] }
        },
        modes: {
            HELI: { enabled: true, altitudeFt: 1500 },
            GA: { enabled: true, altitudeFt: 1500 }
        },
        briefing: "Hug the dramatic razor-sharp sea cliffs and remote waterfalls of Kauai's northwest coast.",
        restrictions: "Real-world: Hawaii noise abatement requests ~1500 ft AGL near populated areas and parks. Confirmed 2026-07-24: both helicopter and fixed-wing (small plane) tours commonly fly this coast — not helicopter-only. GA altitude reused from the HELI figure (same terrain/cliff profile); not verified against a specific fixed-wing operator's altitude. Not enforced by the engine.",
        verified: false,
        notes: "Sourced via Gemini research, 2026-07-23. Aircraft-category check 2026-07-24 confirmed both HELI and GA fly this route in reality; GA mode enabled. Not flown in MSFS."
    },
    {
        id: "lauterbrunnen-valley",
        name: "Lauterbrunnen Valley",
        region: "Bernese Oberland",
        countries: ["Switzerland"],
        spine: [
            { lat: 46.683, lon: 7.850, label: "Interlaken" },
            { lat: 46.598, lon: 7.908, label: "Lauterbrunnen Village" },
            { lat: 46.555, lon: 7.901, label: "Stechelberg" }
        ],
        gates: {
            start: { lat: 46.683, lon: 7.850, radiusNm: 25, sampleIcaos: ["LSMI"] },
            end: { lat: 46.555, lon: 7.901, radiusNm: 35, sampleIcaos: ["LSMM"] }
        },
        modes: {
            HELI: { enabled: true, altitudeFt: 4500 },
            GA: { enabled: false, altitudeFt: null }
        },
        briefing: "Navigate the deep, vertical-walled alpine valley known globally for its 72 waterfalls.",
        restrictions: "Real-world: Swiss noise abatement; stay clear of cable cars and base-jumping operations. Not enforced by the engine.",
        verified: false,
        notes: "Sourced via Gemini research, 2026-07-23. Not flown in MSFS."
    },
    {
        id: "grand-canyon-dragon-corridor",
        name: "Grand Canyon — Dragon Corridor",
        region: "Arizona",
        countries: ["USA"],
        spine: [
            { lat: 35.653, lon: -112.140, label: "Valle Approach" },
            { lat: 35.955, lon: -112.138, label: "Dragon Corridor South" },
            { lat: 36.313, lon: -112.196, label: "Dragon Corridor North" },
            { lat: 36.948, lon: -112.523, label: "Fredonia Exit" }
        ],
        gates: {
            start: { lat: 35.650, lon: -112.140, radiusNm: 40, sampleIcaos: ["KGCN", "40G"] },
            end: { lat: 36.950, lon: -112.520, radiusNm: 45, sampleIcaos: ["KAZC"] }
        },
        modes: {
            HELI: { enabled: true, altitudeFt: 9500 },
            GA: { enabled: true, altitudeFt: 9500 }
        },
        briefing: "Cross the widest section of the Grand Canyon via the established Dragon routing.",
        restrictions: "Real-world: ordinary transient VFR traffic through this airspace must be at 10,500 or 11,500 ft; 9,500 ft is reserved for authorized commercial air tour operators. Kept at 9,500 ft intentionally — VECTOR's Sightseeing mode represents a scenic/tour flight, the same category of operation the 9,500 ft allowance is written for, not ordinary transiting traffic. Confirmed 2026-07-24: the FAA's own Grand Canyon VFR chart depicts both fixed-wing and rotary-wing routes through the Dragon Corridor, so HELI mode was enabled — real-world helicopter tour altitudes in this corridor may differ from the fixed-wing figure used here (color-coded per aircraft type on the official chart); the 9,500 ft value has not been separately verified for helicopter operations. Not enforced by the engine.",
        verified: false,
        notes: "Sourced via Gemini research, 2026-07-23. Altitude decision resolved 2026-07-24: kept at 9,500 ft. Aircraft-category check 2026-07-24 confirmed both fixed-wing and rotary-wing use this corridor in reality; HELI mode enabled reusing the same altitude — needs a closer look at whether helicopter-specific altitude differs. Not flown in MSFS."
    },
    {
        id: "milford-sound-approach",
        name: "Milford Sound Approach",
        region: "South Island",
        countries: ["New Zealand"],
        spine: [
            { lat: 45.004, lon: 167.925, label: "Lake Te Anau North" },
            { lat: 44.801, lon: 167.766, label: "Arthur River Pass" },
            { lat: 44.633, lon: 167.915, label: "Mitre Peak" }
        ],
        gates: {
            start: { lat: 45.000, lon: 167.900, radiusNm: 50, sampleIcaos: ["NZTE"] },
            end: { lat: 44.630, lon: 167.900, radiusNm: 25, sampleIcaos: ["NZMF"] }
        },
        modes: {
            HELI: { enabled: true, altitudeFt: 6500 },
            GA: { enabled: true, altitudeFt: 6500 }
        },
        briefing: "Climb over dramatic alpine passes before descending into the towering granite walls of Milford Sound.",
        restrictions: "Real-world: mandatory broadcast zones, strict weather minimums, one-way traffic patterns in narrow valleys. Confirmed 2026-07-24: both fixed-wing and helicopter flights are standard here (combined fly-one-way/heli-back tours are a whole product category), so HELI mode was enabled reusing the same altitude. Not enforced by the engine.",
        verified: false,
        notes: "Sourced via Gemini research, 2026-07-23. Aircraft-category check 2026-07-24 confirmed both HELI and GA fly this route in reality; HELI mode enabled. Not flown in MSFS."
    },
    {
        id: "great-glen-fault",
        name: "The Great Glen Fault",
        region: "Scottish Highlands",
        countries: ["United Kingdom"],
        spine: [
            { lat: 56.819, lon: -5.105, label: "Fort William" },
            { lat: 57.144, lon: -4.680, label: "Fort Augustus" },
            { lat: 57.324, lon: -4.442, label: "Urquhart Castle" },
            { lat: 57.477, lon: -4.224, label: "Inverness" }
        ],
        gates: {
            start: { lat: 56.819, lon: -5.105, radiusNm: 30, sampleIcaos: ["EGEI"] },
            end: { lat: 57.477, lon: -4.224, radiusNm: 25, sampleIcaos: ["EGPE"] }
        },
        modes: {
            HELI: { enabled: true, altitudeFt: 5500 },
            GA: { enabled: true, altitudeFt: 5500 }
        },
        briefing: "Fly straight up the Scottish Highlands along a massive geological fault line containing Loch Ness.",
        restrictions: "Real-world: military low-level flight training area (LFA 14); possible fast-jet traffic. Confirmed 2026-07-24: both light-aircraft flights (e.g. Fort William to Loch Ness) and helicopter tours operate along the Great Glen, so HELI mode was enabled reusing the same altitude. Not enforced by the engine.",
        verified: false,
        notes: "Sourced via Gemini research, 2026-07-23. Aircraft-category check 2026-07-24 confirmed both HELI and GA fly this route in reality; HELI mode enabled. Not flown in MSFS."
    },
    {
        id: "columbia-river-gorge",
        name: "Columbia River Gorge",
        region: "Oregon / Washington",
        countries: ["USA"],
        spine: [
            { lat: 45.545, lon: -122.404, label: "Portland East" },
            { lat: 45.576, lon: -122.115, label: "Multnomah Falls" },
            { lat: 45.662, lon: -121.899, label: "Bridge of the Gods" },
            { lat: 45.713, lon: -121.511, label: "Hood River" }
        ],
        gates: {
            start: { lat: 45.545, lon: -122.404, radiusNm: 25, sampleIcaos: ["KPDX", "KTTD"] },
            end: { lat: 45.713, lon: -121.511, radiusNm: 25, sampleIcaos: ["4S2"] }
        },
        modes: {
            HELI: { enabled: false, altitudeFt: null },
            GA: { enabled: true, altitudeFt: 5500 }
        },
        briefing: "Follow the wide river gorge carving through the Cascade Mountains, flanked by waterfalls and cliffs.",
        restrictions: "Real-world: stay above 2000 ft AGL over the national scenic area due to noise sensitivity. Not enforced by the engine.",
        verified: false,
        notes: "Sourced via Gemini research, 2026-07-23. Not flown in MSFS."
    },
    {
        id: "vegas-hoover-dam",
        name: "Vegas to Hoover Dam",
        region: "Nevada",
        countries: ["USA"],
        spine: [
            { lat: 36.147, lon: -115.155, label: "Stratosphere Tower" },
            { lat: 36.106, lon: -114.925, label: "Lake Las Vegas" },
            { lat: 36.016, lon: -114.737, label: "Hoover Dam" }
        ],
        gates: {
            start: { lat: 36.147, lon: -115.155, radiusNm: 25, sampleIcaos: ["KLAS", "KVGT"] },
            end: { lat: 36.016, lon: -114.737, radiusNm: 25, sampleIcaos: ["KBVU"] }
        },
        modes: {
            HELI: { enabled: true, altitudeFt: 3500 },
            GA: { enabled: true, altitudeFt: 5500 }
        },
        briefing: "Depart the bustling Vegas strip and transition across desert terrain to the massive Hoover Dam.",
        restrictions: "Real-world: Las Vegas Class B airspace requires ATC clearance; no-fly zones directly over the dam below certain altitudes. Not enforced by the engine.",
        verified: false,
        notes: "Sourced via Gemini research, 2026-07-23. Not flown in MSFS."
    },
    {
        id: "chamonix-mont-blanc-valley",
        name: "Chamonix Mont Blanc Valley",
        region: "Haute-Savoie",
        countries: ["France"],
        spine: [
            { lat: 45.892, lon: 6.712, label: "Saint-Gervais" },
            { lat: 45.923, lon: 6.869, label: "Chamonix Town" },
            { lat: 46.103, lon: 7.073, label: "Martigny" }
        ],
        gates: {
            start: { lat: 45.892, lon: 6.712, radiusNm: 35, sampleIcaos: ["LFLI"] },
            end: { lat: 46.103, lon: 7.073, radiusNm: 45, sampleIcaos: ["LSGS"] }
        },
        modes: {
            HELI: { enabled: true, altitudeFt: 5500 },
            GA: { enabled: true, altitudeFt: 9500 }
        },
        briefing: "Navigate the spectacular alpine trench directly beneath Europe's highest peak.",
        restrictions: "Real-world: numerous paragliding activity and strict alpine wildlife protection zones. Not enforced by the engine.",
        verified: false,
        notes: "Sourced via Gemini research, 2026-07-23. Not flown in MSFS."
    }
];

if (typeof globalThis !== "undefined") {
    globalThis.scenicRouteDB = scenicRouteDB;
}

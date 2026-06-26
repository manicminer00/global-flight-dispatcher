const RESTRICTED_JET_MISSION_TYPES = ["A319", "E190", "E195", "RJ70", "RJ85", "RJ1H", "RJ1F", "B461", "B462", "B462_QT", "B463", "B463_QT"];
const EGLC_JET_MISSION_TYPES = RESTRICTED_JET_MISSION_TYPES.concat(["F70"]);
const REGIONAL_JET_FREIGHTERS = ["B462_QT", "B463_QT", "RJ1F"];
const MAINLINE_JET_FREIGHTERS = ["B738_BCF", "B738_BDSF"];
const SMALL_GA_TRAINERS = ["PA28", "P28A", "PA38"];
const VULCAN_RECON_PREFERRED = ["VULC"];
const TACTICAL_JET_MISSION_TYPES = ["F14A", "F14B", "HAWK", "JAGR", "TOR"];
const STRATEGIC_RECON_AIRCRAFT = ["VULC", "C160", "C30J", "P38", "SPIT", "BF109", "F6F", "FW08", "A6M5"].concat(TACTICAL_JET_MISSION_TYPES);
const CELEBRITY_BIZ_JET_PREFERRED = ["STAR", "P180", "C700", "C680", "C750", "E55P", "FA50", "LJ35", "HDJT", "SF50"];
const CELEBRITY_VIP_SCENARIO_WEIGHT_MULT = 5;

// Military airlifters (CIVIL_OK): civilian heavy-freight scenarios only — military templates unchanged.
const MIL_AIRLIFTER_CIVIL_TYPES = ["A400", "C30J", "C160"];
const MIL_AIRLIFTER_CIVIL_BASE_SCENARIO_IMGIDS = [104, 110, 111, 115, 116, 120, 121, 122, 123];
const MIL_AIRLIFTER_CIVIL_EXTRA_SCENARIO_BY_TYPE = { C160: [114] };
const MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT = ["A400", "C30J", "C160"];
const MIL_AIRLIFTER_EXCLUDED_OVERNIGHT_PARCELS = ["A400", "C30J"];
function getMilAirlifterCivilScenarioImgIds(aircraftType) {
    if (!MIL_AIRLIFTER_CIVIL_TYPES.includes(aircraftType)) return null;
    const extra = MIL_AIRLIFTER_CIVIL_EXTRA_SCENARIO_BY_TYPE[aircraftType] || [];
    return MIL_AIRLIFTER_CIVIL_BASE_SCENARIO_IMGIDS.concat(extra);
}
// Back-compat alias for audits referencing the A400 base list.
const A400_CIVIL_FREIGHT_SCENARIO_IMGIDS = MIL_AIRLIFTER_CIVIL_BASE_SCENARIO_IMGIDS;

// Long haul mode: mission types and scenario imgIds allowed when Enable Long haul flights is on.
const LONG_HAUL_MISSION_TYPES = [
    6,  // Hub-to-Hub Freight
    14, // Scheduled Commercial Service
    16, // Executive VIP Charter
    18, // Heavy Cargo Transport
    19, // Lifeguard & Medical Relay
    24, // Military Logistics Transit
    25, // Vintage & Heritage Flight
    26, // Classic Airliner Charter
    29, // Military Cargo Transport
    32, // Strategic Reconnaissance
    33, // Vintage Propliner Freight
    35, // Intercontinental Scheduled Service
    36, // Intercontinental Heavy Freight
    37, // Intercontinental Executive Charter
    38  // Intercontinental Military Cargo Transport
];

// Fixed missions / intercontinental templates — long haul only (never in short haul).
const LONG_HAUL_EXCLUSIVE_MISSION_TYPES = [6, 35, 36, 37, 38];

// Pooled missions: only these scenario imgIds when long haul is on (excluded from short haul).
const LONG_HAUL_SCENARIOS_BY_MISSION = {
    16: [47, 49, 50, 55, 59],
    17: [80, 81],
    19: [70],
    24: [197, 198, 199, 200, 201, 202, 204],
    25: [151, 155, 157, 156],
    26: [163, 164, 165],
    32: [249, 250]
};

const missionMatrix = [
    // UNIQUE MISSION TEMPLATES — one mission (imgId) each via pool "uniqueMissions"
    { type: 1, name: "Noise Abatement Departure (EGLC)", detail: "Execute a steep climb out of EGLC.", pool: "uniqueMissions", weight: 1,  requiredDep: "EGLC", allowedAircraft: EGLC_JET_MISSION_TYPES, maxMTOW: 75500 },
    { type: 2, name: "Noise Abatement Departure (EGNS)", detail: "Execute a steep climb out of EGNS.", pool: "uniqueMissions", weight: 1, requiredDep: "EGNS", allowedAircraft: RESTRICTED_JET_MISSION_TYPES, maxMTOW: 75500 },
    { type: 3, name: "Ponte Aérea Commuter", detail: "Departing SBRJ requires precision due to the short runway and surrounding terrain. Utilize maximum takeoff thrust and be prepared for an immediate tight climbing turn after rotation.", pool: "uniqueMissions", weight: 1, requiredDep: "SBRJ", allowedAircraft: ["A319", "E190", "E195"], maxMTOW: 75500 },
    { type: 4, name: "Classic Cross-Country Rally", detail: "Pushing the Comanche to its cruise limits today. Monitor your cylinder head temperatures and carefully manage your mixture to optimize fuel burn for the rally.", pool: "uniqueMissions", weight: 1, allowedAircraft: ["PA24"] },
	{ type: 5, name: "High-Altitude Express", detail: "Take advantage of the aircraft's pressurization and climb rate to get above the regional weather systems. Keep your block time tight.", pool: "uniqueMissions", weight: 1, minAlt: 10000, rules: "IFR", allowedAircraft: ["C414", "B58T", "BE60", "STAR", "P180", "TBM8"] },
    { type: 6, name: "Hub-to-Hub Freight", detail: "You're operating out of one of the largest freight hubs tonight. Keep your speed up on the approach and don't miss your taxi turnoff. The warehouse teams are waiting.", pool: "uniqueMissions", weight: 1, allowedClasses: ["JET"], requiredTags: ["FREIGHTER"], requiredDep: ["EGNX", "EGLL", "EGSS", "EGCC", "VHHH", "ZSPD", "PANC", "KMEM", "KMIA", "OTHH"] },
    { type: 7,  name: "Whisperjet Operations", detail: "Your airframe was picked specifically for its quiet acoustic footprint. Adhere strictly to the descent profile and avoid late configuration changes.", pool: "uniqueMissions", weight: 1, allowedAircraft: ["RJ1F", "B462_QT", "B463_QT", "B462_MIL"] },
    { type: 8,  name: "Research Observation Flight", detail: "A local university needs optical data on changing topography. Maintain a steady track at low altitudes. Monitor your radial engine temperatures carefully.", pool: "uniqueMissions", weight: 10, allowedAircraft: ["U16"] },
    { type: 9,  name: "Remote Outpost Resupply", detail: "You're utilizing the Albatross's heavy lift capacity and rugged landing gear today. Execute a standard approach, but be mindful of the heavy control inputs required for this vintage airframe.", pool: "uniqueMissions", weight: 10, allowedAircraft: ["U16"] },
    { type: 10, name: "Commemorative Patrol Run", detail: "Flying a commemorative SAR route to honor the crews who operated these flying boats. Keep your eyes outside the cockpit, maintain visual contact with the terrain, and execute smooth, sweeping turns.", pool: "uniqueMissions", weight: 10, allowedAircraft: ["U16"] },
    { type: 11, name: "Survey Platform", detail: "A local university needs optical data on changing topography. Maintain a steady track at low altitudes. Monitor your radial engine temperatures carefully.", pool: "uniqueMissions", weight: 10, allowedAircraft: ["U16"] },
    { type: 12, name: "Remote Supply Drop", detail: "You're utilizing the Albatross's heavy lift capacity and rugged landing gear today. Execute a standard approach, but be mindful of the heavy control inputs required for this vintage airframe.", pool: "uniqueMissions", weight: 10, allowedAircraft: ["U16"] },
    { type: 13, name: "Commemorative SAR Demo", detail: "Flying a commemorative SAR route to honor the crews who operated these flying boats. Keep your eyes outside the cockpit, maintain visual contact with the terrain, and execute smooth, sweeping turns.", pool: "uniqueMissions", weight: 10, allowedAircraft: ["U16"] },
    // DYNAMIC MASTER TEMPLATES - no image required
    { type: 14, name: "Scheduled Commercial Service", pool: "commercial", weight: 15, allowedClasses: ["JET", "TURBO"], excludedTags: ["MILITARY_TRANSPORT", "REGIONAL"], requiredTags: ["PAX", "JETLINER"] },
    { type: 15, name: "Regional Commuter Pulse", pool: "commercial-regional", weight: 15, allowedClasses: ["TURBO", "JET"], excludedTags: ["HEAVY"], requiredTags: ["PAX", "REGIONAL"] },
    { type: 16, name: "Executive VIP Charter", pool: "executive", weight: 15, allowedClasses: ["GA", "BIZ JET", "TURBO", "HELI"], requiredTags: ["PAX"], minPaxSeats: 2, minPaxSeatsAppliesTo: ["HELI"], excludedAircraft: SMALL_GA_TRAINERS.concat(MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT) },
    { type: 17, name: "Light Freight Operations", pool: "lightFreight", weight: 15, allowedClasses: ["GA", "TURBO", "BIZ JET", "JET"], excludedTags: ["MILITARY_TRANSPORT", "HEAVY"], requiredTags: ["FREIGHTER"], maxMTOW: 5000, maxMTOWAppliesTo: ["GA", "TURBO"], excludedAircraft: MAINLINE_JET_FREIGHTERS },
    { type: 18, name: "Heavy Cargo Transport", pool: "heavyFreight", weight: 15, allowedClasses: ["JET", "TURBO"], requiredTags: ["FREIGHTER"], minCargo: 2000, excludedAircraft: ["VULC"] },
    { type: 19, name: "Lifeguard & Medical Relay", pool: "medical", weight: 15, allowedClasses: ["GA", "TURBO", "HELI", "BIZ JET"], excludedTags: ["HEAVY", "JETLINER"], requiredTags: ["MEDEVAC"] },
    { type: 20, name: "Aerial Survey & Inspection", pool: "surveyServices", weight: 15, allowedClasses: ["GA", "HELI"], excludedTags: ["FOUR_ENGINE", "HEAVY", "MILITARY_TRANSPORT", "HOTEL_MODE", "BIZ_JET"], excludedAircraft: ["C700"], requiredTags: ["PAX"], maxMTOW: 8000 },
    { type: 21, name: "Rotary Wing Operations", pool: "helicopterOps-CIV", weight: 15, allowedClasses: ["HELI"], civilianOnly: true },
    { type: 22, name: "Local Rotary Wing Operations", pool: "helicopterOps-CIV", weight: 15, allowedClasses: ["HELI"], isLocal: true, civilianOnly: true },
    { type: 23, name: "Tactical Sortie", pool: "tacticalJet-MIL", weight: 15, allowedClasses: ["JET", "WARBIRD"], militaryOnly: true, tacticalOnly: true, excludedTags: ["HEAVY", "JETLINER", "MILITARY_TRANSPORT"] },
    { type: 24, name: "Military Logistics Transit", pool: "militaryTransit-MIL", weight: 15, allowedClasses: ["TURBO", "JET", "HELI", "WARBIRD"], militaryOnly: true },
    { type: 25, name: "Vintage & Heritage Flight", pool: "vintageOps", weight: 15, allowedClasses: ["WARBIRD", "GA", "TURBO", "JET"], excludedTags: ["JETLINER", "MILITARY_TRANSPORT"], requiredTags: ["VINTAGE"] },
    { type: 26, name: "Classic Airliner Charter", pool: "vintageAirliner", weight: 15, allowedAircraft: ["DC6B"], excludedAircraft: ["DC6A"], requiredTags: ["PAX"], excludedTags: ["FREIGHTER"] },
    { type: 27, name: "Atmospheric & Research Services", pool: "highAltServices", weight: 15, allowedClasses: ["TURBO", "JET"], excludedTags: ["FOUR_ENGINE", "HEAVY", "REGIONAL", "JETLINER", "BIZ_JET"], excludedAircraft: ["C700", "STAR", "P180"], requiredTags: ["PAX"] },
    { type: 28, name: "Passenger & Air Taxi", pool: "lightPax", weight: 15, allowedClasses: ["GA", "TURBO", "BIZ JET", "HELI"], excludedTags: ["HEAVY", "JETLINER", "MILITARY_TRANSPORT", "SINGLE_SEAT"], requiredTags: ["PAX"], maxMTOW: 5000, maxMTOWAppliesTo: ["GA", "TURBO", "HELI"], excludedAircraft: SMALL_GA_TRAINERS },
    { type: 29, name: "Military Cargo Transport", pool: "heavyFreight-MIL", weight: 15, allowedClasses: ["JET", "TURBO"], requiredTags: ["FREIGHTER"], minCargo: 4000, militaryOnly: true, excludedAircraft: ["VULC"], excludedTags: ["BOMBER"] },
    { type: 30, name: "Military Heli-Ops", pool: "helicopterOps-MIL", weight: 15, allowedClasses: ["HELI"], militaryOnly: true },
    { type: 31, name: "Base Staff Shuttle", pool: "helicopterOps-MIL", weight: 15, allowedClasses: ["HELI"], militaryOnly: true, isLocal: true },
    { type: 32, name: "Strategic Reconnaissance", pool: "reconnaissance-MIL", weight: 15, allowedClasses: ["JET", "WARBIRD", "TURBO"], militaryOnly: true },
    { type: 33, name: "Vintage Propliner Freight", detail: "Classic propliner freight for the DC-6A. Keep your RPMs synced, mind the cowl flaps, and remember that descending takes planning when you don't have speedbrakes.", pool: "vintageProplinerFreight", weight: 15, allowedAircraft: ["DC6A"], excludedAircraft: ["DC6B"], requiredTags: ["FREIGHTER"], excludedTags: ["PAX"], minCargo: 2000 },
    { type: 34, name: "Gliding Operations", pool: "gliderOps", allowedClasses: ["GLIDER"], rules: "VFR/Scenic" },
    { type: 35, name: "Intercontinental Scheduled Service", pool: "longHaulOps", weight: 15, allowedClasses: ["JET"], excludedTags: ["MILITARY_TRANSPORT", "REGIONAL"], requiredTags: ["PAX", "JETLINER"] },
    { type: 36, name: "Intercontinental Heavy Freight", pool: "longHaulFreight", weight: 15, allowedClasses: ["JET", "TURBO"], requiredTags: ["FREIGHTER"], minCargo: 2000, excludedAircraft: ["VULC"].concat(MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT) },
    { type: 37, name: "Intercontinental Executive Charter", pool: "longHaulExecutive", weight: 15, allowedClasses: ["BIZ JET"], requiredTags: ["PAX", "VIP"] },
    { type: 38, name: "Intercontinental Military Cargo Transport", pool: "longHaulFreight-MIL", weight: 15, militaryOnly: true, allowedClasses: ["JET", "TURBO"], requiredTags: ["FREIGHTER"], minCargo: 2000, excludedAircraft: ["VULC"], excludedTags: ["BOMBER"] },
    { type: 39, name: "Regional Freight Pulse", pool: "regionalFreight", weight: 15, allowedClasses: ["JET", "TURBO"], excludedTags: ["HEAVY"], requiredTags: ["FREIGHTER", "REGIONAL"] }
];

const scenarioDB = {
    uniqueMissions: [
        { imgId: 1, missionType: 1, payload: "Noise Abatement Departure (EGLC)", instruction: "Execute a steep climb out of EGLC." },
        { imgId: 2, missionType: 2, payload: "Noise Abatement Departure (EGNS)", instruction: "Execute a steep climb out of EGNS." },
        { imgId: 3, missionType: 3, payload: "Ponte Aérea Commuter", instruction: "Departing SBRJ requires precision due to the short runway and surrounding terrain. Utilize maximum takeoff thrust and be prepared for an immediate tight climbing turn after rotation." },
        { imgId: 4, missionType: 4, payload: "Classic Cross-Country Rally", instruction: "Pushing the Comanche to its cruise limits today. Monitor your cylinder head temperatures and carefully manage your mixture to optimize fuel burn for the rally." },
        { imgId: 5, missionType: 5, payload: "High-Altitude Express", instruction: "Take advantage of the aircraft's pressurization and climb rate to get above the regional weather systems. Keep your block time tight." },
        { imgId: 6, missionType: 6, payload: "Hub-to-Hub Freight", instruction: "You're operating out of one of the largest freight hubs tonight. Keep your speed up on the approach and don't miss your taxi turnoff. The warehouse teams are waiting." },
        { imgId: 7, missionType: 7, payload: "Whisperjet Operations", instruction: "Your airframe was picked specifically for its quiet acoustic footprint. Adhere strictly to the descent profile and avoid late configuration changes." },
        { imgId: 8,   missionType: 8,  payload: "flying researchers over surface anomalies", instruction: "A local university needs optical data on changing topography. Maintain a steady track at low altitudes. Monitor your radial engine temperatures carefully.", allowedAircraft: ["U16"] },
        { imgId: 9,   missionType: 9,  payload: "delivering bulk provisions to a distant outpost", instruction: "You're utilizing the Albatross's heavy lift capacity and rugged landing gear today. Execute a standard approach, but be mindful of the heavy control inputs required for this vintage airframe.", allowedAircraft: ["U16"] },
        { imgId: 10,  missionType: 10, payload: "conducting a simulated patrol run", instruction: "Flying a commemorative SAR route to honor the crews who operated these flying boats. Keep your eyes outside the cockpit, maintain visual contact with the terrain, and execute smooth, sweeping turns.", allowedAircraft: ["U16"] },
        { imgId: 11, missionType: 11, payload: "Survey Platform", instruction: "A local university needs optical data on changing topography. Maintain a steady track at low altitudes. Monitor your radial engine temperatures carefully.", allowedAircraft: ["U16"] },
        { imgId: 12, missionType: 12, payload: "Remote Supply Drop", instruction: "You're utilizing the Albatross's heavy lift capacity and rugged landing gear today. Execute a standard approach, but be mindful of the heavy control inputs required for this vintage airframe.", allowedAircraft: ["U16"] },
        { imgId: 13, missionType: 13, payload: "Commemorative SAR Demo", instruction: "Flying a commemorative SAR route to honor the crews who operated these flying boats. Keep your eyes outside the cockpit, maintain visual contact with the terrain, and execute smooth, sweeping turns.", allowedAircraft: ["U16"] }
    ],
        commercial: [
        { imgId: 14, payload: "flying {team} to their next fixture", instruction: "Moving the primary roster, coaching staff, and medical equipment. Ensure a smooth climb and descent profile.", weight: 3 },
        { imgId: 15, payload: "flying a holiday charter group", instruction: "Standard passenger operations. Provide a comfortable ride for the start of their vacation." },
        { imgId: 16, payload: "recovering passengers after widespread weather groundings", instruction: "A severe storm system forced multiple regional cancellations yesterday. You have a full cabin of exhausted travelers eager to reach their destination.", weight: 3 },
        { imgId: 17, payload: "transporting travellers between hubs", instruction: "Operating a scheduled link between two major international hubs using high-capacity aircraft. Fly the filed routing strictly and ensure a stabilized approach." },
        { imgId: 18, payload: "transporting tourists to their destination", instruction: "The cabin is packed with people heading for their holidays. The schedule is tight, and the passengers are excited to start their holiday. Hit your block times.", requiredTags: ["JETLINER"] },
        { imgId: 19, payload: "ferrying professionals to a major tech convention", instruction: "A cabin full of corporate accounts and tech developers. Keep the turbulence to a bare minimum so they can work on their laptops during the cruise.", weight: 3 },
        { imgId: 20, payload: "operating a high-capacity holiday route", instruction: "Air traffic is heavy today due to the seasonal rush. Listen carefully to ATC for potential holding instructions and manage your fuel conservatively." },
        { imgId: 21, payload: "recovering a diverted flight after a regional system outage", instruction: "Passengers have been delayed for hours. Prioritize a smooth climb and continuous descent to get them to their final destination efficiently." },
        { imgId: 22, payload: "ferrying a corporate group to an annual summit", instruction: "The cabin is filled with exhausted professionals. Keep the PA announcements to a minimum and focus on a smooth ride." },
        { imgId: 23, payload: "operating the airline's most popular route", instruction: "Execute your procedures flawlessly. Expect quick turnaround today upon arrival at the destination gate.", requiredTags: ["JETLINER"] },
        { imgId: 24, payload: "operating a scheduled commercial sector", instruction: "Time is critical. Request priority handling from ATC on the approach and arrange for an immediate gate offload upon block-in.", requiredTags: ["JETLINER"] },
        { imgId: 25, payload: "operating a standard commercial sector", instruction: "Standard line operations. Execute normal company procedures and prioritize schedule adherence.", requiredTags: ["JETLINER"] },
        { imgId: 26, payload: "shuttling morning business travelers from hub to hub", instruction: "Keep approach speeds up as requested by ATC to smoothly integrate with mainline jet traffic before utilizing your primary braking profile on rollout.", requiredTags: ["JETLINER"] },
        { imgId: 27, payload: "transporting university students to a massive event", instruction: "The cabin is high-energy, fully booked, and rowdy. Expect a heavy payload in the cargo hold. Keep the seatbelt sign illuminated if the passengers get too unsettled in the back." },
        { imgId: 28, payload: "transporting a full symphony orchestra and their instruments", instruction: "A renowned orchestra has chartered this flight for their international tour. Maintain a gentle rate of climb and smooth out any turbulence." },
        { imgId: 29, payload: "flying a group of exchange students to their host country", instruction: "The cabin is buzzing with excited students traveling to meet their host families. Ensure a standard, safe operational profile.", requiredTags: ["JETLINER"], weight: 3 },
        { imgId: 30, payload: "transporting company personnel to a seminar", instruction: "Following a major corporate acquisition, you are ferrying employees to a massive integration event." },
        { imgId: 31, payload: "flying fans to a major championship final", instruction: "The manifest is entirely composed of die-hard sports fans heading to the biggest match of the year. The atmosphere is loud and celebratory." },
        { imgId: 32, payload: "transporting retirees to warmer climates for the winter", instruction: "You are operating a seasonal route packed with elderly passengers heading towards the sun. Prioritize a gentle rotation on takeoff and ensure a soft touchdown." }
    ],
    'commercial-regional': [
        { imgId: 33, payload: "operating a regional commuter sector", instruction: "Short sector, quick turnaround. Keep block times tight and fly an efficient profile suited to your turboprop or regional jet." },
        { imgId: 34, payload: "operating successive hops with short ground turnarounds", instruction: "For airframes equipped with a Hotel Mode or equivalent auxiliary system, utilize it on the ground to maintain climate controls without external power.", requiredTags: ["HOTEL_MODE"] },
        { imgId: 35, payload: "providing critical passenger links to a regional community", instruction: "This route maintains a vital connection for rural passengers. Adhere tightly to the schedule, as many travelers have tight connections at the destination hub." },
        { imgId: 36, payload: "operating a late-evening commuter flight outside of standard rush hours", instruction: "Air traffic will be minimal. Focus on a fuel-efficient climb and continuous descent profile to maximize the economic viability of this low-yield sector." },
        { imgId: 37, payload: "recovering passengers after widespread weather groundings", instruction: "A severe storm system forced multiple regional cancellations yesterday. Your E-Jet or CRJ is packed with exhausted short-haul travelers eager to reach their destination. Execute an efficient single-sector recovery." },
        { imgId: 38, payload: "transporting tourists to their destination", instruction: "Regional leisure sector at maximum capacity. Keep the schedule tight and hit your block times — your passengers are ready to start their holiday." },
        { imgId: 39, payload: "recovering a diverted flight after a regional system outage", instruction: "Passengers have been grounded for hours following a regional system failure. Your quick-turnaround regional jet is their lifeline. Prioritize a smooth continuous descent to get them home." },
        { imgId: 40, payload: "ferrying a corporate group to an annual summit", instruction: "The cabin is filled with professionals on a tight corporate schedule. Keep PA announcements to a minimum and maintain a smooth cruise profile for their working environment." },
        { imgId: 41, payload: "operating the airline's most popular route", instruction: "This is the backbone feeder sector of the regional schedule. Execute procedures flawlessly and expect a rapid turnaround at the destination gate." },
        { imgId: 42, payload: "operating a scheduled commercial sector", instruction: "Standard regional line operations on a hub feeder sector. Request priority sequencing where available and arrange immediate gate offload on block-in." },
        { imgId: 43, payload: "flying a group of exchange students to their host country", instruction: "The cabin is buzzing with excited students heading to meet their host families. Standard regional operations — keep it smooth and on schedule." },
        { imgId: 44, payload: "transporting company personnel to a seminar", instruction: "Following a corporate restructuring, you are ferrying regional office personnel to an integration event. Quick sector, full cabin — keep the schedule tight." }
    ],
	executive: [
        { imgId: 45, payload: "accommodating {name} on a private schedule", instruction: "Our Passenger has requested complete quiet on this trip. Focus on a smooth climb and descent profile.", weight: 15, requiredTags: ["VIP"], preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED, allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 46, payload: "chartering {athlete} to an upcoming fixture", instruction: "Your passenger requires absolute privacy and a smooth profile to ensure proper rest before the event.", weight: 15, requiredTags: ["VIP"], preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED },
        { imgId: 47, payload: "flying executive personnel to a negotiation", instruction: "Passengers expect an efficient, professional environment. Minimize PA announcements and focus on a smooth ride.", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 48, payload: "transporting an executive board to an offsite", instruction: "The cabin is functioning as a mobile office. Avoid turbulence to accommodate their work environment.", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 49, payload: "transporting state representatives", instruction: "High-profile passenger manifest. Strictly adhere to ATC instructions and maintain a professional profile.", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 50, payload: "transporting a {vip_type} to a high-level conference", instruction: "Get the red carpet out, we have a VIP on board today. Avoid abrupt control inputs, and prioritize cabin comfort during the transit.", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 51, payload: "shuttling executives to a regional facility", instruction: "Strict block times apply. The passengers have a tight itinerary on the ground.", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 52, payload: "operating a flight for a premium share owner", instruction: "The client expects flawless execution. Standard high-end private aviation service parameters apply.", allowedClasses: ["BIZ JET", "TURBO", "HELI"], weight: 3 },
        { imgId: 53, payload: "transporting prospective investors", instruction: "This flight is part of a corporate sales pitch. Ensure the flight profile is exceptionally smooth.", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 54, payload: "transporting a secure witness", instruction: "Standard point-to-point transit with heavy discretion. Park at the designated FBO away from the main terminal.", allowedAircraft: ["C208", "STAR", "M600", "TBM8", "B60T", "BE20", "PC12", "H145", "H14M"], allowedClasses: ["BIZ JET"], excludedTags: ["LIGHT_HELI"], weight: 3 },
        { imgId: 55, payload: "ferrying a Renaissance masterpiece to a private buyer", instruction: "This painting is worth more than the aircraft. Cabin temperature and humidity must remain perfectly static. Avoid all convective weather systems.", weight: 1, allowedClasses: ["BIZ JET", "TURBO", "HELI"], excludedAircraft: SMALL_GA_TRAINERS },
        { imgId: 56, payload: "rushing legal executives to an industrial incident", instruction: "A major PR disaster is unfolding at a regional facility. The strike team in the back is preparing their strategy. Expedite the routing; every minute counts.", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 57, payload: "chartering a tech mogul's purebred feline", instruction: "The client's prized cat needs transporting from a luxury pet retreat back home. The cabin is stocked with gourmet tuna and velvet cushions. Treat this feline with more respect than a CEO. Limit your bank angles.", weight: 1, allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 58, payload: "chartering a high-profile music icon", instruction: "{musician} wants to go shopping. Keep the pressurization comfortable and the bank angles shallow so they don't spill their champagne.", weight: 12, requiredTags: ["VIP"], preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED },
        { imgId: 59, payload: "flying an owner-operator profile to a holiday retreat", instruction: "The back is loaded with golf clubs and weekend luggage. Utilize the aircraft's excellent visibility to enjoy the scenic approach.", allowedClasses: ["BIZ JET"] },
        { imgId: 60, payload: "operating a short-hop business commute", instruction: "You are leap-frogging regional traffic today. Request direct routing where ATC permits to shorten the block time.", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 61, payload: "flying {musician} to their next stadium gig", instruction: "The artist and their core management team need uninterrupted rest. Climb above the weather quickly, avoid turbulence, and keep the cabin pressure stable so they are ready for the stage.", weight: 12, requiredTags: ["VIP"], preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED },
        { imgId: 62, payload: "flying {name} to meet a spiritual guru", instruction: "The media is actively tracking this tail number. Park at a discrete FBO upon arrival and maintain absolute confidentiality on the radios.", weight: 15, requiredTags: ["VIP"], preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED, excludedAircraft: SMALL_GA_TRAINERS },
        { imgId: 63, payload: "flying {athlete} to a championship fixture", instruction: "The star athlete needs to arrive rested and on time. Request priority handling where available and keep the ride butter-smooth.", weight: 15, requiredTags: ["VIP"], preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED },
        { imgId: 64, payload: "flying {name} to a film premiere", instruction: "The press is watching every movement. Maintain discretion on frequency, deliver a flawless approach, and be ready for a rapid FBO turnaround.", weight: 15, requiredTags: ["VIP"], preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED },
        { imgId: 65, payload: "chartering {team} executives to an away fixture", instruction: "Club leadership and senior staff are travelling under tight media scrutiny. Keep the profile smooth and hit the scheduled block time.", weight: 12, requiredTags: ["VIP"], preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED },
        { imgId: 66, payload: "rushing a specialized surgical team to a regional hospital", instruction: "This is an essential flight. Utilize the aircraft's maximum cruise speed and request priority routing from air traffic control. The transport teams are waiting for your arrival.", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 67, payload: "transporting a VIP to an exclusive private gala", instruction: "The client has chartered this jet for maximum comfort. The bar is fully stocked. Ensure a butter-smooth landing to keep the client in high spirits before they arrive at the event.", weight: 15, requiredTags: ["VIP"], preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED },
        { imgId: 68, payload: "rushing a tech CEO to a hostile board meeting", instruction: "The company's stock is plummeting and the CEO needs to be on the ground immediately to handle the fallout. Expedite all clearances and do not keep them waiting.", allowedClasses: ["BIZ JET", "TURBO", "HELI"] }
    ],
	medical: [
        { imgId: 69, payload: "airlifting a patient", instruction: "The patient is stable but prone to complications from severe turbulence. You need to monitor the weather radar closely, and get them to the destination smoothly." },
        { imgId: 70, payload: "transporting tissue for surgery", instruction: "Lifeguard priority. Time is the critical factor; request priority handling from ATC for your aircraft type. Helicopters cleared direct to the hospital. All other aircraft meet ground crew at destination." },
        { imgId: 71, payload: "airlifting a patient from a rural strip", instruction: "Operations into an uncontrolled field. Verify runway conditions before committing to the approach." }
    ],
	lightFreight: [
        { imgId: 72, payload: "securing classified diplomatic physical files", instruction: "Chain of custody requires direct point-to-point transit with zero unscheduled diversions." },
        { imgId: 73, payload: "delivering prototype processing units", instruction: "Payload is highly sensitive to static and temperature. Confirm environmental control systems are nominal before taxi." },
        { imgId: 74, payload: "transferring a protected animal species", instruction: "Live cargo onboard. Maintain a shallow bank angle and avoid sudden thrust adjustments." },
        { imgId: 75, payload: "delivering fragile conservation saplings", instruction: "Live plant matter requires specific cabin pressurization limits. Cross-check your descent rate." },
        { imgId: 76, payload: "transporting primary digital master drives", instruction: "These drives contain unbacked-up production footage. Expedite routing where ATC allows." },
        { imgId: 77, payload: "relocating degrading historical manuscripts", instruction: "Items are packed in climate-controlled cases. Ensure ground handling is ready immediately upon block-in." },
        { imgId: 78, payload: "rushing a critical Aircraft on Ground component", instruction: "Another aircraft is stranded waiting for this part. Expedite your routing and approach." },
        { imgId: 79, payload: "expediting priority medical freight", instruction: "Temperature-controlled medical cargo must reach a regional hospital without delay. Request priority handling from ATC and keep pressurization stable.", excludedTags: ["HEAVY", "LIGHT_GA", "ROTORCRAFT", "MILITARY_TRANSPORT", "WARBIRD", "AMPHIBIAN"] },
        { imgId: 80, payload: "transporting {med_cargo}", instruction: "Cabin temperature must be strictly regulated. Avoid rapid altitude changes to prevent pressurization spikes.", requiredTags: ["MEDEVAC"] },
        { imgId: 81, payload: "expediting {med_cargo}", instruction: "A regional clinic requires these items for an impending procedure. Minimize block time.", requiredTags: ["MEDEVAC"] },
        { imgId: 82, payload: "hauling locally farmed produce from a rural strip", instruction: "The farmer has finished loading fresh produce straight from the field. Depart promptly while the cargo is still cold and dry.", excludedTags: ["JETLINER", "BIZ_JET", "HEAVY", "FOUR_ENGINE", "MILITARY_TRANSPORT", "ROTORCRAFT"] },
        { imgId: 83, payload: "moving regional express packages overnight", instruction: "Night freight operations. Hit your slot times to keep the logistics network flowing.", excludedAircraft: MAINLINE_JET_FREIGHTERS, excludedTags: ["HEAVY"] },
        { imgId: 84, payload: "delivering regional post parcels", instruction: "A classic contract. Weight is strictly calculated. Do not loiter; you have multiple stops to make before sunset.", allowedAircraft: ["C20F", "C208", "KODF", "PC1F"] },
        { imgId: 85, payload: "delivering essential supplies to customers", instruction: "Payload includes basic supplies and mail. Double-check your density altitude calculations." },
        { imgId: 86, payload: "delivering regional supplies", instruction: "Ensure your landing performance is calculated for your arrival weight, use reverse thrust if the destination runway length is limited.", excludedAircraft: ["B72F"] },
 		{ imgId: 87, payload: "shuttling regional lab samples and {med_cargo}", instruction: "You're bypassing the hubs to deliver directly to a regional location. Don't let the small payload fool you, lives depend on sticking to the planned block time." },
        { imgId: 88, payload: "distributing the morning broadsheets", instruction: "It's 4 AM, the coffee is weak, and the hold is full of today's news. Get this ink to the regional distributors before breakfast" },
        { imgId: 89, payload: "rushing iced, premium seafood to inland markets", instruction: "The ice is already melting. You need to get this catch from the warehouse to the restaurants before the dinner rush. Keep the environmental control system freezing cold." },
        { imgId: 90, payload: "relocating the airframe to a certified avionics shop", instruction: "The primary GPS is inoperative. Rely on basic VFR pilotage and dead reckoning for this transit, and keep your eyes outside the cockpit." },
        { imgId: 91, payload: "rushing a rare component to a stranded client", instruction: "A high-net-worth client's vintage car has broken down. Time is of the essence. Maximize your cruise speed while keeping engine parameters in the green." },
        { imgId: 92, payload: "ferrying critical machinery parts to a regional facility", instruction: "Harvest season is in full swing and a primary commercial combine harvester is down. Get these parts to the destination as fast as safely possible." },
        { imgId: 93, payload: "delivering a recently purchased airframe", instruction: "The broker just handed over the keys. Fly this bird to its new home base. Keep an eye on engine temps; she hasn't flown much this season." },
        { imgId: 94, payload: "connecting rural farm airstrips with mail and supplies", instruction: "A classic contract hopping short grass strips before sunset. Weight is strictly calculated at each stop. Keep your pattern work crisp and your landings soft.", excludedTags: ["JETLINER", "HEAVY", "FOUR_ENGINE", "BIZ_JET", "ROTORCRAFT", "MILITARY_TRANSPORT", "REGIONAL"] },
        { imgId: 95, payload: "delivering supplies to a community", instruction: "Essential food, fuel, and mail are bound for a community with no road access. Verify your landing performance for the short strip.", allowedAircraft: ["C20F", "C208", "KODF", "PC1F"] }
    ],
    regionalFreight: [
        { imgId: 96, payload: "moving regional express packages overnight", instruction: "Night freight operations on a regional express sector. Your BAe 146 freighter or CRJ freighter needs to hit slot times to keep the logistics network on schedule.", excludedAircraft: MAINLINE_JET_FREIGHTERS, preferredAircraft: REGIONAL_JET_FREIGHTERS },
        { imgId: 97, payload: "moving priority overnight parcels", instruction: "Time-critical sort facility run. Request direct routing to makeup for any turnaround delays.", preferredAircraft: REGIONAL_JET_FREIGHTERS },
        { imgId: 98, payload: "operating an overnight regional freight sector", instruction: "The logistics network relies on these red-eye flights to clear regional sorting hubs. Adhere tightly to your ATC slot times and manage your descent profile during the quiet hours.", preferredAircraft: REGIONAL_JET_FREIGHTERS },
        { imgId: 99, payload: "expediting priority medical freight", instruction: "Temperature-controlled medical cargo must reach a regional hospital without delay. Your regional freighter is the fastest link in this chain — request priority handling from ATC.", excludedTags: ["LIGHT_GA", "ROTORCRAFT", "MILITARY_TRANSPORT", "WARBIRD", "AMPHIBIAN"] },
        { imgId: 100, payload: "shuttling regional lab samples and {med_cargo}", instruction: "Bypassing the hubs for direct point-to-point delivery. Your regional freighter's quick-turnaround capability is exactly what this time-critical medical shipment needs." },
        { imgId: 101, payload: "ferrying critical machinery parts to a regional facility", instruction: "Harvest season is in full swing and a commercial combine is down. Your regional freighter is the fastest option — maximize cruise speed and get these parts to the field." },
        { imgId: 102, payload: "delivering regional supplies", instruction: "Regional supply run to a smaller destination. Calculate your landing performance for arrival weight and use reverse thrust if the destination runway is limited for your regional freighter.", excludedAircraft: ["B72F"], preferredAircraft: REGIONAL_JET_FREIGHTERS },
        { imgId: 103, payload: "operating a late-evening regional freight sector", instruction: "Late-evening red-eye on a quiet regional network. Air traffic is minimal — fly an efficient fuel-saving profile and keep the logistics chain moving through the night.", preferredAircraft: REGIONAL_JET_FREIGHTERS }
    ],
	heavyFreight: [
        { imgId: 104, payload: "delivering palletized nutrition and water packs", instruction: "Local supply chains are disrupted. Prioritize a direct routing to expedite relief efforts." },
        { imgId: 105, payload: "delivering retail warehouse garment supplies", instruction: "Cargo is boxed but requires a clean, dry hold. Standard freight operations apply.", excludedAircraft: MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT },
        { imgId: 106, payload: "transporting authenticated, historical artifacts", instruction: "We are moving items that belong in a museum. The cargo is extremely fragile and heavily guarded. Keep your descent rates shallow and avoid heavy braking upon landing.", weight: 3, excludedAircraft: MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT },
        { imgId: 107, payload: "moving {cargo_type}", instruction: "Engineers are waiting at the destination to utilize this hardware. Keep to the scheduled block times.", excludedAircraft: ["DC6A"].concat(MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT) },
        { imgId: 108, payload: "delivering luxury vehicles and parts", instruction: "High-value, dense freight. Ensure the loadmaster has verified all securing straps before closing the cargo door.", excludedAircraft: ["B461_MIL", "B462_MIL", "DC6A"].concat(MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT) },
        { imgId: 109, payload: "loading a high-value luxury sports car", instruction: "A bespoke supercar is secured on dedicated air-freight dollies. Avoid abrupt control inputs and confirm the restraint chains before closing the cargo door.", weight: 3, excludedAircraft: ["B461_MIL", "B462_MIL", "DC6A"].concat(MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT) },
        { imgId: 110, payload: "ferrying {cargo_type} and heavy oilfield equipment", instruction: "This payload is heavy and bolted straight to the floor rails. You'll be flying slower today. Watch your fuel burn and don't get behind the power curve on final.", requiredTags: ["HEAVY"] },
        { imgId: 111, payload: "returning a decommissioned avionics bay", instruction: "Standard industrial freight. Verify tie-downs before departure." },
        { imgId: 112, payload: "transporting premium edible goods for wholesale", instruction: "Maintain a stable holding temperature in the cargo bay to prevent spoilage of high-end ingredients.", excludedAircraft: MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT },
        { imgId: 113, payload: "transporting bulk commercial perishables", instruction: "High-density cargo. Monitor your V-speeds closely during the takeoff roll due to the heavy load.", excludedAircraft: MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT },
        { imgId: 114, payload: "moving priority overnight parcels", instruction: "Time-critical sort facility run. Request direct routing to makeup for any turnaround delays.", requiredTags: ["FREIGHTER", "JETLINER"], excludedTags: ["REGIONAL"], excludedAircraft: MIL_AIRLIFTER_EXCLUDED_OVERNIGHT_PARCELS.concat(REGIONAL_JET_FREIGHTERS) },
        { imgId: 115, payload: "transporting heavy secure bullion", instruction: "High-value central bank transfer. Security details will handle the loading and unloading.", weight: 3 },
        { imgId: 116, payload: "moving an oversized, max-payload cargo manifest", instruction: "You are operating right at MTOW today. Be prepared for an exceptionally long takeoff roll and a sluggish initial climb rate. Double-check your V-speeds.", excludedAircraft: ["DC6A"] },
        { imgId: 117, payload: "operating an overnight route", instruction: "The logistics network relies on these red-eye flights to clear the major sorting hubs. Adhere tightly to your ATC slot times and carefully manage your heavy descent profile during the quiet hours.", preferredAircraft: REGIONAL_JET_FREIGHTERS, excludedAircraft: MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT },
        { imgId: 118, payload: "moving an absolute mountain of impulse buys", instruction: "The sort facility is completely backed up and your hold is packed tight. Expect a heavy rotation and a step-climb if the air is warm tonight.", excludedAircraft: MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT },
        { imgId: 119, payload: "transporting Formula racing chassis and paddock gear", instruction: "High-value, time-critical, and incredibly fragile. Keep the turbulence to a minimum, those front wings cost more than my house.", weight: 3, excludedAircraft: ["DC6A"].concat(MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT) },
        { imgId: 120, payload: "loading heavy industrial machinery", instruction: "The loadmaster is still securing oversized plant equipment on the main deck. Confirm all tie-downs and floor-loading limits before requesting pushback.", excludedAircraft: ["DC6A"] },
        { imgId: 121, payload: "loading a heavy industrial generator", instruction: "Ground crews are securing an oversized yellow generator onto the cargo deck. Verify floor load limits, tie-down chains, and centre of gravity before requesting pushback.", excludedAircraft: ["DC6A"] },
        { imgId: 122, payload: "transporting a replacement engine turbine module", instruction: "This fan module is fragile, high-value, and urgently needed for an AOG recovery. Keep the ride smooth and the hold temperature stable." },
        { imgId: 123, payload: "transporting server racks and data-centre hardware", instruction: "Sensitive IT hardware cannot tolerate rough handling or rapid pressurization changes. Fly a smooth profile and keep the cabin within spec." }
    ],
    surveyServices: [
        { imgId: 124, payload: "distributing localized civic awareness materials", instruction: "Fly the assigned grid pattern to ensure even distribution across the target sector." },
        { imgId: 125, payload: "surveying local power and pipeline grids", instruction: "Maintain VFR minimums along the designated inspection corridor. Keep a sterile cockpit during the survey." },
        { imgId: 126, payload: "inspecting crop yields", instruction: "Maintain low altitude over the designated sectors. Watch for unmarked power lines." },
        { imgId: 127, payload: "mapping a municipal expansion zone", instruction: "Fly carefully along this route so that the survey team can collect accurate readings." },
        { imgId: 128, payload: "mapping subsurface anomalies", instruction: "Maintain a constant airspeed and altitude to ensure the magnetometer data remains clean." },
        { imgId: 129, payload: "flying insurance assessment teams", instruction: "Severe weather ripped through this sector yesterday. Maintain your profile over the affected areas so the adjusters can use ground scanning technology to assess damage." },
        { imgId: 130, payload: "flying LIDAR equipment over suspected ancient ruins", instruction: "University researchers believe there is an unexcavated settlement hidden beneath the surface. Maintain strict altitude and tracking across the grid." },
        { imgId: 131, payload: "flying a photographer for a high-end property portfolio", instruction: "The client needs clean, stable orbits over several waypoint markers. Coordinate with the photographer and keep the airframe as smooth as possible.", excludedAircraft: ["U16"] },
        { imgId: 132, payload: "flying researchers over a {sci_fi}", instruction: "Map the area from above. Do your best to ignore the bizarre static interference bleeding through the comms.", weight: 3, excludedTags: ["MILITARY_HELI"] },
        { imgId: 133, payload: "assisting authorities in a visual search for a missing vehicle", instruction: "Fly over the last known coordinates at a low altitude. Keep your airspeed at best endurance and keep your eyes peeled for improvised distress signals.", weight: 3, excludedAircraft: ["BE60", "STAR"], excludedGaTags: ["TWIN_ENGINE"] },
    ],
    lightPax: [
        { imgId: 134, payload: "moving industrial staff between sites", instruction: "Routine personnel transfer. Standard operational procedures apply." },
        { imgId: 135, payload: "conducting a standardization flight", instruction: "Focus on standard maneuvers and clean radio work in the local traffic pattern.", weight: 3 },
        { imgId: 136, payload: "shuttling an independent engineering consultant", instruction: "The passenger is reviewing documents mid-flight. Find smooth air and avoid sharp control inputs during the transit to accommodate their work." },
        { imgId: 137, payload: "providing critical passenger links to a rural community", instruction: "This rural community depends on your light aircraft connection. Adhere tightly to the schedule — many passengers have tight onward connections at the destination hub." },
        { imgId: 138, payload: "accommodating {name} on a private schedule", instruction: "Your passenger has requested complete quiet and discretion. Focus on a smooth climb and descent profile on this turboprop or light business aircraft charter.", weight: 12, allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 139, payload: "flying {name} to meet a spiritual guru", instruction: "The media is actively tracking this flight. Park away from the main building and maintain absolute confidentiality on the radios. Small turboprop or light twin, big responsibility.", weight: 12, excludedAircraft: SMALL_GA_TRAINERS, allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 140, payload: "flying a romantic, scenic twilight flight", instruction: "Keep the engine RPM smooth, avoid steep banks, and maintain a gentle flight profile to ensure the moment goes off without a hitch.", weight: 1, excludedTags: ["HOTEL_MODE", "MILITARY_HELI", "LIGHT_HELI"] },
        { imgId: 141, payload: "rushing a stranded businessman to a regional hub", instruction: "Your passenger missed their commercial connection and booked the last available seat with you. Can you save the day?", weight: 2, excludedTags: ["MILITARY_HELI"] },
        { imgId: 142, payload: "bringing passengers home to their families", instruction: "Your service is the only link between these communities today. Plan your fuel carefully, watch for approach winds, and grease the landing.", excludedTags: ["HOTEL_MODE", "MILITARY_HELI", "HEAVY", "JETLINER", "REGIONAL"] },
        { imgId: 143, payload: "flying a honeymooning couple to a remote retreat", instruction: "A newly-wed couple has chartered your light aircraft for a romantic getaway. Keep the turns gentle, find smooth air for the cruise, and make the landing as soft as they expect the holiday to be.", weight: 1, excludedTags: ["HOTEL_MODE", "MILITARY_HELI", "HEAVY", "JETLINER"] },
        { imgId: 144, payload: "transporting a regional medical examiner to an incident site", instruction: "Time-sensitive call-out. The medical examiner needs to reach the site as quickly as safely possible. Confirm runway conditions before committing to the approach.", weight: 3, excludedTags: ["HOTEL_MODE", "JETLINER", "HEAVY"] },
        { imgId: 145, payload: "delivering urgent freight to a private airstrip", instruction: "A rural estate has placed an urgent order for essential materials. Your light aircraft is the only option for this short-strip destination. Watch your crosswind component on final.", excludedTags: ["HOTEL_MODE", "MILITARY_HELI", "JETLINER", "HEAVY"] },
        { imgId: 146, payload: "repositioning an aircraft for its new owner", instruction: "The deal is done and the keys have been handed over. Ferry this light aircraft from the broker's field to its new home base. Monitor engine temps carefully on this unfamiliar airframe.", excludedTags: ["MILITARY_HELI", "JETLINER", "HEAVY"] }
    ],
    highAltServices: [
        { imgId: 147, payload: "gathering specific meteorological data", instruction: "Fly the requested altitudes and headings strictly to ensure accurate environmental readings." },
        { imgId: 148, payload: "transporting atmospheric researchers to a developing system", instruction: "Your passengers need to deploy localized sensors ahead of a major pressure shift. Get them close enough to observe, but avoid actual convective activity." }
    ],
    vintageOps: [
        { imgId: 149, payload: "performing a historic flight demonstration", instruction: "The aircraft is requested for a static display and a brief aerial routine. Ensure all fluid systems are checked before departure.", allowedAircraft: ["DC6B"], excludedAircraft: ["DC6A"], weight: 3 },
        { imgId: 150, payload: "positioning for a closed-course handicap race", instruction: "Standard visual transit to the race staging field. Ensure the airframe is clean and trimmed.", excludedAircraft: ["U16", "DC6A", "DC6B", "V10", "P38"] },
        { imgId: 151, payload: "ferrying a vintage airframe to an aviation museum", instruction: "Authentic historical aviation mission. Operate the aircraft smoothly and strictly within structural limits to preserve the aging airframe." },
        { imgId: 152, payload: "acting as a chase plane for a historic squadron", instruction: "Maintain visual separation and monitor engine temperatures during extended formation power settings.", allowedClasses: ["GA"], requiredTags: ["SINGLE_ENGINE"] },
        { imgId: 153, payload: "conducting a commemorative low-level transit", instruction: "Execute a precise time-on-target profile over the designated memorial coordinates." },
        { imgId: 154, payload: "maintaining pilot currency in historic airframes", instruction: "Execute standard local maneuvers to ensure the aircraft and pilot remain certified for upcoming public displays." },
        { imgId: 155, payload: "delivering a newly restored airframe to a preservation trust", instruction: "This aircraft is a piece of history and practically priceless. Engine parameters must be strictly monitored. Avoid all convective weather systems, as the airframe is expected pristine on the museum ramp." },
        { imgId: 156, payload: "ferrying to a regional aviation festival", instruction: "You are expected at the event staging grounds before sunset. Keep your cruise power settings conservative to preserve engine life. Expect crowds watching your arrival.", excludedTags: ["BIZ_JET"] },
        { imgId: 157, payload: "flying a chartered remembrance flight.", instruction: "Fly  in memory of those who previously flew this airframe. Keep the maneuvers gentle and ensure all fluid systems are in the green.", weight: 3 }
    ],
	// DC-6A freight exclusive
    vintageProplinerFreight: [
        { imgId: 158, payload: "Oversized Vintage Freight", instruction: "A classic load for a classic bird. Keep your RPMs synced, mind the cowl flaps, and remember that descending takes planning when you don't have speedbrakes." },
        { imgId: 159, payload: "Live Agricultural Freight", instruction: "The cargo hold smells terrible, but the payout is fantastic. Limit your bank angles and make the landing a greaser." },
        { imgId: 160, payload: "transporting heavy goods utilizing vintage airframes", instruction: "Monitor your engine temperatures, manage the flight engineer panel diligently, and anticipate slower control responses.", allowedAircraft: ["DC6A"] },
        { imgId: 161, payload: "loading palletized commercial freight", instruction: "Warehouse teams are still building the pallet build-up. Hit your departure slot or the entire sort window will slip.", preferredAircraft: ["DC6A"] }
    ],
	// DC-6B PAX Exclusive
    vintageAirliner: [
        { imgId: 162, payload: "operating a premium overnight cross-country journey", instruction: "Maintain exceptionally smooth pitch controls and an effortless step-climb profile to avoid waking sleepers in the main cabin.", allowedAircraft: ["DC6B"], excludedAircraft: ["DC6A"] },
        { imgId: 163, payload: "transporting holiday makers across the country", instruction: "Monitor radial engine cylinder head temperatures closely on the ground, and clear the cowl flaps early before navigating any localized weather patterns.", allowedAircraft: ["DC6B"], excludedAircraft: ["DC6A"] },
        { imgId: 164, payload: "shuttling a full manifest of {industry} executives and engineers to extraction sites", instruction: "Ensure the flight engineer manages fuel cross-feeds meticulously to maintain a balanced center of gravity.", allowedAircraft: ["DC6B"], excludedAircraft: ["DC6A"] },
        { imgId: 165, payload: "carrying sports enthusiasts to their destination", instruction: "Verify that your carburetor heat and airframe de-icing boots are fully operational before entering the terminal control area.", allowedAircraft: ["DC6B"], excludedAircraft: ["DC6A"] },
        { imgId: 166, payload: "flying an iconic passenger shuttle service", instruction: "Anticipate a sluggish initial climb rate and closely track your power recovery settings to preserve engine life.", allowedAircraft: ["DC6B"], excludedAircraft: ["DC6A"] }
    ],
    'helicopterOps-CIV': [
        { imgId: 167, payload: "conducting a local scenic flight", instruction: "Execute a standard visual pattern around local landmarks before landing at the destination. Maintain safe separation from other general aviation traffic." },
        { imgId: 168, payload: "providing a stable platform for a survey photographer", instruction: "Coordinate with the photographer to provide clean orbits around their requested waypoints." },
        { imgId: 169, payload: "monitoring local transit corridors", instruction: "Fly a holding pattern over major interchanges to allow the spotter to broadcast conditions." },
        { imgId: 170, payload: "operating a short on-demand charter", instruction: "Client requires a rapid hop to bypass ground traffic. Direct routing is preferred." },
        { imgId: 171, payload: "extracting a trauma victim from a major roadway", instruction: "First responders have secured a landing zone. Proceed immediately.", excludedTags: ["LIGHT_HELI"] },
        { imgId: 172, payload: "locating a stranded group of travellers", instruction: "Execute search patterns over the last known coordinates. Be prepared for hoisting operations.", excludedTags: ["LIGHT_HELI"] },
        { imgId: 173, payload: "providing aerial overwatch", instruction: "Coordinate with ground units. Maintain a safe operational altitude above the target area." },
        { imgId: 174, payload: "mapping a new property development", instruction: "Execute precise tracks across the survey grid to ensure overlapping optical coverage." },
        { imgId: 175, payload: "positioning industrial equipment", instruction: "Precision hover required. Monitor engine limits closely during the heavy lift phase.", excludedTags: ["LIGHT_HELI"] },
        { imgId: 176, payload: "locating tagged animal populations", instruction: "Maintain visual contact while the biologists log the telemetry data." },
        { imgId: 177, payload: "shuttling an executive from the airport", instruction: "Corporate transfer. Provide a smooth transition from the FBO to the destination helipad." },
        { imgId: 178, payload: "providing live coverage of a civic event", instruction: "Establish a loiter pattern clear of other traffic. Keep movements predictable for the camera operator." },
        { imgId: 179, payload: "capturing dynamic tracking shots", instruction: "Coordinate closely with the ground director to match the pace of the subject." },
        { imgId: 180, payload: "moving heavy pipe segments into rugged terrain", instruction: "You will be conducting precision hovering operations with external loads. Keep a close eye on engine torque and rotor RPM limits while maneuvering the segments into place.", excludedTags: ["LIGHT_HELI"], minCargo: 201 },
        { imgId: 181, payload: "cleaning high-tension wire infrastructure", instruction: "Fly low and slow alongside the high-voltage lines so the boom operator can blast the insulators with deionized water. Wind drift management is critical here." },
        { imgId: 182, payload: "transporting highly sensitive legal tenders", instruction: "The payload is handcuffed to the courier. Execute a standard transit and prepare for an immediate engine-running offload upon arrival." },
        { imgId: 183, payload: "airlifting an unidentifiable metallic pillar", instruction: "A smooth, impossibly heavy metallic pillar was discovered deep in a slot canyon. Ground crews are reporting sudden temperature drops and severe compass spin near the object.", minCargo: 201, weight: 1, excludedTags: ["LIGHT_HELI"] },
    ],
	// MILITARY
	'heavyFreight-MIL': [
        { imgId: 184, payload: "moving dense tactical vehicle components", instruction: "Heavy payload. Ensure careful CG management during loadsheet verification before engine start." },
        { imgId: 185, payload: "relocating modular defense components", instruction: "Equipment is required at the destination depot for immediate assembly. Adhere strictly to the filed flight plan." },
        { imgId: 186, payload: "moving sensitive industrial hardware", instruction: "Sealed manifests. Proceed directly to the designated remote ramp upon arrival." },
        { imgId: 187, payload: "ferrying urgent technical spares to a regional depot", instruction: "Priority load. Ensure on-time arrival to prevent maintenance schedule slippage." },
        { imgId: 188, payload: "transporting AOG parts for a fleet-wide inspection", instruction: "Expedite arrival. Maintenance crews are standing by for this specific hardware." },
        { imgId: 189, payload: "loading tactical cargo pallets", instruction: "Palletized military stores are being secured on the main deck. Verify tie-down tension and centre of gravity before engine start.", allowedAircraft: ["C160"] },
        { imgId: 190, payload: "delivering refugee relief supply pallets", instruction: "Humanitarian pallets are bound for a forward distribution point. Maintain schedule and confirm offload teams are standing by on arrival.", allowedAircraft: ["C160", "A400"] }
    ],
    'helicopterOps-MIL': [
        { imgId: 191, payload: "deploying a specialized ground team", instruction: "Approach the LZ utilizing terrain masking. Ensure a stabilized hover for deployment.", excludedTags: ["LIGHT_HELI"], heliOps: true },
        { imgId: 192, payload: "conducting a perimeter survey", instruction: "Intel suggests increased uncooperative surface movement along the vector. Maintain a steady track along the assigned corridor, record anomalies, and do not engage. Loiter fuel must be strictly managed.", heliOps: true },
        { imgId: 193, payload: "flying visiting dignitaries around the installation", instruction: "Maintain a smooth flight profile to allow clear photography of the base facilities from a safe standoff distance.", staffShuttle: true },
        { imgId: 194, payload: "conducting a local SAR training sortie", instruction: "Fly to the training grid and practice low-altitude hover patterns. Keep a sharp lookout for the training beacons.", heliOps: true },
        { imgId: 195, payload: "delivering essential provisions to an observation post", instruction: "Payload includes field rations and replacement radio batteries. Approach the LZ carefully, watching for unpredictable wind shear.", excludedTags: ["LIGHT_HELI"], heliOps: true },
        { imgId: 196, payload: "transporting regional commanders to a joint briefing", instruction: "Provide a comfortable transit. Security protocols dictate a direct routing with no unnecessary deviations.", excludedTags: ["LIGHT_HELI"], staffShuttle: true }
    ],
    'militaryTransit-MIL': [
        { imgId: 197, payload: "transferring encrypted telemetry hardware", instruction: "Cargo contains secure flight data recorders from a defense contractor. Standard operational security applies." },
        { imgId: 198, payload: "moving unmarked secure containers", instruction: "Flight plan filed under discrete routing. Maintain standard communication but proceed directly to the destination.", excludedTags: ["FIGHTER", "FAST_JET"] },
        { imgId: 199, payload: "relocating contracted defense personnel", instruction: "Standard military charter. Maintain schedule and follow standard heavy jet procedures.", excludedTags: ["FIGHTER", "FAST_JET"] },
        { imgId: 200, payload: "repositioning to a strategic staging airfield", instruction: "Standard peacetime transit. Keep a sterile cockpit and coordinate with military ATC for your arrival window." },
        { imgId: 201, payload: "executing a peacetime navigation exercise", instruction: "Focus on precise fuel management and exact waypoint timings. Maintain standard ATC communications where required.", excludedTags: ["ROTORCRAFT"] },
        { imgId: 202, payload: "relocating staff personnel under tactical escort", instruction: "Low-profile transit. Direct routing required with strict adherence to assigned flight levels.", excludedTags: ["FIGHTER", "FAST_JET"], excludedAircraft: ["VULC"] },
        { imgId: 203, payload: "delivering priority diplomatic communications", instruction: "Chain of custody must be maintained. Do not deviate from the filed flight path." },
        { imgId: 204, payload: "transferring cryogenic xenobiological tissue samples", instruction: "Captain, officially, this flight does not exist. Ignore any anomalous knocking sounds from the hold and do not log this route.", weight: 1 },
        { imgId: 205, payload: "providing high-speed search and rescue support", instruction: "Scan along the flight path for emergency beacons or visual distress signals. Relay coordinates to the extraction teams and maintain your assigned low-level search profile.", excludedTags: ["FOUR_ENGINE", "ROTORCRAFT", "LIGHT_GA", "MILITARY_TRANSPORT", "FREIGHTER"] },
        { imgId: 206, payload: "patrolling the designated vector for surface anomalies", instruction: "Maintain visual contact with the surface and report any unregistered traffic to sector command.", excludedTags: ["FOUR_ENGINE", "ROTORCRAFT", "LIGHT_GA", "FREIGHTER", "MILITARY_TRANSPORT"] },
        { imgId: 207, payload: "providing a localized UHF/VHF relay for ground exercises", instruction: "Establish a stable holding pattern over the sector. Monitor fuel consumption during this extended endurance task.", excludedTags: ["FOUR_ENGINE", "ROTORCRAFT", "LIGHT_GA", "HEAVY", "FREIGHTER", "MILITARY_TRANSPORT"] }
    ],
    'tacticalJet-MIL': [
        { imgId: 208, payload: "gathering passive telemetry data", instruction: "Fly the precise filed routing to allow onboard (or pod-mounted) equipment to triangulate regional signal traffic." },
        { imgId: 209, payload: "providing a target profile for ground-based early warning systems", instruction: "Adhere strictly to the requested altitude and airspeed so ground stations can calibrate their primary radar returns." },
        { imgId: 210, payload: "intercepting unidentified radar contacts", instruction: "Maintain high-speed cruise and monitor tactical displays for vectored intercepts." },
        { imgId: 211, payload: "conducting a cooperative cross-service nav exercise", instruction: "Match flight profiles with allied assets. Precision timing is critical for the rendezvous." },
        { imgId: 212, payload: "verifying long-range optical and radar sensor integrity", instruction: "Ground stations require a target to calibrate tracking telemetry. Sensor pods require minimal airframe vibration for optimal data capture, keep it smooth Captain." },
        { imgId: 213, payload: "re-validating primary approach vectors", instruction: "Standard non-precision approach practice. Ensure all radio navigation aids are correctly logged." },
        { imgId: 214, payload: "repositioning airframes for off-cycle maintenance", instruction: "Ferry flight. Engine monitoring is the primary objective. Keep temperatures within optimal range." },
        { imgId: 215, payload: "conducting a two-ship proficiency transit", instruction: "Ensure wingman separation remains within specified parameters throughout the climb and cruise." },
        { imgId: 216, payload: "conducting a handling and proficiency check", instruction: "Execute the filed route focusing on precise energy management and high-G maneuvers. Adhere strictly to the floor altitudes during the simulated combat phase." },
        { imgId: 217, payload: "executing a high-speed, terrain-masking profile", instruction: "This route requires utilization of terrain-following systems or strict visual low-level navigation. Maintain 250 feet AGL through the transit corridor and watch out for bird strikes." },
        { imgId: 218, payload: "providing support for regional exercises", instruction: "You are tasked as 'Red Air' for today's sortie. Fly the intercept vectors to test the response times of friendly ground radar and interceptors. Acknowledge simulated radar contacts and return to base.", excludedAircraft: ["B461_MIL"] },
        { imgId: 219, payload: "ferrying to a regional aviation festival", instruction: "You are expected at the event staging grounds before sunset. Keep your cruise power settings conservative to preserve engine life. Expect crowds watching your arrival." },
        { imgId: 220, payload: "conducting aerial refuelling approach practice", instruction: "Fly the assigned route from departure to destination. Maintain the briefed approach geometry, airspeed, and altitude tolerances throughout the transit for tanker rendezvous training.", excludedAircraft: ["SPIT", "BF109", "F6F", "P38"] }
    ],
    'reconnaissance-MIL': [
        { imgId: 221, payload: "conducting a transit reconnaissance sortie", instruction: "Fly the assigned route from departure to destination. Maintain the filed altitude and airspeed profile so onboard sensors can collect continuous imagery along the corridor.", allowedAircraft: STRATEGIC_RECON_AIRCRAFT },
        { imgId: 222, payload: "mapping the assigned transit corridor", instruction: "Execute a direct routing from departure to destination. Maintain steady track and altitude so mapping systems can build a complete mosaic of the route.", allowedAircraft: STRATEGIC_RECON_AIRCRAFT, preferredAircraft: VULCAN_RECON_PREFERRED },
        { imgId: 223, payload: "photographing designated areas along the route", instruction: "Transit from departure to destination along the filed routing. Maintain precise heading and timing so ground analysts can correlate imagery with the mission timeline.", allowedAircraft: STRATEGIC_RECON_AIRCRAFT, preferredAircraft: VULCAN_RECON_PREFERRED },
        { imgId: 249, payload: "conducting a two-ship formation proficiency transit", instruction: "Fly the filed intercontinental route from departure to destination. Ensure wingman separation remains within specified parameters throughout the extended climb and oceanic cruise.", allowedAircraft: STRATEGIC_RECON_AIRCRAFT, preferredAircraft: VULCAN_RECON_PREFERRED },
        { imgId: 250, payload: "conducting aerial refuelling approach practice", instruction: "Fly the assigned long-range route from departure to destination. Maintain the briefed approach geometry, airspeed, and altitude tolerances throughout the oceanic transit for tanker rendezvous training.", allowedAircraft: STRATEGIC_RECON_AIRCRAFT, excludedAircraft: ["SPIT", "BF109", "F6F", "FW08", "P38"] }
    ],
    gliderOps: [
        { imgId: 224, payload: "flying a club cross-country task between glider fields", instruction: "Launch from {dep_field} and work lift along the route toward {dest_field}. Reading visual cues is the secret to staying airborne - cumulus clouds (Cu) act as the sky's signposts, marking invisible columns of rising air called thermals. Favor developing Cu with sharp, puffy tops and flat dark bases; give decaying, wispy clouds a wide berth. Dark plowed fields, forest edges, and warm surfaces often trigger lift; read surface wind on ponds, smoke, or flags for drift. Stay VFR and arrive with enough height for a normal circuit." },
        { imgId: 225, isLocal: true, payload: "building local soaring currency above {dep_field}", instruction: "Remain in the local area around {dep_field}. Practice coordinated thermalling, position reporting, and clean circuit entries. Under developing cumulus with well-defined bases, core the strongest lift; note how sun-heated ground features pull thermals up nearby. Recover to the glider strip when your block time expires." },
        { imgId: 226, payload: "working available lift toward {dest_field}", instruction: "Use whatever lift the day offers between {dep_field} and {dest_field} - thermal columns under growing Cu, slope lift where wind meets rising ground, or cloud streets that let you run aligned lines with minimal height loss. Maintain safe offset from high ground, respect lee-side turbulence and rotor, and do not press into sink when a landing option is still available." },
        { imgId: 227, requiredTags: ["PAX"], payload: "conducting a dual instructional sortie from {dep_field}", instruction: "Your student is aboard for handling practice and lookout drills. Demonstrate energy management, pre-landing checks, and disciplined circuit work. Talk through how you read the sky - growing Cu for strong thermals, cloud streets for efficient transit, and surface wind cues for positioning. Keep the ride smooth and verbalize every decision." },
        { imgId: 228, excludedTags: ["SAILPLANE"], payload: "ferrying under power from {dep_field} to {dest_field}", instruction: "The club needs this airframe repositioned. Self-launch or sustain as required, climb to a safe transit altitude, and shut down to soar whenever lift allows. If you convert to soaring, treat developing cumulus as signposts for lift. Conserve battery or fuel for a go-around reserve at {dest_field}." },
        { imgId: 229, payload: "flying a contest-style practice task", instruction: "Treat the route from {dep_field} to {dest_field} as a practice speed task. Optimize your height band, plan turns before weak lift, and fly disciplined headings. Lines of Cu aligned with the wind mark lift streets - use them to cover distance efficiently. Favor growing thermals with dark flat bases; avoid time under decaying cloud. Progress by soaring technique, not minimum time under engine power." }
    ],
    longHaulOps: [
        { imgId: 230, payload: "operating a scheduled intercontinental passenger sector", instruction: "You are cleared on a long-range link between major international airports. Brief oceanic or remote-area contingencies, monitor fuel against alternates, and expect heavy jet sequencing on arrival.", requiredTags: ["JETLINER"] },
        { imgId: 231, payload: "ferrying hub-connecting traffic on an ultra-long sector", instruction: "The cabin is full of passengers transiting between global hubs. Maintain your assigned cruise level, adhere to the filed track, and keep the ride smooth through the cruise phase.", requiredTags: ["JETLINER"] },
        { imgId: 232, payload: "operating an overnight red-eye across multiple time zones", instruction: "Cabin lighting is dimmed and most passengers are asleep. Manage fatigue, monitor NAT or PAC tracks if assigned, and plan a stabilized dawn arrival.", requiredTags: ["JETLINER"] },
        { imgId: 233, payload: "positioning a mainline jet on a flagship international route", instruction: "This is one of the airline's longest scheduled sectors. Verify fuel load, ETOPS or long-range planning as applicable, and coordinate with oceanic control before coast-out.", requiredTags: ["JETLINER"] },
        { imgId: 234, payload: "recovering stranded passengers on a long-range repatriation sector", instruction: "Aircraft and crew were repositioned specifically for this extended recovery flight. Passengers have been waiting days — prioritize schedule adherence and a comfortable cruise profile.", requiredTags: ["JETLINER"] },
        { imgId: 235, payload: "operating a seasonal long-haul leisure route", instruction: "Holiday traffic is heavy and block fuel is high. Listen for ATC re-routes around weather systems and manage step-climbs to optimize burn on this extended sector.", requiredTags: ["JETLINER"] }
    ],
    longHaulFreight: [
        { imgId: 236, payload: "hauling priority intercontinental air cargo", instruction: "Main-deck and belly freight must reach the destination hub on schedule. Monitor fuel closely on this extended sector and confirm offload teams are standing by.", requiredTags: ["FREIGHTER"] },
        { imgId: 237, payload: "ferrying time-critical logistics on a long-range freight sector", instruction: "Warehouse cut-off times are tight on both ends of this route. Request oceanic clearance promptly and keep the ride smooth to protect sensitive pallet loads.", requiredTags: ["FREIGHTER"] },
        { imgId: 238, payload: "repositioning a freighter for an international sort window", instruction: "You are deadheading or lightly loaded to catch the next bank at a global cargo hub. Plan step climbs and respect maximum range reserves on this extended leg.", requiredTags: ["FREIGHTER"] }
    ],
    longHaulExecutive: [
        { imgId: 244, payload: "ferrying {name} on a transoceanic executive charter", instruction: "Your VIP expects a quiet cabin and an on-time arrival at the FBO. Plan fuel reserves carefully on this extended sector and keep bank angles gentle through the cruise.", requiredTags: ["VIP"] },
        { imgId: 245, payload: "flying {athlete} to an overseas championship fixture", instruction: "The passenger needs maximum rest on this extended leg. Climb above weather early, keep the ride smooth, and plan step climbs to optimize fuel on the oceanic portion.", requiredTags: ["VIP"] },
        { imgId: 246, payload: "relocating {musician} on a long-range tour leg", instruction: "The schedule is tight and the passenger must rest before the next performance. Monitor NAT or remote-area contingencies and maintain a smooth cruise profile.", requiredTags: ["VIP"] },
        { imgId: 247, payload: "conducting a discreet intercontinental business shuttle", instruction: "Corporate leadership is aboard for a time-critical overseas meeting. Maintain discretion on frequency and deliver a stabilized arrival at the destination FBO.", requiredTags: ["VIP"] },
        { imgId: 248, payload: "operating a long-range medevac-capable executive repositioning", instruction: "Medical support equipment is staged aboard in case it is needed en route. Verify oxygen and electrical loads against your range plan before coast-out.", requiredTags: ["VIP"], excludedTags: ["FREIGHTER"] }
    ],
    "longHaulFreight-MIL": [
        { imgId: 239, payload: "executing a long-range strategic airlift", instruction: "Palletized military stores must reach the forward operating base on schedule. Monitor fuel against alternates across remote segments and confirm offload security on arrival.", requiredTags: ["FREIGHTER"] },
        { imgId: 240, payload: "ferrying heavy tactical equipment on an intercontinental deployment leg", instruction: "Centre of gravity is critical on this extended sector. Request priority handling where available and maintain strict adherence to the filed oceanic track.", requiredTags: ["FREIGHTER"] },
        { imgId: 241, payload: "delivering humanitarian relief on a strategic military airbridge", instruction: "Relief pallets are bound for a forward distribution hub. Maintain schedule through remote airspace and confirm ground teams are standing by on arrival.", requiredTags: ["FREIGHTER"] },
        { imgId: 242, payload: "repositioning a military airlifter for an overseas exercise", instruction: "You are moving the airframe and support stores to join a multi-national deployment. Plan step climbs and respect maximum range reserves on this extended leg.", requiredTags: ["FREIGHTER"] },
        { imgId: 243, payload: "moving classified logistics containers on a discrete long-range transit", instruction: "Flight plan routing is filed under operational security protocols. Proceed directly to destination and prepare for a controlled ramp offload.", requiredTags: ["FREIGHTER"] }
    ]
};

const names = ["Tom Cruise", "Dwayne Johnson", "Leonardo DiCaprio", "Scarlett Johansson", "Margot Robbie", "Zendaya", "Tom Holland", "Robert Downey Jr.", "Brad Pitt", "Angelina Jolie", "Will Smith", "Pedro Pascal", "Timothée Chalamet", "Florence Pugh", "Ryan Reynolds", "Hugh Jackman", "Chris Hemsworth", "Keanu Reeves", "Meryl Streep", "Jackie Chan"];
const athletes = ["Cristiano Ronaldo", "Lionel Messi", "LeBron James", "Stephen Curry", "Simone Biles", "Tiger Woods", "Lewis Hamilton", "Patrick Mahomes", "Shohei Ohtani", "Caitlin Clark", "Novak Djokovic", "Rafael Nadal", "Usain Bolt", "Kylian Mbappé", "Virat Kohli", "Serena Williams", "Michael Phelps", "Kevin Durant", "Carlos Alcaraz", "Katie Ledecky"];
const teams = ["Real Madrid", "Barcelona", "Manchester United", "Manchester City", "Bayern Munich", "Paris Saint-Germain", "Liverpool", "Los Angeles Lakers", "Golden State Warriors", "Boston Celtics", "New York Yankees", "Los Angeles Dodgers", "Kansas City Chiefs", "Dallas Cowboys", "San Francisco 49ers", "Ferrari", "Mercedes F1 Team", "Mumbai Indians", "All Blacks", "Toronto Maple Leafs"];
const musician = ["Taylor Swift", "Beyoncé", "Drake", "The Weeknd", "Billie Eilish", "Bad Bunny", "Ed Sheeran", "Adele", "Justin Bieber", "Bruno Mars", "Dua Lipa", "Rihanna", "Lady Gaga", "Chris Martin", "Eminem", "Harry Styles", "Olivia Rodrigo", "Post Malone", "Kendrick Lamar", "BTS"];
const medCargo = ["specialized surgical tools", "temperature-sensitive donor organs", "blood plasma reserves", "advanced diagnostic equipment", "rare antivenom vials", "experimental vaccine cultures"];
const industry = ["Tech", "Energy", "Finance", "Pharmaceutical", "Real Estate", "Automotive", "Aerospace", "Telecommunications"];
const vipType = ["global diplomat", "tech billionaire", "renowned film director", "royal family member", "high-profile whistleblower", "media tycoon"];
const sciFi = ["geometric anomaly", "unexplained localized magnetic distortion", "perfectly circular crop depression", "unidentified pulsating light source", "rapidly expanding sinkhole"];
const cargoType = ["lithium-ion batteries", "drilling equipment", "server racks", "luxury vehicle parts", "stage rigging", "humanitarian rations"];

const preFlightQuotes = [
{ text: "When once you have tasted flight, you will forever walk the earth with your eyes turned skyward, for there you have been, and there you will always long to return.", author: "Not Leonardo DaVinci" },
{ text: "Man must rise above the Earth, to the top of the atmosphere and beyond, for only thus will he fully understand the world in which he lives.", author: "paraphrase of a concept from Plato's Phaedo" },
{ text: "I fly because it releases my mind from the tyranny of petty things.", author: "Antoine de Saint-Exupery" },
{ text: "The desire to fly is an idea handed down to us by our ancestors who, in their grueling travels across trackless lands in prehistoric times, looked enviously on the birds soaring freely through space, at full speed, above all obstacles, on the infinite highway of the air.", author: "Wilbur Wright" },
{ text: "Sometimes, flying feels too God-like to be attained by man. Sometimes, the world from above seems too beautiful, too wonderful, too distant for human eyes to see.", author: "Charles A. Lindbergh" },
{ text: "Pilots are a rare kind of human. They leave the ordinary surface of the word, to purify their soul in the sky, and they come down to earth, only after receiving the communion of the infinite.", author: "Jose Maria Velasco Ibarra" },
{ text: "Airspeed, altitude, and brains. Two are always needed to successfully complete the flight.", author: null },
{ text: "Both optimists and pessimists contribute to our society. The optimist invents the airplane and the pessimist the parachute.", author: "Gil Stern" },
{ text: "If black boxes survive air crashes, why don’t they make the whole plane out of that stuff?", author: "George Carlin" },
{ text: "You’ve never been lost until you’ve been lost at Mach 3.", author: "Paul F. Crickmore" },
{ text: "Learn from the mistakes of others. You won’t live long enough to live all of them yourself.", author: null },
{ text: "You start with a bag full of luck and an empty bag of experience. The trick is to fill the bag of experience before you empty the bag of luck.", author: null },
{ text: "Good judgment comes from experience. Unfortunately, the experience usually comes from bad judgment.", author: null },
{ text: "There are old pilots and there are bold pilots. However, there are no old, bold pilots.", author: null },
{ text: "The engine is the heart of an airplane, but the pilot is its soul.", author: "Walter Raleigh" },
{ text: "Aviation is proof that given the will, we have the capacity to achieve the impossible.", author: "Eddie Rickenbacker" },
{ text: "Flying is more than a sport and more than a job; flying is pure passion and desire.", author: "General Adolf Galland" },
{ text: "The airplane stands for freedom, for joy, for the power to understand.", author: "Richard Bach" },
{ text: "We who fly do so for the love of flying.", author: "Cecil Day-Lewis" },
{ text: "Adventure is worthwhile in itself.", author: "Amelia Earhart" },
{ text: "Flying is hypnotic and all pilots are victims to the spell.", author: "Ernest K. Gann" },
{ text: "Life is like a landscape. You live in the midst of it but can describe it only from the vantage point of distance.", author: "Charles Lindbergh" },
{ text: "I owned the world that hour as I rode over it – free of the earth, free of the mountains, free of the clouds, but how inseparably I was bound to them.", author: "Charles Lindbergh" },
{ text: "Real freedom lies in wildness, not in civilization.", author: "Charles Lindbergh" },
{ text: "Flying is learning how to throw yourself at the ground and miss.", author: "Douglas Adams" }
];
if (typeof globalThis !== "undefined") {
    globalThis.missionMatrix = missionMatrix;
    globalThis.scenarioDB = scenarioDB;
    globalThis.MIL_AIRLIFTER_CIVIL_TYPES = MIL_AIRLIFTER_CIVIL_TYPES;
    globalThis.getMilAirlifterCivilScenarioImgIds = getMilAirlifterCivilScenarioImgIds;
    globalThis.A400_CIVIL_FREIGHT_SCENARIO_IMGIDS = A400_CIVIL_FREIGHT_SCENARIO_IMGIDS;
}
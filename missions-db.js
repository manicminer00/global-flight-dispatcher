const RESTRICTED_JET_MISSION_TYPES = ["A319", "E190", "E195", "RJ70", "RJ85", "RJ1H", "RJ1F", "B461", "B462", "B462_QT", "B463", "B463_QT"];
const EGLC_JET_MISSION_TYPES = RESTRICTED_JET_MISSION_TYPES.concat(["F70"]);
const REGIONAL_JET_FREIGHTERS = ["B462_QT", "B463_QT", "RJ1F"];
const MAINLINE_JET_FREIGHTERS = ["B738_BCF", "B738_BDSF", "B72F"];
const SMALL_GA_TRAINERS = ["PA28", "P28A", "PA38"];
const VULCAN_RECON_PREFERRED = ["VULC"];
const TACTICAL_JET_MISSION_TYPES = ["F14A", "F14B", "HAWK", "JAGR", "TOR"];
const STRATEGIC_RECON_AIRCRAFT = ["VULC", "C160", "C130", "P38", "SPIT", "BF109", "F6F", "FW08", "A6M5"].concat(TACTICAL_JET_MISSION_TYPES);
const CELEBRITY_BIZ_JET_PREFERRED = ["STAR", "P180", "C700", "C680", "C750", "E55P", "FA50", "LJ35", "HDJT", "SF50"];
const CELEBRITY_VIP_SCENARIO_WEIGHT_MULT = 5;

const MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT = ["A400", "C130", "C160"];
const MIL_AIRLIFTER_EXCLUDED_OVERNIGHT_PARCELS = ["A400", "C130"];

// Shared text for scenarios that appear in two pools (one civil, one military-only class).
// Edit the wording here once; both pool entries below pull from it automatically.
const SCENARIO_183_UNKNOWN_PILLAR_TEXT = { imgId: 183, title: "Unknown", payload: "airlifting an unidentifiable metallic pillar", instruction: "A group of hikers found an impossibly smooth and heavy metal pillar out in a slot canyon. " };
const SCENARIO_220_TANKER_APPROACH_TEXT = { imgId: 220, title: "Refuelling Practice", payload: "conducting aerial refuelling approach practice", instruction: "Aerial refuelling approach practice, same drill as always. Hold airspeed and altitude as briefed, and try not to break another refuelling nozzle." };

const missionMatrix = [
    // UNIQUE MISSION TEMPLATES — one mission (imgId) each via pool "uniqueMissions"
    { type: 1, name: "Noise Abatement Departure (EGLC)", pool: "uniqueMissions", weight: 1.5, requiredDep: "EGLC", passengerMission: true, maxMTOW: 75500 },
    { type: 2, name: "Noise Abatement Departure (EGNS)", pool: "uniqueMissions", weight: 1.5, requiredDep: "EGNS", passengerMission: true, maxMTOW: 75500 },
    { type: 3, name: "Ponte Aérea Commuter", pool: "uniqueMissions", weight: 1.5, requiredDep: "SBRJ", maxMTOW: 75500 },
    { type: 4, name: "Classic Cross-Country Rally", pool: "uniqueMissions", weight: 1.5 },
	{ type: 5, name: "High-Altitude Express", pool: "uniqueMissions", weight: 1.5, minAlt: 10000, rules: "IFR" },
    { type: 7,  name: "Whisperjet Operations", pool: "uniqueMissions", weight: 1.5 },
    { type: 8,  name: "Research Observation Flight", pool: "uniqueMissions", weight: 40 },
    { type: 9,  name: "Remote Outpost Resupply", pool: "uniqueMissions", weight: 40 },
    { type: 10, name: "Albatross Patrol Run", pool: "uniqueMissions", weight: 40 },
    { type: 11, name: "Survey Platform", pool: "uniqueMissions", weight: 40 },
    { type: 12, name: "Remote Supply Drop", pool: "uniqueMissions", weight: 40 },
    { type: 13, name: "Commemorative SAR Demo", pool: "uniqueMissions", weight: 40 },
    // DYNAMIC MASTER TEMPLATES - no image required
    { type: 14, name: "Commercial Service", pool: "commercial", weight: 15, allowedClasses: ["JET", "TURBO"] },
    { type: 15, name: "Regional Commuter", pool: "commercial-regional", weight: 15, allowedClasses: ["TURBO", "JET"] },
    { type: 16, name: "Executive Charter", pool: "executive", weight: 15, allowedClasses: ["BIZ JET", "TURBO", "HELI"], minPaxSeats: 2, minPaxSeatsAppliesTo: ["HELI"], excludedAircraft: SMALL_GA_TRAINERS.concat(MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT) },
    { type: 17, name: "Light Freight Ops", pool: "lightFreight", weight: 15, allowedClasses: ["GA", "TURBO", "BIZ JET", "JET"], maxMTOW: 5000, maxMTOWAppliesTo: ["GA", "TURBO"], excludedAircraft: MAINLINE_JET_FREIGHTERS },
    { type: 18, name: "Heavy Cargo Transport", pool: "heavyFreightMissions", weight: 15, allowedClasses: ["JET", "TURBO", "HELI"], minCargo: 2000, excludedAircraft: ["VULC"] },
    { type: 19, name: "Medical Relay", pool: "medical", weight: 15, allowedClasses: ["GA", "TURBO", "HELI", "BIZ JET"] },
    { type: 20, name: "Aerial Survey", pool: "surveyServices", weight: 15, allowedClasses: ["GA", "HELI"], excludedAircraft: ["C700"], maxMTOW: 8000 },
    { type: 21, name: "Rotary Wing Operations", pool: "helicopterMissions", weight: 15, allowedClasses: ["HELI"] },
    { type: 23, name: "Tactical Sortie", pool: "tacticalJet-MIL", weight: 15, allowedClasses: ["JET", "WARBIRD", "HELI"], militaryOnly: true, tacticalOnly: true },
    { type: 24, name: "Military Logistics", pool: "militaryTransit-MIL", weight: 15, allowedClasses: ["TURBO", "JET", "HELI", "WARBIRD"], militaryOnly: true },
    { type: 25, name: "Heritage Flight", pool: "vintageOps", weight: 15, allowedClasses: ["WARBIRD", "GA", "TURBO", "JET"] },
    { type: 26, name: "Classic Airliner Charter", pool: "vintageAirliner", weight: 40, excludedAircraft: ["DC6A"] },
    { type: 27, name: "Weather Ops", pool: "highAltServices", weight: 15, allowedClasses: ["TURBO", "JET"], excludedAircraft: ["C700", "STAR", "P180"] },
    { type: 28, name: "Air Taxi", pool: "lightPax", weight: 15, allowedClasses: ["GA", "TURBO", "BIZ JET", "HELI"], maxMTOW: 6000, maxMTOWAppliesTo: ["GA", "TURBO", "HELI"], excludedAircraft: SMALL_GA_TRAINERS },
    { type: 32, name: "Strategic Recon.", pool: "reconnaissance-MIL", weight: 20, allowedClasses: ["JET", "WARBIRD", "TURBO"], militaryOnly: true },
    { type: 33, name: "Vintage Propliner Freight", detail: "Classic propliner freight for the DC-6A. Keep your RPMs synced, mind the cowl flaps, and remember that descending takes planning when you don't have speedbrakes.", pool: "vintageProplinerFreight", weight: 40, excludedAircraft: ["DC6B"], minCargo: 2000 },
    { type: 34, name: "Gliding Operations", pool: "gliderOps", allowedClasses: ["GLIDER"], rules: "VFR/Scenic" },
    { type: 39, name: "Regional Freight Pulse", pool: "regionalFreight", weight: 15, allowedClasses: ["JET", "TURBO"] }
];

const scenarioDB = {
    uniqueMissions: [
        { imgId: 1, title: "EGLC Steep Departure", missionType: 1, payload: "Noise Abatement Departure (EGLC)", instruction: "London City's neighbours love the Whisperjet. Nail the steep-climb profile out of EGLC and keep the noise monitors quiet below." },
        { imgId: 2, title: "EGNS Steep Departure", missionType: 2, payload: "Noise Abatement Departure (EGNS)", instruction: "EGNS keeps a tight lid on noise near the coast. Hold the steep-climb profile out and keep it quiet for the people below." },
        { imgId: 3, title: "Santos Dumont Departure", missionType: 3, payload: "Ponte Aérea Commuter", instruction: "SBRJ's short runway leaves no room for hesitation. Push max thrust, hold the tight climbing turn right after rotation, and keep those terrain contours in sight the whole way up." },
        { imgId: 4, title: "Comanche Cross Country", missionType: 4, payload: "Classic Cross-Country Rally", instruction: "Your Comanche has been entered for the cross-country rally. Watch the cylinder-head temps, control the mixture, and let her stretch her legs." },
        { imgId: 5, title: "High Altitude Express", missionType: 5, payload: "High-Altitude Express", instruction: "You're above the weather today, not fighting through it. Climb to altitude, hold the block times, and don't forget to turn on the Oxygen." },
        { imgId: 7, title: "Whisperjet", missionType: 7, payload: "Whisperjet Operations", instruction: "This airframe is renowned for its exceptionally low noise levels. Fly the descent profile with care, and lower flaps and gear in time for a clean landing." },
        { imgId: 8, title: "Geological Research",   missionType: 8,  payload: "flying researchers over surface anomalies", instruction: "A university team wants to measure how the ground's shifted since last season. Hold a steady low track and keep an eye on the radial temps, this old Albatross runs warm." },
        { imgId: 9, title: "Outpost Supply Run",   missionType: 9,  payload: "delivering bulk provisions to a distant outpost", instruction: "This outpost hasn't had a resupply in weeks, and the Albatross is hauling every pound of it today. Fly a smooth approach, and expect sluggish controls.", minCargoLoadFactor: 0.70 },
		{ imgId: 10, title: "Albatross Patrol",  missionType: 10, payload: "Albatross Patrol Run", instruction: "Another quiet patrol lap for the Albatross today. Keep your eyes outside, stay tight to the terrain where you can, and fly smooth steady turns." },
        { imgId: 11, title: "Survey Team Transfer", missionType: 11, payload: "Survey Platform", instruction: "The research team's gear is fragile. Butter the landing, skip steep turns, and get this team down on the ground." },
        { imgId: 12, title: "Bulk Supply Drop", missionType: 12, payload: "Remote Supply Drop", instruction: "The camp at your destination is down to its last supplies and waiting on you. Fly a controlled approach, check the strip conditions before committing, and get the drop in clean.", minCargoLoadFactor: 0.70 },
        { imgId: 13, title: "Heritage SAR Demo", missionType: 13, payload: "Commemorative SAR Demo", instruction: "This flight honours the old flying-boat crews who ran search and rescue in the Albatross. Keep your eyes outside and stay low where the terrain allows." }
    ],
        commercial: [
        { imgId: 14, title: "Team Charter", payload: "flying {team} to their next fixture", instruction: "{team}, the coaching staff and the medical team are en route to their next match. Keep the climb and descent gentle so nobody's out of their seat before the whistle blows.", weight: 3 },
        { imgId: 15, title: "Annual Leave Charter", payload: "flying a holiday charter group", instruction: "This cabin's buzzing with excitement all around. It looks like a lot of your passengers have already started the party before boarding the aircraft. Uh-oh." },
        { imgId: 16, title: "Storm Recovery", payload: "recovering passengers after widespread weather groundings", instruction: "Recent storms took out half the network and these people been waiting it out. Get your passengers to where they were meant to be.", weight: 3 },
        { imgId: 17, title: "Scheduled Hub Link", payload: "transporting travellers between hubs", instruction: "Plan ahead, check your weights and balances and don't forget to read the weather report before you leave." },
        { imgId: 18, title: "Peak Season Transport", payload: "transporting tourists to their destination", instruction: "This cabin's bursting with excited holidaymakers. Hit the block times or you'll hear about it at the gate." },
        { imgId: 19, title: "Tech Convention Charter", payload: "ferrying professionals to a major tech convention", instruction: "Laptops are open before the door's even shut. Keep the cruise smooth so this group of passengers can get their work done before you land.", weight: 3 },
        { imgId: 20, title: "High Capacity Route", payload: "operating a high-capacity holiday route", instruction: "Peak season means a full sky and zero tolerance for delays. Listen for holds, watch your fuel, and don't get caught short if ATC stacks you up." },
        { imgId: 21, title: "System Recovery Run", payload: "recovering a diverted flight after a regional system outage", instruction: "The network's been down for hours and these passengers are exhausted. Plan ahead, call for top of descent early, and bring these passengers to their destination." },
        { imgId: 22, title: "Corporate Offsite Run", payload: "ferrying a corporate group to an annual summit", instruction: "This group of passengers have had a week away at their global offsite. They are tired and just want to get home. That's your job." },
        { imgId: 23, title: "Flagship Service Route", payload: "operating the airline's most popular route", instruction: "This is the airline's flagship sector, so fly it well. Expect a fast turnaround the moment the tanks are full again." },
        { imgId: 24, title: "Tight Turnaround", payload: "operating a scheduled commercial sector", instruction: "The clock is ticking and ATC want you off the spot and taxiing as soon as possible. Scheduled sector means you'll be back in time for tea." },
        { imgId: 25, title: "Standard Sector", payload: "operating a standard commercial sector", instruction: "A standard commercial route. Fly it by the book, keep to the schedule, and remember you're in charge of a $350 million aircraft. Enjoy it." },
        { imgId: 26, title: "Business Shuttle", payload: "shuttling morning business travelers from hub to hub", instruction: "Morning business traffic between hubs, and a full sky to match. Keep separation and look out of the windows not at the screens." },
        { imgId: 27, title: "Student Charter", payload: "transporting university students to a massive event", instruction: "University students have taken over the cabin on the way to an event. Expect dancing in the aisles, and if it gets rowdy back there, use the seatbelt signs." },
        { imgId: 28, title: "Touring Orchestra", payload: "transporting a full symphony orchestra and their instruments", instruction: "A touring symphony orchestra needs to make it their next concert. Plan ahead and keep an eye on the radar for turbulence." },
        { imgId: 29, title: "Host Family Charter", payload: "flying a group of exchange students to their host country", instruction: "A cabin full of excited exchange students headed to their host families. ", weight: 3 },
        { imgId: 30, title: "Merger Seminar Run", payload: "transporting company personnel to a seminar", instruction: "Company personnel are headed to a major post-merger seminar, and the cabin's full to capacity. " },
        { imgId: 31, title: "Title Match Charter", payload: "flying fans to a major championship final", instruction: "A lively crowd of fans is filling this cabin on their way to the final. Give the cabin crew a heads-up, row twelve's already celebrating." },
        { imgId: 32, title: "Sun Seekers", payload: "transporting retirees to warmer climates for the winter", instruction: "Every row is full of retirees chasing warmer skies for the winter. Give them a soft landing and don't spill their Bloody Marys with steep turns." }
    ],
    'commercial-regional': [
        { imgId: 33, title: "Regional Commuter", payload: "flying a short regional commuter hop", instruction: "Coffee in hand and half-awake, the queue is long for the first flight out. Keep it smooth and get your passengers to their destination while the caffeine's still working." },
        { imgId: 34, title: "Short Sector Circuit", payload: "working a string of short sectors with fast turns", instruction: "Today's roster is a string of short sectors back to back. Keep the cabin cool between hops and steer clear of any weather building nearby." },
        { imgId: 35, title: "Regional Link", payload: "keeping a rural town linked into the network", instruction: "This run matters more than it looks. Stick to the schedule, there's a whole community counting on you making the connection at the other end." },
        { imgId: 36, title: "Late Night Commuter", payload: "flying a quiet late-evening commuter sector", instruction: "The departure board has gone quiet. Climb smoothly and don't burn fuel you don't need. Ops are watching the fuel bill with eagle eyes." },
        { imgId: 37, title: "Bad Weather, Good Vibes", payload: "recovering passengers after widespread weather groundings", instruction: "Yesterday's groundings left a cabin full of tired short-haul passengers who just want to be home. " },
        { imgId: 38, title: "Holiday Sector", payload: "taking holidaymakers to their destination", instruction: "Every seat's taken and everyone's ready for the doors to open so that they can start their holiday. " },
        { imgId: 39, title: "Diverted Flight Recovery", payload: "recovering a diverted flight after a regional system outage", instruction: "The system's been down for hours and the passengers are worn out. Fly a clean descent and keep the chatter to a minimum." },
        { imgId: 40, title: "Tradeshow Charter", payload: "ferrying a corporate group to an annual summit", instruction: "This group's headed to an international tradeshow, and can't wait to get in the door and start networking. Or is that not working, we'll let them find out." },
        { imgId: 41, title: "Feeder Network", payload: "flying the airline's busiest regional route", instruction: "This is the busiest feeder in the network. Load them up, fly the route, get to the gate, turn it around and do it again. Busy day, captain." },
        { imgId: 42, title: "Daily Grind", payload: "flying a scheduled hub feeder sector", instruction: "Nothing special about this hub feeder, it's just the daily grind. Ask ATC nicely for a shortcut if they've got one." },
        { imgId: 43, title: "Student Transfer", payload: "flying a group of exchange students to their host country", instruction: "Excited exchange students are headed to their host families. Keep it smooth, keep it punctual, and let's skip the dad jokes this leg." },
        { imgId: 44, title: "Merger Staff Charter", payload: "moving company staff to a seminar", instruction: "Staff are headed to a seminar after the merger, short sector, full cabin. Here's hoping everyone still has a desk to come back to." }
    ],
	executive: [
        { imgId: 45, title: "Silent Charter", payload: "flying {name} on a private schedule", instruction: "{name} wants a quiet cabin tonight, nothing but the soothing hum of the engines. Keep the climb soft, the descent softer, and mind the turns.", weight: 15, preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED, allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 46, title: "Wheels Up", payload: "taking {athlete} to an upcoming fixture", instruction: "{athlete} needs a quiet cabin to rest and relax in. Keep it smooth end to end so they land rested, not rattled.", weight: 15, preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED },
        { imgId: 47, title: "Wheeler Dealer", payload: "flying executives to a negotiation", instruction: "The team's working the numbers in back, no interruptions unless absolutely necessary.", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 48, title: "Suited and Booted", payload: "flying a board to an offsite", instruction: "Today, your cabin is a boardroom. Keep the coffee coming and grease that landing. ", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 49, title: "State Delegation", payload: "flying state representatives", instruction: "State reps are on the manifest, press teams as well. Fly it by the book, no shortcuts. You are a professional, after all, aren't you?", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 50, title: "Conference Charter", payload: "flying a {vip_type} to a high-level conference", instruction: "{vip_type} is riding to a high-level conference. Don't forget the red carpet.", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 51, title: "Tight Schedule", payload: "shuttling executives to a regional facility", instruction: "This executive group is getting impatient waiting in the terminal for you to choose the contract. ", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 52, title: "Fractional Owner Flight", payload: "flying a premium share owner", instruction: "A fractional owner used to first-class everything is in the back. Make it look effortless, and fly fast, they like that.", allowedClasses: ["BIZ JET", "TURBO", "HELI"], weight: 3 },
        { imgId: 53, title: "Hedge Fund Management", payload: "flying prospective investors", instruction: "The deal is being pitched in the cabin and the investors need to walk away sold on this one. ", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 54, title: "Secure Witness Transfer", payload: "moving a secure witness", instruction: "A state witness needs moving quietly. Fly straight to the destination, no fuss, no attention. Make sure the door is locked.", allowedClasses: ["BIZ JET"], weight: 3 },
        { imgId: 55, title: "Priceless Cargo", payload: "ferrying a Renaissance masterpiece to a private buyer", instruction: "A Renaissance piece worth more than the aircraft is strapped to a seat in the cabin. Keep the cabin cool, steer clear of any building weather. ", weight: 1, allowedClasses: ["BIZ JET", "TURBO", "HELI"], excludedAircraft: SMALL_GA_TRAINERS },
        { imgId: 56, title: "Legal Counsel", payload: "rushing legal executives to an industrial incident", instruction: "A PR mess is boiling over and the legal team's working the case in the back the whole way. ", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 57, title: "First-Class Feline", payload: "flying a tech mogul's purebred cat", instruction: "A tech mogul's cat has claimed the whole cabin. Keep the fish coming, she expects nothing less than the best.", weight: 1, allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 58, title: "Shopping Spree", payload: "chartering a high-profile music icon", instruction: "{musician} is off on a shopping spree. Keep the champagne flowing and turn a blind eye to whatever's happening back there.", weight: 12, preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED },
        { imgId: 59, title: "Golf Weekend", payload: "flying an owner to a holiday retreat", instruction: "You were hand-picked for this flight. Must be your sparkling personality. Enjoy the approach and keep that landing soft.", allowedClasses: ["BIZ JET"] },
        { imgId: 60, title: "Business Commute", payload: "flying a short-hop business commute", instruction: "Today's passengers are dodging the airline queues. Ask ATC for directs where you can get them to trim the block time.", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 61, title: "Stadium Gig", payload: "flying {musician} to their next stadium gig", instruction: "{musician} and the crew need sleep before tomorrow's show. Climb above the weather, dodge the bumps and hold that cabin pressure steady.", weight: 12, preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED },
        { imgId: 62, title: "Spiritual Retreat", payload: "flying {name} to meet a spiritual guru", instruction: "{name} is meeting a spiritual guru and the press have your tail number. Find a quiet corner to park and keep any mention of your passenger off open channels.", weight: 15, preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED, excludedAircraft: SMALL_GA_TRAINERS },
        { imgId: 63, title: "Athletic Luxury", payload: "flying {athlete} to a championship fixture", instruction: "{athlete} needs to land rested and on schedule for an upcoming event. Ask for priority clearance and keep this one smooth all the way down.", weight: 15, preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED },
        { imgId: 64, title: "Premiere Escort", payload: "flying {name} to a film premiere", instruction: "{name} needs a quiet ride to tonight's premiere. Go straight to the private FBO, as the paparazzi are waiting at the VIP terminal.", weight: 15, preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED },
        { imgId: 65, title: "Transfer News", payload: "flying {team} executives to an away fixture", instruction: "{team} executives are riding to an away fixture with the media watching close. These are the people keeping the company airborne.", weight: 12, preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED },
        { imgId: 66, title: "Medical Team Transport", payload: "rushing a surgical team to a regional hospital", instruction: "The medical team's ready to board and the hospital's waiting on them. No time to waste, get this team there fast.", allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 67, title: "Private Gala Charter", payload: "flying a VIP to an exclusive private gala", instruction: "Tonight's {vip_type} expects the finer things. The bar's stocked and the cabin is ready for our guest. ", weight: 15, preferredAircraft: CELEBRITY_BIZ_JET_PREFERRED },
        { imgId: 68, title: "Boardroom Rescue", payload: "rushing a tech CEO to a hostile board meeting", instruction: "The stock's in free-fall and this CEO needs to be back at the office before the board meeting starts without him. ", allowedClasses: ["BIZ JET", "TURBO", "HELI"], excludedAircraft: ["UH1", "H14M", "H65M"] },
    ],
	medical: [
        { imgId: 69, title: "Priority Medical Transfer", payload: "airlifting a patient", instruction: "Turbulence won't do this patient any favors, so watch the radar and keep it smooth all the way down." },
        { imgId: 70, title: "Lifeguard Priority", payload: "transporting tissue for surgery", instruction: "This is a Lifeguard priority run, essential tissue for a transplant is secured in the back." },
        { imgId: 71, title: "Medevac Transport", payload: "airlifting a patient from a rural strip", instruction: "The patient has been stabilised and the medevac team are waiting for you to arrive. " }
    ],
	lightFreight: [
        { imgId: 72, title: "Diplomatic Escort", payload: "moving classified diplomatic files", instruction: "Classified files are chained to a guy who looks exactly like John Cena. It can't be him, can it? ", minCargoLoadFactor: 0.40 },
        { imgId: 73, title: "Prototype Delivery", payload: "delivering prototype processing units", instruction: "This prototype hardware doesn't like static or swings in temperature. Run the environmental checks before you even think about taxiing.", minCargoLoadFactor: 0.60 },
        { imgId: 74, title: "Live Cargo Hop", payload: "moving a protected animal species", instruction: "Live cargo's riding in back. Keep the banks shallow and ease off the thrust unless you're angling for a Lion King re-enactment enroute.", minCargoLoadFactor: 0.60 },
        { imgId: 75, title: "Sapling Delivery", payload: "delivering fragile conservation saplings", instruction: "These saplings are alive and picky about pressure and temperature. Fly a gentle descent rate on the way in and keep the cabin tropical.", minCargoLoadFactor: 0.40 },
        { imgId: 76, title: "Digital Masters", payload: "flying primary digital master drives", instruction: "Unedited footage is in the hold and the editing suite's waiting on it. Get the digital masters there on schedule.", minCargoLoadFactor: 0.40 },
        { imgId: 77, title: "Manuscript Rescue", payload: "relocating fragile historical manuscripts", instruction: "These manuscripts are irreplaceable and fussy about both temperature and moisture. Have ground handling ready the second you block in.", minCargoLoadFactor: 0.60 },
        { imgId: 78, title: "AOG Callout", payload: "rushing a critical AOG component", instruction: "Another aircraft's grounded and waiting on this part. Trim the route wherever you can and grease the approach, maintenance is counting the minutes until you arrive.", minCargoLoadFactor: 0.60 },
        { imgId: 79, title: "Medical Freight Rush", payload: "expediting priority medical freight", instruction: "Temperature controlled medical cargo needs flying to the regional hospital and every minute counts. Ask ATC for priority and hold that pressurization steady.", minCargoLoadFactor: 0.40 },
        { imgId: 80, title: "Medical Cargo Transfer", payload: "transporting {med_cargo}", instruction: "{med_cargo} is riding in the hold. Lock the cabin temperature in and skip the fast climbs or descents, pressure swings won't do it any favors.", minCargoLoadFactor: 0.40 },
        { imgId: 81, title: "Clinic Dash", payload: "expediting {med_cargo}", instruction: "A clinic's waiting on this {med_cargo} for a procedure. Keep the block as tight as you can, someone will be there to meet you the moment you park at the FBO.", minCargoLoadFactor: 0.40 },
        { imgId: 82, title: "Farm Produce Delivery", payload: "hauling farm produce from a rural strip", instruction: "Fresh produce is going straight from the field to the shops. Whatever's back there, it smells fantastic.", minCargoLoadFactor: 0.60 },
        { imgId: 83, title: "Overnight Express", payload: "moving regional express packages overnight", instruction: "Tonight's freight run is what keeps the regional network moving. Hit your slots and keep it rolling.", excludedAircraft: MAINLINE_JET_FREIGHTERS, minCargoLoadFactor: 0.60 },
        { imgId: 84, title: "Regional Mail Circuit", payload: "delivering regional post parcels", instruction: "This is an old-school mail run. Don't linger, there's more drops before the sun's down.", minCargoLoadFactor: 0.60 },
        { imgId: 85, title: "Essential Supply Drop", payload: "delivering essential supplies to customers", instruction: "Supplies and mail are loaded and customers are waiting. Recheck your density altitude before you commit to the departure.", minCargoLoadFactor: 0.40 },
        { imgId: 86, title: "Regional Supply Relay", payload: "delivering regional supplies", instruction: "A regional supply run's on the board. Check your arrival weight and watch your approach speed.", excludedAircraft: ["B72F"], minCargoLoadFactor: 0.40 },
        { imgId: 87, title: "Lab Sample Dash", payload: "shuttling regional lab samples and {med_cargo}", instruction: "These {med_cargo} need to get there in one piece and fast. Hospital staff will be waiting on the apron.", minCargoLoadFactor: 0.40 },
        { imgId: 88, title: "Morning Paper Run", payload: "distributing the morning broadsheets", instruction: "It's 4 AM, the coffee's weak, and the hold's stacked with today's news. Get the papers to the distributors before breakfast beats you there.", minCargoLoadFactor: 0.60 },
        { imgId: 89, title: "Seafood Express", payload: "rushing iced premium seafood to inland markets", instruction: "The ice on this catch is already melting. Get it to the restaurants before the dinner rush. And no, we are not doing the loose lobster thing again.", minCargoLoadFactor: 0.60 },
        { imgId: 91, title: "Rare Component Relay", payload: "rushing a rare component to a stranded client", instruction: "A wealthy client's vintage car is stuck waiting on this part. Push to save time where you safely can, but keep every gauge in the green.", minCargoLoadFactor: 0.60 },
        { imgId: 92, title: "Machinery Airlift", payload: "ferrying critical machinery parts to a regional facility", instruction: "Harvest season's in full swing and a critical machine just went down. Get these parts there as fast as you safely can, the field's waiting.", minCargoLoadFactor: 0.60 },
        { imgId: 94, title: "Last Light Mail Run", payload: "connecting rural farm strips with mail and supplies", instruction: "This is the last flight before the sun goes down, and the mail's got to make the hub for onward distribution. ", minCargoLoadFactor: 0.60 },
        { imgId: 95, title: "Community Supply Circuit", payload: "delivering supplies to a community", instruction: "Food, fuel and mail are bound for a community that's counting on this delivery. Watch out for birds on approach.", minCargoLoadFactor: 0.60 },
        { imgId: 145, title: "Private Estate", payload: "delivering urgent freight to a private airstrip", instruction: "The client is waiting for you. Watch the crosswind on final and get this pungent smelling cargo off this plane asap.", minCargoLoadFactor: 0.50 }
    ],
    regionalFreight: [
        { imgId: 96, title: "Night Express", payload: "moving regional express packages overnight", instruction: "The regional night express lives and dies by its slots. Hit every one of them or the whole network stalls behind you.", excludedAircraft: MAINLINE_JET_FREIGHTERS, preferredAircraft: REGIONAL_JET_FREIGHTERS },
        { imgId: 97, title: "Priority Parcels", payload: "moving priority overnight parcels", instruction: "The sort facility's on the clock tonight. Ask for directs the second you sense any delay getting airborne.", preferredAircraft: REGIONAL_JET_FREIGHTERS },
        { imgId: 98, title: "Regional Red-Eye", payload: "flying an overnight regional freight sector", instruction: "This red-eye clears the regional hubs tonight. Stick to your ATC slots and keep the descent clean while the skies stay quiet.", preferredAircraft: REGIONAL_JET_FREIGHTERS },
        { imgId: 99, title: "Medical Freight Link", payload: "expediting priority medical freight", instruction: "Temperature controlled medical cargo needs to get to the regional hospital and you're the quickest link there is. " },
        { imgId: 100, title: "Lab Samples", payload: "shuttling regional lab samples and {med_cargo}", instruction: "{med_cargo} is going direct to the lab today, no hub stops. The medical teams are waiting for this equipment." },
        { imgId: 101, title: "Field Machinery", payload: "ferrying critical machinery parts to a regional facility", instruction: "You're collecting machine parts for regional farmers. Say the word and the ground teams will secure the loads in the hold. " },
        { imgId: 102, title: "Regional Restock", payload: "delivering regional supplies", instruction: "This run restocks regional businesses. Plan ahead and and use reverse thrust if the runway's tight.", excludedAircraft: ["B72F"], preferredAircraft: REGIONAL_JET_FREIGHTERS },
        { imgId: 103, title: "Late Night Regional", payload: "flying a late-evening regional freight sector", instruction: "It's a late-night flight through a quiet regional network. Traffic's thin, so take it easy and save some fuel.", preferredAircraft: REGIONAL_JET_FREIGHTERS }
    ],
	heavyFreightMissions: [
        { imgId: 104, title: "Relief Pallet Run", payload: "delivering palletized nutrition and water packs", instruction: "Check the drop zone coordinates twice, we don't want a repeat of 'cargo pallet falls through church roof' from last month.", minCargoLoadFactor: 0.70 },
        { imgId: 105, title: "Retail Supply Drop", payload: "delivering retail warehouse garment supplies", instruction: "Pallets of boxed clothing are bound for warehouses. Keep the hold clean and dry all the way down.", excludedAircraft: MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT, minCargoLoadFactor: 0.70 },
        { imgId: 106, title: "Museum Artifacts", payload: "moving authenticated historical artifacts", instruction: "These fragile museum pieces need to make it to the new exhibition in one piece. ", weight: 3, excludedAircraft: MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT, minCargoLoadFactor: 0.50 },
        { imgId: 107, title: "Cargo Delivery", payload: "moving {cargo_type}", instruction: "Engineers are waiting on this {cargo_type} and work's stopped until it lands. ", excludedAircraft: ["DC6A"].concat(MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT), minCargoLoadFactor: 0.70 },
        { imgId: 108, title: "Luxury Vehicle Transfer", payload: "delivering luxury vehicles and parts", instruction: "High-value vehicles are secured to the main deck. Have the loadmaster check every strap before the door closes.", excludedAircraft: ["B461_MIL", "B462_MIL", "DC6A"].concat(MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT), minCargoLoadFactor: 0.50 },
        { imgId: 109, title: "Supercar Delivery", payload: "loading a high-value luxury sports car", instruction: "A bespoke supercar is loaded and ready. Don't touch the car. Don't get in the car. ", weight: 3, excludedAircraft: ["B461_MIL", "B462_MIL", "DC6A"].concat(MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT), minCargoLoadFactor: 0.50 },
        { imgId: 110, title: "Oilfield Equipment", payload: "ferrying {cargo_type} and heavy oilfield equipment", instruction: "{cargo_type} and heavy oilfield equipment are bolted to the floor rails. Stay ahead of the power curve on final. ", minCargoLoadFactor: 0.70 },
        { imgId: 111, title: "Avionics Bay Return", payload: "returning a decommissioned avionics bay", instruction: "A retired avionics bay is heading back to a restoration team before being transported to a local aviation museum for preservation.", minCargoLoadFactor: 0.50 },
        { imgId: 112, title: "Perishable Delivery", payload: "transporting premium edible goods for wholesale", instruction: "The supermarkets are waiting on this one and nothing back there likes to spoil. Keep the temperature steady the whole way. ", excludedAircraft: MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT, minCargoLoadFactor: 0.70 },
        { imgId: 113, title: "Consumer Tech Express", payload: "transporting bulk commercial perishables", instruction: "High-end consumer electronics are coming straight from the factory. Watch your V-speeds on the takeoff roll and keep that cabin temperature in check.", excludedAircraft: MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT, minCargoLoadFactor: 0.70 },
        { imgId: 114, title: "Overnight Parcel Run", payload: "moving priority overnight parcels", instruction: "The sort facility's on the clock. Ask for directs the moment you sense any delay getting airborne.", excludedAircraft: MIL_AIRLIFTER_EXCLUDED_OVERNIGHT_PARCELS.concat(REGIONAL_JET_FREIGHTERS), minCargoLoadFactor: 0.70 },
        { imgId: 115, title: "Bullion Transfer", payload: "transporting heavy secure bullion", instruction: "A central-bank gold transfer is waiting on the ramp, along with a lot of serious-looking people dressed in black. ", weight: 3, minCargoLoadFactor: 0.85 },
        { imgId: 116, title: "Max Payload Push", payload: "moving an oversized, max-payload cargo manifest", instruction: "This one's loaded to the roof. Prepare for a long roll and a lazy climb, and double-check your V-speeds before you commit.", excludedAircraft: ["DC6A"], minCargoLoadFactor: 0.85 },
        { imgId: 117, title: "Overnight Cargo Run", payload: "flying an overnight route", instruction: "This overnight run needs to get to the big sorting hubs. Hit your slots and don't forget to call for top of descent.", preferredAircraft: REGIONAL_JET_FREIGHTERS, excludedAircraft: MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT, minCargoLoadFactor: 0.70 },
        { imgId: 118, title: "Impulse Overload", payload: "moving an absolute mountain of impulse buys", instruction: "The sort facility's backed up and the hold is stuffed to the roof with impulse buys. ", excludedAircraft: MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT, minCargoLoadFactor: 0.70 },
        { imgId: 119, title: "Podium Bound Freight", payload: "transporting Formula racing chassis and paddock gear", instruction: "The team needs this chassis trackside for the weekend, and it's worth more than most people's houses. ", weight: 3, excludedAircraft: ["DC6A", "B461_MIL", "B462_MIL"].concat(MIL_AIRLIFTER_EXCLUDED_HEAVY_FREIGHT), minCargoLoadFactor: 0.50 },
        { imgId: 120, title: "Heavy Machinery", payload: "loading heavy industrial machinery", instruction: "The loadmaster's still chaining down an oversized plant kit on the main deck. Confirm tie-downs before you call for pushback.", excludedAircraft: ["DC6A"], minCargoLoadFactor: 0.85 },
        { imgId: 121, title: "Generator Haul", payload: "loading a heavy industrial generator", instruction: "Ground crew are locking down an oversized generator on the deck. Check your fuel calculations and CG before you start her up.", excludedAircraft: ["DC6A"], minCargoLoadFactor: 0.50 },
        { imgId: 122, title: "Turbine AOG Recovery", payload: "transporting a replacement engine turbine module", instruction: "This fragile fan module is headed out for an AOG recovery. Keep the ride smooth and hold the temperature steady the whole way.", minCargoLoadFactor: 0.50 },
        { imgId: 123, title: "Server Rack Delivery", payload: "transporting server racks and data-centre hardware", instruction: "Server racks and data-centre hardware are riding in the hold. Get this cargo to the destination on time.", minCargoLoadFactor: 0.70 },
        { imgId: 184, title: "Tactical Vehicle Transport", payload: "moving dense tactical vehicle components", instruction: "How many cars can you fit in a plane? ", minCargoLoadFactor: 0.80 },
        { imgId: 185, title: "Defense Component Haul", payload: "relocating modular defense components", instruction: "Depot needs this kit for assembly on arrival. Stick to the filed plan. Hit the block.", minCargoLoadFactor: 0.80 },
        { imgId: 186, title: "Sealed Manifest Run", payload: "moving sensitive industrial hardware", instruction: "Sealed manifest. No questions asked. Head straight for the remote ramp on arrival.", minCargoLoadFactor: 0.50 },
        { imgId: 187, title: "Priority Spares", payload: "ferrying urgent technical spares to a regional depot", instruction: "Priority load on board. Get it there on time. Miss the window and the maintenance schedule slips.", minCargoLoadFactor: 0.50 },
        { imgId: 188, title: "AOG Inspection Run", payload: "transporting AOG parts for a fleet-wide inspection", instruction: "Maintenance is standing by for this hardware. Don't waste a minute getting it in.", minCargoLoadFactor: 0.80 },
        { imgId: 189, title: "Tactical Pallet Load", payload: "loading tactical cargo pallets", instruction: "Palletized military stores on the main deck. Check tie-down tension and CG before engine start.", minCargoLoadFactor: 0.50 },
        { imgId: 190, title: "Relief Pallet Delivery", payload: "delivering refugee relief supply pallets", instruction: "Humanitarian pallets bound for a forward distribution point. Keep the schedule. Confirm offload teams will be waiting on your arrival.", minCargoLoadFactor: 0.80 }
    ],
    surveyServices: [
        { imgId: 124, title: "Civic Leaflet Drop", payload: "distributing localized civic awareness materials", instruction: "You're flying a pre-assigned route to ensure leaflet distribution covers the sector evenly. " },
        { imgId: 125, title: "Pipeline Survey", payload: "surveying local power and pipeline grids", instruction: "You're surveying the power and pipeline grid. Stay inside the inspection corridor and keep a sterile cockpit while you're on the line." },
        { imgId: 126, title: "Crop Inspection", payload: "inspecting crop yields", instruction: "Fly low and slow over the fields. Watch for unmarked power lines and hold that track steady for the survey team." },
        { imgId: 127, title: "Municipal Survey", payload: "mapping a municipal expansion zone", instruction: "You're mapping a municipal expansion zone. Hold a steady track along the route so the survey team gets clean readings." },
        { imgId: 128, title: "Subsurface Mapping", payload: "mapping subsurface anomalies", instruction: "You're mapping subsurface anomalies. Hold constant airspeed and altitude, the magnetometer hates it when you wander." },
        { imgId: 129, title: "Storm Assessment", payload: "flying insurance assessment teams", instruction: "A storm tore through the area yesterday. Hold the profile steady over the damage so the insurance assessors can scan from above." },
        { imgId: 130, title: "LIDAR Survey", payload: "flying LIDAR equipment over suspected ancient ruins", instruction: "Researchers want LIDAR passes over some recently discovered ruins today. One of the researchers is called Lara..." },
        { imgId: 131, title: "Property Photo Shoot", payload: "flying a photographer for a high-end property portfolio", instruction: "You've got a photographer on board who needs clean, stable orbits over a few waypoints. Work with them and keep the airframe smooth.", excludedAircraft: ["U16"] },
        { imgId: 132, title: "Anomaly Survey", payload: "flying researchers over a {sci_fi}", instruction: "Researchers want you over the {sci_fi} so that they can take readings. Try to ignore the weird static chewing through the radios.", weight: 3 },
        { imgId: 133, title: "Missing Vehicle Search", payload: "assisting authorities in a visual search for a missing vehicle", instruction: "You're assisting local authorities with a visual search for a missing vehicle. ", weight: 3, excludedAircraft: ["BE60", "STAR"] },
    ],
    lightPax: [
        { imgId: 90, title: "Avionics Shop Run", payload: "relocating the airframe to a certified avionics shop", instruction: "The owner says the GPS has been acting up and wants it looked at the nearest service center. " },
        { imgId: 93, title: "New Owner Ferry Flight", payload: "delivering a recently purchased airframe", instruction: "The broker just handed over the keys to you, this is your aircraft now. Fly her home and don't push her too hard on the first flight." },
        { imgId: 134, title: "Staff Shuttle", payload: "moving industrial staff between sites", instruction: "Just an ordinary staff shuttle between industrial sites, nothing fancy. Get the passengers there on time and butter that landing." },
        { imgId: 135, title: "Currency Flight", payload: "conducting a standardization flight", instruction: "You're conducting a standardization flight in the local pattern. Standard maneuvers, clean radio work, nothing more.", weight: 3 },
        { imgId: 136, title: "The Workshop", payload: "shuttling an independent engineering consultant", instruction: "You've got an engineering consultant working through paperwork in the back. Find smooth air and keep your inputs steady and controlled." },
        { imgId: 137, title: "Community Link", payload: "keeping a community linked by light aircraft", instruction: "This town relies on your connection. Stick to the schedule, plenty of passengers have onward flights waiting for them at the hub." },
        { imgId: 138, title: "Private Charter", payload: "flying {name} on a private schedule", instruction: "{name} wants anonymity and privacy on this charter. Do not mention your client's name on open frequencies.", weight: 12, allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 139, title: "VIP Spiritual Retreat", payload: "flying {name} to meet a spiritual guru", instruction: "{name} is meeting a spiritual guru. Park away from the main building and keep your client's name off any open channels.", weight: 12, excludedAircraft: SMALL_GA_TRAINERS, allowedClasses: ["BIZ JET", "TURBO", "HELI"] },
        { imgId: 140, title: "Twilight Scenic Flight", payload: "flying a romantic scenic twilight flight", instruction: "A romantic twilight scenic flight is on the books. Smooth RPM, shallow banks, a gentle profile all the way, don't go and spoil the moment.", weight: 1 },
        { imgId: 141, title: "Missed Connection", payload: "rushing a stranded businessman to a regional hub", instruction: "A stranded businessman missed his airline connection and grabbed your last seat instead. Can you save the day and get him to the hub on time?", weight: 2 },
        { imgId: 142, title: "Family Link", payload: "bringing passengers home to their families", instruction: "You're the only link between these towns. Plan the fuel, watch the approach winds, and butter that landing for the families waiting." },
        { imgId: 143, title: "Honeymoon Charter", payload: "flying a honeymooning couple to a remote retreat", instruction: "You've got a honeymooning couple on a chartered getaway. Gentle turns, smooth air, a soft landing, match the mood they're going for.", weight: 1 },
        { imgId: 144, title: "Medical Examiner", payload: "flying a regional medical examiner to an incident site", instruction: "A regional medical examiner has a time-sensitive call-out. Get to the incident site as fast as you can.", weight: 3 },
        { imgId: 146, title: "New Owner Reposition", payload: "repositioning an aircraft for its new owner", instruction: "The owner has asked you to ferry her to her new home base, watch the temperatures, this airframe's still new to flying." }
    ],
    highAltServices: [
        { imgId: 147, title: "Weather Ops", payload: "gathering specific meteorological data", instruction: "You're gathering meteorological data for the science team. " },
        { imgId: 148, title: "Storm Chasers", payload: "flying atmospheric researchers to a developing system", instruction: "Atmospheric researchers need to drop sensors ahead of a major pressure shift. " }
    ],
    vintageOps: [
        { imgId: 149, title: "Airshow Display", payload: "flying a historic airshow demonstration", instruction: "You're flying a historic airshow demonstration. Static display on the ground, then a short aerial routine, check the fluids before you roll.", allowedClasses: ["WARBIRD", "JET"], excludedAircraft: ["DC6A"], weight: 3 },
        { imgId: 150, title: "Handicap Race", payload: "positioning for a closed-course handicap race", instruction: "You're positioning for a closed-course handicap race. Visual transit to the staging field, keep the airframe clean and trimmed the whole way.", excludedAircraft: ["U16", "DC6A", "DC6B", "V10", "P38"] },
        { imgId: 151, title: "Museum Ferry", payload: "ferrying a vintage airframe to an aviation museum", instruction: "She's not getting any younger, and the museum's waiting. " },
        { imgId: 152, title: "Historic Chase Plane", payload: "acting as a chase plane for a historic squadron", instruction: "You're a chase plane for a historic squadron. Hold your spacing, stay sharp, and watch the temps.", allowedClasses: ["GA"] },
        { imgId: 153, title: "Memorial Fly-by", payload: "flying a commemorative low-level transit", instruction: "You're flying a commemorative low-level transit. Check the paraffin-based oil levels before you leave in case a smoke trail is requested." },
        { imgId: 154, title: "Keeping Current", payload: "keeping current in a historic airframe", instruction: "You're keeping current in this historic airframe so you can fly the next public display." },
        { imgId: 155, title: "Last Flight", payload: "delivering a newly restored airframe to a preservation trust", instruction: "This newly restored airframe is irreplaceable and headed to the Aviation museum. " },
        { imgId: 156, title: "Aviation Festival", payload: "ferrying to a regional aviation festival", instruction: "You need to be on the staging grounds before sunset. Keep the cruise power conservative to spare the engine." },
        { imgId: 157, title: "Tribute Flight", payload: "flying a chartered remembrance flight", instruction: "You're flying a memorial flight in memory of those who flew this airframe before you. Keep the gauges in the green.", weight: 3 }
    ],
	// DC-6A freight exclusive
    vintageProplinerFreight: [
        { imgId: 158, title: "Vintage Freight", payload: "hauling oversized vintage freight", instruction: "You've got a classic load for a classic bird. Keep the RPMs synced, mind the cowl flaps, and plan your descent early." },
        { imgId: 159, title: "Livestock Freight", payload: "flying live agricultural freight", instruction: "The hold smells terrible but the payout's good. Easy on the bank angles and grease that landing." },
        { imgId: 160, title: "Heavy Duty", payload: "moving heavy goods in a vintage airframe", instruction: "You're moving heavy goods in a vintage airframe. Watch the engine temps and expect the controls to feel a touch slower than you're used to." },
        { imgId: 161, title: "Palleted Freight", payload: "loading palletized commercial freight", instruction: "The warehouse teams are still loading the pallets. Hit your departure slot or the whole sort window slips behind you.", preferredAircraft: ["DC6A"] }
    ],
	// DC-6B PAX Exclusive
    vintageAirliner: [
        { imgId: 162, title: "Silver Sleeper Service", payload: "flying a premium overnight cross-country", instruction: "Most of your passengers will be sleeping on this premium overnight cross-country. ", excludedAircraft: ["DC6A"] },
        { imgId: 163, title: "Sunset Boulevard", payload: "flying holidaymakers across the country", instruction: "Holidaymakers are riding cross-country with you. Watch the cylinder head temps on the ground and get the cowl flaps sorted early.", excludedAircraft: ["DC6A"] },
        { imgId: 164, title: "Executive Extraction", payload: "flying a full load of {industry} executives and engineers to the extraction sites", instruction: "A full load of {industry} executives and engineers is riding to the extraction site. ", excludedAircraft: ["DC6A"] },
        { imgId: 165, title: "Matchday Fans", payload: "flying sports fans to the match", instruction: "Sports fans are heading to the match with you. Check the carb heat and the de-icing boots before you enter the terminal area.", excludedAircraft: ["DC6A"] },
        { imgId: 166, title: "Golden Age Regional", payload: "flying an iconic passenger shuttle", instruction: "You're on an iconic passenger shuttle. Expect a lazy climb off the runway and don't thrash the engines.", excludedAircraft: ["DC6A"] }
    ],
    helicopterMissions: [
        { imgId: 167, title: "Scenic Hop", payload: "flying a local scenic hop", instruction: "You're flying a local scenic route. Fly around the landmarks and set your passengers down smoothly." },
        { imgId: 168, title: "Photo Survey", payload: "holding steady for a survey photographer", instruction: "You're holding steady for a survey photographer. Work with them and give clean orbits over the waypoints, smooth is everything here." },
        { imgId: 169, title: "Traffic Watch", payload: "watching the local transit corridors", instruction: "You're watching the local transit corridors from above. Hold over the big interchanges so the spotter can call traffic conditions." },
        { imgId: 170, title: "On-Demand Charter", payload: "flying a short on-demand charter", instruction: "You've got a client who wants to skip the gridlock. Grab direct routing if you can get it, and don't hang about." },
        { imgId: 171, title: "Roadside Extraction", payload: "extracting a trauma victim from a major roadway", instruction: "First responders already have the LZ marked on the roadway. Get in, get the patient aboard, go. Every second counts now.", lowLevelOps: true },
        { imgId: 172, title: "Search And Rescue Ops", payload: "searching for a stranded group of travellers", instruction: "You're searching for a stranded group of travellers. Work your patterns over the last known coordinates and be ready to hoist.", lowLevelOps: true },
        { imgId: 173, title: "Aerial Overwatch", payload: "providing aerial overwatch", instruction: "You're providing aerial overwatch for ground units. ", lowLevelOps: true },
        { imgId: 174, title: "Property Grid Survey", payload: "mapping a new property development", instruction: "You're mapping a new property development. " },
        { imgId: 175, title: "Industrial Support", payload: "positioning industrial equipment", instruction: "You're positioning industrial equipment with a precision hover. ", lowLevelOps: true },
        { imgId: 176, title: "Wildlife Tracking", payload: "locating tagged animal populations", instruction: "You're locating tagged animal populations for the biologists. Keep visual contact while the telemetry data is saved." },
        { imgId: 177, title: "Executive Shuttle", payload: "shuttling an executive from the airport", instruction: "You've got an executive hop from the FBO to the helipad." },
        { imgId: 178, title: "Live Event Monitoring", payload: "covering a civic event live", instruction: "You're covering a civic event live from the air. Set up a hover clear of other traffic.", lowLevelOps: true },
        { imgId: 179, title: "Cinematic Tracking Shots", payload: "capturing dynamic tracking shots", instruction: "You're capturing dynamic tracking shots for the director of a new action movie. ", lowLevelOps: true },
        { imgId: 180, title: "Pipe Lift", payload: "moving heavy pipe segments into rugged terrain", instruction: "Remember to use the specialized rigging techniques you were taught, to avoid dangerous load spinning. ", minCargo: 201, lowLevelOps: true },
        { imgId: 181, title: "Aerial Washing", payload: "cleaning high-tension wire infrastructure", instruction: "You're cleaning high-tension lines using high-pressure jets of demineralized water while the power grid remains fully active. ", lowLevelOps: true },
        { imgId: 182, title: "Sensitive Documents", payload: "transporting highly sensitive legal tenders", instruction: "You've got highly sensitive documents on board and the package is handcuffed to the courier. " },
        { imgId: 191, title: "Ground Team Insertion", payload: "deploying a specialized ground team", instruction: "Deploying a specialized ground team into the LZ. Use the terrain on the approach. Stabilize the hover. ", heliOps: true, lowLevelOps: true },
        { imgId: 192, title: "Perimeter Watch", payload: "conducting a perimeter survey", instruction: "Reports of suspicious movement along the vector. Hold corridor track. Log contacts. Watch loiter fuel. Do not engage.", heliOps: true, lowLevelOps: true },
        { imgId: 193, title: "Dignitary Base Tour", payload: "flying visiting dignitaries around the installation", instruction: "Visiting dignitaries want clear photos of the base from a safe standoff. Soft ride. Predictable banks." },
        { imgId: 194, title: "SAR Training Sortie", payload: "conducting a local SAR training sortie", instruction: "Outbound to the training grid for low-altitude hover work. Watch for the training beacons.", heliOps: true, lowLevelOps: true },
        { imgId: 195, title: "Outpost Resupply", payload: "delivering essential provisions to an observation post", instruction: "Field rations and spare radio batteries in the back. Ease into the LZ. Watch for wind shear off the terrain.", heliOps: true },
        { imgId: 196, title: "Command Briefing", payload: "transporting regional commanders to a joint briefing", instruction: "Regional commanders are on board for a joint briefing. " },
        { ...SCENARIO_183_UNKNOWN_PILLAR_TEXT, minCargo: 201, weight: 3, heliOps: true }
    ],
    'militaryTransit-MIL': [
        { imgId: 197, title: "Encrypted Telemetry Run", payload: "transferring encrypted telemetry hardware", instruction: "Secure flight data recorders from a defense contractor are being loaded. Standard OPSEC. Keep quiet. Stick to the plan." },
        { imgId: 198, title: "Unmarked Container Run", payload: "moving unmarked secure containers", instruction: "Unmarked secure containers on the flight plan. No questions. Go straight to destination." },
        { imgId: 199, title: "Relocation Services", payload: "relocating contracted defense personnel", instruction: "Standard military charter with contracted defense personnel aboard. Fly it like any heavy jet sector and bring these troops to their new base.", excludedAircraft: ["VULC"], requiresPax: true },
        { imgId: 200, title: "Base Hop", payload: "repositioning to a strategic staging airfield", instruction: "Peacetime repositioning to a strategic staging airfield. Sterile cockpit. Work with military ATC for your arrival window." },
        { imgId: 201, title: "Peacetime Navigation Exercise", payload: "executing a peacetime navigation exercise", instruction: "Nail the fuel plan and waypoint timings. Fly it by the numbers. Refuelling is available en route if required." },
        { imgId: 202, title: "Tactical Escort", payload: "relocating staff personnel under tactical escort", instruction: "Low-profile transit of key defense personnel under UAV escort. Direct routing, assigned levels. No deviations from the flight plan.", excludedAircraft: ["VULC"], requiresPax: true },
        { imgId: 203, title: "Diplomatic Priority", payload: "delivering priority diplomatic communications", instruction: "Priority diplomatic communications on board. Maintain chain of custody. Stay on the filed flight path." },
        { imgId: 204, title: "Off The Books", payload: "transferring cryogenic xenobiological tissue samples", instruction: "Captain, this flight officially does not exist. Ignore any knocking from the hold and do not go back there to check. Do not log this flight.", weight: 1 },
        { imgId: 205, title: "High-Speed SAR Support", payload: "providing high-speed search and rescue support", instruction: "High-speed SAR support along the route. Scan for beacons or visual distress. Pass coordinates to the extraction teams. Hold your search profile." },
        { imgId: 206, title: "Surface Anomaly Patrol", payload: "patrolling the designated vector for surface anomalies", instruction: "Patrolling the designated vector for surface anomalies. Eyes on the surface. Call any unregistered traffic up to sector command." },
        { imgId: 207, title: "UHF Relay Station", payload: "providing a localized UHF/VHF relay for ground exercises", instruction: "Holding steady over the sector as a UHF/VHF relay for ground exercises. Watch your fuel. Monitor instruments and oxygen." }
    ],
    'tacticalJet-MIL': [
        { imgId: 208, title: "Passive Telemetry Run", payload: "gathering passive telemetry data", instruction: "Gathering passive telemetry data. Fly the filed route exactly. Onboard equipment needs precision to triangulate regional signal traffic accurately." },
        { imgId: 209, title: "Ground Radar Profile", payload: "providing a target profile for ground-based early warning systems", instruction: "Providing a target profile for ground-based early warning systems. Hold altitude and airspeed exactly as filed. This data is needed to calibrate radar returns." },
        { imgId: 210, title: "Radar Intercept", payload: "intercepting unidentified radar contacts", instruction: "Intercepting unidentified radar contacts. Keep your speed up. Watch the tactical displays for vectored intercepts. This might be E.T." },
        { imgId: 211, title: "Cross Service Exercise", payload: "conducting a cooperative cross-service nav exercise", instruction: "Cooperative cross-service navigation exercise. Match profiles with the allied assets. Timing has to be spot-on for the rendezvous." },
        { imgId: 212, title: "Sensor Integrity Check", payload: "verifying long-range optical and radar sensor integrity", instruction: "Ground stations need a clean target for tracking telemetry. Keep the airframe stable. These new pods hate vibration." },
        { imgId: 213, title: "Approach Vector Check", payload: "re-validating primary approach vectors", instruction: "Re-validating primary approach vectors. Non-precision approach practice. Log the navaids properly. Fly by the book." },
        { imgId: 214, title: "Off-Cycle Ferry", payload: "repositioning airframes for off-cycle maintenance", instruction: "Ferry flight for off-cycle maintenance. Watch your temps. Keep the engines cool." },
        { imgId: 215, title: "Two-Ship Formation", payload: "conducting a two-ship proficiency transit", instruction: "Two-ship proficiency transit. Do not try to recreate that scene from Top Gun again, you have your orders." },
        { imgId: 216, title: "Handling Check", payload: "conducting a handling and proficiency check", instruction: "Handling and proficiency check. Fight through the G's and try not to black out." },
        { imgId: 217, title: "Terrain Masking Run", payload: "executing a high-speed, terrain-masking profile", instruction: "High-speed terrain-masking profile. Hold 250 feet AGL through the corridor. Watch for birds and smile for the cameras." },
        { imgId: 218, title: "Red Air Exercise", payload: "providing support for regional exercises", instruction: "Your chance to be the bad guy. Hold the intercept vectors, test friendly radar response, log contacts, then continue to destination.", excludedAircraft: ["B461_MIL"] },
        { imgId: 219, title: "Air Show", payload: "ferrying to a regional aviation festival", instruction: "You've been instructed to arrive before 7am. This is a busy airfield, so watch out for slow civilian flights on arrival." },
        { ...SCENARIO_220_TANKER_APPROACH_TEXT, excludedAircraft: ["SPIT", "BF109", "F6F", "P38"] }
    ],
    'reconnaissance-MIL': [
        { ...SCENARIO_220_TANKER_APPROACH_TEXT, missionType: 32, excludedAircraft: ["SPIT", "BF109", "F6F", "P38", "FW08", "A6M5"] },
        { imgId: 221, title: "Transit Recon Sortie", missionType: 32, payload: "conducting a transit reconnaissance sortie", instruction: "Fly departure to destination on the assigned recon route. Hold altitude and airspeed. Sensors need continuous imagery along the corridor." },
        { imgId: 222, title: "Transit Corridor Map", missionType: 32, payload: "mapping the assigned transit corridor", instruction: "Mapping the assigned transit corridor. Fly direct. Hold a steady track and altitude. Let the mapping systems build a clean picture.", preferredAircraft: VULCAN_RECON_PREFERRED },
        { imgId: 223, title: "Eye In The Sky", missionType: 32, payload: "photographing designated areas along the route", instruction: "Your mission is to photograph designated areas along the route. Analysts need the imagery synced with the waypoints in your flight plan, no deviations.", preferredAircraft: VULCAN_RECON_PREFERRED },
        { imgId: 249, title: "Formation Transit", missionType: 32, payload: "conducting a two-ship formation proficiency transit", instruction: "Two-ship formation transit, from departure to destination. Keep wingman spacing inside limits through the climb and cruise.", preferredAircraft: VULCAN_RECON_PREFERRED },
        { imgId: 250, title: "Refuelling Practice", missionType: 32, payload: "conducting aerial refuelling approach practice", instruction: "Aerial refuelling approach practice, same drill as always. Hold airspeed and altitude as briefed, and try not to break another refuelling nozzle.", excludedAircraft: ["SPIT", "BF109", "F6F", "FW08", "P38"] }
    ],
    gliderOps: [
        { imgId: 224, title: "Thermal Cross Country", payload: "flying a club cross-country task between glider fields", instruction: "Launch from {dep_field} and go hunting for lift toward {dest_field}. Puffy-topped cumulus with a flat, dark base is where the thermals live, so give the wispy, decaying stuff a wide berth." },
        { imgId: 225, title: "Practice Makes Perfect", payload: "building local soaring currency above {dep_field}", instruction: "Stay in the local area above {dep_field}. Feel for lift and bank smoothly into the rising air. Return to the airfield if the weather conditions worsen." },
        { imgId: 226, title: "Lift Me Up", payload: "working available lift toward {dest_field}", instruction: "Use rising air currents to gain altitude between {dep_field} and {dest_field}. Ride thermals wherever you find them. Stay clear of lee-side turbulence and scan for alternative landing options." },
        { imgId: 227, title: "Student Training Flight", payload: "conducting a dual instructional sortie from {dep_field}", instruction: "A student's aboard from {dep_field} for handling and lookout practice. Talk through how you're reading the sky as you go. " },
        { imgId: 228, title: "Powered Glider Ferry", payload: "ferrying under power from {dep_field} to {dest_field}", instruction: "The club needs this glider repositioned from {dep_field} to {dest_field}. Climb to a safe altitude, shut down and soar whenever you can." },
        { imgId: 229, title: "Contest Practice", payload: "flying a contest-style practice task", instruction: "A practice speed task from {dep_field} to {dest_field}. Work your height band, plan the turns before you hit weak lift, and lean on cloud streets to cover distance." }
    ]
};

// Per-scenario isLocal/isMilitary flags — authoritative source is mission-scenario-flags-data.js
// (generated by the mission editor's Scenario Flags panel). Applies onto scenarioDB by imgId.
// isMilitary: excludes a scenario from civilian aircraft unless "Use Military Airbases" is on.
// civilOk: on an isMilitary scenario, additionally clears it for civilian aircraft when
// "Use Military Airbases" is on (isMilitary alone still blocks them otherwise).
function applyScenarioFlags(embed) {
    if (!embed || typeof scenarioDB === "undefined") return;
    const localSet = new Set(Array.isArray(embed.localImgIds) ? embed.localImgIds : []);
    const militarySet = new Set(Array.isArray(embed.militaryImgIds) ? embed.militaryImgIds : []);
    const civilOkSet = new Set(Array.isArray(embed.civilOkImgIds) ? embed.civilOkImgIds : []);
    Object.keys(scenarioDB).forEach(poolKey => {
        scenarioDB[poolKey].forEach(s => {
            if (localSet.has(s.imgId)) s.isLocal = true;
            if (militarySet.has(s.imgId)) s.isMilitary = true;
            if (civilOkSet.has(s.imgId)) s.civilOk = true;
        });
    });
}

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
}

const missionMatrix = [
    // UNIQUE MISSION TEMPLATES — one mission (imgId) each via pool "uniqueMissions"
    { type: 1, name: "EGLC Steep Departure", pool: "uniqueMissions", requiredDep: "EGLC", maxMTOW: 75500 },
    { type: 2, name: "EGNS Steep Departure", pool: "uniqueMissions", requiredDep: "EGNS", maxMTOW: 75500 },
    { type: 3, name: "Santos Dumont Departure", pool: "uniqueMissions", requiredDep: "SBRJ", maxMTOW: 75500 },
    { type: 4, name: "Comanche Cross Country", pool: "uniqueMissions" },
	{ type: 5, name: "High-Altitude Transit", pool: "uniqueMissions", minAlt: 10000, rules: "IFR" },
    { type: 7, name: "Whisperjet Operations", pool: "uniqueMissions" },
    { type: 8, name: "Geological Research", pool: "uniqueMissions" },
    { type: 9, name: "Outpost Supply Run", pool: "uniqueMissions" },
    { type: 10, name: "Albatross Patrol", pool: "uniqueMissions" },
    { type: 11, name: "Survey Team Transfer", pool: "uniqueMissions" },
    { type: 12, name: "Bulk Supply Drop", pool: "uniqueMissions" },
    { type: 13, name: "Heritage SAR Demo", pool: "uniqueMissions" },
    // DYNAMIC MASTER TEMPLATES - no image required
    { type: 14, name: "Commercial Service", pool: "commercial" },
    { type: 15, name: "Regional Commuter", pool: "commercial-regional" },
    { type: 16, name: "Executive Charter", pool: "executive" },
    { type: 17, name: "Light Freight Ops", pool: "lightFreight", maxMTOW: 5000, maxMTOWAppliesTo: ["GA", "TURBO"] },
    { type: 18, name: "Heavy Cargo Transport", pool: "heavyFreightMissions", minCargo: 2000 },
    { type: 19, name: "Medical Relay", pool: "medical" },
    { type: 20, name: "Aerial Survey", pool: "surveyServices", maxMTOW: 8000 },
    { type: 21, name: "Rotary Wing Operations", pool: "helicopterMissions" },
    { type: 23, name: "Tactical Sortie", pool: "tacticalJet-MIL", militaryOnly: true, tacticalOnly: true },
    { type: 24, name: "Military Logistics", pool: "militaryTransit-MIL", militaryOnly: true },
    { type: 25, name: "Heritage Flight", pool: "vintageOps" },
    { type: 26, name: "Classic Airliner Charter", pool: "vintageAirliner" },
    { type: 27, name: "Weather Ops", pool: "highAltServices" },
    { type: 28, name: "Air Taxi", pool: "lightPax", maxMTOW: 6000, maxMTOWAppliesTo: ["GA", "TURBO", "HELI"] },
    { type: 32, name: "Strategic Recon.", pool: "reconnaissance-MIL", militaryOnly: true },
    { type: 33, name: "Vintage Propliner Freight", pool: "vintageProplinerFreight", minCargo: 2000 },
    { type: 34, name: "Gliding Operations", pool: "gliderOps", rules: "VFR/Scenic" },
    { type: 39, name: "Regional Freight Pulse", pool: "regionalFreight" }
];

const scenarioDB = {
    uniqueMissions: [
        { imgId: 1, weight: 2, title: "EGLC Steep Departure", missionType: 1, instruction: "EGLC demands a disciplined departure. Fly the approved steep-climb profile, manage thrust carefully, and keep the noise footprint to a minimum." },
        { imgId: 2, weight: 2, title: "EGNS Steep Departure", missionType: 2, instruction: "Noise restrictions make this a precision departure. Establish the steep-climb profile promptly and remain within the published limits." },
        { imgId: 3, weight: 2, title: "Santos Dumont Departure", missionType: 3, instruction: "Santos Dumont leaves little room for delay. Use the available runway efficiently, establish the climbing turn after departure, and maintain close terrain awareness." },
        { imgId: 4, weight: 2, title: "Comanche Cross Country", missionType: 4, instruction: "You are taking part in a cross-country rally. Manage the mixture carefully and monitor the cylinder-head temperatures." },
        { imgId: 5, weight: 2, title: "High Altitude Transit", missionType: 5, instruction: "Take this service above the lower-level weather and settle into an efficient cruise. Monitor the oxygen system and keep the flight on schedule." },
        { imgId: 7, weight: 2, title: "Whisperjet Operations", missionType: 7, instruction: "This aircraft earned its reputation through quiet, efficient operation. Fly a stable descent and configure early enough for a smooth landing." },
        { imgId: 8, weight: 2, title: "Geological Research",   missionType: 8, instruction: "A university team is measuring changes in the surface below. Hold a steady low-level track and monitor the Albatross's engine temperatures throughout the survey." },
        { imgId: 9, weight: 2, title: "Outpost Supply Run",   missionType: 9, instruction: "The Albatross is carrying a full load of overdue supplies. Expect heavier handling, plan the approach carefully, and protect the cargo with a smooth arrival.", minCargoLoadFactor: 0.70 },
		{ imgId: 10, weight: 2, title: "Albatross Patrol",  missionType: 10, instruction: "The Albatross is scheduled for another observation patrol. Maintain a steady profile, keep a good lookout, and use smooth, coordinated turns." },
        { imgId: 11, weight: 2, title: "Survey Team Transfer", missionType: 11, instruction: "A survey team and its sensitive equipment are on board. Avoid abrupt manoeuvres and deliver both passengers and instruments with a gentle landing." },
        { imgId: 12, weight: 2, title: "Bulk Supply Drop", missionType: 12, instruction: "Essential supplies are needed at the destination. Confirm the delivery area, fly a controlled approach, and release the load cleanly.", minCargoLoadFactor: 0.70 },
        { imgId: 13, weight: 2, title: "Heritage SAR Demo", missionType: 13, instruction: "This demonstration honours the flying-boat crews who served on search-and-rescue duty. Maintain a vigilant lookout and fly the Albatross with measured, deliberate handling." }
    ],
        commercial: [
        { imgId: 14, weight: 10,title: "Team Charter", instruction: "{team}, the coaching staff, and the medical team are travelling to their next match. Keep the cabin comfortable with a gentle climb, smooth cruise, and stable descent." },
        { imgId: 15, weight: 10, title: "Annual Leave Charter", instruction: "The cabin is full of passengers ready to begin their holiday. Keep the service relaxed, the ride smooth, and the celebrations under reasonable control." },
        { imgId: 16, weight: 10,title: "Storm Recovery", instruction: "Recent disruption has left these passengers waiting far too long. Run a reliable recovery sector and get them moving toward their original destination." },
        { imgId: 17, weight: 10, title: "Scheduled Hub Link", instruction: "This is a routine scheduled connection between major hubs. Review the weather, verify the load sheet, and deliver a punctual, by-the-book sector." },
        { imgId: 18, weight: 10, title: "Peak Season Transport", instruction: "A full cabin of holidaymakers is waiting to depart. Protect the block time, manage the turnaround efficiently, and keep the ride comfortable." },
        { imgId: 19, weight: 10,title: "Tech Convention Charter", instruction: "The passengers are already working. Find smooth air and maintain a quiet cabin so they can stay productive throughout the flight." },
        { imgId: 20, weight: 10, title: "High Capacity Route", instruction: "Peak-season traffic has filled both the cabin and the airspace. Monitor fuel carefully, anticipate delays, and remain ready for extended sequencing." },
        { imgId: 21, weight: 10, title: "System Recovery Run", instruction: "A network failure has left these passengers delayed and exhausted. Plan ahead, coordinate the descent early, and complete the recovery without adding further disruption." },
        { imgId: 22, weight: 10, title: "Corporate Offsite Run", instruction: "These passengers are returning from a demanding corporate offsite. Give them a quiet, efficient flight and get them home without unnecessary delay." },
        { imgId: 23, weight: 10, title: "Flagship Service Route", instruction: "This is one of the airline's flagship sectors. Deliver a polished service, protect the schedule, and prepare for a rapid turnaround after arrival." },
        { imgId: 24, weight: 10, title: "Tight Turnaround", instruction: "The turnaround window is narrow and the schedule is already moving. Complete the checks efficiently, coordinate with ground control, and depart without cutting corners." },
        { imgId: 25, weight: 10, title: "Standard Sector", instruction: "A standard commercial sector still deserves professional execution. Fly the procedure, maintain the schedule, and treat the aircraft with the respect its value demands." },
        { imgId: 26, weight: 10, title: "Business Shuttle", instruction: "The morning business shuttle is operating into busy airspace. Stay ahead of the traffic flow, maintain separation, and give the passengers a smooth start to the day." },
        { imgId: 27, weight: 10, title: "Student Charter", instruction: "A large group of university students is travelling to an event. Expect a lively cabin, support the crew, and use the seatbelt signs when necessary." },
        { imgId: 28, weight: 10, title: "Touring Orchestra", instruction: "A touring orchestra and its instruments are travelling to the next performance. Avoid turbulence where possible and handle the aircraft with measured, gentle inputs." },
        { imgId: 29, weight: 10,title: "Host Family Charter", instruction: "A cabin of exchange students is travelling to meet their host families. Keep the flight welcoming, punctual, and smooth from departure to arrival." },
        { imgId: 30, weight: 10, title: "Merger Seminar Run", instruction: "Company personnel are travelling to a major post-merger seminar. The cabin is full, so manage the load carefully and keep the sector firmly on schedule." },
        { imgId: 31, weight: 10, title: "Title Match Charter", instruction: "Supporters are travelling to a championship final and the atmosphere is already lively. Coordinate with the cabin crew and keep the celebrations safely contained." },
        { imgId: 32, weight: 10, title: "Sun Seekers", instruction: "The cabin is full of passengers escaping the colder season. Use gentle manoeuvres and give them a soft arrival to begin their stay properly." }
    ],
    'commercial-regional': [
        { imgId: 33, weight: 10, title: "Regional Commuter", instruction: "Early commuters are boarding with coffee in hand and little conversation to spare. Keep the sector smooth, punctual, and pleasantly uneventful." },
        { imgId: 34, weight: 10, title: "Short Sector Circuit", instruction: "Today's roster consists of several short sectors in quick succession. Protect each turnaround, manage the cabin temperature, and stay ahead of changing weather." },
        { imgId: 35, weight: 10, title: "Regional Link", instruction: "This scheduled connection supports an entire regional community. Maintain the timetable and protect the onward connections waiting at the destination." },
        { imgId: 36, weight: 10, title: "Late Night Commuter", instruction: "The network is quiet, but efficiency still matters. Use a smooth climb, an economical cruise, and only as much fuel as the sector requires." },
        { imgId: 37, weight: 10, title: "Weather Recovery Sector", instruction: "Previous cancellations have left a cabin of tired passengers waiting to get home." },
        { imgId: 38, weight: 10, title: "Holiday Sector", instruction: "Every seat is occupied by passengers ready to begin their holiday." },
        { imgId: 39, weight: 10, title: "Diverted Flight Recovery", instruction: "These passengers have already endured a diversion and a lengthy delay. Fly a clean, quiet sector and return them to their destination with minimal fuss." },
        { imgId: 40, weight: 10, title: "Tradeshow Charter", instruction: "A delegation is travelling to an international trade show. Keep the service punctual and professional so they arrive ready for a long day of meetings." },
        { imgId: 41, weight: 10, title: "Feeder Network", instruction: "This high-frequency feeder keeps the wider network connected. Load efficiently, fly accurately, turn the aircraft quickly, and prepare to do it again." },
        { imgId: 42, weight: 10, title: "Routine Hub Feeder", instruction: "Another routine hub feeder is on the schedule. Fly it cleanly, take approved shortcuts where available, and protect the turnaround time." },
        { imgId: 43, weight: 10, title: "Student Transfer", instruction: "A group of exchange students is travelling to meet their host families. Keep the flight smooth, welcoming, and firmly on schedule." },
        { imgId: 44, weight: 10, title: "Merger Staff Charter", instruction: "Employees are travelling to a post-merger seminar on a short, full sector. Keep the operation efficient and let the passengers worry about the corporate agenda." },
        { imgId: 259, weight: 10, title: "Network Feeder", instruction: "This scheduled sector carries connecting passengers into the wider network." },
        { imgId: 260, weight: 10, title: "Late Link", instruction: "Earlier disruption has left a small group of passengers waiting to continue their journey." },
        { imgId: 261, weight: 10, title: "Crew Change", instruction: "A relief crew must reach the next operating base before their assigned duty begins." },
        { imgId: 262, weight: 10, title: "Market Shuttle", instruction: "This regular service supports local business travel during a busy travel period." },
        { imgId: 263, weight: 10, title: "Final Call", instruction: "Passengers are travelling on the last sector of the day. Keep the turnaround efficient, avoid unnecessary delay, and provide a smooth landing." }
	],
	executive: [
        { imgId: 45, weight: 6,title: "Silent Charter", instruction: "{name} has requested a quiet cabin. Use gentle power changes, shallow turns, and the smoothest descent you can deliver." },
        { imgId: 46, weight: 10,title: "Wheels Up", instruction: "{athlete} needs uninterrupted rest before the next engagement. Keep the flight smooth from pushback to touchdown so they arrive refreshed." },
        { imgId: 47, weight: 10, title: "Deal Team Charter", instruction: "The passengers are negotiating a major deal in the cabin. Maintain a quiet environment and avoid interruptions unless necessary." },
        { imgId: 48, weight: 10, title: "Flying Boardroom", instruction: "The cabin is serving as a flying boardroom today. Keep the coffee steady, the atmosphere quiet, and the landing suitably polished." },
        { imgId: 49, weight: 10, title: "State Delegation", instruction: "Government representatives and press staff are on the manifest. Follow the filed procedures, maintain professional discipline, and avoid unnecessary shortcuts." },
        { imgId: 50, weight: 10, title: "Conference Charter", instruction: "{vip_type} is travelling to a high-level conference. Deliver a discreet, polished service and ensure the arrival reflects the importance of the passenger." },
        { imgId: 51, weight: 10, title: "Tight Schedule", instruction: "An executive group is waiting and their schedule leaves little margin. Complete the preparation efficiently and recover as much time as conditions safely allow." },
        { imgId: 52, weight: 8, title: "Fractional Owner Flight", instruction: "A fractional owner accustomed to premium service is aboard. Make the operation look effortless, but never trade comfort or safety for speed." },
        { imgId: 53, weight: 10, title: "Investor Roadshow", instruction: "A major investment proposal is being presented in the cabin. Find smooth air and give the passengers the quiet environment they need to close the deal." },
        { imgId: 54, weight: 7,title: "Secure Witness Transfer", instruction: "A protected witness is being transferred under strict confidentiality. Operate discreetly, follow the approved routing, and keep attention to an absolute minimum." },
        { imgId: 55, weight: 10,title: "Priceless Cargo", instruction: "A valuable Renaissance artwork is secured in the cabin. Maintain stable temperature and humidity, avoid turbulence, and handle the aircraft with exceptional care." },
        { imgId: 56, weight: 10, title: "Legal Counsel", instruction: "A legal team is working through an urgent case during the flight. Keep the cabin quiet and the ride smooth so they can work without interruption." },
        { imgId: 57, weight: 10,title: "First-Class Feline", instruction: "A tech billionaire's fabulous feline has the cabin to herself after a stay at a luxury retreat. Provide a quiet ride, gentle handling, and the standard of service its owner expects.", exactPax: 1 },
        { imgId: 58, weight: 7,title: "Private Shopping Charter", instruction: "{musician} is travelling on a private shopping trip. Keep the service discreet, the cabin relaxed, and the flight smooth enough for a proper celebration." },
        { imgId: 59, weight: 10, title: "Golf Weekend", instruction: "You were specifically requested for this private golf charter. Deliver an easy ride, an unhurried approach, and a landing worthy of the recommendation." },
        { imgId: 60, weight: 10, title: "Business Commute", instruction: "The passengers have chosen private aviation to avoid airline delays. Request efficient routing where available and keep the block time as tight as conditions permit." },
        { imgId: 61, weight: 7,title: "Stadium Gig", instruction: "{musician} and the crew need rest before the next stadium performance. Avoid turbulence where possible and maintain a stable, comfortable cabin environment." },
        { imgId: 62, weight: 6,title: "Spiritual Retreat", instruction: "{name} is travelling to meet a spiritual adviser under intense media interest. Park discreetly and keep all passenger details off open frequencies." },
        { imgId: 63, weight: 10,title: "Athletic Luxury", instruction: "{athlete} must arrive rested and on schedule for an upcoming event. Seek efficient handling where available and keep the ride smooth through the descent" },
        { imgId: 64, weight: 7,title: "Premiere Escort", instruction: "{name} is travelling to a major premiere and requires a discreet arrival. Coordinate the private handling arrangements and avoid the main press areas." },
        { imgId: 65, weight: 10,title: "Transfer News", instruction: "{team} executives are travelling to an away fixture under close media attention. Keep the operation discreet, punctual, and professionally managed." },
        { imgId: 66, weight: 10, title: "Medical Team Transport", instruction: "A specialist medical team is needed urgently at the receiving hospital. Minimise delays, request priority where justified, and deliver them safely and efficiently." },
        { imgId: 67, weight: 10,title: "Private Gala Charter", instruction: "Tonight's {vip_type} expects a premium private service. The cabin is prepared, the refreshments are stocked, and discretion is essential." },
        { imgId: 68, weight: 5, title: "Boardroom Rescue", instruction: "A company crisis is escalating and the chief executive must reach an urgent board meeting. Tighten the block time wherever safely possible." }
    ],
	medical: [
        { imgId: 69, weight: 10, title: "Priority Medical Transfer", instruction: "A medical patient requires a stable transfer. Avoid turbulence where possible, use gentle control inputs, and keep the approach and landing smooth." },
        { imgId: 70, weight: 10, title: "Lifeguard Priority", instruction: "This is a Lifeguard-priority transport carrying essential transplant tissue. Maintain the required conditions and minimise every avoidable delay." },
        { imgId: 71, weight: 10, title: "Medevac Transport", instruction: "The patient has been stabilised and the medical crew is ready for transfer. Fly a smooth, direct sector and coordinate priority handling on arrival." }
    ],
	lightFreight: [
        { imgId: 72, weight: 10, title: "Diplomatic Escort", instruction: "Classified diplomatic files are secured to a heavily guarded courier. Maintain discretion and follow the approved routing.", minCargoLoadFactor: 0.40 },
        { imgId: 73, weight: 10, title: "Prototype Delivery", instruction: "Sensitive prototype hardware is loaded aboard. Complete the environmental checks, control temperature carefully, and minimise static exposure throughout the flight.", minCargoLoadFactor: 0.60 },
        { imgId: 74, weight: 10, title: "Live Cargo Hop", instruction: "Live animals are secured in the hold. Use shallow banks, gradual power changes, and a gentle descent to keep both the cargo and handlers calm.", minCargoLoadFactor: 0.60 },
        { imgId: 75, weight: 3, title: "Sapling Delivery", instruction: "Young saplings are travelling under controlled conditions. Maintain stable pressure and temperature, and use a gentle descent before arrival.", minCargoLoadFactor: 0.40 },
        { imgId: 76, weight: 8, title: "Digital Masters", instruction: "Unedited production footage is required at the receiving studio. Protect the media from temperature extremes and deliver it within the scheduled window.", minCargoLoadFactor: 0.40 },
        { imgId: 77, weight: 10, title: "Manuscript Rescue", instruction: "Irreplaceable manuscripts are travelling under strict environmental controls. Maintain stable temperature and humidity, and have ground handling ready on arrival.", minCargoLoadFactor: 0.60 },
        { imgId: 78, weight: 10, title: "AOG Callout", instruction: "A grounded aircraft is waiting for the component in your hold. Use efficient routing, protect the cargo, and deliver it before the maintenance window closes.", minCargoLoadFactor: 0.60 },
        { imgId: 79, weight: 10, title: "Medical Freight Rush", instruction: "Temperature-controlled medical freight is urgently required at the receiving hospital. Request priority where appropriate and maintain stable pressurisation throughout.", minCargoLoadFactor: 0.40 },
        { imgId: 80, weight: 10, title: "Medical Cargo Transfer", instruction: "The {med_cargo} have been secured in the hold. Maintain the specified temperature and avoid rapid climbs or descents that could compromise the shipment.", minCargoLoadFactor: 0.40 },
        { imgId: 81, weight: 10, title: "Clinic Dash", instruction: "A clinic is waiting for these {med_cargo} before a scheduled procedure. Keep the block time tight and coordinate a direct handover after parking.", minCargoLoadFactor: 0.40 },
        { imgId: 82, weight: 10, title: "Farm Produce Delivery", instruction: "Fresh produce is travelling directly from the grower to regional retailers. Maintain the required temperature and deliver it while it is still at its best.", minCargoLoadFactor: 0.60 },
        { imgId: 83, weight: 10, title: "Overnight Express", instruction: "This overnight freight service keeps the regional network moving. Protect the departure slot, meet the arrival window, and keep the operation flowing.", minCargoLoadFactor: 0.60 },
        { imgId: 84, weight: 10, title: "Regional Mail Circuit", instruction: "A traditional multi-stop mail circuit is on the schedule. Keep each turnaround brief and protect the remaining delivery windows.", minCargoLoadFactor: 0.60 },
        { imgId: 85, weight: 10, title: "Essential Supply Drop", instruction: "Mail and essential supplies have been loaded. Recheck density altitude, confirm performance, and do not commit until the margins are sound.", minCargoLoadFactor: 0.40 },
        { imgId: 86, weight: 10, title: "Regional Supply Relay", instruction: "A routine regional supply load is ready for delivery. Confirm the arrival weight, control the approach speed, and plan the offload before landing.", minCargoLoadFactor: 0.40 },
        { imgId: 87, weight: 10, title: "Lab Sample Dash", instruction: "These {med_cargo} are time-sensitive and must arrive intact. Maintain the required conditions and coordinate a rapid handover to the waiting hospital team.", minCargoLoadFactor: 0.40 },
        { imgId: 88, weight: 10, title: "Morning Paper Run", instruction: "The hold is stacked with the morning edition and distributors are waiting. Depart before dawn and deliver the papers before the day's news becomes old.", minCargoLoadFactor: 0.60 },
        { imgId: 89, weight: 10, title: "Seafood Express", instruction: "Fresh seafood is packed on ice for the evening trade. Maintain the cold chain and deliver it before the next service begins.", minCargoLoadFactor: 0.60 },
        { imgId: 91, weight: 10, title: "Rare Component Relay", instruction: "A rare replacement part is needed for a valuable vintage vehicle. Save time where safely possible, but keep the aircraft comfortably within its limits.", minCargoLoadFactor: 0.60 },
        { imgId: 92, weight: 10, title: "Machinery Airlift", instruction: "A critical agricultural machine is out of service during the busiest part of the season. Deliver the replacement parts quickly and protect them from rough handling.", minCargoLoadFactor: 0.60 },
        { imgId: 94, weight: 10, title: "Last Light Mail Run", instruction: "This is the final mail departure before nightfall. Protect the schedule so the shipment reaches the hub in time for onward distribution.", minCargoLoadFactor: 0.60 },
        { imgId: 95, weight: 10, title: "Community Supply Circuit", instruction: "Food, fuel, and mail are bound for a community relying on this delivery. Fly a careful approach and maintain a sharp lookout for wildlife.", minCargoLoadFactor: 0.60 },
        { imgId: 145, weight: 6, title: "Duke of Halstead", instruction: "A private client is waiting for this unusual estate delivery. Manage the crosswind, land cleanly, and arrange a prompt offload after parking.", minCargoLoadFactor: 0.50 }
    ],
    regionalFreight: [
        { imgId: 96, weight: 10, title: "Night Express", instruction: "The overnight network depends on every slot being met. Protect the schedule and avoid becoming the delay that holds the entire system back.", minCargoLoadFactor: 0.80 },
        { imgId: 97, weight: 10, title: "Priority Parcels", instruction: "The sorting facility is working to a strict cutoff. Request efficient routing at the first sign of delay and protect the arrival window.", minCargoLoadFactor: 0.70 },
        { imgId: 98, weight: 10, title: "Regional Red-Eye", instruction: "This overnight service links the regional hubs while traffic is light. Meet the assigned slots and fly a quiet, stable descent.", minCargoLoadFactor: 0.80 },
        { imgId: 99, weight: 10, title: "Medical Freight Link", instruction: "Temperature-controlled medical freight is urgently required at a regional hospital. Maintain the cold chain and complete the quickest safe transfer available.", minCargoLoadFactor: 0.60 },
        { imgId: 100, weight: 10, title: "Lab Samples", instruction: "{med_cargo} are travelling directly to the laboratory without an intermediate stop. Maintain the specified conditions and deliver them to the waiting medical team.", minCargoLoadFactor: 0.60 },
        { imgId: 101, weight: 10, title: "Field Machinery", instruction: "Replacement machinery components are being collected for regional farms. Confirm the loading plan and ensure every item is secured before departure.", minCargoLoadFactor: 0.80 },
        { imgId: 102, weight: 10, title: "Regional Restock", instruction: "This service is restocking businesses across the region. Review the landing performance carefully and use reverse thrust only as conditions require.", minCargoLoadFactor: 0.70 },
        { imgId: 103, weight: 10, title: "Late Night Regional", instruction: "A quiet late-night regional sector is on the schedule. Use the lighter traffic to fly efficiently and conserve fuel without delaying the service.", minCargoLoadFactor: 0.70 },
		{ imgId: 264, weight: 10, title: "Parts Relay", instruction: "An AOG team is waiting for replacement components. Confirm the load is secure and arrange prompt handling after arrival.", minCargoLoadFactor: 0.80 },
		{ imgId: 265, weight: 10, title: "Fresh Cargo", instruction: "Perishable produce is travelling to replenish local stock before the next distribution cycle.", minCargoLoadFactor: 0.80 },
		{ imgId: 266, weight: 10, title: "Mail Circuit", instruction: "Priority mail and documents are booked for overnight network transfer.", minCargoLoadFactor: 0.70 },
		{ imgId: 267, weight: 10, title: "Workshop Run", instruction: "Specialist tools are required for a planned maintenance task at the receiving facility.", minCargoLoadFactor: 0.70 },
		{ imgId: 268, weight: 10, title: "Stock Refill", instruction: "Retail stock is moving to meet a scheduled replenishment programme.", minCargoLoadFactor: 0.80 }
	],
	heavyFreightMissions: [
        { imgId: 104, weight: 10, title: "Relief Pallet Run", instruction: "Relief pallets are scheduled for an aerial delivery. Verify the drop coordinates twice and release only when the aircraft is stable and correctly positioned.", minCargoLoadFactor: 0.70 },
        { imgId: 105, weight: 10, title: "Retail Supply Drop", instruction: "Boxed clothing is travelling to regional distribution warehouses. Keep the hold clean and dry, and protect the cartons from shifting in flight.", minCargoLoadFactor: 0.70 },
        { imgId: 106, weight: 10,title: "Museum Artifacts", instruction: "Fragile museum pieces are travelling to a new exhibition. Avoid abrupt manoeuvres and deliver every item in the same condition in which it was loaded.", minCargoLoadFactor: 0.50 },
        { imgId: 107, weight: 10, title: "Cargo Delivery", instruction: "Engineers are waiting for these {cargo_type}, and work cannot continue without it. Protect the load and deliver it within the required window.", minCargoLoadFactor: 0.70 },
        { imgId: 108, weight: 10, title: "Luxury Vehicle Transfer", instruction: "High-value vehicles are secured to the main deck. Have the loadmaster verify every restraint and confirm the centre of gravity before departure.", minCargoLoadFactor: 0.50 },
        { imgId: 109, weight: 10,title: "Supercar Delivery", instruction: "A bespoke supercar is secured for delivery to its owner. Confirm the restraints, protect the finish, and leave the vehicle untouched until the consignee arrives.", minCargoLoadFactor: 0.50 },
        { imgId: 110, weight: 10, title: "Oilfield Equipment", instruction: "{cargo_type} and heavy oilfield equipment are secured to the floor rails. Confirm the load distribution and stay ahead of the power curve during the approach.", minCargoLoadFactor: 0.70 },
        { imgId: 111, weight: 10, title: "Avionics Bay Return", instruction: "A retired avionics bay is travelling to a specialist restoration team. Handle it carefully before its eventual transfer to an aviation museum.", minCargoLoadFactor: 0.50 },
        { imgId: 112, weight: 10, title: "Perishable Delivery", instruction: "Perishable goods are required by regional supermarkets. Maintain a stable hold temperature and deliver them before shelf life begins to suffer.", minCargoLoadFactor: 0.70 },
        { imgId: 113, weight: 10, title: "Consumer Tech Express", instruction: "High-value consumer electronics are travelling directly from the factory. Verify the takeoff data, protect the cargo, and maintain the specified temperature.", minCargoLoadFactor: 0.70 },
        { imgId: 114, weight: 10, title: "Overnight Parcel Run", instruction: "The parcel network is operating against a strict sorting deadline. Request efficient routing when available and protect the scheduled arrival time.", minCargoLoadFactor: 0.70 },
        { imgId: 115, weight: 10,title: "Bullion Transfer", instruction: "A high-security bullion shipment is waiting on the ramp. Follow the handling plan precisely and maintain strict discretion throughout the flight.", minCargoLoadFactor: 0.85, exactPax: 10 },
        { imgId: 116, weight: 10, title: "Max Payload Push", instruction: "The aircraft is loaded near its operational limit. Recheck the takeoff data, expect a longer roll and reduced climb performance, and preserve every safety margin.", minCargoLoadFactor: 0.85 },
        { imgId: 117, weight: 10, title: "Overnight Cargo Run", instruction: "This overnight freight sector feeds the major sorting hubs. Meet the assigned slots and begin descent planning early enough for an efficient arrival.", minCargoLoadFactor: 0.70 },
        { imgId: 118, weight: 10, title: "E-Commerce Overflow", instruction: "The hold is full of late-night online orders and the sorting network is already backed up. Protect the schedule and get the shipment moving.", minCargoLoadFactor: 0.70 },
        { imgId: 119, weight: 10,title: "Podium Bound Freight", instruction: "A valuable racing chassis must reach the team before the weekend event. Protect the load, maintain the schedule, and avoid unnecessary handling.", minCargoLoadFactor: 0.50 },
        { imgId: 120, weight: 10, title: "Heavy Machinery", instruction: "Oversized industrial machinery is being secured to the main deck. Confirm every restraint with the loadmaster before requesting pushback.", minCargoLoadFactor: 0.85 },
        { imgId: 121, weight: 10, title: "Generator Haul", instruction: "An oversized generator is being locked to the cargo deck. Verify the centre of gravity, confirm the fuel plan, and expect heavy handling throughout the sector.", minCargoLoadFactor: 0.50 },
        { imgId: 122, weight: 10, title: "Turbine AOG Recovery", instruction: "A fragile turbine fan module is needed for an aircraft-on-ground recovery. Maintain a smooth ride, stable temperature, and careful ground handling.", minCargoLoadFactor: 0.50 },
        { imgId: 123, weight: 10, title: "Server Rack Delivery", instruction: "Server racks and data-centre hardware are secured in the hold. Protect the equipment from shock and deliver it within the installation window.", minCargoLoadFactor: 0.70 },
        { imgId: 184, weight: 10, title: "Tactical Vehicle Transport", instruction: "Tactical vehicles are being loaded onto the main deck. Confirm the spacing, restraints, and centre of gravity before the cargo doors close.", minCargoLoadFactor: 0.80 },
        { imgId: 185, weight: 10, title: "Defense Component Haul", instruction: "Defence components are required for assembly immediately after arrival. Follow the filed plan, protect the load, and meet the assigned block time.", minCargoLoadFactor: 0.80 },
        { imgId: 186, weight: 10, title: "Sealed Manifest Run", instruction: "The cargo is sealed and the manifest is restricted. Follow the approved routing and proceed directly to the designated remote parking position.", minCargoLoadFactor: 0.50 },
        { imgId: 187, weight: 10, title: "Priority Spares", instruction: "Priority maintenance spares are on board. Deliver them inside the assigned window or the receiving unit's maintenance programme will begin to slip.", minCargoLoadFactor: 0.50 },
        { imgId: 188, weight: 10, title: "AOG Inspection Run", instruction: "Maintenance personnel are waiting for this inspection hardware. Minimise the turnaround, protect the equipment, and complete the delivery without delay.", minCargoLoadFactor: 0.80 },
        { imgId: 189, weight: 10, title: "Tactical Pallet Load", instruction: "Palletised military stores are secured on the main deck. Check the tie-down tension, load distribution, and centre of gravity before engine start.", minCargoLoadFactor: 0.50 },
        { imgId: 190, weight: 10, title: "Relief Pallet Delivery", instruction: "Humanitarian pallets are bound for a forward distribution point. Maintain the schedule and confirm that an offload team will be ready on arrival.", minCargoLoadFactor: 0.80 }
    ],
    surveyServices: [
        { imgId: 124, weight: 6, title: "Civic Leaflet Drop", instruction: "Fly the assigned distribution route and maintain even spacing between release points. Stable altitude and accurate tracking are essential for complete coverage." },
        { imgId: 125, weight: 10, title: "Pipeline Survey", instruction: "Inspect the assigned utility and pipeline corridor. Maintain the survey track precisely and keep the cockpit sterile while operating on the line." },
        { imgId: 126, weight: 10, title: "Crop Inspection", instruction: "Fly a low, stable survey over the agricultural plots. Watch carefully for wires and obstacles while the team record the crop conditions." },
        { imgId: 127, weight: 10, title: "Municipal Survey", instruction: "A municipal development area requires accurate aerial mapping. Hold a constant track, altitude, and speed so the survey equipment produces clean data." },
        { imgId: 128, weight: 10, title: "Subsurface Mapping", instruction: "The team is mapping subsurface anomalies with sensitive equipment. Maintain constant altitude and airspeed, as even small deviations can distort the readings." },
        { imgId: 129, weight: 5, title: "Storm Assessment", instruction: "Survey teams need an aerial assessment after a recent storm. Fly a stable profile over the affected area so the damage can be recorded accurately." },
        { imgId: 130, weight: 8, title: "LIDAR Survey", instruction: "Researchers are conducting LIDAR passes over a newly identified archaeological site. Hold the survey lines precisely and let the sensors build a complete model." },
        { imgId: 131, weight: 10, title: "Property Photo Shoot", instruction: "A photographer requires stable orbits over several assigned waypoints. Coordinate each pass and keep the aircraft smooth enough for clean imagery." },
        { imgId: 132, weight: 4,title: "Anomaly Survey", instruction: "Researchers need to take readings of this {sci_fi}. Maintain a stable survey profile and monitor the instruments for unusual interference." },
        { imgId: 133, weight: 7,title: "Missing Vehicle Search", instruction: "Local authorities have requested aerial support in the search for a missing vehicle. Fly the assigned pattern and report any credible sighting immediately." },
    ],
    lightPax: [
        { imgId: 90, weight: 10, title: "Avionics Shop Run", instruction: "The aircraft's GPS has developed an intermittent fault and requires specialist attention. Ferry it to the service centre and monitor the remaining navigation systems closely." },
        { imgId: 93, weight: 10, title: "New Owner Ferry Flight", instruction: "The aircraft has just been handed over to its new owner. Ferry it to its home base gently and use the flight to become familiar with its handling." },
        { imgId: 134, weight: 10, title: "Staff Shuttle", instruction: "This is a routine staff shuttle between industrial facilities. Keep the operation punctual, practical, and comfortable for the passengers." },
        { imgId: 135, weight: 10, title: "Pilot Currency Flight", instruction: "Complete a local currency flight with standard manoeuvres, disciplined radio work, and accurate circuit procedures. Keep every exercise deliberate and controlled." },
        { imgId: 136, weight: 10, title: "The Workshop", instruction: "An engineering consultant is reviewing technical documents in the cabin. Seek smooth air and use steady, predictable control inputs throughout the flight." },
        { imgId: 137, weight: 10, title: "Community Link", instruction: "This service connects a community with the wider transport network. Maintain the schedule and protect the passengers' onward connections at the hub." },
        { imgId: 138, weight: 10, title: "Private Charter", instruction: "{name} requires complete privacy on this charter. Keep the operation discreet and never identify the client over an open frequency." },
        { imgId: 139, weight: 6, title: "VIP Spiritual Retreat", instruction: "{name} is travelling to meet a spiritual adviser. Arrange a discreet parking position and keep all references to the client off open channels." },
        { imgId: 140, weight: 6, title: "Twilight Scenic Flight", instruction: "A private twilight sightseeing flight has been booked. Use smooth power settings, shallow banks, and a gentle profile from departure to landing." },
        { imgId: 141, weight: 10, title: "Missed Connection", instruction: "A stranded business traveller has taken the last available seat after missing an airline connection. Keep the turnaround tight and give them every reasonable chance of reaching the hub." },
        { imgId: 142, weight: 10, title: "Family Link", instruction: "This flight provides an important connection between neighbouring communities. Plan the fuel carefully, monitor the arrival winds, and give the families aboard a smooth landing." },
        { imgId: 143, weight: 6, title: "Honeymoon Charter", instruction: "A newly married couple is beginning their private getaway. Use gentle turns, smooth power changes, and a soft landing to preserve the mood." },
        { imgId: 144, weight: 10,  title: "Medical Examiner", instruction: "A regional medical examiner has been called to a time-sensitive incident. Minimise the delay and complete the transfer as efficiently as conditions allow." },
        { imgId: 146, weight: 10, title: "New Owner Reposition", instruction: "The owner has requested delivery to the aircraft's new home base. Monitor the temperatures closely and use conservative settings while you learn the airframe." },
		{ imgId: 251, weight: 10, title: "Same-Day Transfer", instruction: "Two project managers need a same-day transfer for a critical meeting.", exactPax: 2 },
		{ imgId: 252, weight: 10, title: "Delayed Passenger Link", instruction: "Several passengers have missed their onward connection. Keep to the schedule and stay ahead of changing weather.", minPax: 2 },
		{ imgId: 253, weight: 10, title: "Engineer Callout", instruction: "A specialist engineering team is travelling to assess halted production equipment.", minPax: 2 },
		{ imgId: 254, weight: 10, title: "Sensitive Documents", instruction: "A legal adviser is carrying sensitive case material to an important consultation.", exactPax: 1 },
		{ imgId: 255, weight: 10, title: "Relief Crew Transfer", instruction: "A replacement technical crew must reach an aircraft awaiting maintenance support.", minPax: 2 },
		{ imgId: 256, weight: 10, title: "Night Crew", instruction: "An aircraft maintenance crew needs positioning for planned overnight work.", minPax: 2 },
		{ imgId: 257, weight: 10, title: "Clinic Team Hop", instruction: "A small clinic team is travelling to relieve colleagues after an extended shift.", minPax: 2 },
		{ imgId: 258, weight: 10, title: "Family Event Link", instruction: "A family group is using an air taxi after their original travel plan failed.", minPax: 4 }
    ],
    highAltServices: [
        { imgId: 147, weight: 10, title: "Weather Ops", instruction: "A science team is collecting meteorological data during this sortie. Hold the requested profiles accurately and record each observation point." },
        { imgId: 148, weight: 10, title: "Storm Chasers", instruction: "Atmospheric researchers need sensors deployed ahead of a major pressure change. Reach each release point on time and maintain a stable drop profile." }
    ],
    vintageOps: [
        { imgId: 149, weight: 10, title: "Airshow Display", instruction: "A historic aircraft demonstration is scheduled for today. Complete the fluid checks, present the aircraft on the ground, and fly the display within conservative limits." },
        { imgId: 150, weight: 10, title: "Handicap Race", instruction: "The aircraft is positioning for a closed-course handicap race. Keep the airframe clean, maintain accurate navigation, and arrive ready for the competition." },
        { imgId: 151, weight: 10, title: "Museum Ferry", instruction: "This ageing aircraft is being delivered to a museum for preservation. Use conservative power settings and treat every stage of the flight with care." },
        { imgId: 152, weight: 10, title: "Historic Chase Plane", instruction: "You are supporting a formation of historic aircraft as the designated chase plane. Maintain safe spacing, monitor the group, and watch your engine temperatures." },
        { imgId: 153, weight: 10, title: "Memorial Fly-by", instruction: "A commemorative low-level fly-by is scheduled. Verify the smoke system and oil levels, then fly the profile with precision and restraint." },
        { imgId: 154, weight: 10, title: "Keeping Current", instruction: "Use this sortie to maintain currency in a historic airframe. Practise the essential handling exercises and preserve the aircraft for its next public display." },
        { imgId: 155, weight: 10, title: "Last Flight", instruction: "This restored and irreplaceable aircraft is making its final flight to an aviation museum. Fly conservatively and give it the dignified arrival it deserves." },
        { imgId: 156, weight: 10, title: "Aviation Festival", instruction: "The aircraft must reach the festival staging area before the evening programme begins. Use conservative cruise power and protect the engine throughout the transit." },
        { imgId: 157, weight: 10, title: "Tribute Flight", instruction: "This memorial sortie honours the crews who once operated the aircraft. Maintain disciplined handling and keep every gauge comfortably within limits." }
    ],
    vintageProplinerFreight: [
        { imgId: 158, weight: 10, title: "Vintage Freight", instruction: "A traditional freight load is travelling aboard a classic aircraft. Synchronise the engines, manage the cowl flaps, and begin the descent well ahead of time." },
        { imgId: 159, weight: 10, title: "Livestock Freight", instruction: "Livestock is secured in the hold and comfort matters more than speed. Use shallow banks and finish the sector with a gentle landing." },
        { imgId: 160, weight: 10, title: "Heavy Duty", instruction: "Heavy goods are being moved in a vintage airframe. Monitor the engine temperatures and allow for slower, heavier control response throughout the flight." },
        { imgId: 161, weight: 10, title: "Palleted Freight", instruction: "Warehouse crews are completing the pallet load against a strict departure slot. Confirm the restraints and leave on time to protect the sorting window." }
    ],
    vintageAirliner: [
        { imgId: 162, weight: 10, title: "Silver Sleeper Service", instruction: "Most passengers will sleep through this premium overnight service. Keep the cabin quiet, the power changes gentle, and the descent especially smooth." },
        { imgId: 163, weight: 10, title: "Sunset Boulevard", instruction: "Holiday passengers are travelling cross-country in this classic airliner. Monitor the cylinder-head temperatures and manage the cowl flaps before the workload builds. sorted early." },
        { imgId: 164, weight: 10, title: "Executive Decision", instruction: "A full group of {industry} executives and engineers are heading to {dest_field}. Review the landing performance and keep the operation efficient and controlled" },
        { imgId: 165, weight: 10, title: "Matchday Fans", instruction: "Supporters are travelling to an important match aboard this classic aircraft. Check the carburettor heat and de-icing systems before entering the arrival phase." },
        { imgId: 166, weight: 10, title: "Golden Age Regional", instruction: "Operate this iconic regional passenger shuttle. Expect modest climb performance and avoid unnecessary strain on the engines." }
    ],
    helicopterMissions: [
        { imgId: 167, weight: 10, title: "Scenic Hop", instruction: "A local sightseeing flight is on the schedule. Use gentle banks, allow the passengers a clear view, and finish with a smooth landing." },
        { imgId: 168, weight: 10, title: "Photo Survey", instruction: "A survey photographer requires clean orbits over the assigned waypoints. Coordinate each pass and keep the aircraft stable throughout." },
        { imgId: 169, weight: 10, title: "Traffic Watch", instruction: "A spotter is monitoring traffic conditions along the main transport corridors. Hold the reporting points steadily and provide a clear platform for observation." },
        { imgId: 170, weight: 10, title: "On-Demand Charter", instruction: "A private client is using the aircraft to avoid surface congestion. Request direct routing where available and keep the transfer efficient." },
        { imgId: 171, weight: 10, title: "Roadside Extraction", instruction: "First responders have marked the landing zone and a patient is ready for extraction. Approach carefully, minimise the ground time, and depart as soon as the team is secure.", lowLevelOps: true },
        { imgId: 172, weight: 10, title: "Search And Rescue Ops", instruction: "A group of travellers is missing near their last known position. Fly systematic search patterns and remain prepared for a rescue or hoist operation.", lowLevelOps: true },
        { imgId: 173, weight: 10, title: "Aerial Overwatch", instruction: "Provide aerial overwatch for the ground units below. Maintain the assigned orbit, monitor the operating area, and report significant activity.", lowLevelOps: true },
        { imgId: 174, weight: 10, title: "Property Grid Survey", instruction: "A new property development requires an accurate aerial grid survey. Hold the planned lines precisely and maintain a stable sensor platform." },
        { imgId: 175, weight: 10, title: "Industrial Support", instruction: "Industrial equipment must be positioned accurately from the hover. Coordinate with the ground team and keep the load stable throughout the placement.", lowLevelOps: true },
        { imgId: 176, weight: 10, title: "Wildlife Tracking", instruction: "Biologists are locating tagged wildlife populations from the air. Maintain visual contact and hold the aircraft steady while the telemetry is recorded." },
        { imgId: 177, weight: 10, title: "Executive Shuttle", instruction: "An executive passenger requires a short transfer from the private terminal to a nearby helipad. Keep the service discreet, efficient, and smooth." },
        { imgId: 178, weight: 10, title: "Live Event Monitoring", instruction: "A civic event is being covered live from the air. Establish a stable observation position and remain clear of other operating traffic.", lowLevelOps: true },
        { imgId: 179, weight: 10, title: "Cinematic Tracking Shots", instruction: "A film crew needs dynamic aerial tracking shots for an action sequence. Coordinate closely with the director and repeat each profile with consistent timing.", lowLevelOps: true },
        { imgId: 180, weight: 5, title: "Pipe Lift", instruction: "A suspended pipe section must be moved using specialised rigging procedures. Maintain a stable hover and prevent rotation throughout the lift.", minCargo: 201, lowLevelOps: true },
        { imgId: 181, weight: 10, title: "Aerial Washing", instruction: "High-voltage lines are being cleaned with demineralised water while the network remains active. Hold the work position precisely and follow every safety clearance.", lowLevelOps: true },
        { imgId: 182, weight: 10, title: "Sensitive Documents", instruction: "Highly sensitive documents are travelling with a dedicated courier. Maintain strict discretion and follow the approved transfer procedure from departure to handover." },
        { imgId: 191, weight: 10, title: "Ground Team Insertion", instruction: "A specialist ground team is being inserted into the landing zone. Use a controlled approach, stabilise the hover, and minimise exposure during the offload.", heliOps: true, lowLevelOps: true },
        { imgId: 192, weight: 10, title: "Perimeter Watch", instruction: "Suspicious movement has been reported along the assigned corridor. Maintain the patrol track, log all contacts, and manage the fuel required for extended observation.", heliOps: true, lowLevelOps: true },
        { imgId: 193, weight: 10, title: "Dignitary Base Tour", instruction: "Visiting dignitaries require a clear aerial view of the facility from a safe distance. Use predictable banks and maintain a comfortable, stable ride." },
        { imgId: 194, weight: 10, title: "SAR Training Sortie", instruction: "Proceed to the training area for low-altitude search-and-rescue exercises. Locate the training beacons and complete the hover work within the briefed limits.", heliOps: true, lowLevelOps: true },
        { imgId: 195, weight: 10, title: "Outpost Resupply", instruction: "Field rations and replacement radio batteries are loaded for a remote outpost. Approach the landing zone carefully and remain alert for terrain-induced wind changes.", heliOps: true },
        { imgId: 196, weight: 10, title: "Command Briefing", instruction: "Regional commanders are travelling to a joint operational briefing. Maintain a secure, professional cabin and deliver them within the scheduled window." },
        { imgId: 183, weight: 2, title: "Unknown", instruction: "A recovery team has located an impossibly smooth, unusually heavy metal pillar. Transport the team carefully and expect the mission to raise more questions than it answers.", minCargo: 201, heliOps: true }
    ],
    'militaryTransit-MIL': [
        { imgId: 197, weight: 10, title: "Encrypted Telemetry Run", instruction: "Secure flight-data equipment from a defence contractor is on board. Maintain operational security, follow the filed routing, and keep all communications professional." },
        { imgId: 198, weight: 6, title: "Unmarked Container Run", instruction: "Unmarked secure containers are listed on a restricted manifest. Follow the approved flight plan and proceed directly to the designated destination handling area." },
        { imgId: 199, weight: 10, title: "Relocation Services", instruction: "Contracted defence personnel are relocating to a new base. Operate the sector as a standard military charter and deliver the passengers safely and on schedule." },
        { imgId: 200, weight: 10, title: "Base Hop", instruction: "Reposition the aircraft to a strategic staging airfield. Maintain a sterile cockpit and coordinate closely with military air traffic control for the arrival window." },
        { imgId: 201, weight: 10, title: "Peacetime Navigation Exercise", instruction: "This navigation exercise will be judged on fuel accuracy and waypoint timing. Fly the plan precisely and use the available refuelling option only if required." },
        { imgId: 202, weight: 10, title: "Tactical Escort", instruction: "Key defence personnel are travelling under remotely piloted escort. Maintain the assigned levels, follow the direct routing, and avoid unauthorised deviations." },
        { imgId: 203, weight: 10, title: "Diplomatic Priority", instruction: "Priority diplomatic communications are on board under controlled custody. Follow the filed route and preserve the chain of possession throughout the transfer." },
        { imgId: 204, weight: 2, title: "Project Cold Storage", instruction: "This flight does not appear on any schedule. Follow the sealed instructions, avoid unnecessary radio traffic, and leave the cargo compartment undisturbed. Ignore any strange noises coming from the hold." },
        { imgId: 205, weight: 10, title: "High-Speed SAR Support", instruction: "Provide rapid search-and-rescue support along the assigned route. Scan for distress signals, report accurate coordinates, and maintain the search profile." },
        { imgId: 206, weight: 10, title: "Surface Anomaly Patrol", instruction: "Patrol the assigned corridor for unusual surface activity. Maintain visual observation and report any unregistered traffic to sector command." },
        { imgId: 207, weight: 10, title: "UHF Relay Station", instruction: "Provide an airborne UHF and VHF relay for ground exercises. Hold the assigned station, monitor fuel closely, and maintain suitable oxygen margins." }
    ],
    'tacticalJet-MIL': [
        { imgId: 208, weight: 10, title: "Passive Telemetry Run", instruction: "Passive telemetry equipment is collecting regional signal data. Fly the filed route precisely so the onboard systems can triangulate each source accurately." },
        { imgId: 209, weight: 10, title: "Ground Radar Profile", instruction: "Ground-based warning systems require a clean calibration target. Hold the assigned altitude and airspeed precisely while the stations record the radar return." },
        { imgId: 210, weight: 10, title: "Radar Intercept", instruction: "Unidentified radar contacts have been detected along the route. Maintain intercept speed, follow the vectors, and be prepared for an unconventional identification." },
        { imgId: 211, weight: 10, title: "Cross Service Exercise", instruction: "This joint-service navigation exercise requires a timed rendezvous with allied aircraft. Match the assigned profile and arrive at the coordination point precisely." },
        { imgId: 212, weight: 10, title: "Sensor Integrity Check", instruction: "Ground stations require a stable aircraft for sensor and telemetry validation. Minimise vibration and maintain a clean, repeatable flight profile." },
        { imgId: 213, weight: 10, title: "Approach Vector Check", instruction: "Primary approach vectors require revalidation. Fly the non-precision procedures accurately, verify the navigation aids, and record any discrepancy" },
        { imgId: 214, weight: 10, title: "Off-Cycle Ferry", instruction: "The aircraft is being ferried for unscheduled maintenance. Monitor the engine temperatures closely and use conservative power settings throughout the transit." },
        { imgId: 215, weight: 10, title: "Two-Ship Formation", instruction: "Complete a two-ship proficiency transit within the briefed formation limits. Maintain disciplined spacing and leave the dramatic manoeuvres to the cinema." },
        { imgId: 216, weight: 10, title: "Handling Check", instruction: "Complete the assigned handling and proficiency exercises. Build the manoeuvres progressively, monitor the G-loading, and remain within the aircraft's limits." },
        { imgId: 217, weight: 10, title: "Terrain Masking Run", instruction: "Fly the designated low-level terrain-masking corridor. Hold the briefed height, maintain a sharp lookout, and remain vigilant for wildlife and obstacles." },
        { imgId: 218, weight: 10, title: "Red Air Exercise", instruction: "Act as the opposing force during this training exercise. Follow the intercept vectors, test the friendly response, log the contacts, and continue to destination." },
        { imgId: 219, weight: 10, title: "Airshow Arrival", instruction: "The aircraft must arrive early for an airshow appearance. Expect mixed traffic near the venue and maintain a careful lookout during the arrival." },
        { imgId: 220, weight: 10, title: "Refuelling Practice", instruction: "Complete the planned aerial-refuelling approach exercise. Hold the briefed altitude and airspeed, stabilise before contact, and protect the refuelling equipment." }
    ],
    'reconnaissance-MIL': [
        { imgId: 221, weight: 10, title: "Transit Recon Sortie", missionType: 32, instruction: "Fly the assigned reconnaissance corridor from departure to destination. Maintain the planned altitude and airspeed so the sensors capture continuous imagery." },
        { imgId: 222, weight: 10, title: "Transit Corridor Map", missionType: 32, instruction: "Map the assigned transit corridor using the onboard survey systems. Hold a steady track and altitude so the equipment can build a clean dataset." },
        { imgId: 223, weight: 10, title: "Eye In The Sky", missionType: 32, instruction: "Photograph the designated areas along the route. Cross each waypoint accurately and avoid deviations that could leave gaps in the imagery." },
        { imgId: 249, weight: 10, title: "Formation Transit", missionType: 32, instruction: "Complete a two-ship formation transit from departure to destination. Maintain the assigned spacing through the climb, cruise, and arrival." },
        { imgId: 250, weight: 10, title: "Refuelling Practice", missionType: 32, instruction: "Complete the planned aerial-refuelling approach exercise. Hold the briefed altitude and airspeed, stabilise before contact, and protect the refuelling equipment." }
    ],
    gliderOps: [
        { imgId: 224, weight: 10, title: "Thermal Cross Country", instruction: "Launch from {dep_field} and work the available lift toward {dest_field}. Select strong, organised thermals and avoid weak or decaying cloud formations." },
        { imgId: 225, weight: 10, title: "Practice Makes Perfect", instruction: "Remain within gliding distance of {dep_field} while practising thermal entry, coordinated turns, and lookout. Return early if the conditions begin to deteriorate." },
        { imgId: 226, weight: 10, title: "Lift Me Up", instruction: "Use rising air to build height between {dep_field} and {dest_field}. Work each thermal efficiently, avoid lee-side turbulence, and maintain suitable landing options." },
        { imgId: 227, weight: 10, title: "Student Training Flight", instruction: "A student is departing from {dep_field} for handling and lookout practice. Explain how you read the sky and involve them in every decision." },
        { imgId: 228, weight: 10, title: "Powered Glider Ferry", instruction: "The club needs this powered glider repositioned from {dep_field} to {dest_field}. Use the engine to establish safe options, then soar whenever conditions permit." },
        { imgId: 229, weight: 10, title: "Contest Practice", instruction: "Fly a practice speed task from {dep_field} to {dest_field}. Manage the working height, anticipate weak areas, and use organised lift to maintain progress." }
    ]
};

// Per-scenario routing/eligibility flags — authoritative source is mission-scenario-flags-data.js
// (generated by the mission editor's Scenario Flags panel). Applies onto scenarioDB by imgId.
// isMilitary: excludes a scenario from civilian aircraft unless "Use Military Airbases" is on.
// civilOk: on an isMilitary scenario, additionally clears it for civilian aircraft when
// "Use Military Airbases" is on (isMilitary alone still blocks them otherwise).
// requiresPax: requires at least one passenger and excludes aircraft with no passenger seats.
function applyScenarioFlags(embed) {
    if (!embed || typeof scenarioDB === "undefined") return;
    const localSet = new Set(Array.isArray(embed.localImgIds) ? embed.localImgIds : []);
    const militarySet = new Set(Array.isArray(embed.militaryImgIds) ? embed.militaryImgIds : []);
    const civilOkSet = new Set(Array.isArray(embed.civilOkImgIds) ? embed.civilOkImgIds : []);
    const requiresPaxSet = new Set(Array.isArray(embed.requiresPaxImgIds) ? embed.requiresPaxImgIds : []);
    Object.keys(scenarioDB).forEach(poolKey => {
        scenarioDB[poolKey].forEach(s => {
            if (localSet.has(s.imgId)) s.isLocal = true;
            if (militarySet.has(s.imgId)) s.isMilitary = true;
            if (civilOkSet.has(s.imgId)) s.civilOk = true;
            if (requiresPaxSet.has(s.imgId)) s.requiresPax = true;
        });
    });
}

const names = ["Tom Cruise", "Dwayne Johnson", "Leonardo DiCaprio", "Scarlett Johansson", "Margot Robbie", "Zendaya", "Tom Holland", "Robert Downey Jr.", "Brad Pitt", "Angelina Jolie", "Will Smith", "Pedro Pascal", "Timothée Chalamet", "Florence Pugh", "Ryan Reynolds", "Hugh Jackman", "Chris Hemsworth", "Keanu Reeves", "Meryl Streep", "Jackie Chan"];
const athletes = ["Cristiano Ronaldo", "Lionel Messi", "LeBron James", "Stephen Curry", "Simone Biles", "Tiger Woods", "Lewis Hamilton", "Patrick Mahomes", "Shohei Ohtani", "Caitlin Clark", "Novak Djokovic", "Rafael Nadal", "Usain Bolt", "Kylian Mbappé", "Virat Kohli", "Serena Williams", "Michael Phelps", "Kevin Durant", "Carlos Alcaraz", "Katie Ledecky"];
const teams = ["Real Madrid", "Barcelona", "Manchester United", "Bayern Munich", "Paris Saint-Germain", "Los Angeles Lakers", "Golden State Warriors", "Boston Celtics", "New York Yankees", "Los Angeles Dodgers", "Kansas City Chiefs", "Dallas Cowboys", "San Francisco 49ers", "Ferrari", "Mercedes F1 Team", "Mumbai Indians", "All Blacks", "Toronto Maple Leafs"];
const musician = ["Taylor Swift", "Beyoncé", "Drake", "The Weeknd", "Billie Eilish", "Bad Bunny", "Ed Sheeran", "Adele", "Justin Bieber", "Bruno Mars", "Dua Lipa", "Rihanna", "Lady Gaga", "Chris Martin", "Eminem", "Harry Styles", "Olivia Rodrigo", "Post Malone", "Kendrick Lamar", "BTS"];
const medCargo = ["specialized surgical tools", "temperature-sensitive donor organs", "blood plasma reserves", "rare antivenom vials", "experimental vaccine cultures"];
const industry = ["Tech", "Energy", "Finance", "Pharmaceutical", "Real Estate", "Automotive", "Aerospace", "Telecommunications"];
const vipType = ["global diplomat", "tech billionaire", "renowned film director", "royal family member", "high-profile whistleblower", "media tycoon"];
const sciFi = ["geometric anomaly", "unexplained localized magnetic distortion", "perfectly circular crop depression", "unidentified pulsating light source", "rapidly expanding sinkhole"];
const cargoType = ["lithium-ion batteries", "bell nipples", "server racks", "drill bits", "stage rigging parts", "humanitarian rations"];

if (typeof globalThis !== "undefined") {
    globalThis.missionMatrix = missionMatrix;
    globalThis.scenarioDB = scenarioDB;
}

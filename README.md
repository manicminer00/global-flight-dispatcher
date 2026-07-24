<img src="images/header.png" alt="VECTOR — FLIGHT DISPATCH" width="1376">

## Quick start

1. Open **[VECTOR](https://manicminer00.github.io/global-flight-dispatcher/)** in your browser.
2. Select your favourite aircraft and click **GENERATE FLIGHT**.
3. Choose a job and then dispatch via SimBrief or download an MSFS **.pln**.

## Why VECTOR?
Every flight simmer knows the problem. You have a hangar full of aircraft you love, a hard drive full of scenery you paid for, and no particular reason to fly any of it tonight. You end up doing the same familiar hop, or spending twenty minutes browsing charts instead of flying.

VECTOR fixes that. Enter your callsign, pick an aircraft from a fleet of over a hundred supported add-ons, choose how long you want to fly, and press **Generate Flight**. Seconds later you are looking at three job tickets: real routes between real MSFS 2024 airports, each with a mission attached. A charter with a nervous client. A freight run that should have left an hour ago. A medevac, a survey, a military sortie, a quiet evening in a glider.

The details are done for you. The route suits your aircraft's range and runway needs. The passenger and cargo load is checked against what the airframe can actually lift. A sensible cruise altitude is picked, terrain considered. If you own third-party scenery, VECTOR can favour the airports you have bought. Accept a ticket and you can send the whole plan to SimBrief with one click, or download a flight plan file that loads straight into the simulator.

Fly it, log it, and your next departure can pick up where you landed, building a career one leg at a time. Everything stays on your machine: no account, no install, no telemetry. Just a dispatcher who always has work for you.


## Under the Hood

**Airport pairing.** VECTOR uses a hand-made database of over two thousand MSFS 2024 airports. Each airport is tagged with its runway length and what class of aircraft it can handle, from grass-strip GA fields up to full international airports. When you generate a flight, VECTOR filters the list to fields your specific aircraft is rated for and within its range, then picks an origin and destination. Airports carry real-world restrictions (for example, certain fields only permit specific approved aircraft types), and those are enforced too.

**The aircraft data.** VECTOR reads aircraft data from another hand-made database with over 100 popular MSFS 2024 aircraft, each with maximum takeoff weight (MTOW), maximum landing weight (MLW), empty weight, maximum zero-fuel weight, typical fuel burn per nautical mile, seating and cargo capacity, and minimum runway requirement. This is the same kind of data sheet a real dispatcher would use before planning a flight.

**The loading and weight check.** Once a route and aircraft are chosen, VECTOR works out how many passengers and how much cargo the flight can realistically carry, then checks that the resulting takeoff weight stays under MTOW and the landing weight stays under MLW, accounting for the fuel that will be burned off along the way. Where the runway is on the short side for a heavier jet, VECTOR reduces the effective operating weight to reflect real-world runway-limited takeoff performance, rather than allowing an unrealistic full-weight departure from too short a field.

**The fuel and cruise planning.** VECTOR estimates trip fuel from the aircraft's fuel burn rate and distance, adds reserve and taxi allowances, and picks a cruise altitude that respects the aircraft's operating ceiling and flight regulations, and, on routes near high terrain, applies a safety floor above the ground and any known mountain ranges along the way. That altitude, along with your chosen route, passengers, and cargo, is passed into a ready-made SimBrief flight plan link and a downloadable `.pln` file, so the numbers you see on the job ticket are the numbers your flight plan will actually use.

**The missions.** Underneath the route and numbers sits a scenario system of 230 job types (airline hops, charters, cargo runs, medical relays, military sorties, survey work, and more), each restricted to the aircraft classes and payload levels that make sense for it. Every aircraft in the fleet has its own assigned pool of missions it can be offered, so a Cessna won't turn up flying a state delegation and a widebody won't turn up on a bush cargo drop.

**The logbook.** Flights you fly and save are kept in a running logbook with their payout, so you can track completed jobs and earnings over time.

None of this replaces SimBrief, a real weight and balance sheet, or your own judgment before departure. VECTOR's job is to hand you a realistic, weight-checked, range-checked starting point, not to be your only reference in the cockpit. Fly safe and have fun.


---

*© 2026 Toby Rayfield - Disclaimer: For flight simulation use only. Do not use for real-world aviation or dispatch. Third-party names and links belong to their respective owners.*

<a href="https://www.buymeacoffee.com/manicminer" target="_blank" rel="noopener noreferrer" class="footer-bmc">
<img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" style="height: 48px !important;width: 174px !important;">
</a>

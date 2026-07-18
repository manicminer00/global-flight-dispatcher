# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"D:\CURSOR WORKSPACE\VECTOR DEVELOPMENT v3.0\index.html")
text = path.read_text(encoding="utf-8")
start = text.index('<div class="app-shell">')
marker = '<div id="logbookPanel" class="settings-panel settings-group board-logbook">'
end = text.index(marker)

art_start = text.index('<div class="contracts-ticket-grid" id="contractsTicketGrid">')
art_end = text.index('</div>\n</div>\n<div class="panel-btn-row">')
tickets = text[art_start:art_end]
inner_start = tickets.index("<article")
tickets_inner = tickets[inner_start:]

new_html = '''<div class="app-shell">
<aside class="board-sidebar" aria-label="VECTOR dispatch controls">
    <div class="board-sidebar-top">
        <p class="board-nav-brand">VECTOR</p>
        <p class="board-sidebar-sub">Flight Dispatch</p>
    </div>
    <div class="board-sidebar-scroll">
        <div class="dispatch-control-group board-sidebar-form">
            <div class="dispatch-form-field">
                <label for="callsignInput">ATC Callsign:
                    <span class="field-hint">
                        <a class="link-inline" onclick="event.preventDefault(); saveCallsign();">Save Callsign</a>
                        <span class="field-hint-sep">/</span>
                        <a class="link-inline" href="https://123atc.com/call-signs" target="_blank" rel="noopener noreferrer">Lookup Callsign</a>
                        <span class="field-hint-sep">/</span>
                        <a class="link-inline" onclick="event.preventDefault(); generateRandomCallsign();">Generate Callsign</a>
                    </span>
                </label>
                <input type="text" id="callsignInput" placeholder="e.g. MRD275" maxlength="7" required>
            </div>
            <div class="dispatch-form-field">
                <label for="aircraftInput" class="flex-label">Aircraft Type:</label>
                <div class="input-relative-wrap">
                    <input type="text" id="aircraftInput" placeholder="Search by name or ICAO code" autocomplete="off">
                    <div id="customAircraftList" class="custom-datalist"></div>
                </div>
            </div>
            <div class="dispatch-form-field">
                <label for="depOverrideInput" class="field-title">Departure Airport:</label>
                <div class="dep-field-wrap">
                    <input type="text" id="depOverrideInput" placeholder="Airport Name or ICAO (Optional)" autocomplete="off">
                    <div id="customAirportList" class="custom-datalist"></div>
                </div>
            </div>
            <div class="dispatch-form-field">
                <label for="routingScopeSelect" class="field-title"><span>Routing Options:</span>
                    <span class="field-hint">🧭 <a class="link-inline" href="https://www.google.com/maps/d/edit?mid=1m27z2BIBRWRM3MgD9UExPAOqxxRmntE&usp=sharing" target="_blank" rel="noopener noreferrer">Map of Airports in Database</a></span>
                </label>
                <select id="routingScopeSelect">
                    <option value="worldwide">🌐 Worldwide</option>
                    <option value="americas">Americas Only</option>
                    <option value="row">Europe &amp; Rest of World</option>
                </select>
                <script>
                (function () {
                    var valid = { worldwide: true, americas: true, row: true };
                    try {
                        var saved = localStorage.getItem("dispatcher_routing_scope");
                        var sel = document.getElementById("routingScopeSelect");
                        if (saved && valid[saved] && sel) sel.value = saved;
                    } catch (e) {}
                })();
                </script>
            </div>
            <div class="dispatch-form-field board-sidebar-checks">
                <label class="checkbox-option" for="useLastArrivalToggle">
                    <input type="checkbox" id="useLastArrivalToggle" onchange="toggleLastArrival()"><strong>Continue from last airport?</strong></label>
                <label class="checkbox-option" for="contractorToggle">
                    <input type="checkbox" id="contractorToggle" onchange="syncContractorMilitaryOptions()">Contractor Mode (civilian aircraft fly military missions)</label>
                <label class="checkbox-option" for="militaryBaseToggle">
                    <input type="checkbox" id="militaryBaseToggle">Use Military airbases</label>
            </div>
            <details id="gliderAircraftNotice" class="info-details" style="display: none;">
                <summary>Glider Aircraft Notice</summary>
                <div class="info-details-body">
                    A glider can dispatch from any departure airport with sufficient runway length (not a helipad) if you enter an ICAO. If the departure airport is left blank, the dispatcher considers all suitable airports but strongly prefers routes from and to glider strips.
                </div>
            </details>
            <div class="slider-section board-sidebar-slider">
                <label for="timeSlider" class="slider-header-row" id="timeSliderHeading">
                    Target Block Time: <span id="timeVal">60</span> <span id="timeUnit">minutes</span>
                </label>
                <div id="longHaulNote" class="slider-long-haul-note" role="note" style="display: none;">⏳ <strong>Long-haul</strong>: Select <strong>Transatlantic</strong>, <strong>Pacific</strong>, or <strong>Ultra</strong> and VECTOR will find iconic hub routes from the curated MSFS airport list. Select a custom departure to fly from a specific airport.</div>
                <input type="range" id="timeSlider" min="40" max="120" step="10" value="60" list="steplist" oninput="updateFlightTimeDisplay()" style="width: 100%; cursor: pointer;">
                <div id="longHaulTierTicks" class="long-haul-tier-ticks" style="display: none;" aria-hidden="true">
                    <span class="long-haul-tier-tick" data-tier-mins="480">Transatlantic</span>
                    <span class="long-haul-tier-tick" data-tier-mins="720">Pacific</span>
                    <span class="long-haul-tier-tick" data-tier-mins="960">Ultra</span>
                </div>
                <div id="longHaulTierFeasibilityNote" class="long-haul-tier-feasibility-note" style="display: none;" role="note"></div>
                <datalist id="steplist">
                    <option value="40"></option><option value="50"></option><option value="60"></option><option value="70"></option>
                    <option value="80"></option><option value="90"></option><option value="100"></option><option value="110"></option><option value="120"></option>
                </datalist>
                <datalist id="longHaulSteplist">
                    <option value="480"></option><option value="720"></option><option value="960"></option>
                </datalist>
                <div class="slider-footer-row board-sidebar-slider-footer">
                    <details class="info-details long-haul-notam">
                        <summary>Long-haul NOTAM</summary>
                        <div class="info-details-body">
                            VECTOR was initially conceived from a desire to create flightplans to and from the MSFS 2024 payware airports that I own in one click. No other software provides this functionality, that I know of. This grew rapidly into a feature-rich flight dispatch tool, implementing a curated Asobo and Third Party airport database, over 100 aircraft, a mission generator, military missions and airports, gliding missions and gliderports, the option to add custom airports and aircraft, the implementation of an editable logbook, as well as incorporating wishes from the community, and quickly growing beyond what I had initially envisioned. While community feedback has helped improve VECTOR, and for that I am very grateful, VECTOR was always designed to compliment SimBrief, never to replace it, and there are many good alternatives available for long-haul flight planning, such as APLv2, which I encourage you to explore if you enjoy flying long-haul sectors. VECTOR is designed for people who want to fly short-haul without time compression. Thank you for your understanding and for your support.
                        </div>
                    </details>
                    <span class="note-text slider-rotor-glider-note">(N.B. Helicopter and Glider missions are unaffected by this slider.)</span>
                </div>
            </div>
            <button id="generateFlightBtn" type="button" onclick="dispatchFlight()">GENERATE FLIGHT</button>
        </div>
    </div>
    <div class="board-sidebar-footer">
        <button type="button" class="board-nav-btn" data-nav="logbook" onclick="boardNavGo('logbook')">Logbook</button>
        <button type="button" class="board-nav-btn" data-nav="settings" onclick="boardNavGo('settings')">Settings</button>
    </div>
</aside>
<div class="board-main">
<div class="container">
<div id="contractsBoardPanel" class="contracts-board-panel" aria-label="Available contracts">
    <div class="contracts-board-header">
        <h3>Available Contracts</h3>
        <span class="note-text">Pick one ticket · Generate refreshes all three</span>
    </div>
    <p class="contracts-board-note" id="contractsBoardNote">Set aircraft and options in the left menu, then GENERATE FLIGHT for three job tickets.</p>
    <div class="contracts-ticket-grid" id="contractsTicketGrid">
''' + tickets_inner + '''
    </div>
</div>

'''

path.write_text(text[:start] + new_html + text[end:], encoding="utf-8")
print("OK rebuilt layout")

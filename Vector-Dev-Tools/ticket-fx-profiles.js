(function () {
    "use strict";
    var MODES = ["crt-standard", "crt-military", "crt-vintage", "crt-business", "crt-commercial", "crt-regional", "crt-starship", "crt-helicopter"];
    var labels = { "crt-standard":"Standard CRT", "crt-military":"Military Green", "crt-vintage":"Vintage / Sepia", "crt-business":"Business Jet LED", "crt-commercial":"Commercial MCDU", "crt-regional":"Regional Blue MCDU", "crt-starship":"Starship Collins", "crt-helicopter":"Helicopter Avionics ’90s" };
    function $(id) { return document.getElementById(id); }
    function clean(value) { return MODES.indexOf(value) >= 0 ? value : ""; }
    function clone(value) { return JSON.parse(JSON.stringify(value || {})); }
    function emptyProfiles() { return { groupDefaults:{}, aircraftOverrides:{}, matrixMissionRules:{} }; }
    function normalise(value) { var p = value || {}; return { groupDefaults:p.groupDefaults || {}, aircraftOverrides:p.aircraftOverrides || {}, matrixMissionRules:p.matrixMissionRules || {} }; }
    var profiles = emptyProfiles();
    function load() { profiles = normalise(clone((window.VECTOR_DEFAULT_SETTINGS || {}).ticketFx)); }
    async function save() {
        try {
            var response = await fetch("/api/ticket-fx-settings", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ ticketFx:profiles }) });
            if (!response.ok) throw new Error();
        } catch (error) {
            throw new Error("settings.js could not be saved. Start this page with start-ticket-fx-profiles.bat.");
        }
    }
    async function saveAndRender(render) { try { await save(); render(); $("status").textContent = "Saved to settings.js"; } catch (error) { $("status").textContent = error.message; } }
    function options(value, inherited) { return '<option value="">' + inherited + '</option>' + MODES.map(function (fx) { return '<option value="' + fx + '"' + (value === fx ? " selected" : "") + '>' + labels[fx] + '</option>'; }).join(""); }
    function fleet() { return Object.assign({}, typeof coreFleetSpecs === "undefined" ? {} : coreFleetSpecs); }
    function renderGroups() { var groups = Array.from(new Set(Object.keys(fleet()).map(function (id) { return String(fleet()[id].class || "OTHER").toUpperCase(); }))).sort(); $("groups").innerHTML = groups.map(function (group) { return '<div class="row"><div><strong>' + group + '</strong><small>Category default</small></div><select data-group="' + group + '">' + options(clean(profiles.groupDefaults[group]), "Unassigned") + '</select><small>Assign a profile to every category.</small></div>'; }).join(""); $("groups").querySelectorAll("select").forEach(function (select) { select.onchange = function () { var value = clean(select.value); if (value) profiles.groupDefaults[select.dataset.group] = value; else delete profiles.groupDefaults[select.dataset.group]; saveAndRender(renderAircraft); }; }); }
    function resolve(spec, type) { var explicit = clean(profiles.aircraftOverrides[type]) || clean(spec.ticketFx); if (explicit) return "Override: " + labels[explicit]; var group = clean(profiles.groupDefaults[String(spec.class || "OTHER").toUpperCase()]); return group ? "Inherited: " + labels[group] + " category" : "Unassigned"; }
    function renderAircraft() { var term = $("search").value.trim().toLowerCase(); var rows = Object.keys(fleet()).map(function (type) { return [type, fleet()[type]]; }).filter(function (entry) { return (entry[0] + " " + entry[1].name + " " + entry[1].class).toLowerCase().indexOf(term) >= 0; }).sort(function (a,b) { return a[1].name.localeCompare(b[1].name); }); $("aircraft").innerHTML = rows.map(function (entry) { var type = entry[0], spec = entry[1], value = clean(profiles.aircraftOverrides[type]); return '<div class="row"><div><strong>' + type + ' — ' + spec.name + '</strong><small>' + (spec.class || "OTHER") + '</small></div><select data-aircraft="' + type + '">' + options(value, "Inherit") + '</select><small>' + resolve(spec, type) + '</small></div>'; }).join(""); $("aircraft").querySelectorAll("select").forEach(function (select) { select.onchange = function () { var value = clean(select.value), type = select.dataset.aircraft; if (value) profiles.aircraftOverrides[type] = value; else delete profiles.aircraftOverrides[type]; saveAndRender(renderAircraft); }; }); $("status").textContent = rows.length + " aircraft"; }
    function escapeHtml(value) { var d = document.createElement("div"); d.textContent = value || ""; return d.innerHTML; }
    function matrixRule(id) { return profiles.matrixMissionRules[String(id)] || null; }
    function matrixScenarios() { var rows = []; if (typeof scenarioDB === "undefined") return rows; Object.keys(scenarioDB).forEach(function (pool) { (scenarioDB[pool] || []).forEach(function (scenario) { if (scenario && scenario.imgId != null) rows.push({ id:scenario.imgId, pool:pool, title:scenario.payload || scenario.instruction || "Untitled mission" }); }); }); return rows.sort(function (a,b) { return a.id - b.id; }); }
    function renderMatrixRules() { var search = $("matrixSearch").value.trim().toLowerCase(); var rows = matrixScenarios().filter(function (row) { return (row.id + " " + row.pool + " " + row.title).toLowerCase().indexOf(search) >= 0; }); $("matrixRules").innerHTML = rows.map(function (row) { var rule = matrixRule(row.id), enabled = !!(rule && rule.enabled); return '<div class="row matrix-rule"><div class="matrix-mission"><img class="matrix-thumb" src="../images-missions/mission' + row.id + '.jpg" alt="Mission ' + row.id + ' thumbnail" onerror="this.style.display=\'none\'"><div><strong>' + row.id + ' — ' + escapeHtml(row.title) + '</strong><small>' + escapeHtml(row.pool) + (enabled ? ' · ' + escapeHtml(rule.variant || "alien") : '') + '</small></div></div><label class="matrix-toggle"><input type="checkbox" data-matrix-id="' + row.id + '"' + (enabled ? ' checked' : '') + '> Matrix</label><small>' + (enabled ? 'Matrix enabled' : 'Standard mission FX') + '</small></div>'; }).join(""); $("matrixRules").querySelectorAll("[data-matrix-id]").forEach(function (input) { input.onchange = function () { var key = input.dataset.matrixId, existing = profiles.matrixMissionRules[key]; if (input.checked) profiles.matrixMissionRules[key] = { enabled:true, variant:(existing && existing.variant) || "alien" }; else delete profiles.matrixMissionRules[key]; saveAndRender(renderMatrixRules); }; }); $("matrixStatus").textContent = rows.length + " missions"; }
    $("search").oninput = renderAircraft;
    $("matrixSearch").oninput = renderMatrixRules;
    $("reload").onclick = function () { window.location.reload(); };
    load(); renderGroups(); renderAircraft(); renderMatrixRules();
}());

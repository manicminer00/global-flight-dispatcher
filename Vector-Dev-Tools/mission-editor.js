(function () {
    "use strict";

    var baselineAssignments = {};
    var workingAssignments = {};
    var poolMetadata = {};
    var selectedAircraft = null;
    var selectedSidebar = new Set();
    var lastClickedAircraft = null;
    var expandedPools = new Set();
    var draftSaveTimer = null;
    var DRAFT_STORAGE_KEY = "vector_mission_editor_draft";
    var draftSavedAt = null;
    var searchFilterTypes = new Set();
    var baselineLoadedOk = false;
    var COPY_REVIEW_STORAGE_KEY = "vector_mission_copy_review_draft";
    var copyReviewDraft = {};
    var copyReviewPage = 0;

    function $(id) { return document.getElementById(id); }

    function stripDeveloperPrefix(name) {
        if (!name) return "";
        var idx = name.indexOf(" - ");
        if (idx >= 0) return name.slice(idx + 3).trim();
        return name.trim();
    }

    function abbreviateAircraftName(name, maxLen) {
        maxLen = maxLen || 30;
        var short = stripDeveloperPrefix(name);
        if (short.length <= maxLen) return short;
        return short.slice(0, maxLen - 1) + "\u2026";
    }

    function formatAircraftListLabel(type) {
        var spec = coreFleetSpecs[type];
        if (!spec) return type;
        return abbreviateAircraftName(spec.name, 38);
    }

    function formatAircraftBulkTag(type) {
        return type + " (" + abbreviateAircraftName(coreFleetSpecs[type].name, 22) + ")";
    }

    function getMissionImageUrl(imgId) {
        return "../images-missions/mission" + imgId + ".jpg";
    }

    function setStatus(msg) {
        $("statusBar").textContent = msg;
    }

    function loadCopyReviewDraft() {
        try { copyReviewDraft = JSON.parse(localStorage.getItem(COPY_REVIEW_STORAGE_KEY) || "{}") || {}; }
        catch (e) { copyReviewDraft = {}; }
    }

    function saveCopyReviewDraft() {
        try { localStorage.setItem(COPY_REVIEW_STORAGE_KEY, JSON.stringify(copyReviewDraft)); }
        catch (e) { setStatus("Could not save copy-review notes in this browser."); }
    }

    function collectCopyReviewScenarios() {
        var seen = new Set();
        return Object.keys(scenarioDB).reduce(function (all, poolKey) {
            (scenarioDB[poolKey] || []).forEach(function (scenario) {
                if (seen.has(scenario.imgId)) return;
                seen.add(scenario.imgId);
                all.push({
                    imgId: scenario.imgId,
                    poolKey: poolKey,
                    poolLabel: poolMetadata[poolKey] ? poolMetadata[poolKey].label : poolKey,
                    title: scenario.title || "",
                    instruction: scenario.instruction || ""
                });
            });
            return all;
        }, []).sort(function (a, b) { return a.imgId - b.imgId; });
    }

    function populateCopyReviewCategories() {
        var select = $("copyReviewCategory");
        if (!select || select.options.length) return;
        var scenarios = collectCopyReviewScenarios();
        var pools = {};
        scenarios.forEach(function (scenario) { pools[scenario.poolKey] = scenario.poolLabel; });
        select.appendChild(new Option("All categories", ""));
        Object.keys(pools).sort(function (a, b) { return pools[a].localeCompare(pools[b]); }).forEach(function (poolKey) {
            select.appendChild(new Option(pools[poolKey], poolKey));
        });
    }

    function copyReviewEntry(imgId, scenario) {
        if (!copyReviewDraft[imgId]) {
            copyReviewDraft[imgId] = { title: scenario.title, instruction: scenario.instruction, comments: "", status: "" };
        }
        return copyReviewDraft[imgId];
    }

    function setCopyReviewStatus(imgId, status) {
        copyReviewDraft[imgId].status = copyReviewDraft[imgId].status === status ? "" : status;
        saveCopyReviewDraft();
        renderCopyReview();
    }

    function renderCopyReview() {
        var body = $("copyReviewBody");
        var category = $("copyReviewCategory").value;
        var batchSize = Number($("copyReviewBatchSize").value);
        var scenarios = collectCopyReviewScenarios().filter(function (scenario) { return !category || scenario.poolKey === category; });
        var maxPage = Math.max(0, Math.ceil(scenarios.length / batchSize) - 1);
        copyReviewPage = Math.min(copyReviewPage, maxPage);
        var batch = scenarios.slice(copyReviewPage * batchSize, (copyReviewPage + 1) * batchSize);
        body.innerHTML = "";
        var note = document.createElement("p");
        note.className = "copy-review-note";
        note.textContent = "Batch " + (copyReviewPage + 1) + " of " + (maxPage + 1) + " · Edit the proposed fields, add notes, then export a JSON review file. Nothing here changes mission copy.";
        body.appendChild(note);
        batch.forEach(function (scenario) {
            var entry = copyReviewEntry(scenario.imgId, scenario);
            var row = document.createElement("article");
            row.className = "copy-review-row";
            var imageColumn = document.createElement("div");
            var image = document.createElement("img");
            image.className = "copy-review-image";
            image.src = getMissionImageUrl(scenario.imgId);
            image.alt = "Mission " + scenario.imgId;
            imageColumn.appendChild(image);
            imageColumn.insertAdjacentHTML("beforeend", '<p class="copy-review-id">ImgId ' + scenario.imgId + '</p><p class="copy-review-pool">' + scenario.poolLabel + '</p>');
            row.appendChild(imageColumn);
            var current = document.createElement("section");
            current.className = "copy-review-column";
            current.innerHTML = '<h3>Current copy</h3><div class="copy-review-current"><strong></strong><span></span></div>';
            current.querySelector("strong").textContent = scenario.title || "Untitled";
            current.querySelector("span").textContent = scenario.instruction || "No CRT brief";
            row.appendChild(current);
            var proposed = document.createElement("section");
            proposed.className = "copy-review-column";
            proposed.innerHTML = '<h3>Proposed copy</h3><textarea class="copy-review-title-input" aria-label="Proposed title"></textarea><textarea aria-label="Proposed CRT brief"></textarea>';
            var titleInput = proposed.querySelectorAll("textarea")[0];
            var instructionInput = proposed.querySelectorAll("textarea")[1];
            titleInput.value = entry.title;
            instructionInput.value = entry.instruction;
            titleInput.addEventListener("input", function () { entry.title = titleInput.value; saveCopyReviewDraft(); });
            instructionInput.addEventListener("input", function () { entry.instruction = instructionInput.value; saveCopyReviewDraft(); });
            row.appendChild(proposed);
            var comments = document.createElement("section");
            comments.className = "copy-review-column";
            comments.innerHTML = '<h3>Your edits / comments</h3><div class="copy-review-status"><button type="button">Approve</button><button type="button">Revise</button><button type="button">Skip</button></div><textarea aria-label="Your edits or comments" placeholder="Add your notes here…"></textarea>';
            var statuses = [["Approve", "approved"], ["Revise", "revise"], ["Skip", "skip"]];
            comments.querySelectorAll("button").forEach(function (button, index) {
                if (entry.status === statuses[index][1]) button.classList.add("active");
                button.addEventListener("click", function () { setCopyReviewStatus(scenario.imgId, statuses[index][1]); });
            });
            var commentInput = comments.querySelector("textarea");
            commentInput.value = entry.comments;
            commentInput.addEventListener("input", function () { entry.comments = commentInput.value; saveCopyReviewDraft(); });
            row.appendChild(comments);
            body.appendChild(row);
        });
        $("btnCopyReviewPrevious").disabled = copyReviewPage === 0;
        $("btnCopyReviewNext").disabled = copyReviewPage >= maxPage;
    }

    function openCopyReview() {
        populateCopyReviewCategories();
        copyReviewPage = 0;
        renderCopyReview();
        $("copyReviewOverlay").classList.add("open");
    }

    function exportCopyReview() {
        var reviewed = {};
        var allScenarios = collectCopyReviewScenarios();
        Object.keys(copyReviewDraft).forEach(function (imgId) {
            var entry = copyReviewDraft[imgId];
            var match = allScenarios.find(function (s) { return s.imgId === Number(imgId); }) || {};
            if (entry.status || entry.comments || entry.title !== (match.title || "") || entry.instruction !== (match.instruction || "")) reviewed[imgId] = entry;
        });
        downloadJson({ source: "mission-editor.html", generatedAt: new Date().toISOString(), reviews: reviewed }, "scenario-mission-copy-review.json");
        setStatus("Exported " + Object.keys(reviewed).length + " copy-review entries.");
    }

    function loadInitialData() {
        poolMetadata = buildPoolMetadata(scenarioDB, missionMatrix);
        var loaded = loadMissionAssignmentsSync("../mission-assignments.json");
        if (!loaded && typeof loadMissionAssignmentsFromScript === "function") {
            loaded = loadMissionAssignmentsFromScript();
        }
        baselineLoadedOk = !!loaded;
        if (loaded && getMissionAssignmentData()) {
            baselineAssignments = JSON.parse(JSON.stringify(getMissionAssignmentData().assignments));
        } else {
            baselineAssignments = {};
            Object.keys(coreFleetSpecs).forEach(function (type) {
                baselineAssignments[type] = [];
            });
        }
        workingAssignments = JSON.parse(JSON.stringify(baselineAssignments));
        ensureAllAircraftKeys();
        if (restoreDraftIfPresent()) {
            updateDraftHint();
            if (!baselineLoadedOk) {
                setStatus("Warning: baseline assignments did not load — review diff may show thousands of false changes. Use Discard draft or serve via a local web server.");
            }
        } else if (!loaded) {
            setStatus("No mission-assignments.json found — run scripts/export-mission-assignments.mjs or import a file.");
        }
    }

    function restoreDraftIfPresent() {
        try {
            var raw = localStorage.getItem(DRAFT_STORAGE_KEY);
            if (!raw) return false;
            var draft = JSON.parse(raw);
            if (!draft || !draft.assignments) return false;
            workingAssignments = JSON.parse(JSON.stringify(draft.assignments));
            ensureAllAircraftKeys();
            draftSavedAt = draft.savedAt || null;
            return true;
        } catch (e) {
            return false;
        }
    }

    function scheduleDraftSave() {
        if (draftSaveTimer) clearTimeout(draftSaveTimer);
        draftSaveTimer = setTimeout(saveDraftNow, 400);
    }

    function saveDraftNow() {
        try {
            draftSavedAt = new Date().toISOString();
            localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({
                savedAt: draftSavedAt,
                assignments: workingAssignments
            }));
            updateDraftHint();
        } catch (e) {
            setStatus("Could not auto-save draft (storage full or blocked). Export a backup.");
        }
    }

    function updateDraftHint() {
        var el = $("draftHint");
        if (!el) return;
        if (draftSavedAt) {
            var when = new Date(draftSavedAt).toLocaleString();
            el.textContent = "Draft auto-saved " + when + " in this browser. Review & Confirm downloads the final mission-assignments.json.";
        }
    }

    function discardDraft() {
        if (!confirm("Discard your draft and reload from mission-assignments.json?")) return;
        try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch (e) { /* ignore */ }
        draftSavedAt = null;
        workingAssignments = JSON.parse(JSON.stringify(baselineAssignments));
        selectedSidebar.clear();
        selectedAircraft = null;
        renderAircraftList();
        renderEditor();
        updateDraftHint();
        setStatus("Draft discarded — restored baseline from mission-assignments.json.");
    }

    function markDirty() {
        scheduleDraftSave();
    }

    function ensureAllAircraftKeys() {
        Object.keys(coreFleetSpecs).forEach(function (type) {
            if (!workingAssignments[type]) workingAssignments[type] = [];
            if (!baselineAssignments[type]) baselineAssignments[type] = [];
        });
    }

    function getWorkingImgIds(type) {
        return workingAssignments[type] || [];
    }

    function setWorkingImgIds(type, imgIds) {
        workingAssignments[type] = imgIds.slice().sort(function (a, b) { return a - b; });
        markDirty();
    }

    function aircraftChanged(type) {
        var base = new Set(baselineAssignments[type] || []);
        var cur = new Set(workingAssignments[type] || []);
        if (base.size !== cur.size) return true;
        var changed = false;
        cur.forEach(function (id) { if (!base.has(id)) changed = true; });
        return changed;
    }

    function totalChangedAircraft() {
        return Object.keys(coreFleetSpecs).filter(aircraftChanged).length;
    }

    function poolEnabledCount(type, poolKey) {
        var set = new Set(getWorkingImgIds(type));
        var meta = poolMetadata[poolKey];
        if (!meta) return { on: 0, total: 0 };
        var on = meta.imgIds.filter(function (id) { return set.has(id); }).length;
        return { on: on, total: meta.imgIds.length };
    }

    function isPoolFullyEnabled(type, poolKey) {
        var c = poolEnabledCount(type, poolKey);
        return c.on === c.total && c.total > 0;
    }

    function isPoolPartiallyEnabled(type, poolKey) {
        var c = poolEnabledCount(type, poolKey);
        return c.on > 0 && c.on < c.total;
    }

    function togglePool(type, poolKey, enabled) {
        togglePoolForTargets([type], poolKey, enabled);
    }

    function togglePoolForTargets(targets, poolKey, enabled) {
        targets.forEach(function (type) {
            var current = getWorkingImgIds(type);
            workingAssignments[type] = enabled
                ? applyPoolsToImgIds([poolKey], poolMetadata, current)
                : removePoolsFromImgIds([poolKey], poolMetadata, current);
            workingAssignments[type].sort(function (a, b) { return a - b; });
        });
        markDirty();
    }

    function toggleScenario(type, imgId, enabled) {
        toggleScenarioForTargets([type], imgId, enabled);
    }

    function toggleScenarioForTargets(targets, imgId, enabled) {
        targets.forEach(function (type) {
            var set = new Set(getWorkingImgIds(type));
            if (enabled) set.add(imgId);
            else set.delete(imgId);
            workingAssignments[type] = [...set].sort(function (a, b) { return a - b; });
        });
        markDirty();
    }

    function poolStateForTargets(targets, poolKey) {
        var full = 0;
        var partial = 0;
        var empty = 0;
        targets.forEach(function (type) {
            var c = poolEnabledCount(type, poolKey);
            if (c.on === 0) empty++;
            else if (c.on === c.total) full++;
            else partial++;
        });
        return { full: full, partial: partial, empty: empty, total: targets.length };
    }

    function scenarioStateForTargets(targets, imgId) {
        var on = 0;
        targets.forEach(function (type) {
            if (getWorkingImgIds(type).includes(imgId)) on++;
        });
        if (on === 0) return "none";
        if (on === targets.length) return "all";
        return "mixed";
    }

    function poolHasDiffBulk(targets, poolKey) {
        return targets.some(function (type) { return poolHasDiff(type, poolKey); });
    }

    function scenarioDiffForTargets(targets, imgId) {
        var added = 0;
        var removed = 0;
        targets.forEach(function (type) {
            var base = (baselineAssignments[type] || []).includes(imgId);
            var cur = getWorkingImgIds(type).includes(imgId);
            if (cur && !base) added++;
            if (!cur && base) removed++;
        });
        return { added: added, removed: removed };
    }

    function formatBulkPoolCount(targets, poolKey) {
        var meta = poolMetadata[poolKey];
        if (!meta || targets.length <= 1) {
            var c = poolEnabledCount(targets[0], poolKey);
            return c.on + " / " + c.total;
        }
        var st = poolStateForTargets(targets, poolKey);
        var parts = [];
        if (st.full) parts.push(st.full + " full");
        if (st.partial) parts.push(st.partial + " partial");
        if (st.empty) parts.push(st.empty + " off");
        return parts.join(" · ") + " (" + meta.imgIds.length + " scenarios)";
    }

    function expandAllPools() {
        expandedPools.clear();
        MISSION_POOL_ORDER.forEach(function (poolKey) {
            if (poolMetadata[poolKey]) expandedPools.add(poolKey);
        });
        renderEditor();
    }

    function collapseAllPools() {
        expandedPools.clear();
        renderEditor();
    }

    function renderPoolEditor(container, targets) {
        container.innerHTML = "";
        var isBulk = targets.length > 1;

        MISSION_POOL_ORDER.forEach(function (poolKey) {
            var meta = poolMetadata[poolKey];
            if (!meta) return;

            var group = document.createElement("div");
            group.className = "pool-group";
            if (expandedPools.has(poolKey)) group.classList.add("expanded");

            if (isBulk ? poolHasDiffBulk(targets, poolKey) : poolHasDiff(targets[0], poolKey)) {
                group.classList.add("changed");
            }

            var header = document.createElement("div");
            header.className = "pool-header";
            var cb = document.createElement("input");
            cb.type = "checkbox";

            if (isBulk) {
                var pst = poolStateForTargets(targets, poolKey);
                cb.checked = pst.full === pst.total && pst.total > 0;
                cb.indeterminate = pst.full > 0 && pst.full < pst.total;
            } else {
                var counts = poolEnabledCount(targets[0], poolKey);
                cb.checked = counts.on === counts.total && counts.total > 0;
                cb.indeterminate = counts.on > 0 && counts.on < counts.total;
            }

            cb.addEventListener("click", function (e) { e.stopPropagation(); });
            cb.addEventListener("change", function () {
                togglePoolForTargets(targets, poolKey, cb.checked);
                renderAircraftList();
                renderEditor();
            });

            var chevron = document.createElement("span");
            chevron.textContent = expandedPools.has(poolKey) ? "▼" : "▶";
            chevron.style.color = "var(--muted)";

            var templateBadge = document.createElement("span");
            templateBadge.className = "pool-template";
            templateBadge.textContent = meta.templateLabel ? "#" + meta.templateLabel : "#?";
            templateBadge.title = meta.missionTypes && meta.missionTypes.length > 1
                ? "Mission templates " + meta.missionTypes.join(", ")
                : "Mission template " + (meta.missionType || "");

            var title = document.createElement("span");
            title.className = "pool-title";
            title.textContent = meta.label;

            var sub = document.createElement("span");
            sub.className = "pool-sub";
            if (meta.missionNames && meta.missionNames.length === 1) {
                sub.textContent = meta.missionNames[0];
            } else if (meta.missionNames && meta.missionNames.length > 1) {
                sub.textContent = meta.missionNames.join(" · ");
            } else if (meta.missionName) {
                sub.textContent = meta.missionName;
            } else {
                sub.textContent = poolKey;
            }
            sub.title = sub.textContent;

            var countEl = document.createElement("span");
            countEl.className = "pool-count";
            countEl.textContent = formatBulkPoolCount(targets, poolKey);

            header.appendChild(chevron);
            header.appendChild(cb);
            header.appendChild(templateBadge);
            header.appendChild(title);
            header.appendChild(sub);
            header.appendChild(countEl);
            header.addEventListener("click", function () {
                if (expandedPools.has(poolKey)) expandedPools.delete(poolKey);
                else expandedPools.add(poolKey);
                renderEditor();
            });

            var body = document.createElement("div");
            body.className = "pool-body";
            var grid = document.createElement("div");
            grid.className = "scenario-grid";

            meta.scenarios.forEach(function (s) {
                var item = document.createElement("label");
                item.className = "scenario-item";

                var scb = document.createElement("input");
                scb.type = "checkbox";

                if (isBulk) {
                    var st = scenarioStateForTargets(targets, s.imgId);
                    scb.checked = st === "all";
                    scb.indeterminate = st === "mixed";
                    var diff = scenarioDiffForTargets(targets, s.imgId);
                    if (diff.added > 0) item.classList.add("diff-add");
                    if (diff.removed > 0) item.classList.add("diff-remove");
                } else {
                    var type = targets[0];
                    var assignedSet = new Set(getWorkingImgIds(type));
                    var baseSet = new Set(baselineAssignments[type] || []);
                    var on = assignedSet.has(s.imgId);
                    var was = baseSet.has(s.imgId);
                    scb.checked = on;
                    if (on && !was) item.classList.add("diff-add");
                    if (!on && was) item.classList.add("diff-remove");
                }

                scb.addEventListener("change", function () {
                    toggleScenarioForTargets(targets, s.imgId, scb.checked);
                    renderAircraftList();
                    renderEditor();
                });

                var img = document.createElement("img");
                img.className = "scenario-thumb";
                img.src = getMissionImageUrl(s.imgId);
                img.alt = "Mission " + s.imgId;
                img.loading = "lazy";
                img.draggable = false;
                img.addEventListener("error", function () {
                    img.classList.add("missing");
                });

                var body = document.createElement("div");
                body.className = "scenario-body";

                var head = document.createElement("div");
                head.className = "scenario-head";
                head.appendChild(scb);

                var idSpan = document.createElement("span");
                idSpan.className = "scenario-id";
                idSpan.textContent = "#" + s.imgId;
                head.appendChild(idSpan);

                if (isBulk) {
                    var st2 = scenarioStateForTargets(targets, s.imgId);
                    if (st2 === "mixed") {
                        var mix = document.createElement("span");
                        mix.className = "scenario-mixed";
                        mix.textContent = "mixed";
                        head.appendChild(mix);
                    }
                }

                var payload = document.createElement("div");
                payload.className = "scenario-payload";
                payload.textContent = (s.payload || "").substring(0, 120);
                payload.title = s.payload || "";

                body.appendChild(head);
                body.appendChild(payload);
                item.appendChild(img);
                item.appendChild(body);
                item.title = (s.payload || "") + (s.instruction ? "\n\n" + s.instruction : "");
                grid.appendChild(item);
            });

            body.appendChild(grid);
            group.appendChild(header);
            group.appendChild(body);
            container.appendChild(group);
        });
    }

    function populateClassFilter() {
        var classes = new Set();
        Object.keys(coreFleetSpecs).forEach(function (t) {
            classes.add(coreFleetSpecs[t].class);
        });
        var sel = $("classFilter");
        [...classes].sort().forEach(function (c) {
            var opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            sel.appendChild(opt);
        });
    }

    function populatePresetSelect() {
        var sel = $("presetSelect");
        AIRCRAFT_MISSION_PRESETS.forEach(function (p) {
            var opt = document.createElement("option");
            opt.value = p.id;
            opt.textContent = p.label;
            sel.appendChild(opt);
        });
    }

    function populateCopyFromSelect() {
        var sel = $("copyFromSelect");
        Object.keys(coreFleetSpecs).sort().forEach(function (type) {
            var opt = document.createElement("option");
            opt.value = type;
            opt.textContent = type + " — " + coreFleetSpecs[type].name;
            sel.appendChild(opt);
        });
    }

    function getPresetById(presetId) {
        return AIRCRAFT_MISSION_PRESETS.find(function (p) { return p.id === presetId; });
    }

    function getMatchingAircraftForPreset(preset) {
        if (!preset) return [];
        return getPresetMatchingAircraft(preset, coreFleetSpecs);
    }

    function updateSelectionCount() {
        var el = $("selectionCount");
        if (!el) return;
        var n = selectedSidebar.size;
        el.textContent = n === 0 ? "0 selected" : n + " selected";
    }

    function selectAircraftTypes(types, replace) {
        if (replace) selectedSidebar.clear();
        types.forEach(function (t) { selectedSidebar.add(t); });
        if (selectedSidebar.size === 1) {
            selectedAircraft = [...selectedSidebar][0];
        } else if (!selectedSidebar.has(selectedAircraft)) {
            selectedAircraft = selectedSidebar.size ? [...selectedSidebar][0] : null;
        }
        updateSelectionCount();
        renderAircraftList();
        renderEditor();
    }

    function selectAllVisible() {
        selectAircraftTypes(filteredAircraftTypes(), true);
        setStatus("Selected " + selectedSidebar.size + " visible aircraft.");
    }

    function clearSelection() {
        selectedSidebar.clear();
        selectedAircraft = null;
        updateSelectionCount();
        renderAircraftList();
        renderEditor();
    }

    function selectMatchingPreset() {
        var presetId = $("presetSelect").value;
        var preset = getPresetById(presetId);
        if (!preset) {
            alert("Choose a preset first.");
            return;
        }
        var matches = getMatchingAircraftForPreset(preset);
        if (!matches.length) {
            alert("No aircraft match preset \"" + preset.label + "\".");
            return;
        }
        selectAircraftTypes(matches, true);
        setStatus("Selected " + matches.length + " aircraft matching \"" + preset.label + "\".");
    }

    function handleAircraftClick(type, e) {
        var types = filteredAircraftTypes();
        if (e.shiftKey && lastClickedAircraft && types.includes(lastClickedAircraft)) {
            var start = types.indexOf(lastClickedAircraft);
            var end = types.indexOf(type);
            if (start > end) { var tmp = start; start = end; end = tmp; }
            if (!e.ctrlKey && !e.metaKey) selectedSidebar.clear();
            for (var i = start; i <= end; i++) selectedSidebar.add(types[i]);
        } else if (e.ctrlKey || e.metaKey) {
            if (selectedSidebar.has(type)) selectedSidebar.delete(type);
            else selectedSidebar.add(type);
        } else {
            selectedSidebar.clear();
            selectedSidebar.add(type);
        }
        lastClickedAircraft = type;
        if (selectedSidebar.size === 1) selectedAircraft = type;
        else if (!selectedSidebar.has(selectedAircraft)) {
            selectedAircraft = selectedSidebar.size ? [...selectedSidebar][0] : null;
        }
        updateSelectionCount();
        renderAircraftList();
        renderEditor();
    }

    function resolveAircraftType(query) {
        var raw = (query || "").trim();
        if (!raw) return null;
        if (coreFleetSpecs[raw]) return raw;
        var upper = raw.toUpperCase();
        if (coreFleetSpecs[upper]) return upper;
        var matches = Object.keys(coreFleetSpecs).filter(function (type) {
            return type.toUpperCase() === upper;
        });
        if (matches.length === 1) return matches[0];
        return null;
    }

    function aircraftMatchesQuery(type, q) {
        if (!q) return false;
        var spec = coreFleetSpecs[type];
        var ql = q.toLowerCase();
        return type.toLowerCase().includes(ql)
            || (spec.name || "").toLowerCase().includes(ql)
            || (spec.tags || []).some(function (t) { return t.toLowerCase().includes(ql); });
    }

    function getSearchSuggestionCandidates() {
        var q = ($("aircraftSearch").value || "").trim();
        if (!q) return [];
        return Object.keys(coreFleetSpecs).filter(function (type) {
            if (searchFilterTypes.has(type)) return false;
            return aircraftMatchesQuery(type, q);
        }).sort(function (a, b) {
            var ql = q.toLowerCase();
            var aCode = a.toLowerCase();
            var bCode = b.toLowerCase();
            var aRank = aCode === ql ? 0 : (aCode.startsWith(ql) ? 1 : 2);
            var bRank = bCode === ql ? 0 : (bCode.startsWith(ql) ? 1 : 2);
            if (aRank !== bRank) return aRank - bRank;
            return a.localeCompare(b);
        }).slice(0, 12);
    }

    function addSearchFilterType(type) {
        if (!type || !coreFleetSpecs[type] || searchFilterTypes.has(type)) return;
        searchFilterTypes.add(type);
        renderSearchChips();
        renderSearchSuggestions();
        renderAircraftList();
        setStatus("Showing " + [...searchFilterTypes].sort().join(", ") + " (" + filteredAircraftTypes().length + " aircraft).");
    }

    function renderSearchSuggestions() {
        var box = $("searchSuggestions");
        if (!box) return;
        box.innerHTML = "";
        var candidates = getSearchSuggestionCandidates();
        candidates.forEach(function (type) {
            var btn = document.createElement("button");
            btn.type = "button";
            btn.className = "search-suggestion";
            var spec = coreFleetSpecs[type];
            var name = abbreviateAircraftName(spec.name, 26);
            btn.title = type + " — " + spec.name;
            btn.innerHTML = '<span class="sug-code">' + type + "</span>" + name;
            btn.addEventListener("click", function () {
                addSearchFilterType(type);
                $("aircraftSearch").value = "";
                renderSearchSuggestions();
            });
            box.appendChild(btn);
        });
    }

    function renderSearchChips() {
        var box = $("searchChips");
        if (!box) return;
        box.innerHTML = "";
        if (!searchFilterTypes.size) return;

        [...searchFilterTypes].sort().forEach(function (type) {
            var chip = document.createElement("span");
            chip.className = "search-chip";
            chip.title = coreFleetSpecs[type] ? coreFleetSpecs[type].name : type;
            chip.appendChild(document.createTextNode(type));

            var removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.setAttribute("aria-label", "Remove " + type);
            removeBtn.textContent = "\u00d7";
            removeBtn.addEventListener("click", function () {
                searchFilterTypes.delete(type);
                renderSearchChips();
                renderSearchSuggestions();
                renderAircraftList();
            });
            chip.appendChild(removeBtn);
            box.appendChild(chip);
        });

        var clearAll = document.createElement("button");
        clearAll.type = "button";
        clearAll.className = "search-clear-link";
        clearAll.textContent = "Clear filters";
        clearAll.addEventListener("click", function () {
            searchFilterTypes.clear();
            renderSearchChips();
            renderSearchSuggestions();
            renderAircraftList();
            setStatus("Search filters cleared.");
        });
        box.appendChild(clearAll);
    }

    function tryAddSearchType() {
        var input = ($("aircraftSearch").value || "").trim();
        if (!input) return;

        var resolved = resolveAircraftType(input);
        if (resolved) {
            addSearchFilterType(resolved);
            $("aircraftSearch").value = "";
            renderSearchSuggestions();
            return;
        }

        var candidates = getSearchSuggestionCandidates();
        if (candidates.length === 1) {
            addSearchFilterType(candidates[0]);
            $("aircraftSearch").value = "";
            renderSearchSuggestions();
            return;
        }
        if (candidates.length > 1) {
            renderSearchSuggestions();
            setStatus(candidates.length + " matches — click a bubble below to add.");
            return;
        }
        setStatus("No aircraft found for \"" + input + "\".");
    }

    function filteredAircraftTypes() {
        var q = ($("aircraftSearch").value || "").trim().toLowerCase();
        var cls = $("classFilter").value;
        var changedOnly = $("showChangedOnly").checked;
        return Object.keys(coreFleetSpecs).filter(function (type) {
            var spec = coreFleetSpecs[type];
            if (cls && spec.class !== cls) return false;
            if (changedOnly && !aircraftChanged(type)) return false;
            if (searchFilterTypes.size > 0) {
                return searchFilterTypes.has(type);
            }
            if (!q) return true;
            return aircraftMatchesQuery(type, q);
        }).sort();
    }

    function renderAircraftList() {
        var list = $("aircraftList");
        list.innerHTML = "";
        var types = filteredAircraftTypes();
        types.forEach(function (type) {
            var div = document.createElement("div");
            div.className = "aircraft-item";
            if (selectedSidebar.has(type)) div.classList.add("selected");
            if (type === selectedAircraft && selectedSidebar.size === 1) div.classList.add("active");
            if (aircraftChanged(type)) div.classList.add("changed");
            div.dataset.type = type;
            var count = getWorkingImgIds(type).length;
            var spec = coreFleetSpecs[type];
            var fullName = spec.name || type;
            var shortName = abbreviateAircraftName(fullName, 38);
            div.title = type + " — " + fullName;
            div.innerHTML = '<span class="code">' + type + '</span>'
                + '<span class="label">'
                + '<span class="aircraft-name">' + shortName + '</span>'
                + '<span class="aircraft-class">' + (spec.class || "") + '</span>'
                + '</span>'
                + '<span class="count">' + count + '</span>';
            div.addEventListener("click", function (e) {
                handleAircraftClick(type, e);
            });
            list.appendChild(div);
        });
    }

    function renderEditor() {
        var bulkPanel = $("bulkPanel");
        var poolContainer = $("poolContainer");
        var targets = getSelectedAircraftTargets();

        if (!targets.length) {
            $("emptyState").classList.remove("hidden");
            $("editorPanel").classList.add("hidden");
            return;
        }

        $("emptyState").classList.add("hidden");
        $("editorPanel").classList.remove("hidden");
        poolContainer.classList.remove("hidden");

        if (targets.length > 1) {
            bulkPanel.classList.remove("hidden");
            var codes = targets.sort().map(formatAircraftBulkTag).join(", ");
            bulkPanel.innerHTML = "<h3>" + targets.length + " aircraft — bulk edit</h3>"
                + "<p>Pool and scenario changes below apply to <strong>all</strong> selected aircraft. "
                + "Mixed checkboxes mean only some aircraft have that mission — tick to enable for all, untick to remove from all.</p>"
                + "<p style=\"font-size:0.8rem;word-break:break-word\">" + codes + "</p>";
            $("selectedTitle").textContent = targets.length + " aircraft selected";
            $("selectedMeta").textContent = "Bulk editing — changes apply to every selected airframe";
        } else {
            bulkPanel.classList.add("hidden");
            selectedAircraft = targets[0];
            var type = targets[0];
            var spec = coreFleetSpecs[type];
            var ids = getWorkingImgIds(type);
            $("selectedTitle").textContent = type + " — " + spec.name;
            $("selectedMeta").textContent = spec.class
                + " · " + ids.length + " scenarios assigned"
                + (aircraftChanged(type) ? " · modified" : "")
                + " · tags: " + (spec.tags || []).slice(0, 6).join(", ");
        }

        renderPoolEditor(poolContainer, targets);
    }

    function poolHasDiff(type, poolKey) {
        var meta = poolMetadata[poolKey];
        if (!meta) return false;
        var base = new Set(baselineAssignments[type] || []);
        var cur = new Set(workingAssignments[type] || []);
        return meta.imgIds.some(function (id) {
            return base.has(id) !== cur.has(id);
        });
    }

    function getSelectedAircraftTargets() {
        if (selectedSidebar.size > 0) return [...selectedSidebar];
        if (selectedAircraft) return [selectedAircraft];
        return [];
    }

    function applyPresetToTargets(targets, preset) {
        targets.forEach(function (type) {
            setWorkingImgIds(type, applyPoolsToImgIds(preset.pools, poolMetadata, getWorkingImgIds(type)));
        });
        renderAircraftList();
        renderEditor();
    }

    function applyPresetToSelected() {
        var presetId = $("presetSelect").value;
        var preset = getPresetById(presetId);
        if (!preset) {
            alert("Choose a preset first.");
            return;
        }
        var targets = getSelectedAircraftTargets();
        if (!targets.length) {
            alert("Select at least one aircraft in the sidebar (use All visible, Matching preset, or Ctrl+click).");
            return;
        }
        applyPresetToTargets(targets, preset);
        setStatus("Applied preset \"" + preset.label + "\" to " + targets.length + " selected aircraft.");
    }

    function applyPresetToAllMatching() {
        var presetId = $("presetSelect").value;
        var preset = getPresetById(presetId);
        if (!preset) {
            alert("Choose a preset first.");
            return;
        }
        var targets = getMatchingAircraftForPreset(preset);
        if (!targets.length) {
            alert("No aircraft match preset \"" + preset.label + "\".");
            return;
        }
        if (!confirm("Apply \"" + preset.label + "\" to " + targets.length + " matching aircraft?\n\n" + targets.join(", "))) return;
        selectAircraftTypes(targets, true);
        applyPresetToTargets(targets, preset);
        setStatus("Applied preset \"" + preset.label + "\" to all " + targets.length + " matching aircraft.");
    }

    function copyFromSelected() {
        var from = $("copyFromSelect").value;
        if (!from) return;
        var targets = getSelectedAircraftTargets();
        if (!targets.length) {
            alert("Select at least one aircraft in the sidebar.");
            return;
        }
        var source = getWorkingImgIds(from).slice();
        targets.forEach(function (type) {
            if (type !== from) setWorkingImgIds(type, source.slice());
        });
        renderAircraftList();
        renderEditor();
        setStatus("Copied assignments from " + from + " to " + targets.length + " aircraft.");
    }

    function clearSelectedAircraft() {
        var targets = getSelectedAircraftTargets();
        if (!targets.length) return;
        if (!confirm("Clear all mission assignments for " + targets.length + " aircraft?")) return;
        targets.forEach(function (type) { setWorkingImgIds(type, []); });
        renderAircraftList();
        renderEditor();
    }

    function buildExportPayload() {
        return {
            schema: MISSION_ASSIGNMENT_SCHEMA,
            version: 1,
            generatedAt: new Date().toISOString(),
            source: "mission-editor.html",
            meta: {
                aircraftCount: Object.keys(workingAssignments).length,
                editedAircraft: totalChangedAircraft()
            },
            assignments: workingAssignments
        };
    }

    function downloadText(text, filename, mime) {
        var blob = new Blob([text], { type: mime || "text/plain" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function downloadJson(data, filename) {
        downloadText(JSON.stringify(data, null, 2) + "\n", filename, "application/json");
    }

    function downloadAssignmentsJs(payload) {
        var js = "// Auto-generated from Mission Assignment Editor\n"
            + "var MISSION_ASSIGNMENTS_EMBED = " + JSON.stringify(payload) + ";\n"
            + "if (typeof setMissionAssignmentData === \"function\") { setMissionAssignmentData(MISSION_ASSIGNMENTS_EMBED); }\n";
        downloadText(js, "mission-assignments-data.js", "application/javascript");
    }

    function countAssignmentImgIds(assignments) {
        var total = 0;
        Object.keys(assignments || {}).forEach(function (type) {
            total += (assignments[type] || []).length;
        });
        return total;
    }

    function openReview() {
        var baselineCount = countAssignmentImgIds(baselineAssignments);
        var workingCount = countAssignmentImgIds(workingAssignments);
        if (!baselineLoadedOk || (baselineCount < 100 && workingCount > baselineCount + 500)) {
            alert(
                "Cannot review export: the baseline mission-assignments file did not load correctly.\n\n"
                + "This often happens when opening mission-editor.html as file:// — the diff would show thousands of false \"added\" scenarios.\n\n"
                + "Fix: click Discard draft in the editor, hard-refresh (Ctrl+F5), or open via a local server. "
                + "mission-assignments-data.js is now included as a fallback."
            );
            return;
        }
        var diff = diffAssignments(baselineAssignments, workingAssignments);
        var body = $("reviewBody");
        body.innerHTML = "";

        var stats = document.createElement("div");
        stats.className = "stat-grid";
        stats.innerHTML = [
            statCard(diff.aircraftChanged, "Aircraft changed"),
            statCard(diff.totalImgIdAdds, "Scenarios added"),
            statCard(diff.totalImgIdRemoves, "Scenarios removed"),
            statCard(totalChangedAircraft(), "Pending edits")
        ].join("");
        body.appendChild(stats);

        if (diff.aircraftChanged === 0) {
            body.appendChild(document.createTextNode("No changes from baseline."));
        } else {
            var list = document.createElement("div");
            list.className = "review-list";
            Object.keys(diff.byAircraft).sort().forEach(function (type) {
                var d = diff.byAircraft[type];
                var line = document.createElement("div");
                line.textContent = type + ": +" + d.added.length + " / -" + d.removed.length
                    + (d.added.length ? " added [" + d.added.join(", ") + "]" : "")
                    + (d.removed.length ? " removed [" + d.removed.join(", ") + "]" : "");
                list.appendChild(line);
            });
            body.appendChild(list);
        }

        $("reviewOverlay").classList.add("open");
    }

    function statCard(val, lbl) {
        return '<div class="stat-card"><div class="val">' + val + '</div><div class="lbl">' + lbl + '</div></div>';
    }

    function confirmReview() {
        var payload = buildExportPayload();
        downloadJson(payload, "mission-assignments.json");
        downloadAssignmentsJs(payload);
        baselineAssignments = JSON.parse(JSON.stringify(workingAssignments));
        setMissionAssignmentData(payload);
        saveDraftNow();
        $("reviewOverlay").classList.remove("open");
        renderAircraftList();
        renderEditor();
        setStatus("Downloaded mission-assignments.json and mission-assignments-data.js — place both in the project folder, then hard-refresh dispatch (Ctrl+F5).");
    }

    function exportBackup() {
        downloadJson(buildExportPayload(), "mission-assignments-backup-" + Date.now() + ".json");
        setStatus("Exported backup JSON.");
    }

    function importJson(file) {
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var data = JSON.parse(reader.result);
                if (!data.assignments) throw new Error("Missing assignments");
                workingAssignments = JSON.parse(JSON.stringify(data.assignments));
                ensureAllAircraftKeys();
                markDirty();
                renderAircraftList();
                renderEditor();
                setStatus("Imported " + Object.keys(data.assignments).length + " aircraft assignments.");
            } catch (e) {
                alert("Import failed: " + e.message);
            }
        };
        reader.readAsText(file);
    }

    function bindEvents() {
        $("aircraftSearch").addEventListener("input", function () {
            renderSearchSuggestions();
            if (!searchFilterTypes.size) renderAircraftList();
        });
        $("aircraftSearch").addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                tryAddSearchType();
            }
        });
        $("btnAddSearchFilter").addEventListener("click", tryAddSearchType);
        $("classFilter").addEventListener("change", renderAircraftList);
        $("showChangedOnly").addEventListener("change", renderAircraftList);
        $("btnSelectAllVisible").addEventListener("click", selectAllVisible);
        $("btnSelectMatching").addEventListener("click", selectMatchingPreset);
        $("btnClearSelection").addEventListener("click", clearSelection);
        $("btnApplyPreset").addEventListener("click", applyPresetToSelected);
        $("btnApplyPresetMatching").addEventListener("click", applyPresetToAllMatching);
        $("btnExpandAllPools").addEventListener("click", expandAllPools);
        $("btnCollapseAllPools").addEventListener("click", collapseAllPools);
        $("btnCopyFrom").addEventListener("click", copyFromSelected);
        $("btnClearAircraft").addEventListener("click", clearSelectedAircraft);
        $("btnDiscardDraft").addEventListener("click", discardDraft);
        $("btnCopyReviewClose").addEventListener("click", function () { $("copyReviewOverlay").classList.remove("open"); });
        $("btnCopyReviewPrevious").addEventListener("click", function () { copyReviewPage--; renderCopyReview(); });
        $("btnCopyReviewNext").addEventListener("click", function () { copyReviewPage++; renderCopyReview(); });
        $("btnCopyReviewExport").addEventListener("click", exportCopyReview);
        $("copyReviewCategory").addEventListener("change", function () { copyReviewPage = 0; renderCopyReview(); });
        $("copyReviewBatchSize").addEventListener("change", function () { copyReviewPage = 0; renderCopyReview(); });
        $("btnReview").addEventListener("click", openReview);
        $("btnReviewCancel").addEventListener("click", function () {
            $("reviewOverlay").classList.remove("open");
        });
        $("btnReviewConfirm").addEventListener("click", confirmReview);
        $("btnExport").addEventListener("click", exportBackup);
        $("btnImport").addEventListener("click", function () { $("importFile").click(); });
        $("importFile").addEventListener("change", function (e) {
            if (e.target.files[0]) importJson(e.target.files[0]);
            e.target.value = "";
        });
    }

    function init() {
        if (typeof coreFleetSpecs === "undefined" || typeof scenarioDB === "undefined") {
            setStatus("Error: fleet-db.js / missions-db.js failed to load.");
            return;
        }
        loadInitialData();
        loadCopyReviewDraft();
        populateClassFilter();
        populatePresetSelect();
        populateCopyFromSelect();
        bindEvents();
        updateSelectionCount();
        renderAircraftList();
        updateDraftHint();
        var changed = totalChangedAircraft();
        var draftNote = draftSavedAt ? " Draft restored." : "";
        setStatus("Loaded " + Object.keys(coreFleetSpecs).length + " aircraft, "
            + Object.keys(poolMetadata).length + " scenario pools." + draftNote
            + (changed ? " (" + changed + " differ from baseline)" : ""));
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();

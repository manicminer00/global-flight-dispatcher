function dispatchFlight() {
    const cfg = getDispatchUiProbeConfig();
    if (!cfg.aircraftType) {
        alert("Please select an aircraft type before generating contracts.");
        return;
    }
    revokeBoardPlnUrls();
    boardContractResults = [];
    boardSelectedIndex = -1;
    const results = [];
    const allWarnings = [];
    let lastError = "";
    // Up to 9 probe attempts to collect 3 successful contracts
    for (let attempt = 0; attempt < 9 && results.length < 3; attempt++) {
        const result = probeDispatchFlight(cfg);
        if (!result.ok) {
            lastError = result.message || "Dispatch failed.";
            continue;
        }
        if (result.warnings && result.warnings.length) {
            result.warnings.forEach((w) => {
                if (allWarnings.indexOf(w) === -1) allWarnings.push(w);
            });
        }
        result._exportBundle = buildDispatchExportBundle(result);
        results.push(result);
    }
    if (results.length < 3) {
        alert(lastError || "Could not generate three contracts with the current settings. Try adjusting aircraft, flight time, or departure.");
        return;
    }
    if (allWarnings.length) showDispatchNotams(allWarnings.slice(0, 3));
    boardContractResults = results;
    renderContractsBoard(results);
    const board = document.getElementById("contractsBoardPanel");
    if (board) board.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

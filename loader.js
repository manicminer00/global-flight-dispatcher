(function () {

    // Bump this string on every deploy (keep version.json in sync).

    var APP_VERSION = "2.1.3";

    var useFileProtocol = window.location.protocol === "file:";



    function compareVersions(a, b) {

        var pa = String(a || "0").split(".").map(function (n) { return parseInt(n, 10) || 0; });

        var pb = String(b || "0").split(".").map(function (n) { return parseInt(n, 10) || 0; });

        var len = Math.max(pa.length, pb.length);

        for (var i = 0; i < len; i++) {

            var na = pa[i] || 0;

            var nb = pb[i] || 0;

            if (na > nb) return 1;

            if (na < nb) return -1;

        }

        return 0;

    }



    function pickNewerVersion(a, b) {

        return compareVersions(a, b) >= 0 ? a : b;

    }



    var activeVersion = APP_VERSION;



    if (!useFileProtocol) {

        try {

            var versionUrl = new URL("version.json", window.location.href);

            versionUrl.searchParams.set("_", String(Date.now()));

            var xhr = new XMLHttpRequest();

            xhr.open("GET", versionUrl.toString(), false);

            xhr.setRequestHeader("Cache-Control", "no-cache");

            xhr.setRequestHeader("Pragma", "no-cache");

            xhr.send(null);

            if (xhr.status >= 200 && xhr.status < 300) {

                var payload = JSON.parse(xhr.responseText);

                var serverVersion = payload.version || APP_VERSION;

                activeVersion = pickNewerVersion(APP_VERSION, serverVersion);

            }

        } catch (e) {

            /* fall back to APP_VERSION */

        }



        try {

            var storedVersion = localStorage.getItem("dispatcher_app_version");

            var pageUrl = new URL(window.location.href);

            var urlVersion = pageUrl.searchParams.get("v");

            var reloadKey = "dispatcher_boot_reload_" + activeVersion;

            var reloadAttempts = parseInt(sessionStorage.getItem(reloadKey) || "0", 10);

            var urlOutOfDate = compareVersions(activeVersion, urlVersion || "0") !== 0;

            var visitOutOfDate = storedVersion && compareVersions(activeVersion, storedVersion) > 0;



            if ((urlOutOfDate || visitOutOfDate) && reloadAttempts < 2) {

                sessionStorage.setItem(reloadKey, String(reloadAttempts + 1));

                localStorage.setItem("dispatcher_app_version", activeVersion);

                pageUrl.searchParams.set("v", activeVersion);

                pageUrl.searchParams.set("_", String(Date.now()));

                window.location.replace(pageUrl.toString());

                return;

            }



            if (!urlOutOfDate && !visitOutOfDate && reloadAttempts > 0) {

                sessionStorage.removeItem(reloadKey);

            }



            localStorage.setItem("dispatcher_app_version", activeVersion);

        } catch (e2) {

            /* continue with APP_VERSION */

        }

    }



    window.DISPATCHER_APP_VERSION = activeVersion;

    window.dispatcherCompareVersions = compareVersions;

    window.dispatcherPickNewerVersion = pickNewerVersion;

    window.dispatcherAssetUrl = function (relativePath) {

        var url = relativePath;

        url += (url.indexOf("?") === -1 ? "?" : "&") + "v=" + encodeURIComponent(activeVersion);

        return url;

    };



    function loadScriptSync(relativePath) {

        var url = window.dispatcherAssetUrl(relativePath);

        if (useFileProtocol) {

            document.write('<script src="' + url + '"><\/script>');

            return;

        }

        var xhr = new XMLHttpRequest();

        xhr.open("GET", url, false);

        xhr.setRequestHeader("Cache-Control", "no-cache");

        xhr.setRequestHeader("Pragma", "no-cache");

        xhr.send(null);

        if (xhr.status < 200 || xhr.status >= 300) {

            console.error("Vector Flight Dispatch: failed to load " + relativePath + " (HTTP " + xhr.status + ")");

            return;

        }

        var tag = document.createElement("script");

        tag.text = xhr.responseText;

        document.head.appendChild(tag);

    }



    [

        "airports-asobo-db.js",

        "airports-thirdparty-db.js",

        "dispatch-engine.js",

        "fleet-db.js",

        "missions-db.js"

    ].forEach(loadScriptSync);

})();

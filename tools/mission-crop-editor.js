const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const root = path.resolve(__dirname, "..");
const imageDir = path.join(root, "images-missions");
const settingsFile = path.join(root, "settings.js");
const port = 4173;

function readSettings() {
    const source = fs.readFileSync(settingsFile, "utf8");
    const match = source.match(/^\s*window\.VECTOR_DEFAULT_SETTINGS\s*=\s*([\s\S]*);\s*window\.MISSION_IMAGE_CROPS\s*=\s*window\.VECTOR_DEFAULT_SETTINGS\.missionImageCrops;\s*$/);
    if (!match) throw new Error("settings.js has an unexpected format.");
    return JSON.parse(match[1]);
}

function writeSettings(settings) {
    fs.writeFileSync(settingsFile, `window.VECTOR_DEFAULT_SETTINGS = ${JSON.stringify(settings, null, 2)};\n\nwindow.MISSION_IMAGE_CROPS = window.VECTOR_DEFAULT_SETTINGS.missionImageCrops;\n`);
}

function files() {
    return fs.readdirSync(imageDir).filter((file) => /^mission\d+\.jpg$/i.test(file))
        .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
}

function crops() {
    try { return readSettings().missionImageCrops || {}; }
    catch (_) { return {}; }
}

function save(cropMap) {
    const validFiles = new Set(files());
    const safe = {};
    Object.entries(cropMap || {}).forEach(([file, crop]) => {
        const x = Number(crop && crop.x), y = Number(crop && crop.y), zoom = Number(crop && crop.zoom);
        if (validFiles.has(file) && Number.isFinite(x) && Number.isFinite(y)) {
            safe[file] = {
                x: Math.round(Math.max(0, Math.min(100, x))),
                y: Math.round(Math.max(0, Math.min(100, y))),
                zoom: Number.isFinite(zoom) ? Math.round(Math.max(100, Math.min(115, zoom))) : 100
            };
        }
    });
    const settings = readSettings();
    settings.missionImageCrops = safe;
    writeSettings(settings);
}

const page = `<!doctype html><meta charset="utf-8"><title>Mission Crop Editor</title><style>
body{margin:0;background:#111418;color:#e8ebee;font:16px Segoe UI,Arial,sans-serif}main{max-width:760px;margin:32px auto;padding:0 20px}.hint{color:#aeb7c0;line-height:1.45}.preview{position:relative;width:298px;height:220px;overflow:hidden;border-radius:10px;border:1px solid #58626c;background:#3a3f45 center/cover no-repeat;cursor:grab;touch-action:none}.preview:before{content:"";position:absolute;inset:0 0 auto;height:42px;background:linear-gradient(to bottom,#b9c2c9,#dce2e5);pointer-events:none}.preview.dragging{cursor:grabbing}.row{display:flex;gap:10px;margin:16px 0}.row button,.row input{padding:10px 14px;border:1px solid #63717e;border-radius:6px;background:#28313a;color:#fff;font-weight:600}.row button{cursor:pointer}.jump input{width:150px}.row .primary{background:#3f9e44;border-color:#348538}.sliders{display:grid;grid-template-columns:110px 1fr 45px;gap:10px;align-items:center;max-width:450px;margin:16px 0}.sliders input{width:100%}code{color:#b5d6ff}</style><main><h1>Mission Crop Editor</h1><p class="hint">Use zoom first if you need to move the image up or down. <b>Save & Next</b> writes to <code>settings.js</code>.</p><p id="status" class="hint"></p><div class="row jump"><input id="jump" type="number" min="1" placeholder="Mission image #"><button id="go">Go to mission</button></div><div id="preview" class="preview"></div><div class="sliders"><label>Zoom</label><input id="zoom" type="range" min="100" max="115"><output id="zoomv"></output><label>Left / right</label><input id="x" type="range" min="0" max="100"><output id="xv"></output><label>Up / down</label><input id="y" type="range" min="0" max="100"><output id="yv"></output></div><div class="row"><button id="previous">Previous</button><button id="reset">Reset to centre</button><button id="save" class="primary">Save & Next</button></div></main><script>
let files=[],crops={},index=0,drag=null;const $=id=>document.getElementById(id),preview=$("preview"),x=$("x"),y=$("y"),zoom=$("zoom");
function current(){return crops[files[index]]||{x:50,y:50,zoom:100}}function apply(c){preview.style.backgroundPosition=c.x+'% '+c.y+'%';preview.style.backgroundSize=c.zoom===100?'cover':'auto '+c.zoom+'%'}function render(){const c=current();preview.style.backgroundImage='url("/images-missions/'+files[index]+'")';apply(c);x.value=c.x;y.value=c.y;zoom.value=c.zoom;$("xv").textContent=c.x+'%';$("yv").textContent=c.y+'%';$("zoomv").textContent=c.zoom+'%';$("status").textContent=(index+1)+' of '+files.length+' — '+files[index];$("previous").disabled=index===0}function change(){const c={x:+x.value,y:+y.value,zoom:+zoom.value};crops[files[index]]=c;apply(c);$("xv").textContent=c.x+'%';$("yv").textContent=c.y+'%';$("zoomv").textContent=c.zoom+'%'}async function saveNext(){change();await fetch('/api/crops',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({crops})});if(index<files.length-1){index++;render()}}function jumpToMission(){const number=$("jump").value.trim(),target='mission'+number+'.jpg',targetIndex=files.indexOf(target);if(targetIndex===-1){$("status").textContent='Mission image '+number+' is not available.';return}index=targetIndex;render()}x.oninput=change;y.oninput=change;zoom.oninput=change;$("previous").onclick=()=>{if(index){index--;render()}};$("reset").onclick=()=>{x.value=50;y.value=50;zoom.value=100;change()};$("save").onclick=saveNext;$("go").onclick=jumpToMission;$("jump").onkeydown=e=>{if(e.key==='Enter')jumpToMission()};preview.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,c:current()};preview.classList.add('dragging');preview.setPointerCapture(e.pointerId)};preview.onpointermove=e=>{if(!drag)return;const r=preview.getBoundingClientRect();x.value=Math.max(0,Math.min(100,Math.round(drag.c.x-(e.clientX-drag.x)/r.width*100)));y.value=Math.max(0,Math.min(100,Math.round(drag.c.y-(e.clientY-drag.y)/r.height*100)));change()};preview.onpointerup=preview.onpointercancel=()=>{drag=null;preview.classList.remove('dragging')};fetch('/api/state').then(r=>r.json()).then(s=>{files=s.files;crops=s.crops;render()});
</script>`;

const ticketPreviewPage = page.replace(
    "width:298px;height:220px;overflow:hidden",
    "width:298px;height:252px;box-sizing:border-box;padding-top:42px;overflow:hidden"
).replace(
    "background:#3a3f45 center/cover no-repeat;cursor",
    "background:#3a3f45 center/cover no-repeat;background-origin:content-box;background-clip:content-box;cursor"
);

function saveTicketFx(value) {
    const modes = new Set(["crt-standard", "crt-military", "crt-vintage", "crt-business", "crt-commercial", "crt-regional", "crt-starship", "crt-helicopter"]);
    const clean = { groupDefaults: {}, aircraftOverrides: {}, matrixMissionRules: {} };
    ["groupDefaults", "aircraftOverrides"].forEach((key) => {
        Object.entries((value && value[key]) || {}).forEach(([id, mode]) => {
            if (modes.has(mode)) clean[key][String(id).toUpperCase()] = mode;
        });
    });
    Object.entries((value && value.matrixMissionRules) || {}).forEach(([id, rule]) => {
        if (/^\d+$/.test(id) && rule && rule.enabled === true) {
            clean.matrixMissionRules[id] = { enabled: true, variant: rule.variant === "monolith" ? "monolith" : "alien" };
        }
    });
    const settings = readSettings();
    settings.ticketFx = clean;
    writeSettings(settings);
}

function readRequestJson(req, callback) {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
        try { callback(null, JSON.parse(body)); }
        catch (error) { callback(error); }
    });
}

const editorFiles = new Set(["/ticket-fx-profiles.html", "/ticket-fx-profiles.js", "/settings.js", "/fleet-db.js", "/missions-db.js"]);

http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/") return res.end(ticketPreviewPage);
    if (req.method === "GET" && req.url === "/api/state") return res.end(JSON.stringify({ files: files(), crops: crops() }));
    if (req.method === "POST" && req.url === "/api/crops") {
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        return req.on("end", () => { try { save(JSON.parse(body).crops); res.end('{"ok":true}'); } catch (_) { res.statusCode = 400; res.end('{"ok":false}'); } });
    }
    if (req.method === "POST" && req.url === "/api/ticket-fx-settings") {
        return readRequestJson(req, (error, payload) => {
            try {
                if (error) throw error;
                saveTicketFx(payload && payload.ticketFx);
                res.setHeader("Content-Type", "application/json");
                res.end('{"ok":true}');
            } catch (_) {
                res.statusCode = 400;
                res.end('{"ok":false}');
            }
        });
    }
    if (req.method === "GET" && editorFiles.has(req.url)) {
        const target = path.join(root, req.url.slice(1));
        res.setHeader("Content-Type", req.url.endsWith(".html") ? "text/html; charset=utf-8" : "application/javascript; charset=utf-8");
        return fs.createReadStream(target).pipe(res);
    }
    const requested = path.normalize(decodeURIComponent(req.url || "")).replace(/^([.][.][\\/])+/, "");
    const target = path.join(root, requested);
    if (req.method === "GET" && target.startsWith(imageDir) && fs.existsSync(target)) return fs.createReadStream(target).pipe(res);
    res.statusCode = 404; res.end("Not found");
}).listen(port, () => {
    const ticketFxMode = process.argv[2] === "ticket-fx";
    const url = ticketFxMode ? `http://localhost:${port}/ticket-fx-profiles.html` : `http://localhost:${port}`;
    console.log(`${ticketFxMode ? "Ticket FX Profiles" : "Mission Crop Editor"}: ${url}`);
    if (process.platform === "win32" && process.env.VECTOR_NO_OPEN !== "1") exec(`start "" "${url}"`);
});

import fs from "fs";
import path from "path";
import vm from "vm";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const code = fs.readFileSync(path.join(ROOT, "missions-db.js"), "utf8");
const sandbox = { globalThis: {} };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const ids = [];
for (const pool of Object.values(sandbox.scenarioDB)) {
    for (const s of pool) ids.push(s.imgId);
}
const unique = [...new Set(ids)].sort((a, b) => a - b);
const expected = Array.from({ length: unique.length }, (_, i) => i + 1);
const gaps = expected.filter((n) => !unique.includes(n));
const extras = unique.filter((n) => n < 1 || n > unique.length);
const dupRows = ids.length - unique.length;

const images = fs.readdirSync(path.join(ROOT, "images-missions"))
    .filter((f) => /^mission\d+\.jpg$/i.test(f))
    .map((f) => parseInt(f.match(/\d+/)[0], 10));
const imgSet = new Set(images);
const missingImg = unique.filter((id) => !imgSet.has(id));
const orphanImg = images.filter((id) => !unique.includes(id)).sort((a, b) => a - b);

console.log(JSON.stringify({
    scenarioRows: ids.length,
    uniqueImgIds: unique.length,
    min: unique[0],
    max: unique[unique.length - 1],
    consecutive: gaps.length === 0 && extras.length === 0,
    gaps,
    duplicateRowRefs: dupRows,
    missingImages: missingImg,
    orphanImages: orphanImg,
}, null, 2));

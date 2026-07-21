/**
 * One-off export: airports-thirdparty-db.js → airports-thirdparty-map.csv
 * Run: node scripts/export-thirdparty-airports-csv.js
 */
const fs = require("fs");
const path = require("path");

function csvEscape(value) {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const root = path.join(__dirname, "..", "..");
const dbPath = path.join(root, "airports-thirdparty-db.js");
const outPath = path.join(root, "Vector-Dev-Tools", "airports-thirdparty-map.csv");

const content = fs.readFileSync(dbPath, "utf8");
eval(content);

const seen = new Map();
for (const row of seedThirdPartyAirportDatabase) {
  if (!seen.has(row.icao)) seen.set(row.icao, row);
}

const airports = Array.from(seen.values()).sort((a, b) =>
  a.icao.localeCompare(b.icao)
);

const lines = ["ICAO,Name,Latitude,Longitude"];
for (const a of airports) {
  lines.push(
    [csvEscape(a.icao), csvEscape(a.name), csvEscape(a.lat), csvEscape(a.lon)].join(",")
  );
}

fs.writeFileSync(outPath, lines.join("\r\n") + "\r\n", "utf8");
console.log(`Wrote ${airports.length} rows to ${path.basename(outPath)}`);

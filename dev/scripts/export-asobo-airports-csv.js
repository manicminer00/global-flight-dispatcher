/**
 * Export airports-asobo-db.js → three Google Maps CSV files (deduplicated by ICAO).
 * Run: node scripts/export-asobo-airports-csv.js
 */
const fs = require("fs");
const path = require("path");

function csvEscape(value) {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function dedupeByIcao(rows) {
  const seen = new Map();
  for (const row of rows) {
    if (!seen.has(row.icao)) seen.set(row.icao, row);
  }
  return Array.from(seen.values()).sort((a, b) => a.icao.localeCompare(b.icao));
}

function writeCsv(outPath, airports) {
  const lines = ["ICAO,Name,Latitude,Longitude"];
  for (const a of airports) {
    lines.push(
      [csvEscape(a.icao), csvEscape(a.name), csvEscape(a.lat), csvEscape(a.lon)].join(",")
    );
  }
  fs.writeFileSync(outPath, lines.join("\r\n") + "\r\n", "utf8");
}

const root = path.join(__dirname, "..", "..");
const dbPath = path.join(root, "airports-asobo-db.js");
const content = fs.readFileSync(dbPath, "utf8");
eval(content);

const categories = [
  { tag: "Hand-Crafted", file: "airports-asobo-handcrafted-map.csv" },
  { tag: "Asobo Gliderport", file: "airports-asobo-gliders-map.csv" },
  { tag: "Asobo Detailed Airports", file: "airports-asobo-small-detailed-map.csv" },
];

for (const { tag, file } of categories) {
  const rows = seedAsoboAirportDatabase.filter((r) => r.tag === tag);
  const airports = dedupeByIcao(rows);
  const outPath = path.join(root, file);
  writeCsv(outPath, airports);
  console.log(`Wrote ${airports.length} rows to ${file}`);
}

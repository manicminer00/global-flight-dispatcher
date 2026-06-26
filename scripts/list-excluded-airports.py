"""List airports from airport-list.txt not included in airports-gliders-db.js."""
import json
import re
from pathlib import Path

from germany_batch_lib import parse_line

ROOT = Path(__file__).resolve().parent
LIST = ROOT / "airport-list.txt"
DB = ROOT.parent / "airports-gliders-db.js"

lines = LIST.read_text(encoding="utf-8").splitlines()
list_airports: list[tuple[int, str, str]] = []
unparsed_lines: list[tuple[int, str]] = []
for i, line in enumerate(lines, 1):
    parsed = parse_line(line)
    if parsed:
        list_airports.append((i, parsed[0], parsed[1]))
    elif line.strip():
        unparsed_lines.append((i, line.strip()))

db_icaos = set(re.findall(r'icao: "([^"]+)"', DB.read_text(encoding="utf-8")))

excluded: dict[str, dict] = {}
for jf in sorted(ROOT.glob("*-airports-built.json")):
    data = json.loads(jf.read_text(encoding="utf-8"))
    for item in data.get("excluded", []):
        if isinstance(item, dict) and item.get("icao"):
            code = item["icao"]
            excluded[code] = {
                "reason": item.get("reason", ""),
                "name": item.get("name") or (item.get("partial") or {}).get("name", ""),
                "source": jf.name,
            }
        elif isinstance(item, str):
            code = item.split(" - ")[0].split()[0].strip()
            if code:
                excluded[code] = {"reason": item, "name": "", "source": jf.name}

# Generator documented exclusions (may duplicate JSON)
GEN_EXCLUDED = [
    ("6HSKG", "Saint David Gliderfield (no FAA record at MSFS identifier)"),
    ("8HSGR", "Antelope Valley Soaring Club (no FAA record at MSFS identifier)"),
    ("CNETS", "London Soaring Club (Embro field closed)"),
    ("CYPI", "Brougham (not in Canada Flight Supplement)"),
    ("ED48", "Schwann-Conweiler (no published runway length)"),
    ("EDIUY", "Schnuckenheide-Repke (closed 2015)"),
    ("EDKRB", "Merkers Mine Experience (not an aviation facility)"),
    ("EDONR", "Ochsenhausen (closed)"),
    ("EDRSG", "Sundern-Seidfeld (closed 2006)"),
    ("EDUIN", "Kleve-Wisseler Dünen (closed)"),
    ("EDVS", "Salzgitter-Drütte (closed Dec 2025)"),
    ("EG50", "Eight Ash Green (MSFS-only identifier)"),
    ("EHBI", "Biddinghuizen (closed in OurAirports)"),
    ("EIOHR", "Cloneygath (no OurAirports record)"),
    ("FAOHR", "Kroonstad Glider (no OurAirports glider-field record)"),
    ("LFKN", "Eauze (no DGAC/OurAirports record)"),
    ("SBIX", "Clube CEU (no OurAirports record)"),
    ("SBLF", "Goianira (no OurAirports record)"),
    ("SBNJ", "Barreiras (no OurAirports record)"),
    ("SOUTH", "South America section header"),
    ("USRER", "Aeroklub Almi (no registered airfield ICAO)"),
]
for code, reason in GEN_EXCLUDED:
    excluded.setdefault(code, {"reason": reason, "name": "", "source": "generate-gliders-js.py"})

list_codes = {c for _, c, _ in list_airports}
missing = sorted(list_codes - db_icaos)

print("SUMMARY")
print(f"  airport-list.txt lines:        {len(lines)}")
print(f"  Parsed ICAO codes:             {len(list_airports)}")
print(f"  Unparsed lines (headers):      {len(unparsed_lines)}")
print(f"  airports-gliders-db.js entries: {len(db_icaos)}")
print(f"  List codes in DB:              {len(list_codes & db_icaos)}")
print(f"  List codes NOT in DB:          {len(missing)}")
print()

print("EXCLUDED FROM airport-list.txt (not in airports-gliders-db.js)")
print("-" * 80)
for line_no, code, name in list_airports:
    if code not in db_icaos:
        ex = excluded.get(code, {})
        reason = ex.get("reason") or "unknown"
        print(f"{code}\tline {line_no}\t{name}\t{reason}")

if unparsed_lines:
    print()
    print("UNPARSED LINES (not treated as airports)")
    print("-" * 80)
    for i, text in unparsed_lines:
        print(f"line {i}\t{text}")

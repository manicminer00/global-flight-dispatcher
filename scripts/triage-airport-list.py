import re
import json
from pathlib import Path
from collections import Counter

ROOT = Path(__file__).resolve().parent.parent
LIST = ROOT / "scripts" / "airport-list.txt"
DB = ROOT / "airports-gliders-db.js"
OUT = ROOT / "scripts" / "triage-report.json"

lines = LIST.read_text(encoding="utf-8", errors="replace").splitlines()
existing = set(re.findall(r'icao: "([^"]+)"', DB.read_text(encoding="utf-8")))

entries = []
bad = []
for line in lines:
    line = line.strip()
    if not line or line.lower() == "south america":
        continue
    m = re.match(r"^([A-Z0-9]{2,6})\s+(.+)$", line, re.I)
    if m:
        entries.append({"icao": m.group(1).upper(), "name": m.group(2).strip()})
    else:
        bad.append(line)

codes = [e["icao"] for e in entries]
dupes = {c: n for c, n in Counter(codes).items() if n > 1}
already = [e for e in entries if e["icao"] in existing]
new = [e for e in entries if e["icao"] not in existing]


def bucket(c: str) -> str:
    if c.startswith("ED"):
        return "Germany"
    if c.startswith("EG"):
        return "UK"
    if c.startswith("LF"):
        return "France"
    if c.startswith(("EH", "EK", "EN", "EL", "EF")):
        return "Benelux/Nordics/Finland"
    if c.startswith("RJ") and len(c) > 4:
        return "Japan (MSFS custom codes)"
    if c.startswith("Y"):
        return "Australia"
    if re.match(r"^K[A-Z0-9]{2,3}$", c) or c in {
        "H07", "I64", "I99", "IL59", "ID36", "U14", "N82", "P15", "S36",
        "MT48", "LA54", "W73", "WN76", "VA85", "VG22", "FA42", "TE71",
        "TX23", "SC79", "WAKIF",
    }:
        return "USA"
    if c.startswith(("LI", "LK", "LE", "LS", "LO", "LH", "LR", "LZ", "LJ")):
        return "Central/Southern Europe"
    if c.startswith(("SB", "SA", "SC", "S3")):
        return "South America"
    if c.startswith(("EP", "ETT", "FA", "FY", "RC", "RP", "UA", "UG", "UK", "UL", "UM", "UP", "UR", "US", "UU")):
        return "Other international"
    return "Other"


by_region = Counter(bucket(e["icao"]) for e in new)
dupe_detail = {
    c: [e["name"] for e in entries if e["icao"] == c]
    for c in sorted(dupes)
}

report = {
    "total_in_file": len(entries),
    "already_in_database": len(already),
    "already_codes": sorted({e["icao"] for e in already}),
    "new_to_process": len(new),
    "bad_lines": bad,
    "duplicate_codes": dupe_detail,
    "new_by_region": dict(by_region.most_common()),
}

OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))

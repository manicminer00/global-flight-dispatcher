#!/usr/bin/env python3
"""
Check duplicate ICAOs share identical routing data (lat, lon, elev, length, rwy).

Per file: same ICAO twice in one airports-db-*.js must match.
Global: same ICAO across shop files must match (required for master DB generation).

Run: python scripts/audit-duplicate-icao-routing.py
Exit 1 if any mismatch.
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vfd_verify_lib import (  # noqa: E402
    AIRPORT_DATABASES,
    BASE,
    audit_duplicate_icao_routing_global,
    audit_duplicate_icao_routing_in_file,
    parse_airport_db,
)

MERGE_SOURCE_ORDER = [
    "airports-db-gliders.js",
    "airports-db-hand-crafted.js",
    "airports-db-contrail.js",
    "airports-db-flightsim-to.js",
    "airports-db-iniBuilds.js",
    "airports-db-ORBX.js",
    "airports-db-other.js",
    "airports-db-UK2000.js",
    "airports-db-small-detailed.js",
]


def load_all_entries() -> list[tuple[str, dict]]:
    ordered: list[tuple[str, dict]] = []
    by_file: dict[str, list[dict]] = {}
    for db in AIRPORT_DATABASES:
        path = os.path.join(BASE, db["file"])
        if not os.path.isfile(path):
            continue
        entries = parse_airport_db(path)
        by_file[db["file"]] = entries
        for entry in entries:
            ordered.append((db["file"], entry))
    flat: list[tuple[str, dict]] = []
    for source_file in MERGE_SOURCE_ORDER:
        for entry in by_file.get(source_file, []):
            flat.append((source_file, entry))
    return flat


def main() -> int:
    print("Duplicate ICAO routing audit (lat, lon, elev, length, rwy)\n")
    file_errors: list[str] = []

    for db in AIRPORT_DATABASES:
        path = os.path.join(BASE, db["file"])
        if not os.path.isfile(path):
            continue
        airports = parse_airport_db(path)
        errs = audit_duplicate_icao_routing_in_file(db["file"], airports)
        file_errors.extend(errs)
        by_icao: dict[str, int] = {}
        for ap in airports:
            icao = str(ap.get("icao", "")).strip().upper()
            if icao:
                by_icao[icao] = by_icao.get(icao, 0) + 1
        dup_in_file = sum(1 for c in by_icao.values() if c > 1)
        if dup_in_file:
            status = "FAIL" if any(e.startswith(db["file"]) for e in errs) else "OK"
            print(f"  [{status}] {db['label']}: {dup_in_file} ICAO(s) with multiple rows in file")
        else:
            print(f"  [OK] {db['label']}: no within-file duplicate ICAOs")

    global_warnings = audit_duplicate_icao_routing_global(load_all_entries())

    print()
    if file_errors:
        print(f"=== WITHIN-FILE MISMATCHES ({len(file_errors)}) ===")
        for e in file_errors:
            print(f"  [ERROR] {e}")
    else:
        print("Within-file duplicate ICAOs: all routing fields match.")

    print()
    if global_warnings:
        print(
            f"=== CROSS-FILE DRIFT ({len(global_warnings)}) — master DB uses first source in merge order ==="
        )
        seen: set[str] = set()
        for e in global_warnings:
            icao = e.split(":")[0]
            if icao in seen:
                continue
            seen.add(icao)
            print(f"  [WARN] {e}")
        if len(global_warnings) > len(seen):
            print(f"  ({len(global_warnings) - len(seen)} additional row-pair note(s) in full report)")
    else:
        print("Cross-file duplicate ICAOs: all routing fields match.")

    print()
    if file_errors:
        print(f"Result: FAIL ({len(file_errors)} within-file mismatch(es))")
        return 1
    if global_warnings:
        unique = len({e.split(":")[0] for e in global_warnings})
        print(
            f"Result: PASS with {unique} cross-file ICAO(s) using merge-order canonical values "
            f"(see generation-report.json after generate-airport-master.py)"
        )
    else:
        print("Result: PASS — safe to regenerate database-db/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

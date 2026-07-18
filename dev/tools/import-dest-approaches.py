#!/usr/bin/env python3
"""Generate data/dest-approach-types.js from Navigraph approach procedures (non-ILS types)."""
from __future__ import annotations

import json
import sqlite3

from _navdata_common import DATA_DIR, ensure_data_dir, find_sqlite, vector_icaos

OUT = DATA_DIR / "dest-approach-types.js"

APPROACH_DISPLAY_ORDER = ["RNAV", "GPS", "LOC", "TACAN", "VOR", "NDB", "LDA", "SDF", "MLS", "GLS", "IGS"]

TYPE_LABELS = {
    "RNAV": "RNAV",
    "GPS": "GPS",
    "ILS": "ILS",
    "LOCALIZER": "LOC",
    "LOC": "LOC",
    "LDA": "LDA",
    "SDF": "SDF",
    "VOR": "VOR",
    "VORDME": "VOR",
    "NDB": "NDB",
    "NDBDME": "NDB",
    "MLS": "MLS",
    "GLS": "GLS",
    "IGS": "IGS",
    "TCN": "TACAN",
}

ARINC_FIRST_LETTER = {
    "R": "RNAV",
    "I": "ILS",
    "L": "LOC",
    "V": "VOR",
    "N": "NDB",
    "G": "IGS",
    "P": "GPS",
    "D": "VOR",
    "B": "LOC",
    "S": "SDF",
    "X": "LDA",
}


def is_sid_or_star(type_name: str, suffix: str | None) -> bool:
    return (type_name or "").strip().upper() == "GPS" and (suffix or "").strip().upper() in ("A", "D")


def normalize_approach_label(type_name: str, arinc_name: str | None) -> str | None:
    raw = (type_name or "").strip().upper()
    if raw in TYPE_LABELS:
        return TYPE_LABELS[raw]
    arinc = (arinc_name or "").strip().upper()
    if arinc:
        return ARINC_FIRST_LETTER.get(arinc[0])
    return None


def sort_labels(labels: set[str]) -> list[str]:
    order = {label: idx for idx, label in enumerate(APPROACH_DISPLAY_ORDER)}
    return sorted(labels, key=lambda label: (order.get(label, 99), label))


def main() -> None:
    sqlite_path = find_sqlite()
    vector = vector_icaos()
    conn = sqlite3.connect(sqlite_path)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DISTINCT
            UPPER(TRIM(airport_ident)) AS icao,
            UPPER(TRIM(type)) AS type,
            arinc_name,
            suffix
        FROM approach
        WHERE airport_ident IS NOT NULL
          AND TRIM(airport_ident) != ''
        """
    )

    by_icao: dict[str, set[str]] = {}
    for icao, type_name, arinc_name, suffix in cur.fetchall():
        if not icao or icao not in vector:
            continue
        if is_sid_or_star(type_name, suffix):
            continue
        label = normalize_approach_label(type_name, arinc_name)
        if not label or label == "ILS":
            continue
        by_icao.setdefault(icao, set()).add(label)

    conn.close()

    output = {icao: sort_labels(labels) for icao, labels in sorted(by_icao.items()) if labels}
    ensure_data_dir()
    body = json.dumps(output, indent=4)
    OUT.write_text(
        "// AUTO-GENERATED — destination approach types (excludes ILS). "
        "Regenerate: python dev/tools/import-dest-approaches.py\n"
        f"// Source: {sqlite_path}\n"
        "var DEST_APPROACH_TYPES_BY_ICAO = " + body + ";\n",
        encoding="utf-8",
    )
    print(f"Airports with non-ILS approaches (VECTOR matched): {len(output)}")
    if "EDQG" in output:
        print(f"EDQG sample: {output['EDQG']}")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()

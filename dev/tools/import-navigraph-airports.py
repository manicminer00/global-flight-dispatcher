#!/usr/bin/env python3
"""Generate data/navigraph-airport-icaos.js from Little Navmap Navigraph SQLite (airport table)."""
from __future__ import annotations

import json
import sqlite3

from _navdata_common import DATA_DIR, ensure_data_dir, find_sqlite, vector_icaos

OUT = DATA_DIR / "navigraph-airport-icaos.js"


def main() -> None:
    sqlite_path = find_sqlite()
    conn = sqlite3.connect(sqlite_path)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DISTINCT UPPER(TRIM(ident)) AS icao
        FROM airport
        WHERE ident IS NOT NULL
          AND TRIM(ident) != ''
        """
    )
    navigraph = {row[0] for row in cur.fetchall() if row[0]}
    conn.close()

    matched = sorted(vector_icaos() & navigraph)
    ensure_data_dir()
    body = json.dumps(matched, indent=4)
    OUT.write_text(
        "// AUTO-GENERATED — Navigraph airport navdata. Regenerate: python dev/tools/import-navigraph-airports.py\n"
        f"// Source: {sqlite_path}\n"
        "var NAVIGRAPH_AIRPORT_ICAOS = new Set(" + body + ");\n",
        encoding="utf-8",
    )
    print(f"Navigraph airports: {len(navigraph)}")
    print(f"VECTOR matched: {len(matched)}")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()

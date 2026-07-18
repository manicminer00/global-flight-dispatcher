#!/usr/bin/env python3
"""Generate data/ils-strict-icaos.js from Little Navmap Navigraph SQLite (strict ILS: types U,1,2,3)."""
from __future__ import annotations

import json
import sqlite3

from _navdata_common import DATA_DIR, ensure_data_dir, find_sqlite, vector_icaos

OUT = DATA_DIR / "ils-strict-icaos.js"
STRICT_TYPES = ("U", "1", "2", "3")


def main() -> None:
    sqlite_path = find_sqlite()
    conn = sqlite3.connect(sqlite_path)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DISTINCT UPPER(TRIM(loc_airport_ident)) AS icao
        FROM ils
        WHERE loc_airport_ident IS NOT NULL
          AND TRIM(loc_airport_ident) != ''
          AND type IN (?, ?, ?, ?)
        """,
        STRICT_TYPES,
    )
    strict = {row[0] for row in cur.fetchall() if row[0]}
    conn.close()

    matched = sorted(vector_icaos() & strict)
    ensure_data_dir()
    body = json.dumps(matched, indent=4)
    OUT.write_text(
        "// AUTO-GENERATED — strict ILS (LOC + glideslope). Regenerate: python dev/tools/import-ils-strict.py\n"
        f"// Source: {sqlite_path}\n"
        "var ILS_STRICT_AIRPORT_ICAOS = new Set(" + body + ");\n",
        encoding="utf-8",
    )
    print(f"Navigraph strict ILS: {len(strict)}")
    print(f"VECTOR matched: {len(matched)}")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()

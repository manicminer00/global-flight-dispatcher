import sqlite3
from pathlib import Path

candidates = [
    Path(r"D:\CURSOR WORKSPACE\little_navmap_navigraph.sqlite"),
]
for p in candidates:
    if not p.is_file():
        continue
    print("DB:", p)
    conn = sqlite3.connect(p)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY 1")
    tables = [r[0] for r in cur.fetchall()]
    print("tables:", tables)
    if "approach" in tables:
        cur.execute("SELECT DISTINCT UPPER(TRIM(type)) FROM approach ORDER BY 1")
        print("approach types:", [r[0] for r in cur.fetchall()])
        cur.execute(
            "SELECT airport_ident, arinc_name, type FROM approach WHERE UPPER(TRIM(type))='TCN' LIMIT 15"
        )
        print("TCN approach sample:", cur.fetchall())
        cur.execute(
            "SELECT COUNT(DISTINCT airport_ident) FROM approach WHERE UPPER(TRIM(type))='TCN'"
        )
        print("TCN airport count:", cur.fetchone()[0])
    for tbl in ("vor", "ndb"):
        if tbl not in tables:
            continue
        cur.execute(f"PRAGMA table_info({tbl})")
        cols = [c[1] for c in cur.fetchall()]
        print(tbl, "cols:", cols)
        if "type" in cols:
            cur.execute(f"SELECT DISTINCT UPPER(TRIM(type)) FROM {tbl}")
            print(tbl, "types:", [r[0] for r in cur.fetchall()])
        if tbl == "vor" and "ident" in cols and "airport_ident" in cols:
            cur.execute(
                "SELECT airport_ident, ident, type FROM vor WHERE UPPER(TRIM(type)) IN ('T','TC','VTT','VTH','VTL') LIMIT 15"
            )
            print("vor tac-like sample:", cur.fetchall())
            cur.execute(
                "SELECT airport_ident, ident, type FROM vor WHERE UPPER(TRIM(airport_ident))='KLSV' LIMIT 10"
            )
            print("KLSV vor:", cur.fetchall())
            cur.execute(
                "SELECT airport_ident, ident, type FROM vor WHERE UPPER(TRIM(airport_ident))='KADW' LIMIT 10"
            )
            print("KADW vor:", cur.fetchall())
    conn.close()
    break
else:
    print("no db found")

# spot checks
if candidates[0].is_file():
    conn = sqlite3.connect(candidates[0])
    cur = conn.cursor()
    for icao in ("KLSV", "KADW", "EGXP", "PAKT"):
        cur.execute(
            "SELECT type, arinc_name FROM approach WHERE UPPER(TRIM(airport_ident))=?",
            (icao,),
        )
        print(icao, "approaches:", cur.fetchall())
        cur.execute(
            "SELECT ident, type FROM vor WHERE UPPER(TRIM(airport_ident))=?",
            (icao,),
        )
        print(icao, "vor:", cur.fetchall())
    conn.close()

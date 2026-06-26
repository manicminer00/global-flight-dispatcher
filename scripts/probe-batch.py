"""Probe batch airports against OurAirports."""
import csv
import sys
from pathlib import Path

from germany_batch_lib import parse_batch_by_file_lines

ROOT = Path(__file__).resolve().parent
START_LINE = int(sys.argv[1]) if len(sys.argv) > 1 else 402
BATCH_SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 50


def main():
    batch = parse_batch_by_file_lines(START_LINE, BATCH_SIZE)
    by_code = {}
    with (ROOT / "ourairports-airports.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            for key in ("ident", "gps_code", "local_code", "iata_code", "icao_code"):
                code = (row.get(key) or "").strip().upper()
                if code:
                    by_code.setdefault(code, row)

    for msfs, name in batch:
        row = by_code.get(msfs)
        if row and row.get("iso_country") == "DE" and row.get("type") != "closed":
            print(f"OK  {msfs}  {row['ident']}  {row['name'][:50]}")
        else:
            print(f"MISS {msfs}  {name[:55]}")


if __name__ == "__main__":
    main()

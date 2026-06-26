"""One-off helper to print MSFS -> real-world ICAO map from alias tables + OurAirports."""
import ast
import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def irl_from_row(row: dict) -> str | None:
    for key in ("icao_code", "gps_code", "local_code", "iata_code"):
        code = (row.get(key) or "").strip().upper()
        if re.match(r"^[A-Z0-9]{4}$", code) and not code.startswith("DE-"):
            return code
    return None


def collect_aliases() -> dict[str, str]:
    aliases: dict[str, str] = {}
    for path in sorted(ROOT.glob("build-*.py")):
        text = path.read_text(encoding="utf-8")
        match = re.search(r"ICAO_ALIASES = \{([^}]+)\}", text, re.S)
        if not match:
            continue
        aliases.update(ast.literal_eval("{" + match.group(1) + "}"))
    return aliases


def build_map() -> dict[str, str]:
    by_ident: dict[str, dict] = {}
    with (ROOT / "ourairports-airports.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            by_ident[row["ident"].upper()] = row

    mapping: dict[str, str] = {}
    for msfs, oa in collect_aliases().items():
        row = by_ident.get(oa.upper())
        if not row:
            continue
        irl = irl_from_row(row)
        if irl and irl != msfs:
            mapping[msfs] = irl
    return mapping


if __name__ == "__main__":
    mapping = build_map()
    print(f"{len(mapping)} IRL mappings")
    for key, value in sorted(mapping.items()):
        print(f'    "{key}": "{value}",')

#!/usr/bin/env python3
"""
Build experimental split airport databases under database-db/ (not loaded by the app).

Reads the nine root-level airports-db-*.js files and writes:
  database-db/airports-db-master.js       — one row per ICAO (routing fields)
  database-db/airports-scenery-<shop>.js  — slim scenery rows per source file

Run from project root:
  python scripts/generate-airport-master.py

Does NOT modify loader.js or dispatch-engine.js.
"""
from __future__ import annotations

import json
import os
import re
import sys
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vfd_verify_lib import (  # noqa: E402
    AIRPORT_DATABASES,
    BASE,
    MSFS_ICAO_PRIORITY_DATABASES,
    audit_duplicate_icao_routing_in_file,
    parse_airport_db,
    routing_fields_match,
    routing_snapshot,
)

OUT_DIR = os.path.join(BASE, "database-db")

# Mirrors dispatch-engine.js getMergedSeedAirports() order (gliders prepended, then main list).
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

SCENERY_SLUG = {
    "airports-db-hand-crafted.js": "hand-crafted",
    "airports-db-contrail.js": "contrail",
    "airports-db-flightsim-to.js": "flightsim-to",
    "airports-db-iniBuilds.js": "inibuilds",
    "airports-db-ORBX.js": "orbx",
    "airports-db-other.js": "other",
    "airports-db-UK2000.js": "uk2000",
    "airports-db-gliders.js": "gliders",
    "airports-db-small-detailed.js": "small-detailed",
}

SCENERY_VAR = {
    "airports-db-hand-crafted.js": "seedHandCraftedSceneryDatabase",
    "airports-db-contrail.js": "seedContrailSceneryDatabase",
    "airports-db-flightsim-to.js": "seedFlightsimToSceneryDatabase",
    "airports-db-iniBuilds.js": "seediniBuildsSceneryDatabase",
    "airports-db-ORBX.js": "seedORBXSceneryDatabase",
    "airports-db-other.js": "seedOtherSceneryDatabase",
    "airports-db-UK2000.js": "seedUK2000SceneryDatabase",
    "airports-db-gliders.js": "seedGliderSceneryDatabase",
    "airports-db-small-detailed.js": "seedSmallDetailedSceneryDatabase",
}


def js_str(value: str) -> str:
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def num(value: int | float) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def apply_routing_overlay(master: dict[str, Any], entry: dict[str, Any], source_file: str) -> list[str]:
    """Second+ sighting of an ICAO — scenery only; routing stays first-seen (merge order)."""
    notes: list[str] = []
    icao = master["icao"]
    ok, field = routing_fields_match(master, entry)
    if not ok:
        notes.append(
            f"{icao}: cross-file drift on {field} — keeping {master.get('_firstSource', 'first')} "
            f"({routing_snapshot(master)}), ignored {source_file} ({routing_snapshot(entry)})"
        )
        return notes

    if entry.get("isMilitary"):
        master["isMilitary"] = True

    if source_file in MSFS_ICAO_PRIORITY_DATABASES and entry.get("name"):
        master["name"] = entry["name"]
    elif not master.get("name") and entry.get("name"):
        master["name"] = entry["name"]

    return notes


def routing_row_from(entry: dict[str, Any]) -> dict[str, Any]:
    row: dict[str, Any] = {
        "icao": entry["icao"].strip().upper(),
        "name": entry.get("name", ""),
        "rwy": entry.get("rwy", "GA"),
    }
    for key in ("length", "elev", "lat", "lon"):
        if entry.get(key) is not None:
            row[key] = entry[key]
    if entry.get("isMilitary"):
        row["isMilitary"] = True
    return row


def format_master_entry(row: dict[str, Any]) -> str:
    parts = [
        f"icao: {js_str(row['icao'])}",
        f"name: {js_str(row['name'])}",
        f"rwy: {js_str(row['rwy'])}",
    ]
    if row.get("length") is not None:
        parts.append(f"length: {num(row['length'])}")
    if row.get("elev") is not None:
        parts.append(f"elev: {num(row['elev'])}")
    if row.get("lat") is not None:
        parts.append(f"lat: {num(row['lat'])}")
    if row.get("lon") is not None:
        parts.append(f"lon: {num(row['lon'])}")
    if row.get("isMilitary"):
        parts.append("isMilitary: true")
    return "{ " + ", ".join(parts) + " }"


def format_scenery_entry(row: dict[str, Any]) -> str:
    parts = [f"icao: {js_str(row['icao'])}"]
    if row.get("linkText"):
        parts.append(f"linkText: {js_str(row['linkText'])}")
    if row.get("url"):
        parts.append(f"url: {js_str(row['url'])}")
    if row.get("tag"):
        parts.append(f"tag: {js_str(row['tag'])}")
    if row.get("source"):
        parts.append(f"source: {js_str(row['source'])}")
    return "{ " + ", ".join(parts) + " }"


def load_all_sources() -> tuple[list[tuple[str, dict[str, Any]]], dict[str, list[dict[str, Any]]]]:
    """Return (ordered routing entries, scenery rows per source file)."""
    ordered: list[tuple[str, dict[str, Any]]] = []
    scenery_by_file: dict[str, list[dict[str, Any]]] = {}

    file_order = {name: idx for idx, name in enumerate(MERGE_SOURCE_ORDER)}
    for db in sorted(AIRPORT_DATABASES, key=lambda d: file_order.get(d["file"], 999)):
        path = os.path.join(BASE, db["file"])
        if not os.path.isfile(path):
            continue
        entries = parse_airport_db(path)
        scenery_rows: list[dict[str, Any]] = []
        seen_links: set[tuple[str, str]] = set()

        for entry in entries:
            icao = str(entry.get("icao", "")).strip().upper()
            if not icao:
                continue
            entry["icao"] = icao
            ordered.append((db["file"], dict(entry)))

            link_key = (icao, str(entry.get("linkText", "")).strip().lower())
            if link_key in seen_links:
                continue
            seen_links.add(link_key)
            scenery_rows.append({
                "icao": icao,
                "linkText": entry.get("linkText", ""),
                "url": entry.get("url", ""),
                "tag": entry.get("tag", ""),
                "source": entry.get("source", db["label"]),
            })

        scenery_by_file[db["file"]] = scenery_rows

    # Re-order flat list to exact MERGE_SOURCE_ORDER
    by_file: dict[str, list[dict[str, Any]]] = {}
    for source_file, entry in ordered:
        by_file.setdefault(source_file, []).append(entry)
    ordered_flat: list[tuple[str, dict[str, Any]]] = []
    for source_file in MERGE_SOURCE_ORDER:
        for entry in by_file.get(source_file, []):
            ordered_flat.append((source_file, entry))

    return ordered_flat, scenery_by_file


def build_master(ordered_entries: list[tuple[str, dict[str, Any]]]) -> tuple[list[dict[str, Any]], list[str]]:
    master: dict[str, dict[str, Any]] = {}
    conflicts: list[str] = []

    for source_file, entry in ordered_entries:
        icao = entry["icao"]
        if icao not in master:
            master[icao] = routing_row_from(entry)
            master[icao]["_firstSource"] = source_file
            continue
        conflicts.extend(apply_routing_overlay(master[icao], entry, source_file))

    rows = [master[k] for k in sorted(master.keys())]
    for row in rows:
        row.pop("_firstSource", None)
    return rows, conflicts


def write_master_js(rows: list[dict[str, Any]], path: str) -> None:
    lines = [
        "// AUTO-GENERATED by scripts/generate-airport-master.py — experimental; not loaded by the app.",
        f"// {len(rows)} unique ICAOs. Routing fields only (no scenery URLs).",
        "const seedMasterAirportDatabase = [",
    ]
    for row in rows:
        lines.append(format_master_entry(row) + ",")
    lines.append("];")
    lines.append("")
    open(path, "w", encoding="utf-8", newline="\n").write("\n".join(lines))


def write_scenery_js(source_file: str, rows: list[dict[str, Any]], path: str) -> None:
    label = next((d["label"] for d in AIRPORT_DATABASES if d["file"] == source_file), source_file)
    var_name = SCENERY_VAR[source_file]
    lines = [
        "// AUTO-GENERATED by scripts/generate-airport-master.py — experimental; not loaded by the app.",
        f"// {label}: {len(rows)} scenery link(s). ICAO + developer/link only — no routing fields.",
        f"const {var_name} = [",
    ]
    for row in rows:
        lines.append(format_scenery_entry(row) + ",")
    lines.append("];")
    lines.append("")
    open(path, "w", encoding="utf-8", newline="\n").write("\n".join(lines))


def run_within_file_audit(ordered_entries: list[tuple[str, dict[str, Any]]]) -> list[str]:
    errors: list[str] = []
    by_file: dict[str, list[dict[str, Any]]] = {}
    for source_file, entry in ordered_entries:
        by_file.setdefault(source_file, []).append(entry)
    for source_file, rows in by_file.items():
        errors.extend(audit_duplicate_icao_routing_in_file(source_file, rows))
    return errors


def main() -> int:
    os.makedirs(OUT_DIR, exist_ok=True)

    ordered, scenery_by_file = load_all_sources()

    audit_errors = run_within_file_audit(ordered)
    if audit_errors:
        print("Within-file routing audit failed:")
        for err in audit_errors[:50]:
            print(f"  [ERROR] {err}")
        if len(audit_errors) > 50:
            print(f"  ... and {len(audit_errors) - 50} more")
        return 1

    master_rows, conflicts = build_master(ordered)
    cross_file_drift = [c for c in conflicts if "cross-file drift" in c]

    master_path = os.path.join(OUT_DIR, "airports-db-master.js")
    write_master_js(master_rows, master_path)

    scenery_counts: dict[str, int] = {}
    for source_file in MERGE_SOURCE_ORDER:
        slug = SCENERY_SLUG.get(source_file)
        if not slug:
            continue
        rows = scenery_by_file.get(source_file, [])
        out_path = os.path.join(OUT_DIR, f"airports-scenery-{slug}.js")
        write_scenery_js(source_file, rows, out_path)
        scenery_counts[source_file] = len(rows)

    source_rows = sum(scenery_counts.values())
    report = {
        "generatedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        ),
        "outputDir": "database-db",
        "uniqueIcaos": len(master_rows),
        "sourceRowsTotal": len(ordered),
        "sceneryRowsByFile": scenery_counts,
        "sceneryRowsTotal": source_rows,
        "mergeConflicts": cross_file_drift[:500],
        "mergeConflictCount": len(cross_file_drift),
        "crossFileDriftCount": len(cross_file_drift),
        "routingAudit": "within-file pass",
        "note": "ICAO values copied verbatim from source files — never normalized to real-world codes.",
    }
    report_path = os.path.join(OUT_DIR, "generation-report.json")
    with open(report_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
        fh.write("\n")

    print(f"Wrote {master_path} ({len(master_rows)} ICAOs)")
    for source_file, count in scenery_counts.items():
        slug = SCENERY_SLUG[source_file]
        print(f"  airports-scenery-{slug}.js — {count} rows")
    print(f"Report: {report_path}")
    if cross_file_drift:
        print(f"Cross-file drift notes: {len(cross_file_drift)} (canonical = merge order; see generation-report.json)")
    else:
        print("Cross-file drift: none")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

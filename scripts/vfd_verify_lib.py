"""
Shared helpers for Vector Flight Dispatch verification (vfd-verify.py).

Verification state lives in scripts/verification-manifest.json so runtime
dispatch logic is not affected. Optional --mark-verified stamps internal tags
into source files (_vfVerified on fleet, vfVerified on missions, file header on airports).
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from typing import Any

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST_PATH = os.path.join(BASE, "scripts", "verification-manifest.json")

VALID_RWY = frozenset({"GA", "TURBO", "BIZ JET", "JET", "HELI", "GLIDER"})
VALID_FLEET_CLASS = frozenset({"GA", "TURBO", "BIZ JET", "JET", "HELI", "GLIDER", "WARBIRD"})
FLEET_REFERENCE_PATH = os.path.join(BASE, "scripts", "fleet-reference.json")

AIRPORT_AUDIT_FIELDS = (
    "ICAO (3–4 chars)",
    "name",
    "rwy (GA/TURBO/BIZ JET/JET/HELI/GLIDER)",
    "runway length (ft)",
    "elevation (ft MSL)",
    "latitude / longitude (valid range, not 0,0)",
    "exact duplicate lines (same object twice)",
)

# Asobo database uses MSFS sim identifiers (e.g. 03G, 02FA) that must never be
# normalized to real-world ICAOs. Third-party uses standard real-world ICAO codes.
MSFS_ICAO_PRIORITY_DATABASES = frozenset({
    "airports-asobo-db.js",
})

ICAO_POLICY = (
    "Never normalize or replace airport icao values during verification or data fixes. "
    "MSFS custom / sim identifiers in airports-asobo-db.js must stay exactly as stored. "
    "Do not substitute real-world ICAOs from FAA, OurAirports, "
    "or name suffixes such as (IRL: XXXX)."
)

AIRPORT_DATABASES = [
    {
        "menu": 1,
        "file": "airports-asobo-db.js",
        "label": "Asobo / MSFS (Gliders, Hand-crafted, Small Detailed)",
        "var": "seedAsoboAirportDatabase",
    },
    {
        "menu": 2,
        "file": "airports-thirdparty-db.js",
        "label": "Third-Party (Contrail, ORBX, iniBuilds, UK2000, Flightsim.to, Other)",
        "var": "seedThirdPartyAirportDatabase",
    },
]

# Variable names that were used in the old split-database layout and must no longer
# appear in dispatch-engine.js or loader.js after consolidation.
LEGACY_AIRPORT_VAR_NAMES = frozenset({
    "seedHandCraftedAirportDatabase",
    "seedContrailDatabase",
    "seedFlightsimToDatabase",
    "seediniBuildsDatabase",
    "seedORBXDatabase",
    "seedOtherAirportDatabase",
    "seedUK2000Database",
    "seedGliderAirportDatabase",
    "seedSmallDetailedDatabase",
})

DEPLOY_FILES = [
    "loader.js",
    "version.json",
    "index.html",
    "DB Search.html",
    "dispatch-engine.js",
    "fleet-db.js",
    "missions-db.js",
    "airports-asobo-db.js",
    "airports-thirdparty-db.js",
    "favicon/site.webmanifest",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def file_checksum(path: str) -> str:
    data = open(path, "rb").read()
    return hashlib.sha256(data).hexdigest()


def load_manifest() -> dict[str, Any]:
    if not os.path.isfile(MANIFEST_PATH):
        return {"schema": 1, "airports": {}, "fleet": {}, "missions": {}, "code": {}}
    with open(MANIFEST_PATH, encoding="utf-8") as fh:
        return json.load(fh)


def save_manifest(manifest: dict[str, Any]) -> None:
    with open(MANIFEST_PATH, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")


def parse_airport_db(path: str) -> list[dict[str, Any]]:
    text = open(path, encoding="utf-8").read()
    airports: list[dict[str, Any]] = []
    for m in re.finditer(r"\{[^{}]+\}", text):
        raw = m.group(0)
        if "icao:" not in raw:
            continue
        line_no = text[: m.start()].count("\n") + 1
        ap: dict[str, Any] = {"_raw": raw, "_line": line_no}
        for key in ("icao", "name", "rwy", "source", "tag", "linkText", "url"):
            km = re.search(rf"{key}:\s*\"([^\"]*)\"", raw)
            if km:
                ap[key] = km.group(1)
        for key in ("length", "elev"):
            km = re.search(rf"{key}:\s*(-?\d+(?:\.\d+)?)", raw)
            if km:
                ap[key] = float(km.group(1)) if "." in km.group(1) else int(km.group(1))
        for key in ("lat", "lon"):
            km = re.search(rf"{key}:\s*(-?\d+(?:\.\d+)?)", raw)
            if km:
                ap[key] = float(km.group(1))
        if re.search(r"isMilitary:\s*true", raw):
            ap["isMilitary"] = True
        if re.search(r"vfVerified:\s*true", raw):
            ap["vfVerified"] = True
        airports.append(ap)
    return airports


def airport_entry_line_key(raw: str) -> str:
    """Normalize an airport object literal for exact 1:1 duplicate comparison."""
    return raw.strip().rstrip(",").strip()


ROUTING_COMPARE_KEYS = ("lat", "lon", "elev", "length", "rwy")
ROUTING_COORD_TOLERANCE = 0.001


def routing_snapshot(ap: dict[str, Any]) -> dict[str, Any]:
    return {k: ap.get(k) for k in ROUTING_COMPARE_KEYS}


def routing_fields_match(
    a: dict[str, Any], b: dict[str, Any], *, coord_tol: float = ROUTING_COORD_TOLERANCE
) -> tuple[bool, str | None]:
    for key in ROUTING_COMPARE_KEYS:
        av, bv = a.get(key), b.get(key)
        if av is None and bv is None:
            continue
        if av is None or bv is None:
            return False, key
        if key in ("lat", "lon"):
            if abs(float(av) - float(bv)) > coord_tol:
                return False, key
        elif av != bv:
            return False, key
    return True, None


def audit_duplicate_icao_routing_in_file(
    db_file: str, airports: list[dict[str, Any]]
) -> list[str]:
    """Same ICAO twice in one file must share lat, lon, elev, length, rwy."""
    errors: list[str] = []
    by_icao: dict[str, list[dict[str, Any]]] = {}
    for ap in airports:
        icao = str(ap.get("icao", "")).strip().upper()
        if not icao:
            continue
        by_icao.setdefault(icao, []).append(ap)

    for icao, rows in sorted(by_icao.items()):
        if len(rows) < 2:
            continue
        ref = rows[0]
        ref_line = int(ref.get("_line", 0))
        for row in rows[1:]:
            ok, field = routing_fields_match(ref, row)
            if ok:
                continue
            line = int(row.get("_line", 0))
            errors.append(
                f"{db_file}: {icao} duplicate routing mismatch on {field} "
                f"(line {ref_line} vs line {line}: "
                f"{routing_snapshot(ref)} vs {routing_snapshot(row)})"
            )
    return errors


def audit_duplicate_icao_routing_global(
    entries: list[tuple[str, dict[str, Any]]],
) -> list[str]:
    """Same ICAO in different source files must share routing fields."""
    errors: list[str] = []
    by_icao: dict[str, list[tuple[str, dict[str, Any]]]] = {}
    for source_file, ap in entries:
        icao = str(ap.get("icao", "")).strip().upper()
        if not icao:
            continue
        by_icao.setdefault(icao, []).append((source_file, ap))

    for icao, locs in sorted(by_icao.items()):
        if len(locs) < 2:
            continue
        ref_file, ref = locs[0]
        for src_file, row in locs[1:]:
            ok, field = routing_fields_match(ref, row)
            if ok:
                continue
            errors.append(
                f"{icao}: routing mismatch on {field} between {ref_file} "
                f"(line {ref.get('_line', '?')}) and {src_file} (line {row.get('_line', '?')}): "
                f"{routing_snapshot(ref)} vs {routing_snapshot(row)}"
            )
    return errors


def find_exact_line_duplicates(airports: list[dict[str, Any]]) -> list[str]:
    """Same ICAO from different sources is allowed; identical copy-pasted lines are not."""
    errors: list[str] = []
    by_key: dict[str, list[tuple[int, str]]] = {}
    for ap in airports:
        raw = str(ap.get("_raw", ""))
        key = airport_entry_line_key(raw)
        by_key.setdefault(key, []).append((int(ap.get("_line", 0)), str(ap.get("icao", "?"))))
    for key, locs in by_key.items():
        if len(locs) < 2:
            continue
        rows = ", ".join(f"line {ln} ({icao})" for ln, icao in locs)
        errors.append(f"Exact duplicate entry ({len(locs)} copies) — remove extras, keep one: {rows}")
    return errors


def remove_exact_duplicate_airport_lines(path: str) -> int:
    """Remove 1:1 duplicate airport object lines; keeps the first occurrence of each.

    ICAO values are never modified — only exact duplicate object literals are removed.
    """
    text = open(path, encoding="utf-8").read()
    seen: set[str] = set()
    removed = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal removed
        raw = match.group(0)
        if "icao:" not in raw:
            return raw
        key = airport_entry_line_key(raw)
        if key in seen:
            removed += 1
            return ""
        seen.add(key)
        return raw

    new_text = re.sub(r"\{[^{}]+\}", repl, text)
    new_text = re.sub(r",\s*,", ",", new_text)
    new_text = re.sub(r",\s*\n\s*,", ",\n", new_text)
    if removed:
        open(path, "w", encoding="utf-8", newline="\n").write(new_text)
    return removed


def airport_entry_fingerprint(ap: dict[str, Any]) -> str:
    """Hash of routing-critical airport fields; changes when data is edited."""
    parts = [
        str(ap.get("icao", "")).strip().upper(),
        str(ap.get("name", "")).strip(),
        str(ap.get("rwy", "")),
        str(ap.get("length")),
        str(ap.get("elev")),
        str(ap.get("lat")),
        str(ap.get("lon")),
    ]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:16]


def _airport_entry_record(manifest: dict[str, Any], db_file: str, icao: str) -> dict[str, Any] | None:
    raw = manifest.get("airports", {}).get(db_file, {}).get("entries", {}).get(icao.upper())
    if raw is True or raw is None:
        return None
    if isinstance(raw, dict) and raw.get("fp"):
        return raw
    return None


def is_airport_entry_verified(manifest: dict[str, Any], db_file: str, ap: dict[str, Any]) -> bool:
    icao = str(ap.get("icao", "")).strip().upper()
    if not icao:
        return False
    rec = _airport_entry_record(manifest, db_file, icao)
    if not rec:
        return False
    return rec.get("fp") == airport_entry_fingerprint(ap)


def count_airport_verification(
    manifest: dict[str, Any], db_file: str, airports: list[dict[str, Any]]
) -> tuple[int, int]:
    total = len(airports)
    verified = sum(1 for ap in airports if is_airport_entry_verified(manifest, db_file, ap))
    return verified, total


def airports_needing_audit(
    manifest: dict[str, Any], db_file: str, airports: list[dict[str, Any]], *, force: bool
) -> list[dict[str, Any]]:
    if force:
        return list(airports)
    return [ap for ap in airports if not is_airport_entry_verified(manifest, db_file, ap)]


def audit_single_airport(ap: dict[str, Any], *, idx: int = 0) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    icao = str(ap.get("icao", "")).strip().upper()
    label = icao or f"row {idx}"

    name = str(ap.get("name", "")).strip()
    irl_in_name = re.search(r"\(IRL:\s*([A-Z0-9]{3,4})\)", name, re.I)
    if irl_in_name and irl_in_name.group(1).upper() != icao:
        warnings.append(
            f"{icao}: name contains (IRL: {irl_in_name.group(1).upper()}) — keep icao as the "
            f"MSFS/sim code; do not replace with the real-world identifier"
        )

    if not icao or len(icao) < 3 or len(icao) > 4:
        errors.append(f"{label}: invalid ICAO (need 3–4 characters)")
        return errors, warnings

    if not name:
        errors.append(f"{icao}: missing airport name")

    rwy = ap.get("rwy")
    if rwy not in VALID_RWY:
        errors.append(f"{icao}: invalid rwy '{rwy}' (expected one of {sorted(VALID_RWY)})")

    lat = ap.get("lat")
    lon = ap.get("lon")
    if lat is None or lon is None or not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        errors.append(f"{icao}: missing or invalid lat/lon")
    else:
        if lat == 0 and lon == 0:
            errors.append(f"{icao}: lat/lon cannot both be 0")
        if lat < -90 or lat > 90:
            errors.append(f"{icao}: latitude out of range ({lat})")
        if lon < -180 or lon > 180:
            errors.append(f"{icao}: longitude out of range ({lon})")

    elev = ap.get("elev")
    if elev is None:
        errors.append(f"{icao}: missing elevation (elev, ft MSL)")
    elif not isinstance(elev, (int, float)):
        errors.append(f"{icao}: invalid elevation")
    elif elev < -1500 or elev > 30000:
        warnings.append(f"{icao}: unusual elevation ({elev} ft MSL) — confirm against charts")

    length = ap.get("length")
    if length is None:
        errors.append(f"{icao}: missing runway length")
    elif rwy == "HELI":
        if length < 0:
            errors.append(f"{icao}: helipad length cannot be negative")
    elif not isinstance(length, (int, float)) or length <= 0:
        errors.append(f"{icao}: runway length must be > 0 (or set rwy to HELI)")

    if rwy == "GLIDER" and isinstance(length, (int, float)) and length > 8000:
        warnings.append(f"{icao}: glider strip with unusually long runway ({length} ft)")

    if rwy == "JET" and isinstance(length, (int, float)) and length < 3000:
        warnings.append(f"{icao}: JET-capable airport with short runway ({length} ft)")

    return errors, warnings


def audit_airport_db(
    db_file: str,
    airports: list[dict[str, Any]],
    *,
    only: list[dict[str, Any]] | None = None,
) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    errors.extend(find_exact_line_duplicates(airports))
    targets = only if only is not None else airports
    for idx, ap in enumerate(targets, start=1):
        e, w = audit_single_airport(ap, idx=idx)
        errors.extend(e)
        warnings.extend(w)
    return errors, warnings


def is_airport_db_verified(manifest: dict[str, Any], db_file: str, checksum: str) -> bool:
    entry = manifest.get("airports", {}).get(db_file)
    if not entry:
        return False
    if entry.get("checksum") != checksum:
        return False
    if entry.get("verified") is not True:
        return False
    verified_count = entry.get("verifiedCount")
    entry_count = entry.get("entryCount")
    if verified_count is not None and entry_count is not None:
        return verified_count == entry_count and entry_count > 0
    return False


def merge_airport_verification(
    manifest: dict[str, Any],
    db_file: str,
    airports: list[dict[str, Any]],
    passed_icaos: set[str],
    *,
    stamp_file: bool = False,
) -> None:
    path = os.path.join(BASE, db_file)
    checksum = file_checksum(path)
    now = utc_now()
    entry = manifest.setdefault("airports", {}).setdefault(db_file, {})
    entries: dict[str, Any] = entry.setdefault("entries", {})
    for ap in airports:
        icao = str(ap.get("icao", "")).strip().upper()
        if not icao or icao not in passed_icaos:
            continue
        entries[icao] = {"fp": airport_entry_fingerprint(ap), "verifiedAt": now}
    verified, total = count_airport_verification(manifest, db_file, airports)
    entry["checksum"] = checksum
    entry["entryCount"] = total
    entry["verifiedCount"] = verified
    entry["verified"] = verified == total and total > 0
    if entry["verified"]:
        entry["verifiedAt"] = now
    if stamp_file:
        stamp_airport_file(path, checksum, total)
        for ap in airports:
            icao = str(ap.get("icao", "")).strip().upper()
            if icao in passed_icaos:
                stamp_airport_entry(path, icao)


def mark_airport_db_verified(manifest: dict[str, Any], db_file: str, airports: list[dict[str, Any]], stamp_file: bool = False) -> None:
    passed = {str(ap.get("icao", "")).strip().upper() for ap in airports if ap.get("icao")}
    merge_airport_verification(manifest, db_file, airports, passed, stamp_file=stamp_file)


def stamp_airport_file(path: str, checksum: str, count: int) -> None:
    text = open(path, encoding="utf-8").read()
    header = f"/* vfd-verified: {utc_now()} | sha256:{checksum[:16]} | entries:{count} */\n"
    text = re.sub(r"/\* vfd-verified:[^\n]*\*/\n", "", text)
    if not text.startswith("/* vfd-verified:"):
        text = header + text
    open(path, "w", encoding="utf-8", newline="\n").write(text)


def stamp_airport_entry(path: str, icao: str) -> None:
    text = open(path, encoding="utf-8").read()
    pattern = rf"(\{{[^{{}}]*icao:\s*\"{re.escape(icao)}\"[^{{}}]*)(\}})"
    m = re.search(pattern, text, re.I)
    if not m or "vfVerified:" in m.group(1):
        return
    replacement = m.group(1).rstrip() + ", vfVerified: true " + m.group(2)
    text = text[: m.start()] + replacement + text[m.end() :]
    open(path, "w", encoding="utf-8", newline="\n").write(text)


def run_subprocess(script: str, env: dict[str, str] | None = None) -> tuple[int, str]:
    proc = subprocess.run(
        [sys.executable, os.path.join(BASE, "scripts", script)],
        capture_output=True,
        text=True,
        cwd=BASE,
        env=env,
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    return proc.returncode, out


def parse_fleet_types() -> list[str]:
    return list(parse_fleet_full().keys())


def parse_fleet_full() -> dict[str, dict[str, Any]]:
    text = open(os.path.join(BASE, "fleet-db.js"), encoding="utf-8").read()
    fleet: dict[str, dict[str, Any]] = {}
    for m in re.finditer(r"\"([A-Z0-9_]+)\":\s*\{([^}]+)\}", text):
        code, body = m.group(1), m.group(2)
        spec: dict[str, Any] = {"tags": [], "name": ""}
        nm = re.search(r"\"name\":\s*\"([^\"]+)\"", body)
        if nm:
            spec["name"] = nm.group(1)
        cm = re.search(r"\"class\":\s*\"([^\"]+)\"", body)
        if cm:
            spec["class"] = cm.group(1)
        rm = re.search(r"\"rules\":\s*\"([^\"]+)\"", body)
        if rm:
            spec["rules"] = rm.group(1)
        sim = re.search(r"\"simbriefIcao\":\s*\"([^\"]+)\"", body)
        if sim:
            spec["simbriefIcao"] = sim.group(1)
        for key in (
            "maxPax",
            "maxCargo",
            "minD",
            "maxD",
            "minAlt",
            "maxAlt",
            "minRunwayLength",
            "mtow",
            "oew",
            "minCargo",
        ):
            km = re.search(rf"\"{key}\":\s*(\d+(?:\.\d+)?)", body)
            if km:
                spec[key] = float(km.group(1)) if "." in km.group(1) else int(km.group(1))
        fm = re.search(r"\"fuelPerNm\":\s*(\d+(?:\.\d+)?)", body)
        if fm:
            spec["fuelPerNm"] = float(fm.group(1))
        for flag in ("isMilitary", "isTactical"):
            if re.search(rf"\"{flag}\":\s*true", body):
                spec[flag] = True
        tags = re.search(r"\"tags\":\s*\[([^\]]+)\]", body)
        if tags:
            spec["tags"] = re.findall(r"\"([^\"]+)\"", tags.group(1))
        fleet[code] = spec
    return fleet


def fleet_entry_fingerprint(spec: dict[str, Any]) -> str:
    parts = [
        spec.get("name", ""),
        spec.get("class", ""),
        spec.get("rules", ""),
        str(spec.get("maxPax")),
        str(spec.get("maxCargo")),
        str(spec.get("minD")),
        str(spec.get("maxD")),
        str(spec.get("minAlt")),
        str(spec.get("maxAlt")),
        str(spec.get("minRunwayLength")),
        str(spec.get("mtow")),
        str(spec.get("oew")),
        str(spec.get("fuelPerNm")),
        ",".join(sorted(spec.get("tags") or [])),
    ]
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:16]


def _fleet_entry_record(manifest: dict[str, Any], ac_type: str) -> dict[str, Any] | None:
    raw = manifest.get("fleet", {}).get("aircraft", {}).get(ac_type)
    if raw is True or raw is None:
        return None
    if isinstance(raw, dict) and raw.get("fp"):
        return raw
    return None


def is_fleet_entry_verified(manifest: dict[str, Any], ac_type: str, spec: dict[str, Any]) -> bool:
    rec = _fleet_entry_record(manifest, ac_type)
    if not rec:
        return False
    return rec.get("fp") == fleet_entry_fingerprint(spec)


def count_fleet_verification(manifest: dict[str, Any], fleet: dict[str, dict[str, Any]]) -> tuple[int, int]:
    total = len(fleet)
    verified = sum(1 for t, s in fleet.items() if is_fleet_entry_verified(manifest, t, s))
    return verified, total


def fleet_needing_audit(
    manifest: dict[str, Any], fleet: dict[str, dict[str, Any]], *, force: bool
) -> list[str]:
    if force:
        return sorted(fleet.keys())
    return sorted(t for t, s in fleet.items() if not is_fleet_entry_verified(manifest, t, s))


def load_fleet_reference() -> dict[str, Any]:
    if not os.path.isfile(FLEET_REFERENCE_PATH):
        return {}
    with open(FLEET_REFERENCE_PATH, encoding="utf-8") as fh:
        data = json.load(fh)
    return {k: v for k, v in data.items() if not k.startswith("_") and isinstance(v, dict)}


def _within_tolerance(actual: float, expected: float, pct: float) -> bool:
    if expected == 0:
        return actual == expected
    return abs(actual - expected) <= max(abs(expected) * pct / 100.0, 1.0)


def audit_fleet_specs(
    fleet: dict[str, dict[str, Any]], *, only_types: list[str] | None = None
) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    reference = load_fleet_reference()
    required = (
        "name",
        "class",
        "rules",
        "maxPax",
        "maxCargo",
        "minD",
        "maxD",
        "minAlt",
        "maxAlt",
        "minRunwayLength",
        "mtow",
        "oew",
        "fuelPerNm",
        "tags",
    )
    targets = only_types if only_types is not None else sorted(fleet.keys())
    no_reference: list[str] = []
    for ac_type in targets:
        spec = fleet.get(ac_type, {})
        label = f"{ac_type} ({spec.get('name', '?')})"
        for key in required:
            if key == "tags":
                if not spec.get("tags"):
                    errors.append(f"{label}: missing tags")
            elif spec.get(key) is None:
                errors.append(f"{label}: missing {key}")

        ac_class = spec.get("class")
        if ac_class and ac_class not in VALID_FLEET_CLASS:
            errors.append(f"{label}: invalid class '{ac_class}'")

        min_d = spec.get("minD")
        max_d = spec.get("maxD")
        if isinstance(min_d, (int, float)) and isinstance(max_d, (int, float)) and min_d >= max_d:
            errors.append(f"{label}: minD ({min_d}) must be < maxD ({max_d})")

        min_alt = spec.get("minAlt")
        max_alt = spec.get("maxAlt")
        if isinstance(min_alt, (int, float)) and isinstance(max_alt, (int, float)) and min_alt >= max_alt:
            errors.append(f"{label}: minAlt ({min_alt}) must be < maxAlt ({max_alt})")

        oew = spec.get("oew")
        mtow_val = spec.get("mtow")
        if isinstance(oew, (int, float)) and isinstance(mtow_val, (int, float)):
            if oew >= mtow_val:
                errors.append(f"{label}: oew ({oew}) must be < mtow ({mtow_val})")

        fuel = spec.get("fuelPerNm")
        if isinstance(fuel, (int, float)) and fuel <= 0:
            errors.append(f"{label}: fuelPerNm must be > 0")

        rwy = spec.get("minRunwayLength")
        if ac_class not in ("HELI", "GLIDER") and isinstance(rwy, (int, float)) and rwy <= 0:
            warnings.append(f"{label}: minRunwayLength is 0 for non-heli/glider")

        ref = reference.get(ac_type)
        if ref:
            ref_spec = ref.get("spec") or {}
            tol = float(ref.get("tolerance_pct", 5))
            for key, expected in ref_spec.items():
                actual = spec.get(key)
                if actual is None:
                    errors.append(f"{label}: missing {key} (required by fleet-reference.json)")
                    continue
                if isinstance(expected, (int, float)) and isinstance(actual, (int, float)):
                    if not _within_tolerance(float(actual), float(expected), tol):
                        errors.append(
                            f"{label}: {key}={actual} differs from reference {expected} "
                            f"(>{tol}% — source: {ref.get('source', 'reference')})"
                        )
                elif actual != expected:
                    errors.append(
                        f"{label}: {key}={actual!r} differs from reference {expected!r} "
                        f"(source: {ref.get('source', 'reference')})"
                    )
        else:
            no_reference.append(ac_type)

    if no_reference:
        sample = ", ".join(no_reference[:8])
        extra = f" (+{len(no_reference) - 8} more)" if len(no_reference) > 8 else ""
        warnings.append(
            f"{len(no_reference)} aircraft have no row in fleet-reference.json "
            f"(structural checks only): {sample}{extra}"
        )

    return errors, warnings


def is_fleet_verified(manifest: dict[str, Any], checksum: str) -> bool:
    entry = manifest.get("fleet", {})
    if entry.get("checksum") != checksum:
        return False
    if entry.get("verified") is not True:
        return False
    verified_count = entry.get("verifiedCount")
    aircraft_count = entry.get("aircraftCount")
    if verified_count is not None and aircraft_count is not None:
        return verified_count == aircraft_count and aircraft_count > 0
    return False


def merge_fleet_verification(
    manifest: dict[str, Any],
    fleet: dict[str, dict[str, Any]],
    passed_types: set[str],
    *,
    stamp_file: bool = False,
) -> None:
    path = os.path.join(BASE, "fleet-db.js")
    checksum = file_checksum(path)
    now = utc_now()
    entry = manifest.setdefault("fleet", {})
    aircraft: dict[str, Any] = entry.setdefault("aircraft", {})
    for ac_type, spec in fleet.items():
        if ac_type not in passed_types:
            continue
        aircraft[ac_type] = {"fp": fleet_entry_fingerprint(spec), "verifiedAt": now}
    verified, total = count_fleet_verification(manifest, fleet)
    entry["checksum"] = checksum
    entry["aircraftCount"] = total
    entry["verifiedCount"] = verified
    entry["verified"] = verified == total and total > 0
    if entry["verified"]:
        entry["verifiedAt"] = now
    if stamp_file:
        stamp_fleet_entries(path, passed_types)


def stamp_fleet_entries(path: str, types: set[str]) -> None:
    text = open(path, encoding="utf-8").read()
    stamp = utc_now()

    def repl(match: re.Match[str]) -> str:
        ac_type = match.group(1)
        if ac_type not in types:
            return match.group(0)
        body = match.group(2)
        if "_vfVerified" in body:
            body = re.sub(r'"_vfVerified":\s*"[^"]*",?\s*', "", body)
        return f'"{ac_type}": {{ "_vfVerified": "{stamp}", {body}'

    text = re.sub(r'"([A-Z0-9_]+)":\s*\{([^}]+)\}', repl, text)
    open(path, "w", encoding="utf-8", newline="\n").write(text)


def mark_fleet_verified(manifest: dict[str, Any], stamp_file: bool = False) -> None:
    fleet = parse_fleet_full()
    merge_fleet_verification(manifest, fleet, set(fleet.keys()), stamp_file=stamp_file)


def parse_mission_types() -> list[int]:
    text = open(os.path.join(BASE, "missions-db.js"), encoding="utf-8").read()
    return [int(m.group(1)) for m in re.finditer(r"\{\s*type:\s*(\d+),", text)]


def is_missions_verified(manifest: dict[str, Any], checksum: str) -> bool:
    entry = manifest.get("missions", {})
    return entry.get("verified") is True and entry.get("checksum") == checksum


def stamp_fleet_file(path: str) -> None:
    text = open(path, encoding="utf-8").read()
    stamp = utc_now()
    text = re.sub(r'"_vfVerified":\s*"[^"]*",?\s*', "", text)

    def repl(match: re.Match[str]) -> str:
        return f'"{match.group(1)}": {{ "_vfVerified": "{stamp}", '

    text = re.sub(r'"([A-Z0-9_]+)":\s*\{', repl, text)
    open(path, "w", encoding="utf-8", newline="\n").write(text)


def mark_missions_verified(manifest: dict[str, Any], stamp_file: bool = False) -> None:
    path = os.path.join(BASE, "missions-db.js")
    checksum = file_checksum(path)
    types = parse_mission_types()
    manifest["missions"] = {
        "verified": True,
        "verifiedAt": utc_now(),
        "checksum": checksum,
        "types": {str(t): True for t in types},
    }
    if stamp_file:
        stamp_missions_file(path)


def stamp_missions_file(path: str) -> None:
    text = open(path, encoding="utf-8").read()

    def repl(match: re.Match[str]) -> str:
        block = match.group(0)
        if "vfVerified:" in block:
            block = re.sub(r",?\s*vfVerified:\s*true", "", block)
        return block[:-1] + ", vfVerified: true }"

    text = re.sub(
        r"\{\s*type:\s*\d+,[^}]+\}",
        repl,
        text,
    )
    header = f"/* vfd-missions-verified: {utc_now()} */\n"
    text = re.sub(r"/\* vfd-missions-verified:[^\n]*\*/\n", "", text)
    if "vfd-missions-verified" not in text.split("\n", 1)[0]:
        text = header + text
    open(path, "w", encoding="utf-8", newline="\n").write(text)


def _parse_audit_predeploy_output(out: str) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    section = None
    for line in out.splitlines():
        if "=== ISSUES" in line:
            section = "errors"
            continue
        if "=== WARNINGS" in line:
            section = "warnings"
            continue
        stripped = line.strip()
        if not stripped or stripped == "none":
            continue
        if section == "errors":
            errors.append(stripped)
        elif section == "warnings":
            warnings.append(stripped)
    return errors, warnings


def audit_dispatch_code() -> tuple[list[str], list[str], str]:
    """Run consolidated pre-deploy checks (no auto-fix)."""
    errors: list[str] = []
    warnings: list[str] = []
    logs: list[str] = []

    loader = open(os.path.join(BASE, "loader.js"), encoding="utf-8").read()
    version_json = json.load(open(os.path.join(BASE, "version.json"), encoding="utf-8-sig"))
    app_v = re.search(r'APP_VERSION\s*=\s*"([^"]+)"', loader)
    loader_v = app_v.group(1) if app_v else None
    file_v = version_json.get("version")
    if loader_v != file_v:
        errors.append(f"Version mismatch: loader.js={loader_v}, version.json={file_v}")
    else:
        logs.append(f"OK versions: {loader_v}")

    code, out = run_subprocess("audit-fleet-missions.py")
    logs.append(f"--- audit-fleet-missions.py ---\n{out.strip()}")
    if code != 0:
        for line in out.splitlines():
            if "[ERROR]" in line:
                errors.append(line.strip())

    code, out = run_subprocess("audit-predeploy.py")
    logs.append(f"--- audit-predeploy.py ---\n{out.strip()}")
    pd_errors, pd_warnings = _parse_audit_predeploy_output(out)
    errors.extend(pd_errors)
    warnings.extend(pd_warnings)

    _, out = run_subprocess("audit-longhaul-math.py")
    logs.append(f"--- audit-longhaul-math.py ---\n{out.strip()}")
    if "cannot use long haul" in out:
        warnings.append("audit-longhaul-math: one or more aircraft cannot use long-haul mode")

    index = open(os.path.join(BASE, "index.html"), encoding="utf-8").read()
    if "loader.js" not in index:
        errors.append("index.html does not reference loader.js")
    if "dispatch-engine.js" not in loader:
        errors.append("loader.js does not load dispatch-engine.js")
    for handler in ("saveCustomAircraft", "saveCustomAirport"):
        if handler not in index:
            warnings.append(f"index.html may be missing handler: {handler}")

    # --- dispatch-engine.js: check consolidated airport variable names are used ---
    engine_text = open(os.path.join(BASE, "dispatch-engine.js"), encoding="utf-8").read()
    for expected_var in ("seedAsoboAirportDatabase", "seedThirdPartyAirportDatabase"):
        if expected_var not in engine_text:
            errors.append(f"dispatch-engine.js: expected variable '{expected_var}' not found")
    for legacy_var in LEGACY_AIRPORT_VAR_NAMES:
        if legacy_var in engine_text:
            errors.append(
                f"dispatch-engine.js: legacy variable '{legacy_var}' still present "
                f"(databases consolidated into airports-asobo-db.js / airports-thirdparty-db.js)"
            )
    for expected_var in ("seedAsoboAirportDatabase", "seedThirdPartyAirportDatabase"):
        if expected_var not in loader:
            errors.append(f"loader.js: expected airport database '{expected_var}' not referenced")
    for legacy_var in LEGACY_AIRPORT_VAR_NAMES:
        if legacy_var in loader:
            errors.append(f"loader.js: legacy variable '{legacy_var}' still present")
    if not errors or not any("legacy variable" in e for e in errors):
        logs.append("OK dispatch-engine.js uses consolidated airport database variables")

    # --- missions-db.js: check for duplicate mission type IDs ---
    missions_text = open(os.path.join(BASE, "missions-db.js"), encoding="utf-8").read()
    seen_types: dict[int, int] = {}
    for m in re.finditer(r"\btype:\s*(\d+)", missions_text):
        t = int(m.group(1))
        seen_types[t] = seen_types.get(t, 0) + 1
    dup_types = sorted(t for t, count in seen_types.items() if count > 1)
    if dup_types:
        errors.append(f"missions-db.js: duplicate mission type IDs: {dup_types}")
    else:
        logs.append(f"OK missions-db.js: {len(seen_types)} unique mission type IDs")

    types = sorted(parse_mission_types())
    if types and (max(types) > 38 or min(types) < 1):
        warnings.append(f"Mission types span {min(types)}–{max(types)} (expected ~1–38)")

    return errors, warnings, "\n".join(logs)


def bump_version(part: str = "patch") -> str:
    version_json = json.load(open(os.path.join(BASE, "version.json"), encoding="utf-8-sig"))
    cur = str(version_json.get("version", "1.0.0"))
    nums = [int(x) for x in cur.split(".")]
    while len(nums) < 3:
        nums.append(0)
    if part == "major":
        nums = [nums[0] + 1, 0, 0]
    elif part == "minor":
        nums = [nums[0], nums[1] + 1, 0]
    else:
        nums = [nums[0], nums[1], nums[2] + 1]
    new_v = ".".join(str(n) for n in nums)
    version_json["version"] = new_v
    with open(os.path.join(BASE, "version.json"), "w", encoding="utf-8") as fh:
        json.dump(version_json, fh, indent=2)
        fh.write("\n")
    loader_path = os.path.join(BASE, "loader.js")
    loader = open(loader_path, encoding="utf-8").read()
    loader = re.sub(r'APP_VERSION\s*=\s*"[^"]+"', f'APP_VERSION = "{new_v}"', loader)
    open(loader_path, "w", encoding="utf-8", newline="\n").write(loader)
    return new_v


def deploy_file_list(changed_only: bool = False) -> list[str]:
  if not changed_only:
      return [f for f in DEPLOY_FILES if os.path.isfile(os.path.join(BASE, f))]
  # Caller can pass git diff; default: all core deploy files
  return [f for f in DEPLOY_FILES if os.path.isfile(os.path.join(BASE, f))]

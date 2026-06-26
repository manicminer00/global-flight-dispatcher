"""
Audit fleet-db.js aircraft against missions-db.js + dispatch-engine eligibility rules.

Mirrors dispatch-engine.js:
  isFreightMission, isPassengerMission, missionRequiresPassengers,
  isMilitaryMissionRestricted, passesMissionContextFilter,
  passesHardMissionLocks (template level), scenario filtering.

Run: python scripts/audit-fleet-missions.py
Exit code 1 if any ERROR-level findings.
"""
from __future__ import annotations

import json
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LONG_HAUL_EXCLUSIVE = {6, 34, 35, 36, 37}
LONG_HAUL_ALLOWED = {6, 13, 15, 17, 18, 23, 24, 25, 28, 31, 32, 34, 35, 36, 37}
TROOP_PAX_TYPES = {23, 29, 30}

errors: list[str] = []
warnings: list[str] = []
info: list[str] = []


def parse_missions():
    text = open(os.path.join(BASE, "missions-db.js"), encoding="utf-8").read()
    missions = []
    for m in re.finditer(r"\{\s*type:\s*(\d+),\s*name:\s*\"([^\"]+)\"([^}]*)\}", text):
        t, name, rest = int(m.group(1)), m.group(2), m.group(3)
        entry = {"type": t, "name": name}
        for key in (
            "pool", "requiredDep", "maxMTOW", "minCargo", "minPaxSeats",
            "militaryOnly", "civilianOnly", "tacticalOnly", "isLocal", "weight",
        ):
            km = re.search(rf"{key}:\s*([^,\n}}]+)", rest)
            if not km:
                continue
            val = km.group(1).strip()
            if val.startswith('"'):
                entry[key] = val.strip('"')
            elif val == "true":
                entry[key] = True
            elif val == "false":
                entry[key] = False
            elif val.isdigit():
                entry[key] = int(val)
            else:
                entry[key] = val
        for key, pat in (
            ("allowedAircraft", r"allowedAircraft:\s*(\[[^\]]+\])"),
            ("allowedClasses", r"allowedClasses:\s*(\[[^\]]+\])"),
            ("requiredTags", r"requiredTags:\s*(\[[^\]]+\])"),
            ("excludedTags", r"excludedTags:\s*(\[[^\]]+\])"),
            ("excludedAircraft", r"excludedAircraft:\s*(\[[^\]]+\])"),
            ("maxMTOWAppliesTo", r"maxMTOWAppliesTo:\s*(\[[^\]]+\])"),
            ("minPaxSeatsAppliesTo", r"minPaxSeatsAppliesTo:\s*(\[[^\]]+\])"),
        ):
            arr = re.search(pat, rest)
            if arr:
                entry[key] = re.findall(r"\"([^\"]+)\"", arr.group(1))
        missions.append(entry)

    chunk = re.search(r"const scenarioDB = \{(.*)\n\};", text, re.S).group(1)
    pools: dict[str, list[dict]] = {}
    for pm in re.finditer(r"(?:^|\n)\s*'?([^':\n]+)'?:\s*\[(.*?)\n\s*\],?", chunk, re.S):
        pname = pm.group(1).strip("'\"")
        rows = []
        for line in pm.group(2).splitlines():
            im = re.search(r"imgId:\s*(\d+)", line)
            if not im:
                continue
            row = {"imgId": int(im.group(1)), "_line": line}
            mt = re.search(r"missionType:\s*(\d+)", line)
            if mt:
                row["missionType"] = int(mt.group(1))
            for key, pat in (
                ("allowedAircraft", r"allowedAircraft:\s*(\[[^\]]+\])"),
                ("allowedClasses", r"allowedClasses:\s*(\[[^\]]+\])"),
                ("requiredTags", r"requiredTags:\s*(\[[^\]]+\])"),
                ("excludedTags", r"excludedTags:\s*(\[[^\]]+\])"),
                ("excludedAircraft", r"excludedAircraft:\s*(\[[^\]]+\])"),
            ):
                arr = re.search(pat, line)
                if arr:
                    row[key] = re.findall(r"\"([^\"]+)\"", arr.group(1))
            mc = re.search(r"minCargo:\s*(\d+)", line)
            if mc:
                row["minCargo"] = int(mc.group(1))
            if "staffShuttle" in line:
                row["staffShuttle"] = True
            if "heliOps" in line:
                row["heliOps"] = True
            rows.append(row)
        pools[pname] = rows
    return missions, pools


def parse_fleet():
    text = open(os.path.join(BASE, "fleet-db.js"), encoding="utf-8").read()
    fleet = {}
    for m in re.finditer(r"\"([A-Z0-9_]+)\":\s*\{([^}]+)\}", text):
        code, body = m.group(1), m.group(2)
        spec = {"tags": [], "name": ""}
        nm = re.search(r"\"name\":\s*\"([^\"]+)\"", body)
        if nm:
            spec["name"] = nm.group(1)
        cm = re.search(r"\"class\":\s*\"([^\"]+)\"", body)
        if cm:
            spec["class"] = cm.group(1)
        for key in ("maxPax", "maxCargo", "mtow", "minCargo"):
            km = re.search(rf"\"{key}\":\s*(\d+)", body)
            if km:
                spec[key] = int(km.group(1))
        for flag in ("isMilitary", "isTactical"):
            if re.search(rf"\"{flag}\":\s*true", body):
                spec[flag] = True
        tags = re.search(r"\"tags\":\s*\[([^\]]+)\]", body)
        if tags:
            spec["tags"] = re.findall(r"\"([^\"]+)\"", tags.group(1))
        fleet[code] = spec
    return fleet


def is_freight(m):
    req = m.get("requiredTags") or []
    if "FREIGHTER" in req:
        return True
    if "PAX" in req:
        return False
    if m.get("minCargo"):
        return True
    name = m.get("name", "").lower()
    return bool(re.search(r"\bfreight\b", name) or re.search(r"\bcargo\b", name))


def is_passenger_mission(m):
    if is_freight(m):
        return False
    req = m.get("requiredTags") or []
    if "PAX" in req:
        return True
    if "FREIGHTER" in req:
        return False
    name = m.get("name", "").lower()
    return bool(
        re.search(r"\bairliner\b", name)
        or re.search(r"\bpassenger\b", name)
        or re.search(r"\bcommuter\b", name)
    )


def is_military_troop_passenger_mission(m):
    return bool(m.get("militaryOnly")) and m.get("type") in TROOP_PAX_TYPES


def mission_requires_passengers(m, spec):
    if is_freight(m):
        return False
    if (spec.get("maxPax") or 0) <= 0:
        return False
    if is_passenger_mission(m):
        return True
    req = m.get("requiredTags") or []
    if "PAX" in req:
        return True
    tags = spec.get("tags") or []
    if "PAX" not in tags:
        return False
    if "FREIGHTER" not in tags:
        return True
    if "MILITARY_TRANSPORT" in tags or "MILITARY_HELI" in tags:
        return is_military_troop_passenger_mission(m)
    return False


def is_military_mission_restricted(spec):
    if not spec.get("isMilitary"):
        return False
    if spec.get("class") == "WARBIRD":
        return False
    tags = spec.get("tags") or []
    if "CIVIL_OK" in tags:
        return False
    if spec.get("class") == "HELI":
        return "MILITARY_HELI" in tags
    return True


def passes_context(m, spec, contractor=False):
    if m.get("tacticalOnly") and not spec.get("isTactical"):
        return False
    if m.get("civilianOnly") and spec.get("isMilitary"):
        return False
    if m.get("militaryOnly") and not spec.get("isMilitary") and not contractor:
        return False
    if not m.get("militaryOnly") and is_military_mission_restricted(spec):
        return False
    return True


def passes_role(m, spec):
    if is_freight(m):
        if "FREIGHTER" not in spec.get("tags", []):
            return False
        if (spec.get("maxCargo") or 0) <= 0:
            return False
    req = m.get("requiredTags") or []
    if "PAX" in req and "FREIGHTER" not in req:
        if (spec.get("maxPax") or 0) <= 0:
            return False
        if "PAX" not in spec.get("tags", []):
            return False
    return True


def passes_mtow(m, search_class, spec):
    cap = m.get("maxMTOW")
    if not cap:
        return True
    applies = m.get("maxMTOWAppliesTo")
    if applies and search_class not in applies:
        return True
    return spec.get("mtow", 0) <= cap


def passes_min_pax_seats(m, search_class, spec):
    floor = m.get("minPaxSeats")
    if not floor:
        return True
    applies = m.get("minPaxSeatsAppliesTo")
    if applies and search_class not in applies:
        return True
    return (spec.get("maxPax") or 0) >= floor


def passes_template_aircraft(m, ac_type, search_class):
    classes = m.get("allowedClasses")
    aircraft = m.get("allowedAircraft")
    has_c = bool(classes)
    has_a = bool(aircraft)
    if not has_c and not has_a:
        return True
    if has_c and has_a:
        return search_class in classes or ac_type in aircraft
    if has_a:
        return ac_type in aircraft
    return search_class in classes


def passes_hard(m, ac_type, search_class, spec):
    if not passes_template_aircraft(m, ac_type, search_class):
        return False
    if search_class == "BIZ JET" and ac_type != "LJ35":
        if is_freight(m):
            return False
        if "MEDEVAC" in (m.get("requiredTags") or []):
            return False
    if m.get("minCargo") and spec.get("maxCargo", 0) < m["minCargo"]:
        return False
    if not passes_mtow(m, search_class, spec):
        return False
    if not passes_min_pax_seats(m, search_class, spec):
        return False
    if ac_type in (m.get("excludedAircraft") or []):
        return False
    if not passes_role(m, spec):
        return False
    return True


def scenario_has_excluded_tags(s, spec):
    exc = s.get("excludedTags")
    if exc and any(t in spec.get("tags", []) for t in exc):
        return True
    return False


def scenario_allows(s, ac_type, spec):
    if s.get("allowedAircraft") and ac_type in s["allowedAircraft"]:
        return True
    if s.get("allowedClasses") and spec.get("class") in s["allowedClasses"]:
        return True
    if not s.get("allowedAircraft") and not s.get("allowedClasses"):
        return True
    return False


def pool_excluded_img_ids(pool, ac_type, spec):
    excluded = set()
    for s in pool:
        if not scenario_allows(s, ac_type, spec):
            excluded.add(s["imgId"])
        if ac_type in (s.get("excludedAircraft") or []):
            excluded.add(s["imgId"])
        if scenario_has_excluded_tags(s, spec):
            excluded.add(s["imgId"])
    return excluded


def scenario_passes(s, ac_type, spec, excluded):
    if s["imgId"] in excluded:
        return False
    if s.get("minCargo") and spec.get("maxCargo", 0) < s["minCargo"]:
        return False
    if ac_type in (s.get("excludedAircraft") or []):
        return False
    req = s.get("requiredTags")
    if req and not all(t in spec.get("tags", []) for t in req):
        return False
    if scenario_has_excluded_tags(s, spec):
        return False
    return scenario_allows(s, ac_type, spec)


def filter_scenarios(pool, m, ac_type, spec):
    excluded = pool_excluded_img_ids(pool, ac_type, spec)
    active = [s for s in pool if scenario_passes(s, ac_type, spec, excluded)]
    typed = [s for s in active if s.get("missionType") == m["type"]]
    if typed:
        active = typed
    if m["type"] == 30:
        staff = [s for s in active if s.get("staffShuttle")]
        if staff:
            active = staff
    elif m["type"] == 29:
        heli = [s for s in active if s.get("heliOps")]
        if heli:
            active = heli
    if not active:
        active = [
            s for s in pool
            if scenario_passes(s, ac_type, spec, excluded)
            and not s.get("minCargo")
            and not s.get("requiredTags")
            and not s.get("allowedAircraft")
            and not s.get("allowedClasses")
            and ac_type not in (s.get("excludedAircraft") or [])
            and not scenario_has_excluded_tags(s, spec)
        ]
    return active


def eligible_missions(ac_type, spec, missions, pools, long_haul=False):
    sc = spec.get("class", "GA")
    out = []
    for m in missions:
        if long_haul:
            if m["type"] not in LONG_HAUL_ALLOWED:
                continue
        elif m["type"] in LONG_HAUL_EXCLUSIVE:
            continue
        if m.get("excludedTags") and any(t in spec.get("tags", []) for t in m["excludedTags"]):
            continue
        if m.get("requiredTags") and not all(t in spec.get("tags", []) for t in m["requiredTags"]):
            continue
        if not passes_context(m, spec):
            continue
        if not passes_hard(m, ac_type, sc, spec):
            continue
        pool_name = m.get("pool")
        if not pool_name:
            out.append({**m, "scenarios": 1 if m["type"] <= 12 else 0})
            continue
        pool = pools.get(pool_name, [])
        active = filter_scenarios(pool, m, ac_type, spec)
        if active:
            out.append({**m, "scenarios": len(active), "assigns_pax": mission_requires_passengers(m, spec)})
    return out


def audit_tag_conventions(ac_type, spec):
    tags = set(spec.get("tags") or [])
    max_pax = spec.get("maxPax") or 0
    max_cargo = spec.get("maxCargo") or 0

    if "PAX" in tags and max_pax == 0:
        warnings.append(f"{ac_type}: PAX tag but maxPax=0")
    if "FREIGHTER" in tags and max_cargo == 0:
        warnings.append(f"{ac_type}: FREIGHTER tag but maxCargo=0")
    if spec.get("isMilitary") and spec.get("class") == "TURBO" and max_cargo >= 4000:
        if "MILITARY_TRANSPORT" not in tags and max_cargo >= 10000:
            warnings.append(f"{ac_type}: large military TURBO airlifter should have MILITARY_TRANSPORT tag")
    if spec.get("class") == "HELI" and spec.get("isMilitary") and "MILITARY_HELI" not in tags:
        info.append(f"{ac_type}: military HELI without MILITARY_HELI (may fly civilian heli missions)")
    if is_military_mission_restricted(spec) and "CIVIL_OK" in tags:
        errors.append(f"{ac_type}: has CIVIL_OK but is military-mission-restricted")

    # Dual-role military airlifters need PAX tag for troop assignment on T23/T29/T30
    if (
        max_pax > 0
        and "FREIGHTER" in tags
        and ("MILITARY_TRANSPORT" in tags or "MILITARY_HELI" in tags)
        and "PAX" not in tags
    ):
        errors.append(
            f"{ac_type}: maxPax={max_pax} + FREIGHTER + military transport/heli but missing PAX tag "
            "(troops will not be assigned on T23/T29/T30)"
        )


def audit_policy(ac_type, spec, eligible):
    restricted = is_military_mission_restricted(spec)
    civ_eligible = [m for m in eligible if not m.get("militaryOnly")]
    mil_eligible = [m for m in eligible if m.get("militaryOnly")]

    if restricted and civ_eligible:
        names = ", ".join(f"T{m['type']}" for m in civ_eligible[:5])
        extra = f" (+{len(civ_eligible)-5} more)" if len(civ_eligible) > 5 else ""
        errors.append(f"{ac_type}: military-restricted but eligible for civilian templates: {names}{extra}")

    if not eligible:
        errors.append(f"{ac_type} ({spec.get('name','')}): ZERO eligible short-haul missions")

    tags = spec.get("tags") or []
    if (
        (spec.get("maxPax") or 0) > 0
        and "PAX" in tags
        and "FREIGHTER" in tags
        and ("MILITARY_TRANSPORT" in tags or "MILITARY_HELI" in tags)
    ):
        troop = [m for m in eligible if m["type"] in TROOP_PAX_TYPES]
        for m in troop:
            if not m.get("assigns_pax"):
                errors.append(
                    f"{ac_type}: dual-role military airlifter on T{m['type']} {m['name']} "
                    "would NOT assign passengers (missionRequiresPassengers bug)"
                )

    if spec.get("class") == "HELI" and spec.get("isMilitary") and "MILITARY_HELI" in tags:
        if not any(m["type"] in (29, 30) for m in eligible):
            warnings.append(f"{ac_type}: MILITARY_HELI but no Military Heli-Ops / Staff Shuttle templates")
        if not any(m["type"] == 23 for m in eligible):
            warnings.append(f"{ac_type}: MILITARY_HELI but no Military Logistics Transit template")


def write_reference(fleet, missions, report_path):
    """Generate markdown matrix: mission types × rules summary + per-aircraft eligibility."""
    lines = [
        "# Fleet ↔ Mission eligibility reference",
        "",
        "Auto-generated by `scripts/audit-fleet-missions.py`. Do not hand-edit; re-run the script.",
        "",
        "## Mission template rules (types 13–38)",
        "",
        "| Type | Name | Class gate | Required tags | Excluded tags | militaryOnly | Notes |",
        "|------|------|------------|---------------|---------------|--------------|-------|",
    ]
    for m in sorted(missions, key=lambda x: x["type"]):
        if m["type"] < 13:
            continue
        lines.append(
            "| {type} | {name} | {cls} | {req} | {exc} | {mil} | {notes} |".format(
                type=m["type"],
                name=m["name"][:40],
                cls=", ".join(m.get("allowedClasses") or []) or "(type-specific)",
                req=", ".join(m.get("requiredTags") or []) or "—",
                exc=", ".join(m.get("excludedTags") or []) or "—",
                mil="yes" if m.get("militaryOnly") else "no",
                notes=f"minCargo={m['minCargo']}" if m.get("minCargo") else "—",
            )
        )

    lines += [
        "",
        "## Tag semantics (fleet-db.js)",
        "",
        "| Tag | Purpose |",
        "|-----|---------|",
        "| `PAX` | Required for passenger missions; maxPax > 0 |",
        "| `FREIGHTER` | Required for freight/cargo missions; maxCargo > 0 |",
        "| `MILITARY_TRANSPORT` | Fixed-wing military airlifter; blocks civilian airline/freight templates |",
        "| `MILITARY_HELI` | Military helicopter: **militaryOnly missions only** (no CIVIL_OK needed) |",
        "| `CIVIL_OK` | Military aircraft may also fly civilian missions (65% mil weighting) |",
        "| `CIVIL_OK` absent + military | **militaryOnly templates only** (TURBO/JET) or MILITARY_HELI (HELI) |",
        "| `VIP` | Executive / charter missions |",
        "| `MEDEVAC` | Medical relay missions |",
        "| `JETLINER` / `REGIONAL` | Airline mission matching |",
        "| `RECON` | Strategic reconnaissance (T31) |",
        "| `FIGHTER` / `FAST_JET` | Tactical sorties (needs isTactical for T22) |",
        "| `VINTAGE` | Heritage flights |",
        "",
        "## Dispatch logic checklist (must mirror dispatch-engine.js)",
        "",
        "1. Template filter: class, allowedAircraft, requiredTags, excludedTags, minCargo, MTOW caps",
        "2. `passesMissionContextFilter`: militaryOnly / civilianOnly / isMilitaryMissionRestricted",
        "3. `passesMissionAircraftRole`: FREIGHTER+maxCargo for freight; PAX+maxPax for PAX-required",
        "4. `missionRequiresPassengers`: dual-role PAX+FREIGHTER military → pax on T23/T29/T30",
        "5. Scenario pool: excludedTags, allowedAircraft, minCargo per scenario",
        "",
        "## Per-aircraft eligible templates (short haul)",
        "",
    ]

    for ac_type in sorted(fleet):
        spec = fleet[ac_type]
        el = report.get(ac_type, [])
        if not el:
            lines.append(f"### `{ac_type}` — **NONE**")
            lines.append("")
            continue
        mil = "restricted" if is_military_mission_restricted(spec) else "open"
        lines.append(f"### `{ac_type}` — {spec.get('name', '')} ({spec.get('class')}, military={spec.get('isMilitary', False)}, {mil})")
        lines.append("")
        lines.append("| Type | Mission | Scenarios | Assigns pax |")
        lines.append("|------|---------|-----------|-------------|")
        for m in el:
            pax = "yes" if m.get("assigns_pax") else ("no" if (spec.get("maxPax") or 0) > 0 else "—")
            lines.append(f"| {m['type']} | {m['name']} | {m['scenarios']} | {pax} |")
        lines.append("")

    open(report_path, "w", encoding="utf-8").write("\n".join(lines) + "\n")


def main():
    missions, pools = parse_missions()
    fleet = parse_fleet()
    global report
    report = {}

    print(f"Auditing {len(fleet)} aircraft against {len(missions)} mission templates...\n")

    for ac_type, spec in sorted(fleet.items()):
        audit_tag_conventions(ac_type, spec)
        el = eligible_missions(ac_type, spec, missions, pools)
        report[ac_type] = el
        audit_policy(ac_type, spec, el)

    ref_path = os.path.join(BASE, "scripts", "FLEET-MISSION-REFERENCE.md")
    write_reference(fleet, missions, ref_path)

    print("ERRORS")
    if errors:
        for e in errors:
            print(f"  [ERROR] {e}")
    else:
        print("  None")

    print("\nWARNINGS")
    if warnings:
        for w in warnings:
            print(f"  [WARN] {w}")
    else:
        print("  None")

    print(f"\nReference written: scripts/FLEET-MISSION-REFERENCE.md")
    print(f"Summary: {len(errors)} error(s), {len(warnings)} warning(s), {len(info)} info")

    if info and os.environ.get("AUDIT_VERBOSE"):
        print("\nINFO")
        for i in info:
            print(f"  [INFO] {i}")

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())

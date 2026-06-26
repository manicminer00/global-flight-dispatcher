#!/usr/bin/env python3
"""Audit long-haul routing math against fleet-db.js (mirrors dispatch-engine.js)."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLEET = ROOT / "fleet-db.js"

PAD = 30
TOL = 30
FAST_BIZ = {"C750", "C680", "C700"}
VINTAGE_PROPLINER = {"DC6A", "DC6B"}
SPEEDS = {
    "JET": 440,
    "HEAVY_JET": 485,
    "BIZ_JET": 420,
    "BIZ_JET_FAST": 470,
    "TURBO": 270,
    "HEAVY_TURBO": 330,
    "MIL_TURBO": 300,
    "VINTAGE_PROPLINER": 275,
    "WARBIRD": 200,
    "GA_HIGH": 160,
    "GA": 90,
}

def parse_fleet():
    text = FLEET.read_text(encoding="utf-8")
    entries = {}
    for m in re.finditer(r'"([A-Z0-9_]+)":\s*(\{[^}]+\})', text):
        icao, blob = m.group(1), m.group(2)
        def grab(key):
            mm = re.search(rf'"{key}":\s*([^,}}]+)', blob)
            if not mm:
                return None
            v = mm.group(1).strip().strip('"')
            try:
                return float(v) if "." in v else int(v)
            except ValueError:
                return v
        tags = re.search(r'"tags":\s*\[([^\]]*)\]', blob)
        tag_list = re.findall(r'"([^"]+)"', tags.group(1)) if tags else []
        entries[icao] = {
            "class": grab("class"),
            "maxD": grab("maxD") or 0,
            "maxAlt": grab("maxAlt") or 0,
            "tags": tag_list,
        }
    return entries

def block_speed(icao, spec, long_haul=True):
    if icao in VINTAGE_PROPLINER:
        return SPEEDS["VINTAGE_PROPLINER"]
    cls = spec["class"]
    tags = spec["tags"]
    if cls == "JET":
        if long_haul and "HEAVY" in tags:
            return SPEEDS["HEAVY_JET"]
        return SPEEDS["JET"]
    if cls == "BIZ JET":
        if long_haul and icao in FAST_BIZ:
            return SPEEDS["BIZ_JET_FAST"]
        return SPEEDS["BIZ_JET"]
    if cls == "TURBO":
        if "MILITARY_TRANSPORT" in tags:
            return SPEEDS["MIL_TURBO"]
        if "HEAVY" in tags:
            return SPEEDS["HEAVY_TURBO"]
        return SPEEDS["TURBO"]
    if cls == "WARBIRD":
        return SPEEDS["WARBIRD"]
    if cls == "GA" and (spec["maxAlt"] or 0) >= 15000:
        return SPEEDS["GA_HIGH"]
    return SPEEDS["GA"]

def effective_mins(slider):
    return max(60, slider - PAD)

def block_mins(dist, speed):
    return round(dist / speed * 60) + PAD

def max_achievable_block(max_d, speed):
    return block_mins(max_d, speed)

def target_dist(slider, speed, max_d):
    d = speed * effective_mins(slider) / 60
    return min(d, max_d)

def audit():
    fleet = parse_fleet()
    sliders = [120, 180, 240, 360, 480, 600, 720, 840]
    issues = []
    print("=== Fleet long-haul capability (min slider 120) ===\n")
    for icao, spec in sorted(fleet.items()):
        if spec["class"] in ("HELI", "GLIDER"):
            continue
        spd = block_speed(icao, spec)
        max_b = max_achievable_block(spec["maxD"], spd)
        if max_b < 120:
            issues.append((icao, "cannot use long haul", max_b))
            continue
        for s in sliders:
            rt = min(s, max_b)
            td = target_dist(s, spd, spec["maxD"])
            # worst case within tolerance: route at max block rt+TOL
            max_route_d = (rt + TOL - PAD) * spd / 60
            min_route_d = max(spec.get("minD", 0) or 0, (rt - TOL - PAD) * spd / 60)
            spread_nm = max_route_d - min_route_d
            spread_min = TOL * 2
            if s > max_b:
                issues.append((icao, f"slider {s} capped to {max_b}min", td))
    print(f"Aircraft count (excl heli/glider): {len([x for x in fleet if fleet[x]['class'] not in ('HELI','GLIDER')])}")
    print(f"Long haul blocked (<120min max): {len([i for i in issues if 'cannot' in i[1]])}")
    print("\n=== Speed / max-block sample (8hr slider) ===\n")
    print(f"{'ICAO':<8} {'class':<10} {'spd':>4} {'maxD':>6} {'maxBlk':>7} {'tgt8h':>6} {'±30nm':>7}")
    for icao in sorted(fleet.keys()):
        spec = fleet[icao]
        if spec["class"] in ("HELI", "GLIDER"):
            continue
        spd = block_speed(icao, spec)
        mb = max_achievable_block(spec["maxD"], spd)
        td = target_dist(480, spd, spec["maxD"])
        band = TOL * 2 * spd / 60
        print(f"{icao:<8} {spec['class']:<10} {spd:>4} {spec['maxD']:>6.0f} {mb:>7} {td:>6.0f} {band:>7.0f}")

    print("\n=== Systematic error: target dist block vs slider (should equal slider) ===\n")
    for icao in ["B738", "C680", "C700", "DC6B", "A400", "B77W", "E190"]:
        if icao not in fleet:
            continue
        spec = fleet[icao]
        spd = block_speed(icao, spec)
        for s in [120, 360, 480, 720]:
            td = target_dist(s, spd, spec["maxD"])
            blk = block_mins(td, spd)
            print(f"  {icao} slider {s:>3} -> dist {td:>5.0f}nm block {blk:>3} (delta {blk-s:+d})")

if __name__ == "__main__":
    audit()

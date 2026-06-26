import json
import os
import re
import subprocess
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
issues = []
warnings = []

# --- 1. Version sync ---
loader = open(os.path.join(BASE, "loader.js"), encoding="utf-8").read()
version_json = json.load(open(os.path.join(BASE, "version.json"), encoding="utf-8-sig"))
app_v = re.search(r'APP_VERSION\s*=\s*"([^"]+)"', loader)
loader_v = app_v.group(1) if app_v else None
file_v = version_json.get("version")
if loader_v != file_v:
    issues.append(f"Version mismatch: loader.js={loader_v}, version.json={file_v}")
else:
    print(f"OK versions: {loader_v}")

# --- Parse missions-db.js ---
text = open(os.path.join(BASE, "missions-db.js"), encoding="utf-8").read()
missions = []
for m in re.finditer(r"\{\s*type:\s*(\d+),\s*name:\s*\"([^\"]+)\"([^}]*)\}", text):
    t, name, rest = int(m.group(1)), m.group(2), m.group(3)
    entry = {"type": t, "name": name}
    pm = re.search(r'pool:\s*"([^"]+)"', rest)
    if pm:
        entry["pool"] = pm.group(1)
    missions.append(entry)

chunk = re.search(r"const scenarioDB = \{(.*)\n\};", text, re.S).group(1)
pools = {}
uses = {}
for pm in re.finditer(r"(?:^|\n)\s*'?([^':\n]+)'?:\s*\[", chunk):
    pool = pm.group(1).strip("'\"")
    start = pm.end()
    depth = 1
    i = start
    while i < len(chunk) and depth:
        if chunk[i] == "[":
            depth += 1
        elif chunk[i] == "]":
            depth -= 1
        i += 1
    body = chunk[start : i - 1]
    ids = []
    for em in re.finditer(r'imgId:\s*(\d+).*?payload:\s*"([^"]+)"', body, re.S):
        img_id = int(em.group(1))
        ids.append(img_id)
        uses.setdefault(img_id, []).append((pool, em.group(2)))
    pools[pool] = ids

for um in re.finditer(r"imgId:\s*(\d+),\s*missionType:\s*(\d+)", text):
    uses.setdefault(int(um.group(1)), []).append(("uniqueMissions", f"type {um.group(2)}"))

referenced = set(uses.keys())
for m in re.finditer(r"\{\s*type:\s*(\d+),", text):
    t = int(m.group(1))
    if t <= 12:
        referenced.add(t)

# --- 2. Images on disk ---
img_dir = os.path.join(BASE, "images-missions")
on_disk = set()
if os.path.isdir(img_dir):
    for f in os.listdir(img_dir):
        m = re.match(r"mission(\d+)\.jpg$", f, re.I)
        if m:
            on_disk.add(int(m.group(1)))

missing = sorted(referenced - on_disk)
unused = sorted(on_disk - referenced)
print(f"Referenced imgIds: {len(referenced)}, on disk: {len(on_disk)}")
if missing:
    issues.append(f"Missing image files: {','.join(map(str, missing))}")
else:
    print("OK all referenced images on disk")
if unused:
    warnings.append(f"Unused images on disk: {','.join(map(str, unused))}")

# --- 3. Long-haul scenario consistency ---
lh_block = re.search(r"const LONG_HAUL_SCENARIOS_BY_MISSION = \{(.*?)\};", text, re.S).group(1)
lh_map = {}
for m in re.finditer(r"(\d+):\s*\[([^\]]+)\]", lh_block):
    lh_map[int(m.group(1))] = [int(x.strip()) for x in m.group(2).split(",") if x.strip()]

type_pool = {m["type"]: m["pool"] for m in missions if "pool" in m}
for mtype, ids in sorted(lh_map.items()):
    pool = type_pool.get(mtype)
    if not pool:
        issues.append(f"Long-haul type {mtype} has no pool in missionMatrix")
        continue
    pool_ids = set(pools.get(pool, []))
    for img in ids:
        if img not in pool_ids:
            issues.append(f"Long-haul type {mtype} ({pool}): imgId {img} not in pool")

if not any("Long-haul" in i for i in issues):
    print("OK long-haul scenario lists match pools")

# --- 4. Duplicate imgIds ---
dups = {k: v for k, v in uses.items() if len(v) > 1}
print(f"Duplicate imgIds across pools: {len(dups)}")

# Cross-category (different payload, not known intentional pairs)
known_pairs = {
    frozenset({"commercial", "commercial-regional"}),
    frozenset({"lightFreight", "regionalFreight"}),
    frozenset({"regionalFreight", "heavyFreight"}),
    frozenset({"heavyFreight-MIL", "longHaulFreight-MIL"}),
    frozenset({"executive", "longHaulExecutive"}),
    frozenset({"tacticalJet-MIL", "reconnaissance-MIL"}),
    frozenset({"uniqueMissions", "surveyServices"}),
    frozenset({"uniqueMissions", "vintageOps"}),
    frozenset({"executive", "lightPax"}),
}
cross = []
for img_id, entries in sorted(dups.items()):
    pools_set = {e[0] for e in entries}
    payloads = {e[1] for e in entries}
    if len(payloads) > 1:
        if not any(pools_set <= kp or pools_set == kp for kp in known_pairs):
            if not (pools_set <= {"executive", "lightPax", "longHaulExecutive"}):
                cross.append((img_id, entries))

if cross:
    for img_id, entries in cross:
        warnings.append(f"Cross-pool duplicate imgId {img_id} with different payloads: {[e[0] for e in entries]}")
else:
    print("OK no unexpected cross-category duplicate imgIds")

# --- 5. New split imgIds single-pool check ---
for fid in (165, 70, 172, 228, 229, 230, 234):
    entries = uses.get(fid, [])
    if fid in (228, 229, 230) and len(entries) != 1:
        issues.append(f"imgId {fid} should be in exactly 1 pool, found {len(entries)}")
    if fid in (165, 70, 172) and len(entries) != 1:
        issues.append(f"imgId {fid} should be single-pool after split, found {len(entries)}: {[e[0] for e in entries]}")

# --- 6. vintageProplinerFreight ---
vpf = pools.get("vintageProplinerFreight", [])
if set(vpf) != {8, 9, 134, 204}:
    warnings.append(f"vintageProplinerFreight imgIds: {sorted(vpf)} (expected 8,9,134,204)")

# --- 7. dispatch-engine logbook continue ---
de = open(os.path.join(BASE, "dispatch-engine.js"), encoding="utf-8").read()
if "getLastLogbookArrival" not in de:
    issues.append("dispatch-engine.js missing getLastLogbookArrival")
elif 'localStorage.getItem("dispatcher_last_arrival")' in de and de.count('getLastLogbookArrival()') < 2:
    issues.append("toggleLastArrival may still read stale dispatcher_last_arrival cache")
else:
  toggle_block = re.search(r"function toggleLastArrival\(\)[\s\S]*?\n\}", de)
  if toggle_block and "getLastLogbookArrival()" in toggle_block.group(0):
      print("OK continue-from-last reads logbook")
  else:
      issues.append("toggleLastArrival does not use getLastLogbookArrival()")
if "syncLastArrivalFromLogbook" in de and "removeLogbookEntry" in de:
    rm = re.search(r"function removeLogbookEntry[\s\S]*?\n\}", de)
    if rm and "syncLastArrivalFromLogbook" in rm.group(0):
        print("OK logbook delete syncs last arrival")
    else:
        issues.append("removeLogbookEntry does not sync last arrival")

# --- 6. Fleet ↔ mission eligibility ---
import subprocess
audit_fm = subprocess.run(
    [sys.executable, os.path.join(BASE, "scripts", "audit-fleet-missions.py")],
    capture_output=True,
    text=True,
    cwd=BASE,
)
if audit_fm.returncode != 0:
    for line in audit_fm.stdout.splitlines():
        if "[ERROR]" in line:
            issues.append(line.strip())
    if not any("[ERROR]" in line for line in audit_fm.stdout.splitlines()):
        issues.append("audit-fleet-missions.py failed")
else:
    print("OK fleet-mission eligibility audit")

# --- Report ---
print("\n=== ISSUES (bugs) ===")
print("\n".join(issues) if issues else "none")
print("\n=== WARNINGS (informational) ===")
print("\n".join(warnings) if warnings else "none")

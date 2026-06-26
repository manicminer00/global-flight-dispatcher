#!/usr/bin/env python3
"""
Vector Flight Dispatch — interactive verification utility.

Run:  python scripts/vfd-verify.py
  or double-click verify-vfd.bat (Windows)

Verification state is stored in scripts/verification-manifest.json.
Each airport ICAO and each fleet aircraft type is tracked individually.
New or edited entries are audited on the next run; unchanged verified entries are skipped.
Use --force to re-audit everything. Use --stamp to write vfVerified tags into sources.
"""
from __future__ import annotations

import argparse
import os
import sys

# Allow running as script from repo root or scripts/
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from vfd_verify_lib import (  # noqa: E402
    AIRPORT_AUDIT_FIELDS,
    AIRPORT_DATABASES,
    BASE,
    ICAO_POLICY,
    LEGACY_AIRPORT_VAR_NAMES,
    MSFS_ICAO_PRIORITY_DATABASES,
    airports_needing_audit,
    audit_airport_db,
    audit_dispatch_code,
    audit_fleet_specs,
    bump_version,
    count_airport_verification,
    count_fleet_verification,
    deploy_file_list,
    file_checksum,
    fleet_needing_audit,
    is_airport_db_verified,
    is_fleet_verified,
    is_missions_verified,
    load_manifest,
    merge_airport_verification,
    merge_fleet_verification,
    mark_missions_verified,
    parse_airport_db,
    parse_fleet_full,
    remove_exact_duplicate_airport_lines,
    run_subprocess,
    save_manifest,
    utc_now,
)


def print_header(title: str) -> None:
    print()
    print("=" * 60)
    print(title)
    print("=" * 60)


def print_results(errors: list[str], warnings: list[str]) -> bool:
    print("\n--- ERRORS ---")
    if errors:
        for e in errors:
            print(f"  [ERROR] {e}")
    else:
        print("  None")
    print("\n--- WARNINGS ---")
    if warnings:
        for w in warnings:
            print(f"  [WARN] {w}")
    else:
        print("  None")
    ok = not errors
    print(f"\nResult: {'PASS' if ok else 'FAIL'} ({len(errors)} error(s), {len(warnings)} warning(s))")
    return ok


def _airport_menu_label(manifest: dict, db_file: str) -> str:
    path = os.path.join(BASE, db_file)
    if not os.path.isfile(path):
        return ""
    airports = parse_airport_db(path)
    verified, total = count_airport_verification(manifest, db_file, airports)
    if total == 0:
        return ""
    if verified == total:
        return f" [{verified}/{total} verified]"
    return f" [{verified}/{total} verified, {total - verified} pending]"


def _fleet_menu_label(manifest: dict) -> str:
    path = os.path.join(BASE, "fleet-db.js")
    if not os.path.isfile(path):
        return ""
    fleet = parse_fleet_full()
    verified, total = count_fleet_verification(manifest, fleet)
    if total == 0:
        return ""
    if verified == total:
        return f" [{verified}/{total} verified]"
    return f" [{verified}/{total} verified, {total - verified} pending]"


def verify_airport_db(db_info: dict, manifest: dict, *, force: bool, stamp: bool, dedupe: bool) -> bool:
    path = os.path.join(BASE, db_info["file"])
    if not os.path.isfile(path):
        print(f"File not found: {db_info['file']}")
        return False

    checksum = file_checksum(path)
    if dedupe:
        removed = remove_exact_duplicate_airport_lines(path)
        if removed:
            print(f"Removed {removed} exact duplicate line(s) from {db_info['file']}")
            checksum = file_checksum(path)

    airports = parse_airport_db(path)
    verified, total = count_airport_verification(manifest, db_info["file"], airports)
    need = airports_needing_audit(manifest, db_info["file"], airports, force=force)

    print("Airport field checks:")
    for field in AIRPORT_AUDIT_FIELDS:
        print(f"  • {field}")
    print()

    if not force and not need and is_airport_db_verified(manifest, db_info["file"], checksum):
        entry = manifest["airports"][db_info["file"]]
        print(
            f"SKIP — all {total} airports verified "
            f"(last full pass {entry.get('verifiedAt')}, checksum match)"
        )
        return True

    if need:
        print(f"Auditing {len(need)} airport(s) in {db_info['file']} ({verified} already verified, skipped)")
    else:
        print(f"Re-auditing all {total} airports in {db_info['file']} (--force)")
    if db_info["file"] in MSFS_ICAO_PRIORITY_DATABASES:
        print(f"  ICAO safeguard: {ICAO_POLICY}")

    errors, warnings = audit_airport_db(db_info["file"], airports, only=need if not force else None)
    ok = print_results(errors, warnings)

    if ok and need:
        passed = {str(ap.get("icao", "")).strip().upper() for ap in need if ap.get("icao")}
        merge_airport_verification(manifest, db_info["file"], airports, passed, stamp_file=stamp)
        save_manifest(manifest)
        verified_after, _ = count_airport_verification(manifest, db_info["file"], airports)
        print(
            f"Marked {len(passed)} airport(s) verified in manifest"
            + (f" ({verified_after}/{total} total)" if verified_after < total else " (database complete)")
            + (" + stamped source file" if stamp else "")
        )
    elif ok and force:
        passed = {str(ap.get("icao", "")).strip().upper() for ap in airports if ap.get("icao")}
        merge_airport_verification(manifest, db_info["file"], airports, passed, stamp_file=stamp)
        save_manifest(manifest)
        print(f"Marked all {len(passed)} airports verified in manifest" + (" + stamped source file" if stamp else ""))
    return ok


def verify_all_airports(manifest: dict, *, force: bool, stamp: bool, dedupe: bool) -> bool:
    all_ok = True
    for db in AIRPORT_DATABASES:
        print_header(f"Airport DB {db['menu']}: {db['label']}")
        if not verify_airport_db(db, manifest, force=force, stamp=stamp, dedupe=dedupe):
            all_ok = False
    return all_ok


def verify_fleet(manifest: dict, *, force: bool, stamp: bool) -> bool:
    path = os.path.join(BASE, "fleet-db.js")
    if not os.path.isfile(path):
        print("File not found: fleet-db.js")
        return False

    checksum = file_checksum(path)
    fleet = parse_fleet_full()
    verified, total = count_fleet_verification(manifest, fleet)
    need_types = fleet_needing_audit(manifest, fleet, force=force)

    print("Fleet checks per aircraft:")
    print("  • Required performance fields (range, weights, fuel, runway, tags)")
    print("  • Structural sanity (minD < maxD, oew < mtow, etc.)")
    print("  • POH / developer reference match (scripts/fleet-reference.json when present)")
    print("  • Mission eligibility (audit-fleet-missions.py)")
    print()

    if not force and not need_types and is_fleet_verified(manifest, checksum):
        entry = manifest["fleet"]
        print(
            f"SKIP — all {total} aircraft verified "
            f"(last full pass {entry.get('verifiedAt')}, checksum match)"
        )
        return True

    if need_types:
        print(f"Auditing {len(need_types)} aircraft ({verified} already verified, skipped)")
    else:
        print(f"Re-auditing all {total} aircraft (--force)")

    spec_errors, spec_warnings = audit_fleet_specs(
        fleet, only_types=need_types if not force else None
    )

    print("Running fleet ↔ mission eligibility audit...")
    code, out = run_subprocess("audit-fleet-missions.py")
    print(out)
    mission_errors = [ln.strip() for ln in out.splitlines() if "[ERROR]" in ln]
    mission_warnings = [ln.strip() for ln in out.splitlines() if "[WARN]" in ln]

    if not force and need_types:
        need_set = set(need_types)
        mission_errors = [e for e in mission_errors if any(t in e for t in need_set)]
        mission_warnings = [w for w in mission_warnings if any(t in w for t in need_set)]

    errors = spec_errors + mission_errors
    warnings = spec_warnings + mission_warnings
    if force or len(need_types) >= total:
        ok = code == 0 and not errors
    else:
        ok = not errors
    print_results(errors, warnings)

    if ok and need_types:
        merge_fleet_verification(manifest, fleet, set(need_types), stamp_file=stamp)
        save_manifest(manifest)
        verified_after, _ = count_fleet_verification(manifest, fleet)
        print(
            f"Marked {len(need_types)} aircraft verified in manifest"
            + (f" ({verified_after}/{total} total)" if verified_after < total else " (fleet complete)")
            + (" + stamped _vfVerified tags" if stamp else "")
        )
    elif ok and force:
        merge_fleet_verification(manifest, fleet, set(fleet.keys()), stamp_file=stamp)
        save_manifest(manifest)
        print(f"Marked all {total} aircraft verified in manifest" + (" + stamped _vfVerified tags" if stamp else ""))
    return ok


def verify_missions_and_dispatch(manifest: dict, *, force: bool, stamp: bool) -> bool:
    path = os.path.join(BASE, "missions-db.js")
    checksum = file_checksum(path)

    if not force and is_missions_verified(manifest, checksum):
        entry = manifest["missions"]
        print(f"SKIP — missions/dispatch already verified ({entry.get('verifiedAt')}, checksum match)")
        return True

    print_header("Missions, dispatch logic, images, long-haul math")
    errors, warnings, log = audit_dispatch_code()
    if log:
        print(log)
    ok = print_results(errors, warnings)

    if ok:
        mark_missions_verified(manifest, stamp_file=stamp)
        manifest.setdefault("code", {})["dispatch"] = {
            "verified": True,
            "verifiedAt": utc_now(),
            "checksum": file_checksum(os.path.join(BASE, "dispatch-engine.js")),
        }
        save_manifest(manifest)
        print("Missions/dispatch marked verified" + (" + stamped vfVerified on mission types" if stamp else ""))
    return ok


def pre_deploy_run(manifest: dict, *, force: bool, stamp: bool, dedupe: bool) -> bool:
    print_header("Pre-deploy verification (all checks)")
    ok = True
    ok = verify_all_airports(manifest, force=force, stamp=stamp, dedupe=dedupe) and ok
    ok = verify_fleet(manifest, force=force, stamp=stamp) and ok
    ok = verify_missions_and_dispatch(manifest, force=force, stamp=stamp) and ok

    print_header("Deploy reminder")
    if ok:
        print("All checks passed. Core files to upload:")
        for f in deploy_file_list():
            print(f"  • {f}")
        print("\nAlso upload images-missions/ if any mission images changed.")
        print("Bump version (loader.js + version.json together) before deploy.")
    else:
        print("Fix errors above before deploying.")
    return ok


def show_manifest_status(manifest: dict) -> None:
    print_header("Verification status")
    print("Airport databases (per-ICAO; legacy manifest entries require re-audit):")
    for db in AIRPORT_DATABASES:
        path = os.path.join(BASE, db["file"])
        if os.path.isfile(path):
            airports = parse_airport_db(path)
            verified, total = count_airport_verification(manifest, db["file"], airports)
            if verified == total and total > 0:
                entry = manifest.get("airports", {}).get(db["file"], {})
                print(
                    f"  [{db['menu']}] {db['label']}: complete ({verified}/{total}, {entry.get('verifiedAt', '?')})"
                )
            else:
                print(f"  [{db['menu']}] {db['label']}: {verified}/{total} verified, {total - verified} pending")
        else:
            print(f"  [{db['menu']}] {db['label']}: file missing")

    fleet_path = os.path.join(BASE, "fleet-db.js")
    if os.path.isfile(fleet_path):
        fleet = parse_fleet_full()
        verified, total = count_fleet_verification(manifest, fleet)
        fleet_entry = manifest.get("fleet", {})
        if verified == total and total > 0:
            print(f"\nFleet: complete ({verified}/{total}, {fleet_entry.get('verifiedAt', '?')})")
        else:
            print(f"\nFleet: {verified}/{total} verified, {total - verified} pending")
    else:
        print("\nFleet: fleet-db.js missing")

    missions = manifest.get("missions", {})
    print(
        f"Missions/dispatch: {'OK ' + missions.get('verifiedAt', '') if missions.get('verified') else 'not verified'}"
    )


def interactive_menu(force: bool, stamp: bool, dedupe: bool) -> int:
    manifest = load_manifest()
    while True:
        print()
        print("Vector Flight Dispatch — Verification")
        print("-" * 40)
        print("AIRPORT DATABASES (new/edited ICAOs audited; unchanged entries skipped)")
        for db in AIRPORT_DATABASES:
            mark = _airport_menu_label(manifest, db["file"])
            print(f"  {db['menu']}. {db['label']}{mark}")
        fleet_mark = _fleet_menu_label(manifest)
        print()
        print("  A. Verify ALL airport databases")
        print(f"  F. Verify fleet (fleet-db.js){fleet_mark}")
        print("  M. Verify missions + dispatch + HTML dependencies")
        print("  P. Full pre-deploy check (A + F + M)")
        print("  S. Show verification status")
        print("  V. Bump version (patch) — loader.js + version.json")
        print("  Q. Quit")
        print()
        choice = input("Select option: ").strip().upper()

        if choice == "Q":
            return 0
        if choice == "S":
            show_manifest_status(manifest)
            continue
        if choice == "V":
            new_v = bump_version("patch")
            print(f"Version bumped to {new_v}")
            manifest = load_manifest()
            continue
        if choice == "A":
            verify_all_airports(manifest, force=force, stamp=stamp, dedupe=dedupe)
            manifest = load_manifest()
            continue
        if choice == "F":
            verify_fleet(manifest, force=force, stamp=stamp)
            manifest = load_manifest()
            continue
        if choice == "M":
            verify_missions_and_dispatch(manifest, force=force, stamp=stamp)
            manifest = load_manifest()
            continue
        if choice == "P":
            code = 0 if pre_deploy_run(manifest, force=force, stamp=stamp, dedupe=dedupe) else 1
            manifest = load_manifest()
            if code != 0:
                return code
            continue

        try:
            num = int(choice)
        except ValueError:
            print("Invalid choice.")
            continue

        db = next((d for d in AIRPORT_DATABASES if d["menu"] == num), None)
        if not db:
            print("Invalid choice. Use 1–2.")
            continue
        print_header(f"Airport DB {num}: {db['label']}")
        verify_airport_db(db, manifest, force=force, stamp=stamp, dedupe=dedupe)
        manifest = load_manifest()


def main() -> int:
    parser = argparse.ArgumentParser(description="VFD verification utility")
    parser.add_argument("--force", action="store_true", help="Re-audit even if checksum matches manifest")
    parser.add_argument("--stamp", action="store_true", help="Write vfVerified/_vfVerified tags into .js sources")
    parser.add_argument(
        "--dedupe-exact",
        action="store_true",
        help="Remove exact 1:1 duplicate airport lines before auditing (copy-paste mistakes only)",
    )
    parser.add_argument(
        "--predeploy",
        action="store_true",
        help="Non-interactive full pre-deploy check (exit 1 on errors)",
    )
    parser.add_argument("--airport", type=int, metavar="N", help="Verify airport DB menu number 1–2")
    parser.add_argument("--fleet", action="store_true", help="Verify fleet only")
    parser.add_argument("--missions", action="store_true", help="Verify missions/dispatch only")
    parser.add_argument("--status", action="store_true", help="Print verification status and exit")
    args = parser.parse_args()

    manifest = load_manifest()

    if args.status:
        show_manifest_status(manifest)
        return 0

    if args.predeploy:
        return 0 if pre_deploy_run(manifest, force=args.force, stamp=args.stamp, dedupe=args.dedupe_exact) else 1
    if args.airport:
        db = next((d for d in AIRPORT_DATABASES if d["menu"] == args.airport), None)
        if not db:
            print("Invalid --airport (use 1–9)")
            return 1
        ok = verify_airport_db(db, manifest, force=args.force, stamp=args.stamp, dedupe=args.dedupe_exact)
        return 0 if ok else 1
    if args.fleet:
        ok = verify_fleet(manifest, force=args.force, stamp=args.stamp)
        return 0 if ok else 1
    if args.missions:
        ok = verify_missions_and_dispatch(manifest, force=args.force, stamp=args.stamp)
        return 0 if ok else 1

    return interactive_menu(force=args.force, stamp=args.stamp, dedupe=args.dedupe_exact)


if __name__ == "__main__":
    raise SystemExit(main())

"""Shared helpers for VECTOR Navigraph import scripts (dev/tools/)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data"
SQLITE_CANDIDATES = [
    ROOT.parent / "little_navmap_navigraph.sqlite",
    Path(r"C:\Users\toby2\AppData\Roaming\ABarthel\little_navmap_db\little_navmap_navigraph.sqlite"),
]
ICAO_RE = re.compile(r'icao:\s*"([^"]+)"')


def find_sqlite() -> Path:
    for path in SQLITE_CANDIDATES:
        if path.is_file():
            return path
    raise SystemExit(
        "Navigraph sqlite not found. Copy little_navmap_navigraph.sqlite to the workspace parent folder."
    )


def vector_icaos() -> set[str]:
    icaos: set[str] = set()
    for name in ("airports-asobo-db.js", "airports-thirdparty-db.js"):
        text = (ROOT / name).read_text(encoding="utf-8")
        icaos.update(m.group(1).strip().upper() for m in ICAO_RE.finditer(text))
    return icaos


def ensure_data_dir() -> Path:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    return DATA_DIR

"""MSFS scenery ICAO -> real-world ICAO for display names (IRL: suffix)."""
import re

from build_irl_map import build_map

# Verified overrides when OurAirports lacks icao_code but DFS/Wikipedia documents the code.
MANUAL_IRL_ICAO: dict[str, str] = {}

MSFS_IRL_ICAO: dict[str, str] = {**build_map(), **MANUAL_IRL_ICAO}

_ICAO_FIELD_RE = re.compile(r"^[A-Z0-9]{4}$")
_IRL_SUFFIX = re.compile(r"\s+\(IRL:[A-Z0-9]{4}\)$", re.I)


def irl_icao_from_row(msfs_icao: str, oa_row: dict) -> str | None:
    """Return real-world ICAO from an OurAirports row when it differs from the MSFS code."""
    msfs = msfs_icao.strip().upper()
    for key in ("icao_code", "gps_code", "local_code", "iata_code"):
        code = (oa_row.get(key) or "").strip().upper()
        if _ICAO_FIELD_RE.match(code) and not code.startswith("DE-") and code != msfs:
            return code
    manual = MSFS_IRL_ICAO.get(msfs)
    return manual if manual and manual != msfs else None


def append_irl_suffix(name: str, msfs_icao: str, irl_icao: str | None = None) -> str:
    """Return the display name without an IRL suffix (MSFS ICAO is shown separately in the UI)."""
    return _IRL_SUFFIX.sub("", name.strip())

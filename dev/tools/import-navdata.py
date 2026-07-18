#!/usr/bin/env python3
"""Regenerate all VECTOR Navigraph data files in data/."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent


def run_module(name: str) -> None:
    path = TOOLS / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    module.main()


def main() -> None:
    sys.path.insert(0, str(TOOLS))
    for script in (
        "import-ils-strict",
        "import-navigraph-airports",
        "import-dest-approaches",
    ):
        print(f"\n=== {script} ===")
        run_module(script)
    print("\nAll Navigraph data files updated in data/.")


if __name__ == "__main__":
    main()

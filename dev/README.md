# VECTOR v3.0 — development folder

## WEB vs DEV

**The live website is the repository root** — see **`WEB.md`**. GitHub Pages deploys from there; those files cannot move without breaking the site.

**Everything under `dev/` is local tooling only** — never loaded by the browser.

| Path | Purpose |
|------|---------|
| **`dev/tools/`** | Navigraph import scripts (Python) |
| **`dev/scripts/`** | Verify, audit, export, pre-upload checks |
| **Root `*.bat`** | Shortcuts: `master-verify.bat`, `verify-vfd.bat`, `dispatch-fleet-smoke.bat` |

---

## Regenerate Navigraph data

```bat
python dev\tools\import-navdata.py
```

Output → **`data/`**. Hard-refresh (Ctrl+F5) after regenerating.

---

## Verify (before upload)

| Command | Purpose |
|---------|---------|
| `verify-vfd.bat` | Interactive airport/fleet audit |
| `master-verify.bat` | Full pre-upload check (+ version bump) |
| `dispatch-fleet-smoke.bat` | Fleet dispatch smoke test |

---

## Git backup

```bat
git add .
git commit -m "Checkpoint — description"
git push
```

Experiment sandbox — do not `git push live main` until tested.

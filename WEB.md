# WEB — files that power the live site

GitHub Pages serves **from this repository root**. Do not move these into a subfolder without changing your deploy setup.

## Runtime (browser loads these)

| File / folder | Role |
|---------------|------|
| `index.html` | App shell |
| `loader.js` | Loads all JS in order |
| `dispatch-engine.js` | Dispatch logic |
| `fleet-db.js`, `missions-db.js` | Fleet + missions |
| `airports-asobo-db.js`, `airports-thirdparty-db.js` | Airports |
| `mission-assignment-core.js`, `mission-assignments-data.js` | Assignments |
| `short-haul-routes-db.js` | Route pools |
| `data/*.js` | Generated Navigraph navdata |
| `version.json` | Release version |
| `images/`, `images-missions/`, `favicon/` | Assets |

## Everything else

See **`dev/README.md`** — verify scripts (`dev/scripts/`), import tools (`dev/tools/`), editors, CSV exports, etc.

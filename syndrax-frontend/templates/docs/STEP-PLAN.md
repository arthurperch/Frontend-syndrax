# Template build order (basic → advanced)

**Owner:** Danish (+ Hermes)  
**Not in this track:** Automation Studio (Oleg)

| Step | What | Done when | Status |
|------|------|-----------|--------|
| **0** | Foundation — schema + folders + plan + `index.json` | Catalog lists every template by id | **done** |
| **1** | Browse locally — catalog page (pick → read → copy) | `/templates.html` works | **done** |
| **2** | Ship data with the app — `lab/templates/` on :3002 | `/templates/catalog.json` 200 | **done** |
| **3** | Message Tool — fill tokens, copy | Workspace Message Tool | **done** |
| **4** | Description Builder — HTML styles + preview | 5 styles in dashboard | **done** |
| **5** | Jobs “Templates” presets — load workflow packs | One-click install packs on Jobs/Workspace | **done** |
| **6** | Share metadata UI — draft/ready/shared | Share tab on `/templates.html` | **done** |
| **7** | AI remix — 3 local variants from `promptHint` | Remix tab + Message Tool Remix ×3 | **done** (local/offline-safe) |
| **8** | Inspo images from prompts | Images under `/templates/inspo/` (exploratory) | **done** |
| **9** | Oleg handshake — `automation-module` import | Import tab + Jobs import + sample module | **done** |

## How to use (lab)
- Catalog: http://localhost:3002/templates.html  
  Tabs: **Browse · Share · Remix · Inspo · Import**
- App: http://localhost:3002/app → Workspace or Jobs  
  Template packs buttons + Import module JSON
- Sample Studio export: `automation-modules/ebay-open-search-type/`

## Notes
- Remix is **local** (no API keys in the browser). Cloud LLM remix can plug in later.
- Inspo images are **exploratory** — not auto-inserted into marketing pages.
- Branch for lab work: `frontend/danish-templates` (push only when you ask).

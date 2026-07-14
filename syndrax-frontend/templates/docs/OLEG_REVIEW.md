# Templates library — review for Oleg

**Author:** Danish · danish@syndrax.io  
**Branch:** `frontend/danish-templates`  
**Repo:** `arthurperch/Frontend-syndrax` (lab)  
**Date:** 2026-07-14  

## Goal
Seed a shareable **template library** for Syndrax seller tools + workflow packs, with:
- Catalog data the app can load
- Local browse / install UI
- Handshake shape for future Automation Studio exports (`automation-module`)
- **Oleg owns Automation Studio** — Danish owns template content + library UX

## What to review

### 1) Catalog content (`templates/catalog.json`, v1.3.1)
**34 templates** total:

| Kind | Count | Notes |
|------|------:|-------|
| Buyer messages | 13 | OOS, ship, delay, refund, cancel, damage, address, invoice, feedback… |
| Listing HTML | 10 | Clean card, specs, story, comparison, mobile, bundle, parts, refurb, fashion, digital |
| Workflow packs | 8 | Research→List, sync/reprice, trust, morning health, EOD, returns triage, bulk list, repricer watch |
| Inspo | 2 | Product-UI mock prompts + exploratory PNGs |
| Automation module sample | 1 | Studio export shape for Phase-7 Archive handshake |

Full list: `templates/docs/CATALOG.md`  
Build order / ownership: `templates/docs/STEP-PLAN.md`

### 2) App UX (Workflows tab)
- Right panel **Library & saved** — packs grouped (Daily / List & grow / Price / Service / Studio)
- Only **uninstalled** packs show under “Add a pack”
- Saved automations: clean rows (title, step chips, Run/Remove) — no triple-install spam
- Dedup on install + load
- Message Tool + Description Builder open fill/preview/copy from catalog

### 3) Local-only preview login
- `login.html` → **Enter app (local preview)** only on localhost
- `auth-cognito.js` → `enableLocalDevSession()` — **localhost only**, not production
- Lets Danish open `/app` without Cognito while testing templates
- Cloud APIs may still fail in local preview (expected)

### 4) Standalone library page
- `/templates.html` — Browse / Share / Remix / Inspo / Import
- `?installAll=1` or **Install all packs** button
- `templates/engine.js` — shared fill/remix/import helpers

## Out of scope / not claimed done
- Live eBay execution of every workflow step (many modules still hub/todo)
- Production port to `arthurperch/syndrax` / www.syndrax.io
- Real cloud AI remix (local offline remix only)
- Full team shared backend for templates
- Automation Studio product (Oleg)

## How to try (lab)
```text
SITE_PORT=3002 node dev-server.mjs
→ http://localhost:3002/templates.html
→ http://localhost:3002/login  (local preview button)
→ Workflows → Library & saved
```

## Ask for Oleg
1. Content direction OK for v1 seed? Any packs to drop/rename?
2. `automation-module` JSON sample close enough for Studio Archive export?
3. Local preview login OK for Danish machines (localhost only)?
4. When ready: port to production after lab sign-off

## Files in this PR (lab)
- `templates/*` (catalog, engine, docs, inspo images)
- `templates.html`, `catalog.json`
- `dashboard.js`, `app.css`, `app.html`
- `auth-cognito.js`, `login.html` (local preview only)

No secrets committed.

# Templates library — review for Oleg (v1.4)

**Author:** Danish · danish@syndrax.io  
**Branch:** `frontend/danish-templates`  
**Repo:** `arthurperch/Frontend-syndrax` (lab)  
**PR:** https://github.com/arthurperch/Frontend-syndrax/pull/8  

## Goal
Shareable **template library** for seller messages, listing HTML, and workflow packs — with clean app UX.  
**Oleg = Automation Studio.** Danish = template content + library/UX.

## What’s in v1.4 (high-value pass)
- **44 templates** (was 34): real eBay seller tone on core messages
- **6 situation messages:** holiday delay, customs, partial ship, missing bundle piece, not as described, photo request
- **4 niche listings:** electronics dropship, auto parts VIN, home dims, collectible condition
- **Workspace templates strip:** Message Tool / Description Builder / Workflow packs / library link
- **Cleaner Workflows panel:** grouped “Add a pack”, clean Saved rows, better empty states
- Localhost-only app preview login (not production)

## Try (lab)
```text
SITE_PORT=3002 node dev-server.mjs
→ /templates.html  (44 templates)
→ /login → Enter app (local preview)
→ Workspace (templates strip)
→ Workflows (Library & saved)
```

## Asks
1. Content direction OK for v1 seed?
2. `automation-module` sample OK for Studio Archive?
3. Localhost preview login OK?
4. Lab sign-off before production port?

## Out of scope
Live eBay run of every step · production www · cloud AI remix · multi-user backend · Automation Studio product

No secrets in this PR.

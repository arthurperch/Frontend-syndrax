# Syndrax Homepage — Full Context for Cursor AI

## What this file is
This documents everything built on the Syndrax homepage (index.html). 
Read this before making any changes so you understand the full design system, 
every section, every CSS class, and how it all connects.

---

## Project location
```
C:\Users\LENOVO\Documents\APP\Syndrax Frontend\Frontend-syndrax\syndrax-frontend\
```

## Key files
| File | Purpose |
|---|---|
| `index.html` | Homepage — full structure |
| `home.css` | All homepage styles |
| `home.js` | All homepage JavaScript |
| `marketing-nav.css` | Navigation bar styles |
| `assets/icons/marketplaces/` | Real brand SVGs — Amazon, eBay, Shopify, Walmart, Etsy, TikTok, Meta, WooCommerce, AliExpress, Facebook |

## Dev server
```bash
SITE_PORT=3002 node dev-server.mjs
# Open: http://localhost:3002
```

## Git branch
```
frontend/danish-edits  ←  always work here, NEVER commit to main
```

---

## Design System — STRICT RULES

### Colors — only these 4
| Role | Value | Usage |
|---|---|---|
| Base | `#000000` | Every background |
| Text | `#ffffff` | All headlines and body |
| Muted | `rgba(255,255,255,0.45)` | Subtext, labels |
| Accent | `linear-gradient(135deg, #888 0%, #d4d4d4 40%, #f5f5f5 50%, #d4d4d4 60%, #888 100%)` | Metallic silver — buttons, logo, highlights |

### Functional colors (signals only)
- `#22c55e` — green — live/active/synced status dots ONLY
- `#f59e0b` — amber — warning/syncing status ONLY
- **NO blues, NO purples, NO reds** anywhere in the UI

### Typography
- Headlines: `Space Grotesk` — weight 800, letter-spacing -0.04em
- Body/labels: `IBM Plex Mono` — monospace, small, letter-spacing 0.08em
- Subtext: `rgba(255,255,255,0.45)` at 15-17px

### Cards
- Background: `#0a0a0a` or `#000`
- Border: `1px solid rgba(255,255,255,0.07)`
- Border-radius: `16px`
- Hover: border brightens to `rgba(255,255,255,0.14)`, `translateY(-2px)`

### Buttons
- Primary: silver metallic gradient background, `#000` text, weight 700
- Ghost: transparent, white border at 20% opacity, white text
- Hover: `brightness(1.1)`, `scale(1.02)`, subtle glow

### Animations
- All transitions: `cubic-bezier(0.16, 1, 0.3, 1)`
- Hover transition: `220ms`
- Scroll reveals: `opacity 0 → 1`, `translateY(18px → 0)`, `680ms`
- Nothing snaps. Everything glides.

---

## CSS Class Reference

### Layout
```css
.sx-hero          /* Hero section — full viewport, 2-column grid */
.sx-hero__grid    /* 1fr 1fr grid, max-width 1200px */
.sx-hero__copy    /* Left column — headline, buttons, stats */
.sx-hero__globe-wrap  /* Right column — globe, marquee, toasts */
.sx-features      /* Bento grid section */
.sx-bento         /* 12-column CSS grid */
.sx-axis          /* Meet AXIS section — 2 column */
.sx-outcomes      /* BY THE NUMBERS section */
.sx-story         /* Customer story section */
.sx-cta-final     /* Final CTA section */
```

### Navigation
```css
.navbar           /* Fixed top nav — blur backdrop */
.sx-logo          /* SYNDRAX wordmark */
.sx-wordmark      /* The text logo — silver shimmer on hover */
.nav-cta          /* "Get Started" button — silver gradient */
```

### Hero elements
```css
.sx-hero__title         /* H1 — "Price everywhere. Sync in seconds." */
.sx-hero__title-muted   /* "Sync in seconds." — 72% opacity */
.sx-hero__sub           /* Subtext paragraph */
.sx-btn--primary        /* Silver gradient CTA button */
.sx-btn--ghost          /* Outlined ghost button */
.sx-hero__inline-stats  /* 4 stats row — 42s · 9 · 0% · 24/7 */
.sx-hero__istat         /* Each stat item */
.sx-hero__partners      /* "Works with" strip + marketplace icons */
```

### Globe (right column)
```css
.sx-stars           /* 12 twinkling star dots */
.sx-globe-glow      /* Breathing blue atmospheric ring */
.sx-hero__globe     /* The Cobe canvas — id="sxGlobe" */
.sx-pulse-rings     /* Container for JS-injected pulse rings */
.sx-sync-toasts     /* Toast notification container */
.sx-hero__globe-stat /* "X,XXX syncs in the last hour" */
.sx-marquee-wrap    /* Infinite scroll marketplace strip */
.sx-marquee-track   /* The scrolling container */
.sx-mq-item         /* Each marketplace logo + name item */
```

### Bento grid cards
```css
.sx-bento__card--a  /* Universal Sync — spans 7 cols */
.sx-bento__card--b  /* AXIS AI repricer — spans 5 cols */
.sx-bento__card--c  /* 42s speed ring — spans 3 cols */
.sx-bento__card--d  /* True P&L — spans 4 cols */
.sx-bento__card--e  /* Cluster Dispatch terminal — spans 5 cols */
.sx-bento__card--f  /* $0 oversell card — spans 3 cols */
```

### Universal Sync card (card A)
```css
.sx-sync-board        /* The live status board container */
.sx-sync-board__row   /* One marketplace row */
.sx-sync-board__dot   /* Status dot — green or amber */
.sx-sync-board__dot--ok    /* Green — synced */
.sx-sync-board__dot--sync  /* Amber pulsing — syncing */
.sx-sync-board__name  /* Marketplace name */
.sx-sync-board__skus  /* SKU count or "syncing..." */
.sx-sync-board__time  /* "Xs ago" counter */
.sx-sync-board__footer /* "Next cycle in Xs" countdown */
```

### AXIS AI card (card B) — live repricer ticker
```css
.sx-ticker            /* Ticker container */
.sx-ticker__header    /* "LIVE REPRICER" + green LED */
.sx-ticker__rows      /* id="axisTickerRows" — JS adds rows here */
.sx-ticker__row       /* One repricing event row */
.sx-ticker__sku       /* SKU identifier */
.sx-ticker__old       /* Old price — strikethrough */
.sx-ticker__arrow--down  /* Green ▼ — price dropped */
.sx-ticker__arrow--up    /* White ▲ — price increased */
.sx-ticker__new       /* New price */
.sx-ticker__footer    /* "X adjustments today" — id="axisTickerCount" */
```

### 42s speed ring card (card C)
```css
.sx-bento__card--speed  /* Pure black card */
.sx-speed-ring          /* Wrapper for SVG ring */
.sx-speed-svg           /* SVG — rotated -90deg */
.sx-speed-track         /* Faint full circle track */
.sx-speed-fill          /* Animated silver arc — sweeps in 42s */
.sx-speed-center        /* "42" number + "sec" label centered */
.sx-speed-label         /* "Full sync · all channels" below ring */
```

### AXIS section
```css
.sx-axis__grid          /* 2-column layout */
.sx-axis__copy          /* Left column — headline, copy, stats */
.sx-axis__title         /* "Meet AXIS." — 88px bold */
.sx-axis__stats-list    /* 3 bold stat rows */
.sx-axis__stat-row      /* One stat — big number + label */
.sx-axis__stat-num      /* 32px bold number */
.sx-axis__terminal-wrap /* Right column */
.sx-axis-dash           /* AXIS live metrics card */
.sx-axis-dash__metrics  /* 4 metric rows with progress bars */
.sx-axis-dash__fill     /* White gradient progress bar fill */
.sx-axis-dash__ekg-canvas  /* id="axisEKG" — canvas EKG line */
```

### Customer story section
```css
.sx-story               /* Full section */
.sx-story__headline     /* "From 2 channels to 9 in 48 hours." */
.sx-story__grid         /* 2-col — before/after + metrics */
.sx-story__before-after /* Left card — before → after */
.sx-story__metrics      /* Right card — 3 outcome stats */
.sx-story__quote        /* Italic quote */
```

---

## JavaScript — Key IDs and Functions

### Important element IDs
```
sxGlobe          — Cobe globe canvas
sxSyncCount      — "2,847 syncs" counter (increments every 2.2s)
sxPulseRings     — pulse ring container (JS injects divs)
sxToasts         — toast notification container
axisTickerRows   — live repricer rows (JS prepends new rows)
axisTickerCount  — "847 adjustments today" counter
axisOpsCount     — AXIS ops/min counter
axisEKG          — EKG canvas (width=600 height=34 hardcoded)
sb-amazon        — Amazon SKU count
sb-amazon-t      — Amazon time ago
sb-next          — Sync countdown "Next in Xs"
speedRing        — SVG circle for 42s sweep animation
```

### Key JS functions / animations
- **Globe**: Cobe via `window.createGlobe`, drag-to-rotate, auto-phi increment 0.0028
- **Pulse rings**: injected div.globe-pulse-ring on each toast, removed after 1.9s
- **Toasts**: cycle through 7 marketplace messages every 3s, max 3 visible
- **Sync board ticker**: each marketplace resets its timer on an interval (8-25s), row flashes green
- **Price repricer**: new row slides into `axisTickerRows` every 2.2s, max 5 rows
- **EKG**: canvas 60fps, scan head moves left-to-right drawing heartbeat shape, wraps seamlessly
- **Scroll reveal**: IntersectionObserver threshold 0.05, adds `is-visible` class, stagger via `--i` CSS var

---

## Section Order (top to bottom)

1. **NAV** — SYNDRAX wordmark, Features/Pricing/Enterprise/About, Log in, Get Started
2. **HERO** — Label, H1, subtext, buttons, inline stats (42s·9·0%·24/7), Works With icons | Globe + toasts + marquee
3. **FEATURES BENTO** — "UNDER THE HOOD" label, "Built around how you actually sell." H2, 6-card grid
4. **AXIS SECTION** — "ALWAYS ON" label, "Meet AXIS." H2, 3 stat rows, buttons | AXIS dash + EKG + terminal feed
5. **OUTCOMES** — "IN PRODUCTION" label, "What fast actually looks like." H2, 4 big numbers
6. **CUSTOMER STORY** — "CUSTOMER STORY" label, "From 2 channels to 9 in 48 hours." H2, before/after + metrics + quote
7. **FINAL CTA** — "Stop managing. Start scaling." H2, Start for free + View pricing buttons
8. **FOOTER** — One line copyright

---

## Things NOT to do

- ❌ Never add blue, purple, or red colors
- ❌ Never use `font-weight: 400` for anything important — minimum 500
- ❌ Never add decorative AI-style node diagrams
- ❌ Never use SVG spider/hub diagrams — they looked bad, we replaced them
- ❌ Never commit to `main` branch
- ❌ Never add the canvas globe orbit logos — they looked terrible, removed
- ❌ Never make sections fade in with opacity:0 and threshold > 0.1 — sections disappear
- ❌ Never hardcode stats as 0 with counter animation if the section might not scroll into view

---

## What Oleg (arthurperch) has access to
- He's the repo owner on `arthurperch/Frontend-syndrax`
- PR #1 is open: `frontend/danish-edits` → `main`
- He reviews and merges when happy

---

## Current status
Homepage is complete and pushed to GitHub for Oleg's review.
Next pages to work on: features.html → pricing.html → login/signup → enterprise → dashboard

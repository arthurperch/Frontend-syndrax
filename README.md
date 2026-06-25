<div align="center">
  <img src="https://capsule-render.vercel.app/api?type=rect&color=0:6366f1,100:22d3ee&height=70&text=SYNDRAX%20FRONTEND%20FILES&fontSize=28&fontColor=ffffff&fontAlignY=55&animation=fadeIn" width="100%"/>
</div>

<br/>

> **`syndrax-frontend-context.zip`** — 489 files, 45 MB.
> Every HTML page, JS module, CSS file, and captcha tile from https://www.syndrax.io.
> Extract + `npx serve .` = full localhost replica of the marketing site **and** dashboard.

<br/>

<!-- ════════════════ TEAM — colored hero cards ════════════════ -->
<table align="center" width="100%">
<tr>
<td align="center" width="33%">
<a href="https://github.com/arthurperch"><img src="https://github.com/arthurperch.png?size=160" width="100" height="100"/></a>
<br/>
<img src="https://capsule-render.vercel.app/api?type=rect&color=0:6366f1,100:8b5cf6&height=60&text=OLEG%20%C2%B7%20FOUNDER%20%C2%B7%20INFRA&fontSize=20&fontColor=ffffff&fontAlignY=55" width="100%"/>
</td>
<td align="center" width="33%">
<a href="https://github.com/muhammaddanish1962"><img src="https://github.com/muhammaddanish1962.png?size=160" width="100" height="100"/></a>
<br/>
<img src="https://capsule-render.vercel.app/api?type=rect&color=0:06b6d4,100:0ea5e9&height=60&text=DANISH%20%C2%B7%20FRONTEND%20ENGINEER&fontSize=18&fontColor=ffffff&fontAlignY=55" width="100%"/>
</td>
<td align="center" width="33%">
<a href="https://github.com/arthurperch/Frontend-syndrax"><img src="https://capsule-render.vercel.app/api?type=rect&color=0:f59e0b,100:ef4444&height=60&text=FRONTEND%20FILES&fontSize=24&fontColor=ffffff&fontAlignY=55&animation=blink" width="100%"/></a>
<br/>
<a href="https://github.com/arthurperch/Frontend-syndrax/blob/main/syndrax-frontend-context.zip"><img src="https://capsule-render.vercel.app/api?type=rect&color=0:22c55e,100:15803d&height=40&text=%E2%AC%87%20DOWNLOAD%20ZIP%2045MB&fontSize=16&fontColor=ffffff&fontAlignY=55" width="100%"/></a>
<br/>
<sub style="color:#94a3b8">489 files · all pages · dashboard · captcha lab · CSS/JS</sub>
</td>
</tr>
</table>

<br/>

## Quick links
- **Main site**: [syndrax.io](https://www.syndrax.io)
- **Dashboard**: [syndrax.io/app](https://www.syndrax.io/app)
- **Project setup**: [syndrax-setup](https://github.com/arthurperch/syndrax-setup)
- **Live API**: [api.syndrax.io](https://api.syndrax.io)

## Localhost setup

```bash
# 1. Download & extract
unzip syndrax-frontend-context.zip -d syndrax-frontend

# 2. Serve
cd syndrax-frontend
npx serve .                    # → http://localhost:3000

# 3. Open
# Marketing site:  http://localhost:3000/index.html
# Dashboard:       http://localhost:3000/app.html
# Developer tab:   http://localhost:3000/app.html?tab=developer
# Captcha Lab:     http://localhost:3000/app.html?tab=developer&view=captcha-lab
```

## What's inside (489 files)

| Layer | Files | Content |
|---|---|---|
| **Pages** | 23 `.html` | Landing, login, signup, dashboard shell, billing, pricing, enterprise, about, privacy, contact, careers, features, products, services, solutions, install, onboarding, invite, terms |
| **Dashboard SPA** | 16 `.js` | `dashboard.js`, `app-developer.js` (4,400 lines), `app-captcha-lab.js`, `auth-cognito.js`, `billing.js`, `app-api.js` |
| **Styles** | 4 `.css` | `app.css`, `style.css`, `marketing-nav.css`, `alive.css` |
| **Captcha assets** | 445 files | All tile categories + `manifest.json` + gallery |
| **Config** | `package.json` | Local dev deps |

## Notes
- Auth routes proxy to the **live** Cognito pool at `api.syndrax.io`
- Dashboard tabs needing real data (Home, Inventory, Sales) require the cloud API
- The Captcha Lab (`app.html?tab=developer&view=captcha-lab`) works **entirely offline** with local PNG tiles
- No API keys, no secrets — this is 100% static frontend

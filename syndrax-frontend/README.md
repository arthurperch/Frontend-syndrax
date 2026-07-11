# Syndrax Frontend

Static marketing site + Cognito app dashboard.

## Run locally

```bash
SITE_PORT=3002 node dev-server.mjs
```

- Site: http://localhost:3002  
- App: http://localhost:3002/app  
- Login: http://localhost:3002/login  

## Design system

- Base: `#000`
- Type: white
- Accent: silver gradient
- Live: green · Warning: amber  
- No cyan/purple rainbow chrome

## Structure

- Marketing pages: `index.html`, `features.html`, `pricing.html`, …
- Auth: `login.html`, `signup.html`, `auth-cognito.js`, `auth.css`
- App: `app.html`, `dashboard.js`, `app.css`, `app-api.js`, …
- Dev server: `dev-server.mjs` (proxies API)

## Notes

- Cognito client IDs in `auth-cognito.js` are public SPA values.
- eBay OAuth requires live API + store credentials on the backend.

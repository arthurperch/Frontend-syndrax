// Syndrax plan + marketplace model — SINGLE SOURCE OF TRUTH for the website.
// Keep this in sync with the cloud (src/config/plans.ts + marketplaces.ts) and
// the extension (src/services/plans.ts). The shape is intentionally identical so
// the same risk-audit logic runs on web, API, and extension.
//
// Core thesis encoded here: multiple marketplace accounts sharing ONE device/IP
// is what gets sellers restricted. Plan limits are framed as SAFETY, and the
// upgrade pitch is "scale without bans" via device/IP isolation (relay/fleet).

// Plan enum (standardized): none | trial | business | growth | enterprise
export const PLAN_ORDER = ['none', 'trial', 'business', 'growth', 'enterprise'];

export const PLAN_LABEL = {
  none: 'No plan yet',
  trial: 'Free trial',
  business: 'Business',
  growth: 'Growth',
  enterprise: 'Enterprise',
};

export const PLAN_PRICE = {
  none: '',
  trial: 'Free for 7 days',
  business: '$50/mo',
  growth: '$100/mo',
  enterprise: '$200/mo',
};

// Infinity is JSON-unsafe; we use null to mean "unlimited" and treat it as ∞.
export const UNLIMITED = null;

export const PLAN_LIMITS = {
  none:       { maxDevices: 0, maxAccountsPerMarketplace: 0, remote: false, teamSeats: 1 },
  trial:      { maxDevices: 1, maxAccountsPerMarketplace: 1, remote: false, teamSeats: 1 },
  business:   { maxDevices: 1, maxAccountsPerMarketplace: 1, remote: false, teamSeats: 1 },
  growth:     { maxDevices: 3, maxAccountsPerMarketplace: 3, remote: true,  teamSeats: 3 },
  enterprise: { maxDevices: UNLIMITED, maxAccountsPerMarketplace: UNLIMITED, remote: true, teamSeats: UNLIMITED },
};

// Human one-liners used on the plan cards / upgrade nudges.
export const PLAN_TAGLINE = {
  trial: 'Experience the dashboard — one account on this device.',
  business: 'One marketplace account, this device only. Safe and simple.',
  growth: 'Up to 3 devices and 3 accounts per marketplace — stack marketplaces freely, with remote dispatch.',
  enterprise: 'Unlimited devices and accounts, full remote fleet with screen control, team, white-label.',
};

// What the next paid tier unlocks (used by the upgrade CTA copy).
export function nextPlan(plan) {
  if (plan === 'trial' || plan === 'business' || plan === 'none') return 'growth';
  if (plan === 'growth') return 'enterprise';
  return null;
}

export function isUnlimited(v) { return v === UNLIMITED || v === Infinity; }

// ── Marketplaces ─────────────────────────────────────────────────────────────
// status: 'live'   → fully wired automations (eBay today)
//         'beta'   → connectable on this device, partial support
//         'soon'   → selectable, "coming soon"
// access: 'open'   → anyone can connect
//         'gated'  → requires eligibility (EIN + sales history + application),
//                    e.g. Walmart. Syndrax guides + helps apply.
//         'source' → a sourcing platform (buy side), not a sell channel
export const MARKETPLACES = [
  { id: 'ebay',     name: 'eBay',                status: 'live', access: 'open',   color: '#e53238' },
  { id: 'etsy',     name: 'Etsy',                status: 'soon', access: 'open',   color: '#f1641e' },
  { id: 'poshmark', name: 'Poshmark',            status: 'soon', access: 'open',   color: '#a01441' },
  { id: 'mercari',  name: 'Mercari',             status: 'soon', access: 'open',   color: '#5454d4' },
  { id: 'depop',    name: 'Depop',               status: 'soon', access: 'open',   color: '#ff2300' },
  { id: 'grailed',  name: 'Grailed',             status: 'soon', access: 'open',   color: '#000000' },
  { id: 'vinted',   name: 'Vinted',              status: 'soon', access: 'open',   color: '#09b1ba' },
  { id: 'whatnot',  name: 'Whatnot',             status: 'soon', access: 'open',   color: '#fbe04b' },
  { id: 'shopify',  name: 'Shopify',             status: 'soon', access: 'open',   color: '#95bf47' },
  { id: 'facebook', name: 'Facebook Marketplace',status: 'soon', access: 'open',   color: '#1877f2' },
  { id: 'walmart',  name: 'Walmart Marketplace', status: 'soon', access: 'gated',  color: '#0071dc' },
  { id: 'amazon',   name: 'Amazon',              status: 'beta', access: 'source', color: '#ff9900' },
];

export function marketplace(id) { return MARKETPLACES.find((m) => m.id === id) || null; }

// Addons — marketing/automation layers that sit alongside marketplace accounts
// (distinct from marketplaces). They attach to a node (node-level), a specific
// marketplace account (account-level), or both. Mirrors the cloud src/config/addons.ts.
// scope: 'node' | 'account' | 'both'.
export const ADDONS = [
  { id: 'facebook_ads',       name: 'Facebook Ads',        status: 'soon', scope: 'account', color: '#1877f2', blurb: 'Promote a store with automated Facebook ad campaigns.' },
  { id: 'pinterest_autopost', name: 'Pinterest Auto-Post', status: 'soon', scope: 'both',    color: '#e60023', blurb: 'Auto-pin listings to Pinterest boards on a schedule.' },
  { id: 'instagram_autopost', name: 'Instagram Auto-Post', status: 'soon', scope: 'account', color: '#e1306c', blurb: 'Cross-post new listings to Instagram automatically.' },
  { id: 'google_shopping',    name: 'Google Shopping',     status: 'soon', scope: 'account', color: '#4285f4', blurb: 'Feed listings into Google Shopping campaigns.' },
];
export function addon(id) { return ADDONS.find((a) => a.id === id) || null; }

// Full-color inline brand marks (CSP-safe — inline SVG, no external img). Each
// carries its own brand colors so it reads as the real logo on a neutral chip.
export const MARKETPLACE_LOGOS = {
  ebay:
    '<svg viewBox="0 0 60 24" xmlns="http://www.w3.org/2000/svg"><text x="2" y="19" font-family="Arial,Helvetica,sans-serif" font-size="21" font-weight="800" font-style="italic"><tspan fill="#e53238">e</tspan><tspan fill="#0064d2">b</tspan><tspan fill="#f5af02">a</tspan><tspan fill="#86b817">y</tspan></text></svg>',
  amazon:
    '<svg viewBox="0 0 56 30" xmlns="http://www.w3.org/2000/svg"><text x="28" y="16" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="700" fill="#fff">amazon</text><path d="M12 21c8 4.5 24 4.5 32 0" stroke="#ff9900" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M41 18.6l3.4 1-1.4 3.1" stroke="#ff9900" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  etsy:
    '<svg viewBox="0 0 44 24" xmlns="http://www.w3.org/2000/svg"><text x="2" y="19" font-family="Georgia,\'Times New Roman\',serif" font-size="20" font-weight="800" fill="#f1641e">Etsy</text></svg>',
  walmart:
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g fill="#ffc220" transform="translate(12 12)"><rect x="-1.1" y="-9.2" width="2.2" height="6.2" rx="1.1"/><rect x="-1.1" y="3" width="2.2" height="6.2" rx="1.1"/><g transform="rotate(60)"><rect x="-1.1" y="-9.2" width="2.2" height="6.2" rx="1.1"/><rect x="-1.1" y="3" width="2.2" height="6.2" rx="1.1"/></g><g transform="rotate(120)"><rect x="-1.1" y="-9.2" width="2.2" height="6.2" rx="1.1"/><rect x="-1.1" y="3" width="2.2" height="6.2" rx="1.1"/></g></g></svg>',
  shopify:
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M16 6.6C16 4 14.2 2 12 2S8 4 8 6.6V7H5.4L4.2 21.1c0 .5.4.9.9.9h13.7c.5 0 .9-.4.9-.9L18.6 7H16zM10 6.6C10 5.1 10.9 4 12 4s2 1.1 2 2.6V7h-4z" fill="#95bf47"/><text x="12" y="16.2" text-anchor="middle" font-family="Arial" font-size="9" font-weight="800" fill="#fff">S</text></svg>',
  poshmark:
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="5" fill="#7b2a3a"/><text x="12" y="17" text-anchor="middle" font-family="Georgia,serif" font-size="13" font-weight="800" fill="#fff">P</text></svg>',
  mercari:
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="11" fill="#ff5b49"/><text x="12" y="16.5" text-anchor="middle" font-family="Arial" font-size="13" font-weight="800" fill="#fff">m</text></svg>',
  depop:
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="11" fill="#ff2300"/><text x="12" y="16.5" text-anchor="middle" font-family="Arial" font-size="13" font-weight="800" fill="#fff">d</text></svg>',
  grailed:
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="4" fill="#111"/><text x="12" y="16.5" text-anchor="middle" font-family="Arial" font-size="13" font-weight="800" fill="#fff">G</text></svg>',
  vinted:
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><text x="12" y="17" text-anchor="middle" font-family="Arial" font-size="15" font-weight="800" fill="#09b1ba">V</text></svg>',
  whatnot:
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="20" height="20" rx="6" fill="#fbe04b"/><text x="12" y="16.5" text-anchor="middle" font-family="Arial" font-size="12" font-weight="800" fill="#111">W</text></svg>',
  facebook:
    '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="11" fill="#1877f2"/><path d="M14.2 8.6h1.9V5.7c-.4-.05-1.4-.1-2.3-.1-2.2 0-3.7 1.4-3.7 3.8V11H8.2v3h1.9v7h3v-7h2l.4-3h-2.4V9.6c0-.8.2-1 1.1-1z" fill="#fff"/></svg>',
};

export function marketplaceLogo(id) { return MARKETPLACE_LOGOS[id] || null; }

// ── Trust / warm-up journeys (per marketplace) ────────────────────────────────
// Every marketplace bans/limits NEW accounts differently. Syndrax warms each
// account up to that marketplace's own rules (researched from seller community
// guidance) before unlocking growth scripts. Established accounts skip warm-up.
// An "audit gate" runs between warm-up and growth on every marketplace.
export const TRUST_PHASES = {
  ebay: {
    note: 'eBay caps new sellers (~10 items / $500 a month) and holds funds up to 21 days until you build feedback. Warm up like a human, make a real sale, clear funds before scaling.',
    phases: [
      { label: 'Warm up', desc: 'browse & buy like a human' },
      { label: 'First listing', desc: 'cheap item + eBay label' },
      { label: 'First sale', desc: 'ship fast' },
      { label: 'First feedback', desc: 'earn the star' },
      { label: 'Funds clear', desc: 'account trusted' },
    ],
  },
  etsy: {
    note: 'Etsy holds a payment reserve for new shops and limits payouts until orders ship and reviews land. Fill the shop, fulfil fast, gather reviews.',
    phases: [
      { label: 'Open shop', desc: 'profile + policies' },
      { label: 'First listings', desc: '10+ quality items' },
      { label: 'First sale', desc: 'ship on time' },
      { label: 'First reviews', desc: 'build rating' },
      { label: 'Reserve lifts', desc: 'normal payouts' },
    ],
  },
  poshmark: {
    note: 'Poshmark rewards active, social sellers. Complete your closet, share daily and earn ratings to build trust.',
    phases: [
      { label: 'Complete profile', desc: 'photo + bio' },
      { label: 'List & share', desc: 'share daily' },
      { label: 'First sale', desc: 'ship in time' },
      { label: 'Ratings', desc: 'love notes' },
      { label: 'Ambassador', desc: 'trusted seller' },
    ],
  },
  mercari: {
    note: 'Mercari speeds payouts and trust as you complete sales with good ratings. Verify, list, sell, rate up.',
    phases: [
      { label: 'Verify identity', desc: 'unlock selling' },
      { label: 'List items', desc: 'good photos' },
      { label: 'First sale', desc: 'ship fast' },
      { label: 'Ratings', desc: '5-star reviews' },
      { label: 'Faster payouts', desc: 'account trusted' },
    ],
  },
  depop: {
    note: 'Depop favours active shops with great photos and quick shipping. Build the shop, sell, gather reviews.',
    phases: [
      { label: 'Set up shop', desc: 'bio + style' },
      { label: 'List items', desc: 'bright photos' },
      { label: 'First sale', desc: 'ship quick' },
      { label: 'Reviews', desc: 'build rep' },
      { label: 'Trusted', desc: 'boosted reach' },
    ],
  },
  grailed: {
    note: 'Grailed is community-driven and menswear-focused. Build rep with detailed listings, quick responses and fair pricing.',
    phases: [
      { label: 'Complete profile', desc: 'bio + photo + location' },
      { label: 'First listings', desc: 'detailed + priced right' },
      { label: 'First sale', desc: 'ship with tracking' },
      { label: 'Ratings', desc: 'earn trust' },
      { label: 'Trusted seller', desc: 'boosted visibility' },
    ],
  },
  vinted: {
    note: 'Vinted charges buyers, not sellers. List fast, price low, respond quickly — early rating velocity unlocks growth.',
    phases: [
      { label: 'Verify account', desc: 'email + ID' },
      { label: 'First listings', desc: 'good photos + fair price' },
      { label: 'First sale', desc: 'ship in 5 days' },
      { label: 'Ratings', desc: '5-star average' },
      { label: 'Trusted', desc: 'higher search rank' },
    ],
  },
  whatnot: {
    note: 'Whatnot is live-auction focused. Get approved as a seller, host your first show, build an audience.',
    phases: [
      { label: 'Apply as seller', desc: 'review + approval' },
      { label: 'First show', desc: 'go live, small lot' },
      { label: 'First sales', desc: 'ship fast' },
      { label: 'Grow audience', desc: 'followers + repeat buyers' },
      { label: 'Top seller', desc: 'featured + verified' },
    ],
  },
  shopify: {
    note: 'Shopify is your own store. Syndrax connects it for inventory sync and cross-listing. Set up your store, get your first organic orders.',
    phases: [
      { label: 'Store live', desc: 'domain + theme' },
      { label: 'Product catalogue', desc: 'synced inventory' },
      { label: 'First orders', desc: 'any channel' },
      { label: 'Payment history', desc: 'clean processing' },
      { label: 'Scale', desc: 'multi-channel' },
    ],
  },
  facebook: {
    note: 'Facebook Marketplace uses your personal profile — trust is tied to your account age and local reputation. Start local, build reviews.',
    phases: [
      { label: 'Profile ready', desc: 'photo + 30-day-old account' },
      { label: 'First listings', desc: 'local items, low price' },
      { label: 'First sale', desc: 'meet safe + rate' },
      { label: 'Reviews', desc: 'build rating' },
      { label: 'Trusted', desc: 'national listing unlocked' },
    ],
  },
  amazon: {
    note: 'Amazon is a sourcing platform in Syndrax — use it to research products, check price history and find winning ASINs to list on other channels.',
    phases: [
      { label: 'Enable sourcing', desc: 'connect your region' },
      { label: 'Research mode', desc: 'ASIN lookup active' },
      { label: 'Price tracking', desc: 'monitor ASINs' },
      { label: 'Gold finder', desc: 'automated product discovery' },
      { label: 'Full pipeline', desc: 'source → list on eBay/Etsy' },
    ],
  },
  walmart: {
    note: 'Walmart Marketplace is application-gated and metric-driven (≥90% on-time, low defect rate). Get approved, list, hit targets to scale.',
    phases: [
      { label: 'Approved', desc: 'LLC + sales history' },
      { label: 'First listings', desc: 'catalog match' },
      { label: 'First orders', desc: 'fulfil fast' },
      { label: 'Metrics', desc: 'on-time + low defect' },
      { label: 'Scale', desc: 'good standing' },
    ],
  },
  default: {
    note: 'New accounts earn trust gradually. Warm up to this marketplace’s rules, make real sales and gather reviews before scaling.',
    phases: [
      { label: 'Set up account', desc: 'profile ready' },
      { label: 'First listing', desc: 'start small' },
      { label: 'First sale', desc: 'ship fast' },
      { label: 'First reviews', desc: 'build rating' },
      { label: 'Trusted', desc: 'unlock growth' },
    ],
  },
};

export function trustJourney(id) { return TRUST_PHASES[id] || TRUST_PHASES.default; }

// Eligibility guidance for gated marketplaces. `profile` carries { ein, salesProof }.
export function eligibility(marketplaceId, profile = {}) {
  const mk = marketplace(marketplaceId);
  if (!mk || mk.access !== 'gated') return { status: 'open', message: '' };
  if (marketplaceId === 'walmart') {
    const hasEin = !!(profile.ein && String(profile.ein).trim());
    const hasSales = !!profile.salesProof;
    if (hasEin && hasSales) {
      return { status: 'eligible', message: 'You meet the basics for Walmart. We can help you apply and get approved.' };
    }
    if (hasEin) {
      return { status: 'building', message: 'Walmart requires proof of sales. Keep selling on eBay — your sales history can seed the application. We’ll help you apply once you qualify.' };
    }
    return { status: 'not_eligible', message: 'Walmart requires a registered business (EIN) and proof of sales. Add your EIN and grow your eBay sales — Syndrax guides you through the whole approval.' };
  }
  return { status: 'not_eligible', message: 'This marketplace requires approval. Syndrax will guide you through eligibility.' };
}

// ── Risk audit (the upgrade engine) ──────────────────────────────────────────
// Shared logic — also implemented identically on the API (source of truth) and
// the extension. Given the plan and the user's current footprint, return findings.
//
//   plan:               'business' | 'growth' | ...
//   accountsByMarketplace: { ebay: 2, poshmark: 1, ... }  (account counts)
//   devices:            [{ id, name }]                      (connected devices)
//   accountsPerDevice:  { 'dev-abc': 2, ... }   (optional — same-IP detection)
//
// Returns: { level: 'ok'|'warn'|'block', findings: [{level, title, detail, upgradeTo}] }
export function runAudit({ plan = 'none', accountsByMarketplace = {}, devices = [], accountsPerDevice = {} } = {}) {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.none;
  const findings = [];

  // 1) Accounts per marketplace vs limit
  if (!isUnlimited(limits.maxAccountsPerMarketplace)) {
    for (const [mk, count] of Object.entries(accountsByMarketplace)) {
      if (count > limits.maxAccountsPerMarketplace) {
        findings.push({
          level: 'warn',
          title: `${marketplace(mk)?.name || mk}: ${count} accounts on ${PLAN_LABEL[plan]}`,
          detail: `Your plan allows ${limits.maxAccountsPerMarketplace} ${marketplace(mk)?.name || mk} account${limits.maxAccountsPerMarketplace === 1 ? '' : 's'}. Marketplaces flag linked accounts on one device/IP — this raises restriction risk. ${PLAN_LABEL[nextPlan(plan)]} isolates each account on its own device/IP.`,
          upgradeTo: nextPlan(plan),
        });
      }
    }
  }

  // 2) Devices vs limit
  if (!isUnlimited(limits.maxDevices) && devices.length > limits.maxDevices) {
    findings.push({
      level: 'warn',
      title: `${devices.length} devices on ${PLAN_LABEL[plan]}`,
      detail: `Your plan covers ${limits.maxDevices} device${limits.maxDevices === 1 ? '' : 's'}. Add more on ${PLAN_LABEL[nextPlan(plan)]} to spread accounts across separate IPs.`,
      upgradeTo: nextPlan(plan),
    });
  }

  // 3) Same-device/IP stacking (the real ban driver)
  for (const [dev, count] of Object.entries(accountsPerDevice)) {
    if (count > 1) {
      const dname = devices.find((d) => d.id === dev)?.name || 'this device';
      findings.push({
        level: 'warn',
        title: `${count} accounts on ${dname}`,
        detail: `Running ${count} marketplace accounts from the same device/IP is the #1 cause of linked-account restrictions. Syndrax isolates accounts across devices on ${PLAN_LABEL[nextPlan(plan) || 'growth']} — that’s how we keep you un-restricted.`,
        upgradeTo: nextPlan(plan) || 'growth',
      });
    }
  }

  // 4) Remote attempted on a local-only plan (soft block, surfaced by caller)
  // handled where remote is requested; included for completeness.

  const level = findings.length === 0 ? 'ok' : 'warn';
  return { level, findings };
}

// Expose globally for non-module scripts/inline use.
if (typeof window !== 'undefined') {
  window.SyndraxPlans = {
    PLAN_ORDER, PLAN_LABEL, PLAN_PRICE, PLAN_LIMITS, PLAN_TAGLINE, UNLIMITED,
    MARKETPLACES, marketplace, marketplaceLogo, eligibility, runAudit, nextPlan, isUnlimited,
    TRUST_PHASES, trustJourney,
  };
}

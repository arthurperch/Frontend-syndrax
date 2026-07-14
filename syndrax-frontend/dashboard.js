// dashboard.js — Syndrax web app. An extension-style dashboard that runs in the
// browser: sidebar + Workspace (script palette → jobs → log) + Accounts + plan
// gating. The Chrome EXTENSION is the sync/execution backend — scripts are
// dispatched to it via runtime messaging; this page is the front end for all 3
// plans (Business = this PC only, Growth/Enterprise unlock more).
import { getSession, signOut } from '/auth-cognito.js';
import { getStatus, openPortal, startCheckout } from '/billing.js';
import {
  getProfile, saveProfile, getMarketplaces, addMarketplaceAccount,
  removeMarketplaceAccount, getAudit, startTrial,
  getNodes, saveNode, updateNode, getAddons, addAddon, removeAddon,
  getSales, postSales, getInventory, getInventorySummary, syncInventory, deleteInventoryItem,
  getTrackingBalance, getTrackingOrders, postTrackingOrders, updateTrackingOrder, claimTracking, trackingCheckout,
  getTeamMembers, inviteTeamMember, removeTeamMember, revokeTeamInvite,
  getExtensionStatus, revokeExtension,
  getEbayStatus, connectEbay, syncEbay, getEbayTelemetry,
} from '/app-api.js';
import { loadExtensionPanel, revokeExtensionInstall } from '/app-extension-view.js';
import { renderDeveloper, makeDevApiFns, checkOwnerStatus } from '/app-developer.js';
import {
  PLAN_LABEL, PLAN_PRICE, PLAN_TAGLINE, PLAN_LIMITS,
  MARKETPLACES, marketplace, marketplaceLogo, eligibility, runAudit, nextPlan, isUnlimited,
  trustJourney, ADDONS, addon,
} from '/plans.js';
import { playSfx, toggleSfx, sfxEnabled } from '/sfx.js';

// ── extension (sync backend) ─────────────────────────────────────────────────
const EXT_IDS = ['olhecndljgbocfkdejkcppadadmfiojo', 'mgapfpdkkihbeehfkgoajhealmgpnglo'];
const JOBS_KEY = 'syndrax_web_jobs_v2'; // v2 — invalidates all v1 mock/stale data

// ── icons (inline, lucide-ish) ───────────────────────────────────────────────
const P = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ICONS = {
  home: `<svg viewBox="0 0 24 24" ${P}><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/></svg>`,
  chart: `<svg viewBox="0 0 24 24" ${P}><path d="M3 3v18h18"/><path d="M7 14l3-4 3 3 5-7"/></svg>`,
  cash: `<svg viewBox="0 0 24 24" ${P}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>`,
  rocket: `<svg viewBox="0 0 24 24" ${P}><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0z"/><path d="M12 15l-3-3a22 22 0 0 1 8-10c2 0 4 2 4 4a22 22 0 0 1-9 9z"/><path d="M9 12H4s.5-3 2-4 5 0 5 0"/></svg>`,
  tag: `<svg viewBox="0 0 24 24" ${P}><path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0l-7.8-7.8V3h9.8l8 8a2 2 0 0 1 0 2.4z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>`,
  briefcase: `<svg viewBox="0 0 24 24" ${P}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
  monitor: `<svg viewBox="0 0 24 24" ${P}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
  users: `<svg viewBox="0 0 24 24" ${P}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" ${P}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>`,
  card: `<svg viewBox="0 0 24 24" ${P}><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>`,
  chevrons: `<svg viewBox="0 0 24 24" ${P}><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" ${P}><path d="M12 5v14M5 12h14"/></svg>`,
  x: `<svg viewBox="0 0 24 24" ${P}><path d="M18 6 6 18M6 6l12 12"/></svg>`,
  play: `<svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z" fill="currentColor"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" ${P}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" ${P}><path d="M16 16l-4-4-4 4M12 12v9"/><path d="M20.4 18.6A5 5 0 0 0 18 9h-1.3A8 8 0 1 0 3 16.3"/></svg>`,
  package: `<svg viewBox="0 0 24 24" ${P}><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" ${P}><path d="M21 2v6h-6M3 22v-6h6"/><path d="M21 8a9 9 0 0 0-15-3L3 8M3 16a9 9 0 0 0 15 3l3-3"/></svg>`,
  crosshair: `<svg viewBox="0 0 24 24" ${P}><circle cx="12" cy="12" r="9"/><path d="M22 12h-4M6 12H2M12 6V2M12 22v-4"/></svg>`,
  search: `<svg viewBox="0 0 24 24" ${P}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>`,
  wifi: `<svg viewBox="0 0 24 24" ${P}><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/></svg>`,
  sound: `<svg viewBox="0 0 24 24" ${P}><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg>`,
  mute: `<svg viewBox="0 0 24 24" ${P}><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>`,
  invlist: `<svg viewBox="0 0 24 24" ${P}><rect x="3" y="3.5" width="18" height="17" rx="2.5"/><path d="M3 8.5h18"/><path d="M6.5 12.5h5M6.5 16h7.5"/><path d="M15.5 12l1.3 1.3L19 11"/></svg>`,
  filter: `<svg viewBox="0 0 24 24" ${P}><path d="M3 5h18l-7 8.2V20l-4 1.5v-8.3z"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" ${P}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>`,
  truck: `<svg viewBox="0 0 24 24" ${P}><path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/></svg>`,
  caret: `<svg viewBox="0 0 24 24" ${P}><path d="M6 9l6 6 6-6"/></svg>`,
  // Sync-bot — a little robot with orbiting sync arrows (opens the Automation Builder)
  bot: `<svg viewBox="0 0 24 24" ${P}><rect x="5" y="8" width="14" height="10" rx="3"/><path d="M12 8V5"/><circle cx="12" cy="3.6" r="1.2"/><circle cx="9.2" cy="13" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.8" cy="13" r="1.1" fill="currentColor" stroke="none"/><path d="M3.5 12a3.5 3.5 0 0 1 .6-2M20.5 12a3.5 3.5 0 0 1-.6 2"/></svg>`,
};
const icon = (n) => ICONS[n] || '';
// icon() with an injected class (for sized contexts like the focus bar).
const iconCls = (n, cls) => (ICONS[n] || '').replace('<svg', `<svg class="${cls}"`);

// ── helpers ───────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
function loadJobs() { try { return JSON.parse(localStorage.getItem(JOBS_KEY)) || []; } catch { return []; } }
function saveJobs() { try { localStorage.setItem(JOBS_KEY, JSON.stringify(jobs.slice(0, 100))); } catch {} }
function timeAgo(t) { const s = Math.max(0, (Date.now() - t) / 1000 | 0); return s < 60 ? `${s}s ago` : s < 3600 ? `${s / 60 | 0}m ago` : `${s / 3600 | 0}h ago`; }
async function downloadLauncherScript() {
  const s = getSession();
  const base = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? '' : 'https://api.syndrax.io';
  const r = await fetch(base + '/api/dev-access/launcher', s?.idToken ? { headers: { Authorization: 'Bearer ' + s.idToken } } : {});
  if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error || `HTTP ${r.status}`); }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'SyndraxDevStudio.bat'; a.click();
  URL.revokeObjectURL(url);
}

// ── state ───────────────────────────────────────────────────────────────────
const session = getSession();
if (!session) location.replace('/login');
let email = '';
try { email = JSON.parse(atob(session.idToken.split('.')[1])).email || ''; } catch {}
const isLocalDevSession = !!(session && (session.localDev || localStorage.getItem('syndrax_local_dev') === '1'));

// Owner/admin plan-preview sandbox — uses Cognito JWT 'owner' group.
// B-site security-cleanup 2026-06-23: removed personal email from ADMIN_EMAILS list.
// The plan-preview sandbox is UX-only and NOT an auth boundary.
// Real authorization uses ownerVerified from /api/dev/whoami.
let _cachedIsAdmin = null;
function getIsAdmin() {
  if (_cachedIsAdmin !== null) return _cachedIsAdmin;
  try {
    const payload = JSON.parse(atob(session.idToken.split('.')[1]));
    const groups = payload['cognito:groups'] || [];
    _cachedIsAdmin = groups.includes('owner') || groups.includes('admin');
  } catch { _cachedIsAdmin = false; }
  return _cachedIsAdmin;
}
const isAdmin = getIsAdmin();
const PREVIEW_KEY = 'syndrax_admin_preview_plan';

// ownerVerified: set after /api/dev/whoami returns {authorized:true, role:'owner'}.
// Until that call resolves, the Developer tab is hidden.
// A 403 from whoami hides the tab even if isAdmin is true — the roles are separate.
let ownerVerified = false;

let plan = 'none';        // effective plan (preview override for admin, else real)
let realPlan = 'none';    // the account's actual plan
let previewPlan = isAdmin ? (localStorage.getItem(PREVIEW_KEY) || null) : null;
let statusRow = { plan: 'none' };
let profile = {};
let accounts = [];
let jobs = loadJobs();
let automations = loadAutomations();
let templateCatalog = null; // loaded from /templates/catalog.json (Danish template library)
let addedDevices = loadDevices(); // devices you add manually (name + IP)
let nodes = []; // real cluster nodes synced from the extension
let cloudNodes = []; // workspace nodes persisted server-side (have integer .id for node_id)
let addons = []; // marketing addons (node- or account-level), server-side

// ── AXIS audit state ──────────────────────────────────────────────────────────
// Driven by renderAudit(): the count of active findings + whether any are critical.
// navBtn() reads these to show the blinking red badge on the Safety Audit tab.
let axisAlertCount = 0;
let axisAlertCritical = false;
let axisVoiceEnabled = (typeof localStorage !== 'undefined' && localStorage.getItem('syndrax_axis_voice') !== 'off');
let axisVoiceLoop = null; // setInterval handle for the enterprise 30s loop
let salesData = null; // real P&L series from /api/sales (null until loaded)
let inventorySummary = null; // inventory counts + cross-site ASIN reference
let homeChartView = 'sales'; // 'sales' | 'inventory' — Home chart toggle
let homePeriod = '8w';     // analytics period selector on home page
let invItems = []; // loaded inventory rows (filtered client-side)
let invFilter = { marketplace: 'all', stock: 'all', q: '' }; // inventory sheet filters
let trackingBalance = null; // { credits, configured, claims, allotment, packs, subs }
let homeTrackingLoading = false; // guards the one-time lazy tracking fetch on Home
let trackingOrders = []; // last-loaded tracking orders (for in-tab re-paints)
let trackingBuyMode = 'once'; // 'once' | 'monthly' for credit top-up
let focusNode = localStorage.getItem('syndrax_focus_node') || 'all'; // global Focus bar — node scope
let focusAccount = localStorage.getItem('syndrax_focus_acct') || 'all'; // global Focus bar — account scope
let openScopeMenu = null; // which focus-bar dropdown is open: 'node' | 'account' | null
let draftWorkflow = (() => { try { return JSON.parse(localStorage.getItem('syndrax_wf_draft')) || []; } catch { return []; } })(); // Jobs-page canvas draft
let wfDragFrom = null; // drag-reorder source index on the Jobs canvas
let thisPcIp = ''; // public IP of this PC (from the extension)
let currentDeviceId = 'this-device'; // the device this browser's extension runs on
let lastConnectNode = localStorage.getItem('syndrax_last_node') || ''; // remembered node pick
let activeTab = 'home';
let devView = 'focus'; // developer sub-view
let devJobId = null;       // job-detail id
let selectedTarget = null; // target account id for marketplace-aware scripts
let selectedJobId = null;
let railOpen = false;
let sbCollapsed = localStorage.getItem('syndrax_sb_collapsed') === '1'; // sidebar rail; default expanded (labels shown)
let ext = window.SyndraxExt || { installed: false };
let configuring = null; // script key for modal
let connecting = null;  // marketplace id for connect modal

// ── plan gating ───────────────────────────────────────────────────────────────
function can(feature) {
  const l = PLAN_LIMITS[plan] || PLAN_LIMITS.none;
  // null/Infinity = unlimited → always allowed (this was the Enterprise lockout bug).
  if (feature === 'multiDevice') return isUnlimited(l.maxDevices) || l.maxDevices > 1;
  if (feature === 'team') return isUnlimited(l.teamSeats) || l.teamSeats > 1;
  return true;
}

const TABS = [
  { id: 'home', label: 'Home', icon: 'home', sec: 'Mission Control' },
  { id: 'workspace', label: 'Workspace', icon: 'rocket', sec: 'Mission Control' },
  { id: 'accounts', label: 'Accounts', icon: 'tag', sec: 'Mission Control' },
  { id: 'inventory', label: 'Inventory', icon: 'invlist', sec: 'Mission Control' },
  { id: 'jobs', label: 'Workflows', icon: 'briefcase', sec: 'Operations' },
  { id: 'tracking', label: 'Tracking', icon: 'truck', sec: 'Operations' },
  { id: 'devices', label: 'Devices', icon: 'monitor', sec: 'Operations', feature: 'multiDevice' },
  { id: 'extension', label: 'Extension', icon: 'monitor', sec: 'Operations' },
  { id: 'team', label: 'Team', icon: 'users', sec: 'Operations', feature: 'team' },
  { id: 'audit', label: 'Safety Audit', icon: 'shield', sec: 'Control' },
  { id: 'plan', label: 'Plan & Billing', icon: 'card', sec: 'Control' },
  { id: 'developer', label: 'Developer', icon: 'bot', sec: 'System', adminOnly: true },
];

// The real toolset (mirrors the extension's modules), grouped into the universal
// workflow: Sync → Research → List → Manage → (Repeat via automations). Same page
// everywhere; scripts auto-scope to the selected marketplace. run: keys that have
// a live web→extension run path today (eBay). Everything else is real but its
// per-marketplace runner is still being wired.
const WORKFLOW = [
  { stage: 'Sync', icon: 'refresh', modules: [
    { key: 'dashboard', label: 'Overview', desc: 'Active listings • price changes • stock • alerts' },
    { key: 'quicksync', label: 'Quick Sync', desc: 'Fast price & stock pass', run: 'quicksync' },
    { key: 'lifecycle', label: 'Inventory Lifecycle', desc: '90-day lifecycle • markdown • clearance', run: 'inventory' },
    { key: 'finance', label: 'eBay P&L', desc: 'Earnings • reconciliation • profit' },
  ]},
  { stage: 'Research', icon: 'crosshair', modules: [
    { key: 'research', label: 'Research', desc: 'Product discovery • research queue', run: 'research' },
    { key: 'competitor', label: 'Competitor Research', desc: 'Track rival sellers • pricing • new listings' },
    { key: 'compliance', label: 'Compliance Check', desc: '7 risk filters • VERO • banned • fragile' },
    { key: 'reverse', label: 'Reverse Search', desc: 'eBay reverse image • existing dropshippers' },
    { key: 'seller', label: 'Seller Verification', desc: 'Age • feedback % • units • match rate' },
    { key: 'dna', label: 'DNA Match', desc: 'AI vision • brand • model • color' },
  ]},
  { stage: 'List', icon: 'upload', modules: [
    { key: 'seo', label: 'SEO Generator', desc: 'Keywords • competitor titles • optimized copy' },
    { key: 'description', label: 'Description Builder', desc: 'HTML templates • 5 styles' },
    { key: 'images', label: 'Image Pipeline', desc: 'Fetch • resize • optimize' },
    { key: 'lister', label: 'Lister', desc: 'List in bulk • pricing • markup • margin', run: 'lister' },
  ]},
  { stage: 'Manage', icon: 'tag', modules: [
    { key: 'optimizer', label: 'Listing Optimizer', desc: 'End & sell similar • price drops' },
    { key: 'pricing', label: 'Pricing Strategy', desc: 'Rules engine • dynamic pricing • margin' },
    { key: 'accounts', label: 'Account Manager', desc: 'Tiers • warmup • daily limits • risk' },
    { key: 'warmup', label: 'Warmup Agent', desc: 'Daily limits • safe listing schedule' },
    { key: 'trust', label: 'Trust Audit', desc: 'Trust score • defects • feedback • holds' },
    { key: 'messages', label: 'Message Tool', desc: '5 buyer templates • OOS • shipping • returns' },
  ]},
];
// Scripts that dispatch to the extension today (auto-run via chrome.runtime.sendMessage).
const RUNNABLE = { lister: 'bulklister', research: 'research', quicksync: 'quicksync', inventory: 'inventory' };

// What each tool actually DOES today, so the UI is honest:
//   'live' = real automation, dispatches to the extension and runs
//   'hub'  = working: opens the matching marketplace Seller Hub page
//   'todo' = not wired yet → grayed out so we remember to build it
// Update a tool here the moment its runner ships. Anything unlisted defaults to 'todo'.
const TOOL_STATUS = {
  research: 'live', lister: 'live', quicksync: 'live', lifecycle: 'live',
  dashboard: 'hub', finance: 'hub', optimizer: 'hub', messages: 'hub', trust: 'hub',
  description: 'hub', // template library — Description Builder (local fill/preview/copy)
  // not built yet (grayed): compliance, reverse, seller, dna, seo,
  // images, pricing, accounts, warmup
};
function toolTier(key) { return TOOL_STATUS[key] || 'todo'; }

// Each stage collapses to ONE primary tool; the rest become its advanced settings.
// e.g. SEO / Description / Images all feed the Lister; Compliance/Reverse/etc. feed
// Research. Keeps the palette to ~4 cards and reads as an advanced setup.
const STAGES = [
  { stage: 'Sync', icon: 'refresh', primary: 'quicksync', title: 'Sync', desc: 'Pull live listings, prices and stock into Syndrax.', advanced: ['dashboard', 'lifecycle', 'finance'] },
  { stage: 'Research', icon: 'crosshair', primary: 'research', title: 'Research', desc: 'Find winning products and vet them before you list.', advanced: ['competitor', 'compliance', 'reverse', 'seller', 'dna'] },
  { stage: 'List', icon: 'upload', primary: 'lister', title: 'Lister', desc: 'List in bulk — title, images, description and pricing in one pass.', advanced: ['seo', 'description', 'images'] },
  { stage: 'Manage', icon: 'tag', primary: 'optimizer', title: 'Manage', desc: 'Optimize, reprice, warm up and protect your live listings.', advanced: ['pricing', 'accounts', 'warmup', 'trust', 'messages'] },
];
// Which primary each advanced tool feeds (for the settings copy).
const ADV_PARENT = {};
STAGES.forEach(s => s.advanced.forEach(k => { ADV_PARENT[k] = s.title; }));

// Audit agent: always-on by default. Monitors every action and protects the account
// from restrictions, bans and bot-detection. User can switch it off.
let auditAgentOn = localStorage.getItem('syndrax_audit_agent') !== 'off';

// For modules not yet auto-dispatched: open the corresponding eBay Seller Hub URL
// so the user can work there manually while automation is built. Keeps it real.
const MODULE_EBAY_URL = {
  dashboard:   'https://www.ebay.com/sh/overview',
  quicksync:   'https://www.ebay.com/sh/prc/recent',
  lifecycle:   'https://www.ebay.com/sh/inv/active',
  finance:     'https://www.ebay.com/sh/fin',
  compliance:  'https://www.ebay.com/sh/overview',
  reverse:     'https://www.ebay.com/sh/src',
  seller:      'https://www.ebay.com/sh/ovw/performance',
  dna:         'https://www.ebay.com/sh/overview',
  seo:         'https://www.ebay.com/sh/lst/active',
  description: 'https://www.ebay.com/sh/lst/active',
  images:      'https://www.ebay.com/sh/lst/active',
  optimizer:   'https://www.ebay.com/sh/lst/active',
  pricing:     'https://www.ebay.com/sh/prc/recent',
  accounts:    'https://www.ebay.com/sh/ovw/performance',
  warmup:      'https://www.ebay.com/sh/ovw/performance',
  trust:       'https://www.ebay.com/sh/ovw/performance',
  messages:    'https://www.ebay.com/sh/msg',
};

function loadAutomations() {
  try {
    const raw = JSON.parse(localStorage.getItem('syndrax_automations_v1')) || [];
    // Dedupe: one saved automation per fromTemplate (or same label+steps fingerprint)
    const seen = new Set();
    const out = [];
    for (const a of raw) {
      const key = a.fromTemplate
        ? 'tpl:' + a.fromTemplate
        : 'fp:' + (a.label || '') + '|' + (a.marketplace || '') + '|' + (a.steps || []).join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(a);
    }
    if (out.length !== raw.length) {
      try { localStorage.setItem('syndrax_automations_v1', JSON.stringify(out)); } catch {}
    }
    return out;
  } catch { return []; }
}
function saveAutomations() { try { localStorage.setItem('syndrax_automations_v1', JSON.stringify(automations)); } catch {} }
function loadDevices() { try { return JSON.parse(localStorage.getItem('syndrax_devices_v1')) || []; } catch { return []; } }
function saveDevices() { try { localStorage.setItem('syndrax_devices_v1', JSON.stringify(addedDevices)); } catch {} }

// ── boot ────────────────────────────────────────────────────────────────────
function applyPlan() { plan = (isAdmin && previewPlan) ? previewPlan : realPlan; }

// Pull REAL marketplace accounts from the server only. Forward extension sync
// data (inventory, sales, nodes) to the cloud, but NEVER inject accounts into
// the local array — the server is the single source of truth. Previously this
// re-added extension accounts on every load, making deletes appear to fail.
function syncExtensionAccounts() {
  return new Promise((resolve) => {
    const extId = ext.id || EXT_IDS[0];
    if (!(window.chrome && chrome.runtime && chrome.runtime.sendMessage && ext.installed)) return resolve();
    try {
      chrome.runtime.sendMessage(extId, { type: 'SYNDRAX_GET_STATE' }, (resp) => {
        if (chrome.runtime.lastError || !resp || !resp.ok) return resolve();
        if (Array.isArray(resp.nodes)) nodes = resp.nodes;
        if (resp.ip) thisPcIp = resp.ip;
        if (resp.deviceId) currentDeviceId = resp.deviceId;
        persistNodes(resp);
        forwardExtSyncData(resp);
        // NOTE: deliberately do NOT push resp.accounts into `accounts`.
        // Accounts come ONLY from the server (getMarketplaces). This ensures
        // deleting an account actually removes it.
        resolve();
      });
    } catch { resolve(); }
  });
}

// Persist the extension's reported nodes (current PC + fleet) to the cloud so the
// workspace's node list survives across sessions/browsers and is shared with the
// team. Best-effort: a failure just leaves the in-memory list. Refreshes cloudNodes
// (which carry the integer .id used as node_id when pinning accounts/addons).
function persistNodes(resp) {
  const list = Array.isArray(resp.nodes) ? resp.nodes : [];
  const cur = resp.currentNode;
  const toSave = [];
  if (cur && cur.deviceId) toSave.push(cur);
  for (const n of list) { if (n.deviceId && !toSave.some(t => t.deviceId === n.deviceId)) toSave.push(n); }
  if (!toSave.length) return;
  Promise.all(toSave.map(n => saveNode({
    deviceId: n.deviceId, name: n.name, nodeType: n.nodeType || (n.local ? 'current' : 'remote'),
    ip: n.ip || '', status: n.status || (n.local ? 'online' : 'offline'),
  }).catch(() => null))).then(async () => {
    try { const r = await getNodes(); cloudNodes = r.nodes || []; if (activeTab === 'devices') renderDevices(); } catch {}
  });
}

// The extension scanners run in the background and report captured inventory/sales
// in their state payload. The website (which holds the Cognito token) forwards them
// to the cloud — keeping auth on the site, scanners untouched. Best-effort; refreshes
// the local copies so the Home chart + Inventory tab reflect the latest sync.
function forwardExtSyncData(resp) {
  const inv = Array.isArray(resp.inventory) ? resp.inventory : null;
  const sales = Array.isArray(resp.sales) ? resp.sales : null;
  const pendingTracking = Array.isArray(resp.pendingTracking) ? resp.pendingTracking : null;
  const mk = resp.syncMarketplace || 'ebay';
  const cn = resolveConnectNode();
  const jobs2 = [];
  if (inv && inv.length) jobs2.push(syncInventory({ marketplace: mk, nodeId: cn.nodeId, items: inv }).catch(() => null));
  if (sales && sales.length) jobs2.push(postSales({ marketplace: mk, sales }).catch(() => null));
  // Orders the Amazon fulfill script captured (destination + delivery date) → cloud,
  // then AUTO-CLAIM a tracking number for each (nearest ETA via the cloud's date window).
  if (pendingTracking && pendingTracking.length) jobs2.push(postTrackingOrders({ orders: pendingTracking }).then(autoClaimPending).catch(() => null));
  if (!jobs2.length) return;
  Promise.all(jobs2).then(async () => {
    try { salesData = await getSales(8); } catch {}
    try { inventorySummary = await getInventorySummary(); } catch {}
    if (activeTab === 'home') renderHome();
    else if (activeTab === 'inventory') renderInventory();
    else if (activeTab === 'tracking') renderTracking();
  });
}

// Auto-claim tracking numbers for pending orders. Gets the NEAREST ETA via the
// cloud's date-window search (exact day, then +1/+2/+3). Credit-safe: the cloud
// probes with the free /match first, so a no-match never spends a credit. Resilient
// — a failed claim never blocks the rest of the batch.
async function autoClaimPending() {
  try {
    const r = await getTrackingOrders({ status: 'pending' });
    const pend = (r.orders || []).filter(o => o.deliveryDate && o.buyerState);
    for (const o of pend) {
      try {
        const claim = await claimTracking({
          orderId: o.orderId, marketplace: o.marketplace,
          city: o.buyerCity, state: o.buyerState, zip: o.buyerZip, country: o.buyerCountry,
          deliveryDate: o.deliveryDate,
        });
        // Got a number → auto-push it to the buyer's marketplace (hits "Add tracking").
        if (claim && claim.trackingNumber) {
          autoPushTracking({ ...o, trackingNumber: claim.trackingNumber, carrier: claim.carrier });
        }
      } catch (e) { /* keep going — don't stop the batch */ }
    }
    if (activeTab === 'tracking') renderTracking();
  } catch { /* offline / not configured */ }
}

// Auto-push a claimed tracking number to the buyer's marketplace order via the
// extension (drives the eBay "Add tracking" flow), then marks the order synced.
function autoPushTracking(o) {
  const extId = ext.id || EXT_IDS[0];
  if (!(window.chrome && chrome.runtime && chrome.runtime.sendMessage && ext.installed)) return;
  chrome.runtime.sendMessage(extId, {
    type: 'SYNDRAX_PUSH_TRACKING', marketplace: o.marketplace, orderId: o.orderId,
    trackingNumber: o.trackingNumber, carrier: o.carrier,
  }, async (resp) => {
    if (chrome.runtime.lastError || !resp || !resp.ok) return;
    try { await updateTrackingOrder(o.id, { status: 'synced' }); } catch {}
    showToast(`Tracking ${o.trackingNumber} added to the buyer's order ✓`, 'success');
    if (activeTab === 'tracking') renderTracking();
  });
}

// Resolve the node a new account should attach to. Returns { nodeId, deviceId }.
// Defaults to the remembered pick, else the current PC, else the first node.
function resolveConnectNode() {
  const cur = cloudNodes.find(n => n.deviceId === currentDeviceId) || cloudNodes.find(n => n.nodeType === 'current');
  const remembered = cloudNodes.find(n => String(n.id) === lastConnectNode);
  const pick = remembered || cur || cloudNodes[0] || null;
  return { nodeId: pick ? pick.id : null, deviceId: pick ? pick.deviceId : currentDeviceId };
}

async function boot() {
  // Deep-link: ?tab=developer&view=jobs&id=<jobId>
  const _sp = new URLSearchParams(location.search);
  if (_sp.has('tab')) activeTab = _sp.get('tab');
  if (_sp.has('view')) devView = _sp.get('view');
  if (_sp.has('id')) devJobId = _sp.get('id');

  // Path deep-link: /app/developer[/<view>[/<id>]] (mirrors the vercel.json rewrite,
  // so the launcher's http://localhost:3000/app/developer opens the Developer page).
  const _pathM = location.pathname.match(/^\/app\/developer(?:\/([^/]+)(?:\/([^/]+))?)?/);
  if (_pathM) {
    activeTab = 'developer';
    if (_pathM[1]) devView = _pathM[1];
    if (_pathM[2]) devJobId = _pathM[2];
  }

  try { statusRow = await getStatus(); realPlan = statusRow.plan || 'none'; } catch { realPlan = 'none'; }
  // The owner/admin account is real Enterprise with full access to every tool.
  // Preview mode is the sandbox (any plan, incl. a free/trial new-user, sample data).
  if (isAdmin) { realPlan = 'enterprise'; statusRow = { plan: 'enterprise', status: 'active' }; }
  applyPlan();
  try { profile = await getProfile(); } catch { profile = {}; }
  if (!profile.onboarding_complete && realPlan === 'none' && !isAdmin) { location.replace('/onboarding'); return; }
  try { const mk = await getMarketplaces(); accounts = mk.accounts || []; } catch { accounts = []; }
  try { const nd = await getNodes(); cloudNodes = nd.nodes || []; } catch { cloudNodes = []; }
  try { const ad = await getAddons(); addons = ad.addons || []; } catch { addons = []; }
  try { salesData = await getSales(8); } catch { salesData = null; }
  try { inventorySummary = await getInventorySummary(); } catch { inventorySummary = null; }
  await syncExtensionAccounts();
  // Server-verified owner check — sets ownerVerified which controls Developer tab visibility.
  // Runs in background; renderShell() is called again on completion to reveal the tab.
  const session_ = getSession();
  if (session_) {
    const getIdToken_ = () => Promise.resolve(session_.idToken);
    checkOwnerStatus(getIdToken_).then(status => {
      ownerVerified = status.authorized === true;
      if (ownerVerified) renderShell();
    }).catch(() => {});
  }
  document.addEventListener('syndrax-ext', () => { ext = window.SyndraxExt || ext; syncExtensionAccounts().then(renderShell); });
  window.addEventListener('popstate', () => {
    const sp = new URLSearchParams(location.search);
    if (sp.has('tab')) activeTab = sp.get('tab');
    if (sp.has('view')) devView = sp.get('view') || 'overview';
    if (sp.has('id')) devJobId = sp.get('id') || null;
    renderShell();
  });
  // Receive real-time job progress from the extension's background service,
  // forwarded by the site bridge content script via window.dispatchEvent.
  window.addEventListener('syndrax:job-event', (e) => {
    const p = e.detail;
    if (!p || !p.jobId) return;
    const status = p.status === 'complete' ? 'complete' : p.status === 'error' ? 'error' : 'running';
    patchJob(p.jobId, status, p.message || '');
  });
  renderShell();

  // eBay OAuth return — show a toast based on the callback redirect params
  if (_sp.has('ebay_connected')) {
    showToast('eBay store connected — store name + seller details auto-filled from eBay.', 'success');
    history.replaceState(null, '', '/app?tab=accounts');
  } else if (_sp.has('ebay_dupe')) {
    showAlert(`That eBay store is already connected: ${_sp.get('ebay_dupe')}. Each store can only be linked once (IP/store rule).`);
    history.replaceState(null, '', '/app?tab=accounts');
  } else if (_sp.has('ebay_error')) {
    showAlert('eBay connection failed. Please try connecting again from the Marketplace library.');
    history.replaceState(null, '', '/app?tab=accounts');
  }
}

// ── shell ───────────────────────────────────────────────────────────────────
const GROUP_DEFS = [
  { label: 'Operate',  tabs: ['home', 'workspace', 'accounts', 'inventory'] },
  { label: 'Automate', tabs: ['jobs', 'tracking', 'devices'] },
  { label: 'Company',  tabs: ['team', 'audit', 'plan'] },
  { label: 'System',   tabs: ['developer'], ownerOnly: true },
];
const TAB_KICKER = {
  home: 'Sales command center', workspace: 'Automation command center',
  accounts: 'Marketplace management', inventory: 'Stock & listings',
  jobs: 'Job dispatch', tracking: 'Order fulfillment',
  devices: 'Node cluster', team: 'Team access',
  audit: 'Safety & compliance', plan: 'Plan & billing',
  developer: 'Owner only',
};

function renderShell() {
  syncSampleData();
  const root = document.getElementById('dashRoot');
  const curTab = TABS.find(t => t.id === activeTab) || TABS[0];
  const kicker = TAB_KICKER[activeTab] || '';
  const extOn = ext.installed;
  const acctCount = accounts.length;

  let displayName = (profile?.display_name || profile?.name || '').trim();
  if (!displayName) displayName = email.split('@')[0] || 'User';
  const initials = displayName.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || email.slice(0, 2).toUpperCase();

  const axisText = extOn
    ? `Monitoring ${acctCount} account${acctCount !== 1 ? 's' : ''}`
    : 'Extension not detected';
  const nodeName = (() => {
    const cur = nodes.find(n => n.local || n.nodeType === 'current');
    return cur ? (cur.name || 'root-main') : (extOn ? 'root-main' : '');
  })();
  const connPill = extOn
    ? `<div class="conn-pill on"><span class="pulse-dot"></span><span>Extension online</span><small>${esc(nodeName)}</small></div>`
    : `<div class="conn-pill off"><span class="pulse-dot"></span><span>Extension offline</span></div>`;

  const navGroups = GROUP_DEFS.filter(g => !g.ownerOnly || ownerVerified).map(g => {
    const grpTabs = g.tabs.map(id => TABS.find(t => t.id === id)).filter(t => t && (!t.adminOnly || isAdmin));
    if (!grpTabs.length) return '';
    return `<div class="nav-group">
      <div class="nav-group-title">${g.label}</div>
      ${grpTabs.map(navBtn).join('')}
    </div>`;
  }).join('');

  root.classList.toggle('sb-collapsed', sbCollapsed);
  const isHome = activeTab === 'home';
  const curTabLabel = isHome ? 'Command Center' : (TABS.find(t => t.id === activeTab) || TABS[0]).label;
  const curTabKicker = isHome ? 'Mission control' : (TAB_KICKER[activeTab] || '');
  root.innerHTML = `
    <aside class="sidebar">
      <div class="sb-brand-row">
        <div class="sb-brand">
          <div class="axis-orb${extOn ? '' : ' axis-off'}" title="AXIS ${extOn ? 'online' : 'offline'}">
            <img src="assets/images/synball.png" class="axis-orb-img" alt="">
            <span class="axis-dot"></span>
          </div>
          <span class="sb-wordmark">SYNDRAX</span>
        </div>
        <button class="sb-collapse-btn" id="sbCollapse" title="${sbCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}">${icon('chevrons')}</button>
      </div>
      <nav class="side-nav">
        ${navGroups}
      </nav>
      <div class="sb-foot">
        <div class="sb-ext ${extOn ? 'on' : 'off'}" title="${extOn ? 'Extension online' : 'Extension offline'}">
          <span class="sb-ext-dot"></span>
          <span class="sb-user-copy"><strong>${extOn ? 'Extension online' : 'Extension offline'}</strong><span>${extOn ? esc(nodeName || 'root-main') : 'Install to run jobs'}</span></span>
        </div>
        ${ownerVerified ? `
        <div class="sb-dev-row">
          <button class="sb-dev-btn" id="devQuickBtn" title="Dev Studio">
            <span class="sb-dev-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="14" height="14"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
            </span>
            <span class="nav-label">Dev Studio</span>
            <span class="sb-dev-badge">owner</span>
          </button>
          <div class="dev-launch-panel" id="devLaunchPanel">
            <div class="dlp-head">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="11" height="11"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
              Dev Studio
              <span class="dlp-head-pill">local</span>
            </div>
            <button class="dlp-btn dlp-primary" id="dlpOpenLocal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              Open Local Studio
            </button>
            <button class="dlp-btn" id="dlpDownload">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Launcher
            </button>
            <a class="dlp-btn" href="/install">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Install Guide
            </a>
            <div class="dlp-msg" id="dlpMsg"></div>
          </div>
        </div>` : ''}
        <div class="sb-user">
          <div class="sb-avatar" title="${esc(displayName)} · ${esc(PLAN_LABEL[plan] || plan)}">${esc(initials)}</div>
          <div class="sb-user-copy"><strong>${esc(displayName)}</strong><span>${esc(PLAN_LABEL[plan] || plan)}</span></div>
          <button class="sfx-toggle-v2${sfxEnabled() ? ' on' : ''}" id="sfxToggle" title="${sfxEnabled() ? 'Sound on' : 'Sound off'}">${icon(sfxEnabled() ? 'sound' : 'mute')}</button>
          <button class="sb-signout" id="signOut" title="Sign out">${icon('x')}</button>
        </div>
      </div>
    </aside>
    <div class="dash-body">
      <header class="topbar">
        <div style="display:flex;align-items:center;gap:12px;min-width:0;flex:1">
          ${!isHome ? `<button class="topbar-back" id="backBtn">${icon('chevrons')} Home</button>` : ''}
          <div class="page-identity">
            <span class="page-kicker">${esc(curTabKicker)}</span>
            <h1>${esc(curTabLabel)}</h1>
            <span id="topSub"></span>
          </div>
        </div>
        <div class="topbar-actions">
          <button class="cmd-search" id="cmdSearch">${icon('search')}<span>Search…</span><kbd>⌘K</kbd></button>
          ${connPill}
          <button class="profile-btn" id="profileBtn" title="${esc(email)}">
            <span class="pb-av">${esc(initials)}</span>
            <span style="font-size:11px;color:var(--text-2);font-weight:600">${esc(displayName.split(' ')[0])}</span>
          </button>
          <div class="profile-menu" id="profileMenu">
            <div class="pm-head">
              <div class="pm-av">${esc(initials)}</div>
              <div class="pm-info">
                <strong>${esc(displayName)}</strong>
                <span>${esc(email)}</span>
              </div>
            </div>
            <button class="pm-signout" id="pmSignOut">Sign out</button>
          </div>
        </div>
      </header>
      ${isAdmin ? adminBar() : ''}
      <div class="auth-alert" id="appAlert" style="margin:0 26px"></div>
      <main class="page-view" id="content"></main>
    </div>`;

  const bb = $('#backBtn'); if (bb) bb.onclick = () => { activeTab = 'home'; renderShell(); };
  const sbc = $('#sbCollapse'); if (sbc) sbc.onclick = () => { sbCollapsed = !sbCollapsed; localStorage.setItem('syndrax_sb_collapsed', sbCollapsed ? '1' : '0'); renderShell(); };
  $('#signOut').onclick = () => { signOut(); location.href = '/login'; };
  const pso = $('#pmSignOut'); if (pso) pso.onclick = () => { signOut(); location.href = '/login'; };
  const pb = $('#profileBtn'), pm = $('#profileMenu');
  if (pb && pm) {
    pb.onclick = (e) => {
      e.stopPropagation();
      if (pm.classList.contains('open')) { pm.classList.remove('open'); return; }
      pm.classList.add('open');
      const close = () => { pm.classList.remove('open'); document.removeEventListener('click', close); };
      document.addEventListener('click', close);
    };
  }
  const cs = $('#cmdSearch'); if (cs) cs.onclick = openCommandPalette;
  const sfxBtn = $('#sfxToggle');
  if (sfxBtn) sfxBtn.onclick = () => { const on = toggleSfx(); sfxBtn.classList.toggle('on', on); sfxBtn.title = on ? 'Sound on' : 'Sound off'; sfxBtn.innerHTML = icon(on ? 'sound' : 'mute'); };
  if (isAdmin) {
    root.querySelectorAll('[data-pp]').forEach(b => b.onclick = () => {
      previewPlan = b.dataset.pp; localStorage.setItem(PREVIEW_KEY, previewPlan); applyPlan(); renderShell();
    });
    const reset = $('#ppReset');
    if (reset) reset.onclick = () => { previewPlan = null; localStorage.removeItem(PREVIEW_KEY); applyPlan(); renderShell(); };
  }
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
    activeTab = b.dataset.tab;
    selectedJobId = null;
    if (activeTab !== 'developer') { devView = 'overview'; devJobId = null; }
    // Developer tab needs maximum workspace — auto-collapse sidebar when entered.
    // Restore the user's saved sidebar preference when leaving Developer.
    if (activeTab === 'developer') { sbCollapsed = true; }
    else { sbCollapsed = localStorage.getItem('syndrax_sb_collapsed') === '1'; }
    renderShell();
  });
  // Mini refresh animation: flash the content area when switching tabs
  const content = document.getElementById('content');
  if (content) {
    content.style.opacity = '0';
    content.style.transform = 'translateY(6px)';
    requestAnimationFrame(() => {
      content.style.transition = 'opacity .18s ease, transform .18s ease';
      content.style.opacity = '1';
      content.style.transform = 'translateY(0)';
    });
  }

  // Owner dev quick-launch panel
  if (ownerVerified) {
    const devBtn = $('#devQuickBtn');
    const devPanel = $('#devLaunchPanel');
    if (devBtn && devPanel) {
      devBtn.onclick = (e) => {
        e.stopPropagation();
        const open = devPanel.classList.toggle('open');
        if (open) {
          const close = () => { devPanel.classList.remove('open'); document.removeEventListener('click', close); };
          document.addEventListener('click', close);
        }
      };
      $('#dlpOpenLocal').onclick = () => { window.open('http://localhost:3000/app/developer', '_blank'); devPanel.classList.remove('open'); };
      $('#dlpDownload').onclick = async () => {
        const msg = $('#dlpMsg');
        const btn = $('#dlpDownload');
        btn.textContent = 'Downloading…'; btn.disabled = true;
        try {
          await downloadLauncherScript();
          btn.textContent = '✓ Saved to Downloads'; msg.textContent = '';
          setTimeout(() => { btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Launcher`; btn.disabled = false; }, 3000);
        } catch (e) {
          btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Launcher`; btn.disabled = false;
          if (msg) msg.textContent = 'Error: ' + e.message;
        }
      };
    }
  }

  renderTab();
}

function navBtn(t) {
  const locked = t.feature && !can(t.feature);
  // AXIS alert badge — the audit tab shows a count + blinks red when there's a critical finding.
  const alertCount = (t.id === 'audit' && typeof axisAlertCount === 'number' && axisAlertCount > 0) ? axisAlertCount : null;
  const alertCls = alertCount ? ` nav-alert${axisAlertCritical ? ' nav-alert-critical' : ''}` : '';
  // Accounts tab: calm yellow pulse when the user has zero connected marketplaces/stores —
  // a gentle nudge to connect their first store. Stops as soon as any account exists.
  const emptyAccounts = (t.id === 'accounts' && Array.isArray(accounts) && accounts.length === 0) ? ' nav-pulse-empty' : '';
  return `<button class="nav-item${activeTab === t.id ? ' active' : ''}${alertCls}${emptyAccounts}" data-tab="${t.id}" title="${t.label}${locked ? ' (upgrade)' : ''}${emptyAccounts ? ' — connect your first store' : ''}">
    ${icon(t.icon)}<span class="nav-label">${t.label}</span>${alertCount ? `<span class="nav-badge nav-badge-alert">${alertCount}</span>` : ''}${locked ? `<span class="nav-lock">${icon('lock')}</span>` : ''}
  </button>`;
}

function adminBar() {
  const segs = [['trial', 'Free / Trial'], ['business', 'Business'], ['growth', 'Growth'], ['enterprise', 'Enterprise']];
  return `<div class="admin-bar">
    <span class="ab-label">★ Admin sandbox</span>
    <div class="admin-seg">
      ${segs.map(([p, lbl]) => `<button data-pp="${p}" class="${plan === p && previewPlan ? 'on' : ''}">${lbl}</button>`).join('')}
    </div>
    <span class="ab-note">${previewPlan ? `previewing <b style="color:#e5e5e5">${PLAN_LABEL[plan]}</b> with sample data (testing)` : 'your real account · <b style="color:#fcd34d">Enterprise</b> · full access'}</span>
    ${previewPlan ? '<button class="ab-reset" id="ppReset">exit to real account</button>' : ''}
  </div>`;
}

function devicePill() {
  return ext.installed
    ? `<span class="relay-pill on">${icon('wifi')} This PC connected</span>`
    : `<span class="relay-pill off">${icon('monitor')} Extension not detected</span>`;
}

// Professional empty state — small icon chip + title + one line + optional CTA.
// Replaces the full-height ghost-icon blocks. cta = [label, tabId].
function emptyState(iconName, title, desc, cta) {
  return `<div class="empty-pro">
    <div class="ep-ico">${icon(iconName)}</div>
    <h3>${esc(title)}</h3>
    <p>${esc(desc)}</p>
    ${cta ? `<button class="app-btn sm" data-go="${esc(cta[1])}">${esc(cta[0])}</button>` : ''}
  </div>`;
}

// ── Global Focus bar (Node + Account context) ────────────────────────────────
// One persistent strip across the data tabs so you always know WHAT you're looking
// at — which device (node) and which marketplace account. Selection is remembered
// and filters Inventory + Tracking. (Per-member access is a backend follow-up;
// everyone in the workspace sees every node/account for now.)
function focusNodeList() {
  const list = [{ id: currentDeviceId, name: ext.installed ? 'This PC' : 'This PC', on: ext.installed }];
  (cloudNodes || []).forEach(n => { const id = n.deviceId || n.device_id || String(n.id); if (!list.some(x => String(x.id) === String(id))) list.push({ id, name: n.name || 'Node', on: n.status === 'online' }); });
  (addedDevices || []).forEach(d => { const id = d.id || d.ip; if (id && !list.some(x => String(x.id) === String(id))) list.push({ id, name: d.name || d.ip, on: false }); });
  return list;
}
function focusedAccount() { return accounts.find(a => String(a.id) === String(focusAccount)) || null; }
function focusedMarketplace() { const a = focusedAccount(); return a ? a.marketplace : null; }

function scopeBar() {
  const nodes = focusNodeList();
  const node = focusNode === 'all' ? null : nodes.find(n => String(n.id) === String(focusNode));
  const nodeName = node ? node.name : 'All nodes';
  const acct = focusedAccount();
  const acctName = acct ? (acct.label || marketplace(acct.marketplace)?.name || acct.marketplace) : 'All accounts';
  const acctLogo = acct ? (marketplaceLogo(acct.marketplace) || `<span style="font:800 10px var(--nav-font);color:#fff">${(marketplace(acct.marketplace)?.name || '?')[0]}</span>`) : '';

  const nodeMenu = openScopeMenu === 'node' ? `<div class="sb-menu">
    <button class="sb-opt ${focusNode === 'all' ? 'on' : ''}" data-setnode="all"><span class="sb-dot all"></span>All nodes</button>
    ${nodes.map(n => `<button class="sb-opt ${String(focusNode) === String(n.id) ? 'on' : ''}" data-setnode="${esc(n.id)}"><span class="sb-dot ${n.on ? '' : 'all'}"></span>${esc(n.name)}<span class="sb-sub">${n.on ? 'online' : 'offline'}</span></button>`).join('')}
  </div>` : '';
  const acctMenu = openScopeMenu === 'account' ? `<div class="sb-menu">
    <button class="sb-opt ${focusAccount === 'all' ? 'on' : ''}" data-setacct="all"><span class="sb-chip"></span>All accounts</button>
    ${accounts.length ? accounts.map(a => { const m = marketplace(a.marketplace); const lg = marketplaceLogo(a.marketplace) || `<span style="font:800 10px var(--nav-font);color:#fff">${(m?.name || '?')[0]}</span>`; return `<button class="sb-opt ${String(focusAccount) === String(a.id) ? 'on' : ''}" data-setacct="${esc(a.id)}"><span class="sb-chip neutral">${lg}</span>${esc(a.label || m?.name || a.marketplace)}<span class="sb-sub">${esc(m?.name || a.marketplace)}</span></button>`; }).join('') : '<div style="padding:8px 10px;font-size:11px;color:rgba(255,255,255,0.35)">No accounts connected yet</div>'}
  </div>` : '';

  return `<div class="scope-bar" id="scopeBar">
    <span class="sb-lbl">Focus</span>
    <div class="sb-pick node" data-scope="node">${iconCls('monitor', 'sb-ico')}<span class="sb-val">${esc(nodeName)}</span>${iconCls('caret', 'sb-caret')}${nodeMenu}</div>
    <span class="sb-sep"></span>
    <div class="sb-pick" data-scope="account"><span class="sb-chip neutral">${acct ? acctLogo : iconCls('tag', 'sb-ico')}</span><span class="sb-val">${esc(acctName)}</span>${iconCls('caret', 'sb-caret')}${acctMenu}</div>
    <span class="sb-spacer"></span>
    <span class="sb-hint">${iconCls('shield', 'sb-ico')} ${focusAccount === 'all' && focusNode === 'all' ? 'Showing everything in this workspace' : 'Filtered view'}</span>
  </div>`;
}

// Wire the focus bar inside a freshly painted container; `repaint` re-renders the tab.
function wireScopeBar(content, repaint) {
  content.querySelectorAll('[data-scope]').forEach(el => el.onclick = (e) => {
    if (e.target.closest('.sb-menu')) return; // clicks inside the menu handled below
    const which = el.dataset.scope;
    openScopeMenu = openScopeMenu === which ? null : which;
    repaint();
  });
  content.querySelectorAll('[data-setnode]').forEach(b => b.onclick = (e) => { e.stopPropagation(); focusNode = b.dataset.setnode; localStorage.setItem('syndrax_focus_node', focusNode); openScopeMenu = null; repaint(); });
  content.querySelectorAll('[data-setacct]').forEach(b => b.onclick = (e) => { e.stopPropagation(); focusAccount = b.dataset.setacct; localStorage.setItem('syndrax_focus_acct', focusAccount); if (focusAccount !== 'all') selectedTarget = focusAccount; openScopeMenu = null; repaint(); });
}

function showAlert(msg, type = 'error') { const el = $('#appAlert'); if (el) { el.textContent = msg; el.className = 'auth-alert ' + type; } }

function showToast(msg, type = 'info', duration = 4200) {
  playSfx(type === 'success' ? 'confirm' : type === 'error' ? 'error' : 'nav');
  let box = document.getElementById('toastBox');
  if (!box) { box = document.createElement('div'); box.id = 'toastBox'; document.body.appendChild(box); }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  t.innerHTML = `<span class="toast-ico">${icons[type] || icons.info}</span><span>${esc(msg)}</span>`;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 340); }, duration);
}

// ── tab router ────────────────────────────────────────────────────────────────
function renderTab() {
  const t = TABS.find(x => x.id === activeTab);
  if (t?.feature && !can(t.feature)) return renderUpgradeLock(t.feature);
  if (activeTab === 'devices') playSfx('scan');
  if (activeTab === 'developer') { renderDeveloperTab(); return; }
  ({
    home: renderHome, workspace: renderWorkspace, accounts: renderAccounts, inventory: renderInventory,
    jobs: renderJobsTab, tracking: renderTracking, devices: renderDevices, team: renderTeam,
    extension: renderExtension, audit: renderAudit, plan: renderPlanTab,
  }[activeTab] || renderHome)();
}

function renderDeveloperTab() {
  const session = getSession();
  const getIdToken = session ? () => Promise.resolve(session.idToken) : null;
  const api = makeDevApiFns(getIdToken);
  const getOwnerStatus = () => checkOwnerStatus(getIdToken);
  function navigate(view, jobId) {
    devView = view; devJobId = jobId || null;
    const sp = new URLSearchParams({ tab: 'developer', view });
    if (jobId) sp.set('id', jobId);
    history.pushState({}, '', '?' + sp.toString());
    renderDeveloper({ getOwnerStatus, api, render: h => { $('#content').innerHTML = h; }, devView, devJobId, navigate });
  }
  renderDeveloper({ getOwnerStatus, api, render: h => { $('#content').innerHTML = h; }, devView, devJobId, navigate });
}

function renderUpgradeLock(feature) {
  const np = nextPlan(plan);
  $('#content').innerHTML = `
    <div class="ws-empty" style="max-width:520px;margin:40px auto;padding:34px">
      <div style="width:46px;height:46px;border-radius:13px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;color:#e5e5e5">${icon('lock')}</div>
      <h3 style="color:#f1f5f9;font:700 16px var(--nav-font);margin:4px 0">A ${np ? PLAN_LABEL[np] : 'higher'} feature</h3>
      <p style="color:rgba(255,255,255,0.45);font-size:13.5px;text-align:center;line-height:1.6;max-width:380px">Run on more devices and isolate each marketplace account on its own IP — that's how you scale without linked-account restrictions.</p>
      ${np ? `<button class="app-btn" id="lockUp">Upgrade to ${PLAN_LABEL[np]}</button>` : ''}
      <p style="color:rgba(255,255,255,0.4);font-size:11px">You're on ${PLAN_LABEL[plan]}.</p>
    </div>`;
  const b = $('#lockUp'); if (b) b.onclick = () => startCheckout(np).catch(e => showAlert(e.message));
}

// ── HOME / OVERVIEW ───────────────────────────────────────────────────────────
const fmt$ = (n) => '$' + Math.round(n).toLocaleString();

const previewMode = () => isAdmin && !!previewPlan;

// ── Demo data layer ──────────────────────────────────────────────────────────
// In admin preview (the sandbox), populate the whole app with realistic demo
// state so every page looks like a busy, fully-operating account. Real data is
// snapshotted and restored the moment preview is exited — nothing is persisted.
let _realDataSnapshot = null;
function buildSampleData() {
  const now = Date.now(), m = 60e3, h = 3600e3;
  const accounts = [];
  const cloudNodes = [];
  const jobs = loadJobs();
  const inventorySummary = { total: 0, outOfStock: 0, inStockByMarketplace: {} };
  const PROD = [];
  const invItems = PROD.map((p, i) => ({ id: 'inv' + i, title: p[0], sku: p[1], marketplace: p[2], price: p[3], cost: p[4], inStock: !!p[5], qty: p[6], asin: p[7], sourceUrl: 'https://www.amazon.com/dp/' + p[7] }));
  const claims = [];
  const trackingBalance = { credits: 0, configured: false, claims, allotment: 0 };
  const TORD = [];
  const trackingOrders = TORD.map((o, i) => ({ id: 'ord' + i, marketplace: o[0], orderId: o[1], buyerCity: o[2], buyerState: o[3], buyerZip: o[4], deliveryDate: now + o[5] * 86400e3, trackingNumber: o[6], status: o[7], carrier: o[8] }));
  return { accounts, cloudNodes, jobs, inventorySummary, invItems, trackingBalance, trackingOrders };
}
// Swap globals to demo data in preview, restore the real snapshot when exited.
function syncSampleData() {
  if (previewMode()) {
    if (!_realDataSnapshot) _realDataSnapshot = { jobs, accounts, cloudNodes, inventorySummary, invItems, trackingBalance, trackingOrders };
    const s = buildSampleData();
    jobs = s.jobs; accounts = s.accounts; cloudNodes = s.cloudNodes; inventorySummary = s.inventorySummary;
    invItems = s.invItems; trackingBalance = s.trackingBalance; trackingOrders = s.trackingOrders;
  } else if (_realDataSnapshot) {
    jobs = _realDataSnapshot.jobs; accounts = _realDataSnapshot.accounts; cloudNodes = _realDataSnapshot.cloudNodes;
    inventorySummary = _realDataSnapshot.inventorySummary; invItems = _realDataSnapshot.invItems;
    trackingBalance = _realDataSnapshot.trackingBalance; trackingOrders = _realDataSnapshot.trackingOrders;
    _realDataSnapshot = null;
  }
}

// Performance series. SAMPLE numbers appear ONLY in admin preview (to showcase a
// plan); the real view never shows fake profit — it shows real synced data, or an
// honest empty state until a sales sync lands.
function salesSeries() {
  const labels = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];
  if (previewMode()) {
    const scale = { trial: 0.6, business: 1, growth: 2.6, enterprise: 6, none: 0.4 }[plan] || 1;
    const gross = [340, 420, 390, 520, 610, 560, 720, 880].map(v => Math.round(v * scale));
    const net = gross.map(v => Math.round(v * 0.42));
    return { labels, gross, net, grossTotal: gross.reduce((a, b) => a + b, 0), netTotal: net.reduce((a, b) => a + b, 0), orders: Math.round(gross.reduce((a, b) => a + b, 0) / 42), sample: true };
  }
  // Real view: read the live P&L from /api/sales. If there's no data yet, show the
  // honest empty state. NEVER fabricate numbers here.
  const s = salesData && salesData.series;
  if (s && !salesData.empty) {
    return { labels: s.labels || labels, gross: s.gross || [], net: s.net || [], grossTotal: s.grossTotal || 0, netTotal: s.netTotal || 0, orders: s.orders || 0 };
  }
  return { labels, gross: [], net: [], grossTotal: 0, netTotal: 0, orders: 0, empty: true };
}

function areaChart(labels, sets) {
  const W = 760, H = 200, pl = 10, pr = 10, pt = 12, pb = 22;
  const max = Math.max(1, ...sets.flatMap(s => s.data));
  const n = labels.length;
  const x = i => pl + (i / (n - 1)) * (W - pl - pr);
  const y = v => pt + (1 - v / max) * (H - pt - pb);
  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">`;
  for (let g = 0; g <= 3; g++) { const gy = pt + (g / 3) * (H - pt - pb); svg += `<line x1="${pl}" y1="${gy}" x2="${W - pr}" y2="${gy}" stroke="rgba(255,255,255,.06)"/>`; }
  sets.forEach(s => {
    const pts = s.data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    svg += `<polygon points="${pl},${H - pb} ${pts} ${W - pr},${H - pb}" fill="${s.color}" opacity="0.10"/>`;
    svg += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    s.data.forEach((v, i) => { svg += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.4" fill="${s.color}"/>`; });
  });
  labels.forEach((l, i) => { svg += `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.4)">${l}</text>`; });
  return svg + '</svg>';
}

// Simple, readable vertical bars (used for the Inventory chart view). One bar per
// label with its value on top — deliberately plain, no axes math to parse.
function barChart(data) {
  const W = 760, H = 200, pl = 10, pr = 10, pt = 16, pb = 30;
  const max = Math.max(1, ...data.map(d => d.value));
  const n = Math.max(1, data.length);
  const bw = (W - pl - pr) / n;
  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block">`;
  for (let g = 0; g <= 3; g++) { const gy = pt + (g / 3) * (H - pt - pb); svg += `<line x1="${pl}" y1="${gy}" x2="${W - pr}" y2="${gy}" stroke="rgba(255,255,255,.06)"/>`; }
  data.forEach((d, i) => {
    const h = (d.value / max) * (H - pt - pb);
    const x = pl + i * bw + bw * 0.24, w = bw * 0.52, y = H - pb - h;
    const c = d.color || '#d4d4d4';
    svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(2, h).toFixed(1)}" rx="5" fill="${c}" opacity=".9"/>`;
    svg += `<text x="${(x + w / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="800" fill="#f5f5f5">${d.value}</text>`;
    svg += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 9}" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.35)">${esc(d.label)}</text>`;
  });
  return svg + '</svg>';
}

// Connected marketplaces (deduped from accounts) — the only ones we count/show.
function connectedMarketplaces() { return [...new Set(accounts.map(a => a.marketplace))]; }
// Whole-number days since an ISO timestamp (null → never).
function daysSince(iso) { if (!iso) return null; const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); return d < 0 ? 0 : d; }
function syncAgeLabel(iso) {
  const d = daysSince(iso);
  if (d === null) return 'not synced yet';
  if (d === 0) return 'synced today';
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

function stat(label, val, ic, dir, sub) {
  return `<div class="metric-card"><div class="metric-label">${icon(ic)} ${label}</div><div class="metric-value">${val}</div><div class="metric-sub ${dir || ''}">${sub}</div></div>`;
}

function accountsStrip() {
  const connected = accounts.map(a => {
    const m = marketplace(a.marketplace);
    const logo = marketplaceLogo(a.marketplace) || `<span style="font:800 16px var(--nav-font);color:#fff">${(m?.name || '?')[0]}</span>`;
    return `<div class="acct-chip active"><span class="ac-logo neutral">${logo}</span><div><div class="ac-name">${esc(a.label || m?.name || a.marketplace)}</div><div class="ac-sub on">● active</div></div></div>`;
  }).join('');
  const have = new Set(accounts.map(a => a.marketplace));
  const adds = MARKETPLACES.filter(m => m.access !== 'source' && !have.has(m.id)).slice(0, 3).map(m => {
    const logo = marketplaceLogo(m.id) || `<span style="font:800 16px var(--nav-font);color:#e5e5e5">${m.name[0]}</span>`;
    return `<div class="acct-chip add" data-connect="${m.id}"><span class="ac-logo">${logo}</span><div><div class="ac-name">${m.name}</div><div class="ac-sub">+ connect</div></div></div>`;
  }).join('');
  return (connected + adds) || '<div class="empty-pro" style="padding:18px 0"><h3 style="font-size:14px;margin:0 0 6px">Connect eBay first</h3><p style="font-size:12.5px;color:rgba(255,255,255,0.45);margin:0 0 12px">Start the money loop: connect one eBay store, sync inventory, then run tools.</p><button class="app-btn sm" data-connect="ebay">Connect eBay</button></div>';
}

// Premium semi-3D AXIS agent. State drives eye/ring/core color + behaviour:
// Compact AXIS avatar — just the recognizable face (visor + glowing eyes +
// antenna) in a small rounded tile. Used in tight spaces like the Command
// Center assistant panel, where the full standing robot's rings/glow don't
// fit. Self-contained: no absolutely-positioned rings to overflow a container.
function axisFaceHtml(state) {
  const s = ['ok', 'warn', 'critical', 'success', 'scanning', 'thinking'].includes(state) ? state : 'ok';
  return `<div class="axis-face" data-state="${s}">
    <span class="axis-face-ant"></span>
    <div class="axis-face-visor"><span class="axis-face-eye"></span><span class="axis-face-eye"></span></div>
  </div>`;
}

// AXIS mascot — a compact, fully self-contained 3D-ish metal robot. Glossy
// metallic head + body, a glass visor with glowing eyes that blink and glance
// around, a pulsing antenna and chest core, a gentle idle float and an
// occasional jiggle so it feels alive. Everything lives inside a fixed box so
// nothing can overflow its panel (the old rings/glow caused that).
function axisBotHtml(state) {
  const s = ['ok', 'warn', 'critical', 'success', 'scanning', 'thinking'].includes(state) ? state : 'ok';
  return `<div class="bot" data-state="${s}" aria-hidden="true">
    <span class="bot-ant"><span class="bot-ant-dot"></span></span>
    <div class="bot-head">
      <span class="bot-shine"></span>
      <span class="bot-ear bot-ear--l"></span><span class="bot-ear bot-ear--r"></span>
      <div class="bot-visor"><span class="bot-eye"></span><span class="bot-eye"></span><span class="bot-visor-glare"></span></div>
    </div>
    <div class="bot-body">
      <span class="bot-shine bot-shine--sm"></span>
      <span class="bot-core"></span>
    </div>
  </div>`;
}

// ok (cyan, calm), success (green), warn (amber), critical (red, alert).
// opts.hero scales it up for the Command Center hero surface.
function axisCharHtml(state, opts = {}) {
  const valid = ['ok', 'warn', 'critical', 'success', 'scanning', 'thinking'];
  const s = valid.includes(state) ? state : 'ok';
  const hero = opts.hero ? ' axis-hero' : '';
  return `<div class="axis-char${hero}" data-state="${s}">
    <span class="axis-ring r1"></span><span class="axis-ring r2"></span><span class="axis-ring r3"></span>
    <span class="axis-think"><i></i><i></i><i></i></span>
    <div class="axis-scene">
      <div class="axis-head">
        <span class="axis-antenna"><span class="axis-ant-dot"></span></span>
        <div class="axis-visor">
          <span class="axis-eye"></span><span class="axis-eye"></span>
          <span class="axis-scan"></span>
          <span class="axis-visor-gloss"></span>
        </div>
        <div class="axis-chin"></div>
        <span class="axis-head-gloss"></span>
      </div>
      <div class="axis-neck"></div>
      <div class="axis-torso">
        <span class="axis-shoulder left"></span>
        <span class="axis-shoulder right"></span>
        <span class="axis-core"><span class="axis-core-ring"></span><span class="axis-core-logo">S</span></span>
        <div class="axis-chest-vent"></div>
        <span class="axis-torso-gloss"></span>
      </div>
      <div class="axis-arm left"></div>
      <div class="axis-arm right"></div>
      <div class="axis-legs"><div class="axis-leg"></div><div class="axis-leg"></div></div>
    </div>
    <div class="axis-shadow"></div>
  </div>`;
}

function renderSparkline(series) {
  const { gross, net, labels } = series;
  if (!gross || !gross.length) return null;
  const W = 260, H = 68, pl = 4, pr = 4, pt = 6, pb = 14;
  const maxV = Math.max(1, ...gross);
  const n = gross.length;
  const xp = i => (pl + (i / (n - 1)) * (W - pl - pr)).toFixed(1);
  const yp = v => (pt + (1 - v / maxV) * (H - pt - pb)).toFixed(1);
  const gPts = gross.map((v, i) => `${xp(i)},${yp(v)}`).join(' ');
  const nPts = net && net.length ? net.map((v, i) => `${xp(i)},${yp(v)}`).join(' ') : null;
  let svg = `<svg class="hb-spark-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">`;
  svg += `<polygon points="${pl},${H - pb} ${gPts} ${W - pr},${H - pb}" fill="rgba(255,255,255,0.07)"/>`;
  svg += `<polyline points="${gPts}" fill="none" stroke="#d4d4d4" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  if (nPts) {
    svg += `<polygon points="${pl},${H - pb} ${nPts} ${W - pr},${H - pb}" fill="rgba(74,222,128,0.06)"/>`;
    svg += `<polyline points="${nPts}" fill="none" stroke="#4ade80" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="4 3"/>`;
  }
  if (labels && labels.length) {
    svg += `<text x="${pl}" y="${H - 2}" font-size="9" fill="#334155">${esc(labels[0])}</text>`;
    svg += `<text x="${W - pr}" y="${H - 2}" font-size="9" fill="#334155" text-anchor="end">${esc(labels[labels.length - 1])}</text>`;
  }
  return svg + '</svg>';
}

// Detailed analytics overlay — toggle Gross / Net / Orders / Inventory over one
// chart, with KPI cards, marketplace split, and top products. Sample data in
// preview; real /api/sales series otherwise. Escape / backdrop / × to close.
function openAnalyticsOverlay() {
  let period = homePeriod || '8w';
  const isPreview = previewMode();
  // Real-mode: only Gross + Net (orders/inventory series come from gen() which is preview-only).
  const enabled = { gross: true, net: true };
  const planScale = ({ trial: .6, business: 1, growth: 2.6, enterprise: 6, none: .4 })[plan] || 1;
  const money = v => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`;
  // Preview mode: all 4 metrics; real mode: only the two we have real series for.
  const METRICS = isPreview
    ? [{ k: 'gross', c: '#d4d4d4', name: 'Gross' }, { k: 'net', c: '#34d399', name: 'Net' },
       { k: 'orders', c: '#a78bfa', name: 'Orders' }, { k: 'inventory', c: '#fbbf24', name: 'Inventory' }]
    : [{ k: 'gross', c: '#d4d4d4', name: 'Gross' }, { k: 'net', c: '#34d399', name: 'Net' }];

  // Sample data generator — ONLY used in admin preview/sandbox. Never call in real mode.
  function gen() {
    const cfg = { '7d': { n: 7, sc: .32, lbl: i => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i] },
      '30d': { n: 10, sc: 1, lbl: i => `${i * 3 + 1}` },
      '8w': { n: 8, sc: 2.4, lbl: i => `W${i + 1}` } }[period];
    const gross = [], net = [], orders = [], units = [], inv = [];
    for (let i = 0; i < cfg.n; i++) {
      const g = Math.round((360 + i * 46 + Math.sin(i * 0.85) * 80 + (i % 3) * 34) * cfg.sc * planScale);
      gross.push(g); net.push(Math.round(g * 0.42));
      const o = Math.max(1, Math.round(g / 46)); orders.push(o); units.push(Math.round(o * 1.4));
      inv.push(1180 + Math.round(Math.sin(i * 0.6) * 60) + i * 6);
    }
    return { labels: Array.from({ length: cfg.n }, (_, i) => cfg.lbl(i)), gross, net, orders, units, inventory: inv };
  }

  // Real-data series — reads from the /api/sales response stored in salesData.
  function realSeries() {
    const s = salesData && salesData.series;
    if (s && !salesData.empty && Array.isArray(s.gross) && s.gross.length) {
      const labels = s.labels || s.gross.map((_, i) => `W${i + 1}`);
      const net = Array.isArray(s.net) && s.net.length ? s.net : s.gross.map(g => Math.round(g * 0.42));
      return { labels, gross: s.gross, net, orders: [], units: [], inventory: [],
               grossTotal: s.grossTotal || s.gross.reduce((a, b) => a + b, 0),
               netTotal: s.netTotal || net.reduce((a, b) => a + b, 0),
               orderCount: s.orders || 0, hasData: true };
    }
    return { labels: [], gross: [], net: [], orders: [], units: [], inventory: [],
             grossTotal: 0, netTotal: 0, orderCount: 0, hasData: false };
  }

  function kpis(d) {
    const sum = a => (Array.isArray(a) ? a : []).reduce((x, y) => x + y, 0);
    const gT = d.grossTotal != null ? d.grossTotal : sum(d.gross);
    const nT = d.netTotal   != null ? d.netTotal   : sum(d.net);
    const oT = isPreview ? sum(d.orders) : (d.orderCount || 0);
    const uT = isPreview ? sum(d.units)  : 0;
    const half = Math.floor(d.gross.length / 2);
    const prev = sum(d.gross.slice(0, half)) || 1, cur = sum(d.gross.slice(half));
    return { gT, nT, oT, uT, aov: oT ? gT / oT : 0, margin: gT ? Math.round(nT / gT * 100) : 0, wow: Math.round((cur - prev) / prev * 100) };
  }

  function chart(d) {
    const W = 880, H = 270, pl = 16, pr = 16, pt = 18, pb = 28;
    const n = d.labels.length, x = i => pl + (i / (n - 1)) * (W - pl - pr);
    let svg = `<svg viewBox="0 0 ${W} ${H}" class="an-chart-svg" preserveAspectRatio="none">`;
    for (let g = 0; g <= 4; g++) { const gy = pt + (g / 4) * (H - pt - pb); svg += `<line x1="${pl}" y1="${gy}" x2="${W - pr}" y2="${gy}" stroke="rgba(255,255,255,.05)"/>`; }
    METRICS.filter(m => enabled[m.k] && Array.isArray(d[m.k]) && d[m.k].length).forEach((m, idx) => {
      const vals = d[m.k], mx = Math.max(1, ...vals), y = v => pt + (1 - v / mx) * (H - pt - pb);
      const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      if (idx === 0) svg += `<polygon points="${pl},${H - pb} ${pts} ${W - pr},${H - pb}" fill="${m.c}" opacity=".08"/>`;
      svg += `<polyline points="${pts}" fill="none" stroke="${m.c}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" opacity=".95"/>`;
      vals.forEach((v, i) => { svg += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.6" fill="${m.c}"/>`; });
    });
    d.labels.forEach((l, i) => { svg += `<text x="${x(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="#56657a">${esc(l)}</text>`; });
    return svg + '</svg>';
  }

  function breakdown(d) {
    if (isPreview) {
      // Preview: split fake revenue proportionally by number of accounts per marketplace.
      const byMk = {}; accounts.forEach(a => { byMk[a.marketplace] = (byMk[a.marketplace] || 0) + 1; });
      const mks = Object.keys(byMk), gT = (d.gross || []).reduce((x, y) => x + y, 0), totalAcc = accounts.length || 1;
      return mks.map(mk => { const share = byMk[mk] / totalAcc, rev = Math.round(gT * share), pct = Math.round(share * 100);
        return `<div class="an-bk"><span class="an-bk-name">${esc(marketplace(mk)?.name || mk)}</span><div class="an-bk-bar"><div style="width:${pct}%"></div></div><span class="an-bk-val">${money(rev)} · ${pct}%</span></div>`;
      }).join('') || '<p class="an-empty">Connect a marketplace to see revenue split.</p>';
    }
    // Real mode: list connected marketplaces without fabricated revenue numbers.
    const mks = [...new Set(accounts.map(a => a.marketplace))];
    if (!mks.length) return '<p class="an-empty">Connect a marketplace to see revenue split.</p>';
    return mks.map(mk => `<div class="an-bk"><span class="an-bk-name">${esc(marketplace(mk)?.name || mk)}</span><div class="an-bk-bar"><div style="width:100%"></div></div><span class="an-bk-val" style="color:#d4d4d4">Connected</span></div>`).join('');
  }

  function topProducts() {
    return [...invItems].map(it => ({ ...it, rev: (it.price || 0) * (it.qty || 0) })).sort((a, b) => b.rev - a.rev).slice(0, 5)
      .map(it => { const mgn = it.price && it.cost ? Math.round((it.price - it.cost) / it.price * 100) : 0;
        return `<div class="an-prod"><span class="an-prod-name" title="${esc(it.title)}">${esc(it.title)}</span><span class="an-prod-mk">${esc(marketplace(it.marketplace)?.name || it.marketplace)}</span><span class="an-prod-rev">${money(it.rev)}</span><span class="an-prod-mgn ${mgn >= 25 ? 'good' : ''}">${mgn}%</span></div>`;
      }).join('') || '<p class="an-empty">Run an inventory sync to see top products.</p>';
  }

  function bodyHtml() {
    const d = isPreview ? gen() : realSeries();
    const hasData = d.gross && d.gross.length > 0;

    // Real account with no sales data yet — show honest empty state.
    if (!isPreview && !hasData) {
      return `
        <div class="an-kpis">
          <div class="an-kpi"><span>Gross</span><b>—</b><i>No data yet</i></div>
          <div class="an-kpi"><span>Net</span><b>—</b><i>—</i></div>
          <div class="an-kpi"><span>Orders</span><b>—</b><i>—</i></div>
          <div class="an-kpi"><span>Avg order</span><b>—</b><i>AOV</i></div>
          <div class="an-kpi"><span>In stock</span><b>${(inventorySummary?.total || 0).toLocaleString()}</b><i>${inventorySummary?.outOfStock || 0} out of stock</i></div>
        </div>
        <div class="an-chart-wrap">
          <div class="an-chart" style="display:flex;align-items:center;justify-content:center;height:200px;color:rgba(255,255,255,0.4);font-size:13px;flex-direction:column;gap:8px">
            <span style="font-size:28px;opacity:.3">📊</span>
            <span>Run a Quick Sync to populate real analytics</span>
          </div>
        </div>
        <div class="an-cols">
          <div class="an-panel"><h4>Revenue by marketplace</h4>${breakdown(d)}</div>
          <div class="an-panel"><h4>Top products</h4><div class="an-prod-head"><span>Product</span><span>Market</span><span>Revenue</span><span>Margin</span></div>${topProducts()}</div>
        </div>`;
    }

    const k = kpis(d);
    const toggles = METRICS.map(m => `<button class="an-tog ${enabled[m.k] ? 'on' : ''}" data-metric="${m.k}" style="--c:${m.c}"><span class="an-tog-dot"></span>${m.name}</button>`).join('');
    // Period buttons only meaningful in preview (real data is fetched at a fixed window).
    const periods = isPreview ? ['7d', '30d', '8w'].map(p => `<button class="an-period ${period === p ? 'on' : ''}" data-anperiod="${p}">${p === '8w' ? '8 weeks' : p}</button>`).join('') : '';
    return `
      <div class="an-kpis">
        <div class="an-kpi"><span>Gross</span><b>${money(k.gT)}</b><i class="${k.wow >= 0 ? 'up' : 'down'}">${k.wow >= 0 ? '+' : ''}${k.wow}% vs prior</i></div>
        <div class="an-kpi"><span>Net</span><b>${money(k.nT)}</b><i>${k.margin}% margin</i></div>
        <div class="an-kpi"><span>Orders</span><b>${k.oT > 0 ? k.oT.toLocaleString() : '—'}</b>${isPreview ? `<i>${k.uT.toLocaleString()} units</i>` : ''}</div>
        <div class="an-kpi"><span>Avg order</span><b>${k.aov > 0 ? money(k.aov) : '—'}</b><i>AOV</i></div>
        <div class="an-kpi"><span>In stock</span><b>${(inventorySummary?.total || 0).toLocaleString()}</b><i>${inventorySummary?.outOfStock || 0} out of stock</i></div>
        ${isPreview ? `<div class="an-kpi"><span>Sell-through</span><b>${Math.max(20, Math.min(99, 40 + (k.wow || 0)))}%</b><i>30-day</i></div>` : ''}
      </div>
      <div class="an-chart-wrap">
        <div class="an-chart-top"><div class="an-togs">${toggles}</div><div class="an-periods">${periods}</div></div>
        <div class="an-chart">${chart(d)}</div>
      </div>
      <div class="an-cols">
        <div class="an-panel"><h4>Revenue by marketplace</h4>${breakdown(d)}</div>
        <div class="an-panel"><h4>Top products</h4><div class="an-prod-head"><span>Product</span><span>Market</span><span>Revenue</span><span>Margin</span></div>${topProducts()}</div>
      </div>`;
  }
  const host = document.createElement('div');
  host.className = 'modal-bg an-bg';
  host.innerHTML = `<div class="an-modal" role="dialog" aria-modal="true" aria-label="Analytics dashboard">
    <div class="an-head">
      <div><span class="mc-kicker">Analytics</span><h2>Revenue &amp; operations</h2></div>
      <div class="an-head-right">${previewMode() ? '<span class="hb-pill neutral">Sample data</span>' : ''}<button class="an-close" id="anClose" aria-label="Close">${icon('x')}</button></div>
    </div>
    <div class="an-body">${bodyHtml()}</div>`;
  document.body.appendChild(host);
  const close = () => { host.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  host.onclick = (e) => { if (e.target === host) close(); };
  function wire() {
    host.querySelectorAll('[data-metric]').forEach(b => b.onclick = () => { enabled[b.dataset.metric] = !enabled[b.dataset.metric]; if (!Object.values(enabled).some(Boolean)) enabled[b.dataset.metric] = true; redraw(); });
    host.querySelectorAll('[data-anperiod]').forEach(b => b.onclick = () => { period = b.dataset.anperiod; redraw(); });
  }
  function redraw() { host.querySelector('.an-body').innerHTML = bodyHtml(); wire(); }
  host.querySelector('#anClose').onclick = close;
  wire();
  playSfx('nav');
}

// Job detail drawer — a slide-in pane showing one workflow's live execution
// path, progress, assignment, timing and event log. Opened from the Operations
// Queue and the Jobs page. Read-only here; run controls live on the Jobs page.
function openJobDrawer(jobId) {
  const j = jobs.find(x => String(x.id) === String(jobId));
  if (!j) return;
  // Only ever one drawer at a time — drop any that's still animating out.
  document.querySelectorAll('.jd-bg').forEach(el => el.remove());

  // Map the job's status to a position on the standard 5-stage workflow path.
  const STAGES = [
    { label: 'Research', icon: 'crosshair' }, { label: 'Validate', icon: 'shield' },
    { label: 'Optimize', icon: 'bot' }, { label: 'List', icon: 'tag' }, { label: 'Track', icon: 'truck' },
  ];
  const isRunning = j.status === 'running' || j.status === 'accepted';
  const isFailed = j.status === 'error';
  const isDone = j.status === 'complete';
  const pct = isDone ? 100 : isRunning ? 62 : isFailed ? 100 : 8;
  const activeStage = isDone ? STAGES.length : Math.min(STAGES.length - 1, Math.floor(pct / 20));
  const category = isRunning ? 'active' : (j.status === 'queued' || j.status === 'dispatched') ? 'queued' : isFailed ? 'failed' : isDone ? 'completed' : 'queued';
  const marketName = j.marketplace ? (marketplace(j.marketplace)?.name || j.marketplace) : 'All marketplaces';

  // Build the connected stage path (done → active/failed → waiting).
  let pathHtml = '';
  STAGES.forEach((stage, i) => {
    if (i > 0) pathHtml += `<span class="cc2-link ${i <= activeStage ? 'lit' : ''}"></span>`;
    let state = 'waiting';
    if (i < activeStage) state = 'done';
    else if (i === activeStage) state = isFailed ? 'failed' : isDone ? 'done' : 'active';
    pathHtml += `<div class="cc2-stage ${state}"><span class="cc2-stage-ic">${icon(stage.icon)}</span><span class="cc2-stage-l">${stage.label}</span></div>`;
  });

  // Event log — fall back to the job's last message if no log was recorded.
  const events = (j.log && j.log.length) ? j.log : [{ text: j.message || j.status }];
  const logHtml = events.map(e => `<div class="jd-log"><span class="jd-log-dot ${category}"></span><span>${esc(e.text || String(e))}</span></div>`).join('');

  const retryBtn = isFailed
    ? `<button class="mc-btn mc-btn--secondary" id="jdRetry">${icon('refresh')} Retry on Jobs</button>`
    : '';

  const host = document.createElement('div');
  host.className = 'modal-bg jd-bg';
  host.innerHTML = `<aside class="jd-drawer" role="dialog" aria-modal="true" aria-label="Job detail">
    <div class="jd-head">
      <div><span class="mc-kicker">${esc(category)} job</span><h2>${esc(j.scriptLabel || j.script)}</h2></div>
      <button class="an-close" id="jdClose" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="jd-body">
      <div class="jd-meta">
        <div class="jd-meta-row"><span>Status</span><b class="jd-status ${category}">${esc(j.status)}</b></div>
        <div class="jd-meta-row"><span>Marketplace</span><b>${esc(marketName)}</b></div>
        <div class="jd-meta-row"><span>Node</span><b>${esc(j.deviceName || 'This PC')}</b></div>
        <div class="jd-meta-row"><span>Started</span><b>${timeAgo(j.createdAt)}</b></div>
        <div class="jd-meta-row"><span>Updated</span><b>${timeAgo(j.updatedAt || j.createdAt)}</b></div>
      </div>
      <div class="jd-section-l">Execution path</div>
      <div class="cc2-path jd-path">${pathHtml}</div>
      <div class="cc2-acs-bar"><span class="cc2-acs-bar-fill ${isFailed ? 'err' : isRunning ? 'live' : ''}" style="width:${pct}%"></span></div>
      <div class="jd-note ${isDone ? 'done' : ''}">${pct}% · ${esc(j.message || j.status)}</div>
      <div class="jd-section-l">Event log</div>
      <div class="jd-logs">${logHtml}</div>
      <div class="jd-actions">
        <button class="mc-btn mc-btn--primary" id="jdWorkspace">${icon('rocket')} Open Workspace</button>
        ${retryBtn}
      </div>
    </div>
  </aside>`;
  document.body.appendChild(host);
  requestAnimationFrame(() => host.classList.add('open'));

  const close = () => { host.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => host.remove(), 220); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  host.onclick = (e) => { if (e.target === host) close(); };
  host.querySelector('#jdClose').onclick = close;
  const goWorkspace = () => { close(); activeTab = 'workspace'; renderShell(); };
  host.querySelector('#jdWorkspace').onclick = goWorkspace;
  const retry = host.querySelector('#jdRetry');
  if (retry) retry.onclick = () => { close(); activeTab = 'jobs'; selectedJobId = j.id; renderShell(); };
  playSfx('nav');
}

// Product detail drawer — full pricing, stock, source and a plain-English
// health read for one inventory item. Opened from the Inventory table.
function openInventoryItem(id) {
  const it = invItems.find(x => String(x.id) === String(id));
  if (!it) return;
  document.querySelectorAll('.jd-bg').forEach(el => el.remove());

  const market = marketplace(it.marketplace);
  const logo = marketplaceLogo(it.marketplace) || `<span style="font:800 22px var(--nav-font);color:rgba(255,255,255,0.55)">${(market?.name || '?')[0]}</span>`;
  const money = v => v != null ? (typeof fmt$ === 'function' ? fmt$(v) : `$${(+v).toFixed(2)}`) : '—';

  // Profitability — only when we have both price and cost.
  const profit = (it.price != null && it.cost != null) ? it.price - it.cost : null;
  const marginPct = (profit != null && it.price) ? Math.round(profit / it.price * 100) : null;
  const roiPct = (profit != null && it.cost) ? Math.round(profit / it.cost * 100) : null;

  // Stock state + a one-line plain-English assessment a seller can act on.
  const stockLabel = !it.inStock ? 'Out of stock' : (it.qty > 0 && it.qty <= 3 ? `Low stock · ${it.qty} left` : `In stock · ${it.qty} units`);
  const stockClass = !it.inStock ? 'bad' : (it.qty > 0 && it.qty <= 3 ? 'warn' : 'ok');
  const health = !it.inStock
    ? 'Out of stock — restock the source to keep this listing live and ranking.'
    : (it.qty <= 3)
      ? 'Running low — only a few units left. Restock soon to avoid an out-of-stock gap.'
      : (marginPct != null && marginPct < 15)
        ? 'Thin margin — review your price or find a cheaper source to improve profit.'
        : 'Healthy — solid margin and comfortable stock. No action needed.';

  const host = document.createElement('div');
  host.className = 'modal-bg jd-bg';
  host.innerHTML = `<aside class="jd-drawer" role="dialog" aria-modal="true" aria-label="Product detail">
    <div class="jd-head">
      <div><span class="mc-kicker">Product</span><h2>${esc(it.title || it.sku || 'Item')}</h2></div>
      <button class="an-close" id="jdClose" aria-label="Close">${icon('x')}</button>
    </div>
    <div class="jd-body">
      <div class="iv-hero">
        <div class="iv-thumb">${logo}</div>
        <div class="iv-hero-meta">
          <span class="iv-badge ${stockClass}">${esc(stockLabel)}</span>
          <div class="iv-hero-mk">${esc(market?.name || it.marketplace)}</div>
          ${it.sku ? `<div class="iv-hero-sku">SKU ${esc(it.sku)}</div>` : ''}
        </div>
      </div>
      <div class="jd-section-l">Profitability</div>
      <div class="iv-prices">
        <div class="iv-price"><span>Sell price</span><b>${money(it.price)}</b></div>
        <div class="iv-price"><span>Source cost</span><b>${money(it.cost)}</b></div>
        <div class="iv-price"><span>Profit</span><b class="${profit != null ? (profit >= 0 ? 'pos' : 'neg') : ''}">${profit != null ? money(profit) : '—'}</b></div>
        <div class="iv-price"><span>Margin</span><b>${marginPct != null ? marginPct + '%' : '—'}</b></div>
        <div class="iv-price"><span>ROI</span><b>${roiPct != null ? roiPct + '%' : '—'}</b></div>
        <div class="iv-price"><span>On hand</span><b>${it.inStock ? (it.qty || 0) : 0}</b></div>
      </div>
      <div class="jd-section-l">Status</div>
      <div class="iv-health ${stockClass}">${esc(health)}</div>
      <div class="jd-section-l">Source</div>
      <div class="iv-source">
        ${it.asin ? `<span class="iv-asin">${esc(it.asin)}</span>` : '<span class="iv-asin muted">No source linked</span>'}
        ${it.sourceUrl ? `<a class="mc-btn mc-btn--secondary mc-btn--sm" href="${esc(it.sourceUrl)}" target="_blank" rel="noopener">View source ↗</a>` : ''}
      </div>
      <div class="jd-actions" style="margin-top:18px">
        <button class="mc-btn mc-btn--primary" id="ivSync">${icon('refresh')} Sync this listing</button>
      </div>
    </div>
  </aside>`;
  document.body.appendChild(host);
  requestAnimationFrame(() => host.classList.add('open'));

  const close = () => { host.classList.remove('open'); document.removeEventListener('keydown', onKey); setTimeout(() => host.remove(), 220); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  host.onclick = (e) => { if (e.target === host) close(); };
  host.querySelector('#jdClose').onclick = close;
  host.querySelector('#ivSync').onclick = () => { close(); activeTab = 'workspace'; renderShell(); };
  playSfx('nav');
}

function renderHome() {
  $('#topSub').textContent = '';
  const content = $('#content');

  // Tracking balance is otherwise only fetched on the Tracking tab — lazy-load it
  // once on Home so the Tracking card shows live credits/claims (skeleton until then).
  if (trackingBalance === null && !homeTrackingLoading) {
    homeTrackingLoading = true;
    getTrackingBalance()
      .then(b => { trackingBalance = b || { credits: 0, configured: false, claims: [] }; if (activeTab === 'home') renderHome(); })
      .catch(() => { trackingBalance = { credits: 0, configured: false, claims: [] }; if (activeTab === 'home') renderHome(); });
  }

  // ── AXIS / Audit ──────────────────────────────────────────────────────────
  const audit = runAudit(buildAuditInput());
  const axisState  = audit.findings.length === 0 ? 'ok' : audit.findings.length >= 3 ? 'critical' : 'warn';
  const healthScore = axisState === 'ok' ? 94 : Math.max(38, 94 - audit.findings.length * 18);
  const pillClass  = axisState === 'ok' ? 'ok' : axisState === 'critical' ? 'critical' : 'warn';
  const pillLabel  = axisState === 'ok' ? 'All clear' : axisState === 'critical' ? 'Action needed' : 'Review';
  const topFinding = audit.findings[0] || null;
  const auditAlerts = axisState === 'ok'
    ? [{ cls: 'hb-a-ok', ico: '✓', text: 'No account stacking risks detected' },
       { cls: 'hb-a-ok', ico: '✓', text: 'IP rotation within safe thresholds' }]
    : audit.findings.slice(0, 3).map(f => ({ cls: f.level === 'critical' ? 'hb-a-err' : 'hb-a-warn', ico: f.level === 'critical' ? '!' : '⚠', text: f.title }));
  const auditRows = auditAlerts.map(r => `<div class="hb-alert-row ${r.cls}"><span class="hb-alert-ico">${r.ico}</span>${esc(r.text)}</div>`).join('');

  // ── Jobs ──────────────────────────────────────────────────────────────────
  const lastJob     = jobs[0] || null;
  const runningJobs = jobs.filter(j => j.status === 'running' || j.status === 'accepted');
  const doneJobs    = jobs.filter(j => j.status === 'complete');
  const errJobs     = jobs.filter(j => j.status === 'error');
  const queuedJobs  = jobs.filter(j => j.status === 'queued' || j.status === 'dispatched');
  const jobPct      = lastJob ? (lastJob.status === 'complete' ? 100 : (lastJob.status === 'running' || lastJob.status === 'accepted') ? 62 : lastJob.status === 'error' ? 100 : 8) : 0;
  const jobBarStyle = lastJob?.status === 'error' ? 'background:rgba(239,68,68,0.65)' : '';
  const jobMsg      = lastJob?.log?.slice(-1)[0]?.text || lastJob?.message || '';

  // ── Fleet ─────────────────────────────────────────────────────────────────
  const previewLive  = previewMode();
  const nodeOnline   = ext.installed || previewLive;
  const onlineFromNodes = cloudNodes.filter(n => n.status === 'online').length;
  const totalNodes   = Math.max(cloudNodes.length, nodeOnline ? 1 : 0);
  const onlineNodes  = previewLive ? onlineFromNodes : (nodeOnline ? Math.max(1, onlineFromNodes) : 0);
  const offlineNodes = Math.max(0, totalNodes - onlineNodes);
  const fleetHealth  = totalNodes > 0 ? Math.round((onlineNodes / totalNodes) * 100) : 0;

  // ── Inventory ─────────────────────────────────────────────────────────────
  const invSum     = inventorySummary || {};
  const totalItems = invSum.total || Object.values(invSum.inStockByMarketplace || {}).reduce((a, b) => a + b, 0);
  const inStockCnt = Object.values(invSum.inStockByMarketplace || {}).reduce((a, b) => a + b, 0);
  const oosCnt     = invSum.outOfStock || 0;
  const oosPercent = inStockCnt + oosCnt > 0 ? Math.round(oosCnt / (inStockCnt + oosCnt) * 100) : 0;
  const lastSync   = accounts.length > 0 && accounts[0].lastSync ? timeAgo(accounts[0].lastSync) : (accounts.length > 0 ? 'not synced' : '—');
  const invMkRows  = accounts.slice(0, 3).map(a => {
    const mk = marketplace(a.marketplace);
    const logo = marketplaceLogo(a.marketplace);
    const stock = (invSum.inStockByMarketplace || {})[a.marketplace] || 0;
    const pct = totalItems > 0 ? Math.round(stock / totalItems * 100) : 0;
    const logoEl = logo ? logo : `<span style="font:800 12px var(--nav-font);color:#e5e5e5">${(mk?.name || '?')[0]}</span>`;
    return `<div class="hb-bk-row"><span style="width:22px;display:flex;align-items:center;justify-content:center">${logoEl}</span><span style="font-size:11px;color:rgba(255,255,255,0.45);min-width:52px">${esc(mk?.name || a.marketplace)}</span><div class="hb-bk-bar-wrap"><div class="hb-bk-bar" style="width:${pct}%"></div></div><span class="hb-bk-num">${stock || '—'}</span></div>`;
  }).join('');

  // ── Analytics ─────────────────────────────────────────────────────────────
  const s         = salesSeries();
  const sparkSvg  = renderSparkline(s);
  const fmtAmt    = v => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`;
  const marginPct = s.grossTotal > 0 ? Math.round((s.netTotal / s.grossTotal) * 100) : 0;
  let wowStr = '';
  if (s.gross && s.gross.length >= 4) {
    const half = Math.floor(s.gross.length / 2);
    const oldV = s.gross.slice(0, half).reduce((a, b) => a + b, 0);
    const newV = s.gross.slice(half).reduce((a, b) => a + b, 0);
    const pctChange = oldV > 0 ? Math.round(((newV - oldV) / oldV) * 100) : 0;
    wowStr = pctChange >= 0 ? `+${pctChange}% vs prior period` : `${pctChange}% vs prior period`;
  }
  const revSources = connectedMarketplaces();
  const srcPct = revSources.length > 0 ? Math.round(100 / revSources.length) : 0;

  // ── Tracking ──────────────────────────────────────────────────────────────
  const trackCred    = trackingBalance?.credits ?? 0;
  const trackConf    = trackingBalance?.configured ?? false;
  const claims       = trackingBalance?.claims || [];
  const pendingCnt   = claims.filter(c => !c.status || c.status === 'pending').length;
  const syncedCnt    = claims.filter(c => c.status === 'synced').length;
  const exceptCnt    = claims.filter(c => c.status === 'exception').length;
  const deliveredCnt = claims.filter(c => c.status === 'delivered').length;
  const recentClaims = claims.slice(0, 3);
  const carrierMap   = {};
  claims.forEach(c => { if (c.carrier) carrierMap[c.carrier] = (carrierMap[c.carrier] || 0) + 1; });
  const topCarriers  = Object.entries(carrierMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const maxCarrier   = topCarriers[0]?.[1] || 1;
  const carrierRows  = topCarriers.map(([name, n]) =>
    `<div class="hb-bk-row"><span style="font-size:11px;color:rgba(255,255,255,0.35);min-width:55px">${esc(name)}</span><div class="hb-bk-bar-wrap"><div class="hb-bk-bar" style="width:${Math.round(n / maxCarrier * 100)}%"></div></div><span class="hb-bk-num">${n}</span></div>`
  ).join('');
  const mapDots = [
    { t: 42, l: 22 }, { t: 38, l: 48 }, { t: 55, l: 62 },
    { t: 30, l: 70 }, { t: 45, l: 80 }, { t: 28, l: 35 },
  ].map((d, i) => `<span class="hb-map-dot ${i < recentClaims.length + 1 ? 'on' : ''}" style="top:${d.t}%;left:${d.l}%"></span>`).join('');

  // ── Derived presentation state (redesigned command center) ────────────────
  const CHROME_STORE_URL = 'https://chromewebstore.google.com/detail/mgapfpdkkihbeehfkgoajhealmgpnglo';

  // Per-card loading flags — null means "not fetched yet" → show a skeleton.
  const invLoading       = inventorySummary === null;
  const analyticsLoading = salesData === null && !previewMode();
  const trackingLoading  = trackingBalance === null;
  const skel = (n, cls = '') => Array.from({ length: n }).map(() => `<div class="cc-skel ${cls}"></div>`).join('');

  // Jobs — 4-stage workflow progression with the live step highlighted.
  const jobSteps = ['Research', 'Validate', 'Prepare', 'Publish'];
  const jobActiveStep = !lastJob ? -1 : lastJob.status === 'complete' ? 4 : Math.min(3, Math.max(0, Math.floor(jobPct / 25)));
  const jobStepsHtml = jobSteps.map((st, i) => {
    const done = i < jobActiveStep;
    const active = i === jobActiveStep && lastJob && lastJob.status !== 'complete' && lastJob.status !== 'error';
    return `<div class="cc-step ${done ? 'done' : ''} ${active ? 'active' : ''}"><span class="cc-step-dot"></span><span class="cc-step-lbl">${st}</span></div>`;
  }).join('<span class="cc-step-link"></span>');

  // Fleet — compact node chips + root/heartbeat line.
  const rootNodeName = 'root-main';
  const heartbeat = nodeOnline ? 'just now' : '—';
  const fleetChips = [];
  if (nodeOnline) fleetChips.push({ name: 'This PC', on: true, root: true });
  cloudNodes.slice(0, 5).forEach(n => fleetChips.push({ name: n.name || 'node', on: n.status === 'online' }));
  const fleetChipsHtml = (fleetChips.length ? fleetChips : [{ name: 'No nodes', on: false }]).map(c =>
    `<span class="cc-node-chip ${c.on ? 'on' : 'off'} ${c.root ? 'root' : ''}"><span class="cc-node-dot"></span>${esc(c.name)}</span>`
  ).join('');

  // AXIS — a single actionable recommendation derived from the top finding.
  const axisRec = topFinding
    ? (topFinding.upgradeTo
        ? `Upgrade to ${PLAN_LABEL[topFinding.upgradeTo] || topFinding.upgradeTo} to clear this automatically.`
        : 'Open AXIS to review and isolate the affected account.')
    : 'All accounts are within safe limits. AXIS keeps monitoring continuously.';

  // ── Activity timeline ─────────────────────────────────────────────────────
  const actEvents = [];
  jobs.slice(0, 6).forEach(j => {
    const scr = esc(j.scriptLabel || j.script);
    const mk  = j.marketplace ? (marketplace(j.marketplace)?.name || j.marketplace) : '';
    const ago = timeAgo(j.updatedAt || j.createdAt);
    if      (j.status === 'complete') actEvents.push({ cat: 'jobs', ico: 'done', tag: 'done', event: `${scr} completed`, sub: mk || 'completed', ago });
    else if (j.status === 'error')    actEvents.push({ cat: 'jobs', ico: 'err',  tag: 'err',  event: `${scr} failed`, sub: esc(j.message?.slice(0, 60) || 'error'), ago });
    else if (j.status === 'running' || j.status === 'accepted') actEvents.push({ cat: 'jobs', ico: 'ok', tag: 'run', event: `${scr} in progress`, sub: esc(j.message?.slice(0, 60) || 'running'), ago });
    else actEvents.push({ cat: 'jobs', ico: 'info', tag: 'run', event: `${scr} queued`, sub: mk || 'waiting to start', ago });
  });
  accounts.slice(0, 2).forEach(a => {
    const mkName = marketplace(a.marketplace)?.name || a.marketplace;
    actEvents.push({ cat: 'accounts', ico: 'ok', tag: 'done', event: `${mkName} account connected`, sub: esc(a.label || a.email || ''), ago: '' });
  });
  if (nodeOnline) actEvents.push({ cat: 'nodes', ico: 'ok', tag: 'run', event: 'This PC online', sub: 'Syndrax extension connected — ready to run jobs', ago: '' });
  const actRows = actEvents.slice(0, 8).map(e =>
    `<div class="cc-tl-row" data-cat="${e.cat}" data-go="jobs">
       <span class="cc-tl-rail"><span class="cc-tl-node ${e.ico}"></span></span>
       <span class="ha-ico ${e.ico}">${e.ico === 'done' ? '✓' : e.ico === 'err' ? '✕' : e.ico === 'warn' ? '⚠' : '◉'}</span>
       <div class="ha-body"><div class="ha-event">${e.event}</div><div class="ha-sub">${e.sub}</div></div>
       <span class="ha-tag ${e.tag}">${e.tag === 'done' ? 'DONE' : e.tag === 'err' ? 'ERROR' : 'ACTIVE'}</span>
       ${e.ago ? `<span class="ha-time">${e.ago}</span>` : ''}
       <span class="cc-tl-chev">›</span>
     </div>`
  ).join('');
  const cats = [...new Set(actEvents.map(e => e.cat))];
  const filterDefs = [{ k: 'all', l: 'All' }, { k: 'jobs', l: 'Jobs' }, { k: 'accounts', l: 'Accounts' }, { k: 'nodes', l: 'Nodes' }]
    .filter(f => f.k === 'all' || cats.includes(f.k));
  const filtersHtml = filterDefs.length > 2
    ? `<div class="cc-tl-filters">${filterDefs.map((f, i) => `<button class="cc-tl-filter ${i === 0 ? 'on' : ''}" data-filter="${f.k}">${f.l}</button>`).join('')}</div>`
    : '';

  // Rail KPI cells (live operational rail across the top).
  const scoreColor = axisState === 'ok' ? '#34d399' : axisState === 'critical' ? '#f87171' : '#fbbf24';
  const railCells = [
    { go: 'audit',     ic: 'shield',  tone: axisState === 'ok' ? 'green' : axisState === 'critical' ? 'red' : 'amber', val: healthScore, lbl: 'AXIS score', color: scoreColor },
    { go: 'jobs',      ic: 'rocket',  tone: 'cyan',  val: runningJobs.length, lbl: 'Active jobs' },
    { go: 'devices',   ic: 'monitor', tone: nodeOnline ? 'green' : 'red', val: `${onlineNodes}/${totalNodes}`, lbl: 'Devices online' },
    { go: 'inventory', ic: 'package', tone: 'teal',  val: invLoading ? '…' : (totalItems > 0 ? totalItems.toLocaleString() : '0'), lbl: 'SKUs synced' },
    { analytics: true, ic: 'chart',   tone: 'violet', val: s.empty ? '—' : fmtAmt(s.grossTotal), lbl: `Gross${s.sample ? ' · preview' : ''}` },
    { go: 'tracking',  ic: 'truck',   tone: 'amber', val: trackingLoading ? '…' : trackCred, lbl: 'Track credits' },
  ];
  const railHtml = railCells.map(c =>
    `<button class="mc-rail-cell" ${c.analytics ? 'data-analytics' : `data-go="${c.go}"`}>
       <span class="mc-rail-ic ${c.tone}">${icon(c.ic)}</span>
       <span class="mc-rail-meta"><span class="mc-rail-val"${c.color ? ` style="color:${c.color}"` : ''}>${c.val}</span><span class="mc-rail-lbl">${c.lbl}</span></span>
     </button>`
  ).join('<span class="mc-rail-div"></span>');

  // Quick-action launcher items (all map to existing destinations/actions).
  const fabItems = [
    { go: 'workspace', ic: 'rocket',  tone: 'cyan',   t: 'Run a script' },
    { action: 'sync',  ic: 'refresh', tone: 'teal',   t: 'Sync inventory' },
    { go: 'tracking',  ic: 'truck',   tone: 'amber',  t: 'Add tracking' },
    { go: 'accounts',  ic: 'plus',    tone: 'violet', t: 'Connect account' },
    { go: 'audit',     ic: 'shield',  tone: 'green',  t: 'Review AXIS' },
  ];
  const fabHtml = fabItems.map(f =>
    `<button class="mc-fab-item" ${f.go ? `data-go="${f.go}"` : `data-action="${f.action}"`}><span class="mc-fab-ic ${f.tone}">${icon(f.ic)}</span>${f.t}</button>`
  ).join('');

  // ── Automation Control Surface — live execution path of the active workflow ─
  const PATH = [
    { l: 'Research', ic: 'crosshair' }, { l: 'Validate', ic: 'shield' },
    { l: 'Optimize', ic: 'bot' }, { l: 'List', ic: 'tag' }, { l: 'Track', ic: 'truck' },
  ];
  const acsActive = !lastJob ? -1 : lastJob.status === 'complete' ? PATH.length : Math.min(PATH.length - 1, Math.floor(jobPct / 20));
  const acsFailed = !!(lastJob && lastJob.status === 'error');
  let pathHtml = '';
  PATH.forEach((st, i) => {
    if (i > 0) pathHtml += `<span class="cc2-link ${lastJob && i <= acsActive ? 'lit' : ''}"></span>`;
    let stt = 'waiting';
    if (lastJob) { if (i < acsActive) stt = 'done'; else if (i === acsActive) stt = acsFailed ? 'failed' : 'active'; }
    pathHtml += `<div class="cc2-stage ${stt}"><span class="cc2-stage-ic">${icon(st.ic)}</span><span class="cc2-stage-l">${st.l}</span><span class="cc2-stage-s">${stt === 'done' ? 'Done' : stt === 'active' ? 'Running' : stt === 'failed' ? 'Failed' : 'Waiting'}</span></div>`;
  });

  // ── Operations queue (categorised from real jobs) ──────────────────────────
  const catOf = (st) => (st === 'running' || st === 'accepted') ? 'active' : (st === 'queued' || st === 'dispatched') ? 'queued' : st === 'error' ? 'failed' : st === 'complete' ? 'completed' : 'queued';
  const qpct = (st) => st === 'complete' ? 100 : (st === 'running' || st === 'accepted') ? 62 : st === 'error' ? 100 : 8;
  const queueJobs = jobs.slice(0, 14);
  const qCats = [...new Set(queueJobs.map(j => catOf(j.status)))];
  const qFilterDefs = [{ k: 'all', l: 'All' }, { k: 'active', l: 'Active' }, { k: 'queued', l: 'Queued' }, { k: 'failed', l: 'Failed' }, { k: 'completed', l: 'Completed' }].filter(f => f.k === 'all' || qCats.includes(f.k));
  const qFiltersHtml = qFilterDefs.map((f, i) => `<button class="cc2-qfilter ${i === 0 ? 'on' : ''}" data-qfilter="${f.k}">${f.l}</button>`).join('');
  const queueRowsHtml = queueJobs.map(j => {
    const cat = catOf(j.status); const pct = qpct(j.status);
    const mk = j.marketplace ? (marketplace(j.marketplace)?.name || j.marketplace) : '—';
    const barCls = cat === 'failed' ? 'err' : cat === 'completed' ? 'done' : (cat === 'active' ? 'live' : '');
    return `<div class="cc2-qrow" data-qcat="${cat}" data-jobid="${esc(String(j.id))}">
      <span class="cc2-qcell cc2-qname"><span class="cc2-qstatus ${cat}"></span>${esc(j.scriptLabel || j.script)}</span>
      <span class="cc2-qcell cc2-qmk">${esc(mk)}</span>
      <span class="cc2-qcell cc2-qnode">${esc(j.deviceName || 'This PC')}</span>
      <span class="cc2-qcell"><span class="cc2-qbadge ${cat}">${cat}</span></span>
      <span class="cc2-qcell cc2-qprog"><span class="cc2-qprog-fill ${barCls}" style="width:${pct}%"></span></span>
      <span class="cc2-qcell cc2-qtime">${timeAgo(j.updatedAt || j.createdAt)}</span>
      <span class="cc2-qcell cc2-qchev">›</span>
    </div>`;
  }).join('');

  content.innerHTML = `<div class="page mc-home cc2" data-axis="${axisState}">

    <!-- TOP OPERATIONAL RAIL -->
    <div class="mc-rail">${railHtml}</div>

    <!-- HERO — Automation Control Surface (primary) + compact AXIS assistant -->
    <div class="cc2-top">

      <section class="cc2-acs">
        <div class="cc2-acs-head">
          <div class="cc2-acs-id"><span class="mc-kicker">Live automation</span><h2 class="cc2-acs-title">Automation Control Surface</h2></div>
          ${lastJob ? `<span class="cc2-acs-state ${catOf(lastJob.status)}"><span class="cc2-qstatus ${catOf(lastJob.status)}"></span>${lastJob.status}</span>` : `<span class="hb-pill neutral">Idle</span>`}
        </div>
        ${lastJob ? `
          <div class="cc2-acs-meta">
            <span class="cc2-acs-wf">${esc(lastJob.scriptLabel || lastJob.script)}</span>
            <span class="cc2-acs-d"></span><span>${lastJob.marketplace ? esc(marketplace(lastJob.marketplace)?.name || lastJob.marketplace) : 'All marketplaces'}</span>
            <span class="cc2-acs-d"></span><span>${esc(lastJob.deviceName || 'This PC')}</span>
          </div>
          <div class="cc2-path">${pathHtml}</div>
          <div class="cc2-acs-metrics">
            <div class="cc2-m"><b>${jobPct}%</b><span>Completion</span></div>
            <div class="cc2-m"><b class="c-green">${doneJobs.length}</b><span>Completed</span></div>
            <div class="cc2-m"><b class="c-cyan">${runningJobs.length}</b><span>Running</span></div>
            <div class="cc2-m"><b class="c-muted">${queuedJobs.length}</b><span>In queue</span></div>
            <div class="cc2-m"><b>${timeAgo(lastJob.createdAt)}</b><span>Elapsed</span></div>
          </div>
          <div class="cc2-acs-bar"><span class="cc2-acs-bar-fill ${acsFailed ? 'err' : (lastJob.status === 'running' || lastJob.status === 'accepted') ? 'live' : ''}" style="width:${jobPct}%"></span></div>
          <div class="cc2-acs-foot">
            <div class="cc2-acs-actions">
              <button class="mc-btn mc-btn--primary" data-go="jobs">Open Workflow</button>
              <button class="mc-btn mc-btn--secondary" data-go="workspace">Configure</button>
            </div>
            <div class="cc2-acs-ctrls" role="group" aria-label="Run controls">
              <button class="cc2-ctrl" disabled title="Pause is managed from the Jobs queue">${icon('lock')}<span>Pause</span></button>
              <button class="cc2-ctrl" disabled title="Stop is managed from the Jobs queue">${icon('x')}<span>Stop</span></button>
              ${acsFailed ? `<button class="cc2-ctrl retry" data-go="jobs" title="Retry on the Jobs page">${icon('refresh')}<span>Retry</span></button>` : `<button class="cc2-ctrl" disabled title="Retry becomes available if the workflow fails">${icon('refresh')}<span>Retry</span></button>`}
            </div>
          </div>`
        : `<div class="cc2-path is-empty">${pathHtml}</div>
           <div class="cc2-acs-empty">
             <div><div class="cc2-acs-empty-t">No workflow running</div><p>Launch Sync, Research, or Lister in Workspace to start an automation — live stage progress streams here.</p></div>
             <button class="mc-btn mc-btn--primary" data-go="workspace">Launch a workflow ${icon('rocket')}</button>
           </div>`}
      </section>

      <aside class="cc2-axis" data-state="${axisState}" data-go="audit" aria-label="Open AXIS assistant">
        <div class="cc2-axis-head">
          <div class="cc2-axis-bot">${axisBotHtml(axisState)}</div>
          <div class="cc2-axis-id"><span class="mc-kicker">Assistant</span><strong>AXIS</strong></div>
          <div class="mc-score-badge sm" style="--p:${healthScore};--c:${scoreColor}"><span>${healthScore}</span></div>
        </div>
        <span class="mc-state-pill ${axisState}" style="align-self:flex-start"><span class="mc-state-dot"></span>${pillLabel}</span>
        <div class="cc2-axis-msg ${axisState}">
          <div class="cc2-axis-msg-t">${topFinding ? esc(topFinding.title) : 'All systems healthy'}</div>
          <p>${esc(axisRec)}</p>
        </div>
        <div class="cc2-axis-meta"><span>${audit.findings.length} alert${audit.findings.length !== 1 ? 's' : ''}</span><span>·</span><span>${accounts.length} accounts</span><span>·</span><span>scanned just now</span></div>
        <div class="cc2-axis-checks">
          <div class="cc2-chk ok"><span class="cc2-chk-ic">${icon('shield')}</span><span>Account isolation</span><b>Pass</b></div>
          <div class="cc2-chk ok"><span class="cc2-chk-ic">${icon('wifi')}</span><span>IP rotation</span><b>Pass</b></div>
          <div class="cc2-chk ${audit.findings.length ? 'warn' : 'ok'}"><span class="cc2-chk-ic">${icon('crosshair')}</span><span>Rate limits</span><b>${audit.findings.length ? 'Review' : 'Pass'}</b></div>
        </div>
        <div class="cc2-axis-actions">
          <button class="mc-btn mc-btn--primary mc-btn--sm" data-go="audit">Review Issues</button>
          <button class="mc-btn mc-btn--secondary mc-btn--sm" id="rerunAudit">Run Audit</button>
        </div>
        <button class="mc-btn mc-btn--ghost mc-btn--sm cc2-axis-open" data-go="audit">Open AXIS ${icon('chevrons')}</button>
      </aside>
    </div>

    <!-- OPERATIONS QUEUE -->
    <section class="cc2-queue">
      <div class="cc2-queue-head">
        <div><span class="mc-kicker">Operations</span><h3 class="cc2-queue-title">Operations Queue</h3></div>
        <div class="cc2-qfilters">${qFiltersHtml}</div>
        <button class="cc-tl-all" data-go="jobs">Open Jobs →</button>
      </div>
      ${queueRowsHtml ? `<div class="cc2-qhead-row">
        <span>Workflow</span><span>Marketplace</span><span>Node</span><span>Status</span><span>Progress</span><span>Updated</span><span></span>
      </div>
      <div class="cc2-qlist">${queueRowsHtml}</div>`
      : `<div class="cc2-qempty"><span class="cc-empty-ico">${icon('rocket')}</span><div><div class="cc2-acs-empty-t">No operations yet</div><p>Launch a workflow in Workspace — active, queued, completed, and failed runs appear here with live progress.</p></div><button class="mc-btn mc-btn--primary mc-btn--sm" data-go="workspace">Open Workspace</button></div>`}
    </section>

    <!-- SUPPORTING PREVIEWS — Fleet · Inventory · Analytics · Tracking -->
    <div class="mc-strip">

      <section class="mc-seg" data-accent="cyan" data-go="devices">
        <div class="mc-seg-head"><span class="mc-seg-ic cyan">${icon('monitor')}</span><h4>Fleet</h4>
          <span class="hb-pill ${nodeOnline ? 'active' : 'critical'}">${nodeOnline ? 'Online' : 'Offline'}</span></div>
        <div class="cc-fleet-top">
          <div class="cc-fleet-big"><span class="cc-online-dot ${nodeOnline ? 'on' : ''}"></span><span class="cc-fleet-num">${onlineNodes}</span><span class="cc-fleet-sub">/ ${totalNodes} online</span></div>
          <div class="cc-fleet-health"><div class="cc-fleet-health-bar"><div style="width:${fleetHealth}%;background:${fleetHealth >= 80 ? '#34d399' : fleetHealth >= 50 ? '#fbbf24' : '#f87171'}"></div></div><span style="color:${fleetHealth >= 80 ? '#34d399' : fleetHealth >= 50 ? '#fbbf24' : '#f87171'}">${fleetHealth}%</span></div>
        </div>
        <div class="cc-nodes">${fleetChipsHtml}</div>
        <div class="mc-actions"><button class="mc-btn mc-btn--primary mc-btn--sm" data-go="devices">Open Cluster</button></div>
      </section>

      <section class="mc-seg" data-accent="teal" data-go="inventory">
        <div class="mc-seg-head"><span class="mc-seg-ic teal">${icon('package')}</span><h4>Inventory</h4>
          ${invLoading ? `<span class="hb-pill neutral">Loading…</span>` : totalItems > 0 ? `<span class="hb-pill ${oosPercent > 20 ? 'warn' : 'ok'}">${oosPercent}% OOS</span>` : `<span class="hb-pill neutral">No sync</span>`}</div>
        ${invLoading ? `<div class="cc-skel-wrap">${skel(1, 'tall')}${skel(2)}</div>` : `
          <div class="hb-stat-row cc-stat-row">
            <div class="hb-mini-stat"><div class="hb-mini-num">${totalItems > 0 ? totalItems.toLocaleString() : '—'}</div><div class="hb-mini-lbl">Total</div></div>
            <div class="hb-mini-sep"></div>
            <div class="hb-mini-stat"><div class="hb-mini-num c-green">${inStockCnt > 0 ? inStockCnt.toLocaleString() : '—'}</div><div class="hb-mini-lbl">In stock</div></div>
            <div class="hb-mini-sep"></div>
            <div class="hb-mini-stat"><div class="hb-mini-num ${oosCnt > 0 ? 'c-amber' : 'c-muted'}">${oosCnt || '—'}</div><div class="hb-mini-lbl">OOS</div></div>
          </div>
          <div class="hb-breakdown cc-break">${invMkRows || `<div class="cc-empty sm"><p>Connect an account and run Quick Sync.</p></div>`}</div>`}
        <div class="mc-actions">
          <button class="mc-btn mc-btn--primary mc-btn--sm" id="syncNowBtn">Sync Now</button>
          <button class="mc-btn mc-btn--ghost mc-btn--sm" data-go="inventory">Open ${icon('chevrons')}</button>
        </div>
      </section>

      <section class="mc-seg" data-accent="violet" data-analytics>
        <div class="mc-seg-head"><span class="mc-seg-ic violet">${icon('chart')}</span><h4>Analytics</h4>
          ${analyticsLoading ? `<span class="hb-pill neutral">Loading…</span>` : s.sample ? `<span class="hb-pill neutral">Preview</span>` : s.empty ? `<span class="hb-pill neutral">No data</span>` : `<span class="hb-pill ok">Live</span>`}</div>
        <div class="hb-period-row">
          <button class="hb-period-btn ${homePeriod === '7d' ? 'on' : ''}" data-period="7d">7d</button>
          <button class="hb-period-btn ${homePeriod === '30d' ? 'on' : ''}" data-period="30d">30d</button>
          <button class="hb-period-btn ${homePeriod === '8w' ? 'on' : ''}" data-period="8w">8 weeks</button>
        </div>
        ${analyticsLoading ? `<div class="cc-skel-wrap">${skel(1, 'chart')}</div>` : `
          <div class="hb-spark">${sparkSvg || `<div class="hb-spark-empty">Connect your marketplace to see revenue trends.</div>`}</div>
          ${!s.empty ? `<div class="hb-sales-row" style="margin:6px 0 2px">
            <div class="hb-sales-cell"><div class="hb-sales-lbl">Gross</div><div class="hb-sales-num">${fmtAmt(s.grossTotal)}</div>${wowStr ? `<div class="hb-sales-delta ${wowStr.startsWith('+') ? 'up' : ''}">${wowStr}</div>` : ''}</div>
            <div class="hb-sales-cell"><div class="hb-sales-lbl">Net</div><div class="hb-sales-num">${fmtAmt(s.netTotal)}</div><div class="hb-sales-delta">${marginPct}% margin</div></div>
            <div class="hb-sales-cell"><div class="hb-sales-lbl">Orders</div><div class="hb-sales-num">${s.orders}</div></div>
          </div>` : `<div class="cc-empty sm"><p>Sales data appears once your marketplace is synced.</p></div>`}`}
        <div class="mc-actions"><button class="mc-btn mc-btn--primary mc-btn--sm" data-analytics>View Analytics</button></div>
      </section>

      <section class="mc-seg" data-accent="amber" data-go="tracking">
        <div class="mc-seg-head"><span class="mc-seg-ic amber">${icon('truck')}</span><h4>Tracking</h4>
          ${trackingLoading ? `<span class="hb-pill neutral">Loading…</span>` : `<span class="hb-pill ${trackConf ? 'active' : 'neutral'}">${trackConf ? 'Active' : 'Setup'}</span>`}</div>
        ${trackingLoading ? `<div class="cc-skel-wrap">${skel(1, 'tall')}${skel(2)}</div>` : `
          <div class="cc-track-cred"><span class="cc-online-dot ${trackCred > 0 ? 'on' : ''}"></span><span class="cc-track-num" style="color:${trackCred > 10 ? '#d4d4d4' : trackCred > 0 ? '#fbbf24' : 'rgba(255,255,255,0.35)'}">${trackCred}</span><span class="cc-track-lbl">credits</span></div>
          <div class="hb-stat-row cc-stat-row">
            <div class="hb-mini-stat"><div class="hb-mini-num c-amber">${pendingCnt}</div><div class="hb-mini-lbl">Pending</div></div>
            <div class="hb-mini-sep"></div>
            <div class="hb-mini-stat"><div class="hb-mini-num c-cyan">${syncedCnt}</div><div class="hb-mini-lbl">Synced</div></div>
            <div class="hb-mini-sep"></div>
            <div class="hb-mini-stat"><div class="hb-mini-num c-red">${exceptCnt}</div><div class="hb-mini-lbl">Issues</div></div>
            <div class="hb-mini-sep"></div>
            <div class="hb-mini-stat"><div class="hb-mini-num c-green">${deliveredCnt}</div><div class="hb-mini-lbl">Delivered</div></div>
          </div>
          <div class="cc-track-latest">${recentClaims.length
            ? `<span class="cc-track-route"></span><span class="cc-track-ico">${icon('truck')}</span><span class="cc-track-no">${esc(recentClaims[0].trackingNumber || '—')}</span><span class="cc-track-carrier">${esc(recentClaims[0].carrier || recentClaims[0].status || 'in transit')}</span>`
            : `<span class="cc-track-ico">${icon('package')}</span><span class="cc-track-empty">No claims yet</span>`}</div>`}
        <div class="mc-actions">
          <button class="mc-btn mc-btn--primary mc-btn--sm" data-go="tracking">Open Queue</button>
          <button class="mc-btn mc-btn--ghost mc-btn--sm" data-go="tracking">Add ${icon('plus')}</button>
        </div>
      </section>
    </div>

    <!-- ACTIVITY TIMELINE -->
    <section class="cc-timeline mc-timeline">
      <div class="cc-tl-head">
        <span class="cc-tl-title">Activity Timeline</span>
        ${filtersHtml}
        <button class="cc-tl-all" data-go="jobs">See all →</button>
      </div>
      <div class="cc-tl-list">
        ${actRows || `<div class="cc-tl-empty">No activity yet — run your first sync or automation to see events here.</div>`}
      </div>
    </section>
  </div>

  <!-- FLOATING QUICK-ACTION LAUNCHER -->
  <div class="mc-fab-wrap" id="mcFabWrap">
    <div class="mc-fab-menu" id="mcFabMenu">${fabHtml}</div>
    <button class="mc-fab" id="mcFab" aria-label="Quick actions" aria-expanded="false">${icon('plus')}</button>
  </div>`;

  // ── wiring ────────────────────────────────────────────────────────────────
  // Navigate on any [data-go] (surfaces + inner buttons + rail + timeline rows +
  // FAB items). Inner elements stop propagation so a button doesn't also fire
  // its parent surface.
  content.querySelectorAll('[data-go]').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); activeTab = el.dataset.go; selectedJobId = null; renderShell(); };
  });
  // Keyboard access for clickable surfaces + timeline rows.
  content.querySelectorAll('.cc2-axis[data-go], .mc-panel[data-go], .mc-seg[data-go], .cc-tl-row[data-go]').forEach(el => {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activeTab = el.dataset.go; selectedJobId = null; renderShell(); } };
  });
  // Operations-queue rows open the job detail drawer (mouse + keyboard).
  content.querySelectorAll('.cc2-qrow[data-jobid]').forEach(row => {
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'button');
    const open = () => openJobDrawer(row.dataset.jobid);
    row.onclick = (e) => { e.stopPropagation(); open(); };
    row.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  });
  // Analytics period selector.
  content.querySelectorAll('[data-period]').forEach(btn => {
    btn.onclick = (e) => { e.stopPropagation(); homePeriod = btn.dataset.period; renderHome(); };
  });
  // Analytics overlay — opens the detailed dashboard from the card, its button,
  // and the Gross rail KPI.
  content.querySelectorAll('[data-analytics]').forEach(el => {
    el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button');
    el.onclick = (e) => { e.stopPropagation(); openAnalyticsOverlay(); };
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAnalyticsOverlay(); } };
  });
  // Action helpers that aren't plain navigation (Sync Now / FAB "Sync inventory").
  content.querySelectorAll('[data-action]').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); if (el.dataset.action === 'sync') { activeTab = 'workspace'; renderShell(); } };
  });
  // Sync Now → workspace (where Quick Sync is launched).
  const syncBtn = content.querySelector('#syncNowBtn');
  if (syncBtn) syncBtn.onclick = (e) => { e.stopPropagation(); activeTab = 'workspace'; renderShell(); };
  // Re-run audit — flip AXIS into its scanning state, then re-render.
  const rerunBtn = content.querySelector('#rerunAudit');
  if (rerunBtn) rerunBtn.onclick = (e) => {
    e.stopPropagation();
    rerunBtn.textContent = 'Scanning…'; rerunBtn.disabled = true;
    const stage = content.querySelector('.cc2-axis .bot');
    if (stage) stage.dataset.state = 'scanning';
    setTimeout(() => renderHome(), 700);
  };
  // Operations queue filters — toggle row visibility in place (no re-render).
  const qFilters = content.querySelectorAll('.cc2-qfilter');
  qFilters.forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      qFilters.forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      const f = btn.dataset.qfilter;
      content.querySelectorAll('.cc2-qrow').forEach(row => {
        row.classList.toggle('cc-hidden', f !== 'all' && row.dataset.qcat !== f);
      });
    };
  });
  // Timeline filters — toggle row visibility in place (no full re-render).
  const tlFilters = content.querySelectorAll('.cc-tl-filter');
  tlFilters.forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      tlFilters.forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      const f = btn.dataset.filter;
      content.querySelectorAll('.cc-tl-row').forEach(row => {
        row.classList.toggle('cc-hidden', f !== 'all' && row.dataset.cat !== f);
      });
    };
  });
  // Floating quick-action launcher — toggle the menu; close on outside click /
  // after choosing an action (the action's own data-go/data-action handler runs first).
  const fabWrap = content.querySelector('#mcFabWrap');
  const fab = content.querySelector('#mcFab');
  if (fab && fabWrap) {
    fab.onclick = (e) => {
      e.stopPropagation();
      const open = fabWrap.classList.toggle('open');
      fab.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) {
        const close = (ev) => { if (!fabWrap.contains(ev.target)) { fabWrap.classList.remove('open'); fab.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', close); } };
        document.addEventListener('click', close);
      }
    };
  }
}

// ── WORKSPACE ─────────────────────────────────────────────────────────────────
// Scripts are marketplace-aware: they run against a TARGET account so they know
// what they're listing/syncing to. eBay is live today; other marketplaces show
// the same scripts but flagged "building" until their sync ships — never faked.
const LIVE_MARKETPLACES = ['ebay'];
let wsTarget = null;

// Where is this workspace in its lifecycle, and what is the single best next step?
// Driven by REAL state (device connected, accounts, synced inventory) — never faked.
function workspaceLifecycle() {
  const hasDevice = !!ext.installed;
  const hasAccount = accounts.length > 0;
  const hasSync = !!(inventorySummary && inventorySummary.total > 0);
  const steps = [
    { key: 'device', label: 'Connect device', done: hasDevice },
    { key: 'account', label: 'Connect account', done: hasAccount },
    { key: 'sync', label: 'Sync', done: hasSync },
    { key: 'research', label: 'Research', done: false },
    { key: 'list', label: 'List', done: false },
    { key: 'manage', label: 'Manage', done: false },
  ];
  let activeIdx = steps.findIndex(s => !s.done);
  if (activeIdx === -1) activeIdx = steps.length - 1;
  steps.forEach((s, i) => { s.active = i === activeIdx; });

  let rec;
  if (!hasDevice) rec = { kicker: 'Start here', title: 'Connect this device', desc: "Jobs run through the Syndrax browser extension. Install or reload it on this PC to turn on automation — right now this device can't run anything.", actions: [{ label: 'Set up device', tab: 'devices', primary: true }] };
  else if (!hasAccount) rec = { kicker: 'Next step', title: 'Connect a marketplace account', desc: 'Add your eBay (or other) store so Syndrax can sync listings, research products and run the workflow against it.', actions: [{ label: 'Connect account', tab: 'accounts', primary: true }] };
  else if (!hasSync) rec = { kicker: 'Next step', title: 'Run your first sync', desc: 'Quick Sync pulls your live listings, stock and prices so the whole workspace has real data to work from.', actions: [{ label: 'Run Quick Sync', module: 'quicksync', primary: true }, { label: 'Full Overview', module: 'dashboard' }] };
  else rec = { kicker: "You're set up", title: 'Find products to list', desc: 'Your store is synced. Research winning products, then list them in bulk — repeat the loop to grow.', actions: [{ label: 'Open Research', module: 'research', primary: true }, { label: 'List in bulk', module: 'lister' }] };

  return { steps, activeIdx, rec };
}

// The hero at the top of the Workspace: WHERE you are + the ONE next step + is it safe.
// Image-like product glyph by category — shared by the Automation Flow cards
// and the Research / Inventory windows.
function productEmoji(t = '') {
  t = t.toLowerCase();
  if (/earbud|airpod|headphone|sony|wh-|speaker|bluetooth/.test(t)) return '🎧';
  if (/tumbler|stanley|owala|bottle|quencher|flask|water/.test(t)) return '🥤';
  if (/tracker|watch|fitness|band/.test(t)) return '⌚';
  if (/blender|ninja|creami|kitchen/.test(t)) return '🍶';
  if (/vacuum|dyson/.test(t)) return '🧹';
  if (/ssd|samsung|drive|storage/.test(t)) return '💾';
  if (/charger|power|anker|bank|battery|led|light/.test(t)) return '🔋';
  if (/mouse|logitech|keyboard|mount/.test(t)) return '🖱️';
  if (/kindle|paperwhite|book|reader/.test(t)) return '📖';
  if (/lego|orchid|toy|plant/.test(t)) return '🧩';
  if (/crocs|clog|shoe|sneaker/.test(t)) return '👟';
  if (/resistance|gym|sport/.test(t)) return '🏋️';
  return '📦';
}

// A standard centered overlay shell (backdrop + dialog) with Escape/backdrop/×
// close and focus on the close button. Returns { host, body, close } so callers
// just fill the body and wire their own controls.
function openOverlay({ kicker, title, badge }) {
  document.querySelectorAll('.ov-bg').forEach(el => el.remove());
  const host = document.createElement('div');
  host.className = 'modal-bg an-bg ov-bg';
  host.innerHTML = `<div class="an-modal ov-modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="an-head">
      <div><span class="mc-kicker">${esc(kicker || '')}</span><h2>${esc(title)}</h2></div>
      <div class="an-head-right">${badge ? `<span class="hb-pill neutral">${esc(badge)}</span>` : ''}<button class="an-close" data-ovclose aria-label="Close">${icon('x')}</button></div>
    </div>
    <div class="an-body ov-body"></div>
  </div>`;
  document.body.appendChild(host);
  const close = () => { host.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  host.onclick = (e) => { if (e.target === host) close(); };
  host.querySelector('[data-ovclose]').onclick = close;
  return { host, body: host.querySelector('.ov-body'), close };
}

// Product Research window — scan a marketplace/category and queue winning
// products for listing. Sample catalogue in the sandbox; honest empty state
// (connect a store) otherwise. "Queue for listing" feeds the Bulk Lister.
function openResearchOverlay() {
  const pv = previewMode();
  const CATALOG = pv ? [
    { name: 'Wireless Earbuds Pro', cat: 'Electronics', demand: 'High', comp: 'Low', price: 39.99, profit: 18 },
    { name: 'Insulated Tumbler 40oz', cat: 'Home & Kitchen', demand: 'High', comp: 'Low', price: 24.99, profit: 11 },
    { name: 'Fitness Tracker Band', cat: 'Sports & Outdoors', demand: 'Medium', comp: 'Low', price: 29.99, profit: 13 },
    { name: 'Portable Blender', cat: 'Home & Kitchen', demand: 'High', comp: 'Medium', price: 34.99, profit: 15 },
    { name: 'LED Strip Lights 50ft', cat: 'Home & Garden', demand: 'High', comp: 'Medium', price: 19.99, profit: 9 },
    { name: 'Magnetic Phone Mount', cat: 'Automotive', demand: 'Medium', comp: 'Low', price: 14.99, profit: 8 },
    { name: 'Resistance Bands Set', cat: 'Sports & Outdoors', demand: 'Medium', comp: 'Low', price: 21.99, profit: 12 },
    { name: 'Stainless Water Bottle', cat: 'Home & Kitchen', demand: 'High', comp: 'Low', price: 18.99, profit: 10 },
    { name: 'Bluetooth Speaker Mini', cat: 'Electronics', demand: 'High', comp: 'Medium', price: 27.99, profit: 13 },
  ] : [];
  const lvl = v => v === 'High' ? 'high' : v === 'Medium' ? 'med' : 'low';
  const ov = openOverlay({ kicker: 'Discover', title: 'Product Research', badge: pv ? 'Sample scan' : null });

  const cardHtml = (p, i) => `<div class="rs-card">
    <div class="rs-thumb">${productEmoji(p.name)}</div>
    <div class="rs-info"><div class="rs-name" title="${esc(p.name)}">${esc(p.name)}</div><div class="rs-cat">${esc(p.cat)}</div></div>
    <div class="rs-stats">
      <span class="rs-stat"><i>Demand</i><b class="${lvl(p.demand)}">${p.demand}</b></span>
      <span class="rs-stat"><i>Comp.</i><b class="${lvl(p.comp)}">${p.comp}</b></span>
      <span class="rs-stat"><i>Est. profit</i><b class="prof">$${p.profit}</b></span>
    </div>
    <button class="mc-btn mc-btn--primary mc-btn--sm rs-queue" data-queue="${i}">${icon('plus')} Queue for listing</button>
  </div>`;

  const grid = CATALOG.length
    ? `<div class="rs-grid">${CATALOG.map(cardHtml).join('')}</div>`
    : `<div class="ov-empty"><span class="cc-empty-ico">${icon('search')}</span><div><div class="cc2-acs-empty-t">Connect a store to research</div><p>Link an eBay or Amazon account, then scan a marketplace and category to surface high-demand, low-competition products.</p></div><button class="mc-btn mc-btn--primary mc-btn--sm" data-ovgo="accounts">Connect account</button></div>`;

  ov.body.innerHTML = `
    <div class="rs-bar">
      <div class="rs-search">${icon('search')}<input type="text" placeholder="Search a niche or keyword…" id="rsInput"></div>
      <select class="rs-sel" id="rsMarket"><option>All marketplaces</option><option>eBay</option><option>Amazon</option><option>Shopify</option></select>
      <select class="rs-sel" id="rsCat"><option>All categories</option><option>Electronics</option><option>Home &amp; Kitchen</option><option>Sports &amp; Outdoors</option></select>
      <button class="mc-btn mc-btn--primary mc-btn--sm" id="rsScan">${icon('crosshair')} Scan market</button>
    </div>
    ${grid}`;

  ov.body.querySelectorAll('[data-queue]').forEach(b => b.onclick = () => {
    const p = CATALOG[+b.dataset.queue];
    b.innerHTML = '✓ Queued'; b.disabled = true; b.classList.add('is-queued');
    showToast(`Queued “${p.name}” for listing — open Bulk Lister to publish.`, 'success');
  });
  const scan = ov.body.querySelector('#rsScan');
  if (scan) scan.onclick = () => { scan.disabled = true; scan.textContent = 'Scanning…'; setTimeout(() => { scan.disabled = false; scan.innerHTML = `${icon('crosshair')} Scan market`; showToast('Scan complete — ' + CATALOG.length + ' product opportunities found.', 'success'); }, 850); };
  ov.body.querySelectorAll('[data-ovgo]').forEach(b => b.onclick = () => { ov.close(); activeTab = b.dataset.ovgo; renderShell(); });
}

// Inventory Manager window — search, filter, bulk-sync and review live stock.
// Uses the real inventory list (sample in sandbox), honest empty state otherwise.
function openInventoryOverlay() {
  const ov = openOverlay({ kicker: 'Manage', title: 'Inventory Manager', badge: previewMode() ? 'Sample data' : null });
  let filter = 'all';

  const statusOf = (it) => !it.inStock ? ['out', 'Out of stock'] : (it.qty > 0 && it.qty <= 3 ? ['low', 'Low stock'] : ['in', 'In stock']);
  const money = v => v != null ? `$${(+v).toFixed(2)}` : '—';

  function rowsHtml() {
    const items = invItems.filter(it => {
      if (filter === 'all') return true;
      const [c] = statusOf(it); return c === filter;
    });
    if (!items.length) return `<div class="ov-empty"><span class="cc-empty-ico">${icon('invlist')}</span><div><div class="cc2-acs-empty-t">No products${filter !== 'all' ? ' in this view' : ''}</div><p>${invItems.length ? 'Try a different filter.' : 'Connect a store and run Quick Sync to populate live inventory.'}</p></div>${invItems.length ? '' : `<button class="mc-btn mc-btn--primary mc-btn--sm" data-ovgo="accounts">Connect account</button>`}</div>`;
    return `<div class="im-table">
      <div class="im-head"><span>Product</span><span>Market</span><span>Status</span><span>Qty</span><span>Price</span><span>Margin</span><span></span></div>
      ${items.map(it => { const [cls, label] = statusOf(it); const margin = it.price && it.cost ? Math.round((it.price - it.cost) / it.price * 100) : null;
        return `<div class="im-row">
          <span class="im-cell im-prod"><span class="af-thumb">${productEmoji(it.title)}</span><span class="im-prod-t"><b>${esc(it.title || it.sku)}</b><i>SKU ${esc(it.sku || '—')}</i></span></span>
          <span class="im-cell">${esc(marketplace(it.marketplace)?.name || it.marketplace)}</span>
          <span class="im-cell"><span class="af-dot ${cls === 'in' ? 'in' : cls === 'low' ? 'low' : 'out'}"></span>${label}</span>
          <span class="im-cell im-qty">${it.inStock ? (it.qty || 0) : 0}</span>
          <span class="im-cell">${money(it.price)}</span>
          <span class="im-cell ${margin != null && margin >= 25 ? 'im-good' : ''}">${margin != null ? margin + '%' : '—'}</span>
          <button class="im-sync" data-imsync title="Sync this listing">${icon('refresh')}</button>
        </div>`; }).join('')}
    </div>`;
  }

  function paint() {
    ov.body.querySelector('.im-list').innerHTML = rowsHtml();
    ov.body.querySelectorAll('[data-imsync]').forEach(b => b.onclick = () => { b.classList.add('spin'); setTimeout(() => { b.classList.remove('spin'); showToast('Listing synced.', 'success'); }, 700); });
    ov.body.querySelectorAll('[data-ovgo]').forEach(b => b.onclick = () => { ov.close(); activeTab = b.dataset.ovgo; renderShell(); });
  }

  const counts = {
    all: invItems.length,
    in: invItems.filter(it => statusOf(it)[0] === 'in').length,
    low: invItems.filter(it => statusOf(it)[0] === 'low').length,
    out: invItems.filter(it => statusOf(it)[0] === 'out').length,
  };
  ov.body.innerHTML = `
    <div class="im-bar">
      <div class="rs-search">${icon('search')}<input type="text" placeholder="Search SKU or title…" id="imSearch"></div>
      <div class="im-filters">
        ${[['all', 'All', counts.all], ['in', 'In stock', counts.in], ['low', 'Low', counts.low], ['out', 'Out', counts.out]].map(([k, l, n]) => `<button class="im-filter ${k === 'all' ? 'on' : ''}" data-imfilter="${k}">${l} <b>${n}</b></button>`).join('')}
      </div>
      <button class="mc-btn mc-btn--primary mc-btn--sm" id="imSyncAll">${icon('refresh')} Sync all</button>
    </div>
    <div class="im-list"></div>`;
  paint();

  ov.body.querySelectorAll('[data-imfilter]').forEach(b => b.onclick = () => {
    ov.body.querySelectorAll('[data-imfilter]').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); filter = b.dataset.imfilter; paint();
  });
  const search = ov.body.querySelector('#imSearch');
  if (search) search.oninput = () => {
    const q = search.value.toLowerCase();
    ov.body.querySelectorAll('.im-row').forEach(r => { r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none'; });
  };
  const syncAll = ov.body.querySelector('#imSyncAll');
  if (syncAll) syncAll.onclick = () => { syncAll.disabled = true; syncAll.textContent = 'Syncing…'; setTimeout(() => { syncAll.disabled = false; syncAll.innerHTML = `${icon('refresh')} Sync all`; showToast('All listings synced with live prices &amp; stock.', 'success'); }, 1000); };
}

// ── Automation Flow ──────────────────────────────────────────────────────────
// The premium 3-card workflow overview at the top of Workspace: Product
// Research → Bulk Lister → Inventory Management, joined by connectors. Pulls
// from real globals (rich in preview, honest empty states otherwise) and wires
// into the existing data-run / data-go / data-invid handlers.
function automationFlowHtml() {
  const pv = previewMode();
  const sum = inventorySummary || {};
  const inStock = Object.values(sum.inStockByMarketplace || {}).reduce((a, b) => a + b, 0);
  const running = jobs.some(j => j.status === 'running' || j.status === 'accepted');
  const listerJob = jobs.find(j => j.script === 'bulklister' || j.scriptLabel === 'BulkLister');

  const research = {
    found: pv ? 128 : 0, highDemand: pv ? 34 : 0, lowComp: pv ? 12 : 0,
    opps: pv ? [
      { name: 'Wireless Earbuds', cat: 'Electronics', demand: 'High', comp: 'Low' },
      { name: 'Insulated Tumbler', cat: 'Home & Kitchen', demand: 'High', comp: 'Low' },
      { name: 'Fitness Tracker', cat: 'Sports & Outdoors', demand: 'Medium', comp: 'Low' },
    ] : [],
  };
  const lister = {
    queued: pv ? 86 : jobs.filter(j => j.status === 'queued' || j.status === 'dispatched').length,
    active: running, speed: pv ? 24 : 0,
    progress: pv ? 72 : (listerJob && listerJob.status === 'running' ? 62 : 0),
    tasks: [{ label: 'Title Optimized', ic: 'tag' }, { label: 'Images Ready', ic: 'package' }, { label: 'Price Synced', ic: 'cash' }],
  };
  const inv = {
    listed: sum.total || 0, inStock, outOfStock: sum.outOfStock || 0,
    lowStock: pv ? 21 : invItems.filter(it => it.inStock && it.qty > 0 && it.qty <= 3).length,
    rows: invItems.slice(0, 4),
  };

  const lvl = v => v === 'High' ? 'high' : v === 'Medium' ? 'med' : 'low';
  const thumbOf = (t) => `<span class="af-thumb">${productEmoji(t)}</span>`;
  const metric = (label, value, tone) => `<div class="af-metric"><span class="af-metric-lbl">${label}</span><b class="af-metric-val ${tone || ''}">${value}</b></div>`;
  const mkChip = (id, label) => { const lg = marketplaceLogo(id); return `<button class="af-chip" data-go="accounts"><span class="af-chip-ic">${lg || `<b>${esc(label[0])}</b>`}</span>${esc(label)}</button>`; };
  // Realistic: only show marketplaces that are actually connected. In the admin
  // sandbox, show the showcase trio. No fake chips when nothing is connected.
  const chipList = pv ? [['amazon', 'Amazon'], ['ebay', 'eBay'], ['shopify', 'Shopify']]
    : [...new Set(accounts.map(a => a.marketplace))].map(id => [id, marketplace(id)?.name || id]);
  const chipsHtml = chipList.length ? `<div class="af-chips">${chipList.map(([id, l]) => mkChip(id, l)).join('')}</div>` : '';

  const oppRows = research.opps.length ? research.opps.map(o => `
    <div class="af-row">
      ${thumbOf(o.name)}
      <div class="af-row-main"><div class="af-row-name">${esc(o.name)}</div><div class="af-row-sub">${esc(o.cat)}</div></div>
      <div class="af-row-stat"><span class="af-stat-lbl">Demand</span><span class="af-stat-val ${lvl(o.demand)}">${o.demand}</span></div>
      <div class="af-row-stat"><span class="af-stat-lbl">Comp.</span><span class="af-stat-val ${lvl(o.comp)}">${o.comp}</span></div>
    </div>`).join('')
    : `<div class="af-empty">Run Research to discover high-potential products.</div>`;

  const taskRows = lister.tasks.map(t => {
    const done = lister.progress > 0;
    const segs = Array.from({ length: 8 }, (_, i) => `<span class="af-seg ${done || i < Math.round(lister.progress / 14) ? 'on' : ''}"></span>`).join('');
    return `<div class="af-task">
      <span class="af-task-ic">${icon(t.ic)}</span>
      <div class="af-task-main"><div class="af-task-lbl">${t.label}</div><div class="af-segs">${segs}</div></div>
      <span class="af-check ${done ? 'on' : ''}">${done ? '✓' : ''}</span>
    </div>`;
  }).join('');

  const invStatus = (it) => !it.inStock ? ['out', 'Out of Stock'] : (it.qty > 0 && it.qty <= 3 ? ['low', 'Low Stock'] : ['in', 'In Stock']);
  const invRows = inv.rows.length ? inv.rows.map(it => { const [cls, label] = invStatus(it);
    return `<div class="af-inv-row">
      ${thumbOf(it.title)}
      <div class="af-row-main"><div class="af-row-name">${esc(it.title || it.sku)}</div><div class="af-row-sub">SKU: ${esc(it.sku || '—')}</div></div>
      <div class="af-inv-status"><span class="af-dot ${cls}"></span><span class="af-inv-status-t ${cls}">${label}</span></div>
      <div class="af-inv-qty">${it.inStock ? (it.qty || 0) : 0}</div>
      <button class="af-kebab" data-invid="${esc(String(it.id))}" aria-label="Product actions">⋮</button>
    </div>`; }).join('')
    : `<div class="af-empty">Sync an account to populate inventory.</div>`;

  return `<section class="af" aria-label="Automation flow">
    <div class="af-head">
      <div class="af-head-id">
        <span class="af-head-ic">${icon('bot')}</span>
        <div><h2 class="af-title">Automation Flow</h2><p class="af-sub">Research products, list in bulk, and manage live inventory.</p></div>
      </div>
      <span class="af-status"><span class="af-status-dot"></span>All Systems Operational</span>
    </div>

    <div class="af-grid">
      <!-- 1 · Product Research -->
      <article class="af-card af-card--research">
        <div class="af-card-head"><span class="af-card-ic blue">${icon('search')}</span><div class="af-card-id"><h3>Product Research</h3><p>Discover high-potential products using real-time market data.</p></div><span class="af-step">1</span></div>
        <div class="af-metrics af-metrics--3">${metric('Products Found', research.found, 'blue')}${metric('High Demand', research.highDemand, 'green')}${metric('Low Competition', research.lowComp, 'violet')}</div>
        ${chipsHtml}
        <div class="af-section"><span class="af-section-t">Top Product Opportunities</span><button class="af-link" data-research>View all</button></div>
        <div class="af-rows">${oppRows}</div>
        <button class="af-cta" data-research>${icon('search')} Open Research</button>
      </article>

      <div class="af-conn"><span class="af-conn-node">${icon('chevrons')}</span></div>

      <!-- 2 · Bulk Lister (active) -->
      <article class="af-card af-card--listing">
        <div class="af-card-head"><span class="af-card-ic blue">${icon('upload')}</span><div class="af-card-id"><h3>Bulk Lister</h3><p>Automate product listings across multiple sales channels.</p></div><span class="af-step">2</span></div>
        <div class="af-metrics af-metrics--2">
          <div class="af-metric"><span class="af-metric-lbl">Queued for Listing</span><b class="af-metric-val blue">${lister.queued}</b></div>
          <div class="af-metric"><span class="af-metric-lbl">Active Automation</span><b class="af-metric-val ${lister.active ? 'green' : 'muted'}"><span class="af-live ${lister.active ? 'on' : ''}"></span>${lister.active ? 'Active' : 'Idle'}</b></div>
        </div>
        <div class="af-speed">
          <div class="af-speed-top"><span>Listing Speed</span><b class="blue">${lister.speed} items/min</b></div>
          <div class="af-prog"><div class="af-prog-fill" data-w="${lister.progress}" style="width:0%"></div></div>
          <div class="af-prog-pct">${lister.progress}%</div>
        </div>
        <div class="af-tasks">${taskRows}</div>
        <button class="af-cta" data-run="lister">${icon('play')} Open Bulk Lister</button>
      </article>

      <div class="af-conn"><span class="af-conn-node">${icon('chevrons')}</span></div>

      <!-- 3 · Inventory Management -->
      <article class="af-card af-card--inventory">
        <div class="af-card-head"><span class="af-card-ic green">${icon('package')}</span><div class="af-card-id"><h3>Inventory Management</h3><p>Monitor stock levels and keep your inventory always up to date.</p></div><span class="af-step">3</span></div>
        <div class="af-metrics af-metrics--4">${metric('Listed Items', inv.listed.toLocaleString())}${metric('In Stock', inv.inStock.toLocaleString(), 'green')}${metric('Out of Stock', inv.outOfStock, 'red')}${metric('Low Stock', inv.lowStock, 'amber')}</div>
        <div class="af-chips af-chips--status">
          <span class="af-schip"><span class="af-dot in"></span>In Stock</span>
          <span class="af-schip"><span class="af-dot out"></span>Out of Stock</span>
          <span class="af-schip"><span class="af-dot paused"></span>Paused</span>
          <span class="af-schip"><span class="af-dot synced"></span>Synced</span>
        </div>
        <div class="af-section"><span class="af-section-t">Inventory Overview</span><button class="af-link" data-go="inventory">View all</button></div>
        <div class="af-rows">${invRows}</div>
        <button class="af-cta af-cta--green" data-invmgr>${icon('package')} Open Inventory Manager</button>
      </article>
    </div>

    <div class="af-summary">
      <span class="af-summary-ic">${icon('shield')}</span>
      <b>End-to-End Automation</b>
      <span class="af-summary-div"></span>
      <span class="af-summary-sub">Save Time. Reduce Errors. Scale Faster.</span>
    </div>
  </section>`;
}

function workspacePlanHtml() {
  const lc = workspaceLifecycle();
  const audit = runAudit(buildAuditInput());
  const rec = lc.rec;
  const stepper = `<div class="lifecycle">${lc.steps.map((s, i) => `<div class="lc-step ${s.done ? 'done' : ''} ${s.active ? 'active' : ''}"><div class="lc-dot">${s.done ? '✓' : (i + 1)}</div><div class="lc-lbl">${esc(s.label)}</div></div>`).join('')}</div>`;
  const auditHtml = audit.level === 'ok'
    ? `<div class="audit-row ok">${icon('shield')} <span>Safe setup — no account stacking or limit risks.</span></div>`
    : `<div class="audit-row warn">${icon('shield')} <span>${esc(audit.findings[0].title)}</span></div><div class="audit-more">${esc(audit.findings[0].detail.slice(0, 130))}… <span class="link" data-go="audit" style="color:#e5e5e5;cursor:pointer">view audit →</span></div>`;
  const actions = rec.actions.map(a => `<button class="app-btn ${a.primary ? '' : 'ghost'} sm" data-rec="${esc(JSON.stringify(a))}">${esc(a.label)}</button>`).join('');
  // Orb state: setup incomplete → "pending" (connecting pulse); fully set up → "active".
  const setupDone = lc.steps.slice(0, 3).every(s => s.done);
  const orbState = setupDone ? 'active' : 'pending';
  const orbLabel = setupDone ? 'Live' : (ext.installed ? 'Syncing' : 'Connecting');
  return `<div class="wf-plan">
    <div class="next-step">
      <div class="ns-body">
        <div class="ns-kicker">${iconCls('rocket', 'sb-ico')} ${esc(rec.kicker)}</div>
        <div class="ns-title">${esc(rec.title)}</div>
        <div class="ns-desc">${esc(rec.desc)}</div>
        <div class="ns-actions">${actions}</div>
        <div class="ns-step-of">Step ${lc.activeIdx + 1} of ${lc.steps.length} · now: ${esc(lc.steps[lc.activeIdx].label)}</div>
      </div>
      <div class="next-orb" data-state="${orbState}">
        <span class="orb-ring r1"></span><span class="orb-ring r2"></span><span class="orb-ring r3"></span>
        <span class="orb-core"></span>
        <span class="orb-label">${esc(orbLabel)}</span>
      </div>
    </div>
    <div class="wf-side">
      <div class="wf-card"><div class="wc-h">${icon('refresh')} Lifecycle</div>${stepper}</div>
      <div class="wf-card"><div class="wc-h">${icon('shield')} Safety audit</div>${auditHtml}</div>
    </div>
  </div>`;
}

function renderWorkspace() {
  $('#topSub').textContent = ext.installed ? '· running on this device' : '· install the extension to run jobs';
  wsTarget = accounts.find(a => a.id === selectedTarget) || accounts[0] || null;
  const targetMk = wsTarget ? wsTarget.marketplace : 'ebay';
  const live = LIVE_MARKETPLACES.includes(targetMk);
  const mkName = marketplace(targetMk)?.name || targetMk;

  const modOf = k => WORKFLOW.flatMap(s => s.modules).find(m => m.key === k);
  const STAGE_ACCENT = ['teal', 'violet', 'blue', 'amber'];
  // Connected tool-launch pipeline — Sync → Research → Lister → Manage. Each
  // stage launches its primary tool (data-run), exposes sub-tools (data-adv),
  // and can be automated (data-bot). Same handlers as before, new composition.
  const stages = `<div class="ws-pipe">${STAGES.map((st, i) => {
    const isLister = st.primary === 'lister';
    const ptier = isLister ? 'live' : toolTier(st.primary);
    // 'live'/'hub' scripts work today → colored; 'todo' is unfinished → greyed.
    const working = ptier === 'live' || ptier === 'hub';
    const tierLabel = ptier === 'live' ? 'Live' : ptier === 'hub' ? 'Ready' : 'Building';
    const acc = STAGE_ACCENT[i % STAGE_ACCENT.length];
    const advChips = st.advanced.map(k => {
      const m = modOf(k); const t = toolTier(k); const ok = t === 'live' || t === 'hub';
      return `<button class="ws-adv ${ok ? 'ready' : 'building'}" data-adv="${k}" title="${esc(m?.desc || '')}${ok ? '' : ' — not finished yet'}">${esc(m?.label || k)}${ok ? '' : '<span class="ws-adv-tag">soon</span>'}</button>`;
    }).join('');
    const runLabel = isLister ? 'Open Lister' : `Run ${st.title}`;
    return `${i ? `<div class="ws-pipe-link"><span class="ws-pipe-flow"></span></div>` : ''}
      <section class="ws-stage ${working ? '' : 'is-building'}" data-accent="${acc}">
        <div class="ws-stage-top">
          <span class="ws-stage-step">Stage ${i + 1}</span>
          <button class="ws-bot" data-bot="${st.primary}" title="Build an automation with ${esc(st.title)}">${icon('bot')}</button>
        </div>
        <div class="ws-stage-ic ${acc}">${icon(st.icon)}</div>
        <div class="ws-stage-name">${esc(st.title)} <span class="ws-tier ${ptier}">${tierLabel}</span></div>
        <div class="ws-stage-desc">${esc(st.desc)}</div>
        <div class="ws-stage-adv">${advChips}</div>
        <button class="mc-btn ${working ? 'mc-btn--primary' : 'mc-btn--secondary'} ws-stage-run" data-run="${st.primary}"${working ? '' : ' disabled title="This script is still being built"'}>${icon('play')} ${working ? runLabel : 'Building soon'}</button>
      </section>`;
  }).join('')}</div>`;

  $('#content').innerHTML = `
    <div class="wf-bar">
      <div class="wf-target">
        <span class="wf-lbl">Marketplace</span>
        ${accounts.length === 0
          ? `<span class="link" data-go="accounts">Connect an account →</span>`
          : `<div class="wf-accs">${accounts.map(a => { const m = marketplace(a.marketplace); const lg = marketplaceLogo(a.marketplace) || `<span style="font:800 12px var(--nav-font);color:#fff">${(m?.name || '?')[0]}</span>`; const on = wsTarget && wsTarget.id === a.id; return `<button class="wf-acc ${on ? 'on' : ''}" data-target="${a.id}"><span class="mk-chip neutral" style="width:22px;height:22px">${lg}</span>${esc(a.label || m?.name || a.marketplace)}</button>`; }).join('')}</div>`}
      </div>
      <div class="wf-right">
        <span class="relay-pill ${ext.installed ? 'on' : 'off'}">${icon(ext.installed ? 'wifi' : 'monitor')} ${ext.installed ? 'This PC' : 'No device'}</span>
        <button class="audit-toggle ${auditAgentOn ? 'on' : 'off'}" id="auditToggle" title="${auditAgentOn ? 'Monitoring & protecting this account from restrictions, bans and bot-detection. Click to turn off.' : 'Audit agent is OFF — the account is not being protected. Click to turn on.'}">${icon('shield')} Audit agent <b>${auditAgentOn ? 'on' : 'off'}</b></button>
      </div>
    </div>

    ${automationFlowHtml()}

    ${!live ? `<div class="wf-note">${esc(mkName)} runners are being built — <b>eBay is live today</b>. The same workflow lights up here once ${esc(mkName)} ships. You can still schedule automations now.</div>` : ''}

    <div class="tools-head"><h3>Launch tools</h3><span class="th-note">Four stages, scoped to ${esc(mkName)}. Each card runs its main action — open <b>Advanced settings</b> to tune its sub-tools, or the 🤖 sync-bot to automate it.</span></div>
    ${stages}

    <div class="ws2-cols">
      <div class="panel"><div class="panel-h">Recent jobs (${jobs.length}) ${jobs.length ? '<span class="link" id="clearJobs">clear</span>' : ''}</div>
        ${jobs.length === 0 ? `<p style="font-size:12px;color:rgba(255,255,255,0.35)">No jobs yet — click a tool above.</p>` : jobs.slice(0, 6).map(jobRow).join('')}</div>
      <div class="panel"><div class="panel-h">Automations (${automations.length}) <span style="color:rgba(255,255,255,0.35);font-weight:500;text-transform:none;letter-spacing:0">audit-gated</span></div>
        ${renderAutomationsList()}</div>
    </div>`;

  $('#content').querySelectorAll('[data-target]').forEach(b => b.onclick = () => { selectedTarget = b.dataset.target; renderWorkspace(); });
  $('#content').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { activeTab = b.dataset.go; renderShell(); });
  $('#content').querySelectorAll('[data-rec]').forEach(b => b.onclick = () => {
    let a = {}; try { a = JSON.parse(b.dataset.rec); } catch {}
    if (a.tab) { activeTab = a.tab; renderShell(); }
    else if (a.module) runTool(a.module, toolTier(a.module));
  });
  $('#content').querySelectorAll('[data-run]').forEach(b => b.onclick = () => {
    const k = b.dataset.run;
    if (k === 'lister') openListerOverlay();
    else runTool(k, toolTier(k));
  });
  $('#content').querySelectorAll('[data-adv]').forEach(b => b.onclick = () => openToolSettings(b.dataset.adv));
  $('#content').querySelectorAll('[data-bot]').forEach(b => b.onclick = (e) => { e.stopPropagation(); openAutomationBuilder(b.dataset.bot); });
  const at = $('#auditToggle');
  if (at) at.onclick = () => {
    auditAgentOn = !auditAgentOn;
    localStorage.setItem('syndrax_audit_agent', auditAgentOn ? 'on' : 'off');
    showToast(auditAgentOn ? 'Audit agent ON — monitoring & protecting this account from restrictions, bans and bot-detection.' : 'Audit agent OFF — automations will run without account protection.', auditAgentOn ? 'success' : 'info');
    renderWorkspace();
  };
  $('#content').querySelectorAll('[data-job]').forEach(b => b.onclick = () => { selectedJobId = b.dataset.job; activeTab = 'jobs'; renderShell(); });
  $('#content').querySelectorAll('[data-autorun]').forEach(b => b.onclick = () => runAutomation(b.dataset.autorun));
    $('#content').querySelectorAll('[data-autodel]').forEach(b => b.onclick = () => { automations = automations.filter(a => a.id !== b.dataset.autodel); saveAutomations(); renderWorkspace(); });
    wireTemplatePackButtons($('#content'));
    if (!templateCatalog) ensureTemplateCatalog().then(() => { if (activeTab === 'workspace') renderWorkspace(); });
    const cj = $('#clearJobs'); if (cj) cj.onclick = () => { jobs = []; saveJobs(); selectedJobId = null; renderWorkspace(); };
  // Automation Flow: kebab buttons open the product detail drawer.
  $('#content').querySelectorAll('.af-kebab[data-invid]').forEach(b => b.onclick = (e) => { e.stopPropagation(); openInventoryItem(b.dataset.invid); });
  // Automation Flow: open the Research / Inventory Manager windows.
  $('#content').querySelectorAll('[data-research]').forEach(b => b.onclick = () => openResearchOverlay());
  $('#content').querySelectorAll('[data-invmgr]').forEach(b => b.onclick = () => openInventoryOverlay());
  // Animate the Bulk Lister progress bar to its target width once mounted.
  requestAnimationFrame(() => $('#content').querySelectorAll('.af-prog-fill[data-w]').forEach(el => { el.style.width = (el.dataset.w || 0) + '%'; }));
}

// Turn a saved automation into one plain-English sentence, e.g.
// "Runs Quick Sync → Lister on eBay every 6 hours, with audit protection."
// Keeps the data model (steps[], interval, marketplace, auditAgent) readable
// to both the seller and the next developer.
function describeAutomation(a) {
  const allMods = WORKFLOW.flatMap(s => s.modules);
  const stepNames = (a.steps || []).map(k => allMods.find(m => m.key === k)?.label || k);
  const chain = stepNames.length ? stepNames.join(' → ') : (a.label || 'Workflow');
  const market = marketplace(a.marketplace)?.name || a.marketplace;
  const cadence = a.interval && a.interval.toLowerCase() !== 'manual' ? a.interval.toLowerCase() : 'on demand';
  const safety = a.auditAgent ? ', with audit protection' : '';
  return `Runs ${chain} on ${market} ${cadence}${safety}.`;
}

/** Group template packs for a cleaner install UI. */
function templatePackGroups(packs) {
  const groups = [
    { id: 'daily', label: 'Daily', match: (t) => /daily|morning|end-of-day|trust-protect/i.test(t.id + t.title) },
    { id: 'list', label: 'List & grow', match: (t) => /list|research|bulk/i.test(t.id + t.title) && !/return/i.test(t.id) },
    { id: 'price', label: 'Price', match: (t) => /reprice|repricer|pricing|sync-reprice/i.test(t.id + t.title) },
    { id: 'service', label: 'Service', match: (t) => /return|triage|message/i.test(t.id + t.title) },
    { id: 'studio', label: 'Studio', match: (t) => t.kind === 'automation-module' || /sample|automation\./i.test(t.id) },
  ];
  const used = new Set();
  const out = [];
  for (const g of groups) {
    const items = packs.filter(t => !used.has(t.id) && g.match(t));
    items.forEach(t => used.add(t.id));
    if (items.length) out.push({ ...g, items });
  }
  const rest = packs.filter(t => !used.has(t.id));
  if (rest.length) out.push({ id: 'more', label: 'More', match: () => true, items: rest });
  return out;
}

function renderAutomationsList() {
  const allMods = WORKFLOW.flatMap(s => s.modules);
  const packs = (templateCatalog?.templates || []).filter(t => t.kind === 'workflow' || t.kind === 'automation-module');
  const installedIds = new Set(automations.map(a => a.fromTemplate).filter(Boolean));
  const available = packs.filter(t => !installedIds.has(t.id));
  const groups = templatePackGroups(available);

  // Compact library: only packs not yet saved; grouped; no button soup of everything.
  let packBar = `<div class="tpl-panel">
    <div class="tpl-panel-head">
      <div>
        <div class="tpl-kicker">Library</div>
        <div class="tpl-title">Add a pack</div>
      </div>
      <div class="tpl-head-actions">
        <a class="tpl-link" href="/templates.html" target="_blank" rel="noopener">Full library</a>
        <button type="button" class="tpl-link" id="tplImportMod">Import</button>
        ${!packs.length ? `<button type="button" class="tpl-link" id="tplLoadCat">Load catalog</button>` : ''}
        ${available.length ? `<button type="button" class="tpl-link" id="tplInstallAllMissing">Add all (${available.length})</button>` : ''}
      </div>
    </div>`;

  if (!packs.length) {
    packBar += `<p class="tpl-empty">Catalog not loaded yet.</p></div>`;
  } else if (!available.length) {
    packBar += `<p class="tpl-empty">All library packs are already in Saved. Remove one below if you want to re-add it cleanly.</p></div>`;
  } else {
    packBar += groups.map(g => `
      <div class="tpl-group">
        <div class="tpl-group-label">${esc(g.label)}</div>
        <div class="tpl-pack-list">
          ${g.items.map(p => `
            <button type="button" class="tpl-pack" data-install-pack="${esc(p.id)}" title="${esc(p.summary || '')}">
              <span class="tpl-pack-name">${esc(p.title)}</span>
              <span class="tpl-pack-meta">${esc((p.payload?.interval) || 'Manual')} · ${(p.payload?.steps || p.payload?.actions || []).length || '—'} steps</span>
              <span class="tpl-pack-add">Add</span>
            </button>`).join('')}
        </div>
      </div>`).join('');
    packBar += `</div>`;
  }

  // Saved list: one clean row each — title, short chain, schedule, run/delete.
  if (!automations.length) {
    return packBar + `<div class="tpl-saved">
      <div class="tpl-saved-head"><div class="tpl-kicker">Saved</div><div class="tpl-title">Automations</div></div>
      <p class="tpl-empty">Nothing saved yet. Add a pack above, or build steps on the left canvas and Save.</p>
    </div>`;
  }

  const sorted = automations.slice().sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  const rows = sorted.map(a => {
    const steps = (a.steps || []).map(k => allMods.find(m => m.key === k)?.label || k);
    const chain = steps.length
      ? steps.map(s => `<span class="tpl-chip">${esc(s)}</span>`).join('<span class="tpl-chip-sep">/</span>')
      : '<span class="tpl-muted">No steps</span>';
    const schedule = a.interval && String(a.interval).toLowerCase() !== 'manual' ? a.interval : 'Manual';
    const mk = marketplace(a.marketplace)?.name || a.marketplace || 'eBay';
    return `<div class="tpl-row">
      <div class="tpl-row-main">
        <div class="tpl-row-title">${esc(a.label)}</div>
        <div class="tpl-row-chain">${chain}</div>
        <div class="tpl-row-meta">
          <span>${esc(mk)}</span>
          <span class="tpl-dot">·</span>
          <span>${esc(schedule)}</span>
          ${a.auditAgent ? '<span class="tpl-dot">·</span><span>Audit on</span>' : ''}
          <span class="tpl-dot">·</span>
          <span>${steps.length} step${steps.length === 1 ? '' : 's'}</span>
        </div>
      </div>
      <div class="tpl-row-actions">
        <button type="button" class="mc-btn mc-btn--secondary mc-btn--sm" data-autorun="${esc(a.id)}">${icon('play')} Run</button>
        <button type="button" class="tpl-del" data-autodel="${esc(a.id)}" title="Remove">Remove</button>
      </div>
    </div>`;
  }).join('');

  return packBar + `<div class="tpl-saved">
    <div class="tpl-saved-head">
      <div>
        <div class="tpl-kicker">Saved</div>
        <div class="tpl-title">Automations <span class="tpl-count">${automations.length}</span></div>
      </div>
    </div>
    <div class="tpl-rows">${rows}</div>
  </div>`;
}

async function ensureTemplateCatalog() {
  if (templateCatalog) return templateCatalog;
  return loadTemplateCatalog();
}

function installTemplatePackById(id) {
  const t = (templateCatalog?.templates || []).find(x => x.id === id);
  if (!t) { showToast('Pack not found in catalog.', 'error'); return; }
  // Already installed? Don't add a third/fourth copy — refresh existing.
  const existing = automations.find(a => a.fromTemplate === t.id);
  if (existing) {
    showToast(`“${t.title}” is already in Saved automations.`, 'info');
    playSfx('nav');
    return existing;
  }
  const mk = wsTarget ? wsTarget.marketplace : ((t.marketplace || [])[0] || 'ebay');
  const steps = ((t.payload && t.payload.steps) || []).map(s => typeof s === 'string' ? s : s.key).filter(Boolean);
  const actionKeys = ((t.payload && t.payload.actions) || []).map((a, i) => a.key || a.type || ('step-' + (i + 1)));
  const finalSteps = steps.length ? steps : actionKeys;
  if (!finalSteps.length) { showToast('That pack has no steps to install.', 'error'); return; }
  const row = {
    id: (t.kind === 'automation-module' ? 'mod-' : 'pack-') + Date.now().toString(36),
    label: t.title,
    marketplace: mk,
    steps: finalSteps,
    interval: (t.payload && t.payload.interval) || 'Manual',
    auditAgent: !(t.payload && t.payload.auditAgent === false),
    fromTemplate: t.id,
    status: t.status || 'ready',
    sharedWith: t.sharedWith || [],
    kind: t.kind,
  };
  automations.unshift(row);
  saveAutomations();
  showToast(`Installed “${t.title}” to automations.`, 'success');
  playSfx('confirm');
  return row;
}

function openTemplateImportModal() {
  const host = document.createElement('div');
  host.className = 'modal-bg';
  host.onclick = () => host.remove();
  host.innerHTML = `<div class="modal builder" onclick="event.stopPropagation()" style="max-width:640px">
    <h3>${icon('refresh')} Import automation / template JSON</h3>
    <p class="modal-sub">Paste Oleg’s Studio export (<code>automation-module</code>) or a workflow pack. Full library: <a href="/templates.html" target="_blank" style="color:#e5e5e5">/templates.html</a></p>
    <textarea id="tplImp" rows="12" placeholder='{ "kind": "automation-module", "title": "...", "payload": { "steps": [] } }' style="font-family:ui-monospace,monospace;font-size:12px"></textarea>
    <div class="app-btn-row" style="margin-top:14px">
      <button class="app-btn" id="tplImpGo">${icon('plus')} Import to Jobs</button>
      <button class="app-btn ghost" id="tplImpSample">Load sample</button>
      <button class="app-btn ghost" id="tplImpClose">Close</button>
    </div>
  </div>`;
  document.body.appendChild(host);
  host.querySelector('#tplImpClose').onclick = () => host.remove();
  host.querySelector('#tplImpSample').onclick = async () => {
    await ensureTemplateCatalog();
    const sample = (templateCatalog?.templates || []).find(t => t.kind === 'automation-module');
    if (sample) host.querySelector('#tplImp').value = JSON.stringify(sample, null, 2);
    else showToast('No sample automation-module in catalog.', 'info');
  };
  host.querySelector('#tplImpGo').onclick = () => {
    try {
      const raw = JSON.parse(host.querySelector('#tplImp').value);
      const list = Array.isArray(raw.templates) ? raw.templates : [raw];
      let n = 0;
      for (const t of list) {
        if (!templateCatalog) templateCatalog = { templates: [] };
        // merge into in-memory catalog for install
        const existing = templateCatalog.templates.findIndex(x => x.id === t.id);
        if (existing >= 0) templateCatalog.templates[existing] = t;
        else templateCatalog.templates.push(t);
        if (t.kind === 'workflow' || t.kind === 'automation-module' || t.payload?.steps || t.payload?.actions || t.steps) {
          if (!t.kind) t.kind = 'automation-module';
          installTemplatePackById(t.id);
          n++;
        }
      }
      host.remove();
      if (activeTab === 'jobs') renderJobsTab();
      else if (activeTab === 'workspace') renderWorkspace();
      showToast(n ? `Imported ${n} pack(s).` : 'JSON saved — no workflow steps found.', n ? 'success' : 'info');
    } catch (e) {
      showToast('Invalid JSON: ' + (e.message || e), 'error');
    }
  };
}

function wireTemplatePackButtons(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-install-pack]').forEach(b => b.onclick = async () => {
    await ensureTemplateCatalog();
    installTemplatePackById(b.dataset.installPack);
    if (activeTab === 'jobs') renderJobsTab();
    else if (activeTab === 'workspace') renderWorkspace();
  });
  const load = scope.querySelector('#tplLoadCat');
  if (load) load.onclick = async () => {
    await ensureTemplateCatalog();
    if (activeTab === 'jobs') renderJobsTab();
    else if (activeTab === 'workspace') renderWorkspace();
    showToast(templateCatalog ? `Catalog loaded (${templateCatalog.count || templateCatalog.templates?.length || 0}).` : 'Catalog failed to load.', templateCatalog ? 'success' : 'error');
  };
  const imp = scope.querySelector('#tplImportMod');
  if (imp) imp.onclick = () => openTemplateImportModal();
  const allMissing = scope.querySelector('#tplInstallAllMissing');
  if (allMissing) allMissing.onclick = async () => {
    await ensureTemplateCatalog();
    const packs = (templateCatalog?.templates || []).filter(t => t.kind === 'workflow' || t.kind === 'automation-module');
    const have = new Set(automations.map(a => a.fromTemplate).filter(Boolean));
    let n = 0;
    for (const t of packs) {
      if (have.has(t.id)) continue;
      installTemplatePackById(t.id);
      n++;
    }
    showToast(n ? `Added ${n} pack${n === 1 ? '' : 's'}.` : 'Nothing new to add.', n ? 'success' : 'info');
    if (activeTab === 'jobs') renderJobsTab();
    else if (activeTab === 'workspace') renderWorkspace();
  };
}

function openModuleModal(key) {
  const mod = WORKFLOW.flatMap(s => s.modules).find(m => m.key === key); if (!mod) return;
  const mk = wsTarget ? wsTarget.marketplace : 'ebay';
  const mkName = marketplace(mk)?.name || mk;
  const isEbay = mk === 'ebay';
  const autoDispatch = LIVE_MARKETPLACES.includes(mk) && !!RUNNABLE[mod.run];
  const ebayUrl = MODULE_EBAY_URL[key];
  const host = document.createElement('div');
  host.className = 'modal-bg';
  host.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <h3>${esc(mod.label)} → ${esc(mkName)}</h3>
      <p class="modal-sub">${esc(mod.desc)}. Target: <b style="color:rgba(255,255,255,0.55)">${esc(wsTarget?.label || 'your account')}</b>.</p>
      ${autoDispatch
        ? `<button class="app-btn" id="mRun" style="width:100%">${icon('play')} Run now on This PC</button>`
        : isEbay && ebayUrl
          ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:2px">
              <button class="app-btn ghost" id="mOpen" style="flex:1">${icon('upload')} Open in eBay Seller Hub</button>
             </div>
             <div class="eligibility" style="margin-top:8px">Auto-dispatch for <b>${esc(mod.label)}</b> is being wired into the extension — scheduled automations will activate when it ships.</div>`
          : `<div class="eligibility" style="margin:0 0 4px">${esc(mkName)} runner for ${esc(mod.label)} is building — schedule it now and it auto-runs when it ships.</div>`}
      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
        <label>Schedule (repeat)</label>
        <select id="mInt"><option>Every hour</option><option selected>Every 6 hours</option><option>Daily</option><option>Every 3 days</option><option>Weekly</option></select>
        <label style="display:flex;align-items:center;gap:8px;margin-top:12px;text-transform:none;letter-spacing:0;font-size:13px;color:rgba(255,255,255,0.55)"><input type="checkbox" id="mAudit" checked style="width:auto;accent-color:#d4d4d4"> Run the audit agent first (keeps the account human &amp; safe)</label>
        <label>Rule (optional)</label>
        <input id="mRule" placeholder="e.g. only when trust score > 90, max 30 listings/day">
        <div class="app-btn-row" style="margin-top:14px">
          <button class="app-btn" id="mSave">${icon('refresh')} Save automation</button>
          <button class="app-btn ghost" id="mCancel">Close</button>
        </div>
      </div>
    </div>`;
  host.onclick = () => host.remove();
  document.body.appendChild(host);
  $('#mCancel', host).onclick = () => host.remove();
  const runBtn = $('#mRun', host);
  if (runBtn) runBtn.onclick = () => {
    host.remove();
    if (mod.run === 'lister') { configuring = 'bulklister'; openScriptModal(); }
    else dispatch(mod.run || mod.key, mod.label, {});
  };
  const openBtn = $('#mOpen', host);
  if (openBtn) openBtn.onclick = () => { window.open(ebayUrl, '_blank'); host.remove(); };
  $('#mSave', host).onclick = () => {
    automations.unshift({
      id: 'auto-' + Date.now().toString(36), key: mod.key, label: mod.label,
      marketplace: mk, account: wsTarget?.label || '', interval: $('#mInt', host).value,
      auditAgent: $('#mAudit', host).checked, rule: $('#mRule', host).value.trim(), createdAt: Date.now(),
    });
    saveAutomations(); host.remove(); renderWorkspace();
    showToast(`Automation saved — ${mod.label} runs on schedule with the audit agent.`, 'success');
  };
}

function runAutomation(id) {
  const a = automations.find(x => x.id === id); if (!a) return;
  // Multi-step workflow → open the builder and animate the run.
  if (a.steps && a.steps.length) { openAutomationBuilder({ steps: a.steps, name: a.label, autorun: true }); return; }
  const mod = WORKFLOW.flatMap(s => s.modules).find(m => m.key === a.key);
  selectedTarget = (accounts.find(x => x.marketplace === a.marketplace) || {}).id || selectedTarget;
  wsTarget = accounts.find(x => x.id === selectedTarget) || wsTarget;
  if (mod && mod.run === 'lister') { configuring = 'bulklister'; openScriptModal(); }
  else if (mod) dispatch(mod.run || mod.key, mod.label, {});
}

// ── Template library (basic Message Tool first) ───────────────────────────────
// Catalog lives at /templates/catalog.json (mirrored from Apps/Syndrax/template-library).
async function loadTemplateCatalog() {
  if (templateCatalog) return templateCatalog;
  const urls = ['/templates/catalog.json', './templates/catalog.json', '/catalog.json'];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      templateCatalog = await res.json();
      return templateCatalog;
    } catch {}
  }
  return null;
}

function fillTemplateBody(body, values) {
  if (!body) return '';
  return String(body).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = values[key];
    return (v === undefined || v === '') ? `{{${key}}}` : v;
  });
}

// Step 3 product surface: buyer-message templates only (fill + copy).
async function openMessageTool() {
  const host = document.createElement('div');
  host.className = 'modal-bg';
  host.onclick = () => host.remove();
  host.innerHTML = `<div class="modal builder" onclick="event.stopPropagation()" style="max-width:720px">
    <h3>${icon('refresh')} Message Tool</h3>
    <p class="modal-sub">Buyer reply templates — fill the blanks, copy, paste into eBay Messages. Full catalog also at <b style="color:rgba(255,255,255,.55)">/templates.html</b>.</p>
    <div style="color:rgba(255,255,255,.4);font-size:12.5px;padding:18px 0">Loading templates…</div>
  </div>`;
  document.body.appendChild(host);
  playSfx('nav');

  const cat = await loadTemplateCatalog();
  const msgs = (cat?.templates || []).filter(t => t.kind === 'buyer-message');
  if (!msgs.length) {
    host.querySelector('.modal').innerHTML = `<h3>${icon('refresh')} Message Tool</h3>
      <p class="modal-sub">No buyer-message templates found. Serve <code>/templates/catalog.json</code> from the lab site.</p>
      <div class="app-btn-row" style="margin-top:14px">
        <a class="app-btn ghost" href="/templates.html" target="_blank">Open catalog page</a>
        <button class="app-btn ghost" id="mtClose">Close</button>
      </div>`;
    host.querySelector('#mtClose').onclick = () => host.remove();
    return;
  }

  let selectedId = msgs[0].id;
  const values = {};

  function selected() { return msgs.find(m => m.id === selectedId) || msgs[0]; }

  function seedValues(t) {
    Object.keys(values).forEach(k => delete values[k]);
    (t.variables || []).forEach(v => { values[v.key] = v.example || ''; });
    if (values.seller_signoff === undefined) values.seller_signoff = 'Syndrax seller';
  }
  seedValues(selected());

  function paint() {
    const t = selected();
    const filled = fillTemplateBody(t.body || '', values);
    host.querySelector('.modal').innerHTML = `
      <h3>${icon('refresh')} Message Tool</h3>
      <p class="modal-sub">${esc(t.summary || 'Buyer reply template')}. ${msgs.length} templates ready.</p>
      <label>Template</label>
      <select id="mtPick">${msgs.map(m => `<option value="${esc(m.id)}" ${m.id === t.id ? 'selected' : ''}>${esc(m.title)}</option>`).join('')}</select>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
        <div>
          <label>Variables</label>
          <div id="mtVars" style="display:grid;gap:8px;margin-top:6px">
            ${(t.variables || []).map(v => `
              <label style="text-transform:none;letter-spacing:0;font-size:12px;color:rgba(255,255,255,.45)">${esc(v.label || v.key)}
                <input data-mtvar="${esc(v.key)}" value="${esc(values[v.key] || '')}" placeholder="${esc(v.example || '')}" style="margin-top:4px">
              </label>`).join('')}
            <label style="text-transform:none;letter-spacing:0;font-size:12px;color:rgba(255,255,255,.45)">Seller sign-off
              <input data-mtvar="seller_signoff" value="${esc(values.seller_signoff || '')}" style="margin-top:4px">
            </label>
          </div>
        </div>
        <div>
          <label>Preview</label>
          <textarea id="mtPreview" rows="12" readonly style="margin-top:6px;font-family:ui-monospace,monospace;font-size:12px;line-height:1.5">${esc(filled)}</textarea>
        </div>
      </div>
      <div class="app-btn-row" style="margin-top:16px">
              <button class="app-btn" id="mtCopy">${icon('refresh')} Copy message</button>
              <button class="app-btn ghost" id="mtRemix">Remix ×3</button>
              <a class="app-btn ghost" href="/templates.html" target="_blank">Full catalog</a>
              <button class="app-btn ghost" id="mtEbay">Open eBay Messages</button>
              <button class="app-btn ghost" id="mtClose">Close</button>
            </div>`;

          const pick = host.querySelector('#mtPick');
          pick.onchange = () => { selectedId = pick.value; seedValues(selected()); paint(); };
          host.querySelectorAll('[data-mtvar]').forEach(inp => {
            inp.oninput = () => {
              values[inp.dataset.mtvar] = inp.value;
              const next = fillTemplateBody(selected().body || '', values);
              const ta = host.querySelector('#mtPreview');
              if (ta) ta.value = next;
            };
          });
          host.querySelector('#mtCopy').onclick = async () => {
            const text = fillTemplateBody(selected().body || '', values);
            try {
              await navigator.clipboard.writeText(text);
              showToast('Message copied — paste into eBay Messages.', 'success');
              playSfx('confirm');
            } catch {
              host.querySelector('#mtPreview')?.select();
              showToast('Select the preview and copy manually (clipboard blocked).', 'info');
            }
          };
          host.querySelector('#mtRemix').onclick = () => {
            const t = selected();
            const filled = fillTemplateBody(t.body || '', values);
            const v2 = filled.replace(/^Hi\s+[^,\n]+,\s*/i, 'Hello,\n\n').replace(/\s*\([^)]*\)/g, '').trim();
            const v3 = filled.replace(/^Hi\s+/i, 'Dear ').replace(/Quick update/gi, 'Order update');
            const block = `--- A Original ---\n${filled}\n\n--- B Tighter ---\n${v2}\n\n--- C Formal ---\n${v3}`;
            const ta = host.querySelector('#mtPreview');
            if (ta) ta.value = block;
            showToast('3 local remix variants in preview — copy what you like.', 'success');
          };
          host.querySelector('#mtEbay').onclick = () => {
            window.open(MODULE_EBAY_URL.messages || 'https://www.ebay.com/sh/msg', '_blank');
            showToast('Opened eBay Messages in a new tab.', 'info');
          };
          host.querySelector('#mtClose').onclick = () => host.remove();
        }

        paint();
      }

// Step 4 product surface: listing-description HTML templates (fill + preview + copy).
async function openDescriptionBuilder() {
  const host = document.createElement('div');
  host.className = 'modal-bg';
  host.onclick = () => host.remove();
  host.innerHTML = `<div class="modal builder" onclick="event.stopPropagation()" style="max-width:860px">
    <h3>${icon('upload')} Description Builder</h3>
    <p class="modal-sub">Listing HTML styles — fill variables, preview, copy into your listing. Full catalog at <b style="color:rgba(255,255,255,.55)">/templates.html</b>.</p>
    <div style="color:rgba(255,255,255,.4);font-size:12.5px;padding:18px 0">Loading templates…</div>
  </div>`;
  document.body.appendChild(host);
  playSfx('nav');

  const cat = await loadTemplateCatalog();
  const packs = (cat?.templates || []).filter(t => t.kind === 'listing-description');
  if (!packs.length) {
    host.querySelector('.modal').innerHTML = `<h3>${icon('upload')} Description Builder</h3>
      <p class="modal-sub">No listing-description templates found. Serve <code>/templates/catalog.json</code>.</p>
      <div class="app-btn-row" style="margin-top:14px">
        <a class="app-btn ghost" href="/templates.html" target="_blank">Open catalog page</a>
        <button class="app-btn ghost" id="dbClose">Close</button>
      </div>`;
    host.querySelector('#dbClose').onclick = () => host.remove();
    return;
  }

  let selectedId = packs[0].id;
  const values = {};
  function selected() { return packs.find(m => m.id === selectedId) || packs[0]; }
  function seedValues(t) {
    Object.keys(values).forEach(k => delete values[k]);
    (t.variables || []).forEach(v => { values[v.key] = v.example || ''; });
  }
  seedValues(selected());

  function paint() {
    const t = selected();
    const filled = fillTemplateBody(t.body || '', values);
    host.querySelector('.modal').innerHTML = `
      <h3>${icon('upload')} Description Builder</h3>
      <p class="modal-sub">${esc(t.summary || 'Listing HTML template')}. ${packs.length} styles ready.</p>
      <label>Style</label>
      <select id="dbPick">${packs.map(m => `<option value="${esc(m.id)}" ${m.id === t.id ? 'selected' : ''}>${esc(m.title)}</option>`).join('')}</select>
      <div style="display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:12px;margin-top:12px">
        <div>
          <label>Variables</label>
          <div style="display:grid;gap:8px;margin-top:6px;max-height:46vh;overflow:auto;padding-right:4px">
            ${(t.variables || []).map(v => `
              <label style="text-transform:none;letter-spacing:0;font-size:12px;color:rgba(255,255,255,.45)">${esc(v.label || v.key)}
                <input data-dbvar="${esc(v.key)}" value="${esc(values[v.key] || '')}" placeholder="${esc(v.example || '')}" style="margin-top:4px">
              </label>`).join('') || '<div style="color:rgba(255,255,255,.35);font-size:12px">No variables</div>'}
          </div>
        </div>
        <div>
          <label>Live preview</label>
          <div id="dbPreview" style="margin-top:6px;max-height:46vh;overflow:auto;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:#fff;color:#111;padding:10px"></div>
        </div>
      </div>
      <div class="app-btn-row" style="margin-top:16px">
              <button class="app-btn" id="dbCopy">${icon('refresh')} Copy HTML</button>
              <button class="app-btn ghost" id="dbRemix">Remix note</button>
              <a class="app-btn ghost" href="/templates.html" target="_blank">Full catalog</a>
              <button class="app-btn ghost" id="dbClose">Close</button>
            </div>`;

          const preview = host.querySelector('#dbPreview');
          if (preview) preview.innerHTML = filled;

          host.querySelector('#dbPick').onchange = (e) => { selectedId = e.target.value; seedValues(selected()); paint(); };
          host.querySelectorAll('[data-dbvar]').forEach(inp => {
            inp.oninput = () => {
              values[inp.dataset.dbvar] = inp.value;
              if (preview) preview.innerHTML = fillTemplateBody(selected().body || '', values);
            };
          });
          host.querySelector('#dbCopy').onclick = async () => {
            const text = fillTemplateBody(selected().body || '', values);
            try {
              await navigator.clipboard.writeText(text);
              showToast('HTML copied — paste into your listing description.', 'success');
              playSfx('confirm');
            } catch {
              showToast('Clipboard blocked — open Full catalog and copy from there.', 'info');
            }
          };
          host.querySelector('#dbRemix').onclick = () => {
            showToast('Open Full catalog → Remix tab for 3 HTML variants.', 'info');
            window.open('/templates.html', '_blank');
          };
          host.querySelector('#dbClose').onclick = () => host.remove();
        }

        paint();
      }

// Run a single tool by its tier (tool cards + recommendation buttons).
//   live → dispatch to the extension · hub → open Seller Hub · todo → flag as unbuilt
//   messages → open local Message Tool (template library)
//   description → open local Description Builder (template library)
function runTool(key, tier) {
  if (key === 'lister') { openListerOverlay(); return; } // Lister always opens the BulkLister overlay
  if (key === 'messages') { openMessageTool(); return; }
  if (key === 'description') { openDescriptionBuilder(); return; }
  const mod = WORKFLOW.flatMap(s => s.modules).find(m => m.key === key);
  tier = tier || toolTier(key);
  if (tier === 'todo') { showToast(`${mod?.label || 'This tool'} isn't wired yet — it's on the build list.`, 'info'); return; }
  if (tier === 'live') {
    if (!ext.installed) { showToast('Install the Syndrax extension on this device to run jobs.', 'error'); return; }
    if (mod && mod.run === 'lister') { configuring = 'bulklister'; openScriptModal(); }
    else if (mod) dispatch(mod.run || mod.key, mod.label, {});
    return;
  }
  const url = MODULE_EBAY_URL[key];
  if (url) { window.open(url, '_blank'); showToast(`Opening ${mod?.label || 'tool'} in Seller Hub…`, 'info'); }
}

// ── Automation Builder — chain tools into one custom workflow ────────────────
// seed: a tool key (start with that step) OR { steps, name, autorun } to reopen/run.
function openAutomationBuilder(seed) {
  let steps, presetName = '', autorun = false;
  if (seed && typeof seed === 'object') { steps = (seed.steps || []).slice(); presetName = seed.name || ''; autorun = !!seed.autorun; }
  else { steps = seed ? [seed] : []; }
  const mk = wsTarget ? wsTarget.marketplace : 'ebay';
  const mkName = marketplace(mk)?.name || mk;
  const allMods = WORKFLOW.flatMap(s => s.modules);
  const modOf = k => allMods.find(m => m.key === k);

  const host = document.createElement('div');
  host.className = 'modal-bg';
  host.onclick = () => host.remove();
  document.body.appendChild(host);

  function canvasHtml() {
    if (!steps.length) return `<div style="text-align:center;color:rgba(255,255,255,0.35);font-size:12.5px;padding:20px;border:1px dashed rgba(255,255,255,.12);border-radius:12px">No steps yet — add tools below to build your workflow.</div>`;
    return `<div class="wfb-canvas">${steps.map((k, i) => {
      const m = modOf(k); const tier = toolTier(k);
      return `<div class="wfb-step"><div class="wfb-node" data-i="${i}">
        <span class="wfb-num">${i + 1}</span>
        <div class="wfb-info"><div class="wfb-name">${esc(m?.label || k)} <span class="sc-state ${tier}">${tier}</span></div><div class="wfb-desc">${esc(m?.desc || '')}</div></div>
        <button class="wfb-del" data-del="${i}" title="Remove step">✕</button>
      </div></div>${i < steps.length - 1 ? '<div class="wfb-connector"></div>' : ''}`;
    }).join('')}</div>`;
  }

  function paint() {
    host.innerHTML = `<div class="modal builder" onclick="event.stopPropagation()">
      <h3>${icon('bot')} Automation Builder</h3>
      <p class="modal-sub">Chain tools into one workflow — it runs each step in order with the audit agent keeping the account safe. Scoped to <b style="color:rgba(255,255,255,0.55)">${esc(wsTarget?.label || mkName)}</b>.</p>
      <div id="wfbCanvas">${canvasHtml()}</div>
      <select id="wfbPick" style="margin-top:10px">${'<option value="">+ Add a step…</option>' + WORKFLOW.map(s => `<optgroup label="${esc(s.stage)}">${s.modules.map(m => `<option value="${m.key}">${esc(m.label)} · ${toolTier(m.key)}</option>`).join('')}</optgroup>`).join('')}</select>
      <label>Workflow name</label>
      <input id="wfbName" placeholder="e.g. Daily restock + reprice" value="${esc(presetName)}">
      <label style="display:flex;align-items:center;gap:8px;margin-top:12px;text-transform:none;letter-spacing:0;font-size:13px;color:rgba(255,255,255,0.55)"><input type="checkbox" id="wfbAudit" checked style="width:auto;accent-color:#d4d4d4"> Run the audit agent before each step (keeps the account human &amp; safe)</label>
      <label>Schedule (optional)</label>
      <select id="wfbInt"><option value="Manual">Run manually</option><option>Every hour</option><option>Every 6 hours</option><option>Daily</option><option>Weekly</option></select>
      <div class="app-btn-row" style="margin-top:16px">
        <button class="app-btn" id="wfbRun">${icon('play')} Run workflow</button>
        <button class="app-btn ghost" id="wfbSave">${icon('refresh')} Save automation</button>
        <button class="app-btn ghost" id="wfbClose">Close</button>
      </div>
    </div>`;
    wire();
  }

  function wire() {
    $('#wfbClose', host).onclick = () => host.remove();
    const pick = $('#wfbPick', host);
    if (pick) pick.onchange = () => { if (pick.value) { presetName = $('#wfbName', host).value; steps.push(pick.value); paint(); playSfx('nav'); } };
    host.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { presetName = $('#wfbName', host).value; steps.splice(+b.dataset.del, 1); paint(); });
    $('#wfbSave', host).onclick = () => {
      if (!steps.length) { showToast('Add at least one step first.', 'error'); return; }
      const name = ($('#wfbName', host).value || (modOf(steps[0])?.label || 'Custom') + ' workflow').trim();
      automations.push({ id: 'wf-' + Date.now().toString(36), label: name, marketplace: mk, steps: steps.slice(), interval: $('#wfbInt', host).value || 'Manual', auditAgent: $('#wfbAudit', host).checked });
      saveAutomations(); host.remove(); showToast('Automation saved.', 'success');
      if (activeTab === 'workspace') renderWorkspace();
    };
    $('#wfbRun', host).onclick = () => { if (!steps.length) { showToast('Add at least one step first.', 'error'); return; } animateWorkflowRun(steps, host); };
  }

  paint();
  if (autorun && steps.length) setTimeout(() => animateWorkflowRun(steps, host), 350);
}

// Visual run-through: light each step in turn (spinner → ✓) with a flowing connector
// and a tick sound; dispatch any LIVE step to the extension along the way.
async function animateWorkflowRun(steps, host) {
  const nodes = host.querySelectorAll('.wfb-node');
  const conns = host.querySelectorAll('.wfb-connector');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const allMods = WORKFLOW.flatMap(s => s.modules);
  for (let i = 0; i < steps.length; i++) {
    const node = nodes[i]; if (!node) continue;
    node.classList.add('running');
    const num = node.querySelector('.wfb-num'); if (num) num.innerHTML = '<span class="wfb-spin"></span>';
    if (i > 0 && conns[i - 1]) conns[i - 1].classList.add('flow');
    playSfx('nav');
    const tier = toolTier(steps[i]); const mod = allMods.find(m => m.key === steps[i]);
    if (tier === 'live' && ext.installed && mod && mod.run !== 'lister') { try { dispatch(mod.run || mod.key, mod.label, {}); } catch {} }
    await sleep(950);
    node.classList.remove('running'); node.classList.add('done');
    if (num) num.textContent = '✓';
    if (i > 0 && conns[i - 1]) conns[i - 1].classList.remove('flow');
  }
  playSfx('confirm');
  showToast('Workflow finished.', 'success');
}

// Lister → open the REAL BulkLister as an overlay over the workspace. bulklister.html
// is a web-accessible resource of the extension, so we embed the actual page (exact
// copy, no drift). Falls back to an install prompt if the extension isn't present.
function openListerOverlay() {
  const extId = ext.id || EXT_IDS[0];
  const host = document.createElement('div');
  host.className = 'lister-overlay';
  host.innerHTML = `
    <div class="lister-frame" onclick="event.stopPropagation()">
      <div class="lister-bar">
        <div class="lb-title">${icon('upload')} Lister — BulkLister workspace</div>
        <button class="app-btn ghost sm" id="loClose">${icon('x')} Close</button>
      </div>
      <div class="lister-body">
        ${ext.installed
          ? `<iframe src="chrome-extension://${extId}/bulklister.html" title="BulkLister" allow="clipboard-read; clipboard-write"></iframe>`
          : `<div class="lo-missing">${icon('monitor')}<h3>Extension not detected</h3><p>The BulkLister runs inside the Syndrax extension. Install or reload it on this device, then reopen the Lister.</p><button class="app-btn sm" data-go="devices">Set up device</button></div>`}
      </div>
    </div>`;
  host.onclick = () => host.remove();
  document.body.appendChild(host);
  $('#loClose', host).onclick = () => host.remove();
  const go = host.querySelector('[data-go]');
  if (go) go.onclick = () => { host.remove(); activeTab = 'devices'; renderShell(); };
  playSfx('confirm');
}

// Advanced sub-tool settings (e.g. SEO / Description / Images feed the Lister).
// Stores per-tool config in localStorage and can run the tool if it's wired.
function loadToolCfg() { try { return JSON.parse(localStorage.getItem('syndrax_tool_cfg')) || {}; } catch { return {}; } }
function openToolSettings(key) {
  if (key === 'messages') { openMessageTool(); return; }
  if (key === 'description') { openDescriptionBuilder(); return; }
  const mod = WORKFLOW.flatMap(s => s.modules).find(m => m.key === key); if (!mod) return;
  const parent = ADV_PARENT[key] || 'workflow';
  const cfg = loadToolCfg(); const c = cfg[key] || { enabled: true, rules: '' };
  const tier = toolTier(key);
  const host = document.createElement('div');
  host.className = 'modal-bg';
  host.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <h3>${icon('refresh')} ${esc(mod.label)} settings</h3>
      <p class="modal-sub">${esc(mod.desc)}. Feeds the <b style="color:rgba(255,255,255,0.55)">${esc(parent)}</b> step${tier === 'todo' ? ' — runner still being built.' : '.'}</p>
      <label style="display:flex;align-items:center;gap:8px;text-transform:none;letter-spacing:0;font-size:13px;color:rgba(255,255,255,0.55)"><input type="checkbox" id="tsEnabled" ${c.enabled ? 'checked' : ''} style="width:auto;accent-color:#d4d4d4"> Use ${esc(mod.label)} when ${esc(parent)} runs</label>
      <label>Rules / preferences (optional)</label>
      <textarea id="tsRules" rows="3" placeholder="e.g. titles under 80 chars · 8 images max · markup 1.35x">${esc(c.rules || '')}</textarea>
      <div class="app-btn-row" style="margin-top:14px">
        ${tier !== 'todo' ? `<button class="app-btn" id="tsRun">${icon('play')} Run ${esc(mod.label)} now</button>` : ''}
        <button class="app-btn ghost" id="tsSave">${icon('refresh')} Save settings</button>
        <button class="app-btn ghost" id="tsClose">Close</button>
      </div>
    </div>`;
  host.onclick = () => host.remove();
  document.body.appendChild(host);
  $('#tsClose', host).onclick = () => host.remove();
  $('#tsSave', host).onclick = () => { cfg[key] = { enabled: $('#tsEnabled', host).checked, rules: $('#tsRules', host).value }; try { localStorage.setItem('syndrax_tool_cfg', JSON.stringify(cfg)); } catch {} host.remove(); showToast(`${mod.label} settings saved.`, 'success'); };
  const run = $('#tsRun', host); if (run) run.onclick = () => { host.remove(); runTool(key, tier); };
}

function jobRow(j) {
  const pct = j.progress && j.progress.total ? Math.round((j.progress.listed + j.progress.errors) / j.progress.total * 100) : 0;
  return `<button class="job-row ${selectedJobId === j.jobId ? 'sel' : ''}" data-job="${j.jobId}">
    <div class="job-top">
      <span class="job-title">${icon('briefcase')} ${esc(j.scriptLabel)} <span class="on">on ${esc(j.deviceName)}</span></span>
      <span class="jb ${j.status}">${j.status.toUpperCase()}</span>
    </div>
    <div class="job-sub"><span>${j.progress ? `${j.progress.listed}/${j.progress.total} listed` : esc(j.message || '—')}</span><span>${timeAgo(j.createdAt)}</span></div>
    ${j.progress && j.progress.total ? `<div class="job-bar"><i style="width:${pct}%"></i></div>` : ''}
  </button>`;
}

function jobDetail(j) {
  return `<div style="display:flex;flex-direction:column;gap:14px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <h3 style="font:700 15px var(--nav-font);color:#f1f5f9;margin:0">${esc(j.scriptLabel)} on ${esc(j.deviceName)}</h3>
      <span class="jb ${j.status}">${j.status.toUpperCase()}</span>
    </div>
    <div class="job-log">
      <div class="panel-h" style="margin-bottom:8px">Job log</div>
      ${j.log.map(l => `<div class="ln"><span class="t">${new Date(l.t).toLocaleTimeString()}</span><span>${esc(l.text)}</span></div>`).join('')}
    </div>
  </div>`;
}

// ── job dispatch (to the extension = backend) ──────────────────────────────────
function dispatch(script, scriptLabel, args) {
  const mk = wsTarget ? wsTarget.marketplace : 'ebay';
  const mkName = marketplace(mk)?.name || mk;
  const jobId = 'job-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  const job = {
    jobId, script, scriptLabel: `${scriptLabel} → ${mkName}`, deviceName: 'This PC', marketplace: mk,
    status: 'dispatched', createdAt: Date.now(), updatedAt: Date.now(),
    progress: null, message: '', log: [{ t: Date.now(), text: `dispatched to this device · target ${mkName} (${wsTarget?.label || '—'})` }],
  };
  jobs.unshift(job); saveJobs(); selectedJobId = jobId; configuring = null; renderWorkspace();

  // Non-live marketplaces: don't fake it — mark the job as building.
  if (!LIVE_MARKETPLACES.includes(mk)) {
    patchJob(jobId, 'no-device', `${mkName} sync is still being built — eBay is live today.`);
    return;
  }

  const extId = ext.id || EXT_IDS[0];
  if (window.chrome && chrome.runtime && chrome.runtime.sendMessage && ext.installed) {
    chrome.runtime.sendMessage(extId, { type: 'SYNDRAX_RUN', script, marketplace: mk, args: { ...args, marketplace: mk, account: wsTarget?.label }, jobId }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.ok) {
        patchJob(jobId, 'error', (resp && resp.error) || (chrome.runtime.lastError && 'extension unavailable') || 'extension did not accept the job');
      } else {
        patchJob(jobId, 'accepted', 'accepted — running in the Syndrax extension on this device');
      }
    });
  } else {
    patchJob(jobId, 'no-device', 'Install the Syndrax extension on this device to run jobs.');
  }
}

function patchJob(jobId, status, line) {
  const j = jobs.find(x => x.jobId === jobId); if (!j) return;
  j.status = status; j.updatedAt = Date.now(); j.message = line;
  j.log.push({ t: Date.now(), text: line });
  saveJobs(); if (activeTab === 'workspace') renderWorkspace();
}

// ── script config modal (BulkLister) ─────────────────────────────────────────
function openScriptModal() {
  if (configuring !== 'bulklister') { configuring = null; return; }
  const host = document.createElement('div');
  host.className = 'modal-bg'; host.id = 'scriptModal';
  host.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <h3>${icon('upload')} Run Lister → ${esc(marketplace(wsTarget?.marketplace)?.name || 'eBay')}</h3>
      <p class="modal-sub">Listing to <b style="color:rgba(255,255,255,0.55)">${esc(wsTarget?.label || 'your account')}</b> on ${esc(marketplace(wsTarget?.marketplace)?.name || 'eBay')}. Paste source URLs or product IDs — the Lister adapts to this marketplace and runs via the extension on this device.</p>
      <label>Amazon URLs or ASINs</label>
      <textarea id="bArgs" rows="5" placeholder="B00RW5OWLE&#10;https://amazon.com/dp/B0..." style="font-family:ui-monospace,monospace;font-size:12px"></textarea>
      <div class="modal-row">
        <div><label>Threads</label><input id="bThreads" type="number" value="3" min="1" max="30"></div>
        <div><label>Markup %</label><input id="bMarkup" type="number" value="100" min="10"></div>
        <div><label>Listing type</label><select id="bType"><option value="opti">Opti-List</option><option value="rival">Rival-List</option><option value="chat">Chat</option><option value="seo">SEO</option></select></div>
      </div>
      <div class="app-btn-row" style="margin-top:18px">
        <button class="app-btn" id="bRun">${icon('play')} Launch job</button>
        <button class="app-btn ghost" id="bCancel">Cancel</button>
      </div>
    </div>`;
  host.onclick = () => host.remove();
  document.body.appendChild(host);
  $('#bCancel', host).onclick = () => host.remove();
  $('#bRun', host).onclick = () => {
    const asins = $('#bArgs', host).value;
    const count = (asins.match(/\b[A-Z0-9]{10}\b/gi) || []).length;
    if (!count) { $('#bArgs', host).style.borderColor = '#f87171'; return; }
    const args = {
      asins, threads: +$('#bThreads', host).value || 3, markupPct: +$('#bMarkup', host).value || 100,
      listingType: $('#bType', host).value, minPrice: 0, maxPrice: 0, fbaOnly: false,
    };
    host.remove();
    dispatch('bulklister', 'Lister', args);
  };
}

// ── ACCOUNTS ──────────────────────────────────────────────────────────────────
async function renderAccounts() {
  $('#topSub').textContent = `· ${accounts.length} connected`;
  const limit = PLAN_LIMITS[plan]?.maxAccountsPerMarketplace;
  const counts = {}; accounts.forEach(a => counts[a.marketplace] = (counts[a.marketplace] || 0) + 1);
  const audit = runAudit(buildAuditInput());
  const nodesInUse = new Set(accounts.map(a => a.nodeId || a.deviceId).filter(Boolean)).size;
  const connected = accounts.filter(a => a.status !== 'disconnected').length;

  // Compute real trust stages in parallel (pulls eBay telemetry per account)
  const trustStages = {};
  await Promise.all(accounts.map(async a => {
    trustStages[a.id] = await computeTrustStage(a);
  }));

  function acctRow(a) {
    const m = marketplace(a.marketplace);
    const trust = trustStages[a.id];
    const logo = marketplaceLogo(a.marketplace) || `<span style="font:800 12px var(--nav-font);color:var(--text-1)">${(m?.name || '?')[0]}</span>`;
    const nodeN = cloudNodes.find(x => String(x.id) === String(a.nodeId)) || cloudNodes.find(x => x.deviceId === a.deviceId);
    const nodeName = nodeN ? (nodeN.name || nodeN.deviceId) : (a.deviceId && a.deviceId !== 'this-device' ? a.deviceId : 'This PC');
    const nodeType = nodeN?.nodeType || (a.deviceId && a.deviceId !== 'this-device' ? 'remote' : 'current');
    const nodeTagClass = nodeType === 'current' ? 'success' : nodeType === 'rdp' ? 'info' : '';
    const nodeTagLabel = nodeType === 'current' ? 'This PC' : nodeType === 'rdp' ? 'RDP' : 'Remote';
    const ip = nodeN?.ip || '–';
    // AXIS risk meter: combines IP intel (residential/cellular/VPN) with
    // cross-contamination detection (IP sharing, persona overlap, dup labels).
    // Full IP never reaches the browser — only the derived risk band + reasons.
    const riskChip = (() => {
      const axis = a.axisRisk;          // low | medium | high (cross-contam + IP)
      const ipHigh = a.ipProxy || a.ipHosting || a.ipRisk === 'high';
      const ipMed = a.ipMobile || a.ipRisk === 'medium';
      const ipLabel = ipHigh ? (a.ipProxy ? 'VPN/Proxy' : 'Datacenter') : ipMed ? 'Cellular' : 'Residential';
      const ipCol = ipHigh ? 'var(--red)' : ipMed ? 'var(--amber)' : 'var(--mint)';
      if (!axis && !ipHigh && !ipMed) return '';
      // AXIS cross-contamination chip (amber/red) — the "risk meter"
      const axCol = axis === 'high' ? 'var(--red)' : axis === 'medium' ? 'var(--amber)' : '';
      const axChip = axis && axis !== 'low' ? `<span class="badge" style="font-size:9px;background:${axCol}1f;color:${axCol};border:1px solid ${axCol}55" title="${esc((a.axisRiskReasons||[]).join('; '))}">⚠ AXIS ${axis}</span>` : '';
      // IP-type chip (the network signal)
      const ipChip = `<span class="badge" style="margin-left:6px;font-size:9px;background:${ipCol}1f;color:${ipCol};border:1px solid ${ipCol}55" title="${a.ipIsp ? esc(a.ipIsp).slice(0,28) : ''}${a.ipCountry ? ' · '+esc(a.ipCountry) : ''}">${ipHigh?'⚠ ':''}${ipLabel}</span>`;
      return axChip + ipChip;
    })();
    // REAL trust stage from eBay telemetry (replaces the fake checkbox)
    const stageLabel = trust?.label || '—';
    const stageClass = trust?.stage === 'established' ? 'success' : trust?.stage === 'building' ? 'warning' : '';
    const stageDetail = trust?.hasTelemetry
      ? `${trust.metrics.map(met => `${met.label}: ${met.value}`).join(' · ')}`
      : 'No telemetry yet';

    const storeUrl = a.storeUrl || a.store_url || '';
    const acctAddons = addons.filter(x => String(x.accountId) === String(a.id));
    return `<tr>
      <td>
        <div class="cell-main">
          <div class="logo-box">${logo}</div>
          <div>
            <div style="font-weight:700;color:var(--text-1);font-size:12px">${esc(a.label || m?.name || a.marketplace)}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:2px">${esc(m?.name || a.marketplace)}${storeUrl ? ` &middot; <a href="${esc(storeUrl)}" target="_blank" rel="noopener" style="color:var(--blue)">store&nbsp;&#8599;</a>` : ''}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-size:11px;color:var(--text-2);font-weight:600">${esc(nodeName)}</div>
        <span class="badge ${nodeTagClass}" style="margin-top:4px;display:inline-block;font-size:9px">${nodeTagLabel}</span>
      </td>
      <td style="font-family:var(--mono,monospace);font-size:10.5px;color:var(--text-muted);letter-spacing:.03em">${a.ipLast3 ? `<span title="Device-bound IP — masked for privacy (AXIS audit protection)" style="opacity:.9">&bull;&bull;&bull;.&bull;&bull;&bull;.&bull;&bull;&bull;.${esc(a.ipLast3)}</span>${riskChip}` : esc(ip)}${riskChip}</td>
      <td><span class="badge ${stageClass}" title="${esc(stageDetail)}">${stageLabel}</span><div style="font-size:9px;color:var(--text-muted);margin-top:3px;line-height:1.4;max-width:160px">${esc(stageDetail)}</div></td>
      <td style="color:var(--text-muted);font-size:11px">${a.lastSync ? new Date(a.lastSync).toLocaleString() : '&ndash;'}</td>
      <td>
        <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
          ${acctAddons.map(x => { const ad = addon(x.addonType); return `<span class="badge info" style="font-size:9px;gap:4px">${esc(ad?.name || x.addonType)}<button class="auto-del" data-deladdon="${x.id}" title="Remove add-on" style="background:none;border:none;color:inherit;cursor:pointer;padding:0;line-height:1">&#10005;</button></span>`; }).join('')}
          <button class="btn ghost small" data-addaddon="${a.id}" title="Add marketing add-on" style="padding:0 8px;min-height:26px">${icon('plus')}</button>
          <button class="btn ghost small" data-remove-acct="${a.id}" title="Remove account" style="padding:0 8px;min-height:26px;color:var(--coral);border-color:rgba(255,107,120,.2)">${icon('trash')}</button>
        </div>
      </td>
    </tr>`;
  }

  const tableBody = accounts.length
    ? accounts.map(acctRow).join('')
    : `<tr><td colspan="6" style="text-align:center;padding:48px 20px;color:var(--text-muted)">No accounts connected — use the marketplace library below to connect your first account.</td></tr>`;

  $('#content').innerHTML = `
    <div class="page">
      <div class="page-head">
        <div class="page-identity">
          <span class="page-kicker">Accounts</span>
          <h2>Connected accounts</h2>
          <p>Marketplace accounts assigned to your workspace nodes</p>
        </div>
        <div class="page-actions">
          ${accounts.some(a => a.marketplace === 'ebay') ? `<button class="btn secondary small" id="ebaySync">${icon('refresh')} Sync eBay</button>` : ''}
        </div>
      </div>

      <div class="mk-deco-strip">
        ${['ebay','amazon','walmart','etsy','shopify','tiktok','woocommerce'].map((mk, i) =>
          `<img src="assets/icons/marketplaces/${mk}.svg" class="mk-deco-icon" alt="${mk}" style="animation-delay:${i * 0.28}s">`
        ).join('')}
      </div>

      <div class="summary-strip">
        <div class="summary-cell"><span>Total accounts</span><strong>${accounts.length}</strong></div>
        <div class="summary-cell"><span>Connected</span><strong>${connected}</strong><small>${accounts.length - connected > 0 ? `${accounts.length - connected} issue${accounts.length - connected === 1 ? '' : 's'}` : 'All healthy'}</small></div>
        <div class="summary-cell"><span>Nodes in use</span><strong>${nodesInUse || (accounts.length ? 1 : 0)}</strong></div>
        <div class="summary-cell"><span>Per marketplace</span><strong>${isUnlimited(limit) ? '&#8734;' : limit}</strong><small>${PLAN_LABEL[plan]}</small></div>
      </div>

      ${(audit.findings || []).length ? `<div class="card" style="border-color:rgba(251,191,36,.22);background:rgba(251,191,36,.04);margin-bottom:16px">
        <div class="card-header">
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" style="flex-shrink:0"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span style="color:#fbbf24;font-weight:700;font-size:13px">${audit.findings.length} account-safety note${audit.findings.length === 1 ? '' : 's'}</span>
        </div>
        <div class="card-body" style="padding-top:4px">
          ${audit.findings.map(f => `<div style="padding:10px 0;border-bottom:1px solid var(--line)">
            <div style="font-weight:700;color:var(--amber);font-size:12px">${esc(f.title)}</div>
            <div style="color:var(--text-muted);font-size:11px;margin-top:3px;line-height:1.5">${esc(f.detail)}</div>
            ${f.upgradeTo ? `<button class="btn secondary small" data-up="${f.upgradeTo}" style="margin-top:8px">Upgrade to ${PLAN_LABEL[f.upgradeTo]}</button>` : ''}
          </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="card table-card" style="margin-bottom:24px">
        <div class="card-header">
          <span style="font-weight:700;color:var(--text-1)">Connected accounts</span>
          <span style="font-size:11px;color:var(--text-muted)">${accounts.length} account${accounts.length === 1 ? '' : 's'} &middot; ${isUnlimited(limit) ? 'unlimited' : `${limit} per marketplace`} on ${PLAN_LABEL[plan]}</span>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Node</th>
                <th>IP</th>
                <th>Trust stage</th>
                <th>Last sync</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>${tableBody}</tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span style="font-weight:700;color:var(--text-1)">Marketplace library</span>
          <span style="font-size:11px;color:var(--text-muted)">Connect a marketplace to add accounts</span>
        </div>
        <div class="card-body">
          <div class="mk-grid big" style="margin:0">${MARKETPLACES.map(m => acctTile(m, counts[m.id] || 0, limit)).join('')}</div>
        </div>
      </div>
    </div>`;

  $('#content').querySelectorAll('[data-connect]').forEach(b => b.onclick = () => { connecting = b.dataset.connect; openConnectModal(); });
  $('#content').querySelectorAll('[data-up]').forEach(b => b.onclick = () => startCheckout(b.dataset.up).catch(e => showAlert(e.message)));
  $('#content').querySelectorAll('[data-est]').forEach(b => b.onclick = () => { toggleEstablished(b.dataset.est); });
  $('#content').querySelectorAll('[data-addaddon]').forEach(b => b.onclick = () => openAddonModal(b.dataset.addaddon));
  $('#content').querySelectorAll('[data-deladdon]').forEach(b => b.onclick = async () => {
    try { await removeAddon(b.dataset.deladdon); addons = addons.filter(x => String(x.id) !== String(b.dataset.deladdon)); renderAccounts(); }
    catch (e) { showAlert(e.message || 'Could not remove add-on.'); }
  });
  // Remove marketplace account (instant delete, no confirmation)
  $('#content').querySelectorAll('[data-remove-acct]').forEach(b => b.onclick = async () => {
    try { await removeMarketplaceAccount(b.dataset.removeAcct); accounts = accounts.filter(x => String(x.id) !== String(b.dataset.removeAcct)); renderShell(); }
    catch (e) { showAlert(e.message || 'Could not remove account.'); }
  });
  const es = $('#ebaySync'); if (es) es.onclick = openSyncModal;
}

// Attach a marketing add-on to a marketplace account (account-level) — Facebook
// Ads, Pinterest auto-post, etc. Persisted server-side via /api/addons.
function openAddonModal(accountId) {
  const a = accounts.find(x => String(x.id) === String(accountId)); if (!a) return;
  const m = marketplace(a.marketplace);
  const choices = ADDONS.filter(ad => ad.scope === 'account' || ad.scope === 'both');
  const host = document.createElement('div');
  host.className = 'modal-bg';
  host.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <h3>${icon('plus')} Add a marketing add-on</h3>
      <p class="modal-sub">Promote <b style="color:rgba(255,255,255,0.55)">${esc(a.label || m?.name || a.marketplace)}</b>. Add-ons run alongside this account on its node.</p>
      <div class="mk-grid" style="grid-template-columns:repeat(2,1fr);gap:10px;margin-top:6px">
        ${choices.map(ad => `<button class="mk-tile" data-addon="${ad.id}" style="text-align:left;padding:12px">
          <span class="mk-badge ${ad.status === 'live' ? 'live' : 'soon'}">${ad.status === 'live' ? 'Live' : 'Soon'}</span>
          <div class="mk-name" style="margin-top:2px">${esc(ad.name)}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:4px">${esc(ad.blurb)}</div>
        </button>`).join('')}
      </div>
      <div class="app-btn-row" style="margin-top:16px"><button class="app-btn ghost" id="adCancel">Close</button></div>
    </div>`;
  host.onclick = () => host.remove();
  document.body.appendChild(host);
  $('#adCancel', host).onclick = () => host.remove();
  host.querySelectorAll('[data-addon]').forEach(b => b.onclick = async () => {
    const ad = addon(b.dataset.addon);
    try {
      const rec = await addAddon({ addonType: ad.id, accountId: a.id, nodeId: a.nodeId || null, label: ad.name });
      addons.push(rec); host.remove(); renderAccounts();
      showToast(`${ad.name} added to ${a.label || m?.name}. ${ad.status === 'soon' ? 'Activates when this add-on ships.' : ''}`, 'success');
    } catch (e) { showAlert(e.message || 'Could not add add-on.'); }
  });
}

function acctTile(m, n, limit) {
  const logo = marketplaceLogo(m.id) || `<span style="font:800 18px var(--nav-font);color:#fff">${m.name[0]}</span>`;
  const over = !isUnlimited(limit) && n >= limit;
  const badge = m.access === 'gated' ? ['gated', 'Gated'] : m.status === 'live' ? ['live', 'Live'] : m.status === 'beta' ? ['beta', 'Beta'] : ['soon', 'Soon'];
  const canAdd = m.access !== 'source';
  return `<div class="mk-tile big${n ? ' selected' : ''}">
    <span class="mk-badge ${badge[0]}">${badge[1]}</span>
    ${n ? '<span class="mk-check">✓</span>' : ''}
    <span class="mk-chip neutral">${logo}</span>
    <div class="mk-name">${m.name}</div>
    ${n ? `<div class="mk-count" style="${over ? 'color:#fcd34d' : ''}">${n}${isUnlimited(limit) ? '' : ' / ' + limit} account${n === 1 ? '' : 's'}</div>` : ''}
    ${canAdd ? `<button class="app-btn sm ghost" data-connect="${m.id}" style="margin-top:8px" ${over ? 'disabled title="Plan limit reached — upgrade"' : ''}>${icon('plus')} ${n ? 'Add' : 'Connect'}</button>` : `<div class="mk-status">Sourcing</div>`}
  </div>`;
}

// Node picker + "connect existing vs create new" — shown in every connect modal
// so each account is pinned to a node (the PC you're on, or a remote/RDP machine)
// and records whether you're linking an existing account or starting a guided new
// one (which uses the LLC/EIN already captured in your profile). State lives on the
// modal's host element so the connect handler can read it.
function connectExtrasHtml(cn, opts2 = {}) {
  const opts = cloudNodes.length
    ? cloudNodes.map(n => {
        const tag = n.nodeType === 'current' ? ' (This PC)' : n.nodeType === 'rdp' ? ' (RDP)' : ' (Remote)';
        const sel = String(n.id) === String(cn.nodeId) ? ' selected' : '';
        return `<option value="${esc(n.id)}"${sel}>${esc(n.name || n.deviceId)}${tag}</option>`;
      }).join('')
    : `<option value="">This PC</option>`;
  // For OAuth marketplaces (eBay), "Create a new one" is disabled — the API
  // connect flow only links existing stores. Account section is hidden entirely.
  const hideAccountMode = opts2.oauthOnly;
  return `
    <div class="connect-extras" style="display:grid;gap:12px;margin-bottom:14px;padding:12px;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.02)">
      <div>
        <label style="margin:0 0 6px">Which device runs this account?</label>
        <select id="cNode">${opts}</select>
        <div style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:4px">Each account stays on its own device/IP — that's how Syndrax avoids linked-account restrictions.</div>
      </div>
      ${hideAccountMode ? '' : `
      <div>
        <label style="margin:0 0 6px">Account</label>
        <div class="cmode-tabs" style="display:flex;gap:8px">
          <button type="button" class="method-tab on" data-cmode="existing">I already have one</button>
          <button type="button" class="method-tab" data-cmode="create_new" disabled title="Coming soon" style="opacity:.4;cursor:not-allowed">Create a new one</button>
        </div>
        <div id="cModeNote" style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:6px"></div>
      </div>`}
    </div>`;
}

function openConnectModal() {
  const m = marketplace(connecting); if (!m) return;
  const elig = m.access === 'gated' ? eligibility(m.id, { ein: profile.ein }) : null;
  const isSource = m.access === 'source';
  const isGated  = m.access === 'gated';
  const isLive   = m.status === 'live';
  const isEbayOAuth = m.id === 'ebay' && isLive; // eBay uses one-click OAuth, no manual fields
  const logo = marketplaceLogo(m.id) || `<span style="font:800 22px var(--nav-font);color:#fff">${m.name[0]}</span>`;
  const j = trustJourney(m.id);
  const cn = resolveConnectNode();

  // Mini trust phase stepper shown in the modal
  const miniSteps = j.phases.map((p, i) => `
    <div class="ctrust-step">
      <div class="ctrust-dot">${i + 1}</div>
      <div class="ctrust-info"><div class="ctrust-label">${esc(p.label)}</div><div class="ctrust-desc">${esc(p.desc)}</div></div>
    </div>`).join('<div class="ctrust-line"></div>');

  const host = document.createElement('div');
  host.className = 'modal-bg';
  host.innerHTML = `
    <div class="modal wide" onclick="event.stopPropagation()" style="padding:0;overflow:hidden">
      <div class="modal-mk-header" style="background:linear-gradient(135deg,${m.color}33 0%,${m.color}11 60%,transparent 100%);border-bottom:1px solid ${m.color}33;padding:20px 24px 16px;display:flex;align-items:center;gap:14px">
        <span class="mk-chip neutral" style="width:46px;height:46px;flex-shrink:0;border:1.5px solid ${m.color}55">${logo}</span>
        <div>
          <div style="font:800 16px var(--nav-font);color:#f1f5f9">${isSource ? 'Enable' : 'Connect'} ${esc(m.name)}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.35);margin-top:2px">${isSource ? 'Source / research mode' : isGated ? 'Requires approval' : isLive ? 'Automations live' : 'Automation building'}</div>
        </div>
        <span class="mk-badge ${m.status === 'live' ? 'live' : m.status === 'beta' ? 'beta' : 'soon'}" style="margin-left:auto">${m.status === 'live' ? 'Live' : m.status === 'beta' ? 'Beta' : 'Soon'}</span>
      </div>
      <div style="padding:20px 24px">

      ${isSource ? '' : connectExtrasHtml(cn, { oauthOnly: isEbayOAuth })}
      ${isSource ? `
        <p class="modal-sub">${esc(m.name)} is your <b style="color:rgba(255,255,255,0.55)">sourcing engine</b> — Syndrax reads it for product data, price history and winning ASINs to list on eBay, Etsy and others. Not a sell channel.</p>
        <label>Amazon region</label>
        <select id="cRegion"><option value="US">United States (amazon.com)</option><option value="UK">UK (amazon.co.uk)</option><option value="CA">Canada (amazon.ca)</option><option value="DE">Germany (amazon.de)</option></select>
        <label>Associate tag (optional)</label>
        <input id="cLabel" placeholder="yourtag-20 (for affiliate links)">
        <div class="app-btn-row" style="margin-top:18px">
          <button class="app-btn" id="cAdd">Enable ${esc(m.name)} sourcing</button>
          <button class="app-btn ghost" id="cCancel">Cancel</button>
        </div>
      ` : isGated ? `
        ${elig ? `<div class="eligibility" style="margin:0 0 16px">${esc(elig.message)}</div>` : ''}
        <label>Business EIN <span style="color:#fca5a5">(required for approval)</span></label>
        <input id="cEin" placeholder="12-3456789" value="${esc(profile.ein || '')}">
        <label>Account name / username</label>
        <input id="cLabel" placeholder="e.g. my-brand-store">
        <div class="ctrust" style="margin-top:16px">${miniSteps}</div>
        <div class="app-btn-row" style="margin-top:18px">
          <button class="app-btn" id="cAdd">Start approval journey</button>
          <button class="app-btn ghost" id="cCancel">Cancel</button>
        </div>
      ` : isEbayOAuth ? `
        <p class="modal-sub">One click connects your eBay store. Syndrax opens eBay's secure sign-in, you approve read-only access, and we automatically pull your <b style="color:rgba(255,255,255,0.55)">store name, seller standing, listings, and orders</b> — no typing needed. Works for any existing eBay account (Store or basic seller).</p>
        <div class="ctrust" style="margin-top:16px">${miniSteps}</div>
        <div class="app-btn-row" style="margin-top:18px">
          <button class="app-btn" id="cAdd">${icon('wifi')} Connect &amp; sync with eBay</button>
          <button class="app-btn ghost" id="cCancel">Cancel</button>
        </div>
      ` : `
        <p class="modal-sub">${isLive
          ? `Sign in to ${esc(m.name)} on this device — the extension runs scripts safely on your IP.`
          : `Add your ${esc(m.name)} account now. ${esc(m.name)} automation is being built — you'll be notified when scripts go live. Trust journey starts immediately.`}</p>
        <label>Username / store name</label>
        <input id="cLabel" placeholder="e.g. my-store-name">
        <label>Store URL (optional)</label>
        <input id="cUrl" placeholder="https://${m.id === 'facebook' ? 'facebook.com/marketplace' : m.id + '.com'}/your-store">
        <div class="ctrust" style="margin-top:16px">${miniSteps}</div>
        <div class="app-btn-row" style="margin-top:18px">
          <button class="app-btn" id="cAdd">${isLive ? icon('wifi') + ' Connect & sync' : icon('plus') + ' Connect account'}</button>
          <button class="app-btn ghost" id="cCancel">Cancel</button>
        </div>
      `}
      </div>
    </div>`;

  host.onclick = () => host.remove();
  document.body.appendChild(host);
  $('#cCancel', host).onclick = () => host.remove();

  // Connect-mode toggle (existing vs create-new) — create-new uses captured LLC/EIN.
  let connectMode = 'existing';
  const noteEl = $('#cModeNote', host);
  host.querySelectorAll('[data-cmode]').forEach(b => b.onclick = () => {
    connectMode = b.dataset.cmode;
    host.querySelectorAll('[data-cmode]').forEach(x => x.classList.toggle('on', x === b));
    if (noteEl) noteEl.textContent = connectMode === 'create_new'
      ? `We'll guide you through opening a fresh ${m.name} account using your business details${profile.ein ? ' (EIN on file)' : ''}.`
      : '';
  });

  $('#cAdd', host).onclick = async () => {
    const btn = $('#cAdd', host);
    const label = ($('#cLabel', host)?.value.trim()) || m.name;
    const storeUrl = ($('#cUrl', host)?.value.trim()) || '';
    const ein   = ($('#cEin',   host)?.value.trim()) || '';
    const region = ($('#cRegion', host)?.value) || 'US';
    const nodeSel = $('#cNode', host)?.value || '';
    const nodeId = nodeSel ? nodeSel : (cn.nodeId || null);
    const deviceId = (cloudNodes.find(n => String(n.id) === String(nodeId)) || {}).deviceId || cn.deviceId || 'this-device';
    if (nodeSel) { lastConnectNode = nodeSel; localStorage.setItem('syndrax_last_node', nodeSel); }
    btn.disabled = true; btn.textContent = 'Connecting…';
    try {
      // eBay (live): real OAuth 2.0 flow — redirect to eBay consent, then API
      // auto-fills store name + seller details on callback. No manual label needed.
      if (m.id === 'ebay' && isLive) {
        btn.textContent = 'Redirecting to eBay…';
        const { authUrl } = await connectEbay('new');
        window.location.href = authUrl;
        return;
      }
      const meta = isGated ? { ein } : isSource ? { region } : {};
      await addMarketplaceAccount({ marketplace: m.id, label, deviceId, nodeId, storeUrl, connectMode, ...meta });
      if (ein && isGated) { try { await saveProfile({ ein }); profile.ein = ein; } catch {} }
      const mk2 = await getMarketplaces(); accounts = mk2.accounts || [];
      host.remove();
      renderAccounts();
      if (isLive && ext.installed) {
        showToast(`${m.name} connected — starting sync…`, 'success');
        openSyncModal();
      } else if (isSource) {
        showToast(`${m.name} sourcing enabled.`, 'success');
      } else if (isGated) {
        showToast(`${m.name} application started — we'll guide you through approval.`, 'success');
      } else {
        showToast(`${m.name} connected. Automation ships soon — trust journey started.`, 'success');
      }
    } catch (e) { btn.disabled = false; btn.textContent = 'Try again'; showAlert(e.message || 'Could not connect.'); }
  };
}

// ── Full Sync (eBay compound sync: trust → inventory → finance → dashboard) ────
// Dispatches SYNDRAX_FULL_SYNC to the extension, which chains 4 scan phases and
// emits SYNDRAX_SYNC_PROGRESS events back to any open /app tab. The web side
// shows a live progress bar modal and refreshes the home chart when done.
function openSyncModal() {
  if (!ext.installed) {
    showAlert('Install the Syndrax extension on this device to run a sync.', 'error'); return;
  }
  const host = document.createElement('div');
  host.className = 'modal-bg';
  const phases = [
    { id: 'trust',     label: 'Trust scan',      icon: icon('shield') },
    { id: 'inventory', label: 'Inventory',        icon: icon('package') },
    { id: 'finance',   label: 'P&L / Finance',   icon: icon('cash') },
    { id: 'dashboard', label: 'Dashboard data',  icon: icon('chart') },
  ];
  let currentPhase = 'trust', pct = 0;

  function renderModal() {
    host.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()" style="max-width:460px">
        <h3>${icon('refresh')} Syncing eBay account</h3>
        <p class="modal-sub" style="margin-bottom:20px">Pulling trust score, live inventory, P&L and dashboard data from your eBay Seller Hub. Runs on this device.</p>
        <div class="sync-phases">${phases.map(p => `
          <div class="sync-phase ${p.id === currentPhase ? 'active' : pct >= phaseTarget(p.id) ? 'done' : ''}">
            <span class="sp-ico">${p.icon}</span>
            <span class="sp-lbl">${p.label}</span>
            ${pct >= phaseTarget(p.id) ? '<span class="sp-done">✓</span>' : ''}
          </div>`).join('')}
        </div>
        <div class="sync-bar-wrap" style="margin-top:16px">
          <div class="sync-bar"><div class="sync-fill" id="syncFill" style="width:${pct}%"></div></div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px;color:rgba(255,255,255,0.35)">
            <span id="syncDetail">Starting…</span>
            <span id="syncPct">${pct}%</span>
          </div>
        </div>
        <div class="app-btn-row" style="margin-top:18px">
          <button class="app-btn ghost sm" id="syncCancel">Cancel</button>
        </div>
      </div>`;
    $('#syncCancel', host).onclick = () => host.remove();
  }

  function phaseTarget(id) { return { trust: 25, inventory: 50, finance: 75, dashboard: 100 }[id] || 100; }

  function updateProgress(phase, p, detail) {
    currentPhase = phase; pct = p;
    const fill = $('#syncFill', host); if (fill) fill.style.width = p + '%';
    const pctEl = $('#syncPct', host); if (pctEl) pctEl.textContent = p + '%';
    const det = $('#syncDetail', host); if (det) det.textContent = detail || '';
    // Re-render phase chips
    host.querySelectorAll('.sync-phase').forEach(el => {
      const pid = el.querySelector('.sp-ico') ? phases.find(ph => el.querySelector('.sp-lbl')?.textContent === ph.label)?.id : null;
      if (!pid) return;
      el.className = `sync-phase ${pid === phase ? 'active' : pct >= phaseTarget(pid) ? 'done' : ''}`;
    });
  }

  renderModal();
  host.onclick = (e) => { if (e.target === host) host.remove(); };
  document.body.appendChild(host);

  // Listen for progress events from extension
  const onMsg = (msg) => {
    if (msg.type !== 'SYNDRAX_SYNC_PROGRESS') return;
    updateProgress(msg.phase, msg.pct || 0, msg.detail || '');
    if (msg.phase === 'complete' || msg.pct >= 100) {
      setTimeout(() => { host.remove(); showToast('eBay sync complete — dashboard updated.', 'success'); renderHome(); }, 1400);
      chrome.runtime.onMessage.removeListener(onMsg);
    }
  };
  if (window.chrome && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(onMsg);
  }

  // Dispatch SYNDRAX_FULL_SYNC to the extension
  const extId = ext.id || EXT_IDS[0];
  if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage(extId, { type: 'SYNDRAX_FULL_SYNC', marketplace: 'ebay' }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.ok) {
        host.remove();
        // If extension doesn't support FULL_SYNC yet, open eBay Seller Hub as fallback
        window.open('https://www.ebay.com/sh/overview', '_blank');
        showToast('Opening eBay Seller Hub — full sync wiring in progress.', 'info');
      }
    });
  }
}

// ── Trust / warm-up per connected account (marketplace-specific) ──────────────
function establishedSet() { try { return new Set(JSON.parse(localStorage.getItem('syndrax_established') || '[]')); } catch { return new Set(); } }
function toggleEstablished(id) {
  const s = establishedSet(); s.has(id) ? s.delete(id) : s.add(id);
  localStorage.setItem('syndrax_established', JSON.stringify([...s])); renderAccounts();
}

// Display name for the node an account/addon is pinned to.
function nodeLabel(nodeId, deviceId) {
  const n = cloudNodes.find(x => String(x.id) === String(nodeId)) || cloudNodes.find(x => x.deviceId === deviceId);
  if (n) return (n.name || n.deviceId) + (n.nodeType === 'current' ? ' · This PC' : n.nodeType === 'rdp' ? ' · RDP' : ' · Remote');
  return deviceId === 'this-device' || !deviceId ? 'This PC' : deviceId;
}

// Compute a real trust stage from eBay telemetry data — no more fake "first listing".
// Returns { stage: 'established'|'building'|'fresh', label, color, pct, metrics, unlocked }
async function computeTrustStage(account) {
  let tel = null;
  try {
    if (account.marketplace === 'ebay') tel = await getEbayTelemetry(account.id);
  } catch {}
  const age = tel?.account_age_days ?? null;       // TRUE account age
  const sold = tel?.sold_90d ?? null;              // real 90-day sales
  const listings = tel?.active_listing_count ?? null;
  const feedback = tel?.feedback_score ?? null;

  // Established: >90 days old, has sold items, has active listings, has feedback.
  // Building: some activity (listings or age) but not all signals.
  // Fresh: brand new / no real activity.
  const isEstablished = (age != null && age >= 90) && (sold != null && sold > 0) && (listings != null && listings > 0);
  const isBuilding = (age != null && age >= 14) || (listings != null && listings > 0) || (sold != null && sold > 0);

  let stage, label, color, pct, unlocked;
  if (isEstablished) {
    stage = 'established'; label = 'Established'; color = 'var(--mint)'; pct = 100; unlocked = true;
  } else if (isBuilding) {
    stage = 'building'; label = 'Building'; color = 'var(--amber)'; pct = 55; unlocked = false;
  } else {
    stage = 'fresh'; label = 'New account'; color = 'var(--coral)'; pct = 15; unlocked = false;
  }

  const fmtAge = age != null ? (age >= 365 ? `${Math.floor(age/365)}y` : `${age}d`) : '—';
  const metrics = [
    { label: 'Account age', value: fmtAge, ok: age != null && age >= 90 },
    { label: 'Sold (90d)', value: sold != null ? sold : '—', ok: sold != null && sold > 0 },
    { label: 'Active listings', value: listings != null ? listings : '—', ok: listings != null && listings > 0 },
    { label: 'Feedback', value: feedback != null ? feedback : '—', ok: feedback != null && feedback > 0 },
  ];

  return { stage, label, color, pct, unlocked, metrics, hasTelemetry: !!tel };
}

function trustCard(a, trust) {
  const m = marketplace(a.marketplace);
  const logo = marketplaceLogo(a.marketplace) || `<span style="font:800 15px var(--nav-font);color:#fff">${(m?.name || '?')[0]}</span>`;
  const acctAddons = addons.filter(x => String(x.accountId) === String(a.id));
  const storeUrl = a.storeUrl || a.store_url || '';
  const node = nodeLabel(a.nodeId, a.deviceId);

  const meta = `<div class="ac-sub" style="margin-top:3px;display:flex;gap:10px;flex-wrap:wrap">
      <span>${icon('monitor')} ${esc(node)}</span>
      ${a.connectMode === 'create_new' ? '<span style="color:#fcd34d">new account (guided)</span>' : ''}
      ${storeUrl ? `<a href="${esc(storeUrl)}" target="_blank" rel="noopener" style="color:#e5e5e5">store ↗</a>` : ''}
    </div>`;
  const addonChips = acctAddons.length
    ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">${acctAddons.map(x => { const ad = addon(x.addonType); return `<span class="acct-chip active" style="padding:4px 9px;font-size:11px"><span class="ac-name">${esc(ad?.name || x.addonType)}</span><button class="auto-del" data-deladdon="${x.id}" title="Remove" style="margin-left:6px">✕</button></span>`; }).join('')}</div>`
    : '';

  // Real trust metrics grid — computed from live eBay data (or "connect to see" if none)
  const metricsGrid = trust?.hasTelemetry
    ? `<div class="trust-metrics">${trust.metrics.map(met => `
        <div class="trust-metric ${met.ok ? 'ok' : ''}">
          <span class="tm-val" style="color:${met.ok ? 'var(--mint)' : 'var(--text-2)'}">${met.value}</span>
          <span class="tm-lbl">${met.label}</span>
        </div>`).join('')}</div>`
    : `<div class="trust-metrics trust-metrics-empty">${icon('wifi')} Syncing eBay data… real metrics appear once the first sync completes.</div>`;

  return `<div class="trust-card">
    <div class="trust-head">
      <span class="mk-chip neutral" style="width:34px;height:34px">${logo}</span>
      <div style="flex:1"><div class="ac-name">${esc(a.label || m?.name || a.marketplace)}</div><div class="ac-sub">${esc(m?.name || a.marketplace)}${trust ? ` · <span style="color:${trust.color}">${trust.label}</span>` : ''}</div>${meta}</div>
    </div>
    ${metricsGrid}
    <div class="trust-track-real">
      <div class="trust-bar"><div class="trust-bar-fill" style="width:${trust?.pct || 0}%;background:${trust?.color || 'var(--text-muted)'}"></div></div>
      <div class="trust-stage-lbl" style="color:${trust?.color || 'var(--text-muted)'}">${trust?.label || '—'}${trust?.pct != null ? ` · ${trust.pct}%` : ''}</div>
    </div>
    <div class="trust-gate ${trust?.unlocked ? 'open' : ''}">${trust?.unlocked ? '✓ Audit passed — growth scripts unlocked' : '🛡️ Warm up this account (sales + age) to unlock growth scripts'}</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;flex-wrap:wrap;gap:8px">
      <span style="font-size:11px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:.05em">Marketing add-ons</span>
      <button class="app-btn ghost sm" data-addaddon="${a.id}">${icon('plus')} Add-on</button>
    </div>
    ${addonChips}
  </div>`;
}

// ── INVENTORY ─────────────────────────────────────────────────────────────────
// Real listed-item tracking fed by the extension scanners (eBay inventory +
// Amazon ASIN purchase track). Shows stock health, where each item is sourced,
// and a cross-site reference (same ASIN listed on multiple marketplaces).
async function renderInventory() {
  $('#topSub').textContent = '';
  const content = $('#content');
  content.innerHTML = `<div class="ws-empty" style="margin-top:40px">${icon('invlist')}<p>Loading inventory…</p></div>`;
  // Preview uses the demo dataset (already in invItems/inventorySummary) — don't
  // overwrite it with a live fetch.
  if (!previewMode()) {
    try { const r = await getInventory(); invItems = r.items || []; } catch { invItems = []; }
    try { inventorySummary = await getInventorySummary(); } catch {}
  }
  paintInventory(content);
}

function paintInventory(content) {
  const sum = inventorySummary || { total: 0, inStock: 0, outOfStock: 0, lowStock: 0, byMarketplace: {}, crossSite: [] };

  if (!invItems.length && !sum.total) {
    content.innerHTML = scopeBar() + `<div class="page">${emptyState('invlist', 'No inventory synced yet',
      "Inventory is a live sheet of every listing — stock, source cost, margin and where it’s cross-listed. Run a Quick Sync or Full Sync on a connected account and it lands here automatically.",
      ['Open Workspace', 'workspace'])}</div>`;
    wireScopeBar(content, () => paintInventory(content));
    content.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { activeTab = b.dataset.go; renderShell(); });
    return;
  }

  const syncedMks = Object.keys(sum.byMarketplace || {});
  const fm = focusedMarketplace();
  const q = invFilter.q.trim().toLowerCase();
  const filtered = invItems.filter(it => {
    if (fm && it.marketplace !== fm) return false;
    if (invFilter.marketplace !== 'all' && it.marketplace !== invFilter.marketplace) return false;
    if (invFilter.stock === 'in' && !it.inStock) return false;
    if (invFilter.stock === 'out' && it.inStock) return false;
    if (invFilter.stock === 'low' && !(it.inStock && it.qty > 0 && it.qty <= 3)) return false;
    if (q && !((it.title || '') + (it.sku || '') + (it.asin || '') + (it.extId || '')).toLowerCase().includes(q)) return false;
    return true;
  });

  $('#topSub').textContent = `· ${sum.total} item${sum.total === 1 ? '' : 's'}`;

  const rows = filtered.map(it => {
    const m = marketplace(it.marketplace);
    const logo = marketplaceLogo(it.marketplace) || `<span style="font:800 11px var(--nav-font);color:var(--text-1)">${(m?.name || '?')[0]}</span>`;
    const stockBadge = it.inStock
      ? (it.qty > 0 && it.qty <= 3
          ? `<span class="badge warning">Low &middot; ${it.qty}</span>`
          : `<span class="badge success">In stock${it.qty ? ' · ' + it.qty : ''}</span>`)
      : `<span class="badge danger">Out of stock</span>`;
    const margin = (it.price != null && it.cost != null) ? fmt$(it.price - it.cost) : '—';
    const marginStyle = (it.price != null && it.cost != null) ? (it.price > it.cost ? 'color:var(--mint)' : 'color:var(--coral)') : '';
    return `<tr class="inv-row"${it.id ? ` data-invid="${esc(String(it.id))}" style="cursor:pointer"` : ''}>
      <td>
        <div class="cell-main">
          <div class="logo-box">${logo}</div>
          <div>
            <div style="font-weight:600;color:var(--text-1);font-size:11.5px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(it.title || '')}">${esc(it.title || it.sku || it.extId)}</div>
            ${it.sku ? `<div style="font-size:10px;color:var(--text-muted);margin-top:1px">SKU: ${esc(it.sku)}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="font-size:11px;color:var(--text-2)">${esc(m?.name || it.marketplace)}</td>
      <td>${stockBadge}</td>
      <td style="font-weight:700;color:var(--text-1);font-size:11.5px">${it.price != null ? fmt$(it.price) : '—'}</td>
      <td style="color:var(--text-muted);font-size:11px">${it.cost != null ? fmt$(it.cost) : '—'}</td>
      <td style="font-weight:700;font-size:11.5px;${marginStyle}">${margin}</td>
      <td style="font-size:10.5px">${it.asin ? `<span style="color:var(--text-muted);font-family:var(--mono,monospace)">${esc(it.asin)}</span>${it.sourceUrl ? ` <a href="${esc(it.sourceUrl)}" target="_blank" rel="noopener" style="color:var(--blue)">↗</a>` : ''}` : '—'}</td>
      <td style="text-align:right">${it.id ? `<button class="btn ghost small" data-delinv="${esc(it.id)}" title="Remove" style="padding:0 8px;min-height:26px">${icon('trash')}</button>` : ''}</td>
    </tr>`;
  }).join('');

  const stockSegs = [['all', 'All'], ['in', 'In stock'], ['out', 'Out of stock'], ['low', 'Low stock']];
  const mkPills = [`<button class="filter-control ${invFilter.marketplace === 'all' ? 'active' : ''}" data-invmk="all" style="${invFilter.marketplace === 'all' ? 'border-color:var(--blue);color:var(--text-1)' : ''}">All stores</button>`]
    .concat(syncedMks.map(mk => `<button class="filter-control ${invFilter.marketplace === mk ? 'active' : ''}" data-invmk="${esc(mk)}" style="${invFilter.marketplace === mk ? 'border-color:var(--blue);color:var(--text-1)' : ''}">${esc(marketplace(mk)?.name || mk)}</button>`)).join('');
  const stockPills = stockSegs.map(([v, l]) => `<button class="filter-control ${invFilter.stock === v ? 'active' : ''}" data-invstock="${v}" style="${invFilter.stock === v ? 'border-color:var(--blue);color:var(--text-1)' : ''}">${l}</button>`).join('');

  const crossSection = (sum.crossSite || []).length ? `<div class="card" style="border-color:rgba(96,165,250,.2);background:rgba(96,165,250,.04);margin-bottom:16px">
    <div class="card-header">
      <span style="font-weight:700;color:var(--blue);font-size:13px">🔗 ${sum.crossSite.length} cross-listed product${sum.crossSite.length === 1 ? '' : 's'}</span>
    </div>
    <div class="card-body" style="padding-top:4px">
      ${(sum.crossSite || []).map(c => `<div style="padding:10px 0;border-bottom:1px solid var(--line)">
        <div style="font-weight:700;color:var(--text-1);font-size:12px">${esc(c.title || c.asin)} <span style="color:var(--text-muted);font-weight:500">· ${esc(c.asin)}</span></div>
        <div style="color:var(--text-muted);font-size:11px;margin-top:3px;line-height:1.5">Listed on <b style="color:var(--text-2)">${(c.marketplaces || []).join(', ')}</b>${c.sourceSite ? ` · sourced from ${esc(c.sourceSite)}` : ''}. Keep stock in sync to avoid overselling.</div>
      </div>`).join('')}
    </div>
  </div>` : '';

  content.innerHTML = scopeBar() + `
    <div class="page">
      <div class="summary-strip" style="margin-top:16px">
        <div class="summary-cell"><span>Total items</span><strong>${sum.total}</strong></div>
        <div class="summary-cell"><span>In stock</span><strong style="color:var(--mint)">${sum.inStock}</strong></div>
        <div class="summary-cell"><span>Out of stock</span><strong style="${sum.outOfStock ? 'color:var(--coral)' : ''}">${sum.outOfStock}</strong><small>${sum.outOfStock ? 'needs restocking' : 'all good'}</small></div>
        <div class="summary-cell"><span>Low stock</span><strong style="${sum.lowStock ? 'color:var(--amber)' : ''}">${sum.lowStock}</strong><small>≤3 units left</small></div>
      </div>

      ${crossSection}

      <div class="card table-card">
        <div class="card-header">
          <span style="font-weight:700;color:var(--text-1)">Inventory</span>
          <div class="toolbar-right" style="margin-left:auto;gap:6px">
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              ${mkPills}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
              ${stockPills}
            </div>
            <input id="invSearch" placeholder="Search title, SKU, ASIN…" value="${esc(invFilter.q)}" style="min-height:34px;padding:0 11px;border:1px solid var(--line);border-radius:10px;background:var(--surface-1);color:var(--text-1);font-size:11px;width:180px">
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Item</th><th>Marketplace</th><th>Stock</th><th>Price</th><th>Cost</th><th>Margin</th><th>Source ASIN</th><th></th></tr>
            </thead>
            <tbody>${rows || `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted)">No items match this filter.</td></tr>`}</tbody>
          </table>
        </div>
        <div style="padding:10px 16px;font-size:11px;color:var(--text-muted);border-top:1px solid var(--line)">${filtered.length} of ${invItems.length} item${invItems.length === 1 ? '' : 's'} shown</div>
      </div>
    </div>`;

  wireScopeBar(content, () => paintInventory(content));
  content.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { activeTab = b.dataset.go; renderShell(); });
  content.querySelectorAll('[data-invmk]').forEach(b => b.onclick = () => { invFilter.marketplace = b.dataset.invmk; paintInventory(content); });
  content.querySelectorAll('[data-invstock]').forEach(b => b.onclick = () => { invFilter.stock = b.dataset.invstock; paintInventory(content); });
  const search = $('#invSearch', content);
  if (search) search.oninput = () => { invFilter.q = search.value; applyInvFilterToTable(content); };
  content.querySelectorAll('[data-delinv]').forEach(b => b.onclick = async (e) => {
    e.stopPropagation(); // don't also open the row detail drawer
    const id = b.dataset.delinv;
    b.disabled = true;
    try { await deleteInventoryItem(id); invItems = invItems.filter(x => String(x.id) !== String(id)); if (inventorySummary) inventorySummary.total = Math.max(0, (inventorySummary.total || 1) - 1); paintInventory(content); showToast('Product removed from inventory.', 'success'); }
    catch (e) { b.disabled = false; showAlert(e.message || 'Could not remove item.'); }
  });
  // Open the product detail drawer when a row is clicked (keyboard too).
  content.querySelectorAll('.inv-row[data-invid]').forEach(row => {
    row.setAttribute('tabindex', '0');
    const open = () => openInventoryItem(row.dataset.invid);
    row.onclick = () => open();
    row.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); open(); } };
  });
}

// Live search repaint without losing focus: just re-filter the tbody.
function applyInvFilterToTable(content) {
  const q = invFilter.q.trim().toLowerCase();
  content.querySelectorAll('.data-table tbody tr').forEach((tr) => {
    const txt = tr.textContent.toLowerCase();
    tr.style.display = (!q || txt.includes(q)) ? '' : 'none';
  });
}

// ── JOBS / DEVICES / TEAM / AUDIT / PLAN ──────────────────────────────────────
function saveDraft() { try { localStorage.setItem('syndrax_wf_draft', JSON.stringify(draftWorkflow)); } catch {} }

// Full-width workflow canvas (bigger boxes, drag-to-reorder, connectors).
function jobsCanvasHtml() {
  const allMods = WORKFLOW.flatMap(s => s.modules);
  const modOf = k => allMods.find(m => m.key === k);
  if (!draftWorkflow.length) return `<div class="canvas-empty"><img src="assets/svg/robot2.svg" class="canvas-empty-robot" alt=""><p>Add tools to build a workflow — or open any tool's <b>sync-bot</b> in the Workspace. Each step runs in order with the audit agent.</p></div>`;
  return `<div class="wfb-canvas">${draftWorkflow.map((k, i) => {
    const m = modOf(k); const tier = toolTier(k);
    return `<div class="wfb-step"><div class="wfb-node" draggable="true" data-i="${i}">
      <span class="wf-grip" title="Drag to reorder">⠿</span>
      <span class="wfb-num">${i + 1}</span>
      <div class="wfb-info"><div class="wfb-name">${esc(m?.label || k)} <span class="sc-state ${tier}">${tier}</span></div><div class="wfb-desc">${esc(m?.desc || '')}</div></div>
      <button class="wfb-del" data-del="${i}" title="Remove step">✕</button>
    </div></div>${i < draftWorkflow.length - 1 ? '<div class="wfb-connector"></div>' : ''}`;
  }).join('')}</div>`;
}

function renderJobsTab() {
  $('#topSub').textContent = `· ${jobs.length} job${jobs.length === 1 ? '' : 's'}`;
  const content = $('#content');
  const jActive = jobs.filter(j => j.status === 'running' || j.status === 'accepted').length;
  const jQueued = jobs.filter(j => j.status === 'queued' || j.status === 'dispatched').length;
  const jDone = jobs.filter(j => j.status === 'complete').length;
  const jErr = jobs.filter(j => j.status === 'error').length;
  const jRail = [
    { ic: 'briefcase', tone: 'cyan', val: jobs.length, lbl: 'Total jobs' },
    { ic: 'rocket', tone: 'cyan', val: jActive, lbl: 'Active' },
    { ic: 'refresh', tone: 'violet', val: jQueued, lbl: 'Queued' },
    { ic: 'shield', tone: 'green', val: jDone, lbl: 'Completed' },
    { ic: 'x', tone: 'red', val: jErr, lbl: 'Failed' },
  ];

  content.innerHTML = `
    <div class="page jobs2">
      <div class="mc-rail">${jRail.map((c, i) => `${i ? '<span class="mc-rail-div"></span>' : ''}<div class="mc-rail-cell" style="cursor:default"><span class="mc-rail-ic ${c.tone}">${icon(c.ic)}</span><span class="mc-rail-meta"><span class="mc-rail-val">${c.val}</span><span class="mc-rail-lbl">${c.lbl}</span></span></div>`).join('')}</div>

      <div class="jobs2-grid">
        <section class="jobs2-card" data-accent="cyan">
          <div class="jobs2-head">
            <div class="mc-panel-id"><span class="mc-panel-ic cyan">${icon('bot')}</span><div><span class="mc-kicker">Build</span><h3 class="mc-panel-title">Workflow canvas</h3></div></div>
            ${draftWorkflow.length ? `<button class="mc-btn mc-btn--ghost mc-btn--sm" id="wfClear">Clear</button>` : ''}
          </div>
          <div id="wfCanvas">${jobsCanvasHtml()}</div>
          <select id="wfAdd" class="wf-add-sel" style="margin-top:12px"><option value="">+ Add a step…</option>${WORKFLOW.map(s => `<optgroup label="${esc(s.stage)}">${s.modules.map(m => `<option value="${m.key}">${esc(m.label)} · ${toolTier(m.key)}</option>`).join('')}</optgroup>`).join('')}</select>
          <div class="mc-actions" style="margin-top:12px">
            <button class="mc-btn mc-btn--primary" id="wfRun" ${draftWorkflow.length ? '' : 'disabled title="Add a step to run a workflow"'}>${icon('play')} Run workflow</button>
            <button class="mc-btn mc-btn--secondary" id="wfSave" ${draftWorkflow.length ? '' : 'disabled title="Add a step to save"'}>${icon('refresh')} Save</button>
          </div>
        </section>
        <section class="jobs2-card" data-accent="violet">
          <div class="jobs2-head">
            <div class="mc-panel-id"><span class="mc-panel-ic violet">${icon('refresh')}</span><div><span class="mc-kicker">Templates</span><h3 class="mc-panel-title">Library & saved</h3></div></div>
                        <span class="hb-pill neutral">${automations.length}</span>
          </div>
          ${renderAutomationsList()}
        </section>
      </div>

      <section class="cc2-queue">
        <div class="cc2-queue-head">
          <div><span class="mc-kicker">History</span><h3 class="cc2-queue-title">Recent jobs</h3></div>
          <span style="flex:1"></span>
          ${jobs.length ? `<button class="mc-btn mc-btn--ghost mc-btn--sm" id="jClear">Clear</button>` : ''}
        </div>
        <div class="jobs2-list">
          ${jobs.length === 0
            ? `<div class="cc2-qempty"><span class="cc-empty-ico">${icon('briefcase')}</span><div><div class="cc2-acs-empty-t">No jobs yet</div><p>Run a workflow above or launch a tool from the Workspace — every run is logged here with its status and progress.</p></div><button class="mc-btn mc-btn--primary mc-btn--sm" data-go="workspace">Open Workspace</button></div>`
            : jobs.map(jobRow).join('')}
        </div>
      </section>
    </div>`;
  content.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { activeTab = b.dataset.go; renderShell(); });
  wireJobsTab(content);
}

function wireJobsTab(content) {
  const repaint = () => { saveDraft(); renderJobsTab(); };
  const add = $('#wfAdd', content);
  if (add) add.onchange = () => { if (add.value) { draftWorkflow.push(add.value); playSfx('nav'); repaint(); } };
  content.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { draftWorkflow.splice(+b.dataset.del, 1); repaint(); });
  const clr = $('#wfClear', content); if (clr) clr.onclick = () => { draftWorkflow = []; repaint(); };
  const run = $('#wfRun', content); if (run) run.onclick = () => animateWorkflowRun(draftWorkflow, content);
  const save = $('#wfSave', content); if (save) save.onclick = () => {
    const mk = wsTarget ? wsTarget.marketplace : 'ebay';
    const first = WORKFLOW.flatMap(s => s.modules).find(m => m.key === draftWorkflow[0]);
    automations.push({ id: 'wf-' + Date.now().toString(36), label: (first?.label || 'Custom') + ' workflow', marketplace: mk, steps: draftWorkflow.slice(), interval: 'Manual', auditAgent: true });
    saveAutomations(); showToast('Saved to automations.', 'success'); renderJobsTab();
  };
  // Drag-to-reorder the canvas steps.
  content.querySelectorAll('.wfb-node[draggable]').forEach(node => {
    node.ondragstart = () => { wfDragFrom = +node.dataset.i; node.style.opacity = '.5'; };
    node.ondragend = () => { node.style.opacity = ''; content.querySelectorAll('.drag-over').forEach(n => n.classList.remove('drag-over')); };
    node.ondragover = (e) => { e.preventDefault(); node.classList.add('drag-over'); };
    node.ondragleave = () => node.classList.remove('drag-over');
    node.ondrop = (e) => {
      e.preventDefault();
      const to = +node.dataset.i;
      if (wfDragFrom == null || wfDragFrom === to) return;
      const [moved] = draftWorkflow.splice(wfDragFrom, 1);
      draftWorkflow.splice(to, 0, moved);
      wfDragFrom = null; repaint();
    };
  });
  content.querySelectorAll('[data-autorun]').forEach(b => b.onclick = () => runAutomation(b.dataset.autorun));
    content.querySelectorAll('[data-autodel]').forEach(b => b.onclick = () => { automations = automations.filter(a => a.id !== b.dataset.autodel); saveAutomations(); renderJobsTab(); });
    content.querySelectorAll('[data-job]').forEach(b => b.onclick = () => { selectedJobId = b.dataset.job; openJobDrawer(b.dataset.job); });
    const jc = $('#jClear', content); if (jc) jc.onclick = () => { jobs = []; saveJobs(); renderJobsTab(); };
    wireTemplatePackButtons(content);
    if (!templateCatalog) ensureTemplateCatalog().then(() => { if (activeTab === 'jobs') renderJobsTab(); });
  }

// ── TRACKING (Feature M — TrackCaptain via cloud credits) ─────────────────────
// Orders flow pending → (claim spends 1 credit) → claimed → (push to marketplace) →
// synced. Marketplace-agnostic; eBay is wired in the extension first.
async function renderTracking() {
  $('#topSub').textContent = '';
  const content = $('#content');
  content.innerHTML = `<div class="ws-empty" style="margin-top:40px">${icon('truck')}<p>Loading tracking…</p></div>`;
  let orders = [];
  if (previewMode()) {
    // Demo dataset already loaded in trackingBalance/trackingOrders.
    orders = trackingOrders || [];
  } else {
    try { trackingBalance = await getTrackingBalance(); } catch { trackingBalance = { credits: 0, configured: false, claims: [], allotment: 0 }; }
    try { const r = await getTrackingOrders(); orders = r.orders || []; } catch { orders = []; }
    trackingOrders = orders;
  }
  paintTracking(content, orders);
}

function paintTracking(content, orders) {
  const bal = trackingBalance || { credits: 0, configured: false, claims: [], allotment: 0 };
  // Global Focus bar (account scope) narrows which orders we show.
  const fm = focusedMarketplace();
  const vis = fm ? orders.filter(o => o.marketplace === fm) : orders;
  const pending = vis.filter(o => o.status === 'pending');
  const claimed = vis.filter(o => o.status === 'claimed');
  const synced = vis.filter(o => o.status === 'synced');
  const extOk = ext.installed;

  const orderRow = (o) => {
    const m = marketplace(o.marketplace);
    const dest = [o.buyerCity, o.buyerState, o.buyerZip].filter(Boolean).join(', ') || '—';
    const dd = o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString() : '—';
    let action = '';
    if (o.status === 'pending') action = `<button class="app-btn sm" data-claim="${esc(o.id)}" ${bal.configured && bal.credits > 0 ? '' : 'disabled'}>${icon('truck')} Claim (1)</button>`;
    else if (o.status === 'claimed') action = `<button class="app-btn sm" data-push="${esc(o.id)}" ${extOk ? '' : 'disabled title="Install extension"'}>Push to ${esc(m?.name || o.marketplace)}</button>`;
    else if (o.status === 'synced') action = `<span class="jb complete" style="font-size:9px">SYNCED</span>`;
    return `<tr>
      <td>${esc(m?.name || o.marketplace)}</td>
      <td style="font-family:ui-monospace,monospace;font-size:11px">${esc(o.orderId)}</td>
      <td>${esc(dest)}</td>
      <td>${dd}</td>
      <td>${o.trackingNumber ? `<span style="font-family:ui-monospace,monospace;font-size:11px;color:#6ee7b7">${esc(o.trackingNumber)}</span>` : '<span style="color:rgba(255,255,255,0.35)">—</span>'}</td>
      <td style="text-align:right">${action}</td>
    </tr>`;
  };

  const ordersTable = (rows, label) => rows.length ? `
    <div class="card table-card" style="margin-bottom:14px">
      <div class="card-header"><span style="font-weight:700;color:var(--text-1)">${label}</span><span style="font-size:11px;color:var(--text-muted)">${rows.length} order${rows.length === 1 ? '' : 's'}</span></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Marketplace</th><th>Order</th><th>Destination</th><th>Delivery</th><th>Tracking #</th><th></th></tr></thead>
        <tbody>${rows.map(orderRow).join('')}</tbody>
      </table></div>
    </div>` : '';

  const claimsList = (bal.claims || []).slice(0, 10).map(c => `
    <div class="audit-finding"><div class="f-title" style="font-family:ui-monospace,monospace;font-size:12px;color:#6ee7b7">${esc(c.trackingNumber)}</div>
    <div class="f-detail">${esc(marketplace(c.marketplace)?.name || c.marketplace || '—')} · ${esc(c.carrier || 'carrier')} · order ${esc(c.orderId || '—')} · ${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ''}</div></div>`).join('');

  // Credits stay low-key: a normal user with plenty of allowance never sees a
  // top-up prompt. It only appears when they're actually running low.
  const lowCredits = bal.configured && bal.credits <= 10;
  const packs = bal.packs || [];
  const subs = bal.subs || [];
  const hasAuto = subs.length > 0;
  const modeOn = trackingBuyMode === 'monthly' && hasAuto;
  const subFor = (packId) => subs.find(s => s.id === packId.replace('pack_', 'sub_'));
  const BEST_ID = 'pack_1000'; // Seller — flagged as best value
  const topUp = (lowCredits && packs.length) ? `
    <div class="topup${bal.credits === 0 ? ' urgent' : ''}">
      <div class="topup-head">
        <div class="topup-title">${bal.credits === 0 ? 'Out of tracking numbers' : 'Running low on tracking numbers'}</div>
        <div class="seg">
          <button class="${!modeOn ? 'on' : ''}" data-buymode="once">One-time</button>
          <button class="${modeOn ? 'on' : ''}" data-buymode="monthly" ${hasAuto ? '' : 'disabled title="Auto-renew is not available yet"'}>Auto-renew</button>
        </div>
      </div>
      <div class="topup-sub">${bal.credits === 0
        ? 'Add more so fulfillment keeps auto-pushing tracking without interruption.'
        : `${bal.credits} left. Each tracking number you add to a buyer's order uses one.`} ${modeOn ? 'Auto-renew tops up every month — cancel anytime in billing.' : 'One-time top-up, no subscription.'}</div>
      <div class="pack-grid">
        ${packs.map(p => {
          const sub = subFor(p.id);
          const avail = !modeOn || !!sub;
          const credits = (modeOn && sub) ? sub.creditsPerMonth : p.credits;
          const price = (modeOn && sub) ? sub.priceUsd : p.priceUsd;
          const per = (modeOn && sub) ? sub.perNumber : p.perNumber;
          return `<button class="pack-tile${p.id === BEST_ID ? ' best' : ''}" data-buycredits="${esc(p.id)}" ${avail ? '' : 'disabled title="No auto-renew for this tier"'}>
            ${p.id === BEST_ID ? '<span class="pack-tag">Best value</span>' : ''}
            <span class="pack-name">${esc(p.label)}</span>
            <span class="pack-credits">${Number(credits).toLocaleString()} <span>numbers</span></span>
            <span class="pack-price">$${Number(price).toLocaleString()}${modeOn ? '/mo' : ''}<span class="per">$${(per != null ? per : 0).toFixed(2)} each</span></span>
          </button>`;
        }).join('')}
      </div>
      <div class="topup-foot">Tracking numbers are shared across your whole workspace${modeOn ? '.' : ' and never expire.'}</div>
    </div>` : '';

  content.innerHTML = scopeBar() + `
    <div class="page">
      <div class="summary-strip" style="margin-top:16px">
        <div class="summary-cell"><span>Tracking left</span><strong style="${(bal.credits ?? 0) === 0 && bal.configured ? 'color:var(--coral)' : (bal.credits ?? 0) <= 10 && bal.configured ? 'color:var(--amber)' : ''}">${bal.credits ?? 0}</strong><small>${bal.configured ? `${bal.allotment ?? 0}/mo included` : 'not configured'}</small></div>
        <div class="summary-cell"><span>Pending</span><strong>${pending.length}</strong><small>awaiting tracking</small></div>
        <div class="summary-cell"><span>Claimed</span><strong>${claimed.length}</strong><small>ready to push</small></div>
        <div class="summary-cell"><span>Synced</span><strong style="${synced.length ? 'color:var(--mint)' : ''}">${synced.length}</strong><small>pushed to buyer</small></div>
      </div>
      ${!bal.configured ? `<div class="card" style="border-color:rgba(96,165,250,.2);background:rgba(96,165,250,.04);margin-bottom:16px">
        <div class="card-body" style="font-size:12px;color:var(--text-muted);line-height:1.6">Auto-tracking isn't live yet — once set up, the delivery date and a tracking number sync to each order automatically. Until then, orders collect here.</div>
      </div>` : ''}
      ${topUp}
      ${ordersTable(pending, 'Pending orders')}
      ${ordersTable(claimed, 'Claimed — ready to push')}
      ${ordersTable(synced, 'Synced')}
      ${!vis.length ? emptyState('truck', fm ? `No ${esc(marketplace(fm)?.name || fm)} orders waiting` : 'No orders waiting on tracking', "When the Amazon fulfill script finishes an order it captures the delivery date and destination. One click claims a tracking number and pushes it to the buyer's order.") : ''}
      ${claimsList ? `<div class="card" style="margin-top:14px">
        <div class="card-header"><span style="font-weight:700;color:var(--text-1)">Recent claims</span></div>
        <div class="card-body" style="padding-top:4px">${claimsList}</div>
      </div>` : ''}
    </div>`;

  wireScopeBar(content, () => paintTracking(content, trackingOrders));
  content.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => claimForOrder(orders.find(o => String(o.id) === b.dataset.claim), content));
  content.querySelectorAll('[data-push]').forEach(b => b.onclick = () => pushTrackingToMarketplace(orders.find(o => String(o.id) === b.dataset.push), content));
  content.querySelectorAll('[data-buymode]').forEach(b => b.onclick = () => { trackingBuyMode = b.dataset.buymode; paintTracking(content, trackingOrders); });
  content.querySelectorAll('[data-buycredits]').forEach(b => b.onclick = async () => {
    b.disabled = true; b.textContent = 'Opening checkout…';
    try { const r = await trackingCheckout(b.dataset.buycredits, trackingBuyMode); if (r && r.url) location.href = r.url; else { b.disabled = false; showAlert('Could not open checkout.'); } }
    catch (e) { b.disabled = false; showAlert(e.message || 'Could not open checkout.'); }
  });
}

async function claimForOrder(o, content) {
  if (!o) return;
  try {
    showToast('Claiming a tracking number…', 'info');
    const r = await claimTracking({
      orderId: o.orderId, marketplace: o.marketplace,
      city: o.buyerCity, state: o.buyerState, zip: o.buyerZip, country: o.buyerCountry,
      deliveryDate: o.deliveryDate,
    });
    trackingBalance = { ...(trackingBalance || {}), credits: r.credits };
    showToast(`Claimed ${r.trackingNumber} (${r.carrier || 'carrier'}). ${trackingBalance.credits} credits left.`, 'success');
    renderTracking();
  } catch (e) {
    showAlert(e.message || 'Could not claim a tracking number.');
  }
}

// Hand a claimed tracking number to the extension to drive the marketplace's
// "add tracking" flow (eBay mesh/ord first). Marks the order synced on success.
function pushTrackingToMarketplace(o, content) {
  if (!o || !o.trackingNumber) return;
  const extId = ext.id || EXT_IDS[0];
  if (!(window.chrome && chrome.runtime && chrome.runtime.sendMessage && ext.installed)) {
    showAlert('Install the Syndrax extension to push tracking to the marketplace.'); return;
  }
  showToast(`Pushing tracking to ${marketplace(o.marketplace)?.name || o.marketplace}…`, 'info');
  chrome.runtime.sendMessage(extId, {
    type: 'SYNDRAX_PUSH_TRACKING', marketplace: o.marketplace, orderId: o.orderId,
    trackingNumber: o.trackingNumber, carrier: o.carrier,
  }, async (resp) => {
    if (chrome.runtime.lastError || !resp || !resp.ok) {
      showAlert((resp && resp.error) || 'Extension could not push the tracking number.'); return;
    }
    try { await updateTrackingOrder(o.id, { status: 'synced' }); } catch {}
    showToast('Tracking pushed to the buyer’s order ✓', 'success');
    renderTracking();
  });
}

// ── Node cluster — premium industrial node cards ──────────────────────────────
function getNodeState(n) {
  if (n.status === 'connecting') return 'connecting';
  if (n.status === 'online') return 'online';
  if (n.status === 'disconnected') return 'disconnected';
  return 'offline';
}

// Parametric chassis SVG (verbatim from the extension kit) — tints per state.
function nodeShellSVG(uid, b, d, disc, glow) {
  const g = glow ? `filter="url(#glow-${uid})"` : '';
  return `<svg viewBox="0 0 220 620" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="outer-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#26384B"/><stop offset=".22" stop-color="#0A1421"/><stop offset=".68" stop-color="#111F2D"/><stop offset="1" stop-color="#02070D"/></linearGradient>
    <linearGradient id="rail-${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6D8297"/><stop offset=".08" stop-color="#192A3A"/><stop offset=".55" stop-color="#08111C"/><stop offset=".92" stop-color="#24394B"/><stop offset="1" stop-color="#8799AA"/></linearGradient>
    <linearGradient id="glass-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#102131" stop-opacity=".94"/><stop offset=".45" stop-color="#07111C" stop-opacity=".97"/><stop offset="1" stop-color="#02070C"/></linearGradient>
    <linearGradient id="bevel-${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6E8296"/><stop offset=".13" stop-color="#1A2B3B"/><stop offset=".5" stop-color="#0A131E"/><stop offset=".87" stop-color="#1C3040"/><stop offset="1" stop-color="#8092A4"/></linearGradient>
    <radialGradient id="powerDisc-${uid}" cx="50%" cy="42%" r="64%"><stop offset="0" stop-color="${disc}"/><stop offset=".5" stop-color="#07121D"/><stop offset="1" stop-color="#010409"/></radialGradient>
    <linearGradient id="bottomGlow-${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${d}" stop-opacity="0"/><stop offset=".25" stop-color="${d}" stop-opacity=".35"/><stop offset=".5" stop-color="${b}" stop-opacity="1"/><stop offset=".75" stop-color="${d}" stop-opacity=".35"/><stop offset="1" stop-color="${d}" stop-opacity="0"/></linearGradient>
    <filter id="shadow-${uid}" x="-40%" y="-20%" width="180%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="16" flood-color="#000" flood-opacity=".6"/></filter>
    <filter id="glow-${uid}" x="-200%" y="-200%" width="400%" height="400%"><feGaussianBlur stdDeviation="5" result="bl"/><feMerge><feMergeNode in="bl"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="softGlow-${uid}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="10"/></filter>
    <pattern id="microGrid-${uid}" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M8 0H0V8" fill="none" stroke="#7CCEFF" stroke-opacity=".025" stroke-width=".6"/></pattern>
  </defs>
  <g filter="url(#shadow-${uid})">
    <ellipse cx="110" cy="606" rx="78" ry="16" fill="${b}" opacity="${glow ? '.10' : '.04'}" filter="url(#softGlow-${uid})"/>
    <path d="M24 0H196L216 20V600L196 620H24L4 600V20Z" fill="url(#outer-${uid})" stroke="#50657A" stroke-width="1.5"/>
    <path d="M30 8H190L208 26V594L190 612H30L12 594V26Z" fill="#050B13" stroke="#17283A" stroke-width="2"/>
    <path d="M16 27L28 15H38V605H28L16 593Z" fill="url(#rail-${uid})" stroke="#536A7F" stroke-width="1"/>
    <path d="M204 27L192 15H182V605H192L204 593Z" fill="url(#rail-${uid})" stroke="#536A7F" stroke-width="1"/>
    <path d="M40 22H180L188 31V589L180 598H40L32 589V31Z" fill="url(#glass-${uid})" stroke="#22394C" stroke-width="1.5"/>
    <path d="M40 22H180L188 31V589L180 598H40L32 589V31Z" fill="url(#microGrid-${uid})"/>
    <circle cx="110" cy="75" r="34" fill="#02060B" stroke="#33495D" stroke-width="2"/>
    <circle cx="110" cy="75" r="25" fill="url(#powerDisc-${uid})" stroke="${b}" stroke-opacity=".36"/>
    <circle cx="110" cy="75" r="19" fill="none" stroke="${b}" stroke-width="3" stroke-dasharray="92 28" stroke-linecap="round" transform="rotate(-35 110 75)" ${g}/>
    <path d="M110 55V76" stroke="${b}" stroke-width="4" stroke-linecap="round" ${g}/>
    <path d="M39 535H181V585L174 592H46L39 585Z" fill="#030911" stroke="#173044"/>
    <circle cx="63" cy="566" r="8" fill="#07131F" stroke="#315069"/>
    <rect x="101" y="558" width="18" height="15" rx="2" fill="#07131F" stroke="#315069"/>
    <circle cx="157" cy="562" r="2" fill="#6F8DA4"/><circle cx="157" cy="569" r="2" fill="#6F8DA4"/><circle cx="157" cy="576" r="2" fill="#6F8DA4"/>
    <rect x="55" y="604" width="110" height="4" rx="2" fill="url(#bottomGlow-${uid})" ${g}/>
    <path d="M70 607H150" stroke="${b}" stroke-width="2" opacity="${glow ? '.8' : '.3'}" ${g}/>
  </g></svg>`;
}

function nodeUnitHtml(n, idx) {
  const isRoot = !!(n.local || n.nodeType === 'current');
  const state = getNodeState(n);
  const on = state === 'online';
  const loadPct = on ? Math.max(0, Math.min(100,
    n.cpu != null ? n.cpu :
    (isRoot ? Math.min(100, jobs.filter(j => j.status === 'running' || j.status === 'accepted').length * 22) :
    (n.tasks || 0) * 22))) : 0;
  const litBars = Math.round(loadPct / 100 * 8);
  const acctCount = accounts.filter(a => {
    if (isRoot) return !a.nodeId && !a.node_id;
    return a.nodeId === n.id || a.node_id === n.id || a.device_id === n.deviceId;
  }).length;
  const activeJobs = jobs.filter(j =>
    (j.status === 'running' || j.status === 'accepted') &&
    (isRoot ? (!j.nodeId && !j.node_id) : (j.nodeId === n.id || j.node_id === n.id))
  ).length;
  const typeLabel = isRoot ? 'THIS PC' : n.nodeType === 'rdp' ? 'RDP' : 'REMOTE';
  const ipLabel = n.ip || (isRoot ? (thisPcIp || '—') : '—');
  const stateText = state === 'online' ? (isRoot ? 'MAIN · ONLINE' : 'ONLINE') : state === 'connecting' ? 'CONNECTING…' : state === 'disconnected' ? 'DISCONNECTED' : 'OFFLINE';
  const initials = (String(n.name || 'ND').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) || 'ND').toUpperCase();
  const nodeId = String(n.id || n.name);
  const leds = Array.from({ length: 8 }, (_, i) => `<div class="nu-led${i < litBars ? ' on' : ''}"></div>`).join('');
  const CHASSIS_CC = {
    online:       ['#18bfff', '#0077cc', '#0D2840'],
    offline:      ['#ff4f68', '#aa2040', '#3D1018'],
    connecting:   ['#7b5cff', '#4420d4', '#1E1455'],
    disconnected: ['#ff8c42', '#cc5010', '#3D2008'],
  };
  const [cc1, cc2, cd] = isRoot
    ? ['#18E4FF', '#00b8d4', '#082030']
    : (CHASSIS_CC[state] || CHASSIS_CC.offline);
  const uid = 'nc' + idx;

  return `<article class="node-unit" data-state="${state}"${isRoot ? ' data-root="true"' : ''} data-tower="${esc(nodeId)}">
    <div class="node-chassis">
      <div class="nu-chassis-svg">${nodeShellSVG(uid, cc1, cc2, cd, on || isRoot)}</div>
      <div class="node-top-bar"></div>
      <div class="node-inner">
        <div class="node-refl"></div>
        <div class="nu-top">
          <div class="nu-emblem"><span class="nu-emblem-s">${esc(initials)}</span></div>
          <div class="nu-eline"></div>
          <div class="nu-status-row">
            <span class="nu-dot"></span>
            <span class="nu-status-text">${esc(stateText)}</span>
          </div>
        </div>
        <div class="nu-id">
          <p class="nu-name">${esc(String(n.name || 'NODE').toUpperCase())}</p>
          <div class="nu-type">${esc(typeLabel)}</div>
          <div class="nu-ip-row">
            <span class="nu-ip">${esc(ipLabel)}</span>
            ${ipLabel !== '—' ? `<button class="nu-copyip" data-copyip="${esc(ipLabel)}" title="Copy IP">⧉</button>` : ''}
          </div>
        </div>
        <div class="nu-metrics">
          <div>
            <div class="nu-metric-hd"><span>Task load</span><strong>${Math.round(loadPct)}%</strong></div>
            <div class="nu-leds">${leds}</div>
          </div>
          <div><div class="nu-metric-hd"><span>Accounts</span><strong>${acctCount}</strong></div></div>
          <div><div class="nu-metric-hd"><span>Active jobs</span><strong>${activeJobs}</strong></div></div>
        </div>
        <div class="nu-action">
          <button class="nu-btn" data-tower-manage="${esc(nodeId)}">${esc(on ? (isRoot ? 'Open extension' : 'Manage node') : 'View details')}</button>
        </div>
        <div class="nu-hw">
          <div class="nu-hw-ring"></div><div class="nu-hw-sq"></div>
          <div class="nu-hw-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
    </div>
    <div class="nu-sock"><div class="nu-sock-line"></div><div class="nu-sock-dot"></div></div>
  </article>`;
}

function addNodeSlotHtml() {
  return `<div class="node-add-slot" id="recruit">
    <div class="node-add-chassis">
      <div class="nu-add-icon">+</div>
      <div class="nu-add-label">Add Node</div>
      <div class="nu-add-sub">Expand your cluster<br>Add a remote machine</div>
    </div>
    <div class="nu-sock"><div class="nu-add-sock-line"></div><div class="nu-add-sock-dot"></div></div>
  </div>`;
}

function clusterActivityHtml(all) {
  const events = [];
  all.filter(n => n.status === 'online').forEach(n => {
    const isRoot = n.local || n.nodeType === 'current';
    const label = isRoot ? 'ROOT-MAIN' : String(n.name).toUpperCase();
    const accts = accounts.filter(a => isRoot ? (!a.nodeId && !a.node_id) : (a.nodeId === n.id || a.device_id === n.deviceId));
    const runJobs = jobs.filter(j => (j.status === 'running' || j.status === 'accepted') && (isRoot ? (!j.nodeId) : j.nodeId === n.id));
    if (runJobs.length) events.push({ label, text: `${runJobs.length} job${runJobs.length > 1 ? 's' : ''} running`, time: 'now' });
    else if (accts.length) events.push({ label, text: `${accts.length} account${accts.length > 1 ? 's' : ''} active`, time: 'connected' });
  });
  all.filter(n => n.status === 'offline').forEach(n => {
    const label = n.local ? 'ROOT-MAIN' : String(n.name).toUpperCase();
    events.push({ label, text: `Connection lost · ${n.ip || '—'}`, time: 'offline' });
  });
  while (events.length < 4) events.push({ label: '—', text: 'No recent activity', time: '—' });
  return events.slice(0, 4).map(e =>
    `<article class="activity-chip"><strong>● ${esc(e.label)}</strong><span>${esc(e.text)}</span><time>${esc(e.time)}</time></article>`
  ).join('');
}

function renderDevices() {
  const showFleet = can('multiDevice');
  const limit = PLAN_LIMITS[plan]?.maxDevices;
  const thisPc = { name: 'root-main', role: 'This PC', status: ext.installed ? 'online' : 'offline', local: true, ip: thisPcIp, deviceId: currentDeviceId, nodeType: 'current' };
  const all = [thisPc, ...nodes.map(n => ({ ...n, status: n.status === 'online' ? 'online' : (n.status || 'offline') })), ...addedDevices.map(d => ({ ...d, status: d.status === 'online' ? 'online' : 'offline' }))];
  cloudNodes.forEach(n => {
    const dup = all.some(x => (x.deviceId && x.deviceId === n.deviceId) || (x.ip && n.ip && x.ip === n.ip) || x.name === n.name);
    if (!dup) all.push({ name: n.name || n.deviceId, role: n.nodeType === 'current' ? 'This PC' : n.nodeType === 'rdp' ? 'RDP' : 'Remote', status: n.status === 'online' ? 'online' : 'offline', local: n.nodeType === 'current', ip: n.ip, deviceId: n.deviceId, nodeType: n.nodeType, id: n.id });
  });
  const onlineCount = all.filter(n => n.status === 'online').length;
  const offlineCount = all.length - onlineCount;
  const health = all.length ? Math.round(onlineCount / all.length * 100) : 0;
  const activeJobCount = jobs.filter(j => j.status === 'running' || j.status === 'accepted').length;
  $('#topSub').textContent = `· ${all.length} node${all.length === 1 ? '' : 's'}${isUnlimited(limit) ? '' : ' / ' + limit}`;
  const firstTime = !ext.installed && nodes.length === 0 && addedDevices.length === 0;
  const token = 'sx_' + Math.random().toString(36).slice(2, 10);
  const ps1 = `powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://www.syndrax.io/connect.ps1 | iex" # token ${token}`;

  $('#content').innerHTML = `
    <section class="node-cluster-shell">
      <div class="page-head" style="margin-bottom:0">
        <div>
          <h2 style="font:800 20px var(--nav-font);letter-spacing:.14em;color:#e9f6ff;margin:0">NODE CLUSTER <span style="color:#18E4FF">// SYNDRAX</span></h2>
          <p style="font-size:11px;color:rgba(255,255,255,0.35);margin:4px 0 0">Your fleet, your control — every node on its own IP.</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${!ext.installed ? `<button class="app-btn sm" id="useThisPc">Use this PC</button>` : ''}
          ${showFleet ? `<button class="app-btn sm ghost" id="addDev">${icon('plus')} Add node</button>` : `<button class="app-btn sm" data-up="growth">Upgrade to add nodes</button>`}
        </div>
      </div>

      ${firstTime ? `<section class="cluster-onboarding">
        <div class="shield-orb">${icon('shield')}</div>
        <div><strong>First-time setup: connect this PC as your main node.</strong><span>Install the Syndrax extension and click Use this PC — it auto-detects your IP and becomes root-main.</span></div>
        <button class="app-btn sm" id="useThisPc2">${icon('monitor')} Use this PC</button>
      </section>` : ''}

      <section class="cluster-stats">
        ${clusterStat('Total nodes', all.length, '', 'All machines')}
        ${clusterStat('Online', onlineCount, 'good', onlineCount + '/' + all.length + ' active')}
        ${clusterStat('Offline', offlineCount, offlineCount ? 'bad' : '', offlineCount ? 'Needs attention' : 'All healthy')}
        ${clusterStat('Accounts', accounts.length, '', 'Across cluster')}
        ${clusterStat('Active jobs', activeJobCount, activeJobCount ? 'good' : '', 'Running now')}
        ${clusterStat('Health', health + '%', health >= 80 ? 'good' : health >= 50 ? '' : 'bad', 'Cluster health')}
      </section>

      <div class="cluster-workspace">
        <div>
          <div class="node-stage">
            <div class="node-row">
              ${all.map((n, i) => nodeUnitHtml(n, i)).join('')}
              ${showFleet ? addNodeSlotHtml() : ''}
            </div>
            <div class="cluster-rail">
              <div class="cluster-rail-track"></div>
              <div class="cluster-rail-pulse"></div>
              <div class="cluster-rail-label">Syndrax cluster network</div>
            </div>
          </div>

          <section class="activity-ribbon">
            ${clusterActivityHtml(all)}
          </section>

          ${cloudNodes.length ? `<div class="panel" style="margin-top:16px"><div class="panel-h">Node type override <span style="color:rgba(255,255,255,0.35);font-weight:500;text-transform:none;letter-spacing:0">— auto-detected; override remote/RDP here</span></div>
            ${cloudNodes.map(n => `<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
              <span style="flex:1;color:rgba(255,255,255,0.55);font-size:12px">${esc(n.name || n.deviceId)} <span style="color:rgba(255,255,255,0.35);font-size:10px">· ${esc(n.ip || '—')}</span></span>
              <select data-nodetype="${esc(n.id)}" style="width:auto;min-width:170px">
                ${['current', 'remote', 'rdp'].map(t => `<option value="${t}" ${n.nodeType === t ? 'selected' : ''}>${t === 'current' ? 'This PC (local)' : t === 'rdp' ? 'RDP / remote desktop' : 'Remote node'}</option>`).join('')}
              </select>
            </div>`).join('')}
          </div>` : ''}

          <div class="wf-note" style="margin-top:10px">Power on/off, Wake-on-LAN and live screen control run in the Syndrax extension (cluster control). <span class="link" data-openext="1">Open cluster control →</span></div>
        </div>

        <aside class="node-setup-panel" id="nodeSetupPanel">
          <div class="panel-title">
            <div>
              <h3>${icon('monitor')} Add a remote node</h3>
              <p>Spin up a node on an outside PC — its own machine, its own IP. Run the secure connector there or register it manually.</p>
            </div>
          </div>
          <div class="setup-tabs">
            <button class="setup-tab active" data-stab="powershell">⚡ Quick connect</button>
            <button class="setup-tab" data-stab="manual">Register manually</button>
          </div>
          <div id="stabContent">
            <div class="command-box">
              <code>${esc(ps1)}</code>
              <div class="copy-row">
                <div class="command-progress"></div>
                <button class="app-btn sm" id="copyNodeCmd">Copy</button>
              </div>
            </div>
            <div class="secure-note">🔒 Installs the Chrome Web Store build as a locked endpoint. It accepts jobs from your main PC but cannot reverse-connect or read other nodes' IPs.</div>
            <div class="setup-benefits">
              <div class="setup-benefit"><strong>One node</strong><span>per IP</span></div>
              <div class="setup-benefit"><strong>Isolated</strong><span>&amp; secure</span></div>
              <div class="setup-benefit"><strong>Auto-detects</strong><span>&amp; registers</span></div>
            </div>
            <p style="margin-top:14px;font-size:10px;color:rgba(255,255,255,0.35)">After it runs, the node signs in and appears here automatically. Its MAC and static IP sync from the endpoint.</p>
          </div>
          <button class="app-btn sm ghost" style="width:100%;margin-top:12px" id="manualRegisterBtn">${icon('monitor')} Register manually instead</button>
        </aside>
      </div>
    </section>`;

  $('#content').querySelectorAll('[data-up]').forEach(b => b.onclick = () => startCheckout(b.dataset.up).catch(e => showAlert(e.message)));
  $('#content').querySelectorAll('[data-copyip]').forEach(b => b.onclick = (e) => { e.stopPropagation(); navigator.clipboard?.writeText(b.dataset.copyip).then(() => showToast('IP copied', 'success')).catch(() => {}); });
  $('#content').querySelectorAll('.node-unit').forEach(u => u.onclick = (e) => {
    if (e.target.closest('.nu-btn') || e.target.closest('[data-copyip]')) return;
    const n = all.find(x => String(x.id || x.name) === u.dataset.tower);
    if (n) { playSfx('scan'); openNodeDetail(n, all); }
  });
  $('#content').querySelectorAll('[data-tower-manage]').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const n = all.find(x => String(x.id || x.name) === b.dataset.towerManage);
    if (!n) return;
    if ((n.local || n.nodeType === 'current') && ext.installed && ext.id) window.open(`chrome-extension://${ext.id}/dashboard.html`, '_blank');
    else { playSfx('scan'); openNodeDetail(n, all); }
  });
  $('#content').querySelectorAll('[data-nodetype]').forEach(s => s.onchange = async () => {
    try { await updateNode(s.dataset.nodetype, { nodeType: s.value }); const n = cloudNodes.find(x => String(x.id) === String(s.dataset.nodetype)); if (n) n.nodeType = s.value; playSfx('confirm'); showToast('Node type updated.', 'success'); renderDevices(); }
    catch (e) { showAlert(e.message || 'Could not update node.'); }
  });
  $('#content').querySelectorAll('[data-stab]').forEach(b => b.onclick = () => {
    $('#content').querySelectorAll('[data-stab]').forEach(x => x.classList.toggle('active', x === b));
    playSfx('nav');
    const stab = b.dataset.stab;
    const stabContent = $('#stabContent');
    if (stab === 'manual') { stabContent.innerHTML = `<div style="margin-top:12px"><p style="font-size:10px;color:rgba(255,255,255,0.35);margin:0 0 10px">Enter the remote PC details — after you add it here, run the Syndrax extension on that machine and it will auto-link.</p><button class="app-btn sm" id="manualRegBtn2" style="width:100%">${icon('plus')} Open manual register</button></div>`; const m = $('#manualRegBtn2'); if (m) m.onclick = openAddDevice; }
    else { stabContent.innerHTML = `<div class="command-box"><code>${esc(ps1)}</code><div class="copy-row"><div class="command-progress"></div><button class="app-btn sm" id="copyNodeCmd2">Copy</button></div></div><div class="secure-note">🔒 Installs the Chrome Web Store build as a locked endpoint. It accepts jobs from your main PC but cannot reverse-connect or read other nodes' IPs.</div><div class="setup-benefits"><div class="setup-benefit"><strong>One node</strong><span>per IP</span></div><div class="setup-benefit"><strong>Isolated</strong><span>&amp; secure</span></div><div class="setup-benefit"><strong>Auto-detects</strong><span>&amp; registers</span></div></div>`; const cc = $('#copyNodeCmd2'); if (cc) cc.onclick = () => { navigator.clipboard.writeText(ps1).then(() => { cc.textContent = 'Copied!'; setTimeout(() => { cc.textContent = 'Copy'; }, 2000); }); playSfx('confirm'); }; }
  });
  const rec = $('#recruit'); if (rec) rec.onclick = () => { playSfx('nav'); openAddDevice(); };
  const add = $('#addDev'); if (add) add.onclick = () => { playSfx('nav'); openAddDevice(); };
  const mreg = $('#manualRegisterBtn'); if (mreg) mreg.onclick = openAddDevice;
  const cc = $('#copyNodeCmd'); if (cc) cc.onclick = () => { navigator.clipboard.writeText(ps1).then(() => { cc.textContent = 'Copied!'; setTimeout(() => { cc.textContent = 'Copy'; }, 2000); }); playSfx('confirm'); };
  [document.getElementById('useThisPc'), document.getElementById('useThisPc2')].forEach(usel => { if (!usel) return; usel.onclick = () => {
    if (ext.installed) { playSfx('confirm'); syncExtensionAccounts().then(renderDevices); }
    else { playSfx('error'); showAlert('Install the Syndrax extension on this PC, then click Use this PC — it auto-detects your IP.', 'error'); window.open('https://chromewebstore.google.com/detail/mgapfpdkkihbeehfkgoajhealmgpnglo', '_blank'); }
  }; });
  const openExt = $('#content [data-openext]'); if (openExt) openExt.onclick = () => {
    if (ext.installed && ext.id) window.open(`chrome-extension://${ext.id}/dashboard.html`, '_blank');
    else showAlert('Install the Syndrax extension to control the cluster.', 'error');
  };
}

function openNodeDetail(n, all) {
  const isRoot = !!(n.local || n.nodeType === 'current');
  const state = getNodeState(n);
  const on = state === 'online';
  const typeLabel = isRoot ? 'This PC' : n.nodeType === 'rdp' ? 'RDP' : 'Remote';
  const ipLabel = n.ip || (isRoot ? (thisPcIp || '—') : '—');
  const initials = (String(n.name || 'ND').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) || 'ND').toUpperCase();
  const accts = accounts.filter(a => isRoot ? (!a.nodeId && !a.node_id) : (a.nodeId === n.id || a.node_id === n.id || a.device_id === n.deviceId));
  const nJobs = jobs.filter(j => (isRoot ? (!j.nodeId && !j.node_id) : (j.nodeId === n.id || j.node_id === n.id))).slice(0, 8);

  const bodies = {
    stats: () => `<div class="ndm-grid">
      <div class="ndm-kv"><label>Status</label><span>${esc(state)}</span></div>
      <div class="ndm-kv"><label>Type</label><span>${esc(typeLabel)}</span></div>
      <div class="ndm-kv"><label>IP address</label><span>${esc(ipLabel)}</span></div>
      <div class="ndm-kv"><label>Device ID</label><span>${esc(n.deviceId || n.id || '—')}</span></div>
      <div class="ndm-kv"><label>Accounts</label><span>${accts.length}</span></div>
      <div class="ndm-kv"><label>Active jobs</label><span>${nJobs.filter(j => j.status === 'running' || j.status === 'accepted').length}</span></div>
    </div>`,
    accounts: () => accts.length
      ? `<div class="ndm-grid">${accts.map(a => `<div class="ndm-kv"><label>${esc(a.marketplace || '—')}</label><span>${esc(a.label || a.account_name || '—')}</span></div>`).join('')}</div>`
      : `<p style="color:#3a5068;font-size:12px;margin:0">No marketplace accounts on this node.</p>`,
    jobs: () => nJobs.length
      ? nJobs.map(j => `<div class="ndm-kv" style="margin-bottom:6px"><label>${esc((j.status || '').toUpperCase())}</label><span>${esc(j.script || j.name || 'Job')}</span></div>`).join('')
      : `<p style="color:#3a5068;font-size:12px;margin:0">No recent jobs on this node.</p>`,
  };

  let activeTab = 'stats';
  const bg = document.createElement('div');
  bg.className = 'ndm-bg';
  const close = () => bg.remove();
  bg.onclick = (e) => { if (e.target === bg) close(); };

  const render = () => {
    bg.innerHTML = `<div class="ndm">
      <div class="ndm-hdr">
        <div class="ndm-hdr-l">
          <div class="ndm-emblem">${esc(initials)}</div>
          <div class="ndm-title">
            <h2>${esc(String(n.name || 'NODE').toUpperCase())}</h2>
            <div class="ndm-meta">
              <span class="ndm-sdot${on ? '' : ' off'}"></span>
              <span class="ndm-stext">${esc(state.toUpperCase())} · ${esc(typeLabel.toUpperCase())}</span>
              <span class="ndm-ip">${esc(ipLabel)}</span>
            </div>
          </div>
        </div>
        <button class="ndm-x" id="ndmClose">${icon('x')}</button>
      </div>
      <div class="ndm-vp">
        <div class="ndm-vp-inner">${icon('monitor')}<span>Live screen · open in extension</span></div>
      </div>
      <div class="ndm-ctrls">
        ${isRoot && ext.installed && ext.id ? `<button class="ndm-ctrl pri" id="ndmOpenExt">Open extension</button>` : ''}
        <button class="ndm-ctrl" id="ndmNodeCtrl">Node control</button>
        ${n.id && !n.local ? `<button class="ndm-ctrl dng" id="ndmRemove">Remove node</button>` : ''}
      </div>
      <div class="ndm-tabs">
        ${['stats','accounts','jobs'].map(t => `<button class="ndm-tab${t === activeTab ? ' on' : ''}" data-ndmtab="${t}">${t.charAt(0).toUpperCase()+t.slice(1)}</button>`).join('')}
      </div>
      <div class="ndm-body">${bodies[activeTab]()}</div>
    </div>`;

    document.getElementById('ndmClose').onclick = close;
    const oe = document.getElementById('ndmOpenExt'); if (oe) oe.onclick = () => { window.open(`chrome-extension://${ext.id}/dashboard.html`, '_blank'); close(); };
    const nc = document.getElementById('ndmNodeCtrl'); if (nc) nc.onclick = () => showAlert('Power, Wake-on-LAN and live screen run in the Syndrax extension cluster control.', 'success');
    const rm = document.getElementById('ndmRemove'); if (rm) rm.onclick = () => {
      addedDevices = addedDevices.filter(d => d.id !== n.id);
      saveDevices(); close(); playSfx('offline'); renderDevices();
    };
    bg.querySelectorAll('[data-ndmtab]').forEach(b => b.onclick = () => { activeTab = b.dataset.ndmtab; render(); });
  };

  render();
  document.body.appendChild(bg);
}

function clusterStat(label, value, tone, sub) {
  return `<div class="cluster-stat"><label>${esc(label)}</label><strong class="${tone || ''}">${esc(String(value))}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
}

function existingIps() {
  const ips = [];
  if (thisPcIp) ips.push(thisPcIp);
  nodes.forEach(n => n.ip && ips.push(n.ip));
  addedDevices.forEach(d => d.ip && ips.push(d.ip));
  return ips;
}

function openAddDevice() {
  // A remote node is meant to live on an OUTSIDE PC, on its OWN IP. Primary path
  // is a one-line PowerShell that force-installs the Web Store extension as a
  // locked endpoint (no reverse-connect to other nodes). Manual register is the
  // fallback. IP is required (audit needs it) and checked for cross-IP overlap.
  const token = 'sx_' + Math.random().toString(36).slice(2, 10);
  const ps1 = `powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://www.syndrax.io/connect.ps1 | iex" # token ${token}`;
  let method = 'remote';
  const host = document.createElement('div');
  host.className = 'modal-bg';

  function body() {
    return `<div class="modal wide" onclick="event.stopPropagation()">
      <h3>${icon('monitor')} Add a remote node</h3>
      <p class="modal-sub">Spin up a node on an outside PC — its own machine, its own IP. Run the secure connector on that PC, or register it by name + IP.</p>
      <div class="add-dev">
        <div class="add-visual">
          <div class="scan"></div>
          <div class="tower" style="width:120px;height:${Math.round(120 * 620 / 220)}px;position:relative">
            <div style="position:absolute;inset:0">${nodeShellSVG('addviz', '#18E4FF', '#00A9FF', '#123A4D', true)}</div>
          </div>
        </div>
        <div>
          <div class="method-tabs">
            <button class="method-tab ${method === 'remote' ? 'on' : ''}" data-m="remote">⚡ Quick connect (PowerShell)</button>
            <button class="method-tab ${method === 'manual' ? 'on' : ''}" data-m="manual">Register manually</button>
          </div>
          <div id="mBody"></div>
        </div>
      </div>
    </div>`;
  }

  function remoteBody() {
    // B1 security-cleanup 2026-06-23: SHA-256 of connect.ps1 published for verification.
    // To verify before running: Get-FileHash (irm https://www.syndrax.io/connect.ps1 -OutFile $env:TEMP\syndrax-connect.ps1); $env:TEMP\syndrax-connect.ps1
    const CONNECT_SHA256 = '114f60896aeb8138ca2f36cbfd0ad4278839e7f47399fb6f98f5779f44e79efa';
    return `
      <p style="font-size:12.5px;color:rgba(255,255,255,0.45);margin:0 0 8px">On the <b style="color:rgba(255,255,255,0.55)">remote PC</b>, open PowerShell <b>as Administrator</b> and paste:</p>
      <div class="ps1-box"><code id="ps1code">${esc(ps1)}</code><button class="app-btn sm" id="ps1copy">Copy</button></div>
      <div class="sec-note">🔒 Installs the <b>Chrome Web Store</b> build only, as a <b>locked endpoint</b> — it takes jobs from your main PC but can't reverse-connect or read other nodes' IPs. Secure by default for outside machines.</div>
      <details style="margin-top:10px;cursor:pointer">
        <summary style="font-size:11px;color:rgba(255,255,255,0.35);user-select:none">🛡️ Verify script integrity before running (recommended)</summary>
        <div style="margin-top:6px;padding:8px;background:#0d1929;border:1px solid #1e3a5f;border-radius:6px;font-size:11px;color:rgba(255,255,255,0.45)">
          <p style="margin:0 0 4px">This script writes to HKLM (Chrome managed policy) and records this PC's IP + MAC as a locked endpoint. That's intentional. To verify it hasn't been tampered with:</p>
          <pre style="margin:4px 0;padding:6px;background:#0a111f;border-radius:4px;color:#7dd3fc;white-space:pre-wrap;word-break:break-all">irm https://www.syndrax.io/connect.ps1 -OutFile "$env:TEMP\\syndrax-connect.ps1"\n(Get-FileHash "$env:TEMP\\syndrax-connect.ps1" -Algorithm SHA256).Hash</pre>
          <p style="margin:4px 0 0">Expected SHA-256: <code style="color:#34d399;word-break:break-all">${esc(CONNECT_SHA256)}</code></p>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.35)">If the hash matches, run: <code style="color:#f5f5f5">Set-ExecutionPolicy Bypass -Scope Process; &amp; "$env:TEMP\\syndrax-connect.ps1"</code></p>
        </div>
      </details>
      <p style="font-size:11.5px;color:rgba(255,255,255,0.35);margin-top:10px">After it runs, the node signs in and appears here automatically — its MAC + static IP sync from the endpoint. IP is required for the safety audit.</p>`;
  }

  function manualBody() {
    return `
      <label>Device name</label>
      <input id="dName" placeholder="e.g. root168 or Warehouse-PC">
      <label>IP address <span style="color:#fca5a5">(required — audit)</span></label>
      <div class="ip-row"><input id="dIp" placeholder="e.g. 50.190.39.168"><button class="app-btn ghost sm" id="dAuto">Auto-detect</button></div>
      <div id="ipWarn"></div>
      <div class="app-btn-row" style="margin-top:16px">
        <button class="app-btn" id="dAdd">Add to cluster</button>
        <button class="app-btn ghost" id="dCancel2">Cancel</button>
      </div>`;
  }

  function paint() {
    host.innerHTML = body();
    $('#mBody', host).innerHTML = method === 'remote' ? remoteBody() : manualBody();
    host.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { method = b.dataset.m; paint(); });
    if (method === 'remote') {
      $('#ps1copy', host).onclick = () => { navigator.clipboard?.writeText(ps1); $('#ps1copy', host).textContent = 'Copied ✓'; };
    } else {
      const ipInput = $('#dIp', host);
      const warn = $('#ipWarn', host);
      const checkIp = () => {
        const v = ipInput.value.trim();
        warn.innerHTML = v && existingIps().includes(v)
          ? `<div class="ip-warn">⚠️ <b>Cross-IP contamination:</b> this IP already runs another node. Marketplaces can link accounts that share an IP — allowed, but it <b>raises your audit risk</b>. Best practice: one node = one IP.</div>`
          : '';
      };
      ipInput.oninput = checkIp;
      $('#dAuto', host).onclick = () => {
        if (thisPcIp) { ipInput.value = thisPcIp; checkIp(); }
        else showAlert('Auto-detect needs the extension on this PC (it reports the IP). For a remote node, use Quick connect.', 'error');
      };
      $('#dCancel2', host).onclick = () => host.remove();
      $('#dAdd', host).onclick = () => {
        const name = $('#dName', host).value.trim();
        const ip = ipInput.value.trim();
        if (!name) { $('#dName', host).style.borderColor = '#f87171'; return; }
        if (!ip) { ipInput.style.borderColor = '#f87171'; return; }
        const dup = existingIps().includes(ip);
        addedDevices.push({ id: 'dev-' + Date.now().toString(36), name, ip, status: 'offline', sharedIp: dup });
        saveDevices(); host.remove(); playSfx('deploy'); renderDevices();
        showAlert(dup ? `${name} added — ⚠️ shares an IP with another node (audit risk raised).` : `${name} added to your cluster.`, dup ? 'error' : 'success');
      };
    }
  }

  host.onclick = () => host.remove();
  document.body.appendChild(host);
  paint();
}

// ── Enterprise sample data for preview mode ───────────────────────────────────
const SAMPLE_TEAM_MEMBERS = [
  { id: 1, email: 'olegperchatkin@gmail.com', full_name: 'Oleg P.', role: 'owner', is_admin: true, last_login: new Date(Date.now() - 1800000).toISOString(), created_at: new Date(Date.now() - 86400000 * 120).toISOString() },
  { id: 2, email: 'danish@syndrax.io', full_name: 'Muhammad Danish', role: 'admin', is_admin: true, last_login: new Date(Date.now() - 3600000).toISOString(), created_at: new Date(Date.now() - 86400000 * 60).toISOString() },
  { id: 3, email: 'sarah.lister@gmail.com', full_name: 'Sarah K.', role: 'user', is_admin: false, last_login: new Date(Date.now() - 7200000).toISOString(), created_at: new Date(Date.now() - 86400000 * 45).toISOString() },
  { id: 4, email: 'mike.fulfillment@gmail.com', full_name: 'Mike T.', role: 'user', is_admin: false, last_login: new Date(Date.now() - 21600000).toISOString(), created_at: new Date(Date.now() - 86400000 * 30).toISOString() },
  { id: 5, email: 'jessica.ops@gmail.com', full_name: 'Jessica R.', role: 'user', is_admin: false, last_login: new Date(Date.now() - 43200000).toISOString(), created_at: new Date(Date.now() - 86400000 * 14).toISOString() },
  { id: 6, email: 'tom.analytics@gmail.com', full_name: 'Tom V.', role: 'user', is_admin: false, last_login: null, created_at: new Date(Date.now() - 86400000 * 3).toISOString() },
];
const SAMPLE_PENDING_INVITES = [
  { id: 101, email: 'alexa.support@gmail.com', role: 'user', expires_at: new Date(Date.now() + 86400000 * 2).toISOString(), created_at: new Date(Date.now() - 3600000 * 5).toISOString() },
  { id: 102, email: 'contractor@listingpro.io', role: 'user', expires_at: new Date(Date.now() + 86400000).toISOString(), created_at: new Date(Date.now() - 3600000 * 18).toISOString() },
];

function tmTimeAgo(iso) {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function avatarInitials(member) {
  const n = member.full_name || member.email || '?';
  const parts = n.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : n.slice(0, 2).toUpperCase();
}

function roleBadge(role) {
  if (role === 'owner') return '<span class="tm-badge owner">Owner</span>';
  if (role === 'admin') return '<span class="tm-badge admin">Admin</span>';
  return '<span class="tm-badge user">Member</span>';
}

function memberCard(m, callerRole, isSelf) {
  const initials = avatarInitials(m);
  const online = m.last_login && (Date.now() - new Date(m.last_login).getTime()) < 3600000 * 3;
  const canRemove = (callerRole === 'owner' || callerRole === 'admin') && m.role !== 'owner' && !isSelf;
  return `<div class="tm-member-card">
    <div class="tm-avatar" data-role="${m.role}"><span>${initials}</span>${online ? '<span class="tm-dot"></span>' : ''}</div>
    <div class="tm-member-info">
      <div class="tm-member-name">${m.full_name || m.email}${roleBadge(m.role)}</div>
      <div class="tm-member-email">${m.email}</div>
      <div class="tm-member-meta">Last active ${tmTimeAgo(m.last_login)}</div>
    </div>
    ${canRemove ? `<button class="tm-remove-btn" data-remove-user="${m.id}" title="Remove member">✕</button>` : ''}
  </div>`;
}

function inviteCard(inv, callerRole) {
  const canRevoke = callerRole === 'owner' || callerRole === 'admin';
  const expiresIn = Math.max(0, Math.round((new Date(inv.expires_at).getTime() - Date.now()) / 3600000));
  return `<div class="tm-member-card tm-invite-card">
    <div class="tm-avatar" data-role="pending"><span>?</span></div>
    <div class="tm-member-info">
      <div class="tm-member-name">${inv.email}<span class="tm-badge pending">Pending</span></div>
      <div class="tm-member-email">${inv.role === 'admin' ? 'Invited as admin' : 'Invited as member'} · expires in ${expiresIn}h</div>
      <div class="tm-member-meta">Sent ${tmTimeAgo(inv.created_at)}</div>
    </div>
    ${canRevoke ? `<button class="tm-remove-btn" data-revoke-invite="${inv.id}" title="Revoke invite">✕</button>` : ''}
  </div>`;
}

async function renderTeam() {
  $('#topSub').textContent = '';
  const seats = PLAN_LIMITS[plan].teamSeats;
  const seatLabel = isUnlimited(seats) ? 'Unlimited' : String(seats);
  const canTeam = plan !== 'none' && plan !== 'trial';

  // Skeleton while loading
  $('#content').innerHTML = `<div class="page team-page"><div class="team-loading">Loading team…</div></div>`;

  let members = [], pendingInvites = [], callerRole = 'owner';

  if (previewMode()) {
    members = SAMPLE_TEAM_MEMBERS;
    pendingInvites = SAMPLE_PENDING_INVITES;
    callerRole = 'owner';
  } else if (canTeam) {
    try {
      const data = await getTeamMembers();
      members = data.members || [];
      pendingInvites = data.pendingInvites || [];
      callerRole = data.callerRole || 'user';
    } catch (e) {
      members = [];
      pendingInvites = [];
    }
  }

  const isManagerRole = callerRole === 'owner' || callerRole === 'admin';
  const usedSeats = members.length + pendingInvites.length;
  const maxSeats = isUnlimited(seats) ? '∞' : seats;
  const owner = members.find(m => m.role === 'owner');
  const admins = members.filter(m => m.role === 'admin');
  const regularMembers = members.filter(m => m.role === 'user');

  const hierarchyHtml = !canTeam ? '' : `
    <div class="tm-hierarchy">
      ${owner ? `
        <div class="tm-tier tm-tier-owner">
          <div class="tm-tier-label">Owner</div>
          <div class="tm-tier-cards">
            ${memberCard(owner, callerRole, owner.email === email)}
          </div>
        </div>
        <div class="tm-connector"></div>` : ''}
      ${admins.length ? `
        <div class="tm-tier tm-tier-admin">
          <div class="tm-tier-label">Admins</div>
          <div class="tm-tier-cards">
            ${admins.map(m => memberCard(m, callerRole, m.email === email)).join('')}
          </div>
        </div>
        <div class="tm-connector"></div>` : ''}
      ${regularMembers.length ? `
        <div class="tm-tier tm-tier-members">
          <div class="tm-tier-label">Members</div>
          <div class="tm-tier-cards">
            ${regularMembers.map(m => memberCard(m, callerRole, m.email === email)).join('')}
          </div>
        </div>` : ''}
      ${pendingInvites.length ? `
        ${regularMembers.length ? '<div class="tm-connector tm-connector-dashed"></div>' : (admins.length ? '<div class="tm-connector tm-connector-dashed"></div>' : '')}
        <div class="tm-tier tm-tier-pending">
          <div class="tm-tier-label">Pending invites</div>
          <div class="tm-tier-cards">
            ${pendingInvites.map(inv => inviteCard(inv, callerRole)).join('')}
          </div>
        </div>` : ''}
      ${members.length === 0 && pendingInvites.length === 0 ? `
        <div class="tm-empty"><div class="tm-empty-icon">👥</div><p>No team members yet.<br>Invite your first teammate below.</p></div>` : ''}
    </div>`;

  const inviteFormHtml = isManagerRole && canTeam ? `
    <div class="card tm-invite-card-form">
      <div class="card-header"><h3>${icon('users')} Invite a teammate</h3></div>
      <div class="card-body">
        <p style="font-size:12.5px;color:var(--text-muted);margin:0 0 16px;line-height:1.6">They'll get a branded email with a secure 72-hour link. Once accepted, they'll see all shared nodes and accounts.</p>
        <div class="tm-invite-row" id="tmInviteRow">
          <input type="email" id="tmInviteEmail" class="tm-invite-input" placeholder="teammate@gmail.com" autocomplete="email">
          <select id="tmInviteRole" class="tm-invite-select">
            <option value="user">Member</option>
            ${callerRole === 'owner' ? '<option value="admin">Admin</option>' : ''}
            ${callerRole === 'owner' ? '<option value="owner">Co-owner</option>' : ''}
          </select>
          <button class="btn primary" id="tmInviteBtn">Send invite</button>
        </div>
        <div id="tmInviteResult" style="margin-top:10px;font-size:12.5px;display:none"></div>
      </div>
    </div>` : '';

  $('#content').innerHTML = `<div class="page team-page" style="max-width:900px">
    <div class="team-layout">
      <div class="team-main">
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div>
              <h3>${icon('users')} Team workspace</h3>
              <p>${PLAN_LABEL[plan]} · ${usedSeats} / ${maxSeats} seat${maxSeats === 1 ? '' : 's'} used</p>
            </div>
            <div class="tm-seat-bar">
              <div class="tm-seat-fill" style="width:${maxSeats === '∞' ? 0 : Math.min(100, Math.round(usedSeats / seats * 100))}%"></div>
            </div>
          </div>
          <div class="card-body" style="padding-top:0">
            ${!canTeam ? `<div class="empty-state"><div class="empty-inner">
              <div class="empty-icon">${icon('users')}</div>
              <h3>Team requires Business or higher</h3>
              <p>Upgrade to invite teammates. They share your workspace, nodes, and accounts.</p>
              <button class="btn primary" data-go="plan">View plans</button>
            </div></div>` : hierarchyHtml}
          </div>
        </div>
        ${inviteFormHtml}
      </div>

      <div class="team-sidebar">
        <div class="card">
          <div class="card-header"><h3>Access rules</h3></div>
          <div class="card-body">
            <div class="feature-list">
              <div class="feature-item"><div class="feature-dot blue"></div><span>All members share nodes &amp; accounts</span></div>
              <div class="feature-item"><div class="feature-dot blue"></div><span>Admins can invite &amp; remove members</span></div>
              <div class="feature-item"><div class="feature-dot blue"></div><span>Owner can appoint admins</span></div>
              <div class="feature-item"><div class="feature-dot amber"></div><span>Per-member ACLs coming soon</span></div>
            </div>
          </div>
        </div>
        <div class="card" style="margin-top:12px">
          <div class="card-header"><h3>How invites work</h3></div>
          <div class="card-body">
            <div class="feature-list">
              <div class="feature-item"><div class="feature-dot"></div><div><strong style="font-size:11.5px;color:var(--text-1)">Enter email</strong><div style="color:var(--text-muted);font-size:11px;margin-top:2px">Select member or admin role</div></div></div>
              <div class="feature-item"><div class="feature-dot"></div><div><strong style="font-size:11.5px;color:var(--text-1)">Email sent</strong><div style="color:var(--text-muted);font-size:11px;margin-top:2px">Branded invite, 72-hour link</div></div></div>
              <div class="feature-item"><div class="feature-dot"></div><div><strong style="font-size:11.5px;color:var(--text-1)">They create account</strong><div style="color:var(--text-muted);font-size:11px;margin-top:2px">Choose their own password</div></div></div>
              <div class="feature-item"><div class="feature-dot"></div><div><strong style="font-size:11.5px;color:var(--text-1)">Shared workspace</strong><div style="color:var(--text-muted);font-size:11px;margin-top:2px">Instant access to all nodes &amp; tools</div></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  $('#content').querySelectorAll('[data-go]').forEach(b => b.onclick = () => { activeTab = b.dataset.go; renderShell(); });

  // Remove member
  $('#content').querySelectorAll('[data-remove-user]').forEach(btn => {
    btn.onclick = async () => {
      if (previewMode()) { showAlert('Preview mode — action disabled', 'info'); return; }
      const userId = btn.dataset.removeUser;
      const name = btn.closest('.tm-member-card')?.querySelector('.tm-member-name')?.textContent?.split('\n')[0]?.trim() || userId;
      if (!confirm(`Remove ${name} from the team? They will lose access immediately.`)) return;
      try {
        await removeTeamMember(userId);
        showAlert('Member removed.', 'ok');
        renderTeam();
      } catch (e) { showAlert(e.message || 'Failed to remove member', 'error'); }
    };
  });

  // Revoke invite
  $('#content').querySelectorAll('[data-revoke-invite]').forEach(btn => {
    btn.onclick = async () => {
      if (previewMode()) { showAlert('Preview mode — action disabled', 'info'); return; }
      const inviteId = btn.dataset.revokeInvite;
      try {
        await revokeTeamInvite(inviteId);
        showAlert('Invite revoked.', 'ok');
        renderTeam();
      } catch (e) { showAlert(e.message || 'Failed to revoke invite', 'error'); }
    };
  });

  // Invite form
  const invBtn = $('#tmInviteBtn');
  if (invBtn) {
    invBtn.onclick = async () => {
      const emailInput = $('#tmInviteEmail');
      const roleSelect = $('#tmInviteRole');
      const resultEl = $('#tmInviteResult');
      const invEmail = (emailInput?.value || '').trim();
      const invRole = roleSelect?.value || 'user';
      if (!invEmail) { emailInput?.focus(); return; }
      invBtn.disabled = true;
      invBtn.textContent = 'Sending…';
      resultEl.style.display = 'none';
      try {
        if (previewMode()) {
          await new Promise(r => setTimeout(r, 900));
          resultEl.innerHTML = `<span style="color:#d4d4d4">✓ Preview: invite would be sent to <strong>${invEmail}</strong> as ${invRole}.</span>`;
          resultEl.style.display = 'block';
          emailInput.value = '';
        } else {
          const resp = await inviteTeamMember(invEmail, invRole);
          if (resp.email_delivered) {
            resultEl.innerHTML = `<span style="color:#d4d4d4">✓ Invite email sent to <strong>${invEmail}</strong>. They'll get it shortly.</span>`;
          } else if (resp.accept_url) {
            resultEl.innerHTML = `<span style="color:#f59e0b">⚠ Invite created but email couldn't be sent. Share this link manually:<br>
              <a href="${resp.accept_url}" target="_blank" style="color:#d4d4d4;font-size:11px;word-break:break-all">${resp.accept_url}</a>
              <button onclick="navigator.clipboard.writeText('${resp.accept_url}').then(()=>this.textContent='Copied!')"
                style="margin-left:8px;padding:2px 8px;font-size:11px;border:1px solid #d4d4d4;background:transparent;color:#d4d4d4;border-radius:5px;cursor:pointer">Copy</button></span>`;
          } else {
            resultEl.innerHTML = `<span style="color:#d4d4d4">✓ Invite created for <strong>${invEmail}</strong>.</span>`;
          }
          resultEl.style.display = 'block';
          emailInput.value = '';
          setTimeout(() => renderTeam(), 2500);
        }
      } catch (e) {
        resultEl.innerHTML = `<span style="color:#ef4444">✗ ${e.message || 'Failed to send invite'}</span>`;
        resultEl.style.display = 'block';
      } finally {
        invBtn.disabled = false;
        invBtn.textContent = 'Send invite';
      }
    };
    $('#tmInviteEmail')?.addEventListener('keydown', e => { if (e.key === 'Enter') invBtn.click(); });
  }
}

function buildAuditInput() {
  const accountsByMarketplace = {}, accountsPerDevice = {};
  accounts.forEach(a => {
    accountsByMarketplace[a.marketplace] = (accountsByMarketplace[a.marketplace] || 0) + 1;
    const d = a.deviceId || 'this-device'; accountsPerDevice[d] = (accountsPerDevice[d] || 0) + 1;
  });
  const devices = [...new Set(accounts.map(a => a.deviceId || 'this-device'))].map(id => ({ id, name: id === 'this-device' ? 'This device' : id }));
  return { plan, accountsByMarketplace, accountsPerDevice, devices };
}

// Cross-IP contamination: nodes sharing one IP raise marketplace linking risk.
function ipContaminationFindings() {
  const map = {};
  const add = (name, ip) => { if (ip) (map[ip] = map[ip] || []).push(name); };
  if (thisPcIp) add('root-main', thisPcIp);
  nodes.forEach(n => add(n.name, n.ip));
  addedDevices.forEach(d => add(d.name, d.ip));
  const findings = [];
  Object.entries(map).forEach(([ip, names]) => {
    if (names.length > 1) findings.push({ level: 'warn', upgradeTo: null,
      title: `Cross-IP contamination on ${ip}`,
      detail: `${names.join(', ')} share IP ${ip}. Marketplaces flag accounts that share an IP as linked — this raises restriction risk and your audit score. Best practice: one node = one IP (a remote node on its own connection).` });
  });
  return findings;
}

// ── Extension tab — connected Chrome extension installations for THIS user ─────
// HTML builders + load/revoke controller live in app-extension-view.js (unit
// tested). This is the thin DOM adapter: it injects the real data layer + a
// render() that writes #content and re-binds the refresh/revoke buttons.
async function renderExtension() {
  $('#topSub').textContent = 'Chrome Extension';
  const content = $('#content');
  const deps = {
    getStatus: getExtensionStatus,
    revoke: revokeExtension,
    render: (html) => { content.innerHTML = html; bindExt(); },
  };
  function bindExt() {
    content.querySelectorAll('[data-ext-refresh]').forEach(b => { b.onclick = () => loadExtensionPanel(deps); });
    content.querySelectorAll('[data-revoke]').forEach(b => {
      b.onclick = async () => {
        b.disabled = true; b.textContent = 'Revoking…';
        try { await revokeExtensionInstall(deps, b.dataset.revoke); showToast('Extension access revoked.', 'success'); }
        catch (e) { showToast(e.message || 'Revoke failed', 'error'); b.disabled = false; b.textContent = 'Revoke Access'; }
      };
    });
  }
  await loadExtensionPanel(deps);
}

// ── AXIS voice alerts (free, in-browser via Web Speech API — no external key) ──
// Speaks critical warnings. Browsers require a user gesture before audio, so the
// first call is gated behind a click; after that the enterprise 30s loop runs.
function axisSpeak(text) {
  if (!axisVoiceEnabled) return;
  try {
    if (typeof speechSynthesis === 'undefined' || !speechSynthesis) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95; u.pitch = 0.9; u.volume = 0.9;
    const v = speechSynthesis.getVoices().find(x => /en[-_]?US/i.test(x.lang) && /female|samantha|zira|google/i.test(x.name));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch {}
}
function axisVoiceArmed() { return typeof speechSynthesis !== 'undefined' && speechSynthesis && speechSynthesis.speaking; }
// Enterprise loop: every 30s, re-speak the worst active warning. Only runs if the
// user has primed audio (clicked enable) + there's a critical finding.
function startAxisVoiceLoop(worstWarning) {
  if (axisVoiceLoop) clearInterval(axisVoiceLoop);
  if (plan !== 'enterprise') return;
  axisVoiceLoop = setInterval(() => {
    if (axisVoiceEnabled && axisAlertCritical && worstWarning) axisSpeak(worstWarning);
  }, 30000);
}

// Update just the audit nav-item badge (NOT renderShell)
function updateAxisNavBadge() {
  const navBtn = document.querySelector('[data-tab="audit"]');
  if (!navBtn) return;
  navBtn.classList.toggle('nav-alert', axisAlertCount > 0);
  navBtn.classList.toggle('nav-alert-critical', axisAlertCritical && axisAlertCount > 0);
  const oldBadge = navBtn.querySelector('.nav-badge-alert');
  if (axisAlertCount > 0) {
    if (oldBadge) {
      oldBadge.textContent = axisAlertCount;
    } else {
      const badge = document.createElement('span');
      badge.className = 'nav-badge nav-badge-alert';
      badge.textContent = axisAlertCount;
      navBtn.appendChild(badge);
    }
  } else if (oldBadge) {
    oldBadge.remove();
  }
}

// Render eBay telemetry into the global display div
function renderEbayTelemetryDisplay(t) {
  const body = document.getElementById('ebay-tel-display');
  if (!body) return;
  if (!t || t.error) {
    if (t && t.error && t.error !== 'no_telemetry') {
      body.innerHTML = `<div style="color:var(--coral);padding:8px 0;font-size:12px">${esc(t.message || t.error)}</div>`;
    }
    return;
  }
  const metric = (label, value, target, suffix='%') => {
    if (value == null) return `<div style="padding:4px 0"><span style="color:var(--text-muted)">${label}</span> <b style="color:var(--text-muted)">—</b></div>`;
    const ok = target == null || value <= target;
    const color = ok ? 'var(--mint)' : 'var(--coral)';
    return `<div style="padding:4px 0;display:flex;justify-content:space-between;font-size:11px"><span style="color:var(--text-2)">${label}</span> <b style="color:${color}">${value.toFixed(2)}${suffix}${target != null ? ` <span style="font-size:9px;color:var(--text-muted)">≤${target}${suffix}</span>` : ''}</b></div>`;
  };
  const lvl = t.seller_level ? t.seller_level.replace(/_/g,' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : '—';
  const sub = t.store_subscription ? t.store_subscription.replace(/_/g,' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : null;
  const storeHdr = t.store_name
    ? `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:14px;font-weight:800;color:var(--text-1)">${esc(t.store_name)}</span>${sub ? `<span style="font-size:9px;padding:2px 7px;border-radius:6px;background:rgba(99,102,241,.15);color:#a5b4fc;text-transform:uppercase;font-weight:700">${esc(sub)} store</span>` : ''}</div>`
    : `<div style="font-size:11px;color:var(--amber);margin-bottom:8px">◐ Basic seller (no eBay Store subscription) — store name unavailable. Status will update if you upgrade your eBay plan.</div>`;
  body.innerHTML = `
    ${storeHdr}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-top:10px;border-top:1px solid var(--line)">
      <div>
        <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px">Seller Standing</div>
        <div style="font-size:14px;font-weight:800;color:${lvl.includes('Top') ? 'var(--mint)' : lvl.includes('Below') ? 'var(--coral)' : 'var(--text-1)'}">${esc(lvl)}</div>
      </div>
      <div>
        <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;margin-bottom:3px">Inventory</div>
        <div style="font-size:14px;font-weight:800;color:var(--text-1)">${t.active_listing_count ?? '—'} ${t.open_orders != null ? `<span style="font-size:10px;color:var(--text-muted)">· ${t.open_orders} orders</span>` : ''}</div>
      </div>
    </div>
    <div style="margin-top:8px">
      ${metric('Defect Rate', t.defect_rate, 0.5)}
      ${metric('Late Ship Rate', t.late_ship_rate, 3)}
      ${metric('Valid Tracking', t.valid_tracking_rate, 95)}
      ${metric('Cancel Rate', t.cancel_rate, 2)}
    </div>
    <div style="font-size:9px;color:var(--text-muted);margin-top:6px">Synced: ${t.synced_at ? new Date(t.synced_at).toLocaleString() : 'just now'}</div>`;
}

async function renderAudit() {
  $('#topSub').textContent = '';
  let audit = null; try { audit = await getAudit(); } catch {}
  if (!audit || !audit.level) audit = runAudit(buildAuditInput());
  const ipFindings = ipContaminationFindings();
  if (ipFindings.length) audit = { level: 'warn', findings: [...ipFindings, ...(audit.findings || [])] };
  const ok = audit.level === 'ok';
  const findings = audit.findings || [];
  const score = ok ? 92 : Math.max(32, 92 - findings.length * 18);
  const scoreColor = score >= 80 ? 'var(--mint)' : score >= 60 ? 'var(--amber)' : 'var(--coral)';

  // ── Update AXIS alert state (drives the nav blink) ─────────────────────────
  // Critical = VPN/proxy detected, IP cross-contamination, or a high-level finding.
  const hasHigh = findings.some(f => f.level === 'high' || f.level === 'critical');
  const vpnAcct = accounts.some(a => a.ipProxy);
  axisAlertCritical = hasHigh || vpnAcct;
  axisAlertCount = findings.length + (vpnAcct && !findings.length ? 1 : 0);
  const worstWarning = vpnAcct
    ? 'Warning. A proxy or V P N has been detected on one of your accounts. This is a high risk signal for marketplace detection.'
    : findings[0] ? `Attention. ${findings[0].title}. ${findings[0].detail || ''}`.slice(0, 200) : null;
  // Enterprise: prime the 30s voice loop on first audit load (needs a user gesture, see toggle).
  if (plan === 'enterprise' && axisAlertCritical && worstWarning) startAxisVoiceLoop(worstWarning);

  // ── The 6 sentinel categories. Live where we have data, grayed otherwise. ──
  // Account Health + Environment have site-side data now (axisRisk/ipRisk + nodes).
  // The other 4 need the extension telemetry feed (not yet wired) — grayed "pending".
  const catLive = (id, label, icon, score, band, summary, detail) => ({ id, label, icon, live: true, score, band, summary, detail });
  const catPending = (id, label, icon, note) => ({ id, label, icon, live: false, note });

  // Account Health — derive from the per-account axisRisk we compute (v1.12)
  const riskAccts = accounts.filter(a => a.axisRisk === 'high' || a.axisRisk === 'medium');
  const ahScore = riskAccts.length ? Math.min(85, 30 + riskAccts.length * 18) : 8;
  const ahBand = ahScore >= 75 ? 'critical' : ahScore >= 50 ? 'high' : ahScore >= 25 ? 'medium' : 'low';

  // Environment — from node online/offline status
  const offlineNodes = nodes.filter(n => n.status === 'offline').length;
  const envScore = nodes.length && offlineNodes ? Math.min(60, Math.round((offlineNodes / nodes.length) * 70)) : 5;
  const envBand = envScore >= 50 ? 'high' : envScore >= 25 ? 'medium' : 'low';

  const categories = [
    catLive('account_health', 'Account Health', 'shield', ahScore, ahBand,
      riskAccts.length ? `${riskAccts.length} account(s) flagged by AXIS risk detector` : 'All accounts in good standing',
      riskAccts.length ? riskAccts.map(a => `${a.label || a.marketplace}: ${a.axisRisk} (${(a.axisRiskReasons || []).join(', ')})`).join('; ').slice(0, 160) : 'No cross-contamination or proxy signals detected.'),
    catLive('environment', 'Environment Stability', 'monitor', envScore, envBand,
      nodes.length ? `${offlineNodes}/${nodes.length} node(s) offline` : 'No worker nodes registered',
      nodes.length ? (offlineNodes ? 'Offline nodes interrupt sessions mid-action.' : 'All nodes reachable.') : 'Add devices to enable environment monitoring.'),
    catPending('automation', 'Automation Behaviour', 'bot', 'CAPTCHA hits, scrape errors, fingerprint flags — fed by the extension telemetry feed'),
    catPending('listing_velocity', 'Listing Activity', 'briefcase', 'Daily cap usage + warmup overshoots — fed by the extension sync feed'),
    catPending('fulfillment', 'Inventory & Fulfillment', 'box', 'Unmatched sold items, out-of-stock churn — fed by the sync + sales feed'),
    catPending('content_quality', 'Content Quality', 'file-text', 'Duplicate-title ratio in the queue — fed by the bulk lister feed'),
  ];

  const bandColor = { low: 'var(--mint)', medium: 'var(--amber)', high: 'var(--coral)', critical: 'var(--red)' };
  const bandLabel = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
  const catCard = c => c.live ? `
    <div class="axis-cat" data-cat="${c.id}">
      <div class="axis-cat-head">
        <span class="axis-cat-ic" style="color:${bandColor[c.band] || 'var(--text-2)'}">${icon(c.icon)}</span>
        <span class="axis-cat-label">${c.label}</span>
        <span class="axis-cat-band" style="background:${bandColor[c.band]}1f;color:${bandColor[c.band]}">${bandLabel[c.band]}</span>
      </div>
      <div class="axis-cat-score"><div class="axis-cat-bar" style="width:${c.score}%;background:${bandColor[c.band] || 'var(--mint)'}"></div></div>
      <div class="axis-cat-summary">${esc(c.summary)}</div>
      <div class="axis-cat-detail">${esc(c.detail)}</div>
    </div>` : `
    <div class="axis-cat axis-cat-pending" data-cat="${c.id}" title="${esc(c.note)}">
      <div class="axis-cat-head">
        <span class="axis-cat-ic" style="opacity:.4">${icon(c.icon)}</span>
        <span class="axis-cat-label" style="opacity:.5">${c.label}</span>
        <span class="axis-cat-band" style="background:rgba(255,255,255,.05);color:var(--text-muted)">Pending</span>
      </div>
      <div class="axis-cat-pending-note">${esc(c.note)}</div>
      <div class="axis-cat-pending-tag">${icon('lock')} Telemetry feed not connected</div>
    </div>`;

  // Account status grid — real per-account AXIS risk (ipRisk + axisRisk + ISP + geo)
  const acctStatus = accounts.length ? accounts.map(a => {
    const m = marketplace(a.marketplace);
    const logo = marketplaceLogo(a.marketplace) || `<span style="font:800 12px var(--nav-font);color:#fff">${(m?.name || '?')[0]}</span>`;
    const r = a.axisRisk || 'low';
    const rc = bandColor[r === 'high' ? 'high' : r === 'medium' ? 'medium' : 'low'];
    const ipType = a.ipProxy ? 'VPN/Proxy' : a.ipHosting ? 'Datacenter' : a.ipMobile ? 'Cellular' : 'Residential';
    const reasons = (a.axisRiskReasons || []).slice(0, 2).join(' · ');
    return `<div class="axis-acct" style="border-color:${rc}44">
      <div class="axis-acct-logo">${logo}</div>
      <div class="axis-acct-name">${esc(a.label || m?.name || a.marketplace)}</div>
      <div class="axis-acct-ip">${a.ipLast3 ? '•••.' + esc(a.ipLast3) : '—'} <span style="color:${a.ipProxy?'var(--red)':a.ipHosting?'var(--coral)':'var(--text-muted)'}">${ipType}</span></div>
      <div class="axis-acct-risk" style="color:${rc}">${r === 'high' ? '⚠ HIGH' : r === 'medium' ? '◐ MED' : '✓ LOW'}</div>
      ${reasons ? `<div class="axis-acct-reasons">${esc(reasons)}</div>` : ''}
    </div>`;
  }).join('') : `<div style="grid-column:1/-1;color:var(--text-muted);font-size:12px;text-align:center;padding:24px">No connected accounts to audit.</div>`;

  // AXIS recommendations (from the sentinel's recommendation logic, simplified for site data)
  const recs = [];
  if (vpnAcct) recs.push('A proxy/VPN is detected on an account — switch to a clean residential IP before resuming automation.');
  if (riskAccts.length) recs.push(`${riskAccts.length} account(s) flagged for cross-contamination — isolate on separate nodes/IPs.`);
  if (offlineNodes) recs.push(`${offlineNodes} node(s) offline — bring them back before scheduling work.`);
  if (!recs.length) recs.push('Operation is steady. Keep each account isolated on its own node and IP.');

  $('#content').innerHTML = `<div class="page axis-page">
    <div class="axis-hero ${axisAlertCritical ? 'axis-hero-critical' : ok ? 'axis-hero-ok' : 'axis-hero-warn'}">
      <div class="axis-robot" title="AXIS — your compliance sentinel">${axisRobotSvg()}</div>
      <div class="axis-hero-body">
        <div class="axis-hero-title">AXIS <span>Compliance Sentinel</span></div>
        <div class="axis-hero-status">${axisAlertCritical ? '⚠ Critical alerts active' : ok ? '✓ All clear' : '◐ Items to review'}</div>
        <div class="axis-hero-sub">${findings.length} finding${findings.length !== 1 ? 's' : ''} · ${accounts.length} account${accounts.length !== 1 ? 's' : ''} · scanned ${new Date().toLocaleTimeString()}</div>
      </div>
      <div class="axis-score-ring" style="--score:${score};background:conic-gradient(${scoreColor} calc(${score} * 1%),#1e2d35 0)">
        <strong>${score}</strong><small>protection</small>
      </div>
    </div>

    ${axisAlertCritical && plan === 'enterprise' ? `
    <div class="axis-voice-bar">
      <span class="axis-voice-ic">${icon('volume')}</span>
      <span class="axis-voice-msg">${axisVoiceEnabled ? 'Voice alerts ON — critical warnings repeat every 30s' : 'Voice alerts OFF'}</span>
      <div style="flex:1"></div>
      <button class="btn ghost small" id="axisVoiceToggle">${axisVoiceEnabled ? 'Mute' : 'Enable voice'}</button>
      <button class="btn ghost small" id="axisVoiceTest">Test</button>
    </div>` : ''}

    <div class="axis-section-hd">${icon('grid')} Risk breakdown — 6 compliance areas</div>
    <div class="axis-cat-grid">${categories.map(catCard).join('')}</div>

    ${accounts.some(a => a.marketplace === 'ebay') ? `
    <div class="axis-section-hd">${icon('shield')} eBay Live Telemetry <span style="font-size:10px;color:var(--text-muted);font-weight:400;margin-left:6px">read-only · synced from eBay API</span><button class="btn ghost small" id="ebay-sync-now" style="margin-left:auto;font-size:10px;padding:3px 10px" title="Pull fresh data from eBay (counts against API limits)">${icon('refresh')} Sync</button></div>
    <div id="ebay-tel-display" style="margin-bottom:14px"></div>` : ''}

    <div class="axis-section-hd">${icon('shield')} Account status</div>
    <div class="axis-acct-grid">${acctStatus}</div>

    <div class="axis-section-hd">${icon('check')} Recommendations</div>
    <div class="axis-recs">${recs.map(r => `<div class="axis-rec"><span class="axis-rec-dot"></span>${esc(r)}</div>`).join('')}</div>

    ${findings.length ? `
    <div class="axis-section-hd">${icon('alert')} Active findings</div>
    <div class="card"><div class="card-body risk-list">
      ${findings.map(f => `<div class="risk-item ${f.level === 'high' ? 'high' : 'warn'}">
        <div class="risk-severity">${f.level === 'high' ? '!' : '!'}</div>
        <div><h4>${esc(f.title)}</h4><p>${esc(f.detail)}</p>
        ${f.upgradeTo ? `<div class="risk-action"><button class="btn primary small" data-up="${f.upgradeTo}">Upgrade to ${PLAN_LABEL[f.upgradeTo]}</button></div>` : ''}</div>
      </div>`).join('')}
    </div></div>` : ''}
  </div>`;

  // Wire voice toggle + test
  const vt = document.getElementById('axisVoiceToggle');
  if (vt) vt.onclick = () => {
    axisVoiceEnabled = !axisVoiceEnabled;
    try { localStorage.setItem('syndrax_axis_voice', axisVoiceEnabled ? 'on' : 'off'); } catch {}
    if (axisVoiceEnabled && worstWarning) { axisSpeak(worstWarning); startAxisVoiceLoop(worstWarning); }
    else if (!axisVoiceEnabled) { try { speechSynthesis.cancel(); } catch {} if (axisVoiceLoop) { clearInterval(axisVoiceLoop); axisVoiceLoop = null; } }
    renderAudit();
  };
  const vtest = document.getElementById('axisVoiceTest');
  if (vtest) vtest.onclick = () => axisSpeak('AXIS compliance sentinel active. Monitoring your accounts.');

  $('#content').querySelectorAll('[data-up]').forEach(b => b.onclick = () => startCheckout(b.dataset.up).catch(e => showAlert(e.message)));

  // Update just the nav badge (NOT renderShell — that would re-dispatch to renderAudit → infinite loop → freeze)
  updateAxisNavBadge();

  // ── Wire eBay telemetry display (read-only — connection happens in Accounts tab) ──
  // Sync button: pull fresh data from eBay for all connected eBay accounts
  const syncBtn = document.getElementById('ebay-sync-now');
  if (syncBtn) syncBtn.onclick = async () => {
    syncBtn.disabled = true;
    syncBtn.innerHTML = '⏳ Syncing from eBay…';
    try {
      for (const a of accounts.filter(a => a.marketplace === 'ebay')) {
        await syncEbay(a.id);
      }
      showToast('eBay data refreshed — telemetry updated.', 'success');
      // Re-render telemetry display for all accounts
      for (const a of accounts.filter(a => a.marketplace === 'ebay')) {
        try { const t = await getEbayTelemetry(a.id); renderEbayTelemetryDisplay(t); } catch {}
      }
    } catch (e) {
      showAlert('eBay sync failed: ' + (e.message || e));
    }
    syncBtn.disabled = false;
    syncBtn.innerHTML = `${icon('refresh')} Sync`;
  };
  // Per-account telemetry display for existing eBay accounts
  accounts.filter(a => a.marketplace === 'ebay').forEach(a => {
    // Auto-load existing telemetry into the read-only display
    getEbayTelemetry(a.id).then(t => renderEbayTelemetryDisplay(t)).catch(() => {});
  });
}

// Inline AXIS robot SVG (matches robot3.svg branding — cyan/blue, scanning pulse)
function axisRobotSvg() {
  return `<svg viewBox="0 0 120 120" width="64" height="64" class="axis-robot-svg" aria-hidden="true">
    <defs><radialGradient id="axg" cx="50%" cy="40%"><stop offset="0%" stop-color="#d4d4d4" stop-opacity=".35"/><stop offset="100%" stop-color="#d4d4d4" stop-opacity="0"/></radialGradient></defs>
    <circle cx="60" cy="55" r="50" fill="url(#axg)"/>
    <rect x="42" y="35" width="36" height="34" rx="9" fill="#111111" stroke="#d4d4d4" stroke-width="2"/>
    <circle cx="52" cy="50" r="4.5" fill="#d4d4d4" class="axis-eye"><animate attributeName="opacity" values="1;.3;1" dur="1.8s" repeatCount="indefinite"/></circle>
    <circle cx="68" cy="50" r="4.5" fill="#d4d4d4" class="axis-eye"><animate attributeName="opacity" values="1;.3;1" dur="1.8s" repeatCount="indefinite"/></circle>
    <rect x="50" y="62" width="20" height="3" rx="1.5" fill="#d4d4d4" opacity=".6"/>
    <rect x="36" y="69" width="48" height="20" rx="6" fill="#111111" stroke="#a3a3a3" stroke-width="1.5"/>
    <circle cx="46" cy="79" r="2.5" fill="#a3a3a3"/><circle cx="60" cy="79" r="2.5" fill="#d4d4d4"/><circle cx="74" cy="79" r="2.5" fill="#a3a3a3"/>
    <line x1="60" y1="35" x2="60" y2="28" stroke="#d4d4d4" stroke-width="1.5"/>
    <circle cx="60" cy="25" r="3" fill="#d4d4d4"><animate attributeName="r" values="3;4.5;3" dur="1.2s" repeatCount="indefinite"/></circle>
  </svg>`;
}

function renderPlanTab() {
  $('#topSub').textContent = '';
  const s = statusRow;
  let renewalLine = '';
  if (s.trial_ends_at) {
    const days = Math.max(0, Math.ceil((new Date(s.trial_ends_at) - Date.now()) / 86400000));
    renewalLine = `Free trial — ${days} day${days === 1 ? '' : 's'} left`;
  } else if (s.current_period_end) {
    renewalLine = `Renews ${new Date(s.current_period_end).toLocaleDateString()}`;
  }
  const np = nextPlan(plan);
  const lim = PLAN_LIMITS[plan] || {};
  const mkAcc = isUnlimited(lim.maxAccountsPerMarketplace) ? '∞' : String(lim.maxAccountsPerMarketplace || 1);
  const devs = isUnlimited(lim.maxDevices) ? '∞' : String(lim.maxDevices || 1);
  const seats = isUnlimited(lim.teamSeats) ? '∞' : String(lim.teamSeats || 0);
  const planFeatures = {
    trial: ['1 device', '1 account per marketplace', 'Core workflow tools', '7-day access'],
    business: ['1 device', '1 account per marketplace', 'Full workflow suite', 'Standard support'],
    growth: ['3 devices', '3 accounts per marketplace', 'Team workspace (3 seats)', 'Priority support'],
    enterprise: ['Unlimited devices', 'Unlimited accounts', 'Unlimited team seats', 'Custom onboarding'],
    none: ['No active plan', 'Start a 14-day trial to explore all features'],
  };
  const features = planFeatures[plan] || planFeatures.none;

  $('#content').innerHTML = `<div class="page" style="max-width:920px">
    <div class="split-grid">
      <div class="card" style="border-color:rgba(85,167,255,.2);position:relative;overflow:hidden">
        <div style="position:absolute;right:-70px;top:-80px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(85,167,255,.1),transparent 68%);pointer-events:none"></div>
        <div class="card-body" style="padding:24px">
          <div class="metric-label">${icon('card')} Current plan</div>
          <div style="font-size:32px;font-weight:760;letter-spacing:-.04em;margin-top:10px;color:var(--text-1)">${PLAN_LABEL[plan]}</div>
          ${PLAN_PRICE[plan] ? `<div style="font-size:14px;color:var(--text-muted);margin-top:4px">${PLAN_PRICE[plan]}/month</div>` : ''}
          ${renewalLine ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">${renewalLine}</div>` : ''}
          ${PLAN_TAGLINE[plan] ? `<p style="font-size:13px;color:var(--text-muted);margin:12px 0 0;line-height:1.6">${esc(PLAN_TAGLINE[plan])}</p>` : ''}
          <div class="feature-list">
            ${features.map(f => `<div class="feature-item"><div class="feature-dot"></div>${esc(f)}</div>`).join('')}
          </div>
          <div style="display:flex;gap:8px;margin-top:20px" id="planBtns"></div>
        </div>
      </div>

      <div class="stack">
        <div class="card">
          <div class="card-header"><h3>Usage limits</h3></div>
          <div class="card-body">
            <div class="usage-row">
              <div class="usage-head"><span>Devices</span><strong>${devs === '∞' ? 'Unlimited' : devs}</strong></div>
              <div class="usage-bar"><i style="width:${devs === '∞' ? 100 : Math.min(100, Math.max(0, nodes.length) / (+devs || 1) * 100)}%"></i></div>
            </div>
            <div class="usage-row">
              <div class="usage-head"><span>Accounts / marketplace</span><strong>${mkAcc === '∞' ? 'Unlimited' : mkAcc}</strong></div>
              <div class="usage-bar"><i style="width:${mkAcc === '∞' ? 20 : Math.min(100, accounts.length / (+mkAcc || 1) * 100)}%${accounts.length / (+mkAcc || 1) > 0.8 ? ';background:var(--amber)' : ''}"></i></div>
            </div>
            <div class="usage-row">
              <div class="usage-head"><span>Team seats</span><strong>${seats === '∞' ? 'Unlimited' : seats}</strong></div>
              <div class="usage-bar"><i style="width:20%"></i></div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Compare plans</h3></div>
          <div class="card-body">
            ${['business', 'growth', 'enterprise'].map(p => `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--line);${p === 'enterprise' ? 'border-bottom:0' : ''}">
              <span style="font-size:13px;font-weight:${p === plan ? 700 : 500};color:${p === plan ? 'var(--blue)' : 'var(--text-2)'}">${PLAN_LABEL[p]}${p === plan ? ' ✓' : ''}</span>
              <span style="font-size:12px;color:var(--text-muted)">${PLAN_PRICE[p] || 'Custom'}</span>
            </div>`).join('')}
            <a class="btn ghost small full" href="/pricing" style="margin-top:12px">Full comparison →</a>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  const btns = $('#planBtns');
  if (plan === 'none') {
    btns.appendChild(mkBtn('Start 14-day free trial', async (b) => { b.disabled = true; b.textContent = 'Starting…'; try { await startTrial(); location.reload(); } catch (e) { showAlert(e.message); } }, 'primary'));
  } else if (plan === 'trial') {
    if (np) btns.appendChild(mkBtn(`Upgrade to ${PLAN_LABEL[np]}`, () => startCheckout(np).catch(e => showAlert(e.message)), 'primary'));
    btns.appendChild(mkBtn('Compare plans', () => location.href = '/pricing', 'ghost'));
  } else {
    btns.appendChild(mkBtn('Manage billing', () => openPortal().catch(e => showAlert(e.message)), 'ghost'));
    if (np) btns.appendChild(mkBtn(`Upgrade to ${PLAN_LABEL[np]}`, () => startCheckout(np).catch(e => showAlert(e.message)), 'primary'));
  }
}

function mkBtn(label, onClick, variant) {
  const b = document.createElement('button');
  b.className = variant === 'primary' ? 'btn primary small' : variant === 'ghost' ? 'btn ghost small' : 'btn secondary small';
  b.textContent = label; b.onclick = () => onClick(b);
  return b;
}

function openCommandPalette() {
  const existing = document.querySelector('.command-overlay');
  if (existing) { existing.remove(); return; }
  const host = document.createElement('div');
  host.className = 'command-overlay';
  const results = TABS.map(t => {
    const locked = t.feature && !can(t.feature);
    return `<button class="command-result" data-tab="${t.id}" ${locked ? 'disabled' : ''}>${icon(t.icon)}<span>${t.label}</span>${locked ? '<small>upgrade required</small>' : ''}</button>`;
  }).join('');
  host.innerHTML = `<div class="command-panel" onclick="event.stopPropagation()">
    <div class="command-input-row">${icon('search')}<input id="cmdInput" placeholder="Go to…" autocomplete="off"></div>
    <div class="command-section-label">Pages</div>
    <div class="command-results">${results}</div>
    <div class="command-footer"><span>↑↓ navigate</span><span>Enter confirm · Esc close</span></div>
  </div>`;
  host.onclick = () => { host.classList.remove('open'); setTimeout(() => host.remove(), 180); };
  document.body.appendChild(host);
  requestAnimationFrame(() => host.classList.add('open'));
  const input = host.querySelector('#cmdInput');
  if (input) {
    input.focus();
    input.oninput = () => {
      const q = input.value.toLowerCase();
      host.querySelectorAll('.command-result').forEach(b => { b.style.display = (!q || b.textContent.toLowerCase().includes(q)) ? '' : 'none'; });
    };
  }
  host.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
    host.classList.remove('open');
    setTimeout(() => { host.remove(); activeTab = b.dataset.tab; renderShell(); }, 120);
  });
  const onKey = (e) => {
    if (e.key === 'Escape') { host.classList.remove('open'); setTimeout(() => { host.remove(); document.removeEventListener('keydown', onKey); }, 180); }
  };
  document.addEventListener('keydown', onKey);
}

// Global ⌘K / Ctrl+K command palette shortcut
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openCommandPalette(); }
});

// Close an open Focus-bar dropdown when clicking anywhere outside it.
document.addEventListener('click', (e) => {
  if (!openScopeMenu) return;
  if (e.target.closest && e.target.closest('.sb-pick')) return; // handled by the pick/option itself
  openScopeMenu = null;
  const content = document.getElementById('content');
  if (!content) return;
  if (activeTab === 'inventory') paintInventory(content);
  else if (activeTab === 'tracking') paintTracking(content, trackingOrders);
});

boot();

// app-api.js — data layer for the Syndrax app (onboarding + dashboard).
// Talks to the cloud API as the signed-in Cognito user. If the API is
// unreachable or not yet deployed, it transparently falls back to localStorage
// so the experience is fully usable during launch and upgrades seamlessly once
// the backend is live.
import { getSession } from '/auth-cognito.js';
import { getExtensionStatusReq, revokeExtensionReq } from '/app-extension-api.js';

const API_BASE =
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : 'https://api.syndrax.io';

const LS_PROFILE = 'syndrax_profile_v1';
const LS_MARKETS = 'syndrax_marketplaces_v1';

function lsGet(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function lsSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

async function api(path, opts = {}) {
  const session = getSession();
  if (!session) throw new Error('not signed in');
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + session.idToken,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json().catch(() => ({}));
}

// True when an error means "API not available" (so we should use the local copy).
function isOffline(e) {
  return e instanceof TypeError /* network */ || e.status === 503 || e.status === 404;
}

// ── Profile ──────────────────────────────────────────────────────────────────
export async function getProfile() {
  try {
    return await api('/api/profile');
  } catch (e) {
    if (isOffline(e)) return lsGet(LS_PROFILE, { onboarding_complete: false });
    throw e;
  }
}

export async function saveProfile(patch) {
  // Always keep a local mirror so onboarding never loses progress.
  const merged = { ...lsGet(LS_PROFILE, {}), ...patch };
  lsSet(LS_PROFILE, merged);
  try {
    return await api('/api/profile', { method: 'PUT', body: JSON.stringify(patch) });
  } catch (e) {
    if (isOffline(e)) return merged;
    throw e;
  }
}

// ── Marketplaces ─────────────────────────────────────────────────────────────
// Shape: { accounts: [{ id, marketplace, label, deviceId, status, eligibility }] }
export async function getMarketplaces() {
  try {
    return await api('/api/marketplaces');
  } catch (e) {
    if (isOffline(e)) return { accounts: lsGet(LS_MARKETS, []) };
    throw e;
  }
}

export async function addMarketplaceAccount(account) {
  const local = lsGet(LS_MARKETS, []);
  const rec = { id: 'mk_' + Math.random().toString(36).slice(2, 9), status: 'connected', ...account };
  lsSet(LS_MARKETS, [...local, rec]);
  try {
    return await api('/api/marketplaces', { method: 'POST', body: JSON.stringify(account) });
  } catch (e) {
    if (isOffline(e)) return rec;
    throw e;
  }
}

export async function removeMarketplaceAccount(id) {
  lsSet(LS_MARKETS, lsGet(LS_MARKETS, []).filter((a) => a.id !== id));
  try {
    return await api('/api/marketplaces/' + encodeURIComponent(id), { method: 'DELETE' });
  } catch (e) {
    if (isOffline(e)) return { ok: true };
    throw e;
  }
}

// ── No-card trial ─────────────────────────────────────────────────────────────
export async function startTrial() {
  try {
    return await api('/api/billing/start-trial', { method: 'POST' });
  } catch (e) {
    if (isOffline(e)) {
      // Offline mirror so onboarding still completes; dashboard shows a local trial.
      const ends = new Date(Date.now() + 7 * 86400000).toISOString();
      lsSet('syndrax_trial_v1', { plan: 'trial', status: 'trialing', trial_ends_at: ends });
      return { plan: 'trial', status: 'trialing', trial_ends_at: ends };
    }
    throw e;
  }
}

// ── Audit (server is authoritative; local is the fallback) ────────────────────
export async function getAudit() {
  try {
    return await api('/api/audit');
  } catch (e) {
    if (isOffline(e)) return null; // caller computes a local audit via plans.js
    throw e;
  }
}

// ── Nodes (workspace devices — the PC you're on now + remote/RDP machines) ─────
// Shape: { nodes: [{ id, deviceId, name, nodeType, ip, status, sessionType }] }
const LS_NODES = 'syndrax_nodes_v1';
export async function getNodes() {
  try {
    return await api('/api/nodes');
  } catch (e) {
    if (isOffline(e)) return { nodes: lsGet(LS_NODES, []) };
    throw e;
  }
}

// Upsert a node by deviceId (the extension reports the current PC + fleet here).
export async function saveNode(node) {
  const local = lsGet(LS_NODES, []);
  const idx = local.findIndex((n) => n.deviceId === node.deviceId);
  const rec = { id: idx >= 0 ? local[idx].id : 'nd_' + Math.random().toString(36).slice(2, 9), ...node };
  if (idx >= 0) local[idx] = { ...local[idx], ...rec }; else local.push(rec);
  lsSet(LS_NODES, local);
  try {
    return await api('/api/nodes', { method: 'POST', body: JSON.stringify(node) });
  } catch (e) {
    if (isOffline(e)) return rec;
    throw e;
  }
}

export async function updateNode(id, patch) {
  const local = lsGet(LS_NODES, []).map((n) => (n.id === id ? { ...n, ...patch } : n));
  lsSet(LS_NODES, local);
  try {
    return await api('/api/nodes/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) });
  } catch (e) {
    if (isOffline(e)) return local.find((n) => n.id === id);
    throw e;
  }
}

// ── Addons (marketing layers, node- or account-level) ─────────────────────────
// Shape: { addons: [{ id, nodeId, accountId, addonType, label, config, status }] }
const LS_ADDONS = 'syndrax_addons_v1';
export async function getAddons() {
  try {
    return await api('/api/addons');
  } catch (e) {
    if (isOffline(e)) return { addons: lsGet(LS_ADDONS, []) };
    throw e;
  }
}

export async function addAddon(addon) {
  const local = lsGet(LS_ADDONS, []);
  const rec = { id: 'ad_' + Math.random().toString(36).slice(2, 9), status: 'connected', ...addon };
  lsSet(LS_ADDONS, [...local, rec]);
  try {
    return await api('/api/addons', { method: 'POST', body: JSON.stringify(addon) });
  } catch (e) {
    if (isOffline(e)) return rec;
    throw e;
  }
}

export async function removeAddon(id) {
  lsSet(LS_ADDONS, lsGet(LS_ADDONS, []).filter((a) => a.id !== id));
  try {
    return await api('/api/addons/' + encodeURIComponent(id), { method: 'DELETE' });
  } catch (e) {
    if (isOffline(e)) return { ok: true };
    throw e;
  }
}

// ── Sales (real P&L; server is authoritative, never fabricated) ───────────────
// Shape: { series: { labels, gross, net, grossTotal, netTotal, orders }, empty }
export async function getSales(weeks = 8) {
  try {
    return await api('/api/sales?weeks=' + encodeURIComponent(weeks));
  } catch (e) {
    if (isOffline(e)) return null; // caller shows the honest empty state
    throw e;
  }
}
export async function postSales(payload) {
  try { return await api('/api/sales', { method: 'POST', body: JSON.stringify(payload) }); }
  catch (e) { if (isOffline(e)) return { upserted: 0 }; throw e; }
}

// ── Inventory ─────────────────────────────────────────────────────────────────
const LS_INVENTORY = 'syndrax_inventory_v1';
export async function getInventory(params = {}) {
  const q = new URLSearchParams(params).toString();
  try { return await api('/api/inventory' + (q ? '?' + q : '')); }
  catch (e) { if (isOffline(e)) return { items: lsGet(LS_INVENTORY, []) }; throw e; }
}
export async function getInventorySummary() {
  try { return await api('/api/inventory/summary'); }
  catch (e) { if (isOffline(e)) return { total: 0, inStock: 0, outOfStock: 0, lowStock: 0, byMarketplace: {}, crossSite: [] }; throw e; }
}
export async function syncInventory(payload) {
  try { return await api('/api/inventory/sync', { method: 'POST', body: JSON.stringify(payload) }); }
  catch (e) { if (isOffline(e)) return { upserted: 0 }; throw e; }
}
export async function deleteInventoryItem(id) {
  try { return await api('/api/inventory/' + encodeURIComponent(id), { method: 'DELETE' }); }
  catch (e) { if (isOffline(e)) return { ok: true }; throw e; }
}

// ── Tracking (Feature M — TrackCaptain via the cloud, metered by credits) ─────
export async function getTrackingBalance() {
  try { return await api('/api/tracking/balance'); }
  catch (e) { if (isOffline(e)) return { credits: 0, configured: false, claims: [], allotment: 0 }; throw e; }
}
export async function getTrackingOrders(params = {}) {
  const q = new URLSearchParams(params).toString();
  try { return await api('/api/tracking/orders' + (q ? '?' + q : '')); }
  catch (e) { if (isOffline(e)) return { orders: [] }; throw e; }
}
export async function postTrackingOrders(payload) {
  try { return await api('/api/tracking/orders', { method: 'POST', body: JSON.stringify(payload) }); }
  catch (e) { if (isOffline(e)) return { upserted: 0 }; throw e; }
}
export async function updateTrackingOrder(id, patch) {
  try { return await api('/api/tracking/orders/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(patch) }); }
  catch (e) { if (isOffline(e)) return null; throw e; }
}
export async function claimTracking(payload) {
  // No offline fallback — claiming spends a real credit and must hit the server.
  return await api('/api/tracking/claim', { method: 'POST', body: JSON.stringify(payload) });
}
export async function trackingCheckout(pack, mode = 'once') {
  return await api('/api/tracking/checkout', { method: 'POST', body: JSON.stringify({ pack, mode }) });
}

// ── Team (website → cloud, Cognito JWT auth) ──────────────────────────────────
// Returns { members, pendingInvites, callerRole }
export async function getTeamMembers() {
  return api('/api/myteam/members');
}
export async function inviteTeamMember(email, role = 'user') {
  return api('/api/myteam/invite', { method: 'POST', body: JSON.stringify({ email, role }) });
}
export async function removeTeamMember(userId) {
  return api(`/api/myteam/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });
}
export async function revokeTeamInvite(inviteId) {
  return api(`/api/myteam/invites/${encodeURIComponent(inviteId)}`, { method: 'DELETE' });
}

// ── Chrome extension installations (this user's connected browsers) ───────────
// No localStorage fallback — the page shows a real loading/empty/error state
// instead of fabricating connections. Tenant is derived server-side from the
// Cognito token; query/body tenant ids are never trusted.
export async function getExtensionStatus() {
  return getExtensionStatusReq({ session: getSession(), hostname: location.hostname });
}
export async function revokeExtension(installationId) {
  return revokeExtensionReq(installationId, { session: getSession(), hostname: location.hostname });
}

// ── eBay integration (AXIS telemetry) ──
export async function getEbayStatus() {
  return api('/api/ebay/status');
}
export async function connectEbay(accountId) {
  return api(`/api/ebay/connect/${accountId}`);
}
export async function syncEbay(accountId) {
  return api(`/api/ebay/sync/${accountId}`, { method: 'POST' });
}
export async function getEbayTelemetry(accountId) {
  return api(`/api/ebay/telemetry/${accountId}`);
}

window.SyndraxApp = {
  getProfile, saveProfile, getMarketplaces, addMarketplaceAccount, removeMarketplaceAccount,
  getAudit, startTrial, getNodes, saveNode, updateNode, getAddons, addAddon, removeAddon,
  getSales, postSales, getInventory, getInventorySummary, syncInventory, deleteInventoryItem,
  getTrackingBalance, getTrackingOrders, postTrackingOrders, updateTrackingOrder, claimTracking, trackingCheckout,
  getTeamMembers, inviteTeamMember, removeTeamMember, revokeTeamInvite,
  getExtensionStatus, revokeExtension,
  getEbayStatus, connectEbay, syncEbay, getEbayTelemetry,
};

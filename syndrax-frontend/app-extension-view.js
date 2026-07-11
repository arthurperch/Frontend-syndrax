// app-extension-view.js — pure HTML builders + a dependency-injected controller
// for the Extension tab. No DOM/framework: builders return HTML strings; the
// controller takes injected getStatus/revoke/render so it is unit-testable.

export function extEsc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function extTimeAgo(iso) {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (isNaN(t)) return '—';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.round(s / 60) + 'm ago';
  if (s < 86400) return Math.round(s / 3600) + 'h ago';
  return Math.round(s / 86400) + 'd ago';
}

export function extLoadingHtml() {
  return `<div class="card" data-ext-state="loading"><div class="card-body" style="text-align:center;color:var(--text-muted)">Loading extension status…</div></div>`;
}

export function extErrorHtml(message) {
  return `<div class="card" data-ext-state="error"><div class="card-body">
    <h3 style="margin:0 0 6px">Couldn't load extension status</h3>
    <p style="font-size:12px;color:var(--text-muted);margin:0 0 12px">${extEsc(message || 'Network error')}.</p>
    <button class="btn primary small" data-ext-refresh>Retry</button>
  </div></div>`;
}

export function extInstallCardHtml(i) {
  const connected = !i.revoked;
  return `<div data-install="${extEsc(i.installationId)}" style="padding:14px;border:1px solid var(--line);border-radius:12px;margin-bottom:10px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span class="cell-title">${extEsc(i.displayName || 'Browser')}</span>
      <span style="margin-left:auto;font-size:11px;font-weight:600">${connected ? 'Connected' : 'Revoked'}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;color:var(--text-muted)">
      <div>Version: <b>${extEsc(i.extVersion || '—')}</b></div>
      <div>Environment: <b>${extEsc(i.environment || '—')}</b></div>
      <div>Last active: <b>${extTimeAgo(i.lastActiveAt)}</b></div>
      <div>Last sync: <b>${extTimeAgo(i.lastSyncAt)}</b></div>
    </div>
    ${connected ? `<div style="margin-top:10px"><button class="btn small" data-revoke="${extEsc(i.installationId)}">Revoke Access</button></div>` : ''}
  </div>`;
}

export function extPanelHtml(installations) {
  const installs = installations || [];
  const active = installs.filter((i) => !i.revoked);
  const body = installs.length
    ? installs.map(extInstallCardHtml).join('')
    : `<div data-ext-empty style="text-align:center;padding:20px 8px">
        <p style="color:var(--text-muted);font-size:13px;margin:0 0 12px">No extension connected yet.</p>
        <a class="btn primary small" href="https://chrome.google.com/webstore" target="_blank" rel="noopener">Get the extension</a>
      </div>`;
  return `<div class="card" data-ext-state="${installs.length ? 'connected' : 'empty'}">
    <div class="card-header"><h3>Chrome Extension</h3><button class="btn small" data-ext-refresh>Refresh</button></div>
    <div class="card-body">
      <p style="font-size:12px;color:var(--text-muted);margin:0 0 14px">Connected installations: <b>${active.length}</b></p>
      ${body}
    </div>
  </div>`;
}

/**
 * Load + render the panel. deps: { getStatus, render(html) }. Returns
 * { state, installs }. Pure of DOM — `render` is injected.
 */
export async function loadExtensionPanel(deps) {
  deps.render(extLoadingHtml());
  let data, error;
  try { data = await deps.getStatus(); } catch (e) { error = e; }
  if (error) { deps.render(extErrorHtml(error.message)); return { state: 'error' }; }
  const installs = (data && data.installations) || [];
  deps.render(extPanelHtml(installs));
  return { state: installs.length ? 'connected' : 'empty', installs };
}

/** Revoke then re-load. deps also needs { revoke(id) }. */
export async function revokeExtensionInstall(deps, installationId) {
  await deps.revoke(installationId);
  return loadExtensionPanel(deps);
}

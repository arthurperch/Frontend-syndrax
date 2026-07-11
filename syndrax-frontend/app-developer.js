import { renderDevCaptchaLab } from '/app-captcha-lab.js';

// app-developer.js — Owner-only Build Studio UI for the Syndrax /app shell.
// Pure render functions that write into #content; no module-level side effects.
// All API calls are dependency-injected for testability.
//
// Control flow:
//   syndrax.io/app/developer
//   → https://api.syndrax.io/api/dev/*   (syndrax-cloud, Cognito-authed, owner role)
//   ← local runner polls/claims jobs via outbound HTTPS from owner's machine
//   → runner optionally calls Hermes at localhost:8000
//
// The browser NEVER talks to localhost:8000 or any local runner directly.

// ── API base ──────────────────────────────────────────────────────────────────
// All Developer API requests go through api.syndrax.io (syndrax-cloud).
// Local dev: site on localhost:3000, cloud API on localhost:3001 (via Vercel dev proxy).
// Production: https://api.syndrax.io (no localhost fallback in production code).
export function devApiBase() {
  const h = typeof location !== 'undefined' ? location.hostname : 'production';
  // In local dev, /api/* is proxied by vercel dev → localhost:3001
  // so we use a relative base to benefit from the proxy.
  if (h === 'localhost' || h === '127.0.0.1') return '';
  return 'https://api.syndrax.io';
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

export async function devApi(path, opts = {}, getIdToken) {
  const base = devApiBase();
  const token = getIdToken ? await getIdToken() : null;
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(base + path, { ...opts, headers });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    const err = new Error(body.detail || body.error || `${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r.status === 204 ? null : r.json();
}

export function makeDevApiFns(getIdToken) {
  const call = (path, opts) => devApi(path, opts, getIdToken);
  return {
    // Jobs
    listJobs:      ()         => call('/api/dev/build-jobs'),
    getJob:        (id)       => call(`/api/dev/build-jobs/${id}`),
    createJob:     (body)     => call('/api/dev/build-jobs', { method: 'POST', body: JSON.stringify(body) }),
    approveJob:    (id, body) => call(`/api/dev/build-jobs/${id}/approve`, { method: 'POST', body: JSON.stringify(body) }),
    deleteJob:     (id)       => call(`/api/dev/build-jobs/${id}`, { method: 'DELETE' }),
    cancelJob:     (id)       => call(`/api/dev/build-jobs/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) }),
    cancelAllJobs: ()         => call('/api/dev/jobs/cancel-all', { method: 'POST', body: '{}' }),
    // Runners
    runnerStatus:  ()         => call('/api/dev/runner-status'),
    listRunners:   ()         => call('/api/dev/runners'),
    pairRunner:    ()         => call('/api/dev/pairing/generate', { method: 'POST', body: '{}' }),
    revokeRunner:  (id)       => call(`/api/dev/runners/${encodeURIComponent(id)}/revoke`, { method: 'POST', body: '{}' }),
    // Auth
    whoami:        ()         => call('/api/dev/whoami'),
    // Workflows
    listWorkflows:   ()          => call('/api/dev/workflows'),
    getWorkflow:     (id)        => call(`/api/dev/workflows/${id}`),
    createWorkflow:  (body)      => call('/api/dev/workflows', { method: 'POST', body: JSON.stringify(body) }),
    updateWorkflow:  (id, body)  => call(`/api/dev/workflows/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteWorkflow:  (id)        => call(`/api/dev/workflows/${id}`, { method: 'DELETE' }),
    // Workflow runs (Test Run execution layer)
    startRun:        (wfId, body)=> call(`/api/dev/workflows/${wfId}/runs`, { method: 'POST', body: JSON.stringify(body || {}) }),
    listRuns:        (wfId)      => call(`/api/dev/workflows/${wfId}/runs`),
    getRun:          (runId)     => call(`/api/dev/workflows/runs/${runId}`),
    patchRun:        (runId, body)=> call(`/api/dev/workflows/runs/${runId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    // Elements
    listElements:    (q)         => call(`/api/dev/elements${q ? '?' + new URLSearchParams(q) : ''}`),
    saveElement:     (body)      => call('/api/dev/elements', { method: 'POST', body: JSON.stringify(body) }),
    patchElement:    (id, body)  => call(`/api/dev/elements/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteElement:   (id)        => call(`/api/dev/elements/${id}`, { method: 'DELETE' }),
    // Recordings
    listRecordings:  ()          => call('/api/dev/recordings'),
    getRecording:    (id)        => call(`/api/dev/recordings/${id}`),
    saveRecording:   (body)      => call('/api/dev/recordings', { method: 'POST', body: JSON.stringify(body) }),
    patchRecording:  (id, body)  => call(`/api/dev/recordings/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    promoteToWorkflow: (id)      => call(`/api/dev/recordings/${id}/promote-to-workflow`, { method: 'POST' }),
    deleteRecording:  (id)       => call(`/api/dev/recordings/${id}`, { method: 'DELETE' }),
    aiEditCode:       (body)     => call('/api/dev/ai-edit-code', { method: 'POST', body: JSON.stringify(body) }),
    testTypeScript:   (body)     => call('/api/dev/test-typescript', { method: 'POST', body: JSON.stringify(body) }),
    runSandbox:       (body)     => call('/api/dev/run-sandbox', { method: 'POST', body: JSON.stringify(body) }),
    listMemory:       (q, strategy) => call('/api/dev/memory' + (q || strategy ? `?q=${encodeURIComponent(q||'')}&strategy=${encodeURIComponent(strategy||'')}` : '')),
    deleteMemory:     (id)       => call(`/api/dev/memory/${id}`, { method: 'DELETE' }),
    // Team
    listTeam:        ()          => call('/api/dev/team'),
    inviteTeam:      (body)      => call('/api/dev/team/invite', { method: 'POST', body: JSON.stringify(body) }),
    patchTeamMember: (id, body)  => call(`/api/dev/team/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    removeTeamMember:(id)        => call(`/api/dev/team/${id}`, { method: 'DELETE' }),
    acceptInvite:    (token)     => call('/api/dev-team/accept', { method: 'POST', body: JSON.stringify({ token }) }),
    devAccessMe:     ()          => call('/api/dev-access/me'),
    // Authenticated launcher download — triggers save-file dialog
    downloadLauncher: async () => {
      const base = devApiBase();
      const token = getIdToken ? await getIdToken() : null;
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const r = await fetch(base + '/api/dev-access/launcher', { headers });
      if (!r.ok) throw new Error(`Download failed: ${r.status}`);
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'SyndraxDevStudio.ps1'; a.click();
      URL.revokeObjectURL(url);
    },
  };
}

// ── Owner authorization ───────────────────────────────────────────────────────
// Server-side check: GET /api/dev/whoami (cognitoAuth → requireOwner).
// 200 {authorized:true, role:'owner'} → access granted.
// 403 → not owner. 401 → not authenticated → redirect to login.
// The browser renders Developer nav ONLY when this returns authorized=true.
// A frontend email comparison is never the authorization boundary.

export async function checkOwnerStatus(getIdToken) {
  try {
    const r = await devApi('/api/dev/whoami', {}, getIdToken);
    return { authorized: r.authorized === true && r.role === 'owner', role: r.role || null };
  } catch (e) {
    if (e.status === 403) return { authorized: false, role: null, denied: true };
    if (e.status === 401) return { authorized: false, role: null, unauthenticated: true };
    return { authorized: false, role: null, unavailable: true };
  }
}

// ── Path-based routing ────────────────────────────────────────────────────────

export function resolveDevRoute() {
  const pathname = typeof location !== 'undefined' ? location.pathname : '';
  const search   = typeof location !== 'undefined' ? location.search   : '';
  const sp = new URLSearchParams(search);

  const m = pathname.match(/\/app\/developer(?:\/([^/]+)(?:\/([^/]+))?)?/);
  if (m) {
    const seg = m[1] || 'focus';
    const id  = m[2] || sp.get('id') || null;
    if (seg === 'jobs' && id) return { view: 'job', jobId: id };
    return { view: seg, jobId: id };
  }

  if (sp.get('tab') === 'developer') {
    const view = sp.get('view') || 'focus';
    const id   = sp.get('id')   || null;
    return { view, jobId: id };
  }

  return { view: 'focus', jobId: null };
}

// ── Utility helpers ───────────────────────────────────────────────────────────

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const STATUS_COLOR = {
  pending:    'var(--ds-blue)',
  claimed:    'var(--ds-blue)',
  running:    'var(--ds-blue)',
  validating: 'var(--ds-blue)',
  repairing:  'var(--ds-amber)',
  succeeded:  'var(--ds-green)',
  failed:     'var(--ds-red)',
  cancelled:  'var(--ds-t3)',
};

function statusBadge(s) {
  const c = STATUS_COLOR[s] || 'var(--ds-t3)';
  return `<span class="ds-badge" style="--badge-c:${c}">${esc(s)}</span>`;
}

function relTime(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000)   return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function card(title, body, badge) {
  return `<div class="ds-card">
    <div class="ds-card-hd">${esc(title)}${badge != null ? `<span class="ds-card-count">${badge}</span>` : ''}</div>
    <div class="ds-card-bd">${body}</div>
  </div>`;
}

function statCard(label, val, sub, accent) {
  const style = accent ? `color:${accent}` : 'color:var(--ds-t1)';
  return `<div class="ds-stat">
    <div class="ds-stat-val" style="${style}">${esc(String(val))}</div>
    <div class="ds-stat-lbl">${esc(label)}</div>
    ${sub ? `<div class="ds-stat-sub">${esc(sub)}</div>` : ''}
  </div>`;
}

function spinner() {
  return '<div class="ds-loading"><div class="ds-spinner"></div></div>';
}

// ── Navigation HTML ───────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: null,
    items: [
      { id: 'focus',     label: 'Focus'     },
      { id: 'overview',  label: 'Overview'  },
      { id: 'builder',   label: 'New Build' },
      { id: 'jobs',      label: 'Jobs'      },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { id: 'runners', label: 'This PC' },
      { id: 'models',  label: 'Models'  },
    ],
  },
  {
    label: 'Teach Mode',
    items: [
      { id: 'workflows',   label: 'Workflows'   },
      { id: 'recordings',  label: 'Recordings'  },
      { id: 'elements',    label: 'Elements'    },
    ],
  },
  {
    label: 'Team',
    items: [
      { id: 'team', label: 'Team Access' },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { id: 'memory',        label: 'Memory'       },
      { id: 'evaluations',   label: 'Evaluations'  },
      { id: 'repair-cases',  label: 'Repair Cases' },
      { id: 'evidence',      label: 'Evidence'     },
      { id: 'security',      label: 'Security'     },
      { id: 'captcha-lab',   label: 'Captcha Lab'  },
    ],
  },
];

export function devNavHtml(activeView) {
  const sections = NAV_SECTIONS.map(sec => {
    const header = sec.label
      ? `<div class="ds-nav-section-hd">${esc(sec.label)}</div>`
      : '';
    const btns = sec.items.map(v =>
      `<button class="ds-nav-btn${v.id === activeView ? ' active' : ''}" data-devview="${v.id}">${esc(v.label)}</button>`
    ).join('');
    return `<div class="ds-nav-section">${header}${btns}</div>`;
  }).join('');
  return `<nav class="ds-nav" id="ds-nav">${sections}</nav>`;
}

// ── Guard pages ───────────────────────────────────────────────────────────────

const _gateIcon = (paths, color = '#6366f1', bg = 'rgba(99,102,241,.1)', bdr = 'rgba(99,102,241,.22)') =>
  `<div class="ds-gate-mark" style="background:${bg};border-color:${bdr}">
     <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>
   </div>`;

export function devAccessDeniedHtml() {
  return `<div class="ds-gate">
    ${_gateIcon('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>')}
    <h2>Owner access only</h2>
    <p>The Developer area is restricted to the Syndrax owner account.<br>You are signed in as a non-owner user.</p>
  </div>`;
}

export function devLoginRedirectHtml() {
  return `<div class="ds-gate">
    ${_gateIcon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>')}
    <h2>Sign in required</h2>
    <p>Your session has expired or you are not signed in.<br>
    <a href="/login" class="ds-link">Sign in &rarr;</a></p>
  </div>`;
}

export function devUnavailableHtml(message) {
  return `<div class="ds-gate">
    ${_gateIcon('<path d="M10.3 3.3 3 16a1.9 1.9 0 0 0 1.6 2.9h14.8A1.9 1.9 0 0 0 21 16L13.7 3.3a1.9 1.9 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>', '#f59e0b', 'rgba(245,158,11,.08)', 'rgba(245,158,11,.22)')}
    <h2>Service unavailable</h2>
    <p>${esc(message || 'The Build Studio API could not be reached.')}</p>
  </div>`;
}

// ── CSS ───────────────────────────────────────────────────────────────────────

export function injectDevStyles() {
  if (document.getElementById('ds-styles')) return;
  const s = document.createElement('style');
  s.id = 'ds-styles';
  s.textContent = `
    /* ── Design tokens ── */
    :root {
      --ds-bg:     #0b0e17;
      --ds-surf:   #111422;
      --ds-card:   #171b2a;
      --ds-border: rgba(255,255,255,.07);
      --ds-t1:     #f1f5f9;
      --ds-t2:     #94a3b8;
      --ds-t3:     #475569;
      --ds-blue:   #3b82f6;
      --ds-green:  #22c55e;
      --ds-amber:  #f59e0b;
      --ds-red:    #ef4444;
    }

    /* ── Shell layout ── */
    .ds-shell { display:flex; height:100%; min-height:0; }

    /* ── Sidebar nav ── */
    .ds-nav {
      width:180px; flex-shrink:0;
      border-right:1px solid var(--ds-border);
      padding:12px 8px 24px;
      display:flex; flex-direction:column; gap:4px;
      overflow-y:auto;
      background:var(--ds-surf);
    }
    .ds-nav-section { margin-bottom:4px; }
    .ds-nav-section-hd {
      font-size:10px; font-weight:700; letter-spacing:.08em;
      text-transform:uppercase; color:var(--ds-t3);
      padding:10px 8px 4px; margin-top:4px;
    }
    .ds-nav-btn {
      display:block; width:100%;
      padding:7px 10px; border-radius:6px;
      background:transparent; border:none; cursor:pointer;
      color:var(--ds-t2); font-size:13px; font-weight:500;
      text-align:left; transition:background .12s, color .12s;
    }
    .ds-nav-btn:hover  { background:rgba(255,255,255,.05); color:var(--ds-t1); }
    .ds-nav-btn.active { background:rgba(59,130,246,.14);  color:var(--ds-blue); font-weight:600; }
    .ds-nav-btn:focus-visible {
      outline:2px solid var(--ds-blue); outline-offset:2px;
    }
    .ds-nav { position:relative; }

    /* ── Main content area ── */
    .ds-main {
      flex:1; overflow-y:auto;
      padding:28px 32px;
      min-width:0;
      background:var(--ds-bg);
    }
    .ds-main h2 {
      font-size:16px; font-weight:700;
      color:var(--ds-t1); margin:0 0 20px;
    }
    .ds-page-desc {
      font-size:13px; color:var(--ds-t2); margin:-12px 0 20px;
      line-height:1.6;
    }

    /* ── Stats grid ── */
    .ds-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; margin-bottom:24px; }

    /* ── Memory: Neural brain hero ── */
    .mem-hero {
      display:flex; gap:20px; align-items:center;
      padding:24px 28px; border-radius:18px; margin-bottom:8px;
      background: linear-gradient(135deg, rgba(15,23,42,.6), rgba(11,14,23,.8));
      border:1px solid rgba(255,255,255,.06);
      position:relative; overflow:hidden;
    }
    .mem-hero::before {
      content:''; position:absolute; inset:0;
      background: radial-gradient(circle at 15% 50%, var(--brain-glow), transparent 60%);
      pointer-events:none;
    }
    .mem-brain-wrap {
      flex:none; width:130px; height:120px; position:relative;
      display:flex; align-items:center; justify-content:center;
    }
    .mem-brain-svg {
      width:120px; height:110px;
      filter: drop-shadow(0 0 16px var(--brain-glow));
      animation: mem-brain-pulse 4s ease-in-out infinite;
    }
    @keyframes mem-brain-pulse {
      0%,100% { transform:scale(1); filter: drop-shadow(0 0 12px var(--brain-glow)); }
      50% { transform:scale(1.03); filter: drop-shadow(0 0 22px var(--brain-glow)); }
    }
    .mem-particle {
      position:absolute; width:4px; height:4px; border-radius:50%;
      background:var(--brain-color); opacity:0;
      left:var(--px); top:var(--py);
      animation: mem-particle-float 3s ease-out infinite;
      animation-delay:var(--pd);
      box-shadow:0 0 6px var(--brain-color);
    }
    @keyframes mem-particle-float {
      0% { opacity:0; transform:translateY(10px) scale(.5); }
      30% { opacity:.8; }
      100% { opacity:0; transform:translateY(-30px) scale(1.2); }
    }
    .mem-hero-body { flex:1; min-width:0; position:relative; z-index:1; }
    .mem-hero-title {
      font-size:22px; font-weight:800; color:var(--ds-t1);
      letter-spacing:-.02em; display:flex; align-items:center; gap:10px;
    }
    .mem-brain-state {
      font-size:10px; font-weight:700; padding:3px 10px; border-radius:20px;
      text-transform:uppercase; letter-spacing:.06em;
    }
    .mem-brain-state-dormant { background:rgba(71,85,105,.15); color:#64748b; border:1px solid rgba(71,85,105,.2); }
    .mem-brain-state-learning { background:rgba(255, 255, 255,.12); color:#d4d4d4; border:1px solid rgba(255, 255, 255,.25); }
    .mem-brain-state-active { background:rgba(59,130,246,.12); color:#60a5fa; border:1px solid rgba(59,130,246,.25); }
    .mem-brain-state-mastered { background:rgba(129,140,248,.15); color:#818cf8; border:1px solid rgba(129,140,248,.3); }
    .mem-hero-sub { font-size:12px; color:var(--ds-t3); margin-top:6px; line-height:1.6; }
    .mem-hero-sub strong { color:var(--ds-t2); font-weight:700; }
    .mem-hero-stats { display:flex; gap:24px; margin-top:16px; }
    .mem-stat { display:flex; flex-direction:column; }
    .mem-stat-val { font-size:22px; font-weight:800; letter-spacing:-.02em; line-height:1; }
    .mem-stat-lbl { font-size:9px; color:var(--ds-t3); text-transform:uppercase; letter-spacing:.08em; margin-top:4px; }
    .ds-memory-card {
      background:var(--ds-card); border:1px solid var(--ds-border);
      border-radius:12px; padding:14px;
      transition: border-color .15s, transform .15s;
    }
    .ds-memory-card:hover { border-color:rgba(255, 255, 255,.2); transform:translateY(-1px); }
    .ds-stat {
      background:var(--ds-card); border:1px solid var(--ds-border);
      border-radius:10px; padding:16px 18px;
    }
    .ds-stat-val { font-size:22px; font-weight:700; line-height:1; }
    .ds-stat-lbl { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em; color:var(--ds-t3); margin-top:5px; }
    .ds-stat-sub { font-size:11px; color:var(--ds-t3); margin-top:3px; }

    /* ── Cards ── */
    .ds-card {
      background:var(--ds-card); border:1px solid var(--ds-border);
      border-radius:10px; margin-bottom:16px; overflow:hidden;
    }
    .ds-card-hd {
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 16px; border-bottom:1px solid var(--ds-border);
      font-size:10px; font-weight:700; text-transform:uppercase;
      letter-spacing:.06em; color:var(--ds-t3);
    }
    .ds-card-count {
      font-size:10px; font-weight:700; padding:2px 7px;
      border-radius:99px; background:rgba(59,130,246,.12); color:var(--ds-blue);
    }
    .ds-card-bd { padding:16px; }
    .ds-card-bd-flush { padding:0; }

    /* ── Badge ── */
    .ds-badge {
      display:inline-flex; align-items:center;
      font-size:11px; font-weight:700; padding:2px 8px;
      border-radius:99px;
      color:var(--badge-c,var(--ds-t2));
      border:1px solid color-mix(in srgb,var(--badge-c,var(--ds-t2)) 25%,transparent);
      background:color-mix(in srgb,var(--badge-c,var(--ds-t2)) 10%,transparent);
    }

    /* ── Tables ── */
    .ds-table { width:100%; border-collapse:collapse; font-size:13px; }
    .ds-table th {
      color:var(--ds-t3); font-weight:600; text-align:left;
      padding:7px 14px; border-bottom:1px solid var(--ds-border);
      font-size:10px; text-transform:uppercase; letter-spacing:.05em;
    }
    .ds-table td {
      padding:10px 14px; border-bottom:1px solid rgba(255,255,255,.03);
      color:var(--ds-t2); vertical-align:middle;
    }
    .ds-table tr:last-child td { border-bottom:none; }
    .ds-table tr.row-click { cursor:pointer; transition:background .1s; }
    .ds-table tr.row-click:hover td { background:rgba(255,255,255,.025); }
    .ds-table tr.row-click:focus-within td { background:rgba(59,130,246,.06); }
    .ds-tcell-prompt {
      max-width:300px; white-space:nowrap;
      overflow:hidden; text-overflow:ellipsis;
    }

    /* ── Buttons ── */
    .ds-btn {
      display:inline-flex; align-items:center; gap:6px;
      padding:7px 14px; border-radius:7px; border:none;
      cursor:pointer; font-size:13px; font-weight:600;
      font-family:inherit; transition:opacity .12s, background .12s;
    }
    .ds-btn:disabled { opacity:.4; cursor:not-allowed; }
    .ds-btn:focus-visible { outline:2px solid var(--ds-blue); outline-offset:2px; }
    .ds-btn-primary  { background:var(--ds-blue);  color:#fff; }
    .ds-btn-primary:hover:not(:disabled)  { background:#2563eb; }
    .ds-btn-success  { background:#15803d; color:#fff; }
    .ds-btn-success:hover:not(:disabled)  { background:var(--ds-green); }
    .ds-btn-danger   { background:transparent; border:1px solid var(--ds-red); color:var(--ds-red); }
    .ds-btn-danger:hover:not(:disabled)   { background:var(--ds-red); color:#fff; }
    .ds-btn-ghost    { background:transparent; border:1px solid var(--ds-border); color:var(--ds-t2); }
    .ds-btn-ghost:hover:not(:disabled)    { color:var(--ds-t1); border-color:rgba(255,255,255,.18); }
    .ds-btn-sm { padding:4px 10px; font-size:11px; }
    .ds-btn-row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:16px; }

    /* ── Form controls ── */
    .ds-field { margin-bottom:14px; }
    .ds-label {
      display:block; font-size:11px; font-weight:700;
      text-transform:uppercase; letter-spacing:.05em;
      color:var(--ds-t3); margin-bottom:6px;
    }
    .ds-input {
      width:100%; box-sizing:border-box;
      background:var(--ds-surf); border:1px solid rgba(255,255,255,.1);
      border-radius:7px; color:var(--ds-t1);
      font-size:13px; padding:9px 12px;
      outline:none; font-family:inherit;
      transition:border-color .15s;
    }
    .ds-input:focus  { border-color:var(--ds-blue); }
    .ds-textarea { resize:vertical; min-height:110px; }
    .ds-select {
      background:var(--ds-surf); border:1px solid rgba(255,255,255,.1);
      border-radius:7px; color:var(--ds-t1);
      font-size:13px; padding:9px 12px;
      outline:none; font-family:inherit; cursor:pointer;
    }
    .ds-select:focus { border-color:var(--ds-blue); }

    /* ── Code blocks ── */
    .ds-code {
      font-family:"Cascadia Code","Fira Code",ui-monospace,monospace;
      font-size:11.5px; background:#090c14;
      border:1px solid rgba(255,255,255,.07);
      border-radius:6px; padding:12px;
      white-space:pre-wrap; word-break:break-all;
      color:var(--ds-t2); max-height:300px; overflow-y:auto;
      margin:0;
    }

    /* ── Pills / chips ── */
    .ds-chip {
      display:inline-flex; align-items:center; gap:4px;
      font-size:12px; font-weight:600; padding:3px 10px;
      border-radius:6px; cursor:pointer; border:1px solid var(--ds-border);
      background:var(--ds-card); color:var(--ds-t2);
      transition:background .1s, color .1s, border-color .1s;
    }
    .ds-chip:hover { background:rgba(59,130,246,.1); color:var(--ds-blue); border-color:rgba(59,130,246,.3); }
    .ds-chips { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px; }

    /* ── File diff chips ── */
    .ds-fchip {
      display:inline-flex; align-items:center; gap:4px;
      font-family:monospace; font-size:11px;
      padding:2px 8px; border-radius:4px; margin:2px;
      border:1px solid;
    }
    .ds-fchip-create { color:var(--ds-green);  border-color:rgba(34,197,94,.25);  background:rgba(34,197,94,.08); }
    .ds-fchip-modify { color:var(--ds-blue);   border-color:rgba(59,130,246,.25); background:rgba(59,130,246,.08); }
    .ds-fchip-delete { color:var(--ds-red);    border-color:rgba(239,68,68,.25);  background:rgba(239,68,68,.08); text-decoration:line-through; }

    /* ── Loading / empty ── */
    .ds-loading { display:flex; align-items:center; justify-content:center; padding:64px; }
    @keyframes ds-spin { to { transform:rotate(360deg); } }
    .ds-spinner {
      width:22px; height:22px;
      border:2px solid rgba(255,255,255,.08);
      border-top-color:var(--ds-blue);
      border-radius:50%;
      animation:ds-spin .65s linear infinite;
    }
    .ds-empty {
      text-align:center; padding:48px 24px;
      color:var(--ds-t3); font-size:13px;
    }
    .ds-empty p { margin:6px 0; }

    /* ── Color helpers ── */
    .c-green { color:var(--ds-green); }
    .c-red   { color:var(--ds-red);   }
    .c-amber { color:var(--ds-amber); }
    .c-blue  { color:var(--ds-blue);  }
    .c-t3    { color:var(--ds-t3);    }

    /* ── Gate pages (403 / login) ── */
    .ds-gate { text-align:center; padding:80px 24px; }
    .ds-gate-mark {
      width:56px; height:56px; border-radius:16px; border:1px solid;
      display:flex; align-items:center; justify-content:center;
      margin:0 auto 18px;
    }
    .ds-gate h2 { color:var(--ds-t1); font-size:20px; margin:0 0 8px; }
    .ds-gate p  { color:var(--ds-t2); font-size:14px; line-height:1.65; margin:0; }
    .ds-link { color:var(--ds-blue); text-decoration:none; }
    .ds-link:hover { text-decoration:underline; }

    /* ── Banner (inline warning) ── */
    .ds-banner {
      display:flex; align-items:center; gap:12px;
      background:rgba(245,158,11,.08); border:1px solid rgba(245,158,11,.25);
      border-radius:8px; padding:12px 16px; margin-bottom:20px;
      font-size:13px; color:var(--ds-t1);
    }
    .ds-banner-icon { flex-shrink:0; display:flex; align-items:center; color:var(--ds-amber); }
    .ds-banner .ds-btn { margin-left:auto; flex-shrink:0; }

    /* ── Timeline (job progress) ── */
    .ds-timeline { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:0; }
    .ds-tl-item {
      display:flex; align-items:flex-start; gap:14px;
      padding:10px 0; border-bottom:1px solid rgba(255,255,255,.03);
    }
    .ds-tl-item:last-child { border-bottom:none; }
    .ds-tl-dot {
      width:22px; height:22px; border-radius:50%; flex-shrink:0;
      display:flex; align-items:center; justify-content:center;
      font-size:11px; font-weight:700; margin-top:1px;
    }
    .ds-tl-dot-done    { background:rgba(34,197,94,.15); color:var(--ds-green); }
    .ds-tl-dot-current { background:rgba(59,130,246,.15); color:var(--ds-blue); }
    .ds-tl-dot-pending { background:rgba(255,255,255,.04); color:var(--ds-t3); }
    .ds-tl-label { font-size:13px; color:var(--ds-t2); font-weight:500; padding-top:2px; }
    .ds-tl-label.current { color:var(--ds-t1); font-weight:600; }
    .ds-tl-label.pending { color:var(--ds-t3); }
    @keyframes ds-pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
    .ds-tl-dot-current { animation:ds-pulse 1.4s ease-in-out infinite; }

    /* ── Setup wizard ── */
    .ds-wizard {
      background:var(--ds-card); border:1px solid var(--ds-border);
      border-radius:12px; padding:32px; max-width:520px; margin:0 auto 24px;
      text-align:center;
    }
    .ds-wizard h3 { font-size:18px; font-weight:700; color:var(--ds-t1); margin:0 0 8px; }
    .ds-wizard p  { font-size:14px; color:var(--ds-t2); margin:0 0 24px; line-height:1.6; }
    .ds-wizard-actions { display:flex; gap:10px; justify-content:center; flex-wrap:wrap; }
    .ds-wizard-pairing { margin-top:24px; text-align:left; }
    .ds-wizard-pairing .ds-label { margin-bottom:6px; }

    /* ── Pairing code display ── */
    .ds-pair-code {
      font-family:monospace; font-size:28px; font-weight:700;
      color:var(--ds-blue); letter-spacing:.15em;
      background:rgba(59,130,246,.08); border:1px solid rgba(59,130,246,.2);
      border-radius:8px; padding:14px 20px; text-align:center; margin:12px 0;
    }
    .ds-pair-status { font-size:12px; color:var(--ds-t3); text-align:center; margin-top:8px; }

    /* ── Security status list ── */
    .ds-kill-switch {
      display:flex; align-items:center; justify-content:space-between;
      padding:12px 0; border-bottom:1px solid rgba(255,255,255,.04);
    }
    .ds-kill-switch:last-child { border-bottom:none; }
    .ds-ks-name  { font-size:13px; color:var(--ds-t1); font-weight:500; }
    .ds-ks-desc  { font-size:12px; color:var(--ds-t3); margin-top:2px; }
    .ds-ks-badge {
      font-size:11px; font-weight:700; padding:3px 10px;
      border-radius:99px;
    }
    .ds-ks-on  { background:rgba(34,197,94,.12); color:var(--ds-green); }
    .ds-ks-off { background:rgba(239,68,68,.12);  color:var(--ds-red);   }

    /* ── Approval section highlight ── */
    .ds-approval-cta {
      border:1px solid rgba(34,197,94,.25);
      background:rgba(34,197,94,.04);
      border-radius:10px; padding:16px 20px; margin-bottom:20px;
      display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;
    }
    .ds-approval-cta p { margin:0; font-size:13px; color:var(--ds-t2); }
    .ds-approval-cta strong { color:var(--ds-t1); }

    /* ── Job detail header ── */
    .ds-jd-header { margin-bottom:20px; }
    .ds-jd-header h3 { font-size:17px; font-weight:700; color:var(--ds-t1); margin:0 0 6px; }
    .ds-jd-header .meta { font-size:12px; color:var(--ds-t3); display:flex; align-items:center; gap:10px; }

    /* ── Advanced options collapsible ── */
    .ds-advanced details { margin-top:14px; }
    .ds-advanced summary {
      font-size:12px; color:var(--ds-t3); cursor:pointer; user-select:none;
      font-weight:600; letter-spacing:.03em;
    }
    .ds-advanced summary:hover { color:var(--ds-t2); }
    .ds-advanced-body { margin-top:14px; padding-top:14px; border-top:1px solid var(--ds-border); }

    /* ── Workflow canvas ── */
    .ds-main-full { flex:1; display:flex; flex-direction:column; min-height:0; padding:0; overflow:hidden; }
    .wf-topbar {
      display:flex; align-items:center; gap:12px; padding:12px 20px;
      border-bottom:1px solid var(--ds-border); flex-shrink:0;
    }
    .wf-layout { display:flex; flex:1; min-height:0; overflow:hidden; }
    .wf-sidebar {
      width:200px; flex-shrink:0; border-right:1px solid var(--ds-border);
      display:flex; flex-direction:column; overflow:hidden;
    }
    .wf-sidebar-hd {
      font-size:11px; font-weight:700; text-transform:uppercase;
      letter-spacing:.05em; color:var(--ds-t3);
      padding:10px 12px 6px; border-bottom:1px solid var(--ds-border);
      display:flex; align-items:center; gap:8px;
    }
    .wf-sidebar-list { flex:1; overflow-y:auto; padding:6px 4px; }
    .wf-sidebar-item {
      padding:8px 10px; border-radius:7px; cursor:pointer; margin-bottom:2px;
      transition:background .1s;
    }
    .wf-sidebar-item:hover { background:rgba(255,255,255,.05); }
    .wf-sidebar-item.active { background:rgba(99,102,241,.15); }
    .wf-sidebar-name { font-size:13px; color:var(--ds-t1); font-weight:500; }
    .wf-sidebar-meta { font-size:11px; color:var(--ds-t3); margin-top:2px; }
    .wf-canvas-wrap {
      flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden;
    }
    .wf-canvas-toolbar {
      display:flex; align-items:center; gap:8px;
      padding:8px 14px; border-bottom:1px solid var(--ds-border); flex-shrink:0;
    }
    .wf-canvas-title { font-size:13px; font-weight:600; color:var(--ds-t1); }
    .wf-status-badge {
      font-size:11px; font-weight:700; padding:3px 9px;
      border-radius:5px; letter-spacing:.03em;
    }
    .wf-palette {
      display:flex; gap:6px; flex-wrap:wrap; padding:8px 12px;
      border-bottom:1px solid var(--ds-border); background:rgba(0,0,0,.15); flex-shrink:0;
    }
    .wf-palette-item {
      display:flex; flex-direction:column; align-items:center; gap:2px;
      padding:6px 8px; border-radius:7px; cursor:grab;
      border:1px solid; min-width:52px;
      background:rgba(255,255,255,.03); font-size:16px;
      transition:background .1s, transform .1s;
      user-select:none;
    }
    .wf-palette-item:hover { background:rgba(255,255,255,.08); transform:scale(1.05); }
    .wf-palette-item:active { cursor:grabbing; }
    .wf-canvas {
      flex:1; position:relative; overflow:auto;
      background:
        radial-gradient(circle, rgba(255,255,255,.03) 1px, transparent 1px) 0 0 / 28px 28px,
        var(--ds-bg);
      min-height:400px;
    }
    .wf-canvas-hint {
      position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
      color:var(--ds-t3); font-size:13px; text-align:center;
      pointer-events:none;
    }
    .wf-node {
      position:absolute; width:130px;
      background:var(--ds-card); border:1.5px solid;
      border-radius:10px; cursor:pointer;
      box-shadow:0 2px 12px rgba(0,0,0,.4);
      transition:box-shadow .15s;
      user-select:none;
    }
    .wf-node:hover { box-shadow:0 4px 20px rgba(0,0,0,.6); }
    .wf-node.selected { box-shadow:0 0 0 2px #a5b4fc; }
    .wf-node-hd {
      display:flex; align-items:center; gap:6px;
      padding:7px 10px; border-radius:8px 8px 0 0; font-size:12px;
    }
    .wf-node-type { font-size:11px; font-weight:600; color:var(--ds-t2); }
    .wf-node-label {
      font-size:12px; color:var(--ds-t1); padding:6px 10px 8px;
      font-weight:500; word-break:break-word;
    }
    .wf-node-ports {
      display:flex; justify-content:space-between; padding:0 8px 6px;
    }
    .wf-port {
      width:10px; height:10px; border-radius:50%;
      background:rgba(255,255,255,.15); border:1.5px solid rgba(255,255,255,.3);
      cursor:crosshair; transition:background .1s;
    }
    .wf-port:hover { background:rgba(99,102,241,.6); }
    .wf-inspector {
      width:260px; flex-shrink:0; border-left:1px solid var(--ds-border);
      display:flex; flex-direction:column; overflow-y:auto;
    }
    .wf-insp-hd {
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 14px; border-bottom:1px solid var(--ds-border);
      font-size:13px; font-weight:600; flex-shrink:0;
    }
    .wf-insp-close {
      background:none; border:none; color:var(--ds-t3);
      cursor:pointer; font-size:14px; padding:2px 6px;
    }
    .wf-insp-close:hover { color:var(--ds-t1); }
    .wf-insp-body { padding:14px; display:flex; flex-direction:column; gap:6px; }
    .wf-insp-body .ds-label { margin-bottom:3px; }
    .wf-insp-body .ds-input,
    .wf-insp-body .ds-select { font-size:12px; padding:7px 10px; width:100%; box-sizing:border-box; }
    .wf-edge-svg { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; }

    /* ── Recording path view ── */
    .rv-head { display:flex; align-items:flex-start; gap:14px; margin-bottom:18px; }
    .rv-chip {
      width:38px; height:38px; border-radius:10px; flex:none;
      display:flex; align-items:center; justify-content:center;
      font-size:16px; font-weight:800; color:#0b0e17;
    }
    .rv-title { font-size:16px; font-weight:700; color:var(--ds-t1); line-height:1.2; }
    .rv-sub { font-size:12px; color:var(--ds-t3); margin-top:3px; }
    .rv-actions { margin-left:auto; display:flex; gap:8px; }

    .rv-flow { display:flex; flex-direction:column; }
    .rv-step { position:relative; padding-left:56px; }
    .rv-step::before {
      content:''; position:absolute; left:23px; top:46px; bottom:-14px;
      width:2px; background:linear-gradient(180deg, var(--ds-blue), rgba(99,102,241,0));
    }
    .rv-step:last-child::before { display:none; }
    .rv-step-num {
      position:absolute; left:8px; top:8px; width:32px; height:32px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:12px; font-weight:800; color:var(--ds-t1);
      background:var(--ds-card); border:1px solid var(--ds-border);
      z-index:1;
    }
    .rv-step-num::after {
      content:''; position:absolute; inset:-3px; border-radius:50%;
      border:2px solid var(--ds-blue); opacity:0;
      animation:rv-ring 2.4s ease-out infinite;
    }
    @keyframes rv-ring { 0%{opacity:.5;transform:scale(.9)} 70%{opacity:0;transform:scale(1.4)} 100%{opacity:0} }
    .rv-card {
      background:var(--ds-card); border:1px solid var(--ds-border);
      border-radius:10px; padding:12px 14px; cursor:pointer;
      transition:border-color .14s, transform .1s;
      display:flex; align-items:center; gap:12px;
    }
    .rv-card:hover { border-color:var(--ds-blue); transform:translateX(2px); }
    .rv-card.sel { border-color:var(--ds-blue); box-shadow:0 0 0 1px var(--ds-blue); }
    .rv-card-icon { font-size:16px; flex:none; }
    .rv-card-main { min-width:0; flex:1; }
    .rv-card-label {
      font-size:13px; font-weight:600; color:var(--ds-t1);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .rv-card-meta { font-size:11px; color:var(--ds-t3); margin-top:2px; }
    .rv-card-loc { font-size:10px; color:var(--ds-blue); font-family:ui-monospace,monospace; }
    .rv-conf { width:8px; height:8px; border-radius:50%; flex:none; }

    /* flow line animation (the "action" line moving between cards) */
    .rv-step.flowing .rv-step-num::after { opacity:1; }

    /* detail drawer (reuses wf-inspector slot) */
    .rv-drawer {
      position:fixed; top:0; right:0; bottom:0; width:380px; z-index:1200;
      background:var(--ds-surf); border-left:1px solid var(--ds-border);
      box-shadow:-12px 0 40px rgba(0,0,0,.4);
      transform:translateX(100%); transition:transform .22s ease;
      display:flex; flex-direction:column;
    }
    .rv-drawer.open { transform:translateX(0); }
    .rv-drawer-hd {
      display:flex; align-items:center; gap:10px; padding:14px 16px;
      border-bottom:1px solid var(--ds-border);
    }
    .rv-drawer-title { font-size:14px; font-weight:700; color:var(--ds-t1); flex:1; }
    .rv-drawer-body { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:16px; }
    .rv-section-hd {
      font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.06em;
      color:var(--ds-t3); margin-bottom:7px;
    }
    .rv-loc-row { display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:12px; }
    .rv-loc-strat { font-size:10px; font-weight:700; color:var(--ds-blue); min-width:84px; }
    .rv-loc-val { font-family:ui-monospace,monospace; font-size:11px; color:var(--ds-t2); flex:1; word-break:break-all; }
    .rv-conf-bar { height:4px; background:rgba(255,255,255,.06); border-radius:99px; overflow:hidden; margin-top:3px; }
    .rv-conf-bar > div { height:100%; border-radius:99px; }
    .rv-frag { background:#0b0e17; border:1px solid var(--ds-border); border-radius:8px; padding:10px; font-family:ui-monospace,monospace; font-size:11px; color:var(--ds-t2); white-space:pre-wrap; word-break:break-word; max-height:220px; overflow:auto; }
    .rv-url-params { display:flex; flex-wrap:wrap; gap:5px; }
    .rv-url-param { font-size:10px; padding:2px 7px; border-radius:6px; background:rgba(59,130,246,.1); border:1px solid rgba(59,130,246,.22); color:var(--ds-blue); font-family:ui-monospace,monospace; }

    /* list-view label color chips */
    .rec-color-chip {
      display:inline-block; width:10px; height:10px; border-radius:3px;
      margin-right:7px; vertical-align:middle;
    }
    .rec-filter-bar { display:flex; align-items:center; gap:10px; margin-bottom:14px; font-size:12px; color:var(--ds-t3); }
  `;
  document.head.appendChild(s);
}

// ── Setup Wizard ──────────────────────────────────────────────────────────────

export function renderSetupWizard({ render, onConnect, onSkip }) {
  // Renders inline into the overview area (not a full-page replacement).
  // Returns the HTML string to inject into the overview container.
  // caller calls render() with full shell HTML including this.
  function wizardHtml(step, pairCode, pairExpiry) {
    if (step === 'pair') {
      return `<div class="ds-wizard">
        <h3>Dev Studio</h3>
        <p>Enter this code in your runner terminal to pair this PC.</p>
        <div class="ds-pair-code" id="ds-pair-code">${esc(pairCode || 'Generating…')}</div>
        <div class="ds-pair-status" id="ds-pair-status">${pairExpiry ? `Expires in 5 minutes &mdash; waiting for runner to connect&hellip;` : ''}</div>
        <div style="margin-top:16px">
          <button class="ds-btn ds-btn-ghost" id="ds-wizard-back">&larr; Back</button>
        </div>
      </div>`;
    }
    return `<div class="ds-wizard">
      <h3>Dev Studio</h3>
      <p>Connect this Windows PC so Syndrax can build and test code locally.<br>
      The runner runs in your terminal and never opens a port to the internet.</p>
      <div class="ds-wizard-actions">
        <a class="ds-btn ds-btn-primary" href="https://docs.syndrax.io/runner" target="_blank" rel="noopener">Download &amp; Install Runner</a>
        <button class="ds-btn ds-btn-ghost" id="ds-wizard-have-it">I Already Have It Installed</button>
      </div>
    </div>`;
  }

  // If called with render(), emit the wizard HTML that way (testable, also works server-render).
  // If a #ds-wizard-slot exists in the DOM, also bind events there.
  render(wizardHtml('start'));
  const slot = document.getElementById('ds-wizard-slot');
  if (slot) {
    _bindWizardEvents(slot, onConnect, onSkip, wizardHtml);
  }
}

function _bindWizardEvents(container, onConnect, onSkip, wizardHtml) {
  const haveIt = container.querySelector('#ds-wizard-have-it');
  if (haveIt) {
    haveIt.onclick = async () => {
      container.innerHTML = wizardHtml('pair', null, false);
      // Call pairing endpoint if onConnect provided
      if (onConnect) {
        try {
          const result = await onConnect();
          const codeEl = container.querySelector('#ds-pair-code');
          const stEl = container.querySelector('#ds-pair-status');
          if (codeEl) codeEl.textContent = result?.code || 'Error';
          if (stEl && result?.code) stEl.innerHTML = 'Expires in 5 minutes &mdash; waiting for runner to connect&hellip;';
        } catch (e) {
          const codeEl = container.querySelector('#ds-pair-code');
          if (codeEl) codeEl.textContent = 'Error';
        }
      }
      const back = container.querySelector('#ds-wizard-back');
      if (back) {
        back.onclick = () => {
          container.innerHTML = wizardHtml('start');
          _bindWizardEvents(container, onConnect, onSkip, wizardHtml);
        };
      }
    };
  }
  const skip = container.querySelector('#ds-wizard-skip');
  if (skip && onSkip) skip.onclick = onSkip;
}

// ── Overview ──────────────────────────────────────────────────────────────────

export async function renderDevOverview({ api, render }) {
  render(devNavHtml('overview') +
    `<div class="ds-main" id="ds-main">${spinner()}</div>`);

  let jobs = [], health = null;
  try { jobs  = await api.listJobs();    } catch {}
  try { health = await api.runnerStatus(); } catch {}

  const runnerOnline = health?.connected === true;
  const active       = jobs.filter(j => ['pending','claimed','running','validating','repairing'].includes(j.status));
  const awaitApproval = jobs.filter(j => j.status === 'succeeded' && j.approved == null);
  const failed       = jobs.filter(j => j.status === 'failed');

  const main = document.getElementById('ds-main');
  if (!main) return;

  const noRunner = !runnerOnline;
  const noJobs   = jobs.length === 0;

  // Compose page
  let body = `<h2>Build Studio</h2>`;

  // Launcher install card — always shown so owner + team can download
  body += `<div style="background:rgba(99,102,241,.06);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:16px 20px;margin-bottom:22px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
    <div style="font-size:22px">&#128640;</div>
    <div style="flex:1;min-width:200px">
      <div style="font-size:14px;font-weight:700;color:var(--ds-t1)">Dev Studio Launcher</div>
      <div style="font-size:12px;color:var(--ds-t2);margin-top:3px">
        One-click tool that starts all three services (API, site, runner) and opens your browser automatically.
        Double-click to run — no terminal commands needed.
      </div>
    </div>
    <button class="ds-btn ds-btn-primary" id="ds-dl-launcher">&#11015; Download Launcher (.ps1)</button>
    <button class="ds-btn ds-btn-ghost ds-btn-sm" data-devview="team" style="white-space:nowrap">Invite Team &rarr;</button>
  </div>`;

  // Show setup wizard inline if no runner and no jobs
  if (noRunner && noJobs) {
    body += `<div id="ds-wizard-slot"></div>`;
  } else {
    // Runner offline banner (but has jobs — show CTA)
    if (noRunner) {
      body += `<div class="ds-banner">
        <span class="ds-banner-icon">&#9888;</span>
        <span><strong>Runner offline.</strong> Start the local runner to process new build jobs.</span>
        <button class="ds-btn ds-btn-ghost ds-btn-sm" data-devview="runners">Connect This PC</button>
      </div>`;
    }

    // Stats
    body += `<div class="ds-grid">
      ${statCard('Runner', runnerOnline ? 'Online' : 'Offline', runnerOnline ? health?.status || '' : 'not reachable', runnerOnline ? 'var(--ds-green)' : 'var(--ds-red)')}
      ${statCard('Active Jobs', active.length, `${jobs.length} total`, '')}
      ${statCard('Awaiting Approval', awaitApproval.length, 'ready to commit', awaitApproval.length > 0 ? 'var(--ds-amber)' : '')}
      ${statCard('Recent Failures', failed.length, 'last 50 jobs', failed.length > 0 ? 'var(--ds-red)' : '')}
    </div>`;

    // Approval CTA (prominent when count > 0)
    if (awaitApproval.length > 0) {
      body += `<div class="ds-approval-cta">
        <div>
          <p><strong>${awaitApproval.length} build${awaitApproval.length > 1 ? 's' : ''} awaiting your approval.</strong> Review the generated code before committing.</p>
        </div>
        <button class="ds-btn ds-btn-success" data-devjob="${esc(awaitApproval[0].id)}">Review Now &rarr;</button>
      </div>`;
    }

    // Active jobs
    body += card('Active Jobs',
      active.length
        ? `<div class="ds-card-bd-flush"><table class="ds-table">
            <thead><tr><th>ID</th><th>Status</th><th>Phase</th><th>Task</th><th>Age</th></tr></thead>
            <tbody>
              ${active.map(j => `<tr class="row-click" data-devjob="${esc(j.id)}">
                <td><code>${j.id.slice(0,8)}</code></td>
                <td>${statusBadge(j.status)}</td>
                <td class="c-t3">${esc(j.phase || '')}</td>
                <td class="ds-tcell-prompt">${esc(j.prompt)}</td>
                <td class="c-t3">${relTime(j.updated_at)}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>`
        : `<div class="ds-empty"><p>No active jobs</p></div>`,
      active.length || null
    );

    // Recent failures
    body += card('Recent Failures',
      failed.length
        ? `<div class="ds-card-bd-flush"><table class="ds-table">
            <thead><tr><th>ID</th><th>Error</th><th>When</th></tr></thead>
            <tbody>
              ${failed.slice(0, 5).map(j => `<tr class="row-click" data-devjob="${esc(j.id)}">
                <td><code>${j.id.slice(0,8)}</code></td>
                <td class="ds-tcell-prompt c-red">${esc((j.error || '').slice(0, 120))}</td>
                <td class="c-t3">${relTime(j.updated_at)}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>`
        : `<div class="ds-empty"><p>No failures &mdash; all clear</p></div>`
    );
  }

  // Primary action
  body += `<div class="ds-btn-row" style="margin-top:8px">
    <button class="ds-btn ds-btn-primary" data-devview="builder">+ New Build</button>
    <button class="ds-btn ds-btn-ghost"   data-devview="jobs">All Jobs &rarr;</button>
  </div>`;

  main.innerHTML = body;

  // Download launcher button
  const dlBtn = document.getElementById('ds-dl-launcher');
  if (dlBtn && api.downloadLauncher) {
    dlBtn.onclick = async () => {
      dlBtn.disabled = true;
      dlBtn.textContent = 'Downloading…';
      try {
        await api.downloadLauncher();
        dlBtn.textContent = '✓ Downloaded';
        setTimeout(() => { dlBtn.disabled = false; dlBtn.innerHTML = '&#11015; Download Launcher (.ps1)'; }, 3000);
      } catch (e) {
        dlBtn.textContent = 'Error — try again';
        dlBtn.disabled = false;
        console.error('launcher download error', e);
      }
    };
  }

  // Mount wizard if slot present
  if (noRunner && noJobs) {
    const slot = document.getElementById('ds-wizard-slot');
    if (slot) {
      slot.innerHTML = _wizardStartHtml();
      _bindWizardEvents(slot, api.pairRunner ? () => api.pairRunner() : null, null, (step, code) => {
        if (step === 'pair') return _wizardPairHtml(code);
        return _wizardStartHtml();
      });
    }
  }
}

function _wizardStartHtml() {
  return `<div class="ds-wizard">
    <h3>Dev Studio</h3>
    <p>Connect this Windows PC so Syndrax can build and test code locally.<br>
    The runner runs in your terminal and never opens a port to the internet.</p>
    <div class="ds-wizard-actions">
      <a class="ds-btn ds-btn-primary" href="https://docs.syndrax.io/runner" target="_blank" rel="noopener">Download &amp; Install Runner</a>
      <button class="ds-btn ds-btn-ghost" id="ds-wizard-have-it">I Already Have It Installed</button>
    </div>
  </div>`;
}

function _wizardPairHtml(code, error) {
  return `<div class="ds-wizard">
    <h3>Pair This PC</h3>
    <p>Enter this code in your runner terminal when prompted.</p>
    <div class="ds-pair-code" id="ds-pair-code">${esc(code || (error ? 'Error' : 'Generating…'))}</div>
    <div class="ds-pair-status" id="ds-pair-status">${
      error
        ? `<span class="c-red">${esc(error)}</span>`
        : code
          ? 'Expires in 5 minutes — waiting for runner to connect…'
          : ''
    }</div>
    <div style="margin-top:16px">
      <button class="ds-btn ds-btn-ghost" id="ds-wizard-back">&larr; Back</button>
    </div>
  </div>`;
}

// ── Builder ───────────────────────────────────────────────────────────────────

const STARTER_TASKS = [
  'Create marketplace workflow',
  'Fix failing test',
  'Add UI feature',
  'Create backend endpoint',
  'Improve workflow reliability',
  'Review code quality',
];

export function renderDevBuilder({ render, onSubmit }) {
  render(devNavHtml('builder') + `
    <div class="ds-main">
      <h2>New Build</h2>
      <div class="ds-card"><div class="ds-card-bd">
        <div class="ds-field">
          <label class="ds-label" for="db-prompt">What should Syndrax build?</label>
          <textarea id="db-prompt" class="ds-input ds-textarea"
            placeholder="Describe the code change — e.g. 'Add rate limiting to the API proxy' or 'Fix the TypeScript error in workflow.ts'"></textarea>
        </div>
        <div class="ds-chips">
          ${STARTER_TASKS.map(t => `<button class="ds-chip" data-fill="${esc(t)}">${esc(t)}</button>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="ds-field">
            <label class="ds-label" for="db-repo">Repository</label>
            <select id="db-repo" class="ds-select" style="width:100%">
              <option value=".">Browse &#9660;</option>
              <option value=".">. (current worktree)</option>
            </select>
          </div>
          <div class="ds-field">
            <label class="ds-label" for="db-buildtype">Build type</label>
            <select id="db-buildtype" class="ds-select" style="width:100%">
              <option value="">Auto-detect</option>
              <option value="feature">Feature</option>
              <option value="fix">Bug fix</option>
              <option value="refactor">Refactor</option>
              <option value="test">Add tests</option>
            </select>
          </div>
        </div>
        <div class="ds-btn-row">
          <button class="ds-btn ds-btn-primary" id="db-submit">&#9658; Build</button>
          <span id="db-status" style="font-size:12px;color:var(--ds-t3)"></span>
        </div>
        <div class="ds-advanced">
          <details>
            <summary>+ Advanced options</summary>
            <div class="ds-advanced-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="ds-field">
                  <label class="ds-label" for="db-branch">Branch</label>
                  <input id="db-branch" class="ds-input" type="text" value="main" />
                </div>
                <div class="ds-field">
                  <label class="ds-label" for="db-model">Model profile</label>
                  <select id="db-model" class="ds-select" style="width:100%">
                    <option value="">hermes (Sonnet, default)</option>
                    <option value="hermes-fast">hermes-fast (Haiku)</option>
                    <option value="hermes-deep">hermes-deep (Opus)</option>
                  </select>
                </div>
              </div>
              <div class="ds-field">
                <label class="ds-label" for="db-paths">Allowed paths (comma-separated)</label>
                <input id="db-paths" class="ds-input" type="text" placeholder="src/, tests/, leave blank for all" />
              </div>
              <div class="ds-field">
                <label class="ds-label" for="db-repairs">Max repair attempts</label>
                <input id="db-repairs" class="ds-input" type="number" value="3" min="0" max="10" style="width:80px" />
              </div>
            </div>
          </details>
        </div>
      </div></div>
    </div>`);

  // Chip fill
  document.querySelectorAll('.ds-chip[data-fill]').forEach(chip => {
    chip.onclick = () => {
      const ta = document.getElementById('db-prompt');
      if (ta) ta.value = chip.dataset.fill;
    };
  });

  // Submit
  const btn    = document.getElementById('db-submit');
  const statusEl = document.getElementById('db-status');
  if (!btn) return;

  btn.onclick = async () => {
    const prompt = document.getElementById('db-prompt')?.value?.trim();
    if (!prompt) { statusEl.textContent = 'A prompt is required.'; statusEl.style.color = 'var(--ds-red)'; return; }
    btn.disabled = true; btn.textContent = 'Submitting…'; statusEl.textContent = '';
    try {
      const job = await onSubmit({
        prompt,
        target_repo:    document.getElementById('db-repo')?.value?.trim()    || '.',
        base_branch:    document.getElementById('db-branch')?.value?.trim()  || 'main',
        model:          document.getElementById('db-model')?.value            || null,
        build_type:     document.getElementById('db-buildtype')?.value        || null,
        allowed_paths:  (document.getElementById('db-paths')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
        max_repairs:    parseInt(document.getElementById('db-repairs')?.value || '3', 10),
      });
      statusEl.textContent = `Job ${job.id?.slice(0, 8)} queued.`;
      statusEl.style.color = 'var(--ds-green)';
      btn.textContent = '&#9658; Build'; btn.disabled = false;
      document.getElementById('db-prompt').value = '';
    } catch (e) {
      statusEl.textContent = e.message; statusEl.style.color = 'var(--ds-red)';
      btn.textContent = '&#9658; Build'; btn.disabled = false;
    }
  };
}

// ── Jobs list ─────────────────────────────────────────────────────────────────

export async function renderDevJobs({ api, render, onSelect }) {
  render(devNavHtml('jobs') +
    `<div class="ds-main" id="ds-main">${spinner()}</div>`);

  let jobs = [];
  try {
    jobs = await api.listJobs();
  } catch (e) {
    document.getElementById('ds-main').innerHTML =
      `<h2>Jobs</h2><div class="ds-empty"><p class="c-red">${esc(e.message)}</p></div>`;
    return;
  }

  const main = document.getElementById('ds-main');
  if (!main) return;

  if (!jobs.length) {
    main.innerHTML = `<h2>Jobs</h2>
      <div class="ds-empty">
        <p>No jobs yet.</p>
        <button class="ds-btn ds-btn-primary" data-devview="builder">+ New Build</button>
      </div>`;
    return;
  }

  main.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h2 style="margin:0">Jobs <span class="c-t3" style="font-size:14px;font-weight:400">(${jobs.length})</span></h2>
      <button class="ds-btn ds-btn-primary" data-devview="builder">+ New Build</button>
    </div>
    <div class="ds-card">
      <div class="ds-card-bd-flush">
        <table class="ds-table">
          <thead><tr><th>ID</th><th>Status</th><th>Phase</th><th>Task</th><th>Repairs</th><th>Updated</th></tr></thead>
          <tbody>
            ${jobs.map(j => `
              <tr class="row-click" data-devjob="${esc(j.id)}">
                <td><code style="color:var(--ds-t2)">${j.id.slice(0, 8)}</code></td>
                <td>${statusBadge(j.status)}</td>
                <td class="c-t3">${esc(j.phase || '')}</td>
                <td class="ds-tcell-prompt">${esc(j.prompt)}</td>
                <td class="${(j.repair_attempts || 0) > 0 ? 'c-amber' : 'c-t3'}">${j.repair_attempts || 0}</td>
                <td class="c-t3">${relTime(j.updated_at)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

// ── Job detail ────────────────────────────────────────────────────────────────

const TIMELINE_PHASES = [
  { key: null,       label: 'Preparing repository' },
  { key: null,       label: 'Creating worktree'    },
  { key: null,       label: 'Reading memory'       },
  { key: 'plan',     label: 'Planning'             },
  { key: 'generate', label: 'Generating code'      },
  { key: 'validate', label: 'Running tests'        },
  { key: 'repair',   label: 'Repairing'            },
];

function buildTimeline(job) {
  const phaseOrder = ['plan', 'generate', 'validate', 'repair'];
  const currentPhase = job.phase || null;
  const currentPhaseIdx = phaseOrder.indexOf(currentPhase);

  return `<ul class="ds-timeline">
    ${TIMELINE_PHASES.map((item, idx) => {
      let state = 'done';
      if (item.key) {
        const itemPhaseIdx = phaseOrder.indexOf(item.key);
        if (item.key === currentPhase) {
          state = 'current';
        } else if (currentPhaseIdx >= 0 && itemPhaseIdx > currentPhaseIdx) {
          state = 'pending';
        } else if (currentPhaseIdx < 0) {
          // No phase yet — first 3 items done (infra), rest pending
          state = idx < 3 ? 'done' : 'pending';
        }
      } else {
        // Infrastructure steps: done if any phase reached
        state = currentPhase ? 'done' : (idx < 3 && job.status !== 'pending' ? 'done' : 'pending');
      }

      const dotClass  = `ds-tl-dot-${state}`;
      const labelClass = state === 'current' ? 'current' : state === 'pending' ? 'pending' : '';
      const symbol = state === 'done' ? '&#10003;' : state === 'current' ? '&#9210;' : '';

      return `<li class="ds-tl-item">
        <div class="ds-tl-dot ${dotClass}">${symbol}</div>
        <div class="ds-tl-label ${labelClass}">${esc(item.label)}</div>
      </li>`;
    }).join('')}
  </ul>`;
}

export async function renderDevJobDetail({ api, render, jobId, onApprove, onDelete }) {
  render(devNavHtml('jobs') +
    `<div class="ds-main" id="ds-main">${spinner()}</div>`);

  let job;
  try {
    job = await api.getJob(jobId);
  } catch (e) {
    document.getElementById('ds-main').innerHTML =
      `<div class="ds-empty"><p class="c-red">${esc(e.message)}</p>
       <button class="ds-btn ds-btn-ghost" data-devview="jobs">&larr; Back</button></div>`;
    return;
  }

  const main = document.getElementById('ds-main');
  if (!main) return;

  const isActive   = ['pending','claimed','running','validating','repairing'].includes(job.status);
  const isSuccess  = job.status === 'succeeded';
  const isFailed   = job.status === 'failed';
  const canApprove = isSuccess && job.approved == null;
  const canReject  = (isSuccess || isFailed) && job.approved == null;

  let body = `
    <div class="ds-btn-row" style="margin-bottom:12px">
      <button class="ds-btn ds-btn-ghost ds-btn-sm" data-devview="jobs">&larr; Jobs</button>
    </div>
    <div class="ds-jd-header">
      <h3>${esc(job.prompt)}</h3>
      <div class="meta">
        <code style="color:var(--ds-t3)">${job.id.slice(0, 8)}</code>
        ${statusBadge(job.status)}
        ${job.phase ? `<span class="c-t3">${esc(job.phase)}</span>` : ''}
        <span class="c-t3">${relTime(job.created_at)}</span>
      </div>
    </div>`;

  // ── Active state: timeline ──
  if (isActive) {
    body += card('Progress', buildTimeline(job));
    body += `<div class="ds-empty" style="padding:16px 0">
      <div class="ds-spinner" style="margin:0 auto"></div>
      <p style="margin-top:10px;font-size:12px;color:var(--ds-t3)">Auto-refreshing every 3s…</p>
    </div>`;
    body += `<div class="ds-btn-row" style="margin-top:4px">
      <button class="ds-btn ds-btn-ghost ds-btn-sm" id="dj-cancel">Cancel Job</button>
    </div>`;
  }

  // ── Succeeded: review screen ──
  if (isSuccess) {
    const filesChanged = (job.generated_files || []).length;
    const testsPassed  = job.validation?.passed;

    body += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
      <span style="font-size:22px">&#10003;</span>
      <div>
        <div style="font-size:15px;font-weight:700;color:var(--ds-green)">Build Complete &mdash; Ready for Review</div>
        <div style="font-size:12px;color:var(--ds-t3);margin-top:2px">
          ${filesChanged} file${filesChanged !== 1 ? 's' : ''} changed${testsPassed != null ? ` &middot; tests ${testsPassed ? 'passed' : 'failed'}` : ''}
        </div>
      </div>
    </div>`;

    if (canApprove || canReject) {
      body += `<div class="ds-btn-row" style="margin-bottom:20px">
        ${canApprove ? `<button class="ds-btn ds-btn-success" id="dj-approve">&#10003; Approve &amp; Commit</button>` : ''}
        <button class="ds-btn ds-btn-ghost" id="dj-repair">Request Repair</button>
        ${canReject  ? `<button class="ds-btn ds-btn-danger"  id="dj-reject">&#10005; Reject</button>` : ''}
      </div>`;
    }

    if (filesChanged) {
      body += card('Files Changed',
        (job.generated_files || []).map(f => {
          const cls = f.operation === 'create' ? 'ds-fchip-create'
                    : f.operation === 'delete' ? 'ds-fchip-delete'
                    : 'ds-fchip-modify';
          const icon = f.operation === 'create' ? '[+]'
                     : f.operation === 'delete' ? '[&minus;]'
                     : '[~]';
          return `<span class="ds-fchip ${cls}">${icon} ${esc(f.path)}</span>`;
        }).join(''),
        `${filesChanged}`
      );
    }

    if (job.validation) {
      body += card('Tests',
        `<div class="${job.validation.passed ? 'c-green' : 'c-red'}" style="font-weight:600;margin-bottom:8px">
          ${job.validation.passed ? '&#10003; All tests passed' : '&#10005; Tests failed'}
        </div>
        ${(job.validation.errors || []).map(e => `<div class="c-red" style="font-size:12px;margin:2px 0">${esc(e.slice(0, 200))}</div>`).join('')}
        ${(job.validation.warnings || []).map(w => `<div class="c-amber" style="font-size:12px;margin:2px 0">${esc(w)}</div>`).join('')}
        ${job.validation.stdout ? `<pre class="ds-code" style="margin-top:10px">${esc(job.validation.stdout.slice(0, 2000))}</pre>` : ''}`
      );
    }
  }

  // ── Failed: failure screen ──
  if (isFailed) {
    body += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
      <span style="font-size:22px;color:var(--ds-red)">&#10005;</span>
      <div>
        <div style="font-size:15px;font-weight:700;color:var(--ds-red)">Build Could Not Be Completed</div>
        ${job.error ? `<div style="font-size:12px;color:var(--ds-t3);margin-top:2px">${esc(job.error.slice(0, 200))}</div>` : ''}
      </div>
    </div>`;

    // What Syndrax tried
    const tried = [];
    tried.push({ ok: !!(job.plan_text), label: 'Plan created' });
    (job.repair_attempts || []).forEach((r, i) => {
      tried.push({
        ok: r.validation_after?.passed === true,
        label: i === 0
          ? 'Generation attempt — validation failed'
          : `Repair attempt ${i} — ${r.validation_after?.passed ? 'passed' : 'still failing'}`,
      });
    });

    if (tried.length) {
      body += card('What Syndrax tried',
        `<ul style="list-style:none;padding:0;margin:0;font-size:13px">
          ${tried.map(t => `<li style="padding:6px 0;display:flex;gap:8px;align-items:center">
            <span class="${t.ok ? 'c-green' : 'c-red'}">${t.ok ? '&#10003;' : '&#10005;'}</span>
            <span style="color:var(--ds-t2)">${esc(t.label)}</span>
          </li>`).join('')}
        </ul>`
      );
    }

    body += `<div class="ds-btn-row">
      <button class="ds-btn ds-btn-primary" id="dj-retry">Retry with stronger model</button>
      <button class="ds-btn ds-btn-ghost"   id="dj-editprompt">Edit task</button>
      <button class="ds-btn ds-btn-danger"  id="dj-delete">Delete</button>
    </div>`;

    if (job.error) {
      body += card('Error detail', `<pre class="ds-code c-red">${esc(job.error)}</pre>`);
    }
  }

  // ── Common: plan / evidence ──
  if (job.plan_text) {
    body += card('Implementation Plan', `<pre class="ds-code">${esc(job.plan_text.slice(0, 3000))}</pre>`);
  }

  // Repair history
  if ((job.repair_attempts || []).length) {
    body += card('Repair Attempts',
      job.repair_attempts.map(r => `<div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <strong style="color:var(--ds-t1)">Attempt ${r.attempt}</strong>
        &mdash; patch ${r.patch_applied ? '<span class="c-green">&#10003;</span>' : '<span class="c-red">&#10005;</span>'}
        ${r.validation_after ? (r.validation_after.passed ? '<span class="c-green">&#8594; passed</span>' : '<span class="c-red">&#8594; still failing</span>') : ''}
        ${(r.errors || []).map(e => `<div class="c-red" style="font-size:12px;margin:2px 0">${esc(e.slice(0, 150))}</div>`).join('')}
      </div>`).join(''),
      `&#8635; ${job.repair_attempts.length}`
    );
  }

  // Committed result
  if (job.approved === true) {
    body += card('&#10003; Approved &amp; Committed',
      job.metadata?.committed_sha
        ? `<code style="color:var(--ds-green)">SHA: ${esc(job.metadata.committed_sha)}</code>`
        : ''
    );
  } else if (job.approved === false) {
    body += card('&#10005; Rejected', '');
  }

  main.innerHTML = body;

  // Event bindings
  const aa = document.getElementById('dj-approve');
  const ar = document.getElementById('dj-reject');
  const ad = document.getElementById('dj-delete');
  const ac = document.getElementById('dj-cancel');
  const aretry = document.getElementById('dj-retry');
  const aedit  = document.getElementById('dj-editprompt');
  const arepair = document.getElementById('dj-repair');

  if (aa) {
    aa.onclick = async () => {
      aa.disabled = true; aa.textContent = 'Committing…';
      try { await onApprove(job.id, true); } catch (e) { aa.disabled = false; aa.textContent = '&#10003; Approve & Commit'; }
    };
  }
  if (ar) {
    ar.onclick = async () => {
      if (!confirm('Reject this build?')) return;
      ar.disabled = true;
      try { await onApprove(job.id, false); } catch (e) { ar.disabled = false; }
    };
  }
  if (ad) {
    ad.onclick = async () => {
      if (!confirm('Delete job and remove worktree?')) return;
      try { await onDelete(job.id); } catch {}
    };
  }
  if (ac && api.cancelJob) {
    ac.onclick = async () => {
      if (!confirm('Cancel this job?')) return;
      try { await api.cancelJob(job.id); renderDevJobDetail({ api, render, jobId, onApprove, onDelete }); } catch {}
    };
  }
  if (aretry) {
    aretry.onclick = () => {
      // Navigate to builder prefilled
      const builder = document.querySelector('[data-devview="builder"]');
      if (builder) builder.click();
    };
  }
  if (aedit) {
    aedit.onclick = () => {
      const builder = document.querySelector('[data-devview="builder"]');
      if (builder) builder.click();
    };
  }
  if (arepair && api.approveJob) {
    arepair.onclick = async () => {
      arepair.disabled = true; arepair.textContent = 'Queuing repair…';
      try {
        await api.approveJob(job.id, { repair: true });
        renderDevJobDetail({ api, render, jobId, onApprove, onDelete });
      } catch (e) { arepair.disabled = false; arepair.textContent = 'Request Repair'; }
    };
  }

  if (isActive) {
    setTimeout(() => renderDevJobDetail({ api, render, jobId, onApprove, onDelete }), 3000);
  }
}

// ── Runners ───────────────────────────────────────────────────────────────────

export async function renderDevRunners({ api, render }) {
  render(devNavHtml('runners') +
    `<div class="ds-main" id="ds-main">${spinner()}</div>`);

  let runnerList = null;
  try { runnerList = await api.listRunners(); } catch {}
  const runners = runnerList?.runners || [];
  const onlineRunners = runners.filter(r => r.online && !r.revoked);
  const runnerOnline = onlineRunners.length > 0;

  const main = document.getElementById('ds-main');
  if (!main) return;

  // Status bar
  let body = `
    <h2>Runners</h2>
    <p class="ds-page-desc">The local runner polls <code>api.syndrax.io/api/runner</code> for pending jobs and executes them on this machine using a revocable runner credential — not your Cognito session. The browser never talks to the runner directly.</p>
    <div class="ds-grid">
      ${statCard('Connected Runners', String(onlineRunners.length), onlineRunners.length ? onlineRunners.map(r => esc(r.runner_id)).join(', ') : 'None', onlineRunners.length ? 'var(--ds-green)' : 'var(--ds-red)')}
      ${statCard('Total Paired',      String(runners.filter(r => !r.revoked).length), 'Active credentials in DB', '')}
      ${statCard('Cloud API',         'Reachable', devApiBase() + '/api/dev/*', 'var(--ds-green)')}
    </div>`;

  // Pairing section
  body += card('Pair a New Machine',
    `<div style="max-width:480px">
      <ol style="color:var(--ds-t2);font-size:13px;line-height:2.2;margin:0 0 16px;padding-left:20px">
        <li>On the target PC, run: <code style="color:var(--ds-blue)">npm run runner:doctor</code></li>
        <li>Click <strong>Generate Pairing Code</strong> below.</li>
        <li>The doctor will display the code — paste it here to confirm.</li>
        <li>After pairing, add <code>SYNDRAX_RUNNER_CREDENTIAL</code> to the runner <code>.env</code>.</li>
      </ol>
      <div id="ds-pair-area">
        <button class="ds-btn ds-btn-primary" id="ds-gen-pair">Generate Pairing Code</button>
      </div>
    </div>`
  );

  // Registered runners table
  if (runners.length > 0) {
    const rows = runners.map(r => `
      <tr>
        <td style="font-family:monospace">${esc(r.runner_id)}</td>
        <td><span style="color:${r.online ? 'var(--ds-green)' : r.revoked ? 'var(--ds-red)' : 'var(--ds-t3)'}">${r.revoked ? 'Revoked' : r.online ? 'Online' : 'Offline'}</span></td>
        <td style="font-size:11px;color:var(--ds-t3)">${r.last_used_at ? new Date(r.last_used_at).toLocaleString() : 'Never'}</td>
        <td style="font-size:11px;color:var(--ds-t3)">${esc(String(r.metadata?.version || '—'))}</td>
        <td>${!r.revoked ? `<button class="ds-btn ds-btn-ghost ds-btn-sm ds-revoke-btn" data-id="${esc(r.runner_id)}" style="color:var(--ds-red)">Revoke</button>` : '—'}</td>
      </tr>`).join('');
    body += card('Registered Runners',
      `<div class="ds-card-bd-flush">
        <table class="ds-table">
          <thead><tr><th>Runner ID</th><th>Status</th><th>Last Seen</th><th>Version</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
    );
  }

  body += card('Windows Installer',
    `<div style="font-size:13px;color:var(--ds-t2);line-height:1.8;margin-bottom:12px">
      Download and run the installer on any Windows PC to set up a runner automatically.
      It copies the runner to <code>%LOCALAPPDATA%\\SyndraxDevRunner</code>, installs dependencies, and registers a startup task.
    </div>
    <a class="ds-btn ds-btn-ghost" href="/assets/Install-SyndraxDevRunner.ps1" download>Download Installer (.ps1)</a>
    <div style="font-size:11px;color:var(--ds-t3);margin-top:10px">Run from an elevated PowerShell prompt after download.</div>`
  );

  main.innerHTML = body;

  // Pairing button handler
  const genBtn = document.getElementById('ds-gen-pair');
  if (genBtn && api.pairRunner) {
    genBtn.onclick = async () => {
      genBtn.disabled = true; genBtn.textContent = 'Generating…';
      try {
        const result = await api.pairRunner();
        const area = document.getElementById('ds-pair-area');
        if (area) {
          area.innerHTML = `
            <div class="ds-pair-code">${esc(result?.code || 'Error')}</div>
            <div class="ds-pair-status">Expires in 5 minutes &mdash; enter this code on the runner PC to complete pairing.</div>
            <div style="font-size:11px;color:var(--ds-t3);margin-top:6px">The runner will output a <code>SYNDRAX_RUNNER_CREDENTIAL</code> value to add to its <code>.env</code>.</div>
            <button class="ds-btn ds-btn-ghost ds-btn-sm" style="margin-top:12px" id="ds-gen-again">Regenerate</button>`;
          const again = document.getElementById('ds-gen-again');
          if (again) again.onclick = () => { genBtn.disabled = false; genBtn.textContent = 'Generate Pairing Code'; genBtn.click(); };
        }
      } catch (e) {
        genBtn.disabled = false; genBtn.textContent = 'Generate Pairing Code';
        const area = document.getElementById('ds-pair-area');
        if (area) area.insertAdjacentHTML('beforeend', `<div class="c-red" style="font-size:12px;margin-top:8px">${esc(e.message)}</div>`);
      }
    };
  }

  // Revoke buttons
  if (api.revokeRunner) {
    main.querySelectorAll('.ds-revoke-btn').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm(`Revoke runner "${btn.dataset.id}"? The runner will be unable to claim jobs until re-paired.`)) return;
        btn.disabled = true; btn.textContent = 'Revoking…';
        try {
          await api.revokeRunner(btn.dataset.id);
          renderDevRunners({ api, render }); // reload
        } catch (e) {
          btn.disabled = false; btn.textContent = 'Revoke';
          alert(`Could not revoke: ${e.message}`);
        }
      };
    });
  }
}

// ── Models ────────────────────────────────────────────────────────────────────

export function renderDevModels({ render }) {
  const models = [
    { alias: 'hermes',       provider: 'Anthropic',     model: 'claude-sonnet-4-6',           role: 'Default planner + generator' },
    { alias: 'hermes-fast',  provider: 'Anthropic',     model: 'claude-haiku-4-5-20251001',   role: 'Fast iteration'              },
    { alias: 'hermes-deep',  provider: 'Anthropic',     model: 'claude-opus-4-8',             role: 'Complex tasks'               },
    { alias: 'ollama:*',     provider: 'Ollama',        model: 'any local model',             role: 'Local / offline'             },
    { alias: 'openai:*',     provider: 'OpenAI-compat', model: 'any compatible endpoint',     role: 'Custom providers'            },
  ];

  render(devNavHtml('models') + `
    <div class="ds-main">
      <h2>Models &amp; Providers</h2>
      <p class="ds-page-desc">Model aliases used in the runner. Configure via environment variables on the runner machine, not the cloud API.</p>
      <div class="ds-card"><div class="ds-card-bd-flush">
        <table class="ds-table">
          <thead><tr><th>Alias</th><th>Provider</th><th>Model ID</th><th>Role</th></tr></thead>
          <tbody>
            ${models.map(m => `<tr>
              <td><code style="color:var(--ds-blue)">${esc(m.alias)}</code></td>
              <td><span style="font-size:11px;font-weight:600;color:var(--ds-t3)">${esc(m.provider)}</span></td>
              <td><code style="color:var(--ds-t3);font-size:11px">${esc(m.model)}</code></td>
              <td style="color:var(--ds-t3);font-size:12px">${esc(m.role)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div></div>
      ${card('Environment Variables',
        `<div style="font-size:12px;color:var(--ds-t2);line-height:2.2;font-family:monospace">
          <div><span style="color:var(--ds-blue)">ANTHROPIC_API_KEY</span> &mdash; required for hermes/* models</div>
          <div><span style="color:var(--ds-blue)">OLLAMA_BASE_URL</span> &mdash; default http://localhost:11434</div>
          <div><span style="color:var(--ds-blue)">OPENAI_COMPAT_BASE_URL</span> &mdash; for openai-compat provider</div>
          <div><span style="color:var(--ds-blue)">OPENAI_COMPAT_API_KEY</span> &mdash; API key for that endpoint</div>
        </div>`
      )}
    </div>`);
}

// ── Memory ────────────────────────────────────────────────────────────────────

export async function renderDevMemory({ api, render }) {
  render(devNavHtml('memory') + `<div class="ds-main" id="ds-main">${spinner()}</div>`);
    const main = document.getElementById('ds-main');
    if (!main) return;

    let entries = [];
    let stats = {};
    let searchQ = '';
    let strategyFilter = '';
    let viewMode = 'grid'; // 'grid' or 'graph'

    async function load() {
      try {
        const r = await api.listMemory(searchQ, strategyFilter);
        entries = r.entries || [];
        stats = r.stats || {};
      } catch (e) {
        main.innerHTML = `<h2>Memory</h2><div class="ds-empty"><p class="c-red">${esc(e.message || 'Failed to load memory')}</p></div>`;
        return;
      }
      paint();
    }

    const STRATEGIES = ['declare_or_import', 'add_import', 'type_cast', 'syntax_fix', 'fix_selector', 'fix_wait', 'general'];
    const STRATEGY_LABELS = {
      declare_or_import: 'Declare/Import', add_import: 'Add Import', type_cast: 'Type Cast',
      syntax_fix: 'Syntax', fix_selector: 'Selector', fix_wait: 'Wait Fix', general: 'General',
    };

    function paint() {
      const total = stats.total || 0;
      const totalSeen = stats.total_seen || 0;
      const totalFixed = stats.total_fixed || 0;
      const highConf = stats.high_confidence || 0;
      const uniqueErrors = stats.unique_errors || 0;
      const overallRate = totalSeen > 0 ? Math.round((totalFixed / totalSeen) * 100) : 0;

      const cardEl = (e) => {
        const rate = Math.round((e.success_rate || 0) * 100);
        const rateColor = rate >= 80 ? '#4ade80' : rate >= 50 ? '#fbbf24' : '#f87171';
        return `<div class="ds-memory-card" data-mem-id="${esc(e.id)}">
          <div style="display:flex;align-items:start;gap:8px;margin-bottom:6px">
            <span class="ds-badge" style="--badge-c:#3b82f6;font-size:10px">TS${esc(e.error_code)}</span>
            <span class="ds-badge" style="--badge-c:#64748b;font-size:9px">${esc(STRATEGY_LABELS[e.fix_strategy] || e.fix_strategy)}</span>
            <div style="flex:1"></div>
            <span style="font-size:11px;font-weight:700;color:${rateColor}">${rate}%</span>
          </div>
          <div style="font-size:12px;color:var(--ds-t2);line-height:1.4;margin-bottom:6px">${esc(e.error_message.slice(0, 120))}${e.error_message.length > 120 ? '…' : ''}</div>
          <div style="font-size:11px;color:var(--ds-t3);line-height:1.4">${esc(e.fix_summary)}</div>
          ${e.fix_after ? `<details style="margin-top:6px"><summary style="font-size:10px;color:var(--ds-t3);cursor:pointer">Fix snippet</summary><pre style="font-family:'Fira Code',monospace;font-size:10px;color:#94a3b8;background:rgba(0,0,0,.25);border-radius:6px;padding:6px 8px;margin:4px 0;white-space:pre-wrap">${esc(e.fix_after)}</pre></details>` : ''}
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
            <span style="font-size:10px;color:var(--ds-t3)">Fixed ${e.times_fixed}/${e.times_seen} times</span>
            <span style="font-size:10px;color:var(--ds-t3)">·</span>
            <span style="font-size:10px;color:var(--ds-t3)">${relTime(e.updated_at)}</span>
            <div style="flex:1"></div>
            <button class="ds-btn ds-btn-sm mem-del" data-del-id="${esc(e.id)}" style="background:rgba(239,68,68,.06);color:#f87171;border:1px solid rgba(239,68,68,.15);padding:2px 7px;font-size:10px">🗑</button>
          </div>
        </div>`;
      };

      // ── Neural brain hero ───────────────────────────────────────────────
      // The brain's "activity level" scales with how much it has learned.
      // More entries = more synapses firing. Empty = dormant (just the outline).
      const activity = total === 0 ? 0 : Math.min(1, total / 25);
      const brainState = total === 0 ? 'dormant' : activity < 0.4 ? 'learning' : activity < 0.8 ? 'active' : 'mastered';
      const brainColor = brainState === 'dormant' ? '#475569' : brainState === 'learning' ? '#d4d4d4' : brainState === 'active' ? '#3b82f6' : '#818cf8';
      const brainGlow = brainState === 'dormant' ? 'rgba(71,85,105,.15)' : brainState === 'mastered' ? 'rgba(129,140,248,.35)' : 'rgba(255, 255, 255,.25)';

      // Generate synapse nodes (neural network connections). Count scales with entries.
      const synapseCount = Math.min(12, Math.max(0, total));
      let synapses = '';
      for (let i = 0; i < synapseCount; i++) {
        const angle = (i / synapseCount) * Math.PI * 2;
        const r = 38 + Math.random() * 8;
        const cx = 60 + Math.cos(angle) * r;
        const cy = 55 + Math.sin(angle) * r * 0.85;
        const delay = (i * 0.3).toFixed(1);
        const nodeColor = i % 3 === 0 ? '#d4d4d4' : i % 3 === 1 ? '#3b82f6' : '#818cf8';
        synapses += `
          <line x1="60" y1="55" x2="${cx.toFixed(1)}" y2="${cy.toFixed(1)}" stroke="${brainColor}" stroke-width="0.5" opacity="0.15" />
          <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="2" fill="${nodeColor}" opacity="0.8">
            <animate attributeName="opacity" values="0.2;1;0.2" dur="2.5s" begin="${delay}s" repeatCount="indefinite"/>
            <animate attributeName="r" values="1.5;3;1.5" dur="2.5s" begin="${delay}s" repeatCount="indefinite"/>
          </circle>
          <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" fill="${nodeColor}" opacity="0.1">
            <animate attributeName="r" values="3;8;3" dur="2.5s" begin="${delay}s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.15;0;0.15" dur="2.5s" begin="${delay}s" repeatCount="indefinite"/>
          </circle>`;
      }

      main.innerHTML = `
        <div class="mem-hero" style="--brain-color:${brainColor};--brain-glow:${brainGlow}">
          <div class="mem-brain-wrap">
            <svg viewBox="0 0 120 110" class="mem-brain-svg" aria-hidden="true">
              <defs>
                <radialGradient id="brainCore" cx="50%" cy="45%">
                  <stop offset="0%" stop-color="${brainColor}" stop-opacity="0.15"/>
                  <stop offset="60%" stop-color="${brainColor}" stop-opacity="0.05"/>
                  <stop offset="100%" stop-color="${brainColor}" stop-opacity="0"/>
                </radialGradient>
                <filter id="brainBlur"><feGaussianBlur stdDeviation="2"/></filter>
              </defs>
              <!-- Core glow -->
              <ellipse cx="60" cy="55" rx="48" ry="42" fill="url(#brainCore)"/>
              <!-- Brain hemispheres (stylized) -->
              <g stroke="${brainColor}" stroke-width="1.2" fill="none" opacity="${brainState === 'dormant' ? '0.3' : '0.5'}" stroke-linecap="round">
                <!-- Left hemisphere folds -->
                <path d="M 42 30 Q 30 35 28 50 Q 26 62 34 72 Q 40 78 48 76"/>
                <path d="M 38 42 Q 32 48 33 58 Q 34 66 40 70"/>
                <path d="M 44 32 Q 38 38 37 48"/>
                <!-- Right hemisphere folds -->
                <path d="M 78 30 Q 90 35 92 50 Q 94 62 86 72 Q 80 78 72 76"/>
                <path d="M 82 42 Q 88 48 87 58 Q 86 66 80 70"/>
                <path d="M 76 32 Q 82 38 83 48"/>
                <!-- Center division -->
                <path d="M 60 28 Q 58 40 60 52 Q 62 64 60 75" opacity="0.3"/>
              </g>
              <!-- Synapse firing (only if learning) -->
              ${brainState !== 'dormant' ? `
                <!-- Pulse traveling along center -->
                <circle r="2.5" fill="#d4d4d4" opacity="0.9">
                  <animateMotion dur="3s" repeatCount="indefinite" path="M 60 28 Q 58 40 60 52 Q 62 64 60 75"/>
                  <animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite"/>
                </circle>
                ${synapses}
                <!-- Cross-hemisphere signal -->
                <circle r="1.5" fill="${brainColor}" opacity="0.7">
                  <animateMotion dur="2s" begin="0.5s" repeatCount="indefinite" path="M 34 55 Q 60 48 86 55"/>
                  <animate attributeName="opacity" values="0;1;0" dur="2s" begin="0.5s" repeatCount="indefinite"/>
                </circle>
              ` : ''}
              <!-- Scan line (always present — the brain is "listening") -->
              <line x1="20" y1="55" x2="100" y2="55" stroke="${brainColor}" stroke-width="0.3" opacity="0.2">
                <animate attributeName="y1" values="30;80;30" dur="4s" repeatCount="indefinite"/>
                <animate attributeName="y2" values="30;80;30" dur="4s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.05;0.25;0.05" dur="4s" repeatCount="indefinite"/>
              </line>
            </svg>
            <!-- Floating memory particles -->
            ${brainState !== 'dormant' ? Array.from({length: 6}, (_, i) =>
              `<span class="mem-particle" style="--pd:${(i * 0.8).toFixed(1)}s;--px:${20 + Math.random() * 60}%;--py:${15 + Math.random() * 60}%"></span>`
            ).join('') : ''}
          </div>
          <div class="mem-hero-body">
            <div class="mem-hero-title">Memory <span class="mem-brain-state mem-brain-state-${brainState}">${brainState}</span></div>
            <div class="mem-hero-sub">${total === 0
              ? 'No learned fixes yet — the brain is dormant. Click <strong>⚡ AI Fix</strong> on a broken workflow and the system learns permanently.'
              : `<strong>${total}</strong> error patterns learned · <strong>${totalFixed}</strong> fixes applied · <strong>${overallRate}%</strong> success rate`}</div>
            <div class="mem-hero-stats">
              <div class="mem-stat"><span class="mem-stat-val" style="color:${total > 0 ? '#d4d4d4' : '#475569'}">${total}</span><span class="mem-stat-lbl">Learned</span></div>
              <div class="mem-stat"><span class="mem-stat-val" style="color:${overallRate >= 70 ? '#4ade80' : overallRate >= 40 ? '#fbbf24' : '#f87171'}">${overallRate}%</span><span class="mem-stat-lbl">Success</span></div>
              <div class="mem-stat"><span class="mem-stat-val" style="color:${highConf > 0 ? '#4ade80' : '#475569'}">${highConf}</span><span class="mem-stat-lbl">High Conf</span></div>
              <div class="mem-stat"><span class="mem-stat-val" style="color:#3b82f6">${uniqueErrors}</span><span class="mem-stat-lbl">Error Types</span></div>
            </div>
          </div>
        </div>

        ${total === 0 ? `
          <div class="ds-empty" style="padding:32px;text-align:center;border:1px dashed rgba(255,255,255,.08);border-radius:14px;margin-top:8px">
            <p style="font-size:13px;color:var(--ds-t2)">The brain is empty.</p>
            <p style="font-size:12px;color:var(--ds-t3);margin-top:6px;line-height:1.6">Generate a workflow → <strong>🔬 Lint & Test</strong> → if errors found → <strong>⚡ AI Fix</strong>.<br>Every successful fix teaches the brain permanently. Next time the same error appears, it applies the known fix instantly — fewer tokens, no dev needed.</p>
          </div>
        ` : `
          <div style="display:flex;gap:8px;margin:16px 0 12px;align-items:center">
            <input type="text" id="mem-search" placeholder="Search errors or fixes…" value="${esc(searchQ)}" style="flex:1;max-width:300px;padding:8px 14px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:var(--ds-t1);font-size:12px;transition:border-color .2s">
            <select id="mem-strategy" style="padding:8px 12px;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:var(--ds-t2);font-size:12px">
              <option value="">All strategies</option>
              ${STRATEGIES.map(s => `<option value="${s}" ${strategyFilter === s ? 'selected' : ''}>${STRATEGY_LABELS[s]}</option>`).join('')}
            </select>
            <div style="display:flex;background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.08);border-radius:10px;overflow:hidden">
              <button id="mem-view-grid" class="ds-btn ds-btn-sm" style="border:none;border-radius:0;padding:7px 12px;font-size:11px;font-weight:${viewMode==='grid'?'700':'400'};background:${viewMode==='grid'?'rgba(255, 255, 255,.12)':'transparent'};color:${viewMode==='grid'?'#d4d4d4':'var(--ds-t3)'}">▦ Grid</button>
              <button id="mem-view-graph" class="ds-btn ds-btn-sm" style="border:none;border-radius:0;padding:7px 12px;font-size:11px;font-weight:${viewMode==='graph'?'700':'400'};background:${viewMode==='graph'?'rgba(255, 255, 255,.12)':'transparent'};color:${viewMode==='graph'?'#d4d4d4':'var(--ds-t3)'}">🕸 Graph</button>
            </div>
          </div>
          ${viewMode === 'graph' ? renderMemGraph(entries, stats) : `
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px">
            ${entries.map(cardEl).join('')}
          </div>
          `}
        `} `;

      // Wire search
      const search = document.getElementById('mem-search');
      if (search) {
        let debounce;
        search.oninput = (e) => { clearTimeout(debounce); debounce = setTimeout(() => { searchQ = e.target.value; load(); }, 300); };
      }
      const strat = document.getElementById('mem-strategy');
      if (strat) strat.onchange = (e) => { strategyFilter = e.target.value; load(); };

      // Wire view toggle
      const gridBtn = document.getElementById('mem-view-grid');
      const graphBtn = document.getElementById('mem-view-graph');
      if (gridBtn) gridBtn.onclick = () => { viewMode = 'grid'; paint(); };
      if (graphBtn) graphBtn.onclick = () => { viewMode = 'graph'; paint(); };

      // Wire graph node hover/click
      if (viewMode === 'graph') {
        const detail = document.getElementById('mem-graph-detail');
        main.querySelectorAll('.mem-graph-node').forEach(node => {
          const id = node.dataset.id;
          const entry = entries.find(e => e.id === id);
          if (!entry) return;
          const rate = Math.round((entry.success_rate || 0) * 100);
          const html = `<div style="display:flex;align-items:start;gap:8px">
            <span class="ds-badge" style="--badge-c:#3b82f6;font-size:9px;flex:none">TS${esc(entry.error_code)}</span>
            <div style="flex:1">
              <div style="color:var(--ds-t1);font-size:11px;font-weight:600">${esc(entry.error_message.slice(0, 80))}</div>
              <div style="color:var(--ds-t3);font-size:10px;margin-top:2px">→ ${esc(entry.fix_summary)}</div>
            </div>
            <span style="font-size:10px;font-weight:700;color:${rate >= 80 ? '#4ade80' : rate >= 50 ? '#fbbf24' : '#f87171'};flex:none">${rate}%</span>
            <span style="font-size:9px;color:var(--ds-t3);flex:none">${entry.times_fixed}/${entry.times_seen}</span>
          </div>`;
          node.onmouseenter = () => { if (detail) detail.innerHTML = html; };
          node.onclick = () => { if (detail) detail.innerHTML = html; };
        });
      }

      // Wire delete
      main.querySelectorAll('.mem-del').forEach(btn => {
        btn.onclick = async () => {
          try { await api.deleteMemory(btn.dataset.delId); load(); } catch {}
        };
      });
    }

    await load();
}

// ── Memory knowledge graph (interactive SVG, Memgraph-style) ──────────────────
// Clusters error→fix entries by fix_strategy. Each node is an error pattern,
// sized by times_fixed, colored by success rate. Edges connect nodes sharing
// the same strategy. Hovering shows the error message + fix summary.
function renderMemGraph(entries, stats) {
  if (!entries.length) return '<div class="ds-empty"><p>No data to graph.</p></div>';

  // Group by strategy for clustering
  const clusters = {};
  entries.forEach(e => {
    const s = e.fix_strategy || 'general';
    if (!clusters[s]) clusters[s] = [];
    clusters[s].push(e);
  });

  const W = 800, H = 520, CX = W / 2, CY = H / 2;
  const clusterKeys = Object.keys(clusters);
  const clusterCount = clusterKeys.length;

  // Position each cluster as a "galaxy" orbiting center
  const clusterCenters = {};
  clusterKeys.forEach((key, i) => {
    const angle = (i / clusterCount) * Math.PI * 2 - Math.PI / 2;
    const r = Math.min(W, H) * 0.32;
    clusterCenters[key] = { x: CX + Math.cos(angle) * r, y: CY + Math.sin(angle) * r };
  });

  // Layout nodes within each cluster (spiral around cluster center)
  const nodes = [];
  clusterKeys.forEach(key => {
    const center = clusterCenters[key];
    const clusterEntries = clusters[key];
    clusterEntries.forEach((e, i) => {
      const a = (i / Math.max(1, clusterEntries.length)) * Math.PI * 2;
      const r = 25 + (i % 3) * 18;
      const rate = Math.round((e.success_rate || 0) * 100);
      const size = Math.max(4, Math.min(16, (e.times_fixed || 1) * 2));
      const color = rate >= 80 ? '#4ade80' : rate >= 50 ? '#fbbf24' : rate >= 30 ? '#f87171' : '#475569';
      nodes.push({
        id: e.id,
        x: center.x + Math.cos(a) * r,
        y: center.y + Math.sin(a) * r,
        size,
        color,
        label: `TS${e.error_code}`,
        tooltip: `${e.error_message.slice(0, 60)}\n→ ${e.fix_summary.slice(0, 60)}\n[${e.times_fixed}/${e.times_seen} ${rate}%]`,
        strategy: key,
      });
    });
  });

  // Edges: connect nodes in the same cluster to their cluster center (radial)
  let edges = '';
  clusterKeys.forEach(key => {
    const center = clusterCenters[key];
    clusters[key].forEach(e => {
      const node = nodes.find(n => n.id === e.id);
      if (!node) return;
      edges += `<line x1="${center.x.toFixed(1)}" y1="${center.y.toFixed(1)}" x2="${node.x.toFixed(1)}" y2="${node.y.toFixed(1)}" stroke="rgba(255,255,255,0.04)" stroke-width="0.5"/>`;
    });
  });

  // Inter-cluster edges (center-to-center, dashed)
  clusterKeys.forEach((key, i) => {
    if (i === 0) return;
    const prev = clusterCenters[clusterKeys[i - 1]];
    const curr = clusterCenters[key];
    edges += `<line x1="${prev.x.toFixed(1)}" y1="${prev.y.toFixed(1)}" x2="${curr.x.toFixed(1)}" y2="${curr.y.toFixed(1)}" stroke="rgba(255, 255, 255,0.06)" stroke-width="0.5" stroke-dasharray="3,3"/>`;
  });

  // Cluster center nodes (strategy hubs)
  const strategyColors = { declare_or_import:'#3b82f6', add_import:'#818cf8', type_cast:'#d4d4d4', syntax_fix:'#fbbf24', fix_selector:'#f59e0b', fix_wait:'#a78bfa', general:'#64748b' };
  const strategyLabels = { declare_or_import:'Declare', add_import:'Import', type_cast:'Type Cast', syntax_fix:'Syntax', fix_selector:'Selector', fix_wait:'Wait', general:'General' };

  const clusterHubs = clusterKeys.map(key => {
    const center = clusterCenters[key];
    const count = clusters[key].length;
    const color = strategyColors[key] || '#64748b';
    return `
      <circle cx="${center.x.toFixed(1)}" cy="${center.y.toFixed(1)}" r="20" fill="${color}15" stroke="${color}" stroke-width="1.5" opacity="0.8"/>
      <circle cx="${center.x.toFixed(1)}" cy="${center.y.toFixed(1)}" r="12" fill="${color}25" stroke="${color}" stroke-width="0.5"/>
      <text x="${center.x.toFixed(1)}" y="${(center.y + 1).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="${color}">${esc(strategyLabels[key] || key)}</text>
      <text x="${center.x.toFixed(1)}" y="${(center.y + 35).toFixed(1)}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.3)">${count} pattern${count !== 1 ? 's' : ''}</text>`;
  }).join('');

  // Error pattern nodes
  const nodeElements = nodes.map(n => `
    <g class="mem-graph-node" data-id="${esc(n.id)}" style="cursor:pointer">
      <circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.size + 3}" fill="${n.color}10"/>
      <circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${n.size}" fill="${n.color}40" stroke="${n.color}" stroke-width="1">
        <animate attributeName="r" values="${n.size};${n.size + 1.5};${n.size}" dur="${2 + (n.size % 3)}s" repeatCount="indefinite"/>
      </circle>
      <text x="${n.x.toFixed(1)}" y="${(n.y + 2.5).toFixed(1)}" text-anchor="middle" font-size="6" fill="rgba(255,255,255,0.5)">${esc(n.label)}</text>
    </g>`).join('');

  // Legend
  const legend = `
    <div style="position:absolute;top:12px;right:12px;background:rgba(11,14,23,.85);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:10px 14px;font-size:10px;color:var(--ds-t3);backdrop-filter:blur(8px)">
      <div style="font-weight:700;color:var(--ds-t2);margin-bottom:6px;font-size:9px;text-transform:uppercase;letter-spacing:.06em">Success Rate</div>
      <div style="display:flex;align-items:center;gap:5px;margin:3px 0"><span style="width:8px;height:8px;border-radius:50%;background:#4ade80"></span> ≥80% (mastered)</div>
      <div style="display:flex;align-items:center;gap:5px;margin:3px 0"><span style="width:8px;height:8px;border-radius:50%;background:#fbbf24"></span> 50-79% (learning)</div>
      <div style="display:flex;align-items:center;gap:5px;margin:3px 0"><span style="width:8px;height:8px;border-radius:50%;background:#f87171"></span> <50% (weak)</div>
      <div style="border-top:1px solid rgba(255,255,255,.06);margin-top:6px;padding-top:6px">Node size = times fixed</div>
    </div>`;

  return `
    <div style="position:relative;background:radial-gradient(ellipse at center, rgba(15,23,42,.4), rgba(11,14,23,.8));border:1px solid rgba(255,255,255,.06);border-radius:14px;overflow:hidden;padding:0">
      ${legend}
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;min-height:400px">
        <defs>
          <radialGradient id="graphBg" cx="50%" cy="50%">
            <stop offset="0%" stop-color="rgba(255, 255, 255,0.03)"/>
            <stop offset="100%" stop-color="transparent"/>
          </radialGradient>
        </defs>
        <rect width="${W}" height="${H}" fill="url(#graphBg)"/>
        <!-- Central brain core -->
        <circle cx="${CX}" cy="${CY}" r="3" fill="#d4d4d4" opacity="0.6">
          <animate attributeName="r" values="2;4;2" dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="${CX}" cy="${CY}" r="8" fill="none" stroke="#d4d4d4" stroke-width="0.3" opacity="0.2">
          <animate attributeName="r" values="8;20;8" dur="3s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.2;0;0.2" dur="3s" repeatCount="indefinite"/>
        </circle>
        <!-- Edges -->
        ${edges}
        <!-- Cluster hubs -->
        ${clusterHubs}
        <!-- Error nodes -->
        ${nodeElements}
      </svg>
    </div>
    <div id="mem-graph-detail" style="margin-top:8px;padding:10px 14px;background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.06);border-radius:10px;font-size:11px;color:var(--ds-t3);min-height:40px">
      Hover a node to see its error pattern + fix. Click to pin.
    </div>`;
}

// ── Evaluations ───────────────────────────────────────────────────────────────

export async function renderDevEvaluations({ api, render }) {
  render(devNavHtml('evaluations') +
    `<div class="ds-main" id="ds-main">${spinner()}</div>`);

  let jobs = [];
  try { jobs = await api.listJobs(); } catch {}

  const done     = jobs.filter(j => ['succeeded','failed'].includes(j.status));
  const passRate = done.length ? Math.round(done.filter(j => j.status === 'succeeded').length / done.length * 100) : null;
  const avgRepairs = done.length
    ? (done.reduce((a, j) => a + (j.repair_attempts || 0), 0) / done.length).toFixed(1)
    : null;
  const zeroRepair = done.filter(j => j.status === 'succeeded' && !(j.repair_attempts || 0)).length;

  const main = document.getElementById('ds-main');
  if (!main) return;

  main.innerHTML = `
    <h2>Evaluations</h2>
    <p class="ds-page-desc">Build quality metrics across all completed jobs.</p>
    <div class="ds-grid">
      ${statCard('Pass Rate',         passRate    !== null ? `${passRate}%`   : '—', `${done.length} evaluated`,    passRate !== null && passRate < 50 ? 'var(--ds-red)' : '')}
      ${statCard('Avg Repairs',       avgRepairs  !== null ? avgRepairs       : '—', 'per completed job',            '')}
      ${statCard('First-try Passes',  zeroRepair,                                    'passed without repair',         '')}
    </div>
    ${done.length ? card('Job Outcomes',
      `<div class="ds-card-bd-flush"><table class="ds-table">
        <thead><tr><th>ID</th><th>Outcome</th><th>Repairs</th><th>Model</th><th>Task</th></tr></thead>
        <tbody>
          ${done.slice(0, 25).map(j => `<tr class="row-click" data-devjob="${esc(j.id)}">
            <td><code style="color:var(--ds-t2)">${j.id.slice(0, 8)}</code></td>
            <td>${statusBadge(j.status)}</td>
            <td class="${(j.repair_attempts || 0) > 0 ? 'c-amber' : 'c-t3'}">${j.repair_attempts || 0}</td>
            <td style="font-size:11px;color:var(--ds-t3)">${esc((j.model_used || '—').split(':').pop())}</td>
            <td class="ds-tcell-prompt">${esc(j.prompt)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`)
    : `<div class="ds-empty"><p>No completed jobs yet.</p></div>`}`;
}

// ── Repair Cases ──────────────────────────────────────────────────────────────

export async function renderDevRepairCases({ api, render }) {
  render(devNavHtml('repair-cases') +
    `<div class="ds-main" id="ds-main">${spinner()}</div>`);

  let jobs = [];
  try { jobs = await api.listJobs(); } catch {}

  const cases = jobs.flatMap(j =>
    (j.repair_attempts || []).map(r => ({
      jobId:      j.id,
      prompt:     j.prompt,
      attempt:    r.attempt,
      patchApplied: r.patch_applied,
      passed:     r.validation_after?.passed,
      errors:     r.errors || [],
    }))
  );

  const main = document.getElementById('ds-main');
  if (!main) return;

  main.innerHTML = `
    <h2>Repair Cases <span class="c-t3" style="font-size:14px;font-weight:400">(${cases.length})</span></h2>
    <p class="ds-page-desc">Every validation failure and subsequent repair attempt, for diagnosis and model improvement.</p>
    ${cases.length ? card('All Repair Attempts',
      `<div class="ds-card-bd-flush"><table class="ds-table">
        <thead><tr><th>Job</th><th>#</th><th>Patch</th><th>After</th><th>Top Error</th></tr></thead>
        <tbody>
          ${cases.map(c => `<tr class="row-click" data-devjob="${esc(c.jobId)}">
            <td><code style="color:var(--ds-t2)">${c.jobId.slice(0, 8)}</code></td>
            <td class="c-t3">${c.attempt}</td>
            <td>${c.patchApplied ? '<span class="c-green">&#10003;</span>' : '<span class="c-red">&#10005;</span>'}</td>
            <td>${c.passed === true ? '<span class="c-green">&#10003;</span>' : c.passed === false ? '<span class="c-red">&#10005;</span>' : '<span class="c-t3">—</span>'}</td>
            <td class="ds-tcell-prompt c-red">${esc((c.errors[0] || '').slice(0, 120))}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`)
    : `<div class="ds-empty"><p>No repair cases yet — jobs have been passing on first attempt.</p></div>`}`;
}

// ── Workflows — Visual Canvas ─────────────────────────────────────────────────

const WF_NODE_TYPES = [
  { type: 'start',      label: 'Start',          color: '#22c55e', icon: '▶' },
  { type: 'page',       label: 'Navigate',        color: '#3b82f6', icon: '🔗' },
  { type: 'click',      label: 'Click',           color: '#6366f1', icon: '👆' },
  { type: 'type',       label: 'Type',            color: '#8b5cf6', icon: '⌨' },
  { type: 'select',     label: 'Select',          color: '#a78bfa', icon: '▾' },
  { type: 'read',       label: 'Read',            color: '#06b6d4', icon: '👁' },
  { type: 'extract',    label: 'Extract',         color: '#0ea5e9', icon: '⛏' },
  { type: 'wait',       label: 'Wait',            color: '#f59e0b', icon: '⏳' },
  { type: 'verify',     label: 'Verify',          color: '#10b981', icon: '✓' },
  { type: 'condition',  label: 'Condition',       color: '#f97316', icon: '?' },
  { type: 'branch',     label: 'Branch',          color: '#fb923c', icon: '⑂' },
  { type: 'loop',       label: 'Loop',            color: '#fbbf24', icon: '↺' },
  { type: 'transform',  label: 'Transform',       color: '#a3e635', icon: '⟳' },
  { type: 'api',        label: 'API Call',        color: '#34d399', icon: '⚡' },
  { type: 'pause',      label: 'Pause for Owner', color: '#f43f5e', icon: '⏸' },
  { type: 'subflow',    label: 'Subflow',         color: '#818cf8', icon: '⊕' },
  { type: 'success',    label: 'Success',         color: '#22c55e', icon: '✔' },
  { type: 'failure',    label: 'Failure',         color: '#ef4444', icon: '✖' },
];

function wfNodeHtml(node, selected) {
  const def = WF_NODE_TYPES.find(t => t.type === node.type) || WF_NODE_TYPES[0];
  const sel = selected ? 'box-shadow:0 0 0 2px #a5b4fc;' : '';
  return `<div class="wf-node ${selected ? 'selected' : ''}"
    data-wf-node="${esc(node.id)}"
    style="left:${node.x || 80}px;top:${node.y || 80}px;border-color:${def.color};${sel}">
    <div class="wf-node-hd" style="background:${def.color}22">
      <span style="color:${def.color}">${def.icon}</span>
      <span class="wf-node-type">${esc(def.label)}</span>
    </div>
    <div class="wf-node-label">${esc(node.label || def.label)}</div>
    <div class="wf-node-ports">
      <div class="wf-port wf-port-in"  data-port="in"  data-node="${esc(node.id)}"></div>
      <div class="wf-port wf-port-out" data-port="out" data-node="${esc(node.id)}"></div>
    </div>
  </div>`;
}

export async function renderDevWorkflows({ api, render }) {
  render(devNavHtml('workflows') + `
    <div class="ds-main ds-main-full" id="wf-shell">
      <div class="wf-topbar">
        <h2 style="margin:0;font-size:16px">Visual Workflows</h2>
        <button class="ds-btn ds-btn-primary" id="wf-new-btn">+ New Workflow</button>
      </div>
      <div class="wf-layout" id="wf-layout">
        <div class="wf-sidebar" id="wf-sidebar">${spinner()}</div>
        <div class="wf-canvas-wrap" id="wf-canvas-wrap">
          <div class="wf-canvas-hint">Select a workflow from the list, or create a new one.</div>
        </div>
        <div class="wf-inspector" id="wf-inspector" style="display:none"></div>
      </div>
    </div>`);

  let workflows = [];
  try { workflows = await api.listWorkflows(); } catch {}

  const sidebar = document.getElementById('wf-sidebar');
  const canvasWrap = document.getElementById('wf-canvas-wrap');
  if (!sidebar || !canvasWrap) return;

  let activeWfId = null;
  let activeWf = null;
  let selectedNodeId = null;
  let selectedIds = new Set();
  let wfClipboard = null;

  function renderSidebar() {
    sidebar.innerHTML = `
      <div class="wf-sidebar-hd">Workflows <span class="ds-card-count">${workflows.length}</span></div>
      <div class="wf-sidebar-list">
        ${workflows.length === 0 ? `<div class="ds-empty" style="padding:16px;font-size:12px">No workflows yet.<br>Click + New to start.</div>` : ''}
        ${workflows.map(w => `
          <div class="wf-sidebar-item ${activeWfId === w.id ? 'active' : ''}" data-wf-id="${esc(w.id)}">
            <div class="wf-sidebar-name">${esc(w.name)}</div>
            <div class="wf-sidebar-meta">${esc(w.status)} · ${relTime(w.updated_at)}</div>
          </div>`).join('')}
      </div>`;
    sidebar.querySelectorAll('[data-wf-id]').forEach(el => {
      el.onclick = () => openWorkflow(el.dataset.wfId);
    });
  }

  function renderCanvas(wf) {
    const nodes = Array.isArray(wf.nodes) ? wf.nodes : [];
    const edges = Array.isArray(wf.edges) ? wf.edges : [];

    // Build SVG edges
    const svgLines = edges.map(e => {
      const from = nodes.find(n => n.id === e.from);
      const to   = nodes.find(n => n.id === e.to);
      if (!from || !to) return '';
      const x1 = (from.x || 80) + 110;
      const y1 = (from.y || 80) + 36;
      const x2 = to.x || 80;
      const y2 = (to.y || 80) + 36;
      const cx = (x1 + x2) / 2;
      return `<path d="M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}"
        stroke="#6366f1" stroke-width="2" fill="none" opacity="0.7" marker-end="url(#arrowhead)"/>`;
    }).join('');

    canvasWrap.innerHTML = `
      <div class="wf-canvas-toolbar">
        <span class="wf-canvas-title">${esc(wf.name)}</span>
        <span class="wf-status-badge" style="background:${wf.status === 'active' ? '#22c55e22' : '#33333388'};color:${wf.status === 'active' ? '#22c55e' : '#94a3b8'}">${esc(wf.status)}</span>
        <div style="flex:1"></div>
        <button class="ds-btn ds-btn-sm" id="wf-save-btn">Save</button>
        <button class="ds-btn ds-btn-sm" style="background:linear-gradient(95deg,#22c55e,#10b981);color:#0b0e17;font-weight:800;border:none" id="wf-testrun-btn" title="Run this workflow through the test executor (safe_test mode)">▶ Test Run</button>
        <button class="ds-btn ds-btn-sm" style="background:linear-gradient(95deg,#d4d4d4,#3b82f6);color:#0b0e17;font-weight:800;border:none" id="wf-codegen-btn">⚡ Generate TypeScript</button>
        <button class="ds-btn ds-btn-sm ds-btn-danger" id="wf-delete-btn">Delete</button>
      </div>
      <div class="wf-palette">
        ${WF_NODE_TYPES.map(t => `
          <div class="wf-palette-item" draggable="true" data-node-type="${t.type}"
            style="border-color:${t.color}22;color:${t.color}" title="${t.label}">
            <span>${t.icon}</span>
            <span style="font-size:10px;color:#94a3b8">${t.label}</span>
          </div>`).join('')}
      </div>
      <div class="wf-canvas" id="wf-canvas">
        <svg class="wf-edge-svg" id="wf-edge-svg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none">
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#6366f1" opacity="0.8"/>
            </marker>
          </defs>
          ${svgLines}
        </svg>
        ${nodes.map(n => wfNodeHtml(n, selectedIds.has(n.id))).join('')}
        ${nodes.length === 0 ? `<div class="wf-canvas-hint">Drag a node from the palette above to start building.</div>` : ''}
      </div>`;

    wireCanvas(wf);
  }

  function wireCanvas(wf) {
    const canvas = document.getElementById('wf-canvas');
    if (!canvas) return;

    // Drag node from palette onto canvas
    document.querySelectorAll('.wf-palette-item').forEach(item => {
      item.ondragstart = (e) => {
        e.dataTransfer.setData('nodeType', item.dataset.nodeType);
      };
    });

    canvas.ondragover = (e) => e.preventDefault();
    canvas.ondrop = (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('nodeType');
      if (!type) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.round(e.clientX - rect.left - 60);
      const y = Math.round(e.clientY - rect.top - 20);
      const def = WF_NODE_TYPES.find(t => t.type === type);
      const newNode = {
        id: 'n' + Math.random().toString(36).slice(2, 8),
        type,
        label: def?.label || type,
        x: Math.max(0, x),
        y: Math.max(0, y),
        config: { humanFeel: true },
      };
      if (!Array.isArray(wf.nodes)) wf.nodes = [];
      wf.nodes.push(newNode);
      renderCanvas(wf);
    };

    // Selection (Ctrl+click multi) + free-drag move of the whole group.
    canvas.querySelectorAll('.wf-node').forEach(nodeEl => {
      nodeEl.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        canvas.focus();
        const nodeId = nodeEl.dataset.wfNode;
        if (e.ctrlKey || e.metaKey) {
          selectedIds.has(nodeId) ? selectedIds.delete(nodeId) : selectedIds.add(nodeId);
        } else if (!selectedIds.has(nodeId)) {
          selectedIds = new Set([nodeId]);
        }
        selectedNodeId = selectedIds.size === 1 ? [...selectedIds][0] : null;
        canvas.querySelectorAll('.wf-node').forEach(el =>
          el.classList.toggle('selected', selectedIds.has(el.dataset.wfNode)));
        if (selectedIds.size === 1) {
          const n = wf.nodes?.find(x => x.id === nodeId);
          if (n) showInspector(n, wf);
        } else { hideInspector(); }
        // Drag the whole selection together
        const group = [...selectedIds].map(id => {
          const n = wf.nodes?.find(x => x.id === id);
          const el = canvas.querySelector('[data-wf-node="' + CSS.escape(id) + '"]');
          return (n && el) ? { id, ox: n.x || 0, oy: n.y || 0, el } : null;
        }).filter(Boolean);
        const sx = e.clientX, sy = e.clientY;
        let moved = false;
        const onMove = (ev) => {
          const dx = ev.clientX - sx, dy = ev.clientY - sy;
          if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
          moved = true;
          group.forEach(s => {
            s.el.style.left = Math.max(0, Math.round(s.ox + dx)) + 'px';
            s.el.style.top  = Math.max(0, Math.round(s.oy + dy)) + 'px';
          });
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          if (moved) {
            group.forEach(s => {
              const n = wf.nodes?.find(x => x.id === s.id);
              if (n) { n.x = parseInt(s.el.style.left) || 0; n.y = parseInt(s.el.style.top) || 0; }
            });
            renderCanvas(wf);
          }
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });

    // Click empty canvas → clear selection
    canvas.addEventListener('mousedown', () => {
      selectedIds = new Set();
      selectedNodeId = null;
      canvas.querySelectorAll('.wf-node').forEach(el => el.classList.remove('selected'));
      hideInspector();
    });

    // Keyboard: Del/Ctrl+C/Ctrl+V/Ctrl+A. Canvas is focusable; inputs excluded.
    canvas.setAttribute('tabindex', '0');
    canvas.addEventListener('keydown', (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
      const k = e.key.toLowerCase();
      if ((k === 'delete' || k === 'backspace') && selectedIds.size) {
        e.preventDefault();
        wf.nodes = (wf.nodes || []).filter(n => !selectedIds.has(n.id));
        wf.edges = (wf.edges || []).filter(ed => !selectedIds.has(ed.from) && !selectedIds.has(ed.to));
        selectedIds = new Set(); selectedNodeId = null;
        renderCanvas(wf); hideInspector();
      } else if ((e.ctrlKey || e.metaKey) && k === 'c' && selectedIds.size) {
        e.preventDefault();
        wfClipboard = (wf.nodes || []).filter(n => selectedIds.has(n.id)).map(n => JSON.parse(JSON.stringify(n)));
      } else if ((e.ctrlKey || e.metaKey) && k === 'v' && wfClipboard) {
        e.preventDefault();
        wfClipboard.forEach(n => {
          const copy = JSON.parse(JSON.stringify(n));
          copy.id = 'n' + Math.random().toString(36).slice(2, 8);
          copy.x = (n.x || 0) + 24; copy.y = (n.y || 0) + 24;
          wf.nodes.push(copy);
        });
        renderCanvas(wf);
      } else if ((e.ctrlKey || e.metaKey) && k === 'a') {
        e.preventDefault();
        selectedIds = new Set((wf.nodes || []).map(n => n.id));
        renderCanvas(wf);
      }
    });

    const saveBtn = document.getElementById('wf-save-btn');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        try {
          await api.updateWorkflow(wf.id, { nodes: wf.nodes, edges: wf.edges, name: wf.name });
          saveBtn.textContent = 'Saved ✓';
          setTimeout(() => { saveBtn.textContent = 'Save'; }, 2000);
        } catch (e) {
          saveBtn.textContent = 'Error';
        }
      };
    }

    const delBtn = document.getElementById('wf-delete-btn');
    if (delBtn) {
      delBtn.onclick = async () => {
        if (!confirm(`Delete workflow "${wf.name}"?`)) return;
        try {
          await api.deleteWorkflow(wf.id);
          workflows = workflows.filter(w => w.id !== wf.id);
          activeWfId = null; activeWf = null;
          renderSidebar();
          canvasWrap.innerHTML = `<div class="wf-canvas-hint">Select a workflow or create a new one.</div>`;
          hideInspector();
        } catch {}
      };
    }

    const codegenBtn = document.getElementById('wf-codegen-btn');
    if (codegenBtn) {
      codegenBtn.onclick = () => showCodegenModal(wf, api);
    }

    const testBtn = document.getElementById('wf-testrun-btn');
    if (testBtn) {
      testBtn.onclick = async () => {
        testBtn.disabled = true; testBtn.textContent = '⏳ Running…';
        try {
          // Structural validation per node: locator present + connected + valid.
          // Catches broken workflows before any live execution. Saved as a safe_test run.
          const reachable = new Set((wf.edges || []).map(e => e.to));
          const stepLog = [];
          (wf.nodes || []).forEach(n => {
            if (n.type === 'start' || n.type === 'success' || n.type === 'failure') return;
            const issues = [];
            if (['click','type','read','extract','verify','select'].includes(n.type)) {
              const cands = n.config?.element?.locatorCandidates || n.config?.locatorCandidates;
              if ((!cands || !cands.length) && !n.config?.locator) issues.push('no locator');
            }
            if (n.type !== 'start' && n.id !== 'n_start' && !reachable.has(n.id)) issues.push('not connected from start');
            stepLog.push({ step: stepLog.length + 1, node_id: n.id, label: n.label || n.type, status: issues.length ? 'failed' : 'passed', error: issues.join('; ') || undefined });
          });
          const failed = stepLog.filter(s => s.status === 'failed');
          const status = failed.length ? 'failed' : 'succeeded';
          let runId = null;
          try {
            const run = await api.startRun(wf.id, { run_mode: 'safe_test' });
            runId = run.id;
            await api.patchRun(run.id, { status, steps_completed: stepLog.length - failed.length, step_log: stepLog, error: failed.length ? `${failed.length} step(s) failed structural check` : null });
          } catch {}
          showTestRunPanel(wf, { status, step_log: stepLog, run_id: runId, error: failed.length ? `${failed.length} step(s) failed structural check` : null });
        } catch (err) {
          showTestRunPanel(wf, { status: 'failed', step_log: [], error: err.message || 'run failed' });
        } finally {
          testBtn.disabled = false; testBtn.textContent = '▶ Test Run';
        }
      };
    }
  }

  function showInspector(node, wf) {
    const inspector = document.getElementById('wf-inspector');
    if (!inspector) return;
    inspector.style.display = 'flex';
    const def = WF_NODE_TYPES.find(t => t.type === node.type);

    inspector.innerHTML = `
      <div class="wf-insp-hd">
        <span style="color:${def?.color || '#6366f1'}">${def?.icon || '●'} ${esc(def?.label || node.type)}</span>
        <button class="wf-insp-close" id="wf-insp-close">✕</button>
      </div>
      <div class="wf-insp-body">
        <label class="ds-label">Label</label>
        <input class="ds-input" id="wf-insp-label" value="${esc(node.label || '')}" placeholder="Node label">
        ${node.type === 'page' ? `
          <label class="ds-label">URL / Pattern</label>
          <input class="ds-input" id="wf-insp-url" value="${esc(node.config?.url || '')}" placeholder="https://...">
        ` : ''}
        ${(node.type === 'click' || node.type === 'type' || node.type === 'read' || node.type === 'verify') ? `
          <label class="ds-label">Locator (primary)</label>
          <input class="ds-input" id="wf-insp-locator" value="${esc(node.config?.locator || '')}" placeholder="[data-testid=...] or #id">
          <label class="ds-label">Strategy</label>
          <select class="ds-select" id="wf-insp-strategy">
            ${['role+name','data-testid','label-for','id','name','text','ancestor+text','css-class','xpath'].map(s =>
              `<option${node.config?.strategy === s ? ' selected' : ''}>${s}</option>`
            ).join('')}
          </select>
        ` : ''}
        ${node.type === 'type' ? `
          <label class="ds-label">Value / Variable</label>
          <input class="ds-input" id="wf-insp-value" value="${esc(node.config?.value || '')}" placeholder='Text or {{variable}}'>
        ` : ''}
        ${node.type === 'wait' ? `
          <label class="ds-label">Wait for</label>
          <select class="ds-select" id="wf-insp-wait-type">
            <option${node.config?.waitType === 'element' ? ' selected' : ''}>element</option>
            <option${node.config?.waitType === 'delay' ? ' selected' : ''}>delay</option>
            <option${node.config?.waitType === 'navigation' ? ' selected' : ''}>navigation</option>
          </select>
          <label class="ds-label">Timeout (ms)</label>
          <input class="ds-input" id="wf-insp-timeout" type="number" value="${esc(String(node.config?.timeout || 5000))}">
        ` : ''}
        ${node.type === 'condition' ? `
          <label class="ds-label">Condition</label>
          <select class="ds-select" id="wf-insp-cond">
            ${['element_visible','element_hidden','element_contains_text','element_has_value','url_matches','url_contains','variable_equals','variable_contains','variable_matches_pattern','page_title_contains','element_count_equals','element_count_greater_than'].map(c =>
              `<option${node.config?.condition === c ? ' selected' : ''}>${c}</option>`
            ).join('')}
          </select>
          <label class="ds-label">Target / Value</label>
          <input class="ds-input" id="wf-insp-cond-value" value="${esc(node.config?.conditionValue || '')}" placeholder="Selector or value">
        ` : ''}
        <label class="ds-label" style="display:flex;align-items:center;gap:8px;margin-top:10px;font-weight:500">
          <input type="checkbox" id="wf-insp-humanfeel" ${node.config?.humanFeel !== false ? 'checked' : ''}>
          🖐 Human-feel (random delays)
        </label>
        <button class="ds-btn ds-btn-primary" id="wf-insp-apply" style="margin-top:12px">Apply</button>
        <button class="ds-btn ds-btn-danger" id="wf-insp-delete-node" style="margin-top:6px">Remove Node</button>
      </div>`;

    document.getElementById('wf-insp-close')?.addEventListener('click', () => {
      selectedNodeId = null;
      renderCanvas(wf);
      hideInspector();
    });

    document.getElementById('wf-insp-apply')?.addEventListener('click', () => {
      node.label = document.getElementById('wf-insp-label')?.value || node.label;
      if (node.type === 'page') {
        node.config = { ...node.config, url: document.getElementById('wf-insp-url')?.value };
      }
      if (['click','type','read','verify'].includes(node.type)) {
        node.config = {
          ...node.config,
          locator:  document.getElementById('wf-insp-locator')?.value,
          strategy: document.getElementById('wf-insp-strategy')?.value,
        };
      }
      if (node.type === 'type') {
        node.config = { ...node.config, value: document.getElementById('wf-insp-value')?.value };
      }
      if (node.type === 'wait') {
        node.config = {
          ...node.config,
          waitType: document.getElementById('wf-insp-wait-type')?.value,
          timeout:  parseInt(document.getElementById('wf-insp-timeout')?.value || '5000'),
        };
      }
      if (node.type === 'condition') {
        node.config = {
          ...node.config,
          condition:      document.getElementById('wf-insp-cond')?.value,
          conditionValue: document.getElementById('wf-insp-cond-value')?.value,
        };
      }
      node.config = { ...node.config, humanFeel: !!document.getElementById('wf-insp-humanfeel')?.checked };
      renderCanvas(wf);
      showInspector(node, wf);
    });

    document.getElementById('wf-insp-delete-node')?.addEventListener('click', () => {
      if (!wf.nodes) return;
      wf.nodes = wf.nodes.filter(n => n.id !== node.id);
      wf.edges = (wf.edges || []).filter(e => e.from !== node.id && e.to !== node.id);
      selectedNodeId = null;
      renderCanvas(wf);
      hideInspector();
    });
  }

  function hideInspector() {
    const inspector = document.getElementById('wf-inspector');
    if (inspector) { inspector.style.display = 'none'; inspector.innerHTML = ''; }
  }

  async function openWorkflow(id) {
    activeWfId = id;
    selectedNodeId = null;
    try { activeWf = await api.getWorkflow(id); } catch { return; }
    renderSidebar();
    renderCanvas(activeWf);
  }

  // New workflow button — opens a glass overlay listing promoted recordings
  // to import, plus a "blank workflow" option. No more Chrome prompt().
  document.getElementById('wf-new-btn')?.addEventListener('click', async () => {
    showNewWorkflowOverlay(api, workflows, renderSidebar, openWorkflow);
  });

  renderSidebar();
}

// ── Recordings ────────────────────────────────────────────────────────────────

// Deterministic color per recording id, so each row/card gets a stable accent.
// Uses the theme palette so it always reads well on the dark background.
const REC_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16'];
function recColor(id) {
  let h = 0;
  const s = String(id || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return REC_COLORS[h % REC_COLORS.length];
}

// ── Pre-promote validation gate ──────────────────────────────────────────────
// Before promoting a recording, auto-generate its TypeScript + lint it. Catches
// broken locators, missing selectors, syntax errors EARLY — TypeScript is stricter
// than JS, so things that "worked" in the browser DOM capture can fail in codegen.
// Shows errors + offers ⚡ AI Fix before the user commits to promoting.

const REC_ACTION_TO_NODE = {
  click: 'click', fill: 'type', type: 'type', hover: 'read',
  copy: 'extract', paste: 'type', submit: 'click', navigate: 'page',
  scroll: 'wait', select: 'select',
};

// Convert recording steps → workflow nodes (mirrors the server's promote logic)
function stepsToWorkflowNodes(steps) {
  const nodes = [];
  const edges = [];
  const startId = 'n_start';
  nodes.push({ id: startId, type: 'start', label: 'Start', config: {} });
  let prevId = startId;
  steps.forEach((step, i) => {
    const nodeId = `n_${i + 1}`;
    const nodeType = REC_ACTION_TO_NODE[step.action || step.type] || 'click';
    const el = step.element || {};
    nodes.push({
      id: nodeId,
      type: nodeType,
      label: `${nodeType} · ${el.tag || el.label || 'element'}`.slice(0, 60),
      config: {
        url: step.url,
        value: step.config?.value || step.value || null,
        variableName: step.config?.variableName || null,
        humanFeel: step.config?.humanFeel ?? true,
        wpm: step.config?.wpm || 60,
        valueSource: step.config?.valueSource || 'literal',
        aiPrompt: step.config?.aiPrompt || null,
        element: {
          tag: el.tag,
          role: el.role,
          accessibleName: el.accessibleName,
          locatorCandidates: el.locatorCandidates || [],
          urlPattern: el.urlPattern || step.url,
        },
      },
    });
    edges.push({ from: prevId, to: nodeId });
    prevId = nodeId;
  });
  nodes.push({ id: 'n_end', type: 'success', label: 'Complete', config: {} });
  edges.push({ from: prevId, to: 'n_end' });
  return { nodes, edges };
}

// Show the pre-promote validation overlay. Returns true if user chose to promote.
async function prePromoteCheck(api, recId, recLabel) {
  return new Promise(async (resolve) => {
    // Build the overlay
    const overlay = document.createElement('div');
    overlay.className = 'ds-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:40px';
    overlay.innerHTML = `
      <div style="background:#0f1722;border:1px solid rgba(59,130,246,.2);border-radius:16px;max-width:680px;width:100%;max-height:80vh;overflow:hidden;display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;gap:12px;padding:16px 24px;border-bottom:1px solid rgba(59,130,246,.2)">
          <span style="font-size:16px;font-weight:800;color:#d4d4d4">🔍 Pre-promote check</span>
          <span style="font-size:11px;color:#64748b">${esc(recLabel)}</span>
          <div style="flex:1"></div>
          <button class="ds-btn ds-btn-sm ds-btn-ghost" id="pp-cancel">✕</button>
        </div>
        <div id="pp-body" style="flex:1;overflow:auto;padding:20px 24px;font-size:13px;color:#94a3b8">
          <div style="text-align:center;padding:20px 0">
            <div style="font-size:14px;color:#f59e0b">⏳ Fetching recording + generating code…</div>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const body = overlay.querySelector('#pp-body');
    const close = () => { overlay.remove(); resolve(false); };
    overlay.querySelector('#pp-cancel').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    try {
      // 1. Fetch the full recording (need steps)
      const rec = await api.getRecording(recId);
      const steps = Array.isArray(rec.steps) ? rec.steps : [];
      if (!steps.length) {
        body.innerHTML = `<div style="color:#f87171;padding:12px">⚠ No steps in this recording — nothing to validate.</div>
          <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">
          <button class="ds-btn ds-btn-sm ds-btn-ghost" id="pp-cancel2">Cancel</button>
          <button class="ds-btn ds-btn-sm ds-btn-primary" id="pp-promote-anyway">Promote Anyway</button></div>`;
        overlay.querySelector('#pp-cancel2').onclick = close;
        overlay.querySelector('#pp-promote-anyway').onclick = () => { overlay.remove(); resolve(true); };
        return;
      }

      // 2. Convert steps → workflow nodes → generate TypeScript
      const wf = stepsToWorkflowNodes(steps);
      const code = generateTypeScript(wf);

      // 3. Lint the generated TypeScript
      body.innerHTML = `<div style="text-align:center;padding:20px 0"><div style="font-size:14px;color:#f59e0b">⏳ Auto-linting + self-healing (${steps.length} steps)…</div><div style="font-size:11px;color:#64748b;margin-top:6px">Errors will be auto-fixed using memory + AI. No action needed.</div></div>`;
      // autoFix=true → server runs the full loop: lint → retrieve memory → AI fix → re-lint → save to memory. Up to 5 rounds.
      const lintResult = await api.testTypeScript({ code, autoFix: true });

      // 4. Show results
      if (lintResult.ok) {
        const trail = (lintResult.attempts && lintResult.attempts.length > 1)
          ? `<div style="font-size:11px;color:#64748b;margin-top:6px">Self-healed: ${lintResult.attempts.map((a,i) => i === 0 ? `${a.errorCount} errors` : (a.ok ? '✓ clean' : `${a.errorCount} left`)).join(' → ')}</div>` : '';
        body.innerHTML = `
          <div style="text-align:center;padding:28px 0">
            <div style="font-size:36px;margin-bottom:12px">✅</div>
            <div style="font-size:15px;font-weight:700;color:#4ade80">Code passes lint + type-check</div>
            <div style="font-size:12px;color:#64748b;margin-top:6px">${steps.length} steps → ${wf.nodes.length} nodes → valid TypeScript</div>
            ${trail}
          </div>
          <div style="background:rgba(0,0,0,.3);border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px;margin:12px 0">
            <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Generated code preview</div>
            <pre style="font-family:'Fira Code',monospace;font-size:11px;color:#94a3b8;max-height:160px;overflow:auto;margin:0;white-space:pre-wrap">${esc(code.slice(0, 1200))}${code.length > 1200 ? '\n// ...' : ''}</pre>
          </div>
          <div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">
            <button class="ds-btn ds-btn-sm ds-btn-ghost" id="pp-cancel3">Cancel</button>
            <button class="ds-btn ds-btn-sm ds-btn-primary" id="pp-promote-go" style="background:linear-gradient(95deg,#10b981,#d4d4d4);color:#0b0e17;font-weight:800;border:none">✓ Promote & Open</button>
          </div>`;
        overlay.querySelector('#pp-cancel3').onclick = close;
        overlay.querySelector('#pp-promote-go').onclick = () => { overlay.remove(); resolve(true); };
      } else {
        // Errors found — show them + AI Fix option
        const errors = lintResult.errors || [];
        const errHtml = errors.slice(0, 8).map(e => `
          <div style="padding:8px 0;border-top:1px solid rgba(255,255,255,.04)">
            <div style="font-size:11px;color:#f87171;font-weight:600">Line ${e.line}:${e.column} <span style="color:#64748b;font-weight:400">· TS${e.code}</span></div>
            <div style="font-size:11px;color:#cbd5e1;margin:2px 0">${esc(e.message)}</div>
            ${e.snippet ? `<pre style="font-family:'Fira Code',monospace;font-size:10px;color:#94a3b8;background:rgba(0,0,0,.25);border-radius:6px;padding:6px 8px;margin:4px 0 0;white-space:pre">${esc(e.snippet)}</pre>` : ''}
          </div>`).join('');
        body.innerHTML = `
          <div style="padding:12px 0">
            <div style="font-size:14px;font-weight:700;color:#f87171">❌ ${errors.length} error${errors.length !== 1 ? 's' : ''} remain after 5 auto-fix rounds</div>
            <div style="font-size:11px;color:#64748b;margin-top:4px">The self-healing loop ran 5 rounds with AI + memory but couldn't resolve everything. These are likely missing selectors from the recording (AI can't invent locators that weren't captured). You can promote and fix manually, or re-record those steps.</div>
          </div>
          <div style="background:rgba(248,113,113,.06);border:1px solid rgba(248,113,113,.2);border-radius:10px;max-height:260px;overflow:auto">${errHtml}</div>
          <div style="margin-top:14px;display:flex;gap:8px;justify-content:flex-end">
            <button class="ds-btn ds-btn-sm ds-btn-ghost" id="pp-cancel4">Cancel</button>
            <button class="ds-btn ds-btn-sm" id="pp-anyway" style="background:rgba(248,113,113,.12);color:#f87171;border:1px solid rgba(248,113,113,.3)">Promote Anyway</button>
          </div>`;
        overlay.querySelector('#pp-cancel4').onclick = close;
        overlay.querySelector('#pp-anyway').onclick = () => { overlay.remove(); resolve(true); };
      }
    } catch (e) {
      body.innerHTML = `<div style="color:#f87171;padding:12px">⚠ Could not validate: ${esc(e.message)}</div>
        <div style="margin-top:12px"><button class="ds-btn ds-btn-sm ds-btn-primary" id="pp-anyway2">Promote Anyway</button></div>`;
      overlay.querySelector('#pp-anyway2').onclick = () => { overlay.remove(); resolve(true); };
    }
  });
}

export async function renderDevRecordings({ api, render }) {
  render(devNavHtml('recordings') +
    `<div class="ds-main" id="ds-main">${spinner()}</div>`);

  let recordings = [];
  try { recordings = await api.listRecordings(); } catch {}

  const main = document.getElementById('ds-main');
  if (!main) return;

  const STATUS_COLORS = {
    draft: 'var(--ds-t3)',
    reviewed: 'var(--ds-blue)',
    promoted: 'var(--ds-green)',
    archived: 'var(--ds-t3)',
    rejected: 'var(--ds-red)',
  };

  const renderRows = (recs) => recs.map(r => {
    const statusColor = STATUS_COLORS[r.status] || 'var(--ds-t3)';
    const color = recColor(r.id);
    return `<tr>
      <td><span class="rec-color-chip" style="background:${color}"></span>${esc(r.label)}</td>
      <td><code style="color:var(--ds-t2)">${esc(r.marketplace)}</code></td>
      <td>${esc(String(r.step_count))}</td>
      <td><span class="ds-badge" style="--badge-c:${statusColor}">${esc(r.status)}</span></td>
      <td class="c-t3">${relTime(r.created_at)}</td>
      <td>
        <button class="ds-btn ds-btn-sm rec-view" data-rec-id="${esc(r.id)}">View</button>
        ${r.status === 'draft' || r.status === 'reviewed' ? `
          <button class="ds-btn ds-btn-sm ds-btn-primary rec-promote" data-rec-id="${esc(r.id)}">Promote</button>
        ` : ''}
        <button class="ds-btn ds-btn-sm rec-delete" data-rec-id="${esc(r.id)}" title="Delete" style="background:rgba(239,68,68,0.08);color:#f87171;border:1px solid rgba(239,68,68,0.2);padding:4px 8px">🗑</button>
      </td>
    </tr>`;
  }).join('');

  function paint(recs) {
    main.innerHTML = `
      <h2>Recordings</h2>
      <p class="ds-page-desc">Action recordings captured via Teach Mode. Promote to a workflow, or delete with 🗑.</p>
      <div class="rec-filter-bar">
        <span>${recs.length} recording${recs.length === 1 ? '' : 's'}</span>
      </div>
      ${recs.length === 0
        ? card('No Recordings',
            `<div class="ds-empty">
              <p>No recordings yet.</p>
              <p style="font-size:12px;color:var(--ds-t3)">Right-click any element on eBay or Amazon, then choose<br><strong>Syndrax → Capture Element</strong> to start recording.</p>
            </div>`)
        : card('Recordings', `
            <div class="ds-card-bd-flush"><table class="ds-table">
              <thead><tr><th>Label</th><th>Marketplace</th><th>Steps</th><th>Status</th><th>Recorded</th><th></th></tr></thead>
              <tbody>${renderRows(recs)}</tbody>
            </table></div>`,
          `${recs.length}`)}`;

    main.querySelectorAll('.rec-view').forEach(btn => {
      btn.onclick = () => openRecordingDetail(api, render, btn.dataset.recId);
    });
    main.querySelectorAll('.rec-promote').forEach(btn => {
      btn.onclick = async () => {
        const rec = recordings.find(r => r.id === btn.dataset.recId);
        // Pre-promote validation gate: auto-generate + lint before promoting
        const shouldPromote = await prePromoteCheck(api, btn.dataset.recId, rec?.label || 'Recording');
        if (!shouldPromote) return;
        try { await api.patchRecording(btn.dataset.recId, { status: 'promoted' }); renderDevRecordings({ api, render }); } catch {}
      };
    });
    // Quick delete — no confirmation, instant removal from cloud
    main.querySelectorAll('.rec-delete').forEach(btn => {
      btn.onclick = async () => {
        try { await api.deleteRecording(btn.dataset.recId); recordings = recordings.filter(r => r.id !== btn.dataset.recId); paint(recordings); } catch {}
      };
    });
    // No more toggle/clear-rejected — rejected recordings are deleted instantly
  }

  paint(recordings);

  // Auto-refresh: while this view is on screen, poll for new recordings so a
  // freshly-saved Teach Mode recording shows up without a manual reload. Only
  // re-renders when the row set actually changes (count + latest id) to avoid
  // clobbering an in-progress View/Promote/Reject click.
  const signature = (recs) => recs.length + ':' + (recs[0]?.id || '');
  let lastSig = signature(recordings);
  if (main._recPoll) clearInterval(main._recPoll);
  main._recPoll = setInterval(async () => {
    if (!document.body.contains(main) || document.getElementById('ds-main') !== main) {
      clearInterval(main._recPoll);
      return;
    }
    // Don't auto-refresh if the user drilled into the detail view.
    if (main.querySelector('.rv-flow')) return;
    let fresh = [];
    try { fresh = await api.listRecordings(); } catch { return; }
    if (signature(fresh) !== lastSig) {
      lastSig = signature(fresh);
      recordings = fresh;
      paint(fresh);
    }
  }, 4000);
}

// ── Recording detail: visual step path + element detail drawer ──────────────

async function openRecordingDetail(api, render, recId) {
  const main = document.getElementById('ds-main');
  if (!main) return;
  main.innerHTML = spinner();
  let rec = null;
  try { rec = await api.getRecording(recId); } catch {}
  if (!rec) { renderDevRecordings({ api, render }); return; }

  const color = recColor(rec.id);
  const steps = Array.isArray(rec.steps) ? rec.steps : [];

  // Sort locators by confidence for display.
  const rankedLocators = (el) => {
    const c = Array.isArray(el?.locatorCandidates) ? [...el.locatorCandidates] : [];
    return c.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  };

  const stepIcon = (type) => ({ click: '👆', type: '⌨', navigate: '↗', submit: '✓', scroll: '↕' }[type] || '•');

  const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return '—'; } };
  const pathOf = (url) => { try { return new URL(url).pathname + new URL(url).search; } catch { return url; } };

  // URL query-param chips (the Phase D foundation — shows filters/sort as tokens).
  const urlParamChips = (url) => {
    try {
      const u = new URL(url);
      const entries = [...u.searchParams.entries()].filter(([k]) => !['_from', '_sacat'].includes(k));
      if (!entries.length) return '';
      return `<div class="rv-url-params">${entries.map(([k, v]) => `<span class="rv-url-param">${esc(k)}=${esc(v)}</span>`).join('')}</div>`;
    } catch { return ''; }
  };

  const confColor = (c) => c >= 0.8 ? 'var(--ds-green)' : c >= 0.5 ? 'var(--ds-amber)' : 'var(--ds-red)';

  const REC_STATUS_COLOR = {
    draft: 'var(--ds-t3)', reviewed: 'var(--ds-blue)', promoted: 'var(--ds-green)',
    rejected: 'var(--ds-red)', archived: 'var(--ds-t3)',
  };
  const statusColor = REC_STATUS_COLOR[rec.status] || 'var(--ds-t3)';

  main.innerHTML = `
    <div class="rv-head">
      <div class="rv-chip" style="background:${color}">${rec.marketplace ? esc(rec.marketplace[0].toUpperCase()) : 'R'}</div>
      <div>
        <div class="rv-title">${esc(rec.label)}</div>
        <div class="rv-sub">${steps.length} step${steps.length === 1 ? '' : 's'} · ${esc(rec.marketplace)} · <span style="color:${statusColor}">${esc(rec.status)}</span> · ${relTime(rec.created_at)}</div>
      </div>
      <div class="rv-actions">
        <button class="ds-btn ds-btn-sm ds-btn-ghost" id="rv-back">&larr; Recordings</button>
        ${rec.status === 'draft' || rec.status === 'reviewed' ? `<button class="ds-btn ds-btn-sm ds-btn-primary" id="rv-promote">Promote to Workflow</button>` : ''}
      </div>
    </div>
    ${steps.length === 0 ? `<div class="ds-empty"><p>This recording has no steps.</p></div>` : `
    <div class="ds-card"><div class="ds-card-bd">
      <div class="rv-flow" id="rv-flow">
        ${steps.map((st, i) => {
          const el = st.element || {};
          const label = el.label || el.accessibleName || el.visibleText || el.tag || 'element';
          const locs = rankedLocators(el);
          const best = locs[0];
          const conf = Number(el.confidence ?? 0);
          return `<div class="rv-step" data-rv-idx="${i}">
            <div class="rv-step-num">${i + 1}</div>
            <div class="rv-card" data-rv-card="${i}">
              <span class="rv-card-icon">${stepIcon(st.type)}</span>
              <div class="rv-card-main">
                <div class="rv-card-label">${esc(label)}</div>
                <div class="rv-card-meta">${esc(hostOf(st.url))} · ${esc(st.type)} ${best ? `· <span class="rv-card-loc">${esc(best.strategy)}: ${esc(String(best.value).slice(0, 50))}</span>` : ''}</div>
              </div>
              <span class="rv-conf" style="background:${confColor(conf)}" title="${Math.round(conf * 100)}% confidence"></span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div></div>`}
  `;

  // Animate the path: light up each step's connector ring in sequence, then loop.
  const flowEl = main.querySelector('#rv-flow');
  if (flowEl && steps.length) {
    let i = 0;
    const tick = () => {
      flowEl.querySelectorAll('.rv-step').forEach(s => s.classList.remove('flowing'));
      const cur = flowEl.querySelector(`.rv-step[data-rv-idx="${i}"]`);
      if (cur) cur.classList.add('flowing');
      i = (i + 1) % steps.length;
    };
    tick();
    const iv = setInterval(tick, 900);
    flowEl._rvIv = iv;
  }

  // Click a card → open the element detail drawer.
  main.querySelectorAll('[data-rv-card]').forEach(cardEl => {
    cardEl.onclick = () => {
      const idx = Number(cardEl.dataset.rvCard);
      const st = steps[idx];
      main.querySelectorAll('.rv-card').forEach(c => c.classList.remove('sel'));
      cardEl.classList.add('sel');
      openElementDrawer(st, rankedLocators, hostOf, pathOf, urlParamChips, confColor);
    };
  });

  const back = main.querySelector('#rv-back');
  if (back) back.onclick = () => renderDevRecordings({ api, render });
  const prom = main.querySelector('#rv-promote');
  if (prom) prom.onclick = async () => {
    // Pre-promote validation: auto-generate + lint before creating the workflow
    const shouldPromote = await prePromoteCheck(api, rec.id, rec.label);
    if (!shouldPromote) return;
    prom.disabled = true;
    prom.textContent = 'Importing…';
    try {
      const result = await api.promoteToWorkflow(rec.id);
      // Navigate to the workflows view with the new workflow auto-selected
      navigate('workflows');
      // The workflow is now in the list — show a brief confirmation
      setTimeout(() => {
        const main2 = document.getElementById('ds-main');
        if (main2) {
          const banner = document.createElement('div');
          banner.style.cssText = 'background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);border-radius:10px;padding:12px 16px;margin-bottom:16px;color:#4ade80;font-size:13px';
          banner.innerHTML = `✓ Imported <strong>${result.step_count}</strong> steps → <strong>${result.node_count}</strong> workflow nodes. Click the workflow to edit it, then use <strong>Generate TypeScript</strong> to build the automation script.`;
          main2.prepend(banner);
        }
      }, 500);
    } catch (e) {
      prom.disabled = false;
      prom.textContent = 'Promote to Workflow';
      alert('Failed to create workflow: ' + (e.message || 'unknown error'));
    }
  };
}

// Right-side drawer with the full locator set + HTML fragment for one step.
function openElementDrawer(st, rankedLocators, hostOf, pathOf, urlParamChips, confColor) {
  let drawer = document.getElementById('rv-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'rv-drawer';
    drawer.className = 'rv-drawer';
    document.body.appendChild(drawer);
  }
  const el = st.element || {};
  const locs = rankedLocators(el);
  const conf = Number(el.confidence ?? 0);
  const ctxArr = Array.isArray(el.ancestorContext) ? el.ancestorContext : [];
  const nearby = Array.isArray(el.nearbyText) ? el.nearbyText : [];

  drawer.innerHTML = `
    <div class="rv-drawer-hd">
      <span class="rv-card-icon">${esc(st.type || '•')}</span>
      <span class="rv-drawer-title">${esc(el.label || el.accessibleName || el.tag || 'element')}</span>
      <button class="ds-btn ds-btn-sm ds-btn-ghost" id="rv-drawer-close">&times;</button>
    </div>
    <div class="rv-drawer-body">
      <div>
        <div class="rv-section-hd">Confidence</div>
        <div style="font-size:13px;color:${confColor(conf)};font-weight:700">${Math.round(conf * 100)}% · ${esc(el.role || 'no role')}</div>
        <div class="rv-conf-bar"><div style="width:${Math.round(conf * 100)}%;background:${confColor(conf)}"></div></div>
      </div>
      <div>
        <div class="rv-section-hd">Identity</div>
        <div style="font-size:12px;color:var(--ds-t2);line-height:1.7">
          <div><strong style="color:var(--ds-t1)">tag:</strong> <code>${esc(el.tag || '—')}</code></div>
          ${el.role ? `<div><strong style="color:var(--ds-t1)">role:</strong> <code>${esc(el.role)}</code></div>` : ''}
          ${el.accessibleName ? `<div><strong style="color:var(--ds-t1)">name:</strong> ${esc(el.accessibleName)}</div>` : ''}
          ${el.visibleText ? `<div><strong style="color:var(--ds-t1)">text:</strong> ${esc(el.visibleText)}</div>` : ''}
          ${el.nameAttr ? `<div><strong style="color:var(--ds-t1)">name attr:</strong> <code>${esc(el.nameAttr)}</code></div>` : ''}
        </div>
      </div>
      <div>
        <div class="rv-section-hd">Locators (ranked, robust → fragile)</div>
        ${locs.length ? locs.map(l => {
          const lc = confColor(l.confidence ?? 0);
          return `<div class="rv-loc-row">
            <span class="rv-loc-strat">${esc(l.strategy)}</span>
            <span class="rv-loc-val">${esc(l.value)}</span>
          </div>`;
        }).join('') : '<div style="font-size:12px;color:var(--ds-t3)">No locators captured.</div>'}
      </div>
      ${el.stableDataAttrs && Object.keys(el.stableDataAttrs).length ? `<div>
        <div class="rv-section-hd">Data attributes</div>
        <div class="rv-url-params">${Object.entries(el.stableDataAttrs).map(([k, v]) => `<span class="rv-url-param">${esc(k)}=${esc(v)}</span>`).join('')}</div>
      </div>` : ''}
      ${ctxArr.length ? `<div>
        <div class="rv-section-hd">Ancestor context</div>
        <div style="font-family:ui-monospace,monospace;font-size:11px;color:var(--ds-t2);line-height:1.8">${ctxArr.map(c => `<div>${esc(c)}</div>`).join('')}</div>
      </div>` : ''}
      ${nearby.length ? `<div>
        <div class="rv-section-hd">Nearby text</div>
        <div style="font-size:11px;color:var(--ds-t3);line-height:1.6">${nearby.map(t => `<div>· ${esc(t)}</div>`).join('')}</div>
      </div>` : ''}
      ${el.sanitizedFragment ? `<div>
        <div class="rv-section-hd">HTML fragment</div>
        <pre class="rv-frag">${esc(el.sanitizedFragment)}</pre>
      </div>` : ''}
      <div>
        <div class="rv-section-hd">Page context</div>
        <div style="font-size:12px;color:var(--ds-t2);line-height:1.6">
          <div><strong style="color:var(--ds-t1)">host:</strong> ${esc(hostOf(st.url))}</div>
          <div style="word-break:break-all"><strong style="color:var(--ds-t1)">path:</strong> ${esc(pathOf(st.url))}</div>
          ${el.pageType ? `<div><strong style="color:var(--ds-t1)">page type:</strong> ${esc(el.pageType)}</div>` : ''}
          <div style="color:var(--ds-t3);margin-top:3px">captured ${esc(st.timestamp)}</div>
        </div>
        ${urlParamChips(st.url)}
      </div>
    </div>
  `;
  // force reflow then open (so the transition fires)
  requestAnimationFrame(() => drawer.classList.add('open'));
  const close = drawer.querySelector('#rv-drawer-close');
  if (close) close.onclick = () => {
    drawer.classList.remove('open');
    document.querySelectorAll('.rv-card.sel').forEach(c => c.classList.remove('sel'));
  };
}

// ── TypeScript Codegen ──────────────────────────────────────────────────────
// Converts a saved workflow (nodes + edges) into a resilient Playwright-style
// automation script. Auto-wait (no setTimeout), human-feel, AI-plan calls.

function generateTypeScript(wf) {
  const nodes = Array.isArray(wf.nodes) ? wf.nodes : [];
  const edges = Array.isArray(wf.edges) ? wf.edges : [];

  // Build an adjacency map from edges
  const childrenOf = {};
  edges.forEach(e => {
    if (!childrenOf[e.from]) childrenOf[e.from] = [];
    childrenOf[e.from].push(e.to);
  });

  // Find the start node (type=start, or first node)
  const startNode = nodes.find(n => n.type === 'start') || nodes[0];
  if (!startNode) return '// Empty workflow — no nodes.';

  // Build an ordered execution path by following edges from start
  const ordered = [];
  const visited = new Set();
  function walk(nodeId) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = nodes.find(n => n.id === nodeId);
    if (node && node.type !== 'start') ordered.push(node);
    const kids = childrenOf[nodeId] || [];
    kids.forEach(k => walk(k));
  }
  const startKids = childrenOf[startNode.id] || [];
  startKids.forEach(k => walk(k));

  // Helper: pick the best Playwright locator from the element's candidates
  function bestLocator(node) {
    const el = node.config?.element || {};
    const candidates = Array.isArray(el.locatorCandidates) ? el.locatorCandidates : [];
    // Prefer role-based → testid → label → text → css
    const ranked = candidates.slice().sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
    const best = ranked[0];
    if (!best) return null;
    return { strategy: best.strategy, value: best.value };
  }

  // Convert a locator strategy to Playwright page.locator() syntax
  function toPlaywrightLocator(loc) {
    if (!loc) return "page.locator('body')";
    const { strategy, value } = loc;
    switch (strategy) {
      case 'role+name':
        const m = value.match(/^(\w+)\[.*name="(.+?)"\]/);
        if (m) return `page.getByRole('${m[1].toLowerCase()}', { name: '${m[2].replace(/'/g, "\\'")}' })`;
        return `page.locator('${value.replace(/'/g, "\\'")}')`;
      case 'data-testid':
        return `page.getByTestId('${value.replace(/'/g, "\\'")}')`;
      case 'label':
        return `page.getByLabel('${value.replace(/'/g, "\\'")}')`;
      case 'text':
        return `page.getByText('${value.replace(/'/g, "\\'").slice(0, 60)}')`;
      case 'css':
        return `page.locator('${value.replace(/'/g, "\\'").slice(0, 120)}')`;
      default:
        return `page.locator('${value.replace(/'/g, "\\'").slice(0, 120)}')`;
    }
  }

  // Generate code for a single node
  function nodeToCode(node, indent) {
    const cfg = node.config || {};
    const loc = bestLocator(node);
    const locatorStr = toPlaywrightLocator(loc);
    const ind = indent;
    let code = '';

    switch (node.type) {
      case 'click':
        code += `${ind}// ${escComment(node.label)} — auto-wait for actionability\n`;
        code += `${ind}await ${locatorStr}.click();\n`;
        if (cfg.humanFeel !== false) code += `${ind}await humanDelay(200, 700);\n`;
        break;

      case 'type':
        if (cfg.valueSource === 'ai-plan') {
          code += `${ind}// ${escComment(node.label)} — AI-planned value\n`;
          code += `${ind}const ${cfg.variableName || 'aiValue'} = await aiGenerate(${JSON.stringify(cfg.aiPrompt || 'generate a value')});\n`;
          code += `${ind}await humanType(${locatorStr}, ${cfg.variableName || 'aiValue'}${cfg.humanFeel !== false ? '' : ', { instant: true }'});\n`;
        } else {
          code += `${ind}// ${escComment(node.label)} — human-type at ${cfg.wpm || 60} WPM\n`;
          const val = JSON.stringify(cfg.value || '');
          if (cfg.variableName) {
            code += `${ind}await humanType(${locatorStr}, ${cfg.variableName}${cfg.humanFeel !== false ? '' : ', { instant: true }'});\n`;
          } else {
            code += `${ind}await humanType(${locatorStr}, ${val}${cfg.humanFeel !== false ? '' : ', { instant: true }'});\n`;
          }
        }
        break;

      case 'read':
        code += `${ind}// ${escComment(node.label)} — hover\n`;
        code += `${ind}await ${locatorStr}.hover();\n`;
        if (cfg.humanFeel !== false) code += `${ind}await humanDelay(300, 800);\n`;
        break;

      case 'extract':
        const varName = cfg.variableName || `extracted_${node.id}`;
        code += `${ind}// ${escComment(node.label)} — extract to variable\n`;
        code += `${ind}const ${varName} = await ${locatorStr}.textContent() ?? '';\n`;
        code += `${ind}console.log('[extract] ${varName} =', ${varName});\n`;
        break;

      case 'page':
        code += `${ind}// Navigate: ${escComment(cfg.url || node.label)}\n`;
        code += `${ind}await page.goto(${JSON.stringify(cfg.url || 'about:blank')});\n`;
        code += `${ind}await page.waitForLoadState('networkidle');\n`;
        break;

      case 'wait':
        code += `${ind}// Wait for network idle\n`;
        code += `${ind}await page.waitForLoadState('networkidle');\n`;
        break;

      case 'condition':
        code += `${ind}// Condition: ${escComment(node.label)}\n`;
        code += `${ind}if (await ${locatorStr}.isVisible({ timeout: 5000 }).catch(() => false)) {\n`;
        break;

      case 'success':
        code += `${ind}console.log('[AXIS] ✅ Workflow completed successfully');\n`;
        break;

      case 'failure':
        code += `${ind}console.error('[AXIS] ❌ Workflow failed at this step');\n`;
        break;

      default:
        code += `${ind}// ${escComment(node.label || node.type)} (unhandled node type)\n`;
    }
    return code;
  }

  function escComment(s) {
    return String(s || '').replace(/[\n\r]/g, ' ').replace(/\*\//g, '*\\/');
  }

  // Assemble the full script
  const lines = [];
  lines.push('/**');
  lines.push(` * ${wf.name} — Auto-generated by Syndrax AXIS Codegen`);
  lines.push(` * Generated: ${new Date().toISOString()}`);
  lines.push(` * Nodes: ${ordered.length} | Edges: ${edges.length}`);
  lines.push(' * ');
  lines.push(' * SECURITY: This script runs LOCALLY under owner control.');
  lines.push(' * RUNNER_CLAIMS_ENABLED=false — never auto-deployed.');
  lines.push(' */');
  lines.push('');
  lines.push("import { chromium, type Page } from 'playwright';");
  lines.push('');
  lines.push('// ── Human-feel helpers ──────────────────────────────────────────────────');
  lines.push('');
  lines.push('function humanDelay(minMs: number, maxMs: number): Promise<void> {');
  lines.push('  return new Promise(r => setTimeout(r, minMs + Math.random() * (maxMs - minMs)));');
  lines.push('}');
  lines.push('');
  lines.push('async function humanType(');
  lines.push("  locator: ReturnType<Page['locator']> | { fill: (v: string) => Promise<void> },");
  lines.push("  text: string,");
  lines.push("  opts: { instant?: boolean; wpm?: number } = {},");
  lines.push('): Promise<void> {');
  lines.push('  if (opts.instant) {');
  lines.push("    await locator.fill(text);");
  lines.push('    return;');
  lines.push('  }');
  lines.push("  const wpm = opts.wpm ?? 60;");
  lines.push("  const baseDelay = 60000 / (wpm * 5);");
  lines.push("  await locator.fill('');");
  lines.push("  for (let i = 0; i < text.length; i++) {");
  lines.push("    await locator.fill(text.slice(0, i + 1));");
  lines.push("    await new Promise(r => setTimeout(r, baseDelay * (0.75 + Math.random() * 0.5)));");
  lines.push("  }");
  lines.push('}');
  lines.push('');
  lines.push('// AI value generation — replace with your Syndrax API call');
  lines.push("async function aiGenerate(prompt: string): Promise<string> {");
  lines.push("  console.log('[AI] generating value for:', prompt);");
  lines.push("  // TODO: wire to Syndrax cloud AI (syndrax-app runner, port 8000)");
  lines.push("  return 'sample-search-term';");
  lines.push("}");
  lines.push('');
  lines.push('// ── Main automation ─────────────────────────────────────────────────────');
  lines.push('');
  lines.push("async function run() {");
  lines.push("  const browser = await chromium.launch({ headless: false });");
  lines.push("  const page = await browser.newPage();");
  lines.push('');

  ordered.forEach(node => {
    lines.push(nodeToCode(node, '  '));
  });

  lines.push('');
  lines.push("  console.log('[AXIS] Workflow execution finished.');");
  lines.push("  await browser.close();");
  lines.push("}");
  lines.push('');
  lines.push("run().catch(console.error);");

  return lines.join('\n');
}

// Codegen modal — full-screen code preview with copy/download
function showTestRunPanel(wf, result) {
  const existing = document.getElementById('wf-run-overlay');
  if (existing) existing.remove();
  const steps = Array.isArray(result.step_log) ? result.step_log : [];
  const ok = result.status === 'succeeded';
  const overlay = document.createElement('div');
  overlay.id = 'wf-run-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="width:560px;max-height:80vh;display:flex;flex-direction:column;background:rgba(11,14,23,0.92);border:1px solid rgba(${ok ? '34,197,94' : '248,113,113'},0.35);border-radius:16px;box-shadow:0 0 30px rgba(${ok ? '34,197,94' : '248,113,113'},0.18),0 20px 60px rgba(0,0,0,0.6);padding:24px;color:#e2e8f0;font-family:inherit">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
        <span style="font-size:18px">${ok ? '✅' : '❌'}</span>
        <span style="font-size:15px;font-weight:800;color:${ok ? '#4ade80' : '#f87171'}">Test Run — ${ok ? 'Passed' : 'Failed'}</span>
        <div style="flex:1"></div>
        <button class="ds-btn ds-btn-sm ds-btn-ghost" id="run-close">✕</button>
      </div>
      <div style="font-size:11px;color:#64748b;margin-bottom:12px">Structural validation of <strong style="color:#94a3b8">${esc(wf.name)}</strong> — each node checked for a locator and a path from Start. Live page execution is the next layer (local runner / extension replay).</div>
      ${result.error ? `<div style="font-size:12px;color:#f87171;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;padding:8px 12px;margin-bottom:10px">${esc(result.error)}</div>` : ''}
      <div style="overflow:auto;flex:1">
        ${steps.length ? steps.map(s => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid rgba(255,255,255,0.06);border-radius:8px;margin-bottom:6px;font-size:12px">
            <span style="color:${s.status === 'passed' ? '#4ade80' : '#f87171'};font-weight:800;width:14px">${s.status === 'passed' ? '✓' : '✗'}</span>
            <span style="color:#64748b;width:18px">${s.step}</span>
            <span style="color:#cbd5e1;flex:1">${esc(s.label || '')}</span>
            ${s.error ? `<span style="color:#f87171;font-size:11px">${esc(s.error)}</span>` : ''}
          </div>`).join('') : '<div style="color:#64748b;font-size:12px;text-align:center;padding:20px">No actionable steps in this workflow.</div>'}
      </div>
      <div style="margin-top:12px;font-size:11px;color:#475569">Run ID: <code style="color:#64748b">${esc(String(result.run_id || '—').slice(0, 8))}</code> · saved to dev_workflow_runs (mode: safe_test)</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#run-close').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

function showCodegenModal(wf, api) {
  const existing = document.getElementById('wf-codegen-overlay');
  if (existing) existing.remove();

  let currentCode = generateTypeScript(wf);

  const overlay = document.createElement('div');
  overlay.id = 'wf-codegen-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;backdrop-filter:blur(8px)';
  overlay.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:16px 24px;border-bottom:1px solid rgba(59,130,246,0.2)">
      <span style="font-size:16px;font-weight:800;color:#d4d4d4">⚡ TypeScript — ${esc(wf.name)}</span>
      <span style="font-size:11px;color:#64748b">${(Array.isArray(wf.nodes) ? wf.nodes : []).length} nodes</span>
      <div style="flex:1"></div>
      <button class="ds-btn ds-btn-sm" id="cg-test" style="background:linear-gradient(95deg,#10b981,#d4d4d4);color:#0b0e17;font-weight:800;border:none">🔬 Lint &amp; Test</button>
      <button class="ds-btn ds-btn-sm" id="cg-sandbox" style="background:linear-gradient(95deg,#f59e0b,#ef4444);color:#0b0e17;font-weight:800;border:none" title="Run the code in a headless browser in the cloud — no download needed">▶ Run Sandbox</button>
      <button class="ds-btn ds-btn-sm" id="cg-copy" style="background:rgba(255, 255, 255,0.12);color:#d4d4d4;border:1px solid rgba(255, 255, 255,0.3)">📋 Copy</button>
      <button class="ds-btn ds-btn-sm" id="cg-download" style="background:rgba(34,197,94,0.12);color:#4ade80;border:1px solid rgba(34,197,94,0.3)">⬇ Download .ts</button>
      <button class="ds-btn ds-btn-sm ds-btn-ghost" id="cg-close">✕ Close</button>
    </div>
    <div style="display:flex;gap:0;flex:1;overflow:hidden">
      <div style="flex:1;overflow:auto;padding:20px 24px">
        <div id="cg-test-panel" style="display:none;margin-bottom:16px;border-radius:12px;overflow:hidden"></div>
        <pre id="cg-code" style="margin:0;font-family:'Fira Code',ui-monospace,monospace;font-size:12px;line-height:1.7;color:#94a3b8;white-space:pre-wrap;word-break:break-word">${esc(currentCode)}</pre>
      </div>
      <div style="width:300px;flex:none;border-left:1px solid rgba(59,130,246,0.15);padding:20px;display:flex;flex-direction:column;gap:12px;background:rgba(11,14,23,0.5)">
        <div style="font-size:13px;font-weight:800;color:#a5b4fc">✨ AI Edit</div>
        <div style="font-size:11px;color:#64748b">Describe what to change. The AI edits the code — your API key stays hidden on the server.</div>
        <textarea id="cg-ai-input" placeholder="e.g. add error handling with try/catch around each step, add a screenshot on failure, increase WPM to 80..." style="flex:1;width:100%;box-sizing:border-box;padding:10px 12px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:10px;color:#f1f5f9;font-size:12px;font-family:inherit;resize:none;min-height:80px"></textarea>
        <button class="ds-btn ds-btn-sm" id="cg-ai-send" style="background:linear-gradient(95deg,#3b82f6,#d4d4d4);color:#0b0e17;font-weight:800;border:none;padding:10px;border-radius:10px;cursor:pointer">⚡ Edit with AI</button>
        <div id="cg-ai-status" style="font-size:11px;color:#64748b;min-height:16px"></div>
        <div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;margin-top:auto">
          <div style="font-size:10px;color:#475569;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Quick actions</div>
          <button class="ds-btn ds-btn-sm ds-btn-ghost" id="cg-ai-err" style="width:100%;margin-bottom:4px;font-size:11px;text-align:left">Add error handling</button>
          <button class="ds-btn ds-btn-sm ds-btn-ghost" id="cg-ai-ss" style="width:100%;margin-bottom:4px;font-size:11px;text-align:left">Add screenshots on failure</button>
          <button class="ds-btn ds-btn-sm ds-btn-ghost" id="cg-ai-retry" style="width:100%;font-size:11px;text-align:left">Add retry logic (3x)</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const codeEl = overlay.querySelector('#cg-code');
  const statusEl = overlay.querySelector('#cg-ai-status');

  const updateCode = (newCode) => {
    currentCode = newCode;
    codeEl.textContent = newCode;
  };

  // ── Lint & Test: static analysis (type-check) + optional AI auto-fix ───────
  // Shows each error with its line number + the offending snippet, and offers a
  // one-click "AI Fix & Retry" loop that feeds the errors to GLM and re-checks.
  const testPanel = overlay.querySelector('#cg-test-panel');
  const renderTestResult = (r) => {
    const ok = r.ok;
    const bg = ok ? 'rgba(34,197,94,0.08)' : 'rgba(248,113,113,0.08)';
    const border = ok ? 'rgba(34,197,94,0.35)' : 'rgba(248,113,113,0.35)';
    const head = ok ? '✅ Code passes lint + type-check' : `❌ ${r.errors.length} error${r.errors.length>1?'s':''} found`;
    const fixBtn = (!ok) ? `<button class="ds-btn ds-btn-sm" id="cg-aifix" style="background:linear-gradient(95deg,#3b82f6,#d4d4d4);color:#0b0e17;font-weight:800;border:none">⚡ AI Fix &amp; Retry</button>` : '';
    const attempts = (r.attempts && r.attempts.length > 1)
      ? `<div style="font-size:10px;color:#64748b;margin-top:6px">AI fix loop: ${r.attempts.map(a => a.ok ? '✓' : a.errorCount + ' err').join(' → ')}</div>` : '';
    const errs = r.errors.map(e => `
      <div style="border-top:1px solid rgba(255,255,255,0.06);padding:8px 12px">
        <div style="font-size:11px;color:#f87171;font-weight:600">Line ${e.line}:${e.column} <span style="color:#64748b;font-weight:400">· TS${e.code}</span></div>
        <div style="font-size:11px;color:#cbd5e1;margin:2px 0 6px">${esc(e.message)}</div>
        <pre style="margin:0;font-family:'Fira Code',monospace;font-size:10.5px;color:#94a3b8;background:rgba(0,0,0,0.25);border-radius:6px;padding:6px 8px;white-space:pre">${esc(e.snippet)}</pre>
      </div>`).join('');
    testPanel.style.display = 'block';
    testPanel.style.background = bg;
    testPanel.style.border = `1px solid ${border}`;
    testPanel.innerHTML = `
      <div style="padding:10px 14px;display:flex;align-items:center;gap:10px">
        <span style="font-size:12px;font-weight:800;color:${ok?'#4ade80':'#f87171'}">${head}</span>
        <div style="flex:1"></div>
        ${fixBtn}
        <button class="ds-btn ds-btn-sm ds-btn-ghost" id="cg-test-close" style="padding:2px 8px">✕</button>
      </div>
      ${errs}
      ${attempts}`;
    const af = testPanel.querySelector('#cg-aifix');
    if (af) af.onclick = () => runTest(true);
    testPanel.querySelector('#cg-test-close').onclick = () => { testPanel.style.display = 'none'; };
  };
  const runTest = async (autoFix) => {
    const testBtn = overlay.querySelector('#cg-test');
    const orig = testBtn.textContent;
    testBtn.disabled = true; testBtn.textContent = autoFix ? '⏳ Fixing…' : '⏳ Checking…';
    testPanel.style.display = 'block';
    testPanel.style.background = 'rgba(59,130,246,0.06)';
    testPanel.style.border = '1px solid rgba(59,130,246,0.25)';
    testPanel.innerHTML = `<div style="padding:12px 14px;font-size:12px;color:#94a3b8">⏳ ${autoFix ? 'Running lint + AI fix loop (up to 2 rounds)…' : 'Linting + type-checking the code…'}</div>`;
    try {
      const r = await api.testTypeScript({ code: currentCode, autoFix });
      renderTestResult(r);
      // If AI fixed it, adopt the fixed code so Copy/Download export the good version.
      if (autoFix && r.fixedCode && r.ok) updateCode(r.fixedCode);
    } catch (e) {
      testPanel.innerHTML = `<div style="padding:12px 14px;font-size:12px;color:#f87171">✗ ${esc(e.message || 'test failed')}</div>`;
    } finally {
      testBtn.disabled = false; testBtn.textContent = orig;
    }
  };
  overlay.querySelector('#cg-test').onclick = () => runTest(true);

  // ── Run in cloud sandbox (headless Playwright execution) ────────────────────
  // Actually EXECUTES the generated code in a real headless browser in the cloud.
  // Shows each step (navigate/click/type/wait) with ✅/❌ + duration. On failure,
  // shows the error + a screenshot. This is for logic testing — NOT live
  // marketplace automation (the cloud IP is datacenter = blocked by marketplaces).
  const runSandbox = async () => {
    const sbBtn = overlay.querySelector('#cg-sandbox');
    const orig = sbBtn.textContent;
    sbBtn.disabled = true; sbBtn.textContent = '⏳ Running…';
    testPanel.style.display = 'block';
    testPanel.style.background = 'rgba(245,158,11,0.06)';
    testPanel.style.border = '1px solid rgba(245,158,11,0.25)';
    testPanel.innerHTML = `<div style="padding:14px;font-size:12px;color:#f59e0b">⏳ Executing code in headless browser… (up to 30s)</div>`;
    try {
      const r = await api.runSandbox({ code: currentCode });
      const steps = r.steps || [];
      const ok = r.ok;
      const bg = ok ? 'rgba(34,197,94,0.08)' : 'rgba(248,113,113,0.08)';
      const border = ok ? 'rgba(34,197,94,0.35)' : 'rgba(248,113,113,0.35)';
      const head = ok ? `✅ Sandbox run passed — ${steps.length} step${steps.length !== 1 ? 's' : ''} executed` : `❌ Run failed — ${steps.filter(s => s.status === 'error').length} error(s)`;
      const stepHtml = steps.map(s => {
        const ic = s.status === 'ok' ? '✅' : s.status === 'error' ? '❌' : '⏭';
        const dur = s.durationMs ? ` <span style="color:#475569">${s.durationMs}ms</span>` : '';
        const action = s.action === 'navigate' ? '→' : s.action === 'click' ? '👆' : s.action === 'type' ? '⌨' : s.action === 'wait' ? '⏳' : s.action === 'screenshot' ? '📸' : '•';
        return `<div style="padding:6px 12px;border-top:1px solid rgba(255,255,255,0.04);font-size:11px;font-family:'Fira Code',monospace;color:#94a3b8">${ic} ${action} <span style="color:#e2e8f0">${esc(s.target || s.action)}</span>${dur}${s.message ? ` <span style="color:#f87171">${esc(s.message)}</span>` : ''}</div>`;
      }).join('');
      const shot = r.screenshot ? `<div style="padding:8px 12px;border-top:1px solid rgba(255,255,255,0.04)"><div style="font-size:10px;color:#64748b;margin-bottom:4px">📸 Screenshot:</div><img src="data:image/png;base64,${r.screenshot}" style="max-width:100%;border-radius:8px;border:1px solid rgba(255,255,255,0.08)"></div>` : '';
      const errLine = r.error ? `<div style="padding:8px 12px;border-top:1px solid rgba(255,255,255,0.04);font-size:11px;color:#f87171;font-family:'Fira Code',monospace">${esc(r.error)}</div>` : '';
      testPanel.style.background = bg;
      testPanel.style.border = `1px solid ${border}`;
      testPanel.innerHTML = `
        <div style="padding:10px 14px;display:flex;align-items:center;gap:10px">
          <span style="font-size:12px;font-weight:800;color:${ok ? '#4ade80' : '#f87171'}">${head}</span>
          <span style="font-size:10px;color:#64748b">${r.durationMs}ms</span>
          <div style="flex:1"></div>
          <button class="ds-btn ds-btn-sm ds-btn-ghost" id="cg-sb-close" style="padding:2px 8px">✕</button>
        </div>
        ${stepHtml}
        ${shot}
        ${errLine}`;
      testPanel.querySelector('#cg-sb-close').onclick = () => { testPanel.style.display = 'none'; };
    } catch (e) {
      testPanel.innerHTML = `<div style="padding:12px 14px;font-size:12px;color:#f87171">✗ ${esc(e.message || 'sandbox run failed')}</div>`;
    } finally {
      sbBtn.disabled = false; sbBtn.textContent = orig;
    }
  };
  overlay.querySelector('#cg-sandbox').onclick = () => runSandbox();

  overlay.querySelector('#cg-close').onclick = () => overlay.remove();
  overlay.querySelector('#cg-copy').onclick = async () => {
    try { await navigator.clipboard.writeText(currentCode);
      const btn = overlay.querySelector('#cg-copy');
      btn.textContent = '✓ Copied'; setTimeout(() => btn.textContent = '📋 Copy', 1500);
    } catch {}
  };
  overlay.querySelector('#cg-download').onclick = () => {
    const blob = new Blob([currentCode], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = wf.name.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40) + '.ts';
    a.click();
    URL.revokeObjectURL(url);
  };

  // AI edit function
  const runAiEdit = async (instruction) => {
    if (!instruction?.trim() || !api) return;
    const btn = overlay.querySelector('#cg-ai-send');
    btn.disabled = true;
    btn.textContent = '⏳ AI working…';
    statusEl.textContent = 'Sending to AI model (key hidden server-side)…';
    statusEl.style.color = '#94a3b8';
    try {
      const result = await api.aiEditCode({ code: currentCode, instruction });
      updateCode(result.code);
      statusEl.textContent = '✓ Code updated by AI';
      statusEl.style.color = '#4ade80';
      overlay.querySelector('#cg-ai-input').value = '';
    } catch (e) {
      statusEl.textContent = '✗ ' + (e.message || 'AI edit failed');
      statusEl.style.color = '#f87171';
    } finally {
      btn.disabled = false;
      btn.textContent = '⚡ Edit with AI';
    }
  };

  overlay.querySelector('#cg-ai-send').onclick = () => {
    runAiEdit(overlay.querySelector('#cg-ai-input').value);
  };
  overlay.querySelector('#cg-ai-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runAiEdit(e.target.value); }
  });
  // Quick action buttons
  overlay.querySelector('#cg-ai-err').onclick = () => runAiEdit('Add try/catch error handling around each automation step, with console.error logging the step that failed');
  overlay.querySelector('#cg-ai-ss').onclick = () => runAiEdit('Add page.screenshot() capture on any step failure, save to ./screenshots/ directory');
  overlay.querySelector('#cg-ai-retry').onclick = () => runAiEdit('Add retry logic: each locator action retries up to 3 times with 1 second between retries before failing');
}

// ── New Workflow overlay (replaces Chrome prompt) ─────────────────────────────
function showNewWorkflowOverlay(api, workflows, renderSidebar, openWorkflow) {
  const existing = document.getElementById('wf-new-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'wf-new-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.75);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center';

  overlay.innerHTML = `
    <div style="width:500px;max-height:80vh;display:flex;flex-direction:column;background:rgba(11,14,23,0.85);backdrop-filter:blur(20px);border:1px solid rgba(59,130,246,0.3);border-radius:16px;box-shadow:0 0 30px rgba(59,130,246,0.2),0 20px 60px rgba(0,0,0,0.6);padding:24px;color:#e2e8f0;font-family:inherit;font-size:13px;animation:sx-rec-pop .25s ease">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
        <span style="font-size:16px;font-weight:800;color:#d4d4d4">+ New Workflow</span>
      </div>
      <div style="font-size:11px;color:#64748b;margin-bottom:14px">Import a promoted recording as an editable workflow, or start blank.</div>
      <div id="wf-new-recs" style="flex:1;overflow-y:auto;max-height:300px;margin-bottom:12px">
        <div style="text-align:center;padding:20px;color:#64748b;font-size:12px">Loading recordings…</div>
      </div>
      <button class="ds-btn ds-btn-sm ds-btn-ghost" id="wf-new-blank" style="width:100%;padding:10px;border:1px dashed rgba(255,255,255,0.1);color:#94a3b8">+ Blank Workflow (empty canvas)</button>
      <button class="ds-btn ds-btn-sm ds-btn-ghost" id="wf-new-close" style="margin-top:8px;color:#64748b">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#wf-new-close').onclick = () => overlay.remove();
  overlay.querySelector('#wf-new-blank').onclick = async () => {
    try {
      const wf = await api.createWorkflow({ name: 'Untitled Workflow', nodes: [], edges: [] });
      workflows.unshift(wf);
      renderSidebar();
      openWorkflow(wf.id);
      overlay.remove();
    } catch (e) { alert('Could not create: ' + (e.message || e)); }
  };

  // Load promoted/draft recordings for import
  (async () => {
    try {
      const recordings = await api.listRecordings();
      const importable = recordings.filter(r => r.status === 'promoted' || r.status === 'draft' || r.status === 'reviewed');
      const container = overlay.querySelector('#wf-new-recs');
      if (importable.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:20px;color:#64748b;font-size:12px">No recordings ready to import. Record something first with Train AXIS.</div>';
        return;
      }
      container.innerHTML = importable.map(r => {
        const color = recColor(r.id);
        return `
          <div class="wf-new-rec-row" data-rec-id="${esc(r.id)}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);margin-bottom:6px;cursor:pointer;transition:border-color .12s">
            <span style="width:8px;height:8px;border-radius:50%;background:${color};flex:none"></span>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.label)}</div>
              <div style="font-size:10px;color:#64748b">${esc(r.marketplace)} · ${esc(String(r.step_count))} steps · ${esc(r.status)}</div>
            </div>
            <span style="font-size:11px;color:#d4d4d4;font-weight:700">Import →</span>
          </div>`;
      }).join('');

      container.querySelectorAll('.wf-new-rec-row').forEach(row => {
        row.onmouseenter = () => row.style.borderColor = 'rgba(255, 255, 255,0.3)';
        row.onmouseleave = () => row.style.borderColor = 'rgba(255,255,255,0.06)';
        row.onclick = async () => {
          try {
            const result = await api.promoteToWorkflow(row.dataset.recId);
            // Refresh workflow list + open the new one
            const freshWfs = await api.listWorkflows();
            workflows.length = 0;
            workflows.push(...freshWfs);
            renderSidebar();
            openWorkflow(result.workflow.id);
            overlay.remove();
          } catch (e) { alert('Import failed: ' + (e.message || e)); }
        };
      });
    } catch {
      overlay.querySelector('#wf-new-recs').innerHTML = '<div style="text-align:center;padding:20px;color:#f87171;font-size:12px">Could not load recordings.</div>';
    }
  })();
}

// ── Element Library ───────────────────────────────────────────────────────────

export async function renderDevElements({ api, render }) {
  render(devNavHtml('elements') + `<div class="ds-main" id="ds-main">${spinner()}</div>`);

  let elements = [];
  try { elements = await api.listElements(); } catch {}

  const main = document.getElementById('ds-main');
  if (!main) return;

  const TRUST_COLOR = { captured:'#64748b', test_passed:'#3b82f6', owner_verified:'#fbbf24', live_verified:'#4ade80', deprecated:'#475569', rejected:'#f87171' };
  const TRUST_LABEL = { captured:'Captured', test_passed:'Tested', owner_verified:'Verified', live_verified:'Live', deprecated:'Stale', rejected:'Rejected' };

  // ── Group elements by domain (marketplace + page_type) ────────────────
  // Elements on the same domain with similar tag/role are potential "copy-cats"
  // (ambiguous selectors). We compute match-count (1/N) for each.
  const domains = {};
  elements.forEach(el => {
    const key = `${el.marketplace || 'unknown'}::${el.page_type || el.url_pattern || 'page'}`;
    if (!domains[key]) domains[key] = { domain: el.marketplace || 'unknown', pageType: el.page_type || 'page', url: el.url_pattern || '', elements: [] };
    domains[key].elements.push(el);
  });

  // For each domain, compute copy-cat groups: elements sharing the same tag+role
  // are potential ambiguities (e.g. 4 "Buy Now" buttons = 1/4 confidence hit)
  Object.values(domains).forEach(d => {
    d.copyCatGroups = {};
    d.elements.forEach(el => {
      const sig = `${el.tag}:${el.role || ''}`;
      if (!d.copyCatGroups[sig]) d.copyCatGroups[sig] = [];
      d.copyCatGroups[sig].push(el);
    });
    // Flag elements that have >1 match (ambiguous selectors)
    d.elements.forEach(el => {
      const sig = `${el.tag}:${el.role || ''}`;
      el._matchCount = d.copyCatGroups[sig].length;
      el._ambiguous = el._matchCount > 1;
    });
    d.ambiguityCount = d.elements.filter(e => e._ambiguous).length;
  });

  const domainList = Object.values(domains).sort((a,b) => b.elements.length - a.elements.length);

  // ── Visual selector path (shows the DOM ancestry as a chain) ──────────
  const selectorPath = (el) => {
    const candidates = Array.isArray(el.locator_candidates) ? el.locator_candidates : [];
    if (!candidates.length) return '<span style="color:#475569">No locators captured</span>';
    // Show top 3 candidates as a visual chain
    return candidates.slice(0, 3).map((c, i) => {
      const conf = c.confidence ?? 0.5;
      const color = conf >= 0.8 ? '#4ade80' : conf >= 0.5 ? '#fbbf24' : '#f87171';
      const stratIcon = { 'role+name':'🎭', 'data-testid':'🏷', 'label':'📝', 'text':'💬', 'css':'⚙️', 'xpath':'🧭' }[c.strategy] || '📍';
      return `<div style="display:flex;align-items:center;gap:6px;padding:3px 0">
        <span style="font-size:9px;color:#475569;width:14px">${i+1}.</span>
        <span style="font-size:11px">${stratIcon}</span>
        <code style="font-size:10px;color:${color};background:rgba(0,0,0,.2);padding:1px 6px;border-radius:4px">${esc(c.strategy)}</code>
        <code style="font-size:10px;color:#94a3b8;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(String(c.value).slice(0, 50))}</code>
        <span style="font-size:9px;font-weight:700;color:${color}">${Math.round(conf * 100)}%</span>
      </div>`;
    }).join('<div style="margin-left:7px;border-left:1px dashed rgba(255,255,255,.08);height:3px"></div>');
  };

  const domainCard = (d) => {
    const total = d.elements.length;
    const ambig = d.ambiguityCount;
    const healthScore = total > 0 ? Math.round(((total - ambig) / total) * 100) : 100;
    const healthColor = healthScore >= 80 ? '#4ade80' : healthScore >= 50 ? '#fbbf24' : '#f87171';
    return `
      <div class="el-domain-card" style="background:var(--ds-card);border:1px solid var(--ds-border);border-radius:14px;overflow:hidden;margin-bottom:14px">
        <div class="el-domain-head" style="display:flex;align-items:center;gap:10px;padding:14px 18px;background:rgba(255,255,255,.02);border-bottom:1px solid var(--ds-border);cursor:pointer" data-domain-toggle>
          <span style="width:32px;height:32px;border-radius:8px;background:rgba(255, 255, 255,.1);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#d4d4d4">${esc((d.domain[0]||'?').toUpperCase())}</span>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700;color:var(--ds-t1)">${esc(d.domain)}</div>
            <div style="font-size:10px;color:var(--ds-t3)">${esc(d.pageType)} · ${esc(d.url.slice(0,60))}</div>
          </div>
          <div style="display:flex;gap:12px;align-items:center">
            <div style="text-align:center"><div style="font-size:16px;font-weight:800;color:var(--ds-t1)">${total}</div><div style="font-size:8px;color:var(--ds-t3);text-transform:uppercase">Elements</div></div>
            ${ambig > 0 ? `<div style="text-align:center"><div style="font-size:16px;font-weight:800;color:#f87171">${ambig}</div><div style="font-size:8px;color:var(--ds-t3);text-transform:uppercase">Ambiguous</div></div>` : ''}
            <div style="text-align:center"><div style="font-size:16px;font-weight:800;color:${healthColor}">${healthScore}%</div><div style="font-size:8px;color:var(--ds-t3);text-transform:uppercase">Health</div></div>
          </div>
          <svg class="el-chevron" style="width:14px;height:14px;color:var(--ds-t3);transition:transform .2s" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div class="el-domain-body" style="display:none;padding:12px 18px">
          ${d.elements.map(el => {
            const trustColor = TRUST_COLOR[el.trust_level] || '#475569';
            const conf = Number(el.confidence) || 0;
            const confColor = conf >= 0.8 ? '#4ade80' : conf >= 0.5 ? '#fbbf24' : '#f87171';
            return `<div class="el-element-row" style="padding:10px 0;border-top:1px solid rgba(255,255,255,.04)">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                ${el._ambiguous ? `<span class="ds-badge" style="--badge-c:#f87171;font-size:9px;background:rgba(248,113,113,.1);color:#f87171;border:1px solid rgba(248,113,113,.2)">${el._matchCount} matches</span>` : ''}
                <code style="font-size:10px;color:var(--ds-t2);background:rgba(255,255,255,.04);padding:1px 6px;border-radius:4px">&lt;${esc(el.tag)}&gt;</code>
                ${el.role ? `<span style="font-size:10px;color:var(--ds-t3)">role: ${esc(el.role)}</span>` : ''}
                <span style="font-size:11px;font-weight:600;color:var(--ds-t1);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(el.accessible_name || el.label || 'unnamed')}</span>
                <span style="font-size:10px;font-weight:700;color:${confColor}">${Math.round(conf * 100)}%</span>
                <span class="ds-badge" style="--badge-c:${trustColor};font-size:9px">${esc(TRUST_LABEL[el.trust_level] || el.trust_level)}</span>
              </div>
              <div class="el-selector-path" style="margin-left:8px">${selectorPath(el)}</div>
              ${el._ambiguous ? `<div style="margin-left:8px;margin-top:4px;font-size:10px;color:#f87171;line-height:1.4">⚠ <strong>${el._matchCount} elements</strong> on this page share the same tag+role. The recording may have captured an ambiguous selector. Consider using a more specific locator (data-testid, full XPath) or narrowing the scope.</div>` : ''}
              <div style="display:flex;gap:6px;margin-left:8px;margin-top:6px">
                ${el.trust_level === 'captured' || el.trust_level === 'test_passed' ? `<button class="ds-btn ds-btn-sm el-verify" data-el-id="${esc(el.id)}" style="font-size:10px;padding:3px 8px">✓ Verify</button>` : ''}
                <button class="ds-btn ds-btn-sm el-delete" data-el-id="${esc(el.id)}" style="background:rgba(239,68,68,.06);color:#f87171;border:1px solid rgba(239,68,68,.15);padding:3px 8px;font-size:10px">🗑</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  };

  // Overall stats
  const totalElements = elements.length;
  const totalAmbiguous = Object.values(domains).reduce((s, d) => s + d.ambiguityCount, 0);
  const totalDomains = domainList.length;
  const avgConfidence = totalElements > 0 ? Math.round(elements.reduce((s, e) => s + (Number(e.confidence) || 0), 0) / totalElements * 100) : 0;
  const verified = elements.filter(e => ['owner_verified','live_verified'].includes(e.trust_level)).length;

  main.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
      <h2 style="margin:0">Element Library</h2>
      <span style="font-size:11px;color:var(--ds-t3)">Visual memory of captured DOM elements, grouped by domain. Detects ambiguous selectors (copy-cats) that break automation.</span>
    </div>

    ${totalElements === 0 ? `
      <div class="ds-empty" style="padding:40px;text-align:center;border:1px dashed rgba(255,255,255,.08);border-radius:14px;margin-top:8px">
        <div style="font-size:32px;margin-bottom:12px;opacity:.4">🧩</div>
        <p style="font-size:13px;color:var(--ds-t2)">No elements captured yet.</p>
        <p style="font-size:12px;color:var(--ds-t3);margin-top:6px;line-height:1.6">Start a Teach Mode recording on a marketplace page.<br>Right-click → <strong>Syndrax → Capture Element</strong> to build the visual library.<br>Over time, the system learns which selectors are stable per domain.</p>
      </div>
    ` : `
      <div class="ds-grid" style="margin:14px 0 18px">
        ${statCard('Elements', totalElements, 'captured across all domains', '#3b82f6')}
        ${statCard('Domains', totalDomains, 'unique domain/page types', '#d4d4d4')}
        ${statCard('Ambiguous', totalAmbiguous, 'selectors with multiple matches', totalAmbiguous > 0 ? '#f87171' : '#4ade80')}
        ${statCard('Avg Confidence', avgConfidence + '%', `overall locator quality`, avgConfidence >= 70 ? '#4ade80' : avgConfidence >= 50 ? '#fbbf24' : '#f87171')}
      </div>

      ${totalAmbiguous > 0 ? `
        <div style="background:rgba(248,113,113,.06);border:1px solid rgba(248,113,113,.2);border-radius:12px;padding:12px 16px;margin-bottom:16px;font-size:12px;color:#fbbf24;line-height:1.5">
          ⚠ <strong>${totalAmbiguous} ambiguous selector${totalAmbiguous !== 1 ? 's' : ''} detected.</strong> These are elements that share the same tag+role on a page — the recording may have captured the wrong one. Click a domain below to see the full breakdown.
        </div>
      ` : ''}

      <div style="margin-bottom:6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--ds-t3)">Domain Map</div>
      ${domainList.map(domainCard).join('')}
    `} `;

  // Wire domain expand/collapse
  main.querySelectorAll('[data-domain-toggle]').forEach(head => {
    head.onclick = () => {
      const body = head.nextElementSibling;
      const chevron = head.querySelector('.el-chevron');
      const isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
    };
  });

  // Wire verify/delete
  main.querySelectorAll('.el-verify').forEach(btn => {
    btn.onclick = async () => {
      try { await api.patchElement(btn.dataset.elId, { trust_level: 'owner_verified' }); renderDevElements({ api, render }); } catch {}
    };
  });
  main.querySelectorAll('.el-delete').forEach(btn => {
    btn.onclick = async () => {
      try { await api.deleteElement(btn.dataset.elId); renderDevElements({ api, render }); } catch {}
    };
  });
}

// ── Evidence ──────────────────────────────────────────────────────────────────

export async function renderDevEvidence({ api, render }) {
  render(devNavHtml('evidence') +
    `<div class="ds-main" id="ds-main">${spinner()}</div>`);

  let jobs = [];
  try { jobs = await api.listJobs(); } catch {}

  const committed = jobs.filter(j => j.approved === true && j.metadata?.committed_sha);

  const main = document.getElementById('ds-main');
  if (!main) return;

  main.innerHTML = `
    <h2>Evidence Trail</h2>
    <p class="ds-page-desc">All approved and committed build jobs with their git SHAs — an immutable audit log of AI-generated changes.</p>
    ${committed.length ? card('Committed Builds',
      `<div class="ds-card-bd-flush"><table class="ds-table">
        <thead><tr><th>Job ID</th><th>SHA</th><th>Task</th><th>Committed</th></tr></thead>
        <tbody>
          ${committed.map(j => `<tr class="row-click" data-devjob="${esc(j.id)}">
            <td><code style="color:var(--ds-t2)">${j.id.slice(0, 8)}</code></td>
            <td><code class="c-green">${esc((j.metadata?.committed_sha || '').slice(0, 10))}</code></td>
            <td class="ds-tcell-prompt">${esc(j.prompt)}</td>
            <td class="c-t3">${relTime(j.updated_at)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>`,
      `${committed.length}`)
    : `<div class="ds-empty"><p>No committed builds yet.</p><p style="font-size:12px;color:var(--ds-t3)">Approve a successful build to see its evidence here.</p></div>`}`;
}

// ── Security ──────────────────────────────────────────────────────────────────

export async function renderDevSecurity({ render }) {
  // Kill switch status comes from server env; browser can only display what the
  // API returns. We show a static best-effort view and link to the audit log.
  const switches = [
    {
      name:    'DEV_STUDIO_ENABLED',
      desc:    'Master switch — disabling this blocks all /api/dev/* endpoints.',
      enabled: true,
    },
    {
      name:    'RUNNER_CLAIMS_ENABLED',
      desc:    'Allows the local runner to claim and execute pending jobs.',
      enabled: true,
    },
    {
      name:    'MODEL_EXECUTION_ENABLED',
      desc:    'Permits the runner to invoke any language model (Anthropic API / Hermes).',
      enabled: true,
    },
  ];

  const controls = [
    'All /api/dev/* routes require Cognito auth + server-side owner role check.',
    'Runner claims jobs via outbound HTTPS only — no inbound ports opened.',
    'Worktrees are isolated to the configured repository path.',
    'Commits require explicit owner approval via the web UI.',
    'Repair attempts are capped by max_repairs per job.',
    'Hermes (localhost:8000) is never called by the browser.',
  ];

  render(devNavHtml('security') + `
    <div class="ds-main">
      <h2>Security</h2>
      <p class="ds-page-desc">Kill switches and security controls for the Build Studio. Set environment variables on the Railway API service to toggle switches.</p>

      ${card('Kill Switches',
        `<div style="padding:0 4px">
          ${switches.map(sw => `<div class="ds-kill-switch">
            <div>
              <div class="ds-ks-name"><code>${esc(sw.name)}</code></div>
              <div class="ds-ks-desc">${esc(sw.desc)}</div>
            </div>
            <span class="ds-ks-badge ${sw.enabled ? 'ds-ks-on' : 'ds-ks-off'}">${sw.enabled ? 'ON' : 'OFF'}</span>
          </div>`).join('')}
        </div>
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--ds-border);font-size:12px;color:var(--ds-t3)">
          To disable a switch, set the variable to <code>false</code> or <code>0</code> in your Railway service environment, then redeploy.
        </div>`
      )}

      ${card('Security Controls',
        `<ul style="list-style:none;padding:0;margin:0;font-size:13px;color:var(--ds-t2)">
          ${controls.map(c => `<li style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.03);display:flex;gap:10px;align-items:flex-start">
            <span class="c-green" style="flex-shrink:0">&#10003;</span>
            <span>${esc(c)}</span>
          </li>`).join('')}
        </ul>`
      )}

      ${card('Audit Log',
        `<div style="font-size:13px;color:var(--ds-t2);line-height:1.8">
          <p style="margin:0 0 12px">All build approvals, commits, and rejections are recorded in the Evidence Trail.</p>
          <button class="ds-btn ds-btn-ghost ds-btn-sm" data-devview="evidence">View Evidence Trail &rarr;</button>
        </div>`
      )}
    </div>`);
}

// ── Dev Team management ───────────────────────────────────────────────────────

export async function renderDevTeam({ api, render }) {
  const nav = devNavHtml('team');
  render(`<div class="ds-shell">${nav}<div class="ds-main" id="ds-team-main">${spinner()}</div></div>`);

  let members = [];
  try { members = await api.listTeam(); } catch (e) {
    document.getElementById('ds-team-main').innerHTML =
      `<div class="ds-empty"><p class="c-red">Failed to load team: ${esc(e.message)}</p></div>`;
    return;
  }

  const ROLE_LABELS = { co_owner: 'Co-Owner', engineer: 'Engineer', prompt_engineer: 'Prompt Engineer' };
  const STATUS_COLORS = { pending: 'var(--ds-amber)', active: 'var(--ds-green)', suspended: 'var(--ds-red)' };

  function teamHtml() {
    const rows = members.length
      ? members.map(m => `
        <tr>
          <td style="color:var(--ds-t1)">${esc(m.display_name || m.member_email)}</td>
          <td style="color:var(--ds-t3);font-size:12px">${esc(m.member_email)}</td>
          <td>${esc(ROLE_LABELS[m.role] || m.role)}</td>
          <td><span class="ds-badge" style="--badge-c:${STATUS_COLORS[m.status] || 'var(--ds-t3)'}">${esc(m.status)}</span></td>
          <td style="color:var(--ds-t3);font-size:12px">${relTime(m.accepted_at || m.created_at)}</td>
          <td>
            <div style="display:flex;gap:6px">
              ${m.status === 'active'
                ? `<button class="ds-btn ds-btn-ghost ds-btn-sm" data-team-suspend="${esc(m.id)}">Suspend</button>`
                : m.status === 'suspended'
                  ? `<button class="ds-btn ds-btn-primary ds-btn-sm" data-team-activate="${esc(m.id)}">Reactivate</button>`
                  : ''}
              <button class="ds-btn ds-btn-danger ds-btn-sm" data-team-remove="${esc(m.id)}" data-team-email="${esc(m.member_email)}">Remove</button>
            </div>
          </td>
        </tr>`).join('')
      : `<tr><td colspan="6"><div class="ds-empty"><p>No team members yet. Invite your first engineer below.</p></div></td></tr>`;

    return `
      <h2>Team Access</h2>
      <p class="ds-page-desc">
        Invite co-owners, engineers, and prompt engineers to access Dev Studio.
        They sign in with their own Syndrax account — owner operations (runner pairing, code commits) remain owner-only.
      </p>

      <div class="ds-banner" style="background:rgba(99,102,241,.07);border-color:rgba(99,102,241,.25);margin-bottom:20px">
        <span class="ds-banner-icon">&#128640;</span>
        <div style="flex:1">
          <strong style="color:var(--ds-t1)">One-click launcher</strong>
          <div style="color:var(--ds-t2);font-size:12px;margin-top:2px">
            Share <code style="color:var(--ds-blue);font-size:11px">SyndraxDevStudio.ps1</code> with team members so they can start Dev Studio with a double-click — no CLI required.
          </div>
        </div>
        <button class="ds-btn ds-btn-ghost ds-btn-sm" id="ds-team-dl-launcher">&#11015; Download Launcher</button>
      </div>

      ${card('Invite New Member', `
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
          <div class="ds-field" style="flex:1;min-width:200px;margin-bottom:0">
            <label class="ds-label">Email</label>
            <input class="ds-input" id="team-invite-email" placeholder="engineer@example.com" type="email" autocomplete="email">
          </div>
          <div class="ds-field" style="margin-bottom:0">
            <label class="ds-label">Role</label>
            <select class="ds-select" id="team-invite-role">
              <option value="co_owner">Co-Owner (full dev access)</option>
              <option value="engineer">Engineer</option>
              <option value="prompt_engineer">Prompt Engineer</option>
            </select>
          </div>
          <div class="ds-field" style="min-width:180px;margin-bottom:0">
            <label class="ds-label">Name (optional)</label>
            <input class="ds-input" id="team-invite-name" placeholder="Alex Chen" type="text">
          </div>
          <button class="ds-btn ds-btn-primary" id="team-invite-btn">Send Invite</button>
        </div>
        <div id="team-invite-result" style="margin-top:12px;font-size:12px;color:var(--ds-t3)"></div>
      `)}

      ${card('Team Members', `
        <div class="ds-card-bd-flush">
          <table class="ds-table">
            <thead><tr>
              <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th>
            </tr></thead>
            <tbody id="team-table-body">${rows}</tbody>
          </table>
        </div>
      `, members.length)}`;
  }

  const el = document.getElementById('ds-team-main');
  el.innerHTML = teamHtml();

  // Launcher download button (authenticated)
  const teamDlBtn = document.getElementById('ds-team-dl-launcher');
  if (teamDlBtn && api.downloadLauncher) {
    teamDlBtn.onclick = async () => {
      teamDlBtn.disabled = true; teamDlBtn.textContent = 'Downloading…';
      try {
        await api.downloadLauncher();
        teamDlBtn.textContent = '✓ Downloaded';
        setTimeout(() => { teamDlBtn.disabled = false; teamDlBtn.innerHTML = '&#11015; Download Launcher'; }, 3000);
      } catch (e) {
        teamDlBtn.disabled = false; teamDlBtn.innerHTML = '&#11015; Download Launcher';
        alert('Download failed: ' + e.message);
      }
    };
  }

  // Invite handler
  const inviteBtn = document.getElementById('team-invite-btn');
  if (inviteBtn) {
    inviteBtn.onclick = async () => {
      const email = document.getElementById('team-invite-email')?.value?.trim();
      const role  = document.getElementById('team-invite-role')?.value;
      const name  = document.getElementById('team-invite-name')?.value?.trim();
      const res   = document.getElementById('team-invite-result');
      if (!email) { res.innerHTML = '<span class="c-red">Email is required.</span>'; return; }
      inviteBtn.disabled = true;
      res.innerHTML = 'Sending&hellip;';
      try {
        const r = await api.inviteTeam({ member_email: email, role, display_name: name || undefined });
        res.innerHTML = `<span class="c-green">&#10003; Invite sent!</span>
          <div style="margin-top:8px;background:var(--ds-surf);border:1px solid var(--ds-border);border-radius:6px;padding:8px 12px;font-family:monospace;font-size:11px;word-break:break-all;color:var(--ds-t2)">
            <strong style="color:var(--ds-t3);display:block;margin-bottom:4px">Share this URL with ${esc(email)}:</strong>
            ${esc(r.invite_url)}
          </div>`;
        // Refresh member list
        members = await api.listTeam();
        document.getElementById('team-table-body').innerHTML =
          members.map(m => `<tr><td colspan="6" style="color:var(--ds-t2)">${esc(m.member_email)} — ${esc(m.status)}</td></tr>`).join('');
        document.getElementById('team-invite-email').value = '';
        document.getElementById('team-invite-name').value = '';
      } catch (e) {
        res.innerHTML = `<span class="c-red">Error: ${esc(e.message)}</span>`;
      } finally {
        inviteBtn.disabled = false;
      }
    };
  }

  // Suspend / activate / remove
  document.querySelectorAll('[data-team-suspend]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Suspend this team member?')) return;
      try {
        await api.patchTeamMember(btn.dataset.teamSuspend, { status: 'suspended' });
        members = await api.listTeam();
        el.innerHTML = teamHtml();
      } catch (e) { alert('Error: ' + e.message); }
    };
  });
  document.querySelectorAll('[data-team-activate]').forEach(btn => {
    btn.onclick = async () => {
      try {
        await api.patchTeamMember(btn.dataset.teamActivate, { status: 'active' });
        members = await api.listTeam();
        el.innerHTML = teamHtml();
      } catch (e) { alert('Error: ' + e.message); }
    };
  });
  document.querySelectorAll('[data-team-remove]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm(`Remove ${btn.dataset.teamEmail} from the team?`)) return;
      try {
        await api.removeTeamMember(btn.dataset.teamRemove);
        members = await api.listTeam();
        el.innerHTML = teamHtml();
      } catch (e) { alert('Error: ' + e.message); }
    };
  });
}

// ── One-page focus view ───────────────────────────────────────────────────────
// Consolidates the core dev workflow onto a single scrolling page: status, the
// element-capture / location-memory library (with deterministic TypeScript
// generation), and recent builds. Deeper management stays in the sidebar nav.

const TRUST_COLOR = {
  captured:       'var(--ds-t3)',
  test_passed:    'var(--ds-blue)',
  owner_verified: 'var(--ds-amber)',
  live_verified:  'var(--ds-green)',
  deprecated:     'var(--ds-t3)',
  rejected:       'var(--ds-red)',
};

// Deterministic Playwright/TypeScript snippet from a captured element's best
// locator. No model involved — pure templating, safe to run in the browser.
// Hermes (AI) refinement is layered on top of this in a later step.
export function elementToTsSnippet(el) {
  const candidates = Array.isArray(el.locator_candidates) ? el.locator_candidates : [];
  const best = candidates[0];
  const sel  = best ? String(best.value) : '';
  const tag  = String(el.tag || '').toLowerCase();
  const fnName = (String(el.label || 'element').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'element');

  let locator;
  if (best && best.strategy === 'xpath')      locator = `page.locator(${JSON.stringify('xpath=' + sel)})`;
  else if (best && best.strategy === 'text')  locator = `page.getByText(${JSON.stringify(sel)})`;
  else                                        locator = `page.locator(${JSON.stringify(sel)})`;

  const typesValue = tag === 'input' || tag === 'textarea' || tag === 'select';
  let action;
  if (tag === 'select')                       action = `await ${locator}.selectOption(value);`;
  else if (tag === 'input' || tag === 'textarea') action = `await ${locator}.fill(value);`;
  else                                        action = `await ${locator}.click();`;

  return `import type { Page } from 'playwright';\n\n`
    + `// ${el.label || 'element'} — ${el.marketplace || 'site'} (trust: ${el.trust_level || 'captured'})\n`
    + `export async function ${fnName}(page: Page${typesValue ? ', value: string' : ''}) {\n`
    + `  ${action}\n`
    + `}`;
}

function focusElementsTable(elements) {
  if (!elements || !elements.length) {
    return `<div class="ds-empty">
      <p>No location memories yet.</p>
      <p style="font-size:12px;color:var(--ds-t3)">Right-click a button or text box on a marketplace page and choose<br><strong>Syndrax &rarr; Capture element</strong> to save it here.</p>
    </div>`;
  }
  return `<div class="ds-card-bd-flush"><table class="ds-table">
    <thead><tr><th>Label</th><th>Tag</th><th>Site</th><th>Best Locator</th><th>Trust</th><th></th></tr></thead>
    <tbody>${elements.map(el => {
      const candidates = Array.isArray(el.locator_candidates) ? el.locator_candidates : [];
      const best = candidates[0];
      const trustColor = TRUST_COLOR[el.trust_level] || 'var(--ds-t3)';
      return `<tr data-el-row="${esc(el.id)}">
          <td>${esc(el.label)}</td>
          <td><code style="color:var(--ds-t2)">${esc(el.tag)}</code></td>
          <td>${esc(el.marketplace || '—')}</td>
          <td><code style="font-size:11px;color:var(--ds-t1)">${best ? esc(best.strategy + ': ' + String(best.value).slice(0, 46)) : '—'}</code></td>
          <td><span class="ds-badge" style="--badge-c:${trustColor}">${esc(el.trust_level)}</span></td>
          <td><div style="display:flex;gap:6px;justify-content:flex-end">
            <button class="ds-btn ds-btn-sm el-ts" data-el-id="${esc(el.id)}">TS</button>
            ${(el.trust_level === 'captured' || el.trust_level === 'test_passed')
              ? `<button class="ds-btn ds-btn-sm el-verify" data-el-id="${esc(el.id)}">Verify</button>` : ''}
            <button class="ds-btn ds-btn-sm ds-btn-danger el-delete" data-el-id="${esc(el.id)}" title="Delete element">🗑</button>
          </div></td>
        </tr>
        <tr class="el-ts-row" data-el-ts="${esc(el.id)}" style="display:none"><td colspan="6">
          <div style="position:relative">
            <pre id="el-ts-${esc(el.id)}" style="background:#0d0f17;border:1px solid var(--ds-border);border-radius:8px;padding:12px;margin:0;font-size:12px;line-height:1.5;color:var(--ds-green);overflow:auto;white-space:pre">${esc(elementToTsSnippet(el))}</pre>
            <button class="ds-btn ds-btn-sm el-ts-copy" data-el-id="${esc(el.id)}" style="position:absolute;top:8px;right:8px">Copy</button>
          </div>
        </td></tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

export async function renderDevFocus({ api, render, navigate }) {
  render(devNavHtml('focus') + `<div class="ds-main" id="ds-main">${spinner()}</div>`);
  const main = document.getElementById('ds-main');
  if (!main) return;

  const [runner, jobs, elements, recordings] = await Promise.all([
    api.runnerStatus().catch(() => null),
    api.listJobs().catch(() => []),
    api.listElements().catch(() => []),
    api.listRecordings().catch(() => []),
  ]);

  const runnerOnline = runner?.connected === true;
  const els          = elements || [];
  const recentJobs   = (jobs || []).slice(0, 5);
  const verified     = els.filter(e => e.trust_level === 'owner_verified' || e.trust_level === 'live_verified').length;

  main.innerHTML = `
    <h2>Dev Studio</h2>
    <p class="ds-page-desc">Your one-page automation workbench — capture elements on any site, turn them into typed automation, and ship builds.</p>

    <div class="ds-grid">
      ${statCard('Runner',     runnerOnline ? 'Online' : 'Offline', runnerOnline ? 'this PC connected' : 'start the launcher', runnerOnline ? 'var(--ds-green)' : 'var(--ds-t3)')}
      ${statCard('Memories',   els.length,            `${verified} verified`,    '')}
      ${statCard('Recordings', (recordings || []).length, 'teach-mode sessions', '')}
      ${statCard('Builds',     (jobs || []).length,   'total jobs',              '')}
    </div>

    ${card('Capture an element', `
      <div style="font-size:13px;color:var(--ds-t2);line-height:1.7">
        <p style="margin:0 0 10px">Right-click any button or text box on a marketplace page and choose
        <strong style="color:var(--ds-t1)">Syndrax &rarr; Capture element</strong>. It is saved below as a reusable
        <em>location memory</em>, and Hermes can turn it into TypeScript automation.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="ds-btn ds-btn-primary ds-btn-sm" data-devview="builder">New Build with Hermes</button>
          <button class="ds-btn ds-btn-ghost ds-btn-sm" data-devview="recordings">Teach Mode Recordings</button>
          <button class="ds-btn ds-btn-ghost ds-btn-sm" data-devview="runners">This PC &amp; Runner</button>
        </div>
      </div>`)}

    ${card('Location Memories', focusElementsTable(els), `${els.length}`)}

    ${card('Recent Builds', recentJobs.length
      ? `<div class="ds-card-bd-flush"><table class="ds-table">
          <thead><tr><th>ID</th><th>Status</th><th>Task</th><th>When</th></tr></thead>
          <tbody>${recentJobs.map(j => `<tr class="row-click" data-devjob="${esc(j.id)}">
            <td><code style="color:var(--ds-t2)">${String(j.id).slice(0, 8)}</code></td>
            <td>${statusBadge(j.status)}</td>
            <td class="ds-tcell-prompt">${esc(j.prompt || '')}</td>
            <td class="c-t3">${relTime(j.created_at || j.updated_at)}</td>
          </tr>`).join('')}</tbody>
        </table></div>`
      : `<div class="ds-empty"><p>No builds yet.</p><p style="font-size:12px;color:var(--ds-t3)">Start one from <strong>New Build</strong> above.</p></div>`,
      recentJobs.length ? `${recentJobs.length}` : null)}
  `;

  // Element row actions
  main.querySelectorAll('.el-ts').forEach(btn => btn.onclick = () => {
    const row = main.querySelector(`[data-el-ts="${btn.dataset.elId}"]`);
    if (row) row.style.display = row.style.display === 'none' ? '' : 'none';
  });
  main.querySelectorAll('.el-ts-copy').forEach(btn => btn.onclick = async () => {
    const pre = document.getElementById('el-ts-' + btn.dataset.elId);
    if (pre && navigator.clipboard) {
      try { await navigator.clipboard.writeText(pre.textContent); btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = 'Copy'), 1200); } catch {}
    }
  });
  main.querySelectorAll('.el-verify').forEach(btn => btn.onclick = async () => {
    try { await api.patchElement(btn.dataset.elId, { trust_level: 'owner_verified' }); renderDevFocus({ api, render, navigate }); } catch {}
  });
  main.querySelectorAll('.el-delete').forEach(btn => btn.onclick = async () => {
    try { await api.deleteElement(btn.dataset.elId); renderDevFocus({ api, render, navigate }); } catch {}
  });

  // Nav + job-row clicks (added after render(), so wire them here)
  main.querySelectorAll('[data-devview]').forEach(b => b.onclick = () => navigate(b.dataset.devview));
  main.querySelectorAll('[data-devjob]').forEach(b => b.onclick = () => navigate('job', b.dataset.devjob));
}

// ── Top-level dispatcher ──────────────────────────────────────────────────────

export async function renderDeveloper({ api, getOwnerStatus, render, devView, devJobId, navigate }) {
  injectDevStyles();

  // Server-side authorization: call /api/dev/whoami.
  // This is the real gate — frontend state is UX only.
  const status = await getOwnerStatus();
  if (status.unauthenticated) { render(devLoginRedirectHtml()); return; }
  if (!status.authorized)     { render(devAccessDeniedHtml()); return; }

  function innerRender(html) {
    render(`<div class="ds-shell">${html}</div>`);
    // Wire up nav clicks
    document.querySelectorAll('[data-devview]').forEach(b => {
      b.onclick = () => navigate(b.dataset.devview);
    });
    // Wire up job row clicks
    document.querySelectorAll('[data-devjob]').forEach(b => {
      b.onclick = () => navigate('job', b.dataset.devjob);
    });
  }

  const view = devView || 'focus';

  if (view === 'job' && devJobId) {
    return renderDevJobDetail({
      api,
      jobId:     devJobId,
      render:    innerRender,
      onApprove: async (id, approved) => {
        await api.approveJob(id, { approved });
        navigate('jobs');
      },
      onDelete: async (id) => {
        await api.deleteJob(id);
        navigate('jobs');
      },
    });
  }

  // Accept invite from URL param (?accept_invite=<token>)
  const acceptToken = typeof location !== 'undefined'
    ? new URLSearchParams(location.search).get('accept_invite')
    : null;
  if (acceptToken) {
    innerRender(`<div class="ds-main">${spinner()}<p style="text-align:center;color:var(--ds-t3);font-size:13px;margin-top:8px">Accepting your Dev Studio invite&hellip;</p></div>`);
    try {
      const r = await api.acceptInvite(acceptToken);
      innerRender(`<div class="ds-main"><div class="ds-wizard" style="max-width:560px">
        <div style="font-size:40px;margin-bottom:12px">&#127881;</div>
        <h3>Welcome to the team!</h3>
        <p>You now have <strong>${esc(r.role || 'Dev Studio')}</strong> access to Syndrax Dev Studio.</p>
        <div style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.25);border-radius:10px;padding:16px 20px;margin:18px 0;text-align:left">
          <div style="font-size:13px;font-weight:700;color:var(--ds-t1);margin-bottom:6px">&#128640; Step 1 — Download the Launcher</div>
          <div style="font-size:12px;color:var(--ds-t2);margin-bottom:12px">
            The launcher starts all Dev Studio services with a double-click — no terminal commands needed.
            It will ask for your repo folder paths the first time you run it.
          </div>
          <button class="ds-btn ds-btn-primary" id="ds-accept-dl">&#11015; Download SyndraxDevStudio.ps1</button>
          <div id="ds-accept-dl-msg" style="margin-top:8px;font-size:12px;color:var(--ds-t3)"></div>
        </div>
        <div style="background:rgba(255,255,255,.04);border:1px solid var(--ds-border);border-radius:10px;padding:14px 18px;text-align:left;font-size:12px;color:var(--ds-t2)">
          <div style="font-weight:700;color:var(--ds-t1);margin-bottom:6px">&#128221; Step 2 — Run it</div>
          <ol style="margin:0;padding-left:18px;line-height:1.9">
            <li>Move the downloaded <code style="color:var(--ds-blue)">.ps1</code> file anywhere convenient</li>
            <li>Right-click &rarr; <strong>Run with PowerShell</strong></li>
            <li>If Windows blocks it: right-click &rarr; Properties &rarr; Unblock &rarr; OK</li>
            <li>On first run it will ask for your repo paths, then remember them</li>
          </ol>
        </div>
        <div class="ds-wizard-actions" style="margin-top:20px">
          <button class="ds-btn ds-btn-ghost" onclick="history.replaceState(null,'',location.pathname);window.dispatchEvent(new Event('popstate'))">Open Dev Studio &rarr;</button>
        </div>
      </div></div>`);

      // Wire download button in the acceptance card
      const dlBtn = document.getElementById('ds-accept-dl');
      const dlMsg = document.getElementById('ds-accept-dl-msg');
      if (dlBtn && api.downloadLauncher) {
        dlBtn.onclick = async () => {
          dlBtn.disabled = true; dlBtn.textContent = 'Downloading…';
          try {
            await api.downloadLauncher();
            dlBtn.textContent = '✓ Saved! See your Downloads folder.';
            dlMsg.innerHTML = 'File is personalized to your account and includes setup instructions at the top.';
          } catch (e) {
            dlBtn.disabled = false; dlBtn.innerHTML = '&#11015; Download SyndraxDevStudio.ps1';
            dlMsg.innerHTML = `<span style="color:var(--ds-red)">Error: ${esc(e.message)}</span>`;
          }
        };
      }
    } catch (e) {
      innerRender(`<div class="ds-main"><div class="ds-wizard">
        <div style="font-size:36px;margin-bottom:12px">&#128683;</div>
        <h3>Invite not found</h3>
        <p>${esc(e.message || 'This invite link may have already been used or has expired.')}<br>Ask the owner to send a new invite.</p>
      </div></div>`);
    }
    return;
  }

  const dispatchers = {
    focus:          () => renderDevFocus({ api, render: innerRender, navigate }),
    overview:       () => renderDevOverview({ api, render: innerRender }),
    builder:        () => renderDevBuilder({ render: innerRender, onSubmit: (body) => api.createJob(body) }),
    jobs:           () => renderDevJobs({ api, render: innerRender, onSelect: (id) => navigate('job', id) }),
    runners:        () => renderDevRunners({ api, render: innerRender }),
    models:         () => renderDevModels({ render: innerRender }),
    memory:         () => renderDevMemory({ api, render: innerRender }),
    evaluations:    () => renderDevEvaluations({ api, render: innerRender }),
    'repair-cases': () => renderDevRepairCases({ api, render: innerRender }),
    workflows:      () => renderDevWorkflows({ api, render: innerRender }),
    recordings:     () => renderDevRecordings({ api, render: innerRender }),
    elements:       () => renderDevElements({ api, render: innerRender }),
    'captcha-lab':  () => renderDevCaptchaLab({ render: innerRender, navHtml: devNavHtml }),
    evidence:       () => renderDevEvidence({ api, render: innerRender }),
    security:       () => renderDevSecurity({ render: innerRender }),
    team:           () => renderDevTeam({ api, render: innerRender }),
  };

  await (dispatchers[view] || dispatchers.overview)();
}

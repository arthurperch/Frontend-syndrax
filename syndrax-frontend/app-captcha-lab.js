// app-captcha-lab.js — Captcha Lab (Developer tab). Offline replica of the eBay
// hCaptcha "Security Measure" page using the EXACT splashui DOM, plus a lab-only
// "solver software" that mirrors the real hcaptcha-challenger flow
// (div#checkbox -> .challenge-view -> 9x .task-image -> boolean matrix -> bezier
// tile clicks -> token). No live eBay / hCaptcha endpoints are ever called.

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

// Sub-tabs inside the Captcha Lab. Only eBay hCaptcha for now; structured to add more.
const SUBTABS = [
  { id: 'ebay-hcaptcha', label: 'eBay hCaptcha' }
];

// The single lab definition. 3x3 tile "kinds"; the target kind is the answer set.
const LAB = {
  id: 'ebay-hcaptcha',
  vendor: 'hCaptcha',
  sitekey: '195eeb9f-8f50-4a9c-abfc-a78ceaa3cdde',
  requestType: 'image_label_binary',
  promptLead: 'Please click each image containing a',
  promptTarget: 'bicycle',
  targetCategory: 'bicycle',
  grid: []
};

// Global stats + cycle control
let _solved = 0, _failed = 0, _started = true;

function updateStats() {
  const total = _solved + _failed;
  const rate = total > 0 ? Math.round((_solved / total) * 100) : 0;
  const el = document.getElementById('clab-stats');
  if (el) {
    el.innerHTML = `<span style="color:#34d399">✓ ${_solved}</span> &nbsp;
      <span style="color:#f87171">✗ ${_failed}</span> &nbsp;
      <span style="color:${rate >= 50 ? '#34d399' : '#f87171'}">${rate}%</span>`;
  }
}

// Real captcha categories — mapped to local PNG assets from the hcaptcha-challenger archive
// Only photographic categories — synthetic/symbolic tiles removed (Gemini can't classify them)
const CATEGORIES = [
  { id: 'bicycle',        label: 'bicycle' },
  { id: 'streetlamp',     label: 'streetlamp' },
  { id: 'elephant',       label: 'elephant' },
  { id: 'raccoon',        label: 'raccoon' },
  { id: 'rabbit',         label: 'rabbit' },
  { id: 'diamond_bracelet', label: 'diamond bracelet' },
  { id: 'off_road_vehicle', label: 'off-road vehicle' },
  { id: 'animal_head',    label: 'animal head' },
  { id: 'hedgehog',       label: 'hedgehog' },
  { id: 'polar_bear',     label: 'polar bear' },
  { id: 'zebra',          label: 'zebra' },
  { id: 'star_bricks',    label: 'star bricks' },
];

// Manifest loader — loads local PNG asset paths
const MANIFEST_URL = '/assets/captcha/manifest.json';
let _manifest = null, _manifestReady = null;
async function loadManifest() {
  if (_manifest) return _manifest;
  if (_manifestReady) return _manifestReady;
  _manifestReady = fetch(MANIFEST_URL).then(r => r.json()).then(j => { _manifest = j; _manifestReady = null; return j; });
  return _manifestReady;
}

// Pick a random category from the manifest — exclude synthetic/symbolic ones
function randomCategory() {
  const exclude = ['number', 'appears_once', 'same_color_circle', 'never_repeated', 'image_description', 'unique_object']; // synthetic — Gemini can't classify
  const cats = _manifest ? Object.keys(_manifest.categories).filter(c => !exclude.includes(c)) : CATEGORIES.map(c => c.id);
  const id = cats[Math.floor(Math.random() * cats.length)];
  return { id, label: id.replace(/_/g, ' ') };
}

// Build a 3x3 grid from local PNG assets — target tiles + distractors from other categories
function buildGrid(targetCat) {
  if (!_manifest) return [];
  const cats = Object.keys(_manifest.categories);
  const targetLabel = targetCat.replace(/_/g, ' ');
  const targets = (_manifest.categories[targetCat] || []).slice(0, 9);
  const distPool = cats.filter(c => c !== targetCat).flatMap(c => (_manifest.categories[c] || []).slice(0, 2));
  const nTarget = Math.min(targets.length, Math.ceil(9 * 0.44));
  const grid = [];
  for (let i = 0; i < nTarget; i++) grid.push({ path: targets[i], isTarget: true });
  for (let i = 0; grid.length < 9 && i < distPool.length; i++) grid.push({ path: distPool[i], isTarget: false });
  while (grid.length < 9) grid.push({ path: targets[0], isTarget: true });
  for (let i = grid.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [grid[i], grid[j]] = [grid[j], grid[i]]; }
  return grid;
}

function labQuery(next) {
  const sp = new URLSearchParams(location.search || '');
  sp.set('tab', 'developer');
  sp.set('view', 'captcha-lab');
  Object.keys(next || {}).forEach(k => {
    const v = next[k];
    if (v == null || v === '') sp.delete(k); else sp.set(k, v);
  });
  return '?' + sp.toString();
}

function setParams(next, rerender) {
  history.pushState({}, '', labQuery(next));
  rerender();
}

function promptText(lab) {
  return lab.promptTarget ? lab.promptLead + ' ' + lab.promptTarget : lab.promptLead;
}

// ── Deterministic tile art (no external image fetches in the lab) ─────────────
function tileSvg(kind, variant) {
  const bg = ['#dbeafe', '#dcfce7', '#fef3c7', '#fee2e2', '#ede9fe'][variant % 5];
  const sky = '<rect width="120" height="120" fill="' + bg + '"/><rect y="76" width="120" height="44" fill="#cbd5e1" opacity=".55"/>';
  const shapes = {
    traffic: '<rect x="50" y="17" width="20" height="64" rx="8" fill="#1f2937"/><circle cx="60" cy="31" r="7" fill="#ef4444"/><circle cx="60" cy="50" r="7" fill="#f59e0b"/><circle cx="60" cy="69" r="7" fill="#22c55e"/><rect x="57" y="82" width="6" height="27" fill="#374151"/>',
    bridge: '<path d="M12 77 C31 33,89 33,108 77" fill="none" stroke="#475569" stroke-width="9"/><path d="M18 78 H102" stroke="#334155" stroke-width="8"/><path d="M34 75 V52 M50 75 V43 M70 75 V43 M86 75 V52" stroke="#64748b" stroke-width="4"/>',
    bus: '<rect x="18" y="42" width="84" height="42" rx="8" fill="#facc15" stroke="#a16207" stroke-width="3"/><rect x="27" y="49" width="16" height="14" fill="#bfdbfe"/><rect x="48" y="49" width="16" height="14" fill="#bfdbfe"/><rect x="69" y="49" width="16" height="14" fill="#bfdbfe"/><circle cx="37" cy="87" r="8" fill="#111827"/><circle cx="83" cy="87" r="8" fill="#111827"/>',
    crosswalk: '<rect width="120" height="120" fill="#94a3b8"/><path d="M11 98 L47 18 M32 104 L68 18 M55 104 L91 18 M78 104 L114 18" stroke="#f8fafc" stroke-width="11"/>',
    palm: '<rect width="120" height="120" fill="#bae6fd"/><path d="M62 105 C56 82,58 59,65 35" stroke="#92400e" stroke-width="9" fill="none"/><path d="M65 35 C39 23,22 29,12 43 M65 35 C49 12,29 9,17 17 M65 35 C81 11,101 10,111 21 M65 35 C92 25,109 33,116 48 M65 35 C58 16,65 7,78 4" stroke="#15803d" stroke-width="9" stroke-linecap="round" fill="none"/>',
    stairs: '<rect width="120" height="120" fill="#e5e7eb"/><path d="M18 92 H40 V76 H61 V60 H82 V44 H104" fill="none" stroke="#475569" stroke-width="12" stroke-linejoin="round"/><path d="M18 102 H112" stroke="#64748b" stroke-width="5"/>',
    boat: '<rect width="120" height="120" fill="#bfdbfe"/><path d="M20 79 H104 L91 96 H34 Z" fill="#f97316" stroke="#9a3412" stroke-width="3"/><path d="M56 28 V75" stroke="#374151" stroke-width="4"/><path d="M59 32 L91 70 H59 Z" fill="#fff" stroke="#94a3b8" stroke-width="2"/><path d="M8 101 C27 93,42 109,61 101 C80 93,95 109,114 101" fill="none" stroke="#2563eb" stroke-width="5"/>'
  };
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' + sky + (shapes[kind] || shapes.bridge) + '</svg>';
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

// ── Lab chrome styles (the eBay/hCaptcha look comes from inline rules below) ──
function ensureStyles() {
  if (document.getElementById('captcha-lab-styles')) return;
  const s = document.createElement('style');
  s.id = 'captcha-lab-styles';
  s.textContent = [
    '.clab-subnav{display:flex;gap:8px;border-bottom:1px solid var(--ds-border);margin:-8px 0 18px;padding-bottom:10px}',
    '.clab-subnav button{background:transparent;border:1px solid var(--ds-border);color:var(--ds-t2);border-radius:8px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer}',
    '.clab-subnav button.active{background:rgba(255,255,255,.12);color:#d4d4d4;border-color:rgba(255,255,255,.35)}',
    '.clab-intro{color:var(--ds-t2);font-size:13px;line-height:1.7;max-width:780px;margin:0 0 16px}',
    '.clab-stage{border:1px solid var(--ds-border);border-radius:14px;overflow:hidden;background:#f5f5f5;position:relative}',
    '.clab-bar{display:flex;align-items:center;gap:12px;padding:9px 14px;background:#111827;color:#e5e7eb}',
    '.clab-bar strong{color:#e5e5e5}.clab-bar small{color:#94a3b8}.clab-bar .clab-solve{margin-left:auto}',
    '.clab-solve{background:linear-gradient(95deg,#3b82f6,#d4d4d4);color:#0b0e17;border:0;border-radius:7px;padding:7px 14px;font-size:12px;font-weight:800;cursor:pointer}',
    '.clab-solve:disabled{opacity:.5;cursor:not-allowed}',
    '.clab-reset{background:transparent;border:1px solid #334155;color:#cbd5e1;border-radius:7px;padding:7px 12px;font-size:12px;cursor:pointer}',
    '.clab-toggle{display:flex;align-items:center;gap:6px;color:#94a3b8;font-size:12px;cursor:pointer;user-select:none}',
    '.clab-toggle input{accent-color:#d4d4d4;width:16px;height:16px}',
    '.clab-fs{background:transparent;border:1px solid #334155;color:#cbd5e1;border-radius:7px;padding:7px 12px;font-size:12px;cursor:pointer}',
    '.clab-fs:hover{border-color:#d4d4d4;color:#e5e5e5}',
    '.clab-startstop{background:transparent;border:1px solid #334155;color:#cbd5e1;border-radius:7px;padding:7px 12px;font-size:12px;cursor:pointer}',
    '.clab-stage.clab-fullscreen{position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;overflow:auto;background:#0f1119;border-radius:0;border:0}',
    '.clab-stage.clab-fullscreen .clab-bar{position:sticky;top:0;z-index:10}',
    '.clab-stage.clab-fullscreen .cap-no-touch{min-height:calc(100vh - 48px)}',
    /* eBay splashui shell */
    '.cap-no-touch{background:#fff;color:#333;font-family:Arial,Helvetica,sans-serif;min-height:620px}',
    '.cap-gh{height:64px;display:flex;align-items:center;padding:0 28px;border-bottom:1px solid #e5e5e5}',
    '.cap-main{max-width:560px;margin:0 auto;padding:18px 16px 40px}',
    '.cap-wrapper{}',
    '.pgHeading{margin:10px 0 20px 10px;padding:10px 0 0}',
    '.pgHeading>h1{line-height:27px;text-align:left;margin:0 10px 20px 0;font-size:1.2em;font-family:Arial,Helvetica,sans-serif;font-weight:normal;color:#5d5d5d}',
    '.pgCenter{margin:10px;text-align:justify;font-size:1.1em}',
    '.cap-para{padding:10px;color:#333}',
    '.cap-verify-lbl{padding:10px;color:#333;font-weight:bold}',
    '.target-icaptcha-slot{margin:10px;min-height:78px}',
    '.captcha-not-rendered-msg-div{padding:10px;color:#ee001c;font-size:12px;line-height:1.5}',
    '.captcha-not-rendered-msg-div a{text-decoration:underline;color:#ee001c}',
    '.cap-footer{border-top:1px solid #e5e5e5;padding:14px 28px;font-family:"Market Sans",Arial,sans-serif;color:#41413f;font-size:11px}',
    /* hCaptcha checkbox widget */
    '.h-checkbox-widget{width:300px;height:74px;display:flex;align-items:center;gap:12px;padding:0 12px;box-sizing:border-box;border:1px solid #d3d9e0;border-radius:4px;background:#fafafa;box-shadow:0 0 4px 0 rgba(0,0,0,.08)}',
    '#checkbox{width:28px;height:28px;border:2px solid #b6b6b6;border-radius:3px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#fff;flex:none}',
    '#checkbox.checking{border-color:#00838f;border-radius:50%;border-top-color:transparent;animation:ds-spin .7s linear infinite;background:#fff}',
    '#checkbox.checked{background:#00838f;border-color:#00838f;border-radius:4px;animation:none}',
    '.h-checkbox-label{flex:1;font-size:14px;color:#555}',
    '.h-brand{display:flex;flex-direction:column;align-items:center;color:#9aa3ab;font-size:8px;line-height:1.15}',
    '.h-brand-mark{width:26px;height:26px;border-radius:6px;margin-bottom:2px;background:linear-gradient(135deg,#00d2ff,#2563eb)}',
    /* hCaptcha challenge popup (frame=challenge replica) */
    '.h-popup{position:absolute;top:96px;left:50%;transform:translateX(-50%);z-index:30;box-shadow:rgba(0,0,0,.1) 0 0 4px;border-radius:4px;overflow:hidden;border:1px solid #d7d7d7;background:#fff}',
    '.h-frame-label{background:#f6f8fa;color:#6b7280;font-size:10px;padding:5px 8px;border-bottom:1px solid #e5e7eb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:400px}',
    '.interface-wrapper{width:400px;background:#fff}',
    '.challenge-container{padding:0}.challenge{}.challenge-view{display:flex;flex-direction:column}',
    '.challenge-header{background:#00838f;color:#fff;padding:16px 18px;border-radius:4px 4px 0 0}',
    '.challenge-prompt{font-size:13px;opacity:.9}.prompt-text{display:block;font-size:18px;font-weight:500;margin-top:4px;line-height:1.25}',
    '.task-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;padding:6px;background:#fff}',
    '.task-image{position:relative;height:124px;overflow:hidden;cursor:pointer;border:3px solid transparent;background:#e5e7eb}',
    '.task-image .image-wrapper,.task-image img{width:100%;height:100%;display:block;object-fit:cover;pointer-events:none;user-select:none}',
    '.task-image.selected{border-color:#00838f}',
    '.task-image.selected::after{content:"";position:absolute;right:7px;top:7px;width:22px;height:22px;border-radius:50%;background:#00838f;box-shadow:0 1px 4px rgba(0,0,0,.3)}',
    '.task-image.solver-hover{outline:3px solid #f59e0b;outline-offset:-3px}',
    '.challenge-footer{display:flex;align-items:center;justify-content:space-between;border-top:1px solid #e5e7eb;padding:10px 14px;min-height:54px}',
    '.refresh.button{font-size:12px;color:#00838f;cursor:pointer;background:none;border:0}',
    '.button-submit{background:#00838f;color:#fff;border:0;border-radius:4px;padding:9px 18px;font-size:13px;font-weight:700;cursor:pointer}',
    '.button-submit[disabled]{opacity:.5;cursor:not-allowed}',
    '.h-cursor{position:absolute;z-index:60;width:18px;height:18px;margin:-9px 0 0 -9px;pointer-events:none;transition:none;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}',
    '.cap-banner{display:none;margin:12px 10px;border-radius:8px;background:#ecfdf5;border:1px solid #86efac;color:#166534;padding:12px 14px;font-size:13px;line-height:1.5}',
    '.cap-banner.show{display:block}',
    /* loading ellipsis from captcha-hcWdEsBF.css (trimmed) */
    '.lds-ellipsis{position:relative;width:80px;height:30px}',
    '.lds-ellipsis>div{position:absolute;top:13px;width:11px;height:11px;border-radius:50%;background:#00838f;animation-timing-function:cubic-bezier(0,1,1,0)}',
    '.lds-ellipsis>div:nth-child(1){left:8px;animation:lds1 .6s infinite}',
    '.lds-ellipsis>div:nth-child(2){left:8px;animation:lds2 .6s infinite}',
    '.lds-ellipsis>div:nth-child(3){left:32px;animation:lds2 .6s infinite}',
    '.lds-ellipsis>div:nth-child(4){left:56px;animation:lds3 .6s infinite}',
    '@keyframes lds1{0%{transform:scale(0)}100%{transform:scale(1)}}',
    '@keyframes lds3{0%{transform:scale(1)}100%{transform:scale(0)}}',
    '@keyframes lds2{0%{transform:translate(0,0)}100%{transform:translate(24px,0)}}'
  ].join('\n');
  document.head.appendChild(s);
}

// ── eBay logo (exact SVG from splashui/captcha.html) ─────────────────────────
const EBAY_LOGO = '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="37" viewBox="0 0 122 48.592" aria-label="eBay Home"><g><path fill="#F02D2D" d="M24.355 22.759c-.269-5.738-4.412-7.838-8.826-7.813-4.756.026-8.544 2.459-9.183 7.915zM6.234 26.93c.364 5.553 4.208 8.814 9.476 8.785 3.648-.021 6.885-1.524 7.952-4.763l6.306-.035c-1.187 6.568-8.151 8.834-14.145 8.866C4.911 39.844.043 33.865-.002 25.759c-.05-8.927 4.917-14.822 15.765-14.884 8.628-.048 14.978 4.433 15.033 14.291l.01 1.625z"/><path fill="#0968F6" d="M46.544 35.429c5.688-.032 9.543-4.148 9.508-10.32s-3.947-10.246-9.622-10.214-9.543 4.148-9.509 10.32 3.974 10.245 9.623 10.214zM30.652.029l6.116-.034.085 15.369c2.978-3.588 7.1-4.65 11.167-4.674 6.817-.037 14.412 4.518 14.468 14.454.045 8.29-5.941 14.407-14.422 14.454-4.463.026-8.624-1.545-11.218-4.681a33.237 33.237 0 01-.19 3.731l-5.994.034c.09-1.915.185-4.364.174-6.322z"/><path fill="#FFBD14" d="M77.282 25.724c-5.548.216-8.985 1.229-8.965 4.883.013 2.365 1.94 4.919 6.7 4.891 6.415-.035 9.826-3.556 9.794-9.289v-.637c-2.252.02-5.039.054-7.529.152zm13.683 7.506c.01 1.778.071 3.538.232 5.1l-5.688.032a33.381 33.381 0 01-.225-3.825c-3.052 3.8-6.708 4.909-11.783 4.938-7.532.042-11.585-3.915-11.611-8.518-.037-6.665 5.434-9.049 14.954-9.318 2.6-.072 5.529-.1 7.945-.116v-.637c-.026-4.463-2.9-6.285-7.854-6.257-3.68.021-6.368 1.561-6.653 4.2l-6.434.035c.645-6.566 7.53-8.269 13.595-8.3 7.263-.04 13.406 2.508 13.448 10.192z"/><path fill="#92C821" d="M91.939 19.852l-4.5-8.362 7.154-.04 10.589 20.922 10.328-21.02 6.486-.048-18.707 37.251-6.85.039 5.382-10.348-9.887-18.393"/></g></svg>';

// Renders the EXACT eBay splashui DOM shell. The hidden field set + ids/classes
// (captcha_form, srt, ru, cptap, appName, cptrdbpid, iia, iiz, iim, cf_input,
// iid, areaTitle.pgHeading, CentralArea.pgCenter, s0-78-captcha-ui
// .target-icaptcha-slot, captcha_loading.lds-ellipsis) mirror the captured page.
function ebayShellHtml() {
  return [
    '<div class="cap-no-touch" id="cap-shell">',
    '  <div class="cap-gh">' + EBAY_LOGO + '</div>',
    '  <main id="mainContent" role="main" tabindex="-1"><div class="cap-main"><div id="wrapper" class="cap-wrapper">',
    '    <form id="captcha_form" action="captcha_submit" method="post" onsubmit="return false">',
    '      <input type="hidden" name="srt" value="01000b00000050c0_lab_trust_session_token">',
    '      <input type="hidden" name="ru" value="https%3A%2F%2Fsignin.ebay.com%2Fsignin%2F">',
    '      <input type="hidden" name="cptap" value="1">',
    '      <input type="hidden" name="appName" value="orch">',
    '      <input type="hidden" name="cptrdbpid" value="6a0127fe-3c0c-47d4-89aa-13fec8f64097">',
    '      <input type="hidden" name="iia" value="WRkwLjM5kT">',
    '      <input type="hidden" name="iiz" value="UxILjE2Mg**vas">',
    '      <input type="hidden" name="iim" value="RNTAuMTn">',
    '      <input id="cf_input" type="hidden" name="cfi" value="">',
    '      <input type="hidden" id="iid" name="iid" value="6a0127fe-3c0c-47d4-89aa-13fec8f64097">',
    '      <div id="areaTitle" class="pgHeading"><h1>Please verify yourself to continue</h1></div>',
    '      <div class="pgCenter" id="CentralArea">',
    '        <div class="cap-para">To keep eBay a safe place to buy and sell, we will occasionally ask you to verify yourself. This helps us to block unauthorized users from entering our site.</div>',
    '        <div class="cap-verify-lbl">Please verify yourself</div>',
    '        <div id="captcha_loading"><div class="lds-ellipsis"><div></div><div></div><div></div><div></div></div></div>',
    '        <div id="s0-78-captcha-ui" class="target-icaptcha-slot" data-sitekey="' + LAB.sitekey + '"></div>',
    '        <input type="hidden" id="s0-78-captcha-data">',
    '        <div style="clear:both"></div>',
    '        <div class="captcha-not-rendered-msg-div">View <a href="#" onclick="return false">accessibility options</a> for this verification page. If you are having difficulties with rendering of images on the above verification page, eBay suggests using the latest version of your browser.</div>',
    '        <div class="cap-banner" id="cap-banner"></div>',
    '      </div>',
    '    </form>',
    '  </div></div></main>',
    '  <div class="cap-footer">Copyright &copy; 1995-2026 eBay Inc. All Rights Reserved. Accessibility, User Agreement, Privacy, Consumer Health Data, Payments Terms of Use, Cookies.</div>',
    '  <div id="h-popup-host"></div>',
    '</div>'
  ].join('\n');
}

// hCaptcha checkbox widget — mounts into .target-icaptcha-slot. The clickable
// element is div#checkbox (the exact id the real solver targets).
function checkboxWidgetHtml() {
  return [
    '<div class="h-checkbox-widget" data-frame="https://newassets.hcaptcha.com/captcha/v1/48c600369effc733fa1c96b20464a6be902f77db/static/hcaptcha.html#frame=checkbox">',
    '  <div id="checkbox" role="checkbox" aria-checked="false" aria-haspopup="true" tabindex="0" aria-labelledby="a11y-label"></div>',
    '  <div class="h-checkbox-label" id="a11y-label">I am human</div>',
    '  <div class="h-brand"><div class="h-brand-mark"></div><span>hCaptcha</span><span>Privacy - Terms</span></div>',
    '</div>'
  ].join('');
}

// hCaptcha 3x3 challenge popup — frame=challenge replica. Uses real captcha
// images from the manifest (loaded via buildGrid).
function challengePopupHtml(lab) {
  const tiles = (lab.grid || []).map((g, i) =>
    '<div class="task-image" data-index="' + i + '" role="button" tabindex="0" aria-label="image ' + (i + 1) + '"><div class="image-wrapper"><img src="' + esc(g.path) + '" alt="" draggable="false"></div></div>'
  ).join('');
  return [
    '<div class="h-popup" id="h-popup">',
    '  <div class="h-frame-label">https://newassets.hcaptcha.com/captcha/v1/48c600369effc733fa1c96b20464a6be902f77db/static/hcaptcha.html#frame=challenge</div>',
    '  <div class="interface-wrapper"><div class="challenge-container"><div class="challenge"><div class="challenge-view">',
    '    <div class="challenge-header"><div class="challenge-prompt"><span>' + esc(lab.promptLead) + ' </span><span class="prompt-text">' + esc(lab.promptTarget) + '</span></div></div>',
    '    <div class="task-grid">' + tiles + '</div>',
    '    <div class="challenge-footer"><button type="button" class="refresh button" id="h-refresh">Get new challenge</button><button type="button" class="button-submit" id="h-verify" disabled>Verify</button></div>',
    '  </div></div></div></div>',
    '</div>'
  ].join('\n');
}

// ── Lab "solver software" — mirrors hcaptcha-challenger's human-mouse model ──
// Quadratic-bezier trajectory + ease-in-out dynamic delays, then click each
// answer tile. The answer set is the boolean 3x3 matrix (target-kind tiles).
function bezier(start, end, steps) {
  const pts = [];
  const dist = Math.hypot(end.x - start.x, end.y - start.y);
  const off = Math.min(0.3, Math.max(0.1, dist / 1000));
  const mx = (start.x + end.x) / 2, my = (start.y + end.y) / 2;
  const cx = mx + (Math.random() * 2 - 1) * dist * off;
  const cy = my + (Math.random() * 2 - 1) * dist * off;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    pts.push({ x: u * u * start.x + 2 * u * t * cx + t * t * end.x, y: u * u * start.y + 2 * u * t * cy + t * t * end.y });
  }
  return pts;
}
function dynDelays(steps, base) {
  const d = [];
  for (let i = 0; i <= steps; i++) {
    let p = i / steps, f;
    if (p < 0.5) f = 2 * p * p; else { p -= 1; f = 1 - (-2 * p * p); }
    d.push(base * (1.5 - 0.9 * f) * (0.9 + Math.random() * 0.2));
  }
  return d;
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function moveCursor(cursor, host, from, to) {
  const steps = 26;
  const pts = bezier(from, to, steps);
  const delays = dynDelays(steps, 14);
  for (let i = 0; i < pts.length; i++) {
    cursor.style.left = pts[i].x + 'px';
    cursor.style.top = pts[i].y + 'px';
    await sleep(delays[i]);
  }
  return to;
}

// ── Runtime: wire the eBay shell, checkbox, challenge popup, verify + solver ──
function wireLab(stage, lab, rerender) {
  const slot = stage.querySelector('#s0-78-captcha-ui');
  const banner = stage.querySelector('#cap-banner');
  const popupHost = stage.querySelector('#h-popup-host');
  const cfInput = stage.querySelector('#cf_input');
  const groundTruth = new Set((lab.grid || []).map((g, i) => g.isTarget ? i : -1).filter(i => i >= 0));
  const selected = new Set();
  let solving = false;

  // Lab-safe captchaCallback (mirrors the real splashui handler shape).
  const prevCb = window.captchaCallback;
  window.captchaCallback = (verified) => {
    if (!verified) return;
    banner.classList.add('show');
    const token = cfInput.value || '';
    banner.innerHTML = '<strong>Verified — lab captcha solved.</strong><br>Token written to #cf_input and #h-captcha-response-*: <code>' + esc(token.slice(0, 36)) + '...</code><br>The real eBay submit (captcha_submit) is blocked in this offline lab.';
  };

  // Mount the hCaptcha checkbox widget into the slot (post "load").
  slot.innerHTML = checkboxWidgetHtml();
  const loadingEl = stage.querySelector('#captcha_loading');
  if (loadingEl) setTimeout(() => { loadingEl.style.transition = 'opacity .4s'; loadingEl.style.opacity = '0'; }, 500);
  const checkbox = stage.querySelector('#checkbox');

  function openChallenge() {
    popupHost.innerHTML = challengePopupHtml(lab);
    const popup = stage.querySelector('#h-popup');
    const verify = stage.querySelector('#h-verify');
    const refresh = stage.querySelector('#h-refresh');
    const tiles = popup.querySelectorAll('.task-image');
    selected.clear();

    function syncVerify() { verify.disabled = selected.size === 0; }
    function toggle(tile) {
      const i = Number(tile.dataset.index);
      if (selected.has(i)) { selected.delete(i); tile.classList.remove('selected'); }
      else { selected.add(i); tile.classList.add('selected'); }
      syncVerify();
    }
    tiles.forEach(t => {
      t.onclick = () => { if (!solving) toggle(t); };
      t.onkeydown = (e) => { if (!solving && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(t); } };
    });
    refresh.onclick = () => { if (!solving) { selected.clear(); tiles.forEach(t => t.classList.remove('selected')); syncVerify(); } };
    verify.onclick = () => runVerify(popup, tiles, verify);
    return { popup, verify, tiles };
  }

  function makeToken() {
    const payload = { sitekey: lab.sitekey, request_type: lab.requestType, tiles: Array.from(selected).sort(), ts: Date.now() };
    const enc = btoa(JSON.stringify(payload)).replace(/[+/=]/g, '').slice(0, 120);
    return 'P0_' + enc + '.' + Math.random().toString(36).slice(2, 10);
  }
  function fillToken(tok) {
    cfInput.value = tok;
    let hr = stage.querySelector('#h-captcha-response-0lct040v608f');
    if (!hr) {
      hr = document.createElement('textarea');
      hr.id = 'h-captcha-response-0lct040v608f';
      hr.name = 'h-captcha-response';
      hr.style.display = 'none';
      stage.querySelector('#captcha_form').appendChild(hr);
    }
    hr.value = tok;
  }
  function runVerify(popup, tiles, verify) {
    const ok = selected.size === groundTruth.size && Array.from(selected).every(i => groundTruth.has(i));

    if (!ok) {
      _failed++;
      updateStats();
      popupHost.innerHTML = '';
      verify.textContent = 'Wrong — new challenge';
      console.warn('[Captcha Lab] VERIFY FAILED #' + _failed + ' — Selected:', Array.from(selected),
        '| category:', LAB.targetCategory);
      setTimeout(() => {
        if (stage._cleanup) stage._cleanup();
        if (_started) mountFresh();
      }, 800);
      return;
    }

    _solved++;
    updateStats();
    fillToken(makeToken());
    checkbox.classList.remove('checking'); checkbox.classList.add('checked'); checkbox.setAttribute('aria-checked', 'true');
    checkbox.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
    popupHost.innerHTML = '';
    window.captchaCallback(true);
    console.log('[Captcha Lab] SOLVED #' + _solved + ' | category:', LAB.targetCategory);
    // Auto-load next challenge after 1.5s if cycle is active
    if (_started) {
      setTimeout(() => {
        if (stage._cleanup) stage._cleanup();
        mountFresh();
      }, 1500);
    }
  }

  checkbox.onclick = () => {
    if (checkbox.classList.contains('checked') || solving) return;
    checkbox.classList.add('checking');
    setTimeout(() => { checkbox.classList.remove('checking'); openChallenge(); }, 520);
  };
  checkbox.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); checkbox.onclick(); } };

  // ── Real solver — calls the Gemini vision API at api.syndrax.io. ─────────
  //    No ground truth. The AI toggle gates whether this runs automatically.
  const SOLVER_API = 'https://api.syndrax.io/api/v1/captcha/solve';

  async function imageToBase64(url) {
    if (url.startsWith('data:')) return url;
    try {
      const r = await fetch(url);
      if (!r.ok) return '';
      const blob = await r.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch { return ''; }
  }

  async function autoSolve() {
    if (solving) return;
    if (!window._captchaLabAiEnabled || !window._captchaLabAiEnabled()) return;
    solving = true;

    const popup = stage.querySelector('#h-popup');
    if (!popup) { solving = false; return; }

    const result = stage.querySelector('#challenge-result') || document.createElement('div');
    const tiles = popup.querySelectorAll('.task-image');
    const verify = stage.querySelector('#h-verify');

    // Extract prompt
    const promptEl = popup.querySelector('.prompt-text');
    const prompt = promptEl ? promptEl.textContent.trim() : '';
    if (!prompt) { result.textContent = 'No prompt found'; solving = false; return; }

    // Extract 9 tile images as base64
    result.textContent = 'Calling Gemini vision API...';
    const images = [];
    for (const tile of tiles) {
      const img = tile.querySelector('img');
      if (img && img.src) {
        const b64 = await imageToBase64(img.src);
        images.push(b64);
      } else {
        images.push('');
      }
    }
    if (images.filter(Boolean).length < 9) {
      result.textContent = 'Failed to load all tile images';
      solving = false; return;
    }

    // Call the Gemini solver
    try {
      const resp = await fetch(SOLVER_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, images })
      });
      if (!resp.ok) {
        const err = await resp.text().catch(() => '');
        result.textContent = 'API error ' + resp.status + ' — try manually';
        console.error('[Captcha Lab] API error:', resp.status, err.slice(0, 200));
        solving = false; return;
      }
      const data = await resp.json();
      const indices = data.indices || [];
      result.textContent = indices.length
        ? 'Gemini found ' + indices.length + ' match' + (indices.length > 1 ? 'es' : '') + ' — clicking...'
        : 'Gemini found no matches — verifying empty';
      console.log('[Captcha Lab] prompt:', prompt.slice(0, 80),
        '| indices:', indices,
        '| target category:', LAB.targetCategory);

      // Click the returned tiles
      for (const idx of indices) {
        if (idx >= 0 && idx < tiles.length) {
          tiles[idx].classList.add('selected');
          selected.add(idx);
        }
      }
      verify.disabled = selected.size === 0;

      // Wait briefly so the user can see the selection, then verify
      await sleep(400);
      runVerify(popup, tiles, verify);
    } catch (e) {
      result.textContent = 'API unreachable — try manually';
      console.error('[Captcha Lab] API unreachable:', e.message || e);
    }
    solving = false;
  }

  // cleanup hook on exit
  stage._cleanup = () => { window.captchaCallback = prevCb; };
}

// ── Page render ──────────────────────────────────────────────────────────────
function subnavHtml(active) {
  return '<div class="clab-subnav">' + SUBTABS.map(t =>
    '<button data-clab-sub="' + t.id + '" class="' + (t.id === active ? 'active' : '') + '">' + esc(t.label) + '</button>'
  ).join('') + '</div>';
}

function pageHtml(active) {
  return [
    '<div class="ds-main" id="clab-main">',
    '<h2>Captcha Lab</h2>',
    subnavHtml(active),
    '<p class="clab-intro">Offline replica of the eBay <strong>Security Measure</strong> page. The DOM matches the real <code>splashui/captcha.html</code> exactly (captcha_form, target-icaptcha-slot, hidden token fields). Click the hCaptcha <em>I am human</em> checkbox to trigger the 3x3 challenge, then either solve it by hand or run the built-in solver. No live eBay or hCaptcha endpoints are contacted.</p>',
    '<div class="clab-stage" id="clab-stage">',
    '  <div class="clab-bar"><strong>AXIS Captcha Lab</strong><small>eBay hCaptcha - image_label_binary - random challenge</small>',
    '    <button class="clab-reset" id="clab-reset">New Challenge</button>',
    '    <button class="clab-startstop" id="clab-startstop" title="Start/Stop auto cycle">⏹ Stop Cycle</button>',
    '    <small style="color:#64748b;font-size:11px;margin-left:auto" id="clab-stats">✓ 0 ✗ 0 —</small>',
    '    <button class="clab-fs" id="clab-fs" title="Expand to full page / collapse back">⛶ Full</button>',
    '  </div>',
    '  <div id="clab-page">' + ebayShellHtml() + '</div>',
    '</div>',
    '<script src="/app-captcha-lab-telemetry.js" async></script>',
    '</div>'
  ].join('\n');
}

export async function renderDevCaptchaLab({ render, navHtml }) {
  ensureStyles();
  const rerender = () => renderDevCaptchaLab({ render, navHtml });
  const sp = new URLSearchParams(location.search || '');
  const active = sp.get('sub') || SUBTABS[0].id;
  const nav = navHtml ? navHtml('captcha-lab') : '';
  render(nav + pageHtml(active));

  const stage = document.getElementById('clab-stage');
  const lab = LAB;

  async function mount() {
    // Pick a fresh random category for this challenge
    const cat = randomCategory();
    LAB.targetCategory = cat.id;
    LAB.promptTarget = cat.label;
    return _mountInner();
  }

  async function _mountInner() {
    const page = document.getElementById('clab-page');
    if (stage && stage._cleanup) stage._cleanup();
    page.innerHTML = ebayShellHtml();
    try {
      await loadManifest();
      LAB.grid = buildGrid(LAB.targetCategory);
      wireLab(stage, LAB, rerender);
      console.log('[Captcha Lab] Grid ready:', LAB.grid.length, 'tiles, category:', LAB.targetCategory);
    } catch (e) {
      console.error('[Captcha Lab] mount failed:', e);
    }
  }

  // mountFresh is called by runVerify on fail (new random challenge)
  function mountFresh() { mount(); }

  mount();

  const reset = document.getElementById('clab-reset');
  if (reset) reset.onclick = () => mount();

  // Start/stop cycle toggle
  const ssBtn = document.getElementById('clab-startstop');
  if (ssBtn) ssBtn.onclick = () => {
    _started = !_started;
    ssBtn.textContent = _started ? '⏹ Stop Cycle' : '▶ Start Cycle';
    ssBtn.style.background = _started ? 'transparent' : '#22c55e';
    ssBtn.style.borderColor = _started ? '#334155' : '#22c55e';
    ssBtn.style.color = _started ? '#cbd5e1' : '#0b0e17';
    console.log('[Captcha Lab] Cycle', _started ? 'STARTED' : 'STOPPED');
  };

  // Fullscreen toggle — same button expands and collapses
  const fsBtn = document.getElementById('clab-fs');
  if (fsBtn) fsBtn.onclick = () => {
    const expanded = stage.classList.toggle('clab-fullscreen');
    fsBtn.innerHTML = expanded ? '⛶<span style="font-size:10px;margin-left:4px">Exit</span>' : '⛶ Full';
  };

  document.querySelectorAll('[data-clab-sub]').forEach(btn => {
    btn.onclick = () => setParams({ sub: btn.dataset.clabSub }, rerender);
  });
}

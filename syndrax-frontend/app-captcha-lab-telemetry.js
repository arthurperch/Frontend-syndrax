// app-captcha-lab-telemetry.js — Blue Team behavioral detector for the
// Captcha Lab grid. Watches mousemove + click events inside the challenge
// container, computes a bot-probability score (0–100), and renders a live
// overlay. Framework-less ES module — just drop the script tag into the page.

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  const path = [];         // [{x, y, t}] mouse trail
  const clicks = [];       // [{x, y, t, isTrusted}]
  let watching = false;

  // ── Score computation ──────────────────────────────────────────────────────
  function scoreBot() {
    const factors = [];

    // 1. Click-cadence uniformity (std dev of inter-click intervals)
    if (clicks.length >= 3) {
      const intervals = [];
      for (let i = 1; i < clicks.length; i++) intervals.push(clicks[i].t - clicks[i-1].t);
      const avg = intervals.reduce((a,b)=>a+b,0) / intervals.length;
      const vari = intervals.reduce((a,b)=>a+(b-avg)*(b-avg),0) / intervals.length;
      const std = Math.sqrt(vari);
      const cv = avg > 0 ? std / avg : 0;  // coefficient of variation
      // Human clicks are irregular (cv ~0.3+); bot clicks are uniform (cv < 0.12)
      const cadenceScore = cv < 0.08 ? 35 : cv < 0.15 ? 20 : cv < 0.25 ? 8 : 0;
      factors.push({ signal: 'cadence_uniformity', cv: cv.toFixed(3), score: cadenceScore });
    }

    // 2. Mouse-path straightness (ratio of displacement to trail length)
    if (path.length >= 8) {
      let trailLen = 0;
      for (let i = 1; i < path.length; i++) {
        trailLen += Math.hypot(path[i].x - path[i-1].x, path[i].y - path[i-1].y);
      }
      const disp = Math.hypot(path[path.length-1].x - path[0].x, path[path.length-1].y - path[0].y);
      const straightness = trailLen > 0 ? disp / trailLen : 0;
      // Humans curve (0.3-0.7); straight lines (0.85+) = bot
      const straightScore = straightness > 0.92 ? 30 : straightness > 0.80 ? 18 : straightness > 0.65 ? 6 : 0;
      factors.push({ signal: 'path_straightness', straightness: straightness.toFixed(3), score: straightScore });
    }

    // 3. Untrusted events
    const untrusted = clicks.filter(c => !c.isTrusted).length;
    if (untrusted > 0) {
      factors.push({ signal: 'untrusted_events', count: untrusted, score: Math.min(untrusted * 15, 40) });
    }

    // 4. Reaction time (first mousemove → first click)
    if (path.length > 0 && clicks.length > 0) {
      const firstMove = path[0].t;
      const firstClick = clicks[0].t;
      const rt = firstClick - firstMove;
      // Human reactions: 200-1200ms. Under 80ms or hyper-consistent = bot
      const rtScore = rt < 40 ? 20 : rt < 100 ? 12 : 0;
      factors.push({ signal: 'reaction_time_ms', rt, score: rtScore });
    }

    const total = factors.reduce((a, f) => a + f.score, 0);
    return { botProbability: Math.min(total, 100), factors, clicks: clicks.length, pathLen: path.length };
  }

  // ── Overlay render ─────────────────────────────────────────────────────────
  let overlay = null;
  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'captcha-telemetry-overlay';
    overlay.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:9998;width:260px;'
      + 'background:rgba(15,23,42,.94);border:1px solid rgba(255,255,255,.25);border-radius:12px;'
      + 'padding:12px 14px;color:#e2e8f0;font:12px ui-monospace,monospace;backdrop-filter:blur(8px);'
      + 'box-shadow:0 8px 32px rgba(0,0,0,.45);pointer-events:none;transition:opacity .2s;';
    document.body.appendChild(overlay);
  }

  function renderOverlay(bot) {
    ensureOverlay();
    const pct = bot.botProbability;
    const band = pct >= 70 ? '🤖 BOT' : pct >= 30 ? '⚠️ SUSPICIOUS' : '👤 HUMAN';
    const color = pct >= 70 ? '#f87171' : pct >= 30 ? '#fbbf24' : '#34d399';
    overlay.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
        + '<div style="font-size:18px">' + band + '</div>'
        + '<div style="font-size:22px;font-weight:800;color:' + color + ';margin-left:auto">' + pct + '%</div>'
      + '</div>'
      + '<div style="color:#94a3b8;margin-bottom:4px">clicks: ' + bot.clicks + ' · path: ' + bot.pathLen + ' pts</div>'
      + bot.factors.map(f =>
        '<div style="display:flex;justify-content:space-between;margin-top:2px">'
          + '<span style="color:#64748b">' + f.signal + '</span>'
          + '<span style="color:' + (f.score > 10 ? '#f87171' : '#94a3b8') + '">+' + f.score + '</span>'
        + '</div>'
      ).join('')
      + (pct >= 70 ? '<div style="margin-top:6px;color:#f87171;font-weight:700">⚠ Programmatic events detected</div>' : '');
  }

  // ── Event listeners ────────────────────────────────────────────────────────
  function onMouseMove(e) {
    path.push({ x: e.clientX, y: e.clientY, t: performance.now() });
    if (path.length > 200) path.shift();
  }
  function onClick(e) {
    clicks.push({ x: e.clientX, y: e.clientY, t: performance.now(), isTrusted: e.isTrusted });
    if (clicks.length > 50) clicks.shift();
    debounceUpdate();
  }

  let _updateTimer = null;
  function debounceUpdate() {
    clearTimeout(_updateTimer);
    _updateTimer = setTimeout(updateScore, 300);
  }
  function updateScore() {
    const bot = scoreBot();
    window.captchaLabTelemetry = bot;
    renderOverlay(bot);
  }

  // ── Start / stop ───────────────────────────────────────────────────────────
  function start() {
    if (watching) return;
    const container = document.getElementById('clab-stage');
    if (!container) return setTimeout(start, 500); // wait for lab to mount
    container.addEventListener('mousemove', onMouseMove, { passive: true });
    container.addEventListener('click', onClick, true);
    watching = true;
    console.log('[Blue Team] detector active on #clab-stage');
  }

  // Wait for the lab to render (it mounts asynchronously post manifest load)
  setTimeout(start, 2000);

  // Re-attach if the lab unmounts/remounts (category switch, reset)
  new MutationObserver(() => {
    if (!document.getElementById('clab-stage')) return;
    if (!watching) start();
  }).observe(document.body, { childList: true, subtree: true });

  console.log('[Blue Team] captcha-lab-telemetry loaded');
})();

// Syndrax extension install + version handshake (runs on syndrax.io).
// Pings the extension (dev-keyed ID and Chrome Web Store ID), reads its version,
// and shows a top banner if it's missing or out of date. Also exposes
// window.SyndraxExt and a 'syndrax-ext' event for pages that want the state.
(function () {
  var EXTENSION_IDS = [
    'olhecndljgbocfkdejkcppadadmfiojo', // dev / keyed / unpacked (stable)
    'mgapfpdkkihbeehfkgoajhealmgpnglo', // Chrome Web Store
  ];
  var LATEST_VERSION = '1.1.2'; // bump on each extension release
  var STORE_URL = 'https://chromewebstore.google.com/detail/mgapfpdkkihbeehfkgoajhealmgpnglo';

  function ping(id) {
    return new Promise(function (resolve) {
      try {
        if (!window.chrome || !chrome.runtime || !chrome.runtime.sendMessage) return resolve(null);
        chrome.runtime.sendMessage(id, { type: 'SYNDRAX_PING' }, function (resp) {
          if (chrome.runtime.lastError || !resp || !resp.installed) return resolve(null);
          resolve(resp);
        });
      } catch (e) {
        resolve(null);
      }
    });
  }

  async function detect() {
    for (var i = 0; i < EXTENSION_IDS.length; i++) {
      var r = await ping(EXTENSION_IDS[i]);
      if (r) return { installed: true, version: r.version, id: r.id || EXTENSION_IDS[i] };
    }
    return { installed: false, version: null, id: null };
  }

  // -1 if a < b, 0 equal, 1 if a > b
  function cmpVersion(a, b) {
    var pa = String(a).split('.').map(Number);
    var pb = String(b).split('.').map(Number);
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      var x = pa[i] || 0, y = pb[i] || 0;
      if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
  }

  function showBanner(kind, text, ctaText, ctaHref) {
    if (document.getElementById('sx-ext-banner')) return;
    var bar = document.createElement('div');
    bar.id = 'sx-ext-banner';
    bar.style.cssText =
      'position:fixed;top:0;left:0;right:0;z-index:99999;display:flex;align-items:center;' +
      'justify-content:center;gap:14px;padding:10px 16px;font:14px/1.4 Inter,system-ui,sans-serif;' +
      'color:#e6f3ff;background:' + (kind === 'update' ? '#2a1d05' : '#08111c') +
      ';border-bottom:1px solid #1d3a4d';
    var msg = document.createElement('span');
    msg.textContent = text;
    var cta = document.createElement('a');
    cta.textContent = ctaText;
    cta.href = ctaHref;
    cta.target = '_blank';
    cta.rel = 'noopener';
    cta.style.cssText =
      'background:linear-gradient(#1cf2ff,#00a7ff);color:#01121d;text-decoration:none;' +
      'font-weight:600;padding:6px 14px;border-radius:8px;white-space:nowrap';
    var close = document.createElement('button');
    close.textContent = '✕';
    close.setAttribute('aria-label', 'Dismiss');
    close.style.cssText = 'background:none;border:0;color:#8aa0b4;cursor:pointer;font-size:15px';
    close.onclick = function () { bar.remove(); };
    bar.appendChild(msg);
    bar.appendChild(cta);
    bar.appendChild(close);
    document.body.appendChild(bar);
  }

  function publish(r) {
    window.SyndraxExt = { installed: r.installed, version: r.version, id: r.id, latest: LATEST_VERSION, detect: detect };
    document.dispatchEvent(new CustomEvent('syndrax-ext', { detail: window.SyndraxExt }));
  }

  async function run() {
    var r = await detect();
    publish(r);
    // MV3 background service workers go to sleep — the first ping after a cold
    // page load often misses. Retry for a few seconds and re-publish so the app
    // flips to "connected" once the worker wakes (covers Web Store + dev builds).
    for (var i = 0; i < 6 && !r.installed; i++) {
      await new Promise(function (res) { setTimeout(res, 800); });
      r = await detect();
      if (r.installed) publish(r);
    }

    if (!r.installed) {
      showBanner('install', 'Install the Syndrax extension to run your cluster.', 'Add to Chrome', STORE_URL);
    } else if (cmpVersion(r.version, LATEST_VERSION) < 0) {
      showBanner('update',
        'A newer Syndrax extension (v' + LATEST_VERSION + ') is available — you have v' + r.version + '.',
        'Update', STORE_URL);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    initNavScroll();
    initMobileMenu();
    initScrollReveal();
    initHeroSyncPanel();
    initCounters();
  });

  /* ===================== NAV SCROLL ===================== */

  function initNavScroll() {
    var navbar = document.getElementById('navbar');
    if (!navbar) return;

    function onScroll() {
      navbar.classList.toggle('scrolled', window.scrollY > 50);
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ===================== MOBILE MENU ===================== */

  function initMobileMenu() {
    var hamburger = document.getElementById('hamburger');
    var mobileMenu = document.getElementById('mobileMenu');
    var closeBtn = document.getElementById('mobileMenuClose');
    if (!hamburger || !mobileMenu) return;

    function openMenu() {
      mobileMenu.classList.add('open');
      mobileMenu.setAttribute('aria-hidden', 'false');
      hamburger.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
      mobileMenu.classList.remove('open');
      mobileMenu.setAttribute('aria-hidden', 'true');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    hamburger.addEventListener('click', function () {
      if (mobileMenu.classList.contains('open')) closeMenu();
      else openMenu();
    });

    if (closeBtn) closeBtn.addEventListener('click', closeMenu);

    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeMenu();
    });
  }

  /* ===================== SCROLL REVEAL ===================== */

  function initScrollReveal() {
    var sections = document.querySelectorAll('[data-reveal]');
    if (!sections.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.05, rootMargin: '0px 0px -10px 0px' }
    );

    sections.forEach(function (section) {
      // Hero always visible immediately
      if (section.classList.contains('sx-hero')) {
        section.classList.add('is-visible');
      } else {
        observer.observe(section);
      }
    });
    // Fallback: reveal all after 1.5s if observer hasn't fired
    setTimeout(function() {
      sections.forEach(function(s) { s.classList.add('is-visible'); });
    }, 1500);
  }

  /* ===================== HERO SYNC PANEL ===================== */

  function initHeroSyncPanel() {
    var CYCLE = 42;
    var SYNC_PHASE_END = 34;
    var COMPLETE_PHASE_END = 38;

    var lastSyncEl = document.getElementById('lastSyncTime');
    var nextSyncEl = document.getElementById('nextSyncTime');
    var cycleProgressEl = document.getElementById('cycleProgress');
    var walmartChannel = document.getElementById('walmartChannel');
    var walmartProgress = document.getElementById('walmartProgress');
    var walmartStatus = document.getElementById('walmartStatus');

    if (!lastSyncEl || !nextSyncEl) return;

    var elapsed = 0;
    var lastSync = 0;

    var syncedHTML =
      '<svg class="sx-icon-check" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Synced';

    var syncingHTML =
      '<svg class="sx-icon-spin" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="8 12" stroke-linecap="round"/></svg> syncing…';

    function setWalmartSyncing() {
      if (!walmartChannel) return;
      walmartChannel.classList.remove('is-synced');
      if (walmartProgress) {
        walmartProgress.classList.add('sx-channel__fill--amber');
        walmartProgress.style.setProperty('--pct', '65%');
      }
      if (walmartStatus) {
        walmartStatus.className = 'sx-channel__status sx-channel__status--syncing';
        walmartStatus.innerHTML = syncingHTML;
      }
    }

    function setWalmartSynced() {
      if (!walmartChannel) return;
      walmartChannel.classList.add('is-synced');
      if (walmartProgress) {
        walmartProgress.style.setProperty('--pct', '100%');
      }
      if (walmartStatus) {
        walmartStatus.className = 'sx-channel__status sx-channel__status--synced';
        walmartStatus.innerHTML = syncedHTML;
      }
    }

    function updateWalmartState() {
      if (elapsed < SYNC_PHASE_END) {
        setWalmartSyncing();
      } else if (elapsed < COMPLETE_PHASE_END) {
        var pct = 65 + ((elapsed - SYNC_PHASE_END) / (COMPLETE_PHASE_END - SYNC_PHASE_END)) * 35;
        if (walmartProgress) walmartProgress.style.setProperty('--pct', pct + '%');
        if (walmartStatus) {
          walmartStatus.className = 'sx-channel__status sx-channel__status--syncing';
          walmartStatus.innerHTML = syncingHTML;
        }
      } else {
        setWalmartSynced();
      }
    }

    function tick() {
      elapsed += 1;
      lastSync += 1;

      if (elapsed >= CYCLE) {
        elapsed = 0;
        lastSync = 0;
        setWalmartSyncing();
      } else {
        updateWalmartState();
      }

      lastSyncEl.textContent = lastSync + 's';
      nextSyncEl.textContent = (CYCLE - elapsed) + 's';

      if (cycleProgressEl) {
        cycleProgressEl.style.width = ((elapsed / CYCLE) * 100) + '%';
      }
    }

    setWalmartSyncing();
    tick();
    setInterval(tick, 1000);
  }

  /* ===================== COUNTERS ===================== */

  function initCounters() {
    var counters = document.querySelectorAll('[data-count], [data-count-text]');
    if (!counters.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          if (el.dataset.counted) return;
          el.dataset.counted = 'true';

          if (el.hasAttribute('data-count-text')) {
            animateText(el, el.getAttribute('data-count-text'));
          } else {
            animateNumber(el);
          }

          observer.unobserve(el);
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -20px 0px" }
    );

    counters.forEach(function (el) {
      observer.observe(el);
    });
    // Absolute fallback — fire all after 2s regardless
    setTimeout(function() {
      counters.forEach(function(el) {
        if (el.dataset.counted) return;
        el.dataset.counted = 'true';
        if (el.hasAttribute('data-count-text')) animateText(el, el.getAttribute('data-count-text'));
        else animateNumber(el);
      });
    }, 2000);
  }

  function animateNumber(el) {
    var target = parseFloat(el.getAttribute('data-count') || '0');
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = 1200;
    var start = performance.now();

    function ease(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function frame(now) {
      var progress = Math.min((now - start) / duration, 1);
      var value = Math.round(ease(progress) * target);
      el.textContent = value + suffix;
      if (progress < 1) requestAnimationFrame(frame);
      else el.textContent = target + suffix;
    }

    requestAnimationFrame(frame);
  }

  function animateText(el, finalText) {
    var duration = 800;
    var start = performance.now();

    function frame(now) {
      var progress = Math.min((now - start) / duration, 1);
      var len = Math.round(progress * finalText.length);
      el.textContent = finalText.slice(0, len);
      if (progress < 1) requestAnimationFrame(frame);
      else el.textContent = finalText;
    }

    requestAnimationFrame(frame);
  }
})();



/* ═══════════════════════════════════════════════════
   GLOBE + 3D ORBITAL LOGOS + TOASTS
   ═══════════════════════════════════════════════════ */
(function() {

  /* ── Globe init ──────────────────────────────────── */
  var canvas = document.getElementById('sxGlobe');
  if (!canvas) return;

  function init() {
    if (!window.createGlobe) { setTimeout(init, 80); return; }
    var phi = 0.6, theta = 0.28, dragging = false, lastX = 0, lastY = 0;
    var dpr = Math.min(window.devicePixelRatio || 1, 2), SIZE = 480;
    canvas.width = SIZE * dpr; canvas.height = SIZE * dpr;
    canvas.style.width = SIZE + "px"; canvas.style.height = SIZE + "px";

    createGlobe(canvas, {
      devicePixelRatio: dpr, width: SIZE*dpr, height: SIZE*dpr,
      phi: phi, theta: theta, dark: 1, diffuse: 1.1,
      mapSamples: 20000, mapBrightness: 6.5,
      baseColor: [0.1,0.12,0.18], markerColor: [1.0,1.0,1.0], glowColor: [0.18,0.28,0.55],
      markers: [
        {location:[47.6,-122.3],size:0.08},{location:[43.6,-79.4],size:0.07},
        {location:[40.7,-74.0],size:0.07},{location:[51.5,-0.12],size:0.07},
        {location:[35.7,139.7],size:0.07},{location:[22.3,114.2],size:0.06},
        {location:[1.35,103.8],size:0.06},{location:[-33.9,151.2],size:0.05},
        {location:[-23.5,-46.6],size:0.06},{location:[52.5,13.4],size:0.06},
        {location:[28.6,77.2],size:0.05},{location:[19.4,-99.1],size:0.05},
        {location:[55.7,37.6],size:0.05},{location:[31.2,121.5],size:0.06}
      ],
      arcs: [
        {startLat:47.6,startLng:-122.3,endLat:51.5,endLng:-0.12,arcAlt:0.35,color:['rgba(120,180,255,0.9)','rgba(120,180,255,0)']},
        {startLat:51.5,startLng:-0.12,endLat:35.7,endLng:139.7,arcAlt:0.44,color:['rgba(255,255,255,0.8)','rgba(255,255,255,0)']},
        {startLat:47.6,startLng:-122.3,endLat:35.7,endLng:139.7,arcAlt:0.5,color:['rgba(160,200,255,0.75)','rgba(160,200,255,0)']},
        {startLat:40.7,startLng:-74.0,endLat:51.5,endLng:-0.12,arcAlt:0.28,color:['rgba(255,255,255,0.9)','rgba(255,255,255,0)']},
        {startLat:35.7,startLng:139.7,endLat:22.3,endLng:114.2,arcAlt:0.18,color:['rgba(180,220,255,0.9)','rgba(180,220,255,0)']},
        {startLat:40.7,startLng:-74.0,endLat:-23.5,endLng:-46.6,arcAlt:0.32,color:['rgba(255,255,255,0.7)','rgba(255,255,255,0)']},
        {startLat:43.6,startLng:-79.4,endLat:22.3,endLng:114.2,arcAlt:0.46,color:['rgba(140,190,255,0.65)','rgba(140,190,255,0)']},
        {startLat:52.5,startLng:13.4,endLat:1.35,endLng:103.8,arcAlt:0.38,color:['rgba(255,255,255,0.7)','rgba(255,255,255,0)']},
        {startLat:51.5,startLng:-0.12,endLat:28.6,endLng:77.2,arcAlt:0.36,color:['rgba(180,220,255,0.65)','rgba(180,220,255,0)']},
        {startLat:47.6,startLng:-122.3,endLat:-33.9,endLng:151.2,arcAlt:0.52,color:['rgba(255,255,255,0.55)','rgba(255,255,255,0)']},
        {startLat:31.2,startLng:121.5,endLat:35.7,endLng:139.7,arcAlt:0.14,color:['rgba(180,220,255,0.8)','rgba(180,220,255,0)']},
        {startLat:40.7,startLng:-74.0,endLat:19.4,endLng:-99.1,arcAlt:0.2,color:['rgba(255,255,255,0.75)','rgba(255,255,255,0)']}
      ],
      arcAnimationDuration: 1800,
      onRender: function(state) { if (!dragging) phi += 0.0028; state.phi=phi; state.theta=theta; }
    });

    canvas.addEventListener('mousedown',function(e){dragging=true;lastX=e.clientX;lastY=e.clientY;});
    window.addEventListener('mouseup',function(){dragging=false;});
    window.addEventListener('mousemove',function(e){
      if(!dragging)return;
      phi+=(e.clientX-lastX)*0.005; theta-=(e.clientY-lastY)*0.005;
      theta=Math.max(-1.4,Math.min(1.4,theta)); lastX=e.clientX; lastY=e.clientY;
    });
    canvas.addEventListener('touchstart',function(e){dragging=true;lastX=e.touches[0].clientX;lastY=e.touches[0].clientY;},{passive:true});
    canvas.addEventListener('touchend',function(){dragging=false;});
    canvas.addEventListener('touchmove',function(e){
      if(!dragging)return;
      phi+=(e.touches[0].clientX-lastX)*0.005; theta-=(e.touches[0].clientY-lastY)*0.005;
      lastX=e.touches[0].clientX; lastY=e.touches[0].clientY;
    },{passive:true});

    var syncEl = document.getElementById('sxSyncCount');
    if (syncEl) {
      var count = 2847;
      setInterval(function(){ count+=Math.floor(Math.random()*3)+1; syncEl.textContent=count.toLocaleString(); },2200);
    }
  }
  init();

  /* ── Toasts ──────────────────────────────────────── */
  var toastEl = document.getElementById('sxToasts');
  var msgs = [
    {mkt:'amazon',text:'Amazon · 847 SKUs synced'},
    {mkt:'ebay',text:'eBay · prices updated'},
    {mkt:'shopify',text:'Shopify · stock pushed'},
    {mkt:'walmart',text:'Walmart · 38 items listed'},
    {mkt:'etsy',text:'Etsy · inventory locked'},
    {mkt:'tiktok',text:'TikTok · catalog refreshed'},
    {mkt:'meta',text:'Meta · feed synced'}
  ];
  var tIdx = 0;

  function showToast() {
    if (!toastEl) return;
    var msg = msgs[tIdx % msgs.length]; tIdx++;
    var logo = document.querySelector('.sx-mkt-chip[data-mkt="'+msg.mkt+'"]');
    if (logo) { logo.classList.add('active'); setTimeout(function(){ logo.classList.remove('active'); },2500); }

    // Fire pulse ring on globe
    var ringContainer = document.getElementById('sxPulseRings');
    if (ringContainer) {
      var ring = document.createElement('div');
      ring.className = 'sx-pulse-ring';
      var size = 60 + Math.random() * 40;
      ring.style.width  = size + 'px';
      ring.style.height = size + 'px';
      ringContainer.appendChild(ring);
      setTimeout(function(){ if (ring.parentNode) ring.parentNode.removeChild(ring); }, 1900);
    }

    var t = document.createElement('div');
    t.className = 'sx-sync-toast';
    t.innerHTML = '<span class="sx-sync-toast__dot"></span><span>'+msg.text+'</span>';
    toastEl.appendChild(t);
    requestAnimationFrame(function(){ requestAnimationFrame(function(){ t.classList.add('visible'); }); });
    setTimeout(function(){ t.classList.remove('visible'); setTimeout(function(){ if(t.parentNode)t.parentNode.removeChild(t); },350); },2600);
    var all = toastEl.querySelectorAll('.sx-sync-toast');
    if (all.length > 3) { var old=all[0]; old.classList.remove('visible'); setTimeout(function(){ if(old.parentNode)old.parentNode.removeChild(old); },350); }
  }

  setTimeout(showToast,1200);
  setInterval(showToast,3000);

})();



/* ── AXIS EKG + ops counter ─────────────────────── */
(function() {

  /* ops counter */
  var opsEl = document.getElementById('axisOpsCount');
  if (opsEl) {
    var ops = 847;
    setInterval(function() {
      ops += Math.floor(Math.random() * 5) - 1;
      if (ops < 810) ops = 825;
      if (ops > 900) ops = 875;
      opsEl.textContent = ops;
    }, 1800);
  }

  /* EKG — use fixed attribute dimensions so canvas never gets 0 */
  var canvas = document.getElementById('axisEKG');
  if (!canvas) return;

  /* Canvas has width=600 height=34 in HTML — use those directly */
  var W   = 600;
  var H   = 34;
  var mid = H / 2;
  var ctx = canvas.getContext('2d');

  /* One beat shape: array of [x(0-100), y(-1..1)] */
  var SHAPE = [
    [0,0],[8,0],[13,0],[17,-0.65],[22,1],[26,-0.35],[30,0],
    [38,0],[43,0],[47,-0.55],[52,0.85],[56,-0.28],[60,0],
    [68,0],[73,0],[77,-0.5],[82,0.75],[86,-0.22],[90,0],[100,0]
  ];
  var BEAT_PX = 150; /* width of one beat in canvas pixels */
  var SPEED   = 55;  /* px per second */
  var GAP     = 20;  /* dark eraser gap ahead of scan head */

  /* circular buffer of {x,y} drawn so far */
  var pts     = [];
  var scanX   = 0;
  var last    = null;

  function beatY(px) {
    var frac = (px % BEAT_PX) / BEAT_PX * 100;
    for (var i = 0; i < SHAPE.length - 1; i++) {
      if (frac >= SHAPE[i][0] && frac <= SHAPE[i+1][0]) {
        var t = (frac - SHAPE[i][0]) / (SHAPE[i+1][0] - SHAPE[i][0]);
        var amp = SHAPE[i][1] + t * (SHAPE[i+1][1] - SHAPE[i][1]);
        return mid - amp * (H * 0.44);
      }
    }
    return mid;
  }

  function frame(ts) {
    if (!last) last = ts;
    var dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    scanX = (scanX + SPEED * dt) % W;

    var y = beatY(scanX);
    pts.push({ x: scanX, y: y });

    /* remove points inside the gap ahead of the scan head */
    var gapStart = (scanX + 1) % W;
    var gapEnd   = (scanX + GAP) % W;
    pts = pts.filter(function(p) {
      if (gapStart < gapEnd) return p.x < gapStart || p.x > gapEnd;
      return p.x < gapStart && p.x > gapEnd;
    });

    /* clear entire canvas */
    ctx.clearRect(0, 0, W, H);

    if (pts.length < 2) { requestAnimationFrame(frame); return; }

    /* glow pass */
    ctx.save();
    ctx.shadowColor  = 'rgba(255,255,255,0.4)';
    ctx.shadowBlur   = 5;
    ctx.strokeStyle  = 'rgba(255,255,255,0.18)';
    ctx.lineWidth    = 3;
    ctx.lineJoin     = 'round';
    ctx.lineCap      = 'round';
    stroke();
    ctx.restore();

    /* crisp green line */
    ctx.strokeStyle  = 'rgba(255,255,255,0.65)';
    ctx.lineWidth    = 1.5;
    ctx.lineJoin     = 'round';
    ctx.lineCap      = 'round';
    stroke();

    /* scan head dot */
    ctx.beginPath();
    ctx.arc(scanX, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle   = 'rgba(255,255,255,0.9)';
    ctx.shadowColor = 'rgba(255,255,255,0.5)';
    ctx.shadowBlur  = 8;
    ctx.fill();

    requestAnimationFrame(frame);
  }

  function stroke() {
    ctx.beginPath();
    var moved = false;
    for (var i = 1; i < pts.length; i++) {
      var jump = Math.abs(pts[i].x - pts[i-1].x) > BEAT_PX * 0.6;
      if (!moved || jump) { ctx.moveTo(pts[i].x, pts[i].y); moved = true; }
      else ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  }

  requestAnimationFrame(frame);

})();

/* ── AXIS Live Price Ticker ──────────────────────── */
(function() {
  var rows = [
    { mkt:'amazon',   img:'assets/icons/marketplaces/amazon.svg',   sku:'B08N5WRWNW',  base:31.50 },
    { mkt:'ebay',     img:'assets/icons/marketplaces/ebay.svg',      sku:'SKU-EB-4421', base:23.49 },
    { mkt:'shopify',  img:'assets/icons/marketplaces/shopify.svg',   sku:'PROD-SH-887', base:84.99 },
    { mkt:'walmart',  img:'assets/icons/marketplaces/walmart.svg',   sku:'WM-ITM-0091', base:44.00 },
    { mkt:'etsy',     img:'assets/icons/marketplaces/etsy.svg',      sku:'ETY-CRAFT-14',base:19.50 },
  ];

  var container = document.getElementById('axisTickerRows');
  var countEl   = document.getElementById('axisTickerCount');
  var adjCount  = 847;
  if (!container) return;

  function fmt(n) { return '$' + n.toFixed(2); }

  function refreshRow() {
    var r    = rows[Math.floor(Math.random() * rows.length)];
    var old  = r.base;
    var delta= (Math.random() * 6 - 3);
    var next = Math.max(old * 0.8, old + delta);
    next     = Math.round(next * 100) / 100;
    var up   = next > old;
    r.base   = next;
    adjCount++;
    if (countEl) countEl.textContent = adjCount.toLocaleString();

    var el = document.createElement('div');
    el.className = 'sx-ticker__row';
    el.innerHTML =
      '<img src="' + r.img + '" width="11" height="11" alt="">' +
      '<span class="sx-ticker__sku">' + r.sku + '</span>' +
      '<span class="sx-ticker__old">' + fmt(old) + '</span>' +
      '<span class="sx-ticker__arrow ' + (up ? 'sx-ticker__arrow--up' : 'sx-ticker__arrow--down') + '">' + (up ? '▲' : '▼') + '</span>' +
      '<span class="sx-ticker__new">' + fmt(next) + '</span>';

    container.insertBefore(el, container.firstChild);
    if (container.children.length > 5) container.removeChild(container.lastChild);
  }

  setInterval(refreshRow, 2200);
})();

// Dark mode only — light theme disabled for now
(function() {
  document.documentElement.classList.add('dark');
  localStorage.setItem('theme', 'dark');
})();

function initThemeToggle() {}

// Navbar scroll effect
const navbar = document.getElementById('navbar');
if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

// Hamburger / mobile menu
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
const mobileMenuClose = document.getElementById('mobileMenuClose');

function openMobileMenu() {
  mobileMenu.classList.add('open');
  hamburger.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
  mobileMenu.classList.remove('open');
  hamburger.classList.remove('open');
  document.body.style.overflow = '';
}

if (hamburger && mobileMenu) {
  hamburger.addEventListener('click', () => {
    if (mobileMenu.classList.contains('open')) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  if (mobileMenuClose) {
    mobileMenuClose.addEventListener('click', closeMobileMenu);
  }

  mobileMenu.addEventListener('click', (e) => {
    if (e.target === mobileMenu) closeMobileMenu();
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMobileMenu);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
      closeMobileMenu();
    }
  });
}

// Fade-up on scroll
const fadeEls = document.querySelectorAll('.fade-up');
if (fadeEls.length) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
  fadeEls.forEach(el => observer.observe(el));
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

initThemeToggle();

// Cursor glow effect — cyan tint, full page
if (window.matchMedia('(pointer: fine)').matches) {
  const cursor = document.createElement('div');
  cursor.style.cssText = `
    position:fixed;pointer-events:none;z-index:9999;
    width:500px;height:500px;border-radius:50%;
    background:radial-gradient(circle, rgba(0,207,255,0.07) 0%, transparent 65%);
    transform:translate(-50%,-50%);transition:left 0.12s ease,top 0.12s ease;
    left:-300px;top:-300px;
  `;
  document.body.appendChild(cursor);
  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
  });
}

// ===================== HERO AUTOPLAY ENGINE =====================

const HERO_STATES = [
  {
    node: 'shopify',
    icon: 'assets/icons/marketplaces/shopify.svg',
    title: 'Shopify Automation',
    status: 'Syncing',
    tasks: [
      'AI generated product title',
      'Pricing rule created',
      'Inventory sync active',
      'Marketing feed prepared',
    ],
    complete: 'Shopify sync complete',
    result: 'Storefront automation synced',
    metric: 'Catalog Health +12',
  },
  {
    node: 'amazon',
    icon: 'assets/icons/marketplaces/amazon.svg',
    title: 'Amazon Automation',
    status: 'Syncing',
    tasks: [
      'Buy box margin checked',
      'Competitor price scanned',
      'Inventory quantity matched',
      'Listing data optimized',
    ],
    complete: 'Amazon sync complete',
    result: 'Amazon channel updated',
    metric: 'Margin +18%',
  },
  {
    node: 'walmart',
    icon: 'assets/icons/marketplaces/walmart.svg',
    title: 'Walmart Protection',
    status: 'Protecting',
    tasks: [
      'Stock level checked',
      'OOS item paused',
      'Safety buffer applied',
      'Marketplace rule verified',
    ],
    complete: 'Walmart sync complete',
    result: 'Protection active',
    metric: 'Oversell Blocked',
  },
  {
    node: 'etsy',
    icon: 'assets/icons/marketplaces/etsy.svg',
    title: 'Etsy Listing Flow',
    status: 'Optimizing',
    tasks: [
      'Keywords improved',
      'Photos mapped',
      'Description cleaned',
      'Tags prepared',
    ],
    complete: 'Etsy sync complete',
    result: 'Listing optimized',
    metric: 'SEO Score +24',
  },
  {
    node: 'tiktok',
    icon: 'assets/icons/marketplaces/tiktok.svg',
    title: 'TikTok Shop Feed',
    status: 'Publishing',
    tasks: [
      'Product feed formatted',
      'Creative hook generated',
      'Price checked',
      'Stock synced',
    ],
    complete: 'TikTok feed live',
    result: 'Social commerce ready',
    metric: 'Feed Clean',
  },
  {
    node: 'ebay',
    icon: 'assets/icons/marketplaces/ebay.svg',
    title: 'eBay Listing Sync',
    status: 'Syncing',
    tasks: [
      'Listing title cleaned',
      'Item specifics mapped',
      'Price compared',
      'Inventory quantity synced',
    ],
    complete: 'eBay listing updated',
    result: 'Marketplace listing synced',
    metric: 'Listing Score +31',
  },
  {
    node: 'google',
    icon: 'assets/icons/marketplaces/google.svg',
    title: 'Google Merchant Feed',
    status: 'Validating',
    tasks: [
      'Product taxonomy fixed',
      'Missing fields repaired',
      'Feed errors checked',
      'Product data validated',
    ],
    complete: 'Merchant feed synced',
    result: 'Google feed ready',
    metric: 'Feed Errors 0',
  },
  {
    node: 'facebook',
    icon: 'assets/icons/marketplaces/facebook.svg',
    title: 'Facebook Catalog Sync',
    status: 'Syncing',
    tasks: [
      'Catalog fields cleaned',
      'Image set checked',
      'Variant data matched',
      'Audience signal prepared',
    ],
    complete: 'Catalog sync complete',
    result: 'Meta catalog synced',
    metric: 'Ads Feed Ready',
  },
  {
    node: 'woocommerce',
    icon: 'assets/icons/marketplaces/woocommerce.svg',
    title: 'WooCommerce Sync',
    status: 'Syncing',
    tasks: [
      'Catalog scanned',
      'Price updated',
      'Inventory matched',
      'Product rules applied',
    ],
    complete: 'WooCommerce sync complete',
    result: 'Store catalog synced',
    metric: 'Price Rule Live',
  },
];

// SVG coordinate lookup for each node (matches the SVG viewBox connector endpoints)
const NODE_SVG_COORDS = {
  shopify:     { x: 300, y:  56 },
  amazon:      { x: 520, y: 120 },
  walmart:     { x: 564, y: 300 },
  etsy:        { x: 520, y: 480 },
  tiktok:      { x: 300, y: 544 },
  ebay:        { x:  80, y: 480 },
  google:      { x:  36, y: 300 },
  facebook:    { x:  80, y: 120 },
  woocommerce: { x: 160, y:  56 },
};

const ORB_CENTER = { x: 300, y: 300 };

function initHeroAutoplay() {
  const dashTitle    = document.getElementById('heroDashTitle');
  const dashIcon     = document.getElementById('heroDashIcon');
  const dashStatus   = document.getElementById('heroDashStatus');
  const dashTasks    = document.getElementById('heroDashTasks');
  const dashResult   = document.getElementById('heroDashResult');
  const dashProgress = document.getElementById('heroDashProgress');
  const dataDot      = document.getElementById('heroDataDot');
  const metricAnchor = document.getElementById('heroMetricAnchor');
  const orbLines     = document.getElementById('heroOrbLines');
  const cursorLight  = document.getElementById('heroCursorLight');

  if (!dashTitle || !dataDot) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let currentIdx = 0;
  let dotAnimFrame = null;
  let metricTimeout = null;

  // Cursor light on hero-right
  const heroRight = document.querySelector('.hero-right');
  if (heroRight && cursorLight && window.matchMedia('(pointer: fine)').matches) {
    heroRight.addEventListener('mousemove', e => {
      const rect = heroRight.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1) + '%';
      const py = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1) + '%';
      cursorLight.style.setProperty('--cursor-x', px);
      cursorLight.style.setProperty('--cursor-y', py);
    }, { passive: true });
  }

  function buildTasks(state) {
    dashTasks.innerHTML = '';
    state.tasks.forEach(t => {
      const row = document.createElement('div');
      row.className = 'hero-dash-task';
      row.innerHTML = `<span class="hero-dash-task-dot"></span><span>${t}</span>`;
      dashTasks.appendChild(row);
    });
    const last = document.createElement('div');
    last.className = 'hero-dash-task hero-dash-task--complete';
    last.innerHTML = `<span class="hero-dash-task-dot hero-dash-task-dot--done"></span><span>${state.complete}</span>`;
    dashTasks.appendChild(last);
  }

  function clearActiveNode() {
    document.querySelectorAll('.hero-node--active').forEach(n => n.classList.remove('hero-node--active'));
  }

  function clearActiveConnector() {
    if (!orbLines) return;
    orbLines.querySelectorAll('.hero-cn--active').forEach(l => l.classList.remove('hero-cn--active'));
  }

  function activateNode(nodeKey) {
    const node = document.querySelector(`.hero-node[data-node="${nodeKey}"]`);
    if (node) node.classList.add('hero-node--active');
  }

  function activateConnector(nodeKey) {
    if (!orbLines) return;
    const cn = orbLines.querySelector(`.hero-cn[data-cn="${nodeKey}"]`);
    if (cn) cn.classList.add('hero-cn--active');
  }

  function showMetricChip(text) {
    if (metricAnchor) metricAnchor.innerHTML = '';
    if (metricTimeout) clearTimeout(metricTimeout);
    const chip = document.createElement('div');
    chip.className = 'hero-metric-chip';
    chip.textContent = text;
    if (metricAnchor) metricAnchor.appendChild(chip);
    metricTimeout = setTimeout(() => {
      if (metricAnchor) metricAnchor.innerHTML = '';
    }, 3000);
  }

  function animateDataDot(nodeKey, onComplete) {
    if (reducedMotion || !orbLines || !dataDot) {
      onComplete && onComplete();
      return;
    }
    const target = NODE_SVG_COORDS[nodeKey];
    if (!target) { onComplete && onComplete(); return; }

    const dx = target.x - ORB_CENTER.x;
    const dy = target.y - ORB_CENTER.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = 900; // ms
    let startTime = null;

    if (dotAnimFrame) cancelAnimationFrame(dotAnimFrame);
    dataDot.setAttribute('opacity', '1');

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      dataDot.setAttribute('cx', ORB_CENTER.x + dx * eased);
      dataDot.setAttribute('cy', ORB_CENTER.y + dy * eased);

      if (progress < 1) {
        dotAnimFrame = requestAnimationFrame(step);
      } else {
        dataDot.setAttribute('opacity', '0');
        dotAnimFrame = null;
        onComplete && onComplete();
      }
    }
    dotAnimFrame = requestAnimationFrame(step);
  }

  function applyState(idx) {
    const state = HERO_STATES[idx];

    // Update dashboard content
    dashIcon.src = state.icon;
    dashIcon.alt = state.node;
    dashTitle.textContent = state.title;
    dashStatus.textContent = state.status;
    buildTasks(state);
    dashResult.textContent = state.result;

    // Reset and animate progress bar
    dashProgress.style.transition = 'none';
    dashProgress.style.width = '0%';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dashProgress.style.transition = 'width 3.2s linear';
        dashProgress.style.width = '100%';
      });
    });

    // Clear previous active state
    clearActiveNode();
    clearActiveConnector();

    // Animate data dot, then activate node + connector + metric
    animateDataDot(state.node, () => {
      activateNode(state.node);
      activateConnector(state.node);
      showMetricChip(state.metric);
    });
  }

  // Initial state
  applyState(currentIdx);

  // Autoplay cycle every 3.6 seconds
  setInterval(() => {
    currentIdx = (currentIdx + 1) % HERO_STATES.length;
    applyState(currentIdx);
  }, 3600);
}

// Init after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { initHeroAutoplay(); initHeroRail(); initMobileScrollFocus(); initAxisChat(); initHeroDemoVideo(); });
} else {
  initHeroAutoplay();
  initHeroRail();
  initMobileScrollFocus();
  initAxisChat();
  initHeroDemoVideo();
}

// ===================== MOBILE SCROLL FOCUS =====================
function initMobileScrollFocus() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const CARD_SELECTORS = [
    '.card',
    '.trust-card',
    '.mission-card',
    '.team-card',
    '.role-card',
    '.service-card',
    '.solution-card',
    '.onboarding-step',
    '.gw-step',
    '.gw-install-card',
  ].join(',');

  function isMobile() {
    return window.innerWidth <= 768;
  }

  function tagCards() {
    document.querySelectorAll(CARD_SELECTORS).forEach(el => {
      el.classList.add('scroll-focusable');
    });
  }

  function updateFocus() {
    if (!isMobile()) {
      // On desktop: clear all mobile states
      document.querySelectorAll('.scroll-focus-active, .scroll-focus-dimmed, .scroll-in-view').forEach(el => {
        el.classList.remove('scroll-focus-active', 'scroll-focus-dimmed', 'scroll-in-view');
      });
      return;
    }

    const cards = Array.from(document.querySelectorAll('.scroll-focusable'));
    if (!cards.length) return;

    const vpMid = window.innerHeight / 2;
    let closestCard = null;
    let closestDist = Infinity;

    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      card.classList.toggle('scroll-in-view', inView);

      if (inView) {
        const cardMid = rect.top + rect.height / 2;
        const dist = Math.abs(cardMid - vpMid);
        if (dist < closestDist) {
          closestDist = dist;
          closestCard = card;
        }
      }
    });

    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      if (card === closestCard) {
        card.classList.add('scroll-focus-active');
        card.classList.remove('scroll-focus-dimmed');
      } else if (inView) {
        card.classList.remove('scroll-focus-active');
        card.classList.add('scroll-focus-dimmed');
      } else {
        card.classList.remove('scroll-focus-active', 'scroll-focus-dimmed');
      }
    });
  }

  tagCards();

  let ticking = false;
  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        updateFocus();
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  // Initial pass
  updateFocus();
}

// ===================== HERO ROBOT RAIL =====================
function initHeroRail() {
  const rail     = document.getElementById('heroRail');
  const robot    = document.getElementById('railRobot');
  const track    = rail && rail.querySelector('.hero-rail-track');
  if (!rail || !robot || !track) return;

  // Respect prefers-reduced-motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const bubbleLeft      = document.getElementById('railBubbleLeft');
  const bubbleLeftIcon  = document.getElementById('railBubbleLeftIcon');
  const bubbleLeftText  = document.getElementById('railBubbleLeftText');
  const bubbleRight     = document.getElementById('railBubbleRight');
  const bubbleRightIcon = document.getElementById('railBubbleRightIcon');
  const bubbleRightText = document.getElementById('railBubbleRightText');
  const radarRings      = robot.querySelectorAll('.hero-rail-radar-ring');

  // Bubble sequences: [icon path, label]
  const LEFT_BUBBLES = [
    ['assets/svg/robot3.svg',      'AI Ready'],
    ['assets/svg/think.svg',       'Analyzing'],
    ['assets/svg/ecom.svg',        'Sync Init'],
    ['assets/svg/robot3.svg',      'Queued'],
    ['assets/svg/think.svg',       'Optimizing'],
  ];
  const RIGHT_BUBBLES = [
    ['assets/svg/money.svg',       'Price Live'],
    ['assets/svg/shopify.svg',     'Listed'],
    ['assets/svg/amazon.svg',      'Synced'],
    ['assets/svg/review.svg',      'SEO Fixed'],
    ['assets/svg/happy.svg',       'Stock OK'],
    ['assets/svg/email.svg',       'Feed Clean'],
    ['assets/svg/speaker.svg',     'Margin Up'],
    ['assets/svg/ebay.svg',        'eBay Live'],
    ['assets/svg/ecom.svg',        'Store Ready'],
  ];

  let leftIdx  = 0;
  let rightIdx = 0;

  function ease(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function getNodeX(side) {
    const nodeEl = rail.querySelector(side === 'left' ? '.hero-rail-node--left' : '.hero-rail-node--right');
    const trackRect = track.getBoundingClientRect();
    const nodeRect  = nodeEl.getBoundingClientRect();
    return (nodeRect.left + nodeRect.width / 2) - trackRect.left;
  }

  function popBubble(bubbleEl, iconEl, textEl, pool, idxRef) {
    const [src, label] = pool[idxRef % pool.length];
    iconEl.src = src;
    textEl.textContent = label;
    bubbleEl.classList.remove('pop');
    void bubbleEl.offsetWidth;
    bubbleEl.classList.add('pop');
    return idxRef + 1;
  }

  function triggerArrival() {
    // Green strobe flash
    robot.classList.remove('strobe');
    void robot.offsetWidth;
    robot.classList.add('strobe');
    robot.addEventListener('animationend', () => robot.classList.remove('strobe'), { once: true });

    // Radar rings — staggered via CSS delay, just re-trigger
    radarRings.forEach(ring => {
      ring.classList.remove('ping');
      void ring.offsetWidth;
      ring.classList.add('ping');
      ring.addEventListener('animationend', () => ring.classList.remove('ping'), { once: true });
    });
  }

  function travel(fromSide, duration, onDone) {
    const fromX = getNodeX(fromSide);
    const toX   = getNodeX(fromSide === 'left' ? 'right' : 'left');
    const start = performance.now();

    if (fromSide === 'left') {
      robot.classList.remove('flipped');
    } else {
      robot.classList.add('flipped');
    }

    function step(now) {
      const elapsed = now - start;
      const raw = Math.min(elapsed / duration, 1);
      const t   = ease(raw);
      robot.style.left = (fromX + (toX - fromX) * t) + 'px';
      if (raw < 1) {
        requestAnimationFrame(step);
      } else {
        robot.style.left = toX + 'px';
        triggerArrival();
        onDone && onDone();
      }
    }
    requestAnimationFrame(step);
  }

  function runCycle() {
    // Phase 1: pause at left, pop left bubble, then travel right
    setTimeout(() => {
      leftIdx = popBubble(bubbleLeft, bubbleLeftIcon, bubbleLeftText, LEFT_BUBBLES, leftIdx);
    }, 400);

    setTimeout(() => {
      travel('left', 3200, () => {
        // Phase 2: arrived right, pop right bubble, pause, then return
        rightIdx = popBubble(bubbleRight, bubbleRightIcon, bubbleRightText, RIGHT_BUBBLES, rightIdx);

        setTimeout(() => {
          travel('right', 3200, () => {
            // Back at left — small pause then repeat
            setTimeout(runCycle, 700);
          });
        }, 1600);
      });
    }, 1200);
  }

  // Position robot at left node initially
  robot.style.left = getNodeX('left') + 'px';

  // Recalculate on resize
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      robot.style.left = getNodeX('left') + 'px';
    }, 100);
  }, { passive: true });

  // Kick off after a short delay so layout is settled
  setTimeout(runCycle, 800);
}

// ===================== AXIS TYPING CHAT =====================
function initAxisChat() {
  const msgEl    = document.getElementById('axisChatMsg');
  const textEl   = document.getElementById('axisChatText');
  const iconEl   = document.getElementById('axisChatIcon');
  const typingEl = document.getElementById('axisTyping');
  if (!msgEl || !textEl) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    textEl.textContent = 'Monitoring all channels...';
    textEl.classList.add('axis-done');
    return;
  }

  const MESSAGES = [
    { icon: 'assets/icons/marketplaces/shopify.svg',     text: 'Shopify: repriced 14 SKUs within margin rules' },
    { icon: 'assets/icons/marketplaces/amazon.svg',      text: 'Amazon: suppressed listing repaired automatically' },
    { icon: 'assets/icons/marketplaces/ebay.svg',        text: 'eBay: item specifics mapped on 31 listings' },
    { icon: 'assets/icons/marketplaces/walmart.svg',     text: 'Walmart: inventory quantity synced across 3 DCs' },
    { icon: 'assets/icons/marketplaces/etsy.svg',        text: 'Etsy: SEO titles regenerated for new collection' },
    { icon: 'assets/icons/marketplaces/tiktok.svg',      text: 'TikTok Shop: feed refreshed, 0 errors detected' },
    { icon: 'assets/icons/marketplaces/google.svg',      text: 'Google Merchant: feed errors cleared, 100% valid' },
    { icon: 'assets/icons/marketplaces/facebook.svg',    text: 'Meta Catalog: variant data matched and published' },
    { icon: 'assets/icons/marketplaces/woocommerce.svg', text: 'WooCommerce: pricing rule triggered on 8 products' },
    { icon: null, text: 'Monitoring competitors — no action required' },
    { icon: null, text: 'Compliance scan complete — all listings clean' },
    { icon: null, text: 'Oversell protection active on all channels' },
    { icon: null, text: 'Reorder triggered: SKU-2847 below threshold' },
    { icon: null, text: 'Customer inquiry auto-resolved in 4 seconds' },
  ];

  let idx = 0;
  let charIdx = 0;
  let typeTimer = null;
  let phaseTimer = null;

  function showTyping(show) {
    if (show) {
      typingEl.classList.add('axis-typing-visible');
    } else {
      typingEl.classList.remove('axis-typing-visible');
    }
  }

  function typeMessage(entry) {
    // Build icon
    if (entry.icon) {
      iconEl.innerHTML = `<img src="${entry.icon}" alt="" width="16" height="16">`;
    } else {
      iconEl.innerHTML = `<svg viewBox="0 0 16 16" width="14" height="14" style="opacity:.6"><circle cx="8" cy="8" r="6" stroke="#00CFFF" stroke-width="1.5" fill="none"/><polyline points="5,8 7,10 11,6" stroke="#00CFFF" stroke-width="1.5" fill="none" stroke-linecap="round"/></svg>`;
    }

    const full = entry.text;
    charIdx = 0;
    textEl.textContent = '';
    textEl.classList.remove('axis-done');
    msgEl.classList.add('axis-chat-msg--visible');

    function typeChar() {
      if (charIdx <= full.length) {
        textEl.textContent = full.slice(0, charIdx);
        charIdx++;
        // Vary typing speed for human feel
        const delay = charIdx === full.length ? 0 : (30 + Math.random() * 28);
        typeTimer = setTimeout(typeChar, delay);
      } else {
        // Finished typing — mark done (hide cursor), pause, then next
        textEl.classList.add('axis-done');
        phaseTimer = setTimeout(() => {
          // Fade out message
          msgEl.classList.remove('axis-chat-msg--visible');
          phaseTimer = setTimeout(nextMessage, 350);
        }, 2800);
      }
    }
    typeChar();
  }

  function nextMessage() {
    idx = (idx + 1) % MESSAGES.length;
    // Show typing indicator first
    showTyping(true);
    phaseTimer = setTimeout(() => {
      showTyping(false);
      typeMessage(MESSAGES[idx]);
    }, 900 + Math.random() * 500);
  }

  // Kick off
  typeMessage(MESSAGES[0]);
}

// ===================== HERO DEMO VIDEO PLACEHOLDER =====================
function initHeroDemoVideo() {
  const video = document.getElementById('heroDemoVideo');
  const placeholder = document.getElementById('heroDemoPlaceholder');
  if (!video || !placeholder) return;

  // If video actually loads, hide placeholder
  video.addEventListener('loadeddata', () => {
    placeholder.style.display = 'none';
    video.setAttribute('data-loaded', '1');
  });

  // If src is missing or empty, keep placeholder
  const source = video.querySelector('source');
  if (!source || !source.src || source.getAttribute('src') === '') {
    video.style.display = 'none';
  }
}

// ===================== SYNBALL PROXIMITY BEAMS =====================
(function initSynballBeams() {
  const canvas = document.getElementById('synball-beam-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const TRIGGER_DIST = 260;   // px from synball center to start beam
  const BEAM_MAX_W   = 2.2;   // max stroke width
  const PARTICLE_COUNT = 5;   // sparks per synball when active

  let mouse = { x: -9999, y: -9999 };
  let rafId = null;

  // Resize canvas to fill viewport
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  // Track mouse globally
  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });

  // Gather all synball watermarks — we poll their positions each frame
  // so they work even after scroll/resize
  function getSynballs() {
    return Array.from(document.querySelectorAll('.synball-watermark'));
  }

  // Per-synball particle state
  const particleMap = new WeakMap();
  function getParticles(el) {
    if (!particleMap.has(el)) {
      particleMap.set(el, Array.from({ length: PARTICLE_COUNT }, () => newParticle(el, true)));
    }
    return particleMap.get(el);
  }

  function newParticle(el, immediate) {
    return {
      progress: immediate ? Math.random() : 0,
      speed: 0.004 + Math.random() * 0.006,
      offset: (Math.random() - 0.5) * 18,   // perpendicular jitter
      width: 0.4 + Math.random() * 1.2,
      alpha: 0.3 + Math.random() * 0.5,
    };
  }

  function getCenter(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 };
  }

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const synballs = getSynballs();
    const mx = mouse.x, my = mouse.y;

    synballs.forEach(el => {
      const c = getCenter(el);
      const d = dist(c, { x: mx, y: my });
      const proximity = 1 - Math.min(d / TRIGGER_DIST, 1); // 0 = far, 1 = touching

      if (proximity <= 0) {
        el.classList.remove('synball-active');
        return;
      }

      el.classList.add('synball-active');

      // Direction vector from synball to mouse
      const dx = mx - c.x;
      const dy = my - c.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = dx / len;
      const ny = dy / len;
      // Perpendicular
      const px = -ny;
      const py =  nx;

      // Beam start: edge of synball circle
      const startX = c.x + nx * (c.r + 4);
      const startY = c.y + ny * (c.r + 4);
      // Beam end: mouse cursor
      const endX = mx;
      const endY = my;

      // ---- Main beam ----
      const beamAlpha = 0.18 + proximity * 0.55;
      const beamW = 0.6 + proximity * BEAM_MAX_W;

      // Outer glow pass
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      const grad = ctx.createLinearGradient(startX, startY, endX, endY);
      grad.addColorStop(0, `rgba(0,207,255,${beamAlpha * 0.35})`);
      grad.addColorStop(0.5, `rgba(0,160,255,${beamAlpha * 0.55})`);
      grad.addColorStop(1, `rgba(255,255,255,${beamAlpha * 0.8})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = beamW * 3.5;
      ctx.lineCap = 'round';
      ctx.filter = 'blur(3px)';
      ctx.stroke();
      ctx.filter = 'none';

      // Core beam
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      const coreGrad = ctx.createLinearGradient(startX, startY, endX, endY);
      coreGrad.addColorStop(0, `rgba(0,230,255,${beamAlpha})`);
      coreGrad.addColorStop(0.6, `rgba(80,180,255,${beamAlpha * 0.9})`);
      coreGrad.addColorStop(1, `rgba(255,255,255,${beamAlpha * 0.95})`);
      ctx.strokeStyle = coreGrad;
      ctx.lineWidth = beamW;
      ctx.stroke();

      // ---- Travelling particles along the beam ----
      const particles = getParticles(el);
      particles.forEach(p => {
        p.progress += p.speed * (0.3 + proximity * 0.7);
        if (p.progress >= 1) {
          Object.assign(p, newParticle(el, false));
          p.progress = 0;
        }

        const t = p.progress;
        const px_ = startX + (endX - startX) * t + px * p.offset * proximity;
        const py_ = startY + (endY - startY) * t + py * p.offset * proximity;
        const sparkAlpha = p.alpha * proximity * Math.sin(Math.PI * t);
        const sparkR = p.width * (0.5 + proximity * 1.2);

        ctx.beginPath();
        ctx.arc(px_, py_, sparkR, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(160,230,255,${sparkAlpha})`;
        ctx.fill();
      });

      // ---- Cursor hit-point glow ----
      const hitGrad = ctx.createRadialGradient(mx, my, 0, mx, my, 20 * proximity);
      hitGrad.addColorStop(0, `rgba(0,220,255,${0.35 * proximity})`);
      hitGrad.addColorStop(1, 'rgba(0,150,255,0)');
      ctx.beginPath();
      ctx.arc(mx, my, 20 * proximity, 0, Math.PI * 2);
      ctx.fillStyle = hitGrad;
      ctx.fill();
    });

    rafId = requestAnimationFrame(draw);
  }

  draw();
})();

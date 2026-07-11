// Site billing — talks to the cloud API's /api/billing using the signed-in
// Cognito session. Auto-wires any .js-checkout button (data-plan) on the page.
import { getSession } from '/auth-cognito.js';

const API_BASE =
  (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : 'https://api.syndrax.io';

async function api(path, opts = {}) {
  const session = getSession();
  if (!session) {
    // Not signed in → send them to create an account first.
    window.location.href = '/signup';
    throw new Error('not signed in');
  }
  const res = await fetch(API_BASE + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + session.idToken,
      ...(opts.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export async function startCheckout(plan) {
  const { url } = await api('/api/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
  window.location.href = url;
}

export async function openPortal() {
  const { url } = await api('/api/billing/portal', { method: 'POST' });
  window.location.href = url;
}

export async function getStatus() {
  return api('/api/billing/status');
}

window.SyndraxBilling = { startCheckout, openPortal, getStatus };

// Auto-wire pricing CTAs: <button class="js-checkout" data-plan="business|enterprise">
document.querySelectorAll('.js-checkout').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const plan = btn.dataset.plan || 'business';
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Loading…';
    try {
      await startCheckout(plan);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = orig;
      if (e.message !== 'not signed in') alert(e.message);
    }
  });
});

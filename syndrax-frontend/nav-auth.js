// Shows logged-in user name + sign-out in the site nav. Decodes the Cognito
// idToken (public JWT payload) to get email/name without an extra API call.
import { getSession, signOut } from '/auth-cognito.js';

const s = getSession();
if (s) {
  let email = '', displayName = '';
  try {
    const payload = JSON.parse(atob(s.idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    email = payload.email || '';
    displayName = (payload.name || email.split('@')[0] || 'Account').split(' ')[0];
  } catch { displayName = 'Account'; }

  function makeUserNav(isMobile) {
    const wrap = document.createElement('span');
    wrap.className = 'nav-user-wrap' + (isMobile ? ' nav-user-wrap--mobile' : '');
    wrap.innerHTML = `<a href="/app" class="nav-user-name" title="${email}">${displayName}</a><button class="nav-signout">Sign out</button>`;
    wrap.querySelector('.nav-signout').addEventListener('click', () => { signOut(); location.href = '/'; });
    return wrap;
  }

  document.querySelectorAll('.nav-login').forEach(a => a.replaceWith(makeUserNav(false)));
  document.querySelectorAll('.mobile-menu-login').forEach(a => a.replaceWith(makeUserNav(true)));

  // Replace "Get Started" with "Dashboard" when signed in
  document.querySelectorAll('.nav-cta, .nav-cta-mobile').forEach(a => {
    a.textContent = 'Dashboard';
    a.href = '/app';
  });
}

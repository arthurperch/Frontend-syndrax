// Syndrax web auth — AWS Cognito (same user pool as the extension dashboard).
// Vanilla ES module, no build step. One shared place for all auth so it can be
// secured and audited in a single file.
//
// SECURITY NOTES
// - clientId / region / hosted-UI domain are PUBLIC values (safe in client code),
//   exactly like a Supabase anon key. The real protection is the pool config +
//   password policy + (server-side) IAM. No secrets live here.
// - All user-facing errors are GENERIC to prevent account enumeration: login and
//   password-reset never reveal whether an email exists.

const COGNITO = {
  region: 'us-west-2',
  clientId: '71380lad9irlpurhqiobeq9l8s',
  hostedUiDomain: 'syndrax.auth.us-west-2.amazoncognito.com',
};

const IDP_ENDPOINT = `https://cognito-idp.${COGNITO.region}.amazonaws.com/`;
const SESSION_KEY = 'syndrax_session';
export const MIN_PASSWORD = 12;

// ── low-level Cognito IDP call ───────────────────────────────────────────────
async function idp(target, body) {
  const res = await fetch(IDP_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const type = (data.__type || '').split('#').pop() || `HTTP_${res.status}`;
    const err = new Error(data.message || type);
    err.code = type;
    throw err;
  }
  return data;
}

// ── session storage ──────────────────────────────────────────────────────────
function saveSession(authResult) {
  const session = {
    idToken: authResult.IdToken,
    accessToken: authResult.AccessToken,
    refreshToken: authResult.RefreshToken,
    expiresAt: Date.now() + (authResult.ExpiresIn ?? 3600) * 1000,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (!s || !s.expiresAt || s.expiresAt < Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export function signOut() {
  localStorage.removeItem(SESSION_KEY);
  try { localStorage.removeItem('syndrax_local_dev'); } catch {}
}

/** True only on this PC's browser localhost/127.0.0.1 (never production). */
export function isLocalHost() {
  try {
    const h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
  } catch {
    return false;
  }
}

/**
 * Local-only fake session so Danish can open /app without Cognito while testing templates.
 * Does NOT work on production domains. Cloud APIs may still fail — UI + localStorage packs work.
 */
export function enableLocalDevSession(email = 'danish@syndrax.io') {
  if (!isLocalHost()) {
    throw new Error('Local preview is only available on localhost.');
  }
  const payload = {
    email,
    'cognito:groups': ['owner'],
    token_use: 'id',
    aud: COGNITO.clientId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  };
  // dashboard.js decodes with atob(mid) — use standard base64 (not url-safe)
  const mid = btoa(JSON.stringify(payload));
  const idToken = `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${mid}.localdev`;
  const session = {
    idToken,
    accessToken: 'local-dev-access',
    refreshToken: 'local-dev-refresh',
    expiresAt: Date.now() + 60 * 60 * 24 * 30 * 1000,
    localDev: true,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.setItem('syndrax_local_dev', '1');
  return session;
}

// ── public API ───────────────────────────────────────────────────────────────

// Sign in. On wrong password OR unknown email, throws the SAME generic message
// so an attacker can't tell which emails are registered.
export async function login(email, password) {
  try {
    const data = await idp('InitiateAuth', {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO.clientId,
      AuthParameters: { USERNAME: email, PASSWORD: password },
    });
    if (!data.AuthenticationResult) {
      // e.g. a challenge (NEW_PASSWORD_REQUIRED) — treat as needing the web flow
      throw genericLoginError();
    }
    return saveSession(data.AuthenticationResult);
  } catch (e) {
    if (e.code === 'UserNotConfirmedException') {
      const err = new Error('Please confirm your email first — check your inbox for the code.');
      err.code = e.code;
      throw err;
    }
    // NotAuthorized, UserNotFound, InvalidParameter → all generic
    throw genericLoginError();
  }
}

function genericLoginError() {
  return new Error('Incorrect email or password.');
}

// Self-service signup (new admin account). Cognito emails a confirmation code.
export async function signUp(email, password, fullName) {
  try {
    await idp('SignUp', {
      ClientId: COGNITO.clientId,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        ...(fullName ? [{ Name: 'name', Value: fullName }] : []),
      ],
    });
    return { ok: true };
  } catch (e) {
    // Anti-enumeration: never confirm "email already exists". Return the same
    // neutral result so the UI shows "check your email" either way.
    if (e.code === 'UsernameExistsException') return { ok: true, existing: true };
    if (e.code === 'InvalidPasswordException') {
      throw new Error(`Password must be at least ${MIN_PASSWORD} characters with a mix of letters, numbers and symbols.`);
    }
    if (e.code === 'InvalidParameterException') {
      throw new Error('Please enter a valid email and password.');
    }
    throw new Error('Could not create the account. Please try again.');
  }
}

export async function confirmSignUp(email, code) {
  try {
    await idp('ConfirmSignUp', {
      ClientId: COGNITO.clientId,
      Username: email,
      ConfirmationCode: code,
    });
    return { ok: true };
  } catch (e) {
    if (e.code === 'CodeMismatchException') throw new Error('That code is incorrect. Please re-check it.');
    if (e.code === 'ExpiredCodeException') throw new Error('That code has expired. Request a new one.');
    throw new Error('Could not confirm the account. Please try again.');
  }
}

// Always returns success-shaped result so it can't be used to probe for accounts.
export async function forgotPassword(email) {
  try {
    await idp('ForgotPassword', { ClientId: COGNITO.clientId, Username: email });
  } catch {
    /* swallow — never reveal whether the email exists */
  }
  return { ok: true };
}

export async function confirmForgotPassword(email, code, newPassword) {
  try {
    await idp('ConfirmForgotPassword', {
      ClientId: COGNITO.clientId,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    });
    return { ok: true };
  } catch (e) {
    if (e.code === 'CodeMismatchException') throw new Error('That code is incorrect.');
    if (e.code === 'ExpiredCodeException') throw new Error('That code has expired. Request a new one.');
    if (e.code === 'InvalidPasswordException') {
      throw new Error(`Password must be at least ${MIN_PASSWORD} characters with a mix of letters, numbers and symbols.`);
    }
    throw new Error('Could not reset the password. Please try again.');
  }
}

// Google / hosted-UI sign-in (redirect). Requires the app client to have the
// callback URL + Google IdP enabled in Cognito.
export function googleRedirect(redirectPath = '/') {
  const redirectUri = window.location.origin + redirectPath;
  const url =
    `https://${COGNITO.hostedUiDomain}/oauth2/authorize` +
    `?client_id=${encodeURIComponent(COGNITO.clientId)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('openid email profile')}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&identity_provider=Google`;
  window.location.href = url;
}

// Exchange the ?code= from Cognito's OAuth callback for tokens.
// Call this on the page that Cognito redirects back to (e.g. index.html).
// Returns the session if successful, null if no code in URL.
export async function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (!code) return null;

  // Clean the URL immediately so refresh doesn't re-submit the code
  const cleanUrl = window.location.pathname;
  window.history.replaceState({}, '', cleanUrl);

  const redirectUri = window.location.origin + '/';
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: COGNITO.clientId,
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`https://${COGNITO.hostedUiDomain}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    console.error('OAuth token exchange failed', await res.text());
    return null;
  }

  const data = await res.json();
  return saveSession({
    IdToken: data.id_token,
    AccessToken: data.access_token,
    RefreshToken: data.refresh_token,
    ExpiresIn: data.expires_in,
  });
}

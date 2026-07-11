// app-extension-api.js — extension data layer for the web app's Extension tab.
// Pure + dependency-injected so it is unit-testable with no DOM/network. The
// shipped app-api.js delegates to these so the tested code IS the shipped code.
//
// Contract locked by tests: production hostnames resolve to https://api.syndrax.io
// (NEVER localhost), every request carries the Cognito Bearer id token, and the
// tenant is derived server-side (we never send a tenant id).

/** Resolve the API base. Localhost ONLY when actually running on localhost. */
export function resolveExtApiBase(hostname) {
  return (hostname === 'localhost' || hostname === '127.0.0.1')
    ? 'http://localhost:3000'
    : 'https://api.syndrax.io';
}

/** Authed call. deps: { session, hostname, opts?, fetchImpl? }. */
export async function callExt(path, deps) {
  const { session, hostname, opts = {}, fetchImpl = fetch } = deps;
  if (!session || !session.idToken) throw new Error('not signed in');
  const base = resolveExtApiBase(hostname);
  const res = await fetchImpl(base + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + session.idToken,
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json().catch(() => ({}));
}

export function getExtensionStatusReq(deps) {
  return callExt('/api/extension/status', deps);
}
export function revokeExtensionReq(installationId, deps) {
  return callExt('/api/extension/revoke', { ...deps, opts: { method: 'POST', body: JSON.stringify({ installationId }) } });
}

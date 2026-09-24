/**
 * minia2a SDK — Programmatic API
 *
 * Usage:
 *   const { discover, getServices, trial } = require('@minia2a/sdk');
 */

const BASE_URL = "https://minia2a.uk";

async function fetchJSON(path) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`minia2a API: HTTP ${res.status} from ${path}`);
  return res.json();
}

/**
 * Search services by keyword query.
 * Returns scored & sorted matches from the 1,680+-service catalog.
 */
async function discover(query) {
  const data = await fetchJSON("/api/services");
  const services = data.services || [];
  const q = query.toLowerCase().split(/\s+/);

  return services
    .filter(s => s.active)
    .map(s => {
      const text = `${s.name} ${s.description} ${s.id} ${s.category || ""}`.toLowerCase();
      let score = 0;
      for (const word of q) {
        if (text.includes(word)) score += 10;
        if (s.name.toLowerCase().includes(word)) score += 20;
        if (s.id.toLowerCase().includes(word)) score += 5;
      }
      return { ...s, _score: score };
    })
    .filter(s => s._score > 0)
    .sort((a, b) => b._score - a._score);
}

/**
 * Get all active services.
 */
async function getServices() {
  const data = await fetchJSON("/api/services");
  return (data.services || []).filter(s => s.active);
}

/**
 * Get a single service by ID.
 */
async function getService(id) {
  const data = await fetchJSON("/api/services");
  return (data.services || []).find(s => s.id === id) || null;
}

/**
 * Call a service endpoint and return the raw response.
 *
 * Without a signed wallet this is a plain unpaid call: you get the endpoint's
 * 402 payment challenge back (status 402, ok false). It does NOT draw a free
 * trial — trials are drawn by a signed wallet, not by a URL parameter.
 * Appending a bare `?trial=1` does nothing; this function used to do exactly
 * that and returned a 402 under a "trial call" docstring.
 *
 * Pass a signed wallet to draw from its 5-call trial allowance (one allowance
 * for the whole catalog, shared across endpoints):
 *
 *   const ts = Math.floor(Date.now() / 1000);
 *   const message = `minia2a trial:${wallet}:${serviceId}:${ts}`;
 *   const signature = <EIP-191 personal_sign of message>;
 *   await trial("x402-gas", { wallet, signature, timestamp: ts });
 *
 * `serviceId` must be the `id` field from /api/services (e.g. "x402-gas"),
 * not the URL path segment — signing "gas" returns 402 every time.
 * A served trial replies with `x-trial-remaining` / `x-trial-max` headers.
 */
async function trial(serviceId, opts = {}) {
  const svc = await getService(serviceId);
  if (!svc) throw new Error(`Service "${serviceId}" not found`);

  const url = new URL(svc.endpoint);
  const headers = {};
  if (opts.wallet) {
    const ts = String(opts.timestamp || Math.floor(Date.now() / 1000));
    url.searchParams.set("wallet", opts.wallet);
    headers["X-Wallet-Signature"] = opts.signature;
    headers["X-Trial-Timestamp"] = ts;
  }

  const res = await fetch(url, { headers });
  return {
    service: svc,
    status: res.status,
    ok: res.ok,
    trialRemaining: res.headers.get("x-trial-remaining"),
    body: await res.text(),
  };
}

/**
 * Get marketplace stats.
 */
async function stats() {
  return fetchJSON("/api/stats");
}

module.exports = { discover, getServices, getService, trial, stats };

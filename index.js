/**
 * minia2a SDK — Programmatic API
 *
 * Usage:
 *   const { discover, getServices, trial } = require('@minia2a/sdk');
 */

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE_URL = "https://minia2a.uk";

// ── Agent identity ──────────────────────────────────────────────────
// Sent on first-party requests so the gateway can count distinct agents; the
// server stores only HMAC(secret, id), never the raw value. Identity is
// per-machine, not per-process — a per-process id would count every invocation
// as a new agent and inflate the adoption metric it feeds.
let _agentIdResolved = false;
let _agentIdCache = null;

function agentId() {
  if (_agentIdResolved) return _agentIdCache;
  _agentIdResolved = true;
  const fromEnv = process.env.MINIA2A_AGENT_ID;
  if (fromEnv) return (_agentIdCache = fromEnv);
  // Two locations exist across our published clients: the `minia2a` package reads
  // ~/.minia2a-agent-id (the path the gateway's adoption.go names) and
  // `minia2a-cli` reads ~/.minia2a/agent-id. Read both, in that order, so a
  // machine that already has an id from either client keeps one identity instead
  // of being counted twice; create the gateway-documented one.
  const candidates = [
    path.join(os.homedir(), ".minia2a-agent-id"),
    path.join(os.homedir(), ".minia2a", "agent-id"),
  ];
  for (const file of candidates) {
    try {
      const existing = fs.readFileSync(file, "utf8").trim();
      if (existing) return (_agentIdCache = existing);
    } catch (e) { /* not created yet — fall through to the next candidate */ }
  }
  const id = "agent:" + crypto.randomUUID();
  try {
    fs.writeFileSync(candidates[0], id, { mode: 0o600 });
    return (_agentIdCache = id);
  } catch (e) {
    return (_agentIdCache = null);
  }
}

// The id identifies us to our own gateway. A catalog entry can point off-domain
// (the external-api category), so the header is gated on the host: a stable
// per-machine identifier must not travel to a third party.
function isFirstParty(url) {
  try {
    const h = new URL(url).hostname;
    return h === "minia2a.uk" || h.endsWith(".minia2a.uk");
  } catch (e) {
    return false;
  }
}

function identityHeaders(url) {
  const id = isFirstParty(url) ? agentId() : null;
  return id ? { "X-Agent-ID": id } : {};
}

async function fetchJSON(pathname) {
  const url = `${BASE_URL}${pathname}`;
  const res = await fetch(url, { headers: identityHeaders(url) });
  if (!res.ok) throw new Error(`minia2a API: HTTP ${res.status} from ${pathname}`);
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

  const res = await fetch(url, { headers: { ...identityHeaders(url), ...headers } });
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

// `_identityHeaders` is underscore-prefixed: it is here so cli.js (same package)
// shares one id-resolution path instead of carrying a second copy that can drift
// from this one. It is not part of the supported API.
module.exports = { discover, getServices, getService, trial, stats, _identityHeaders: identityHeaders };

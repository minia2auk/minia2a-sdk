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
 * Returns scored & sorted matches from the 299-service catalog.
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
 * Make a trial call to a service endpoint.
 */
async function trial(serviceId) {
  const svc = await getService(serviceId);
  if (!svc) throw new Error(`Service "${serviceId}" not found`);

  const res = await fetch(`${svc.endpoint}?trial=1`);
  return {
    service: svc,
    status: res.status,
    ok: res.ok,
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

/**
 * Mirror of the server-side deterministic ID logic.
 * Used client-side only for cache-check HEAD requests — the server
 * is always the authoritative source for IDs.
 */

async function sha256(message) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const STYLE_VERSION = '1';

export async function firstPageId(query) {
  const normalized = query.trim().toLowerCase();
  const full = await sha256(normalized + '__v' + STYLE_VERSION);
  return full.slice(0, 32);
}

export async function childPageId(parentId, x, y) {
  const full = await sha256(parentId + ':' + x.toFixed(2) + ':' + y.toFixed(2));
  return full.slice(0, 32);
}

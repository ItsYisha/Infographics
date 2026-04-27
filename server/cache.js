const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'cache');
const STYLE_VERSION = process.env.STYLE_VERSION || '1';

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

/** Deterministic ID for a first-page query. */
function firstPageId(query) {
  const normalized = query.trim().toLowerCase();
  return crypto.createHash('sha256')
    .update(normalized + '__v' + STYLE_VERSION)
    .digest('hex')
    .slice(0, 32);
}

/** Deterministic ID for a child page. */
function childPageId(parentId, x, y) {
  return crypto.createHash('sha256')
    .update(parentId + ':' + x.toFixed(2) + ':' + y.toFixed(2) + '__v' + STYLE_VERSION)
    .digest('hex')
    .slice(0, 32);
}

/** Returns the file path for a cached image. */
function cachePath(id) {
  return path.join(CACHE_DIR, id + '.png');
}

/** Check if a cached image exists. */
function exists(id) {
  return fs.existsSync(cachePath(id));
}

/** Read a cached image as a Buffer. */
function read(id) {
  return fs.readFileSync(cachePath(id));
}

/** Write a Buffer to the cache. */
function write(id, buffer) {
  fs.writeFileSync(cachePath(id), buffer);
}

/** Remove a cached image (used by /api/page regenerate flag). */
function remove(id) {
  const p = cachePath(id);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

/** Path for the stored title of a cached image. */
function titlePath(id) {
  return path.join(CACHE_DIR, id + '.title');
}

/** Read a previously extracted title (null if not stored). */
function readTitle(id) {
  try { return fs.readFileSync(titlePath(id), 'utf8').trim() || null; } catch { return null; }
}

/** Persist an extracted title alongside the cached image. */
function writeTitle(id, title) {
  if (title) fs.writeFileSync(titlePath(id), title, 'utf8');
}

module.exports = { firstPageId, childPageId, cachePath, titlePath, exists, read, write, remove, readTitle, writeTitle, CACHE_DIR };

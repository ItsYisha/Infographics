const fs   = require('fs');
const path = require('path');

const GALLERY_FILE = path.join(__dirname, 'gallery.json');
const MAX_ENTRIES  = 100;

function readGallery()        { try { return JSON.parse(fs.readFileSync(GALLERY_FILE, 'utf8')); } catch { return []; } }
function writeGallery(entries){ fs.writeFileSync(GALLERY_FILE, JSON.stringify(entries, null, 2)); }

// ── Tree helpers ─────────────────────────────────────────────────────────────
/**
 * A "tree" is a flat map of nodeId → TreeNode stored on each gallery entry.
 *
 * TreeNode: {
 *   id:       string,
 *   imageUrl: string,
 *   click:    { x, y } | null,   // null for root
 *   visitors: [{ seed, timestamp }],  // who drilled TO this node
 *   childIds: string[],           // IDs of child nodes
 * }
 */

/** Lazily initialise the tree from the legacy `pages` array (if tree not yet present). */
function ensureTree(entry) {
  if (entry.tree) return;
  const tree = {};
  const pages = entry.pages || [];

  // Root node
  tree[entry.id] = {
    id: entry.id,
    imageUrl: entry.thumbnailUrl,
    click: null,
    visitors: [],
    childIds: [],
  };

  // Migrate linear pages path into tree
  for (let i = 1; i < pages.length; i++) {
    const p   = pages[i];
    const pid = pages[i - 1].id;
    if (!p.click) continue;
    tree[p.id] = {
      id: p.id,
      imageUrl: p.imageUrl,
      click: p.click,
      visitors: [],
      childIds: [],
    };
    if (tree[pid] && !tree[pid].childIds.includes(p.id)) {
      tree[pid].childIds.push(p.id);
    }
  }

  entry.tree = tree;
}

/** Collect all unique visitor seeds across the whole tree. */
function allVisitorsFromTree(tree) {
  const seen = new Set();
  const out  = [];
  for (const node of Object.values(tree)) {
    for (const v of (node.visitors || [])) {
      if (!seen.has(v.seed)) { seen.add(v.seed); out.push(v); }
    }
  }
  return out;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Return top 20 entries sorted by engagement (shares weighted 2×). */
function getGallery(limit = 20) {
  const all = readGallery();
  return all
    .sort((a, b) => (b.clicks + b.shares * 2) - (a.clicks + a.shares * 2))
    .slice(0, limit)
    .map(entry => {
      // Ensure tree is present before sending to client (lazy migration)
      ensureTree(entry);
      return {
        ...entry,
        allVisitors: allVisitorsFromTree(entry.tree),
      };
    });
}

function addGalleryEntry({ id, query, thumbnailUrl }) {
  const entries = readGallery().filter(e => e.id !== id);
  const tree    = {};
  tree[id]      = { id, imageUrl: thumbnailUrl, click: null, visitors: [], childIds: [] };
  entries.push({
    id,
    query,
    thumbnailUrl,
    timestamp:  Date.now(),
    avatarSeed: Buffer.from(query.trim().toLowerCase()).toString('base64').slice(0, 16),
    clicks:     0,
    shares:     0,
    pages:      [{ id, imageUrl: thumbnailUrl }], // legacy compat
    tree,
  });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  writeGallery(entries);
}

/**
 * Merge a single drill-down into the tree.
 * If the child node already exists (same id = same click position), just add
 * the visitor.  If it's new, create the node and wire it to its parent.
 *
 * @param {string} rootId      - gallery entry root id
 * @param {string} parentId    - id of the page the user drilled FROM
 * @param {{ id, imageUrl, click: { x, y } }} child
 * @param {string} visitorSeed - anonymous visitor identifier
 */
function addOrMergeDrill(rootId, parentId, child, visitorSeed) {
  const entries = readGallery();
  const entry   = entries.find(e => e.id === rootId);
  if (!entry) return false;

  ensureTree(entry);
  const { tree } = entry;

  const parentNode = tree[parentId];
  if (!parentNode) return false; // parentId unknown — skip

  if (tree[child.id]) {
    // Child already known: add visitor if not already there
    const node = tree[child.id];
    if (!node.visitors.some(v => v.seed === visitorSeed)) {
      node.visitors.push({ seed: visitorSeed, timestamp: Date.now() });
    }
  } else {
    // New child node
    tree[child.id] = {
      id:       child.id,
      imageUrl: child.imageUrl,
      click:    child.click,
      visitors: [{ seed: visitorSeed, timestamp: Date.now() }],
      childIds: [],
    };
    if (!parentNode.childIds.includes(child.id)) {
      parentNode.childIds.push(child.id);
    }
  }

  // Keep legacy pages array in sync (append if new, for backward compat)
  if (!entry.pages) entry.pages = [{ id: rootId, imageUrl: entry.thumbnailUrl }];
  if (!entry.pages.some(p => p.id === child.id)) {
    entry.pages.push({ id: child.id, imageUrl: child.imageUrl, click: child.click });
  }

  writeGallery(entries);
  return true;
}

/**
 * Legacy: overwrite the pages array (used by personal session restore).
 * Does NOT update the tree — call addOrMergeDrill for tree-tracked drills.
 */
function updateGalleryPages(rootId, pages) {
  const entries = readGallery();
  const entry   = entries.find(e => e.id === rootId);
  if (!entry) return false;
  entry.pages = pages;
  writeGallery(entries);
  return true;
}

/**
 * Persist the human-readable label for a tree node.
 * Called after narration extracts "Zooming into: X" for a child page,
 * so the next visitor who instant-loads this node gets the name immediately.
 */
function setNodeLabel(rootId, nodeId, label) {
  const entries = readGallery();
  const entry   = entries.find(e => e.id === rootId);
  if (!entry) return false;
  ensureTree(entry);
  const node = entry.tree[nodeId];
  if (!node) return false;
  node.label = label;
  writeGallery(entries);
  return true;
}

function incrementStat(id, field) {
  const entries = readGallery();
  const entry   = entries.find(e => e.id === id);
  if (!entry) return false;
  entry[field] = (entry[field] || 0) + 1;
  writeGallery(entries);
  return true;
}

module.exports = { getGallery, addGalleryEntry, incrementStat, updateGalleryPages, addOrMergeDrill, setNodeLabel };

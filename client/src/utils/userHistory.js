/**
 * Personal exploration history — localStorage-backed.
 * Each entry is a full session the user has explored:
 *   { rootId, query, thumbnailUrl, timestamp, pages: [{id, imageUrl, click?}] }
 *
 * Used by Home.jsx left sidebar so the user can jump back into past topics.
 */
const KEY = 'burrow_user_history';
const MAX_ENTRIES = 50;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // quota exceeded — drop oldest half and retry once
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(-Math.floor(MAX_ENTRIES / 2))));
    } catch {
      // give up silently
    }
  }
}

/** Returns history entries newest-first. */
export function getUserHistory() {
  return read().sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Upsert: when the same rootId is encountered again, update its pages and
 * bump the timestamp. Otherwise prepend a new entry.
 */
export function upsertUserHistory({ rootId, query, thumbnailUrl, pages }) {
  if (!rootId) return;
  const list = read().filter(e => e.rootId !== rootId);
  list.push({
    rootId,
    query,
    thumbnailUrl,
    timestamp: Date.now(),
    pages: pages.map(p => ({ id: p.id, imageUrl: p.imageUrl, click: p.click })),
  });
  // Trim to MAX_ENTRIES (oldest first)
  const trimmed = list
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_ENTRIES);
  write(trimmed);
}

/** Remove a single entry by rootId. */
export function removeUserHistory(rootId) {
  write(read().filter(e => e.rootId !== rootId));
}

/** Clear all history. */
export function clearUserHistory() {
  write([]);
}

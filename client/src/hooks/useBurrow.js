import { useState, useCallback, useEffect } from 'react';
import { upsertUserHistory } from '../utils/userHistory';
import { getVisitorId } from '../utils/visitorId';

const LS_KEY = 'burrow_session';

/**
 * Core state machine for the burrow drill-down experience.
 *
 * pages: Array<{ id, imageUrl, query, parentId?, click?: {x,y} }>
 * currentIndex: which level is currently visible
 *
 * Inception model: going back does NOT erase later pages — you can fork.
 */
export function useBurrow() {
  const [pages, setPages] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [currentIndex, setCurrentIndex] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      const p = saved ? JSON.parse(saved) : [];
      return p.length > 0 ? p.length - 1 : 0;
    } catch {
      return 0;
    }
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  // pendingQuery: set when startTopic kicks off, cleared when it completes.
  // Lets Viewer.jsx know which topic to narrate while waiting for first image.
  const [pendingQuery, setPendingQuery] = useState(null);

  /**
   * knownChildren: maps parentPageId → { x, y, id, imageUrl }
   * Populated when loading a gallery session in guided mode.
   * Lets drillDown short-circuit to instant cache load when user clicks near a hint.
   */
  const [knownChildren, setKnownChildren] = useState({});

  // Persist to localStorage whenever pages change
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(pages));
    } catch {
      // quota exceeded or private browsing
    }
  }, [pages]);

  /**
   * Start a brand-new journey from a text query.
   * @param {string} query
   * @param {{ regenerate?: boolean }} [opts] - if regenerate, server busts cache
   */
  const startTopic = useCallback(async (query, opts = {}) => {
    const { regenerate = false } = opts;
    setGenerating(true);
    setError(null);
    setPendingQuery(query.trim());
    setKnownChildren({});
    // Always clear the previous session immediately so Viewer shows the
    // placeholder (not stale pages from a different topic) while we wait.
    setPages([]);
    setCurrentIndex(0);
    try {
      const res = await fetch('/api/page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, regenerate }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      const { id, imageUrl, label } = await res.json();
      const newPage = { id, imageUrl, query: query.trim(), label: label || undefined };
      setPages([newPage]);
      setCurrentIndex(0);

      // Track in personal history (sidebar on Home page)
      upsertUserHistory({
        rootId: id,
        query: query.trim(),
        thumbnailUrl: imageUrl,
        pages: [newPage],
      });
    } catch (err) {
      setError(err.message);
      throw err; // re-throw so Home.jsx catches it and shows the error inline
    } finally {
      setGenerating(false);
      setPendingQuery(null);
    }
  }, []);

  /** Re-run startTopic for the current root, busting the server cache. */
  const regenerate = useCallback(async () => {
    const rootQuery = pages[0]?.query;
    if (!rootQuery) return;
    try {
      await startTopic(rootQuery, { regenerate: true });
    } catch {
      // error already surfaced via state
    }
  }, [pages, startTopic]);

  /**
   * Drill down from the current page at normalized (x, y).
   * Fires the image generation; narration is managed separately via useNarration.
   */
  const drillDown = useCallback(async (x, y) => {
    const parentPage = pages[currentIndex];
    if (!parentPage || generating) return;

    // ── Instant path: click near a known gallery hint spot ───────────────
    // knownChildren[id] is now an ARRAY — multiple children per parent possible.
    const hints = knownChildren[parentPage.id] || [];
    const hit   = hints.find(h => Math.hypot(h.x - x, h.y - y) < 0.05);
    if (hit) {
      const childPage = {
        id:       hit.id,
        imageUrl: hit.imageUrl,
        query:    parentPage.query,
        parentId: parentPage.id,
        click:    { x, y },
        label:    hit.label,
      };
      const updatedPages = [...pages.slice(0, currentIndex + 1), childPage];
      setPages(updatedPages);
      setCurrentIndex(currentIndex + 1);
      return; // no API call, no spinner
    }

    // ── Normal API path ───────────────────────────────────────────────────
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: parentPage.id, click: { x, y } }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || `HTTP ${res.status}`);
      }
      const { id, imageUrl, label } = await res.json();
      const newPage = {
        id,
        imageUrl,
        query: parentPage.query,
        parentId: parentPage.id,
        click: { x, y },
        label: label || undefined,
      };
      // Fork: discard pages after currentIndex, then append
      const updatedPages = [...pages.slice(0, currentIndex + 1), newPage];
      setPages(updatedPages);
      setCurrentIndex(currentIndex + 1);

      // Merge this drill into the gallery exploration tree so other users can
      // see all the paths that have been taken and get hints at those spots.
      const rootId = pages[0]?.id;
      if (rootId) {
        fetch(`/api/gallery/${rootId}/drill`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentId:    parentPage.id,
            child:       { id, imageUrl, click: { x, y } },
            visitorSeed: getVisitorId(),
          }),
        }).catch(() => {}); // fire-and-forget, non-critical

        // Mirror into personal history so the sidebar reflects layer count
        upsertUserHistory({
          rootId,
          query: parentPage.query,
          thumbnailUrl: pages[0].imageUrl,
          pages: updatedPages,
        });
      }
    } catch (err) {
      setError(err.message);
      // don't re-throw here — drillDown errors show inline in the Viewer
    } finally {
      setGenerating(false);
    }
  }, [pages, currentIndex, generating, knownChildren]);

  /** Jump back to a specific level (Inception model). */
  const goToLevel = useCallback((index) => {
    if (index >= 0 && index < pages.length) {
      setCurrentIndex(index);
    }
  }, [pages.length]);

  /** Clear the error state so the user can retry. */
  const clearError = useCallback(() => setError(null), []);

  /** Reset everything. */
  const reset = useCallback(() => {
    setPages([]);
    setCurrentIndex(0);
    setGenerating(false);
    setError(null);
    setPendingQuery(null);
    setKnownChildren({});
    localStorage.removeItem(LS_KEY);
  }, []);

  /**
   * Set a human-readable label on a page by index (from narration header).
   * Also persists the label to the gallery tree so future visitors who
   * instant-load this node via a hint spot get the name immediately.
   */
  const setPageLabel = useCallback((index, label) => {
    setPages(prev => {
      if (index < 0 || index >= prev.length) return prev;
      const next = [...prev];
      next[index] = { ...next[index], label };

      // Persist label to server so the tree node has it for future visitors
      const rootId = prev[0]?.id;
      const nodeId = prev[index]?.id;
      if (rootId && nodeId && rootId !== nodeId) {
        fetch(`/api/gallery/${rootId}/node/${nodeId}/label`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ label }),
        }).catch(() => {}); // fire-and-forget, non-critical
      }

      return next;
    });
  }, []);

  /** Directly inject a page (used for gallery instant-load). */
  const _injectPage = useCallback(({ id, imageUrl, query }) => {
    const newPage = { id, imageUrl, query };
    setPages([newPage]);
    setCurrentIndex(0);
    setGenerating(false);
    setError(null);
    setKnownChildren({});
  }, []);

  /**
   * Restore a full multi-page session from personal history (own past sessions).
   * Lands on the last layer the user reached.
   * pages: Array<{ id, imageUrl, click? }> — all layers in order.
   */
  const _restoreSession = useCallback((sessionPages, query) => {
    const restored = sessionPages.map(p => ({ ...p, query }));
    setPages(restored);
    setCurrentIndex(restored.length - 1);
    setGenerating(false);
    setError(null);
    setKnownChildren({});
  }, []);

  /**
   * Load a gallery item in GUIDED mode:
   * - Show only Layer 1 to the new visitor
   * - Populate knownChildren so hint markers appear at every spot any previous
   *   user clicked, with their avatar seeds for the hover tooltip
   * - Clicking near a hint instantly loads that cached child (zero API call)
   * - Clicking elsewhere goes through the normal generation flow
   *
   * galleryItem: the full gallery entry from /api/gallery
   *   May have .tree (new format) or just .pages (legacy).
   */
  const _loadGuidedSession = useCallback((galleryItem, query) => {
    const kc = {};

    if (galleryItem.tree) {
      // ── New tree-based format ─────────────────────────────────────────
      const { tree } = galleryItem;
      for (const [nodeId, node] of Object.entries(tree)) {
        if (!node.childIds?.length) continue;
        kc[nodeId] = node.childIds
          .map(cid => tree[cid])
          .filter(child => child?.click)
          .map(child => ({
            x:        child.click.x,
            y:        child.click.y,
            id:       child.id,
            imageUrl: child.imageUrl,
            label:    child.label,          // pre-stored label, if any
            visitors: child.visitors || [],
          }));
      }
    } else if (galleryItem.pages) {
      // ── Legacy linear pages fallback ──────────────────────────────────
      const pages = galleryItem.pages;
      for (let i = 1; i < pages.length; i++) {
        const child    = pages[i];
        const parentId = pages[i - 1].id;
        if (!child.click) continue;
        if (!kc[parentId]) kc[parentId] = [];
        kc[parentId].push({
          x:        child.click.x,
          y:        child.click.y,
          id:       child.id,
          imageUrl: child.imageUrl,
          label:    child.label,
          visitors: [],
        });
      }
    }

    setKnownChildren(kc);
    // Start viewer at Layer 1 only
    const root = {
      id:       galleryItem.id,
      imageUrl: galleryItem.thumbnailUrl,
      query,
    };
    setPages([root]);
    setCurrentIndex(0);
    setGenerating(false);
    setError(null);
  }, []);

  /**
   * Returns all hint spots for a page — each spot is a location where at least
   * one previous user clicked to go deeper, with the list of visitor seeds.
   * @param {string|null} pageId
   * @returns {Array<{ x: number, y: number, visitors: {seed,timestamp}[] }>}
   */
  const getHintsForPage = useCallback((pageId) => {
    if (!pageId) return [];
    return knownChildren[pageId] || [];
  }, [knownChildren]);

  return {
    pages,
    currentIndex,
    currentPage: pages[currentIndex] || null,
    generating,
    error,
    pendingQuery,
    startTopic,
    drillDown,
    goToLevel,
    reset,
    regenerate,
    clearError,
    setPageLabel,
    _injectPage,
    _restoreSession,
    _loadGuidedSession,
    getHintsForPage,
  };
}

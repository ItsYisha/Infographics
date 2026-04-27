import { useState, useRef, useEffect } from 'react';
import { exportVideo, exportImage, exportAllImages } from '../utils/videoExport';
import './ExportButton.css';

/**
 * Multi-mode export button:
 *  - 1 page  → single click, exports that page as PNG
 *  - 2+ pages → dropdown menu with three options:
 *      • Export current page (PNG)
 *      • Export all layers (single stitched PNG)
 *      • Export video (MP4/WebM with parent→child transitions)
 *
 * Always tracks the share stat on the server when invoked.
 */
export default function ExportButton({ pages, currentPage, firstPageId }) {
  const [exporting, setExporting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef(null);

  const isMulti = pages.length >= 2;

  // Close the menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  function trackShare() {
    if (firstPageId) {
      fetch(`/api/gallery/${firstPageId}/share`, { method: 'POST' }).catch(() => {});
    }
  }

  async function run(action) {
    if (exporting) return;
    setExporting(true);
    setMenuOpen(false);
    trackShare();
    try {
      await action();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Your browser may not support this feature.');
    } finally {
      setExporting(false);
    }
  }

  async function handleSinglePage() {
    if (isMulti) return;
    await run(() => exportImage(pages[0]));
  }

  function handleMenuToggle() {
    if (exporting) return;
    setMenuOpen(o => !o);
  }

  if (!pages.length) return null;

  // Single-page → simple button
  if (!isMulti) {
    return (
      <button
        className={`export-btn ${exporting ? 'exporting' : ''}`}
        onClick={handleSinglePage}
        disabled={exporting}
        title="Save this illustration as an image"
      >
        {exporting ? (
          <>
            <span className="export-spinner" />
            Saving…
          </>
        ) : (
          <>
            <span className="export-icon">↓</span>
            Save Image
          </>
        )}
      </button>
    );
  }

  // Multi-page → dropdown menu
  return (
    <div className="export-wrap" ref={containerRef}>
      <button
        className={`export-btn ${exporting ? 'exporting' : ''} ${menuOpen ? 'open' : ''}`}
        onClick={handleMenuToggle}
        disabled={exporting}
        title="Choose what to export"
      >
        {exporting ? (
          <>
            <span className="export-spinner" />
            Exporting…
          </>
        ) : (
          <>
            <span className="export-icon">▶</span>
            Export ({pages.length} layers)
            <span className="export-caret">▾</span>
          </>
        )}
      </button>

      {menuOpen && (
        <div className="export-menu" role="menu">
          <button
            className="export-menu-item"
            onClick={() => run(() => exportImage(currentPage || pages[pages.length - 1]))}
          >
            <span className="export-menu-icon">📷</span>
            <div className="export-menu-text">
              <span className="export-menu-title">Current page</span>
              <span className="export-menu-sub">Save the page you're viewing as PNG</span>
            </div>
          </button>

          <button
            className="export-menu-item"
            onClick={() => run(() => exportAllImages(pages))}
          >
            <span className="export-menu-icon">🖼</span>
            <div className="export-menu-text">
              <span className="export-menu-title">All layers</span>
              <span className="export-menu-sub">Stitch every layer into one PNG</span>
            </div>
          </button>

          <button
            className="export-menu-item"
            onClick={() => run(() => exportVideo(pages))}
          >
            <span className="export-menu-icon">🎬</span>
            <div className="export-menu-text">
              <span className="export-menu-title">Journey video</span>
              <span className="export-menu-sub">Animated parent → child transitions</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

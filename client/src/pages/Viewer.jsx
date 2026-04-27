import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';
import ImageCanvas from '../components/ImageCanvas';
import NarrationPanel from '../components/NarrationPanel';
import ExportButton from '../components/ExportButton';
import { useNarration } from '../hooks/useNarration';
import './Viewer.css';

export default function Viewer({ burrow }) {
  const {
    pages,
    currentIndex,
    currentPage,
    generating,
    error,
    pendingQuery,
    drillDown,
    goToLevel,
    reset,
    regenerate,
  } = burrow;
  const {
    facts,
    streaming: narStreaming,
    startNarration,
    startTopicNarration,
    clearNarration,
  } = useNarration();
  const navigate = useNavigate();

  // Redirect to home only if there's nothing happening.
  useEffect(() => {
    if (!pages.length && !generating && !pendingQuery) {
      navigate('/', { replace: true });
    }
  }, [pages.length, generating, pendingQuery, navigate]);

  // Kick off topic narration immediately when Viewer first loads with a pending query.
  const startedTopicFor = useRef(null);
  useEffect(() => {
    if (pendingQuery && startedTopicFor.current !== pendingQuery) {
      startedTopicFor.current = pendingQuery;
      startTopicNarration(pendingQuery);
    }
    if (!pendingQuery) startedTopicFor.current = null;
  }, [pendingQuery, startTopicNarration]);

  const handleElementClick = useCallback((x, y) => {
    if (!currentPage || generating) return;
    clearNarration();

    // Don't narrate instant hint-spot loads — the image is already cached.
    const hints = burrow.getHintsForPage(currentPage.id);
    const isInstantLoad = hints.some(h => Math.hypot(h.x - x, h.y - y) < 0.05);
    if (!isInstantLoad) {
      startNarration(currentPage.id, x, y);
    }

    drillDown(x, y);
  }, [currentPage, generating, drillDown, startNarration, clearNarration, burrow]);

  const handleNavigate = useCallback((index) => {
    if (index === -1) {
      navigate('/');
    } else {
      goToLevel(index);
      clearNarration();
    }
  }, [goToLevel, clearNarration, navigate]);

  const handleReset = useCallback(() => {
    reset();
    navigate('/');
  }, [reset, navigate]);

  const handleRegenerate = useCallback(() => {
    if (generating) return;
    if (!confirm('Regenerate this whole topic from scratch? Current layers will be replaced.')) return;
    clearNarration();
    regenerate();
  }, [generating, regenerate, clearNarration]);

  // Clear narration whenever user navigates to an existing page (not generating).
  const prevGeneratingRef = useRef(false);
  useEffect(() => {
    const wasGenerating = prevGeneratingRef.current;
    prevGeneratingRef.current = generating;
    if (!generating && !wasGenerating) {
      clearNarration();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage?.id]);

  const isInitialLoad = !currentPage && (generating || pendingQuery);
  if (!currentPage && !isInitialLoad) return null;

  return (
    <div className="viewer">
      {/* Top bar */}
      <div className="viewer-topbar">
        <Breadcrumb
          pages={pages}
          currentIndex={currentIndex}
          onNavigate={handleNavigate}
        />
        <div className="viewer-topbar-actions">
          <ExportButton
            pages={pages}
            currentPage={currentPage}
            firstPageId={pages[0]?.id}
          />
          <button
            className="viewer-reset-btn"
            onClick={handleRegenerate}
            disabled={generating || !pages.length}
            title="Re-run the whole topic from scratch (cache busted)"
          >
            ↻ Regenerate
          </button>
          <button
            className="viewer-reset-btn viewer-reset-btn-secondary"
            onClick={handleReset}
            title="Back to home"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="viewer-body">
        <main className="viewer-main">
          {error && (
            <div className="viewer-error">
              <span>⚠️ {error}</span>
              <button onClick={() => burrow.clearError()}>Dismiss</button>
            </div>
          )}

          <div className="viewer-canvas-wrap">
            {currentPage ? (
              <ImageCanvas
                imageUrl={currentPage.imageUrl}
                onElementClick={handleElementClick}
                generating={generating}
                hintSpots={burrow.getHintsForPage(currentPage.id)}
              />
            ) : (
              <div className="image-canvas-placeholder">
                <div className="generating-spinner" />
                <span>Drawing "{pendingQuery}"…</span>
              </div>
            )}

            {/* Fun Facts overlay — centered on the image while generating */}
            <NarrationPanel
              facts={facts}
              streaming={narStreaming}
              generating={generating}
            />
          </div>

          {/* Level counter */}
          <div className="viewer-level-info">
            <span>
              {currentPage
                ? `Layer ${currentIndex + 1} of ${pages.length}`
                : 'Preparing your first illustration…'}
            </span>
            {currentPage && currentIndex > 0 && (
              <button
                className="viewer-back-btn"
                onClick={() => handleNavigate(currentIndex - 1)}
              >
                ← Go up a level
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

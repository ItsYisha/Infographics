import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';
import ImageCanvas from '../components/ImageCanvas';
import NarrationPanel from '../components/NarrationPanel';
import ExportButton from '../components/ExportButton';
import FlashcardStack from '../components/FlashcardStack';
import { useNarration } from '../hooks/useNarration';
import { useFlashcards } from '../hooks/useFlashcards';
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
    setPageLabel,
  } = burrow;
  const {
    text: narration,
    streaming: narStreaming,
    startNarration,
    startTopicNarration,
    clearNarration,
  } = useNarration();
  const {
    cards: flashcards,
    askedQuestions,
    addQuestion,
    flipCard,
    removeCard,
    clearAll: clearFlashcards,
  } = useFlashcards();
  const navigate = useNavigate();

  // Redirect to home only if there's nothing happening. While the first image
  // is generating (pendingQuery set), pages may be empty — stay put and show
  // the streaming topic narration.
  useEffect(() => {
    if (!pages.length && !generating && !pendingQuery) {
      navigate('/', { replace: true });
    }
  }, [pages.length, generating, pendingQuery, navigate]);

  // When the user lands on Viewer with a pendingQuery (just submitted from
  // Home), kick off the topic-narration stream immediately so they have
  // something to read during the 30-60s image wait.
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

    // Don't narrate instant hint-spot loads — the image is already cached,
    // there's nothing to "wait for" and no generation happening.
    const hints = burrow.getHintsForPage(currentPage.id);
    const isInstantLoad = hints.some(h => Math.hypot(h.x - x, h.y - y) < 0.05);
    if (!isInstantLoad) {
      startNarration(currentPage.id, x, y, currentPage.query, currentPage.label);
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

  // Keep the questions card visible for 800ms after BOTH the image finishes
  // generating AND the narration stream finishes — whichever comes last.
  useEffect(() => {
    const t = (!generating && !narStreaming && !!narration)
      ? setTimeout(clearNarration, 800)
      : undefined;
    return () => clearTimeout(t);
  }, [generating, narStreaming, narration, clearNarration]);

  // Clear narration whenever the user navigates to an existing page
  // (back via breadcrumb, "Go up a level", or any goToLevel call).
  // We only want narration visible during active generation/streaming.
  const prevGeneratingRef = useRef(false);
  useEffect(() => {
    const wasGenerating = prevGeneratingRef.current;
    prevGeneratingRef.current = generating;
    // currentPage changed while NOT generating → user navigated to existing page
    if (!generating && !wasGenerating) {
      clearNarration();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage?.id]);

  // Extract the "Zooming into: X" header from narration text for page labelling.
  const narrationLabel = (() => {
    const ls = narration.split('\n').filter(l => l.trim());
    const headerLine = ls.find(l => l.startsWith('Zooming into:'));
    const hasBullet   = ls.some(l => l.startsWith('•'));
    if (!headerLine || !hasBullet) return null;
    return headerLine.replace('Zooming into:', '').trim() || null;
  })();

  useEffect(() => {
    if (!narrationLabel || pages.length < 2) return;
    const lastIdx = pages.length - 1;
    if (!pages[lastIdx].label) {
      setPageLabel(lastIdx, narrationLabel);
    }
  }, [narrationLabel, pages.length, setPageLabel]);

  // ── Question click from NarrationPanel ───────────────────────────────────
  const handleQuestionClick = useCallback((question, context) => {
    addQuestion(question, context);
  }, [addQuestion]);

  const isInitialLoad = !currentPage && (generating || pendingQuery);
  if (!currentPage && !isInitialLoad) return null;

  const showNarration = generating || narStreaming || !!narration;
  const hasRightPanel = flashcards.length > 0;

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
        {/* Center: image + narration */}
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

            <NarrationPanel
              text={narration}
              streaming={narStreaming}
              visible={showNarration}
              generating={generating}
              onQuestionClick={handleQuestionClick}
              askedQuestions={askedQuestions}
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

        {/* Right: flippable knowledge cards */}
        <aside className={`viewer-right ${hasRightPanel ? 'viewer-right-open' : ''}`}>
          <FlashcardStack
            cards={flashcards}
            onFlip={flipCard}
            onRemove={removeCard}
          />
        </aside>
      </div>
    </div>
  );
}

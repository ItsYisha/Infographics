import { useEffect, useRef } from 'react';
import './NarrationPanel.css';

/**
 * Renders the streaming questions panel.
 *
 * Text format from server:
 *   "Zooming into: Turbine Blades\n\n• Why do they spin so fast?\n• ..."
 *
 * Rendering strategy: complete bullets and the in-progress partial bullet share
 * a stable numeric key (their bullet index). This means the element is created
 * once when a bullet first appears and never remounted as text fills in — so
 * the entrance animation plays exactly once per question, at the moment it
 * first appears, regardless of streaming state.
 */
/**
 * onQuestionClick(question, context) — fired when user clicks a completed bullet.
 * askedQuestions — Set<string> of questions already added to the flashcard stack.
 */
export default function NarrationPanel({ text, streaming, visible, generating, onQuestionClick, askedQuestions = new Set() }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [text]);

  if (!visible && !text) return null;

  const lines = text.split('\n').filter(l => l.trim());
  const HEADER_PREFIXES = ['Zooming into:', 'Exploring:'];
  const isHeader = (l) => HEADER_PREFIXES.some(p => l.startsWith(p));
  const header = lines.find(isHeader) || '';
  const headerLabel = header.startsWith('Exploring:') ? 'Exploring' : 'Zooming into';

  // Complete bullets (lines starting with "•")
  const completedBullets = lines.filter(l => l.startsWith('•'));
  // Current in-progress line (doesn't start with "•" yet — the bullet char
  // arrives before the rest of the line, so this is a line that was preceded
  // by "•" but hasn't completed yet, OR a truly partial first-char situation)
  const partialLines = lines.filter(l => l.trim() && !isHeader(l) && !l.startsWith('•'));

  // Merge into a single ordered list with stable indices.
  // Partial line (if any) comes after the completed ones and is the "typing" one.
  const allBullets = [
    ...completedBullets,
    ...(streaming && partialLines.length ? partialLines : []),
  ];
  const partialIdx = streaming && partialLines.length ? completedBullets.length : -1;

  return (
    <div className={`narration-panel ${visible ? 'visible' : 'fading'}`}>
      {/* Header */}
      {header ? (
        <div className="narration-header">
          <span className="narration-scope-icon">{headerLabel === 'Exploring' ? '🧭' : '🔬'}</span>
          <span className="narration-scope-text">
            {header.replace(headerLabel + ':', '').trim()}
            {streaming && !allBullets.length && <span className="narration-cursor" />}
          </span>
        </div>
      ) : (
        <div className="narration-header narration-header-placeholder">
          <span className="narration-scope-icon">🔬</span>
          <span className="narration-scope-text narration-skeleton">
            {streaming && <span className="narration-cursor" />}
          </span>
        </div>
      )}

      {/* Questions — each bullet animates in exactly once when it first appears */}
      {allBullets.length > 0 && (
        <ul className="narration-questions">
          {allBullets.map((q, i) => {
            const isPartial = i === partialIdx;
            const qText = q.replace(/^•\s*/, '');
            const isAsked = !isPartial && askedQuestions.has(qText);
            const isClickable = !isPartial && !!onQuestionClick;
            return (
              <li
                key={i}
                className={[
                  'narration-q',
                  isPartial   ? 'narration-q-partial'   : '',
                  isAsked     ? 'narration-q-asked'     : '',
                  isClickable ? 'narration-q-clickable' : '',
                ].filter(Boolean).join(' ')}
                onClick={isClickable ? () => onQuestionClick(qText, header.replace(/^.*?:\s*/, '').trim()) : undefined}
                title={isClickable ? (isAsked ? 'Add another card' : 'Click to get an answer') : undefined}
              >
                {qText}
                {isPartial && <span className="narration-cursor" />}
                {isClickable && !isPartial && (
                  <span className="narration-q-ask">
                    {isAsked ? '✓' : '?'}
                  </span>
                )}
              </li>
            );
          })}
          <div ref={bottomRef} />
        </ul>
      )}

      {/* Generating progress bar */}
      {generating && (
        <div className="narration-progress">
          <div className="narration-progress-bar" />
          <span className="narration-progress-label">Generating illustration…</span>
        </div>
      )}
    </div>
  );
}

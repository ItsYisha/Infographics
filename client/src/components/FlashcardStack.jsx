import './FlashcardStack.css';

/**
 * A loose column of independently flippable knowledge cards.
 *
 * cards:        Array<{ id, question, answer, streaming, flipped }>
 * onFlip(id):   toggle front/back
 * onRemove(id): remove from stack
 */
export default function FlashcardStack({ cards, onFlip, onRemove }) {
  if (!cards.length) return null;

  return (
    <div className="flashcard-stack">
      {cards.map((card, i) => (
        <div
          key={card.id}
          className="flashcard-scene"
          style={{ '--delay': `${i * 0.06}s` }}
        >
          {/* Remove button sits outside the flip surface so it's always clickable */}
          <button
            className="flashcard-remove"
            onClick={() => onRemove(card.id)}
            title="Remove"
            aria-label="Remove card"
          >
            ✕
          </button>

          {/* The flipping surface */}
          <div
            className={`flashcard-inner ${card.flipped ? 'is-flipped' : ''}`}
            onClick={() => onFlip(card.id)}
            role="button"
            tabIndex={0}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onFlip(card.id)}
            aria-label={card.flipped ? 'Show question' : 'Show answer'}
          >
            {/* FRONT — question */}
            <div className="flashcard-face flashcard-front">
              <span className="flashcard-label">Q</span>
              <p className="flashcard-question">{card.question}</p>
              <span className="flashcard-flip-hint">
                {card.streaming ? 'Loading answer…' : 'Click to see answer ↩'}
              </span>
            </div>

            {/* BACK — answer */}
            <div className="flashcard-face flashcard-back">
              <span className="flashcard-label flashcard-label-a">A</span>
              {card.answer ? (
                <p className="flashcard-answer">
                  {card.answer}
                  {card.streaming && <span className="fc-cursor" />}
                </p>
              ) : (
                <div className="flashcard-loading">
                  <div className="fc-skeleton" />
                  <div className="fc-skeleton fc-skeleton-short" />
                  <div className="fc-skeleton fc-skeleton-shorter" />
                </div>
              )}
              {!card.streaming && card.answer && (
                <span className="flashcard-flip-hint flashcard-flip-hint-back">
                  Click to flip back ↩
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

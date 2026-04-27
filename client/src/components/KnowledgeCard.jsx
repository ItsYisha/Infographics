import './KnowledgeCard.css';

/**
 * The active knowledge card — appears in viewer-right when the user clicks
 * a question in NarrationPanel. Streams the answer in real time.
 *
 * onClose → closes the card (caller decides whether to stack it)
 */
export default function KnowledgeCard({ question, answer, streaming, onClose }) {
  if (!question) return null;

  return (
    <div className="knowledge-card">
      <div className="knowledge-card-header">
        <span className="knowledge-card-icon">💡</span>
        <p className="knowledge-card-question">{question}</p>
        <button
          className="knowledge-card-close"
          onClick={onClose}
          title="Close"
          aria-label="Close knowledge card"
        >
          ✕
        </button>
      </div>

      <div className="knowledge-card-body">
        {answer ? (
          <>
            <p className="knowledge-card-answer">
              {answer}
              {streaming && <span className="kc-cursor" />}
            </p>
          </>
        ) : (
          <div className="knowledge-card-loading">
            <div className="kc-skeleton" />
            <div className="kc-skeleton kc-skeleton-short" />
          </div>
        )}
      </div>

      {!streaming && answer && (
        <div className="knowledge-card-footer">
          <span className="knowledge-card-footer-hint">
            Closes to your knowledge stack ↗
          </span>
        </div>
      )}
    </div>
  );
}

import './LevelStrip.css';

/**
 * Left sidebar showing thumbnail previews of all levels visited.
 * Clicking a thumbnail jumps back to that level (Inception model).
 */
export default function LevelStrip({ pages, currentIndex, onNavigate }) {
  if (pages.length <= 1) return null;

  return (
    <aside className="level-strip">
      <div className="level-strip-label">Layers</div>
      <div className="level-strip-list">
        {pages.map((page, i) => {
          const layerName = i === 0 ? page.query : (page.label || null);
          return (
            <div key={page.id} className="level-item">
              <button
                className={`level-thumb ${i === currentIndex ? 'active' : ''}`}
                onClick={() => onNavigate(i)}
                title={layerName || `Layer ${i + 1}`}
              >
                <img
                  src={page.imageUrl}
                  alt={layerName || `Layer ${i + 1}`}
                  loading="lazy"
                />
                <span className="level-badge">{i + 1}</span>
                {i === currentIndex && <span className="level-active-dot" />}
              </button>
              {layerName && (
                <span className="level-name" title={layerName}>
                  {layerName}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

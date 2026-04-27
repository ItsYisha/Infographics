import { useEffect, useState } from 'react';
import './GalleryGrid.css';

function timeAgo(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function GalleryGrid({ onSelectEntry }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/gallery')
      .then(r => r.json())
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="gallery-loading">
        <div className="gallery-spinner" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="gallery-empty">
        <span>No explorations yet — be the first!</span>
      </div>
    );
  }

  function handleSelect(item) {
    fetch(`/api/gallery/${item.id}/click`, { method: 'POST' }).catch(() => {});
    onSelectEntry(item);
  }

  function handleShare(e, item) {
    e.stopPropagation(); // don't trigger card click
    fetch(`/api/gallery/${item.id}/share`, { method: 'POST' }).catch(() => {});

    // Download the thumbnail image
    fetch(item.thumbnailUrl)
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `burrow-${item.id.slice(0, 8)}.png`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => {});
  }

  return (
    <section className="gallery-grid">
      <h2 className="gallery-title">Recent Explorations</h2>
      <div className="gallery-mosaic">
        {items.map(item => (
          <button
            key={item.id}
            className="gallery-card"
            onClick={() => handleSelect(item)}
          >
            <div className="gallery-card-img-wrap">
              <img
                src={item.thumbnailUrl}
                alt={item.query}
                loading="lazy"
              />
              <div className="gallery-card-overlay">
                <span>Explore →</span>
              </div>
              {/* Stats badge — bottom-right corner of the thumbnail */}
              {(item.clicks > 0 || item.shares > 0) && (
                <div className="gallery-card-stats">
                  {item.clicks > 0 && (
                    <span className="gallery-stat">
                      <span className="gallery-stat-icon">👁</span>
                      {item.clicks}
                    </span>
                  )}
                  {item.shares > 0 && (
                    <span className="gallery-stat">
                      <span className="gallery-stat-icon">↗</span>
                      {item.shares}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="gallery-card-meta">
              {/* Avatar stack: creator + up to 4 community explorers */}
              <div className="gallery-avatar-stack">
                {/* Creator avatar (derived from query, always first) */}
                <img
                  className="gallery-avatar"
                  src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(item.avatarSeed)}`}
                  alt="creator"
                  title="Created by"
                />
                {/* Community explorers who drilled into this topic */}
                {(item.allVisitors || []).slice(0, 4).map(v => (
                  <img
                    key={v.seed}
                    className="gallery-avatar gallery-avatar-explorer"
                    src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(v.seed)}`}
                    alt="explorer"
                    title="Explored this topic"
                  />
                ))}
                {(item.allVisitors || []).length > 4 && (
                  <span className="gallery-avatar-more">
                    +{item.allVisitors.length - 4}
                  </span>
                )}
              </div>
              <div className="gallery-card-text">
                <span className="gallery-card-query">{item.query}</span>
                <span className="gallery-card-time">{timeAgo(item.timestamp)}</span>
              </div>
              <button
                className="gallery-share-btn"
                onClick={e => handleShare(e, item)}
                title="Download this illustration"
              >
                ↗
              </button>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

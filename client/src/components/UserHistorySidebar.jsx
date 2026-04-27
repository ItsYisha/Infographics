import { useEffect, useState } from 'react';
import { getUserHistory, removeUserHistory } from '../utils/userHistory';
import './UserHistorySidebar.css';

function timeAgo(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

/**
 * Left sidebar on Home that lists the user's own past topics
 * (stored in localStorage). Click → restore that session in the Viewer.
 */
export default function UserHistorySidebar({ onSelectEntry }) {
  const [items, setItems] = useState([]);

  // Re-read on mount, and whenever localStorage changes (other tabs)
  useEffect(() => {
    const refresh = () => setItems(getUserHistory());
    refresh();
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  function handleDelete(e, rootId) {
    e.stopPropagation();
    if (!confirm('Remove this topic from your history?')) return;
    removeUserHistory(rootId);
    setItems(getUserHistory());
  }

  return (
    <aside className="user-history-sidebar">
      <div className="uhs-header">
        <span className="uhs-title">Your Burrows</span>
        <span className="uhs-count">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="uhs-empty">
          <span className="uhs-empty-icon">🐇</span>
          <p>Topics you explore will appear here.</p>
        </div>
      ) : (
        <ul className="uhs-list">
          {items.map(item => (
            <li key={item.rootId}>
              <button
                className="uhs-item"
                onClick={() => onSelectEntry(item)}
                title={item.query}
              >
                <img
                  className="uhs-thumb"
                  src={item.thumbnailUrl}
                  alt=""
                  loading="lazy"
                />
                <div className="uhs-meta">
                  <span className="uhs-query">{item.query}</span>
                  <span className="uhs-sub">
                    {item.pages?.length || 1}
                    {(item.pages?.length || 1) === 1 ? ' layer' : ' layers'}
                    {' · '}
                    {timeAgo(item.timestamp)}
                  </span>
                </div>
                <span
                  role="button"
                  className="uhs-delete"
                  onClick={(e) => handleDelete(e, item.rootId)}
                  aria-label="Remove from history"
                >
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

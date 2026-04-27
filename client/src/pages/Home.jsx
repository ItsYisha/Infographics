import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GalleryGrid from '../components/GalleryGrid';
import UserHistorySidebar from '../components/UserHistorySidebar';
import './Home.css';

const SUGGESTIONS = [
  'The Industrial Revolution',
  'Origins of the Middle East conflict',
  'The Age of Exploration',
  'The Renaissance — how it started',
  'The Silk Road trade network',
  'Fall of the Roman Empire',
  'One Hundred Years of Solitude storyline',
  'How a jet engine works',
  'The human heart',
  'Inside a CPU chip',
  'The solar system',
  'DNA replication',
  
];

export default function Home({ onStartTopic }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error] = useState(null);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);

    // Fire-and-forget: kick off image generation, then navigate immediately
    // so the Viewer can show streaming narration during the long wait.
    Promise.resolve(onStartTopic(q)).catch(() => {});
    navigate('/explore');
  }

  function handleSuggestion(s) {
    setQuery(s);
  }

  function handleGallerySelect(item) {
    // guided: true → App.jsx starts at Layer 1 with hint markers (not full restore)
    onStartTopic(item.query, { ...item, guided: true });
    navigate('/explore');
  }

  function handleHistorySelect(item) {
    // Personal history items have the same shape as a gallery item enough
    // for App.handleStartTopic to restore them — pass pages directly.
    const restorable = {
      id: item.rootId,
      query: item.query,
      thumbnailUrl: item.thumbnailUrl,
      pages: item.pages,
    };
    onStartTopic(item.query, restorable);
    navigate('/explore');
  }

  return (
    <div className="home">
      {/* Left: user's own past topics */}
      <UserHistorySidebar onSelectEntry={handleHistorySelect} />

      {/* Right: hero + community gallery */}
      <div className="home-content">
        {/* Hero */}
        <section className="home-hero">
          <div className="home-logo">📖</div>
          <h1 className="home-title">Burrow</h1>
          <p className="home-subtitle">
            Type any topic. Get an illustrated explainer.<br />
            Click anything to dive deeper — infinitely.
          </p>

          <form className="home-form" onSubmit={handleSubmit}>
            <div className="home-input-wrap">
              <input
                className="home-input"
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. How does a black hole form?"
                maxLength={300}
                autoFocus
                disabled={loading}
              />
              <button
                type="submit"
                className={`home-submit ${loading ? 'loading' : ''}`}
                disabled={!query.trim() || loading}
              >
                {loading ? <span className="home-spinner" /> : 'Explore →'}
              </button>
            </div>
            {error && <p className="home-error">{error}</p>}
          </form>

          {/* Suggestions */}
          <div className="home-suggestions">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                className="suggestion-chip"
                onClick={() => handleSuggestion(s)}
                type="button"
                disabled={loading}
              >
                {s}
              </button>
            ))}
          </div>
        </section>

        {/* Community gallery (sorted by interaction) */}
        <GalleryGrid onSelectEntry={handleGallerySelect} />
      </div>
    </div>
  );
}

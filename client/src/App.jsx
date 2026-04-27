import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useBurrow } from './hooks/useBurrow';
import Home from './pages/Home';
import Viewer from './pages/Viewer';
import './App.css';

export default function App() {
  const burrow = useBurrow();

  /**
   * Handle starting a topic — supports two modes:
   * 1. Fresh query: calls API, waits for result
   * 2. Gallery item: restore the full session (all pages) instantly from cache
   */
  async function handleStartTopic(query, galleryItem) {
    if (galleryItem) {
      if (galleryItem.guided) {
        // Community gallery: start at Layer 1, show hint markers for every
        // spot a previous user clicked (tree-based, multi-path).
        if (galleryItem.tree || galleryItem.pages?.length >= 1) {
          burrow._loadGuidedSession(galleryItem, query);
        } else {
          burrow._injectPage({ id: galleryItem.id, imageUrl: galleryItem.thumbnailUrl, query });
        }
      } else {
        // Personal history: restore the full session at the layer they left off on.
        if (galleryItem.pages && galleryItem.pages.length > 1) {
          burrow._restoreSession(galleryItem.pages, query);
        } else {
          burrow._injectPage({ id: galleryItem.id, imageUrl: galleryItem.thumbnailUrl, query });
        }
      }
      return;
    }
    await burrow.startTopic(query);
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home onStartTopic={handleStartTopic} />} />
        <Route path="/explore" element={<Viewer burrow={burrow} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

import { useState, useCallback, useRef } from 'react';

/**
 * Manages a collection of independently streaming flashcards.
 *
 * Each card: { id, question, answer, streaming, flipped }
 *
 * addQuestion(question, context) → fires /api/answer, creates a card immediately,
 *   streams tokens into that specific card concurrently with other cards.
 * flipCard(id)   → toggles front/back
 * removeCard(id) → aborts stream if active, removes card
 * clearAll()     → aborts all streams, empties array
 */
export function useFlashcards() {
  const [cards, setCards] = useState([]);
  // Map of cardId → AbortController for in-flight streams
  const abortMap = useRef({});

  const addQuestion = useCallback(async (question, context = '') => {
    // Don't add a duplicate that's already streaming
    // (allow re-asking finished cards — user might want to compare answers)
    const id = Date.now();
    const ctrl = new AbortController();
    abortMap.current[id] = ctrl;

    // Add card immediately so the UI reacts before the fetch even starts
    setCards(prev => [
      { id, question, answer: '', streaming: true, flipped: false },
      ...prev,
    ]);

    try {
      const params = new URLSearchParams({ question });
      if (context) params.set('context', context);
      const res = await fetch(`/api/answer?${params}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';

        for (const part of parts) {
          if (!part.startsWith('data:')) continue;
          const raw = part.slice(5).trim();
          if (raw === '[DONE]') {
            setCards(prev => prev.map(c => c.id === id ? { ...c, streaming: false } : c));
            return;
          }
          try {
            const { token } = JSON.parse(raw);
            if (token) {
              setCards(prev =>
                prev.map(c => c.id === id ? { ...c, answer: c.answer + token } : c)
              );
            }
          } catch { /* ignore malformed SSE lines */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[useFlashcards]', err.message);
      }
    } finally {
      delete abortMap.current[id];
      setCards(prev => prev.map(c => c.id === id ? { ...c, streaming: false } : c));
    }
  }, []);

  const flipCard = useCallback((id) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, flipped: !c.flipped } : c));
  }, []);

  const removeCard = useCallback((id) => {
    abortMap.current[id]?.abort();
    delete abortMap.current[id];
    setCards(prev => prev.filter(c => c.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    Object.values(abortMap.current).forEach(ctrl => ctrl.abort());
    abortMap.current = {};
    setCards([]);
  }, []);

  // The set of questions already in the stack (for NarrationPanel highlight)
  const askedQuestions = new Set(cards.map(c => c.question));

  return { cards, askedQuestions, addQuestion, flipCard, removeCard, clearAll };
}

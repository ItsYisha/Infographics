import { useState, useRef, useCallback } from 'react';

/**
 * Streams fun facts from an SSE endpoint via fetch + ReadableStream.
 * (Not EventSource — Vite's dev-proxy buffers EventSource responses.)
 *
 * Server emits: data: {"fact": "..."}\n\n  (one per completed FACT: line)
 * This hook collects them into a `facts` string array.
 *
 * Two trigger modes:
 *   - startTopicNarration(query)        → during first-page generation
 *   - startNarration(parentId, x, y)    → during child-page drill-down
 */
export function useNarration() {
  const [facts, setFacts] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef(null);

  const clearNarration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setFacts([]);
    setStreaming(false);
  }, []);

  /** Internal: start streaming facts from a given URL. */
  const _startStream = useCallback((url) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setFacts([]);
    setStreaming(true);

    (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok || !response.body) {
          setStreaming(false);
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE events: "data: ...\n\n"
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            for (const line of part.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();

              if (data === '[DONE]') {
                setStreaming(false);
                abortRef.current = null;
                return;
              }

              try {
                const { fact, error } = JSON.parse(data);
                if (error) { setStreaming(false); return; }
                if (fact)  setFacts(prev => [...prev, fact]);
              } catch {
                // ignore malformed JSON
              }
            }
          }
        }

        setStreaming(false);
      } catch (err) {
        if (err.name !== 'AbortError') setStreaming(false);
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    })();
  }, []);

  /** First-page mode — facts about the typed topic while initial image generates. */
  const startTopicNarration = useCallback((query) => {
    _startStream(`/api/narrate-topic?query=${encodeURIComponent(query)}`);
  }, [_startStream]);

  /** Drill-down mode — facts about the clicked element. */
  const startNarration = useCallback((parentId, x, y) => {
    _startStream(`/api/narrate?parentId=${encodeURIComponent(parentId)}&x=${x}&y=${y}`);
  }, [_startStream]);

  return { facts, streaming, startNarration, startTopicNarration, clearNarration };
}

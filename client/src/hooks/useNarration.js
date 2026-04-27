import { useState, useRef, useCallback } from 'react';

/**
 * Streams narration text from an SSE endpoint via fetch + ReadableStream.
 * (Not EventSource — Vite's dev-proxy buffers EventSource responses.)
 *
 * Two trigger modes share the same stream parser:
 *   - startTopicNarration(query)            → during first-page generation
 *   - startNarration(parentId, x, y)        → during child-page drill-down
 *
 * Returns { text, streaming, startNarration, startTopicNarration, clearNarration }.
 */
export function useNarration() {
  const [text, setText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef(null);

  const clearNarration = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setText('');
    setStreaming(false);
  }, []);

  /** Internal: start streaming from a given URL. */
  const _startStream = useCallback((url) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setText('');
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

          // SSE events come in as "data: ...\n\n" — split on blank line
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? ''; // keep incomplete trailing chunk

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
                const { token, error } = JSON.parse(data);
                if (error) { setStreaming(false); return; }
                if (token) setText(prev => prev + token);
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

  /** First-page mode — narrates the typed topic while initial image generates. */
  const startTopicNarration = useCallback((query) => {
    _startStream(`/api/narrate-topic?query=${encodeURIComponent(query)}`);
  }, [_startStream]);

  /** Drill-down mode — narrates the clicked element.
   *  topic: root query string (e.g. "why renaissance happened in Italy")
   *  label: current page label if available (e.g. "Florence") */
  const startNarration = useCallback((parentId, x, y, topic, label) => {
    const params = new URLSearchParams({ parentId, x, y });
    if (topic) params.set('topic', topic);
    if (label) params.set('label', label);
    _startStream(`/api/narrate?${params}`);
  }, [_startStream]);

  return { text, streaming, startNarration, startTopicNarration, clearNarration };
}

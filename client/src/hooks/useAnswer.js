import { useState, useCallback, useRef } from 'react';

/**
 * Streams a focused answer to a single question via /api/answer (SSE).
 *
 * Usage:
 *   const { question, answer, streaming, askQuestion, clear } = useAnswer();
 *
 * askQuestion(q, context?) — fires immediately, resets any in-flight request.
 * clear()                  — aborts stream, resets state.
 */
export function useAnswer() {
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer]     = useState('');
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef(null);

  const askQuestion = useCallback(async (q, context = '') => {
    // Cancel any previous request
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setQuestion(q);
    setAnswer('');
    setStreaming(true);

    try {
      const params = new URLSearchParams({ question: q });
      if (context) params.set('context', context);
      const res = await fetch(`/api/answer?${params}`, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';
        for (const part of parts) {
          if (!part.startsWith('data:')) continue;
          const raw = part.slice(5).trim();
          if (raw === '[DONE]') { setStreaming(false); return; }
          try {
            const { token } = JSON.parse(raw);
            if (token) setAnswer(prev => prev + token);
          } catch { /* ignore malformed */ }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('[useAnswer]', err.message);
      }
    } finally {
      setStreaming(false);
    }
  }, []);

  const clear = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setQuestion(null);
    setAnswer('');
    setStreaming(false);
  }, []);

  return { question, answer, streaming, askQuestion, clear };
}

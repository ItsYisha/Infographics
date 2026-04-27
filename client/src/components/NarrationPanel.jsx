import { useState, useEffect, useRef } from 'react';
import './NarrationPanel.css';

/**
 * Fun Facts overlay — absolutely positioned over the image canvas.
 * Shows one fact at a time, cycling through all collected facts in a loop.
 * Visible only while the image is generating (generating=true) or facts exist.
 */
export default function NarrationPanel({ facts = [], streaming, generating }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [visible, setVisible]     = useState(false);
  const [exiting, setExiting]     = useState(false);
  const timerRef  = useRef(null);
  const cycleMs   = 4000; // how long each fact shows

  // Show panel as soon as we have at least one fact
  useEffect(() => {
    if (facts.length > 0) setVisible(true);
  }, [facts.length]);

  // Hide panel when generation is done and we've shown all facts at least once
  useEffect(() => {
    if (!generating && !streaming && facts.length > 0) {
      // Give the user a moment to read the current fact, then fade out
      const t = setTimeout(() => setVisible(false), 1200);
      return () => clearTimeout(t);
    }
  }, [generating, streaming, facts.length]);

  // Reset when facts are cleared (new drill-down started)
  useEffect(() => {
    if (facts.length === 0) {
      setVisible(false);
      setActiveIdx(0);
    }
  }, [facts.length]);

  // Cycle through facts
  useEffect(() => {
    if (!visible || facts.length === 0) return;

    timerRef.current = setInterval(() => {
      setExiting(true);
      setTimeout(() => {
        setActiveIdx(prev => (prev + 1) % facts.length);
        setExiting(false);
      }, 350); // match CSS exit duration
    }, cycleMs);

    return () => clearInterval(timerRef.current);
  }, [visible, facts.length]);

  if (!visible || facts.length === 0) return null;

  const fact = facts[activeIdx];

  return (
    <div className={`fun-facts-overlay ${visible ? 'fun-facts-visible' : ''}`}>
      <div className="fun-facts-inner">
        <div className="fun-facts-label">✦ Fun Fact</div>
        <p className={`fun-facts-text ${exiting ? 'fun-facts-exit' : 'fun-facts-enter'}`}
           key={activeIdx}>
          {fact}
        </p>
        <div className="fun-facts-footer">
          <div className="fun-facts-dots">
            {facts.map((_, i) => (
              <span
                key={i}
                className={`fun-facts-dot ${i === activeIdx ? 'fun-facts-dot-active' : ''}`}
              />
            ))}
          </div>
          <span className="fun-facts-counter">{activeIdx + 1} / {facts.length}</span>
        </div>
      </div>
    </div>
  );
}

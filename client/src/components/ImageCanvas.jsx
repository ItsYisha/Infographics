import { useRef, useState } from 'react';
import './ImageCanvas.css';

const DICEBEAR = 'https://api.dicebear.com/7.x/pixel-art/svg?seed=';
const MAX_TOOLTIP_AVATARS = 5;

/**
 * The main interactive image.
 *
 * hintSpots: Array<{ x, y, visitors: [{seed, timestamp}] }>
 *   Each spot is a location where at least one community member previously
 *   clicked to go deeper. Hovering shows who went there.
 */
export default function ImageCanvas({ imageUrl, onElementClick, generating, hintSpots = [] }) {
  const imgRef = useRef(null);
  const [ripple, setRipple] = useState(null);
  const [hoveredSpot, setHoveredSpot] = useState(null); // index into hintSpots

  function handleClick(e) {
    if (generating) return;
    const rect = imgRef.current.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const x  = px / rect.width;
    const y  = py / rect.height;
    setRipple({ px, py });
    setTimeout(() => setRipple(null), 700);
    onElementClick(x, y);
  }

  return (
    <div className={`image-canvas-wrap ${generating ? 'generating' : ''}`}>
      <img
        ref={imgRef}
        src={imageUrl}
        alt="Illustrated explainer"
        className="image-canvas-img"
        onClick={handleClick}
        draggable={false}
      />

      {/* ── Gallery hint spots ── */}
      {!generating && hintSpots.map((spot, i) => (
        <div
          key={i}
          className="hint-spot"
          style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%` }}
          onMouseEnter={() => setHoveredSpot(i)}
          onMouseLeave={() => setHoveredSpot(null)}
        >
          <div className="hint-spot-ring hint-spot-ring-outer" />
          <div className="hint-spot-ring hint-spot-ring-inner" />
          <div className="hint-spot-dot" />

          {/* Hover tooltip — avatars of visitors who clicked here */}
          {hoveredSpot === i && (
            <div
              className={`hint-spot-tooltip ${spot.y > 0.65 ? 'hint-spot-tooltip-above' : ''}`}
            >
              {spot.visitors.length > 0 ? (
                <>
                  <div className="hint-spot-avatars">
                    {spot.visitors.slice(0, MAX_TOOLTIP_AVATARS).map(v => (
                      <img
                        key={v.seed}
                        className="hint-spot-avatar"
                        src={`${DICEBEAR}${encodeURIComponent(v.seed)}`}
                        alt=""
                      />
                    ))}
                    {spot.visitors.length > MAX_TOOLTIP_AVATARS && (
                      <span className="hint-spot-more">
                        +{spot.visitors.length - MAX_TOOLTIP_AVATARS}
                      </span>
                    )}
                  </div>
                  <p className="hint-spot-tooltip-text">
                    {spot.visitors.length === 1 ? '1 explorer' : `${spot.visitors.length} explorers`}
                    {' '}went here
                  </p>
                </>
              ) : (
                <p className="hint-spot-tooltip-text">Others explored here</p>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Ripple at click location */}
      {ripple && !generating && (
        <span
          className="click-ripple"
          style={{ left: ripple.px, top: ripple.py }}
        />
      )}

      {/* Generating overlay */}
      {generating && (
        <div className="generating-overlay">
          <div className="generating-spinner" />
          <span>Generating…</span>
        </div>
      )}

      {/* Hint badge */}
      {!generating && (
        <div className="canvas-hint">
          {hintSpots.length > 0
            ? `${hintSpots.length} path${hintSpots.length > 1 ? 's' : ''} explored — click a glow to follow, or explore anywhere`
            : 'Click anywhere to dive deeper'}
        </div>
      )}
    </div>
  );
}

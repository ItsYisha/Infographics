import { useEffect, useRef, useState } from 'react';
import './EraserRabbit.css';

const ROWS          = 8;
const FACT_INTERVAL = 7000; // ms between fun-fact switches
const EMERGE_DELAY  = 480;  // ms for hole to open + rabbit to pop up

// Build horizontal boustrophedon (zigzag) scan segments
// Extended slightly past edges so the eraser ellipse covers the borders
function buildSegments(W, H) {
  const mg = W * 0.1; // margin beyond edges
  return Array.from({ length: ROWS }, (_, r) => {
    const y = H * (r + 0.5) / ROWS;
    return r % 2 === 0
      ? { x1: -mg,    y1: y, x2: W + mg, y2: y, len: W + 2 * mg }
      : { x1: W + mg, y1: y, x2: -mg,    y2: y, len: W + 2 * mg };
  });
}

/**
 * Rabbit that pops out of the click position and "erases" the current image
 * row by row, revealing the next generated image underneath.
 *
 * Props:
 *   active      — true while generating
 *   clickPos    — { x, y } normalised 0-1 (where the user clicked)
 *   oldImageUrl — image URL being erased
 *   facts       — string[] from useNarration (grows as stream arrives)
 *   imageReady  — true the moment generating becomes false
 *   onDone      — called when canvas is fully cleared
 */
export default function EraserRabbit({
  active,
  clickPos,
  oldImageUrl,
  facts = [],
  imageReady,
  onDone,
}) {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const rabbitRef    = useRef(null);
  const holeRef      = useRef(null);
  const bubbleRef    = useRef(null);

  // Always-fresh refs so the rAF closure picks up latest values
  const factsRef      = useRef(facts);
  const imageReadyRef = useRef(imageReady);
  useEffect(() => { factsRef.current      = facts;      }, [facts]);
  useEffect(() => { imageReadyRef.current = imageReady; }, [imageReady]);

  // Only used for CSS state classes — minimal re-renders (3-4 total per drill)
  const [phase, setPhase] = useState('idle');

  /* ── Main animation effect ───────────────────────────────────────────────── */
  useEffect(() => {
    if (!active || !clickPos || !oldImageUrl) return;

    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!container || !canvas) return;

    const { width: W, height: H } = container.getBoundingClientRect();
    if (W === 0 || H === 0) return;

    canvas.width  = W;
    canvas.height = H;
    const ctx  = canvas.getContext('2d');
    const segs = buildSegments(W, H);
    const totalLen = segs.reduce((s, sg) => s + sg.len, 0);

    // ── Mutable animation state (all in closure, zero extra React state) ──
    let segIdx     = 0;
    let segProg    = 0;    // 0–1 along current segment
    let totalDist  = 0;
    let lastTs     = null;
    let aPhase     = 'erasing'; // local animation phase (mirrors React phase)
    let factIdx    = 0;
    let lastFactTs = -Infinity;
    let factsShown = false;
    let running    = true;
    let rafId      = null;

    // ── DOM helpers (direct style manipulation — no React re-renders) ─────
    function rabbitPos(x, y) {
      const lp = `${Math.max(0, Math.min(100, (x / W) * 100))}%`;
      const tp = `${Math.max(0, Math.min(100, (y / H) * 100))}%`;
      if (rabbitRef.current) {
        rabbitRef.current.style.left = lp;
        rabbitRef.current.style.top  = tp;
      }
      if (bubbleRef.current) {
        // Clamp so bubble tail never exits horizontally
        const clampedX = Math.max(W * 0.15, Math.min(W * 0.85, x));
        bubbleRef.current.style.left = `${(clampedX / W) * 100}%`;
        bubbleRef.current.style.top  = tp;
      }
    }

    function erasePx(x, y) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.ellipse(x, y, W * 0.09, W * 0.065, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function localSetPhase(p) {
      aPhase = p;
      setPhase(p); // triggers ≤4 React re-renders total
    }

    function showFact(text) {
      const el = bubbleRef.current;
      if (!el || !text) return;
      // Fade out → swap text → fade in
      el.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      el.style.opacity    = '0';
      el.style.transform  = 'translate(-50%, -100%) translateY(-14px) scale(0.88)';
      setTimeout(() => {
        if (!running) return;
        el.textContent      = text;
        el.style.opacity    = '1';
        el.style.transform  = 'translate(-50%, -100%) translateY(-14px) scale(1)';
      }, 360);
    }

    // ── Animation tick ───────────────────────────────────────────────────────
    function tick(ts) {
      if (!running) return;
      if (!lastTs) lastTs = ts;
      const dt = Math.min((ts - lastTs) / 1000, 0.05); // cap at 50 ms
      lastTs = ts;

      // Phase transitions
      const progress = totalDist / totalLen;
      if (aPhase === 'erasing' && progress >= 0.75 && !imageReadyRef.current) {
        localSetPhase('tired');
      }
      if ((aPhase === 'erasing' || aPhase === 'tired') && imageReadyRef.current) {
        localSetPhase('finishing');
      }

      // Speed in px/s
      const spd =
        aPhase === 'finishing' ? W / 2.2 :
        aPhase === 'tired'     ? W / 18  :
                                 W / 3.2;

      const distNow = spd * dt;
      const seg     = segs[Math.min(segIdx, segs.length - 1)];
      segProg    += distNow / seg.len;
      totalDist  += distNow;

      // Advance to next segment when current is done
      while (segProg >= 1 && segIdx < segs.length - 1) {
        segProg -= 1;
        segIdx++;
      }
      if (segIdx >= segs.length - 1) segProg = Math.min(segProg, 1);

      const cur = segs[Math.min(segIdx, segs.length - 1)];
      const t   = Math.min(segProg, 1);
      const cx  = cur.x1 + (cur.x2 - cur.x1) * t;
      const cy  = cur.y1;

      erasePx(cx, cy);
      rabbitPos(cx, cy);

      // Fun facts: first one as soon as available, then cycle
      const cf = factsRef.current;
      if (cf.length > 0) {
        if (!factsShown) {
          factsShown = true;
          lastFactTs = ts;
          showFact(cf[0]);
        } else if (ts - lastFactTs > FACT_INTERVAL) {
          factIdx    = (factIdx + 1) % cf.length;
          lastFactTs = ts;
          showFact(cf[factIdx]);
        }
      }

      // Completion check
      if (totalDist / totalLen >= 1) {
        running = false;
        // Close hole
        if (holeRef.current) {
          holeRef.current.style.width  = '0';
          holeRef.current.style.height = '0';
        }
        // Hide bubble
        if (bubbleRef.current) {
          bubbleRef.current.style.opacity = '0';
        }
        setPhase('idle');
        onDone?.();
        return;
      }

      rafId = requestAnimationFrame(tick);
    }

    // ── Setup: position hole + rabbit, load image, start loop ────────────
    // Position hole at click point
    if (holeRef.current) {
      holeRef.current.style.left   = `${clickPos.x * 100}%`;
      holeRef.current.style.top    = `${clickPos.y * 100}%`;
      holeRef.current.style.width  = '0';
      holeRef.current.style.height = '0';
    }
    // Place rabbit at click point during emerging
    rabbitPos(clickPos.x * W, clickPos.y * H);
    setPhase('emerging');

    // Open hole with CSS transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (holeRef.current && running) {
          holeRef.current.style.width  = '62px';
          holeRef.current.style.height = '22px';
        }
      });
    });

    // Load image and start scan after emerge delay
    const img      = new Image();
    let   timerRef = null;

    img.onload = () => {
      ctx.drawImage(img, 0, 0, W, H);
      timerRef = setTimeout(() => {
        if (!running) return;
        // Snap rabbit to start of row 0
        const s0 = segs[0];
        rabbitPos(s0.x1, s0.y1);
        setPhase('erasing');
        lastTs = performance.now();
        rafId  = requestAnimationFrame(tick);
      }, EMERGE_DELAY);
    };
    img.onerror = () => {
      // Fallback: start with blank canvas (still reveal new image)
      timerRef = setTimeout(() => {
        if (!running) return;
        setPhase('erasing');
        lastTs = performance.now();
        rafId  = requestAnimationFrame(tick);
      }, EMERGE_DELAY);
    };
    img.src = oldImageUrl;

    return () => {
      running = true; // keep running flag but cancel rAF
      running = false;
      clearTimeout(timerRef);
      if (rafId) cancelAnimationFrame(rafId);
    };
  // Re-run only when a new drill-down begins
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, clickPos?.x, clickPos?.y, oldImageUrl]);

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div
      ref={containerRef}
      className={`eraser-rabbit-container${phase !== 'idle' ? ' is-active' : ''}`}
    >
      {/* Canvas — holds the old image, gets erased by destination-out */}
      <canvas ref={canvasRef} className="eraser-rabbit-canvas" />

      {/* Rabbit hole at click position */}
      <div ref={holeRef} className="eraser-rabbit-hole" />

      {/* Fun-fact speech bubble — position tracked via ref.style */}
      <div ref={bubbleRef} className="rabbit-bubble" style={{ opacity: 0 }} />

      {/* Rabbit SVG character */}
      <svg
        ref={rabbitRef}
        className={`eraser-rabbit-svg state-${phase}`}
        viewBox="0 0 70 90"
        width="70"
        height="90"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* ── Ears ── */}
        <ellipse cx="22" cy="18" rx="7"  ry="18" fill="#f5f0e8" stroke="#d4c8b8" strokeWidth="1.5"/>
        <ellipse cx="22" cy="18" rx="4"  ry="13" fill="#f0a0b0" opacity="0.65"/>
        <ellipse cx="48" cy="18" rx="7"  ry="18" fill="#f5f0e8" stroke="#d4c8b8" strokeWidth="1.5"/>
        <ellipse cx="48" cy="18" rx="4"  ry="13" fill="#f0a0b0" opacity="0.65"/>
        {/* ── Body ── */}
        <ellipse cx="35" cy="72" rx="18" ry="17" fill="#f5f0e8" stroke="#d4c8b8" strokeWidth="1.5"/>
        {/* ── Head ── */}
        <ellipse cx="35" cy="44" rx="21" ry="19" fill="#f5f0e8" stroke="#d4c8b8" strokeWidth="1.5"/>
        {/* ── Eyes (pink) + specular ── */}
        <circle cx="27"   cy="41"   r="3.5" fill="#e07070"/>
        <circle cx="43"   cy="41"   r="3.5" fill="#e07070"/>
        <circle cx="28.2" cy="39.8" r="1.2" fill="white"/>
        <circle cx="44.2" cy="39.8" r="1.2" fill="white"/>
        {/* ── Nose ── */}
        <ellipse cx="35" cy="47.5" rx="3" ry="2" fill="#e8a0a0"/>
        {/* ── Whiskers ── */}
        <line x1="25" y1="46"  x2="12" y2="43.5" stroke="#d4c8b8" strokeWidth="0.9"/>
        <line x1="25" y1="48.5" x2="12" y2="51"  stroke="#d4c8b8" strokeWidth="0.9"/>
        <line x1="45" y1="46"  x2="58" y2="43.5" stroke="#d4c8b8" strokeWidth="0.9"/>
        <line x1="45" y1="48.5" x2="58" y2="51"  stroke="#d4c8b8" strokeWidth="0.9"/>
        {/* ── Off-hand (left) ── */}
        <line x1="20" y1="65" x2="10" y2="76"
              stroke="#d4c8b8" strokeWidth="5" strokeLinecap="round"/>
        {/* ── Eraser arm (right) — animated via CSS ── */}
        <g className="rabbit-arm-erasing">
          <line x1="50" y1="65" x2="63" y2="57"
                stroke="#d4c8b8" strokeWidth="5" strokeLinecap="round"/>
          <rect x="61" y="51" width="14" height="9" rx="2.5"
                fill="#ff9999" stroke="#cc6060" strokeWidth="1"/>
          <rect x="61" y="54" width="14" height="2.5" fill="#cc6060" opacity="0.35"/>
        </g>
        {/* ── Tail ── */}
        <circle cx="24" cy="86" r="6" fill="white" stroke="#d4c8b8" strokeWidth="1"/>
      </svg>
    </div>
  );
}

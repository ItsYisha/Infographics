/**
 * Client-side video export — no server required.
 * Stitches the drill-down page images into a WebM video using
 * Canvas + MediaRecorder with a Ken Burns zoom transition between pages.
 */

const FPS = 30;
const HOLD_SECONDS = 1.8;        // seconds each image is shown static
const TRANSITION_SECONDS = 2.0;  // dramatic parent → child zoom (was 1.2)

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Draw a single frame with an animated scale around the click point.
 * scale > 1 zooms in; the image is centered on (focusX, focusY) normalised coords.
 * Draws the "🐇 Burrow" watermark at bottom-right.
 */
function drawFrame(ctx, img, scale, focusX = 0.5, focusY = 0.5, W = 1024, H = 1024) {
  ctx.clearRect(0, 0, W, H);
  ctx.save();

  const ox = focusX * W;
  const oy = focusY * H;

  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  ctx.translate(-ox, -oy);

  ctx.drawImage(img, 0, 0, W, H);
  ctx.restore();

  // ── Watermark ────────────────────────────────────────────────────────────
  const label = '🐇 Burrow';
  const pad = 16;
  const fontSize = 22;
  ctx.save();
  ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'right';
  // Pill background
  const metrics = ctx.measureText(label);
  const tw = metrics.width;
  const th = fontSize;
  const bx = W - pad - tw - 14;
  const by = H - pad - th - 6;
  const bw = tw + 28;
  const bh = th + 12;
  const br = bh / 2;
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, br);
  ctx.fill();
  // Text
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#3a3530';
  ctx.fillText(label, W - pad, H - pad);
  ctx.restore();
}

/**
 * Export a single page as a PNG image download.
 * @param {{ imageUrl: string, query?: string }} page
 */
export async function exportImage(page) {
  const W = 1024;
  const H = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = await loadImage(page.imageUrl);

  ctx.drawImage(img, 0, 0, W, H);

  // Watermark
  const label = '🐇 Burrow';
  const pad = 16;
  const fontSize = 22;
  ctx.save();
  ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'right';
  const metrics = ctx.measureText(label);
  const tw = metrics.width;
  const th = fontSize;
  const bx = W - pad - tw - 14;
  const by = H - pad - th - 6;
  const bw = tw + 28;
  const bh = th + 12;
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#3a3530';
  ctx.fillText(label, W - pad, H - pad);
  ctx.restore();

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'burrow-exploration.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/**
 * Export all layers as a single tall stitched PNG with layer labels.
 * Useful for sharing the entire drill-down as one image.
 * @param {Array<{imageUrl: string, query?: string}>} pages
 */
export async function exportAllImages(pages) {
  if (!pages || pages.length === 0) return;

  const TILE = 1024;
  const GAP = 40;
  const HEADER_H = 64; // small label band above each tile
  const PADDING = 32;

  const imgs = await Promise.all(pages.map(p => loadImage(p.imageUrl)));

  const W = TILE + PADDING * 2;
  const H = PADDING * 2 + imgs.length * (HEADER_H + TILE) + (imgs.length - 1) * GAP;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Cream background to match the watercolor style
  ctx.fillStyle = '#faf6ec';
  ctx.fillRect(0, 0, W, H);

  let y = PADDING;
  for (let i = 0; i < imgs.length; i++) {
    // Layer label band
    ctx.fillStyle = '#3a3530';
    ctx.font = '700 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(`Layer ${i + 1}`, PADDING, y + HEADER_H / 2);

    // Subtle divider line on the right of the label
    ctx.strokeStyle = '#d4cfc5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING + 100, y + HEADER_H / 2);
    ctx.lineTo(W - PADDING, y + HEADER_H / 2);
    ctx.stroke();

    y += HEADER_H;

    // The illustration
    ctx.drawImage(imgs[i], PADDING, y, TILE, TILE);

    y += TILE + GAP;
  }

  // Watermark in the bottom-right
  const label = '🐇 Burrow';
  const fontSize = 24;
  ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'right';
  const tw = ctx.measureText(label).width;
  const bx = W - PADDING - tw - 14;
  const by = H - PADDING - fontSize - 6;
  const bw = tw + 28;
  const bh = fontSize + 12;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.fillStyle = '#3a3530';
  ctx.fillText(label, W - PADDING, H - PADDING);

  await new Promise((resolve) => {
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `burrow-journey-${pages.length}layers.png`;
      a.click();
      URL.revokeObjectURL(url);
      resolve();
    }, 'image/png');
  });
}

/**
 * Export the full drill-down journey as a WebM video file.
 * @param {Array<{imageUrl: string, click?: {x:number, y:number}}>} pages
 */
export async function exportVideo(pages) {
  if (!pages || pages.length === 0) return;

  const W = 1024;
  const H = 1024;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Pick the best supported format — prefer MP4 (H.264) for universal playability,
  // fall back to VP9/VP8 WebM if MP4 is not available (older Chrome / Firefox).
  const mimeType = [
    'video/mp4;codecs=avc1',   // Chrome 130+, Safari, Edge → .mp4
    'video/mp4',               // Safari fallback
    'video/webm;codecs=vp9',   // Chrome < 130, Firefox
    'video/webm',              // last resort
  ].find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';

  const isMP4 = mimeType.startsWith('video/mp4');

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  recorder.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);

  recorder.start();

  // Pre-load all images
  const imgs = await Promise.all(pages.map(p => loadImage(p.imageUrl)));

  const holdFrames = Math.round(HOLD_SECONDS * FPS);
  const transFrames = Math.round(TRANSITION_SECONDS * FPS);

  for (let i = 0; i < imgs.length; i++) {
    const img = imgs[i];
    const nextClick = pages[i].click; // click coords used for transition focus

    // --- Hold current image static ---
    for (let f = 0; f < holdFrames; f++) {
      drawFrame(ctx, img, 1, 0.5, 0.5, W, H);
      await sleep(1000 / FPS);
    }

    // --- Transition: parent (start frame) → child (end frame) ---
    // Two-phase to emphasise the "drilling deeper" feeling:
    //   phase 1 (0 → 0.55): zoom INTO click point on parent (scale 1 → 2.6)
    //   phase 2 (0.45 → 1): child rushes in from 0.4 → 1.0, crossfade
    // Phases overlap from 0.45 to 0.55 so the swap feels seamless.
    if (i < imgs.length - 1) {
      const fx = nextClick ? nextClick.x : 0.5;
      const fy = nextClick ? nextClick.y : 0.5;

      for (let f = 0; f < transFrames; f++) {
        const t = f / transFrames;
        // Ease in-out cubic
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        // Parent: dramatic zoom into the click point (scale 1 → 2.6)
        const parentScale = 1 + eased * 1.6;
        // Parent fades out from t=0.45 onward
        const parentAlpha = t < 0.45 ? 1 : Math.max(0, 1 - (t - 0.45) / 0.55);

        // Child: starts becoming visible at t=0.45, grows from 0.4 → 1.0
        const childT = Math.max(0, (t - 0.45) / 0.55);
        const childEased = childT < 0.5 ? 4 * childT ** 3 : 1 - Math.pow(-2 * childT + 2, 3) / 2;
        const childScale = 0.4 + childEased * 0.6;
        const childAlpha = childT;

        // Draw parent (zooming in toward click point)
        ctx.globalAlpha = parentAlpha;
        drawFrame(ctx, img, parentScale, fx, fy, W, H);

        // Draw child (growing into position from the click point)
        if (childAlpha > 0) {
          ctx.globalAlpha = childAlpha;
          drawFrame(ctx, imgs[i + 1], childScale, fx, fy, W, H);
        }

        ctx.globalAlpha = 1;
        await sleep(1000 / FPS);
      }
    }
  }

  // Hold last frame
  for (let f = 0; f < holdFrames; f++) {
    drawFrame(ctx, imgs[imgs.length - 1], 1, 0.5, 0.5, W, H);
    await sleep(1000 / FPS);
  }

  recorder.stop();

  await new Promise(resolve => { recorder.onstop = resolve; });

  const blob = new Blob(chunks, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = isMP4 ? 'burrow-journey.mp4' : 'burrow-journey.webm';
  a.click();
  URL.revokeObjectURL(url);
}

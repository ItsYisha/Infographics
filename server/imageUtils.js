const sharp = require('sharp');

/**
 * Composite a red ring + filled center dot onto an image buffer at normalized
 * coordinates (x, y) where x and y are in [0, 1].
 * Radius ≈ 4% of image width, as per the illustrated-explainer-spec.
 */
async function annotateWithRedDot(imageBuffer, x, y) {
  const meta = await sharp(imageBuffer).metadata();
  const W = meta.width;
  const H = meta.height;

  const r = Math.round(W * 0.04);          // outer ring radius
  const innerR = Math.round(r * 0.38);     // solid dot radius
  const stroke = Math.max(2, Math.round(r * 0.15));
  const cx = Math.round(x * W);
  const cy = Math.round(y * H);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <circle cx="${cx}" cy="${cy}" r="${r}"
      fill="rgba(220,0,0,0.30)"
      stroke="red"
      stroke-width="${stroke}"/>
    <circle cx="${cx}" cy="${cy}" r="${innerR}"
      fill="red"/>
  </svg>`;

  return sharp(imageBuffer)
    .composite([{ input: Buffer.from(svg), blend: 'over' }])
    .png()
    .toBuffer();
}

module.exports = { annotateWithRedDot };

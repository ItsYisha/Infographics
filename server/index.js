require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const OpenAI = require('openai');
const {
  firstPagePrompt,
  childPagePrompt,
  funFactsPrompt,
  topicFunFactsPrompt,
} = require('./prompts');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { annotateWithRedDot } = require('./imageUtils');
const cache   = require('./cache');
const { getGallery, addGalleryEntry, incrementStat, updateGalleryPages, addOrMergeDrill, setNodeLabel } = require('./gallery');

const app  = express();
const PORT = process.env.PORT || 3001;

const WUYIN_KEY  = process.env.WUYIN_API_KEY;
const WUYIN_BASE = 'https://api.wuyinkeji.com/api/async';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/cache', express.static(cache.CACHE_DIR));

// ─── helpers ─────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Upload an image Buffer to tmpfiles.org (free, no auth).
 * Returns a publicly accessible direct-download URL so the
 * Wuyin API (which is external) can fetch it.
 */
async function uploadToTemp(imageBuffer) {
  const formData = new FormData();
  formData.append(
    'file',
    new Blob([imageBuffer], { type: 'image/png' }),
    'annotated.png',
  );
  const res  = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: formData,
  });
  const json = await res.json();
  if (json.status !== 'success') throw new Error('Temp upload failed');
  // tmpfiles returns https://tmpfiles.org/<id>/file.png
  // Direct download requires inserting /dl/ after the domain
  return json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
}

/**
 * Submit an image-generation task to the Wuyin async API.
 * Returns the task id string.
 */
async function submitTask({ prompt, size = '1:1', urls = [] }) {
  const body = { prompt, size };
  if (urls.length) body.urls = urls;

  const res  = await fetch(`${WUYIN_BASE}/image_gpt`, {
    method:  'POST',
    headers: {
      Authorization:  WUYIN_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log('[submit]', JSON.stringify(json).slice(0, 200));

  if (json.code !== 200 || !json.data?.id) {
    throw new Error(json.msg || json.message || `Submit failed (code ${json.code})`);
  }
  return json.data.id;
}

/**
 * Poll /api/async/detail until success (status 2) or failure (status 3).
 * Returns the generated image as a Buffer.
 * Polls every 3 s, gives up after 3 min.
 */
async function pollTask(taskId, maxMs = 180_000) {
  const deadline = Date.now() + maxMs;

  while (Date.now() < deadline) {
    await sleep(3000);

    const res  = await fetch(
      `${WUYIN_BASE}/detail?id=${encodeURIComponent(taskId)}&key=${encodeURIComponent(WUYIN_KEY)}`,
    );
    const json = await res.json();
    console.log('[poll]', taskId, JSON.stringify(json).slice(0, 300));

    const d = json.data ?? {};
    // status: 0=init  1=processing  2=success  3=failed
    if (d.status === 2) {
      // The image URL lives in data.data (string) or data.url — log shows actual key
      const imageUrl = d.data || d.url || d.result || d.image_url;
      if (!imageUrl) throw new Error(`Success but no image URL. Full: ${JSON.stringify(d)}`);

      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`Failed to download image: ${imgRes.status}`);
      return Buffer.from(await imgRes.arrayBuffer());
    }
    if (d.status === 3) {
      throw new Error(`Generation failed: ${d.message || 'unknown'}`);
    }
    // status 0 or 1 → keep polling
  }
  throw new Error('Timed out waiting for image generation (3 min)');
}

// ─── title extraction via gpt-4o-mini vision ─────────────────────────────────
// Reads the visible title text from a generated illustration.
// Uses detail:'low' (fixed 85 image tokens) — cheap and fast (~1s).

async function extractImageTitle(imageBuffer) {
  try {
    const b64 = imageBuffer.toString('base64');
    const resp = await openai.chat.completions.create({
      model:      'gpt-4o-mini',
      max_tokens: 20,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${b64}`, detail: 'low' },
          },
          {
            type: 'text',
            text: 'What is the main title or heading printed at the top of this educational illustration? Reply with ONLY the title text as it appears — no quotes, no explanation. If there are subtitle dashes (— or :), keep just the main title before them.',
          },
        ],
      }],
    });
    const title = resp.choices[0]?.message?.content?.trim();
    return title || null;
  } catch (err) {
    console.warn('[extractImageTitle]', err.message);
    return null;
  }
}

// ─── generation queue (prevents duplicate concurrent tasks) ──────────────────

const inFlight = new Map();

async function generateAndCache(id, genFn) {
  if (cache.exists(id)) return;
  if (inFlight.has(id)) { await inFlight.get(id); return; }

  const p = genFn()
    .then(buf => { cache.write(id, buf); })
    .finally(() => inFlight.delete(id));

  inFlight.set(id, p);
  await p;
}

// ─── POST /api/page ──────────────────────────────────────────────────────────
app.post('/api/page', async (req, res) => {
  try {
    const { query, parentId, click, regenerate } = req.body;

    // --- validate ---
    if (query) {
      if (typeof query !== 'string' || !query.trim() || query.length > 300)
        return res.status(400).json({ error: 'Invalid query (1–300 chars)' });
    } else if (parentId && click) {
      const { x, y } = click;
      if (typeof x !== 'number' || typeof y !== 'number' || x < 0 || x > 1 || y < 0 || y > 1)
        return res.status(400).json({ error: 'click.x and click.y must be in [0, 1]' });
      if (!cache.exists(parentId))
        return res.status(404).json({ error: 'Parent page not found in cache' });
    } else {
      return res.status(400).json({ error: 'Provide { query } or { parentId, click }' });
    }

    const id       = query ? cache.firstPageId(query) : cache.childPageId(parentId, click.x, click.y);
    // Cache-bust query string so the browser re-fetches after regenerate
    const v        = regenerate ? `?v=${Date.now()}` : '';
    const imageUrl = `/cache/${id}.png${v}`;

    // If regenerate flag is set, bust the cache so we always re-render
    if (regenerate) cache.remove(id);

    // Serve from cache — include any previously extracted title
    if (cache.exists(id)) {
      return res.json({ id, imageUrl, cached: true, label: cache.readTitle(id) });
    }

    // --- generate ---
    await generateAndCache(id, async () => {
      if (query) {
        // ── First page: text → image ──────────────────────────────────────
        const taskId = await submitTask({ prompt: firstPagePrompt(query.trim()) });
        return pollTask(taskId);
      } else {
        // ── Child page: red-dot annotated image → drill-down ─────────────
        const parentBuf  = cache.read(parentId);
        const annotated  = await annotateWithRedDot(parentBuf, click.x, click.y);

        // Upload annotated PNG to a temp public host so Wuyin can fetch it
        const tempUrl    = await uploadToTemp(annotated);
        const taskId     = await submitTask({
          prompt: childPagePrompt(),
          urls:   [tempUrl],
        });
        return pollTask(taskId);
      }
    });

    if (query) {
      addGalleryEntry({ id, query: query.trim(), thumbnailUrl: imageUrl });
    }

    // Extract the visible title from the generated image and cache it.
    // Runs in parallel with the response — client gets the label on the same request.
    const imageBuf = cache.read(id);
    const label    = await extractImageTitle(imageBuf);
    if (label) cache.writeTitle(id, label);

    res.json({ id, imageUrl, cached: false, label });
  } catch (err) {
    console.error('[/api/page]', err.message);
    res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

// ─── SSE helper: stream FACT: lines as structured { fact } events ────────────
async function streamFacts(openaiStream, res) {
  let buf = '';
  for await (const chunk of openaiStream) {
    const token = chunk.choices[0]?.delta?.content;
    if (!token) continue;
    buf += token;
    // Flush every complete "FACT: ..." line immediately
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const m = line.match(/^FACT:\s*(.+)/i);
      if (m) res.write(`data: ${JSON.stringify({ fact: m[1].trim() })}\n\n`);
    }
  }
  // Flush any trailing content without a newline
  if (buf.trim()) {
    const m = buf.match(/^FACT:\s*(.+)/i);
    if (m) res.write(`data: ${JSON.stringify({ fact: m[1].trim() })}\n\n`);
  }
  res.write('data: [DONE]\n\n');
  res.end();
}

// ─── GET /api/narrate (SSE) ──────────────────────────────────────────────────
// Vision model identifies what's under the red dot and streams 20 fun facts
// about it — gives users something delightful to read while the image generates.
app.get('/api/narrate', async (req, res) => {
  const { parentId, x, y } = req.query;
  if (!parentId || x === undefined || y === undefined)
    return res.status(400).json({ error: 'parentId, x, y required' });
  if (!cache.exists(parentId))
    return res.status(404).json({ error: 'Parent not found' });

  const nx = parseFloat(x), ny = parseFloat(y);
  if (isNaN(nx) || isNaN(ny) || nx < 0 || nx > 1 || ny < 0 || ny > 1)
    return res.status(400).json({ error: 'x and y must be in [0, 1]' });

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  try {
    const parentBuf = cache.read(parentId);
    const annotated = await annotateWithRedDot(parentBuf, nx, ny);
    const b64       = annotated.toString('base64');

    const stream = await openai.chat.completions.create({
      model:      'gpt-4o-mini',
      stream:     true,
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${b64}`, detail: 'low' } },
          { type: 'text', text: funFactsPrompt() },
        ],
      }],
    });

    await streamFacts(stream, res);
  } catch (err) {
    console.error('[/api/narrate]', err.message);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ─── GET /api/narrate-topic (SSE) ────────────────────────────────────────────
// Streams 20 fun facts about the typed topic while the first illustration generates.
app.get('/api/narrate-topic', async (req, res) => {
  const { query } = req.query;
  if (!query || typeof query !== 'string' || !query.trim() || query.length > 300) {
    return res.status(400).json({ error: 'Invalid query' });
  }

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  try {
    const stream = await openai.chat.completions.create({
      model:      'gpt-4o-mini',
      stream:     true,
      max_tokens: 600,
      messages: [{ role: 'user', content: topicFunFactsPrompt(query.trim()) }],
    });

    await streamFacts(stream, res);
  } catch (err) {
    console.error('[/api/narrate-topic]', err.message);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ─── GET /api/gallery ────────────────────────────────────────────────────────
app.get('/api/gallery', (_req, res) => res.json(getGallery(20)));

// ─── POST /api/gallery/:id/click  &  /share ──────────────────────────────────
app.post('/api/gallery/:id/click', (req, res) => {
  incrementStat(req.params.id, 'clicks');
  res.json({ ok: true });
});
app.post('/api/gallery/:id/share', (req, res) => {
  incrementStat(req.params.id, 'shares');
  res.json({ ok: true });
});

// ─── PATCH /api/gallery/:id/pages ────────────────────────────────────────────
app.patch('/api/gallery/:id/pages', (req, res) => {
  const { pages } = req.body;
  if (!Array.isArray(pages)) return res.status(400).json({ error: 'pages must be an array' });
  updateGalleryPages(req.params.id, pages);
  res.json({ ok: true });
});

// ─── PATCH /api/gallery/:rootId/node/:nodeId/label ───────────────────────────
// Called after narration extracts "Zooming into: X" for a child page so the
// label is persisted in the tree and available to future visitors on instant-load.
app.patch('/api/gallery/:rootId/node/:nodeId/label', (req, res) => {
  const { label } = req.body;
  if (typeof label !== 'string' || !label.trim()) {
    return res.status(400).json({ error: 'label (string) required' });
  }
  const ok = setNodeLabel(req.params.rootId, req.params.nodeId, label.trim());
  res.json({ ok });
});

// ─── POST /api/gallery/:id/drill ─────────────────────────────────────────────
// Merges a single drill-down into the gallery tree so every user's exploration
// path is preserved and other visitors can see where people clicked.
//
// Body: { parentId, child: { id, imageUrl, click: {x,y} }, visitorSeed }
app.post('/api/gallery/:id/drill', (req, res) => {
  const { parentId, child, visitorSeed } = req.body;
  if (!parentId || !child?.id || !child?.imageUrl || !child?.click || !visitorSeed) {
    return res.status(400).json({ error: 'parentId, child.{id,imageUrl,click}, visitorSeed required' });
  }
  const ok = addOrMergeDrill(req.params.id, parentId, child, visitorSeed);
  res.json({ ok });
});

// ─── health ──────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ─── serve built frontend (production / ngrok sharing) ───────────────────────
const path = require('path');
const CLIENT_DIST = path.join(__dirname, '../client/dist');
if (require('fs').existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  // SPA fallback — let React Router handle all non-API routes (Express 5 syntax)
  app.get('/{*path}', (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`🐇 Burrow server → http://localhost:${PORT}`);
  console.log(`   Wuyin API key: ${WUYIN_KEY?.slice(0, 8)}…`);
  console.log(`   Cache: ${cache.CACHE_DIR}`);
});

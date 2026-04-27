# Burrow — Product Requirements Document

**Version:** 1.0  
**Last Updated:** 2026-04-27  
**Status:** Implemented (v1)

---

## 1. Product Vision

Burrow is a **visual knowledge explorer**: users type any topic, receive an illustrated educational infographic, then click anywhere on it to "drill down" infinitely. Each click zooms into whatever element the user points at, generating a new illustrated layer that reveals internal structure, mechanisms, or deeper context.

The core metaphor is a rabbit hole — you enter curious, you keep going deeper, and every layer surprises you. The community's collective exploration paths are preserved and surfaced as guided hints for new visitors.

### Design Principles

- **Visual-first.** Knowledge is transmitted through illustration, not text walls.
- **Curiosity-driven.** The UI never prescribes a path — users follow their interest.
- **Zero friction.** Cache hits are instant. Exploration never waits on menus.
- **Community knowledge.** Every exploration enriches the next visitor's starting point.
- **Watercolor aesthetic.** All illustrations share a consistent warm, educational style — clean ink lines, pale watercolor wash, cream paper tone, bold labels.

---

## 2. User Personas

| Persona | Description | Primary Goal |
|---------|-------------|--------------|
| **Curious Learner** | Student or self-learner who wants to understand a complex topic visually | Follow a topic from overview to deep detail at their own pace |
| **Quick Explorer** | Busy professional wanting a fast visual summary | Get the big picture in one illustrated layer |
| **Community Browser** | Visitor who discovers the gallery and follows others' exploration paths | See where others went, build on their work |
| **Creator** | User who generates original topics and shares their journey | Share an illustrated exploration with colleagues |

---

## 3. Core User Flows

### 3.1 Fresh Exploration

```
Home → Type topic → Submit
  ↓ (immediately navigate to Viewer)
Viewer shows placeholder + streaming narration (~30-60s wait for image)
  ↓ (image arrives)
Layer 1: illustrated infographic
  ↓ (user clicks a region)
Narration streams instantly (parallel) + new image generates (~30-60s)
  ↓ (image arrives)
Layer 2: drilled-in illustration
  ↓ (repeat infinitely)
```

### 3.2 Gallery-Guided Exploration

```
Home → Click gallery card
  ↓
Viewer shows Layer 1 + glowing hint spots at every previously explored click
  ↓ (user clicks hint spot)
Instant load — cached child image appears immediately (zero API wait)
  ↓ (or: user clicks elsewhere)
Normal generation flow
```

### 3.3 Personal History Restore

```
Home → Click own past topic in left sidebar
  ↓
Viewer restores full session at the last layer visited
All previously generated layers are accessible via LevelStrip
```

### 3.4 Knowledge Card Interaction

```
Narration panel shows 3 questions while image generates
  ↓ (user clicks a question)
Right panel slides in with a flippable flashcard
Front: question text
Back: 2-3 sentence answer (streams via GPT-4o-mini)
  ↓ (user flips card / clicks another question)
Card stays in right panel as Knowledge Stack
Stack cards can be expanded/collapsed and removed
```

### 3.5 Export Journey

```
(2+ layers generated)
  ↓ (user clicks Export button in topbar)
Dropdown: Current page PNG / All layers PNG / Journey video
  ↓
Client-side generation — no server needed
Download triggered automatically
```

---

## 4. Feature Specifications

### 4.1 Home Page

**Layout:** Horizontal split — left sidebar (personal history) + main area (hero + community gallery).

#### 4.1.1 Topic Input

- Single text input, max 300 characters
- Placeholder: "e.g. How does a black hole form?"
- Submit button ("Explore →") with spinner state
- On submit: fire-and-forget topic generation, navigate immediately to Viewer (so streaming narration can begin before image arrives)
- Suggestion chips below input: 12 curated topic examples, click to pre-fill

#### 4.1.2 Personal History Sidebar (left, 260px)

- Shows the current user's previously generated topics, stored in `localStorage`
- Each entry: thumbnail image, query text, layer count badge, relative timestamp, delete button
- Clicking restores full multi-layer session at the last visited layer
- Empty state: "Your explorations will appear here"
- Updates in real-time via `storage` events (cross-tab sync)

#### 4.1.3 Community Gallery

- Grid of gallery cards (min 200px per card, auto-fill)
- Sorted by engagement: `clicks + shares × 2`
- Each card shows:
  - Thumbnail image (1:1 aspect ratio, scales on hover)
  - "Explore →" overlay on hover
  - Engagement stats badge (👁 views, ↗ shares) if non-zero
  - **Avatar stack**: creator avatar + up to 4 community explorer avatars (overlapping, from `allVisitors`)
  - Query text + relative timestamp
  - Share/download button (↗)
- Clicking a card opens in **guided mode** (see §4.3.2)

---

### 4.2 Viewer Page

**Layout:** Vertical flex container. Top: fixed topbar. Body: horizontal flex — LevelStrip (left) + main canvas area (center, flex:1) + Knowledge Stack (right, slides in when cards exist).

#### 4.2.1 Topbar

- **Breadcrumb** (left): `⌂ › Root Topic › Layer Label › Current Layer`. Each segment is clickable to jump back. Active segment is non-clickable.
- **Export button** (right): see §4.5
- **Regenerate button** (right): re-runs the root topic from scratch, busting the cache. Shows confirm dialog. Disabled while generating.
- **Close button** (right, small): returns to Home, resets session.

#### 4.2.2 Level Strip (left sidebar)

- Hidden when only 1 layer exists
- Vertical list of thumbnail previews for all visited layers
- Current layer highlighted with a blue dot
- Layer name shown below each thumbnail (if label set via narration)
- Clicking any thumbnail jumps back to that layer (Inception model — later layers are preserved, not erased)
- Scrollable when many layers

#### 4.2.3 Main Canvas Area

The central column, scrollable vertically, max-width 680px centered.

**Error bar** (conditional): shows API/generation errors with a "Dismiss" button.

**Image Canvas** (see §4.3):
- Displays the current layer's illustration
- Clickable to drill down
- Shows hint spots during guided exploration
- Generating overlay during image generation

**Narration Panel** (overlaid at bottom of canvas, see §4.4):
- Streaming questions panel
- Visible during and briefly after generation

**Level info row** (below canvas):
- "Layer N of M" counter
- "← Go up a level" button when not on root layer

#### 4.2.4 Initial Load State

When the first image has not yet arrived (immediately after submitting a fresh topic):
- Show a cream-toned placeholder with a spinner: `"Drawing '[topic]'…"`
- Narration panel appears and streams topic questions immediately (the ~30-60s wait is filled with content)
- Navigate away is blocked until something renders

---

### 4.3 Image Canvas

#### 4.3.1 Standard Interaction

- Full-width image (max 680px), 1:1 aspect ratio
- `cursor: zoom-in` when idle
- Click anywhere → captures normalized `(x, y) ∈ [0,1]` → shows ripple animation → triggers drill-down
- Pulsing border animation during generation (indigo glow)
- Generating overlay (blur + spinner + "Generating…") during image generation
- Hover hint badge at bottom: context-sensitive text

#### 4.3.2 Guided Mode — Hint Spots

When viewing a gallery item, hint spots appear at every previously explored click position.

**Visual design per spot:**
- Outer ring: 52px diameter, indigo border, sonar-pulse animation (2.2s, ease-out, infinite)
- Inner ring: 28px diameter, same animation offset by 0.5s
- Center dot: 12px, solid indigo (#5c6bc0), white border, subtle shadow

**Hover tooltip:**
- Dark frosted glass pill (rgba(22,22,30,0.90) + backdrop-filter blur)
- Shows avatar images of all visitors who clicked this spot (max 5 shown, "+N" for overflow)
- Avatars: 24px circles, overlapping, from DiceBear pixel-art API
- Label: "N explorer(s) went here"
- Tooltip appears **below** the dot by default; **above** when the dot is in the lower 35% of the image (to avoid clipping)

**Click behavior:**
- Within 5% normalized radius of a hint spot → instant load cached child page (no API call, no spinner)
- Outside all hint radii → normal generation flow

**Canvas hint text when hints present:** "N paths explored — click a glow to follow, or explore anywhere"

---

### 4.4 Narration Panel

Overlaid at the bottom of the image canvas (position: absolute, bottom: 0) with frosted glass background. Always visible without scrolling.

**Two trigger modes:**

| Mode | Trigger | Header prefix | Icon |
|------|---------|---------------|------|
| Topic narration | First page generating | `"Exploring:"` | 🧭 |
| Zoom narration | Child page click | `"Zooming into:"` | 🔬 |

**Content format (streamed):**
```
Zooming into: Turbine Blades

• Why do they have to spin at 15,000 RPM?
• What material survives temperatures above its own melting point?
• What happens if a single blade detaches mid-flight?
```

**Rendering:**
- Header appears first with shimmer skeleton until text arrives
- Each bullet animates in individually (translateY + blur fade, 0.55s)
- Partial (still-typing) bullet has reduced opacity, no `?` badge
- Blinking cursor shows at the active position
- Progress bar shown while image is still generating

**Interactive questions (when narration panel is visible in Viewer):**
- Completed bullets are clickable (`cursor: pointer`)
- Hover: left border turns indigo, row shifts right 2px, `?` badge turns indigo
- Click → question added to Knowledge Stack (see §4.6)
- Already-asked questions show green left border + `✓` badge

**Lifecycle:**
- Clears 800ms after both image generation AND narration streaming complete
- Cleared immediately when user clicks to drill down again
- The label extracted from `"Zooming into: X"` is used to name the newly generated layer

---

### 4.5 Export

Available when 1+ layers exist. Topbar Export button.

**Single layer:** Direct button → downloads current page as PNG with watermark.

**Multi-layer (2+ layers):** Dropdown menu with three options:

| Option | Output | Description |
|--------|--------|-------------|
| 📷 Current page | PNG | Current layer only, 1024×1024 with watermark |
| 🖼 All layers | Tall PNG | All layers stitched vertically, labeled, cream background, watermark |
| 🎬 Journey video | MP4 (or WebM fallback) | Animated zoom journey through all layers |

**Video export details (client-side, MediaRecorder API):**
- 30 FPS, 8 Mbps bitrate
- Per layer: 1.8s static hold
- Between layers: 2.0s transition (phase 1: parent zooms 1→2.6× toward click point; phase 2: child grows from 0.4→1.0× at same focal point; crossfade from t=0.45)
- Easing: cubic ease-in-out
- Watermark: `🐇 Burrow` pill, bottom-right corner
- MIME preference: `video/mp4;codecs=avc1` → `video/mp4` → `video/webm;codecs=vp9` → `video/webm`

**Watermark:** All exports include a `🐇 Burrow` pill badge (semi-transparent white background, dark text) in the bottom-right corner.

---

### 4.6 Knowledge Stack (Flashcards)

Right panel, slides in (0→272px) when first card is added.

**Trigger:** User clicks a question in the Narration Panel.

**Card behavior:**
- Card appears immediately in the right panel, front face showing the question
- Answer streams via `/api/answer` in the background (~1-2s to first token)
- Card is independently flippable at any time

**Card visual design:**
- Perspective: 900px, flip axis: Y, transition: 0.52s cubic
- **Front face:** warm cream gradient (`#fdfaf5 → #f7f3ea`), "Q" badge top-right, question text vertically centered, "Click to see answer ↩" hint
- **Back face:** cool lavender gradient (`#f2f4ff → #eaedff`), "A" badge top-right, answer text, streaming cursor while loading
- Remove button (`✕`) appears on card hover, top-right corner outside flip surface

**Multiple cards:**
- New cards stack from top (most recent first)
- 22px gap between cards for visual breathing room
- Staggered entrance animation (0.06s delay per card)
- Each card streams independently and concurrently

**Narration panel state:** Already-asked questions get green highlight + `✓` to show they're in the stack. Clicking them again creates a new card (re-asking is allowed).

---

### 4.7 Regenerate

Topbar "↻ Regenerate" button (disabled during generation):
- Shows browser confirm dialog
- On confirm: busts server cache for the root page, re-runs the topic from scratch
- All previously generated child pages remain in the disk cache (only root is regenerated)

---

## 5. Technical Architecture

### 5.1 System Overview

```
Browser (React + Vite)
    │
    ├── /api/*          → Express server (Node.js, port 3001)
    │       ├── Image generation   → Wuyin API (async poll)
    │       ├── Narration/QA       → OpenAI GPT-4o-mini (SSE stream)
    │       └── Gallery            → gallery.json (flat file)
    │
    └── /cache/*.png    → Static file serving (Express)
```

In development: Vite dev server (port 5173) proxies `/api/*` and `/cache/*` to Express (port 3001).  
In production/ngrok: Express serves the built React app from `client/dist/` + handles all routes.

### 5.2 Server Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js |
| Web framework | Express |
| Image generation | Wuyin API (`api.wuyinkeji.com/api/async`) |
| Image editing | OpenAI `gpt-image-2` edit endpoint (via red-dot annotated input) |
| Language AI | OpenAI `gpt-4o-mini` (narration, Q&A, title extraction) |
| Image processing | `sharp` (red-dot compositing, format conversion) |
| Cache | Disk — `server/cache/*.png` (content-addressed) |
| Gallery store | `server/gallery.json` (append-only, max 100 entries) |
| Temp image hosting | tmpfiles.org (for passing annotated images to Wuyin) |

### 5.3 Client Stack

| Component | Technology |
|-----------|-----------|
| Framework | React 18 |
| Build tool | Vite |
| Routing | React Router v6 |
| State | Custom hooks (`useBurrow`, `useNarration`, `useFlashcards`) |
| Streaming | `fetch` + `ReadableStream` (SSE, NOT EventSource — avoids Vite proxy buffering) |
| Video export | Canvas API + `MediaRecorder` |
| Persistence | `localStorage` (session, personal history, visitor ID) |
| Avatars | DiceBear pixel-art (`api.dicebear.com/7.x/pixel-art/svg?seed=...`) |

### 5.4 File Structure

```
Burrow/
├── server/
│   ├── index.js         API routes + Wuyin polling + title extraction
│   ├── prompts.js       All LLM prompt templates (single source of truth)
│   ├── imageUtils.js    Red-dot SVG compositing via sharp
│   ├── cache.js         Content-addressed disk cache (read/write/remove)
│   ├── gallery.js       Gallery CRUD + tree merge logic
│   ├── gallery.json     Community gallery store (persistent)
│   └── cache/           Generated PNG files (gitignored)
│
└── client/src/
    ├── App.jsx           Router + handleStartTopic (guided vs restore vs fresh)
    ├── pages/
    │   ├── Home.jsx      Input + suggestions + sidebar + gallery
    │   └── Viewer.jsx    Main exploration view (orchestrates all sub-components)
    ├── components/
    │   ├── ImageCanvas   Clickable image + hint spots + generating overlay
    │   ├── NarrationPanel Streaming questions + clickable bullets
    │   ├── FlashcardStack 3D-flip knowledge cards in right panel
    │   ├── LevelStrip    Left sidebar thumbnails + layer names
    │   ├── Breadcrumb    Top navigation path
    │   ├── ExportButton  PNG / all-layers / video export dropdown
    │   ├── GalleryGrid   Community exploration cards with avatar stacks
    │   └── UserHistorySidebar Personal exploration history (localStorage)
    ├── hooks/
    │   ├── useBurrow     Core state machine (pages, generating, knownChildren)
    │   ├── useNarration  SSE streaming hook for narration text
    │   └── useFlashcards Multi-card concurrent streaming + flip state
    └── utils/
        ├── videoExport   Canvas + MediaRecorder export functions
        ├── userHistory   localStorage personal history CRUD
        └── visitorId     Persistent anonymous visitor ID (crypto random)
```

---

## 6. Data Models

### 6.1 Page Object (client-side)

```typescript
interface Page {
  id:       string;          // 32-char hex (sha256, content-addressed)
  imageUrl: string;          // "/cache/<id>.png"
  query:    string;          // root topic query
  parentId?: string;         // id of parent page (undefined for root)
  click?:   { x: number; y: number }; // normalized [0,1] click that generated this page
  label?:   string;          // extracted from narration "Zooming into: X"
}
```

### 6.2 Gallery Entry (server — gallery.json)

```typescript
interface GalleryEntry {
  id:           string;       // same as root page id
  query:        string;
  thumbnailUrl: string;       // "/cache/<id>.png"
  timestamp:    number;       // Unix ms
  avatarSeed:   string;       // base64 of query (for DiceBear creator avatar)
  clicks:       number;       // community click count
  shares:       number;       // community share count
  pages:        LegacyPage[]; // legacy linear path (backward compat)
  tree:         ExplorationTree;
}

interface ExplorationTree {
  [nodeId: string]: TreeNode;
}

interface TreeNode {
  id:       string;
  imageUrl: string;
  click:    { x: number; y: number } | null; // null for root
  label?:   string;           // "Zooming into: X" from narration (persisted)
  visitors: Visitor[];        // who drilled TO this node
  childIds: string[];         // IDs of child nodes
}

interface Visitor {
  seed:      string;          // anonymous visitor ID (localStorage)
  timestamp: number;
}
```

### 6.3 Known Children Map (client-side, guided mode)

```typescript
// Keyed by parent page id, value is all children from gallery tree
type KnownChildren = {
  [parentId: string]: HintSpot[];
}

interface HintSpot {
  x:        number;
  y:        number;
  id:       string;
  imageUrl: string;
  label?:   string;
  visitors: Visitor[];
}
```

### 6.4 Flashcard (client-side)

```typescript
interface Flashcard {
  id:        number;   // Date.now() at creation
  question:  string;
  answer:    string;   // streams in progressively
  streaming: boolean;
  flipped:   boolean;
}
```

### 6.5 Cache ID Derivation

```
First page:  sha256( normalize(query) + "__v" + STYLE_VERSION )[:32]
Child page:  sha256( parentId + ":" + x.toFixed(2) + ":" + y.toFixed(2) + "__v" + STYLE_VERSION )[:32]
```

IDs are **deterministic** — the same query or click position always produces the same ID, enabling cache deduplication across users.

---

## 7. API Reference

### Image Generation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/page` | Generate or return cached page |

**Request:**
```json
{ "query": "Smartphone internals" }                          // first page
{ "parentId": "<id>", "click": { "x": 0.43, "y": 0.61 } }  // child page
{ "query": "...", "regenerate": true }                       // force regenerate
```

**Response:**
```json
{ "id": "<32-char-hex>", "imageUrl": "/cache/<id>.png", "label": "SoC Chip" }
```

**Server logic:**
1. Compute deterministic ID
2. If cached → return immediately (no model call)
3. First page: `Wuyin submitTask` with `firstPagePrompt(query)`, poll until done
4. Child page: read parent PNG → `annotateWithRedDot` → upload to tmpfiles.org → `Wuyin submitTask` with `childPagePrompt()` + parent URL
5. Write PNG to disk cache
6. Extract label with GPT-4o-mini vision (parallel, doesn't block response)
7. On first page: `addGalleryEntry`

### Streaming (SSE)

All SSE endpoints use `text/event-stream`, each event is:  
`data: {"token":"..."}\n\n` until `data: [DONE]\n\n`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/narrate` | Zoom narration (vision, uses red-dot annotated parent) |
| `GET` | `/api/narrate-topic` | Topic narration (text-only, for first-page wait) |
| `GET` | `/api/answer` | Q&A answer for flashcard (text-only, 2-3 sentences) |

**`/api/narrate` params:** `parentId`, `x`, `y`, `topic?`, `label?`  
**`/api/narrate-topic` params:** `query`  
**`/api/answer` params:** `question`, `context?`

### Gallery

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/gallery` | Top 20 entries by engagement, with `allVisitors` |
| `POST` | `/api/gallery/:id/click` | Increment click count |
| `POST` | `/api/gallery/:id/share` | Increment share count |
| `POST` | `/api/gallery/:id/drill` | Merge a drill-down into the exploration tree |
| `PATCH` | `/api/gallery/:id/pages` | Legacy: overwrite linear pages array |
| `PATCH` | `/api/gallery/:rootId/node/:nodeId/label` | Persist a layer label into the tree node |

**`POST /api/gallery/:id/drill` body:**
```json
{
  "parentId": "<id>",
  "child": { "id": "<id>", "imageUrl": "/cache/<id>.png", "click": { "x": 0.4, "y": 0.6 } },
  "visitorSeed": "<24-char-hex>"
}
```

### Static Files

| Path | Description |
|------|-------------|
| `/cache/:id.png` | Cached generated image (served by Express static) |
| `/api/health` | Health check: `{ "ok": true }` |

---

## 8. Key Algorithms

### 8.1 Red-Dot Technique (Child Page Generation)

The model never receives raw coordinates. Instead:

1. Load parent PNG from disk cache
2. Composite an SVG overlay using `sharp`:
   - Outer ring: `r = 4% of image width`, `fill: rgba(220,0,0,0.30)`, `stroke: red`
   - Inner dot: `r = 38% of outer`, `fill: red`
   - Position: `cx = x × W`, `cy = y × H`
3. Upload annotated PNG to tmpfiles.org (public URL needed for Wuyin)
4. Send to Wuyin with `childPagePrompt()`: *"The red circle marks where the reader pointed. Generate the next explainer by drilling into that element. Do NOT include the red circle in the output."*

**Advantage:** The model literally sees what the user pointed at — no coordinate parsing, no prompt injection risk, accurate even on complex dense illustrations.

### 8.2 Streaming SSE (Client)

Uses `fetch` + `ReadableStream` (not `EventSource`) to avoid Vite proxy buffering issues.

```js
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
    if (raw === '[DONE]') return;
    const { token } = JSON.parse(raw);
    if (token) onToken(token);
  }
}
```

### 8.3 Parallel Narration + Image Generation

Both start simultaneously on user click:

```
User clicks  →  startNarration(parentId, x, y)   ← ~2s, SSE stream
             →  drillDown(x, y)                    ← ~30-60s, REST API
```

By the time the image arrives, the user has already read the narration questions. The narration panel stays visible until 800ms after both streams finish.

### 8.4 Gallery Tree Merge

When a user drills down, `POST /api/gallery/:id/drill` is called with the child info. Server logic in `addOrMergeDrill`:

```
If tree doesn't exist → initialize from legacy pages[] (lazy migration)
Find parent node in tree
If child already exists → add visitorSeed to visitors[] (if not already there)
If child is new → create TreeNode, append to parent.childIds
```

This allows multiple users to explore the same root image via different paths, with all paths preserved in the tree.

### 8.5 Guided Mode / Instant Load

When opening a gallery item:
1. `_loadGuidedSession(galleryItem, query)` builds `knownChildren` map from the tree
2. For each `parentId → [children]`, hint spots are rendered on the image
3. On click: check if `Math.hypot(hint.x - x, hint.y - y) < 0.05` for any hint
4. If yes: push cached child page to `pages[]` immediately, no API call, no spinner
5. If no: normal `drillDown` API flow

---

## 9. Illustration Style Guide

All generated images share the `STYLE` constant:

> *"Clean educational illustration. Watercolor wash, pale muted palette. Even dark-gray ink outlines, consistent thin line weight. White or cream paper tone. Clear bold section labels in clean sans-serif. Rich annotations and callout lines. Every major component must have a distinct labeled region."*

**For history topics:** ground explanations in geography wherever possible — maps, trade routes, territorial boundaries, migration paths, terrain that shaped events.

**Child pages:** must match parent's line weight, paper tone, palette, and title typography exactly.

---

## 10. Prompt Design

All prompts live in `server/prompts.js` — single source of truth to prevent style drift across drill levels.

| Prompt | Model | Purpose |
|--------|-------|---------|
| `firstPagePrompt(query)` | Wuyin/gpt-image-2 | Generate root illustration |
| `childPagePrompt()` | Wuyin/gpt-image-2 | Generate child from red-dot annotated parent |
| `questionsPrompt()` | gpt-4o-mini (vision) | Generate 3 questions from annotated image |
| `questionsPromptText(x,y,topic,label)` | gpt-4o-mini (text) | Same, without vision (fallback) |
| `topicNarrationPrompt(query)` | gpt-4o-mini | Topic anticipation questions during first-page wait |
| `/api/answer` system prompt | gpt-4o-mini | 2-3 sentence answer to a clicked question |
| Title extraction (inline) | gpt-4o-mini (vision) | Extract visible title text from generated illustration |

---

## 11. Non-Functional Requirements

### Performance

- **Cache hit latency:** < 100ms (pure disk read + HTTP response)
- **Narration first token:** < 2s (gpt-4o-mini streaming)
- **Image generation:** 30-60s (Wuyin API, async poll every 3s)
- **Video export:** Realtime (30 FPS canvas rendering, no server)
- **Instant hint load:** < 50ms (in-memory state push)

### Caching

- **Image cache:** Content-addressed disk files, never expire
- **Cache invalidation:** Only via explicit `regenerate: true` flag (admin use)
- **Style versioning:** `STYLE_VERSION` env var — incrementing it invalidates all IDs globally
- **Client session:** `localStorage` — persists across refreshes within same browser

### Reliability

- Narration failures are non-fatal — image generation continues unaffected
- Gallery PATCH/drill calls are fire-and-forget — failures don't block the user
- Wuyin polling timeout: 3 minutes before error
- All SSE streams include `[DONE]` sentinel + graceful abort on component unmount

### Sharing / Deployment

**Development:** `npm run dev` (Vite, port 5173) + `npm run dev:server` (Express, port 3001)

**ngrok sharing:** `ngrok http 5173` (Vite, hot-reload) OR rebuild first with `npm run build` then `ngrok http 3001` (Express serves `client/dist/`)

**Production:** Express serves built React app (`client/dist/`) via `express.static` + SPA fallback. Environment variables: `OPENAI_API_KEY`, `WUYIN_API_KEY`, `PORT`, `STYLE_VERSION`.

---

## 12. Known Limitations & Future Work

| Area | Current State | Potential Improvement |
|------|--------------|----------------------|
| Gallery persistence | Flat JSON file, max 100 entries | PostgreSQL / SQLite with proper indexing |
| Image hosting | tmpfiles.org for Wuyin input | S3 / permanent CDN |
| User identity | Anonymous localStorage visitor ID | Optional account system (OAuth) |
| Tree visualization | Hint spots on Layer 1 only | Full tree browser / breadcrumb tree view |
| Concurrency | Single-user JS server | Worker threads / Redis queue for parallel generation |
| Mobile | Desktop-first layout | Responsive redesign for mobile |
| Gallery moderation | None | Admin flagging + content filtering |
| Offline | None | Service worker for cached layers |
| Accessibility | Partial (keyboard nav on flashcards) | Full WCAG 2.1 AA compliance |

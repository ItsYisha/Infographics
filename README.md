# Burrow — Visual Knowledge Explorer

Type any topic. Get an illustrated watercolor-style infographic. Click anywhere on it to zoom into that exact spot and generate a deeper explainer — infinitely.

## Setup

### 1. Add your OpenAI API key

```bash
# Edit server/.env
OPENAI_API_KEY=sk-...
PORT=3001
STYLE_VERSION=1
```

### 2. Start

```bash
npm run dev
```

Opens:
- **http://localhost:5173** — the app
- **http://localhost:3001** — the API server

---

## Share with colleagues

**Quick (ngrok):**
```bash
npm run dev:server
npx ngrok http 5173
# Share the https://xxxx.ngrok.io URL
```

---

## Features

| Feature | Detail |
|---|---|
| 🎨 GPT Image 2 | Watercolor-style illustrated infographics |
| 🔴 Red-dot technique | Click position shown as a red marker on the parent image — the model sees exactly where you pointed |
| 🔍 Streaming narration | GPT-4o streams a documentary-style narration *while* the new image generates |
| 🏠 Gallery homepage | Past explorations with DiceBear avatars + prompts |
| ⚡ Content-addressed cache | Same query → instant cache hit, zero API calls |
| 🎬 Video export | Exports your drill-down journey as a WebM with Ken Burns transitions |
| 🌀 Inception navigation | Jump back to any level via the sidebar strip or breadcrumb |
| 💾 Session persistence | Your session survives page refresh via localStorage |

## Architecture

```
server/
  index.js       POST /api/page, GET /api/narrate, GET /api/gallery
  prompts.js     All prompt templates (single source of truth for style)
  imageUtils.js  sharp-based red-dot compositing
  cache.js       Deterministic sha256 disk cache
  gallery.js     gallery.json persistence

client/src/
  hooks/
    useBurrow.js    State machine (pages[], currentIndex, drillDown, goToLevel)
    useNarration.js   SSE streaming hook
  utils/
    videoExport.js    Canvas + MediaRecorder WebM export
  components/
    ImageCanvas       Clickable image with ripple + generating overlay
    LevelStrip        Left sidebar thumbnails (Inception model)
    NarrationPanel    Streaming text below image (non-disruptive)
    Breadcrumb        Path navigation
    GalleryGrid       Homepage mosaic of past explorations
    ExportButton      Video export trigger
  pages/
    Home.jsx          Hero search + gallery
    Viewer.jsx        Main drill-down experience
```

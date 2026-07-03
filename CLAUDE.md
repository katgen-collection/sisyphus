# Sisyphus

A privacy-first, local-only PWA of browser file tools. **Zero-Knowledge: no file ever
touches a server** — everything is processed client-side. Every feature must honor this;
if a change would require uploading user files anywhere, stop and reconsider.

Currently three tools: **markdown**, **pdf**, **video**.

## Top principle: modularity

This is the convention that holds across the whole codebase. Everything else bends to it.

- Each feature is a **self-contained module** under `src/modules/<name>/` that owns *all*
  of its code: `components/`, `hooks/`, `types.ts`, a barrel `index.ts`, and — only if it
  needs them — `workers/` and a `workerClient.ts`.
- `src/app/*` route pages **only compose** modules (`PageHeader` + `<ModuleTool />`). They
  contain no processing logic. A route's `layout.tsx` carries only `Metadata`; the
  `page.tsx` is the client component.
- Don't reach across modules. If two modules need the same thing, it belongs in `_shared`.

```
src/
├─ app/                  route shells only — compose modules, hold metadata
├─ components/           app-wide UI (Sidebar, BottomNav, PageHeader, ToolCard...)
└─ modules/
   ├─ _shared/           opt-in toolkit reused by modules
   ├─ markdown/
   ├─ pdf/
   └─ video/
```

## `_shared`: an opt-in toolkit, not a mandate

`_shared` offers common pieces; each module pulls in **only what it needs**.

- `Button`, `FileUploader`, `ProgressRing`
- `download/` — `downloadBlob` / `downloadArrayBuffer` / `downloadUint8Array`.
  Use these for all client-side saves. `downloadUint8Array` deliberately copies into a
  fresh `ArrayBuffer` to avoid `SharedArrayBuffer`+`Blob` breakage (see headers below).
- `useProcessingState` — the `idle → loading → processing → done → error` (+ `progress`)
  state machine, for modules that do async processing.

Not every module uses all of it. Example: **markdown only uses `Button`** — it manages its
own export state and doesn't touch `useProcessingState`, `FileUploader`, or the download
helpers. That's fine and expected.

## Per-module patterns (NOT universal laws)

These are tools individual modules reach for. Don't assume a new module needs them.

- **Web Worker + Comlink** — used by **pdf and video only**, because their work is
  CPU-heavy (`pdf-lib`, `ffmpeg.wasm`). Pattern: UI → module's `workerClient.ts` singleton
  (`getXWorker()` lazily creates one Comlink-wrapped worker; `terminateXWorker()` on
  unmount) → worker. Components convert `File → Uint8Array` on the main thread, pass raw
  bytes + plain options in, get `{ data, filename, mimeType }` back. Progress/logs come
  back via `Comlink.proxy()`-wrapped callbacks.
- **Markdown deliberately uses no worker** — its PDF export is a hidden-`<iframe>` browser
  print in a plain hook. Proof that "heavy work goes in a worker" is a per-module choice,
  not a rule. Pick the simplest strategy that fits the module.
- **COOP/COEP headers** (`Cross-Origin-Opener-Policy: same-origin`,
  `Cross-Origin-Embedder-Policy: require-corp`) are set globally in `next.config.ts`, but
  they exist **only to serve the video module's** `SharedArrayBuffer` (multi-threaded
  ffmpeg.wasm). They're global in placement, module-motivated in intent. If you touch them,
  understand you're touching video's threading.

## Stack & build

- **Next.js 16** (App Router) · **React 19** · **TypeScript** (strict) · **Tailwind v4**
  (CSS-based `@theme` in `globals.css`, no config file) · **Bun**.
- **React Compiler is on** — write components without manual `useMemo` / `useCallback`.
- Dev runs on `--webpack` (`bun run dev`); prod build uses Turbopack.
- **PWA** via `@ducanh2912/next-pwa` (disabled in dev; offline fallback to `/`).
- WASM cores are self-hosted in `public/` (ffmpeg), with a CDN fallback cached via the
  Cache API.
- Imports use the `@/*` alias and module barrels (`@/modules/_shared`, `@/components`) —
  not deep relative paths.

## UI conventions

- **Mobile-first**: desktop `Sidebar` + mobile `BottomNav`; touch targets, safe-area padding.
- **CSS-variable-driven layout**: sidebar state lives on `<html data-sidebar>` + localStorage
  and drives `--page-max-width` in `globals.css`. Don't prop-drill layout state through pages.
- **Icons**: `lucide-react` only (inline SVGs were migrated away).
- **Stone palette** + Sisyphus/boulder theming (spinning logo, "Rolling the boulder…",
  Camus quotes).
- **Tailwind v4 idioms**: `bg-linear-to-br` (not `bg-gradient-to-br`), `z-100` (not `z-[100]`).

## Known drift / gotchas

- `agent/SISYPHUS_PHASE_1.md` predates the markdown module and much of the pdf tooling —
  treat it as history, not current spec.
- Unimplemented specs in `documents/`: md→docx and Marp slide-decks (neither package is
  installed).

## Adding a new module

1. `src/modules/<name>/` with `index.ts` barrel, `components/`, and whatever else it needs.
2. Add worker + `workerClient.ts` **only if** the work is heavy enough to block the UI.
3. Pull from `_shared` for uploads/downloads/state — only the parts you use.
4. Add the route under `src/app/<name>/` (`page.tsx` composes the module; `layout.tsx` holds
   metadata) and wire it into `Sidebar`, `BottomNav`, and **`sitemap.ts`**.

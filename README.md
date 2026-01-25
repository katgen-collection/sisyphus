# Sisyphus

Privacy-first file tools that run locally in your browser.

Sisyphus exists because sometimes I feel like Sisyphus: uploading the same files to random PDF/video sites again and again and again… and then having the sudden realization that maybe uploading `SUPER_IMPORTANT_FILE.pdf` to an ad-filled mystery domain was not my finest moment.

So this project is my attempt to push the boulder uphill in the right direction: useful everyday tools (and dev-friendly utilities later) with a strong bias toward local processing and sane UX.

## What it does (today)

- **PDF tools (basic set)**
  - Compress / optimize PDFs  
  - PDF to images  
  - Images to PDF  

- **Video tools (basic set)**
  - Convert / compress / resize (FFmpeg via Web Worker)

## What it aims to be (tomorrow)

An all-in-one “I just need this done” toolbox for regular users *and* developers who know the pain:

- More genuinely useful file tools for everyday and technical workflows  
- Developer-friendly utilities where it makes sense (without turning into a CLI in disguise)  
- Offline-first polish: better caching, smoother cold starts, fewer surprises  
- Quality-of-life improvements: presets, batch operations, drag & drop, sensible defaults 
- Simple WebGPU implementation for AI or graphical workloads 
- A UX that helps instead of getting in the way  

The goal isn’t to replace professional tools — just to remove friction from the boring, repetitive stuff.

## Why local-first?

Because uploading files shouldn’t be the default.

Local-first means:
- Your files never leave your device
- Processing happens in your browser (WASM + Web Workers + WebGPU)
- No accounts, no tracking, no “please wait while we upload your data”

It’s faster, safer, and easier to trust — especially for files you *really* don’t want floating around the internet.

## Privacy stance

The goal is simple:

- Your files stay on your device  
- You don’t upload documents to third-party converters  
- You don’t trade privacy for convenience  

All processing is intended to happen locally in your browser using WebAssembly, WebGPU and Web Workers.

That said: always verify against your own threat model.  
If a tool ever requires a network request (for example, loading a worker or library), it should be visible, intentional, and easy to reason about.

## Tech

- Next.js (App Router)  
- TypeScript  
- Tailwind CSS  
- Web Workers for heavy lifting (FFmpeg WASM, etc.)

## Deployment

Sisyphus is (or will be) publicly available at:

https://sisyphus.mikhailjbs.my.id

The hosted version exposes the full feature set and is intended for everyday use by anyone who wants quick, local-first file tools.

That said, you are absolutely encouraged to run and customize your own build of Sisyphus:
- Self-host it
- Fork it
- Strip it down or extend it for your own workflow

It’s a Next.js app, deploy it however you like (Vercel works well).

If you deploy it publicly, keep in mind that “runs locally” is a UX promise worth preserving.

## Contributing

PRs and issues are welcome.

If you’re adding a new tool: please aim for local-first processing, good error states, and a UX that doesn’t feel like punishment.

## Getting Started

Install dependencies and run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open http://localhost:3000 with your browser to see the result.

You can start editing the UI by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.
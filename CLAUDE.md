# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The React PWA **client** for the mac_controller server (sibling repo `../server`). It pairs with a Mac via QR code and remotely controls it over the LAN. Deployed on Netlify at `https://mac-remote.gaurangnandaniya.com`.

Deeper detail (module map, auth flow, gotchas) lives in **`CODEBASE_MAP.md`** — this file is the quick-start.

## Commands

```bash
npm install
npm run dev              # vite --host — serves on the LAN so you can open it on the phone
npm run build            # vite build → dist/
npm run lint             # eslint .
npm run preview          # serve the built dist/
npm run deploy:netlify   # vite build + netlify deploy --prod (needs NETLIFY_SITE/NETLIFY_AUTH in .env)
```

**No test runner exists.** Verify UI changes **visually in the browser at phone width** — compile/lint success is not enough for visual work.

## Required environment (`.env`, git-ignored)

`NETLIFY_SITE`, `NETLIFY_AUTH` — only needed for `deploy:netlify`. The app itself needs no build-time env; the Mac's address (`serviceUrl`) and auth token come from the QR pairing flow and live in `localStorage`.

## Architecture (the big picture)

- **Entry → router → auth gate.** `main.jsx` sets up react-router; `App.jsx` is the auth gate — a valid (non-expired) JWT routes to `/remote`, otherwise `/connect`.
- **Pairing.** The Mac's QR opens `/connect?token=<tempJWT>&serviceUrl=https://<host>.local:8080`. `Connect.jsx` POSTs `/auth/connect` and stores a permanent JWT + `serviceUrl` in `localStorage`.
- **Remote screen.** `Remote.jsx` composes two hooks — `useMacApi` (all axios calls via `makeRequest`, Bearer token + `serviceUrl` from `localStorage`; includes the 60s battery poll) and `useAudioCapture` (mic record/stream) — and renders `Header` + `TabBar` + the four tab panels (Media/System/Input/Stream), plus `StreamViewer` for MJPEG.
- **It depends on the server's REST API** (`/media/*`, `/system/*`, `/alerts/*`). Endpoint names must stay in sync with `../server`.

## Conventions to follow

- **One API path:** every server call goes through `makeRequest` in `useMacApi` (Bearer token + `serviceUrl` from `localStorage`). Don't scatter `axios`/`fetch` across components.
- **Styling via tokens:** the cognac-on-graphite dark theme is CSS variables in `index.css` `:root`; components use semantic classes in `App.css`. No inline colors, no CSS framework.
- **Icons:** lucide-react, outlined, `strokeWidth={1.8}`. Verify a name exists at the installed version before importing it.
- **Tab panels unmount on switch** — keep long-lived side effects (mic capture, polling) in hooks at the `Remote` level, never inside a tab component.
- **eslint flat-config quirk:** a variable used only as a bare JSX element (`<Icon/>`) isn't always counted as used — reference icon props as an expression (`{Icon && <Icon/>}`), like the primitives do.
- For UI changes, pause and have the user verify in the browser before considering it done.

## Self-Update Protocol

Before finishing a session that uncovered something non-obvious about **this repo**, record it (don't make a future session re-learn it):

- **Project-specific** (build/deploy quirks, the server contract, iOS audio gotchas, fragile areas) → `CODEBASE_MAP.md` (*Troubleshooting / Gotchas* or *Last Updated*).
- **Cross-project / methodology** lessons → the global `~/.claude/CLAUDE.md` *Learned Rules*, not here.
- One home per fact. Entries: atomic, dated `[YYYY-MM-DD]`, specific & actionable, append-don't-overwrite. Keep both files lean (CLAUDE.md adherence drops past ~200 lines).

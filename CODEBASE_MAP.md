# Codebase Map — mac-control-web-app

## Project Overview
The phone/web client (PWA) for the **mac_controller** server (sibling repo `../server`). A React SPA that pairs with a Mac via QR code and remotely controls it over the LAN — media, system (lock/sleep/brightness/keyboard-mouse lock), remote keyboard typing, live screen/camera viewing, and sending mic audio to the Mac. Deployed on Netlify at `https://mac-remote.gaurangnandaniya.com`; it calls the Mac directly at the `serviceUrl` embedded in the QR (e.g. `https://<hostname>.local:8080`).

## Tech Stack
- **Framework:** React 18 + Vite (`@vitejs/plugin-react-swc`), plain CSS (no UI framework)
- **Routing:** react-router v7
- **HTTP:** axios
- **Icons:** lucide-react (outlined)
- **Auth:** JWT in `localStorage`; `jwt-decode` for expiry checks
- **Audio:** `audiobuffer-to-wav` (mic recording → WAV); Web Audio API (PCM mic streaming)
- **Deploy:** Netlify (`netlify.toml`, `deploy:netlify` script + `dotenv-cli`)

## Directory Structure
```
src/
  main.jsx                  # Router: "/" → App, with /connect and /remote child routes; registers SW (prod only)
  App.jsx                   # Auth gate — redirects to connect/remote based on token validity (always renders Outlet)
  context.js                # AppContext (carries temp token + serviceUrl during pairing)
  index.css                 # Design tokens (:root CSS variables) + base reset
  App.css                   # All component styles (token-based, no inline colors)
  utils/jwtUtils.js         # isTokenExpired()
  utils/haptic.js           # navigator.vibrate tap feedback (no-op on iOS)
  components/
    Connect/Connect.jsx           # Pairing screen → POST /auth/connect; deep-link button + Scan-QR path
    Connect/QrScanner.jsx         # camera + jsQR scanner → pairs a standalone PWA in its own storage
    Remote/
      Remote.jsx                  # Header + TabBar + active tab + StreamViewer; builds favorites catalog
      useMacApi.js                # makeRequest (axios+Bearer) + control helpers + battery poll (gated on online) + launchApp
      useAudioCapture.js          # mic record/stream lifecycle (Remote-level → survives tab switch)
      useConnectionStatus.js      # polls /connections/ping → status + latency (Remote-level)
      Header.jsx                  # device name, connection pill (status+latency), battery pill, disconnect
      TabBar.jsx                  # segmented tab control (7 tabs: Home/Media/System/Input/Apps/Stream/Mouse)
      favoritesCatalog.js         # catalog of pinnable one-tap actions (closures over media/system/watch)
      tabs/{Favorites,Media,System,Input,Apps,Stream,Mouse}Tab.jsx   # one panel per tab (presentational)
      ui/{IconButton,Tile,SectionLabel}.jsx     # shared primitives (Tile/IconButton fire haptic)
    StreamViewer/index.jsx        # MJPEG screen/camera modal; record/snapshot/fullscreen+rotate/pinch-zoom
      useStreamRecorder.js        # record MJPEG <img> via canvas.captureStream → MediaRecorder; snapshot PNG; save to Photos
      usePinchZoom.js             # native non-passive touch pinch-zoom/pan for the stream image
public/
  manifest.webmanifest      # PWA manifest (standalone, dark theme, 192/512 + maskable icons)
  sw.js                     # network-first service worker (same-origin shell only; ignores Mac API)
  {apple-touch-icon,icon-192,icon-512}.png   # PWA icons (from server/icon.jpg)
docs/superpowers/{specs,plans}/   # design spec + implementation plan for the redesign
```

## Key Modules & Relationships
- `main.jsx` router → `App.jsx` (auth redirect logic) → `Connect` or `Remote` via `<Outlet/>`.
- **`Remote`** composes `useMacApi()` + `useAudioCapture()` and renders `Header` / `TabBar` / the active tab. **Every server call goes through `makeRequest(endpoint, data, config)`** in `useMacApi`: `axios.post(serviceUrl + endpoint, data, { headers: { Authorization: 'Bearer ' + token } })`, with `serviceUrl` + `authToken` read from `localStorage` on each call.
- `StreamViewer` builds MJPEG URLs with `?token=` (query-param auth, because `<img>` can't send headers) and drops `img.src` on close to kill the socket.

## Auth / pairing flow
1. The Mac's QR opens `https://<deployed>/connect?token=<tempJWT>&serviceUrl=https://<host>.local:8080`.
2. `App.jsx` reads `token` + `serviceUrl` from the query into `AppContext`.
3. `Connect.jsx` POSTs `/auth/connect` (Bearer temp token) → receives a permanent 30-day JWT → stores `authToken` + `serviceUrl` in `localStorage` → navigates to `/remote`.
4. All Remote requests carry the permanent JWT. On expiry (`jwt-decode`), `App.jsx` redirects back to `/connect`.

## Patterns & Conventions
- **One API path:** all calls via `makeRequest` in `useMacApi` — don't scatter `axios`/`fetch`. Endpoint names must match the server (`../server`): `/media/*`, `/system/*`, `/alerts/*`, `/auth/connect`.
- **Styling:** CSS variables in `index.css` `:root` (cognac-on-graphite dark theme: `--bg`, `--surface`, `--accent`, radii); semantic classes in `App.css`. No inline colors, no CSS framework.
- **Icons:** lucide-react, outlined, `strokeWidth={1.8}`. Verify a name exists at the installed version before importing.
- **eslint quirk:** this flat config doesn't always credit a variable used *only* as a bare JSX element (`<Icon/>`) as "used" — reference icon props as an expression (`{Icon && <Icon/>}`), as the primitives do.
- **Tab lifecycle:** tab panels unmount on switch, so long-lived side effects (mic capture, polling) live in hooks at `Remote` level, never inside a tab component.

## Troubleshooting / Gotchas
- **No audio on iPhone:** the iPhone hardware **silent switch** mutes Web Audio, and Web Audio needs a **user gesture** (tap) to start. (System-audio *playback* is served by the Mac's own `:9090/:9092` pages, not this app.)
- **HTTPS → `ws://` blocked:** this app is served over HTTPS, so it **cannot** open the Mac's plain `ws://` system-audio socket (mixed content). That feature is Mac-local-only unless the audio server gets TLS.
- **Netlify SPA deep-link 404 on manual deploy:** `netlify.toml` has the `/* → /index.html` redirect, but a manual `netlify deploy` may not apply it — add `public/_redirects` (`/* /index.html 200`) if deep links 404.
- **Deploy env:** `deploy:netlify` reads `NETLIFY_SITE` + `NETLIFY_AUTH` via `dotenv-cli` from `.env`.

## Last Updated
2026-06-29 (batch 2) — Shipped backlog #1–#9 + #16 (see `../FEATURE_BACKLOG.md`):
- **Stream viewer:** snapshot (PNG→Photos), live REC timer, immersive expand + 90° rotate (iPhone has no Fullscreen/orientation API; native FS used elsewhere), pinch-zoom/pan (`usePinchZoom`, native non-passive listeners + `touch-action:none`).
- **Remote UI:** connection pill in Header (`useConnectionStatus` polls `/connections/ping`; gates battery poll); haptics in Tile/IconButton; **Apps** tab (Spotlight launcher via `launchApp`); **Home** favorites dashboard (default tab, pinnable from a 15-action catalog); clipboard **Paste from phone** in Input tab. Tab bar now 7 tabs (12px font).
- **PWA:** installable (manifest + apple meta + icons + network-first SW, prod-only registration). iOS standalone install must be from **Safari**; Safari PWAs have **isolated storage**.
- **In-app QR scanner** (`QrScanner.jsx`, jsQR dep) so a standalone PWA can pair in its own storage; fixed `App.jsx` which hard-rendered a "missing token" error that hid the Connect screen when launched without URL params.

2026-06-29 — Added **client-side stream recording** in `StreamViewer`: a Record button mirrors the live MJPEG `<img>` onto a hidden `<canvas>` (`requestAnimationFrame` → `ctx.drawImage`), records `canvas.captureStream(30)` with `MediaRecorder`, and saves via `navigator.share({ files })` (iOS share sheet → Save Video to Photos), falling back to `<a download>` on desktop. Codec is feature-detected (`video/mp4;codecs=h264` first for iOS WebKit). **Required `crossOrigin="anonymous"` on the stream `<img>`** so the cross-origin MJPEG doesn't taint the canvas — relies on the server's `flask_cors` reflecting `WEB_APP_URL` as `Access-Control-Allow-Origin`; if that header ever drops, the live view goes blank (not just recording). Verified on iPhone: live view intact + recording saves to Photos.

2026-06-10 — Added a **Mouse tab** (5th): a relative trackpad over a tab-scoped `wss://…/system/mouse_ws` via `useMouseSocket` (connect on mount, auto-reconnect, connection indicator). Touch-gesture state machine (drag=move, tap=left, 2-finger tap=right, 2-finger drag=scroll, double-tap-drag), moves flushed on `requestAnimationFrame` with a speed multiplier. Also added the **Input-tab on-screen keyboard** (collapsible full Mac keyboard, sticky modifiers + combos → `/system/pressKey`).

2026-06-08 — UI redesign ("Cognac Graphite"): premium dark theme + outlined icons (lucide-react), tabbed layout (Media/System/Input/Stream), CSS design tokens, `useMacApi` + `useAudioCapture` hooks, sticky header with 60s battery poll + manual sync, persistent mic-capture banner. Design spec + plan under `docs/superpowers/`.

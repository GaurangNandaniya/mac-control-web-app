# Web Client UI Redesign — "Cognac Graphite" — Design

Date: 2026-06-07
Repo: `mac-control-web-app` (React 18 + Vite, axios)

## Goal
Make the remote control web client look premium and feel good on a phone, without changing any behavior or the server. Replace the current inconsistent flat styling (mixed blue/green buttons, light-on-dark clashes, rows that can overflow on narrow screens) with a cohesive **premium dark theme + outlined icons**, organized into **tabs** so the long control list isn't one endless scroll.

## Non-goals / scope
- **Web client only.** No server (`mac_controller`) changes; all endpoints/payloads stay identical.
- **Restyle + refactor only — no behavior changes, no new functionality.** Every existing control keeps working exactly as before; this work adds nothing beyond the visual and structural rework.
- New dependency: **`lucide-react`** (outlined icon set).

## Visual theme — design tokens (CSS variables)
Define once (in `index.css` `:root`) and use everywhere:

```
--bg:            #0a0a0c;                     /* app background (near-black, cool) */
--surface:       rgba(255,255,255,0.04);      /* card / tile fill */
--surface-2:     rgba(255,255,255,0.06);      /* secondary / pressed */
--border:        rgba(255,255,255,0.08);
--border-strong: rgba(255,255,255,0.12);
--text:          #e9e9ee;                     /* primary */
--text-secondary:#6e6e78;                     /* labels */
--text-tertiary: #c7c7cf;                     /* icon idle */
--accent:        #b5774b;                     /* cognac — solid (primary actions) */
--accent-text:   #cf9b6e;                     /* cognac on dark (active icon/text) */
--accent-fill:   rgba(181,119,75,0.14);       /* active tile bg */
--accent-border: rgba(181,119,75,0.42);       /* active tile border */
--radius-card:   20px;
--radius-tile:   16px;
--radius-btn:    14px;
--gap:           10px;
```

- Font: system UI stack (already in use). Icons: `lucide-react`, stroke ~1.8, `currentColor`.
- Accent is used **only** for primary actions and active/live states; everything else is neutral graphite.

## Layout
**Sticky header** (top of the Remote screen):
- Device name (decode `device_name` from the JWT via existing `jwt-decode`; fallback "Mac").
- Live **battery pill** (driven by the existing 60s poll) in cognac.
- Small **Disconnect** action (replaces the bottom "Clean token" button → clears `authToken`/`serviceUrl`).

**Segmented tab bar** (4 tabs, content swaps via `activeTab` state — minimal scrolling):

| Tab | Controls (existing endpoints, unchanged) |
|---|---|
| **Media** | prev / play-pause / next (circular; play = cognac); mute / volume-down / volume-up; arrow D-pad (up/down/left/right) |
| **System** | lock · capture-and-lock · sleep; brightness-down/up; keyboard-lock/unlock; mouse-lock/unlock; keyboard-backlight slider (`keyboard-light-set/<n>`) |
| **Input** | Keyboard Type: text field + Send (`/system/keyboardType {text}`); Enter / Backspace / Tab buttons (`{key}`) |
| **Stream** | Watch Screen / Watch Camera (opens StreamViewer); Audio: record (`/alerts/upload/audio`) and live stream (`/alerts/stream/audio`) |

**Other surfaces restyled to match:** the **StreamViewer** modal and the **Connect** screen (device-name input + cognac "Connect" button) adopt the same tokens.

## Component structure (keeps files focused; pure refactor of existing logic)
```
src/
  index.css                 # :root design tokens + base
  components/Remote/
    Remote.jsx              # header + tab bar + renders active tab
    useMacApi.js            # makeRequest, command helpers, battery state + 60s poll (lifted out of Remote)
    Header.jsx              # device name, battery pill, disconnect
    TabBar.jsx              # segmented control
    tabs/MediaTab.jsx
    tabs/SystemTab.jsx
    tabs/InputTab.jsx
    tabs/StreamTab.jsx
    ui/IconButton.jsx       # circular icon button (idle / accent variants)
    ui/Tile.jsx             # rounded tile w/ icon + label (idle / active)
    ui/SectionLabel.jsx     # uppercase section label
  components/Connect/Connect.jsx   # restyled
  components/StreamViewer/index.jsx # restyled
  App.css                   # component classes using the tokens
```
- `useMacApi` owns: `makeRequest(endpoint, data, config)` (axios POST + Bearer, unchanged), the media/system/keyboardType/audio helpers, and `batteryLevel` + the 60s `setInterval` poll.
- Tab components are presentational — they receive handlers/state from `Remote` (or call the `useMacApi` hook directly).

## Behavior preserved (must not regress)
- Same auth (`Bearer` token from `localStorage`), same `serviceUrl` base, same endpoints/payloads.
- Battery auto-polls every 60s (now surfaced in the header).
- Keyboard Type (text + Enter/Backspace/Tab), audio record + live stream, screen/camera streams all work as today.
- Routing (`/connect`, `/remote`) and token-expiry redirects in `App.jsx` unchanged.

## Verification
- `npm run dev`, open on a phone-width viewport (it's a phone PWA).
- eslint clean.
- Each tab's controls hit the Mac correctly; battery pill updates; Disconnect clears token; StreamViewer + Connect look consistent.
- Visual check on the actual phone (per the "verify UI in the browser" rule) before calling it done.

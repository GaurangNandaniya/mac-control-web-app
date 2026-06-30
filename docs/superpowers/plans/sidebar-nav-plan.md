# Plan — Sidebar / hamburger navigation (Option F)

## Goal
Replace the 7-tab top TabBar with a slide-out **drawer** (☰). Header trims to: ☰ · device switcher · connection pill · battery · power. The active **section title** heads the main content. Sections are **reorderable + show/hide**, persisted in localStorage. **Files** becomes a full section page (not a header modal).

## Out of scope / unaffected
- **Connect / pairing screen is NOT touched.** Routing stays `App.jsx` → `/connect` (`Connect.jsx` + `QrScanner.jsx`) and `/remote` (`Remote.jsx`). All changes live inside the `/remote` shell. Auth gate, pairing exchange, multi-Mac store — unchanged.
- StreamViewer stays a fullscreen modal (launched from the **Stream** section).
- IntruderGallery stays a modal (launched from the **System** section).
- Mic capture banner still renders at Remote level (below the header).

## Section registry (single source of truth)
New `src/components/Remote/sections.js`:
```
[ {id:'favorites', label:'Home',   icon:Home,             fixed:true},   // can't hide/move off top? (see Q)
  {id:'media',     label:'Media',  icon:Play},
  {id:'system',    label:'System', icon:Settings2},
  {id:'input',     label:'Input',  icon:Keyboard},
  {id:'apps',      label:'Apps',   icon:LayoutGrid},
  {id:'stream',    label:'Stream', icon:MonitorSmartphone},
  {id:'mouse',     label:'Mouse',  icon:MousePointer2},
  {id:'files',     label:'Files',  icon:FolderOpen} ]
```
Remote maps `id → rendered panel` (keeps panel props wiring in Remote, like today).

## Nav config (persistence)
New `useNavConfig` hook + `localStorage["nav_config"] = { order:[ids…], hidden:[ids…] }`.
- Defaults: registry order, nothing hidden.
- Merge-on-load so newly-added sections (future) append automatically and unknown ids are dropped.
- Exposes `orderedVisibleSections`, `reorder(from,to)`, `toggleHidden(id)`.

## New / changed files
**New**
- `Drawer.jsx` — the slide-out nav (portaled, backdrop, section list, edit mode).
- `sections.js` — registry.
- `useNavConfig.js` — order/hidden persistence.
- `tabs/FilesSection.jsx` — Files as a page (extract the inner UI from today's `FileTransfer.jsx`).

**Changed**
- `Remote.jsx` — drop `<TabBar>`; add `drawerOpen` + `section` state (replaces `tab`); render `<Drawer>` + section title + active panel; keep StreamViewer/IntruderGallery/mic-banner.
- `Header.jsx` — add ☰ (left, before DeviceSwitcher); keep device switcher + pill + battery + power. Remove nothing else.
- `App.css` — drawer, section-title, edit-mode styles; remove/retire `.tab-bar*` once unused.
- `FileTransfer.jsx` — becomes a thin wrapper or is replaced by `FilesSection` (logic identical, no overlay shell).

**Untouched:** `Connect.jsx`, `QrScanner.jsx`, `App.jsx`, `useMacApi.js` (helpers already exist), `deviceStore.js`, `pairing.js`, all `*Tab.jsx` panels (they render the same, just hosted in a section instead of a tab), `StreamViewer/*`, `IntruderGallery.jsx`.

## Header layout (final)
`[☰] [DeviceSwitcher ⌄]   ……   [conn pill] [battery] [power]`
- Left group flex:1 min-width:0 (device name truncates).
- Right group flex-shrink:0.
- The section TITLE is NOT in the header — it's the first thing in the content area (`<h1 class="section-title">`).

## Drawer behavior
- Closed by default. ☰ toggles. Opens as a left drawer (~76% width, max 280) over a dimmed backdrop; tap backdrop or a section to close.
- Lists `orderedVisibleSections`; active one highlighted.
- Tapping a section → `setSection(id)` + close drawer.
- **Edit mode** (✎ in drawer header): each row shows a reorder control + a show/hide toggle. "Done" exits.
- Home is always visible and stays first (not hideable) so there's always a valid landing — **(Q1 below)**.

## OPEN DECISION
- **Q1 — Reorder mechanism:** touch drag-and-drop is fiddly without a library. Two options:
  - **(A) Up/Down arrows** in edit mode — bulletproof on touch, no dep. *(my recommendation for v1)*
  - **(B) Drag handles** via `@dnd-kit/core` — slicker, matches the mockup, adds a dependency.
- **Q2 — Can Home be hidden/moved?** I'd keep Home pinned-first & non-hideable (always-valid landing). OK?

## Screen-by-screen
- **Home** — `FavoritesTab` (unchanged): pinnable grid + edit. Title "Home".
- **Media** — `MediaTab` (unchanged): now-playing + transport + volume. Title "Media".
- **System** — `SystemTab` (unchanged): controls + "View Captures" → IntruderGallery modal. Title "System".
- **Input** — `InputTab` (unchanged): type + paste + on-screen keyboard. Title "Input".
- **Apps** — `AppsTab` (unchanged). Title "Apps".
- **Stream** — `StreamTab` (unchanged): watch screen/camera → StreamViewer modal; mic. Title "Stream".
- **Mouse** — `MouseTab` (unchanged). Title "Mouse".
- **Files** — `FilesSection` (extracted): send + list/download/delete. Title "Files".

## Dry-run — every action
1. Launch (paired) → `/remote`, section=Home, drawer closed. ✓ default landing.
2. Tap ☰ → drawer opens. Tap "Media" → content = Media, title "Media", drawer closes. ✓
3. Tap ☰ → ✎ → drag/arrows reorder Media above System → close → reopen → order persisted. ✓
4. ✎ → toggle "Mouse" off → it disappears from the list + can't be navigated to → persisted. If Mouse was the active section when hidden → fallback to Home. ✓
5. Tap device ⌄ → multi-Mac dropdown (switch/add/remove) — **same DeviceSwitcher as today**, just sits next to ☰. ✓
6. Tap connection pill → manual re-ping (checking → online/offline). ✓
7. Tap battery sync → battery refresh. ✓
8. Tap power → disconnect: remove active Mac; fall back to another or → `/connect`. ✓
9. Home → ✎ (favorites) → pin/unpin (existing). ✓
10. Stream → Watch Screen → StreamViewer modal over everything (record/snapshot/zoom/pointer) → close returns to Stream. ✓
11. System → Capture & Lock; View Captures → IntruderGallery modal → delete/full-view → close. ✓
12. Files → Send a file → upload progress → appears in list; download; delete. (Now a page, drawer still reachable via ☰.) ✓
13. Start mic recording (Stream) → capture banner shows under header across sections (Remote-level). ✓
14. Offline → pill red; tap retries. Reconnect → battery auto-refreshes (existing gating). ✓
15. Long device name → truncates; ☰ + status never overlap. ✓
16. Token expires → App.jsx redirects to `/connect` (unchanged). ✓

## Build order
1. `sections.js` + `useNavConfig.js`.
2. `Drawer.jsx` + CSS (navigate only; no edit yet).
3. Rewire `Remote.jsx` (section state, render title + panel, drop TabBar) + `Header.jsx` (☰).
4. `FilesSection.jsx` (extract from FileTransfer) + add to registry; remove header Files paths already done.
5. Edit mode (reorder + show/hide) per Q1.
6. Build + lint; verify on phone; commit per repo.

## Verification
Manual on iPhone 13 Pro at each step above; `npm run build`/`lint` between stages. Connect flow spot-checked to confirm it still pairs.

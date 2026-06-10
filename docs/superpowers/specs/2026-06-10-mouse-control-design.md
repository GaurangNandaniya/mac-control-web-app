# Mouse Control (Trackpad) — Design

Date: 2026-06-10
Repos: **mac_controller** (server: WebSocket + pynput mouse) + **mac-control-web-app** (client: Mouse tab). ToDo #6.

## Goal
Control the Mac cursor from the phone like a laptop trackpad: move (relative), left/right click, scroll, and click-and-drag — smoothly, over a low-latency connection.

## Scope / non-goals
- New **WebSocket** endpoint `/system/mouse_ws` on the main server app + a new **Mouse tab** in the web client.
- The existing **mouse lock/unlock** (System tab) is unchanged.
- No new dependencies (`flask-sock` and `pynput` are already present).
- Absolute/screen-mapped pointing is out — relative trackpad only.

## Transport & protocol
- **WebSocket over TLS** on the main app: `wss://<serviceUrl-host>/system/mouse_ws?token=<permanent JWT>`. Hosted on the main app (which already serves HTTPS) so there is no mixed-content problem and no separate process.
- **Auth:** validated in the handshake from the `?token=` query param (the `<img>` MJPEG streams use the same query-token pattern). Invalid/missing → close immediately.
- **Lifecycle: tab-scoped.** The client opens the socket when the Mouse tab mounts and closes it on unmount; auto-reconnects on unexpected drop.
- **Client → server JSON messages** (fire-and-forget, no replies):
  - `{ "t": "move", "dx": <int>, "dy": <int> }` — relative cursor move.
  - `{ "t": "click", "b": "left" | "right" }` — single click.
  - `{ "t": "scroll", "dx": <int>, "dy": <int> }` — scroll.
  - `{ "t": "down", "b": "left" }` / `{ "t": "up", "b": "left" }` — press/release (for click-and-drag).

## Server (`mac_controller`)
- New `src/controllers/mouse_controller.py` exporting `register_mouse_ws(sock)`, which defines the `@sock.route('/system/mouse_ws')` handler.
- In `src/server.py` `create_app()`: after blueprints, `sock = Sock(app)` then `register_mouse_ws(sock)`. (`from flask_sock import Sock`.)
- Handler:
  1. `token = request.args.get("token")`; `payload, err = auth_manager.validate_permanent_token(token)`; if `err`, `return` (closes the socket) — no unauthenticated control.
  2. Loop: `data = ws.receive()`; if `None`, break; `json.loads`; dispatch on `t`. Wrap each message in try/except so a bad message doesn't kill the socket.
- Mouse via pynput: `from pynput.mouse import Button, Controller as MouseController`; module-level `_mouse = MouseController()`.
  - `move` → `_mouse.move(int(dx), int(dy))` (relative).
  - `click` → `_mouse.click(Button.left if b!="right" else Button.right, 1)`.
  - `scroll` → `_mouse.scroll(int(dx), int(dy))`.
  - `down`/`up` → `_mouse.press(...)` / `_mouse.release(...)`.
- pynput mouse is reliable on macOS (Accessibility permission already granted; no keyboard-modifier-style issues).

## Client (`mac-control-web-app`)
**`useMouseSocket.js` (hook):**
- Reads `serviceUrl` + `authToken` from `localStorage`. URL = `serviceUrl.replace(/^http/, "ws") + "/system/mouse_ws?token=" + token`.
- State `status`: `"connecting" | "open" | "closed"`. On mount: open WS, `onopen`→open, `onclose`→closed + schedule reconnect (≈1s) unless unmounting, `onerror`→close.
- Returns `{ status, send }` where `send(obj)` JSON-stringifies and writes only when the socket is open (drops otherwise).
- Cleanup on unmount: set an `intentional-close` flag, clear the reconnect timer, close the socket.

**`MouseTab.jsx`:**
- `const { status, send } = useMouseSocket();`
- **Connection indicator** (pill at top): `connecting…` (amber) / `Connected` (cognac dot) / `Disconnected — reconnecting…` (red). The trackpad is dimmed and inert (`pointer-events:none`, reduced opacity) unless `status === "open"`.
- **Trackpad surface** (`touch-action: none`, `preventDefault` on touch handlers so the page doesn't scroll/zoom). Uses **touch events** (multi-finger detection).
- **Pointer speed slider** (multiplier, ~1.0–3.0, default 1.8) applied to move deltas client-side.
- **Move throttling:** accumulate `dx/dy` across `touchmove`; a `requestAnimationFrame` loop (started on touchstart, cancelled on touchend) flushes the rounded accumulated delta as one `{t:"move"}` per frame (≤60/s) — never one message per `touchmove`.
- **Left / Right click buttons** below the surface → `{t:"click"}`.

**`Remote.jsx`:** add `{ id: "mouse", label: "Mouse" }` to `TABS` and render `<MouseTab />` when active. (Tab bar now has 5 items.)

## Gesture state machine (trackpad surface, touch events)
Track `startTouches`, `startTime`, `lastPos`, `moved`, and a `lastTapTime`/`lastTapPos` for double-tap.
- **1 finger down → move/drag:**
  - `touchmove`: `dx = (x - lastPos.x) * speed`, accumulate; mark `moved` once past a ~3px threshold; update `lastPos`.
  - `touchend`: if `!moved` and duration < ~250ms → **left click** (`{t:"click",b:"left"}`).
  - **Double-tap-drag:** if this `touchstart` is within ~300ms and ~20px of the last tap → enter drag: `{t:"down",b:"left"}` now, send moves during `touchmove`, `{t:"up",b:"left"}` on `touchend`.
- **2 fingers down → scroll/right-click:**
  - `touchmove`: accumulate the centroid delta → `{t:"scroll",dx,dy}` (rAF-flushed like moves). Mark `moved`.
  - `touchend` (both up) with `!moved` and short duration → **right click** (`{t:"click",b:"right"}`).
- Scroll sign may need flipping to match the Mac's natural-scroll setting — verify and pick the direction that feels right (constant in code).

## Risks / verification (build order)
1. **First build step: a `wss` smoke test** — confirm `flask-sock` serves a WebSocket on the *main* app over the Werkzeug dev server **with TLS**. (It works in principle — the audio server uses flask-sock, the main app already does TLS — but this dev-server+TLS+WS combo is exactly the kind of thing that's surprised us before. If it fails, fall back to a dedicated TLS WS process.) Test: connect from `wscat`/a tiny script to `wss://localhost:8080/system/mouse_ws?token=…` and confirm the handshake + that a `{t:"move"}` nudges the cursor.
2. Client: connect indicator shows the three states; trackpad inert until Connected.
3. On the phone: drag moves smoothly; tap = left; 2-finger tap = right; 2-finger drag = scroll; double-tap-drag selects; buttons + speed slider work.
4. `npm run lint` clean; visual check at phone width.

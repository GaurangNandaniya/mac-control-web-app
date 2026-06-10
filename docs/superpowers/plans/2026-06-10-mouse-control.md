# Mouse Control (Trackpad) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Control the Mac cursor from the phone like a trackpad (move/click/scroll/drag) over a tab-scoped WebSocket.

**Architecture:** A `flask-sock` WebSocket on the main server app (`wss://…/system/mouse_ws?token=`) drives pynput's mouse `Controller`. The web client adds a Mouse tab whose `useMouseSocket` hook opens the socket on mount; the trackpad uses touch events + a `requestAnimationFrame` flush to stream `{dx,dy}` deltas.

**Tech Stack:** Server — Flask, `flask-sock`, `pynput.mouse`. Client — React 18, native WebSocket + touch events.

**Repos:** Task 1 = **mac_controller** (`../mac_controller`). Tasks 2–4 = **mac-control-web-app** (this repo). Task 5 = both.

**Verification model:** No test runner. Server verifies by route registration + a `wss` smoke test. Client verifies with `npm run lint` + build + a phone trackpad check.

**Spec:** `docs/superpowers/specs/2026-06-10-mouse-control-design.md`

---

## File Structure
```
mac_controller/
  src/controllers/mouse_controller.py   # CREATE — flask-sock /system/mouse_ws handler (pynput mouse)
  src/server.py                          # MODIFY — Sock(app) + register_mouse_ws
  mac_controller_app.py                  # MODIFY — threaded=True so the WS doesn't block HTTP
mac-control-web-app/
  src/components/Remote/
    useMouseSocket.js                    # CREATE — open wss on mount, status + send()
    tabs/MouseTab.jsx                    # CREATE — trackpad gestures, indicator, buttons, speed
    Remote.jsx                           # MODIFY — 5th "Mouse" tab
  src/App.css                            # MODIFY — trackpad + connection-pill styles
```

---

## Task 1: Server WebSocket + smoke test (repo: mac_controller)

**Files:**
- Create: `mac_controller/src/controllers/mouse_controller.py`
- Modify: `mac_controller/src/server.py`
- Modify: `mac_controller/mac_controller_app.py`

- [ ] **Step 1: Create the WS handler**

```python
# mac_controller/src/controllers/mouse_controller.py
import json
from ..utils import setup_logger
from pynput.mouse import Button, Controller as MouseController
from flask import request
from src.utils.auth_manager import auth_manager

logger = setup_logger()
_mouse = MouseController()
_BUTTONS = {"left": Button.left, "right": Button.right}


def register_mouse_ws(sock):
    """Register the /system/mouse_ws WebSocket on a flask_sock Sock instance."""

    @sock.route("/system/mouse_ws")
    def mouse_ws(ws):
        # Auth via ?token= (a browser WebSocket can't set an Authorization header).
        token = request.args.get("token", "")
        _, err = auth_manager.validate_permanent_token(token)
        if err:
            logger.info(f"mouse_ws rejected: {err}")
            return  # closes the socket

        logger.info("mouse_ws connected")
        while True:
            raw = ws.receive()
            if raw is None:
                break
            try:
                msg = json.loads(raw)
                t = msg.get("t")
                if t == "move":
                    _mouse.move(int(msg.get("dx", 0)), int(msg.get("dy", 0)))
                elif t == "click":
                    _mouse.click(_BUTTONS.get(msg.get("b"), Button.left), 1)
                elif t == "scroll":
                    _mouse.scroll(int(msg.get("dx", 0)), int(msg.get("dy", 0)))
                elif t == "down":
                    _mouse.press(_BUTTONS.get(msg.get("b"), Button.left))
                elif t == "up":
                    _mouse.release(_BUTTONS.get(msg.get("b"), Button.left))
            except Exception as e:
                logger.error(f"mouse_ws message error: {e}")
        logger.info("mouse_ws disconnected")
```

- [ ] **Step 2: Wire it into `create_app`** — in `mac_controller/src/server.py`, add the imports near the top:

```python
from flask_sock import Sock
from src.controllers.mouse_controller import register_mouse_ws
```

and just before `return app` in `create_app()`:

```python
    sock = Sock(app)
    register_mouse_ws(sock)

    return app
```

- [ ] **Step 3: Make the dev server multi-threaded** so the blocking WS loop doesn't freeze HTTP. In `mac_controller/mac_controller_app.py`, `run_flask_server()`, add `threaded=True` to `app.run(...)`:

```python
    app.run(
        host=app.config['SERVER_HOST'],
        port=app.config['SERVER_PORT'],
        debug=app.config['DEBUG_MODE'],
        use_reloader=False,  # Disable reloader to avoid subprocess issues.
        threaded=True,       # serve the mouse WebSocket alongside HTTP requests
        ssl_context=(os.getenv("CERTIFICATE_PATH"), os.getenv("PRIVATE_KEY_PATH"))
    )
```

- [ ] **Step 4: Verify route registration + syntax**

```bash
cd ../mac_controller
./venv/bin/python -c "import ast; ast.parse(open('src/controllers/mouse_controller.py').read()); ast.parse(open('src/server.py').read()); print('syntax OK')"
PYTHONPATH=. ./venv/bin/python -c "from src.server import create_app; print('mouse_ws route:', any('mouse_ws' in str(r) for r in create_app().url_map.iter_rules()))"
```
Expected: `syntax OK` and `mouse_ws route: True`.

- [ ] **Step 5: `wss` smoke test (THE flagged risk — do this before building the client)**

Restart the menu-bar app. Then (one-time `pip install websocket-client` into the venv if missing):
```bash
cd ../mac_controller
./venv/bin/pip install websocket-client -q
TOKEN=…   # a valid permanent JWT (from auth_data.json or a paired device)
./venv/bin/python - <<PY
import ssl, websocket
ws = websocket.create_connection(
    "wss://localhost:8080/system/mouse_ws?token=$TOKEN",
    sslopt={"cert_reqs": ssl.CERT_NONE})
ws.send('{"t":"move","dx":0,"dy":0}')   # dx/dy 0 = no cursor movement
print("wss handshake + message OK")
ws.close()
PY
```
Expected: `wss handshake + message OK` (no exception). This proves flask-sock works on the Werkzeug dev server over TLS. **If it fails**, stop and report — fallback is a dedicated TLS WS process; don't build the client on a broken transport.

- [ ] **Step 6: Commit (in mac_controller)**

```bash
cd ../mac_controller
git add src/controllers/mouse_controller.py src/server.py mac_controller_app.py
git commit -m "feat(system): /system/mouse_ws WebSocket — trackpad mouse control via pynput"
```

---

## Task 2: `useMouseSocket` hook (repo: mac-control-web-app)

**Files:**
- Create: `src/components/Remote/useMouseSocket.js`

- [ ] **Step 1: Create the hook**

```js
import { useEffect, useRef, useState } from "react";

// Opens a tab-scoped WebSocket to the Mac's mouse endpoint. Returns connection
// status and a send() that no-ops unless the socket is open.
export default function useMouseSocket() {
  const [status, setStatus] = useState("connecting");
  const wsRef = useRef(null);

  useEffect(() => {
    let intentional = false;
    let reconnectTimer = null;

    const connect = () => {
      const serviceUrl = localStorage.getItem("serviceUrl");
      const token = localStorage.getItem("authToken");
      if (!serviceUrl || !token) {
        setStatus("closed");
        return;
      }
      const url =
        serviceUrl.replace(/^http/, "ws") +
        "/system/mouse_ws?token=" +
        encodeURIComponent(token);
      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setStatus("open");
      ws.onclose = () => {
        setStatus("closed");
        if (!intentional) reconnectTimer = setTimeout(connect, 1000);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      intentional = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const send = (obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };

  return { status, send };
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run lint` → clean.
```bash
git add src/components/Remote/useMouseSocket.js
git commit -m "feat(remote): useMouseSocket hook (tab-scoped wss + status)"
```

---

## Task 3: `MouseTab` component + styles (repo: mac-control-web-app)

**Files:**
- Create: `src/components/Remote/tabs/MouseTab.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Create the component**

```jsx
import { useRef, useState } from "react";
import { MousePointer2 } from "lucide-react";
import useMouseSocket from "../useMouseSocket";

const TAP_MS = 250;          // max tap duration
const MOVE_THRESHOLD = 3;    // px before a touch counts as a move
const DOUBLE_TAP_MS = 300;   // window for double-tap-drag
const DOUBLE_TAP_DIST = 20;  // px
const SCROLL_DIVISOR = 6;    // pixels -> scroll units (tune in verify)

const STATUS = {
  connecting: { cls: "connecting", text: "Connecting…" },
  open: { cls: "open", text: "Connected" },
  closed: { cls: "closed", text: "Disconnected — reconnecting…" },
};

const MouseTab = () => {
  const { status, send } = useMouseSocket();
  const [speed, setSpeed] = useState(1.8);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const g = useRef({
    active: false, fingers: 0, startTime: 0, moved: false,
    lastX: 0, lastY: 0, dragging: false,
    lastTapTime: 0, lastTapX: 0, lastTapY: 0,
    accDx: 0, accDy: 0, accSx: 0, accSy: 0, raf: 0,
  });

  const flushAccum = () => {
    const s = g.current;
    if (s.accDx || s.accDy) {
      send({ t: "move", dx: Math.round(s.accDx), dy: Math.round(s.accDy) });
      s.accDx = 0; s.accDy = 0;
    }
    if (s.accSx || s.accSy) {
      send({
        t: "scroll",
        dx: Math.round(s.accSx / SCROLL_DIVISOR),
        dy: -Math.round(s.accSy / SCROLL_DIVISOR), // natural scrolling; flip if reversed
      });
      s.accSx = 0; s.accSy = 0;
    }
  };

  const rafLoop = () => {
    flushAccum();
    g.current.raf = requestAnimationFrame(rafLoop);
  };

  const onStart = (e) => {
    e.preventDefault();
    if (status !== "open") return;
    const s = g.current;
    const t = e.touches[0];
    s.active = true;
    s.fingers = e.touches.length;
    s.startTime = Date.now();
    s.moved = false;
    s.lastX = t.clientX;
    s.lastY = t.clientY;
    if (
      e.touches.length === 1 &&
      Date.now() - s.lastTapTime < DOUBLE_TAP_MS &&
      Math.abs(t.clientX - s.lastTapX) < DOUBLE_TAP_DIST &&
      Math.abs(t.clientY - s.lastTapY) < DOUBLE_TAP_DIST
    ) {
      s.dragging = true;
      send({ t: "down", b: "left" });
    }
    if (!s.raf) s.raf = requestAnimationFrame(rafLoop);
  };

  const onMove = (e) => {
    e.preventDefault();
    const s = g.current;
    if (!s.active) return;
    const t = e.touches[0];
    const dx = t.clientX - s.lastX;
    const dy = t.clientY - s.lastY;
    s.lastX = t.clientX;
    s.lastY = t.clientY;
    if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) s.moved = true;
    if (e.touches.length >= 2) {
      s.accSx += dx;
      s.accSy += dy;
    } else {
      s.accDx += dx * speedRef.current;
      s.accDy += dy * speedRef.current;
    }
  };

  const onEnd = (e) => {
    e.preventDefault();
    const s = g.current;
    if (!s.active || e.touches.length !== 0) return; // wait for all fingers up
    const dur = Date.now() - s.startTime;
    if (s.dragging) {
      send({ t: "up", b: "left" });
      s.dragging = false;
    } else if (!s.moved && dur < TAP_MS) {
      if (s.fingers >= 2) {
        send({ t: "click", b: "right" });
      } else {
        send({ t: "click", b: "left" });
        s.lastTapTime = Date.now();
        s.lastTapX = s.lastX;
        s.lastTapY = s.lastY;
      }
    }
    flushAccum();
    s.active = false;
    s.fingers = 0;
    if (s.raf) {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    }
  };

  const si = STATUS[status];
  const live = status === "open";

  return (
    <div>
      <div className={`conn-pill conn-pill--${si.cls}`}>
        <span className="conn-dot" /> {si.text}
      </div>
      <div
        className={`trackpad ${live ? "" : "is-disabled"}`}
        onTouchStart={onStart}
        onTouchMove={onMove}
        onTouchEnd={onEnd}
      >
        <MousePointer2 size={30} strokeWidth={1.4} />
        <span>drag to move · tap to click · 2-finger scroll</span>
      </div>
      <div className="row">
        <button className="tile" onClick={() => live && send({ t: "click", b: "left" })}>
          Left Click
        </button>
        <button className="tile" onClick={() => live && send({ t: "click", b: "right" })}>
          Right Click
        </button>
      </div>
      <div className="section-label">Pointer Speed</div>
      <div className="card">
        <input
          className="slider"
          type="range"
          min="1"
          max="3"
          step="0.1"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        />
      </div>
    </div>
  );
};

export default MouseTab;
```

- [ ] **Step 2: Add styles** to the end of `src/App.css`

```css
/* ===== Mouse tab ===== */
.conn-pill {
  display: inline-flex; align-items: center; gap: 7px;
  font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 10px;
  margin: 0 0 12px; border: 1px solid var(--border);
  color: var(--text-secondary); background: var(--surface);
}
.conn-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-secondary); }
.conn-pill--open { color: var(--accent-text); border-color: var(--accent-border); background: var(--accent-fill); }
.conn-pill--open .conn-dot { background: #30d158; box-shadow: 0 0 7px #30d158; }
.conn-pill--connecting .conn-dot { background: #e0a458; }
.conn-pill--closed { color: #ff6b6b; border-color: rgba(255,107,107,.4); background: rgba(255,107,107,.1); }
.conn-pill--closed .conn-dot { background: #ff6b6b; }
.trackpad {
  height: 300px; margin-bottom: var(--gap);
  background: var(--surface); border: 1px solid var(--border-strong);
  border-radius: var(--radius-card);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  color: var(--text-secondary); font-size: 13px;
  touch-action: none; user-select: none; -webkit-user-select: none;
}
.trackpad.is-disabled { opacity: 0.45; pointer-events: none; }
```

- [ ] **Step 3: Verify + commit**

Run: `npm run lint` → clean.
```bash
git add src/components/Remote/tabs/MouseTab.jsx src/App.css
git commit -m "feat(remote): MouseTab trackpad (gestures, indicator, buttons, speed)"
```

---

## Task 4: Add the 5th tab (repo: mac-control-web-app)

**Files:**
- Modify: `src/components/Remote/Remote.jsx`

- [ ] **Step 1: Import + register the tab.** Add the import:

```jsx
import MouseTab from "./tabs/MouseTab";
```

Add to the `TABS` array (after `stream`):

```jsx
  { id: "stream", label: "Stream" },
  { id: "mouse", label: "Mouse" },
];
```

Render it alongside the other tabs (after the `stream` line):

```jsx
        {tab === "stream" && <StreamTab onWatch={setActiveStream} audio={audio} />}
        {tab === "mouse" && <MouseTab />}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run lint` (clean) and `npm run build` (succeeds).
```bash
git add src/components/Remote/Remote.jsx
git commit -m "feat(remote): add Mouse tab"
```

---

## Task 5: Final verification (both repos)

- [ ] **Step 1: Client lint + build** — `npm run lint` (clean), `npm run build` (succeeds).

- [ ] **Step 2: On the phone**

Restart the Mac app. Open the **Mouse** tab:
- The connection pill shows **Connecting…** then **Connected** (trackpad ungreys).
- **Drag** the surface → the Mac cursor moves; adjust the **speed** slider.
- **Tap** → left click (test on something clickable). **Left/Right Click** buttons work.
- **Two-finger tap** → right click (context menu). **Two-finger drag** → scrolls (if direction/feel is off, flip the `dy` sign / tune `SCROLL_DIVISOR` in `MouseTab.jsx`).
- **Double-tap then drag** → selects text / drags a window.
- Switch to another tab and back → pill reconnects; toggling Wi-Fi briefly → shows Disconnected then reconnects.

- [ ] **Step 3: Final commit (if any tuning)**

```bash
git add -A && git commit -m "chore(mouse): tune scroll/speed"
```

---

## Self-Review (plan author)

- **Spec coverage:** wss endpoint + query-token auth + pynput move/click/scroll/down-up (Task 1); `threaded=True` so the blocking WS coexists with HTTP (Task 1, called out beyond the spec but required); `useMouseSocket` status + tab-scoped lifecycle + reconnect (Task 2); trackpad gesture state machine (tap/drag/2-finger/double-tap-drag), rAF move flush, speed multiplier, connection indicator + inert-until-open (Task 3); 5th tab (Task 4); wss smoke-test-first risk (Task 1 Step 5); scroll sign/divisor tuning (Task 5). Covered.
- **Message-type consistency:** client sends `t` ∈ {move, click, scroll, down, up} with `dx/dy/b`; server dispatches exactly those keys. `send`/`status` from `useMouseSocket` match `MouseTab` usage.
- **No placeholders:** every step has concrete code/commands.

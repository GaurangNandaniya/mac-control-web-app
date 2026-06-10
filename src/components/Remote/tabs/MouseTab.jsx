import { useRef, useState } from "react";
import { MousePointer2 } from "lucide-react";
import useMouseSocket from "../useMouseSocket";

const TAP_MS = 250; // max tap duration
const MOVE_THRESHOLD = 3; // px before a touch counts as a move
const DOUBLE_TAP_MS = 300; // window for double-tap-drag
const DOUBLE_TAP_DIST = 20; // px
const SCROLL_DIVISOR = 6; // pixels -> scroll units (tune in verify)

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

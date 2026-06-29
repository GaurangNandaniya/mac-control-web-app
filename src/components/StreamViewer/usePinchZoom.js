import { useCallback, useEffect, useRef, useState } from "react";

const MIN = 1;
const MAX = 5;
const DOUBLE_TAP_MS = 300;

// Pinch-to-zoom + drag-to-pan for the stream image. Attaches native,
// non-passive touch listeners to `targetRef` so preventDefault actually
// blocks iOS page-zoom (React's synthetic touch handlers are passive).
export default function usePinchZoom(targetRef, enabled = true) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  const g = useRef({ mode: null, startDist: 0, startScale: 1, sx: 0, sy: 0, stx: 0, sty: 0, lastTap: 0 });

  const apply = useCallback((next) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const reset = useCallback(() => apply({ scale: 1, x: 0, y: 0 }), [apply]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el || !enabled) return;

    const dist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
    const mid = (ts) => ({ x: (ts[0].clientX + ts[1].clientX) / 2, y: (ts[0].clientY + ts[1].clientY) / 2 });

    const onStart = (e) => {
      const ts = e.touches;
      const st = g.current;
      const v = viewRef.current;
      if (ts.length === 2) {
        st.mode = "pinch";
        st.startDist = dist(ts);
        st.startScale = v.scale;
        const m = mid(ts);
        st.sx = m.x; st.sy = m.y; st.stx = v.x; st.sty = v.y;
        e.preventDefault();
      } else if (ts.length === 1) {
        const now = Date.now();
        if (now - st.lastTap < DOUBLE_TAP_MS) {
          apply({ scale: 1, x: 0, y: 0 }); // double-tap → reset
          st.lastTap = 0;
          st.mode = null;
          e.preventDefault();
          return;
        }
        st.lastTap = now;
        st.mode = "pan";
        st.sx = ts[0].clientX; st.sy = ts[0].clientY; st.stx = v.x; st.sty = v.y;
      }
    };

    const onMove = (e) => {
      const ts = e.touches;
      const st = g.current;
      const v = viewRef.current;
      if (st.mode === "pinch" && ts.length === 2) {
        e.preventDefault();
        const scale = Math.max(MIN, Math.min(MAX, st.startScale * (dist(ts) / st.startDist)));
        const m = mid(ts);
        apply({ scale, x: st.stx + (m.x - st.sx), y: st.sty + (m.y - st.sy) });
      } else if (st.mode === "pan" && ts.length === 1 && v.scale > 1) {
        e.preventDefault();
        apply({ scale: v.scale, x: st.stx + (ts[0].clientX - st.sx), y: st.sty + (ts[0].clientY - st.sy) });
      }
    };

    const onEnd = (e) => {
      const st = g.current;
      const v = viewRef.current;
      if (e.touches.length === 0) {
        st.mode = null;
        if (v.scale <= 1) apply({ scale: 1, x: 0, y: 0 }); // snap back to centered
      } else if (e.touches.length === 1) {
        // lifting one finger of a pinch → continue as a pan
        st.mode = "pan";
        st.sx = e.touches[0].clientX; st.sy = e.touches[0].clientY; st.stx = v.x; st.sty = v.y;
      }
    };

    const opts = { passive: false };
    el.addEventListener("touchstart", onStart, opts);
    el.addEventListener("touchmove", onMove, opts);
    el.addEventListener("touchend", onEnd, opts);
    el.addEventListener("touchcancel", onEnd, opts);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [targetRef, enabled, apply]);

  const style = { transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` };
  return { style, zoomed: view.scale > 1, reset };
}

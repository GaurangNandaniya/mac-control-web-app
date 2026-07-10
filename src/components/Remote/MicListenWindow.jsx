import { useEffect, useRef, useState } from "react";
import { Headphones, Minus, X, Volume1, Volume2 } from "lucide-react";

// Floating, draggable audio window for the live Mac-mic stream. Two modes:
// floating (full card) and mini (a corner pill). No fullscreen — audio has
// nothing visual to enlarge. The window itself is the persistent "listening"
// indicator, so it survives tab switches (rendered at Remote level).
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const BAR_COUNT = 11;
let zCounter = 950;

const MicListenWindow = ({ mic, deviceLabel = "Mac" }) => {
  const { status, volume, setVolume, stop, analyserRef } = mic;

  const rootRef = useRef(null);
  const barsRef = useRef([]);
  const gesture = useRef(null);
  const draggedRef = useRef(false);

  const [mode, setMode] = useState("floating"); // "floating" | "mini"
  const [z, setZ] = useState(() => ++zCounter);
  const [pos, setPos] = useState(() => ({
    left: Math.max(4, window.innerWidth - 264),
    top: Math.max(60, window.innerHeight - 300),
  }));
  const savedFloatPos = useRef(pos);
  const [elapsed, setElapsed] = useState(0);

  const mini = mode === "mini";
  const live = status === "live";

  // Elapsed timer (resets whenever we leave the live state).
  useEffect(() => {
    if (!live) {
      setElapsed(0);
      return;
    }
    const t0 = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - t0), 500);
    return () => clearInterval(id);
  }, [live]);

  // Level meter — read the analyser directly each frame and write bar heights to
  // the DOM (no React state churn at audio rate).
  useEffect(() => {
    let raf;
    const data = new Uint8Array(256);
    const tick = () => {
      const an = analyserRef.current;
      const bars = barsRef.current;
      if (an && bars.length) {
        an.getByteTimeDomainData(data);
        const seg = Math.floor(data.length / bars.length) || 1;
        for (let i = 0; i < bars.length; i++) {
          let sum = 0;
          for (let j = 0; j < seg; j++) {
            const v = (data[i * seg + j] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / seg);
          if (bars[i]) bars[i].style.height = `${5 + Math.min(1, rms * 3.2) * 34}px`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [analyserRef]);

  const formatElapsed = (ms) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  const miniSlot = () => ({
    left: Math.max(4, window.innerWidth - 150),
    top: Math.max(4, window.innerHeight - 70),
  });

  const minimize = () => {
    savedFloatPos.current = pos;
    setPos(miniSlot());
    setMode("mini");
  };
  const restore = () => {
    setPos(savedFloatPos.current);
    setMode("floating");
  };

  // ---- drag (floating title bar + whole mini pill) ----
  const onPointerDown = (e) => {
    setZ(++zCounter);
    const okFloat =
      !mini && e.target.closest(".aw-head") && !e.target.closest(".header-icon-btn");
    const okMini = mini && !e.target.closest(".aw-mini-x");
    if (!okFloat && !okMini) return;
    draggedRef.current = false;
    gesture.current = { pid: e.pointerId, sx: e.clientX, sy: e.clientY, sl: pos.left, st: pos.top };
    try { rootRef.current.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    e.preventDefault();
  };
  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g || g.pid !== e.pointerId) return;
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) draggedRef.current = true;
    const r = rootRef.current.getBoundingClientRect();
    setPos({
      left: clamp(g.sl + dx, 4, window.innerWidth - r.width - 4),
      top: clamp(g.st + dy, 4, window.innerHeight - r.height - 4),
    });
  };
  const onPointerUp = (e) => {
    if (!gesture.current) return;
    gesture.current = null;
    try { rootRef.current.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const onPillClick = (e) => {
    if (mini && !draggedRef.current && !e.target.closest(".aw-mini-x")) restore();
  };

  return (
    <div
      ref={rootRef}
      className={`audio-window is-${mode}${status === "connecting" ? " is-connecting" : ""}`}
      style={{ left: pos.left, top: pos.top, zIndex: z }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="aw-head">
        <span className="aw-ic" aria-hidden="true">
          <Headphones size={16} strokeWidth={1.8} />
        </span>
        <span className="aw-ttl">{deviceLabel} Microphone</span>
        <div className="aw-acts">
          <button className="header-icon-btn" aria-label="Minimize" onClick={minimize}>
            <Minus size={16} strokeWidth={1.8} />
          </button>
          <button className="header-icon-btn" aria-label="Stop and close" onClick={stop}>
            <X size={16} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <div className="aw-body">
        <div className="aw-status">
          <span className="aw-dot" />
          <div className="aw-txt">
            {status === "connecting" ? "Connecting…" : "Live"}
            <small>{status === "connecting" ? "opening mic stream" : `${deviceLabel}’s microphone`}</small>
          </div>
          <span className="aw-timer">{formatElapsed(elapsed)}</span>
        </div>

        <div className="aw-bars">
          {Array.from({ length: BAR_COUNT }, (_, i) => (
            <span key={i} ref={(el) => (barsRef.current[i] = el)} />
          ))}
        </div>

        <div className="aw-volrow">
          <Volume1 size={16} strokeWidth={1.8} />
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
            aria-label="Listen volume"
          />
          <Volume2 size={16} strokeWidth={1.8} />
        </div>

        <button className="aw-stop" onClick={stop}>Stop Listening</button>
      </div>

      {/* Minimized pill (shown only in mini mode via CSS). */}
      <div className="aw-mini-pill" onClick={onPillClick}>
        <span className="aw-ic" aria-hidden="true">
          <Headphones size={16} strokeWidth={1.8} />
        </span>
        <span className="aw-mini-bars">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} ref={(el) => (barsRef.current[BAR_COUNT + i] = el)} />
          ))}
        </span>
        <span className="aw-mini-timer">{formatElapsed(elapsed)}</span>
        <button
          className="aw-mini-x"
          aria-label="Stop and close"
          onClick={(e) => {
            e.stopPropagation();
            stop();
          }}
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};

export default MicListenWindow;

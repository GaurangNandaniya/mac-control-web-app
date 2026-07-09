import { useEffect, useRef, useState } from "react";
import {
  X, Circle, Square, Camera, Maximize2, Minimize2, Minus, RotateCw, MousePointer2, GripHorizontal,
} from "lucide-react";
import useStreamRecorder from "./useStreamRecorder";
import usePinchZoom from "./usePinchZoom";

// Shared front-most z-index across all open windows (each instance bumps it on touch).
let zCounter = 900;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const MINI_W = 150;

// A floating, draggable, resizable stream window. Multiple can be open at once
// (screen + camera); each manages its own float/mini/fullscreen state and position.
// `index` staggers the initial spawn position and the minimized-tile stacking slot.
const StreamViewer = ({ type, onClose, mouseClick, index = 0 }) => {
  const rootRef = useRef(null);
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const stageRef = useRef(null);

  const [mode, setMode] = useState("floating"); // "floating" | "mini" | "full"
  const [rotated, setRotated] = useState(false);
  const [pointerMode, setPointerMode] = useState(false);
  const [z, setZ] = useState(() => ++zCounter);

  const initW = Math.min(window.innerWidth * 0.7, 320);
  const [width, setWidth] = useState(initW);
  const [pos, setPos] = useState(() => ({
    left: Math.max(4, window.innerWidth - initW - 14 - index * 22),
    top: 90 + index * 30,
  }));
  const savedFloatPos = useRef(pos); // where to restore a minimized window to

  const full = mode === "full";
  const mini = mode === "mini";

  // Pinch/pan the stream image. Off while rotated, and off in the mini tile
  // (there a single tap means "restore", not "pan").
  const zoom = usePinchZoom(stageRef, !rotated && !mini);

  // Only the screen stream maps to Mac coordinates; pointer mode is screen-only.
  const canPoint = type === "screen" && typeof mouseClick === "function";

  // ---- drag + resize (pointer events; works for touch + mouse) ----
  const gesture = useRef(null);
  const draggedRef = useRef(false);

  const beginDrag = (e) => {
    draggedRef.current = false;
    gesture.current = { kind: "drag", pid: e.pointerId, sx: e.clientX, sy: e.clientY, sl: pos.left, st: pos.top };
    try { rootRef.current.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const beginResize = (e) => {
    e.stopPropagation(); // don't also start a drag
    setZ(++zCounter);
    gesture.current = { kind: "resize", pid: e.pointerId, sx: e.clientX, sw: width };
    try { rootRef.current.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const onRootPointerDown = (e) => {
    setZ(++zCounter); // bring to front on any touch
    if (full) return;
    if (mini) {
      if (e.target.closest(".stream-mini-x")) return;
      beginDrag(e);
    } else if (e.target.closest(".stream-header") && !e.target.closest(".header-icon-btn")) {
      beginDrag(e); // floating: drag only from the title bar
    }
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g || g.pid !== e.pointerId) return;
    if (g.kind === "drag") {
      const dx = e.clientX - g.sx;
      const dy = e.clientY - g.sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) draggedRef.current = true;
      const r = rootRef.current.getBoundingClientRect();
      setPos({
        left: clamp(g.sl + dx, 4, window.innerWidth - r.width - 4),
        top: clamp(g.st + dy, 4, window.innerHeight - r.height - 4),
      });
    } else {
      setWidth(clamp(g.sw + (e.clientX - g.sx), MINI_W, window.innerWidth * 0.92));
    }
  };

  const onPointerUp = (e) => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    try { rootRef.current.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    // After a resize, keep the (possibly wider) window on-screen.
    if (g.kind === "resize") {
      const r = rootRef.current.getBoundingClientRect();
      setPos((p) => ({
        left: clamp(p.left, 4, window.innerWidth - r.width - 4),
        top: clamp(p.top, 4, window.innerHeight - r.height - 4),
      }));
    }
  };

  // ---- mode transitions ----
  const miniSlot = () => {
    const h = MINI_W * 0.69; // ~tile height for stacking
    return {
      left: Math.max(4, window.innerWidth - MINI_W - 12),
      top: Math.max(4, window.innerHeight - 12 - (index + 1) * (h + 10)),
    };
  };

  const minimize = () => {
    if (mode === "floating") savedFloatPos.current = pos;
    setRotated(false);
    setPos(miniSlot());
    setMode("mini");
  };

  const restore = () => {
    setPos(savedFloatPos.current);
    setMode("floating");
  };

  // Keep `mode` in sync if the user exits native fullscreen via the OS (ESC / swipe).
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && full) setMode("floating");
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [full]);

  const toggleFull = () => {
    const goingFull = !full;
    setMode(goingFull ? "full" : "floating");
    if (!goingFull) setRotated(false);
    // Native fullscreen is a progressive enhancement (desktop/iPad/Android);
    // iPhone has no Fullscreen API, so the CSS immersive layer carries it there.
    const el = rootRef.current;
    try {
      if (goingFull && el && el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if (!goingFull && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      /* unsupported — CSS immersive mode still applies */
    }
  };

  const togglePointer = () => {
    setPointerMode((p) => {
      const next = !p;
      if (next) setRotated(false); // rotate + pointer-mapping don't mix; keep zoom
      return next;
    });
  };

  // Map a tap on the displayed image (object-fit: contain → letterboxed) to
  // normalized 0..1 coords of the actual image content, then click on the Mac.
  const handleStageClick = (e) => {
    if (mini) {
      // Tap (not drag) on a minimized tile → restore it to a floating window.
      if (!draggedRef.current && !e.target.closest(".stream-mini-x")) restore();
      return;
    }
    if (!pointerMode || rotated) return;
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return;
    const rect = img.getBoundingClientRect();
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const boxAspect = rect.width / rect.height;
    let cw, ch, cx, cy;
    if (imgAspect > boxAspect) {
      cw = rect.width;
      ch = rect.width / imgAspect;
      cx = rect.left;
      cy = rect.top + (rect.height - ch) / 2;
    } else {
      ch = rect.height;
      cw = rect.height * imgAspect;
      cy = rect.top;
      cx = rect.left + (rect.width - cw) / 2;
    }
    const rx = (e.clientX - cx) / cw;
    const ry = (e.clientY - cy) / ch;
    if (rx < 0 || rx > 1 || ry < 0 || ry > 1) return; // tapped the letterbox
    mouseClick(rx, ry);
  };

  const { isRecording, elapsedMs, error, start, stop, snapshot } = useStreamRecorder(imgRef, canvasRef, type);

  const formatElapsed = (ms) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const serviceUrl = localStorage.getItem("serviceUrl");
  const token = localStorage.getItem("authToken");

  let streamUrl = "";
  if (serviceUrl && token) {
    if (type === "camera") {
      streamUrl = `${serviceUrl}/system/camera/stream?fps=30&token=${token}`;
    } else if (type === "screen") {
      streamUrl = `${serviceUrl}/system/screen/stream?fps=30&token=${token}`;
    }
  }

  const handleClose = () => {
    if (isRecording) stop();
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    // Explicitly drop the src to immediately terminate the HTTP socket
    if (imgRef.current) {
      imgRef.current.src = "";
    }
    onClose();
  };

  const title = type === "camera" ? "Live Camera Stream" : "Live Screen Stream";
  const style = full
    ? { zIndex: z }
    : { left: pos.left, top: pos.top, zIndex: z, ...(mini ? {} : { width }) };

  return (
    <div
      ref={rootRef}
      className={`stream-window is-${mode}`}
      style={style}
      onPointerDown={onRootPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="stream-header">
        <span className="stream-grip" aria-hidden="true">
          <GripHorizontal size={16} strokeWidth={1.8} />
        </span>
        <h3>{title}</h3>
        <div className="stream-header__actions">
          {streamUrl && canPoint && (
            <button
              className={`header-icon-btn${pointerMode ? " is-active" : ""}`}
              aria-label={pointerMode ? "Pointer mode on" : "Tap-to-click"}
              onClick={togglePointer}
            >
              <MousePointer2 size={16} strokeWidth={1.8} />
            </button>
          )}
          {streamUrl && full && !pointerMode && (
            <button
              className={`header-icon-btn${rotated ? " is-active" : ""}`}
              aria-label="Rotate stream"
              onClick={() => {
                zoom.reset();
                setRotated((r) => !r);
              }}
            >
              <RotateCw size={16} strokeWidth={1.8} />
            </button>
          )}
          {streamUrl && (
            <button
              className="header-icon-btn"
              aria-label={full ? "Exit fullscreen" : "Fullscreen"}
              onClick={toggleFull}
            >
              {full ? <Minimize2 size={16} strokeWidth={1.8} /> : <Maximize2 size={16} strokeWidth={1.8} />}
            </button>
          )}
          {streamUrl && (
            <button className="header-icon-btn" aria-label="Minimize" onClick={minimize}>
              <Minus size={16} strokeWidth={1.8} />
            </button>
          )}
          {streamUrl && (
            <button className="header-icon-btn" aria-label="Save snapshot" onClick={snapshot}>
              <Camera size={16} strokeWidth={1.8} />
            </button>
          )}
          {streamUrl && (
            <button
              className={`header-icon-btn${isRecording ? " is-recording" : ""}`}
              aria-label={isRecording ? "Stop recording" : "Record video"}
              onClick={isRecording ? stop : start}
            >
              {isRecording ? <Square size={16} strokeWidth={1.8} /> : <Circle size={16} strokeWidth={1.8} />}
            </button>
          )}
          <button className="header-icon-btn" aria-label="Close" onClick={handleClose}>
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {!streamUrl ? (
        <div className="error-message">Configuration missing (URL or Token)</div>
      ) : (
        <div ref={stageRef} className="stream-container" onClick={handleStageClick}>
          {isRecording && (
            <div className="rec-badge">
              <span className="rec-badge__dot" />
              REC {formatElapsed(elapsedMs)}
            </div>
          )}
          <img
            ref={imgRef}
            crossOrigin="anonymous"
            className={`${rotated ? "is-rotated" : ""}${pointerMode ? " is-pointing" : ""}`}
            style={rotated ? undefined : zoom.style}
            id={type === "camera" ? "cameraStream" : "screenStream"}
            src={streamUrl}
            alt="Live Stream"
          />
          {/* Minimized-tile controls (shown only in mini mode via CSS). */}
          <button
            className="stream-mini-x"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
          >
            <X size={13} strokeWidth={2} />
          </button>
          <div className="stream-mini-tag">{type} · tap to expand</div>
          {/* Hidden mirror canvas used only as the recording source. */}
          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
      )}

      {!full && !mini && <div className="stream-resize" onPointerDown={beginResize} aria-hidden="true" />}
    </div>
  );
};

export default StreamViewer;

import { useEffect, useRef, useState } from "react";
import { X, Circle, Square, Camera, Maximize2, Minimize2, RotateCw, MousePointer2 } from "lucide-react";
import useStreamRecorder from "./useStreamRecorder";
import usePinchZoom from "./usePinchZoom";

const StreamViewer = ({ type, onClose, mouseClick }) => {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const contentRef = useRef(null);
  const stageRef = useRef(null);

  const [expanded, setExpanded] = useState(false);
  const [rotated, setRotated] = useState(false);
  const [pointerMode, setPointerMode] = useState(false);

  // Pinch/pan the stream — stays active in pointer mode so you can zoom in to
  // aim, then tap to click (the tap→coord mapping accounts for the zoom).
  const zoom = usePinchZoom(stageRef, !rotated);

  // Only the screen stream maps to Mac coordinates; pointer mode is screen-only.
  const canPoint = type === "screen" && typeof mouseClick === "function";

  // Map a tap on the displayed image (object-fit: contain → letterboxed) to
  // normalized 0..1 coords of the actual image content, then click on the Mac.
  const handleStageClick = (e) => {
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

  const togglePointer = () => {
    setPointerMode((p) => {
      const next = !p;
      if (next) setRotated(false); // rotate + pointer-mapping don't mix; keep zoom
      return next;
    });
  };

  const { isRecording, elapsedMs, error, start, stop, snapshot } = useStreamRecorder(imgRef, canvasRef, type);

  const formatElapsed = (ms) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  // Keep `expanded` in sync if the user exits native fullscreen via the OS (ESC).
  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && expanded) setExpanded(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, [expanded]);

  const toggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (!next) setRotated(false);
    // Native fullscreen is a progressive enhancement (desktop/iPad/Android);
    // iPhone has no Fullscreen API, so the CSS immersive layer carries it there.
    const el = contentRef.current;
    try {
      if (next && el && el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if (!next && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      /* unsupported — CSS immersive mode still applies */
    }
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

  return (
    <div className={`stream-viewer-overlay${expanded ? " is-expanded" : ""}`}>
      <div ref={contentRef} className={`stream-viewer-content${expanded ? " is-expanded" : ""}`}>
        <div className="stream-header">
          <h3>{type === "camera" ? "Live Camera Stream" : "Live Screen Stream"}</h3>
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
            {streamUrl && expanded && !pointerMode && (
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
                aria-label={expanded ? "Exit fullscreen" : "Fullscreen"}
                onClick={toggleExpand}
              >
                {expanded ? (
                  <Minimize2 size={16} strokeWidth={1.8} />
                ) : (
                  <Maximize2 size={16} strokeWidth={1.8} />
                )}
              </button>
            )}
            {streamUrl && (
              <button
                className="header-icon-btn"
                aria-label="Save snapshot"
                onClick={snapshot}
              >
                <Camera size={16} strokeWidth={1.8} />
              </button>
            )}
            {streamUrl && (
              <button
                className={`header-icon-btn${isRecording ? " is-recording" : ""}`}
                aria-label={isRecording ? "Stop recording" : "Record video"}
                onClick={isRecording ? stop : start}
              >
                {isRecording ? (
                  <Square size={16} strokeWidth={1.8} />
                ) : (
                  <Circle size={16} strokeWidth={1.8} />
                )}
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
          <div ref={stageRef} className={`stream-container${expanded ? " is-expanded" : ""}`}>
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
              onClick={handleStageClick}
            />
            {/* Hidden mirror canvas used only as the recording source. */}
            <canvas ref={canvasRef} style={{ display: "none" }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamViewer;

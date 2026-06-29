import { useEffect, useRef, useState } from "react";
import { X, Circle, Square, Camera, Maximize2, Minimize2, RotateCw } from "lucide-react";
import useStreamRecorder from "./useStreamRecorder";
import usePinchZoom from "./usePinchZoom";

const StreamViewer = ({ type, onClose }) => {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const contentRef = useRef(null);
  const stageRef = useRef(null);

  const [expanded, setExpanded] = useState(false);
  const [rotated, setRotated] = useState(false);

  // Pinch/pan the stream — disabled while rotated (transforms would collide).
  const zoom = usePinchZoom(stageRef, !rotated);

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
            {streamUrl && expanded && (
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
              className={rotated ? "is-rotated" : ""}
              style={rotated ? undefined : zoom.style}
              id={type === "camera" ? "cameraStream" : "screenStream"}
              src={streamUrl}
              alt="Live Stream"
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

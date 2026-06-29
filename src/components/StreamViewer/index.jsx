import { useRef } from "react";
import { X, Circle, Square } from "lucide-react";
import useStreamRecorder from "./useStreamRecorder";

const StreamViewer = ({ type, onClose }) => {
  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  const { isRecording, error, start, stop } = useStreamRecorder(imgRef, canvasRef, type);

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
    // Explicitly drop the src to immediately terminate the HTTP socket
    if (imgRef.current) {
      imgRef.current.src = "";
    }
    onClose();
  };

  return (
    <div className="stream-viewer-overlay">
      <div className="stream-viewer-content">
        <div className="stream-header">
          <h3>{type === "camera" ? "Live Camera Stream" : "Live Screen Stream"}</h3>
          <div className="stream-header__actions">
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
          <div className="stream-container">
            <img
              ref={imgRef}
              crossOrigin="anonymous"
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

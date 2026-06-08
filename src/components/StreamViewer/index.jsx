import { useRef } from "react";
import { X } from "lucide-react";

const StreamViewer = ({ type, onClose }) => {
  const imgRef = useRef(null);

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
          <button className="header-icon-btn" aria-label="Close" onClick={handleClose}>
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        {!streamUrl ? (
          <div className="error-message">Configuration missing (URL or Token)</div>
        ) : (
          <div className="stream-container">
            <img
              ref={imgRef}
              id={type === "camera" ? "cameraStream" : "screenStream"}
              src={streamUrl}
              alt="Live Stream"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamViewer;

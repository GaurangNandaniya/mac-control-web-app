import { useRef } from "react";

const StreamViewer = ({ type, onClose }) => {
  const imgRef = useRef(null);

  // Extract base values from localStorage
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
    // Explicitly dropping the src to immediately terminate the HTTP socket per guide
    if (imgRef.current) {
      imgRef.current.src = "";
    }
    onClose();
  };

  return (
    <div className="stream-viewer-overlay">
      <div className="stream-viewer-content">
        <div className="stream-header">
          <h3>
            {type === "camera" ? "Live Camera Stream" : "Live Screen Stream"}
          </h3>
          <button
            className="control-button"
            onClick={handleClose}
            style={{ margin: 0, backgroundColor: "#ff4757" }}
          >
            Close
          </button>
        </div>

        {!streamUrl ? (
          <div className="error-message">Configuration missing (URL or Token)</div>
        ) : (
          <div
            className="stream-container"
            style={{
              backgroundColor: "#000",
              minHeight: "300px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              ref={imgRef}
              id={type === "camera" ? "cameraStream" : "screenStream"}
              src={streamUrl}
              style={{
                width: "100%",
                maxHeight: "80vh",
                objectFit: "contain",
              }}
              alt="Live Stream"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default StreamViewer;

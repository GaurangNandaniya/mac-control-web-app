import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

// Camera-based QR scanner. Streams the rear camera, decodes frames with jsQR,
// and calls onResult(text) once a code is read. Needed so a Safari-installed
// standalone PWA (isolated storage) can pair in its own context — deep-links
// open in Safari, not the installed app.
const QrScanner = ({ onResult, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };

    const scan = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w && h) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(video, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const code = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" });
          if (code && code.data) {
            stop();
            resultRef.current(code.data);
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(scan);
    };

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play();
        scan();
      } catch {
        setError("Camera unavailable — allow camera access and try again.");
      }
    };

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  return (
    <div className="qr-scanner">
      {error ? (
        <div className="error-message">{error}</div>
      ) : (
        <div className="qr-scanner__viewport">
          <video ref={videoRef} className="qr-scanner__video" muted playsInline />
          <div className="qr-scanner__frame" />
        </div>
      )}
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <button className="btn-ghost btn-block" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
};

export default QrScanner;

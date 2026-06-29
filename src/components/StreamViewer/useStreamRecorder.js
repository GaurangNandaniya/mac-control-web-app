import { useCallback, useRef, useState } from "react";

// Pick a container the browser can actually record. iOS WebKit only emits MP4
// (H.264); desktop/Android Chrome prefer WebM. Probe in order of "best for
// saving to iPhone Photos" first.
const pickMimeType = () => {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=h264",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  for (const t of candidates) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return ""; // let MediaRecorder fall back to its own default
};

const saveRecording = async (blob, mimeType, label) => {
  const ext = mimeType.includes("mp4") ? "mp4" : "webm";
  const name = `mac-${label}-${Date.now()}.${ext}`;
  const file = new File([blob], name, { type: mimeType });

  // Preferred on iOS: the native share sheet exposes "Save Video" → Photos.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // user dismissed the sheet
      // otherwise fall through to a plain download
    }
  }

  // Desktop / unsupported-share fallback.
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// Records the live MJPEG <img> by mirroring its frames onto a <canvas> and
// recording the canvas's captureStream. Scoped to the StreamViewer modal.
export default function useStreamRecorder(imgRef, canvasRef, label) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState("");
  const recorderRef = useRef(null);
  const rafRef = useRef(null);
  const chunksRef = useRef([]);
  const mimeRef = useRef("");

  const start = useCallback(() => {
    setError("");
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) {
      setError("Stream not ready yet — give it a second, then try again.");
      return;
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    const draw = () => {
      try {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } catch {
        // A frame mid-swap can throw; just skip it.
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    let stream;
    try {
      stream = canvas.captureStream(30);
    } catch {
      cancelAnimationFrame(rafRef.current);
      setError("Recording isn't supported on this browser.");
      return;
    }

    const mime = pickMimeType();
    if (mime === null) {
      cancelAnimationFrame(rafRef.current);
      setError("Recording isn't supported on this browser.");
      return;
    }
    mimeRef.current = mime;

    let recorder;
    try {
      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
    } catch {
      cancelAnimationFrame(rafRef.current);
      setError("Recording isn't supported on this browser.");
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      cancelAnimationFrame(rafRef.current);
      const type = (mimeRef.current || "video/mp4").split(";")[0];
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      if (blob.size) saveRecording(blob, type, label);
      setIsRecording(false);
    };

    recorder.start();
    recorderRef.current = recorder;
    setIsRecording(true);
  }, [imgRef, canvasRef, label]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop(); // triggers onstop → save
    } else {
      cancelAnimationFrame(rafRef.current);
      setIsRecording(false);
    }
  }, []);

  return { isRecording, error, start, stop };
}

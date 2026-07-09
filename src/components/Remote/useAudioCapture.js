import { useState, useRef } from "react";
import audioBufferToWav from "audiobuffer-to-wav";

// Mic recording + live streaming to the Mac. Lives at the Remote level (not in
// StreamTab) so it survives tab switches — otherwise unmounting StreamTab would
// drop the UI state while the recorder kept running with no way to stop it.
export default function useAudioCapture(makeRequest) {
  const [isRecording, setIsRecording] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const micWsRef = useRef(null);
  const processorRef = useRef(null);
  const sourceRef = useRef(null);

  const convertWebmToWav = async (webmBlob) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await ctx.decodeAudioData(await webmBlob.arrayBuffer());
    return new Blob([audioBufferToWav(buf)], { type: "audio/wav" });
  };

  const handleAudioUpload = async (blob) => {
    try {
      const wav = await convertWebmToWav(blob);
      const fd = new FormData();
      fd.append("audio", wav, `recording_${Date.now()}.wav`);
      await makeRequest("/alerts/upload/audio", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    } catch (e) {
      console.error("Audio upload failed:", e);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 44100, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      const chunks = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      mediaRecorderRef.current.onstop = async () =>
        handleAudioUpload(new Blob(chunks, { type: "audio/webm;codecs=opus" }));
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Error starting recording:", e);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setIsRecording(false);
  };

  // Live mic → Mac over a persistent WebSocket. The old path did one HTTP POST per
  // ~23ms chunk (~43/sec); on the keep-alive-less dev server each POST paid a fresh
  // TCP+TLS handshake, so audio arrived with 40-190ms jitter and broke constantly.
  // One socket = no per-chunk handshake → steady delivery. We also send the Audio
  // context's ACTUAL sample rate (iOS runs at 48kHz, not the old hardcoded 44.1kHz).
  const startAudioStream = async () => {
    try {
      const serviceUrl = localStorage.getItem("serviceUrl");
      const token = localStorage.getItem("authToken");
      if (!serviceUrl || !token) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = ctx;
      const rate = Math.round(ctx.sampleRate); // actual hardware rate (48000 on iOS)

      const url =
        serviceUrl.replace(/^http/, "ws") +
        `/alerts/audio_ws?token=${encodeURIComponent(token)}&rate=${rate}&channels=1`;
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      micWsRef.current = ws;

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(1024, 1, 1);
      sourceRef.current = source;
      processorRef.current = processor;
      processor.onaudioprocess = (event) => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const input = event.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          pcm[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
        }
        ws.send(pcm.buffer);
      };
      source.connect(processor);
      // Connect to destination so the processor keeps ticking; it writes no output
      // buffer, so this emits silence (no phone-side echo of your own voice).
      processor.connect(ctx.destination);
      setIsStreaming(true);
    } catch (e) {
      console.error("Error starting audio stream:", e);
    }
  };

  const stopAudioStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
    } catch { /* ignore */ }
    if (micWsRef.current) {
      try { micWsRef.current.close(); } catch { /* ignore */ }
      micWsRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    processorRef.current = null;
    sourceRef.current = null;
    setIsStreaming(false);
  };

  /* LEGACY per-chunk HTTP POST version — replaced by the WebSocket above (kept for
     reference). Fired ~43 axios POSTs/sec to /alerts/stream/audio; each paid a fresh
     TCP+TLS handshake on the keep-alive-less dev server → 40-190ms jitter → breaking.
  const startAudioStreamHttp = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 44100, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(1024, 1, 1);
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          pcm[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
        }
        makeRequest("/alerts/stream/audio", pcm, {
          headers: {
            "X-Sample-Rate": "44100",
            "X-Channels": "1",
            "Content-Type": "application/octet-stream",
          },
        }).catch(console.error);
      };
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      setIsStreaming(true);
    } catch (e) {
      console.error("Error starting audio stream:", e);
    }
  };
  */

  return { isRecording, isStreaming, startRecording, stopRecording, startAudioStream, stopAudioStream };
}

import { useEffect, useRef, useState } from "react";

// Listen to the Mac's built-in microphone live. Opens a wss WebSocket to the
// main server's /media/mic_ws (Int16 mono PCM) and schedules the frames through
// Web Audio. Lives at the Remote level so playback survives tab switches.
//
// iOS notes: the AudioContext must be created inside the user gesture that calls
// start() (the "Listen" tap), and the phone's silent switch must be OFF or WebKit
// mutes Web Audio entirely.
const SAMPLE_RATE = 48000;
const MAX_LATENCY = 0.25; // seconds of buffered audio before we resync

export default function useMicListen() {
  const [status, setStatus] = useState("closed"); // "closed" | "connecting" | "live"
  const [volume, setVolumeState] = useState(0.8);

  const wsRef = useRef(null);
  const ctxRef = useRef(null);
  const gainRef = useRef(null);
  const analyserRef = useRef(null); // exposed so the meter can read levels via rAF
  const nextTimeRef = useRef(0);
  const intentionalRef = useRef(false);

  const teardown = () => {
    intentionalRef.current = true;
    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* ignore */ }
      wsRef.current = null;
    }
    if (ctxRef.current) {
      try { ctxRef.current.close(); } catch { /* ignore */ }
      ctxRef.current = null;
    }
    gainRef.current = null;
    analyserRef.current = null;
  };

  const stop = () => {
    teardown();
    setStatus("closed");
  };

  const start = () => {
    const serviceUrl = localStorage.getItem("serviceUrl");
    const token = localStorage.getItem("authToken");
    if (!serviceUrl || !token) return;

    intentionalRef.current = false;
    setStatus("connecting");

    // Create + resume the context synchronously in the tap gesture (iOS autoplay).
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume?.();
    const gain = ctx.createGain();
    gain.gain.value = volume;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    gain.connect(analyser);
    analyser.connect(ctx.destination);
    ctxRef.current = ctx;
    gainRef.current = gain;
    analyserRef.current = analyser;
    nextTimeRef.current = 0;

    const url =
      serviceUrl.replace(/^http/, "ws") + "/media/mic_ws?token=" + encodeURIComponent(token);
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => setStatus("live");
    ws.onmessage = (e) => {
      const c = ctxRef.current;
      const g = gainRef.current;
      if (!c || !g) return;
      const pcm = new Int16Array(e.data);
      const frames = pcm.length; // mono
      if (!frames) return;
      const buf = c.createBuffer(1, frames, SAMPLE_RATE);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < frames; i++) ch[i] = pcm[i] / 32768;
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(g);
      const now = c.currentTime;
      let t = nextTimeRef.current;
      if (t > now + MAX_LATENCY) t = now + 0.05; // fell too far behind → resync
      else if (t < now) t = now + 0.05; // underran → restart just ahead
      src.start(t);
      nextTimeRef.current = t + buf.duration;
    };
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      // No auto-reconnect: silently reopening the mic would be surprising. If the
      // drop wasn't user-initiated, fall back to closed so the user can re-tap.
      if (!intentionalRef.current) stop();
    };
  };

  const setVolume = (v) => {
    setVolumeState(v);
    if (gainRef.current) gainRef.current.gain.value = v;
  };

  // Close the socket + context if Remote unmounts (disconnect / token expiry).
  useEffect(() => () => teardown(), []);

  return { status, volume, setVolume, start, stop, analyserRef };
}

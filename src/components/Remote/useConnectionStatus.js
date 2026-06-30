import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

const PING_INTERVAL = 15000; // ms between health checks
const PING_TIMEOUT = 5000;

// Polls the Mac's unauthenticated /connections/ping to report reachability +
// round-trip latency. Lives at the Remote level so it survives tab switches.
export default function useConnectionStatus() {
  const [status, setStatus] = useState("checking"); // checking | online | offline
  const [latency, setLatency] = useState(null);
  const aliveRef = useRef(true);
  const timerRef = useRef(null);

  const ping = useCallback(async (manual = false) => {
    const serviceUrl = localStorage.getItem("serviceUrl");
    if (!serviceUrl) {
      setStatus("offline");
      setLatency(null);
      return;
    }
    // Show "checking" only on a manual retry, not on every silent auto-poll.
    if (manual) setStatus("checking");
    const t0 = Date.now();
    try {
      // Any 2xx means the Mac is reachable. text/plain avoids a CORS preflight.
      await axios.post(`${serviceUrl}/connections/ping`, "MAC_ADDRESS_PING", {
        timeout: PING_TIMEOUT,
        headers: { "Content-Type": "text/plain" },
      });
      if (!aliveRef.current) return;
      setLatency(Date.now() - t0);
      setStatus("online");
    } catch {
      if (!aliveRef.current) return;
      setLatency(null);
      setStatus("offline");
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    ping();
    timerRef.current = setInterval(ping, PING_INTERVAL);
    // Re-check promptly when the tab refocuses or the network comes back.
    const recheck = () => ping();
    window.addEventListener("focus", recheck);
    window.addEventListener("online", recheck);
    return () => {
      aliveRef.current = false;
      clearInterval(timerRef.current);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("online", recheck);
    };
  }, [ping]);

  const refresh = useCallback(() => ping(true), [ping]);

  return { status, latency, refresh };
}

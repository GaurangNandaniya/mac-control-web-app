import { useEffect, useRef, useState } from "react";

// Opens a tab-scoped WebSocket to the Mac's mouse endpoint. Returns connection
// status and a send() that no-ops unless the socket is open.
export default function useMouseSocket() {
  const [status, setStatus] = useState("connecting");
  const wsRef = useRef(null);

  useEffect(() => {
    let intentional = false;
    let reconnectTimer = null;

    const connect = () => {
      const serviceUrl = localStorage.getItem("serviceUrl");
      const token = localStorage.getItem("authToken");
      if (!serviceUrl || !token) {
        setStatus("closed");
        return;
      }
      const url =
        serviceUrl.replace(/^http/, "ws") +
        "/system/mouse_ws?token=" +
        encodeURIComponent(token);
      setStatus("connecting");
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setStatus("open");
      ws.onclose = () => {
        setStatus("closed");
        if (!intentional) reconnectTimer = setTimeout(connect, 1000);
      };
      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      intentional = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const send = (obj) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  };

  return { status, send };
}

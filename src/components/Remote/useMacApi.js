import { useState, useEffect, useCallback } from "react";
import axios from "axios";

export default function useMacApi() {
  const [batteryLevel, setBatteryLevel] = useState(null);

  const makeRequest = useCallback(async (endpoint, data = {}, config = {}) => {
    const token = localStorage.getItem("authToken");
    const serviceUrl = localStorage.getItem("serviceUrl");
    const response = await axios.post(`${serviceUrl}${endpoint}`, data, {
      ...config,
      headers: { Authorization: `Bearer ${token}`, ...config.headers },
    });
    return response.data;
  }, []);

  const media = useCallback(
    (action) => makeRequest(`/media/${action}`).catch(console.error),
    [makeRequest]
  );

  const system = useCallback(
    async (action, data = {}) => {
      try {
        const result = await makeRequest(`/system/${action}`, data);
        if (action === "battery" && result?.status === "success") {
          setBatteryLevel(result.percentage);
        }
        return result;
      } catch (e) {
        console.error(`system ${action}`, e);
      }
    },
    [makeRequest]
  );

  const setKeyboardLight = useCallback(
    (level) => {
      const clamped = Math.max(0, Math.min(100, Number(level) || 0));
      return system(`keyboard-light-set/${clamped}`);
    },
    [system]
  );

  const typeText = useCallback(
    (text) => {
      if (!text) return Promise.resolve();
      return makeRequest("/system/keyboardType", { text }).catch(console.error);
    },
    [makeRequest]
  );

  const pressKey = useCallback(
    (key) => makeRequest("/system/keyboardType", { key }).catch(console.error),
    [makeRequest]
  );

  // Battery: initial read + poll every 60s while connected
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const serviceUrl = localStorage.getItem("serviceUrl");
    if (!token || !serviceUrl) return;
    system("battery");
    const id = setInterval(() => system("battery"), 60000);
    return () => clearInterval(id);
  }, [system]);

  return { makeRequest, media, system, setKeyboardLight, typeText, pressKey, batteryLevel };
}

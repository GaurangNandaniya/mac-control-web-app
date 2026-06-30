import { useState, useEffect, useCallback } from "react";
import axios from "axios";

export default function useMacApi(isOnline = true) {
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

  const getMediaStatus = useCallback(
    () => makeRequest("/media/status").catch(() => null),
    [makeRequest]
  );

  const setVolume = useCallback(
    (level) => {
      const clamped = Math.max(0, Math.min(100, Math.round(Number(level) || 0)));
      return makeRequest(`/media/volume-set/${clamped}`).catch(console.error);
    },
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
    (key, modifiers = []) =>
      makeRequest("/system/pressKey", { key, modifiers }).catch(console.error),
    [makeRequest]
  );

  // Tap-to-click on the screen stream: normalized (rx, ry) → left click on Mac.
  const mouseClick = useCallback(
    (rx, ry) => makeRequest("/system/mouse-click", { rx, ry }).catch(console.error),
    [makeRequest]
  );

  // Intruder captures (capture-and-lock) gallery.
  const getIntruders = useCallback(
    () => makeRequest("/system/intruders/list").catch(() => null),
    [makeRequest]
  );
  const deleteIntruder = useCallback(
    (session) => makeRequest("/system/intruders/delete", { session }).catch(console.error),
    [makeRequest]
  );

  // File transfer (shared folder ~/Desktop/MacController).
  const uploadFile = useCallback(
    (file, onProgress) => {
      const form = new FormData();
      form.append("file", file);
      return makeRequest("/files/upload", form, {
        onUploadProgress: (e) =>
          onProgress && e.total && onProgress(Math.round((e.loaded / e.total) * 100)),
      });
    },
    [makeRequest]
  );
  const listFiles = useCallback(
    () => makeRequest("/files/list").catch(() => null),
    [makeRequest]
  );
  const deleteFile = useCallback(
    (name) => makeRequest("/files/delete", { name }).catch(console.error),
    [makeRequest]
  );

  // Launch a Mac app by driving Spotlight: ⌘Space → type name → Enter.
  // Delays give Spotlight time to open and resolve the top hit before launch.
  const launchApp = useCallback(
    async (name) => {
      if (!name) return;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      await pressKey("space", ["cmd"]); // open Spotlight
      await wait(350);
      await typeText(name);
      await wait(600); // let Spotlight settle on the top result
      await pressKey("enter");
    },
    [pressKey, typeText]
  );

  // Battery: initial read + poll every 60s, but only while the Mac is
  // reachable. The effect re-runs when isOnline flips, so reconnecting
  // triggers a fresh battery read automatically and we don't hammer a
  // dead server while offline.
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const serviceUrl = localStorage.getItem("serviceUrl");
    if (!token || !serviceUrl || !isOnline) return;
    system("battery");
    const id = setInterval(() => system("battery"), 60000);
    return () => clearInterval(id);
  }, [system, isOnline]);

  return {
    makeRequest, media, getMediaStatus, setVolume, system,
    setKeyboardLight, typeText, pressKey, mouseClick,
    getIntruders, deleteIntruder,
    uploadFile, listFiles, deleteFile, launchApp, batteryLevel,
  };
}

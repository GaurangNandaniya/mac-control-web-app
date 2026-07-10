import { useEffect, useState } from "react";

// Learns the server OS (macOS vs Windows) + capability flags from
// /system/platform so the UI can adapt: keyboard symbols, "Mac"/"PC" wording,
// default app list, and hiding controls the OS can't do (e.g. keyboard
// backlight on Windows). Result is cached per device in localStorage so a
// returning user renders the correct UI immediately (no flicker), then it
// refreshes in the background.

const DEFAULT = {
  os: "macOS",
  platform: "darwin",
  capabilities: { keyboard_backlight: true },
};

const cacheKey = () => `server_platform_${localStorage.getItem("serviceUrl") || ""}`;

const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(cacheKey())) || null;
  } catch {
    return null;
  }
};

export default function usePlatform(makeRequest, isOnline) {
  const [info, setInfo] = useState(() => readCache() || DEFAULT);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    makeRequest("/system/platform")
      .then((d) => {
        if (cancelled || !d || d.status !== "success") return;
        const next = {
          os: d.os || DEFAULT.os,
          platform: d.platform || DEFAULT.platform,
          capabilities: d.capabilities || {},
        };
        setInfo(next);
        try {
          localStorage.setItem(cacheKey(), JSON.stringify(next));
        } catch {
          /* ignore quota/serialization issues */
        }
      })
      .catch(() => {
        /* keep cache/default — older servers without /system/platform stay on macOS */
      });
    return () => {
      cancelled = true;
    };
  }, [makeRequest, isOnline]);

  const isWindows = info.platform === "win32";
  return {
    ...info,
    isWindows,
    isMac: info.platform === "darwin",
    deviceLabel: isWindows ? "PC" : "Mac", // user-facing noun for the controlled machine
  };
}

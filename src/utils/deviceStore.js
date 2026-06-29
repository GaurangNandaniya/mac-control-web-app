import { jwtDecode } from "jwt-decode";

// Multi-Mac storage. The active device's creds stay in the original
// `authToken` / `serviceUrl` keys (every hook reads those directly), and a
// parallel `devices` list holds every paired Mac so we can switch between them.
const DEVICES_KEY = "devices";

export const deviceName = (token) => {
  try {
    return jwtDecode(token)?.device_name || "Mac";
  } catch {
    return "Mac";
  }
};

export const getDevices = () => {
  try {
    const list = JSON.parse(localStorage.getItem(DEVICES_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const saveDevices = (list) => localStorage.setItem(DEVICES_KEY, JSON.stringify(list));

export const getActiveServiceUrl = () => localStorage.getItem("serviceUrl");

const setActiveKeys = (authToken, serviceUrl) => {
  localStorage.setItem("authToken", authToken);
  localStorage.setItem("serviceUrl", serviceUrl);
};

// Add or update a paired Mac (keyed by serviceUrl) and make it active.
export const upsertDevice = ({ serviceUrl, authToken }) => {
  const list = getDevices().filter((d) => d.serviceUrl !== serviceUrl);
  list.push({ serviceUrl, authToken, name: deviceName(authToken), addedAt: Date.now() });
  saveDevices(list);
  setActiveKeys(authToken, serviceUrl);
};

export const setActiveDevice = (serviceUrl) => {
  const dev = getDevices().find((d) => d.serviceUrl === serviceUrl);
  if (!dev) return false;
  setActiveKeys(dev.authToken, dev.serviceUrl);
  return true;
};

// Remove a paired Mac; if it was active, fall back to another (or clear).
export const removeDevice = (serviceUrl) => {
  const remaining = getDevices().filter((d) => d.serviceUrl !== serviceUrl);
  saveDevices(remaining);
  if (getActiveServiceUrl() === serviceUrl) {
    if (remaining.length) {
      setActiveKeys(remaining[0].authToken, remaining[0].serviceUrl);
    } else {
      localStorage.removeItem("authToken");
      localStorage.removeItem("serviceUrl");
    }
  }
  return remaining;
};

// Migration: a device paired before multi-Mac existed has active keys but no
// list entry. Register it so it shows up in the switcher.
export const ensureActiveRegistered = () => {
  const authToken = localStorage.getItem("authToken");
  const serviceUrl = localStorage.getItem("serviceUrl");
  if (authToken && serviceUrl && !getDevices().some((d) => d.serviceUrl === serviceUrl)) {
    const list = getDevices();
    list.push({ serviceUrl, authToken, name: deviceName(authToken), addedAt: Date.now() });
    saveDevices(list);
  }
};

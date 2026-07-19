import axios from "axios";
import { upsertDevice, inferKind } from "./deviceStore";

// Extract token + serviceUrl from a scanned/deep-link pairing URL.
export const parsePairingUrl = (text) => {
  const url = new URL(text);
  const token = url.searchParams.get("token");
  const serviceUrl = url.searchParams.get("serviceUrl");
  if (!token || !serviceUrl) throw new Error("missing pairing params");
  return { token, serviceUrl, kind: inferKind(serviceUrl) };
};

// Exchange a temp token for a permanent one, register the Mac in the device
// list, and make it active. Returns the permanent token.
export const pairWithMac = async (serviceUrl, token, deviceName) => {
  const res = await axios.post(
    `${serviceUrl}/auth/connect`,
    { device_name: deviceName || "My Mac" },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  upsertDevice({
    serviceUrl,
    authToken: res.data.token,
    kind: inferKind(serviceUrl),
  });
  return res.data.token;
};

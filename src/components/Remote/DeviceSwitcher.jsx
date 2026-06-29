import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { ChevronDown, Check, Plus, Trash2, X } from "lucide-react";
import QrScanner from "../Connect/QrScanner";
import {
  getDevices,
  getActiveServiceUrl,
  setActiveDevice,
  removeDevice,
  ensureActiveRegistered,
  deviceName as nameOf,
} from "../../utils/deviceStore";
import { pairWithMac, parsePairingUrl } from "../../utils/pairing";
import { haptic } from "../../utils/haptic";

const DeviceSwitcher = () => {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [scanned, setScanned] = useState(null); // {token, serviceUrl} after a scan
  const [pairing, setPairing] = useState(false);
  const [newName, setNewName] = useState("My Mac");
  const [error, setError] = useState("");
  // Migrate any pre-multi-Mac pairing into the list before reading it.
  const [devices, setDevices] = useState(() => {
    ensureActiveRegistered();
    return getDevices();
  });
  const navigate = useNavigate();

  const active = getActiveServiceUrl();
  const activeName = (() => {
    const token = localStorage.getItem("authToken");
    return token ? nameOf(token) : "Mac";
  })();

  const switchTo = (serviceUrl) => {
    haptic();
    if (serviceUrl === active) {
      setOpen(false);
      return;
    }
    if (setActiveDevice(serviceUrl)) window.location.reload();
  };

  const remove = (serviceUrl) => {
    haptic();
    const remaining = removeDevice(serviceUrl);
    setDevices(remaining);
    if (!remaining.length) {
      navigate("/connect");
    } else if (serviceUrl === active) {
      window.location.reload(); // fell back to another device
    }
  };

  const openAdd = () => {
    setError("");
    setScanned(null);
    setNewName("My Mac");
    setAdding(true);
    setOpen(false);
  };

  const closeAdd = () => {
    setAdding(false);
    setScanned(null);
    setPairing(false);
    setError("");
  };

  // Scan only captures the pairing info + stops the camera; pairing happens
  // after the user confirms the name on the next step.
  const handleScan = (text) => {
    try {
      const parsed = parsePairingUrl(text);
      setScanned(parsed);
      setError("");
    } catch {
      setError("That QR isn't a valid Mac pairing code.");
    }
  };

  const confirmAdd = async () => {
    if (!scanned) return;
    setPairing(true);
    setError("");
    try {
      await pairWithMac(scanned.serviceUrl, scanned.token, newName.trim() || "My Mac");
      window.location.reload(); // load the newly-added (now active) Mac
    } catch (e) {
      if (!e.response) {
        // No HTTP response = couldn't reach the Mac (usually an untrusted cert
        // or it's not on the same Wi-Fi). Each Mac has its own mkcert CA.
        setError(
          `Couldn't reach ${scannedHost || "that Mac"}. Make sure it's on the same Wi-Fi, and that this phone trusts its certificate (AirDrop that Mac's mkcert rootCA.pem and enable Full Trust).`
        );
      } else {
        setError(`Pairing failed (${e.response.status}). The QR may have expired — rescan a fresh one.`);
      }
      setPairing(false);
    }
  };

  const scannedHost = (() => {
    try {
      return scanned ? new URL(scanned.serviceUrl).hostname : "";
    } catch {
      return "";
    }
  })();

  return (
    <div className="device-switcher">
      <button
        className="device-switcher__btn"
        onClick={() => {
          haptic();
          setOpen((o) => !o);
        }}
      >
        <span className="app-header__name">{activeName}</span>
        <ChevronDown size={16} strokeWidth={1.8} />
      </button>

      {open && (
        <>
          <div className="device-switcher__backdrop" onClick={() => setOpen(false)} />
          <div className="device-switcher__menu">
            {devices.map((d) => (
              <div key={d.serviceUrl} className="device-row">
                <button className="device-row__pick" onClick={() => switchTo(d.serviceUrl)}>
                  <span className="device-row__check">
                    {d.serviceUrl === active && <Check size={14} strokeWidth={2.4} />}
                  </span>
                  <span className="device-row__name">{d.name}</span>
                </button>
                <button
                  className="device-row__del"
                  aria-label={`Remove ${d.name}`}
                  onClick={() => remove(d.serviceUrl)}
                >
                  <Trash2 size={14} strokeWidth={1.8} />
                </button>
              </div>
            ))}
            <button className="device-add" onClick={openAdd}>
              <Plus size={15} strokeWidth={2} />
              Add another Mac
            </button>
          </div>
        </>
      )}

      {adding &&
        createPortal(
          <div className="device-add-overlay">
            <div className="connect-card device-add-card">
              <div className="stream-header">
                <h3>{scanned ? "Name this Mac" : "Scan the Mac's QR"}</h3>
                <button className="header-icon-btn" aria-label="Close" onClick={closeAdd}>
                  <X size={18} strokeWidth={1.8} />
                </button>
              </div>

              {!scanned ? (
                <>
                  <p className="hint">Open the QR on the Mac you want to add, then scan it.</p>
                  <QrScanner onResult={handleScan} onCancel={closeAdd} />
                </>
              ) : (
                <>
                  <p className="hint">
                    Found a Mac{scannedHost ? ` at ${scannedHost}` : ""}. Give it a name, then add it.
                  </p>
                  <input
                    className="text-input"
                    type="text"
                    value={newName}
                    placeholder="Name this Mac"
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <button className="btn-accent btn-block" disabled={pairing} onClick={confirmAdd}>
                    {pairing ? "Adding…" : "Add this Mac"}
                  </button>
                  <button
                    className="btn-ghost btn-block"
                    disabled={pairing}
                    onClick={() => {
                      setScanned(null);
                      setError("");
                    }}
                  >
                    Rescan
                  </button>
                </>
              )}

              {error && <div className="error-message">{error}</div>}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default DeviceSwitcher;

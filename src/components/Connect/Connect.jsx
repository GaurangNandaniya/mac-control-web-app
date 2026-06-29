import { useContext, useState } from "react";
import { useNavigate } from "react-router";
import { QrCode } from "lucide-react";
import AppContext from "../../context";
import QrScanner from "./QrScanner";
import axios from "axios";

const Connect = () => {
  const appContext = useContext(AppContext);
  const [showLoading, setShowLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deviceName, setDeviceName] = useState("My Mac");
  const [scanning, setScanning] = useState(false);
  const navigate = useNavigate();

  // Exchange a temp token for a permanent one and store the pairing.
  // Shared by the deep-link "Connect" button and the in-app QR scanner.
  const pairWithMac = async (serviceUrl, token) => {
    if (!serviceUrl || !token) return;
    try {
      setError(null);
      setShowLoading(true);
      const response = await axios.post(
        `${serviceUrl}/auth/connect`,
        { device_name: deviceName },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      localStorage.setItem("authToken", response.data.token);
      localStorage.setItem("serviceUrl", serviceUrl);
      navigate("/remote");
    } catch (e) {
      console.log(e);
      setError(JSON.stringify(e?.response?.data || e.message));
    } finally {
      setShowLoading(false);
    }
  };

  const handleScanResult = (text) => {
    setScanning(false);
    try {
      const url = new URL(text);
      const token = url.searchParams.get("token");
      const serviceUrl = url.searchParams.get("serviceUrl");
      if (!token || !serviceUrl) throw new Error("missing params");
      pairWithMac(serviceUrl, token);
    } catch {
      setError("That QR isn't a valid Mac pairing code.");
    }
  };

  return (
    <div className="connect">
      <div className="connect-card">
        <h1 className="connect-title">Connect to your Mac</h1>

        {showLoading ? (
          <p className="hint">Connecting…</p>
        ) : scanning ? (
          <QrScanner onResult={handleScanResult} onCancel={() => setScanning(false)} />
        ) : (
          <>
            <input
              className="text-input"
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Device name"
            />

            {appContext.serviceUrl && (
              <button
                className="btn-accent btn-block"
                onClick={() => pairWithMac(appContext.serviceUrl, appContext.token)}
              >
                Connect
              </button>
            )}

            <button className="btn-ghost btn-block" onClick={() => setScanning(true)}>
              <QrCode size={16} strokeWidth={1.8} />
              Scan QR to pair
            </button>
            <p className="hint">
              Scan the QR shown on your Mac. Use this if you opened the app from your home screen.
            </p>
          </>
        )}

        {error && <div className="error-message">{error}</div>}
      </div>
    </div>
  );
};

export default Connect;

import { BatteryMedium, Power, RefreshCw } from "lucide-react";
import { jwtDecode } from "jwt-decode";

const deviceName = () => {
  try {
    return jwtDecode(localStorage.getItem("authToken"))?.device_name || "Mac";
  } catch {
    return "Mac";
  }
};

const Header = ({ batteryLevel, onRefreshBattery, onDisconnect }) => (
  <header className="app-header">
    <span className="app-header__name">{deviceName()}</span>
    <div className="app-header__right">
      <span className="battery-pill">
        <BatteryMedium size={16} strokeWidth={1.8} />
        {batteryLevel !== null ? `${batteryLevel}%` : "—"}
        <button className="battery-sync" aria-label="Refresh battery" onClick={onRefreshBattery}>
          <RefreshCw size={13} strokeWidth={2} />
        </button>
      </span>
      <button className="header-icon-btn" aria-label="Disconnect" onClick={onDisconnect}>
        <Power size={18} strokeWidth={1.8} />
      </button>
    </div>
  </header>
);

export default Header;

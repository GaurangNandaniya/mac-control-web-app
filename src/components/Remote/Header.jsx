import { BatteryMedium, Power } from "lucide-react";
import { jwtDecode } from "jwt-decode";

const deviceName = () => {
  try {
    return jwtDecode(localStorage.getItem("authToken"))?.device_name || "Mac";
  } catch {
    return "Mac";
  }
};

const Header = ({ batteryLevel, onDisconnect }) => (
  <header className="app-header">
    <span className="app-header__name">{deviceName()}</span>
    <div className="app-header__right">
      {batteryLevel !== null && (
        <span className="battery-pill">
          <BatteryMedium size={16} strokeWidth={1.8} /> {batteryLevel}%
        </span>
      )}
      <button className="header-icon-btn" aria-label="Disconnect" onClick={onDisconnect}>
        <Power size={18} strokeWidth={1.8} />
      </button>
    </div>
  </header>
);

export default Header;

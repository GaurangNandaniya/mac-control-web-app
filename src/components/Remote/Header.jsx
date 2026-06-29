import { BatteryMedium, Power, RefreshCw } from "lucide-react";
import DeviceSwitcher from "./DeviceSwitcher";

const connLabel = (status, latency) => {
  if (status === "online") return latency != null ? `${latency} ms` : "Online";
  if (status === "offline") return "Offline";
  return "Connecting…";
};

const Header = ({ batteryLevel, onRefreshBattery, onDisconnect, connStatus, connLatency }) => (
  <header className="app-header">
    <div className="app-header__name-wrap">
      <DeviceSwitcher />
      <span
        className={`conn-pill conn-pill--${connStatus || "checking"}`}
        title={connLabel(connStatus, connLatency)}
      >
        <span className="conn-dot" />
        <span className="conn-pill__text">{connLabel(connStatus, connLatency)}</span>
      </span>
    </div>
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

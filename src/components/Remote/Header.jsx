import { BatteryMedium, Power, RefreshCw, Menu, Sun, Moon } from "lucide-react";
import DeviceSwitcher from "./DeviceSwitcher";
import useTheme from "./useTheme";

const connLabel = (status, latency) => {
  if (status === "online") return latency != null ? `${latency} ms` : "Online";
  if (status === "offline") return "Offline";
  return "Connecting…";
};

const Header = ({ onMenu, batteryLevel, onRefreshBattery, onDisconnect, connStatus, connLatency, onRetryPing }) => {
  const { theme, toggle } = useTheme();
  return (
    <header className="app-header">
      <div className="app-header__name-wrap">
        <button className="header-icon-btn header-menu-btn" aria-label="Sections" onClick={onMenu}>
          <Menu size={18} strokeWidth={1.8} />
        </button>
        <div className="app-header__id-col">
          <DeviceSwitcher />
          <button
            className={`conn-pill conn-pill--${connStatus || "checking"} conn-pill--btn`}
            title="Tap to re-check connection"
            aria-label="Re-check connection"
            onClick={onRetryPing}
          >
            <span className="conn-dot" />
            <span className="conn-pill__text">{connLabel(connStatus, connLatency)}</span>
            <RefreshCw size={12} strokeWidth={2} className="conn-pill__retry" />
          </button>
        </div>
      </div>
      <div className="app-header__right">
        <button
          className="header-icon-btn"
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={toggle}
        >
          {theme === "dark" ? <Sun size={18} strokeWidth={1.8} /> : <Moon size={18} strokeWidth={1.8} />}
        </button>
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
};

export default Header;

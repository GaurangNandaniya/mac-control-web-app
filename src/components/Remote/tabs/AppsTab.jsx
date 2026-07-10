import { useEffect, useState } from "react";
import { AppWindow, Plus, Trash2, Pencil, Check } from "lucide-react";
import SectionLabel from "../ui/SectionLabel";
import { haptic } from "../../../utils/haptic";

// Per-OS defaults + storage, so a Mac and a Windows PC each keep their own list
// with sensible starting apps (all names resolvable by Spotlight / Start search).
const DEFAULTS_BY_OS = {
  macOS: ["Safari", "Notes", "Calendar", "Music", "Terminal", "System Settings"],
  Windows: ["Notepad", "Calculator", "Snipping Tool", "File Explorer", "Settings", "Task Manager"],
};
const keyFor = (os) => `appLauncher_apps_${os}`;

const loadApps = (os) => {
  try {
    const raw = localStorage.getItem(keyFor(os));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    // Migrate the pre-OS-split list (used only "appLauncher_apps") for Mac users.
    if (os === "macOS") {
      const legacy = localStorage.getItem("appLauncher_apps");
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return DEFAULTS_BY_OS[os] || DEFAULTS_BY_OS.macOS;
};

// One-tap app launcher. Tiles call the server's launch-app endpoint, which does
// the OS-appropriate launch (macOS `open -a`, Windows Start search). The list is
// user-editable and lives in localStorage.
const AppsTab = ({ launchApp, platform }) => {
  const os = platform?.os || "macOS";
  const [apps, setApps] = useState(() => loadApps(os));
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");

  // Reload when the detected OS changes (platform resolves after mount, or the
  // user switches to a different-OS device).
  useEffect(() => {
    setApps(loadApps(os));
  }, [os]);

  // Write-through so we never persist a stale list to a just-switched OS key.
  const persist = (next) => {
    setApps(next);
    try {
      localStorage.setItem(keyFor(os), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const addApp = () => {
    const name = newName.trim();
    if (!name) return;
    if (!apps.some((a) => a.toLowerCase() === name.toLowerCase())) {
      persist([...apps, name]);
    }
    setNewName("");
  };

  const removeApp = (name) => persist(apps.filter((a) => a !== name));

  return (
    <div>
      <div className="apps-head">
        <SectionLabel>Launch App</SectionLabel>
        <button
          className={`header-icon-btn${editing ? " is-active" : ""}`}
          aria-label={editing ? "Done editing" : "Edit apps"}
          onClick={() => {
            haptic();
            setEditing((e) => !e);
          }}
        >
          {editing ? <Check size={16} strokeWidth={1.8} /> : <Pencil size={16} strokeWidth={1.8} />}
        </button>
      </div>

      <div className="apps-grid">
        {apps.map((name) => (
          <button
            key={name}
            type="button"
            className="tile app-tile"
            onClick={() => {
              haptic();
              if (editing) removeApp(name);
              else launchApp(name);
            }}
          >
            {editing ? (
              <Trash2 size={20} strokeWidth={1.8} className="app-tile__del" />
            ) : (
              <AppWindow size={20} strokeWidth={1.8} />
            )}
            <span className="tile-label">{name}</span>
          </button>
        ))}
      </div>

      {editing && (
        <div className="apps-add">
          <input
            className="text-input"
            type="text"
            placeholder="App name (e.g. Slack)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addApp()}
          />
          <button className="btn-accent" onClick={addApp} aria-label="Add app">
            <Plus size={18} strokeWidth={2} />
          </button>
        </div>
      )}

      <p className="hint">
        Tiles open apps via your computer’s search — Spotlight on macOS, Start on Windows. Use the
        name it shows (e.g. “System Settings” on Mac, “Notepad” on Windows).
      </p>
    </div>
  );
};

export default AppsTab;

import { useEffect, useState } from "react";
import { AppWindow, Plus, Trash2, Pencil, Check } from "lucide-react";
import SectionLabel from "../ui/SectionLabel";
import { haptic } from "../../../utils/haptic";

const STORAGE_KEY = "appLauncher_apps";
const DEFAULT_APPS = ["Safari", "Notes", "Calendar", "Music", "Terminal", "System Settings"];

const loadApps = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APPS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_APPS;
  } catch {
    return DEFAULT_APPS;
  }
};

// One-tap app launcher. Tiles call the server's launch-app endpoint, which does
// the OS-appropriate launch (macOS `open -a`, Windows Start search). The list is
// user-editable and lives in localStorage.
const AppsTab = ({ launchApp }) => {
  const [apps, setApps] = useState(loadApps);
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
  }, [apps]);

  const addApp = () => {
    const name = newName.trim();
    if (!name) return;
    if (!apps.some((a) => a.toLowerCase() === name.toLowerCase())) {
      setApps((prev) => [...prev, name]);
    }
    setNewName("");
  };

  const removeApp = (name) => setApps((prev) => prev.filter((a) => a !== name));

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

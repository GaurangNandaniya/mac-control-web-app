import { useEffect, useState } from "react";
import { Pencil, Check, Star } from "lucide-react";
import SectionLabel from "../ui/SectionLabel";
import { haptic } from "../../../utils/haptic";

const STORAGE_KEY = "favorites_pinned";
const DEFAULTS = ["play-pause", "lock", "watch-screen", "mute", "sleep", "brightness-up"];

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
};

// Home dashboard: a user-pinned grid of one-tap actions drawn from the catalog.
// Normal mode runs the action; edit mode shows the whole catalog to pin/unpin.
const FavoritesTab = ({ catalog }) => {
  const [pinned, setPinned] = useState(load);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
  }, [pinned]);

  const byId = Object.fromEntries(catalog.map((a) => [a.id, a]));
  const pinnedActions = pinned.map((id) => byId[id]).filter(Boolean);

  const togglePin = (id) =>
    setPinned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div>
      <div className="apps-head">
        <SectionLabel>{editing ? "Pin actions" : "Favorites"}</SectionLabel>
        <button
          className={`header-icon-btn${editing ? " is-active" : ""}`}
          aria-label={editing ? "Done editing" : "Edit favorites"}
          onClick={() => {
            haptic();
            setEditing((e) => !e);
          }}
        >
          {editing ? <Check size={16} strokeWidth={1.8} /> : <Pencil size={16} strokeWidth={1.8} />}
        </button>
      </div>

      {editing ? (
        <div className="fav-grid">
          {catalog.map(({ id, label, icon: Icon }) => {
            const isPinned = pinned.includes(id);
            return (
              <button
                key={id}
                type="button"
                className={`tile${isPinned ? " tile--active" : ""}`}
                onClick={() => {
                  haptic();
                  togglePin(id);
                }}
              >
                {isPinned && <Star size={12} strokeWidth={2} className="fav-pin-mark" />}
                {Icon && <Icon size={20} strokeWidth={1.8} />}
                <span className="tile-label">{label}</span>
              </button>
            );
          })}
        </div>
      ) : pinnedActions.length === 0 ? (
        <p className="hint">No favorites yet — tap the pencil to pin your most-used controls.</p>
      ) : (
        <div className="fav-grid">
          {pinnedActions.map(({ id, label, icon: Icon, run }) => (
            <button
              key={id}
              type="button"
              className="tile"
              onClick={() => {
                haptic();
                run();
              }}
            >
              {Icon && <Icon size={20} strokeWidth={1.8} />}
              <span className="tile-label">{label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default FavoritesTab;

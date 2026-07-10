import { useState } from "react";
import { KEY_ROWS, MOD_LABELS, modLabel } from "./keyboardLayout";

// Sticky modifiers: tap a modifier to arm (multiple allowed), then a key fires the
// combo and resets. Modifier labels adapt to the server OS (⌘⌥⌃ on macOS,
// Win/Alt/Ctrl on Windows); the values sent stay the same.
const OnScreenKeyboard = ({ pressKey, os = "macOS" }) => {
  const [armed, setArmed] = useState(() => new Set());
  const mods = MOD_LABELS[os] || MOD_LABELS.macOS;

  const toggleMod = (mod) =>
    setArmed((prev) => {
      const next = new Set(prev);
      if (next.has(mod)) next.delete(mod);
      else next.add(mod);
      return next;
    });

  const onKey = (value) => {
    pressKey(value, [...armed]);
    setArmed(new Set());
  };

  return (
    <div className="kbd">
      <p className="kbd-help">
        Tap a modifier ({mods.cmd} {mods.option} {mods.ctrl} {mods.shift}) then a key to send a
        shortcut. Multiple modifiers stack.
      </p>
      {KEY_ROWS.map((row, ri) => (
        <div className="kbd-row" key={ri}>
          {row.map((k, ki) => {
            const isMod = k.t === "mod";
            const isArmed = isMod && armed.has(k.mod);
            return (
              <button
                key={ki}
                className={`kbd-key${isMod ? " kbd-key--mod" : ""}${isArmed ? " is-armed" : ""}`}
                style={{ flexGrow: k.w || 1 }}
                onClick={() => (isMod ? toggleMod(k.mod) : onKey(k.value))}
              >
                {isMod ? modLabel(os, k.mod, k.label) : k.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default OnScreenKeyboard;

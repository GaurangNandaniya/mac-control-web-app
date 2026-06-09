import { useState } from "react";
import { KEY_ROWS } from "./keyboardLayout";

// Sticky modifiers: tap a modifier to arm (multiple allowed), then a key fires the
// combo and resets.
const OnScreenKeyboard = ({ pressKey }) => {
  const [armed, setArmed] = useState(() => new Set());

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
        Tap a modifier (⌘ ⌥ ⌃ ⇧) then a key to send a shortcut. Multiple modifiers stack.
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
                {k.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

export default OnScreenKeyboard;

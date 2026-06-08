# Full Keyboard + Key Combos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Press individual keys and modifier combos (⌘/⌥/⌃/⇧ + key, or a modifier alone) on the Mac from the phone, via a new server endpoint + a collapsible on-screen Mac keyboard.

**Architecture:** New server endpoint `POST /system/pressKey` drives macOS `System Events` (osascript) — `keystroke` for printable chars, `key code` for special/modifier keys, both with a `using {…}` modifier clause. Client adds an `OnScreenKeyboard` component (sticky armed-modifiers + Send-alone) toggled open inside the Input tab.

**Tech Stack:** Server — Flask, `subprocess`/`osascript`. Client — React 18, axios (via existing `useMacApi`).

**Repos:** Task 1 = **mac_controller** (`../mac_controller`). Tasks 2–5 = **mac-control-web-app** (this repo). Task 6 = both.

**Verification model:** No test runner. Server task verifies by route registration + a manual `curl` that triggers a real keypress on the Mac. Client tasks verify with `npm run lint` + build + visual/functional check on the phone.

**Spec:** `docs/superpowers/specs/2026-06-08-full-keyboard-key-combos-design.md`

---

## File Structure
```
mac_controller/
  src/controllers/system_controller.py   # MODIFY — add KEY_CODES, MODIFIER_PHRASES, /system/pressKey
mac-control-web-app/
  src/components/Remote/
    useMacApi.js                          # MODIFY — pressKey -> /system/pressKey {key, modifiers}
    keyboardLayout.js                     # CREATE — static Mac keyboard rows + mod symbols
    OnScreenKeyboard.jsx                  # CREATE — armed modifiers, Send-alone, help text, rows
    tabs/InputTab.jsx                     # MODIFY — keep text+quick keys; add toggle + keyboard
  src/App.css                             # MODIFY — keyboard + ghost-button styles
```

---

## Task 1: Server endpoint `POST /system/pressKey` (repo: mac_controller)

**Files:**
- Modify: `mac_controller/src/controllers/system_controller.py`

- [ ] **Step 1: Add the keycode + modifier maps** near the other module-level constants (after the existing `SPECIAL_KEYS` block).

```python
# macOS virtual key codes for non-printable keys + modifiers (for /system/pressKey)
KEY_CODES = {
    "esc": 53, "tab": 48, "return": 36, "enter": 36, "delete": 51, "backspace": 51,
    "forwarddelete": 117, "space": 49, "caps": 57,
    "left": 123, "right": 124, "down": 125, "up": 126,
    "f1": 122, "f2": 120, "f3": 99, "f4": 118, "f5": 96, "f6": 97, "f7": 98,
    "f8": 100, "f9": 101, "f10": 109, "f11": 103, "f12": 111,
    "cmd": 55, "option": 58, "ctrl": 59, "shift": 56,
}

# Modifier name -> AppleScript phrase
MODIFIER_PHRASES = {
    "cmd": "command down", "option": "option down",
    "ctrl": "control down", "shift": "shift down",
}
```

- [ ] **Step 2: Add the endpoint** after the `keyboard_type` route.

```python
@system_bp.route('/pressKey', methods=['POST'])
def press_key():
    """Press a key (optionally with modifiers) on the Mac via macOS System Events.

    Body: {"key": "c", "modifiers": ["cmd", "shift"]}
      - key: a single printable char ("c", "1", "/") OR a named key in KEY_CODES.
      - modifiers: any of cmd/option/ctrl/shift (optional).
    osascript handles ALL modifiers reliably (unlike pynput's option/ctrl on macOS).
    """
    try:
        data = request.get_json(silent=True) or {}
        key = data.get("key")
        modifiers = data.get("modifiers") or []

        if not isinstance(key, str) or key == "":
            return jsonify({"status": "error", "error": "Missing 'key'"}), 400

        phrases = [MODIFIER_PHRASES[m] for m in modifiers if m in MODIFIER_PHRASES]
        using = f" using {{{', '.join(phrases)}}}" if phrases else ""

        if key.lower() in KEY_CODES:
            action = f"key code {KEY_CODES[key.lower()]}{using}"
        elif len(key) == 1:
            ch = key.replace("\\", "\\\\").replace('"', '\\"')  # escape for the AppleScript string literal
            action = f'keystroke "{ch}"{using}'
        else:
            return jsonify({"status": "error", "error": f"Unknown key: {key}"}), 400

        script = f'tell application "System Events" to {action}'
        subprocess.run(["osascript", "-e", script], capture_output=True)
        logger.info(f"pressKey: {modifiers}+{key}")
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Error in pressKey: {str(e)}")
        return jsonify({"status": "error", "error": str(e)}), 500
```

(`request`, `jsonify`, `subprocess`, and `logger` are already imported in this file.)

- [ ] **Step 3: Verify syntax + route registration**

Run:
```bash
cd ../mac_controller
./venv/bin/python -c "import ast; ast.parse(open('src/controllers/system_controller.py').read()); print('syntax OK')"
PYTHONPATH=. ./venv/bin/python -c "from src.server import create_app; print([str(r) for r in create_app().url_map.iter_rules() if 'pressKey' in str(r)])"
```
Expected: `syntax OK` and `['/system/pressKey']`.

- [ ] **Step 4: Manual smoke test** (server running, real keypress)

Restart the menu-bar app, focus a text field on the Mac (e.g. TextEdit), then:
```bash
TOKEN=…   # a valid permanent JWT
curl -k -s -X POST https://localhost:8080/system/pressKey \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"key":"a"}'          # types "a"
curl -k -s -X POST https://localhost:8080/system/pressKey \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"key":"a","modifiers":["cmd"]}'   # ⌘A (select all)
```
Expected: `{"status":"success"}` and the action happens on the Mac.

- [ ] **Step 5: Commit (in mac_controller)**

```bash
cd ../mac_controller
git add src/controllers/system_controller.py
git commit -m "feat(system): /system/pressKey — press keys/modifier combos via System Events"
```

---

## Task 2: Client `pressKey` → new route (repo: mac-control-web-app)

**Files:**
- Modify: `src/components/Remote/useMacApi.js`

- [ ] **Step 1: Repoint `pressKey`** — replace the existing `pressKey` definition:

```js
  const pressKey = useCallback(
    (key, modifiers = []) =>
      makeRequest("/system/pressKey", { key, modifiers }).catch(console.error),
    [makeRequest]
  );
```

(The existing Enter/Backspace/Tab quick buttons call `pressKey("enter")` etc. — now routed through `/system/pressKey` with no modifiers. `typeText` is unchanged.)

- [ ] **Step 2: Verify + commit**

Run: `npm run lint` → clean.
```bash
git add src/components/Remote/useMacApi.js
git commit -m "feat(remote): pressKey -> /system/pressKey with modifiers"
```

---

## Task 3: Keyboard layout data (repo: mac-control-web-app)

**Files:**
- Create: `src/components/Remote/keyboardLayout.js`

- [ ] **Step 1: Create the layout module**

```js
// Static Mac keyboard layout for OnScreenKeyboard.
// Key kinds: char {label,value}; special {label,value}; mod {label,mod}. `w` = flex-grow weight.
const C = (label, value) => ({ t: "char", label, value });
const S = (label, value, w = 1) => ({ t: "special", label, value, w });
const M = (label, mod, w = 1) => ({ t: "mod", label, mod, w });

export const KEY_ROWS = [
  [S("esc", "esc", 1.2), S("F1", "f1"), S("F2", "f2"), S("F3", "f3"), S("F4", "f4"),
   S("F5", "f5"), S("F6", "f6"), S("F7", "f7"), S("F8", "f8"), S("F9", "f9"),
   S("F10", "f10"), S("F11", "f11"), S("F12", "f12")],
  [C("`", "`"), C("1", "1"), C("2", "2"), C("3", "3"), C("4", "4"), C("5", "5"),
   C("6", "6"), C("7", "7"), C("8", "8"), C("9", "9"), C("0", "0"), C("-", "-"),
   C("=", "="), S("⌫", "backspace", 1.6)],
  [S("tab", "tab", 1.5), C("Q", "q"), C("W", "w"), C("E", "e"), C("R", "r"), C("T", "t"),
   C("Y", "y"), C("U", "u"), C("I", "i"), C("O", "o"), C("P", "p"), C("[", "["),
   C("]", "]"), C("\\", "\\")],
  [S("caps", "caps", 1.7), C("A", "a"), C("S", "s"), C("D", "d"), C("F", "f"), C("G", "g"),
   C("H", "h"), C("J", "j"), C("K", "k"), C("L", "l"), C(";", ";"), C("'", "'"),
   S("return", "enter", 1.8)],
  [M("⇧", "shift", 2), C("Z", "z"), C("X", "x"), C("C", "c"), C("V", "v"), C("B", "b"),
   C("N", "n"), C("M", "m"), C(",", ","), C(".", "."), C("/", "/"), M("⇧", "shift", 2)],
  [M("⌃", "ctrl"), M("⌥", "option"), M("⌘", "cmd"), S("space", "space", 5),
   M("⌘", "cmd"), M("⌥", "option"), S("←", "left"), S("↑", "up"), S("↓", "down"), S("→", "right")],
];

export const MOD_SYMBOL = { cmd: "⌘", option: "⌥", ctrl: "⌃", shift: "⇧" };
```

- [ ] **Step 2: Verify + commit**

Run: `npm run lint` → clean.
```bash
git add src/components/Remote/keyboardLayout.js
git commit -m "feat(remote): on-screen keyboard layout data"
```

---

## Task 4: `OnScreenKeyboard` component + styles (repo: mac-control-web-app)

**Files:**
- Create: `src/components/Remote/OnScreenKeyboard.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Create the component**

```jsx
import { useState } from "react";
import { KEY_ROWS, MOD_SYMBOL } from "./keyboardLayout";

// Sticky modifiers: tap a modifier to arm (multiple allowed), then a key fires the combo
// and resets. When modifiers are armed, "Send" presses them alone.
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

  const sendModifiersAlone = () => {
    const arr = [...armed];
    if (arr.length === 0) return;
    const [first, ...rest] = arr;
    pressKey(first, rest); // press the first modifier key while the rest are held
    setArmed(new Set());
  };

  const armedLabel = [...armed].map((m) => MOD_SYMBOL[m]).join("");

  return (
    <div className="kbd">
      <p className="kbd-help">
        Tap a modifier (⌘ ⌥ ⌃ ⇧) then a key for a shortcut — or tap Send for the modifier(s) alone.
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
      {armed.size > 0 && (
        <button className="kbd-send" onClick={sendModifiersAlone}>
          Send {armedLabel}
        </button>
      )}
    </div>
  );
};

export default OnScreenKeyboard;
```

- [ ] **Step 2: Add keyboard styles** to the end of `src/App.css`

```css
/* ===== On-screen keyboard ===== */
.kbd { margin-top: 12px; }
.kbd-help { color: var(--text-secondary); font-size: 11px; line-height: 1.35; margin: 0 2px 10px; }
.kbd-row { display: flex; gap: 4px; margin-bottom: 4px; }
.kbd-key {
  flex: 1 1 0; min-width: 0; padding: 9px 2px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 7px; color: var(--text); font-size: 11px; cursor: pointer;
  transition: transform 0.06s ease;
}
.kbd-key:active { transform: scale(0.92); }
.kbd-key--mod { color: var(--text-tertiary); }
.kbd-key.is-armed { background: var(--accent-fill); border-color: var(--accent-border); color: var(--accent-text); }
.kbd-send {
  width: 100%; margin-top: 8px; padding: 11px;
  background: var(--accent); color: #fff; border: none; border-radius: var(--radius-btn);
  font-size: 14px; font-weight: 600; cursor: pointer;
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm run lint` → clean.
```bash
git add src/components/Remote/OnScreenKeyboard.jsx src/App.css
git commit -m "feat(remote): OnScreenKeyboard (sticky modifiers + send-alone + help)"
```

---

## Task 5: Wire the keyboard into the Input tab (repo: mac-control-web-app)

**Files:**
- Modify: `src/components/Remote/tabs/InputTab.jsx`
- Modify: `src/App.css`

- [ ] **Step 1: Replace `InputTab.jsx`** (keeps text box + Send + the 3 quick keys; adds the collapse toggle + keyboard)

```jsx
import { useState } from "react";
import { CornerDownLeft, Delete, ArrowRightToLine, Keyboard as KeyboardIcon } from "lucide-react";
import Tile from "../ui/Tile";
import SectionLabel from "../ui/SectionLabel";
import OnScreenKeyboard from "../OnScreenKeyboard";

const InputTab = ({ typeText, pressKey }) => {
  const [text, setText] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);

  const send = () => {
    if (text) {
      typeText(text);
      setText("");
    }
  };

  return (
    <div>
      <SectionLabel>Keyboard Type</SectionLabel>
      <p className="hint">Types into whatever is focused on the Mac.</p>
      <div className="row">
        <input
          className="text-input"
          type="text"
          value={text}
          placeholder="Type text to send…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button className="btn-accent" onClick={send}>Send</button>
      </div>
      <div className="row">
        <Tile icon={CornerDownLeft} label="Enter" onClick={() => pressKey("enter")} />
        <Tile icon={Delete} label="Backspace" onClick={() => pressKey("backspace")} />
        <Tile icon={ArrowRightToLine} label="Tab" onClick={() => pressKey("tab")} />
      </div>

      <button className="btn-ghost btn-block" onClick={() => setShowKeyboard((v) => !v)}>
        <KeyboardIcon size={16} strokeWidth={1.8} />
        {showKeyboard ? "Hide keyboard" : "Show full keyboard"}
      </button>
      {showKeyboard && <OnScreenKeyboard pressKey={pressKey} />}
    </div>
  );
};

export default InputTab;
```

(`Remote.jsx` already passes `pressKey={api.pressKey}` to `InputTab` — no change there.)

- [ ] **Step 2: Add the ghost-button style** to the end of `src/App.css`

```css
.btn-ghost {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-top: 12px; padding: 12px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-btn); color: var(--accent-text);
  font-size: 14px; font-weight: 600; cursor: pointer;
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm run lint` → clean.
```bash
git add src/components/Remote/tabs/InputTab.jsx src/App.css
git commit -m "feat(remote): collapsible full keyboard in the Input tab"
```

---

## Task 6: Final verification (both repos)

- [ ] **Step 1: Client lint + build**

Run (in `mac-control-web-app`): `npm run lint` (clean) and `npm run build` (succeeds).

- [ ] **Step 2: End-to-end on the phone**

Restart the Mac app. On the phone, Input tab:
- Collapsed view shows text box + Send + Enter/Backspace/Tab + "⌨ Show full keyboard".
- Expand → full keyboard + help line. Focus a Mac text field, type letters → they appear.
- **Combo:** tap ⌘ (highlights) → tap C; in Finder/an app, ⌘C copies. Tap ⌥ then ⌘ then I → ⌥⌘I fires. Modifiers reset after the key.
- **Modifier alone:** tap ⌘ → "Send ⌘" appears → tap it → ⌘ pressed alone (key code 55), armed clears.
- Arrows / F-keys work (e.g. ⌘+← ).

- [ ] **Step 3: Final commit (if any tweaks)**

```bash
git add -A && git commit -m "chore: full-keyboard polish"
```

---

## Self-Review (plan author)

- **Spec coverage:** server `/system/pressKey` printable+special+modifier handling, keycode map incl. modifier codes, safety (Task 1); client `pressKey` route (Task 2); layout incl. 4 separate arrows + dual shift/cmd (Task 3); armed-modifiers stacking + key-combo + Send-alone + help text (Task 4); collapsed-by-default toggle keeping text box + 3 quick keys (Task 5); verification incl. ⌥⌘I and ⌘-alone (Task 6). Covered.
- **Name consistency:** client special-key `value`s (`esc, f1..f12, backspace, enter, tab, space, caps, left/right/up/down`) and modifier names (`cmd/option/ctrl/shift`) all exist in the server `KEY_CODES`/`MODIFIER_PHRASES`. `pressKey(key, modifiers=[])` signature matches every call site (`onKey`, `sendModifiersAlone`, the 3 quick keys).
- **No placeholders:** every step has concrete code/commands.
- **Note:** at phone width a 14-key row renders ~22px keys (shrink-to-fit, no overflow). Acceptable per spec; revisit with horizontal-scroll rows if too small in practice.

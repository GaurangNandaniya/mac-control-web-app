# Full Keyboard + Key Combos — Design

Date: 2026-06-08
Repos: **mac_controller** (server: new endpoint) + **mac-control-web-app** (client: on-screen keyboard). ToDo #11.

## Goal
Let the user press individual keys and keyboard shortcuts on the Mac from the phone — single keys (letters, numbers, symbols, F1–F12, esc/tab/arrows…) and modifier combos (⌘/⌥/⌃/⇧ + key, e.g. ⌘C, ⌥F). This is distinct from the existing text-typing box (`/system/keyboardType`), which sends prose.

## Scope / non-goals
- Adds one server endpoint (`/system/pressKey`) and one client feature (a collapsible on-screen keyboard in the Input tab).
- The existing `/system/keyboardType` (text + simple keys via pynput) is unchanged.
- No new dependencies (server uses `osascript`; client uses existing React).

## Server — `POST /system/pressKey` (`src/controllers/system_controller.py`)

**Why osascript, not pynput:** pynput's ⌥/⌃ modifier combos are unreliable on macOS; macOS `System Events` handles all modifiers correctly. Matches the app's existing `subprocess.run(["osascript", ...])` pattern.

**Request body:**
```json
{ "key": "c", "modifiers": ["cmd", "shift"] }
```
- `key` (required): a single printable character (`"c"`, `"1"`, "`"`, `"="`, …) **or** a named special key (see map below).
- `modifiers` (optional): any of `"cmd"`, `"option"`, `"ctrl"`, `"shift"`.

**Logic:**
1. Map modifiers → AppleScript phrases: `cmd→command down`, `option→option down`, `ctrl→control down`, `shift→shift down`. Build `using {…}` (omit the clause if no modifiers).
2. Resolve the key:
   - If `key` is in the special-key code map → `key code <N> [using {…}]`.
   - Else if `len(key) == 1` → `keystroke "<char>" [using {…}]` (AppleScript handles the character + layout; shift modifier yields shifted symbols).
   - Else → `400 {"status":"error","error":"Unknown key"}`.
3. Run: `subprocess.run(["osascript", "-e", script])` — arg list, no shell.
4. Return `{"status":"success"}`; on exception `500`.

**Special-key code map** (macOS virtual key codes):
```
esc=53, tab=48, return/enter=36, delete/backspace=51, forwarddelete=117, space=49, caps=57,
left=123, right=124, down=125, up=126,
f1=122, f2=120, f3=99, f4=118, f5=96, f6=97, f7=98, f8=100, f9=101, f10=109, f11=103, f12=111,
cmd=55, option=58, ctrl=59, shift=56
```
(Client special-key `value`s match these names.) The **modifier codes let a modifier be pressed alone**: `{ "key": "cmd" }` → `key code 55`; `{ "key": "cmd", "modifiers": ["option"] }` → `key code 55 using {option down}` (presses ⌘ while ⌥ is held).

**Safety:** the printable char is constrained to length 1 and `"`/`\` are escaped before embedding in the AppleScript string (defense in depth — the script is already passed as a single argv, not via a shell). Modifiers validated against the allowed set; unknown → ignored or 400.

## Client — `mac-control-web-app`

**`useMacApi.js`:** change `pressKey` to target the new route with modifiers:
```js
const pressKey = (key, modifiers = []) =>
  makeRequest("/system/pressKey", { key, modifiers }).catch(console.error);
```
(`typeText` still → `/system/keyboardType { text }`. The existing Enter/Backspace/Tab quick buttons now route through `pressKey` with no modifiers.)

**`OnScreenKeyboard.jsx`** (new, in `components/Remote/`):
- Renders the full Mac keyboard as rows of keys from a static layout array. Key types:
  - `char` — `{ label: "Q", value: "q" }` (label shown upper, value lowercase; shift modifier handles caps/shifted symbols).
  - `special` — `{ label: "F1", value: "f1" }` / esc / tab / return / delete / space / arrows (← ↑ ↓ → as **4 separate keys**).
  - `modifier` — `{ label: "⌘", mod: "cmd" }` for ⌃ ⌥ ⌘ ⇧.
- Holds **armed modifiers** state (a Set — **multiple can be armed at once**, e.g. ⌥+⌘). Interaction:
  - Tap a **modifier** → toggle it in the armed set (highlight cognac when armed).
  - Tap any **char/special** key → `pressKey(value, [...armed])` (fires the full combo, e.g. ⌥⌘I), then **clear** the armed set (sticky-for-one-key).
  - **Send modifiers alone:** whenever ≥1 modifier is armed, a **"Send &lt;symbols&gt;"** button appears (e.g. "Send ⌘", "Send ⌥⌘"). Tapping it presses the armed modifier(s) with no other key — `pressKey(firstArmed, [...restArmed])` (first armed modifier becomes the key, the rest are held) — then clears. Covers "press ⌘ alone".
- **Help text:** a one-line hint always visible in the keyboard so the behavior is self-explanatory if forgotten, e.g. *"Tap a modifier (⌘ ⌥ ⌃ ⇧) then a key for a shortcut — or tap Send for the modifier(s) alone."*
- Layout rows: function (esc, F1–F12), number (` 1 2 3 4 5 6 7 8 9 0 - = ⌫), qwerty (tab Q…P [ ] \), home (caps A…L ; ' ↵), shift (⇧ Z…M , . / ⇧), bottom (⌃ ⌥ ⌘ space ⌘ ⌥ ← ↑ ↓ →).
- Styled with existing design tokens (small keys; modifier-armed = cognac fill/border). Horizontal scroll allowed if a row overflows at narrow widths.

**`InputTab.jsx`:**
- Keep the text box + Send (`typeText`) and the **Enter / Backspace / Tab** quick buttons (now via `pressKey`).
- Add a **"⌨ Show full keyboard"** toggle (local `useState(false)`, collapsed by default) that reveals `<OnScreenKeyboard pressKey={pressKey} />`. Toggle label flips to "Hide keyboard".
- `Remote.jsx` passes `api.pressKey` into `InputTab`.

## Behavior summary
- Every on-screen key tap = a key **press** on the Mac (not buffered text).
- Modifiers are sticky and **stack**: arm any number (⌥, ⌘, …), then the next key fires the full combo, then they reset. The armed highlight + help text make the current combo obvious.
- ⌘C = tap ⌘ → tap C → `keystroke "c" using {command down}`. ⌥⌘I = tap ⌥, ⌘, I.
- Modifier(s) **alone** = arm them → tap **Send** → presses just the modifiers (e.g. ⌘ alone → `key code 55`).

## Verification
- Server: `curl -k -X POST .../system/pressKey -H 'Authorization: Bearer …' -d '{"key":"c","modifiers":["cmd"]}'` triggers ⌘C on the Mac (focus a text field / use a known app). Try `{"key":"f3"}`, `{"key":"left","modifiers":["cmd"]}`.
- Client: collapsed Input tab stays clean (text + Send + 3 quick keys + toggle). Expand → full keyboard; arm ⌘, tap C → copies on the Mac; arrows/F-keys work; modifier highlight resets after one key.
- `npm run lint` clean; visual check on the phone (no row overflow / usable key sizes).

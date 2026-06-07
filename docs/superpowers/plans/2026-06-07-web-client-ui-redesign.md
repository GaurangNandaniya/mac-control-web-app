# Web Client UI Redesign ("Cognac Graphite") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the `mac-control-web-app` remote into a premium dark, tabbed UI with outlined icons — no behavior changes.

**Architecture:** Define design tokens as CSS variables; rebuild styling in `App.css` with token-based classes; extract API logic + battery polling into a `useMacApi` hook; split the long `Remote.jsx` into a sticky Header, a segmented TabBar, and four tab panels (Media/System/Input/Stream) plus small UI primitives. Restyle Connect + StreamViewer to match.

**Tech Stack:** React 18, Vite, axios, react-router, `lucide-react` (new, outlined icons).

**Verification model:** No test runner exists. Each task verifies with `npm run lint` (clean) and a visual check at a phone-width viewport in the browser (`npm run dev`). Behavior must match the current app exactly.

**Spec:** `docs/superpowers/specs/2026-06-07-web-client-ui-redesign-design.md`

---

## File Structure

```
src/
  index.css                          # MODIFY — :root design tokens + base
  App.css                            # MODIFY — token-based component classes (replace ad-hoc styles)
  components/Remote/
    Remote.jsx                       # MODIFY — header + tab bar + active tab (was 540-line monolith)
    useMacApi.js                     # CREATE — makeRequest, command helpers, battery state + 60s poll
    Header.jsx                       # CREATE — device name, battery pill, disconnect
    TabBar.jsx                       # CREATE — segmented control
    tabs/MediaTab.jsx                # CREATE
    tabs/SystemTab.jsx               # CREATE
    tabs/InputTab.jsx                # CREATE
    tabs/StreamTab.jsx               # CREATE
    ui/IconButton.jsx                # CREATE — circular icon button (idle / accent)
    ui/Tile.jsx                      # CREATE — rounded tile: icon + label (idle / active)
    ui/SectionLabel.jsx              # CREATE — uppercase section label
  components/Connect/Connect.jsx     # MODIFY — restyle
  components/StreamViewer/index.jsx  # MODIFY — restyle to match tokens
```

---

## Task 1: Dependency + design tokens

**Files:**
- Modify: `package.json` (via npm)
- Modify: `src/index.css`

- [ ] **Step 1: Install lucide-react**

Run: `npm install lucide-react`
Expected: added to `dependencies`, no errors.

- [ ] **Step 2: Replace `src/index.css` with tokens + base**

```css
:root {
  /* surfaces */
  --bg: #0a0a0c;
  --surface: rgba(255, 255, 255, 0.04);
  --surface-2: rgba(255, 255, 255, 0.06);
  --border: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.12);
  /* text */
  --text: #e9e9ee;
  --text-secondary: #6e6e78;
  --text-tertiary: #c7c7cf;
  /* cognac accent */
  --accent: #b5774b;
  --accent-text: #cf9b6e;
  --accent-fill: rgba(181, 119, 75, 0.14);
  --accent-border: rgba(181, 119, 75, 0.42);
  --accent-glow: rgba(181, 119, 75, 0.4);
  /* shape */
  --radius-card: 20px;
  --radius-tile: 16px;
  --radius-btn: 14px;
  --gap: 10px;

  font-family: -apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color-scheme: dark;
  color: var(--text);
  background-color: var(--bg);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root { min-height: 100%; background: var(--bg); }

body { padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom); }
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Expected: clean. Run `npm run dev`, open the app — background is near-black; nothing crashes.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/index.css
git commit -m "feat(ui): add lucide-react + Cognac Graphite design tokens"
```

---

## Task 2: UI primitives

**Files:**
- Create: `src/components/Remote/ui/SectionLabel.jsx`
- Create: `src/components/Remote/ui/IconButton.jsx`
- Create: `src/components/Remote/ui/Tile.jsx`

- [ ] **Step 1: `SectionLabel.jsx`**

```jsx
const SectionLabel = ({ children }) => (
  <div className="section-label">{children}</div>
);
export default SectionLabel;
```

- [ ] **Step 2: `IconButton.jsx`** — circular button; `variant` = "idle" | "accent"; `size` default 52.

```jsx
const IconButton = ({ icon: Icon, label, onClick, variant = "idle", size = 52 }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className={`icon-button icon-button--${variant}`}
    style={{ width: size, height: size }}
  >
    <Icon size={Math.round(size * 0.42)} strokeWidth={1.8} />
  </button>
);
export default IconButton;
```

- [ ] **Step 3: `Tile.jsx`** — rounded tile with icon + optional label; `active` toggles accent.

```jsx
const Tile = ({ icon: Icon, label, onClick, active = false, accentText }) => (
  <button
    type="button"
    onClick={onClick}
    className={`tile ${active ? "tile--active" : ""}`}
  >
    {Icon && <Icon size={20} strokeWidth={1.8} />}
    {label && <span className="tile-label">{label}</span>}
    {accentText && <span className="tile-accent-text">{accentText}</span>}
  </button>
);
export default Tile;
```

- [ ] **Step 4: Add primitive styles to `src/App.css`** (append; full App.css is rewritten in Task 9-adjacent steps, but these classes can be added now):

```css
.section-label {
  color: var(--text-secondary);
  font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.8px;
  margin: 16px 4px 10px;
}
.icon-button {
  border-radius: 50%; border: 1px solid var(--border);
  background: var(--surface); color: var(--text);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: transform 0.08s ease, background 0.15s ease;
}
.icon-button:active { transform: scale(0.94); }
.icon-button--accent {
  background: var(--accent); border-color: transparent; color: #1a0f07;
  box-shadow: 0 6px 22px var(--accent-glow);
}
.tile {
  flex: 1; min-width: 0;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-tile); color: var(--text-tertiary);
  padding: 14px 8px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  font-size: 12px; transition: transform 0.08s ease;
}
.tile:active { transform: scale(0.97); }
.tile--active {
  background: var(--accent-fill); border-color: var(--accent-border); color: var(--accent-text);
}
.tile-label { font-size: 11px; }
.tile-accent-text { color: var(--accent-text); font-weight: 600; }
```

- [ ] **Step 5: Verify + commit**

Run: `npm run lint` → clean.
```bash
git add src/components/Remote/ui src/App.css
git commit -m "feat(ui): add IconButton, Tile, SectionLabel primitives"
```

---

## Task 3: `useMacApi` hook (extract logic + battery polling)

**Files:**
- Create: `src/components/Remote/useMacApi.js`

This lifts `makeRequest` and the control helpers out of `Remote.jsx` unchanged, and adds the 60s battery poll.

- [ ] **Step 1: Create the hook**

```js
import { useState, useEffect, useCallback } from "react";
import axios from "axios";

export default function useMacApi() {
  const [batteryLevel, setBatteryLevel] = useState(null);

  const makeRequest = useCallback(async (endpoint, data = {}, config = {}) => {
    const token = localStorage.getItem("authToken");
    const serviceUrl = localStorage.getItem("serviceUrl");
    const response = await axios.post(`${serviceUrl}${endpoint}`, data, {
      ...config,
      headers: { Authorization: `Bearer ${token}`, ...config.headers },
    });
    return response.data;
  }, []);

  const media = useCallback((action) => makeRequest(`/media/${action}`).catch(console.error), [makeRequest]);

  const system = useCallback(async (action, data = {}) => {
    try {
      const result = await makeRequest(`/system/${action}`, data);
      if (action === "battery" && result?.status === "success") setBatteryLevel(result.percentage);
      return result;
    } catch (e) { console.error(`system ${action}`, e); }
  }, [makeRequest]);

  const setKeyboardLight = useCallback((level) => {
    const clamped = Math.max(0, Math.min(100, Number(level) || 0));
    return system(`keyboard-light-set/${clamped}`);
  }, [system]);

  const typeText = useCallback((text) => {
    if (!text) return Promise.resolve();
    return makeRequest("/system/keyboardType", { text }).catch(console.error);
  }, [makeRequest]);

  const pressKey = useCallback((key) =>
    makeRequest("/system/keyboardType", { key }).catch(console.error), [makeRequest]);

  // Battery: initial read + poll every 60s while connected
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const serviceUrl = localStorage.getItem("serviceUrl");
    if (!token || !serviceUrl) return;
    system("battery");
    const id = setInterval(() => system("battery"), 60000);
    return () => clearInterval(id);
  }, [system]);

  return { makeRequest, media, system, setKeyboardLight, typeText, pressKey, batteryLevel };
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run lint` → clean.
```bash
git add src/components/Remote/useMacApi.js
git commit -m "feat(ui): extract useMacApi hook with battery polling"
```

---

## Task 4: Header + TabBar

**Files:**
- Create: `src/components/Remote/Header.jsx`
- Create: `src/components/Remote/TabBar.jsx`

- [ ] **Step 1: `Header.jsx`** — decode device name from JWT; battery pill; disconnect.

```jsx
import { BatteryMedium, Power } from "lucide-react";
import { jwtDecode } from "jwt-decode";

const deviceName = () => {
  try { return jwtDecode(localStorage.getItem("authToken"))?.device_name || "Mac"; }
  catch { return "Mac"; }
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
```

- [ ] **Step 2: `TabBar.jsx`**

```jsx
const TabBar = ({ tabs, active, onChange }) => (
  <nav className="tab-bar">
    {tabs.map((t) => (
      <button
        key={t.id}
        className={`tab-bar__tab ${active === t.id ? "tab-bar__tab--active" : ""}`}
        onClick={() => onChange(t.id)}
      >
        {t.label}
      </button>
    ))}
  </nav>
);
export default TabBar;
```

- [ ] **Step 3: Add header/tabbar styles to `src/App.css`**

```css
.app-header {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; background: rgba(10,10,12,0.8);
  backdrop-filter: blur(12px); border-bottom: 1px solid var(--border);
}
.app-header__name { font-size: 17px; font-weight: 700; color: var(--text); }
.app-header__right { display: flex; align-items: center; gap: 10px; }
.battery-pill {
  display: inline-flex; align-items: center; gap: 5px;
  color: var(--accent-text); font-size: 13px; font-weight: 600;
  background: var(--accent-fill); border: 1px solid var(--accent-border);
  border-radius: 10px; padding: 4px 10px;
}
.header-icon-btn {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 10px; color: var(--text-tertiary);
  width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.tab-bar {
  display: flex; gap: 4px; margin: 14px 16px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; padding: 4px;
}
.tab-bar__tab {
  flex: 1; border: none; background: transparent; cursor: pointer;
  color: var(--text-secondary); font-size: 13px; font-weight: 600;
  padding: 8px 0; border-radius: 9px; transition: all 0.15s ease;
}
.tab-bar__tab--active { background: var(--accent); color: #fff; }
```

- [ ] **Step 4: Verify + commit**

Run: `npm run lint` → clean.
```bash
git add src/components/Remote/Header.jsx src/components/Remote/TabBar.jsx src/App.css
git commit -m "feat(ui): add sticky Header (battery + disconnect) and TabBar"
```

---

## Task 5: MediaTab

**Files:**
- Create: `src/components/Remote/tabs/MediaTab.jsx`

- [ ] **Step 1: Create MediaTab** — endpoints: `previous`, `play-pause`, `next`, `volume-down`, `mute`, `volume-up`, `up`, `down`, `left`, `right`.

```jsx
import {
  SkipBack, Play, SkipForward, Volume1, VolumeX, Volume2,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import IconButton from "../ui/IconButton";
import Tile from "../ui/Tile";
import SectionLabel from "../ui/SectionLabel";

const MediaTab = ({ media }) => (
  <div>
    <SectionLabel>Playback</SectionLabel>
    <div className="card row-center">
      <IconButton icon={SkipBack} label="Previous" onClick={() => media("previous")} />
      <IconButton icon={Play} label="Play / Pause" variant="accent" size={62} onClick={() => media("play-pause")} />
      <IconButton icon={SkipForward} label="Next" onClick={() => media("next")} />
    </div>

    <SectionLabel>Volume</SectionLabel>
    <div className="row">
      <Tile icon={Volume1} onClick={() => media("volume-down")} />
      <Tile icon={VolumeX} onClick={() => media("mute")} />
      <Tile icon={Volume2} onClick={() => media("volume-up")} />
    </div>

    <SectionLabel>Arrows</SectionLabel>
    <div className="dpad">
      <Tile icon={ChevronUp} onClick={() => media("up")} />
      <div className="row">
        <Tile icon={ChevronLeft} onClick={() => media("left")} />
        <Tile icon={ChevronDown} onClick={() => media("down")} />
        <Tile icon={ChevronRight} onClick={() => media("right")} />
      </div>
    </div>
  </div>
);
export default MediaTab;
```

- [ ] **Step 2: Add shared layout classes to `src/App.css`**

```css
.tab-content { padding: 0 16px 96px; }
.card {
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-card); padding: 16px;
}
.row { display: flex; gap: var(--gap); margin-bottom: 4px; }
.row-center { display: flex; gap: 14px; align-items: center; justify-content: center; }
.dpad { display: flex; flex-direction: column; gap: var(--gap); align-items: stretch; }
.dpad > .row { justify-content: center; }
.dpad .tile { max-width: 33%; }
```

- [ ] **Step 3: Verify + commit**

Run: `npm run lint` → clean.
```bash
git add src/components/Remote/tabs/MediaTab.jsx src/App.css
git commit -m "feat(ui): MediaTab (playback, volume, arrows)"
```

---

## Task 6: SystemTab

**Files:**
- Create: `src/components/Remote/tabs/SystemTab.jsx`

- [ ] **Step 1: Create SystemTab** — endpoints: `lock`, `capture-and-lock`, `sleep`, `brightness-down`, `brightness-up`, `keyboard-lock`, `keyboard-unlock`, `mouse-lock`, `mouse-unlock`, plus the backlight slider via `setKeyboardLight`. Local slider state mirrors the old `keyboardLight`.

```jsx
import { useState } from "react";
import { Lock, Camera, Moon, SunDim, Sun, Keyboard, MousePointer2 } from "lucide-react";
import Tile from "../ui/Tile";
import SectionLabel from "../ui/SectionLabel";

const SystemTab = ({ system, setKeyboardLight }) => {
  const [light, setLight] = useState(50);
  return (
    <div>
      <SectionLabel>Power & Display</SectionLabel>
      <div className="row">
        <Tile icon={Lock} label="Lock" onClick={() => system("lock")} />
        <Tile icon={Camera} label="Capture" onClick={() => system("capture-and-lock")} />
        <Tile icon={Moon} label="Sleep" onClick={() => system("sleep")} />
      </div>
      <div className="row">
        <Tile icon={SunDim} label="Brightness −" onClick={() => system("brightness-down")} />
        <Tile icon={Sun} label="Brightness +" onClick={() => system("brightness-up")} />
      </div>

      <SectionLabel>Keyboard Backlight — {light}%</SectionLabel>
      <div className="card">
        <input
          className="slider" type="range" min="0" max="100" step="1" value={light}
          onChange={(e) => setLight(Number(e.target.value))}
          onMouseUp={(e) => setKeyboardLight(e.target.value)}
          onTouchEnd={(e) => setKeyboardLight(e.target.value)}
        />
        <div className="row" style={{ marginTop: 12 }}>
          <Tile label="Off" onClick={() => { setLight(0); setKeyboardLight(0); }} />
          <Tile label="50%" onClick={() => { setLight(50); setKeyboardLight(50); }} />
          <Tile label="Max" onClick={() => { setLight(100); setKeyboardLight(100); }} />
        </div>
      </div>

      <SectionLabel>Lock Input</SectionLabel>
      <div className="row">
        <Tile icon={Keyboard} label="Lock KB" onClick={() => system("keyboard-lock")} />
        <Tile icon={Keyboard} label="Unlock KB" onClick={() => system("keyboard-unlock")} />
      </div>
      <div className="row">
        <Tile icon={MousePointer2} label="Lock Mouse" onClick={() => system("mouse-lock")} />
        <Tile icon={MousePointer2} label="Unlock Mouse" onClick={() => system("mouse-unlock")} />
      </div>
    </div>
  );
};
export default SystemTab;
```

- [ ] **Step 2: Add slider style to `src/App.css`**

```css
.slider { width: 100%; cursor: pointer; accent-color: var(--accent); }
```

- [ ] **Step 3: Verify + commit**

Run: `npm run lint` → clean.
```bash
git add src/components/Remote/tabs/SystemTab.jsx src/App.css
git commit -m "feat(ui): SystemTab (power/display, backlight, input locks)"
```

---

## Task 7: InputTab (Keyboard Type)

**Files:**
- Create: `src/components/Remote/tabs/InputTab.jsx`

- [ ] **Step 1: Create InputTab** — `typeText(text)` and `pressKey("enter"|"backspace"|"tab")`.

```jsx
import { useState } from "react";
import { CornerDownLeft, Delete, ArrowRightToLine } from "lucide-react";
import Tile from "../ui/Tile";
import SectionLabel from "../ui/SectionLabel";

const InputTab = ({ typeText, pressKey }) => {
  const [text, setText] = useState("");
  const send = () => { if (text) { typeText(text); setText(""); } };
  return (
    <div>
      <SectionLabel>Keyboard Type</SectionLabel>
      <p className="hint">Types into whatever is focused on the Mac.</p>
      <div className="row">
        <input
          className="text-input" type="text" value={text}
          placeholder="Type text to send…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
        />
        <button className="btn-accent" onClick={send}>Send</button>
      </div>
      <div className="row">
        <Tile icon={CornerDownLeft} label="Enter" onClick={() => pressKey("enter")} />
        <Tile icon={Delete} label="Backspace" onClick={() => pressKey("backspace")} />
        <Tile icon={ArrowRightToLine} label="Tab" onClick={() => pressKey("tab")} />
      </div>
    </div>
  );
};
export default InputTab;
```

- [ ] **Step 2: Add input/button styles to `src/App.css`**

```css
.hint { color: var(--text-secondary); font-size: 12px; margin: 0 4px 10px; }
.text-input {
  flex: 1; min-width: 0; padding: 12px 14px;
  background: var(--surface); border: 1px solid var(--border-strong);
  border-radius: var(--radius-btn); color: var(--text); font-size: 15px;
}
.text-input::placeholder { color: var(--text-secondary); }
.btn-accent {
  background: var(--accent); color: #fff; border: none;
  border-radius: var(--radius-btn); padding: 12px 18px;
  font-size: 14px; font-weight: 600; cursor: pointer;
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm run lint` → clean.
```bash
git add src/components/Remote/tabs/InputTab.jsx src/App.css
git commit -m "feat(ui): InputTab (keyboard type + special keys)"
```

---

## Task 8: StreamTab (streams + audio)

**Files:**
- Create: `src/components/Remote/tabs/StreamTab.jsx`

This preserves the existing audio record/stream logic and the StreamViewer trigger. The audio logic (MediaRecorder, WAV conversion, PCM streaming via `audiobuffer-to-wav`) moves here verbatim from the old `Remote.jsx` (lines ~59-208), taking `makeRequest` as a prop. `setActiveStream` is passed from `Remote`.

- [ ] **Step 1: Create StreamTab** (full audio logic moved in, unchanged behavior)

```jsx
import { useState, useRef } from "react";
import audioBufferToWav from "audiobuffer-to-wav";
import { MonitorSmartphone, Camera, Mic, Radio } from "lucide-react";
import Tile from "../ui/Tile";
import SectionLabel from "../ui/SectionLabel";

const StreamTab = ({ makeRequest, onWatch }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);

  const convertWebmToWav = async (webmBlob) => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await ctx.decodeAudioData(await webmBlob.arrayBuffer());
    return new Blob([audioBufferToWav(buf)], { type: "audio/wav" });
  };

  const handleAudioUpload = async (blob) => {
    try {
      const wav = await convertWebmToWav(blob);
      const fd = new FormData();
      fd.append("audio", wav, `recording_${Date.now()}.wav`);
      await makeRequest("/alerts/upload/audio", fd, { headers: { "Content-Type": "multipart/form-data" } });
    } catch (e) { console.error("Audio upload failed:", e); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 44100, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      const chunks = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRecorderRef.current.onstop = async () =>
        handleAudioUpload(new Blob(chunks, { type: "audio/webm;codecs=opus" }));
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (e) { console.error("Error starting recording:", e); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
    }
  };

  const startAudioStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 44100, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(1024, 1, 1);
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) pcm[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
        makeRequest("/alerts/stream/audio", pcm, {
          headers: { "X-Sample-Rate": "44100", "X-Channels": "1", "Content-Type": "application/octet-stream" },
        }).catch(console.error);
      };
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      setIsStreaming(true);
    } catch (e) { console.error("Error starting audio stream:", e); }
  };

  const stopAudioStream = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    setIsStreaming(false);
  };

  return (
    <div>
      <SectionLabel>Live System Stream</SectionLabel>
      <div className="row">
        <Tile icon={MonitorSmartphone} label="Watch Screen" onClick={() => onWatch("screen")} />
        <Tile icon={Camera} label="Watch Camera" onClick={() => onWatch("camera")} />
      </div>

      <SectionLabel>Send Audio to Mac</SectionLabel>
      <div className="row">
        <Tile icon={Mic} label={isRecording ? "Stop Rec" : "Record"} active={isRecording}
              onClick={isRecording ? stopRecording : startRecording} />
        <Tile icon={Radio} label={isStreaming ? "Stop Live" : "Live Mic"} active={isStreaming}
              onClick={isStreaming ? stopAudioStream : startAudioStream} />
      </div>
    </div>
  );
};
export default StreamTab;
```

- [ ] **Step 2: Verify + commit**

Run: `npm run lint` → clean.
```bash
git add src/components/Remote/tabs/StreamTab.jsx
git commit -m "feat(ui): StreamTab (screen/camera watch + audio record/stream)"
```

---

## Task 9: Assemble Remote.jsx

**Files:**
- Modify: `src/components/Remote/Remote.jsx` (full replace)

- [ ] **Step 1: Replace `Remote.jsx`**

```jsx
import { useState } from "react";
import { useNavigate } from "react-router";
import StreamViewer from "../StreamViewer";
import useMacApi from "./useMacApi";
import Header from "./Header";
import TabBar from "./TabBar";
import MediaTab from "./tabs/MediaTab";
import SystemTab from "./tabs/SystemTab";
import InputTab from "./tabs/InputTab";
import StreamTab from "./tabs/StreamTab";

const TABS = [
  { id: "media", label: "Media" },
  { id: "system", label: "System" },
  { id: "input", label: "Input" },
  { id: "stream", label: "Stream" },
];

const Remote = () => {
  const api = useMacApi();
  const [tab, setTab] = useState("media");
  const [activeStream, setActiveStream] = useState(null);
  const navigate = useNavigate();

  const disconnect = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("serviceUrl");
    navigate("/connect");
  };

  return (
    <div className="remote">
      <Header batteryLevel={api.batteryLevel} onDisconnect={disconnect} />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
      <div className="tab-content">
        {tab === "media" && <MediaTab media={api.media} />}
        {tab === "system" && <SystemTab system={api.system} setKeyboardLight={api.setKeyboardLight} />}
        {tab === "input" && <InputTab typeText={api.typeText} pressKey={api.pressKey} />}
        {tab === "stream" && <StreamTab makeRequest={api.makeRequest} onWatch={setActiveStream} />}
      </div>
      {activeStream && <StreamViewer type={activeStream} onClose={() => setActiveStream(null)} />}
    </div>
  );
};
export default Remote;
```

- [ ] **Step 2: Remove the old bottom "Clean token" button from `App.jsx`** (disconnect now lives in Header). In `src/App.jsx`, delete the `<button className="control-button clean-token-button">…</button>` block, leaving just `<Outlet />` (and the error branch).

```jsx
return (
  <AppContext.Provider value={appContext}>
    {showError ? <div className="error-message">Error: Missing token or service URL</div> : <Outlet />}
  </AppContext.Provider>
);
```

- [ ] **Step 3: Add `.remote` style to `src/App.css`**

```css
.remote { max-width: 520px; margin: 0 auto; min-height: 100vh; }
```

- [ ] **Step 4: Verify (functional)**

Run: `npm run dev`. Pair/open `/remote`. Confirm: header shows device + battery; tabs switch; every control in each tab fires its request (watch the Network tab / the Mac responds); Disconnect returns to Connect. `npm run lint` clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/Remote/Remote.jsx src/App.jsx src/App.css
git commit -m "feat(ui): assemble tabbed Remote screen; move disconnect to header"
```

---

## Task 10: Restyle Connect + StreamViewer; prune dead CSS

**Files:**
- Modify: `src/components/Connect/Connect.jsx`
- Modify: `src/components/StreamViewer/index.jsx` (styling only — keep its stream logic)
- Modify: `src/App.css` (remove now-unused old classes: `.control-button`, `.battery-button`, `.connect-button` old colors, `.remote-controls-container`, `.control-section`, `.remote-title`, `.recording-*`, `.keyboard-light-slider`, `.clean-token-button` — anything no longer referenced)

- [ ] **Step 1: Restyle Connect** — keep all logic; swap classNames/markup.

```jsx
// in the return of Connect.jsx — replace the JSX only:
return (
  <div className="connect">
    <div className="connect-card">
      <h1 className="connect-title">Connect to your Mac</h1>
      {showLoading ? (
        <p className="hint">Connecting…</p>
      ) : (
        <>
          <input className="text-input" type="text" value={deviceName}
                 onChange={(e) => setDeviceName(e.target.value)} placeholder="Device name" />
          <button className="btn-accent btn-block" onClick={onConnect}>Connect</button>
        </>
      )}
      {error && <div className="error-message">{error}</div>}
    </div>
  </div>
);
```

- [ ] **Step 2: Connect + StreamViewer styles in `src/App.css`**

```css
.connect { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
.connect-card {
  width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 14px;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-card); padding: 28px;
}
.connect-title { font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 4px; }
.btn-block { width: 100%; }
.error-message { color: #ff6b6b; font-size: 13px; text-align: center; }

/* StreamViewer */
.stream-viewer-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.85); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
}
.stream-viewer-content {
  background: #0f0f12; border: 1px solid var(--border);
  border-radius: var(--radius-card); padding: 16px;
  width: 92%; max-width: 1200px; max-height: 95vh;
  display: flex; flex-direction: column;
}
.stream-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid var(--border);
}
.stream-header h3 { margin: 0; color: var(--text); font-size: 16px; }
```

- [ ] **Step 3: In `StreamViewer/index.jsx`**, ensure its close button / container use the classes above; restyle its close button to `.header-icon-btn` if it uses an inline style. (Logic unchanged — only classNames/markup.) Confirm it still opens screen + camera streams.

- [ ] **Step 4: Remove unused old CSS classes** from `src/App.css` (listed in Files). Grep first to confirm none are still referenced:

Run: `grep -rnE "control-button|remote-controls-container|control-section|clean-token|battery-button|recording-active|streaming-active|keyboard-light-slider" src/`
Expected: no matches in `.jsx` files (only the CSS definitions remain → delete those).

- [ ] **Step 5: Verify + commit**

Run: `npm run lint` → clean. `npm run dev` → Connect screen and StreamViewer match the dark theme; streams still work.
```bash
git add src/components/Connect/Connect.jsx src/components/StreamViewer/index.jsx src/App.css
git commit -m "feat(ui): restyle Connect + StreamViewer; remove dead CSS"
```

---

## Task 11: Final verification pass (build + phone)

- [ ] **Step 1: Lint + build**

Run: `npm run lint` (clean) and `npm run build` (succeeds, no errors).

- [ ] **Step 2: Visual + functional check on the phone**

Open the deployed/dev URL on the iPhone (the real target). Walk every tab:
- Media: prev/play/next, volume, arrows.
- System: lock/capture/sleep, brightness, backlight slider + presets, KB/mouse lock-unlock.
- Input: type text → appears on Mac; Enter/Backspace/Tab.
- Stream: Watch Screen, Watch Camera, Record, Live Mic.
- Header battery updates; Disconnect works.
Confirm layout looks good at phone width (no overflow), cognac accent reads well.

- [ ] **Step 3: Final commit (if any tweaks)**

```bash
git add -A
git commit -m "chore(ui): final redesign polish"
```

---

## Self-Review (done by plan author)

- **Spec coverage:** tokens (T1), outlined icons via lucide (T2,5-8), sticky header + battery (T4), 4 tabs with the exact control→tab mapping from the spec (T5-8), disconnect in header (T4,T9), useMacApi hook (T3), Connect + StreamViewer restyle (T10), web-client-only / behavior preserved (all tasks reuse existing endpoints) — covered.
- **Endpoint names** verified against the server: `/media/{previous,play-pause,next,volume-down,mute,volume-up,up,down,left,right}`, `/system/{lock,capture-and-lock,sleep,brightness-down,brightness-up,keyboard-light-set/<n>,keyboard-lock,keyboard-unlock,mouse-lock,mouse-unlock,battery,keyboardType}`, `/alerts/{upload/audio,stream/audio}` — all match current `Remote.jsx`/server.
- **Type/name consistency:** `useMacApi` returns `{ makeRequest, media, system, setKeyboardLight, typeText, pressKey, batteryLevel }`; consumers use exactly those. Tab props match.
- **No placeholders:** every step has concrete code/commands.

import { useState } from "react";
import { Lock, Camera, Moon, SunDim, Sun, Keyboard, MousePointer2, ShieldAlert } from "lucide-react";
import Tile from "../ui/Tile";
import SectionLabel from "../ui/SectionLabel";
import IntruderGallery from "../IntruderGallery";

const SystemTab = ({ system, setKeyboardLight, getIntruders, deleteIntruder, platform }) => {
  const [light, setLight] = useState(50);
  const [showGallery, setShowGallery] = useState(false);
  // Keyboard backlight has no standard Windows API — hide the control unless the
  // server reports it supports it (macOS via CoreBrightness).
  const showKbBacklight = platform?.capabilities?.keyboard_backlight !== false;
  return (
    <div>
      <SectionLabel>Power &amp; Display</SectionLabel>
      <div className="row">
        <Tile icon={Lock} label="Lock Screen" onClick={() => system("lock")} />
        <Tile icon={Camera} label="Capture & Lock" onClick={() => system("capture-and-lock")} />
        <Tile icon={Moon} label="Sleep" onClick={() => system("sleep")} />
      </div>
      <div className="row">
        <Tile icon={ShieldAlert} label="View Captures" onClick={() => setShowGallery(true)} />
      </div>
      <div className="row">
        <Tile icon={SunDim} label="Brightness −" onClick={() => system("brightness-down")} />
        <Tile icon={Sun} label="Brightness +" onClick={() => system("brightness-up")} />
      </div>

      {showKbBacklight && (
        <>
          <SectionLabel>Keyboard Backlight — {light}%</SectionLabel>
          <div className="card">
            <input
              className="slider"
              type="range"
              min="0"
              max="100"
              step="1"
              value={light}
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
        </>
      )}

      <SectionLabel>Lock Input</SectionLabel>
      <div className="row">
        <Tile icon={Keyboard} label="Lock Keyboard" onClick={() => system("keyboard-lock")} />
        <Tile icon={Keyboard} label="Unlock Keyboard" onClick={() => system("keyboard-unlock")} />
      </div>
      <div className="row">
        <Tile icon={MousePointer2} label="Lock Mouse" onClick={() => system("mouse-lock")} />
        <Tile icon={MousePointer2} label="Unlock Mouse" onClick={() => system("mouse-unlock")} />
      </div>

      {showGallery && (
        <IntruderGallery
          getIntruders={getIntruders}
          deleteIntruder={deleteIntruder}
          onClose={() => setShowGallery(false)}
        />
      )}
    </div>
  );
};

export default SystemTab;

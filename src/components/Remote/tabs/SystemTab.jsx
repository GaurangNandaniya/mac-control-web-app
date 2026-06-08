import { useState } from "react";
import { Lock, Camera, Moon, SunDim, Sun, Keyboard, MousePointer2 } from "lucide-react";
import Tile from "../ui/Tile";
import SectionLabel from "../ui/SectionLabel";

const SystemTab = ({ system, setKeyboardLight }) => {
  const [light, setLight] = useState(50);
  return (
    <div>
      <SectionLabel>Power &amp; Display</SectionLabel>
      <div className="row">
        <Tile icon={Lock} label="Lock Screen" onClick={() => system("lock")} />
        <Tile icon={Camera} label="Capture & Lock" onClick={() => system("capture-and-lock")} />
        <Tile icon={Moon} label="Sleep" onClick={() => system("sleep")} />
      </div>
      <div className="row">
        <Tile icon={SunDim} label="Brightness −" onClick={() => system("brightness-down")} />
        <Tile icon={Sun} label="Brightness +" onClick={() => system("brightness-up")} />
      </div>

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

      <SectionLabel>Lock Input</SectionLabel>
      <div className="row">
        <Tile icon={Keyboard} label="Lock Keyboard" onClick={() => system("keyboard-lock")} />
        <Tile icon={Keyboard} label="Unlock Keyboard" onClick={() => system("keyboard-unlock")} />
      </div>
      <div className="row">
        <Tile icon={MousePointer2} label="Lock Mouse" onClick={() => system("mouse-lock")} />
        <Tile icon={MousePointer2} label="Unlock Mouse" onClick={() => system("mouse-unlock")} />
      </div>
    </div>
  );
};

export default SystemTab;

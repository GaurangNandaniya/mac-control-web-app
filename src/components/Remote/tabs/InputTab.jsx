import { useState } from "react";
import { CornerDownLeft, Delete, ArrowRightToLine } from "lucide-react";
import Tile from "../ui/Tile";
import SectionLabel from "../ui/SectionLabel";

const InputTab = ({ typeText, pressKey }) => {
  const [text, setText] = useState("");
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
    </div>
  );
};

export default InputTab;

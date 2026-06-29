import { useState } from "react";
import { CornerDownLeft, Delete, ArrowRightToLine, Keyboard as KeyboardIcon, ClipboardPaste } from "lucide-react";
import Tile from "../ui/Tile";
import SectionLabel from "../ui/SectionLabel";
import OnScreenKeyboard from "../OnScreenKeyboard";

const InputTab = ({ typeText, pressKey }) => {
  const [text, setText] = useState("");
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [pasteMsg, setPasteMsg] = useState("");

  const send = () => {
    if (text) {
      typeText(text);
      setText("");
    }
  };

  const flash = (msg) => {
    setPasteMsg(msg);
    setTimeout(() => setPasteMsg(""), 3000);
  };

  const pasteFromPhone = async () => {
    try {
      const clip = await navigator.clipboard?.readText();
      if (!clip) return flash("Clipboard is empty.");
      await typeText(clip);
      flash(`Pasted ${clip.length} character${clip.length === 1 ? "" : "s"} to Mac.`);
    } catch {
      flash("Couldn't read clipboard — allow paste access and try again.");
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

      <button className="btn-ghost btn-block" onClick={pasteFromPhone}>
        <ClipboardPaste size={16} strokeWidth={1.8} />
        Paste from phone to Mac
      </button>
      {pasteMsg && <p className="hint">{pasteMsg}</p>}

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

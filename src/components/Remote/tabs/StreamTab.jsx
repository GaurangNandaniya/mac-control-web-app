import { MonitorSmartphone, Camera, Mic, Radio } from "lucide-react";
import Tile from "../ui/Tile";
import SectionLabel from "../ui/SectionLabel";

// Presentational: audio state/handlers come from useAudioCapture (held in Remote
// so they persist across tab switches).
const StreamTab = ({ onWatch, audio }) => (
  <div>
    <SectionLabel>Live System Stream</SectionLabel>
    <div className="row">
      <Tile icon={MonitorSmartphone} label="Watch Screen" onClick={() => onWatch("screen")} />
      <Tile icon={Camera} label="Watch Camera" onClick={() => onWatch("camera")} />
    </div>

    <SectionLabel>Send Audio to Mac</SectionLabel>
    <div className="row">
      <Tile
        icon={Mic}
        label={audio.isRecording ? "Stop Recording" : "Record"}
        active={audio.isRecording}
        onClick={audio.isRecording ? audio.stopRecording : audio.startRecording}
      />
      <Tile
        icon={Radio}
        label={audio.isStreaming ? "Stop Live Mic" : "Live Mic"}
        active={audio.isStreaming}
        onClick={audio.isStreaming ? audio.stopAudioStream : audio.startAudioStream}
      />
    </div>
  </div>
);

export default StreamTab;

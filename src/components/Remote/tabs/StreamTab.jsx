import { MonitorSmartphone, Camera, Mic, Radio, Headphones } from "lucide-react";
import Tile from "../ui/Tile";
import SectionLabel from "../ui/SectionLabel";

// Presentational: audio/mic state + handlers come from hooks held in Remote
// (useAudioCapture, useMicListen) so they persist across tab switches.
const StreamTab = ({ onWatch, audio, mic, platform }) => {
  const listening = mic.status !== "closed";
  const dev = platform?.deviceLabel || "Mac";
  return (
    <div>
      <SectionLabel>Live System Stream</SectionLabel>
      <div className="row">
        <Tile icon={MonitorSmartphone} label="Watch Screen" onClick={() => onWatch("screen")} />
        <Tile icon={Camera} label="Watch Camera" onClick={() => onWatch("camera")} />
      </div>

      <SectionLabel>Send Audio to {dev}</SectionLabel>
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

      <SectionLabel>Listen to {dev}</SectionLabel>
      <div className="row">
        <Tile
          icon={Headphones}
          label={listening ? "Listening…" : "Listen to Mic"}
          active={listening}
          onClick={listening ? mic.stop : mic.start}
        />
      </div>
      <div className="mic-help">
        <div className="mic-help__h">📱 On iPhone</div>
        Flip the <b>silent switch OFF</b> and <b>tap once</b> to start — iOS blocks audio until you
        do. Hearing nothing? It’s almost always the silent switch. Streams the {dev}’s built-in
        microphone live, in a floating window you can move and minimize.
      </div>
    </div>
  );
};

export default StreamTab;

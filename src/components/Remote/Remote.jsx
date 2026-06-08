import { useState } from "react";
import { useNavigate } from "react-router";
import StreamViewer from "../StreamViewer";
import useMacApi from "./useMacApi";
import useAudioCapture from "./useAudioCapture";
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
  const audio = useAudioCapture(api.makeRequest);
  const [tab, setTab] = useState("media");
  const [activeStream, setActiveStream] = useState(null);
  const navigate = useNavigate();

  const disconnect = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("serviceUrl");
    navigate("/connect");
  };

  const capturing = audio.isRecording || audio.isStreaming;

  return (
    <div className="remote">
      <Header
        batteryLevel={api.batteryLevel}
        onRefreshBattery={() => api.system("battery")}
        onDisconnect={disconnect}
      />
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {capturing && (
        <div className="capture-banner">
          <span className="capture-banner__dot" />
          <span>{audio.isRecording ? "Recording mic…" : "Streaming mic to Mac…"}</span>
          <button
            className="capture-banner__stop"
            onClick={audio.isRecording ? audio.stopRecording : audio.stopAudioStream}
          >
            Stop
          </button>
        </div>
      )}

      <div className="tab-content">
        {tab === "media" && <MediaTab media={api.media} />}
        {tab === "system" && (
          <SystemTab system={api.system} setKeyboardLight={api.setKeyboardLight} />
        )}
        {tab === "input" && <InputTab typeText={api.typeText} pressKey={api.pressKey} />}
        {tab === "stream" && <StreamTab onWatch={setActiveStream} audio={audio} />}
      </div>

      {activeStream && (
        <StreamViewer type={activeStream} onClose={() => setActiveStream(null)} />
      )}
    </div>
  );
};

export default Remote;

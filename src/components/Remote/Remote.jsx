import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import StreamViewer from "../StreamViewer";
import useMacApi from "./useMacApi";
import useAudioCapture from "./useAudioCapture";
import useConnectionStatus from "./useConnectionStatus";
import Header from "./Header";
import TabBar from "./TabBar";
import MediaTab from "./tabs/MediaTab";
import SystemTab from "./tabs/SystemTab";
import InputTab from "./tabs/InputTab";
import StreamTab from "./tabs/StreamTab";
import MouseTab from "./tabs/MouseTab";
import AppsTab from "./tabs/AppsTab";
import FavoritesTab from "./tabs/FavoritesTab";
import { buildFavoritesCatalog } from "./favoritesCatalog";

const TABS = [
  { id: "favorites", label: "Home" },
  { id: "media", label: "Media" },
  { id: "system", label: "System" },
  { id: "input", label: "Input" },
  { id: "apps", label: "Apps" },
  { id: "stream", label: "Stream" },
  { id: "mouse", label: "Mouse" },
];

const Remote = () => {
  const conn = useConnectionStatus();
  const api = useMacApi(conn.status === "online");
  const audio = useAudioCapture(api.makeRequest);
  const [tab, setTab] = useState("favorites");
  const [activeStream, setActiveStream] = useState(null);
  const navigate = useNavigate();

  const favoritesCatalog = useMemo(
    () => buildFavoritesCatalog({ media: api.media, system: api.system, watch: setActiveStream }),
    [api.media, api.system]
  );

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
        connStatus={conn.status}
        connLatency={conn.latency}
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
        {tab === "favorites" && <FavoritesTab catalog={favoritesCatalog} />}
        {tab === "media" && <MediaTab media={api.media} />}
        {tab === "system" && (
          <SystemTab system={api.system} setKeyboardLight={api.setKeyboardLight} />
        )}
        {tab === "input" && <InputTab typeText={api.typeText} pressKey={api.pressKey} />}
        {tab === "apps" && <AppsTab launchApp={api.launchApp} />}
        {tab === "stream" && <StreamTab onWatch={setActiveStream} audio={audio} />}
        {tab === "mouse" && <MouseTab />}
      </div>

      {activeStream && (
        <StreamViewer type={activeStream} onClose={() => setActiveStream(null)} />
      )}
    </div>
  );
};

export default Remote;

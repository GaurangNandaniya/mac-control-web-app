import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { removeDevice } from "./../../utils/deviceStore";
import StreamViewer from "../StreamViewer";
import useMacApi from "./useMacApi";
import useAudioCapture from "./useAudioCapture";
import useMicListen from "./useMicListen";
import MicListenWindow from "./MicListenWindow";
import usePlatform from "./usePlatform";
import useConnectionStatus from "./useConnectionStatus";
import useNavConfig from "./useNavConfig";
import Header from "./Header";
import Drawer from "./Drawer";
import { SECTION_BY_ID, HOME_ID } from "./sections";
import MediaTab from "./tabs/MediaTab";
import SystemTab from "./tabs/SystemTab";
import InputTab from "./tabs/InputTab";
import StreamTab from "./tabs/StreamTab";
import MouseTab from "./tabs/MouseTab";
import AppsTab from "./tabs/AppsTab";
import FavoritesTab from "./tabs/FavoritesTab";
import FilesSection from "./tabs/FilesSection";
import { buildFavoritesCatalog } from "./favoritesCatalog";

const Remote = () => {
  const conn = useConnectionStatus();
  const api = useMacApi(conn.status === "online");
  const audio = useAudioCapture(api.makeRequest);
  const mic = useMicListen();
  const platform = usePlatform(api.makeRequest, conn.status === "online");
  const nav = useNavConfig();
  const [section, setSection] = useState(HOME_ID);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Streams open as independent floating windows — screen and camera can be up
  // at the same time. Ordered array of kinds; index drives spawn/stack position.
  const [openStreams, setOpenStreams] = useState([]);
  const navigate = useNavigate();

  const openStream = (kind) =>
    setOpenStreams((s) => (s.includes(kind) ? s : [...s, kind]));
  const closeStream = (kind) => setOpenStreams((s) => s.filter((k) => k !== kind));

  const favoritesCatalog = useMemo(
    () =>
      buildFavoritesCatalog({
        media: api.media,
        system: api.system,
        watch: openStream,
        openFiles: () => setSection("files"),
      }),
    [api.media, api.system]
  );

  // Disconnect = forget the active Mac; fall back to another if paired.
  const disconnect = () => {
    const active = localStorage.getItem("serviceUrl");
    const remaining = removeDevice(active);
    if (remaining.length) {
      window.location.reload();
    } else {
      navigate("/connect");
    }
  };

  const capturing = audio.isRecording || audio.isStreaming;

  // If the active section got hidden in config, fall back to Home.
  const activeSection = nav.visibleIds.includes(section) ? section : HOME_ID;

  const renderSection = () => {
    switch (activeSection) {
      case "favorites":
        return <FavoritesTab catalog={favoritesCatalog} />;
      case "media":
        return <MediaTab media={api.media} getMediaStatus={api.getMediaStatus} setVolume={api.setVolume} />;
      case "system":
        return (
          <SystemTab
            system={api.system}
            setKeyboardLight={api.setKeyboardLight}
            getIntruders={api.getIntruders}
            deleteIntruder={api.deleteIntruder}
            platform={platform}
          />
        );
      case "input":
        return <InputTab typeText={api.typeText} pressKey={api.pressKey} platform={platform} />;
      case "apps":
        return <AppsTab launchApp={api.launchApp} platform={platform} />;
      case "stream":
        return <StreamTab onWatch={openStream} audio={audio} mic={mic} platform={platform} />;
      case "mouse":
        return <MouseTab />;
      case "files":
        return <FilesSection uploadFile={api.uploadFile} listFiles={api.listFiles} deleteFile={api.deleteFile} />;
      default:
        return null;
    }
  };

  return (
    <div className="remote">
      <Header
        onMenu={() => setDrawerOpen(true)}
        batteryLevel={api.batteryLevel}
        onRefreshBattery={() => api.system("battery")}
        onDisconnect={disconnect}
        connStatus={conn.status}
        connLatency={conn.latency}
        onRetryPing={conn.refresh}
      />

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
        <h1 className="section-title">{SECTION_BY_ID[activeSection].label}</h1>
        {renderSection()}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        section={activeSection}
        onSelect={setSection}
        nav={nav}
      />

      {openStreams.map((kind, i) => (
        <StreamViewer
          key={kind}
          type={kind}
          index={i}
          onClose={() => closeStream(kind)}
          mouseClick={api.mouseClick}
        />
      ))}

      {mic.status !== "closed" && <MicListenWindow mic={mic} deviceLabel={platform.deviceLabel} />}
    </div>
  );
};

export default Remote;

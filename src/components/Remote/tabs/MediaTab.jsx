import { useCallback, useEffect, useRef, useState } from "react";
import {
  SkipBack, Play, SkipForward, VolumeX, Volume2, Music,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import IconButton from "../ui/IconButton";
import Tile from "../ui/Tile";
import SectionLabel from "../ui/SectionLabel";
import { haptic } from "../../../utils/haptic";

const MediaTab = ({ media, getMediaStatus, setVolume }) => {
  const [status, setStatus] = useState(null);
  const [vol, setVol] = useState(50);
  const draggingRef = useRef(false);
  const volRef = useRef(vol);
  volRef.current = vol;

  const refresh = useCallback(async () => {
    const s = await getMediaStatus();
    if (!s || s.status !== "success") return;
    setStatus(s);
    if (!draggingRef.current && typeof s.volume === "number") setVol(s.volume);
  }, [getMediaStatus]);

  // Poll while the Media tab is mounted (it unmounts on tab switch).
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  const commitVol = () => {
    draggingRef.current = false;
    setVolume(volRef.current);
  };

  const toggleMute = () => {
    haptic();
    media("mute");
    setTimeout(refresh, 250);
  };

  const np = status?.nowPlaying;
  const muted = status?.muted;

  return (
    <div>
      <SectionLabel>Now Playing</SectionLabel>
      <div className="now-playing">
        <Music size={18} strokeWidth={1.8} className="np-icon" />
        {np?.playing ? (
          <div className="np-meta">
            <div className="np-track">{np.track}</div>
            <div className="np-artist">{[np.artist, np.app].filter(Boolean).join(" · ")}</div>
          </div>
        ) : (
          <div className="np-meta">
            <div className="np-idle">Nothing playing</div>
          </div>
        )}
      </div>

      <SectionLabel>Playback</SectionLabel>
      <div className="card row-center">
        <IconButton icon={SkipBack} label="Previous" onClick={() => media("previous")} />
        <IconButton icon={Play} label="Play / Pause" variant="accent" size={62} onClick={() => media("play-pause")} />
        <IconButton icon={SkipForward} label="Next" onClick={() => media("next")} />
      </div>

      <SectionLabel>Volume</SectionLabel>
      <div className="volume-row">
        <button className="vol-mute" aria-label="Mute" onClick={toggleMute}>
          {muted ? <VolumeX size={18} strokeWidth={1.8} /> : <Volume2 size={18} strokeWidth={1.8} />}
        </button>
        <input
          type="range"
          className="slider"
          min="0"
          max="100"
          value={vol}
          onChange={(e) => {
            draggingRef.current = true;
            setVol(Number(e.target.value));
          }}
          onMouseUp={commitVol}
          onTouchEnd={commitVol}
          onKeyUp={commitVol}
        />
        <span className="vol-pct">{vol}%</span>
      </div>

      <SectionLabel>Arrows</SectionLabel>
      <div className="dpad">
        <div className="row">
          <Tile icon={ChevronUp} onClick={() => media("up")} />
        </div>
        <div className="row">
          <Tile icon={ChevronLeft} onClick={() => media("left")} />
          <Tile icon={ChevronDown} onClick={() => media("down")} />
          <Tile icon={ChevronRight} onClick={() => media("right")} />
        </div>
      </div>
    </div>
  );
};

export default MediaTab;

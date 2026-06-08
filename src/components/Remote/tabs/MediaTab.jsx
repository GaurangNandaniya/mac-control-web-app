import {
  SkipBack, Play, SkipForward, Volume1, VolumeX, Volume2,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
} from "lucide-react";
import IconButton from "../ui/IconButton";
import Tile from "../ui/Tile";
import SectionLabel from "../ui/SectionLabel";

const MediaTab = ({ media }) => (
  <div>
    <SectionLabel>Playback</SectionLabel>
    <div className="card row-center">
      <IconButton icon={SkipBack} label="Previous" onClick={() => media("previous")} />
      <IconButton icon={Play} label="Play / Pause" variant="accent" size={62} onClick={() => media("play-pause")} />
      <IconButton icon={SkipForward} label="Next" onClick={() => media("next")} />
    </div>

    <SectionLabel>Volume</SectionLabel>
    <div className="row">
      <Tile icon={Volume1} label="Down" onClick={() => media("volume-down")} />
      <Tile icon={VolumeX} label="Mute" onClick={() => media("mute")} />
      <Tile icon={Volume2} label="Up" onClick={() => media("volume-up")} />
    </div>

    <SectionLabel>Arrows</SectionLabel>
    <div className="dpad">
      <Tile icon={ChevronUp} onClick={() => media("up")} />
      <div className="row">
        <Tile icon={ChevronLeft} onClick={() => media("left")} />
        <Tile icon={ChevronDown} onClick={() => media("down")} />
        <Tile icon={ChevronRight} onClick={() => media("right")} />
      </div>
    </div>
  </div>
);

export default MediaTab;

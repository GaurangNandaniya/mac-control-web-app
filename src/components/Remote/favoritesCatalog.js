import {
  Play, SkipForward, SkipBack, Volume2, Volume1, VolumeX,
  Lock, Moon, Sun, SunDim, Keyboard, MousePointer2,
  MonitorSmartphone, Camera, ShieldAlert, FolderOpen,
} from "lucide-react";

// The catalog of one-tap actions that can be pinned to the Home dashboard.
// `run` closes over the handlers Remote already owns (media/system/watch/files).
export const buildFavoritesCatalog = ({ media, system, watch, openFiles }) => [
  { id: "files", label: "Files", icon: FolderOpen, run: openFiles },
  { id: "play-pause", label: "Play / Pause", icon: Play, run: () => media("play-pause") },
  { id: "next", label: "Next", icon: SkipForward, run: () => media("next") },
  { id: "previous", label: "Previous", icon: SkipBack, run: () => media("previous") },
  { id: "volume-up", label: "Vol +", icon: Volume2, run: () => media("volume-up") },
  { id: "volume-down", label: "Vol −", icon: Volume1, run: () => media("volume-down") },
  { id: "mute", label: "Mute", icon: VolumeX, run: () => media("mute") },
  { id: "lock", label: "Lock Screen", icon: Lock, run: () => system("lock") },
  { id: "sleep", label: "Sleep", icon: Moon, run: () => system("sleep") },
  { id: "brightness-up", label: "Bright +", icon: Sun, run: () => system("brightness-up") },
  { id: "brightness-down", label: "Bright −", icon: SunDim, run: () => system("brightness-down") },
  { id: "keyboard-lock", label: "Lock Kbd", icon: Keyboard, run: () => system("keyboard-lock") },
  { id: "mouse-lock", label: "Lock Mouse", icon: MousePointer2, run: () => system("mouse-lock") },
  { id: "watch-screen", label: "Watch Screen", icon: MonitorSmartphone, run: () => watch("screen") },
  { id: "watch-camera", label: "Watch Camera", icon: Camera, run: () => watch("camera") },
  { id: "capture-lock", label: "Capture & Lock", icon: ShieldAlert, run: () => system("capture-and-lock") },
];

import {
  Home, Play, Settings2, Keyboard, LayoutGrid,
  MonitorSmartphone, MousePointer2, FolderOpen,
} from "lucide-react";

// Single source of truth for the drawer's sections. The rendered panel for each
// id is wired in Remote.jsx (keeps panel props close to their handlers).
// "favorites" (Home) is pinned first and never hidden/reordered.
export const HOME_ID = "favorites";

export const SECTIONS = [
  { id: "favorites", label: "Home", icon: Home },
  { id: "media", label: "Media", icon: Play },
  { id: "system", label: "System", icon: Settings2 },
  { id: "input", label: "Input", icon: Keyboard },
  { id: "apps", label: "Apps", icon: LayoutGrid },
  { id: "stream", label: "Stream", icon: MonitorSmartphone },
  { id: "mouse", label: "Mouse", icon: MousePointer2 },
  { id: "files", label: "Files", icon: FolderOpen },
];

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

// The sections users can reorder/hide (everything except pinned Home).
export const REORDERABLE_IDS = SECTIONS.filter((s) => s.id !== HOME_ID).map((s) => s.id);

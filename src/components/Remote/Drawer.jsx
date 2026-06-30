import { useState } from "react";
import { createPortal } from "react-dom";
import { GripVertical, Eye, EyeOff, Pin } from "lucide-react";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { SECTION_BY_ID, HOME_ID } from "./sections";
import { haptic } from "../../utils/haptic";

function SortableRow({ id, hidden, onToggle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const s = SECTION_BY_ID[id];
  const Icon = s.icon;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 2 : undefined }}
      className={`drawer-row drawer-row--edit${hidden ? " is-hidden" : ""}${isDragging ? " is-dragging" : ""}`}
    >
      <button className="drawer-grip" {...attributes} {...listeners} aria-label="Drag to reorder">
        <GripVertical size={18} strokeWidth={1.8} />
      </button>
      <Icon size={18} strokeWidth={1.8} />
      <span className="drawer-row__label">{s.label}</span>
      <button
        className="drawer-tog"
        aria-label={hidden ? `Show ${s.label}` : `Hide ${s.label}`}
        onClick={() => { haptic(); onToggle(id); }}
      >
        {hidden ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
      </button>
    </div>
  );
}

const Drawer = ({ open, onClose, section, onSelect, nav }) => {
  const [editing, setEditing] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!open) return null;

  const reorderIds = nav.editIds.filter((id) => id !== HOME_ID);
  const HomeIcon = SECTION_BY_ID[HOME_ID].icon;

  const onDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) nav.move(active.id, over.id);
  };

  return createPortal(
    <div className="drawer-wrap">
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head">
          <h4>{editing ? "Configure sections" : "Sections"}</h4>
          <button className="drawer-edit" onClick={() => { haptic(); setEditing((e) => !e); }}>
            {editing ? "Done" : "Edit"}
          </button>
        </div>

        {!editing ? (
          <div className="drawer-list">
            {nav.visibleIds.map((id) => {
              const s = SECTION_BY_ID[id];
              const Icon = s.icon;
              return (
                <button
                  key={id}
                  className={`drawer-row${section === id ? " is-active" : ""}`}
                  onClick={() => { haptic(); onSelect(id); onClose(); }}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span className="drawer-row__label">{s.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="drawer-list">
            {/* Home is pinned: always first, not draggable or hideable. */}
            <div className="drawer-row drawer-row--edit is-pinned">
              <span className="drawer-grip drawer-grip--ghost"><Pin size={15} strokeWidth={1.8} /></span>
              <HomeIcon size={18} strokeWidth={1.8} />
              <span className="drawer-row__label">{SECTION_BY_ID[HOME_ID].label}</span>
            </div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
              modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            >
              <SortableContext items={reorderIds} strategy={verticalListSortingStrategy}>
                {reorderIds.map((id) => (
                  <SortableRow key={id} id={id} hidden={nav.isHidden(id)} onToggle={nav.toggleHidden} />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        )}
      </aside>
    </div>,
    document.body
  );
};

export default Drawer;

import { useCallback, useEffect, useState } from "react";
import { HOME_ID, REORDERABLE_IDS } from "./sections";

const KEY = "nav_config";

// Merge stored config with the current registry: keep stored order for known
// ids, append any new ids not yet stored, drop unknown ids. Home is never in
// `order`/`hidden` (it's pinned first and always visible).
const load = () => {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    stored = {};
  }
  const storedOrder = Array.isArray(stored.order) ? stored.order : [];
  const order = [
    ...storedOrder.filter((id) => REORDERABLE_IDS.includes(id)),
    ...REORDERABLE_IDS.filter((id) => !storedOrder.includes(id)),
  ];
  const hidden = (Array.isArray(stored.hidden) ? stored.hidden : []).filter((id) =>
    REORDERABLE_IDS.includes(id)
  );
  return { order, hidden };
};

export default function useNavConfig() {
  const [config, setConfig] = useState(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(config));
  }, [config]);

  // Home first, then the reorderable sections in saved order, minus hidden.
  const visibleIds = [HOME_ID, ...config.order.filter((id) => !config.hidden.includes(id))];
  // For the editor: Home first, then ALL reorderable sections in order.
  const editIds = [HOME_ID, ...config.order];

  const move = useCallback((activeId, overId) => {
    setConfig((c) => {
      const from = c.order.indexOf(activeId);
      const to = c.order.indexOf(overId);
      if (from === -1 || to === -1 || from === to) return c;
      const order = [...c.order];
      order.splice(to, 0, order.splice(from, 1)[0]);
      return { ...c, order };
    });
  }, []);

  const toggleHidden = useCallback((id) => {
    setConfig((c) => ({
      ...c,
      hidden: c.hidden.includes(id) ? c.hidden.filter((x) => x !== id) : [...c.hidden, id],
    }));
  }, []);

  const isHidden = useCallback((id) => config.hidden.includes(id), [config.hidden]);

  return { visibleIds, editIds, move, toggleHidden, isHidden };
}

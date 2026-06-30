import { useEffect, useState } from "react";
import { X, Trash2, RefreshCw, ShieldAlert } from "lucide-react";

// Reviews capture-and-lock sessions saved on the Mac (~/Desktop/intruders).
// Images load via <img src=…/intruders/file?…&token=> (query-param auth).
const IntruderGallery = ({ getIntruders, deleteIntruder, onClose }) => {
  const [sessions, setSessions] = useState(null); // null = loading
  const [viewer, setViewer] = useState(null); // full-screen image URL
  const [confirmId, setConfirmId] = useState(null);

  const serviceUrl = localStorage.getItem("serviceUrl");
  const token = localStorage.getItem("authToken");

  const fileUrl = (session, name) =>
    `${serviceUrl}/system/intruders/file?session=${encodeURIComponent(session)}&name=${encodeURIComponent(name)}&token=${token}`;

  const load = async () => {
    setSessions(null);
    const res = await getIntruders();
    setSessions(res?.status === "success" ? res.sessions : []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (id) => {
    await deleteIntruder(id);
    setConfirmId(null);
    setSessions((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
  };

  return (
    <div className="ig-overlay">
      <div className="ig-panel">
        <div className="stream-header">
          <h3>Intruder Captures</h3>
          <div className="stream-header__actions">
            <button className="header-icon-btn" aria-label="Refresh" onClick={load}>
              <RefreshCw size={16} strokeWidth={1.8} />
            </button>
            <button className="header-icon-btn" aria-label="Close" onClick={onClose}>
              <X size={18} strokeWidth={1.8} />
            </button>
          </div>
        </div>

        <div className="ig-body">
          {sessions === null ? (
            <p className="hint">Loading…</p>
          ) : sessions.length === 0 ? (
            <div className="ig-empty">
              <ShieldAlert size={28} strokeWidth={1.6} />
              <p className="hint">No captures yet. They appear here after a “Capture &amp; Lock”.</p>
            </div>
          ) : (
            sessions.map((s) => (
              <div key={s.id} className="ig-session">
                <div className="ig-session__head">
                  <span className="ig-session__time">{s.timestamp.replace(/_/g, " ")}</span>
                  {confirmId === s.id ? (
                    <span className="ig-confirm">
                      <button className="ig-confirm__yes" onClick={() => remove(s.id)}>Delete</button>
                      <button className="ig-confirm__no" onClick={() => setConfirmId(null)}>Cancel</button>
                    </span>
                  ) : (
                    <button className="ig-del" aria-label="Delete capture" onClick={() => setConfirmId(s.id)}>
                      <Trash2 size={15} strokeWidth={1.8} />
                    </button>
                  )}
                </div>
                <div className="ig-thumbs">
                  {s.screenshot && (
                    <img
                      className="ig-thumb"
                      src={fileUrl(s.id, s.screenshot)}
                      alt="Screen"
                      onClick={() => setViewer(fileUrl(s.id, s.screenshot))}
                    />
                  )}
                  {s.webcam && (
                    <img
                      className="ig-thumb"
                      src={fileUrl(s.id, s.webcam)}
                      alt="Webcam"
                      onClick={() => setViewer(fileUrl(s.id, s.webcam))}
                    />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {viewer && (
        <div className="ig-viewer" onClick={() => setViewer(null)}>
          <img src={viewer} alt="Capture" />
        </div>
      )}
    </div>
  );
};

export default IntruderGallery;

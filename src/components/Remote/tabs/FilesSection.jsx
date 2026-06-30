import { useEffect, useRef, useState } from "react";
import { Upload, Download, Trash2, RefreshCw, FileIcon } from "lucide-react";
import SectionLabel from "../ui/SectionLabel";

const fmtSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// Files as a full section page (drawer nav). Two-way transfer with the Mac's
// shared folder (~/Desktop/MacController).
const FilesSection = ({ uploadFile, listFiles, deleteFile }) => {
  const [files, setFiles] = useState(null);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const serviceUrl = localStorage.getItem("serviceUrl");
  const token = localStorage.getItem("authToken");
  const downloadUrl = (name) =>
    `${serviceUrl}/files/download?name=${encodeURIComponent(name)}&token=${token}`;

  const load = async () => {
    setFiles(null);
    const res = await listFiles();
    setFiles(res?.status === "success" ? res.files : []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setProgress(0);
    try {
      await uploadFile(file, setProgress);
      await load();
    } catch {
      setError("Upload failed.");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (name) => {
    await deleteFile(name);
    setFiles((prev) => (prev ? prev.filter((f) => f.name !== name) : prev));
  };

  return (
    <div>
      <button
        className="btn-accent btn-block ft-send"
        disabled={progress !== null}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={16} strokeWidth={1.8} />
        {progress !== null ? `Uploading… ${progress}%` : "Send a file to Mac"}
      </button>
      <input ref={inputRef} type="file" hidden onChange={onPick} />
      {error && <div className="error-message">{error}</div>}

      <div className="apps-head">
        <SectionLabel>On Mac (~/Desktop/MacController)</SectionLabel>
        <button className="header-icon-btn" aria-label="Refresh" onClick={load}>
          <RefreshCw size={16} strokeWidth={1.8} />
        </button>
      </div>

      {files === null ? (
        <p className="hint">Loading…</p>
      ) : files.length === 0 ? (
        <p className="hint">No files yet. Send one above, or drop files into the folder on your Mac.</p>
      ) : (
        <div className="ft-list">
          {files.map((f) => (
            <div key={f.name} className="ft-row">
              <FileIcon size={18} strokeWidth={1.7} className="ft-icon" />
              <div className="ft-meta">
                <div className="ft-name">{f.name}</div>
                <div className="ft-size">{fmtSize(f.size)}</div>
              </div>
              <a className="ft-action" href={downloadUrl(f.name)} target="_blank" rel="noreferrer" aria-label="Download">
                <Download size={16} strokeWidth={1.8} />
              </a>
              <button className="ft-action" aria-label="Delete" onClick={() => remove(f.name)}>
                <Trash2 size={15} strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FilesSection;

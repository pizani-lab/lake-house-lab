import { useRef, useState } from "react";
import { postUpload } from "../hooks/useApi";
import { formatBytes } from "../utils/formatters";
import Spinner from "./Spinner";

export default function UploadView({ loggedIn, onShowLogin }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const setFileAndName = (f) => {
    setFile(f);
    setResult(null);
    const slug = f.name.replace(/\.(csv|json)$/i, "").replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
    setName(slug);
    setDisplayName(f.name.replace(/\.(csv|json)$/i, ""));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && (f.name.endsWith(".csv") || f.name.endsWith(".json"))) setFileAndName(f);
  };

  const handleSubmit = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);
    setResult(null);
    try {
      const r = await postUpload(file, name.trim(), displayName.trim());
      setResult({ ok: true, message: r.message });
      setFile(null);
      setName("");
      setDisplayName("");
    } catch (e) {
      setResult({ ok: false, message: e.message === "HTTP 401" ? "Faça login para fazer upload." : e.message });
    } finally {
      setUploading(false);
    }
  };

  if (!loggedIn) {
    return (
      <div className="lh-inline-text">
        Faça <span onClick={onShowLogin} className="lh-link-action">login</span> para fazer upload de arquivos.
      </div>
    );
  }

  return (
    <div className="lh-upload-wrap">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`lh-upload-dropzone ${dragging ? "is-dragging" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          className="lh-hidden"
          onChange={(e) => e.target.files[0] && setFileAndName(e.target.files[0])}
        />

        {file ? (
          <div>
            <div className="lh-upload-file">{file.name}</div>
            <div className="lh-upload-filemeta">{formatBytes(file.size)}</div>
          </div>
        ) : (
          <div>
            <div className="lh-upload-icon">📂</div>
            <div className="lh-upload-title">Solte um arquivo CSV ou JSON aqui</div>
            <div className="lh-upload-subtitle">ou clique para selecionar</div>
          </div>
        )}
      </div>

      <div className="lh-stack-sm lh-upload-fields">
        <div>
          <label className="lh-field-label">Nome da fonte (slug)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: minha-planilha" className="lh-input" />
        </div>
        <div>
          <label className="lh-field-label">Nome de exibição (opcional)</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="ex: Minha Planilha" className="lh-input" />
        </div>
      </div>

      <button onClick={handleSubmit} disabled={uploading || !file || !name.trim()} className="lh-button-primary" style={{ opacity: uploading || !file || !name.trim() ? 0.5 : 1 }}>
        {uploading ? <><Spinner /> Enviando...</> : "Fazer upload e ingerir"}
      </button>

      {result && <div className={`lh-result-box ${result.ok ? "success" : "error"}`}>{result.message}</div>}
    </div>
  );
}

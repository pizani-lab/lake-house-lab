import { useState } from "react";
import { login } from "../hooks/useApi";

export default function LoginModal({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");
    try {
      await login(user, pass);
      onLogin();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lh-modal-overlay">
      <form onSubmit={handleSubmit} className="lh-modal-card">
        <h2 className="lh-modal-title">LakeHouse Lab</h2>
        <p className="lh-modal-subtitle">Login necessário para Query Agent e ações de escrita.</p>

        <div>
          <label className="lh-field-label">Usuário</label>
          <input type="text" value={user} onChange={(e) => setUser(e.target.value)} className="lh-input" />
        </div>

        <div>
          <label className="lh-field-label">Senha</label>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className="lh-input" />
        </div>

        {err && <div className="lh-error-text">{err}</div>}

        <button type="submit" disabled={loading} className="lh-button-primary" style={{ opacity: loading ? 0.6 : 1 }}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

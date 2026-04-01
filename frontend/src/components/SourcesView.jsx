import { useCallback, useEffect, useState } from "react";
import { fetchSources, ingestSource } from "../hooks/useApi";
import { formatDate, formatNumber } from "../utils/formatters";
import Spinner from "./Spinner";

export default function SourcesView() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    fetchSources()
      .then((data) => setSources(Array.isArray(data) ? data : data.results || []))
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleIngest = async (id, name) => {
    setIngesting((prev) => ({ ...prev, [id]: true }));
    try {
      await ingestSource(id);
    } catch (e) {
      alert(`Erro ao ingerir ${name}: ${e.message}`);
    } finally {
      setIngesting((prev) => ({ ...prev, [id]: false }));
      setTimeout(load, 1500);
    }
  };

  if (loading) return <div className="lh-inline-text">Carregando fontes...</div>;
  if (!sources.length) {
    return (
      <div className="lh-inline-text">
        Nenhuma fonte cadastrada. Execute <code>python manage.py seed_sources</code> para criar as fontes demo.
      </div>
    );
  }

  return (
    <div className="lh-stack-sm">
      {sources.map((s, i) => {
        const last = s.last_ingestion;
        const isIngesting = ingesting[s.id];
        return (
          <div key={s.id} className="lh-card fade-up lh-source-card" style={{ animationDelay: `${i * 60}ms` }}>
            <div>
              <div className="lh-source-name">{s.display_name}</div>
              <div className="lh-source-meta">
                Tipo: {s.source_type}
                {last && ` · Última: ${formatDate(last.created_at)} · ${formatNumber(last.rows_loaded)} rows`}
                {last?.status === "failed" && <span className="lh-error-text"> · FALHOU</span>}
              </div>
            </div>

            <button
              onClick={() => handleIngest(s.id, s.display_name)}
              disabled={isIngesting}
              className="lh-button-secondary"
              style={{ opacity: isIngesting ? 0.6 : 1 }}
            >
              {isIngesting && <Spinner />}
              {isIngesting ? "Ingerindo..." : "Ingerir"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

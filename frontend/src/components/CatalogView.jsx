import { useCallback, useEffect, useState } from "react";
import { fetchCatalogTables, fetchTableProfile } from "../hooks/useApi";
import { formatNumber } from "../utils/formatters";
import Badge from "./Badge";

export default function CatalogView() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [profiles, setProfiles] = useState({});

  useEffect(() => {
    fetchCatalogTables()
      .then((data) => {
        const enriched = data.map((t) => ({
          ...t,
          layer: t.name.startsWith("gold_") ? "gold" : t.name.startsWith("silver_") ? "silver" : "bronze",
        }));
        setTables(enriched);
      })
      .catch(() => setTables([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = useCallback(async (name) => {
    if (expanded === name) {
      setExpanded(null);
      return;
    }
    setExpanded(name);
    if (!profiles[name]) {
      try {
        const p = await fetchTableProfile(name);
        setProfiles((prev) => ({ ...prev, [name]: p }));
      } catch (_) {}
    }
  }, [expanded, profiles]);

  const layers = ["bronze", "silver", "gold"];

  if (loading) return <div className="lh-inline-text">Carregando catálogo...</div>;
  if (!tables.length) {
    return <div className="lh-inline-text">Nenhuma tabela encontrada. Ingira dados e execute o dbt para popular o catálogo.</div>;
  }

  return (
    <div>
      {layers.map((layer) => {
        const layerTables = tables.filter((t) => t.layer === layer);
        if (!layerTables.length) return null;

        return (
          <div key={layer} className="lh-catalog-section">
            <div className="lh-catalog-head">
              <Badge layer={layer} />
              <span className="lh-muted">{layerTables.length} tabela{layerTables.length > 1 ? "s" : ""}</span>
            </div>

            <div className="lh-catalog-list">
              {layerTables.map((t) => {
                const profile = profiles[t.name];
                const isOpen = expanded === t.name;
                return (
                  <div key={t.name} className="lh-card fade-up">
                    <div className="lh-catalog-item-head" onClick={() => toggleExpand(t.name)}>
                      <div>
                        <span className="lh-mono-strong">{t.name}</span>
                        {profile && <div className="lh-catalog-columns">{profile.columns.map((c) => c.name).join(", ")}</div>}
                      </div>
                      <div className="lh-catalog-meta">
                        {profile && <span className="lh-accent-text">{formatNumber(profile.row_count)} rows</span>}
                        <span className="lh-muted">{isOpen ? "▲" : "▼"}</span>
                      </div>
                    </div>

                    {isOpen && profile && (
                      <div className="lh-table-wrap lh-table-topborder">
                        <table className="lh-table lh-table-compact">
                          <thead>
                            <tr>
                              {["coluna", "tipo", "nulls%", "distintos", "min", "max"].map((h) => <th key={h}>{h}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {profile.columns.map((c) => (
                              <tr key={c.name}>
                                <td className="is-number lh-text-accent-strong">{c.name}</td>
                                <td>{c.dtype}</td>
                                <td>{c.null_pct ?? "-"}%</td>
                                <td>{c.distinct_count ?? "-"}</td>
                                <td>{c.min ?? "-"}</td>
                                <td>{c.max ?? "-"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

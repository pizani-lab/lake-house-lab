import { useEffect, useState } from "react";
import { fetchDbtLineage } from "../hooks/useApi";

const LAYER_ORDER = ["staging", "intermediate", "marts"];
const LAYER_LABEL = { staging: "Staging", intermediate: "Intermediate", marts: "Marts" };
const LAYER_COLOR = { staging: "var(--bronze)", intermediate: "var(--silver)", marts: "var(--gold)" };

export default function LineageView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDbtLineage()
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="lh-inline-text">Carregando lineage...</div>;
  if (error) return <div className="lh-error-text">{error}</div>;
  if (!data?.nodes?.length) {
    return <div className="lh-inline-text">{data?.error || "Nenhum modelo encontrado. Execute dbt run para gerar o manifest."}</div>;
  }

  const nodeById = Object.fromEntries(data.nodes.map((n) => [n.id, n]));
  const upstreamOf = {};
  data.edges.forEach(({ source, target }) => {
    if (!upstreamOf[target]) upstreamOf[target] = [];
    const srcNode = nodeById[source];
    if (srcNode) upstreamOf[target].push(srcNode.name);
  });

  return (
    <div className="lh-lineage-grid">
      {LAYER_ORDER.map((layer) => {
        const nodes = data.nodes.filter((n) => n.layer === layer);
        if (!nodes.length) return null;
        return (
          <div key={layer} className="lh-lineage-column">
            <div className="lh-lineage-head" style={{ borderBottom: `2px solid ${LAYER_COLOR[layer]}40` }}>
              <div className="lh-lineage-dot" style={{ background: LAYER_COLOR[layer] }} />
              <span className="lh-lineage-title" style={{ color: LAYER_COLOR[layer] }}>{LAYER_LABEL[layer]}</span>
              <span className="lh-muted">({nodes.length})</span>
            </div>

            <div className="lh-lineage-list">
              {nodes.map((node) => (
                <div key={node.id} className="lh-card lh-lineage-node" style={{ border: `1px solid ${LAYER_COLOR[layer]}30` }}>
                  <div className="lh-mono-strong">{node.name}</div>
                  {node.description && <div className="lh-lineage-desc">{node.description}</div>}
                  {upstreamOf[node.id]?.length > 0 && <div className="lh-lineage-upstream">← {upstreamOf[node.id].join(", ")}</div>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

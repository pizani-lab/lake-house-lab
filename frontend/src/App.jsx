import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
  postQuery, fetchSources, fetchCatalogTables, fetchTableProfile,
  fetchQueryHistory, ingestSource, runDbt, login, logout, isLoggedIn,
  fetchCatalogSchema, fetchDbtLineage, postUpload,
} from "./hooks/useApi";
import { formatBytes, formatNumber, formatDate, LAYER_COLORS } from "./utils/formatters";

// ──────────────────────────────────────────────
// Design system
// ──────────────────────────────────────────────

const css = `
  :root {
    --bg:#070710; --surface:#0f0f1a; --surface2:#181828; --border:#222240;
    --fg:#eeeef6; --muted:#6e6e98; --accent:#10b981; --accent-dim:#10b98115;
    --bronze:#CD7F32; --silver:#C0C0C0; --gold:#FFD700;
    --font:'Space Grotesk',system-ui,sans-serif;
    --mono:'JetBrains Mono','SF Mono',monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--font);background:var(--bg);color:var(--fg)}
  ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
  @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  .fade-up{animation:fadeUp .35s ease-out both}
  textarea:focus,input:focus,select:focus{outline:none;border-color:var(--accent)!important}
  button:focus{outline:none}
`;

const CHART_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

// ──────────────────────────────────────────────
// Atoms
// ──────────────────────────────────────────────

function Badge({ layer }) {
  const c = LAYER_COLORS[layer] || { color: "#6e6e98", bg: "#6e6e9818" };
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 4, fontSize: 10, fontWeight: 600,
      fontFamily: "var(--mono)", color: c.color, background: c.bg,
      border: `1px solid ${c.color}30`, textTransform: "uppercase", letterSpacing: 1,
    }}>
      {layer}
    </span>
  );
}

function Metric({ label, value, sub, color = "var(--accent)" }) {
  return (
    <div style={{
      padding: "16px 18px", background: "var(--surface)", borderRadius: 10,
      border: "1px solid var(--border)", flex: 1, minWidth: 130,
    }}>
      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--mono)", color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Spinner() {
  return <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />;
}

// ──────────────────────────────────────────────
// Chart
// ──────────────────────────────────────────────

function DataChart({ query }) {
  if (!query.result_preview?.length || query.chart_type === "none") return null;
  const cols = query.result_columns;
  const rows = query.result_preview;
  const data = rows.map(r => {
    const obj = {};
    cols.forEach((c, i) => { obj[c] = r[i]; });
    return obj;
  });
  const labelKey = cols[0];
  const valueKey = cols.length > 1 ? cols[1] : cols[0];

  const tooltipStyle = {
    contentStyle: { background: "#181828", border: "1px solid #222240", borderRadius: 8, fontSize: 12, color: "#eeeef6" },
  };

  if (query.chart_type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey={valueKey} nameKey={labelKey} cx="50%" cy="50%" outerRadius={80} label={({ name }) => name}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip {...tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (query.chart_type === "line") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis dataKey={labelKey} tick={{ fill: "#6e6e98", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "#6e6e98", fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
          <Tooltip {...tooltipStyle} />
          <Line type="monotone" dataKey={valueKey} stroke="var(--accent)" strokeWidth={2} dot={{ fill: "var(--accent)", r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} barGap={4}>
        <XAxis dataKey={labelKey} tick={{ fill: "#6e6e98", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#6e6e98", fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey={valueKey} fill="var(--accent)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ──────────────────────────────────────────────
// QueryResult
// ──────────────────────────────────────────────

function QueryResult({ query }) {
  return (
    <div className="fade-up" style={{
      background: "var(--surface)", borderRadius: 10, border: "1px solid var(--border)",
      marginBottom: 12, overflow: "hidden",
    }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>{query.user_question}</div>
        {query.generated_sql && (
          <div style={{
            padding: "8px 12px", background: "var(--surface2)", borderRadius: 6,
            fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)", whiteSpace: "pre-wrap",
          }}>
            {query.generated_sql}
          </div>
        )}
        {query.error_message && (
          <div style={{ marginTop: 6, fontSize: 12, color: "#ef4444", fontFamily: "var(--mono)" }}>
            Erro: {query.error_message}
          </div>
        )}
        <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          <span>{formatNumber(query.row_count)} rows</span>
          <span>{query.execution_time_ms}ms</span>
          <span>{query.tokens_used} tokens</span>
          <span style={{ textTransform: "uppercase", letterSpacing: 1 }}>{query.chart_type}</span>
          {query.llm_provider && (
            <span style={{ fontFamily: "var(--mono)", color: "var(--accent)", opacity: 0.7 }}>
              {query.llm_provider}{query.llm_model ? ` · ${query.llm_model}` : ""}
            </span>
          )}
        </div>
      </div>

      {query.chart_type && query.chart_type !== "table" && query.result_preview?.length > 0 && (
        <div style={{ padding: "12px 16px" }}>
          <DataChart query={query} />
        </div>
      )}

      {query.result_preview?.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "var(--mono)" }}>
            <thead>
              <tr>
                {query.result_columns.map((c, i) => (
                  <th key={i} style={{
                    padding: "8px 14px", textAlign: "left", borderBottom: "1px solid var(--border)",
                    color: "var(--muted)", fontWeight: 500, fontSize: 11,
                  }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {query.result_preview.slice(0, 10).map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  {(Array.isArray(row) ? row : query.result_columns.map(c => row[c])).map((cell, j) => (
                    <td key={j} style={{
                      padding: "8px 14px",
                      color: typeof cell === "number" ? "var(--accent)" : "var(--fg)",
                    }}>
                      {typeof cell === "number" ? formatNumber(cell) : String(cell ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// QueryBar
// ──────────────────────────────────────────────

const PROVIDER_OPTIONS = [
  { value: "anthropic", label: "Claude (Anthropic)" },
  { value: "ollama", label: "Ollama (local)" },
];

const MODEL_OPTIONS = {
  anthropic: [
    { value: "", label: "Padrão (.env)" },
    { value: "claude-sonnet-4-20250514", label: "claude-sonnet-4" },
    { value: "claude-haiku-4-5-20251001", label: "claude-haiku-4" },
  ],
  ollama: [
    { value: "", label: "Padrão (.env)" },
    { value: "llama3", label: "llama3" },
    { value: "mistral", label: "mistral" },
    { value: "qwen2.5-coder", label: "qwen2.5-coder" },
    { value: "deepseek-r1", label: "deepseek-r1" },
  ],
};

function QueryBar({ onResult }) {
  const [question, setQuestion] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [schema, setSchema] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchCatalogSchema().then(s => setSchema(s)).catch(() => {});
  }, []);

  // Constrói lista flat: nomes de tabelas + "tabela.coluna"
  const allSuggestions = useMemo(() => {
    const tables = Object.keys(schema);
    const cols = tables.flatMap(t => schema[t].map(c => `${t}.${c}`));
    return [...tables, ...cols];
  }, [schema]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuestion(val);
    const pos = e.target.selectionStart ?? val.length;
    // Extrai palavra atual (até o cursor)
    const before = val.slice(0, pos);
    const match = before.match(/[\w.]+$/);
    const word = match ? match[0] : "";
    if (word.length >= 2) {
      const lower = word.toLowerCase();
      const filtered = allSuggestions.filter(s => s.toLowerCase().startsWith(lower) && s.toLowerCase() !== lower);
      setSuggestions(filtered.slice(0, 6));
      setActiveIdx(-1);
    } else {
      setSuggestions([]);
    }
  };

  const applySuggestion = (suggestion) => {
    const pos = inputRef.current?.selectionStart ?? question.length;
    const before = question.slice(0, pos);
    const after = question.slice(pos);
    const wordStart = before.search(/[\w.]+$/);
    const newText = (wordStart >= 0 ? before.slice(0, wordStart) : before) + suggestion + after;
    setQuestion(newText);
    setSuggestions([]);
    setActiveIdx(-1);
    setTimeout(() => {
      const newPos = (wordStart >= 0 ? wordStart : before.length) + suggestion.length;
      inputRef.current?.setSelectionRange(newPos, newPos);
      inputRef.current?.focus();
    }, 0);
  };

  const handleProviderChange = (val) => { setProvider(val); setModel(""); };

  const handleSubmit = async () => {
    if (!question.trim()) return;
    setSuggestions([]);
    setLoading(true);
    setErrorMsg("");
    try {
      const result = await postQuery(question, { provider: provider || null, model: model || null });
      onResult?.(result);
    } catch (e) {
      setErrorMsg(e.message === "HTTP 401" ? "Faça login para usar o Query Agent." : e.message);
    } finally {
      setLoading(false);
      setQuestion("");
    }
  };

  const handleKeyDown = (e) => {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); return; }
      if ((e.key === "Tab" || e.key === "Enter") && activeIdx >= 0) {
        e.preventDefault();
        applySuggestion(suggestions[activeIdx]);
        return;
      }
      if (e.key === "Escape") { setSuggestions([]); return; }
    }
    if (e.key === "Enter") handleSubmit();
  };

  const selectStyle = {
    padding: "12px 10px", background: "var(--surface)",
    border: "1px solid var(--border)", borderRadius: 10,
    color: "var(--fg)", fontFamily: "var(--font)", fontSize: 12, cursor: "pointer",
  };

  const modelChoices = MODEL_OPTIONS[provider] || MODEL_OPTIONS.anthropic;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <select value={provider} onChange={e => handleProviderChange(e.target.value)} style={selectStyle}>
          <option value="">Provider (padrão)</option>
          {PROVIDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={model} onChange={e => setModel(e.target.value)} style={selectStyle}>
          {modelChoices.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, position: "relative" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <input
            ref={inputRef}
            value={question}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setSuggestions([]), 150)}
            placeholder="Pergunte algo sobre os dados... (ex: Quantos municípios por região?)"
            style={{
              width: "100%", padding: "12px 16px", background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: 10,
              color: "var(--fg)", fontFamily: "var(--font)", fontSize: 13,
            }}
          />
          {suggestions.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: 8, marginTop: 4, overflow: "hidden", boxShadow: "0 8px 24px #00000060",
            }}>
              {suggestions.map((s, i) => {
                const isTable = !s.includes(".");
                return (
                  <div
                    key={s}
                    onMouseDown={() => applySuggestion(s)}
                    style={{
                      padding: "8px 14px", cursor: "pointer", fontSize: 12,
                      fontFamily: "var(--mono)", display: "flex", alignItems: "center", gap: 10,
                      background: i === activeIdx ? "var(--accent-dim)" : "transparent",
                      borderBottom: i < suggestions.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase",
                      color: isTable ? "var(--gold)" : "var(--accent)", opacity: 0.8, minWidth: 30,
                    }}>
                      {isTable ? "TBL" : "COL"}
                    </span>
                    <span style={{ color: "var(--fg)" }}>{s}</span>
                  </div>
                );
              })}
              <div style={{ padding: "4px 14px", fontSize: 10, color: "var(--muted)", borderTop: "1px solid var(--border)" }}>
                ↑↓ navegar · Tab/Enter selecionar · Esc fechar
              </div>
            </div>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={loading || !question.trim()}
          style={{
            padding: "12px 24px", background: "var(--accent)", border: "none", color: "#000",
            borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 700,
            fontFamily: "var(--font)", opacity: loading || !question.trim() ? 0.5 : 1,
            display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
          }}
        >
          {loading ? <><Spinner /> Consultando</> : "Consultar"}
        </button>
      </div>
      {errorMsg && <div style={{ marginTop: 6, fontSize: 12, color: "#ef4444" }}>{errorMsg}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────
// CatalogView — consome /api/catalog/discover/
// ──────────────────────────────────────────────

function CatalogView() {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [profiles, setProfiles] = useState({});

  useEffect(() => {
    fetchCatalogTables()
      .then(data => {
        // Enriquece com layer inferida pelo prefixo do nome
        const enriched = data.map(t => ({
          ...t,
          layer: t.name.startsWith("gold_") ? "gold"
               : t.name.startsWith("silver_") ? "silver"
               : "bronze",
        }));
        setTables(enriched);
      })
      .catch(() => setTables([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleExpand = useCallback(async (name) => {
    if (expanded === name) { setExpanded(null); return; }
    setExpanded(name);
    if (!profiles[name]) {
      try {
        const p = await fetchTableProfile(name);
        setProfiles(prev => ({ ...prev, [name]: p }));
      } catch (_) {}
    }
  }, [expanded, profiles]);

  const layers = ["bronze", "silver", "gold"];

  if (loading) return <div style={{ color: "var(--muted)", fontSize: 13 }}>Carregando catálogo...</div>;
  if (!tables.length) return (
    <div style={{ color: "var(--muted)", fontSize: 13 }}>
      Nenhuma tabela encontrada. Ingira dados e execute o dbt para popular o catálogo.
    </div>
  );

  return (
    <div>
      {layers.map(layer => {
        const layerTables = tables.filter(t => t.layer === layer);
        if (!layerTables.length) return null;
        return (
          <div key={layer} style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <Badge layer={layer} />
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {layerTables.length} tabela{layerTables.length > 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {layerTables.map(t => {
                const profile = profiles[t.name];
                const isOpen = expanded === t.name;
                return (
                  <div key={t.name} className="fade-up" style={{
                    background: "var(--surface)", borderRadius: 10, border: "1px solid var(--border)",
                    overflow: "hidden",
                  }}>
                    <div
                      onClick={() => toggleExpand(t.name)}
                      style={{
                        padding: "14px 18px", cursor: "pointer",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}
                    >
                      <div>
                        <span style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 500 }}>{t.name}</span>
                        {profile && (
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                            {profile.columns.map(c => c.name).join(", ")}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {profile && (
                          <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--accent)" }}>
                            {formatNumber(profile.row_count)} rows
                          </span>
                        )}
                        <span style={{ color: "var(--muted)", fontSize: 16 }}>{isOpen ? "▲" : "▼"}</span>
                      </div>
                    </div>
                    {isOpen && profile && (
                      <div style={{ borderTop: "1px solid var(--border)", overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "var(--mono)" }}>
                          <thead>
                            <tr>
                              {["coluna", "tipo", "nulls%", "distintos", "min", "max"].map(h => (
                                <th key={h} style={{ padding: "6px 12px", textAlign: "left", borderBottom: "1px solid var(--border)", color: "var(--muted)", fontWeight: 500 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {profile.columns.map(c => (
                              <tr key={c.name} style={{ borderBottom: "1px solid var(--border)" }}>
                                <td style={{ padding: "6px 12px", color: "var(--accent)" }}>{c.name}</td>
                                <td style={{ padding: "6px 12px", color: "var(--muted)" }}>{c.dtype}</td>
                                <td style={{ padding: "6px 12px" }}>{c.null_pct ?? "-"}%</td>
                                <td style={{ padding: "6px 12px" }}>{c.distinct_count ?? "-"}</td>
                                <td style={{ padding: "6px 12px" }}>{c.min ?? "-"}</td>
                                <td style={{ padding: "6px 12px" }}>{c.max ?? "-"}</td>
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

// ──────────────────────────────────────────────
// SourcesView — consome /api/sources/
// ──────────────────────────────────────────────

function SourcesView() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    fetchSources()
      .then(data => setSources(Array.isArray(data) ? data : data.results || []))
      .catch(() => setSources([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleIngest = async (id, name) => {
    setIngesting(prev => ({ ...prev, [id]: true }));
    try {
      await ingestSource(id);
    } catch (e) {
      alert(`Erro ao ingerir ${name}: ${e.message}`);
    } finally {
      setIngesting(prev => ({ ...prev, [id]: false }));
      setTimeout(load, 1500);
    }
  };

  if (loading) return <div style={{ color: "var(--muted)", fontSize: 13 }}>Carregando fontes...</div>;
  if (!sources.length) return (
    <div style={{ color: "var(--muted)", fontSize: 13 }}>
      Nenhuma fonte cadastrada. Execute <code style={{ fontFamily: "var(--mono)", color: "var(--accent)" }}>python manage.py seed_sources</code> para criar as fontes demo.
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {sources.map((s, i) => {
        const last = s.last_ingestion;
        const isIngesting = ingesting[s.id];
        return (
          <div key={s.id} className="fade-up" style={{
            animationDelay: `${i * 60}ms`,
            padding: "16px 18px", background: "var(--surface)", borderRadius: 10,
            border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{s.display_name}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                Tipo: {s.source_type}
                {last && ` · Última: ${formatDate(last.created_at)} · ${formatNumber(last.rows_loaded)} rows`}
                {last?.status === "failed" && <span style={{ color: "#ef4444" }}> · FALHOU</span>}
              </div>
            </div>
            <button
              onClick={() => handleIngest(s.id, s.display_name)}
              disabled={isIngesting}
              style={{
                padding: "6px 14px", background: "var(--accent-dim)",
                border: "1px solid #10b98130", color: "var(--accent)", borderRadius: 6,
                cursor: isIngesting ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 600,
                fontFamily: "var(--font)", opacity: isIngesting ? 0.6 : 1,
                display: "flex", alignItems: "center", gap: 6,
              }}
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

// ──────────────────────────────────────────────
// DbtPanel
// ──────────────────────────────────────────────

function DbtPanel() {
  const [running, setRunning] = useState(false);
  const [lastOutput, setLastOutput] = useState("");
  const [select, setSelect] = useState("");

  const handleRun = async (command) => {
    setRunning(true);
    setLastOutput("");
    try {
      const r = await runDbt(command, select);
      setLastOutput(`dbt ${command} disparado. ${r.message || ""}`);
    } catch (e) {
      setLastOutput(`Erro: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <input
          value={select}
          onChange={e => setSelect(e.target.value)}
          placeholder="--select (opcional, ex: staging, +marts)"
          style={{
            flex: 1, padding: "10px 14px", background: "var(--surface)",
            border: "1px solid var(--border)", borderRadius: 8,
            color: "var(--fg)", fontFamily: "var(--mono)", fontSize: 12,
          }}
        />
        {["run", "build", "test"].map(cmd => (
          <button
            key={cmd}
            onClick={() => handleRun(cmd)}
            disabled={running}
            style={{
              padding: "10px 18px", background: cmd === "run" ? "var(--accent)" : "var(--accent-dim)",
              border: cmd !== "run" ? "1px solid #10b98130" : "none",
              color: cmd === "run" ? "#000" : "var(--accent)",
              borderRadius: 8, cursor: running ? "not-allowed" : "pointer",
              fontSize: 12, fontWeight: 600, fontFamily: "var(--font)",
              opacity: running ? 0.6 : 1,
            }}
          >
            dbt {cmd}
          </button>
        ))}
      </div>
      {lastOutput && (
        <div style={{
          padding: "12px 16px", background: "var(--surface2)", borderRadius: 8,
          fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)",
          border: "1px solid var(--border)",
        }}>
          {lastOutput}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// LoginModal
// ──────────────────────────────────────────────

function LoginModal({ onLogin }) {
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
    <div style={{
      position: "fixed", inset: 0, background: "#00000080",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <form onSubmit={handleSubmit} style={{
        background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)",
        padding: "32px 36px", width: 340, display: "flex", flexDirection: "column", gap: 14,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>LakeHouse Lab</h2>
        <p style={{ fontSize: 12, color: "var(--muted)" }}>Login necessário para Query Agent e ações de escrita.</p>
        {["Usuário", "Senha"].map((label, idx) => (
          <div key={label}>
            <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>{label}</label>
            <input
              type={idx === 1 ? "password" : "text"}
              value={idx === 0 ? user : pass}
              onChange={e => idx === 0 ? setUser(e.target.value) : setPass(e.target.value)}
              style={{
                width: "100%", padding: "10px 12px", background: "var(--bg)",
                border: "1px solid var(--border)", borderRadius: 8,
                color: "var(--fg)", fontFamily: "var(--font)", fontSize: 13,
              }}
            />
          </div>
        ))}
        {err && <div style={{ fontSize: 12, color: "#ef4444" }}>{err}</div>}
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "11px", background: "var(--accent)", border: "none", color: "#000",
            borderRadius: 8, cursor: "pointer", fontWeight: 700, fontFamily: "var(--font)",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

// ──────────────────────────────────────────────
// LineageView — grafo dbt a partir do manifest
// ──────────────────────────────────────────────

const LAYER_ORDER = ["staging", "intermediate", "marts"];
const LAYER_LABEL = { staging: "Staging", intermediate: "Intermediate", marts: "Marts" };
const LAYER_COLOR = { staging: "var(--bronze)", intermediate: "var(--silver)", marts: "var(--gold)" };

function LineageView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDbtLineage()
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "var(--muted)", fontSize: 13 }}>Carregando lineage...</div>;
  if (error) return <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>;
  if (!data?.nodes?.length) return (
    <div style={{ color: "var(--muted)", fontSize: 13 }}>
      {data?.error || "Nenhum modelo encontrado. Execute dbt run para gerar o manifest."}
    </div>
  );

  // Mapeia id → node
  const nodeById = Object.fromEntries(data.nodes.map(n => [n.id, n]));
  // Para cada nó, quais nós são upstream (sources)
  const upstreamOf = {};
  data.edges.forEach(({ source, target }) => {
    if (!upstreamOf[target]) upstreamOf[target] = [];
    const srcNode = nodeById[source];
    if (srcNode) upstreamOf[target].push(srcNode.name);
  });

  return (
    <div style={{ display: "flex", gap: 0, overflowX: "auto" }}>
      {LAYER_ORDER.map((layer, li) => {
        const nodes = data.nodes.filter(n => n.layer === layer);
        if (!nodes.length) return null;
        return (
          <div key={layer} style={{ flex: 1, minWidth: 180, display: "flex", flexDirection: "column" }}>
            {/* Cabeçalho da camada */}
            <div style={{
              padding: "8px 16px", marginBottom: 12,
              borderBottom: `2px solid ${LAYER_COLOR[layer]}40`,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: LAYER_COLOR[layer] }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: LAYER_COLOR[layer] }}>
                {LAYER_LABEL[layer]}
              </span>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>({nodes.length})</span>
            </div>

            {/* Nós da camada */}
            <div style={{ padding: "0 8px", display: "flex", flexDirection: "column", gap: 8 }}>
              {nodes.map(node => (
                <div key={node.id} style={{
                  padding: "10px 14px", background: "var(--surface)", borderRadius: 8,
                  border: `1px solid ${LAYER_COLOR[layer]}30`,
                  display: "flex", flexDirection: "column", gap: 4, position: "relative",
                }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 600, color: "var(--fg)" }}>
                    {node.name}
                  </div>
                  {node.description && (
                    <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.4 }}>
                      {node.description}
                    </div>
                  )}
                  {upstreamOf[node.id]?.length > 0 && (
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                      ← {upstreamOf[node.id].join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Seta entre colunas */}
            {li < LAYER_ORDER.length - 1 && (
              <div style={{
                position: "absolute", right: -16, top: "50%", transform: "translateY(-50%)",
                color: "var(--muted)", fontSize: 18, pointerEvents: "none",
              }}>→</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────
// UploadView — drag-and-drop CSV/JSON
// ──────────────────────────────────────────────

function UploadView({ loggedIn, onShowLogin }) {
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

  const inputStyle = {
    width: "100%", padding: "10px 14px", background: "var(--surface)",
    border: "1px solid var(--border)", borderRadius: 8,
    color: "var(--fg)", fontFamily: "var(--font)", fontSize: 13,
  };

  if (!loggedIn) return (
    <div style={{ fontSize: 13, color: "var(--muted)" }}>
      Faça <span onClick={onShowLogin} style={{ color: "var(--accent)", cursor: "pointer" }}>login</span> para fazer upload de arquivos.
    </div>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: "40px 24px", borderRadius: 12, cursor: "pointer", textAlign: "center",
          border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
          background: dragging ? "var(--accent-dim)" : "var(--surface)",
          transition: "all 0.15s", marginBottom: 16,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          style={{ display: "none" }}
          onChange={e => e.target.files[0] && setFileAndName(e.target.files[0])}
        />
        {file ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--accent)", marginBottom: 4 }}>{file.name}</div>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>{(file.size / 1024).toFixed(1)} KB</div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 13, color: "var(--muted)" }}>Solte um arquivo CSV ou JSON aqui</div>
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>ou clique para selecionar</div>
          </div>
        )}
      </div>

      {/* Campos nome */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Nome da fonte (slug)</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="ex: minha-planilha" style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Nome de exibição (opcional)</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="ex: Minha Planilha" style={inputStyle} />
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={uploading || !file || !name.trim()}
        style={{
          padding: "11px 28px", background: "var(--accent)", border: "none", color: "#000",
          borderRadius: 8, cursor: "pointer", fontWeight: 700, fontFamily: "var(--font)",
          fontSize: 13, opacity: uploading || !file || !name.trim() ? 0.5 : 1,
          display: "flex", alignItems: "center", gap: 8,
        }}
      >
        {uploading ? <><Spinner /> Enviando...</> : "Fazer upload e ingerir"}
      </button>

      {result && (
        <div style={{
          marginTop: 14, padding: "10px 14px", borderRadius: 8, fontSize: 12,
          background: result.ok ? "var(--accent-dim)" : "#ef444415",
          border: `1px solid ${result.ok ? "#10b98130" : "#ef444430"}`,
          color: result.ok ? "var(--accent)" : "#ef4444",
        }}>
          {result.message}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────
// App
// ──────────────────────────────────────────────

const VIEWS = [
  { k: "query", l: "Query Agent" },
  { k: "catalog", l: "Catálogo" },
  { k: "sources", l: "Fontes" },
  { k: "upload", l: "Upload" },
  { k: "dbt", l: "dbt" },
  { k: "lineage", l: "Lineage" },
];

export default function App() {
  const [view, setView] = useState("query");
  const [queries, setQueries] = useState([]);
  const [loggedIn, setLoggedIn] = useState(isLoggedIn());
  const [showLogin, setShowLogin] = useState(false);

  // Carrega histórico de queries na montagem
  useEffect(() => {
    fetchQueryHistory().then(data => setQueries(data || [])).catch(() => {});
  }, []);

  const handleResult = (result) => setQueries(prev => [result, ...prev]);

  const handleLogout = () => {
    logout();
    setLoggedIn(false);
  };

  return (
    <>
      <style>{css}</style>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {showLogin && (
        <LoginModal onLogin={() => { setLoggedIn(true); setShowLogin(false); }} />
      )}

      <div style={{ minHeight: "100vh", maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        {/* Header */}
        <header style={{
          padding: "20px 0", borderBottom: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }} onClick={() => setView("query")}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, background: "var(--accent-dim)",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "1px solid #10b98130", fontSize: 20,
            }}>
              🏠
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.3 }}>LakeHouse Lab</h1>
              <p style={{ fontSize: 11, color: "var(--muted)", fontFamily: "var(--mono)" }}>dbt + DuckDB + Text-to-SQL</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["bronze", "silver", "gold"].map(l => (
                <div key={l} style={{ width: 8, height: 8, borderRadius: "50%", background: `var(--${l})` }} title={l} />
              ))}
            </div>
            {loggedIn ? (
              <button
                onClick={handleLogout}
                style={{
                  padding: "6px 14px", background: "transparent", border: "1px solid var(--border)",
                  color: "var(--muted)", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "var(--font)",
                }}
              >
                Sair
              </button>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                style={{
                  padding: "6px 14px", background: "var(--accent-dim)", border: "1px solid #10b98130",
                  color: "var(--accent)", borderRadius: 6, cursor: "pointer", fontSize: 11,
                  fontWeight: 600, fontFamily: "var(--font)",
                }}
              >
                Login
              </button>
            )}
          </div>
        </header>

        {/* Nav */}
        <nav style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
          {VIEWS.map(v => (
            <button key={v.k} onClick={() => setView(v.k)} style={{
              padding: "10px 18px", background: "transparent", border: "none",
              borderBottom: view === v.k ? "2px solid var(--accent)" : "2px solid transparent",
              color: view === v.k ? "var(--fg)" : "var(--muted)",
              cursor: "pointer", fontFamily: "var(--font)", fontSize: 12,
              fontWeight: view === v.k ? 600 : 400,
            }}>
              {v.l}
            </button>
          ))}
        </nav>

        {/* Metrics bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          <Metric label="Queries" value={queries.length} sub="text-to-SQL" />
        </div>

        {/* Main content */}
        <main>
          {view === "query" && (
            <>
              {!loggedIn && (
                <div style={{
                  padding: "10px 16px", background: "var(--surface)", borderRadius: 8,
                  border: "1px solid var(--border)", fontSize: 12, color: "var(--muted)",
                  marginBottom: 16,
                }}>
                  Faça <span onClick={() => setShowLogin(true)} style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}>login</span> para usar o Query Agent.
                </div>
              )}
              <QueryBar onResult={handleResult} />
              {queries.length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 12 }}>
                  Consultas recentes
                </div>
              )}
              {queries.map((q, i) => <QueryResult key={q.id || i} query={q} />)}
            </>
          )}

          {view === "catalog" && <CatalogView />}

          {view === "sources" && <SourcesView />}

          {view === "upload" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>
                Upload de arquivo
              </div>
              <UploadView loggedIn={loggedIn} onShowLogin={() => setShowLogin(true)} />
            </div>
          )}

          {view === "dbt" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>
                Executar dbt
              </div>
              {!loggedIn ? (
                <div style={{ fontSize: 13, color: "var(--muted)" }}>
                  Faça <span onClick={() => setShowLogin(true)} style={{ color: "var(--accent)", cursor: "pointer" }}>login</span> para executar o dbt.
                </div>
              ) : (
                <DbtPanel />
              )}
            </div>
          )}

          {view === "lineage" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>
                dbt Lineage
              </div>
              <LineageView />
            </div>
          )}
        </main>

        <footer style={{
          padding: "20px 0", marginTop: 40, borderTop: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", fontSize: 11,
          color: "var(--muted)", fontFamily: "var(--mono)",
        }}>
          <span>LakeHouse Lab v1.0 · Django + dbt + DuckDB + Text-to-SQL</span>
          <span>Daniel Pizani · 2026</span>
        </footer>
      </div>
    </>
  );
}

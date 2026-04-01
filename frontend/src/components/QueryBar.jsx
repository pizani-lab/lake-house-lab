import { useEffect, useMemo, useRef, useState } from "react";
import { postQuery, fetchCatalogSchema } from "../hooks/useApi";
import Spinner from "./Spinner";

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

export default function QueryBar({ onResult }) {
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
    fetchCatalogSchema().then((s) => setSchema(s)).catch(() => {});
  }, []);

  const allSuggestions = useMemo(() => {
    const tables = Object.keys(schema || {});
    const cols = tables.flatMap((t) => (schema[t] || []).map((c) => `${t}.${c}`));
    return [...tables, ...cols];
  }, [schema]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuestion(val);
    const pos = e.target.selectionStart ?? val.length;
    const before = val.slice(0, pos);
    const match = before.match(/[\w.]+$/);
    const word = match ? match[0] : "";

    if (word.length >= 2) {
      const lower = word.toLowerCase();
      const filtered = allSuggestions.filter(
        (s) => s.toLowerCase().startsWith(lower) && s.toLowerCase() !== lower,
      );
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
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, -1));
        return;
      }
      if ((e.key === "Tab" || e.key === "Enter") && activeIdx >= 0) {
        e.preventDefault();
        applySuggestion(suggestions[activeIdx]);
        return;
      }
      if (e.key === "Escape") {
        setSuggestions([]);
        return;
      }
    }
    if (e.key === "Enter") handleSubmit();
  };

  const modelChoices = MODEL_OPTIONS[provider] || MODEL_OPTIONS.anthropic;

  return (
    <div className="lh-querybar">
      <div className="lh-querybar-controls">
        <select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(""); }} className="lh-select lh-select-inline">
          <option value="">Provider (padrão)</option>
          {PROVIDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select value={model} onChange={(e) => setModel(e.target.value)} className="lh-select lh-select-inline">
          {modelChoices.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="lh-querybar-main">
        <div className="lh-querybar-inputwrap">
          <input
            ref={inputRef}
            value={question}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setSuggestions([]), 150)}
            placeholder="Pergunte algo sobre os dados... (ex: Quantos municípios por região?)"
            className="lh-input"
          />

          {suggestions.length > 0 && (
            <div className="lh-suggestions">
              {suggestions.map((s, i) => {
                const isTable = !s.includes(".");
                return (
                  <div
                    key={s}
                    onMouseDown={() => applySuggestion(s)}
                    className={`lh-suggestion-item ${i === activeIdx ? "active" : ""}`}
                  >
                    <span className={`lh-suggestion-tag ${isTable ? "table" : "column"}`}>
                      {isTable ? "TBL" : "COL"}
                    </span>
                    <span>{s}</span>
                  </div>
                );
              })}
              <div className="lh-suggestion-help">↑↓ navegar · Tab/Enter selecionar · Esc fechar</div>
            </div>
          )}
        </div>

        <button onClick={handleSubmit} disabled={loading || !question.trim()} className="lh-button-primary" style={{ opacity: loading || !question.trim() ? 0.5 : 1 }}>
          {loading ? <><Spinner /> Consultando</> : "Consultar"}
        </button>
      </div>

      {errorMsg && <div className="lh-error-text">{errorMsg}</div>}
    </div>
  );
}

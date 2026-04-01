import { useEffect, useState } from "react";
import { fetchQueryHistory, logout, isLoggedIn } from "./hooks/useApi";
import "./lakehouse-theme.css";
import { applyTheme, getInitialTheme } from "./theme/themes";
import {
  QueryBar,
  QueryResult,
  CatalogView,
  SourcesView,
  UploadView,
  DbtPanel,
  LoginModal,
  LineageView,
  ThemeToggle,
  Metric,
} from "./components";

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
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("lakehouse-theme", theme);
  }, [theme]);

  useEffect(() => {
    fetchQueryHistory().then((data) => setQueries(data || [])).catch(() => {});
  }, []);

  const handleResult = (result) => setQueries((prev) => [result, ...prev]);

  const handleLogout = () => {
    logout();
    setLoggedIn(false);
  };

  return (
    <div className="lh-shell">
      {showLogin && (
        <LoginModal
          onLogin={() => {
            setLoggedIn(true);
            setShowLogin(false);
          }}
        />
      )}

      <div className="lh-container">
        <header className="lh-header">
          <div className="lh-brand" onClick={() => setView("query")}>
            <div className="lh-brand-badge">🏠</div>
            <div>
              <h1 className="lh-brand-title">LakeHouse Lab</h1>
              <p className="lh-brand-subtitle">dbt + DuckDB + Text-to-SQL</p>
            </div>
          </div>

          <div className="lh-actions">
            <ThemeToggle
              theme={theme}
              onToggle={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
            />

            <div className="lh-layer-dots">
              {["bronze", "silver", "gold"].map((layer) => (
                <div
                  key={layer}
                  className="lh-layer-dot"
                  style={{ background: `var(--${layer})` }}
                  title={layer}
                />
              ))}
            </div>

            {loggedIn ? (
              <button className="lh-button-ghost" onClick={handleLogout}>
                Sair
              </button>
            ) : (
              <button className="lh-button-secondary" onClick={() => setShowLogin(true)}>
                Login
              </button>
            )}
          </div>
        </header>

        <nav className="lh-nav">
          {VIEWS.map((v) => (
            <button
              key={v.k}
              onClick={() => setView(v.k)}
              className={`lh-pill-button ${view === v.k ? "active" : ""}`}
            >
              {v.l}
            </button>
          ))}
        </nav>

        <div className="lh-metrics-grid">
          <Metric label="Queries" value={queries.length} sub="text-to-SQL" />
          <Metric
            label="Tema"
            value={theme === "dark" ? "Dark" : "Light"}
            sub="persistido no localStorage"
            color="var(--brand-wordmark)"
          />
        </div>

        <main>
          {view === "query" && (
            <>
              {!loggedIn && (
                <div className="lh-inline-alert">
                  Faça <span onClick={() => setShowLogin(true)} className="lh-link-action">login</span> para usar o Query Agent.
                </div>
              )}
              <QueryBar onResult={handleResult} />
              {queries.length > 0 && <div className="lh-section-title">Consultas recentes</div>}
              {queries.map((q, i) => (
                <QueryResult key={q.id || i} query={q} />
              ))}
            </>
          )}

          {view === "catalog" && <CatalogView />}
          {view === "sources" && <SourcesView />}

          {view === "upload" && (
            <div>
              <div className="lh-section-title">Upload de arquivo</div>
              <UploadView loggedIn={loggedIn} onShowLogin={() => setShowLogin(true)} />
            </div>
          )}

          {view === "dbt" && (
            <div>
              <div className="lh-section-title">Executar dbt</div>
              {!loggedIn ? (
                <div className="lh-inline-text">
                  Faça <span onClick={() => setShowLogin(true)} className="lh-link-action">login</span> para executar o dbt.
                </div>
              ) : (
                <DbtPanel />
              )}
            </div>
          )}

          {view === "lineage" && (
            <div>
              <div className="lh-section-title">dbt Lineage</div>
              <LineageView />
            </div>
          )}
        </main>

        <footer className="lh-footer">
          <span>LakeHouse Lab v1.0 · Django + dbt + DuckDB + Text-to-SQL</span>
          <span>Daniel Pizani · 2026</span>
        </footer>
      </div>
    </div>
  );
}

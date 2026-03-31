import { useCallback, useEffect, useState } from "react";

const BASE = "/api";

/** Lê token JWT do localStorage. */
function getToken() {
  return localStorage.getItem("access_token") || "";
}

/** Headers padrão com JWT quando disponível. */
function authHeaders(extra = {}) {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/** Hook genérico para GET com estado loading/error. */
export function useApi(endpoint, options = {}) {
  const { autoFetch = true } = options;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}${endpoint}`, { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    if (autoFetch) fetchData();
  }, [autoFetch, fetchData]);

  return { data, loading, error, refetch: fetchData };
}

/** POST /api/query/ — pergunta → QuerySession */
export async function postQuery(question, { provider = null, model = null } = {}) {
  const body = { question };
  if (provider) body.provider = provider;
  if (model) body.model = model;
  const r = await fetch(`${BASE}/query/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** POST /api/sources/{id}/ingest/ — dispara ingestão */
export async function ingestSource(id) {
  const r = await fetch(`${BASE}/sources/${id}/ingest/`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** GET /api/sources/ — lista DataSources */
export async function fetchSources() {
  const r = await fetch(`${BASE}/sources/`, { headers: authHeaders() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** GET /api/catalog/discover/ — descobre tabelas DuckDB */
export async function fetchCatalogTables() {
  const r = await fetch(`${BASE}/catalog/discover/`, { headers: authHeaders() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** GET /api/catalog/schema/ — schema completo para autocomplete: {table: [cols]} */
export async function fetchCatalogSchema() {
  const r = await fetch(`${BASE}/catalog/schema/`, { headers: authHeaders() });
  if (!r.ok) return {};
  return r.json();
}

/** GET /api/dbt/lineage/ — grafo de lineage do manifest.json */
export async function fetchDbtLineage() {
  const r = await fetch(`${BASE}/dbt/lineage/`, { headers: authHeaders() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** POST /api/sources/upload/ — upload de CSV ou JSON */
export async function postUpload(file, name, displayName = "") {
  const form = new FormData();
  form.append("file", file);
  form.append("name", name);
  if (displayName) form.append("display_name", displayName);
  const token = localStorage.getItem("access_token") || "";
  const r = await fetch(`${BASE}/sources/upload/`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** GET /api/catalog/{table}/profile/ — perfil de uma tabela */
export async function fetchTableProfile(tableName) {
  const r = await fetch(`${BASE}/catalog/${tableName}/profile/`, { headers: authHeaders() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** GET /api/query/history/ — histórico de queries */
export async function fetchQueryHistory() {
  const r = await fetch(`${BASE}/query/history/`, { headers: authHeaders() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** POST /api/dbt/run/ — dispara dbt */
export async function runDbt(command = "run", select = "") {
  const r = await fetch(`${BASE}/dbt/run/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ command, select }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/** POST /api/token/ — login com user/password, salva token */
export async function login(username, password) {
  const r = await fetch(`${BASE}/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error("Credenciais inválidas");
  const data = await r.json();
  localStorage.setItem("access_token", data.access);
  localStorage.setItem("refresh_token", data.refresh);
  return data;
}

export function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function isLoggedIn() {
  return Boolean(localStorage.getItem("access_token"));
}

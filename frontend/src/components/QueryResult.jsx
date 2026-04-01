import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { formatNumber } from "../utils/formatters";

const CHART_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

function DataChart({ query }) {
  if (!query.result_preview?.length || query.chart_type === "none") return null;
  const cols = query.result_columns;
  const rows = query.result_preview;
  const data = rows.map((r) => {
    const obj = {};
    cols.forEach((c, i) => {
      obj[c] = r[i];
    });
    return obj;
  });

  const labelKey = cols[0];
  const valueKey = cols.length > 1 ? cols[1] : cols[0];

  const tooltipStyle = {
    contentStyle: {
      background: "var(--surface2)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      fontSize: 12,
      color: "var(--fg)",
      boxShadow: "var(--shadow)",
    },
    labelStyle: { color: "var(--fg)" },
  };

  if (query.chart_type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey={valueKey} nameKey={labelKey} cx="50%" cy="50%" outerRadius={82} label={({ name }) => name}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip {...tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (query.chart_type === "line") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <XAxis dataKey={labelKey} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
          <Tooltip {...tooltipStyle} />
          <Line type="monotone" dataKey={valueKey} stroke="var(--accent)" strokeWidth={3} dot={{ fill: "var(--accent)", r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barGap={4}>
        <XAxis dataKey={labelKey} tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={55} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey={valueKey} fill="var(--accent)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function QueryResult({ query }) {
  return (
    <div className="lh-card lh-query-result fade-up">
      <div className="lh-query-result-head">
        <div className="lh-query-question">{query.user_question}</div>

        {query.generated_sql && <div className="lh-code-block">{query.generated_sql}</div>}

        {query.error_message && <div className="lh-error-text">Erro: {query.error_message}</div>}

        <div className="lh-query-meta">
          <span>{formatNumber(query.row_count)} rows</span>
          <span>{query.execution_time_ms}ms</span>
          <span>{query.tokens_used} tokens</span>
          <span>{query.chart_type}</span>
          {query.llm_provider && (
            <span className="lh-query-provider">
              {query.llm_provider}{query.llm_model ? ` · ${query.llm_model}` : ""}
            </span>
          )}
        </div>
      </div>

      {query.chart_type && query.chart_type !== "table" && query.result_preview?.length > 0 && (
        <div className="lh-query-chart">
          <DataChart query={query} />
        </div>
      )}

      {query.result_preview?.length > 0 && (
        <div className="lh-table-wrap">
          <table className="lh-table">
            <thead>
              <tr>
                {query.result_columns.map((c, i) => <th key={i}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {query.result_preview.slice(0, 10).map((row, i) => (
                <tr key={i}>
                  {(Array.isArray(row) ? row : query.result_columns.map((c) => row[c])).map((cell, j) => (
                    <td key={j} className={typeof cell === "number" ? "is-number" : ""}>
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

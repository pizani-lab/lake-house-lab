export default function Metric({ label, value, sub, color = "var(--accent)" }) {
  return (
    <div className="lh-metric-card">
      <div className="lh-metric-label">{label}</div>
      <div className="lh-metric-value" style={{ color }}>{value}</div>
      {sub && <div className="lh-metric-sub">{sub}</div>}
    </div>
  );
}

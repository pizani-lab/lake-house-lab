import { LAYER_COLORS } from "../utils/formatters";

export default function Badge({ layer }) {
  const c = LAYER_COLORS[layer] || { color: "var(--muted)", bg: "var(--accent-dim)" };
  return (
    <span
      className="lh-badge"
      style={{
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.color}30`,
      }}
    >
      {layer}
    </span>
  );
}

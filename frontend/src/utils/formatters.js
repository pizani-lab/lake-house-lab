export function formatBytes(b) { if (!b) return "—"; if (b < 1024) return `${b} B`; if (b < 1048576) return `${(b/1024).toFixed(1)} KB`; return `${(b/1048576).toFixed(1)} MB`; }
export function formatNumber(n) { return n == null ? "—" : n.toLocaleString("pt-BR"); }
export function formatDate(iso) { return iso ? new Date(iso).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : "—"; }
export const LAYER_COLORS = { bronze: { color: "#CD7F32", bg: "#CD7F3218" }, silver: { color: "#C0C0C0", bg: "#C0C0C018" }, gold: { color: "#FFD700", bg: "#FFD70018" } };

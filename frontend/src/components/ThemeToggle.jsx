export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === "dark";

  return (
    <button
      onClick={onToggle}
      aria-label={`Alternar para tema ${isDark ? "claro" : "escuro"}`}
      title={`Tema ${isDark ? "escuro" : "claro"}`}
      className="lh-theme-toggle"
    >
      <span className="lh-theme-toggle-icon">{isDark ? "🌙" : "☀️"}</span>
      <span className="lh-theme-toggle-label">{isDark ? "Dark" : "Light"}</span>
    </button>
  );
}

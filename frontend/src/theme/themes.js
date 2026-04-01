export const THEMES = {
  dark: {
    bg: "#050816",
    bgElevated: "#0b1220",
    surface: "#111827",
    surface2: "#172033",
    surface3: "#22304a",
    border: "#243247",
    borderStrong: "#334155",
    fg: "#e5eefc",
    fgSoft: "#b8c5d9",
    muted: "#8ea0bb",
    accent: "#dbeafe",
    accentStrong: "#ffffff",
    accentContrast: "#0b1220",
    accentDim: "rgba(255, 255, 255, 0.08)",
    success: "#10b981",
    danger: "#ef4444",
    warning: "#f59e0b",
    overlay: "rgba(2, 6, 23, 0.76)",
    shadow: "0 20px 60px rgba(2, 6, 23, 0.42)",
    bronze: "#CD7F32",
    silver: "#C0C0C0",
    gold: "#FFD700",
    brandWordmark: "#ffffff",
  },
  light: {
    bg: "#f8fafc",
    bgElevated: "#ffffff",
    surface: "#ffffff",
    surface2: "#f1f5f9",
    surface3: "#e2e8f0",
    border: "#dbe4f0",
    borderStrong: "#cbd5e1",
    fg: "#0f172a",
    fgSoft: "#334155",
    muted: "#64748b",
    accent: "#0284c7",
    accentStrong: "#0369a1",
    accentContrast: "#ffffff",
    accentDim: "rgba(2, 132, 199, 0.10)",
    success: "#059669",
    danger: "#dc2626",
    warning: "#d97706",
    overlay: "rgba(15, 23, 42, 0.42)",
    shadow: "0 14px 34px rgba(15, 23, 42, 0.08)",
    bronze: "#B56A2C",
    silver: "#8A94A6",
    gold: "#C99700",
    brandWordmark: "#0284c7",
  },
};

export function applyTheme(themeName) {
  const theme = THEMES[themeName] || THEMES.dark;
  const root = document.documentElement;

  Object.entries(theme).forEach(([key, value]) => {
    const cssVar = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    root.style.setProperty(`--${cssVar}`, value);
  });

  root.style.setProperty("color-scheme", themeName);
  document.body.style.background = theme.bg;
  document.body.style.color = theme.fg;
}

export function getInitialTheme() {
  if (typeof window === "undefined") return "dark";
  const saved = localStorage.getItem("lakehouse-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

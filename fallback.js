export const getFallbackTokens = (url) => ({
  colors: {
    primary: "#6366f1",
    secondary: "#8b5cf6",
    accent: "#f59e0b",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#0f172a",
    mutedText: "#64748b"
  },
  typography: {
    headingFont: "Inter, system-ui, sans-serif",
    bodyFont: "Inter, system-ui, sans-serif",
    baseSize: "16px",
    scale: {
      h1: "3rem",
      h2: "2.25rem",
      h3: "1.75rem",
      body: "1rem",
      caption: "0.875rem"
    },
    lineHeights: { heading: 1.2, body: 1.5 }
  },
  spacing: { unit: 4, scale: [0, 1, 2, 3, 4, 6, 8] },
  radii: { none: "0px", sm: "4px", md: "8px", lg: "16px" },
  shadows: {
    sm: "0 1px 2px rgba(0,0,0,0.08)",
    md: "0 4px 8px rgba(0,0,0,0.12)"
  }
});
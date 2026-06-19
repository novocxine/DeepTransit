/**
 * lib/theme.ts
 * Single source of truth for AstroDetect design tokens.
 * Import these instead of using ad-hoc hex codes.
 */

// ── Color palette ──────────────────────────────────────────────────────────────

export const colors = {
  bg: {
    primary:   "#0d1117",   // deepest background
    secondary: "#161b22",   // card / panel surfaces
    tertiary:  "#21262d",   // subtle hover, nested card
  },
  border: {
    default: "#30363d",
    subtle:  "#21262d",
    accent:  "rgba(88,166,255,0.25)",
  },
  text: {
    primary:  "#c9d1d9",
    muted:    "#8b949e",
    faint:    "#484f58",
    inverted: "#0d1117",
  },
  accent: {
    blue:     "#58a6ff",
    green:    "#3fb950",
    yellow:   "#e3b341",
    orange:   "#f0883e",
    red:      "#f85149",
    star:     "#fff4d6",
  },
  severity: {
    pass:    { text: "#3fb950", bg: "rgba(63,185,80,0.10)",    border: "rgba(63,185,80,0.35)" },
    caution: { text: "#e3b341", bg: "rgba(227,179,65,0.10)",   border: "rgba(227,179,65,0.35)" },
    fail:    { text: "#f85149", bg: "rgba(248,81,73,0.10)",    border: "rgba(248,81,73,0.35)" },
  },
} as const;

// ── Typography ─────────────────────────────────────────────────────────────────

export const fonts = {
  sans: "'Inter', 'system-ui', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
} as const;

// ── Spacing ────────────────────────────────────────────────────────────────────
// Based on Tailwind's 4px-base scale. Values here are pixel equivalents.

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  "2xl": "48px",
} as const;

// ── Animation durations ────────────────────────────────────────────────────────

export const duration = {
  fast:   0.15,  // hover transitions (ms: 150ms)
  normal: 0.25,  // tab content change
  slow:   0.4,   // mount animations
} as const;

// ── Classification colors (source of truth) ────────────────────────────────────
// CLASSIFICATION_META in api.ts should stay as-is for backward compat;
// these are the canonical token definitions.

export const classification = {
  PLANET_TRANSIT: {
    color:    colors.accent.green,
    bg:       "rgba(63,185,80,0.12)",
    border:   "rgba(63,185,80,0.5)",
  },
  ECLIPSING_BINARY: {
    color:    colors.accent.red,
    bg:       "rgba(248,81,73,0.12)",
    border:   "rgba(248,81,73,0.5)",
  },
  BLEND: {
    color:    colors.accent.yellow,
    bg:       "rgba(227,179,65,0.12)",
    border:   "rgba(227,179,65,0.5)",
  },
  OTHER: {
    color:    colors.text.muted,
    bg:       "rgba(139,148,158,0.12)",
    border:   "rgba(139,148,158,0.5)",
  },
  NO_SIGNAL: {
    color:    colors.text.muted,
    bg:       "rgba(139,148,158,0.08)",
    border:   "rgba(139,148,158,0.3)",
  },
} as const;

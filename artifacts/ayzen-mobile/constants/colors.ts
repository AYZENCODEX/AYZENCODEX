// AYZEN Design Tokens — synced from artifacts/ayzen/src/index.css
// Dark cyberpunk terminal aesthetic

const palette = {
  // Core brand
  cyan: "#00d4b1",
  cyanDim: "#00a88e",
  violet: "#8b44f7",
  violetDim: "#6b2fd4",

  // Backgrounds
  bgBase: "#0d0f17",
  bgCard: "#111420",
  bgMuted: "#1a1f2e",
  bgInput: "#12151f",

  // Text
  fgPrimary: "#e8f8f8",
  fgMuted: "#6fa3a3",
  fgDim: "#4a7070",

  // Borders
  borderColor: "#0e2e2e",
  borderBright: "#1a4040",

  // Status
  success: "#00d4b1",
  warning: "#f5a623",
  danger: "#f54040",
  info: "#8b44f7",

  // Accents
  accentBg: "#003529",
  accentFg: "#a0f0e0",
};

export const colors = {
  light: {
    // Map to semantic tokens (always dark — AYZEN is dark-only)
    background: palette.bgBase,
    foreground: palette.fgPrimary,
    card: palette.bgCard,
    cardForeground: palette.fgPrimary,
    primary: palette.cyan,
    primaryForeground: palette.bgBase,
    secondary: palette.violet,
    secondaryForeground: "#ffffff",
    muted: palette.bgMuted,
    mutedForeground: palette.fgMuted,
    accent: palette.accentBg,
    accentForeground: palette.accentFg,
    border: palette.borderColor,
    input: palette.bgInput,
    destructive: palette.danger,
    destructiveForeground: "#ffffff",

    // Extras
    success: palette.success,
    warning: palette.warning,
    tabBar: "#0a0d14",
    tabBarBorder: palette.borderColor,
    skeleton: palette.bgMuted,
    shimmer: palette.bgCard,
    radius: 8,
  },
  dark: {
    background: palette.bgBase,
    foreground: palette.fgPrimary,
    card: palette.bgCard,
    cardForeground: palette.fgPrimary,
    primary: palette.cyan,
    primaryForeground: palette.bgBase,
    secondary: palette.violet,
    secondaryForeground: "#ffffff",
    muted: palette.bgMuted,
    mutedForeground: palette.fgMuted,
    accent: palette.accentBg,
    accentForeground: palette.accentFg,
    border: palette.borderColor,
    input: palette.bgInput,
    destructive: palette.danger,
    destructiveForeground: "#ffffff",

    success: palette.success,
    warning: palette.warning,
    tabBar: "#0a0d14",
    tabBarBorder: palette.borderColor,
    skeleton: palette.bgMuted,
    shimmer: palette.bgCard,
    radius: 8,
  },
};

export type ColorScheme = typeof colors.light;

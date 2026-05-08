// Cute indie dark theme — warm plum.
// Anchored on the user's palette: 500049 / 55024E / 772770 / 9A6395 / C0A2BE.

export const palette = {
  primaryDarker: '#55024E', // deepest accent
  primaryDark: '#500049',   // pressed / dark accent
  primary: '#772770',       // medium accent (default)
  primaryMuted: '#9A6395',  // soft accent
  primaryLight: '#C0A2BE',  // light highlight / muted text
} as const;

export const colors = {
  // Surfaces
  bg: '#1F0A1D',         // very dark plum, slightly warm
  surface: '#2D1129',    // card
  surfaceAlt: '#3D1A37', // elevated chip / segmented control
  border: '#5E2C57',     // soft plum border

  // Text
  text: '#FFF5FB',
  textMuted: '#C0A2BE',
  textDim: '#9A6395',

  // Accents (palette pass-through)
  accent: palette.primary,
  accentDark: palette.primaryDark,
  accentDarker: palette.primaryDarker,
  accentMuted: palette.primaryMuted,
  accentLight: palette.primaryLight,

  // Importance — warm indie palette that complements the plum bg
  priorityA: '#E07A91', // Must-Do — rose
  priorityB: '#E5B868', // Should-Do — butter
  priorityC: '#88B0A8', // Can-Do — sage

  // Status
  success: '#88B0A8',
  warning: '#E5B868',
  error: '#E07A91',
} as const;

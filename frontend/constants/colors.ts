// Halloween palette shared across task, social, profile, and auth screens.
export const palette = {
  primaryDarker: '#8E4024',
  primaryDark: '#B85B2D',
  primary: '#FF9B57',
  primaryMuted: '#CF956B',
  primaryLight: '#FFBB83',
} as const;

export const colors = {
  bg: '#17121E',
  surface: '#231C2D',
  surfaceAlt: '#30263B',
  border: '#3E314B',

  text: '#F8F0E8',
  textMuted: '#B9AABE',
  textDim: '#A38FAE',
  onAccent: '#25150D',

  accent: palette.primary,
  accentDark: palette.primaryDark,
  accentDarker: palette.primaryDarker,
  accentMuted: palette.primaryMuted,
  accentLight: palette.primaryLight,

  priorityA: '#FF9B57',
  priorityB: '#C1A0EB',
  priorityC: '#A8C6A0',

  success: '#A8C6A0',
  warning: '#FFB454',
  error: '#FF6B76',
} as const;

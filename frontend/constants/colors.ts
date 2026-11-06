// Christmas palette shared across task, social, profile, and auth screens.
export const palette = {
  primaryDarker: '#73501F',
  primaryDark: '#B68B43',
  primary: '#E8C478',
  primaryMuted: '#C5AB77',
  primaryLight: '#F4DCA3',
} as const;

export const colors = {
  bg: '#0D201C',
  surface: '#17312B',
  surfaceAlt: '#234239',
  border: '#36584C',

  text: '#F6F5ED',
  textMuted: '#B4C9BF',
  textDim: '#96B3A5',
  onAccent: '#241C0C',

  accent: palette.primary,
  accentDark: palette.primaryDark,
  accentDarker: palette.primaryDarker,
  accentMuted: palette.primaryMuted,
  accentLight: palette.primaryLight,

  priorityA: '#FF9DA5',
  priorityB: '#B4D9EA',
  priorityC: '#A4D4B4',

  success: '#A4D4B4',
  warning: '#F0C777',
  error: '#FF8791',
} as const;

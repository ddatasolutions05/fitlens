// Two schemes. Daylight (default): a soft green-tinted white with a leaf-green
// accent and warm colours for the macros. Night: the same family on a deep
// green-black, for people who prefer a dark screen. The plate (`inverse`) is
// the one loud element per screen in both.

export const palette = {
  light: {
    bg: '#F5F7F4',
    surface: '#FFFFFF',
    surfaceAlt: '#EAF0EB',
    inverse: '#16382A',
    onInverse: '#F3F8F4',
    inverseLine: 'rgba(255, 255, 255, 0.18)',
    onInverseAccent: '#4FD18F',
    text: '#14201A',
    textMuted: '#58665E',
    textFaint: '#8A968F',
    border: '#DEE5E0',
    accent: '#1E9A62',
    accentSoft: '#DDF2E6',
    onAccent: '#FFFFFF',
    protein: '#1E9A62',
    carbs: '#E3A83A',
    fat: '#E0704F',
    fibre: '#4F8BE8',
    water: '#3A9BDC',
    weight: '#16382A',
    steps: '#1E9A62',
    danger: '#C9372C',
    overlay: 'rgba(20, 32, 26, 0.5)',
    skeleton: '#E6ECE8',
  },
  dark: {
    bg: '#0F1512',
    surface: '#182019',
    surfaceAlt: '#202A23',
    inverse: '#E9F3EC',
    onInverse: '#0F1512',
    inverseLine: 'rgba(15, 21, 18, 0.14)',
    onInverseAccent: '#1E9A62',
    text: '#F0F5F1',
    textMuted: '#A9B5AD',
    textFaint: '#76827A',
    border: '#2A352E',
    accent: '#4FD18F',
    accentSoft: '#1D3528',
    onAccent: '#0F1512',
    protein: '#4FD18F',
    carbs: '#F0BC55',
    fat: '#F0876A',
    fibre: '#7FAEF5',
    water: '#6BB9EC',
    weight: '#E9F3EC',
    steps: '#4FD18F',
    danger: '#FF7B6B',
    overlay: 'rgba(0, 0, 0, 0.7)',
    skeleton: '#202A23',
  },
} as const;

export type ColorName = keyof typeof palette.dark;
export type Colors = Record<ColorName, string>;

export const fonts = {
  regular: 'Lato_400Regular',
  bold: 'Lato_700Bold',
  black: 'Lato_900Black',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 8,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 56, lineHeight: 58, fontFamily: fonts.black, letterSpacing: -1.5 },
  title: { fontSize: 30, lineHeight: 34, fontFamily: fonts.black, letterSpacing: -0.5 },
  heading: { fontSize: 20, lineHeight: 26, fontFamily: fonts.bold },
  body: { fontSize: 16, lineHeight: 23, fontFamily: fonts.regular },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontFamily: fonts.bold },
  small: { fontSize: 14, lineHeight: 19, fontFamily: fonts.regular },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: fonts.regular },
  label: { fontSize: 12, lineHeight: 16, fontFamily: fonts.bold, letterSpacing: 1.2, textTransform: 'uppercase' as const },
} as const;

export type TypeName = keyof typeof type;

export const touch = {
  min: 44,
} as const;

export const layout = {
  maxWidth: 560,
  gutter: 16,
} as const;

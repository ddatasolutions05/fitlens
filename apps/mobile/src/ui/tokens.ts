// Monochrome system: black is the default scheme, white is the alternative.
// One accent only (the opposite of the background); greys carry everything else.

export const palette = {
  dark: {
    bg: '#000000',
    surface: '#121212',
    surfaceAlt: '#1E1E1E',
    inverse: '#FFFFFF',
    onInverse: '#000000',
    text: '#FFFFFF',
    textMuted: '#B8B8B8',
    textFaint: '#7A7A7A',
    border: '#2C2C2C',
    accent: '#FFFFFF',
    accentSoft: '#262626',
    onAccent: '#000000',
    protein: '#FFFFFF',
    carbs: '#BDBDBD',
    fat: '#8A8A8A',
    fibre: '#5E5E5E',
    water: '#D4D4D4',
    weight: '#FFFFFF',
    steps: '#FFFFFF',
    danger: '#FF6B6B',
    overlay: 'rgba(0, 0, 0, 0.72)',
    skeleton: '#1E1E1E',
  },
  light: {
    bg: '#FFFFFF',
    surface: '#F5F5F5',
    surfaceAlt: '#EBEBEB',
    inverse: '#000000',
    onInverse: '#FFFFFF',
    text: '#000000',
    textMuted: '#4D4D4D',
    textFaint: '#8C8C8C',
    border: '#DCDCDC',
    accent: '#000000',
    accentSoft: '#E6E6E6',
    onAccent: '#FFFFFF',
    protein: '#000000',
    carbs: '#4D4D4D',
    fat: '#8C8C8C',
    fibre: '#B8B8B8',
    water: '#333333',
    weight: '#000000',
    steps: '#000000',
    danger: '#C62828',
    overlay: 'rgba(0, 0, 0, 0.5)',
    skeleton: '#E6E6E6',
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

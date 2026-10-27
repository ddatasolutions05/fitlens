export const palette = {
  light: {
    bg: '#F4F1EA',
    surface: '#FFFFFF',
    surfaceAlt: '#ECE8DF',
    text: '#1E1D1A',
    textMuted: '#6B675F',
    textFaint: '#9B968B',
    border: '#E0DBD0',
    accent: '#1F7A6D',
    accentSoft: '#D6EBE6',
    onAccent: '#FFFFFF',
    protein: '#2F6A9E',
    carbs: '#B26F23',
    fat: '#7C56A8',
    fibre: '#5A8A33',
    water: '#2E86AB',
    weight: '#8A6D3B',
    steps: '#3E7D5A',
    danger: '#A4453B',
    overlay: 'rgba(30, 29, 26, 0.45)',
    skeleton: '#E6E1D7',
  },
  dark: {
    bg: '#151614',
    surface: '#1F211E',
    surfaceAlt: '#282B27',
    text: '#F1EEE6',
    textMuted: '#A8A399',
    textFaint: '#7A766D',
    border: '#343731',
    accent: '#5FC2B0',
    accentSoft: '#1E3C37',
    onAccent: '#0F1F1C',
    protein: '#7FB0E0',
    carbs: '#E0A463',
    fat: '#B897DC',
    fibre: '#9BC46F',
    water: '#6FB8D6',
    weight: '#C9A86A',
    steps: '#7FBF9A',
    danger: '#E08A80',
    overlay: 'rgba(0, 0, 0, 0.6)',
    skeleton: '#2E312C',
  },
} as const;

export type ColorName = keyof typeof palette.light;
export type Colors = Record<ColorName, string>;

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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 40, lineHeight: 44, fontWeight: '700' as const },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700' as const },
  heading: { fontSize: 19, lineHeight: 24, fontWeight: '600' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  small: { fontSize: 14, lineHeight: 19, fontWeight: '400' as const },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
} as const;

export type TypeName = keyof typeof type;

export const touch = {
  min: 44,
} as const;

export const layout = {
  maxWidth: 560,
  gutter: 16,
} as const;

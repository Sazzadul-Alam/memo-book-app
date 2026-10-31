// ── Design Token System ──────────────────────────────────────────────────────
// Ported from theme.css --ds-* variables (exact values)

export const colors = {
  // Deep Sea Primary
  dsPrimary: '#005C72',
  dsPrimaryContainer: '#005C72',
  dsOnPrimary: '#ffffff',
  dsOnPrimaryContainer: '#8fd2ec',

  // Deep Sea Secondary
  dsSecondary: '#4a626b',
  dsSecondaryContainer: '#cde7f2',
  dsOnSecondaryContainer: '#506872',

  // Surfaces
  dsSurface: '#f8fafb',
  dsSurfaceBright: '#f8fafb',
  dsSurfaceContainerLowest: '#ffffff',
  dsSurfaceContainerLow: '#f2f4f5',
  dsSurfaceContainer: '#eceeef',
  dsSurfaceContainerHigh: '#e6e8e9',
  dsSurfaceVariant: '#e1e3e4',

  // Background & Text
  dsBackground: '#f8fafb',
  dsOnBackground: '#191c1d',
  dsOnSurface: '#191c1d',
  dsOnSurfaceVariant: '#3f484c',

  // Outline
  dsOutline: '#70787d',
  dsOutlineVariant: '#c0c8cc',

  // Error
  dsError: '#ba1a1a',
  dsErrorContainer: '#ffdad6',
  dsOnErrorContainer: '#93000a',

  // Tertiary / Accent
  dsTertiary: '#5d3300',
  dsOnTertiaryContainer: '#febb7d',

  // Generic tokens mapped from --background, --foreground etc.
  background: '#ffffff',
  foreground: '#252525',
  card: '#ffffff',
  cardForeground: '#252525',
  primary: '#030213',
  primaryForeground: '#ffffff',
  secondary: '#f2f2f2',
  secondaryForeground: '#030213',
  muted: '#ececf0',
  mutedForeground: '#717182',
  accent: '#e9ebef',
  accentForeground: '#030213',
  destructive: '#d4183d',
  destructiveForeground: '#ffffff',
  border: 'rgba(0,0,0,0.1)',
  inputBackground: '#f3f3f5',
  ring: '#b3b3b3',

  // Status colors (for badges)
  success: '#16a34a',
  warning: '#d97706',
  info: '#0284c7',

  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const;

export const fonts = {
  headline: 'Manrope',
  body: 'Inter',
  label: 'Inter',
} as const;

export const fontWeights = {
  normal: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
};

export const fontSizes = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  '2xl': 20,
  '3xl': 24,
  '4xl': 28,
  '5xl': 32,
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  full: 9999,
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;


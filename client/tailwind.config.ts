import type { Config } from 'tailwindcss';

/** Design tokens from the Shortlist design system. One accent, quiet greys, status colours for text only. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    screens: { md: '760px' },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      white: '#FFFFFF',
      ink: '#111111',
      mut: '#6B6B6B',
      line: '#E6E6E6',
      sur: '#FAFAFA',
      acc: { DEFAULT: '#1F3A5F', hover: '#17304F' },
      ctl: '#949494',
      ok: '#1E6B3A',
      warn: '#8A5A00',
      err: '#B3261E',
      'dot-ok': '#2E7D4F',
      'dot-warn': '#B7791F',
      skeleton: '#EFEFEF',
    },
    fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'] },
    fontSize: {
      xs: ['12px', '1.5'],
      sm: ['14px', '1.6'],
      base: ['16px', '1.6'],
      lg: ['18px', '1.5'],
      xl: ['24px', '1.3'],
      '2xl': ['32px', '1.25'],
    },
    fontWeight: { normal: '400', medium: '500' },
    borderRadius: { none: '0', DEFAULT: '8px', lg: '16px', full: '9999px' },
    extend: {
      maxWidth: { read: '720px', list: '1040px', narrow: '520px', auth: '440px' },
      boxShadow: { dialog: '0 8px 32px rgba(17, 17, 17, 0.08)' },
    },
  },
  plugins: [],
} satisfies Config;

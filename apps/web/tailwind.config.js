// MD3 design tokens (src/assets/tokens.css) mapped into Tailwind. See CLAUDE.md → Design System.
const role = name => `rgb(var(--md-sys-color-${name}) / <alpha-value>)`

// MD3 type scale: [size, { lineHeight, letterSpacing, fontWeight }]. Display and headline sizes are set in
// Playfair Display (font-display), everything else in Lato (font-body, the default).
const type = (size, line, tracking, weight = '400') => [`${size / 16}rem`, { lineHeight: `${line / 16}rem`, letterSpacing: `${tracking / 16}rem`, fontWeight: weight }]

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        // ── MD3 color roles ──
        primary: { DEFAULT: role('primary'), container: role('primary-container') },
        'on-primary': { DEFAULT: role('on-primary'), container: role('on-primary-container') },
        secondary: { DEFAULT: role('secondary'), container: role('secondary-container') },
        'on-secondary': { DEFAULT: role('on-secondary'), container: role('on-secondary-container') },
        tertiary: { DEFAULT: role('tertiary'), container: role('tertiary-container') },
        'on-tertiary': { DEFAULT: role('on-tertiary'), container: role('on-tertiary-container') },
        error: { DEFAULT: role('error'), container: role('error-container') },
        'on-error': { DEFAULT: role('on-error'), container: role('on-error-container') },
        success: { DEFAULT: role('success'), container: role('success-container') },
        'on-success': { DEFAULT: role('on-success'), container: role('on-success-container') },
        warning: { DEFAULT: role('warning'), container: role('warning-container') },
        'on-warning': { DEFAULT: role('on-warning'), container: role('on-warning-container') },
        surface: {
          DEFAULT: role('surface'),
          dim: role('surface-dim'),
          bright: role('surface-bright'),
          variant: role('surface-variant'),
          'container-lowest': role('surface-container-lowest'),
          'container-low': role('surface-container-low'),
          container: role('surface-container'),
          'container-high': role('surface-container-high'),
          'container-highest': role('surface-container-highest'),
        },
        'on-surface': { DEFAULT: role('on-surface'), variant: role('on-surface-variant') },
        outline: { DEFAULT: role('outline'), variant: role('outline-variant') },
        'inverse-surface': role('inverse-surface'),
        'inverse-on-surface': role('inverse-on-surface'),
        'inverse-primary': role('inverse-primary'),
        scrim: role('scrim'),

        // ── Brand (extended) colors ──
        // Gold was "amber" before: renamed so it doesn't collide with Tailwind's amber-* scale
        gold:  { DEFAULT: role('gold'), light: '#D99B4A', dark: '#A06E28', text: role('gold-text'), container: role('gold-container') },
        'on-gold': { DEFAULT: role('on-gold'), container: role('on-gold-container') },
        pine:  { DEFAULT: '#1E3D2F', light: '#2A5240', dark: '#142A20', deep: '#0D1F16' },
        clay:  { DEFAULT: '#8C4A2F', light: '#A85C3A', dark: '#6B3820' },
        lake:  { DEFAULT: '#4A6670', light: '#5C7D8A', dark: '#344A52' },
        bark:  { DEFAULT: '#3D2B1A', light: '#52392A' },
        parch: { DEFAULT: '#F2EBD9', dark: '#E6DBC4', deeper: '#D9CDB0' },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body:    ['Lato', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-l':  type(57, 64, -0.25),
        'display-m':  type(45, 52, 0),
        'display-s':  type(36, 44, 0),
        'headline-l': type(32, 40, 0),
        'headline-m': type(28, 36, 0),
        'headline-s': type(24, 32, 0),
        'title-l':    type(22, 28, 0, '700'),
        'title-m':    type(16, 24, 0.15, '700'),
        'title-s':    type(14, 20, 0.1, '700'),
        'body-l':     type(16, 24, 0.5),
        'body-m':     type(14, 20, 0.25),
        'body-s':     type(12, 16, 0.4),
        'label-l':    type(14, 20, 0.1, '700'),
        'label-m':    type(12, 16, 0.5, '700'),
        'label-s':    type(11, 16, 0.5, '700'),
      },
      borderRadius: {
        // MD3 shape scale: buttons/chips full, text fields xs, cards md, menus sm, sheets/dialogs xl
        'shape-xs': '4px',
        'shape-sm': '8px',
        'shape-md': '12px',
        'shape-lg': '16px',
        'shape-xl': '28px',
      },
      boxShadow: {
        'elevation-1': 'var(--md-sys-elevation-1)',
        'elevation-2': 'var(--md-sys-elevation-2)',
        'elevation-3': 'var(--md-sys-elevation-3)',
        'elevation-4': 'var(--md-sys-elevation-4)',
        'elevation-5': 'var(--md-sys-elevation-5)',
      },
      transitionTimingFunction: {
        emphasized: 'var(--md-sys-motion-easing-emphasized)',
        'emphasized-decelerate': 'var(--md-sys-motion-easing-emphasized-decelerate)',
        'emphasized-accelerate': 'var(--md-sys-motion-easing-emphasized-accelerate)',
        standard: 'var(--md-sys-motion-easing-standard)',
        'standard-decelerate': 'var(--md-sys-motion-easing-standard-decelerate)',
        'standard-accelerate': 'var(--md-sys-motion-easing-standard-accelerate)',
      },
      transitionDuration: {
        'short-2': '100ms',
        'short-4': '200ms',
        'medium-2': '300ms',
        'medium-4': '400ms',
        'long-2': '500ms',
      },
      zIndex: {
        'app-bar': 'var(--z-app-bar)',
        drawer: 'var(--z-drawer)',
        dialog: 'var(--z-dialog)',
        snackbar: 'var(--z-snackbar)',
      },
      minHeight: { touch: '48px' },
      minWidth: { touch: '48px' },
    }
  },
  plugins: [],
}

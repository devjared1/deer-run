export default {
  content: ['./index.html', './src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        pine:  { DEFAULT: '#1E3D2F', light: '#2A5240', dark: '#142A20', deep: '#0D1F16' },
        clay:  { DEFAULT: '#8C4A2F', light: '#A85C3A', dark: '#6B3820' },
        lake:  { DEFAULT: '#4A6670', light: '#5C7D8A', dark: '#344A52' },
        bark:  { DEFAULT: '#3D2B1A', light: '#52392A' },
        parch: { DEFAULT: '#F2EBD9', dark: '#E6DBC4', deeper: '#D9CDB0' },
        amber: { DEFAULT: '#C4873A', light: '#D99B4A', dark: '#A06E28' },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'serif'],
        serif:   ['"Libre Baskerville"', 'serif'],
        body:    ['"Lato"', 'sans-serif'],
      },
    }
  },
  plugins: [],
}

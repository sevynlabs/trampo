/** @type {import('tailwindcss').Config} */
// TRAMPO 2.0 design system — tokens mirror src/theme/tokens.ts
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand
        navy: '#041E42', // principal
        'navy-soft': '#0B2E5C',
        orange: '#FF6A00', // ação / conversão
        'orange-press': '#E85F00',
        'orange-soft': '#FFE7D6',
        'orange-tint': '#FFF4EB',
        sky: '#0096D6', // secundária / destaque
        'sky-soft': '#E1F3FB',

        // Semantic aliases (used across screens)
        primary: '#FF6A00',
        'primary-deep': '#E85F00',
        'primary-press': '#041E42',
        'primary-soft': '#FFC59E',
        'primary-subdued': '#FFF1E6',
        accent: '#FF6A00',

        // Ink (text)
        ink: '#041E42',
        'ink-secondary': '#0B2E5C',
        'ink-soft': '#35435A',
        'ink-muted': '#5F6B7E',
        'ink-faint': '#9AA5B8',

        // Surfaces
        canvas: '#ffffff',
        'canvas-soft': '#EEF3F9',
        'canvas-cream': '#FFF4EB',
        background: '#F5F8FC',
        surface: '#ffffff',

        // Borders
        hairline: '#E6EBF2',
        'hairline-input': '#D5DDE8',
        border: '#E6EBF2',

        // Semantic
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#E11D48',

        'mesh-1': 'rgba(255, 106, 0, 0.25)',
        'mesh-2': 'rgba(0, 150, 214, 0.2)',
        'mesh-3': 'rgba(4, 30, 66, 0.15)',
        'mesh-4': 'rgba(245, 248, 252, 0.25)',

        'skeleton-base': '#E6EBF2',
        'skeleton-highlight': '#F5F8FC',
      },
      fontFamily: {
        display: ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'],
        body: ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        card: '18px',
        button: '9999px',
        pill: '9999px',
        chip: '9999px',
      },
      spacing: {
        xxs: '2px',
        xs: '4px',
      },
    },
  },
  plugins: [],
};

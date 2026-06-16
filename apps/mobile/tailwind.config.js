/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand colors from Stripi-inspired design system
        primary: '#533afd',
        'primary-deep': '#4434d4',
        'primary-press': '#2e2b8c',
        'primary-soft': '#665efd',
        'primary-subdued': '#b9b9f9',

        // Ink (text) colors
        ink: '#0d253d',
        'ink-secondary': '#273951',
        'ink-muted': '#64748d',
        'ink-faint': '#61718a',

        // Surface colors
        canvas: '#ffffff',
        'canvas-soft': '#f6f9fc',
        'canvas-cream': '#f5e9d4',
        background: '#f6f9fc',
        surface: '#ffffff',

        // Border colors
        hairline: '#e3e8ee',
        'hairline-input': '#a8c3de',
        border: '#e3e8ee',

        // Semantic colors
        success: '#16A34A',
        warning: '#ea580c',
        danger: '#ea2261',

        // Legacy aliases for compatibility
        accent: '#533afd',
      },
      fontFamily: {
        display: ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'],
        body: ['Inter', 'SF Pro Display', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        card: '12px',
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

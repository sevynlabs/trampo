/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand — TRAMPO blue scale (#001B48 / #02457A / #018ABE / #97CADB / #D6E8EE)
        primary: '#018ABE', // vibrant accent
        'primary-deep': '#02457A', // gradient start / dark blue
        'primary-press': '#001B48', // deep navy / pressed
        'primary-soft': '#97CADB', // light blue
        'primary-subdued': '#D6E8EE', // ice tint

        // Ink (text) colors — navy-based
        ink: '#001B48',
        'ink-secondary': '#02457A',
        'ink-soft': '#2D5273',
        'ink-muted': '#5B7A91',
        'ink-faint': '#94B2C4',

        // Surface colors
        canvas: '#ffffff',
        'canvas-soft': '#EEF6FA',
        'canvas-cream': '#D6E8EE',
        background: '#F3F8FB',
        surface: '#ffffff',

        // Border colors
        hairline: '#DCEAF1',
        'hairline-input': '#97CADB',
        border: '#DCEAF1',

        // Semantic colors (kept functional, tuned to sit beside the blues)
        success: '#0E9F6E',
        warning: '#F59E0B',
        danger: '#E11D48',

        // Legacy alias for compatibility
        accent: '#018ABE',
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

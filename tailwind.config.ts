import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0d0d11',
        panel: '#15151b',
        panelAlt: '#1a1a22',
        line: 'rgba(255,255,255,0.08)',
        textSoft: '#8f8f9f',
        accent: '#d6c3a1'
      },
      boxShadow: {
        panel: '0 20px 40px rgba(0, 0, 0, 0.28)',
        glow: '0 0 0 1px rgba(255,255,255,0.04), 0 18px 38px rgba(0,0,0,0.35)'
      },
      fontFamily: {
        display: ['Georgia', 'Times New Roman', 'serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      backgroundImage: {
        'page-glow':
          'radial-gradient(circle at top left, rgba(214, 195, 161, 0.12), transparent 30%), radial-gradient(circle at top right, rgba(114, 128, 153, 0.10), transparent 22%)'
      }
    }
  },
  plugins: []
} satisfies Config;

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        palette: {
          light: '#E3F2FD',      // rgb(227, 242, 253)
          soft: '#90CAF9',       // rgb(144, 202, 249)
          primary: '#2196F3',    // rgb(33, 150, 243)
          deep: '#0D47A1',       // rgb(13, 71, 161)
          navy: '#0A3378',
          subtle: '#F6FAFD',
        },
        brand: {
          50: '#F0F7FD',
          100: '#E3F2FD',
          200: '#BBDEFB',
          300: '#90CAF9',
          400: '#42A5F5',
          500: '#2196F3',
          600: '#1E88E5',
          700: '#1565C0',
          800: '#0D47A1',
          900: '#082E6E',
          950: '#041738',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-primary': '0 0 25px -3px rgba(33, 150, 243, 0.4)',
        'glow-soft': '0 8px 30px -4px rgba(13, 71, 161, 0.15)',
        'card-elevated': '0 4px 20px -2px rgba(13, 71, 161, 0.06), 0 2px 6px -1px rgba(13, 71, 161, 0.04)',
      },
      animation: {
        'pulse-subtle': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ripple': 'ripple 1.8s cubic-bezier(0, 0.2, 0.8, 1) infinite',
      },
      keyframes: {
        ripple: {
          '0%': { transform: 'scale(0.95)', opacity: '0.8' },
          '50%': { transform: 'scale(1.35)', opacity: '0.3' },
          '100%': { transform: 'scale(1.6)', opacity: '0' },
        }
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        jeopardy: {
          obsidian: '#020412',
          abyss: '#040b29',
          sapphire: '#07164f',
          electric: '#1235b2',
          vibrant: '#1e4ef2',
          azure: '#3d72ff',
          neon: '#6092ff',
          champagne: '#fff0b3',
          gold: '#f5c242',
          amber: '#e59d1e',
          amberDark: '#996105',
          cardBorder: 'rgba(96, 146, 255, 0.25)',
        }
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Outfit"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Fraunces"', 'Georgia', 'serif'],
        mono: ['"Space Grotesk"', 'monospace'],
      },
      boxShadow: {
        'tile': '0 10px 25px -5px rgba(2, 4, 18, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.18)',
        'tile-hover': '0 16px 35px -6px rgba(30, 78, 242, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
        'card-glow': '0 0 50px rgba(30, 78, 242, 0.35), inset 0 0 30px rgba(245, 194, 66, 0.08)',
        'gold-glow': '0 0 30px rgba(245, 194, 66, 0.4)',
        'hud': '0 20px 40px rgba(0, 0, 0, 0.7), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
      }
    },
  },
  plugins: [],
}

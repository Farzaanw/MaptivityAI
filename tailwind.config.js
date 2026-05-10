/**
 * Tailwind CSS Configuration
 * 
 * Configures Tailwind CSS:
 * - content: Specifies which files to scan for Tailwind class names
 * - theme: Extends the default Tailwind theme (currently empty)
 * - plugins: Enables Tailwind plugins (currently none)
 * 
 * This file is required when using Tailwind as an npm package instead of CDN.
 */

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./**/*.tsx",
    "./**/*.ts",
  ],
  theme: {
    extend: {
      keyframes: {
        'gradient-xy': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': '0% 50%'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': '100% 50%'
          }
        }
      },
      animation: {
        'gradient-xy': 'gradient-xy 4s ease infinite',
      }
    },
  },
  plugins: [],
}

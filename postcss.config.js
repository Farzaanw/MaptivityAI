/**
 * PostCSS Configuration
 * 
 * Configures PostCSS to process CSS through Tailwind and Autoprefixer.
 * - @tailwindcss/postcss: Processes @tailwind directives and converts them to CSS (Tailwind v4+)
 * - autoprefixer: Automatically adds vendor prefixes for cross-browser compatibility
 * 
 * This file is required for the build process to compile Tailwind CSS correctly.
 */

export default {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}

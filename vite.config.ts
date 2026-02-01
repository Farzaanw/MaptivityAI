/**
 * Vite Build Configuration
 * 
 * Configures the Vite build tool for the Maptivity project.
 * - server: Dev server settings (port 3000, accessible from any host)
 * - plugins: React plugin for JSX/TSX support
 * - define: Expose environment variables to the app
 * - resolve: Path aliases for cleaner imports
 * 
 * This file controls how your app is built and run during development.
 */

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        '__VITE_GOOGLE_MAPS_API_KEY__': JSON.stringify(env.VITE_GOOGLE_MAPS_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

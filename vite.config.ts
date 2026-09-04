import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.config';
import packageJson from './package.json';

const appVersion = process.env.VITE_APP_VERSION ?? packageJson.version;

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  server: {
    port: 5173,
    cors: true,
  },
  resolve: {
    alias: { '@': '/src' },
  },
  build: {
    rollupOptions: {
      input: {
        spotlight: 'src/spotlight/index.html',
      },
    },
  },
});

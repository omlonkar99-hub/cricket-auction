import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  define: {
    'import.meta.env.VITE_BACKEND_PORT': JSON.stringify(process.env.VITE_BACKEND_PORT || '8080'),
  },
});

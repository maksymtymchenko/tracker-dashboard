import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      src: path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/collect-activity': 'http://localhost:4000',
      '/collect-tracking': 'http://localhost:4000',
      '/collect-screenshot': 'http://localhost:4000',
      '/screenshots': 'http://localhost:4000',
      '/ping': 'http://localhost:4000'
    }
  }
});



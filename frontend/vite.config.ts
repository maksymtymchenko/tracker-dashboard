import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '');

  // Set production API URL if not provided in env
  // In development, use empty string so Vite proxy handles requests (avoids CORS issues)
  const apiUrl =
    env.VITE_API_URL ||
    (mode === 'production'
      ? 'https://tracker-dashboard-zw8l.onrender.com'
      : '');

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            charts: ['recharts'],
            vendor: ['axios'],
          },
        },
      },
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
        '/ping': 'http://localhost:4000',
      },
    },
  };
});

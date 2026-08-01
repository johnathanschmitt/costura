import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    // `host: true` escuta em todas as interfaces de rede — sem isto o Vite
    // atende só 127.0.0.1 e o celular não alcança o sistema.
    host: true,
    port: 5173,
    proxy: {
      // O proxy roda no servidor, então o celular fala só com o Vite e ele
      // repassa ao backend: não há CORS envolvido nem IP a configurar no app.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});

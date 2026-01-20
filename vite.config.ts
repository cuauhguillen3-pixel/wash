import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5177, // Cambiamos el puerto por defecto
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});

import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: '/dark_forest/',
  plugins: [
    basicSsl()
  ],
  server: {
    host: true, // Expose to network
    https: true
  }
});

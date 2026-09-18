import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const forwardingDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? 'app.github.dev';
const codespaceOrigin = process.env.CODESPACE_NAME
  ? `https://${process.env.CODESPACE_NAME}-5173.${forwardingDomain}`
  : undefined;

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022' },
  server: {
    proxy: {
      '/api/v1': {
        target: 'http://127.0.0.1:3008',
        ws: true,
        changeOrigin: false,
        ...(codespaceOrigin ? { headers: { Origin: codespaceOrigin } } : {})
      }
    }
  }
});

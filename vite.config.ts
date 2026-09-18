import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], build: { target: 'es2022' }, server: { proxy: { '/api/v1': { target: 'http://127.0.0.1:3008', ws: true } } } });

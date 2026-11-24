import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// base './' permite servir el sitio desde cualquier subruta (GitHub Pages)
export default defineConfig({ base: './', plugins: [react(), tailwindcss()], build: { target: 'es2020' } });

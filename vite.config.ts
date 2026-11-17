import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/career-os/',
  plugins: [react(), tailwindcss()],
  build: { rolldownOptions: { input: { app: 'index.html', portfolio: 'portfolio.html' } } },
  server: {
    host: '127.0.0.1',
    fs: {
      deny: ['.env', '.env.*', '**/.git/**', '**/references/**', '**/private/**', '**/backups/**'],
    },
  },
});

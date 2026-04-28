import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves project sites under /<repo-name>/ so we need the
// configured base path to match. Override with VITE_BASE if you deploy
// somewhere else (custom domain, gh-pages root, etc).
const base = process.env.VITE_BASE || '/emo-webar/';

export default defineConfig({
  base,
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets/build',
  },
});

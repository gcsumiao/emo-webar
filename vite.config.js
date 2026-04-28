import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vercel serves this app at the domain root. GitHub Pages overrides this in
// .github/workflows/pages.yml with VITE_BASE=/emo-webar/.
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets/build',
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vercel serves this app at the domain root. GitHub Pages overrides this in
// .github/workflows/pages.yml with VITE_BASE=/emo-webar/.
const base = process.env.VITE_BASE || '/';
const appVersion =
  process.env.VITE_APP_VERSION ||
  process.env.VITE_VERCEL_GIT_COMMIT_SHA ||
  process.env.PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  '';

if (appVersion && !process.env.VITE_APP_VERSION) {
  process.env.VITE_APP_VERSION = appVersion;
}

export default defineConfig({
  base,
  define: {
    __EMO_APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react()],
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets/build',
  },
});

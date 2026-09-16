import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { cpSync } from 'node:fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), {
      name: 'copy-runtime-assets',
      apply: 'build',
      writeBundle() {
        // Keep the 1.7 GB source archive locally; ship the converted clips only.
        cpSync(path.resolve(__dirname, 'public'), path.resolve(__dirname, 'dist'), {
          recursive: true,
          filter: source => !path.relative(path.resolve(__dirname, 'public'), source).split(path.sep).includes('SignLanguage_Dictionary'),
        });
      },
    }],
    build: { copyPublicDir: false },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: ['**/public/animations/**', '**/scripts/reports/**'],
      },
    },
  };
});

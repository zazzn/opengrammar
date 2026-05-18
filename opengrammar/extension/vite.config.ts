import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({
      manifest,
      browser: 'chrome',
    }),
  ],
  // harper.js resolves its WASM via `new URL(..., import.meta.url)`; esbuild
  // dep-optimization rewrites that incorrectly. Exclude it and load the wasm
  // from a stable public/ path via chrome.runtime.getURL instead.
  optimizeDeps: {
    exclude: ['harper.js'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext', // don't down-level the wasm-bindgen glue / top-level await
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[hash].js',
        entryFileNames: 'assets/[hash].js',
      },
    },
  },
  server: {
    port: 5173,
    hmr: {
      port: 5173,
    },
    strictPort: true,
  },
});

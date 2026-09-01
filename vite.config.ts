/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base: the built app works from any path (GitHub Pages
  // subdirectory, Swarm bzz:// paths) without rebuild.
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy, rarely-changing deps into their own cached chunks so
        // the app shell reloads fast on venue Wi-Fi.
        manualChunks: {
          viem: ['viem', 'viem/chains', 'viem/ens', 'viem/accounts'],
          react: ['react', 'react-dom', 'react-router-dom'],
          noble: ['@noble/curves/secp256k1'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    server: {
      deps: {
        // The SDK's dist uses bundler-style directory imports; let Vite
        // transform it instead of Node's native ESM resolver.
        inline: ['@scopelift/stealth-address-sdk'],
      },
    },
  },
});

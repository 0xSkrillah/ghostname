/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative base: the built app works from any path (GitHub Pages
  // subdirectory, Swarm bzz:// paths) without rebuild.
  base: './',
  plugins: [react()],
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

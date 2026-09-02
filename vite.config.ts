/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { cspMetaTag } from './src/security/csp';

/**
 * Inject the Content-Security-Policy meta tag into the PRODUCTION index.html
 * only. Static hosts cannot send headers, and the dev server needs inline
 * scripts (React refresh) and websockets (HMR) that the policy forbids.
 */
function productionCsp(): Plugin {
  let isBuild = false;
  return {
    name: 'ghostname-production-csp',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    transformIndexHtml(html) {
      if (!isBuild) return html;
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${cspMetaTag()}`);
    },
  };
}

export default defineConfig({
  // Relative base: the built app works from any path (GitHub Pages
  // subdirectory, Swarm bzz:// paths) without rebuild.
  base: './',
  plugins: [react(), productionCsp()],
  build: {
    // Never ship source maps: they would expose the full source layout and
    // any build-time configuration to every visitor.
    sourcemap: false,
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

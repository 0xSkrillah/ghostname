/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { cspMetaTag } from './src/security/csp';

/** A proxy URL with a query string or credentials would ship a key to every visitor. */
function assertProxyUrlSafe(): void {
  const url = process.env['VITE_MOBULA_PROXY_URL'];
  if (!url) return;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('VITE_MOBULA_PROXY_URL is not a valid URL.');
  }
  if (parsed.protocol !== 'https:' || parsed.search || parsed.username || parsed.password) {
    throw new Error(
      'VITE_MOBULA_PROXY_URL must be an https URL without a query string or credentials; the proxy must hold the API key server-side.',
    );
  }
}

/** Short commit hash of the tree being built, plus a -dirty marker; 'unknown' outside git. */
function buildCommit(): string {
  try {
    const sha = execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const dirty = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim().length > 0;
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return 'unknown';
  }
}

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
      if (isBuild) assertProxyUrlSafe();
    },
    transformIndexHtml(html) {
      if (!isBuild) return html;
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    ${cspMetaTag()}\n    <meta name="ghostname-commit" content="${buildCommit()}" />`,
      );
    },
  };
}

export default defineConfig({
  // Relative base: the built app works from any path (GitHub Pages
  // subdirectory, Swarm bzz:// paths) without rebuild.
  base: './',
  // Exposed to the app so the footer can name the exact commit a served bundle
  // was built from (deployment provenance for a hand-rolled static host).
  define: { __GHOSTNAME_COMMIT__: JSON.stringify(buildCommit()) },
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

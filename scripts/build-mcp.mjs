#!/usr/bin/env node
/**
 * Bundle the agent entry points for Node with esbuild.
 *
 * Output goes to dist-agent/ (separate from the web app's dist/, which Vite
 * empties on every build). Dependencies stay external so the bundles resolve
 * viem and the MCP SDK from node_modules at runtime.
 *
 *   node scripts/build-mcp.mjs            build everything that exists
 *   import { buildAgentBundles } ...      used by the stdio integration test
 */
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ENTRIES = [
  { entry: 'mcp/stdio.ts', out: 'ghostname-mcp.mjs', bin: true },
  { entry: 'mcp/http.ts', out: 'ghostname-mcp-http.mjs', bin: true },
  { entry: 'cli/main.ts', out: 'ghostname.mjs', bin: true },
];

export async function buildAgentBundles({ outDir = 'dist-agent', root = process.cwd() } = {}) {
  const built = [];
  for (const { entry, out, bin } of ENTRIES) {
    const entryPath = `${root}/${entry}`;
    if (!existsSync(entryPath)) continue;
    const outfile = `${root}/${outDir}/${out}`;
    await build({
      entryPoints: [entryPath],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node20',
      packages: 'external',
      sourcemap: false,
      logLevel: 'silent',
      banner: bin ? { js: '#!/usr/bin/env node' } : undefined,
    });
    built.push(outfile);
  }
  return built;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const built = await buildAgentBundles();
  for (const file of built) console.log(`built ${file}`);
}

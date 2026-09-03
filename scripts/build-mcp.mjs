#!/usr/bin/env node
/**
 * Bundle the agent entry points for Node with esbuild, plus the MCP App view.
 *
 * Output goes to dist-agent/ (separate from the web app's dist/, which Vite
 * empties on every build). Dependencies stay external for the Node bundles so
 * they resolve viem and the MCP SDK from node_modules at runtime. The view is
 * a single self-contained HTML file with its script inlined, because MCP Apps
 * hosts serve it inside a sandboxed iframe with no network access.
 *
 *   node scripts/build-mcp.mjs            build everything that exists
 *   import { buildAgentBundles } ...      used by the integration tests
 */
import { build } from 'esbuild';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ENTRIES = [
  { entry: 'mcp/stdio.ts', out: 'ghostname-mcp.mjs', bin: true },
  { entry: 'mcp/http.ts', out: 'ghostname-mcp-http.mjs', bin: true },
  { entry: 'cli/main.ts', out: 'ghostname.mjs', bin: true },
];

const UI_ENTRY = 'mcp/ui/audit-app.ts';
const UI_TEMPLATE = 'mcp/ui/audit-app.html';
const UI_OUT = 'ui/ghostname-audit.html';

async function buildView({ outDir, root }) {
  const entry = `${root}/${UI_ENTRY}`;
  if (!existsSync(entry)) return null;
  const result = await build({
    entryPoints: [entry],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    minify: true,
    write: false,
    logLevel: 'silent',
  });
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const template = readFileSync(`${root}/${UI_TEMPLATE}`, 'utf8');
  if (!template.includes('<!--APP_SCRIPT-->')) throw new Error('UI template lacks the APP_SCRIPT marker');
  const html = template.replace('<!--APP_SCRIPT-->', `<script>${js}</script>`);
  const outfile = `${root}/${outDir}/${UI_OUT}`;
  mkdirSync(`${root}/${outDir}/ui`, { recursive: true });
  writeFileSync(outfile, html);
  return outfile;
}

export async function buildAgentBundles({ outDir = 'dist-agent', root = process.cwd() } = {}) {
  const built = [];
  const view = await buildView({ outDir, root });
  if (view) built.push(view);
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

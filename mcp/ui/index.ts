/**
 * Server side of the MCP App view.
 *
 * Registers the `ui://ghostname/audit` resource with the MCP Apps MIME type
 * and links it to the audit and re-audit tools through `_meta.ui`. Hosts
 * without MCP Apps support ignore both and keep the text and structured
 * result, which remain authoritative. When the UI bundle has not been built,
 * the resource serves a plain fallback page that says so, so the server never
 * fails because of the view.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import type { McpServer } from '@modelcontextprotocol/server';

export const AUDIT_VIEW_URI = 'ui://ghostname/audit';
/** MCP Apps profile MIME type (SEP-1865, stable 2026-01-26). */
export const MCP_APP_MIME_TYPE = 'text/html;profile=mcp-app';
export const UI_BUNDLE_FILENAME = 'ghostname-audit.html';

/**
 * `_meta` placed on the tools that have a view. Both the nested `ui.resourceUri`
 * form and the flat `ui/resourceUri` key are set, as the official helper does,
 * so hosts on either convention find the view.
 */
export const AUDIT_TOOL_UI_META = {
  ui: { resourceUri: AUDIT_VIEW_URI },
  'ui/resourceUri': AUDIT_VIEW_URI,
} as const;

/** `_meta.ui` placed on the resource: no external connections, bordered. */
export const AUDIT_RESOURCE_UI_META = {
  ui: {
    prefersBorder: true,
    csp: { connectDomains: [], resourceDomains: [] },
  },
} as const;

export const FALLBACK_VIEW_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>GhostName audit</title></head>
<body style="font-family: system-ui, sans-serif; padding: 1rem;">
<p><strong>GhostName audit view is not built.</strong></p>
<p>The text summary and structured result returned by the tool are authoritative.
Run <code>npm run build:agent</code> to build the inline view. This page holds no
wallet and no key.</p>
</body></html>`;

function candidates(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return [
    // Built server bundle: dist-agent/ghostname-mcp.mjs next to dist-agent/ui/.
    path.join(here, 'ui', UI_BUNDLE_FILENAME),
    // Source checkout (tests, vitest): mcp/ui/index.ts relative to dist-agent/.
    path.join(here, '..', '..', 'dist-agent', 'ui', UI_BUNDLE_FILENAME),
    path.join(process.cwd(), 'dist-agent', 'ui', UI_BUNDLE_FILENAME),
  ];
}

/** The built view, or the fallback page when no bundle exists. */
export function loadAuditViewHtml(paths: string[] = candidates()): { html: string; built: boolean } {
  for (const file of paths) {
    if (existsSync(file)) return { html: readFileSync(file, 'utf8'), built: true };
  }
  return { html: FALLBACK_VIEW_HTML, built: false };
}

export function registerGhostNameAppView(server: McpServer): void {
  server.registerResource(
    'ghostname-audit-view',
    AUDIT_VIEW_URI,
    {
      title: 'GhostName audit view',
      description:
        'Inline MCP App rendering of a GhostName audit: findings, warnings, unknowns, ' +
        'recommended actions and the secure upgrade link. No wallet, no keys, no storage.',
      mimeType: MCP_APP_MIME_TYPE,
      _meta: AUDIT_RESOURCE_UI_META,
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: MCP_APP_MIME_TYPE, text: loadAuditViewHtml().html }],
    }),
  );
}

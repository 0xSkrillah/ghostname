/**
 * MCP App view: registered per the MCP Apps extension, linked from the audit
 * tools, self-contained, secret-free, and never required by the workflow.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import path from 'node:path';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
// @ts-expect-error the build script is plain ESM without type declarations
import { buildAgentBundles } from '../scripts/build-mcp.mjs';
import { createGhostNameServer } from '../mcp/createServer';
import {
  AUDIT_VIEW_URI,
  FALLBACK_VIEW_HTML,
  loadAuditViewHtml,
  MCP_APP_MIME_TYPE,
} from '../mcp/ui/index';
import type { AgentChainClient } from '../src/agent/chains';

const ROOT = path.resolve(__dirname, '..');

const chain: AgentChainClient = {
  async getEnsAddress() {
    return '0x1111111111111111111111111111111111111111';
  },
  async getEnsText() {
    return null;
  },
  async getEnsResolver() {
    return '0x8fade66b79cc9f707ab26799354482eb93a5b7dd';
  },
  async getTransaction() {
    throw new Error('rpc down');
  },
  async getTransactionReceipt() {
    throw new Error('rpc down');
  },
  async getBalance() {
    return 0n;
  },
};

beforeAll(async () => {
  await buildAgentBundles({ outDir: 'dist-agent', root: ROOT });
}, 60_000);

async function connect() {
  const server = createGhostNameServer({ getClient: () => chain, webBaseUrl: 'https://ghostname.test/' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'app-test', version: '0.0.0' });
  await client.connect(clientTransport);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

describe('MCP App view', () => {
  it('registers the ui:// resource with the MCP Apps MIME type and links it from the audit tools', async () => {
    const { client, close } = await connect();
    try {
      const { resources } = await client.listResources();
      const view = resources.find((r) => r.uri === AUDIT_VIEW_URI);
      expect(view?.mimeType).toBe(MCP_APP_MIME_TYPE);
      expect(MCP_APP_MIME_TYPE).toBe('text/html;profile=mcp-app');
      expect((view?._meta as { ui?: { csp?: { connectDomains?: string[] } } })?.ui?.csp?.connectDomains).toEqual([]);

      const { tools } = await client.listTools();
      const byName = new Map(tools.map((t) => [t.name, t]));
      for (const name of ['ghostname_audit_ens_privacy', 'ghostname_reaudit_ens_privacy']) {
        expect((byName.get(name)?._meta as { ui?: { resourceUri?: string } })?.ui?.resourceUri).toBe(AUDIT_VIEW_URI);
      }
      // Tools without a view carry no ui metadata.
      expect((byName.get('ghostname_prepare_upgrade')?._meta as { ui?: unknown } | undefined)?.ui).toBeUndefined();
    } finally {
      await close();
    }
  });

  it('serves a self-contained, secret-free view that never touches a wallet or storage', async () => {
    const { client, close } = await connect();
    try {
      const res = await client.readResource({ uri: AUDIT_VIEW_URI });
      const html = (res.contents[0] as { text: string; mimeType?: string }).text;
      expect((res.contents[0] as { mimeType?: string }).mimeType).toBe(MCP_APP_MIME_TYPE);
      expect(html).toContain('GhostName');
      expect(html).toContain('<script>');
      expect(html).not.toMatch(/<script[^>]+src=/);
      expect(html).not.toMatch(/<link[^>]+href=/);
      for (const forbidden of [
        'localStorage',
        'sessionStorage',
        'indexedDB',
        'window.ethereum',
        'privateKey',
        'generateStealthKeys',
        'XMLHttpRequest',
        'WebSocket(',
      ]) {
        expect(html, `view contains ${forbidden}`).not.toContain(forbidden);
      }
      // The only action the view can take is asking the host to open the handoff link.
      expect(html).toContain('ui/open-link');
      expect(html).toContain('Open secure upgrade');
    } finally {
      await close();
    }
  });

  it('keeps the text and structured result authoritative, with or without the view', async () => {
    const { client, close } = await connect();
    try {
      const res = (await client.callTool({
        name: 'ghostname_audit_ens_privacy',
        arguments: { name: 'plain.eth', chainId: 11155111 },
      })) as { content: Array<{ type: string; text?: string }>; structuredContent?: { status: string } };
      expect(res.structuredContent?.status).toBe('incomplete');
      expect(res.content[0]!.text).toContain('INCOMPLETE');
      expect(res.content[1]!.text!.startsWith('{')).toBe(true);
    } finally {
      await close();
    }
  });

  it('falls back to a plain page when the bundle is missing, instead of failing', () => {
    const missing = loadAuditViewHtml([path.join(ROOT, 'dist-agent', 'ui', 'does-not-exist.html')]);
    expect(missing.built).toBe(false);
    expect(missing.html).toBe(FALLBACK_VIEW_HTML);
    expect(missing.html).toContain('authoritative');
    const built = loadAuditViewHtml();
    expect(built.built).toBe(true);
  });
});

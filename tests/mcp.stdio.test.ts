/**
 * stdio transport: the built server emits only valid MCP messages on stdout,
 * keeps diagnostics on stderr, and works with the official stdio client.
 *
 * The bundle is built with esbuild first, the same way `npm run build:agent`
 * builds it, so this also proves the MCP build passes independently of Vite.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
// @ts-expect-error the build script is plain ESM without type declarations
import { buildAgentBundles } from '../scripts/build-mcp.mjs';
import { TOOL_NAMES } from '../mcp/tools';

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = 'dist-agent';
const BUNDLE = path.join(ROOT, OUT_DIR, 'ghostname-mcp.mjs');

/** Environment with no RPC configured and no stray GhostName variables. */
const ENV = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !k.startsWith('GHOSTNAME_') && !k.startsWith('VITE_')),
) as Record<string, string>;

beforeAll(async () => {
  const built = (await buildAgentBundles({ outDir: OUT_DIR, root: ROOT })) as string[];
  expect(built.some((f) => f.endsWith('ghostname-mcp.mjs'))).toBe(true);
}, 60_000);

interface Rpc {
  jsonrpc: string;
  id?: number;
  method?: string;
  result?: Record<string, unknown>;
  error?: unknown;
}

/** Drive the server with raw newline-delimited JSON-RPC, legacy handshake. */
async function rawSession(requests: object[]): Promise<{ stdout: string[]; stderr: string }> {
  const child = spawn(process.execPath, [BUNDLE], { env: ENV, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d: string) => (stdout += d));
  child.stderr.on('data', (d: string) => (stderr += d));

  const expected = requests.filter((r) => 'id' in (r as { id?: number })).length;
  const responses = () => stdout.split('\n').filter((l) => l.trim().length > 0);
  for (const req of requests) child.stdin.write(`${JSON.stringify(req)}\n`);

  const deadline = Date.now() + 20_000;
  while (responses().length < expected && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50));
  }
  child.stdin.end();
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve();
    }, 3_000);
    child.on('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  return { stdout: responses(), stderr };
}

describe('stdio server', () => {
  it('writes only valid MCP messages to stdout and diagnostics to stderr', async () => {
    const { stdout, stderr } = await rawSession([
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'raw-test', version: '0.0.0' },
        },
      },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'ghostname_audit_ens_privacy', arguments: { name: 'not a name', chainId: 11155111 } },
      },
      { jsonrpc: '2.0', id: 4, method: 'resources/read', params: { uri: 'ghostname://privacy-model' } },
    ]);

    expect(stderr).toContain('ghostname-mcp');
    expect(stderr).toContain('No keys, no writes');
    expect(stdout.length).toBeGreaterThanOrEqual(4);

    const messages = stdout.map((line) => JSON.parse(line) as Rpc);
    for (const m of messages) {
      expect(m.jsonrpc).toBe('2.0');
      expect('id' in m || 'method' in m).toBe(true);
    }
    // Nothing from stderr leaked into the protocol channel.
    expect(stdout.join('\n')).not.toContain('ghostname-mcp 0.');

    const byId = new Map(messages.filter((m) => m.id !== undefined).map((m) => [m.id, m]));
    expect(byId.get(1)?.result).toMatchObject({ serverInfo: { name: 'ghostname' } });
    const tools = (byId.get(2)?.result as { tools: Array<{ name: string }> }).tools.map((t) => t.name);
    expect(tools.sort()).toEqual([...TOOL_NAMES].sort());
    const call = byId.get(3)?.result as { structuredContent: { status: string; findings: Array<{ code: string }> } };
    expect(call.structuredContent.status).toBe('unknown');
    expect(call.structuredContent.findings[0]!.code).toBe('NAME_INVALID');
    const model = byId.get(4)?.result as { contents: Array<{ text: string }> };
    expect(model.contents[0]!.text).toContain('forward recipient-address privacy'.toUpperCase());
  }, 40_000);

  it('works with the official stdio client', async () => {
    const client = new Client({ name: 'stdio-test', version: '0.0.0' });
    const transport = new StdioClientTransport({ command: process.execPath, args: [BUNDLE], env: ENV, stderr: 'pipe' });
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
      const res = (await client.callTool({
        name: 'ghostname_audit_ens_privacy',
        arguments: { name: 'still not a name', chainId: 1 },
      })) as { structuredContent: { status: string } };
      expect(res.structuredContent.status).toBe('unknown');
      expect(client.getInstructions()).toMatch(/Never ask for private keys/);
    } finally {
      await client.close();
    }
  }, 40_000);
});

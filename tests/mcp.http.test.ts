/**
 * Remote Streamable HTTP profile: same tools, stateless, guarded.
 * Runs entirely on loopback with injected chain fakes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createGhostNameHttpServer, createRateLimiter, httpConfigFromEnv, type GhostNameHttpServer } from '../mcp/http';
import { TOOL_NAMES } from '../mcp/tools';
import type { AgentChainClient } from '../src/agent/chains';

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

let http: GhostNameHttpServer;
let base: string;

beforeAll(async () => {
  http = createGhostNameHttpServer({
    env: {},
    getClient: () => chain,
    config: { ratePerMinute: 6, maxBodyBytes: 4096 },
  });
  await new Promise<void>((resolve) => http.server.listen(0, '127.0.0.1', () => resolve()));
  base = `http://127.0.0.1:${(http.server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await http.close();
});

const INIT = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 't', version: '0' } },
});

/**
 * Raw POST over node:http so that Origin and Host can be set; fetch treats
 * both as forbidden request headers and silently drops them.
 */
function post(body: string, headers: Record<string, string> = {}): Promise<{ status: number }> {
  return new Promise((resolve, reject) => {
    const req = request(
      `${base}/mcp`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'content-length': String(Buffer.byteLength(body)),
          ...headers,
        },
      },
      (res) => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode ?? 0 }));
      },
    );
    req.on('error', reject);
    req.end(body);
  });
}

describe('configuration', () => {
  it('defaults to localhost, a small body cap and a per-minute limit', () => {
    const cfg = httpConfigFromEnv({});
    expect(cfg).toMatchObject({ host: '127.0.0.1', port: 3838, allowedHosts: null, allowedOrigins: null });
    expect(cfg.maxBodyBytes).toBe(65536);
    expect(cfg.ratePerMinute).toBe(60);
    expect(httpConfigFromEnv({ GHOSTNAME_ALLOWED_HOSTS: 'mcp.example, api.example' }).allowedHosts).toEqual([
      'mcp.example',
      'api.example',
    ]);
  });

  it('rate limits within a sliding minute', () => {
    let t = 0;
    const allow = createRateLimiter(2, () => t);
    expect(allow('a')).toBe(true);
    expect(allow('a')).toBe(true);
    expect(allow('a')).toBe(false);
    expect(allow('b')).toBe(true);
    t += 61_000;
    expect(allow('a')).toBe(true);
  });
});

describe('guards', () => {
  it('serves health, refuses other paths and non-POST methods', async () => {
    expect((await fetch(`${base}/healthz`)).status).toBe(200);
    expect((await fetch(`${base}/anything`)).status).toBe(404);
    expect((await fetch(`${base}/mcp`)).status).toBe(405);
    expect((await fetch(`${base}/mcp`, { method: 'DELETE' })).status).toBe(405);
  });

  it('rejects a foreign Origin and a foreign Host', async () => {
    expect((await post(INIT, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await post(INIT, { host: 'evil.example' })).status).toBe(403);
  });

  it('caps the body size', async () => {
    const res = await post(JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'ping', pad: 'x'.repeat(8192) }));
    expect(res.status).toBe(413);
  });
});

describe('protocol', () => {
  it('exposes the same read-only tools through the official HTTP client, and reports remote mode', async () => {
    const client = new Client({ name: 'http-test', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`));
    await client.connect(transport);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([...TOOL_NAMES].sort());
      const res = (await client.callTool({
        name: 'ghostname_audit_ens_privacy',
        arguments: { name: 'plain.eth', chainId: 11155111 },
      })) as { structuredContent: { status: string; observation: { mode: string; note: string } } };
      expect(res.structuredContent.status).toBe('incomplete');
      expect(res.structuredContent.observation.mode).toBe('remote');
      expect(res.structuredContent.observation.note).toMatch(/can observe which names are queried/);
    } finally {
      await client.close();
    }
  });

  it('returns 429 once the per-client limit is exhausted', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 8; i++) statuses.push((await post(INIT)).status);
    expect(statuses).toContain(429);
  });
});

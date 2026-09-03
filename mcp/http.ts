/**
 * Optional remote profile: stateless Streamable HTTP.
 *
 * This is a convenience profile only. The recommended distribution is the
 * local stdio server. In remote mode the GhostName operator and its RPC
 * provider can observe which names are queried; the reports say so in their
 * `observation` block. The profile:
 *
 *  - exposes exactly the same read-only tools, resources and prompt;
 *  - is stateless: a fresh McpServer per request, no sessions, no query log;
 *  - validates the Host and Origin headers (DNS-rebinding protection);
 *  - caps request bodies and rate-limits by client address;
 *  - never exposes any wallet or signing capability, because none exists.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createMcpHandler } from '@modelcontextprotocol/server';
import {
  hostHeaderValidation,
  localhostHostValidation,
  localhostOriginValidation,
  originValidation,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import type { ClientFactory, EnvLike } from '../src/agent/chains';
import { createGhostNameServer, SERVER_VERSION } from './createServer';

export const MCP_PATH = '/mcp';
export const HEALTH_PATH = '/healthz';

export interface HttpConfig {
  host: string;
  port: number;
  /** null means localhost only. */
  allowedHosts: string[] | null;
  /** null means localhost only. Non-browser clients send no Origin and pass. */
  allowedOrigins: string[] | null;
  maxBodyBytes: number;
  ratePerMinute: number;
}

function list(value: string | undefined): string[] | null {
  const items = (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return items.length ? items : null;
}

export function httpConfigFromEnv(env: EnvLike): HttpConfig {
  return {
    host: env['GHOSTNAME_HTTP_HOST'] || '127.0.0.1',
    port: Number(env['GHOSTNAME_HTTP_PORT'] || 3838),
    allowedHosts: list(env['GHOSTNAME_ALLOWED_HOSTS']),
    allowedOrigins: list(env['GHOSTNAME_ALLOWED_ORIGINS']),
    maxBodyBytes: Number(env['GHOSTNAME_MAX_BODY_BYTES'] || 64 * 1024),
    ratePerMinute: Number(env['GHOSTNAME_RATE_LIMIT_PER_MINUTE'] || 60),
  };
}

/** Sliding one-minute window per client address. In memory, never persisted. */
export function createRateLimiter(limit: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((ts) => t - ts < 60_000);
    if (recent.length >= limit) {
      hits.set(key, recent);
      return false;
    }
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > 10_000) hits.clear(); // bounded memory; forgetting is safe
    return true;
  };
}

export interface HttpServerOptions {
  env: EnvLike;
  /** Injected client factory (tests). */
  getClient?: ClientFactory;
  now?: () => Date;
  config?: Partial<HttpConfig>;
}

export interface GhostNameHttpServer {
  server: Server;
  config: HttpConfig;
  close: () => Promise<void>;
}

function deny(res: ServerResponse, status: number, message: string, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message } }));
}

export function createGhostNameHttpServer(options: HttpServerOptions): GhostNameHttpServer {
  const config: HttpConfig = { ...httpConfigFromEnv(options.env), ...options.config };
  const validateHost = config.allowedHosts ? hostHeaderValidation(config.allowedHosts) : localhostHostValidation();
  const validateOrigin = config.allowedOrigins ? originValidation(config.allowedOrigins) : localhostOriginValidation();
  const allow = createRateLimiter(config.ratePerMinute);

  // Stateless by construction: a fresh server instance per request.
  const handler = createMcpHandler(() =>
    createGhostNameServer({
      mode: 'remote',
      env: options.env,
      getClient: options.getClient,
      now: options.now,
    }),
  );
  const nodeHandler = toNodeHandler(handler);

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === HEALTH_PATH && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(`ghostname-mcp-http ${SERVER_VERSION} ok\n`);
      return;
    }
    if (url.pathname !== MCP_PATH) {
      deny(res, 404, 'Not found. The MCP endpoint is POST /mcp.');
      return;
    }
    if (req.method !== 'POST') {
      // No GET stream and no sessions in this protocol revision.
      deny(res, 405, 'Method not allowed. Use POST.', { allow: 'POST' });
      return;
    }
    if (!validateHost(req, res) || !validateOrigin(req, res)) return;
    const length = Number(req.headers['content-length']);
    if (!Number.isFinite(length)) {
      deny(res, 411, 'Content-Length is required.');
      return;
    }
    if (length > config.maxBodyBytes) {
      deny(res, 413, `Request body exceeds ${config.maxBodyBytes} bytes.`);
      return;
    }
    const client = req.socket.remoteAddress ?? 'unknown';
    if (!allow(client)) {
      deny(res, 429, 'Rate limit exceeded. Try again in a minute, or run the local stdio server.', {
        'retry-after': '60',
      });
      return;
    }
    void nodeHandler(req, res);
  });

  return {
    server,
    config,
    close: async () => {
      await handler.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

const isMain = (() => {
  try {
    return !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
})();

if (isMain) {
  const { server, config, close } = createGhostNameHttpServer({ env: process.env });
  server.listen(config.port, config.host, () => {
    process.stderr.write(
      `ghostname-mcp-http ${SERVER_VERSION}: remote profile on http://${config.host}:${config.port}${MCP_PATH} ` +
        `(hosts: ${config.allowedHosts?.join(',') ?? 'localhost only'}; origins: ${config.allowedOrigins?.join(',') ?? 'localhost only'}; ` +
        `body <= ${config.maxBodyBytes} B; ${config.ratePerMinute}/min per client). Stateless, read-only, no query log. ` +
        'Disclosure: this operator and its RPC provider can observe queried names; prefer the local stdio server.\n',
    );
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      void close().finally(() => process.exit(0));
    });
  }
}

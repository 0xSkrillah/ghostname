/**
 * Local stdio entry point. This is the recommended way to run GhostName for
 * an AI agent: the server runs on the user's machine, uses the user's RPC,
 * calls no GhostName API, collects nothing and keeps no history.
 *
 * stdout carries only MCP messages. Diagnostics go to stderr.
 */
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { SERVER_VERSION, createGhostNameServer } from './createServer';

process.stderr.write(
  `ghostname-mcp ${SERVER_VERSION}: local read-only ENS privacy adviser on stdio. ` +
    'No keys, no writes, no analytics. Configure RPC with GHOSTNAME_MAINNET_RPC_URL and ' +
    'GHOSTNAME_SEPOLIA_RPC_URL.\n',
);

const handle = serveStdio(() => createGhostNameServer({ mode: 'local', env: process.env }));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void handle.close().finally(() => process.exit(0));
  });
}

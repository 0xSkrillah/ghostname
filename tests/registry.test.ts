/**
 * server.json stays a truthful registry descriptor: current schema, valid
 * name, the approved tools, no invented remote endpoint, no secrets.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TOOL_NAMES } from '../mcp/tools';
import { SERVER_VERSION } from '../mcp/createServer';

const file = path.resolve(__dirname, '..', 'server.json');
const doc = JSON.parse(readFileSync(file, 'utf8')) as {
  $schema: string;
  name: string;
  description: string;
  version: string;
  packages: Array<{ registryType: string; transport: { type: string }; environmentVariables?: Array<{ isSecret: boolean; name: string }> }>;
  remotes?: unknown[];
  _meta?: Record<string, { tools?: string[] }>;
};

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '..', 'package.json'), 'utf8')) as { version: string };

describe('server.json', () => {
  it('uses the current registry schema and a valid reverse-DNS name', () => {
    expect(doc.$schema).toBe('https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json');
    expect(doc.name).toMatch(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
    expect(doc.description.length).toBeGreaterThan(0);
    expect(doc.description.length).toBeLessThanOrEqual(100);
    expect(doc.version).toBe(pkg.version);
    expect(doc.version).toBe(SERVER_VERSION);
  });

  it('describes a stdio npm package and no undeployed remote', () => {
    expect(doc.packages).toHaveLength(1);
    expect(doc.packages[0]!.registryType).toBe('npm');
    expect(doc.packages[0]!.transport.type).toBe('stdio');
    expect(doc.remotes).toBeUndefined();
    for (const v of doc.packages[0]!.environmentVariables ?? []) {
      expect(v.isSecret).toBe(false);
      expect(v.name).not.toMatch(/key|seed|mnemonic|passphrase|private/i);
    }
  });

  it('lists exactly the approved tools', () => {
    const tools = doc._meta?.['io.modelcontextprotocol.registry/publisher-provided']?.tools ?? [];
    expect([...tools].sort()).toEqual([...TOOL_NAMES].sort());
  });
});

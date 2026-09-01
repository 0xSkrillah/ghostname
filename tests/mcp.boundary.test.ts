/**
 * Architectural rule: the agent, MCP and CLI layers can never reach a write,
 * signing, wallet or key-custody module, directly or transitively.
 *
 * Annotations are hints. This test is the boundary.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  AuditInputSchema,
  PrepareUpgradeInputSchema,
  ReauditInputSchema,
  VerifyPaymentInputSchema,
  VerifySponsoredExitInputSchema,
} from '../mcp/schemas';

const ROOT = path.resolve(__dirname, '..');
const ENTRY_DIRS = ['src/agent', 'mcp', 'cli'];

/** Modules that must never be imported, even transitively. */
const FORBIDDEN_FILES = [
  'src/ens/write.ts',
  'src/chain/payment.ts',
  'src/relay/sweep.ts',
  'src/state/wallet.ts',
  'src/state/identity.ts',
  'src/swarm/capsule.ts',
  'src/main.tsx',
  'src/App.tsx',
];
const FORBIDDEN_DIRS = ['src/pages', 'src/components'];

/** Bare specifiers that carry signing, wallet or UI capability. */
const FORBIDDEN_PACKAGES = ['viem/accounts', 'react', 'react-dom', 'react-router-dom'];

/** Identifiers that must not appear in the source text of the safe layers. */
const FORBIDDEN_SYMBOLS = [
  'createWalletClient',
  'privateKeyToAccount',
  'signTypedData',
  'signMessage',
  'signTransaction',
  'sendTransaction',
  'writeContract',
  'generateStealthKeys',
  'computeStealthPrivateKey',
  'signNativeSweepPackage',
  'signSweepAuthorization',
  'signErc3009Sweep',
  'publishStealthRecord',
  'executeStealthPayment',
  'encryptCapsule',
  'decryptCapsule',
  'localStorage',
  'window.ethereum',
];

function listTs(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((name) => {
    const full = path.join(abs, name);
    if (statSync(full).isDirectory()) return listTs(path.join(dir, name));
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts') ? [path.relative(ROOT, full).replace(/\\/g, '/')] : [];
  });
}

const IMPORT_RE = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;

function importsOf(file: string): string[] {
  const text = readFileSync(path.join(ROOT, file), 'utf8');
  const out: string[] = [];
  for (const m of text.matchAll(IMPORT_RE)) out.push((m[1] ?? m[2] ?? m[3])!);
  return out;
}

function resolveRelative(from: string, spec: string): string | null {
  const base = path.posix.join(path.posix.dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    const abs = path.join(ROOT, candidate);
    if (existsSync(abs) && statSync(abs).isFile()) return candidate;
  }
  return null;
}

/** Transitive closure of relative imports from the entry directories. */
function closure(): { files: Set<string>; packages: Set<string> } {
  const files = new Set<string>();
  const packages = new Set<string>();
  const queue = ENTRY_DIRS.flatMap(listTs);
  while (queue.length) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    files.add(file);
    for (const spec of importsOf(file)) {
      if (spec.startsWith('.')) {
        const resolved = resolveRelative(file, spec);
        if (!resolved) throw new Error(`Unresolved import ${spec} from ${file}`);
        queue.push(resolved);
      } else {
        packages.add(spec);
      }
    }
  }
  return { files, packages };
}

describe('agent, MCP and CLI import boundary', () => {
  const graph = closure();

  it('covers the agent and MCP entry points', () => {
    expect([...graph.files]).toEqual(expect.arrayContaining(['src/agent/auditForAgent.ts', 'mcp/createServer.ts', 'mcp/stdio.ts']));
  });

  it('never reaches a write, signing, wallet, key-custody or UI module', () => {
    const reached = [...graph.files];
    for (const forbidden of FORBIDDEN_FILES) expect(reached).not.toContain(forbidden);
    for (const dir of FORBIDDEN_DIRS) {
      expect(reached.filter((f) => f.startsWith(`${dir}/`))).toEqual([]);
    }
  });

  it('never imports a package that can sign or render', () => {
    for (const pkg of FORBIDDEN_PACKAGES) expect([...graph.packages]).not.toContain(pkg);
  });

  it('contains no signing, wallet or key-generation call sites', () => {
    const safeLayer = ENTRY_DIRS.flatMap(listTs);
    expect(safeLayer.length).toBeGreaterThan(0);
    for (const file of safeLayer) {
      const text = readFileSync(path.join(ROOT, file), 'utf8');
      for (const symbol of FORBIDDEN_SYMBOLS) {
        expect(text, `${file} references ${symbol}`).not.toContain(symbol);
      }
    }
  });

  it('exposes no RPC URL, key or secret parameter on any tool input', () => {
    const inputs = [
      AuditInputSchema,
      PrepareUpgradeInputSchema,
      ReauditInputSchema,
      VerifyPaymentInputSchema,
      VerifySponsoredExitInputSchema,
    ];
    for (const schema of inputs) {
      for (const key of Object.keys(schema.shape)) {
        expect(key).not.toMatch(/rpc|url|endpoint|private|secret|seed|mnemonic|passphrase|signature/i);
      }
      // Unknown fields are rejected, so no hidden parameter can be smuggled in.
      expect(schema.safeParse({ rpcUrl: 'http://127.0.0.1:8545' }).success).toBe(false);
    }
  });
});

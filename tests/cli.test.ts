/**
 * CLI: same service functions, same schema versions as the MCP tools.
 */
import { describe, expect, it } from 'vitest';
import { getAddress, type Address, type Hex } from 'viem';
import { parseArgs, runCli, USAGE, type CliIo } from '../cli/ghostname';
import {
  AgentPrivacyReportSchema,
  EvidenceVerificationSchema,
  UpgradePlanSchema,
} from '../mcp/schemas';
import { auditForAgent } from '../src/agent/auditForAgent';
import type { AgentChainClient } from '../src/agent/chains';
import { defaultRecordKey } from '../src/audit/records';
import { generateStealthKeys } from '../src/crypto/stealth';

const SEPOLIA = 11155111;
const OWNER: Address = getAddress('0x1111111111111111111111111111111111111111');
const RESOLVER: Address = getAddress('0x8fade66b79cc9f707ab26799354482eb93a5b7dd');
const TX = `0x${'ab'.repeat(32)}` as Hex;
const NOW = () => new Date('2026-09-01T20:00:00.000Z');

function chain(text: Record<string, string> = {}): AgentChainClient {
  return {
    async getEnsAddress() {
      return OWNER;
    },
    async getEnsText({ key }) {
      return text[key] ?? null;
    },
    async getEnsResolver() {
      return RESOLVER;
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
}

function io(client: AgentChainClient = chain()): CliIo & { out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    stdout: (l) => out.push(l),
    stderr: (l) => err.push(l),
    env: { GHOSTNAME_WEB_BASE_URL: 'https://ghostname.test/' },
    getClient: () => client,
    now: NOW,
  };
}

describe('argument parsing', () => {
  it('separates command, positionals and flags', () => {
    expect(parseArgs(['audit', 'x.eth', '--chain', '1', '--json'])).toEqual({
      command: 'audit',
      positional: ['x.eth'],
      flags: { chain: '1', json: true },
    });
    expect(parseArgs(['audit', '--chain=11155111', 'x.eth'])).toMatchObject({ flags: { chain: '11155111' } });
    expect(parseArgs(['audit', '--rpc-url', 'http://x'])).toEqual({ error: 'Unknown option --rpc-url.' });
    expect(parseArgs(['audit', '--chain'])).toEqual({ error: '--chain needs a value.' });
  });
});

describe('ghostname audit', () => {
  it('emits the same versioned report as the MCP service, as JSON', async () => {
    const keys = generateStealthKeys();
    const client = chain({ [defaultRecordKey()]: keys.stealthMetaAddress });
    const t = io(client);
    const code = await runCli(['audit', 'ghost.eth', '--chain', String(SEPOLIA), '--json'], t);
    expect(code).toBe(0);
    expect(t.err).toEqual([]);
    const report = AgentPrivacyReportSchema.parse(JSON.parse(t.out.join('\n')));
    expect(report.schemaVersion).toBe(1);
    expect(report.status).toBe('private-ready');
    expect(report.observation.mode).toBe('local');
    // Same service, same canonicalisation: the id matches a direct call.
    const direct = await auditForAgent(client, 'ghost.eth', {
      chainId: SEPOLIA,
      now: NOW,
      webBaseUrl: 'https://ghostname.test/',
      observation: { mode: 'local', rpcSource: 'injected' },
    });
    expect(report.reportId).toBe(direct.reportId);
  });

  it('prints a text summary by default and honours --strict', async () => {
    const t = io();
    expect(await runCli(['audit', 'plain.eth', '--chain', String(SEPOLIA)], t)).toBe(0);
    expect(t.out.join('\n')).toContain('INCOMPLETE');
    expect(t.out.join('\n')).toContain('PUBLISH_STEALTH_RECORD');
    expect(t.out.join('\n')).toMatch(/not anonymity/);
    const strict = io();
    expect(await runCli(['audit', 'plain.eth', '--chain', String(SEPOLIA), '--strict'], strict)).toBe(1);
  });

  it('rejects unsupported chains and unknown options as usage errors', async () => {
    const bad = io();
    expect(await runCli(['audit', 'plain.eth', '--chain', '137'], bad)).toBe(2);
    expect(bad.err.join('\n')).toMatch(/not supported/);
    const missing = io();
    expect(await runCli(['audit', 'plain.eth'], missing)).toBe(2);
    expect(missing.err.join('\n')).toMatch(/--chain is required/);
    const unknown = io();
    expect(await runCli(['audit', 'plain.eth', '--chain', '1', '--rpc-url', 'http://evil'], unknown)).toBe(2);
    const noCommand = io();
    expect(await runCli([], noCommand)).toBe(2);
    expect(noCommand.out.join('\n')).toBe(USAGE);
    const help = io();
    expect(await runCli(['audit', '--help'], help)).toBe(0);
    expect(USAGE).toMatch(/never asks for, reads or accepts a private key/);
  });
});

describe('ghostname plan and verifiers', () => {
  it('emits a schema-valid plan', async () => {
    const t = io();
    const code = await runCli(
      ['plan', 'plain.eth', '--chain', String(SEPOLIA), '--json', '--report-id', `gcr1_${'d'.repeat(32)}`],
      t,
    );
    expect(code).toBe(0);
    const plan = UpgradePlanSchema.parse(JSON.parse(t.out.join('\n')));
    expect(plan.handoff.url).toContain('https://ghostname.test/#/create?name=plain.eth');
    expect(plan.suppliedReportId.verified).toBe(false);
  });

  it('keeps verified, failed and unknown apart and reports unknown when the chain is down', async () => {
    const pay = io();
    expect(await runCli(['verify-payment', TX, TX, '--chain', String(SEPOLIA), '--json'], pay)).toBe(0);
    const ev = EvidenceVerificationSchema.parse(JSON.parse(pay.out.join('\n')));
    expect(ev.kind).toBe('payment-and-announcement');
    expect(ev.verified).toBe(false);
    expect(ev.unknownChecks.map((c) => c.id)).toEqual(['fetch']);
    expect(ev.notProven.length).toBeGreaterThan(0);

    const exit = io();
    expect(await runCli(['verify-exit', TX, '--chain', String(SEPOLIA), '--strict'], exit)).toBe(1);
    expect(exit.out.join('\n')).toContain('NOT VERIFIED');

    const mainnet = io();
    expect(await runCli(['verify-exit', TX, '--chain', '1'], mainnet)).toBe(3);
    expect(mainnet.err.join('\n')).toMatch(/expectedExecutor/);
  });
});

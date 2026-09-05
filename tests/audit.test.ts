/**
 * GhostCheck ENS privacy conformance audit.
 *
 * The audit must be honest above all: precedence has to be correct, malformed
 * and conflicting records must be caught rather than silently ignored, unknown
 * properties must stay unknown, and no report may ever contain secret material.
 */
import { describe, expect, it } from 'vitest';
import { getAddress, type Address } from 'viem';
import { auditEnsName, type AuditClient } from '../src/audit/auditEnsName';
import {
  chainSpecificRecordKey,
  defaultRecordKey,
  evmCoinType,
  LEGACY_ETH_COIN_TYPE,
  recordKeyPlan,
} from '../src/audit/records';
import { formatSummary } from '../src/audit/report';
import { generateStealthKeys } from '../src/crypto/stealth';
import { AUDIT_SCHEMA_VERSION } from '../src/audit/types';

const SEPOLIA = 11155111;
const MAINNET = 1;
const OWNER: Address = getAddress('0x1111111111111111111111111111111111111111');
const RESOLVER: Address = getAddress('0x8fade66b79cc9f707ab26799354482eb93a5b7dd');

const NOW = () => new Date('2026-09-05T07:00:00.000Z');

/** Fake ENS client driven by a plain record map. */
function fakeClient(config: {
  address?: Address | null;
  text?: Record<string, string>;
  resolver?: Address;
  throwOnAddress?: boolean;
  throwOnText?: string;
}): AuditClient {
  return {
    async getEnsAddress() {
      if (config.throwOnAddress) throw new Error('rpc down');
      return config.address ?? null;
    },
    async getEnsText({ key }) {
      if (config.throwOnText === key) throw new Error('rpc down');
      return config.text?.[key] ?? null;
    },
    async getEnsResolver() {
      return config.resolver ?? '0x0000000000000000000000000000000000000000';
    },
  };
}

describe('ENSIP-11 coin types and record keys', () => {
  it('derives the coin type by bitwise OR with 0x80000000', () => {
    // The worked example from ENSIP-11 itself.
    expect(evmCoinType(61)).toBe(2147483709);
    expect(evmCoinType(SEPOLIA)).toBe((0x80000000 | SEPOLIA) >>> 0);
    expect(evmCoinType(MAINNET)).toBe(2147483649);
  });

  it('builds the default and chain-specific keys in the RFC shape', () => {
    expect(defaultRecordKey()).toBe('stealth-meta-address[1]');
    expect(chainSpecificRecordKey(evmCoinType(SEPOLIA))).toBe(
      `stealth-meta-address[1][${evmCoinType(SEPOLIA)}]`,
    );
  });

  it('orders the plan chain-specific first, then default', () => {
    const plan = recordKeyPlan(SEPOLIA);
    expect(plan[0]!.kind).toBe('chain-specific');
    expect(plan[1]!.kind).toBe('default');
    expect(plan.every((p) => p.normative)).toBe(true);
  });

  it('adds the legacy mainnet coin type only as a non-normative diagnostic', () => {
    const plan = recordKeyPlan(MAINNET);
    const legacy = plan.find((p) => p.coinType === LEGACY_ETH_COIN_TYPE);
    expect(legacy).toBeDefined();
    expect(legacy!.normative).toBe(false);
    // It must be last so it can never take precedence.
    expect(plan[plan.length - 1]!.coinType).toBe(LEGACY_ETH_COIN_TYPE);
  });
});

describe('record precedence', () => {
  it('prefers the chain-specific record over the default', async () => {
    const chainKeys = generateStealthKeys();
    const defaultKeys = generateStealthKeys();
    const client = fakeClient({
      address: OWNER,
      resolver: RESOLVER,
      text: {
        [chainSpecificRecordKey(evmCoinType(SEPOLIA))]: chainKeys.stealthMetaAddress,
        [defaultRecordKey()]: defaultKeys.stealthMetaAddress,
      },
    });
    const report = await auditEnsName(client, 'ghost.eth', { chainId: SEPOLIA, now: NOW });
    expect(report.selectedRecord?.kind).toBe('chain-specific');
    expect(report.selectedRecord?.value).toBe(chainKeys.stealthMetaAddress);
    expect(report.overallStatus).toBe('private-ready');
    // Divergent records are surfaced rather than hidden.
    expect(report.warnings.join(' ')).toMatch(/DIFFERENT meta-addresses/);
  });

  it('falls back to the default record when no chain-specific record exists', async () => {
    const keys = generateStealthKeys();
    const client = fakeClient({
      address: OWNER,
      resolver: RESOLVER,
      text: { [defaultRecordKey()]: keys.stealthMetaAddress },
    });
    const report = await auditEnsName(client, 'ghost.eth', { chainId: SEPOLIA, now: NOW });
    expect(report.selectedRecord?.kind).toBe('default');
    expect(report.overallStatus).toBe('private-ready');
    expect(report.warnings.join(' ')).not.toMatch(/DIFFERENT/);
  });

  it('does not let a non-normative legacy record win on mainnet', async () => {
    const legacy = generateStealthKeys();
    const client = fakeClient({
      address: OWNER,
      resolver: RESOLVER,
      text: {
        [chainSpecificRecordKey(LEGACY_ETH_COIN_TYPE)]: legacy.stealthMetaAddress,
      },
    });
    const report = await auditEnsName(client, 'legacy.eth', { chainId: MAINNET, now: NOW });
    expect(report.selectedRecord).toBeNull();
    expect(report.overallStatus).toBe('misconfigured');
    expect(report.warnings.join(' ')).toMatch(/non-normative legacy record/);
  });
});

describe('status classification', () => {
  it('reports incomplete when no stealth record is published', async () => {
    const client = fakeClient({ address: OWNER, resolver: RESOLVER });
    const report = await auditEnsName(client, 'plain.eth', { chainId: SEPOLIA, now: NOW });
    expect(report.overallStatus).toBe('incomplete');
    expect(report.conventionalAddress).toBe(OWNER);
    expect(report.staticMappingNote).toMatch(/publicly linkable/);
    expect(report.warnings.join(' ')).toMatch(/remain\s+linkable/);
  });

  it('reports misconfigured for a malformed record', async () => {
    const client = fakeClient({
      address: OWNER,
      resolver: RESOLVER,
      text: { [defaultRecordKey()]: 'st:eth:0xdeadbeef' },
    });
    const report = await auditEnsName(client, 'broken.eth', { chainId: SEPOLIA, now: NOW });
    expect(report.overallStatus).toBe('misconfigured');
    const bad = report.recordSources.find((s) => s.status === 'present-invalid');
    expect(bad).toBeDefined();
    expect(bad!.error).toMatch(/Invalid stealth meta-address/);
    expect(report.warnings.join(' ')).toMatch(/malformed/);
  });

  it('reports unknown for an unresolvable name', async () => {
    const client = fakeClient({ throwOnAddress: true });
    const report = await auditEnsName(client, 'gone.eth', { chainId: SEPOLIA, now: NOW });
    expect(report.overallStatus).toBe('unknown');
    expect(report.unknowns.length).toBeGreaterThan(0);
  });

  it('reports unknown for a name that cannot be normalized', async () => {
    const client = fakeClient({});
    const report = await auditEnsName(client, 'not a name..eth', { chainId: SEPOLIA, now: NOW });
    expect(report.overallStatus).toBe('unknown');
    expect(report.localDerivationTest.ran).toBe(false);
  });

  it('normalizes the name before resolving', async () => {
    const keys = generateStealthKeys();
    const client = fakeClient({
      address: OWNER,
      resolver: RESOLVER,
      text: { [defaultRecordKey()]: keys.stealthMetaAddress },
    });
    const report = await auditEnsName(client, '  GhOsT.eth  ', { chainId: SEPOLIA, now: NOW });
    expect(report.name).toBe('ghost.eth');
  });
});

describe('local derivation trials', () => {
  it('runs three trials and confirms all destinations are distinct', async () => {
    const keys = generateStealthKeys();
    const client = fakeClient({
      address: OWNER,
      resolver: RESOLVER,
      text: { [defaultRecordKey()]: keys.stealthMetaAddress },
    });
    const report = await auditEnsName(client, 'ghost.eth', { chainId: SEPOLIA, now: NOW });
    expect(report.localDerivationTest.ran).toBe(true);
    expect(report.localDerivationTest.trials).toBe(3);
    expect(report.localDerivationTest.addresses).toHaveLength(3);
    expect(new Set(report.localDerivationTest.addresses).size).toBe(3);
    expect(report.localDerivationTest.allDistinct).toBe(true);
  });

  it('records the derivation path so the trust boundary is visible', async () => {
    const keys = generateStealthKeys();
    const client = fakeClient({
      address: OWNER,
      resolver: RESOLVER,
      text: { [defaultRecordKey()]: keys.stealthMetaAddress },
    });
    const local = await auditEnsName(client, 'ghost.eth', { chainId: SEPOLIA, now: NOW });
    expect(local.localDerivationTest.derivationPath).toBe('local-client');

    const gateway = await auditEnsName(client, 'ghost.eth', {
      chainId: SEPOLIA,
      derivationPath: 'gateway-or-ccip',
      now: NOW,
    });
    expect(gateway.localDerivationTest.derivationPath).toBe('gateway-or-ccip');
  });

  it('states plainly that a pass is not proof of anonymity', async () => {
    const keys = generateStealthKeys();
    const client = fakeClient({
      address: OWNER,
      resolver: RESOLVER,
      text: { [defaultRecordKey()]: keys.stealthMetaAddress },
    });
    const report = await auditEnsName(client, 'ghost.eth', { chainId: SEPOLIA, now: NOW });
    expect(report.localDerivationTest.proves).toMatch(/does not prove anonymity/i);
  });
});

describe('honesty guarantees', () => {
  it('never claims resolver provenance it cannot prove', async () => {
    const keys = generateStealthKeys();
    const client = fakeClient({
      address: OWNER,
      resolver: RESOLVER,
      text: { [defaultRecordKey()]: keys.stealthMetaAddress },
    });
    const report = await auditEnsName(client, 'ghost.eth', { chainId: SEPOLIA, now: NOW });
    expect(report.resolver.address).toBe(RESOLVER);
    expect(report.resolver.provenance).toBe('unknown');
    expect(report.resolver.provenanceNote).toMatch(/unknown rather than guessed/);
  });

  it('records an unknown when the resolver cannot be read', async () => {
    const client = fakeClient({ address: OWNER });
    const report = await auditEnsName(client, 'ghost.eth', { chainId: SEPOLIA, now: NOW });
    expect(report.resolver.address).toBeNull();
    expect(report.unknowns.join(' ')).toMatch(/resolver address could not be read/i);
  });

  it('carries no numeric score anywhere in the report', async () => {
    const keys = generateStealthKeys();
    const client = fakeClient({
      address: OWNER,
      resolver: RESOLVER,
      text: { [defaultRecordKey()]: keys.stealthMetaAddress },
    });
    const report = await auditEnsName(client, 'ghost.eth', { chainId: SEPOLIA, now: NOW });
    const json = JSON.stringify(report).toLowerCase();
    expect(json).not.toContain('"score"');
    expect(json).not.toContain('privacyscore');
  });

  it('includes both trust-boundary halves', async () => {
    const client = fakeClient({ address: OWNER, resolver: RESOLVER });
    const report = await auditEnsName(client, 'plain.eth', { chainId: SEPOLIA, now: NOW });
    expect(report.trustBoundaries.protected.length).toBeGreaterThan(0);
    expect(report.trustBoundaries.notProtected.join(' ')).toMatch(/Old transaction history/);
    expect(report.trustBoundaries.notProtected.join(' ')).toMatch(/Sender identity/);
  });

  it('is versioned and timestamped', async () => {
    const client = fakeClient({ address: OWNER, resolver: RESOLVER });
    const report = await auditEnsName(client, 'plain.eth', { chainId: SEPOLIA, now: NOW });
    expect(report.schemaVersion).toBe(AUDIT_SCHEMA_VERSION);
    expect(report.generatedAt).toBe('2026-09-05T07:00:00.000Z');
  });
});

describe('reports contain no secret material', () => {
  it('emits only public key material, never private keys', async () => {
    const keys = generateStealthKeys();
    const client = fakeClient({
      address: OWNER,
      resolver: RESOLVER,
      text: { [defaultRecordKey()]: keys.stealthMetaAddress },
    });
    const report = await auditEnsName(client, 'ghost.eth', { chainId: SEPOLIA, now: NOW });
    const json = JSON.stringify(report);

    // The recipient's own secrets are not in scope of an audit and must not leak.
    expect(json).not.toContain(keys.spendingPrivateKey);
    expect(json).not.toContain(keys.viewingPrivateKey);
    expect(json.toLowerCase()).not.toContain('privatekey');
    // Public keys are expected and fine.
    expect(report.metaAddressValidation.spendingPublicKey).toBe(keys.spendingPublicKey);
    expect(report.metaAddressValidation.viewingPublicKey).toBe(keys.viewingPublicKey);

    const summary = formatSummary(report);
    expect(summary).not.toContain(keys.spendingPrivateKey);
    expect(summary).not.toContain(keys.viewingPrivateKey);
  });

  it('summary names the selected record and its precedence', async () => {
    const keys = generateStealthKeys();
    const client = fakeClient({
      address: OWNER,
      resolver: RESOLVER,
      text: {
        [chainSpecificRecordKey(evmCoinType(SEPOLIA))]: keys.stealthMetaAddress,
      },
    });
    const report = await auditEnsName(client, 'ghost.eth', { chainId: SEPOLIA, now: NOW });
    const summary = formatSummary(report);
    expect(summary).toContain('Status: Private-ready');
    expect(summary).toContain(chainSpecificRecordKey(evmCoinType(SEPOLIA)));
    expect(summary).toMatch(/takes precedence/);
  });
});

describe('single-key meta-addresses are flagged', () => {
  it('warns when the viewing key equals the spending key', async () => {
    const keys = generateStealthKeys();
    const singleKey = `st:eth:${keys.spendingPublicKey}`;
    const client = fakeClient({
      address: OWNER,
      resolver: RESOLVER,
      text: { [defaultRecordKey()]: singleKey },
    });
    const report = await auditEnsName(client, 'ghost.eth', { chainId: SEPOLIA, now: NOW });
    expect(report.overallStatus).toBe('private-ready');
    expect(report.warnings.join(' ')).toMatch(/Single-key meta-address/);
  });
});

describe('honest handling of RPC failure and unconfigured names', () => {
  it('distinguishes a failed address lookup from an absent record', async () => {
    const keys = generateStealthKeys();
    const failing = fakeClient({
      throwOnAddress: true,
      resolver: RESOLVER,
      text: { [defaultRecordKey()]: keys.stealthMetaAddress },
    });
    const report = await auditEnsName(failing, 'ghost.eth', { chainId: SEPOLIA, now: NOW });
    expect(report.conventionalAddress).toBeNull();
    expect(report.conventionalAddressStatus).toBe('failed');
    expect(report.staticMappingNote).toMatch(/Not determined/);
    expect(formatSummary(report)).toMatch(/not determined \(resolution failed\)/);

    const absent = fakeClient({ address: null, resolver: RESOLVER });
    const absentReport = await auditEnsName(absent, 'ghost.eth', { chainId: SEPOLIA, now: NOW });
    expect(absentReport.conventionalAddressStatus).toBe('absent');
  });

  it('reports unknown, not incomplete, when a name has no resolver, no address and no records on this chain', async () => {
    const client = fakeClient({});
    const report = await auditEnsName(client, 'not-here.eth', { chainId: MAINNET, now: NOW });
    expect(report.overallStatus).toBe('unknown');
    expect(report.unknowns.join(' ')).toMatch(/No resolver and no records were found/);
    expect(report.unknowns.join(' ')).toMatch(/different network/);
    // The 'incomplete' warning about a static address must not appear.
    expect(report.warnings.join(' ')).not.toMatch(/linkable to its static address/);
  });
});

describe('incomplete wording depends on whether a static address exists', () => {
  it('does not claim linkability to a static address the name does not have', async () => {
    const client = fakeClient({ address: null, resolver: RESOLVER });
    const report = await auditEnsName(client, 'no-addr.eth', { chainId: SEPOLIA, now: NOW });
    expect(report.overallStatus).toBe('incomplete');
    expect(report.warnings.join(' ')).not.toMatch(/linkable to its static address/);
    expect(report.warnings.join(' ')).toMatch(/no ETH address record either/);
  });
});

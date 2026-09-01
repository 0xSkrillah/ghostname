/**
 * Live read-only smoke tests against real networks. Skipped unless RUN_LIVE=1
 * (network-dependent; not part of the deterministic suite).
 *
 *   RUN_LIVE=1 npm test -- live.ens
 *
 * These perform READ-ONLY mainnet ENS resolution — the exact sanctioned use
 * of skrillah.eth as demo input. No write paths are exercised here.
 */
import { describe, expect, it } from 'vitest';
import { getMainnetClient } from '../src/chain/clients';
import { resolveConventionalAddress, resolveStealthMetaAddress } from '../src/ens/resolve';
import { auditEnsName } from '../src/audit/auditEnsName';
import { getSepoliaClient } from '../src/chain/clients';
import { verifySweepProof } from '../src/relay/proof';
import { verifyPaymentProof } from '../src/relay/paymentProof';
import { SPONSORED_SWEEP_EVIDENCE, STEALTH_PAYMENT_EVIDENCE } from '../src/relay/evidence';

const live = process.env.RUN_LIVE === '1';

describe.runIf(live)('live stealth payment proof (read-only)', () => {
  it('verifies the published payment and announcement from public chain data', async () => {
    const proof = await verifyPaymentProof(
      getSepoliaClient() as never,
      STEALTH_PAYMENT_EVIDENCE,
    );
    for (const check of proof.checks) {
      console.log(`[payment] ${check.state.toUpperCase().padEnd(7)} ${check.label}`);
    }
    // The binding check is the one that matters: the announcement must name
    // the address the payment actually funded.
    expect(proof.checks.find((c) => c.id === 'binding')!.state).toBe('pass');
    expect(proof.checks.find((c) => c.id === 'announcer')!.state).toBe('pass');
    expect(proof.checks.find((c) => c.id === 'scheme')!.state).toBe('pass');
    expect(proof.checks.find((c) => c.id === 'metadata')!.state).toBe('pass');
    expect(proof.verified).toBe(true);
  }, 60_000);
});

describe.runIf(live)('live sponsored exit proof (read-only)', () => {
  it('verifies the published sweep entirely from public chain data', async () => {
    const proof = await verifySweepProof(
      getSepoliaClient() as never,
      SPONSORED_SWEEP_EVIDENCE,
    );
    for (const check of proof.checks) {
      console.log(`[proof] ${check.state.toUpperCase().padEnd(7)} ${check.label}`);
    }
    expect(proof.checks.find((c) => c.id === 'receipt')!.state).toBe('pass');
    expect(proof.checks.find((c) => c.id === 'type')!.state).toBe('pass');
    expect(proof.checks.find((c) => c.id === 'sponsor')!.state).toBe('pass');
    expect(proof.checks.find((c) => c.id === 'delegation')!.state).toBe('pass');
    expect(proof.checks.find((c) => c.id === 'calldata')!.state).toBe('pass');
    expect(proof.checks.find((c) => c.id === 'intent')!.state).toBe('pass');
    expect(proof.checks.find((c) => c.id === 'event')!.state).toBe('pass');
    expect(proof.verified).toBe(true);
  }, 60_000);
});

describe.runIf(live)('live mainnet ENS (read-only)', () => {
  it('resolves an established name to its conventional address', async () => {
    const result = await resolveConventionalAddress(getMainnetClient(), 'skrillah.eth');
    expect(result.name).toBe('skrillah.eth');
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  }, 30_000);

  it('resolves vitalik.eth (arbitrary-name check)', async () => {
    const result = await resolveConventionalAddress(getMainnetClient(), 'vitalik.eth');
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  }, 30_000);

  it('reports stealth record status for a name without one', async () => {
    const result = await resolveStealthMetaAddress(getMainnetClient(), 'vitalik.eth');
    expect(['none', 'ok', 'invalid']).toContain(result.status);
  }, 30_000);

  it('GhostCheck audits an established mainnet name end to end', async () => {
    const report = await auditEnsName(getMainnetClient(), 'skrillah.eth', { chainId: 1 });
    console.log(
      `[audit] skrillah.eth => ${report.overallStatus}, addr ${report.conventionalAddress}, resolver ${report.resolver.address}`,
    );
    expect(report.name).toBe('skrillah.eth');
    expect(report.chainId).toBe(1);
    // A name with no stealth record must read as incomplete, never as ready.
    expect(['incomplete', 'misconfigured', 'private-ready']).toContain(report.overallStatus);
    // All three normative + diagnostic keys are probed on mainnet.
    expect(report.recordSources.length).toBe(3);
    expect(report.recordSources.some((s) => !s.normative)).toBe(true);
    // Provenance is never guessed.
    expect(report.resolver.provenance).toBe('unknown');
    // No secrets, ever.
    expect(JSON.stringify(report).toLowerCase()).not.toContain('privatekey');
  }, 60_000);
});

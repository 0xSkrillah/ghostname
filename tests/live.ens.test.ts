/**
 * Live read-only smoke tests against real networks. Network-dependent, so they
 * are not part of the deterministic suite.
 *
 *   RUN_LIVE=1 LIVE_MAINNET_ENS_NAME=name.eth npm test -- live.ens
 *
 * The mainnet checks need an established ENS name supplied through
 * LIVE_MAINNET_ENS_NAME and are skipped when it is absent. No personal name is
 * committed here. Only READ-ONLY resolution is performed; no write path is
 * exercised.
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
const MAINNET_NAME = process.env.LIVE_MAINNET_ENS_NAME?.trim() || '';
const liveMainnet = live && MAINNET_NAME.length > 0;

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

describe.runIf(live && !liveMainnet)('live mainnet ENS (read-only, not configured)', () => {
  it('is skipped because LIVE_MAINNET_ENS_NAME is not set', () => {
    expect(liveMainnet).toBe(false);
  });
});

describe.runIf(liveMainnet)('live mainnet ENS (read-only)', () => {
  it('resolves the configured established name to its conventional address', async () => {
    const result = await resolveConventionalAddress(getMainnetClient(), MAINNET_NAME);
    expect(result.name).toBe(MAINNET_NAME.toLowerCase());
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  }, 30_000);

  it('resolves an unrelated organisation name (arbitrary-name check)', async () => {
    // ens.eth is the ENS DAO's own name, not a personal identity.
    const result = await resolveConventionalAddress(getMainnetClient(), 'ens.eth');
    expect(result.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  }, 30_000);

  it('reports stealth record status without throwing', async () => {
    const result = await resolveStealthMetaAddress(getMainnetClient(), 'ens.eth');
    expect(['none', 'ok', 'invalid']).toContain(result.status);
  }, 30_000);

  it('GhostCheck audits the configured established mainnet name end to end', async () => {
    const report = await auditEnsName(getMainnetClient(), MAINNET_NAME, { chainId: 1 });
    console.log(
      `[audit] ${report.name} => ${report.overallStatus}, addr ${report.conventionalAddress}, resolver ${report.resolver.address}`,
    );
    expect(report.name).toBe(MAINNET_NAME.toLowerCase());
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

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

const live = process.env.RUN_LIVE === '1';

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
});

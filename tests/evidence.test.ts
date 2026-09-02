/**
 * Published evidence must keep verifying regardless of local configuration:
 * the expected executor of the historical sponsored sweep is pinned, not read
 * from an env override that a deployer may legitimately change.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const PINNED = '0x94E4C39055fa4a5fCd47E03CbcbCD0503848806b';

describe('published evidence references', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('pins the historical sweep executor even when VITE_SWEEP_EXECUTOR is overridden', async () => {
    vi.stubEnv('VITE_SWEEP_EXECUTOR', '0x000000000000000000000000000000000000dEaD');
    vi.resetModules();
    const { SPONSORED_SWEEP_EVIDENCE } = await import('../src/relay/evidence');
    const { SWEEP_EXECUTOR, SEPOLIA_DEMO_SWEEP_EXECUTOR } = await import('../src/config');
    expect(SWEEP_EXECUTOR.toLowerCase()).toBe('0x000000000000000000000000000000000000dead');
    expect(SEPOLIA_DEMO_SWEEP_EXECUTOR).toBe(PINNED);
    expect(SPONSORED_SWEEP_EVIDENCE.expectedExecutor).toBe(PINNED);
  });

  it('points every evidence reference at Sepolia and the Sepolia explorer', async () => {
    const { SPONSORED_SWEEP_EVIDENCE, STEALTH_PAYMENT_EVIDENCE } = await import('../src/relay/evidence');
    for (const ref of [SPONSORED_SWEEP_EVIDENCE, STEALTH_PAYMENT_EVIDENCE]) {
      expect(ref.chainId).toBe(11155111);
      expect(ref.explorerBase).toBe('https://sepolia.etherscan.io');
    }
    expect(SPONSORED_SWEEP_EVIDENCE.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(STEALTH_PAYMENT_EVIDENCE.paymentTxHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(STEALTH_PAYMENT_EVIDENCE.announcementTxHash).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

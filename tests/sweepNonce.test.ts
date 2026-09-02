/**
 * A second sweep package for the same stealth EOA must not collide with the
 * first on the executor's replay guard, so the UI uses a fresh random nonce.
 */
import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import { randomSweepNonce, signNativeSweepPackage } from '../src/relay/sweep';
import { computeStealthPrivateKey, generateStealthAddress, generateStealthKeys } from '../src/crypto/stealth';

describe('randomSweepNonce', () => {
  it('is a fresh uint256 on every call', () => {
    const seen = new Set<bigint>();
    for (let i = 0; i < 50; i++) {
      const nonce = randomSweepNonce();
      expect(nonce).toBeGreaterThanOrEqual(0n);
      expect(nonce).toBeLessThan(1n << 256n);
      seen.add(nonce);
    }
    expect(seen.size).toBe(50);
  });

  it('gives two packages for the same key different replay-guard nonces', async () => {
    const recipient = generateStealthKeys();
    const announcement = generateStealthAddress(recipient.stealthMetaAddress);
    const stealthPrivateKey = computeStealthPrivateKey({
      spendingPrivateKey: recipient.spendingPrivateKey,
      viewingPrivateKey: recipient.viewingPrivateKey,
      ephemeralPublicKey: announcement.ephemeralPublicKey,
    });
    const base = {
      stealthPrivateKey,
      chainId: 11155111,
      executor: getAddress('0x94e4c39055fa4a5fcd47e03cbcbcd0503848806b'),
      destination: getAddress('0xdddddddddddddddddddddddddddddddddddddddd'),
      amount: 1n,
      authorizationNonce: 0,
      deadline: 1_800_000_000n,
    };
    const a = await signNativeSweepPackage({ ...base, sweepNonce: randomSweepNonce() });
    const b = await signNativeSweepPackage({ ...base, sweepNonce: randomSweepNonce() });
    expect(a.sweepNonce).not.toBe(b.sweepNonce);
    expect(a.sweepSignature).not.toBe(b.sweepSignature);
    // The account nonce is unaffected by the replay-guard nonce.
    expect(a.authorization.nonce).toBe(0);
    expect(b.authorization.nonce).toBe(0);
  });
});

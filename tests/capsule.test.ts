/**
 * P3 — client-side encrypted recovery capsule. Proves round-trip integrity,
 * wrong-passphrase rejection, tamper detection, and that no plaintext key
 * material appears in the serialized capsule.
 */
import { describe, expect, it } from 'vitest';
import { encryptCapsule, decryptCapsule, assertTestnetOnly } from '../src/swarm/capsule';
import { generateStealthKeys } from '../src/crypto/stealth';

describe('encrypted recovery capsule', () => {
  it('round-trips an identity with the correct passphrase', async () => {
    const identity = generateStealthKeys();
    const capsule = await encryptCapsule(identity, 'correct horse battery');
    const recovered = await decryptCapsule<typeof identity>(capsule, 'correct horse battery');
    expect(recovered).toEqual(identity);
  });

  it('never stores plaintext key material in the capsule', async () => {
    const identity = generateStealthKeys();
    const capsule = await encryptCapsule(identity, 'a-good-passphrase');
    const serialized = JSON.stringify(capsule);
    expect(serialized).not.toContain(identity.spendingPrivateKey);
    expect(serialized).not.toContain(identity.viewingPrivateKey);
    expect(serialized).not.toContain(identity.spendingPrivateKey.slice(2));
    // Only ciphertext + params are present.
    expect(capsule.cipher).toBe('AES-256-GCM');
    expect(capsule.network).toBe('testnet');
  });

  it('rejects a wrong passphrase (GCM auth failure)', async () => {
    const capsule = await encryptCapsule({ secret: 42 }, 'right-passphrase');
    await expect(decryptCapsule(capsule, 'wrong-passphrase')).rejects.toThrow(
      /wrong passphrase or corrupted/,
    );
  });

  it('detects tampering with the ciphertext', async () => {
    const capsule = await encryptCapsule({ secret: 'x' }, 'passphrase-123');
    const tampered = { ...capsule, ciphertext: capsule.ciphertext.slice(0, -4) + 'AAAA' };
    await expect(decryptCapsule(tampered, 'passphrase-123')).rejects.toThrow();
  });

  it('produces fresh salt and IV per encryption', async () => {
    const a = await encryptCapsule({ x: 1 }, 'passphrase-123');
    const b = await encryptCapsule({ x: 1 }, 'passphrase-123');
    expect(a.salt).not.toBe(b.salt);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('rejects a too-short passphrase', async () => {
    await expect(encryptCapsule({ x: 1 }, 'short')).rejects.toThrow(/at least 8/);
  });

  it('rejects a non-capsule object', async () => {
    // @ts-expect-error deliberately malformed
    await expect(decryptCapsule({ format: 'nope' }, 'passphrase-123')).rejects.toThrow(
      /Not a GhostName capsule/,
    );
  });

  it('testnet guard blocks a mainnet-flagged identity', () => {
    expect(() => assertTestnetOnly({ network: 'testnet' })).not.toThrow();
    expect(() => assertTestnetOnly({ network: 'sepolia' })).not.toThrow();
    expect(() => assertTestnetOnly({ network: 'mainnet' })).toThrow(/testnet-only/);
  });
});

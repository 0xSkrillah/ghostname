/**
 * Client-side encrypted recovery capsule. Proves round-trip integrity,
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
    await expect(encryptCapsule({ x: 1 }, 'short')).rejects.toThrow(/at least 12/);
    await expect(encryptCapsule({ x: 1 }, 'elevenchars')).rejects.toThrow(/at least 12/);
  });

  it('uses the OWASP PBKDF2-SHA256 iteration count and binds the header (version 2)', async () => {
    const capsule = await encryptCapsule({ x: 1 }, 'passphrase-123');
    expect(capsule.iterations).toBe(600_000);
    expect(capsule.version).toBe(2);
    // Relabelling the header must break authentication even though the
    // ciphertext is untouched.
    await expect(
      decryptCapsule({ ...capsule, iterations: 599_999 }, 'passphrase-123'),
    ).rejects.toThrow(/Decryption failed/);
  });

  it('treats Unicode-equivalent passphrases as the same passphrase', async () => {
    const composed = 'caf\u00e9-passphrase!';
    const decomposed = 'cafe\u0301-passphrase!';
    const capsule = await encryptCapsule({ x: 1 }, composed);
    await expect(decryptCapsule(capsule, decomposed)).resolves.toEqual({ x: 1 });
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

describe('untrusted capsule headers', () => {
  it('rejects out-of-band iteration counts, wrong sizes and bad base64 before deriving a key', async () => {
    const capsule = await encryptCapsule({ x: 1 }, 'passphrase-123');
    await expect(decryptCapsule({ ...capsule, iterations: 1 }, 'passphrase-123')).rejects.toThrow(/iteration/);
    await expect(decryptCapsule({ ...capsule, iterations: 10_000_000 }, 'passphrase-123')).rejects.toThrow(/iteration/);
    await expect(decryptCapsule({ ...capsule, salt: 'AAAA' }, 'passphrase-123')).rejects.toThrow(/length/);
    await expect(decryptCapsule({ ...capsule, iv: '!!!' }, 'passphrase-123')).rejects.toThrow(/base64|length/);
    await expect(decryptCapsule({ ...capsule, version: 3 as never }, 'passphrase-123')).rejects.toThrow(/version/);
    await expect(decryptCapsule({ ...capsule, network: 'mainnet' as never }, 'passphrase-123')).rejects.toThrow(/testnet-only/);
    await expect(decryptCapsule('{not json', 'passphrase-123')).rejects.toThrow(/invalid JSON/);
  });

  it('accepts the JSON text form of a capsule', async () => {
    const capsule = await encryptCapsule({ hello: 'world' }, 'passphrase-123');
    const recovered = await decryptCapsule<{ hello: string }>(JSON.stringify(capsule), 'passphrase-123');
    expect(recovered.hello).toBe('world');
  });
});

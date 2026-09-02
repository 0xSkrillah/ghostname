/**
 * M0 — cryptographic proof of the ERC-5564 scheme-1 core, before any UI/chain code.
 *
 * Proves: generate → derive (A != B, fresh randomness) → recognise (positive
 * and negative) → recover (stealth private key controls the destination).
 */
import { describe, expect, it } from 'vitest';
import {
  checkStealthAddress,
  computeStealthPrivateKey,
  generateRandomPrivateKey,
  generateStealthAddress,
  generateStealthKeys,
  privateKeyToAddress,
  publicKeyToAddress,
} from '../src/crypto/stealth';
import { parseStealthMetaAddress } from '../src/crypto/metaAddress';
import { bytesToHex, type Hex } from 'viem';

/** Fixed keys for deterministic sub-tests (never use fixed keys in the app). */
const FIXED = {
  spendingPrivateKey: '0x0000000000000000000000000000000000000000000000000000000000000002' as Hex,
  viewingPrivateKey: '0x0000000000000000000000000000000000000000000000000000000000000003' as Hex,
  ephemeralPrivateKey: '0x0000000000000000000000000000000000000000000000000000000000000004' as Hex,
};

function fixedIdentity() {
  const spendingPublicKey = publicKeyFromPrivate(FIXED.spendingPrivateKey);
  const viewingPublicKey = publicKeyFromPrivate(FIXED.viewingPrivateKey);
  const stealthMetaAddress = `st:eth:0x${spendingPublicKey.slice(2)}${viewingPublicKey.slice(2)}`;
  return { spendingPublicKey, viewingPublicKey, stealthMetaAddress };
}

import { secp256k1 } from '@noble/curves/secp256k1';
function publicKeyFromPrivate(priv: Hex): Hex {
  return bytesToHex(secp256k1.getPublicKey(priv.slice(2), true));
}

describe('generateStealthKeys', () => {
  it('produces a valid, parseable scheme-1 meta-address', () => {
    const keys = generateStealthKeys();
    expect(keys.stealthMetaAddress.startsWith('st:eth:0x')).toBe(true);
    const parsed = parseStealthMetaAddress(keys.stealthMetaAddress);
    expect(bytesToHex(parsed.spendingPublicKey)).toBe(keys.spendingPublicKey);
    expect(bytesToHex(parsed.viewingPublicKey)).toBe(keys.viewingPublicKey);
  });

  it('derives public keys that match the private keys', () => {
    const keys = generateStealthKeys();
    expect(publicKeyFromPrivate(keys.spendingPrivateKey)).toBe(keys.spendingPublicKey);
    expect(publicKeyFromPrivate(keys.viewingPrivateKey)).toBe(keys.viewingPublicKey);
  });

  it('uses independent randomness: repeated calls never collide', () => {
    const a = generateStealthKeys();
    const b = generateStealthKeys();
    expect(a.spendingPrivateKey).not.toBe(b.spendingPrivateKey);
    expect(a.viewingPrivateKey).not.toBe(b.viewingPrivateKey);
    expect(a.spendingPrivateKey).not.toBe(a.viewingPrivateKey);
    expect(a.stealthMetaAddress).not.toBe(b.stealthMetaAddress);
  });
});

describe('generateStealthAddress (sender)', () => {
  it('is deterministic for a fixed ephemeral key', () => {
    const { stealthMetaAddress } = fixedIdentity();
    const a = generateStealthAddress(stealthMetaAddress, {
      ephemeralPrivateKey: FIXED.ephemeralPrivateKey,
    });
    const b = generateStealthAddress(stealthMetaAddress, {
      ephemeralPrivateKey: FIXED.ephemeralPrivateKey,
    });
    expect(a).toEqual(b);
    expect(a.stealthAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(a.ephemeralPublicKey).toBe(publicKeyFromPrivate(FIXED.ephemeralPrivateKey));
    expect(a.viewTag).toMatch(/^0x[0-9a-f]{2}$/);
  });

  it('two derivations for the same meta-address produce DIFFERENT destinations', () => {
    const keys = generateStealthKeys();
    const a = generateStealthAddress(keys.stealthMetaAddress);
    const b = generateStealthAddress(keys.stealthMetaAddress);
    expect(a.stealthAddress).not.toBe(b.stealthAddress);
    expect(a.ephemeralPublicKey).not.toBe(b.ephemeralPublicKey);
  });

  it('generates fresh ephemeral randomness on every call (10 rounds, all distinct)', () => {
    const keys = generateStealthKeys();
    const results = Array.from({ length: 10 }, () =>
      generateStealthAddress(keys.stealthMetaAddress),
    );
    const addresses = new Set(results.map((r) => r.stealthAddress));
    const ephemerals = new Set(results.map((r) => r.ephemeralPublicKey));
    expect(addresses.size).toBe(10);
    expect(ephemerals.size).toBe(10);
  });

  it('rejects an invalid ephemeral key', () => {
    const keys = generateStealthKeys();
    expect(() =>
      generateStealthAddress(keys.stealthMetaAddress, {
        ephemeralPrivateKey: new Uint8Array(32), // zero — not a valid scalar
      }),
    ).toThrow();
  });

  it('rejects malformed meta-addresses', () => {
    expect(() => generateStealthAddress('st:eth:0x1234')).toThrow();
    expect(() => generateStealthAddress('not-a-meta-address')).toThrow();
  });
});

describe('checkStealthAddress (recipient)', () => {
  it('the intended viewing key recognises the payment (with view tag)', () => {
    const keys = generateStealthKeys();
    const announcement = generateStealthAddress(keys.stealthMetaAddress);
    expect(
      checkStealthAddress({
        stealthAddress: announcement.stealthAddress,
        ephemeralPublicKey: announcement.ephemeralPublicKey,
        viewTag: announcement.viewTag,
        viewingPrivateKey: keys.viewingPrivateKey,
        spendingPublicKey: keys.spendingPublicKey,
      }),
    ).toBe(true);
  });

  it('recognises the payment without a view tag too (slow path)', () => {
    const keys = generateStealthKeys();
    const announcement = generateStealthAddress(keys.stealthMetaAddress);
    expect(
      checkStealthAddress({
        stealthAddress: announcement.stealthAddress,
        ephemeralPublicKey: announcement.ephemeralPublicKey,
        viewingPrivateKey: keys.viewingPrivateKey,
        spendingPublicKey: keys.spendingPublicKey,
      }),
    ).toBe(true);
  });

  it('an UNRELATED viewing key does NOT recognise the payment', () => {
    const recipient = generateStealthKeys();
    const stranger = generateStealthKeys();
    const announcement = generateStealthAddress(recipient.stealthMetaAddress);
    expect(
      checkStealthAddress({
        stealthAddress: announcement.stealthAddress,
        ephemeralPublicKey: announcement.ephemeralPublicKey,
        viewTag: announcement.viewTag,
        viewingPrivateKey: stranger.viewingPrivateKey,
        spendingPublicKey: stranger.spendingPublicKey,
      }),
    ).toBe(false);
  });

  it('50 random unrelated viewing keys all fail to recognise the payment', () => {
    const recipient = generateStealthKeys();
    const announcement = generateStealthAddress(recipient.stealthMetaAddress);
    for (let i = 0; i < 50; i++) {
      const stranger = generateStealthKeys();
      expect(
        checkStealthAddress({
          stealthAddress: announcement.stealthAddress,
          ephemeralPublicKey: announcement.ephemeralPublicKey,
          viewTag: announcement.viewTag,
          viewingPrivateKey: stranger.viewingPrivateKey,
          spendingPublicKey: stranger.spendingPublicKey,
        }),
      ).toBe(false);
    }
  });

  it('a wrong view tag short-circuits to false even for the right key', () => {
    const keys = generateStealthKeys();
    const announcement = generateStealthAddress(keys.stealthMetaAddress);
    const wrongTag = announcement.viewTag === '0x00' ? ('0x01' as Hex) : ('0x00' as Hex);
    expect(
      checkStealthAddress({
        stealthAddress: announcement.stealthAddress,
        ephemeralPublicKey: announcement.ephemeralPublicKey,
        viewTag: wrongTag,
        viewingPrivateKey: keys.viewingPrivateKey,
        spendingPublicKey: keys.spendingPublicKey,
      }),
    ).toBe(false);
  });

  it('garbage announcement data returns false rather than throwing', () => {
    const keys = generateStealthKeys();
    expect(
      checkStealthAddress({
        stealthAddress: '0x0000000000000000000000000000000000000001',
        ephemeralPublicKey: '0xdeadbeef' as Hex,
        viewingPrivateKey: keys.viewingPrivateKey,
        spendingPublicKey: keys.spendingPublicKey,
      }),
    ).toBe(false);
  });
});

describe('computeStealthPrivateKey (recovery)', () => {
  it('the derived stealth private key controls the announced destination', () => {
    const keys = generateStealthKeys();
    const announcement = generateStealthAddress(keys.stealthMetaAddress);
    const stealthPrivateKey = computeStealthPrivateKey({
      spendingPrivateKey: keys.spendingPrivateKey,
      viewingPrivateKey: keys.viewingPrivateKey,
      ephemeralPublicKey: announcement.ephemeralPublicKey,
    });
    expect(privateKeyToAddress(stealthPrivateKey)).toBe(announcement.stealthAddress);
  });

  it('holds across 10 independent payments to the same identity', () => {
    const keys = generateStealthKeys();
    for (let i = 0; i < 10; i++) {
      const announcement = generateStealthAddress(keys.stealthMetaAddress);
      const stealthPrivateKey = computeStealthPrivateKey({
        spendingPrivateKey: keys.spendingPrivateKey,
        viewingPrivateKey: keys.viewingPrivateKey,
        ephemeralPublicKey: announcement.ephemeralPublicKey,
      });
      expect(privateKeyToAddress(stealthPrivateKey)).toBe(announcement.stealthAddress);
    }
  });

  it("a stranger's spending key does NOT control the destination", () => {
    const recipient = generateStealthKeys();
    const stranger = generateStealthKeys();
    const announcement = generateStealthAddress(recipient.stealthMetaAddress);
    const strangerKey = computeStealthPrivateKey({
      spendingPrivateKey: stranger.spendingPrivateKey,
      viewingPrivateKey: stranger.viewingPrivateKey,
      ephemeralPublicKey: announcement.ephemeralPublicKey,
    });
    expect(privateKeyToAddress(strangerKey)).not.toBe(announcement.stealthAddress);
  });
});

describe('address helpers', () => {
  it('publicKeyToAddress matches privateKeyToAddress', () => {
    const priv = bytesToHex(generateRandomPrivateKey());
    const pub = publicKeyFromPrivate(priv);
    expect(publicKeyToAddress(pub)).toBe(privateKeyToAddress(priv));
  });
});

describe('malformed key material is rejected without being echoed', () => {
  it('names the field but never repeats the offending value', () => {
    const almostKey = `0x${'ab'.repeat(31)}a`; // 63 hex chars
    const cases: Array<() => unknown> = [
      () =>
        computeStealthPrivateKey({
          spendingPrivateKey: almostKey as Hex,
          viewingPrivateKey: FIXED.viewingPrivateKey,
          ephemeralPublicKey: publicKeyFromPrivate(FIXED.ephemeralPrivateKey),
        }),
      () => privateKeyToAddress(almostKey as Hex),
      () =>
        generateStealthAddress(fixedIdentity().stealthMetaAddress, {
          ephemeralPrivateKey: almostKey as Hex,
        }),
    ];
    for (const run of cases) {
      let message = '';
      try {
        run();
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).toMatch(/32-byte hex/);
      expect(message).not.toContain('abab');
    }
  });

  it('checkStealthAddress returns false, never throws, for a malformed viewing key', () => {
    const keys = generateStealthKeys();
    const announcement = generateStealthAddress(keys.stealthMetaAddress);
    expect(
      checkStealthAddress({
        stealthAddress: announcement.stealthAddress,
        ephemeralPublicKey: announcement.ephemeralPublicKey,
        viewingPrivateKey: '0x1234' as Hex,
        spendingPublicKey: keys.spendingPublicKey,
      }),
    ).toBe(false);
  });
});

describe('hostile announcements are rejected, never recognised', () => {
  const keys = generateStealthKeys();
  const genuine = generateStealthAddress(keys.stealthMetaAddress);
  const recipient = { viewingPrivateKey: keys.viewingPrivateKey, spendingPublicKey: keys.spendingPublicKey };

  it('an on-curve but unrelated ephemeral key with the genuine view tag is not recognised', () => {
    const otherEphemeral = bytesToHex(secp256k1.getPublicKey(generateRandomPrivateKey(), true));
    expect(
      checkStealthAddress({
        stealthAddress: genuine.stealthAddress,
        ephemeralPublicKey: otherEphemeral,
        viewTag: genuine.viewTag,
        ...recipient,
      }),
    ).toBe(false);
  });

  it('off-curve, uncompressed and short ephemeral keys return false and never throw', () => {
    const offCurve = `0x02${'ff'.repeat(32)}` as Hex;
    const uncompressed = bytesToHex(secp256k1.getPublicKey(generateRandomPrivateKey(), false));
    for (const ephemeralPublicKey of [offCurve, uncompressed, '0x02' as Hex, '0x' as Hex]) {
      expect(
        checkStealthAddress({
          stealthAddress: genuine.stealthAddress,
          ephemeralPublicKey,
          viewTag: genuine.viewTag,
          ...recipient,
        }),
      ).toBe(false);
    }
  });

  it('recovery refuses non-compressed ephemeral keys with a clear error', () => {
    const uncompressed = bytesToHex(secp256k1.getPublicKey(generateRandomPrivateKey(), false));
    expect(() =>
      computeStealthPrivateKey({
        spendingPrivateKey: keys.spendingPrivateKey,
        viewingPrivateKey: keys.viewingPrivateKey,
        ephemeralPublicKey: uncompressed,
      }),
    ).toThrow(/33-byte compressed/);
    expect(() =>
      computeStealthPrivateKey({
        spendingPrivateKey: keys.spendingPrivateKey,
        viewingPrivateKey: keys.viewingPrivateKey,
        ephemeralPublicKey: `0x02${'ff'.repeat(32)}` as Hex,
      }),
    ).toThrow();
  });
});

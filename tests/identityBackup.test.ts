/**
 * Identity import is untrusted input. A backup must be validated by shape and
 * range, its public material re-derived, and mismatches rejected so a user can
 * never publish a meta-address whose funds they cannot spend.
 */
import { describe, expect, it } from 'vitest';
import { InvalidIdentityBackupError, parseIdentityBackup } from '../src/crypto/identityBackup';
import { generateStealthKeys } from '../src/crypto/stealth';

const N_MINUS_1 = '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364140';
const N = '0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141';

describe('parseIdentityBackup', () => {
  it('round-trips a backup produced by the app', () => {
    const keys = generateStealthKeys();
    const parsed = parseIdentityBackup(JSON.stringify(keys));
    expect(parsed).toEqual(keys);
    expect(Object.keys(parsed).sort()).toEqual(
      ['spendingPrivateKey', 'spendingPublicKey', 'stealthMetaAddress', 'viewingPrivateKey', 'viewingPublicKey'].sort(),
    );
  });

  it('re-derives public keys and meta-address when only private keys are given', () => {
    const keys = generateStealthKeys();
    const parsed = parseIdentityBackup({
      spendingPrivateKey: keys.spendingPrivateKey,
      viewingPrivateKey: keys.viewingPrivateKey,
    });
    expect(parsed).toEqual(keys);
  });

  it('rejects a meta-address that does not belong to the private keys', () => {
    const mine = generateStealthKeys();
    const theirs = generateStealthKeys();
    expect(() =>
      parseIdentityBackup({ ...mine, stealthMetaAddress: theirs.stealthMetaAddress }),
    ).toThrow(/does not match the private keys/);
  });

  it('rejects declared public keys that do not match', () => {
    const mine = generateStealthKeys();
    const theirs = generateStealthKeys();
    expect(() => parseIdentityBackup({ ...mine, spendingPublicKey: theirs.spendingPublicKey })).toThrow(
      /spendingPublicKey does not match/,
    );
    expect(() => parseIdentityBackup({ ...mine, viewingPublicKey: theirs.viewingPublicKey })).toThrow(
      /viewingPublicKey does not match/,
    );
  });

  it('rejects malformed, out-of-range and identical private keys', () => {
    const keys = generateStealthKeys();
    const base = { spendingPrivateKey: keys.spendingPrivateKey, viewingPrivateKey: keys.viewingPrivateKey };
    expect(() => parseIdentityBackup({ ...base, spendingPrivateKey: '0x01' })).toThrow(InvalidIdentityBackupError);
    expect(() => parseIdentityBackup({ ...base, spendingPrivateKey: 'not hex' })).toThrow(/32-byte hex/);
    expect(() => parseIdentityBackup({ ...base, spendingPrivateKey: `0x${'00'.repeat(32)}` })).toThrow(/scalar/);
    expect(() => parseIdentityBackup({ ...base, spendingPrivateKey: N })).toThrow(/scalar/);
    expect(() => parseIdentityBackup({ ...base, spendingPrivateKey: N_MINUS_1 })).not.toThrow();
    expect(() => parseIdentityBackup({ ...base, viewingPrivateKey: keys.spendingPrivateKey })).toThrow(/identical/);
    expect(() => parseIdentityBackup({ viewingPrivateKey: keys.viewingPrivateKey })).toThrow(/spendingPrivateKey is missing/);
  });

  it('rejects non-object inputs and invalid JSON', () => {
    expect(() => parseIdentityBackup('{not json')).toThrow(/not valid JSON/);
    expect(() => parseIdentityBackup('[]')).toThrow(/JSON object/);
    expect(() => parseIdentityBackup('null')).toThrow(/JSON object/);
    expect(() => parseIdentityBackup(42)).toThrow(/JSON object/);
  });

  it('drops unknown keys and cannot pollute prototypes', () => {
    const keys = generateStealthKeys();
    const hostile = `{"spendingPrivateKey":"${keys.spendingPrivateKey}","viewingPrivateKey":"${keys.viewingPrivateKey}","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"extra":"field"}`;
    const parsed = parseIdentityBackup(hostile) as unknown as Record<string, unknown>;
    expect(parsed['extra']).toBeUndefined();
    expect(parsed['polluted']).toBeUndefined();
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
  });

  it('never echoes key material in error messages', () => {
    const keys = generateStealthKeys();
    try {
      parseIdentityBackup({ ...keys, stealthMetaAddress: generateStealthKeys().stealthMetaAddress });
      throw new Error('expected rejection');
    } catch (err) {
      const message = (err as Error).message;
      expect(message).not.toContain(keys.spendingPrivateKey);
      expect(message).not.toContain(keys.viewingPrivateKey);
    }
  });
});

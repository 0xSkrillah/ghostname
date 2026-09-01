import { describe, expect, it } from 'vitest';
import { bytesToHex } from 'viem';
import {
  ENS_STEALTH_RECORD_KEY,
  InvalidStealthMetaAddressError,
  encodeStealthMetaAddress,
  isValidStealthMetaAddress,
  parseStealthMetaAddress,
} from '../src/crypto/metaAddress';
import { generateStealthKeys } from '../src/crypto/stealth';

describe('ENS record convention', () => {
  it('uses the RFC text-record key for scheme 1', () => {
    expect(ENS_STEALTH_RECORD_KEY).toBe('stealth-meta-address[1]');
  });
});

describe('parseStealthMetaAddress', () => {
  it('round-trips generated identities', () => {
    const keys = generateStealthKeys();
    const parsed = parseStealthMetaAddress(keys.stealthMetaAddress);
    expect(bytesToHex(parsed.spendingPublicKey)).toBe(keys.spendingPublicKey);
    expect(bytesToHex(parsed.viewingPublicKey)).toBe(keys.viewingPublicKey);
    expect(
      encodeStealthMetaAddress(parsed.spendingPublicKey, parsed.viewingPublicKey),
    ).toBe(keys.stealthMetaAddress);
  });

  it('accepts a bare 0x hex payload (no st:eth: prefix)', () => {
    const keys = generateStealthKeys();
    const bare = keys.stealthMetaAddress.replace('st:eth:', '');
    const parsed = parseStealthMetaAddress(bare);
    expect(bytesToHex(parsed.spendingPublicKey)).toBe(keys.spendingPublicKey);
  });

  it('accepts the single-key (33-byte) form with one key for both roles', () => {
    const keys = generateStealthKeys();
    const single = `st:eth:${keys.spendingPublicKey}`;
    const parsed = parseStealthMetaAddress(single);
    expect(bytesToHex(parsed.spendingPublicKey)).toBe(keys.spendingPublicKey);
    expect(bytesToHex(parsed.viewingPublicKey)).toBe(keys.spendingPublicKey);
  });

  it('tolerates surrounding whitespace (as stored in ENS text records)', () => {
    const keys = generateStealthKeys();
    const parsed = parseStealthMetaAddress(`  ${keys.stealthMetaAddress}\n`);
    expect(bytesToHex(parsed.viewingPublicKey)).toBe(keys.viewingPublicKey);
  });

  it('rejects wrong length, bad hex, wrong chain, off-curve and bad SEC1 prefixes', () => {
    const keys = generateStealthKeys();
    const good = keys.stealthMetaAddress;
    const cases: string[] = [
      '', // empty
      'st:eth:', // no payload
      'st:eth:0x1234', // wrong length
      good.slice(0, -2), // truncated
      `${good}ab`, // extra bytes
      good.replace('0x02', '0x05').replace('0x03', '0x05'), // possibly invalid prefix
      'st:btc:0x' + good.slice(9), // wrong chain prefix
      'st:eth:0x' + 'zz'.repeat(66), // non-hex
      'st:eth:0x' + '02' + 'ff'.repeat(32) + good.slice(9 + 66), // off-curve point
      '0x' + '04'.repeat(66), // uncompressed-style prefix, wrong format
    ];
    for (const value of cases) {
      expect(isValidStealthMetaAddress(value), `should reject: ${value}`).toBe(false);
      expect(() => parseStealthMetaAddress(value)).toThrow(InvalidStealthMetaAddressError);
    }
  });

  it('is case-insensitive on the st:eth: prefix', () => {
    const keys = generateStealthKeys();
    const upper = keys.stealthMetaAddress.replace('st:eth:', 'ST:ETH:');
    expect(isValidStealthMetaAddress(upper)).toBe(true);
  });
});

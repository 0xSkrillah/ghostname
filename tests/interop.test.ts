/**
 * Interoperability cross-check: our scheme-1 implementation must produce
 * byte-identical results to the ScopeLift stealth-address-sdk (the EF-funded
 * ERC-5564 reference SDK). The SDK is a dev-only test oracle, never shipped.
 */
import { describe, expect, it } from 'vitest';
import {
  generateStealthAddress as sdkGenerateStealthAddress,
  computeStealthKey as sdkComputeStealthKey,
  checkStealthAddress as sdkCheckStealthAddress,
  VALID_SCHEME_ID,
} from '@scopelift/stealth-address-sdk';
import { hexToBytes, type Hex } from 'viem';
import {
  checkStealthAddress,
  computeStealthPrivateKey,
  generateRandomPrivateKey,
  generateStealthAddress,
  generateStealthKeys,
} from '../src/crypto/stealth';

describe('interop with @scopelift/stealth-address-sdk', () => {
  it('sender derivation matches the SDK for a fixed ephemeral key', () => {
    for (let i = 0; i < 5; i++) {
      const keys = generateStealthKeys();
      const ephemeralPrivateKey = generateRandomPrivateKey();

      const ours = generateStealthAddress(keys.stealthMetaAddress, { ephemeralPrivateKey });
      const theirs = sdkGenerateStealthAddress({
        stealthMetaAddressURI: keys.stealthMetaAddress,
        schemeId: VALID_SCHEME_ID.SCHEME_ID_1,
        ephemeralPrivateKey,
      });

      expect(ours.stealthAddress.toLowerCase()).toBe(theirs.stealthAddress.toLowerCase());
      expect(ours.ephemeralPublicKey.toLowerCase()).toBe(
        theirs.ephemeralPublicKey.toLowerCase(),
      );
      expect(ours.viewTag.toLowerCase()).toBe(theirs.viewTag.toLowerCase());
    }
  });

  it('the SDK recognises announcements we generate', () => {
    const keys = generateStealthKeys();
    const announcement = generateStealthAddress(keys.stealthMetaAddress);
    expect(
      sdkCheckStealthAddress({
        userStealthAddress: announcement.stealthAddress,
        ephemeralPublicKey: announcement.ephemeralPublicKey,
        viewingPrivateKey: keys.viewingPrivateKey,
        spendingPublicKey: keys.spendingPublicKey,
        viewTag: announcement.viewTag,
        schemeId: VALID_SCHEME_ID.SCHEME_ID_1,
      }),
    ).toBe(true);
  });

  it('we recognise announcements the SDK generates', () => {
    const keys = generateStealthKeys();
    const theirs = sdkGenerateStealthAddress({
      stealthMetaAddressURI: keys.stealthMetaAddress,
      schemeId: VALID_SCHEME_ID.SCHEME_ID_1,
    });
    expect(
      checkStealthAddress({
        stealthAddress: theirs.stealthAddress,
        ephemeralPublicKey: theirs.ephemeralPublicKey as Hex,
        viewTag: theirs.viewTag as Hex,
        viewingPrivateKey: keys.viewingPrivateKey,
        spendingPublicKey: keys.spendingPublicKey,
      }),
    ).toBe(true);
  });

  it('stealth private key recovery matches the SDK', () => {
    const keys = generateStealthKeys();
    const announcement = generateStealthAddress(keys.stealthMetaAddress);
    const ours = computeStealthPrivateKey({
      spendingPrivateKey: keys.spendingPrivateKey,
      viewingPrivateKey: keys.viewingPrivateKey,
      ephemeralPublicKey: announcement.ephemeralPublicKey,
    });
    const theirs = sdkComputeStealthKey({
      schemeId: VALID_SCHEME_ID.SCHEME_ID_1,
      spendingPrivateKey: keys.spendingPrivateKey,
      viewingPrivateKey: keys.viewingPrivateKey,
      ephemeralPublicKey: announcement.ephemeralPublicKey,
    });
    expect(ours.toLowerCase()).toBe(theirs.toLowerCase());
  });
});

/**
 * Frozen known-answer vector so interop holds even if the SDK is ever removed.
 * Generated from fixed private keys 0x...02 / 0x...03 / eph 0x...04 and
 * cross-verified against the SDK by the tests above on first run.
 */
describe('known-answer vector', () => {
  const FIXED_META =
    'st:eth:0x02c6047f9441ed7d6d3045406e95c07cd85c778e4b8cef3ca7abac09b95c709ee502f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';
  const FIXED_EPH =
    '0x0000000000000000000000000000000000000000000000000000000000000004' as Hex;

  it('fixed keys produce the expected stable derivation (frozen vector)', () => {
    const result = generateStealthAddress(FIXED_META, { ephemeralPrivateKey: FIXED_EPH });
    // NOTE: the SDK requires the ephemeral key as bytes; passing a hex string
    // silently yields a different (wrong) derivation. See sdk-input-quirk test.
    const sdk = sdkGenerateStealthAddress({
      stealthMetaAddressURI: FIXED_META,
      schemeId: VALID_SCHEME_ID.SCHEME_ID_1,
      ephemeralPrivateKey: hexToBytes(FIXED_EPH),
    });
    expect(result.stealthAddress.toLowerCase()).toBe(sdk.stealthAddress.toLowerCase());
    // Frozen values: keep interop guarantees even if the SDK is ever removed.
    expect(result.stealthAddress.toLowerCase()).toBe(
      '0x387bf2cf77227941fff3aabdcce9e02edeef0a38',
    );
    expect(result.ephemeralPublicKey).toBe(
      '0x02e493dbf1c10d80f3581e4904930b1404cc6c13900ee0758474fa94abe8c4cd13',
    );
  });
});

describe('interop negative: a flipped view tag from an SDK announcement is rejected', () => {
  it('does not recognise an SDK announcement whose view tag was altered', () => {
    const keys = generateStealthKeys();
    const theirs = sdkGenerateStealthAddress({
      stealthMetaAddressURI: keys.stealthMetaAddress,
      schemeId: VALID_SCHEME_ID.SCHEME_ID_1,
    });
    const flipped = `0x${((parseInt(theirs.viewTag.slice(2), 16) + 1) % 256).toString(16).padStart(2, '0')}` as Hex;
    expect(
      checkStealthAddress({
        stealthAddress: theirs.stealthAddress,
        ephemeralPublicKey: theirs.ephemeralPublicKey as Hex,
        viewTag: flipped,
        viewingPrivateKey: keys.viewingPrivateKey,
        spendingPublicKey: keys.spendingPublicKey,
      }),
    ).toBe(false);
  });
});

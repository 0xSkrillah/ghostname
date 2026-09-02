/**
 * ERC-5564 scheme-1 stealth meta-address encoding/parsing.
 *
 * Format (EIP-5564 + ENS stealth-resolution RFC):
 *   st:eth:0x<spendingPubKey (33B compressed)><viewingPubKey (33B compressed)>
 *
 * The ENS text record key for scheme 1 is `stealth-meta-address[1]` and the
 * value is the meta-address string stored verbatim.
 */
import { secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes, isHex, type Hex } from 'viem';

export const STEALTH_META_ADDRESS_PREFIX = 'st:eth:';
export const SCHEME_ID = 1n;
export const ENS_STEALTH_RECORD_KEY = 'stealth-meta-address[1]';

const COMPRESSED_KEY_BYTES = 33;

export interface ParsedStealthMetaAddress {
  /** Compressed secp256k1 spending public key (33 bytes). */
  spendingPublicKey: Uint8Array;
  /** Compressed secp256k1 viewing public key (33 bytes). */
  viewingPublicKey: Uint8Array;
}

export class InvalidStealthMetaAddressError extends Error {
  constructor(message: string) {
    super(`Invalid stealth meta-address: ${message}`);
    this.name = 'InvalidStealthMetaAddressError';
  }
}

function assertCompressedPublicKey(key: Uint8Array, label: string): void {
  if (key.length !== COMPRESSED_KEY_BYTES) {
    throw new InvalidStealthMetaAddressError(
      `${label} must be ${COMPRESSED_KEY_BYTES} bytes, got ${key.length}`,
    );
  }
  if (key[0] !== 0x02 && key[0] !== 0x03) {
    throw new InvalidStealthMetaAddressError(
      `${label} must start with 0x02 or 0x03 (compressed SEC1), got 0x${key[0]!.toString(16).padStart(2, '0')}`,
    );
  }
  try {
    // Throws if the encoded point is not on the curve.
    secp256k1.ProjectivePoint.fromHex(key);
  } catch {
    throw new InvalidStealthMetaAddressError(`${label} is not a valid secp256k1 point`);
  }
}

/**
 * Parse and validate a scheme-1 stealth meta-address.
 *
 * Accepts the canonical `st:eth:0x...` string or a bare `0x...` hex string.
 * Accepts the 66-byte (distinct spending + viewing keys) form, and the
 * 33-byte form where a single key serves both roles (permitted by EIP-5564).
 */
export function parseStealthMetaAddress(value: string): ParsedStealthMetaAddress {
  const trimmed = value.trim();
  let hexPart = trimmed;
  if (trimmed.toLowerCase().startsWith(STEALTH_META_ADDRESS_PREFIX)) {
    hexPart = trimmed.slice(STEALTH_META_ADDRESS_PREFIX.length);
  } else if (trimmed.toLowerCase().startsWith('st:')) {
    throw new InvalidStealthMetaAddressError(
      `unsupported chain prefix (expected "${STEALTH_META_ADDRESS_PREFIX}")`,
    );
  }
  if (!isHex(hexPart, { strict: true })) {
    throw new InvalidStealthMetaAddressError('expected 0x-prefixed hex public keys');
  }
  if ((hexPart.length - 2) % 2 !== 0) {
    // hexToBytes would silently left-pad an odd nibble count; a shifted or
    // truncated record must never parse as a destination.
    throw new InvalidStealthMetaAddressError('odd number of hex digits');
  }
  const bytes = hexToBytes(hexPart as Hex);
  if (bytes.length === COMPRESSED_KEY_BYTES) {
    assertCompressedPublicKey(bytes, 'public key');
    return { spendingPublicKey: bytes, viewingPublicKey: bytes };
  }
  if (bytes.length === COMPRESSED_KEY_BYTES * 2) {
    const spendingPublicKey = bytes.slice(0, COMPRESSED_KEY_BYTES);
    const viewingPublicKey = bytes.slice(COMPRESSED_KEY_BYTES);
    assertCompressedPublicKey(spendingPublicKey, 'spending public key');
    assertCompressedPublicKey(viewingPublicKey, 'viewing public key');
    return { spendingPublicKey, viewingPublicKey };
  }
  throw new InvalidStealthMetaAddressError(
    `expected ${COMPRESSED_KEY_BYTES} or ${COMPRESSED_KEY_BYTES * 2} bytes of key material, got ${bytes.length}`,
  );
}

/** Encode compressed spending + viewing public keys as `st:eth:0x...`. */
export function encodeStealthMetaAddress(
  spendingPublicKey: Uint8Array,
  viewingPublicKey: Uint8Array,
): string {
  assertCompressedPublicKey(spendingPublicKey, 'spending public key');
  assertCompressedPublicKey(viewingPublicKey, 'viewing public key');
  const joined = new Uint8Array(COMPRESSED_KEY_BYTES * 2);
  joined.set(spendingPublicKey, 0);
  joined.set(viewingPublicKey, COMPRESSED_KEY_BYTES);
  return `${STEALTH_META_ADDRESS_PREFIX}${bytesToHex(joined)}`;
}

/** True if the value parses as a valid scheme-1 stealth meta-address. */
export function isValidStealthMetaAddress(value: string): boolean {
  try {
    parseStealthMetaAddress(value);
    return true;
  } catch {
    return false;
  }
}

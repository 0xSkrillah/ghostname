/**
 * Strict parsing of a GhostName identity backup (the JSON produced by
 * "Download backup"). Imported JSON is untrusted input:
 *
 *  - every field is validated by shape (0x-prefixed 32-byte hex) and by range
 *    (a valid secp256k1 scalar);
 *  - the public keys and the meta-address are RE-DERIVED from the private keys,
 *    never trusted. A backup whose declared meta-address does not match its
 *    private keys is rejected, because publishing it would route future
 *    payments to addresses the importer cannot spend from;
 *  - the returned object is rebuilt from validated fields only, so unknown
 *    keys (including "__proto__") never reach storage or state.
 */
import { secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes, isHex, type Hex } from 'viem';
import { encodeStealthMetaAddress, parseStealthMetaAddress } from './metaAddress.ts';
import type { StealthKeys } from './stealth.ts';

export class InvalidIdentityBackupError extends Error {
  constructor(message: string) {
    super(`Invalid identity backup: ${message}`);
    this.name = 'InvalidIdentityBackupError';
  }
}

const CURVE_ORDER = secp256k1.CURVE.n;

function privateKeyField(value: unknown, label: string): Hex {
  if (typeof value !== 'string') {
    throw new InvalidIdentityBackupError(`${label} is missing`);
  }
  const trimmed = value.trim();
  if (!isHex(trimmed, { strict: true }) || trimmed.length !== 66) {
    throw new InvalidIdentityBackupError(`${label} must be a 0x-prefixed 32-byte hex string`);
  }
  const scalar = BigInt(trimmed);
  if (scalar === 0n || scalar >= CURVE_ORDER) {
    throw new InvalidIdentityBackupError(`${label} is not a valid secp256k1 scalar`);
  }
  return trimmed.toLowerCase() as Hex;
}

function optionalHexField(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new InvalidIdentityBackupError(`${label} must be a string when present`);
  }
  return value.trim().toLowerCase();
}

/**
 * Parse a backup from JSON text or an already-parsed value. Throws
 * InvalidIdentityBackupError with a user-safe message (never echoing key
 * material) on any problem.
 */
export function parseIdentityBackup(input: unknown): StealthKeys {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      throw new InvalidIdentityBackupError('not valid JSON');
    }
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new InvalidIdentityBackupError('expected a JSON object');
  }
  const obj = raw as Record<string, unknown>;

  const spendingPrivateKey = privateKeyField(obj['spendingPrivateKey'], 'spendingPrivateKey');
  const viewingPrivateKey = privateKeyField(obj['viewingPrivateKey'], 'viewingPrivateKey');
  if (spendingPrivateKey === viewingPrivateKey) {
    throw new InvalidIdentityBackupError(
      'spending and viewing keys are identical; GhostName requires separate keys',
    );
  }

  const spendingPublicBytes = secp256k1.getPublicKey(hexToBytes(spendingPrivateKey), true);
  const viewingPublicBytes = secp256k1.getPublicKey(hexToBytes(viewingPrivateKey), true);
  const spendingPublicKey = bytesToHex(spendingPublicBytes);
  const viewingPublicKey = bytesToHex(viewingPublicBytes);
  const stealthMetaAddress = encodeStealthMetaAddress(spendingPublicBytes, viewingPublicBytes);

  // Declared public material, when present, must agree with the private keys.
  const declaredSpendingPub = optionalHexField(obj['spendingPublicKey'], 'spendingPublicKey');
  if (declaredSpendingPub !== undefined && declaredSpendingPub !== spendingPublicKey) {
    throw new InvalidIdentityBackupError('spendingPublicKey does not match spendingPrivateKey');
  }
  const declaredViewingPub = optionalHexField(obj['viewingPublicKey'], 'viewingPublicKey');
  if (declaredViewingPub !== undefined && declaredViewingPub !== viewingPublicKey) {
    throw new InvalidIdentityBackupError('viewingPublicKey does not match viewingPrivateKey');
  }
  const declaredMeta = optionalHexField(obj['stealthMetaAddress'], 'stealthMetaAddress');
  if (declaredMeta !== undefined) {
    let parsed;
    try {
      parsed = parseStealthMetaAddress(declaredMeta);
    } catch {
      throw new InvalidIdentityBackupError('stealthMetaAddress is malformed');
    }
    if (
      bytesToHex(parsed.spendingPublicKey) !== spendingPublicKey ||
      bytesToHex(parsed.viewingPublicKey) !== viewingPublicKey
    ) {
      throw new InvalidIdentityBackupError(
        'stealthMetaAddress does not match the private keys; publishing it would send payments to addresses you cannot spend from',
      );
    }
  }

  return { spendingPrivateKey, viewingPrivateKey, spendingPublicKey, viewingPublicKey, stealthMetaAddress };
}

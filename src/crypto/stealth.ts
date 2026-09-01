/**
 * ERC-5564 scheme 1 (secp256k1 with view tags) — client-side core.
 *
 * Every operation here is pure and local. No network access, no storage.
 * Elliptic-curve arithmetic comes from the audited @noble/curves package;
 * this module only composes it per EIP-5564:
 *
 *   sender:    s_h = keccak256(compress(p_eph · P_view))
 *              viewTag = s_h[0]
 *              P_stealth = P_spend + s_h·G
 *   recipient: s_h = keccak256(compress(p_view · P_eph))
 *              p_stealth = (p_spend + s_h) mod n
 *
 * The hashed shared secret is keccak256 over the 33-byte COMPRESSED shared
 * secret point — this matches the ERC-5564 reference implementations
 * (ScopeLift stealth-address-sdk / Umbra), verified by tests/interop.test.ts.
 */
import { secp256k1 } from '@noble/curves/secp256k1';
import {
  bytesToHex,
  getAddress,
  hexToBytes,
  keccak256,
  type Address,
  type Hex,
} from 'viem';
import { parseStealthMetaAddress } from './metaAddress';

const Point = secp256k1.ProjectivePoint;
const CURVE_ORDER = secp256k1.CURVE.n;

export interface StealthKeys {
  /** 32-byte spending private key. Controls funds. Never leaves the client. */
  spendingPrivateKey: Hex;
  /** 32-byte viewing private key. Detects incoming payments. Never leaves the client. */
  viewingPrivateKey: Hex;
  /** Compressed spending public key (33 bytes). Public. */
  spendingPublicKey: Hex;
  /** Compressed viewing public key (33 bytes). Public. */
  viewingPublicKey: Hex;
  /** `st:eth:0x...` — the value to publish under `stealth-meta-address[1]`. */
  stealthMetaAddress: string;
}

export interface StealthAddressResult {
  /** One-time destination address. */
  stealthAddress: Address;
  /** Compressed ephemeral public key (33 bytes) to publish in the announcement. */
  ephemeralPublicKey: Hex;
  /** 1-byte view tag (first byte of the hashed shared secret). */
  viewTag: Hex;
}

export interface CheckStealthAddressArgs {
  stealthAddress: Address;
  ephemeralPublicKey: Hex;
  viewingPrivateKey: Hex;
  spendingPublicKey: Hex;
  /** Optional 1-byte view tag from the announcement; enables the fast reject path. */
  viewTag?: Hex;
}

export interface ComputeStealthPrivateKeyArgs {
  spendingPrivateKey: Hex;
  viewingPrivateKey: Hex;
  ephemeralPublicKey: Hex;
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let out = 0n;
  for (const byte of bytes) out = (out << 8n) | BigInt(byte);
  return out;
}

function bigIntToPrivateKeyHex(value: bigint): Hex {
  return `0x${value.toString(16).padStart(64, '0')}` as Hex;
}

function privateKeyScalar(key: Hex | Uint8Array, label: string): bigint {
  const bytes = typeof key === 'string' ? hexToBytes(key) : key;
  if (bytes.length !== 32) {
    throw new Error(`${label} must be 32 bytes`);
  }
  const scalar = bytesToBigInt(bytes);
  if (scalar === 0n || scalar >= CURVE_ORDER) {
    throw new Error(`${label} is not a valid secp256k1 scalar`);
  }
  return scalar;
}

/** keccak256 of an Ethereum public-key point, per Ethereum address rules. */
export function publicKeyToAddress(publicKey: Uint8Array | Hex): Address {
  const bytes = typeof publicKey === 'string' ? hexToBytes(publicKey) : publicKey;
  const uncompressed = Point.fromHex(bytes).toRawBytes(false); // 65 bytes, 0x04-prefixed
  const hash = keccak256(uncompressed.slice(1));
  return getAddress(`0x${hash.slice(-40)}`);
}

/** Fresh CSPRNG private key (crypto.getRandomValues via @noble/curves). */
export function generateRandomPrivateKey(): Uint8Array {
  return secp256k1.utils.randomPrivateKey();
}

/**
 * Generate a complete scheme-1 receive identity: independent spending and
 * viewing keypairs plus the `st:eth:0x...` meta-address to publish on ENS.
 */
export function generateStealthKeys(): StealthKeys {
  const spendingPrivateKey = generateRandomPrivateKey();
  const viewingPrivateKey = generateRandomPrivateKey();
  const spendingPublicKey = secp256k1.getPublicKey(spendingPrivateKey, true);
  const viewingPublicKey = secp256k1.getPublicKey(viewingPrivateKey, true);
  const joined = new Uint8Array(66);
  joined.set(spendingPublicKey, 0);
  joined.set(viewingPublicKey, 33);
  return {
    spendingPrivateKey: bytesToHex(spendingPrivateKey),
    viewingPrivateKey: bytesToHex(viewingPrivateKey),
    spendingPublicKey: bytesToHex(spendingPublicKey),
    viewingPublicKey: bytesToHex(viewingPublicKey),
    stealthMetaAddress: `st:eth:${bytesToHex(joined)}`,
  };
}

/**
 * Hashed shared secret: keccak256 over the compressed shared-secret point.
 * `scalar` is one side's private key, `point` the other side's public key.
 */
function hashedSharedSecret(scalar: bigint, point: InstanceType<typeof Point>): Hex {
  const sharedPoint = point.multiply(scalar);
  return keccak256(sharedPoint.toRawBytes(true));
}

function hashedSecretScalar(hash: Hex): bigint {
  const scalar = bytesToBigInt(hexToBytes(hash));
  if (scalar === 0n || scalar >= CURVE_ORDER) {
    // Probability ~2^-128. Reference implementations throw here too; the
    // caller should retry with a fresh ephemeral key.
    throw new Error('Hashed shared secret is not a valid scalar; retry with a new ephemeral key');
  }
  return scalar;
}

/**
 * SENDER: derive a fresh one-time stealth address from a meta-address.
 *
 * A new cryptographically secure ephemeral key is generated on EVERY call
 * unless an explicit key is supplied (tests only). Never reuse ephemeral keys.
 */
export function generateStealthAddress(
  stealthMetaAddress: string,
  opts: { ephemeralPrivateKey?: Uint8Array | Hex } = {},
): StealthAddressResult {
  const { spendingPublicKey, viewingPublicKey } = parseStealthMetaAddress(stealthMetaAddress);
  const ephemeralPrivateKey =
    opts.ephemeralPrivateKey === undefined
      ? generateRandomPrivateKey()
      : typeof opts.ephemeralPrivateKey === 'string'
        ? hexToBytes(opts.ephemeralPrivateKey)
        : opts.ephemeralPrivateKey;
  const ephemeralScalar = privateKeyScalar(ephemeralPrivateKey, 'ephemeral private key');
  const ephemeralPublicKey = secp256k1.getPublicKey(ephemeralPrivateKey, true);

  const viewingPoint = Point.fromHex(viewingPublicKey);
  const sharedSecretHash = hashedSharedSecret(ephemeralScalar, viewingPoint);
  const secretScalar = hashedSecretScalar(sharedSecretHash);

  const stealthPublicKey = Point.fromHex(spendingPublicKey).add(Point.BASE.multiply(secretScalar));
  return {
    stealthAddress: publicKeyToAddress(stealthPublicKey.toRawBytes(false)),
    ephemeralPublicKey: bytesToHex(ephemeralPublicKey),
    viewTag: `0x${sharedSecretHash.slice(2, 4)}` as Hex,
  };
}

/**
 * RECIPIENT: check whether an announcement belongs to the holder of
 * `viewingPrivateKey` (for the identity with `spendingPublicKey`).
 * Returns false — never throws — for announcements that are not ours.
 */
export function checkStealthAddress(args: CheckStealthAddressArgs): boolean {
  try {
    const viewingScalar = privateKeyScalar(args.viewingPrivateKey, 'viewing private key');
    const ephemeralPoint = Point.fromHex(hexToBytes(args.ephemeralPublicKey));
    const sharedSecretHash = hashedSharedSecret(viewingScalar, ephemeralPoint);

    if (args.viewTag !== undefined) {
      const expectedTag = `0x${sharedSecretHash.slice(2, 4)}`.toLowerCase();
      if (args.viewTag.toLowerCase() !== expectedTag) return false;
    }

    const secretScalar = hashedSecretScalar(sharedSecretHash);
    const stealthPublicKey = Point.fromHex(hexToBytes(args.spendingPublicKey)).add(
      Point.BASE.multiply(secretScalar),
    );
    const derived = publicKeyToAddress(stealthPublicKey.toRawBytes(false));
    return derived.toLowerCase() === args.stealthAddress.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * RECIPIENT: compute the private key controlling a recognised stealth address:
 * p_stealth = (p_spend + s_h) mod n.
 */
export function computeStealthPrivateKey(args: ComputeStealthPrivateKeyArgs): Hex {
  const spendingScalar = privateKeyScalar(args.spendingPrivateKey, 'spending private key');
  const viewingScalar = privateKeyScalar(args.viewingPrivateKey, 'viewing private key');
  const ephemeralPoint = Point.fromHex(hexToBytes(args.ephemeralPublicKey));
  const sharedSecretHash = hashedSharedSecret(viewingScalar, ephemeralPoint);
  const secretScalar = hashedSecretScalar(sharedSecretHash);
  const stealthPrivateKey = (spendingScalar + secretScalar) % CURVE_ORDER;
  if (stealthPrivateKey === 0n) {
    throw new Error('Derived stealth private key is zero; this announcement is unusable');
  }
  return bigIntToPrivateKeyHex(stealthPrivateKey);
}

/** Address controlled by a private key (for verifying recovered stealth keys). */
export function privateKeyToAddress(privateKey: Hex): Address {
  const scalar = privateKeyScalar(privateKey, 'private key');
  return publicKeyToAddress(Point.BASE.multiply(scalar).toRawBytes(false));
}

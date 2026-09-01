/**
 * P3 — client-side encrypted recovery capsule.
 *
 * TESTNET ONLY. Encrypts a GhostName receive identity (viewing/spending keys)
 * locally with Web Crypto BEFORE it could ever be uploaded to Swarm, so no
 * plaintext key material leaves the device. Uses AES-256-GCM with a key
 * derived from a passphrase via PBKDF2-SHA256.
 *
 * Production/mainnet private-key backups are explicitly OUT OF SCOPE.
 */

const PBKDF2_ITERATIONS = 210_000; // OWASP 2023 guidance for PBKDF2-SHA256
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedCapsule {
  /** Format/version marker so future readers can migrate. */
  format: 'ghostname-capsule';
  version: 1;
  /** TESTNET-only marker; refuses to be treated as a mainnet backup. */
  network: 'testnet';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  cipher: 'AES-256-GCM';
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
  createdAt: string; // ISO
}

/** Copy into a guaranteed ArrayBuffer-backed view (satisfies BufferSource). */
function buf(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    buf(new TextEncoder().encode(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: buf(salt), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypt an arbitrary JSON-serializable testnet payload into a capsule.
 * The passphrase never leaves this function; only the derived ciphertext is
 * returned. Throws on an empty passphrase.
 */
export async function encryptCapsule(
  payload: unknown,
  passphrase: string,
): Promise<EncryptedCapsule> {
  if (!passphrase || passphrase.length < 8) {
    throw new Error('Passphrase must be at least 8 characters.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv) }, key, buf(plaintext)),
  );
  return {
    format: 'ghostname-capsule',
    version: 1,
    network: 'testnet',
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    cipher: 'AES-256-GCM',
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Decrypt a capsule with the passphrase. Throws (GCM auth failure) on a wrong
 * passphrase or any tampering — never returns partial/garbage plaintext.
 */
export async function decryptCapsule<T = unknown>(
  capsule: EncryptedCapsule,
  passphrase: string,
): Promise<T> {
  if (capsule.format !== 'ghostname-capsule') {
    throw new Error('Not a GhostName capsule.');
  }
  const key = await deriveKey(
    passphrase,
    fromBase64(capsule.salt),
    capsule.iterations,
  );
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: buf(fromBase64(capsule.iv)) },
      key,
      buf(fromBase64(capsule.ciphertext)),
    );
  } catch {
    throw new Error('Decryption failed — wrong passphrase or corrupted capsule.');
  }
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

/**
 * Guard: only permit encrypting identities flagged testnet. This keeps the
 * feature within the spec's TESTNET-ONLY boundary and prevents accidental
 * mainnet key backup.
 */
export function assertTestnetOnly(meta: { network?: string }): void {
  if (meta.network && meta.network !== 'testnet' && meta.network !== 'sepolia') {
    throw new Error(
      'Recovery capsules are testnet-only. Mainnet key backup is out of scope.',
    );
  }
}

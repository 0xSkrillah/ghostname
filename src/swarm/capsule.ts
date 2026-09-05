/**
 * Client-side encrypted recovery capsule.
 *
 * TESTNET ONLY. Encrypts a GhostName receive identity (viewing/spending keys)
 * locally with Web Crypto BEFORE it could ever be uploaded to Swarm, so no
 * plaintext key material leaves the device. AES-256-GCM with a key derived
 * from a passphrase via PBKDF2-SHA256.
 *
 * KDF strength: 600,000 iterations, the OWASP Password Storage Cheat Sheet
 * figure for PBKDF2-HMAC-SHA256 (the 210,000 figure applies to SHA-512).
 * The passphrase is NFC-normalised and must be at least 12 characters; that
 * is a floor, not a strength estimate, and the UI says so.
 *
 * Format version 2 binds the header (format, version, network, kdf,
 * iterations, cipher) into the GCM authentication tag as additional data, so
 * a relabelled or downgraded header fails authentication. Version 1 capsules
 * (no header binding) are still readable.
 *
 * Production/mainnet private-key backups are explicitly OUT OF SCOPE.
 */

export const PBKDF2_ITERATIONS = 600_000;
export const MIN_PASSPHRASE_LENGTH = 12;
const SALT_BYTES = 16;
const IV_BYTES = 12;
/** Accept older capsules down to this count; refuse anything weaker or absurd. */
const MIN_ACCEPTED_ITERATIONS = 100_000;
const MAX_ACCEPTED_ITERATIONS = 5_000_000;

export interface EncryptedCapsule {
  /** Format/version marker so future readers can migrate. */
  format: 'ghostname-capsule';
  version: 1 | 2;
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
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 !== 0) {
    throw new Error('invalid base64');
  }
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Canonical header bytes bound into the GCM tag for version 2 capsules. */
function headerAad(capsule: Pick<EncryptedCapsule, 'format' | 'version' | 'network' | 'kdf' | 'iterations' | 'cipher'>): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify([
      capsule.format,
      capsule.version,
      capsule.network,
      capsule.kdf,
      capsule.iterations,
      capsule.cipher,
    ]),
  );
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    buf(new TextEncoder().encode(passphrase.normalize('NFC'))),
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
 * returned. Throws on a passphrase shorter than MIN_PASSPHRASE_LENGTH.
 */
export async function encryptCapsule(
  payload: unknown,
  passphrase: string,
): Promise<EncryptedCapsule> {
  if (!passphrase || passphrase.normalize('NFC').length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const header = {
    format: 'ghostname-capsule' as const,
    version: 2 as const,
    network: 'testnet' as const,
    kdf: 'PBKDF2-SHA256' as const,
    iterations: PBKDF2_ITERATIONS,
    cipher: 'AES-256-GCM' as const,
  };
  const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: buf(iv), additionalData: buf(headerAad(header)) },
      key,
      buf(plaintext),
    ),
  );
  return {
    ...header,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Validate an untrusted capsule header (pasted or downloaded JSON) before any
 * key derivation: version, cipher/KDF identifiers, an iteration count inside a
 * sane band (so a hostile file cannot pin the CPU or downgrade the KDF), and
 * correctly sized salt and IV.
 */
export function parseCapsule(input: unknown): EncryptedCapsule {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      throw new Error('Not a GhostName capsule: invalid JSON.');
    }
  }
  if (raw === null || typeof raw !== 'object') throw new Error('Not a GhostName capsule.');
  const c = raw as Record<string, unknown>;
  if (c['format'] !== 'ghostname-capsule') throw new Error('Not a GhostName capsule.');
  if (c['version'] !== 1 && c['version'] !== 2) throw new Error('Unsupported capsule version.');
  if (c['kdf'] !== 'PBKDF2-SHA256' || c['cipher'] !== 'AES-256-GCM') {
    throw new Error('Unsupported capsule KDF or cipher.');
  }
  if (c['network'] !== 'testnet') throw new Error('Recovery capsules are testnet-only.');
  const iterations = c['iterations'];
  if (
    typeof iterations !== 'number' ||
    !Number.isInteger(iterations) ||
    iterations < MIN_ACCEPTED_ITERATIONS ||
    iterations > MAX_ACCEPTED_ITERATIONS
  ) {
    throw new Error('Capsule iteration count is out of the accepted range.');
  }
  let salt: Uint8Array;
  let iv: Uint8Array;
  let ciphertext: Uint8Array;
  try {
    salt = fromBase64(String(c['salt'] ?? ''));
    iv = fromBase64(String(c['iv'] ?? ''));
    ciphertext = fromBase64(String(c['ciphertext'] ?? ''));
  } catch {
    throw new Error('Capsule fields are not valid base64.');
  }
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || ciphertext.length < 16) {
    throw new Error('Capsule salt, IV or ciphertext has the wrong length.');
  }
  return {
    format: 'ghostname-capsule',
    version: c['version'],
    network: 'testnet',
    kdf: 'PBKDF2-SHA256',
    iterations,
    cipher: 'AES-256-GCM',
    salt: String(c['salt']),
    iv: String(c['iv']),
    ciphertext: String(c['ciphertext']),
    createdAt: typeof c['createdAt'] === 'string' ? c['createdAt'] : '',
  };
}

/**
 * Decrypt a capsule with the passphrase. Throws (GCM auth failure) on a wrong
 * passphrase, any ciphertext tampering, or (version 2) any header tampering;
 * never returns partial/garbage plaintext.
 */
export async function decryptCapsule<T = unknown>(
  capsule: EncryptedCapsule | string,
  passphrase: string,
): Promise<T> {
  const parsed = parseCapsule(capsule);
  const key = await deriveKey(passphrase, fromBase64(parsed.salt), parsed.iterations);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: buf(fromBase64(parsed.iv)),
        ...(parsed.version === 2 ? { additionalData: buf(headerAad(parsed)) } : {}),
      },
      key,
      buf(fromBase64(parsed.ciphertext)),
    );
  } catch {
    throw new Error('Decryption failed: wrong passphrase or corrupted capsule.');
  }
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

/**
 * Guard: only permit identities flagged testnet. This keeps the feature within
 * the TESTNET-ONLY boundary and prevents accidental mainnet key backup.
 * Applied on capsule export and on capsule import.
 */
export function assertTestnetOnly(meta: { network?: string }): void {
  if (meta.network && meta.network !== 'testnet' && meta.network !== 'sepolia') {
    throw new Error(
      'Recovery capsules are testnet-only. Mainnet key backup is out of scope.',
    );
  }
}

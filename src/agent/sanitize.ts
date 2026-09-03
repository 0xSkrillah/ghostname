/**
 * Sanitisation for anything that leaves the agent layer.
 *
 * Rules:
 *  - ENS record values and RPC strings are untrusted data. They may contain
 *    prompt-injection text. They are never interpolated into natural-language
 *    fields; when explicitly requested they are returned escaped, length
 *    capped and labelled inside the technical-evidence block only.
 *  - Addresses and hashes are accepted only when they parse as such.
 *  - Secret material is never present in the input types this layer consumes,
 *    and the tests assert it never appears in the output.
 */
import { getAddress, isAddress } from 'viem';

export const MAX_UNTRUSTED_LENGTH = 512;

/**
 * Code-point ranges stripped from untrusted text: C0 and C1 controls, zero
 * width and bidirectional controls, line and paragraph separators, the BOM.
 * These are the characters most often used to hide text from a reader.
 * Built from code points rather than escape sequences so the source stays
 * free of literal control characters.
 */
const HIDDEN_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x0000, 0x0008],
  [0x000b, 0x000c],
  [0x000e, 0x001f],
  [0x007f, 0x009f],
  [0x200b, 0x200f],
  [0x2028, 0x202e],
  [0x2060, 0x2064],
  [0xfeff, 0xfeff],
];

function classOf(ranges: ReadonlyArray<readonly [number, number]>): string {
  return (
    '[' +
    ranges.map(([a, b]) => String.fromCodePoint(a) + '-' + String.fromCodePoint(b)).join('') +
    ']'
  );
}

const HIDDEN_OR_CONTROL = new RegExp(classOf(HIDDEN_RANGES), 'gu');
/** Tab, line feed, vertical tab, form feed, carriage return. */
const LINE_WHITESPACE = new RegExp(classOf([[0x0009, 0x000d]]) + '+', 'g');

export interface SanitizedString {
  value: string;
  truncated: boolean;
}

/** Collapse whitespace, strip hidden characters, cap the length. */
export function sanitizeUntrusted(
  input: unknown,
  max: number = MAX_UNTRUSTED_LENGTH,
): SanitizedString {
  const text = typeof input === 'string' ? input : input == null ? '' : String(input);
  let cleaned = text.replace(LINE_WHITESPACE, ' ').replace(HIDDEN_OR_CONTROL, '');
  cleaned = cleaned.replace(/ {2,}/g, ' ').trim();
  let truncated = false;
  if (cleaned.length > max) {
    cleaned = cleaned.slice(0, max);
    truncated = true;
  }
  return { value: cleaned, truncated };
}

/** Sanitised string only, for template-adjacent fields such as warnings. */
export function sanitizeText(input: unknown, max = 1024): string {
  return sanitizeUntrusted(input, max).value;
}

/** Checksummed address, or null for anything that is not an address. */
export function safeAddress(input: unknown): string | null {
  return typeof input === 'string' && isAddress(input, { strict: false })
    ? getAddress(input)
    : null;
}

/** Lower-case 32-byte hex hash, or null. */
export function safeHash(input: unknown): `0x${string}` | null {
  return typeof input === 'string' && /^0x[0-9a-fA-F]{64}$/.test(input)
    ? (input.toLowerCase() as `0x${string}`)
    : null;
}

/** Compressed SEC1 public key (33 bytes hex), or null. */
export function safeCompressedPublicKey(input: unknown): string | null {
  return typeof input === 'string' && /^0x0[23][0-9a-fA-F]{64}$/.test(input)
    ? input.toLowerCase()
    : null;
}

/** Categories of material that must never appear in agent output. */
export const NEVER_IN_AGENT_OUTPUT = [
  'spending private keys',
  'viewing private keys',
  'ephemeral private keys',
  'seed phrases and passphrases',
  'recovery capsules and recovery material',
  'unused generated destination addresses',
  'wallet signatures',
] as const;

/**
 * Object keys that would indicate secret material leaked into an output.
 * Used by tests and by a defensive final scan before a report is returned.
 */
const SECRET_KEY_PATTERN =
  /(privatekey|private_key|privkey|secret|seed|mnemonic|passphrase|password|signature|authorization)/i;

/** True when any object key looks like it carries secret material. */
export function containsSecretLookingKey(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsSecretLookingKey);
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERN.test(key)) return true;
    if (containsSecretLookingKey(child)) return true;
  }
  return false;
}

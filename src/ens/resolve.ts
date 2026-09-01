/**
 * ENS resolution for arbitrary names: conventional ETH address (the "static
 * identity" being demonstrated) and the `stealth-meta-address[1]` text record
 * (the GhostName forward-privacy identity).
 *
 * All functions are read-only and network-agnostic: pass a mainnet client for
 * established names or a Sepolia client for the controlled test identity.
 */
import type { Address } from 'viem';
import { normalize } from 'viem/ens';
import {
  ENS_STEALTH_RECORD_KEY,
  parseStealthMetaAddress,
  type ParsedStealthMetaAddress,
} from '../crypto/metaAddress';

/** Minimal structural interface satisfied by a viem PublicClient. */
export interface EnsReader {
  getEnsAddress(args: { name: string }): Promise<Address | null>;
  getEnsText(args: { name: string; key: string }): Promise<string | null>;
}

export interface ConventionalResolution {
  /** ENSIP-15 normalized name. */
  name: string;
  /** The static ETH address the name publicly resolves to, if any. */
  address: Address | null;
}

export type StealthResolution =
  | { name: string; status: 'none'; record: null }
  | { name: string; status: 'invalid'; record: string; error: string }
  | {
      name: string;
      status: 'ok';
      record: string;
      parsed: ParsedStealthMetaAddress;
    };

/** Normalize an ENS name (throws on invalid names). */
export function normalizeEnsName(name: string): string {
  return normalize(name.trim());
}

/** Resolve the conventional (static, publicly linkable) ETH address. */
export async function resolveConventionalAddress(
  client: EnsReader,
  name: string,
): Promise<ConventionalResolution> {
  const normalized = normalizeEnsName(name);
  const address = await client.getEnsAddress({ name: normalized });
  return { name: normalized, address };
}

/** Resolve and validate the `stealth-meta-address[1]` text record. */
export async function resolveStealthMetaAddress(
  client: EnsReader,
  name: string,
): Promise<StealthResolution> {
  const normalized = normalizeEnsName(name);
  const record = await client.getEnsText({ name: normalized, key: ENS_STEALTH_RECORD_KEY });
  if (record === null || record.trim() === '') {
    return { name: normalized, status: 'none', record: null };
  }
  try {
    const parsed = parseStealthMetaAddress(record);
    return { name: normalized, status: 'ok', record, parsed };
  } catch (err) {
    return {
      name: normalized,
      status: 'invalid',
      record,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Resolve a name for private payment. Throws with a user-facing message when
 * the name has no valid stealth record — callers must not fall back silently
 * to the conventional address, as that would defeat the privacy purpose.
 */
export async function resolveForStealthPayment(
  client: EnsReader,
  name: string,
): Promise<{ name: string; record: string; parsed: ParsedStealthMetaAddress }> {
  const resolution = await resolveStealthMetaAddress(client, name);
  if (resolution.status === 'none') {
    throw new Error(
      `${resolution.name} has not published a stealth meta-address ` +
        `(no "${ENS_STEALTH_RECORD_KEY}" text record). Ask the recipient to enable GhostName.`,
    );
  }
  if (resolution.status === 'invalid') {
    throw new Error(
      `${resolution.name} has a malformed "${ENS_STEALTH_RECORD_KEY}" record: ${resolution.error}`,
    );
  }
  return { name: resolution.name, record: resolution.record, parsed: resolution.parsed };
}

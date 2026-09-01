/**
 * Publishing the `stealth-meta-address[1]` text record for a Sepolia test
 * identity. This is the ONLY ENS write in GhostName and it is hard-gated to
 * Sepolia via assertWritableNetwork — mainnet writes are impossible.
 */
import {
  namehash,
  zeroAddress,
  type Account,
  type Address,
  type Chain,
  type Hash,
} from 'viem';
import { assertWritableNetwork } from '../chain/guards';
import { ENS_STEALTH_RECORD_KEY, parseStealthMetaAddress } from '../crypto/metaAddress';
import { normalizeEnsName } from './resolve';

export const RESOLVER_SET_TEXT_ABI = [
  {
    name: 'setText',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
    ],
    outputs: [],
  },
] as const;

/** Minimal structural interfaces so tests can inject fakes. */
export interface ResolverFinder {
  /** viem PublicClient.getEnsResolver — resolves via the Universal Resolver. */
  getEnsResolver(args: { name: string }): Promise<Address>;
}

export interface TextWriter {
  getChainId(): Promise<number>;
  writeContract(args: {
    address: Address;
    abi: typeof RESOLVER_SET_TEXT_ABI;
    functionName: 'setText';
    args: readonly [`0x${string}`, string, string];
    account: Address | Account;
    chain: Chain | null | undefined;
  }): Promise<Hash>;
}

/**
 * Resolver address for a name, or null when none is configured. Uses the
 * Universal Resolver (via viem's getEnsResolver), which covers both the
 * legacy ENS registry and the ENSv2 registry tree on Sepolia.
 */
export async function getResolverAddress(
  client: ResolverFinder,
  name: string,
): Promise<Address | null> {
  try {
    const resolver = await client.getEnsResolver({ name: normalizeEnsName(name) });
    return resolver === zeroAddress ? null : resolver;
  } catch {
    return null;
  }
}

export interface PublishStealthRecordArgs {
  publicClient: ResolverFinder;
  walletClient: TextWriter;
  /** Sepolia chain object from viem (passed through to the wallet). */
  chain: Chain;
  /** Address (browser wallet) or a local viem Account (scripts/tests). */
  account: Address | Account;
  name: string;
  stealthMetaAddress: string;
}

/**
 * Publish `stealth-meta-address[1]` = the meta-address string, verbatim, on
 * the name's configured resolver. Hard-fails off-Sepolia BEFORE any wallet
 * interaction, and again against the wallet's actual reported chain.
 */
export async function publishStealthRecord(args: PublishStealthRecordArgs): Promise<Hash> {
  // Guard 1: the chain the caller intends to use.
  assertWritableNetwork(args.chain.id);
  // Guard 2: the chain the wallet is actually connected to.
  assertWritableNetwork(await args.walletClient.getChainId());

  // Validate the record before publishing anything.
  parseStealthMetaAddress(args.stealthMetaAddress);

  const normalized = normalizeEnsName(args.name);
  const resolver = await getResolverAddress(args.publicClient, normalized);
  if (resolver === null) {
    throw new Error(
      `${normalized} has no resolver configured on this network. ` +
        'Set a resolver for the name (e.g. in the ENS app) before publishing.',
    );
  }
  return args.walletClient.writeContract({
    address: resolver,
    abi: RESOLVER_SET_TEXT_ABI,
    functionName: 'setText',
    args: [namehash(normalized), ENS_STEALTH_RECORD_KEY, args.stealthMetaAddress],
    account: args.account,
    chain: args.chain,
  });
}

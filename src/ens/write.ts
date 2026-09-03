/**
 * Publishing the `stealth-meta-address[1]` text record. This is the ONLY ENS
 * write in GhostName. It passes assertWritableNetwork against both the
 * intended chain and the wallet's reported chain: Sepolia by default, mainnet
 * only in a build with VITE_ENABLE_MAINNET=true plus a typed per-action
 * confirmation. It never sets or replaces a resolver.
 */
import {
  BaseError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
  HttpRequestError,
  RawContractError,
  TimeoutError,
  namehash,
  zeroAddress,
  type Account,
  type Address,
  type Chain,
  type Hash,
} from 'viem';
import { assertWritableNetwork } from '../chain/guards';
import { describeError } from '../lib/describeError';
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

/** viem PublicClient.simulateContract, structurally, so tests can inject fakes. */
export interface TextSimulator {
  simulateContract(args: {
    address: Address;
    abi: typeof RESOLVER_SET_TEXT_ABI;
    functionName: 'setText';
    args: readonly [`0x${string}`, string, string];
    account: Address;
  }): Promise<unknown>;
}

export type ResolverLookup =
  | { status: 'ok'; address: Address }
  | { status: 'none' }
  | { status: 'failed'; error: string };

export type WritableCheck =
  | { status: 'ok' }
  | { status: 'blocked'; reason: string }
  | { status: 'unknown'; reason: string };

/**
 * Pre-sign check that `account` may write the record on `resolver`: the exact
 * setText call is simulated from that account. A revert means the resolver
 * refuses this sender, which is what "the wallet does not control the name"
 * looks like on both ENS v1 and v2 resolvers; a transport failure means
 * nothing is known and is reported as unknown, never as permission. Nothing
 * is sent.
 */
export async function checkStealthRecordWritable(args: {
  publicClient: TextSimulator;
  account: Address;
  resolver: Address;
  node: `0x${string}`;
  stealthMetaAddress: string;
}): Promise<WritableCheck> {
  try {
    await args.publicClient.simulateContract({
      address: args.resolver,
      abi: RESOLVER_SET_TEXT_ABI,
      functionName: 'setText',
      args: [args.node, ENS_STEALTH_RECORD_KEY, args.stealthMetaAddress],
      account: args.account,
    });
    return { status: 'ok' };
  } catch (err) {
    return classifyResolverError(err) === 'none'
      ? { status: 'blocked', reason: describeError(err) }
      : { status: 'unknown', reason: describeError(err) };
  }
}

/**
 * A revert from the Universal Resolver means the name has no resolver; a
 * transport, timeout or RPC failure means nothing is known. Only the first
 * may be reported as "no resolver configured".
 */
function classifyResolverError(err: unknown): 'none' | 'failed' {
  if (err instanceof BaseError) {
    const transport = err.walk(
      (e) => e instanceof HttpRequestError || e instanceof TimeoutError,
    );
    if (transport) return 'failed';
    const reverted = err.walk(
      (e) =>
        e instanceof ContractFunctionRevertedError ||
        e instanceof ContractFunctionZeroDataError ||
        e instanceof RawContractError,
    );
    if (reverted) return 'none';
  }
  return 'failed';
}

/**
 * Resolver lookup for a name through the Universal Resolver (viem's
 * getEnsResolver), which covers both the legacy ENS registry and the ENSv2
 * registry tree on Sepolia. Never collapses an RPC failure into "none".
 */
export async function lookupResolver(client: ResolverFinder, name: string): Promise<ResolverLookup> {
  try {
    const resolver = await client.getEnsResolver({ name: normalizeEnsName(name) });
    return resolver === zeroAddress ? { status: 'none' } : { status: 'ok', address: resolver };
  } catch (err) {
    return classifyResolverError(err) === 'none'
      ? { status: 'none' }
      : { status: 'failed', error: describeError(err) };
  }
}

/**
 * Resolver address for a name, or null when none is configured. Throws when
 * the lookup itself failed, so callers cannot mistake an outage for a
 * missing resolver.
 */
export async function getResolverAddress(
  client: ResolverFinder,
  name: string,
): Promise<Address | null> {
  const lookup = await lookupResolver(client, name);
  if (lookup.status === 'failed') {
    throw new Error(`Could not read the resolver for ${normalizeEnsName(name)}: ${lookup.error} Retry, or switch RPC endpoint.`);
  }
  return lookup.status === 'ok' ? lookup.address : null;
}

export interface PublishStealthRecordArgs {
  publicClient: ResolverFinder;
  walletClient: TextWriter;
  /** Target chain object from viem (Sepolia by default; mainnet only in guarded mode). */
  chain: Chain;
  /** Address (browser wallet) or a local viem Account (scripts/tests). */
  account: Address | Account;
  name: string;
  stealthMetaAddress: string;
  /** Explicit per-action confirmation, required for a mainnet write. */
  mainnetConfirmed?: boolean;
}

/**
 * Publish `stealth-meta-address[1]` = the meta-address string, verbatim, on
 * the name's configured resolver. Hard-fails on a disallowed network BEFORE
 * any wallet interaction, and again against the wallet's actual reported
 * chain. A mainnet write additionally requires `mainnetConfirmed: true`.
 */
export async function publishStealthRecord(args: PublishStealthRecordArgs): Promise<Hash> {
  const guard = { mainnetConfirmed: args.mainnetConfirmed };
  // Guard 1: the chain the caller intends to use.
  assertWritableNetwork(args.chain.id, guard);
  // Guard 2: the chain the wallet is actually connected to.
  assertWritableNetwork(await args.walletClient.getChainId(), guard);

  // Validate the record before publishing anything.
  parseStealthMetaAddress(args.stealthMetaAddress);

  const normalized = normalizeEnsName(args.name);
  const lookup = await lookupResolver(args.publicClient, normalized);
  if (lookup.status === 'failed') {
    throw new Error(
      `Could not read the resolver for ${normalized} from this network: ${lookup.error} ` +
        'Nothing was sent. Retry, or switch RPC endpoint.',
    );
  }
  if (lookup.status === 'none') {
    throw new Error(
      `${normalized} has no resolver configured on this network. ` +
        'Set a resolver for the name (e.g. in the ENS app) before publishing.',
    );
  }
  return args.walletClient.writeContract({
    address: lookup.address,
    abi: RESOLVER_SET_TEXT_ABI,
    functionName: 'setText',
    args: [namehash(normalized), ENS_STEALTH_RECORD_KEY, args.stealthMetaAddress],
    account: args.account,
    chain: args.chain,
  });
}

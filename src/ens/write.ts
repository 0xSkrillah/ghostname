/**
 * Publishing the `stealth-meta-address[1]` text record for a Sepolia test
 * identity. This is the ONLY ENS write in GhostName and it is hard-gated to
 * Sepolia via assertWritableNetwork — mainnet writes are impossible.
 */
import { namehash, zeroAddress, type Address, type Chain, type Hash } from 'viem';
import { assertWritableNetwork } from '../chain/guards';
import { ENS_STEALTH_RECORD_KEY, parseStealthMetaAddress } from '../crypto/metaAddress';
import { normalizeEnsName } from './resolve';

/** ENS registry — same deterministic address on mainnet and Sepolia. */
export const ENS_REGISTRY_ADDRESS: Address = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

export const ENS_REGISTRY_ABI = [
  {
    name: 'resolver',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

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
export interface RegistryReader {
  readContract(args: {
    address: Address;
    abi: typeof ENS_REGISTRY_ABI;
    functionName: 'resolver' | 'owner';
    args: readonly [`0x${string}`];
  }): Promise<Address>;
}

export interface TextWriter {
  getChainId(): Promise<number>;
  writeContract(args: {
    address: Address;
    abi: typeof RESOLVER_SET_TEXT_ABI;
    functionName: 'setText';
    args: readonly [`0x${string}`, string, string];
    account: Address;
    chain: Chain | null | undefined;
  }): Promise<Hash>;
}

/** Resolver address for a name, or null when none is configured. */
export async function getResolverAddress(
  client: RegistryReader,
  name: string,
): Promise<Address | null> {
  const resolver = await client.readContract({
    address: ENS_REGISTRY_ADDRESS,
    abi: ENS_REGISTRY_ABI,
    functionName: 'resolver',
    args: [namehash(normalizeEnsName(name))],
  });
  return resolver === zeroAddress ? null : resolver;
}

export interface PublishStealthRecordArgs {
  publicClient: RegistryReader;
  walletClient: TextWriter;
  /** Sepolia chain object from viem (passed through to the wallet). */
  chain: Chain;
  account: Address;
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

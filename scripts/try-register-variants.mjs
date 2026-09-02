// Try to pin down why v2-controller register() reverts: simulate the original
// (aged) commitment now with proper revert-data extraction, then commit+wait+
// simulate variants with the live v2 resolver and with the zero resolver.
import { loadTestnetKey } from './lib/testnet-key.mjs';
import { createPublicClient, createWalletClient, http, parseAbi, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { readFileSync } from 'node:fs';

const { key } = loadTestnetKey();
const account = privateKeyToAccount(key);
const transport = http('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 30_000 });
const client = createPublicClient({ chain: sepolia, transport });
const wallet = createWalletClient({ account, chain: sepolia, transport });

const CONTROLLER = '0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968';
const V2_RESOLVER = '0x5239A812ec9A62F46dbb5de8f346C8eFe7553A9f';
const STAGING_RESOLVER = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5';
const ZERO = '0x0000000000000000000000000000000000000000';

const abi = parseAbi([
  'function makeCommitment((string label, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, uint8 reverseRecord, bytes32 referrer) registration) pure returns (bytes32)',
  'function commit(bytes32 commitment)',
  'function register((string label, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, uint8 reverseRecord, bytes32 referrer) registration) payable',
  'function rentPrice(string label, uint256 duration) view returns ((uint256 base, uint256 premium))',
]);

function reg(label, resolver, secret) {
  return {
    label,
    owner: account.address,
    duration: 7776000n,
    secret,
    resolver,
    data: [],
    reverseRecord: 0,
    referrer: `0x${'00'.repeat(32)}`,
  };
}

async function simulate(registration, note) {
  const price = await client.readContract({
    address: CONTROLLER, abi, functionName: 'rentPrice',
    args: [registration.label, registration.duration],
  });
  const value = ((price.base + price.premium) * 110n) / 100n;
  try {
    await client.simulateContract({
      address: CONTROLLER, abi, functionName: 'register',
      args: [registration], value, account: account.address,
    });
    console.log(`[${note}] simulation SUCCEEDS`);
    return { ok: true, value };
  } catch (e) {
    let raw;
    let walker = e;
    while (walker) {
      if (walker.raw) raw = walker.raw;
      if (walker.data && typeof walker.data === 'string') raw = walker.data;
      walker = walker.cause;
    }
    console.log(`[${note}] reverts — raw error data: ${raw ?? 'none'} | ${e.shortMessage}`);
    return { ok: false };
  }
}

// 1. Original args (aged commitment, staging resolver).
await simulate(
  reg('ghostname-3c7714', STAGING_RESOLVER, '0x4f697d2b8ff1e55380d7b0a8f8cbf51ebb90a9f81300b18befbaa21bee9e534f'),
  'original: staging resolver',
);

// 2. Commit variants: v2 resolver and zero resolver, then wait and simulate.
const variants = [
  { label: 'ghostname-3c7714', resolver: V2_RESOLVER, secret: toHex(crypto.getRandomValues(new Uint8Array(32))), note: 'v2 resolver' },
  { label: 'ghostname-3c7714', resolver: ZERO, secret: toHex(crypto.getRandomValues(new Uint8Array(32))), note: 'zero resolver' },
];
for (const v of variants) {
  const commitment = await client.readContract({
    address: CONTROLLER, abi, functionName: 'makeCommitment', args: [reg(v.label, v.resolver, v.secret)],
  });
  const tx = await wallet.writeContract({ address: CONTROLLER, abi, functionName: 'commit', args: [commitment] });
  await client.waitForTransactionReceipt({ hash: tx });
  console.log(`[${v.note}] committed ${commitment.slice(0, 18)}…`);
}
console.log('waiting 80s commitment age…');
await new Promise((r) => setTimeout(r, 80_000));
for (const v of variants) {
  await simulate(reg(v.label, v.resolver, v.secret), v.note);
}

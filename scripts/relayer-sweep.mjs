/**
 * End-to-end SPONSORED EIP-7702 sweep on Sepolia.
 *
 *   node scripts/relayer-sweep.mjs
 *
 * 1. Deploy StealthSweepExecutor (once; cached in .demo/executor.json).
 * 2. Make a fresh stealth payment to the demo identity (a funded stealth EOA).
 * 3. Recover the stealth key locally.
 * 4. Stealth key signs: (a) an EIP-7702 authorization → executor, and
 *    (b) an EIP-712 `Sweep` authorization.
 * 5. The SPONSOR (the demo wallet) submits ONE type-4 transaction that sets the
 *    delegation and calls sweep(...); the sponsor pays gas.
 * 6. Verify the clean destination received the funds and the stealth EOA is
 *    drained — the stealth address never held gas or was funded from a wallet.
 *
 * Testnet only, throwaway key from .env. In this demo the sponsor is the same
 * demo wallet for convenience; in production the sponsor is an independent
 * relayer so the sender wallet is never linked either.
 */
import { loadDemoIdentity, loadExecutorArtifact, loadTestnetKey } from './lib/testnet-key.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  createPublicClient,
  createWalletClient,
  http,
  encodeFunctionData,
  concatHex,
  keccak256,
  formatEther,
  parseEther,
  getContractAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { generateStealthAddress, computeStealthPrivateKey } from '../src/crypto/stealth.ts';
import { randomSweepNonce, signSweepAuthorization } from '../src/relay/sweep.ts';

const { key, rpc: RPC } = loadTestnetKey();
const sponsor = privateKeyToAccount(key);
const transport = http(RPC, { timeout: 30_000 });
const publicClient = createPublicClient({ chain: sepolia, transport });
const sponsorWallet = createWalletClient({ account: sponsor, chain: sepolia, transport });

const identity = loadDemoIdentity();
const artifact = loadExecutorArtifact();
const state = existsSync('.demo/sweep-state.json')
  ? JSON.parse(readFileSync('.demo/sweep-state.json', 'utf8'))
  : {};

const bal = await publicClient.getBalance({ address: sponsor.address });
console.log(`sponsor ${sponsor.address} — ${formatEther(bal)} ETH`);
if (bal < parseEther('0.003')) throw new Error('Fund the sponsor with more Sepolia ETH.');

async function send(desc, request) {
  const hash = await sponsorWallet.sendTransaction(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`${desc} reverted: ${hash}`);
  console.log(`[ok] ${desc}: ${hash}`);
  return receipt;
}

// 1. Deploy executor (once).
if (!state.executor) {
  const nonce = await publicClient.getTransactionCount({ address: sponsor.address });
  const predicted = getContractAddress({ from: sponsor.address, nonce: BigInt(nonce) });
  await send('deploy executor', { data: artifact.bytecode, nonce });
  state.executor = predicted;
  writeFileSync('.demo/sweep-state.json', JSON.stringify(state, null, 2));
}
const EXECUTOR = state.executor;
console.log('executor:', EXECUTOR);

// 2. Fresh stealth payment to the demo identity.
const announcement = generateStealthAddress(identity.stealthMetaAddress);
const stealthAddress = announcement.stealthAddress;
const amount = parseEther('0.0006');
await send('fund stealth address', { to: stealthAddress, value: amount });
console.log('stealth address:', stealthAddress, 'funded with', formatEther(amount), 'ETH');

// 3. Recover the stealth key.
const stealthPrivateKey = computeStealthPrivateKey({
  spendingPrivateKey: identity.spendingPrivateKey,
  viewingPrivateKey: identity.viewingPrivateKey,
  ephemeralPublicKey: announcement.ephemeralPublicKey,
});
const stealthAccount = privateKeyToAccount(stealthPrivateKey);
if (stealthAccount.address.toLowerCase() !== stealthAddress.toLowerCase())
  throw new Error('recovered key mismatch');

// 4a. EIP-7702 authorization. Read the real account nonce; never assume 0.
const authorizationNonce = await publicClient.getTransactionCount({ address: stealthAddress });
const { authorization } = await signSweepAuthorization({
  stealthPrivateKey,
  chainId: sepolia.id,
  executor: EXECUTOR,
  nonce: authorizationNonce,
});

// 4b. EIP-712 Sweep authorization matching the contract.
// A clean destination that is still recoverable: derived from the sponsor key,
// so no new secret is created and the swept test ETH is not burned.
const destination = privateKeyToAccount(keccak256(concatHex([key, '0x01']))).address;
const sweepAmount = amount; // sweep everything; sponsor pays gas
const sweepNonce = randomSweepNonce(); // executor replay guard; random so retries never collide
const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
const signature = await stealthAccount.signTypedData({
  domain: {
    name: 'GhostNameSweep',
    version: '1',
    chainId: sepolia.id,
    verifyingContract: stealthAddress, // address(this) under 7702
  },
  types: {
    Sweep: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  primaryType: 'Sweep',
  message: { to: destination, amount: sweepAmount, nonce: sweepNonce, deadline },
});

const data = encodeFunctionData({
  abi: artifact.abi,
  functionName: 'sweep',
  args: [destination, sweepAmount, sweepNonce, deadline, signature],
});

// 5. Sponsor submits the type-4 sponsored transaction (sets code + calls sweep).
console.log('destination (clean):', destination);
const before = await publicClient.getBalance({ address: destination });
const receipt = await send('SPONSORED 7702 sweep', {
  to: stealthAddress,
  data,
  authorizationList: [authorization],
});

// 6. Verify.
const destAfter = await publicClient.getBalance({ address: destination });
const stealthAfter = await publicClient.getBalance({ address: stealthAddress });
console.log('destination received:', formatEther(destAfter - before), 'ETH');
console.log('stealth address remaining:', formatEther(stealthAfter), 'ETH');
if (destAfter - before !== sweepAmount) throw new Error('destination did not receive the swept amount');

const evidence = {
  executor: EXECUTOR,
  stealthAddress,
  destination,
  sweptAmount: formatEther(sweepAmount),
  sponsor: sponsor.address,
  sweepTx: receipt.transactionHash,
  txType: 'eip7702 (type-4) sponsored',
  note: 'stealth EOA never held gas; sponsor paid.',
};
writeFileSync('.demo/sweep-evidence.json', JSON.stringify(evidence, null, 2));
console.log('\nDONE — sponsored sweep succeeded. Evidence:');
console.log(JSON.stringify(evidence, null, 2));

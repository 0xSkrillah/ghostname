/**
 * FULL LIVE Sepolia end-to-end. Gated: runs only when SEPOLIA_PRIVATE_KEY is
 * set (a THROWAWAY, testnet-only key with a little Sepolia ETH).
 *
 *   npm run e2e:sepolia
 *
 * Proves P0 on-chain, using the application's own code paths:
 *   register test ENS name (if needed) → publish stealth-meta-address[1]
 *   → resolve → derive A/B (A≠B) → pay A → announce → scan → recognise
 *   → negative control → recover spending key.
 *
 * The stealth identity is persisted to .demo/identity.json (gitignored,
 * TESTNET DEMO ONLY) so the UI demo can reuse the same viewing key.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  http,
  namehash,
  parseEther,
  toHex,
  type Address,
  type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { generateStealthKeys, computeStealthPrivateKey, privateKeyToAddress, type StealthKeys } from '../src/crypto/stealth';
import { publishStealthRecord } from '../src/ens/write';
import { resolveStealthMetaAddress } from '../src/ens/resolve';
import { planStealthPayment, executeStealthPayment } from '../src/chain/payment';
import { fetchAnnouncements, recogniseOwnedAnnouncements } from '../src/chain/announcer';

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
const PRIVATE_KEY = env.SEPOLIA_PRIVATE_KEY as Hex | undefined;
const RPC = env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const live = !!PRIVATE_KEY;

/** Official ENS Sepolia deployments (ensdomains/ens-contracts, verified 2026-09-01). */
const ETH_REGISTRAR_CONTROLLER: Address = '0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968';
const PUBLIC_RESOLVER: Address = '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5';
const ENS_REGISTRY: Address = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

const CONTROLLER_ABI = [
  {
    name: 'makeCommitment',
    type: 'function',
    stateMutability: 'pure',
    inputs: [
      {
        name: 'registration',
        type: 'tuple',
        components: [
          { name: 'label', type: 'string' },
          { name: 'owner', type: 'address' },
          { name: 'duration', type: 'uint256' },
          { name: 'secret', type: 'bytes32' },
          { name: 'resolver', type: 'address' },
          { name: 'data', type: 'bytes[]' },
          { name: 'reverseRecord', type: 'uint8' },
          { name: 'referrer', type: 'bytes32' },
        ],
      },
    ],
    outputs: [{ name: 'commitment', type: 'bytes32' }],
  },
  {
    name: 'commit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    outputs: [],
  },
  {
    name: 'register',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'registration',
        type: 'tuple',
        components: [
          { name: 'label', type: 'string' },
          { name: 'owner', type: 'address' },
          { name: 'duration', type: 'uint256' },
          { name: 'secret', type: 'bytes32' },
          { name: 'resolver', type: 'address' },
          { name: 'data', type: 'bytes[]' },
          { name: 'reverseRecord', type: 'uint8' },
          { name: 'referrer', type: 'bytes32' },
        ],
      },
    ],
    outputs: [],
  },
  {
    name: 'rentPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'label', type: 'string' },
      { name: 'duration', type: 'uint256' },
    ],
    outputs: [
      {
        name: 'price',
        type: 'tuple',
        components: [
          { name: 'base', type: 'uint256' },
          { name: 'premium', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'minCommitmentAge',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const REGISTRY_OWNER_ABI = [
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const IDENTITY_PATH = '.demo/identity.json';
const EVIDENCE_PATH = '.demo/e2e-evidence.json';

function loadOrCreateIdentity(): StealthKeys {
  if (existsSync(IDENTITY_PATH)) {
    return JSON.parse(readFileSync(IDENTITY_PATH, 'utf8')) as StealthKeys;
  }
  const keys = generateStealthKeys();
  mkdirSync('.demo', { recursive: true });
  writeFileSync(IDENTITY_PATH, JSON.stringify(keys, null, 2));
  return keys;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe.runIf(live)('LIVE Sepolia end-to-end', () => {
  const account = privateKeyToAccount(PRIVATE_KEY ?? generatePrivateKey());
  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC, { timeout: 30_000 }) });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(RPC, { timeout: 30_000 }),
  });
  // Deterministic per-key label so re-runs reuse the same test name.
  const label = `ghostname-${account.address.slice(2, 8).toLowerCase()}`;
  const ensName = `${label}.eth`;
  const identity = loadOrCreateIdentity();
  const evidence: Record<string, string> = { ensName, account: account.address };
  let funded = false;

  beforeAll(async () => {
    const balance = await publicClient.getBalance({ address: account.address });
    console.log(`[e2e] account ${account.address} balance ${formatEther(balance)} ETH on Sepolia`);
    funded = balance >= parseEther('0.01');
    if (!funded) {
      console.warn(
        `[e2e] SKIPPING live run — fund ${account.address} with >= 0.03 Sepolia ETH first.`,
      );
    }
  }, 60_000);

  it('owns (or registers) the test ENS name', async (ctx) => {
    if (!funded) return ctx.skip();
    const node = namehash(ensName);
    const owner = await publicClient.readContract({
      address: ENS_REGISTRY,
      abi: REGISTRY_OWNER_ABI,
      functionName: 'owner',
      args: [node],
    });
    if (owner.toLowerCase() === account.address.toLowerCase()) {
      console.log(`[e2e] ${ensName} already owned by the demo account`);
      return;
    }
    expect(owner).toBe('0x0000000000000000000000000000000000000000');

    const duration = 90n * 24n * 3600n;
    const registration = {
      label,
      owner: account.address,
      duration,
      secret: toHex(crypto.getRandomValues(new Uint8Array(32))),
      resolver: PUBLIC_RESOLVER,
      data: [] as Hex[],
      reverseRecord: 0,
      referrer: `0x${'0'.repeat(64)}` as Hex,
    } as const;

    const commitment = await publicClient.readContract({
      address: ETH_REGISTRAR_CONTROLLER,
      abi: CONTROLLER_ABI,
      functionName: 'makeCommitment',
      args: [registration],
    });
    const commitTx = await walletClient.writeContract({
      address: ETH_REGISTRAR_CONTROLLER,
      abi: CONTROLLER_ABI,
      functionName: 'commit',
      args: [commitment],
    });
    await publicClient.waitForTransactionReceipt({ hash: commitTx });
    console.log(`[e2e] commit tx ${commitTx}`);

    const minAge = await publicClient.readContract({
      address: ETH_REGISTRAR_CONTROLLER,
      abi: CONTROLLER_ABI,
      functionName: 'minCommitmentAge',
      args: [],
    });
    console.log(`[e2e] waiting ${minAge + 15n}s commitment age…`);
    await sleep(Number(minAge + 15n) * 1000);

    const price = await publicClient.readContract({
      address: ETH_REGISTRAR_CONTROLLER,
      abi: CONTROLLER_ABI,
      functionName: 'rentPrice',
      args: [label, duration],
    });
    const value = ((price.base + price.premium) * 110n) / 100n;
    const registerTx = await walletClient.writeContract({
      address: ETH_REGISTRAR_CONTROLLER,
      abi: CONTROLLER_ABI,
      functionName: 'register',
      args: [registration],
      value,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: registerTx });
    expect(receipt.status).toBe('success');
    evidence.registerTx = registerTx;
    console.log(`[e2e] registered ${ensName}: ${registerTx}`);
  }, 300_000);

  it('publishes stealth-meta-address[1] via the app write path and resolves it back', async (ctx) => {
    if (!funded) return ctx.skip();
    const existing = await resolveStealthMetaAddress(publicClient, ensName);
    if (existing.status === 'ok' && existing.record === identity.stealthMetaAddress) {
      console.log('[e2e] record already published and current');
      return;
    }
    const tx = await publishStealthRecord({
      publicClient,
      walletClient,
      chain: sepolia,
      account: account.address,
      name: ensName,
      stealthMetaAddress: identity.stealthMetaAddress,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    expect(receipt.status).toBe('success');
    evidence.setTextTx = tx;
    console.log(`[e2e] setText tx ${tx}`);

    const resolved = await resolveStealthMetaAddress(publicClient, ensName);
    expect(resolved.status).toBe('ok');
    if (resolved.status === 'ok') {
      expect(resolved.record).toBe(identity.stealthMetaAddress);
    }
  }, 240_000);

  it('derives two DIFFERENT destinations, pays one, announces, scans, recognises, recovers', async (ctx) => {
    if (!funded) return ctx.skip();
    const planA = await planStealthPayment(publicClient, ensName, parseEther('0.0005'));
    const planB = await planStealthPayment(publicClient, ensName, parseEther('0.0005'));
    expect(planA.derivation.stealthAddress).not.toBe(planB.derivation.stealthAddress);
    console.log(`[e2e] A=${planA.derivation.stealthAddress} B=${planB.derivation.stealthAddress}`);

    const startBlock = await publicClient.getBlockNumber();
    const executed = await executeStealthPayment({
      walletClient,
      chain: sepolia,
      account: account.address,
      plan: planA,
    });
    const payReceipt = await publicClient.waitForTransactionReceipt({ hash: executed.paymentTx });
    const annReceipt = await publicClient.waitForTransactionReceipt({
      hash: executed.announcementTx,
    });
    expect(payReceipt.status).toBe('success');
    expect(annReceipt.status).toBe('success');
    evidence.paymentTx = executed.paymentTx;
    evidence.announcementTx = executed.announcementTx;
    evidence.stealthAddress = executed.stealthAddress;
    evidence.scanStartBlock = (startBlock - 5n).toString();
    console.log(`[e2e] payment ${executed.paymentTx}`);
    console.log(`[e2e] announcement ${executed.announcementTx}`);

    // The payment landed on the freshly derived address.
    const balance = await publicClient.getBalance({ address: executed.stealthAddress });
    expect(balance).toBe(parseEther('0.0005'));

    // Scan a constrained window and recognise with the viewing key.
    const announcements = await fetchAnnouncements(publicClient, {
      fromBlock: startBlock - 5n,
      toBlock: annReceipt.blockNumber + 1n,
    });
    const owned = recogniseOwnedAnnouncements(announcements, {
      viewingPrivateKey: identity.viewingPrivateKey as Hex,
      spendingPublicKey: identity.spendingPublicKey as Hex,
    });
    const ours = owned.find(
      (a) => a.stealthAddress.toLowerCase() === executed.stealthAddress.toLowerCase(),
    );
    expect(ours).toBeDefined();
    console.log(`[e2e] scanner recognised the payment at block ${ours!.blockNumber}`);

    // Negative control: a fresh unrelated viewing key recognises nothing of ours.
    const stranger = generateStealthKeys();
    const strangerOwned = recogniseOwnedAnnouncements(announcements, {
      viewingPrivateKey: stranger.viewingPrivateKey as Hex,
      spendingPublicKey: stranger.spendingPublicKey as Hex,
    });
    expect(
      strangerOwned.some(
        (a) => a.stealthAddress.toLowerCase() === executed.stealthAddress.toLowerCase(),
      ),
    ).toBe(false);

    // Recover the stealth private key and prove it controls the destination.
    const stealthKey = computeStealthPrivateKey({
      spendingPrivateKey: identity.spendingPrivateKey as Hex,
      viewingPrivateKey: identity.viewingPrivateKey as Hex,
      ephemeralPublicKey: ours!.ephemeralPublicKey,
    });
    expect(privateKeyToAddress(stealthKey).toLowerCase()).toBe(
      executed.stealthAddress.toLowerCase(),
    );
    console.log('[e2e] recovered stealth private key controls the destination ✓');

    writeFileSync(EVIDENCE_PATH, JSON.stringify(evidence, null, 2));
    console.log(`[e2e] evidence written to ${EVIDENCE_PATH}:`);
    console.log(JSON.stringify(evidence, null, 2));
  }, 300_000);
});

describe.runIf(!live)('LIVE Sepolia end-to-end (skipped)', () => {
  it('is skipped because SEPOLIA_PRIVATE_KEY is not set', () => {
    expect(live).toBe(false);
  });
});

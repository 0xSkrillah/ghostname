/**
 * FULL LIVE Sepolia end-to-end. Gated: runs only when SEPOLIA_PRIVATE_KEY is
 * set (a THROWAWAY, testnet-only key with a little Sepolia ETH).
 *
 *   npm run e2e:sepolia
 *
 * The demo ENS name is registered once via `node scripts/register-v2-name.mjs`
 * (Sepolia runs the ENSv2 registrar; registration pays in freely-mintable
 * test USDC). This suite then proves P0 on-chain using the application's own
 * code paths:
 *   name resolves → publish stealth-meta-address[1] via the app write path
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
  parseEther,
  type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import {
  generateStealthKeys,
  computeStealthPrivateKey,
  privateKeyToAddress,
  type StealthKeys,
} from '../src/crypto/stealth';
import { publishStealthRecord } from '../src/ens/write';
import { resolveStealthMetaAddress } from '../src/ens/resolve';
import { planStealthPayment, executeStealthPayment } from '../src/chain/payment';
import { fetchAnnouncements, recogniseOwnedAnnouncements } from '../src/chain/announcer';

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
const PRIVATE_KEY = env.SEPOLIA_PRIVATE_KEY as Hex | undefined;
const RPC = env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const live = !!PRIVATE_KEY;

const IDENTITY_PATH = '.demo/identity.json';
const REGISTRATION_PATH = '.demo/v2-registration.json';
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

describe.runIf(live)('LIVE Sepolia end-to-end', () => {
  const account = privateKeyToAccount(PRIVATE_KEY ?? generatePrivateKey());
  const publicClient = createPublicClient({ chain: sepolia, transport: http(RPC, { timeout: 30_000 }) });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(RPC, { timeout: 30_000 }),
  });
  const registration = existsSync(REGISTRATION_PATH)
    ? (JSON.parse(readFileSync(REGISTRATION_PATH, 'utf8')) as { ensName?: string })
    : {};
  const ensName =
    registration.ensName ?? `ghostname-${account.address.slice(2, 8).toLowerCase()}.eth`;
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

  it('the demo ENS name is registered and resolves', async (ctx) => {
    if (!funded) return ctx.skip();
    const address = await publicClient.getEnsAddress({ name: ensName });
    if (address === null) {
      throw new Error(
        `${ensName} is not registered. Run: node scripts/register-v2-name.mjs (one-time setup).`,
      );
    }
    console.log(`[e2e] ${ensName} resolves to ${address}`);
    expect(address).toMatch(/^0x[0-9a-fA-F]{40}$/);
  }, 120_000);

  it('publishes stealth-meta-address[1] via the app write path and resolves it back', async (ctx) => {
    if (!funded) return ctx.skip();
    // Always publish (idempotent) so the application's write path is
    // exercised live: guard checks → resolver discovery via the Universal
    // Resolver → setText with the RFC record key.
    const tx = await publishStealthRecord({
      publicClient,
      walletClient,
      chain: sepolia,
      account,
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
      account,
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
      toBlock: annReceipt.blockNumber,
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

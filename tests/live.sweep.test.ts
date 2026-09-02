/**
 * LIVE Sepolia: end-to-end SPONSORED EIP-7702 sweep. Gated on SEPOLIA_PRIVATE_KEY.
 *
 *   npm run sweep:sepolia
 *
 * Deploys StealthSweepExecutor, funds a fresh stealth address, then has the
 * sponsor (demo wallet) submit ONE type-4 transaction that sweeps it to a clean
 * destination — the stealth EOA never holds gas. Proves the relayer/paymaster
 * spending path works on-chain, not just in signatures.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { loadEnv } from 'vite';
import {
  createPublicClient,
  createWalletClient,
  http,
  formatEther,
  parseEther,
  getContractAddress,
  type Hex,
} from 'viem';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { generateStealthAddress, computeStealthPrivateKey } from '../src/crypto/stealth';
import { randomSweepNonce, signNativeSweepPackage, verifyNativeSweepPackage } from '../src/relay/sweep';

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
const PRIVATE_KEY = env.SEPOLIA_PRIVATE_KEY as Hex | undefined;
const RPC = env.VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const live = !!PRIVATE_KEY;

describe.runIf(live)('LIVE Sepolia — sponsored EIP-7702 sweep', () => {
  it('deploys the executor, funds a stealth EOA, and sweeps it with a sponsored type-4 tx', async () => {
    const sponsor = privateKeyToAccount(PRIVATE_KEY!);
    const transport = http(RPC, { timeout: 30_000 });
    const publicClient = createPublicClient({ chain: sepolia, transport });
    const sponsorWallet = createWalletClient({ account: sponsor, chain: sepolia, transport });

    const balance = await publicClient.getBalance({ address: sponsor.address });
    console.log(`[sweep] sponsor ${sponsor.address} — ${formatEther(balance)} ETH`);
    if (balance < parseEther('0.003')) return; // skip if underfunded

    const identity = JSON.parse(readFileSync('.demo/identity.json', 'utf8'));
    const artifact = JSON.parse(readFileSync('.demo/executor.json', 'utf8'));
    const state = existsSync('.demo/sweep-state.json')
      ? JSON.parse(readFileSync('.demo/sweep-state.json', 'utf8'))
      : {};

    async function send(desc: string, request: Parameters<typeof sponsorWallet.sendTransaction>[0]) {
      const hash = await sponsorWallet.sendTransaction(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status, `${desc} status`).toBe('success');
      console.log(`[sweep] ${desc}: ${hash}`);
      return receipt;
    }

    // 1. Deploy the executor once.
    if (!state.executor) {
      const nonce = await publicClient.getTransactionCount({ address: sponsor.address });
      state.executor = getContractAddress({ from: sponsor.address, nonce: BigInt(nonce) });
      await send('deploy executor', { data: artifact.bytecode as Hex, nonce });
      mkdirSync('.demo', { recursive: true });
      writeFileSync('.demo/sweep-state.json', JSON.stringify(state, null, 2));
    }
    const EXECUTOR = state.executor as `0x${string}`;
    console.log('[sweep] executor:', EXECUTOR);
    const code = await publicClient.getCode({ address: EXECUTOR });
    expect(code && code !== '0x').toBeTruthy();

    // 2. Fund a fresh stealth address.
    const announcement = generateStealthAddress(identity.stealthMetaAddress);
    const stealthAddress = announcement.stealthAddress;
    const amount = parseEther('0.0006');
    await send('fund stealth EOA', { to: stealthAddress, value: amount });

    // 3. Recover the stealth key.
    const stealthPrivateKey = computeStealthPrivateKey({
      spendingPrivateKey: identity.spendingPrivateKey,
      viewingPrivateKey: identity.viewingPrivateKey,
      ephemeralPublicKey: announcement.ephemeralPublicKey,
    });
    const stealthAccount = privateKeyToAccount(stealthPrivateKey);
    expect(stealthAccount.address.toLowerCase()).toBe(stealthAddress.toLowerCase());

    // 4. Build the COMPLETE destination-bound package exactly as the browser
    // does. Read the real account nonce rather than assuming zero.
    const destination = privateKeyToAccount(generatePrivateKey()).address;
    const authorizationNonce = await publicClient.getTransactionCount({
      address: stealthAddress,
    });
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const pkg = await signNativeSweepPackage({
      stealthPrivateKey,
      stealthAddress,
      chainId: sepolia.id,
      executor: EXECUTOR,
      destination,
      amount,
      authorizationNonce,
      sweepNonce: randomSweepNonce(),
      deadline,
    });

    // The package must verify locally before we spend gas on it.
    const verification = await verifyNativeSweepPackage(pkg);
    expect(verification.failures).toEqual([]);
    expect(verification.valid).toBe(true);

    // 5. Sponsor submits the type-4 transaction built ENTIRELY from the
    // package. If the package were incomplete this step could not exist.
    const before = await publicClient.getBalance({ address: destination });
    const receipt = await send('SPONSORED 7702 sweep', {
      to: pkg.stealthAddress,
      data: pkg.calldata,
      authorizationList: [
        {
          chainId: pkg.authorization.chainId,
          address: pkg.authorization.address,
          nonce: pkg.authorization.nonce,
          r: pkg.authorization.r,
          s: pkg.authorization.s,
          yParity: pkg.authorization.yParity,
        },
      ],
    });

    // 6. Verify funds moved out with the sponsor paying gas.
    const destAfter = await publicClient.getBalance({ address: destination });
    const stealthAfter = await publicClient.getBalance({ address: stealthAddress });
    expect(destAfter - before).toBe(amount);
    expect(stealthAfter).toBe(0n);
    console.log(`[sweep] destination ${destination} received ${formatEther(amount)} ETH`);
    console.log(`[sweep] stealth EOA drained; sponsor paid gas ✓`);

    const evidence = {
      executor: EXECUTOR,
      stealthAddress,
      destination,
      sweptAmount: formatEther(amount),
      sponsor: sponsor.address,
      sweepTx: receipt.transactionHash,
      txType: 'eip7702 (type-4) sponsored',
    };
    writeFileSync('.demo/sweep-evidence.json', JSON.stringify(evidence, null, 2));
    console.log('[sweep] evidence:', JSON.stringify(evidence, null, 2));
  }, 300_000);
});

describe.runIf(!live)('LIVE Sepolia — sponsored sweep (skipped)', () => {
  it('is skipped because SEPOLIA_PRIVATE_KEY is not set', () => {
    expect(live).toBe(false);
  });
});

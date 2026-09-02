/**
 * Relayer/paymaster sweep signing. Proves the client-side authorizations are
 * signed by the recovered STEALTH key (so a sponsor/relayer can pay gas), and
 * that an unrelated key cannot forge them.
 */
import { describe, expect, it } from 'vitest';
import { getAddress, type Address } from 'viem';
import {
  signSweepAuthorization,
  verifySweepAuthorization,
  signErc3009Sweep,
  verifyErc3009Sweep,
} from '../src/relay/sweep';
import {
  computeStealthPrivateKey,
  generateStealthAddress,
  generateStealthKeys,
  privateKeyToAddress,
} from '../src/crypto/stealth';

const EXECUTOR: Address = getAddress('0x000000000000000000000000000000000000e702');
const DEST: Address = getAddress('0xdddddddddddddddddddddddddddddddddddddddd');
const USDC: Address = getAddress('0x1c7d4b196cb0c7b01d743fbc6116a902379c7238'); // USDC-style

/** End-to-end: pay a stealth identity, recover the stealth key, sign a sweep. */
function recoveredStealthKey() {
  const recipient = generateStealthKeys();
  const announcement = generateStealthAddress(recipient.stealthMetaAddress);
  const stealthPrivateKey = computeStealthPrivateKey({
    spendingPrivateKey: recipient.spendingPrivateKey,
    viewingPrivateKey: recipient.viewingPrivateKey,
    ephemeralPublicKey: announcement.ephemeralPublicKey,
  });
  return { stealthPrivateKey, stealthAddress: announcement.stealthAddress };
}

describe('EIP-7702 sponsored native-ETH sweep', () => {
  it('authorization is signed by the stealth key and verifies to the stealth address', async () => {
    const { stealthPrivateKey, stealthAddress } = recoveredStealthKey();
    const { stealthAddress: signer, authorization } = await signSweepAuthorization({
      stealthPrivateKey,
      chainId: 1,
      executor: EXECUTOR, nonce: 0 });
    expect(signer).toBe(stealthAddress);
    expect(authorization.address.toLowerCase()).toBe(EXECUTOR.toLowerCase());
    expect(authorization.chainId).toBe(1);
    expect(await verifySweepAuthorization(stealthAddress, authorization)).toBe(true);
  });

  it('an unrelated address does not verify the authorization', async () => {
    const { stealthPrivateKey } = recoveredStealthKey();
    const { authorization } = await signSweepAuthorization({
      stealthPrivateKey,
      chainId: 1,
      executor: EXECUTOR, nonce: 0 });
    const stranger = privateKeyToAddress(generateStealthKeys().spendingPrivateKey);
    expect(await verifySweepAuthorization(stranger, authorization)).toBe(false);
  });

  it('binds to the chain id (mainnet vs sepolia produce distinct signatures)', async () => {
    const { stealthPrivateKey } = recoveredStealthKey();
    const a = await signSweepAuthorization({ stealthPrivateKey, chainId: 1, executor: EXECUTOR, nonce: 0 });
    const b = await signSweepAuthorization({ stealthPrivateKey, chainId: 11155111, executor: EXECUTOR, nonce: 0 });
    expect(a.authorization.r).not.toBe(b.authorization.r);
  });
});

describe('EIP-3009 relayed ERC-20 sweep', () => {
  const domain = { token: USDC, tokenName: 'USD Coin', tokenVersion: '2', chainId: 1 };

  it('signature is made by the stealth key and verifies for the token domain', async () => {
    const { stealthPrivateKey, stealthAddress } = recoveredStealthKey();
    const result = await signErc3009Sweep({
      stealthPrivateKey,
      ...domain,
      to: DEST,
      value: 1_000_000n,
      validBefore: BigInt(Math.floor(Date.now() / 1000) + 3600),
    });
    expect(result.from).toBe(stealthAddress);
    expect(result.to).toBe(DEST);
    expect(result.nonce).toMatch(/^0x[0-9a-f]{64}$/);
    expect(await verifyErc3009Sweep(domain, result, stealthAddress)).toBe(true);
  });

  it('does not verify for an unrelated signer', async () => {
    const { stealthPrivateKey } = recoveredStealthKey();
    const result = await signErc3009Sweep({
      stealthPrivateKey,
      ...domain,
      to: DEST,
      value: 5n,
      validBefore: 9_999_999_999n,
    });
    const stranger = privateKeyToAddress(generateStealthKeys().viewingPrivateKey);
    expect(await verifyErc3009Sweep(domain, result, stranger)).toBe(false);
  });

  it('tampering with the amount invalidates the signature', async () => {
    const { stealthPrivateKey, stealthAddress } = recoveredStealthKey();
    const result = await signErc3009Sweep({
      stealthPrivateKey,
      ...domain,
      to: DEST,
      value: 100n,
      validBefore: 9_999_999_999n,
    });
    const tampered = { ...result, value: 999_999n };
    expect(await verifyErc3009Sweep(domain, tampered, stealthAddress)).toBe(false);
  });

  it('uses a fresh random nonce per signature', async () => {
    const { stealthPrivateKey } = recoveredStealthKey();
    const common = { stealthPrivateKey, ...domain, to: DEST, value: 1n, validBefore: 9_999_999_999n } as const;
    const a = await signErc3009Sweep(common);
    const b = await signErc3009Sweep(common);
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.signature).not.toBe(b.signature);
  });
});

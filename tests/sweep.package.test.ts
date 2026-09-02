/**
 * Phase 0: the complete, destination-bound sweep package.
 *
 * The defect these tests lock down: shipping only the EIP-7702 delegation is
 * both non-executable and misleading, because the delegation binds
 * (chain, executor, account nonce) and says nothing about where funds go.
 * Every field a relayer acts on must be cryptographically bound, so tampering
 * with any one of them has to fail verification.
 */
import { describe, expect, it } from 'vitest';
import { encodeFunctionData, getAddress, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  EXECUTOR_SWEEP_ABI,
  SWEEP_PACKAGE_SCHEMA,
  signNativeSweepPackage,
  verifyNativeSweepPackage,
  type NativeSweepPackage,
} from '../src/relay/sweep';
import {
  computeStealthPrivateKey,
  generateStealthAddress,
  generateStealthKeys,
} from '../src/crypto/stealth';

const EXECUTOR: Address = getAddress('0x94e4c39055fa4a5fcd47e03cbcbcd0503848806b');
const OTHER_EXECUTOR: Address = getAddress('0x000000000000000000000000000000000000e702');
const DESTINATION: Address = getAddress('0xdddddddddddddddddddddddddddddddddddddddd');
const ATTACKER: Address = getAddress('0xbadbadbadbadbadbadbadbadbadbadbadbadbadb');
const CHAIN_ID = 11155111;

/** A far-future deadline plus a fixed "now" keeps expiry deterministic. */
const NOW = 1_800_000_000n;
const DEADLINE = NOW + 3600n;
const AMOUNT = 600_000_000_000_000n; // 0.0006 ETH
const SWEEP_NONCE = 0n;

/** Pay a stealth identity, then recover the key exactly as /receive does. */
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

async function validPackage(overrides: Partial<Parameters<typeof signNativeSweepPackage>[0]> = {}) {
  const { stealthPrivateKey, stealthAddress } = recoveredStealthKey();
  const pkg = await signNativeSweepPackage({
    stealthPrivateKey,
    stealthAddress,
    chainId: CHAIN_ID,
    executor: EXECUTOR,
    destination: DESTINATION,
    amount: AMOUNT,
    authorizationNonce: 0,
    sweepNonce: SWEEP_NONCE,
    deadline: DEADLINE,
    ...overrides,
  });
  return { pkg, stealthPrivateKey, stealthAddress };
}

describe('signNativeSweepPackage', () => {
  it('produces a complete package that verifies', async () => {
    const { pkg, stealthAddress } = await validPackage();
    expect(pkg.schema).toBe(SWEEP_PACKAGE_SCHEMA);
    expect(pkg.stealthAddress).toBe(stealthAddress);
    expect(pkg.destination).toBe(DESTINATION);
    expect(pkg.executor).toBe(EXECUTOR);
    expect(pkg.amount).toBe(AMOUNT.toString());
    expect(pkg.calldata.startsWith('0x')).toBe(true);

    const result = await verifyNativeSweepPackage(pkg, { now: NOW });
    expect(result.failures).toEqual([]);
    expect(result.valid).toBe(true);
    expect(Object.values(result.checks).every(Boolean)).toBe(true);
  });

  it('keeps the account nonce and the executor sweep nonce separate', async () => {
    const { pkg } = await validPackage({ authorizationNonce: 3, sweepNonce: 77n });
    expect(pkg.authorizationNonce).toBe(3);
    expect(pkg.authorization.nonce).toBe(3);
    expect(pkg.sweepNonce).toBe('77');
    // The delegation must not carry the sweep nonce.
    expect(pkg.authorization.nonce).not.toBe(77);
  });

  it('rejects malformed inputs before signing', async () => {
    const { stealthPrivateKey } = recoveredStealthKey();
    const base = {
      stealthPrivateKey,
      chainId: CHAIN_ID,
      executor: EXECUTOR,
      destination: DESTINATION,
      amount: AMOUNT,
      authorizationNonce: 0,
      sweepNonce: SWEEP_NONCE,
      deadline: DEADLINE,
    };
    await expect(signNativeSweepPackage({ ...base, amount: 0n })).rejects.toThrow(/greater than zero/);
    await expect(
      signNativeSweepPackage({ ...base, destination: 'not-an-address' as Address }),
    ).rejects.toThrow(/valid address/);
    await expect(
      signNativeSweepPackage({ ...base, authorizationNonce: -1 }),
    ).rejects.toThrow(/non-negative/);
  });

  it('rejects a private key that does not match the stated stealth address', async () => {
    const { stealthPrivateKey } = recoveredStealthKey();
    const unrelated = recoveredStealthKey();
    await expect(
      signNativeSweepPackage({
        stealthPrivateKey,
        stealthAddress: unrelated.stealthAddress,
        chainId: CHAIN_ID,
        executor: EXECUTOR,
        destination: DESTINATION,
        amount: AMOUNT,
        authorizationNonce: 0,
        sweepNonce: SWEEP_NONCE,
        deadline: DEADLINE,
      }),
    ).rejects.toThrow(/does not match/);
  });
});

describe('verifyNativeSweepPackage rejects tampering with every bound field', () => {
  it('changed destination fails', async () => {
    const { pkg } = await validPackage();
    const tampered: NativeSweepPackage = { ...pkg, destination: ATTACKER };
    const result = await verifyNativeSweepPackage(tampered, { now: NOW });
    expect(result.valid).toBe(false);
    expect(result.checks.sweepSigner).toBe(false);
    expect(result.checks.calldataMatches).toBe(false);
  });

  it('changed destination in the calldata alone still fails', async () => {
    const { pkg } = await validPackage();
    // Re-encode calldata pointing at the attacker while leaving fields intact.
    const evilCalldata = encodeFunctionData({
      abi: EXECUTOR_SWEEP_ABI,
      functionName: 'sweep',
      args: [ATTACKER, AMOUNT, SWEEP_NONCE, DEADLINE, pkg.sweepSignature],
    });
    const result = await verifyNativeSweepPackage(
      { ...pkg, calldata: evilCalldata },
      { now: NOW },
    );
    expect(result.valid).toBe(false);
    expect(result.checks.calldataMatches).toBe(false);
  });

  it('changed amount fails', async () => {
    const { pkg } = await validPackage();
    const result = await verifyNativeSweepPackage(
      { ...pkg, amount: (AMOUNT * 2n).toString() },
      { now: NOW },
    );
    expect(result.valid).toBe(false);
    expect(result.checks.sweepSigner).toBe(false);
  });

  it('changed deadline fails', async () => {
    const { pkg } = await validPackage();
    const result = await verifyNativeSweepPackage(
      { ...pkg, deadline: (DEADLINE + 99999n).toString() },
      { now: NOW },
    );
    expect(result.valid).toBe(false);
    expect(result.checks.sweepSigner).toBe(false);
  });

  it('changed sweep nonce fails', async () => {
    const { pkg } = await validPackage();
    const result = await verifyNativeSweepPackage({ ...pkg, sweepNonce: '42' }, { now: NOW });
    expect(result.valid).toBe(false);
    expect(result.checks.sweepSigner).toBe(false);
  });

  it('changed executor fails', async () => {
    const { pkg } = await validPackage();
    const result = await verifyNativeSweepPackage(
      { ...pkg, executor: OTHER_EXECUTOR },
      { now: NOW },
    );
    expect(result.valid).toBe(false);
    expect(result.checks.executorMatches).toBe(false);
  });

  it('changed chain id fails', async () => {
    const { pkg } = await validPackage();
    const result = await verifyNativeSweepPackage({ ...pkg, chainId: 1 }, { now: NOW });
    expect(result.valid).toBe(false);
    expect(result.checks.chainIdMatches).toBe(false);
    expect(result.checks.sweepSigner).toBe(false);
  });

  it('an unrelated signer fails', async () => {
    const { pkg } = await validPackage();
    const stranger = recoveredStealthKey();
    const result = await verifyNativeSweepPackage(
      { ...pkg, stealthAddress: stranger.stealthAddress },
      { now: NOW },
    );
    expect(result.valid).toBe(false);
    expect(result.checks.delegationSigner).toBe(false);
    expect(result.checks.sweepSigner).toBe(false);
  });

  it('a package signed by a different key does not verify against this address', async () => {
    const victim = recoveredStealthKey();
    const attacker = recoveredStealthKey();
    const forged = await signNativeSweepPackage({
      stealthPrivateKey: attacker.stealthPrivateKey,
      chainId: CHAIN_ID,
      executor: EXECUTOR,
      destination: ATTACKER,
      amount: AMOUNT,
      authorizationNonce: 0,
      sweepNonce: SWEEP_NONCE,
      deadline: DEADLINE,
    });
    const result = await verifyNativeSweepPackage(
      { ...forged, stealthAddress: victim.stealthAddress },
      { now: NOW },
    );
    expect(result.valid).toBe(false);
  });

  it('an expired package fails', async () => {
    const { pkg } = await validPackage();
    const result = await verifyNativeSweepPackage(pkg, { now: DEADLINE + 1n });
    expect(result.valid).toBe(false);
    expect(result.checks.notExpired).toBe(false);
    // Signatures are still individually sound; only expiry failed.
    expect(result.checks.sweepSigner).toBe(true);
    expect(result.checks.delegationSigner).toBe(true);
  });

  it('an unrecognised schema is refused outright', async () => {
    const { pkg } = await validPackage();
    const result = await verifyNativeSweepPackage(
      { ...pkg, schema: 'something-else' } as unknown as NativeSweepPackage,
      { now: NOW },
    );
    expect(result.valid).toBe(false);
    expect(result.checks.schema).toBe(false);
  });
});

describe('the serialized package leaks no secrets', () => {
  it('contains no private key material and survives a JSON round trip', async () => {
    const { pkg, stealthPrivateKey } = await validPackage();
    const json = JSON.stringify(pkg);

    const account = privateKeyToAccount(stealthPrivateKey);
    expect(json).not.toContain(stealthPrivateKey);
    expect(json).not.toContain(stealthPrivateKey.slice(2));
    // No 32-byte secret-looking field beyond the signatures we expect.
    expect(json.toLowerCase()).not.toContain('privatekey');
    // The public address is expected to be present.
    expect(json).toContain(account.address);

    const revived = JSON.parse(json) as NativeSweepPackage;
    const result = await verifyNativeSweepPackage(revived, { now: NOW });
    expect(result.valid).toBe(true);
  });

  it('uint256 fields are strings so JSON does not lose precision', async () => {
    const big = 2n ** 200n;
    const { pkg } = await validPackage({ amount: big, sweepNonce: big - 1n });
    expect(typeof pkg.amount).toBe('string');
    expect(pkg.amount).toBe(big.toString());
    const revived = JSON.parse(JSON.stringify(pkg)) as NativeSweepPackage;
    expect(BigInt(revived.amount)).toBe(big);
    expect((await verifyNativeSweepPackage(revived, { now: NOW })).valid).toBe(true);
  });
});

describe('the package matches what the on-chain executor expects', () => {
  it('calldata is a sweep(...) call carrying the intent signature', async () => {
    const { pkg } = await validPackage();
    const expected = encodeFunctionData({
      abi: EXECUTOR_SWEEP_ABI,
      functionName: 'sweep',
      args: [DESTINATION, AMOUNT, SWEEP_NONCE, DEADLINE, pkg.sweepSignature as Hex],
    });
    expect(pkg.calldata).toBe(expected);
  });
});

describe('verifyNativeSweepPackage fails closed on malformed input', () => {
  it('returns valid:false with a schema failure instead of throwing', async () => {
    const hostile: unknown[] = [
      null,
      'string',
      {},
      { schema: SWEEP_PACKAGE_SCHEMA, version: 1 },
      { schema: SWEEP_PACKAGE_SCHEMA, version: 1, chainId: 1, executor: 'x', stealthAddress: 'y', destination: 'z' },
    ];
    for (const input of hostile) {
      const result = await verifyNativeSweepPackage(input as NativeSweepPackage, { now: NOW });
      expect(result.valid).toBe(false);
      expect(result.checks.schema).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
    }
  });

  it('rejects empty or non-decimal integer strings rather than coercing them to zero', async () => {
    const { pkg } = await validPackage();
    for (const bad of ['', ' 1', '1.0', '0x10', '-1']) {
      const result = await verifyNativeSweepPackage({ ...pkg, amount: bad }, { now: NOW });
      expect(result.valid).toBe(false);
      expect(result.checks.schema).toBe(false);
    }
  });

  it('rejects a malformed authorization object without throwing', async () => {
    const { pkg } = await validPackage();
    const result = await verifyNativeSweepPackage(
      { ...pkg, authorization: { ...pkg.authorization, r: '0x12', yParity: 2 } },
      { now: NOW },
    );
    expect(result.valid).toBe(false);
    expect(result.failures.join(' ')).toMatch(/authorization/);
  });
});

describe('signature canonicality and chain binding', () => {
  it('rejects a malleated high-s intent signature that still recovers to the signer', async () => {
    const { pkg } = await validPackage();
    const { hasHighS } = await import('../src/relay/sweep');
    const { parseSignature, serializeSignature } = await import('viem');
    const { secp256k1 } = await import('@noble/curves/secp256k1');
    const sig = parseSignature(pkg.sweepSignature);
    expect(hasHighS(pkg.sweepSignature)).toBe(false);
    const highS = serializeSignature({
      r: sig.r,
      s: `0x${(secp256k1.CURVE.n - BigInt(sig.s)).toString(16).padStart(64, '0')}` as Hex,
      yParity: sig.yParity === 0 ? 1 : 0,
    });
    expect(hasHighS(highS)).toBe(true);
    const result = await verifyNativeSweepPackage({ ...pkg, sweepSignature: highS }, { now: NOW });
    expect(result.checks.sweepSigner).toBe(false);
    expect(result.valid).toBe(false);
  });

  it('rejects a chain-agnostic (chainId 0) delegation', async () => {
    const { pkg } = await validPackage();
    const result = await verifyNativeSweepPackage(
      { ...pkg, authorization: { ...pkg.authorization, chainId: 0 } },
      { now: NOW },
    );
    expect(result.checks.chainIdMatches).toBe(false);
    expect(result.failures.join(' ')).toMatch(/chain-agnostic/);
    expect(result.valid).toBe(false);
  });
});

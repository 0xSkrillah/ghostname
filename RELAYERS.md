# Spending stealth funds without re-linking: relayers & paymasters

## The problem

A GhostName payment lands on a **fresh stealth EOA**: an address only the
recipient can derive the key for, holding the funds but **no ETH for gas**.

The naive way to spend it, send a little ETH to the stealth address from your
main wallet to cover gas, **re-links** the "private" stealth address to your
public identity on-chain. That hands the observer exactly the connection
GhostName removed. So the recipient-address privacy is only real if you can
move the funds **without the stealth address ever paying its own gas**.

The answer is the same one every production stealth-address system uses: have
**someone else pay the gas**, authorized by the stealth key, so no funding
transaction ever touches the stealth address.

## Three approaches

| Approach | Good for | Who pays gas | Standard |
|---|---|---|---|
| **EIP-7702 sponsored sweep** | native ETH, any token, batches | a sponsor submits a type-4 tx | EIP-7702 (live on mainnet since Pectra, May 2025) |
| **EIP-3009 relayed transfer** | USDC-style ERC-20s | a relayer, fee deducted from the transfer | EIP-3009 |
| **ERC-4337 + paymaster** | smart-account users | a paymaster sponsors the UserOp | ERC-4337 |

GhostName implements the **client-side signing** for the first two, since a
stealth address is a plain EOA and EIP-7702 is the cleanest general fit for
native ETH. `src/relay/sweep.ts` produces and verifies both signatures locally
from a recovered stealth key; `tests/sweep.test.ts` proves the stealth key
signs them and an unrelated key cannot.

### 1. EIP-7702 sponsored native-ETH sweep (recommended)

1. Recipient recognises the payment and derives the stealth private key
   (`computeStealthPrivateKey`), all local.
2. The stealth key signs an **EIP-7702 authorization** delegating the stealth
   EOA to a batch-executor implementation (`signSweepAuthorization`). No gas,
   no on-chain action yet.
3. The recipient hands that authorization to a **sponsor** (a relayer/bundler,
   or their own funded hot wallet that is *not* linked to their identity).
4. The sponsor submits a **type-4 transaction**: `authorizationList: [auth]`,
   calling the executor to transfer the stealth EOA's balance to a clean
   destination. The **sponsor pays the gas**.
5. Funds leave the stealth address for the destination; the stealth address
   never received gas and was never touched by the recipient's main wallet.

A fresh stealth EOA is usually at account nonce 0, but the app reads the real
account nonce rather than assuming it, because EIP-7702 requires the
authorization nonce to equal the account nonce at processing time. See the
two-signature section below.

### 2. EIP-3009 relayed ERC-20 sweep (USDC & friends)

For tokens implementing `transferWithAuthorization` (EIP-3009), the stealth key
signs the transfer authorization off-chain (`signErc3009Sweep`); any relayer
calls `token.transferWithAuthorization(...)`, pays gas, and typically deducts a
fee from the amount. This is exactly how Umbra (the reference ERC-5564 product)
sweeps stablecoins.

## Proven live on Sepolia

The full sponsored sweep runs on-chain, not just as signatures:

- Executor `StealthSweepExecutor` (`contracts/StealthSweepExecutor.sol`)
  deployed at **`0x94E4C39055fa4a5fCd47E03CbcbCD0503848806b`** (Sepolia).
- A fresh stealth EOA was funded, then swept to a clean destination by a
  **sponsored type-4 (EIP-7702) transaction**, the sponsor paid the gas, the
  stealth EOA never held any. Sweep tx:
  [`0x412cca80…efedc0`](https://sepolia.etherscan.io/tx/0x412cca80d621d5d58a38ef190c6a8c323d18adb1be3488f29868d1b4b2efedc0).
- Reproduce: `npm run sweep:sepolia` (deploys once, then runs the full sweep;
  needs `SEPOLIA_PRIVATE_KEY` funded with a little test ETH). Evidence lands in
  `.demo/sweep-evidence.json`.

The executor verifies an EIP-712 `Sweep` signature made by the EOA itself
(`ecrecover == address(this)` under 7702), so anyone, a sponsor/relayer, can
submit it but only the stealth key can authorize where the funds go.

> In this demo the sponsor is the same throwaway wallet for convenience; the
> mechanism (stealth EOA never funded for gas) is what's proven. In production
> the sponsor is an independent relayer, so the sender wallet isn't linked either.

## The sweep package needs two signatures, not one

This is the part that is easy to get wrong, so it is worth stating plainly.

A sponsored sweep requires **two independent signatures**:

1. the **EIP-7702 delegation authorization**, which binds only
   `(chainId, executor, accountNonce)`. It says nothing about where the money
   goes;
2. the executor's **EIP-712 `Sweep` intent**, which is what actually binds
   `to`, `amount`, `nonce` and `deadline`.

Handing a relayer only the delegation is both non-executable, because
`StealthSweepExecutor.sweep` rejects a missing or wrong intent signature, and
misleading, because a destination shown next to an unbound delegation implies a
guarantee that does not exist.

`signNativeSweepPackage` therefore emits both signatures plus the exact
`sweep(...)` calldata, and `verifyNativeSweepPackage` re-checks every bound
field independently: delegation signer, executor, chain, intent signer,
calldata/field agreement and expiry. `tests/sweep.package.test.ts` asserts that
tampering with the destination, amount, deadline, sweep nonce, executor, chain
or signer fails verification, and that the serialized package carries no key
material.

The two nonces are deliberately distinct and separately labelled:

- `authorizationNonce` is the stealth EOA's **account nonce**. EIP-7702 requires
  it to equal the account nonce at processing time, so the app reads it from a
  public client instead of assuming a fresh EOA is at zero.
- `sweepNonce` is the executor's internal **replay guard**, unrelated to the
  account nonce.

The live test builds its transaction entirely from the package
(`to: pkg.stealthAddress`, `data: pkg.calldata`, `authorizationList: [...]`), so
the on-chain sweep is proof that the package format is executable rather than
merely self-consistent.

## What GhostName ships vs. what a deployment adds

**Shipped and tested (client-side, no infrastructure, no funds):**
- `signSweepAuthorization` / `verifySweepAuthorization`: EIP-7702.
- `signErc3009Sweep` / `verifyErc3009Sweep`: EIP-3009.
- The `/receive` page can produce a signed sweep authorization for any payment
  it recognises, entirely locally.

**Deployed for the demo:**
- The **executor** (`contracts/StealthSweepExecutor.sol`) is live on Sepolia
  and its address is wired into the app (`SWEEP_EXECUTOR`), so `/receive`
  pre-fills it.
- The **sponsor** is scripted (`tests/live.sweep.test.ts` / `npm run
  sweep:sepolia`). For a mainnet deployment, swap the throwaway sponsor for an
  independent relayer/bundler (run your own, or a public ERC-4337 bundler with
  a paymaster) and set `VITE_SWEEP_EXECUTOR` to your executor on that network.

The executor here is a minimal, unaudited testnet demo contract, use an
audited 7702 account implementation for anything beyond a testnet demo.

## Honesty note

A relayer *learns the destination address* it sweeps to and can log it. Choose
a destination that is itself clean (not your main wallet), and treat the
relayer as a semi-trusted party for metadata, it cannot steal funds (it only
relays a signature authorizing a specific transfer), but it sees where the
money goes. This is a metadata trade-off, not a custody risk, and it is the
same trade-off every relayed-withdrawal system carries.

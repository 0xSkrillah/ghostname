# Spending stealth funds without re-linking — relayers & paymasters

## The problem

A GhostName payment lands on a **fresh stealth EOA**: an address only the
recipient can derive the key for, holding the funds but **no ETH for gas**.

The naive way to spend it — send a little ETH to the stealth address from your
main wallet to cover gas — **re-links** the "private" stealth address to your
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
   (`computeStealthPrivateKey`) — all local.
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

The stealth EOA's account nonce is 0 (it has never sent a tx), which is the
authorization nonce used.

### 2. EIP-3009 relayed ERC-20 sweep (USDC & friends)

For tokens implementing `transferWithAuthorization` (EIP-3009), the stealth key
signs the transfer authorization off-chain (`signErc3009Sweep`); any relayer
calls `token.transferWithAuthorization(...)`, pays gas, and typically deducts a
fee from the amount. This is exactly how Umbra (the reference ERC-5564 product)
sweeps stablecoins.

## What GhostName ships vs. what a deployment adds

**Shipped and tested (client-side, no infrastructure, no funds):**
- `signSweepAuthorization` / `verifySweepAuthorization` — EIP-7702.
- `signErc3009Sweep` / `verifyErc3009Sweep` — EIP-3009.
- The `/receive` page can produce a signed sweep authorization for any payment
  it recognises, entirely locally.

**Needed to actually execute (real infrastructure with funds — out of scope to
provision autonomously, same rationale as the Swarm postage stamp):**
- A deployed **batch-executor / smart-account implementation** for the EIP-7702
  delegate (e.g. a minimal `execute(to, value, data)` contract, or an existing
  audited one).
- A **sponsor / relayer / bundler** with ETH to pay gas. Options: run your own
  relayer, use a public ERC-4337 bundler with a paymaster, or a service like a
  gas-sponsorship API. Point the executor address and relayer endpoint at your
  deployment; the signing code already produces what they need.

## Honesty note

A relayer *learns the destination address* it sweeps to and can log it. Choose
a destination that is itself clean (not your main wallet), and treat the
relayer as a semi-trusted party for metadata — it cannot steal funds (it only
relays a signature authorizing a specific transfer), but it sees where the
money goes. This is a metadata trade-off, not a custody risk, and it is the
same trade-off every relayed-withdrawal system carries.

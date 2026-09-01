# GhostName

**Keep the ENS name. Break the payment graph.**

Common S3nse Amsterdam 2026 hackathon entry. GhostName gives an established
ENS identity **forward privacy**: keep the human-readable name, publish one
ERC-5564 stealth meta-address record, and every future sender derives a
fresh one-time receiving address — locally, with no gateway.

## 1. The problem

An ENS name like `skrillah.eth` is a great identity — and a privacy
liability. If it always resolves to one static wallet address, then every
payment anyone ever sends becomes public, permanently linkable history:
balances, counterparties, timing. **Blockchain history cannot be deleted.**
The only thing you can still choose is what happens to *future* payments.

## 2. Threat model (read this before believing anything else)

### Protected

- Linkage between an ENS name and its **future** one-time receiving
  addresses, against ordinary passive blockchain observers.
- Recipient-address reuse (each payment gets a fresh destination).
- Gateway dependence: ephemeral keys and stealth addresses are generated in
  the **sender's client**, so no third party learns destinations by
  construction.
- Recipient discovery of payments without revealing viewing/spending
  secrets (scanning uses the private viewing key locally).

### Not protected

- Historical blockchain activity — nothing can delete it.
- Existence/ownership of the ENS name itself.
- The public stealth meta-address record (it is meant to be public).
- Sender identity, when the sender pays from a public wallet.
- Amounts of ordinary ETH/ERC-20 transfers.
- Timing/network/RPC/browser-fingerprint correlation attacks.
- A compromised device, or leaked viewing/spending keys.
- Your identity to a sender who already knows who they are paying.

GhostName is **not** anonymity, **not** a mixer, **not** zero knowledge and
**not** history deletion, and never claims to be.

## 3. The privacy mechanism (ERC-5564 scheme 1)

The recipient generates two secp256k1 keypairs locally — spending and
viewing — and publishes their compressed public keys as a stealth
meta-address:

```
st:eth:0x<spendingPubKey 33B><viewingPubKey 33B>
```

For every payment, the sender (locally, with fresh CSPRNG randomness):

```
p_eph      ← random ephemeral private key (new every payment)
s_h        = keccak256(compress(p_eph · P_view))     shared secret hash
viewTag    = s_h[0]
P_stealth  = P_spend + s_h·G
destination = address(P_stealth)
```

The sender transfers ETH to `destination` and calls the ERC-5564 announcer
singleton with `(schemeId=1, destination, P_eph, viewTag‖metadata)`. The
recipient scans announcements: `s_h' = keccak256(compress(p_view · P_eph))`,
skips 255/256 of foreign announcements via the view tag, recomputes the
address, and — for their own payments — recovers the controlling key
`p_stealth = (p_spend + s_h') mod n`. Nobody without the private viewing key
can link the destinations to the name.

## 4. Why ENS is functionally essential

The stealth meta-address is *discovered through ENS*: senders resolve the
text record `stealth-meta-address[1]` (per the ENS
[stealth-resolution RFC](https://discuss.ens.domains/t/rfc-privacy-preserving-names-ensip-for-stealth-address-resolution/22354))
from any name. ENS is the identity and distribution layer that makes
stealth addresses usable by humans: you pay `name.eth`, not a 66-byte key
blob. Without ENS there is no discoverable identity; without stealth
addresses the ENS identity leaks its whole payment graph. The product is
the combination.

## 5. Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md). Summary:

- `src/crypto/` — pure, local ERC-5564 scheme-1 core on
  [@noble/curves](https://github.com/paulmillr/noble-curves) (audited
  primitives; we compose, never hand-roll curve math). No network, no
  storage, no logging.
- `src/ens/` — ENS resolution (mainnet read-only + Sepolia) and the
  Sepolia-only `setText` publish path.
- `src/chain/` — viem clients with RPC fallback, the announcer integration,
  scanning/recognition, and the hard network guards.
- `src/pages/` — Vite/React UI: `/scan /create /pay /receive /privacy /demo`.

**Key handling:** private keys are generated with a CSPRNG in the browser,
used locally, and optionally kept in `localStorage` for the demo scanner.
They are never transmitted, logged or analysed. There is no backend.

**Network safety:** Ethereum mainnet is read-only by construction (no
mainnet wallet client exists). Every write path calls
`assertWritableNetwork`, which hard-fails on anything but Sepolia
(11155111) — checked against both the intended chain and the wallet's
actually-reported chain, before the wallet is touched. Covered by tests.

## 6. Live demo

The `/demo` route runs the 90-second sequence with live calls only — inputs
are pre-filled, outputs never are. See [DEMO.md](DEMO.md).

## 7. Local reproduction

```bash
git clone https://github.com/0xSkrillah/ghostname
cd ghostname
npm install
npm test          # 58 deterministic tests, no network needed
npm run dev       # http://localhost:5173
```

Optional:

```bash
RUN_LIVE=1 npm test   # + live read-only mainnet ENS smoke tests
npm run build         # typecheck + production build
```

Copy `.env.example` to `.env` to pin your own RPC endpoints and demo
defaults (recommended for presentations).

## 8. Tests

- `tests/stealth.test.ts` — key generation, derivation determinism &
  freshness, positive/negative recognition (incl. 50 random wrong viewing
  keys), spending-key recovery, malformed inputs.
- `tests/metaAddress.test.ts` — record encoding/parsing/validation.
- `tests/interop.test.ts` — byte-level cross-verification against the
  ScopeLift `stealth-address-sdk` (dev-only oracle) + frozen known-answer
  vector.
- `tests/ens.test.ts` — resolution, record read, publish path, and the
  mainnet-write-blocked negatives.
- `tests/announcer.test.ts` — EIP-5564 metadata layout, scanning,
  recognition among noise, guarded payment flow, offline end-to-end.
- `tests/live.ens.test.ts` — gated (`RUN_LIVE=1`) read-only mainnet checks.

## 9. Contracts and networks

| Thing | Network | Address / value |
|---|---|---|
| ERC-5564 announcer (singleton) | mainnet + Sepolia | `0x55649E01B5Df198D18D95b5cc5051630cfD45564` |
| ERC-6538 registry (singleton, not required by the flow) | mainnet + Sepolia | `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538` |
| ENS registry | mainnet + Sepolia | `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e` |
| ENS text record key | — | `stealth-meta-address[1]` |
| Record value | — | `st:eth:0x…` string, verbatim |
| Writes permitted | **Sepolia only** (11155111) | mainnet writes blocked in code |

## 10. Known limitations

- Sweeping funds *out* of a stealth address is out of scope for the hack:
  spending from a fresh address needs gas, and funding gas from your main
  wallet can re-link you. (ERC-5564 ecosystems solve this with relayers /
  paymasters.)
- Demo key custody is browser `localStorage` — fine for a testnet demo, not
  a production custody model.
- Announcement scanning uses bounded `eth_getLogs` ranges over public RPCs;
  a production scanner would use an indexer.
- Amounts and timing remain public (see threat model).

## 11. Optional integrations

- Mobula public-exposure panel: not yet enabled.
- Swarm deployment / encrypted testnet recovery capsule: not yet enabled.

(Each is only claimed here if actually working; see commit history.)

## Standards

- [ERC-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [ERC-6538: Stealth Meta-Address Registry](https://eips.ethereum.org/EIPS/eip-6538)
- [ENS RFC: Privacy-Preserving Names](https://discuss.ens.domains/t/rfc-privacy-preserving-names-ensip-for-stealth-address-resolution/22354)

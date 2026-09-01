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
| ENS Universal Resolver (resolution + resolver discovery) | mainnet + Sepolia | `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` |
| ENS text record key | — | `stealth-meta-address[1]` |
| Record value | — | `st:eth:0x…` string, verbatim |
| Writes permitted | **Sepolia only** (11155111) | mainnet writes blocked in code |

**Sepolia ENSv2 note:** Sepolia is mid-migration to ENSv2, and the classic
ETHRegistrarController rejects new registrations. The demo identity
`ghostname-3c7714.eth` was registered through the live ENSv2 `ETHRegistrar`
(`0xa88553F454b77203B0D036A05c894d555EAAa2Cc`, paid in freely-mintable test
USDC) with a dedicated resolver deployed via the ENS `VerifiableFactory` —
see `scripts/register-v2-name.mjs`. Resolution and record writes in the app
go through the Universal Resolver, so they work identically for legacy and
v2 names.

### Live on-chain evidence (Sepolia)

- Demo identity: `ghostname-3c7714.eth`, resolver `0xE0e6F09B30eBcdE505FDCA0F1fd244273838FFAE`
- Registration: [`0x04985bb6…83a398`](https://sepolia.etherscan.io/tx/0x04985bb69fb3b20b034465cbe3d1acfd5a5ca3734ca3eab19db577462383a398)
- `stealth-meta-address[1]` publish (app write path): [`0x75b7a640…59ea29`](https://sepolia.etherscan.io/tx/0x75b7a6404a5a3b1880f8dce7c874cbf34ce65fca64cffeb7e313567b2759ea29)
- Stealth payment: [`0x2430f7f8…dc248b`](https://sepolia.etherscan.io/tx/0x2430f7f8a422a6a527272cd591541c101e9fffd43dccb2a1feed918ee0dc248b)
- ERC-5564 announcement: [`0x4164c074…010c11`](https://sepolia.etherscan.io/tx/0x4164c074fbb0adacf3d3804928e2a4cc803d61e783e9fbbef207608fe3010c11)
- Recognised by the viewing key + recovered spending key verified in
  `npm run e2e:sepolia` (fresh derivations each run — addresses differ every time,
  which is the point).

## 10. Networks: Sepolia by default, guarded mainnet mode

The shipped/demo build writes **only on Sepolia**. A build compiled with
`VITE_ENABLE_MAINNET=true` unlocks **guarded mainnet mode**: mainnet writes
become possible but every one requires an explicit typed per-action
confirmation in the UI (you type `SEND ON MAINNET`). Both gates are required —
the build flag alone, or a confirmation alone, still blocks — enforced in
`assertWritableNetwork` and covered by `tests/mainnet-guard.test.ts`. Reads,
including the ENS record read, already work on mainnet through the Universal
Resolver.

## 11. Spending stealth funds without re-linking (relayers/paymasters)

Funds arrive on a fresh stealth EOA with no gas. Funding that gas from your
main wallet would re-link the address, so GhostName produces **client-side
sweep authorizations** a sponsor/relayer can execute while paying gas itself:

- **EIP-7702** sponsored sweep for native ETH (`signSweepAuthorization`).
- **EIP-3009** relayed transfer for USDC-style tokens (`signErc3009Sweep`).

`/receive` produces a signed EIP-7702 authorization for any recognised payment,
locally — the stealth key never leaves the device. Executing it needs a
deployed executor contract + a funded relayer (out of scope to provision here,
same as the Swarm stamp). Full design in [RELAYERS.md](RELAYERS.md).

## 12. Known limitations

- The relayer/executor infrastructure itself is not deployed (only the
  client-side signing is shipped and tested); a relayer also learns the
  destination address it sweeps to (metadata, not custody — see RELAYERS.md).
- Demo key custody is browser `localStorage` — fine for a testnet demo, not
  a production custody model.
- Announcement scanning uses bounded `eth_getLogs` ranges over public RPCs;
  a production scanner would use an indexer.
- Amounts and timing remain public (see threat model).

## 11. Optional integrations

- **Mobula public-exposure panel: ENABLED.** On `/scan`, after resolving a
  name, "Assemble public profile" queries the Mobula wallet-portfolio API for
  the conventional address and shows how much financial information a static
  ENS→wallet mapping leaks — token count and chain count immediately, total
  USD value only behind a deliberate reveal (projector-safe). Works keyless
  via Mobula's demo endpoint; set `VITE_MOBULA_PROXY_URL` to a minimal proxy
  that injects a production key server-side (the key never ships in the
  client). Reinforces the core story: this is the exposure GhostName removes
  from future payments.
- **Swarm encrypted recovery capsule: ENABLED.** `/create` can encrypt the
  local identity into a passphrase-locked capsule (AES-256-GCM + PBKDF2) that
  is safe to store on Swarm — no plaintext key material ever leaves the
  device (proven by `tests/capsule.test.ts`). Testnet only.
- **Swarm static deployment: scripted** (`scripts/swarm-deploy.mjs`,
  `SWARM.md`). Uploading `dist/` to Swarm needs a Bee node and a funded
  postage stamp (xBZZ), so it is a one-command step you run with your own /
  the venue booth's stamp rather than done automatically — GhostName's own
  safety rules keep the agent from spending assets on your behalf.

(Each is only claimed here if actually working; see commit history.)

See [SWARM.md](SWARM.md) for both.

## Standards

- [ERC-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [ERC-6538: Stealth Meta-Address Registry](https://eips.ethereum.org/EIPS/eip-6538)
- [ENS RFC: Privacy-Preserving Names](https://discuss.ens.domains/t/rfc-privacy-preserving-names-ensip-for-stealth-address-resolution/22354)

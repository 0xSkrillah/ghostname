# GhostName

**The open privacy-assurance layer for ENS.**

**Keep the ENS name. Break the payment graph.**

GhostName does three things for an ENS identity you already own: **audit,
upgrade, prove.**

- **Audit** any ENS name against the emerging ENS stealth-resolution convention.
- **Upgrade** an existing identity in place, with no service-owned subdomain and
  no new wallet provider to trust.
- **Prove** the whole lifecycle, from local address derivation through sponsored
  withdrawal, with evidence anyone can re-check.

## Why GhostName is not another stealth wallet

Stealth payments are becoming a stack, and most projects sit at the account
layer. GhostName sits at the assurance layer.

- **Fluidkey** and **Cloaked** operate account and wallet infrastructure.
- **Umbra** implements the core stealth-payment standard.
- **Sneaky** combines ENS resolution with a privacy-pool exit.
- **GhostName** is the open conformance, migration and lifecycle-assurance layer
  for ENS identities users already own. It custodies nothing and issues nothing.

What that buys you in practice: it always derives addresses in the sender
client, so no gateway learns the destination; it makes resolver, record and
withdrawal trust assumptions visible instead of implicit; and it exports
evidence you can inspect independently, including a sponsored exit that is
verified from chain data rather than asserted.

No claim is made to being first, only, or most private. See
[COMPETITIVE_MOAT.md](COMPETITIVE_MOAT.md).

Common S3nse Amsterdam 2026 hackathon entry. GhostName gives an established
ENS identity **forward privacy**: keep the human-readable name, publish one
ERC-5564 stealth meta-address record, and every future sender derives a
fresh one-time receiving address, locally, with no gateway.

## 1. The problem

An established ENS name is a great identity, and a privacy
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

- Historical blockchain activity: nothing can delete it.
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

The recipient generates two secp256k1 keypairs locally, spending and
viewing, and publishes their compressed public keys as a stealth
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
address, and, for their own payments, recovers the controlling key
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

- `src/crypto/`: pure, local ERC-5564 scheme-1 core on
  [@noble/curves](https://github.com/paulmillr/noble-curves) (audited
  primitives; we compose, never hand-roll curve math). No network, no
  storage, no logging. `identityBackup.ts` validates imported backups by
  shape and range and re-derives the public material.
- `src/ens/`: ENS resolution (mainnet and Sepolia) and the guarded
  `setText` publish path.
- `src/chain/`: viem clients with RPC fallback, the announcer integration,
  bounded scanning/recognition, chain-bound payment plans, and the network
  guards.
- `src/audit/`, `src/relay/`: GhostCheck and the live proof verifiers.
- `src/lib/`, `src/security/`: secret-free error text, strict amount
  parsing, and the production Content-Security-Policy.
- `src/pages/`: Vite/React UI: `/scan /create /pay /receive /privacy /demo`.

**Key handling:** private keys are generated with a CSPRNG in the browser,
used locally, and kept in `localStorage` for the demo scanner (a testnet
custody model, stated in the UI). They are never transmitted, logged or
analysed; error text is scrubbed of URLs and key-shaped values before it is
shown or exported. Backups can be plaintext JSON (validated on import) or a
passphrase-encrypted capsule (PBKDF2-SHA256, 600k iterations, AES-256-GCM
with a header-bound tag) that the app can also restore. There is no backend.

**Network safety:** the shipped build writes only to Sepolia (11155111).
Every write path calls `assertWritableNetwork` against both the intended
chain and the wallet's actually-reported chain before the wallet is touched,
and a payment plan can only be paid on the chain its record was resolved on.
A build compiled with `VITE_ENABLE_MAINNET=true` unlocks guarded mainnet
mode, where every mainnet write additionally needs a typed confirmation that
is consumed by each attempt (section 10). Covered by tests.

## 6. Live demo

The `/demo` route runs the 90-second sequence with live calls only, inputs
are pre-filled, outputs never are. See [DEMO.md](DEMO.md).

## 7. Local reproduction

```bash
git clone https://github.com/0xSkrillah/ghostname
cd ghostname
npm ci            # Node 20 or newer; installs exactly the lockfile
npm test          # deterministic suite, no network needed
npm run dev       # http://localhost:5173
```

Optional:

```bash
# live read-only checks: Sepolia proofs, plus mainnet ENS for a name you choose
RUN_LIVE=1 LIVE_MAINNET_ENS_NAME=name.eth npm test -- live.ens
npm run build         # typecheck + production build with CSP and build commit
```

Copy `.env.example` to `.env` to pin your own RPC endpoints and demo
pre-fills (recommended for presentations). Every `VITE_*` value is inlined
into the public bundle, so use keyless RPC URLs or keys restricted to your
origin; never put a personal ENS name or an API key in a committed file.

## 8. Tests

- `tests/stealth.test.ts`: key generation, derivation determinism &
  freshness, positive/negative recognition (incl. 50 random wrong viewing
  keys), spending-key recovery, malformed inputs.
- `tests/metaAddress.test.ts`: record encoding/parsing/validation.
- `tests/interop.test.ts`: byte-level cross-verification against the
  ScopeLift `stealth-address-sdk` (dev-only oracle) + frozen known-answer
  vector.
- `tests/ens.test.ts`: resolution, record read, publish path, and the
  mainnet-write-blocked negatives.
- `tests/announcer.test.ts`: EIP-5564 metadata layout, scanning,
  recognition among noise, guarded payment flow, offline end-to-end.
- `tests/mainnet-guard.test.ts`, `tests/inputGuards.test.ts`: the double
  gate, chain-bound plans, amount and scan-range guards, announcement
  recovery.
- `tests/audit.test.ts`, `tests/proof.test.ts`, `tests/paymentProof.test.ts`,
  `tests/evidence.test.ts`: GhostCheck precedence and honesty, and the live
  proof verifiers refusing look-alike data.
- `tests/sweep*.test.ts`: destination-bound package, tamper rejection,
  high-s and chain-agnostic rejection, fresh replay nonces.
- `tests/identityBackup.test.ts`, `tests/capsule.test.ts`,
  `tests/describeError.test.ts`, `tests/mobula.test.ts`: untrusted input
  and secret handling.
- `tests/no-personal-name.test.ts`, `tests/csp.test.ts`: release guards.
- `tests/live.ens.test.ts`: gated (`RUN_LIVE=1`, `LIVE_MAINNET_ENS_NAME`)
  read-only checks.

## 9. Contracts and networks

| Thing | Network | Address / value |
|---|---|---|
| ERC-5564 announcer (singleton) | mainnet + Sepolia | `0x55649E01B5Df198D18D95b5cc5051630cfD45564` |
| ERC-6538 registry (singleton, not required by the flow) | mainnet + Sepolia | `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538` |
| ENS Universal Resolver (resolution + resolver discovery) | mainnet + Sepolia | `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` |
| ENS text record key | - | `stealth-meta-address[1]` |
| Record value | - | `st:eth:0x…` string, verbatim |
| Writes permitted | **Sepolia** (11155111) by default | mainnet only in an opt-in build, behind a typed per-action confirmation |

**Sepolia ENSv2 note:** Sepolia is mid-migration to ENSv2, and the classic
ETHRegistrarController rejects new registrations. The demo identity
`ghostname-3c7714.eth` was registered through the live ENSv2 `ETHRegistrar`
(`0xa88553F454b77203B0D036A05c894d555EAAa2Cc`, paid in freely-mintable test
USDC) with a dedicated resolver deployed via the ENS `VerifiableFactory` -
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
  `npm run e2e:sepolia` (fresh derivations each run, addresses differ every time,
  which is the point).

## 10. Networks: Sepolia by default, guarded mainnet mode

The shipped/demo build writes **only on Sepolia**. A build compiled with
`VITE_ENABLE_MAINNET=true` unlocks **guarded mainnet mode**: mainnet writes
become possible but every one requires an explicit typed per-action
confirmation in the UI (you type `SEND ON MAINNET`). Both gates are required -
the build flag alone, or a confirmation alone, still blocks, enforced in
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
locally, the stealth key never leaves the device.

**Both halves of the evidence are verified live, not asserted.** `/receive` and
`/demo` re-derive every claim from chain data, with only transaction hashes
configured. The payment proof includes the binding check that the ERC-5564
announcement names the same address the payment actually funded; without that,
an announcement is just an unrelated log. Recognition itself is listed as *not*
proven there, because deciding a payment is yours requires the private viewing
key, which never leaves the recipient device.

**Proven live on Sepolia:** the executor (`contracts/StealthSweepExecutor.sol`,
an **unaudited testnet demo contract**) is deployed at
`0x94E4C39055fa4a5fCd47E03CbcbCD0503848806b`, and a stealth EOA was swept to a
clean destination by a **sponsored type-4 (EIP-7702) transaction** whose gas
was paid by the sponsor. The transaction the app verifies live is
[`0x75a9da4e…89c25`](https://sepolia.etherscan.io/tx/0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25),
built entirely from the sweep package; an earlier run of the same mechanism is
[`0x412cca80…efedc0`](https://sepolia.etherscan.io/tx/0x412cca80d621d5d58a38ef190c6a8c323d18adb1be3488f29868d1b4b2efedc0).
Reproduce with `npm run sweep:sepolia`. Full design in [RELAYERS.md](RELAYERS.md).

## 12. Known limitations

- No production relayer is operated. The Sepolia executor is an unaudited
  testnet demo contract and the demo sponsor is a throwaway wallet; a relayer
  also learns the destination address it sweeps to (metadata, not custody,
  see RELAYERS.md).
- Demo key custody is browser `localStorage`: fine for a testnet demo, not
  a production custody model. The app scans and sweeps only on Sepolia.
- Announcement scanning uses bounded, chunked `eth_getLogs` ranges over
  public RPCs; a production scanner would use an indexer. RPC endpoints
  learn which names and addresses you look at; names with offchain
  (CCIP-read) resolvers make the browser contact that resolver's gateway.
- Announced amounts are sender-declared; the app shows the on-chain balance
  as the authoritative figure.
- Resolver provenance (direct versus inherited or wildcard) is reported as
  unknown; the ENS stealth-resolution RFC is still evolving.
- Amounts, sender identity and timing remain public (see threat model).

## 13. Optional integrations

- **Mobula public-exposure panel: ENABLED.** On `/scan`, after resolving a
  name, "Assemble public profile" queries the Mobula wallet-portfolio API for
  the conventional address and shows how much financial information a static
  ENS→wallet mapping leaks, token count and chain count immediately, total
  USD value only behind a deliberate reveal (projector-safe). Works keyless
  via Mobula's demo endpoint; set `VITE_MOBULA_PROXY_URL` to a minimal proxy
  that injects a production key server-side (the key never ships in the
  client). Reinforces the core story: this is the exposure GhostName removes
  from future payments.
- **Swarm encrypted recovery capsule: ENABLED.** `/create` can encrypt the
  local identity into a passphrase-locked capsule (AES-256-GCM, PBKDF2-SHA256
  at 600k iterations, header bound into the tag) that is safe to store on
  Swarm, and restore it again; no plaintext key material ever leaves the
  device (proven by `tests/capsule.test.ts`). Testnet only.
- **Swarm static deployment: scripted** (`scripts/swarm-deploy.mjs`,
  `SWARM.md`). Uploading `dist/` to Swarm needs a Bee node and a funded
  postage stamp (xBZZ), so it is a one-command step you run with your own /
  the venue booth's stamp rather than done automatically, GhostName's own
  safety rules keep the agent from spending assets on your behalf.

(Each is only claimed here if actually working; see commit history.)

See [SWARM.md](SWARM.md) for both.

## 14. Standards

- [ERC-5564: Stealth Addresses](https://eips.ethereum.org/EIPS/eip-5564)
- [ERC-6538: Stealth Meta-Address Registry](https://eips.ethereum.org/EIPS/eip-6538)
- [ENS RFC: Privacy-Preserving Names](https://discuss.ens.domains/t/rfc-privacy-preserving-names-ensip-for-stealth-address-resolution/22354)

# GhostName: Build Status

Single source of truth for build state. Every figure here was verified against
the repository, not carried over from an earlier draft.

Last reconciled: 2026-09-05, after Phase 1 (GhostCheck audit).

## Product position

GhostName is the open privacy-assurance layer for ENS: **audit, upgrade, prove**.

- **Audit** any ENS name against the emerging ENS stealth-resolution convention.
- **Upgrade** an existing ENS identity in place, with no service-owned subdomain.
- **Prove** the whole lifecycle, from local derivation to sponsored withdrawal.

Tagline unchanged: *Keep the ENS name. Break the payment graph.*

## Verified commands

| Command | Status | Result |
|---|---|---|
| `npm run typecheck` | PASS | no errors |
| `npm test` | PASS | 132 passed, 5 skipped (14 files) |
| `npm run build` | PASS | app shell ~230 kB, viem chunk ~334 kB |
| `npm run e2e:sepolia` | PASS | gated on `SEPOLIA_PRIVATE_KEY` |
| `npm run sweep:sepolia` | PASS | gated on `SEPOLIA_PRIVATE_KEY` |

Skipped tests are the network-gated live suites, which run only when a funded
testnet key is present.

## Deployment and repository

- Repository: https://github.com/0xSkrillah/ghostname (public)
- Deployed app: https://0xskrillah.github.io/ghostname/ (gh-pages branch)
- Routes: `/` `/scan` `/create` `/pay` `/receive` `/privacy` `/demo` (hash router,
  so every route deep-links on a static host)

## Networks and keys

- Mainnet: **read only** by default. Guarded write mode exists behind
  `VITE_ENABLE_MAINNET=true` **and** a typed per-action confirmation. Off in the
  shipped build. Covered by `tests/mainnet-guard.test.ts`.
- Sepolia: all demo writes.
- `skrillah.eth` is read-only mainnet demo input and is never modified.
- Demo signing key is a throwaway testnet key in gitignored `.env`.

## Live on-chain evidence (Sepolia)

- Demo identity: **ghostname-3c7714.eth** (ENSv2), resolver
  `0xE0e6F09B30eBcdE505FDCA0F1fd244273838FFAE`
- ERC-5564 announcer: `0x55649E01B5Df198D18D95b5cc5051630cfD45564`
- ERC-6538 registry: `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538`
- Sweep executor: `0x94E4C39055fa4a5fCd47E03CbcbCD0503848806b`
- Record publish: `0x75b7a6404a5a3b1880f8dce7c874cbf34ce65fca64cffeb7e313567b2759ea29`
- Stealth payment: `0x2430f7f8a422a6a527272cd591541c101e9fffd43dccb2a1feed918ee0dc248b`
- Announcement: `0x4164c074fbb0adacf3d3804928e2a4cc803d61e783e9fbbef207608fe3010c11`
- Sponsored EIP-7702 sweep, built entirely from the sweep package:
  `0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25`
- Announcement scan start block: `11612900`

## Sepolia ENSv2 note

Classic ENS registration is broken network-wide on Sepolia during the ENSv2
migration. Names register through the ENSv2 `ETHRegistrar`
`0xa88553F454b77203B0D036A05c894d555EAAa2Cc`, paid in freely mintable test USDC
`0x768F42455A2D082E23ceeF7d51e5787C82d67a39`, with a resolver deployed via
`VerifiableFactory` `0x10dC6333CDFe1FCEf624c6e0a8221b91804Cd7ef`
(impl `0x9EAe5C2730a7dD16BDD1DeE6421a1B91e3B0365e`, init selector `0x7058b559` =
`initialize(address,uint256,bytes[])`). Automated in
`scripts/register-v2-name.mjs`. App reads and writes go through the Universal
Resolver, so they work on both ENS v1 and v2.

## What works

- **ERC-5564 scheme-1 core** (`src/crypto/`): key generation, derivation with
  fresh ephemeral randomness, view-tag recognition, spending-key recovery.
  Byte-identical to the ScopeLift reference SDK, with a frozen known-answer
  vector.
- **ENS layer** (`src/ens/`): normalization, conventional resolution, stealth
  record read, Sepolia-guarded `setText` publish via the Universal Resolver.
- **Chain layer** (`src/chain/`): announcer integration, bounded-range scanning,
  viewing-key recognition, network write guards.
- **GhostCheck audit** (`src/audit/`): versioned privacy-readiness report for
  arbitrary names, chain-specific then default record precedence, malformed and
  conflicting record detection, three local derivation trials, explicit unknowns,
  JSON and summary export. No numeric score anywhere.
- **Sweep package** (`src/relay/sweep.ts`): complete destination-bound package
  carrying both required signatures plus executor calldata, with an independent
  verifier. Proven executable on-chain.
- **UI**: `/scan` audit, `/create` identity and record publish, `/pay`, `/receive`
  scan with sweep package, `/privacy` threat model, `/demo`.
- **Mobula exposure panel** and **encrypted testnet recovery capsule**.

## Known limitations, stated honestly

- Resolver provenance (direct versus inherited or wildcard) is reported as
  **unknown**. Proving it needs registry evidence that is not uniformly
  available across ENS v1 and v2. Never guessed.
- The sweep executor is an unaudited testnet demo contract.
- No production relayer is operated. The demo sponsor is the throwaway wallet.
- The ENS stealth-resolution RFC is still evolving, so record conventions are
  implemented as the current proposal, not a ratified requirement.
- Scanning uses bounded `eth_getLogs` over public RPCs rather than an indexer.
- Amounts, sender identity, timing and history remain public. GhostName is
  forward privacy only.

## Phase log

- **Phase 0 (done):** complete destination-bound sweep package. Fixed a real
  defect where only the EIP-7702 delegation was emitted, which was both
  non-executable and misleading about destination binding. 18 tests.
- **Phase 1 (done):** GhostCheck ENS privacy conformance audit. 22 tests.

## Next action

Phase 2: verify the live sponsored exit from public chain data via RPC, then
Phase 3 (single guided demo route) and Phase 4 (competitive positioning docs).

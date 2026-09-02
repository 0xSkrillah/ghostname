# GhostName: Architecture

```
┌─────────────────────────── browser (no backend) ───────────────────────────┐
│                                                                            │
│  pages/            state/               crypto/  (pure, local)             │
│  ┌─────────┐       ┌──────────────┐     ┌──────────────────────────┐       │
│  │ /scan   │       │ identity     │     │ stealth.ts               │       │
│  │ /create │──────▶│ (localStorage│────▶│  generateStealthKeys     │       │
│  │ /pay    │       │  demo keys)  │     │  generateStealthAddress  │       │
│  │ /receive│       │ wallet       │     │  checkStealthAddress     │       │
│  │ /privacy│       │ (EIP-1193,   │     │  computeStealthPrivateKey│       │
│  │ /demo   │       │  Sepolia)    │     │ metaAddress.ts (encode/  │       │
│  └────┬────┘       └──────┬───────┘     │  parse/validate st:eth:) │       │
│       │                   │             └──────────┬───────────────┘       │
│       ▼                   ▼                        │ @noble/curves         │
│  ens/resolve.ts      chain/guards.ts               │ (audited secp256k1)   │
│  ens/write.ts        chain/payment.ts              ▼                       │
│  (text records)      chain/announcer.ts      keccak256 (viem)              │
│       │                   │                                                │
└───────┼───────────────────┼────────────────────────────────────────────────┘
        │ reads             │ writes (Sepolia by default, assertWritableNetwork;
        ▼                   ▼  mainnet only in an opt-in build + typed confirmation)
  Ethereum mainnet     Sepolia: ENS resolver setText,
  (ENS reads)          ETH transfer, ERC-5564 announcer 0x5564…5564
```

## Assurance layers

Three modules exist purely to make claims checkable rather than asserted, which
is what "privacy-assurance layer" means in practice.

- `src/audit/` (**GhostCheck**): a versioned, structured privacy-readiness report
  for any ENS name. `records.ts` holds the record keys and precedence, where the
  ENSIP-11 coin type is `0x80000000 | chainId`, the chain-specific key is tried
  before the all-chain default, and the legacy mainnet coinType 60 key is probed
  last and marked non-normative so it can never win. `auditEnsName.ts`
  orchestrates resolution, validation and three local derivation trials.
  Standards status is labelled at the point of use: the record convention is a
  current RFC proposal, ENSIP-11 is an existing requirement, and ERC-6538
  lookups are experimental diagnostics.
- `src/relay/sweep.ts`: the sweep package. A sponsored sweep needs **two**
  signatures, and only the second one binds the destination. See RELAYERS.md.
- `src/relay/proof.ts`: re-derives every claim about the published sponsored
  exit from chain data. Only a transaction hash is configured, so stale evidence
  fails a check instead of producing a false green.

## Modules

### `src/crypto`: the core (no imports from chain/ens/UI)

- `metaAddress.ts`: `st:eth:0x…` encode/parse/validate. Enforces
  compressed SEC1 keys on the curve; accepts the 66-byte and single-key
  33-byte forms of EIP-5564.
- `stealth.ts`: scheme 1 composition on `@noble/curves` +
  viem `keccak256`:
  - shared secret hash = keccak256 of the **33-byte compressed** shared
    point (matches reference implementations; proven byte-identical to the
    ScopeLift SDK in `tests/interop.test.ts`);
  - view tag = first hash byte;
  - sender: `P_stealth = P_spend + s_h·G`;
  - recipient check: view-tag fast path, then full address comparison -
    returns `false` on any garbage rather than throwing;
  - recovery: `p_stealth = (p_spend + s_h) mod n`.
  - Fresh CSPRNG ephemeral key per derivation (`crypto.getRandomValues`
    via noble); an explicit ephemeral key is accepted only for tests.

### `src/ens`

- `resolve.ts`: ENSIP-15 normalization; conventional `addr` resolution;
  `stealth-meta-address[1]` text-record resolution returning
  `none | invalid | ok` (payment path refuses to fall back silently).
- `write.ts`: resolver lookup via the ENS registry, then `setText` with
  the RFC key and the verbatim meta-address string. Double network guard.

### `src/chain`

- `clients.ts`: viem public clients for mainnet and Sepolia with RPC
  fallback chains (env-configurable). No wallet client is ever created here.
- `guards.ts`: `assertWritableNetwork`: Sepolia 11155111 always; mainnet
  only when the build sets `VITE_ENABLE_MAINNET=true` **and** the call
  carries a per-action confirmation. Either alone blocks.
- `announcer.ts`: EIP-5564 singleton ABI; native-ETH metadata
  (`viewTag ‖ 0xeeeeeeee ‖ 0xEeee…EEeE ‖ amount`) parsed positionally;
  bounded, chunked `getLogs` scanning with a validated start block; sync and
  yielding viewing-key recognition.
- `payment.ts`: `planStealthPayment` (read-only resolve + fresh derivation,
  bound to the chain it resolved on) and `executeStealthPayment` (ETH
  transfer + announce). A failed announcement surfaces the payment hash and
  the full derivation so `announceStealthPayment` can retry it.

### `src/lib`, `src/security`, `src/swarm`

- `lib/describeError.ts`: the only way error text reaches the UI or an
  export: viem short messages, URLs and 32-byte hex values redacted.
- `lib/amount.ts`: strict ETH amount parsing for user input.
- `security/csp.ts`: the production Content-Security-Policy, injected into
  `dist/index.html` at build time together with the build commit.
- `swarm/capsule.ts`: passphrase-encrypted testnet recovery capsule
  (PBKDF2-SHA256 600k, AES-256-GCM, header bound into the tag), with strict
  header validation on restore.

### Dependency decision

The ERC-5564 layer is implemented here directly on audited `@noble/curves`
primitives rather than depending on the beta `@scopelift/stealth-address-sdk`
at runtime. The SDK (a year without release, 1.0.0-beta) is used as a
**dev-only interop oracle**: tests prove our sender derivation, mutual
recognition and key recovery are byte-identical. During this work we found
the SDK silently mis-derives when the ephemeral key is passed as a hex
string instead of bytes, documented in `tests/interop.test.ts`, and a good
argument for owning these ~200 lines with our own test coverage.

## Testing strategy

Deterministic suite (no network): crypto positive/negative/round-trip,
interop (including SDK announcements with altered view tags), ENS + write
guards with structural fakes, announcement layout and offline end-to-end,
chain-bound plans and announcement recovery, proof verifiers refusing
look-alike data, sweep-package tampering, identity-backup and capsule
validation, secret-free error text, the CSP, and a release guard that fails
if any non-allowlisted ENS name appears in source, docs or `dist/`. Live
suite (`RUN_LIVE=1`, plus `LIVE_MAINNET_ENS_NAME` for the mainnet checks):
read-only Sepolia proof verification and mainnet ENS resolution.
Wallet-driven paths (record publish, payment) run against Sepolia through
the UI; the offline end-to-end test mirrors them exactly.

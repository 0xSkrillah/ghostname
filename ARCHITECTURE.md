# GhostName — Architecture

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
        │ reads             │ writes (Sepolia ONLY — assertWritableNetwork)
        ▼                   ▼
  Ethereum mainnet     Sepolia: ENS resolver setText,
  (ENS, READ-ONLY)     ETH transfer, ERC-5564 announcer 0x5564…5564
```

## Modules

### `src/crypto` — the core (no imports from chain/ens/UI)

- `metaAddress.ts` — `st:eth:0x…` encode/parse/validate. Enforces
  compressed SEC1 keys on the curve; accepts the 66-byte and single-key
  33-byte forms of EIP-5564.
- `stealth.ts` — scheme 1 composition on `@noble/curves` +
  viem `keccak256`:
  - shared secret hash = keccak256 of the **33-byte compressed** shared
    point (matches reference implementations; proven byte-identical to the
    ScopeLift SDK in `tests/interop.test.ts`);
  - view tag = first hash byte;
  - sender: `P_stealth = P_spend + s_h·G`;
  - recipient check: view-tag fast path, then full address comparison —
    returns `false` on any garbage rather than throwing;
  - recovery: `p_stealth = (p_spend + s_h) mod n`.
  - Fresh CSPRNG ephemeral key per derivation (`crypto.getRandomValues`
    via noble); an explicit ephemeral key is accepted only for tests.

### `src/ens`

- `resolve.ts` — ENSIP-15 normalization; conventional `addr` resolution;
  `stealth-meta-address[1]` text-record resolution returning
  `none | invalid | ok` (payment path refuses to fall back silently).
- `write.ts` — resolver lookup via the ENS registry, then `setText` with
  the RFC key and the verbatim meta-address string. Double network guard.

### `src/chain`

- `clients.ts` — viem public clients; mainnet client is read-only by
  construction; RPC fallback chains (env-configurable).
- `guards.ts` — `assertWritableNetwork`: writes only on Sepolia 11155111.
- `announcer.ts` — EIP-5564 singleton ABI; native-ETH metadata
  (`viewTag ‖ 0xeeeeeeee ‖ 0xEeee…EEeE ‖ amount`); bounded `getLogs`
  scanning; viewing-key recognition filter.
- `payment.ts` — `planStealthPayment` (read-only resolve + fresh
  derivation) and `executeStealthPayment` (ETH transfer + announce).

### Dependency decision

The ERC-5564 layer is implemented here directly on audited `@noble/curves`
primitives rather than depending on the beta `@scopelift/stealth-address-sdk`
at runtime. The SDK (a year without release, 1.0.0-beta) is used as a
**dev-only interop oracle**: tests prove our sender derivation, mutual
recognition and key recovery are byte-identical. During this work we found
the SDK silently mis-derives when the ephemeral key is passed as a hex
string instead of bytes — documented in `tests/interop.test.ts`, and a good
argument for owning these ~200 lines with our own test coverage.

## Testing strategy

Deterministic suite (no network): crypto positive/negative/round-trip,
interop, ENS + write guards with structural fakes, announcement layout and
offline end-to-end. Live suite (`RUN_LIVE=1`): read-only mainnet ENS
resolution. Wallet-driven paths (record publish, payment) run against
Sepolia through the UI; the offline end-to-end test mirrors them exactly.

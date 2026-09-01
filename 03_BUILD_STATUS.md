# GhostName — Build Status

Claude must update this file after every milestone, meaningful failure,
deployment, contract/configuration change, and before ending a work period.

## Project state

- Current milestone: M0 COMPLETE — cryptographic core proven. Next: M1 (ENS).
- Current branch: main
- Latest working commit: (see `git log` — M0 crypto core)
- Local app command: `npm run dev`
- Typecheck command/status: `npm run typecheck` — PASS
- Test command/status: `npm test` — PASS (30/30, 3 files)
- Production build command/status: `npm run build` — PASS
- Deployment URL: none yet
- Demo route: not built yet (M3)
- Mainnet mode: READ ONLY
- Sepolia test ENS name/subname: not configured yet (M1)
- Sepolia test wallets funded: not yet
- RPC endpoints configured: `.env.example` defaults (public RPCs); override via `VITE_MAINNET_RPC_URL` / `VITE_SEPOLIA_RPC_URL`
- ERC-5564 announcer: `0x55649E01B5Df198D18D95b5cc5051630cfD45564` (singleton, per EIP-5564)
- ERC-6538 registry: `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538` (singleton, per EIP-6538)
- ENS record key: `stealth-meta-address[1]`, value `st:eth:0x<spend33><view33>` verbatim (per ENS stealth-resolution RFC)
- Mobula enabled: NO
- Swarm enabled: NO

## What currently works

- ERC-5564 scheme-1 core in `src/crypto/stealth.ts` (pure, local, no network):
  - `generateStealthKeys` — CSPRNG spending/viewing keypairs + `st:eth:0x...` meta-address.
  - `generateStealthAddress` — fresh ephemeral key per call, keccak256 over the
    33-byte compressed shared-secret point, view tag = first hash byte.
  - `checkStealthAddress` — view-tag fast path + full address check; never throws on garbage.
  - `computeStealthPrivateKey` — `(p_spend + s_h) mod n`.
- Meta-address encode/parse/validate in `src/crypto/metaAddress.ts` (66-byte and
  33-byte forms, `st:eth:` prefix handling, curve validation).
- Tests (Vitest, `tests/`): 30 passing —
  - positive recognition (with and without view tag);
  - negative: unrelated viewing key ×50, wrong view tag, garbage announcement;
  - distinctness: two derivations differ; 10 rounds all distinct; fresh randomness per call;
  - recovery: derived stealth private key controls the destination (×10);
  - malformed meta-addresses rejected (10 cases);
  - INTEROP: byte-identical to `@scopelift/stealth-address-sdk` (dev-only oracle)
    for sender derivation, mutual recognition, and key recovery; frozen
    known-answer vector `0x387bf2cf77227941fff3aabdcce9e02edeef0a38`.

## What does not work

- No ENS layer yet (M1), no chain layer (M2), no UI (M3).

## Security/privacy checks

- [x] No private key appears in source, logs, analytics or network requests (crypto core is pure/local).
- [x] `skrillah.eth` is read only (no chain writes exist at all yet).
- [x] Mainnet writes are blocked (no write code exists yet; guards land in M1).
- [x] New ephemeral randomness is generated for every derivation (tested, 10-round distinctness).
- [x] Wrong viewing-key negative test passes (×50).
- [ ] Threat-model claims match implementation (UI pending, M3).

## Acceptance checklist

- [ ] Arbitrary ENS resolution. (M1)
- [x] Scheme-1 keypair/meta-address generation.
- [ ] ENS stealth record read. (M1)
- [ ] Controlled Sepolia ENS write. (M1)
- [x] Two distinct stealth destinations.
- [x] Positive recognition test.
- [x] Negative recognition test.
- [x] Spending-key/address verification.
- [ ] Real Sepolia payment. (M2)
- [ ] Announcement discovery. (M2)
- [x] Clean typecheck.
- [x] Clean tests.
- [x] Clean production build.
- [ ] README reproduction verified. (M5)
- [ ] Backup demo recorded. (M5)

## Decisions made

| Date/time | Decision | Reason | Evidence/test |
|---|---|---|---|
| 2026-09-01 | Implement scheme-1 core on `@noble/curves` directly; use `@scopelift/stealth-address-sdk` as dev-only test oracle | SDK is 1.0.0-beta, ~1 year stale; noble is audited and current; scheme-1 layer is thin composition | `tests/interop.test.ts` proves byte-compatibility |
| 2026-09-01 | Hash convention: keccak256 over 33-byte COMPRESSED shared-secret point | Matches EIP-5564 reference implementations | interop tests pass |
| 2026-09-01 | No wagmi; viem wallet client directly | Fewer moving parts for a hackathon | — |
| 2026-09-01 | SDK quirk found: hex-string ephemeral key input silently mis-derives | Pass bytes to SDK in tests; our impl accepts both safely | frozen vector test |
| 2026-09-01 | Vitest `server.deps.inline` for the SDK | Its dist uses bundler-style directory imports | test suite runs |

## Known risks/blockers

| Priority | Risk/blocker | Current mitigation | Owner/next check |
|---|---|---|---|
| P0 | Sepolia ENS name needed for record write demo | User owns skrillah.eth (mainnet, read-only); need a Sepolia test name — register one via ENS Sepolia app in M1 | M1 |
| P0 | Sepolia ETH needed for payment demo | Ask user / faucet before M2 | M2 |
| P1 | Public RPC reliability during demo | `.env` overrides + fallback list; test on venue Wi-Fi | M5 |

## Last verification

```text
2026-09-01 ~14:39 local
npm run typecheck  -> PASS (tsc --noEmit, no output)
npm test           -> PASS: 30 passed (30) — metaAddress 7, stealth 18, interop 5
npm run build      -> PASS: vite 7.3.6, dist/assets/index-*.js 193.38 kB (gzip 60.73)
```

## Next action

M1: build `src/ens/` — resolve conventional address + `stealth-meta-address[1]`
text record for arbitrary ENS names (mainnet + Sepolia read), and the Sepolia
record-write path (wallet setText with hard network guard). Add tests with a
mocked viem client; verify live reads against mainnet ENS.

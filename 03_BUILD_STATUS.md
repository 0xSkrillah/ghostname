# GhostName: Build Status

Single source of truth for build state. Every figure here was verified against
the repository, not carried over from an earlier draft.

Last reconciled: 2026-09-01, after Agent P1 (CLI, Claude skill, secure web handoff).
An earlier draft carried a reconciliation date of 2026-09-05, which is later
than every commit in the history; it was a typo and has been corrected.

## Product position

GhostName is the open privacy-assurance layer for ENS: **audit, upgrade, prove**,
and it is now accessible to AI agents as a local-first, read-only privacy adviser.

- **Audit** any ENS name against the emerging ENS stealth-resolution convention.
- **Upgrade** an existing ENS identity in place, with no service-owned subdomain.
- **Prove** the whole lifecycle, from local derivation to sponsored withdrawal.

Agent promise: ask your AI agent to audit any ENS name, explain its privacy
leaks and guide you through a human-signed upgrade, without the agent ever
seeing your keys. GhostName is not, and will not become, an autonomous wallet.

Tagline unchanged: *Keep the ENS name. Break the payment graph.*

## Verified commands

| Command | Status | Result |
|---|---|---|
| `npm run typecheck` | PASS | no errors |
| `npm test` | PASS | 213 passed, 10 skipped (23 files) |
| `npm run build` | PASS | app shell ~267 kB, viem chunk ~334 kB |
| `npm run build:agent` | PASS | `dist-agent/ghostname-mcp.mjs` and `dist-agent/ghostname.mjs` (esbuild, deps external) |
| `npm run e2e:sepolia` | PASS | gated on `SEPOLIA_PRIVATE_KEY` |
| `npm run sweep:sepolia` | PASS | gated on `SEPOLIA_PRIVATE_KEY` |

Skipped tests are the network-gated live suites. Without `SEPOLIA_PRIVATE_KEY`
ten are skipped; with it, eight (the two funded live tests then run). The
earlier "155 passed, 8 skipped" figure was measured with the key present.

## Deployment and repository

- Repository: https://github.com/0xSkrillah/ghostname (public)
- Deployed app: https://0xskrillah.github.io/ghostname/ (gh-pages branch)
- Routes: `/` `/scan` `/create` `/pay` `/receive` `/privacy` `/demo` (hash router,
  so every route deep-links on a static host)
- Local MCP server: `npm run build:agent && npm run mcp` (stdio)
- CLI: `node dist-agent/ghostname.mjs audit <name> --chain <id> [--json]`

## Networks and keys

- Mainnet: **read only** by default. Guarded write mode exists behind
  `VITE_ENABLE_MAINNET=true` **and** a typed per-action confirmation. Off in the
  shipped build. Covered by `tests/mainnet-guard.test.ts`.
- Sepolia: all demo writes.
- `skrillah.eth` is read-only mainnet demo input and is never modified.
- Demo signing key is a throwaway testnet key in gitignored `.env`.
- The agent layer (MCP, CLI) reaches only chain 1 and 11155111 through
  server-configured RPC (`GHOSTNAME_MAINNET_RPC_URL`, `GHOSTNAME_SEPOLIA_RPC_URL`,
  or the `VITE_*` aliases). No tool accepts an RPC URL.

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
  JSON and summary export. No numeric score anywhere. Now also carries an
  additive `diagnostics` block (name invalid, address resolution failed, record
  read failures) for programmatic consumers.
- **Sweep package** (`src/relay/sweep.ts`): complete destination-bound package
  carrying both required signatures plus executor calldata, with an independent
  verifier. Proven executable on-chain. The executor ABI and EIP-712 constants
  now live in `src/relay/sweepTypes.ts` so read-only verifiers never import the
  signing path.
- **Agent service layer** (`src/agent/`): deterministic, transport-free adapter
  over GhostCheck and the two evidence verifiers. Versioned `AgentPrivacyReport`
  (schema 1) with stable finding codes, recommended actions with human-action
  flags, sanitised strings, no sample derivation addresses, no record values
  outside a labelled technical-evidence block, a content-derived `reportId`
  (SHA-256 over canonical JSON), and a secure handoff URL that can carry only
  five non-secret parameters. Any RPC failure yields status unknown.
- **Local MCP server** (`mcp/`): official TypeScript SDK v2
  (`@modelcontextprotocol/server` 2.0.0, spec 2026-07-28, legacy `initialize`
  handshake still negotiated for current hosts). Five read-only tools with zod
  input and output schemas, `structuredContent`, concise text fallback and
  read-only annotations; five `ghostname://` resources; the `improve-ens-privacy`
  prompt. stdio entry emits only MCP messages on stdout, diagnostics on stderr.
- **CLI** (`cli/`): `audit`, `plan`, `verify-payment`, `verify-exit`, calling
  the same service functions as the MCP tools and emitting the same schema
  versions. Verified live: `audit skrillah.eth --chain 1` reads Incomplete;
  `verify-payment` passes all eight checks on the published Sepolia evidence.
- **Claude Agent Skill** (`.claude/skills/ens-privacy-advisor/`): SKILL.md with
  trigger description and standing rules, privacy-model.md, examples.md covering
  an incomplete name, a malformed record, a private-ready name, an RPC failure
  and a user asking the agent to write the record itself.
- **Secure web handoff** (`/create`): accepts only name, chainId, source=agent,
  reportId and version; states that key generation happens outside the agent;
  ignores any other parameter by name (an audit status in the URL is listed as
  ignored); resolves the name again live; discovers the resolver at transaction
  time; keeps the mainnet guards; warns before any real transaction; offers a
  re-audit instruction after confirmation. Verified in the browser against live
  mainnet for skrillah.eth, including the invalid-handoff path.
- **UI**: `/scan` audit, `/create` identity and record publish, `/pay`, `/receive`
  scan with sweep package, `/privacy` threat model, `/demo`.
- **Mobula exposure panel** and **encrypted testnet recovery capsule**.

## Agent security boundary (enforced by tests)

- `tests/mcp.boundary.test.ts` walks the transitive import graph from
  `src/agent`, `mcp` and `cli` and fails if it reaches `src/ens/write.ts`,
  `src/chain/payment.ts`, `src/relay/sweep.ts`, wallet or identity state, the
  capsule, any page or component, `viem/accounts` or React. It also scans the
  safe layers for signing, wallet and key-generation call sites, and checks that
  no tool input has an RPC, key or secret parameter and that unknown fields are
  rejected.
- `tests/agent.report.test.ts` proves stable codes for missing, malformed,
  conflicting and legacy records, unknown on invalid names and RPC failures,
  no addresses or record values by default, inert injection text, verifiable
  report ids, and a handoff URL with exactly five parameters.
- `tests/mcp.server.test.ts` (official in-memory transport) proves the exact
  tool catalogue and annotations, strict inputs, schema-valid structured
  content, evidence tools preserving verified/failed/unknown/notProven, the
  resources and the prompt's key prohibition.
- `tests/mcp.stdio.test.ts` builds the bundle with esbuild, drives it with raw
  newline-delimited JSON-RPC and with the official stdio client, and asserts
  that stdout holds only valid MCP messages.

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
- The MCP server is stateless, so a re-audit can compare against a supplied
  prior status and finding codes but never claims the prior report was
  cryptographically validated.

## Phase log

- **Phase 0 (done):** complete destination-bound sweep package. Fixed a real
  defect where only the EIP-7702 delegation was emitted, which was both
  non-executable and misleading about destination binding. 18 tests. The live
  sweep test now builds its transaction entirely from the package, so the
  on-chain result proves the format is executable.
- **Phase 1 (done):** GhostCheck ENS privacy conformance audit on `/scan`.
  22 tests. Verified live: `skrillah.eth` reads Incomplete.
- **Phase 2 (done):** both halves of the published evidence are verified from
  live chain data, integrated into `/receive` and `/demo`.
  - Sponsored exit (`src/relay/proof.ts`, 12 tests): all eight checks pass live.
  - Payment and announcement (`src/relay/paymentProof.ts`, 11 tests): all eight
    checks pass live, including the binding check that the announcement names
    the same address the payment actually funded. Without that, an announcement
    is just an unrelated log.
- **Phase 3 (done):** `/demo` rebuilt as one guided route (audit, upgrade,
  derive, prove receive, prove exit, boundary, close). Verified end to end in
  the browser.
- **Phase 4 (done):** competitive position documented in README and
  COMPETITIVE_MOAT.md; em dashes removed from all GhostName-authored docs.
- **Agent P0 (done):** agent-safe adapter and schemas, stable finding codes,
  sanitisation, local stdio MCP server, five approved read-only tools, five
  resources, one prompt, 49 new tests (202 total).
- **Agent P1 (done):** CLI over the same service functions, the
  ens-privacy-advisor Claude Agent Skill, the secure /create handoff with live
  re-resolution, and the re-audit instruction. 11 new tests (213 total).

## Next action

Agent P2: the MCP App audit view (official MCP Apps extension, with the plain
text and structured fallback for hosts without Apps) and AGENT_DEMO.md. Then P3
(remote stateless HTTP profile, server.json, AGENTS.md, llms.txt, ENSIP-26
discovery records).

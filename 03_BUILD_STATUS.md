# GhostName: Build Status

Single source of truth for build state. Every figure here was verified against
the repository, not carried over from an earlier draft.

Last reconciled: 2026-09-03, after merging the AI-agent layer (PR #1) onto
`main` with the release audit and UI/UX fixes, then the submission-copy pass on
branch `claude/ghostname-hackathon-submission-aduy25`; every figure below was
re-run from a clean `npm ci` on Node 22 on the merged tree.

## Product position

GhostName is the open privacy-assurance layer for ENS: **audit, upgrade, prove**.

- **Audit** any ENS name against the emerging ENS stealth-resolution convention.
- **Upgrade** an existing ENS identity in place, with no service-owned subdomain.
- **Prove** the whole lifecycle, from local derivation to sponsored withdrawal.

It is also readable by AI agents as a local-first, read-only privacy adviser
(MCP server, CLI, Claude Agent Skill, secure web handoff). The agent gets
evidence and a link; the human keeps the keys and the wallet.

Tagline unchanged: *Keep the ENS name. Break the payment graph.*

## Verified commands

| Command | Status | Result |
|---|---|---|
| `npm ci` | PASS | lockfile v3, Node 20+, `npm audit` reports 0 vulnerabilities |
| `npm run typecheck` | PASS | no errors |
| `npm test` | PASS | 316 passed, 11 skipped, 0 failed (35 files, 327 tests) |
| `npm run build` | PASS | typecheck, vite build, then `scripts/check-bundle.mjs` (no personal name, credential pattern, private-key-shaped value or source map); app shell ~316 kB, viem ~334 kB, react ~49 kB, noble ~29 kB; CSP meta and build commit embedded |
| `npx vitest run tests/no-personal-name.test.ts tests/csp.test.ts` | PASS | release guards, including over `dist/` |
| `npm run build:agent` | PASS | esbuild bundles `dist-agent/ghostname-mcp.mjs` (stdio MCP), `ghostname-mcp-http.mjs` (optional remote profile), `ghostname.mjs` (CLI) and `ui/ghostname-audit.html` (MCP App view); `dist-agent/` is gitignored |
| `npx vitest run tests/mcp.boundary.test.ts` | PASS | the agent, MCP and CLI import graph reaches no write, signing, wallet, key-custody or UI module and no `viem/accounts` or React package |
| GitHub Actions `CI` (`.github/workflows/ci.yml`) | configured | runs the five rows above on Node 20 and 22 for every pull request, push to `main` and manual dispatch; read-only token, no secrets, `RUN_LIVE` never set |
| `RUN_LIVE=1 npm run e2e:sepolia` | gated | needs `SEPOLIA_PRIVATE_KEY`; skipped otherwise |
| `RUN_LIVE=1 npm run sweep:sepolia` | gated | needs `SEPOLIA_PRIVATE_KEY`; skipped otherwise |

Skipped tests are the network-gated live suites: `tests/live.ens.test.ts`
(`RUN_LIVE=1`, plus `LIVE_MAINNET_ENS_NAME` for the mainnet checks),
`tests/live.sepolia.test.ts` and `tests/live.sweep.test.ts` (`RUN_LIVE=1` and
`SEPOLIA_PRIVATE_KEY`). A plain `npm test` never writes to any network.

## Deployment and repository

- Repository: https://github.com/0xSkrillah/ghostname (public)
- Deployed app: https://0xskrillah.github.io/ghostname/ (gh-pages branch,
  published with `npm run deploy:pages`, which refuses a dirty tree or a
  mainnet-enabled build, rebuilds from `npm ci`, verifies the CSP, the embedded
  commit and the no-personal-name guard, then appends to gh-pages).
  Current deployment: gh-pages commit `b618f54`, built from source commit
  `a6f813f055fa` (`main` after PR #1, the AI-agent layer, on top of the
  release audit and UI/UX fixes) with
  `VITE_DEMO_SEPOLIA_NAME=ghostname-3c7714.eth` and
  `VITE_SCAN_START_BLOCK=11612900`; the deploy script verified CSP, embedded
  commit and the no-personal-name guard before pushing.
- Routes: `/` `/scan` `/create` `/pay` `/receive` `/privacy` `/demo` (hash router,
  so every route deep-links on a static host). The footer shows the commit the
  served bundle was built from. The `/create` agent handoff is live in this
  deployment.
- Agent layer: `npm run build:agent && npm run mcp` (stdio MCP server),
  `node dist-agent/ghostname.mjs audit <name> --chain <id> [--json]` (CLI),
  `npm run mcp:http` (optional stateless Streamable HTTP profile, loopback by
  default). Setup for Claude Code, Claude Desktop, Cursor and VS Code in
  `AGENTS.md`; live sequence in `AGENT_DEMO.md`.

## Networks and keys

- Mainnet: **read only** by default. Guarded write mode exists behind
  `VITE_ENABLE_MAINNET=true` **and** a typed per-action confirmation that is
  consumed by every attempt. Off in the shipped build. Covered by
  `tests/mainnet-guard.test.ts` and `tests/inputGuards.test.ts`.
- Sepolia: all demo writes. A payment plan can only be paid on the chain its
  record was resolved on.
- The established mainnet identity used as demo input is read-only, configured
  only through `VITE_DEMO_MAINNET_NAME` in a local uncommitted `.env`, and has
  no built-in default. Nothing is queried on load.
- Demo signing key is a throwaway testnet key in gitignored `.env`; the demo
  identity lives in gitignored, owner-only `.demo/`.

## Live on-chain evidence (Sepolia)

- Demo identity: **ghostname-3c7714.eth** (ENSv2), resolver
  `0xE0e6F09B30eBcdE505FDCA0F1fd244273838FFAE`
- ERC-5564 announcer: `0x55649E01B5Df198D18D95b5cc5051630cfD45564`
- ERC-6538 registry (not consulted by the app): `0x6538E6bf4B0eBd30A8Ea093027Ac2422ce5d6538`
- Sweep executor (unaudited testnet demo contract): `0x94E4C39055fa4a5fCd47E03CbcbCD0503848806b`
- Record publish: `0x75b7a6404a5a3b1880f8dce7c874cbf34ce65fca64cffeb7e313567b2759ea29`
- Stealth payment: `0x2430f7f8a422a6a527272cd591541c101e9fffd43dccb2a1feed918ee0dc248b`
- Announcement: `0x4164c074fbb0adacf3d3804928e2a4cc803d61e783e9fbbef207608fe3010c11`
- Sponsored EIP-7702 sweep verified live by the app, built entirely from the
  sweep package: `0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25`
  (an earlier run: `0x412cca80d621d5d58a38ef190c6a8c323d18adb1be3488f29868d1b4b2efedc0`)
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
  vector. Strict backup parsing re-derives public material on import.
- **ENS layer** (`src/ens/`): normalization, conventional resolution, stealth
  record read, guarded `setText` publish via the Universal Resolver with a
  pre-sign preflight and overwrite acknowledgement.
- **Chain layer** (`src/chain/`): announcer integration, bounded and chunked
  scanning with a validated start block, yielding recognition, chain-bound
  payment plans, announcement retry, network write guards.
- **GhostCheck audit** (`src/audit/`): versioned privacy-readiness report for
  arbitrary names on mainnet or Sepolia, chain-specific then default record
  precedence, malformed, conflicting and single-key record detection, three
  local derivation trials, explicit unknowns including failed resolution and
  unconfigured names, JSON and summary export. No numeric score anywhere.
- **Sweep package** (`src/relay/sweep.ts`): complete destination-bound package
  carrying both required signatures plus executor calldata, random replay
  nonce, and an independent verifier that fails closed on malformed input and
  rejects high-s or chain-agnostic signatures. Proven executable on-chain.
- **Live proofs** (`src/relay/proof.ts`, `paymentProof.ts`): re-derive every
  claim about the published payment, announcement and sponsored exit from chain
  data, refusing look-alike events and foreign authorizations, with explicit
  not-proven lists.
- **UI**: `/scan` audit with network selector and a one-click retry on the
  other network, `/create` with the record and publish path first, a
  collapsed backup section (keys, plaintext export, encrypted capsule with
  restore), a pre-sign simulation that blocks publishing from a wallet the
  resolver rejects, and an inline discard confirmation, `/pay` with the two
  transactions shown before signing, wallet errors beside the connect button
  and a recovery path, `/receive` with field-level start-block validation
  before any RPC call, authoritative balances and the sweep package,
  `/privacy`, `/demo` with five counted steps, a completion card and the
  boundary as a closing section.
  Wallet controls on `/create` and `/pay`: connect, switch network, and a
  "Disconnect wallet" button that forgets the account, revokes the site
  permission where the wallet supports it (EIP-2255), remembers the choice
  across reloads, and hands focus back to "Connect wallet". Keyboard, screen-reader, 375 px and 320 px
  layouts verified, including with every proof panel rendered; nav targets
  are 44 px. Full findings and their verification in `UX_AUDIT.md`.
- **Secret handling**: no personal ENS name anywhere; error text scrubbed of
  URLs and key-shaped values; production CSP; no source maps; identity import
  validated; passphrase fields masked.
- **Mobula exposure panel** (opt-in per click, hardened parsing) and
  **encrypted testnet recovery capsule** (PBKDF2-SHA256 600k, AES-256-GCM,
  header-bound, in-app restore).
- **Agent service layer** (`src/agent/`): transport-free adapter over GhostCheck
  and the two evidence verifiers. Versioned `AgentPrivacyReport` with stable
  finding codes, sanitised strings, no sample derivation addresses or record
  values by default, a SHA-256 content-derived report id over canonical JSON,
  and a secure handoff URL limited to five non-secret parameters. Any RPC
  failure yields `unknown`, never a pass.
- **Local MCP server** (`mcp/`): official TypeScript SDK v2 over stdio; five
  read-only tools (`ghostname_audit_ens_privacy`, `ghostname_prepare_upgrade`,
  `ghostname_reaudit_ens_privacy`, `ghostname_verify_payment`,
  `ghostname_verify_sponsored_exit`) with strict zod input and output schemas,
  five `ghostname://` resources, the `improve-ens-privacy` prompt, and an
  inline MCP App view with a text and structured fallback. No tool accepts an
  RPC URL or a key. Injection text in an ENS record is proven inert by test.
- **CLI** (`cli/`) and **Claude Agent Skill**
  (`.claude/skills/ens-privacy-advisor/`) over the same service functions.
- **Secure web handoff** (`/create`): accepts only name, chainId, source,
  reportId and version; states that key generation happens in the browser,
  outside the agent; re-resolves the name live; keeps every network guard and
  the pre-sign resolver check from the release audit (the handoff never
  changes the write network); offers a re-audit instruction afterwards.
- **Registry and discovery preparation**: `server.json`, `AGENTS.md`,
  `llms.txt`, `AGENT_DISCOVERY.md`, and `scripts/prepare-agent-records.mjs`
  (draft ENSIP-26 records, Sepolia only, behind a typed confirmation; refuses
  the locally configured protected mainnet name).

## Known limitations, stated honestly

- Resolver provenance (direct versus inherited or wildcard) is reported as
  **unknown**. Never guessed.
- The sweep executor is an unaudited testnet demo contract; it accepts high-s
  signatures via `ecrecover` (replay still blocked by its nonce; client
  verifiers reject the malleable form).
- No production relayer is operated. The demo sponsor is the throwaway wallet.
- Demo custody is browser `localStorage`; the app scans and sweeps only on
  Sepolia.
- The ENS stealth-resolution RFC is still evolving, so record conventions are
  implemented as the current proposal, not a ratified requirement.
- Scanning uses bounded `eth_getLogs` over public RPCs rather than an indexer;
  RPC endpoints learn which names and addresses are looked at; CCIP-read
  resolvers are contacted for names that use them.
- Amounts, sender identity, timing and history remain public. GhostName is
  forward privacy only.
- No DOM-level test runner: page wiring is verified by typecheck, reading and
  headless rendering rather than unit tests. The `/create` handoff cards were
  re-ported onto the audited page during the merge and verified by typecheck
  and reading; re-check them in a browser before recording the agent cut.
- The MCP registry descriptor names an npm package that is not published yet;
  `agent-endpoint[mcp]` is withheld until an endpoint exists.

## Phase log

- **Phase 0 (done):** complete destination-bound sweep package.
- **Phase 1 (done):** GhostCheck ENS privacy conformance audit on `/scan`.
- **Phase 2 (done):** payment, announcement and sponsored exit verified from
  live chain data on `/receive` and `/demo`.
- **Phase 3 (done):** `/demo` rebuilt as one guided route.
- **Phase 4 (done):** competitive position documented.
- **Final audit (done):** personal ENS name removed from source, config, tests,
  docs, bundle and deployment; 6 High and 17 Medium findings fixed with
  regression tests, plus the Low items an independent verification pass
  raised; docs reconciled with verified behaviour. Details, verification
  verdicts and residual risks in `FINAL_AUDIT.md`.
- **AI-agent layer (merged 2026-09-03, PR #1):** read-only MCP server, CLI,
  skill, secure handoff, remote profile and discovery preparation. Merged onto
  the release-audited `main`: the personal ENS name the branch still carried
  was scrubbed from every file, `hasHighS` moved into the signing-free
  `sweepTypes` module so the import boundary holds, the handoff was re-ported
  onto the audited `/create` page, and the lockfile was regenerated.
- **UI/UX audit (done, 2026-09-03):** every route audited against the twenty
  UX laws at desktop and 375 px with live chain reads; 2 High, 7 Medium,
  8 Low and 1 Info findings, all fixed and re-verified on the dev server, with
  tests for the new start-block parsing and the pre-sign write check.
  Details in `UX_AUDIT.md`.

## Next action

Record the submission video from `VIDEO_SCRIPT.md` (two-minute cut, the agent
cut, and optionally the three-minute extended cut) with a locally configured
established mainnet name, open one agent handoff link on the deployed
`#/create` first to check the re-ported cards in a browser, and paste
`SUBMISSION.md` into the submission form.
Optionally deploy to Swarm with a booth postage
stamp (see SWARM.md). Accept only fixes for failed acceptance tests or
presentation-breaking bugs before the submission deadline.

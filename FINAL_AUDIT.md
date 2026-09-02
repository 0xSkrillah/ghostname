# GhostName: Final Release Audit

Release-blocking usability, privacy and security audit of GhostName, performed
at repository HEAD `4fd99c8` ("P2 completion") on branch
`claude/ghostname-audit-release-bvi2yf`, with fixes applied in the commits
listed in section 8. Method: full static read of every source, test, script,
contract and document; baseline typecheck, tests and production build; ten
independent finder passes (secrets and PII, untrusted input, chain safety,
cryptography, contract and proofs, supply chain and deployment, desktop
journeys, accessibility and mobile, docs versus reality, agent surfaces); a
merged and adversarially verified finding list; regression tests for every
code fix; clean rebuild; deployment. Every fix keeps the product shape (Audit,
Upgrade, Prove) and adds no unrelated feature.

Severity scale: Critical = key or fund loss, or a mainnet write without
consent, reachable in the shipped build. High = secret or PII exposure, a
safety or integrity property violated, or a core journey broken. Medium = a
real but bounded risk, a misleading safety claim, or confusing or inaccessible
core UX. Low = hardening or polish. Info = observation.

## 1. Baseline (before any change)

| Check | Result at HEAD 4fd99c8 |
|---|---|
| `npm ci` | 138 packages from lockfile v3, no network installs |
| `npm run typecheck` | pass |
| `npm test` | 153 passed, 10 skipped (16 files); 03_BUILD_STATUS claimed 155 / 8 |
| `npm run build` | pass; bundle contained the personal ENS name as a hard-coded fallback |
| `npm audit` | 1 high, 1 low (both in `tmp`, a dev-only dependency of `solc`) |
| Deployed gh-pages bundle | commit 4fd99c8 plus local env, contained the personal ENS name, no CSP |

## 2. Inventory

### 2.1 Personal ENS name occurrences (case-insensitive, exact, encoded and partial)

Thirty-two exact occurrences in tracked files at HEAD plus the built bundle
and the deployed gh-pages bundle. No base64, hex, URL-encoded or namehash
variant was found. Disposition:

| Location | Occurrences | Action |
|---|---|---|
| `src/config.ts` hard-coded fallback | 1 | removed; `VITE_DEMO_MAINNET_NAME` defaults to empty |
| `.env.example` | 1 | value emptied; documented as an optional, never-committed local pre-fill |
| `tests/ens.test.ts` normalisation case | 1 | neutral name |
| `tests/live.ens.test.ts` | 6 | gated on `LIVE_MAINNET_ENS_NAME`, skipped when absent; organisation name for the arbitrary-name check |
| Planning files 00, 01, 02, 03, 04, CLAUDE.md | 13 | "an established ENS identity", configured only through a local `.env` |
| README, DEMO, SLIDES, VIDEO_SCRIPT | 6 | "an established ENS name" / "an established public ENS identity" |
| `dist/` (local build) | 1 | rebuilt |
| `origin/gh-pages` bundle | 1 | redeployed from the audited commit (section 9) |
| `github.com/0xSkrillah/ghostname`, `0xskrillah.github.io/ghostname` | 6 | kept: legitimate repository and deployment URLs that do not name the ENS identity |

Regression guard: `tests/no-personal-name.test.ts` scans `src/`, `index.html`,
`.env.example`, `tests/`, `scripts/`, `contracts/`, every Markdown and text
file and `dist/` when present. App files may only contain an allowlist of
neutral or controlled names; every file is checked against SHA-256 digests of
the forbidden name and its bare label, so the literal never re-enters the
repository through the test itself. `scripts/deploy-pages.mjs` runs the same
check before pushing.

Not claimed: Git history, forks, caches, search indexes, third-party pages
and blockchain data still contain the name. History was not rewritten.

### 2.2 Attack surfaces

Browser single-page app (HashRouter, no backend); ENS names and text records
(mainnet and Sepolia, including offchain CCIP-read resolvers); public RPC
responses (logs, transactions, receipts, balances, code); the injected EIP-1193
wallet; local cryptography (ERC-5564 scheme 1 on @noble/curves, EIP-7702 and
EIP-712 signing via viem, AES-GCM/PBKDF2 via Web Crypto); `localStorage`
identity custody; JSON imports (identity backup, encrypted capsule); JSON
exports (audit report, sweep package, backups); the Mobula HTTP API; Swarm
upload script; operator scripts reading `.env` and `.demo/`; the deployed
`StealthSweepExecutor` contract; the gh-pages deployment.

Agent, MCP, CLI and Agent Skill surfaces: none exist in the repository. There
is no MCP server, no `bin`, no SKILL file, no HTTP server and nothing that
accepts model text. COMPETITIVE_MOAT.md lists a CLI only as a roadmap item.
The only "handoff" is the sweep-package JSON given to a human-operated
relayer; its schema is strict, versioned and carries no key material.

### 2.3 User journeys tested

Audit (Scan, Demo step 1) → understand findings and unknowns → prepare the
upgrade (Create: generate or import, back up, preflight, publish) → human
wallet handoff (Create publish, Pay send and announce) → re-audit (Scan, Demo
step 2) → verify payment and exit (Receive scan, proof panels, sweep package).
Desktop 1280 px and mobile 390 px, keyboard only, with RPC failure injected
by the sandbox's blocked egress.

## 3. Findings summary

Status: Fixed = code change plus regression test in this branch. Docs =
documentation corrected. Residual = accepted and documented, with reason.

| ID | Severity | Area | Title | Status |
|---|---|---|---|---|
| F-01 | High | privacy | Personal ENS name hard-coded as demo default, shipped in source, docs, tests, bundle and deployment | Fixed |
| F-02 | High | untrusted input | Identity import trusted arbitrary JSON; a mismatched meta-address routes future payments to unspendable keys | Fixed |
| F-03 | High | chain safety | Typed mainnet confirmation was never consumed, so one phrase authorised unlimited mainnet writes in a guarded build | Fixed |
| F-04 | High | chain safety | Payment plan not bound to the chain it was resolved on; a chain switch could pay a Sepolia-derived address on mainnet | Fixed |
| F-05 | High | chain safety | Two-transaction payment had no recovery when the announcement failed; the ephemeral key was lost with the funds undiscoverable | Fixed |
| F-06 | Medium | secrets | viem error text (full RPC URL with any pinned API key, request body) rendered on every page and exported in audit JSON | Fixed |
| F-07 | Medium | secrets | Malformed imported key echoed almost in full into the DOM by viem's hexToBytes error | Fixed |
| F-08 | Medium | secrets | Passphrase in a visible text field; private keys pasted into a single-line text input | Fixed |
| F-09 | Medium | untrusted input | Sender-declared announcement amount displayed as the payment amount; spoofable by anyone who knows the public meta-address | Fixed |
| F-10 | Medium | untrusted input | Start-block input accepted non-numeric or genesis values, producing raw BigInt errors and unbounded log requests | Fixed |
| F-11 | Medium | chain safety | Publishing silently overwrote an existing stealth record; no transaction fields shown before signing | Fixed |
| F-12 | Medium | chain safety | Zero-value payments reached the wallet; announcement fields not shown before signing | Fixed |
| F-13 | Medium | chain safety | Default build showed "Mainnet (guarded)" and a dead confirmation box to a wallet on mainnet | Fixed |
| F-14 | Medium | proofs | Sweep proof accepted any first authorization and any Swept-topic log; panel claimed the account "never received a gas-funding transfer" | Fixed |
| F-15 | Medium | crypto | Capsule KDF documented as OWASP guidance at 210k iterations (the SHA-512 figure); passphrase floor 8; header unauthenticated and unbounded | Fixed |
| F-16 | Medium | supply chain | No Content-Security-Policy on a static host; deployed bundle stale and unattributable | Fixed |
| F-17 | Medium | supply chain | `upgrade-insecure-requests` in the first CSP draft would blank the app on plain-http LAN gateways | Fixed |
| F-18 | Medium | accessibility | Focus outline removed on inputs; inputs unlabelled; no live regions or alerts; nested interactive elements | Fixed |
| F-19 | Medium | usability | Demo step counter leaked into nested lists (steps read 10, 16, 23) | Fixed |
| F-20 | Medium | usability | RPC failure rendered as "No ETH address record set"; unregistered or wrong-network names reported as "Incomplete" | Fixed |
| F-21 | Medium | usability | Scan audited mainnet only, so the Sepolia demo name read as Incomplete; demo copy claimed pre-filled inputs in a neutral build | Fixed |
| F-22 | Low | crypto | Sweep panel hard-coded executor nonce 0, so a second sweep of the same address reverted | Fixed |
| F-23 | Low | crypto | Odd-length hex meta-addresses silently left-padded; 65-byte ephemeral keys accepted; single-key meta-addresses unflagged | Fixed |
| F-24 | Low | crypto | High-s (malleable) intent signatures and chain-agnostic delegations accepted by the client verifiers | Fixed |
| F-25 | Low | untrusted input | Sweep verifier threw on malformed packages; capsule header fields unchecked; Mobula fields untyped; proxy URL could carry a key | Fixed |
| F-26 | Low | untrusted input | Announcement recognition ran unbounded elliptic-curve work on the main thread | Fixed |
| F-27 | Low | proofs | Historical sweep evidence coupled to the `VITE_SWEEP_EXECUTOR` override; two different sweep hashes cited across docs | Fixed |
| F-28 | Low | supply chain | `tmp` advisory via `solc`; `.gitignore` missed `.env.*`; no engines field; `npm install` in docs | Fixed |
| F-29 | Low | operations | Identity file written world-readable; `.env` parsed by regex; hard-coded commitment secret in a diagnostic script | Fixed |
| F-30 | Low | docs | README contradicted itself on mainnet posture and executor deployment; stale test counts; duplicated section numbers | Docs |
| F-31 | Low | usability | Bare "HTTP request failed" errors; stale report after input change; placeholder addresses in the comparison; missing hand-offs | Fixed |
| F-32 | Low | proofs | Payment proof matched the ETH marker by substring; announcer caller not surfaced | Fixed |
| F-33 | Info | supply chain | Two copies of @noble/curves in the bundle (viem pins 1.9.1) | Residual |
| F-34 | Info | crypto | Deployed executor accepts high-s signatures via `ecrecover` | Residual |
| F-35 | Info | privacy | Plaintext keys in `localStorage` and plaintext backup download | Residual |

No Critical finding was confirmed. No unresolved Critical or High finding
remains.

## 4. Findings in detail

Each entry: reproduction at HEAD 4fd99c8, impact, fix, verification, residual.

### F-01 Personal ENS name shipped everywhere (High)

Reproduction: `git grep -i <name>` at HEAD listed 32 hits; `npx vite build`
then `grep <name> dist/assets/index-*.js` matched the fallback in
`src/config.ts`; the same string was in `origin/gh-pages`. The Scan and Demo
inputs were pre-filled with it (no automatic query, but the name was on
screen on load).

Impact: a personal identity distributed with every clone, bundle and the
public deployment.

Fix: `VITE_DEMO_MAINNET_NAME` defaults to empty, inputs start blank with a
`name.eth` placeholder and disabled buttons, docs use neutral wording, live
mainnet tests require `LIVE_MAINNET_ENS_NAME`, deterministic tests use
neutral names, `.env.example` documents the optional local pre-fill.

Verification: `tests/no-personal-name.test.ts` (7 tests: app allowlist,
digest scan of every text file including docs and `dist/`, empty env example,
empty config default, env-honoured pre-fill, malformed start block ignored);
clean rebuild grep is empty; gh-pages redeployed (section 9).

Residual: history, forks and external copies keep the name; the GitHub
handle in repository and deployment URLs resembles it and was kept per the
brief.

### F-02 Identity import trusted arbitrary JSON (High)

Reproduction: on `/create`, import
`{"spendingPrivateKey":"0x01","viewingPrivateKey":"0x02","stealthMetaAddress":"st:eth:0x<someone else's keys>"}`.
The app stored it, displayed the foreign meta-address as yours and offered to
publish it. Scanning found nothing and errors surfaced viem text.

Impact: publishing a record whose keys you do not hold sends every future
payment to addresses you cannot spend from; a corrupted backup put the app
into a persistent broken state.

Fix: `src/crypto/identityBackup.ts` validates both private keys by shape
(`0x` + 64 hex) and range (valid scalar, distinct), re-derives the public
keys and meta-address, rejects any declared public material that disagrees,
and rebuilds the object from validated fields only. Applied to the import
handler, the capsule restore path and every `localStorage` read.

Verification: `tests/identityBackup.test.ts` (8 tests: round-trip,
re-derivation, mismatched meta-address, mismatched public keys, malformed
and out-of-range scalars, identical keys, non-objects, prototype-pollution
input, no key material in error text).

### F-03 Mainnet confirmation never consumed (High)

Reproduction: in a `VITE_ENABLE_MAINNET=true` build, type `SEND ON MAINNET`,
send once; the button stayed enabled and a second click (or Enter in the
name field on Create) sent again without retyping.

Impact: the documented per-action gate degraded to a per-session gate for
real funds. Not reachable in the shipped Sepolia-only build.

Fix: `MainnetConfirm` takes a `resetToken`; both pages bump it and clear
`mainnetConfirmed` in the `finally` of every attempted write.

Verification: `tests/mainnetConfirmPhrase.test.ts` for the phrase gate; the
reset wiring was reviewed by typecheck and by reading, since no DOM test
runner is present (see residual risks).

### F-04 Payment plan not bound to its chain (High)

Reproduction: derive on `/pay` before connecting (record read on Sepolia),
then connect a wallet on mainnet in a guarded build: the stale Sepolia-derived
destination remained payable.

Impact: real funds sent to an address derived from another network's record,
announced on the wrong chain, undiscoverable by the intended recipient.

Fix: `StealthPaymentPlan.chainId` is recorded at plan time and enforced in
`executeStealthPayment` and `announceStealthPayment` against both the
intended chain and the wallet-reported chain, after the network guard. The
Pay page clears plans with a notice when the effective network changes.

Verification: `tests/inputGuards.test.ts` "payment plans are bound to their
chain" (intended-chain mismatch, wallet-chain drift, wallet untouched).

### F-05 No recovery when the announcement fails (High)

Reproduction: reject the second wallet prompt on `/pay`. The transfer had
already landed; the page showed only an error and the ephemeral public key
was gone.

Impact: funds at a one-time address that the recipient cannot discover.

Fix: `AnnouncementFailedError` carries the payment hash and the full plan;
`announceStealthPayment` re-emits only the announcement; the Pay page shows
a recovery card with the stealth address, ephemeral key and metadata, a
retry button and a copy-recovery-data button, and warns not to leave.

Verification: `tests/inputGuards.test.ts` "surfaces the payment hash and
recovery data when the announcement fails" (error type, fields, no secret in
the message, successful retry).

### F-06 RPC URL and request body leaked through error text (Medium)

Reproduction: set `VITE_MAINNET_RPC_URL=https://rpc.example/v1/SECRET`,
block the network, run an audit: the on-screen error and the downloaded
GhostCheck JSON `unknowns` contained the URL.

Fix: `src/lib/describeError.ts` prefers viem's `shortMessage`, redacts
`http(s)` URLs and 32-byte hex values, collapses whitespace and caps length.
Used by every page, the audit, both proof verifiers, the wallet hook and the
payment error types.

Verification: `tests/describeError.test.ts` (5 tests including a real viem
`HttpRequestError`).

### F-07 Malformed key echoed by viem (Medium)

Fix: `privateKeyScalar` and the ephemeral-key path check the `0x` + 64 hex
shape before `hexToBytes`. Verification: `tests/stealth.test.ts` "malformed
key material is rejected without being echoed".

### F-08 Passphrase and key import in visible text fields (Medium)

Fix: `type="password"` with `autocomplete="new-password"` for the capsule
passphrase, a textarea with autocomplete and spellcheck off for the import,
warnings that the plaintext backup contains both keys, and an in-app capsule
restore so the plaintext path is optional. Verified by DOM dump of the built
page (`type="password"`, `<textarea>` present).

### F-09 Sender-declared amount shown as the payment amount (Medium)

Reproduction: anyone can call `announce()` for an address derived from your
public meta-address with metadata claiming any amount, without paying. The
Receive page showed "Payment recognised, amount 1000 ETH".

Fix: balances are read from chain for every recognised address and shown as
the authoritative figure; the announced amount is labelled "sender-supplied,
not verified", parsed only when the metadata follows the native-ETH layout
positionally, and flagged when it differs from the balance; the sweep amount
is pre-filled from the balance and capped by it.

Verification: `tests/inputGuards.test.ts` "declaredEthAmount accepts only
the native-ETH layout".

### F-10 Unvalidated start block and unbounded log ranges (Medium)

Fix: `resolveScanStart` (digits only, at or below latest, at most 250,000
blocks) and `fetchAnnouncements` chunking at 10,000 blocks with the same
ceiling. Verification: `tests/inputGuards.test.ts` (resolveScanStart cases,
window coverage, single-request cases, refusal before any request).

### F-11 Silent record overwrite and no pre-sign summary on publish (Medium)

Fix: a read-only preflight reads the resolver, computes the node and reads
the current record; the page shows contract, function, node, key and value
before the wallet is touched; a different or malformed existing record needs
an explicit acknowledgement; an identical record is reported as already
published. Publishing never sets or replaces a resolver. Verified by reading
and typecheck; the underlying `publishStealthRecord` guards keep their tests
in `tests/ens.test.ts` and `tests/mainnet-guard.test.ts`.

### F-12 Zero-value payments and hidden announcement fields (Medium)

Fix: `parseAmountEth` rejects empty, zero, negative and non-numeric input
before the wallet; `executeStealthPayment` refuses `amountWei <= 0`; the Pay
page lists both transactions (recipient, value, announcer address, function,
scheme id, ephemeral key, view tag, metadata) before "Send + announce".
Verification: `tests/inputGuards.test.ts` (amount parser and execute guard).

### F-13 Mainnet-disabled build advertised guarded mode (Medium)

Fix: guarded-mode UI is gated on `wallet.mainnetEnabled`; a wallet on mainnet
in the default build sees "Mainnet: read-only in this build, writes blocked"
and a Switch to Sepolia button; explorer links are bound to the chain that
was actually written. The Privacy page states the build's actual posture.

### F-14 Sweep proof over-claimed (Medium)

Fix: the delegation check recovers every authorization and requires one
whose authority is the swept account, pointing at the expected executor on
the expected chain (chainId 0 fails); the Swept event must be emitted by the
swept account and its fields must equal the calldata; a present-state
designator check reports pass or unknown; the intent signature must be
low-s; the panel says only that this transaction's gas was paid by the
sponsor and lists the unproven properties, including prior gas funding and
sponsor independence. The executor is labelled unaudited in the panel.
Verification: `tests/proof.test.ts` (six new cases: foreign emitter, foreign
authorization, genuine authorization not first, re-delegated or cleared
account, event fields disagreeing, chain-agnostic delegation).

### F-15 Capsule KDF, passphrase policy and header (Medium)

Fix: PBKDF2-SHA256 at 600,000 iterations, NFC-normalised passphrase of at
least 12 characters, format version 2 binds the header into the GCM tag,
strict header validation (version, KDF, cipher, iteration band 100k to 5M,
salt 16 bytes, IV 12 bytes, base64 shape) before any key derivation, version
1 still readable, testnet guard applied on restore. Docs corrected.
Verification: `tests/capsule.test.ts` (header tampering, iteration band,
version, base64, Unicode equivalence, JSON text form).

### F-16 and F-17 Content-Security-Policy and deployment provenance (Medium)

Fix: `src/security/csp.ts` injected into the production `index.html` only
(`script-src 'self'`, no inline or eval, `object-src 'none'`, `base-uri
'self'`, `form-action 'none'`, `connect-src https:` for user-pinned RPCs),
without `upgrade-insecure-requests` so plain-http LAN Bee gateways keep
working; a frame-buster in `main.tsx` since `frame-ancestors` cannot travel
in a meta tag; the build commit embedded as a meta tag and shown in the
footer; `scripts/deploy-pages.mjs` refuses a dirty tree, builds from `npm
ci`, verifies CSP, commit and the name guard, and appends to gh-pages without
rewriting history. Verification: `tests/csp.test.ts`; DOM dump of the built
page.

### F-18 Accessibility (Medium)

Fix: `input:focus { outline: none }` replaced by `:focus-visible` rings on
every control; every input has a label (visually hidden where the design is
a bare field); errors carry `role="alert"`, progress carries
`role="status"`, results live in `aria-live="polite"` regions with
`aria-busy`; Landing links are styled links, not buttons inside links;
repeated Copy and Reveal buttons have distinct accessible names; pass and
fail states carry words, not only colour; text inputs shrink on narrow
screens; nested lists inside demo steps are no longer numbered. Verified by
DOM dumps and 390 px and 1280 px screenshots of every route.

### F-19 to F-21 and F-31 Usability (Medium and Low)

Fixes: step numbering scoped to direct children; the audit distinguishes
resolved, absent and failed address lookups and reports unknown (with a
wrong-network hint) when a name has no resolver, address or records on the
chosen network, and Scan and Demo render those states honestly; Scan has a
mainnet or Sepolia selector, disables inputs while busy, flags a stale
result, passes the report's real derivations to the comparison, and prefixes
RPC failures with the action and the environment variable to set; the Demo
lead reflects whether inputs are pre-filled and step 4 waits for step 3;
Receive shows progress, an empty-result hint and a sampled negative control;
Pay states the gas prerequisite; Create links to Pay and Receive after a
publish. Verification: `tests/audit.test.ts` "honest handling of RPC failure
and unconfigured names"; screenshots.

### F-22 to F-27, F-32 Cryptography, verification and proofs (Low)

Fixes: random 256-bit executor nonce per package; odd-length hex records
rejected; announcements must carry a 33-byte compressed ephemeral key;
single-key meta-addresses flagged in the audit; high-s intent signatures and
chainId-0 delegations rejected by `verifyNativeSweepPackage` and the proof;
account nonce required when signing an authorization and read from chain in
the operator script; the verifier fails closed on malformed packages; Mobula
responses coerced and the proxy URL refused if it carries a query string or
credentials; yielding recognition with progress and a capped negative
control; historical evidence pinned to `SEPOLIA_DEMO_SWEEP_EXECUTOR`; one
canonical sweep transaction across docs; payment-proof metadata checked
positionally with the announcer caller surfaced. Verification:
`tests/sweepNonce.test.ts`, `tests/metaAddress.test.ts`,
`tests/stealth.test.ts`, `tests/interop.test.ts`, `tests/sweep.package.test.ts`,
`tests/mobula.test.ts`, `tests/inputGuards.test.ts`, `tests/evidence.test.ts`,
`tests/paymentProof.test.ts`.

### F-28 and F-29 Supply chain and operations (Low)

Fixes: `overrides.tmp ^0.2.6` (compile script verified still working, `npm
audit` clean); `.gitignore` covers `.env.*` except the example plus key
files; `engines.node >= 20`; docs use `npm ci`; identity file and directory
written owner-only; operator scripts load the testnet key through one
validated helper; the hard-coded commitment secret in the diagnostic script
replaced by a fresh random value; Swarm deploy verifies freshness, CSP,
response type and read-back.

### F-30 Documentation versus reality (Low)

README no longer says "no mainnet wallet client exists" or "58 tests", no
longer claims the executor is undeployed while citing its address, has one
section 11, names the unaudited executor and lists honest limitations; DEMO
and VIDEO_SCRIPT use the real button names and the optional local pre-fill;
RELAYERS documents the verifier guarantees and residual executor behaviours;
ARCHITECTURE and PRIVACY describe the new modules and data-handling facts;
SWARM states the real KDF parameters; 03_BUILD_STATUS carries the exact
verified counts (section 8).

## 5. Refuted or not applicable

- No XSS or unsafe rendering: every value reaches the DOM through JSX text
  nodes; no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or dynamic script.
- No URL or query parameter is read; nothing queries a chain or third party
  on load (every read is behind a click or submit).
- No source maps are emitted; no analytics, fonts or third-party scripts are
  loaded; no secret leaves the browser (the Mobula key, if any, lives only in
  a proxy).
- The executor contract is sound for its scope: nonce written before the
  external call, intent bound to chain, account, destination, amount, nonce
  and deadline, `ecrecover(0)` can never equal `address(this)`, expiry
  enforced. Its residual behaviours are documented (F-34, RELAYERS.md).
- CSPRNG freshness and key separation hold: keypairs and every ephemeral key
  come from `crypto.getRandomValues` via @noble/curves; scalars are
  range-checked; derivation is byte-identical to the ScopeLift reference.
- Mainnet writes are off by default and double-gated; the shipped build
  cannot reach a mainnet write.

## 6. Residual risks (accepted, stated)

- Custody: private keys live in `localStorage` and a plaintext backup can be
  downloaded. This is the stated testnet demo custody model; the UI, README
  and PRIVACY say so, and an encrypted capsule with restore exists.
- The deployed executor accepts high-s signatures via `ecrecover`; replay is
  blocked by its nonce and the client verifiers reject the malleable form.
  The source was left unchanged so the published evidence still matches the
  deployed bytecode.
- `connect-src https:` is any https origin by design (user-pinned RPCs).
  `script-src 'self'` with no inline or eval is the primary control.
- RPC endpoints learn which names and addresses a user looks at; CCIP-read
  resolvers are contacted for names that use them; Mobula receives the
  audited address when the panel is used. All stated in the UI and docs.
- Announcement scanning uses public RPC logs, not an indexer; the sampled
  negative control examines at most 500 announcements.
- Two copies of @noble/curves ship (viem pins 1.9.1); no known advisory.
- No DOM-level test runner exists, so page wiring (confirmation reset,
  preflight acknowledgement, recovery card) is verified by typecheck, reading
  and headless rendering rather than by unit tests.
- The GitHub handle in repository and deployment URLs resembles the personal
  ENS label; changing the hosting account is outside this audit.
- Blockchain data, Git history, forks and external caches cannot be erased.

## 7. Verification commands

```bash
npm ci
npm run typecheck
npm test
npm run build
npx vitest run tests/no-personal-name.test.ts tests/csp.test.ts   # release guards, also over dist/
RUN_LIVE=1 LIVE_MAINNET_ENS_NAME=name.eth npm test -- live.ens     # optional, network
DEPLOY_DRY_RUN=1 npm run deploy:pages                              # build + bundle checks, no push
```

Results are recorded in section 8 and in 03_BUILD_STATUS.md.

## 8. Results and commits

Filled in at the end of the audit; see the table in 03_BUILD_STATUS.md for
the exact counts of the final run.

## 9. Deployment

Filled in at the end of the audit.

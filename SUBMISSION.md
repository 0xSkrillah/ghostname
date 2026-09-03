# GhostName: hackathon submission copy

Paste-ready description for the Common S3nse Amsterdam 2026 submission form.
It names no personal ENS identity; the established mainnet name used in the
video is configured locally and never committed (see `CLAUDE.md`). If the form
allows it, substitute your own name where the text says "an established
mainnet ENS name". No em dashes anywhere.

---

## GhostName: Keep the ENS name. Break the payment graph.

**GhostName is the open privacy-assurance layer for ENS. It audits any ENS
name for privacy readiness, upgrades the identity you already own in place,
and proves the whole private-payment lifecycle from local derivation to a
sponsored exit, with evidence anyone can re-check. It is also readable by AI
agents as a local, read-only privacy adviser: the agent gets evidence and a
link, the human keeps the keys and the wallet.**

An ENS name is useful because it connects a human-readable identity to a
wallet. That same convenience creates a permanent privacy problem. When a name
resolves to one static address, anyone can connect that identity to its
balances, counterparties, payment history and future activity.

Blockchain history cannot be deleted. GhostName therefore focuses on the part
users can still control: the next payment.

### Audit, upgrade, prove

GhostName does three things for an ENS identity you already own.

- **Audit.** GhostCheck reads any ENS name on mainnet or Sepolia and reports
  whether it is ready to receive private payments under the emerging ENS
  stealth-resolution convention. It returns a category, never a score:
  Private-ready, Incomplete, Misconfigured or Unknown. It checks the
  chain-specific record before the all-chain default, surfaces malformed,
  conflicting and single-key records instead of ignoring them, runs three
  local derivation trials, and states explicitly what it could not establish.
  Reports export as JSON.
- **Upgrade.** The user keeps their existing name. No service-owned subdomain,
  no migration to a new identity, no new wallet provider to trust. One text
  record is published on the name itself.
- **Prove.** Every claim is re-derived from chain data at runtime rather than
  asserted: the published payment, the announcement that names the funded
  address, and the sponsored exit. Each proof lists what its evidence does not
  prove.

### How GhostName works

The recipient generates an ERC-5564 spending key and viewing key locally in
their browser, then publishes the resulting stealth meta-address as an ENS text
record:

```text
stealth-meta-address[1] = st:eth:0x<spending public key><viewing public key>
```

When a sender enters the recipient's ENS name, GhostName reads that public
record and derives a fresh one-time receiving address locally. A new
cryptographically secure ephemeral key is generated for every payment, so
paying the same ENS name multiple times produces different destinations:

```text
name.eth  →  0xA   (payment 1)
name.eth  →  0xB   (payment 2)
name.eth  →  0xC   (payment 3)
```

The ENS name remains the stable human-readable identity, but the receiving
address is no longer reused.

The sender transfers funds to the derived address and publishes the
corresponding ERC-5564 announcement through the announcer singleton. The
recipient scans announcements using their private viewing key, recognises the
payments that belong to them and derives the corresponding stealth spending
key locally. An unrelated viewing key cannot identify the payment.

The result is a complete private-receiving lifecycle:

```text
generate → publish → read → derive → send + announce → recognise → recover → sponsored exit
```

### Why ENS is essential

ENS is not used as decoration or simply displayed next to a wallet address. It
is the discovery and identity layer that makes the privacy mechanism usable.

Without ENS, a sender would need to obtain and verify a 66-byte stealth
meta-address through another channel. With GhostName, the recipient publishes
one privacy record under the ENS identity they already use. Compatible senders
can then pay the human-readable name while deriving a unique destination for
every transaction.

GhostName follows the emerging ENS stealth-resolution proposal and uses the
`stealth-meta-address[1]` record convention for ERC-5564 scheme 1. Reads and
writes go through the ENS Universal Resolver, so they work for both ENS v1 and
ENS v2 names. The controlled Sepolia demo identity was registered through the
live ENSv2 registrar during the Sepolia migration, when classic registration
was unavailable network-wide.

The functional relationship is:

```text
ENS name  →  stealth-meta-address[1]  →  fresh one-time address per payment
```

### No address-generation gateway

Many stealth-payment systems rely on a hosted resolver or gateway to generate
receiving addresses. GhostName deliberately takes the strict client-side
approach.

The sender's browser reads the recipient's public meta-address from ENS and
independently generates the ephemeral randomness used to derive the
destination. No GhostName server generates the address, receives the
recipient's viewing key or maintains a database of receiving addresses.

GhostName has no backend. All privacy-critical operations happen locally:

- spending and viewing key generation;
- stealth-address derivation;
- payment recognition;
- spending-key recovery;
- recovery-capsule encryption;
- sponsored sweep authorisation.

This reduces the amount of infrastructure users must trust and makes the
complete implementation independently inspectable.

### Privacy must survive the first spend

Receiving funds at a fresh address is only part of the problem.

A new stealth address holds funds but has no ETH for gas. Sending gas to it
from the recipient's public wallet would create an obvious on-chain link and
undo much of the privacy gained through the stealth payment.

GhostName addresses this with a sponsored EIP-7702 sweep. After recognising a
payment, the recipient uses the recovered stealth key to sign a
destination-bound authorisation locally: the EIP-7702 delegation, an EIP-712
sweep intent with a random replay nonce, and the executor calldata, as one
package. A sponsor submits the type-4 transaction and pays the gas, so the
funds leave the stealth address without the address first receiving gas from
the recipient's known wallet. An independent verifier in the client fails
closed on malformed packages and rejects high-s or chain-agnostic signatures.
EIP-3009 authorisations cover compatible ERC-20 tokens.

The full sponsored sweep has been executed live on Sepolia, and the app
re-verifies that transaction from chain data every time the proof runs. The
demo executor is unaudited testnet code. The project does not claim production
readiness for the contract and operates no production relayer.

### A real, non-hard-coded demonstration

GhostName uses an established mainnet ENS name with years of history as a
read-only example of the problem. The application resolves the real mainnet
name and shows how a static ENS mapping exposes a wallet to public
correlation. It does not attempt to alter, clear, transfer or delete the name,
and the name is never hard-coded: it is supplied only through local
configuration, and a release guard fails the build if a personal name appears
in source, tests, docs or the bundle.

The privacy-enabled flow uses a controlled Sepolia ENS identity.

The live demonstration includes:

1. Auditing an established ENS identity and showing its static wallet mapping.
2. Explaining that its historical blockchain activity cannot be erased.
3. Reading a real `stealth-meta-address[1]` record from ENS and reporting the
   name as Private-ready.
4. Deriving multiple fresh destinations from the same ENS name.
5. Proving that the generated addresses are different.
6. Sending a real Sepolia payment to a derived stealth address, with both
   transactions shown before signing.
7. Publishing the ERC-5564 announcement.
8. Recognising the payment with the correct viewing key.
9. Showing that an unrelated viewing key recognises nothing.
10. Recovering and verifying the stealth spending key.
11. Re-verifying the published payment, announcement and sponsored EIP-7702
    sweep from chain data, with each proof's not-proven list.

Inputs can be pre-filled for presentation reliability, but addresses and
cryptographic results are generated live. Nothing is precomputed. The
implementation works with arbitrary ENS names rather than a hard-coded demo
identity.

### GhostName for AI agents: evidence for the agent, control for the human

Ask your AI agent to audit any ENS name, explain its privacy leaks and guide
you through a human-signed upgrade, without the agent ever seeing your keys.

GhostName ships a local MCP server that runs on your own machine over stdio,
uses your RPC, calls no GhostName API, collects nothing and keeps no history.
It exposes five read-only tools (audit, prepare upgrade, re-audit, verify
payment, verify sponsored exit), five resources, one prompt and an inline MCP
App view for hosts that support it. The same functions are available as a CLI
and as a Claude Agent Skill, so Claude Code, Claude Desktop, Cursor and VS Code
can all run the audit.

The workflow is: **audit, explain, prepare safe handoff, human wallet action,
re-audit and prove.**

- **Audit.** The agent calls the audit tool with only a name and a chain id.
  There is no RPC URL parameter and no key parameter. It gets back a status
  and stable finding codes (for example `STATIC_ADDRESS_EXPOSED` and
  `STEALTH_RECORD_MISSING`), with anything it could not establish marked
  unknown rather than guessed. Any RPC failure yields unknown, never a pass.
- **Handoff.** The agent prepares an upgrade plan and a link to the web app
  that carries only the name, chain id, report id and version. The page states
  that key generation happens in the browser, outside the agent, resolves the
  name again live, simulates the wallet's write access before signing, and
  writes the record only after the human approves it in their own wallet.
  Nothing in the link is trusted for the privacy result, and the handoff
  never widens the network guards.
- **Re-audit and prove.** The human hands back a key-free instruction; the
  agent re-audits the name and explains what improved and what stays public.
  It can also verify the real Sepolia payment, announcement and sponsored
  EIP-7702 exit from chain data, with each proof's not-proven list attached.

The agent layer has no wallet, no signing and no write capability. That is
enforced by an import-boundary test that walks the transitive import graph of
the agent, MCP and CLI code and fails on any path to a signing, write, wallet,
key-custody or UI module, rather than by tool annotations or a prompt.
Injection text in an ENS record is proven inert by test. A private-ready
result means forward recipient-address privacy for compatible senders, never
anonymity.

GhostName gives AI agents evidence and gives humans control.

### Public exposure analysis with Mobula

GhostName uses the Mobula API to demonstrate why static ENS resolution matters.

After resolving the conventional wallet address associated with an ENS name,
the application can assemble a public portfolio summary showing how much
financial information can be inferred from the name-to-address relationship.

The interface shows high-level token and chain counts first. Portfolio value
stays behind a deliberate reveal control so private financial information is
not unexpectedly displayed during a public presentation. The query runs only on
an explicit click, and any production API key stays behind a server-side proxy,
never in the client.

Mobula reinforces the central problem:

```text
one name → one static address → a full public financial profile
```

GhostName removes that direct relationship for future incoming payments.

### Encrypted recovery with Swarm

Recipients need a safe way to preserve the viewing and spending material
required to recover future payments.

GhostName creates a testnet recovery capsule encrypted locally with AES-256-GCM
under a key derived from the user's passphrase (PBKDF2-SHA256, 600,000
iterations), with the capsule header bound into the authentication tag. The
serialised capsule contains no plaintext private keys and is suitable for
storage on Swarm. The app restores it in place. The passphrase and unencrypted
keys never leave the browser.

The project also includes tooling for deploying the static application to
Swarm through a Bee node and a funded postage stamp.

GhostName does not claim that decentralised storage can erase information that
another party has already downloaded. Recovery and access-control limitations
are documented explicitly.

### What GhostName protects

GhostName protects against straightforward linkage between an ENS identity and
its future receiving addresses by ordinary passive blockchain observers.

It helps prevent:

- repeated recipient-address reuse;
- direct ENS-to-future-receiving-address correlation;
- reliance on a gateway to generate fresh payment addresses;
- public disclosure of the recipient's viewing and spending secrets;
- gas-funding transactions that immediately reconnect a stealth address to a
  known wallet.

### What GhostName does not protect

GhostName is forward recipient-address privacy, not complete transaction
anonymity.

It does not hide:

- historical blockchain activity;
- ownership of the ENS name;
- the public stealth meta-address record;
- the sender's wallet;
- ordinary ETH or ERC-20 transfer amounts;
- transaction timing;
- RPC, browser or network metadata;
- unsafe withdrawal destinations;
- information exposed by a compromised device;
- viewing or spending keys that the user leaks.

GhostName is not a mixer, does not delete history and does not claim to make
transactions untraceable. These boundaries are visible in the application, on a
dedicated page that separates the past that cannot be erased, the present
exposure that can be reduced, and the future that GhostName changes, and in
the project documentation.

### Technical implementation

GhostName is a browser-first TypeScript application built with:

- React and Vite, served as a static site with a production Content Security
  Policy and no source maps;
- viem for Ethereum and ENS interactions, with RPC fallback;
- maintained secp256k1 primitives from `@noble/curves`, composed, never
  hand-rolled;
- ERC-5564 scheme 1 with view tags;
- the ERC-5564 announcer singleton, scanned in bounded, chunked block ranges;
- ENS Universal Resolver support for ENS v1 and v2;
- EIP-7702 sponsored account execution;
- EIP-3009 authorisations for compatible ERC-20 tokens;
- Web Crypto for encrypted recovery capsules;
- Mobula for public exposure analysis;
- Swarm deployment and encrypted-storage tooling;
- the official Model Context Protocol TypeScript SDK for the local, read-only
  agent server, with a CLI and a Claude Agent Skill over the same functions;
- Vitest for deterministic, interoperability and live-network tests.

The ERC-5564 implementation is byte-identical to an existing stealth-address
SDK on a frozen known-answer vector and includes positive, negative,
malformed-input, randomness, recognition and spending-key recovery tests. The
deterministic suite runs 316 tests with no network access, including the
agent import-boundary rule, and GitHub Actions runs clean install, typecheck,
tests, production build and the release guards on every pull request.

Mainnet is read-only by default. Test writes and payments use Sepolia, and a
payment plan can only be paid on the chain its record was resolved on. Optional
mainnet write support requires both an explicit build-time flag and a typed
confirmation for every action. Error text is scrubbed of URLs and key-shaped
values before it is shown or exported.

### Why GhostName is different

Stealth payments are becoming a stack, and most projects sit at the account
layer. Fluidkey and Cloaked operate wallet infrastructure. Umbra implements the
core standard. Sneaky pairs ENS resolution with a privacy-pool exit. GhostName
sits at the assurance layer: it audits, upgrades and proves the identity a user
already owns, and it custodies nothing and issues nothing.

The user does not need to:

- accept a new protocol-owned username;
- move their identity onto a hosted resolver;
- share a viewing capability with GhostName;
- trust a service to generate fresh receiving addresses;
- abandon the history and reputation attached to their ENS name.

No claim is made to being first, only, or most private. GhostName provides a
standards-based, independently verifiable path from an existing public identity
to forward-private receiving, and lets an AI agent run the audit and guide the
upgrade without ever holding a key.

The project's core idea is simple:

Blockchains do not have a delete button. GhostName gives established
identities a forward-privacy button.

**Keep the ENS name. Break the payment graph.**

---

## Short form (under 100 words)

An ENS name ties your identity to one wallet forever, and every payment to it
is public, permanent history. GhostName is the open privacy-assurance layer for
ENS: it audits any name for privacy readiness, upgrades the identity you already
own by publishing one ERC-5564 stealth meta-address record, and proves the
result. Every sender derives a fresh one-time address locally, only your
viewing key finds the payments, and a sponsored EIP-7702 sweep moves funds out
without re-linking. Your AI agent can run the audit and guide the upgrade
through a local, read-only server that never sees a key. Live on Sepolia, no
backend, honest threat model. Keep the ENS name. Break the payment graph.

## Links

- Live app: https://0xskrillah.github.io/ghostname/
- Repository: https://github.com/0xSkrillah/ghostname
- Guided demo route: https://0xskrillah.github.io/ghostname/#/demo
- Threat model: https://0xskrillah.github.io/ghostname/#/privacy
- Agent setup (Claude Code, Claude Desktop, Cursor, VS Code, CLI):
  https://github.com/0xSkrillah/ghostname/blob/main/AGENTS.md
- Agent demo sequence: https://github.com/0xSkrillah/ghostname/blob/main/AGENT_DEMO.md
- Sponsored EIP-7702 sweep, verified live by the app:
  https://sepolia.etherscan.io/tx/0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25

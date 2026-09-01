# GhostName — Master Implementation Specification

## 1. Mission

Build a functioning Common S3nse Amsterdam 2026 hackathon entry named
**GhostName**.

**Tagline:** Keep the ENS name. Break the payment graph.

The product gives established ENS identities **forward recipient-address
privacy**. It does not delete historical blockchain data. It lets future
senders resolve an ENS-published ERC-5564 stealth meta-address and derive a
fresh, one-time destination locally.

The hard submission deadline is **Saturday 5 September 2026, 09:00
Amsterdam time**. Engineering must finish Friday night.

Optimisation order:

1. Correct end-to-end cryptographic demo.
2. ENS bounty qualification.
3. Reliable live presentation.
4. Explicit and honest threat model.
5. Clean, minimal UX.
6. Optional partner integrations.

## 2. Safety and non-negotiable rules

- `skrillah.eth` is read-only mainnet demo input.
- Never transfer, burn, clear, reset, update, or otherwise modify it.
- Never initiate a mainnet write without explicit human confirmation.
- Never hard-code `skrillah.eth` into functional application logic.
- All core flows must accept arbitrary ENS names.
- Never upload, log, analyse, or transmit private spending/viewing keys.
- Never store plaintext private keys on Swarm or any server.
- Never describe the project as anonymous, untraceable, a mixer, zero
  knowledge, or blockchain-history deletion.
- Never invent low-level cryptography where maintained, reviewed
  secp256k1 primitives are available.
- New cryptographically secure ephemeral randomness is mandatory for every
  stealth-address derivation.

## 3. Standards and source of truth

Read current versions before implementation:

- ERC-5564: https://eips.ethereum.org/EIPS/eip-5564
- ERC-6538: https://eips.ethereum.org/EIPS/eip-6538
- ENS stealth-resolution RFC:
  https://discuss.ens.domains/t/rfc-privacy-preserving-names-ensip-for-stealth-address-resolution/22354
- ENS bounty brief:
  https://hackmd.io/@jGCNzvnnRsmgHaZHPAzgSQ/Hk8uzQNufl
- Common S3nse / Swarm:
  https://commons3nse.swarm-devrel.bzz.link/
- Swarm agent guide:
  https://commons3nse.swarm-devrel.bzz.link/guide/
- Swarm agent skills:
  https://docs.swarm.bzz.link/docs/develop/tools-and-features/ai-agent-skills/
- Mobula wallet portfolio:
  https://docs.mobula.io/rest-api-reference/endpoint/wallet-portfolio

The ENS text-record convention to implement is:

```text
stealth-meta-address[1]
```

Scheme 1 means the ERC-5564 secp256k1 + view-tag scheme. Validate every
assumption against the standards and add tests.

## 4. Required product flow

### A. Scan an existing ENS identity

- Accept an arbitrary ENS name.
- Resolve its conventional ETH address.
- Explain that a static human-readable-name-to-wallet mapping permits
  public correlation.
- Use mainnet read-only resolution for `skrillah.eth`.
- Do not automatically show the user's full balance on a projector.

### B. Create a private receive identity

- Generate spending and viewing keypairs locally with a cryptographically
  secure RNG.
- Construct a valid ERC-5564 scheme-1 stealth meta-address.
- Show the exact value to publish in `stealth-meta-address[1]`.
- Support publishing that record to a controlled test ENS name/subname on
  Sepolia.
- Enforce explicit network checks before any write.
- Do not send private key material to a backend.

### C. Pay an ENS name privately

- Resolve `stealth-meta-address[1]`.
- Parse and validate the value.
- Generate a new ephemeral key locally for every attempt.
- Derive the stealth address locally according to ERC-5564.
- Generate the announcement/view-tag data needed for recipient discovery.
- Prove that two derivations for the same ENS name produce different
  destination addresses.
- Send a small amount of Sepolia ETH through a deliberate user action.
- Keep a deterministic demo path without hard-coding output addresses.

### D. Receive and recognise

- Implement a scanner for the demo's ERC-5564 announcements.
- Use the recipient viewing key to identify owned payments.
- Prove that an unrelated viewing key cannot recognise the payment.
- Derive and verify the associated stealth spending key.
- Test that the derived private key maps to the expected destination.
- Avoid uncontrolled full-chain scanning; constrain the demo by chain,
  contract, block range or known start block.

### E. Privacy Exit

Build a concise screen separating:

**Past — cannot be erased**
- Historic transactions.
- Historic ENS ownership/state.
- Previously published data.

**Present — current exposure can be reduced**
- Current public ENS records.
- Primary-name/profile associations where relevant.
- Explain possible clean-up, but do not execute destructive actions by
  default.

**Future — GhostName**
- Keep the human-readable identity.
- Publish a stealth meta-address.
- Receive at one-time addresses.
- Reduce future linkage caused by recipient-address reuse.

## 5. Threat model

### Protected

- Straightforward linkage between an ENS name and future one-time receiving
  addresses by ordinary passive observers.
- Repeated recipient-address reuse.
- Dependence on an address-generation gateway, because ephemeral key
  generation occurs locally.
- Recipient discovery of their own payments without publishing their
  viewing/spending secrets.

### Not protected

- Historical blockchain activity.
- Existence or ownership of the ENS name.
- The public stealth meta-address itself.
- Sender identity when the sender uses a public wallet.
- Amounts in ordinary ETH/ERC-20 transfers.
- Timing, network, RPC, browser-fingerprinting or broader correlation
  attacks.
- A compromised recipient device.
- Exposed viewing or spending keys.
- Identity information already known to the sender.
- Information already downloaded from storage.

The UI and README must state these boundaries visibly.

## 6. Recommended stack

Prefer a small, reliable TypeScript application:

- Vite + React + TypeScript, unless Next.js has a concrete server-side need.
- viem for Ethereum RPC and contract calls.
- wagmi only where it simplifies wallet state.
- Current maintained secp256k1 primitives, such as a reviewed noble-family
  package if technically suitable.
- Web Crypto for local symmetric encryption where needed.
- Vitest for unit and integration tests.
- A minimal serverless proxy only for secrets such as a Mobula API key.
- No database unless a proven core requirement appears.

Before choosing an ERC-5564 helper library, verify:

1. maintenance status;
2. scheme-1 compatibility;
3. sender-side generation;
4. receiver-side checking;
5. spending-key derivation;
6. browser compatibility;
7. test-vector or reference compatibility.

Do not blindly clone prior hackathon code.

## 7. Networks

- Ethereum Mainnet: read-only ENS demonstration.
- Sepolia: controlled ENS record write, payments and announcements.
- Hard-fail on the wrong network before every write.
- No silent transaction requests.
- Record exact chain IDs, resolver/announcer addresses, start blocks and
  test-name configuration in the README and BUILD_STATUS file.
- Confirm current deployed contract addresses from official sources; do not
  rely on model memory.

## 8. P0 acceptance criteria

The core is not complete until all pass:

- [ ] Arbitrary ENS name resolves correctly.
- [ ] Valid ERC-5564 scheme-1 spending/viewing keys are generated locally.
- [ ] A valid stealth meta-address is constructed and parsed.
- [ ] `stealth-meta-address[1]` is read from ENS.
- [ ] The record can be written for a controlled Sepolia test identity.
- [ ] Two sender derivations produce distinct stealth destinations.
- [ ] Independent cryptographically secure randomness is used each time.
- [ ] Receiver viewing key recognises the intended payment.
- [ ] Random/unrelated viewing key does not recognise it.
- [ ] Derived stealth spending key maps to the destination address.
- [ ] At least one genuine Sepolia payment completes end to end.
- [ ] The relevant announcement is emitted and discovered.
- [ ] Private keys never appear in logs, analytics or network requests.
- [ ] Mainnet writes are blocked by default.
- [ ] Clean-install typecheck, tests and production build pass.
- [ ] Reproduction instructions work.

Core tests should cover deterministic known vectors where the standard or
reference implementation permits them, plus randomly generated
round-trips, malformed meta-addresses, wrong view tags, wrong viewing keys,
freshness of ephemeral keys and network/write guards.

## 9. Feature priority

### P0 — mandatory

ENS + ERC-5564:

```text
generate → publish/read → derive → send/announce → recognise → recover
```

### P1 — strongly desired

Privacy Exit, threat-model UI and clear static-versus-stealth comparison.

### P2 — optional Mobula

After P0 works, add a small public-exposure panel:

```text
ENS name
→ conventional resolved wallet
→ Mobula wallet portfolio query
→ high-level exposure categories/counts
```

Keep the Mobula key server-side. Do not reveal the user's full holdings by
default. Include a deliberate reveal control. This integration must support
the core story rather than becoming a separate dashboard.

### P3 — optional Swarm

After P0 works:

1. deploy the static application to Swarm; or
2. optionally upload a **client-side encrypted, testnet-only** recovery
   capsule.

Install the official Common S3nse Swarm Claude skills and run `/swarm` if
the environment supports it. Never upload plaintext keys. Never imply that
deleting a reference retracts data someone has already downloaded.

### Ruthless cut rule

If P0 is not reliable, remove P2 and P3. One correct privacy primitive is
better than several incomplete integrations.

## 10. Milestone order

### M0 — cryptographic proof before UI

Automated tests prove:

```text
meta-address
+ ephemeral secret A → stealth address A
+ ephemeral secret B → stealth address B
A != B
recipient viewing key recognises A and B
unrelated viewing key recognises neither
derived spending keys map to A and B
```

### M1 — ENS

Read arbitrary ENS data, generate the scheme-1 record, and write/read it
for a controlled Sepolia identity.

### M2 — end-to-end transaction

Generate a destination, send Sepolia ETH, emit/find announcement, recognise
payment and verify spending control.

### M3 — product story

Build the static-versus-stealth flow, Privacy Exit and threat-model UI.

### M4 — optional bounties

Mobula exposure panel, then Swarm deployment/recovery.

### M5 — hardening

Clean install, tests, build, deployment, README, demo recording and
submission.

After each milestone:

```text
typecheck
test
production build
update 03_BUILD_STATUS.md
commit working state
```

## 11. Interface

Use a dark, restrained cypherpunk aesthetic. Keep one obvious action per
screen. Use large ENS names and addresses. Prominently visualise:

```text
BEFORE
name.eth
   ↓ every payment
0xSTATIC

AFTER
name.eth
   ├─ payment → 0xA
   ├─ payment → 0xB
   └─ payment → 0xC
```

Avoid dashboard clutter, fake metrics and decorative protocol logos.

Suggested routes:

- `/` — concise problem and CTA.
- `/scan` — conventional ENS resolution and current exposure.
- `/create` — local private-receive identity and test record publishing.
- `/pay` — ENS-to-fresh-stealth-destination payment.
- `/receive` — scan and recognise.
- `/privacy` — protected/not protected; past/present/future.
- `/demo` — deterministic 90-second route using live calls.

## 12. Repository deliverables

At minimum:

```text
README.md
PRIVACY.md
ARCHITECTURE.md
DEMO.md
.env.example
03_BUILD_STATUS.md
src/
tests/
working deployed application
```

README opening order:

1. Problem.
2. Threat model.
3. Privacy mechanism.
4. Why ENS is functionally essential.
5. What is protected.
6. What is not protected.
7. Architecture.
8. Live demo.
9. Local reproduction.
10. Tests.
11. Contracts/networks.
12. Known limitations.
13. Optional integrations actually implemented.

## 13. Demo mode

Use `skrillah.eth` as a pre-filled input only; all resolution calls must be
live and all logic generic.

Target sequence:

1. “This is skrillah.eth, an established public identity.”
2. Resolve its existing static address read-only.
3. “I cannot delete its history.”
4. Switch to the controlled GhostName-enabled test ENS identity.
5. Resolve privately to address A.
6. Resolve again to address B.
7. Highlight `A != B`.
8. Send a small Sepolia payment to A.
9. Switch to recipient mode.
10. Discover A using the viewing key.
11. Show that an unrelated key cannot detect it.
12. Show the threat model.
13. Close: “Keep the name. Break the payment graph.”

The demo must be deterministic operationally, not hard-coded
cryptographically. Preload safe test configuration and block ranges, not
fake outputs.

## 14. Failure handling and fallback

Largest likely risks:

1. Incomplete or incompatible ERC-5564 library support.
2. Incorrect key derivation or announcement parsing.
3. Sepolia ENS/resolver configuration friction.
4. Slow/unreliable announcement scanning.
5. Live RPC, wallet or faucet failures.

Mitigations:

- Prove M0 first.
- Compare against official specification/reference behavior.
- Keep a narrow known block range.
- Use more than one configured RPC endpoint.
- Fund test wallets before travel.
- Record a two-minute backup demo by Friday night.
- Cache only non-secret demo metadata; never fake cryptographic results.
- Keep an already-configured test ENS identity/subname.

### Pivot trigger

If M0 cannot pass its positive and negative cryptographic tests by the
agreed Wednesday checkpoint, stop polishing and pivot to **VeilProfile**.

VeilProfile fallback:

- ENS remains the stable identity/discovery layer.
- Sensitive profile fields are encrypted client-side and stored on Swarm.
- Use Swarm ACT where technically appropriate.
- Demonstrate OWNER, AUTHORISED VIEWER and UNAUTHORISED VIEWER.
- Prove public ENS contains no sensitive fields.
- Prove authorised decryption and unauthorised failure.
- Publish a new version, revoke access and prove the revoked viewer cannot
  retrieve the new protected version.
- State that revocation cannot erase information already downloaded.
- Keep arbitrary ENS-name support and prioritise the grant/update/revoke
  proof over visual polish.

Do not attempt both products simultaneously.

## 15. Claude operating rules

- Inspect the existing repo before choosing structure.
- Read current standards rather than relying on memory.
- Begin with the smallest end-to-end cryptographic test.
- Make sensible hackathon defaults and keep moving.
- Do not ask broad product questions.
- Ask before secrets/API keys, real-asset risk or irreversible/mainnet
  transactions.
- Work in small reviewable commits.
- Do not delete working code without preserving a commit.
- Run typecheck, tests and build after every milestone.
- Update `03_BUILD_STATUS.md` after every milestone and meaningful failure.
- Record exact commands and outputs needed to reproduce.
- Do not call a feature complete until its acceptance test passes.

# GhostName: Demo and Submission Checklist

## Deadline

- Engineering freeze: Friday night, 4 September 2026.
- Final submission: Saturday, 5 September 2026 at 09:00 Amsterdam time.
- Do not plan any Sunday engineering.

## 90-second live demo (web flow)

1. Open the deployed `/demo` route.
2. Enter an established ENS name (or use your locally configured pre-fill).
3. Click *Audit on mainnet (read-only)* and point at the static address.
4. Say: “This identity has years of useful history, but that also makes it
   a privacy liability.”
5. Say: “I wondered whether I could delete it. I cannot. Blockchain history
   does not have a delete button.”
6. Enter the controlled Sepolia GhostName identity and click *Check
   conformance*.
7. Click *Derive A, B and C*; highlight that none of them match.
8. Click *Run recognition test*: the intended viewing key recognises, an
   unrelated key finds nothing.
9. Click *Verify the payment and announcement*: the published Sepolia
   payment is re-verified from chain data, including the binding between the
   announcement and the funded address.
10. Click *Verify the sponsored exit*: the sponsored EIP-7702 sweep is
    re-verified from chain data, with its not-proven list.
11. Optional, with a funded Sepolia wallet: on `/pay` review the two
    transactions shown before signing and send a small payment; on
    `/receive` scan and point at the balance read from chain, the negative
    control and the spending-key check.
12. Show the boundary step (or `/privacy`): protected versus not protected.
13. Close: “Blockchains do not have a delete button. GhostName gives
    established identities a forward-privacy button. Keep the name. Break
    the payment graph.”

## Three-minute agent demo (Claude Code flow)

Full sequence with expected outputs in `AGENT_DEMO.md`; slide order in
`SLIDES.md` under "Agent demo variant".

1. Connect Claude Code to the local GhostName MCP server (stdio, read-only).
2. Ask: “Audit name.eth and help me improve its privacy.” (your locally
   configured established mainnet name; never commit it).
3. Show the audit call: only a name and a chain id go in.
4. Show INCOMPLETE with stable codes, one unknown, and the limitations.
5. Show the prepare-upgrade result and open the secure handoff link.
6. Point at “key generation happens here, outside the agent”; do not publish
   for the mainnet name.
7. Say what the agent never received: no key, no record value, no calldata,
   no wallet.
8. Ask: “Audit ghostname-3c7714.eth on Sepolia.” Show PRIVATE-READY for
   compatible senders.
9. Ask the agent to verify the real payment and announcement: VERIFIED, 8 of 8.
10. Ask the agent to verify the real sponsored exit: VERIFIED, 8 of 8, with
    the not-proven list.
11. Close: “GhostName gives AI agents evidence and gives humans control.
    Keep the ENS name. Break the payment graph.”

## Privacy claim card

### Protects

- Future recipient-address reuse/linkage.
- Simple ENS-to-receiving-address correlation by passive observers.
- Gateway-controlled ephemeral-key generation.
- Private recipient recognition keys.

### Does not protect

- Old ENS or transaction history.
- ENS ownership.
- Sender identity.
- Ordinary transfer amounts.
- Timing/network metadata.
- Compromised devices or leaked keys.

### Agent boundary

- The agent layer is read-only: no wallet, no signing, no ENS writes, no key
  custody, no payment-destination derivation on request.
- Enforced by an import-boundary test, not by tool annotations.
- Local stdio mode: no GhostName API call, no analytics, no query history.

## Before recording or presenting

- [ ] Fresh clean install succeeds.
- [ ] Typecheck passes.
- [ ] Tests pass.
- [ ] Production build passes.
- [ ] `npm run build:agent` passes.
- [ ] Claude Code lists the five `ghostname_*` tools.
- [ ] `node dist-agent/ghostname.mjs audit name.eth --chain 1` reads
      INCOMPLETE; `ghostname-3c7714.eth --chain 11155111` reads PRIVATE-READY.
- [ ] Deployed URL loads on venue Wi-Fi and phone hotspot.
- [ ] Backup RPC works; the agent layer uses the same `.env` values.
- [ ] Wallet is on Sepolia.
- [ ] Test wallet has enough Sepolia ETH.
- [ ] Test ENS record resolves.
- [ ] Scanner start block is correct.
- [ ] No sensitive balance is shown by default.
- [ ] Browser console contains no private key material.
- [ ] Agent transcript contains no private key material (there is none to leak).
- [ ] Screen zoom is readable from a projector.
- [ ] Two-minute backup video exists offline and online; optional 45-second
      agent cut recorded.

## Repository/submission

- [ ] Public accessible repository.
- [ ] Project description.
- [ ] Working application.
- [ ] Working video.
- [ ] In-person presenter.
- [ ] README leads with problem, threat model and privacy mechanism.
- [ ] README has the AI agents section; `AGENTS.md`, `llms.txt`,
      `AGENT_DEMO.md`, `AGENT_DISCOVERY.md` and `server.json` are present.
- [ ] ENS has a meaningful function beyond display/resolution.
- [ ] Actual privacy mechanism is explained.
- [ ] Information protected, adversary and mechanism are explicit.
- [ ] No hard-coded cryptographic demonstration.
- [ ] Contracts, networks, test names and reproduction steps documented.
- [ ] Known limitations documented.
- [ ] Mobula and Swarm mentioned only if actually working.
- [ ] Agent capability described as read-only; never as an autonomous wallet.

## Friday freeze rule

After the backup demo is recorded, accept only fixes that address a failed
acceptance test or presentation-breaking bug. Do not add new features.

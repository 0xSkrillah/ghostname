# GhostName — Demo and Submission Checklist

## Deadline

- Engineering freeze: Friday night, 4 September 2026.
- Final submission: Saturday, 5 September 2026 at 09:00 Amsterdam time.
- Do not plan any Sunday engineering.

## 90-second live demo

1. Open the deployed `/demo` route.
2. Enter or use pre-filled `skrillah.eth`.
3. Resolve its conventional mainnet address read-only.
4. Say: “This identity has years of useful history, but that also makes it
   a privacy liability.”
5. Say: “I wondered whether I could delete it. I cannot. Blockchain history
   does not have a delete button.”
6. Switch to the controlled Sepolia GhostName identity.
7. Resolve `stealth-meta-address[1]` and derive address A locally.
8. Derive again and show address B; highlight A is not B.
9. Send a small Sepolia payment to A.
10. Show the ERC-5564 announcement.
11. Switch to recipient mode.
12. Scan the constrained block range and recognise A with the viewing key.
13. Run/show the unrelated-viewing-key negative result.
14. Show the protected/not-protected page.
15. Close: “Blockchains do not have a delete button. GhostName gives
    established identities a forward-privacy button. Keep the name. Break
    the payment graph.”

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

## Before recording or presenting

- [ ] Fresh clean install succeeds.
- [ ] Typecheck passes.
- [ ] Tests pass.
- [ ] Production build passes.
- [ ] Deployed URL loads on venue Wi-Fi and phone hotspot.
- [ ] Backup RPC works.
- [ ] Wallet is on Sepolia.
- [ ] Test wallet has enough Sepolia ETH.
- [ ] Test ENS record resolves.
- [ ] Scanner start block is correct.
- [ ] No sensitive balance is shown by default.
- [ ] Browser console contains no private key material.
- [ ] Screen zoom is readable from a projector.
- [ ] Two-minute backup video exists offline and online.

## Repository/submission

- [ ] Public accessible repository.
- [ ] Project description.
- [ ] Working application.
- [ ] Working video.
- [ ] In-person presenter.
- [ ] README leads with problem, threat model and privacy mechanism.
- [ ] ENS has a meaningful function beyond display/resolution.
- [ ] Actual privacy mechanism is explained.
- [ ] Information protected, adversary and mechanism are explicit.
- [ ] No hard-coded cryptographic demonstration.
- [ ] Contracts, networks, test names and reproduction steps documented.
- [ ] Known limitations documented.
- [ ] Mobula and Swarm mentioned only if actually working.

## Friday freeze rule

After the backup demo is recorded, accept only fixes that address a failed
acceptance test or presentation-breaking bug. Do not add new features.

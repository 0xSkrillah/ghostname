# GhostName: category map and moat

## The category

Stealth payments on Ethereum are becoming a stack rather than a product. Most
projects sit at one layer. GhostName sits at a different one, deliberately.

| Project | Layer | What it operates |
|---|---|---|
| Fluidkey | account and wallet infrastructure | its own key and account system |
| Cloaked | account and wallet infrastructure | its own key and account system |
| Umbra | core standard implementation | the reference ERC-5564 payment flow |
| Sneaky | ENS resolution plus privacy-pool exit | resolution combined with a pool |
| **GhostName** | **conformance, migration and lifecycle assurance** | **nothing on the user's behalf** |

That last row is the point. GhostName does not custody keys, does not issue
accounts, and does not sell a subdomain. It works on the ENS identity a user
already owns.

## Present differentiator

1. **Audit before you trust.** GhostCheck reads any ENS name and reports whether
   it is ready to receive private payments, using the emerging stealth
   resolution convention: chain-specific record first, then the all-chain
   default, with malformed and conflicting records surfaced rather than ignored.
2. **Upgrade in place.** The user keeps their existing name. No service-owned
   subdomain, no migration to a new identity, no new wallet provider to trust.
3. **Strict local derivation.** One-time addresses are derived in the sender
   client, so no address-generation gateway ever learns the destination.
4. **Visible trust assumptions.** Resolver, record source, derivation path and
   withdrawal path are all shown. Anything that cannot be established from
   on-chain evidence is reported as unknown, never as a green result.
5. **Independently inspectable evidence.** Audit reports export as JSON, and the
   sponsored exit is verified from chain data at runtime rather than asserted
   from a configured claim.
6. **The whole lifecycle, including the exit.** Receiving privately is only half
   the problem. Funding a stealth address for gas re-links it, so GhostName
   produces a complete destination-bound sponsored sweep package and verifies a
   real one on-chain.

No claim is made that GhostName is the first, the only, or the most private
tool in this space. The differentiator is the layer, not a superlative.

## Remaining limitations

- Resolver provenance, meaning direct versus inherited or wildcard control, is
  reported as unknown. Proving it needs registry evidence that is not uniformly
  available across ENS v1 and v2.
- The sweep executor is an unaudited testnet demo contract.
- No production relayer is operated. The demo sponsor is a throwaway wallet.
- The ENS stealth-resolution RFC is still evolving, so record conventions are
  implemented as the current proposal rather than a ratified requirement.
- Announcement scanning uses bounded log queries over public RPCs, not an
  indexer.
- Forward privacy only. History, amounts, sender identity and timing stay public.

## Post-hackathon moat roadmap

The moat is a corpus and a set of integrations, not a secret algorithm.

1. **npm audit SDK.** Publish the audit core so wallets and dapps can run the
   same conformance check GhostCheck runs, with the same honest unknowns.
2. **CLI.** `ghostcheck name.eth` for scripting and CI, emitting the same
   versioned JSON report.
3. **Resolver compatibility corpus.** A growing, public record of how real
   resolvers behave against the convention. This is the asset that compounds:
   it cannot be cloned quickly because it accrues from observation over time.
4. **Conformance fixtures.** Shared test vectors so independent implementations
   can prove interoperability rather than assert it.
5. **Wallet CI integration.** Let a wallet fail its build when a change breaks
   stealth-record conformance.
6. **Historical configuration monitoring.** Alert a name owner when their
   resolver or records change in a way that weakens forward privacy.

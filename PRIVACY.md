# GhostName — Privacy Claims, Precisely

This document is the authoritative statement of what GhostName does and does
not protect. The `/privacy` page in the app mirrors it. If any marketing
line and this document disagree, this document wins.

## The adversary

The ordinary passive blockchain observer: anyone with a block explorer, an
indexer, or an analytics platform, watching public Ethereum data and ENS
records, **without** access to your devices or private keys, and without
out-of-band knowledge of who is paying whom.

## Protected against that adversary

| Claim | Mechanism |
|---|---|
| Future payments to your ENS name do not accumulate on one linkable address | Every sender derives a fresh one-time stealth address (ERC-5564 scheme 1) |
| The observer cannot link a stealth destination to your name | Linking requires the private viewing key: `s_h = keccak256(compress(p_view · P_eph))` |
| No gateway learns your incoming destinations | Ephemeral keys + derivation happen in the sender's client; there is no server |
| Discovering your payments does not expose your keys | Scanning runs locally against public announcement data |

## Explicitly NOT protected

1. **The past.** Historic transactions, historic ENS records, anything
   already published or archived. Nothing can delete blockchain history.
2. **Name ownership.** That you own/control the ENS name stays public.
3. **The meta-address record.** `stealth-meta-address[1]` is public by
   design. Observers know the name *can* receive stealth payments — they
   just cannot see *where*.
4. **Sender identity.** A sender paying from their public wallet exposes
   themselves, and the payment amount, in the ordinary way.
5. **Amounts.** Plain ETH/ERC-20 transfer values are public.
6. **Correlation side channels.** Timing analysis, RPC/network metadata,
   browser fingerprinting, amount fingerprinting.
7. **Compromised endpoints.** A compromised browser/device, or leaked
   viewing/spending keys, defeats everything. The viewing key alone lets an
   attacker *link* payments (not steal); the spending key lets them steal.
8. **Human knowledge.** Someone who already knows they are paying you knows
   they are paying you.

## Words we do not use

"Anonymous", "untraceable", "mixer", "zero-knowledge", "delete history",
"erase your past". GhostName provides none of these and does not claim to.

## Spending caveat

Funds land on fresh addresses controlled by keys only you can derive.
Spending them requires gas; funding that gas carelessly (e.g. from your
public main wallet) can re-link the address to you. Production stealth
ecosystems use relayers/paymasters for this; the hackathon build stops at
receive + prove-control (see README limitations).

## Data handling in the app

- Private keys: generated in-browser via CSPRNG, optionally stored in
  `localStorage` (demo convenience), never transmitted, never logged.
- No analytics, no cookies, no backend, no telemetry.
- RPC endpoints see your IP and your queries, like any dapp — pin your own
  endpoints in `.env` if this matters to you.

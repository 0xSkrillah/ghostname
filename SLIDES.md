# GhostName — Demo Slide Copy

Copy for a ~9-slide deck backing the 90-second live demo. Keep slides sparse:
one idea each, large type, the live app carries the proof. Speaker notes are
what you *say*; on-slide text is only the bolded lines.

---

## Slide 1 — Title

**GhostName**
**Keep the ENS name. Break the payment graph.**

<sub>ERC-5564 stealth addresses, resolved through ENS. Common S3nse Amsterdam 2026.</sub>

> Speaker: "GhostName gives an established ENS identity forward privacy."

---

## Slide 2 — The problem

**Your ENS name is your identity.**
**It's also a permanent, public record of every payment you've ever received.**

> Speaker: "skrillah.eth is years of history. Every payment to it is one static
> address anyone can watch — balances, counterparties, timing. That's the cost
> of a memorable name."

---

## Slide 3 — The uncomfortable truth

**You can't delete it.**
**Blockchains don't have a delete button.**

> Speaker: "I looked into clearing it. You can't. The past is permanent. So the
> only honest question is: what happens to the *next* payment?"

---

## Slide 4 — The idea

**Keep the name. Publish one record. Every future payment lands on a fresh
address only you can find.**

`name.eth  →  0xA · 0xB · 0xC …`  *(a new address every time)*

> Speaker: "One ENS text record — a stealth meta-address — and every sender
> derives a brand-new one-time address, locally, in their own browser. No
> gateway. No coordination with you."

---

## Slide 5 — LIVE: derive (switch to /demo)

**Same name, twice → two different addresses.**

> Speaker: (resolve the test name → A, resolve again → B) "Same name. Different
> destination. A ≠ B. That's the payment graph breaking, live."

---

## Slide 6 — LIVE: pay & discover (/pay → /receive)

**Only your viewing key can find your money. A stranger's key finds nothing.**

> Speaker: (send, then scan) "I pay it, announce it, switch to the recipient.
> My viewing key recognises the payment; a random key recognises zero. Then I
> prove I can spend it — and sweep it out with a sponsored transaction, so the
> stealth address never even needs gas."

---

## Slide 7 — What it does and doesn't do

**Protects:** future receiving addresses · address reuse · no gateway trust
**Doesn't:** delete history · hide the amount · hide the sender

> Speaker: "This is forward privacy — not anonymity, not a mixer, not erasing
> the past. We say exactly what we protect and what we don't."

---

## Slide 8 — Built, not slideware

**Live on Sepolia · 90+ tests · byte-identical to the ERC-5564 reference**
Registered a real ENS name · published the record · paid · scanned · recovered ·
**swept via a sponsored EIP-7702 transaction — all on-chain.**

> Speaker: "Everything you just saw is live, not mocked. Standards-correct
> crypto, real transactions, honest scope."

---

## Slide 9 — Close

**Blockchains don't have a delete button.**
**GhostName gives established identities a forward-privacy button.**
**Keep the name. Break the payment graph.**

<sub>github.com/0xSkrillah/ghostname · 0xskrillah.github.io/ghostname</sub>

---

## One-line elevator version (if you get 15 seconds)

> "An ENS name ties your identity to one wallet forever. GhostName keeps the
> name but sends every future payment to a fresh, unlinkable address — real
> ERC-5564 stealth addresses, resolved through ENS, proven live on Sepolia."

## Title-slide alternates (pick the room's energy)

- "Keep the ENS name. Break the payment graph." *(default — the tagline)*
- "Your name is forever. Your payment history doesn't have to be."
- "Forward privacy for the identity you already have."

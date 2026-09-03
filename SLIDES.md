# GhostName Demo Slide Copy

Structured Minto style: the governing thought comes first, every headline is a
full assertion (the "so what"), and the slides beneath it supply the support.
No em dashes. Keep slides sparse: one assertion each, large type, the live app
carries the proof. Speaker notes are what you say; on-slide text is the bolded
lines only.

The governing thought, stated once: **GhostName keeps your ENS name and unlinks
every future payment.** Everything below supports that single claim.

---

## Slide 1. Governing thought (title)

**GhostName is the open privacy-assurance layer for ENS: audit, upgrade, prove.**

<sub>Keep the ENS name. Break the payment graph. ERC-5564 stealth addresses, resolved through ENS. Common S3nse Amsterdam 2026.</sub>

> Speaker: "One sentence: GhostName audits any ENS name for privacy readiness, upgrades the identity you already own, and proves the whole payment lifecycle. Keep the name, unlink every future payment."

---

## Slide 2. Why it matters

**Your ENS name ties your identity to one wallet, forever.**

Every payment to that wallet is public, permanent, and linkable to your name.

> Speaker: "An established ENS name is years of reputation. It also resolves to one static address, so anyone can read every payment it has ever received: balances, counterparties, timing. The name is the convenience and the leak at once."

---

## Slide 3. Why now

**You cannot undo the past, so control the future.**

Blockchains have no delete button. The only variable left is the next payment.

> Speaker: "I checked whether I could clear the history. I cannot. The past is permanent. So the honest question is narrow: what happens to the next payment, and the one after that."

---

## Slide 4. The answer

**One published record sends every future payment to a fresh address only you can find.**

You publish a stealth meta-address on ENS. Each sender derives a new one-time address locally. No gateway, no coordination with you.

> Speaker: "One ENS text record. Every sender's own browser derives a brand new destination for each payment. You never touch it, and no service sits in the middle."

---

## Slide 5. Proof, part one (live on /demo)

**The same name resolves to a different address every time.**

`name.eth  →  0xA` , then `name.eth  →  0xB` , and `0xA` is not `0xB`.

> Speaker: (resolve once, resolve again) "Same name. Two resolutions. Two different destinations. That is the payment graph breaking, live."

---

## Slide 6. Proof, part two (/pay then /receive)

**Only your viewing key finds your money; a stranger's key finds nothing.**

Pay, announce, then scan as the recipient. Recover the key, then sweep the funds with a sponsored transaction so the stealth address never needs gas.

> Speaker: "I pay it and announce it. As the recipient my viewing key recognises it; a random key recognises zero. I prove I can spend it, and sweep it out with a sponsored transaction the stealth address never pays gas for."

---

## Slide 7. Honest scope

**This is forward privacy, stated plainly.**

Protects: future receiving addresses, address reuse, no gateway to trust.
Does not: delete history, hide the amount, hide the sender.

> Speaker: "Forward privacy, not anonymity, not a mixer, not erasing the past. We name exactly what we protect and exactly what we do not."

---

## Slide 7b. Why this is not another stealth wallet

**Others operate accounts. GhostName operates assurance.**

Fluidkey and Cloaked run wallet infrastructure. Umbra implements the core
standard. Sneaky pairs ENS resolution with a privacy pool. GhostName audits,
upgrades and proves the identity you already own, and custodies nothing.

> Speaker: "We are not asking you to move to a new wallet or buy a subdomain from us. We check the name you already have, upgrade it in place, and hand you evidence you can verify yourself."

---

## Slide 8. Credibility

**Every claim here is live on Sepolia, not mocked.**

Real ENS name registered, record published, payment sent, scanned, recovered, and swept via a sponsored EIP-7702 transaction. Standards-correct ERC-5564, more than 240 deterministic tests, byte-identical to the reference implementation.

> Speaker: "None of this is slideware. Real transactions, standards-correct cryptography, and a scope we state honestly."

---

## Slide 9. Close (restate the governing thought)

**GhostName gives established identities a forward-privacy button.**

Keep the ENS name. Break the payment graph.

<sub>github.com/0xSkrillah/ghostname · 0xskrillah.github.io/ghostname</sub>

> Speaker: "Blockchains have no delete button. GhostName gives the identity you already have a forward-privacy button. Keep the name. Break the payment graph."

---

## Fifteen-second version

> "An ENS name ties your identity to one wallet forever. GhostName keeps the name but sends every future payment to a fresh one-time address that a passive observer cannot link to the name. Real ERC-5564 stealth addresses, resolved through ENS, proven live on Sepolia."

## Title-slide alternates

- "Keep the ENS name. Break the payment graph." (default tagline)
- "Your name is forever. Your payment history does not have to be."
- "Forward privacy for the identity you already have."

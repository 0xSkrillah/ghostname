# GhostName: Slide Deck Copy for Claude Design

Final copy for the layout pass in Claude Design. Minto structure: the governing thought comes first,
every headline is one full-sentence assertion, and the support sits beneath it.
The deck runs in Minto order: governing thought (slide 1), situation (slide 2),
complication (slide 3), answer (slides 4 to 6), proof (slides 7 to 10), scope
and positioning (slides 11 to 13), close (slide 14). A judge reaches the
evidence before the boundary that the evidence earns. On-slide text is sparse;
the speaker notes carry the argument. No em dashes anywhere in this document or
on any slide.

The governing thought, stated once: **GhostName keeps your ENS name and unlinks
every future payment.** Every slide below supports that single claim.

---

## Deck brief for Claude Design

**Audience.** Hackathon judges, ENS engineers, privacy engineers. They will
forgive plain slides and punish invented numbers.

**Venue.** Common S3nse Amsterdam 2026 (hackathon entry). Projector, large
room: type must be large and contrast high.

**Format.** 16:9, canvas 1920 x 1080. Dark, restrained cypherpunk. One idea per
slide. Large monospace ENS names and addresses. No decorative protocol logos.
No fake metrics: every number on a slide is in this document with a source, and
nothing else may be added. Never invent an address or a transaction hash;
where a live value belongs, use the placeholders the app itself uses
(`0xA… fresh`, `0xSTATIC…same every time`).

Minimum sizes for the room: headline 72 px, on-slide sentences 36 px, mono
lines 30 px, captions and sources 24 px. If a VISUAL does not fit at those
sizes, cut elements as the VISUAL instructs; never shrink the type.

Hashes and addresses that are shortened use the README form: first ten
characters, ellipsis, last six (`0x2430f7f8…dc248b`). `README.md` line 283 and
`RELAYERS.md` line 69 print the sweep hash with a five-character tail
(`0x75a9da4e…89c25`); the deck applies the six-character rule to it as well,
so it reads `0x75a9da4e…089c25`. Motif addresses use the app placeholders
verbatim and are never shortened further. Full hashes are listed in this
document wherever a link target is needed.

**Palette** (from `src/styles.css`, `:root`, lines 1 to 19). Keep the variable
names in the layer names so the deck and the app stay in sync.

| Variable | Value | Use in the deck |
|---|---|---|
| `--bg` | `#0a0e12` | slide background |
| `--bg-raised` | `#10161d` | cards, table rows, terminal panels |
| `--bg-inset` | `#070a0d` | fields and code blocks |
| `--border` | `#1e2a35` | card and table borders |
| `--border-strong` | `#46596e` | ghost buttons, neutral pills, control outlines |
| `--text` | `#d7e1ea` | headlines and body |
| `--text-dim` | `#7a8a99` | captions, labels, sources |
| `--placeholder` | `#8c9cab` | placeholder text inside fields |
| `--accent` | `#4ef0b0` | the one emphasis colour: primary buttons, pass pills |
| `--accent-dim` | `#1d6b4f` | ok-card borders, secondary button borders |
| `--danger` | `#f06a6a` | danger cards, fail pills, the one destructive control |
| `--warn` | `#e8c268` | warn pills, and warning text (unresolved address on /demo step 1, /pay notices) |
| `--static-col` | `#f06a6a` | the BEFORE column and every static address |
| `--stealth-col` | `#4ef0b0` | the AFTER column and every one-time address |

Fixed values also in the stylesheet: primary button text on `--accent` is
`#05130c`; the BEFORE column border is `rgba(240, 106, 106, 0.4)`; the AFTER
column border is `rgba(78, 240, 176, 0.4)`; cards are radius 10px with a 1px
`--border`; buttons, fields and pills are radius 8px (pills 999px).

**Type** (from `src/styles.css`, lines 18, 51 to 57, 76 to 85, 110, 133 to
140 and 285).

- Mono stack `--mono`: `'Cascadia Code', 'JetBrains Mono', Consolas, 'SF Mono',
  monospace`. Use it for every name, address, record key, hash, command, pill
  and the brand wordmark.
- Body stack: `system-ui, -apple-system, 'Segoe UI', sans-serif`, line-height
  1.55. Use it for headlines and sentences. The app h1 is 1.9rem with
  letter-spacing -0.01em; on a slide, scale the headline to fill the width
  comfortably and keep the tight tracking.
- Brand wordmark: `ghostname` in `--mono`, weight 700, letter-spacing 0.06em,
  `--text`, with the `name` half in `--accent` (the nav brand in
  `src/components/Layout.tsx`).
- Labels (card headers): small, uppercase, letter-spacing 0.12em, `--text-dim`.
  Compare column titles: uppercase, letter-spacing 0.14em, coloured
  `--static-col` or `--stealth-col`. The source strings are sentence case; CSS
  uppercases them, so on screen they read in capitals.
- Pills: `--mono`, 1px border. `ok` is `--accent` text on an `--accent-dim`
  border; `bad` is `--danger`; `warn` is `--warn`; neutral is `--text-dim` on
  `--border-strong`.
- Fonts are not bundled with the app. Load JetBrains Mono for the mono role if
  the deck tool allows it and keep the rest of the stack as the fallback.

**Recurring visual motif: BEFORE versus AFTER.** This is the one diagram in the
product (`02_GHOSTNAME_MASTER_SPEC.md` section 11; `src/components/Compare.tsx`).
Render it as two side-by-side cards on `--bg-raised`:

```text
BEFORE: STATIC                         AFTER: GHOSTNAME
name.eth                               name.eth
   ↓ every payment                        ├─ payment → 0xA… fresh
0xSTATIC…same every time                  ├─ payment → 0xB… fresh
                                          └─ payment → 0xC… fresh
One public address accumulates         Every sender derives a fresh one-time
the entire payment history of          address. Only the recipient can link
the name.                              them.
```

Left card: border `rgba(240, 106, 106, 0.4)`, title and address in
`--static-col`. Right card: border `rgba(78, 240, 176, 0.4)`, title and the
three addresses in `--stealth-col`. The name is `--text`, the tree glyphs are
`--text-dim`, everything inside the tree is `--mono`, captions are `--text-dim`.
The motif progresses through the deck: slide 2 shows BEFORE only, slide 4 shows
both, slide 7 shows AFTER with the live A, B and C lines, slide 14 shows both
with BEFORE dimmed to about 40 percent opacity.

Slide 11 (the boundary) follows the app's boundary order, not the motif's:
Protected on the left in `--stealth-col`, Not protected on the right in
`--static-col` (`src/pages/Demo.tsx` lines 370 to 386). This is deliberate and
must not be swapped.

**House rules for the layout pass.**

- Word budgets: HEADLINE under 12 words, ON SLIDE under 30 words. Diagram node
  labels, table cells and terminal lines belong to VISUAL and sit outside the
  30-word budget, but keep them terse and never add prose there.
- The established mainnet name never appears anywhere; use `name.eth`. The
  controlled Sepolia demo name `ghostname-3c7714.eth` may appear.
- Never describe GhostName as anonymous, untraceable, a mixer, zero knowledge
  or history deletion. Saying it is not those things is correct (slide 11).
- No em dashes. Use commas, full stops or colons.
- Mainnet is read-only in the shipped build; no slide instructs a mainnet write.
- Quote UI labels exactly as written here; each is verified against source.
  Where a VISUAL abridges a UI sentence, it says so.

---

## Slide 1. Title: the governing thought

**Purpose.** State the single claim the deck supports, in the product's own
voice, with the venue.

**HEADLINE.** GhostName keeps your ENS name and unlinks every future payment.

**ON SLIDE.** The open privacy-assurance layer for ENS: audit, upgrade, prove.
Keep the ENS name. Break the payment graph. Common S3nse Amsterdam 2026.

**VISUAL.** Background `--bg`. Top left, the brand wordmark `ghostname` in
`--mono` weight 700 with `name` in `--accent`, large. The headline in the body
stack, `--text`, filling the width. Beneath it the tagline on one line with
`Break the payment graph.` in `--accent`, exactly as the Landing page h1.
Bottom right, the BEFORE versus AFTER motif at about one third scale, both
columns, as a quiet signature. Bottom left in `--text-dim`: the venue line.
Nothing else.

**SPEAKER NOTES.** "One sentence: GhostName audits any ENS name for privacy
readiness, upgrades the identity you already own, and proves the whole payment
lifecycle. Keep the name, unlink every future payment from every sender that
honours the record. Everything that follows supports that one claim."

**SOURCE.** Governing thought: the previous deck copy. The headline is the
canonical governing thought and is kept as written, compound clause included;
a strict single-assertion alternative would be "GhostName unlinks every future
payment without changing your ENS name." Positioning line and tagline:
`README.md` lines 3 to 8. Landing h1 with the accent span:
`src/pages/Landing.tsx` lines 7 to 9. Venue: `README.md` line 36;
`02_GHOSTNAME_MASTER_SPEC.md` line 5. Wordmark style: `src/styles.css` lines
76 to 85. "Compatible senders" qualification: `src/agent/format.ts` lines 15
to 17; `AGENT_DEMO.md` lines 131 to 134.

---

## Slide 2. The problem: a static mapping with a permanent history

**Purpose.** Make the leak concrete before naming any mechanism.

**HEADLINE.** Your ENS name ties your identity to one wallet, forever.

**ON SLIDE.** One static address. Every payment linkable to the name:
balances, counterparties, timing.

**VISUAL.** The BEFORE half of the motif only, large and centred left: card on
`--bg-raised` with border `rgba(240, 106, 106, 0.4)`, title `BEFORE: STATIC` in
`--static-col`, tree in `--mono`: `name.eth` (`--text`), `↓ every payment`
(`--text-dim`), `0xSTATIC…same every time` (`--static-col`), caption "One
public address accumulates the entire payment history of the name." To its
right, where the AFTER card will sit on slide 4, an empty dashed outline in
`--border` (a deliberate gap). Under both, a danger card (border `--danger`)
carrying the exact /scan sentence in bold `--text`: "This mapping is public and
permanent." The words public and permanent appear only in the danger card.

**SPEAKER NOTES.** "An established ENS name is years of reputation. It also
resolves to one static address, so anyone with a block explorer can read every
payment it has ever received: balances, counterparties, timing. The audit page
says it in one line: this mapping is public and permanent. The name is the
convenience and the leak at once."

**SOURCE.** Problem statement: `README.md` lines 41 to 47; `src/pages/Landing.tsx`
lines 10 to 14. Permanence card text: `src/pages/Scan.tsx` line 182; balances,
counterparties, timing: `src/pages/Scan.tsx` lines 183 to 185. BEFORE column
strings and caption: `src/components/Compare.tsx` lines 15 to 24. Adversary:
`PRIVACY.md` lines 24 to 29.

---

## Slide 3. Why now: there is no delete button

**Purpose.** Close the door on the wrong fix (erasing history) so the right one
lands on the next slide.

**HEADLINE.** The only payment you can still protect is the next one.

**ON SLIDE.** Blockchains have no delete button. The only variable left is the
next payment.

**VISUAL.** A three-card strip across the slide, left to right, using the exact
/privacy headings as card labels: `Past: cannot be erased` (card with `--danger`
border), `Present: current exposure can be reduced` (card with `--border`),
`Future: what GhostName adds` (card with `--accent-dim` border). Thin arrows in
`--text-dim` between the cards. Inside the past card, the three /privacy
bullets verbatim in `--text-dim`: "Historic transactions of any address the
name has resolved to."; "Historic ENS ownership and record state (public,
archived, replicated)."; "Anything already published or downloaded by others."
If the bullets do not fit at projector size, keep the three card labels only
and leave the bullets to the speaker notes. The future card stays empty except
for its label, lit by the `--accent-dim` border: it is filled on slide 4.

**SPEAKER NOTES.** "I checked whether I could clear the history. I cannot; the
past is public, archived and replicated: historic transactions of any address
the name has resolved to, historic ENS ownership and record state, anything
already published or downloaded by others. The app lays it out as past, present
and future: the past cannot be erased, present exposure can be reduced, and the
future is the only thing still open. So the honest question is narrow: what
happens to the next payment, and the one after that."

**SOURCE.** "Blockchains do not have a delete button": `SUBMISSION.md` line
367. "Blockchain history cannot be deleted. The only thing you can still choose
is what happens to future payments": `README.md` lines 46 to 47. Past, present
and future headings: `src/pages/Privacy.tsx` lines 14 to 47; the three past
bullets verbatim: `src/pages/Privacy.tsx` lines 17 to 19.

---

## Slide 4. The answer: one record, a fresh address per sender, derived locally

**Purpose.** Deliver the mechanism in one sentence and complete the motif.

**HEADLINE.** One published record sends every future payment to a fresh address.

**ON SLIDE.** Publish stealth-meta-address[1] on the name you own. Each
compatible sender derives a one-time address locally. No gateway, no new
wallet, no subdomain.

**VISUAL.** The full BEFORE versus AFTER motif, both cards at full size, exactly
as specified in the brief. The AFTER card now occupies the dashed gap left on
slide 2. Between the two cards, a single small mono label in `--text-dim`:
`stealth-meta-address[1]`, with a thin `--accent` arrow pointing into the AFTER
card. No other elements.

**SPEAKER NOTES.** "One ENS text record on the name you already own, key
stealth-meta-address[1]. Every compatible sender's own browser derives a
brand-new destination for each payment, with fresh randomness, and no service
sits in the middle. A sender that ignores the record and pays the old static
address links that payment as before. You keep the name: no service-owned
subdomain, no new wallet, no migration."

**SOURCE.** Motif strings and captions: `src/components/Compare.tsx` lines 7 to
45; spec diagram: `02_GHOSTNAME_MASTER_SPEC.md` lines 329 to 340. "Keep the
human-readable name, publish one ERC-5564 stealth meta-address record, and
every future sender derives a fresh one-time receiving address, locally, with
no gateway": `README.md` lines 36 to 40. "The name is kept. No service-owned
subdomain, no new wallet.": `src/pages/Demo.tsx` lines 216 to 218. What the
user avoids: `SUBMISSION.md` lines 352 to 358. Record key: `README.md` line 222.
Compatible senders only: `src/agent/format.ts` lines 15 to 17; `AGENT_DEMO.md`
lines 131 to 134; `README.md` lines 314 to 315.

---

## Slide 5. Why ENS is essential

**Purpose.** Make the ENS dependency structural, not decorative, before the
mechanism is drawn.

**HEADLINE.** You pay name.eth, not a 66-byte key blob.

**ON SLIDE.** Resolved through the ENS Universal Resolver, per the ENS
stealth-resolution RFC. Works for ENS v1 and v2 names.

**VISUAL.** A single horizontal three-node chain in large `--mono`, centred:
`name.eth` (`--text`) → `stealth-meta-address[1]` (`--text`) → `fresh one-time
address per payment` (`--stealth-col`), arrows in `--accent`. Below it, a card
on `--bg-inset` labelled (uppercase, `--text-dim`) `Records checked, in
precedence order`, holding a three-column record table in the app's plain
table style with uppercase `--text-dim` headers `Record key`, `Kind` and
`Result`, exactly what the audit reports for the demo name on Sepolia. Row one:
`stealth-meta-address[1][2158638759]` (`--mono`) | `chain-specific`
(`--text-dim`) | `absent` (`--text-dim` text, no pill). Row two:
`stealth-meta-address[1]` (`--mono`) | `default` (`--text-dim`) | ok pill
`valid`. The table shows no record value; the app does not print one there.
Sepolia has exactly these two rows (the legacy coin-type-60 diagnostic row
appears only on chain 1). Footer verbatim: `Selected:` in bold `--text`, then
`stealth-meta-address[1]` in `--mono` `--text`, then in `--text-dim` "All-chain
default record selected; no valid chain-specific record was found." Foot note
in `--text-dim` `--mono`: `ENS Universal Resolver
0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe`.

**SPEAKER NOTES.** "The meta-address is discovered through ENS: a sender
resolves stealth-meta-address[1] from the name, chain-specific record first,
then the all-chain default, through the Universal Resolver, so it works for ENS
v1 and v2 names. ENS is what makes a stealth address usable by a human: you pay
name.eth, not a 66-byte key blob. Without ENS there is no discoverable
identity; without stealth addresses the identity leaks its whole payment graph.
The product is the combination, and the demo name itself was registered through
the ENSv2 registrar on Sepolia because classic registration is broken there
during the migration."

**SOURCE.** "Why ENS is functionally essential", including the 66-byte key blob
line and the RFC link: `README.md` lines 104 to 113. Functional relationship
`ENS name → stealth-meta-address[1] → fresh one-time address per payment`:
`SUBMISSION.md` lines 103 to 106. Universal Resolver address: `README.md` line
220; ENSv2 registration note: `README.md` lines 225 to 233; `03_BUILD_STATUS.md`
(Sepolia ENSv2 note). Table card label, three headers, the `valid` pill and
the dim `absent` text, and the `Selected:` footer markup:
`src/components/PrivacyReadinessReport.tsx` lines 72 to 78, 93 to 102 and 108
to 113. Precedence note string: `src/audit/auditEnsName.ts` lines 197 to 200.
Record keys, chain-specific then default, and the Sepolia-only two-row plan:
`src/audit/records.ts` lines 16 to 18 (`evmCoinType`), 32 to 34
(`chainSpecificRecordKey`) and 49 to 66 (`recordKeyPlan`; the legacy row only
when `chainId === 1`). The literal key
`stealth-meta-address[1][2158638759]` appears nowhere in the repository; it is
computed at runtime and the value is derived here: 0x80000000 | 11155111 =
2158638759. Expected `DEFAULT_RECORD_SELECTED` for the demo name:
`AGENT_DEMO.md` lines 125 to 130. Precedence: `COMPETITIVE_MOAT.md` lines 20
to 24. Row-one status is a live chain read: see open question 11.

---

## Slide 6. How it works: the ERC-5564 flow, sender side and recipient side

**Purpose.** Show the engineers the real mechanism so the proofs that follow
are legible.

**HEADLINE.** Without the viewing key, a passive observer cannot link the address.

**ON SLIDE.** ERC-5564 scheme 1, secp256k1 with view tags. Record: st:eth:0x +
spending key + viewing key, 66 bytes.

**VISUAL.** A two-lane diagram, all node text in `--mono`, three nodes per
lane (the full eight-node expansion of the README maths does not fit at
projector size). Top centre, an ENS node on `--bg-raised`:
`name.eth → stealth-meta-address[1]` (`--text`), with a `--text-dim` arrow down
into the left lane. Left lane label `SENDER` (uppercase, `--text-dim`), three
nodes joined by arrows:
`p_eph ← random ephemeral key`;
`s_h = keccak256(compress(p_eph · P_view))`;
`destination = address(P_spend + s_h·G)` with the word `destination` in
`--stealth-col`. From the last node, two arrows to a chain node at the bottom
centre (`--bg-inset`, border `--border`) whose text is only
`transfer ETH → destination` and
`announce(1, destination, P_eph, viewTag‖metadata)`.
Right lane label `RECIPIENT`, three nodes fed by an arrow up from the chain
node:
`s_h' = keccak256(compress(p_view · P_eph))` with a `--text-dim` sub-line
`view tag = s_h[0]: skip 255/256 of foreign announcements`;
`recompute address, compare`;
`p_stealth = (p_spend + s_h') mod n` with `p_stealth` in `--accent`.
One `--text-dim` foot line: `ERC-5564 announcer
0x55649E01B5Df198D18D95b5cc5051630cfD45564`. Mark `p_view`, `p_spend` and
`p_stealth` with a single small `--text-dim` note "never leaves the device".
One dim label under the chain node: `passive observer: sees the destination,
cannot link it to the name`. Nothing else.

**SPEAKER NOTES.** "The recipient publishes two compressed public keys,
spending and viewing, as one 66-byte record. The sender picks a fresh ephemeral
key, computes a shared secret with the viewing public key, and adds it to the
spending public key: that sum is the one-time address. The recipient scans the
announcements with the private viewing key, skips most foreign ones by the
one-byte view tag, and recovers the controlling key for the ones that are
theirs. The sender who derived the address knows it, of course; the adversary
is the passive observer, and nobody without that viewing key can link the
destinations to the name."

**SOURCE.** Record format and the sender and recipient equations, including the
255/256 view-tag skip: `README.md` lines 78 to 102. Mechanism footnote (scheme
1, secp256k1, view tags, ENS stealth-resolution RFC): `src/pages/Privacy.tsx`
lines 79 to 82. Announcer singleton address: `README.md` line 219;
`03_BUILD_STATUS.md` (Live on-chain evidence). 66-byte meta-address:
`README.md` lines 82 to 84 and 110. Passive-observer adversary and human
knowledge: `PRIVACY.md` lines 24 to 29 and 56 to 57; `README.md` line 71.

---

## Slide 7. Proof one: A, B and C differ, live

**Purpose.** The first thing judges see work: same name, three different
destinations, on stage.

**HEADLINE.** The same name resolves to a different address every time.

**ON SLIDE.** Live on #/demo, step 3. Press it again: three new addresses.

**VISUAL.** A terminal-style panel on `--bg-inset` with a `--border` edge,
reproducing /demo step 3, as the primary element. Its heading line in bold
`--text`: "Derive: every sender computes a different destination, locally." A
primary button in `--accent` with `#05130c` text: `Derive A, B and C`. Caption
in `--text-dim`: "Fresh ephemeral randomness each time." Three mono lines in
`--stealth-col`: `A: 0xA… fresh`, `B: 0xB… fresh`, `C: 0xC… fresh`
(placeholders on purpose; real addresses exist only on stage). Verdict line in
`--accent`, once, verbatim: "Pass: A, B and C are all different. Same name, a
new one-time address every time." To the right, the AFTER card of the motif
with the same three lines at half the panel's scale (the app renders Compare
after step 3 too), so the panel and the diagram visibly agree while the
terminal reads as primary.

**SPEAKER NOTES.** "Step 3 on the demo route: Derive A, B and C. Same name,
three resolutions, three different destinations, and the app checks that they
differ before it says pass. Nothing here is precomputed; press it again and you
get three new ones. That is the payment graph breaking, live."

**SOURCE.** Step heading, button label, caption and verdict text:
`src/pages/Demo.tsx` lines 269 to 292 (verdict string at line 288). Compare
rendered with the derived addresses after step 3: `src/pages/Demo.tsx` lines
360 to 366. "Nothing above was precomputed": `src/pages/Demo.tsx` lines 345 to
358. Pay page echo "Same name, different destination every time. That is the
point.": `src/pages/Pay.tsx` lines 220 to 257. Demo sequence items 4 and 5:
`SUBMISSION.md` lines 166 to 186.

---

## Slide 8. Proof two: recognition, payment and announcement verified from chain data

**Purpose.** Show that receiving works and that the evidence is re-derived,
not asserted.

**HEADLINE.** Only the intended viewing key recognises the payment.

**ON SLIDE.** intended viewing key: recognised. unrelated viewing key: finds
nothing. The announcement names the address the payment funded: re-verified
from Sepolia, 8 checks.

**VISUAL.** Left half, the /demo step 4 result as two rows in `--mono`:
`intended viewing key:` followed by an ok pill `recognised`; `unrelated viewing
key:` followed by an ok pill `finds nothing`; beneath, in `--text-dim`:
"Recognition needs the private viewing key, not just public data." Right half,
a card labelled (uppercase, `--text-dim`) `Published payment and announcement,
verified from chain data`, with eight small rows, each an ok pill `pass` and a
label: `Payment transaction succeeded`; `Payment carried value to a one-time
address`; `Announcement transaction succeeded`; `Emitted by the canonical
ERC-5564 announcer`; `Announcement uses ERC-5564 scheme 1`; `Announcement
carries a compressed ephemeral public key`; `Metadata follows the native-ETH
layout and matches the transferred amount`; `Announcement names the address
the payment funded`. The first seven labels in `--text-dim`, the eighth in
`--text` (it is the binding check, and the on-slide sentence bridges to it).
Under the card, two links, labelled in the app `payment tx` and
`announcement tx`; on the slide show them as `payment 0x2430f7f8…dc248b` and
`announcement 0x4164c074…010c11` in `--mono` `--text-dim` (the hash-bearing
form is a deck construct, not UI text; full hashes:
0x2430f7f8a422a6a527272cd591541c101e9fffd43dccb2a1feed918ee0dc248b and
0x4164c074fbb0adacf3d3804928e2a4cc803d61e783e9fbbef207608fe3010c11).

**SPEAKER NOTES.** "Step 4 runs the same recognition code the recipient
scanner uses: the intended viewing key recognises the payment, an unrelated key
finds nothing. A stranger with a block explorer still sees the payment, the
destination and the amount; what they cannot do is recognise it as belonging to
the name. Then the panel re-verifies the published Sepolia payment and its
announcement from chain data, eight checks, and the one that matters is the
last: the announcement names the same address the payment actually funded.
Each proof also lists what it does not prove, including recognition itself,
which needs the private viewing key."

**SOURCE.** Step 4 heading, pills and the recognition sentence:
`src/pages/Demo.tsx` lines 299 to 333 (app heading at line 299, sentence at
line 328). Panel label, "The check that matters is the last one", row labels
and the link labels `payment tx` and `announcement tx`:
`src/components/PaymentProofPanel.tsx` lines 49 to 53, 66 to 110 and 74 to 79;
check definitions (exactly eight on a successful read):
`src/relay/paymentProof.ts` lines 127 to 262. Not-proven list, including
"Amount privacy: the transferred value is public on-chain":
`src/relay/paymentProof.ts` lines 64 to 71. Live negative control on /receive:
`src/pages/Receive.tsx` lines 245 to 259. Hashes: `03_BUILD_STATUS.md` (Live
on-chain evidence); `README.md` lines 240 to 241.

---

## Slide 9. Privacy must survive the first spend: the sponsored EIP-7702 exit

**Purpose.** Answer the question every privacy engineer asks next: how do you
spend it without re-linking?

**HEADLINE.** Privacy must survive the first spend, so a sponsor pays gas.

**ON SLIDE.** A stealth address holds funds but no gas. Gas from your wallet
re-links it. EIP-7702 sponsored sweep, verified live on Sepolia.

**VISUAL.** A five-step strip exactly in the app's `.steps` style: 1.8rem
circles on `--bg-raised` with a 1px `--border` ring and `--mono` digits in
`--text-dim`; the last circle carries the content `✓` in `--accent` with an
`--accent-dim` ring (the done state). Step text in `--text`, one line each:
`1 Recognise the payment, derive the stealth key locally`;
`2 Sign an EIP-7702 delegation to the executor`;
`3 Hand the package to a sponsor`;
`4 Sponsor submits the type-4 transaction and pays the gas`;
`5 Funds leave; the stealth address never received gas`.
Under the strip, one `--text-dim` line: "Two signatures: EIP-7702 delegation
(chainId, executor, accountNonce) and EIP-712 Sweep intent (to, amount, nonce,
deadline)." Below that, a card labelled `Sponsored exit, verified from chain
data` with an ok pill `pass` and the mono hash `0x75a9da4e…089c25` (full:
0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25). One
honesty line in `--text-dim` at the foot, the only place the executor address
appears: "Executor 0x94E4C39055fa4a5fCd47E03CbcbCD0503848806b: unaudited
testnet demo contract. No production relayer is operated; the demo sponsor is
the same throwaway wallet, and any sponsor learns the destination." Nothing
else: the two signature cards of an earlier draft did not fit at projector
size.

**SPEAKER NOTES.** "A stealth address holds funds but no gas, and topping it up
from your main wallet hands the observer exactly the link we removed. So the
stealth key signs two things locally: an EIP-7702 delegation to a small
executor, and an EIP-712 sweep intent that binds destination, amount, nonce and
deadline. A sponsor submits the type-4 transaction and pays the gas; the
stealth address never received any. The published Sepolia sweep is re-verified
from chain data every time the proof runs, and the panel says what it does not
prove: that the destination is unrelated to the recipient, and in the demo the
sponsor is the same throwaway wallet. GhostName operates no relayer. You bring
the sponsor, and the sponsor learns the destination, so choose one that is not
your public wallet."

**SOURCE.** Problem and five steps: `RELAYERS.md` lines 3 to 17 and 36 to 50.
Two independent signatures and what each binds: `RELAYERS.md` lines 93 to 104.
Step circle style and done state: `src/styles.css` lines 309 to 327.
Executor address, sweep hash, "unaudited testnet demo contract": `README.md`
lines 278 to 286; `03_BUILD_STATUS.md` (Live on-chain evidence). No production
relayer, sponsor learns the destination: `03_BUILD_STATUS.md` line 188;
`README.md` lines 328 to 331; `PRIVACY.md` lines 71 to 74. Same throwaway
sponsor: `RELAYERS.md` lines 85 to 87; `PRIVACY.md` lines 66 to 74. Panel
label: `src/components/SweepProofPanel.tsx` line 57. Step 5 heading "Prove
exit: the funds leave without the stealth address paying gas.":
`src/pages/Demo.tsx` line 340. Section title "Privacy must survive the first
spend": `SUBMISSION.md` lines 131 to 147.

---

## Slide 10. Credibility

**Purpose.** Pre-empt "is this real" with hashes and tests, nothing else, before
the deck states its own limits.

**HEADLINE.** Every on-chain claim is a Sepolia transaction you can re-check.

**ON SLIDE.** Five Sepolia transactions. 316 offline tests. Byte-identical to
the ScopeLift reference SDK. Mainnet read-only.

**VISUAL.** Left two thirds, an evidence table in the plain table style with
uppercase `--text-dim` headers `Evidence` and `Sepolia reference`, hashes in
`--mono` shortened per the brief rule (first ten characters, ellipsis, last
six), full values listed here for the link targets:
`Name registration` 0x04985bb69fb3b20b034465cbe3d1acfd5a5ca3734ca3eab19db577462383a398;
`Record publish` 0x75b7a6404a5a3b1880f8dce7c874cbf34ce65fca64cffeb7e313567b2759ea29;
`Stealth payment` 0x2430f7f8a422a6a527272cd591541c101e9fffd43dccb2a1feed918ee0dc248b;
`ERC-5564 announcement` 0x4164c074fbb0adacf3d3804928e2a4cc803d61e783e9fbbef207608fe3010c11;
`Sponsored EIP-7702 sweep` 0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25.
Each of the five rows links to `https://sepolia.etherscan.io/tx/<hash>`. Under
the table, a `--text-dim` caption (not a table row, it is not a transaction):
`Demo identity ghostname-3c7714.eth, resolver
0xE0e6F09B30eBcdE505FDCA0F1fd244273838FFAE`, linking to
`https://sepolia.etherscan.io/address/0xE0e6F09B30eBcdE505FDCA0F1fd244273838FFAE`.
Right third, a stacked list of four small cards on `--bg-raised`, each a
`--mono` line with an ok pill:
`npm test: 316 passed, 11 skipped, 35 files`;
`tests/interop.test.ts: byte-identical to @scopelift/stealth-address-sdk, frozen known-answer vector`;
`tests/mainnet-guard.test.ts: writes hard-gated to Sepolia`;
`CI on Node 20 and 22, RUN_LIVE never set`.
The import-boundary test is not repeated here; it lives on slide 13.

**SPEAKER NOTES.** "None of this is slideware. A real Sepolia name, a published
record, a real payment, its announcement, and a sponsored EIP-7702 sweep, all
on Etherscan and all re-verified inside the app. The scheme-1 core is
byte-identical to the ScopeLift reference SDK on a frozen known-answer vector,
316 deterministic tests run with no network on Node 20 and 22 in CI, and 50
random wrong viewing keys fail to recognise the payment. Mainnet is read-only
in this build; every write is hard-gated to Sepolia."

**SOURCE.** Test figures (316 passed, 11 skipped, 35 files, 327 tests) and CI
on Node 20 and 22: `03_BUILD_STATUS.md` (Verified commands);
`.github/workflows/ci.yml` lines 6 to 8 (RUN_LIVE never set, no secrets) and
26 to 57; "316 tests with no network access": `SUBMISSION.md` lines 334 to
338. Byte-identical to the ScopeLift SDK and the frozen vector, the SDK being
a dev-only test oracle: `tests/interop.test.ts` lines 1 to 5 and 94 to 104;
`README.md` lines 189 to 191. 50 wrong viewing keys: `tests/stealth.test.ts`
lines 156 to 159; `README.md` lines 185 to 187. Mainnet guard test:
`tests/mainnet-guard.test.ts`; both gates enforced in `assertWritableNetwork`:
`README.md` lines 251 to 252. Hashes, resolver, executor: `README.md` lines
237 to 241 and 278 to 286; `03_BUILD_STATUS.md` (Live on-chain evidence).
Mainnet read-only, Sepolia-only writes: `README.md` lines 144 to 150 and 246
to 255.

---

## Slide 11. Honest scope: protected versus not protected

**Purpose.** State the boundary once the evidence has earned it, in the app's
own words.

**HEADLINE.** This is forward privacy, not anonymity, stated plainly.

**ON SLIDE.** Not a mixer, not zero knowledge, not history deletion. Forward
recipient-address privacy for compatible senders.

**VISUAL.** Two Compare-styled columns filling the slide, from the /demo section
"The boundary, stated plainly". Column order follows the app, not the motif
(see the brief). Left: title `PROTECTED` in `--stealth-col`, border
`rgba(78, 240, 176, 0.4)`, three bullets in `--text`: "Future receiving
addresses cannot be linked to the name by a passive observer without the
viewing key."; "Derivation is local, so no gateway learns the destination.";
"Recipient address reuse is avoided." Right: title `NOT PROTECTED` in
`--static-col`, border `rgba(240, 106, 106, 0.4)`, four bullets: the three
/demo bullets "Past transaction history, which cannot be erased."; "ENS
ownership, amounts, and sender identity."; "Timing and RPC metadata."; and a
fourth, verbatim from /privacy: "A compromised device, or leaked
viewing/spending keys." No icons.

**SPEAKER NOTES.** "Forward privacy, not anonymity, not a mixer, not zero
knowledge, not erasing the past. The adversary is the ordinary passive observer
with a block explorer or an indexer. We name what is protected and what is not;
the full eight-item list is on /privacy and in PRIVACY.md, and if a marketing
line and PRIVACY.md ever disagree, PRIVACY.md wins."

**SOURCE.** Boundary columns and bullets: `src/pages/Demo.tsx` lines 368 to
389. Fourth not-protected bullet: `src/pages/Privacy.tsx` line 74. Privacy page
lead and the eight not-protected items: `src/pages/Privacy.tsx` lines 7 to 12
and 67 to 76. README threat model: `README.md` lines 49 to 74. Adversary, the
eight items, words not used, and "this document wins": `PRIVACY.md` lines 3 to
5, 24 to 29, 40 to 57 and 59 to 62. "Forward recipient-address privacy for
compatible senders, not anonymity": `src/agent/format.ts` lines 15 to 16.

---

## Slide 12. Not another stealth wallet

**Purpose.** Place GhostName in the stack without a superlative.

**HEADLINE.** GhostName operates the assurance layer, not the account layer.

**ON SLIDE.** No claim is made to being first, only, or most private. The
differentiator is the layer, not a superlative.

**VISUAL.** The category table from `COMPETITIVE_MOAT.md`, verbatim, in the
app's plain table style: uppercase `--text-dim` headers `Project`, `Layer`,
`What it operates`; row separators `--border`; no logos, names as plain text.

| Project | Layer | What it operates |
|---|---|---|
| Fluidkey | account and wallet infrastructure | its own key and account system |
| Cloaked | account and wallet infrastructure | its own key and account system |
| Umbra | core standard implementation | the reference ERC-5564 payment flow |
| Sneaky | ENS resolution plus privacy-pool exit | resolution combined with a pool |
| GhostName | conformance, migration and lifecycle assurance | nothing on the user's behalf |

The GhostName row in bold `--text`, its last cell in `--accent`. Under the
table, one line in `--text-dim`: "It custodies nothing and issues nothing."

**SPEAKER NOTES.** "Others operate accounts. GhostName operates assurance.
Stealth payments are becoming a stack, and most projects sit at the account
layer. Fluidkey and Cloaked run wallet infrastructure, Umbra implements the
core standard, Sneaky pairs ENS resolution with a privacy pool. GhostName sits
at the assurance layer: it audits, upgrades and proves the identity you already
own, and it custodies nothing and issues nothing. We do not claim first, only
or most private; the differentiator is the layer."

**SOURCE.** Table, "That last row is the point", and the no-superlative
sentence: `COMPETITIVE_MOAT.md` lines 8 to 18 and 41 to 42. Framing, "most
projects sit at the account layer. GhostName sits at the assurance layer", and
"custodies nothing and issues nothing": `README.md` lines 16 to 34. The
two-sentence form "Others operate accounts. GhostName operates assurance."
comes from the previous deck copy and is kept in the speaker notes. Feature-level
competitor details are not documented in the repo and must not be added.

---

## Slide 13. Agents get evidence, humans keep control

**Purpose.** Show the agent layer as a safety story, not a chatbot story.

**HEADLINE.** The agent gets evidence and a link, never a key.

**ON SLIDE.** Local, read-only MCP server: five tools, no wallet, no signing,
no writes. The link carries name, chainId, source, reportId, version. Keys are
generated in your browser.

**VISUAL.** Left, a terminal panel on `--bg-inset` in `--mono` showing two
audit first lines exactly in the CLI format. Line one:
`GhostName audit of name.eth (chain 1): INCOMPLETE` with the status word in
`--warn`, followed by two bad pills `STATIC_ADDRESS_EXPOSED` and
`STEALTH_RECORD_MISSING` and one neutral pill `RESOLVER_PROVENANCE_UNKNOWN`.
Line two: `GhostName audit of ghostname-3c7714.eth (chain 11155111):
PRIVATE-READY` with the status in `--accent`. A dim third line, host omitted
(the host is on slide 14):
`#/create?name=name.eth&chainId=1&source=agent&reportId=gcr1_…&version=1`.
A dim caption under the panel: "Expected results per AGENT_DEMO.md; live
output differs." (line one is composed for a placeholder name that was never
audited, line two is the documented expected result, neither is a capture; on
rehearsal day line one may be replaced with a real captured line from a local
run against the name set only in the uncommitted `.env`, never written into
this document).
Right, a four-node loop with `--accent` arrows: `Agent: audit, codes, link` →
`Browser #/create: keys generated here, outside the agent` (abridged from the
/create handoff card sentence "Key generation happens here, in this browser,
outside the agent.") → `Wallet: human approves setText` → `Agent: re-audit:
resolved, remaining, still public` (the CLI's own re-audit line labels).
Across the bottom, a thin `--danger` line labelled in `--text-dim`:
`tests/mcp.boundary.test.ts: no signing or write path reachable`.

**SPEAKER NOTES.** "Ask Claude to audit a name. It calls a GhostName server
running on my laptop, reads the chain through my RPC, and names the leak with
stable codes: static address exposed, stealth record missing. It hands me a
link that carries only a name, a chain id, a source, a report id and a version;
the keys are generated in my browser and the transaction is signed by my
wallet, and the agent never received either. An RPC outage returns unknown,
never a pass, and an import-boundary test walks the whole import graph so the
agent layer cannot reach a signing or write path, not a promise in a prompt."

**SOURCE.** Agent story, five tools, no wallet or signing, boundary test:
`README.md` lines 290 to 314; tool names: `mcp/tools.ts` lines 33 to 37.
First-line format: `src/agent/format.ts` line 21; re-audit lines `Resolved`,
`Remaining`, `Newly observed`, `Still public`: `src/agent/format.ts` lines 80
to 86. Finding codes: `src/agent/findings.ts` lines 22 to 26 and 85 to 145;
expected results: `AGENT_DEMO.md` lines 74 to 87 and 119 to 136. Handoff URL
and the five parameters: `src/agent/auditForAgent.ts` lines 46 to 48 and 66 to
79; `src/agent/handoff.ts` line 27; `AGENT_DEMO.md` lines 100 to 102. Handoff
card sentences: `src/pages/Create.tsx` lines 374 to 377 (key generation at line
375; the three-parameter sentence at line 376, see open question 4).
`setText` write: `src/ens/write.ts` line 99. "The agent gets evidence and a
link; the human keeps the keys and the wallet": `03_BUILD_STATUS.md` lines 20
to 21 (Product position); "no wallet, no signing and no write capability":
`README.md` lines 306 to 307. RPC failure yields unknown: `AGENT_DEMO.md`
lines 165 to 168; `src/agent/auditForAgent.ts` lines 329 to 336. Boundary
rule: `tests/mcp.boundary.test.ts` lines 1 to 60 and 149 to 152. Setup
commands `npm run build:agent` and `claude mcp add ghostname -- node
./dist-agent/ghostname-mcp.mjs`: `README.md` lines 293 to 296.

---

## Slide 14. Close: restate the governing thought

**Purpose.** Land the one claim, give the tagline, leave the links on screen.

**HEADLINE.** GhostName gives established identities a forward-privacy button.

**ON SLIDE.** Keep the ENS name. Break the payment graph.
github.com/0xSkrillah/ghostname
0xskrillah.github.io/ghostname/#/demo
0xskrillah.github.io/ghostname/#/privacy

**VISUAL.** The full BEFORE versus AFTER motif, centred, with the BEFORE card
dimmed to about 40 percent opacity and the AFTER card at full brightness. Above
it the headline; below it the tagline large with `Break the payment graph.` in
`--accent`. The three link lines above, in `--mono` `--text-dim`, at the foot.
The wordmark small in the corner. Nothing else, no logos, no team grid (there
is no team block in the repository; add one only if the author supplies names).

**SPEAKER NOTES.** "Blockchains have no delete button. GhostName gives the
identity you already have a forward-privacy button. Keep the name. Break the
payment graph."

**SOURCE.** Closing idea and tagline: `SUBMISSION.md` lines 365 to 368;
the previous deck copy; `src/pages/Demo.tsx` lines 391 to 397. Links
(repository, guided demo route, threat-model route): `SUBMISSION.md` lines 386
to 396; routes `/demo` and `/privacy`: `src/App.tsx` lines 24 to 25;
`03_BUILD_STATUS.md` (Deployment and repository).

---

## Fifteen-second spoken version

> "An ENS name ties your identity to one wallet forever. GhostName keeps the
> name but sends every future payment from a compatible sender to a fresh
> one-time address that a passive observer cannot link to the name. Real
> ERC-5564 stealth addresses, resolved through ENS, proven live on Sepolia."

Source: the previous deck copy; `README.md` lines 36 to 40 and 51 to 53;
compatible senders: `src/agent/format.ts` lines 15 to 17.

## Agent variant (fifteen seconds)

> "Ask your AI agent to audit any ENS name, explain its privacy leaks and guide
> you through a human-signed upgrade, without the agent ever seeing your keys.
> GhostName gives agents evidence and gives humans control."

Source: `README.md` lines 290 to 291; `SUBMISSION.md` line 229; `AGENT_DEMO.md`
lines 159 to 161.

## Title-slide alternates

- "Keep the ENS name. Break the payment graph." (default tagline, `README.md`
  line 5)
- "Your name is forever. Your future payments do not have to be linked to it."
  (replaces the previous deck copy's wording "Your payment history does not
  have to be", which reads as history erasure and collides with the words
  `PRIVACY.md` lines 59 to 62 rule out)
- "Forward privacy for the identity you already have." (the previous deck copy)
- "GhostName gives AI agents evidence and gives humans control."
  (the previous deck copy; `AGENT_DEMO.md` line 161)

---

## Open questions for the author

1. Slide count. The required slide list yields 14 slides against a target of
   11 to 13. If the layout needs 13, fold slide 3 (why now) into slide 2 as a
   second beat, or fold slide 5 (why ENS) into slide 4; both keep the Minto
   order above intact.
2. Demo duration. `README.md` line 154 and the spec call /demo a 90-second
   sequence; the app heading is "GhostName in two minutes" and the Landing link
   says "Or watch the two-minute demo". This draft never states a duration on a
   slide; the notes say "the demo route". Pick one before recording.
3. Sponsored-exit check count. `AGENT_DEMO.md` says eight checks for the exit,
   but `src/relay/proof.ts` emits nine when the client can read account code
   (receipt, type, sponsor, delegation, calldata, intent, event, designator,
   balance). Slide 9 therefore states no count for the exit; slide 8 states
   eight for the payment verifier, which is exact.
4. Handoff parameters. `README.md` line 307 lists four (name, chain id, report
   id, version); the /create handoff card the presenter will show on screen,
   `src/pages/Create.tsx` line 376, reads "It passed only a name, a chain id
   and a report id." (three); the code and tests carry five (name, chainId,
   source, reportId, version). Slide 13 uses five, matching
   `src/agent/auditForAgent.ts` line 48 and `src/agent/handoff.ts` line 27. A
   judge reading the page will see three; decide whether to align the card
   text before the demo.
5. Fonts. Nothing is bundled; the app renders with whichever font in the stack
   the viewer has. Confirm the presentation laptop has JetBrains Mono or
   Cascadia Code, or embed one in the deck.
6. Brand assets. No tracked image, logo or wordmark file exists in the
   repository (no png, svg, ico, jpg or webp under version control, and no
   `public/` directory). The wordmark must be typeset from the nav brand style.
7. Team, contact and track. No team names, roles, contact details or named
   bounty track are documented anywhere read; the close slide carries links
   only. The spec mentions "ENS bounty qualification" without naming a track.
   The spec also links an ENS bounty brief at `02_GHOSTNAME_MASTER_SPEC.md`
   lines 53 to 54; check it for a track name before recording.
8. Live values. The A, B and C addresses, the Mobula exposure figures and the
   per-row proof details are computed live and cannot be pre-rendered; the deck
   uses the app's own placeholders and never invents an address.
9. Established mainnet name. It is forbidden in every committed file and is
   not pre-filled in the deployed build; the presenter types it live. This
   draft uses `name.eth` throughout, including the agent terminal line.
10. EIP-7702 availability. "Live on mainnet since Pectra, May 2025" appears in
    `RELAYERS.md` line 22 and is not repeated on a slide; if used in the notes,
    it is a repository claim, not independently verified here.
11. Slide 5 record table, row one. The status of
    `stealth-meta-address[1][2158638759]` is a live chain read that cannot be
    verified offline. It is consistent with the repository (`AGENT_DEMO.md`
    lines 127 to 130 expect `DEFAULT_RECORD_SELECTED` for the demo name, and
    the app renders `absent` for a missing record), but if the chain-specific
    record were ever present and invalid the app would show a bad pill
    `malformed` instead. Confirm the row against the live /scan result for
    `ghostname-3c7714.eth` before the deck is final and use the app's own
    rendering (`absent` as dim text, `valid` as an ok pill, `malformed` as a
    bad pill).

# GhostName Video Script

One sentence first: GhostName keeps your ENS name and unlinks every future
payment. This script records that claim for the hackathon submission video.
Every step is live. No em dashes, so the narration reads clean.

Two cuts are below. The **two-minute cut** is the submission video and the
backup for the live demo. The **three-minute extended cut** adds the identity
creation and live payment pages so every shipped feature appears on camera.
Button labels are quoted exactly as they appear in the app, so you can drive
the recording from this page alone.

## Before you hit record

1. Open the deployed app and set browser zoom to about 150 percent so a
   projector can read it. Close the dev console.
2. Import the demo receive identity once, so the Receive page can recognise
   payments. Go to `#/create`, use "Or import an existing identity" (or "Or
   restore from an encrypted capsule"), and paste the JSON from your local
   `.demo/identity.json` (testnet only). It is validated locally and the page
   shows the demo meta-address once imported. Do this before the camera rolls;
   the field masks nothing, and the identity controls every payment to the
   demo name.
3. Optionally set `VITE_DEMO_MAINNET_NAME` (an established mainnet name of
   your choice) and `VITE_DEMO_SEPOLIA_NAME` in a local `.env` so the inputs
   are pre-filled; the shipped build starts with empty inputs. Never commit
   the mainnet name.
4. Have these tabs or deep links ready: `#/scan`, `#/demo`, `#/receive`,
   `#/privacy`, and for the extended cut `#/create` and `#/pay`. Links are
   listed at the bottom.
5. Optional live payment: connect MetaMask on Sepolia with a little test ETH if
   you want to send a fresh payment on camera. The two-minute cut works without
   it, because the Receive scan already finds real prior payments and the
   proof panels re-verify published chain data.
6. Run through `#/demo` once off camera. It is five counted steps and ends in a
   green "Complete: all five steps ran live and passed" card only when every
   step is run in order, so know where the buttons are.

## What the app does, feature by feature

This is the checklist the two cuts are built from. Tick each one off while
recording so nothing shipped is left out.

| Feature | Where it appears | Cut |
|---|---|---|
| GhostCheck privacy audit of any ENS name, mainnet or Sepolia, with a status (Private-ready, Incomplete, Misconfigured, Unknown) and a JSON export | `#/scan`, `#/demo` step 1 and 2 | both |
| Mobula public-exposure panel with token and chain counts first and value behind a reveal | `#/scan`, "Assemble public profile (queries Mobula)" | both |
| Local ERC-5564 derivation, three fresh destinations from one record, all different | `#/demo` step 3, "Derive A, B and C" | both |
| Before and after comparison graphic | `#/demo` after step 3, and the landing page | both |
| Recognition proof: intended viewing key recognises, unrelated key finds nothing | `#/demo` step 4, "Run recognition test" | both |
| Published payment and announcement re-verified from chain data, including the binding between announcement and funded address | `#/demo` step 4, "Verify the payment and announcement" | both |
| Sponsored EIP-7702 exit re-verified from chain data, with its not-proven list | `#/demo` step 5, "Verify the sponsored exit" | both |
| Completion card, nothing precomputed | `#/demo` after step 5 | both |
| Real announcement scan with the private viewing key, balance read from chain, live negative control, spending-key check | `#/receive`, "Scan announcements" | both |
| Destination-bound sponsored sweep package built locally | `#/receive`, "Sweep privately via a sponsor (EIP-7702)" then "Build sweep package" | both |
| Threat model: past, present, future, protected, not protected | `#/privacy` | both |
| Local key generation, the exact `stealth-meta-address[1]` value, guarded publish with a pre-sign check | `#/create`, "Publish to an ENS name" | extended |
| Backup: plaintext export and the encrypted Swarm-ready recovery capsule | `#/create`, "Show keys and backup options" | extended |
| Pay an ENS name privately: resolve, derive again, two transactions shown before signing, send and announce | `#/pay`, "Resolve + derive", "Derive again", "Send + announce" | extended |
| Mainnet read-only, writes hard-gated to Sepolia | footer note and `#/privacy` | both, in narration |

## The two-minute cut

Format: [time] then ON SCREEN action, then SAY narration.

### [0:00 to 0:10] Open

ON SCREEN: the `#/` landing page. The headline reads "Keep the ENS name. Break
the payment graph." and the before-and-after graphic sits under it.

SAY: "An ENS name is your identity. It is also a permanent public record of
every payment you have ever received. GhostName is the privacy-assurance layer
for ENS: it audits the name you already own, upgrades it in place, and proves
the result."

### [0:10 to 0:30] The problem, live on Scan

ON SCREEN: `#/scan`. Enter an established mainnet name (or use your local
pre-fill) and click "Run privacy audit". Point at the static address, the
status pill (an ordinary name reads "Incomplete") and the line "This mapping is
public and permanent." Then click "Assemble public profile (queries Mobula)".
Point at the token count and chain count. Leave the value hidden behind
"reveal".

SAY: "This is a real name on mainnet. It resolves to one static address, and
the audit says what that means: no stealth record, so every future payment
stays linkable. Mobula shows how much a stranger can assemble from that one
link, live. I am not revealing the number on camera, which is the point."

### [0:30 to 0:38] Why now

ON SCREEN: stay on the audit card.

SAY: "I cannot delete any of this. Blockchains have no delete button. So the
only thing left to control is the next payment."

### [0:38 to 1:00] The answer, live on Demo

ON SCREEN: `#/demo`. Step 1: click "Audit on mainnet (read-only)" on the same
name, three seconds, it unlocks the completion card later. Step 2: enter the
Sepolia demo name and click "Check conformance". Point at "Private-ready" and
the selected record `stealth-meta-address[1]`. Step 3: click "Derive A, B and
C". Point at A, B and C, the line "Pass: A, B and C are all different", and the
before-and-after graphic that appears under the steps.

SAY: "Same identity model, GhostName enabled. The record is published on the
name itself, no service-owned subdomain, no new wallet. My browser derives a
fresh destination, address A, then B, then C, from that one record. None of
them match. Same name, a new one-time address every time, derived locally with
no gateway. That is the payment graph breaking."

### [1:00 to 1:22] Prove receive and prove exit, live on Demo

ON SCREEN: step 4: click "Run recognition test". Point at "intended viewing
key: recognised" and "unrelated viewing key: finds nothing". Click "Verify the
payment and announcement" and point at the green checks, including the one that
binds the announcement to the funded address. Step 5: click "Verify the
sponsored exit". Point at the checks, the "Not proven by this evidence" list,
and the green card "Complete: all five steps ran live and passed".

SAY: "The intended viewing key recognises the payment. A freshly generated
unrelated key finds nothing, because recognition needs the private key, not
public data. Then the app re-verifies the real Sepolia payment and its ERC-5564
announcement from chain data, and the real sponsored exit: the funds left the
stealth address by an EIP-7702 transaction a sponsor paid for, so the address
never had to be funded from my known wallet. Every check is read from chain,
and the app lists what the evidence does not prove."

### [1:22 to 1:40] The recipient view, live on Receive

ON SCREEN: `#/receive`, click "Scan announcements". Point at "recognised as
yours", the balance read from chain, "Live negative control" showing zero, and
"Spending-key check: pass: derived stealth key controls this address". Open
"Sweep privately via a sponsor (EIP-7702)" on one payment, enter a clean
destination, click "Build sweep package".

SAY: "Now as the recipient. My private viewing key scans real announcements
and recognises my payments, with the balance read from chain. An unrelated key
recognises zero. I derive the key that controls each address, and sign a
destination-bound sweep package a sponsor can execute, all in the browser. The
stealth key never leaves the device."

### [1:40 to 1:50] Honest scope, live on Privacy

ON SCREEN: `#/privacy`. Show "Past: cannot be erased", then the "Protected" and
"Not protected" lists.

SAY: "We say exactly what this is. It protects your future receiving addresses
against ordinary observers. It does not delete history, hide the amount, or
hide the sender. Forward privacy, not anonymity. Mainnet is read-only in this
build; every write is gated to Sepolia."

### [1:50 to 2:00] Close

ON SCREEN: back to the landing page, or the close slide.

SAY: "Everything you saw is live on Sepolia. A real name registered, a record
published, a payment sent, discovered, recovered, and swept with a sponsored
transaction. Blockchains have no delete button. GhostName gives the identity
you already have a forward-privacy button. Keep the name. Break the payment
graph."

## The three-minute extended cut

Same script, with two inserts. Use this cut if the submission allows three
minutes, or record the inserts separately as feature clips.

### Insert A, after "The answer" [adds about 30 seconds]: Create

ON SCREEN: `#/create` in a fresh browser profile so a new identity is generated.
Point at the `stealth-meta-address[1]` value and the "Publish to an ENS name"
section. If you own a Sepolia test name and have a wallet on Sepolia, enter it
and go as far as the "You will sign one transaction on Sepolia" table, then
sign. Otherwise stop at the table. Then click "Show keys and backup options",
scroll to "Encrypted recovery capsule (Swarm-ready, testnet only)", enter a
passphrase and create the capsule.

SAY: "Setting this up is one record. The browser generates the spending and
viewing keys locally, shows the exact value to publish, and simulates the
write before asking for a signature, so a wallet that cannot write to the
resolver is stopped before it signs. The backup is an encrypted capsule,
AES-256-GCM under a passphrase-derived key, with no plaintext keys inside, so
it is safe to store on Swarm. Nothing here has a backend."

### Insert B, after Insert A [adds about 30 seconds]: Pay

ON SCREEN: `#/pay`. Enter the Sepolia demo name, click "Resolve + derive", then
"Derive again". Point at the two different destinations. Connect a Sepolia
wallet, point at "You will sign two transactions on Sepolia", click "Send +
announce", and wait for "Payment complete on Sepolia".

SAY: "A sender pays the name, not a 66-byte key. Each derivation gives a new
destination. Before anything is signed, the app shows both transactions: the
transfer to the stealth address and the ERC-5564 announcement that lets the
recipient find it. A plan can only be paid on the chain its record was
resolved on."

Then continue the two-minute cut from "The recipient view", where the payment
you just sent is now recognised as yours.

## If you want the on-chain sweep on camera

Run `npm run sweep:sepolia` in a terminal. It deploys the executor if needed,
funds a fresh stealth address, and sweeps it with a sponsored EIP-7702
transaction, then prints the transaction hash. Show the printed hash on
Etherscan to prove the stealth address never paid its own gas.

## Fallbacks during recording

- Mainnet read is slow: the Scan input accepts any name, so retry, or the app
  falls back to a second RPC automatically.
- Mobula rate-limits the keyless endpoint: the panel says so and offers a
  retry; the audit card already makes the point, so move on.
- No wallet ready: skip the extended-cut inserts. The Receive scan already
  recognises real prior payments, so the discovery proof still lands.
- Wrong network for a name: the audit reports "nothing found" rather than
  guessing; switch the network selector on `#/scan`.
- Total network failure: cut to the pre-recorded take of this same flow.

## Links to run it live

Deployed app (hash routes, deep-linkable):

- App home: https://0xskrillah.github.io/ghostname/
- Scan: https://0xskrillah.github.io/ghostname/#/scan
- Demo: https://0xskrillah.github.io/ghostname/#/demo
- Create and import identity: https://0xskrillah.github.io/ghostname/#/create
- Pay: https://0xskrillah.github.io/ghostname/#/pay
- Receive: https://0xskrillah.github.io/ghostname/#/receive
- Privacy and threat model: https://0xskrillah.github.io/ghostname/#/privacy

Repository: https://github.com/0xSkrillah/ghostname

On-chain evidence on Sepolia (open on Etherscan while narrating "this is live"):

- Test name registration: https://sepolia.etherscan.io/tx/0x04985bb69fb3b20b034465cbe3d1acfd5a5ca3734ca3eab19db577462383a398
- Stealth record published: https://sepolia.etherscan.io/tx/0x75b7a6404a5a3b1880f8dce7c874cbf34ce65fca64cffeb7e313567b2759ea29
- Stealth payment: https://sepolia.etherscan.io/tx/0x2430f7f8a422a6a527272cd591541c101e9fffd43dccb2a1feed918ee0dc248b
- ERC-5564 announcement: https://sepolia.etherscan.io/tx/0x4164c074fbb0adacf3d3804928e2a4cc803d61e783e9fbbef207608fe3010c11
- Sponsored EIP-7702 sweep (verified live by the app): https://sepolia.etherscan.io/tx/0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25
- Earlier sponsored sweep run: https://sepolia.etherscan.io/tx/0x412cca80d621d5d58a38ef190c6a8c323d18adb1be3488f29868d1b4b2efedc0
- Sweep executor contract: https://sepolia.etherscan.io/address/0x94E4C39055fa4a5fCd47E03CbcbCD0503848806b

Demo test name (for Pay and Demo inputs): `ghostname-3c7714.eth`
Receive scan start block: `11612900`

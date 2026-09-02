# GhostName Two-Minute Video Script

One sentence first: GhostName keeps your ENS name and unlinks every future
payment. This script records that claim as a two-minute backup video. Every
step is live. No em dashes, so the narration reads clean.

## Before you hit record

1. Open the deployed app and set browser zoom to about 150 percent so a
   projector can read it. Close the dev console.
2. Import the demo receive identity once, so the Receive page can recognise
   payments. Go to `#/create`, use "Or import an existing identity" (or restore
   an encrypted capsule), and paste the JSON from your local
   `.demo/identity.json` (testnet only). It is validated locally and the page
   shows the demo meta-address once imported. Do this before the camera rolls;
   the field masks nothing, and the identity controls every payment to the
   demo name.
3. Optionally set `VITE_DEMO_MAINNET_NAME` (an established mainnet name of
   your choice) and `VITE_DEMO_SEPOLIA_NAME` in a local `.env` so the inputs
   are pre-filled; the shipped build starts with empty inputs.
4. Have these tabs or deep links ready: `#/scan`, `#/demo`, `#/receive`,
   `#/privacy`. Links are listed at the bottom.
5. Optional live payment: connect MetaMask on Sepolia with a little test ETH if
   you want to send a fresh payment on camera. The video works without it,
   because the Receive scan already finds real prior payments.

## Fastest path: the single guided route

`#/demo` now runs the whole story on one page as audit, upgrade, derive, prove
receive, prove exit, boundary, close. Nothing navigates away, and the exit proof
verifies published chain data live, so the route works even if you do not send a
fresh transaction on camera. Drive that route top to bottom and the script below
maps onto it step for step.

## The script

Format: [time] then ON SCREEN action, then SAY narration.

### [0:00 to 0:12] Open

ON SCREEN: the title or the `#/` landing page.

SAY: "An ENS name is your identity. It is also a permanent public record of
every payment you have ever received. GhostName is the privacy-assurance layer
for ENS: it audits the name you already own, upgrades it in place, and proves
the result."

### [0:12 to 0:30] The problem, live on Scan

ON SCREEN: `#/scan`, enter an established ENS name (or use your local pre-fill),
click Run privacy audit. Point at the
static address and the exposure panel.

SAY: "This is a real name on mainnet. It resolves to one static address, so
anyone can assemble its whole financial profile from it. Here is a live sample.
That linkage is public and permanent."

### [0:30 to 0:42] Why now

ON SCREEN: stay on the warning card.

SAY: "I cannot delete any of this. Blockchains have no delete button. So the
only thing left to control is the next payment."

### [0:42 to 1:05] The answer, live on Demo

ON SCREEN: `#/demo`. Enter the Sepolia demo name in step 2 and click Check
conformance, then click Derive A, B and C. Point at A, B and C.

SAY: "Same name, GhostName enabled. My browser derives a fresh destination,
address A, then B, then C, from the same published record. None of them match.
Same name, a new one-time address every time, derived locally with no gateway.
That is the payment graph breaking."

### [1:05 to 1:32] Discover and control, live on Receive

ON SCREEN: `#/receive`, click Scan announcements. Point at "recognised as
yours", the balance read from chain, the negative control, and the spending-key
check. Open one "Sweep privately via a sponsor" panel, enter a clean destination,
and click Build sweep package.

SAY: "Now the recipient view. My private viewing key recognises my payments. A
freshly generated unrelated key recognises zero of them, because recognition
needs the private key, not just public data. I can derive the key that controls
each address, and sign a sponsored sweep so the funds move out without the
stealth address ever holding gas."

### [1:32 to 1:48] Honest scope, live on Privacy

ON SCREEN: `#/privacy`. Show the protects and does-not-protect columns.

SAY: "We say exactly what this is. It protects your future receiving addresses
against ordinary observers. It does not delete history, hide the amount, or
hide the sender. Forward privacy, not anonymity."

### [1:48 to 2:00] Close

ON SCREEN: back to the title, or the close slide.

SAY: "Everything you saw is live on Sepolia. A real name registered, a record
published, a payment sent, discovered, recovered, and swept with a sponsored
transaction. Blockchains have no delete button. GhostName gives the identity
you already have a forward-privacy button. Keep the name. Break the payment
graph."

## If you want the on-chain sweep on camera

Run `npm run sweep:sepolia` in a terminal. It deploys the executor if needed,
funds a fresh stealth address, and sweeps it with a sponsored EIP-7702
transaction, then prints the transaction hash. Show the printed hash on
Etherscan to prove the stealth address never paid its own gas.

## Fallbacks during recording

- Mainnet read is slow: the Scan input accepts any name, so retry, or the app
  falls back to a second RPC automatically.
- No wallet ready: skip the optional live payment. The Receive scan already
  recognises real prior payments, so the discovery proof still lands.
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

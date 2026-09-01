# GhostName Two-Minute Video Script

One sentence first: GhostName keeps your ENS name and unlinks every future
payment. This script records that claim as a two-minute backup video. Every
step is live. No em dashes, so the narration reads clean. An optional
45-second agent cut follows the main script.

## Before you hit record

1. Open the deployed app and set browser zoom to about 150 percent so a
   projector can read it. Close the dev console.
2. Import the demo receive identity once, so the Receive page can recognise
   payments. Go to `#/create`, use "Or import an existing identity", and paste
   the JSON from your local `.demo/identity.json` (testnet only). The page will
   show the demo meta-address once imported.
3. Have these tabs or deep links ready: `#/scan`, `#/demo`, `#/receive`,
   `#/privacy`. Links are listed at the bottom.
4. Optional live payment: connect MetaMask on Sepolia with a little test ETH if
   you want to send a fresh payment on camera. The video works without it,
   because the Receive scan already finds real prior payments.
5. Optional agent cut: run `npm run build:agent`, connect the server with
   `claude mcp add ghostname -- node ./dist-agent/ghostname-mcp.mjs`, and open
   Claude Code with a large font. Check once that
   `node dist-agent/ghostname.mjs audit skrillah.eth --chain 1` prints
   INCOMPLETE.

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

ON SCREEN: `#/scan`, `skrillah.eth` pre-filled, click Resolve. Point at the red
static address and the exposure panel.

SAY: "This is a real name on mainnet. It resolves to one static address, so
anyone can assemble its whole financial profile from it. Here is a live sample.
That linkage is public and permanent."

### [0:30 to 0:42] Why now

ON SCREEN: stay on the warning card.

SAY: "I cannot delete any of this. Blockchains have no delete button. So the
only thing left to control is the next payment."

### [0:42 to 1:05] The answer, live on Demo

ON SCREEN: `#/demo`. Resolve the test name to address A. Resolve again to
address B. Point at A and B.

SAY: "Same name, GhostName enabled. I resolve it and my browser derives a fresh
destination, address A. I resolve the exact same name again and get address B.
A is not B. Same name, a new one-time address every time, derived locally with
no gateway. That is the payment graph breaking."

### [1:05 to 1:32] Discover and control, live on Receive

ON SCREEN: `#/receive`, click Scan announcements. Point at "recognised as
yours", the negative control, and the spending-key check. Open one "Sweep
privately" panel and click Sign sweep authorization.

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

## Optional agent cut (45 seconds)

Record this as a separate take and splice it in after [1:32], or publish it as
its own clip. Every call is live and read-only. The agent never receives a key.

### [0:00 to 0:15] Ask the agent

ON SCREEN: Claude Code with the `ghostname` server connected. Type "Audit
skrillah.eth and help me improve its privacy." Let the audit tool call and its
result appear.

SAY: "Now the same audit, run by an AI agent through a GhostName server on my
own laptop. It reads the chain and names the leak with stable codes: static
address exposed, stealth record missing. It marks what it could not establish
as unknown instead of guessing."

### [0:15 to 0:30] The safe handoff

ON SCREEN: the prepare-upgrade result and its link. Open the link in the
browser; point at the line "Key generation happens here, in this browser,
outside the agent" and at the live status.

SAY: "It hands me a link, nothing more. The keys are generated in my browser,
the name is resolved again live, and my wallet signs the record. The agent got
a status, codes and a URL. It never got a key, a record value or a
transaction, and a test over the whole import graph keeps it that way."

### [0:30 to 0:45] Prove and close

ON SCREEN: ask "Audit ghostname-3c7714.eth on Sepolia", then "Verify the
sponsored exit 0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25
on Sepolia". Show PRIVATE-READY and VERIFIED with the not-proven list.

SAY: "The upgraded name comes back private-ready for compatible senders, and
the real sponsored exit verifies from chain data, eight checks, with the
not-proven list still attached. GhostName gives AI agents evidence and gives
humans control. Keep the ENS name. Break the payment graph."

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
- Claude Code not ready: record the agent cut with the CLI instead. The
  commands are at the end of AGENT_DEMO.md and print the same reports.
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
Agent demo steps: AGENT_DEMO.md in the repository

On-chain evidence on Sepolia (open on Etherscan while narrating "this is live"):

- Test name registration: https://sepolia.etherscan.io/tx/0x04985bb69fb3b20b034465cbe3d1acfd5a5ca3734ca3eab19db577462383a398
- Stealth record published: https://sepolia.etherscan.io/tx/0x75b7a6404a5a3b1880f8dce7c874cbf34ce65fca64cffeb7e313567b2759ea29
- Stealth payment: https://sepolia.etherscan.io/tx/0x2430f7f8a422a6a527272cd591541c101e9fffd43dccb2a1feed918ee0dc248b
- ERC-5564 announcement: https://sepolia.etherscan.io/tx/0x4164c074fbb0adacf3d3804928e2a4cc803d61e783e9fbbef207608fe3010c11
- Sponsored EIP-7702 sweep (first live proof): https://sepolia.etherscan.io/tx/0x412cca80d621d5d58a38ef190c6a8c323d18adb1be3488f29868d1b4b2efedc0
- Sponsored EIP-7702 sweep built from the sweep package, the one the app and the agent verify: https://sepolia.etherscan.io/tx/0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25
- Sweep executor contract: https://sepolia.etherscan.io/address/0x94E4C39055fa4a5fCd47E03CbcbCD0503848806b

Demo test name (for Pay, Demo and agent inputs): `ghostname-3c7714.eth`
Receive scan start block: `11612900`

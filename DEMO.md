# GhostName Demo Runbook

Two ways to run the demo. The **web flow** on `#/demo` is the 90-second
version. The **agent flow** in Claude Code is the three-minute version and the
one that shows the new capability: an AI agent audits a real name, explains the
leak, hands the human a safe link, and verifies the result without ever holding
a key. Rehearse both; run whichever the room asks for.

## Preferred web flow: one guided route

`#/demo` runs the entire story on a single page: audit, upgrade, derive, prove
receive, prove exit, boundary, close. No step navigates elsewhere. The exit
proof re-verifies published chain data live, so the route holds up even without
sending a fresh transaction on stage. Everything below remains valid as the
per-page fallback.

Target: 90 seconds, live calls only. Inputs may be pre-filled; outputs never
are. Sequence mirrors `/demo` in the app.

## Agent flow: Claude drives, the human signs

Full step list with expected outputs: [AGENT_DEMO.md](AGENT_DEMO.md).
Target: three minutes, live calls only, no keys anywhere near the agent.

Setup, once, before the demo:

```bash
npm run build:agent
claude mcp add ghostname -- node ./dist-agent/ghostname-mcp.mjs
node dist-agent/ghostname.mjs audit skrillah.eth --chain 1
```

The third command should print `INCOMPLETE` with `STATIC_ADDRESS_EXPOSED` and
`STEALTH_RECORD_MISSING`. If it does, the server, the RPC and the audit are
all working.

On stage:

1. **Ask.** "Audit skrillah.eth and help me improve its privacy." Point at the
   tool call: only a name and a chain id. No RPC URL, no key parameter.
2. **Read the result.** INCOMPLETE. Two evidenced findings, one unknown the
   tool refuses to guess, five limitations stated up front. No score.
3. **Handoff.** The agent calls prepare-upgrade and shows a link. Open it. The
   page says key generation happens here, in the browser, outside the agent,
   and re-resolves the name live. Add `&status=private-ready` to the URL to
   show it is listed as ignored. Do not publish for skrillah.eth.
4. **Say what never happened.** The agent got a status, codes and a URL. It
   did not get a key, a record value, calldata or a wallet. A test walks the
   whole import graph to keep it that way.
5. **The upgraded name.** "Audit ghostname-3c7714.eth on Sepolia." PRIVATE-READY
   for compatible senders; the static address warning remains, on purpose.
6. **Prove.** Ask the agent to verify the real payment and announcement, then
   the real sponsored exit. Both verify from chain data, eight checks each, and
   both keep their not-proven list.
7. **Close.** "GhostName gives AI agents evidence and gives humans control.
   Keep the ENS name. Break the payment graph."

## Pre-demo checklist (do all of this the night before)

- [ ] `npm install && npm test && npm run build && npm run build:agent` from a
      clean clone passes.
- [ ] `.env` pins your own RPC endpoints (`VITE_MAINNET_RPC_URL`,
      `VITE_SEPOLIA_RPC_URL`); the agent layer honours the same values. Do not
      rely on public defaults on stage.
- [ ] `VITE_DEMO_SEPOLIA_NAME` is set to the controlled test name and its
      `stealth-meta-address[1]` record resolves on Sepolia.
- [ ] `VITE_SCAN_START_BLOCK` set to just before your test payments.
- [ ] Presenter wallet is on **Sepolia** with at least 0.05 test ETH.
- [ ] Claude Code lists the five `ghostname_*` tools (`/mcp` in an interactive
      session, or `npm run mcp:inspect`).
- [ ] `node dist-agent/ghostname.mjs audit skrillah.eth --chain 1` reads
      INCOMPLETE and `... audit ghostname-3c7714.eth --chain 11155111` reads
      PRIVATE-READY.
- [ ] The deployed URL loads on venue Wi-Fi AND a phone hotspot.
- [ ] Backup demo video (2 min) exists offline and online.
- [ ] Browser zoom about 125 to 150 percent for the projector; console closed;
      Claude Code font large enough to read tool names.

## Web script

1. **Open `/demo`.** "This is `skrillah.eth`, an established public
   identity." Click *Resolve on mainnet* (read-only). Point at the static
   address: "Years of history. Anyone can see every payment. I cannot
   delete any of it, blockchains have no delete button."
2. **The fix, on the test identity.** "Same identity model, GhostName
   enabled." Click *Resolve privately → A*. "This destination was derived
   in my browser from the name's published stealth record, fresh
   randomness, no server."
3. Click *Resolve again → B*. "Same name. Different address. **A ≠ B**,
   that is the payment graph breaking."
4. **Pay.** Switch to `/pay` (name pre-filled), send the small Sepolia
   amount to the latest derivation. Show the two transactions: transfer +
   ERC-5564 announcement.
5. **Receive.** Switch to `/receive`, click *Scan announcements*. "My
   private viewing key recognises the payment…" point at the live negative
   control: "…and a freshly generated unrelated key recognises **zero** of
   them. Recognition is a private capability." Point at the spending-key
   check: "and I can derive the key that controls it."
6. **Honesty.** Flash `/privacy`: "Past, cannot be erased. Future, one
   record, endless one-time addresses. Here is exactly what this does and
   does not protect."
7. **Close.** "Blockchains do not have a delete button. GhostName gives
   established identities a forward-privacy button. **Keep the name. Break
   the payment graph.**"

## Failure fallbacks

- Mainnet RPC hiccup → the input accepts any name; retry, or use the
  fallback RPC already configured (automatic). In the agent flow the tool
  returns `unknown` with `RPC_UNAVAILABLE` rather than a pass; say that this is
  the honest result, then retry.
- Sepolia RPC hiccup on scan → narrow the from-block; retry.
- Wallet refuses → the derivation steps (1 to 3) alone still prove the core;
  fall back to the recorded video for steps 4 and 5.
- Claude Code unavailable → run the same sequence with the CLI in a terminal
  (commands at the end of AGENT_DEMO.md). Same service functions, same output.
- Total network failure → play the backup video.

## Freeze rule

After the backup video is recorded (Friday night), only fixes for failed
acceptance tests or presentation-breaking bugs. No new features.

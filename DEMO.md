# GhostName Demo Runbook

## Preferred flow: one guided route

`#/demo` runs the entire story on a single page: audit, upgrade, derive, prove
receive, prove exit, boundary, close. No step navigates elsewhere. The exit
proof re-verifies published chain data live, so the route holds up even without
sending a fresh transaction on stage. Everything below remains valid as the
per-page fallback.



Target: 90 seconds, live calls only. Inputs may be pre-filled; outputs never
are. Sequence mirrors `/demo` in the app.

## Pre-demo checklist (do all of this the night before)

- [ ] `npm ci && npm test && npm run build && npm run build:agent` from a clean
      clone passes (Node 20+).
- [ ] For the agent flow: Claude Code lists the five `ghostname_*` tools
      (`/mcp` in an interactive session, or `npm run mcp:inspect`).
- [ ] `.env` pins your own RPC endpoints (`VITE_MAINNET_RPC_URL`,
      `VITE_SEPOLIA_RPC_URL`), do not rely on public defaults on stage. Every
      `VITE_*` value ships in the public bundle: keyless URLs or origin-bound
      keys only.
- [ ] `.env` optionally sets `VITE_DEMO_MAINNET_NAME` to the established name
      you will audit in step 1; the shipped build has no default and never
      queries a name on load.
- [ ] `VITE_DEMO_SEPOLIA_NAME` is set to the controlled test name and its
      `stealth-meta-address[1]` record resolves on Sepolia.
- [ ] `VITE_SCAN_START_BLOCK` set to just before your test payments.
- [ ] Presenter wallet is on **Sepolia** with ≥ 0.05 test ETH.
- [ ] The deployed URL loads on venue Wi-Fi AND a phone hotspot.
- [ ] Backup demo video (2 min) exists offline and online.
- [ ] Browser zoom ≈ 125–150% for the projector; console closed.

## Script

1. **Open `/demo`.** Type (or use your pre-filled) established mainnet
   name and click *Audit on mainnet (read-only)*. "This is an established
   public ENS identity." Point at the static address: "Years of history.
   Anyone can see every payment. I cannot delete any of it, blockchains have
   no delete button."
2. **The fix, on the test identity.** Enter the controlled Sepolia name
   (`ghostname-3c7714.eth`) and click *Check conformance*. "Same identity
   model, GhostName enabled: the record is published on the name itself."
3. Click *Derive A, B and C*. "Three derivations in my browser from the
   name's published stealth record, fresh randomness, no server. **None of
   them match.** That is the payment graph breaking."
4. **Prove receive.** Click *Run recognition test*, then *Verify the
   payment and announcement*. "The intended viewing key recognises the
   payment, an unrelated key finds nothing, and the published payment is
   re-verified from chain data, including that the announcement names the
   funded address."
5. **Prove exit.** Click *Verify the sponsored exit*. "The stealth address
   never paid its own gas for this exit; a sponsor did. The list below says
   exactly what this evidence does not prove."
6. **Optional live payment and scan.** Switch to `/pay` (name pre-filled if
   configured), review the two transactions shown before signing, send the
   small Sepolia amount, then on `/receive` click *Scan announcements*. Point
   at the balance read from chain, the negative control ("a fresh unrelated
   key recognises **zero**") and the spending-key check.
7. **Honesty.** The boundary step on `/demo`, or `/privacy`: "Past, cannot
   be erased. Future, one record, endless one-time addresses. Here is exactly
   what this does and does not protect."
8. **Close.** "Blockchains do not have a delete button. GhostName gives
   established identities a forward-privacy button. **Keep the name. Break
   the payment graph.**"

## Agent flow: Claude drives, the human signs

Full step list with expected outputs: [AGENT_DEMO.md](AGENT_DEMO.md).
Target: three minutes, live calls only, no keys anywhere near the agent.

Setup, once, before the demo (use your locally configured established mainnet
name in place of `name.eth`; never commit it):

```bash
npm run build:agent
claude mcp add ghostname -- node ./dist-agent/ghostname-mcp.mjs
node dist-agent/ghostname.mjs audit name.eth --chain 1
```

The third command should print `INCOMPLETE` with `STATIC_ADDRESS_EXPOSED` and
`STEALTH_RECORD_MISSING` for an ordinary name. If it does, the server, the RPC
and the audit are all working.

On stage:

1. **Ask.** "Audit name.eth and help me improve its privacy." Point at the
   tool call: only a name and a chain id. No RPC URL, no key parameter.
2. **Read the result.** INCOMPLETE. Two evidenced findings, one unknown the
   tool refuses to guess, the limitations stated up front. No score.
3. **Handoff.** The agent calls prepare-upgrade and shows a link. Open it. The
   page says key generation happens here, in the browser, outside the agent,
   and re-resolves the name live. Add `&status=private-ready` to the URL to
   show it is listed as ignored. Do not publish for the mainnet name: mainnet
   writes are blocked in the shipped build.
4. **Say what never happened.** The agent got a status, codes and a URL. It
   did not get a key, a record value, calldata or a wallet. A test walks the
   whole import graph to keep it that way.
5. **The upgraded name.** "Audit ghostname-3c7714.eth on Sepolia." PRIVATE-READY
   for compatible senders; the static address warning remains, on purpose.
6. **Prove.** Ask the agent to verify the real payment and announcement, then
   the real sponsored exit. Both verify from chain data, eight checks for the
   payment and nine for the exit, and
   both keep their not-proven list.
7. **Close.** "GhostName gives AI agents evidence and gives humans control.
   Keep the ENS name. Break the payment graph."

## Failure fallbacks

- Mainnet RPC hiccup → the input accepts any name; retry, or use the
  fallback RPC already configured (automatic).
- Sepolia RPC hiccup on scan → narrow the from-block; retry.
- Wallet refuses → steps 1 to 5 need no wallet and still prove the core;
  fall back to the recorded video for the optional live payment.
- Wrong network for a name → the audit says "nothing found on this network"
  rather than guessing; switch the network selector on `/scan` or use the
  Sepolia field on `/demo`.
- Claude Code unavailable → run the same sequence with the CLI in a terminal
  (commands at the end of AGENT_DEMO.md). Same service functions, same output.
- Total network failure → play the backup video.

## Freeze rule

After the backup video is recorded (Friday night), only fixes for failed
acceptance tests or presentation-breaking bugs. No new features.

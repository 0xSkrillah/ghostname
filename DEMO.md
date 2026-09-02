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

- [ ] `npm install && npm test && npm run build` from a clean clone passes.
- [ ] `.env` pins your own RPC endpoints (`VITE_MAINNET_RPC_URL`,
      `VITE_SEPOLIA_RPC_URL`), do not rely on public defaults on stage.
- [ ] `VITE_DEMO_SEPOLIA_NAME` is set to the controlled test name and its
      `stealth-meta-address[1]` record resolves on Sepolia.
- [ ] `VITE_SCAN_START_BLOCK` set to just before your test payments.
- [ ] Presenter wallet is on **Sepolia** with ≥ 0.05 test ETH.
- [ ] The deployed URL loads on venue Wi-Fi AND a phone hotspot.
- [ ] Backup demo video (2 min) exists offline and online.
- [ ] Browser zoom ≈ 125–150% for the projector; console closed.

## Script

1. **Open `/demo`.** "This is an established public ENS
   identity." Click *Resolve on mainnet* (read-only). Point at the static
   address: "Years of history. Anyone can see every payment. I cannot
   delete any of it, blockchains have no delete button."
2. **The fix, on the test identity.** "Same identity model, GhostName
   enabled." Click *Resolve privately → A*. "This destination was derived
   in my browser from the name's published stealth record, fresh
   randomness, no server."
3. Click *Resolve again → B*. "Same name. Different address. **A ≠ B** -
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
  fallback RPC already configured (automatic).
- Sepolia RPC hiccup on scan → narrow the from-block; retry.
- Wallet refuses → the derivation steps (1–3) alone still prove the core;
  fall back to the recorded video for steps 4–5.
- Total network failure → play the backup video.

## Freeze rule

After the backup video is recorded (Friday night), only fixes for failed
acceptance tests or presentation-breaking bugs. No new features.

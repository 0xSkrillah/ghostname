# GhostName UI/UX audit

Audited 2026-09-02 against commit `f41c80c` (main after PR #2); every finding
fixed on branch `claude/ui-ux-audit-f2419d` on 2026-09-03 (see Resolution).

Method: the dev server (`npm run dev`) with a local, uncommitted `.env`
carrying the public demo values from `.env.example`
(`VITE_DEMO_SEPOLIA_NAME=ghostname-3c7714.eth`, `VITE_SCAN_START_BLOCK=11612900`,
no mainnet name). Every route was walked at the pane's ~800 px desktop width
and at 375 px mobile emulation, with live reads: mainnet audit of
`vitalik.eth`, Sepolia conformance of the demo name, derivation, recognition,
the payment and sponsored-exit proofs, and an announcement scan (blocks
11612900 to 11622155, 20 announcements, 0 recognised, negative control 0). No
injected wallet was available, so wallet-signed writes (publish, send, sweep)
were exercised only up to the point of connection. Contrast ratios were
computed from the palette in `src/styles.css`. Keyboard traversal was checked
on `/privacy`.

Each finding names the UX law from the audit brief it violates, the file and
line, what was observed, and the fix.

## Verdict

The product is honest, accessible and well guarded. Focus rings, route titles,
skip link, live regions, pre-sign transaction tables and the stale-result
banner are all in place and work. Two defects would hurt a live presentation:
on `/pay` the wallet connect button fails silently, and the closing comparison
on `/demo` attributes the audited mainnet address to the Sepolia demo name.
Below those, the mobile layout overflows once proof panels render, the
navigation targets are too small to tap, and the guided demo never reaches a
completion state.

| Severity | Count |
|---|---|
| High | 2 |
| Medium | 7 |
| Low | 8 |
| Info | 1 |

## Resolution (2026-09-03)

Every finding below was fixed on this branch and re-verified on the dev
server the same way it was found. Line numbers in the findings refer to the
audited commit `f41c80c`; the fixes are in the files named here.

| ID | Fix | Verified |
|---|---|---|
| H1 | `wallet.error` renders beside the connect button on `/pay`, with a no-wallet hint before the click (`src/pages/Pay.tsx`) | Click with no wallet shows the alert next to the button |
| H2 | Closing comparison uses the upgraded name's own conventional address (`src/pages/Demo.tsx`) | BEFORE column shows the Sepolia name with its own address |
| M1 | `code, .mono { overflow-wrap: anywhere }` (`src/styles.css`) | `/demo` with all proofs and `/scan` with a result: scroll width 375 at 375 px |
| M2 | Nav links are 44 px tall and at least 44 px wide targets (`src/styles.css`) | Pay 44×44, Scan 46×44, Receive 65×44 at 375 px |
| M3 | `SweepProofPanel` and `PaymentProofPanel` report results; step 5 turns done; a completion card follows the five action steps; boundary and close are sections, not counted steps (`src/pages/Demo.tsx`, `src/components/*ProofPanel.tsx`) | Steps read 5 of 5 done; completion card present |
| M4 | `/create` after generation: record, then Publish, then a collapsed "Back up this identity", then Discard (`src/pages/Create.tsx`) | Three headings in that order; backup panel collapsed by default |
| M5 | Wallet errors under the connect button; preflight errors under the name form; publish errors inside the sign card (`src/pages/Create.tsx`) | No-wallet hint sits in the connect row |
| M6 | Start block syntax checked before any RPC call; range errors shown under the field with `aria-invalid`; explorer separators accepted (`src/chain/announcer.ts`, `src/pages/Receive.tsx`) | `abc` gives the field error with zero network calls; `11,612,900` scans |
| M7 | Pre-sign simulation of the exact `setText` from the connected wallet; a revert blocks publish with a plain explanation, a transport failure is reported as unknown (`src/ens/write.ts`, `src/pages/Create.tsx`) | Unit tests for ok, blocked and unknown; the live path needs a connected wallet |
| L1 | Inline danger card with acknowledgement checkbox replaces `confirm()` (`src/pages/Create.tsx`) | Button disabled until checked; focus returns to Generate |
| L2 | `storage` event listener invalidates the identity cache (`src/state/identity.ts`) | Discarding in one tab updated `/receive` in another without reload |
| L3 | Live "n of 12 characters" hint with `aria-describedby` and `aria-invalid` (`src/pages/Create.tsx`) | "5 of 12 characters." shown for a short passphrase |
| L4 | Shorter labels, full-width CTAs under 480 px, quiet "Or watch the two-minute demo" link (`src/pages/Landing.tsx`, `src/styles.css`) | Both CTAs 327 px wide at 375 px |
| L5 | One-sentence leads; caveats moved under the form (`src/pages/Scan.tsx`, `src/pages/Receive.tsx`) | Scan lead 160 characters |
| L6 | Empty state uses the route heading (`src/pages/Receive.tsx`) | h1 "Discover your payments" in both states |
| L7 | Per-field pre-fill copy (`src/pages/Demo.tsx`) | "Pre-filled from your local configuration: the GhostName-enabled Sepolia name. Type the other." |
| L8 | "Try on the other network" button for an unknown result (`src/pages/Scan.tsx`) | Unknown on Sepolia offered mainnet; one click re-ran it |
| Info | Loading text states the 10-second wait (`src/components/ExposurePanel.tsx`) | Copy only |

Also fixed while there: both proof panels now show an error with a retry hint
when the RPC read fails (previously an unhandled rejection with no feedback).

Tests added: separator handling and the pre-RPC syntax check in
`tests/inputGuards.test.ts`; `checkStealthRecordWritable` ok, blocked and
unknown paths in `tests/ens.test.ts`.

## Fix first (smallest change, largest effect)

1. H1: render `wallet.error` beside the connect button on `/pay`.
2. H2: pass the upgrade report's own address (or none) to the closing `Compare` on `/demo`.
3. M1: `.mono { overflow-wrap: anywhere; }` in `src/styles.css`.
4. M2: give nav links padding so each target is at least 44 px tall and 32 px wide.
5. M3: mark demo step 5 done when the exit proof verifies, and add a completion card.

## High

### H1. `/pay`: "Connect wallet" gives no feedback when it fails

- Laws: 6 Doherty threshold (acknowledge every action), 15 make errors recoverable.
- Where: `src/pages/Pay.tsx:258-268`. `wallet.error` is set by `useWallet`
  (`src/state/wallet.ts:100-105`) but Pay never renders it; Create does
  (`src/pages/Create.tsx:593-597`).
- Observed: with no browser wallet installed, clicking "Connect wallet" changed
  nothing on screen. The same silence covers a user who rejects the connection
  prompt. A presenter on a laptop without MetaMask sees a dead button.
- Fix: render `wallet.error` with `role="alert"` directly under the button
  (proximity, law 8). When `wallet.available` is false, replace the button with
  the guidance text and a link to install a wallet.

### H2. `/demo`: the closing comparison mislabels identities

- Laws: 12 Prägnanz (the simplest reading is wrong), 17 uniform connectedness.
- Where: `src/pages/Demo.tsx:362-366` passes `name={upgrade?.name}` with
  `staticAddress={audit?.conventionalAddress}`.
- Observed: after a full run the BEFORE column read
  `ghostname-3c7714.eth ↓ every payment 0xd8dA6BF269…A96045`, which is
  `vitalik.eth`'s address under the Sepolia demo name. On a projector this
  states that the demo name resolves to the audited mainnet wallet.
- Fix: use `upgrade?.conventionalAddress` for the static column, or render two
  labelled rows (audited name → its static address; upgraded name → derived
  addresses). Never combine fields from two reports in one figure.

## Medium

### M1. Mobile: unwrapped addresses push the page sideways

- Laws: 12 Prägnanz, 2 Fitts (content off-screen cannot be reached), 15.
- Where: `.mono` only sets the font (`src/styles.css:64`); `.bigmono` has
  `word-break` but these spans use `.mono`: `src/pages/Demo.tsx:231`,
  `src/components/PaymentProofPanel.tsx:84`, `src/components/SweepProofPanel.tsx:88-89`,
  `src/components/PrivacyReadinessReport.tsx:143`.
- Observed at 375 px: `/demo` after all proofs `scrollWidth` 440 (four
  overflowing spans: resolver in step 2, stealth address in step 4, sponsor
  and swept account in step 5); `/scan` with a result `scrollWidth` 380, the
  resolver address visibly clipped. `FINAL_AUDIT.md` (line 588) recorded no
  overflow at 320/375; it regressed once the proof panels carry content.
- Fix: `.mono { overflow-wrap: anywhere; }` (or use `.bigmono small` for
  addresses). Re-run the headless width check with proofs rendered.

### M2. Top navigation targets are too small to tap

- Law: 2 Fitts.
- Where: `nav.topnav a.navlink { padding: 0.35rem 0 }` (`src/styles.css:82`).
- Observed at 375 px: link boxes were 30×34 (Scan), 42×34 (Create), 22×34
  (Pay), 49×34 (Receive), 45×34 (Privacy), 39×34 (Demo). "Pay" is narrower
  than the 24 px WCAG 2.5.8 minimum; all are under the 44 px comfortable size.
- Fix: `padding: 0.55rem 0.6rem; min-height: 44px; margin: 0 -0.6rem` so the
  visual rhythm holds while the hit area grows; consider a 3+3 grid at ≤480 px.

### M3. The guided demo never completes

- Laws: 11 Zeigarnik, 10 peak-end, 20 goal-gradient.
- Where: `src/pages/Demo.tsx:317` (`className={recognition ? 'active' : ''}`),
  steps 6 and 7 at 322-358.
- Observed: after every proof passed, step 5 stayed "active"; steps 6 and 7
  (boundary, close) are static content that never gets a state, yet they sit
  inside the numbered progress list, so the checklist reads 4 of 7 done at
  the end of a perfect run. There is no completion moment.
- Fix: let `SweepProofPanel` report success (an `onResult` callback or lifted
  state) and mark step 5 done; render a completion card ("Five live proofs
  passed") that carries the tagline; move the boundary and close out of the
  counter (or render them as `li` without a counter) so the count only covers
  actions.

### M4. `/create` stacks five jobs on one screen

- Laws: 1 Hick, 5 Miller, 9 serial position, 7 Von Restorff.
- Where: `src/pages/Create.tsx:336-410` (record, spending key, viewing key,
  plaintext backup, discard, encrypted capsule, then publish).
- Observed: after "Generate keys locally" the page is 3574 px tall at 375 px.
  The next step the product story needs (publish the record) is at the bottom;
  the two most dangerous controls (plaintext backup, discard) sit above it,
  each styled the same as the harmless copy buttons.
- Fix: after generation show the record and one primary path, "Publish to an
  ENS name"; fold keys, plaintext backup and capsule into a collapsed "Back up
  this identity" section using the disclosure pattern `/receive` already uses
  for the sweep panel; keep "Discard identity" last and visually quieter.

### M5. `/create` shows errors far from the control that caused them

- Laws: 4 proximity, 8 place key actions nearby.
- Where: `wallet.error` renders at `src/pages/Create.tsx:593` while the connect
  button is at line 425; the generic `error` at 599 renders after the publish
  card.
- Observed: "No browser wallet detected" appeared below the preflight table,
  two screens under the button on mobile, after the wallet button had already
  lost focus.
- Fix: render `wallet.error` directly under the connect button and preflight
  or publish errors inside the preflight card; keep the focus move to the
  error.

### M6. `/receive` disguises input validation as a network failure

- Laws: 14 prevent errors proactively, 15 explain what went wrong plainly.
- Where: `src/pages/Receive.tsx:61-62` (validation runs after
  `getBlockNumber`) and 123-125 (every error is wrapped in "Could not complete
  the Sepolia scan… set VITE_SEPOLIA_RPC_URL"); `src/chain/announcer.ts:128-130`.
- Observed: start block `abc` produced "Could not complete the Sepolia scan:
  Start block must be a whole number, for example 11612900. Retry; if it
  persists, set VITE_SEPOLIA_RPC_URL in .env to a provider you control." The
  input carries no `aria-invalid`.
- Fix: validate the field on submit before any RPC call and show the
  `ScanRangeError` text alone under the input with `aria-invalid`; wrap only
  RPC errors with the retry hint. Accept `11,612,900` and surrounding spaces.

### M7. Publish preflight does not check that the wallet controls the name

- Laws: 14 disable impossible actions, 13 sensible defaults.
- Where: `src/pages/Create.tsx:127-156` (`prepare` reads resolver and current
  record only).
- Observed: entering the demo name, which this browser does not control,
  produced the full "You will sign one transaction" card with an enabled path
  to publish once a wallet connects. The failure would surface only as a
  reverted transaction in the wallet.
- Fix: once a wallet is connected, read the name's owner or manager where the
  registry allows it and show "This wallet does not control name" before the
  publish button; where ownership cannot be established (ENSv2 wildcard
  cases), say so in the card, matching how resolver provenance is reported.

## Low

### L1. Native `confirm()` for a destructive action

- Laws: 16 consistency, 14 warn before destructive actions.
- Where: `src/pages/Create.tsx:359`.
- Observed: every other acknowledgement in the app is an inline danger card
  with a checkbox or typed phrase; discarding keys uses a browser dialog that
  kiosk and presentation modes may suppress and that cannot be styled or read
  from a projector.
- Fix: inline danger card with the same checkbox pattern as the overwrite
  acknowledgement, then a "Discard" button.

### L2. Identity state does not sync across tabs

- Laws: 11 Zeigarnik, 6 Doherty.
- Where: `src/state/identity.ts:15-29` caches the parsed identity and never
  listens for `storage` events.
- Observed: keys generated on `/create` in one tab left `/receive` in another
  tab on "No local identity found" until a hard reload.
- Fix: `window.addEventListener('storage', …)` to clear the cache and notify.

### L3. Capsule passphrase field gives no live reason for the disabled button

- Law: 14 explain requirements before submission.
- Where: `src/pages/Create.tsx:381-408`.
- Observed: with `short` typed, "Download encrypted capsule" stayed disabled;
  no `aria-describedby`, no counter, no message.
- Fix: a live hint under the field ("5 of 12 characters") linked by
  `aria-describedby`.

### L4. Landing: the secondary action outweighs the primary, and the demo is unreachable

- Laws: 7 Von Restorff, 9 serial position.
- Where: `src/pages/Landing.tsx:21-28`.
- Observed at 375 px: primary CTA 257×45, secondary 312×47, stacked; the longer
  secondary label reads as the bigger button. The two-minute demo, the route
  judges will use, is only in the nav.
- Fix: shorten the primary label ("Audit a name"), make it full width on
  mobile, and add a quiet third link "Two-minute demo".

### L5. Lead paragraphs put caveats before the action

- Laws: 5 Miller, 12 Prägnanz, 19 reveal complexity gradually.
- Where: `src/pages/Scan.tsx:68-76` (92 words, six lines above the input),
  `src/pages/Receive.tsx:148-154`.
- Fix: keep the lead to one sentence; move the "what leaves your browser" and
  RPC-linkage notes into a small note under the form or a disclosure.

### L6. `/receive` empty state disagrees with its own title

- Law: 16 consistency.
- Where: `src/pages/Receive.tsx:136` renders `<h1>Receive</h1>`;
  `src/components/Layout.tsx:19` titles the route "Discover your payments".
- Fix: use the same heading in both states.

### L7. Demo lead claims pre-fill when only one field is

- Law: 15 (plain, accurate feedback).
- Where: `src/pages/Demo.tsx:123-128`.
- Observed: with only `VITE_DEMO_SEPOLIA_NAME` set, the lead said "Inputs are
  pre-filled from your local configuration" while step 1 was empty.
- Fix: per-field copy, or say which inputs are pre-filled.

### L8. Wrong-network audit offers no one-click retry

- Law: 1 Hick (recommend an option).
- Where: `src/pages/Scan.tsx:121-150`.
- Observed: an "Unknown" result says nothing was found on this network; the
  user must find the selector and re-run.
- Fix: when `overallStatus === 'unknown'`, offer "Try on Sepolia testnet"
  (or mainnet) inline.

## Info

- The Mobula panel timed out after 10 s during the audit and recovered with
  a clear message and a Retry button. Keep it opt-in on stage as it is; a
  visible countdown during the wait would help a presenter decide to skip it.

## What already works, keep it

- Every write is previewed as a transaction table before signing
  (`/create`, `/pay`).
- The stale-result banner on `/scan` ties the report to the inputs.
- A paid plan is dropped so the same one-time address cannot be paid twice;
  a missed announcement gets a recovery card with copyable data.
- Focus is visible (2 px accent ring, verified on `/privacy`), the skip link
  works under the hash router, routes set titles and move focus to `main`.
- Contrast on every measured pair is 5.1:1 or better (dim text on raised
  background 5.13:1; accent on background 13.3:1).
- Scan progress is reported per chunk; the negative control runs live.
- Error text is scrubbed of endpoints and key-shaped values.
- Enter submits every form (verified: implicit submission fires).

## Not covered

- Wallet-connected flows (publish, send and announce, sweep signing) beyond
  the connect step: no injected wallet in the audit browser.
- The native `confirm()` dialog itself.
- Screen-reader announcement order of the live regions.

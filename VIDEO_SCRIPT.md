# GhostName: Recording Guide and Video Script

This guide is for the project author, recording the hackathon submission video on a new laptop. It assumes the laptop has nothing installed and holds nothing from the machine the project was built on. Section 1 tells you what to carry over, and 1b what to do when you cannot carry anything over. Section 2 sets the laptop up, command by command. Section 3 is the pre-flight check. Section 4 is the script, which you can drive line by line. Sections 5 to 7 cover assembly, submission, fallbacks and links.

One sentence first: GhostName keeps your ENS name and gives every future payment from a compatible sender a fresh one-time address that an ordinary observer cannot link to the name. The video records that claim. Every step is live. Nothing is precomputed.

House rules that apply to every line of this document and to everything you say on camera:

- Your established mainnet name is never written in this repository and is never pre-filled in the deployed app. This guide calls it "your established mainnet name" or uses the placeholder `name.eth`. You type the real one live. Never commit it.
- Never show a private key, a seed phrase, a passphrase, an API key or a keyed RPC URL on screen. Refer to them by variable name only.
- GhostName is forward recipient-address privacy for compatible senders. Never describe GhostName as anonymous, untraceable, a mixer, zero knowledge or history deletion. Saying what it is not, as the app and the CLI do ("not anonymity", "cannot delete history"), is fine.
- Mainnet is read-only in the shipped build. No step below writes to mainnet.
- Every button label, heading and route below is quoted exactly as the app renders it. Card labels appear in capitals on screen because the CSS uppercases them; the quoted text is the source string.

Where a fact could not be verified from the repository it is marked [CHECK]. Resolve every [CHECK] before recording day.

## 1. What you need from the old machine

A fresh clone of https://github.com/0xSkrillah/ghostname contains the whole app, the agent layer, the tests and every document. It does not contain three gitignored things: `.env`, the `.demo/` folder, and the browser state of the old machine. The `.gitignore` excludes `node_modules/`, `dist/`, `dist-agent/`, `.env`, `.env.*` (except `.env.example`), `*.local`, `*.pem`, `*.key`, `coverage/` and `.demo/`. The first three are rebuilt on the new laptop. The rest must be carried over or replaced.

### The transfer table

| Item | Where it is on the old machine | Why you need it | Cuts that need it | If you do not have it |
|---|---|---|---|---|
| Your established mainnet name | The value of `VITE_DEMO_MAINNET_NAME` in the old `.env`, or your memory | It is the read-only input for `#/scan`, `#/demo` step 1 and the agent audit. It is deliberately absent from every committed file, so the new laptop cannot recover it from the repository. | Two-minute cut, agent cut, extended cut | Any established mainnet name works as a read-only audit input, because the audit only reads public ENS records. Prefer a name you own. Never write to it. |
| `SEPOLIA_PRIVATE_KEY` (see 1b if you cannot get it) | The old `.env` | Throwaway testnet key. Its account registered `ghostname-3c7714.eth` and controls that name's resolver. Used only by the operator scripts under `scripts/` that call `loadTestnetKey` (`scripts/register-v2-name.mjs`, `scripts/relayer-sweep.mjs`, `scripts/prepare-agent-records.mjs`, `scripts/wait-and-run-e2e.mjs`, `scripts/try-register-variants.mjs`) and the live suites (`npm run e2e:sepolia`, `npm run sweep:sepolia`). Never used by the web app or the agent layer. | None. No cut writes with it. | Leave it empty. The stealth record on `ghostname-3c7714.eth` is already published and the proof panels verify existing chain data. Without it you cannot republish that record or put a fresh on-chain sweep on camera; both are optional. |
| `VITE_MAINNET_RPC_URL`, `VITE_SEPOLIA_RPC_URL`, `VITE_MAINNET_RPC_FALLBACKS`, `VITE_SEPOLIA_RPC_FALLBACKS` | The old `.env` | Optional pinned RPC endpoints for a local build. Only for reliability. | Only a local `npm run dev` build; the deployed app uses its own built-in endpoints | Leave them empty. Built-in public defaults are used: publicnode, drpc and 1rpc for both chains, each with a 10 second timeout and one retry of the whole list. |
| `GHOSTNAME_MAINNET_RPC_URL`, `GHOSTNAME_SEPOLIA_RPC_URL` | The old `.env` or shell profile | Optional pinned RPC endpoints for the agent server and CLI. | Agent cut, only for reliability | Leave them empty. Same public endpoints as the web app (the agent layer keeps viem's default retry count, so it can wait longer than the web app when every endpoint is down). |
| `.demo/identity.json` (see 1b if you cannot get it) | `<old clone>/.demo/identity.json`, a 547-byte file with mode 600 in a mode 700 folder | The receive identity: spending and viewing private keys plus the meta-address, in the same JSON shape as a `ghostname-identity.json` backup. Its `stealth-meta-address[1]` record is what `ghostname-3c7714.eth` publishes. `#/receive` needs it to recognise the real prior payments and to build a sweep package. | Two-minute cut, segment "The recipient view". Extended cut, the scan after Insert B. | Without it `#/receive` shows only "No local identity found." with the link "Create or import one first". Every `#/demo` proof, `#/scan` and `#/privacy` still run, because `#/demo` step 4 generates its own recipient and stranger keys and the proof panels re-verify published chain data. Drop the Receive segment as described in section 6. Equivalent substitutes: a `ghostname-identity.json` exported from the old browser with "Download backup (plaintext JSON)", or a `ghostname-capsule.json` plus its passphrase exported with "Download encrypted capsule". If the old browser still holds the identity, open the old machine's `#/create`, click "Show keys and backup options" and export one of those now. |
| `.demo/v2-registration.json` | `<old clone>/.demo/` | Idempotent state file of `scripts/register-v2-name.mjs`. Only read when that script is re-run. | None | Nothing to do. It is not present in the build machine's checkout either. |
| Other `.demo/` files: `executor.json`, `sweep-state.json`, `sweep-evidence.json`, `e2e-evidence.json` | `<old clone>/.demo/` | Inputs and outputs of `npm run sweep:sepolia` and `npm run e2e:sepolia`. | None | Nothing to do. `executor.json` is regenerated by `node scripts/compile-executor.mjs` if ever needed. |
| The presenter wallet: the MetaMask account holding Sepolia ETH, as its secret recovery phrase (seed phrase) or the account's private key | MetaMask on the old machine | Only for the extended cut: connecting a wallet on `#/create` (Insert A) and sending the live payment on `#/pay` (Insert B). | Extended cut only | Create a new wallet in MetaMask on the new laptop and fund it from a Sepolia faucet (section 2, step 7). Or skip the inserts. The two-minute cut and the agent cut need no wallet at all. |
| GitHub push credentials | Old machine's git or `gh` login | Only for `npm run deploy:pages`. | None | Not needed. The deployed app (gh-pages commit `35b6e80`, built from source `74772682c5d4`) is already current. |
| Your Claude account | Old machine's Claude Code login | Claude Code on the new laptop must sign in. | Agent cut | Sign in fresh in section 2, step 10. |

### Which cuts need which item, in one list

- Two-minute cut: your established mainnet name, `.demo/identity.json` (for the Receive segment), nothing else. No wallet, no key. If the old identity file is gone, section 1b creates a new one.
- 45-second agent cut: your established mainnet name, a working Claude Code login, the local clone with `dist-agent/` built. No wallet, no key, no identity.
- Three-minute extended cut: everything above plus the presenter wallet on Sepolia with test ETH.
- Optional fresh on-chain sweep on camera: `SEPOLIA_PRIVATE_KEY`, `.demo/identity.json` and `.demo/executor.json`. Not recommended for the video; the published sweep already verifies live. macOS or Linux only (Section 2, step 6).

### How to move them safely

- Move values, not screenshots, and move only what a cut needs: your established mainnet name and the full contents of `.demo/identity.json`, plus, for the extended cut only, the presenter wallet if you cannot fund a new one from a faucet. Put them into secure notes in a password manager that syncs to the new laptop. That is the first choice. Leave `SEPOLIA_PRIVATE_KEY` on the old machine unless you decide, before recording day, to run a live suite; no cut uses it.
- Second choice: an encrypted archive. On Windows use 7-Zip with AES-256 and a long passphrase. On macOS use Disk Utility to create an encrypted disk image, or a 7-Zip compatible tool such as Keka [CHECK which tool you have]. Carry the archive on a USB stick or attach it to the password manager entry. Send the passphrase by a different channel than the archive, then delete the message.
- Never send any of these in plaintext by chat, email, a shared cloud folder or a screenshot. Never paste the seed phrase anywhere except MetaMask's own import screen.
- After copying on the new laptop: put `identity.json` in `.demo/`, run `chmod 700 .demo` and `chmod 600 .demo/identity.json` (macOS or Git Bash), delete the archive and any loose copy from Downloads and the Desktop, and empty the Trash or Recycle Bin.
- The import on the deployed `#/create` (section 2, step 8) is the integrity check: the page re-derives the meta-address from the private keys and rejects a file that does not match. If it imports, the transfer worked.
- Leave the old machine as it is until the submission is accepted. Wipe or keep it afterwards as you choose; the key is testnet only, but treat it as a secret anyway.

### 1b. Starting with nothing from the old machine: the fresh-start path

Use this path when the old `.env` and `.demo/` folder are out of reach. It
takes about an hour plus faucet waiting time and needs about 0.05 Sepolia ETH.
The result is a second controlled demo identity that you hold, so every
recipient-side step (the `#/receive` scan, the sweep package, the Pay insert)
works again.

What is lost and what is not. Without `.demo/identity.json`, nobody holds the
keys behind the record on `ghostname-3c7714.eth`. That name still reads
Private-ready, `#/demo` steps 1 to 5 still run, the payment and exit proof
panels still verify the published evidence from chain data, and the agent cut
is unaffected. What no longer works for that name is recognising or sweeping
payments to it. Without the old `SEPOLIA_PRIVATE_KEY`, nobody can write to
that name's resolver either, so it stays exactly as it is. Nothing you do below
touches it.

Windows note: the operator scripts refuse an identity file that other users can
read, and Node reports every file as world-readable on NTFS, so on Windows run
steps 5 to 7 inside WSL (Ubuntu), with the clone inside the WSL file system.
The browser steps and the recording itself stay on Windows.

1. Do section 2, steps 1 to 5 first: git, Node, clone, `npm ci`, `npm test`,
   and `.env` copied from `.env.example`. Section 2 step 7 (browser profile
   and MetaMask) is also needed before step 2 below.
2. Create the throwaway Sepolia account. In MetaMask, in the recording profile,
   add a new account and name it "GhostName throwaway". Export its private key
   (account menu, account details, show private key, confirm with the MetaMask
   password [CHECK the exact wording in your version]). Paste it into `.env`
   as `SEPOLIA_PRIVATE_KEY=0x...` (0x plus 64 hex characters). This one
   account is the registrant of the new name, the sponsor for the scripts and
   the presenter wallet for `#/pay`. It is testnet only; never send real
   assets to it. Close the MetaMask key view before anything is recorded.
3. Fund it. Send Sepolia ETH from a faucet to that account, target 0.05 ETH:
   registration is about seven transactions, the live payment suite three,
   the optional fresh sweep three more. MetaMask shows the balance; the
   scripts print it too. Do this the day before recording.
4. Create the receive identity in the browser and save it as the demo identity
   file. Open https://0xskrillah.github.io/ghostname/#/create in the recording
   profile. Click "Generate keys locally", then "Show keys and backup options",
   then "Download backup (plaintext JSON)". Move the downloaded
   `ghostname-identity.json` into the clone:

   ```bash
   mkdir -p .demo && chmod 700 .demo
   mv ~/Downloads/ghostname-identity.json .demo/identity.json
   chmod 600 .demo/identity.json
   ```

   Keep the identity in the browser: do not click "Discard identity". The
   browser copy is what `#/receive` will scan with; the file copy is what the
   scripts publish. They are the same keys.
5. Register the new name. From the repository root:

   ```bash
   node scripts/register-v2-name.mjs
   ```

   It prints the account and balance, then `target name: ghostname-xxxxxx.eth`
   where `xxxxxx` is the first six hex characters of the account address in
   lower case. It mints free test USDC, deploys a resolver, commits, waits
   about a minute for the commitment age, registers the name for one year,
   sets the address record and the `stealth-meta-address[1]` record from your
   identity file, then re-reads them and prints `record matches identity:
   true` and `DONE. state: {...}`. State is saved to
   `.demo/v2-registration.json`, so the script can be re-run if it stops
   halfway. Write the new name down; it is your demo name from here on.
6. Make the first payment and prove recognition, using the app's own code
   paths:

   ```bash
   RUN_LIVE=1 npm run e2e:sepolia
   ```

   (PowerShell would need `$env:RUN_LIVE='1'`, but run this in WSL or on macOS
   as noted above.) The suite publishes the record through the app write path,
   derives two destinations and checks they differ, pays 0.0005 ETH to the
   first, announces it, scans, recognises it with your viewing key, runs the
   negative control, recovers the spending key, and writes
   `.demo/e2e-evidence.json` with the name, the payment and announcement
   transaction hashes and `scanStartBlock`. Note that block number. The suite
   skips itself if the account holds less than 0.01 ETH.
7. Optional, a fresh sponsored sweep on chain (needs at least 0.003 ETH):

   ```bash
   node scripts/compile-executor.mjs
   RUN_LIVE=1 npm run sweep:sepolia
   ```

   This deploys a new executor, funds a fresh stealth address of your identity
   and sweeps it with a sponsored type-4 transaction, printing the hash. Not
   required for the video: `#/demo` step 5 and the `#/receive` proof panel
   verify the originally published sweep, which is valid chain data whoever
   holds the keys. Skip it if time is short.
8. Point the app at the new identity. In `.env` set
   `VITE_DEMO_SEPOLIA_NAME=ghostname-xxxxxx.eth` (your new name) and
   `VITE_SCAN_START_BLOCK=` to the `scanStartBlock` from step 6. This
   pre-fills a local `npm run dev` build. The deployed app still pre-fills the
   original name and block, so on the deployed app type the new name into
   `#/demo` step 2 and `#/pay`, and the new start block into `#/receive`.
   Or redeploy from this laptop so the pre-fills match:

   ```bash
   VITE_DEMO_SEPOLIA_NAME=ghostname-xxxxxx.eth VITE_SCAN_START_BLOCK=<block> npm run deploy:pages
   ```

   That needs git push rights to the repository and a clean tree. The release
   guards accept any `ghostname-` plus six hex `.eth` name, so no code change
   is needed; the footer then shows the new build commit.
9. Check `#/receive` in the recording profile: start block set to your
   `scanStartBlock`, click "Scan announcements". Expected: "1 recognised as
   yours", a card labelled "Payment recognised" with "Balance now: 0.0005 ETH"
   (unless step 7 swept it), "Live negative control" at 0, and "Spending-key
   check: pass". That card is the one to build the sweep package on during
   the recording.
10. What changes in the rest of this guide. Wherever sections 3 and 4 say
    `ghostname-3c7714.eth` for `#/demo` step 2, `#/pay` and `#/receive`, use
    your new name; both names read Private-ready, but only the new one has an
    identity you hold. The agent cut may keep `ghostname-3c7714.eth` or use the
    new name. In the extended cut, Insert A "Path 1" now applies: your new name
    is a Sepolia name with a resolver your wallet controls, so "Check name on
    Sepolia" shows "this wallet can write the record" and, because the record
    is already published for this identity, "This exact record is already
    published". Publishing again is not needed; show the check and move on.

## 2. Set up the laptop

Commands are written for a POSIX shell: Terminal on macOS, Git Bash on Windows. Using Git Bash on Windows keeps every command identical. PowerShell also works for the npm commands used here; only the optional live suites (`npm run e2e:sepolia`, `npm run sweep:sepolia`) use `RUN_LIVE=1 ...` shell syntax that PowerShell and cmd do not understand, and you do not need them for the video.

Network is needed for `npm ci`, the chain reads, MetaMask and Claude Code. Do the whole section a day before recording, on a good connection.

### Step 1: install git

- macOS: open Terminal and run `xcode-select --install`. This installs git with the command line tools. If Homebrew is present, `brew install git` also works.
- Windows: download Git for Windows from https://git-scm.com, install with the defaults, and use "Git Bash" from the Start menu as your terminal.
- Verify: `git --version` prints a version.

### Step 2: install Node 20 or newer

`package.json` requires `"node": ">=20"`. The verified figures in `03_BUILD_STATUS.md` came from Node 22, and CI runs on Node 20 and 22. Install the current LTS (22).

- macOS and Windows: download the LTS installer from https://nodejs.org and run it. Or use a version manager: `nvm install 22` on macOS (nvm), or nvm-windows on Windows.
- Windows: close and reopen Git Bash after installing so the PATH is updated.
- Verify: `node -v` prints `v22.x.x` (or `v20.x.x` or newer); `npm -v` prints `10.x.x`.

### Step 3: clone the repository

Avoid a path with spaces on Windows. Then:

```bash
cd ~
git clone https://github.com/0xSkrillah/ghostname
cd ghostname
git log --oneline -1
```

Expected: the last line shows the current tip of `main`. At the time of writing that is `6bd0375 Merge pull request #7: Record the gh-pages deployment of the disconnect button`. [Re-check on recording day; at review time `main` was `6bd0375` and gh-pages `35b6e80` built from `74772682c5d4`. The deployed app's footer shows the commit the served bundle was built from.]

The clone must stay a real git checkout. `vite.config.ts` embeds `git rev-parse --short=12 HEAD` into the footer; a folder without `.git` shows "unknown" there.

### Step 4: install dependencies and run the verification

Run these from the repository root, in this order. Each one must pass before you move on.

```bash
npm ci
```

Expected: installs exactly the lockfile (lockfile v3) and ends with `found 0 vulnerabilities`.

```bash
npm test
```

Expected final summary: `Test Files  34 passed | 1 skipped (35)` and `Tests  316 passed | 11 skipped (327)`. The 11 skipped tests are the network-gated live suites (`tests/live.ens.test.ts`, `tests/live.sepolia.test.ts`, `tests/live.sweep.test.ts`). A plain `npm test` never touches the network.

```bash
npm run typecheck
```

Expected: only npm's own two banner lines (`> ghostname@0.1.0 typecheck` and `> tsc --noEmit`), nothing from tsc, and exit code 0.

```bash
npm run build
```

Expected: `vite build` lists `dist/index.html` and the chunks (app shell, viem, react, noble), then the last line reads `check-bundle: dist/ is clean (no personal name, credential pattern, private-key-like value or source map).` A keyed RPC URL in `.env` makes this step fail on purpose.

```bash
npm run build:agent
ls dist-agent
```

Expected: `ghostname-mcp.mjs`, `ghostname-mcp-http.mjs`, `ghostname.mjs` and a `ui` folder containing `ghostname-audit.html`. The script prints four lines, `built <absolute path>` each, in this order: `dist-agent/ui/ghostname-audit.html`, `dist-agent/ghostname-mcp.mjs`, `dist-agent/ghostname-mcp-http.mjs`, `dist-agent/ghostname.mjs`. The agent bundles resolve `viem` and the MCP SDK from `node_modules` at runtime, so `npm ci` and `npm run build:agent` must run on the same machine. `dist-agent/` is gitignored and must be rebuilt after every clone.

Optional release guards, the same ones CI runs:

```bash
npx vitest run tests/no-personal-name.test.ts tests/csp.test.ts
```

### Step 5: create `.env`

```bash
cp .env.example .env
chmod 600 .env
```

(Windows PowerShell: `Copy-Item .env.example .env`; cmd: `copy .env.example .env`.)

Open `.env` in a text editor and fill it as follows. Leave everything else as the template has it.

- `VITE_DEMO_MAINNET_NAME=` your established mainnet name. Optional, and for `npm run dev` only, where it pre-fills `#/scan` and `#/demo` step 1. Leave it empty whenever you run `npm run build`, `npm run deploy:pages` or the release guards: the bundle guard (`scripts/check-bundle.mjs`) refuses any name outside its allowlist, so a build with it set ends with `check-bundle: refusing this build:` and a `non-allowlisted ENS name` line. That failed build has already written `dist/`, and `tests/no-personal-name.test.ts` scans `dist/` when it exists, so `npm test` and `npx vitest run tests/no-personal-name.test.ts tests/csp.test.ts` fail too until you run `rm -rf dist` (PowerShell: `Remove-Item -Recurse -Force dist`). The deployed app never pre-fills it; there you type the name live. Never commit it.
- `VITE_ENABLE_MAINNET=false`. Keep it false. The deploy script refuses a build or a `.env` with it set to true.
- `VITE_DEMO_SEPOLIA_NAME=ghostname-3c7714.eth`, `VITE_SCAN_START_BLOCK=11612900`, `VITE_DEMO_PAYMENT_ETH=0.001`. Already set in the template. The deployed build was built with the first two.
- `VITE_MAINNET_RPC_URL=` and `VITE_SEPOLIA_RPC_URL=`: optional. Keyless https URLs only; every `VITE_*` value is inlined into the public bundle, and `npm run build` refuses credential-like query parameters and key-like URL paths.
- `SEPOLIA_PRIVATE_KEY=`: leave empty for recording. Fill it only if you decide to run an optional live suite, and remove it afterwards.
- `VITE_SWEEP_EXECUTOR=`, `VITE_MOBULA_PROXY_URL=`, `MOBULA_API_KEY=`: leave empty. The `#/receive` sweep panel defaults to the pinned Sepolia executor `0x94E4C39055fa4a5fCd47E03CbcbCD0503848806b`, and the Mobula panel works keyless against Mobula's demo endpoint.
- `GHOSTNAME_MAINNET_RPC_URL=`, `GHOSTNAME_SEPOLIA_RPC_URL=`, `GHOSTNAME_WEB_BASE_URL=`: leave empty. See step 10 for how the agent layer actually reads them.

Check that `git status` does not list `.env`. It is gitignored.

### Step 6: restore `.demo/identity.json`

```bash
mkdir -p .demo
chmod 700 .demo
# copy identity.json into .demo/ from the password manager or the decrypted archive
chmod 600 .demo/identity.json
ls -la .demo
```

Expected: `identity.json` with permissions `-rw-------` inside `drwx------`. The Node scripts (`loadDemoIdentity` in `scripts/lib/testnet-key.mjs`) exit with `Run: chmod 600 <path>` if the file is readable by others; the browser import path does not check permissions. On Windows the check always fails: Node reports mode 666 for every writable NTFS file, so `loadDemoIdentity` exits with `Run: chmod 600 .demo/identity.json` whatever you do, and `scripts/register-v2-name.mjs` and `scripts/relayer-sweep.mjs` cannot run there. The optional fresh sweep is macOS or Linux only; the live vitest suites read the file directly and are unaffected. None of this matters for recording.

Never open `identity.json` in an editor while recording or screen sharing.

### Step 7: browser and MetaMask

1. Install Chrome or Brave.
2. Create a new browser profile for the recording. Chrome: click the profile icon, then "Add". Brave: main menu, then "Create a new profile". [CHECK exact menu labels in your version.] Name it "GhostName demo". Use only this profile for every web cut. It has no history, no autofill, no extensions except MetaMask.
3. Hide the bookmarks bar (Command Shift B on macOS, Ctrl Shift B on Windows).
4. Install MetaMask from https://metamask.io, in this profile only. Import the presenter wallet with its secret recovery phrase, or create a new wallet. [CHECK the current MetaMask onboarding wording.]
5. Enable Sepolia. Open MetaMask's network selector, turn on the test networks toggle and select "Sepolia". [CHECK the exact toggle name in your MetaMask version.] The app's own pill must read "Sepolia" once connected; on the wrong network it reads "Mainnet: read-only in this build, writes blocked" (or "chain N, writes blocked") and offers "Switch to Sepolia".
6. Confirm the balance. Target at least 0.05 Sepolia ETH, the figure in `DEMO.md`. The Pay insert spends 0.001 ETH plus gas for two transactions; the Create insert, if you sign, needs gas for one more. If you are short, use a public Sepolia faucet. Well-known ones are run by large infrastructure providers (for example Google Cloud, Alchemy, Infura and Chainlink); most need a sign-in, some require a small mainnet balance, and amounts and daily limits vary and change. Do this the day before, not on recording day, and do not count on a specific amount.
7. Do not import `SEPOLIA_PRIVATE_KEY` into MetaMask. That account is the only wallet that can publish on `ghostname-3c7714.eth`, and the record is already published for the identity in `.demo/identity.json`. Publishing from any other wallet fails the pre-sign `setText` simulation on `#/create` by design. The video never republishes it.
8. Optional but recommended: connect MetaMask to the deployed app once now, off camera, so the site permission exists. Open https://0xskrillah.github.io/ghostname/#/pay, click "Resolve + derive", then "Connect wallet", approve in MetaMask, and confirm the "Sepolia" pill. Then click "Disconnect wallet" so the recording can show the connect step. "Disconnect wallet" remembers the choice in localStorage and revokes the site permission where the wallet supports it, so on camera MetaMask will prompt again.

### Step 8: import the receive identity on the deployed `#/create`, off camera

Do this with screen recording and screen sharing stopped.

1. In the "GhostName demo" profile open https://0xskrillah.github.io/ghostname/#/create.
2. If the page already shows "Publish to an ENS name", "Back up this identity" and "Discard this identity", an identity is stored and the import section is hidden. Scroll to "Discard this identity", click "Discard identity…", tick "I understand that funds at this identity's stealth addresses become unrecoverable without a backup.", then click "Discard identity". On a new laptop this will not happen; the page starts with "Generate keys locally".
3. Under the heading "Or import an existing identity", use the file input labelled "Identity backup file (preferred, never shown on screen)". Choose `.demo/identity.json`. File pickers on macOS hide dot-folders: press Command Shift . (full stop) inside the dialog to show them. On Windows `.demo` is an ordinary visible folder; if you cannot see it, type the full path into the file name box.
4. Or paste the file contents into "Or paste the identity backup JSON" (placeholder `{"spendingPrivateKey":"0x…","viewingPrivateKey":"0x…", …}`) and click "Import". The textarea is not masked.
5. Success looks like this: the page now shows the card labelled "ENS text record, key: stealth-meta-address[1]" with a value beginning `st:eth:0x`, followed by "Publish to an ENS name", "Back up this identity" and "Discard this identity". An error line beginning "Invalid identity backup:" means the file is corrupt or is the wrong file.
6. Confirm on https://0xskrillah.github.io/ghostname/#/receive: the field "Start block for the announcement scan" is pre-filled with `11612900`; click "Scan announcements". The "Scan result" card must read "... recognised as yours" with a number of at least 1, and "Live negative control" must show 0 "(expected: zero)".
7. Scope: the identity is stored under the key `ghostname.identity.v1` in this profile's localStorage for the origin https://0xskrillah.github.io. Another profile, another browser or http://localhost:5173 has none. Do not clear site data before recording.

### Step 9: the minimal path

Every web cut uses the deployed app at https://0xskrillah.github.io/ghostname/. It already carries the Sepolia pre-fills, the start block, the agent handoff cards and the "Disconnect wallet" button. The local clone is only needed for the agent cut (`dist-agent/`) and for the optional local dev server.

`npm run dev` (http://localhost:5173) is optional. It gives you the mainnet pre-fill from `.env` and a second origin with no stored identity, which is useful for Insert A. Its footer shows the local commit, with a `-dirty` suffix if the tree has uncommitted changes, and the CSP is deliberately not applied in dev. If you record on it, remember the identity must be imported separately on that origin.

### Step 10: Claude Code, the agent build and the MCP server

1. Install Claude Code. Native installer (recommended): macOS Terminal `curl -fsSL https://claude.ai/install.sh | bash`, or `brew install --cask claude-code` if Homebrew is present; Windows PowerShell `irm https://claude.ai/install.ps1 | iex`, or `winget install Anthropic.ClaudeCode`. The npm route `npm install -g @anthropic-ai/claude-code` also works and wants Node 22 or newer. Windows needs Git for Windows from step 1 (Claude Code uses its Git Bash for shell commands); close and reopen the terminal after installing. Verify: `claude --version` prints a version such as `2.1.211 (Claude Code)`; `claude doctor` prints a fuller diagnosis. These commands were checked against the Claude Code documentation (code.claude.com/docs/en/setup) on 2026-09-03.
2. Sign in. Claude Code needs a Pro, Max, Team, Enterprise or Console account. From the repository root run `claude`, follow the login prompt in the browser, then leave the session with `/exit`.
3. Register the server, from the repository root, after `npm run build:agent`:

```bash
claude mcp add ghostname -- node ./dist-agent/ghostname-mcp.mjs
```

The default scope is `local`: the entry is stored in `~/.claude.json` for this project directory only, so it exists only for `claude` sessions started from the repository root; always start `claude` there. Verify with `claude mcp list`, which prints each server with a health status (`✔ Connected` when the server starts), and inside a session with `/mcp`, which must show `ghostname` connected with five tools: `ghostname_audit_ens_privacy`, `ghostname_prepare_upgrade`, `ghostname_reaudit_ens_privacy`, `ghostname_verify_payment`, `ghostname_verify_sponsored_exit`. (Scope and command behaviour checked against code.claude.com/docs/en/mcp on 2026-09-03.)

4. RPC for the agent layer. The stdio server and the CLI read `process.env` only; they never load `.env`. On a normal connection the built-in public endpoints are fine. To pin your own, either export the variables in the shell that launches `claude` or the CLI (`export GHOSTNAME_SEPOLIA_RPC_URL=https://...` in bash), or register the server with environment values: `claude mcp remove ghostname` then `claude mcp add --env GHOSTNAME_MAINNET_RPC_URL=https://... --env GHOSTNAME_SEPOLIA_RPC_URL=https://... ghostname -- node ./dist-agent/ghostname-mcp.mjs`. `--env KEY=value` sets the server's environment; every Claude option comes before the server name, and everything after `--` is passed to the server untouched. `VITE_MAINNET_RPC_URL` and `VITE_SEPOLIA_RPC_URL` are honoured as aliases. Only http(s) URLs are accepted, and no tool accepts an RPC URL parameter.

5. Smoke command 1, with your established mainnet name in place of `name.eth`:

```bash
node dist-agent/ghostname.mjs audit name.eth --chain 1
```

Expected first line: `GhostName audit of name.eth (chain 1): INCOMPLETE`. The "Findings:" block must include `- STATIC_ADDRESS_EXPOSED [critical, observed]: ...` and `- STEALTH_RECORD_MISSING [critical, observed]: ...`, and "Recommended actions:" must lead with `- PUBLISH_STEALTH_RECORD (open, priority 1, human wallet action required): ...`.

6. Smoke command 2:

```bash
node dist-agent/ghostname.mjs audit ghostname-3c7714.eth --chain 11155111
```

Expected first line: `GhostName audit of ghostname-3c7714.eth (chain 11155111): PRIVATE-READY`. The findings include `DEFAULT_RECORD_SELECTED` with `key=stealth-meta-address[1]`, `LOCAL_DERIVATION_CONFIRMED`, `COMPATIBLE_SENDER_REQUIRED`, and `STATIC_ADDRESS_EXPOSED` downgraded to a warning. The last line of every audit is the sentence beginning "This is forward recipient-address privacy for compatible senders, not anonymity."

If either command prints `UNKNOWN` on the first line, the RPC was not reachable: the result is `RPC_UNAVAILABLE`, never a pass. Check the connection, VPN or proxy, retry, or pin an endpoint as in point 4. The CLI exits 0 on UNKNOWN unless `--strict` is passed, so read the line, not the exit code.

7. Server banner. `npm run mcp` starts the stdio server and prints one line on stderr: `ghostname-mcp 0.1.0: local read-only ENS privacy adviser on stdio. No keys, no writes, no analytics. Configure RPC with GHOSTNAME_MAINNET_RPC_URL and GHOSTNAME_SEPOLIA_RPC_URL.` It then waits for MCP input on stdin. Press Ctrl C to stop it. Seeing that line proves the bundle runs and its dependencies resolve.

8. Optional: `npm run mcp:inspect` runs `npx @modelcontextprotocol/inspector` on the server. The Inspector is downloaded on first use, so do it on a good connection. It lists five tools, six resources (the five `ghostname://` documents plus the `ui://ghostname/audit` view) and one prompt (the repository docs say five resources because they count only the `ghostname://` documents).

9. Rehearse the agent prompts once, off camera, in a `claude` session started from the repository root: "Audit name.eth and help me improve its privacy." (with the real name), "Audit ghostname-3c7714.eth on Sepolia.", and the two verify prompts from section 4. Note how many checks the sponsored-exit verifier reports on the live output (`Sponsored exit: all N checks passed ...`; nine, see the note on counts in section 4); the payment verifier reports eight. The repository skill in `.claude/skills/ens-privacy-advisor/` loads automatically when Claude Code runs from the repository. Claude Code asks permission before the first call of each `ghostname_*` tool. Approve each one during this rehearsal and choose the option that remembers the choice for this project, so no prompt appears on camera; run all four prompts so every tool has been seen once, or open `/permissions` and allow `mcp__ghostname` (every tool of the `ghostname` server). Claude Code stores that in `.claude/settings.local.json`. The repository's `.gitignore` does not list it, so `git status` shows it as untracked: leave it uncommitted (it holds only permission rules, no secret), expect the Section 3 `git status` line to show that one file, and expect the `npm run dev` footer to read `-dirty`, which is cosmetic; the deployed app is unaffected.

10. Terminal for the recording: font 18 to 20 points, dark theme, one window sized to fill 1920 by 1080, no split panes.

### Step 11: screen recording

1. Display: set the recording display to 1920 by 1080. macOS: System Settings, Displays, choose the 1920 by 1080 scaled option, or record the full retina screen and export at 1080p later. Windows: Settings, System, Display, resolution 1920 × 1080 at 100 percent scaling. [CHECK your panel's supported modes.] An external 1080p monitor is the simplest option on both.
2. macOS: press Shift Command 5. Choose "Record Entire Screen" or "Record Selected Portion". Under "Options" choose the microphone and the save location. Click "Record"; stop from the menu bar icon. QuickTime Player, File, New Screen Recording is the same tool. Recordings are `.mov`; the editor converts them.
3. Windows: press Windows G to open the Xbox Game Bar, then Record in the Capture widget (or Windows Alt R). Game Bar records one application window, not the desktop or File Explorer, so keep the whole web demo in one browser window and the agent cut in one terminal window, and record them as separate clips. Recordings land in Videos, Captures as `.mp4`.
4. OBS Studio on either system: Settings, Video: base and output resolution 1920 × 1080, 30 FPS. Settings, Output, Recording: MP4 container (or MKV, then File, Remux Recordings), H.264 encoder (x264 or the hardware encoder). Add a Display Capture (or Window Capture) source and an audio input capture for the microphone. Record a 10 second test and play it back.
5. Browser: zoom to 150 percent (Chrome steps are 110, 125, 150, so press Command plus or Ctrl plus three times from 100). Close DevTools (Command Option I on macOS, F12 on Windows toggles it). One window. Only the tabs you need. No extension badges except MetaMask.
6. Notifications off: macOS Focus, Do Not Disturb; Windows Settings, System, Notifications, Do not disturb. Quit mail, chat and calendar apps. Silence the phone.
7. Microphone: the built-in one is fine in a quiet room. Record ten seconds, listen back, adjust distance.
8. Cursor: move slowly. Hover, pause, click. Do not scroll while talking a key sentence.

## 3. Pre-flight checklist

Run this on the recording laptop, in the order the cuts will be recorded, within an hour of recording. Every line has an expected result. If one fails, go to section 6.

Environment

- [ ] `node -v` prints v20 or newer; `git --version` prints a version.
- [ ] `git status` in the clone is clean, or lists only the untracked `.claude/settings.local.json` from section 2 step 10; `.env` and `.demo/` are not listed.
- [ ] `npm test` ends with 316 passed, 11 skipped, with `VITE_DEMO_MAINNET_NAME` empty in `.env`; if you set it for `npm run dev`, blank it before building, and delete `dist/` if a build already failed.
- [ ] `ls dist-agent` shows `ghostname-mcp.mjs`, `ghostname-mcp-http.mjs`, `ghostname.mjs`, `ui/`.
- [ ] Notifications are off; the phone is silent; the display is 1920 by 1080; the recorder is tested.

Landing page https://0xskrillah.github.io/ghostname/

- [ ] Headline reads "Keep the ENS name. Break the payment graph." with the second sentence in green.
- [ ] Under it, the comparison graphic shows "Before: static" and "After: GhostName".
- [ ] Buttons "Audit a name", "Create a private identity" and the link "Or watch the two-minute demo" are visible.
- [ ] Footer ends with "Writes go to Sepolia testnet. Build 74772682c5d4." [Re-check on recording day; at review time `main` was `6bd0375` and gh-pages `35b6e80` built from `74772682c5d4`.]
- [ ] Browser zoom is 150 percent; the nav "Scan", "Create", "Pay", "Receive", "Privacy", "Demo" fits on one line.

`#/scan`

- [ ] Heading "Audit an ENS identity"; field "ENS name to audit" is empty (deployed build); "Network" select shows "Ethereum mainnet".
- [ ] Type your established mainnet name, click "Run privacy audit". Within about ten seconds the card "Conventional resolution on Ethereum mainnet (static identity)" shows the name and a red address.
- [ ] The status pill under "GhostCheck: privacy readiness" reads "Incomplete".
- [ ] The danger card "This mapping is public and permanent." is visible.
- [ ] The card "Public exposure (via Mobula)" is present. Click "Assemble public profile (queries Mobula)". Within ten seconds it shows a number captioned "token holdings visible", a chain count, and "•••••" captioned "total value" with a "reveal" button. Do not click "reveal". If it shows an error with "Retry", note it; the audit card still makes the point.
- [ ] Reload the page so the recording starts clean.

`#/demo`

- [ ] Heading "GhostName in two minutes". The hint reads "Pre-filled from your local configuration: the GhostName-enabled Sepolia name. Type the other." (deployed build; a local build with `VITE_DEMO_MAINNET_NAME` set reads "Both names are pre-filled from your local configuration." and step 1's field is not empty).
- [ ] Step 1: type your established mainnet name into "Established mainnet name", click "Audit on mainnet (read-only)". Result: the name, an arrow, a red address, the pill "Incomplete".
- [ ] Step 2: "GhostName-enabled Sepolia name" is pre-filled with `ghostname-3c7714.eth`. Click "Check conformance". Result: pill "Private-ready", a resolver address, "selected record" `stealth-meta-address[1]`.
- [ ] Step 3: click "Derive A, B and C". Result: three green addresses and "Pass: A, B and C are all different. Same name, a new one-time address every time." The comparison graphic appears under the steps.
- [ ] Step 4: click "Run recognition test". Result: "intended viewing key:" pill "recognised"; "unrelated viewing key:" pill "finds nothing".
- [ ] Step 4: click "Verify the payment and announcement". Result: pill "pass: all checks passed", eight rows including "Announcement names the address the payment funded", and the danger card "Not proven by this evidence".
- [ ] Step 5: click "Verify the sponsored exit". Result: pill "pass: all checks passed", nine rows including "Transaction is EIP-7702 (type 4)" and "Gas paid by a sponsor, not the stealth address", the "Not proven by this evidence" card. If the row "Swept account still carries the executor delegation (present state)" is `unknown`, the Complete card will not appear. If any row shows `unknown`, read the Section 6 entry before recording.
- [ ] The green card "Complete: all five steps ran live and passed" appears. It appears only after the sponsored exit verifies; the payment proof is not part of the condition, but click it anyway.
- [ ] Below: "The boundary, stated plainly" with "Protected" and "Not protected". Reload the page so the recording starts clean.

`#/receive`

- [ ] Heading "Discover your payments"; the lead does not say "No local identity found." (if it does, redo section 2 step 8).
- [ ] "Start block for the announcement scan" reads `11612900`.
- [ ] Click "Scan announcements". Within about thirty seconds the "Scan result" card reads "Blocks ... to ...: N scheme-1 announcements on the network, K recognised as yours." with K at least 1.
- [ ] "Live negative control" shows 0 "(expected: zero)".
- [ ] Each recognised card is labelled "Payment recognised" (balance above zero) or "Announcement recognised, no funds at this address" (already swept). A third label, "Announcement recognised" with "Balance now: unknown (balance read failed)", means the RPC balance read failed; rescan. Note which you have. "Balance now:" shows an ETH figure. "Spending-key check:" shows "pass: derived stealth key controls this address".
- [ ] On a card with a balance above zero: click "Sweep privately via a sponsor (EIP-7702)", enter a clean destination address under "Destination address, bound into the signature", click "Build sweep package". Result: "pass: complete and destination-bound". If every card is at zero balance, the amount field is empty and "Build sweep package" refuses with "Enter an amount in ETH." (typing `0` gives "Amount must be greater than zero.", any positive amount gives "Amount exceeds the current balance of 0 ETH; the executor would revert."; the destination is checked first, so with an empty destination the error is "Enter a valid destination address. It is bound into the signature."); plan to open the panel and stop before building, or send the Pay insert first.
- [ ] Below the cards: "Published evidence, verified live" with the two proof panels. Reload the page.

`#/privacy`

- [ ] Heading "What GhostName protects, and what it cannot"; sections "Past: cannot be erased", "Present: current exposure can be reduced", "Future: what GhostName adds", "Protected", "Not protected" all render.

`#/create` (extended cut only, on the second origin or profile with no identity)

- [ ] The first control is "Generate keys locally"; "Or import an existing identity" and "Or restore from an encrypted capsule" are visible.
- [ ] MetaMask is installed in this profile and on Sepolia.

`#/pay` (extended cut only)

- [ ] "ENS name to pay" is pre-filled with `ghostname-3c7714.eth`; the button reads "Resolve + derive".
- [ ] MetaMask is on Sepolia with the balance you expect; "Connect wallet" appears after the first derivation.

Agent server (agent cut only)

- [ ] `npm run mcp` prints the `ghostname-mcp 0.1.0: local read-only ENS privacy adviser on stdio. ...` banner; stop it with Ctrl C.
- [ ] Smoke command 1 prints `... (chain 1): INCOMPLETE`; smoke command 2 prints `... (chain 11155111): PRIVATE-READY`.
- [ ] `claude` started from the repository root; `/mcp` lists `ghostname` with five tools.
- [ ] The terminal font is 18 to 20 points and the window fills the screen.
- [ ] The deployed `#/create` is open in a tab so the handoff link can be opened in the recording profile.

Recorder

- [ ] A ten second test recording has picture and sound.
- [ ] Free disk space is at least 5 GB.

## 4. The script

Format: [time] then ON SCREEN then SAY. Button labels are quoted exactly. Speak at a natural pace; the narration below runs to time when read at about 150 words per minute.

Narration rules, once more: say "forward privacy, not anonymity"; never say the forbidden words; never say the mainnet name in a way that the repository would need to carry (spoken is fine, typed on camera is fine, written into a committed file is not); never click "reveal" on the Mobula value; never paste a key on camera.

### The two-minute submission cut

This cut is the submission video and the backup for the live demo. It needs no wallet. Record it in one take if you can; pauses are cut in editing.

**[0:00 to 0:10] Open**

ON SCREEN: the landing page https://0xskrillah.github.io/ghostname/. The headline "Keep the ENS name. Break the payment graph." and the "Before: static" and "After: GhostName" graphic under it.

SAY: "An ENS name on one static address is a public record of every payment it receives. GhostName audits the name you own, upgrades it in place, and proves it."

**[0:10 to 0:30] The problem, live on Scan**

ON SCREEN: click "Scan" in the nav. Type your established mainnet name into "ENS name to audit". Leave "Network" on "Ethereum mainnet". Click "Run privacy audit". When the result lands, point at the red address in "Conventional resolution on Ethereum mainnet (static identity)", the pill "Incomplete", and the line "This mapping is public and permanent." Scroll to "Public exposure (via Mobula)" and click "Assemble public profile (queries Mobula)". Point at "token holdings visible" and the chain count. Leave "•••••" hidden; do not click "reveal".

SAY: "This is a real name on mainnet. It resolves to one static address, and the audit says what that means: no stealth record, so every future payment stays linkable. Mobula shows what a stranger can assemble from that one link. I am not revealing the number on camera."

**[0:30 to 0:38] Why now**

ON SCREEN: stay on the audit card. Optionally hover the words "Past activity cannot be deleted."

SAY: "I cannot delete any of this. Blockchains have no delete button. So the only thing left to control is the next payment."

**[0:38 to 1:00] The answer, live on Demo**

ON SCREEN: click "Demo" in the nav. Step 1: type the same established mainnet name into "Established mainnet name" and click "Audit on mainnet (read-only)". Three seconds. Step 2: "GhostName-enabled Sepolia name" is pre-filled with `ghostname-3c7714.eth`; click "Check conformance". Point at "Private-ready" and at "selected record" `stealth-meta-address[1]`. Step 3: click "Derive A, B and C". Point at A, B and C, at "Pass: A, B and C are all different. Same name, a new one-time address every time.", and at the "Before: static" and "After: GhostName" graphic that appears under the steps.

SAY: "Same identity, GhostName enabled. The record sits on the name itself: no service-owned subdomain, no new wallet. My browser derives a fresh destination, A, then B, then C, from that one record, locally, with no gateway. None match. Same name, a new one-time address every time. That is the payment graph breaking."

**[1:00 to 1:22] Prove receive and prove exit, live on Demo**

ON SCREEN: step 4: click "Run recognition test". Point at "intended viewing key:" "recognised" and "unrelated viewing key:" "finds nothing". Click "Verify the payment and announcement". Point at the "pass" rows, especially "Announcement names the address the payment funded". Step 5: click "Verify the sponsored exit". Point at "Transaction is EIP-7702 (type 4)", "Gas paid by a sponsor, not the stealth address", the card "Not proven by this evidence", and the green card "Complete: all five steps ran live and passed".

SAY: "The intended viewing key recognises the payment. An unrelated key finds nothing: recognition needs the private key. Then the app re-verifies the Sepolia payment, its ERC-5564 announcement, and the sponsored exit from chain data: an EIP-7702 transaction a sponsor paid for, so my known wallet never funded the stealth address. It lists what the evidence does not prove."

**[1:22 to 1:40] The recipient view, live on Receive**

ON SCREEN: click "Receive" in the nav. "Start block for the announcement scan" reads `11612900`. Click "Scan announcements". Point at "recognised as yours" in "Scan result", at "Live negative control" showing 0, and on a recognised card at "Balance now:" and "Spending-key check:" "pass: derived stealth key controls this address". If a card has a balance above zero, click "Sweep privately via a sponsor (EIP-7702)", enter a clean destination under "Destination address, bound into the signature", click "Build sweep package", and point at "pass: complete and destination-bound". If every card reads "Announcement recognised, no funds at this address", open the panel, point at the destination and amount fields, and do not click build; with an empty amount the panel refuses with "Enter an amount in ETH."

SAY (cards with a balance): "Now as the recipient. My private viewing key scans real announcements and recognises my payments; the balance is read from chain. I derive the key that controls each address and sign a destination-bound sweep package a sponsor can execute. The stealth key never leaves the device."

SAY (cards already swept; let this slot run to 1:42): "Now as the recipient. My private viewing key scans real announcements and recognises my payments. This one is empty: the sponsored exit you just saw moved it out. This panel derives the controlling key and signs a destination-bound sweep package a sponsor can execute. The stealth key never leaves the device."

**[1:40 to 1:52] Honest scope, live on Privacy**

ON SCREEN: click "Privacy" in the nav. Show "Past: cannot be erased", then scroll to "Protected" and "Not protected".

SAY: "Forward privacy for future receiving addresses, from compatible senders, against ordinary observers. It does not delete history or hide amounts or senders. Not anonymity. Mainnet is read-only in this build."

**[1:52 to 2:00] Close**

ON SCREEN: click the "ghostname" brand to return to the landing page. Rest on the headline.

SAY: "Everything ran live: the audit read mainnet, every write went to Sepolia. Keep the name. Break the payment graph."

### The 45-second agent cut

Record this as a separate take. Splice it in after "The recipient view", or publish it as its own clip. Every call is live and read-only. The agent never receives a key. Type your established mainnet name wherever this says `name.eth`. Start `claude` from the repository root so the `ghostname` server and the skill load.

**[0:00 to 0:15] Ask the agent**

ON SCREEN: Claude Code, full screen, with the `ghostname` server connected. Type "Audit name.eth and help me improve its privacy." Let the `ghostname_audit_ens_privacy` call and its result appear. Point at the call input: only `name` and `chainId` go in. Point at `INCOMPLETE`, `STATIC_ADDRESS_EXPOSED`, `STEALTH_RECORD_MISSING` and `RESOLVER_PROVENANCE_UNKNOWN`.

SAY: "The same audit, run by an AI agent through a GhostName server on my laptop. It names the leak with stable codes: static address exposed, stealth record missing. What it cannot establish it marks unknown."

**[0:15 to 0:30] The safe handoff**

ON SCREEN: the `ghostname_prepare_upgrade` result and its link of the form `https://0xskrillah.github.io/ghostname/#/create?name=name.eth&chainId=1&source=agent&reportId=gcr1_...&version=1`. Open it in the recording browser profile. Point at the card "Agent handoff", the sentence "Key generation happens here, in this browser, outside the agent.", and the card "Live check of name.eth on Ethereum mainnet" with the pill read live. Optionally append `&status=private-ready` to the URL and reload to show "Ignored link parameters: status." Do not generate keys and do not publish for the mainnet name.

SAY: "It hands me a link. Keys are generated in my browser, the name is resolved again live, and only my wallet can sign, on Sepolia in this build. The agent got a status, codes and a URL, never a key."

**[0:30 to 0:45] Prove and close**

ON SCREEN: back in Claude Code, type "Audit ghostname-3c7714.eth on Sepolia." Show `PRIVATE-READY`. Then type "Verify the sponsored exit 0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25 on Sepolia." Show `VERIFIED`, the line `Sponsored exit: all N checks passed from public chain data. The not-proven list still applies.`, and the "Not proven:" bullets.

SAY: "The upgraded name comes back private-ready for compatible senders, and the real sponsored exit verifies from chain data, with the not-proven list attached. Evidence for agents, control for humans. Keep the ENS name. Break the payment graph."

Note on counts: the narration quotes no number. The payment verifier reports eight checks. The sponsored-exit verifier reports nine in the web app, the CLI and the MCP server, because all three read code at the swept account; the ninth is a present-state check that shows `unknown` (and blocks both VERIFIED and the Complete card) if the stealth account has been re-delegated or cleared since the sweep. Confirm it passes during the pre-flight; `AGENT_DEMO.md` and `04_DEMO_AND_SUBMISSION.md` still say 8 of 8. Read the number from the live line if you want to quote one.

### The three-minute extended cut

The two-minute cut with two inserts after "The answer" at 1:00, then the rest of the cut. Total about 3:00. The inserts need MetaMask on Sepolia with test ETH. Record them as separate takes so a wallet delay does not spoil the main take.

**Insert A [adds about 30 seconds]: Create**

Use an origin with no stored identity so a new one is generated, and where MetaMask is available: either http://localhost:5173/#/create from `npm run dev` in the same "GhostName demo" profile (localStorage is per origin, so the deployed identity is untouched and MetaMask is still installed), or the deployed `#/create` in a second browser profile that also has MetaMask. Do not discard the identity on the deployed origin; the Receive segment needs it.

ON SCREEN: `#/create`. Click "Generate keys locally". Point at the card "ENS text record, key: stealth-meta-address[1]" and its `st:eth:0x` value. Scroll to "Publish to an ENS name". Click "Connect wallet", approve in MetaMask, point at the "Sepolia" pill. Then choose one of two paths.

Path 1, you control a Sepolia test name with a resolver set: type it into "ENS name you control", click "Check name on Sepolia", point at the card "You will sign one transaction on Sepolia" and the pill "this wallet can write the record", click "Publish record on Sepolia", confirm in MetaMask, and wait for "Record published. Transaction". Optionally click "Verify record resolves".

Path 2, you do not: type `ghostname-3c7714.eth` into "ENS name you control", click "Check name on Sepolia", and point at two guards. The danger card "ghostname-3c7714.eth already has a different stealth record." with its checkbox "I understand this replaces the existing record.", and the danger card "This wallet cannot write to the resolver of ghostname-3c7714.eth." Do not tick the box; nothing is sent. This is the pre-sign simulation stopping a wallet that does not control the name.

If the RPC read fails instead, the page shows the amber line "Could not confirm that this wallet can write the record" in place of the danger card; the publish button stays disabled because the "I understand this replaces the existing record." box is unticked. Click "Check again" once; if it stays amber, point at the unticked box and say the page refuses to assume permission.

Then click "Show keys and backup options", scroll to the card "Encrypted recovery capsule (Swarm-ready, testnet only)", type a passphrase of at least 12 characters into "Capsule passphrase", and click "Download encrypted capsule". Point at "Encrypted capsule downloaded. Safe to store on Swarm (testnet only)."

SAY: "Setting this up is one record. The browser generates the spending and viewing keys locally, shows the exact value to publish, and simulates the write before asking for a signature, so a wallet that cannot write to the resolver is stopped before it signs. The backup is an encrypted capsule, AES-256-GCM under a passphrase-derived key, with no plaintext keys inside, so it is safe to store on Swarm, testnet only. Nothing here has a backend."

**Insert B [adds about 30 seconds]: Pay**

ON SCREEN: the deployed `#/pay` in the "GhostName demo" profile. "ENS name to pay" reads `ghostname-3c7714.eth`. Click "Resolve + derive", then "Derive again". Point at the card "Derived one-time destinations for ghostname-3c7714.eth on Sepolia (this session)" with two different addresses and the pill "latest". Click "Connect wallet", approve in MetaMask, point at the "Sepolia" pill. "Amount in ETH" reads `0.001`. Point at the card "You will sign two transactions on Sepolia": row "1. transfer to" and row "2. announcement to". Click "Send + announce". Confirm the transfer in MetaMask, then the announcement. Wait for the card "Payment complete on Sepolia" with its "payment:" and "announcement:" links.

SAY: "A sender pays the name, not a 66-byte key. Each derivation gives a new destination. Before anything is signed, the app shows both transactions: the transfer to the stealth address and the ERC-5564 announcement that lets the recipient find it. A plan can only be paid on the chain its record was resolved on."

Then continue with "The recipient view" from the two-minute cut. The payment you just sent is recognised there as "Payment recognised" with "Balance now: 0.001 ETH", and its card is the one to build the sweep package on. New blocks take about 15 seconds; if the scan does not show it, wait and click "Scan announcements" again.

If the page shows the card "Transfer sent, announcement missing. Do not close this page.", click "Retry announcement" and confirm in MetaMask. Do not navigate away until "Payment complete on Sepolia" appears.

## 5. Assemble and submit

### Editing order

1. Import the raw takes into any editor (iMovie or DaVinci Resolve on macOS, Clipchamp or DaVinci Resolve on Windows; both free).
2. Two-minute cut: one timeline in the on-screen order of section 4: landing, Scan, Demo, Receive, Privacy, landing. Cut loading pauses longer than two seconds; keep at least one second of each result on screen after the narration mentions it. No music is required; if you add any, keep it well under the voice.
3. Agent cut: its own 45-second timeline. Export it separately, and also, if the form allows a longer video, splice it into the extended cut after "The recipient view".
4. Extended cut: the two-minute timeline with Insert A and Insert B placed after "The answer" (at about 1:00), then the rest.
5. Add one title card at the start (two seconds: "GhostName. Keep the ENS name. Break the payment graph.") and one at the end with the repository and app URLs from section 7. Nothing else on screen.
6. Watch every cut once at full size before exporting. Check that no key, seed phrase, passphrase or Mobula value is visible in any frame, including MetaMask popups and the terminal.

### Export settings

- Resolution 1920 by 1080, 30 frames per second, progressive.
- Video codec H.264, high profile; bitrate 8 to 12 Mbps for a screen recording; MP4 container.
- Audio AAC, 48 kHz, stereo or mono, about 160 kbps; normalise the voice to around minus 16 LUFS or simply make sure it is clearly audible without clipping.
- Lengths: the two-minute cut at 1:55 to 2:00, the agent cut at or under 0:45, the extended cut at or under 3:00. [CHECK the submission form's maximum video length; if it states one, keep every cut at least five seconds under it. If it accepts a single video, submit the two-minute cut and link the others.]
- File names: `ghostname-submission-2min.mp4`, `ghostname-agent-45s.mp4`, `ghostname-extended-3min.mp4`.

### Where the videos go

- [CHECK the Common S3nse submission form for the accepted video field. Most forms take a link.] Upload each cut as an unlisted video on a mainstream video host and copy the links.
- Keep a second copy of each MP4 on a cloud drive with link sharing on, and a third copy on the laptop and a USB stick. `04_DEMO_AND_SUBMISSION.md` requires the two-minute backup video to exist offline and online, plus the 45-second agent cut.
- Do not commit videos to the repository.

### What to paste from `SUBMISSION.md`

`SUBMISSION.md` is the paste-ready description. It names no personal ENS identity. Paste, in this order, wherever the form has a matching field:

- Title: "GhostName: Keep the ENS name. Break the payment graph."
- Long description: the whole body from the bold opening paragraph ("GhostName is the open privacy-assurance layer for ENS. ...") through "Keep the ENS name. Break the payment graph.", including the sections "Audit, upgrade, prove", "How GhostName works", "Why ENS is essential", "No address-generation gateway", "Privacy must survive the first spend", "A real, non-hard-coded demonstration", "GhostName for AI agents: evidence for the agent, control for the human", "Public exposure analysis with Mobula", "Encrypted recovery with Swarm", "What GhostName protects", "What GhostName does not protect", "Technical implementation" and "Why GhostName is different".
- Short description: the "Short form (under 100 words)" paragraph.
- Links: the "Links" list (live app, repository, guided demo route, threat model, agent setup, agent demo sequence, the sponsored sweep transaction), plus the video links.
- If the form asks which tracks or bounties: ENS is essential to the mechanism; Mobula and Swarm are mentioned only as they actually work (the exposure panel and the encrypted capsule plus the deployment script). [CHECK the track and bounty names on the form. The repository does not record them; the ENS bounty brief is linked from `02_GHOSTNAME_MASTER_SPEC.md` section 3.]

### Final checklist, mapped to `04_DEMO_AND_SUBMISSION.md`

"Before recording or presenting":

- [ ] Fresh clean install succeeds: section 2 step 4, `npm ci`.
- [ ] Typecheck passes: `npm run typecheck`.
- [ ] Tests pass: `npm test`, 316 passed, 11 skipped.
- [ ] Production build passes: `npm run build`, bundle guard clean, with `VITE_DEMO_MAINNET_NAME` empty in `.env`; if you set it for `npm run dev`, blank it before building, and delete `dist/` if a build already failed.
- [ ] `npm run build:agent` passes: `dist-agent/` listed.
- [ ] Claude Code lists the five `ghostname_*` tools: `/mcp`.
- [ ] CLI reads INCOMPLETE for your established name on chain 1 and PRIVATE-READY for `ghostname-3c7714.eth` on chain 11155111: section 2 step 10.
- [ ] Deployed URL loads on the recording connection, and on a phone hotspot for the live presentation.
- [ ] Backup RPC works; the agent layer uses the same values: either exported in the shell or passed to `claude mcp add`, because the agent layer does not read `.env`.
- [ ] Wallet is on Sepolia (extended cut only).
- [ ] Test wallet has enough Sepolia ETH (extended cut only; target 0.05).
- [ ] Test ENS record resolves: `#/demo` step 2 reads "Private-ready".
- [ ] Scanner start block is correct: `11612900`.
- [ ] No sensitive balance is shown by default: the Mobula value stays behind "reveal".
- [ ] Browser console contains no private key material: it stays closed; the app never logs keys.
- [ ] Agent transcript contains no private key material: the tools have none to leak.
- [ ] Screen zoom is readable from a projector: 150 percent.
- [ ] Two-minute backup video exists offline and online, plus the 45-second agent cut.

"Repository/submission":

- [x] Public accessible repository: https://github.com/0xSkrillah/ghostname.
- [x] Project description: `SUBMISSION.md`.
- [ ] Working application: https://0xskrillah.github.io/ghostname/ checked in section 3.
- [ ] Working video: the exported cuts, watched once at full size.
- [ ] In-person presenter: you.
- [ ] README leads with problem, threat model and privacy mechanism: `README.md` sections 1 to 3.
- [ ] README has the AI agents section; `AGENTS.md`, `llms.txt`, `AGENT_DEMO.md`, `AGENT_DISCOVERY.md` and `server.json` are present: all in the repository root.
- [ ] ENS has a meaningful function beyond display: the `stealth-meta-address[1]` record is the discovery layer.
- [ ] Actual privacy mechanism is explained: README section 3 and `SUBMISSION.md` "How GhostName works".
- [ ] Information protected, adversary and mechanism are explicit: `PRIVACY.md` and `#/privacy`.
- [ ] No hard-coded cryptographic demonstration: every result in the video is derived live.
- [ ] Contracts, networks, test names and reproduction steps documented: README sections 7 and 9.
- [ ] Known limitations documented: README section 12.
- [ ] Mobula and Swarm mentioned only if actually working.
- [ ] Agent capability described as read-only; never as an autonomous wallet.

Submit before Saturday 5 September 2026, 09:00 Amsterdam time. After the backup video is recorded, accept only fixes for failed acceptance tests or presentation-breaking bugs.

## 6. If something goes wrong

Setup failures

- `npm ci` fails with a network or proxy error: retry on a different network (phone hotspot). Do not switch to `npm install`; the lockfile is the verified state.
- `npm ci` complains about the Node version: `node -v` must be 20 or newer; reinstall the LTS and reopen the terminal.
- `npm test` reports a failure: run it once more. If the same test fails, note the file name; the deterministic suite needs no network, so a failure means the checkout or the Node version differs from the verified state. Do not edit tests before recording; record against the deployed app, which is already verified, and fix later.
- `npm run build` says `check-bundle: refusing this build:` with a credential-like line: a keyed RPC URL is in `.env`. Replace it with a keyless URL. The deployed app is unaffected.
- `npm run build` says `check-bundle: refusing this build:` with a `non-allowlisted ENS name` line: `VITE_DEMO_MAINNET_NAME` is set. Blank it, `rm -rf dist`, build again. `npm test` failing in `tests/no-personal-name.test.ts` straight after such a build has the same cause and the same fix.
- `npm run build:agent` succeeds but `node dist-agent/ghostname.mjs` errors on a missing module: run `npm ci` again in the same clone; the bundles resolve dependencies from `node_modules`.
- The identity import on `#/create` shows "Invalid identity backup: ...": the file is not the identity or was altered in transfer. Check the copy in the password manager, or use the plaintext backup or the capsule ("Restore capsule" with the passphrase) instead.
- The import section is missing on `#/create`: an identity is already stored. Use "Discard this identity" first (section 2, step 8).
- `.demo/identity.json` is lost with no backup: `#/receive` cannot recognise the prior payments. Record the two-minute cut without the Receive segment; hold on `#/demo` step 4 and step 5 for ten more seconds, and say: "Recognition needs the private viewing key, and the recipient scanner on the Receive page runs that same code over the live announcement log." The recipient proof in `#/demo` step 4 and the payment and exit proofs still run. Last resort only, decided before recording day: this overrides section 2 step 7 point 7. Off camera, in a separate throwaway browser profile (never the "GhostName demo" profile), import the `SEPOLIA_PRIVATE_KEY` account into MetaMask, open `#/create`, click "Generate keys locally", click "Show keys and backup options" and "Download backup (plaintext JSON)" first, then publish the new record to `ghostname-3c7714.eth` from that account (this rotates the identity and replaces the record; anything still sitting at the old identity's stealth addresses becomes unrecoverable). Remove the imported account from MetaMask and delete that profile, store the new backup in the password manager, and import it on the recording profile as in section 2 step 8. Then send a payment from `#/pay` and scan on `#/receive`.
- MetaMask is not detected: the page says "No browser wallet detected. Install MetaMask or a similar wallet, switch it to Sepolia, then reload this page." Install it in the recording profile and reload. The two-minute cut and agent cut do not need it.
- MetaMask is on the wrong network: the pill reads "Mainnet: read-only in this build, writes blocked" or "chain N, writes blocked". Click "Switch to Sepolia" and approve in MetaMask. On `#/pay`, "Network changed to Sepolia. Derive again before paying." means click "Derive again".
- Not enough Sepolia ETH: skip the inserts. The Receive scan already recognises real prior payments, so the discovery proof still lands.
- The faucet gives nothing: same as above. Do not buy or bridge anything for a testnet video.

Recording failures

- Mainnet read is slow or fails on `#/scan`: the app falls back through publicnode, drpc and 1rpc automatically. Wait ten seconds, then click "Run privacy audit" again. If the error persists, the message names `VITE_MAINNET_RPC_URL`; that only helps a local build, so switch networks (hotspot) instead.
- The audit says "Nothing found for this name on this network.": the name is on the other network. Use the "Network" select or the "Try on Sepolia testnet" button. For your established name, "Ethereum mainnet" is correct.
- Mobula rate-limits the keyless endpoint: the panel shows the error with "Retry". Click it once; if it fails again, move on, the audit card already makes the point, and drop the Mobula sentence from the narration.
- `#/demo` shows no completion card and every row is green: one step was skipped. The card needs all five in order and the sponsored exit verified. Click "Verify the sponsored exit" in step 5.
- `#/demo` step 5 shows "not fully verified: see rows" with an amber `unknown` row: no step was skipped. Either the public RPC did not return the authorization list of the type-4 transaction, or the swept account's present state changed (re-delegated, or funded again). The completion card needs every row green. Click "Re-verify" once; if the same row stays `unknown`, switch to the hotspot and reload, or pin `VITE_SEPOLIA_RPC_URL` in a local build. On camera, say "this row is unknown, not failed; the app refuses to guess" and continue; the narration and the Receive proof panels still hold.
- `#/demo` step 3 says "Run step 2 first so there is a published record to derive from.": click "Check conformance" first.
- `#/receive` scan errors with "Could not complete the Sepolia scan: ...": retry. If it persists, raise the start block closer to the present to shorten the range, or switch to the hotspot.
- "Scan range of N blocks is too large; the limit is 250000. Set a start block just before your payments." under the start-block field: more than 250,000 blocks (about five weeks) have passed since block 11612900. Type a start block within 250,000 of the current Sepolia block and just before the payment you want to show; the pinned `11612900` pre-fill stops working around early October 2026.
- `#/receive` recognises 0: the identity is not the one whose record is on `ghostname-3c7714.eth`, or the start block is after the payments. Confirm `11612900` and re-import the right file.
- "Build sweep package" says "Enter an amount in ETH.", "Amount must be greater than zero." or "Amount exceeds the current balance ...": the card is already swept (the amount field is empty on a zero-balance card, so the build stops at "Enter an amount in ETH."; typing `0` gives "Amount must be greater than zero." and any positive amount gives "Amount exceeds the current balance of 0 ETH; the executor would revert."). Use a card with a balance, send the Pay insert first, or open the panel without building.
- `#/pay` stops at "Transfer sent, announcement missing. Do not close this page.": click "Retry announcement" and confirm in MetaMask. If you must leave, click "Copy recovery data" first.
- The Game Bar will not record the desktop: it records one window. Keep everything in one browser window per clip, or use OBS with a Display Capture source.
- The recording has no sound: check the microphone permission for the recorder (macOS System Settings, Privacy and Security, Microphone; Windows Settings, Privacy, Microphone), then record the ten-second test again.

Agent cut failures

- Claude Code is not ready, will not sign in, or `/mcp` does not list `ghostname`: record the agent cut with the CLI in the same terminal. The commands print the same reports:

```bash
node dist-agent/ghostname.mjs audit name.eth --chain 1
node dist-agent/ghostname.mjs plan name.eth --chain 1
node dist-agent/ghostname.mjs audit ghostname-3c7714.eth --chain 11155111
node dist-agent/ghostname.mjs verify-payment 0x2430f7f8a422a6a527272cd591541c101e9fffd43dccb2a1feed918ee0dc248b 0x4164c074fbb0adacf3d3804928e2a4cc803d61e783e9fbbef207608fe3010c11 --chain 11155111
node dist-agent/ghostname.mjs verify-exit 0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25 --chain 11155111
```

The `plan` output contains a line `Secure handoff: <url>` near the end (followed by `This tool did not: ...`, `Plan id: ...` and, as the last line, the same sentence that closes every audit, beginning "This is forward recipient-address privacy for compatible senders"); open that URL in the browser for the handoff segment. Exit codes: 0 success, 1 strict check failed, 2 usage error, 3 runtime error.

- `claude mcp add` was run outside the repository root: the relative path `./dist-agent/ghostname-mcp.mjs` will not resolve. Run `claude mcp remove ghostname` from the directory where you ran the add (local scope is per directory), then add it again from the repository root, or use the absolute path `node /full/path/to/ghostname/dist-agent/ghostname-mcp.mjs`.
- A permission prompt appears on camera: press the approve key and keep talking, or stop and re-take after pre-approving as in section 2, step 10, point 9.
- The audit returns `UNKNOWN` with `RPC_UNAVAILABLE`: this is the honest result and never a pass. Say so if it happens on camera, then retry. Off camera, switch network or pin `GHOSTNAME_MAINNET_RPC_URL` or `GHOSTNAME_SEPOLIA_RPC_URL` as in section 2 step 10. A single audit can take up to about two minutes per read stage before it gives up: each of the three endpoints has a 10 second timeout and the agent client retries the whole list three more times (viem's default). Do not conclude it has hung before that. The web app retries the list once, so about one minute there.
- The handoff link is missing from the result: it is only offered when the status is not unknown. Fix the RPC first.
- The MCP App view does not render: hosts without MCP Apps support show the text summary and the JSON instead. Narrate from the text; nothing in the workflow needs the view.
- Mainnet publish is requested by mistake on the handoff page: it cannot happen. Mainnet writes are blocked in the shipped build, and the page says so under "Publish to an ENS name".

Total network failure

- Play the pre-recorded two-minute cut. This is why it exists.

## 7. Links

Deployed app (hash routes, deep-linkable; gh-pages commit `35b6e80`, built from source `74772682c5d4`, footer reads "Writes go to Sepolia testnet. Build 74772682c5d4."):

- App home: https://0xskrillah.github.io/ghostname/
- Scan: https://0xskrillah.github.io/ghostname/#/scan
- Create and import identity: https://0xskrillah.github.io/ghostname/#/create
- Pay: https://0xskrillah.github.io/ghostname/#/pay
- Receive: https://0xskrillah.github.io/ghostname/#/receive
- Privacy and threat model: https://0xskrillah.github.io/ghostname/#/privacy
- Demo: https://0xskrillah.github.io/ghostname/#/demo

Local dev server, optional: http://localhost:5173 (`npm run dev`).

Repository: https://github.com/0xSkrillah/ghostname (`main` at `6bd0375` at the time of writing).

Documents in the repository: `README.md`, `SUBMISSION.md` (paste-ready description), `DEMO.md` (runbook), `AGENT_DEMO.md` (agent sequence with expected outputs), `AGENTS.md` (agent setup for Claude Code, Claude Desktop, Cursor, VS Code, the CLI), `PRIVACY.md` (the authoritative threat model), `RELAYERS.md` (the sponsored exit), `04_DEMO_AND_SUBMISSION.md` (the checklist this guide maps to), `03_BUILD_STATUS.md` (verified figures).

On-chain evidence on Sepolia (open on Etherscan while narrating "this is live"):

- Test name registration: https://sepolia.etherscan.io/tx/0x04985bb69fb3b20b034465cbe3d1acfd5a5ca3734ca3eab19db577462383a398
- Stealth record published: https://sepolia.etherscan.io/tx/0x75b7a6404a5a3b1880f8dce7c874cbf34ce65fca64cffeb7e313567b2759ea29
- Stealth payment: https://sepolia.etherscan.io/tx/0x2430f7f8a422a6a527272cd591541c101e9fffd43dccb2a1feed918ee0dc248b
- ERC-5564 announcement: https://sepolia.etherscan.io/tx/0x4164c074fbb0adacf3d3804928e2a4cc803d61e783e9fbbef207608fe3010c11
- Sponsored EIP-7702 sweep, verified live by the app: https://sepolia.etherscan.io/tx/0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25
- Earlier sponsored sweep run: https://sepolia.etherscan.io/tx/0x412cca80d621d5d58a38ef190c6a8c323d18adb1be3488f29868d1b4b2efedc0
- Sweep executor contract (unaudited testnet demo): https://sepolia.etherscan.io/address/0x94E4C39055fa4a5fCd47E03CbcbCD0503848806b
- ERC-5564 announcer singleton: `0x55649E01B5Df198D18D95b5cc5051630cfD45564`
- Demo name resolver: `0xE0e6F09B30eBcdE505FDCA0F1fd244273838FFAE`

Demo name for Pay, Demo step 2 and the agent inputs: `ghostname-3c7714.eth` (ENSv2, Sepolia)

Receive scan start block: `11612900`

Chain ids: mainnet `1` (read-only), Sepolia `11155111` (all writes)

Deadline: Saturday 5 September 2026, 09:00 Amsterdam time.

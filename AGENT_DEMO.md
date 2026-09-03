# GhostName agent demo

One agent audits a real ENS name, explains the exact privacy problem, creates
a safe human handoff, and verifies the result, without ever receiving
transaction authority. Every call below is live and read-only.

Runtime: about three minutes. Preparation: about two.

## Before the demo

```bash
git clone https://github.com/0xSkrillah/ghostname
cd ghostname
npm install
npm run build:agent          # dist-agent/ghostname-mcp.mjs and dist-agent/ghostname.mjs
```

Connect the local server to Claude Code from the repository root:

```bash
claude mcp add ghostname -- node ./dist-agent/ghostname-mcp.mjs
```

Or for Claude Desktop, add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ghostname": {
      "command": "node",
      "args": ["/absolute/path/to/ghostname/dist-agent/ghostname-mcp.mjs"],
      "env": {
        "GHOSTNAME_MAINNET_RPC_URL": "",
        "GHOSTNAME_SEPOLIA_RPC_URL": ""
      }
    }
  }
}
```

Leave the RPC variables empty to use the built-in public endpoints, or set
your own for reliability on venue Wi-Fi. The server runs on your machine, calls
no GhostName API, collects nothing and keeps no history. Its only network
traffic is RPC reads.

Optional: run `npm run mcp:inspect` once beforehand to show the five tools,
five resources and one prompt in the MCP Inspector.

Check the built CLI works against live chain data (no keys needed). Use your
locally configured established mainnet name wherever this file says `name.eth`;
it is never committed:

```bash
node dist-agent/ghostname.mjs audit name.eth --chain 1
```

## The live sequence

### 1. Connect

Open Claude Code (or Claude Desktop) with the `ghostname` server connected.
Say what it is in one line: "a local, read-only ENS privacy adviser; it has no
wallet, no keys and no write capability."

### 2. Ask

> Audit name.eth and help me improve its privacy.

### 3. The agent calls `ghostname_audit_ens_privacy`

Point at the tool call. It carries only `name` and `chainId`. There is no RPC
URL parameter and no key parameter, by design.

### 4. The actual status, with stable codes

Expected live result for an ordinary established name on chain 1: **INCOMPLETE**.

- `STATIC_ADDRESS_EXPOSED` (critical, observed): the name resolves to one
  static address, so every payment is publicly and permanently linkable.
- `STEALTH_RECORD_MISSING` (critical, observed): no stealth meta-address is
  published, so compatible senders have nothing to derive from.
- `RESOLVER_PROVENANCE_UNKNOWN` (unknown): not established, not assumed.
- The model limitations: amounts, sender identity, history, ownership and
  timing stay public; an unsafe withdrawal can re-link.

Say: "Two findings are evidence, one is an unknown the tool refuses to guess,
and the rest are limitations it states up front. There is no score."

### 5. The agent calls `ghostname_prepare_upgrade`

The plan lists prerequisites (including two only the human can confirm: the
wallet controls the name, and which network the record will go to), the
record key `stealth-meta-address[1]`, the findings to resolve, the steps, and
the privacy limitations.

### 6. The secure web handoff

The result, inline in the MCP App view or as text, ends with a link of the form:

```text
https://0xskrillah.github.io/ghostname/#/create?name=name.eth&chainId=1&source=agent&reportId=gcr1_...&version=1
```

Open it. The page says: **key generation happens here, in this browser,
outside the agent**. It re-resolves the name live and shows the resolver it
just read. Nothing in the link is trusted for the privacy result; add
`&status=private-ready` to the URL and the page lists it as ignored.

Do not publish for the mainnet name: mainnet writes are blocked in the shipped
build and the name is read-only demo input.

### 7. What the agent never received

Say it plainly: the agent got a status, codes and a URL. It did not receive a
private key, a viewing key, a record value, calldata or a wallet. It cannot
write anything. The `tests/mcp.boundary.test.ts` rule walks the whole import
graph to keep it that way.

### 8. Audit the controlled Sepolia name

> Audit ghostname-3c7714.eth on Sepolia.

The agent calls the same tool with `chainId: 11155111`.

### 9. Private-ready for compatible senders

Expected live result: **PRIVATE-READY**.

- `DEFAULT_RECORD_SELECTED`, `LOCAL_DERIVATION_CONFIRMED` (observed): three
  independent local derivations produced three distinct one-time addresses.
- `COMPATIBLE_SENDER_REQUIRED` (model): only senders that derive locally get
  the benefit.
- `STATIC_ADDRESS_EXPOSED` is still present, now as a warning: a sender who
  pays the static address links their payment as before.

Say: "Private-ready, not anonymous. The report says so itself."

### 10. Verify the real payment and announcement

> Verify the payment 0x2430f7f8a422a6a527272cd591541c101e9fffd43dccb2a1feed918ee0dc248b
> and announcement 0x4164c074fbb0adacf3d3804928e2a4cc803d61e783e9fbbef207608fe3010c11
> on Sepolia.

`ghostname_verify_payment` re-derives eight checks from chain data, including
the binding check that the announcement names the exact address the payment
funded. Expected: VERIFIED, 8 of 8. The not-proven list stays: recognition
needs the private viewing key, which the tool never asks for.

### 11. Verify the real sponsored exit

> Verify the sponsored exit 0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25 on Sepolia.

`ghostname_verify_sponsored_exit` checks the EIP-7702 type, the sponsor paying
gas, the delegation target, the calldata binding, the EIP-712 intent signature
recovering to the stealth address, the Swept event and the current balance.
Expected: VERIFIED, 8 of 8. Not proven, and said so: that the destination is
unrelated to the recipient.

### 12. Close

> GhostName gives AI agents evidence and gives humans control.

> Keep the ENS name. Break the payment graph.

## If something fails live

- An RPC outage returns status `unknown` with `RPC_UNAVAILABLE`, never a pass.
  Say so; it is the honest result. Retry, or set `GHOSTNAME_*_RPC_URL`.
- The CLI reproduces every step without an agent:

```bash
node dist-agent/ghostname.mjs audit name.eth --chain 1
node dist-agent/ghostname.mjs plan name.eth --chain 1
node dist-agent/ghostname.mjs audit ghostname-3c7714.eth --chain 11155111
node dist-agent/ghostname.mjs verify-payment 0x2430f7f8a422a6a527272cd591541c101e9fffd43dccb2a1feed918ee0dc248b 0x4164c074fbb0adacf3d3804928e2a4cc803d61e783e9fbbef207608fe3010c11 --chain 11155111
node dist-agent/ghostname.mjs verify-exit 0x75a9da4e44494d5983bdfe5a6774255e938248bbbca9414eefcd9acdb0089c25 --chain 11155111
```

- Hosts without MCP Apps support show the text summary and the structured
  JSON instead of the inline view. Nothing in the workflow needs the view.

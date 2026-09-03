# ENS-native agent discovery

How an AI agent can discover GhostName from ENS itself, using the draft
ENSIP-26 agent text records, and how GhostName's own agent identity could be
verified later with ENSIP-25 and ERC-8004.

Everything here is preparation. Nothing publishes automatically, no script
contains a key, the established mainnet demo name is never touched, and no MCP endpoint is
invented before one is deployed.

## ENSIP-26: agent text records (draft)

ENSIP-26 is a **draft**. It defines two text record keys on an ENS name:

| Key | Value |
|---|---|
| `agent-context` | Free-form context for agentic systems (plain text, Markdown, YAML or JSON). |
| `agent-endpoint[<protocol>]` | A URL for the given protocol. Known protocols: `mcp`, `a2a`, `web`. |

GhostName proposes, for a name it controls (the Sepolia demo identity
`ghostname-3c7714.eth`, or any name the operator owns):

| Key | Proposed value |
|---|---|
| `agent-context` | The Markdown block below. |
| `agent-endpoint[web]` | `https://0xskrillah.github.io/ghostname/` |
| `agent-endpoint[mcp]` | Only once a remote Streamable HTTP endpoint is deployed. Until then the record is **not** proposed. |

### Example `agent-context`

```markdown
# GhostName: read-only ENS privacy adviser

GhostName audits ENS names for conformance with the ENS stealth-resolution
convention (ERC-5564 scheme 1) and verifies public evidence of stealth
payments and sponsored exits. It gives forward recipient-address privacy for
compatible senders. It is not anonymity.

- It never requests private keys, viewing keys, seed phrases or passphrases.
- It never signs and never writes ENS records or transactions.
- Every upgrade requires the user's own wallet approval in their browser.
- Supported chains: Ethereum mainnet (1) and Sepolia (11155111).

Tools: ghostname_audit_ens_privacy, ghostname_prepare_upgrade,
ghostname_reaudit_ens_privacy, ghostname_verify_payment,
ghostname_verify_sponsored_exit.

Web: https://0xskrillah.github.io/ghostname/
Local MCP (recommended): npm run build:agent && node dist-agent/ghostname-mcp.mjs
Remote MCP: see agent-endpoint[mcp] when set.
```

## The preparation script

```bash
node scripts/prepare-agent-records.mjs --name ghostname-3c7714.eth --chain 11155111
```

It prints the exact proposed keys and values, reads the current values of
those keys through the Universal Resolver (read-only), and shows what would
change. Options:

| Option | Effect |
|---|---|
| `--name <ens>` | Name to prepare records for. Default `ghostname-3c7714.eth`. |
| `--chain <id>` | `11155111` (default) or `1` for a read-only comparison. |
| `--web-endpoint <url>` | Override `agent-endpoint[web]`. |
| `--mcp-endpoint <url>` | Add `agent-endpoint[mcp]`. Omit until a remote endpoint exists. |
| `--json` | Machine-readable output. |

### Optional Sepolia publishing, behind explicit guards

```bash
SEPOLIA_PRIVATE_KEY=<throwaway testnet key> \
node scripts/prepare-agent-records.mjs --name ghostname-3c7714.eth --chain 11155111 \
  --publish --confirm "PUBLISH ON SEPOLIA"
```

The script refuses to publish unless all of the following hold: `--publish`
is present, `--confirm "PUBLISH ON SEPOLIA"` is typed exactly, the chain is
Sepolia (11155111), the name is not the protected mainnet demo name (from
`PROTECTED_ENS_NAME` or `VITE_DEMO_MAINNET_NAME` in your local `.env`) or any
name ending in it,
and `SEPOLIA_PRIVATE_KEY` is set in the environment (never on the command
line, never in a file in this repository). It then writes each changed key
with one `setText` per record on the resolver discovered at that moment, and
prints the transaction hashes. Mainnet publishing is not implemented in this
script at all.

## ENSIP-25 and ERC-8004: verifying the adviser's identity (post-hackathon)

ENSIP-25 (draft) lets a client confirm that an ENS name is legitimately
associated with an agent registered in an on-chain registry such as ERC-8004.
The name carries a text record whose *key* encodes the registry and agent id:

```text
agent-registration[<ERC-7930 encoded registry address>][<agentId>]
```

A non-empty value attests the association; clients read the claimed name from
the registry entry, build the key, and check it on the name.

For GhostName this would mean, after the hackathon: register the GhostName
adviser in an ERC-8004 identity registry, then set the corresponding
`agent-registration[...]` record on the GhostName ENS name. Both are optional
and neither blocks the MCP MVP. They are recorded here as the intended path,
not as a done step.

## Status

| Item | State |
|---|---|
| ENSIP-26 record proposal and preparation script | done (draft standard) |
| `agent-endpoint[web]` | proposed, not published |
| `agent-endpoint[mcp]` | withheld until a remote endpoint is deployed |
| Sepolia publishing | optional, guarded, human-confirmed |
| ENSIP-25 / ERC-8004 registration | post-hackathon option |

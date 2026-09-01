# GhostName on Swarm (P3)

Two independent P3 capabilities. Both keep to the spec's rule: **testnet only,
and nothing sensitive is ever uploaded in plaintext.**

## 1. Encrypted recovery capsule (implemented + tested)

`src/swarm/capsule.ts` encrypts a GhostName receive identity **locally** with
Web Crypto before it could ever touch Swarm:

- AES-256-GCM, key derived from a passphrase via PBKDF2-SHA256 (210k iters).
- Fresh salt + IV per capsule; GCM tag detects tampering and wrong passphrases.
- The serialized capsule contains **only** ciphertext + KDF params — no
  plaintext key material (asserted by `tests/capsule.test.ts`).
- Flagged `network: "testnet"`; a guard refuses mainnet identities.

This is the security-critical half and it runs with no infrastructure. Upload
the resulting capsule blob to Swarm exactly like any other file (below); only
the encrypted bytes leave the device.

> Production/mainnet private-key backup is explicitly **out of scope**, and
> "deleting" a Swarm reference never retracts data someone already downloaded.

## 2. Deploy the static app to Swarm

Swarm uploads need a running Bee node and a **funded postage stamp** (xBZZ).
This is the one step that needs infrastructure/funding, so it is scripted for
you to run rather than done automatically.

### Option A — venue booth (recommended at Common S3nse)

The Swarm booth provisions a gateway postage stamp. Get the batch id, then:

```bash
npm run build
BEE_API_URL=<gateway-url> BEE_STAMP=<batchId> node scripts/swarm-deploy.mjs
```

### Option B — your own Bee light node

```bash
# 1. Run a Bee node (light mode) reachable at http://localhost:1633
# 2. Buy a postage stamp (needs a funded node):
npm install -g @ethersphere/swarm-cli
swarm-cli stamp buy --depth 17 --amount 100000000    # prints a batch id
# 3. Build and deploy:
npm run build
BEE_STAMP=<batchId> node scripts/swarm-deploy.mjs
```

The script uploads `dist/` as a Swarm collection with `index.html` as both the
index and error document (so the hash-routed SPA resolves correctly), then
prints:

```
bzz://<reference>
https://<reference>.bzz.link/
```

Optionally set an ENS content-hash record to `<reference>` for a stable,
updatable name.

### Why this step isn't run automatically

Buying a postage stamp spends xBZZ (a real testnet asset) from a node you
control. Per GhostName's own safety rules, the agent does not spend assets or
run write operations against your node without you driving it — so this is a
one-command manual step with your stamp.

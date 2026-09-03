#!/usr/bin/env node
/**
 * Prepare the draft ENSIP-26 agent text records for a GhostName-controlled
 * ENS name. Prints the exact proposed keys and values, compares them with the
 * current on-chain values (read-only), and only publishes to Sepolia behind
 * explicit guards and a typed confirmation.
 *
 *   node scripts/prepare-agent-records.mjs --name ghostname-3c7714.eth --chain 11155111
 *
 * Safety:
 *  - never publishes without --publish AND --confirm "PUBLISH ON SEPOLIA";
 *  - never publishes anywhere but Sepolia (11155111);
 *  - never touches the established mainnet demo name (set PROTECTED_ENS_NAME or
 *    VITE_DEMO_MAINNET_NAME in your local .env; the check is on by default for
 *    every mainnet name);
 *  - never contains a key: SEPOLIA_PRIVATE_KEY is read from the environment
 *    only when publishing, and is never printed;
 *  - never proposes agent-endpoint[mcp] unless --mcp-endpoint is given.
 */
import { createPublicClient, createWalletClient, http, namehash, zeroAddress } from 'viem';
import { mainnet, sepolia } from 'viem/chains';
import { normalize } from 'viem/ens';

const WEB_DEFAULT = 'https://0xskrillah.github.io/ghostname/';
const CONFIRM_PHRASE = 'PUBLISH ON SEPOLIA';
const CHAINS = {
  1: { chain: mainnet, rpc: process.env.GHOSTNAME_MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com' },
  11155111: { chain: sepolia, rpc: process.env.GHOSTNAME_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com' },
};

const SET_TEXT_ABI = [
  {
    name: 'setText',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
    ],
    outputs: [],
  },
];

function parseArgs(argv) {
  const out = { name: 'ghostname-3c7714.eth', chain: 11155111, publish: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--name') out.name = next();
    else if (a === '--chain') out.chain = Number(next());
    else if (a === '--web-endpoint') out.web = next();
    else if (a === '--mcp-endpoint') out.mcp = next();
    else if (a === '--confirm') out.confirm = next();
    else if (a === '--publish') out.publish = true;
    else if (a === '--json') out.json = true;
    else if (a === '--help') out.help = true;
    else throw new Error(`Unknown option ${a}`);
  }
  return out;
}

export function agentContext({ web, mcp }) {
  return [
    '# GhostName: read-only ENS privacy adviser',
    '',
    'GhostName audits ENS names for conformance with the ENS stealth-resolution',
    'convention (ERC-5564 scheme 1) and verifies public evidence of stealth',
    'payments and sponsored exits. It gives forward recipient-address privacy for',
    'compatible senders. It is not anonymity.',
    '',
    '- It never requests private keys, viewing keys, seed phrases or passphrases.',
    '- It never signs and never writes ENS records or transactions.',
    "- Every upgrade requires the user's own wallet approval in their browser.",
    '- Supported chains: Ethereum mainnet (1) and Sepolia (11155111).',
    '',
    'Tools: ghostname_audit_ens_privacy, ghostname_prepare_upgrade,',
    'ghostname_reaudit_ens_privacy, ghostname_verify_payment,',
    'ghostname_verify_sponsored_exit.',
    '',
    `Web: ${web}`,
    'Local MCP (recommended): npm run build:agent && node dist-agent/ghostname-mcp.mjs',
    mcp ? `Remote MCP: ${mcp}` : 'Remote MCP: not deployed yet; see agent-endpoint[mcp] when set.',
  ].join('\n');
}

/** The exact proposed records. agent-endpoint[mcp] only when an endpoint exists. */
export function proposedRecords({ web = WEB_DEFAULT, mcp } = {}) {
  const records = {
    'agent-context': agentContext({ web, mcp }),
    'agent-endpoint[web]': web,
  };
  if (mcp) records['agent-endpoint[mcp]'] = mcp;
  return records;
}

function assertNotProtectedName(name) {
  const protectedName = (process.env.PROTECTED_ENS_NAME || process.env.VITE_DEMO_MAINNET_NAME || '')
    .trim()
    .toLowerCase();
  if (protectedName && (name === protectedName || name.endsWith(`.${protectedName}`))) {
    throw new Error('The established mainnet demo name is read-only input and is never modified by any script.');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      'Usage: node scripts/prepare-agent-records.mjs [--name <ens>] [--chain 11155111|1] [--web-endpoint <url>] [--mcp-endpoint <url>] [--json] [--publish --confirm "PUBLISH ON SEPOLIA"]',
    );
    return 0;
  }
  const cfg = CHAINS[args.chain];
  if (!cfg) throw new Error(`Chain ${args.chain} is not supported. Use 11155111 or 1.`);
  const name = normalize(args.name);
  const records = proposedRecords({ web: args.web, mcp: args.mcp });

  const client = createPublicClient({ chain: cfg.chain, transport: http(cfg.rpc) });
  const current = {};
  for (const key of Object.keys(records)) {
    try {
      current[key] = await client.getEnsText({ name, key });
    } catch (err) {
      current[key] = `<<read failed: ${err instanceof Error ? err.message : String(err)}>>`;
    }
  }
  let resolver = null;
  try {
    const r = await client.getEnsResolver({ name });
    resolver = r === zeroAddress ? null : r;
  } catch {
    resolver = null;
  }

  const changes = Object.entries(records).filter(([k, v]) => current[k] !== v).map(([k]) => k);
  const summary = { name, chainId: args.chain, resolver, proposed: records, current, changes, standard: 'ENSIP-26 (draft)' };

  if (args.json) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`ENSIP-26 (draft) agent records for ${name} on chain ${args.chain}`);
    console.log(`Resolver (read now): ${resolver ?? 'none readable'}`);
    for (const [key, value] of Object.entries(records)) {
      console.log(`\n== ${key}${changes.includes(key) ? '  [would change]' : '  [already set]'}`);
      console.log(value);
      if (current[key] && current[key] !== value) console.log(`-- current value differs (${String(current[key]).length} chars)`);
    }
    if (!args.mcp) console.log('\nagent-endpoint[mcp]: not proposed. Pass --mcp-endpoint <url> once a remote server is deployed.');
  }

  if (!args.publish) {
    if (!args.json) console.log('\nNothing was published. Add --publish --confirm "PUBLISH ON SEPOLIA" to write on Sepolia.');
    return 0;
  }

  // ---- Publishing: every guard must hold. ----
  assertNotProtectedName(name);
  if (args.chain !== 11155111) throw new Error('Publishing is only implemented for Sepolia (11155111).');
  if (args.confirm !== CONFIRM_PHRASE) throw new Error(`Refusing to publish: pass --confirm "${CONFIRM_PHRASE}" exactly.`);
  const key = process.env.SEPOLIA_PRIVATE_KEY;
  if (!key) throw new Error('SEPOLIA_PRIVATE_KEY is not set. Set it in the environment only; never on the command line.');
  if (!resolver) throw new Error(`${name} has no readable resolver on Sepolia; nothing to write to.`);
  if (changes.length === 0) {
    console.log('All records already match. Nothing to publish.');
    return 0;
  }

  const { privateKeyToAccount } = await import('viem/accounts');
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(cfg.rpc) });
  if ((await wallet.getChainId()) !== 11155111) throw new Error('Wallet is not on Sepolia.');
  console.log(`\nPublishing ${changes.length} record(s) from ${account.address} to resolver ${resolver} on Sepolia...`);
  for (const k of changes) {
    const hash = await wallet.writeContract({
      address: resolver,
      abi: SET_TEXT_ABI,
      functionName: 'setText',
      args: [namehash(name), k, records[k]],
    });
    console.log(`  ${k}: ${hash}`);
    await client.waitForTransactionReceipt({ hash });
  }
  console.log('Done. Re-run without --publish to verify the records resolve.');
  return 0;
}

const invokedDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`prepare-agent-records: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    },
  );
}

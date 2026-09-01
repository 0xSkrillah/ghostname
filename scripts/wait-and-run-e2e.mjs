/**
 * Polls the demo account balance on Sepolia; once funded (>= 0.01 ETH), runs
 * the live end-to-end suite (npm run e2e:sepolia) and exits with its status.
 * Testnet only. Gives up after MAX_HOURS.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const RPCS = [
  'https://ethereum-sepolia-rpc.publicnode.com',
  'https://sepolia.drpc.org',
  'https://1rpc.io/sepolia',
];
const MAX_HOURS = 12;
const POLL_SECONDS = 30;

const envFile = readFileSync('.env', 'utf8');
const keyMatch = envFile.match(/SEPOLIA_PRIVATE_KEY=(0x[0-9a-fA-F]{64})/);
if (!keyMatch) {
  console.error('No SEPOLIA_PRIVATE_KEY in .env');
  process.exit(1);
}
const { privateKeyToAccount } = await import('viem/accounts');
const address = privateKeyToAccount(keyMatch[1]).address;
console.log(`[watcher] waiting for funds at ${address} (Sepolia)…`);

async function balance() {
  for (const rpc of RPCS) {
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBalance',
          params: [address, 'latest'],
        }),
        signal: AbortSignal.timeout(15_000),
      });
      const json = await res.json();
      if (json.result) return BigInt(json.result);
    } catch {
      // try next RPC
    }
  }
  return null;
}

const deadline = Date.now() + MAX_HOURS * 3600_000;
for (;;) {
  const wei = await balance();
  if (wei !== null && wei >= 10_000_000_000_000_000n) {
    console.log(`[watcher] funded: ${Number(wei) / 1e18} ETH — running live E2E…`);
    const result = spawnSync('npm', ['run', 'e2e:sepolia'], {
      stdio: 'inherit',
      shell: true,
    });
    process.exit(result.status ?? 1);
  }
  if (wei !== null) process.stdout.write('.');
  if (Date.now() > deadline) {
    console.error(`\n[watcher] gave up after ${MAX_HOURS}h without funding.`);
    process.exit(2);
  }
  await new Promise((r) => setTimeout(r, POLL_SECONDS * 1000));
}

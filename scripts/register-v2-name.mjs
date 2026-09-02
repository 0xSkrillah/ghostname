/**
 * Registers the demo ENS name on Sepolia via the ENSv2 ETHRegistrar
 * (0xa885…, verified source) — the currently-working registration path.
 * Recipe replicated from a successful on-chain registration bundle:
 *   1. mint test USDC (open mint) + approve the registrar
 *   2. deploy a dedicated PermissionedResolver proxy via the VerifiableFactory
 *   3. commit → wait MIN_COMMITMENT_AGE → register(label, …, USDC)
 *   4. setAddr + setText(stealth-meta-address[1]) on the resolver
 *   5. verify resolution through the standard viem/Universal Resolver path
 * Testnet only. Idempotent: safe to re-run.
 */
import { loadDemoIdentity, loadTestnetKey } from './lib/testnet-key.mjs';
import {
  createPublicClient,
  createWalletClient,
  http,
  namehash,
  parseAbi,
  toFunctionSelector,
  encodeAbiParameters,
  concatHex,
  toHex,
  formatEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';

const RPC = 'https://ethereum-sepolia-rpc.publicnode.com';
const REGISTRAR = '0xa88553F454b77203B0D036A05c894d555EAAa2Cc';
const FACTORY = '0x10dC6333CDFe1FCEf624c6e0a8221b91804Cd7ef';
const RESOLVER_IMPL = '0x9EAe5C2730a7dD16BDD1DeE6421a1B91e3B0365e';
const USDC = '0x768F42455A2D082E23ceeF7d51e5787C82d67a39';
const ZERO = '0x0000000000000000000000000000000000000000';
const ALL_ROLES = '0x1111111111111111111111111111111111111111111111111111111111111111';

const { key } = loadTestnetKey();
const account = privateKeyToAccount(key);
const transport = http(RPC, { timeout: 30_000 });
const client = createPublicClient({ chain: sepolia, transport });
const wallet = createWalletClient({ account, chain: sepolia, transport });

const label = `ghostname-${account.address.slice(2, 8).toLowerCase()}`;
const ensName = `${label}.eth`;
const node = namehash(ensName);
const identity = loadDemoIdentity();

const registrarAbi = parseAbi([
  'function isAvailable(string label) view returns (bool)',
  'function MIN_COMMITMENT_AGE() view returns (uint256)',
  'function getRegisterPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)',
  'function makeCommitment(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)',
  'function commit(bytes32 commitment)',
  'function register(string label, address owner, bytes32 secret, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 referrer) returns (uint256)',
]);
const erc20Abi = parseAbi([
  'function mint(address to, uint256 amount)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address, address) view returns (uint256)',
]);
const factoryAbi = parseAbi([
  'function deployProxy(address implementation, uint256 salt, bytes data) returns (address)',
]);
const resolverAbi = parseAbi([
  'function setText(bytes32 node, string key, string value)',
  'function setAddr(bytes32 node, uint256 coinType, bytes a)',
  'function text(bytes32 node, string key) view returns (string)',
]);

// Sanity: our deployProxy signature must match the observed on-chain selector.
const sel = toFunctionSelector('deployProxy(address,uint256,bytes)');
if (sel !== '0x5d84121a') {
  console.error(`deployProxy selector mismatch: computed ${sel}, observed 0x5d84121a — aborting.`);
  process.exit(1);
}
const initSel = toFunctionSelector('initialize(address,uint256,bytes[])');
if (initSel !== '0x7058b559') {
  console.error(`initialize selector mismatch: computed ${initSel}, observed 0x7058b559 — aborting.`);
  process.exit(1);
}

const state = existsSync('.demo/v2-registration.json')
  ? JSON.parse(readFileSync('.demo/v2-registration.json', 'utf8'))
  : {};
function saveState() {
  mkdirSync('.demo', { recursive: true });
  writeFileSync('.demo/v2-registration.json', JSON.stringify(state, null, 2));
}
async function send(desc, req) {
  const hash = await wallet.writeContract(req);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`${desc} reverted: ${hash}`);
  console.log(`[ok] ${desc}: ${hash}`);
  return receipt;
}

console.log(`account ${account.address} — ${formatEther(await client.getBalance({ address: account.address }))} ETH`);
console.log(`target name: ${ensName}`);

const available = await client.readContract({
  address: REGISTRAR, abi: registrarAbi, functionName: 'isAvailable', args: [label],
});
console.log('available:', available);

// ---- 1. Resolver (deploy once) ----
if (!state.resolver) {
  const initData = concatHex([
    initSel,
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'uint256' }, { type: 'bytes[]' }],
      [account.address, BigInt(ALL_ROLES), []],
    ),
  ]);
  const salt = BigInt(toHex(crypto.getRandomValues(new Uint8Array(32))));
  const { result: predicted } = await client.simulateContract({
    address: FACTORY, abi: factoryAbi, functionName: 'deployProxy',
    args: [RESOLVER_IMPL, salt, initData], account: account.address,
  });
  console.log('resolver will deploy at:', predicted);
  await send('deploy resolver proxy', {
    address: FACTORY, abi: factoryAbi, functionName: 'deployProxy',
    args: [RESOLVER_IMPL, salt, initData],
  });
  state.resolver = predicted;
  saveState();
} else {
  console.log('resolver already deployed:', state.resolver);
}

if (available) {
  // ---- 2. Payment token ----
  const [base, premium] = await client.readContract({
    address: REGISTRAR, abi: registrarAbi, functionName: 'getRegisterPrice',
    args: [label, 31557600n, USDC],
  });
  const price = ((base + premium) * 120n) / 100n;
  console.log('price (USDC units):', (base + premium).toString());
  const balance = await client.readContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] });
  if (balance < price) {
    await send('mint test USDC', {
      address: USDC, abi: erc20Abi, functionName: 'mint', args: [account.address, price * 2n],
    });
  }
  const allowance = await client.readContract({ address: USDC, abi: erc20Abi, functionName: 'allowance', args: [account.address, REGISTRAR] });
  if (allowance < price) {
    await send('approve registrar', {
      address: USDC, abi: erc20Abi, functionName: 'approve', args: [REGISTRAR, price * 2n],
    });
  }

  // ---- 3. Commit + register ----
  const secret = state.secret ?? toHex(crypto.getRandomValues(new Uint8Array(32)));
  state.secret = secret;
  saveState();
  const regArgs = [label, account.address, secret, ZERO, state.resolver, 31557600n, '0x' + '0'.repeat(64)];
  const commitment = await client.readContract({
    address: REGISTRAR, abi: registrarAbi, functionName: 'makeCommitment', args: regArgs,
  });
  if (!state.committed) {
    await send('commit', { address: REGISTRAR, abi: registrarAbi, functionName: 'commit', args: [commitment] });
    state.committed = true;
    saveState();
    const minAge = await client.readContract({ address: REGISTRAR, abi: registrarAbi, functionName: 'MIN_COMMITMENT_AGE', args: [] });
    console.log(`waiting ${minAge + 15n}s commitment age…`);
    await new Promise((r) => setTimeout(r, Number(minAge + 15n) * 1000));
  }
  const registerReq = {
    address: REGISTRAR, abi: registrarAbi, functionName: 'register',
    args: [label, account.address, secret, ZERO, state.resolver, 31557600n, USDC, '0x' + '0'.repeat(64)],
  };
  await client.simulateContract({ ...registerReq, account: account.address });
  const receipt = await send('REGISTER ' + ensName, registerReq);
  state.registerTx = receipt.transactionHash;
  state.registerBlock = receipt.blockNumber.toString();
  saveState();
} else {
  console.log('name not available (already registered — continuing to records)');
}

// ---- 4. Records ----
await send('setAddr(60)', {
  address: state.resolver, abi: resolverAbi, functionName: 'setAddr',
  args: [node, 60n, account.address],
});
const setTextReceipt = await send('setText stealth-meta-address[1]', {
  address: state.resolver, abi: resolverAbi, functionName: 'setText',
  args: [node, 'stealth-meta-address[1]', identity.stealthMetaAddress],
});
state.setTextTx = setTextReceipt.transactionHash;
saveState();

// ---- 5. Verify through the standard resolution path ----
const resolvedAddr = await client.getEnsAddress({ name: ensName });
const resolvedText = await client.getEnsText({ name: ensName, key: 'stealth-meta-address[1]' });
console.log('getEnsAddress:', resolvedAddr);
console.log('getEnsText(stealth-meta-address[1]):', resolvedText);
console.log('record matches identity:', resolvedText === identity.stealthMetaAddress);
state.ensName = ensName;
state.verified = resolvedText === identity.stealthMetaAddress;
saveState();
const { secret: _omitted, ...shown } = state; // never print the commitment secret
console.log('\nDONE. state:', JSON.stringify(shown, null, 2));

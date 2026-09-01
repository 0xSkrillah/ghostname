// Compile StealthSweepExecutor.sol with solc-js → .demo/executor.json (abi+bytecode).
import solc from 'solc';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const source = readFileSync('contracts/StealthSweepExecutor.sol', 'utf8');
const input = {
  language: 'Solidity',
  sources: { 'StealthSweepExecutor.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: 'cancun', // EIP-7702 lands with Pectra; cancun is a safe compile target
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (out.errors ?? []).filter((e) => e.severity === 'error');
if (errors.length) {
  for (const e of errors) console.error(e.formattedMessage);
  process.exit(1);
}
const c = out.contracts['StealthSweepExecutor.sol'].StealthSweepExecutor;
mkdirSync('.demo', { recursive: true });
writeFileSync(
  '.demo/executor.json',
  JSON.stringify({ abi: c.abi, bytecode: '0x' + c.evm.bytecode.object }, null, 2),
);
console.log('compiled → .demo/executor.json');
console.log('bytecode length:', c.evm.bytecode.object.length / 2, 'bytes');
console.log('solc version:', solc.version());

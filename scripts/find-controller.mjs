// Find controllers actually authorized on the Sepolia .eth base registrar,
// and probe which registration ABI each one speaks.
import { createPublicClient, http, parseAbi, parseAbiItem } from 'viem';
import { sepolia } from 'viem/chains';

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 30_000 }),
});

const BASE_REGISTRAR = '0x57f1887a8BF19b14fC0dF6Fd9B2acc9Af147eA85';
const baseRegAbi = parseAbi(['function controllers(address) view returns (bool)']);

void parseAbiItem;
// Known ETHRegistrarController deployments across ENS versions; the on-chain
// controllers() mapping is the authoritative authorization check.
const candidates = [
  '0xFED6a969AaA60E4b085f5e8004be1049f78d24F4', // Sepolia controller (ENS app, 2023+)
  '0x7e02892cfc2Bfd53a75275451d73cF620e793fc0',
  '0x253553366Da8546fC250F225fe3d25d0C782303b',
  '0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968', // staging (known unauthorized)
  '0x59E16fcCd424Cc24e280Be16E11Bcd56fb0CE547',
];
const v2Abi = parseAbi([
  'function makeCommitment(string name, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, bool reverseRecord, uint16 ownerControlledFuses) pure returns (bytes32)',
  'function minCommitmentAge() view returns (uint256)',
]);
const v3Abi = parseAbi([
  'function makeCommitment((string label, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, uint8 reverseRecord, bytes32 referrer) registration) pure returns (bytes32)',
]);

for (const addr of candidates) {
  const isActive = await client.readContract({
    address: BASE_REGISTRAR,
    abi: baseRegAbi,
    functionName: 'controllers',
    args: [addr],
  });
  let kind = 'unknown-abi';
  const probeArgs = ['probe', '0x3c77141e063ad64A6a6C1Ef1D16380EbCEf3ef98', 7776000n, `0x${'11'.repeat(32)}`, '0x0000000000000000000000000000000000000000', [], false, 0];
  try {
    await client.readContract({ address: addr, abi: v2Abi, functionName: 'makeCommitment', args: probeArgs });
    kind = 'v2 (name,owner,...,bool,uint16)';
  } catch (e) {
    try {
      await client.readContract({
        address: addr, abi: v3Abi, functionName: 'makeCommitment',
        args: [{ label: 'probe', owner: '0x3c77141e063ad64A6a6C1Ef1D16380EbCEf3ef98', duration: 7776000n, secret: `0x${'11'.repeat(32)}`, resolver: '0x0000000000000000000000000000000000000000', data: [], reverseRecord: 0, referrer: `0x${'00'.repeat(32)}` }],
      });
      kind = 'v3 (struct with referrer)';
    } catch {
      // neither
    }
  }
  console.log(`${addr} active=${isActive} abi=${kind}`);
}

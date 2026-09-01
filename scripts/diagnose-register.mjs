// Diagnose the ENS register revert: re-simulate with the exact args from the
// failed run and decode the custom error; check controller authorization.
import { createPublicClient, http, namehash, parseAbi, decodeErrorResult } from 'viem';
import { sepolia } from 'viem/chains';

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com', { timeout: 30_000 }),
});

const CONTROLLER = '0xfb3cE5D01e0f33f41DbB39035dB9745962F1f968';
const REGISTRY = '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e';

const controllerAbi = parseAbi([
  'function register((string label, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, uint8 reverseRecord, bytes32 referrer) registration) payable',
  'function available(string label) view returns (bool)',
  'function commitments(bytes32) view returns (uint256)',
  'function makeCommitment((string label, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, uint8 reverseRecord, bytes32 referrer) registration) pure returns (bytes32)',
  'function rentPrice(string label, uint256 duration) view returns ((uint256 base, uint256 premium))',
  'function minCommitmentAge() view returns (uint256)',
  'function maxCommitmentAge() view returns (uint256)',
  'error CommitmentTooNew(bytes32 commitment, uint256 minimumCommitmentTimestamp, uint256 currentTimestamp)',
  'error CommitmentTooOld(bytes32 commitment, uint256 maximumCommitmentTimestamp, uint256 currentTimestamp)',
  'error DurationTooShort(uint256 duration)',
  'error InsufficientValue()',
  'error NameNotAvailable(string name)',
  'error ResolverRequiredWhenDataSupplied()',
  'error UnexpiredCommitmentExists(bytes32 commitment)',
  'error InvalidLabel(string label)',
]);

const registryAbi = parseAbi(['function owner(bytes32 node) view returns (address)']);
const baseRegAbi = parseAbi(['function controllers(address) view returns (bool)']);

const registration = {
  label: 'ghostname-3c7714',
  owner: '0x3c77141e063ad64A6a6C1Ef1D16380EbCEf3ef98',
  duration: 7776000n,
  secret: '0x4f697d2b8ff1e55380d7b0a8f8cbf51ebb90a9f81300b18befbaa21bee9e534f',
  resolver: '0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5',
  data: [],
  reverseRecord: 0,
  referrer: '0x' + '0'.repeat(64),
};

// 1. Base registrar + controller authorization
const baseRegistrar = await client.readContract({
  address: REGISTRY,
  abi: registryAbi,
  functionName: 'owner',
  args: [namehash('eth')],
});
console.log('base registrar (.eth owner):', baseRegistrar);
try {
  const isController = await client.readContract({
    address: baseRegistrar,
    abi: baseRegAbi,
    functionName: 'controllers',
    args: [CONTROLLER],
  });
  console.log('controller authorized on base registrar:', isController);
} catch (e) {
  console.log('controllers() check failed:', e.shortMessage ?? e.message);
}

// 2. Availability, commitment state, ages
console.log('available:', await client.readContract({
  address: CONTROLLER, abi: controllerAbi, functionName: 'available', args: ['ghostname-3c7714'],
}));
const commitment = await client.readContract({
  address: CONTROLLER, abi: controllerAbi, functionName: 'makeCommitment', args: [registration],
});
const committedAt = await client.readContract({
  address: CONTROLLER, abi: controllerAbi, functionName: 'commitments', args: [commitment],
});
const block = await client.getBlock();
console.log('commitment:', commitment, 'committedAt:', committedAt.toString(), 'now:', block.timestamp.toString(), 'age:', (block.timestamp - committedAt).toString());
console.log('minCommitmentAge:', (await client.readContract({ address: CONTROLLER, abi: controllerAbi, functionName: 'minCommitmentAge', args: [] })).toString());
console.log('maxCommitmentAge:', (await client.readContract({ address: CONTROLLER, abi: controllerAbi, functionName: 'maxCommitmentAge', args: [] })).toString());

// 3. Simulate register and decode the revert
const price = await client.readContract({
  address: CONTROLLER, abi: controllerAbi, functionName: 'rentPrice', args: ['ghostname-3c7714', 7776000n],
});
const value = ((price.base + price.premium) * 110n) / 100n;
console.log('rentPrice base/premium:', price.base.toString(), price.premium.toString(), 'value:', value.toString());
try {
  await client.simulateContract({
    address: CONTROLLER,
    abi: controllerAbi,
    functionName: 'register',
    args: [registration],
    value,
    account: registration.owner,
  });
  console.log('simulation SUCCEEDS now');
} catch (e) {
  const data = e.cause?.cause?.data ?? e.cause?.data ?? e.data;
  console.log('revert raw data:', JSON.stringify(data));
  const hex = typeof data === 'string' ? data : data?.data;
  if (hex && hex !== '0x') {
    try {
      console.log('decoded:', decodeErrorResult({ abi: controllerAbi, data: hex }));
    } catch {
      console.log('could not decode against known errors');
    }
  }
  console.log('shortMessage:', e.shortMessage);
}
